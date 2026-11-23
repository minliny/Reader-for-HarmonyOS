import type { RssOriginalMutationIdentity, RssOriginalMutationProjection } from '../application/RssMutationRecoveryContract';
import { RssPresentationProjection } from './RssPresentationProjection';
import type { RssRouteOperationProjection, RssRouteBinding } from '../application/RssRouteOperationHost';
import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { ReaderNativeAlertOptions } from '../../../ui/platform/ReaderNativeAlertOwner';
import { isReaderProductSurfaceEnabled } from '../../../app/ReaderProductScope';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import type {
  RssItem,
  RssSourceExportResult,
  RssSourceImportResult,
  RssSubscription,
} from '../application/RssGateway';
import type { RssFavoritePresentation, RssMode, RssPresentation, RssSubscriptionManagementItem,
  RssEntrySnapshot, RssSourceSnapshot } from './RssPresentationContract';
import {
  EMPTY_RSS_EDITOR_SNAPSHOT,
  RssSubscriptionEditorOrchestrator,
  type RssSubscriptionEditorSnapshot,
} from '../application/RssSubscriptionEditorOrchestrator';
import {
  RssOrchestrator,
  type RssManagementOperationProjection,
} from '../application/RssOrchestrator';
import { projectOperationFacts, type OperationFacts } from '../../../app/ReaderOperationFacts';

const DOMAIN = 0x5244;
export type RssRoute = 'rss' | 'rssSubscriptionManagement' | 'rssSubscriptionEditor' | 'rssSourceFeed' | 'rssEntryDetail';
type RssDetailReturnTarget = 'rss' | 'rssSourceFeed';
type RssSourceFeedReturnTarget = 'rss' | 'rssSubscriptionManagement';

export interface RssJourneyNavigation {
  route: () => string;
  generation: () => number;
  mounting: () => number;
  instance: () => number;
  owner: () => ReaderRuntimeOwner | undefined;
  retired: () => boolean;
  isCurrentOwner: (owner: ReaderRuntimeOwner | undefined) => boolean;
  advance: () => number;
  show: (route: RssRoute) => void;
  endReading: () => void;
  importVisible: () => boolean;
  openImport: (context: 'rssMerge' | 'rssReplace') => void;
  confirm: (options: ReaderNativeAlertOptions, current: () => boolean) => void;
  scheme: () => string;
}

interface RssFeedPresentationBinding {
  current: () => boolean;
  emit: (subscriptions: RssSubscription[]) => void;
  emitRead: (facts: OperationFacts<RssSubscription[]>) => void;
  emitOriginal: (original: RssOriginalMutationProjection | undefined) => void;
}

/** Retained RSS read and operation projections for the five RSS surfaces. */
@Observed
export class RssJourneyPresentation {
  rssFeedRead: OperationFacts<RssSubscription[]> = projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  rssFeedOriginal: RssOriginalMutationProjection | undefined = undefined;
  rssSourceOriginal: RssOriginalMutationProjection | undefined = undefined;
  rssEntryOriginal: RssOriginalMutationProjection | undefined = undefined;
  rssSourceOperation: RssRouteOperationProjection<RssSourceSnapshot> | undefined = undefined;
  rssSourceRead: OperationFacts<RssSourceSnapshot> = projectOperationFacts<RssSourceSnapshot>({ phase: 'idle' });
  rssEntryOperation: RssRouteOperationProjection<RssEntrySnapshot> | undefined = undefined;
  rssEntryRead: OperationFacts<RssEntrySnapshot> = projectOperationFacts<RssEntrySnapshot>({ phase: 'idle' });
  rssPresentation: RssPresentation = { kind: 'feed', subscriptions: [], recentUnread: [] };
  rssManagementOperation: RssManagementOperationProjection | undefined = undefined;
  rssManagementRead: OperationFacts<RssSubscription[]> =
    projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  selectedRssSubscription: RssSubscription | undefined = undefined;
  selectedRssItems: RssItem[] = [];
  selectedRssItem: RssItem | undefined = undefined;
  selectedRssFavoriteState: RssFavoritePresentation = 'loading';
  rssDetailReturnTarget: RssDetailReturnTarget = 'rss';
  rssSourceFeedReturnTarget: RssSourceFeedReturnTarget = 'rss';
  rssManagementFocusSubscriptionId: string = '';
  rssEditorSnapshot: RssSubscriptionEditorSnapshot = EMPTY_RSS_EDITOR_SNAPSHOT;
  rssOperationResultMessage: string = '';
  rssOrchestrator: RssOrchestrator | undefined;
  rssPresentationIdentity: string = '';
  rssEditorPresentationIdentity: string = '';
  rssEditorOrchestrator: RssSubscriptionEditorOrchestrator | undefined;

