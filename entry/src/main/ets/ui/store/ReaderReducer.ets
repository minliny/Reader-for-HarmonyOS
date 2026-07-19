// ReaderReducer — pure function reduce(state, event) -> new state.
// No side effects. ArkTS forbids object spread (arkts-no-spread), so each method builds a
// new ReaderUiState literal field-by-field (array spread is still allowed).
import { RouteId, RouteTable } from '../../contract/generated/RouteTable';
import { ReaderAppearanceSpecRegistry, ReaderAppearanceStepper } from '../../contract/reader_ui/Appearance';
import { ReaderUiState, UiEvent, MainTab, Overlay, PageState, ReaderMode, ReaderPaginationMode, ReaderFontFamily, ReaderRenderMetric, RouteEntry, ReaderError, SearchResultEntry, BookDetail, ActiveSession, TtsPlaybackState, TtsScope, TtsTimer, TocMode, ReaderToggleKey, ReaderSettingOptionKey, ReaderTogglesMap, ReaderSettingOptionsMap, BookshelfView, BookshelfFilterState, DiscoverFilterState, CoreDiscoverKind, CoreDiscoverBook, CoreSourceEntry, CoreSourceCheckResult, CoreSourceDebugResult, CoreContentSearchResult, CoreBookmark, SettingsTogglesMap, ReplaceRule, CoreRssSubscription, CoreRssItem, RssItemFilter, ChapterTocEntry, CoreStorageBackupInfo, CoreReaderCanonicalLocation } from './ReaderUiState';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';

function tabRoot(tab: MainTab): RouteId {
  switch (tab) {
    case 'bookshelf': return 'bookshelf';
    case 'discover': return 'discover';
    case 'rss': return 'rss';
    case 'settings': return 'settings';
    default: return 'bookshelf';
  }
}

// reader-module-switch 辅助：native-owned module 名称 -> overlay 路由 id。
// directory 已由 ReaderUIRuntime Pilot 独占，不再进入本地 reducer。
// 调用方应先用 isValidReaderModule 校验，避免命中 default 回退分支。
function moduleRouteId(module: string): RouteId {
  switch (module) {
    case 'tts': return 'reader-tts-overlay-v2';
    case 'appearance': return 'reader-appearance-overlay-v2';
    case 'settings': return 'reader-settings-overlay-v2';
    case 'search': return 'reader-search-overlay-v2';
    case 'auto-page': return 'reader-auto-scroll-overlay-v2';
    case 'replacement': return 'reader-replace-overlay-v2';
    default: return 'reader-tts-overlay-v2';
  }
}

// 判断一个 routeId 是否是 reader 模块 overlay 路由（用于 reader-module-switch
// 的 replace/push 决策：栈顶已是模块 overlay 时 replace，否则 push）。
function isReaderModuleOverlay(routeId: string): boolean {
  return routeId === 'reader-directory-overlay-v2' ||
    routeId === 'reader-tts-overlay-v2' ||
    routeId === 'reader-appearance-overlay-v2' ||
    routeId === 'reader-settings-overlay-v2' ||
    routeId === 'reader-search-overlay-v2' ||
    routeId === 'reader-auto-scroll-overlay-v2' ||
    routeId === 'reader-replace-overlay-v2';
}

