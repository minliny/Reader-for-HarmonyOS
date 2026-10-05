import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { RulesMutationSnapshot } from './RulesMutationOwner';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import { RssGateway } from '../rss/RssGateway';
import { SourceGateway } from '../source/SourceGateway';
import {
  RulesManagementGateway,
  type DictRuleDraft,
  type ManagedDictRule,
  type ManagedReplaceRule,
  type ManagedRuleSubscription,
  type ManagedTxtTocRule,
  type ReplaceRuleDraft,
  type RuleSubscriptionDraft,
  type TxtTocRuleDraft,
} from './RulesManagementGateway';

const DOMAIN = 0x5244;
let rulesProjectionGeneration: number = 0;

export interface RulesReadValue {
  replaceRules: ManagedReplaceRule[];
  txtTocRules: ManagedTxtTocRule[];
  dictRules: ManagedDictRule[];
  subscriptions: ManagedRuleSubscription[];
}

export interface RulesManagementSnapshot {
  replaceRules: ManagedReplaceRule[];
  txtTocRules: ManagedTxtTocRule[];
  dictRules: ManagedDictRule[];
  subscriptions: ManagedRuleSubscription[];
  busy: boolean;
  statusMessage: string;
  receipt?: PersistedReceiptProjection<RulesReadValue>;
  readFacts?: OperationFacts<RulesReadValue>;
  confirmedParts?: number;
  ruleMutation?: RulesMutationSnapshot;
}

interface RulesManagementPatch {
  replaceRules?: ManagedReplaceRule[];
  txtTocRules?: ManagedTxtTocRule[];
  dictRules?: ManagedDictRule[];
  subscriptions?: ManagedRuleSubscription[];
  busy?: boolean;
  statusMessage?: string;
  receipt?: PersistedReceiptProjection<RulesReadValue>;
  readFacts?: OperationFacts<RulesReadValue>;
  confirmedParts?: number;
  ruleMutation?: RulesMutationSnapshot;
}

export const EMPTY_RULES_MANAGEMENT_SNAPSHOT: RulesManagementSnapshot = {
  replaceRules: [],
  txtTocRules: [],
  dictRules: [],
  subscriptions: [],
  busy: false,
  statusMessage: '',
};

/** Serial UI coordinator; all validation, persistence and bundle semantics stay in Core. */
export class RulesManagementOrchestrator {
  private static shared: RulesManagementOrchestrator | undefined;
  private presentationIdentity: string | undefined;
  private readonly gateway: RulesManagementGateway;
  private readonly sourceGateway: SourceGateway;
  private readonly rssGateway: RssGateway;
  private readonly owner: ReaderRuntimeOwner;
  private emit: (snapshot: RulesManagementSnapshot) => void;
  private isCurrent: () => boolean;
  private snapshot: RulesManagementSnapshot = EMPTY_RULES_MANAGEMENT_SNAPSHOT;
  private operationTail: Promise<void> = Promise.resolve();
  private session: number = 0;
  private hasRead: boolean = false;
  private latestReceipt: PersistedReceiptProjection<RulesReadValue> | undefined;
  private receiptLabel: string = '';

  constructor(
    emit: (snapshot: RulesManagementSnapshot) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.owner = owner;
    this.gateway = new RulesManagementGateway(owner);
    this.sourceGateway = new SourceGateway(owner);
    this.rssGateway = new RssGateway(owner);
    this.emit = emit;
    this.isCurrent = isCurrent;
  }

