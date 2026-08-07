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
  LocalReadingCommit,
} from '../features/reading/LocalReadingExperience';
import { ReaderShell } from '../features/shell/ReaderShell';
import {
  LocalReadingFlowGateway,
  type LocalReadingTocEntry,
} from '../features/reading/LocalReadingFlowGateway';
import type {
  SearchBook,
  SearchSource,
} from '../features/search/SearchGateway';
import { SearchOrchestrator } from '../features/search/SearchOrchestrator';
import {
  SearchPage,
  type SearchPresentation,
} from '../features/search/SearchPage';
import type {
  RssItem,
  RssSubscription,
} from '../features/rss/RssGateway';
import {
  RssPage,
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

const DOMAIN = 0x5244;
const IMPORT_PRESENTATION_KEY = 'reader.bookshelf.import.presentation.v1';
const MAX_IMPORT_RESULT_ITEMS = 50;
const LOCAL_SOURCE_ID = 'local';

type ReaderRoute = 'bookshelf' | 'discover' | 'detail' | 'reading' | 'directory' | 'search' | 'rss' | 'settings' | 'source' | 'sync';
type PreparedReaderRoute = 'reading' | 'directory';

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
  @State private detailBook: ShelfBook | undefined = undefined;
  @State private detailToc: LocalReadingTocEntry[] = [];
  @State private requestedChapterIndex: number | undefined = undefined;
  @State private preparedReaderRoute: PreparedReaderRoute = 'reading';
  @State private directoryCurrentChapterIndex: number = -1;
  @State private directoryChapterTitle: string = '';
  @State private searchPresentation: SearchPresentation = { kind: 'initial', history: [] };
  @State private searchSources: SearchSource[] = [];
  @State private rssPresentation: RssPresentation = { kind: 'feed', subscriptions: [], recentUnread: [] };
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
    saveLocation: 'WebDAV',
    backupFrequency: '12小时',
    backupScope: '书架、进度',
    history: [],
  };
  /** Source-switch overlay presentation + the gateway that drives it. */
  @State private sourceSwitchVisible: boolean = false;
  @State private sourceSwitchState: SourceSwitchPanelState = { kind: 'discovering' };
  private sourceSwitchGateway: SourceSwitchGateway | undefined;
  /**
   * Keeps the single reader instance mounted behind Local Book Detail while
   * it measures and persists its first real page.  The Figma ReadingSurface
   * becomes visible only through the admitted 0ms static route once ready.
   */
  @State private readingSessionActive: boolean = false;
  private navigationGeneration: number = 0;
  /** Rejects a late shelf read after a newer import/refresh has completed. */
  private bookshelfLoadGeneration: number = 0;
  private searchOrchestrator: SearchOrchestrator | undefined;
  private settingsOrchestrator: SettingsOrchestrator | undefined;
  private syncOrchestrator: SyncOrchestrator | undefined;
  private sourceOrchestrator: SourceOrchestrator | undefined;
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
    if (this.route === 'search' || this.route === 'rss' || this.route === 'settings') {
      this.returnToBookshelf();
      return true;
    }
    if (this.route === 'source' || this.route === 'sync') {
      this.returnToSettings();
      return true;
    }
    if (this.route === 'reading' || this.route === 'directory') {
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
          onBookSelected: (book: ShelfBook): void => this.openLocalBookDetail(book),
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
          onBack: (): void => this.returnToBookshelf(),
          onRefresh: (): void => this.refreshRss(),
          onManage: (): void => this.onRssManage(),
          onSelectSubscription: (_id: string): void => this.onRssSubscriptionSelected(),
          onSelectItem: (_guid: string): void => this.onRssItemSelected(),
          onSettingsRequested: (): void => this.openSettings(),
          onDiscoverRequested: (): void => this.openDiscover(),
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
        });
      } else if (this.route === 'source') {
        SourceManagementPage({
          sources: this.sourceSources,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnToSettings(),
          onToggleSource: (id: string, enabled: boolean): void => this.onSourceToggled(id, enabled),
        });
      } else if (this.route === 'sync') {
        SyncPage({
          snapshot: this.syncSnapshot,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnToSettings(),
          onTestConnection: (url: string, user: string, pass: string): void => this.onSyncTestConnection(url, user, pass),
          onTriggerBackup: (): void => this.onSyncTriggerBackup(),
        });
      } else if (this.route === 'detail' && this.detailBook !== undefined) {
        LocalBookDetail({
          book: this.detailBook,
          toc: this.detailToc,
          isTablet: deviceInfo.deviceType === 'tablet',
          onContinue: (): void => this.openLocalReading(undefined),
          onSelectChapter: (chapterIndex: number): void => this.openLocalReading(chapterIndex),
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
          sourceName: this.detailBook.sourceId,
          totalChapters: this.detailToc.length,
          requestedChapterIndex: this.requestedChapterIndex,
          isTablet: deviceInfo.deviceType === 'tablet',
          route: this.preparedReaderRoute,
          tocEntries: this.detailToc,
          directoryCurrentChapterIndex: this.directoryCurrentChapterIndex,
          directoryChapterTitle: this.directoryChapterTitle,
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
          onReadingCommitted: (commit: LocalReadingCommit): void => this.applyReadingCommit(commit),
          onChapterCommitted: (chapterIndex: number, chapterTitle: string): void => {
            this.applyDirectoryChapter(chapterIndex, chapterTitle);
          },
          onSelectChapter: (chapterIndex: number): void => this.onDirectoryChapterSelected(chapterIndex),
          onCloseDirectory: (): void => this.closeDirectory(),
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
    }
      .width('100%')
      .height('100%')
      .backgroundColor($r('app.color.reader_surface'))
      // 顶部: padding 状态栏高, 内容避让状态栏不上移; 底部: 内容延伸到手势条(沉浸式底部,不留安全区空白)。
      .padding({ top: px2vp(this.statusBarHeightPx) })
      .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.BOTTOM])
  }

  private openRss(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.rssPresentation = this.feedPresentation([], []);
    this.route = 'rss';
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

  private onSyncTestConnection(url: string, user: string, pass: string): void {
    this.getSyncOrchestrator().testConnection(url, user, pass);
  }

  private onSyncTriggerBackup(): void {
    this.getSyncOrchestrator().triggerBackup();
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

  private openSync(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.route = 'sync';
  }

  private refreshRss(): void {
    // The registered Figma boundary keeps RSS as a placeholder-only page.
    // Do not start a real rss.subscription.refresh transaction and then label
    // its stale/cache outcome as a user-visible refresh.
    hilog.warn(DOMAIN, 'Reader', 'FIGMA_VISUAL_GAP: RSS refresh is placeholder-only until its admitted flow is supplied');
  }

  private onRssManage(): void {
    hilog.warn(DOMAIN, 'Reader', 'FIGMA_VISUAL_GAP: RSS subscription management has no admitted route');
  }

  private onRssSubscriptionSelected(): void {
    hilog.warn(DOMAIN, 'Reader', 'FIGMA_VISUAL_GAP: RSS source feed detail has no admitted route');
  }

  private onRssItemSelected(): void {
    hilog.warn(DOMAIN, 'Reader', 'FIGMA_VISUAL_GAP: RSS item detail has no admitted route');
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
    // A search result is a remote Core record. There is no admitted remote
    // Book Detail / chapter flow in this slice, so keep the selection inert
    // rather than fabricating a local-lookup route.
    hilog.warn(DOMAIN, 'Reader',
      'FIGMA_VISUAL_GAP: remote search result has no admitted detail flow for sourceId=%{public}s bookId=%{public}s',
      book.sourceId, book.bookId);
  }

  private openLocalBookDetail(selection: ShelfBook): void {
    if (selection.sourceId !== LOCAL_SOURCE_ID) {
      // The only admitted Detail contract in this slice is the Local Book
      // variant. Do not reinterpret a remote shelf record as local data.
      hilog.warn(DOMAIN, 'Reader',
        'FIGMA_VISUAL_GAP: no admitted remote Book Detail state for sourceId=%{public}s', selection.sourceId);
      return;
    }
    const generation = this.nextNavigationGeneration();
    this.readingSessionActive = false;
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
        this.detailBook = book;
        this.detailToc = toc.entries;
        this.requestedChapterIndex = undefined;
        this.preparedReaderRoute = 'reading';
        this.directoryCurrentChapterIndex = -1;
        this.directoryChapterTitle = '';
        this.route = 'detail';
      })
      .catch((error: Error): void => {
        if (generation !== this.navigationGeneration) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Local Book Detail state failed to load: %{public}s', error.message);
      });
  }

  private openLocalReading(chapterIndex: number | undefined): void {
    const book = this.detailBook;
    if (book === undefined || !this.isKnownDetailChapter(chapterIndex)) {
      return;
    }
    this.nextNavigationGeneration();
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.requestedChapterIndex = chapterIndex;
    this.preparedReaderRoute = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    // Keep the admitted Local Book Detail static state on screen until the
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
    // route changes only from LocalReadingExperience.onReadingReady, so a
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
    // LocalReadingExperience resolves the real persisted chapter itself. The
    // overlay gets that exact identity through onChapterMaterialized rather
    // than choosing a Figma sample chapter or copying Core text into Index.
    this.requestedChapterIndex = undefined;
    this.preparedReaderRoute = 'directory';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
    this.readingSessionActive = true;
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

  // R-LOCAL-TOC-01: 收起 closes the directory overlay the same way system Back
  // does for the directory route: let the reader settle/persist, else return
  // to Detail. Reader Control Home (the eventual collapse target) is not yet
  // delivered (RC-READER-CONTROL-01).
  private closeDirectory(): void {
    const requestExit = this.readingExitRequest;
    if (requestExit !== undefined) {
      requestExit();
    } else {
      this.returnToDetail();
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
    this.readingExitRequest = undefined;
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
    gateway.discoverCandidates(this.detailBook.bookId, this.detailBook.title,
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
          Date.now(),
        );
        return gateway.commitSwitch(params, isCurrent);
      })
      .then((outcome: SourceSwitchCommitOutcome): void => {
        if (!isCurrent()) {
          return;
        }
        if (outcome.status === 'success') {
          this.sourceSwitchState = { kind: 'success' };
          this.performSourceSwitchSeam(outcome.book);
          return;
        }
        this.sourceSwitchState = {
          kind: 'failure',
          message: outcome.error,
          rollbackToken: outcome.rollbackToken,
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
    if (this.sourceSwitchState.kind !== 'failure' || this.sourceSwitchState.rollbackToken === undefined) {
      return;
    }
    const token = this.sourceSwitchState.rollbackToken;
    const generation = this.nextNavigationGeneration();
    this.sourceSwitchState = { kind: 'switching', targetSourceId: '' };
    const gateway = this.getSourceSwitchGateway();
    gateway.rollbackSwitch(token, (): boolean => this.isSourceSwitchActive(generation))
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
        this.sourceSwitchState = { kind: 'failure', message: error.message, rollbackToken: token };
      });
  }

  private closeSourceSwitch(): void {
    if (!this.sourceSwitchVisible) {
      return;
    }
    this.nextNavigationGeneration();
    this.sourceSwitchVisible = false;
    this.sourceSwitchState = { kind: 'discovering' };
  }

  private performSourceSwitchSeam(book: ShelfBook): void {
    this.sourceSwitchVisible = false;
    this.sourceSwitchState = { kind: 'discovering' };
    this.refreshBookshelf();
    this.reopenSwitchedBook(book);
  }

  private reopenSwitchedBook(book: ShelfBook): void {
    if (book.sourceId === LOCAL_SOURCE_ID) {
      this.openLocalBookDetail(book);
      return;
    }
    // SS-SOURCE-SWITCH-01 seam: the committed book now lives on a remote
    // source, but the reading/detail paths are local-only in this slice.
    // When the online reading path lands, this is the single call site to
    // swap detailBook/detailToc and mount the remote reader. Do not route a
    // remote bookId into LocalReadingExperience — it issues local-book
    // commands against a remote identity.
    hilog.warn(DOMAIN, 'Reader',
      'SS-SOURCE-SWITCH-01: committed switch to sourceId=%{public}s bookId=%{public}s; remote reading not yet wired',
      book.sourceId, book.bookId);
    this.returnToBookshelf();
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
    this.route = 'bookshelf';
    this.refreshBookshelf();
  }

  private applyReadingCommit(commit: LocalReadingCommit): void {
    if (commit.bookId.trim().length === 0) {
      return;
    }
    // `reading.progress.update` has completed in LocalReadingExperience. A
    // fresh shelf query is the only source of the Continue Reading state.
    this.refreshBookshelf();
  }

  private applyDirectoryChapter(chapterIndex: number, chapterTitle: string): void {
    if (this.preparedReaderRoute !== 'directory' && this.route !== 'directory') {
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
