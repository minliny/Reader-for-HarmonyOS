import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import {
  RssGateway,
  type RssSourceDraft,
  type RssSubscription,
} from './RssGateway';

const DOMAIN = 0x5244;

export interface RssSubscriptionEditorSnapshot {
  mode: 'create' | 'edit';
  subscriptionId: string;
  feedUrl: string;
  title: string;
  enabled: boolean;
  sourceGroup: string;
  customOrder: string;
  updateIntervalMinutes: string;
  header: string;
  enabledCookieJar: boolean;
  ruleArticles: string;
  ruleNextPage: string;
  ruleTitle: string;
  rulePubDate: string;
  ruleDescription: string;
  ruleImage: string;
  ruleLink: string;
  ruleContent: string;
  busy: boolean;
  statusMessage: string;
}

export const EMPTY_RSS_EDITOR_SNAPSHOT: RssSubscriptionEditorSnapshot = {
  mode: 'create',
  subscriptionId: '',
  feedUrl: '',
  title: '',
  enabled: true,
  sourceGroup: '',
  customOrder: '',
  updateIntervalMinutes: '',
  header: '',
  enabledCookieJar: false,
  ruleArticles: '',
  ruleNextPage: '',
  ruleTitle: '',
  rulePubDate: '',
  ruleDescription: '',
  ruleImage: '',
  ruleLink: '',
  ruleContent: '',
  busy: false,
  statusMessage: '',
};

/** Thin UI coordinator over canonical Core rss.subscription.create/update. */
export class RssSubscriptionEditorOrchestrator {
  private readonly gateway: RssGateway;
  private readonly emit: (snapshot: RssSubscriptionEditorSnapshot) => void;
  private readonly onSaved: (subscriptionId: string) => void;
  private readonly isCurrent: () => boolean;
  private snapshot: RssSubscriptionEditorSnapshot = EMPTY_RSS_EDITOR_SNAPSHOT;
  private session: number = 0;
  private saving: boolean = false;

  constructor(
    emit: (snapshot: RssSubscriptionEditorSnapshot) => void,
    onSaved: (subscriptionId: string) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.gateway = new RssGateway(owner);
    this.emit = emit;
    this.onSaved = onSaved;
    this.isCurrent = isCurrent;
  }

  openCreate(): void {
    this.session += 1;
    this.saving = false;
    this.publish({
      mode: 'create',
      subscriptionId: '',
      feedUrl: '',
      title: '',
      enabled: true,
      sourceGroup: '',
      customOrder: '',
      updateIntervalMinutes: '',
      header: '',
      enabledCookieJar: false,
      ruleArticles: '',
      ruleNextPage: '',
      ruleTitle: '',
      rulePubDate: '',
      ruleDescription: '',
      ruleImage: '',
      ruleLink: '',
      ruleContent: '',
      busy: false,
      statusMessage: '新增 RSS 订阅',
    });
  }