  static forRuntime(owner: ReaderRuntimeOwner): RulesManagementOrchestrator | undefined {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    const shared=RulesManagementOrchestrator.shared;
    if (shared?.owns(owner)) return shared;
    const next=new RulesManagementOrchestrator((_snapshot: RulesManagementSnapshot): void => {}, (): boolean => false, owner);
    RulesManagementOrchestrator.shared=next; return next;
  }
  attachPresentation(identity: string, emit: (snapshot: RulesManagementSnapshot) => void, current: () => boolean): boolean {
    if (identity.length===0 || !ReaderRuntimeOwner.isCurrent(this.owner)) return false;
    try { if (!current()) return false; } catch (_) { return false; }
    this.session+=1; this.presentationIdentity=identity; this.emit=emit; this.isCurrent=current;
    this.publish({}); return true;
  }
  detachPresentation(identity: string): void {
    if (identity!==this.presentationIdentity) return;
    this.session+=1; this.presentationIdentity=undefined;
    this.emit=(_snapshot: RulesManagementSnapshot): void => {}; this.isCurrent=(): boolean => false;
  }
  currentSnapshot(): RulesManagementSnapshot { return this.copy(this.snapshot); }
  /** Physical page callbacks carry the immutable original attachment. */
  isPresentationCurrent(identity: string): boolean {
    return identity.length > 0 && identity === this.presentationIdentity && this.isCurrentSession(this.session);
  }
  private admitPresentation(identity?: string): boolean {
    if (identity!==this.presentationIdentity) return false;
    return this.isCurrentSession(this.session);
  }

  open(presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    this.session += 1;
    const session = this.session;
    this.publish({ busy: true, statusMessage: '正在读取 Core 规则实体…',
      readFacts: projectOperationFacts({ phase: 'loading', value: this.readValue(), generation: ++rulesProjectionGeneration }) });
    const original = this.gateway.mutationSnapshot();
    if (original.confirmation === 'unknown') {
      this.receiptLabel = original.label;
      this.publishReceipt(session, 'unknown', 'reading', original.message);
    }
    this.enqueue(async (): Promise<void> => {
      await this.recoverOriginal(session, false);
      await this.reload(session, 'Core 规则实体已就绪');
    });
  }

  owns(owner: ReaderRuntimeOwner): boolean { return this.owner === owner; }

