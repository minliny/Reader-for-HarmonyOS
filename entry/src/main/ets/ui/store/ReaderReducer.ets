// ReaderReducer — pure function reduce(state, event) -> new state.
// No side effects. ArkTS forbids object spread (arkts-no-spread), so each method builds a
// new ReaderUiState literal field-by-field (array spread is still allowed).
import { RouteId } from '../../contract/generated/RouteTable';
import { ReaderUiState, UiEvent, MainTab, Overlay, PageState, ReaderMode, RouteEntry, ReaderError } from './ReaderUiState';

function tabRoot(tab: MainTab): RouteId {
  switch (tab) {
    case 'bookshelf': return 'bookshelf';
    case 'discover': return 'discover';
    case 'rss': return 'rss';
    case 'settings': return 'settings';
    default: return 'bookshelf';
  }
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
      default:
        return state;
    }
  }

  static push(state: ReaderUiState, id: RouteId): ReaderUiState {
    const entry: RouteEntry = { id: id };
    const stack: RouteEntry[] = [...state.stack, entry];
    return ReaderReducer.clone(state, id, state.tab, '', stack);
  }

  static pop(state: ReaderUiState): ReaderUiState {
    if (state.stack.length <= 1) return state;
    const stack = state.stack.slice(0, -1);
    const top = stack[stack.length - 1];
    return ReaderReducer.clone(state, top.id, state.tab, '', stack);
  }

  static replace(state: ReaderUiState, id: RouteId): ReaderUiState {
    if (state.stack.length === 0) return ReaderReducer.push(state, id);
    const stack = state.stack.slice(0, -1);
    stack.push({ id: id });
    return ReaderReducer.clone(state, id, state.tab, '', stack);
  }

  static switchTab(state: ReaderUiState, tab: MainTab): ReaderUiState {
    const root = tabRoot(tab);
    const stack: RouteEntry[] = [{ id: root }];
    return ReaderReducer.clone(state, root, tab, '', stack);
  }

  static setOverlay(state: ReaderUiState, overlay: Overlay): ReaderUiState {
    return ReaderReducer.clone(state, state.routeId, state.tab, overlay, state.stack);
  }

  static setPageState(state: ReaderUiState, pageState: PageState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack);
    next.pageState = pageState;
    return next;
  }

  static setReaderMode(state: ReaderUiState, mode: ReaderMode): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack);
    next.readerMode = mode;
    return next;
  }

  static setReducedMotion(state: ReaderUiState, enabled: boolean): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack);
    next.reducedMotion = enabled;
    return next;
  }

  static setLoading(state: ReaderUiState, loading: boolean): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack);
    next.loading = loading;
    return next;
  }

  static setError(state: ReaderUiState, error: ReaderError | null): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack);
    next.error = error;
    return next;
  }

  static firstOpenDone(state: ReaderUiState): ReaderUiState {
    const next: ReaderUiState = ReaderReducer.clone(state, state.routeId, state.tab, state.overlay, state.stack);
    next.firstOpenPlayed = true;
    next.loading = false;
    return next;
  }

  // Build a new ReaderUiState with routeId/tab/overlay/stack overridden; other fields copied.
  private static clone(s: ReaderUiState, routeId: RouteId, tab: MainTab, overlay: Overlay, stack: RouteEntry[]): ReaderUiState {
    return {
      routeId: routeId,
      tab: tab,
      readerMode: s.readerMode,
      overlay: overlay,
      activeSession: s.activeSession,
      focusTarget: s.focusTarget,
      loading: s.loading,
      error: s.error,
      reducedMotion: s.reducedMotion,
      pageState: s.pageState,
      firstOpenPlayed: s.firstOpenPlayed,
      stack: stack,
    };
  }
}
