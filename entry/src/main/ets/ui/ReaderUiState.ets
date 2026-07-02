import { ReaderMainTab, ReaderRoute } from './ReaderRouteMapping';
import { ReaderMotion, ReaderMotionId } from './ReaderMotion';
import { ReaderAdaptive, ReaderAdaptiveState } from './ReaderAdaptive';

export class ReaderContext {
  bookId: string = '';
  sourceId: string = '';
  bookTitle: string = '';
  author: string = '';
  chapterTitle: string = '';
  progressText: string = '';
  contentPreview: string = '';
  sourceRoute: string = ReaderRoute.bookshelf;
  entryKind: string = 'cover';
}

export class ReaderEntryTarget {
  bookId: string = '';
  sourceId: string = '';
  bookTitle: string = '';
  author: string = '';
  chapterTitle: string = '';
  progressText: string = '';
  contentPreview: string = '';
  sourceRoute: string = ReaderRoute.bookshelf;
  entryKind: string = 'cover';
}

export class ReaderOverlayState {
  kind: string = 'none';
  isOpen: boolean = false;
  focusOwner: string = 'none';
  focusReturn: string = 'reader-body';
}

export class ReaderActiveSessionState {
  kind: string = 'none';
  playing: boolean = false;
  capsuleVisible: boolean = false;
  label: string = '';
  statusText: string = '';
}

export class ReaderFocusState {
  owner: string = 'none';
  returnTo: string = 'none';
}

export class ReaderAsyncResultState {
  requestId: number = 0;
  status: string = 'idle';
  targetRoute: string = '';
}

export class ReaderMotionState {
  activeMotionId: string = '';
  appMotionId: string = '';
  from: string = '';
  to: string = '';
  finalState: string = '';
  interruptPolicy: string = '';
  sequence: number = 0;
  durationMs: number = 0;
}

export class ReaderMode {
  static readonly immersive: string = 'immersive';
  static readonly control: string = 'control';
  static readonly module: string = 'module';
  static readonly quick: string = 'quick';
  static readonly full: string = 'full';
  static readonly utility: string = 'utility';
  static readonly loading: string = 'loading';
}

export class ReaderModuleType {
  static readonly none: string = 'none';
  static readonly directory: string = 'directory';
  static readonly tts: string = 'tts';
  static readonly appearance: string = 'appearance';
  static readonly settings: string = 'settings';
}

export class ReaderQuickPanelType {
  static readonly none: string = 'none';
  static readonly search: string = 'search';
  static readonly autoPage: string = 'autoPage';
  static readonly replace: string = 'replace';
}

export class ReaderUiState {
  route: string = ReaderRoute.bookshelf;
  currentRoute: string = ReaderRoute.bookshelf;
  readerPresentationRoute: string = ReaderRoute.immersiveReading;
  readerMode: string = ReaderMode.immersive;
  activeReaderModule: string = ReaderModuleType.none;
  activeQuickPanel: string = ReaderQuickPanelType.none;
  activeTab: string = ReaderMainTab.bookshelf;
  routeStack: string[] = [ReaderRoute.bookshelf];
  backStack: string[] = [ReaderRoute.bookshelf];
  readerContext: ReaderContext = new ReaderContext();
  overlay: ReaderOverlayState = new ReaderOverlayState();
  overlayState: ReaderOverlayState = new ReaderOverlayState();
  focusState: ReaderFocusState = new ReaderFocusState();
  activeSession: ReaderActiveSessionState = new ReaderActiveSessionState();
  asyncResult: ReaderAsyncResultState = new ReaderAsyncResultState();
  motion: ReaderMotionState = new ReaderMotionState();
  motionInterrupt: string = '';
  reducedMotion: boolean = false;
  entryRequestId: number = 0;
  adaptive: ReaderAdaptiveState = ReaderAdaptive.initialState();
}

export class ReaderUiReducer {
  static initialState(): ReaderUiState {
    return new ReaderUiState();
  }

