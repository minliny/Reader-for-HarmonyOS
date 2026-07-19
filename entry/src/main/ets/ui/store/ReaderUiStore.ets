// ReaderUiStore — AppStorage bridge over the reducer.
// Holds the canonical UiState; on dispatch, reduces and writes primitive fields to
// AppStorage so any component can subscribe via @StorageProp / @StorageLink.
import { ReaderUiState, UiEvent, SearchResultEntry, BookDetail, ReplaceRule, CoreSourceEntry, CoreSourceCheckResult, CoreSourceDebugResult, CoreContentSearchResult, CoreBookmark, CoreDiscoverKind, CoreDiscoverBook, CoreBookshelfBook, CoreBookGroup, CoreRssSubscription, CoreRssItem, ChapterTocEntry, CoreStorageBackupInfo, CoreReaderCanonicalLocation, ReaderContentIdentity, RouteEntry, Overlay } from './ReaderUiState';
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderReducer } from './ReaderReducer';
import { DemoUiState } from '../fixtures/DemoUiState';
import { ReaderThemeState } from '../tokens/ReaderThemeState';
import { ReaderEffects } from './ReaderEffects';
import type { ReaderUIBookOpenLayout, ReaderUIJSONPayload, ReaderUIPageLayout, ReaderUIState } from 'reader_ui_runtime';
import {
  ReaderUIBookOpenPilotResult,
  ReaderUIImportPilotResult,
  ReaderUIPlaybackPilotResult,
  ReaderUIReplaceRulePilotResult,
  ReaderUIRssPilotResult,
  ReaderUISyncPilotResult,
  ReaderUISourceSwitchPilotResult,
  ReaderUIDirectoryPilotResult,
  ReaderUIRuntimeDriver,
  ReaderUIRuntimeShadowCoordinator,
  ReaderUIRuntimeShadowSnapshot,
} from './ReaderUIRuntimeShadowCoordinator';
import { ReaderDirectoryPilotProjection } from './ReaderDirectoryPilotProjection';
import { ReaderBookOpenPilotProjection } from './ReaderBookOpenPilotProjection';
import {
  ReaderBookOpenCoreGateway,
  ReaderBookOpenPilotHost,
  ReaderBookOpenPilotSnapshot,
} from './ReaderBookOpenPilot';
import {
  ReaderPlaybackCoreGateway,
  ReaderPlaybackPilotHost,
  ReaderPlaybackPilotSnapshot,
  ReaderPlaybackPlatformGateway,
} from './ReaderPlaybackPilot';
import {
  ReaderImportCoreGateway,
  ReaderImportPilotHost,
  ReaderImportPilotSnapshot,
} from './ReaderImportPilotExecutor';
import {
  ReaderSourceSwitchCoreGateway,
  ReaderSourceSwitchPilotHost,
  ReaderSourceSwitchPilotSnapshot,
} from './ReaderSourceSwitchPilotExecutor';
import {
  ReaderReplaceRuleCoreGateway,
  ReaderReplaceRulePilotHost,
  ReaderReplaceRulePilotSnapshot,
} from './ReaderReplaceRulePilotExecutor';
import {
  ReaderRssPilotEffectExecutor,
  ReaderRssPilotHost,
  ReaderRssPilotSnapshot,
} from './ReaderRssPilotExecutor';
import {
  ReaderSyncExperimentalGateway,
  ReaderSyncPilotHost,
  ReaderSyncPilotSnapshot,
} from './ReaderSyncPilotExecutor';
import { ReaderPlaybackQueueSnapshot } from './ReaderPlaybackDomainMapper';
import { ReaderPlaybackPilotProjection } from './ReaderPlaybackPilotProjection';
import {
  ReaderControlCandidateAdapter,
  ReaderControlCandidateResult,
  ReaderControlCandidateRuntimeFactory,
} from './ReaderControlCandidateAdapter';

// ArkTS does not permit structural object literals for interface values. Keep
// the Store callbacks in a nominal class so the executor receives one stable
// host projection object for its whole correlation lifetime.
class ReaderBookOpenStoreHost implements ReaderBookOpenPilotHost {
  private readonly nativeStateReader: () => ReaderUiState;
  private readonly runtimeStateWriter: (runtime: ReaderUIState) => void;
  private readonly domainEventWriter: (event: UiEvent) => void;

  constructor(nativeStateReader: () => ReaderUiState,
    runtimeStateWriter: (runtime: ReaderUIState) => void,
    domainEventWriter: (event: UiEvent) => void) {
    this.nativeStateReader = nativeStateReader;
    this.runtimeStateWriter = runtimeStateWriter;
    this.domainEventWriter = domainEventWriter;
  }

  nativeState(): ReaderUiState {
    return this.nativeStateReader();
  }

  applyRuntimeState(runtimeState: ReaderUIState): void {
    this.runtimeStateWriter(runtimeState);
  }

  applyDomainEvent(event: UiEvent): void {
    this.domainEventWriter(event);
  }
}

class ReaderPlaybackStoreHost implements ReaderPlaybackPilotHost {
  private readonly nativeStateReader: () => ReaderUiState;
  private readonly runtimeStateWriter: (runtime: ReaderUIState) => void;
  private readonly locationWriter: (location: CoreReaderCanonicalLocation, pageIndex: number) => void;
  private readonly queueWriter: (snapshot: ReaderPlaybackQueueSnapshot) => void;

  constructor(nativeStateReader: () => ReaderUiState,
    runtimeStateWriter: (runtime: ReaderUIState) => void,
    locationWriter: (location: CoreReaderCanonicalLocation, pageIndex: number) => void,
    queueWriter: (snapshot: ReaderPlaybackQueueSnapshot) => void) {
    this.nativeStateReader = nativeStateReader;
    this.runtimeStateWriter = runtimeStateWriter;
    this.locationWriter = locationWriter;
    this.queueWriter = queueWriter;
  }

  nativeState(): ReaderUiState { return this.nativeStateReader(); }
  applyRuntimeState(runtimeState: ReaderUIState): void { this.runtimeStateWriter(runtimeState); }
  commitCanonicalLocation(location: CoreReaderCanonicalLocation, pageIndex: number): void {
    this.locationWriter(location, pageIndex);
  }
  applyQueueSnapshot(snapshot: ReaderPlaybackQueueSnapshot): void { this.queueWriter(snapshot); }
}

class ReaderImportStoreHost implements ReaderImportPilotHost {
  private readonly nativeStateReader: () => ReaderUiState;
  private readonly runtimeStateWriter: (runtime: ReaderUIState) => void;
  private readonly domainEventWriter: (event: UiEvent) => void;

  constructor(nativeStateReader: () => ReaderUiState,
    runtimeStateWriter: (runtime: ReaderUIState) => void,
    domainEventWriter: (event: UiEvent) => void) {
    this.nativeStateReader = nativeStateReader;
    this.runtimeStateWriter = runtimeStateWriter;
    this.domainEventWriter = domainEventWriter;
  }

  nativeState(): ReaderUiState { return this.nativeStateReader(); }
  applyRuntimeState(runtimeState: ReaderUIState): void { this.runtimeStateWriter(runtimeState); }
  applyDomainEvent(event: UiEvent): void { this.domainEventWriter(event); }
}

class ReaderSourceSwitchStoreHost implements ReaderSourceSwitchPilotHost {
  private readonly nativeStateReader: () => ReaderUiState;
  private readonly runtimeStateWriter: (runtime: ReaderUIState) => void;
  private readonly domainEventWriter: (event: UiEvent) => void;

  constructor(nativeStateReader: () => ReaderUiState,
    runtimeStateWriter: (runtime: ReaderUIState) => void,
    domainEventWriter: (event: UiEvent) => void) {
    this.nativeStateReader = nativeStateReader;
    this.runtimeStateWriter = runtimeStateWriter;
    this.domainEventWriter = domainEventWriter;
  }

  nativeState(): ReaderUiState { return this.nativeStateReader(); }
  applyRuntimeState(runtimeState: ReaderUIState): void { this.runtimeStateWriter(runtimeState); }
  applyDomainEvent(event: UiEvent): void { this.domainEventWriter(event); }
}

class ReaderReplaceRuleStoreHost implements ReaderReplaceRulePilotHost {
  private readonly nativeStateReader: () => ReaderUiState;
  private readonly runtimeStateWriter: (runtime: ReaderUIState) => void;
  private readonly domainEventWriter: (event: UiEvent) => void;

  constructor(nativeStateReader: () => ReaderUiState,
    runtimeStateWriter: (runtime: ReaderUIState) => void,
    domainEventWriter: (event: UiEvent) => void) {
    this.nativeStateReader = nativeStateReader;
    this.runtimeStateWriter = runtimeStateWriter;
    this.domainEventWriter = domainEventWriter;
  }

