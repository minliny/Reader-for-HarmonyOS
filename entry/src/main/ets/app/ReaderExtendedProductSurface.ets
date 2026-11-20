import type { ReaderRssProductPresentation, ReaderDiscoverProductPresentation, ReaderSyncProductPresentation } from './ReaderExtendedProductPresentation';
import type { DiscoverBook } from '../features/discover/DiscoverGateway';
import { DiscoverPage } from '../features/discover/DiscoverPage';
import { SyncPage } from '../features/sync/SyncPage';
import { RssPage, type RssMode } from '../features/rss/RssPage';
import { RssSubscriptionEditorPage } from '../features/rss/RssSubscriptionEditorPage';
import { RssSourceFeedPage } from '../features/rss/RssSourceFeedPage';
import { RssEntryDetailPage } from '../features/rss/RssEntryDetailPage';
import { RssSubscriptionManagementPage, type RssSubscriptionManagementItem } from '../features/rss/RssSubscriptionManagementPage';
import type { RssSubscription } from '../features/rss/RssGateway';
import type { RssOriginalMutationIdentity } from '../features/rss/RssMutationRecoveryContract';
import type { RssRouteOperationProjection } from '../features/rss/RssRouteOperationHost';
import type { RssSourceTextField } from '../features/rss/RssSubscriptionEditorOrchestrator';
import type { RssSourceSnapshot, RssEntrySnapshot, RssManagementOperationProjection } from '../features/rss/RssOrchestrator';
import type { RssItem } from '../features/rss/RssGateway';
import type { OperationFacts } from './ReaderOperationFacts';

export interface ReaderDiscoverSurfaceEvents {
  readonly onSelectBook: (book: DiscoverBook) => void;
  readonly onBack: () => void;
  readonly onRssRequested: () => void;
  readonly onSettingsRequested: () => void;
  readonly onRetryRead: (expected: number) => void;
  readonly onRefresh: () => void;
  readonly onCycleSource: () => void;
  readonly onSelectKind: (index: number) => void;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
}

export interface ReaderSyncSurfaceEvents {
  readonly onBack: () => void;
  readonly onReconcile: (expected: number) => void;
  readonly onSkipBackupRetention: (expected: number) => void;
  readonly onContinueConfigSave: (expected: number, url: string, user: string, pass: string, backupPass: string, directory: string) => void;
  readonly onSaveConfig: (url: string, user: string, pass: string, backupPass: string, path: string) => void;
  readonly onTestConnection: (url: string, user: string, pass: string, path: string) => void;
  readonly onTriggerBackup: () => void;
  readonly onRestoreLatest: () => void;
  readonly onResolveRestore: (overwriteLocal: boolean) => void;
}

export interface ReaderRssSurfaceEvents {
  readonly onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void;
  readonly onRetryRead: (facts: OperationFacts<RssSubscription[]>) => void;
  readonly onBack: () => void;
  readonly onRefresh: () => void;
  readonly onManage: () => void;
  readonly onSelectSubscription: (id: string) => void;
  readonly onSelectItem: (subscriptionId: string, guid: string) => void;
  readonly onModeRequested: (mode: RssMode) => void;
  readonly onSettingsRequested: () => void;
  readonly onDiscoverRequested: () => void;
}

export interface ReaderRssEditorSurfaceEvents {
  readonly onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void;
  readonly onContinueOriginal: (expected: RssOriginalMutationIdentity) => void;
  readonly onReconcile: (expectedGeneration: number) => void;
  readonly onRetryRead: (expectedGeneration: number) => void;
  readonly onBack: () => void;
  readonly onFeedUrlChanged: (value: string) => void;
  readonly onTitleChanged: (value: string) => void;
  readonly onEnabledChanged: (value: boolean) => void;
  readonly onEnabledCookieJarChanged: (value: boolean) => void;
  readonly onSourceFieldChanged: (field: RssSourceTextField, value: string) => void;
  readonly onSave: () => void;
}

export interface ReaderRssSourceSurfaceEvents {
  readonly onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void;
  readonly onReconcile: (operation: RssRouteOperationProjection<RssSourceSnapshot>) => void;
  readonly onRetryRead: (facts: OperationFacts<RssSourceSnapshot>) => void;
  readonly onBack: () => void;
  readonly onSelectItem: (item: RssItem) => void;
  readonly onRefresh: () => void;
  readonly onEditSource: () => void;
  readonly onSourceOperations: () => void;
}

export interface ReaderRssEntrySurfaceEvents {
  readonly onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void;
  readonly onContinueOriginal: (expected: RssOriginalMutationIdentity) => void;
  readonly onReconcile: (operation: RssRouteOperationProjection<RssEntrySnapshot>) => void;
  readonly onRetryRead: (facts: OperationFacts<RssEntrySnapshot>) => void;
  readonly onBack: () => void;
  readonly onViewSource: () => void;
  readonly onFavoriteRequested: (favorite: boolean) => void;
  readonly onSourceSettings: () => void;
  readonly onOpenOriginal: () => void;
}

