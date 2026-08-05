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
import { BookshelfEmptyPage } from '../features/bookshelf/BookshelfEmptyPage';
import { LocalBookDetail } from '../features/bookshelf/LocalBookDetail';
import {
  LocalImportDialog,
  type LocalImportDialogState,
} from '../features/bookshelf/LocalImportDialog';
import type {
  LocalImportBatch,
} from '../features/bookshelf/LocalBookImportGateway';
import {
  LocalReadingExperience,
  type LocalReadingCommit,
} from '../features/reading/LocalReadingExperience';
import { ReaderFullDirectory } from '../features/reading/ReaderFullDirectory';
import {
  LocalReadingFlowGateway,
  type LocalReadingTocEntry,
} from '../features/reading/LocalReadingFlowGateway';
import {
  SearchGateway,
  type SearchBook,
  type SearchHistory,
  type SearchOutcome,
  type SearchSource,
} from '../features/search/SearchGateway';
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
  RssPage,
  type RssPresentation,
} from '../features/rss/RssPage';
import { SettingsPage, type SettingsSnapshot } from '../features/settings/SettingsPage';
import { SettingsGateway } from '../features/settings/SettingsGateway';
import {
  SourceGateway,
  type BookSource,
} from '../features/source/SourceGateway';
import { SourceManagementPage } from '../features/source/SourceManagementPage';
import { SyncPage } from '../features/sync/SyncPage';
import {
  type SyncBackupResult,
  type SyncHistoryEntry,
  type SyncSnapshot,
  type SyncTestResult,
  SyncGateway,
} from '../features/sync/SyncGateway';
import { hilog } from '@kit.PerformanceAnalysisKit';
import deviceInfo from '@ohos.deviceInfo';

const DOMAIN = 0x5244;
const IMPORT_PRESENTATION_KEY = 'reader.bookshelf.import.presentation.v1';
const MAX_IMPORT_RESULT_ITEMS = 50;
const LOCAL_SOURCE_ID = 'local';

