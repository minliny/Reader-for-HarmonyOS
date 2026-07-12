// ReaderUiState — mirrors Reader UI/contracts/ui-state.schema.json (Phase 1 core fields).
// Owner: Platform Interaction Reducer. Durable UI state lives here, never inside page components.
import { RouteId } from '../../contract/generated/RouteTable';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';

export type MainTab = 'bookshelf' | 'discover' | 'rss' | 'settings';
export type ReaderMode = 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'permission';
export type ReaderPaginationMode = 'horizontal' | 'vertical';
export type ReaderFontFamily = 'system' | 'serif' | 'sans' | 'kai' | 'fangsong' | 'mono';
export type ReaderRenderMetric =
  | 'fontSize' | 'lineHeight' | 'paragraphGap' | 'letterSpacing'
  | 'topMargin' | 'sideMargin' | 'paragraphIndent';
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
// RSS list filtering belongs to Core's `rss.subscription.items` request.  It
// is deliberately not a visual-only predicate over the last response.
export type RssItemFilter = 'all' | 'unread';
export type RssRefreshStatus = 'idle' | 'refreshing' | 'success' | 'error';
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

export interface CoreSourceEntry {
  sourceId: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  // `source.list` exposes this separately from the general enabled flag.  A
  // source can remain usable for search/reading while deliberately opting out
  // of discovery, so Discover must not infer it from a local/demo default.
  enabledExplore?: boolean;
}

// UI-safe projection of one Core `source.check.run` verdict. The result owns
// the passed levels and failure reason; the UI must not synthesize a success
// when any real Host stage failed or a required verdict is missing.
export interface CoreSourceCheckResult {
  sourceId: string;
  available: boolean;
  levelsPassed: string[];
  failureReason: string;
  durationMs: number;
}

// UI-safe projection of one complete source-debug run.  Raw HTTP bodies,
// response headers, request URLs, and final URLs are intentionally absent:
// the bridge holds them only long enough to invoke Core `source.debug`.
export interface CoreSourceDebugStage {
  stage: string;
  requestCount: number;
  responseCount: number;
  selectedResponseIndex: number;
  statusCode: number;
  failed: boolean;
  failureMessage: string;
  replayLimited: boolean;
}

export interface CoreSourceDebugLog {
  state: number;
  message: string;
  timestampMs: number;
  step: string;
  rule: string;
  extractedCount: number;
  errorKind: string;
}

export interface CoreSourceDebugResult {
  sourceId: string;
  sourceCheck: CoreSourceCheckResult | null;
  sourceCheckError: string;
  logs: CoreSourceDebugLog[];
  finalState: number;
  durationMs: number;
  sourceDebugError: string;
  replayAttempted: boolean;
  replayLimited: boolean;
  replayNotice: string;
  stages: CoreSourceDebugStage[];
}

// A result returned by Core `search.content`.  The identity and the character
// offset are deliberately retained rather than re-derived from the rendered
// paragraph text: Core is the only owner of the persisted chapter cache and
// its offset is the canonical reader-location anchor.
export interface CoreContentSearchResult {
  sourceId: string;
  bookId: string;
  bookName: string;
  chapterIndex: number;
  chapterOffset: number;
  matchLength: number;
  snippetStart: number;
  chapterTitle: string;
  snippet: string;
}

// UI-safe projection of Core `bookmark.*`.  Core Bookmark V1 identifies the
// owner book by (bookName, bookAuthor), not sourceId/bookId.  Keep that exact
// shape visible so a same-title book from another source is never silently
// represented as source-scoped data.
export interface CoreBookmark {
  time: number;
  bookName: string;
  bookAuthor: string;
  chapterIndex: number;
  chapterPos: number;
  chapterName: string;
  bookText: string;
  content: string;
}

// UI-safe projection of Core `source.exploreKinds`.  `url` is intentionally
// retained even when empty: Core uses empty URLs for non-executable grouping
// headers, which the UI must show as such instead of inventing an entry.
export interface CoreDiscoverKind {
  title: string;
  url: string;
}

