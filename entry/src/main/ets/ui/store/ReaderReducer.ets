// ReaderReducer — pure function reduce(state, event) -> new state.
// No side effects. ArkTS forbids object spread (arkts-no-spread), so each method builds a
// new ReaderUiState literal field-by-field (array spread is still allowed).
import { RouteId, RouteTable } from '../../contract/generated/RouteTable';
import { ReaderUiState, UiEvent, MainTab, Overlay, PageState, ReaderMode, ReaderPaginationMode, ReaderFontFamily, ReaderRenderMetric, RouteEntry, ReaderError, SearchResultEntry, BookDetail, ActiveSession, TtsPlaybackState, TtsScope, TtsTimer, TocMode, ReaderToggleKey, ReaderSettingOptionKey, ReaderTogglesMap, ReaderSettingOptionsMap, BookshelfView, BookshelfFilterState, DiscoverFilterState, SettingsTogglesMap, ReplaceRule } from './ReaderUiState';

function tabRoot(tab: MainTab): RouteId {
  switch (tab) {
    case 'bookshelf': return 'bookshelf';
    case 'discover': return 'discover';
    case 'rss': return 'rss';
    case 'settings': return 'settings';
    default: return 'bookshelf';
  }
}

// reader-module-switch 辅助：module 名称 -> 模块 overlay 路由 id。
// 调用方应先用 isValidReaderModule 校验，避免命中 default 回退分支。
function moduleRouteId(module: string): RouteId {
  switch (module) {
    case 'directory': return 'reader-directory-overlay-v2';
    case 'tts': return 'reader-tts-overlay-v2';
    case 'appearance': return 'reader-appearance-overlay-v2';
    case 'settings': return 'reader-settings-overlay-v2';
    case 'search': return 'reader-search-overlay-v2';
    case 'auto-page': return 'reader-auto-scroll-overlay-v2';
    case 'replacement': return 'reader-replace-overlay-v2';
    default: return 'reader-directory-overlay-v2';
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
  return module === 'directory' || module === 'tts' || module === 'appearance' ||
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
  switch (metric) {
    case 'fontSize': return 14;
    case 'lineHeight': return 1.4;
    case 'paragraphGap': return 4;
    case 'letterSpacing': return 0;
    case 'topMargin': return 48;
    case 'sideMargin': return 20;
    case 'bottomMargin': return 8;
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
        return ReaderReducer.setSelectionVisible(state, true);
      case 'selection-close':
        return ReaderReducer.setSelectionVisible(state, false);
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
      case 'set-discover-filter-toggle': {
        const f = event.discoverFilterToggle;
        return f !== undefined ? ReaderReducer.toggleDiscoverFilter(state, f) : state;
      }
      case 'set-discover-sort': {
        const s = event.discoverSort;
        return s !== undefined ? ReaderReducer.setDiscoverSort(state, s) : state;
      }
      case 'source-toggle': {
        const id = event.sourceId;
        return id !== undefined ? ReaderReducer.toggleSource(state, id) : state;
      }
      case 'source-select-all':
        return ReaderReducer.selectAllSources(state);
      case 'source-clear':
        return ReaderReducer.clearSources(state);
      case 'book-action': {
        const a = event.bookAction;
        return a !== undefined ? ReaderReducer.handleBookAction(state, a) : state;
      }
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
        // 状态机标记 + 透传给 effect（cache-clear / clear-search-history）
        const key = event.settingsKey;
        return key !== undefined ? ReaderReducer.markSettingsAction(state, key) : state;
      }
      // ── P1.3 WebDAV 配置 cases ──
      case 'webdav-field-update': {
        const field = event.field;
        const val = event.settingsValue;
        return field !== undefined && val !== undefined ? ReaderReducer.updateWebdavField(state, field, val) : state;
      }
      case 'webdav-test':
        return ReaderReducer.setWebdavTestStatus(state, 'testing', '');
      case 'webdav-test-result': {
        const ok = event.success === true;
        return ReaderReducer.setWebdavTestStatus(state, ok ? 'success' : 'error', event.message ?? '');
      }
      case 'webdav-save':
        return ReaderReducer.setWebdavSaveStatus(state, 'saving', '');
      case 'webdav-save-result': {
        const ok = event.success === true;
        return ReaderReducer.setWebdavSaveStatus(state, ok ? 'saved' : 'error', event.message ?? '');
      }
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
        return ReaderReducer.clone(state, top.id, state.tab, '', stack, 'default');
      }
      case 'reader-module-switch': {
        // 模块切换（replace 语义）：栈顶已是模块 overlay 时 replace，否则 push。
        const module = event.module ?? '';
        if (!isValidReaderModule(module)) return state;
        const targetId = moduleRouteId(module);
        if (state.stack.length > 0 && isReaderModuleOverlay(state.stack[state.stack.length - 1].id)) {
          return ReaderReducer.replace(state, targetId);
        }
        return ReaderReducer.push(state, targetId);
      }
      case 'reader-page-prev':
        // No-op：页码未在 state 中追踪（与 chapter-prev 一致，保留 case 使
        // default 不吞掉事件；实际翻页由渲染层处理）。
        return state;
      case 'source-switch-confirm':
        // 确认换源：pop 路由回到来源页（实际书源切换由 Effects 层执行）。
        return ReaderReducer.pop(state);
      case 'source-switch-cancel':
        // 取消换源：pop 路由回到来源页。
        return ReaderReducer.pop(state);
      // ── W1 资源导入 cases（source.import.* 归一化为 source-import-*）──
      case 'source-import-open':
        // 打开本地导入页：push 'local-import' 路由。
        return ReaderReducer.openLocalImport(state);
      case 'source-import-preview': {
        // 设置导入预览格式。
        const fmt = event.importFormat ?? '';
        return ReaderReducer.setImportPreviewFormat(state, fmt);
      }
      case 'source-import-apply': {
        // 应用导入：pop 回书架并记录导入数量（toast 由 effect 层 dispatch feedback.toast.show）。
        const cnt = event.importCount ?? 0;
        return ReaderReducer.applyImport(state, cnt);
      }
      // ── W5 规则替换 cases（replace.rule.* 归一化为 replace-rule-*）──
      case 'replace-rule-add': {
        const id = event.replaceRuleId ?? `rule-${state.replaceRules.length + 1}`;
        const pattern = event.replaceRulePattern ?? '';
        const replacement = event.replaceRuleReplacement ?? '';
        const scope = event.replaceRuleScope ?? 'chapter';
        return ReaderReducer.addReplaceRule(state, id, pattern, replacement, scope);
      }
      case 'replace-rule-edit': {
        const id = event.replaceRuleId ?? '';
        if (id.length === 0) return state;
        return ReaderReducer.editReplaceRule(state, id, event.replaceRulePattern ?? '', event.replaceRuleReplacement ?? '', event.replaceRuleScope ?? 'chapter');
      }
      case 'replace-rule-delete': {
        const id = event.replaceRuleId ?? '';
        if (id.length === 0) return state;
        return ReaderReducer.deleteReplaceRule(state, id);
      }
      case 'replace-rule-toggle': {
        const id = event.replaceRuleId ?? '';
        if (id.length === 0) return state;
        return ReaderReducer.toggleReplaceRule(state, id);
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
    next.bottomMargin = 16;
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
    } else if (session === 'auto-page') {
      next.autoPageSession = {
        playing: true,
        countdownSeconds: state.autoPageSession.intervalSeconds,
        intervalSeconds: state.autoPageSession.intervalSeconds,
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
    return next;
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
    if (state.activeSession !== 'auto-page') {
      next.activeSession = 'auto-page';
      next.autoPageSession = {
        playing: true,
        countdownSeconds: state.autoPageSession.intervalSeconds,
        intervalSeconds: state.autoPageSession.intervalSeconds,
      };
    } else {
      next.activeSession = '';
      next.autoPageSession = {
        playing: false,
        countdownSeconds: 0,
        intervalSeconds: state.autoPageSession.intervalSeconds,
      };
    }
    return next;
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

  // Update a single reader setting option (pageMode / tapMode / pageAnimation).
  static setReaderSettingOption(state: ReaderUiState, key: ReaderSettingOptionKey, value: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const options: ReaderSettingOptionsMap = {
      pageMode: state.readerSettingOptions.pageMode,
      tapMode: state.readerSettingOptions.tapMode,
      pageAnimation: state.readerSettingOptions.pageAnimation,
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

  // Set selection toolbar visibility. When hiding, also clear action and
  // selectedText so stale state doesn't linger.
  static setSelectionVisible(state: ReaderUiState, visible: boolean): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    if (visible) {
      next.selection = {
        visible: true,
        action: state.selection.action,
        selectedText: state.selection.selectedText,
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

  // Set the selection action (copy / highlight / note / search).
  static setSelectionAction(state: ReaderUiState, action: string): ReaderUiState {
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

  // Toggle a single source id in sourceSelection. If the id is present, remove
  // it; otherwise append it.
  static toggleSource(state: ReaderUiState, id: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceSelection = ReaderReducer.toggleStringInArray(state.sourceSelection, id);
    return next;
  }

  // Select all sources. Currently a no-op because the available source list is
  // not tracked in state yet — the component layer knows the candidate ids and
  // can dispatch source-toggle per item. Kept as a hook so future state
  // extensions can populate the full list here.
  static selectAllSources(state: ReaderUiState): ReaderUiState {
    return state;
  }

  // Clear all selected sources.
  static clearSources(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.sourceSelection = [];
    return next;
  }

  // Handle a book action (branch / delete). Simplified: opens the 'book-action'
  // overlay so the action sheet renders; actual branch/delete logic is owned by
  // the Effects layer (book storage), which fires here as a log only.
  static handleBookAction(state: ReaderUiState, action: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.overlay = 'book-action';
    return next;
  }

  // ── B1 P0 全局设置 segment/stepper/switch reducers ──

  // 切换全局设置中的 segment 选项（当前仅 appThemeMode）。
  // ArkTS 不支持对象展开，直接写字段。
  static switchSettingsSegment(state: ReaderUiState, key: string, value: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    if (key === 'appThemeMode') {
      next.appThemeMode = value;
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
    // action 类型不需要持久化 key 到 state，这里仅做无副作用的 clone 标记。
    // 实际副作用（cache-clear / clear-search-history）由 ReaderEffects.settings-action 处理。
    return next;
  }

  // ── P1.3 WebDAV 配置辅助方法 ──
  static updateWebdavField(state: ReaderUiState, field: string, value: string): ReaderUiState {
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

  static setWebdavSaveStatus(state: ReaderUiState, status: string, message: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.webdavSaveStatus = status;
    next.webdavSaveMessage = message;
    return next;
  }

  // ── W1 资源导入 reducer 方法 ──

  // 打开本地导入页：push 'local-import' 路由。
  static openLocalImport(state: ReaderUiState): ReaderUiState {
    return ReaderReducer.push(state, 'local-import');
  }

  // 设置导入预览格式（json / txt 等）。
  static setImportPreviewFormat(state: ReaderUiState, format: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    next.importPreviewFormat = format;
    return next;
  }

  // 应用导入：pop 回书架并记录导入数量，清空预览格式。
  // toast 提示由 effect 层通过 feedback.toast.show 事件派发。
  static applyImport(state: ReaderUiState, count: number): ReaderUiState {
    const popped = ReaderReducer.pop(state);
    const next: ReaderUiState = ReaderReducer.clone(popped, popped.routeId, popped.tab, popped.overlay, popped.stack, popped.pageState);
    next.importPreviewCount = count;
    next.importPreviewFormat = '';
    return next;
  }

  // ── W5 规则替换 reducer 方法 ──

  // 新增规则。生成新 ReplaceRule 并追加到 replaceRules 数组。
  static addReplaceRule(state: ReaderUiState, id: string, pattern: string, replacement: string, scope: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const rule: ReplaceRule = { id: id, pattern: pattern, replacement: replacement, scope: scope, enabled: true };
    next.replaceRules = [...state.replaceRules, rule];
    return next;
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

  // 删除规则：按 id 过滤掉。
  static deleteReplaceRule(state: ReaderUiState, id: string): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack, state.pageState);
    const rules: ReplaceRule[] = [];
    for (let i = 0; i < state.replaceRules.length; i++) {
      if (state.replaceRules[i].id !== id) {
        const r = state.replaceRules[i];
        rules.push({ id: r.id, pattern: r.pattern, replacement: r.replacement, scope: r.scope, enabled: r.enabled });
      }
    }
    next.replaceRules = rules;
    return next;
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
      // Batch 1 nested fields — shallow reference copy. Mutating methods must
      // re-build these objects field-by-field before writing into them.
      ttsSession: s.ttsSession,
      autoPageSession: s.autoPageSession,
      brightness: s.brightness,
      brightnessAuto: s.brightnessAuto,
      tocMode: s.tocMode,
      readerToggles: s.readerToggles,
      readerSettingOptions: s.readerSettingOptions,
      selection: s.selection,
      // Batch 4 nested fields — shallow reference copy. Mutating methods must
      // re-build these objects field-by-field before writing into them.
      bookshelfFilter: s.bookshelfFilter,
      discoverFilter: s.discoverFilter,
      sourceSelection: s.sourceSelection,
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
      webdavServerUrl: s.webdavServerUrl,
      webdavUsername: s.webdavUsername,
      webdavPassword: s.webdavPassword,
      webdavSyncDir: s.webdavSyncDir,
      webdavTestStatus: s.webdavTestStatus,
      webdavTestMessage: s.webdavTestMessage,
      webdavSaveStatus: s.webdavSaveStatus,
      webdavSaveMessage: s.webdavSaveMessage,
      // ── W1 资源导入 / W5 规则替换字段 ── 浅拷贝（string/number 不可变；数组引用拷贝，修改方法重建新数组）。
      importPreviewFormat: s.importPreviewFormat,
      importPreviewCount: s.importPreviewCount,
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
      case 'bottomMargin': return state.bottomMargin;
      case 'paragraphIndent': return state.paragraphIndent;
      default: return 0;
    }
  }
}
