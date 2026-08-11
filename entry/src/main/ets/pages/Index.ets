import { ReaderRuntimeOwner } from '../app/ReaderRuntimeOwner';
import {
  ReaderCoreGateway,
  type ShelfBook,
} from '../app/ReaderCoreGateway';
import {
  type BookshelfDataState,
  BookshelfFlowGateway,
} from '../features/bookshelf/BookshelfFlowGateway';
import { BookshelfPage } from '../features/bookshelf/BookshelfPage';
import { DiscoverPage, type DiscoverPresentation } from '../features/discover/DiscoverPage';
import { DiscoverGateway } from '../features/discover/DiscoverGateway';
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
  type LocalReadingTocEntry,
} from '../features/reading/LocalReadingFlowGateway';
import type { ReadingBookDetail } from '../features/reading/ReadingBookDetail';
import {
  RemoteReadingFlowGateway,
  type RemoteReadingBookSeed,
  type RemoteReadingSession,
} from '../features/reading/RemoteReadingFlowGateway';
import { ReadingOfflineGateway } from '../features/reading/ReadingOfflineGateway';
import type { RemoteReadingVariable } from '../features/reading/RemoteReadingContract';
import type {
  ReaderDirectoryChapterStartBookmarkRequest,
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
import {
  SourceGateway,
  type BookSource,
} from '../features/source/SourceGateway';
import { SourceOrchestrator } from '../features/source/SourceOrchestrator';
import {
  buildSourceSwitchCommitParams,
  SourceSwitchGateway,
  type SourceSwitchCandidate,
  type SourceSwitchCommitOutcome,
  type SourceSwitchDiscoveryOutcome,
  type SourceSwitchRollbackResult,
  type SourceSwitchTargetToc,
} from '../features/source/SourceSwitchGateway';
import { SourceManagementPage } from '../features/source/SourceManagementPage';
import type {
  SourceSwitchPanelState,
} from '../features/reading/SourceSwitchPanel';
import { SyncPage } from '../features/sync/SyncPage';
import type { SyncSnapshot } from '../features/sync/SyncGateway';
import { SyncOrchestrator } from '../features/sync/SyncOrchestrator';
import { hilog } from '@kit.PerformanceAnalysisKit';
import deviceInfo from '@ohos.deviceInfo';
import { ArkWebExecutionHost } from '../app/ArkWebExecutionHost';

const DOMAIN = 0x5244;
const IMPORT_PRESENTATION_KEY = 'reader.bookshelf.import.presentation.v1';
const MAX_IMPORT_RESULT_ITEMS = 50;
const LOCAL_SOURCE_ID = 'local';

type ReaderRoute = 'bookshelf' | 'discover' | 'detail' | 'reading' | 'directory' | 'search' |
  'rss' | 'rssSubscriptionManagement' | 'rssSourceFeed' | 'rssEntryDetail' |
  'settings' | 'source' | 'sync';
type PreparedReaderRoute = 'reading' | 'directory';
type DirectoryReturnTarget = 'detail' | 'readerControl';
type RssDetailReturnTarget = 'rss' | 'rssSourceFeed';
type RssSourceFeedReturnTarget = 'rss' | 'rssSubscriptionManagement';

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
  @StorageLink('statusBarHeightPx') statusBarHeightPx: number = 0;
  @State private shelfBooks: ShelfBook[] = [];
  @State private continueReading: ShelfBook | undefined = undefined;
  @State private isBookshelfVisualAdmitted: boolean = false;
  @State private isCoreShelfEmpty: boolean = false;
  @State private route: ReaderRoute = 'bookshelf';
  @State private detailBook: ReadingBookDetail | undefined = undefined;
  @State private detailToc: LocalReadingTocEntry[] = [];
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
  @State private sourceSources: BookSource[] = [];
  @State private discoverPresentation: DiscoverPresentation = { currentSourceName: '', kinds: [], books: [] };
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
  /** Source-switch overlay presentation + the gateway that drives it. */
  @State private sourceSwitchVisible: boolean = false;
  @State private sourceSwitchState: SourceSwitchPanelState = { kind: 'discovering' };
  private sourceSwitchGateway: SourceSwitchGateway | undefined;
  /** Retained until the target chapter's first measured progress commit. */
  private pendingSourceSwitch: PendingSourceSwitchTransaction | undefined = undefined;
  private sourceSwitchRollbackInFlight: boolean = false;
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
  private offlineMutationActiveKey: string = '';
  /** Rejects a late shelf read after a newer import/refresh has completed. */
  private bookshelfLoadGeneration: number = 0;
  private searchOrchestrator: SearchOrchestrator | undefined;
  private settingsOrchestrator: SettingsOrchestrator | undefined;
  private syncOrchestrator: SyncOrchestrator | undefined;
  private sourceOrchestrator: SourceOrchestrator | undefined;
  private rssOrchestrator: RssOrchestrator | undefined;
  /**
   * Installed only by the mounted ReadingSurface.  System Back calls this
   * guarded request so Core position persistence settles before the route is
   * changed back to Local Book Detail.
   */
  private readingExitRequest: (() => void) | undefined = undefined;
  /** A Back press during hidden first-page preparation still exits serially. */
  private exitToBookshelfAfterReader: boolean = false;
  // DocumentViewPicker can rebuild this page while the actual Core import is
  // still in flight. One atomic value lives only in AppStorage: it survives
  // page reconstruction in this process but never enters Core or persistent
  // reader data.
  @StorageLink(IMPORT_PRESENTATION_KEY)
  private storedImportPresentation: string = '';

  aboutToAppear(): void {
    this.reconcileImportPresentation();
    this.refreshBookshelf();
  }

  onBackPress(): boolean {
    if (this.sourceSwitchVisible) {
      // The panel is open while route === 'reading'; it must win over the
      // reader-exit branch so Back only closes the overlay.
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
    if (this.route === 'search' || this.route === 'rss' || this.route === 'settings') {
      this.returnToBookshelf();
      return true;
    }
    if (this.route === 'source' || this.route === 'sync') {
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
          this.exitToBookshelfAfterReader = true;
          requestExit();
        } else {
          this.returnToBookshelf();
        }
        return true;
      }
      this.returnToBookshelf();
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
          isTablet: deviceInfo.deviceType === 'tablet',
          onImportRequested: (): void => this.openImportDialog(),
          onSearchRequested: (): void => this.openSearch(),
          onRssRequested: (): void => this.openRss(),
          onSettingsRequested: (): void => this.openSettings(),
          onDiscoverRequested: (): void => this.openDiscover(),
          onBookSelected: (book: ShelfBook): void => this.openBookDetail(book),
        });
      } else if (this.route === 'bookshelf' && this.isCoreShelfEmpty) {
        // H-NOTE-1: Tablet empty has no Figma Final variant. Until Figma
        // supplies a Tablet-specific empty assembly, mount the Phone
        // BookshelfEmptyPage on Tablet as well (Figma has not yet defined
        // the rule, so we reuse the available Phone assembly rather than
        // leave the Tablet user staring at a blank page).
        BookshelfEmptyPage({
          isTablet: deviceInfo.deviceType === 'tablet',
          onImportRequested: (): void => this.openImportDialog(),
          onSearchRequested: (): void => this.openSearch(),
          onRssRequested: (): void => this.openRss(),
          onSettingsRequested: (): void => this.openSettings(),
          onDiscoverRequested: (): void => this.openDiscover(),
        });
      } else if (this.route === 'search') {
        SearchPage({
          presentation: this.searchPresentation,
          sources: this.searchSources,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnToBookshelf(),
          onSearch: (keyword: string): void => this.performSearch(keyword),
          onClearHistory: (): void => this.clearSearchHistory(),
          onSelectResult: (book: SearchBook): void => this.onSearchResultSelected(book),
          onRetry: (): void => this.retrySearch(),
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
          onToggle: (id: string, enabled: boolean): void =>
            this.getRssOrchestrator().toggleSubscription(id, enabled),
          onViewArticles: (id: string): void => this.onRssManagementViewArticles(id),
          onEditSource: (id: string): void => this.onRssSubscriptionEditRequested(id),
          onRefresh: (id: string): void => this.getRssOrchestrator().refreshSubscription(id),
          onDelete: (id: string): void => this.requestRssSubscriptionDelete(id),
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
        });
      } else if (this.route === 'settings') {
        SettingsPage({
          snapshot: this.settingsSnapshot,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnToBookshelf(),
          onOpenSourceManagement: (): void => this.openSourceManagement(),
          onOpenSync: (): void => this.openSync(),
          onRssRequested: (): void => this.openRss(),
          onDiscoverRequested: (): void => this.openDiscover(),
          onToggle: (key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
            value: boolean): void => this.onSettingToggled(key, value),
          onClearCache: (): Promise<boolean> => this.clearTextCache(),
        });
      } else if (this.route === 'source') {
        SourceManagementPage({
          sources: this.sourceSources,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnToSettings(),
          onToggleSource: (id: string, enabled: boolean): void => this.onSourceToggled(id, enabled),
          onDetectSource: (id: string): void => this.onSourceDetectionRequested(id),
          onLoginSource: (id: string): void => this.onSourceLoginRequested(id),
          onAddSource: (): void => this.onBookSourceImportRequested(),
        });
      } else if (this.route === 'sync') {
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
      } else if (this.route === 'detail' && this.detailBook !== undefined) {
        LocalBookDetail({
          book: this.detailBook,
          toc: this.detailToc,
          isTablet: deviceInfo.deviceType === 'tablet',
          onContinue: (): void => this.openReading(undefined),
          onSelectChapter: (chapterIndex: number): void => this.openReading(chapterIndex),
          onOpenDirectory: (): void => this.openFullDirectory(),
          onBack: (): void => this.returnToBookshelf(),
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
          chapterStartBookmarkCreationEnabled: this.detailBook.sourceId === LOCAL_SOURCE_ID,
          sourceSwitchVisible: this.sourceSwitchVisible,
          sourceSwitchState: this.sourceSwitchState,
          onExitRequestHandler: (requestExit: () => void): void => {
            this.readingExitRequest = requestExit;
          },
          onExit: (): void => {
            this.readingExitRequest = undefined;
            if (this.exitToBookshelfAfterReader) {
              this.exitToBookshelfAfterReader = false;
              this.returnToBookshelf();
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
          onDeleteBookmarks: (bookmarkTimes: number[]): void => this.deleteDirectoryBookmarks(bookmarkTimes),
          onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
            this.createDirectoryChapterStartBookmark(request),
          onCloseDirectory: (): void => this.closeDirectory(),
          onOpenDirectory: (): void => this.openReaderControlDirectory(),
          onSwitchSource: (): void => this.openSourceSwitch(),
          onCloseSourceSwitch: (): void => this.closeSourceSwitch(),
          onRetrySourceSwitch: (): void => this.retrySourceSwitch(),
          onPickSource: (candidate: SourceSwitchCandidate): void => this.onPickSource(candidate),
          onRollbackSourceSwitch: (): void => this.onRollbackSourceSwitch(),
        });
      }
      if (this.route === 'bookshelf' && this.hasVisibleImportDialog()) {
        LocalImportDialog({
          state: this.visibleImportDialogState(),
          batch: this.visibleImportBatch(),
          onSelectFiles: (): void => this.beginImport(),
          onClose: (): void => this.closeImportDialog(),
        });
      }
      // Host capability surface only: mounted for ArkWeb controller lifecycle,
      // never used as the reading-body renderer.
      ArkWebExecutionHost()
    }
      .width('100%')
      .height('100%')
      .backgroundColor($r('app.color.reader_surface'))
      // 顶部: padding 状态栏高, 内容避让状态栏不上移; 阅读路由的顶部 inset 由 ReaderShell
      // 自行管理 (此处置 0 防双 padding), 其余路由仍由根 Stack 避让; 底部: 内容延伸到手势条(沉浸式底部,不留安全区空白)。
      .padding({ top: this.readingSessionActive ? 0 : px2vp(this.statusBarHeightPx) })
      .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
  }

  private openRss(): void {
    const generation = this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
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
      const message = error instanceof Error ? error.message : `${error}`;
      hilog.error(DOMAIN, 'Reader',
        'RSS subscription projection failed: %{public}s', message);
    }
  }

  private openDiscover(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.route = 'discover';
    void this.loadDiscover();
  }

  private async loadDiscover(): Promise<void> {
    const generation = this.navigationGeneration;
    let source: BookSource | undefined;
    try {
      const sources = await new SourceGateway(ReaderRuntimeOwner.current()).loadSources();
      for (const s of sources) {
        if (s.enabled && s.enabledExplore) {
          source = s;
          break;
        }
      }
    } catch (error) {
      source = undefined;
    }
    if (source === undefined) {
      if (this.isCurrentRoute(generation, 'discover')) {
        this.discoverPresentation = { currentSourceName: '', kinds: [], books: [] };
      }
      return;
    }
    const gateway = new DiscoverGateway(ReaderRuntimeOwner.current());
    try {
      const kinds = await gateway.loadExploreKinds(source.sourceId);
      const books = kinds.length > 0 ? await gateway.loadExplore(source.sourceId, kinds[0].url) : [];
      if (this.isCurrentRoute(generation, 'discover')) {
        this.discoverPresentation = { currentSourceName: source.name, kinds, books };
      }
    } catch (error) {
      if (this.isCurrentRoute(generation, 'discover')) {
        this.discoverPresentation = { currentSourceName: source.name, kinds: [], books: [] };
      }
    }
  }

  private openSettings(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.route = 'settings';
    this.getSettingsOrchestrator().open();
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
      const message = error instanceof Error ? error.message : `${error}`;
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
        },
        (): SyncSnapshot => this.syncSnapshot,
      );
    }
    return this.syncOrchestrator;
  }

  private openSourceManagement(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.route = 'source';
    this.getSourceOrchestrator().open();
  }

  private getSourceOrchestrator(): SourceOrchestrator {
    if (this.sourceOrchestrator === undefined) {
      this.sourceOrchestrator = new SourceOrchestrator(
        (sources: BookSource[]): void => {
          this.sourceSources = sources;
        },
        (): boolean => this.route === 'source',
      );
    }
    return this.sourceOrchestrator;
  }

  private returnToSettings(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.route = 'settings';
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

  private onBookSourceImportRequested(): void {
    this.getSourceOrchestrator().importBookSources();
  }

  private openSync(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
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
    // The editor's visual/data contract is not frozen. Fail closed instead of
    // sending a partially inferred `rss.subscription.persist(create)` request.
    hilog.warn(DOMAIN, 'Reader',
      'FIGMA_VISUAL_GAP: RSS subscription add editor is not admitted; intent rejected');
  }

  private onRssSubscriptionEditRequested(subscriptionId: string): void {
    // Keep identity in the intent, but do not infer fields or a route before
    // the editor is visually admitted.
    hilog.warn(DOMAIN, 'Reader',
      'FIGMA_VISUAL_GAP: RSS subscription edit editor is not admitted; intent rejected for subscriptionId=%{public}s',
      subscriptionId);
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
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.route = 'search';
    this.getSearchOrchestrator().open();
  }

  private performSearch(keyword: string): void {
    this.nextNavigationGeneration();
    this.getSearchOrchestrator().search(keyword);
  }

  private getSearchOrchestrator(): SearchOrchestrator {
    if (this.searchOrchestrator === undefined) {
      this.searchOrchestrator = new SearchOrchestrator(
        (presentation: SearchPresentation): void => {
          this.searchPresentation = presentation;
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


  private onSearchResultSelected(book: SearchBook): void {
    this.openRemoteBookDetail({
      sourceId: book.sourceId,
      bookId: book.bookId,
      detailUrl: book.detailUrl,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      intro: book.intro,
      kind: book.kind,
      lastChapter: book.latestChapterTitle,
      searchVariables: book.variables.map((variable): RemoteReadingVariable => ({
        name: variable.name,
        value: variable.value,
      })),
    }, book.sourceName);
  }

  private openBookDetail(selection: ShelfBook): void {
    if (selection.sourceId === LOCAL_SOURCE_ID) {
      this.openLocalBookDetail(selection);
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
    }, selection.sourceId);
  }

  private openLocalBookDetail(selection: ShelfBook): void {
    if (selection.sourceId !== LOCAL_SOURCE_ID) {
      hilog.error(DOMAIN, 'Reader',
        'Local detail dispatcher received remote sourceId=%{public}s', selection.sourceId);
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.remoteReadingSession = undefined;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    const owner = ReaderRuntimeOwner.current();
    const bookshelf = new ReaderCoreGateway(owner);
    const reading = new LocalReadingFlowGateway(owner);
    Promise.all([
      bookshelf.loadShelfBook(selection.sourceId, selection.bookId),
      reading.loadToc(selection.bookId),
    ])
      .then((loaded): void => {
        const book = loaded[0];
        const toc = loaded[1];
        if (generation !== this.navigationGeneration) {
          return;
        }
        if (book === undefined) {
          // The shelf changed after the card was rendered. Re-read only the
          // Core-owned shelf state instead of retaining a UI-side book copy.
          this.refreshBookshelf();
          return;
        }
        if (!this.hasDeclaredCoverUrl(book)) {
          // N-COVER-REMAP-01: Figma NoCover variant `3612:1796` exists.
          // Admit the route and let the detail/result pages use the shared
          // NoCover gradient placeholder. We only log a soft notice.
          hilog.info(DOMAIN, 'Reader',
            'No declared coverUrl for bookId=%{public}s; using NoCover placeholder',
            book.bookId);
        }
        this.detailBook = this.readingDetailForShelf(book);
        this.detailToc = toc.entries;
        this.requestedChapterIndex = undefined;
        this.preparedReaderRoute = 'reading';
        this.directoryCurrentChapterIndex = -1;
        this.directoryChapterTitle = '';
        this.route = 'detail';
        void reading.loadDirectoryProjection(
          book.bookId,
          book.title,
          book.author,
          toc.entries,
          (): boolean => this.detailBook?.sourceId === book.sourceId && this.detailBook?.bookId === book.bookId,
        )
          .then((entries: LocalReadingTocEntry[]): void => {
            if (this.detailBook?.sourceId === book.sourceId && this.detailBook?.bookId === book.bookId) {
              this.detailToc = entries;
            }
          })
          .catch((error: Error): void => {
            if (this.detailBook?.sourceId === book.sourceId && this.detailBook?.bookId === book.bookId) {
              hilog.error(DOMAIN, 'Reader',
                'Directory bookmark/cache projection failed: %{public}s', error.message);
            }
          });
      })
      .catch((error: Error): void => {
        if (generation !== this.navigationGeneration) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Local Book Detail state failed to load: %{public}s', error.message);
      });
  }

  private openRemoteBookDetail(seed: RemoteReadingBookSeed, sourceName: string): void {
    const generation = this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.remoteReadingSession = undefined;
    const owner = ReaderRuntimeOwner.current();
    const gateway = new RemoteReadingFlowGateway(owner);
    const offline = new ReadingOfflineGateway(owner);
    const bookshelf = new ReaderCoreGateway(owner);
    const isCurrent = (): boolean => generation === this.navigationGeneration;
    this.offlineMutationGeneration += 1;
    this.offlineMutationActiveKey = '';
    void gateway.openSession(seed, { isCurrent })
      .catch(async (onlineError: Error): Promise<RemoteReadingSession> => {
        if (!isCurrent()) {
          throw onlineError;
        }
        hilog.warn(DOMAIN, 'Reader',
          'Online detail unavailable; attempting exact cached session: %{public}s', onlineError.message);
        return gateway.openCachedSession(seed, isCurrent);
      })
      .then(async (session: RemoteReadingSession): Promise<void> => {
        if (!isCurrent()) {
          return;
        }
        // The only admitted remote-detail visual is the on-shelf terminal
        // state. Reuse Core's existing composite shelf before that state
        // becomes visible; do not maintain a second UI-side shelf. Existing
        // entries are not needlessly upserted, which preserves their Core-owned
        // lastReadAt/group/sort metadata when reopening from Bookshelf.
        const storedBook = await bookshelf.loadShelfBook(session.identity.sourceId, session.identity.bookId);
        if (!isCurrent()) {
          return;
        }
        if (storedBook === undefined) {
          await bookshelf.upsertBook({
            sourceId: session.identity.sourceId,
            bookId: session.identity.bookId,
            title: session.book.title,
            author: session.book.author,
            coverUrl: session.book.coverUrl,
            intro: session.book.intro,
            kind: session.book.kind,
            lastChapter: session.book.lastChapter,
          });
        }
        if (!isCurrent()) {
          return;
        }
        let admittedSourceName = sourceName.trim();
        if (admittedSourceName.length === 0 || admittedSourceName === session.identity.sourceId) {
          try {
            const sources = await new SourceGateway(owner).loadSources();
            if (!isCurrent()) {
              return;
            }
            for (const source of sources) {
              if (source.sourceId === session.identity.sourceId) {
                admittedSourceName = source.name;
                break;
              }
            }
          } catch (_error) {
            // Source identity is still valid if the optional display-name
            // projection fails; keep the stable id rather than blocking read.
          }
        }
        this.remoteReadingSession = session;
        this.detailBook = {
          sourceId: session.identity.sourceId,
          sourceName: admittedSourceName.length > 0 ? admittedSourceName : session.identity.sourceId,
          bookId: session.identity.bookId,
          title: session.book.title,
          author: session.book.author,
          coverUrl: session.book.coverUrl,
          intro: session.book.intro,
          lastChapter: session.book.lastChapter,
        };
        this.detailToc = session.entries.map((entry): LocalReadingTocEntry => ({
          index: entry.index,
          title: entry.title,
          downloadState: 'unknown',
        }));
        this.requestedChapterIndex = undefined;
        this.preparedReaderRoute = 'reading';
        this.directoryCurrentChapterIndex = -1;
        this.directoryChapterTitle = '';
        this.route = 'detail';
        void offline.loadProjection(session, isCurrent)
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
        }
      })
      .catch((error: Error): void => {
        if (isCurrent()) {
          hilog.error(DOMAIN, 'Reader',
            'Remote Book Detail state failed to load: %{public}s', error.message);
          const pending = this.pendingSourceSwitch;
          if (pending !== undefined && pending.targetSourceId === seed.sourceId &&
            pending.targetBookId === seed.bookId) {
            this.rollbackPendingSourceSwitch(error.message);
          }
        }
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
    this.detailToc = this.detailToc.map((entry: LocalReadingTocEntry): LocalReadingTocEntry =>
      entry.index === chapterIndex ? {
        index: entry.index,
        title: entry.title,
        downloadState: 'queued',
        bookmarks: entry.bookmarks,
      } : entry);
    const isCurrent = (): boolean => generation === this.offlineMutationGeneration &&
      this.remoteReadingSession?.identity.sourceId === session.identity.sourceId &&
      this.remoteReadingSession?.identity.bookId === session.identity.bookId;
    void new ReadingOfflineGateway(ReaderRuntimeOwner.current())
      .prefetchChapter(session, chapterIndex, isCurrent)
      .then((entries: LocalReadingTocEntry[]): void => {
        if (isCurrent()) {
          this.detailToc = entries;
        }
      })
      .catch((error: Error): void => {
        if (isCurrent()) {
          this.detailToc = this.detailToc.map((entry: LocalReadingTocEntry): LocalReadingTocEntry =>
            entry.index === chapterIndex ? {
              index: entry.index,
              title: entry.title,
              downloadState: 'failed',
              bookmarks: entry.bookmarks,
            } : entry);
          hilog.error(DOMAIN, 'Reader', 'Chapter offline download failed: %{public}s', error.message);
        }
      })
      .finally((): void => {
        if (generation === this.offlineMutationGeneration && this.offlineMutationActiveKey === key) {
          this.offlineMutationActiveKey = '';
        }
      });
  }

  private openReading(chapterIndex: number | undefined): void {
    const book = this.detailBook;
    if (book === undefined || !this.isKnownDetailChapter(chapterIndex) ||
      (book.sourceId !== LOCAL_SOURCE_ID && this.remoteReadingSession === undefined)) {
      return;
    }
    this.nextNavigationGeneration();
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
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
    if (this.detailBook === undefined || this.detailToc.length === 0) {
      return;
    }
    this.nextNavigationGeneration();
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
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
    this.exitToBookshelfAfterReader = false;
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
    if (book === undefined || book.sourceId !== LOCAL_SOURCE_ID || bookmarkTimes.length === 0) {
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
    if (book === undefined || book.sourceId !== LOCAL_SOURCE_ID ||
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
      const entries = await gateway.loadDirectoryProjection(
        book.bookId,
        book.title,
        book.author,
        this.detailToc,
        isCurrent,
      );
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
      const entries = await gateway.loadDirectoryProjection(
        book.bookId,
        book.title,
        book.author,
        this.detailToc,
        isCurrent,
      );
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
    this.exitToBookshelfAfterReader = false;
    // SS-SOURCE-SWITCH-01: the window floats over the reading surface (Figma
    // 3572:41345), so close the directory and let the surface be the backdrop.
    this.preparedReaderRoute = 'reading';
    this.route = 'reading';
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
    this.startSourceDiscovery(generation);
  }

  private startSourceDiscovery(generation: number): void {
    if (this.detailBook === undefined) {
      return;
    }
    const gateway = this.getSourceSwitchGateway();
    gateway.discoverCandidates(this.detailBook.sourceId, this.detailBook.bookId, this.detailBook.title,
      (): boolean => this.isSourceSwitchActive(generation))
      .then((outcome: SourceSwitchDiscoveryOutcome): void => {
        if (!this.isSourceSwitchActive(generation)) {
          return;
        }
        if (outcome.kind === 'noSources' || outcome.candidates.length === 0) {
          this.sourceSwitchState = { kind: 'empty' };
          return;
        }
        this.sourceSwitchState = { kind: 'candidates', candidates: outcome.candidates };
      })
      .catch((error: Error): void => {
        if (!this.isSourceSwitchActive(generation)) {
          return;
        }
        // change.bookSource is remote. Any Host transport constraint is
        // surfaced through the admitted discovery failure state.
        hilog.warn(DOMAIN, 'Reader', 'SS-SOURCE-SWITCH-01: candidate discovery failed: %{public}s', error.message);
        this.sourceSwitchState = { kind: 'discoveryError', message: error.message };
      });
  }

  private onPickSource(candidate: SourceSwitchCandidate): void {
    if (this.sourceSwitchState.kind !== 'candidates' || this.detailBook === undefined) {
      return;
    }
    const book = this.detailBook;
    if (candidate.sourceId === book.sourceId) {
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.sourceSwitchState = { kind: 'switching', targetSourceId: candidate.sourceId };
    const gateway = this.getSourceSwitchGateway();
    const isCurrent = (): boolean => this.isSourceSwitchActive(generation);
    gateway.fetchTargetToc(candidate.sourceId, candidate.bookUrl, isCurrent)
      .then((toc: SourceSwitchTargetToc): Promise<SourceSwitchCommitOutcome> => {
        if (!isCurrent()) {
          return Promise.reject(new Error('source switch aborted'));
        }
        const params = buildSourceSwitchCommitParams(
          { sourceId: book.sourceId, bookId: book.bookId },
          candidate,
          toc,
          this.currentSourceSwitchChapterTitle(),
          Math.max(0, this.directoryCurrentChapterIndex),
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
        this.sourceSwitchState = {
          kind: 'failure',
          message: outcome.error,
          transactionId: outcome.transactionId,
        };
      })
      .catch((error: Error): void => {
        if (!isCurrent()) {
          return;
        }
        hilog.warn(DOMAIN, 'Reader', 'SS-SOURCE-SWITCH-01: source switch failed: %{public}s', error.message);
        this.sourceSwitchState = { kind: 'failure', message: error.message };
      });
  }

  private currentSourceSwitchChapterTitle(): string {
    if (this.directoryChapterTitle.length > 0) {
      return this.directoryChapterTitle;
    }
    if (this.detailToc.length === 0) {
      return '';
    }
    const index = Math.max(0, this.directoryCurrentChapterIndex);
    let fallback: string = '';
    for (const entry of this.detailToc) {
      if (entry.index === index) {
        return entry.title;
      }
      if (fallback.length === 0) {
        fallback = entry.title;
      }
    }
    return fallback;
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
    if (pending === undefined || pending.targetSourceId !== sourceId || pending.targetBookId !== bookId) {
      return;
    }
    this.rollbackPendingSourceSwitch(message);
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
    this.openBookDetail(book);
  }

  private returnToBookshelf(): void {
    this.nextNavigationGeneration();
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.readingSessionActive = false;
    this.requestedChapterIndex = undefined;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.detailToc = [];
    this.detailBook = undefined;
    this.remoteReadingSession = undefined;
    this.selectedRssSubscription = undefined;
    this.selectedRssItems = [];
    this.selectedRssItem = undefined;
    this.selectedRssFavoriteState = 'loading';
    this.rssDetailReturnTarget = 'rss';
    this.rssSourceFeedReturnTarget = 'rss';
    this.rssManagementFocusSubscriptionId = '';
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
    // `reading.progress.update` has completed in ReadingExperience. A fresh
    // shelf query is the only source of the Continue Reading state.
    this.refreshBookshelf();
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
      sourceName: book.sourceId,
      bookId: book.bookId,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      intro: book.intro,
      lastChapter: book.lastChapter,
    };
  }

  private applyDirectoryChapter(chapterIndex: number, chapterTitle: string): void {
    if (!this.readingSessionActive || !this.isKnownDetailChapter(chapterIndex)) {
      return;
    }
    this.directoryCurrentChapterIndex = chapterIndex;
    this.directoryChapterTitle = chapterTitle;
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
        this.applyBookshelfState(state);
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

  private applyBookshelfState(state: BookshelfDataState): void {
    this.isCoreShelfEmpty = state.kind === 'empty';
    if (state.kind !== 'populated') {
      this.isBookshelfVisualAdmitted = false;
      return;
    }
    // N-COVER-REMAP-01: Figma `Library/BookCover` `3612:1796` supplies a
    // `Book=NoCover` variant, so a Core book without a coverUrl is no longer
    // a missing visual. Re-admit no-cover books and let the detail/result
    // pages use the shared NoCover gradient placeholder rather than
    // silently dropping the entire shelf.
    this.shelfBooks = state.shelf.books;
    this.continueReading = state.continueReading;
    this.isBookshelfVisualAdmitted = true;
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
      const message = error instanceof Error ? error.message : `${error}`;
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