// UI-safe projection of one Core `source.explore` result.  `bookUrl` is the
// exact Core book identity returned by the selected source and must travel
// with `sourceId` into the real detail chain.
export interface CoreDiscoverBook {
  sourceId: string;
  bookUrl: string;
  title: string;
  author: string;
  coverUrl: string;
  intro: string;
  kind: string;
  lastChapter: string;
}

export interface CoreBookshelfBook {
  sourceId: string;
  bookId: string;
  title: string;
  author: string;
  coverUrl: string;
  intro: string;
  kind: string;
  lastChapter: string;
  group: string;
  // Core returns this only after a durable reading-progress write. It remains
  // optional because unstarted books intentionally have no last-read time.
  lastReadAt?: number;
}

// UI-safe projection of Core's book-group.* vertical. Book membership itself
// is stored on Core bookshelf rows and is changed through
// `bookshelf.group.assign`, not by mutating a visual-only group list.
export interface CoreBookGroup {
  groupId: number;
  groupName: string;
  cover: string;
  order: number;
  enableRefresh: boolean;
  show: boolean;
}

export interface CoreRssSubscription {
  subscriptionId: string;
  feedUrl: string;
  title: string;
  enabled: boolean;
  unreadCount: number;
}

export interface CoreRssItem {
  // RSS GUIDs are only unique within a subscription.  Keep the Core scope in
  // UI state so an "already read" operation cannot hide an identically named
  // item from a different feed.
  subscriptionId: string;
  guid: string;
  title: string;
  description: string;
  author: string;
  pubDate: string;
  link: string;
  sourceTitle: string;
  // Core joins its durable, subscription-scoped read record into every row.
  // Retaining this value lets the all-items view render a read article instead
  // of incorrectly removing it from the UI-only projection.
  read: boolean;
}

// UI-safe projection of Core book.toc output. Parsing variables remain in the
// effect layer, while route components receive only durable selection data.
export interface ChapterTocEntry {
  index: number;
  title: string;
  chapterId: string;
}

// Core's resolved reader anchor. It is deliberately a typed durable-state
// projection rather than a rendered-page estimate: subsequent progress/reflow
// work must start from the exact identity and revision Core returned.
export interface CoreReaderCanonicalLocation {
  bookId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
  locationRevision: string;
  resolverVersion: string;
}

