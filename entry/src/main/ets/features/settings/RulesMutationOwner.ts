import { RULES_MUTATION_METHODS } from './RulesMutationContract';
import type { JsonObject, ReaderCoreResultEvent } from '@reader/core-harmony';
import { BookRequestNotDispatchedError, type BookRequestOptions } from '../../app/BookRequestScheduler';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import { RulesMutationIntentStore, type RulesMutationIntent, type RuleSubscriptionJourney, type RuleSubscriptionStep } from './RulesMutationIntentStore';

export interface RulesMutationSnapshot {
  generation: number; busy: boolean; confirmation: 'undispatched' | 'confirmed' | 'unknown';
  label: string; method: string; message: string;
  blocked: boolean; canRetryOriginal: boolean; operationId?: string; sequence?: number;
  writeStage: 'intent' | 'core' | 'cleanup';
  subscription?: { kind: 0 | 1 | 2 | 3; cursor: number; total: number; confirmedParts: number; failedParts: number; metadataConfirmed: boolean };
}
interface RulesMutationReceipt {
  binding: { operationId: string; sequence: number; payloadFingerprint: string };
  method: string; outcome: 'applied' | 'rejected'; data: JsonObject; ackFingerprint: string;
}
interface RulesMutationQuery { head?: { operationId: string; sequence: number; payloadFingerprint: string }; receipt?: RulesMutationReceipt; }
export class RulesMutationError extends Error {
  readonly writeUncertain: boolean;
  constructor(message: string, writeUncertain: boolean) { super(message); this.name = 'RulesMutationError'; this.writeUncertain = writeUncertain; }
}
class RulesMutationRejectedError extends RulesMutationError {
  constructor(message: string) { super(message, false); }
}

/** Original finite rule authority, shared by settings/full/quick reader UI.
 * Core owns single-row ordering and atomic original receipts. Host retains one
 * complete AtomicFile intent, including across Runtime/Ability replacement. */