// 校验 module 名称是否是受支持的 reader 模块。
function isValidReaderModule(module: string): boolean {
  return module === 'tts' || module === 'appearance' ||
    module === 'settings' || module === 'search' || module === 'auto-page' ||
    module === 'replacement';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMetric(value: number, precision: number): number {
  if (precision === 2) return Math.round(value * 100) / 100;
  if (precision === 1) return Math.round(value * 10) / 10;
  return Math.round(value);
}

function metricMin(metric: ReaderRenderMetric): number {
  const appearance: ReaderAppearanceStepper | undefined = ReaderAppearanceSpecRegistry.stepper(metric);
  if (appearance !== undefined) return appearance.minimum;
  switch (metric) {
    case 'fontSize': return 14;
    case 'lineHeight': return 1.4;
    case 'paragraphGap': return 4;
    case 'letterSpacing': return 0;
    case 'topMargin': return 48;
    case 'sideMargin': return 20;
    case 'paragraphIndent': return 0;
    default: return 0;
  }
}

function metricMax(metric: ReaderRenderMetric): number {
  const appearance: ReaderAppearanceStepper | undefined = ReaderAppearanceSpecRegistry.stepper(metric);
  if (appearance !== undefined) return appearance.maximum;
  switch (metric) {
    case 'fontSize': return 26;
    case 'lineHeight': return 2.4;
    case 'paragraphGap': return 32;
    case 'letterSpacing': return 2;
    case 'topMargin': return 96;
    case 'sideMargin': return 48;
    case 'paragraphIndent': return 3;
    default: return 100;
  }
}

function metricStep(metric: ReaderRenderMetric): number {
  const appearance: ReaderAppearanceStepper | undefined = ReaderAppearanceSpecRegistry.stepper(metric);
  if (appearance !== undefined) return appearance.step;
  switch (metric) {
    case 'fontSize': return 1;
    case 'lineHeight': return 0.08;
    case 'paragraphGap': return 2;
    case 'letterSpacing': return 0.2;
    case 'topMargin': return 4;
    case 'sideMargin': return 4;
    case 'paragraphIndent': return 0.5;
    default: return 1;
  }
}

function metricPrecision(metric: ReaderRenderMetric): number {
  const appearance: ReaderAppearanceStepper | undefined = ReaderAppearanceSpecRegistry.stepper(metric);
  if (appearance !== undefined) return appearance.precision;
  switch (metric) {
    case 'lineHeight': return 2;
    case 'letterSpacing': return 1;
    case 'paragraphIndent': return 1;
    default: return 0;
  }
}

function normalizeMetricValue(metric: ReaderRenderMetric, value: number): number {
  return roundMetric(clamp(value, metricMin(metric), metricMax(metric)), metricPrecision(metric));
}

export class ReaderReducer {
  static reduce(state: ReaderUiState, event: UiEvent): ReaderUiState {
    // 事件名归一化：点号（reader.exit / route.pop / reader.module.switch 等）
    // -> kebab-case，使契约层点号事件能命中现有/新增 case。
    const normalizedType = event.type.replace(/\./g, '-');
    switch (normalizedType) {
      case 'route-push': {
        const id = event.id;
        return id !== undefined ? ReaderReducer.push(state, id) : state;
      }
      case 'route-pop':
        return ReaderReducer.pop(state);
      case 'route-replace': {
        const id = event.id;
        return id !== undefined ? ReaderReducer.replace(state, id) : state;
      }
      case 'switch-tab': {
        const tab = event.tab;
        return tab !== undefined ? ReaderReducer.switchTab(state, tab) : state;
      }
      case 'set-overlay': {
        const o = event.overlay;
        return o !== undefined ? ReaderReducer.setOverlay(state, o) : state;
      }
      case 'set-page-state': {
        const p = event.pageState;
        return p !== undefined ? ReaderReducer.setPageState(state, p) : state;
      }
      case 'set-reader-mode': {
        const m = event.mode;
        return m !== undefined ? ReaderReducer.setReaderMode(state, m) : state;
      }
      case 'set-pagination-mode': {
        const m = event.paginationMode;
        return m !== undefined ? ReaderReducer.setPaginationMode(state, m) : state;
      }
      case 'set-reader-page-count': {
        const count = event.readerPageCount;
        return count !== undefined ? ReaderReducer.setReaderPageCount(state, count) : state;
      }
      case 'set-reader-page-index': {
        const index = event.readerPageIndex;
        return index !== undefined ? ReaderReducer.setReaderPageIndex(state, index) : state;
      }
      case 'reader-location-anchor': {
        const offset = event.readerChapterOffset;
        const progress = event.readerChapterProgress;
        return offset !== undefined && progress !== undefined
          ? ReaderReducer.setReaderLocationAnchor(state, offset, progress, event.bookId ?? '',
            event.sourceId ?? '', event.chapterIndex ?? -1) : state;
      }
      case 'step-reader-render-metric': {
        const metric = event.readerMetric;
        const delta = event.delta;
        return metric !== undefined && delta !== undefined ? ReaderReducer.stepReaderRenderMetric(state, metric, delta) : state;
      }
      case 'set-reader-render-metric': {
        const metric = event.readerMetric;
        const value = event.value;
        return metric !== undefined && value !== undefined ? ReaderReducer.setReaderRenderMetric(state, metric, value) : state;
      }
      case 'set-reader-font-family': {
        const family = event.fontFamily;
        return family !== undefined ? ReaderReducer.setReaderFontFamily(state, family) : state;
      }
      case 'reset-reader-render-settings':
        return ReaderReducer.resetReaderRenderSettings(state);
      case 'toggle-reduced-motion': {
        const e = event.enabled;
        return e !== undefined ? ReaderReducer.setReducedMotion(state, e) : state;
      }
      case 'hydrate-reduced-motion': {
        const e = event.enabled;
        return e !== undefined ? ReaderReducer.setReducedMotion(state, e) : state;
      }
      case 'set-loading': {
        const l = event.loading;
        return l !== undefined ? ReaderReducer.setLoading(state, l) : state;
      }
      case 'retry-last-operation':
        return ReaderReducer.clearErrorForRetry(state);
      case 'set-error': {
        const err = event.error !== undefined ? event.error : null;
        return ReaderReducer.setError(state, err);
      }
      case 'first-open-done':
        return ReaderReducer.firstOpenDone(state);
      case 'search-submit': {
        const q = event.query ?? '';
        return ReaderReducer.setSearchQuery(state, q);
      }
      case 'search-start':
        return ReaderReducer.setLoading(state, true);
      case 'search-success': {
        const results = event.searchResults ?? [];
        return ReaderReducer.setSearchResults(state, results);
      }
      case 'search-failure': {
        const err: ReaderError = event.error ?? { code: 'SEARCH_FAILED', message: 'search failed', retryable: false };
        return ReaderReducer.setError(state, err);
      }
      case 'book-detail-load':
        return ReaderReducer.setRouteLoading(state);
      case 'bookshelf-book-open': {
        // This legacy alias is shared by detail taps and reader entry. Only the
        // explicitly marked reader-entry form mirrors canonical book.open:
        // enter the immersive route and expose loading in one reducer pass so
        // the shadow runtime observes the same single semantic transition.
        if (event.readerEntry !== true) return state;
        return ReaderReducer.setRouteLoading(ReaderReducer.push(state, 'immersive-reading'));
      }
      case 'book-detail-success': {
        const book = event.book ?? null;
        return ReaderReducer.setCurrentBook(state, book);
      }
      case 'chapter-load':
        return ReaderReducer.setChapterLoading(state, event.chapterTitle);
      case 'chapter-success': {
        const paras = event.chapterParagraphs ?? [];
        return ReaderReducer.setChapterContent(state, paras, event.chapterTitle,
          event.bookId ?? '', event.sourceId ?? '', event.chapterIndex ?? -1);
      }
      case 'reader-location-resolved':
        return ReaderReducer.setCanonicalReaderLocation(state, event.canonicalReaderLocation ?? null);
      case 'chapter-toc-loaded':
        return ReaderReducer.setChapterToc(state, event.chapterToc ?? []);
      case 'content-search-submit':
        return ReaderReducer.beginContentSearch(state, event.query ?? '');
      case 'content-search-success':
        return ReaderReducer.finishContentSearch(state, event.contentSearchResults ?? []);
      case 'content-search-failure':
        return ReaderReducer.failContentSearch(state, event.contentSearchMessage ?? 'Core 正文搜索失败。');
      case 'content-search-jump-status':
        return ReaderReducer.setContentSearchMessage(state, event.contentSearchMessage ?? '');
      // Bookmark state is separate from the directory loading flag: an empty
      // Core bookmark list must not turn an otherwise readable chapter into a
      // global loading/error page.
      case 'bookmark-list-start':
        return ReaderReducer.setBookmarksLoading(state);
      case 'bookmark-create':
        return ReaderReducer.requestBookmarkCreate(state);
      case 'bookmark-delete-request':
        return ReaderReducer.requestBookmarkDelete(state, event.bookmarkTime ?? -1);
      case 'bookmark-delete-confirm':
        return ReaderReducer.confirmBookmarkDelete(state, event.bookmarkTime ?? -1);
      case 'bookmark-delete-cancel':
        return ReaderReducer.cancelBookmarkDelete(state);
      case 'bookmark-delete-complete':
        return ReaderReducer.completeBookmarkDelete(state);
      case 'bookmark-delete':
        return ReaderReducer.setBookmarkOperationError(
          state, '请先选择当前 Core 书签，并在当前列表中再次确认删除。',
        );
      case 'bookmark-list-loaded':
        return ReaderReducer.setBookmarks(state, event.bookmarks ?? []);
      case 'bookmark-list-failed':
        return ReaderReducer.setBookmarksError(state, event.bookmarkError ?? event.message ?? '书签读取失败');
      case 'bookmark-operation-failed':
        return ReaderReducer.setBookmarkOperationError(
          state, event.bookmarkError ?? event.message ?? '书签操作失败',
        );
      case 'search-history-load-start':
        return ReaderReducer.setSearchHistoryLoading(state);
      case 'search-history-clear-request':
        return ReaderReducer.requestSearchHistoryClear(state);
      case 'search-history-clear-confirm':
        return ReaderReducer.confirmSearchHistoryClear(state);
      case 'search-history-clear-cancel':
        return ReaderReducer.cancelSearchHistoryClear(state);
      case 'search-history-clear-complete':
        return ReaderReducer.completeSearchHistoryClear(state);
      case 'search-history-clear':
        return ReaderReducer.setSearchHistoryOperationError(
          state, '请先在搜索历史页确认清空 Core 中的全部历史记录。',
        );
      case 'search-history-clear-not-applied':
        return ReaderReducer.setSearchHistoryOperationError(
          state, event.searchHistoryError ?? event.message ?? 'Core 未清空搜索历史；已重新读取当前记录。',
        );
      case 'search-history-loaded':
        return ReaderReducer.setSearchHistory(state, event.searchHistory ?? []);
      case 'search-history-failed':
        return ReaderReducer.setSearchHistoryError(
          state, event.searchHistoryError ?? event.message ?? '搜索历史读取失败',
        );
      // ── Batch 1 session/TTS/settings cases ──
      case 'set-active-session': {
        const s = event.session;
        return s !== undefined ? ReaderReducer.setActiveSession(state, s) : state;
      }
      case 'tts-toggle':
        return ReaderReducer.toggleTtsPlayback(state);
      case 'tts-prev':
        return ReaderReducer.stepTtsSegment(state, -1);
      case 'tts-next':
        return ReaderReducer.stepTtsSegment(state, +1);
      case 'tts-set-rate': {
        const r = event.ttsRate;
        return r !== undefined ? ReaderReducer.setTtsRate(state, r) : state;
      }
      case 'tts-set-voice': {
        const v = event.ttsVoice;
        return v !== undefined ? ReaderReducer.setTtsVoice(state, v) : state;
      }
      case 'tts-set-scope': {
        const sc = event.ttsScope;
        return sc !== undefined ? ReaderReducer.setTtsScope(state, sc) : state;
      }
      case 'tts-set-timer': {
        const t = event.ttsTimer;
        return t !== undefined ? ReaderReducer.setTtsTimer(state, t) : state;
      }
      case 'tts-segments-loaded':
        return ReaderReducer.setTtsSegments(state, event.ttsCurrentSegment ?? 0, event.ttsTotalSegments ?? 0);
      case 'auto-page-toggle':
        return ReaderReducer.toggleAutoPage(state);
      case 'session-capsule-countdown-tick':
        return ReaderReducer.tickAutoPageCountdown(state);
      case 'set-reader-toggle': {
        const k = event.toggleKey;
        const v = event.toggleValue;
        return k !== undefined && v !== undefined ? ReaderReducer.setReaderToggle(state, k, v) : state;
      }
      case 'set-reader-setting-option': {
        const k = event.optionKey;
        const v = event.optionValue;
        return k !== undefined && v !== undefined ? ReaderReducer.setReaderSettingOption(state, k, v) : state;
      }
      // ── F3 交互连接 cases ──
      case 'set-reader-setting-option-expanded': {
        const ek = event.settingOptionExpandedKey;
        return ek !== undefined ? ReaderReducer.setReaderSettingOptionExpanded(state, ek) : state;
      }
      case 'set-reader-theme': {
        const th = event.theme;
        return th !== undefined ? ReaderReducer.setReaderTheme(state, th) : state;
      }
      case 'auto-page-step-interval': {
        const d = event.delta;
        return d !== undefined ? ReaderReducer.stepAutoPageInterval(state, d) : state;
      }
      case 'auto-page-set-mode': {
        const m = event.autoPageMode;
        return m !== undefined ? ReaderReducer.setAutoPageMode(state, m) : state;
      }
      // ── Batch 2 reader control cases ──
      case 'chapter-prev':
        // No-op: chapter list / current index not tracked in state yet.
        // Kept as a case so default doesn't swallow the event; component layer
        // dispatches chapter-load directly when a target chapterId is known.
        return state;
      case 'chapter-next':
        // No-op: see chapter-prev.
        return state;
      case 'chapter-progress-seek': {
        const v = event.value;
        return v !== undefined ? ReaderReducer.chapterProgressSeek(state, v) : state;
      }
      case 'set-brightness': {
        const v = event.value;
        return v !== undefined ? ReaderReducer.setBrightness(state, v) : state;
      }
      // Effects use these reducer-only acknowledgements when a direct window
      // Host call rejects.  They deliberately do not re-enter the Host effect,
      // avoiding a retry loop that could leave UI and device state divergent.
      case 'reader-brightness-host-revert': {
        const v = event.value;
        return v !== undefined ? ReaderReducer.setBrightness(state, v) : state;
      }
      case 'reader-toggle-host-revert': {
        const k = event.toggleKey;
        const v = event.toggleValue;
        return k !== undefined && v !== undefined ? ReaderReducer.setReaderToggle(state, k, v) : state;
      }
      case 'reader-host-message':
        return ReaderReducer.setReaderHostMessage(state, event.readerHostMessage ?? '');
      case 'toggle-brightness-auto': {
        const e = event.enabled;
        return e !== undefined ? ReaderReducer.setBrightnessAuto(state, e) : state;
      }
      case 'set-toc-mode': {
        const m = event.tocMode;
        return m !== undefined ? ReaderReducer.setTocMode(state, m) : state;
      }
      // ── Batch 3 selection cases ──
      case 'selection-show':
        return ReaderReducer.setNativeSelection(state, event.selectedText ?? '');
      case 'selection-close':
        return ReaderReducer.clearSelection(state);
      case 'selection-action': {
        const a = event.selectionAction;
        return a !== undefined ? ReaderReducer.setSelectionAction(state, a) : state;
      }
      case 'selection-clear':
        return ReaderReducer.clearSelection(state);
      // ── Batch 4 bookshelf/discover/source-switch cases ──
      case 'set-bookshelf-view': {
        const v = event.bookshelfView;
        return v !== undefined ? ReaderReducer.setBookshelfView(state, v) : state;
      }
      case 'set-bookshelf-group': {
        const g = event.bookshelfGroup;
        return g !== undefined ? ReaderReducer.setBookshelfGroup(state, g) : state;
      }
      case 'set-bookshelf-sort': {
        const s = event.bookshelfSort;
        return s !== undefined ? ReaderReducer.setBookshelfSort(state, s) : state;
      }
      case 'set-bookshelf-filter-toggle': {
        const f = event.bookshelfFilterToggle;
        return f !== undefined ? ReaderReducer.toggleBookshelfFilter(state, f) : state;
      }
      case 'set-bookshelf-filter-clear':
        return ReaderReducer.clearBookshelfFilters(state);
      case 'set-discover-filter-toggle': {
        const f = event.discoverFilterToggle;
        return f !== undefined ? ReaderReducer.toggleDiscoverFilter(state, f) : state;
      }
      case 'set-discover-sort': {
        const s = event.discoverSort;
        return s !== undefined ? ReaderReducer.setDiscoverSort(state, s) : state;
      }
      // Discover owns its own Core projection.  These events deliberately do
      // not use global set-error/set-loading because a failed source.explore
      // request must keep the Discover tab and its recovery controls visible.
      case 'discover-load-start':
      case 'discover-refresh':
      case 'discover-source-cycle':
      case 'discover-source-select':
      case 'discover-kind-select':
        return ReaderReducer.setDiscoverLoading(state);
      case 'discover-data-loaded':
        return ReaderReducer.setDiscoverData(
          state,
          event.discoverSources ?? [],
          event.discoverSourceId ?? '',
          event.discoverKinds ?? [],
          event.discoverKindUrl ?? '',
          event.discoverKindTitle ?? '',
          event.discoverBooks ?? [],
        );
      case 'discover-source-resolved':
        return ReaderReducer.setDiscoverSourceResolved(
          state,
          event.discoverSources ?? [],
          event.discoverSourceId ?? '',
        );
      case 'discover-failed':
        return ReaderReducer.setDiscoverError(state, event.discoverError ?? event.message ?? '发现内容加载失败');
      case 'source-toggle': {
        const id = event.sourceId;
        return id !== undefined ? ReaderReducer.selectSingleSource(state, id) : state;
      }
      case 'source-select-all': {
        const ids = event.sourceIds ?? [];
        // Compatibility only: source switching is intentionally single-select.
        // Older callers cannot turn one Core request into an invisible
        // multi-source selection; only the first supplied persisted source can
        // become the current radio selection.
        return ids.length > 0 ? ReaderReducer.selectSingleSource(state, ids[0]) : state;
      }
      case 'source-clear':
        return ReaderReducer.clearSources(state);
      case 'source-detail-open': {
        const sourceId = event.sourceId ?? '';
        return ReaderReducer.openSourceDetail(state, sourceId);
      }
      case 'source-delete-request':
        return ReaderReducer.requestSourceDelete(state, event.sourceId ?? '');
      case 'source-delete-confirm':
        return ReaderReducer.confirmSourceDelete(state);
      case 'source-list-loaded': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        const sources = event.sources ?? [];
        next.availableSources = sources;
        next.sourcesLoaded = true;
        next.loading = false;
        const selectedSourceId = state.selectedSourceId ?? '';
        let selectedStillExists = false;
        for (let i = 0; i < sources.length; i++) {
          if (sources[i].sourceId === selectedSourceId) {
            selectedStillExists = true;
            break;
          }
        }
        next.selectedSourceId = selectedStillExists ? selectedSourceId : '';
        const selectedForSwitch = state.sourceSelection.length === 1 ? state.sourceSelection[0] : '';
        let switchSelectionStillExists = false;
        for (let i = 0; i < sources.length; i++) {
          if (sources[i].sourceId === selectedForSwitch && sources[i].enabled) {
            switchSelectionStillExists = true;
            break;
          }
        }
        next.sourceSelection = switchSelectionStillExists ? [selectedForSwitch] : [];
        return next;
      }
      case 'source-detect-run':
      case 'source-check-start':
        return ReaderReducer.setSourceCheckLoading(
          state,
          event.sourceCheckSourceId ?? state.selectedSourceId ?? '',
          event.sourceCheckSourceName ?? '',
        );
      case 'source-check-source-resolved':
        return ReaderReducer.setSourceCheckResolved(
          state,
          event.sourceCheckSourceId ?? '',
          event.sourceCheckSourceName ?? '',
        );
      case 'source-check-empty':
        return ReaderReducer.setSourceCheckEmpty(
          state,
          event.sourceCheckSourceId ?? '',
          event.sourceCheckMessage ?? '未选择有效书源。',
        );
      case 'source-check-success':
        return ReaderReducer.setSourceCheckResult(
          state,
          event.sourceCheckResult ?? null,
          event.sourceCheckMessage ?? '',
        );
      case 'source-check-failed':
        return ReaderReducer.setSourceCheckFailed(
          state,
          event.sourceCheckError ?? event.message ?? '书源诊断请求失败。',
        );
      case 'source-debug-select':
        return ReaderReducer.selectSourceForDebug(state, event.sourceId ?? '');
      case 'source-debug-run':
      case 'source-debug-start':
        return ReaderReducer.setSourceDebugLoading(
          state,
          event.sourceDebugSourceId ?? state.selectedSourceId ?? '',
          event.sourceDebugSourceName ?? '',
        );
      case 'source-debug-source-resolved':
        return ReaderReducer.setSourceDebugResolved(
          state,
          event.sourceDebugSourceId ?? '',
          event.sourceDebugSourceName ?? '',
        );
      case 'source-debug-empty':
        return ReaderReducer.setSourceDebugEmpty(
          state,
          event.sourceDebugSourceId ?? '',
          event.sourceDebugMessage ?? '未选择可调测的已启用书源。',
        );
      case 'source-debug-success':
        return ReaderReducer.setSourceDebugResult(
          state,
          event.sourceDebugResult ?? null,
          event.sourceDebugMessage ?? '',
        );
      case 'source-debug-failed':
        return ReaderReducer.setSourceDebugFailed(
          state,
          event.sourceDebugError ?? event.message ?? '书源调测请求失败。',
        );
      case 'bookshelf-list-loaded': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.bookshelfBooks = event.bookshelfBooks ?? [];
        next.bookshelfLoaded = true;
        next.loading = false;
        if (!ReaderReducer.hasGroupedBookshelfBook(next,
          next.pendingBookGroupClearSourceId, next.pendingBookGroupClearBookId)) {
          ReaderReducer.clearBookGroupClearTargetInPlace(next);
        }
        return next;
      }
      case 'continue-reading-loaded': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.continueReadingBook = event.continueReadingBook ?? null;
        next.continueReadingLoaded = true;
        next.continueReadingError = event.continueReadingError ?? '';
        return next;
      }
      case 'book-group-create':
        return ReaderReducer.requestBookGroupCreate(state, event.bookGroupName ?? '');
      case 'book-group-update':
        return ReaderReducer.requestBookGroupUpdate(state, event.bookGroupId ?? 0, event.bookGroupName ?? '');
      case 'book-group-load-start':
        return ReaderReducer.setBookGroupsLoading(state);
      case 'book-group-assign':
        return ReaderReducer.requestBookGroupAssignment(
          state, event.sourceId ?? '', event.bookId ?? '', event.bookshelfGroup ?? '',
        );
      case 'book-group-clear-request':
        return ReaderReducer.requestBookGroupClear(state, event.sourceId ?? '', event.bookId ?? '');
      case 'book-group-clear-confirm':
        return ReaderReducer.confirmBookGroupClear(state, event.sourceId ?? '', event.bookId ?? '');
      case 'book-group-clear-cancel':
        return ReaderReducer.cancelBookGroupClear(state);
      case 'book-group-clear-complete':
        return ReaderReducer.completeBookGroupClear(state);
      // A raw legacy delete event is deliberately not a Core write grant.
      // The visible row must first bind a current Core group, then issue the
      // separate confirm event while the management route is still visible.
      case 'book-group-delete-request':
        return ReaderReducer.requestBookGroupDelete(state, event.bookGroupId ?? 0);
      case 'book-group-delete-confirm':
        return ReaderReducer.confirmBookGroupDelete(state, event.bookGroupId ?? 0);
      case 'book-group-delete-cancel':
        return ReaderReducer.cancelBookGroupDelete(state);
      case 'book-group-delete-complete':
        return ReaderReducer.completeBookGroupDelete(state);
      case 'book-group-delete':
        return ReaderReducer.setBookGroupsError(state,
          '请先选择当前 Core 分组，并在可见的删除确认区再次确认。');
      case 'book-group-list-loaded': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.bookGroups = event.bookGroups ?? [];
        next.bookGroupsLoaded = true;
        next.bookGroupsLoading = false;
        next.bookGroupsError = '';
        if (!ReaderReducer.hasBookGroup(next, next.pendingBookGroupDeleteId)) {
          ReaderReducer.clearBookGroupDeleteTargetInPlace(next);
        }
        return next;
      }
      case 'book-group-list-failed':
      case 'book-group-operation-failed':
        return ReaderReducer.setBookGroupsError(state, event.message ?? '分组操作失败');
      case 'rss-subscription-add':
        return ReaderReducer.requestRssSubscriptionAdd(state, event.rssFeedUrl ?? '');
      case 'rss-subscription-update':
        return ReaderReducer.requestRssSubscriptionUpdate(state, event.rssSubscriptionId ?? '');
      case 'rss-item-open':
        return ReaderReducer.requestRssItemRead(state, event.rssGuid ?? '', event.rssSubscriptionId ?? '');
      case 'rss-load-start': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.rssLoading = true;
        next.rssLoadError = '';
        return next;
      }
      case 'rss-filter-set': {
        const requested = event.rssItemFilter;
        if (requested !== 'all' && requested !== 'unread') return state;
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.rssItemFilter = requested as RssItemFilter;
        next.rssLoading = true;
        next.rssLoadError = '';
        return next;
      }
      case 'rss-data-loaded': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.rssSubscriptions = event.rssSubscriptions ?? [];
        next.rssItems = event.rssItems ?? [];
        next.rssLoaded = true;
        next.rssLoading = false;
        next.rssLoadError = '';
        next.loading = false;
        if (!ReaderReducer.hasRssSubscription(next, state.pendingRssSubscriptionDeleteId)) {
          next.pendingRssSubscriptionDeleteId = '';
        }
        return next;
      }
      case 'rss-load-failed': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.rssLoading = false;
        next.rssLoadError = event.rssLoadError ?? event.message ?? '读取 RSS 条目失败。';
        return next;
      }
      case 'rss-refresh-start': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.rssRefreshStatus = 'refreshing';
        next.rssRefreshMessage = '正在刷新启用订阅源…';
        return next;
      }
      case 'rss-refresh-success': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.rssRefreshStatus = 'success';
        next.rssRefreshMessage = event.rssRefreshMessage ?? event.message ?? 'RSS 刷新完成。';
        return next;
      }
      case 'rss-refresh-failed': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.rssRefreshStatus = 'error';
        next.rssRefreshMessage = event.rssRefreshMessage ?? event.message ?? 'RSS 刷新失败。';
        return next;
      }
      case 'rss-subscription-delete-request':
        return ReaderReducer.requestRssSubscriptionDelete(state, event.rssSubscriptionId ?? '');
      case 'rss-subscription-delete-confirm':
        return ReaderReducer.confirmRssSubscriptionDelete(state, event.rssSubscriptionId ?? '');
      case 'rss-subscription-delete-cancel':
        return ReaderReducer.cancelRssSubscriptionDelete(state);
      case 'rss-subscription-delete-complete':
        return ReaderReducer.completeRssSubscriptionDelete(state);
      case 'rss-item-read-confirmed': {
        const guid = event.rssGuid ?? '';
        const subscriptionId = event.rssSubscriptionId ?? '';
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        let wasUnread = false;
        const updatedItems: CoreRssItem[] = [];
        for (let i = 0; i < state.rssItems.length; i++) {
          const item = state.rssItems[i];
          const matches = item.guid === guid && item.subscriptionId === subscriptionId;
          if (!matches) {
            updatedItems.push(item);
            continue;
          }
          wasUnread = !item.read;
          // The unread-only screen is a Core request projection.  Removing a
          // confirmed read row here is only the immediate result; Effects
          // immediately re-queries Core with unreadOnly=true to settle it.
          if (state.rssItemFilter === 'unread') continue;
          updatedItems.push({
            subscriptionId: item.subscriptionId,
            guid: item.guid,
            title: item.title,
            description: item.description,
            author: item.author,
            pubDate: item.pubDate,
            link: item.link,
            sourceTitle: item.sourceTitle,
            read: true,
          });
        }
        next.rssItems = updatedItems;
        if (wasUnread) {
          const subscriptions: CoreRssSubscription[] = [];
          for (let i = 0; i < state.rssSubscriptions.length; i++) {
            const subscription = state.rssSubscriptions[i];
            subscriptions.push({
              subscriptionId: subscription.subscriptionId,
              feedUrl: subscription.feedUrl,
              title: subscription.title,
              enabled: subscription.enabled,
              unreadCount: subscription.subscriptionId === subscriptionId
                ? Math.max(0, subscription.unreadCount - 1) : subscription.unreadCount,
            });
          }
          next.rssSubscriptions = subscriptions;
        }
        return next;
      }
      case 'book-action': {
        const a = event.bookAction;
        return a !== undefined ? ReaderReducer.handleBookAction(state, a) : state;
      }
      case 'bookshelf-remove-cancel':
      case 'bookshelf-remove-complete':
        return ReaderReducer.clearBookshelfRemovalConfirmation(state);
      // ── B1 P0 全局设置 segment/stepper/switch cases ──
      case 'settings-segment-switch': {
        const key = event.settingsKey;
        const val = event.settingsValue;
        return key !== undefined && val !== undefined ? ReaderReducer.switchSettingsSegment(state, key, val) : state;
      }
      case 'settings-stepper-change': {
        const key = event.settingsKey;
        const delta = event.delta;
        return key !== undefined && delta !== undefined ? ReaderReducer.stepSettingsStepper(state, key, delta) : state;
      }
      case 'settings-switch-toggle': {
        const key = event.settingsKey;
        const val = event.settingsToggleValue;
        return key !== undefined && val !== undefined ? ReaderReducer.toggleSettingsSwitch(state, key, val) : state;
      }
      // ── P1.2 select/action 控件 cases ──
      case 'settings-select-open': {
        const key = event.settingsKey;
        return key !== undefined ? ReaderReducer.openSettingsSelect(state, key) : state;
      }
      case 'settings-select-close':
        return ReaderReducer.closeSettingsSelect(state);
      case 'settings-action': {
        // Cache cleanup has its own visible confirmation. Other action keys
        // retain their existing reducer/effect behavior.
        const key = event.settingsKey;
        if (key === 'cache-clear') return ReaderReducer.requestCacheClear(state);
        return key !== undefined ? ReaderReducer.markSettingsAction(state, key) : state;
      }
      case 'cache-clear-confirm':
        return ReaderReducer.confirmCacheClear(state);
      case 'cache-clear-cancel':
      case 'cache-clear-complete':
        return ReaderReducer.cancelCacheClear(state);
      case 'core-slice10-start':
        return ReaderReducer.beginCoreSlice10(state, event.coreSlice10Method ?? '');
      case 'core-slice10-succeeded':
        return ReaderReducer.completeCoreSlice10(
          state, event.coreSlice10Method ?? '', event.coreSlice10Result ?? null,
        );
      case 'core-slice10-failed':
        return ReaderReducer.failCoreSlice10(
          state, event.coreSlice10Method ?? '', event.coreSlice10Error ?? '', event.error ?? null,
        );
      case 'core-slice10-undo-token-captured':
        return event.lastUndoToken !== undefined && event.lastUndoToken !== null
          ? ReaderReducer.captureCoreUndoToken(state, event.lastUndoToken) : state;
      case 'cache-clear':
        return ReaderReducer.setError(state, {
          code: 'CACHE_CLEAR_CONFIRM_REQUIRED',
          message: '请在通用设置中先打开缓存清理确认，再次确认后才会清理 Core 章节缓存。',
          retryable: false,
        });
      // ── P1.3 WebDAV 配置 cases ──
      case 'webdav-field-update': {
        const field = event.field;
        const val = event.settingsValue;
        return field !== undefined && val !== undefined ? ReaderReducer.updateWebdavField(state, field, val) : state;
      }
      case 'webdav-test':
        return ReaderReducer.requestWebdavTest(state);
      case 'webdav-test-result': {
        if (state.routeId !== 'webdav-config' || state.webdavTestStatus !== 'testing') return state;
        const ok = event.success === true;
        return ReaderReducer.setWebdavTestStatus(state, ok ? 'success' : 'error', event.message ?? '');
      }
      case 'webdav-save':
        return ReaderReducer.requestWebdavSave(state);
      case 'webdav-save-result': {
        if (state.routeId !== 'webdav-config' || state.webdavSaveStatus !== 'saving') return state;
        const ok = event.success === true;
        return ReaderReducer.setWebdavSaveStatus(state, ok ? 'saved' : 'error', event.message ?? '');
      }
      // ── Core storage backup / restore projection ──
      // `runtime.storage.export/apply` owns data integrity; the reducer only
      // records Host-file selection/status and never carries the payload.
      case 'core-backup-create-local':
        return ReaderReducer.requestCoreBackupCreate(state, false);
      case 'core-backup-create-webdav':
        return ReaderReducer.requestCoreBackupCreate(state, true);
      case 'core-backup-status':
        return ReaderReducer.setCoreBackupStatus(state, event.coreBackupStatus ?? 'idle', event.coreBackupMessage ?? '');
      case 'core-backup-local-loaded':
        return ReaderReducer.setLocalCoreBackup(state, event.coreBackupInfo ?? null, event.coreBackupMessage ?? '');
      case 'core-restore-prepared':
        return ReaderReducer.setPendingCoreRestore(state, event.coreBackupInfo ?? null, event.coreBackupMessage ?? '');
      case 'core-restore-cleared':
        return ReaderReducer.setPendingCoreRestore(state, null, event.coreBackupMessage ?? '');
      case 'core-restore-apply-request':
        return ReaderReducer.requestCoreRestoreApply(state);
      case 'core-restore-apply-confirm':
        return ReaderReducer.confirmCoreRestoreApply(state);
      case 'core-restore-apply-cancel':
        return ReaderReducer.cancelCoreRestoreApply(state);
      case 'core-backup-apply':
        return ReaderReducer.rejectCoreRestoreApply(state);
      // ── 契约事件 cases（reader-exit / reader-module-switch / reader-page-prev / source-switch-*）──
      case 'reader-exit': {
        // 一次弹尽 ReaderShell 路由，回到非阅读器页（书详情/书架）。
        let stack = state.stack.slice();
        while (stack.length > 1) {
          const top = stack[stack.length - 1].id;
          if (RouteTable.shellOf(top) !== 'ReaderShell') break;
          stack = stack.slice(0, -1);
        }
        if (stack.length === state.stack.length) return state;
        const top = stack[stack.length - 1];
        // Reader exit is also a lifecycle boundary for the direct Host
        // controls.  Effects releases the actual screen/TTS resources; clear
        // their visible state here so a returned reader never claims a stale
        // auto-page or keep-screen-on session is still active.
        let exited = ReaderReducer.clone(state, top.id, state.tab, '', stack, 'default');
        exited.activeSession = '';
        exited.ttsSession = {
          playback: 'idle',
          rate: state.ttsSession.rate,
          voice: state.ttsSession.voice,
          scope: state.ttsSession.scope,
          timer: state.ttsSession.timer,
          currentSegment: 0,
          totalSegments: 0,
        };
        exited.autoPageSession = {
          playing: false,
          countdownSeconds: 0,
          intervalSeconds: state.autoPageSession.intervalSeconds,
        };
        exited = ReaderReducer.setReaderToggle(exited, 'autoPage', false);
        exited = ReaderReducer.setReaderToggle(exited, 'keepScreenOn', false);
        ReaderReducer.clearReplaceRuleDeleteTargetInPlace(exited);
        ReaderReducer.clearBookmarkDeleteTargetInPlace(exited);
        ReaderReducer.clearSearchHistoryClearTargetInPlace(exited);
        return exited;
      }
      case 'reader-module-switch': {
        // Native-owned 模块切换（replace 语义）。directory open/close 已由
        // Store 前置归一并交给 ReaderUIRuntime Pilot，禁止在此重复处理。
        const module = event.module ?? '';
        if (!isValidReaderModule(module)) return state;
        const targetId = moduleRouteId(module);
        if (state.stack.length > 0 && isReaderModuleOverlay(state.stack[state.stack.length - 1].id)) {
          return ReaderReducer.replace(state, targetId);
        }
        return ReaderReducer.push(state, targetId);
      }
      case 'reader-page-prev':
        return ReaderReducer.setReaderPageIndex(state, state.readerPageIndex - 1);
      case 'reader-page-next':
        return ReaderReducer.setReaderPageIndex(state, state.readerPageIndex + 1);
      case 'source-switch-confirm':
        // Keep the source-switch route visible until the full Core-backed
        // replacement transaction commits. An empty/invalid selection remains
        // in this route with a visible validation error instead of silently
        // returning to the reader.
        return ReaderReducer.beginSourceSwitch(state);
      case 'source-switch-completed':
        return state.routeId === 'source-switch' ? ReaderReducer.completeSourceSwitch(state) : state;
      case 'source-switch-failed':
        return state.routeId === 'source-switch'
          ? ReaderReducer.setSourceSwitchError(
            state, 'SOURCE_SWITCH_FAILED', event.message ?? '换源失败，请检查所选书源后重试。',
          ) : state;
      case 'source-switch-cancel':
        return state.routeId === 'source-switch' ? ReaderReducer.cancelSourceSwitch(state) : state;
      // ── W1 资源导入 cases（source.import.* 归一化为 source-import-*）──
      case 'source-import-open':
        // 打开本地导入页：push 'local-import' 路由。
        return ReaderReducer.openLocalImport(state);
      case 'local-import-parse-start':
        return ReaderReducer.beginLocalImportParse(state, event.localImportEpoch ?? -1);
      case 'source-import-preview': {
        // 设置由 Core local_book.parse 从原始字节测得的格式、编码和章节数。
        const fmt = event.importFormat ?? '';
        const encoding = event.importEncoding ?? '';
        const cnt = event.importCount ?? 0;
        return ReaderReducer.setImportPreview(state, fmt, encoding, cnt, event.localImportEpoch ?? -1);
      }
      case 'source-import-apply': {
        // 等待 Effects 调用 Core bookshelf.add；不能在持久化确认前离开页面。
        return ReaderReducer.requestLocalImportCommit(state, event.importCount ?? -1);
      }
      case 'source-import-committed': {
        const cnt = event.importCount ?? 0;
        return ReaderReducer.applyImport(state, cnt);
      }
      // A book-source package is not a local-book import.  Keep its accounting
      // on a separate state path so the result page reflects individual Core
      // source.import responses rather than the local-book preview count.
      case 'source-package-import-json':
      case 'source-package-import-url':
      case 'source-package-import-clipboard':
        return ReaderReducer.beginSourcePackageImport(state, event.sourceImportOrigin ?? '书源包');
      case 'source-package-import-result':
        return ReaderReducer.completeSourcePackageImport(
          state,
          event.sourceImportOrigin ?? '书源包',
          event.sourceImportTotal ?? 0,
          event.sourceImportImported ?? 0,
          event.sourceImportSkipped ?? 0,
          event.sourceImportFailed ?? 0,
          event.sourceImportMessage ?? '',
          event.sourceImportEpoch ?? -1,
        );
      // ── W5 规则替换 cases（replace.rule.* 归一化为 replace-rule-*）──
      case 'replace-rule-add': {
        const pattern = event.replaceRulePattern ?? '';
        const replacement = event.replaceRuleReplacement ?? '';
        const scope = event.replaceRuleScope ?? 'chapter';
        // A new rule has no Core id yet.  Never let a caller-provided id or a
        // UI-local id masquerade as Core's canonical `rule-N` identity.
        if (state.routeId !== 'reader-replace-overlay-v2' || pattern.trim().length === 0) {
          return ReaderReducer.setError(state, {
            code: 'REPLACE_RULE_CREATE_TARGET_REQUIRED',
            message: '请在当前阅读器替换面板填写规则后再创建。',
            retryable: false,
          });
        }
        return ReaderReducer.addReplaceRule(state, pattern, replacement, scope);
      }
      case 'replace-rule-edit': {
        const id = event.replaceRuleId ?? '';
        if (!ReaderReducer.canMutatePersistentReplaceRule(state, id)) {
          return ReaderReducer.setError(state, {
            code: 'REPLACE_RULE_UPDATE_TARGET_REQUIRED',
            message: '只能在当前阅读器中编辑一条仍由 Core 保存的规则。',
            retryable: false,
          });
        }
        return ReaderReducer.editReplaceRule(state, id, event.replaceRulePattern ?? '', event.replaceRuleReplacement ?? '', event.replaceRuleScope ?? 'chapter');
      }
      // Deletion is intentionally a three-step state machine. A raw legacy
      // `replace-rule-delete` event is never a write grant: it must first bind
      // a persisted Core row, then receive a visible second confirmation.
      case 'replace-rule-delete-request':
        return ReaderReducer.requestReplaceRuleDelete(state, event.replaceRuleId ?? '');
      case 'replace-rule-delete-confirm':
        return ReaderReducer.confirmReplaceRuleDelete(state);
      case 'replace-rule-delete-cancel':
        return ReaderReducer.cancelReplaceRuleDelete(state);
      case 'replace-rule-delete-complete':
        return ReaderReducer.completeReplaceRuleDelete(state);
      case 'replace-rule-delete':
        return ReaderReducer.setError(state, {
          code: 'REPLACE_RULE_DELETE_CONFIRM_REQUIRED',
          message: '请先选择一条已保存的规则，并在当前阅读器中再次确认删除。',
          retryable: false,
        });
      case 'replace-rule-toggle': {
        const id = event.replaceRuleId ?? '';
        if (!ReaderReducer.canMutatePersistentReplaceRule(state, id)) {
          return ReaderReducer.setError(state, {
            code: 'REPLACE_RULE_UPDATE_TARGET_REQUIRED',
            message: '只能在当前阅读器中更新一条仍由 Core 保存的规则。',
            retryable: false,
          });
        }
        return ReaderReducer.toggleReplaceRule(state, id);
      }
      case 'replace-rule-list-loaded': {
        const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
        next.replaceRules = event.replaceRules ?? [];
        if (!ReaderReducer.hasPersistentReplaceRule(next, next.pendingReplaceRuleDeleteId)) {
          ReaderReducer.clearReplaceRuleDeleteTargetInPlace(next);
        }
        return next;
      }
      default:
        return state;
    }
  }

  static push(state: ReaderUiState, id: RouteId): ReaderUiState {
    if (ReaderReducer.hasActiveLocalImportCommit(state)) return state;
    const entry: RouteEntry = { id: id };
    const stack: RouteEntry[] = [...state.stack, entry];
    const next = ReaderReducer.clone(state, id, state.tab, '', stack, 'default');
    // A source choice is scoped to one switch attempt. Any navigation starts
    // a new epoch so an async transaction from a page we left cannot mutate
    // the old bookshelf key after a later re-entry.
    ReaderReducer.resetSourceSwitchScopeInPlace(next);
    ReaderReducer.clearBookshelfRemovalTargetInPlace(next);
    ReaderReducer.clearBookGroupDeleteTargetInPlace(next);
    ReaderReducer.clearBookGroupClearTargetInPlace(next);
    ReaderReducer.clearReplaceRuleDeleteTargetInPlace(next);
    ReaderReducer.clearBookmarkDeleteTargetInPlace(next);
    ReaderReducer.clearSearchHistoryClearTargetInPlace(next);
    ReaderReducer.clearCacheClearConfirmationInPlace(next);
    ReaderReducer.clearCoreRestoreConfirmationInPlace(next);
    ReaderReducer.clearLocalImportPreviewInPlace(next);
    ReaderReducer.clearSourcePackageImportInPlace(next);
    return next;
  }

  static pop(state: ReaderUiState): ReaderUiState {
    if (ReaderReducer.hasActiveLocalImportCommit(state)) return state;
    if (state.stack.length <= 1) return state;
    const stack = state.stack.slice(0, -1);
    const top = stack[stack.length - 1];
    const next = ReaderReducer.clone(state, top.id, state.tab, '', stack, 'default');
    ReaderReducer.resetSourceSwitchScopeInPlace(next);
    ReaderReducer.clearBookshelfRemovalTargetInPlace(next);
    ReaderReducer.clearBookGroupDeleteTargetInPlace(next);
    ReaderReducer.clearBookGroupClearTargetInPlace(next);
    ReaderReducer.clearReplaceRuleDeleteTargetInPlace(next);
    ReaderReducer.clearBookmarkDeleteTargetInPlace(next);
    ReaderReducer.clearSearchHistoryClearTargetInPlace(next);
    ReaderReducer.clearCacheClearConfirmationInPlace(next);
    ReaderReducer.clearCoreRestoreConfirmationInPlace(next);
    ReaderReducer.clearLocalImportPreviewInPlace(next);
    ReaderReducer.clearSourcePackageImportInPlace(next);
    return next;
  }

  static replace(state: ReaderUiState, id: RouteId): ReaderUiState {
    if (ReaderReducer.hasActiveLocalImportCommit(state)) return state;
    if (state.stack.length === 0) return ReaderReducer.push(state, id);
    const stack = state.stack.slice(0, -1);
    stack.push({ id: id });
    const next = ReaderReducer.clone(state, id, state.tab, '', stack, 'default');
    ReaderReducer.resetSourceSwitchScopeInPlace(next);
    ReaderReducer.clearBookshelfRemovalTargetInPlace(next);
    ReaderReducer.clearBookGroupDeleteTargetInPlace(next);
    ReaderReducer.clearBookGroupClearTargetInPlace(next);
    ReaderReducer.clearReplaceRuleDeleteTargetInPlace(next);
    ReaderReducer.clearBookmarkDeleteTargetInPlace(next);
    ReaderReducer.clearSearchHistoryClearTargetInPlace(next);
    ReaderReducer.clearCacheClearConfirmationInPlace(next);
    ReaderReducer.clearCoreRestoreConfirmationInPlace(next);
    ReaderReducer.clearLocalImportPreviewInPlace(next);
    ReaderReducer.clearSourcePackageImportInPlace(next);
    return next;
  }

  static switchTab(state: ReaderUiState, tab: MainTab): ReaderUiState {
    if (ReaderReducer.hasActiveLocalImportCommit(state)) return state;
    const root = tabRoot(tab);
    const stack: RouteEntry[] = [{ id: root }];
    const next = ReaderReducer.clone(state, root, tab, '', stack, 'default');
    ReaderReducer.resetSourceSwitchScopeInPlace(next);
    ReaderReducer.clearBookshelfRemovalTargetInPlace(next);
    ReaderReducer.clearBookGroupDeleteTargetInPlace(next);
    ReaderReducer.clearBookGroupClearTargetInPlace(next);
    ReaderReducer.clearReplaceRuleDeleteTargetInPlace(next);
    ReaderReducer.clearBookmarkDeleteTargetInPlace(next);
    ReaderReducer.clearSearchHistoryClearTargetInPlace(next);
    ReaderReducer.clearCacheClearConfirmationInPlace(next);
    ReaderReducer.clearCoreRestoreConfirmationInPlace(next);
    ReaderReducer.clearLocalImportPreviewInPlace(next);
    ReaderReducer.clearSourcePackageImportInPlace(next);
    return next;
  }

  static setOverlay(state: ReaderUiState, overlay: Overlay): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, overlay, state.stack, state.pageState);
    if (overlay !== 'dialog') ReaderReducer.clearBookshelfRemovalTargetInPlace(next);
    if (overlay !== 'dialog') ReaderReducer.clearReplaceRuleDeleteTargetInPlace(next);
    ReaderReducer.clearBookmarkDeleteTargetInPlace(next);
    ReaderReducer.clearSearchHistoryClearTargetInPlace(next);
    return next;
  }

  static setPageState(state: ReaderUiState, pageState: PageState): ReaderUiState {
    return ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, pageState);
  }

  static setReaderMode(state: ReaderUiState, mode: ReaderMode): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.readerMode = mode;
    return next;
  }

  static setPaginationMode(state: ReaderUiState, mode: ReaderPaginationMode): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.paginationMode = mode;
    // A page number is layout-specific, but the Core chapter anchor is not.
    // ReadingTextFlow will derive a new visual page/scroll position from the
    // retained scalar offset after the new layout has been measured.
    next.readerPageIndex = 0;
    return next;
  }

  static setReaderPageCount(state: ReaderUiState, count: number): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.readerPageCount = Math.max(1, Math.round(count));
    next.readerPageIndex = clamp(next.readerPageIndex, 0, next.readerPageCount - 1);
    return next;
  }

  static setReaderPageIndex(state: ReaderUiState, index: number): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.readerPageIndex = clamp(Math.round(index), 0, Math.max(0, next.readerPageCount - 1));
    return next;
  }

  static setReaderLocationAnchor(state: ReaderUiState, chapterOffset: number,
    chapterProgress: number, bookId: string, sourceId: string, chapterIndex: number): ReaderUiState {
    const active = state.activeReaderContentIdentity;
    if (active === null || bookId !== active.bookId || sourceId !== active.sourceId ||
      chapterIndex !== active.chapterIndex) {
      return state;
    }
    const normalizedOffset = Math.max(0, Math.floor(chapterOffset));
    const normalizedProgress = clamp(chapterProgress, 0, 1);
    if (state.readerChapterOffset === normalizedOffset &&
      Math.abs(state.readerChapterProgress - normalizedProgress) < 0.000001) {
      return state;
    }
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab,
      state.overlay, state.stack, state.pageState);
    next.readerChapterOffset = normalizedOffset;
    next.readerChapterProgress = normalizedProgress;
    return next;
  }

  static stepReaderRenderMetric(state: ReaderUiState, metric: ReaderRenderMetric, delta: number): ReaderUiState {
    return ReaderReducer.setReaderRenderMetric(state, metric, ReaderReducer.readerRenderMetricValue(state, metric) + delta * metricStep(metric));
  }

  static setReaderRenderMetric(state: ReaderUiState, metric: ReaderRenderMetric, value: number): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const normalized = normalizeMetricValue(metric, value);
    switch (metric) {
      case 'fontSize':
        next.fontSize = normalized;
        break;
      case 'lineHeight':
        next.lineHeight = normalized;
        break;
      case 'paragraphGap':
        next.paragraphGap = normalized;
        break;
      case 'letterSpacing':
        next.letterSpacing = normalized;
        break;
      case 'topMargin':
        next.topMargin = normalized;
        break;
      case 'sideMargin':
        next.sideMargin = normalized;
        break;
      case 'paragraphIndent':
        next.paragraphIndent = normalized;
        break;
      default:
        break;
    }
    // Typography and margins reflow pages; they must not rewrite the durable
    // chapter-local anchor as page zero.
    next.readerPageIndex = 0;
    return next;
  }

  static setReaderFontFamily(state: ReaderUiState, family: ReaderFontFamily): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.fontFamily = family;
    next.readerPageIndex = 0;
    return next;
  }

  static resetReaderRenderSettings(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.fontSize = 18;
    next.lineHeight = 1.96;
    next.paragraphGap = 16;
    next.letterSpacing = 0;
    next.fontFamily = 'serif';
    next.topMargin = 72;
    next.sideMargin = 32;
    next.paragraphIndent = 2;
    next.readerPageIndex = 0;
    return next;
  }

  static setReducedMotion(state: ReaderUiState, enabled: boolean): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.reducedMotion = enabled;
    return next;
  }

  static setLoading(state: ReaderUiState, loading: boolean): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.loading = loading;
    return next;
  }

  // Route-level loading: switch pageState to 'loading' so the route's loading
  // ViewState (e.g. book-detail/loading → Loading component) renders instead of
  // the default fixture body. Callers MUST dispatch route-push first, then the
  // load event, so pageState='loading' lands on the new route rather than being
  // reset to 'default' by route-push.
  static setRouteLoading(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, 'loading');
    next.loading = true;
    next.error = null;
    return next;
  }

  static setError(state: ReaderUiState, error: ReaderError | null): ReaderUiState {
    // On error: clear loading so loading spinners stop, and switch pageState to
    // 'error' so the route's error ViewState renders (e.g. book-detail/error,
    // reader/error, search-error). Without this, a failed book-detail-load /
    // chapter-load / search-submit would stay on the loading page with the
    // error only written into state but never surfaced to the UI.
    const pageState: PageState = error !== null ? 'error' : state.pageState;
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, pageState);
    next.error = error;
    next.loading = false;
    return next;
  }

  static beginCoreSlice10(state: ReaderUiState, method: string): ReaderUiState {
    if (method.length === 0) return state;
    const next = ReaderReducer.clone(
      state, state.routeId, state.tab, state.overlay, state.stack, state.pageState,
    );
    next.coreSlice10Method = method;
    next.coreSlice10Loading = true;
    next.coreSlice10Result = null;
    next.coreSlice10Error = '';
    if (next.error !== null && (next.error.code.startsWith('CORE_SLICE10_') ||
      (method === 'cache.clear' && next.error.code === 'CACHE_CLEAR_FAILED'))) next.error = null;
    return next;
  }

  static completeCoreSlice10(state: ReaderUiState, method: string,
    result: ReaderUIJSONPayload | null): ReaderUiState {
    if (method.length === 0 || result === null) return state;
    const next = ReaderReducer.clone(
      state, state.routeId, state.tab, state.overlay, state.stack, state.pageState,
    );
    next.coreSlice10Method = method;
    next.coreSlice10Loading = false;
    next.coreSlice10Result = result;
    next.coreSlice10Error = '';
    if (method === 'replace.undo') next.lastUndoToken = null;
    if (next.error !== null && (next.error.code.startsWith('CORE_SLICE10_') ||
      (method === 'cache.clear' && next.error.code === 'CACHE_CLEAR_FAILED'))) next.error = null;
    return next;
  }

  static failCoreSlice10(state: ReaderUiState, method: string, message: string,
    error: ReaderError | null): ReaderUiState {
    if (method.length === 0) return state;
    const next = ReaderReducer.clone(
      state, state.routeId, state.tab, state.overlay, state.stack, state.pageState,
    );
    next.coreSlice10Method = method;
    next.coreSlice10Loading = false;
    next.coreSlice10Result = null;
    next.coreSlice10Error = message;
    next.error = error;
    return next;
  }

  static captureCoreUndoToken(state: ReaderUiState,
    token: ReaderUIJSONPayload): ReaderUiState {
    const next = ReaderReducer.clone(
      state, state.routeId, state.tab, state.overlay, state.stack, state.pageState,
    );
    next.lastUndoToken = token;
    return next;
  }

  static clearErrorForRetry(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, 'default');
    next.error = null;
    next.loading = false;
    next.readerMode = 'default';
    return next;
  }

  static firstOpenDone(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.firstOpenPlayed = true;
    next.loading = false;
    return next;
  }

  static setSearchQuery(state: ReaderUiState, query: string): ReaderUiState {
    if (!ReaderReducer.isSearchSubmissionRoute(state.routeId) || query.trim().length === 0) {
      return state;
    }
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.searchQuery = query;
    next.loading = true;
    next.pageState = 'loading';
    next.error = null;
    return next;
  }

  private static isSearchSubmissionRoute(routeId: string): boolean {
    return routeId === 'book-search' || routeId === 'search-home' || routeId === 'search-results';
  }

  static setSearchResults(state: ReaderUiState, results: SearchResultEntry[]): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.searchResults = results;
    next.loading = false;
    next.pageState = results.length === 0 ? 'empty' : 'default';
    next.error = null;
    return next;
  }

  static setCurrentBook(state: ReaderUiState, book: BookDetail | null): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const previous = state.currentBook;
    const bookChanged = previous === null || book === null
      || previous.bookId !== book.bookId || previous.sourceId !== book.sourceId;
    next.currentBook = book;
    // chapterToc belongs to one source/book pair.  Keeping the previous book's
    // directory during the next detail fetch makes a real Core result appear
    // under the wrong title, which is indistinguishable from a fixture.
    if (bookChanged) {
      next.chapterToc = [];
      next.chapterContent = [];
      next.currentChapterTitle = '';
      next.canonicalReaderLocation = null;
      next.activeReaderContentIdentity = null;
      next.readerPageIndex = 0;
      next.contentSearchQuery = '';
      next.contentSearchResults = [];
      next.contentSearchLoading = false;
      next.contentSearchLoaded = false;
      next.contentSearchError = '';
      next.contentSearchMessage = '';
      // Bookmark rows are scoped by Core only through the book title/author
      // pair. Clear the previous projection before a new book is allowed to
      // render it, then the effect reloads when the bookmark tab is active.
      next.bookmarks = [];
      next.bookmarksLoaded = false;
      next.bookmarksLoading = false;
      next.bookmarksError = '';
    }
    next.loading = false;
    next.pageState = 'default';
    next.error = null;
    return next;
  }

  static setChapterLoading(state: ReaderUiState, chapterTitle?: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.setRouteLoading(state);
    if (chapterTitle !== undefined && chapterTitle.length > 0) {
      next.currentChapterTitle = chapterTitle;
    }
    return next;
  }

  static setChapterToc(state: ReaderUiState, toc: ChapterTocEntry[]): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.chapterToc = toc;
    return next;
  }

  static setChapterContent(state: ReaderUiState, paragraphs: string[], chapterTitle: string | undefined,
    bookId: string, sourceId: string, chapterIndex: number): ReaderUiState {
    if (state.currentBook === null || bookId.length === 0 || sourceId.length === 0 ||
      !Number.isSafeInteger(chapterIndex) || chapterIndex < 0 || state.currentBook.bookId !== bookId ||
      (state.currentBook.sourceId ?? '') !== sourceId) {
      return state;
    }
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, 'default');
    next.chapterContent = paragraphs;
    next.activeReaderContentIdentity = { bookId: bookId, sourceId: sourceId, chapterIndex: chapterIndex };
    // A new body invalidates the previous chapter's canonical anchor until
    // Core confirms the measured layout for this exact chapter.
    next.canonicalReaderLocation = null;
    if (chapterTitle !== undefined && chapterTitle.length > 0) {
      next.currentChapterTitle = chapterTitle;
    }
    next.readerPageIndex = 0;
    next.readerChapterOffset = 0;
    next.readerChapterProgress = 0;
    next.loading = false;
    next.readerMode = 'default';
    next.error = null;
    return next;
  }

  static setCanonicalReaderLocation(state: ReaderUiState,
    location: CoreReaderCanonicalLocation | null): ReaderUiState {
    if (location !== null) {
      const active = state.activeReaderContentIdentity;
      if (active === null || active.bookId !== location.bookId || active.chapterIndex !== location.chapterIndex) {
        return state;
      }
    }
    const next: ReaderUiState = ReaderReducer.clone(
      state, state.routeId, state.tab, state.overlay, state.stack, state.pageState,
    );
    next.canonicalReaderLocation = location;
    if (location !== null) {
      next.readerChapterOffset = Math.max(0, Math.floor(location.chapterOffset));
      next.readerChapterProgress = clamp(location.chapterProgress, 0, 1);
    }
    return next;
  }

  // `search.content` is intentionally isolated from the global title-search
  // loading/error state. A body-search failure must not turn the currently
  // readable chapter into an error page.
  static beginContentSearch(state: ReaderUiState, query: string): ReaderUiState {
    if ((state.routeId !== 'reader-search-overlay-v2' && state.routeId !== 'content-search') ||
      query.trim().length === 0) {
      return state;
    }
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.contentSearchQuery = query.trim();
    next.contentSearchResults = [];
    next.contentSearchLoading = true;
    next.contentSearchLoaded = false;
    next.contentSearchError = '';
    next.contentSearchMessage = '';
    return next;
  }

  static finishContentSearch(state: ReaderUiState, results: CoreContentSearchResult[]): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.contentSearchResults = results;
    next.contentSearchLoading = false;
    next.contentSearchLoaded = true;
    next.contentSearchError = '';
    return next;
  }

  static failContentSearch(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.contentSearchResults = [];
    next.contentSearchLoading = false;
    next.contentSearchLoaded = true;
    next.contentSearchError = message;
    next.contentSearchMessage = '';
    return next;
  }

  static setContentSearchMessage(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.contentSearchMessage = message;
    return next;
  }

  // ── Core bookmarks / title-search history ───────────────────────────

  static setBookmarksLoading(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookmarksLoading = true;
    next.bookmarksError = '';
    return next;
  }

  // Bookmark creation is a reader-only action. Keep the reducer-side gate in
  // front of Effects so a forged event cannot put an unrelated page into a
  // misleading bookmark-loading state.
  static requestBookmarkCreate(state: ReaderUiState): ReaderUiState {
    const active = state.activeReaderContentIdentity;
    if (!ReaderReducer.isBookmarkCreateRoute(state.routeId) || state.currentBook === null ||
      active === null || active.bookId !== state.currentBook.bookId ||
      active.sourceId !== (state.currentBook.sourceId ?? '') || state.chapterContent.length === 0 ||
      state.currentChapterTitle.trim().length === 0) {
      return ReaderReducer.setBookmarkOperationError(state,
        '请在当前已加载正文的阅读器中创建书签。');
    }
    if (state.bookmarksLoading) return state;
    return ReaderReducer.setBookmarksLoading(state);
  }

  static setBookmarks(state: ReaderUiState, bookmarks: CoreBookmark[]): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookmarks = bookmarks;
    next.bookmarksLoaded = true;
    next.bookmarksLoading = false;
    next.bookmarksError = '';
    if (!ReaderReducer.hasCurrentBookmark(next, next.pendingBookmarkDeleteTime)) {
      ReaderReducer.clearBookmarkDeleteTargetInPlace(next);
    }
    return next;
  }

  static setBookmarksError(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookmarks = [];
    next.bookmarksLoaded = true;
    next.bookmarksLoading = false;
    next.bookmarksError = message;
    ReaderReducer.clearBookmarkDeleteTargetInPlace(next);
    return next;
  }

  // Create/delete/jump failures must leave the last known Core rows visible
  // so the user can retry or choose another bookmark; only a list failure
  // invalidates the entire projection.
  static setBookmarkOperationError(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookmarksLoading = false;
    next.bookmarksError = message;
    return next;
  }

  // A bookmark deletion is bound to the current Core bookmark list and the
  // current book's title/author scope before the visible second confirmation.
  static requestBookmarkDelete(state: ReaderUiState, time: number): ReaderUiState {
    if (!ReaderReducer.isBookmarkDeleteRoute(state.routeId) || state.bookmarksLoading ||
      state.pendingBookmarkDeleteTime >= 0 || !ReaderReducer.hasCurrentBookmark(state, time)) {
      return ReaderReducer.setBookmarkOperationError(state,
        '请从当前 Core 书签列表选择一条书签后再删除。');
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.pendingBookmarkDeleteTime = time;
    next.bookmarksError = '';
    return next;
  }

  static confirmBookmarkDelete(state: ReaderUiState, time: number): ReaderUiState {
    if (!ReaderReducer.isBookmarkDeleteRoute(state.routeId) || state.bookmarksLoading ||
      time !== state.pendingBookmarkDeleteTime || !ReaderReducer.hasCurrentBookmark(state, time)) {
      return ReaderReducer.setBookmarkOperationError(state,
        '书签删除确认已失效；请重新从当前 Core 列表选择目标。');
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookmarksLoading = true;
    next.bookmarksError = '';
    return next;
  }

  static cancelBookmarkDelete(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    ReaderReducer.clearBookmarkDeleteTargetInPlace(next);
    return next;
  }

  static completeBookmarkDelete(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookmarksLoading = false;
    next.bookmarksError = '';
    ReaderReducer.clearBookmarkDeleteTargetInPlace(next);
    return next;
  }

  private static isBookmarkDeleteRoute(routeId: string): boolean {
    return routeId === 'toc-bookmarks' || routeId === 'reader-directory-overlay-v2' ||
      routeId === 'bookmarks-manager';
  }

  private static isBookmarkCreateRoute(routeId: string): boolean {
    return routeId === 'reader' || routeId === 'control-layer-base-v2';
  }

  private static hasCurrentBookmark(state: ReaderUiState, time: number): boolean {
    if (!Number.isSafeInteger(time) || time < 0 || state.currentBook === null) return false;
    for (let i = 0; i < state.bookmarks.length; i++) {
      const bookmark = state.bookmarks[i];
      if (bookmark.time === time && bookmark.bookName === state.currentBook.title &&
        bookmark.bookAuthor === state.currentBook.author) {
        return true;
      }
    }
    return false;
  }

  private static clearBookmarkDeleteTargetInPlace(state: ReaderUiState): void {
    state.pendingBookmarkDeleteTime = -1;
  }

  static setSearchHistoryLoading(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.searchHistoryLoading = true;
    next.searchHistoryError = '';
    return next;
  }

  static setSearchHistory(state: ReaderUiState, history: string[]): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.searchHistory = history;
    next.searchHistoryLoaded = true;
    next.searchHistoryLoading = false;
    next.searchHistoryError = '';
    if (history.length === 0) ReaderReducer.clearSearchHistoryClearTargetInPlace(next);
    return next;
  }

  static setSearchHistoryError(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.searchHistory = [];
    next.searchHistoryLoaded = true;
    next.searchHistoryLoading = false;
    next.searchHistoryError = message;
    ReaderReducer.clearSearchHistoryClearTargetInPlace(next);
    return next;
  }

  // Operation errors preserve the last known history rows and any active
  // confirmation so Core `cleared: 0` or a transport failure cannot masquerade
  // as a successful local empty state.
  static setSearchHistoryOperationError(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.searchHistoryLoading = false;
    next.searchHistoryError = message;
    return next;
  }

  static requestSearchHistoryClear(state: ReaderUiState): ReaderUiState {
    if (state.routeId !== 'book-search' || state.searchHistoryLoading ||
      state.pendingSearchHistoryClear || !state.searchHistoryLoaded || state.searchHistory.length === 0) {
      return ReaderReducer.setSearchHistoryOperationError(state,
        '请从当前 Core 搜索历史列表确认清空操作。');
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.pendingSearchHistoryClear = true;
    next.searchHistoryError = '';
    return next;
  }

  static confirmSearchHistoryClear(state: ReaderUiState): ReaderUiState {
    if (state.routeId !== 'book-search' || state.searchHistoryLoading ||
      !state.pendingSearchHistoryClear || !state.searchHistoryLoaded || state.searchHistory.length === 0) {
      return ReaderReducer.setSearchHistoryOperationError(state,
        '搜索历史清空确认已失效；请重新从当前 Core 列表发起操作。');
    }
    return ReaderReducer.setSearchHistoryLoading(state);
  }

  static cancelSearchHistoryClear(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    ReaderReducer.clearSearchHistoryClearTargetInPlace(next);
    return next;
  }

  static completeSearchHistoryClear(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.searchHistory = [];
    next.searchHistoryLoaded = true;
    next.searchHistoryLoading = false;
    next.searchHistoryError = '';
    ReaderReducer.clearSearchHistoryClearTargetInPlace(next);
    return next;
  }

  private static clearSearchHistoryClearTargetInPlace(state: ReaderUiState): void {
    state.pendingSearchHistoryClear = false;
  }

  // ── Batch 1: session / TTS / auto-page / reader-toggle reducers ──
  // Each method clones via clone(), then re-builds the affected nested object
  // field-by-field (ArkTS forbids object spread) so the previous state's nested
  // references are not mutated.

  // Set the active session. Entering 'tts' primes playback to 'paused' (waits
  // for user to press play). Entering 'auto-page' starts playing and resets the
  // countdown to intervalSeconds. Returning to '' resets both sub-sessions.
  static setActiveSession(state: ReaderUiState, session: ActiveSession): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.activeSession = session;
    if (session === 'tts') {
      next.ttsSession = {
        playback: 'paused',
        rate: state.ttsSession.rate,
        voice: state.ttsSession.voice,
        scope: state.ttsSession.scope,
        timer: state.ttsSession.timer,
        currentSegment: state.ttsSession.currentSegment,
        totalSegments: state.ttsSession.totalSegments,
      };
      next.autoPageSession = {
        playing: false,
        countdownSeconds: 0,
        intervalSeconds: state.autoPageSession.intervalSeconds,
      };
    } else if (session === 'auto-page') {
      next.autoPageSession = {
        playing: true,
        countdownSeconds: state.autoPageSession.intervalSeconds,
        intervalSeconds: state.autoPageSession.intervalSeconds,
      };
      next.ttsSession = {
        playback: 'idle',
        rate: state.ttsSession.rate,
        voice: state.ttsSession.voice,
        scope: state.ttsSession.scope,
        timer: state.ttsSession.timer,
        currentSegment: 0,
        totalSegments: 0,
      };
    } else if (session === '') {
      next.ttsSession = {
        playback: 'idle',
        rate: state.ttsSession.rate,
        voice: state.ttsSession.voice,
        scope: state.ttsSession.scope,
        timer: state.ttsSession.timer,
        currentSegment: 0,
        totalSegments: 0,
      };
      next.autoPageSession = {
        playing: false,
        countdownSeconds: 0,
        intervalSeconds: state.autoPageSession.intervalSeconds,
      };
    }
    // The settings switch represents the active auto-page timer, not a stale
    // preference.  Keep every entry point (quick panel, full settings, and
    // TTS completion) on the same visible truth.
    return ReaderReducer.setReaderToggle(next, 'autoPage', session === 'auto-page');
  }

  // Toggle TTS playback. If not in tts session, switch to tts and start playing.
  // Otherwise flip between 'playing' and 'paused'.
  static toggleTtsPlayback(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    if (state.activeSession !== 'tts') {
      next.activeSession = 'tts';
      next.ttsSession = {
        playback: 'playing',
        rate: state.ttsSession.rate,
        voice: state.ttsSession.voice,
        scope: state.ttsSession.scope,
        timer: state.ttsSession.timer,
        currentSegment: state.ttsSession.currentSegment,
        totalSegments: state.ttsSession.totalSegments,
      };
      next.autoPageSession = {
        playing: false,
        countdownSeconds: 0,
        intervalSeconds: state.autoPageSession.intervalSeconds,
      };
    } else {
      const newPlayback: TtsPlaybackState = state.ttsSession.playback === 'playing' ? 'paused' : 'playing';
      next.ttsSession = {
        playback: newPlayback,
        rate: state.ttsSession.rate,
        voice: state.ttsSession.voice,
        scope: state.ttsSession.scope,
        timer: state.ttsSession.timer,
        currentSegment: state.ttsSession.currentSegment,
        totalSegments: state.ttsSession.totalSegments,
      };
    }
    if (next.activeSession === 'tts') {
      return ReaderReducer.setReaderToggle(next, 'autoPage', false);
    }
    return next;
  }

  // Set TTS segment cursor and total. Used by Effects when a chapter loads to
  // seed the TTS segment count, and by tests to set up stepTtsSegment fixtures.
  static setTtsSegments(state: ReaderUiState, currentSegment: number, totalSegments: number): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.ttsSession = {
      playback: state.ttsSession.playback,
      rate: state.ttsSession.rate,
      voice: state.ttsSession.voice,
      scope: state.ttsSession.scope,
      timer: state.ttsSession.timer,
      currentSegment: currentSegment,
      totalSegments: totalSegments,
    };
    return next;
  }

  // Step the current TTS segment by delta (-1 / +1), clamped to
  // [0, totalSegments - 1]. No-op if totalSegments is 0.
  static stepTtsSegment(state: ReaderUiState, delta: number): ReaderUiState {
    const total = state.ttsSession.totalSegments;
    const newSegment = total > 0 ? clamp(state.ttsSession.currentSegment + delta, 0, total - 1) : 0;
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.ttsSession = {
      playback: state.ttsSession.playback,
      rate: state.ttsSession.rate,
      voice: state.ttsSession.voice,
      scope: state.ttsSession.scope,
      timer: state.ttsSession.timer,
      currentSegment: newSegment,
      totalSegments: total,
    };
    return next;
  }

  // Set TTS rate, clamped to [0.5, 2.0] and rounded to 1 decimal place.
  static setTtsRate(state: ReaderUiState, rate: number): ReaderUiState {
    const clamped = roundMetric(clamp(rate, 0.5, 2.0), 1);
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.ttsSession = {
      playback: state.ttsSession.playback,
      rate: clamped,
      voice: state.ttsSession.voice,
      scope: state.ttsSession.scope,
      timer: state.ttsSession.timer,
      currentSegment: state.ttsSession.currentSegment,
      totalSegments: state.ttsSession.totalSegments,
    };
    return next;
  }

  static setTtsVoice(state: ReaderUiState, voice: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.ttsSession = {
      playback: state.ttsSession.playback,
      rate: state.ttsSession.rate,
      voice: voice,
      scope: state.ttsSession.scope,
      timer: state.ttsSession.timer,
      currentSegment: state.ttsSession.currentSegment,
      totalSegments: state.ttsSession.totalSegments,
    };
    return next;
  }

  static setTtsScope(state: ReaderUiState, scope: TtsScope): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.ttsSession = {
      playback: state.ttsSession.playback,
      rate: state.ttsSession.rate,
      voice: state.ttsSession.voice,
      scope: scope,
      timer: state.ttsSession.timer,
      currentSegment: state.ttsSession.currentSegment,
      totalSegments: state.ttsSession.totalSegments,
    };
    return next;
  }

  static setTtsTimer(state: ReaderUiState, timer: TtsTimer): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.ttsSession = {
      playback: state.ttsSession.playback,
      rate: state.ttsSession.rate,
      voice: state.ttsSession.voice,
      scope: state.ttsSession.scope,
      timer: timer,
      currentSegment: state.ttsSession.currentSegment,
      totalSegments: state.ttsSession.totalSegments,
    };
    return next;
  }

  // Toggle auto-page session. If not in auto-page, switch to it, start playing
  // and reset the countdown. If already in auto-page, switch back to '' and
  // stop playing.
  static toggleAutoPage(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const enabled = state.activeSession !== 'auto-page';
    if (enabled) {
      next.activeSession = 'auto-page';
      next.autoPageSession = {
        playing: true,
        countdownSeconds: state.autoPageSession.intervalSeconds,
        intervalSeconds: state.autoPageSession.intervalSeconds,
      };
      next.ttsSession = {
        playback: 'idle',
        rate: state.ttsSession.rate,
        voice: state.ttsSession.voice,
        scope: state.ttsSession.scope,
        timer: state.ttsSession.timer,
        currentSegment: 0,
        totalSegments: 0,
      };
    } else {
      next.activeSession = '';
      next.autoPageSession = {
        playing: false,
        countdownSeconds: 0,
        intervalSeconds: state.autoPageSession.intervalSeconds,
      };
    }
    return ReaderReducer.setReaderToggle(next, 'autoPage', enabled);
  }

  // Per-second countdown tick. Decrements countdownSeconds by 1; when it hits
  // 0 (or below), resets to intervalSeconds (looping countdown). No-op if not
  // playing (defensive — Effects layer should clear the timer on pause).
  static tickAutoPageCountdown(state: ReaderUiState): ReaderUiState {
    if (!state.autoPageSession.playing) return state;
    const newCountdown = state.autoPageSession.countdownSeconds - 1;
    const reset = newCountdown <= 0 ? state.autoPageSession.intervalSeconds : newCountdown;
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.autoPageSession = {
      playing: state.autoPageSession.playing,
      countdownSeconds: reset,
      intervalSeconds: state.autoPageSession.intervalSeconds,
    };
    return next;
  }

  // Update a single reader toggle. ArkTS forbids computed property assignment
  // on typed objects, so we re-build the map field-by-field and switch on key.
  static setReaderToggle(state: ReaderUiState, key: ReaderToggleKey, value: boolean): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const toggles: ReaderTogglesMap = {
      autoPage: state.readerToggles.autoPage,
      volumePage: state.readerToggles.volumePage,
      landscapeLock: state.readerToggles.landscapeLock,
      keepScreenOn: state.readerToggles.keepScreenOn,
      statusInfo: state.readerToggles.statusInfo,
      hapticFeedback: state.readerToggles.hapticFeedback,
      cacheNext: state.readerToggles.cacheNext,
      hideStatusBar: state.readerToggles.hideStatusBar,
    };
    switch (key) {
      case 'autoPage':
        toggles.autoPage = value;
        break;
      case 'volumePage':
        toggles.volumePage = value;
        break;
      case 'landscapeLock':
        toggles.landscapeLock = value;
        break;
      case 'keepScreenOn':
        toggles.keepScreenOn = value;
        break;
      case 'statusInfo':
        toggles.statusInfo = value;
        break;
      case 'hapticFeedback':
        toggles.hapticFeedback = value;
        break;
      case 'cacheNext':
        toggles.cacheNext = value;
        break;
      case 'hideStatusBar':
        toggles.hideStatusBar = value;
        break;
      default:
        break;
    }
    next.readerToggles = toggles;
    return next;
  }

  // Update one durable reader option, including the Full Appearance select rows.
  static setReaderSettingOption(state: ReaderUiState, key: ReaderSettingOptionKey, value: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const options: ReaderSettingOptionsMap = {
      pageMode: state.readerSettingOptions.pageMode,
      tapMode: state.readerSettingOptions.tapMode,
      pageAnimation: state.readerSettingOptions.pageAnimation,
      paragraphIndentMode: state.readerSettingOptions.paragraphIndentMode,
      textConversion: state.readerSettingOptions.textConversion,
      textAlignment: state.readerSettingOptions.textAlignment,
    };
    switch (key) {
      case 'pageMode':
        options.pageMode = value;
        break;
      case 'tapMode':
        options.tapMode = value;
        break;
      case 'pageAnimation':
        options.pageAnimation = value;
        break;
      case 'paragraphIndentMode':
        options.paragraphIndentMode = value;
        break;
      case 'textConversion':
        options.textConversion = value;
        break;
      case 'textAlignment':
        options.textAlignment = value;
        break;
      default:
        break;
    }
    next.readerSettingOptions = options;
    return next;
  }

  // ── F3: 交互连接 reducer 方法 ──

  // 切换设置项展开/收起。传入 key 与当前展开项相同时收起（''），否则展开该项。
  static setReaderSettingOptionExpanded(state: ReaderUiState, key: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.readerSettingExpandedOption = state.readerSettingExpandedOption === key ? '' : key;
    return next;
  }

  // 设置阅读主题。
  static setReaderTheme(state: ReaderUiState, theme: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.readerTheme = theme;
    return next;
  }

  // 调整自动翻页间隔（秒），限制在 3-30 秒范围内。
  static stepAutoPageInterval(state: ReaderUiState, delta: number): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const raw = state.autoPageSession.intervalSeconds + delta;
    const clamped = Math.min(30, Math.max(3, raw));
    next.autoPageSession = {
      playing: state.autoPageSession.playing,
      countdownSeconds: state.autoPageSession.countdownSeconds,
      intervalSeconds: clamped,
    };
    return next;
  }

  // 设置自动翻页模式（'continuous' | 'single'）。
  static setAutoPageMode(state: ReaderUiState, mode: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.autoPageMode = mode;
    return next;
  }

  // ── Batch 2: reader control reducers ──

  // Chapter progress seek: set loading=true + pageState='loading' so the
  // reader route's loading state renders. Actual chapter resolution happens
  // in the Effects layer (none yet — chapter list is not tracked in state).
  static chapterProgressSeek(state: ReaderUiState, _value: number): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, 'loading');
    next.loading = true;
    next.error = null;
    return next;
  }

  // Set screen brightness. Clamp to [0, 100] and round to an integer. The
  // Effects layer applies the value to the Host brightness adapter.
  static setBrightness(state: ReaderUiState, value: number): ReaderUiState {
    const clamped = Math.round(clamp(value, 0, 100));
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.brightness = clamped;
    return next;
  }

  static setReaderHostMessage(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.readerHostMessage = message;
    return next;
  }

  // Toggle auto-brightness. Pure state flip; the Host brightness adapter may
  // observe this and switch its brightness source.
  static setBrightnessAuto(state: ReaderUiState, enabled: boolean): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.brightnessAuto = enabled;
    return next;
  }

  // Switch the TOC panel mode between 'directory' and 'bookmark'.
  static setTocMode(state: ReaderUiState, mode: TocMode): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.tocMode = mode;
    return next;
  }

  // ── Batch 3: selection reducers ──

  // ArkUI Text is the sole source of a readable selection. A show event with
  // an empty range is therefore a close, never an opportunity to resurrect a
  // fixed/demo string in the toolbar.
  static setNativeSelection(state: ReaderUiState, selectedText: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    if (selectedText.trim().length > 0) {
      next.selection = {
        visible: true,
        action: '',
        selectedText: selectedText,
      };
    } else {
      next.selection = {
        visible: false,
        action: '',
        selectedText: '',
      };
    }
    return next;
  }

  // Only the actions with a real implementation may enter state. Highlight
  // and note deliberately have no Core model yet, so accepting them here
  // would make an unavailable capability look actionable.
  static setSelectionAction(state: ReaderUiState, action: string): ReaderUiState {
    const supported = action === 'copy' || action === 'search';
    if (!supported || !state.selection.visible || state.selection.selectedText.trim().length === 0) {
      return state;
    }
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.selection = {
      visible: state.selection.visible,
      action: action,
      selectedText: state.selection.selectedText,
    };
    return next;
  }

  // Clear the entire selection state.
  static clearSelection(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.selection = {
      visible: false,
      action: '',
      selectedText: '',
    };
    return next;
  }

  // ── Batch 4: bookshelf/discover/source-switch reducers ──

  // Set bookshelf view mode ('cover' | 'list'). Re-builds the bookshelfFilter
  // object field-by-field (ArkTS forbids spread) so the previous state's
  // filters/group/sort are preserved.
  static setBookshelfView(state: ReaderUiState, view: BookshelfView): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const filter: BookshelfFilterState = {
      view: view,
      group: state.bookshelfFilter.group,
      sort: state.bookshelfFilter.sort,
      filters: state.bookshelfFilter.filters,
    };
    next.bookshelfFilter = filter;
    return next;
  }

  // Set bookshelf group (e.g. 'all' | 'default' | 'local' | 'following').
  static setBookshelfGroup(state: ReaderUiState, group: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const filter: BookshelfFilterState = {
      view: state.bookshelfFilter.view,
      group: group,
      sort: state.bookshelfFilter.sort,
      filters: state.bookshelfFilter.filters,
    };
    next.bookshelfFilter = filter;
    return next;
  }

  // Set bookshelf sort (e.g. 'recent' | 'progress' | 'title' | 'author').
  static setBookshelfSort(state: ReaderUiState, sort: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const filter: BookshelfFilterState = {
      view: state.bookshelfFilter.view,
      group: state.bookshelfFilter.group,
      sort: sort,
      filters: state.bookshelfFilter.filters,
    };
    next.bookshelfFilter = filter;
    return next;
  }

  // Toggle a bookshelf filter tag. If the tag is already in filters, remove it;
  // otherwise append it. Uses slice + push (ArkTS forbids spread on arrays
  // when combined with object literals, but slice/push are safe).
  static toggleBookshelfFilter(state: ReaderUiState, tag: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const current = state.bookshelfFilter.filters;
    const newFilters = ReaderReducer.toggleStringInArray(current, tag);
    const filter: BookshelfFilterState = {
      view: state.bookshelfFilter.view,
      group: state.bookshelfFilter.group,
      sort: state.bookshelfFilter.sort,
      filters: newFilters,
    };
    next.bookshelfFilter = filter;
    return next;
  }

  static clearBookshelfFilters(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookshelfFilter = {
      view: state.bookshelfFilter.view,
      group: state.bookshelfFilter.group,
      sort: state.bookshelfFilter.sort,
      filters: [],
    };
    return next;
  }

  // Toggle a discover filter tag.
  static toggleDiscoverFilter(state: ReaderUiState, tag: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const newFilters = ReaderReducer.toggleStringInArray(state.discoverFilter.filters, tag);
    const filter: DiscoverFilterState = {
      filters: newFilters,
      sort: state.discoverFilter.sort,
    };
    next.discoverFilter = filter;
    return next;
  }

  // Set discover sort (e.g. 'popular' | 'recent' | 'rating').
  static setDiscoverSort(state: ReaderUiState, sort: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const filter: DiscoverFilterState = {
      filters: state.discoverFilter.filters,
      sort: sort,
    };
    next.discoverFilter = filter;
    return next;
  }

  // Begin a Core `source.exploreKinds` / `source.explore` request.  Keep the
  // last successful projection intact until the request resolves, but render a
  // loading state rather than pretending the old data is current.
  static setDiscoverLoading(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.discoverLoading = true;
    next.discoverError = '';
    next.error = null;
    return next;
  }

  static setDiscoverData(
    state: ReaderUiState,
    sources: CoreSourceEntry[],
    sourceId: string,
    kinds: CoreDiscoverKind[],
    kindUrl: string,
    kindTitle: string,
    books: CoreDiscoverBook[],
  ): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.discoverSources = sources;
    next.discoverSourceId = sourceId;
    next.discoverKinds = kinds;
    next.discoverKindUrl = kindUrl;
    next.discoverKindTitle = kindTitle;
    next.discoverBooks = books;
    next.discoverLoading = false;
    next.discoverLoaded = true;
    next.discoverError = '';
    next.error = null;
    return next;
  }

  // Commit the source chosen from the fresh Core source.list response before
  // awaiting its categories/network result.  An error can then be attributed
  // to the actual persisted sourceId instead of leaving the previous source
  // name on screen during a failed switch.
  static setDiscoverSourceResolved(
    state: ReaderUiState,
    sources: CoreSourceEntry[],
    sourceId: string,
  ): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.discoverSources = sources;
    next.discoverSourceId = sourceId;
    next.discoverKinds = [];
    next.discoverKindUrl = '';
    next.discoverKindTitle = '';
    next.discoverBooks = [];
    next.discoverLoading = true;
    next.discoverLoaded = false;
    next.discoverError = '';
    next.error = null;
    return next;
  }

  static setDiscoverError(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.discoverLoading = false;
    next.discoverLoaded = true;
    next.discoverError = message;
    next.error = null;
    return next;
  }

  // Source switch owns exactly one selected persisted source. A second tap
  // replaces the radio selection; it never creates a multi-source request.
  static selectSingleSource(state: ReaderUiState, id: string): ReaderUiState {
    const sourceId = id.trim();
    if (!ReaderReducer.hasEnabledSource(state, sourceId)) return state;
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceSelection = [sourceId];
    next.error = null;
    return next;
  }

  // Clear the radio selection. The UI uses cancellation to leave the flow;
  // this compatibility reducer remains safe for an external clear event.
  static clearSources(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    ReaderReducer.resetSourceSwitchScopeInPlace(next);
    return next;
  }

  private static hasEnabledSource(state: ReaderUiState, sourceId: string): boolean {
    if (sourceId.length === 0) return false;
    for (let i = 0; i < state.availableSources.length; i++) {
      const source = state.availableSources[i];
      if (source.sourceId === sourceId && source.enabled) return true;
    }
    return false;
  }

  private static beginSourceSwitch(state: ReaderUiState): ReaderUiState {
    // H4-D: When the source switch Pilot is enabled, the coordinator's
    // dispatchSourceSwitchPilot owns the source.switch.confirm event and the
    // executor publishes results through applyDomainEvent. This reducer case
    // is only reached for the native source-switch-confirm alias when the
    // Pilot is disabled (Shadow fallback). The stale-result guard
    // (sourceSwitchRequestSequence in ReaderEffects) remains the authority for
    // rejecting obsolete async results in both paths.
    if (state.routeId !== 'source-switch') {
      return ReaderReducer.setSourceSwitchError(
        state, 'SOURCE_SWITCH_ROUTE_REQUIRED', '换源确认已失效；请从当前阅读器重新进入换源页面。',
      );
    }
    if (state.sourceSelection.length !== 1) {
      return ReaderReducer.setSourceSwitchError(
        state, 'SOURCE_SWITCH_SELECTION_REQUIRED', '请先选择一个书源，再确认换源。',
      );
    }
    const sourceId = state.sourceSelection[0];
    if (!ReaderReducer.hasEnabledSource(state, sourceId)) {
      return ReaderReducer.setSourceSwitchError(
        state, 'SOURCE_SWITCH_SELECTION_INVALID', '所选书源已不可用，请重新选择。',
      );
    }
    if (state.currentBook === null) {
      return ReaderReducer.setSourceSwitchError(
        state, 'SOURCE_SWITCH_BOOK_REQUIRED', '当前没有可换源的书籍。',
      );
    }
    const next: ReaderUiState = ReaderReducer.clone(
      state, state.routeId, state.tab, state.overlay, state.stack, 'default',
    );
    next.loading = true;
    next.error = null;
    return next;
  }

  private static completeSourceSwitch(state: ReaderUiState): ReaderUiState {
    const popped = state.stack.length > 1 ? ReaderReducer.pop(state) : state;
    const next: ReaderUiState = ReaderReducer.clone(
      popped, popped.routeId, popped.tab, popped.overlay, popped.stack, 'default',
    );
    next.sourceSelection = [];
    next.loading = false;
    next.error = null;
    return next;
  }

  private static cancelSourceSwitch(state: ReaderUiState): ReaderUiState {
    const popped = state.stack.length > 1 ? ReaderReducer.pop(state) : state;
    const next: ReaderUiState = ReaderReducer.clone(
      popped, popped.routeId, popped.tab, popped.overlay, popped.stack, 'default',
    );
    next.sourceSelection = [];
    next.loading = false;
    next.error = null;
    return next;
  }

  private static resetSourceSwitchScopeInPlace(state: ReaderUiState): void {
    state.sourceSelection = [];
    state.sourceSwitchEpoch = state.sourceSwitchEpoch + 1;
  }

  private static setSourceSwitchError(state: ReaderUiState, code: string, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(
      state, state.routeId, state.tab, state.overlay, state.stack, 'default',
    );
    next.loading = false;
    next.error = { code: code, message: message, retryable: true };
    return next;
  }

  // A source detail route is valid only for an item returned by Core
  // source.list. This prevents the UI from rendering fixture metadata for an
  // arbitrary route parameter or a source that has just been deleted.
  static openSourceDetail(state: ReaderUiState, sourceId: string): ReaderUiState {
    if (sourceId.length === 0) return state;
    let found = false;
    for (let i = 0; i < state.availableSources.length; i++) {
      if (state.availableSources[i].sourceId === sourceId) {
        found = true;
        break;
      }
    }
    if (!found) return state;
    const next = ReaderReducer.push(state, 'source-detail');
    next.selectedSourceId = sourceId;
    return next;
  }

  // Normal source-list/detail delete affordances only create a route-bound
  // confirmation. Core is intentionally unreachable from this request event.
  static requestSourceDelete(state: ReaderUiState, sourceId: string): ReaderUiState {
    const id = sourceId.trim();
    if (!ReaderReducer.hasSource(state, id)) return state;
    const next = ReaderReducer.push(state, 'source-delete-confirm');
    next.selectedSourceId = id;
    return next;
  }

  // The actual delete effect accepts this event only while the matching route
  // is visible and the target remains a live Core source row.
  static confirmSourceDelete(state: ReaderUiState): ReaderUiState {
    const id = (state.selectedSourceId ?? '').trim();
    if (state.routeId === 'source-delete-confirm' && ReaderReducer.hasSource(state, id)) {
      return state;
    }
    return ReaderReducer.setError(state, {
      code: 'SOURCE_DELETE_CONFIRM_REQUIRED',
      message: '请从已选择的 Core 书源删除确认页再次确认。',
      retryable: false,
    });
  }

  private static hasSource(state: ReaderUiState, sourceId: string): boolean {
    if (sourceId.length === 0) return false;
    for (let i = 0; i < state.availableSources.length; i++) {
      if (state.availableSources[i].sourceId === sourceId) return true;
    }
    return false;
  }

  private static isRssSubscriptionManagementRoute(routeId: string): boolean {
    return routeId === 'rss-subscription-management';
  }

  static requestRssSubscriptionAdd(state: ReaderUiState, rawFeedUrl: string): ReaderUiState {
    if (!ReaderReducer.isRssSubscriptionManagementRoute(state.routeId) || rawFeedUrl.trim().length === 0) {
      return ReaderReducer.setError(state, {
        code: 'RSS_SUBSCRIPTION_ADD_TARGET_REQUIRED',
        message: '请在当前 RSS 订阅管理页输入有效 Feed 地址后再添加。',
        retryable: false,
      });
    }
    return state;
  }

  static requestRssSubscriptionUpdate(state: ReaderUiState, rawSubscriptionId: string): ReaderUiState {
    const subscriptionId = rawSubscriptionId.trim();
    if (!ReaderReducer.isRssSubscriptionManagementRoute(state.routeId) ||
      !ReaderReducer.hasRssSubscription(state, subscriptionId)) {
      return ReaderReducer.setError(state, {
        code: 'RSS_SUBSCRIPTION_UPDATE_TARGET_REQUIRED',
        message: '只能在当前 RSS 订阅管理页编辑一条仍由 Core 返回的订阅。',
        retryable: false,
      });
    }
    return state;
  }

  static requestRssItemRead(state: ReaderUiState, rawGuid: string, rawSubscriptionId: string): ReaderUiState {
    const guid = rawGuid.trim();
    const subscriptionId = rawSubscriptionId.trim();
    if (state.routeId !== 'rss-detail' || !ReaderReducer.hasUnreadRssItem(state, guid, subscriptionId)) {
      return ReaderReducer.setError(state, {
        code: 'RSS_ITEM_READ_TARGET_REQUIRED',
        message: '只能打开当前 Core RSS 列表中的未读条目后更新已读状态。',
        retryable: false,
      });
    }
    return state;
  }

  // RSS has a legacy contract route named "delete-confirm". Keep it honest:
  // the route is entered only with an id from Core's current subscription list.
  static requestRssSubscriptionDelete(state: ReaderUiState, subscriptionId: string): ReaderUiState {
    const id = subscriptionId.trim();
    if (!ReaderReducer.isRssSubscriptionManagementRoute(state.routeId) ||
      !ReaderReducer.hasRssSubscription(state, id)) {
      return ReaderReducer.setError(state, {
        code: 'RSS_SUBSCRIPTION_DELETE_TARGET_REQUIRED',
        message: '请从当前 RSS 订阅管理页选择一条仍由 Core 返回的订阅后再删除。',
        retryable: false,
      });
    }
    const next = ReaderReducer.push(state, 'rss-source-delete-confirm');
    next.pendingRssSubscriptionDeleteId = id;
    return next;
  }

  static confirmRssSubscriptionDelete(state: ReaderUiState, subscriptionId: string): ReaderUiState {
    const id = subscriptionId.trim();
    if (state.routeId === 'rss-source-delete-confirm' &&
      id === state.pendingRssSubscriptionDeleteId && ReaderReducer.hasRssSubscription(state, id)) {
      return state;
    }
    return ReaderReducer.setError(state, {
      code: 'RSS_SUBSCRIPTION_DELETE_CONFIRM_REQUIRED',
      message: '请在当前 Core 订阅的删除确认页再次确认。',
      retryable: false,
    });
  }

  static cancelRssSubscriptionDelete(state: ReaderUiState): ReaderUiState {
    const base = state.routeId === 'rss-source-delete-confirm' ? ReaderReducer.pop(state) : state;
    const next = ReaderReducer.clone(base, base.routeId, base.tab, base.overlay, base.stack, base.pageState);
    next.pendingRssSubscriptionDeleteId = '';
    return next;
  }

  static completeRssSubscriptionDelete(state: ReaderUiState): ReaderUiState {
    const base = state.routeId === 'rss-source-delete-confirm' ? ReaderReducer.pop(state) : state;
    const next = ReaderReducer.clone(base, base.routeId, base.tab, base.overlay, base.stack, base.pageState);
    next.pendingRssSubscriptionDeleteId = '';
    return next;
  }

  private static hasRssSubscription(state: ReaderUiState, subscriptionId: string): boolean {
    if (subscriptionId.length === 0) return false;
    for (let i = 0; i < state.rssSubscriptions.length; i++) {
      if (state.rssSubscriptions[i].subscriptionId === subscriptionId) return true;
    }
    return false;
  }

  private static hasUnreadRssItem(state: ReaderUiState, guid: string, subscriptionId: string): boolean {
    if (guid.length === 0 || subscriptionId.length === 0) return false;
    for (let i = 0; i < state.rssItems.length; i++) {
      const item = state.rssItems[i];
      if (item.guid === guid && item.subscriptionId === subscriptionId) return !item.read;
    }
    return false;
  }

  static setSourceCheckLoading(state: ReaderUiState, sourceId: string, sourceName: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceCheckSourceId = sourceId;
    next.sourceCheckSourceName = sourceName;
    next.sourceCheckLoading = true;
    next.sourceCheckLoaded = false;
    next.sourceCheckMessage = '正在读取 Core 书源。';
    next.sourceCheckError = '';
    next.sourceCheckResult = null;
    return next;
  }

  static setSourceCheckResolved(state: ReaderUiState, sourceId: string, sourceName: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceCheckSourceId = sourceId;
    next.sourceCheckSourceName = sourceName;
    next.sourceCheckLoading = true;
    next.sourceCheckLoaded = false;
    next.sourceCheckMessage = 'Core 正通过 Host http.execute 运行 L1–L5 诊断。';
    next.sourceCheckError = '';
    next.sourceCheckResult = null;
    return next;
  }

  static setSourceCheckEmpty(state: ReaderUiState, sourceId: string, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceCheckSourceId = sourceId;
    next.sourceCheckSourceName = '';
    next.sourceCheckLoading = false;
    next.sourceCheckLoaded = true;
    next.sourceCheckMessage = message;
    next.sourceCheckError = '';
    next.sourceCheckResult = null;
    return next;
  }

  static setSourceCheckResult(
    state: ReaderUiState,
    result: CoreSourceCheckResult | null,
    message: string,
  ): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceCheckLoading = false;
    next.sourceCheckLoaded = true;
    next.sourceCheckMessage = message;
    next.sourceCheckError = '';
    next.sourceCheckResult = result;
    if (result !== null) next.sourceCheckSourceId = result.sourceId;
    return next;
  }

  static setSourceCheckFailed(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceCheckLoading = false;
    next.sourceCheckLoaded = true;
    next.sourceCheckError = message;
    next.sourceCheckMessage = '';
    next.sourceCheckResult = null;
    return next;
  }

  // A source-debug selection is valid only for a persisted, currently enabled
  // Core source.  Do not let a stale route id or a disabled fixture become the
  // identity of a real Host diagnostic transaction.
  static selectSourceForDebug(state: ReaderUiState, sourceId: string): ReaderUiState {
    if (sourceId.trim().length === 0) return state;
    let found = false;
    for (let i = 0; i < state.availableSources.length; i++) {
      const source = state.availableSources[i];
      if (source.sourceId === sourceId && source.enabled) {
        found = true;
        break;
      }
    }
    if (!found) return state;
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.selectedSourceId = sourceId;
    next.sourceDebugSourceId = sourceId;
    next.sourceDebugSourceName = '';
    next.sourceDebugLoading = false;
    next.sourceDebugLoaded = false;
    next.sourceDebugMessage = '已选择由 Core source.list 返回的启用书源。';
    next.sourceDebugError = '';
    next.sourceDebugResult = null;
    return next;
  }

  static setSourceDebugLoading(state: ReaderUiState, sourceId: string, sourceName: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceDebugSourceId = sourceId;
    next.sourceDebugSourceName = sourceName;
    next.sourceDebugLoading = true;
    next.sourceDebugLoaded = false;
    next.sourceDebugMessage = '正在通过 Core source.check.run 收集真实 Host 响应。';
    next.sourceDebugError = '';
    next.sourceDebugResult = null;
    return next;
  }

  static setSourceDebugResolved(state: ReaderUiState, sourceId: string, sourceName: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceDebugSourceId = sourceId;
    next.sourceDebugSourceName = sourceName;
    next.sourceDebugLoading = true;
    next.sourceDebugLoaded = false;
    next.sourceDebugMessage = 'Core 正运行 L1–L5 真实诊断；仅已注解的响应会进入短生命周期调测 recorder。';
    next.sourceDebugError = '';
    next.sourceDebugResult = null;
    return next;
  }

  static setSourceDebugEmpty(state: ReaderUiState, sourceId: string, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceDebugSourceId = sourceId;
    next.sourceDebugSourceName = '';
    next.sourceDebugLoading = false;
    next.sourceDebugLoaded = true;
    next.sourceDebugMessage = message;
    next.sourceDebugError = '';
    next.sourceDebugResult = null;
    return next;
  }

  static setSourceDebugResult(
    state: ReaderUiState,
    result: CoreSourceDebugResult | null,
    message: string,
  ): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceDebugLoading = false;
    next.sourceDebugLoaded = true;
    next.sourceDebugMessage = message;
    next.sourceDebugError = '';
    next.sourceDebugResult = result;
    if (result !== null) next.sourceDebugSourceId = result.sourceId;
    return next;
  }

  static setSourceDebugFailed(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceDebugLoading = false;
    next.sourceDebugLoaded = true;
    next.sourceDebugError = message;
    next.sourceDebugMessage = '';
    next.sourceDebugResult = null;
    return next;
  }

  // Book removal always names a live shelf row first. A stale currentBook
  // (for example one left by a previous reading session) cannot become a
  // delete target from the shelf top-more sheet.
  static handleBookAction(state: ReaderUiState, action: string): ReaderUiState {
    if (action === 'delete') return ReaderReducer.beginBookshelfRemovalConfirmation(state);
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.overlay = action.length > 0 ? '' : 'book-action';
    return next;
  }

  private static beginBookshelfRemovalConfirmation(state: ReaderUiState): ReaderUiState {
    const current = state.currentBook;
    const sourceId = (current?.sourceId ?? '').trim();
    const bookId = (current?.bookId ?? '').trim();
    if (sourceId.length > 0 && bookId.length > 0) {
      for (let i = 0; i < state.bookshelfBooks.length; i++) {
        const shelfBook = state.bookshelfBooks[i];
        if (shelfBook.sourceId === sourceId && shelfBook.bookId === bookId) {
          const next = ReaderReducer.clone(state, state.routeId, state.tab, 'dialog', state.stack, state.pageState);
          next.pendingBookshelfRemovalSourceId = sourceId;
          next.pendingBookshelfRemovalBookId = bookId;
          next.error = null;
          return next;
        }
      }
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, '', state.stack, state.pageState);
    ReaderReducer.clearBookshelfRemovalTargetInPlace(next);
    next.error = {
      code: 'BOOKSHELF_REMOVE_TARGET_REQUIRED',
      message: '请先打开一条仍由 Core 书架返回的书籍，再确认移除。',
      retryable: false,
    };
    return next;
  }

  static clearBookshelfRemovalConfirmation(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, '', state.stack, state.pageState);
    ReaderReducer.clearBookshelfRemovalTargetInPlace(next);
    return next;
  }

  private static clearBookshelfRemovalTargetInPlace(state: ReaderUiState): void {
    state.pendingBookshelfRemovalSourceId = '';
    state.pendingBookshelfRemovalBookId = '';
  }

  // Book-group mutations are Core-owned. Keep their request state separate
  // from route-level `loading` so a failed group refresh does not replace the
  // management page with an unrelated global loading/error surface.
  static setBookGroupsLoading(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookGroupsLoading = true;
    next.bookGroupsError = '';
    return next;
  }

  static setBookGroupsError(state: ReaderUiState, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookGroupsLoading = false;
    next.bookGroupsError = message;
    return next;
  }

  // A group-delete confirmation is meaningful only in the two live Core
  // management surfaces. Keeping the route fence here prevents a stale row
  // from a prior page from becoming an authority to mutate Core.
  private static isBookGroupManagementRoute(routeId: string): boolean {
    return routeId === 'group-management' || routeId === 'bookshelf-group-management';
  }

  private static hasBookGroup(state: ReaderUiState, groupId: number): boolean {
    if (!Number.isSafeInteger(groupId) || groupId <= 0) return false;
    for (let i = 0; i < state.bookGroups.length; i++) {
      if (state.bookGroups[i].groupId === groupId) return true;
    }
    return false;
  }

  // First tap: bind exactly one currently rendered Core row. Once bound, it
  // cannot be replaced by another row until the user cancels or navigates.
  static requestBookGroupDelete(state: ReaderUiState, groupId: number): ReaderUiState {
    if (!ReaderReducer.isBookGroupManagementRoute(state.routeId) ||
      state.bookGroupsLoading || state.pendingBookGroupDeleteId !== 0 ||
      !ReaderReducer.hasBookGroup(state, groupId)) {
      return ReaderReducer.setBookGroupsError(state,
        '请从当前分组管理页选择一条仍由 Core 返回的分组后再删除。');
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.pendingBookGroupDeleteId = groupId;
    next.bookGroupsError = '';
    return next;
  }

  // Second tap: retain the bound id and move the row into its request state.
  // The effect repeats all checks immediately before calling Core.
  static confirmBookGroupDelete(state: ReaderUiState, groupId: number): ReaderUiState {
    if (!ReaderReducer.isBookGroupManagementRoute(state.routeId) || state.bookGroupsLoading ||
      groupId !== state.pendingBookGroupDeleteId || !ReaderReducer.hasBookGroup(state, groupId)) {
      return ReaderReducer.setBookGroupsError(state,
        '删除确认已失效；请重新从当前 Core 分组列表选择目标。');
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookGroupsLoading = true;
    next.bookGroupsError = '';
    return next;
  }

  static cancelBookGroupDelete(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    ReaderReducer.clearBookGroupDeleteTargetInPlace(next);
    return next;
  }

  static completeBookGroupDelete(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookGroupsLoading = false;
    next.bookGroupsError = '';
    ReaderReducer.clearBookGroupDeleteTargetInPlace(next);
    return next;
  }

  private static clearBookGroupDeleteTargetInPlace(state: ReaderUiState): void {
    state.pendingBookGroupDeleteId = 0;
  }

  private static hasBookshelfBook(state: ReaderUiState, rawSourceId: string, rawBookId: string): boolean {
    const sourceId = rawSourceId.trim();
    const bookId = rawBookId.trim();
    if (sourceId.length === 0 || bookId.length === 0) return false;
    for (let i = 0; i < state.bookshelfBooks.length; i++) {
      const book = state.bookshelfBooks[i];
      if (book.sourceId === sourceId && book.bookId === bookId) return true;
    }
    return false;
  }

  private static hasGroupedBookshelfBook(state: ReaderUiState, sourceId: string, bookId: string): boolean {
    for (let i = 0; i < state.bookshelfBooks.length; i++) {
      const book = state.bookshelfBooks[i];
      if (book.sourceId === sourceId.trim() && book.bookId === bookId.trim()) {
        return book.group.trim().length > 0;
      }
    }
    return false;
  }

  private static hasBookGroupName(state: ReaderUiState, rawName: string): boolean {
    const name = rawName.trim();
    if (name.length === 0) return false;
    for (let i = 0; i < state.bookGroups.length; i++) {
      if (state.bookGroups[i].groupName === name) return true;
    }
    return false;
  }

  // Assignment can only target a shelf row and group currently projected from
  // Core. The empty group value is a destructive clear and has a separate
  // request/confirm state machine below.
  static requestBookGroupAssignment(state: ReaderUiState, sourceId: string,
    bookId: string, group: string): ReaderUiState {
    if (group.trim().length === 0) {
      return ReaderReducer.setBookGroupsError(state,
        '清空分组需要先选择当前书架条目并在可见确认区再次确认。');
    }
    if (!ReaderReducer.isBookGroupManagementRoute(state.routeId) || state.bookGroupsLoading ||
      !ReaderReducer.hasBookshelfBook(state, sourceId, bookId) ||
      !ReaderReducer.hasBookGroupName(state, group)) {
      return ReaderReducer.setBookGroupsError(state,
        '只能在当前分组管理页为仍由 Core 返回的书架条目分配当前分组。');
    }
    return ReaderReducer.setBookGroupsLoading(state);
  }

  static requestBookGroupCreate(state: ReaderUiState, rawName: string): ReaderUiState {
    if (!ReaderReducer.isBookGroupManagementRoute(state.routeId) || state.bookGroupsLoading ||
      rawName.trim().length === 0) {
      return ReaderReducer.setBookGroupsError(state,
        '请在当前分组管理页输入有效名称后再创建分组。');
    }
    return ReaderReducer.setBookGroupsLoading(state);
  }

  static requestBookGroupUpdate(state: ReaderUiState, groupId: number, rawName: string): ReaderUiState {
    if (!ReaderReducer.isBookGroupManagementRoute(state.routeId) || state.bookGroupsLoading ||
      rawName.trim().length === 0 || !ReaderReducer.hasBookGroup(state, groupId)) {
      return ReaderReducer.setBookGroupsError(state,
        '只能在当前分组管理页编辑一条仍由 Core 返回的分组。');
    }
    return ReaderReducer.setBookGroupsLoading(state);
  }

  static requestBookGroupClear(state: ReaderUiState, rawSourceId: string, rawBookId: string): ReaderUiState {
    const sourceId = rawSourceId.trim();
    const bookId = rawBookId.trim();
    if (!ReaderReducer.isBookGroupManagementRoute(state.routeId) || state.bookGroupsLoading ||
      state.pendingBookGroupClearSourceId.length > 0 ||
      !ReaderReducer.hasGroupedBookshelfBook(state, sourceId, bookId)) {
      return ReaderReducer.setBookGroupsError(state,
        '请从当前分组管理页选择一条仍由 Core 返回且已分组的书籍后再清空。');
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.pendingBookGroupClearSourceId = sourceId;
    next.pendingBookGroupClearBookId = bookId;
    next.bookGroupsError = '';
    return next;
  }

  static confirmBookGroupClear(state: ReaderUiState, rawSourceId: string, rawBookId: string): ReaderUiState {
    const sourceId = rawSourceId.trim();
    const bookId = rawBookId.trim();
    if (!ReaderReducer.isBookGroupManagementRoute(state.routeId) || state.bookGroupsLoading ||
      sourceId !== state.pendingBookGroupClearSourceId || bookId !== state.pendingBookGroupClearBookId ||
      !ReaderReducer.hasGroupedBookshelfBook(state, sourceId, bookId)) {
      return ReaderReducer.setBookGroupsError(state,
        '清空确认已失效；请重新从当前 Core 书架列表选择书籍。');
    }
    return ReaderReducer.setBookGroupsLoading(state);
  }

  static cancelBookGroupClear(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    ReaderReducer.clearBookGroupClearTargetInPlace(next);
    return next;
  }

  static completeBookGroupClear(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.bookGroupsLoading = false;
    next.bookGroupsError = '';
    ReaderReducer.clearBookGroupClearTargetInPlace(next);
    return next;
  }

  private static clearBookGroupClearTargetInPlace(state: ReaderUiState): void {
    state.pendingBookGroupClearSourceId = '';
    state.pendingBookGroupClearBookId = '';
  }

  // ── B1 P0 全局设置 segment/stepper/switch reducers ──

  // 切换全局设置中的 segment 选项（当前仅 appThemeMode）。
  // ArkTS 不支持对象展开，直接写字段。
  static switchSettingsSegment(state: ReaderUiState, key: string, value: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    if (key === 'appThemeMode') {
      next.appThemeMode = value;
    } else if (key === 'searchHistoryLimit') {
      const limit = Number(value);
      // The UI offers only these values. Reject a synthetic value instead of
      // silently turning the Core projection into an arbitrary row count.
      if (limit === 10 || limit === 20 || limit === 50) {
        next.searchHistoryLimit = limit;
      }
    }
    return next;
  }

  // 步进修改全局设置中的数值项（当前仅 coverColumns，范围 1-5）。
  static stepSettingsStepper(state: ReaderUiState, key: string, delta: number): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    if (key === 'coverColumns') {
      const v = state.coverColumns + delta;
      next.coverColumns = v < 1 ? 1 : (v > 5 ? 5 : v);
    }
    return next;
  }

  // 切换全局设置中的开关项。重建 settingsToggles 对象，按 key 修改对应字段。
  static toggleSettingsSwitch(state: ReaderUiState, key: string, value: boolean): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const toggles: SettingsTogglesMap = {
      autoCheckUpdate: state.settingsToggles.autoCheckUpdate,
      tapBottomBarToTop: state.settingsToggles.tapBottomBarToTop,
      showUpdateBadge: state.settingsToggles.showUpdateBadge,
      mergeSameBooks: state.settingsToggles.mergeSameBooks,
      enableSearchHistory: state.settingsToggles.enableSearchHistory,
      showLocalBookBadge: state.settingsToggles.showLocalBookBadge,
    };
    switch (key) {
      case 'autoCheckUpdate':
        toggles.autoCheckUpdate = value;
        break;
      case 'tapBottomBarToTop':
        toggles.tapBottomBarToTop = value;
        break;
      case 'showUpdateBadge':
        toggles.showUpdateBadge = value;
        break;
      case 'mergeSameBooks':
        toggles.mergeSameBooks = value;
        break;
      case 'enableSearchHistory':
        toggles.enableSearchHistory = value;
        break;
      case 'showLocalBookBadge':
        toggles.showLocalBookBadge = value;
        break;
      default:
        break;
    }
    next.settingsToggles = toggles;
    return next;
  }

  // ── P1.2 select/action 控件辅助方法 ──
  // 展开 select 选项面板：设置 expandedOptionKey 为指定 key（若已展开同一 key 则收起）。
  static openSettingsSelect(state: ReaderUiState, key: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.expandedOptionKey = state.expandedOptionKey === key ? '' : key;
    return next;
  }

  // 收起 select 选项面板。
  static closeSettingsSelect(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.expandedOptionKey = '';
    return next;
  }

  // 标记 action 触发（状态机记录，实际副作用由 effect 执行）。
  static markSettingsAction(state: ReaderUiState, key: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    // Action keys without an independent confirmation remain effect-owned.
    return next;
  }

  static requestCacheClear(state: ReaderUiState): ReaderUiState {
    if (state.routeId !== 'settings-general' || state.pendingCacheClear) {
      return ReaderReducer.setError(state, {
        code: 'CACHE_CLEAR_TARGET_REQUIRED',
        message: '请在当前通用设置页重新发起缓存清理。',
        retryable: false,
      });
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.pendingCacheClear = true;
    next.error = null;
    return next;
  }

  static confirmCacheClear(state: ReaderUiState): ReaderUiState {
    if (state.routeId === 'settings-general' && state.pendingCacheClear) return state;
    return ReaderReducer.setError(state, {
      code: 'CACHE_CLEAR_CONFIRM_REQUIRED',
      message: '缓存清理确认已失效；请在当前通用设置页重新发起。',
      retryable: false,
    });
  }

  static cancelCacheClear(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    ReaderReducer.clearCacheClearConfirmationInPlace(next);
    return next;
  }

  private static clearCacheClearConfirmationInPlace(state: ReaderUiState): void {
    state.pendingCacheClear = false;
  }

  // ── P1.3 WebDAV 配置辅助方法 ──
  static updateWebdavField(state: ReaderUiState, field: string, value: string): ReaderUiState {
    // `sync-backup` consumes the persisted endpoint summary but owns no input
    // controls; `webdav-config` is the only editable route.
    if (state.routeId !== 'webdav-config' && state.routeId !== 'sync-backup') return state;
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    if (field === 'serverUrl') {
      next.webdavServerUrl = value;
    } else if (field === 'username') {
      next.webdavUsername = value;
    } else if (field === 'password') {
      next.webdavPassword = value;
    } else if (field === 'syncDir') {
      next.webdavSyncDir = value;
    }
    return next;
  }

  static setWebdavTestStatus(state: ReaderUiState, status: string, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.webdavTestStatus = status;
    next.webdavTestMessage = message;
    return next;
  }

  static requestWebdavTest(state: ReaderUiState): ReaderUiState {
    if (state.routeId !== 'webdav-config' || state.webdavServerUrl.trim().length === 0 ||
      state.webdavTestStatus === 'testing' || state.webdavSaveStatus === 'saving') {
      return ReaderReducer.setWebdavTestStatus(state, 'error',
        '请在当前 WebDAV 配置页填写服务器地址后再测试。');
    }
    return ReaderReducer.setWebdavTestStatus(state, 'testing', '');
  }

  static setWebdavSaveStatus(state: ReaderUiState, status: string, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.webdavSaveStatus = status;
    next.webdavSaveMessage = message;
    return next;
  }

  static requestWebdavSave(state: ReaderUiState): ReaderUiState {
    if (state.routeId !== 'webdav-config' || state.webdavServerUrl.trim().length === 0 ||
      state.webdavSaveStatus === 'saving') {
      return ReaderReducer.setWebdavSaveStatus(state, 'error',
        '请在当前 WebDAV 配置页填写服务器地址后再保存。');
    }
    return ReaderReducer.setWebdavSaveStatus(state, 'saving', '');
  }

  static requestCoreBackupCreate(state: ReaderUiState, remote: boolean): ReaderUiState {
    const status = state.coreBackupStatus;
    if (state.routeId !== 'sync-backup' || status === 'loading' || status === 'creating' ||
      status === 'restoring') {
      return ReaderReducer.setCoreBackupStatus(state, 'error',
        `请在当前同步备份页${remote ? '重新发起 WebDAV 备份' : '重新发起本机备份'}。`);
    }
    return ReaderReducer.setCoreBackupStatus(state, 'creating',
      remote ? '正在由 Core 导出并上传 WebDAV 备份…' : '正在由 Core 导出数据快照…');
  }

  static setCoreBackupStatus(state: ReaderUiState, status: string, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.coreBackupStatus = status;
    next.coreBackupMessage = message;
    return next;
  }

  static setLocalCoreBackup(state: ReaderUiState, info: CoreStorageBackupInfo | null, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.localCoreBackup = info;
    next.coreBackupStatus = info === null ? 'idle' : 'ready';
    next.coreBackupMessage = message;
    return next;
  }

  static setPendingCoreRestore(state: ReaderUiState, info: CoreStorageBackupInfo | null, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.pendingCoreRestore = info;
    ReaderReducer.clearCoreRestoreConfirmationInPlace(next);
    next.coreBackupStatus = info === null ? 'idle' : 'ready';
    next.coreBackupMessage = message;
    return next;
  }

  static requestCoreRestoreApply(state: ReaderUiState): ReaderUiState {
    const info = state.pendingCoreRestore;
    if (state.routeId !== 'restore-confirm' || info === null || state.coreBackupStatus === 'restoring') {
      return ReaderReducer.rejectCoreRestoreApply(state);
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.pendingCoreRestoreConfirmationChecksum = info.checksum;
    next.coreBackupStatus = 'ready';
    next.coreBackupMessage = '恢复会替换完整 Core 数据；请再次确认已校验快照。';
    return next;
  }

  static confirmCoreRestoreApply(state: ReaderUiState): ReaderUiState {
    const info = state.pendingCoreRestore;
    if (state.routeId !== 'restore-confirm' || info === null ||
      state.pendingCoreRestoreConfirmationChecksum !== info.checksum ||
      state.coreBackupStatus === 'restoring') {
      return ReaderReducer.rejectCoreRestoreApply(state);
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.coreBackupStatus = 'restoring';
    next.coreBackupMessage = '正在创建恢复前快照并由 Core 原子应用…';
    return next;
  }

  static cancelCoreRestoreApply(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    ReaderReducer.clearCoreRestoreConfirmationInPlace(next);
    if (next.pendingCoreRestore !== null && next.coreBackupStatus !== 'restoring') {
      next.coreBackupStatus = 'ready';
      next.coreBackupMessage = '已取消恢复确认；已校验快照仍可在当前页面重新确认。';
    }
    return next;
  }

  private static rejectCoreRestoreApply(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    ReaderReducer.clearCoreRestoreConfirmationInPlace(next);
    next.coreBackupStatus = 'error';
    next.coreBackupMessage = '恢复确认已失效；请重新选择并校验 Core 备份后，在确认页面再次确认。';
    return next;
  }

  private static clearCoreRestoreConfirmationInPlace(state: ReaderUiState): void {
    state.pendingCoreRestoreConfirmationChecksum = '';
  }

  // ── W1 资源导入 reducer 方法 ──

  // 打开本地导入页：push 'local-import' 路由。
  static openLocalImport(state: ReaderUiState): ReaderUiState {
    return ReaderReducer.push(state, 'local-import');
  }

  // 设置由 Core 从原始字节测得的导入预览格式、编码和章节数。
  static beginLocalImportParse(state: ReaderUiState, epoch: number): ReaderUiState {
    if (state.routeId !== 'local-import' || !Number.isSafeInteger(epoch) || epoch <= state.localImportEpoch) {
      return state;
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.localImportEpoch = epoch;
    next.importPreviewFormat = '';
    next.importPreviewEncoding = '';
    next.importPreviewCount = 0;
    next.loading = true;
    next.error = null;
    return next;
  }

  static setImportPreview(state: ReaderUiState, format: string, encoding: string, count: number,
    epoch: number): ReaderUiState {
    if (state.routeId !== 'local-import' || !state.loading || epoch !== state.localImportEpoch) return state;
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.importPreviewFormat = format;
    next.importPreviewEncoding = encoding;
    next.importPreviewCount = count;
    next.loading = false;
    next.error = null;
    return next;
  }

  static requestLocalImportCommit(state: ReaderUiState, importCount: number): ReaderUiState {
    if (state.routeId !== 'local-import' || state.loading || state.importPreviewFormat.trim().length === 0 ||
      importCount < 0 || importCount !== state.importPreviewCount) {
      return ReaderReducer.setError(state, {
        code: 'IMPORT_CONFIRMATION_REQUIRED',
        message: '本地书导入确认已失效；请在当前导入页重新解析后再提交。',
        retryable: false,
      });
    }
    return ReaderReducer.setLoading(state, true);
  }

  private static clearLocalImportPreviewInPlace(state: ReaderUiState): void {
    state.importPreviewFormat = '';
    state.importPreviewEncoding = '';
    state.importPreviewCount = 0;
    state.localImportEpoch = state.localImportEpoch + 1;
  }

  private static hasActiveLocalImportCommit(state: ReaderUiState): boolean {
    return state.routeId === 'local-import' && state.loading && state.localImportEpoch > 0;
  }

  // 应用导入：pop 回书架并记录导入数量，清空预览格式。
  // toast 提示由 effect 层通过 feedback.toast.show 事件派发。
  static applyImport(state: ReaderUiState, count: number): ReaderUiState {
    // Commit completion is the sole allowed exit while Core materializes a
    // local book. Clear the active flag before pop so the navigation fence
    // cannot turn a successful import into an orphaned Core record.
    const committed = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    committed.loading = false;
    const popped = ReaderReducer.pop(committed);
    const next: ReaderUiState = ReaderReducer.clone(popped, popped.routeId, popped.tab, popped.overlay, popped.stack, popped.pageState);
    next.importPreviewCount = count;
    next.importPreviewFormat = '';
    next.importPreviewEncoding = '';
    next.loading = false;
    next.error = null;
    return next;
  }

  static beginSourcePackageImport(state: ReaderUiState, origin: string): ReaderUiState {
    if (!ReaderReducer.isSourcePackageImportRoute(state.routeId)) {
      return ReaderReducer.setError(state, {
        code: 'SOURCE_IMPORT_TARGET_REQUIRED',
        message: '请在当前书源导入页面开始导入。',
        retryable: false,
      });
    }
    if (state.sourceImportRunning) return state;
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceImportOrigin = origin;
    next.sourceImportTotal = 0;
    next.sourceImportImported = 0;
    next.sourceImportSkipped = 0;
    next.sourceImportFailed = 0;
    next.sourceImportMessage = '';
    next.sourceImportRunning = true;
    next.sourceImportEpoch = state.sourceImportEpoch + 1;
    next.loading = true;
    next.error = null;
    return next;
  }

  static completeSourcePackageImport(
    state: ReaderUiState,
    origin: string,
    total: number,
    imported: number,
    skipped: number,
    failed: number,
    message: string,
    epoch: number,
  ): ReaderUiState {
    if (!ReaderReducer.isSourcePackageImportRoute(state.routeId) || !state.sourceImportRunning ||
      epoch !== state.sourceImportEpoch) {
      return state;
    }
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceImportOrigin = origin;
    next.sourceImportTotal = Math.max(0, total);
    next.sourceImportImported = Math.max(0, imported);
    next.sourceImportSkipped = Math.max(0, skipped);
    next.sourceImportFailed = Math.max(0, failed);
    next.sourceImportMessage = message;
    next.sourceImportRunning = false;
    next.loading = false;
    next.error = null;
    return next;
  }

  private static isSourcePackageImportRoute(routeId: string): boolean {
    // Both ids intentionally map to the same generated editable import
    // component. Keep the Core write fence aligned with that visible UI.
    return routeId === 'source-import-options' || routeId === 'source-add';
  }

  private static clearSourcePackageImportInPlace(state: ReaderUiState): void {
    if (!state.sourceImportRunning) return;
    state.sourceImportEpoch = state.sourceImportEpoch + 1;
    state.sourceImportRunning = false;
    state.loading = false;
  }

  // ── W5 规则替换 reducer 方法 ──
  // H4-E: When the replace rules Pilot is enabled, the coordinator's
  // dispatchReplaceRulePilot intercepts replace-rule-add/edit/toggle/
  // delete-confirm before they reach this reducer. These reducer methods
  // remain the production owner for the Shadow fallback path and for
  // non-effectful events (replace-rule-delete-request/cancel/complete,
  // replace-rule-list-loaded). The replaceRuleDeleteInFlightId guard in
  // ReaderEffects.ets prevents duplicate deletes in the Shadow fallback path.

  // 新增规则。生成仅供本地渲染的 pending id；成功或失败后均由 Core 列表回填。
  static addReplaceRule(state: ReaderUiState, pattern: string, replacement: string, scope: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const rule: ReplaceRule = {
      id: ReaderReducer.nextPendingReplaceRuleId(state),
      pattern: pattern,
      replacement: replacement,
      scope: scope,
      enabled: true,
    };
    next.replaceRules = [...state.replaceRules, rule];
    return next;
  }

  private static nextPendingReplaceRuleId(state: ReaderUiState): string {
    let ordinal = 1;
    let candidate = `pending-rule-${ordinal}`;
    let exists = true;
    while (exists) {
      exists = false;
      for (let i = 0; i < state.replaceRules.length; i++) {
        if (state.replaceRules[i].id === candidate) {
          ordinal += 1;
          candidate = `pending-rule-${ordinal}`;
          exists = true;
          break;
        }
      }
    }
    return candidate;
  }

  // 编辑规则：按 id 匹配并更新 pattern/replacement/scope（保留 enabled）。
  static editReplaceRule(state: ReaderUiState, id: string, pattern: string, replacement: string, scope: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const rules: ReplaceRule[] = [];
    for (let i = 0; i < state.replaceRules.length; i++) {
      const r = state.replaceRules[i];
      if (r.id === id) {
        rules.push({ id: r.id, pattern: pattern, replacement: replacement, scope: scope, enabled: r.enabled });
      } else {
        rules.push({ id: r.id, pattern: r.pattern, replacement: r.replacement, scope: r.scope, enabled: r.enabled });
      }
    }
    next.replaceRules = rules;
    return next;
  }

  // Replacement-rule deletion must bind a durable Core identity before the
  // confirm UI is shown. Pending local rows represent an in-flight create and
  // cannot safely be deleted through the Core `rule-N` endpoint.
  static requestReplaceRuleDelete(state: ReaderUiState, id: string): ReaderUiState {
    const target = id.trim();
    if (state.routeId !== 'reader-replace-overlay-v2' ||
      !ReaderReducer.hasPersistentReplaceRule(state, target)) {
      return ReaderReducer.setError(state, {
        code: 'REPLACE_RULE_DELETE_TARGET_REQUIRED',
        message: '只能在当前阅读器中删除一条仍由 Core 保存的规则。',
        retryable: false,
      });
    }
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.pendingReplaceRuleDeleteId = target;
    next.error = null;
    return next;
  }

  // The effect independently repeats these checks before it reaches Core.
  // Keeping them in the reducer makes forged direct confirm events visible as
  // a local error rather than silently mutating an unrelated rule.
  static confirmReplaceRuleDelete(state: ReaderUiState): ReaderUiState {
    if (state.routeId === 'reader-replace-overlay-v2' &&
      ReaderReducer.hasPersistentReplaceRule(state, state.pendingReplaceRuleDeleteId)) {
      return state;
    }
    return ReaderReducer.setError(state, {
      code: 'REPLACE_RULE_DELETE_CONFIRM_REQUIRED',
      message: '请先选择一条已保存的规则，并在当前阅读器中再次确认删除。',
      retryable: false,
    });
  }

  static cancelReplaceRuleDelete(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    ReaderReducer.clearReplaceRuleDeleteTargetInPlace(next);
    return next;
  }

  // A row disappears locally only after Core returned `deleted: true`; a
  // canonical list refresh follows immediately after this projection.
  static completeReplaceRuleDelete(state: ReaderUiState): ReaderUiState {
    const id = state.pendingReplaceRuleDeleteId;
    if (!ReaderReducer.hasPersistentReplaceRule(state, id)) return ReaderReducer.cancelReplaceRuleDelete(state);
    const next = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const rules: ReplaceRule[] = [];
    for (let i = 0; i < state.replaceRules.length; i++) {
      const rule = state.replaceRules[i];
      if (rule.id !== id) {
        rules.push({ id: rule.id, pattern: rule.pattern, replacement: rule.replacement, scope: rule.scope, enabled: rule.enabled });
      }
    }
    next.replaceRules = rules;
    ReaderReducer.clearReplaceRuleDeleteTargetInPlace(next);
    return next;
  }

  private static hasPersistentReplaceRule(state: ReaderUiState, id: string): boolean {
    if (!ReaderReducer.isCoreReplaceRuleId(id)) return false;
    for (let i = 0; i < state.replaceRules.length; i++) {
      if (state.replaceRules[i].id === id) return true;
    }
    return false;
  }

  private static canMutatePersistentReplaceRule(state: ReaderUiState, id: string): boolean {
    return state.routeId === 'reader-replace-overlay-v2' &&
      ReaderReducer.hasPersistentReplaceRule(state, id.trim());
  }

  private static isCoreReplaceRuleId(id: string): boolean {
    if (!id.startsWith('rule-') || id.length <= 'rule-'.length) return false;
    for (let i = 'rule-'.length; i < id.length; i++) {
      const code = id.charCodeAt(i);
      if (code < 48 || code > 57) return false;
    }
    return true;
  }

  private static clearReplaceRuleDeleteTargetInPlace(state: ReaderUiState): void {
    state.pendingReplaceRuleDeleteId = '';
  }

  // 切换规则启用/禁用状态。
  static toggleReplaceRule(state: ReaderUiState, id: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const rules: ReplaceRule[] = [];
    for (let i = 0; i < state.replaceRules.length; i++) {
      const r = state.replaceRules[i];
      if (r.id === id) {
        rules.push({ id: r.id, pattern: r.pattern, replacement: r.replacement, scope: r.scope, enabled: !r.enabled });
      } else {
        rules.push({ id: r.id, pattern: r.pattern, replacement: r.replacement, scope: r.scope, enabled: r.enabled });
      }
    }
    next.replaceRules = rules;
    return next;
  }

  // Toggle a string in an array: if present, remove it; otherwise append it.
  // ArkTS-safe (slice + push, no spread). Returns a new array; the input is
  // not mutated.
  private static toggleStringInArray(arr: string[], value: string): string[] {
    const result: string[] = arr.slice();
    const idx = result.indexOf(value);
    if (idx >= 0) {
      result.splice(idx, 1);
    } else {
      result.push(value);
    }
    return result;
  }

  // Build a new ReaderUiState with routeId/tab/overlay/stack overridden; other fields copied.
  // pageState is explicit so route navigation starts each page from its default
  // state instead of leaking loading/error/empty from the previous route.
  // Nested object fields (ttsSession / autoPageSession / readerToggles /
  // readerSettingOptions / selection) are shallow-copied by reference here.
  // Methods that need to mutate them MUST re-build a new object field-by-field
  // (see setReaderToggle / setTtsRate / etc.) so the previous state is not mutated.
  private static clone(s: ReaderUiState, routeId: RouteId, tab: MainTab, overlay: Overlay, stack: RouteEntry[], pageState: PageState): ReaderUiState {
    return {
      routeId: routeId,
      tab: tab,
      readerMode: s.readerMode,
      paginationMode: s.paginationMode,
      readerPageIndex: s.readerPageIndex,
      readerPageCount: s.readerPageCount,
      readerChapterOffset: s.readerChapterOffset,
      readerChapterProgress: s.readerChapterProgress,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      paragraphGap: s.paragraphGap,
      letterSpacing: s.letterSpacing,
      fontFamily: s.fontFamily,
      topMargin: s.topMargin,
      sideMargin: s.sideMargin,
      paragraphIndent: s.paragraphIndent,
      overlay: overlay,
      activeSession: s.activeSession,
      focusTarget: s.focusTarget,
      loading: s.loading,
      error: s.error,
      reducedMotion: s.reducedMotion,
      pageState: pageState,
      firstOpenPlayed: s.firstOpenPlayed,
      stack: stack,
      searchQuery: s.searchQuery,
      searchResults: s.searchResults,
      currentBook: s.currentBook,
      chapterContent: s.chapterContent,
      chapterToc: s.chapterToc,
      currentChapterTitle: s.currentChapterTitle,
      canonicalReaderLocation: s.canonicalReaderLocation,
      activeReaderContentIdentity: s.activeReaderContentIdentity,
      contentSearchQuery: s.contentSearchQuery,
      contentSearchResults: s.contentSearchResults,
      contentSearchLoading: s.contentSearchLoading,
      contentSearchLoaded: s.contentSearchLoaded,
      contentSearchError: s.contentSearchError,
      contentSearchMessage: s.contentSearchMessage,
      bookmarks: s.bookmarks,
      bookmarksLoaded: s.bookmarksLoaded,
      bookmarksLoading: s.bookmarksLoading,
      bookmarksError: s.bookmarksError,
      pendingBookmarkDeleteTime: s.pendingBookmarkDeleteTime,
      searchHistory: s.searchHistory,
      searchHistoryLoaded: s.searchHistoryLoaded,
      searchHistoryLoading: s.searchHistoryLoading,
      searchHistoryError: s.searchHistoryError,
      pendingSearchHistoryClear: s.pendingSearchHistoryClear,
      searchHistoryLimit: s.searchHistoryLimit,
      // Batch 1 nested fields — shallow reference copy. Mutating methods must
      // re-build these objects field-by-field before writing into them.
      ttsSession: s.ttsSession,
      autoPageSession: s.autoPageSession,
      brightness: s.brightness,
      brightnessAuto: s.brightnessAuto,
      readerHostMessage: s.readerHostMessage,
      tocMode: s.tocMode,
      readerToggles: s.readerToggles,
      readerSettingOptions: s.readerSettingOptions,
      selection: s.selection,
      // Batch 4 nested fields — shallow reference copy. Mutating methods must
      // re-build these objects field-by-field before writing into them.
      bookshelfFilter: s.bookshelfFilter,
      discoverFilter: s.discoverFilter,
      discoverSources: s.discoverSources,
      discoverSourceId: s.discoverSourceId,
      discoverKinds: s.discoverKinds,
      discoverKindUrl: s.discoverKindUrl,
      discoverKindTitle: s.discoverKindTitle,
      discoverBooks: s.discoverBooks,
      discoverLoading: s.discoverLoading,
      discoverLoaded: s.discoverLoaded,
      discoverError: s.discoverError,
      sourceSelection: s.sourceSelection,
      sourceSwitchEpoch: s.sourceSwitchEpoch,
      availableSources: s.availableSources,
      sourcesLoaded: s.sourcesLoaded,
      selectedSourceId: s.selectedSourceId,
      sourceCheckSourceId: s.sourceCheckSourceId,
      sourceCheckSourceName: s.sourceCheckSourceName,
      sourceCheckLoading: s.sourceCheckLoading,
      sourceCheckLoaded: s.sourceCheckLoaded,
      sourceCheckMessage: s.sourceCheckMessage,
      sourceCheckError: s.sourceCheckError,
      sourceCheckResult: s.sourceCheckResult,
      sourceDebugSourceId: s.sourceDebugSourceId,
      sourceDebugSourceName: s.sourceDebugSourceName,
      sourceDebugLoading: s.sourceDebugLoading,
      sourceDebugLoaded: s.sourceDebugLoaded,
      sourceDebugMessage: s.sourceDebugMessage,
      sourceDebugError: s.sourceDebugError,
      sourceDebugResult: s.sourceDebugResult,
      bookshelfBooks: s.bookshelfBooks,
      bookshelfLoaded: s.bookshelfLoaded,
      continueReadingBook: s.continueReadingBook,
      continueReadingLoaded: s.continueReadingLoaded,
      continueReadingError: s.continueReadingError,
      pendingBookshelfRemovalSourceId: s.pendingBookshelfRemovalSourceId,
      pendingBookshelfRemovalBookId: s.pendingBookshelfRemovalBookId,
      bookGroups: s.bookGroups,
      bookGroupsLoaded: s.bookGroupsLoaded,
      bookGroupsLoading: s.bookGroupsLoading,
      bookGroupsError: s.bookGroupsError,
      pendingBookGroupDeleteId: s.pendingBookGroupDeleteId,
      pendingBookGroupClearSourceId: s.pendingBookGroupClearSourceId,
      pendingBookGroupClearBookId: s.pendingBookGroupClearBookId,
      rssSubscriptions: s.rssSubscriptions,
      rssItems: s.rssItems,
      rssLoaded: s.rssLoaded,
      rssLoading: s.rssLoading,
      rssLoadError: s.rssLoadError,
      rssItemFilter: s.rssItemFilter,
      rssRefreshStatus: s.rssRefreshStatus,
      rssRefreshMessage: s.rssRefreshMessage,
      pendingRssSubscriptionDeleteId: s.pendingRssSubscriptionDeleteId,
      pendingReplaceRuleDeleteId: s.pendingReplaceRuleDeleteId,
      // B1 P0 全局设置字段 — 浅引用拷贝。需要修改的方法必须先重建对象。
      appThemeMode: s.appThemeMode,
      coverColumns: s.coverColumns,
      settingsToggles: s.settingsToggles,
      // F3 交互连接字段 — 浅拷贝（string 不可变，无需重建）。
      readerTheme: s.readerTheme,
      readerSettingExpandedOption: s.readerSettingExpandedOption,
      autoPageMode: s.autoPageMode,
      // P1.2/P1.3 字段 — 浅拷贝（string 不可变）。
      expandedOptionKey: s.expandedOptionKey,
      pendingCacheClear: s.pendingCacheClear,
      coreSlice10Method: s.coreSlice10Method,
      coreSlice10Loading: s.coreSlice10Loading,
      coreSlice10Result: s.coreSlice10Result,
      coreSlice10Error: s.coreSlice10Error,
      lastUndoToken: s.lastUndoToken,
      webdavServerUrl: s.webdavServerUrl,
      webdavUsername: s.webdavUsername,
      webdavPassword: s.webdavPassword,
      webdavSyncDir: s.webdavSyncDir,
      webdavTestStatus: s.webdavTestStatus,
      webdavTestMessage: s.webdavTestMessage,
      webdavSaveStatus: s.webdavSaveStatus,
      webdavSaveMessage: s.webdavSaveMessage,
      coreBackupStatus: s.coreBackupStatus,
      coreBackupMessage: s.coreBackupMessage,
      localCoreBackup: s.localCoreBackup,
      pendingCoreRestore: s.pendingCoreRestore,
      pendingCoreRestoreConfirmationChecksum: s.pendingCoreRestoreConfirmationChecksum,
      // ── W1 本地书导入 / W5 规则替换字段 ── 浅拷贝（string/number 不可变；数组引用拷贝，修改方法重建新数组）。
      importPreviewFormat: s.importPreviewFormat,
      importPreviewEncoding: s.importPreviewEncoding,
      importPreviewCount: s.importPreviewCount,
      localImportEpoch: s.localImportEpoch,
      sourceImportOrigin: s.sourceImportOrigin,
      sourceImportTotal: s.sourceImportTotal,
      sourceImportImported: s.sourceImportImported,
      sourceImportSkipped: s.sourceImportSkipped,
      sourceImportFailed: s.sourceImportFailed,
      sourceImportMessage: s.sourceImportMessage,
      sourceImportRunning: s.sourceImportRunning,
      sourceImportEpoch: s.sourceImportEpoch,
      replaceRules: s.replaceRules,
    };
  }

  private static readerRenderMetricValue(state: ReaderUiState, metric: ReaderRenderMetric): number {
    switch (metric) {
      case 'fontSize': return state.fontSize;
      case 'lineHeight': return state.lineHeight;
      case 'paragraphGap': return state.paragraphGap;
      case 'letterSpacing': return state.letterSpacing;
      case 'topMargin': return state.topMargin;
      case 'sideMargin': return state.sideMargin;
      case 'paragraphIndent': return state.paragraphIndent;
      default: return 0;
    }
  }
}
