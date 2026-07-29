// ReaderUiState — mirrors Reader UI/contracts/ui-state.schema.json (Phase 1 core fields).
// Owner: Platform Interaction Reducer. Durable UI state lives here, never inside page components.
import { RouteId } from '../../contract/generated/RouteTable';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';

export type MainTab = 'bookshelf' | 'discover' | 'rss' | 'settings';
export type ReaderMode = 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'permission';
export type ReaderPaginationMode = 'horizontal' | 'vertical';
export type ReaderFontFamily = 'system' | 'serif' | 'sans' | 'kai' | 'fangsong' | 'mono' | 'sourceSerif' | 'lxgw';
export type ReaderRenderMetric =
  | 'fontSize' | 'lineHeight' | 'paragraphGap' | 'letterSpacing'
  | 'topMargin' | 'sideMargin' | 'paragraphIndent';
export type PageState =
  | '' | 'default' | 'loading' | 'empty' | 'error' | 'offline' | 'permission'
  | 'cover-mode' | 'list-mode' | 'shelf-empty' | 'no-cover' | 'long-title'
  | 'switching-source-type' | 'source-empty' | 'source-unavailable' | 'network-failed'
  | 'refreshing' | 'no-subscription' | 'no-unread' | 'local-data-loading' | 'no-backup'
  | 'permission-missing' | 'topbar-action';
// Overlay follows Reader-UI's UiState contract. Reader control modules keep
// the canonical reading route stable and change this semantic field; the
// retired reader-*-overlay-v2 route family must never be reconstructed here.
// Harmony-owned transient overlays remain in the same single-owner field so
// overlay mutual exclusion is enforced by the reducer/runtime rather than by
// stacking hidden route entries.
export type Overlay =
  | '' | 'reader-control' | 'directory' | 'tts' | 'appearance' | 'settings'
  | 'auto-page' | 'content-search' | 'content-replacement'
  | 'reader-night-state' | 'reader-debug-info' | 'reader-book-cache'
  | 'source-switch' | 'book-action' | 'sort-filter' | 'group-management'
  | 'local-import' | 'bookshelf-multiselect' | 'batch-management'
  | 'keyboard' | 'dialog' | 'sheet' | 'toast';
// The confirmed local-book flow is an in-place overlay rather than a route.
// Keep its lifecycle separate from the global page `loading` state so the
// bookshelf stays visible behind the dialog.
export type LocalImportDialogPhase = 'idle' | 'loading' | 'result';
// The approved result view is intentionally terminal-only: every row is
// either imported or failed.  The one spinner-only loading surface owns all
// in-flight work; it never exposes a per-file progress list.
export type LocalImportDialogResultStatus = 'success' | 'failure';
// Figma Library/BookDetail/DeleteDialog 2269:66 exposes Default, Loading,
// and Failed.  The visual variants are Figma-owned; this small transaction
// state and its epoch remain local because Figma has no reactions for Core IO.
export type BookshelfRemovalDialogPhase = 'idle' | 'default' | 'loading' | 'failed';
export type BookshelfRemovalScope = 'single' | 'batch';
export interface BookshelfSelectionTarget {
  sourceId: string;
  bookId: string;
}
// Core returns this receipt for a batch write. It remains non-visual because
// the approved Figma flow has no extra completion page; it exists for exact
// state truth, stale-callback checks and test evidence.
export interface BookshelfRemovalReceipt {
  requestedCount: number;
  uniqueCount: number;
  removedTargets: BookshelfSelectionTarget[];
  missingTargets: BookshelfSelectionTarget[];
  duplicateTargets: BookshelfSelectionTarget[];
}
export interface LocalImportDialogResult {
  // Stable only within one picker batch. It deliberately contains no URI,
  // selected-file bytes, or Core payload.
  id?: string;
  fileName: string;
  status: LocalImportDialogResultStatus;
}
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
export type ReaderSettingOptionKey =
  | 'pageMode' | 'tapMode' | 'pageAnimation'
  | 'paragraphIndentMode' | 'textConversion' | 'textAlignment';

// ── Batch 4 bookshelf/discover/source-switch types ──
export type BookshelfView = 'cover' | 'list';

// ── B1 P0 全局设置 segment/stepper/switch 类型 ──
export type SettingsToggleKey =
  | 'autoCheckUpdate' | 'tapBottomBarToTop' | 'showUpdateBadge'
  | 'mergeSameBooks' | 'enableSearchHistory' | 'showLocalBookBadge';