  openEdit(subscriptionId: string): void {
    this.session += 1;
    const session = this.session;
    this.saving = false;
    this.publish({
      mode: 'edit',
      subscriptionId,
      feedUrl: '',
      title: '',
      enabled: true,
      sourceGroup: '',
      customOrder: '',
      updateIntervalMinutes: '',
      header: '',
      enabledCookieJar: false,
      ruleArticles: '',
      ruleNextPage: '',
      ruleTitle: '',
      rulePubDate: '',
      ruleDescription: '',
      ruleImage: '',
      ruleLink: '',
      ruleContent: '',
      busy: true,
      statusMessage: '正在读取 Core 订阅…',
    });
    void this.gateway.loadSubscriptions()
      .then((subscriptions: RssSubscription[]): void => {
        const subscription = subscriptions.find(
          (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
        );
        if (subscription === undefined) {
          throw new Error('RSS 订阅已不存在');
        }
        if (this.isCurrentSession(session)) {
          this.publish({
            feedUrl: subscription.feedUrl,
            title: subscription.title,
            enabled: subscription.enabled,
            sourceGroup: subscription.sourceGroup ?? '',
            customOrder: subscription.customOrder?.toString() ?? '',
            updateIntervalMinutes: subscription.updateIntervalMinutes?.toString() ?? '',
            header: subscription.header ?? '',
            enabledCookieJar: subscription.enabledCookieJar ?? false,
            ruleArticles: subscription.ruleArticles ?? '',
            ruleNextPage: subscription.ruleNextPage ?? '',
            ruleTitle: subscription.ruleTitle ?? '',
            rulePubDate: subscription.rulePubDate ?? '',
            ruleDescription: subscription.ruleDescription ?? '',
            ruleImage: subscription.ruleImage ?? '',
            ruleLink: subscription.ruleLink ?? '',
            ruleContent: subscription.ruleContent ?? '',
            busy: false,
            statusMessage: '编辑 RSS 订阅',
          });
        }
      })
      .catch((error: Error): void => this.fail(session, 'RSS 订阅读取失败', error));
  }

  updateFeedUrl(value: string): void {
    if (value.length <= 8192) {
      this.publish({ feedUrl: value });
    }
  }

  updateTitle(value: string): void {
    if (value.length <= 512) {
      this.publish({ title: value });
    }
  }

  updateEnabled(value: boolean): void {
    this.publish({ enabled: value });
  }

  updateEnabledCookieJar(value: boolean): void {
    this.publish({ enabledCookieJar: value });
  }

  updateSourceField(field: RssSourceTextField, value: string): void {
    if (value.length > 8192) {
      return;
    }
    if (field === 'sourceGroup') this.publish({ sourceGroup: value });
    else if (field === 'customOrder') this.publish({ customOrder: value });
    else if (field === 'updateIntervalMinutes') this.publish({ updateIntervalMinutes: value });
    else if (field === 'header') this.publish({ header: value });
    else if (field === 'ruleArticles') this.publish({ ruleArticles: value });
    else if (field === 'ruleNextPage') this.publish({ ruleNextPage: value });
    else if (field === 'ruleTitle') this.publish({ ruleTitle: value });
    else if (field === 'rulePubDate') this.publish({ rulePubDate: value });
    else if (field === 'ruleDescription') this.publish({ ruleDescription: value });
    else if (field === 'ruleImage') this.publish({ ruleImage: value });
    else if (field === 'ruleLink') this.publish({ ruleLink: value });
    else if (field === 'ruleContent') this.publish({ ruleContent: value });
  }

  save(): void {
    if (this.saving) {
      return;
    }
    const session = this.session;
    const current = this.copySnapshot(this.snapshot);
    let draft: RssSourceDraft;
    try {
      draft = this.sourceDraft(current);
    } catch (error) {
      this.publish({ busy: false, statusMessage: `RSS 订阅保存失败：${(error as Error).message}` });
      return;
    }
    this.saving = true;
    this.publish({ busy: true, statusMessage: '正在由 Core 保存 RSS 订阅…' });
    const task = current.mode === 'create'
      ? this.gateway.createSubscription(draft)
          .then((result): string => result.subscription.subscriptionId)
      : this.gateway.updateSubscription(
          current.subscriptionId,
          draft,
        ).then((subscription: RssSubscription): string => subscription.subscriptionId);
    void task.then((subscriptionId: string): void => {
      this.saving = false;
      if (this.isCurrentSession(session)) {
        this.publish({ busy: false, statusMessage: 'RSS 订阅已保存' });
        this.onSaved(subscriptionId);
      }
    }).catch((error: Error): void => {
      this.saving = false;
      this.fail(session, 'RSS 订阅保存失败', error);
    });
  }

  private publish(patch: RssSubscriptionEditorPatch): void {
    this.snapshot = {
      mode: patch.mode ?? this.snapshot.mode,
      subscriptionId: patch.subscriptionId ?? this.snapshot.subscriptionId,
      feedUrl: patch.feedUrl ?? this.snapshot.feedUrl,
      title: patch.title ?? this.snapshot.title,
      enabled: patch.enabled ?? this.snapshot.enabled,
      sourceGroup: patch.sourceGroup ?? this.snapshot.sourceGroup,
      customOrder: patch.customOrder ?? this.snapshot.customOrder,
      updateIntervalMinutes: patch.updateIntervalMinutes ?? this.snapshot.updateIntervalMinutes,
      header: patch.header ?? this.snapshot.header,
      enabledCookieJar: patch.enabledCookieJar ?? this.snapshot.enabledCookieJar,
      ruleArticles: patch.ruleArticles ?? this.snapshot.ruleArticles,
      ruleNextPage: patch.ruleNextPage ?? this.snapshot.ruleNextPage,
      ruleTitle: patch.ruleTitle ?? this.snapshot.ruleTitle,
      rulePubDate: patch.rulePubDate ?? this.snapshot.rulePubDate,
      ruleDescription: patch.ruleDescription ?? this.snapshot.ruleDescription,
      ruleImage: patch.ruleImage ?? this.snapshot.ruleImage,
      ruleLink: patch.ruleLink ?? this.snapshot.ruleLink,
      ruleContent: patch.ruleContent ?? this.snapshot.ruleContent,
      busy: patch.busy ?? this.snapshot.busy,
      statusMessage: patch.statusMessage ?? this.snapshot.statusMessage,
    };
    if (this.isCurrent()) {
      this.emit(this.copySnapshot(this.snapshot));
    }
  }

  private fail(session: number, label: string, error: Error): void {
    if (this.isCurrentSession(session)) {
      this.publish({ busy: false, statusMessage: `${label}：${error.message}` });
    }
    hilog.error(DOMAIN, 'Reader', '%{public}s: %{public}s', label, error.message);
  }

  private copySnapshot(source: RssSubscriptionEditorSnapshot): RssSubscriptionEditorSnapshot {
    return {
      mode: source.mode,
      subscriptionId: source.subscriptionId,
      feedUrl: source.feedUrl,
      title: source.title,
      enabled: source.enabled,
      sourceGroup: source.sourceGroup,
      customOrder: source.customOrder,
      updateIntervalMinutes: source.updateIntervalMinutes,
      header: source.header,
      enabledCookieJar: source.enabledCookieJar,
      ruleArticles: source.ruleArticles,
      ruleNextPage: source.ruleNextPage,
      ruleTitle: source.ruleTitle,
      rulePubDate: source.rulePubDate,
      ruleDescription: source.ruleDescription,
      ruleImage: source.ruleImage,
      ruleLink: source.ruleLink,
      ruleContent: source.ruleContent,
      busy: source.busy,
      statusMessage: source.statusMessage,
    };
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && session === this.session;
  }

  private sourceDraft(snapshot: RssSubscriptionEditorSnapshot): RssSourceDraft {
    return {
      feedUrl: snapshot.feedUrl,
      title: snapshot.title,
      enabled: snapshot.enabled,
      sourceGroup: snapshot.sourceGroup,
      customOrder: this.optionalInteger(snapshot.customOrder, '自定义排序', false),
      updateIntervalMinutes: this.optionalInteger(snapshot.updateIntervalMinutes, '更新间隔', true),
      header: snapshot.header,
      enabledCookieJar: snapshot.enabledCookieJar,
      ruleArticles: snapshot.ruleArticles,
      ruleNextPage: snapshot.ruleNextPage,
      ruleTitle: snapshot.ruleTitle,
      rulePubDate: snapshot.rulePubDate,
      ruleDescription: snapshot.ruleDescription,
      ruleImage: snapshot.ruleImage,
      ruleLink: snapshot.ruleLink,
      ruleContent: snapshot.ruleContent,
    };
  }

  private optionalInteger(value: string, label: string, positive: boolean): number | undefined {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return undefined;
    }
    const parsed = Number(trimmed);
    if (!Number.isSafeInteger(parsed) || (positive ? parsed <= 0 : parsed < 0)) {
      throw new Error(`${label}必须是${positive ? '正' : '非负'}整数`);
    }
    return parsed;
  }
}

export type RssSourceTextField =
  'sourceGroup' | 'customOrder' | 'updateIntervalMinutes' | 'header' |
  'ruleArticles' | 'ruleNextPage' | 'ruleTitle' | 'rulePubDate' |
  'ruleDescription' | 'ruleImage' | 'ruleLink' | 'ruleContent';

interface RssSubscriptionEditorPatch {
  mode?: 'create' | 'edit';
  subscriptionId?: string;
  feedUrl?: string;
  title?: string;
  enabled?: boolean;
  sourceGroup?: string;
  customOrder?: string;
  updateIntervalMinutes?: string;
  header?: string;
  enabledCookieJar?: boolean;
  ruleArticles?: string;
  ruleNextPage?: string;
  ruleTitle?: string;
  rulePubDate?: string;
  ruleDescription?: string;
  ruleImage?: string;
  ruleLink?: string;
  ruleContent?: string;
  busy?: boolean;
  statusMessage?: string;
}