  private readonly navigation: RssJourneyNavigation;

  constructor(navigation: RssJourneyNavigation) { this.navigation = navigation; }

  clearSelection(): void {
    this.selectedRssSubscription = undefined;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rss';
    this.rssSourceFeedReturnTarget = 'rss';
    this.rssManagementFocusSubscriptionId = '';
  }

  retire(): void {
    this.retireRssEditorPresentation();
    this.retireRssPresentation();
    this.rssOperationResultMessage = '';
  }

  isImportCurrent(identity: string): boolean {
    return this.isCurrentRssHostPresentation(this.navigation.generation(), this.navigation.owner(), this.navigation.mounting(),
      this.rssOrchestrator, identity, 'rssSubscriptionManagement');
  }

  openRss(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const generation = this.navigation.advance();
    this.navigation.endReading();
    this.clearSelection();
    this.navigation.show('rss');
    void this.loadRss(generation);
  }

  loadRss(generation: number, expectedGeneration?: number): void {
    if (!isReaderProductSurfaceEnabled('rss')) return;
    const host = this.getRssOrchestrator();
    const binding = this.rssFeedBinding(generation, this.navigation.owner(), this.navigation.mounting(),
      host, this.rssPresentationIdentity);
    if (!binding.current()) return;
    host.loadFeed(binding.emit, binding.emitRead, binding.current, expectedGeneration, binding.emitOriginal);
  }

  private rssFeedBinding(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number,
    host: RssOrchestrator | undefined, identity: string): RssFeedPresentationBinding {
    const current = (): boolean => this.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rss');
    return { current,
      emit: (subscriptions: RssSubscription[]): void => { if (current()) this.rssPresentation = this.feedPresentation(subscriptions, []); },
      emitRead: (facts: OperationFacts<RssSubscription[]>): void => {
        if (!current()) return;
        this.rssFeedRead = facts;
        if (facts.value !== undefined) this.rssPresentation = this.feedPresentation(facts.value, []);
      },
      emitOriginal: (original: RssOriginalMutationProjection | undefined): void => { if (current()) this.rssFeedOriginal = original; },
    };
  }

  reconcileRssFeedOriginal(expected: RssOriginalMutationIdentity, generation: number,
    owner: ReaderRuntimeOwner | undefined, mounting: number, host: RssOrchestrator | undefined, identity: string): void {
    const binding = this.rssFeedBinding(generation, owner, mounting, host, identity);
    if (!binding.current()) return;
    host?.reconcileFeedOriginal(expected, binding.emit, binding.emitRead, binding.current, binding.emitOriginal);
  }

  refreshRss(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    // The registered Figma boundary keeps RSS as a placeholder-only page.
    // Do not start a real rss.subscription.refresh transaction and then label
    // its stale/cache outcome as a user-visible refresh.
    hilog.warn(DOMAIN, 'Reader', 'FIGMA_VISUAL_GAP: RSS refresh is placeholder-only until its admitted flow is supplied');
  }

  onRssManage(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.navigation.advance();
    this.clearSelection();
    this.navigation.show('rssSubscriptionManagement');
    this.getRssOrchestrator().open();
  }

  private retireRssPresentation(): void {
    this.rssOrchestrator?.detachPresentation(this.rssPresentationIdentity);
    this.rssPresentationIdentity = '';
  }

