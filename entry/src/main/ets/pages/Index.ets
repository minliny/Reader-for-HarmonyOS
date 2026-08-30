import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import { errorMessageOf } from '../app/ErrorMessage';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { readerContentSafeTop } from '../features/common/ReaderWindowMetrics';
import {
  ReaderCoreGateway,
  type ShelfBook,
} from '../app/ReaderCoreGateway';
import {
  type BookshelfDataState,
  BookshelfFlowGateway,
  type BookshelfRemovalTarget,
  type BookshelfRemoveBatchOutcome,
  type BookshelfRemoveOutcome,
} from '../features/bookshelf/BookshelfFlowGateway';
import { BookshelfPage } from '../features/bookshelf/BookshelfPage';
import { BookshelfMultiSelectPage } from '../features/bookshelf/BookshelfMultiSelectPage';
import { BookshelfManagementPage } from '../features/bookshelf/BookshelfManagementPage';
import {
  BookshelfManagementOrchestrator,
  EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT,
  type BookshelfManagementSnapshot,
} from '../features/bookshelf/BookshelfManagementOrchestrator';
import { DiscoverPage } from '../features/discover/DiscoverPage';
import {
  DiscoverOrchestrator,
  EMPTY_DISCOVER_PRESENTATION,
  type DiscoverPresentation,
} from '../features/discover/DiscoverOrchestrator';
import { BookshelfEmptyPage } from '../features/bookshelf/BookshelfEmptyPage';
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
import { ReaderShell } from '../features/shell/ReaderShell';
import {
  LocalReadingFlowGateway,
  type LocalReadingDownloadState,
  type LocalReadingTocEntry,
} from '../features/reading/LocalReadingFlowGateway';
import type { ReadingBookDetail } from '../features/reading/ReadingBookDetail';
import {
  RemoteReadingFlowGateway,
  type RemoteReadingBookSeed,
  type RemoteReadingProgressState,
  type RemoteReadingSession,
} from '../features/reading/RemoteReadingFlowGateway';
import { ReadingOfflineGateway } from '../features/reading/ReadingOfflineGateway';
import {
  isRemoteReadingCacheFallbackEligible,
  type RemoteReadingVariable,
} from '../features/reading/RemoteReadingContract';
import type {
  ReaderDirectoryChapterStartBookmarkRequest,
  ReaderPageBookmarkToggleRequest,
} from '../features/reading/ReaderDirectoryMarkerState';
import type {
  SearchBook,
  SearchSource,
} from '../features/search/SearchGateway';
import { SearchOrchestrator } from '../features/search/SearchOrchestrator';
import {
  SearchPage,
  type SearchPresentation,
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
  type RssSourceSnapshot,
} from '../features/rss/RssOrchestrator';
import {
  RssPage,
  type RssMode,
  type RssPresentation,
} from '../features/rss/RssPage';
import { SettingsPage, type SettingsSnapshot } from '../features/settings/SettingsPage';
import { SettingsOrchestrator } from '../features/settings/SettingsOrchestrator';
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
import {
  SourceGateway,
  type BookSource,
} from '../features/source/SourceGateway';
import {
  SourceOrchestrator,
  type SourceImportCompletion,
  type SourceManagementStatusKind,
} from '../features/source/SourceOrchestrator';
import {
  buildSourceSwitchCommitParams,
  sourceSwitchCandidateKey,
  SourceSwitchGateway,
  type SourceSwitchCandidate,
  type SourceSwitchCommitOutcome,
  type SourceSwitchDiscoveryOutcome,
  type PendingSourceSwitch,
  type SourceSwitchProbeQuery,
  type SourceSwitchRollbackResult,
  type SourceSwitchTargetToc,
} from '../features/source/SourceSwitchGateway';
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
import { isReaderProductSurfaceEnabled } from '../app/ReaderProductScope';

const DOMAIN = 0x5244;
const IMPORT_PRESENTATION_KEY = 'reader.bookshelf.import.presentation.v1';
const MAX_IMPORT_RESULT_ITEMS = 50;
const LOCAL_SOURCE_ID = 'local';
const READING_CACHE_BEFORE = 2;
const READING_CACHE_AFTER = 2;
const CATALOG_REFRESH_NEAR_END = 3;
const CATALOG_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const SEARCH_DETAIL_HEDGE_DELAY_MS = 650;
const SEARCH_DETAIL_CACHE_PROBE_CONCURRENCY = 4;
const SEARCH_DETAIL_WARMUP_LIMIT = 2;

type ReaderRoute = 'bookshelf' | 'discover' | 'detail' | 'reading' | 'directory' | 'search' |
  'bookshelfManagement' | 'bookshelfMultiSelect' |
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

class SourceSwitchAnchor {
  chapterIndex: number;
  chapterTitle: string;

  constructor(chapterIndex: number, chapterTitle: string) {
    this.chapterIndex = chapterIndex;
    this.chapterTitle = chapterTitle;
  }
}

class PendingSourceSwitchTransaction {
  fromSourceId: string;
  fromBookId: string;
  targetSourceId: string;
  targetBookId: string;
  targetChapterIndex: number;
  transactionId: string;

  constructor(
    fromSourceId: string,
    fromBookId: string,
    targetSourceId: string,
    targetBookId: string,
    targetChapterIndex: number,
    transactionId: string,
  ) {
    this.fromSourceId = fromSourceId;
    this.fromBookId = fromBookId;
    this.targetSourceId = targetSourceId;
    this.targetBookId = targetBookId;
    this.targetChapterIndex = targetChapterIndex;
    this.transactionId = transactionId;
  }
}

class RemoteDetailAdmission {
  session: RemoteReadingSession;
  refreshInBackground: boolean;

  constructor(session: RemoteReadingSession, refreshInBackground: boolean = false) {
    this.session = session;
    this.refreshInBackground = refreshInBackground;
  }
}

class RemoteSessionAttemptOutcome {
  index: number;
  session: RemoteReadingSession | undefined;
  error: Error | undefined;

  constructor(
    index: number,
    session: RemoteReadingSession | undefined = undefined,
    error: Error | undefined = undefined,
  ) {
    this.index = index;
    this.session = session;
    this.error = error;
  }
}

class LocalImportPresentation {
  state: LocalImportDialogState;
  batch: LocalImportBatch | undefined;

  constructor(state: LocalImportDialogState, batch: LocalImportBatch | undefined = undefined) {
    this.state = state;
    this.batch = batch;
  }
}

