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
  pageLabel: string = '';
  totalChapters: number = 128;
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
  pageLabel: string = '';
  totalChapters: number = 128;
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
  controlSpaceVisible: boolean = false;
  countdown: number = 0;
  motionKey: string = 'inactive';
  label: string = '';
  statusText: string = '';
}

export class ReaderTypographyState {
  fontSize: number = 18;
  lineHeightRatio: number = 1.96;
  paragraphGap: number = 16;
  letterSpacing: number = 0;
  fontFamily: string = 'serif';
}

export class ReaderPageSpaceState {
  topMargin: number = 72;
  sideMargin: number = 32;
  paragraphIndent: number = 2;
  texture: string = 'paper';
}

export class ReaderBrightnessState {
  value: number = 100;
  auto: boolean = false;
}

export class ReaderThemeState {
  value: string = 'paper';
  scheme: string = 'day';
  paperStart: string = '#FBF4E9';
  paperEnd: string = '#EFE2D0';
  ink: string = '#2B241D';
  controlSurface: string = '#FFFAF4';
  controlPanel: string = '#FFFCF8';
  controlLine: string = '#D6CABC';
  action: string = '#2F6373';
}

export class ReaderSettingsState {
  autoPage: boolean = false;
  volumePage: boolean = true;
  pageAnimation: string = '平滑';
  keepScreenOn: boolean = true;
  statusInfo: boolean = true;
  hapticFeedback: boolean = false;
  cacheNext: boolean = true;
  tapMode: string = '左右区域';
  landscapeLock: boolean = false;
}

export class ReaderTtsState {
  playing: boolean = false;
  speed: string = '1.0x';
  voice: string = '清晰女声';
  scope: string = '当前章节';
  timer: string = '15 分钟';
  sentenceIndex: number = 1;
}

export class ReaderPaginationState {
  pageIndex: number = 0;
  pageCount: number = 1;
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
  bookshelfView: string = 'cover';
  bookshelfGroup: string = '全部';
  bookshelfSort: string = '最近更新';
  bookshelfFilter: string = '全部';
  bookshelfFilterOpen: boolean = false;
  routeStack: string[] = [ReaderRoute.bookshelf];
  backStack: string[] = [ReaderRoute.bookshelf];
  readerContext: ReaderContext = new ReaderContext();
  overlay: ReaderOverlayState = new ReaderOverlayState();
  overlayState: ReaderOverlayState = new ReaderOverlayState();
  focusState: ReaderFocusState = new ReaderFocusState();
  activeSession: ReaderActiveSessionState = new ReaderActiveSessionState();
  readerTheme: ReaderThemeState = new ReaderThemeState();
  readerTypography: ReaderTypographyState = new ReaderTypographyState();
  readerPageSpace: ReaderPageSpaceState = new ReaderPageSpaceState();
  readerBrightness: ReaderBrightnessState = new ReaderBrightnessState();
  readerSettings: ReaderSettingsState = new ReaderSettingsState();
  readerTts: ReaderTtsState = new ReaderTtsState();
  readerPagination: ReaderPaginationState = new ReaderPaginationState();
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

  static setReaderBrightness(state: ReaderUiState, value: number): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    next.readerBrightness.value = ReaderUiReducer.clamp(value, 0, 100);
    next.readerBrightness.auto = false;
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.readerBrightnessUpdate,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      'brightness-update',
      state.motion.sequence + 1,
      ReaderMotion.durationOverlay(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static adjustReaderBrightness(state: ReaderUiState, delta: number): ReaderUiState {
    return ReaderUiReducer.setReaderBrightness(state, state.readerBrightness.value + delta);
  }

  static toggleReaderBrightnessAuto(state: ReaderUiState): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    next.readerBrightness.auto = !state.readerBrightness.auto;
    if (next.readerBrightness.auto) {
      next.readerBrightness.value = 100;
    }
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.readerBrightnessAutoToggle,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      'brightness-auto-toggle',
      state.motion.sequence + 1,
      ReaderMotion.durationOverlay(state.reducedMotion)
    );
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
    next.bookshelfFilterOpen = false;
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
    next.bookshelfFilterOpen = false;
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