  private getRssOrchestrator(): RssOrchestrator {
    const owner = this.navigation.owner();
    if (owner === undefined || this.navigation.retired() || !this.navigation.isCurrentOwner(owner))
      throw new Error('RSS 页面已退役');
    const host = RssOrchestrator.forRuntime(owner);
    if (host === undefined) throw new Error('RSS Runtime 已退役');
    const generation = this.navigation.generation(), mounting = this.navigation.mounting();
    const identity = JSON.stringify([this.navigation.instance(), mounting, generation]);
    if (this.rssOrchestrator !== host || this.rssPresentationIdentity !== identity) {
      this.retireRssPresentation();
      if (this.rssOrchestrator !== host) {
        this.rssManagementOperation = undefined;
        this.rssManagementRead = projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
      }
      this.rssOrchestrator = host;
      this.rssPresentationIdentity = identity;
      const admitted = (): boolean => this.rssOrchestrator === host && this.rssPresentationIdentity === identity &&
        this.navigation.owner() === owner && !this.navigation.retired() && this.navigation.mounting() === mounting &&
        this.navigation.generation() === generation && this.navigation.isCurrentOwner(owner);
      const current = (): boolean => admitted() && this.navigation.route() === 'rssSubscriptionManagement';
      if (!host.attachPresentation(identity,
        (subscriptions: RssSubscription[]): void => { if (current()) this.rssPresentation = this.feedPresentation(subscriptions, []); },
        current,
        (operation: RssManagementOperationProjection): void => { if (current()) this.rssManagementOperation = operation; },
        (facts: OperationFacts<RssSubscription[]>): void => { if (current()) this.rssManagementRead = facts; },
        admitted)) {
        this.rssPresentationIdentity = '';
        throw new Error('RSS 展示已退役');
      }
    }
    return host;
  }