  nativeState(): ReaderUiState {
    return this.nativeStateReader();
  }

  applyRuntimeState(runtimeState: ReaderUIState): void {
    this.runtimeStateWriter(runtimeState);
  }

  applyDomainEvent(event: UiEvent): void {
    this.domainEventWriter(event);
  }
}

class ReaderRssStoreHost implements ReaderRssPilotHost {
  private readonly nativeStateReader: () => ReaderUiState;
  private readonly runtimeStateWriter: (runtime: ReaderUIState) => void;
  private readonly domainEventWriter: (event: UiEvent) => void;

  constructor(nativeStateReader: () => ReaderUiState,
    runtimeStateWriter: (runtime: ReaderUIState) => void,
    domainEventWriter: (event: UiEvent) => void) {
    this.nativeStateReader = nativeStateReader;
    this.runtimeStateWriter = runtimeStateWriter;
    this.domainEventWriter = domainEventWriter;
  }

  nativeState(): ReaderUiState {
    return this.nativeStateReader();
  }

  applyRuntimeState(runtimeState: ReaderUIState): void {
    this.runtimeStateWriter(runtimeState);
  }

  applyDomainEvent(event: UiEvent): void {
    this.domainEventWriter(event);
  }
}

class ReaderSyncStoreHost implements ReaderSyncPilotHost {
  private readonly nativeStateReader: () => ReaderUiState;
  private readonly runtimeStateWriter: (runtime: ReaderUIState) => void;
  private readonly domainEventWriter: (event: UiEvent) => void;

  constructor(nativeStateReader: () => ReaderUiState,
    runtimeStateWriter: (runtime: ReaderUIState) => void,
    domainEventWriter: (event: UiEvent) => void) {
    this.nativeStateReader = nativeStateReader;
    this.runtimeStateWriter = runtimeStateWriter;
    this.domainEventWriter = domainEventWriter;
  }

  nativeState(): ReaderUiState {
    return this.nativeStateReader();
  }

  applyRuntimeState(runtimeState: ReaderUIState): void {
    this.runtimeStateWriter(runtimeState);
  }

  applyDomainEvent(event: UiEvent): void {
    this.domainEventWriter(event);
  }
}

