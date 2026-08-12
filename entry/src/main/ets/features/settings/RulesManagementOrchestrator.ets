import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
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

export interface RulesManagementSnapshot {
  replaceRules: ManagedReplaceRule[];
  txtTocRules: ManagedTxtTocRule[];
  dictRules: ManagedDictRule[];
  subscriptions: ManagedRuleSubscription[];
  busy: boolean;
  statusMessage: string;
}

interface RulesManagementPatch {
  replaceRules?: ManagedReplaceRule[];
  txtTocRules?: ManagedTxtTocRule[];
  dictRules?: ManagedDictRule[];
  subscriptions?: ManagedRuleSubscription[];
  busy?: boolean;
  statusMessage?: string;
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
    this.snapshot = this.copy(EMPTY_RULES_MANAGEMENT_SNAPSHOT);
    this.publish({ busy: true, statusMessage: '正在读取 Core 规则实体…' });
    this.enqueue(async (): Promise<void> => this.reload(session, 'Core 规则实体已就绪'));
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
      let importedStatus: string = '';
      try {
        const document = await this.owner.loadOnlineJsonDocument(subscription.url);
        if (!this.isCurrentSession(session)) {
          return;
        }
        if (subscription.type === 0) {
          const summary = await this.sourceGateway.importBookSourceDocument(
            document.text,
            (): boolean => this.isCurrentSession(session),
          );
          importedStatus = `已导入 ${summary.importedCount} 个书源`;
        } else if (subscription.type === 1) {
          const result = await this.rssGateway.importSourcesDocument(document.text, false);
          importedStatus = `已合并 ${result.imported} 个 RSS 源`;
        } else {
          importedStatus = await this.gateway.importReplaceRuleDocument(document.text);
        }
      } catch (error) {
        this.fail(session, `${typeLabel}订阅拉取失败`, error as Error);
        return;
      }
      if (!this.isCurrentSession(session)) {
        return;
      }
      try {
        await this.gateway.saveRuleSubscription({
          id: subscription.id,
          name: subscription.name,
          url: subscription.url,
          type: subscription.type,
          autoUpdate: subscription.autoUpdate,
          customOrder: subscription.customOrder,
          update: Date.now(),
        });
      } catch (error) {
        this.fail(session, `${importedStatus}，但订阅更新时间保存失败`, error as Error);
        return;
      }
      try {
        await this.reload(session, `${importedStatus}；订阅更新时间已保存`);
      } catch (error) {
        this.fail(session, `${importedStatus}，但规则实体刷新失败`, error as Error);
      }
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
        const status = await this.gateway.importBundle(selected.text, false);
        await this.reload(session, `${status}（同主键以导入值为准）`);
      } catch (error) {
        this.fail(session, '规则包导入失败', error as Error);
      }
    });
  }

  private mutate(label: string, operation: () => Promise<void>): void {
    const session = this.session;
    this.enqueue(async (): Promise<void> => {
      this.publishIfCurrent(session, { busy: true, statusMessage: `正在${label}…` });
      try {
        await operation();
        await this.reload(session, `${label}已由 Core 确认`);
      } catch (error) {
        this.fail(session, `${label}失败`, error as Error);
      }
    });
  }

  private async reload(session: number, statusMessage: string): Promise<void> {
    const replaceRules = await this.gateway.listReplaceRules();
    const txtTocRules = await this.gateway.listTxtTocRules();
    const dictRules = await this.gateway.listDictRules();
    const subscriptions = await this.gateway.listRuleSubscriptions();
    if (this.isCurrentSession(session)) {
      this.publish({ replaceRules, txtTocRules, dictRules, subscriptions, busy: false, statusMessage });
    }
  }

  private enqueue(operation: () => Promise<void>): void {
    this.operationTail = this.operationTail.then(operation).catch((error: Error): void => {
      hilog.error(DOMAIN, 'Reader', 'Rules management operation failed: %{public}s', error.message);
    });
  }

  private fail(session: number, label: string, error: Error): void {
    if (this.isCurrentSession(session)) {
      this.publish({ busy: false, statusMessage: `${label}：${error.message}` });
    }
    hilog.error(DOMAIN, 'Reader', '%{public}s: %{public}s', label, error.message);
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
    };
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && this.session === session;
  }

  private subscriptionTypeLabel(type: number): string {
    if (type === 0) return '书源';
    if (type === 1) return 'RSS 源';
    return '替换规则';
  }
}