type ReaderRoute = 'bookshelf' | 'detail' | 'reading' | 'directory' | 'search' | 'rss' | 'settings' | 'source' | 'sync';
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
  private settingsGateway: SettingsGateway | undefined;
  private syncGateway: SyncGateway | undefined;
  /**
   * Keeps the single reader instance mounted behind Local Book Detail while
   * it measures and persists its first real page.  The Figma ReadingSurface
   * becomes visible only through the admitted 0ms static route once ready.
   */
  @State private readingSessionActive: boolean = false;
  private navigationGeneration: number = 0;
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
    const owner = ReaderRuntimeOwner.current();
    owner.start()
      .then((): Promise<BookshelfDataState> => {
        const gateway = new BookshelfFlowGateway(owner);
        return gateway.load();
      })
      .then((state: BookshelfDataState): void => {
        this.applyBookshelfState(state);
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Bookshelf state failed to load: %{public}s', error.message);
        // Error presentation is intentionally paused with B-IMPORT-01 until
        // the corresponding Figma state is supplied.
      });
  }

  onBackPress(): boolean {
    if (this.route === 'search' || this.route === 'rss' || this.route === 'settings') {
      this.returnToBookshelf();
      return true;
    }
    if (this.route === 'source' || this.route === 'sync') {
      this.returnToSettings();
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
    if (this.route === 'directory') {
      // The Figma Full Directory back target is Reader Control Home. That
      // visual target has not been admitted locally yet, so the visible
      // control stays fail-closed; only the system Back path returns to its
      // real local entry point without creating an unsourced page.
      this.returnToDetail();
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
        });
      } else if (this.route === 'settings') {
        SettingsPage({
          snapshot: this.settingsSnapshot,
          isTablet: deviceInfo.deviceType === 'tablet',
          onBack: (): void => this.returnToBookshelf(),
          onOpenSourceManagement: (): void => this.openSourceManagement(),
          onOpenSync: (): void => this.openSync(),
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
      // This stable nested layer prevents the reader component from being
      // remounted when the Detail sibling is replaced by ReadingSurface.
      // Opacity 0 still receives the true viewport/layout pass; `Visibility`
      // would make the TextController metrics unavailable.
      Stack({ alignContent: Alignment.TopStart }) {
        if (this.readingSessionActive && this.detailBook !== undefined) {
          LocalReadingExperience({
            bookId: this.detailBook.bookId,
            requestedChapterIndex: this.requestedChapterIndex,
            isTablet: deviceInfo.deviceType === 'tablet',
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
            onReadingReady: (): void => this.presentPreparedReading(),
            onReadingCommitted: (commit: LocalReadingCommit): void => this.applyReadingCommit(commit),
            onChapterMaterialized: (chapterIndex: number, chapterTitle: string): void => {
              this.applyDirectoryChapter(chapterIndex, chapterTitle);
            },
          })
            .width('100%')
            .height('100%')
            .opacity(this.route === 'reading' || this.route === 'directory' ? 1 : 0);
        }
      }
      .width('100%')
      .height('100%')
      // A transparent lifecycle container must never become an invisible
      // input shield over Bookshelf or Local Book Detail.
      .hitTestBehavior(HitTestMode.Transparent);
      if (this.route === 'directory' && this.detailBook !== undefined) {
        ReaderFullDirectory({
          bookTitle: this.detailBook.title,
          chapterTitle: this.directoryChapterTitle,
          entries: this.detailToc,
          currentChapterIndex: this.directoryCurrentChapterIndex,
          isTablet: deviceInfo.deviceType === 'tablet',
          onSelectChapter: (chapterIndex: number): void => this.onDirectoryChapterSelected(chapterIndex),
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
  }

  private openRss(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.rssPresentation = this.feedPresentation([], []);
    this.route = 'rss';
    this.refreshRss();
  }

  private openSettings(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.route = 'settings';
    this.loadSettings();
  }

  private loadSettings(): void {
    const gateway = this.getSettingsGateway();
    gateway.load()
      .then((snapshot: SettingsSnapshot): void => {
        this.settingsSnapshot = snapshot;
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Settings load failed: %{public}s', error.message);
      });
  }

  private onSettingToggled(
    key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
    value: boolean,
  ): void {
    // Optimistic in-page update; persist asynchronously to the Host
    // preferences store (app-level settings, not Core-owned).
    this.settingsSnapshot = this.withSetting(key, value);
    const gateway = this.getSettingsGateway();
    gateway.update(this.settingsSnapshot)
      .then((snapshot: SettingsSnapshot): void => {
        this.settingsSnapshot = snapshot;
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Settings update failed: %{public}s', error.message);
      });
  }

  private getSettingsGateway(): SettingsGateway {
    if (this.settingsGateway === undefined) {
      this.settingsGateway = new SettingsGateway(ReaderRuntimeOwner.current().getUIAbilityContext());
    }
    return this.settingsGateway;
  }

  private withSetting(
    key: 'autoCheckUpdate' | 'tapBottomScrollTop' | 'reduceMotion' | 'crashLog',
    value: boolean,
  ): SettingsSnapshot {
    return {
      autoCheckUpdate: key === 'autoCheckUpdate' ? value : this.settingsSnapshot.autoCheckUpdate,
      tapBottomScrollTop: key === 'tapBottomScrollTop' ? value : this.settingsSnapshot.tapBottomScrollTop,
      reduceMotion: key === 'reduceMotion' ? value : this.settingsSnapshot.reduceMotion,
      crashLog: key === 'crashLog' ? value : this.settingsSnapshot.crashLog,
    };
  }

  private withHistoryEntry(entry: SyncHistoryEntry): SyncSnapshot {
    return {
      webdavUrl: this.syncSnapshot.webdavUrl,
      webdavUser: this.syncSnapshot.webdavUser,
      webdavPass: this.syncSnapshot.webdavPass,
      saveLocation: this.syncSnapshot.saveLocation,
      backupFrequency: this.syncSnapshot.backupFrequency,
      backupScope: this.syncSnapshot.backupScope,
      history: [entry].concat(this.syncSnapshot.history),
    };
  }

  private getSyncGateway(): SyncGateway {
    if (this.syncGateway === undefined) {
      this.syncGateway = new SyncGateway();
    }
    return this.syncGateway;
  }

  private onSyncTestConnection(url: string, user: string, pass: string): void {
    const gateway = this.getSyncGateway();
    gateway.planWebdav(url, user, pass)
      .then((outcome: SyncTestResult): void => {
        if (outcome.ok) {
          // Honest: the PROPFIND plan was built (with auth when supplied),
          // but no network executed.
          hilog.info(DOMAIN, 'Reader', '%{public}s', outcome.note ?? 'webdav plan built');
        } else {
          hilog.warn(DOMAIN, 'Reader', 'sync.webdav.plan failed: %{public}s', outcome.error);
        }
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'sync.webdav.plan error: %{public}s', error.message);
      });
  }

  private onSyncTriggerBackup(): void {
    const gateway = this.getSyncGateway();
    gateway.triggerBackup()
      .then((outcome: SyncBackupResult): void => {
        if (outcome.ok) {
          const entry: SyncHistoryEntry = {
            timestamp: this.formatNow(),
            destination: this.syncSnapshot.saveLocation,
            size: outcome.size ?? 0,
            ok: true,
          };
          this.syncSnapshot = this.withHistoryEntry(entry);
        } else {
          hilog.warn(DOMAIN, 'Reader', 'sync.backup failed: %{public}s', outcome.error);
        }
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'sync.backup error: %{public}s', error.message);
      });
  }

  private formatNow(): string {
    const d = new Date();
    const pad = (n: number): string => n < 10 ? `0${n}` : `${n}`;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private openSourceManagement(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.sourceSources = [];
    this.route = 'source';
    const gateway = new SourceGateway(ReaderRuntimeOwner.current());
    gateway.loadSources()
      .then((sources: BookSource[]): void => {
        this.sourceSources = sources;
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Source management load failed: %{public}s', error.message);
        this.sourceSources = [];
      });
  }

  private returnToSettings(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.route = 'settings';
  }

  private onSourceToggled(id: string, enabled: boolean): void {
    // SS-SOURCE-TOGGLE-01: Core has no `source.update`, so this toggle cannot
    // persist. Do NOT leave an optimistic visual state the user would read as
    // persisted — the row stays unchanged and the gap is logged.
    hilog.warn(DOMAIN, 'Reader',
      'SS-SOURCE-TOGGLE-01: source enable/disable is not persistent (no source.update command); sourceId=%{public}s -> enabled=%{public}s',
      id, enabled);
  }

  private openSync(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.route = 'sync';
  }

  private refreshRss(): void {
    const gateway = new RssGateway(ReaderRuntimeOwner.current());
    gateway.loadSubscriptions()
      .then((subscriptions: RssSubscription[]): Promise<RssItem[]> => {
        this.rssPresentation = this.refreshingPresentation(subscriptions);
        const primary = subscriptions.find((sub) => sub.enabled);
        if (primary === undefined) {
          return Promise.resolve([]);
        }
        // `rss.subscription.refresh` is a real Core call; it will fail in
        // this slice because the Host doesn't register `http.execute`.
        // We log the outcome (ok/error) and continue with cached items.
        return gateway.refreshSubscription(primary.subscriptionId)
          .then((): Promise<RssItem[]> => gateway.loadRecentUnread(subscriptions));
      })
      .then((recentUnread: RssItem[]): void => {
        const current = this.rssPresentation;
        if (current.kind !== 'refreshing') {
          return;
        }
        if (current.subscriptions.length === 0 && recentUnread.length === 0) {
          this.rssPresentation = this.emptyPresentation();
          return;
        }
        this.rssPresentation = this.feedPresentation(current.subscriptions, recentUnread);
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'RSS refresh failed: %{public}s', error.message);
        this.rssPresentation = this.errorPresentation([]);
      });
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

  private feedPresentation(subscriptions: RssSubscription[], recentUnread: RssItem[]): RssPresentation {
    const presentation: RssPresentation = { kind: 'feed', subscriptions: subscriptions, recentUnread: recentUnread };
    return presentation;
  }

  private refreshingPresentation(subscriptions: RssSubscription[]): RssPresentation {
    const presentation: RssPresentation = { kind: 'refreshing', subscriptions: subscriptions, recentUnread: [] };
    return presentation;
  }

  private emptyPresentation(): RssPresentation {
    const presentation: RssPresentation = { kind: 'empty' };
    return presentation;
  }

  private errorPresentation(failedSources: string[]): RssPresentation {
    const presentation: RssPresentation = { kind: 'error', failedSources: failedSources };
    return presentation;
  }

  private openSearch(): void {
    this.nextNavigationGeneration();
    this.readingSessionActive = false;
    this.readingExitRequest = undefined;
    this.exitToBookshelfAfterReader = false;
    this.searchPresentation = this.searchInitialPresentation([]);
    this.searchSources = [];
    this.route = 'search';
    const gateway = new SearchGateway(ReaderRuntimeOwner.current());
    Promise.all([
      gateway.loadHistory(),
      gateway.loadSources(),
    ])
      .then((loaded): void => {
        const history = loaded[0];
        const sources = loaded[1];
        this.searchSources = sources;
        this.searchPresentation = this.searchInitialPresentation(history.keywords);
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Search initial state failed to load: %{public}s', error.message);
        // An unavailable Search history is not a search failure; keep the
        // initial surface with an empty history rather than inventing one.
        this.searchSources = [];
        this.searchPresentation = this.searchInitialPresentation([]);
      });
  }

  private performSearch(keyword: string): void {
    if (keyword.trim().length === 0) {
      return;
    }
    this.nextNavigationGeneration();
    this.searchPresentation = this.searchLoadingPresentation(keyword);
    const gateway = new SearchGateway(ReaderRuntimeOwner.current());
    gateway.addHistory(keyword)
      .then((): Promise<SearchOutcome> => {
        // Try book.search against the first enabled source. The Core call
        // emits an `http.execute` host request which the current Host
        // cannot serve; the call returns an error and we fall back to the
        // cached `search-book.list` so the UI still shows cached results
        // rather than a hard failure.
        const enabled = this.searchSources.filter((source) => source.name.length > 0);
        const primary = enabled.length > 0 ? enabled[0] : undefined;
        if (primary === undefined) {
          return Promise.resolve(this.searchOutcomeFailure('no enabled source'));
        }
        return gateway.searchBySource(primary.name, keyword);
      })
      .then((outcome: SearchOutcome): Promise<SearchBook[]> => {
        if (outcome.ok && outcome.results.length > 0) {
          return Promise.resolve(outcome.results);
        }
        return gateway.loadSearchBooks();
      })
      .then((books: SearchBook[]): void => {
        if (books.length === 0) {
          this.searchPresentation = this.searchEmptyPresentation(keyword);
          return;
        }
        this.searchPresentation = this.searchResultsPresentation(keyword, books);
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Search failed: %{public}s', error.message);
        this.searchPresentation = this.searchErrorPresentation(keyword);
      });
  }

  private retrySearch(): void {
    if (this.searchPresentation.kind === 'empty' || this.searchPresentation.kind === 'error') {
      this.performSearch(this.searchPresentation.keyword);
    }
  }

  private clearSearchHistory(): void {
    const gateway = new SearchGateway(ReaderRuntimeOwner.current());
    gateway.clearHistory()
      .then((): Promise<SearchHistory> => gateway.loadHistory())
      .then((history: SearchHistory): void => {
        this.searchPresentation = this.searchInitialPresentation(history.keywords);
      })
      .catch((error: Error): void => {
        hilog.error(DOMAIN, 'Reader', 'Search history clear failed: %{public}s', error.message);
      });
  }

  private searchOutcomeFailure(error: string): SearchOutcome {
    const outcome: SearchOutcome = { ok: false, error: error };
    return outcome;
  }

  private searchInitialPresentation(history: string[]): SearchPresentation {
    const presentation: SearchPresentation = { kind: 'initial', history: history };
    return presentation;
  }

  private searchLoadingPresentation(keyword: string): SearchPresentation {
    const presentation: SearchPresentation = { kind: 'loading', keyword: keyword };
    return presentation;
  }

  private searchResultsPresentation(keyword: string, results: SearchBook[]): SearchPresentation {
    const presentation: SearchPresentation = { kind: 'results', keyword: keyword, results: results };
    return presentation;
  }

  private searchEmptyPresentation(keyword: string): SearchPresentation {
    const presentation: SearchPresentation = { kind: 'empty', keyword: keyword };
    return presentation;
  }

  private searchErrorPresentation(keyword: string): SearchPresentation {
    const presentation: SearchPresentation = { kind: 'error', keyword: keyword };
    return presentation;
  }

  private onSearchResultSelected(book: SearchBook): void {
    // A search result is a remote Core record. There is no admitted remote
    // Book Detail / chapter flow in this slice, so keep the selection inert
    // rather than fabricating a local-lookup route.
    hilog.warn(DOMAIN, 'Reader',
      'FIGMA_VISUAL_GAP: remote search result has no admitted detail flow for bookUrl=%{public}s',
      book.bookUrl);
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
    this.nextNavigationGeneration();
    this.requestedChapterIndex = chapterIndex;
    this.preparedReaderRoute = 'reading';
    this.route = 'reading';
    this.directoryCurrentChapterIndex = -1;
    this.directoryChapterTitle = '';
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

  private presentPreparedReading(): void {
    if (!this.readingSessionActive || this.detailBook === undefined || this.route !== 'detail') {
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
    const gateway = new BookshelfFlowGateway(ReaderRuntimeOwner.current());
    gateway.load()
      .then((state: BookshelfDataState): void => this.applyBookshelfState(state))
      .catch((error: Error): void => {
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
    this.writeImportPresentation(new LocalImportPresentation('importing'));
    const owner = ReaderRuntimeOwner.current();
    const gateway = new BookshelfFlowGateway(owner);
    gateway.importFromSystemPicker()
      .then((outcome): void => {
        if (outcome.batch.state === 'cancelled') {
          this.closeImportDialog();
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
        this.writeImportPresentation(new LocalImportPresentation('fileSelection'));
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
