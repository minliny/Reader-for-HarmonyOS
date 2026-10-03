import { sha256Hex } from '../../app/BundledBookSourceSupply';
import fileIo from '@ohos.file.fs';
import type { BusinessError } from '@ohos.base';
import util from '@ohos.util';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { replaceReaderAtomicSnapshot } from '../../app/ReaderAtomicSnapshotFile';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';

import { RULES_MUTATION_METHODS } from './RulesMutationContract';
export interface RuleSubscriptionStep { method: string; params: JsonObject; sourceIndex?: number; }
export interface RuleSubscriptionFact { operationId: string; sequence: number; method: string;
  outcome: 'applied' | 'rejected'; data: JsonObject; receipt: JsonObject; }
export interface RuleSubscriptionJourney {
  kind: 0 | 1 | 2;
  /** Original document-derived DTOs + one frozen metadata timestamp. */
  steps: RuleSubscriptionStep[];
  localFailures: { index: number; message: string }[];
  cursor: number;
  plan?: { id: string; fingerprint: string };
  settled?: { applied: number; rejected: number };
  /** Legacy records retain full history until qualified migration; modern
   * records retain only the newest exact predecessor fact and aggregate. */
  facts: RuleSubscriptionFact[];
}
export interface RulesMutationIntent {
  version: 1; operationId: string; sequence: number; label: string;
  mutation: { method: string; params: JsonObject };
  /** Only a qualified actual terminal Core receipt; independent from cleanup ACK. */
  terminal?: JsonObject;
  recordFingerprint?: string;
  subscription?: RuleSubscriptionJourney;
}
interface RuleSubscriptionPlan { version: 1; id: string; kind: 0 | 1 | 2;
  steps: RuleSubscriptionStep[]; localFailures: { index: number; message: string }[]; }
interface QualifiedSubscriptionPlan { runtime: ReadingGatewayRuntime; fingerprint: string;
  value: RuleSubscriptionPlan; raw: string; params: string[]; durable: boolean; }
/** Single complete accepted delta over the existing AtomicFile primitive. The
 * static IO lane and warm tuple outlive Runtime replacement. Never evict an
 * unknown tuple, infer persistence from readText, or replace it with a draft. */