  private retireRssEditorPresentation(): void {
    this.rssEditorOrchestrator?.detachPresentation(this.rssEditorPresentationIdentity);
    this.rssEditorPresentationIdentity = '';
  }
  isCurrentRssEditorPresentation(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, identity: string, host: RssSubscriptionEditorOrchestrator | undefined, attached: boolean = true): boolean {
    return owner !== undefined && host !== undefined && identity.length > 0 && this.rssEditorOrchestrator === host &&
      this.rssEditorPresentationIdentity === identity && (!attached || host.ownsPresentation(identity)) && host.owns(owner) && this.navigation.owner() === owner &&
      this.navigation.mounting() === mounting && this.navigation.generation() === generation &&
      !this.navigation.retired() && this.navigation.route() === 'rssSubscriptionEditor' && this.navigation.isCurrentOwner(owner);
  }
  private getRssEditorOrchestrator(): RssSubscriptionEditorOrchestrator {
    const owner = this.navigation.owner();
    if (owner === undefined || this.navigation.retired() || !this.navigation.isCurrentOwner(owner) || this.navigation.route() !== 'rssSubscriptionEditor')
      throw new Error('RSS 编辑页面已退役');
    const shared = this.getRssOrchestrator();
    const host = RssSubscriptionEditorOrchestrator.forRuntime(owner, (task: () => Promise<void>): Promise<void> => shared.runSerialized(task));
    if (host === undefined) throw new Error('RSS 编辑 Runtime 已退役');
    const generation = this.navigation.generation(), mounting = this.navigation.mounting();
    const identity = JSON.stringify([this.navigation.instance(), mounting, generation, 'editor']);
    if (this.rssEditorOrchestrator !== host || this.rssEditorPresentationIdentity !== identity) {
      this.retireRssEditorPresentation();
      this.rssEditorOrchestrator = host; this.rssEditorPresentationIdentity = identity;
      const current = (): boolean => this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host);
      const admitted = (): boolean => this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host, false);
      if (!host.attachPresentation(identity,
        (snapshot: RssSubscriptionEditorSnapshot): void => { if (current()) this.rssEditorSnapshot = snapshot; },
        (subscriptionId: string): void => { if (current()) this.finishRssSubscriptionEdit(subscriptionId); }, current, admitted)) {
        this.rssEditorPresentationIdentity = '';
        throw new Error('RSS 编辑展示已退役');
      }
    }
    return host;
  }

  onRssManagementViewArticles(subscriptionId: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.onRssSubscriptionSelected(subscriptionId, 'rssSubscriptionManagement');
  }

  onRssSubscriptionSelected(
    subscriptionId: string,
    returnTarget: RssSourceFeedReturnTarget = 'rss',
  ): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const subscription = this.rssSubscriptions().find(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    );
    if (subscription === undefined) {
      hilog.warn(DOMAIN, 'Reader',
        'RSS SourceFeed ignored unknown subscriptionId=%{private}s', subscriptionId);
      return;
    }
    const generation = this.navigation.advance();
    this.rssSourceOriginal = undefined;
    this.rssSourceOperation = undefined;
    this.rssSourceRead = projectOperationFacts<RssSourceSnapshot>({ phase: 'idle' });
    this.selectedRssSubscription = subscription;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssSourceFeedReturnTarget = returnTarget;
    this.navigation.show('rssSourceFeed');
    this.loadRssSourceItems(generation, subscriptionId);
  }

  onRssSubscriptionAddRequested(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.navigation.advance();
    this.navigation.show('rssSubscriptionEditor');
    this.getRssEditorOrchestrator().openCreate();
  }

  onRssSubscriptionEditRequested(subscriptionId: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (!this.rssSubscriptions().some(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    )) {
      return;
    }
    this.navigation.advance();
    this.navigation.show('rssSubscriptionEditor');
    this.getRssEditorOrchestrator().openEdit(subscriptionId);
  }

  private finishRssSubscriptionEdit(subscriptionId: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.navigation.route() !== 'rssSubscriptionEditor') {
      return;
    }
    this.navigation.advance();
    this.rssManagementFocusSubscriptionId = subscriptionId;
    this.navigation.show('rssSubscriptionManagement');
    this.getRssOrchestrator().open();
  }

  returnToRssSubscriptionManagement(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.navigation.advance();
    this.navigation.show('rssSubscriptionManagement');
    this.getRssOrchestrator().open();
  }

  requestRssSubscriptionDelete(subscriptionId: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const subscription = this.rssSubscriptions().find(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    );
    if (this.navigation.route() !== 'rssSubscriptionManagement' || subscription === undefined) {
      hilog.warn(DOMAIN, 'Reader',
        'RSS delete confirmation ignored stale subscriptionId=%{private}s', subscriptionId);
      return;
    }
    const generation = this.navigation.generation(), owner = this.navigation.owner(), mounting = this.navigation.mounting();
    const host = this.rssOrchestrator, identity = this.rssPresentationIdentity;
    const current = (): boolean => this.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement') &&
      this.rssSubscriptions().find((candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId) === subscription;
    if (!current()) return;
    this.navigation.confirm({
      title: '删除订阅源',
      message: `确定删除“${subscription.title}”吗？删除后无法恢复。`,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '删除',
        action: (): void => { if (current()) this.confirmRssSubscriptionDelete(subscriptionId, generation, owner, mounting, host, identity); },
      },
    }, current);
  }

  requestRssSourceImport(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.navigation.route() !== 'rssSubscriptionManagement') {
      return;
    }
    const host = this.rssOrchestrator, identity = this.rssPresentationIdentity;
    const generation = this.navigation.generation(), owner = this.navigation.owner(), mounting = this.navigation.mounting();
    const importVisible = this.navigation.importVisible();
    const current = (): boolean => this.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement') && this.navigation.importVisible() === importVisible;
    if (!current()) return;
    this.navigation.confirm({
      title: '导入 RSS 源',
      message: '“合并导入”保留现有来源；“覆盖全部”会原子替换当前 RSS 来源与阅读状态。',
      primaryButton: {
        value: '合并导入',
        action: (): void => { if (current()) this.navigation.openImport('rssMerge'); },
      },
      secondaryButton: {
        value: '覆盖全部',
        fontColor: readerAppColor('app.action.nativeDestructive', this.navigation.scheme()),
        action: (): void => { if (current()) this.navigation.openImport('rssReplace'); },
      },
    }, current);
  }

  importRssSources(replaceExisting: boolean, onlineUrl?: string,
    identity: string = this.rssPresentationIdentity): void {
    const host = this.rssOrchestrator;
    const generation = this.navigation.generation(), owner = this.navigation.owner(), mounting = this.navigation.mounting();
    const current = (): boolean => this.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement');
    if (!current() || host === undefined) return;
    host.importSources(
      replaceExisting,
      (result: RssSourceImportResult | undefined): void => {
        if (result !== undefined && current()) {
          this.showRssOperationResult('RSS 源导入完成', `Core 已原子导入 ${result.imported} 个来源。`);
        }
      },
      (error: Error): void => { if (current()) this.showRssOperationResult('RSS 源导入失败', error.message); },
      onlineUrl,
    );
  }

  exportRssSources(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.getRssOrchestrator().exportSources(
      (result: RssSourceExportResult): void => {
        if (result.destination !== undefined) {
          this.showRssOperationResult('RSS 源导出完成', `已导出 ${result.count} 个来源。`);
        }
      },
      (error: Error): void => this.showRssOperationResult('RSS 源导出失败', error.message),
    );
  }

  private showRssOperationResult(title: string, message: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.navigation.route() !== 'rssSubscriptionManagement' || this.navigation.retired() || !this.navigation.isCurrentOwner(this.navigation.owner())) {
      return;
    }
    this.rssOperationResultMessage = `${title}：${message}`;
  }

  private confirmRssSubscriptionDelete(subscriptionId: string, generation: number = this.navigation.generation(),
    owner: ReaderRuntimeOwner | undefined = this.navigation.owner(), mounting: number = this.navigation.mounting(),
    host: RssOrchestrator | undefined = this.rssOrchestrator, identity: string = this.rssPresentationIdentity): void {
    const stillPresent = this.rssSubscriptions().some(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId);
    if (stillPresent && this.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSubscriptionManagement'))
      host?.removeSubscription(subscriptionId);
  }

  isCurrentRssHostPresentation(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number,
    host: RssOrchestrator | undefined, identity: string, route: RssRoute, subscriptionId: string = '', guid: string = ''): boolean {
    return owner !== undefined && host !== undefined && host === this.rssOrchestrator && host.owns(owner) &&
      identity.length > 0 && identity === this.rssPresentationIdentity && host.isPresentationCurrent(identity) &&
      owner === this.navigation.owner() && mounting === this.navigation.mounting() &&
      isReaderProductSurfaceEnabled('rss') && this.isCurrentRssPresentation(generation, owner, route, subscriptionId, guid);
  }

  private isCurrentRssPresentation(generation: number, owner: ReaderRuntimeOwner, route: RssRoute,
    subscriptionId: string = '', guid: string = ''): boolean {
    if (this.navigation.retired() || (generation !== this.navigation.generation() || route !== this.navigation.route())) return false;
    try {
      if (!this.navigation.isCurrentOwner(owner)) return false;
      if (route === 'rssSourceFeed') return this.selectedRssSubscription?.subscriptionId === subscriptionId;
      if (route === 'rssEntryDetail') return this.selectedRssItem?.subscriptionId === subscriptionId && this.selectedRssItem?.guid === guid;
      return true;
    } catch (_) { return false; }
  }

  rssSourceBinding(generation: number, subscriptionId: string,
    owner: ReaderRuntimeOwner | undefined = this.navigation.owner(), host: RssOrchestrator | undefined = this.rssOrchestrator,
    identity: string = this.rssPresentationIdentity, mounting: number = this.navigation.mounting()): RssRouteBinding<RssSourceSnapshot> {
    const current = (): boolean => this.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssSourceFeed', subscriptionId);
    return { current,
      emitOriginal: (original: RssOriginalMutationProjection | undefined): void => { if (current()) this.rssSourceOriginal = original; },
      emit: (snapshot: RssSourceSnapshot): void => { if (current()) this.applyRssSourceSnapshot(snapshot); },
      failed: (error: Error): void => { if (current()) hilog.error(DOMAIN, 'Reader', 'RSS source read failed: %{private}s', error.message); },
      emitOperation: (operation: RssRouteOperationProjection<RssSourceSnapshot>): void => {
        if (current() && operation.subscriptionId === subscriptionId) this.rssSourceOperation = operation;
      },
      emitRead: (facts: OperationFacts<RssSourceSnapshot>): void => { if (current()) this.rssSourceRead = facts; },
    };
  }

  rssEntryBinding(generation: number, subscriptionId: string, guid: string,
    owner: ReaderRuntimeOwner | undefined = this.navigation.owner(), host: RssOrchestrator | undefined = this.rssOrchestrator,
    identity: string = this.rssPresentationIdentity, mounting: number = this.navigation.mounting()): RssRouteBinding<RssEntrySnapshot> {
    const current = (): boolean => this.isCurrentRssHostPresentation(generation, owner, mounting, host, identity, 'rssEntryDetail', subscriptionId, guid);
    return { current,
      emitOriginal: (original: RssOriginalMutationProjection | undefined): void => { if (current()) this.rssEntryOriginal = original; },
      emit: (snapshot: RssEntrySnapshot): void => { if (current()) this.applyRssEntrySnapshot(snapshot); },
      failed: (error: Error): void => { if (current()) this.failRssEntryOperation('read', error); },
      emitOperation: (operation: RssRouteOperationProjection<RssEntrySnapshot>): void => {
        if (current() && operation.subscriptionId === subscriptionId && operation.guid === guid) this.rssEntryOperation = operation;
      },
      emitRead: (facts: OperationFacts<RssEntrySnapshot>): void => { if (current()) this.rssEntryRead = facts; },
    };
  }

  private loadRssSourceItems(generation: number, subscriptionId: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const host = this.getRssOrchestrator();
    const binding = this.rssSourceBinding(generation, subscriptionId);
    host.loadSourceFeed(subscriptionId, binding.emit, binding.failed, binding.current,
      binding.emitOperation, binding.emitRead, binding.emitOriginal);
  }

  refreshRssSourceFeed(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const subscriptionId = this.selectedRssSubscription?.subscriptionId;
    if (subscriptionId === undefined || this.navigation.route() !== 'rssSourceFeed') {
      return;
    }
    const generation = this.navigation.generation();
    const host = this.getRssOrchestrator();
    const binding = this.rssSourceBinding(generation, subscriptionId);
    host.refreshSourceFeed(subscriptionId, binding.emit, binding.failed, binding.current,
      binding.emitOperation, binding.emitRead, binding.emitOriginal);
  }

  private applyRssSourceSnapshot(snapshot: RssSourceSnapshot): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.rssPresentation = this.feedPresentation(snapshot.subscriptions, []);
    this.selectedRssSubscription = snapshot.subscription;
    this.selectedRssItems = snapshot.items;
  }

  onRssItemSelected(subscriptionId: string, guid: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const item = this.rssRecentUnread().find(
      (candidate: RssItem): boolean => candidate.subscriptionId === subscriptionId &&
        candidate.guid === guid,
    );
    if (item === undefined) {
      hilog.warn(DOMAIN, 'Reader',
        'RSS EntryDetail ignored unknown identity=%{private}s:%{private}s', subscriptionId, guid);
      return;
    }
    this.openRssEntryDetail(item, 'rss');
  }

  onRssSourceItemSelected(item: RssItem): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const selected = this.selectedRssItems.find(
      (candidate: RssItem): boolean => candidate.subscriptionId === item.subscriptionId &&
        candidate.guid === item.guid,
    );
    if (selected !== undefined) {
      this.openRssEntryDetail(selected, 'rssSourceFeed');
    }
  }

  private openRssEntryDetail(item: RssItem, returnTarget: RssDetailReturnTarget): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const subscription = this.selectedRssSubscription?.subscriptionId === item.subscriptionId
      ? this.selectedRssSubscription
      : this.rssSubscriptions().find(
        (candidate: RssSubscription): boolean => candidate.subscriptionId === item.subscriptionId,
      );
    if (subscription === undefined) {
      hilog.warn(DOMAIN, 'Reader',
        'RSS EntryDetail has no subscription for guid=%{private}s', item.guid);
      return;
    }
    const generation = this.navigation.advance();
    this.rssEntryOriginal = undefined;
    this.rssEntryOperation = undefined;
    this.rssEntryRead = projectOperationFacts<RssEntrySnapshot>({ phase: 'idle' });
    this.selectedRssSubscription = subscription;
    this.selectedRssItem = item;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = returnTarget;
    this.navigation.show('rssEntryDetail');
    const subscriptionId = item.subscriptionId;
    const guid = item.guid;
    const host = this.getRssOrchestrator();
    const binding = this.rssEntryBinding(generation, subscriptionId, guid);
    host.openEntry(subscriptionId, guid, binding.emit, binding.failed, binding.current,
      binding.emitOperation, binding.emitRead, binding.emitOriginal);
  }

  onRssEntryFavoriteRequested(favorite: boolean): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const item = this.selectedRssItem;
    if (item === undefined || this.navigation.route() !== 'rssEntryDetail' ||
      (this.selectedRssFavoriteState !== 'favorited' &&
        this.selectedRssFavoriteState !== 'notFavorited')) {
      return;
    }
    const generation = this.navigation.generation();
    const subscriptionId = item.subscriptionId;
    const guid = item.guid;
    const host = this.getRssOrchestrator();
    const binding = this.rssEntryBinding(generation, subscriptionId, guid);
    host.setEntryFavorite(subscriptionId, guid, favorite, binding.emit, binding.failed, binding.current,
      binding.emitOperation, binding.emitRead, binding.emitOriginal);
  }

  private applyRssEntrySnapshot(snapshot: RssEntrySnapshot): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.rssPresentation = this.feedPresentation(snapshot.subscriptions, []);
    this.selectedRssSubscription = snapshot.subscription;
    this.selectedRssItems = snapshot.items;
    this.selectedRssItem = snapshot.item;
    this.selectedRssFavoriteState = snapshot.favorite ? 'favorited' : 'notFavorited';
  }

  private failRssEntryOperation(action: string, error: Error): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.selectedRssFavoriteState = 'unavailable';
    hilog.error(DOMAIN, 'Reader',
      'RSS EntryDetail %{private}s failed; no optimistic state applied: %{private}s',
      action, error.message);
  }

  returnFromRssEntryDetail(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.rssDetailReturnTarget === 'rssSourceFeed') {
      this.returnToRssSourceFeed();
      return;
    }
    this.returnToRss();
  }

  returnToRssSourceFeed(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.selectedRssSubscription === undefined) {
      this.returnToRss();
      return;
    }
    const subscriptionId = this.selectedRssSubscription.subscriptionId;
    const generation = this.navigation.advance();
    this.rssSourceOriginal = undefined;
    this.rssSourceOperation = undefined;
    this.rssSourceRead = projectOperationFacts<RssSourceSnapshot>({ phase: 'idle' });
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rssSourceFeed';
    this.navigation.show('rssSourceFeed');
    this.loadRssSourceItems(generation, subscriptionId);
  }

  returnFromRssSourceFeed(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.rssSourceFeedReturnTarget === 'rssSubscriptionManagement') {
      const focusedSubscriptionId = this.selectedRssSubscription?.subscriptionId ?? '';
      this.navigation.advance();
      this.selectedRssSubscription = undefined;
      this.selectedRssItems = [];
      this.selectedRssItem = undefined;
      this.selectedRssFavoriteState = 'loading';
      this.rssDetailReturnTarget = 'rss';
      this.rssSourceFeedReturnTarget = 'rss';
      this.rssManagementFocusSubscriptionId = focusedSubscriptionId;
      this.navigation.show('rssSubscriptionManagement');
      this.getRssOrchestrator().open();
      return;
    }
    this.returnToRss();
  }

  returnToRss(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.navigation.advance();
    this.clearSelection();
    this.navigation.show('rss');
    this.loadRss(this.navigation.generation());
  }

  openRssManagementForSubscription(subscriptionId: string | undefined): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (subscriptionId === undefined || !this.rssSubscriptions().some(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    )) {
      return;
    }
    this.navigation.advance();
    this.rssManagementFocusSubscriptionId = subscriptionId;
    this.selectedRssSubscription = undefined;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rss';
    this.rssSourceFeedReturnTarget = 'rss';
    this.navigation.show('rssSubscriptionManagement');
    this.getRssOrchestrator().open();
  }

  onRssOpenOriginalRequested(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.selectedRssItem?.link === undefined ||
      this.selectedRssItem.link.trim().length === 0) {
      hilog.warn(DOMAIN, 'Reader', 'RSS original link intent ignored because the entry has no link');
      return;
    }
    hilog.warn(DOMAIN, 'Reader',
      'HOST_CAPABILITY_GAP: RSS original link requires webview.open Host wiring');
  }

  onRssModeRequested(mode: RssMode): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (mode === 'sources') {
      return;
    }
    // All/Favorites/Rules are modes of the existing RSS page, not routes.
    // Their data contracts are not admitted yet, so keep Sources selected and
    // surface the missing boundary instead of showing invented local data.
    hilog.warn(DOMAIN, 'Reader',
      'FIGMA_VISUAL_GAP: RSS mode %{private}s has no admitted data contract', mode);
  }

  private feedPresentation(subscriptions: RssSubscription[], recentUnread: RssItem[]): RssPresentation {
    return RssPresentationProjection.feed(subscriptions, recentUnread);
  }

  private rssSubscriptions(): RssSubscription[] {
    return RssPresentationProjection.subscriptions(this.rssPresentation);
  }

  private rssRecentUnread(): RssItem[] {
    return RssPresentationProjection.recentUnread(this.rssPresentation);
  }

  rssSubscriptionManagementItems(): RssSubscriptionManagementItem[] {
    return RssPresentationProjection.managementItems(this.rssPresentation);
  }

}
