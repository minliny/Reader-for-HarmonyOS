// ReaderReducer — pure function reduce(state, event) -> new state.
// No side effects. ArkTS forbids object spread (arkts-no-spread), so each method builds a
// new ReaderUiState literal field-by-field (array spread is still allowed).
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderUiState, UiEvent, MainTab, Overlay, PageState, ReaderMode, ReaderPaginationMode, ReaderFontFamily, ReaderRenderMetric, RouteEntry, ReaderError, SearchResultEntry, BookDetail } from './ReaderUiState';

function tabRoot(tab: MainTab): RouteId {
  switch (tab) {
    case 'bookshelf': return 'bookshelf';
    case 'discover': return 'discover';
    case 'rss': return 'rss';
    case 'settings': return 'settings';
    default: return 'bookshelf';
  }
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
  switch (metric) {
    case 'fontSize': return 14;
    case 'lineHeight': return 1.4;
    case 'paragraphGap': return 4;
    case 'letterSpacing': return 0;
    case 'topMargin': return 48;
    case 'sideMargin': return 20;
    case 'bottomMargin': return 32;
    case 'paragraphIndent': return 0;
    default: return 0;
  }
}

function metricMax(metric: ReaderRenderMetric): number {
  switch (metric) {
    case 'fontSize': return 26;
    case 'lineHeight': return 2.4;
    case 'paragraphGap': return 32;
    case 'letterSpacing': return 2;
    case 'topMargin': return 96;
    case 'sideMargin': return 48;
    case 'bottomMargin': return 96;
    case 'paragraphIndent': return 3;
    default: return 100;
  }
}

function metricStep(metric: ReaderRenderMetric): number {
  switch (metric) {
    case 'fontSize': return 1;
    case 'lineHeight': return 0.08;
    case 'paragraphGap': return 2;
    case 'letterSpacing': return 0.2;
    case 'topMargin': return 4;
    case 'sideMargin': return 4;
    case 'bottomMargin': return 4;
    case 'paragraphIndent': return 0.5;
    default: return 1;
  }
}

function metricPrecision(metric: ReaderRenderMetric): number {
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
    switch (event.type) {
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
      case 'set-loading': {
        const l = event.loading;
        return l !== undefined ? ReaderReducer.setLoading(state, l) : state;
      }
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
      case 'book-detail-success': {
        const book = event.book ?? null;
        return ReaderReducer.setCurrentBook(state, book);
      }
      case 'chapter-load':
        return ReaderReducer.setRouteLoading(state);
      case 'chapter-success': {
        const paras = event.chapterParagraphs ?? [];
        return ReaderReducer.setChapterContent(state, paras);
      }
      default:
        return state;
    }
  }

  static push(state: ReaderUiState, id: RouteId): ReaderUiState {
    const entry: RouteEntry = { id: id };
    const stack: RouteEntry[] = [...state.stack, entry];
    return ReaderReducer.clone(state, id, state.tab, '', stack, 'default');
  }

  static pop(state: ReaderUiState): ReaderUiState {
    if (state.stack.length <= 1) return state;
    const stack = state.stack.slice(0, -1);
    const top = stack[stack.length - 1];
    return ReaderReducer.clone(state, top.id, state.tab, '', stack, 'default');
  }

  static replace(state: ReaderUiState, id: RouteId): ReaderUiState {
    if (state.stack.length === 0) return ReaderReducer.push(state, id);
    const stack = state.stack.slice(0, -1);
    stack.push({ id: id });
    return ReaderReducer.clone(state, id, state.tab, '', stack, 'default');
  }

  static switchTab(state: ReaderUiState, tab: MainTab): ReaderUiState {
    const root = tabRoot(tab);
    const stack: RouteEntry[] = [{ id: root }];
    return ReaderReducer.clone(state, root, tab, '', stack, 'default');
  }

  static setOverlay(state: ReaderUiState, overlay: Overlay): ReaderUiState {
    return ReaderReducer.clone(state, state.routeId, state.tab, overlay, state.stack, state.pageState);
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
      case 'bottomMargin':
        next.bottomMargin = normalized;
        break;
      case 'paragraphIndent':
        next.paragraphIndent = normalized;
        break;
      default:
        break;
    }
    return next;
  }

  static setReaderFontFamily(state: ReaderUiState, family: ReaderFontFamily): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.fontFamily = family;
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
    next.bottomMargin = 48;
    next.paragraphIndent = 2;
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

  static firstOpenDone(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.firstOpenPlayed = true;
    next.loading = false;
    return next;
  }

  static setSearchQuery(state: ReaderUiState, query: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.searchQuery = query;
    next.loading = true;
    next.pageState = 'loading';
    next.error = null;
    return next;
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
    next.currentBook = book;
    next.loading = false;
    next.pageState = 'default';
    next.error = null;
    return next;
  }

  static setChapterContent(state: ReaderUiState, paragraphs: string[]): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, 'default');
    next.chapterContent = paragraphs;
    next.loading = false;
    next.readerMode = 'default';
    next.error = null;
    return next;
  }

  // Build a new ReaderUiState with routeId/tab/overlay/stack overridden; other fields copied.
  // pageState is explicit so route navigation starts each page from its default
  // state instead of leaking loading/error/empty from the previous route.
  private static clone(s: ReaderUiState, routeId: RouteId, tab: MainTab, overlay: Overlay, stack: RouteEntry[], pageState: PageState): ReaderUiState {
    return {
      routeId: routeId,
      tab: tab,
      readerMode: s.readerMode,
      paginationMode: s.paginationMode,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      paragraphGap: s.paragraphGap,
      letterSpacing: s.letterSpacing,
      fontFamily: s.fontFamily,
      topMargin: s.topMargin,
      sideMargin: s.sideMargin,
      bottomMargin: s.bottomMargin,
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
      case 'bottomMargin': return state.bottomMargin;
      case 'paragraphIndent': return state.paragraphIndent;
      default: return 0;
    }
  }
}