  static toggleBookshelfMore(state: ReaderUiState): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    const willOpen = !(state.overlayState.isOpen && state.overlayState.kind === 'bookshelf-more');
    next.overlay = willOpen ?
      ReaderUiReducer.overlay('bookshelf-more', true, 'bookshelf-more-menu', 'bookshelf-more-button') :
      new ReaderOverlayState();
    next.bookshelfFilterOpen = false;
    next.focusState = willOpen ?
      ReaderUiReducer.focus('bookshelf-more-menu', 'bookshelf-more-button') :
      ReaderUiReducer.focus('bookshelf-more-button', 'bookshelf-more-menu');
    next.motion = ReaderUiReducer.motion(
      willOpen ? ReaderMotionId.dropdownMenuExpand : ReaderMotionId.dropdownMenuCollapse,
      state.route,
      state.route,
      state.route,
      willOpen ? 'bookshelf-more-open' : 'bookshelf-more-close',
      state.motion.sequence + 1,
      ReaderMotion.durationOverlay(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static closeBookshelfMore(state: ReaderUiState): ReaderUiState {
    if (!(state.overlayState.isOpen && state.overlayState.kind === 'bookshelf-more')) {
      return state;
    }
    const next = ReaderUiReducer.clone(state);
    next.overlay = new ReaderOverlayState();
    next.focusState = ReaderUiReducer.focus('bookshelf-more-button', 'bookshelf-more-menu');
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.dropdownMenuCollapse,
      state.route,
      state.route,
      state.route,
      'bookshelf-more-close',
      state.motion.sequence + 1,
      ReaderMotion.durationOverlay(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static setBookshelfView(state: ReaderUiState, view: string): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    const nextView = view === 'list' ? 'list' : 'cover';
    next.bookshelfView = nextView;
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.bookshelfViewSwitch,
      state.bookshelfView,
      nextView,
      nextView,
      'bookshelf-view-switch',
      state.motion.sequence + 1,
      ReaderMotion.durationTabSwitch(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static toggleBookshelfFilter(state: ReaderUiState): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    const willOpen = !(state.overlayState.isOpen && state.overlayState.kind === 'bookshelf-filter');
    next.bookshelfFilterOpen = willOpen;
    next.overlay = willOpen ?
      ReaderUiReducer.overlay('bookshelf-filter', true, 'bookshelf-filter-popover', 'bookshelf-filter-button') :
      new ReaderOverlayState();
    next.focusState = willOpen ?
      ReaderUiReducer.focus('bookshelf-filter-popover', 'bookshelf-filter-button') :
      ReaderUiReducer.focus('bookshelf-filter-button', 'bookshelf-filter-popover');
    next.motion = ReaderUiReducer.motion(
      willOpen ? ReaderMotionId.dropdownMenuExpand : ReaderMotionId.dropdownMenuCollapse,
      state.route,
      state.route,
      state.route,
      willOpen ? 'bookshelf-filter-open' : 'bookshelf-filter-close',
      state.motion.sequence + 1,
      ReaderMotion.durationOverlay(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static closeBookshelfFilter(state: ReaderUiState): ReaderUiState {
    if (!(state.overlayState.isOpen && state.overlayState.kind === 'bookshelf-filter')) {
      return state;
    }
    const next = ReaderUiReducer.clone(state);
    next.bookshelfFilterOpen = false;
    next.overlay = new ReaderOverlayState();
    next.focusState = ReaderUiReducer.focus('bookshelf-filter-button', 'bookshelf-filter-popover');
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.dropdownMenuCollapse,
      state.route,
      state.route,
      state.route,
      'bookshelf-filter-close',
      state.motion.sequence + 1,
      ReaderMotion.durationOverlay(state.reducedMotion)
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static setBookshelfFilterOption(state: ReaderUiState, kind: string, value: string): ReaderUiState {
    const next = ReaderUiReducer.clone(state);
    if (kind === 'group') {
      next.bookshelfGroup = value;
    } else if (kind === 'sort') {
      next.bookshelfSort = value;
    } else if (kind === 'filter') {
      next.bookshelfFilter = value;
    }
    next.bookshelfFilterOpen = true;
    next.overlay = ReaderUiReducer.overlay('bookshelf-filter', true, 'bookshelf-filter-popover', 'bookshelf-filter-button');
    next.focusState = ReaderUiReducer.focus('bookshelf-filter-popover', 'bookshelf-filter-button');
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.dropdownOptionSelect,
      state.route,
      state.route,
      state.route,
      `bookshelf-filter-${kind}`,
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
    next.readerSettings.autoPage = kind === 'autoPage';
    next.readerTts.playing = kind === 'tts';
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

  static toggleReaderSessionPlaying(state: ReaderUiState): ReaderUiState {
    if (state.activeSession.kind === 'none') {
      return state;
    }
    const next = ReaderUiReducer.clone(state);
    next.activeSession = ReaderUiReducer.session(state.activeSession.kind, !state.activeSession.playing, state.activeSession.countdown);
    next.readerSettings.autoPage = next.activeSession.kind === 'autoPage' && next.activeSession.playing;
    next.readerTts.playing = next.activeSession.kind === 'tts' && next.activeSession.playing;
    next.motion = ReaderUiReducer.motion(
      ReaderMotionId.readerSessionCapsuleUpdate,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      state.readerPresentationRoute,
      'session-toggle',
      state.motion.sequence + 1,
      ReaderMotion.durationReaderSession(state.reducedMotion),
      ReaderMotionId.readerSessionControlSpaceUpdate
    );
    return ReaderUiReducer.syncContractFields(next);
  }

  static stopReaderSession(state: ReaderUiState): ReaderUiState {
    if (state.activeSession.kind === 'none') {
      return state;
    }
    const next = ReaderUiReducer.clone(state);
    next.activeSession = new ReaderActiveSessionState();
    next.readerSettings.autoPage = false;
    next.readerTts.playing = false;
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
    context.pageLabel = target.pageLabel;
    context.totalChapters = target.totalChapters;
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

  private static session(kind: string, playing: boolean, countdown: number = -1): ReaderActiveSessionState {
    const session = new ReaderActiveSessionState();
    session.kind = kind;
    session.playing = playing;
    session.capsuleVisible = kind !== 'none';
    if (kind === 'tts') {
      session.label = '朗读';
      session.statusText = playing ? '朗读中' : '已暂停';
      session.countdown = 0;
      session.motionKey = playing ? 'tts-playing' : 'tts-paused';
    } else if (kind === 'autoPage') {
      session.label = '自动翻页';
      session.statusText = playing ? '运行中' : '已暂停';
      session.countdown = countdown >= 0 ? countdown : 8;
      session.motionKey = playing ? 'auto-page-running' : 'auto-page-paused';
    }
    return session;
  }

  private static clamp(value: number, min: number, max: number): number {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
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
    next.bookshelfView = state.bookshelfView;
    next.bookshelfGroup = state.bookshelfGroup;
    next.bookshelfSort = state.bookshelfSort;
    next.bookshelfFilter = state.bookshelfFilter;
    next.bookshelfFilterOpen = state.bookshelfFilterOpen;
    next.routeStack = state.routeStack.slice();
    next.backStack = state.backStack.slice();
    next.readerContext = ReaderUiReducer.cloneReaderContext(state.readerContext);
    next.overlay = ReaderUiReducer.cloneOverlay(state.overlay);
    next.overlayState = ReaderUiReducer.cloneOverlay(state.overlayState);
    next.focusState = ReaderUiReducer.cloneFocus(state.focusState);
    next.activeSession = ReaderUiReducer.cloneSession(state.activeSession);
    next.readerTheme = ReaderUiReducer.cloneTheme(state.readerTheme);
    next.readerTypography = ReaderUiReducer.cloneTypography(state.readerTypography);
    next.readerPageSpace = ReaderUiReducer.clonePageSpace(state.readerPageSpace);
    next.readerBrightness = ReaderUiReducer.cloneBrightness(state.readerBrightness);
    next.readerSettings = ReaderUiReducer.cloneSettings(state.readerSettings);
    next.readerTts = ReaderUiReducer.cloneTts(state.readerTts);
    next.readerPagination = ReaderUiReducer.clonePagination(state.readerPagination);
    next.asyncResult = ReaderUiReducer.cloneAsyncResult(state.asyncResult);
    next.motion = ReaderUiReducer.cloneMotion(state.motion);
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
    ReaderUiReducer.syncSessionControlSpace(state);
    state.motionInterrupt = state.motion.interruptPolicy;
    return state;
  }

  private static syncSessionControlSpace(state: ReaderUiState): void {
    const mode = state.readerMode;
    const controlVisible = state.activeSession.kind !== 'none' && (
      mode === ReaderMode.control ||
        mode === ReaderMode.module ||
        mode === ReaderMode.quick ||
        mode === ReaderMode.loading
    );
    state.activeSession.controlSpaceVisible = controlVisible;
    state.activeSession.capsuleVisible = state.activeSession.kind !== 'none' && !controlVisible;
  }

  private static cloneReaderContext(context: ReaderContext): ReaderContext {
    const next = new ReaderContext();
    next.bookId = context.bookId;
    next.sourceId = context.sourceId;
    next.bookTitle = context.bookTitle;
    next.author = context.author;
    next.chapterTitle = context.chapterTitle;
    next.progressText = context.progressText;
    next.pageLabel = context.pageLabel;
    next.totalChapters = context.totalChapters;
    next.contentPreview = context.contentPreview;
    next.sourceRoute = context.sourceRoute;
    next.entryKind = context.entryKind;
    return next;
  }

  private static cloneOverlay(overlay: ReaderOverlayState): ReaderOverlayState {
    const next = new ReaderOverlayState();
    next.kind = overlay.kind;
    next.isOpen = overlay.isOpen;
    next.focusOwner = overlay.focusOwner;
    next.focusReturn = overlay.focusReturn;
    return next;
  }

  private static cloneFocus(focus: ReaderFocusState): ReaderFocusState {
    const next = new ReaderFocusState();
    next.owner = focus.owner;
    next.returnTo = focus.returnTo;
    return next;
  }

  private static cloneSession(session: ReaderActiveSessionState): ReaderActiveSessionState {
    const next = new ReaderActiveSessionState();
    next.kind = session.kind;
    next.playing = session.playing;
    next.capsuleVisible = session.capsuleVisible;
    next.controlSpaceVisible = session.controlSpaceVisible;
    next.countdown = session.countdown;
    next.motionKey = session.motionKey;
    next.label = session.label;
    next.statusText = session.statusText;
    return next;
  }

  private static cloneTheme(theme: ReaderThemeState): ReaderThemeState {
    const next = new ReaderThemeState();
    next.value = theme.value;
    next.scheme = theme.scheme;
    next.paperStart = theme.paperStart;
    next.paperEnd = theme.paperEnd;
    next.ink = theme.ink;
    next.controlSurface = theme.controlSurface;
    next.controlPanel = theme.controlPanel;
    next.controlLine = theme.controlLine;
    next.action = theme.action;
    return next;
  }

  private static cloneTypography(typography: ReaderTypographyState): ReaderTypographyState {
    const next = new ReaderTypographyState();
    next.fontSize = typography.fontSize;
    next.lineHeightRatio = typography.lineHeightRatio;
    next.paragraphGap = typography.paragraphGap;
    next.letterSpacing = typography.letterSpacing;
    next.fontFamily = typography.fontFamily;
    return next;
  }

  private static clonePageSpace(pageSpace: ReaderPageSpaceState): ReaderPageSpaceState {
    const next = new ReaderPageSpaceState();
    next.topMargin = pageSpace.topMargin;
    next.sideMargin = pageSpace.sideMargin;
    next.paragraphIndent = pageSpace.paragraphIndent;
    next.texture = pageSpace.texture;
    return next;
  }

  private static cloneBrightness(brightness: ReaderBrightnessState): ReaderBrightnessState {
    const next = new ReaderBrightnessState();
    next.value = brightness.value;
    next.auto = brightness.auto;
    return next;
  }

  private static cloneSettings(settings: ReaderSettingsState): ReaderSettingsState {
    const next = new ReaderSettingsState();
    next.autoPage = settings.autoPage;
    next.volumePage = settings.volumePage;
    next.pageAnimation = settings.pageAnimation;
    next.keepScreenOn = settings.keepScreenOn;
    next.statusInfo = settings.statusInfo;
    next.hapticFeedback = settings.hapticFeedback;
    next.cacheNext = settings.cacheNext;
    next.tapMode = settings.tapMode;
    next.landscapeLock = settings.landscapeLock;
    return next;
  }

  private static cloneTts(tts: ReaderTtsState): ReaderTtsState {
    const next = new ReaderTtsState();
    next.playing = tts.playing;
    next.speed = tts.speed;
    next.voice = tts.voice;
    next.scope = tts.scope;
    next.timer = tts.timer;
    next.sentenceIndex = tts.sentenceIndex;
    return next;
  }

  private static clonePagination(pagination: ReaderPaginationState): ReaderPaginationState {
    const next = new ReaderPaginationState();
    next.pageIndex = pagination.pageIndex;
    next.pageCount = pagination.pageCount;
    return next;
  }

  private static cloneAsyncResult(result: ReaderAsyncResultState): ReaderAsyncResultState {
    const next = new ReaderAsyncResultState();
    next.requestId = result.requestId;
    next.status = result.status;
    next.targetRoute = result.targetRoute;
    return next;
  }

  private static cloneMotion(motion: ReaderMotionState): ReaderMotionState {
    const next = new ReaderMotionState();
    next.activeMotionId = motion.activeMotionId;
    next.appMotionId = motion.appMotionId;
    next.from = motion.from;
    next.to = motion.to;
    next.finalState = motion.finalState;
    next.interruptPolicy = motion.interruptPolicy;
    next.sequence = motion.sequence;
    next.durationMs = motion.durationMs;
    return next;
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