@Entry
@Component
struct Index {
  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @State private shelfBooks: ShelfBook[] = [];
  @State private continueReading: ShelfBook | undefined = undefined;
  @State private isBookshelfVisualAdmitted: boolean = false;
  @State private isCoreShelfEmpty: boolean = false;
  // SHF-03: manual shelf-wide update sweep progress, mirrored on the page.
  @State private bookshelfUpdateRunning: boolean = false;
  @State private bookshelfUpdateDone: number = 0;
  @State private bookshelfUpdateTotal: number = 0;
  @State private bookshelfManagementSnapshot: BookshelfManagementSnapshot =
    EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT;
  @State private bookshelfMultiSelectInitialKey: string = '';
  @State private bookshelfBatchRemovalBusy: boolean = false;
  @State private route: ReaderRoute = 'bookshelf';
  @State private jsonImportVisible: boolean = false;
  @State private jsonImportContext: JsonImportContext = 'bookSource';
  @State private detailBook: ReadingBookDetail | undefined = undefined;
  @State private detailToc: LocalReadingTocEntry[] = [];
  @State private detailInBookshelf: boolean = true;
  @State private detailLoadingMessage: string = '';
  @State private remoteReadingSession: RemoteReadingSession | undefined = undefined;
  @State private requestedChapterIndex: number | undefined = undefined;
  @State private preparedReaderRoute: PreparedReaderRoute = 'reading';
  @State private directoryCurrentChapterIndex: number = -1;
  @State private directoryChapterTitle: string = '';
  @State private directoryReturnTarget: DirectoryReturnTarget = 'detail';
  @State private searchPresentation: SearchPresentation = { kind: 'initial', history: [] };
  @State private searchSources: SearchSource[] = [];
  @State private rssPresentation: RssPresentation = { kind: 'feed', subscriptions: [], recentUnread: [] };
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
  @State private sourceToolsSnapshot: SourceToolsSnapshot = EMPTY_SOURCE_TOOLS_SNAPSHOT;
  @State private rulesManagementSnapshot: RulesManagementSnapshot = EMPTY_RULES_MANAGEMENT_SNAPSHOT;
  @State private discoverPresentation: DiscoverPresentation = EMPTY_DISCOVER_PRESENTATION;
  @State private settingsSnapshot: SettingsSnapshot = {
    autoCheckUpdate: true,
    tapBottomScrollTop: true,
    reduceMotion: false,
    crashLog: true,
  };
  @State private syncSnapshot: SyncSnapshot = {
    webdavUrl: '',
    webdavUser: '',
    webdavPass: '',
    backupPass: '',
    webdavPath: '/ReaderBackup/ReaderHarmony',
    saveLocation: 'WebDAV',
    backupFrequency: '手动',
    backupScope: '完整 Core 数据（AES 加密）',
    history: [],
    statusMessage: '',
  };
  @State private syncSnapshotReady: boolean = false;
  /** Source-switch overlay presentation + the gateway that drives it. */
  @State private sourceSwitchVisible: boolean = false;
  @State private sourceSwitchState: SourceSwitchPanelState = { kind: 'discovering' };
  private sourceSwitchGateway: SourceSwitchGateway | undefined;
  /** Retained until the target chapter's first measured progress commit. */
  private pendingSourceSwitch: PendingSourceSwitchTransaction | undefined = undefined;
  private sourceSwitchRollbackInFlight: boolean = false;
  private sourceSwitchReconciliationGeneration: number = 0;
  /**
   * Keeps the single reader instance mounted behind Local Book Detail while
   * it measures and persists its first real page.  The Figma ReadingSurface
   * becomes visible only through the admitted 0ms static route once ready.
   */
  @State private readingSessionActive: boolean = false;
  private navigationGeneration: number = 0;
  /** Prevents repeated marker taps from issuing duplicate bookmark mutations. */
  private directoryBookmarkMutationGeneration: number = 0;
  private directoryBookmarkMutationActiveKey: string = '';
  /** One UI mutation gate over Core's already-durable download queue. */
  private offlineMutationGeneration: number = 0;
  @State private offlineMutationActiveKey: string = '';
  /** Serializes the destructive detail-page removal for one exact book. */
  private bookshelfRemovalGeneration: number = 0;
  @State private bookshelfRemovalActiveKey: string = '';
  private bookshelfBatchRemovalGeneration: number = 0;
  /** Rejects a late shelf read after a newer import/refresh has completed. */
  private bookshelfLoadGeneration: number = 0;
  private bookshelfBackgroundRefreshRunning: boolean = false;
  private remoteCatalogRefreshAt: Map<string, number> = new Map();
  private automaticSourceRecoveryKey: string = '';
  private searchOrchestrator: SearchOrchestrator | undefined;
  /** Bounded, process-local single-flight only; Core remains the durable cache. */
  private searchDetailWarmupGeneration: number = 0;
  private searchDetailWarmups: Map<string, Promise<RemoteReadingSession>> = new Map();
  private searchDetailWarmSessions: Map<string, RemoteReadingSession> = new Map();
  private discoverOrchestrator: DiscoverOrchestrator | undefined;
  private bookshelfManagementOrchestrator: BookshelfManagementOrchestrator | undefined;
  private settingsOrchestrator: SettingsOrchestrator | undefined;
  private rulesManagementOrchestrator: RulesManagementOrchestrator | undefined;
  private syncOrchestrator: SyncOrchestrator | undefined;
  private sourceOrchestrator: SourceOrchestrator | undefined;
  private sourceToolsOrchestrator: SourceToolsOrchestrator | undefined;
  private rssOrchestrator: RssOrchestrator | undefined;
  private rssEditorOrchestrator: RssSubscriptionEditorOrchestrator | undefined;
  /**
   * Installed only by the mounted ReadingSurface.  System Back calls this
   * guarded request so Core position persistence settles before the route is
   * changed back to Local Book Detail.
   */
  private readingExitRequest: (() => void) | undefined = undefined;
  /** A Back press during hidden first-page preparation still exits serially. */
  private exitToDetailOriginAfterReader: boolean = false;
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
    this.reconcileImportPresentation();
    // Shelf projection is safe to show immediately. Source-switch recovery
    // reconciles in parallel and triggers its own refresh only when it
    // actually rolls a transaction back.
    this.refreshBookshelf();
    void this.reconcilePendingSourceSwitches();
  }

  onBackPress(): boolean {
    if (this.jsonImportVisible) {
      this.dismissJsonImport();
      return true;
    }
    if (this.sourceSwitchVisible) {
      // The detail/reading overlay must win over the route-specific exit
      // branch so Back only closes the source-switch panel.
      this.closeSourceSwitch();
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
    if (this.route === 'bookshelfManagement') {
      this.returnToBookshelf();
      return true;
    }
    if (this.route === 'bookshelfMultiSelect') {
      if (!this.bookshelfBatchRemovalBusy) {
        this.returnToBookshelf();
      }
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
        this.returnToDetail();
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
    if (this.hasVisibleImportDialog()) {
      this.closeImportDialog();
      return true;
    }
    return false;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.route === 'bookshelf' && this.isBookshelfVisualAdmitted) {
        BookshelfPage({
          books: this.shelfBooks,
          continueReading: this.continueReading,
          reduceMotion: this.settingsSnapshot.reduceMotion,
          onImportRequested: (): void => this.openImportDialog(),
          onSearchRequested: (): void => this.openSearch(),
          onRssRequested: (): void => this.openRss(),
          onSettingsRequested: (): void => this.openSettings(),
          onDiscoverRequested: (): void => this.openDiscover(),
          onManageRequested: (): void => this.openBookshelfManagement(),
          onBookshelfSettingsRequested: (): void => this.openSettings(),
          onBatchManageRequested: (): void => this.openBookshelfMultiSelect(),
          onBookSelected: (book: ShelfBook): void => this.openShelfBook(book),
          onBookMultiSelectRequested: (book: ShelfBook): void => this.openBookshelfMultiSelect(book),
          onBookInfoRequested: (book: ShelfBook): void => this.openShelfBookInfo(book),
          onBookRemoveRequested: (book: ShelfBook): void => this.requestRemoveShelfBook(book),
          onCheckUpdatesRequested: (): void => this.startManualBookshelfUpdate(),
          updateRunning: this.bookshelfUpdateRunning,
          updateProgressDone: this.bookshelfUpdateDone,
          updateProgressTotal: this.bookshelfUpdateTotal,
        });
      } else if (this.route === 'bookshelfMultiSelect') {
        BookshelfMultiSelectPage({
          books: this.shelfBooks,
          initialSelectedKey: this.bookshelfMultiSelectInitialKey,
          busy: this.bookshelfBatchRemovalBusy,
          onCancel: (): void => this.returnToBookshelf(),
          onRemoveSelected: (keys: string[]): void => this.requestRemoveShelfBooks(keys),
        });
      } else if (this.route === 'bookshelfManagement') {
        BookshelfManagementPage({
          snapshot: this.bookshelfManagementSnapshot,
          onBack: (): void => this.returnToBookshelf(),
          onGroupNameChanged: (value: string): void =>
            this.getBookshelfManagementOrchestrator().updateGroupName(value),
          onGroupOrderChanged: (value: string): void =>
            this.getBookshelfManagementOrchestrator().updateGroupOrder(value),
          onSelectGroup: (groupId: number): void =>
            this.getBookshelfManagementOrchestrator().selectGroup(groupId),
          onClearGroupEditor: (): void => this.getBookshelfManagementOrchestrator().clearGroupEditor(),
          onSaveGroup: (): void => this.getBookshelfManagementOrchestrator().saveGroup(),
          onToggleGroupShown: (groupId: number): void =>
            this.getBookshelfManagementOrchestrator().toggleGroupShown(groupId),
          onDeleteGroup: (groupId: number): void =>
            this.getBookshelfManagementOrchestrator().deleteGroup(groupId),
          onSelectBook: (sourceId: string, bookId: string): void =>
            this.getBookshelfManagementOrchestrator().selectBook(sourceId, bookId),
          onAssignmentGroupChanged: (value: string): void =>
            this.getBookshelfManagementOrchestrator().updateAssignmentGroup(value),
          onAssignBook: (): void => this.getBookshelfManagementOrchestrator().assignSelectedBook(),
        });
      } else if (this.route === 'bookshelf' && this.isCoreShelfEmpty) {
        // H-NOTE-1: Tablet empty has no Figma Final variant. Until Figma
        // supplies a Tablet-specific empty assembly, mount the Phone
        // BookshelfEmptyPage on Tablet as well (Figma has not yet defined
        // the rule, so we reuse the available Phone assembly rather than
        // leave the Tablet user staring at a blank page).
        BookshelfEmptyPage({
          reduceMotion: this.settingsSnapshot.reduceMotion,
          onImportRequested: (): void => this.openImportDialog(),
          onSearchRequested: (): void => this.openSearch(),
          onRssRequested: (): void => this.openRss(),
          onSettingsRequested: (): void => this.openSettings(),
          onDiscoverRequested: (): void => this.openDiscover(),
          onBookshelfSettingsRequested: (): void => this.openSettings(),
          onBatchManageRequested: (): void => this.openBookshelfMultiSelect(),
        });
      } else if (this.route === 'search') {
        SearchPage({
          presentation: this.searchPresentation,
          sources: this.searchSources,
          shelfBooks: this.shelfBooks,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnToBookshelf(),
          onSearch: (keyword: string, scopeSourceIds?: string[]): void =>
            this.performSearch(keyword, scopeSourceIds),
          onStop: (): void => this.stopSearch(),
          onClearHistory: (): void => this.clearSearchHistory(),
          onSelectResult: (book: SearchBook, variants: SearchBook[]): void =>
            this.onSearchResultSelected(book, variants),
          onRetry: (): void => this.retrySearch(),
          onManageSources: (): void => this.manageSourcesFromSearch(),
        });
      } else if (this.route === 'rss') {
        RssPage({
          presentation: this.rssPresentation,
          isTablet: deviceInfo.deviceType === 'tablet',
          activeMode: 'sources',
          onBack: (): void => this.returnToBookshelf(),
          onRefresh: (): void => this.refreshRss(),
          onManage: (): void => this.onRssManage(),
          onSelectSubscription: (id: string): void => this.onRssSubscriptionSelected(id),
          onSelectItem: (subscriptionId: string, guid: string): void =>
            this.onRssItemSelected(subscriptionId, guid),
          onModeRequested: (mode: RssMode): void => this.onRssModeRequested(mode),
          onSettingsRequested: (): void => this.openSettings(),
          onDiscoverRequested: (): void => this.openDiscover(),
        });
      } else if (this.route === 'rssSubscriptionManagement') {
        RssSubscriptionManagementPage({
          items: this.rssSubscriptionManagementItems(),
          isTablet: deviceInfo.deviceType === 'tablet',
          focusedSubscriptionId: this.rssManagementFocusSubscriptionId,
          onBack: (): void => this.returnToRss(),
          onAdd: (): void => this.onRssSubscriptionAddRequested(),
          onImport: (): void => this.requestRssSourceImport(),
          onExport: (): void => this.exportRssSources(),
          onToggle: (id: string, enabled: boolean): void =>
            this.getRssOrchestrator().toggleSubscription(id, enabled),
          onViewArticles: (id: string): void => this.onRssManagementViewArticles(id),
          onEditSource: (id: string): void => this.onRssSubscriptionEditRequested(id),
          onRefresh: (id: string): void => this.getRssOrchestrator().refreshSubscription(id),
          onDelete: (id: string): void => this.requestRssSubscriptionDelete(id),
        });
      } else if (this.route === 'rssSubscriptionEditor') {
        RssSubscriptionEditorPage({
          snapshot: this.rssEditorSnapshot,
          onBack: (): void => this.returnToRssSubscriptionManagement(),
          onFeedUrlChanged: (value: string): void => this.getRssEditorOrchestrator().updateFeedUrl(value),
          onTitleChanged: (value: string): void => this.getRssEditorOrchestrator().updateTitle(value),
          onEnabledChanged: (value: boolean): void => this.getRssEditorOrchestrator().updateEnabled(value),
          onEnabledCookieJarChanged: (value: boolean): void =>
            this.getRssEditorOrchestrator().updateEnabledCookieJar(value),
          onSourceFieldChanged: (field: RssSourceTextField, value: string): void =>
            this.getRssEditorOrchestrator().updateSourceField(field, value),
          onSave: (): void => this.getRssEditorOrchestrator().save(),
        });
      } else if (this.route === 'rssSourceFeed' && this.selectedRssSubscription !== undefined) {
        RssSourceFeedPage({
          subscription: this.selectedRssSubscription,
          items: this.selectedRssItems,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnFromRssSourceFeed(),
          onSelectItem: (item: RssItem): void => this.onRssSourceItemSelected(item),
          onRefresh: (): void => this.refreshRssSourceFeed(),
          onEditSource: (): void =>
            this.openRssManagementForSubscription(this.selectedRssSubscription?.subscriptionId),
          onSourceOperations: (): void =>
            this.openRssManagementForSubscription(this.selectedRssSubscription?.subscriptionId),
        });
      } else if (this.route === 'rssEntryDetail' && this.selectedRssSubscription !== undefined &&
        this.selectedRssItem !== undefined) {
        RssEntryDetailPage({
          subscription: this.selectedRssSubscription,
          item: this.selectedRssItem,
          isTablet: deviceInfo.deviceType === 'tablet',
          favoriteState: this.selectedRssFavoriteState,
          onBack: (): void => this.returnFromRssEntryDetail(),
          onViewSource: (): void => this.returnToRssSourceFeed(),
          onFavoriteRequested: (favorite: boolean): void =>
            this.onRssEntryFavoriteRequested(favorite),
          onSourceSettings: (): void =>
            this.openRssManagementForSubscription(this.selectedRssSubscription?.subscriptionId),
          onOpenOriginal: (): void => this.onRssOpenOriginalRequested(),
        });
      } else if (this.route === 'discover') {
        DiscoverPage({
          presentation: this.discoverPresentation,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnToBookshelf(),
          onRssRequested: (): void => this.openRss(),
          onSettingsRequested: (): void => this.openSettings(),
          onRefresh: (): void => this.getDiscoverOrchestrator().refresh(),
          onCycleSource: (): void => this.getDiscoverOrchestrator().cycleSource(),
          onSelectKind: (index: number): void => this.getDiscoverOrchestrator().selectKind(index),
          onPreviousPage: (): void => this.getDiscoverOrchestrator().previousPage(),
          onNextPage: (): void => this.getDiscoverOrchestrator().nextPage(),
        });
      } else if (this.route === 'settings') {
        SettingsPage({
          snapshot: this.settingsSnapshot,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnToBookshelf(),
          onOpenSourceManagement: (): void => this.openSourceManagement(),
          onOpenRulesManagement: (): void => this.openRulesManagement(),
          onOpenSync: (): void => this.openSync(),
          onRssRequested: (): void => this.openRss(),
          onDiscoverRequested: (): void => this.openDiscover(),
          onToggle: (key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
            value: boolean): void => this.onSettingToggled(key, value),
          onClearCache: (): Promise<boolean> => this.clearTextCache(),
        });
      } else if (this.route === 'rulesManagement') {
        RulesManagementPage({
          snapshot: this.rulesManagementSnapshot,
          onBack: (): void => this.returnFromRulesManagement(),
          onSaveReplace: (draft: ReplaceRuleDraft): void =>
            this.getRulesManagementOrchestrator().saveReplaceRule(draft),
          onDeleteReplace: (id: number): void => this.getRulesManagementOrchestrator().deleteReplaceRule(id),
          onSaveTxtToc: (draft: TxtTocRuleDraft): void =>
            this.getRulesManagementOrchestrator().saveTxtTocRule(draft),
          onDeleteTxtToc: (id: number): void => this.getRulesManagementOrchestrator().deleteTxtTocRule(id),
          onSaveDict: (draft: DictRuleDraft): void => this.getRulesManagementOrchestrator().saveDictRule(draft),
          onDeleteDict: (name: string): void => this.getRulesManagementOrchestrator().deleteDictRule(name),
          onSaveSubscription: (draft: RuleSubscriptionDraft): void =>
            this.getRulesManagementOrchestrator().saveRuleSubscription(draft),
          onDeleteSubscription: (id: number): void =>
            this.getRulesManagementOrchestrator().deleteRuleSubscription(id),
          onRefreshSubscription: (subscription: ManagedRuleSubscription): void =>
            this.getRulesManagementOrchestrator().refreshRuleSubscription(subscription),
          onExportBundle: (): void => this.getRulesManagementOrchestrator().exportBundle(),
          onImportBundle: (): void => this.openJsonImport('ruleBundle'),
        });
      } else if (this.route === 'source') {
        SourceManagementPage({
          sources: this.sourceSources,
          statusKind: this.sourceStatusKind,
          statusMessage: this.sourceStatusMessage,
          isTablet: deviceInfo.deviceType === 'tablet',
          reduceMotion: this.settingsSnapshot.reduceMotion,
          onBack: (): void => this.returnFromSourceManagement(),
          onToggleSource: (id: string, enabled: boolean): void => this.onSourceToggled(id, enabled),
          onDetectSource: (id: string): void => this.onSourceDetectionRequested(id),
          onLoginSource: (id: string): void => this.onSourceLoginRequested(id),
          onAddSource: (): void => this.openJsonImport('bookSource'),
          onOpenTools: (): void => this.openSourceTools(),
          onRetryLoad: (): void => this.getSourceOrchestrator().retryLoad(),
        });
      } else if (this.route === 'sourceTools') {
        SourceToolsPage({
          snapshot: this.sourceToolsSnapshot,
          onSelectAll: (): void => this.selectAllSourceTools(),
          onClearSelection: (): void => this.updateSourceToolsSelection([]),
          onToggleSelection: (sourceId: string): void => this.toggleSourceToolsSelection(sourceId),
          onBack: (): void => this.returnToSourceManagement(),
          onExportAll: (): void => this.getSourceToolsOrchestrator().exportAll(),
          onExportSelected: (sourceIds: string[]): void => this.exportSelectedSources(sourceIds),
          onCheckSelected: (sourceIds: string[]): void => this.checkSelectedSources(sourceIds),
          onSetSelectedEnabled: (sourceIds: string[], enabled: boolean): void =>
            this.setSelectedSourcesEnabled(sourceIds, enabled),
          onDeleteSelected: (sourceIds: string[]): void => this.requestSourceDelete(sourceIds),
          onOpenEditor: (sourceId: string): void => this.getSourceToolsOrchestrator().openEditor(sourceId),
          onEditorDraftChanged: (text: string): void => this.getSourceToolsOrchestrator().updateEditorDraft(text),
          onSaveEditor: (): void => this.getSourceToolsOrchestrator().saveEditor(),
          onCancelEditor: (): void => this.getSourceToolsOrchestrator().cancelEditor(),
          onDebugKeyChanged: (value: string): void => this.getSourceToolsOrchestrator().updateDebugKey(value),
          onDebugSource: (sourceId: string): void => this.getSourceToolsOrchestrator().debugSource(sourceId),
        });
      } else if (this.route === 'sync') {
        if (this.syncSnapshotReady) {
          SyncPage({
            snapshot: this.syncSnapshot,
            isTablet: deviceInfo.deviceType === 'tablet',
            onBack: (): void => this.returnToSettings(),
            onSaveConfig: (url: string, user: string, pass: string, backupPass: string, path: string): void =>
              this.onSyncSaveConfig(url, user, pass, backupPass, path),
            onTestConnection: (url: string, user: string, pass: string, path: string): void =>
              this.onSyncTestConnection(url, user, pass, path),
            onTriggerBackup: (): void => this.onSyncTriggerBackup(),
            onRestoreLatest: (): void => this.onSyncRestoreLatest(),
            onResolveRestore: (overwriteLocal: boolean): void => this.onSyncResolveRestore(overwriteLocal),
          });
        } else {
          Column() {
            Text('正在读取安全配置…');
          }
          .width('100%')
          .height('100%')
          .justifyContent(FlexAlign.Center)
          .backgroundColor('#FFF8F4EC');
        }
      } else if (this.route === 'detail' && this.detailBook !== undefined) {
        LocalBookDetail({
          book: this.detailBook,
          toc: this.detailToc,
          sourceSwitchEnabled: this.detailBook.sourceId !== LOCAL_SOURCE_ID &&
            this.remoteReadingSession !== undefined && this.detailToc.length > 0 &&
            this.bookshelfRemovalActiveKey.length === 0,
          inBookshelf: this.detailInBookshelf,
          loadingMessage: this.detailLoadingMessage,
          removalEnabled: !this.readingSessionActive && !this.sourceSwitchVisible &&
            this.pendingSourceSwitch === undefined && this.offlineMutationActiveKey.length === 0 &&
            this.bookshelfRemovalActiveKey.length === 0,
          removing: this.bookshelfRemovalActiveKey.length > 0,
          onContinue: (): void => this.openReading(undefined),
          onSelectChapter: (chapterIndex: number): void => this.openReading(chapterIndex),
          onOpenDirectory: (): void => this.openFullDirectory(),
          onSwitchSource: (): void => this.openDetailSourceSwitch(),
          onRemove: (): void => this.requestDetailShelfMutation(),
          onBack: (): void => this.returnFromDetail(),
        });
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
          sourceSwitchTransactionId: this.currentSourceSwitchTransactionId(),
          totalChapters: this.detailToc.length,
          requestedChapterIndex: this.requestedChapterIndex,
          isTablet: deviceInfo.deviceType === 'tablet',
          reduceMotion: this.settingsSnapshot.reduceMotion,
          visible: this.route === 'reading' || this.route === 'directory',
          route: this.route === 'directory' ? 'directory' : 'reading',
          tocEntries: this.detailToc,
          directoryCurrentChapterIndex: this.directoryCurrentChapterIndex,
          directoryChapterTitle: this.directoryChapterTitle,
          directoryOpenedFromControl: this.directoryReturnTarget === 'readerControl',
          offlineBookOperationActive: this.offlineMutationActiveKey.length > 0,
          chapterStartBookmarkCreationEnabled: true,
          sourceSwitchVisible: this.sourceSwitchVisible,
          sourceSwitchState: this.sourceSwitchState,
          onExitRequestHandler: (requestExit: () => void): void => {
            this.readingExitRequest = requestExit;
          },
          onExit: (): void => {
            this.readingExitRequest = undefined;
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
            this.returnToDetail();
          },
          onReadingReady: (chapterIndex: number): void => this.presentPreparedReading(chapterIndex),
          onReadingCommitted: (commit: ReadingCommit): void => this.applyReadingCommit(commit),
          onReadingFailure: (sourceId: string, bookId: string, message: string): void =>
            this.onReadingFailure(sourceId, bookId, message),
          onChapterCommitted: (chapterIndex: number, chapterTitle: string): void => {
            this.applyDirectoryChapter(chapterIndex, chapterTitle);
          },
          onSelectChapter: (chapterIndex: number): void => this.onDirectoryChapterSelected(chapterIndex),
          onDownloadChapter: (chapterIndex: number): void => this.downloadDirectoryChapter(chapterIndex),
          onDownloadBook: (): void => this.downloadDirectoryBook(),
          onClearBookOffline: (): void => this.requestClearDirectoryBookOffline(),
          onDeleteBookmarks: (bookmarkTimes: number[]): void => this.deleteDirectoryBookmarks(bookmarkTimes),
          onDirectoryProjectionChanged: (entries: LocalReadingTocEntry[]): void =>
            this.applyReaderDirectoryProjection(entries),
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            this.createDirectoryChapterStartBookmark(request),
          onTogglePageBookmark: (request: ReaderPageBookmarkToggleRequest): void =>
            this.toggleReaderPageBookmark(request),
          onCloseDirectory: (): void => this.closeDirectory(),
          onOpenDirectory: (): void => this.openReaderControlDirectory(),
          onSwitchSource: (): void => this.openSourceSwitch(),
          onOpenRulesManagement: (): void => this.requestRulesManagementFromReader(),
          onCloseSourceSwitch: (): void => this.closeSourceSwitch(),
          onRetrySourceSwitch: (): void => this.retrySourceSwitch(),
          onRefreshSourceSwitch: (): void => this.refreshSourceSwitch(),
          onPickSource: (candidate: SourceSwitchCandidate): void => this.onPickSource(candidate),
          onRollbackSourceSwitch: (): void => this.onRollbackSourceSwitch(),
        });
      }
      if (this.route === 'detail' && this.sourceSwitchVisible && this.detailBook !== undefined) {
        Stack({ alignContent: Alignment.Center }) {
          Stack()
            .width('100%')
            .height('100%')
            .backgroundColor('#40FFFFFF')
            .onClick((): void => this.closeSourceSwitch());
          SourceSwitchPanel({
            state: this.sourceSwitchState,
            currentSourceId: this.detailBook.sourceId,
            onClose: (): void => this.closeSourceSwitch(),
            onRetry: (): void => this.retrySourceSwitch(),
            onRefresh: (): void => this.refreshSourceSwitch(),
            onSelectCandidate: (candidate: SourceSwitchCandidate): void => this.onPickSource(candidate),
            onRollback: (): void => this.onRollbackSourceSwitch(),
          });
        }
        .width('100%')
        .height('100%');
      }
      if (this.route === 'bookshelf' && this.hasVisibleImportDialog()) {
        LocalImportDialog({
          state: this.visibleImportDialogState(),
          batch: this.visibleImportBatch(),
          onSelectFiles: (): void => this.beginImport(),
          onClose: (): void => this.closeImportDialog(),
        });
      }
      if (this.jsonImportVisible) {
        JsonImportDialog({
          title: this.jsonImportTitle(),
          description: this.jsonImportDescription(),
          isTablet: deviceInfo.deviceType === 'tablet',
          onDismiss: (): void => this.dismissJsonImport(),
          onSelectLocal: (): void => this.selectLocalJsonImport(),
          onImportOnline: (onlineUrl: string): void => this.importOnlineJson(onlineUrl),
        });
      }
      // Host capability surface only: mounted for ArkWeb controller lifecycle,
      // never used as the reading-body renderer.
      ArkWebExecutionHost()
    }
      .width('100%')
      .height('100%')
      .backgroundColor($r('app.color.reader_surface'))
      // App pages consume the current vp window snapshot. Reader owns an
      // edge-to-edge background and resolves its content/control rects inside
      // ReaderLayoutGeometry, so it must not inherit this App-page padding.
      .padding({ top: this.readerOwnsWindowEdges() ? 0 : this.appContentTopInset() })
      .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
  }

  private readerOwnsWindowEdges(): boolean {
    // The hidden reader warms behind Detail before its first page is admitted.
    // Keep Detail inside the app safe top until ReaderShell is actually visible.
    return this.readingSessionActive && (this.route === 'reading' || this.route === 'directory');
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
    this.rssPresentation = this.feedPresentation([], []);
    this.route = 'rss';
    void this.loadRss(generation);
  }

  private async loadRss(generation: number): Promise<void> {
    const gateway = new RssGateway(ReaderRuntimeOwner.current());
    try {
      const subscriptions = await gateway.loadSubscriptions();
      if (!this.isCurrentRoute(generation, 'rss')) {
        return;
      }
      // A true "recent unread" list requires one Core-owned, globally ordered
      // subscription-scoped query. Keep the slot empty until rss.entries.query
      // is formally admitted; do not fan out per-source reads and present the
      // concatenation as a global recent result.
      this.rssPresentation = this.feedPresentation(subscriptions, []);
    } catch (error) {
      // Partial/Fatal error visuals remain blocked in Figma. Preserve the
      // admitted RSS shell instead of presenting the obsolete full-page
      // error capture as a new route.
      if (this.isCurrentRoute(generation, 'rss')) {
        this.rssPresentation = this.feedPresentation([], []);
      }
      const message = errorMessageOf(error);
      hilog.error(DOMAIN, 'Reader',
        'RSS subscription projection failed: %{public}s', message);
    }
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

  private getDiscoverOrchestrator(): DiscoverOrchestrator {
    if (this.discoverOrchestrator === undefined) {
      this.discoverOrchestrator = new DiscoverOrchestrator(
        (presentation: DiscoverPresentation): void => {
          this.discoverPresentation = presentation;
        },
        (): boolean => this.route === 'discover',
      );
    }
    return this.discoverOrchestrator;
  }

  private openSettings(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'settings';
    this.getSettingsOrchestrator().open();
  }

  private openBookshelfManagement(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'bookshelfManagement';
    this.getBookshelfManagementOrchestrator().open();
  }

  private openBookshelfMultiSelect(initialBook?: ShelfBook): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.bookshelfBatchRemovalBusy = false;
    this.bookshelfMultiSelectInitialKey = initialBook === undefined ? '' : this.shelfBookKey(initialBook);
    this.route = 'bookshelfMultiSelect';
  }

  private openRulesManagement(): void {
    this.nextNavigationGeneration();
    this.rulesManagementReturnTarget = 'settings';
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'rulesManagement';
    this.getRulesManagementOrchestrator().open();
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
    this.getRulesManagementOrchestrator().open();
  }

  private getRulesManagementOrchestrator(): RulesManagementOrchestrator {
    if (this.rulesManagementOrchestrator === undefined) {
      this.rulesManagementOrchestrator = new RulesManagementOrchestrator(
        (snapshot: RulesManagementSnapshot): void => {
          this.rulesManagementSnapshot = snapshot;
        },
        (): boolean => this.route === 'rulesManagement',
      );
    }
    return this.rulesManagementOrchestrator;
  }

  private getBookshelfManagementOrchestrator(): BookshelfManagementOrchestrator {
    if (this.bookshelfManagementOrchestrator === undefined) {
      this.bookshelfManagementOrchestrator = new BookshelfManagementOrchestrator(
        (snapshot: BookshelfManagementSnapshot): void => {
          this.bookshelfManagementSnapshot = snapshot;
        },
        (): boolean => this.route === 'bookshelfManagement',
      );
    }
    return this.bookshelfManagementOrchestrator;
  }

  private onSettingToggled(
    key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
    value: boolean,
  ): void {
    this.getSettingsOrchestrator().toggle(key, value);
  }

  private async clearTextCache(): Promise<boolean> {
    try {
      const result = await ReaderRuntimeOwner.current().request('cache.clear', { scope: 'cache' });
      if (result.data['scope'] !== 'cache') {
        throw new Error('cache.clear returned an unexpected scope');
      }
      hilog.info(DOMAIN, 'Reader',
        'Text cache cleanup completed: cache=%{public}s chapters=%{public}s queue=%{public}s',
        `${result.data['cacheEntriesRemoved'] ?? 0}`,
        `${result.data['chapterEntriesRemoved'] ?? 0}`,
        `${result.data['queueEntriesRemoved'] ?? 0}`);
      return true;
    } catch (error) {
      const message = errorMessageOf(error);
      hilog.error(DOMAIN, 'Reader', 'Text cache cleanup failed: %{public}s', message);
      return false;
    }
  }

  private getSettingsOrchestrator(): SettingsOrchestrator {
    if (this.settingsOrchestrator === undefined) {
      this.settingsOrchestrator = new SettingsOrchestrator(
        (snapshot: SettingsSnapshot): void => {
          this.settingsSnapshot = snapshot;
        },
        (): SettingsSnapshot => this.settingsSnapshot,
        (): boolean => this.route === 'settings',
        ReaderRuntimeOwner.current().getUIAbilityContext(),
      );
    }
    return this.settingsOrchestrator;
  }

  private onSyncSaveConfig(url: string, user: string, pass: string, backupPass: string, path: string): void {
    this.getSyncOrchestrator().saveConfig(url, user, pass, backupPass, path);
  }

  private onSyncTestConnection(url: string, user: string, pass: string, path: string): void {
    this.getSyncOrchestrator().testConnection(url, user, pass, path);
  }

  private onSyncTriggerBackup(): void {
    this.getSyncOrchestrator().triggerBackup();
  }

  private onSyncRestoreLatest(): void {
    this.getSyncOrchestrator().restoreLatest();
  }

  private onSyncResolveRestore(overwriteLocal: boolean): void {
    this.getSyncOrchestrator().resolveRestore(overwriteLocal);
  }

  private getSyncOrchestrator(): SyncOrchestrator {
    if (this.syncOrchestrator === undefined) {
      this.syncOrchestrator = new SyncOrchestrator(
        (snapshot: SyncSnapshot): void => {
          this.syncSnapshot = snapshot;
          this.syncSnapshotReady = true;
        },
        (): SyncSnapshot => this.syncSnapshot,
      );
    }
    return this.syncOrchestrator;
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
    this.getSourceOrchestrator().open();
  }

  /** Enter Source Management from the Search page's add/manage-source intents. */
  private manageSourcesFromSearch(): void {
    const presentation = this.searchPresentation;
    const keyword = presentation.kind === 'loading' || presentation.kind === 'results' ||
      presentation.kind === 'empty' || presentation.kind === 'error' ? presentation.keyword : '';
    this.openSourceManagement('search', keyword);
  }

  private getSourceOrchestrator(): SourceOrchestrator {
    if (this.sourceOrchestrator === undefined) {
      this.sourceOrchestrator = new SourceOrchestrator(
        (sources: BookSource[]): void => {
          this.sourceSources = sources;
        },
        (): boolean => this.route === 'source',
        (kind: SourceManagementStatusKind, message: string): void => {
          this.sourceStatusKind = kind;
          this.sourceStatusMessage = message;
        },
      );
    }
    return this.sourceOrchestrator;
  }

  private getSourceToolsOrchestrator(): SourceToolsOrchestrator {
    if (this.sourceToolsOrchestrator === undefined) {
      this.sourceToolsOrchestrator = new SourceToolsOrchestrator(
        (snapshot: SourceToolsSnapshot): void => {
          this.sourceToolsSnapshot = snapshot;
        },
        (): boolean => this.route === 'sourceTools',
      );
    }
    return this.sourceToolsOrchestrator;
  }

  private openSourceTools(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.updateSourceToolsSelection([]);
    this.route = 'sourceTools';
    this.getSourceToolsOrchestrator().open(this.sourceSources);
  }

  private updateSourceToolsSelection(sourceIds: string[]): void {
    this.getSourceToolsOrchestrator().setSelection(sourceIds);
  }

  private selectAllSourceTools(): void {
    this.updateSourceToolsSelection(this.sourceToolsSnapshot.sources.map(
      (source: BookSource): string => source.sourceId,
    ));
  }

  private toggleSourceToolsSelection(sourceId: string): void {
    const selection = this.sourceToolsSnapshot.selectedSourceIds;
    if (selection.indexOf(sourceId) >= 0) {
      this.updateSourceToolsSelection(selection.filter(
        (candidate: string): boolean => candidate !== sourceId,
      ));
      return;
    }
    this.updateSourceToolsSelection(selection.concat([sourceId]));
  }

  private consumeSourceToolsSelection(sourceIds: string[]): string[] {
    const available = new Set(this.sourceToolsSnapshot.sources.map(
      (source: BookSource): string => source.sourceId,
    ));
    const selection = sourceIds.filter((sourceId: string): boolean => available.has(sourceId));
    this.updateSourceToolsSelection([]);
    return selection;
  }

  private exportSelectedSources(sourceIds: string[]): void {
    this.getSourceToolsOrchestrator().exportSelected(this.consumeSourceToolsSelection(sourceIds));
  }

  private checkSelectedSources(sourceIds: string[]): void {
    this.getSourceToolsOrchestrator().checkSelected(this.consumeSourceToolsSelection(sourceIds));
  }

  private setSelectedSourcesEnabled(sourceIds: string[], enabled: boolean): void {
    this.getSourceToolsOrchestrator().setSelectedEnabled(this.consumeSourceToolsSelection(sourceIds), enabled);
  }

  private returnToSourceManagement(): void {
    this.nextNavigationGeneration();
    this.route = 'source';
    this.getSourceOrchestrator().open();
  }

  private returnToSettings(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'settings';
  }

  private returnFromRulesManagement(): void {
    if (this.rulesManagementReturnTarget !== 'reader' || this.detailBook === undefined) {
      this.rulesManagementReturnTarget = 'settings';
      this.returnToSettings();
      return;
    }
    this.rulesManagementReturnTarget = 'settings';
    this.route = 'detail';
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
    const orchestrator = this.getSearchOrchestrator();
    if (autoSearch && keyword.length > 0) {
      // A fresh entry reloads sources; the search itself re-checks the enabled
      // set, so a still-disabled configuration lands on sourceRequired instead
      // of firing doomed requests.
      orchestrator.open();
      orchestrator.search(keyword);
      return;
    }
    orchestrator.refreshSources();
    // This restore keeps the pre-leave presentation; a sweep that died while
    // the route was away must not leave its spinner residue behind.
    orchestrator.resumeStaleSweep();
  }

  private onSourceToggled(id: string, enabled: boolean): void {
    // SS-SOURCE-TOGGLE-01 orchestration (serial chain, Core-idle retry, session
    // guards) lives in SourceOrchestrator; Index only forwards the intent.
    this.getSourceOrchestrator().toggleSource(id, enabled);
  }

  private onSourceDetectionRequested(id: string): void {
    this.getSourceOrchestrator().checkSource(id);
  }

  private onSourceLoginRequested(id: string): void {
    this.getSourceOrchestrator().loginSource(id);
  }

  private openJsonImport(context: JsonImportContext): void {
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

  private executeJsonImport(context: JsonImportContext, onlineUrl?: string): void {
    if (context === 'bookSource' && this.route === 'source') {
      this.getSourceOrchestrator().importBookSources(
        onlineUrl,
        (completion: SourceImportCompletion): void => {
          const base = completion.refreshWarning ?? `Core 已导入 ${completion.importedCount} 个书源`;
          const message = completion.failureSummary === undefined ?
            `${base}。` : `${base}，${completion.failureSummary}`;
          if (this.sourceManagementReturnTarget === 'search') {
            this.showSourceImportResultFromSearch('书源导入完成', message);
            return;
          }
          this.showSourceImportResult('书源导入完成', message);
        },
        (error: Error): void => this.showSourceImportResult('书源导入失败', error.message),
      );
      return;
    }
    if (context === 'ruleBundle' && this.route === 'rulesManagement') {
      this.getRulesManagementOrchestrator().importBundle(onlineUrl);
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

  private showSourceImportResult(title: string, message: string): void {
    if (this.route !== 'source') {
      return;
    }
    this.getUIContext().showAlertDialog({
      title,
      message,
      autoCancel: true,
      primaryButton: {
        value: '知道了',
        action: (): void => {},
      },
    });
  }

  /**
   * P0 add-source flow: after an import that started from Search, offer the
   * one-tap re-search with the original keyword. With no keyword recorded
   * (entry from a sourceRequired state) the plain result dialog applies.
   */
  private showSourceImportResultFromSearch(title: string, message: string): void {
    if (this.route !== 'source') {
      return;
    }
    const keyword = this.sourceManagementSearchKeyword;
    if (keyword.length === 0) {
      this.showSourceImportResult(title, message);
      return;
    }
    this.getUIContext().showAlertDialog({
      title,
      message,
      autoCancel: true,
      primaryButton: {
        value: '继续管理',
        action: (): void => {},
      },
      secondaryButton: {
        value: `用新书源搜索「${keyword}」`,
        action: (): void => {
          if (this.route === 'source') {
            this.returnFromSourceManagement(true);
          }
        },
      },
    });
  }

  private requestSourceDelete(sourceIds: string[]): void {
    if (this.route !== 'sourceTools' || sourceIds.length === 0) {
      return;
    }
    const selection = this.consumeSourceToolsSelection(sourceIds);
    if (selection.length === 0) {
      return;
    }
    this.getUIContext().showAlertDialog({
      title: '删除书源',
      message: `确定删除所选 ${selection.length} 个书源吗？相关 Host 登录会话也会清除，删除后无法恢复。`,
      autoCancel: true,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '删除',
        fontColor: '#B42318',
        action: (): void => {
          if (this.route === 'sourceTools') {
            this.getSourceToolsOrchestrator().deleteSelected(selection);
          }
        },
      },
    });
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
    // The registered Figma boundary keeps RSS as a placeholder-only page.
    // Do not start a real rss.subscription.refresh transaction and then label
    // its stale/cache outcome as a user-visible refresh.
    hilog.warn(DOMAIN, 'Reader', 'FIGMA_VISUAL_GAP: RSS refresh is placeholder-only until its admitted flow is supplied');
  }

  private onRssManage(): void {
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

  private getRssOrchestrator(): RssOrchestrator {
    if (this.rssOrchestrator === undefined) {
      this.rssOrchestrator = new RssOrchestrator(
        (subscriptions: RssSubscription[]): void => {
          this.rssPresentation = this.feedPresentation(subscriptions, []);
        },
        (): boolean => this.route === 'rssSubscriptionManagement',
      );
    }
    return this.rssOrchestrator;
  }

  private getRssEditorOrchestrator(): RssSubscriptionEditorOrchestrator {
    if (this.rssEditorOrchestrator === undefined) {
      this.rssEditorOrchestrator = new RssSubscriptionEditorOrchestrator(
        (snapshot: RssSubscriptionEditorSnapshot): void => {
          this.rssEditorSnapshot = snapshot;
        },
        (subscriptionId: string): void => this.finishRssSubscriptionEdit(subscriptionId),
        (): boolean => this.route === 'rssSubscriptionEditor',
      );
    }
    return this.rssEditorOrchestrator;
  }

  private onRssManagementViewArticles(subscriptionId: string): void {
    this.onRssSubscriptionSelected(subscriptionId, 'rssSubscriptionManagement');
  }

  private onRssSubscriptionSelected(
    subscriptionId: string,
    returnTarget: RssSourceFeedReturnTarget = 'rss',
  ): void {
    const subscription = this.rssSubscriptions().find(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    );
    if (subscription === undefined) {
      hilog.warn(DOMAIN, 'Reader',
        'RSS SourceFeed ignored unknown subscriptionId=%{public}s', subscriptionId);
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.selectedRssSubscription = subscription;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssSourceFeedReturnTarget = returnTarget;
    this.route = 'rssSourceFeed';
    this.loadRssSourceItems(generation, subscriptionId);
  }

  private onRssSubscriptionAddRequested(): void {
    this.nextNavigationGeneration();
    this.route = 'rssSubscriptionEditor';
    this.getRssEditorOrchestrator().openCreate();
  }

  private onRssSubscriptionEditRequested(subscriptionId: string): void {
    if (!this.rssSubscriptions().some(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    )) {
      return;
    }
    this.nextNavigationGeneration();
    this.route = 'rssSubscriptionEditor';
    this.getRssEditorOrchestrator().openEdit(subscriptionId);
  }

  private finishRssSubscriptionEdit(subscriptionId: string): void {
    if (this.route !== 'rssSubscriptionEditor') {
      return;
    }
    this.nextNavigationGeneration();
    this.rssManagementFocusSubscriptionId = subscriptionId;
    this.route = 'rssSubscriptionManagement';
    this.getRssOrchestrator().open();
  }

  private returnToRssSubscriptionManagement(): void {
    this.nextNavigationGeneration();
    this.route = 'rssSubscriptionManagement';
    this.getRssOrchestrator().open();
  }

  private requestRssSubscriptionDelete(subscriptionId: string): void {
    const subscription = this.rssSubscriptions().find(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    );
    if (this.route !== 'rssSubscriptionManagement' || subscription === undefined) {
      hilog.warn(DOMAIN, 'Reader',
        'RSS delete confirmation ignored stale subscriptionId=%{public}s', subscriptionId);
      return;
    }
    this.getUIContext().showAlertDialog({
      title: '删除订阅源',
      message: `确定删除“${subscription.title}”吗？删除后无法恢复。`,
      autoCancel: true,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '删除',
        action: (): void => this.confirmRssSubscriptionDelete(subscriptionId),
      },
    });
  }

  private requestRssSourceImport(): void {
    if (this.route !== 'rssSubscriptionManagement') {
      return;
    }
    this.getUIContext().showAlertDialog({
      title: '导入 RSS 源',
      message: '“合并导入”保留现有来源；“覆盖全部”会原子替换当前 RSS 来源与阅读状态。',
      autoCancel: true,
      primaryButton: {
        value: '合并导入',
        action: (): void => this.openJsonImport('rssMerge'),
      },
      secondaryButton: {
        value: '覆盖全部',
        fontColor: '#B42318',
        action: (): void => this.openJsonImport('rssReplace'),
      },
    });
  }

  private importRssSources(replaceExisting: boolean, onlineUrl?: string): void {
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
    if (this.route !== 'rssSubscriptionManagement') {
      return;
    }
    this.getUIContext().showAlertDialog({
      title,
      message,
      autoCancel: true,
      primaryButton: {
        value: '知道了',
        action: (): void => {},
      },
    });
  }

  private confirmRssSubscriptionDelete(subscriptionId: string): void {
    const stillPresent = this.rssSubscriptions().some(
      (candidate: RssSubscription): boolean => candidate.subscriptionId === subscriptionId,
    );
    if (this.route !== 'rssSubscriptionManagement' || !stillPresent) {
      return;
    }
    this.getRssOrchestrator().removeSubscription(subscriptionId);
  }

  private loadRssSourceItems(generation: number, subscriptionId: string): void {
    const isCurrent = (): boolean => this.isCurrentRssSourceFeed(generation, subscriptionId);
    this.getRssOrchestrator().loadSourceFeed(
      subscriptionId,
      (snapshot: RssSourceSnapshot): void => this.applyRssSourceSnapshot(snapshot),
      (error: Error): void => {
        hilog.error(DOMAIN, 'Reader',
          'RSS SourceFeed cached read failed: %{public}s', error.message);
      },
      isCurrent,
    );
  }

  private refreshRssSourceFeed(): void {
    const subscriptionId = this.selectedRssSubscription?.subscriptionId;
    if (subscriptionId === undefined || this.route !== 'rssSourceFeed') {
      return;
    }
    const generation = this.navigationGeneration;
    const isCurrent = (): boolean => this.isCurrentRssSourceFeed(generation, subscriptionId);
    this.getRssOrchestrator().refreshSourceFeed(
      subscriptionId,
      (snapshot: RssSourceSnapshot): void => this.applyRssSourceSnapshot(snapshot),
      (error: Error): void => {
        hilog.error(DOMAIN, 'Reader',
          'RSS SourceFeed refresh failed; cached projection retained: %{public}s', error.message);
      },
      isCurrent,
    );
  }

  private isCurrentRssSourceFeed(generation: number, subscriptionId: string): boolean {
    return this.isCurrentRoute(generation, 'rssSourceFeed') &&
      this.selectedRssSubscription?.subscriptionId === subscriptionId;
  }

  private applyRssSourceSnapshot(snapshot: RssSourceSnapshot): void {
    this.rssPresentation = this.feedPresentation(snapshot.subscriptions, []);
    this.selectedRssSubscription = snapshot.subscription;
    this.selectedRssItems = snapshot.items;
  }

  private onRssItemSelected(subscriptionId: string, guid: string): void {
    const item = this.rssRecentUnread().find(
      (candidate: RssItem): boolean => candidate.subscriptionId === subscriptionId &&
        candidate.guid === guid,
    );
    if (item === undefined) {
      hilog.warn(DOMAIN, 'Reader',
        'RSS EntryDetail ignored unknown identity=%{public}s:%{public}s', subscriptionId, guid);
      return;
    }
    this.openRssEntryDetail(item, 'rss');
  }

  private onRssSourceItemSelected(item: RssItem): void {
    const selected = this.selectedRssItems.find(
      (candidate: RssItem): boolean => candidate.subscriptionId === item.subscriptionId &&
        candidate.guid === item.guid,
    );
    if (selected !== undefined) {
      this.openRssEntryDetail(selected, 'rssSourceFeed');
    }
  }

  private openRssEntryDetail(item: RssItem, returnTarget: RssDetailReturnTarget): void {
    const subscription = this.selectedRssSubscription?.subscriptionId === item.subscriptionId
      ? this.selectedRssSubscription
      : this.rssSubscriptions().find(
        (candidate: RssSubscription): boolean => candidate.subscriptionId === item.subscriptionId,
      );
    if (subscription === undefined) {
      hilog.warn(DOMAIN, 'Reader',
        'RSS EntryDetail has no subscription for guid=%{public}s', item.guid);
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.selectedRssSubscription = subscription;
    this.selectedRssItem = item;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = returnTarget;
    this.route = 'rssEntryDetail';
    const subscriptionId = item.subscriptionId;
    const guid = item.guid;
    const isCurrent = (): boolean => this.isCurrentRssEntryDetail(
      generation, subscriptionId, guid,
    );
    this.getRssOrchestrator().openEntry(
      subscriptionId,
      guid,
      (snapshot: RssEntrySnapshot): void => this.applyRssEntrySnapshot(snapshot),
      (error: Error): void => this.failRssEntryOperation('read', error),
      isCurrent,
    );
  }

  private onRssEntryFavoriteRequested(favorite: boolean): void {
    const item = this.selectedRssItem;
    if (item === undefined || this.route !== 'rssEntryDetail' ||
      (this.selectedRssFavoriteState !== 'favorited' &&
        this.selectedRssFavoriteState !== 'notFavorited')) {
      return;
    }
    const generation = this.navigationGeneration;
    const subscriptionId = item.subscriptionId;
    const guid = item.guid;
    this.selectedRssFavoriteState = 'loading';
    const isCurrent = (): boolean => this.isCurrentRssEntryDetail(
      generation, subscriptionId, guid,
    );
    this.getRssOrchestrator().setEntryFavorite(
      subscriptionId,
      guid,
      favorite,
      (snapshot: RssEntrySnapshot): void => this.applyRssEntrySnapshot(snapshot),
      (error: Error): void => this.failRssEntryOperation('favorite', error),
      isCurrent,
    );
  }

  private isCurrentRssEntryDetail(
    generation: number,
    subscriptionId: string,
    guid: string,
  ): boolean {
    return this.isCurrentRoute(generation, 'rssEntryDetail') &&
      this.selectedRssItem?.subscriptionId === subscriptionId &&
      this.selectedRssItem?.guid === guid;
  }

  private applyRssEntrySnapshot(snapshot: RssEntrySnapshot): void {
    this.rssPresentation = this.feedPresentation(snapshot.subscriptions, []);
    this.selectedRssSubscription = snapshot.subscription;
    this.selectedRssItems = snapshot.items;
    this.selectedRssItem = snapshot.item;
    this.selectedRssFavoriteState = snapshot.favorite ? 'favorited' : 'notFavorited';
  }

  private failRssEntryOperation(action: string, error: Error): void {
    this.selectedRssFavoriteState = 'unavailable';
    hilog.error(DOMAIN, 'Reader',
      'RSS EntryDetail %{public}s failed; no optimistic state applied: %{public}s',
      action, error.message);
  }

  private returnFromRssEntryDetail(): void {
    if (this.rssDetailReturnTarget === 'rssSourceFeed') {
      this.returnToRssSourceFeed();
      return;
    }
    this.returnToRss();
  }

  private returnToRssSourceFeed(): void {
    if (this.selectedRssSubscription === undefined) {
      this.returnToRss();
      return;
    }
    const subscriptionId = this.selectedRssSubscription.subscriptionId;
    const generation = this.nextNavigationGeneration();
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rssSourceFeed';
    this.route = 'rssSourceFeed';
    this.loadRssSourceItems(generation, subscriptionId);
  }

  private returnFromRssSourceFeed(): void {
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
    if (this.selectedRssItem?.link === undefined ||
      this.selectedRssItem.link.trim().length === 0) {
      hilog.warn(DOMAIN, 'Reader', 'RSS original link intent ignored because the entry has no link');
      return;
    }
    hilog.warn(DOMAIN, 'Reader',
      'HOST_CAPABILITY_GAP: RSS original link requires webview.open Host wiring');
  }

  private onRssModeRequested(mode: RssMode): void {
    if (mode === 'sources') {
      return;
    }
    // All/Favorites/Rules are modes of the existing RSS page, not routes.
    // Their data contracts are not admitted yet, so keep Sources selected and
    // surface the missing boundary instead of showing invented local data.
    hilog.warn(DOMAIN, 'Reader',
      'FIGMA_VISUAL_GAP: RSS mode %{public}s has no admitted data contract', mode);
  }

  private feedPresentation(
    subscriptions: RssSubscription[],
    recentUnread: RssItem[],
  ): RssPresentation {
    const presentation: RssPresentation = {
      kind: 'feed', subscriptions: subscriptions, recentUnread: recentUnread,
    };
    return presentation;
  }

  private rssSubscriptions(): RssSubscription[] {
    if (this.rssPresentation.kind === 'fatalError') {
      return [];
    }
    return this.rssPresentation.subscriptions;
  }

  private rssRecentUnread(): RssItem[] {
    if (this.rssPresentation.kind === 'feed' || this.rssPresentation.kind === 'refreshing') {
      return this.rssPresentation.recentUnread;
    }
    return [];
  }

  private rssSubscriptionManagementItems(): RssSubscriptionManagementItem[] {
    return this.rssSubscriptions().map(
      (subscription: RssSubscription): RssSubscriptionManagementItem => ({
        subscriptionId: subscription.subscriptionId,
        title: subscription.title,
        meta: this.rssSubscriptionManagementMeta(subscription),
        enabled: subscription.enabled,
      }),
    );
  }

  /** Management metadata is a projection of Core fields only. */
  private rssSubscriptionManagementMeta(subscription: RssSubscription): string {
    const parts: string[] = [];
    if (subscription.sourceGroup !== undefined && subscription.sourceGroup.trim().length > 0) {
      parts.push(subscription.sourceGroup);
    }
    if (subscription.customOrder !== undefined) {
      parts.push(`排序 ${subscription.customOrder}`);
    }
    if (subscription.ruleArticles !== undefined && subscription.ruleArticles.trim().length > 0) {
      parts.push('规则型');
    }
    const siteUrl = subscription.siteUrl;
    parts.push(siteUrl !== undefined && siteUrl.trim().length > 0 ? siteUrl : subscription.feedUrl);
    if (subscription.lastFetchAt !== undefined && subscription.lastFetchAt > 0) {
      parts.push(`上次刷新 ${this.formatRssManagementTime(subscription.lastFetchAt)}`);
    }
    if (!subscription.enabled) {
      parts.push('已停用');
    }
    return parts.join(' · ');
  }

  private formatRssManagementTime(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${this.twoDigit(date.getMonth() + 1)}-${this.twoDigit(date.getDate())} ` +
      `${this.twoDigit(date.getHours())}:${this.twoDigit(date.getMinutes())}`;
  }

  private twoDigit(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
  }

  private openSearch(): void {
    this.nextNavigationGeneration();
    this.resetSearchDetailWarmups();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.route = 'search';
    this.getSearchOrchestrator().open();
  }

  private performSearch(keyword: string, scopeSourceIds?: string[]): void {
    this.nextNavigationGeneration();
    this.resetSearchDetailWarmups();
    this.getSearchOrchestrator().search(keyword, scopeSourceIds);
  }

  private stopSearch(): void {
    this.getSearchOrchestrator().stop();
  }

  private getSearchOrchestrator(): SearchOrchestrator {
    if (this.searchOrchestrator === undefined) {
      this.searchOrchestrator = new SearchOrchestrator(
        (presentation: SearchPresentation): void => {
          this.searchPresentation = presentation;
          this.scheduleSearchDetailWarmups(presentation);
        },
        (sources: SearchSource[]): void => {
          this.searchSources = sources;
        },
        (): boolean => this.route === 'search',
      );
    }
    return this.searchOrchestrator;
  }

  private retrySearch(): void {
    this.getSearchOrchestrator().retry();
  }

  private clearSearchHistory(): void {
    this.nextNavigationGeneration();
    this.getSearchOrchestrator().clearHistory();
  }

  private resetSearchDetailWarmups(): void {
    this.searchDetailWarmupGeneration += 1;
    this.searchDetailWarmups.clear();
    this.searchDetailWarmSessions.clear();
  }

  private scheduleSearchDetailWarmups(presentation: SearchPresentation): void {
    if (presentation.kind !== 'results' || this.route !== 'search') {
      return;
    }
    const generation = this.searchDetailWarmupGeneration;
    const gateway = new RemoteReadingFlowGateway(ReaderRuntimeOwner.current());
    const admitted = new Set<string>();
    for (const book of presentation.results) {
      if (admitted.size >= SEARCH_DETAIL_WARMUP_LIMIT) {
        break;
      }
      const key = this.searchDetailKey(book.sourceId, book.bookId);
      if (admitted.has(key)) {
        continue;
      }
      admitted.add(key);
      if (this.searchDetailWarmups.has(key) || this.searchDetailWarmSessions.has(key)) {
        continue;
      }
      const seed = this.remoteSeedForSearchBook(book);
      const isCurrent = (): boolean => generation === this.searchDetailWarmupGeneration;
      const warmup = gateway.openSession(seed, { isCurrent })
        .then((session: RemoteReadingSession): RemoteReadingSession => {
          if (isCurrent()) {
            this.searchDetailWarmSessions.set(key, session);
          }
          this.searchDetailWarmups.delete(key);
          return session;
        })
        .catch((error: Error): Promise<RemoteReadingSession> => {
          this.searchDetailWarmups.delete(key);
          return Promise.reject(error);
        });
      this.searchDetailWarmups.set(key, warmup);
      // Warmup is opportunistic. Selection joins the same promise; an idle
      // failure stays silent and the normal cache/online fallback remains.
      void warmup.catch((): void => {});
    }
  }

  private searchWarmupForSeeds(seeds: RemoteReadingBookSeed[]): Promise<RemoteReadingSession> | undefined {
    for (const seed of seeds) {
      const key = this.searchDetailKey(seed.sourceId, seed.bookId);
      const ready = this.searchDetailWarmSessions.get(key);
      if (ready !== undefined) {
        return Promise.resolve(ready);
      }
      const active = this.searchDetailWarmups.get(key);
      if (active !== undefined) {
        return active;
      }
    }
    return undefined;
  }

  private searchDetailKey(sourceId: string, bookId: string): string {
    return `${sourceId}\u0000${bookId}`;
  }

  private remoteSeedForSearchBook(candidate: SearchBook): RemoteReadingBookSeed {
    return {
      sourceId: candidate.sourceId,
      bookId: candidate.bookId,
      detailUrl: candidate.detailUrl,
      title: candidate.title,
      author: candidate.author,
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
    // The clicked source leads; same-book variants follow so one dead source
    // (expired token, dead host) no longer dead-ends the detail journey. The
    // cap bounds the worst case where every candidate source hangs on timeout.
    const ordered: SearchBook[] = [book];
    for (const candidate of variants) {
      if (ordered.length >= 8) {
        break;
      }
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
    this.openRemoteBookDetail(seeds[0], sourceNames[0], undefined, false, seeds.slice(1), sourceNames.slice(1));
  }

  private openShelfBook(selection: ShelfBook): void {
    if (selection.sourceId === LOCAL_SOURCE_ID) {
      this.openLocalBookDetail(selection, true);
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
    }, this.sourceDisplayName(selection.sourceId), selection, true);
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
    }, this.sourceDisplayName(selection.sourceId), selection, false);
  }

  private openLocalBookDetail(selection: ShelfBook, resumeImmediately: boolean = false): void {
    if (selection.sourceId !== LOCAL_SOURCE_ID) {
      hilog.error(DOMAIN, 'Reader',
        'Local detail dispatcher received remote sourceId=%{public}s', selection.sourceId);
      return;
    }
    const originRoute = this.route;
    const generation = this.nextNavigationGeneration();
    this.detailReturnRoute = originRoute === 'search' ? 'search' : 'bookshelf';
    this.readingSessionActive = false;
    this.remoteReadingSession = undefined;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    // The card is already the current Core-derived shelf projection. Mount the
    // detail shell in this frame and load only the TOC; re-reading the same
    // shelf row before changing route was a redundant serialized Core call.
    this.detailBook = this.readingDetailForShelf(selection);
    this.detailToc = [];
    this.detailInBookshelf = true;
    this.detailLoadingMessage = '正在读取本地目录…';
    this.requestedChapterIndex = undefined;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.route = 'detail';
    const owner = ReaderRuntimeOwner.current();
    const reading = new LocalReadingFlowGateway(owner);
    reading.loadToc(selection.bookId)
      .then((toc): void => {
        if (generation !== this.navigationGeneration) {
          return;
        }
        if (!this.hasDeclaredCoverUrl(selection)) {
          // N-COVER-REMAP-01: Figma NoCover variant `3612:1796` exists.
          // Admit the route and let the detail/result pages use the shared
          // NoCover gradient placeholder. We only log a soft notice.
          hilog.info(DOMAIN, 'Reader',
            'No declared coverUrl for bookId=%{public}s; using NoCover placeholder',
            selection.bookId);
        }
        this.detailToc = toc.entries;
        this.detailLoadingMessage = '';
        void reading.loadDirectoryProjection(
          selection.bookId,
          selection.title,
          selection.author,
          toc.entries,
          (): boolean => this.detailBook?.sourceId === selection.sourceId &&
            this.detailBook?.bookId === selection.bookId,
        )
          .then((entries: LocalReadingTocEntry[]): void => {
            if (this.detailBook?.sourceId === selection.sourceId &&
              this.detailBook?.bookId === selection.bookId) {
              this.detailToc = entries;
            }
          })
          .catch((error: Error): void => {
            if (this.detailBook?.sourceId === selection.sourceId &&
              this.detailBook?.bookId === selection.bookId) {
              hilog.error(DOMAIN, 'Reader',
                'Directory bookmark/cache projection failed: %{public}s', error.message);
            }
          });
        if (resumeImmediately) {
          this.openReading(undefined);
        }
      })
      .catch((error: Error): void => {
        if (generation !== this.navigationGeneration) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Local Book Detail state failed to load: %{public}s', error.message);
        this.detailBook = undefined;
        this.detailToc = [];
        this.detailLoadingMessage = '';
        this.route = originRoute;
        this.showReadingFailure('详情加载失败', error.message);
      });
  }

  private openRemoteBookDetail(
    seed: RemoteReadingBookSeed,
    sourceName: string,
    shelfSnapshot: ShelfBook | undefined = undefined,
    resumeImmediately: boolean = false,
    fallbackSeeds: RemoteReadingBookSeed[] = [],
    fallbackSourceNames: string[] = [],
  ): void {
    const reusableRemoteSession = shelfSnapshot !== undefined &&
      this.remoteReadingSession?.identity.sourceId === seed.sourceId &&
      this.remoteReadingSession?.identity.bookId === seed.bookId ? this.remoteReadingSession : undefined;
    const originRoute = this.route;
    const generation = this.nextNavigationGeneration();
    this.detailReturnRoute = originRoute === 'search' ? 'search' : 'bookshelf';
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.remoteReadingSession = reusableRemoteSession;
    // The selected search/shelf item is already a validated Core projection.
    // Show its detail shell immediately; an empty TOC keeps reading actions
    // inert until the remote session and required shelf persistence settle.
    this.detailBook = this.readingDetailForRemoteSeed(seed, sourceName);
    this.detailToc = [];
    this.detailInBookshelf = shelfSnapshot !== undefined;
    this.detailLoadingMessage = shelfSnapshot === undefined ? '正在获取在线目录…' : '正在读取本地目录…';
    this.requestedChapterIndex = undefined;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.route = 'detail';
    if (shelfSnapshot?.lastCheckAt !== undefined) {
      const catalogKey = `${seed.sourceId}\u0000${seed.bookId}`;
      const persistedRefreshAt = shelfSnapshot.lastCheckAt * 1000;
      const processRefreshAt = this.remoteCatalogRefreshAt.get(catalogKey) ?? 0;
      this.remoteCatalogRefreshAt.set(catalogKey, Math.max(processRefreshAt, persistedRefreshAt));
    }
    const owner = ReaderRuntimeOwner.current();
    const gateway = new RemoteReadingFlowGateway(owner);
    const offline = new ReadingOfflineGateway(owner);
    const bookshelf = new ReaderCoreGateway(owner);
    const isCurrent = (): boolean => generation === this.navigationGeneration;
    this.offlineMutationGeneration += 1;
    this.offlineMutationActiveKey = '';
    // A session that just drove this exact shelf book already carries the
    // parsed detail, full TOC, continuation variables, and per-chapter
    // variables. Reusing it avoids throwing that proven work away on an
    // immediate shelf round-trip. Search results probe Core's exact durable
    // catalog first; no second cache or persisted UI session is introduced.
    const candidateSeeds: RemoteReadingBookSeed[] = [seed, ...fallbackSeeds];
    const candidateNames: string[] = [sourceName, ...fallbackSourceNames];
    const detailAdmissionStartedAt = Date.now();
    const sessionAdmission: Promise<RemoteDetailAdmission> = reusableRemoteSession !== undefined ?
      Promise.resolve(new RemoteDetailAdmission(reusableRemoteSession)) : shelfSnapshot !== undefined ?
        gateway.openCachedCatalogSession(seed, isCurrent)
          .catch((): Promise<RemoteReadingSession> => gateway.openSession(seed, { isCurrent }))
          .then((session: RemoteReadingSession): RemoteDetailAdmission => new RemoteDetailAdmission(session)) :
        this.openSearchSessionCacheFirst(gateway, candidateSeeds, isCurrent);
    void sessionAdmission
      .then((admission: RemoteDetailAdmission): void => {
        if (!isCurrent()) {
          return;
        }
        const session = admission.session;
        hilog.info(DOMAIN, 'Reader',
          'PERF search-detail-admission source=%{public}s book=%{public}s mode=%{public}s durationMs=%{public}d',
          session.identity.sourceId, session.identity.bookId, session.acquisitionMode,
          Date.now() - detailAdmissionStartedAt);
        // Search opens a preview. Joining the shelf is an explicit user
        // mutation and must not be coupled to reading-session acquisition.
        let suppliedShelfBook = shelfSnapshot?.sourceId === session.identity.sourceId &&
          shelfSnapshot?.bookId === session.identity.bookId ? shelfSnapshot : undefined;
        if (suppliedShelfBook === undefined) {
          for (const shelfBook of this.shelfBooks) {
            if (shelfBook.sourceId === session.identity.sourceId &&
              shelfBook.bookId === session.identity.bookId) {
              suppliedShelfBook = shelfBook;
              break;
            }
          }
        }
        const projectedInBookshelf = suppliedShelfBook !== undefined;
        this.detailInBookshelf = projectedInBookshelf;
        const admittedIndex = Math.max(0, candidateSeeds.findIndex((candidate: RemoteReadingBookSeed): boolean =>
          candidate.sourceId === session.identity.sourceId &&
          candidate.bookId === session.identity.bookId));
        const admittedSeedName = candidateNames.length > admittedIndex ? candidateNames[admittedIndex] : '';
        const admittedSourceName = admittedSeedName.trim().length > 0 ?
          admittedSeedName.trim() : session.identity.sourceId;
        this.remoteReadingSession = session;
        this.detailBook = {
          sourceId: session.identity.sourceId,
          sourceName: admittedSourceName.length > 0 ? admittedSourceName : session.identity.sourceId,
          bookId: session.identity.bookId,
          title: session.book.title,
          author: session.book.author,
          kind: session.book.kind,
          coverUrl: session.book.coverUrl,
          intro: session.book.intro,
          lastChapter: session.book.lastChapter,
        };
        this.detailToc = session.entries.map((entry): LocalReadingTocEntry => ({
          index: entry.index,
          title: entry.title,
          downloadState: 'unknown',
        }));
        this.detailLoadingMessage = '';
        this.requestedChapterIndex = undefined;
        this.preparedReaderRoute = 'reading';
        this.directoryCurrentChapterIndex = -1;
        this.directoryChapterTitle = '';
        if (suppliedShelfBook === undefined) {
          // Shelf membership does not gate the visible detail/TOC. Reconcile
          // the durable row afterwards, and never overwrite a newer explicit
          // add/remove mutation or a different admitted session.
          void bookshelf.loadShelfBook(session.identity.sourceId, session.identity.bookId)
            .then((storedBook: ShelfBook | undefined): void => {
              const stillSame = isCurrent() && this.bookshelfRemovalActiveKey.length === 0 &&
                this.detailInBookshelf === projectedInBookshelf &&
                this.remoteReadingSession?.identity.sourceId === session.identity.sourceId &&
                this.remoteReadingSession?.identity.bookId === session.identity.bookId;
              if (stillSame) {
                this.detailInBookshelf = storedBook !== undefined;
              }
            })
            .catch((error: Error): void => {
              if (isCurrent()) {
                hilog.warn(DOMAIN, 'Reader',
                  'Remote detail shelf reconciliation failed: %{public}s', error.message);
              }
            });
        }
        if (admittedSourceName === session.identity.sourceId) {
          void this.resolveRemoteDetailSourceName(owner, session, isCurrent);
        }
        void this.loadRemoteDirectoryProjection(offline, owner, session, isCurrent)
          .then((entries: LocalReadingTocEntry[]): void => {
            const stillSame = this.remoteReadingSession?.identity.sourceId === session.identity.sourceId &&
              this.remoteReadingSession?.identity.bookId === session.identity.bookId;
            if (isCurrent() && stillSame) {
              this.detailToc = entries;
            }
          })
          .catch((error: Error): void => {
            if (isCurrent()) {
              hilog.error(DOMAIN, 'Reader',
                'Remote download projection failed: %{public}s', error.message);
            }
          });
        if (admission.refreshInBackground) {
          const admittedSeed = candidateSeeds[admittedIndex];
          if (admittedSeed !== undefined) {
            this.refreshCachedSearchDetailInBackground(
              admittedSeed,
              admittedSourceName,
              session,
              generation,
            );
          }
        }
        const pending = this.pendingSourceSwitch;
        if (pending !== undefined && pending.targetSourceId === session.identity.sourceId &&
          pending.targetBookId === session.identity.bookId) {
          if (!this.isKnownDetailChapter(pending.targetChapterIndex)) {
            this.rollbackPendingSourceSwitch('TARGET_MATCHED_CHAPTER_MISSING');
            return;
          }
          // Reuse the normal reader. Its first-page callback is the commit
          // barrier that finalizes this switch transaction below.
          this.openReading(pending.targetChapterIndex);
          return;
        }
        if (resumeImmediately) {
          this.openReading(undefined);
        }
      })
      .catch((error: Error): void => {
        if (isCurrent()) {
          hilog.error(DOMAIN, 'Reader',
            'Remote Book Detail state failed to load: %{public}s', error.message);
          hilog.warn(DOMAIN, 'Reader',
            'PERF search-detail-admission-failed source=%{public}s book=%{public}s durationMs=%{public}d',
            seed.sourceId, seed.bookId, Date.now() - detailAdmissionStartedAt);
          const pending = this.pendingSourceSwitch;
          if (pending !== undefined && pending.targetSourceId === seed.sourceId &&
            pending.targetBookId === seed.bookId) {
            this.rollbackPendingSourceSwitch(error.message);
            return;
          }
          this.detailBook = undefined;
          this.detailToc = [];
          this.detailLoadingMessage = '';
          this.remoteReadingSession = undefined;
          this.route = originRoute;
          this.showReadingFailure('详情加载失败', error.message);
        }
      });
  }

  private async openSearchSessionCacheFirst(
    gateway: RemoteReadingFlowGateway,
    seeds: RemoteReadingBookSeed[],
    isCurrent: () => boolean,
  ): Promise<RemoteDetailAdmission> {
    if (seeds.length === 0) {
      throw new Error('no candidate source available');
    }
    // Local admission and online detail/TOC start together. A cache miss can
    // no longer serialize the network path, while a warm top result joins the
    // exact single-flight already running from the search list.
    const cacheAttempt = this.openCachedSearchCandidate(gateway, seeds, isCurrent)
      .then((session: RemoteReadingSession): RemoteDetailAdmission => new RemoteDetailAdmission(session));
    const warmup = this.searchWarmupForSeeds(seeds);
    const onlineAttempt = (warmup ?? this.openSearchSessionWithFallback(gateway, seeds, isCurrent))
      .then((session: RemoteReadingSession): RemoteDetailAdmission => new RemoteDetailAdmission(session));
    return this.firstSuccessfulDetailAdmission([cacheAttempt, onlineAttempt]);
  }

  private async openCachedSearchCandidate(
    gateway: RemoteReadingFlowGateway,
    seeds: RemoteReadingBookSeed[],
    isCurrent: () => boolean,
  ): Promise<RemoteReadingSession> {
    try {
      return await gateway.openCachedCatalogSession(seeds[0], isCurrent);
    } catch (error) {
      if (!isCurrent()) {
        throw error instanceof Error ? error : new Error(errorMessageOf(error));
      }
    }
    const cancelled = new Set<number>();
    const active = new Map<number, Promise<RemoteSessionAttemptOutcome>>();
    let nextIndex = 1;
    const launch = (index: number): void => {
      const attemptCurrent = (): boolean => isCurrent() && !cancelled.has(index);
      active.set(index, gateway.openCachedCatalogSession(seeds[index], attemptCurrent)
        .then((session: RemoteReadingSession): RemoteSessionAttemptOutcome =>
          new RemoteSessionAttemptOutcome(index, session))
        .catch((error: Error): RemoteSessionAttemptOutcome =>
          new RemoteSessionAttemptOutcome(index, undefined, error)));
    };
    while (active.size > 0 || nextIndex < seeds.length) {
      while (active.size < SEARCH_DETAIL_CACHE_PROBE_CONCURRENCY && nextIndex < seeds.length) {
        launch(nextIndex);
        nextIndex += 1;
      }
      const outcome = await Promise.race(Array.from(active.values()));
      active.delete(outcome.index);
      if (outcome.session !== undefined) {
        for (const activeIndex of active.keys()) {
          cancelled.add(activeIndex);
        }
        return outcome.session;
      }
      if (!isCurrent()) {
        throw outcome.error ?? new Error('cached detail probe cancelled');
      }
    }
    throw new Error('cached detail unavailable');
  }

  private firstSuccessfulDetailAdmission(
    attempts: Array<Promise<RemoteDetailAdmission>>,
  ): Promise<RemoteDetailAdmission> {
    return new Promise<RemoteDetailAdmission>((resolve, reject): void => {
      let remaining = attempts.length;
      let lastError: Error = new Error('detail admission unavailable');
      for (const attempt of attempts) {
        void attempt.then(resolve).catch((error: Error): void => {
          lastError = error instanceof Error ? error : new Error(errorMessageOf(error));
          remaining -= 1;
          if (remaining === 0) {
            reject(lastError);
          }
        });
      }
    });
  }

  private openSearchSessionWithFallback(
    gateway: RemoteReadingFlowGateway,
    seeds: RemoteReadingBookSeed[],
    isCurrent: () => boolean,
  ): Promise<RemoteReadingSession> {
    return (async (): Promise<RemoteReadingSession> => {
      let lastError: Error = new Error('no candidate source available');
      const cancelled = new Set<number>();
      const active = new Map<number, Promise<RemoteSessionAttemptOutcome>>();
      let nextIndex = 0;
      let hedgeUnlocked = false;
      const launch = (index: number): void => {
        const seed = seeds[index];
        const attemptCurrent = (): boolean => isCurrent() && !cancelled.has(index);
        const attempt = gateway.openSession(seed, { isCurrent: attemptCurrent })
          .then((session: RemoteReadingSession): RemoteSessionAttemptOutcome =>
            new RemoteSessionAttemptOutcome(index, session))
          .catch((error: Error): RemoteSessionAttemptOutcome => new RemoteSessionAttemptOutcome(
            index,
            undefined,
            error,
          ));
        active.set(index, attempt);
      };
      if (nextIndex < seeds.length) {
        launch(nextIndex);
        nextIndex += 1;
      }
      while (active.size > 0 || nextIndex < seeds.length) {
        if (!isCurrent()) {
          for (const activeIndex of active.keys()) {
            cancelled.add(activeIndex);
          }
          throw lastError;
        }
        if (active.size === 0 && nextIndex < seeds.length) {
          launch(nextIndex);
          nextIndex += 1;
        }
        // Keep the clicked source's head start, then hedge at most one
        // alternate. A failed slot is refilled immediately, so one hanging
        // source never serializes the entire same-book candidate list.
        while (hedgeUnlocked && active.size < 2 && nextIndex < seeds.length) {
          launch(nextIndex);
          nextIndex += 1;
        }
        const racers: Array<Promise<RemoteSessionAttemptOutcome>> = Array.from(active.values());
        if (!hedgeUnlocked && nextIndex < seeds.length) {
          racers.push(new Promise<RemoteSessionAttemptOutcome>((resolve): void => {
            setTimeout((): void => resolve(new RemoteSessionAttemptOutcome(-1)), SEARCH_DETAIL_HEDGE_DELAY_MS);
          }));
        }
        const outcome = await Promise.race(racers);
        if (outcome.index < 0) {
          hedgeUnlocked = true;
          continue;
        }
        active.delete(outcome.index);
        if (outcome.session !== undefined) {
          for (const activeIndex of active.keys()) {
            cancelled.add(activeIndex);
          }
          return outcome.session;
        }
        lastError = outcome.error ?? lastError;
        hedgeUnlocked = true;
        if (isCurrent()) {
          const failedSeed = seeds[outcome.index];
          hilog.warn(DOMAIN, 'Reader',
            'Remote detail failed on %{public}s/%{public}s: %{public}s; hedging alternate sources',
            failedSeed.sourceId, failedSeed.bookId, lastError.message);
        }
      }
      if (!isCurrent() || !isRemoteReadingCacheFallbackEligible(lastError)) {
        throw lastError;
      }
      hilog.warn(DOMAIN, 'Reader',
        'Online detail unavailable on every candidate source; attempting exact cached session: %{public}s',
        lastError.message);
      return gateway.openCachedSession(seeds[0], isCurrent);
    })();
  }

  private refreshCachedSearchDetailInBackground(
    seed: RemoteReadingBookSeed,
    sourceName: string,
    cachedSession: RemoteReadingSession,
    generation: number,
  ): void {
    const owner = ReaderRuntimeOwner.current();
    const isCurrent = (): boolean => generation === this.navigationGeneration &&
      this.route === 'detail' && !this.readingSessionActive &&
      this.bookshelfRemovalActiveKey.length === 0 &&
      this.remoteReadingSession?.identity.sourceId === cachedSession.identity.sourceId &&
      this.remoteReadingSession?.identity.bookId === cachedSession.identity.bookId;
    void new RemoteReadingFlowGateway(owner).openSession(seed, { isCurrent })
      .then((refreshed: RemoteReadingSession): void => {
        if (!isCurrent()) {
          return;
        }
        this.remoteReadingSession = refreshed;
        this.detailBook = {
          sourceId: refreshed.identity.sourceId,
          sourceName: sourceName.trim().length > 0 ? sourceName.trim() : refreshed.identity.sourceId,
          bookId: refreshed.identity.bookId,
          title: refreshed.book.title,
          author: refreshed.book.author,
          kind: refreshed.book.kind,
          coverUrl: refreshed.book.coverUrl,
          intro: refreshed.book.intro,
          lastChapter: refreshed.book.lastChapter,
        };
        this.detailToc = refreshed.entries.map((entry): LocalReadingTocEntry => ({
          index: entry.index,
          title: entry.title,
          downloadState: 'unknown',
        }));
        void this.loadRemoteDirectoryProjection(
          new ReadingOfflineGateway(owner),
          owner,
          refreshed,
          isCurrent,
        )
          .then((entries: LocalReadingTocEntry[]): void => {
            if (isCurrent()) {
              this.detailToc = entries;
            }
          })
          .catch((error: Error): void => {
            if (isCurrent()) {
              hilog.warn(DOMAIN, 'Reader',
                'Background search detail projection failed: %{public}s', error.message);
            }
          });
        if (sourceName.trim().length === 0 || sourceName === refreshed.identity.sourceId) {
          void this.resolveRemoteDetailSourceName(owner, refreshed, isCurrent);
        }
        if (this.detailInBookshelf) {
          this.refreshBookshelf();
        }
      })
      .catch((error: Error): void => {
        if (isCurrent()) {
          // Cached detail and TOC stay actionable. An unavailable refresh is a
          // background freshness failure, not a detail-navigation failure.
          hilog.warn(DOMAIN, 'Reader',
            'Background search detail refresh failed: %{public}s', error.message);
        }
      });
  }

  private resolveRemoteDetailSourceName(
    owner: ReaderRuntimeOwner,
    session: RemoteReadingSession,
    isCurrent: () => boolean,
  ): Promise<void> {
    return new SourceGateway(owner).loadSources()
      .then((sources: BookSource[]): void => {
        if (!isCurrent()) {
          return;
        }
        for (const source of sources) {
          if (source.sourceId !== session.identity.sourceId) {
            continue;
          }
          const current = this.detailBook;
          if (current !== undefined && current.sourceId === session.identity.sourceId &&
            current.bookId === session.identity.bookId) {
            this.detailBook = {
              sourceId: current.sourceId,
              sourceName: source.name,
              bookId: current.bookId,
              title: current.title,
              author: current.author,
              kind: current.kind,
              coverUrl: current.coverUrl,
              intro: current.intro,
              lastChapter: current.lastChapter,
            };
          }
          return;
        }
      })
      .catch((): void => {
        // The stable source id remains a valid display fallback. Optional name
        // projection must never delay or fail detail/reader readiness.
      });
  }

  private downloadDirectoryChapter(chapterIndex: number): void {
    const session = this.remoteReadingSession;
    if (session === undefined || !this.isKnownDetailChapter(chapterIndex) ||
      this.offlineMutationActiveKey.length > 0) {
      return;
    }
    const generation = ++this.offlineMutationGeneration;
    const key = `${session.identity.sourceId}\u0000${session.identity.bookId}\u0000${chapterIndex}`;
    this.offlineMutationActiveKey = key;
    this.updateDirectoryChapterDownloadState(chapterIndex, 'queued');
    const isCurrent = (): boolean => generation === this.offlineMutationGeneration &&
      this.remoteReadingSession?.identity.sourceId === session.identity.sourceId &&
      this.remoteReadingSession?.identity.bookId === session.identity.bookId;
    void new ReadingOfflineGateway(ReaderRuntimeOwner.current())
      .prefetchChapter(session, chapterIndex, isCurrent)
      .then(async (entries: LocalReadingTocEntry[]): Promise<void> => {
        let projected = this.mergeDirectoryBookmarks(entries, this.detailToc);
        try {
          projected = await new LocalReadingFlowGateway(ReaderRuntimeOwner.current()).loadBookmarkProjection(
            session.book.title,
            session.book.author,
            projected,
            isCurrent,
          );
        } catch (error) {
          hilog.error(DOMAIN, 'Reader', 'Remote bookmark projection refresh failed: %{public}s',
            (error as Error).message);
        }
        if (isCurrent()) {
          this.detailToc = projected;
        }
      })
      .catch((error: Error): void => {
        if (isCurrent()) {
          this.updateDirectoryChapterDownloadState(chapterIndex, 'failed');
          hilog.error(DOMAIN, 'Reader', 'Chapter offline download failed: %{public}s', error.message);
        }
      })
      .finally((): void => {
        if (generation === this.offlineMutationGeneration && this.offlineMutationActiveKey === key) {
          this.offlineMutationActiveKey = '';
        }
      });
  }

  private downloadDirectoryBook(): void {
    const session = this.remoteReadingSession;
    if (session === undefined || session.entries.length === 0 || this.offlineMutationActiveKey.length > 0) {
      return;
    }
    const generation = ++this.offlineMutationGeneration;
    const key = `${session.identity.sourceId}\u0000${session.identity.bookId}\u0000all`;
    this.offlineMutationActiveKey = key;
    this.detailToc = this.detailToc.map((entry: LocalReadingTocEntry): LocalReadingTocEntry =>
      entry.downloadState === 'completed' ? entry : {
        index: entry.index,
        title: entry.title,
        downloadState: 'queued',
        bookmarks: entry.bookmarks,
      });
    const isCurrent = (): boolean => generation === this.offlineMutationGeneration &&
      this.remoteReadingSession?.identity.sourceId === session.identity.sourceId &&
      this.remoteReadingSession?.identity.bookId === session.identity.bookId;
    const gateway = new ReadingOfflineGateway(ReaderRuntimeOwner.current());
    void gateway.prefetchBook(session, isCurrent, (progress): void => {
      if (isCurrent()) {
        this.detailToc = this.mergeDirectoryBookmarks(progress.entries, this.detailToc);
      }
    })
      .then(async (entries: LocalReadingTocEntry[]): Promise<void> => {
        let projected = this.mergeDirectoryBookmarks(entries, this.detailToc);
        try {
          projected = await new LocalReadingFlowGateway(ReaderRuntimeOwner.current()).loadBookmarkProjection(
            session.book.title,
            session.book.author,
            projected,
            isCurrent,
          );
        } catch (error) {
          hilog.error(DOMAIN, 'Reader', 'Whole-book bookmark projection refresh failed: %{public}s',
            (error as Error).message);
        }
        if (isCurrent()) {
          this.detailToc = projected;
        }
      })
      .catch((error: Error): void => {
        if (!isCurrent()) {
          return;
        }
        this.showReadingFailure('整书离线失败', error.message);
        void gateway.loadProjection(session, isCurrent)
          .then((entries: LocalReadingTocEntry[]): void => {
            if (isCurrent()) {
              this.detailToc = this.mergeDirectoryBookmarks(entries, this.detailToc);
            }
          })
          .catch((projectionError: Error): void => {
            hilog.error(DOMAIN, 'Reader', 'Whole-book offline projection refresh failed: %{public}s',
              projectionError.message);
          });
      })
      .finally((): void => {
        if (generation === this.offlineMutationGeneration && this.offlineMutationActiveKey === key) {
          this.offlineMutationActiveKey = '';
        }
      });
  }

  private requestClearDirectoryBookOffline(): void {
    if (this.remoteReadingSession === undefined || this.offlineMutationActiveKey.length > 0) {
      return;
    }
    this.getUIContext().showAlertDialog({
      title: '清除本书离线内容',
      message: '将删除本书已下载的正文和图片，书架、阅读进度与书签不会受影响。',
      autoCancel: true,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '清除',
        fontColor: '#B42318',
        action: (): void => this.clearDirectoryBookOffline(),
      },
    });
  }

  private clearDirectoryBookOffline(): void {
    const session = this.remoteReadingSession;
    if (session === undefined || this.offlineMutationActiveKey.length > 0) {
      return;
    }
    const generation = ++this.offlineMutationGeneration;
    const key = `${session.identity.sourceId}\u0000${session.identity.bookId}\u0000clear`;
    this.offlineMutationActiveKey = key;
    const isCurrent = (): boolean => generation === this.offlineMutationGeneration &&
      this.remoteReadingSession?.identity.sourceId === session.identity.sourceId &&
      this.remoteReadingSession?.identity.bookId === session.identity.bookId;
    void new ReadingOfflineGateway(ReaderRuntimeOwner.current()).clearBook(session, isCurrent)
      .then((): void => {
        if (isCurrent()) {
          this.detailToc = this.detailToc.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
            index: entry.index,
            title: entry.title,
            downloadState: 'missing',
            bookmarks: entry.bookmarks,
          }));
        }
      })
      .catch((error: Error): void => {
        if (isCurrent()) {
          this.showReadingFailure('清除离线失败', error.message);
        }
      })
      .finally((): void => {
        if (generation === this.offlineMutationGeneration && this.offlineMutationActiveKey === key) {
          this.offlineMutationActiveKey = '';
        }
      });
  }

  private detailBookKey(book: ReadingBookDetail): string {
    return `${book.sourceId}\u0000${book.bookId}`;
  }

  private shelfBookKey(book: ShelfBook): string {
    return `${book.sourceId}\u0000${book.bookId}`;
  }

  private isSameDetailBook(book: ReadingBookDetail): boolean {
    return this.detailBook?.sourceId === book.sourceId && this.detailBook?.bookId === book.bookId;
  }

  private canRemoveDetailBook(book: ReadingBookDetail): boolean {
    return this.route === 'detail' && this.isSameDetailBook(book) && !this.readingSessionActive &&
      !this.sourceSwitchVisible && this.pendingSourceSwitch === undefined &&
      this.offlineMutationActiveKey.length === 0 &&
      this.bookshelfRemovalActiveKey.length === 0;
  }

  private requestDetailShelfMutation(): void {
    if (this.detailInBookshelf) {
      this.requestRemoveDetailBook();
      return;
    }
    this.addDetailBook();
  }

  private addDetailBook(): void {
    const book = this.detailBook;
    const session = this.remoteReadingSession;
    if (book === undefined || session === undefined || book.sourceId === LOCAL_SOURCE_ID ||
      !this.canRemoveDetailBook(book)) {
      return;
    }
    const generation = ++this.bookshelfRemovalGeneration;
    const key = this.detailBookKey(book);
    this.bookshelfRemovalActiveKey = key;
    const owner = ReaderRuntimeOwner.current();
    const isCurrent = (): boolean => generation === this.bookshelfRemovalGeneration &&
      this.bookshelfRemovalActiveKey === key && this.isSameDetailBook(book);
    void new ReaderCoreGateway(owner).upsertBook({
      sourceId: session.identity.sourceId,
      bookId: session.identity.bookId,
      title: session.book.title,
      author: session.book.author,
      coverUrl: session.book.coverUrl,
      intro: session.book.intro,
      kind: session.book.kind,
      lastChapter: session.book.lastChapter,
    })
      .then((): void => {
        if (!isCurrent()) {
          return;
        }
        this.detailInBookshelf = true;
        this.refreshBookshelf();
        // Joining the shelf admits a durable rolling window immediately.
        // The mutation itself is complete and the UI must not wait for I/O.
        void this.prefetchReadingWindow(session)
          .catch((error: Error): void => {
            hilog.warn(DOMAIN, 'Reader',
              'Initial shelf cache window incomplete: %{public}s', error.message);
          });
      })
      .catch((error: Error): void => {
        if (isCurrent()) {
          this.showReadingFailure('加入书架失败', error.message);
        }
      })
      .finally((): void => {
        if (isCurrent()) {
          this.bookshelfRemovalActiveKey = '';
        }
      });
  }

  private requestRemoveDetailBook(): void {
    const book = this.detailBook;
    if (book === undefined || !this.canRemoveDetailBook(book)) {
      return;
    }
    const message = book.sourceId === LOCAL_SOURCE_ID ?
      `确定将“${book.title}”从书架移除吗？应用内解析内容、阅读进度和离线任务将一并删除；系统中的原始文件不受影响。` :
      `确定将“${book.title}”从书架移除吗？书源、阅读进度和已缓存正文不会删除，可再次通过搜索加入书架。`;
    this.getUIContext().showAlertDialog({
      title: '移除书架',
      message,
      autoCancel: true,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '移除',
        fontColor: '#B42318',
        action: (): void => {
          if (this.canRemoveDetailBook(book)) {
            this.removeDetailBook(book);
          }
        },
      },
    });
  }

  private requestRemoveShelfBook(book: ShelfBook): void {
    if (!this.canRemoveShelfBook(book)) {
      return;
    }
    const message = book.sourceId === LOCAL_SOURCE_ID ?
      `确定将“${book.title}”从书架移除吗？应用内解析内容、阅读进度和离线任务将一并删除；系统中的原始文件不受影响。` :
      `确定将“${book.title}”从书架移除吗？书源、阅读进度和已缓存正文不会删除，可再次通过搜索加入书架。`;
    this.getUIContext().showAlertDialog({
      title: '移除书架',
      message,
      autoCancel: true,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '移除',
        fontColor: '#B42318',
        action: (): void => {
          if (this.canRemoveShelfBook(book)) {
            this.removeShelfBook(book);
          }
        },
      },
    });
  }

  private requestRemoveShelfBooks(keys: string[]): void {
    if (this.route !== 'bookshelfMultiSelect' || this.bookshelfBatchRemovalBusy) {
      return;
    }
    const selected = this.shelfBooks.filter((book: ShelfBook): boolean => keys.includes(this.shelfBookKey(book)));
    if (selected.length === 0) {
      return;
    }
    this.getUIContext().showAlertDialog({
      title: '移除书架',
      message: `确定将已选择的 ${selected.length} 本书移出书架吗？本地原始文件不受影响。`,
      autoCancel: true,
      primaryButton: {
        value: '取消',
        action: (): void => {},
      },
      secondaryButton: {
        value: '移除',
        fontColor: '#B42318',
        action: (): void => {
          if (this.route === 'bookshelfMultiSelect' && !this.bookshelfBatchRemovalBusy) {
            this.removeShelfBooks(selected);
          }
        },
      },
    });
  }

  private removeShelfBooks(books: ShelfBook[]): void {
    if (this.route !== 'bookshelfMultiSelect' || this.bookshelfBatchRemovalBusy || books.length === 0) {
      return;
    }
    const generation = ++this.bookshelfBatchRemovalGeneration;
    const gateway = new BookshelfFlowGateway(ReaderRuntimeOwner.current());
    const targets: BookshelfRemovalTarget[] = books.map((book: ShelfBook): BookshelfRemovalTarget => ({
      sourceId: book.sourceId,
      bookId: book.bookId,
    }));
    this.bookshelfBatchRemovalBusy = true;
    const isCurrent = (): boolean => generation === this.bookshelfBatchRemovalGeneration &&
      this.route === 'bookshelfMultiSelect';
    void gateway.removeMany(targets)
      .then((outcome: BookshelfRemoveBatchOutcome): void => {
        if (!isCurrent()) {
          return;
        }
        this.applyBookshelfState(outcome.shelf);
        this.bookshelfMultiSelectInitialKey = '';
        this.nextNavigationGeneration();
        this.route = 'bookshelf';
      })
      .catch((error: Error): Promise<void> =>
        this.reconcileShelfBookBatchRemovalFailure(error, gateway, isCurrent))
      .finally((): void => {
        if (generation === this.bookshelfBatchRemovalGeneration) {
          this.bookshelfBatchRemovalBusy = false;
        }
      });
  }

  private async reconcileShelfBookBatchRemovalFailure(
    error: Error,
    gateway: BookshelfFlowGateway,
    isCurrent: () => boolean,
  ): Promise<void> {
    try {
      const shelf = await gateway.load();
      if (!isCurrent()) {
        return;
      }
      this.applyBookshelfState(shelf);
      this.bookshelfMultiSelectInitialKey = '';
      this.nextNavigationGeneration();
      this.route = 'bookshelf';
      this.showReadingFailure('批量移除未完全完成', error.message);
    } catch (reloadError) {
      if (!isCurrent()) {
        return;
      }
      const message = reloadError instanceof Error ? reloadError.message : `${reloadError}`;
      this.showReadingFailure('批量移除失败', `${error.message}；书架刷新失败：${message}`);
    }
  }

  private canRemoveShelfBook(book: ShelfBook): boolean {
    return this.route === 'bookshelf' && !this.readingSessionActive &&
      this.bookshelfRemovalActiveKey.length === 0 &&
      this.shelfBooks.some((candidate: ShelfBook): boolean =>
        candidate.sourceId === book.sourceId && candidate.bookId === book.bookId);
  }

  private removeShelfBook(book: ShelfBook): void {
    if (!this.canRemoveShelfBook(book)) {
      return;
    }
    const generation = ++this.bookshelfRemovalGeneration;
    const key = `${book.sourceId}\u0000${book.bookId}`;
    this.bookshelfRemovalActiveKey = key;
    const owner = ReaderRuntimeOwner.current();
    const gateway = new BookshelfFlowGateway(owner);
    const isCurrent = (): boolean => generation === this.bookshelfRemovalGeneration &&
      this.bookshelfRemovalActiveKey === key;
    void gateway.remove(book.sourceId, book.bookId)
      .then((outcome: BookshelfRemoveOutcome): void => {
        if (isCurrent()) {
          this.applyShelfBookRemoval(outcome.shelf);
        }
      })
      .catch((error: Error): Promise<void> =>
        this.reconcileShelfBookRemovalFailure(book, error, owner, gateway, isCurrent))
      .finally((): void => {
        if (isCurrent()) {
          this.bookshelfRemovalActiveKey = '';
        }
      });
  }

  private async reconcileShelfBookRemovalFailure(
    book: ShelfBook,
    originalError: Error,
    owner: ReaderRuntimeOwner,
    gateway: BookshelfFlowGateway,
    isCurrent: () => boolean,
  ): Promise<void> {
    try {
      const stored = await new ReaderCoreGateway(owner).loadShelfBook(book.sourceId, book.bookId);
      if (!isCurrent()) {
        return;
      }
      if (stored !== undefined) {
        this.showReadingFailure('移除书架失败', originalError.message);
        return;
      }

      let cleanupError: Error | undefined = undefined;
      if (book.sourceId === LOCAL_SOURCE_ID) {
        try {
          await owner.releaseLocalBookAsset(book.bookId);
        } catch (error) {
          cleanupError = error instanceof Error ? error : new Error(errorMessageOf(error));
        }
      }
      try {
        const shelf = await gateway.load();
        if (!isCurrent()) {
          return;
        }
        this.applyShelfBookRemoval(shelf);
      } catch (loadError) {
        if (!isCurrent()) {
          return;
        }
        this.refreshBookshelf();
        const loadMessage = loadError instanceof Error ? loadError.message : `${loadError}`;
        this.showReadingFailure('已移出书架', `书籍已移除，但书架状态刷新未完成：${loadMessage}`);
      }
      if (cleanupError !== undefined && isCurrent()) {
        this.showReadingFailure('已移出书架',
          `书籍已移除，但应用内 EPUB 文件清理未完成：${cleanupError.message}`);
      }
    } catch (probeError) {
      if (isCurrent()) {
        const probeMessage = probeError instanceof Error ? probeError.message : `${probeError}`;
        hilog.error(DOMAIN, 'Reader',
          'Shelf book removal reconciliation failed: %{public}s', probeMessage);
        this.showReadingFailure('移除书架失败', originalError.message);
      }
    }
  }

  private applyShelfBookRemoval(shelf: BookshelfDataState): void {
    this.bookshelfLoadGeneration += 1;
    if (this.route === 'bookshelf') {
      this.applyBookshelfState(shelf);
    }
  }

  private removeDetailBook(book: ReadingBookDetail): void {
    if (!this.canRemoveDetailBook(book)) {
      return;
    }
    const generation = ++this.bookshelfRemovalGeneration;
    const key = this.detailBookKey(book);
    this.bookshelfRemovalActiveKey = key;
    const owner = ReaderRuntimeOwner.current();
    const gateway = new BookshelfFlowGateway(owner);
    const isCurrent = (): boolean => generation === this.bookshelfRemovalGeneration &&
      this.bookshelfRemovalActiveKey === key;
    void gateway.remove(book.sourceId, book.bookId)
      .then((outcome: BookshelfRemoveOutcome): void => {
        if (isCurrent()) {
          this.applyDetailBookRemoval(book, outcome.shelf);
        }
      })
      .catch((error: Error): Promise<void> =>
        this.reconcileDetailBookRemovalFailure(book, error, owner, gateway, isCurrent))
      .finally((): void => {
        if (isCurrent()) {
          this.bookshelfRemovalActiveKey = '';
        }
      });
  }

  /**
   * `removeBook` commits Core before releasing a retained local EPUB. If the
   * Host cleanup or the following shelf read fails, query the exact composite
   * key before deciding whether the destructive command itself failed.
   */
  private async reconcileDetailBookRemovalFailure(
    book: ReadingBookDetail,
    originalError: Error,
    owner: ReaderRuntimeOwner,
    gateway: BookshelfFlowGateway,
    isCurrent: () => boolean,
  ): Promise<void> {
    try {
      const stored = await new ReaderCoreGateway(owner).loadShelfBook(book.sourceId, book.bookId);
      if (!isCurrent()) {
        return;
      }
      if (stored !== undefined) {
        this.showReadingFailure('移除书架失败', originalError.message);
        return;
      }

      let cleanupError: Error | undefined = undefined;
      if (book.sourceId === LOCAL_SOURCE_ID) {
        try {
          // Idempotent retry for the Core-committed / Host-cleanup-failed window.
          await owner.releaseLocalBookAsset(book.bookId);
        } catch (error) {
          cleanupError = error instanceof Error ? error : new Error(errorMessageOf(error));
        }
      }
      let shelf: BookshelfDataState;
      try {
        shelf = await gateway.load();
      } catch (loadError) {
        if (!isCurrent()) {
          return;
        }
        // The exact key already proved the destructive Core commit. Never
        // leave a deleted book open or relabel that committed fact as failure.
        if (this.route === 'detail' && this.isSameDetailBook(book)) {
          this.returnFromDetail();
        } else if (this.route === 'bookshelf') {
          this.refreshBookshelf();
        }
        const loadMessage = loadError instanceof Error ? loadError.message : `${loadError}`;
        this.showReadingFailure('已移出书架',
          `书籍已从书架移除，但书架状态刷新未完成：${loadMessage}`);
        if (cleanupError !== undefined) {
          hilog.error(DOMAIN, 'Reader',
            'Local EPUB cleanup also failed after bookshelf removal: %{public}s', cleanupError.message);
        }
        return;
      }
      if (!isCurrent()) {
        return;
      }
      this.applyDetailBookRemoval(book, shelf);
      if (cleanupError !== undefined) {
        this.showReadingFailure('已移出书架',
          `书籍已从书架移除，但应用内 EPUB 文件清理未完成：${cleanupError.message}`);
      }
    } catch (probeError) {
      if (isCurrent()) {
        const probeMessage = probeError instanceof Error ? probeError.message : `${probeError}`;
        hilog.error(DOMAIN, 'Reader',
          'Bookshelf removal reconciliation failed: %{public}s', probeMessage);
        this.showReadingFailure('移除书架失败', originalError.message);
      }
    }
  }

  private applyDetailBookRemoval(book: ReadingBookDetail, shelf: BookshelfDataState): void {
    // The mutation result is newer than every shelf read already in flight.
    this.bookshelfLoadGeneration += 1;
    if (this.route === 'detail' && this.isSameDetailBook(book)) {
      this.returnFromDetail();
      // `returnToBookshelf` starts its own read; prefer the exact state already
      // returned by the completed mutation and invalidate that redundant read.
      this.bookshelfLoadGeneration += 1;
      this.applyBookshelfState(shelf);
      return;
    }
    if (this.route === 'bookshelf') {
      this.applyBookshelfState(shelf);
    }
  }

  private openReading(chapterIndex: number | undefined): void {
    const book = this.detailBook;
    if (book === undefined || !this.isKnownDetailChapter(chapterIndex) ||
      this.bookshelfRemovalActiveKey.length > 0 ||
      (book.sourceId !== LOCAL_SOURCE_ID && this.remoteReadingSession === undefined)) {
      return;
    }
    this.nextNavigationGeneration();
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    this.requestedChapterIndex = chapterIndex;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    // Keep the admitted Book Detail static state on screen until the
    // same reader instance has a measured, persisted first page.  There is no
    // inferred loading state and no new motion here.
    this.readingSessionActive = true;
  }

  private onDirectoryChapterSelected(chapterIndex: number): void {
    // R-LOCAL-TOC-01: tapping a chapter in Full Directory returns the user
    // to that chapter's reading flow (the same path used by the Detail
    // chapter rows). The Reader Control Home top-bar target is still gated
    // by `RC-READER-CONTROL-01` and is not fabricated here.
    if (!this.isKnownDetailChapter(chapterIndex)) {
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
    // Keep the existing Figma Full Directory static state visible while the
    // reader loads, measures, and persists the new chapter's first page. The
    // route changes only from ReadingExperience.onReadingReady, so a
    // directory pick cannot expose an empty PaperLayer or old chapter body.
    // Full Directory has no approved loading/selection variant and its panel
    // is not opaque. Keep the last committed row/header/body snapshot visible
    // until `onChapterCommitted` reports the new chapter.
  }

  private openFullDirectory(): void {
    if (this.detailBook === undefined || this.detailToc.length === 0 ||
      this.bookshelfRemovalActiveKey.length > 0) {
      return;
    }
    this.nextNavigationGeneration();
    this.readingExitRequest = undefined;
    this.exitToDetailOriginAfterReader = false;
    // ReadingExperience resolves the real persisted chapter itself. The
    // overlay gets that exact identity through onChapterMaterialized rather
    // than choosing a Figma sample chapter or copying Core text into Index.
    this.requestedChapterIndex = undefined;
    this.preparedReaderRoute = 'directory';
    this.directoryReturnTarget = 'detail';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.readingSessionActive = true;
  }

  private openReaderControlDirectory(): void {
    if (!this.readingSessionActive || this.detailBook === undefined || this.detailToc.length === 0 ||
      this.route !== 'reading') {
      return;
    }
    this.directoryReturnTarget = 'readerControl';
    this.preparedReaderRoute = 'directory';
    this.route = 'directory';
  }

  private presentPreparedReading(chapterIndex: number): void {
    if (!this.readingSessionActive || this.detailBook === undefined) {
      return;
    }
    if (this.route === 'directory' && this.requestedChapterIndex !== chapterIndex) {
      return;
    }
    if (this.route !== 'detail' && this.route !== 'directory') {
      return;
    }
    this.route = this.preparedReaderRoute;
  }

  private returnToDetail(): void {
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
    this.route = 'detail';
  }

  private closeDirectory(): void {
    if (this.directoryReturnTarget === 'readerControl' && this.readingSessionActive) {
      this.preparedReaderRoute = 'reading';
      this.route = 'reading';
      return;
    }
    const requestExit = this.readingExitRequest;
    if (requestExit !== undefined) {
      requestExit();
    } else {
      this.returnToDetail();
    }
  }

  private deleteDirectoryBookmarks(bookmarkTimes: number[]): void {
    const book = this.detailBook;
    if (book === undefined || bookmarkTimes.length === 0) {
      return;
    }
    const uniqueTimes: number[] = [];
    for (const time of bookmarkTimes) {
      if (!Number.isSafeInteger(time) || uniqueTimes.indexOf(time) >= 0) {
        continue;
      }
      uniqueTimes.push(time);
    }
    if (uniqueTimes.length === 0) {
      return;
    }
    const mutationGeneration = this.beginDirectoryBookmarkMutation(book);
    if (mutationGeneration < 0) {
      return;
    }
    const mutationKey = this.directoryBookmarkMutationKey(book);
    const gateway = new LocalReadingFlowGateway(ReaderRuntimeOwner.current());
    const isCurrent = (): boolean => this.detailBook?.sourceId === book.sourceId &&
      this.detailBook?.bookId === book.bookId &&
      this.isDirectoryBookmarkMutationCurrent(mutationGeneration, mutationKey);
    void this.performDirectoryBookmarkDeletion(
      gateway,
      book,
      uniqueTimes,
      isCurrent,
      mutationGeneration,
      mutationKey,
    );
  }

  private createDirectoryChapterStartBookmark(
    request: ReaderDirectoryChapterStartBookmarkRequest,
  ): void {
    const book = this.detailBook;
    if (book === undefined ||
      !Number.isSafeInteger(request.chapterIndex) || request.chapterIndex < 0 ||
      request.chapterTitle.trim().length === 0) {
      return;
    }
    let knownChapter = false;
    for (const entry of this.detailToc) {
      if (entry.index === request.chapterIndex && entry.title === request.chapterTitle) {
        knownChapter = true;
        break;
      }
    }
    if (!knownChapter) {
      return;
    }
    const mutationGeneration = this.beginDirectoryBookmarkMutation(book);
    if (mutationGeneration < 0) {
      return;
    }
    const mutationKey = this.directoryBookmarkMutationKey(book);
    const gateway = new LocalReadingFlowGateway(ReaderRuntimeOwner.current());
    const isCurrent = (): boolean => this.detailBook?.sourceId === book.sourceId &&
      this.detailBook?.bookId === book.bookId &&
      this.isDirectoryBookmarkMutationCurrent(mutationGeneration, mutationKey);
    void this.performDirectoryChapterStartBookmarkCreation(
      gateway,
      book,
      request,
      isCurrent,
      mutationGeneration,
      mutationKey,
    );
  }

  private toggleReaderPageBookmark(request: ReaderPageBookmarkToggleRequest): void {
    const book = this.detailBook;
    if (book === undefined || !Number.isSafeInteger(request.chapterIndex) || request.chapterIndex < 0 ||
      !Number.isSafeInteger(request.chapterOffset) || request.chapterOffset < 0 ||
      request.chapterTitle.trim().length === 0) return;
    let entry: LocalReadingTocEntry | undefined = undefined;
    for (const candidate of this.detailToc) {
      if (candidate.index === request.chapterIndex && candidate.title === request.chapterTitle) {
        entry = candidate;
        break;
      }
    }
    if (entry === undefined || entry.bookmarks === undefined) return;
    const admittedTimes: number[] = [];
    for (const time of request.bookmarkTimes) {
      if (!Number.isSafeInteger(time) || admittedTimes.indexOf(time) >= 0) continue;
      for (const bookmark of entry.bookmarks) {
        if (bookmark.time === time) {
          admittedTimes.push(time);
          break;
        }
      }
    }
    if (admittedTimes.length !== request.bookmarkTimes.length) return;
    const mutationGeneration = this.beginDirectoryBookmarkMutation(book);
    if (mutationGeneration < 0) return;
    const mutationKey = this.directoryBookmarkMutationKey(book);
    const gateway = new LocalReadingFlowGateway(ReaderRuntimeOwner.current());
    const isCurrent = (): boolean => this.detailBook?.sourceId === book.sourceId &&
      this.detailBook?.bookId === book.bookId &&
      this.isDirectoryBookmarkMutationCurrent(mutationGeneration, mutationKey);
    if (admittedTimes.length > 0) {
      void this.performDirectoryBookmarkDeletion(
        gateway, book, admittedTimes, isCurrent, mutationGeneration, mutationKey,
      );
      return;
    }
    void this.performReaderPageBookmarkCreation(
      gateway, book, request, isCurrent, mutationGeneration, mutationKey,
    );
  }

  private directoryBookmarkMutationKey(book: ReadingBookDetail): string {
    return `${book.sourceId.length}:${book.sourceId}:${book.bookId}`;
  }

  /** Returns -1 when the same book already owns an unfinished mutation. */
  private beginDirectoryBookmarkMutation(book: ReadingBookDetail): number {
    const key = this.directoryBookmarkMutationKey(book);
    if (this.directoryBookmarkMutationActiveKey === key) {
      return -1;
    }
    this.directoryBookmarkMutationGeneration = this.directoryBookmarkMutationGeneration >=
      Number.MAX_SAFE_INTEGER ? 1 : this.directoryBookmarkMutationGeneration + 1;
    this.directoryBookmarkMutationActiveKey = key;
    return this.directoryBookmarkMutationGeneration;
  }

  private finishDirectoryBookmarkMutation(generation: number, key: string): void {
    if (this.isDirectoryBookmarkMutationCurrent(generation, key)) {
      this.directoryBookmarkMutationActiveKey = '';
    }
  }

  private isDirectoryBookmarkMutationCurrent(generation: number, key: string): boolean {
    return generation === this.directoryBookmarkMutationGeneration &&
      key === this.directoryBookmarkMutationActiveKey;
  }

  private async performDirectoryChapterStartBookmarkCreation(
    gateway: LocalReadingFlowGateway,
    book: ReadingBookDetail,
    request: ReaderDirectoryChapterStartBookmarkRequest,
    isCurrent: () => boolean,
    mutationGeneration: number,
    mutationKey: string,
  ): Promise<void> {
    try {
      await gateway.createChapterStartBookmark({
        bookName: book.title,
        bookAuthor: book.author,
        chapterIndex: request.chapterIndex,
        chapterTitle: request.chapterTitle,
      }, isCurrent);
      if (!isCurrent()) {
        return;
      }
      const entries = await this.reloadDirectoryBookmarkProjection(gateway, book, isCurrent);
      if (isCurrent()) {
        this.detailToc = entries;
      }
    } catch (error) {
      if (isCurrent()) {
        hilog.error(DOMAIN, 'Reader', 'Directory bookmark create failed: %{public}s',
          (error as Error).message);
      }
    } finally {
      this.finishDirectoryBookmarkMutation(mutationGeneration, mutationKey);
    }
  }

  private async performReaderPageBookmarkCreation(
    gateway: LocalReadingFlowGateway,
    book: ReadingBookDetail,
    request: ReaderPageBookmarkToggleRequest,
    isCurrent: () => boolean,
    mutationGeneration: number,
    mutationKey: string,
  ): Promise<void> {
    try {
      await gateway.createPositionBookmark({
        bookName: book.title,
        bookAuthor: book.author,
        chapterIndex: request.chapterIndex,
        chapterOffset: request.chapterOffset,
        chapterTitle: request.chapterTitle,
      }, isCurrent);
      if (!isCurrent()) return;
      const entries = await this.reloadDirectoryBookmarkProjection(gateway, book, isCurrent);
      if (isCurrent()) this.detailToc = entries;
    } catch (error) {
      if (isCurrent()) {
        hilog.error(DOMAIN, 'Reader', 'Reader page bookmark create failed: %{public}s',
          (error as Error).message);
      }
    } finally {
      this.finishDirectoryBookmarkMutation(mutationGeneration, mutationKey);
    }
  }

  private async performDirectoryBookmarkDeletion(
    gateway: LocalReadingFlowGateway,
    book: ReadingBookDetail,
    bookmarkTimes: number[],
    isCurrent: () => boolean,
    mutationGeneration: number,
    mutationKey: string,
  ): Promise<void> {
    try {
      for (const time of bookmarkTimes) {
        const deleted = await gateway.deleteBookmark(time, isCurrent);
        if (!isCurrent()) {
          return;
        }
        if (!deleted) {
          throw new Error(`bookmark.delete did not delete ${time}`);
        }
      }
      const entries = await this.reloadDirectoryBookmarkProjection(gateway, book, isCurrent);
      if (isCurrent()) {
        this.detailToc = entries;
      }
    } catch (error) {
      if (isCurrent()) {
        hilog.error(DOMAIN, 'Reader', 'Directory bookmark delete failed: %{public}s',
          (error as Error).message);
      }
    } finally {
      this.finishDirectoryBookmarkMutation(mutationGeneration, mutationKey);
    }
  }

  private reloadDirectoryBookmarkProjection(
    gateway: LocalReadingFlowGateway,
    book: ReadingBookDetail,
    isCurrent: () => boolean,
  ): Promise<LocalReadingTocEntry[]> {
    if (book.sourceId === LOCAL_SOURCE_ID) {
      return gateway.loadDirectoryProjection(
        book.bookId,
        book.title,
        book.author,
        this.detailToc,
        isCurrent,
      );
    }
    return gateway.loadBookmarkProjection(book.title, book.author, this.detailToc, isCurrent);
  }

  private async loadRemoteDirectoryProjection(
    offline: ReadingOfflineGateway,
    owner: ReaderRuntimeOwner,
    session: RemoteReadingSession,
    isCurrent: () => boolean,
  ): Promise<LocalReadingTocEntry[]> {
    let entries: LocalReadingTocEntry[] = session.entries.map((entry): LocalReadingTocEntry => ({
      index: entry.index,
      title: entry.title,
      downloadState: 'unknown',
    }));
    try {
      entries = await offline.loadProjection(session, isCurrent);
    } catch (error) {
      hilog.error(DOMAIN, 'Reader', 'Remote download projection failed: %{public}s',
        (error as Error).message);
    }
    try {
      return await new LocalReadingFlowGateway(owner).loadBookmarkProjection(
        session.book.title,
        session.book.author,
        entries,
        isCurrent,
      );
    } catch (error) {
      hilog.error(DOMAIN, 'Reader', 'Remote bookmark projection failed: %{public}s',
        (error as Error).message);
      return entries;
    }
  }

  private mergeDirectoryBookmarks(
    entries: LocalReadingTocEntry[],
    source: LocalReadingTocEntry[],
  ): LocalReadingTocEntry[] {
    const sourceByChapter = new Map<number, LocalReadingTocEntry>();
    for (const entry of source) {
      sourceByChapter.set(entry.index, entry);
    }
    return entries.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => {
      const previous = sourceByChapter.get(entry.index);
      return {
        index: entry.index,
        title: entry.title,
        downloadState: entry.downloadState,
        bookmarks: previous?.bookmarks,
      };
    });
  }

  private updateDirectoryChapterDownloadState(
    chapterIndex: number,
    downloadState: LocalReadingDownloadState,
  ): void {
    const position = this.detailToc.findIndex((entry: LocalReadingTocEntry): boolean =>
      entry.index === chapterIndex);
    if (position < 0) {
      return;
    }
    const entry = this.detailToc[position];
    if (entry.downloadState === downloadState) {
      return;
    }
    this.detailToc.splice(position, 1, {
      index: entry.index,
      title: entry.title,
      downloadState,
      bookmarks: entry.bookmarks,
    });
  }

  private getSourceSwitchGateway(): SourceSwitchGateway {
    if (this.sourceSwitchGateway === undefined) {
      this.sourceSwitchGateway = new SourceSwitchGateway(ReaderRuntimeOwner.current());
    }
    return this.sourceSwitchGateway;
  }

  private isSourceSwitchActive(generation: number): boolean {
    return generation === this.navigationGeneration && this.sourceSwitchVisible;
  }

  private openSourceSwitch(): void {
    if (this.detailBook === undefined || this.detailBook.sourceId === LOCAL_SOURCE_ID || this.sourceSwitchVisible) {
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.exitToDetailOriginAfterReader = false;
    // SS-SOURCE-SWITCH-01: the window floats over the reading surface (Figma
    // 3572:41345), so close the directory and let the surface be the backdrop.
    this.preparedReaderRoute = 'reading';
    this.route = 'reading';
    this.sourceSwitchVisible = true;
    this.sourceSwitchState = { kind: 'discovering' };
    this.startSourceDiscovery(generation);
  }

  private openDetailSourceSwitch(): void {
    if (this.route !== 'detail' || this.detailBook === undefined ||
      this.detailBook.sourceId === LOCAL_SOURCE_ID || this.sourceSwitchVisible ||
      this.bookshelfRemovalActiveKey.length > 0) {
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.exitToDetailOriginAfterReader = false;
    this.sourceSwitchVisible = true;
    this.sourceSwitchState = { kind: 'discovering' };
    this.startSourceDiscovery(generation);
  }

  private retrySourceSwitch(): void {
    const kind = this.sourceSwitchState.kind;
    if (!this.sourceSwitchVisible || (kind !== 'discoveryError' && kind !== 'empty')) {
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.sourceSwitchState = { kind: 'discovering' };
    this.startSourceDiscovery(generation, false, true);
  }

  private refreshSourceSwitch(): void {
    if (!this.sourceSwitchVisible || this.sourceSwitchState.kind !== 'candidates' ||
      this.sourceSwitchState.refreshing === true) {
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.startSourceDiscovery(generation, false, true);
  }

  private startSourceDiscovery(
    generation: number,
    autoPickFirst: boolean = false,
    forceRefresh: boolean = false,
  ): void {
    if (this.detailBook === undefined) {
      return;
    }
    let query: SourceSwitchProbeQuery;
    try {
      query = this.sourceSwitchProbeQuery();
    } catch (error) {
      const message = errorMessageOf(error);
      this.sourceSwitchState = { kind: 'discoveryError', message };
      return;
    }
    const gateway = this.getSourceSwitchGateway();
    const isCurrent = (): boolean => this.isSourceSwitchActive(generation);
    const previousCandidates = this.sourceSwitchState.kind === 'candidates'
      ? this.sourceSwitchState.candidates
      : [];
    if (forceRefresh && previousCandidates.length > 0) {
      this.sourceSwitchState = { kind: 'candidates', candidates: previousCandidates, refreshing: true };
    }
    const load = forceRefresh
      ? gateway.refreshCandidates(query, isCurrent)
      : gateway.loadCachedCandidates(query, isCurrent)
        .then((cached: SourceSwitchCandidate[]): Promise<SourceSwitchDiscoveryOutcome> |
          SourceSwitchDiscoveryOutcome => cached.length > 0
          ? { kind: 'sources', candidates: cached }
          : gateway.refreshCandidates(query, isCurrent));
    load
      .then((outcome: SourceSwitchDiscoveryOutcome): void => {
        if (!isCurrent()) {
          return;
        }
        if (outcome.kind === 'noSources' || outcome.candidates.length === 0) {
          this.sourceSwitchState = { kind: 'empty' };
          return;
        }
        this.sourceSwitchState = { kind: 'candidates', candidates: outcome.candidates, refreshing: false };
        if (autoPickFirst) {
          const candidate = outcome.candidates.find((value: SourceSwitchCandidate): boolean =>
            value.isCurrent !== true && value.offline !== true && value.timeout !== true);
          if (candidate !== undefined) {
            this.onPickSource(candidate);
          }
        }
      })
      .catch((error: Error): void => {
        if (!isCurrent()) {
          return;
        }
        // change.bookSource is remote. Any Host transport constraint is
        // surfaced through the admitted discovery failure state.
        hilog.warn(DOMAIN, 'Reader', 'SS-SOURCE-SWITCH-01: candidate discovery failed: %{public}s', error.message);
        if (forceRefresh && previousCandidates.length > 0) {
          this.sourceSwitchState = {
            kind: 'candidates',
            candidates: previousCandidates,
            refreshing: false,
            refreshError: error.message,
          };
        } else {
          this.sourceSwitchState = { kind: 'discoveryError', message: error.message };
        }
      });
  }

  private sourceSwitchProbeQuery(): SourceSwitchProbeQuery {
    const book = this.detailBook;
    if (book === undefined || this.detailToc.length === 0) {
      throw new Error('换源探测需要当前书籍目录');
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
      currentChapterIndex: anchor.index,
      currentChapterTitle: anchor.title,
    };
  }

  private onPickSource(candidate: SourceSwitchCandidate): void {
    if (this.sourceSwitchState.kind !== 'candidates' || this.detailBook === undefined) {
      return;
    }
    const book = this.detailBook;
    if (sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl) ===
      sourceSwitchCandidateKey(book.sourceId, book.bookId)) {
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.sourceSwitchState = { kind: 'switching', targetSourceId: candidate.sourceId };
    const gateway = this.getSourceSwitchGateway();
    const isCurrent = (): boolean => this.isSourceSwitchActive(generation);
    gateway.fetchTargetToc(candidate.sourceId, candidate.bookUrl, isCurrent)
      .then(async (toc: SourceSwitchTargetToc): Promise<SourceSwitchCommitOutcome> => {
        if (!isCurrent()) {
          return Promise.reject(new Error('source switch aborted'));
        }
        const progress = await new RemoteReadingFlowGateway(ReaderRuntimeOwner.current()).loadProgress(
          { sourceId: book.sourceId, bookId: book.bookId },
          isCurrent,
        );
        if (!isCurrent()) {
          return Promise.reject(new Error('source switch aborted'));
        }
        const anchor = this.resolveSourceSwitchAnchor(progress);
        const params = buildSourceSwitchCommitParams(
          { sourceId: book.sourceId, bookId: book.bookId },
          candidate,
          toc,
          anchor.chapterTitle,
          anchor.chapterIndex,
          Math.floor(Date.now() / 1000),
        );
        return gateway.commitSwitch(params, isCurrent);
      })
      .then((outcome: SourceSwitchCommitOutcome): void => {
        if (!isCurrent()) {
          return;
        }
        if (outcome.status === 'success') {
          this.pendingSourceSwitch = new PendingSourceSwitchTransaction(
            book.sourceId,
            book.bookId,
            outcome.book.sourceId,
            outcome.book.bookId,
            outcome.matchedChapter.order,
            outcome.transactionId,
          );
          this.sourceSwitchState = { kind: 'success' };
          this.performSourceSwitchSeam(outcome.book);
          return;
        }
        if (outcome.transactionId !== undefined) {
          this.sourceSwitchState = {
            kind: 'failure',
            message: outcome.error,
            transactionId: outcome.transactionId,
          };
          return;
        }
        void this.reconcileUnknownSourceSwitchCommit(book, candidate, outcome.error, generation);
      })
      .catch((error: Error): void => {
        if (!isCurrent()) {
          return;
        }
        hilog.warn(DOMAIN, 'Reader', 'SS-SOURCE-SWITCH-01: source switch failed: %{public}s', error.message);
        this.sourceSwitchState = { kind: 'failure', message: error.message };
      });
  }

  private async reconcileUnknownSourceSwitchCommit(
    book: ReadingBookDetail,
    candidate: SourceSwitchCandidate,
    message: string,
    generation: number,
  ): Promise<void> {
    const isCurrent = (): boolean => this.isSourceSwitchActive(generation);
    const gateway = this.getSourceSwitchGateway();
    try {
      const pending = await gateway.listPendingSwitches(isCurrent);
      if (!isCurrent()) {
        return;
      }
      const matches = pending.filter((transaction: PendingSourceSwitch): boolean =>
        transaction.fromSourceId === book.sourceId && transaction.fromBookId === book.bookId &&
        transaction.targetSourceId === candidate.sourceId && transaction.targetBookId === candidate.bookUrl);
      if (matches.length !== 1) {
        this.sourceSwitchState = { kind: 'failure', message };
        return;
      }
      const transaction = matches[0];
      await gateway.rollbackSwitch(transaction.transactionId, isCurrent);
      if (!isCurrent()) {
        return;
      }
      this.refreshBookshelf();
      this.sourceSwitchState = { kind: 'failure', message };
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      const failure = errorMessageOf(error);
      this.sourceSwitchState = { kind: 'failure', message: failure };
    }
  }

  private resolveSourceSwitchAnchor(progress: RemoteReadingProgressState): SourceSwitchAnchor {
    if (this.detailToc.length === 0) {
      throw new Error('source switch requires the admitted current TOC');
    }
    const index = progress.kind === 'restored' ? progress.progress.chapterIndex : this.detailToc[0].index;
    for (const entry of this.detailToc) {
      if (entry.index === index) {
        return new SourceSwitchAnchor(entry.index, entry.title);
      }
    }
    throw new Error('Core progress chapter is absent from the admitted current TOC');
  }

  private onRollbackSourceSwitch(): void {
    if (this.sourceSwitchState.kind !== 'failure' || this.sourceSwitchState.transactionId === undefined) {
      return;
    }
    const transactionId = this.sourceSwitchState.transactionId;
    const generation = this.nextNavigationGeneration();
    this.sourceSwitchState = { kind: 'switching', targetSourceId: '' };
    const gateway = this.getSourceSwitchGateway();
    gateway.rollbackSwitch(transactionId, (): boolean => this.isSourceSwitchActive(generation))
      .then((result: SourceSwitchRollbackResult): void => {
        if (!this.isSourceSwitchActive(generation)) {
          return;
        }
        this.performSourceSwitchSeam(result.restoredBook);
      })
      .catch((error: Error): void => {
        if (!this.isSourceSwitchActive(generation)) {
          return;
        }
        hilog.warn(DOMAIN, 'Reader', 'SS-SOURCE-SWITCH-01: rollback failed: %{public}s', error.message);
        this.sourceSwitchState = { kind: 'failure', message: error.message, transactionId };
      });
  }

  private closeSourceSwitch(): void {
    if (!this.sourceSwitchVisible) {
      return;
    }
    if (this.sourceSwitchState.kind === 'switching' ||
      (this.sourceSwitchState.kind === 'failure' && this.sourceSwitchState.transactionId !== undefined)) {
      // Closing after Core has entered the durable commit, or while its opaque
      // transaction still needs rollback, could strand a pending shelf move.
      return;
    }
    this.nextNavigationGeneration();
    this.sourceSwitchVisible = false;
    this.sourceSwitchState = { kind: 'discovering' };
  }

  private performSourceSwitchSeam(book: ShelfBook): void {
    this.sourceSwitchVisible = false;
    this.sourceSwitchState = { kind: 'discovering' };
    this.reopenSwitchedBook(book);
  }

  private onReadingFailure(sourceId: string, bookId: string, message: string): void {
    const pending = this.pendingSourceSwitch;
    if (pending !== undefined && pending.targetSourceId === sourceId && pending.targetBookId === bookId) {
      this.rollbackPendingSourceSwitch(message);
      return;
    }
    const detail = this.detailBook;
    const recoveryKey = `${sourceId}\u0000${bookId}`;
    if (detail === undefined || detail.sourceId === LOCAL_SOURCE_ID || detail.sourceId !== sourceId ||
      detail.bookId !== bookId || this.sourceSwitchVisible ||
      this.automaticSourceRecoveryKey === recoveryKey) {
      this.showReadingFailure('阅读失败', message);
      return;
    }
    // Match Legado's missing-source recovery path: discover compatible
    // sources and try the first ranked candidate through the existing
    // transactional switch/rollback seam. The panel remains visible if
    // discovery or the automatic candidate fails, so the user keeps control.
    this.automaticSourceRecoveryKey = recoveryKey;
    const generation = this.nextNavigationGeneration();
    this.sourceSwitchVisible = true;
    this.sourceSwitchState = { kind: 'discovering' };
    this.startSourceDiscovery(generation, true);
  }

  private showReadingFailure(title: string, message: string): void {
    this.getUIContext().showAlertDialog({
      title,
      message: message.trim().length > 0 ? message : '阅读会话未能继续，请稍后重试。',
      autoCancel: true,
      primaryButton: {
        value: '知道了',
        action: (): void => {},
      },
    });
  }

  /**
   * A reconstructed Index has no active reader that can finalize a pending
   * source switch. Reconcile only transactions whose exact shelf projection
   * proves the Core commit is still pending; never invoke a global recover or
   * keep a UI-side journal.
   */
  private async reconcilePendingSourceSwitches(): Promise<void> {
    const generation = ++this.sourceSwitchReconciliationGeneration;
    const isCurrent = (): boolean => generation === this.sourceSwitchReconciliationGeneration;
    const gateway = this.getSourceSwitchGateway();
    const bookshelf = new ReaderCoreGateway(ReaderRuntimeOwner.current());
    let changed = false;
    try {
      const pending = await gateway.listPendingSwitches(isCurrent);
      if (!isCurrent() || this.pendingSourceSwitch !== undefined) {
        return;
      }
      for (const transaction of pending) {
        if (!isCurrent() || this.pendingSourceSwitch !== undefined) {
          return;
        }
        const fromBook = await bookshelf.loadShelfBook(transaction.fromSourceId, transaction.fromBookId);
        if (!isCurrent()) {
          return;
        }
        const targetBook = await bookshelf.loadShelfBook(transaction.targetSourceId, transaction.targetBookId);
        if (!isCurrent()) {
          return;
        }
        if (fromBook !== undefined || targetBook === undefined) {
          hilog.warn(DOMAIN, 'Reader',
            'Pending source switch shelf projection is inconsistent; leaving Core transaction untouched');
          continue;
        }
        await gateway.rollbackSwitch(transaction.transactionId, isCurrent);
        changed = true;
      }
    } catch (error) {
      hilog.warn(DOMAIN, 'Reader', 'Pending source switch reconciliation failed: %{public}s',
        errorMessageOf(error));
    }
    if (changed && isCurrent()) {
      this.refreshBookshelf();
    }
  }

  private rollbackPendingSourceSwitch(reason: string): void {
    const pending = this.pendingSourceSwitch;
    if (pending === undefined || this.sourceSwitchRollbackInFlight) {
      return;
    }
    this.sourceSwitchRollbackInFlight = true;
    hilog.warn(DOMAIN, 'Reader',
      'Source switch target admission failed; rolling back: %{public}s', reason);
    const gateway = this.getSourceSwitchGateway();
    void gateway.rollbackSwitch(
      pending.transactionId,
      (): boolean => this.pendingSourceSwitch === pending,
    )
      .then((result: SourceSwitchRollbackResult): void => {
        if (this.pendingSourceSwitch !== pending) {
          return;
        }
        this.pendingSourceSwitch = undefined;
        this.sourceSwitchVisible = false;
        this.sourceSwitchState = { kind: 'discovering' };
        this.refreshBookshelf();
        this.reopenSwitchedBook(result.restoredBook);
      })
      .catch((error: Error): void => {
        if (this.pendingSourceSwitch !== pending) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Source switch automatic rollback failed: %{public}s', error.message);
        // Core rejects finalized/stale compensation rather than overwriting
        // newer progress. Return to the canonical shelf projection; retain
        // only the opaque transaction id for an explicit retry.
        this.sourceSwitchVisible = false;
        this.sourceSwitchState = {
          kind: 'failure',
          message: error.message,
          transactionId: pending.transactionId,
        };
        this.returnToBookshelf();
      })
      .finally((): void => {
        this.sourceSwitchRollbackInFlight = false;
      });
  }

  private reopenSwitchedBook(book: ShelfBook): void {
    this.openShelfBook(book);
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
    this.detailBook = undefined;
    this.remoteReadingSession = retainedRemoteSession;
    // The search orchestrator still owns the presented results; re-entering
    // must not call open() because that would reset them to the Initial state.
    this.route = 'search';
    // A sweep that died while the route was away leaves searching:true behind;
    // resumeStaleSweep re-runs it, while a live sweep keeps its course.
    this.getSearchOrchestrator().resumeStaleSweep();
  }

  private returnToBookshelf(): void {
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
    this.detailBook = undefined;
    this.remoteReadingSession = retainedRemoteSession;
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
    this.bookshelfBatchRemovalBusy = false;
    this.resetSearchDetailWarmups();
    this.route = 'bookshelf';
    this.refreshBookshelf();
  }

  private applyReadingCommit(commit: ReadingCommit): void {
    if (commit.sourceId.trim().length === 0 || commit.bookId.trim().length === 0 ||
      this.detailBook?.sourceId !== commit.sourceId || this.detailBook?.bookId !== commit.bookId) {
      return;
    }
    const pending = this.pendingSourceSwitch;
    if (pending !== undefined && pending.targetSourceId === commit.sourceId &&
      pending.targetBookId === commit.bookId && pending.targetChapterIndex === commit.chapterIndex) {
      this.pendingSourceSwitch = undefined;
      this.sourceSwitchRollbackInFlight = false;
      // The target has now loaded, paginated, and durably committed its first
      // canonical scalar anchor. Old per-book body/image caches are no longer
      // reachable and can be cleared without touching the source-wide cookie
      // session that other books may share.
      void new ReadingOfflineGateway(ReaderRuntimeOwner.current())
        .clearBookIdentity(pending.fromSourceId, pending.fromBookId)
        .catch((error: Error): void => {
          hilog.warn(DOMAIN, 'Reader', 'Old source book cache cleanup failed: %{public}s', error.message);
        });
    }
    this.automaticSourceRecoveryKey = '';
    const session = this.remoteReadingSession;
    if (session !== undefined && session.identity.sourceId === commit.sourceId &&
      session.identity.bookId === commit.bookId) {
      void this.prefetchReadingWindow(session, commit.chapterIndex)
        .catch((error: Error): void => {
          hilog.warn(DOMAIN, 'Reader', 'Rolling chapter cache incomplete: %{public}s', error.message);
        });
      if (session.entries.length - commit.chapterIndex - 1 <= CATALOG_REFRESH_NEAR_END) {
        this.refreshRemoteCatalogNearEnd(session);
      }
    }
  }

  private currentSourceSwitchTransactionId(): string | undefined {
    const pending = this.pendingSourceSwitch;
    const detail = this.detailBook;
    if (pending === undefined || detail === undefined || pending.targetSourceId !== detail.sourceId ||
      pending.targetBookId !== detail.bookId) {
      return undefined;
    }
    return pending.transactionId;
  }

  private readingDetailForShelf(book: ShelfBook): ReadingBookDetail {
    return {
      sourceId: book.sourceId,
      sourceName: this.sourceDisplayName(book.sourceId),
      bookId: book.bookId,
      title: book.title,
      author: book.author,
      kind: book.kind,
      coverUrl: book.coverUrl,
      intro: book.intro,
      lastChapter: book.lastChapter,
    };
  }

  private sourceDisplayName(sourceId: string): string {
    if (sourceId === LOCAL_SOURCE_ID) {
      return '本地书籍';
    }
    for (const source of this.searchSources) {
      if (source.sourceId === sourceId && source.name.trim().length > 0) {
        return source.name.trim();
      }
    }
    for (const source of this.sourceSources) {
      if (source.sourceId === sourceId && source.name.trim().length > 0) {
        return source.name.trim();
      }
    }
    for (const source of this.sourceToolsSnapshot.sources) {
      if (source.sourceId === sourceId && source.name.trim().length > 0) {
        return source.name.trim();
      }
    }
    return sourceId;
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

  private async prefetchReadingWindow(
    session: RemoteReadingSession,
    preferredChapterIndex: number | undefined = undefined,
  ): Promise<void> {
    let chapterIndex = preferredChapterIndex;
    if (chapterIndex === undefined) {
      const progress = await new RemoteReadingFlowGateway(ReaderRuntimeOwner.current())
        .loadProgress(session.identity);
      chapterIndex = progress.kind === 'restored' ? progress.progress.chapterIndex : 0;
    }
    const boundedIndex = Math.min(Math.max(chapterIndex, 0), session.entries.length - 1);
    const startInclusive = Math.max(0, boundedIndex - READING_CACHE_BEFORE);
    const endExclusive = Math.min(session.entries.length, boundedIndex + READING_CACHE_AFTER + 1);
    const entries = await new ReadingOfflineGateway(ReaderRuntimeOwner.current())
      .prefetchRange(session, startInclusive, endExclusive);
    if (this.remoteReadingSession?.identity.sourceId === session.identity.sourceId &&
      this.remoteReadingSession?.identity.bookId === session.identity.bookId) {
      this.detailToc = this.mergeDirectoryBookmarks(entries, this.detailToc);
    }
  }

  private refreshRemoteCatalogNearEnd(session: RemoteReadingSession): void {
    const key = `${session.identity.sourceId}\u0000${session.identity.bookId}`;
    const now = Date.now();
    const lastRefresh = this.remoteCatalogRefreshAt.get(key) ?? 0;
    if (now - lastRefresh < CATALOG_REFRESH_INTERVAL_MS) {
      return;
    }
    this.remoteCatalogRefreshAt.set(key, now);
    const detail = this.detailBook;
    if (detail === undefined || detail.sourceId !== session.identity.sourceId ||
      detail.bookId !== session.identity.bookId) {
      return;
    }
    const seed: RemoteReadingBookSeed = {
      sourceId: session.identity.sourceId,
      bookId: session.identity.bookId,
      detailUrl: session.detailUrl,
      title: session.book.title,
      author: session.book.author,
      coverUrl: session.book.coverUrl,
      intro: session.book.intro,
      kind: session.book.kind,
      lastChapter: session.book.lastChapter,
      searchVariables: session.continuationVariables,
    };
    const isCurrent = (): boolean => this.remoteReadingSession?.identity.sourceId ===
      session.identity.sourceId && this.remoteReadingSession?.identity.bookId === session.identity.bookId;
    const owner = ReaderRuntimeOwner.current();
    void new RemoteReadingFlowGateway(owner).openSession(seed, { isCurrent })
      .then((refreshed: RemoteReadingSession): void => {
        if (!isCurrent()) {
          return;
        }
        this.remoteReadingSession = refreshed;
        this.detailToc = refreshed.entries.map((entry): LocalReadingTocEntry => ({
          index: entry.index,
          title: entry.title,
          downloadState: 'unknown',
        }));
        this.detailBook = {
          sourceId: refreshed.identity.sourceId,
          sourceName: detail.sourceName.length > 0 ? detail.sourceName : refreshed.identity.sourceId,
          bookId: refreshed.identity.bookId,
          title: refreshed.book.title,
          author: refreshed.book.author,
          kind: refreshed.book.kind,
          coverUrl: refreshed.book.coverUrl,
          intro: refreshed.book.intro,
          lastChapter: refreshed.book.lastChapter,
        };
        this.refreshBookshelf();
      })
      .catch((error: Error): void => {
        hilog.warn(DOMAIN, 'Reader', 'Near-end catalog refresh failed: %{public}s', error.message);
      });
  }

  private applyReaderDirectoryProjection(entries: LocalReadingTocEntry[]): void {
    if (!this.readingSessionActive || entries.length !== this.detailToc.length) {
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
    const next: LocalReadingTocEntry[] = [];
    for (const entry of this.detailToc) {
      const titleProjection = projected.get(entry.index);
      if (titleProjection === undefined) {
        return;
      }
      next.push({
        index: entry.index,
        title: titleProjection.title,
        downloadState: entry.downloadState,
        bookmarks: entry.bookmarks,
      });
    }
    this.detailToc = next;
  }

  private refreshBookshelf(): void {
    const loadGeneration = this.bookshelfLoadGeneration + 1;
    this.bookshelfLoadGeneration = loadGeneration;
    const gateway = new BookshelfFlowGateway(ReaderRuntimeOwner.current());
    gateway.load()
      .then((state: BookshelfDataState): void => {
        if (loadGeneration !== this.bookshelfLoadGeneration) {
          return;
        }
        this.applyBookshelfState(state, true);
      })
      .catch((error: Error): void => {
        if (loadGeneration !== this.bookshelfLoadGeneration) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Bookshelf state failed to refresh: %{public}s', error.message);
      });
  }

  private isKnownDetailChapter(chapterIndex: number | undefined): boolean {
    if (chapterIndex === undefined) {
      return this.detailToc.length > 0;
    }
    for (const entry of this.detailToc) {
      if (entry.index === chapterIndex) {
        return true;
      }
    }
    return false;
  }

  private nextNavigationGeneration(): number {
    this.navigationGeneration += 1;
    return this.navigationGeneration;
  }

  private isCurrentRoute(generation: number, route: ReaderRoute): boolean {
    return generation === this.navigationGeneration && this.route === route;
  }

  private applyBookshelfState(state: BookshelfDataState, refreshOnly: boolean = false): void {
    if (refreshOnly && state.kind !== 'populated' && this.isBookshelfVisualAdmitted) {
      // A refresh-only read that lost the populated shelf while the admitted
      // tree is mounted is treated as a transient Core read: keep the last
      // projection mounted instead of unmounting the whole route (flicker).
      // Genuine user mutations (removal/import) always reset admission.
      return;
    }
    this.isCoreShelfEmpty = state.kind === 'empty';
    this.shelfBooks = state.shelf.books;
    this.continueReading = state.continueReading;
    if (state.kind !== 'populated') {
      this.isBookshelfVisualAdmitted = false;
      return;
    }
    // N-COVER-REMAP-01: Figma `Library/BookCover` `3612:1796` supplies a
    // `Book=NoCover` variant, so a Core book without a coverUrl is no longer
    // a missing visual. Re-admit no-cover books and let the detail/result
    // pages use the shared NoCover gradient placeholder rather than
    // silently dropping the entire shelf.
    this.isBookshelfVisualAdmitted = true;
    this.scheduleBookshelfBackgroundRefresh(state.shelf.books);
  }

  private scheduleBookshelfBackgroundRefresh(books: ShelfBook[]): void {
    if (this.bookshelfBackgroundRefreshRunning || this.bookshelfUpdateRunning ||
      !this.settingsSnapshot.autoCheckUpdate) {
      return;
    }
    const now = Date.now();
    const candidates = books.filter((book: ShelfBook): boolean => book.sourceId !== LOCAL_SOURCE_ID &&
      (book.lastCheckAt === undefined || now - book.lastCheckAt * 1000 >= CATALOG_REFRESH_INTERVAL_MS));
    if (candidates.length === 0) {
      return;
    }
    this.bookshelfBackgroundRefreshRunning = true;
    void this.refreshBookshelfCatalogBatch(candidates)
      .finally((): void => {
        this.bookshelfBackgroundRefreshRunning = false;
      });
  }

  private async refreshBookshelfCatalogBatch(books: ShelfBook[],
    onProgress?: (done: number, total: number) => void): Promise<void> {
    // Keep source I/O bounded like Legado's bookshelf updater. Two concurrent
    // books avoid serial stalls without flooding all enabled sources.
    let completed = 0;
    for (let start = 0; start < books.length; start += 2) {
      const batch = books.slice(start, Math.min(books.length, start + 2));
      await Promise.all(batch.map((book: ShelfBook): Promise<void> => this.refreshOneShelfBook(book)));
      completed += batch.length;
      if (onProgress !== undefined) {
        onProgress(completed, books.length);
      }
    }
    try {
      const state = await new BookshelfFlowGateway(ReaderRuntimeOwner.current()).load();
      if (this.route === 'bookshelf') {
        this.bookshelfLoadGeneration += 1;
        this.applyBookshelfState(state, true);
      }
    } catch (error) {
      hilog.warn(DOMAIN, 'Reader', 'Bookshelf update projection failed: %{public}s',
        (error as Error).message);
    }
  }

  /**
   * SHF-03: user-triggered foreground sweep. Deliberately ignores the
   * background lastCheckAt throttle (the user asked for the check now) and
   * keeps no scheduler behind it: the sweep only lives while this process
   * runs, concurrency stays at the shared batch limit of two.
   */
  private startManualBookshelfUpdate(): void {
    if (this.bookshelfUpdateRunning || this.bookshelfBackgroundRefreshRunning) {
      return;
    }
    const candidates = this.shelfBooks.filter((book: ShelfBook): boolean =>
      book.sourceId !== LOCAL_SOURCE_ID);
    if (candidates.length === 0) {
      hilog.info(DOMAIN, 'Reader', 'Manual bookshelf update: no network books to check');
      return;
    }
    this.bookshelfUpdateRunning = true;
    this.bookshelfUpdateDone = 0;
    this.bookshelfUpdateTotal = candidates.length;
    hilog.info(DOMAIN, 'Reader', 'Manual bookshelf update sweep: %{public}d books', candidates.length);
    void this.refreshBookshelfCatalogBatch(candidates,
      (done: number, total: number): void => {
        this.bookshelfUpdateDone = done;
        this.bookshelfUpdateTotal = total;
      })
      .finally((): void => {
        this.bookshelfUpdateRunning = false;
      });
  }

  private async refreshOneShelfBook(book: ShelfBook): Promise<void> {
    const seed: RemoteReadingBookSeed = {
      sourceId: book.sourceId,
      bookId: book.bookId,
      detailUrl: book.bookId,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      intro: book.intro,
      lastChapter: book.lastChapter,
    };
    try {
      const session = await new RemoteReadingFlowGateway(ReaderRuntimeOwner.current()).openSession(seed);
      await this.prefetchReadingWindow(session);
    } catch (error) {
      // Per-book failures do not abort remaining bookshelf updates. Existing
      // local TOC/bodies stay authoritative and the next interval retries.
      hilog.warn(DOMAIN, 'Reader',
        'Bookshelf background update failed for %{public}s: %{public}s',
        book.bookId, (error as Error).message);
    }
  }

  private hasDeclaredCoverUrl(book: ShelfBook): boolean {
    if (book.coverUrl === undefined) {
      return false;
    }
    return /^(data:image\/(png|jpeg|bmp|webp);base64,|file:\/\/)/.test(book.coverUrl.trim());
  }

  private openImportDialog(): void {
    this.writeImportPresentation(new LocalImportPresentation('fileSelection'));
  }

  private closeImportDialog(): void {
    this.writeImportPresentation(undefined);
  }

  private beginImport(): void {
    const presentation = this.currentImportPresentation();
    if (presentation !== undefined && presentation.state === 'importing') {
      return;
    }
    const importNavigationGeneration = this.navigationGeneration;
    this.writeImportPresentation(new LocalImportPresentation('importing'));
    const owner = ReaderRuntimeOwner.current();
    const gateway = new BookshelfFlowGateway(owner);
    gateway.importFromSystemPicker()
      .then((outcome): void => {
        // Import writes a newer Core shelf snapshot than any in-flight shelf
        // refresh. Invalidate such reads even if the user has left Bookshelf;
        // the next entry will load the authoritative Core state.
        this.bookshelfLoadGeneration += 1;
        const isStillOnBookshelf = this.route === 'bookshelf' &&
          importNavigationGeneration === this.navigationGeneration;
        if (outcome.batch.state === 'cancelled') {
          if (isStillOnBookshelf) {
            this.closeImportDialog();
          }
          return;
        }
        if (!isStillOnBookshelf) {
          return;
        }
        this.applyBookshelfState(outcome.shelf);
        this.writeImportPresentation(new LocalImportPresentation('result', outcome.batch));
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Local import failed: %{public}s', error.message);
        // `Import Result` only accepts per-file facts returned by Core.  An
        // unexpected picker/runtime failure has no supplied Figma error
        // surface, so do not fabricate a file name or a completed batch.
        if (this.route === 'bookshelf' && importNavigationGeneration === this.navigationGeneration) {
          this.writeImportPresentation(new LocalImportPresentation('fileSelection'));
        }
      });
  }

  private writeImportPresentation(presentation: LocalImportPresentation | undefined): void {
    if (presentation === undefined) {
      AppStorage.setOrCreate<string>(IMPORT_PRESENTATION_KEY, '');
      return;
    }
    if (presentation.state !== 'result') {
      AppStorage.setOrCreate<string>(IMPORT_PRESENTATION_KEY,
        JSON.stringify(new LocalImportPresentation(presentation.state)));
      return;
    }
    if (presentation.batch === undefined || !this.isValidImportBatch(presentation.batch)) {
      hilog.error(DOMAIN, 'Reader', 'Refusing to present an invalid local import batch');
      AppStorage.setOrCreate<string>(IMPORT_PRESENTATION_KEY, '');
      return;
    }
    try {
      // A single JSON value prevents a reconstructed page from observing a
      // result state before its real Core-derived per-file batch.
      AppStorage.setOrCreate<string>(IMPORT_PRESENTATION_KEY, JSON.stringify(presentation));
    } catch (error) {
      const message = errorMessageOf(error);
      hilog.error(DOMAIN, 'Reader', 'Failed to save local import presentation: %{public}s', message);
      AppStorage.setOrCreate<string>(IMPORT_PRESENTATION_KEY, '');
    }
  }

  private reconcileImportPresentation(): void {
    if (this.storedImportPresentation !== '' && this.currentImportPresentation() === undefined) {
      hilog.warn(DOMAIN, 'Reader', 'Discarding an invalid restored local import result');
      this.writeImportPresentation(undefined);
    }
  }

  private hasVisibleImportDialog(): boolean {
    return this.currentImportPresentation() !== undefined;
  }

  private visibleImportDialogState(): LocalImportDialogState {
    const presentation = this.currentImportPresentation();
    return presentation === undefined ? 'fileSelection' : presentation.state;
  }

  private visibleImportBatch(): LocalImportBatch | undefined {
    const presentation = this.currentImportPresentation();
    return presentation === undefined ? undefined : presentation.batch;
  }

  private currentImportPresentation(): LocalImportPresentation | undefined {
    if (this.storedImportPresentation.length === 0) {
      return undefined;
    }
    try {
      const presentation = JSON.parse(this.storedImportPresentation) as LocalImportPresentation;
      if (presentation === null) {
        return undefined;
      }
      if (presentation.state === 'fileSelection' || presentation.state === 'importing') {
        return presentation.batch === undefined
          ? new LocalImportPresentation(presentation.state)
          : undefined;
      }
      if (presentation.state !== 'result') {
        return undefined;
      }
      const batch = this.parseImportBatch(presentation.batch);
      return batch === undefined ? undefined : new LocalImportPresentation('result', batch);
    } catch (_) {
      return undefined;
    }
  }

  private parseImportBatch(batch: LocalImportBatch | undefined): LocalImportBatch | undefined {
    if (batch === undefined || batch === null || !this.isValidImportBatch(batch)) {
      return undefined;
    }
    return batch;
  }

  private isValidImportBatch(batch: LocalImportBatch): boolean {
    if (batch.state !== 'completed' || !this.isNonNegativeInteger(batch.imported)
      || !this.isNonNegativeInteger(batch.failed) || !Array.isArray(batch.items)
      || batch.items.length !== batch.imported + batch.failed
      || batch.items.length > MAX_IMPORT_RESULT_ITEMS) {
      return false;
    }
    let completed = 0;
    for (const item of batch.items) {
      if (item === null || typeof item.fileName !== 'string' || item.fileName.trim().length === 0
        || (item.state !== 'success' && item.state !== 'failed')) {
        return false;
      }
      if (item.state === 'success') {
        completed += 1;
      }
    }
    return completed === batch.imported;
  }

  private isNonNegativeInteger(value: number): boolean {
    return Number.isSafeInteger(value) && value >= 0;
  }
}
