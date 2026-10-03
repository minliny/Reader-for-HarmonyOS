import { RssPresentationProjection } from '../features/rss/RssPresentationProjection';
import type { RssRouteOperationProjection, RssRouteBinding } from '../features/rss/RssRouteOperationHost';
import { ReaderNativeAlertOwner, type ReaderNativeAlertLease, type ReaderNativeAlertOptions, type ReaderNativeAlertSpecId } from '../app/ReaderNativeAlertOwner';
import { readerRecoveryView, type ReaderRecoveryView } from '../app/ReaderRecoveryProjection';
import { ReaderRecoveryNotice } from '../features/common/ReaderRecoveryNotice';
import { ReaderRecoveryAction } from '../features/common/ReaderRecoveryAction';
import type { RemoteReadingPositionScope } from '../features/reading/RemoteReadingPositionMigration';
import { FrameCallback } from '@kit.ArkUI';
import { readerAppColor } from '../features/common/ReaderThemeRegistry';
import { BookshelfSettingsPage } from '../features/bookshelf/BookshelfSettingsPage';
import { BookshelfGroupSelector } from '../features/bookshelf/BookshelfGroupSelector';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderCoreRequestError } from '@reader/core-harmony';
import { SearchHost } from '../features/search/SearchHost';
import { resolveBookshelfBook } from '../features/bookshelf/BookshelfBookIdentity';
import { BookshelfViewState } from '../features/bookshelf/BookshelfViewState';
import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import { ReaderStartupTrace } from '../app/ReaderStartupTrace';
import { ReaderSystemFileOpenNavigationHost, type SystemFileOpenNavigationView, type SystemFileOpenReaderIdentity } from '../app/ReaderSystemFileOpenNavigationHost';
import { errorMessageOf } from '../app/ErrorMessage';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { readerContentSafeTop } from '../features/common/ReaderWindowMetrics';
import type {
  ShelfBook,
  BookshelfState,
} from '../app/ReaderCoreGateway';
import {
  type BookshelfDataState,
  type BookshelfFilter,
  type BookshelfRemovalTarget,
} from '../features/bookshelf/BookshelfFlowGateway';
import { EMPTY_READABLE_ADMISSION, type BookshelfReadableAdmissionSnapshot, type BookshelfReadableAdmissionEffect } from '../features/bookshelf/BookshelfReadableAdmissionOwner';
import { EMPTY_BOOKSHELF_OPERATION_SNAPSHOT, type BookshelfOperationSnapshot } from '../features/bookshelf/BookshelfOperationOwner';
import { LOCAL_IMPORT_PRESENTATION_KEY, type LocalImportPresentation } from '../features/bookshelf/LocalImportPresentationOwner';
import { BookshelfPage } from '../features/bookshelf/BookshelfPage';
import { BookRemovalDialog } from '../features/bookshelf/BookRemovalDialog';
import { BookshelfMultiSelectPage } from '../features/bookshelf/BookshelfMultiSelectPage';
import { BookshelfManagementPage } from '../features/bookshelf/BookshelfManagementPage';
import {
  BookshelfHost,
  EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT,
  type BookshelfManagementSnapshot,
} from '../features/bookshelf/BookshelfHost';
import { BookshelfProjectionOwner, type BookshelfProjectionBinding, type BookshelfProjectionSnapshot } from '../features/bookshelf/BookshelfProjectionOwner';
import { BookshelfCatalogOwner, type BookshelfCatalogBinding, type BookshelfCatalogSnapshot, type BookshelfCatalogSeeds } from '../features/bookshelf/BookshelfCatalogOwner';
import { bookshelfSourceDisplayName, type BookshelfNamedSource } from '../features/bookshelf/BookshelfSourceNameProjection';
import { DiscoverPage } from '../features/discover/DiscoverPage';
import {
  DiscoverOrchestrator,
  EMPTY_DISCOVER_PRESENTATION,
  type DiscoverPresentation,
} from '../features/discover/DiscoverOrchestrator';
import { BookshelfEmptyPage } from '../features/bookshelf/BookshelfEmptyPage';
import { BookshelfShell } from '../features/bookshelf/BookshelfShell';
import { BookshelfStatusContent } from '../features/bookshelf/BookshelfStatusContent';
import { LocalBookDetail } from '../features/bookshelf/LocalBookDetail';
import {
  LocalImportDialog,
  type LocalImportDialogState,
} from '../features/bookshelf/LocalImportDialog';
import type {
  LocalImportBatch,
} from '../features/bookshelf/LocalBookImportGateway';
import type {
  ReadingCommit,
} from '../features/reading/LocalReadingExperience';
import {
  ReaderBookmarkAnchorRequest,
  ReaderRetainedPresentation,
  readerEntryPresentation,
} from '../features/reading/LocalReadingExperience';
import { ReaderShell } from '../features/shell/ReaderShell';
import { BookDirectoryPage } from '../features/bookshelf/BookDirectoryPage';
import { backfillRetainedReaderDirectoryNavigation, readerDirectoryObserveMissingNavigation,
  readerDirectoryTakeMissingNavigation } from '../features/reading/ReaderDirectoryNavigation';
