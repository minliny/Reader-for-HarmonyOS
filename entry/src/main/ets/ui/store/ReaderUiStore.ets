// ReaderUiStore — AppStorage bridge over the reducer.
// Holds the canonical UiState; on dispatch, reduces and writes primitive fields to
// AppStorage so any component can subscribe via @StorageProp / @StorageLink.
import { ReaderUiState, UiEvent, SearchResultEntry, BookDetail, ReplaceRule } from './ReaderUiState';
import { ReaderReducer } from './ReaderReducer';
import { DemoUiState } from '../fixtures/DemoUiState';
import { ReaderThemeState } from '../tokens/ReaderThemeState';
import { ReaderEffects } from './ReaderEffects';

export class ReaderUiStore {
  private static readonly K_ROUTE = 'reader.routeId';
  private static readonly K_TAB = 'reader.tab';
  private static readonly K_OVERLAY = 'reader.overlay';
  private static readonly K_PAGE_STATE = 'reader.pageState';
  private static readonly K_READER_MODE = 'reader.readerMode';
  static readonly K_PAGINATION_MODE: string = 'reader.paginationMode';
  static readonly K_FONT_SIZE: string = 'reader.typography.fontSize';
  static readonly K_LINE_HEIGHT: string = 'reader.typography.lineHeight';
  static readonly K_PARAGRAPH_GAP: string = 'reader.typography.paragraphGap';
  static readonly K_LETTER_SPACING: string = 'reader.typography.letterSpacing';
  static readonly K_FONT_FAMILY: string = 'reader.typography.fontFamily';
  static readonly K_TOP_MARGIN: string = 'reader.pageSpace.topMargin';
  static readonly K_SIDE_MARGIN: string = 'reader.pageSpace.sideMargin';
  static readonly K_BOTTOM_MARGIN: string = 'reader.pageSpace.bottomMargin';
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
  private static readonly K_SOURCE_SELECTION = 'reader.sourceSelection';
  // ── B1 P0 全局设置 segment/stepper/switch keys ──
  private static readonly K_APP_THEME_MODE = 'reader.appThemeMode';
  private static readonly K_COVER_COLUMNS = 'reader.coverColumns';
  private static readonly K_TOGGLE_AUTO_CHECK_UPDATE = 'reader.settingsToggles.autoCheckUpdate';
  private static readonly K_TOGGLE_TAP_BOTTOM_BAR_TO_TOP = 'reader.settingsToggles.tapBottomBarToTop';
  private static readonly K_TOGGLE_SHOW_UPDATE_BADGE = 'reader.settingsToggles.showUpdateBadge';
  private static readonly K_TOGGLE_MERGE_SAME_BOOKS = 'reader.settingsToggles.mergeSameBooks';
  private static readonly K_TOGGLE_ENABLE_SEARCH_HISTORY = 'reader.settingsToggles.enableSearchHistory';
  // ── F3 交互连接 keys ──
  private static readonly K_READER_THEME = 'reader.readerTheme';
  private static readonly K_READER_SETTING_EXPANDED_OPTION = 'reader.readerSettingExpandedOption';
  private static readonly K_AUTO_PAGE_MODE = 'reader.autoPageMode';
  // ── P1.2 select/action 控件展开状态 key ──
  private static readonly K_EXPANDED_OPTION_KEY = 'reader.expandedOptionKey';
  // ── P1.3 WebDAV 配置 keys ──
  private static readonly K_WEBDAV_SERVER_URL = 'reader.webdavServerUrl';
  private static readonly K_WEBDAV_USERNAME = 'reader.webdavUsername';
  private static readonly K_WEBDAV_PASSWORD = 'reader.webdavPassword';
  private static readonly K_WEBDAV_SYNC_DIR = 'reader.webdavSyncDir';
  private static readonly K_WEBDAV_TEST_STATUS = 'reader.webdavTestStatus';
  private static readonly K_WEBDAV_TEST_MESSAGE = 'reader.webdavTestMessage';
  private static readonly K_WEBDAV_SAVE_STATUS = 'reader.webdavSaveStatus';
  private static readonly K_WEBDAV_SAVE_MESSAGE = 'reader.webdavSaveMessage';
  // ── W1 资源导入 / W5 规则替换 keys ──
  private static readonly K_IMPORT_PREVIEW_FORMAT = 'reader.importPreviewFormat';
  private static readonly K_IMPORT_PREVIEW_COUNT = 'reader.importPreviewCount';
  private static readonly K_REPLACE_RULES = 'reader.replaceRules';