  static setReducedMotion(state: ReaderUiState, enabled: boolean): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    next.reducedMotion = enabled;
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.motionInterruptCancel,
      state.route,
      state.route,
      state.route,
      'reduced-motion-toggle',
      state.motion.sequence + 1,
      ReaderMotion.durationInterruptSettle(enabled)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static setAdaptive(state: ReaderUiState, adaptive: ReaderAdaptiveState): ReaderUiState {
    if (ReaderAdaptive.equals(state.adaptive, adaptive)) {
      return state;
    }
    const next = ReaderUiReducer.clone(state);
    next.adaptive = adaptive;
    return ReaderUiReducer.syncContractFields(next);
  }

  static selectTab(state: ReaderUiState, tab: string): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    const previousRoute = state.route;
    next.activeTab = tab;
    next.route = ReaderRoute.rootForTab(tab);
    next.readerPresentationRoute = ReaderRoute.immersiveReading;
    next.routeStack = [next.route];
    next.overlay = new ReaderOverlayState();
    next.activeSession = new ReaderActiveSessionState();
    next.focusState = ReaderUiReducer.focus('main-tab', 'none');
    next.motion = ReaderUiReducer.motion(
      state.activeTab === tab ? ReaderMotionId.tabItemSelect : ReaderMotionId.tabItemSwitch,
      previousRoute,
      next.route,
      next.route,
      'latest-tab-wins',
      state.motion.sequence + 1,
      ReaderMotion.durationTabSwitch(state.reducedMotion),
      state.activeTab === tab ? '' : ReaderMotionId.appTabSwitch
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static pushReaderEntry(state: ReaderUiState, target: ReaderEntryTarget): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    const sourceRoute = target.sourceRoute.length > 0 ? target.sourceRoute : ReaderRoute.rootForTab(state.activeTab);
    next.activeTab = ReaderRoute.tabForRoute(sourceRoute, state.activeTab);
    next.route = ReaderRoute.immersiveReading;
    next.readerPresentationRoute = ReaderRoute.immersiveReading;
    next.routeStack = [sourceRoute, ReaderRoute.immersiveReading];
    next.readerContext = ReaderUiReducer.contextFromTarget(target, sourceRoute);
    next.overlay = new ReaderOverlayState();
    next.activeSession = new ReaderActiveSessionState();
    next.focusState = ReaderUiReducer.focus('reader-body', 'bookshelf');
    next.entryRequestId = state.entryRequestId + 1;
    next.asyncResult = ReaderUiReducer.asyncResult(next.entryRequestId, 'completed', ReaderRoute.immersiveReading);
    next.motion = ReaderUiReducer.motion(
      target.entryKind === 'action' ? ReaderMotionId.readerEntryActionToImmersive : ReaderMotionId.readerEntryCoverToImmersive,
      sourceRoute,
      ReaderRoute.immersiveReading,
      ReaderRoute.immersiveReading,
      'latest-entry-wins',
      state.motion.sequence + 1,
      ReaderMotion.durationReaderEntry(state.reducedMotion),
      ReaderMotionId.appRoutePush
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static showReaderControls(state: ReaderUiState): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    next.readerPresentationRoute = ReaderRoute.readerControl;
    next.overlay = ReaderUiReducer.overlay('reader-control', true, 'reader-control', 'reader-body');
    next.focusState = ReaderUiReducer.focus('reader-control', 'reader-body');
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.readerControlShow,
      state.readerPresentationRoute,
      ReaderRoute.readerControl,
      ReaderRoute.readerControl,
      'presentation-replace',
      state.motion.sequence + 1,
      ReaderMotion.durationReaderControl(state.reducedMotion),
      ReaderMotionId.appRouteReplace
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static hideReaderControls(state: ReaderUiState): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    next.readerPresentationRoute = ReaderRoute.immersiveReading;
    next.overlay = new ReaderOverlayState();
    next.focusState = ReaderUiReducer.focus('reader-body', 'reader-control');
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.readerControlHide,
      state.readerPresentationRoute,
      ReaderRoute.immersiveReading,
      ReaderRoute.immersiveReading,
      'presentation-replace',
      state.motion.sequence + 1,
      ReaderMotion.durationReaderControl(state.reducedMotion),
      ReaderMotionId.appRouteReplace
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static toggleReaderControls(state: ReaderUiState): ReaderUiState {
    if (state.readerPresentationRoute !== ReaderRoute.immersiveReading ||
      state.overlayState.isOpen && state.overlayState.kind === 'reader-control') {
      return ReaderUiReducer.hideReaderControls(state);
    }
    return ReaderUiReducer.showReaderControls(state);
  }

  static replaceReaderPresentation(state: ReaderUiState, route: string): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    next.readerPresentationRoute = route;
    if (route === ReaderRoute.immersiveReading) {
      next.overlay = new ReaderOverlayState();
      next.focusState = ReaderUiReducer.focus('reader-body', 'reader-control');
    } else {
      next.overlay = ReaderUiReducer.overlay('reader-control', true, route, 'reader-body');
      next.focusState = ReaderUiReducer.focus(route, 'reader-body');
    }
    next.motion = ReaderUiReducer.motion(
      ReaderUiReducer.readerPresentationMotionId(route),
      state.readerPresentationRoute,
      route,
      route,
      'reader-presentation-replace',
      state.motion.sequence + 1,
      ReaderMotion.durationRoute(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static toggleReaderMore(state: ReaderUiState): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    const willOpen = !(state.overlayState.isOpen && state.overlayState.kind === 'reader-more');
    next.overlay = willOpen ?
      ReaderUiReducer.overlay('reader-more', true, 'reader-more', state.readerPresentationRoute) :
      ReaderUiReducer.overlay('reader-control', true, state.readerPresentationRoute, 'reader-body');
    next.focusState = willOpen ?
      ReaderUiReducer.focus('reader-more', state.readerPresentationRoute) :
      ReaderUiReducer.focus(state.readerPresentationRoute, 'reader-more');
    next.motion = ReaderUiReducer.motion(
      willOpen ? ReaderMotionId.motionInterruptRedirect : ReaderMotionId.motionInterruptCancel,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      willOpen ? 'reader-more-open' : 'reader-more-close',
      state.motion.sequence + 1,
      ReaderMotion.durationOverlay(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static closeReaderMore(state: ReaderUiState): ReaderUiState {
    if (!(state.overlayState.isOpen && state.overlayState.kind === 'reader-more')) {
      return state;
    }
    const next = ReaderUiReducer.clone(state);
    next.overlay = ReaderUiReducer.overlay('reader-control', true, state.readerPresentationRoute, 'reader-body');
    next.focusState = ReaderUiReducer.focus(state.readerPresentationRoute, 'reader-more');
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.motionInterruptCancel,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      'reader-more-close',
      state.motion.sequence + 1,
      ReaderMotion.durationOverlay(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static startReaderSession(state: ReaderUiState, kind: string): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    const previousKind = state.activeSession.kind;
    next.readerPresentationRoute = ReaderRoute.immersiveReading;
    next.overlay = new ReaderOverlayState();
    next.focusState = ReaderUiReducer.focus('reader-body', 'reader-control');
    next.activeSession = ReaderUiReducer.session(kind, true);
    next.motion = ReaderUiReducer.motion(
      kind === 'tts' ? ReaderMotionId.readerSessionTtsStart : ReaderMotionId.readerSessionAutoPageStart,
      state.readerPresentationRoute,
      ReaderRoute.immersiveReading,
      ReaderRoute.immersiveReading,
      'session-mutual-exclusive',
      state.motion.sequence + 1,
      ReaderMotion.durationReaderSession(state.reducedMotion),
      previousKind !== 'none' && previousKind !== kind ?
        ReaderMotionId.readerSessionCapsuleSwitch :
        ReaderMotionId.readerSessionCapsuleEnter
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static stopReaderSession(state: ReaderUiState): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    next.activeSession = new ReaderActiveSessionState();
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.readerSessionCapsuleExit,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      'session-stop',
      state.motion.sequence + 1,
      ReaderMotion.durationReaderSession(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static replaceRoute(state: ReaderUiState, route: string): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    const stack = state.routeStack.slice();
    if (stack.length === 0) {
      stack.push(route);
    } else {
      stack[stack.length - 1] = route;
    }
    next.route = route;
    next.routeStack = stack;
    next.activeTab = ReaderRoute.tabForRoute(route, state.activeTab);
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.appRouteReplace,
      state.route,
      route,
      route,
      'replace-current-route',
      state.motion.sequence + 1,
      ReaderMotion.durationRoute(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static popRoute(state: ReaderUiState): ReaderUiState {
    if (state.routeStack.length <= 1) {
      return state;
    }
    const next = ReaderUiReducer.clone(state);
    const stack = state.routeStack.slice(0, state.routeStack.length - 1);
    const targetRoute = stack[stack.length - 1];
    next.routeStack = stack;
    next.route = targetRoute;
    next.readerPresentationRoute = ReaderRoute.immersiveReading;
    next.activeTab = ReaderRoute.tabForRoute(targetRoute, state.activeTab);
    next.overlay = new ReaderOverlayState();
    next.activeSession = new ReaderActiveSessionState();
    next.focusState = ReaderUiReducer.focus('source-page', 'reader-body');
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.appRoutePop,
      state.route,
      targetRoute,
      targetRoute,
      'return-to-source',
      state.motion.sequence + 1,
      ReaderMotion.durationRoute(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  private static contextFromTarget(target: ReaderEntryTarget, sourceRoute: string): ReaderContext {
    const context = new ReaderContext();
    context.bookId = target.bookId;
    context.sourceId = target.sourceId;
    context.bookTitle = target.bookTitle;
    context.author = target.author;
    context.chapterTitle = target.chapterTitle;
    context.progressText = target.progressText;
    context.contentPreview = target.contentPreview;
    context.sourceRoute = sourceRoute;
    context.entryKind = target.entryKind;
    return context;
  }

  private static overlay(kind: string, isOpen: boolean, focusOwner: string, focusReturn: string): ReaderOverlayState {
    const overlay = new ReaderOverlayState();
    overlay.kind = kind;
    overlay.isOpen = isOpen;
    overlay.focusOwner = focusOwner;
    overlay.focusReturn = focusReturn;
    return overlay;
  }

  private static focus(owner: string, returnTo: string): ReaderFocusState {
    const focus = new ReaderFocusState();
    focus.owner = owner;
    focus.returnTo = returnTo;
    return focus;
  }

  private static session(kind: string, playing: boolean): ReaderActiveSessionState {
    const session = new ReaderActiveSessionState();
    session.kind = kind;
    session.playing = playing;
    session.capsuleVisible = kind !== 'none';
    if (kind === 'tts') {
      session.label = '朗读';
      session.statusText = playing ? '朗读中' : '已暂停';
    } else if (kind === 'autoPage') {
      session.label = '自动翻页';
      session.statusText = playing ? '运行中' : '已暂停';
    }
    return session;
  }

  private static asyncResult(requestId: number, status: string, targetRoute: string): ReaderAsyncResultState {
    const result = new ReaderAsyncResultState();
    result.requestId = requestId;
    result.status = status;
    result.targetRoute = targetRoute;
    return result;
  }

  private static motion(
    id: string,
    from: string,
    to: string,
    finalState: string,
    interruptPolicy: string,
    sequence: number,
    durationMs: number,
    appMotionId: string = ''
  ): ReaderMotionState {
    const motion = new ReaderMotionState();
    motion.activeMotionId = id;
    motion.appMotionId = appMotionId;
    motion.from = from;
    motion.to = to;
    motion.finalState = finalState;
    motion.interruptPolicy = interruptPolicy;
    motion.sequence = sequence;
    motion.durationMs = durationMs;
    return motion;
  }

  private static readerPresentationMotionId(route: string): string {
    if (route === ReaderRoute.readerControl || route === ReaderRoute.immersiveReading) {
      return ReaderMotionId.appRouteReplace;
    }
    if (ReaderRoute.isReaderFullRoute(route)) {
      return ReaderMotionId.readerPanelExpand;
    }
    if (ReaderRoute.isReaderQuickRoute(route)) {
      return ReaderMotionId.readerQuickPromote;
    }
    if (ReaderRoute.isReaderModuleRoute(route)) {
      return ReaderMotionId.readerModuleSwitch;
    }
    return ReaderMotionId.appRouteReplace;
  }

  private static clone(state: ReaderUiState): ReaderUiState {
    const next = new ReaderUiState();
    next.route = state.route;
    next.currentRoute = state.currentRoute;
    next.readerPresentationRoute = state.readerPresentationRoute;
    next.readerMode = state.readerMode;
    next.activeReaderModule = state.activeReaderModule;
    next.activeQuickPanel = state.activeQuickPanel;
    next.activeTab = state.activeTab;
    next.routeStack = state.routeStack.slice();
    next.backStack = state.backStack.slice();
    next.readerContext = state.readerContext;
    next.overlay = state.overlay;
    next.overlayState = state.overlayState;
    next.focusState = state.focusState;
    next.activeSession = state.activeSession;
    next.asyncResult = state.asyncResult;
    next.motion = state.motion;
    next.motionInterrupt = state.motionInterrupt;
    next.reducedMotion = state.reducedMotion;
    next.entryRequestId = state.entryRequestId;
    next.adaptive = state.adaptive;
    return next;
  }

  private static syncContractFields(state: ReaderUiState): ReaderUiState {
    state.currentRoute = state.route;
    state.backStack = state.routeStack.slice();
    state.overlayState = state.overlay;
    if (state.route !== ReaderRoute.immersiveReading) {
      state.readerPresentationRoute = ReaderRoute.immersiveReading;
    }
    state.readerMode = ReaderUiReducer.readerModeForPresentation(state.readerPresentationRoute);
    state.activeReaderModule = ReaderUiReducer.readerModuleForPresentation(state.readerPresentationRoute);
    state.activeQuickPanel = ReaderUiReducer.readerQuickPanelForPresentation(state.readerPresentationRoute);
    state.motionInterrupt = state.motion.interruptPolicy;
    return state;
  }

  private static readerModeForPresentation(route: string): string {
    if (route === ReaderRoute.immersiveReading) {
      return ReaderMode.immersive;
    }
    if (route === ReaderRoute.readerControl) {
      return ReaderMode.control;
    }
    if (ReaderRoute.isReaderModuleRoute(route)) {
      return ReaderMode.module;
    }
    if (ReaderRoute.isReaderQuickRoute(route)) {
      return ReaderMode.quick;
    }
    if (ReaderRoute.isReaderFullRoute(route)) {
      return ReaderMode.full;
    }
    if (route === ReaderRoute.readerBookCache || route === ReaderRoute.readerDebugInfo) {
      return ReaderMode.utility;
    }
    return ReaderMode.control;
  }

  private static readerModuleForPresentation(route: string): string {
    if (route === ReaderRoute.tocBookmarks || route === ReaderRoute.readerFullDirectory) {
      return ReaderModuleType.directory;
    }
    if (route === ReaderRoute.tts || route === ReaderRoute.readerFullTts) {
      return ReaderModuleType.tts;
    }
    if (route === ReaderRoute.readerAppearance || route === ReaderRoute.readerFullAppearance) {
      return ReaderModuleType.appearance;
    }
    if (route === ReaderRoute.readerSettings || route === ReaderRoute.readerFullSettings) {
      return ReaderModuleType.settings;
    }
    return ReaderModuleType.none;
  }

  private static readerQuickPanelForPresentation(route: string): string {
    if (route === ReaderRoute.contentSearch) {
      return ReaderQuickPanelType.search;
    }
    if (route === ReaderRoute.autoPage) {
      return ReaderQuickPanelType.autoPage;
    }
    if (route === ReaderRoute.contentReplacement) {
      return ReaderQuickPanelType.replace;
    }
    return ReaderQuickPanelType.none;
  }
}
