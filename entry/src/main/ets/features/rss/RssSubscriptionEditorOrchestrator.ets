import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { RssGateway, type RssSubscription } from './RssGateway';

const DOMAIN = 0x5244;

export interface RssSubscriptionEditorSnapshot {
  mode: 'create' | 'edit';
  subscriptionId: string;
  feedUrl: string;
  title: string;
  enabled: boolean;
  busy: boolean;
  statusMessage: string;
}

export const EMPTY_RSS_EDITOR_SNAPSHOT: RssSubscriptionEditorSnapshot = {
  mode: 'create',
  subscriptionId: '',
  feedUrl: '',
  title: '',
  enabled: true,
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

  save(): void {
    if (this.saving) {
      return;
    }
    this.saving = true;
    const session = this.session;
    const current = this.copySnapshot(this.snapshot);
    this.publish({ busy: true, statusMessage: '正在由 Core 保存 RSS 订阅…' });
    const task = current.mode === 'create'
      ? this.gateway.createSubscription(current.feedUrl, current.title, current.enabled)
          .then((result): string => result.subscription.subscriptionId)
      : this.gateway.updateSubscription(
          current.subscriptionId,
          current.feedUrl,
          current.title,
          current.enabled,
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
      busy: source.busy,
      statusMessage: source.statusMessage,
    };
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && session === this.session;
  }
}

interface RssSubscriptionEditorPatch {
  mode?: 'create' | 'edit';
  subscriptionId?: string;
  feedUrl?: string;
  title?: string;
  enabled?: boolean;
  busy?: boolean;
  statusMessage?: string;
}
