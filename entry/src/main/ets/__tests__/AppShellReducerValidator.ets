import { MotionAdapter } from '../ui/adapters/MotionAdapter';
import { TokenAdapter } from '../ui/adapters/TokenAdapter';
import { ReaderMotionId } from '../ui/ReaderMotion';
import { AppShellStateFlow } from '../ui/shells/AppShellStateFlow';
import { ReaderMainTab, ReaderReducer, ReaderRoute } from '../ui/store/ReaderReducer';
import { ReaderUiStore } from '../ui/store/ReaderUiStore';

interface TestResult { name: string; passed: boolean; error?: string; }

export const APP_SHELL_REDUCER_VALIDATOR_COVERAGE: string[] = [
  'four-native-tabs',
  'tab-route-stack',
  'reduced-motion',
  'page-state-loading',
  'token-adapter-registry',
  'motion-adapter-registry',
  'overlay-mutex',
  'focus-restore',
  'active-session-mutex',
  'async-latest-intent-loading-guard'
];

export interface AppShellReducerValidatorManifest {
  suite: string;
  coverage: string[];
  headlessRuntimeFlag: string;
  runtimeLogMarker: string;
}

export function appShellReducerValidatorManifest(): AppShellReducerValidatorManifest {
  return {
    suite: 'Frontend Slice 0/1 AppShell Reducer',
    coverage: APP_SHELL_REDUCER_VALIDATOR_COVERAGE.slice(),
    headlessRuntimeFlag: 'readerHeadlessTest',
    runtimeLogMarker: 'HEADLESS_TEST_JSON'
  };
}

class TestRunner {
  results: TestResult[] = [];
  passed: number = 0;
  failed: number = 0;

  assert(condition: boolean, name: string, error?: string): void {
    this.results.push({ name, passed: condition, error: condition ? undefined : error });
    if (condition) {
      this.passed++;
    } else {
      this.failed++;
    }
  }
}