export class ReaderUiStore {
  private static readonly K_ROUTE = 'reader.routeId';
  private static readonly K_TAB = 'reader.tab';
  private static readonly K_OVERLAY = 'reader.overlay';
  private static readonly K_PAGE_STATE = 'reader.pageState';
  private static readonly K_READER_MODE = 'reader.readerMode';
  static readonly K_PAGINATION_MODE: string = 'reader.paginationMode';
  static readonly K_READER_PAGE_INDEX: string = 'reader.pageIndex';
  static readonly K_READER_PAGE_COUNT: string = 'reader.pageCount';
  static readonly K_READER_CHAPTER_OFFSET: string = 'reader.chapterOffset';
  static readonly K_READER_CHAPTER_PROGRESS: string = 'reader.chapterProgress';
  static readonly K_FONT_SIZE: string = 'reader.typography.fontSize';
  static readonly K_LINE_HEIGHT: string = 'reader.typography.lineHeight';
  static readonly K_PARAGRAPH_GAP: string = 'reader.typography.paragraphGap';
  static readonly K_LETTER_SPACING: string = 'reader.typography.letterSpacing';
  static readonly K_FONT_FAMILY: string = 'reader.typography.fontFamily';
  static readonly K_TOP_MARGIN: string = 'reader.pageSpace.topMargin';
  static readonly K_SIDE_MARGIN: string = 'reader.pageSpace.sideMargin';
  static readonly K_PARAGRAPH_INDENT: string = 'reader.pageSpace.paragraphIndent';
  private static readonly K_ACTIVE_SESSION = 'reader.activeSession';
  private static readonly K_LOADING = 'reader.loading';
  private static readonly K_REDUCED_MOTION = 'reader.reducedMotion';
  private static readonly K_ERROR_CODE = 'reader.errorCode';
  private static readonly K_ERROR_MESSAGE = 'reader.errorMessage';
  private static readonly K_RETRYABLE = 'reader.retryable';
  private static readonly K_STACK_DEPTH = 'reader.stackDepth';
  private static readonly K_FIRST_OPEN = 'reader.firstOpenPlayed';
  private static readonly K_LAST_OP = 'reader.lastOp';
  static readonly K_SEARCH_QUERY: string = 'reader.searchQuery';
  static readonly K_SEARCH_RESULTS: string = 'reader.searchResults';
  static readonly K_CURRENT_BOOK: string = 'reader.currentBook';
  static readonly K_CHAPTER_CONTENT: string = 'reader.chapterContent';
  static readonly K_CHAPTER_TOC: string = 'reader.chapterToc';
  static readonly K_CURRENT_CHAPTER_TITLE: string = 'reader.currentChapterTitle';
  static readonly K_CANONICAL_READER_LOCATION: string = 'reader.canonicalLocation';
  static readonly K_ACTIVE_READER_CONTENT_IDENTITY: string = 'reader.activeReaderContentIdentity';
  static readonly K_PLAYBACK_PAGE_CORRELATION: string = 'reader.playbackPilot.pageCorrelation';
  static readonly K_PLAYBACK_PAGE_DIRECTION: string = 'reader.playbackPilot.pageDirection';
  static readonly K_CONTENT_SEARCH_QUERY: string = 'reader.contentSearchQuery';
  static readonly K_CONTENT_SEARCH_RESULTS: string = 'reader.contentSearchResults';
  static readonly K_CONTENT_SEARCH_LOADING: string = 'reader.contentSearchLoading';
  static readonly K_CONTENT_SEARCH_LOADED: string = 'reader.contentSearchLoaded';
  static readonly K_CONTENT_SEARCH_ERROR: string = 'reader.contentSearchError';
  static readonly K_CONTENT_SEARCH_MESSAGE: string = 'reader.contentSearchMessage';
  static readonly K_BOOKMARKS: string = 'reader.bookmarks';
  static readonly K_BOOKMARKS_LOADED: string = 'reader.bookmarksLoaded';
  static readonly K_BOOKMARKS_LOADING: string = 'reader.bookmarksLoading';
  static readonly K_BOOKMARKS_ERROR: string = 'reader.bookmarksError';
  static readonly K_PENDING_BOOKMARK_DELETE_TIME: string = 'reader.pendingBookmarkDeleteTime';
  static readonly K_SEARCH_HISTORY: string = 'reader.searchHistory';
  static readonly K_SEARCH_HISTORY_LOADED: string = 'reader.searchHistoryLoaded';
  static readonly K_SEARCH_HISTORY_LOADING: string = 'reader.searchHistoryLoading';
  static readonly K_SEARCH_HISTORY_ERROR: string = 'reader.searchHistoryError';
  static readonly K_PENDING_SEARCH_HISTORY_CLEAR: string = 'reader.pendingSearchHistoryClear';
  // ── Batch 1 session/TTS/settings keys ──
  private static readonly K_TTS_PLAYBACK = 'reader.ttsSession.playback';
  private static readonly K_TTS_RATE = 'reader.ttsSession.rate';
  private static readonly K_TTS_VOICE = 'reader.ttsSession.voice';
  private static readonly K_TTS_SCOPE = 'reader.ttsSession.scope';
  private static readonly K_TTS_TIMER = 'reader.ttsSession.timer';
  private static readonly K_TTS_CURRENT_SEGMENT = 'reader.ttsSession.currentSegment';
  private static readonly K_TTS_TOTAL_SEGMENTS = 'reader.ttsSession.totalSegments';
  private static readonly K_AUTO_PAGE_PLAYING = 'reader.autoPageSession.playing';
  private static readonly K_AUTO_PAGE_COUNTDOWN = 'reader.autoPageSession.countdownSeconds';
  private static readonly K_AUTO_PAGE_INTERVAL = 'reader.autoPageSession.intervalSeconds';
  private static readonly K_BRIGHTNESS = 'reader.brightness';
  private static readonly K_BRIGHTNESS_AUTO = 'reader.brightnessAuto';
  private static readonly K_READER_HOST_MESSAGE = 'reader.readerHostMessage';
  private static readonly K_TOC_MODE = 'reader.tocMode';
  private static readonly K_TOGGLE_AUTO_PAGE = 'reader.readerToggles.autoPage';
  private static readonly K_TOGGLE_VOLUME_PAGE = 'reader.readerToggles.volumePage';
  private static readonly K_TOGGLE_LANDSCAPE_LOCK = 'reader.readerToggles.landscapeLock';
  private static readonly K_TOGGLE_KEEP_SCREEN_ON = 'reader.readerToggles.keepScreenOn';
  private static readonly K_TOGGLE_STATUS_INFO = 'reader.readerToggles.statusInfo';
  private static readonly K_TOGGLE_HAPTIC = 'reader.readerToggles.hapticFeedback';
  private static readonly K_TOGGLE_CACHE_NEXT = 'reader.readerToggles.cacheNext';
  private static readonly K_TOGGLE_HIDE_STATUS_BAR = 'reader.readerToggles.hideStatusBar';
  private static readonly K_OPT_PAGE_MODE = 'reader.readerSettingOptions.pageMode';
  private static readonly K_OPT_TAP_MODE = 'reader.readerSettingOptions.tapMode';
  private static readonly K_OPT_PAGE_ANIMATION = 'reader.readerSettingOptions.pageAnimation';
  private static readonly K_OPT_PARAGRAPH_INDENT_MODE = 'reader.readerSettingOptions.paragraphIndentMode';
  private static readonly K_OPT_TEXT_CONVERSION = 'reader.readerSettingOptions.textConversion';
  private static readonly K_OPT_TEXT_ALIGNMENT = 'reader.readerSettingOptions.textAlignment';
  private static readonly K_SELECTION_VISIBLE = 'reader.selection.visible';
  private static readonly K_SELECTION_ACTION = 'reader.selection.action';
  private static readonly K_SELECTION_TEXT = 'reader.selection.selectedText';
  // ── Batch 4 bookshelf/discover/source-switch keys ──
  private static readonly K_BOOKSHELF_VIEW = 'reader.bookshelfFilter.view';
  private static readonly K_BOOKSHELF_GROUP = 'reader.bookshelfFilter.group';
  private static readonly K_BOOKSHELF_SORT = 'reader.bookshelfFilter.sort';
  private static readonly K_BOOKSHELF_FILTERS = 'reader.bookshelfFilter.filters';
  private static readonly K_DISCOVER_FILTERS = 'reader.discoverFilter.filters';
  private static readonly K_DISCOVER_SORT = 'reader.discoverFilter.sort';
  private static readonly K_DISCOVER_SOURCES = 'reader.discoverSources';
  private static readonly K_DISCOVER_SOURCE_ID = 'reader.discoverSourceId';
  private static readonly K_DISCOVER_KINDS = 'reader.discoverKinds';
  private static readonly K_DISCOVER_KIND_URL = 'reader.discoverKindUrl';
  private static readonly K_DISCOVER_KIND_TITLE = 'reader.discoverKindTitle';
  private static readonly K_DISCOVER_BOOKS = 'reader.discoverBooks';
  private static readonly K_DISCOVER_LOADING = 'reader.discoverLoading';
  private static readonly K_DISCOVER_LOADED = 'reader.discoverLoaded';
  private static readonly K_DISCOVER_ERROR = 'reader.discoverError';
  private static readonly K_SOURCE_SELECTION = 'reader.sourceSelection';
  private static readonly K_SOURCE_SWITCH_EPOCH = 'reader.sourceSwitchEpoch';
  private static readonly K_AVAILABLE_SOURCES = 'reader.availableSources';
  private static readonly K_SOURCES_LOADED = 'reader.sourcesLoaded';
  private static readonly K_SELECTED_SOURCE_ID = 'reader.selectedSourceId';
  private static readonly K_SOURCE_CHECK_SOURCE_ID = 'reader.sourceCheckSourceId';
  private static readonly K_SOURCE_CHECK_SOURCE_NAME = 'reader.sourceCheckSourceName';
  private static readonly K_SOURCE_CHECK_LOADING = 'reader.sourceCheckLoading';
  private static readonly K_SOURCE_CHECK_LOADED = 'reader.sourceCheckLoaded';
  private static readonly K_SOURCE_CHECK_MESSAGE = 'reader.sourceCheckMessage';
  private static readonly K_SOURCE_CHECK_ERROR = 'reader.sourceCheckError';
  private static readonly K_SOURCE_CHECK_RESULT = 'reader.sourceCheckResult';
  private static readonly K_SOURCE_DEBUG_SOURCE_ID = 'reader.sourceDebugSourceId';
  private static readonly K_SOURCE_DEBUG_SOURCE_NAME = 'reader.sourceDebugSourceName';
  private static readonly K_SOURCE_DEBUG_LOADING = 'reader.sourceDebugLoading';
  private static readonly K_SOURCE_DEBUG_LOADED = 'reader.sourceDebugLoaded';
  private static readonly K_SOURCE_DEBUG_MESSAGE = 'reader.sourceDebugMessage';
  private static readonly K_SOURCE_DEBUG_ERROR = 'reader.sourceDebugError';
  private static readonly K_SOURCE_DEBUG_RESULT = 'reader.sourceDebugResult';
  private static readonly K_BOOKSHELF_BOOKS = 'reader.bookshelfBooks';
  private static readonly K_BOOKSHELF_LOADED = 'reader.bookshelfLoaded';
  private static readonly K_CONTINUE_READING_BOOK = 'reader.continueReadingBook';
  private static readonly K_CONTINUE_READING_LOADED = 'reader.continueReadingLoaded';
  private static readonly K_CONTINUE_READING_ERROR = 'reader.continueReadingError';
  private static readonly K_PENDING_BOOKSHELF_REMOVAL_SOURCE_ID = 'reader.pendingBookshelfRemovalSourceId';
  private static readonly K_PENDING_BOOKSHELF_REMOVAL_BOOK_ID = 'reader.pendingBookshelfRemovalBookId';
  private static readonly K_BOOK_GROUPS = 'reader.bookGroups';
  private static readonly K_BOOK_GROUPS_LOADED = 'reader.bookGroupsLoaded';
  private static readonly K_BOOK_GROUPS_LOADING = 'reader.bookGroupsLoading';
  private static readonly K_BOOK_GROUPS_ERROR = 'reader.bookGroupsError';
  private static readonly K_PENDING_BOOK_GROUP_DELETE_ID = 'reader.pendingBookGroupDeleteId';
  private static readonly K_PENDING_BOOK_GROUP_CLEAR_SOURCE_ID = 'reader.pendingBookGroupClearSourceId';
  private static readonly K_PENDING_BOOK_GROUP_CLEAR_BOOK_ID = 'reader.pendingBookGroupClearBookId';
  private static readonly K_RSS_SUBSCRIPTIONS = 'reader.rssSubscriptions';
  private static readonly K_RSS_ITEMS = 'reader.rssItems';
  private static readonly K_RSS_LOADED = 'reader.rssLoaded';
  private static readonly K_RSS_LOADING = 'reader.rssLoading';
  private static readonly K_RSS_LOAD_ERROR = 'reader.rssLoadError';
  private static readonly K_RSS_ITEM_FILTER = 'reader.rssItemFilter';
  private static readonly K_RSS_REFRESH_STATUS = 'reader.rssRefreshStatus';
  private static readonly K_RSS_REFRESH_MESSAGE = 'reader.rssRefreshMessage';
  private static readonly K_PENDING_RSS_SUBSCRIPTION_DELETE_ID = 'reader.pendingRssSubscriptionDeleteId';
  // ── B1 P0 全局设置 segment/stepper/switch keys ──
  private static readonly K_APP_THEME_MODE = 'reader.appThemeMode';
  private static readonly K_COVER_COLUMNS = 'reader.coverColumns';
  private static readonly K_TOGGLE_AUTO_CHECK_UPDATE = 'reader.settingsToggles.autoCheckUpdate';
  private static readonly K_TOGGLE_TAP_BOTTOM_BAR_TO_TOP = 'reader.settingsToggles.tapBottomBarToTop';
  private static readonly K_TOGGLE_SHOW_UPDATE_BADGE = 'reader.settingsToggles.showUpdateBadge';
  private static readonly K_TOGGLE_MERGE_SAME_BOOKS = 'reader.settingsToggles.mergeSameBooks';
  private static readonly K_TOGGLE_ENABLE_SEARCH_HISTORY = 'reader.settingsToggles.enableSearchHistory';
  private static readonly K_TOGGLE_SHOW_LOCAL_BOOK_BADGE = 'reader.settingsToggles.showLocalBookBadge';
  private static readonly K_SEARCH_HISTORY_LIMIT = 'reader.searchHistoryLimit';
  // ── F3 交互连接 keys ──
  private static readonly K_READER_THEME = 'reader.readerTheme';
  private static readonly K_READER_SETTING_EXPANDED_OPTION = 'reader.readerSettingExpandedOption';
  private static readonly K_AUTO_PAGE_MODE = 'reader.autoPageMode';
  // ── P1.2 select/action 控件展开状态 key ──
  private static readonly K_EXPANDED_OPTION_KEY = 'reader.expandedOptionKey';
  private static readonly K_PENDING_CACHE_CLEAR = 'reader.pendingCacheClear';
  static readonly K_CORE_SLICE10_METHOD: string = 'reader.coreSlice10Method';
  static readonly K_CORE_SLICE10_LOADING: string = 'reader.coreSlice10Loading';
  static readonly K_CORE_SLICE10_RESULT: string = 'reader.coreSlice10Result';
  static readonly K_CORE_SLICE10_ERROR: string = 'reader.coreSlice10Error';
  static readonly K_LAST_UNDO_TOKEN: string = 'reader.lastUndoToken';
  // ── P1.3 WebDAV 配置 keys ──
  private static readonly K_WEBDAV_SERVER_URL = 'reader.webdavServerUrl';
  private static readonly K_WEBDAV_USERNAME = 'reader.webdavUsername';
  private static readonly K_WEBDAV_PASSWORD = 'reader.webdavPassword';
  private static readonly K_WEBDAV_SYNC_DIR = 'reader.webdavSyncDir';
  private static readonly K_WEBDAV_TEST_STATUS = 'reader.webdavTestStatus';
  private static readonly K_WEBDAV_TEST_MESSAGE = 'reader.webdavTestMessage';
  private static readonly K_WEBDAV_SAVE_STATUS = 'reader.webdavSaveStatus';
  private static readonly K_WEBDAV_SAVE_MESSAGE = 'reader.webdavSaveMessage';
  // Portable Core snapshot projection.  Payload bytes stay in the Host file,
  // not in AppStorage, to avoid retaining a duplicate or exposing backup data
  // to unrelated UI components.
  private static readonly K_CORE_BACKUP_STATUS = 'reader.coreBackupStatus';
  private static readonly K_CORE_BACKUP_MESSAGE = 'reader.coreBackupMessage';
  private static readonly K_LOCAL_CORE_BACKUP = 'reader.localCoreBackup';
  private static readonly K_PENDING_CORE_RESTORE = 'reader.pendingCoreRestore';
  private static readonly K_PENDING_CORE_RESTORE_CONFIRMATION_CHECKSUM = 'reader.pendingCoreRestoreConfirmationChecksum';
  // ── W1 本地书导入 / W5 规则替换 keys ──
  private static readonly K_IMPORT_PREVIEW_FORMAT = 'reader.importPreviewFormat';
  private static readonly K_IMPORT_PREVIEW_ENCODING = 'reader.importPreviewEncoding';
  private static readonly K_IMPORT_PREVIEW_COUNT = 'reader.importPreviewCount';
  private static readonly K_LOCAL_IMPORT_EPOCH = 'reader.localImportEpoch';
  static readonly K_SOURCE_IMPORT_ORIGIN = 'reader.sourceImportOrigin';
  static readonly K_SOURCE_IMPORT_TOTAL = 'reader.sourceImportTotal';
  static readonly K_SOURCE_IMPORT_IMPORTED = 'reader.sourceImportImported';
  static readonly K_SOURCE_IMPORT_SKIPPED = 'reader.sourceImportSkipped';
  static readonly K_SOURCE_IMPORT_FAILED = 'reader.sourceImportFailed';
  static readonly K_SOURCE_IMPORT_MESSAGE = 'reader.sourceImportMessage';
  static readonly K_SOURCE_IMPORT_RUNNING = 'reader.sourceImportRunning';
  static readonly K_SOURCE_IMPORT_EPOCH = 'reader.sourceImportEpoch';
  private static readonly K_REPLACE_RULES = 'reader.replaceRules';
  private static readonly K_PENDING_REPLACE_RULE_DELETE_ID = 'reader.pendingReplaceRuleDeleteId';