export interface ReaderRssManagementSurfaceEvents {
  readonly onReconcileOriginal: (expected: RssOriginalMutationIdentity) => void;
  readonly onContinueOriginal: (expected: RssOriginalMutationIdentity) => void;
  readonly onBack: () => void;
  readonly onAdd: () => void;
  readonly onImport: () => void;
  readonly onExport: () => void;
  readonly onToggle: (id: string, enabled: boolean) => void;
  readonly onViewArticles: (id: string) => void;
  readonly onEditSource: (id: string) => void;
  readonly onRefresh: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onReconcile: (operation: RssManagementOperationProjection) => void;
  readonly onRetryRead: (facts: OperationFacts<RssSubscription[]>) => void;
}

/** Product-only UI composition. Index supplies current presentation facts and
 * captured business ports after profile admission. This component owns no
 * Runtime, recovery operation, persistence or independent presentation state. */
@Component
export struct ReaderExtendedProductSurface {
  @Prop surface: 'discover' | 'sync' | 'rss' | 'rssEditor' | 'rssSource' | 'rssEntry' | 'rssManagement' = 'rss';
  @Prop rss: ReaderRssProductPresentation | undefined = undefined;
  @Prop discover: ReaderDiscoverProductPresentation | undefined = undefined;
  @Prop sync: ReaderSyncProductPresentation | undefined = undefined;
  @Prop presentationIdentity: string = '';
  @Prop expandedLayout: boolean = false;
  @Prop managementItems: RssSubscriptionManagementItem[] = [];
  discoverEvents: ReaderDiscoverSurfaceEvents | undefined = undefined;
  syncEvents: ReaderSyncSurfaceEvents | undefined = undefined;
  rssEvents: ReaderRssSurfaceEvents | undefined = undefined;
  rssEditorEvents: ReaderRssEditorSurfaceEvents | undefined = undefined;
  rssSourceEvents: ReaderRssSourceSurfaceEvents | undefined = undefined;
  rssEntryEvents: ReaderRssEntrySurfaceEvents | undefined = undefined;
  rssManagementEvents: ReaderRssManagementSurfaceEvents | undefined = undefined;