export class RulesMutationIntentStore {
  private static tail: Promise<void> = Promise.resolve();
  private static planCache: QualifiedSubscriptionPlan | undefined;
  private static warm: RulesMutationIntent | undefined;
  private readonly runtime: ReadingGatewayRuntime;
  private acceptedIntent: RulesMutationIntent | undefined;
  constructor(runtime: ReadingGatewayRuntime) { this.runtime = runtime; }
  accepted(): RulesMutationIntent | undefined { return this.acceptedIntent; }
  async load(): Promise<RulesMutationIntent | undefined> {
    return this.serial(async (): Promise<RulesMutationIntent | undefined> => {
      this.assertCurrent(); const disk = await this.read(); this.assertCurrent();
      const warm = RulesMutationIntentStore.warm;
      if (warm !== undefined && disk !== undefined && !this.same(warm, disk) && !this.previousOf(disk, warm)) throw new Error('规则原记录与暖状态冲突，不能覆盖');
      const intent = warm ?? disk;
      if (intent !== undefined) { await this.validateSubscription(intent); await this.validateIntegrity(intent,intent===warm); }
      RulesMutationIntentStore.warm = intent; return intent;
    });
  }
  async accept(label: string, method: string, params: JsonObject,
    queryHead: () => Promise<number>, admitted: () => boolean, subscription?: RuleSubscriptionJourney): Promise<RulesMutationIntent> {
    return this.serial(async (): Promise<RulesMutationIntent> => {
      this.assertCurrent(); if (!admitted()) throw new Error('规则操作已退役，未接受');
      const disk = await this.read(); this.assertCurrent();
      if (disk !== undefined || RulesMutationIntentStore.warm !== undefined) throw new Error('上一规则原操作仍需核对，不能接受另一草稿');
      if (!RULES_MUTATION_METHODS.includes(method)) throw new Error('不属于已登记的有限规则命令');
      const fixed = JSON.parse(JSON.stringify(params)) as JsonObject;
      const head = await queryHead(); this.assertCurrent(); if (!admitted()) throw new Error('规则操作已退役，未接受');
      if (!Number.isSafeInteger(head) || head < 0 || head >= Number.MAX_SAFE_INTEGER) throw new Error('规则流水号不可继续，不能重置');
      const sequence = head + 1;
      const intent: RulesMutationIntent = { version: 1, operationId: `${util.generateRandomUUID()}/${sequence}`,
        sequence, label, mutation: { method, params: fixed },
        subscription: subscription === undefined ? undefined : JSON.parse(JSON.stringify(subscription)) as RuleSubscriptionJourney };
      RulesMutationIntentStore.warm = intent;
      this.acceptedIntent = intent;
      await this.write(intent); return intent;
    });
  }
  /** A qualified previous original receipt and the next fixed tuple are one
   * Atomic snapshot. Next Core dispatch is forbidden until this ACK. */
  async advanceSubscription(intent: RulesMutationIntent, receipt: JsonObject,
    head: number, admitted: () => boolean): Promise<RulesMutationIntent> {
    return this.serial(async (): Promise<RulesMutationIntent> => {
      this.assertCurrent(); if (!admitted()) throw new Error('订阅旅程已退役');
      const journey = intent.subscription;
      if (journey === undefined || journey.cursor + 1 >= journey.steps.length || head !== intent.sequence ||
        !Number.isSafeInteger(head) || head >= Number.MAX_SAFE_INTEGER) throw new Error('订阅原流水不能推进');
      const disk = await this.read(); this.assertCurrent(); if (!admitted()) throw new Error('订阅旅程已退役');
      const warm = RulesMutationIntentStore.warm;
      if ((disk !== undefined && !this.same(disk, intent)) || (warm !== undefined && !this.same(warm, intent))) throw new Error('不能覆盖另一订阅原操作');
      const binding = receipt['binding'] as JsonObject;
      if (binding?.['operationId'] !== intent.operationId || binding['sequence'] !== intent.sequence ||
        receipt['method'] !== intent.mutation.method || !['applied','rejected'].includes(receipt['outcome'] as string)) throw new Error('订阅推进缺少原精确回执');
      const cursor = journey.cursor + 1, step = journey.steps[cursor], sequence = head + 1;
      const cache=RulesMutationIntentStore.planCache;
      if(journey.plan!==undefined && (cache?.value.id!==journey.plan.id || cache.fingerprint!==journey.plan.fingerprint ||
        JSON.stringify(step.params)!==cache.params[cursor])) throw new Error('订阅下一固定步骤遭到修改，已保留原流水');
      const settled=this.settled(journey);
      const next: RulesMutationIntent = { version: 1, label: intent.label,
        operationId: `${util.generateRandomUUID()}/${sequence}`, sequence,
        mutation: { method: step.method, params: JSON.parse(JSON.stringify(step.params)) as JsonObject },
        subscription: { ...journey, cursor, settled: {
          applied:settled.applied+(receipt['outcome']==='applied' ? 1 : 0),
          rejected:settled.rejected+(receipt['outcome']==='rejected' ? 1 : 0) }, facts: [...(journey.plan===undefined ? journey.facts : []), {
          operationId: intent.operationId, sequence: intent.sequence, method: intent.mutation.method,
          outcome: receipt['outcome'] as 'applied' | 'rejected', data: receipt['data'] as JsonObject, receipt }] } };
      RulesMutationIntentStore.warm = next; this.acceptedIntent = next;
      await this.write(next); return next;
    });
  }
  async ensureDurable(intent: RulesMutationIntent, admitted: () => boolean): Promise<void> {
    await this.serial(async (): Promise<void> => {
      this.assertCurrent(); if (!admitted()) throw new Error('规则服务已退役');
      const disk = await this.read(); this.assertCurrent(); if (!admitted()) throw new Error('规则服务已退役');
      if ((disk !== undefined && !this.same(disk, intent) && !this.previousOf(disk, intent)) ||
        (RulesMutationIntentStore.warm !== undefined && !this.same(RulesMutationIntentStore.warm, intent))) throw new Error('旧规则记录不能覆盖新原操作');
      RulesMutationIntentStore.warm = intent; await this.write(intent);
    });
  }
  /** Caller supplies actual exact Core terminal receipt or original branded
   * undispatched proof. This clears only this tuple after real AtomicFile ACK. */
  async clear(intent: RulesMutationIntent, terminal?: JsonObject): Promise<void> {
    await this.serial(async (): Promise<void> => {
      this.assertCurrent(); const disk = await this.read(); this.assertCurrent();
      let warm = RulesMutationIntentStore.warm;
      if ((disk !== undefined && !this.same(disk, intent)) || (warm !== undefined && !this.same(warm, intent))) throw new Error('旧规则服务不能清除新原操作');
      if (terminal !== undefined) {
        warm = { ...intent, terminal, recordFingerprint: undefined }; RulesMutationIntentStore.warm = warm;
      }
      try { await this.replace(''); }
      catch (error) {
        // Preserve an already qualified terminal receipt across warm handoff
        // and, when IO permits, cold restart. Unknown cleanup cannot revoke it.
        if (warm?.terminal !== undefined) { try { await this.write(warm); } catch (_) {} }
        throw error;
      }
      this.assertCurrent();
      if (RulesMutationIntentStore.warm !== warm) throw new Error('规则清理回执已退役');
      RulesMutationIntentStore.warm = undefined;
    });
  }
  private async serial<T>(operation: () => Promise<T>): Promise<T> {
    const prior = RulesMutationIntentStore.tail; let release: (() => void) | undefined;
    RulesMutationIntentStore.tail = new Promise<void>((resolve): void => { release = resolve; });
    await prior; try { return await operation(); } finally { release?.(); }
  }
  private async read(): Promise<RulesMutationIntent | undefined> {
    let raw: string;
    try { raw = await fileIo.readText(this.path()); }
    catch (error) { if ((error as BusinessError).code === 13900002) return undefined; throw new Error('规则原记录暂时不可读，已停止新写入'); }
    if (raw === '') return undefined;
    const intent = JSON.parse(raw) as RulesMutationIntent;
    if (intent?.version !== 1 || !Number.isSafeInteger(intent.sequence) || intent.sequence <= 0 ||
      typeof intent.operationId !== 'string' || intent.operationId.length > 128 ||
      intent.operationId.split('/').pop() !== `${intent.sequence}` || typeof intent.label !== 'string' ||
      !RULES_MUTATION_METHODS.includes(intent.mutation?.method) || intent.mutation.params === null ||
      typeof intent.mutation.params !== 'object' || Array.isArray(intent.mutation.params)) throw new Error('规则原记录身份或内容无效，已保留');
    // Current snapshots carry the immutable plan reference, not all 5000 DTOs.
    await this.validateIntegrity(intent,false);
    await this.hydratePlan(intent);
    await this.validateSubscription(intent);
    return intent;
  }
  private async write(intent: RulesMutationIntent): Promise<void> {
    this.assertCurrent();
    if (intent.subscription !== undefined) {
      await this.validateSubscription(intent);
      if (intent.subscription.plan===undefined) {
        // Preserve the complete original in the existing file before creating
        // its immutable plan. A lost plan ACK must leave a cold-recoverable ID.
        intent.recordFingerprint=await sha256Hex(this.serialized(intent,false));
        this.assertCurrent();await this.replace(this.serialized(intent,true));
      }
      await this.ensurePlan(intent);
      const j=intent.subscription;
      if (j.plan!==undefined && j.settled===undefined) {
        j.settled=this.settled(j); j.facts=j.facts.slice(-1);
      }
      intent.recordFingerprint = await sha256Hex(this.serialized(intent,false));
    }
    this.assertCurrent(); await this.replace(this.serialized(intent,true));
  }
  private serialized(intent: RulesMutationIntent, fingerprint: boolean): string {
    const j=intent.subscription;
    const payload={...intent,recordFingerprint:fingerprint ? intent.recordFingerprint : undefined,
      subscription:j===undefined || j.plan===undefined ? j :
        {kind:j.kind,plan:j.plan,cursor:j.cursor,settled:j.settled,facts:j.facts}};
    return JSON.stringify(payload);
  }
  private async validateIntegrity(intent: RulesMutationIntent, warm: boolean): Promise<void> {
    if (intent.subscription === undefined) return;
    // An accepted warm tuple can predate a failed digest/Atomic ACK. No Core
    // dispatch occurs until actual same-ID plan+current snapshot ACKs succeed.
    if ((warm || intent.subscription.plan===undefined) && intent.recordFingerprint === undefined) return;
    if (typeof intent.recordFingerprint !== 'string' || intent.recordFingerprint !== await sha256Hex(this.serialized(intent,false)))
      throw new Error('订阅完整原记录校验失败，已保留且停止新写入');
  }
  private async ensurePlan(intent: RulesMutationIntent): Promise<void> {
    const j=intent.subscription; if (j===undefined) return;
    let cache=RulesMutationIntentStore.planCache;
    if (j.plan===undefined) {
      this.validatePlan(j.kind,j.steps,j.localFailures);
      const plan: RuleSubscriptionPlan={version:1,id:intent.operationId,kind:j.kind,steps:j.steps,localFailures:j.localFailures};
      const raw=JSON.stringify(plan),fingerprint=await sha256Hex(raw); this.assertCurrent();
      j.plan={id:plan.id,fingerprint};j.settled=this.settled(j);j.facts=j.facts.slice(-1);
      intent.recordFingerprint=undefined;this.freezePlan(plan);
      cache={runtime:this.runtime,fingerprint,value:plan,raw,params:plan.steps.map(step=>JSON.stringify(step.params)),durable:false};RulesMutationIntentStore.planCache=cache;
    } else if (cache?.value.id===j.plan.id && cache.fingerprint===j.plan.fingerprint && cache.runtime!==this.runtime) {
      // A warm accepted plan whose ACK was lost retains its exact immutable raw
      // across Runtime handoff. Successor re-persists it, never borrows old IO.
      cache={...cache,runtime:this.runtime,durable:false};RulesMutationIntentStore.planCache=cache;
    } else if (cache?.value.id!==j.plan.id || cache.fingerprint!==j.plan.fingerprint) {
      await this.hydratePlan(intent);cache=RulesMutationIntentStore.planCache;
    }
    if (cache===undefined) throw new Error('订阅固定计划尚未核定');
    // A matching read is qualification, never a durable ACK. Cold retry and a
    // lost plan ACK rewrite this same immutable setter before the next dispatch.
    if (!cache.durable) {
      await replaceReaderAtomicSnapshot(this.planPath(),this.directory(),cache.raw);this.assertCurrent();cache.durable=true;
    }
  }
  private async hydratePlan(intent: RulesMutationIntent): Promise<void> {
    const j=intent.subscription; if (j?.plan===undefined) return;
    if (typeof j.plan.id!=='string' || !/^[0-9a-f]{64}$/.test(j.plan.fingerprint)) throw new Error('订阅固定计划身份无效');
    let cache=RulesMutationIntentStore.planCache;
    if (cache?.runtime!==this.runtime || cache.value.id!==j.plan.id || cache.fingerprint!==j.plan.fingerprint) {
      let raw: string;try { raw=await fileIo.readText(this.planPath()); } catch (_) { throw new Error('订阅完整计划暂时不可读，已保留原流水'); }
      const value=JSON.parse(raw) as RuleSubscriptionPlan;
      if (value.version!==1 || value.id!==j.plan.id || value.kind!==j.kind || await sha256Hex(raw)!==j.plan.fingerprint)
        throw new Error('订阅固定完整计划损坏，已保留且停止新写入');
      this.validatePlan(value.kind,value.steps,value.localFailures);this.freezePlan(value);
      cache={runtime:this.runtime,fingerprint:j.plan.fingerprint,value,raw,params:value.steps.map(step=>JSON.stringify(step.params)),durable:false};RulesMutationIntentStore.planCache=cache;
    }
    if(cache===undefined)throw new Error('订阅固定计划尚未核定');
    j.steps=cache.value.steps;j.localFailures=cache.value.localFailures;
  }
  private freezePlan(plan: RuleSubscriptionPlan): void {
    for (const step of plan.steps) { Object.freeze(step.params);Object.freeze(step); }
    for (const failure of plan.localFailures) Object.freeze(failure);
    Object.freeze(plan.steps);Object.freeze(plan.localFailures);Object.freeze(plan);
  }
  private validatePlan(kind: number, steps: RuleSubscriptionStep[], failures: {index:number;message:string}[]): void {
    if (![0,1,2].includes(kind) || !Array.isArray(steps) || steps.length<2 || !Array.isArray(failures) ||
      steps.some((step,index): boolean => step===null || typeof step!=='object' || step.params===null || typeof step.params!=='object' || Array.isArray(step.params) ||
        step.method!==(index===steps.length-1 ? 'rule-sub.put' : kind===0 ? 'source.import' : kind===1 ? 'rss-source.import' : 'rule-bundle.import')) ||
      failures.some((failure): boolean => !Number.isSafeInteger(failure.index) || failure.index<0 || typeof failure.message!=='string'))
      throw new Error('订阅固定计划结构无效，已保留');
  }
  private settled(j: RuleSubscriptionJourney): {applied:number;rejected:number} {
    return j.settled ?? {applied:j.facts.filter(f=>f.outcome==='applied').length,rejected:j.facts.filter(f=>f.outcome==='rejected').length};
  }
  private directory(): string {
    const context=this.runtime.getUIAbilityContext?.();if(context===undefined)throw new Error('规则持久记录能力不可用');return context.filesDir;
  }
  private planPath(): string { return `${this.directory()}/reader-rule-subscription-plan-v1.json`; }
  private async replace(raw: string): Promise<void> {
    const context = this.runtime.getUIAbilityContext?.(); if (context === undefined) throw new Error('规则持久记录能力不可用');
    await replaceReaderAtomicSnapshot(this.path(), context.filesDir, raw);
  }
  private path(): string {
    const context = this.runtime.getUIAbilityContext?.(); if (context === undefined) throw new Error('规则持久记录能力不可用');
    return `${context.filesDir}/reader-rules-mutation-intent-v1.json`;
  }
  private same(a: RulesMutationIntent, b: RulesMutationIntent): boolean {
    if (a.operationId!==b.operationId || a.sequence!==b.sequence || a.label!==b.label || JSON.stringify(a.mutation)!==JSON.stringify(b.mutation)) return false;
    const x=a.subscription,y=b.subscription;
    if(x!==undefined && y!==undefined && (x.plan===undefined)!==(y.plan===undefined)) {
      const legacy=x.plan===undefined?x:y,modern=x.plan===undefined?y:x,cache=RulesMutationIntentStore.planCache,ref=modern.plan;
      if(ref===undefined || cache===undefined || cache.value.id!==ref.id || cache.fingerprint!==ref.fingerprint || legacy.cursor!==modern.cursor ||
        cache.raw!==JSON.stringify({version:1,id:ref.id,kind:legacy.kind,steps:legacy.steps,localFailures:legacy.localFailures}))return false;
      const p=this.settled(legacy),q=this.settled(modern);
      return p.applied===q.applied && p.rejected===q.rejected && JSON.stringify(legacy.facts.slice(-1))===JSON.stringify(modern.facts);
    }
    return this.serialized({...a,terminal:undefined,recordFingerprint:undefined},false)===this.serialized({...b,terminal:undefined,recordFingerprint:undefined},false);
  }
  private previousOf(previous: RulesMutationIntent, next: RulesMutationIntent): boolean {
    const a=previous.subscription,b=next.subscription;if(a===undefined || b===undefined || a.kind!==b.kind || b.cursor!==a.cursor+1) return false;
    const samePlan=a.plan!==undefined && b.plan!==undefined ? a.plan.id===b.plan.id && a.plan.fingerprint===b.plan.fingerprint :
      JSON.stringify(a.steps)===JSON.stringify(b.steps) && JSON.stringify(a.localFailures)===JSON.stringify(b.localFailures);
    const fact=b.facts[b.facts.length-1],binding=fact?.receipt?.['binding'] as JsonObject | undefined;
    const before=this.settled(a),after=this.settled(b);
    return samePlan && fact?.operationId===previous.operationId && fact.sequence===previous.sequence && fact.method===previous.mutation.method &&
      binding?.['operationId']===previous.operationId && binding['sequence']===previous.sequence &&
      after.applied===before.applied+(fact.outcome==='applied'?1:0) && after.rejected===before.rejected+(fact.outcome==='rejected'?1:0);
  }
  private async validateSubscription(intent: RulesMutationIntent): Promise<void> {
    const j=intent.subscription;if(j===undefined)return;
    if(j.plan===undefined)this.validatePlan(j.kind,j.steps,j.localFailures);
    const settled=this.settled(j),cache=RulesMutationIntentStore.planCache;
    const fixedParams=j.plan!==undefined && cache?.value.id===j.plan.id && cache.fingerprint===j.plan.fingerprint ? cache.params[j.cursor] : JSON.stringify(j.steps[j.cursor]?.params);
    if(!Number.isSafeInteger(j.cursor) || j.cursor<0 || j.cursor>=j.steps.length || !Array.isArray(j.facts) ||
      !Number.isSafeInteger(settled.applied) || !Number.isSafeInteger(settled.rejected) || settled.applied<0 || settled.rejected<0 ||
      settled.applied+settled.rejected!==j.cursor || (j.plan!==undefined ? j.facts.length!==(j.cursor===0?0:1) : j.facts.length!==j.cursor) ||
      fixedParams!==JSON.stringify(intent.mutation.params) || j.steps[j.cursor]?.method!==intent.mutation.method)
      throw new Error('订阅原游标或有限累计事实无效，已保留');
    const start=intent.sequence-j.cursor;if(!Number.isSafeInteger(start)||start<=0)throw new Error('订阅原流水起点无效');
    for(let i=0;i<j.facts.length;i++) {
      const index=j.plan===undefined ? i : j.cursor-1,fact=j.facts[i],step=j.steps[index],receipt=fact?.receipt;
      const binding=receipt?.['binding'] as JsonObject | undefined;
      if(typeof fact?.operationId!=='string' || fact.sequence!==start+index || fact.operationId.split('/').pop()!==`${fact.sequence}` ||
        fact.method!==step.method || !['applied','rejected'].includes(fact.outcome) ||
        (fact.outcome==='applied' ? settled.applied===0 : settled.rejected===0) || receipt===null || typeof receipt!=='object' ||
        binding?.['operationId']!==fact.operationId || binding['sequence']!==fact.sequence ||
        typeof binding['payloadFingerprint']!=='string' || !/^[0-9a-f]{64}$/.test(binding['payloadFingerprint'] as string) ||
        receipt['method']!==fact.method || receipt['outcome']!==fact.outcome || JSON.stringify(receipt['data'])!==JSON.stringify(fact.data) ||
        receipt['ackFingerprint']!==await sha256Hex(JSON.stringify([fact.method,fact.outcome,fact.data])))
        throw new Error('订阅最新原回执与固定步骤不匹配，已保留');
    }
  }
  private assertCurrent(): void { if (!ReaderRuntimeOwner.isCurrent(this.runtime as ReaderRuntimeOwner)) throw new Error('规则服务已退役，请由当前服务核对原记录'); }
}