// ArkUI layout callbacks can arrive after the reader has switched chapters.
// Keep the body identity independently from Core's resolved anchor so those
// callbacks cannot be relabeled as a newer chapter at dispatch time.
export interface ReaderContentIdentity {
  bookId: string;
  sourceId: string;
  chapterIndex: number;
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

// ── W5 规则替换：内容替换规则 ──
export interface ReplaceRule {
  id: string;
  pattern: string;
  replacement: string;
  scope: string;        // 'chapter' | 'book' | 自定义作用域
  enabled: boolean;
}

export interface ReaderUiState {
  routeId: RouteId;
  tab: MainTab;
  readerMode: ReaderMode;
  paginationMode: ReaderPaginationMode;
  readerPageIndex: number;
  readerPageCount: number;
  // The rendered page/scroll surface publishes a real Core-compatible Unicode
  // scalar anchor here.  A page number is only presentation state and must
  // never be persisted as a chapter character offset.
  readerChapterOffset: number;
  readerChapterProgress: number;
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
  letterSpacing: number;
  fontFamily: ReaderFontFamily;
  topMargin: number;
  sideMargin: number;
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
  chapterToc: ChapterTocEntry[];
  currentChapterTitle: string;
  canonicalReaderLocation: CoreReaderCanonicalLocation | null;
  activeReaderContentIdentity: ReaderContentIdentity | null;
  // Full-text body search is a separate, Core-backed projection.  It must not
  // reuse the global title-search state or infer matches from the currently
  // rendered paragraph array, because Core searches only durable chapter cache
  // entries scoped by sourceId + bookId.
  contentSearchQuery: string;
  contentSearchResults: CoreContentSearchResult[];
  contentSearchLoading: boolean;
  contentSearchLoaded: boolean;
  contentSearchError: string;
  contentSearchMessage: string;
  // Bookmarks remain a distinct Core projection from the TOC.  `loaded` is
  // necessary because an empty Core result is a real first-run state, while
  // `loading`/`error` must not make the reading surface pretend it has data.
  bookmarks: CoreBookmark[];
  bookmarksLoaded: boolean;
  bookmarksLoading: boolean;
  bookmarksError: string;
  // A delete target is a real Core bookmark primary key. `-1` means no
  // deletion is awaiting the visible second confirmation.
  pendingBookmarkDeleteTime: number;
  // Search history is the Core `search.history.*` string-only vertical.
  // It is intentionally separate from searchResults and must never fall back
  // to fixture keywords when storage has no rows.
  searchHistory: string[];
  searchHistoryLoaded: boolean;
  searchHistoryLoading: boolean;
  searchHistoryError: string;
  // Search history is a global Core collection; require an explicit second
  // action before clearing all rows currently owned by Core.
  pendingSearchHistoryClear: boolean;
  // Presentation limit for the Core-owned history query. This only changes
  // the number of rows requested from `search.history.list`.
  searchHistoryLimit: number;
  // ── Batch 1 session/TTS/settings fields ──
  ttsSession: TtsSessionState;
  autoPageSession: AutoPageSessionState;
  brightness: number;            // 0 - 100
  brightnessAuto: boolean;
  // Last visible result from a direct reader Host operation (window/system
  // bar/screen/vibration).  It never claims success before the Host confirms.
  readerHostMessage: string;
  tocMode: TocMode;
  readerToggles: ReaderTogglesMap;
  readerSettingOptions: ReaderSettingOptionsMap;
  selection: SelectionState;
  // ── Batch 4 bookshelf/discover/source-switch fields ──
  bookshelfFilter: BookshelfFilterState;
  discoverFilter: DiscoverFilterState;
  // Discover data is a separate Core projection.  It must never reuse the
  // source-switch selection or fixed demo books because its source/kind pair
  // is part of the Core request identity.
  discoverSources: CoreSourceEntry[];
  discoverSourceId: string;
  discoverKinds: CoreDiscoverKind[];
  discoverKindUrl: string;
  discoverKindTitle: string;
  discoverBooks: CoreDiscoverBook[];
  discoverLoading: boolean;
  discoverLoaded: boolean;
  discoverError: string;
  sourceSelection: string[];  // 选中的书源 id 列表
  // Incremented whenever the live switch surface is entered or left. Effects
  // bind async work to this epoch so an old confirmation cannot survive a
  // navigation away and later remove the previous bookshelf key.
  sourceSwitchEpoch: number;
  availableSources: CoreSourceEntry[]; // Core source.list 返回的真实书源
  sourcesLoaded: boolean;
  // Selection is UI navigation state only. It must reference an entry from
  // availableSources; Core remains the owner of every source field.
  selectedSourceId?: string;
  // Source detection is a separate Core `source.check.run` request state. It
  // retains the resolved source identity so a retry/error cannot be displayed
  // under a fixture or a source that was previously selected.
  sourceCheckSourceId: string;
  sourceCheckSourceName: string;
  sourceCheckLoading: boolean;
  sourceCheckLoaded: boolean;
  sourceCheckMessage: string;
  sourceCheckError: string;
  sourceCheckResult: CoreSourceCheckResult | null;
  // `source.debug` has its own transaction projection. It must not reuse the
  // source-check card because it additionally owns a private Host recorder
  // and a Core replay result.
  sourceDebugSourceId: string;
  sourceDebugSourceName: string;
  sourceDebugLoading: boolean;
  sourceDebugLoaded: boolean;
  sourceDebugMessage: string;
  sourceDebugError: string;
  sourceDebugResult: CoreSourceDebugResult | null;
  bookshelfBooks: CoreBookshelfBook[]; // Core bookshelf.list 的真实书架
  bookshelfLoaded: boolean;
  // This projection is loaded by an independent, global Core query. It must
  // never reuse the currently filtered/sorted shelf rows.
  continueReadingBook: CoreBookshelfBook | null;
  continueReadingLoaded: boolean;
  continueReadingError: string;
  // Destructive shelf removal is deliberately a transient, exact Core key.
  // It is set only after the visible current book is matched against a live
  // bookshelf row, then consumed by the explicit confirmation sheet.
  pendingBookshelfRemovalSourceId: string;
  pendingBookshelfRemovalBookId: string;
  bookGroups: CoreBookGroup[]; // Core book-group.list 的真实分组
  bookGroupsLoaded: boolean;
  bookGroupsLoading: boolean;
  bookGroupsError: string;
  // A book-group deletion is bound to an exact live Core group before its
  // visible second confirmation. Zero means no pending confirmation.
  pendingBookGroupDeleteId: number;
  // Clearing a book's group is also destructive. Keep the exact composite
  // Core shelf key until the second, visible confirmation.
  pendingBookGroupClearSourceId: string;
  pendingBookGroupClearBookId: string;
  rssSubscriptions: CoreRssSubscription[];
  rssItems: CoreRssItem[];
  rssLoaded: boolean;
  rssLoading: boolean;
  rssLoadError: string;
  rssItemFilter: RssItemFilter;
  rssRefreshStatus: RssRefreshStatus;
  rssRefreshMessage: string;
  // The RSS confirm route must name an actual subscription returned by Core.
  // Keep only its identity; the confirm page re-resolves it from live rows.
  pendingRssSubscriptionDeleteId: string;
  // Replacement-rule deletion stays inside the live reader replacement panel.
  // This key is set only after a persisted Core `rule-N` row is selected; the
  // confirm event re-validates it before the Core mutation is allowed.
  pendingReplaceRuleDeleteId: string;
  // ── B1 P0 全局设置 segment/stepper/switch 字段 ──
  appThemeMode: string;        // 'system' | 'light' | 'dark'
  coverColumns: number;        // 书架封面列数（1-5）
  settingsToggles: SettingsTogglesMap;
  // ── F3 交互连接字段 ──
  readerTheme: string;                    // 阅读主题: 'paper' | 'warm' | 'green' | 'blue'
  readerSettingExpandedOption: string;    // 当前展开的设置项 key（'' 表示无展开）
  autoPageMode: string;                   // 自动翻页模式: 'continuous' | 'single'
  // ── P1.2 select/action 控件展开状态 ──
  expandedOptionKey: string;              // 当前展开的 select 选项 key（'' 表示无展开）
  // Session-cache cleanup is intentionally a separate confirmation from the
  // generic settings action so a stale action event cannot clear Host cache.
  pendingCacheClear: boolean;
  // ── P1.3 WebDAV 配置字段 ──
  webdavServerUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavSyncDir: string;
  webdavTestStatus: string;               // 'idle' | 'testing' | 'success' | 'error'
  webdavTestMessage: string;
  webdavSaveStatus: string;               // 'idle' | 'saving' | 'saved' | 'error'
  webdavSaveMessage: string;
  // ── Core storage backup / restore ──
  // A portable snapshot is always produced and verified by Core.  The host
  // owns only the local-file/WebDAV transport and this projection deliberately
  // contains manifest metadata, never a copy of the snapshot payload.
  coreBackupStatus: string;               // idle | loading | creating | ready | restoring | success | error
  coreBackupMessage: string;
  localCoreBackup: CoreStorageBackupInfo | null;
  pendingCoreRestore: CoreStorageBackupInfo | null;
  // The checksum binds the visible second restore confirmation to exactly the
  // transient envelope that was validated by Core/Host preparation.
  pendingCoreRestoreConfirmationChecksum: string;
  // ── W1 本地书导入预览字段 ──
  importPreviewFormat: string;            // Core 实测导入格式（txt/epub/...）
  importPreviewEncoding: string;          // Core 从原始字节检测出的编码；不由 UI 猜测或指定
  importPreviewCount: number;             // Core 实测章节数
  // Monotonic local-import transaction token. It binds the transient raw bytes
  // held by Effects to the currently visible Core parse preview.
  localImportEpoch: number;
  // ── Core 书源包导入（与本地书籍导入分离） ──
  // The package itself is deliberately transient component state.  These
  // durable fields contain only Core-observed import accounting so the result
  // route never invents a successful import from its preview fixtures.
  sourceImportOrigin: string;
  sourceImportTotal: number;
  sourceImportImported: number;
  sourceImportSkipped: number;
  sourceImportFailed: number;
  sourceImportMessage: string;
  sourceImportRunning: boolean;
  // Monotonic transaction token for a Core book-source package import. It is
  // intentionally separate from localImportEpoch because the two Core flows
  // materialize different durable records.
  sourceImportEpoch: number;
  // ── W5 规则替换字段 ──
  replaceRules: ReplaceRule[];            // 内容替换规则列表
}

// UiEvent is a tagged record; the reducer switches on `type` and reads the relevant
// optional field. Kept as one interface (rather than a discriminated union) for
// ArkTS-narrowing safety.
export interface UiEvent {
  type: string;
  // Lossless generated-runtime payload. Native aliases may populate their
  // ergonomic fields below, but an effectful R14 migration must carry the
  // canonical nested DTO here instead of flattening JSON into strings.
  readerUIJSONPayload?: ReaderUIJSONPayload;
  id?: RouteId;
  tab?: MainTab;
  overlay?: Overlay;
  pageState?: PageState;
  mode?: ReaderMode;
  paginationMode?: ReaderPaginationMode;
  readerPageIndex?: number;
  readerPageCount?: number;
  readerChapterOffset?: number;
  readerChapterProgress?: number;
  readerMetric?: ReaderRenderMetric;
  value?: number;
  previousValue?: number;
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
  chapterToc?: ChapterTocEntry[];
  chapterTitle?: string;
  canonicalReaderLocation?: CoreReaderCanonicalLocation | null;
  readerContentIdentity?: ReaderContentIdentity | null;
  contentSearchResults?: CoreContentSearchResult[];
  contentSearchResultIndex?: number;
  contentSearchMessage?: string;
  bookmarks?: CoreBookmark[];
  bookmarkTime?: number;
  bookmarkError?: string;
  searchHistory?: string[];
  searchHistoryError?: string;
  bookId?: string;
  chapterId?: string;
  // Explicit compatibility marker for the pre-Pilot bookshelf alias. Only a
  // real reader-entry event may be observed as canonical book.open; book-detail
  // taps reuse the legacy alias but must remain native fallback.
  readerEntry?: boolean;
  sourceKind?: 'remote' | 'local';
  chapterIndex?: number;
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
  ttsCurrentSegment?: number;
  ttsTotalSegments?: number;
  toggleKey?: ReaderToggleKey;
  toggleValue?: boolean;
  optionKey?: ReaderSettingOptionKey;
  optionValue?: string;
  countdownSeconds?: number;
  // ── Batch 2 reader control event fields ──
  tocMode?: TocMode;
  // ── Batch 3 selection event fields ──
  selectionAction?: string;
  // Text selection is supplied only by ArkUI Text's native selection callback.
  // It is intentionally an event payload rather than a fixture/default so a
  // toolbar action can never operate on prose that the user did not select.
  selectedText?: string;
  // ── Batch 4 bookshelf/discover/source-switch event fields ──
  bookshelfView?: BookshelfView;
  bookshelfGroup?: string;
  bookshelfSort?: string;
  bookshelfFilterToggle?: string;  // 要切换的筛选标签
  discoverFilterToggle?: string;
  discoverSort?: string;
  discoverSources?: CoreSourceEntry[];
  discoverSourceId?: string;
  discoverKinds?: CoreDiscoverKind[];
  discoverKindUrl?: string;
  discoverKindTitle?: string;
  discoverBooks?: CoreDiscoverBook[];
  discoverError?: string;
  sourceCheckSourceId?: string;
  sourceCheckSourceName?: string;
  sourceCheckMessage?: string;
  sourceCheckError?: string;
  sourceCheckResult?: CoreSourceCheckResult | null;
  sourceDebugSourceId?: string;
  sourceDebugSourceName?: string;
  sourceDebugMessage?: string;
  sourceDebugError?: string;
  sourceDebugResult?: CoreSourceDebugResult | null;
  sourceId?: string;  // 换源时单个书源 id
  sourceIds?: string[]; // source-select-all 时的全部书源 id 列表
  sources?: CoreSourceEntry[]; // source-list-loaded
  bookshelfBooks?: CoreBookshelfBook[]; // bookshelf-list-loaded
  continueReadingBook?: CoreBookshelfBook | null;
  continueReadingError?: string;
  bookGroups?: CoreBookGroup[]; // book-group-list-loaded
  bookGroupId?: number;
  bookGroupName?: string;
  rssSubscriptions?: CoreRssSubscription[];
  rssItems?: CoreRssItem[];
  rssItemFilter?: RssItemFilter;
  rssLoadError?: string;
  rssRefreshMessage?: string;
  rssGuid?: string;
  rssSubscriptionId?: string;
  rssFeedUrl?: string;
  rssTitle?: string;
  rssEnabled?: boolean;
  bookAction?: string;  // 'branch' | 'delete'
  // Destructive operations have separate request/confirm events.  A raw
  // source-delete / rss-subscription-delete event is never a delete grant.
  // ── B1 P0 全局设置事件字段 ──
  settingsKey?: string;            // 设置项 key（appThemeMode / coverColumns / autoCheckUpdate …）
  settingsValue?: string;          // segment 选中值
  settingsToggleValue?: boolean;   // switch 切换值
  // ── F3 交互连接事件字段 ──
  settingOptionExpandedKey?: string;      // 设置项展开/收起的 key
  theme?: string;                         // 阅读主题
  autoPageMode?: string;                  // 自动翻页模式
  readerHostMessage?: string;
  // ── reader-module-switch 事件字段 ──
  module?: string;                        // 阅读器模块切换目标: directory/tts/appearance/settings/search/auto-page/replacement
  // ── P1.3 WebDAV 事件字段 ──
  field?: string;                         // webdav-field-update 的字段名
  success?: boolean;                      // webdav-test-result / webdav-save-result 是否成功
  message?: string;                       // webdav-test-result / webdav-save-result 消息
  coreBackupStatus?: string;
  coreBackupMessage?: string;
  coreBackupInfo?: CoreStorageBackupInfo | null;
  // ── W1 本地书导入事件字段 ──
  importFormat?: string;                  // source-import-preview: Core 实测格式
  importEncoding?: string;                // source-import-preview: Core 实测编码
  importCount?: number;                   // source-import-preview/apply: Core 实测章节数
  localImportEpoch?: number;
  // Raw JSON / URL are one-shot effect inputs and are never copied into
  // ReaderUiState.  A source package can be one Legado BookSource object or
  // an array of those objects.
  sourceImportPayload?: string;
  sourceImportUrl?: string;
  sourceImportOrigin?: string;
  sourceImportTotal?: number;
  sourceImportImported?: number;
  sourceImportSkipped?: number;
  sourceImportFailed?: number;
  sourceImportMessage?: string;
  sourceImportEpoch?: number;
  // ── W5 规则替换事件字段 ──
  replaceRuleId?: string;                 // 规则 id
  replaceRulePattern?: string;            // 规则匹配模式
  replaceRuleReplacement?: string;        // 规则替换文本
  replaceRuleScope?: string;              // 规则作用域
  replaceRuleEnabled?: boolean;           // 规则启用状态
  replaceRules?: ReplaceRule[];            // replace-rule-list-loaded
}

/** Metadata for an actual `runtime.storage.export` payload.  The JSON
 * snapshot itself is kept in the selected host file so it never leaks into
 * AppStorage or the UI state tree. */
export interface CoreStorageBackupInfo {
  source: string;
  schemaVersion: number;
  bytes: number;
  checksum: string;
  exportedAt: number;
}

// ── Minimal visible reading chain data types ──
export interface SearchResultEntry {
  title: string;
  author: string;
  bookId: string;
  // Set only from Core book.search results. It is carried into book.detail so
  // a result cannot silently fall back to a demo/default source.
  sourceId?: string;
  sourceName: string;
  sourceUrl: string;
  latestChapter?: string;
}

export interface BookDetail {
  bookId: string;
  sourceId?: string;
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
