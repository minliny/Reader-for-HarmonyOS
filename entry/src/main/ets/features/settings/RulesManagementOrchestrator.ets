import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
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
  private readonly gateway: RulesManagementGateway;
  private readonly sourceGateway: SourceGateway;
  private readonly rssGateway: RssGateway;
  private readonly owner: ReaderRuntimeOwner;
  private readonly emit: (snapshot: RulesManagementSnapshot) => void;
  private readonly isCurrent: () => boolean;
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

  open(): void {
    this.session += 1;
    const session = this.session;
    this.publish({ busy: true, statusMessage: '正在读取 Core 规则实体…',
      readFacts: projectOperationFacts({ phase: 'loading', value: this.readValue(), generation: ++rulesProjectionGeneration }) });
    this.enqueue(async (): Promise<void> => this.reload(session, 'Core 规则实体已就绪'));
  }

  owns(owner: ReaderRuntimeOwner): boolean { return this.owner === owner; }

  reconcile(generation: number): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      if (!this.isCurrentSession(session)) return;
      const receipt = this.latestReceipt;
      const read = this.snapshot.readFacts;
      if (receipt?.facts.generation === generation && receipt.facts.canRetry) {
        this.publishReceipt(session, receipt.receipt.confirmation, 'reading');
        await this.reload(session, `${this.receiptLabel}已由 Core 确认`);
      } else if (read?.generation === generation && read.canRetry) {
        this.publishIfCurrent(session, { busy: true, readFacts: projectOperationFacts({
          phase: 'loading', value: this.readValue(), generation: ++rulesProjectionGeneration }) });
        await this.reload(session, 'Core 规则实体已就绪');
      }
    });
  }

  saveReplaceRule(draft: ReplaceRuleDraft): void {
    this.mutate('保存替换规则', async (): Promise<void> => this.gateway.saveReplaceRule(draft));
  }

  deleteReplaceRule(id: number): void {
    this.mutate('删除替换规则', async (): Promise<void> => this.gateway.deleteReplaceRule(id));
  }

  saveTxtTocRule(draft: TxtTocRuleDraft): void {
    this.mutate('保存 TXT 目录规则', async (): Promise<void> => this.gateway.saveTxtTocRule(draft));
  }

  deleteTxtTocRule(id: number): void {
    this.mutate('删除 TXT 目录规则', async (): Promise<void> => this.gateway.deleteTxtTocRule(id));
  }

  saveDictRule(draft: DictRuleDraft): void {
    this.mutate('保存字典规则', async (): Promise<void> => this.gateway.saveDictRule(draft));
  }

  deleteDictRule(name: string): void {
    this.mutate('删除字典规则', async (): Promise<void> => this.gateway.deleteDictRule(name));
  }

  saveRuleSubscription(draft: RuleSubscriptionDraft): void {
    this.mutate('保存规则订阅', async (): Promise<void> => this.gateway.saveRuleSubscription(draft));
  }

  deleteRuleSubscription(id: number): void {
    this.mutate('删除规则订阅', async (): Promise<void> => this.gateway.deleteRuleSubscription(id));
  }

  /** Download one stored RuleSub and route its Legado payload by persisted type. */
  refreshRuleSubscription(subscription: ManagedRuleSubscription): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      const typeLabel = this.subscriptionTypeLabel(subscription.type);
      this.publishIfCurrent(session, {
        busy: true,
        statusMessage: `正在拉取${typeLabel}订阅：${subscription.name}…`,
      });
      await this.performWrite(session, `${typeLabel}订阅更新`, async (evidence: ReaderWriteEvidence): Promise<string> => {
        let importedStatus: string = '';
        const document = await this.owner.loadOnlineJsonDocument(subscription.url);
        if (!this.isCurrentSession(session)) {
          throw new Error('订阅更新已关闭');
        }
        if (subscription.type === 0) {
          const summary = await this.sourceGateway.importBookSourceDocument(
            document.text,
            (): boolean => this.isCurrentSession(session),
          );
          importedStatus = `已导入 ${summary.importedCount} 个书源`;
          if (summary.failedCount > 0) importedStatus += `；${summary.failedCount} 个未完成`;
        } else if (subscription.type === 1) {
          const result = await this.rssGateway.importSourcesDocument(document.text, false);
          importedStatus = `已合并 ${result.imported} 个 RSS 源`;
        } else {
          importedStatus = await this.gateway.importReplaceRuleDocument(document.text);
        }
        if (evidence.confirmation() !== 'confirmed') throw new Error(`${importedStatus}；导入结果尚未确认`);
        if (!this.isCurrentSession(session)) throw new Error(`${importedStatus}；订阅更新已关闭`);
        await this.gateway.saveRuleSubscription({
          id: subscription.id,
          name: subscription.name,
          url: subscription.url,
          type: subscription.type,
          autoUpdate: subscription.autoUpdate,
          customOrder: subscription.customOrder,
          update: Date.now(),
        });
        return `${importedStatus}；订阅更新时间已保存`;
      });
    });
  }

  exportBundle(): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
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

  importBundle(onlineUrl?: string): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
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
    const evidence = new ReaderWriteEvidence();
    this.gateway.observeWrites(evidence);
    this.sourceGateway.observeWrites(evidence);
    this.rssGateway.observeWrites(evidence);
    this.receiptLabel = label;
    let status: string;
    try {
      status = await operation(evidence);
    } catch (error) {
      this.publishReceipt(session, evidence.confirmation(), 'failed', (error as Error).message,
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

  private async reload(session: number, statusMessage: string): Promise<void> {
    const patch: RulesManagementPatch = {};
    const errors: string[] = [];
    let readCount = 0;
    try { patch.replaceRules = await this.gateway.listReplaceRules(); readCount += 1; } catch (error) { errors.push((error as Error).message); }
    try { patch.txtTocRules = await this.gateway.listTxtTocRules(); readCount += 1; } catch (error) { errors.push((error as Error).message); }
    try { patch.dictRules = await this.gateway.listDictRules(); readCount += 1; } catch (error) { errors.push((error as Error).message); }
    try { patch.subscriptions = await this.gateway.listRuleSubscriptions(); readCount += 1; } catch (error) { errors.push((error as Error).message); }
    if (this.isCurrentSession(session)) {
      if (readCount > 0) this.hasRead = true;
      this.publish(patch);
      const receipt = this.latestReceipt;
      if (receipt !== undefined) this.publishReceipt(session, receipt.receipt.confirmation,
        errors.length === 0 ? 'succeeded' : 'failed', errors.length === 0 ? undefined : errors.join('；'));
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
    this.latestReceipt = projectPersistedReceipt({ confirmation, readback, value: this.readValue(), refreshError: error,
      canRetry: readback !== 'reading' && confirmation !== 'undispatched' && (readback === 'failed' || confirmation === 'unknown'),
      generation: ++rulesProjectionGeneration });
    this.publishIfCurrent(session, { receipt: this.latestReceipt, confirmedParts, busy: readback === 'reading',
      statusMessage: `${this.receiptLabel}：${this.latestReceipt.receipt.message}` +
        `${confirmation === 'unknown' && (confirmedParts ?? this.snapshot.confirmedParts ?? 0) > 0 ? `（已有 ${confirmedParts ?? this.snapshot.confirmedParts} 步确认）` : ''}` +
        `${error === undefined ? '' : `；${error}`}` });
  }

  private enqueue(operation: () => Promise<void>): void {
    this.operationTail = this.operationTail.then(async (): Promise<void> => {
      if (this.owner !== ReaderRuntimeOwner.current()) return;
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
    };
    if (this.isCurrent()) this.emit(this.copy(this.snapshot));
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
    };
  }

  private isCurrentSession(session: number): boolean {
    return this.owner === ReaderRuntimeOwner.current() && this.isCurrent() && this.session === session;
  }

  private subscriptionTypeLabel(type: number): string {
    if (type === 0) return '书源';
    if (type === 1) return 'RSS 源';
    return '替换规则';
  }
}