export class RulesMutationOwner {
  private static readonly owners: WeakMap<ReadingGatewayRuntime, RulesMutationOwner> = new WeakMap();
  static forRuntime(runtime: ReadingGatewayRuntime): RulesMutationOwner {
    let owner = RulesMutationOwner.owners.get(runtime);
    if (owner === undefined) { owner = new RulesMutationOwner(runtime); RulesMutationOwner.owners.set(runtime, owner); }
    return owner;
  }
  private state: RulesMutationSnapshot = { generation: 0, busy: false, confirmation: 'undispatched',
    label: '', method: '', message: '', blocked: false, canRetryOriginal: false, writeStage: 'intent' };
  private readonly runtime: ReadingGatewayRuntime;
  private readonly intents: RulesMutationIntentStore;
  private constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; this.intents = new RulesMutationIntentStore(runtime); }
  snapshot(): RulesMutationSnapshot { return { ...this.state }; }

  async run<T>(label: string, isCurrent: () => boolean,
    operation: (request: (method: string, params: JsonObject) => Promise<ReaderCoreResultEvent>,
      confirmed: () => void) => Promise<T>, observer?: ReaderWriteEvidence,
    sourceCleanup?: () => Promise<boolean>): Promise<T> {
    if (this.state.busy || this.state.blocked || this.state.confirmation === 'unknown')
      throw new RulesMutationError(this.state.busy ? '另一规则操作正在执行' : this.state.message || '先前规则原操作仍需核对', this.state.confirmation === 'unknown');
    const current = (): boolean => this.current(isCurrent);
    if (!current()) throw new RulesMutationError('规则请求已过期，未派发', false);
    const evidence = new ReaderWriteEvidence(); const generation = this.state.generation + 1;
    const assignedBefore = this.intents.accepted();
    this.state = { generation, busy: true, confirmation: 'undispatched', label, method: '', message: '',
      blocked: false, canRetryOriginal: false, writeStage: 'intent' };
    let intent: RulesMutationIntent | undefined;
    let exactRejected = false;
    let qualifiedReceipt: RulesMutationReceipt | undefined;
    const request = async (method: string, params: JsonObject): Promise<ReaderCoreResultEvent> => {
      if (intent !== undefined || evidence.dispatchedCount !== 0) throw new Error('one rule operation must contain one mutation command');
      if (!RULES_MUTATION_METHODS.includes(method)) throw new Error('未登记的规则命令');
      const fixed = JSON.parse(JSON.stringify(params)) as JsonObject;
      const pending = await this.intents.load();
      if (pending !== undefined) { this.admitPending(pending); throw new RulesMutationError(this.state.message, true); }
      this.state.method = method;
      intent = await this.intents.accept(label, method, fixed, async (): Promise<number> => {
        const q = await this.query(undefined, current); this.requireMethodCapability(method); return q.head?.sequence ?? 0;
      }, current);
      this.admitIdentity(intent); this.state.writeStage = 'core';
      const options: BookRequestOptions = {
        canDispatch: (): boolean => this.state.generation === generation && this.state.busy && current(),
        onDispatch: (): void => { evidence.dispatched(); observer?.dispatched(); },
      };
      try {
        const event = await this.runtime.request('rules.mutation.apply', this.params(intent), options);
        const receipt = this.decodeReceipt(event.data, intent);
        if (receipt.outcome === 'rejected') {
          evidence.rejectedBeforeExecution(); observer?.rejectedBeforeExecution(); exactRejected = true;
          await this.clearTerminal(intent, 'undispatched', receipt);
          throw new RulesMutationRejectedError(this.rejectionMessage(receipt));
        }
        qualifiedReceipt = receipt; return { ...event, data: receipt.data };
      } catch (error) {
        if (error instanceof BookRequestNotDispatchedError) {
          evidence.rejectedBeforeExecution(); observer?.rejectedBeforeExecution();
          await this.clearTerminal(intent, 'undispatched');
        }
        throw error;
      }
    };
    const confirmed = (): void => {
      if (evidence.dispatchedCount !== 1 || evidence.confirmedCount !== 0) throw new Error('qualified rule ACK requires the original actual dispatch');
      evidence.confirmed(); observer?.confirmed(); this.state.confirmation = 'confirmed';
    };
    try {
      const value = await operation(request, confirmed);
      if (evidence.confirmation() !== 'confirmed' || intent === undefined) throw new Error('rule operation did not return a qualified original ACK');
      if (sourceCleanup!==undefined && qualifiedReceipt!==undefined && this.needsSourceCleanup(intent)) {
        if (!await this.finishSourceCleanup(intent,qualifiedReceipt,sourceCleanup,true)) return value;
      }
      // Cleanup failure cannot turn a qualified committed write into failure.
      await this.clearTerminal(intent, 'confirmed', qualifiedReceipt); return value;
    } catch (error) {
      const confirmation = evidence.confirmation();
      const knownPending = this.state.blocked && this.state.confirmation === 'unknown' && this.state.operationId !== undefined;
      this.state.confirmation = exactRejected ? 'undispatched' : knownPending ? 'unknown' : confirmation;
      const message = error instanceof Error ? error.message : '规则操作异常';
      if (!exactRejected && confirmation !== 'confirmed') {
        try { const pending = await this.intents.load(); if (pending !== undefined) this.admitPending(pending); }
        catch (_) {
          const accepted = this.intents.accepted();
          if (accepted !== undefined && accepted !== assignedBefore) this.admitPending(accepted);
          else if (confirmation === 'unknown' || knownPending) this.state.blocked = true;
          // Retirement before accepted identity or actual SDK dispatch is
          // not a durable unknown. Never borrow the successor's journal.
        }
      }
      if (this.state.confirmation === 'unknown') this.state.message = `规则原操作记录或 Core 回执尚未确认，已保留原内容；读取列表不能解除保护：${message}`;
      else this.state.message = message;
      throw new RulesMutationError(this.state.message, this.state.confirmation === 'unknown');
    } finally { this.state.busy = false; }
  }

  /** Only subscription import + its fixed timestamp; not an arbitrary task executor. */
  async runSubscription(kind: 0 | 1 | 2 | 3, steps: RuleSubscriptionStep[],
    localFailures: { index: number; message: string }[], currentAdmission: () => boolean,
    qualify: (method: string, params: JsonObject, data: JsonObject) => void,
    observer?: ReaderWriteEvidence,
    rejected?: (step: RuleSubscriptionStep, data: JsonObject) => void): Promise<RulesMutationSnapshot> {
    if (this.state.busy || this.state.blocked || this.state.confirmation === 'unknown') throw new RulesMutationError('先核对原规则/订阅操作', true);
    const current = (): boolean => this.current(currentAdmission);
    this.state = { generation: this.state.generation + 1, busy: true, confirmation: 'undispatched',
      label: kind===3 ? '书源文档导入' : '订阅更新', method: '', message: '', blocked: false, canRetryOriginal: false, writeStage: 'intent' };
    const acceptedBefore = this.intents.accepted();
    try {
      const existing = await this.intents.load(); if (existing !== undefined) { this.admitPending(existing); throw new Error(this.state.message); }
      if (kind===3 ? steps.length<1 || steps.length>5000 || steps.some(s=>s.method!=='source.import') :
        steps.length < 2 || steps[steps.length-1].method !== 'rule-sub.put' || steps.slice(0,-1).some(s =>
        s.method !== (kind === 0 ? 'source.import' : kind === 1 ? 'rss-source.import' : 'rule-bundle.import'))) throw new Error('订阅步骤不属于原类型旅程');
      const journey: RuleSubscriptionJourney = { kind, steps, localFailures, cursor: 0, facts: [] };
      const first = steps[0];
      const intent = await this.intents.accept(kind===3 ? '书源文档导入' : '订阅更新', first.method, first.params,
        async (): Promise<number> => { const q = await this.query(undefined,current); this.requireSubscriptionCapability(kind); return q.head?.sequence ?? 0; },current,journey);
      return await this.continueSubscription(intent,current,qualify,true,observer,true,rejected);
    } catch (error) {
      const accepted = this.intents.accepted();
      if (accepted !== undefined && accepted !== acceptedBefore) this.admitPending(accepted);
      this.state.message = error instanceof Error ? error.message : '订阅更新暂时不可用';
      throw new RulesMutationError(this.state.message,this.state.confirmation === 'unknown');
    } finally { this.state.busy = false; }
  }
  private async continueSubscription(initial: RulesMutationIntent, current: () => boolean,
    qualify: (method: string, params: JsonObject, data: JsonObject) => void,
    explicit: boolean, observer?: ReaderWriteEvidence, durable: boolean = false,
    rejected?: (step: RuleSubscriptionStep, data: JsonObject) => void): Promise<RulesMutationSnapshot> {
    let intent = initial;
    while (true) {
      this.admitPending(intent); this.state.canRetryOriginal = false;
      const journey = intent.subscription; if (journey === undefined) throw new Error('缺少订阅原旅程');
      this.projectSubscription(intent);
      const q = intent.terminal === undefined ? await this.query(intent,current) : undefined;
      if (q !== undefined) this.requireSubscriptionCapability(journey.kind);
      let receipt = intent.terminal === undefined ? q?.receipt : this.decodeReceipt(intent.terminal,intent);
      if (receipt === undefined) {
        const head = q?.head?.sequence ?? 0;
        if (head !== intent.sequence - 1) throw new Error(head >= intent.sequence ? '流水已越过订阅原步骤且无精确回执，保持阻断' : '订阅原流水不连续');
        this.state.canRetryOriginal = true;
        if (!explicit) { this.state.message = '可继续保留的原订阅步骤，下载内容与更新时间不会重建'; return this.snapshot(); }
        if (!durable) await this.intents.ensureDurable(intent,current);
        this.state.writeStage = 'core';
        const event = await this.runtime.request('rules.mutation.apply',this.params(intent), {
          canDispatch: current, onDispatch: (): void => observer?.dispatched(),
        });
        receipt = this.decodeReceipt(event.data,intent);
      }
      if (receipt.outcome === 'applied') { qualify(intent.mutation.method,intent.mutation.params,receipt.data);
        if (observer !== undefined && observer.confirmedCount < observer.dispatchedCount) observer.confirmed(); }
      else { observer?.rejectedBeforeExecution(); rejected?.(journey.steps[journey.cursor],receipt.data); }
      const last = journey.cursor === journey.steps.length - 1;
      const confirmedImport = (journey.settled?.applied ?? journey.facts.filter(f=>f.outcome === 'applied').length) + (receipt.outcome === 'applied' ? 1 : 0);
      // Definite original Source item rejection preserves the previous partial
      // semantics. Unknown transport stops before any later item or timestamp.
      const abort = receipt.outcome === 'rejected' && (journey.kind !== 0 && journey.kind !== 3 || last);
      const noImports = journey.kind === 0 && journey.cursor === journey.steps.length - 2 && confirmedImport === 0;
      if (last || abort || noImports) {
        this.projectSubscription(intent,receipt);
        await this.clearTerminal(intent,receipt.outcome === 'applied' || journey.kind===3 && confirmedImport>0 ? 'confirmed' : 'undispatched',receipt);
        if (receipt.outcome === 'rejected') this.state.message = this.rejectionMessage(receipt);
        return this.snapshot();
      }
      this.projectSubscription(intent,receipt);
      this.state.confirmation = 'unknown'; this.state.blocked = true; this.state.canRetryOriginal = true;
      this.state.message = '原订阅步骤已确认，仍需继续剩余导入及固定更新时间';
      if (!explicit) return this.snapshot();
      // Actual head must still belong to this original ACK; a foreign higher
      // sequence never admits advancing the old journey.
      const head = (await this.query(intent,current)).head;
      if (head?.operationId !== intent.operationId || head.sequence !== intent.sequence) throw new Error('订阅原回执已被较新流水越过，保持阻断');
      intent = await this.intents.advanceSubscription(intent,receipt as unknown as JsonObject,head.sequence,current);
      durable = true; this.admitPending(intent);
    }
  }
  private projectSubscription(intent: RulesMutationIntent, currentReceipt?: RulesMutationReceipt): void {
    const j=intent.subscription; if (j === undefined) return;
    const facts=[...j.facts,...(currentReceipt === undefined ? [] : [{ outcome: currentReceipt.outcome, method:currentReceipt.method }])];
    this.state.subscription={ kind:j.kind,cursor:j.cursor,total:j.steps.length,
      confirmedParts:(j.settled?.applied ?? j.facts.filter(f=>f.outcome==='applied').length)+(currentReceipt?.outcome==='applied'?1:0),
      failedParts:j.localFailures.length+(j.settled?.rejected ?? j.facts.filter(f=>f.outcome==='rejected').length)+(currentReceipt?.outcome==='rejected'?1:0),
      metadataConfirmed:facts.some(f=>f.method==='rule-sub.put' && f.outcome==='applied') };
  }

  /** Pure exact query first. Explicit safe retry reuses the complete same ID;
   * null is never "not dispatched", a higher head never confirms an old delta. */
  async recoverOriginal(isCurrent: () => boolean,
    qualify: (method: string, params: JsonObject, data: JsonObject) => void,
    retryOriginal: boolean = false, family?: 'source-management',
    sourceCleanup?: (method: string, params: JsonObject) => Promise<boolean>): Promise<RulesMutationSnapshot> {
    if (this.state.busy) throw new RulesMutationError('另一规则操作正在执行', this.state.confirmation === 'unknown');
    const current = (): boolean => this.current(isCurrent); if (!current()) throw new RulesMutationError('规则核对入口已退役', true);
    this.state.busy = true; this.state.generation += 1;
    try {
      const intent = await this.intents.load();
      if (intent === undefined) { this.state.blocked = false; return this.snapshot(); }
      this.admitPending(intent);
      const sourceFamily = intent.subscription?.kind===3 || intent.mutation.method==='source.update' || intent.mutation.method==='source.delete';
      if ((family==='source-management') !== sourceFamily) throw new Error('当前入口不能继续另一家族的原操作；原记录保持阻断');
      if (intent.subscription !== undefined) return await this.continueSubscription(intent,current,qualify,retryOriginal);
      let receipt = intent.terminal === undefined ? undefined : this.decodeReceipt(intent.terminal, intent);
      const query = receipt === undefined ? await this.query(intent, current) : undefined;
      if (receipt === undefined) this.requireMethodCapability(intent.mutation.method);
      receipt = receipt ?? query?.receipt;
      if (receipt === undefined) {
        const head = query?.head?.sequence ?? 0;
        if (head >= intent.sequence) throw new RulesMutationError('规则流水已越过原记录且无精确回执，保持阻断；不能按列表或总量判定成功', true);
        if (head !== intent.sequence - 1) throw new RulesMutationError('规则原记录与当前流水不连续，保持阻断', true);
        this.state.canRetryOriginal = true;
        if (!retryOriginal) { this.state.message = '尚无原操作精确回执；可明确重试已保留的原规则内容，不会创建新标识'; return this.snapshot(); }
        await this.intents.ensureDurable(intent, current); this.state.writeStage = 'core';
        const event = await this.runtime.request('rules.mutation.apply', this.params(intent), { canDispatch: current });
        receipt = this.decodeReceipt(event.data, intent);
      }
      if (receipt.outcome === 'applied') {
        qualify(intent.mutation.method, intent.mutation.params, receipt.data);
        if (family==='source-management' && sourceCleanup!==undefined && this.needsSourceCleanup(intent)) {
          if (!await this.finishSourceCleanup(intent,receipt,
            (): Promise<boolean> => sourceCleanup(intent.mutation.method,intent.mutation.params),retryOriginal)) return this.snapshot();
        }
      }
      this.state.canRetryOriginal = false;
      await this.clearTerminal(intent, receipt.outcome === 'applied' ? 'confirmed' : 'undispatched', receipt);
      if (receipt.outcome === 'rejected') this.state.message = this.rejectionMessage(receipt);
      return this.snapshot();
    } catch (error) {
      if (this.state.confirmation !== 'confirmed') this.state.confirmation = 'unknown';
      this.state.blocked = true; this.state.message = error instanceof Error ? error.message : '规则核对暂时不可用';
      throw new RulesMutationError(this.state.message, this.state.confirmation === 'unknown');
    } finally { this.state.busy = false; }
  }
  private needsSourceCleanup(intent: RulesMutationIntent): boolean {
    return intent.mutation.method==='source.delete' || intent.mutation.method==='source.update' && intent.mutation.params['enabled']===false;
  }
  private async finishSourceCleanup(intent: RulesMutationIntent, receipt: RulesMutationReceipt,
    cleanup: () => Promise<boolean>, explicit: boolean): Promise<boolean> {
    this.state.confirmation='confirmed';this.state.writeStage='cleanup';this.state.blocked=true;
    this.state.canRetryOriginal=true;
    this.state.message='Core 原书源写入已确认；Host 登录会话清理仍待完成，可继续原清理，不会重写 Core';
    try {
      await this.intents.retainTerminal(intent,receipt as unknown as JsonObject);
      if (!explicit) return false;
      if (!await cleanup()) return false;
      return true;
    } catch (error) {
      this.state.message+='：'+(error instanceof Error ? error.message : '原清理尚未确认');
      return false;
    }
  }
  private async clearTerminal(intent: RulesMutationIntent, confirmation: 'confirmed' | 'undispatched', terminal?: RulesMutationReceipt): Promise<void> {
    this.state.confirmation = confirmation; this.state.writeStage = 'cleanup'; this.state.canRetryOriginal = false;
    try { await this.intents.clear(intent, terminal as unknown as JsonObject | undefined); this.state.blocked = false; this.state.message = ''; }
    catch (_) { this.state.blocked = true; this.state.message = `${confirmation === 'confirmed' ? '原规则写入已确认' : '原规则操作未执行'}；原记录清理尚未确认，请核对后再开始下一项`; }
  }
  private admitIdentity(intent: RulesMutationIntent): void { this.state.operationId = intent.operationId; this.state.sequence = intent.sequence; this.state.label = intent.label; this.state.method = intent.mutation.method; this.projectSubscription(intent); }
  private admitPending(intent: RulesMutationIntent): void {
    this.admitIdentity(intent); this.state.confirmation = 'unknown'; this.state.blocked = true;
    this.state.message = '先前规则原操作仍需核对，不能覆盖原内容或接受另一草稿';
  }
  private params(intent: RulesMutationIntent): JsonObject { return { operationId: intent.operationId, sequence: intent.sequence, mutation: intent.mutation }; }
  private current(admission: () => boolean): boolean { try { return ReaderRuntimeOwner.isCurrent(this.runtime as ReaderRuntimeOwner) && admission(); } catch (_) { return false; } }
  private requireSubscriptionCapability(kind: 0 | 1 | 2 | 3): void {
    this.requireCapability();
    if (kind===3) return;
    if (this.runtime.supportsCoreCapability?.('rules.mutation.subscription.v1') !== true) throw new Error('当前 Core 不支持订阅原旅程回执，已停止派发');
  }
  private requireMethodCapability(method: string): void {
    this.requireCapability();
    if ((method==='source.update' || method==='source.delete') && this.runtime.supportsCoreCapability?.('rules.mutation.source-management.v1') !== true)
      throw new Error('当前 Core 不支持书源原管理回执，已停止派发');
  }
  private requireCapability(): void { if (this.runtime.supportsCoreCapability?.('rules.mutation.exact.v1') !== true) throw new Error('当前 Core 不具备规则精确回执能力，已停止写入'); }
  private async query(intent: RulesMutationIntent | undefined, current: () => boolean): Promise<RulesMutationQuery> {
    const event = await this.runtime.request('rules.mutation.query', intent === undefined ? {} : { operationId: intent.operationId, expected: this.params(intent) }, { canDispatch: current });
    const raw = event.data; const headRaw = raw['head'];
    let head: RulesMutationQuery['head'];
    if (headRaw !== null) {
      const value = this.object(headRaw, '规则流水');
      if (!Number.isSafeInteger(value['sequence']) || (value['sequence'] as number) <= 0 ||
        typeof value['operationId'] !== 'string' || !this.fingerprint(value['payloadFingerprint'])) throw new Error('规则流水回执无效');
      head = value as unknown as RulesMutationQuery['head'];
    }
    const receiptRaw = raw['receipt'];
    if (receiptRaw === null) return { head };
    if (intent === undefined) throw new Error('规则头查询不应返回无归属回执');
    const receipt = this.decodeReceipt(this.object(receiptRaw, '规则回执'), intent);
    if (head?.operationId !== receipt.binding.operationId || head.sequence !== receipt.binding.sequence ||
      head.payloadFingerprint !== receipt.binding.payloadFingerprint) throw new Error('规则回执与实际流水不一致');
    return { head, receipt };
  }
  private decodeReceipt(raw: JsonObject, intent: RulesMutationIntent): RulesMutationReceipt {
    const binding = this.object(raw['binding'], '规则绑定');
    if (binding['operationId'] !== intent.operationId || binding['sequence'] !== intent.sequence ||
      !this.fingerprint(binding['payloadFingerprint']) || !this.fingerprint(raw['ackFingerprint']) ||
      raw['method'] !== intent.mutation.method || (raw['outcome'] !== 'applied' && raw['outcome'] !== 'rejected')) throw new Error('规则原回执与固定标识不匹配');
    this.object(raw['data'], '规则原数据'); return raw as unknown as RulesMutationReceipt;
  }
  private rejectionMessage(receipt: RulesMutationReceipt): string { const error = this.object(receipt.data['error'], '规则原拒绝'); return typeof error['message'] === 'string' ? error['message'] : 'Core 明确拒绝原规则操作'; }
  private object(value: unknown, name: string): JsonObject { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name}结构无效`); return value as JsonObject; }
  private fingerprint(value: unknown): boolean { return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value); }
}