export function runAppShellReducerTests(): TestRunner {
  const r = new TestRunner();
  const store = new ReaderUiStore();

  const initial = store.snapshot();
  r.assert(initial.route.id === ReaderRoute.bookshelf, 'Slice 1 starts on bookshelf route');
  r.assert(AppShellStateFlow.hasFourNativeTabs(initial), 'AppShell exposes four native tabs');

  const discover = store.selectTab(ReaderMainTab.discover);
  r.assert(discover.activeTab === ReaderMainTab.discover, 'Reducer selects discover tab');
  r.assert(discover.route.id === ReaderRoute.discover, 'Reducer maps discover tab to discover route');
  r.assert(discover.routeStack.length === 1 && discover.routeStack[0] === ReaderRoute.discover, 'Tab switch does not push page route stack');
  r.assert(discover.tab === ReaderMainTab.discover, 'Contract tab mirrors activeTab');
  r.assert(discover.motionState.activeMotionId === ReaderMotionId.tabSwitch, 'Tab switch uses contract tab.switch motion');

  const reduced = store.setReducedMotion(true);
  r.assert(MotionAdapter.tabSwitch(reduced.reducedMotion).durationMs === 0, 'MotionAdapter honors reduced motion for tab switch');

  const loading = ReaderReducer.setPageState(reduced, 'loading');
  r.assert(loading.loading, 'Reducer exposes loading state layer');
  r.assert(loading.pageState === 'loading', 'Reducer records loading pageState');

  const snapshot = AppShellStateFlow.snapshot(discover);
  r.assert(snapshot.tabs.length === 4, 'AppShell snapshot keeps four tabs');
  r.assert(snapshot.activeTab === ReaderMainTab.discover, 'AppShell snapshot follows active tab');
  r.assert(snapshot.bottomNavHeight === TokenAdapter.tabBarHeight(), 'AppShell consumes TokenAdapter bottom nav height');
  r.assert(TokenAdapter.coverageCount() >= 100, 'TokenAdapter covers generated token registry');
  r.assert(MotionAdapter.p0MotionIds().indexOf(ReaderMotionId.tabSwitch) >= 0, 'MotionAdapter exposes Slice 1 tab.switch P0 mapping');

  const overlayStore = new ReaderUiStore();
  const appearance = overlayStore.openOverlay('appearance', 'reader.control.appearance');
  r.assert(appearance.overlay === 'appearance', 'Reducer opens a single contract overlay');
  r.assert(appearance.overlayState.kind === 'appearance' && appearance.overlayState.isOpen, 'Reducer mirrors overlayState for ArkUI overlay rendering');
  r.assert(appearance.focusTarget === 'appearance', 'Overlay open moves focus to overlay owner');
  r.assert(appearance.overlayState.focusReturn === 'reader.control.appearance', 'Overlay records focus return trigger');

  const searchOverlay = overlayStore.openOverlay('content-search', 'reader.control.search');
  r.assert(searchOverlay.overlay === 'content-search', 'Overlay mutex replaces previous overlay with latest overlay');
  r.assert(searchOverlay.overlayState.kind === 'content-search', 'Overlay mutex leaves only the latest overlay open');
  r.assert(searchOverlay.motionState.appMotionId === ReaderMotionId.motionInterruptCompleteThenReplace, 'Overlay mutex uses completeThenReplace interrupt');
  r.assert(searchOverlay.focusTarget === 'content-search', 'Overlay mutex moves focus to latest overlay');

  const restoredFocus = overlayStore.closeOverlay();
  r.assert(restoredFocus.overlay === undefined, 'Overlay close clears contract overlay');
  r.assert(restoredFocus.overlayState.isOpen === false, 'Overlay close clears ArkUI overlay state');
  r.assert(restoredFocus.focusTarget === 'reader.control.search', 'Overlay close restores focus to trigger');
  r.assert(restoredFocus.motionState.activeMotionId === ReaderMotionId.overlaySheetExit, 'Overlay close uses overlay exit motion');

  const sessionStore = new ReaderUiStore();
  const ttsSession = sessionStore.startSession('tts');
  r.assert(ttsSession.activeSession === 'tts', 'Reducer starts TTS activeSession');
  r.assert(ttsSession.activeSessionState.kind === 'tts' && ttsSession.readerTts.playing, 'TTS session marks local ArkUI session state playing');
  r.assert(ttsSession.activeSessionState.capsuleVisible, 'TTS session exposes capsule when control layer is hidden');

  const autoPageSession = sessionStore.startSession('auto-page');
  r.assert(autoPageSession.activeSession === 'auto-page', 'Reducer normalizes auto-page contract activeSession');
  r.assert(autoPageSession.activeSessionState.kind === 'autoPage', 'Reducer keeps ArkUI legacy autoPage session key for existing controls');
  r.assert(autoPageSession.readerSettings.autoPage && !autoPageSession.readerTts.playing, 'activeSession mutex stops TTS when auto-page starts');
  r.assert(autoPageSession.motionState.appMotionId === ReaderMotionId.readerSessionCapsuleSwitch, 'activeSession mutex records capsule switch motion');

  const stoppedSession = sessionStore.stopSession();
  r.assert(stoppedSession.activeSession === undefined, 'Reducer stopSession clears contract activeSession');
  r.assert(stoppedSession.activeSessionState.kind === 'none', 'Reducer stopSession clears local session state');

  const asyncStore = new ReaderUiStore();
  const requestOne = asyncStore.beginAsyncIntent(1, ReaderRoute.discover);
  r.assert(requestOne.loading && requestOne.pageState === 'loading', 'Async begin exposes loading guard');
  r.assert(requestOne.asyncResult.requestId === 1 && requestOne.asyncResult.targetRoute === ReaderRoute.discover, 'Async begin records request scope');
  r.assert(requestOne.motionState.activeMotionId === ReaderMotionId.stateLoadingInline, 'Async begin uses inline loading motion');

  const requestTwo = asyncStore.beginAsyncIntent(2, ReaderRoute.settings);
  const staleComplete = asyncStore.completeAsyncIntent(1, ReaderRoute.discover);
  r.assert(staleComplete.asyncResult.requestId === 2, 'Async stale completion is discarded by requestId');
  r.assert(staleComplete.loading, 'Async stale completion keeps latest loading guard active');
  r.assert(staleComplete.route.id !== ReaderRoute.discover, 'Async stale completion does not replace route');

  const latestComplete = asyncStore.completeAsyncIntent(2, ReaderRoute.settings);
  r.assert(latestComplete.asyncResult.status === 'completed', 'Async latest completion records completed status');
  r.assert(latestComplete.loading === false && latestComplete.pageState === 'default', 'Async latest completion clears loading guard');
  r.assert(latestComplete.route.id === ReaderRoute.settings, 'Async latest completion applies latest target route');
  r.assert(requestTwo.asyncResult.requestId === 2, 'Async latest intent supersedes prior request');

  r.assert(MotionAdapter.p0MotionIds().indexOf(ReaderMotionId.overlaySheetEnter) >= 0, 'MotionAdapter exposes overlay.sheet.enter P0 mapping');
  r.assert(MotionAdapter.p0MotionIds().indexOf(ReaderMotionId.readerSessionTtsStart) >= 0, 'MotionAdapter exposes reader.session.tts.start P0 mapping');
  r.assert(MotionAdapter.resolve(ReaderMotionId.overlaySheetEnter, true).durationMs === 0, 'MotionAdapter honors reduced motion for overlay entry');

  const tabSwitchSpec = MotionAdapter.generatedSpec(ReaderMotionId.tabSwitch);
  r.assert(tabSwitchSpec !== undefined, 'Generated motionSpecRegistry exposes tab.switch');
  r.assert(tabSwitchSpec?.durationMs === 160, 'MotionAdapter reads tab.switch duration from generated motionSpecRegistry');
  r.assert(tabSwitchSpec?.tokens?.durationToken === 'app.motion.duration.tabSwitch', 'Generated tab.switch spec keeps duration token reference');
  r.assert(MotionAdapter.tabSwitch(false).durationMs === tabSwitchSpec?.durationMs, 'MotionAdapter tab.switch duration matches generated registry');

  const tabSwitchToken = TokenAdapter.generatedToken('--reader-ds-motion-duration-tabSwitch');
  r.assert(tabSwitchToken !== undefined, 'Generated tokenRegistry exposes tabSwitch motion-duration token');
  r.assert(tabSwitchToken?.category === 'motion-duration', 'Generated tabSwitch token is a motion-duration token');
  r.assert(TokenAdapter.motionDuration('--reader-ds-motion-duration-tabSwitch', false) === 160, 'TokenAdapter resolves generated motion-duration token value');

  return r;
}