  build() {
    if (this.surface === 'discover' && this.discover !== undefined && this.discoverEvents !== undefined) {
      DiscoverPage({
        presentation: this.discover.discoverPresentation,
        onSelectBook: this.discoverEvents.onSelectBook,
        expandedLayout: this.expandedLayout,
        onBack: this.discoverEvents.onBack,
        onRssRequested: this.discoverEvents.onRssRequested,
        onSettingsRequested: this.discoverEvents.onSettingsRequested,
        onRetryRead: this.discoverEvents.onRetryRead,
        onRefresh: this.discoverEvents.onRefresh,
        onCycleSource: this.discoverEvents.onCycleSource,
        onSelectKind: this.discoverEvents.onSelectKind,
        onPreviousPage: this.discoverEvents.onPreviousPage,
        onNextPage: this.discoverEvents.onNextPage,
      });
    }     else if (this.surface === 'sync' && this.sync !== undefined && this.syncEvents !== undefined) {
      SyncPage({
        snapshot: this.sync.syncSnapshot,
        expandedLayout: this.expandedLayout,
        onBack: this.syncEvents.onBack,
        onReconcile: this.syncEvents.onReconcile,
        onSkipBackupRetention: this.syncEvents.onSkipBackupRetention,
        onContinueConfigSave: this.syncEvents.onContinueConfigSave,
        onSaveConfig: this.syncEvents.onSaveConfig,
        onTestConnection: this.syncEvents.onTestConnection,
        onTriggerBackup: this.syncEvents.onTriggerBackup,
        onRestoreLatest: this.syncEvents.onRestoreLatest,
        onResolveRestore: this.syncEvents.onResolveRestore,
      });
    }     else if (this.surface === 'rss' && this.rss !== undefined && this.rssEvents !== undefined) {
      RssPage({
        presentation: this.rss.rssPresentation,
        original: this.rss.rssFeedOriginal,
        presentationIdentity: this.presentationIdentity,
        onReconcileOriginal: this.rssEvents.onReconcileOriginal,
        readFacts: this.rss.rssFeedRead,
        onRetryRead: this.rssEvents.onRetryRead,
        expandedLayout: this.expandedLayout,
        activeMode: 'sources',
        onBack: this.rssEvents.onBack,
        onRefresh: this.rssEvents.onRefresh,
        onManage: this.rssEvents.onManage,
        onSelectSubscription: this.rssEvents.onSelectSubscription,
        onSelectItem: this.rssEvents.onSelectItem,
        onModeRequested: this.rssEvents.onModeRequested,
        onSettingsRequested: this.rssEvents.onSettingsRequested,
        onDiscoverRequested: this.rssEvents.onDiscoverRequested,
      });
    }     else if (this.surface === 'rssEditor' && this.rss !== undefined && this.rssEditorEvents !== undefined) {
      RssSubscriptionEditorPage({
        presentationIdentity: this.presentationIdentity,
        onReconcileOriginal: this.rssEditorEvents.onReconcileOriginal,
        onContinueOriginal: this.rssEditorEvents.onContinueOriginal,
        snapshot: this.rss.rssEditorSnapshot,
        onReconcile: this.rssEditorEvents.onReconcile,
        onRetryRead: this.rssEditorEvents.onRetryRead,
        onBack: this.rssEditorEvents.onBack,
        onFeedUrlChanged: this.rssEditorEvents.onFeedUrlChanged,
        onTitleChanged: this.rssEditorEvents.onTitleChanged,
        onEnabledChanged: this.rssEditorEvents.onEnabledChanged,
        onEnabledCookieJarChanged: this.rssEditorEvents.onEnabledCookieJarChanged,
        onSourceFieldChanged: this.rssEditorEvents.onSourceFieldChanged,
        onSave: this.rssEditorEvents.onSave,
      });
    }     else if (this.surface === 'rssSource' && this.rss !== undefined && this.rssSourceEvents !== undefined) {
      RssSourceFeedPage({
        subscription: this.rss.selectedRssSubscription,
        items: this.rss.selectedRssItems,
        presentationIdentity: this.presentationIdentity,
        original: this.rss.rssSourceOriginal,
        onReconcileOriginal: this.rssSourceEvents.onReconcileOriginal,
        operation: this.rss.rssSourceOperation,
        readFacts: this.rss.rssSourceRead,
        onReconcile: this.rssSourceEvents.onReconcile,
        onRetryRead: this.rssSourceEvents.onRetryRead,
        expandedLayout: this.expandedLayout,
        onBack: this.rssSourceEvents.onBack,
        onSelectItem: this.rssSourceEvents.onSelectItem,
        onRefresh: this.rssSourceEvents.onRefresh,
        onEditSource: this.rssSourceEvents.onEditSource,
        onSourceOperations: this.rssSourceEvents.onSourceOperations,
      });
    }     else if (this.surface === 'rssEntry' && this.rss !== undefined && this.rssEntryEvents !== undefined) {
      RssEntryDetailPage({
        subscription: this.rss.selectedRssSubscription,
        item: this.rss.selectedRssItem,
        presentationIdentity: this.presentationIdentity,
        original: this.rss.rssEntryOriginal,
        onReconcileOriginal: this.rssEntryEvents.onReconcileOriginal,
        onContinueOriginal: this.rssEntryEvents.onContinueOriginal,
        operation: this.rss.rssEntryOperation,
        readFacts: this.rss.rssEntryRead,
        onReconcile: this.rssEntryEvents.onReconcile,
        onRetryRead: this.rssEntryEvents.onRetryRead,
        expandedLayout: this.expandedLayout,
        favoriteState: this.rss.selectedRssFavoriteState,
        onBack: this.rssEntryEvents.onBack,
        onViewSource: this.rssEntryEvents.onViewSource,
        onFavoriteRequested: this.rssEntryEvents.onFavoriteRequested,
        onSourceSettings: this.rssEntryEvents.onSourceSettings,
        onOpenOriginal: this.rssEntryEvents.onOpenOriginal,
      });
    }     else if (this.surface === 'rssManagement' && this.rss !== undefined && this.rssManagementEvents !== undefined) {
      RssSubscriptionManagementPage({
        items: this.managementItems,
        expandedLayout: this.expandedLayout,
        focusedSubscriptionId: this.rss.rssManagementFocusSubscriptionId,
        resultMessage: this.rss.rssOperationResultMessage,
        presentationIdentity: this.presentationIdentity,
        onReconcileOriginal: this.rssManagementEvents.onReconcileOriginal,
        onContinueOriginal: this.rssManagementEvents.onContinueOriginal,
        operation: this.rss.rssManagementOperation,
        readFacts: this.rss.rssManagementRead,
        onBack: this.rssManagementEvents.onBack,
        onAdd: this.rssManagementEvents.onAdd,
        onImport: this.rssManagementEvents.onImport,
        onExport: this.rssManagementEvents.onExport,
        onToggle: this.rssManagementEvents.onToggle,
        onViewArticles: this.rssManagementEvents.onViewArticles,
        onEditSource: this.rssManagementEvents.onEditSource,
        onRefresh: this.rssManagementEvents.onRefresh,
        onDelete: this.rssManagementEvents.onDelete,
        onReconcile: this.rssManagementEvents.onReconcile,
        onRetryRead: this.rssManagementEvents.onRetryRead,
      });
    }
  }
}
