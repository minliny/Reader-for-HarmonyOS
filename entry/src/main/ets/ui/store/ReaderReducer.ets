import { PageState } from '../../contract';
import { ReaderMainTab, ReaderRoute } from '../ReaderRouteMapping';
import { ReaderEntryTarget, ReaderUiReducer, ReaderUiState } from '../ReaderUiState';

export type ReaderReducerEventType =
  'app.firstOpen.enter' |
  'tab.select' |
  'reader.entry' |
  'pageState.set' |
  'reducedMotion.set' |
  'overlay.open' |
  'overlay.close' |
  'session.start' |
  'session.stop' |
  'async.begin' |
  'async.complete';

export interface ReaderReducerEvent {
  type: ReaderReducerEventType;
  tab?: string;
  pageState?: PageState;
  reducedMotion?: boolean;
  target?: ReaderEntryTarget;
  overlayKind?: string;
  triggerId?: string;
  sessionKind?: string;
  requestId?: number;
  targetRoute?: string;
}

export class ReaderReducer {
  static initialState(): ReaderUiState {
    return ReaderUiReducer.initialState();
  }

  static reduce(state: ReaderUiState, event: ReaderReducerEvent): ReaderUiState {
    if (event.type === 'tab.select') {
      return ReaderReducer.selectTab(state, event.tab ?? ReaderMainTab.bookshelf);
    }
    if (event.type === 'reader.entry' && event.target) {
      return ReaderReducer.enterReader(state, event.target);
    }
    if (event.type === 'pageState.set') {
      return ReaderReducer.setPageState(state, event.pageState ?? 'default');
    }
    if (event.type === 'reducedMotion.set') {
      return ReaderReducer.setReducedMotion(state, event.reducedMotion === true);
    }
    if (event.type === 'app.firstOpen.enter') {
      return ReaderReducer.markFirstOpenPlayed(state);
    }
    if (event.type === 'overlay.open') {
      return ReaderReducer.openOverlay(state, event.overlayKind ?? 'sheet', event.triggerId ?? 'reader.control.handle');
    }
    if (event.type === 'overlay.close') {
      return ReaderReducer.closeOverlay(state);
    }
    if (event.type === 'session.start') {
      return ReaderReducer.startSession(state, event.sessionKind ?? 'tts');
    }
    if (event.type === 'session.stop') {
      return ReaderReducer.stopSession(state);
    }
    if (event.type === 'async.begin') {
      return ReaderReducer.beginAsyncIntent(state, event.requestId ?? 0, event.targetRoute ?? state.route.id);
    }
    if (event.type === 'async.complete') {
      return ReaderReducer.completeAsyncIntent(state, event.requestId ?? 0, event.targetRoute ?? state.route.id);
    }
    return state;
  }

  static selectTab(state: ReaderUiState, tab: string): ReaderUiState {
    return ReaderUiReducer.selectTab(state, tab);
  }

  static enterReader(state: ReaderUiState, target: ReaderEntryTarget): ReaderUiState {
    return ReaderUiReducer.pushReaderEntry(state, target);
  }

  static setReducedMotion(state: ReaderUiState, enabled: boolean): ReaderUiState {
    return ReaderUiReducer.setReducedMotion(state, enabled);
  }

  static setPageState(state: ReaderUiState, pageState: PageState): ReaderUiState {
    const next = ReaderReducer.copyAppShellState(state);
    next.pageState = pageState;
    next.loading = pageState === 'loading';
    next.error = pageState === 'error' ? { code: 'APP_SHELL_ERROR', message: 'AppShell state layer error', retryable: true } : undefined;
    return next;
  }

  static openOverlay(state: ReaderUiState, kind: string, triggerId: string): ReaderUiState {
    return ReaderUiReducer.openOverlay(state, kind, triggerId);
  }

  static closeOverlay(state: ReaderUiState): ReaderUiState {
    return ReaderUiReducer.closeOverlay(state);
  }

  static startSession(state: ReaderUiState, kind: string): ReaderUiState {
    return ReaderUiReducer.startReaderSession(state, kind);
  }

  static stopSession(state: ReaderUiState): ReaderUiState {
    return ReaderUiReducer.stopReaderSession(state);
  }

  static beginAsyncIntent(state: ReaderUiState, requestId: number, targetRoute: string): ReaderUiState {
    return ReaderUiReducer.beginAsyncIntent(state, requestId, targetRoute);
  }

  static completeAsyncIntent(state: ReaderUiState, requestId: number, targetRoute: string): ReaderUiState {
    return ReaderUiReducer.completeAsyncIntent(state, requestId, targetRoute);
  }

  static markFirstOpenPlayed(state: ReaderUiState): ReaderUiState {
    const next = ReaderReducer.copyAppShellState(state);
    next.firstOpen = { hasPlayed: true, motionTimer: 0 };
    return next;
  }

  static mainTabs(): string[] {
    return ReaderMainTab.all.slice();
  }

  private static copyAppShellState(state: ReaderUiState): ReaderUiState {
    const next = new ReaderUiState();
    next.route = {
      id: state.route.id,
      params: state.route.params,
      stack: state.route.stack
    };
    next.tab = state.tab;
    next.readerMode = state.readerMode;
    next.overlay = state.overlay;
    next.activeSession = state.activeSession;
    next.focusTarget = state.focusTarget;
    next.loading = state.loading;
    next.error = state.error ? { code: state.error.code, message: state.error.message, retryable: state.error.retryable } : undefined;
    next.reducedMotion = state.reducedMotion;
    next.pageState = state.pageState;
    next.bookshelf = state.bookshelf;
    next.discover = state.discover;
    next.reader = state.reader;
    next.settings = state.settings;
    next.motion = state.motion;
    next.firstOpen = state.firstOpen;

    next.currentRoute = state.route.id;
    next.activeTab = state.activeTab;
    next.routeStack = state.routeStack.slice();
    next.backStack = state.backStack.slice();
    next.readerPresentationRoute = state.readerPresentationRoute;
    next.bookshelfView = state.bookshelfView;
    next.bookshelfGroup = state.bookshelfGroup;
    next.bookshelfSort = state.bookshelfSort;
    next.bookshelfFilter = state.bookshelfFilter;
    next.bookshelfFilterOpen = state.bookshelfFilterOpen;
    next.motionState = state.motionState;
    next.motionInterrupt = state.motionInterrupt;
    next.entryRequestId = state.entryRequestId;
    next.adaptive = state.adaptive;
    return next;
  }
}

export { ReaderEntryTarget, ReaderUiState, ReaderRoute, ReaderMainTab };