  reconcile(generation: number, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      if (!this.isCurrentSession(session)) return;
      const receipt = this.latestReceipt;
      const read = this.snapshot.readFacts;
      if (receipt?.facts.generation === generation && receipt.facts.canRetry) {
        if (this.snapshot.ruleMutation?.blocked === true || receipt.receipt.confirmation === 'unknown') {
          await this.recoverOriginal(session, this.snapshot.ruleMutation?.canRetryOriginal === true);
        } else this.publishReceipt(session, receipt.receipt.confirmation, 'reading');
        await this.reload(session, `${this.receiptLabel}核对已结束`);
      } else if (read?.generation === generation && read.canRetry) {
        this.publishIfCurrent(session, { busy: true, readFacts: projectOperationFacts({
          phase: 'loading', value: this.readValue(), generation: ++rulesProjectionGeneration }) });
        await this.reload(session, 'Core 规则实体已就绪');
      }
    });
  }

  saveReplaceRule(draft: ReplaceRuleDraft, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    this.mutate('保存替换规则', async (): Promise<void> => this.gateway.saveReplaceRule(draft));
  }

  deleteReplaceRule(id: number, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    this.mutate('删除替换规则', async (): Promise<void> => this.gateway.deleteReplaceRule(id));
  }

  saveTxtTocRule(draft: TxtTocRuleDraft, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    this.mutate('保存 TXT 目录规则', async (): Promise<void> => this.gateway.saveTxtTocRule(draft));
  }

  deleteTxtTocRule(id: number, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    this.mutate('删除 TXT 目录规则', async (): Promise<void> => this.gateway.deleteTxtTocRule(id));
  }

  saveDictRule(draft: DictRuleDraft, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    this.mutate('保存字典规则', async (): Promise<void> => this.gateway.saveDictRule(draft));
  }

  deleteDictRule(name: string, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    this.mutate('删除字典规则', async (): Promise<void> => this.gateway.deleteDictRule(name));
  }

  saveRuleSubscription(draft: RuleSubscriptionDraft, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    this.mutate('保存规则订阅', async (): Promise<void> => this.gateway.saveRuleSubscription(draft));
  }

  deleteRuleSubscription(id: number, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    this.mutate('删除规则订阅', async (): Promise<void> => this.gateway.deleteRuleSubscription(id));
  }

  /** Download one stored RuleSub and route its Legado payload by persisted type. */
  refreshRuleSubscription(subscription: ManagedRuleSubscription, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      if (!this.isCurrentSession(session)) return;
      const typeLabel = this.subscriptionTypeLabel(subscription.type);
      this.publishIfCurrent(session, {
        busy: true,
        statusMessage: `正在拉取${typeLabel}订阅：${subscription.name}…`,
      });
      await this.performWrite(session, `${typeLabel}订阅更新`, async (_evidence: ReaderWriteEvidence): Promise<string> => {
        const document = await this.owner.loadOnlineJsonDocument(subscription.url);
        if (!this.isCurrentSession(session)) throw new Error('订阅更新已关闭，未接受');
        const sourcePlan = subscription.type === 0 ? this.sourceGateway.prepareSubscriptionDocument(document.text) : undefined;
        return await this.gateway.refreshSubscription(subscription,document.text,sourcePlan,
          (): boolean => this.isCurrentSession(session));
      });
    });
  }

  exportBundle(presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      if (!this.isCurrentSession(session)) return;
      this.publishIfCurrent(session, { busy: true, statusMessage: '正在由 Core 生成规则包…' });
      try {
        const bundle = await this.gateway.exportBundle();
        const saved = await this.owner.saveRuleBundleJson(bundle.json, `reader-rules-${Date.now()}.json`);
        if (this.isCurrentSession(session)) {
          this.publish({
            busy: false,
            statusMessage: saved === undefined ? '已取消导出' : `已导出 ${bundle.summary}：${saved}`,
          });
        }
      } catch (error) {
        this.fail(session, '规则包导出失败', error as Error);
      }
    });
  }

  importBundle(onlineUrl?: string, presentationIdentity?: string): void {
    if (!this.admitPresentation(presentationIdentity)) return;
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      if (!this.isCurrentSession(session)) return;
      this.publishIfCurrent(session, {
        busy: true,
        statusMessage: onlineUrl === undefined ? '请选择本地 Core 规则包…' : '正在下载在线 Core 规则包…',
      });
      try {
        const selected = onlineUrl === undefined ?
          await this.owner.selectRuleBundleJson() :
          await this.owner.loadOnlineJsonDocument(onlineUrl);
        if (selected === undefined) {
          this.publishIfCurrent(session, { busy: false, statusMessage: '已取消导入' });
          return;
        }
        if (!this.isCurrentSession(session)) return;
        await this.performWrite(session, '规则包导入', async (): Promise<string> =>
          `${await this.gateway.importBundle(selected.text, false)}（同主键以导入值为准）`);
      } catch (error) {
        this.fail(session, '规则包导入失败', error as Error);
      }
    });
  }

  private mutate(label: string, operation: () => Promise<void>): void {
    const session = this.session;
    if (!this.isCurrentSession(session)) return;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: `正在${label}…` });
      await this.performWrite(session, label, async (): Promise<string> => {
        await operation(); return `${label}已由 Core 确认`;
      });
    });
  }

  private async performWrite(session: number, label: string, operation: (evidence: ReaderWriteEvidence) => Promise<string>): Promise<void> {
    if (!this.isCurrentSession(session)) return;
    const prior = this.gateway.mutationSnapshot();
    if (prior.confirmation === 'unknown') {
      this.receiptLabel = prior.label;
      this.publishReceipt(session, 'unknown', 'failed', prior.message);
      return;
    }
    const evidence = new ReaderWriteEvidence();
    this.gateway.observeWrites(evidence, (): boolean => this.isCurrentSession(session));
    this.sourceGateway.observeWrites(evidence);
    this.rssGateway.observeWrites(evidence);
    this.receiptLabel = label;
    let status: string;
    try {
      status = await operation(evidence);
    } catch (error) {
      const original = this.gateway.mutationSnapshot();
      const confirmation = original.confirmation === 'unknown' ? 'unknown' : evidence.confirmation();
      if (original.confirmation === 'unknown' && evidence.dispatchedCount === 0) this.receiptLabel = original.label;
      this.publishReceipt(session, confirmation, 'failed', (error as Error).message,
        evidence.confirmedCount);
      return;
    } finally {
      this.gateway.observeWrites(undefined);
      this.sourceGateway.observeWrites(undefined);
      this.rssGateway.observeWrites(undefined);
    }
    this.publishReceipt(session, evidence.confirmation(), 'reading', undefined, evidence.confirmedCount);
    await this.reload(session, status);
  }

  private async recoverOriginal(session: number, retryOriginal: boolean): Promise<void> {
    if (!this.isCurrentSession(session)) return;
    try {
      const original = await this.gateway.recoverMutation((): boolean => this.isCurrentSession(session), retryOriginal);
      if (!this.isCurrentSession(session)) return;
      this.publish({ ruleMutation: original });
      if (original.operationId !== undefined) {
        this.receiptLabel = original.label;
        this.publishReceipt(session, original.confirmation, 'failed', original.message.length > 0 ? original.message : undefined,original.subscription?.confirmedParts);
      }
    } catch (error) {
      const original = this.gateway.mutationSnapshot(); this.receiptLabel = original.label;
      this.publishReceipt(session, original.confirmation, 'failed', (error as Error).message);
    }
  }

  private async reload(session: number, statusMessage: string): Promise<void> {
    const patch: RulesManagementPatch = {};
    const errors: string[] = [];
    let readCount = 0;
    if (!this.isCurrentSession(session)) return;
    try { patch.replaceRules = await this.gateway.listReplaceRules(); readCount += 1; } catch (error) { errors.push((error as Error).message); }
    if (!this.isCurrentSession(session)) return;
    try { patch.txtTocRules = await this.gateway.listTxtTocRules(); readCount += 1; } catch (error) { errors.push((error as Error).message); }
    if (!this.isCurrentSession(session)) return;
    try { patch.dictRules = await this.gateway.listDictRules(); readCount += 1; } catch (error) { errors.push((error as Error).message); }
    if (!this.isCurrentSession(session)) return;
    try { patch.subscriptions = await this.gateway.listRuleSubscriptions(); readCount += 1; } catch (error) { errors.push((error as Error).message); }
    if (this.isCurrentSession(session)) {
      if (readCount > 0) this.hasRead = true;
      this.publish(patch);
      const receipt = this.latestReceipt;
      if (receipt !== undefined) this.publishReceipt(session, receipt.receipt.confirmation,
        errors.length === 0 && this.gateway.mutationSnapshot().blocked !== true ? 'succeeded' : 'failed', this.gateway.mutationSnapshot().blocked ? this.gateway.mutationSnapshot().message : errors.length === 0 ? undefined : errors.join('；'));
      this.publish({ busy: false, statusMessage: errors.length === 0 &&
        (receipt === undefined || receipt.receipt.confirmation === 'confirmed') ? statusMessage :
        receipt === undefined ? `规则实体刷新失败：${errors.join('；')}` : this.snapshot.statusMessage,
        readFacts: projectOperationFacts({ phase: errors.length === 0 ? 'succeeded' : readCount > 0 ? 'partial' : 'failed',
          value: this.readValue(), canRetry: errors.length > 0, generation: ++rulesProjectionGeneration,
          message: errors.join('；') }) });
    }
  }

  private readValue(): RulesReadValue | undefined {
    return !this.hasRead ? undefined : { replaceRules: this.snapshot.replaceRules, txtTocRules: this.snapshot.txtTocRules,
      dictRules: this.snapshot.dictRules, subscriptions: this.snapshot.subscriptions };
  }

  private publishReceipt(session: number, confirmation: 'confirmed' | 'unknown' | 'undispatched',
    readback: 'reading' | 'failed' | 'succeeded', error?: string, confirmedParts?: number): void {
    confirmedParts = this.gateway.mutationSnapshot().subscription?.confirmedParts ?? confirmedParts;
    this.latestReceipt = projectPersistedReceipt({ confirmation, readback, value: this.readValue(), refreshError: error,
      canRetry: readback !== 'reading' && (confirmation !== 'undispatched' || this.gateway.mutationSnapshot().blocked) && (readback === 'failed' || confirmation === 'unknown'),
      generation: ++rulesProjectionGeneration });
    this.publishIfCurrent(session, { receipt: this.latestReceipt, confirmedParts, ruleMutation: this.gateway.mutationSnapshot(), busy: readback === 'reading',
      statusMessage: `${this.receiptLabel}：${this.latestReceipt.receipt.message}` +
        `${confirmation === 'unknown' && (confirmedParts ?? this.snapshot.confirmedParts ?? 0) > 0 ? `（已有 ${confirmedParts ?? this.snapshot.confirmedParts} 步确认）` : ''}` +
        `${error === undefined ? '' : `；${error}`}` });
  }

  private enqueue(operation: () => Promise<void>): void {
    this.operationTail = this.operationTail.then(async (): Promise<void> => {
      if (!ReaderRuntimeOwner.isCurrent(this.owner)) return;
      await operation();
    }).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Rules management operation failed: %{private}s', error.message);
    });
  }

  private fail(session: number, label: string, error: Error): void {
    if (this.isCurrentSession(session)) {
      this.publish({ busy: false, statusMessage: `${label}：${error.message}` });
    }
    hilog.error(DOMAIN, 'Reader', '%{private}s: %{private}s', label, error.message);
  }

  private publishIfCurrent(session: number, patch: RulesManagementPatch): void {
    if (this.isCurrentSession(session)) this.publish(patch);
  }

  private publish(patch: RulesManagementPatch): void {
    this.snapshot = {
      replaceRules: patch.replaceRules ?? this.snapshot.replaceRules,
      txtTocRules: patch.txtTocRules ?? this.snapshot.txtTocRules,
      dictRules: patch.dictRules ?? this.snapshot.dictRules,
      subscriptions: patch.subscriptions ?? this.snapshot.subscriptions,
      busy: patch.busy ?? this.snapshot.busy,
      statusMessage: patch.statusMessage ?? this.snapshot.statusMessage,
      receipt: patch.receipt ?? this.snapshot.receipt,
      readFacts: patch.readFacts ?? this.snapshot.readFacts,
      confirmedParts: patch.confirmedParts ?? this.snapshot.confirmedParts,
      ruleMutation: patch.ruleMutation ?? this.snapshot.ruleMutation,
    };
    if (this.isCurrentSession(this.session)) this.emit(this.copy(this.snapshot));
  }

  private copy(source: RulesManagementSnapshot): RulesManagementSnapshot {
    return {
      replaceRules: source.replaceRules.slice(),
      txtTocRules: source.txtTocRules.slice(),
      dictRules: source.dictRules.slice(),
      subscriptions: source.subscriptions.slice(),
      busy: source.busy,
      statusMessage: source.statusMessage,
      receipt: source.receipt,
      readFacts: source.readFacts,
      confirmedParts: source.confirmedParts,
      ruleMutation: source.ruleMutation,
    };
  }

  private isCurrentSession(session: number): boolean {
    try { return ReaderRuntimeOwner.isCurrent(this.owner) && this.isCurrent() && this.session === session; } catch (_) { return false; }
  }

  private subscriptionTypeLabel(type: number): string {
    if (type === 0) return '书源';
    if (type === 1) return 'RSS 源';
    return '替换规则';
  }
}