export interface SettingsTogglesMap {
  autoCheckUpdate: boolean;
  tapBottomBarToTop: boolean;
  showUpdateBadge: boolean;
  mergeSameBooks: boolean;
  enableSearchHistory: boolean;
  showLocalBookBadge: boolean;
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

// `local` is a Core-owned transport identity, not a display label.  Every
// local-book branch must use this exact key so a filename or the visible
// “本地” badge can never accidentally enable remote-source operations.
export function isLocalBookSourceId(sourceId?: string): boolean {
  return (sourceId ?? '').trim() === 'local';
}

// A source replacement is meaningful only for a persisted remote source.  An
// empty id is also rejected: there is no safe fallback source for a book.
export function canSwitchBookSourceId(sourceId?: string): boolean {
  const normalized = (sourceId ?? '').trim();
  return normalized.length > 0 && !isLocalBookSourceId(normalized);
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

// The single resolver identity Core returns for `reader.location.resolve` on
// the reading surface. Both the Effects parser and the Reducer reflow anchor
// guard read this constant so a Core response with any other resolverVersion is
// rejected at the Effects layer (before any progress is written) and again at
// the reducer layer, never silently stored.
export const CANONICAL_RESOLVER_VERSION = 'reader.location.resolve.v1.reflow';

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
  // Migration-only mirror of `pageAnimation`; it must never be a separately
  // writable user-facing setting. `scroll` ⇔ vertical, all other animations ⇔
  // horizontal. Kept for persisted legacy payload compatibility.
  pageMode: string;
  tapMode: string;
  pageAnimation: string;
  paragraphIndentMode: string;
  textConversion: string;
  textAlignment: string;
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
  // The exact targets are retained for both the one-book and batch flows.
  // Batch remove must cross the Core boundary once as `bookshelf.removeBatch`.
  pendingBookshelfRemovalTargets: BookshelfSelectionTarget[];
  bookshelfRemovalScope: BookshelfRemovalScope;
  bookshelfRemovalDialogPhase: BookshelfRemovalDialogPhase;
  // Monotonic transaction identity. Async Core callbacks must match this
  // value as well as the exact source/book composite key before they project.
  bookshelfRemovalEpoch: number;
  bookshelfRemovalError: string;
  lastBookshelfRemovalReceipt: BookshelfRemovalReceipt | null;
  // A long-press action sheet is bound to one exact live bookshelf row.  It is
  // intentionally separate from the delete-confirmation key so merely opening
  // an edit menu never grants a destructive operation or reuses last-read book.
  pendingBookshelfActionSourceId: string;
  pendingBookshelfActionBookId: string;
  // Figma Bookshelf/MultiSelect: transient selected live shelf identities.
  // No group/move state is represented in V1.
  bookshelfSelectedTargets: BookshelfSelectionTarget[];
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
  // Latest visible Slice 10 command projection. The exact Core result stays
  // available to cache/download/undo surfaces instead of being reduced to a
  // console message. `method` identifies the strict result shape.
  coreSlice10Method: string;
  coreSlice10Loading: boolean;
  coreSlice10Result: ReaderUIJSONPayload | null;
  coreSlice10Error: string;
  // Only a successful Core replace.persist response may populate this token.
  // Generated ViewState/sample payloads are never copied into Store state.
  lastUndoToken: ReaderUIJSONPayload | null;
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
  // Verified, app-private local snapshot metadata in newest-first order. The
  // snapshot payload and selection bytes never enter AppStorage.
  localCoreBackupHistory: CoreStorageBackupHistoryEntry[];
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
  // Current production local-book flow: the user stays on the invoking page,
  // the system picker selects up to 32 files, and this overlay shows only the
  // loading or final per-file outcomes. It contains no paths, raw bytes or
  // parser details.
  localImportDialogPhase: LocalImportDialogPhase;
  localImportDialogEpoch: number;
  localImportDialogResults: LocalImportDialogResult[];
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
  previousEnabled?: boolean;
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
  // Startup-only projection of the validated Host preference pair. It is not
  // a UI option payload: `pageMode` remains a checked mirror of pageAnimation.
  preferencePageAnimation?: string;
  preferencePageMode?: string;
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
  bookshelfSelectionTargets?: BookshelfSelectionTarget[];
  bookshelfRemovalEpoch?: number;
  bookshelfRemovalError?: string;
  bookshelfRemovalReceipt?: BookshelfRemovalReceipt | null;
  // Destructive operations have separate request/confirm events.  A raw
  // source-delete / rss-subscription-delete event is never a delete grant.
  // ── B1 P0 全局设置事件字段 ──
  settingsKey?: string;            // 设置项 key（appThemeMode / autoCheckUpdate …）
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
  coreBackupHistory?: CoreStorageBackupHistoryEntry[];
  // A path must come from localCoreBackupHistory; effects rejects arbitrary
  // strings so a route event cannot select an unvalidated sandbox file.
  coreBackupPath?: string;
  coreSlice10Method?: string;
  coreSlice10Result?: ReaderUIJSONPayload | null;
  coreSlice10Error?: string;
  lastUndoToken?: ReaderUIJSONPayload | null;
  // ── W1 本地书导入事件字段 ──
  importFormat?: string;                  // source-import-preview: Core 实测格式
  importEncoding?: string;                // source-import-preview: Core 实测编码
  importCount?: number;                   // source-import-preview/apply: Core 实测章节数
  localImportEpoch?: number;
  localImportDialogEpoch?: number;
  localImportDialogResults?: LocalImportDialogResult[];
  localImportDialogResultIndex?: number;
  localImportDialogResultStatus?: LocalImportDialogResultStatus;
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

/** AppStorage-safe metadata for one validated local snapshot. */
export interface CoreStorageBackupHistoryEntry extends CoreStorageBackupInfo {
  path: string;
  fileName: string;
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
  // Optional display fields already returned by Core `book.search`. They stay
  // on the existing result identity rather than creating a second visual-only
  // search model for the Figma result rows.
  coverUrl?: string;
  intro?: string;
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
