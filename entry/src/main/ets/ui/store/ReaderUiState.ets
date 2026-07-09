// ReaderUiState — mirrors Reader UI/contracts/ui-state.schema.json (Phase 1 core fields).
// Owner: Platform Interaction Reducer. Durable UI state lives here, never inside page components.
import { RouteId } from '../../contract/generated/RouteTable';

export type MainTab = 'bookshelf' | 'discover' | 'rss' | 'settings';
export type ReaderMode = 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'permission';
export type ReaderPaginationMode = 'horizontal' | 'vertical';
export type ReaderFontFamily = 'system' | 'serif' | 'sans' | 'kai' | 'fangsong' | 'mono';
export type ReaderRenderMetric =
  | 'fontSize' | 'lineHeight' | 'paragraphGap' | 'letterSpacing'
  | 'topMargin' | 'sideMargin' | 'bottomMargin' | 'paragraphIndent';
export type PageState =
  | '' | 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'permission'
  | 'cover-mode' | 'list-mode' | 'shelf-empty' | 'no-cover' | 'long-title'
  | 'switching-source-type' | 'source-empty' | 'source-unavailable' | 'network-failed'
  | 'refreshing' | 'no-subscription' | 'no-unread' | 'local-data-loading' | 'no-backup'
  | 'permission-missing' | 'topbar-action';
// Overlay = generic transient overlays only. Reader overlays (directory /
// appearance / tts / settings / search / replace / auto-scroll / night-state /
// reader-control) are ROUTES now (Batch 1) — not this field. Retired kinds
// removed; kept: source-switch (live) + the generic transient kinds for
// future Batch 2+ overlays.
export type Overlay =
  | '' | 'source-switch' | 'book-action' | 'sort-filter' | 'group-management'
  | 'local-import' | 'dialog' | 'sheet' | 'toast';
export type ActiveSession = '' | 'reading' | 'tts' | 'auto-page';

// ── Batch 1 session/TTS/settings types ──
export type TtsPlaybackState = 'idle' | 'playing' | 'paused';
export type TtsScope = 'chapter' | 'full';
export type TtsTimer = 'off' | '5min' | '10min' | '15min' | '30min' | 'chapterEnd';
export type TocMode = 'directory' | 'bookmark';
export type ReaderToggleKey =
  | 'autoPage' | 'volumePage' | 'landscapeLock' | 'keepScreenOn'
  | 'statusInfo' | 'hapticFeedback' | 'cacheNext' | 'hideStatusBar';
export type ReaderSettingOptionKey = 'pageMode' | 'tapMode' | 'pageAnimation';

// ── Batch 4 bookshelf/discover/source-switch types ──
export type BookshelfView = 'cover' | 'list';

// ── B1 P0 全局设置 segment/stepper/switch 类型 ──
export type SettingsToggleKey =
  | 'autoCheckUpdate' | 'tapBottomBarToTop' | 'showUpdateBadge'
  | 'mergeSameBooks' | 'enableSearchHistory';

export interface SettingsTogglesMap {
  autoCheckUpdate: boolean;
  tapBottomBarToTop: boolean;
  showUpdateBadge: boolean;
  mergeSameBooks: boolean;
  enableSearchHistory: boolean;
}

export interface BookshelfFilterState {
  view: BookshelfView;
  group: string;
  sort: string;
  filters: string[];  // 选中的筛选标签
}

export interface DiscoverFilterState {
  filters: string[];
  sort: string;
}

export interface ReaderError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface RouteEntry {
  id: RouteId;
}

// ArkTS forbids Record<K, V> aliases as interface field types (warns), so we
// declare concrete interfaces for the toggle / setting-option maps.
export interface ReaderTogglesMap {
  autoPage: boolean;
  volumePage: boolean;
  landscapeLock: boolean;
  keepScreenOn: boolean;
  statusInfo: boolean;
  hapticFeedback: boolean;
  cacheNext: boolean;
  hideStatusBar: boolean;
}

export interface ReaderSettingOptionsMap {
  pageMode: string;
  tapMode: string;
  pageAnimation: string;
}

export interface TtsSessionState {
  playback: TtsPlaybackState;
  rate: number;       // 0.5 - 2.0
  voice: string;      // voice id
  scope: TtsScope;
  timer: TtsTimer;
  currentSegment: number;
  totalSegments: number;
}

export interface AutoPageSessionState {
  playing: boolean;
  countdownSeconds: number;  // remaining seconds in the current cycle
  intervalSeconds: number;   // total cycle length
}

export interface SelectionState {
  visible: boolean;
  action: string;
  selectedText: string;
}