import {
  type LocalReadingTocEntry,
} from '../features/reading/LocalReadingFlowGateway';
import type { ReadingBookDetail } from '../features/reading/ReadingBookDetail';
import type { BookAcquisitionCandidate, BookAcquisitionChange } from '../app/BookAcquisitionCoordinator';
import type { BookAcquisitionDetailProjection } from '../app/BookAcquisitionProjectionGateway';
import { ReadingEntryHost, type ReadingEntrySnapshot, type ReadingEntryLease, type ReadingPreparationContext, type ReadingSharedShelfSeeds } from '../features/reading/ReadingEntryHost';
import type { BookshelfCatalogProgress } from '../features/bookshelf/BookshelfCatalogUpdate';
import type { RemoteReadingIdentity } from '../features/reading/RemoteReadingContract';
import { searchCandidateRank } from '../features/search/SearchCandidatePolicy';
import {
  RemoteChapterCacheRefreshError,
  RemoteReadingFlowGateway,
  type RemoteReadingBookSeed,
  type RemoteReadingSession,
  type RemoteReadingTocEntry,
} from '../features/reading/RemoteReadingFlowGateway';
import { ReadingSessionFlowGateway } from '../features/reading/ReadingSessionFlowGateway';
import { sameRemoteSessionEvidence } from '../features/reading/RemoteReadingEvidence';
import type { RemoteReadingPositionContext } from '../features/reading/RemoteReadingPositionMigration';
import type { ReadingSessionChapter } from '../features/reading/ReadingChapterWindow';
import type { ReadingEntrySeed } from '../features/reading/ReadingEntryPreparation';
import { ReadingOfflineHost, type ReadingOfflineBinding, type ReadingOfflineOperation } from '../features/reading/ReadingOfflineHost';
import { ReaderDirectoryHost, type ReaderDirectoryBinding, type ReaderDirectoryOperation } from '../features/reading/ReaderDirectoryHost';
import { BookmarkOperationIntentStore, CacheClearOperationIntentStore } from '../features/reading/ReadingOperationIntents';
import { readingDirectoryRecovery, EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../features/reading/ReadingDirectoryRecovery';
import { ReadingPrefetchHost, type ReadingPrefetchLease } from '../features/reading/ReadingPrefetchHost';
import type { ReadingOfflineBookProgress } from '../features/reading/ReadingOfflineGateway';
import {
  isRemoteSourceFailureKind,
  type RemoteContentVerdict,
  type RemoteReadingFailureKind,
} from '../features/reading/RemoteContentAdmission';
import type {
  ReaderBookIdentity,
} from '../features/reading/ReaderBookmarkProjection';
import {
  isRemoteReadingCacheFallbackEligible,
  RemoteReadingGatewayError,
  remoteReadingFailureRecord,
  type RemoteReadingVariable,
} from '../features/reading/RemoteReadingContract';
import type {
  ReaderDirectoryChapterStartBookmarkRequest,
  ReaderPageBookmarkToggleRequest,
} from '../features/reading/ReaderDirectoryMarkerState';
import type {
  SearchBook,
} from '../features/search/SearchGateway';
import {
  SearchPage,
} from '../features/search/SearchPage';
import {
  RssGateway,
  type RssItem,
  type RssSourceExportResult,
  type RssSourceImportResult,
  type RssSubscription,
} from '../features/rss/RssGateway';
import {
  RssEntryDetailPage,
  type RssFavoritePresentation,
} from '../features/rss/RssEntryDetailPage';
import {
  RssSourceFeedPage,
} from '../features/rss/RssSourceFeedPage';
import {
  RssSubscriptionManagementPage,
  type RssSubscriptionManagementItem,
} from '../features/rss/RssSubscriptionManagementPage';
import { RssSubscriptionEditorPage } from '../features/rss/RssSubscriptionEditorPage';
import {
  EMPTY_RSS_EDITOR_SNAPSHOT,
  RssSubscriptionEditorOrchestrator,
  type RssSourceTextField,
  type RssSubscriptionEditorSnapshot,
} from '../features/rss/RssSubscriptionEditorOrchestrator';
import {
  RssOrchestrator,
  type RssEntrySnapshot,
  type RssManagementOperationProjection,
  type RssSourceSnapshot,
} from '../features/rss/RssOrchestrator';
import { projectOperationFacts, type OperationFacts } from '../app/ReaderOperationFacts';
import {
  RssPage,
  type RssMode,
  type RssPresentation,
} from '../features/rss/RssPage';
import { SettingsPage, type SettingsSnapshot } from '../features/settings/SettingsPage';
import { SettingsHost } from '../features/settings/SettingsHost';
import type { SettingsOperationProjection, SettingsCacheCleanupSnapshot } from '../features/settings/SettingsHost';
import { SettingsGateway } from '../features/settings/SettingsGateway';
import { RulesManagementPage } from '../features/settings/RulesManagementPage';
import {
  EMPTY_RULES_MANAGEMENT_SNAPSHOT,
  RulesManagementOrchestrator,
  type RulesManagementSnapshot,
} from '../features/settings/RulesManagementOrchestrator';
import type {
  DictRuleDraft,
  ManagedRuleSubscription,
  ReplaceRuleDraft,
  RuleSubscriptionDraft,
  TxtTocRuleDraft,
} from '../features/settings/RulesManagementGateway';
import type { BookSource } from '../features/source/SourceGateway';
import { readerSourceCategoryIsText, readerSourceCategoryLabel } from '../features/source/ReaderSourceCategory';
import {
  SourceHost,
  type SourceImportCompletion,
  type SourceManagementStatusKind,
  type SourceManagementProjection,
} from '../features/source/SourceHost';
import {
  type SourceSwitchCandidate,
  type SourceSwitchProbeQuery,
} from '../features/source/SourceSwitchGateway';
import { SourceSwitchHost, type SourceSwitchContext, type SourceSwitchSnapshot,
  type SourceSwitchLease, type SourceSwitchEffect, type SourceSwitchAnchor, type SourceSwitchPendingTransaction } from '../features/source/SourceSwitchHost';
import { SourceManagementPage } from '../features/source/SourceManagementPage';
import { SourceToolsPage } from '../features/source/SourceToolsPage';
import {
  EMPTY_SOURCE_TOOLS_SNAPSHOT,
  SourceToolsOrchestrator,
  type SourceToolsSnapshot,
} from '../features/source/SourceToolsOrchestrator';
import { SourceSwitchPanel } from '../features/reading/SourceSwitchPanel';
import type { SourceSwitchPanelState } from '../features/reading/SourceSwitchPanel';
import { SyncPage } from '../features/sync/SyncPage';
import type { SyncSnapshot } from '../features/sync/SyncGateway';
import { SyncOrchestrator } from '../features/sync/SyncOrchestrator';
import { hilog } from '@kit.PerformanceAnalysisKit';
import deviceInfo from '@ohos.deviceInfo';
import { ArkWebExecutionHost } from '../app/ArkWebExecutionHost';
import { JsonImportDialog } from '../features/common/JsonImportDialog';
import { ReaderDialogSurface } from '../features/common/ReaderDialogSurface';
import { isReaderProductSurfaceEnabled } from '../app/ReaderProductScope';
import { TOK_GREEN, TOK_INK, TOK_MUTED, TOK_ON_PRIMARY } from '../features/common/ReaderTokens';

const DOMAIN = 0x5244;
const IMPORT_PRESENTATION_KEY = LOCAL_IMPORT_PRESENTATION_KEY;
const LOCAL_SOURCE_ID = 'local';
const CATALOG_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

type ReaderRoute = 'bookshelf' | 'discover' | 'detail' | 'reading' | 'directory' | 'search' |
  'bookshelfManagement' | 'bookshelfMultiSelect' | 'bookshelfSettings' |
  'rss' | 'rssSubscriptionManagement' | 'rssSourceFeed' | 'rssEntryDetail' |
  'rssSubscriptionEditor' | 'settings' | 'rulesManagement' | 'source' | 'sourceTools' | 'sync';
type PreparedReaderRoute = 'reading' | 'directory';
type DirectoryReturnTarget = 'detail' | 'readerControl';
type RssDetailReturnTarget = 'rss' | 'rssSourceFeed';
type RssSourceFeedReturnTarget = 'rss' | 'rssSubscriptionManagement';
type JsonImportContext = 'bookSource' | 'ruleBundle' | 'rssMerge' | 'rssReplace';
type RulesManagementReturnTarget = 'settings' | 'reader';
type DetailReturnRoute = 'bookshelf' | 'search';
type SourceManagementReturnTarget = 'settings' | 'search';

type TemporaryBackScope = 'bookshelf' | 'settings' | 'source';
interface TemporaryBackLease {
  scope: TemporaryBackScope;
  generation: number;
  owner: ReaderRuntimeOwner;
  identity: string;
  handler: () => boolean;
}

type BookshelfBackgroundSeeds = BookshelfCatalogSeeds;

/** Chinese one-liner for a book-source failure kind (user confirmation UI). */
function remoteSourceFailureSummary(kind: RemoteReadingFailureKind): string {
  switch (kind) {
    case 'SOURCE_HTTP_FAILED':
      return '网络请求失败';
    case 'SOURCE_PARSE_FAILED':
      return '书源解析失败';
    case 'SOURCE_TOC_EMPTY':
      return '目录为空';
    case 'SOURCE_CONTENT_EMPTY':
      return '正文为空';
    case 'SOURCE_PAYWALL':
      return '该章节需要付费';
    case 'SOURCE_AUTH_REQUIRED':
      return '该源需要登录或验证';
    default:
      return '正文加载失败';
  }
}

class ReaderNavigationBackfillFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

let sourceToolsIndexInstance: number = 0;
let rssIndexInstance: number = 0;

@Entry
@Component
struct Index {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  private shelfEntryTraceAttempt: number = 0;
  private shelfEntryTraceStartedAt: number = -1;
  private shelfEntryTraceGeneration: number = -1;
  private startupEntryId: number = 0;
  @State private readingReadyGeneration: number = 0;
  private navigationBackfillAttempted: Set<string> = new Set<string>();
  private navigationBackfillObservedKey: string = '';
  private navigationBackfillObserverDisposer: (() => void) | undefined;
  @State private shelfOperation: BookshelfOperationSnapshot = EMPTY_BOOKSHELF_OPERATION_SNAPSHOT;
  private shelfOperationOwner: ReaderRuntimeOwner | undefined;
  private shelfReceiptRetired: boolean = false;
  private nativeAlertOwner: ReaderNativeAlertOwner = new ReaderNativeAlertOwner();
  @State private editingShelfGroupBook: ShelfBook | undefined = undefined;
  @State private editingShelfGroupBusy: boolean = false;
  @State private editingShelfGroupPresentation: number = 0;
  private bookshelfSettingsReturnRoute: 'bookshelf' | 'settings' = 'bookshelf';
  @State private shelfBooks: ShelfBook[] = [];
  @StorageLink('readerBookshelfReadingFilter') private shelfReadingFilter: string = 'all';
  @StorageLink('readerBookshelfSourceFilter') private shelfSourceFilter: string = 'all';
  @State private shelfProjectionRevision: string = '';
  @State private shelfHasOnlineBooks: boolean = false;
  private shelfMatchedTotal: number = 0;
  private shelfPageLoading: boolean = false;
  private shelfWindowOffset: number = 0;
  @State private bookshelfSelectionBooks: ShelfBook[] = [];
  @State private bookshelfSelectionReady: boolean = false;
  @State private continueReading: ShelfBook | undefined = undefined;
  @State private isBookshelfVisualAdmitted: boolean = false;
  @State private isCoreShelfEmpty: boolean = false;
  // SHF-03: manual shelf-wide update sweep progress, mirrored on the page.
  @State private bookshelfUpdateRunning: boolean = false;
  @State private bookshelfUpdateDone: number = 0;
  @State private bookshelfUpdateTotal: number = 0;
  @State private bookshelfCatalogFacts: OperationFacts<BookshelfCatalogProgress> | undefined = undefined;
  private bookshelfCatalogHost: BookshelfCatalogOwner | undefined;
  private bookshelfCatalogBinding: BookshelfCatalogBinding | undefined;
  private bookshelfCatalogOwner: ReaderRuntimeOwner | undefined = undefined;
  private bookshelfCatalogReadbackFailed: boolean = false;
  @State private bookshelfManagementSnapshot: BookshelfManagementSnapshot =
    EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT;
  @State private bookshelfMultiSelectInitialKey: string = '';
  @State @Watch('onSearchVisibilityChanged') private route: ReaderRoute = 'bookshelf';
  @StorageLink('readerAppForeground') @Watch('onSearchVisibilityChanged') private searchAppForeground: boolean = true;
  @State private jsonImportVisible: boolean = false;
  @State private jsonImportGeneration: number = 0;
  @State private jsonImportContext: JsonImportContext = 'bookSource';
  @State private detailBook: ReadingBookDetail | undefined = undefined;
  @State private detailToc: LocalReadingTocEntry[] = [];
  @State private detailInBookshelf: boolean = true;
  @State private detailLoadingMessage: string = '';
  /** The visible page that owns entry, exit and first-page failure recovery. */
  private readingOriginRoute: 'bookshelf' | 'detail' = 'detail';
  @State private shelfReadingPreparation: boolean = false;
  @State private remoteReadingSession: RemoteReadingSession | undefined = undefined;
  @State private remoteReadingSeed: RemoteReadingBookSeed | undefined = undefined;
  /** Detail-area diagnostics; never a navigation admission gate. */
  @State private remoteContentVerdict: RemoteContentVerdict = 'readable';
  private remoteCacheNoticeGeneration: number = -1;
  /** Projected domain token, never a second session/probe owner. */
  private remoteSessionGeneration: number = 0;
  private readingEntryHost: ReadingEntryHost | undefined;
  private readingEntryScopeId: number = -1;
  private pendingRemoteDirectoryProjection: (() => void) | undefined = undefined;
  private pendingLocalDirectoryProjection: (() => void) | undefined = undefined;
  @State private requestedChapterIndex: number | undefined = undefined;
  // 书签 tab 精确锚点: 每次点击递增 requestId, 保证 @Prop @Watch 对连续点击的
  // 同值/等值请求都能重新触发 (deep-equal 相同的两个对象也会下发新实例)。
  @State private requestedBookmarkAnchor: ReaderBookmarkAnchorRequest | undefined = undefined;
  private bookmarkAnchorRequestId: number = 0;
  @State private preparedReaderRoute: PreparedReaderRoute = 'reading';
  @State private directoryCurrentChapterIndex: number = -1;
  @State private directoryChapterTitle: string = '';
  @State private directoryReturnTarget: DirectoryReturnTarget = 'detail';
  @State private searchPublicationRevision: number = 0;
  @State private rssFeedRead: OperationFacts<RssSubscription[]> = projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  @State private rssSourceOperation: RssRouteOperationProjection<RssSourceSnapshot> | undefined = undefined;
  @State private rssSourceRead: OperationFacts<RssSourceSnapshot> = projectOperationFacts<RssSourceSnapshot>({ phase: 'idle' });
  @State private rssEntryOperation: RssRouteOperationProjection<RssEntrySnapshot> | undefined = undefined;
  @State private rssEntryRead: OperationFacts<RssEntrySnapshot> = projectOperationFacts<RssEntrySnapshot>({ phase: 'idle' });
  private rssEditorNavigationGeneration: number = 0;
  @State private rssPresentation: RssPresentation = { kind: 'feed', subscriptions: [], recentUnread: [] };
  @State private rssManagementOperation: RssManagementOperationProjection | undefined = undefined;
  @State private rssManagementRead: OperationFacts<RssSubscription[]> =
    projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
  @State private selectedRssSubscription: RssSubscription | undefined = undefined;
  @State private selectedRssItems: RssItem[] = [];
  @State private selectedRssItem: RssItem | undefined = undefined;
  @State private selectedRssFavoriteState: RssFavoritePresentation = 'loading';
  @State private rssDetailReturnTarget: RssDetailReturnTarget = 'rss';
  @State private rssSourceFeedReturnTarget: RssSourceFeedReturnTarget = 'rss';
  @State private rssManagementFocusSubscriptionId: string = '';
  @State private rssEditorSnapshot: RssSubscriptionEditorSnapshot = EMPTY_RSS_EDITOR_SNAPSHOT;
  @State private sourceSources: BookSource[] = [];
  @State private sourceStatusKind: SourceManagementStatusKind = 'idle';
  @State private sourceStatusMessage: string = '';
  @State private sourceOperation: SourceManagementProjection = { action: 'load', sourceId: '' };
  @State private settingsOperation: SettingsOperationProjection = { action: 'load' };
  @State private settingsCacheCleanup: SettingsCacheCleanupSnapshot | undefined = undefined;
  @State private sourceToolsSnapshot: SourceToolsSnapshot = EMPTY_SOURCE_TOOLS_SNAPSHOT;
  @State private rulesManagementSnapshot: RulesManagementSnapshot = EMPTY_RULES_MANAGEMENT_SNAPSHOT;
  @State private discoverPresentation: DiscoverPresentation = EMPTY_DISCOVER_PRESENTATION;
  @State private settingsSection: 'home' | 'general' = 'home';
  @State private settingsSnapshot: SettingsSnapshot = {
    autoCheckUpdate: true,
    tapBottomScrollTop: true,
    reduceMotion: false,
    crashLog: true,
  };
  private applicationSettingsSnapshot: SettingsSnapshot | undefined = undefined;
  private applicationSettingsUnsubscribe: (() => void) | undefined = undefined;
  @State private syncSnapshot: SyncSnapshot = {
    webdavUrl: '',
    webdavUser: '',
    webdavPass: '',
    backupPass: '',
    webdavPath: '/ReaderBackup/ReaderHarmony',
    saveLocation: 'WebDAV',
    backupFrequency: '手动',
    backupScope: '配置数据（不含离线书籍和正文，AES 加密）',
    history: [],
    statusMessage: '',
  };
  @State private syncSnapshotReady: boolean = false;
  /** Source-switch overlay presentation + the gateway that drives it. */
  @State private sourceSwitchVisible: boolean = false;
  @State private sourceSwitchState: SourceSwitchPanelState = { kind: 'discovering' };
  @State private sourceSwitchFailureMessage: string = '';
  @State private sourceSwitchScopeId: number = 0;
  private sourceSwitchHost: SourceSwitchHost | undefined;
  private searchDetailCandidates: SearchBook[] = [];
  /** Retained until the target chapter's first measured progress commit. */
  private pendingSourceSwitch: SourceSwitchPendingTransaction | undefined = undefined;
  /** The original reader owns loading, layout, errors and first-page commit. */
  @State private readingSessionActive: boolean = false;
  @State private navigationGeneration: number = 0;
  /** Display DTOs only; domain owners retain mutex, dispatch, receipts and generations. */
  @State private directoryOperation: ReaderDirectoryOperation | undefined = undefined;
  @State private offlineOperation: ReadingOfflineOperation | undefined = undefined;
  @State private offlineOperationActive: boolean = false;
  @State private directoryPresentationGeneration: number = 0;
  /** Serializes the destructive detail-page removal for one exact book. */
  @State private detailShelfAdmissionMount: number = 0;
  @State private readableAdmissions: BookshelfReadableAdmissionSnapshot[] = [];
  @State private bookRemovalMessage: string = '';
  private bookRemovalDialogOpen: boolean = false;
  private bookRemovalConfirmAction: (() => void) | undefined = undefined;
  private bookRemovalPresentation: number = 0;
  private bookRemovalDialogController: CustomDialogController | undefined;
  /** Read generation DTO; the feature-local projection owner owns admission. */
  private bookshelfLoadGeneration: number = 0;
  /**
   * The latest bookshelf read failed. On the un-admitted blank home this
   * surfaces a persistent retry entry (a dismissed dialog would leave the
   * session unrecoverable); a successful load always clears it.
   */
  @State private bookshelfLoadFailed: boolean = false;
  @State private bookshelfReadFacts: OperationFacts<BookshelfDataState> | undefined = undefined;
  private bookshelfReadOwner: ReaderRuntimeOwner | undefined = undefined;
  private bookshelfProjectionOwner: BookshelfProjectionOwner | undefined;
  private bookshelfProjectionBinding: BookshelfProjectionBinding | undefined;
  private bookshelfReadNavigation: number = 0;
  private bookshelfBackgroundRefreshRunning: boolean = false;
  /** The automatic catalog scan can also supply the idle preparation's identities for this shelf revision. */
  private bookshelfBackgroundSeeds: BookshelfBackgroundSeeds | undefined;
  private bookProjectionUnsubscribe: (() => void) | undefined = undefined;
  private searchHost: SearchHost = new SearchHost(
    (): void => { this.searchPublicationRevision += 1; },
    (): boolean => this.route === 'search' && this.searchAppForeground,
  );
  private readonly bookshelfViewState: BookshelfViewState = new BookshelfViewState();
  /** Bounded, process-local single-flight only; Core remains the durable cache. */
  private discoverOrchestrator: DiscoverOrchestrator | undefined;
  private discoverPresentationIdentity: string = '';
  private bookshelfManagementPresentationIdentity: string = '';
  private bookshelfHost: BookshelfHost = new BookshelfHost(
    (snapshot: BookshelfManagementSnapshot): void => {
      this.bookshelfManagementSnapshot = snapshot;
    },
    (): boolean => this.route === 'bookshelfManagement',
    undefined,
    (snapshot: BookshelfOperationSnapshot, owner: ReaderRuntimeOwner): void => {
      if (!this.isCurrentRuntime(owner)) return;
      // AppStorage is a platform adapter only. The feature owner creates,
      // validates and atomically serializes its state/result.
      AppStorage.setOrCreate<string>(IMPORT_PRESENTATION_KEY, snapshot.importSerialized);
      if (this.shelfReceiptRetired) return;
      if (snapshot.receipt !== undefined && (this.shelfOperation.receipt === undefined || this.shelfOperation.generation !== snapshot.generation))
        this.invalidateBookshelfProjection();
      const presentImportResult = snapshot.action === 'import' && snapshot.importPresentation?.state === 'result' &&
        (this.shelfOperation.importPresentation?.state !== 'result' || this.shelfOperation.receipt !== snapshot.receipt) &&
        this.route === 'bookshelf' && snapshot.filter.readingState === this.shelfReadingFilter && snapshot.filter.sourceKind === this.shelfSourceFilter;
      this.shelfOperationOwner = owner; this.shelfOperation = snapshot;
      if (presentImportResult && snapshot.receipt?.value !== undefined) this.applyBookshelfState(snapshot.receipt.value);
    },
    (snapshots: BookshelfReadableAdmissionSnapshot[], owner: ReaderRuntimeOwner): void => {
      if (!this.shelfReceiptRetired && this.isCurrentRuntime(owner)) this.readableAdmissions = snapshots;
    },
  );
  private settingsPresentationIdentity: string = '';
  private settingsHost: SettingsHost = new SettingsHost(
    (snapshot: SettingsSnapshot): void => {
      if (this.isCurrentSettingsPresentation(this.navigationGeneration, this.mountedRuntimeOwner,
        this.detailShelfAdmissionMount, this.settingsHost,
        this.route === 'bookshelfSettings' ? 'bookshelfSettings' : 'settings', this.settingsPresentationIdentity, false)) this.settingsSnapshot = snapshot;
    },
    (): SettingsSnapshot => this.settingsSnapshot,
    (): boolean => this.route === 'settings' || this.route === 'bookshelfSettings',
    undefined,
    (operation: SettingsOperationProjection): void => {
      if (this.isCurrentSettingsPresentation(this.navigationGeneration, this.mountedRuntimeOwner,
        this.detailShelfAdmissionMount, this.settingsHost,
        this.route === 'bookshelfSettings' ? 'bookshelfSettings' : 'settings', this.settingsPresentationIdentity, false)) this.settingsOperation = operation;
    },
    (snapshot: SettingsCacheCleanupSnapshot, owner: ReaderRuntimeOwner): void => {
      if (this.isCurrentRuntime(owner) && this.route === 'settings') this.settingsCacheCleanup = snapshot;
    },
  );
  private rulesManagementOrchestrator: RulesManagementOrchestrator | undefined;
  private rulesPresentationIdentity: string = '';
  private syncOrchestrator: SyncOrchestrator | undefined;
  private syncPresentationIdentity: string = '';
  private mountedRuntimeOwner: ReaderRuntimeOwner | undefined;
  private temporaryBackLease: TemporaryBackLease | undefined;
  private sourcePresentationIdentity: string = '';
  private sourceHost: SourceHost = new SourceHost(
    (sources: BookSource[]): void => { if (this.isCurrentSourceManagement(this.navigationGeneration, this.mountedRuntimeOwner,
      this.detailShelfAdmissionMount, this.sourceHost, this.sourcePresentationIdentity)) this.sourceSources = sources; },
    (): boolean => this.route === 'source',
    (kind: SourceManagementStatusKind, message: string): void => {
      if (this.isCurrentSourceManagement(this.navigationGeneration, this.mountedRuntimeOwner,
        this.detailShelfAdmissionMount, this.sourceHost, this.sourcePresentationIdentity)) {
        this.sourceStatusKind = kind; this.sourceStatusMessage = message;
      }
    },
    undefined,
    (operation: SourceManagementProjection): void => { if (this.isCurrentSourceManagement(this.navigationGeneration, this.mountedRuntimeOwner,
      this.detailShelfAdmissionMount, this.sourceHost, this.sourcePresentationIdentity)) this.sourceOperation = operation; },
  );
  private sourceToolsOrchestrator: SourceToolsOrchestrator | undefined;
  private readonly sourceToolsInstanceIdentity: number = ++sourceToolsIndexInstance;
  private sourceToolsPresentationIdentity: string = '';
  private rssOrchestrator: RssOrchestrator | undefined;
  private readonly rssInstanceIdentity: number = ++rssIndexInstance;
  private rssPresentationIdentity: string = '';
  private rssEditorPresentationIdentity: string = '';
  private rssEditorOrchestrator: RssSubscriptionEditorOrchestrator | undefined;
  /**
   * Installed only by the mounted ReadingSurface.  System Back calls this
   * guarded request so Core position persistence settles before the route is
   * changed back to the bookshelf or explicit Book Detail entry.
   */
  private readingExitRequest: ((intent?: 'navigation') => void) | undefined = undefined;
  private systemFileOpenNavigation: ReaderSystemFileOpenNavigationHost | undefined;
  /** A Back press during hidden first-page preparation still exits serially. */
  private exitToDetailOriginAfterReader: boolean = false;
  private bookInfoAfterReaderExit: string | undefined = undefined;
  /** A failure-dialog action waits for the reader's serialized exit before changing route. */
  private openRulesManagementAfterReaderExit: boolean = false;
  private rulesManagementReturnTarget: RulesManagementReturnTarget = 'settings';
  /** Detail is reachable from both the shelf and search results; Back follows the entry origin. */
  private detailReturnRoute: DetailReturnRoute = 'bookshelf';
  /** P0 add-source flow: how the Source Management page was entered. */
  private sourceManagementReturnTarget: SourceManagementReturnTarget = 'settings';
  /**
   * Keyword of the search that led into Source Management. Survives the trip
   * so the post-import dialog can offer "用新书源搜索「kw」" and the return
   * can restore it; never enters Core or persistent reader data.
   */
  private sourceManagementSearchKeyword: string = '';
  // DocumentViewPicker can rebuild this page while the actual Core import is
  // still in flight. One atomic value lives only in AppStorage: it survives
  // page reconstruction in this process but never enters Core or persistent
  // reader data.
  @StorageLink(IMPORT_PRESENTATION_KEY)
  private storedImportPresentation: string = '';

  aboutToAppear(): void {
    this.mountedRuntimeOwner = ReaderRuntimeOwner.current();
    this.settingsCacheCleanup = this.settingsHost.cacheCleanupSnapshot(this.mountedRuntimeOwner);
    this.shelfReceiptRetired = false;
    this.detailShelfAdmissionMount += 1;
    this.bookshelfHost.readable(this.mountedRuntimeOwner);
    // Index is mounted after configuration recovery. Reading these settings
    // inside that recovery barrier itself would recursively wait on it.
    this.applicationSettingsUnsubscribe?.();
    const settings = new SettingsGateway(ReaderRuntimeOwner.current().getUIAbilityContext());
    this.applicationSettingsUnsubscribe = settings.subscribe((snapshot: SettingsSnapshot): void => {
      this.applicationSettingsSnapshot = snapshot;
      if (this.route !== 'settings' && this.route !== 'bookshelfSettings') this.settingsSnapshot = snapshot;
      this.scheduleBookshelfBackgroundRefresh(this.shelfBooks);
    });
    void settings.load().catch((): void => {});
    this.bookProjectionUnsubscribe?.();
    this.bookProjectionUnsubscribe = ReaderRuntimeOwner.current().bookAcquisitions().subscribe((change: BookAcquisitionChange): void => {
      if (change.shelfChanged === true) {
        this.refreshBookshelf();
        this.refreshSearchShelfMembership();
      }
      const book = this.detailBook;
      if (change.reset || (book !== undefined && change.identities.some((identity: RemoteReadingIdentity): boolean =>
        identity.sourceId === book.sourceId && identity.bookId === book.bookId))) {
        void this.refreshDetailAcquisitionProjection();
      }
    });
    this.reconcileImportPresentation();
    // Shelf projection is safe to show immediately. Source-switch recovery
    // reconciles in parallel and triggers its own refresh only when it
    // actually rolls a transaction back.
    this.refreshBookshelf();
    void this.reconcilePendingSourceSwitches();
    this.mountSystemFileOpenNavigation(this.mountedRuntimeOwner);
  }

  aboutToDisappear(): void {
    this.retireSettingsPresentation();
    this.retireSourceManagementPresentation();
    this.temporaryBackLease = undefined;
    this.nativeAlertOwner.retire();
    this.shelfReceiptRetired = true;
    this.retireBookshelfCatalogPresentation();
    this.bookshelfHost.detachManagementPresentation();
    this.bookshelfManagementPresentationIdentity = '';
    this.discoverOrchestrator?.detachPresentation(this.discoverPresentationIdentity);
    this.discoverPresentationIdentity = '';
    this.rulesManagementOrchestrator?.detachPresentation(this.rulesPresentationIdentity);
    this.rulesPresentationIdentity = '';
    this.syncOrchestrator?.detachPresentation(this.syncPresentationIdentity);
    this.syncPresentationIdentity = '';
    this.bookshelfUpdateRunning = false;
    this.bookshelfBackgroundRefreshRunning = false;
    this.dismissBookRemovalDialog();
    this.bookshelfProjectionOwner?.detach(this.bookshelfProjectionBinding?.identity ?? '');
    this.bookshelfProjectionBinding = undefined;
    this.bookshelfHost.detachOperationPresentation();
    this.bookshelfHost.detachReadablePresentation();
    this.navigationBackfillObserverDisposer?.();
    this.navigationBackfillObserverDisposer = undefined;
    this.navigationBackfillObservedKey = '';
    this.sourceToolsOrchestrator?.detachPresentation(this.sourceToolsPresentationIdentity);
    this.sourceToolsPresentationIdentity = '';
    this.retireRssEditorPresentation();
    this.retireRssPresentation();
    this.retireReadingEntryPresentation();
    this.systemFileOpenNavigation?.dispose();
    this.systemFileOpenNavigation = undefined;
    this.applicationSettingsUnsubscribe?.();
    this.applicationSettingsUnsubscribe = undefined;
    this.applicationSettingsSnapshot = undefined;
    this.bookProjectionUnsubscribe?.();
    this.bookProjectionUnsubscribe = undefined;
    this.retireSourceSwitchPresentation();
    this.searchHost.close();
    // Retire resources only in the owner captured when this Index mounted.
    // An unavailable/replacement runtime owns its own cleanup and must never
    // receive the retiring page's endSearch/pause commands.
    const owner = this.mountedRuntimeOwner;
    this.mountedRuntimeOwner = undefined;
    if (this.isCurrentRuntime(owner) && owner !== undefined) {
      owner.bookAcquisitions().endSearch();
      owner.readingEntryPreparations().setPaused(true);
    }
  }

  onBackPress(): boolean {
    if (this.bookRemovalDialogOpen) {
      this.dismissBookRemovalDialog();
      return true;
    }
    if (this.jsonImportVisible) {
      this.dismissJsonImport();
      return true;
    }
    if (this.sourceSwitchVisible) {
      // The detail/reading overlay must win over the route-specific exit
      // branch so Back only closes the source-switch panel.
      this.sourceSwitchHost?.consumeBack(this.sourceSwitchScopeId);
      return true;
    }
    if (this.hasVisibleImportDialog()) {
      this.closeImportDialog();
      return true;
    }
    if (this.editingShelfGroupBook !== undefined) {
      if (!this.editingShelfGroupBusy) this.closeShelfGroup();
      return true;
    }
    if (this.consumeTemporaryBackBridge()) return true;
    if (this.route === 'bookshelf' && this.shelfReadingPreparation) {
      // As in closeSourceSwitch, a durable source move must finish its first
      // page or rollback before navigation can abandon the transaction.
      if (this.detailBook !== undefined && this.sourceSwitchHost?.blocksExit(this.detailBook) === true) return true;
      // Cancel admission immediately; a hidden reader still settles its own
      // pending progress write through the existing serialized exit.
      this.nextNavigationGeneration();
      const requestExit = this.readingExitRequest;
      if (this.readingSessionActive && requestExit !== undefined) {
        this.exitToDetailOriginAfterReader = true;
        requestExit();
      } else {
        this.returnToBookshelf();
      }
      return true;
    }
    if (this.route === 'rssEntryDetail') {
      this.returnFromRssEntryDetail();
      return true;
    }
    if (this.route === 'rssSourceFeed') {
      this.returnFromRssSourceFeed();
      return true;
    }
    if (this.route === 'rssSubscriptionManagement') {
      this.returnToRss();
      return true;
    }
    if (this.route === 'rssSubscriptionEditor') {
      this.returnToRssSubscriptionManagement();
      return true;
    }
    if (this.route === 'sourceTools') {
      this.returnToSourceManagement();
      return true;
    }
    if (this.route === 'rulesManagement') {
      this.returnFromRulesManagement();
      return true;
    }
    if (this.route === 'bookshelfSettings') {
      this.returnFromBookshelfSettings();
      return true;
    }
    if (this.route === 'bookshelfManagement') {
      this.returnToBookshelf();
      return true;
    }
    if (this.route === 'bookshelfMultiSelect') {
      if (!this.shelfOperation.batchRemovalBusy) {
        this.returnToBookshelf();
      }
      return true;
    }
    if (this.route === 'settings' && this.settingsSection === 'general') {
      this.settingsSection = 'home';
      return true;
    }
    if (this.route === 'search' || this.route === 'rss' || this.route === 'settings' ||
      this.route === 'discover') {
      this.returnToBookshelf();
      return true;
    }
    if (this.route === 'source') {
      this.returnFromSourceManagement();
      return true;
    }
    if (this.route === 'sync') {
      this.returnToSettings();
      return true;
    }
    if (this.route === 'directory') {
      this.closeDirectory();
      return true;
    }
    if (this.route === 'reading') {
      const requestExit = this.readingExitRequest;
      if (requestExit !== undefined) {
        requestExit();
      } else {
        // The component has not mounted its guarded request yet. There is no
        // materialized page anchor to persist in that narrow interval.
        this.returnToReadingOrigin();
      }
      return true;
    }
    if (this.route === 'detail') {
      if (this.readingSessionActive) {
        // The user is still looking at Detail while its hidden reader is
        // preparing.  Let that same instance invalidate/settle its work
        // before changing a second route under it.
        const requestExit = this.readingExitRequest;
        if (requestExit !== undefined) {
          this.exitToDetailOriginAfterReader = true;
          requestExit();
        } else {
          this.returnFromDetail();
        }
        return true;
      }
      this.returnFromDetail();
      return true;
    }
    return false;
  }

  @Builder
  private bookshelfContent(generation: number = this.navigationGeneration, owner: ReaderRuntimeOwner | undefined = this.mountedRuntimeOwner,
    mounting: number = this.detailShelfAdmissionMount) {
    if (this.isBookshelfVisualAdmitted) {
      BookshelfPage({
        navigationGeneration: this.navigationGeneration,
        viewState: this.bookshelfViewState,
        books: this.shelfBooks,
        serverFiltered: this.shelfProjectionRevision.length > 0,
        onNextPageRequested: (presentedNavigation?: number): void => { if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) this.loadNextShelfPage(); },
        onPreviousPageRequested: (presentedNavigation?: number): void => { if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) this.loadPreviousShelfPage(); },
        onFilterRequested: (readingState: string, sourceKind: string, presentedNavigation?: number): void => {
          if (!this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) return;
          this.shelfReadingFilter = readingState; this.shelfSourceFilter = sourceKind;
          this.bookshelfViewState.anchorKey = ''; this.bookshelfViewState.anchorOffset = 0;
          this.refreshBookshelf();
        },
        continueReading: this.continueReading,
        reduceMotion: this.settingsSnapshot.reduceMotion,
        onRssRequested: (presentedNavigation?: number): void => { if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) this.openRss(); },
        onSettingsRequested: (presentedNavigation?: number): void => { if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) this.openSettings(); },
        onDiscoverRequested: (presentedNavigation?: number): void => { if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) this.openDiscover(); },
        onBookSelected: (book: ShelfBook, presentedNavigation?: number): void => {
          // Native enabled state updates on the next render. Guard only UI
          // taps here; a failed source switch still owns its internal reopen.
          if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting) && !this.shelfReadingPreparation && !this.readingSessionActive) this.openShelfBook(book);
        },
        onVisibleBooksChanged: (books: ShelfBook[], presentedNavigation?: number): void => { if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) this.prepareVisibleReadingBooks(books); },
        onBookMultiSelectRequested: (book: ShelfBook, presentedNavigation?: number): void => { if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) this.openBookshelfMultiSelect(book); },
        onBookInfoRequested: (book: ShelfBook, presentedNavigation?: number): void => { if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) this.openShelfBookInfo(book); },
        onBookGroupRequested: (book: ShelfBook, presentedNavigation?: number): void => { if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) this.openShelfGroup(book); },
        onBookRemoveRequested: (book: ShelfBook, presentedNavigation?: number): void => { if (this.isCurrentBookshelfPresentation(presentedNavigation ?? generation, owner, mounting)) this.requestRemoveShelfBook(book); },
      })
        .enabled(!this.shelfReadingPreparation && !this.readingSessionActive);
    } else if (this.isCoreShelfEmpty) {
      // Core alone admits the true empty shelf. Tablet keeps its phone assembly.
      BookshelfEmptyPage({
        onImportRequested: (): void => { if (this.isCurrentBookshelfPresentation(generation, owner, mounting)) this.openImportDialog(); },
        onSearchRequested: (): void => { if (this.isCurrentBookshelfPresentation(generation, owner, mounting)) this.openSearch(); },
      });
    } else {
      BookshelfStatusContent({
        failed: this.bookshelfLoadFailed,
        reduceMotion: this.settingsSnapshot.reduceMotion,
        onRetry: (): void => { if (this.isCurrentBookshelfPresentation(generation, owner, mounting)) this.refreshBookshelf(); },
      });
    }
  }

  @Builder
  private bookshelfShellContent(owner: ReaderRuntimeOwner | undefined = this.mountedRuntimeOwner,
    navigation: number = this.navigationGeneration, mounting: number = this.detailShelfAdmissionMount) {
    BookshelfShell({
      navigationGeneration: this.navigationGeneration,
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string, generation?: number): void => {
        if (generation !== undefined) this.registerTemporaryBackBridge('bookshelf', generation, owner, handler, identity);
      },
      populated: this.isBookshelfVisualAdmitted,
      recovery: this.shelfRecovery(),
      canContinueRemoval: this.canContinueShelfRemoval(),
      removalActionLabel: this.shelfOperation.removalMutation?.confirmation === 'confirmed' ? '完成原删除清理' : '继续原删除操作',
      onContinueRemoval: (generation: number, presentedNavigation: number): void => {
        if (this.isCurrentBookshelfPresentation(presentedNavigation, owner, mounting)) void this.continueShelfRemoval(generation);
      },
      readRecovery: this.shelfReadRecovery(),
      onRetryRead: (generation: number, presentedNavigation?: number): void => {
        if (this.isCurrentBookshelfPresentation(presentedNavigation ?? navigation, owner, mounting)) this.retryBookshelfRead(generation);
      },
      onReconcile: (generation: number, presentedNavigation?: number): void => {
        if (!this.isCurrentBookshelfPresentation(presentedNavigation ?? navigation, owner, mounting)) return;
        if (generation < 0) void this.reconcileBookshelfCatalogProjection(generation);
        else void this.reconcileShelfWrite(generation);
      },
      reduceMotion: this.settingsSnapshot.reduceMotion,
      canCheckUpdates: this.isBookshelfVisualAdmitted && (this.shelfProjectionRevision.length > 0 ?
        this.shelfHasOnlineBooks : this.shelfBooks.some((book: ShelfBook): boolean => book.sourceId !== 'local')),
      updateRunning: this.bookshelfUpdateRunning,
      backgroundUpdateRunning: this.bookshelfBackgroundRefreshRunning,
      updateProgressDone: this.bookshelfUpdateDone,
      updateProgressTotal: this.bookshelfUpdateTotal,
      onImportRequested: (): void => this.openImportDialog(),
      onSearchRequested: (): void => this.openSearch(),
      onBookshelfSettingsRequested: (): void => this.openBookshelfSettings(),
      onBatchManageRequested: (): void => this.openBookshelfMultiSelect(),
      onCheckUpdatesRequested: (): void => this.startManualBookshelfUpdate(),
      onMainTab: (key: string): void => {
        if (key === 'discover') this.openDiscover();
        else if (key === 'rss') this.openRss();
        else if (key === 'settings') this.openSettings();
      },
    }) {
      this.bookshelfContent();
    }
  }

  @Builder
  private localImportContent() {
    ForEach([this.shelfOperation.importIdentity], (identity: number): void => {
      this.localImportSurface(identity, ReaderRuntimeOwner.current(), this.navigationGeneration);
    }, (identity: number): string => identity.toString());
  }

  @Builder
  private localImportSurface(identity: number, owner: ReaderRuntimeOwner, navigation: number) {
    LocalImportDialog({
      state: this.visibleImportDialogState(),
      batch: this.visibleImportBatch(),
      reduceMotion: this.settingsSnapshot.reduceMotion,
      failureMessage: this.shelfOperation.importFailureMessage,
      recovery: this.shelfOperation.action === 'import' ? this.shelfRecovery() : this.emptyShelfRecovery(),
      onReconcile: (generation: number): void => { if (this.isCurrentImport(identity, navigation, owner)) void this.reconcileShelfWrite(generation); },
      onSelectFiles: (): void => { if (this.isCurrentImport(identity, navigation, owner)) void this.beginImport(); },
      onClose: (): void => { if (this.isCurrentImport(identity, navigation, owner)) this.closeImportDialog(); },
    });
  }

  @Builder
  private discoverPageContent() {
    ForEach([this.navigationGeneration], (generation: number) => {
      this.discoverPageSurface(generation, this.mountedRuntimeOwner, this.detailShelfAdmissionMount, this.discoverOrchestrator);
    }, (generation: number): string => generation.toString());
  }

  @Builder
  private discoverPageSurface(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: DiscoverOrchestrator | undefined) {
    DiscoverPage({
      presentation: this.discoverPresentation,
      isTablet: deviceInfo.deviceType === 'tablet',
      onBack: (): void => { if (this.isCurrentDiscoverPresentation(generation, owner, mounting, host)) this.returnToBookshelf(); },
      onRssRequested: (): void => { if (this.isCurrentDiscoverPresentation(generation, owner, mounting, host)) this.openRss(); },
      onSettingsRequested: (): void => { if (this.isCurrentDiscoverPresentation(generation, owner, mounting, host)) this.openSettings(); },
      onRetryRead: (expected: number): void => { if (this.isCurrentDiscoverPresentation(generation, owner, mounting, host)) host?.retryRead(expected); },
      onRefresh: (): void => { if (this.isCurrentDiscoverPresentation(generation, owner, mounting, host)) host?.refresh(); },
      onCycleSource: (): void => { if (this.isCurrentDiscoverPresentation(generation, owner, mounting, host)) host?.cycleSource(); },
      onSelectKind: (index: number): void => { if (this.isCurrentDiscoverPresentation(generation, owner, mounting, host)) host?.selectKind(index); },
      onPreviousPage: (): void => { if (this.isCurrentDiscoverPresentation(generation, owner, mounting, host)) host?.previousPage(); },
      onNextPage: (): void => { if (this.isCurrentDiscoverPresentation(generation, owner, mounting, host)) host?.nextPage(); },
    });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.route === 'bookshelf') {
        Stack() {
          this.bookshelfShellContent();
        }
        .width('100%')
        .height('100%')
        .enabled(!this.shelfReadingPreparation && !this.readingSessionActive);
      } else if (this.route === 'bookshelfSettings') {
        this.bookshelfSettingsContent();
      } else if (this.route === 'bookshelfMultiSelect') {
        BookshelfMultiSelectPage({
          books: this.bookshelfSelectionBooks,
          ready: this.bookshelfSelectionReady,
          initialSelectedKey: this.bookshelfMultiSelectInitialKey,
          busy: this.shelfOperation.batchRemovalBusy,
          onCancel: (): void => this.returnToBookshelf(),
          onRemoveSelected: (keys: string[]): void => this.requestRemoveShelfBooks(keys),
        });
      } else if (this.route === 'bookshelfManagement') {
        this.bookshelfManagementContent();
      } else if (this.route === 'search') {
        SearchPage({
          viewState: this.searchHost.viewState,
          publication: this.searchHost.publication,
          publicationRevision: this.searchPublicationRevision,
          reduceMotion: this.settingsSnapshot.reduceMotion,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnToBookshelf(),
          onSearch: (keyword: string, scopeSourceIds?: string[]): void =>
            this.performSearch(keyword, scopeSourceIds),
          onStop: (): void => this.stopSearch(),
          onClearHistory: (): void => this.clearSearchHistory(),
          onRetryHistory: (): void => this.searchHost.retryHistory(),
          onSelectResult: (book: SearchBook, variants: SearchBook[]): void =>
            this.onSearchResultSelected(book, variants),
          onVisibleGroups: (groups: SearchBook[][]): void => this.scheduleSearchDetailWarmups(groups),
          onRetry: (): void => this.retrySearch(),
          onManageSources: (): void => this.manageSourcesFromSearch(),
        });
      } else if (isReaderProductSurfaceEnabled('rss') && this.route === 'rss') {
        this.rssPageContent();
      } else if (isReaderProductSurfaceEnabled('rss') && this.route === 'rssSubscriptionManagement') {
        this.rssSubscriptionManagementContent();
      } else if (isReaderProductSurfaceEnabled('rss') && this.route === 'rssSubscriptionEditor') {
        this.rssEditorContent();
      } else if (isReaderProductSurfaceEnabled('rss') && this.route === 'rssSourceFeed' && this.selectedRssSubscription !== undefined) {
        this.rssSourceFeedContent();
      } else if (isReaderProductSurfaceEnabled('rss') && this.route === 'rssEntryDetail' && this.selectedRssSubscription !== undefined &&
        this.selectedRssItem !== undefined) {
        this.rssEntryDetailContent();
      } else if (isReaderProductSurfaceEnabled('discover') && this.route === 'discover') {
        this.discoverPageContent();
      } else if (this.route === 'settings') {
        this.settingsContent();
      } else if (this.route === 'rulesManagement') {
        this.rulesManagementContent();
      } else if (this.route === 'source') {
        this.sourceManagementContent();
      } else if (this.route === 'sourceTools') {
        this.sourceToolsContent();
      } else if (isReaderProductSurfaceEnabled('sync') && this.route === 'sync') {
        if (this.syncSnapshotReady) {
          this.syncContent();
        } else {
          Column() {
            Text('正在读取安全配置…');
          }
          .width('100%')
          .height('100%')
          .justifyContent(FlexAlign.Center)
          .backgroundColor(readerAppColor('app.Index.build.backgroundColor.FFF8F4EC', this.appThemeScheme));
        }
      } else if (this.detailBook !== undefined && (this.route === 'detail' ||
        (this.route === 'directory' && this.directoryReturnTarget === 'detail') ||
        (!this.readingSessionActive && (this.route === 'reading' || this.route === 'directory')))) {
        this.detailContent();
      }
      // Batch 2: the reading session UI (ReadingSurface + control layer +
      // directory + source-switch overlays) is composed by ReaderShell; Index
      // keeps the business state and drives it through props + callbacks.
      if (this.readingSessionActive && this.detailBook !== undefined) {
        ReaderShell({
          bookId: this.detailBook.bookId,
          bookTitle: this.detailBook.title,
          sourceId: this.detailBook.sourceId,
          sourceName: this.detailBook.sourceName,
          bookKind: this.detailBook.kind,
          remoteSession: this.remoteReadingSession,
          remoteBookSeed: this.remoteReadingSeed,
          entryPresentationProvider: (): ReaderRetainedPresentation | undefined =>
            this.detailBook === undefined ? undefined :
              readerEntryPresentation(this.detailBook.sourceId, this.detailBook.bookId),
          sourceSwitchFailureMessage: this.sourceSwitchFailureMessage,
          sourceSwitchScopeId: this.sourceSwitchScopeId,
          onRetryFailedSourceSwitch: (scopeId?: number): void => this.retryFailedSourceSwitch(scopeId),
          onDismissSourceSwitchFailure: (scopeId?: number): void => this.dismissSourceSwitchFailure(scopeId),
          resolveSourceSwitchTransactionId: (sourceId: string, bookId: string): Promise<string | undefined> =>
            this.resolveReaderSourceSwitchTransaction(sourceId, bookId),
          onRemoteSessionReady: (session: RemoteReadingSession): void => this.onRemoteSessionReady(session),
          sourceSwitchTransactionId: this.currentSourceSwitchTransactionId(),
          totalChapters: this.detailToc.length,
          requestedChapterIndex: this.requestedChapterIndex,
          requestedBookmarkAnchor: this.requestedBookmarkAnchor,
          bookmarkIdentity: this.detailBookmarkIdentity(),
          isTablet: deviceInfo.deviceType === 'tablet',
          reduceMotion: this.settingsSnapshot.reduceMotion,
          visible: this.route === 'reading' ||
            (this.route === 'directory' && this.directoryReturnTarget === 'readerControl'),
          route: this.route === 'directory' && this.directoryReturnTarget === 'readerControl' ? 'directory' : 'reading',
          tocEntries: this.detailToc,
          catalogMessage: this.detailLoadingMessage,
          bookmarkLoadMessage: this.controlBookmarkProjectionMessage(),
          directoryCurrentChapterIndex: this.directoryCurrentChapterIndex,
          directoryChapterTitle: this.directoryChapterTitle,
          directoryOpenedFromControl: this.directoryReturnTarget === 'readerControl',
          offlineBookOperationActive: this.offlineOperationActive,
          directoryRecovery: this.directoryRecovery(),
          onReconcileBookmarks: (generation: number, identity: string): void => this.reconcileDirectoryOperation(generation, identity),
          onContinueBookmarks: (generation: number, identity: string): void => this.reconcileDirectoryOperation(generation, identity, true),
          onReconcileOffline: (generation: number, identity: string): void => this.reconcileOfflineOperation(generation, identity),
          onContinueOffline: (generation: number, identity: string): void => this.reconcileOfflineOperation(generation, identity, true),
          chapterStartBookmarkCreationEnabled: true,
          sourceSwitchVisible: this.sourceSwitchVisible,
          sourceSwitchState: this.sourceSwitchState,
          onExitRequestHandler: (requestExit: (intent?: 'navigation') => void): void => {
            this.readingExitRequest = requestExit;
            this.consumeSystemFileOpen();
          },
          onExit: (readerIdentity: string): void => this.onReaderExited(readerIdentity),
          onExitCancelled: (readerIdentity: string): void => this.cancelReaderExitDestination(readerIdentity),
          onOpenBookInfo: (): void => this.requestReaderBookInfo(),
          readingReadyGeneration: this.readingReadyGeneration,
          onReadingReady: (chapterIndex: number, sourceId: string, bookId: string, generation: number): void =>
            this.readingReadyCallback(sourceId, bookId, generation)(chapterIndex),
          onReadingCommitted: (commit: ReadingCommit): void => this.applyReadingCommit(commit),
          onReadingFailure: (sourceId: string, bookId: string, message: string,
            failureKind?: RemoteReadingFailureKind): void =>
            this.onReadingFailure(sourceId, bookId, message, failureKind),
          onChapterCommitted: (chapterIndex: number, chapterTitle: string): void => {
            this.applyDirectoryChapter(chapterIndex, chapterTitle);
          },
          onSelectChapter: (chapterIndex: number): void => this.onDirectoryChapterSelected(chapterIndex),
          onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number,
            positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject): void =>
            this.onDirectoryNavigationTargetSelected(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof),
          onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void =>
            this.onReaderBookmarkSelected(bookmarkId, chapterIndex, chapterOffset, positionScope),
          onDownloadChapter: (chapterIndex: number): void => this.downloadDirectoryChapter(chapterIndex),
          onDownloadBook: (): void => this.downloadDirectoryBook(),
          onClearBookOffline: (): void => this.requestClearDirectoryBookOffline(),
          onDeleteBookmarks: (bookmarkTimes: number[]): void => this.deleteDirectoryBookmarks(bookmarkTimes),
          onDirectoryProjectionChanged: (entries: LocalReadingTocEntry[]): void =>
            this.applyReaderDirectoryProjection(entries),
          onLoadControlBookmarks: (sourceId: string, bookId: string, isCurrent: () => boolean): Promise<void> =>
            this.loadControlBookmarks(sourceId, bookId, isCurrent),
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            this.createDirectoryChapterStartBookmark(request),
          onTogglePageBookmark: (request: ReaderPageBookmarkToggleRequest): void =>
            this.toggleReaderPageBookmark(request),
          onCloseDirectory: (): void => this.closeDirectory(),
          onOpenDirectory: (): void => this.openReaderControlDirectory(),
          onSwitchSource: (): void => this.openSourceSwitch(),
          onOpenRulesManagement: (): void => this.requestRulesManagementFromReader(),
          onCloseSourceSwitch: (scopeId?: number): void => this.closeSourceSwitch(scopeId),
          onRetrySourceSwitch: (scopeId?: number): void => this.retrySourceSwitch(scopeId),
          onRefreshSourceSwitch: (scopeId?: number): void => this.refreshSourceSwitch(scopeId),
          onPickSource: (candidate: SourceSwitchCandidate, scopeId?: number): void => this.onPickSource(candidate, scopeId),
          onRollbackSourceSwitch: (scopeId?: number): void => this.onRollbackSourceSwitch(scopeId),
        });
      }
      if ((this.route === 'detail' || this.route === 'bookshelf') &&
        !this.readingSessionActive && this.sourceSwitchVisible && this.detailBook !== undefined) {
        this.sourceSwitchOverlayContent();
      }
      if (this.route === 'bookshelf' && this.editingShelfGroupBook !== undefined) {
        this.shelfGroupContent();
      }
      if (this.route === 'bookshelf' && this.hasVisibleImportDialog()) {
        this.localImportContent();
      }
      if (this.jsonImportVisible) {
        this.jsonImportContent();
      }
      // Host capability surface only: mounted for ArkWeb controller lifecycle,
      // never used as the reading-body renderer.
      ArkWebExecutionHost()
    }
      .width('100%')
      .height('100%')
      .backgroundColor(readerAppColor('app.window.background', this.appThemeScheme))
      // App pages consume the current vp window snapshot. Reader owns an
      // edge-to-edge background and resolves its content/control rects inside
      // ReaderLayoutGeometry, so it must not inherit this App-page padding.
      .padding({ top: this.readerOwnsWindowEdges() ? 0 : this.appContentTopInset() })
      .expandSafeArea([SafeAreaType.SYSTEM], this.readerOwnsWindowEdges() ?
        [SafeAreaEdge.TOP, SafeAreaEdge.BOTTOM] : [SafeAreaEdge.BOTTOM])
  }

  @Builder
  private syncContent() {
    ForEach([this.navigationGeneration], (generation: number) => {
      this.syncSurface(generation, this.mountedRuntimeOwner, this.getSyncOrchestrator(), this.detailShelfAdmissionMount, this.syncPresentationIdentity);
    }, (identity: number): string => identity.toString());
  }

  @Builder
  private syncSurface(generation: number, owner: ReaderRuntimeOwner | undefined, host: SyncOrchestrator,
    mounting: number, identity: string) {
    SyncPage({
      snapshot: this.syncSnapshot,
      isTablet: deviceInfo.deviceType === 'tablet',
      onBack: (): void => { if (this.isCurrentSyncPresentation(generation, owner, host, mounting, identity)) this.returnToSettings(); },
      onReconcile: (expected: number): void => {
        if (this.isCurrentSyncPresentation(generation, owner, host, mounting, identity)) host.reconcile(expected);
      },
      onSkipBackupRetention: (expected: number): void => {
        if (this.isCurrentSyncPresentation(generation, owner, host, mounting, identity)) host.skipBackupRetention(expected);
      },
      onContinueConfigSave: (expected: number, url: string, user: string, pass: string, backupPass: string, directory: string): void => {
        if (this.isCurrentSyncPresentation(generation, owner, host, mounting, identity))
          host.continueConfigSave(expected, url, user, pass, backupPass, directory);
      },
      onSaveConfig: (url: string, user: string, pass: string, backupPass: string, path: string): void => {
        if (this.isCurrentSyncPresentation(generation, owner, host, mounting, identity)) host.saveConfig(url, user, pass, backupPass, path);
      },
      onTestConnection: (url: string, user: string, pass: string, path: string): void => {
        if (this.isCurrentSyncPresentation(generation, owner, host, mounting, identity)) host.testConnection(url, user, pass, path);
      },
      onTriggerBackup: (): void => { if (this.isCurrentSyncPresentation(generation, owner, host, mounting, identity)) host.triggerBackup(); },
      onRestoreLatest: (): void => { if (this.isCurrentSyncPresentation(generation, owner, host, mounting, identity)) host.restoreLatest(); },
      onResolveRestore: (overwriteLocal: boolean): void => {
        if (this.isCurrentSyncPresentation(generation, owner, host, mounting, identity)) host.resolveRestore(overwriteLocal);
      },
    });
  }

  @Builder
  private rssPageContent() {
    // Only a new navigation replaces this temporary child; updates keep its identity.
    // V1 regular callbacks are constructor inputs and must capture the new entity.
    ForEach([this.navigationGeneration], (generation: number) => {
      this.rssPageSurface(generation, ReaderRuntimeOwner.current());
    }, (identity: number): string => identity.toString());
  }

  @Builder
  private rssPageSurface(generation: number, owner: ReaderRuntimeOwner) {
    RssPage({
      presentation: this.rssPresentation,
      readFacts: this.rssFeedRead,
      onRetryRead: (facts: OperationFacts<RssSubscription[]>): void => {
        if (this.isCurrentRssPresentation(generation, owner, 'rss')) this.loadRss(generation, facts.generation);
      },
      isTablet: deviceInfo.deviceType === 'tablet',
      activeMode: 'sources',
      onBack: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rss')) this.returnToBookshelf(); },
      onRefresh: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rss')) this.refreshRss(); },
      onManage: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rss')) this.onRssManage(); },
      onSelectSubscription: (id: string): void => { if (this.isCurrentRssPresentation(generation, owner, 'rss')) this.onRssSubscriptionSelected(id); },
      onSelectItem: (subscriptionId: string, guid: string): void => { if (this.isCurrentRssPresentation(generation, owner, 'rss')) this.onRssItemSelected(subscriptionId, guid); },
      onModeRequested: (mode: RssMode): void => { if (this.isCurrentRssPresentation(generation, owner, 'rss')) this.onRssModeRequested(mode); },
      onSettingsRequested: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rss')) this.openSettings(); },
      onDiscoverRequested: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rss')) this.openDiscover(); },
    });
  }

  @Builder
  private rssEditorContent() {
    // Only a new navigation replaces this temporary child; updates keep its identity.
    // V1 regular callbacks are constructor inputs and must capture the new entity.
    ForEach([this.navigationGeneration], (generation: number) => {
      this.rssEditorSurface(generation, this.mountedRuntimeOwner, this.detailShelfAdmissionMount,
        this.rssEditorPresentationIdentity, this.rssEditorOrchestrator);
    }, (identity: number): string => identity.toString());
  }

  @Builder
  private rssEditorSurface(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number,
    identity: string, host: RssSubscriptionEditorOrchestrator | undefined) {
    RssSubscriptionEditorPage({
      snapshot: this.rssEditorSnapshot,
      onReconcile: (expectedGeneration: number): void => { if (this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.reconcile(expectedGeneration); },
      onRetryRead: (expectedGeneration: number): void => { if (this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.retryLoad(expectedGeneration); },
      onBack: (): void => { if (this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) this.returnToRssSubscriptionManagement(); },
      onFeedUrlChanged: (value: string): void => { if (this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.updateFeedUrl(value); },
      onTitleChanged: (value: string): void => { if (this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.updateTitle(value); },
      onEnabledChanged: (value: boolean): void => { if (this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.updateEnabled(value); },
      onEnabledCookieJarChanged: (value: boolean): void =>
        { if (this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.updateEnabledCookieJar(value); },
      onSourceFieldChanged: (field: RssSourceTextField, value: string): void =>
        { if (this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.updateSourceField(field, value); },
      onSave: (): void => { if (this.isCurrentRssEditorPresentation(generation, owner, mounting, identity, host)) host?.save(); },
    });
  }

  @Builder
  private rssSourceFeedContent() {
    // Only a new navigation replaces this temporary child; updates keep its identity.
    // V1 regular callbacks are constructor inputs and must capture the new entity.
    ForEach([this.navigationGeneration], (generation: number) => {
      this.rssSourceFeedSurface(generation, ReaderRuntimeOwner.current(), this.selectedRssSubscription?.subscriptionId ?? '');
    }, (identity: number): string => identity.toString());
  }

  @Builder
  private rssSourceFeedSurface(generation: number, owner: ReaderRuntimeOwner, subscriptionId: string) {
    RssSourceFeedPage({
      subscription: this.selectedRssSubscription,
      items: this.selectedRssItems,
      operation: this.rssSourceOperation,
      readFacts: this.rssSourceRead,
      onReconcile: (operation: RssRouteOperationProjection<RssSourceSnapshot>): void => {
        if (this.isCurrentRssPresentation(generation, owner, 'rssSourceFeed', subscriptionId) && operation.subscriptionId === subscriptionId) this.getRssOrchestrator().reconcileSourceOperation(operation, this.rssSourceBinding(generation, subscriptionId));
      },
      onRetryRead: (facts: OperationFacts<RssSourceSnapshot>): void => {
        if (this.isCurrentRssPresentation(generation, owner, 'rssSourceFeed', subscriptionId)) this.getRssOrchestrator().retrySourceRead(subscriptionId, facts, this.rssSourceBinding(generation, subscriptionId));
      },
      isTablet: deviceInfo.deviceType === 'tablet',
      onBack: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSourceFeed', subscriptionId)) this.returnFromRssSourceFeed(); },
      onSelectItem: (item: RssItem): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSourceFeed', subscriptionId)) this.onRssSourceItemSelected(item); },
      onRefresh: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSourceFeed', subscriptionId)) this.refreshRssSourceFeed(); },
      onEditSource: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSourceFeed', subscriptionId)) this.openRssManagementForSubscription(subscriptionId); },
      onSourceOperations: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSourceFeed', subscriptionId)) this.openRssManagementForSubscription(subscriptionId); },
    });
  }

  @Builder
  private rssEntryDetailContent() {
    // Only a new navigation replaces this temporary child; updates keep its identity.
    // V1 regular callbacks are constructor inputs and must capture the new entity.
    ForEach([this.navigationGeneration], (generation: number) => {
      this.rssEntryDetailSurface(generation, ReaderRuntimeOwner.current(), this.selectedRssSubscription?.subscriptionId ?? '', this.selectedRssItem?.guid ?? '');
    }, (identity: number): string => identity.toString());
  }

  @Builder
  private rssEntryDetailSurface(generation: number, owner: ReaderRuntimeOwner, subscriptionId: string, guid: string) {
    RssEntryDetailPage({
      subscription: this.selectedRssSubscription,
      item: this.selectedRssItem,
      operation: this.rssEntryOperation,
      readFacts: this.rssEntryRead,
      onReconcile: (operation: RssRouteOperationProjection<RssEntrySnapshot>): void => {
        if (this.isCurrentRssPresentation(generation, owner, 'rssEntryDetail', subscriptionId, guid) && operation.subscriptionId === subscriptionId && operation.guid === guid) this.getRssOrchestrator().reconcileEntryOperation(operation, this.rssEntryBinding(generation, subscriptionId, guid));
      },
      onRetryRead: (facts: OperationFacts<RssEntrySnapshot>): void => {
        if (this.isCurrentRssPresentation(generation, owner, 'rssEntryDetail', subscriptionId, guid)) this.getRssOrchestrator().retryEntryRead(subscriptionId, guid, facts, this.rssEntryBinding(generation, subscriptionId, guid));
      },
      isTablet: deviceInfo.deviceType === 'tablet',
      favoriteState: this.selectedRssFavoriteState,
      onBack: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssEntryDetail', subscriptionId, guid)) this.returnFromRssEntryDetail(); },
      onViewSource: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssEntryDetail', subscriptionId, guid)) this.returnToRssSourceFeed(); },
      onFavoriteRequested: (favorite: boolean): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssEntryDetail', subscriptionId, guid)) this.onRssEntryFavoriteRequested(favorite); },
      onSourceSettings: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssEntryDetail', subscriptionId, guid)) this.openRssManagementForSubscription(subscriptionId); },
      onOpenOriginal: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssEntryDetail', subscriptionId, guid)) this.onRssOpenOriginalRequested(); },
    });
  }

  @Builder
  private rssSubscriptionManagementContent() {
    ForEach([this.navigationGeneration], (generation: number) => {
      this.rssSubscriptionManagementSurface(generation, ReaderRuntimeOwner.current());
    }, (identity: number): string => identity.toString());
  }

  @Builder
  private rssSubscriptionManagementSurface(generation: number, owner: ReaderRuntimeOwner) {
    RssSubscriptionManagementPage({
      items: this.rssSubscriptionManagementItems(),
      isTablet: deviceInfo.deviceType === 'tablet',
      focusedSubscriptionId: this.rssManagementFocusSubscriptionId,
      operation: this.rssManagementOperation,
      readFacts: this.rssManagementRead,
      onBack: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.returnToRss(); },
      onAdd: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.onRssSubscriptionAddRequested(); },
      onImport: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.requestRssSourceImport(); },
      onExport: (): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.exportRssSources(); },
      onToggle: (id: string, enabled: boolean): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.getRssOrchestrator().toggleSubscription(id, enabled); },
      onViewArticles: (id: string): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.onRssManagementViewArticles(id); },
      onEditSource: (id: string): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.onRssSubscriptionEditRequested(id); },
      onRefresh: (id: string): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.getRssOrchestrator().refreshSubscription(id); },
      onDelete: (id: string): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.requestRssSubscriptionDelete(id); },
      onReconcile: (operation: RssManagementOperationProjection): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.getRssOrchestrator().reconcileManagementOperation(operation); },
      onRetryRead: (facts: OperationFacts<RssSubscription[]>): void => { if (this.isCurrentRssPresentation(generation, owner, 'rssSubscriptionManagement')) this.getRssOrchestrator().retryManagementRead(facts); },
    });
  }

  @Builder
  private detailContent() {
    if (this.detailBook !== undefined) {
      // The same admission keeps its native scroll under the directory.
      // A new admission gets its own ordinary callbacks, never fresh owner state
      // read through the old native handler.
      ForEach([this.detailShelfAdmissionIdentity()], (identity: string): void => {
        this.detailSurface(identity, this.mountedRuntimeOwner);
      }, (identity: string): string => identity);
      if (this.route === 'directory' && this.directoryReturnTarget === 'detail') this.externalDirectory();
    }
  }

  @Builder
  private detailSurface(identity: string, owner: ReaderRuntimeOwner | undefined) {
    if (this.detailBook !== undefined) {
      LocalBookDetail({
        book: this.detailBook,
        toc: this.detailToc,
        sourceSwitchEnabled: this.detailBook.sourceId !== LOCAL_SOURCE_ID &&
          this.shelfOperation.removalKey.length === 0 &&
          !this.detailReadableAdmission(this.detailBook).adding,
        readingEnabled: this.remoteContentVerdict === 'readable',
        readingBlockedReason: this.remoteContentVerdictLabel(this.remoteContentVerdict),
        inBookshelf: this.detailInBookshelf,
        loadingMessage: this.detailLoadingMessage,
        removalEnabled: !this.readingSessionActive && !this.sourceSwitchVisible &&
          this.pendingSourceSwitch === undefined && this.sourceSwitchHost?.blocksExit(this.detailBook!) !== true && !this.offlineOperationActive &&
          this.shelfOperation.removalKey.length === 0 && !this.hasUnknownShelfWrite(),
        removing: this.shelfOperation.removalKey.length > 0,
        adding: this.detailReadableAdmission(this.detailBook).adding,
        cancellingAdd: this.detailReadableAdmission(this.detailBook).cancelling,
        shelfMessage: this.detailReadableAdmission(this.detailBook).message,
        onContinue: (): void => { if (this.isCurrentDetailPresentation(identity, owner)) this.openReading(undefined); },
        onSelectChapter: (chapterIndex: number): void => { if (this.isCurrentDetailPresentation(identity, owner)) this.openReading(chapterIndex); },
        onOpenDirectory: (): void => { if (this.isCurrentDetailPresentation(identity, owner)) this.openFullDirectory(); },
        onSwitchSource: (): void => { if (this.isCurrentDetailPresentation(identity, owner)) this.openDetailSourceSwitch(); },
        admissionIdentity: identity,
        onRemove: (identity?: string): void => { if (this.isCurrentDetailShelfAdmission(identity)) this.requestDetailShelfMutation(); },
        onCancelAdd: (identity?: string): void => { if (this.isCurrentDetailShelfAdmission(identity)) this.cancelDetailBookAddition(); },
        onBack: (): void => { if (this.isCurrentDetailPresentation(identity, owner)) this.returnFromDetail(); },
      })
        .width('100%').height('100%')
        .visibility(this.route === 'directory' && this.directoryReturnTarget === 'detail' ? Visibility.Hidden : Visibility.Visible)
        .enabled(this.route !== 'directory' || this.directoryReturnTarget !== 'detail')
        .focusable(this.route !== 'directory' || this.directoryReturnTarget !== 'detail')
        .hitTestBehavior(this.route === 'directory' && this.directoryReturnTarget === 'detail' ? HitTestMode.None : HitTestMode.Default)
        .accessibilityLevel(this.route === 'directory' && this.directoryReturnTarget === 'detail' ? 'no-hide-descendants' : 'auto');
    }
  }

  private isCurrentDetailPresentation(identity: string, owner: ReaderRuntimeOwner | undefined): boolean {
    return owner !== undefined && this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) &&
      this.isCurrentDetailShelfAdmission(identity);
  }

  @Builder
  private externalDirectory() {
    if (this.detailBook !== undefined) {
      BookDirectoryPage({
        sourceId: this.detailBook.sourceId,
        bookId: this.detailBook.bookId,
        bookKind: this.detailBook.kind ?? '',
        entries: this.detailToc,
        catalogMessage: this.detailLoadingMessage,
        directoryRecovery: this.directoryRecovery(),
        onReconcileBookmarks: (generation: number, identity: string): void => this.reconcileDirectoryOperation(generation, identity),
        onContinueBookmarks: (generation: number, identity: string): void => this.reconcileDirectoryOperation(generation, identity, true),
        onReconcileOffline: (generation: number, identity: string): void => this.reconcileOfflineOperation(generation, identity),
        onContinueOffline: (generation: number, identity: string): void => this.reconcileOfflineOperation(generation, identity, true),
        chapterStartBookmarkCreationEnabled: true,
        onSelectChapter: (index: number): void => this.onDirectoryChapterSelected(index),
        onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number,
          positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject): void =>
          this.onDirectoryNavigationTargetSelected(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof),
        onDownloadChapter: (index: number): void => this.downloadDirectoryChapter(index),
        onDeleteBookmarks: (times: number[]): void => this.deleteDirectoryBookmarks(times),
        onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
          this.createDirectoryChapterStartBookmark(request),
        onBack: (): void => this.closeDirectory(),
      }).width('100%').height('100%');
    }
  }

  private readerOwnsWindowEdges(): boolean {
    // Only a visible reader/control owns edge-to-edge geometry. Detail's
    // ordinary catalog inherits the same single App safe-top inset as Detail.
    return this.readingSessionActive && (this.route === 'reading' ||
      (this.route === 'directory' && this.directoryReturnTarget === 'readerControl'));
  }

  private appContentTopInset(): number {
    // Reading the revision makes Window callbacks observable to this root;
    // the metric values themselves remain owned by ReaderWindowCoordinator.
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    return readerContentSafeTop(ReaderWindowCoordinator.metrics());
  }

  private openRss(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.selectedRssSubscription = undefined;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rss';
    this.rssSourceFeedReturnTarget = 'rss';
    this.rssManagementFocusSubscriptionId = '';
    this.route = 'rss';
    void this.loadRss(generation);
  }

  private loadRss(generation: number, expectedGeneration?: number): void {
    if (!isReaderProductSurfaceEnabled('rss')) return;
    const owner = ReaderRuntimeOwner.current();
    const current = (): boolean => this.isCurrentRssPresentation(generation, owner, 'rss');
    this.getRssOrchestrator().loadFeed(
      (subscriptions: RssSubscription[]): void => { if (current()) this.rssPresentation = this.feedPresentation(subscriptions, []); },
      (facts: OperationFacts<RssSubscription[]>): void => {
        if (!current()) return;
        this.rssFeedRead = facts;
        if (facts.value !== undefined) this.rssPresentation = this.feedPresentation(facts.value, []);
      }, current, expectedGeneration);
  }

  private openDiscover(): void {
    if (!isReaderProductSurfaceEnabled('discover')) {
      return;
    }
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'discover';
    this.getDiscoverOrchestrator().open();
  }

  private isCurrentDiscoverPresentation(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: DiscoverOrchestrator | undefined, attached: boolean = true): boolean {
    return owner !== undefined && !this.shelfReceiptRetired && this.route === 'discover' &&
      generation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount &&
      this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) &&
      host !== undefined && this.discoverOrchestrator === host && host.owns(owner) &&
      (!attached || host.isPresentationCurrent(JSON.stringify([this.rssInstanceIdentity, mounting, generation, 'discover'])));
  }

  private getDiscoverOrchestrator(): DiscoverOrchestrator {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner) || this.route !== 'discover')
      throw new Error('发现页面已退役');
    const host = DiscoverOrchestrator.forRuntime(owner);
    if (host === undefined) throw new Error('发现 Runtime 已退役');
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const identity = JSON.stringify([this.rssInstanceIdentity, mounting, generation, 'discover']);
    if (this.discoverOrchestrator !== host || this.discoverPresentationIdentity !== identity) {
      this.discoverOrchestrator?.detachPresentation(this.discoverPresentationIdentity);
      this.discoverOrchestrator = host; this.discoverPresentationIdentity = identity;
      const current = (): boolean => this.discoverPresentationIdentity === identity &&
        this.isCurrentDiscoverPresentation(generation, owner, mounting, host, false);
      host.attachPresentation(identity, (presentation: DiscoverPresentation): void => {
        if (current()) this.discoverPresentation = presentation;
      }, current);
    }
    return host;
  }

  private openSettings(): void {
    this.settingsSection = 'home';
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'settings';
    if (this.bindSettingsPresentation()) {
      this.settingsCacheCleanup = this.settingsHost.cacheCleanupSnapshot(this.mountedRuntimeOwner);
      void this.reconcileSettingsCache(undefined);
      this.settingsHost.open(this.settingsPresentationIdentity);
    }
  }

  private openBookshelfSettings(): void {
    this.bookshelfSettingsReturnRoute = this.route === 'settings' ? 'settings' : 'bookshelf';
    this.nextNavigationGeneration();
    this.route = 'bookshelfSettings';
    if (this.bindSettingsPresentation()) this.settingsHost.open(this.settingsPresentationIdentity);
  }

  private returnFromBookshelfSettings(): void {
    if (this.bookshelfSettingsReturnRoute === 'settings') this.openSettings();
    else this.returnToBookshelf();
  }

  private openShelfGroup(book: ShelfBook): void {
    if (this.editingShelfGroupBusy) return;
    this.editingShelfGroupPresentation += 1;
    this.editingShelfGroupBook = book;
    this.bindBookshelfManagement(this.editingShelfGroupPresentation, book);
    if (this.bookshelfManagementPresentationIdentity.length > 0)
      this.bookshelfHost.openManagement(this.bookshelfManagementPresentationIdentity);
  }

  @Builder
  private shelfGroupContent() {
    ForEach([this.editingShelfGroupPresentation], (presentation: number) => {
      this.shelfGroupSurface(presentation, this.navigationGeneration, this.mountedRuntimeOwner,
        this.detailShelfAdmissionMount, this.editingShelfGroupBook!);
    }, (identity: number): string => identity.toString());
  }

  @Builder
  private shelfGroupSurface(presentation: number, generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, book: ShelfBook) {
    Stack({ alignContent: Alignment.Center }) {
      Row().width('100%').height('100%').backgroundColor(readerAppColor('app.Index.build.backgroundColor.52000000', this.appThemeScheme))
        .onClick((): void => {
          if (!this.editingShelfGroupBusy && this.isCurrentShelfGroup(presentation, generation, owner, mounting, book))
            this.closeShelfGroup(presentation);
        });
      ReaderDialogSurface({
        specId: 'shelf-group',
        title: '编辑分组',
        actions: [],
        body: (): void => this.shelfGroupBody(presentation, generation, owner, mounting, book),
      });
    }.width('100%').height('100%');
  }

  @Builder
  private shelfGroupBody(presentation: number, generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, book: ShelfBook) {
    BookshelfGroupSelector({
      selected: (book.group?.trim() ?? '') === '',
      busy: this.editingShelfGroupBusy || this.bookshelfManagementSnapshot.busy || this.bookshelfManagementSnapshot.mutationBlocked === true,
      onSelect: (): void => { void this.assignShelfDefaultGroup(presentation, generation, owner, mounting, book); },
    });
    if (this.bookshelfManagementSnapshot.receipt !== undefined) {
      ForEach([this.bookshelfManagementSnapshot.receipt.facts.generation], (expected: number) => {
        this.shelfGroupRecoveryContent(presentation, generation, owner, mounting, book, expected);
      }, (identity: number): string => identity.toString());
    }
  }

  @Builder
  private shelfGroupRecoveryContent(presentation: number, generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, book: ShelfBook, expected: number) {
    ReaderRecoveryNotice({
      view: this.shelfGroupRecovery(expected), actionLabel: '核对分组',
      onReconcile: (_expected: number): void => {
        if (this.isCurrentShelfGroup(presentation, generation, owner, mounting, book))
          this.bookshelfHost.reconcileManagement(expected, this.bookshelfManagementIdentity(generation, mounting, presentation));
      },
    });
    if (this.canContinueShelfGroup(book, expected)) {
      ReaderRecoveryAction({ generation: expected, label: '继续原分组操作',
        onReconcile: (_expected: number): void => {
          if (this.isCurrentShelfGroup(presentation, generation, owner, mounting, book) && this.canContinueShelfGroup(book, expected))
            this.bookshelfHost.continueOriginalManagement(expected, this.bookshelfManagementIdentity(generation, mounting, presentation));
        },
      });
    }
  }
  private canContinueShelfGroup(book: ShelfBook, expected: number): boolean {
    const mutation = this.bookshelfManagementSnapshot.managementMutation;
    return this.bookshelfManagementSnapshot.receipt?.facts.generation === expected && !this.bookshelfManagementSnapshot.busy &&
      mutation?.canContinueOriginal === true && mutation.method === 'bookshelf.group.assign' &&
      mutation.sourceId === book.sourceId && mutation.bookId === book.bookId && mutation.group === '';
  }
  private shelfGroupRecovery(expected: number): ReaderRecoveryView {
    const receipt = this.bookshelfManagementSnapshot.receipt;
    if (receipt === undefined || receipt.facts.generation !== expected)
      return { message: '', visible: false, canRetry: false, generation: expected };
    const view = readerRecoveryView(receipt, this.bookshelfManagementSnapshot.readFacts);
    const mutation = this.bookshelfManagementSnapshot.managementMutation;
    if (mutation?.blocked === true && mutation.message.length > 0)
      return { message: `${view.message}：${mutation.message}`, visible: true,
        canRetry: view.canRetry || !this.bookshelfManagementSnapshot.busy, generation: expected };
    return view;
  }
  private closeShelfGroup(presentation: number = this.editingShelfGroupPresentation): void {
    if (presentation !== this.editingShelfGroupPresentation) return;
    this.editingShelfGroupBook = undefined;
    this.bookshelfHost.detachManagementPresentation(); this.bookshelfManagementPresentationIdentity = '';
  }

  private isCurrentShelfGroup(presentation: number, generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, book: ShelfBook): boolean {
    return this.isCurrentBookshelfPresentation(generation, owner, mounting) &&
      presentation === this.editingShelfGroupPresentation && this.editingShelfGroupBook === book &&
      owner !== undefined && this.bookshelfHost.isManagementPresentationCurrent(owner,
        this.bookshelfManagementIdentity(generation, mounting, presentation));
  }

  private async assignShelfDefaultGroup(presentation: number, generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, book: ShelfBook): Promise<void> {
    const current = (): boolean => this.isCurrentShelfGroup(presentation, generation, owner, mounting, book);
    if (!current() || this.editingShelfGroupBusy) return;
    this.editingShelfGroupBusy = true;
    try {
      const result = await this.bookshelfHost.assignDefaultGroup(book,
        this.bookshelfManagementIdentity(generation, mounting, presentation));
      if (!current()) return;
      if (result?.receipt?.receipt.confirmation === 'confirmed') { this.invalidateBookshelfProjection(); this.refreshBookshelf(); }
      if (result?.receipt?.receipt.fact === 'confirmedCurrent') this.closeShelfGroup(presentation);
    } catch (error) {
      if (!current()) return;
      hilog.error(DOMAIN, 'Reader', 'Group selection failed: %{private}s', errorMessageOf(error));
      this.getUIContext().getPromptAction().showToast({ message: '分组操作暂不可用，请重新打开核对' });
    } finally {
      if (presentation === this.editingShelfGroupPresentation) this.editingShelfGroupBusy = false;
    }
  }

  @Builder
  private bookshelfSettingsContent() {
    ForEach([this.navigationGeneration], (generation: number) => {
      this.bookshelfSettingsSurface(generation, this.mountedRuntimeOwner, this.detailShelfAdmissionMount,
        this.settingsHost, this.settingsPresentationIdentity);
    }, (generation: number): string => generation.toString());
  }
  @Builder
  private bookshelfSettingsSurface(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: SettingsHost, identity: string) {
    BookshelfSettingsPage({
      navigationGeneration: generation,
      autoCheckUpdate: this.settingsSnapshot.autoCheckUpdate,
      operation: this.settingsOperation,
      onReconcile: (expected: number, navigation?: number): void => {
        if ((navigation === undefined || navigation === generation) &&
          this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'bookshelfSettings', identity)) host.reconcile(expected, identity);
      },
      onRetryAccepted: (expected: number, navigation?: number): void => {
        if ((navigation === undefined || navigation === generation) &&
          this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'bookshelfSettings', identity)) host.retryAccepted(expected, identity);
      },
      onBack: (): void => { if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'bookshelfSettings', identity)) this.returnFromBookshelfSettings(); },
      onAutoCheckUpdate: (value: boolean): void => {
        if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'bookshelfSettings', identity)) host.toggle('autoCheckUpdate', value, identity);
      },
    });
  }

  @Builder
  private settingsContent() {
    ForEach([this.navigationGeneration], (generation: number) => {
      this.settingsSurface(generation, this.mountedRuntimeOwner, this.detailShelfAdmissionMount,
        this.settingsHost, this.settingsPresentationIdentity);
    }, (generation: number): string => generation.toString());
  }
  @Builder
  private settingsSurface(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: SettingsHost, identity: string) {
    SettingsPage({
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, bridgeIdentity: string): void => {
        if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity))
          this.registerTemporaryBackBridge('settings', generation, owner, handler, bridgeIdentity);
      },
      activeSection: this.settingsSection,
      onSectionChange: (section: 'home' | 'general'): void => {
        if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) this.settingsSection = section;
      },
      onRestoreDefaults: (): Promise<boolean> => this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity) ? host.restoreDefaults(identity) : Promise.resolve(false),
      snapshot: this.settingsSnapshot,
      operation: this.settingsOperation,
      cacheCleanup: this.settingsCacheCleanup,
      onReconcile: (expected: number): void => {
        if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) host.reconcile(expected, identity);
      },
      onRetryAccepted: (expected: number): void => {
        if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) host.retryAccepted(expected, identity);
      },
      onReconcileCache: (expected: number): void => { void this.reconcileSettingsCache(expected, generation, owner, mounting, host, false, identity); },
      onContinueCache: (expected: number): void => { void this.reconcileSettingsCache(expected, generation, owner, mounting, host, true, identity); },
      isTablet: deviceInfo.deviceType === 'tablet',
      onBack: (): void => { if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) this.returnToBookshelf(); },
      onOpenSourceManagement: (): void => { if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) this.openSourceManagement(); },
      onOpenRulesManagement: (): void => { if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) this.openRulesManagement(); },
      onOpenSync: (): void => { if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) this.openSync(); },
      onOpenBookshelfSettings: (): void => { if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) this.openBookshelfSettings(); },
      onRssRequested: (): void => { if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) this.openRss(); },
      onDiscoverRequested: (): void => { if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) this.openDiscover(); },
      onToggle: (key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
        value: boolean): void => { if (this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity)) host.toggle(key, value, identity); },
      onClearCache: (): Promise<SettingsCacheCleanupSnapshot | undefined> => this.clearTextCache(generation, owner, mounting, host, identity),
    });
  }

  @Builder
  private sourceToolsContent() {
    ForEach([this.navigationGeneration], (generation: number): void => {
      this.sourceToolsSurface(generation, this.mountedRuntimeOwner, this.detailShelfAdmissionMount,
        this.sourceToolsOrchestrator);
    }, (generation: number): string => generation.toString());
  }

  @Builder
  private sourceToolsSurface(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: SourceToolsOrchestrator | undefined) {
    SourceToolsPage({
      snapshot: this.sourceToolsSnapshot,
      onReconcile: (expected: number): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.reconcile(expected); },
      onSelectAll: (): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.selectAll(); },
      onClearSelection: (): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.setSelection([]); },
      onToggleSelection: (sourceId: string): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.toggleSelection(sourceId); },
      onBack: (): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) this.returnToSourceManagement(); },
      onExportAll: (): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.exportAll(); },
      onExportSelected: (sourceIds: string[]): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.exportSelected(host.consumeSelection(sourceIds)); },
      onCheckSelected: (sourceIds: string[]): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.checkSelected(sourceIds); },
      onStopCheck: (): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.stopCheckSelected(); },
      onSetSelectedEnabled: (sourceIds: string[], enabled: boolean): void => {
        if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.setSelectedEnabled(host.consumeSelection(sourceIds), enabled);
      },
      onDeleteSelected: (sourceIds: string[]): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) this.requestSourceDelete(sourceIds, host); },
      onOpenEditor: (sourceId: string): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.openEditor(sourceId); },
      onEditorDraftChanged: (text: string): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.updateEditorDraft(text); },
      onSaveEditor: (): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.saveEditor(); },
      onReconcileEditor: (): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.reconcileEditor(); },
      onCancelEditor: (): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.cancelEditor(); },
      onDebugKeyChanged: (value: string): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.updateDebugKey(value); },
      onCheckSelectionChanged: (mode: 'search' | 'explore', depth: number): void => {
        if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.updateCheckSelection(mode, depth);
      },
      onDebugSource: (sourceId: string): void => { if (this.isCurrentSourceToolsPresentation(generation, owner, mounting, host)) host?.debugSource(sourceId); },
    });
  }

  @Builder
  private sourceManagementContent() {
    ForEach([this.navigationGeneration], (generation: number) => {
      this.sourceManagementSurface(generation, this.mountedRuntimeOwner, this.detailShelfAdmissionMount,
        this.sourceHost, this.sourcePresentationIdentity);
    }, (generation: number): string => generation.toString());
  }
  @Builder
  private sourceManagementSurface(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: SourceHost, identity: string) {
    SourceManagementPage({
      onTemporaryBackBridge: (handler: (() => boolean) | undefined, bridgeIdentity: string): void => {
        if (this.isCurrentSourceManagement(generation, owner, mounting, host, identity))
          this.registerTemporaryBackBridge('source', generation, owner, handler, bridgeIdentity);
      },
      sources: this.sourceSources,
      operation: this.sourceOperation,
      onReconcile: (expected: number): void => {
        if (this.isCurrentSourceManagement(generation, owner, mounting, host, identity)) host.reconcile(expected, identity);
      },
      statusKind: this.sourceStatusKind,
      statusMessage: this.sourceStatusMessage,
      isTablet: deviceInfo.deviceType === 'tablet',
      reduceMotion: this.settingsSnapshot.reduceMotion,
      onBack: (): void => { if (this.isCurrentSourceManagement(generation, owner, mounting, host, identity)) this.returnFromSourceManagement(); },
      onToggleSource: (id: string, enabled: boolean): void => {
        if (this.isCurrentSourceManagement(generation, owner, mounting, host, identity)) host.toggleSource(id, enabled, identity);
      },
      onDetectSource: (id: string): void => { if (this.isCurrentSourceManagement(generation, owner, mounting, host, identity)) host.checkSource(id, identity); },
      onLoginSource: (id: string): void => { if (this.isCurrentSourceManagement(generation, owner, mounting, host, identity)) host.loginSource(id, identity); },
      onAddSource: (): void => { if (this.isCurrentSourceManagement(generation, owner, mounting, host, identity)) this.openJsonImport('bookSource'); },
      onOpenTools: (): void => { if (this.isCurrentSourceManagement(generation, owner, mounting, host, identity)) this.openSourceTools(); },
      onRetryLoad: (): void => { if (this.isCurrentSourceManagement(generation, owner, mounting, host, identity)) host.retryLoad(identity); },
    });
  }
  private bindSourceManagement(): boolean {
    const owner = this.mountedRuntimeOwner, host = this.sourceHost;
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    if (owner === undefined || !this.isCurrentSourceManagement(generation, owner, mounting, host, '', false)) return false;
    const identity = JSON.stringify([this.rssInstanceIdentity, mounting, generation, 'source']);
    if (identity === this.sourcePresentationIdentity) return host.isPresentationCurrent(owner, identity);
    host.detachPresentation(this.sourcePresentationIdentity); this.sourcePresentationIdentity = identity;
    return host.bindPresentation(owner, identity,
      (): boolean => this.isCurrentSourceManagement(generation, owner, mounting, host, identity, false));
  }
  private isCurrentSourceManagement(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: SourceHost, identity: string, attached: boolean = true): boolean {
    return owner !== undefined && !this.shelfReceiptRetired && this.route === 'source' &&
      generation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount &&
      owner === this.mountedRuntimeOwner && this.isCurrentRuntime(owner) && host === this.sourceHost &&
      (!attached || (identity.length > 0 && identity === this.sourcePresentationIdentity && host.isPresentationCurrent(owner, identity)));
  }
  private retireSourceManagementPresentation(): void {
    this.sourceHost.detachPresentation(this.sourcePresentationIdentity); this.sourcePresentationIdentity = '';
  }

  @Builder
  private bookshelfManagementContent() {
    ForEach([this.navigationGeneration], (generation: number) => {
      this.bookshelfManagementSurface(generation, this.mountedRuntimeOwner, this.detailShelfAdmissionMount,
        this.bookshelfHost, this.bookshelfManagementPresentationIdentity);
    }, (identity: number): string => identity.toString());
  }
  @Builder
  private bookshelfManagementSurface(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: BookshelfHost, identity: string) {
    BookshelfManagementPage({
      snapshot: this.bookshelfManagementSnapshot,
      onBack: (): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) this.returnToBookshelf(); },
      onGroupNameChanged: (value: string): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.updateGroupName(value, identity); },
      onGroupOrderChanged: (value: string): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.updateGroupOrder(value, identity); },
      onSelectGroup: (groupId: number): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.selectGroup(groupId, identity); },
      onClearGroupEditor: (): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.clearGroupEditor(identity); },
      onSaveGroup: (): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.saveGroup(identity); },
      onToggleGroupShown: (groupId: number): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.toggleGroupShown(groupId, identity); },
      onDeleteGroup: (groupId: number): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.deleteGroup(groupId, identity); },
      onSelectBook: (sourceId: string, bookId: string): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.selectBook(sourceId, bookId, identity); },
      onAssignmentGroupChanged: (value: string): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.updateAssignmentGroup(value, identity); },
      onAssignBook: (): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.assignSelectedBook(identity); },
      onReconcile: (expected: number): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.reconcileManagement(expected, identity); },
      onContinueOriginal: (expected: number): void => { if (this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity)) host.continueOriginalManagement(expected, identity); },
    });
  }

  @Builder
  private rulesManagementContent() {
    ForEach([this.navigationGeneration], (generation: number) => {
      this.rulesManagementSurface(generation, this.mountedRuntimeOwner, this.detailShelfAdmissionMount,
        this.getRulesManagementOrchestrator(), this.rulesPresentationIdentity);
    }, (identity: number): string => identity.toString());
  }

  @Builder
  private rulesManagementSurface(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: RulesManagementOrchestrator, identity: string) {
    RulesManagementPage({
      snapshot: this.rulesManagementSnapshot,
      onReconcile: (expected: number): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.reconcile(expected, identity);
      },
      onBack: (): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) this.returnFromRulesManagement();
      },
      onSaveReplace: (draft: ReplaceRuleDraft): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.saveReplaceRule(draft, identity);
      },
      onDeleteReplace: (id: number): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.deleteReplaceRule(id, identity);
      },
      onSaveTxtToc: (draft: TxtTocRuleDraft): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.saveTxtTocRule(draft, identity);
      },
      onDeleteTxtToc: (id: number): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.deleteTxtTocRule(id, identity);
      },
      onSaveDict: (draft: DictRuleDraft): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.saveDictRule(draft, identity);
      },
      onDeleteDict: (name: string): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.deleteDictRule(name, identity);
      },
      onSaveSubscription: (draft: RuleSubscriptionDraft): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.saveRuleSubscription(draft, identity);
      },
      onDeleteSubscription: (id: number): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.deleteRuleSubscription(id, identity);
      },
      onRefreshSubscription: (subscription: ManagedRuleSubscription): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.refreshRuleSubscription(subscription, identity);
      },
      onExportBundle: (): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) host.exportBundle(identity);
      },
      onImportBundle: (): void => {
        if (this.isCurrentRulesPresentation(generation, owner, mounting, host, identity)) this.openJsonImport('ruleBundle');
      },
    });
  }

  private bookshelfManagementIdentity(generation: number, mounting: number, opening?: number): string {
    return JSON.stringify([this.rssInstanceIdentity, mounting, generation, 'bookshelfManagement', opening ?? 'page']);
  }
  private isCurrentBookshelfManagement(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: BookshelfHost, identity: string, attached: boolean = true, opening?: number, book?: ShelfBook): boolean {
    return owner !== undefined && !this.shelfReceiptRetired && this.mountedRuntimeOwner === owner &&
      this.isCurrentRuntime(owner) && generation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount &&
      (opening === undefined ? this.route === 'bookshelfManagement' :
        this.route === 'bookshelf' && this.editingShelfGroupPresentation === opening && this.editingShelfGroupBook === book) &&
      host === this.bookshelfHost && identity.length > 0 && this.bookshelfManagementPresentationIdentity === identity &&
      (!attached || host.isManagementPresentationCurrent(owner, identity));
  }
  private bindBookshelfManagement(opening?: number, book?: ShelfBook): void {
    const generation = this.navigationGeneration, owner = this.mountedRuntimeOwner, mounting = this.detailShelfAdmissionMount;
    if (owner === undefined) return;
    const host = this.bookshelfHost, identity = this.bookshelfManagementIdentity(generation, mounting, opening);
    if (this.bookshelfManagementPresentationIdentity === identity) return;
    this.bookshelfManagementPresentationIdentity = identity;
    const current = (): boolean => this.isCurrentBookshelfManagement(generation, owner, mounting, host, identity, false, opening, book);
    if (!host.bindManagement(owner, identity, current)) this.bookshelfManagementPresentationIdentity = '';
  }

  private openBookshelfManagement(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'bookshelfManagement';
    this.bindBookshelfManagement();
    this.bookshelfHost.openManagement(this.bookshelfManagementPresentationIdentity);
  }

  private openBookshelfMultiSelect(initialBook?: ShelfBook): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.bookshelfMultiSelectInitialKey = initialBook === undefined ? '' : this.shelfBookKey(initialBook);
    this.route = 'bookshelfMultiSelect';
    this.bookshelfSelectionBooks = this.shelfBooks;
    this.bookshelfSelectionReady = false;
    const generation = this.navigationGeneration;
    const owner = ReaderRuntimeOwner.current();
    const current = (): boolean => generation === this.navigationGeneration && this.route === 'bookshelfMultiSelect' && this.isCurrentRuntime(owner);
    const projection = this.getBookshelfProjection(), binding = this.bookshelfProjectionBinding;
    if (projection === undefined || binding === undefined) return;
    void projection.selection(binding).then((books: ShelfBook[] | undefined): void => {
      if (!current() || books === undefined) return;
      this.bookshelfSelectionBooks = books;
      this.bookshelfSelectionReady = true;
    }).catch((error: Error): void => {
      if (!current()) return;
      this.getUIContext().getPromptAction().showToast({ message: '书架读取失败，请重试' });
      this.returnToBookshelf();
    });
  }

  private openRulesManagement(): void {
    this.nextNavigationGeneration();
    this.rulesManagementReturnTarget = 'settings';
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'rulesManagement';
    this.getRulesManagementOrchestrator().open(this.rulesPresentationIdentity);
  }

  private requestRulesManagementFromReader(): void {
    if (!this.readingSessionActive || this.detailBook === undefined) {
      return;
    }
    this.openRulesManagementAfterReaderExit = true;
    const requestExit = this.readingExitRequest;
    if (requestExit !== undefined) {
      requestExit();
      return;
    }
    this.openRulesManagementAfterReaderExit = false;
  }

  private presentRulesManagementFromReader(): void {
    this.nextNavigationGeneration();
    this.rulesManagementReturnTarget = 'reader';
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'rulesManagement';
    this.getRulesManagementOrchestrator().open(this.rulesPresentationIdentity);
  }

  private isCurrentRulesPresentation(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: RulesManagementOrchestrator, identity: string, attached: boolean = true): boolean {
    return owner !== undefined && !this.shelfReceiptRetired && this.route === 'rulesManagement' &&
      generation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount &&
      this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) &&
      this.rulesManagementOrchestrator === host && host.owns(owner) && identity.length > 0 &&
      this.rulesPresentationIdentity === identity && (!attached || host.isPresentationCurrent(identity));
  }

  private getRulesManagementOrchestrator(): RulesManagementOrchestrator {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner) || this.route !== 'rulesManagement')
      throw new Error('规则页面已退役');
    const host = RulesManagementOrchestrator.forRuntime(owner);
    if (host === undefined) throw new Error('规则 Runtime 已退役');
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const identity = JSON.stringify([this.rssInstanceIdentity, mounting, generation, 'rulesManagement']);
    if (this.rulesManagementOrchestrator !== host || this.rulesPresentationIdentity !== identity) {
      this.rulesManagementOrchestrator?.detachPresentation(this.rulesPresentationIdentity);
      this.rulesManagementOrchestrator = host; this.rulesPresentationIdentity = identity;
      const current = (): boolean => this.isCurrentRulesPresentation(generation, owner, mounting, host, identity, false);
      host.attachPresentation(identity, (snapshot: RulesManagementSnapshot): void => {
        if (current()) this.rulesManagementSnapshot = snapshot;
      }, current);
    }
    return host;
  }

  private onSettingToggled(
    key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
    value: boolean,
  ): void {
    if (this.isCurrentSettingsPresentation(this.navigationGeneration, this.mountedRuntimeOwner))
      this.settingsHost.toggle(key, value, this.settingsPresentationIdentity);
  }

  private bindSettingsPresentation(): boolean {
    const owner = this.mountedRuntimeOwner, host = this.settingsHost;
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const route: 'settings' | 'bookshelfSettings' = this.route === 'bookshelfSettings' ? 'bookshelfSettings' : 'settings';
    if (owner === undefined || !this.isCurrentSettingsPresentation(generation, owner, mounting, host, route, '', false)) return false;
    const identity = JSON.stringify([this.rssInstanceIdentity, mounting, generation, route]);
    if (identity === this.settingsPresentationIdentity) return host.isPresentationCurrent(owner, identity);
    host.detachPresentation(this.settingsPresentationIdentity); this.settingsPresentationIdentity = identity;
    return host.bindPresentation(owner, identity,
      (): boolean => this.isCurrentSettingsPresentation(generation, owner, mounting, host, route, identity, false));
  }
  private retireSettingsPresentation(): void {
    this.settingsHost.detachPresentation(this.settingsPresentationIdentity); this.settingsPresentationIdentity = '';
  }
  private isCurrentSettingsPresentation(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number = this.detailShelfAdmissionMount, host: SettingsHost = this.settingsHost,
    route: 'settings' | 'bookshelfSettings' = this.route === 'bookshelfSettings' ? 'bookshelfSettings' : 'settings',
    identity: string = this.settingsPresentationIdentity, attached: boolean = true): boolean {
    return owner !== undefined && this.isCurrentRuntime(owner) && this.mountedRuntimeOwner === owner &&
      generation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount &&
      this.route === route && !this.shelfReceiptRetired && host === this.settingsHost &&
      (!attached || (identity.length > 0 && identity === this.settingsPresentationIdentity && host.isPresentationCurrent(owner, identity)));
  }
  private async reconcileSettingsCache(expected: number | undefined, generation: number = this.navigationGeneration,
    owner: ReaderRuntimeOwner | undefined = this.mountedRuntimeOwner, mounting: number = this.detailShelfAdmissionMount,
    host: SettingsHost = this.settingsHost, continuing: boolean = false, identity: string = this.settingsPresentationIdentity): Promise<void> {
    const current = (): boolean => this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity);
    if (owner === undefined || !current()) return;
    const previous = host.cacheCleanupSnapshot(owner);
    if (expected !== undefined && previous?.operation.generation !== expected) return;
    const snapshot = continuing && expected !== undefined ? await host.continueOriginalCacheCleanup(owner, expected, current) :
      await host.reconcileCacheCleanup(owner, current);
    if (current()) this.settingsCacheCleanup = snapshot;
  }

  private async clearTextCache(generation: number = this.navigationGeneration,
    owner: ReaderRuntimeOwner | undefined = this.mountedRuntimeOwner, mounting: number = this.detailShelfAdmissionMount,
    host: SettingsHost = this.settingsHost, identity: string = this.settingsPresentationIdentity): Promise<SettingsCacheCleanupSnapshot | undefined> {
    const current = (): boolean => this.isCurrentSettingsPresentation(generation, owner, mounting, host, 'settings', identity);
    if (owner === undefined || !current()) return undefined;
    return host.clearCache(owner, current);
  }

  private onSyncSaveConfig(url: string, user: string, pass: string, backupPass: string, path: string): void {
    if (!isReaderProductSurfaceEnabled('sync')) {
      return;
    }
    this.getSyncOrchestrator().saveConfig(url, user, pass, backupPass, path);
  }

  private onSyncTestConnection(url: string, user: string, pass: string, path: string): void {
    if (!isReaderProductSurfaceEnabled('sync')) {
      return;
    }
    this.getSyncOrchestrator().testConnection(url, user, pass, path);
  }

  private onSyncTriggerBackup(): void {
    if (!isReaderProductSurfaceEnabled('sync')) {
      return;
    }
    this.getSyncOrchestrator().triggerBackup();
  }

  private onSyncRestoreLatest(): void {
    if (!isReaderProductSurfaceEnabled('sync')) {
      return;
    }
    this.getSyncOrchestrator().restoreLatest();
  }

  private onSyncResolveRestore(overwriteLocal: boolean): void {
    if (!isReaderProductSurfaceEnabled('sync')) {
      return;
    }
    this.getSyncOrchestrator().resolveRestore(overwriteLocal);
  }

  private registerTemporaryBackBridge(
    scope: TemporaryBackScope,
    generation: number,
    owner: ReaderRuntimeOwner | undefined,
    handler: (() => boolean) | undefined,
    identity: string,
  ): void {
    if (identity.length === 0 || this.shelfReceiptRetired || owner === undefined ||
      this.mountedRuntimeOwner !== owner || !this.isCurrentRuntime(owner) ||
      generation !== this.navigationGeneration || this.route !== scope) return;
    if (handler === undefined) {
      const lease = this.temporaryBackLease;
      if (lease !== undefined && lease.scope === scope && lease.owner === owner &&
        lease.generation === generation && lease.identity === identity) this.temporaryBackLease = undefined;
      return;
    }
    this.temporaryBackLease = { scope, generation, owner, identity, handler };
  }

  private consumeTemporaryBackBridge(): boolean {
    const lease = this.temporaryBackLease;
    if (lease === undefined) return false;
    if (this.shelfReceiptRetired || this.mountedRuntimeOwner !== lease.owner ||
      !this.isCurrentRuntime(lease.owner) || lease.generation !== this.navigationGeneration ||
      this.route !== lease.scope) {
      if (this.temporaryBackLease === lease) this.temporaryBackLease = undefined;
      return false;
    }
    try { return lease.handler(); } catch (error) {
      // A failing close cannot prove that the temporary surface has gone.
      // Keep this Back inside the current page instead of exiting under it.
      try { hilog.error(DOMAIN, 'Reader', 'Temporary surface Back failed: %{private}s', errorMessageOf(error)); } catch (_) {}
      return true;
    }
  }

  private isCurrentRuntime(owner: ReaderRuntimeOwner | undefined): boolean {
    return owner !== undefined && ReaderRuntimeOwner.isCurrent(owner);
  }

  private isCurrentSyncOwner(owner: ReaderRuntimeOwner | undefined): boolean {
    return owner !== undefined && !this.shelfReceiptRetired && isReaderProductSurfaceEnabled('sync') &&
      this.route === 'sync' && this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner);
  }

  private isCurrentSyncPresentation(generation: number, owner: ReaderRuntimeOwner | undefined,
    host: SyncOrchestrator | undefined = this.syncOrchestrator, mounting: number = this.detailShelfAdmissionMount,
    identity: string = this.syncPresentationIdentity, attached: boolean = true): boolean {
    return owner !== undefined && this.isCurrentRoute(generation, 'sync') && this.isCurrentSyncOwner(owner) &&
      mounting === this.detailShelfAdmissionMount && host !== undefined && this.syncOrchestrator === host &&
      host.ownedBy(owner) && identity.length > 0 && this.syncPresentationIdentity === identity &&
      (!attached || host.isPresentationCurrent(identity));
  }

  private getSyncOrchestrator(): SyncOrchestrator {
    const owner = this.mountedRuntimeOwner;
    if (!this.isCurrentSyncOwner(owner) || owner === undefined) throw new Error('同步页面已退役');
    const host = SyncOrchestrator.forRuntime(owner);
    if (host === undefined) throw new Error('同步 Runtime 已退役');
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const identity = JSON.stringify([this.rssInstanceIdentity, mounting, generation, 'sync']);
    if (this.syncOrchestrator !== host || this.syncPresentationIdentity !== identity) {
      this.syncOrchestrator?.detachPresentation(this.syncPresentationIdentity);
      this.syncOrchestrator = host; this.syncPresentationIdentity = identity;
      const current = (): boolean => this.isCurrentSyncPresentation(generation, owner, host, mounting, identity, false);
      host.attachPresentation(identity, (snapshot: SyncSnapshot): void => {
        if (!current()) return;
        this.syncSnapshot = snapshot; this.syncSnapshotReady = true;
      }, (): SyncSnapshot => this.syncSnapshot, current);
    }
    return host;
  }

  private openSourceManagement(returnTarget: SourceManagementReturnTarget = 'settings',
    searchKeyword: string = ''): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.sourceManagementReturnTarget = returnTarget;
    this.sourceManagementSearchKeyword = searchKeyword;
    this.route = 'source';
    if (this.bindSourceManagement()) this.sourceHost.open(this.sourcePresentationIdentity);
  }

  /** Enter Source Management from the Search page's add/manage-source intents. */
  private manageSourcesFromSearch(): void {
    const presentation = this.searchHost.presentation();
    const keyword = presentation.kind === 'loading' || presentation.kind === 'results' ||
      presentation.kind === 'empty' || presentation.kind === 'error' ? presentation.keyword : '';
    this.openSourceManagement('search', keyword);
  }

  private isCurrentSourceToolsPresentation(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, host: SourceToolsOrchestrator | undefined = this.sourceToolsOrchestrator): boolean {
    return owner !== undefined && !this.shelfReceiptRetired && this.route === 'sourceTools' && this.navigationGeneration === generation &&
      mounting === this.detailShelfAdmissionMount && this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) &&
      host !== undefined && this.sourceToolsOrchestrator === host && host.owns(owner);
  }

  private getSourceToolsOrchestrator(): SourceToolsOrchestrator {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || !this.isCurrentRuntime(owner) || this.shelfReceiptRetired || this.route !== 'sourceTools')
      throw new Error('书源工具页面已退役');
    const host = SourceToolsOrchestrator.forRuntime(owner);
    if (host === undefined) throw new Error('书源工具 Runtime 已退役');
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const identity = JSON.stringify([this.sourceToolsInstanceIdentity, mounting, generation]);
    if (this.sourceToolsOrchestrator !== host || this.sourceToolsPresentationIdentity !== identity) {
      this.sourceToolsOrchestrator?.detachPresentation(this.sourceToolsPresentationIdentity);
      this.sourceToolsOrchestrator = host; this.sourceToolsPresentationIdentity = identity;
      const current = (): boolean => this.sourceToolsPresentationIdentity === identity &&
        this.isCurrentSourceToolsPresentation(generation, owner, mounting, host);
      host.attachPresentation(identity, (snapshot: SourceToolsSnapshot): void => {
        if (current()) this.sourceToolsSnapshot = snapshot;
      }, current);
    }
    return host;
  }

  private openSourceTools(): void {
    this.nextNavigationGeneration(); this.readingSessionActive = false; this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false; this.route = 'sourceTools';
    this.getSourceToolsOrchestrator().open(this.sourceSources);
  }

  private returnToSourceManagement(): void {
    this.nextNavigationGeneration();
    this.route = 'source';
    if (this.bindSourceManagement()) this.sourceHost.open(this.sourcePresentationIdentity);
  }

  private returnToSettings(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'settings';
    this.settingsCacheCleanup = this.settingsHost.cacheCleanupSnapshot(this.mountedRuntimeOwner);
    void this.reconcileSettingsCache(undefined);
  }

  private returnFromRulesManagement(): void {
    if (this.rulesManagementReturnTarget !== 'reader' || this.detailBook === undefined) {
      this.rulesManagementReturnTarget = 'settings';
      this.returnToSettings();
      return;
    }
    this.rulesManagementReturnTarget = 'settings';
    this.route = this.readingOriginRoute;
    this.openReading(undefined);
  }

  /**
   * P0 add-source flow exit: `autoSearch` (post-import primary action) returns
   * to Search, restores the keyword and re-searches once; a plain return only
   * restores the pre-leave state and never fires a request.
   */
  private returnFromSourceManagement(autoSearch: boolean = false): void {
    const returnTarget = this.sourceManagementReturnTarget;
    const keyword = this.sourceManagementSearchKeyword;
    this.sourceManagementReturnTarget = 'settings';
    this.sourceManagementSearchKeyword = '';
    if (returnTarget !== 'search') {
      this.returnToSettings();
      return;
    }
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'search';
    if (autoSearch && keyword.length > 0) {
      // A fresh entry reloads sources; the search itself re-checks the enabled
      // set, so a still-disabled configuration lands on sourceRequired instead
      // of firing doomed requests.
      this.searchHost.open();
      this.searchHost.search(keyword);
      return;
    }
    this.searchHost.refreshSources();
    // Restore the same query after source management; only autoSearch replaces it.
    this.searchHost.resume();
  }

  private onSourceToggled(id: string, enabled: boolean): void {
    // SS-SOURCE-TOGGLE-01 orchestration (serial chain, Core-idle retry, session
    // guards) lives in SourceOrchestrator; Index only forwards the intent.
    const owner = this.mountedRuntimeOwner;
    if (this.isCurrentSourceManagement(this.navigationGeneration, owner, this.detailShelfAdmissionMount, this.sourceHost, this.sourcePresentationIdentity))
      this.sourceHost.toggleSource(id, enabled, this.sourcePresentationIdentity);
  }

  private onSourceDetectionRequested(id: string): void {
    const owner = this.mountedRuntimeOwner;
    if (this.isCurrentSourceManagement(this.navigationGeneration, owner, this.detailShelfAdmissionMount, this.sourceHost, this.sourcePresentationIdentity))
      this.sourceHost.checkSource(id, this.sourcePresentationIdentity);
  }

  private onSourceLoginRequested(id: string): void {
    const owner = this.mountedRuntimeOwner;
    if (this.isCurrentSourceManagement(this.navigationGeneration, owner, this.detailShelfAdmissionMount, this.sourceHost, this.sourcePresentationIdentity))
      this.sourceHost.loginSource(id, this.sourcePresentationIdentity);
  }

  @Builder
  private jsonImportContent() {
    ForEach([this.jsonImportGeneration], (presentation: number) => {
      this.jsonImportSurface(presentation, this.navigationGeneration, this.mountedRuntimeOwner,
        this.detailShelfAdmissionMount, this.jsonImportContext, this.rulesManagementOrchestrator, this.rulesPresentationIdentity,
        this.sourceHost, this.sourcePresentationIdentity);
    }, (identity: number): string => identity.toString());
  }

  @Builder
  private jsonImportSurface(presentation: number, generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, context: JsonImportContext, rules: RulesManagementOrchestrator | undefined, identity: string,
    source: SourceHost, sourceIdentity: string) {
    JsonImportDialog({
      title: this.jsonImportTitle(),
      description: this.jsonImportDescription(),
      isTablet: deviceInfo.deviceType === 'tablet',
      onDismiss: (): void => {
        if (this.isCurrentJsonImportPresentation(presentation, generation, owner, mounting, context, rules, identity, source, sourceIdentity)) this.dismissJsonImport();
      },
      onSelectLocal: (): void => {
        if (!this.isCurrentJsonImportPresentation(presentation, generation, owner, mounting, context, rules, identity, source, sourceIdentity)) return;
        this.dismissJsonImport(); this.executeJsonImport(context, undefined, rules, identity, source, sourceIdentity);
      },
      onImportOnline: (url: string): void => {
        if (!this.isCurrentJsonImportPresentation(presentation, generation, owner, mounting, context, rules, identity, source, sourceIdentity)) return;
        this.dismissJsonImport(); this.executeJsonImport(context, url, rules, identity, source, sourceIdentity);
      },
    });
  }

  private isCurrentJsonImportPresentation(presentation: number, generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, context: JsonImportContext, rules: RulesManagementOrchestrator | undefined, identity: string,
    source: SourceHost = this.sourceHost, sourceIdentity: string = this.sourcePresentationIdentity): boolean {
    return owner !== undefined && !this.shelfReceiptRetired && this.jsonImportVisible &&
      presentation === this.jsonImportGeneration && generation === this.navigationGeneration &&
      mounting === this.detailShelfAdmissionMount && this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) &&
      context === this.jsonImportContext && (context !== 'bookSource' ||
        this.isCurrentSourceManagement(generation, owner, mounting, source, sourceIdentity)) && (context !== 'ruleBundle' || (rules !== undefined &&
        this.isCurrentRulesPresentation(generation, owner, mounting, rules, identity)));
  }

  private openJsonImport(context: JsonImportContext): void {
    this.jsonImportGeneration += 1;
    this.jsonImportContext = context;
    this.jsonImportVisible = true;
  }

  private dismissJsonImport(): void {
    this.jsonImportVisible = false;
  }

  private selectLocalJsonImport(): void {
    const context = this.jsonImportContext;
    this.dismissJsonImport();
    this.executeJsonImport(context);
  }

  private importOnlineJson(onlineUrl: string): void {
    const context = this.jsonImportContext;
    this.dismissJsonImport();
    this.executeJsonImport(context, onlineUrl);
  }

  private executeJsonImport(context: JsonImportContext, onlineUrl?: string,
    rules: RulesManagementOrchestrator | undefined = this.rulesManagementOrchestrator, identity: string = this.rulesPresentationIdentity,
    source: SourceHost = this.sourceHost, sourceIdentity: string = this.sourcePresentationIdentity): void {
    if (context === 'bookSource' && this.route === 'source') {
      const generation = this.navigationGeneration, owner = this.mountedRuntimeOwner, mounting = this.detailShelfAdmissionMount;
      const current = (): boolean => this.isCurrentSourceManagement(generation, owner, mounting, source, sourceIdentity);
      if (!current()) return;
      source.importBookSources(
        onlineUrl,
        (completion: SourceImportCompletion): void => {
          if (!current()) return;
          const base = completion.refreshWarning ?? `Core 已导入 ${completion.importedCount} 个书源`;
          const message = completion.failureSummary === undefined ?
            `${base}。` : `${base}，${completion.failureSummary}`;
          if (this.sourceManagementReturnTarget === 'search') {
            this.showSourceImportResultFromSearch('书源导入完成', message, current);
            return;
          }
          this.showSourceImportResult('书源导入完成', message, current);
        },
        (error: Error): void => { if (current()) this.showSourceImportResult('书源导入失败', error.message, current); },
        sourceIdentity,
      );
      return;
    }
    if (context === 'ruleBundle' && this.route === 'rulesManagement') {
      if (rules !== undefined && rules === this.rulesManagementOrchestrator && rules.isPresentationCurrent(identity))
        rules.importBundle(onlineUrl, identity);
      return;
    }
    if ((context === 'rssMerge' || context === 'rssReplace') &&
      this.route === 'rssSubscriptionManagement') {
      this.importRssSources(context === 'rssReplace', onlineUrl);
    }
  }

  private jsonImportTitle(): string {
    if (this.jsonImportContext === 'bookSource') return '导入书源';
    if (this.jsonImportContext === 'ruleBundle') return '导入规则包';
    return '导入 RSS 源';
  }

  private jsonImportDescription(): string {
    if (this.jsonImportContext === 'ruleBundle') {
      return '本地和在线导入共用 Core 规则包校验；同主键以导入值为准。';
    }
    if (this.jsonImportContext === 'rssReplace') {
      return '覆盖导入会原子替换当前 RSS 来源与阅读状态。';
    }
    if (this.jsonImportContext === 'rssMerge') {
      return '合并导入会保留现有 RSS 来源。';
    }
    return '支持 Legado 书源 JSON；本地文件和在线链接共用 Core 导入校验。';
  }

  private showIndexAlert(spec: ReaderNativeAlertSpecId, options: ReaderNativeAlertOptions,
    isCurrent: () => boolean = (): boolean => true): ReaderNativeAlertLease | undefined {
    if (this.shelfReceiptRetired) return undefined;
    try {
      const owner = ReaderRuntimeOwner.current();
      const generation = this.navigationGeneration;
      const route = this.route;
      const current = (): boolean => {
        if (this.shelfReceiptRetired) return false;
        try { return this.isCurrentRuntime(owner) && generation === this.navigationGeneration &&
          this.route === route && isCurrent(); }
        catch (_) { return false; }
      };
      return this.nativeAlertOwner.present(
        (native: ReaderNativeAlertOptions): void => this.getUIContext().showAlertDialog(native), spec, options, current);
    } catch (error) {
      // The native notice is a separate platform outcome. A durable import,
      // deletion or read ACK must survive a synchronous presentation failure.
      try { hilog.warn(DOMAIN, 'Reader', 'Native Alert presentation failed: %{private}s', errorMessageOf(error)); }
      catch (_) {}
      return undefined;
    }
  }

  private showSourceImportResult(title: string, message: string, current: () => boolean = (): boolean => true): void {
    if (this.route !== 'source' || !current()) {
      return;
    }
    this.showIndexAlert('notice', {
      title,
      message,
      primaryButton: {
        value: '知道了',
        action: (): void => {},
      },
    }, current);
  }

  /**
   * P0 add-source flow: after an import that started from Search, offer the
   * one-tap re-search with the original keyword. With no keyword recorded
   * (entry from a sourceRequired state) the plain result dialog applies.
   */
  private showSourceImportResultFromSearch(title: string, message: string, current: () => boolean = (): boolean => true): void {
    if (this.route !== 'source' || !current()) {
      return;
    }
    const keyword = this.sourceManagementSearchKeyword;
    if (keyword.length === 0) {
      this.showSourceImportResult(title, message, current);
      return;
    }
    const returnTarget = this.sourceManagementReturnTarget;
    this.showIndexAlert('confirmation-cancelable', {
      title,
      message,
      primaryButton: {
        value: '继续管理',
        action: (): void => {},
      },
      secondaryButton: {
        value: `用新书源搜索「${keyword}」`,
        action: (): void => {
          if (current() && this.route === 'source') {
            this.returnFromSourceManagement(true);
          }
        },
      },
    }, (): boolean => current() && this.sourceManagementSearchKeyword === keyword &&
      this.sourceManagementReturnTarget === returnTarget);
  }

  private requestSourceDelete(sourceIds: string[], host: SourceToolsOrchestrator | undefined = this.sourceToolsOrchestrator): void {
    if (this.route !== 'sourceTools' || sourceIds.length === 0 || host === undefined || this.sourceToolsOrchestrator !== host) {
      return;
    }
    const selection = host.consumeSelection(sourceIds);
    if (selection.length === 0) {
      return;
    }
    const listRevision = this.sourceToolsSnapshot.sourceListRevision;
    const selectionRevision = this.sourceToolsSnapshot.selectionRevision;
    this.showIndexAlert('confirmation-cancelable', {
      title: '删除书源',
      message: `确定删除所选 ${selection.length} 个书源吗？相关 Host 登录会话也会清除，删除后无法恢复。`,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '删除',
        fontColor: readerAppColor('app.Index.requestSourceDelete.showAlertDialog.FFB42318', this.appThemeScheme),
        action: (): void => {
          if (this.route === 'sourceTools') {
            host.deleteSelected(selection);
          }
        },
      },
    }, (): boolean => this.sourceToolsOrchestrator === host && !this.sourceToolsSnapshot.busy &&
      this.sourceToolsSnapshot.sourceListRevision === listRevision &&
      this.sourceToolsSnapshot.selectionRevision === selectionRevision && selection.every((id: string): boolean =>
        this.sourceToolsSnapshot.sources.some((source: BookSource): boolean => source.sourceId === id)));
  }

  private openSync(): void {
    if (!isReaderProductSurfaceEnabled('sync')) {
      return;
    }
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.syncSnapshotReady = false;
    this.route = 'sync';
    this.getSyncOrchestrator().open();
  }

  private refreshRss(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    // The registered Figma boundary keeps RSS as a placeholder-only page.
    // Do not start a real rss.subscription.refresh transaction and then label
    // its stale/cache outcome as a user-visible refresh.
    hilog.warn(DOMAIN, 'Reader', 'FIGMA_VISUAL_GAP: RSS refresh is placeholder-only until its admitted flow is supplied');
  }

  private onRssManage(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.nextNavigationGeneration();
    this.selectedRssSubscription = undefined;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rss';
    this.rssSourceFeedReturnTarget = 'rss';
    this.rssManagementFocusSubscriptionId = '';
    this.route = 'rssSubscriptionManagement';
    this.getRssOrchestrator().open();
  }

  private retireRssPresentation(): void {
    this.rssOrchestrator?.detachPresentation(this.rssPresentationIdentity);
    this.rssPresentationIdentity = '';
  }

  private getRssOrchestrator(): RssOrchestrator {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner))
      throw new Error('RSS 页面已退役');
    const host = RssOrchestrator.forRuntime(owner);
    if (host === undefined) throw new Error('RSS Runtime 已退役');
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const identity = JSON.stringify([this.rssInstanceIdentity, mounting, generation]);
    if (this.rssOrchestrator !== host || this.rssPresentationIdentity !== identity) {
      this.retireRssPresentation();
      if (this.rssOrchestrator !== host) {
        this.rssManagementOperation = undefined;
        this.rssManagementRead = projectOperationFacts<RssSubscription[]>({ phase: 'idle' });
      }
      this.rssOrchestrator = host;
      this.rssPresentationIdentity = identity;
      const admitted = (): boolean => this.rssOrchestrator === host && this.rssPresentationIdentity === identity &&
        this.mountedRuntimeOwner === owner && !this.shelfReceiptRetired && this.detailShelfAdmissionMount === mounting &&
        this.navigationGeneration === generation && this.isCurrentRuntime(owner);
      const current = (): boolean => admitted() && this.route === 'rssSubscriptionManagement';
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
  private isCurrentRssEditorPresentation(generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number, identity: string, host: RssSubscriptionEditorOrchestrator | undefined, attached: boolean = true): boolean {
    return owner !== undefined && host !== undefined && identity.length > 0 && this.rssEditorOrchestrator === host &&
      this.rssEditorPresentationIdentity === identity && (!attached || host.ownsPresentation(identity)) && host.owns(owner) && this.mountedRuntimeOwner === owner &&
      this.detailShelfAdmissionMount === mounting && this.navigationGeneration === generation &&
      !this.shelfReceiptRetired && this.route === 'rssSubscriptionEditor' && this.isCurrentRuntime(owner);
  }
  private getRssEditorOrchestrator(): RssSubscriptionEditorOrchestrator {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner) || this.route !== 'rssSubscriptionEditor')
      throw new Error('RSS 编辑页面已退役');
    const shared = this.getRssOrchestrator();
    const host = RssSubscriptionEditorOrchestrator.forRuntime(owner, (task: () => Promise<void>): Promise<void> => shared.runSerialized(task));
    if (host === undefined) throw new Error('RSS 编辑 Runtime 已退役');
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const identity = JSON.stringify([this.rssInstanceIdentity, mounting, generation, 'editor']);
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

  private onRssManagementViewArticles(subscriptionId: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.onRssSubscriptionSelected(subscriptionId, 'rssSubscriptionManagement');
  }

  private onRssSubscriptionSelected(
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
    const generation = this.nextNavigationGeneration();
    this.rssSourceOperation = undefined;
    this.rssSourceRead = projectOperationFacts<RssSourceSnapshot>({ phase: 'idle' });
    this.selectedRssSubscription = subscription;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssSourceFeedReturnTarget = returnTarget;
    this.route = 'rssSourceFeed';
    this.loadRssSourceItems(generation, subscriptionId);
  }

  private onRssSubscriptionAddRequested(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.rssEditorNavigationGeneration = this.nextNavigationGeneration();
    this.route = 'rssSubscriptionEditor';
    this.getRssEditorOrchestrator().openCreate();
  }

  private onRssSubscriptionEditRequested(subscriptionId: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (!this.rssSubscriptions().some(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    )) {
      return;
    }
    this.rssEditorNavigationGeneration = this.nextNavigationGeneration();
    this.route = 'rssSubscriptionEditor';
    this.getRssEditorOrchestrator().openEdit(subscriptionId);
  }

  private finishRssSubscriptionEdit(subscriptionId: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.route !== 'rssSubscriptionEditor') {
      return;
    }
    this.nextNavigationGeneration();
    this.rssManagementFocusSubscriptionId = subscriptionId;
    this.route = 'rssSubscriptionManagement';
    this.getRssOrchestrator().open();
  }

  private returnToRssSubscriptionManagement(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.nextNavigationGeneration();
    this.route = 'rssSubscriptionManagement';
    this.getRssOrchestrator().open();
  }

  private requestRssSubscriptionDelete(subscriptionId: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const subscription = this.rssSubscriptions().find(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    );
    if (this.route !== 'rssSubscriptionManagement' || subscription === undefined) {
      hilog.warn(DOMAIN, 'Reader',
        'RSS delete confirmation ignored stale subscriptionId=%{private}s', subscriptionId);
      return;
    }
    this.showIndexAlert('confirmation-cancelable', {
      title: '删除订阅源',
      message: `确定删除“${subscription.title}”吗？删除后无法恢复。`,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '删除',
        action: (): void => this.confirmRssSubscriptionDelete(subscriptionId),
      },
    }, (): boolean => this.rssSubscriptions().find((candidate: RssSubscription): boolean =>
      candidate.subscriptionId === subscriptionId) === subscription);
  }

  private requestRssSourceImport(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.route !== 'rssSubscriptionManagement') {
      return;
    }
    const host = this.getRssOrchestrator();
    const importVisible = this.jsonImportVisible;
    this.showIndexAlert('confirmation-cancelable', {
      title: '导入 RSS 源',
      message: '“合并导入”保留现有来源；“覆盖全部”会原子替换当前 RSS 来源与阅读状态。',
      primaryButton: {
        value: '合并导入',
        action: (): void => this.openJsonImport('rssMerge'),
      },
      secondaryButton: {
        value: '覆盖全部',
        fontColor: readerAppColor('app.Index.requestRssSourceImport.showAlertDialog.FFB42318', this.appThemeScheme),
        action: (): void => this.openJsonImport('rssReplace'),
      },
    }, (): boolean => this.rssOrchestrator === host && this.jsonImportVisible === importVisible);
  }

  private importRssSources(replaceExisting: boolean, onlineUrl?: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.getRssOrchestrator().importSources(
      replaceExisting,
      (result: RssSourceImportResult | undefined): void => {
        if (result !== undefined) {
          this.showRssOperationResult('RSS 源导入完成', `Core 已原子导入 ${result.imported} 个来源。`);
        }
      },
      (error: Error): void => this.showRssOperationResult('RSS 源导入失败', error.message),
      onlineUrl,
    );
  }

  private exportRssSources(): void {
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
    if (this.route !== 'rssSubscriptionManagement') {
      return;
    }
    this.showIndexAlert('notice', {
      title,
      message,
      primaryButton: {
        value: '知道了',
        action: (): void => {},
      },
    });
  }

  private confirmRssSubscriptionDelete(subscriptionId: string): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const stillPresent = this.rssSubscriptions().some(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    );
    if (this.route !== 'rssSubscriptionManagement' || !stillPresent) {
      return;
    }
    this.getRssOrchestrator().removeSubscription(subscriptionId);
  }

  private isCurrentRssPresentation(generation: number, owner: ReaderRuntimeOwner, route: ReaderRoute,
    subscriptionId: string = '', guid: string = ''): boolean {
    if (this.shelfReceiptRetired || !this.isCurrentRoute(generation, route)) return false;
    try {
      if (!this.isCurrentRuntime(owner)) return false;
      if (route === 'rssSourceFeed') return this.selectedRssSubscription?.subscriptionId === subscriptionId;
      if (route === 'rssEntryDetail') return this.selectedRssItem?.subscriptionId === subscriptionId && this.selectedRssItem?.guid === guid;
      return true;
    } catch (_) { return false; }
  }

  private rssSourceBinding(generation: number, subscriptionId: string): RssRouteBinding<RssSourceSnapshot> {
    const owner = ReaderRuntimeOwner.current();
    const current = (): boolean => this.isCurrentRssPresentation(generation, owner, 'rssSourceFeed', subscriptionId);
    return { current,
      emit: (snapshot: RssSourceSnapshot): void => { if (current()) this.applyRssSourceSnapshot(snapshot); },
      failed: (error: Error): void => { if (current()) hilog.error(DOMAIN, 'Reader', 'RSS source read failed: %{private}s', error.message); },
      emitOperation: (operation: RssRouteOperationProjection<RssSourceSnapshot>): void => {
        if (current() && operation.subscriptionId === subscriptionId) this.rssSourceOperation = operation;
      },
      emitRead: (facts: OperationFacts<RssSourceSnapshot>): void => { if (current()) this.rssSourceRead = facts; },
    };
  }

  private rssEntryBinding(generation: number, subscriptionId: string, guid: string): RssRouteBinding<RssEntrySnapshot> {
    const owner = ReaderRuntimeOwner.current();
    const current = (): boolean => this.isCurrentRssPresentation(generation, owner, 'rssEntryDetail', subscriptionId, guid);
    return { current,
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
    const binding = this.rssSourceBinding(generation, subscriptionId);
    this.getRssOrchestrator().loadSourceFeed(subscriptionId, binding.emit, binding.failed, binding.current,
      binding.emitOperation, binding.emitRead);
  }

  private refreshRssSourceFeed(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const subscriptionId = this.selectedRssSubscription?.subscriptionId;
    if (subscriptionId === undefined || this.route !== 'rssSourceFeed') {
      return;
    }
    const generation = this.navigationGeneration;
    const binding = this.rssSourceBinding(generation, subscriptionId);
    this.getRssOrchestrator().refreshSourceFeed(subscriptionId, binding.emit, binding.failed, binding.current,
      binding.emitOperation, binding.emitRead);
  }

  private isCurrentRssSourceFeed(generation: number, subscriptionId: string): boolean {
    return !this.shelfReceiptRetired && this.isCurrentRoute(generation, 'rssSourceFeed') &&
      this.selectedRssSubscription?.subscriptionId === subscriptionId;
  }

  private applyRssSourceSnapshot(snapshot: RssSourceSnapshot): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.rssPresentation = this.feedPresentation(snapshot.subscriptions, []);
    this.selectedRssSubscription = snapshot.subscription;
    this.selectedRssItems = snapshot.items;
  }

  private onRssItemSelected(subscriptionId: string, guid: string): void {
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

  private onRssSourceItemSelected(item: RssItem): void {
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
    const generation = this.nextNavigationGeneration();
    this.rssEntryOperation = undefined;
    this.rssEntryRead = projectOperationFacts<RssEntrySnapshot>({ phase: 'idle' });
    this.selectedRssSubscription = subscription;
    this.selectedRssItem = item;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = returnTarget;
    this.route = 'rssEntryDetail';
    const subscriptionId = item.subscriptionId;
    const guid = item.guid;
    const binding = this.rssEntryBinding(generation, subscriptionId, guid);
    this.getRssOrchestrator().openEntry(subscriptionId, guid, binding.emit, binding.failed, binding.current,
      binding.emitOperation, binding.emitRead);
  }

  private onRssEntryFavoriteRequested(favorite: boolean): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    const item = this.selectedRssItem;
    if (item === undefined || this.route !== 'rssEntryDetail' ||
      (this.selectedRssFavoriteState !== 'favorited' &&
        this.selectedRssFavoriteState !== 'notFavorited')) {
      return;
    }
    const generation = this.navigationGeneration;
    const subscriptionId = item.subscriptionId;
    const guid = item.guid;
    const binding = this.rssEntryBinding(generation, subscriptionId, guid);
    this.getRssOrchestrator().setEntryFavorite(subscriptionId, guid, favorite, binding.emit, binding.failed, binding.current,
      binding.emitOperation, binding.emitRead);
  }

  private isCurrentRssEntryDetail(
    generation: number,
    subscriptionId: string,
    guid: string,
  ): boolean {
    return !this.shelfReceiptRetired && this.isCurrentRoute(generation, 'rssEntryDetail') &&
      this.selectedRssItem?.subscriptionId === subscriptionId &&
      this.selectedRssItem?.guid === guid;
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

  private returnFromRssEntryDetail(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.rssDetailReturnTarget === 'rssSourceFeed') {
      this.returnToRssSourceFeed();
      return;
    }
    this.returnToRss();
  }

  private returnToRssSourceFeed(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.selectedRssSubscription === undefined) {
      this.returnToRss();
      return;
    }
    const subscriptionId = this.selectedRssSubscription.subscriptionId;
    const generation = this.nextNavigationGeneration();
    this.rssSourceOperation = undefined;
    this.rssSourceRead = projectOperationFacts<RssSourceSnapshot>({ phase: 'idle' });
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rssSourceFeed';
    this.route = 'rssSourceFeed';
    this.loadRssSourceItems(generation, subscriptionId);
  }

  private returnFromRssSourceFeed(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (this.rssSourceFeedReturnTarget === 'rssSubscriptionManagement') {
      const focusedSubscriptionId = this.selectedRssSubscription?.subscriptionId ?? '';
      this.nextNavigationGeneration();
      this.selectedRssSubscription = undefined;
      this.selectedRssItems = [];
      this.selectedRssItem = undefined;
      this.selectedRssFavoriteState = 'loading';
      this.rssDetailReturnTarget = 'rss';
      this.rssSourceFeedReturnTarget = 'rss';
      this.rssManagementFocusSubscriptionId = focusedSubscriptionId;
      this.route = 'rssSubscriptionManagement';
      this.getRssOrchestrator().open();
      return;
    }
    this.returnToRss();
  }

  private returnToRss(): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    this.nextNavigationGeneration();
    this.selectedRssSubscription = undefined;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rss';
    this.rssSourceFeedReturnTarget = 'rss';
    this.rssManagementFocusSubscriptionId = '';
    this.route = 'rss';
  }

  private openRssManagementForSubscription(subscriptionId: string | undefined): void {
    if (!isReaderProductSurfaceEnabled('rss')) {
      return;
    }
    if (subscriptionId === undefined || !this.rssSubscriptions().some(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    )) {
      return;
    }
    this.nextNavigationGeneration();
    this.rssManagementFocusSubscriptionId = subscriptionId;
    this.selectedRssSubscription = undefined;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rss';
    this.rssSourceFeedReturnTarget = 'rss';
    this.route = 'rssSubscriptionManagement';
    this.getRssOrchestrator().open();
  }

  private onRssOpenOriginalRequested(): void {
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

  private onRssModeRequested(mode: RssMode): void {
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

  private rssSubscriptionManagementItems(): RssSubscriptionManagementItem[] {
    return RssPresentationProjection.managementItems(this.rssPresentation);
  }

  private onSearchVisibilityChanged(): void {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || !this.isCurrentRuntime(owner) || this.shelfReceiptRetired) return;
    ReadingEntryHost.forRuntime(owner).preparationVisibilityChanged(this.readingPreparationContext(owner),
      this.sharedReadingPreparationSeeds(owner));
    owner.bookAcquisitions().visibilityChanged();
    owner.bookAcquisitions().setPreparationVisible(this.route === 'search' && this.searchAppForeground);
    this.searchHost.visibilityChanged();
    void this.refreshDetailAcquisitionProjection();
    this.consumeSystemFileOpen();
  }



  private async refreshDetailAcquisitionProjection(): Promise<void> {
    if (this.route !== 'detail' || this.readingSessionActive || this.detailBook === undefined ||
      this.detailBook.sourceId === LOCAL_SOURCE_ID || this.sourceSwitchVisible) return;
    const host = this.getReadingEntryHost();
    if (host === undefined) return;
    if (host.snapshot().scopeId !== this.readingEntryScopeId) this.bindReadingEntryReader();
    await host.refreshProjection();
  }

  private openSearch(): void {
    this.searchHost.prepareEntry();
    this.nextNavigationGeneration();
    this.resetSearchDetailWarmups();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'search';
    this.refreshSearchShelfMembership();
    this.searchHost.open();
  }

  private performSearch(keyword: string, scopeSourceIds?: string[]): void {
    this.nextNavigationGeneration();
    this.resetSearchDetailWarmups();
    this.searchHost.search(keyword, scopeSourceIds);
  }

  private stopSearch(): void {
    this.searchHost.stop();
    ReaderRuntimeOwner.current().bookAcquisitions().endSearch();
  }

  private retrySearch(): void {
    this.resetSearchDetailWarmups();
    this.searchHost.retry();
  }

  private clearSearchHistory(): void {
    this.nextNavigationGeneration();
    ReaderRuntimeOwner.current().bookAcquisitions().endSearch();
    this.searchHost.clearHistory();
  }

  private resetSearchDetailWarmups(): void {
    ReaderRuntimeOwner.current().bookAcquisitions().beginSearch();
  }

  private scheduleSearchDetailWarmups(groups: SearchBook[][]): void {
    const coordinator = ReaderRuntimeOwner.current().bookAcquisitions();
    coordinator.setPreparationVisible(this.route === 'search' && this.searchAppForeground);
    coordinator.prepareGroups(groups.slice(0, 6).map((books: SearchBook[]): BookAcquisitionCandidate[] => books
      .filter((book: SearchBook): boolean => book.sourceId !== LOCAL_SOURCE_ID && readerSourceCategoryIsText(book.category))
      .map((book: SearchBook): BookAcquisitionCandidate => this.searchAcquisitionCandidate(book))));
  }

  private searchAcquisitionCandidate(book: SearchBook): BookAcquisitionCandidate {
    const rank = searchCandidateRank(book);
    return { seed: this.remoteSeedForSearchBook(book), catalogReady: rank < 2, failed: rank === 3 };
  }

  private searchDetailKey(sourceId: string, bookId: string): string {
    return `${sourceId}\u0000${bookId}`;
  }

  private remoteSeedForSearchBook(candidate: SearchBook): RemoteReadingBookSeed {
    return {
      sourceId: candidate.sourceId,
      sourceVersion: candidate.sourceRuleVersion,
      bookId: candidate.bookId,
      detailUrl: candidate.detailUrl,
      title: candidate.title,
      author: candidate.author,
      authorIdentity: candidate.authorIdentity,
      coverUrl: candidate.coverUrl,
      intro: candidate.intro,
      kind: candidate.kind,
      lastChapter: candidate.latestChapterTitle,
      searchVariables: candidate.variables.map((variable): RemoteReadingVariable => ({
        name: variable.name,
        value: variable.value,
      })),
    };
  }


  private onSearchResultSelected(book: SearchBook, variants: SearchBook[] = []): void {
    this.searchDetailCandidates = [book, ...variants.filter((candidate: SearchBook): boolean =>
      (candidate.sourceId !== book.sourceId || candidate.bookId !== book.bookId) &&
      (book.groupKey !== undefined && candidate.groupKey === book.groupKey ||
        candidate.title === book.title && candidate.author === book.author))];
    if (book.sourceId === LOCAL_SOURCE_ID) {
      const visibleBook = this.shelfBooks.find((item: ShelfBook): boolean =>
        item.sourceId === LOCAL_SOURCE_ID && item.bookId === book.bookId);
      if (visibleBook !== undefined) {
        this.openLocalBookDetail(visibleBook);
      } else {
        // Search membership may be a sparse Core projection. Resolve the
        // result's exact identity to a full offscreen DTO before opening it.
        const owner = ReaderRuntimeOwner.current();
        const generation = this.nextNavigationGeneration();
        const candidates = this.searchDetailCandidates;
        const current = (): boolean => generation === this.navigationGeneration &&
          this.route === 'search' && this.searchDetailCandidates === candidates &&
          this.isCurrentRuntime(owner);
        void this.bookshelfHost.loadShelfBook(LOCAL_SOURCE_ID, book.bookId)
          .then((stored: ShelfBook | undefined): void => {
            if (!current()) return;
            if (stored === undefined) {
              this.refreshSearchShelfMembership();
              this.showReadingFailure('本地书籍已移除', '这本书已不在书架中，请重新搜索。');
              return;
            }
            this.openLocalBookDetail(stored);
          })
          .catch((error: Error): void => {
            if (current()) this.showReadingFailure('打开本地书籍失败', error.message);
          });
      }
      return;
    }
    // The search badge describes a saved work, not just this source URL. Keep
    // its exact durable identity so changing source owns the existing row.
    const shelfMatch = resolveBookshelfBook(book.sourceId, book.bookId, book.title, book.author,
      this.searchHost.publication.shelfAt(this.searchPublicationRevision).concat(this.shelfBooks),
      book.authorIdentity, book.sourceRuleVersion);
    if (shelfMatch.kind === 'ambiguous') {
      this.showReadingFailure('书架中有多个版本', '请从书架选择要阅读或换源的版本，已有书籍不会自动合并。');
      return;
    }
    if (shelfMatch.kind === 'matched') {
      const saved = shelfMatch.book;
      const seed: RemoteReadingBookSeed = { sourceId: saved.sourceId, bookId: saved.bookId,
        detailUrl: saved.bookId, title: saved.title, author: saved.author, coverUrl: saved.coverUrl,
        intro: saved.intro, kind: saved.kind, lastChapter: saved.lastChapter };
      this.openRemoteBookDetail(seed, saved.sourceName ?? this.sourceDisplayName(saved.sourceId), saved);
      return;
    }
    // Unsaved works retain every source candidate. The shared scheduler bounds concurrency.
    const ordered: SearchBook[] = [book];
    for (const candidate of this.searchDetailCandidates) {
      if (candidate.sourceId === book.sourceId && candidate.bookId === book.bookId) {
        continue;
      }
      ordered.push(candidate);
    }
    const seeds: RemoteReadingBookSeed[] = [];
    const sourceNames: string[] = [];
    for (const candidate of ordered) {
      const duplicate = seeds.some((admitted: RemoteReadingBookSeed): boolean =>
        admitted.sourceId === candidate.sourceId && admitted.bookId === candidate.bookId);
      if (duplicate) {
        continue;
      }
      const seed = this.remoteSeedForSearchBook(candidate);
      seeds.push(seed);
      sourceNames.push(candidate.sourceName);
    }
    // A search result that is already on the shelf has a durable Core
    // snapshot. Pass it through so detail/TOC opens cache-first instead of
    // issuing a second live detail+TOC sweep for the same identity.
    const shelfSnapshot = this.shelfBooks.find((item: ShelfBook): boolean =>
      item.sourceId === book.sourceId && item.bookId === book.bookId);
    this.openRemoteBookDetail(seeds[0], sourceNames[0], shelfSnapshot, false,
      seeds.slice(1), sourceNames.slice(1));
  }

  private openShelfBook(selection: ShelfBook): void {
    if (this.route === 'bookshelf') {
      this.beginReadingStartupTrace?.();
      this.shelfEntryTraceAttempt += 1;
      this.shelfEntryTraceStartedAt = Date.now();
      this.shelfEntryTraceGeneration = this.navigationGeneration;
      this.traceShelfEntryPhase?.('tap');
      this.readingOriginRoute = 'bookshelf';
    }
    if (selection.sourceId === LOCAL_SOURCE_ID) {
      this.openLocalBookDetail(selection, true);
      return;
    }
    ReaderRuntimeOwner.current().noteReadingPreparationIntent(selection.sourceId, selection.bookId);
    this.openRemoteBookDetail({
      sourceId: selection.sourceId,
      bookId: selection.bookId,
      detailUrl: selection.bookId,
      title: selection.title,
      author: selection.author,
      coverUrl: selection.coverUrl,
      intro: selection.intro,
      lastChapter: selection.lastChapter,
    }, this.sourceDisplayName(selection.sourceId, selection.sourceName), selection, true);
  }

  private getReadingEntryHost(): ReadingEntryHost | undefined {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner)) return undefined;
    const host = ReadingEntryHost.forRuntime(owner);
    this.readingEntryHost = host;
    return host;
  }

  private readingEntryLease(owner: ReaderRuntimeOwner): ReadingEntryLease {
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const current = (): boolean => !this.shelfReceiptRetired && this.mountedRuntimeOwner === owner &&
      this.isCurrentRuntime(owner) && generation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount;
    return { isCurrent: current,
      projectionAllowed: (): boolean => current() && this.route === 'detail' && !this.readingSessionActive && !this.sourceSwitchVisible,
      currentDirectory: (): LocalReadingTocEntry[] => this.detailToc,
      offlineGeneration: (): number => this.offlineOperation?.generation ?? 0,
      membership: () => {
        const admission = this.detailBook === undefined ? EMPTY_READABLE_ADMISSION : this.detailReadableAdmission(this.detailBook);
        return { generation: JSON.stringify([this.shelfOperation.generation, admission.generation]),
          blocked: this.shelfOperation.busy || this.shelfOperation.removalKey.length > 0 || admission.adding || admission.cancelling ||
            admission.confirmation === 'unknown', value: this.detailInBookshelf };
      },
      changed: (snapshot: ReadingEntrySnapshot): void => { if (current()) this.applyReadingEntrySnapshot(snapshot); },
      cacheDecision: (error: RemoteChapterCacheRefreshError, guard: () => boolean): Promise<boolean> =>
        this.chooseCachedChapterRefresh(error, (): boolean => current() && guard()),
      notice: (title: string, message: string): void => { if (current()) this.showReadingFailure(title, message); },
      refreshShelf: (): void => { if (current()) this.refreshBookshelf(); },
      diagnostic: (stage: string, message: string): void => {
        if (current()) hilog.warn(DOMAIN, 'Reader', 'Reading entry %{public}s: %{private}s', stage, message);
      },
    };
  }

  private applyReadingEntrySnapshot(snapshot: ReadingEntrySnapshot): void {
    this.readingEntryScopeId = snapshot.scopeId;
    this.detailBook = snapshot.book;
    this.remoteReadingSession = snapshot.session;
    this.remoteSessionGeneration = snapshot.sessionGeneration;
    this.remoteReadingSeed = snapshot.seed ?? (snapshot.book !== undefined && snapshot.book.sourceId !== LOCAL_SOURCE_ID ?
      { sourceId: snapshot.book.sourceId, bookId: snapshot.book.bookId, detailUrl: snapshot.book.bookId,
        title: snapshot.book.title, author: snapshot.book.author, kind: snapshot.book.kind, coverUrl: snapshot.book.coverUrl,
        intro: snapshot.book.intro, lastChapter: snapshot.book.lastChapter, sourceVersion: snapshot.session?.sourceVersion } : undefined);
    this.detailToc = snapshot.toc;
    this.detailInBookshelf = snapshot.inBookshelf;
    this.detailLoadingMessage = snapshot.loadingMessage;
    this.remoteContentVerdict = snapshot.verdict;
  }

  private bindReadingEntryReader(): void {
    const owner = this.mountedRuntimeOwner, book = this.detailBook;
    const host = this.getReadingEntryHost();
    if (owner === undefined || book === undefined || host === undefined) return;
    const session = this.remoteReadingSession?.identity.sourceId === book.sourceId &&
      this.remoteReadingSession?.identity.bookId === book.bookId ? this.remoteReadingSession : undefined;
    host.bindReader(book, session, this.detailToc, this.detailInBookshelf, this.readingEntryLease(owner));
  }

  private retireReadingEntryPresentation(): void {
    const host = this.readingEntryHost;
    if (host !== undefined && host.snapshot().scopeId === this.readingEntryScopeId) host.retire();
    this.readingEntryScopeId = -1;
    this.pendingRemoteDirectoryProjection = undefined;
    this.pendingLocalDirectoryProjection = undefined;
  }

  private readingPreparationContext(owner: ReaderRuntimeOwner): ReadingPreparationContext {
    const mounting = this.detailShelfAdmissionMount;
    return {
      isCurrent: (): boolean => !this.shelfReceiptRetired && this.mountedRuntimeOwner === owner &&
        this.isCurrentRuntime(owner) && mounting === this.detailShelfAdmissionMount,
      foreground: (): boolean => this.searchAppForeground,
      shelfVisible: (): boolean => this.route === 'bookshelf',
      readingActive: (): boolean => this.readingSessionActive,
      settingsAvailable: (): boolean => this.applicationSettingsSnapshot !== undefined,
      revision: (): string | undefined => this.shelfProjectionRevision,
      diagnostic: (message: string): void => { hilog.warn(DOMAIN, 'Reader', 'Persistent shelf preparation: %{private}s', message); },
    };
  }

  private sharedReadingPreparationSeeds(owner: ReaderRuntimeOwner): ReadingSharedShelfSeeds | undefined {
    const shared = this.bookshelfBackgroundSeeds;
    return shared?.owner === owner ? { runtime: owner, revision: shared.revision, seeds: shared.seeds } : undefined;
  }

  private preparePersistedShelfBooks(): void {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || !this.isCurrentRuntime(owner) || this.shelfReceiptRetired) return;
    ReadingEntryHost.forRuntime(owner).preparePersisted(this.readingPreparationContext(owner),
      this.sharedReadingPreparationSeeds(owner));
  }

  private prepareVisibleReadingBooks(books: ShelfBook[]): void {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || !this.isCurrentRuntime(owner) || this.shelfReceiptRetired) return;
    ReadingEntryHost.forRuntime(owner).prepareVisible(books, this.readingPreparationContext(owner),
      this.sharedReadingPreparationSeeds(owner));
  }

  private beginReadingStartupTrace(): void {
    this.readingReadyGeneration += 1;
    this.startupEntryId = ReaderStartupTrace.current()?.beginEntry() ?? 0;
  }

  private traceStartupStage(stage: string, status: string = 'event', readingEntry: boolean = false): void {
    ReaderStartupTrace.current()?.mark(stage, status, readingEntry ? this.startupEntryId : 0);
  }

  private beginStartupStage(stage: string): number {
    return ReaderStartupTrace.current()?.begin(stage) ?? -1;
  }

  private endStartupStage(stage: string, startedAt: number, status: string): void {
    ReaderStartupTrace.current()?.end(stage, startedAt, status);
  }

  private traceShelfEntryPhase(phase: string): void {
    try {
      if (this.shelfEntryTraceStartedAt < 0 || this.shelfEntryTraceGeneration !== this.navigationGeneration) return;
      this.traceStartupStage?.(`shelf-entry.${phase}`, 'event', true);
      hilog.info(DOMAIN, 'Reader',
        'PERF shelf-entry phase=%{public}s attempt=%{public}d navigation=%{public}d elapsedMs=%{public}d',
        phase, this.shelfEntryTraceAttempt, this.navigationGeneration,
        Math.max(0, Date.now() - this.shelfEntryTraceStartedAt));
    } catch (_) { /* Diagnostics never own navigation or admission. */ }
  }

  private openShelfBookInfo(selection: ShelfBook): void {
    if (selection.sourceId === LOCAL_SOURCE_ID) {
      this.openLocalBookDetail(selection, false);
      return;
    }
    this.openRemoteBookDetail({
      sourceId: selection.sourceId,
      bookId: selection.bookId,
      detailUrl: selection.bookId,
      title: selection.title,
      author: selection.author,
      coverUrl: selection.coverUrl,
      intro: selection.intro,
      lastChapter: selection.lastChapter,
    }, this.sourceDisplayName(selection.sourceId, selection.sourceName), selection, false);
  }

  private openLocalBookDetail(selection: ShelfBook, resumeImmediately: boolean = false): void {
    const owner = this.mountedRuntimeOwner;
    if (selection.sourceId !== LOCAL_SOURCE_ID || owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner)) return;
    const originRoute = this.route, generation = this.nextNavigationGeneration();
    const entryRoute = resumeImmediately ? this.readingOriginRoute : 'detail';
    if (resumeImmediately && entryRoute === 'bookshelf') this.shelfEntryTraceGeneration = generation;
    this.readingOriginRoute = entryRoute;
    this.shelfReadingPreparation = entryRoute === 'bookshelf';
    this.detailReturnRoute = originRoute === 'search' ? 'search' : 'bookshelf';
    this.readingSessionActive = false;
    this.sourceSwitchFailureMessage = '';
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.requestedChapterIndex = undefined;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.route = entryRoute;
    const host = this.getReadingEntryHost();
    if (host === undefined) return;
    void host.openLocal(selection, this.readingEntryLease(owner), resumeImmediately);
    if (resumeImmediately) this.openReading(undefined);
  }

  private openRemoteBookDetail(
    seed: RemoteReadingBookSeed,
    sourceName: string,
    shelfSnapshot: ShelfBook | undefined = undefined,
    resumeImmediately: boolean = false,
    fallbackSeeds: RemoteReadingBookSeed[] = [],
    fallbackSourceNames: string[] = [],
    retainedDetailReturnRoute: DetailReturnRoute | undefined = undefined,
    validatedSession: RemoteReadingSession | undefined = undefined,
    retainAdmissionThroughProbe: boolean = false,
  ): void {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || !this.isCurrentRuntime(owner) || this.shelfReceiptRetired) return;
    const retainedSession = this.remoteReadingSession;
    const originRoute = this.route, generation = this.nextNavigationGeneration();
    const entryRoute = resumeImmediately ? this.readingOriginRoute : 'detail';
    if (resumeImmediately && entryRoute === 'bookshelf') this.shelfEntryTraceGeneration = generation;
    this.readingOriginRoute = entryRoute;
    this.shelfReadingPreparation = entryRoute === 'bookshelf';
    this.detailReturnRoute = retainedDetailReturnRoute ?? (originRoute === 'search' ? 'search' : 'bookshelf');
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.sourceSwitchFailureMessage = '';
    this.requestedChapterIndex = undefined;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.route = entryRoute;
    const host = this.getReadingEntryHost();
    if (host === undefined) return;
    const candidates = [seed, ...fallbackSeeds].map((candidate: RemoteReadingBookSeed): BookAcquisitionCandidate => {
      const row = this.searchDetailCandidates.find((book: SearchBook): boolean =>
        book.sourceId === candidate.sourceId && book.bookId === candidate.bookId);
      return row === undefined ? { seed: candidate, catalogReady: false, failed: false } : this.searchAcquisitionCandidate(row);
    });
    void host.openRemote({ seed, sourceName, shelfSnapshot, shelfBooks: this.shelfBooks,
      fromSearch: originRoute === 'search', sourceSwitchPending: this.pendingSourceSwitch !== undefined,
      resumeImmediately, fallbackSeeds, fallbackSourceNames, candidates, validatedSession, retainedSession,
      retainAdmissionThroughProbe }, this.readingEntryLease(owner));
    if (resumeImmediately) this.openReading(undefined);
  }





  private downloadDirectoryChapter(chapterIndex: number): void {
    const owner = this.mountedRuntimeOwner;
    const session = this.remoteReadingSession;
    if (owner === undefined || session === undefined || !this.isKnownDetailChapter(chapterIndex)) return;
    const host = this.getReadingOfflineHost(owner);
    if (host !== undefined) void host.downloadChapter(chapterIndex, this.offlineBinding(owner, session));
  }

  private downloadDirectoryBook(): void {
    const owner = this.mountedRuntimeOwner;
    const session = this.remoteReadingSession;
    if (owner === undefined || session === undefined) return;
    const host = this.getReadingOfflineHost(owner);
    if (host === undefined) return;
    if (host.busy()) { this.showOfflineDownloadFeedback('章节下载正在进行，请在目录查看进度'); return; }
    const total = session.entries.filter(entry => entry.navigable !== false && entry.url.trim().length > 0).length;
    if (total === 0) { this.showOfflineDownloadFeedback('当前书籍没有可下载的在线章节'); return; }
    this.showOfflineDownloadFeedback(`开始下载 ${total} 章，可在目录查看进度`);
    void host.downloadBook(this.offlineBinding(owner, session));
  }

  private offlineBinding(owner: ReaderRuntimeOwner, session: RemoteReadingSession): ReadingOfflineBinding {
    const identity = this.directoryOperationBindingId();
    const current = (): boolean => this.isCurrentDirectoryOperationBinding(identity, owner) &&
      this.remoteReadingSession === session;
    let lastFeedbackAt = Date.now();
    let lastFeedbackKey = '0:0:0';
    return { session, current, currentEntries: (): LocalReadingTocEntry[] => this.detailToc,
      emitEntries: (entries: LocalReadingTocEntry[]): void => this.applyOwnedDirectoryEntries(entries),
      emitOperation: (operation: ReadingOfflineOperation): void => {
        this.offlineOperation = { action: operation.action, sourceId: operation.sourceId, bookId: operation.bookId,
          chapterIndex: operation.chapterIndex, generation: operation.generation, materialization: operation.materialization,
          materializationFailure: operation.materializationFailure, operationFailure: operation.operationFailure,
          canContinueOriginal: operation.canContinueOriginal, blockingClear: operation.blockingClear,
          progress: operation.progress, projection: operation.projection };
        this.offlineOperationActive = operation.materialization === 'running';
      },
      onProgress: (progress: ReadingOfflineBookProgress, finished: boolean): void => {
        const key = `${progress.completedChapters}:${progress.cachedChapters}:${progress.failedChapters}`;
        if (finished || (Date.now() - lastFeedbackAt >= 5000 && progress.processedChapters < progress.totalChapters && key !== lastFeedbackKey)) {
          lastFeedbackAt = Date.now(); lastFeedbackKey = key;
          this.showOfflineDownloadFeedback(this.offlineDownloadFeedback(session, progress, finished));
        }
      },
      failed: (error: Error): void => { hilog.error(DOMAIN, 'Reader', 'Offline operation/projection: %{private}s', error.message); } };
  }

  private offlineDownloadFeedback(session: RemoteReadingSession, progress: ReadingOfflineBookProgress, finished: boolean): string {
    const total = progress.totalChapters;
    if (finished && progress.completedChapters === total) return `全部 ${total} 章下载完成`;
    let message = `${finished ? '下载结果' : '正在下载'}：已完成 ${progress.completedChapters}/${total} 章`;
    if (progress.cachedChapters > 0) message += `，另有 ${progress.cachedChapters} 章正文已缓存`;
    if (progress.failedChapters > 0) {
      message += `，${progress.failedChapters} 章失败`;
      if (progress.firstFailure !== undefined) {
        const title = session.entries.find(entry => entry.index === progress.firstFailure?.chapterIndex)?.title.trim();
        const label = title === undefined || title.length === 0 ? `目录第 ${progress.firstFailure.chapterIndex + 1} 项` :
          (title.length > 32 ? `${title.slice(0, 32)}…` : title);
        message += `（${label}：${progress.firstFailure.reason}）`;
      }
    } else if (finished) message += '，其余章节尚未完成';
    return message;
  }

  private showOfflineDownloadFeedback(message: string): void {
    try {
      this.getUIContext().getPromptAction().showToast({ message });
    } catch (_) {
      // Presentation must not cancel the durable Core download operation.
    }
  }

  private requestClearDirectoryBookOffline(): void {
    if (this.remoteReadingSession === undefined || this.offlineOperationActive) {
      return;
    }
    const session = this.remoteReadingSession;
    const generation = this.remoteSessionGeneration;
    this.showIndexAlert('confirmation-cancelable', {
      title: '清除本书离线内容',
      message: '将删除本书已下载的正文和图片，书架、阅读进度与书签不会受影响。',
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '清除',
        fontColor: readerAppColor('app.Index.requestClearDirectoryBookOffline.showAlertDialog.FFB42318', this.appThemeScheme),
        action: (): void => this.clearDirectoryBookOffline(),
      },
    }, (): boolean => this.remoteReadingSession === session && this.remoteSessionGeneration === generation &&
      !this.offlineOperationActive);
  }

  private clearDirectoryBookOffline(): void {
    const owner = this.mountedRuntimeOwner;
    const session = this.remoteReadingSession;
    if (owner === undefined || session === undefined) return;
    const host = this.getReadingOfflineHost(owner);
    if (host !== undefined) void host.clearBook(this.offlineBinding(owner, session));
  }

  private detailBookKey(book: ReadingBookDetail): string {
    return `${book.sourceId}\u0000${book.bookId}`;
  }

  private shelfBookKey(book: ShelfBook): string {
    return `${book.sourceId}\u0000${book.bookId}`;
  }

  /**
   * 书签 tab 的会话期静态书籍身份。libraryBookId 复用 searchDetailKey 生成的
   * `sourceId + bookId` 复合键 —— 与 shelfBookKey/searchDetailKey 同一口径,
   * 保证书签存储键与书架/详情身份对齐 (跨会话稳定, 同一本书两处入口同键)。
   * 标题为空的 detail 视为尚未投影完成, 不注入身份 (面板走章首降级)。
   */
  private detailBookmarkIdentity(): ReaderBookIdentity | undefined {
    const book = this.detailBook;
    if (book === undefined || book.title.trim().length === 0) {
      return undefined;
    }
    return {
      libraryBookId: this.searchDetailKey(book.sourceId, book.bookId),
      sourceId: book.sourceId,
      bookId: book.bookId,
      bookName: book.title,
      bookAuthor: book.author,
    };
  }

  private isSameDetailBook(book: ReadingBookDetail): boolean {
    return this.detailBook?.sourceId === book.sourceId && this.detailBook?.bookId === book.bookId;
  }

  private canRemoveDetailBook(book: ReadingBookDetail): boolean {
    return this.route === 'detail' && this.isSameDetailBook(book) && !this.readingSessionActive &&
      !this.sourceSwitchVisible && this.pendingSourceSwitch === undefined &&
      this.sourceSwitchHost?.blocksExit(book) !== true &&
      !this.offlineOperationActive &&
      this.shelfOperation.removalKey.length === 0 && !this.shelfOperation.busy && !this.hasUnknownShelfWrite();
  }

  private requestDetailShelfMutation(): void {
    if (this.detailInBookshelf) {
      this.requestRemoveDetailBook();
      return;
    }
    this.addDetailBook();
  }

  private detailShelfAdmissionIdentity(): string {
    const book = this.detailBook;
    return book === undefined ? '' : `${this.detailShelfAdmissionMount}:${this.navigationGeneration}:${JSON.stringify([book.sourceId, book.bookId])}`;
  }

  private isCurrentDetailShelfAdmission(identity: string | undefined): boolean {
    return identity !== undefined && identity === this.detailShelfAdmissionIdentity() && !this.shelfReceiptRetired &&
      this.isCurrentRuntime(this.mountedRuntimeOwner) && this.route === 'detail';
  }

  private detailReadableAdmission(book: ReadingBookDetail): BookshelfReadableAdmissionSnapshot {
    return this.readableAdmissions.find((snapshot: BookshelfReadableAdmissionSnapshot): boolean => snapshot.key === this.detailBookKey(book)) ?? EMPTY_READABLE_ADMISSION;
  }

  private readableAdmissionCurrent(identity: RemoteReadingIdentity, owner: ReaderRuntimeOwner, navigation: number): boolean {
    return !this.shelfReceiptRetired && this.isCurrentRuntime(owner) && this.navigationGeneration === navigation &&
      this.route === 'detail' && this.detailBook?.sourceId === identity.sourceId && this.detailBook?.bookId === identity.bookId;
  }

  private publishReadableAdmission(effect: BookshelfReadableAdmissionEffect): void {
    if (effect.snapshot.membership !== undefined) {
      this.detailInBookshelf = effect.snapshot.membership;
      if (effect.snapshot.membership) { this.refreshBookshelf(); this.refreshSearchShelfMembership(); }
    } else if (effect.duplicate) this.refreshSearchShelfMembership();
  }

  private addDetailBook(): void {
    const book = this.detailBook;
    const session = this.remoteReadingSession;
    if (book === undefined || session === undefined || book.sourceId === LOCAL_SOURCE_ID || !this.canRemoveDetailBook(book)) return;
    if (session.identity.sourceId !== book.sourceId || session.identity.bookId !== book.bookId) {
      this.showReadingFailure('加入书架失败', '书籍详情已变更，请重新打开详情后再加入书架。'); return;
    }
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || !this.isCurrentRuntime(owner)) return;
    const navigation = this.navigationGeneration;
    const identity: RemoteReadingIdentity = {sourceId: book.sourceId, bookId: book.bookId};
    void this.bookshelfHost.readable(owner).add({
      sourceId: session.identity.sourceId, bookId: session.identity.bookId, title: session.book.title,
      author: session.book.author, coverUrl: session.book.coverUrl, intro: session.book.intro,
      kind: session.book.kind, lastChapter: session.book.lastChapter,
    }, (): boolean => this.readableAdmissionCurrent(identity, owner, navigation),
      (effect: BookshelfReadableAdmissionEffect): void => this.publishReadableAdmission(effect));
  }

  private cancelDetailBookAddition(): void {
    const book = this.detailBook; const owner = this.mountedRuntimeOwner;
    if (book === undefined || owner === undefined || !this.isCurrentRuntime(owner)) return;
    const navigation = this.navigationGeneration;
    const identity: RemoteReadingIdentity = {sourceId: book.sourceId, bookId: book.bookId};
    void this.bookshelfHost.readable(owner).cancel(book.sourceId, book.bookId,
      (): boolean => this.readableAdmissionCurrent(identity, owner, navigation),
      (effect: BookshelfReadableAdmissionEffect): void => this.publishReadableAdmission(effect));
  }

  private isCurrentBookRemoval(presentation: number, generation: number, owner: ReaderRuntimeOwner | undefined,
    mounting: number): boolean {
    return owner !== undefined && !this.shelfReceiptRetired && this.bookRemovalDialogOpen &&
      presentation === this.bookRemovalPresentation && generation === this.navigationGeneration &&
      mounting === this.detailShelfAdmissionMount && this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner);
  }

  private openBookRemovalDialog(message: string, action: () => void): void {
    const owner = this.mountedRuntimeOwner;
    if (this.bookRemovalDialogOpen || owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner)) return;
    const generation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const presentation = ++this.bookRemovalPresentation;
    this.bookRemovalMessage = message;
    this.bookRemovalConfirmAction = (): void => {
      if (presentation === this.bookRemovalPresentation && generation === this.navigationGeneration &&
        mounting === this.detailShelfAdmissionMount && !this.shelfReceiptRetired &&
        this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner)) action();
    };
    this.bookRemovalDialogOpen = true;
    // Native controller and its temporary child are created for this opening.
    // An old physical callback never reads the next opening's action/controller.
    let controller: CustomDialogController | undefined;
    controller = new CustomDialogController({
      builder: (): void => this.bookRemovalDialogContent(message, presentation, generation, owner, mounting, controller!),
      alignment: DialogAlignment.Center,
      customStyle: true,
      autoCancel: true,
      cancel: (): void => {
        if (this.isCurrentBookRemoval(presentation, generation, owner, mounting)) this.dismissBookRemovalDialog(presentation);
      },
    });
    this.bookRemovalDialogController = controller;
    controller.open();
  }

  @Builder
  private bookRemovalDialogContent(message: string, presentation: number, generation: number, owner: ReaderRuntimeOwner,
    mounting: number, controller: CustomDialogController) {
    BookRemovalDialog({
      controller,
      message,
      onCancel: (): void => {
        if (this.isCurrentBookRemoval(presentation, generation, owner, mounting)) this.dismissBookRemovalDialog(presentation);
      },
      onConfirm: (): void => {
        if (this.isCurrentBookRemoval(presentation, generation, owner, mounting)) this.confirmBookRemovalDialog(presentation);
      },
    });
  }

  private dismissBookRemovalDialog(presentation: number = this.bookRemovalPresentation): void {
    if (presentation !== this.bookRemovalPresentation) return;
    const wasOpen = this.bookRemovalDialogOpen, controller = this.bookRemovalDialogController;
    this.bookRemovalDialogOpen = false; this.bookRemovalConfirmAction = undefined;
    this.bookRemovalDialogController = undefined;
    if (wasOpen) controller?.close();
  }

  private confirmBookRemovalDialog(presentation: number = this.bookRemovalPresentation): void {
    if (!this.bookRemovalDialogOpen || presentation !== this.bookRemovalPresentation) return;
    const action = this.bookRemovalConfirmAction;
    this.dismissBookRemovalDialog(presentation);
    action?.();
  }

  private requestRemoveDetailBook(): void {
    const book = this.detailBook;
    if (book === undefined || !this.canRemoveDetailBook(book)) {
      return;
    }
    const message = book.sourceId === LOCAL_SOURCE_ID ?
      `确定将“${book.title}”从书架移除吗？应用内解析内容、阅读进度和离线任务将一并删除；系统中的原始文件不受影响。` :
      `确定将“${book.title}”从书架移除吗？书源、阅读进度和已缓存正文不会删除，可再次通过搜索加入书架。`;
    this.openBookRemovalDialog(message, (): void => {
      if (this.canRemoveDetailBook(book)) {
        this.removeDetailBook(book);
      }
    });
  }

  private requestRemoveShelfBook(book: ShelfBook): void {
    if (!this.canRemoveShelfBook(book)) {
      return;
    }
    const message = book.sourceId === LOCAL_SOURCE_ID ?
      `确定将“${book.title}”从书架移除吗？应用内解析内容、阅读进度和离线任务将一并删除；系统中的原始文件不受影响。` :
      `确定将“${book.title}”从书架移除吗？书源、阅读进度和已缓存正文不会删除，可再次通过搜索加入书架。`;
    this.openBookRemovalDialog(message, (): void => {
      if (this.canRemoveShelfBook(book)) {
        this.removeShelfBook(book);
      }
    });
  }

  private requestRemoveShelfBooks(keys: string[]): void {
    if (this.route !== 'bookshelfMultiSelect' || this.shelfOperation.batchRemovalBusy) {
      return;
    }
    if (!this.bookshelfSelectionReady) return;
    const selected = this.bookshelfSelectionBooks.filter((book: ShelfBook): boolean => keys.includes(this.shelfBookKey(book)));
    if (selected.length === 0) {
      return;
    }
    this.openBookRemovalDialog(`确定将已选择的 ${selected.length} 本书移出书架吗？本地原始文件不受影响。`, (): void => {
      if (this.route === 'bookshelfMultiSelect' && !this.shelfOperation.batchRemovalBusy) {
        this.removeShelfBooks(selected);
      }
    });
  }

  private removeShelfBooks(books: ShelfBook[]): void {
    if (this.route !== 'bookshelfMultiSelect' || this.shelfOperation.busy || books.length === 0 || this.hasUnknownShelfWrite()) return;
    const owner = ReaderRuntimeOwner.current(); const navigation = this.navigationGeneration;
    const current = (): boolean => !this.shelfReceiptRetired && this.isCurrentRuntime(owner) &&
      navigation === this.navigationGeneration && this.route === 'bookshelfMultiSelect';
    const targets = books.map((book: ShelfBook): BookshelfRemovalTarget => ({ sourceId: book.sourceId, bookId: book.bookId }));
    void this.bookshelfHost.operations(owner).remove(targets, true, this.shelfFilter(), current).then((outcome): void => {
      if (outcome === undefined || !current()) return;
      if (outcome.shelf !== undefined) this.applyBookshelfState(outcome.shelf);
      this.bookshelfMultiSelectInitialKey = ''; this.nextNavigationGeneration(); this.route = 'bookshelf';
    });
  }

  private canRemoveShelfBook(book: ShelfBook): boolean {
    return this.route === 'bookshelf' && !this.readingSessionActive &&
      this.shelfOperation.removalKey.length === 0 && !this.shelfOperation.busy && !this.hasUnknownShelfWrite() &&
      this.shelfBooks.some((candidate: ShelfBook): boolean =>
        candidate.sourceId === book.sourceId && candidate.bookId === book.bookId);
  }

  private removeShelfBook(book: ShelfBook): void {
    if (!this.canRemoveShelfBook(book)) return;
    const owner = ReaderRuntimeOwner.current(); const navigation = this.navigationGeneration;
    const current = (): boolean => !this.shelfReceiptRetired && this.isCurrentRuntime(owner) &&
      navigation === this.navigationGeneration && this.route === 'bookshelf';
    void this.bookshelfHost.operations(owner).remove([{ sourceId: book.sourceId, bookId: book.bookId }], false, this.shelfFilter(), current)
      .then((outcome): void => { if (outcome !== undefined && current() && outcome.shelf !== undefined) this.applyShelfBookRemoval(outcome.shelf); });
  }

  private applyShelfBookRemoval(shelf: BookshelfDataState): void {
    this.invalidateBookshelfProjection();
    if (this.route === 'bookshelf') {
      this.applyBookshelfState(shelf);
    }
  }

  private removeDetailBook(book: ReadingBookDetail): void {
    if (!this.canRemoveDetailBook(book)) return;
    const owner = ReaderRuntimeOwner.current(); const navigation = this.navigationGeneration;
    const current = (): boolean => !this.shelfReceiptRetired && this.isCurrentRuntime(owner) &&
      navigation === this.navigationGeneration && this.route === 'detail' && this.isSameDetailBook(book);
    void this.bookshelfHost.operations(owner).remove([{ sourceId: book.sourceId, bookId: book.bookId }], false, this.shelfFilter(), current)
      .then((outcome): void => {
        if (outcome === undefined || !current()) return;
        if (outcome.receipt.receipt.confirmation === 'confirmed') {
          if (outcome.shelf !== undefined) this.applyDetailBookRemoval(book, outcome.shelf); else this.returnFromDetail();
        } else { if (outcome.shelf !== undefined) this.applyBookshelfState(outcome.shelf); this.returnFromDetail(); }
      });
  }

  private emptyShelfRecovery(): ReaderRecoveryView {
    return { message: '', visible: false, canRetry: false, generation: 0 };
  }

  private hasUnknownShelfWrite(): boolean {
    return this.isCurrentRuntime(this.shelfOperationOwner) &&
      (this.shelfOperation.receipt?.receipt.confirmation === 'unknown' || this.shelfOperation.removalMutation?.blocked === true);
  }

  private canContinueShelfRemoval(): boolean {
    const original = this.shelfOperation.removalMutation;
    return this.isCurrentRuntime(this.shelfOperationOwner) && !this.shelfOperation.busy && !this.shelfOperation.reconcileBusy &&
      original?.blocked === true && original.canContinueOriginal &&
      (original.method === 'bookshelf.remove' || original.method === 'bookshelf.removeBatch');
  }

  private shelfRecovery(): ReaderRecoveryView {
    const catalog = this.isCurrentRuntime(this.bookshelfCatalogOwner) ? readerRecoveryView(undefined, this.bookshelfCatalogFacts) : this.emptyShelfRecovery();
    if (!this.isCurrentRuntime(this.shelfOperationOwner)) return catalog;
    const original = this.shelfOperation.removalMutation;
    if (original?.blocked) return { message: original.message || '原书架操作尚待核对，已保留原内容', visible: true,
      canRetry: (original.method === 'bookshelf.remove' || original.method === 'bookshelf.removeBatch') &&
        !this.shelfOperation.busy && !this.shelfOperation.reconcileBusy, generation: this.shelfOperation.generation };
    const recovery = readerRecoveryView(this.shelfOperation.receipt);
    if (this.shelfOperation.cleanupWarning.length === 0) return recovery.visible ? recovery : catalog;
    return { message: (recovery.visible ? `${recovery.message}；` : '书籍已移出书架；') +
      `应用内 EPUB 文件清理未完成：${this.shelfOperation.cleanupWarning}`,
      visible: true, canRetry: recovery.canRetry, generation: this.shelfOperation.generation };
  }

  private async reconcileShelfWrite(generation: number): Promise<void> {
    const owner = this.shelfOperationOwner;
    if (owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner) || this.route !== 'bookshelf') return;
    const navigation = this.navigationGeneration; const identity = this.shelfOperation.importIdentity;
    const dialogVisible = this.hasVisibleImportDialog();
    const current = (): boolean => !this.shelfReceiptRetired && this.isCurrentRuntime(owner) && navigation === this.navigationGeneration &&
      this.route === 'bookshelf' && (!dialogVisible || identity === this.shelfOperation.importIdentity);
    const read = await this.bookshelfHost.operations(owner).reconcile(generation, this.shelfFilter(), current);
    if (read !== undefined && current() && read.value !== undefined) { this.invalidateBookshelfProjection(); this.applyBookshelfState(read.value); }
  }

  private async continueShelfRemoval(generation: number): Promise<void> {
    const owner = this.shelfOperationOwner;
    if (owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner) || this.route !== 'bookshelf' ||
      generation !== this.shelfOperation.generation || !this.canContinueShelfRemoval()) return;
    const navigation = this.navigationGeneration; const mounting = this.detailShelfAdmissionMount;
    const current = (): boolean => this.isCurrentBookshelfPresentation(navigation, owner, mounting);
    const read = await this.bookshelfHost.operations(owner).continueRemoval(generation, this.shelfFilter(), current);
    if (current() && read?.value !== undefined) { this.invalidateBookshelfProjection(); this.applyBookshelfState(read.value); }
  }

  private applyDetailBookRemoval(book: ReadingBookDetail, shelf: BookshelfDataState): void {
    // The mutation result is newer than every shelf read already in flight.
    this.invalidateBookshelfProjection();
    if (this.route === 'detail' && this.isSameDetailBook(book)) {
      this.returnFromDetail();
      // `returnToBookshelf` starts its own read; prefer the exact state already
      // returned by the completed mutation and invalidate that redundant read.
      this.invalidateBookshelfProjection();
      this.applyBookshelfState(shelf);
      return;
    }
    if (this.route === 'bookshelf') {
      this.applyBookshelfState(shelf);
    }
  }

  private openReading(chapterIndex: number | undefined): void {
    const book = this.detailBook;
    if (book === undefined || (chapterIndex !== undefined && !this.isKnownDetailChapter(chapterIndex)) ||
      this.shelfOperation.removalKey.length > 0) {
      return;
    }
    const traceShelfEntry = this.shelfReadingPreparation &&
      this.shelfEntryTraceGeneration === this.navigationGeneration;
    if (!traceShelfEntry) this.beginReadingStartupTrace?.();
    this.nextNavigationGeneration();
    if (traceShelfEntry) this.shelfEntryTraceGeneration = this.navigationGeneration;
    this.shelfReadingPreparation = this.route === 'bookshelf';
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.requestedChapterIndex = chapterIndex;
    this.requestedBookmarkAnchor = undefined;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    // The existing reader owns chapter acquisition, loading and recovery.
    // Neither a catalog nor a successful body is a navigation prerequisite.
    this.readingSessionActive = true;
    this.route = 'reading';
    this.bindReadingEntryReader();
    this.shelfReadingPreparation = false;
    if (traceShelfEntry) this.traceShelfEntryPhase?.('reader-mount-request');
  }

  private onDirectoryChapterSelected(chapterIndex: number): void {
    // R-LOCAL-TOC-01: tapping a chapter in Full Directory returns the user
    // to that chapter's reading flow (the same path used by the Detail
    // chapter rows). The Reader Control Home top-bar target is still gated
    // by `RC-READER-CONTROL-01` and is not fabricated here.
    if (!this.isKnownDetailChapter(chapterIndex)) {
      return;
    }
    this.requestedBookmarkAnchor = undefined;
    if (!this.readingSessionActive) {
      this.openReading(chapterIndex);
      return;
    }
    if (chapterIndex === this.directoryCurrentChapterIndex) {
      // `directoryCurrentChapterIndex` is written only by the reader's
      // committed-first-page callback, never by a merely loaded chapter. It is
      // therefore safe to reveal the existing page without exposing a blank
      // ReadingSurface.
      this.route = 'reading';
      return;
    }
    this.nextNavigationGeneration();
    this.requestedChapterIndex = chapterIndex;
    this.preparedReaderRoute = 'reading';
    this.bindReadingEntryReader();
    // Keep the existing Figma Full Directory static state visible while the
    // reader loads, measures, and persists the new chapter's first page. The
    // route changes only from ReadingExperience.onReadingReady, so a
    // directory pick cannot expose an empty PaperLayer or old chapter body.
    // Full Directory has no approved loading/selection variant and its panel
    // is not opaque. Keep the last committed row/header/body snapshot visible
    // until `onChapterCommitted` reports the new chapter.
  }

  private onReaderBookmarkSelected(bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject): void {
    // 书签 tab 的精确锚点回流, 镜像 onDirectoryChapterSelected 的准入与路由语义。
    if (!this.isKnownDetailChapter(chapterIndex)) {
      return;
    }
    const book = this.detailBook;
    if (book !== undefined && book.sourceId !== LOCAL_SOURCE_ID &&
      ((chapterOffset > 0 && positionScope === undefined) || (positionScope !== undefined &&
        (positionScope.sourceId !== book.sourceId || positionScope.bookId !== book.bookId ||
          positionScope.chapterIndex !== chapterIndex)))) {
      // An unresolved historical mark must not start a reader that immediately
      // fails. Keep the directory and original record available to the user.
      try {
        this.getUIContext().getPromptAction().showToast({
          message: '该书签的位置暂时无法恢复，原摘录和备注仍保留，请从目录打开章节。',
        });
      } catch (_) {}
      return;
    }
    if (!this.readingSessionActive) {
      this.openReading(chapterIndex);
      if (!this.readingSessionActive) return;
      // The exact anchor below owns the initial chapter admission. Leaving
      // the chapter-start prop set would race its @Watch against the anchor.
      this.requestedChapterIndex = undefined;
    } else if (chapterIndex === this.directoryCurrentChapterIndex) {
      // 已提交章内的书签: 不重复准入, 只露出阅读区。精确偏移完全由下面的
      // requestedBookmarkAnchor 通道承载 (selectChapterAnchor 处理同章偏移跳转)。
      this.route = 'reading';
    } else {
      // 跨章: 与目录选章同一路由机制。刻意不设置 requestedChapterIndex ——
      // 两个 @Watch 同批触发会让章首加载与精确偏移竞速; 锚点通道自身的
      // openChapter(chapterIndex, offset) 就是一次完整的跨章准入。
      this.nextNavigationGeneration();
      this.preparedReaderRoute = 'reading';
      this.requestedChapterIndex = undefined;
      this.bindReadingEntryReader();
    }
    this.bookmarkAnchorRequestId += 1;
    this.requestedBookmarkAnchor =
      new ReaderBookmarkAnchorRequest(this.bookmarkAnchorRequestId, chapterIndex, chapterOffset, positionScope, directoryTargetProof);
  }

  private onDirectoryNavigationTargetSelected(chapterIndex: number, chapterOffsetScalar: number,
    positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject): void {
    const book = this.detailBook;
    if (book === undefined || !Number.isSafeInteger(chapterOffsetScalar) || chapterOffsetScalar < 0) return;
    if (positionScope !== undefined && (positionScope.sourceId !== book.sourceId ||
      positionScope.bookId !== book.bookId || positionScope.chapterIndex !== chapterIndex)) return;
    if (directoryTargetProof !== undefined && (directoryTargetProof['sourceId'] !== book.sourceId ||
      directoryTargetProof['bookId'] !== book.bookId)) return;
    if (positionScope === undefined && directoryTargetProof === undefined) return;
    this.onReaderBookmarkSelected('', chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
  }

  private openFullDirectory(): void {
    if (this.route !== 'detail' || this.readingSessionActive || this.detailBook === undefined ||
      this.shelfOperation.removalKey.length > 0) {
      return;
    }
    // This is a view of the admitted detail catalog, not a reader launch.
    // Retain its generation so pending detail/bookmark projections can settle.
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.requestedChapterIndex = undefined;
    this.requestedBookmarkAnchor = undefined;
    this.preparedReaderRoute = 'reading';
    this.directoryReturnTarget = 'detail';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.route = 'directory';
    this.directoryPresentationGeneration += 1;
    this.loadDirectoryOperationProjections();
  }

  private openReaderControlDirectory(): void {
    if (!this.readingSessionActive || this.detailBook === undefined || this.detailToc.length === 0 ||
      this.route !== 'reading') {
      return;
    }
    this.directoryReturnTarget = 'readerControl';
    this.preparedReaderRoute = 'directory';
    this.route = 'directory';
    this.directoryPresentationGeneration += 1;
    this.loadDirectoryOperationProjections();
  }

  private readingReadyCallback(sourceId: string, bookId: string, generation: number): (chapterIndex: number) => void {
    return (chapterIndex: number): void => {
      if (!this.readingSessionActive || this.detailBook?.sourceId !== sourceId || this.detailBook?.bookId !== bookId ||
        this.readingReadyGeneration !== generation) return;
      this.presentPreparedReading(chapterIndex);
      this.scheduleNavigationBackfillAfterReady(sourceId, bookId, generation);
    };
  }

  private scheduleNavigationBackfillAfterReady(sourceId: string, bookId: string, generation: number): void {
    // This callback is emitted only after ReadingExperience owns a stable,
    // visible page. Never parse a retained EPUB on shelf click or while the
    // readable first frame is being admitted.
    if (!this.readingSessionActive || this.route !== 'reading' || sourceId !== LOCAL_SOURCE_ID ||
      this.detailBook?.sourceId !== sourceId || this.detailBook?.bookId !== bookId ||
      !['epub', 'txt', 'local', 'mobi', 'azw', 'azw3', 'kf8'].includes(this.detailBook.kind?.trim().toLowerCase() ?? '')) return;
    const navigationGeneration = this.navigationGeneration;
    const key = `${sourceId}\u0000${bookId}\u0000${generation}\u0000${navigationGeneration}`;
    if (this.navigationBackfillObservedKey === key) return;
    this.navigationBackfillObservedKey = key;
    hilog.info(DOMAIN, 'Reader', 'Directory backfill stage=queued generation=%{public}d', generation);
    const owner = ReaderRuntimeOwner.current();
    const isCurrent = (): boolean => !this.shelfReceiptRetired && this.readingSessionActive &&
      this.readingReadyGeneration === generation && this.navigationGeneration === navigationGeneration &&
      this.detailBook?.sourceId === sourceId && this.detailBook?.bookId === bookId &&
      this.isCurrentRuntime(owner);
    try {
      this.getUIContext().postFrameCallback(new ReaderNavigationBackfillFrame((): void => {
        if (!isCurrent()) {
          if (this.navigationBackfillObservedKey === key) this.navigationBackfillObservedKey = '';
          return;
        }
        hilog.info(DOMAIN, 'Reader', 'Directory backfill stage=frame generation=%{public}d', generation);
        this.navigationBackfillObserverDisposer?.();
        this.navigationBackfillObserverDisposer = readerDirectoryObserveMissingNavigation(bookId, (): void => {
          if (!isCurrent() || this.navigationBackfillAttempted.has(key) ||
            !readerDirectoryTakeMissingNavigation(bookId)) return;
          hilog.info(DOMAIN, 'Reader', 'Directory backfill stage=missing generation=%{public}d', generation);
          this.navigationBackfillAttempted.add(key);
          if (this.navigationBackfillAttempted.size > 16) {
            this.navigationBackfillAttempted.delete(this.navigationBackfillAttempted.values().next().value as string);
          }
          void backfillRetainedReaderDirectoryNavigation(owner, bookId, isCurrent, this.detailBook?.kind?.trim().toLowerCase() ?? '')
            .then((status: string): void => {
              hilog.info(DOMAIN, 'Reader', 'Directory backfill result=%{public}s current=%{public}d', status, isCurrent() ? 1 : 0);
            }).catch((_error: Error): void => {
              hilog.warn(DOMAIN, 'Reader', 'Directory backfill result=error current=%{public}d', isCurrent() ? 1 : 0);
            });
        });
      }));
    } catch (_error) {
      this.navigationBackfillObservedKey = '';
    }
  }

  private presentPreparedReading(chapterIndex: number): void {
    if (!this.readingSessionActive || this.detailBook === undefined) {
      return;
    }
    const requested = this.requestedBookmarkAnchor?.chapterIndex ?? this.requestedChapterIndex;
    if (this.route === 'directory' && requested !== chapterIndex) {
      return;
    }
    if (this.route !== 'reading' && this.route !== 'detail' && this.route !== 'directory' &&
      !(this.route === 'bookshelf' && this.shelfReadingPreparation)) {
      return;
    }
    if (this.shelfReadingPreparation) this.traceShelfEntryPhase?.('present');
    if (this.startupEntryId > 0) {
      this.traceStartupStage?.('reader.model-ready', 'ready', true);
      this.startupEntryId = 0;
    }
    if (this.detailBook.sourceId !== LOCAL_SOURCE_ID) {
      this.remoteContentVerdict = 'readable';
    }
    this.shelfEntryTraceStartedAt = -1;
    this.shelfReadingPreparation = false;
    this.route = this.preparedReaderRoute;
    const projectDirectory = this.pendingRemoteDirectoryProjection;
    this.pendingRemoteDirectoryProjection = undefined;
    projectDirectory?.();
    const projectLocalDirectory = this.pendingLocalDirectoryProjection;
    this.pendingLocalDirectoryProjection = undefined;
    projectLocalDirectory?.();
  }

  private returnToReadingOrigin(): void {
    if (this.detailBook === undefined) {
      this.returnToBookshelf();
      return;
    }
    this.nextNavigationGeneration();
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.readingSessionActive = false;
    this.requestedChapterIndex = undefined;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    // Keep the admitted identity for detail and ordinary back navigation.
    this.route = this.readingOriginRoute;
    this.bindReadingEntryReader();
    void this.refreshDetailAcquisitionProjection();
    if (this.route === 'bookshelf') {
      this.refreshBookshelf();
    }
  }

  private requestReaderBookInfo(): void {
    const book = this.detailBook;
    const requestExit = this.readingExitRequest;
    if (!this.readingSessionActive || book === undefined || requestExit === undefined) return;
    this.bookInfoAfterReaderExit = `${book.sourceId}\u0000${book.bookId}`;
    requestExit('navigation');
  }

  private currentReaderPresentationIdentity(): string {
    return JSON.stringify([this.detailBook?.sourceId, this.detailBook?.bookId, this.readingReadyGeneration]);
  }

  private cancelReaderExitDestination(readerIdentity: string): void {
    if (this.shelfReceiptRetired || !this.isCurrentRuntime(this.mountedRuntimeOwner) ||
      readerIdentity !== this.currentReaderPresentationIdentity()) return;
    this.systemFileOpenNavigation?.cancelExit(readerIdentity);
    this.bookInfoAfterReaderExit = undefined;
    this.openRulesManagementAfterReaderExit = false;
    this.exitToDetailOriginAfterReader = false;
  }

  private onReaderExited(readerIdentity: string): void {
    if (this.shelfReceiptRetired || !this.isCurrentRuntime(this.mountedRuntimeOwner) ||
      readerIdentity !== this.currentReaderPresentationIdentity()) return;
    this.readingExitRequest = undefined;
    if (this.systemFileOpenNavigation?.readerExited(readerIdentity) === true) {
      this.bookInfoAfterReaderExit = undefined;
      this.openRulesManagementAfterReaderExit = false;
      this.returnToBookshelf();
      this.consumeSystemFileOpen();
      return;
    }
    const bookInfoIdentity = this.bookInfoAfterReaderExit;
    this.bookInfoAfterReaderExit = undefined;
    if (bookInfoIdentity !== undefined && this.detailBook !== undefined &&
      bookInfoIdentity === `${this.detailBook.sourceId}\u0000${this.detailBook.bookId}`) {
      // Reuse the admitted book/session/directory. Normal serialized exit owns
      // the visible-page commit; viewing information does not acquire a book.
      this.readingOriginRoute = 'detail';
      this.returnToReadingOrigin();
      return;
    }
    if (this.openRulesManagementAfterReaderExit) {
      this.openRulesManagementAfterReaderExit = false;
      this.presentRulesManagementFromReader();
      return;
    }
    if (this.exitToDetailOriginAfterReader) {
      this.exitToDetailOriginAfterReader = false;
      this.returnFromDetail();
      return;
    }
    this.returnToReadingOrigin();
  }

  private closeDirectory(): void {
    if (!this.readingSessionActive) {
      this.preparedReaderRoute = 'reading';
      this.route = 'detail';
      return;
    }
    if (this.directoryReturnTarget === 'readerControl' && this.readingSessionActive) {
      this.preparedReaderRoute = 'reading';
      this.route = 'reading';
      return;
    }
    const requestExit = this.readingExitRequest;
    if (requestExit !== undefined) {
      requestExit();
    } else {
      this.returnToReadingOrigin();
    }
  }

  private getReaderDirectoryHost(owner: ReaderRuntimeOwner): ReaderDirectoryHost | undefined {
    const current = (): boolean => this.isCurrentRuntime(owner);
    const host = ReaderDirectoryHost.forRuntime(owner, current, (error: Error): void => {
      try { hilog.error(DOMAIN, 'Reader', 'Directory delivery failed: %{private}s', error.message); } catch (_) {}
    }, new BookmarkOperationIntentStore(owner, current));
    this.directoryOperation = host?.snapshot();
    return host;
  }

  private directoryOperationBindingId(): string {
    const book = this.detailBook;
    return JSON.stringify([this.detailShelfAdmissionMount, this.navigationGeneration,
      book?.sourceId ?? '', book?.bookId ?? '', this.remoteSessionGeneration]);
  }

  private directoryOperationPresentationId(): string {
    return JSON.stringify([this.directoryOperationBindingId(), this.directoryPresentationGeneration]);
  }

  private isCurrentDirectoryOperationBinding(identity: string, owner: ReaderRuntimeOwner | undefined): boolean {
    return owner !== undefined && this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) &&
      !this.shelfReceiptRetired && identity === this.directoryOperationBindingId() && this.detailBook !== undefined &&
      (this.route === 'detail' || this.route === 'reading' || this.route === 'directory');
  }

  private isCurrentDirectoryOperationPresentation(identity: string, owner: ReaderRuntimeOwner | undefined): boolean {
    return this.route === 'directory' && identity === this.directoryOperationPresentationId() &&
      this.isCurrentDirectoryOperationBinding(this.directoryOperationBindingId(), owner);
  }

  private applyOwnedDirectoryEntries(entries: LocalReadingTocEntry[]): void {
    this.detailToc = entries;
    const entryHost = this.getReadingEntryHost();
    if (entryHost !== undefined) entryHost.replaceDirectory(this.readingEntryScopeId, entries);
  }

  private directoryBinding(owner: ReaderRuntimeOwner, book: ReadingBookDetail,
    isRequestCurrent?: () => boolean, onSettled?: (confirmed: boolean) => void): ReaderDirectoryBinding {
    const identity = this.directoryOperationBindingId();
    return { book, current: (): boolean => this.isCurrentDirectoryOperationBinding(identity, owner) &&
      (isRequestCurrent?.() ?? true) && this.detailBook?.title === book.title && this.detailBook?.author === book.author,
      currentEntries: (): LocalReadingTocEntry[] => this.detailToc,
      emitEntries: (entries: LocalReadingTocEntry[]): void => this.applyOwnedDirectoryEntries(entries),
      emitOperation: (operation: ReaderDirectoryOperation): void => { this.directoryOperation = { action: operation.action, book: operation.book, generation: operation.generation,
        requestedCount: operation.requestedCount, confirmedCount: operation.confirmedCount, completion: operation.completion,
        canContinueOriginal: operation.canContinueOriginal, projection: operation.projection }; },
      failed: (error: Error): void => { hilog.error(DOMAIN, 'Reader', 'Bookmark operation/projection: %{private}s', error.message); },
      onSettled };
  }

  private deleteDirectoryBookmarks(bookmarkTimes: number[]): void {
    const owner = this.mountedRuntimeOwner, book = this.detailBook;
    if (owner === undefined || book === undefined) return;
    const host = this.getReaderDirectoryHost(owner);
    if (host !== undefined) void host.deleteBookmarks(bookmarkTimes, this.directoryBinding(owner, book));
  }

  private createDirectoryChapterStartBookmark(request: ReaderDirectoryChapterStartBookmarkRequest): void {
    const owner = this.mountedRuntimeOwner, book = this.detailBook;
    if (owner === undefined || book === undefined || !this.detailToc.some(entry =>
      entry.index === request.chapterIndex && entry.title === request.chapterTitle)) return;
    const host = this.getReaderDirectoryHost(owner);
    if (host !== undefined) void host.createChapterStart(request.chapterIndex, this.directoryBinding(owner, book));
  }

  private toggleReaderPageBookmark(request: ReaderPageBookmarkToggleRequest): void {
    const owner = this.mountedRuntimeOwner, book = this.detailBook;
    const entry = this.detailToc.find(candidate => candidate.index === request.chapterIndex && candidate.title === request.chapterTitle);
    if (owner === undefined || book === undefined || entry?.bookmarks === undefined ||
      !Number.isSafeInteger(request.chapterOffset) || request.chapterOffset < 0) { request.onSettled?.(false); return; }
    const times: number[] = [];
    for (const time of request.bookmarkTimes) {
      if (!Number.isSafeInteger(time) || times.indexOf(time) >= 0 || !entry.bookmarks.some(mark => mark.time === time)) {
        request.onSettled?.(false); return;
      }
      times.push(time);
    }
    const host = this.getReaderDirectoryHost(owner);
    if (host === undefined) { request.onSettled?.(false); return; }
    const binding = this.directoryBinding(owner, book, undefined, request.onSettled);
    if (times.length > 0) { void host.deleteBookmarks(times, binding); return; }
    void host.createPosition({ bookName: book.title, bookAuthor: book.author, chapterIndex: request.chapterIndex,
      chapterOffset: request.chapterOffset, chapterTitle: request.chapterTitle, bookText: request.bookText,
      positionScope: request.positionScope }, binding);
  }

  private controlBookmarkProjectionMessage(): string {
    const operation = this.directoryOperation;
    // The persistent bookmark control needs an actual unavailable/stale list,
    // not a partial batch result whose canonical list has already refreshed.
    return operation !== undefined && (operation.projection.receipt.confirmation === 'unknown' ||
      operation.projection.receipt.fact === 'confirmedRefreshFailed') ? this.directoryRecovery().bookmarks.message : '';
  }

  private directoryRecovery(): ReadingDirectoryRecovery {
    const book = this.detailBook;
    if (book === undefined) return EMPTY_READING_DIRECTORY_RECOVERY;
    return readingDirectoryRecovery(this.directoryOperationPresentationId(), book, this.directoryOperation, this.offlineOperation);
  }

  private reconcileDirectoryOperation(generation: number, identity: string, continueOriginal: boolean = false): void {
    const owner = this.mountedRuntimeOwner, book = this.detailBook;
    if (this.route !== 'directory' || !this.isCurrentDirectoryOperationPresentation(identity, owner) || owner === undefined || book === undefined) return;
    const host = this.getReaderDirectoryHost(owner);
    if (host !== undefined) {
      const binding = this.directoryBinding(owner, book);
      if (continueOriginal) void host.continueOriginal(generation, binding).catch((): void => {});
      else void host.reconcile(generation, binding).catch((): void => {});
    }
  }

  private reconcileOfflineOperation(generation: number, identity: string, continueOriginal: boolean = false): void {
    const owner = this.mountedRuntimeOwner, session = this.remoteReadingSession;
    if (this.route !== 'directory' || !this.isCurrentDirectoryOperationPresentation(identity, owner) || owner === undefined || session === undefined) return;
    const host = this.getReadingOfflineHost(owner);
    if (host !== undefined) {
      const binding = this.offlineBinding(owner, session);
      if (continueOriginal) void host.continueOriginal(generation, binding).catch((): void => {});
      else void host.reconcile(generation, binding).catch((): void => {});
    }
  }

  private loadDirectoryOperationProjections(): void {
    const owner = this.mountedRuntimeOwner, book = this.detailBook, session = this.remoteReadingSession;
    if (owner === undefined || book === undefined) return;
    const directory = this.getReaderDirectoryHost(owner);
    if (directory !== undefined) void directory.load(this.directoryBinding(owner, book)).catch((): void => {});
    const offline = this.getReadingOfflineHost(owner);
    if (offline !== undefined && session !== undefined) void offline.load(this.offlineBinding(owner, session)).catch((): void => {});
  }

  private loadControlBookmarks(sourceId: string, bookId: string, isRequestCurrent: () => boolean): Promise<void> {
    const owner = this.mountedRuntimeOwner, book = this.detailBook;
    if (owner === undefined || book === undefined || book.sourceId !== sourceId || book.bookId !== bookId ||
      !this.readingSessionActive || !isRequestCurrent()) return Promise.reject(new Error('Bookmark projection session superseded'));
    const host = this.getReaderDirectoryHost(owner);
    if (host === undefined) return Promise.reject(new Error('Bookmark projection Runtime retired'));
    return host.load(this.directoryBinding(owner, book, isRequestCurrent));
  }

  @Builder
  private sourceSwitchOverlayContent() {
        ForEach([this.sourceSwitchScopeId], (scopeId: number) => {
        Stack({ alignContent: Alignment.Center }) {
          Stack()
            .width('100%')
            .height('100%')
            .backgroundColor(readerAppColor('app.Index.build.backgroundColor.40FFFFFF', this.appThemeScheme))
            .onClick((): void => this.closeSourceSwitch(scopeId));
          SourceSwitchPanel({
            state: this.sourceSwitchState,
            currentSourceId: this.detailBook?.sourceId ?? '',
            onClose: (): void => this.closeSourceSwitch(scopeId),
            onRetry: (): void => this.retrySourceSwitch(scopeId),
            onRefresh: (): void => this.refreshSourceSwitch(scopeId),
            onSelectCandidate: (candidate: SourceSwitchCandidate): void => this.onPickSource(candidate, scopeId),
            onRollback: (): void => this.onRollbackSourceSwitch(scopeId),
          });
        }
        .width('100%')
        .height('100%');
        }, (scopeId: number): string => scopeId.toString());
  }

  private getSourceSwitchHost(): SourceSwitchHost | undefined {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner)) return undefined;
    if (this.sourceSwitchHost?.owns(owner) !== true) this.sourceSwitchHost = SourceSwitchHost.forRuntime(owner);
    return this.sourceSwitchHost;
  }

  private sourceSwitchContext(): SourceSwitchContext {
    const query = this.sourceSwitchProbeQuery();
    return { query, inBookshelf: this.detailInBookshelf,
      toc: this.detailToc.map((entry: LocalReadingTocEntry): SourceSwitchAnchor => ({ chapterIndex: entry.index, chapterTitle: entry.title })),
      shelfBook: this.shelfBooks.find((book: ShelfBook): boolean => book.sourceId === query.sourceId && book.bookId === query.bookId),
      knownCandidates: this.knownSearchSourceCandidates(query), searchedSourceIds: this.detailReturnRoute === 'search' ? this.searchHost.searchedSourceIds() : [] };
  }

  private sourceSwitchLease(host: SourceSwitchHost): SourceSwitchLease {
    const owner = this.mountedRuntimeOwner, navigation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const current = (identity: RemoteReadingIdentity): boolean => owner !== undefined && !this.shelfReceiptRetired &&
      this.sourceSwitchHost === host && this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner) &&
      navigation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount &&
      this.detailBook?.sourceId === identity.sourceId && this.detailBook?.bookId === identity.bookId;
    return { isCurrent: current,
      changed: (snapshot: SourceSwitchSnapshot): void => {
        const book = this.detailBook;
        if (book !== undefined && current(book)) this.applySourceSwitchSnapshot(snapshot);
      },
      effect: (effect: SourceSwitchEffect): void => {
        const book = this.detailBook;
        if (book !== undefined && current(book)) this.applySourceSwitchEffect(host, effect);
      } };
  }

  /** These fields are the current presentation DTO, not independent authority. */
  private applySourceSwitchSnapshot(snapshot: SourceSwitchSnapshot): void {
    this.sourceSwitchScopeId = snapshot.scopeId;
    this.sourceSwitchVisible = snapshot.visible;
    this.sourceSwitchState = snapshot.state;
    this.sourceSwitchFailureMessage = snapshot.failureMessage;
    this.pendingSourceSwitch = snapshot.pending;
  }

  private retireSourceSwitchPresentation(): void {
    const host = this.sourceSwitchHost;
    if (host !== undefined && host.current().scopeId === this.sourceSwitchScopeId) host.retire();
    this.sourceSwitchVisible = false;
  }

  private bindSourceSwitchReader(host: SourceSwitchHost): void {
    if (!this.readingSessionActive || this.detailBook === undefined || this.sourceSwitchHost !== host) return;
    host.bindReader(this.sourceSwitchContext(), this.sourceSwitchLease(host));
  }

  private applySourceSwitchEffect(host: SourceSwitchHost, effect: SourceSwitchEffect): void {
    if (effect.kind === 'previewReady') {
      const parent = this.detailReturnRoute;
      this.openRemoteBookDetail(effect.seed, effect.candidate.sourceName ?? effect.candidate.sourceId,
        undefined, true, [], [], parent, effect.session);
    } else if (effect.kind === 'targetReady') {
      this.performSourceSwitchSeam(effect.book, effect.session, effect.chapterIndex);
      this.bindSourceSwitchReader(host);
    } else if (effect.kind === 'rollbackReady' || effect.kind === 'canonicalReady') {
      this.refreshBookshelf(); this.reopenSwitchedBook(effect.book);
    } else if (effect.kind === 'restoredForNextChoice') {
      const previous = this.detailBook;
      this.detailBook = this.readingDetailForShelf(effect.book);
      this.remoteReadingSeed = { sourceId: effect.book.sourceId, bookId: effect.book.bookId, detailUrl: effect.book.bookId,
        title: effect.book.title, author: effect.book.author, coverUrl: effect.book.coverUrl, intro: effect.book.intro };
      if (previous?.sourceId !== effect.book.sourceId || previous?.bookId !== effect.book.bookId) {
        this.detailToc = []; this.installRemoteReadingSession(undefined);
        this.requestedChapterIndex = undefined; this.requestedBookmarkAnchor = undefined; this.readingExitRequest = undefined;
      }
      this.readingSessionActive = true; this.preparedReaderRoute = 'reading'; this.route = 'reading'; this.refreshBookshelf();
    } else if (effect.kind === 'acquisitionFailed') {
      if (this.detailBook?.sourceId !== effect.identity.sourceId || this.detailBook?.bookId !== effect.identity.bookId) return;
      if (!this.readingSessionActive) this.openReading(undefined);
      this.route = 'reading'; this.bindSourceSwitchReader(host);
    } else if (effect.kind === 'closed') this.consumeSystemFileOpen();
  }

  private openSourceSwitch(): void {
    if (this.detailBook === undefined || this.detailBook.sourceId === LOCAL_SOURCE_ID || this.sourceSwitchVisible) return;
    if (!this.readingSessionActive) { this.returnToReadingOrigin(); this.openDetailSourceSwitch(); return; }
    const host = this.getSourceSwitchHost(); if (host === undefined) return;
    this.nextNavigationGeneration(); this.exitToDetailOriginAfterReader = false;
    this.preparedReaderRoute = 'reading'; this.route = 'reading';
    this.bindReadingEntryReader();
    host.open(this.sourceSwitchContext(), this.sourceSwitchLease(host));
  }

  private openDetailSourceSwitch(): void {
    if (this.route !== this.readingOriginRoute || this.detailBook === undefined || this.detailBook.sourceId === LOCAL_SOURCE_ID ||
      this.sourceSwitchVisible || this.shelfOperation.removalKey.length > 0) return;
    const host = this.getSourceSwitchHost(); if (host === undefined) return;
    this.nextNavigationGeneration(); this.exitToDetailOriginAfterReader = false;
    this.bindReadingEntryReader();
    host.open(this.sourceSwitchContext(), this.sourceSwitchLease(host));
  }

  private retrySourceSwitch(scopeId?: number): void { if (scopeId !== undefined) this.sourceSwitchHost?.retry(scopeId); }
  private refreshSourceSwitch(scopeId?: number): void { if (scopeId !== undefined) this.sourceSwitchHost?.refresh(scopeId); }

  private sourceSwitchProbeQuery(): SourceSwitchProbeQuery {
    const book = this.detailBook;
    if (book === undefined) throw new Error('换源需要当前书籍');
    const session = this.remoteReadingSession?.identity.sourceId === book.sourceId &&
      this.remoteReadingSession?.identity.bookId === book.bookId ? this.remoteReadingSession : undefined;
    if (this.detailToc.length === 0) {
      return { sourceId: book.sourceId, bookId: book.bookId, bookName: book.title, author: book.author, authorIdentity: session?.book.authorIdentity, sourceVersion: session?.sourceVersion,
        currentChapterIndex: 0, currentChapterTitle: '' };
    }
    let anchor = this.detailToc[this.detailToc.length - 1];
    if (this.readingSessionActive) {
      const requestedIndex = this.directoryCurrentChapterIndex >= 0
        ? this.directoryCurrentChapterIndex
        : this.requestedChapterIndex ?? this.detailToc[0].index;
      for (const entry of this.detailToc) {
        if (entry.index === requestedIndex) {
          anchor = entry;
          break;
        }
      }
    }
    return {
      sourceId: book.sourceId,
      bookId: book.bookId,
      bookName: book.title,
      author: book.author,
      authorIdentity: session?.book.authorIdentity, sourceVersion: session?.sourceVersion,
      currentChapterIndex: anchor.index,
      currentChapterTitle: anchor.title,
    };
  }

  private knownSearchSourceCandidates(query: SourceSwitchProbeQuery): SourceSwitchCandidate[] {
    if (this.detailReturnRoute !== 'search') return [];
    return this.searchDetailCandidates.map((book: SearchBook): SourceSwitchCandidate => {
      const rank = searchCandidateRank(book);
      return { sourceId: book.sourceId, sourceName: book.sourceName, sourceVersion: book.sourceRuleVersion,
        searchVariables: book.variables, authorIdentity: book.authorIdentity,
        bookUrl: book.bookId, bookName: book.title, author: book.author, coverUrl: book.coverUrl,
        latestChapterTitle: book.latestChapterTitle, category: book.category,
        acquisitionState: rank === 0 ? 'readable' : rank === 1 ? 'catalogReady' : rank === 3 ? 'failed' : 'discovered',
        isCurrent: query.sourceId === book.sourceId && query.bookId === book.bookId };
    });
  }

  private onPickSource(candidate: SourceSwitchCandidate, scopeId?: number): void {
    if (scopeId !== undefined) void this.sourceSwitchHost?.pick(candidate, scopeId);
  }
  private retryFailedSourceSwitch(scopeId?: number): void { if (scopeId !== undefined) this.sourceSwitchHost?.retryFailed(scopeId); }
  private dismissSourceSwitchFailure(scopeId?: number): void { if (scopeId !== undefined) this.sourceSwitchHost?.dismissFailure(scopeId); }
  private onRollbackSourceSwitch(scopeId?: number): void { if (scopeId !== undefined) this.sourceSwitchHost?.rollback(scopeId); }
  private closeSourceSwitch(scopeId?: number): void { if (scopeId !== undefined) this.sourceSwitchHost?.close(scopeId); }

  private performSourceSwitchSeam(book: ShelfBook, session?: RemoteReadingSession,
    chapterIndex?: number): void {
    this.retireSourceSwitchPresentation();
    this.sourceSwitchVisible = false;
    if (session === undefined || session.identity.sourceId !== book.sourceId ||
      session.identity.bookId !== book.bookId) {
      this.reopenSwitchedBook(book);
      return;
    }
    this.nextNavigationGeneration();
    this.readingExitRequest = undefined;
    this.detailBook = this.readingDetailForShelf(book);
    this.remoteReadingSeed = { sourceId: book.sourceId, bookId: book.bookId, detailUrl: book.bookId,
      title: book.title, author: book.author, coverUrl: book.coverUrl, intro: book.intro,
      lastChapter: book.lastChapter, sourceVersion: session.sourceVersion };
    this.readingSessionActive = true;
    const committedSession: RemoteReadingSession = {
      sourceVersion: session.sourceVersion, catalogAt: session.catalogAt,
      catalogVersion: session.catalogVersion, contextVersion: session.contextVersion,
      preparedChapter: session.preparedChapter, acquisitionMode: session.acquisitionMode,
      identity: session.identity, detailUrl: session.detailUrl, tocUrl: session.tocUrl,
      book: { title: book.title, author: book.author, authorIdentity: session.book.authorIdentity,
        kind: book.kind ?? session.book.kind, coverUrl: book.coverUrl ?? session.book.coverUrl,
        intro: book.intro ?? session.book.intro, lastChapter: book.lastChapter ?? session.book.lastChapter },
      continuationVariables: session.continuationVariables, entries: session.entries,
      hostRequirements: session.hostRequirements, requiresContextRefresh: session.requiresContextRefresh,
      refreshRecommended: session.refreshRecommended,
    };
    // The old source's displayed index cannot trigger near-end work for this
    // new catalog. Its own chapter/commit callbacks establish the next owner.
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.onRemoteSessionReady(committedSession);
    this.detailInBookshelf = true;
    this.requestedChapterIndex = chapterIndex;
    this.requestedBookmarkAnchor = undefined;
    this.preparedReaderRoute = 'reading';
    this.route = 'reading';
  }

  private onReadingFailure(sourceId: string, bookId: string, message: string,
    failureKind?: RemoteReadingFailureKind): void {
    if (!this.readingSessionActive || this.detailBook?.sourceId !== sourceId ||
      this.detailBook?.bookId !== bookId) return;
    // The mounted reader owns its typed error, settings and retry actions.
    // Body failure never compensates a committed source switch or exits.
    this.detailLoadingMessage = message;
    hilog.warn(DOMAIN, 'Reader', 'Reading error retained in reader: %{private}s %{private}s',
      failureKind ?? 'RENDER_FAILED', message);
  }

  private onRemoteSessionReady(session: RemoteReadingSession): void {
    const book = this.detailBook;
    if (!this.readingSessionActive || book === undefined ||
      book.sourceId !== session.identity.sourceId || book.bookId !== session.identity.bookId) return;
    const host = this.getReadingEntryHost();
    if (host === undefined) return;
    if (host.snapshot().scopeId !== this.readingEntryScopeId) this.bindReadingEntryReader();
    if (!host.readerSessionReady(session)) return;
    if (this.directoryCurrentChapterIndex >= 0 && this.isRemoteCatalogNearEnd(session, this.directoryCurrentChapterIndex))
      this.refreshRemoteCatalogNearEnd(session);
    this.pendingRemoteDirectoryProjection = host.deferredDirectoryProjection();
  }

  private installRemoteReadingSession(session: RemoteReadingSession | undefined,
    readableProjectionRevision?: number, readableProjection?: BookAcquisitionDetailProjection): void {
    if (this.detailBook === undefined) {
      // A retained route DTO is optional input for a later owner admission.
      // It is not revalidated or declared readable when leaving the page.
      this.remoteReadingSession = session;
      return;
    }
    const host = this.getReadingEntryHost();
    if (host === undefined) return;
    const admitted = host.snapshot();
    if (admitted.scopeId !== this.readingEntryScopeId || admitted.book?.sourceId !== this.detailBook.sourceId ||
      admitted.book?.bookId !== this.detailBook.bookId) this.bindReadingEntryReader();
    host.acceptSession(session, readableProjectionRevision, readableProjection);
  }

  private async probeRemoteContentVerdict(
    _gateway: RemoteReadingFlowGateway,
    session: RemoteReadingSession,
    isCurrent: () => boolean,
    preferredChapterIndex?: number,
    positionContext?: RemoteReadingPositionContext,
  ): Promise<number | undefined> {
    if (!isCurrent() || !sameRemoteSessionEvidence(this.remoteReadingSession, session)) return undefined;
    const host = this.getReadingEntryHost();
    if (host === undefined || host.snapshot().scopeId !== this.readingEntryScopeId) return undefined;
    return host.probe(this.readingEntryScopeId, preferredChapterIndex, positionContext);
  }

  private async refreshCachedChapterFromPrompt(error: RemoteChapterCacheRefreshError,
    isCurrent: () => boolean): Promise<number | undefined> {
    if (!isCurrent()) return undefined;
    const host = this.getReadingEntryHost();
    if (host === undefined || host.snapshot().scopeId !== this.readingEntryScopeId) return undefined;
    return host.recoverCachedChapter(this.readingEntryScopeId, error, isCurrent);
  }

  private async chooseCachedChapterRefresh(error: RemoteChapterCacheRefreshError, current: () => boolean): Promise<boolean> {
    if (!current()) return false;
    this.remoteCacheNoticeGeneration = this.navigationGeneration;
    const lease = this.showIndexAlert('choice-blocking', {
      title: '需要重新验证本章缓存', message: error.message,
      primaryButton: { value: '刷新本章', action: (): void => {} },
      secondaryButton: { value: '保留缓存', action: (): void => {} },
    }, current);
    return lease !== undefined && await lease.decision === 'primary' && current();
  }

  private remoteContentVerdictLabel(verdict: RemoteContentVerdict): string {
    switch (verdict) {
      case 'verifying':
        return '正在验证正文…';
      case 'readable':
        return '';
      case 'authRequired':
        return '该源需要登录或验证';
      case 'paywalled':
        return '该章节需要付费';
      case 'networkFailed':
        return '网络请求失败';
      case 'parseFailed':
        return '书源解析失败';
      case 'contentUnavailable':
      default:
        return '正文暂不可读';
    }
  }

  private showReadingFailure(title: string, message: string): void {
    this.showIndexAlert('notice', {
      title,
      message: message.trim().length > 0 ? message : '阅读会话未能继续，请稍后重试。',
      primaryButton: {
        value: '知道了',
        action: (): void => {},
      },
    });
  }

  /** Startup observes durable pending facts; opening a target resumes its id. */
  private async reconcilePendingSourceSwitches(): Promise<void> {
    const owner = this.mountedRuntimeOwner, mounting = this.detailShelfAdmissionMount;
    const current = (): boolean => owner !== undefined && !this.shelfReceiptRetired &&
      this.mountedRuntimeOwner === owner && mounting === this.detailShelfAdmissionMount && this.isCurrentRuntime(owner);
    if (!current()) return;
    const host = this.getSourceSwitchHost(); if (host === undefined) return;
    try { const records = await host.inspectPending(current); if (current()) hilog.info(DOMAIN, 'Reader', 'Retained pending source switches: %{public}d', records?.length ?? 0); }
    catch (error) { if (current()) hilog.warn(DOMAIN, 'Reader', 'Pending source switch read failed: %{private}s', errorMessageOf(error)); }
  }

  private async resolveReaderSourceSwitchTransaction(sourceId: string, bookId: string): Promise<string | undefined> {
    if (sourceId === LOCAL_SOURCE_ID) return undefined;
    const owner = this.mountedRuntimeOwner, mounting = this.detailShelfAdmissionMount, navigation = this.navigationGeneration;
    const current = (): boolean => owner !== undefined && !this.shelfReceiptRetired && this.mountedRuntimeOwner === owner &&
      this.isCurrentRuntime(owner) && mounting === this.detailShelfAdmissionMount && navigation === this.navigationGeneration &&
      this.readingSessionActive && this.detailBook?.sourceId === sourceId && this.detailBook?.bookId === bookId;
    if (!current()) return undefined;
    const host = this.getSourceSwitchHost(); if (host === undefined) return undefined;
    const transactionId = await host.resolveTransaction({ sourceId, bookId }, current);
    if (!current()) return undefined;
    this.bindSourceSwitchReader(host);
    return transactionId;
  }

  private reopenSwitchedBook(book: ShelfBook): void {
    // Re-admit the committed source identity through its transaction guards.
    if (book.sourceId === LOCAL_SOURCE_ID) {
      this.openLocalBookDetail(book, true);
    } else {
      this.openRemoteBookDetail({ sourceId: book.sourceId, bookId: book.bookId, detailUrl: book.bookId,
        title: book.title, author: book.author, coverUrl: book.coverUrl, intro: book.intro, lastChapter: book.lastChapter },
        this.sourceDisplayName(book.sourceId, book.sourceName), book, true);
    }
  }

  private returnFromDetail(): void {
    if (this.detailReturnRoute === 'search') {
      this.returnToSearch();
      return;
    }
    this.returnToBookshelf();
  }

  private returnToSearch(): void {
    const retainedRemoteSession = this.detailBook !== undefined &&
      this.detailBook.sourceId !== LOCAL_SOURCE_ID &&
      this.remoteReadingSession?.identity.sourceId === this.detailBook.sourceId &&
      this.remoteReadingSession?.identity.bookId === this.detailBook.bookId ? this.remoteReadingSession : undefined;
    this.nextNavigationGeneration();
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.readingSessionActive = false;
    this.requestedChapterIndex = undefined;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.detailToc = [];
    // Leaving Detail strands any in-flight detail mutation (see the helper);
    // free the global gate before detailBook itself is cleared.
    this.detailBook = undefined;
    this.installRemoteReadingSession(retainedRemoteSession);
    // The search orchestrator still owns the presented results; re-entering
    // must not call open() because that would reset them to the Initial state.
    this.route = 'search';
    // Restore the original queue, including sources completed while hidden.
    this.searchHost.resume();
  }

  private returnToBookshelf(): void {
    this.searchDetailCandidates = [];
    this.searchHost.close();
    const retainedRemoteSession = this.detailBook !== undefined &&
      this.detailBook.sourceId !== LOCAL_SOURCE_ID &&
      this.remoteReadingSession?.identity.sourceId === this.detailBook.sourceId &&
      this.remoteReadingSession?.identity.bookId === this.detailBook.bookId ? this.remoteReadingSession : undefined;
    this.nextNavigationGeneration();
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.readingSessionActive = false;
    this.requestedChapterIndex = undefined;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.detailToc = [];
    // Leaving Detail strands any in-flight detail mutation (see the helper);
    // free the global gate before detailBook itself is cleared.
    this.detailBook = undefined;
    this.installRemoteReadingSession(retainedRemoteSession);
    this.selectedRssSubscription = undefined;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rss';
    this.rssSourceFeedReturnTarget = 'rss';
    this.rssManagementFocusSubscriptionId = '';
    this.sourceManagementReturnTarget = 'settings';
    this.sourceManagementSearchKeyword = '';
    this.bookshelfMultiSelectInitialKey = '';
    ReaderRuntimeOwner.current().bookAcquisitions().endSearch();
    this.route = 'bookshelf';
    this.refreshBookshelf();
  }

  private applyReadingCommit(commit: ReadingCommit): void {
    if (commit.sourceId.trim().length === 0 || commit.bookId.trim().length === 0 ||
      this.detailBook?.sourceId !== commit.sourceId || this.detailBook?.bookId !== commit.bookId) {
      return;
    }
    if (commit.sourceSwitchTransactionId !== undefined) {
      const finalized = this.getSourceSwitchHost()?.targetCommitted(
        { sourceId: commit.sourceId, bookId: commit.bookId }, commit.sourceSwitchTransactionId);
      if (finalized !== undefined) this.cleanupRetiredSourceCache(finalized);
    }
    const session = this.remoteReadingSession;
    if (session !== undefined && session.identity.sourceId === commit.sourceId &&
      session.identity.bookId === commit.bookId) {
      void this.prefetchReadingWindow(session, commit.chapterIndex)
        .catch((error: Error): void => {
          hilog.warn(DOMAIN, 'Reader', 'Rolling chapter cache incomplete: %{private}s', error.message);
        });
      if (this.isRemoteCatalogNearEnd(session, commit.chapterIndex)) {
        this.refreshRemoteCatalogNearEnd(session);
      }
    }
    this.consumeSystemFileOpen();
  }

  private getReadingOfflineHost(owner: ReaderRuntimeOwner): ReadingOfflineHost | undefined {
    const current = (): boolean => ReaderRuntimeOwner.isCurrent(owner);
    const host = ReadingOfflineHost.forRuntime(owner, current,
      (error: Error): void => hilog.warn(DOMAIN, 'Reader', 'Offline presentation delivery failed: %{private}s', error.message),
      new CacheClearOperationIntentStore(owner, current));
    this.offlineOperation = host?.snapshot();
    this.offlineOperationActive = host?.busy() ?? false;
    return host;
  }

  private cleanupRetiredSourceCache(finalized: SourceSwitchPendingTransaction): void {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || !this.isCurrentRuntime(owner)) return;
    // This cleanup belongs to the existing offline owner; its exact receipt is independent of the finalized source move.
    void this.getReadingOfflineHost(owner)?.cleanupRetiredSource({ sourceId: finalized.fromSourceId, bookId: finalized.fromBookId })
      .catch((error: Error): void => {
        hilog.warn(DOMAIN, 'Reader', 'Old source book cache cleanup failed: %{private}s', error.message);
      });
  }

  private mountSystemFileOpenNavigation(owner: ReaderRuntimeOwner): void {
    this.systemFileOpenNavigation?.dispose();
    const mounting = this.detailShelfAdmissionMount;
    const host: ReaderSystemFileOpenNavigationHost = new ReaderSystemFileOpenNavigationHost(owner, {
      isCurrent: (): boolean => this.systemFileOpenNavigation === host && !this.shelfReceiptRetired &&
        mounting === this.detailShelfAdmissionMount && this.mountedRuntimeOwner === owner && this.isCurrentRuntime(owner),
      view: (): SystemFileOpenNavigationView => this.systemFileOpenNavigationView(),
      resolveReaderTransaction: async (book: SystemFileOpenReaderIdentity): Promise<void> => {
        await this.resolveReaderSourceSwitchTransaction(book.sourceId, book.bookId);
      },
      notice: (message: string): void => { this.getUIContext().getPromptAction().showToast({message}); },
      open: (book: ShelfBook): void => {
        this.retireSourceSwitchPresentation();
        this.closeImportDialog(); this.jsonImportVisible = false;
        this.returnToBookshelf(); this.openShelfBook(book);
      },
    });
    this.systemFileOpenNavigation = host;
    host.mount();
  }

  private systemFileOpenNavigationView(): SystemFileOpenNavigationView {
    const book = this.detailBook;
    return { foreground: this.searchAppForeground, reading: this.readingSessionActive, navigationGeneration: this.navigationGeneration,
      readerIdentity: this.currentReaderPresentationIdentity(), book: book === undefined ? undefined : { sourceId: book.sourceId, bookId: book.bookId },
      switchBlocked: book !== undefined && this.sourceSwitchHost?.blocksExit(book) === true, requestExit: this.readingExitRequest };
  }
  private consumeSystemFileOpen(): void { this.systemFileOpenNavigation?.consume(); }
  private currentSourceSwitchTransactionId(): string | undefined {
    const book = this.detailBook; return book === undefined ? undefined : this.sourceSwitchHost?.currentTransactionId(book);
  }

  private readingDetailForShelf(book: ShelfBook): ReadingBookDetail {
    return {
      sourceId: book.sourceId,
      sourceName: this.sourceDisplayName(book.sourceId, book.sourceName),
      bookId: book.bookId,
      title: book.title,
      author: book.author,
      kind: book.kind,
      coverUrl: book.coverUrl,
      intro: book.intro,
      lastChapter: book.lastChapter,
    };
  }

  private sourceDisplayName(sourceId: string, persistedName: string = ''): string {
    return bookshelfSourceDisplayName(sourceId, persistedName,
      [this.searchHost.sources(), this.sourceSources, this.sourceToolsSnapshot.sources]);
  }

  private readingDetailForRemoteSeed(seed: RemoteReadingBookSeed, sourceName: string): ReadingBookDetail {
    const projectedSourceName = sourceName.trim();
    return {
      sourceId: seed.sourceId,
      sourceName: projectedSourceName.length > 0 ? projectedSourceName : seed.sourceId,
      bookId: seed.bookId,
      title: seed.title,
      author: seed.author,
      kind: seed.kind,
      coverUrl: seed.coverUrl,
      intro: seed.intro,
      lastChapter: seed.lastChapter,
    };
  }

  private applyDirectoryChapter(chapterIndex: number, chapterTitle: string): void {
    if (!this.readingSessionActive || !this.isKnownDetailChapter(chapterIndex)) {
      return;
    }
    this.directoryCurrentChapterIndex = chapterIndex;
    this.directoryChapterTitle = chapterTitle;
  }

  private readingPrefetchLease(session: RemoteReadingSession, owner: ReaderRuntimeOwner,
    readerOwned: boolean, shelfCurrent?: () => boolean): ReadingPrefetchLease {
    const navigation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const sessionGeneration = this.remoteSessionGeneration;
    const current = (): boolean => !this.shelfReceiptRetired && this.mountedRuntimeOwner === owner &&
      mounting === this.detailShelfAdmissionMount && this.isCurrentRuntime(owner) && navigation === this.navigationGeneration &&
      shelfCurrent?.() !== false && (!readerOwned || (sessionGeneration === this.remoteSessionGeneration &&
        this.readingSessionActive && this.detailBook?.sourceId === session.identity.sourceId &&
        this.detailBook?.bookId === session.identity.bookId && sameRemoteSessionEvidence(this.remoteReadingSession, session)));
    return { isCurrent: current,
      displayedSession: (): RemoteReadingSession | undefined => this.remoteReadingSession,
      directory: (): LocalReadingTocEntry[] => this.detailToc,
      projected: (entries: LocalReadingTocEntry[]): void => { if (current()) this.detailToc = entries; },
      refreshed: (refreshed: RemoteReadingSession): void => {
        if (!current()) return;
        this.onRemoteSessionReady(refreshed);
        this.refreshBookshelf();
      },
      diagnostic: (stage: 'window' | 'catalog', message: string): void => {
        if (current()) hilog.warn(DOMAIN, 'Reader', stage === 'catalog' ?
          'Near-end catalog refresh failed: %{private}s' : 'Rolling chapter cache incomplete: %{private}s', message);
      },
    };
  }

  private async prefetchReadingWindow(session: RemoteReadingSession, preferredChapterIndex?: number,
    shelfCurrent?: () => boolean, capturedOwner?: ReaderRuntimeOwner): Promise<void> {
    const owner = capturedOwner ?? this.mountedRuntimeOwner;
    if (owner === undefined || !this.isCurrentRuntime(owner) || this.shelfReceiptRetired) return;
    const readerOwned = shelfCurrent === undefined && preferredChapterIndex !== undefined;
    const lease = this.readingPrefetchLease(session, owner, readerOwned, shelfCurrent);
    if (!lease.isCurrent()) return;
    await ReadingPrefetchHost.forRuntime(owner).prefetch(session, preferredChapterIndex, lease,
      shelfCurrent !== undefined ? 'shelf' : readerOwned ? 'reader' : 'opportunistic');
  }

  private isRemoteCatalogNearEnd(session: RemoteReadingSession, chapterIndex: number): boolean {
    const owner = this.mountedRuntimeOwner;
    return owner !== undefined && this.isCurrentRuntime(owner) &&
      ReadingPrefetchHost.forRuntime(owner).nearEnd(session, chapterIndex);
  }

  private refreshRemoteCatalogNearEnd(session: RemoteReadingSession): void {
    const owner = this.mountedRuntimeOwner, detail = this.detailBook;
    if (owner === undefined || !this.isCurrentRuntime(owner) || !this.readingSessionActive || detail === undefined ||
      detail.sourceId !== session.identity.sourceId || detail.bookId !== session.identity.bookId ||
      !sameRemoteSessionEvidence(this.remoteReadingSession, session)) return;
    void ReadingPrefetchHost.forRuntime(owner).refreshNearEnd(session, this.readingPrefetchLease(session, owner, true));
  }

  private applyReaderDirectoryProjection(entries: LocalReadingTocEntry[]): void {
    if (!this.readingSessionActive) {
      return;
    }
    const projected = new Map<number, LocalReadingTocEntry>();
    for (const entry of entries) {
      if (!Number.isSafeInteger(entry.index) || entry.index < 0 || entry.title.trim().length === 0 ||
        projected.has(entry.index)) {
        return;
      }
      projected.set(entry.index, entry);
    }
    const book = this.detailBook;
    if (book?.sourceId === LOCAL_SOURCE_ID && this.detailToc.length === 0 && entries.length > 0) {
      this.detailToc = entries;
      this.detailLoadingMessage = '';
      const host = this.getReadingEntryHost();
      host?.replaceDirectory(this.readingEntryScopeId, entries);
      this.pendingLocalDirectoryProjection = host?.deferredDirectoryProjection();
      return;
    }
    if (entries.length !== this.detailToc.length) return;
    const next: LocalReadingTocEntry[] = [];
    for (const entry of this.detailToc) {
      const titleProjection = projected.get(entry.index);
      if (titleProjection === undefined) {
        return;
      }
      next.push({
        index: entry.index,
        title: titleProjection.title,
        navigable: entry.navigable,
        downloadState: entry.downloadState,
        bookmarks: entry.bookmarks,
      });
    }
    this.detailToc = next;
    this.getReadingEntryHost()?.replaceDirectory(this.readingEntryScopeId, next);
  }

  private shelfFilter(): BookshelfFilter {
    return { readingState: this.shelfReadingFilter, sourceKind: this.shelfSourceFilter };
  }

  private isCurrentBookshelfPresentation(generation: number, owner: ReaderRuntimeOwner | undefined, mounting: number): boolean {
    return owner !== undefined && owner === this.mountedRuntimeOwner && !this.shelfReceiptRetired &&
      this.route === 'bookshelf' && generation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount && this.isCurrentRuntime(owner);
  }

  private refreshSearchShelfMembership(): void {
    const projection = this.getBookshelfProjection();
    const binding = this.bookshelfProjectionBinding;
    if (projection !== undefined && binding !== undefined) void projection.refreshMembership(binding);
  }

  private loadNextShelfPage(): void { this.loadShelfWindowPage(false); }
  private loadPreviousShelfPage(): void { this.loadShelfWindowPage(true); }
  private loadShelfWindowPage(previous: boolean): void {
    if (this.route !== 'bookshelf') return;
    const projection = this.getBookshelfProjection(), binding = this.bookshelfProjectionBinding;
    if (projection !== undefined && binding !== undefined) void projection.page(previous, binding);
  }

  private refreshBookshelf(): void {
    const projection = this.getBookshelfProjection(), binding = this.bookshelfProjectionBinding;
    if (projection === undefined || binding === undefined) return;
    let startedAt = -1;
    try { startedAt = this.beginStartupStage?.('shelf.query') ?? -1; }
    catch (_diagnostic) { /* Diagnostics cannot prevent the read. */ }
    void projection.refresh(this.shelfFilter(), binding,
      this.route === 'bookshelf' && !this.isBookshelfVisualAdmitted && !this.isCoreShelfEmpty)
      .then((result): void => {
        if (!binding.current()) return;
        try {
          if (result?.facts.fact === 'current' || result?.facts.fact === 'empty') this.endStartupStage?.('shelf.query', startedAt, 'ready');
          else if (result?.facts.fact === 'failed' || result?.facts.fact === 'refreshFailed') this.endStartupStage?.('shelf.query', startedAt, 'failed');
        } catch (_diagnostic) { /* Diagnostics cannot rewrite the completed read. */ }
      });
  }

  private getBookshelfProjection(): BookshelfProjectionOwner | undefined {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner)) return undefined;
    const projection = this.bookshelfHost.projection(owner);
    if (projection === undefined) return undefined;
    const navigation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount, route = this.route;
    const identity = JSON.stringify([this.rssInstanceIdentity, mounting, navigation, route, 'shelf-projection']);
    if (this.bookshelfProjectionOwner !== projection || this.bookshelfProjectionBinding?.identity !== identity) {
      this.bookshelfProjectionOwner?.detach(this.bookshelfProjectionBinding?.identity ?? '');
      const binding: BookshelfProjectionBinding = { identity,
        current: (): boolean => !this.shelfReceiptRetired && this.isCurrentRuntime(owner) &&
          owner === this.mountedRuntimeOwner && navigation === this.navigationGeneration && mounting === this.detailShelfAdmissionMount && route === this.route,
        anchorKey: (): string => this.bookshelfViewState.anchorKey,
        sources: (): BookshelfNamedSource[][] => [this.searchHost.sources(), this.sourceSources, this.sourceToolsSnapshot.sources],
        emit: (snapshot: BookshelfProjectionSnapshot): void => this.applyBookshelfProjection(snapshot, owner, navigation),
        membership: (books: ShelfBook[]): void => this.searchHost.updateShelf(books),
        membershipNeeded: (): boolean => this.route === 'search',
        accepted: (state: BookshelfDataState): void => {
          if (state.kind === 'populated') { this.scheduleBookshelfBackgroundRefresh(state.shelf.books); this.preparePersistedShelfBooks(); }
          else this.traceStartupStage?.('shelf.empty-model-ready', 'ready');
        },
        failed: (error: Error): void => hilog.warn(DOMAIN, 'Reader', 'Bookshelf projection: %{private}s', error.message) };
      this.bookshelfProjectionOwner = projection; this.bookshelfProjectionBinding = binding;
      projection.attach(binding);
    }
    return projection;
  }

  private applyBookshelfProjection(snapshot: BookshelfProjectionSnapshot, owner: ReaderRuntimeOwner, navigation: number): void {
    if (snapshot.filter.readingState !== this.shelfReadingFilter || snapshot.filter.sourceKind !== this.shelfSourceFilter) return;
    const wasAdmitted = this.isBookshelfVisualAdmitted;
    this.bookshelfLoadGeneration = snapshot.generation;
    this.shelfBooks = snapshot.books; this.shelfProjectionRevision = snapshot.revision;
    this.shelfMatchedTotal = snapshot.matchedTotal; this.shelfWindowOffset = snapshot.offset;
    this.shelfHasOnlineBooks = snapshot.hasOnlineBooks; this.continueReading = snapshot.continueReading;
    this.shelfPageLoading = snapshot.pageLoading; this.isCoreShelfEmpty = snapshot.coreEmpty;
    this.isBookshelfVisualAdmitted = snapshot.visualAdmitted;
    this.bookshelfReadOwner = owner; this.bookshelfReadNavigation = navigation; this.bookshelfReadFacts = snapshot.facts;
    this.bookshelfLoadFailed = snapshot.facts?.fact === 'failed' || (snapshot.facts?.fact === 'partial' && !snapshot.visualAdmitted);
    if (!wasAdmitted && snapshot.visualAdmitted) this.traceStartupStage?.('shelf.model-ready', 'ready');
  }

  private invalidateBookshelfProjection(): void { this.getBookshelfProjection()?.invalidate(); }

  private shelfReadRecovery(): ReaderRecoveryView {
    if (!this.isCurrentRuntime(this.bookshelfReadOwner) || !this.isBookshelfVisualAdmitted ||
      this.bookshelfReadNavigation !== this.navigationGeneration || this.route !== 'bookshelf' || this.shelfReceiptRetired ||
      (this.bookshelfReadFacts?.fact !== 'refreshFailed' && this.bookshelfReadFacts?.fact !== 'partial')) return this.emptyShelfRecovery();
    return readerRecoveryView(undefined, this.bookshelfReadFacts);
  }

  private retryBookshelfRead(generation: number): void {
    if (generation !== this.bookshelfReadFacts?.generation || generation !== this.bookshelfLoadGeneration ||
      this.bookshelfReadFacts?.canRetry !== true || !this.isCurrentRuntime(this.bookshelfReadOwner) ||
      this.bookshelfReadNavigation !== this.navigationGeneration || this.route !== 'bookshelf' || this.shelfReceiptRetired) return;
    this.refreshBookshelf();
  }

  private isKnownDetailChapter(chapterIndex: number | undefined): boolean {
    if (this.detailBook?.sourceId !== LOCAL_SOURCE_ID && this.remoteReadingSession !== undefined) {
      return this.remoteReadingSession.entries.some((entry): boolean => entry.navigable !== false && entry.url.trim().length > 0 &&
        (chapterIndex === undefined || entry.index === chapterIndex));
    }
    return this.detailToc.some((entry: LocalReadingTocEntry): boolean =>
      entry.navigable !== false && (chapterIndex === undefined || entry.index === chapterIndex));
  }

  private nextNavigationGeneration(): number {
    this.retireSettingsPresentation();
    this.retireSourceManagementPresentation();
    this.retireSourceSwitchPresentation();
    this.retireRssEditorPresentation();
    this.retireRssPresentation();
    this.retireReadingEntryPresentation();
    this.retireBookshelfCatalogPresentation();
    this.bookshelfHost.detachManagementPresentation();
    this.bookshelfManagementPresentationIdentity = '';
    this.discoverOrchestrator?.detachPresentation(this.discoverPresentationIdentity);
    this.discoverPresentationIdentity = '';
    this.rulesManagementOrchestrator?.detachPresentation(this.rulesPresentationIdentity);
    this.rulesPresentationIdentity = '';
    this.syncOrchestrator?.detachPresentation(this.syncPresentationIdentity);
    this.syncPresentationIdentity = '';
    this.bookshelfUpdateRunning = false;
    this.bookshelfBackgroundRefreshRunning = false;
    this.temporaryBackLease = undefined;
    this.jsonImportVisible = false;
    this.nativeAlertOwner.retire();
    this.shelfReadingPreparation = false;
    this.pendingLocalDirectoryProjection = undefined;
    this.navigationGeneration += 1;
    return this.navigationGeneration;
  }

  private isCurrentRoute(generation: number, route: ReaderRoute): boolean {
    return generation === this.navigationGeneration && this.route === route;
  }

  private applyBookshelfState(state: BookshelfDataState, refreshOnly: boolean = false, preserveAnchor: boolean = true): void {
    const projection = this.getBookshelfProjection(), binding = this.bookshelfProjectionBinding;
    if (projection !== undefined && binding !== undefined)
      projection.accept(state, this.shelfFilter(), binding, refreshOnly, preserveAnchor);
  }

  private getBookshelfCatalogOwner(): BookshelfCatalogOwner | undefined {
    const owner = this.mountedRuntimeOwner;
    if (owner === undefined || this.shelfReceiptRetired || !this.isCurrentRuntime(owner)) return undefined;
    const catalog = this.bookshelfHost.catalog(owner);
    if (catalog === undefined) return undefined;
    const navigation = this.navigationGeneration, mounting = this.detailShelfAdmissionMount;
    const identity = JSON.stringify([this.rssInstanceIdentity, mounting, navigation, 'shelf-catalog']);
    if (this.bookshelfCatalogHost !== catalog || this.bookshelfCatalogBinding?.identity !== identity) {
      this.retireBookshelfCatalogPresentation();
      const binding: BookshelfCatalogBinding = { identity,
        current: (): boolean => this.isCurrentBookshelfPresentation(navigation, owner, mounting),
        automaticAllowed: (): boolean => this.canRunBookshelfBackgroundRefresh(),
        revision: (): string => this.shelfProjectionRevision ?? '',
        filter: (): BookshelfFilter => this.shelfFilter(),
        emit: (snapshot: BookshelfCatalogSnapshot): void => this.applyBookshelfCatalogSnapshot(snapshot, owner),
        project: (state: BookshelfDataState): void => { this.invalidateBookshelfProjection(); this.applyBookshelfState(state, true); },
        prefetch: (session: RemoteReadingSession, current: () => boolean): Promise<void> => this.prefetchReadingWindow(session, undefined, current, owner),
        diagnostic: (message: string): void => hilog.warn(DOMAIN, 'Reader', '%{private}s', message) };
      this.bookshelfCatalogHost = catalog; this.bookshelfCatalogBinding = binding; catalog.attach(binding);
    }
    return catalog;
  }

  private applyBookshelfCatalogSnapshot(snapshot: BookshelfCatalogSnapshot, owner: ReaderRuntimeOwner): void {
    this.bookshelfCatalogOwner = owner;
    this.bookshelfUpdateRunning = snapshot.manualRunning;
    this.bookshelfBackgroundRefreshRunning = snapshot.automaticRunning;
    this.bookshelfUpdateDone = snapshot.done; this.bookshelfUpdateTotal = snapshot.total;
    this.bookshelfCatalogFacts = snapshot.facts; this.bookshelfCatalogReadbackFailed = snapshot.readbackFailed;
    this.bookshelfBackgroundSeeds = snapshot.seeds;
  }

  private retireBookshelfCatalogPresentation(): void {
    this.bookshelfCatalogHost?.detach(this.bookshelfCatalogBinding?.identity ?? '');
    this.bookshelfCatalogBinding = undefined;
  }

  private scheduleBookshelfBackgroundRefresh(books: ShelfBook[], revisionRetry: boolean = false): void {
    const catalog = this.getBookshelfCatalogOwner(), binding = this.bookshelfCatalogBinding;
    if (catalog !== undefined && binding !== undefined)
      catalog.automatic(books, binding, CATALOG_REFRESH_INTERVAL_MS, revisionRetry);
  }

  private startManualBookshelfUpdate(): void {
    const catalog = this.getBookshelfCatalogOwner(), binding = this.bookshelfCatalogBinding;
    if (catalog !== undefined && binding !== undefined) catalog.manual(this.shelfBooks, binding, CATALOG_REFRESH_INTERVAL_MS);
  }

  private async reconcileBookshelfCatalogProjection(generation: number): Promise<void> {
    const catalog = this.getBookshelfCatalogOwner(), binding = this.bookshelfCatalogBinding;
    if (catalog !== undefined && binding !== undefined) await catalog.reconcile(generation, binding);
  }

  private canRunBookshelfBackgroundRefresh(): boolean {
    return this.applicationSettingsSnapshot?.autoCheckUpdate === true && this.settingsSnapshot.autoCheckUpdate &&
      this.route === 'bookshelf' && !this.readingSessionActive && this.searchAppForeground;
  }

  private hasDeclaredCoverUrl(book: ShelfBook): boolean {
    if (book.coverUrl === undefined) {
      return false;
    }
    return /^(data:image\/(png|jpeg|bmp|webp);base64,|file:\/\/)/.test(book.coverUrl.trim());
  }

  private openImportDialog(): void {
    if (this.shelfReceiptRetired || this.route !== 'bookshelf') return;
    const owner = ReaderRuntimeOwner.current(); const navigation = this.navigationGeneration;
    this.bookshelfHost.operations(owner).openImport((): boolean => !this.shelfReceiptRetired && this.isCurrentRuntime(owner) &&
      this.route === 'bookshelf' && navigation === this.navigationGeneration);
  }

  private closeImportDialog(): void {
    const owner = this.shelfOperationOwner;
    if (owner !== undefined && this.isCurrentRuntime(owner)) this.bookshelfHost.operations(owner).closeImport();
  }

  private async beginImport(): Promise<void> {
    const owner = this.shelfOperationOwner;
    if (owner === undefined || !this.isCurrentRuntime(owner) || this.route !== 'bookshelf') return;
    const identity = this.shelfOperation.importIdentity; const navigation = this.navigationGeneration;
    const current = (): boolean => this.isCurrentImport(identity, navigation, owner);
    await this.bookshelfHost.operations(owner).importFiles(this.shelfFilter(), current);
  }

  private isCurrentImport(identity: number, navigationGeneration: number, owner: ReaderRuntimeOwner): boolean {
    return !this.shelfReceiptRetired && this.shelfOperation.importIdentity === identity && this.hasVisibleImportDialog() &&
      this.navigationGeneration === navigationGeneration && this.route === 'bookshelf' && this.isCurrentRuntime(owner);
  }

  private reconcileImportPresentation(): void {
    const owner = ReaderRuntimeOwner.current();
    const navigation = this.navigationGeneration;
    const operation = this.bookshelfHost.operations(owner); operation.restoreImport(this.storedImportPresentation,
      (): boolean => !this.shelfReceiptRetired && this.isCurrentRuntime(owner) && this.route === 'bookshelf' && navigation === this.navigationGeneration);
    this.shelfOperationOwner = owner; this.shelfOperation = operation.current();
    const mounting = this.detailShelfAdmissionMount;
    void operation.recoverRemoval(this.shelfFilter(), (): boolean =>
      this.isCurrentBookshelfPresentation(navigation, owner, mounting));
  }

  private hasVisibleImportDialog(): boolean { return this.shelfOperation.importPresentation !== undefined; }
  private visibleImportDialogState(): LocalImportDialogState { return this.shelfOperation.importPresentation?.state ?? 'fileSelection'; }
  private visibleImportBatch(): LocalImportBatch | undefined { return this.shelfOperation.importPresentation?.batch; }
  private currentImportPresentation(): LocalImportPresentation | undefined { return this.shelfOperation.importPresentation; }
}