  private static state: ReaderUiState;
  private static runtimeShadow: ReaderUIRuntimeShadowCoordinator;
  private static readerControlCandidateRuntimeFactoryForTest?: ReaderControlCandidateRuntimeFactory;

  static init(runtime?: ReaderUIRuntimeDriver, bookOpenCore?: ReaderBookOpenCoreGateway,
    playbackCore?: ReaderPlaybackCoreGateway, playbackPlatform?: ReaderPlaybackPlatformGateway,
    importCore?: ReaderImportCoreGateway, sourceSwitchCore?: ReaderSourceSwitchCoreGateway,
    replaceRuleCore?: ReaderReplaceRuleCoreGateway,
    rssCore?: ReaderRssPilotEffectExecutor,
    syncCore?: ReaderSyncExperimentalGateway): void {
    ReaderUiStore.state = DemoUiState.initial();
    ReaderUiStore.readerControlCandidateRuntimeFactoryForTest = undefined;
    ReaderUiStore.runtimeShadow = new ReaderUIRuntimeShadowCoordinator(
      ReaderUiStore.state,
      runtime,
      ReaderUiStore.bookOpenPilotHost(),
      bookOpenCore,
      ReaderUiStore.playbackPilotHost(),
      playbackCore,
      playbackPlatform,
      ReaderUiStore.importPilotHost(),
      importCore,
      ReaderUiStore.sourceSwitchPilotHost(),
      sourceSwitchCore,
      ReaderUiStore.replaceRulePilotHost(),
      replaceRuleCore,
      ReaderUiStore.rssPilotHost(),
      rssCore,
      syncCore === undefined ? undefined : ReaderUiStore.syncPilotHost(),
      syncCore,
    );
    ReaderThemeState.init();
    ReaderUiStore.writeAll();
    AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP, '');
  }

  static dispatch(event: UiEvent): void {
    const bookOpenCancellation: ReaderUIBookOpenPilotResult =
      ReaderUiStore.runtimeShadow.dispatchBookOpenCancellation(event, ReaderUiStore.state);
    if (bookOpenCancellation.handled) {
      ReaderUiStore.writeAll();
      AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP, bookOpenCancellation.canonicalEvent);
      ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
      return;
    }

    const bookOpenPilot: ReaderUIBookOpenPilotResult =
      ReaderUiStore.runtimeShadow.dispatchBookOpenPilot(event, ReaderUiStore.state);
    if (bookOpenPilot.handled) {
      // Once explicitly enabled, book.open is owned by the runtime + its one
      // executor. Never fall through to ReaderReducer/ReaderEffects, even if
      // the Pilot rejects the request, otherwise the old reading chain would
      // run in parallel with the correlation-scoped CoreCommandHandle.
      ReaderUiStore.writeAll();
      AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP,
        bookOpenPilot.canonicalEvent.length > 0 ? bookOpenPilot.canonicalEvent : event.type);
      ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
      return;
    }

    const playbackPilot: ReaderUIPlaybackPilotResult =
      ReaderUiStore.runtimeShadow.dispatchPlaybackPilot(event, ReaderUiStore.state);
    if (playbackPilot.handled) {
      // Pair-enabled playback is fail-closed. The old ReaderReducer and
      // ReaderEffects branches (integer page mutation, setInterval and direct
      // TTS queue calls) must remain at exactly zero for this event.
      ReaderUiStore.writeAll();
      AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP,
        playbackPilot.canonicalEvent.length > 0 ? playbackPilot.canonicalEvent : event.type);
      ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
      return;
    }

    const importPilot: ReaderUIImportPilotResult =
      ReaderUiStore.runtimeShadow.dispatchImportPilot(event, ReaderUiStore.state);
    if (importPilot.handled) {
      // Import is fail-closed. The old ReaderEffects import branches
      // (commitLocalImport, importSourcePackage, etc.) must remain at exactly
      // zero for this event when the Pilot is enabled.
      ReaderUiStore.writeAll();
      AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP,
        importPilot.canonicalEvent.length > 0 ? importPilot.canonicalEvent : event.type);
      ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
      return;
    }

    const sourceSwitchPilot: ReaderUISourceSwitchPilotResult =
      ReaderUiStore.runtimeShadow.dispatchSourceSwitchPilot(event, ReaderUiStore.state);
    if (sourceSwitchPilot.handled) {
      // Source switch is fail-closed. The old ReaderEffects source switch
      // branches (handleSourceSwitchConfirm, cancelSourceSwitchIfActive) must
      // remain at exactly zero for this event when the Pilot is enabled.
      ReaderUiStore.writeAll();
      AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP,
        sourceSwitchPilot.canonicalEvent.length > 0 ? sourceSwitchPilot.canonicalEvent : event.type);
      ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
      return;
    }

    const replaceRulePilot: ReaderUIReplaceRulePilotResult =
      ReaderUiStore.runtimeShadow.dispatchReplaceRulePilot(event, ReaderUiStore.state);
    if (replaceRulePilot.handled) {
      // Replace rules is fail-closed. The old ReaderEffects replace rule
      // branches (handleReplaceRuleAdd, handleReplaceRuleEdit,
      // handleReplaceRuleToggle, deleteConfirmedReplaceRule) must remain at
      // exactly zero for this event when the Pilot is enabled.
      ReaderUiStore.writeAll();
      AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP,
        replaceRulePilot.canonicalEvent.length > 0 ? replaceRulePilot.canonicalEvent : event.type);
      ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
      return;
    }

    const rssPilot: ReaderUIRssPilotResult =
      ReaderUiStore.runtimeShadow.dispatchRssPilot(event, ReaderUiStore.state);
    if (rssPilot.handled) {
      // RSS is fail-closed. The old ReaderEffects RSS branches
      // (markRssItemRead, addRssSubscription, updateRssSubscription,
      // deleteConfirmedRssSubscription, refreshRss) must remain at exactly
      // zero for this event when the Pilot is enabled.
      ReaderUiStore.writeAll();
      AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP,
        rssPilot.canonicalEvent.length > 0 ? rssPilot.canonicalEvent : event.type);
      ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
      return;
    }

    const syncPilot: ReaderUISyncPilotResult =
      ReaderUiStore.runtimeShadow.dispatchSyncPilot(event, ReaderUiStore.state);
    if (syncPilot.handled) {
      // Reachable only in tests that inject a mock Sync gateway and explicitly
      // enable the experiment. Production Sync remains native + Shadow.
      ReaderUiStore.writeAll();
      AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP,
        syncPilot.canonicalEvent.length > 0 ? syncPilot.canonicalEvent : event.type);
      ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
      return;
    }

    const pilot: ReaderUIDirectoryPilotResult =
      ReaderUiStore.runtimeShadow.dispatchDirectoryPilot(event, ReaderUiStore.state);
    if (pilot.handled) {
      // Fail closed: a failed Pilot dispatch does not reach ReaderReducer or
      // ReaderEffects. Projection runs only after a successful runtime change.
      if (pilot.succeeded && pilot.changed) {
        ReaderDirectoryPilotProjection.applyInPlace(
          ReaderUiStore.state,
          pilot.previousOverlay,
          pilot.semanticOverlay,
        );
      }
      if (pilot.succeeded) ReaderUiStore.runtimeShadow.verifyPilotProjection(ReaderUiStore.state);
      ReaderUiStore.writeAll();
      AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP, pilot.canonicalEvent);
      ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
      return;
    }

    const nativeBefore = ReaderUiStore.state;
    ReaderUiStore.state = ReaderReducer.reduce(ReaderUiStore.state, event);
    ReaderUiStore.writeAll();
    // Non-Pilot events retain the existing native owner. Covered non-directory
    // events are observed in shadow; all other events are fallback exactly once.
    ReaderUiStore.runtimeShadow.observe(event, nativeBefore, ReaderUiStore.state);
    // Async effect intercept: search-submit / book-detail-load / chapter-load
    // fire Host HTTP. The synchronous reducer pass already applied loading=true;
    // the effect dispatches success/failure back into the reducer when done.
    ReaderEffects.maybeRun(event);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP, event.type);
    ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
  }

  static snapshot(): ReaderUiState {
    return ReaderUiStore.state;
  }

  /**
   * Explicit local-candidate entry for schema 3 reader control validation.
   *
   * Production dispatch remains bound to the schema 2 consumer lock and never
   * calls this method. The adapter projects into the existing native route
   * stack, so it does not create a second overlay/module authority.
   */
  static setReaderControlCandidateRuntimeFactoryForTest(
    factory?: ReaderControlCandidateRuntimeFactory): void {
    ReaderUiStore.readerControlCandidateRuntimeFactoryForTest = factory;
  }

  static dispatchLocalReaderControlCandidateForTest(event: UiEvent): ReaderControlCandidateResult {
    const result: ReaderControlCandidateResult =
      ReaderControlCandidateAdapter.consume(
        event, ReaderUiStore.state, ReaderUiStore.readerControlCandidateRuntimeFactoryForTest,
      );
    if (!result.handled) return result;
    if (result.succeeded && result.changed) ReaderUiStore.state = result.state;
    ReaderUiStore.writeAll();
    AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP,
      `local-candidate:${result.canonicalEvent}:${result.motionKind}`);
    ReaderThemeState.setReducedMotion(ReaderUiStore.state.reducedMotion);
    return result;
  }

  /**
   * The rendered reader surface is the only owner of a visible character
   * anchor.  Keep it in reducer state first, then let the normal Effects lane
   * serialize the matching Core progress update.  This deliberately rejects
   * page indices and other presentation-only substitutes.
   */
  static reportReadingAnchor(identity: ReaderContentIdentity, chapterOffset: number, chapterProgress: number): void {
    if (!Number.isFinite(chapterOffset) || !Number.isFinite(chapterProgress) ||
      chapterOffset < 0 || chapterProgress < 0 || chapterProgress > 1) {
      return;
    }
    const normalizedOffset = Math.floor(chapterOffset);
    const normalizedProgress = Math.max(0, Math.min(1, chapterProgress));
    const current = ReaderUiStore.state;
    const active = current.activeReaderContentIdentity;
    if (active === null || identity.bookId !== active.bookId || identity.sourceId !== active.sourceId ||
      identity.chapterIndex !== active.chapterIndex) {
      return;
    }
    if (current.readerChapterOffset === normalizedOffset &&
      Math.abs(current.readerChapterProgress - normalizedProgress) < 0.000001) {
      return;
    }
    ReaderUiStore.dispatch({
      type: 'reader-location-anchor',
      readerChapterOffset: normalizedOffset,
      readerChapterProgress: normalizedProgress,
      bookId: identity.bookId,
      sourceId: identity.sourceId,
      chapterIndex: identity.chapterIndex,
    });
  }

  static runtimeShadowSnapshot(): ReaderUIRuntimeShadowSnapshot {
    return ReaderUiStore.runtimeShadow.snapshot();
  }

  static isDirectoryPilotActive(): boolean {
    return ReaderUiStore.runtimeShadow.isDirectoryPilotActive();
  }

  /** Book.open is Pilot-enabled by default; tests may opt out to exercise Shadow. */
  static setBookOpenPilotEnabledForTest(enabled: boolean): void {
    ReaderUiStore.runtimeShadow.setBookOpenPilotEnabledForTest(enabled);
  }

  static isBookOpenPilotEnabled(): boolean {
    return ReaderUiStore.runtimeShadow.isBookOpenPilotEnabled();
  }

  static bookOpenPilotSnapshot(): ReaderBookOpenPilotSnapshot {
    return ReaderUiStore.runtimeShadow.bookOpenPilotSnapshot();
  }

  static setPlaybackPilotPairsForTest(pagePair: boolean, ttsPair: boolean,
    autoPagePair: boolean): void {
    ReaderUiStore.runtimeShadow.setPlaybackPilotPairsForTest(pagePair, ttsPair, autoPagePair);
    ReaderUiStore.writeAll();
  }

  static playbackPilotSnapshot(): ReaderPlaybackPilotSnapshot {
    return ReaderUiStore.runtimeShadow.playbackPilotSnapshot();
  }

  /** Import is Pilot-enabled by default; tests may opt out to exercise Shadow. */
  static setImportPilotEnabledForTest(enabled: boolean): void {
    ReaderUiStore.runtimeShadow.setImportPilotEnabledForTest(enabled);
  }

  static isImportPilotEnabled(): boolean {
    return ReaderUiStore.runtimeShadow.isImportPilotEnabled();
  }

  static importPilotSnapshot(): ReaderImportPilotSnapshot {
    return ReaderUiStore.runtimeShadow.importPilotSnapshot();
  }

  /** Source switch is Pilot-enabled by default; tests may opt out to exercise Shadow. */
  static setSourceSwitchPilotEnabledForTest(enabled: boolean): void {
    ReaderUiStore.runtimeShadow.setSourceSwitchPilotEnabledForTest(enabled);
  }

  static isSourceSwitchPilotEnabled(): boolean {
    return ReaderUiStore.runtimeShadow.isSourceSwitchPilotEnabled();
  }

  static sourceSwitchPilotSnapshot(): ReaderSourceSwitchPilotSnapshot {
    return ReaderUiStore.runtimeShadow.sourceSwitchPilotSnapshot();
  }

  /** Replace rules is Pilot-enabled by default; tests may opt out to exercise Shadow. */
  static setReplaceRulePilotEnabledForTest(enabled: boolean): void {
    ReaderUiStore.runtimeShadow.setReplaceRulePilotEnabledForTest(enabled);
  }

  static isReplaceRulePilotEnabled(): boolean {
    return ReaderUiStore.runtimeShadow.isReplaceRulePilotEnabled();
  }

  static replaceRulePilotSnapshot(): ReaderReplaceRulePilotSnapshot {
    return ReaderUiStore.runtimeShadow.replaceRulePilotSnapshot();
  }

  /** RSS is Pilot-enabled by default; tests may opt out to exercise Shadow. */
  static setRssPilotEnabledForTest(enabled: boolean): void {
    ReaderUiStore.runtimeShadow.setRssPilotEnabledForTest(enabled);
  }

  static isRssPilotEnabled(): boolean {
    return ReaderUiStore.runtimeShadow.isRssPilotEnabled();
  }

  static rssPilotSnapshot(): ReaderRssPilotSnapshot {
    return ReaderUiStore.runtimeShadow.rssPilotSnapshot();
  }

  /** Sync remains Shadow; tests may explicitly enable the injected experiment. */
  static setSyncPilotEnabledForTest(enabled: boolean): void {
    ReaderUiStore.runtimeShadow.setSyncPilotEnabledForTest(enabled);
  }

  static isSyncPilotEnabled(): boolean {
    return ReaderUiStore.runtimeShadow.isSyncPilotEnabled();
  }

  static syncPilotSnapshot(): ReaderSyncPilotSnapshot {
    return ReaderUiStore.runtimeShadow.syncPilotSnapshot();
  }

  static providePlaybackMeasuredLayout(correlationId: string, layout: ReaderUIPageLayout): boolean {
    return ReaderUiStore.runtimeShadow.providePlaybackMeasuredLayout(correlationId, layout);
  }

  static rejectPlaybackPageProposal(correlationId: string, message: string): boolean {
    return ReaderUiStore.runtimeShadow.rejectPlaybackPageProposal(correlationId, message);
  }

  static suspendPlaybackForBackground(): Promise<void> {
    return ReaderUiStore.runtimeShadow.suspendPlaybackForBackground();
  }

  static waitForPlaybackPilotIdle(): Promise<void> {
    return ReaderUiStore.runtimeShadow.waitForPlaybackPilotIdle();
  }

  static teardownPlaybackForDestroy(): Promise<void> {
    return ReaderUiStore.runtimeShadow.teardownPlaybackForDestroy();
  }

  /**
   * Called by ReadingTextFlow only from an actual ArkUI area measurement. The
   * correlation and content generation are captured by the displayed subtree,
   * so a stale onAreaChange cannot advance a replacement transaction.
   */
  static provideBookOpenMeasuredLayout(correlationId: string, contentGeneration: number,
    layout: ReaderUIBookOpenLayout): boolean {
    return ReaderUiStore.runtimeShadow.provideBookOpenMeasuredLayout(
      correlationId, contentGeneration, layout,
    );
  }

  private static bookOpenPilotHost(): ReaderBookOpenPilotHost {
    return new ReaderBookOpenStoreHost(
      (): ReaderUiState => ReaderUiStore.state,
      (runtime: ReaderUIState): void => {
        ReaderBookOpenPilotProjection.applyRuntimeInPlace(ReaderUiStore.state, runtime);
        ReaderUiStore.writeAll();
      },
      (event: UiEvent): void => {
        // Intentionally bypass dispatch(): book.open's executor is already
        // the sole effect owner. Reducer-only projection keeps Core DTOs out
        // of the shared runtime while avoiding duplicate ReaderEffects work.
        ReaderUiStore.state = ReaderReducer.reduce(ReaderUiStore.state, event);
        ReaderUiStore.writeAll();
      },
    );
  }

  private static playbackPilotHost(): ReaderPlaybackPilotHost {
    return new ReaderPlaybackStoreHost(
      (): ReaderUiState => ReaderUiStore.state,
      (runtime: ReaderUIState): void => {
        ReaderPlaybackPilotProjection.applyRuntimeInPlace(ReaderUiStore.state, runtime);
        ReaderUiStore.writeAll();
      },
      (location: CoreReaderCanonicalLocation, pageIndex: number): void => {
        ReaderPlaybackPilotProjection.commitLocationInPlace(ReaderUiStore.state, location, pageIndex);
        ReaderUiStore.writeAll();
      },
      (snapshot: ReaderPlaybackQueueSnapshot): void => {
        ReaderPlaybackPilotProjection.applyQueueInPlace(ReaderUiStore.state, snapshot);
        ReaderUiStore.writeAll();
      },
    );
  }

  private static importPilotHost(): ReaderImportPilotHost {
    return new ReaderImportStoreHost(
      (): ReaderUiState => ReaderUiStore.state,
      (_runtime: ReaderUIState): void => {
        // The import Pilot uses emitEffects which does not create a runtime
        // transaction. Runtime state projection is a no-op; the executor
        // publishes results through applyDomainEvent only.
        ReaderUiStore.writeAll();
      },
      (event: UiEvent): void => {
        // Intentionally bypass dispatch(): import's executor is already the
        // sole effect owner. Reducer-only projection keeps Core DTOs out of
        // the shared runtime while avoiding duplicate ReaderEffects work.
        ReaderUiStore.state = ReaderReducer.reduce(ReaderUiStore.state, event);
        ReaderUiStore.writeAll();
      },
    );
  }

  private static sourceSwitchPilotHost(): ReaderSourceSwitchPilotHost {
    return new ReaderSourceSwitchStoreHost(
      (): ReaderUiState => ReaderUiStore.state,
      (runtime: ReaderUIState): void => {
        // The source switch Pilot's overlay/route events (source.switch.open,
        // source.switch.cancel, reader.sourceSwitch.open/close) change the
        // runtime route/overlay. Project those fields to the native state so
        // the UI renders the correct route. Effectful events use emitEffects
        // which does not change the runtime route; the executor publishes
        // results through applyDomainEvent only.
        const native = ReaderUiStore.state;
        if (runtime.routeId !== native.routeId || runtime.routeStack.length !== native.stack.length - 1) {
          // Rebuild the native stack from the runtime route stack + current
          // route id, mirroring ReaderBookOpenPilotProjection.
          const newStack: RouteEntry[] = [];
          for (let index = 0; index < runtime.routeStack.length; index += 1) {
            newStack.push({ id: runtime.routeStack[index] as RouteId });
          }
          newStack.push({ id: runtime.routeId as RouteId });
          native.stack = newStack;
          native.routeId = runtime.routeId as RouteId;
        }
        native.overlay = (runtime.overlay ?? '') as Overlay;
        native.loading = runtime.loading;
        ReaderUiStore.writeAll();
      },
      (event: UiEvent): void => {
        // Intentionally bypass dispatch(): source switch's executor is already
        // the sole effect owner. Reducer-only projection keeps Core DTOs out
        // of the shared runtime while avoiding duplicate ReaderEffects work.
        ReaderUiStore.state = ReaderReducer.reduce(ReaderUiStore.state, event);
        ReaderUiStore.writeAll();
      },
    );
  }

  private static replaceRulePilotHost(): ReaderReplaceRulePilotHost {
    return new ReaderReplaceRuleStoreHost(
      (): ReaderUiState => ReaderUiStore.state,
      (_runtime: ReaderUIState): void => {
        // The replace rule Pilot uses emitEffects which does not create a
        // runtime transaction. Runtime state projection is a no-op; the
        // executor publishes results through applyDomainEvent only.
        ReaderUiStore.writeAll();
      },
      (event: UiEvent): void => {
        // Intentionally bypass dispatch(): replace rule's executor is already
        // the sole effect owner. Reducer-only projection keeps Core DTOs out
        // of the shared runtime while avoiding duplicate ReaderEffects work.
        ReaderUiStore.state = ReaderReducer.reduce(ReaderUiStore.state, event);
        ReaderUiStore.writeAll();
      },
    );
  }

  private static rssPilotHost(): ReaderRssPilotHost {
    return new ReaderRssStoreHost(
      (): ReaderUiState => ReaderUiStore.state,
      (_runtime: ReaderUIState): void => {
        // The RSS Pilot uses emitEffects which does not create a runtime
        // transaction. Runtime state projection is a no-op; the executor
        // publishes results through applyDomainEvent only.
        ReaderUiStore.writeAll();
      },
      (event: UiEvent): void => {
        // Intentionally bypass dispatch(): RSS's executor is already the
        // sole effect owner. Reducer-only projection keeps Core DTOs out of
        // the shared runtime while avoiding duplicate ReaderEffects work.
        ReaderUiStore.state = ReaderReducer.reduce(ReaderUiStore.state, event);
        ReaderUiStore.writeAll();
        // RSS pilot domain events that require a list reload (persisted,
        // delete-complete, refresh-success, rss-load) are handled here so the
        // canonical Core subscription list is re-read after every durable
        // mutation. The reload is intentionally dispatched after the reducer
        // has applied the domain event so the loading flag is visible.
        if (event.type === 'rss-subscription-persisted' ||
          event.type === 'rss-subscription-delete-complete' ||
          event.type === 'rss-refresh-success' ||
          event.type === 'rss-load') {
          ReaderEffects.loadRss();
        }
      },
    );
  }

  private static syncPilotHost(): ReaderSyncPilotHost {
    return new ReaderSyncStoreHost(
      (): ReaderUiState => ReaderUiStore.state,
      (_runtime: ReaderUIState): void => {
        // The disabled Sync experiment uses emitEffects and does not create a
        // runtime transaction. Runtime projection is therefore a no-op.
        ReaderUiStore.writeAll();
      },
      (event: UiEvent): void => {
        // Test-only experimental projection. Production Sync never reaches
        // this host because no gateway is injected and the mode stays Shadow.
        ReaderUiStore.state = ReaderReducer.reduce(ReaderUiStore.state, event);
        ReaderUiStore.writeAll();
      },
    );
  }

  private static writeAll(): void {
    const s = ReaderUiStore.state;
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ROUTE, s.routeId);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_TAB, s.tab);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_OVERLAY, s.overlay);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PAGE_STATE, s.pageState);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_READER_MODE, s.readerMode);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PAGINATION_MODE, s.paginationMode);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_READER_PAGE_INDEX, s.readerPageIndex);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_READER_PAGE_COUNT, s.readerPageCount);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_READER_CHAPTER_OFFSET, s.readerChapterOffset);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_READER_CHAPTER_PROGRESS, s.readerChapterProgress);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_FONT_SIZE, s.fontSize);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_LINE_HEIGHT, s.lineHeight);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_PARAGRAPH_GAP, s.paragraphGap);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_LETTER_SPACING, s.letterSpacing);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_FONT_FAMILY, s.fontFamily);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_TOP_MARGIN, s.topMargin);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_SIDE_MARGIN, s.sideMargin);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_PARAGRAPH_INDENT, s.paragraphIndent);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ACTIVE_SESSION, s.activeSession);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_LOADING, s.loading);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_REDUCED_MOTION, s.reducedMotion);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ERROR_CODE, s.error !== null ? s.error.code : '');
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ERROR_MESSAGE, s.error !== null ? s.error.message : '');
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_RETRYABLE, s.error !== null ? s.error.retryable : false);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_STACK_DEPTH, s.stack.length);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_FIRST_OPEN, s.firstOpenPlayed);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SEARCH_QUERY, s.searchQuery);
    AppStorage.setOrCreate<SearchResultEntry[]>(ReaderUiStore.K_SEARCH_RESULTS, s.searchResults);
    AppStorage.setOrCreate<BookDetail | null>(ReaderUiStore.K_CURRENT_BOOK, s.currentBook);
    AppStorage.setOrCreate<string[]>(ReaderUiStore.K_CHAPTER_CONTENT, s.chapterContent);
    AppStorage.setOrCreate<ChapterTocEntry[]>(ReaderUiStore.K_CHAPTER_TOC, s.chapterToc);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_CURRENT_CHAPTER_TITLE, s.currentChapterTitle);
    AppStorage.setOrCreate<CoreReaderCanonicalLocation | null>(
      ReaderUiStore.K_CANONICAL_READER_LOCATION, s.canonicalReaderLocation,
    );
    AppStorage.setOrCreate<ReaderContentIdentity | null>(
      ReaderUiStore.K_ACTIVE_READER_CONTENT_IDENTITY, s.activeReaderContentIdentity,
    );
    const playbackRuntime = ReaderUiStore.runtimeShadow.snapshot().runtimeState;
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PLAYBACK_PAGE_CORRELATION,
      playbackRuntime.pageTransaction?.correlationId ?? '');
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PLAYBACK_PAGE_DIRECTION,
      playbackRuntime.pageTransaction?.direction ?? '');
    AppStorage.setOrCreate<string>(ReaderUiStore.K_CONTENT_SEARCH_QUERY, s.contentSearchQuery);
    AppStorage.setOrCreate<CoreContentSearchResult[]>(ReaderUiStore.K_CONTENT_SEARCH_RESULTS, s.contentSearchResults);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_CONTENT_SEARCH_LOADING, s.contentSearchLoading);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_CONTENT_SEARCH_LOADED, s.contentSearchLoaded);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_CONTENT_SEARCH_ERROR, s.contentSearchError);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_CONTENT_SEARCH_MESSAGE, s.contentSearchMessage);
    AppStorage.setOrCreate<CoreBookmark[]>(ReaderUiStore.K_BOOKMARKS, s.bookmarks);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_BOOKMARKS_LOADED, s.bookmarksLoaded);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_BOOKMARKS_LOADING, s.bookmarksLoading);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_BOOKMARKS_ERROR, s.bookmarksError);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_PENDING_BOOKMARK_DELETE_TIME, s.pendingBookmarkDeleteTime);
    AppStorage.setOrCreate<string[]>(ReaderUiStore.K_SEARCH_HISTORY, s.searchHistory);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_SEARCH_HISTORY_LOADED, s.searchHistoryLoaded);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_SEARCH_HISTORY_LOADING, s.searchHistoryLoading);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SEARCH_HISTORY_ERROR, s.searchHistoryError);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_PENDING_SEARCH_HISTORY_CLEAR, s.pendingSearchHistoryClear);
    // ── Batch 1 session/TTS/settings fields ──
    AppStorage.setOrCreate<string>(ReaderUiStore.K_TTS_PLAYBACK, s.ttsSession.playback);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_TTS_RATE, s.ttsSession.rate);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_TTS_VOICE, s.ttsSession.voice);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_TTS_SCOPE, s.ttsSession.scope);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_TTS_TIMER, s.ttsSession.timer);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_TTS_CURRENT_SEGMENT, s.ttsSession.currentSegment);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_TTS_TOTAL_SEGMENTS, s.ttsSession.totalSegments);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_AUTO_PAGE_PLAYING, s.autoPageSession.playing);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_AUTO_PAGE_COUNTDOWN, s.autoPageSession.countdownSeconds);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_AUTO_PAGE_INTERVAL, s.autoPageSession.intervalSeconds);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_BRIGHTNESS, s.brightness);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_BRIGHTNESS_AUTO, s.brightnessAuto);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_READER_HOST_MESSAGE, s.readerHostMessage);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_TOC_MODE, s.tocMode);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_AUTO_PAGE, s.readerToggles.autoPage);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_VOLUME_PAGE, s.readerToggles.volumePage);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_LANDSCAPE_LOCK, s.readerToggles.landscapeLock);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_KEEP_SCREEN_ON, s.readerToggles.keepScreenOn);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_STATUS_INFO, s.readerToggles.statusInfo);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_HAPTIC, s.readerToggles.hapticFeedback);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_CACHE_NEXT, s.readerToggles.cacheNext);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_HIDE_STATUS_BAR, s.readerToggles.hideStatusBar);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_OPT_PAGE_MODE, s.readerSettingOptions.pageMode);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_OPT_TAP_MODE, s.readerSettingOptions.tapMode);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_OPT_PAGE_ANIMATION, s.readerSettingOptions.pageAnimation);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_OPT_PARAGRAPH_INDENT_MODE, s.readerSettingOptions.paragraphIndentMode);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_OPT_TEXT_CONVERSION, s.readerSettingOptions.textConversion);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_OPT_TEXT_ALIGNMENT, s.readerSettingOptions.textAlignment);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_SELECTION_VISIBLE, s.selection.visible);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SELECTION_ACTION, s.selection.action);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SELECTION_TEXT, s.selection.selectedText);
    // ── Batch 4 bookshelf/discover/source-switch fields ──
    AppStorage.setOrCreate<string>(ReaderUiStore.K_BOOKSHELF_VIEW, s.bookshelfFilter.view);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_BOOKSHELF_GROUP, s.bookshelfFilter.group);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_BOOKSHELF_SORT, s.bookshelfFilter.sort);
    AppStorage.setOrCreate<string[]>(ReaderUiStore.K_BOOKSHELF_FILTERS, s.bookshelfFilter.filters);
    AppStorage.setOrCreate<string[]>(ReaderUiStore.K_DISCOVER_FILTERS, s.discoverFilter.filters);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_DISCOVER_SORT, s.discoverFilter.sort);
    AppStorage.setOrCreate<CoreSourceEntry[]>(ReaderUiStore.K_DISCOVER_SOURCES, s.discoverSources);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_DISCOVER_SOURCE_ID, s.discoverSourceId);
    AppStorage.setOrCreate<CoreDiscoverKind[]>(ReaderUiStore.K_DISCOVER_KINDS, s.discoverKinds);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_DISCOVER_KIND_URL, s.discoverKindUrl);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_DISCOVER_KIND_TITLE, s.discoverKindTitle);
    AppStorage.setOrCreate<CoreDiscoverBook[]>(ReaderUiStore.K_DISCOVER_BOOKS, s.discoverBooks);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_DISCOVER_LOADING, s.discoverLoading);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_DISCOVER_LOADED, s.discoverLoaded);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_DISCOVER_ERROR, s.discoverError);
    AppStorage.setOrCreate<string[]>(ReaderUiStore.K_SOURCE_SELECTION, s.sourceSelection);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_SOURCE_SWITCH_EPOCH, s.sourceSwitchEpoch);
    AppStorage.setOrCreate<CoreSourceEntry[]>(ReaderUiStore.K_AVAILABLE_SOURCES, s.availableSources);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_SOURCES_LOADED, s.sourcesLoaded);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SELECTED_SOURCE_ID, s.selectedSourceId ?? '');
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SOURCE_CHECK_SOURCE_ID, s.sourceCheckSourceId);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SOURCE_CHECK_SOURCE_NAME, s.sourceCheckSourceName);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_SOURCE_CHECK_LOADING, s.sourceCheckLoading);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_SOURCE_CHECK_LOADED, s.sourceCheckLoaded);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SOURCE_CHECK_MESSAGE, s.sourceCheckMessage);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SOURCE_CHECK_ERROR, s.sourceCheckError);
    AppStorage.setOrCreate<CoreSourceCheckResult | null>(ReaderUiStore.K_SOURCE_CHECK_RESULT, s.sourceCheckResult);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SOURCE_DEBUG_SOURCE_ID, s.sourceDebugSourceId);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SOURCE_DEBUG_SOURCE_NAME, s.sourceDebugSourceName);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_SOURCE_DEBUG_LOADING, s.sourceDebugLoading);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_SOURCE_DEBUG_LOADED, s.sourceDebugLoaded);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SOURCE_DEBUG_MESSAGE, s.sourceDebugMessage);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SOURCE_DEBUG_ERROR, s.sourceDebugError);
    AppStorage.setOrCreate<CoreSourceDebugResult | null>(ReaderUiStore.K_SOURCE_DEBUG_RESULT, s.sourceDebugResult);
    AppStorage.setOrCreate<CoreBookshelfBook[]>(ReaderUiStore.K_BOOKSHELF_BOOKS, s.bookshelfBooks);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_BOOKSHELF_LOADED, s.bookshelfLoaded);
    AppStorage.setOrCreate<CoreBookshelfBook | null>(ReaderUiStore.K_CONTINUE_READING_BOOK, s.continueReadingBook);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_CONTINUE_READING_LOADED, s.continueReadingLoaded);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_CONTINUE_READING_ERROR, s.continueReadingError);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PENDING_BOOKSHELF_REMOVAL_SOURCE_ID,
      s.pendingBookshelfRemovalSourceId);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PENDING_BOOKSHELF_REMOVAL_BOOK_ID,
      s.pendingBookshelfRemovalBookId);
    AppStorage.setOrCreate<CoreBookGroup[]>(ReaderUiStore.K_BOOK_GROUPS, s.bookGroups);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_BOOK_GROUPS_LOADED, s.bookGroupsLoaded);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_BOOK_GROUPS_LOADING, s.bookGroupsLoading);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_BOOK_GROUPS_ERROR, s.bookGroupsError);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_PENDING_BOOK_GROUP_DELETE_ID, s.pendingBookGroupDeleteId);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PENDING_BOOK_GROUP_CLEAR_SOURCE_ID, s.pendingBookGroupClearSourceId);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PENDING_BOOK_GROUP_CLEAR_BOOK_ID, s.pendingBookGroupClearBookId);
    AppStorage.setOrCreate<CoreRssSubscription[]>(ReaderUiStore.K_RSS_SUBSCRIPTIONS, s.rssSubscriptions);
    AppStorage.setOrCreate<CoreRssItem[]>(ReaderUiStore.K_RSS_ITEMS, s.rssItems);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_RSS_LOADED, s.rssLoaded);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_RSS_LOADING, s.rssLoading);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_RSS_LOAD_ERROR, s.rssLoadError);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_RSS_ITEM_FILTER, s.rssItemFilter);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_RSS_REFRESH_STATUS, s.rssRefreshStatus);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_RSS_REFRESH_MESSAGE, s.rssRefreshMessage);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PENDING_RSS_SUBSCRIPTION_DELETE_ID,
      s.pendingRssSubscriptionDeleteId);
    // ── B1 P0 全局设置字段写入 AppStorage ──
    AppStorage.setOrCreate<string>(ReaderUiStore.K_APP_THEME_MODE, s.appThemeMode);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_COVER_COLUMNS, s.coverColumns);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_AUTO_CHECK_UPDATE, s.settingsToggles.autoCheckUpdate);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_TAP_BOTTOM_BAR_TO_TOP, s.settingsToggles.tapBottomBarToTop);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_SHOW_UPDATE_BADGE, s.settingsToggles.showUpdateBadge);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_MERGE_SAME_BOOKS, s.settingsToggles.mergeSameBooks);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_ENABLE_SEARCH_HISTORY, s.settingsToggles.enableSearchHistory);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_SHOW_LOCAL_BOOK_BADGE, s.settingsToggles.showLocalBookBadge);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_SEARCH_HISTORY_LIMIT, s.searchHistoryLimit);
    // ── F3 交互连接字段写入 AppStorage ──
    AppStorage.setOrCreate<string>(ReaderUiStore.K_READER_THEME, s.readerTheme);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_READER_SETTING_EXPANDED_OPTION, s.readerSettingExpandedOption);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_AUTO_PAGE_MODE, s.autoPageMode);
    // ── P1.2/P1.3 字段写入 AppStorage ──
    AppStorage.setOrCreate<string>(ReaderUiStore.K_EXPANDED_OPTION_KEY, s.expandedOptionKey);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_PENDING_CACHE_CLEAR, s.pendingCacheClear);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_CORE_SLICE10_METHOD, s.coreSlice10Method);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_CORE_SLICE10_LOADING, s.coreSlice10Loading);
    AppStorage.setOrCreate<ReaderUIJSONPayload | null>(ReaderUiStore.K_CORE_SLICE10_RESULT, s.coreSlice10Result);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_CORE_SLICE10_ERROR, s.coreSlice10Error);
    AppStorage.setOrCreate<ReaderUIJSONPayload | null>(ReaderUiStore.K_LAST_UNDO_TOKEN, s.lastUndoToken);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_SERVER_URL, s.webdavServerUrl);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_USERNAME, s.webdavUsername);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_PASSWORD, s.webdavPassword);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_SYNC_DIR, s.webdavSyncDir);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_TEST_STATUS, s.webdavTestStatus);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_TEST_MESSAGE, s.webdavTestMessage);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_SAVE_STATUS, s.webdavSaveStatus);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_SAVE_MESSAGE, s.webdavSaveMessage);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_CORE_BACKUP_STATUS, s.coreBackupStatus);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_CORE_BACKUP_MESSAGE, s.coreBackupMessage);
    AppStorage.setOrCreate<CoreStorageBackupInfo | null>(ReaderUiStore.K_LOCAL_CORE_BACKUP, s.localCoreBackup);
    AppStorage.setOrCreate<CoreStorageBackupInfo | null>(ReaderUiStore.K_PENDING_CORE_RESTORE, s.pendingCoreRestore);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PENDING_CORE_RESTORE_CONFIRMATION_CHECKSUM,
      s.pendingCoreRestoreConfirmationChecksum);
    // ── W1 本地书导入 / W5 规则替换字段写入 AppStorage ──
    AppStorage.setOrCreate<string>(ReaderUiStore.K_IMPORT_PREVIEW_FORMAT, s.importPreviewFormat);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_IMPORT_PREVIEW_ENCODING, s.importPreviewEncoding);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_IMPORT_PREVIEW_COUNT, s.importPreviewCount);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_LOCAL_IMPORT_EPOCH, s.localImportEpoch);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SOURCE_IMPORT_ORIGIN, s.sourceImportOrigin);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_SOURCE_IMPORT_TOTAL, s.sourceImportTotal);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_SOURCE_IMPORT_IMPORTED, s.sourceImportImported);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_SOURCE_IMPORT_SKIPPED, s.sourceImportSkipped);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_SOURCE_IMPORT_FAILED, s.sourceImportFailed);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_SOURCE_IMPORT_MESSAGE, s.sourceImportMessage);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_SOURCE_IMPORT_RUNNING, s.sourceImportRunning);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_SOURCE_IMPORT_EPOCH, s.sourceImportEpoch);
    AppStorage.setOrCreate<ReplaceRule[]>(ReaderUiStore.K_REPLACE_RULES, s.replaceRules);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PENDING_REPLACE_RULE_DELETE_ID, s.pendingReplaceRuleDeleteId);
  }
}