export interface ReaderUiState {
  routeId: RouteId;
  tab: MainTab;
  readerMode: ReaderMode;
  paginationMode: ReaderPaginationMode;
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
  letterSpacing: number;
  fontFamily: ReaderFontFamily;
  topMargin: number;
  sideMargin: number;
  bottomMargin: number;
  paragraphIndent: number;
  overlay: Overlay;
  activeSession: ActiveSession;
  focusTarget: string;
  loading: boolean;
  error: ReaderError | null;
  reducedMotion: boolean;
  pageState: PageState;
  firstOpenPlayed: boolean;
  stack: RouteEntry[];
  // Minimal visible reading chain data fields (Phase 2 extension).
  // Hold real data fetched via Host HTTP, replacing hardcoded fixtures in
  // components. Durable UI state — owned by reducer, not page components.
  searchQuery: string;
  searchResults: SearchResultEntry[];
  currentBook: BookDetail | null;
  chapterContent: string[];
  // ── Batch 1 session/TTS/settings fields ──
  ttsSession: TtsSessionState;
  autoPageSession: AutoPageSessionState;
  brightness: number;            // 0 - 100
  brightnessAuto: boolean;
  tocMode: TocMode;
  readerToggles: ReaderTogglesMap;
  readerSettingOptions: ReaderSettingOptionsMap;
  selection: SelectionState;
  // ── Batch 4 bookshelf/discover/source-switch fields ──
  bookshelfFilter: BookshelfFilterState;
  discoverFilter: DiscoverFilterState;
  sourceSelection: string[];  // 选中的书源 id 列表
  // ── B1 P0 全局设置 segment/stepper/switch 字段 ──
  appThemeMode: string;        // 'system' | 'light' | 'dark'
  coverColumns: number;        // 书架封面列数（1-5）
  settingsToggles: SettingsTogglesMap;
  // ── F3 交互连接字段 ──
  readerTheme: string;                    // 阅读主题: 'paper' | 'warm' | 'green' | 'blue'
  readerSettingExpandedOption: string;    // 当前展开的设置项 key（'' 表示无展开）
  autoPageMode: string;                   // 自动翻页模式: 'continuous' | 'single'
}

// UiEvent is a tagged record; the reducer switches on `type` and reads the relevant
// optional field. Kept as one interface (rather than a discriminated union) for
// ArkTS-narrowing safety.
export interface UiEvent {
  type: string;
  id?: RouteId;
  tab?: MainTab;
  overlay?: Overlay;
  pageState?: PageState;
  mode?: ReaderMode;
  paginationMode?: ReaderPaginationMode;
  readerMetric?: ReaderRenderMetric;
  value?: number;
  delta?: number;
  fontFamily?: ReaderFontFamily;
  enabled?: boolean;
  loading?: boolean;
  error?: ReaderError | null;
  // Minimal visible reading chain event fields.
  query?: string;
  searchResults?: SearchResultEntry[];
  book?: BookDetail | null;
  chapterParagraphs?: string[];
  bookId?: string;
  chapterId?: string;
  // Only explicit reader-entry flows should chain book-detail-load into
  // chapter-load. Normal book-detail routes must not leave the detail page
  // in a chapter loading state.
  loadFirstChapter?: boolean;
  // ── Batch 1 session/TTS/settings event fields ──
  session?: ActiveSession;
  ttsPlayback?: TtsPlaybackState;
  ttsRate?: number;
  ttsVoice?: string;
  ttsScope?: TtsScope;
  ttsTimer?: TtsTimer;
  toggleKey?: ReaderToggleKey;
  toggleValue?: boolean;
  optionKey?: ReaderSettingOptionKey;
  optionValue?: string;
  countdownSeconds?: number;
  // ── Batch 2 reader control event fields ──
  tocMode?: TocMode;
  // ── Batch 3 selection event fields ──
  selectionAction?: string;
  // ── Batch 4 bookshelf/discover/source-switch event fields ──
  bookshelfView?: BookshelfView;
  bookshelfGroup?: string;
  bookshelfSort?: string;
  bookshelfFilterToggle?: string;  // 要切换的筛选标签
  discoverFilterToggle?: string;
  discoverSort?: string;
  sourceId?: string;  // 换源时单个书源 id
  bookAction?: string;  // 'branch' | 'delete'
  // ── B1 P0 全局设置事件字段 ──
  settingsKey?: string;            // 设置项 key（appThemeMode / coverColumns / autoCheckUpdate …）
  settingsValue?: string;          // segment 选中值
  settingsToggleValue?: boolean;   // switch 切换值
  // ── F3 交互连接事件字段 ──
  settingOptionExpandedKey?: string;      // 设置项展开/收起的 key
  theme?: string;                         // 阅读主题
  autoPageMode?: string;                  // 自动翻页模式
}

// ── Minimal visible reading chain data types ──
export interface SearchResultEntry {
  title: string;
  author: string;
  bookId: string;
  sourceName: string;
  sourceUrl: string;
  latestChapter?: string;
}

export interface BookDetail {
  bookId: string;
  title: string;
  author: string;
  coverUrl?: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  latestChapter: string;
  chapterListUrl: string;
}

export interface ChapterContent {
  bookId: string;
  chapterId: string;
  title: string;
  paragraphs: string[];
}