  private static state: ReaderUiState;

  static init(): void {
    ReaderUiStore.state = DemoUiState.initial();
    ReaderThemeState.init();
    ReaderUiStore.writeAll();
    AppStorage.setOrCreate<string>(ReaderUiStore.K_LAST_OP, '');
  }

  static dispatch(event: UiEvent): void {
    ReaderUiStore.state = ReaderReducer.reduce(ReaderUiStore.state, event);
    ReaderUiStore.writeAll();
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

  private static writeAll(): void {
    const s = ReaderUiStore.state;
    AppStorage.setOrCreate<string>(ReaderUiStore.K_ROUTE, s.routeId);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_TAB, s.tab);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_OVERLAY, s.overlay);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PAGE_STATE, s.pageState);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_READER_MODE, s.readerMode);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_PAGINATION_MODE, s.paginationMode);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_FONT_SIZE, s.fontSize);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_LINE_HEIGHT, s.lineHeight);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_PARAGRAPH_GAP, s.paragraphGap);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_LETTER_SPACING, s.letterSpacing);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_FONT_FAMILY, s.fontFamily);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_TOP_MARGIN, s.topMargin);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_SIDE_MARGIN, s.sideMargin);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_BOTTOM_MARGIN, s.bottomMargin);
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
    AppStorage.setOrCreate<string[]>(ReaderUiStore.K_SOURCE_SELECTION, s.sourceSelection);
    // ── B1 P0 全局设置字段写入 AppStorage ──
    AppStorage.setOrCreate<string>(ReaderUiStore.K_APP_THEME_MODE, s.appThemeMode);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_COVER_COLUMNS, s.coverColumns);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_AUTO_CHECK_UPDATE, s.settingsToggles.autoCheckUpdate);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_TAP_BOTTOM_BAR_TO_TOP, s.settingsToggles.tapBottomBarToTop);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_SHOW_UPDATE_BADGE, s.settingsToggles.showUpdateBadge);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_MERGE_SAME_BOOKS, s.settingsToggles.mergeSameBooks);
    AppStorage.setOrCreate<boolean>(ReaderUiStore.K_TOGGLE_ENABLE_SEARCH_HISTORY, s.settingsToggles.enableSearchHistory);
    // ── F3 交互连接字段写入 AppStorage ──
    AppStorage.setOrCreate<string>(ReaderUiStore.K_READER_THEME, s.readerTheme);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_READER_SETTING_EXPANDED_OPTION, s.readerSettingExpandedOption);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_AUTO_PAGE_MODE, s.autoPageMode);
    // ── P1.2/P1.3 字段写入 AppStorage ──
    AppStorage.setOrCreate<string>(ReaderUiStore.K_EXPANDED_OPTION_KEY, s.expandedOptionKey);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_SERVER_URL, s.webdavServerUrl);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_USERNAME, s.webdavUsername);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_PASSWORD, s.webdavPassword);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_SYNC_DIR, s.webdavSyncDir);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_TEST_STATUS, s.webdavTestStatus);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_TEST_MESSAGE, s.webdavTestMessage);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_SAVE_STATUS, s.webdavSaveStatus);
    AppStorage.setOrCreate<string>(ReaderUiStore.K_WEBDAV_SAVE_MESSAGE, s.webdavSaveMessage);
    // ── W1 资源导入 / W5 规则替换字段写入 AppStorage ──
    AppStorage.setOrCreate<string>(ReaderUiStore.K_IMPORT_PREVIEW_FORMAT, s.importPreviewFormat);
    AppStorage.setOrCreate<number>(ReaderUiStore.K_IMPORT_PREVIEW_COUNT, s.importPreviewCount);
    AppStorage.setOrCreate<ReplaceRule[]>(ReaderUiStore.K_REPLACE_RULES, s.replaceRules);
  }
}
