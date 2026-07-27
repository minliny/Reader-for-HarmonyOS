// ReaderUIRuntimeShadowCoordinator — production-path Reader-UI rollout seam.
// Seven covered events are Pilot-owned: directory, book.open, TTS, and
// auto-page. Import, source switch, replace rules, RSS, the page pair, and Sync
// stay read-only Shadow; their effect executors remain available only through
// explicit test switches.
import {
  GENERATED_RUNTIME_ACTIONS,
  ReaderUIAsyncTransition,
  ReaderUIBookOpenLayout,
  ReaderUIEffect,
  ReaderUIJSONPayload,
  ReaderUIJSONResult,
  ReaderUIPageLayout,
  ReaderUIPlaybackTransition,
  ReaderUIRuntime,
  ReaderUIState,
  ReaderUITransition,
} from 'reader_ui_runtime';
import { ReaderUiState, UiEvent, isLocalBookSourceId } from './ReaderUiState';
import { isReaderModuleOverlayRoute } from './ReaderDirectoryPilotProjection';
import {
  ReaderBookOpenCoreGateway,
  ReaderBookOpenEffectExecutor,
  ReaderBookOpenPilotHost,
  ReaderBookOpenPilotSnapshot,
  ReaderBookOpenRuntimeGateway,
} from './ReaderBookOpenPilot';
import {
  ReaderPlaybackCoreGateway,
  ReaderPlaybackEffectExecutor,
  ReaderPlaybackPilotHost,
  ReaderPlaybackPilotKind,
  ReaderPlaybackPilotSnapshot,
  ReaderPlaybackPlatformGateway,
  ReaderPlaybackRuntimeGateway,
} from './ReaderPlaybackPilot';
import {
  ReaderImportCoreGateway,
  ReaderImportEffectExecutor,
  ReaderImportPilotHost,
  ReaderImportPilotSnapshot,
  ReaderImportRuntimeGateway,
} from './ReaderImportPilotExecutor';
import {
  ReaderSourceSwitchCoreGateway,
  ReaderSourceSwitchEffectExecutor,
  ReaderSourceSwitchPilotHost,
  ReaderSourceSwitchPilotSnapshot,
  ReaderSourceSwitchRuntimeGateway,
} from './ReaderSourceSwitchPilotExecutor';
import {
  ReaderReplaceRuleCoreGateway,
  ReaderReplaceRuleEffectExecutor,
  ReaderReplaceRulePilotHost,
  ReaderReplaceRulePilotSnapshot,
  ReaderReplaceRuleRuntimeGateway,
} from './ReaderReplaceRulePilotExecutor';
import {
  ReaderRssEffectExecutor,
  ReaderRssPilotEffectExecutor,
  ReaderRssPilotHost,
  ReaderRssPilotSnapshot,
  ReaderRssPilotRuntimeGateway,
} from './ReaderRssPilotExecutor';
import {
  ReaderSyncEffectExecutor,
  ReaderSyncExperimentalGateway,
  ReaderSyncPilotHost,
  ReaderSyncPilotSnapshot,
  ReaderSyncPilotRuntimeGateway,
} from './ReaderSyncPilotExecutor';

// This is a rollout allowlist, not an action table. The consumer gate verifies
// exact ordered equality with READER_UI_CONSUMER.json. Action semantics always
// come from GENERATED_RUNTIME_ACTIONS through ReaderUIRuntime.dispatch().
export const READER_UI_SHADOW_COVERED_EVENTS: string[] = [
  'book.open',
  'reader.directory.open',
  'reader.directory.close',
  'reader.page.next',
  'reader.page.prev',
  'reader.tts.start',
  'reader.tts.stop',
  'reader.autoPage.start',
  'reader.autoPage.stop',
  'import.start',
  'import.apply',
  'import.cancel',
  'source.switch.open',
  'source.switch.cancel',
  'source.switch.confirm',
  'source.switch.rollback',
  'reader.sourceSwitch.open',
  'reader.sourceSwitch.close',
  'reader.replace.apply',
  'reader.replace.create',
  'reader.replace.validate',
  'rss.refresh',
  'rss.subscription.add',
  'rss.subscription.delete',
  'rss.subscription.edit',
  'rss.entry.open',
  'rss.favorite.add',
  'rss.favorite.remove',
  'sync.run',
  'webdav.config.test',
  'sync.start',
  'sync.progress',
  'sync.complete',
  'sync.conflict',
  'sync.resolve',
];

const DIRECTORY_OVERLAY_ROUTE: string = 'reader-directory-overlay-v2';

export interface ReaderUIRuntimeShadowMetrics {
  covered: number;
  fallback: number;
  pilot: number;
  pilotFailure: number;
  pilotStateChanges: number;
  runtimeError: number;
  mismatch: number;
  observedEffects: number;
  // Count of book.open transactions whose first one-step runtime effect was
  // admitted by the executor. This is deliberately distinct from the exact
  // Core effect count below.
  admittedTransactions: number;
  // Exact number of Core effects owned by the book.open executor. Shadow
  // observations never contribute to this counter.
  executedEffects: number;
  resync: number;
  lastEvent: string;
  lastCanonicalEvent: string;
  lastRuntimeError: string;
  lastMismatch: string;
}

export interface ReaderUIRuntimeShadowSnapshot {
  runtimeState: ReaderUIState;
  metrics: ReaderUIRuntimeShadowMetrics;
  lastEffectTypes: string[];
}

// ArkTS intentionally does not use TypeScript's structural interfaces for
// class assignment.  Keep the injection seam nominal so both the generated
// ReaderUIRuntime and test doubles cross this boundary through one explicit
// adapter rather than assigning an imported class to an interface.
export abstract class ReaderUIRuntimeDriver {
  abstract get state(): ReaderUIState;
  abstract dispatch(event: string, payload?: ReaderUIJSONPayload, correlationId?: string): ReaderUITransition;

  // Book.open is Pilot in production. Minimal test drivers that exercise only
  // other cohorts do not have to implement the serial transaction API.
  acceptBookOpenResult(_coreType: string, _correlationId: string, _chapterCount?: number,
    _error?: string): ReaderUIAsyncTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement book.open results');
  }

  acceptBookOpenJSONResult(_coreType: string, _correlationId: string,
    _result: ReaderUIJSONResult): ReaderUIAsyncTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement typed book.open results');
  }

  provideBookOpenLayout(_correlationId: string, _layout: ReaderUIBookOpenLayout): ReaderUIAsyncTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement book.open layout');
  }

  cancelBookOpen(_correlationId: string): ReaderUIAsyncTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement book.open cancellation');
  }

  providePageLayout(_correlationId: string, _layout: ReaderUIPageLayout): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement page layout');
  }

  acceptPageLocationResult(_correlationId: string, _canonicalLocation?: string,
    _pageIndex?: number, _error?: string): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement page location results');
  }

  acceptPageLocationJSONResult(_correlationId: string,
    _result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement typed page location results');
  }

  acceptPageProgressResult(_correlationId: string, _stored?: boolean,
    _error?: string): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement page progress results');
  }

  acceptPageProgressJSONResult(_correlationId: string,
    _result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement typed page progress results');
  }

  cancelPageStep(_correlationId: string): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement page cancellation');
  }

  acceptTTSCoreResult(_coreType: string, _correlationId: string,
    _error?: string): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement TTS Core results');
  }

  acceptTTSCoreJSONResult(_coreType: string, _correlationId: string,
    _result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement typed TTS Core results');
  }

  acceptTTSSystemStart(_correlationId: string, _error?: string): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement TTS Host results');
  }

  acceptTTSSystemStartJSONResult(_correlationId: string,
    _result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement typed TTS Host results');
  }

  stopTTS(_correlationId?: string): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement TTS stop');
  }

  acceptAutoPageTimerFired(_correlationId: string, _generation: number): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement auto-page timer');
  }

  stopAutoPage(_correlationId?: string): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement auto-page stop');
  }

  suspendAutoPageForBackground(_correlationId?: string): ReaderUIPlaybackTransition {
    throw new Error('ReaderUIRuntimeDriver does not implement auto-page background suspension');
  }

  completeAsync(_error?: string): ReaderUIState {
    throw new Error('ReaderUIRuntimeDriver does not implement async completion');
  }
}

class GeneratedReaderUIRuntimeDriver extends ReaderUIRuntimeDriver {
  private readonly runtime: ReaderUIRuntime;

  constructor(initialState: ReaderUIState) {
    super();
    this.runtime = new ReaderUIRuntime(initialState);
  }

  get state(): ReaderUIState {
    return this.runtime.state;
  }

  dispatch(event: string, payload?: ReaderUIJSONPayload, correlationId?: string): ReaderUITransition {
    return this.runtime.dispatch(event, payload, correlationId);
  }

  acceptBookOpenResult(coreType: string, correlationId: string, chapterCount?: number,
    error?: string): ReaderUIAsyncTransition {
    return this.runtime.acceptBookOpenResult(coreType, correlationId, chapterCount, error);
  }


  acceptBookOpenJSONResult(coreType: string, correlationId: string,
    result: ReaderUIJSONResult): ReaderUIAsyncTransition {
    return this.runtime.acceptBookOpenJSONResult(coreType, correlationId, result);
  }

  provideBookOpenLayout(correlationId: string, layout: ReaderUIBookOpenLayout): ReaderUIAsyncTransition {
    return this.runtime.provideBookOpenLayout(correlationId, layout);
  }

  cancelBookOpen(correlationId: string): ReaderUIAsyncTransition {
    return this.runtime.cancelBookOpen(correlationId);
  }

  providePageLayout(correlationId: string, layout: ReaderUIPageLayout): ReaderUIPlaybackTransition {
    return this.runtime.providePageLayout(correlationId, layout);
  }

  acceptPageLocationResult(correlationId: string, canonicalLocation?: string,
    pageIndex?: number, error?: string): ReaderUIPlaybackTransition {
    return this.runtime.acceptPageLocationResult(correlationId, canonicalLocation, pageIndex, error);
  }

  acceptPageLocationJSONResult(correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    return this.runtime.acceptPageLocationJSONResult(correlationId, result);
  }

  acceptPageProgressResult(correlationId: string, stored?: boolean,
    error?: string): ReaderUIPlaybackTransition {
    return this.runtime.acceptPageProgressResult(correlationId, stored, error);
  }

  acceptPageProgressJSONResult(correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    return this.runtime.acceptPageProgressJSONResult(correlationId, result);
  }

  cancelPageStep(correlationId: string): ReaderUIPlaybackTransition {
    return this.runtime.cancelPageStep(correlationId);
  }

  acceptTTSCoreResult(coreType: string, correlationId: string,
    error?: string): ReaderUIPlaybackTransition {
    return this.runtime.acceptTTSCoreResult(coreType, correlationId, error);
  }

  acceptTTSCoreJSONResult(coreType: string, correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    return this.runtime.acceptTTSCoreJSONResult(coreType, correlationId, result);
  }

  acceptTTSSystemStart(correlationId: string, error?: string): ReaderUIPlaybackTransition {
    return this.runtime.acceptTTSSystemStart(correlationId, error);
  }

  acceptTTSSystemStartJSONResult(correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    return this.runtime.acceptTTSSystemStartJSONResult(correlationId, result);
  }

  stopTTS(correlationId?: string): ReaderUIPlaybackTransition {
    return this.runtime.stopTTS(correlationId);
  }

  acceptAutoPageTimerFired(correlationId: string, generation: number): ReaderUIPlaybackTransition {
    return this.runtime.acceptAutoPageTimerFired(correlationId, generation);
  }

  stopAutoPage(correlationId?: string): ReaderUIPlaybackTransition {
    return this.runtime.stopAutoPage(correlationId);
  }

  suspendAutoPageForBackground(correlationId?: string): ReaderUIPlaybackTransition {
    return this.runtime.suspendAutoPageForBackground(correlationId);
  }

  completeAsync(error?: string): ReaderUIState {
    return this.runtime.completeAsync(error);
  }
}

// ArkTS requires a declared class rather than an object literal for this
// runtime gateway. It holds the long-lived driver instance; no transaction
// state is copied across the adapter boundary.
class RuntimeDriverBookOpenGateway implements ReaderBookOpenRuntimeGateway {
  // `resyncIfNeeded()` may replace the generated shadow driver after a
  // native-only route transition. Keep this adapter indirection dynamic: a
  // book.open executor created at Store init must always operate on the same
  // runtime that just accepted its dispatch, rather than an obsolete driver.
  private readonly driverReader: () => ReaderUIRuntimeDriver;

  constructor(driverReader: () => ReaderUIRuntimeDriver) {
    this.driverReader = driverReader;
  }

  currentState(): ReaderUIState {
    return this.driverReader().state;
  }

  acceptBookOpenResult(coreType: string, correlationId: string, chapterCount?: number,
    error?: string): ReaderUIAsyncTransition {
    return this.driverReader().acceptBookOpenResult(coreType, correlationId, chapterCount, error);
  }

  acceptBookOpenJSONResult(coreType: string, correlationId: string,
    result: ReaderUIJSONResult): ReaderUIAsyncTransition {
    return this.driverReader().acceptBookOpenJSONResult(coreType, correlationId, result);
  }

  provideBookOpenLayout(correlationId: string, layout: ReaderUIBookOpenLayout): ReaderUIAsyncTransition {
    return this.driverReader().provideBookOpenLayout(correlationId, layout);
  }

  cancelBookOpen(correlationId: string): ReaderUIAsyncTransition {
    return this.driverReader().cancelBookOpen(correlationId);
  }
}

class RuntimeDriverPlaybackGateway implements ReaderPlaybackRuntimeGateway {
  private readonly driverReader: () => ReaderUIRuntimeDriver;

  constructor(driverReader: () => ReaderUIRuntimeDriver) {
    this.driverReader = driverReader;
  }

  currentState(): ReaderUIState { return this.driverReader().state; }
  providePageLayout(correlationId: string, layout: ReaderUIPageLayout): ReaderUIPlaybackTransition {
    return this.driverReader().providePageLayout(correlationId, layout);
  }
  acceptPageLocationResult(correlationId: string, canonicalLocation?: string,
    pageIndex?: number, error?: string): ReaderUIPlaybackTransition {
    return this.driverReader().acceptPageLocationResult(correlationId, canonicalLocation, pageIndex, error);
  }
  acceptPageLocationJSONResult(correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    return this.driverReader().acceptPageLocationJSONResult(correlationId, result);
  }
  acceptPageProgressResult(correlationId: string, stored?: boolean,
    error?: string): ReaderUIPlaybackTransition {
    return this.driverReader().acceptPageProgressResult(correlationId, stored, error);
  }
  acceptPageProgressJSONResult(correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    return this.driverReader().acceptPageProgressJSONResult(correlationId, result);
  }
  cancelPageStep(correlationId: string): ReaderUIPlaybackTransition {
    return this.driverReader().cancelPageStep(correlationId);
  }
  acceptTTSCoreResult(coreType: string, correlationId: string,
    error?: string): ReaderUIPlaybackTransition {
    return this.driverReader().acceptTTSCoreResult(coreType, correlationId, error);
  }
  acceptTTSCoreJSONResult(coreType: string, correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    return this.driverReader().acceptTTSCoreJSONResult(coreType, correlationId, result);
  }
  acceptTTSSystemStart(correlationId: string, error?: string): ReaderUIPlaybackTransition {
    return this.driverReader().acceptTTSSystemStart(correlationId, error);
  }
  acceptTTSSystemStartJSONResult(correlationId: string,
    result: ReaderUIJSONResult): ReaderUIPlaybackTransition {
    return this.driverReader().acceptTTSSystemStartJSONResult(correlationId, result);
  }
  stopTTS(correlationId?: string): ReaderUIPlaybackTransition {
    return this.driverReader().stopTTS(correlationId);
  }
  acceptAutoPageTimerFired(correlationId: string, generation: number): ReaderUIPlaybackTransition {
    return this.driverReader().acceptAutoPageTimerFired(correlationId, generation);
  }
  stopAutoPage(correlationId?: string): ReaderUIPlaybackTransition {
    return this.driverReader().stopAutoPage(correlationId);
  }
  suspendAutoPageForBackground(correlationId?: string): ReaderUIPlaybackTransition {
    return this.driverReader().suspendAutoPageForBackground(correlationId);
  }
  completeAsync(error?: string): ReaderUIState {
    return this.driverReader().completeAsync(error);
  }
}

class RuntimeDriverImportGateway implements ReaderImportRuntimeGateway {
  // `resyncIfNeeded()` may replace the generated shadow driver after a
  // native-only route transition. Keep this adapter indirection dynamic: an
  // import executor created at Store init must always operate on the same
  // runtime that just accepted its dispatch, rather than an obsolete driver.
  private readonly driverReader: () => ReaderUIRuntimeDriver;

  constructor(driverReader: () => ReaderUIRuntimeDriver) {
    this.driverReader = driverReader;
  }

  currentState(): ReaderUIState {
    return this.driverReader().state;
  }
}

class RuntimeDriverSourceSwitchGateway implements ReaderSourceSwitchRuntimeGateway {
  // `resyncIfNeeded()` may replace the generated shadow driver after a
  // native-only route transition. Keep this adapter indirection dynamic: a
  // source switch executor created at Store init must always operate on the
  // same runtime that just accepted its dispatch, rather than an obsolete
  // driver.
  private readonly driverReader: () => ReaderUIRuntimeDriver;

  constructor(driverReader: () => ReaderUIRuntimeDriver) {
    this.driverReader = driverReader;
  }

  currentState(): ReaderUIState {
    return this.driverReader().state;
  }
}

class RuntimeDriverReplaceRuleGateway implements ReaderReplaceRuleRuntimeGateway {
  // `resyncIfNeeded()` may replace the generated shadow driver after a
  // native-only route transition. Keep this adapter indirection dynamic: a
  // replace rule executor created at Store init must always operate on the
  // same runtime that just accepted its dispatch, rather than an obsolete
  // driver.
  private readonly driverReader: () => ReaderUIRuntimeDriver;

  constructor(driverReader: () => ReaderUIRuntimeDriver) {
    this.driverReader = driverReader;
  }

  currentState(): ReaderUIState {
    return this.driverReader().state;
  }
}

class RuntimeDriverRssGateway implements ReaderRssPilotRuntimeGateway {
  // `resyncIfNeeded()` may replace the generated shadow driver after a
  // native-only route transition. Keep this adapter indirection dynamic: an
  // RSS executor created at Store init must always operate on the same
  // runtime that just accepted its dispatch, rather than an obsolete driver.
  private readonly driverReader: () => ReaderUIRuntimeDriver;

  constructor(driverReader: () => ReaderUIRuntimeDriver) {
    this.driverReader = driverReader;
  }

  currentState(): ReaderUIState {
    return this.driverReader().state;
  }
}

class RuntimeDriverSyncGateway implements ReaderSyncPilotRuntimeGateway {
  // `resyncIfNeeded()` may replace the generated shadow driver after a
  // native-only route transition. Keep this adapter indirection dynamic: a
  // sync executor created at Store init must always operate on the same
  // runtime that just accepted its dispatch, rather than an obsolete driver.
  private readonly driverReader: () => ReaderUIRuntimeDriver;

  constructor(driverReader: () => ReaderUIRuntimeDriver) {
    this.driverReader = driverReader;
  }

  currentState(): ReaderUIState {
    return this.driverReader().state;
  }
}

export interface ReaderUIDirectoryPilotResult {
  handled: boolean;
  succeeded: boolean;
  changed: boolean;
  canonicalEvent: string;
  previousOverlay?: string;
  semanticOverlay?: string;
}

export interface ReaderUIBookOpenPilotResult {
  handled: boolean;
  succeeded: boolean;
  canonicalEvent: string;
  correlationId: string;
}

export interface ReaderUIPlaybackPilotResult {
  handled: boolean;
  succeeded: boolean;
  canonicalEvent: string;
  correlationId: string;
}

export interface ReaderUIImportPilotResult {
  handled: boolean;
  succeeded: boolean;
  canonicalEvent: string;
  correlationId: string;
}

export interface ReaderUISourceSwitchPilotResult {
  handled: boolean;
  succeeded: boolean;
  canonicalEvent: string;
  correlationId: string;
}

export interface ReaderUIReplaceRulePilotResult {
  handled: boolean;
  succeeded: boolean;
  canonicalEvent: string;
  correlationId: string;
}

export interface ReaderUIRssPilotResult {
  handled: boolean;
  succeeded: boolean;
  canonicalEvent: string;
  correlationId: string;
}

export interface ReaderUISyncPilotResult {
  handled: boolean;
  succeeded: boolean;
  canonicalEvent: string;
  correlationId: string;
}

function optionalValue(value?: string): string {
  return value ?? '';
}

function semanticOverlay(state: ReaderUiState): string | undefined {
  if (state.routeId === DIRECTORY_OVERLAY_ROUTE) return 'directory';
  return state.overlay.length > 0 ? state.overlay : undefined;
}

// Native overlay routes occupy the top stack entry, while ReaderUIRuntime keeps
// the underlying route current and records the overlay semantically.
function projectNativeState(state: ReaderUiState): ReaderUIState {
  let currentIndex: number = state.stack.length - 1;
  let routeId: string = state.routeId;
  if (isReaderModuleOverlayRoute(state.routeId) && currentIndex > 0) {
    currentIndex -= 1;
    routeId = state.stack[currentIndex].id;
  }

  const routeStack: string[] = [];
  for (let index = 0; index < currentIndex; index += 1) {
    routeStack.push(state.stack[index].id);
  }

  return {
    routeId: routeId,
    routeStack: routeStack,
    tab: state.tab,
    overlay: semanticOverlay(state),
    activeSession: state.activeSession.length > 0 ? state.activeSession : undefined,
    loading: state.loading,
    reducedMotion: state.reducedMotion,
    readerPageIndex: state.readerPageIndex,
    focusTarget: state.focusTarget.length > 0 ? state.focusTarget : undefined,
    error: state.error !== null ? state.error.code : undefined,
  };
}

function stateDifference(runtime: ReaderUIState, nativeState: ReaderUIState): string {
  const fields: string[] = [];
  if (runtime.routeId !== nativeState.routeId) fields.push('routeId');
  if (runtime.routeStack.join('|') !== nativeState.routeStack.join('|')) fields.push('routeStack');
  if (runtime.tab !== nativeState.tab) fields.push('tab');
  if (optionalValue(runtime.overlay) !== optionalValue(nativeState.overlay)) fields.push('overlay');
  if (optionalValue(runtime.activeSession) !== optionalValue(nativeState.activeSession)) fields.push('activeSession');
  if (runtime.loading !== nativeState.loading) fields.push('loading');
  if (runtime.reducedMotion !== nativeState.reducedMotion) fields.push('reducedMotion');
  if (runtime.readerPageIndex !== nativeState.readerPageIndex) fields.push('readerPageIndex');
  if (optionalValue(runtime.focusTarget) !== optionalValue(nativeState.focusTarget)) fields.push('focusTarget');
  if (optionalValue(runtime.error) !== optionalValue(nativeState.error)) fields.push('error');
  return fields.join(',');
}

function initialMetrics(): ReaderUIRuntimeShadowMetrics {
  return {
    covered: 0,
    fallback: 0,
    pilot: 0,
    pilotFailure: 0,
    pilotStateChanges: 0,
    runtimeError: 0,
    mismatch: 0,
    observedEffects: 0,
    admittedTransactions: 0,
    executedEffects: 0,
    resync: 0,
    lastEvent: '',
    lastCanonicalEvent: '',
    lastRuntimeError: '',
    lastMismatch: '',
  };
}

/**
 * Long-lived Store-owned runtime rollout coordinator.
 *
 * Covered native aliases are normalized to canonical UiEvent names before the
 * shared runtime is called. Fallback events never enter the runtime action
 * table; they only resynchronize the observation baseline when shared fields
 * changed. Shadow effects are recorded but never executed; the directory Pilot
 * has no Core/Host effects and projects only its semantic overlay.
 */
export class ReaderUIRuntimeShadowCoordinator {
  private runtime: ReaderUIRuntimeDriver;
  private metrics: ReaderUIRuntimeShadowMetrics = initialMetrics();
  private lastEffectTypes: string[] = [];
  private correlationSequence: number = 0;
  // book.open has been promoted to Pilot with effectPolicy=exactly-once.
  // The coordinator's executor is created when bookOpenHost is injected (always
  // true in production via ReaderUiStore.bookOpenPilotHost()); the executor
  // defaults its Core gateway to CoreRuntimeBookOpenGateway. Tests may still
  // call setBookOpenPilotEnabledForTest(false) to exercise the Shadow fallback.
  private bookOpenPilotEnabled: boolean = true;
  private readonly bookOpenExecutor: ReaderBookOpenEffectExecutor | null;
  private readonly bookOpenHost: ReaderBookOpenPilotHost | null;
  private pagePilotEnabled: boolean = false;
  // TTS and auto-page pairs have been promoted to Pilot with
  // effectPolicy=exactly-once. The coordinator's executor is created when
  // playbackHost is injected (always true in production via
  // ReaderUiStore.playbackPilotHost()); tests may still call
  // setPlaybackPilotPairsForTest(false, false, false) to exercise the Shadow
  // fallback. The page pair intentionally remains Shadow.
  private ttsPilotEnabled: boolean = true;
  private autoPagePilotEnabled: boolean = true;
  private readonly playbackExecutor: ReaderPlaybackEffectExecutor | null;
  private readonly playbackHost: ReaderPlaybackPilotHost | null;
  // Import remains Shadow in production. Keep the executor seam available for
  // explicit tests, but never claim effect ownership from the live Store path.
  private importPilotEnabled: boolean = false;
  private readonly importExecutor: ReaderImportEffectExecutor | null;
  private readonly importHost: ReaderImportPilotHost | null;
  // Source switch remains Shadow in production. Its overlay/effect executor is
  // retained as an explicitly enabled experiment only.
  private sourceSwitchPilotEnabled: boolean = false;
  private readonly sourceSwitchExecutor: ReaderSourceSwitchEffectExecutor | null;
  private readonly sourceSwitchHost: ReaderSourceSwitchPilotHost | null;
  // Replace rules remains Shadow in production. Tests may explicitly enable
  // the retained executor seam without changing live ownership.
  private replaceRulePilotEnabled: boolean = false;
  private readonly replaceRuleExecutor: ReaderReplaceRuleEffectExecutor | null;
  private readonly replaceRuleHost: ReaderReplaceRulePilotHost | null;
  // RSS remains Shadow in production. The executor seam is test-only until
  // the abstract Reader-UI RSS commands have verified Core mappings.
  private rssPilotEnabled: boolean = false;
  private readonly rssExecutor: ReaderRssEffectExecutor | null;
  private readonly rssHost: ReaderRssPilotHost | null;
  // Sync remains Shadow. Generated Sync effect names do not yet have verified
  // production Core/Host mappings, so the experimental executor requires an
  // explicit injected gateway and effect ownership is disabled by default.
  private syncPilotEnabled: boolean = false;
  private readonly syncExecutor: ReaderSyncEffectExecutor | null;
  private readonly syncHost: ReaderSyncPilotHost | null;

  constructor(nativeState: ReaderUiState, runtime?: ReaderUIRuntimeDriver,
    bookOpenHost?: ReaderBookOpenPilotHost, bookOpenCore?: ReaderBookOpenCoreGateway,
    playbackHost?: ReaderPlaybackPilotHost, playbackCore?: ReaderPlaybackCoreGateway,
    playbackPlatform?: ReaderPlaybackPlatformGateway,
    importHost?: ReaderImportPilotHost, importCore?: ReaderImportCoreGateway,
    sourceSwitchHost?: ReaderSourceSwitchPilotHost, sourceSwitchCore?: ReaderSourceSwitchCoreGateway,
    replaceRuleHost?: ReaderReplaceRulePilotHost, replaceRuleCore?: ReaderReplaceRuleCoreGateway,
    rssHost?: ReaderRssPilotHost, rssCore?: ReaderRssPilotEffectExecutor,
    syncHost?: ReaderSyncPilotHost, syncCore?: ReaderSyncExperimentalGateway) {
    this.runtime = runtime ?? new GeneratedReaderUIRuntimeDriver(projectNativeState(nativeState));
    if (bookOpenHost === undefined) {
      this.bookOpenExecutor = null;
      this.bookOpenHost = null;
    } else {
      this.bookOpenHost = bookOpenHost;
      const runtimeGateway = new RuntimeDriverBookOpenGateway((): ReaderUIRuntimeDriver => this.runtime);
      this.bookOpenExecutor = new ReaderBookOpenEffectExecutor(runtimeGateway, bookOpenHost, bookOpenCore);
    }
    if (playbackHost === undefined) {
      this.playbackExecutor = null;
      this.playbackHost = null;
    } else {
      this.playbackHost = playbackHost;
      const playbackRuntime = new RuntimeDriverPlaybackGateway((): ReaderUIRuntimeDriver => this.runtime);
      this.playbackExecutor = new ReaderPlaybackEffectExecutor(
        playbackRuntime, playbackHost, playbackCore, playbackPlatform,
      );
    }
    if (importHost === undefined) {
      this.importExecutor = null;
      this.importHost = null;
    } else {
      this.importHost = importHost;
      const importRuntime = new RuntimeDriverImportGateway((): ReaderUIRuntimeDriver => this.runtime);
      this.importExecutor = new ReaderImportEffectExecutor(importRuntime, importHost, importCore);
    }
    if (sourceSwitchHost === undefined) {
      this.sourceSwitchExecutor = null;
      this.sourceSwitchHost = null;
    } else {
      this.sourceSwitchHost = sourceSwitchHost;
      const sourceSwitchRuntime = new RuntimeDriverSourceSwitchGateway((): ReaderUIRuntimeDriver => this.runtime);
      this.sourceSwitchExecutor = new ReaderSourceSwitchEffectExecutor(
        sourceSwitchRuntime, sourceSwitchHost, sourceSwitchCore,
      );
    }
    if (replaceRuleHost === undefined) {
      this.replaceRuleExecutor = null;
      this.replaceRuleHost = null;
    } else {
      this.replaceRuleHost = replaceRuleHost;
      const replaceRuleRuntime = new RuntimeDriverReplaceRuleGateway((): ReaderUIRuntimeDriver => this.runtime);
      this.replaceRuleExecutor = new ReaderReplaceRuleEffectExecutor(
        replaceRuleRuntime, replaceRuleHost, replaceRuleCore,
      );
    }
    if (rssHost === undefined) {
      this.rssExecutor = null;
      this.rssHost = null;
    } else {
      this.rssHost = rssHost;
      const rssRuntime = new RuntimeDriverRssGateway((): ReaderUIRuntimeDriver => this.runtime);
      this.rssExecutor = new ReaderRssEffectExecutor(rssRuntime, rssHost, rssCore);
    }
    if (syncHost === undefined || syncCore === undefined) {
      this.syncExecutor = null;
      this.syncHost = null;
    } else {
      this.syncHost = syncHost;
      const syncRuntime = new RuntimeDriverSyncGateway((): ReaderUIRuntimeDriver => this.runtime);
      this.syncExecutor = new ReaderSyncEffectExecutor(syncRuntime, syncHost, syncCore);
    }
  }

  static coveredEvents(): string[] {
    return READER_UI_SHADOW_COVERED_EVENTS.slice();
  }

  /** Test-only rollout switch. Production instances now start Pilot-enabled. */
  setBookOpenPilotEnabledForTest(enabled: boolean): void {
    this.bookOpenPilotEnabled = enabled;
  }

  isBookOpenPilotEnabled(): boolean {
    return this.bookOpenPilotEnabled;
  }

  /** Test-only pair switches. Production construction leaves TTS and auto-page
    * Pilot-enabled and the page pair Shadow; tests may disable any pair to
    * exercise the Shadow fallback. */
  setPlaybackPilotPairsForTest(pagePair: boolean, ttsPair: boolean,
    autoPagePair: boolean): void {
    this.pagePilotEnabled = pagePair;
    this.ttsPilotEnabled = ttsPair;
    this.autoPagePilotEnabled = autoPagePair;
  }

  /** Prevent a stale playback callback from crossing a Store reinitialization. */
  cancelForStoreReinitialize(): void {
    this.playbackExecutor?.cancelForStoreReinitialize();
  }

  /** Experimental test-only switch. Production instances remain Shadow. */
  setImportPilotEnabledForTest(enabled: boolean): void {
    this.importPilotEnabled = enabled;
  }

  isImportPilotEnabled(): boolean {
    return this.importPilotEnabled;
  }

  importPilotSnapshot(): ReaderImportPilotSnapshot {
    if (this.importExecutor === null) {
      return {
        activeCorrelationId: '',
        activeRequestId: 0,
        executedEffects: 0,
        ignoredLateResults: 0,
        cancelledCommands: 0,
      };
    }
    return this.importExecutor.snapshot();
  }

  /** Experimental test-only switch. Production instances remain Shadow. */
  setSourceSwitchPilotEnabledForTest(enabled: boolean): void {
    this.sourceSwitchPilotEnabled = enabled;
  }

  isSourceSwitchPilotEnabled(): boolean {
    return this.sourceSwitchPilotEnabled;
  }

  sourceSwitchPilotSnapshot(): ReaderSourceSwitchPilotSnapshot {
    if (this.sourceSwitchExecutor === null) {
      return {
        activeCorrelationId: '',
        activeRequestId: 0,
        executedEffects: 0,
        ignoredLateResults: 0,
        cancelledCommands: 0,
      };
    }
    return this.sourceSwitchExecutor.snapshot();
  }

  /** Experimental test-only switch. Production instances remain Shadow. */
  setReplaceRulePilotEnabledForTest(enabled: boolean): void {
    this.replaceRulePilotEnabled = enabled;
  }

  isReplaceRulePilotEnabled(): boolean {
    return this.replaceRulePilotEnabled;
  }

  replaceRulePilotSnapshot(): ReaderReplaceRulePilotSnapshot {
    if (this.replaceRuleExecutor === null) {
      return {
        activeCorrelationId: '',
        activeRequestId: 0,
        executedEffects: 0,
        ignoredLateResults: 0,
        cancelledCommands: 0,
      };
    }
    return this.replaceRuleExecutor.snapshot();
  }

  /** Experimental test-only switch. Production instances remain Shadow. */
  setRssPilotEnabledForTest(enabled: boolean): void {
    this.rssPilotEnabled = enabled;
  }

  isRssPilotEnabled(): boolean {
    return this.rssPilotEnabled;
  }

  rssPilotSnapshot(): ReaderRssPilotSnapshot {
    if (this.rssExecutor === null) {
      return {
        activeCorrelationId: '',
        activeRequestId: 0,
        executedEffects: 0,
        ignoredLateResults: 0,
        cancelledCommands: 0,
      };
    }
    return this.rssExecutor.snapshot();
  }

  /** Experimental test-only switch. Production instances remain Shadow. */
  setSyncPilotEnabledForTest(enabled: boolean): void {
    this.syncPilotEnabled = enabled;
  }

  isSyncPilotEnabled(): boolean {
    return this.syncPilotEnabled;
  }

  syncPilotSnapshot(): ReaderSyncPilotSnapshot {
    if (this.syncExecutor === null) {
      return {
        activeCorrelationId: '',
        activeRequestId: 0,
        executedEffects: 0,
        ignoredLateResults: 0,
        cancelledCommands: 0,
      };
    }
    return this.syncExecutor.snapshot();
  }

  playbackPilotSnapshot(): ReaderPlaybackPilotSnapshot {
    if (this.playbackExecutor === null) {
      return {
        activePageCorrelationId: '',
        activeTtsCorrelationId: '',
        activeAutoPageCorrelationId: '',
        activeRequestId: 0,
        executedEffects: 0,
        ignoredLateCallbacks: 0,
        cancelledCommands: 0,
        timerArms: 0,
        timerCancels: 0,
        speechStarts: 0,
      };
    }
    return this.playbackExecutor.snapshot();
  }

  dispatchPlaybackPilot(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIPlaybackPilotResult {
    const executor = this.playbackExecutor;
    if (executor === null) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    const commitBoundaryMutation = this.playbackCommitBoundaryMutation(event);
    if (commitBoundaryMutation.length > 0) {
      this.metrics.lastEvent = event.type;
      this.metrics.lastCanonicalEvent = commitBoundaryMutation;
      this.metrics.lastRuntimeError = '';
      this.metrics.lastMismatch = '';
      this.lastEffectTypes = [];
      this.metrics.covered += 1;
      this.metrics.pilot += 1;
      try {
        this.correlationSequence += 1;
        this.runtime.dispatch(
          commitBoundaryMutation,
          this.playbackCommitBoundaryPayload(commitBoundaryMutation, event),
          `harmony-playback-boundary-${this.correlationSequence}`,
        );
        this.metrics.pilotFailure += 1;
        this.metrics.runtimeError += 1;
        this.metrics.lastRuntimeError =
          `${commitBoundaryMutation} unexpectedly crossed the progress commit boundary`;
      } catch (error) {
        this.metrics.pilotFailure += 1;
        this.metrics.runtimeError += 1;
        this.metrics.lastRuntimeError = `PAGE_PROGRESS_COMMIT_PENDING: ${(error as Error).message}`;
      }
      return {
        handled: true,
        succeeded: false,
        canonicalEvent: commitBoundaryMutation,
        correlationId: '',
      };
    }

    const canonicalEvent = this.playbackCanonicalEvent(event, nativeBefore);
    if (canonicalEvent.length === 0 || !this.playbackPairEnabled(canonicalEvent)) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    this.metrics.lastEvent = event.type;
    this.metrics.lastCanonicalEvent = canonicalEvent;
    this.metrics.lastRuntimeError = '';
    this.metrics.lastMismatch = '';
    this.lastEffectTypes = [];
    this.metrics.covered += 1;
    this.metrics.pilot += 1;

    let correlationId = this.activePlaybackCorrelation(canonicalEvent);
    let bound = false;
    try {
      if (this.playbackStartsTransaction(canonicalEvent)) {
        this.correlationSequence += 1;
        correlationId = `harmony-playback-pilot-${this.correlationSequence}`;
        executor.bind(correlationId, this.playbackKind(canonicalEvent), nativeBefore);
        bound = true;
      }
      const transition = this.runtime.dispatch(
        canonicalEvent, this.playbackPayload(canonicalEvent, nativeBefore),
        correlationId.length > 0 ? correlationId : undefined,
      );
      for (let index = 0; index < transition.effects.length; index += 1) {
        this.lastEffectTypes.push(transition.effects[index].type);
      }
      this.metrics.observedEffects += transition.effects.length;
      this.metrics.admittedTransactions += bound ? 1 : 0;
      executor.consumeDispatch(transition);
      return {
        handled: true,
        succeeded: true,
        canonicalEvent: canonicalEvent,
        correlationId: correlationId,
      };
    } catch (error) {
      if (bound && correlationId.length > 0) executor.discard(correlationId);
      this.metrics.pilotFailure += 1;
      this.metrics.runtimeError += 1;
      this.metrics.lastRuntimeError = (error as Error).message;
      // A Pilot admission failure is intentionally fail-closed: it must not
      // fall back to a local reducer or a system reader screen.  Keep the
      // reason in the device log so an on-device tap can be diagnosed without
      // inventing visible error UI or guessing from a static test.
      console.error(`[ReaderPlaybackPilot] ${canonicalEvent} admission failed: ${this.metrics.lastRuntimeError}`);
      return { handled: true, succeeded: false, canonicalEvent: canonicalEvent, correlationId: '' };
    }
  }

  providePlaybackMeasuredLayout(correlationId: string, layout: ReaderUIPageLayout): boolean {
    return this.playbackExecutor?.provideMeasuredPageLayout(correlationId, layout) ?? false;
  }

  rejectPlaybackPageProposal(correlationId: string, message: string): boolean {
    return this.playbackExecutor?.rejectPageProposal(correlationId, message) ?? false;
  }

  suspendPlaybackForBackground(): Promise<void> {
    if (!this.autoPagePilotEnabled || this.playbackExecutor === null) return Promise.resolve();
    return this.playbackExecutor.suspendAutoPageForBackground();
  }

  waitForPlaybackPilotIdle(): Promise<void> {
    return this.playbackExecutor?.whenIdle() ?? Promise.resolve();
  }

  teardownPlaybackForDestroy(): Promise<void> {
    if (this.playbackExecutor === null) return Promise.resolve();
    try {
      const snapshot = this.playbackExecutor.snapshot();
      if (snapshot.activePageCorrelationId.length > 0 || snapshot.activeTtsCorrelationId.length > 0 ||
        snapshot.activeAutoPageCorrelationId.length > 0) {
        this.correlationSequence += 1;
        const transition = this.runtime.dispatch('reader.exit', {}, `harmony-destroy-${this.correlationSequence}`);
        return this.playbackExecutor.consumeDispatch(transition)
          .then((): Promise<void> => this.playbackExecutor?.teardownForDestroy() ?? Promise.resolve());
      }
    } catch (error) {
      // Continue with direct platform invalidation below.
    }
    return this.playbackExecutor.teardownForDestroy();
  }

  bookOpenPilotSnapshot(): ReaderBookOpenPilotSnapshot {
    if (this.bookOpenExecutor === null) {
      return {
        activeCorrelationId: '',
        activeRequestId: 0,
        executedEffects: 0,
        ignoredLateResults: 0,
        cancelledCommands: 0,
        contentGeneration: 0,
      };
    }
    return this.bookOpenExecutor.snapshot();
  }

  /**
   * Dispatches the directory pair as the only Pilot cohort. `handled=true`
   * means Store must not invoke ReaderReducer or ReaderEffects, including when
   * runtime dispatch fails. Native projection happens only after success.
   */
  dispatchDirectoryPilot(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIDirectoryPilotResult {
    const canonicalEvent = this.directoryPilotEvent(event, nativeBefore);
    if (canonicalEvent.length === 0) {
      return {
        handled: false,
        succeeded: false,
        changed: false,
        canonicalEvent: '',
      };
    }

    this.metrics.lastEvent = event.type;
    this.metrics.lastCanonicalEvent = canonicalEvent;
    this.metrics.lastRuntimeError = '';
    this.metrics.lastMismatch = '';
    this.lastEffectTypes = [];
    this.metrics.covered += 1;
    this.metrics.pilot += 1;

    if (GENERATED_RUNTIME_ACTIONS[canonicalEvent] === undefined) {
      this.metrics.pilotFailure += 1;
      this.recordRuntimeError(`GENERATED_RUNTIME_ACTIONS missing ${canonicalEvent}`, nativeBefore);
      return {
        handled: true,
        succeeded: false,
        changed: false,
        canonicalEvent: canonicalEvent,
      };
    }

    try {
      this.correlationSequence += 1;
      const transition = this.runtime.dispatch(
        canonicalEvent,
        {},
        `harmony-pilot-${this.correlationSequence}`,
      );
      for (let index = 0; index < transition.effects.length; index += 1) {
        this.lastEffectTypes.push(transition.effects[index].type);
      }
      this.metrics.observedEffects += transition.effects.length;
      if (transition.effects.length > 0) {
        this.metrics.pilotFailure += 1;
        this.recordRuntimeError(`${canonicalEvent} unexpectedly emitted effects`, nativeBefore);
        return {
          handled: true,
          succeeded: false,
          changed: false,
          canonicalEvent: canonicalEvent,
        };
      }

      const previousOverlay = transition.previous.overlay;
      const semanticOverlay = transition.state.overlay;
      const changed = optionalValue(previousOverlay) !== optionalValue(semanticOverlay);
      if (changed) this.metrics.pilotStateChanges += 1;
      return {
        handled: true,
        succeeded: true,
        changed: changed,
        canonicalEvent: canonicalEvent,
        previousOverlay: previousOverlay,
        semanticOverlay: semanticOverlay,
      };
    } catch (error) {
      this.metrics.pilotFailure += 1;
      this.recordRuntimeError((error as Error).message, nativeBefore);
      return {
        handled: true,
        succeeded: false,
        changed: false,
        canonicalEvent: canonicalEvent,
      };
    }
  }

  verifyPilotProjection(nativeAfter: ReaderUiState): void {
    const mismatch = stateDifference(this.runtime.state, projectNativeState(nativeAfter));
    if (mismatch.length > 0) {
      this.metrics.mismatch += 1;
      this.metrics.lastMismatch = mismatch;
    }
  }

  isDirectoryPilotActive(): boolean {
    return this.runtime.state.overlay === 'directory';
  }

  /**
   * Handles a user back/exit only while the opt-in book.open transaction is
   * active. The exact in-flight CoreCommandHandle is cancelled before the
   * runtime restores its start route; subsequent Core completion is ignored by
   * the correlation-scoped executor.
   */
  dispatchBookOpenCancellation(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIBookOpenPilotResult {
    const executor = this.bookOpenExecutor;
    if (!this.bookOpenPilotEnabled || executor === null || !executor.hasActiveCorrelation() ||
      !this.isBookOpenBackEvent(event, nativeBefore)) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    const correlationId = executor.activeCorrelationId();
    this.metrics.lastEvent = event.type;
    this.metrics.lastCanonicalEvent = 'book.open.cancel';
    this.metrics.lastRuntimeError = '';
    this.metrics.lastMismatch = '';
    this.lastEffectTypes = [];
    this.metrics.covered += 1;
    this.metrics.pilot += 1;
    try {
      executor.cancel(correlationId);
      const transition = this.runtime.cancelBookOpen(correlationId);
      if (!transition.accepted) {
        this.metrics.pilotFailure += 1;
        return { handled: true, succeeded: false, canonicalEvent: 'book.open.cancel', correlationId: correlationId };
      }
      // The executor's host owns native projection; cancellation only needs
      // to publish the semantic state after its Core handle has been stopped.
      // A synthetic zero-effect transition is consumed through the same host
      // by the Store below via the callback registered on construction.
      this.bookOpenHost?.applyRuntimeState(transition.state);
      return { handled: true, succeeded: true, canonicalEvent: 'book.open.cancel', correlationId: correlationId };
    } catch (error) {
      this.metrics.pilotFailure += 1;
      this.metrics.runtimeError += 1;
      this.metrics.lastRuntimeError = (error as Error).message;
      return { handled: true, succeeded: false, canonicalEvent: 'book.open.cancel', correlationId: correlationId };
    }
  }

  /**
   * Starts the only effect executor for a direct reader-entry book.open. It
   * intentionally returns handled on a runtime/executor failure so the legacy
   * reducer/effect path cannot run after Pilot has been explicitly enabled.
   */
  dispatchBookOpenPilot(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIBookOpenPilotResult {
    const executor = this.bookOpenExecutor;
    if (!this.bookOpenPilotEnabled || executor === null ||
      !this.isBookOpenPilotEvent(event, nativeBefore)) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    const canonicalEvent = 'book.open';
    this.metrics.lastEvent = event.type;
    this.metrics.lastCanonicalEvent = canonicalEvent;
    this.metrics.lastRuntimeError = '';
    this.metrics.lastMismatch = '';
    this.lastEffectTypes = [];
    this.metrics.covered += 1;
    this.metrics.pilot += 1;
    let correlationId = '';
    try {
      this.correlationSequence += 1;
      correlationId = `harmony-book-open-pilot-${this.correlationSequence}`;
      const transition = this.runtime.dispatch(canonicalEvent, this.payload(event), correlationId);
      for (let index = 0; index < transition.effects.length; index += 1) {
        this.lastEffectTypes.push(transition.effects[index].type);
      }
      this.metrics.observedEffects += transition.effects.length;
      for (let index = 0; index < transition.cancelledCorrelationIds.length; index += 1) {
        executor.cancel(transition.cancelledCorrelationIds[index]);
      }
      if (transition.effects.length !== 1) {
        throw new Error(`book.open must emit exactly one next Core effect, got ${transition.effects.length}`);
      }
      // The runtime is the transaction authority. Bind the DomainContext from
      // the emitted one-step effect payload rather than reconstituting a
      // parallel payload from the native alias.
      const jsonPayload = transition.effects[0].jsonPayload;
      if (jsonPayload === undefined) throw new Error('book.open effect is missing lossless jsonPayload');
      executor.start(correlationId, jsonPayload, transition.effects[0]);
      this.metrics.admittedTransactions += 1;
      return { handled: true, succeeded: true, canonicalEvent: canonicalEvent, correlationId: correlationId };
    } catch (error) {
      // runtime.dispatch may already have entered immersive/loading before a
      // DomainContext admission error (missing bound Core source, malformed
      // effect count, etc.). Tear that transaction down synchronously and
      // never fall through to legacy ReaderEffects.
      if (correlationId.length > 0) {
        executor.cancel(correlationId);
        try {
          const cancellation = this.runtime.cancelBookOpen(correlationId);
          if (cancellation.accepted) this.bookOpenHost?.applyRuntimeState(cancellation.state);
        } catch (cleanupError) {
          // Preserve the original admission failure as the surfaced cause.
        }
      }
      this.metrics.pilotFailure += 1;
      this.metrics.runtimeError += 1;
      this.metrics.lastRuntimeError = (error as Error).message;
      return { handled: true, succeeded: false, canonicalEvent: canonicalEvent, correlationId: '' };
    }
  }

  /** Called only by ReadingTextFlow after an ArkUI onAreaChange measurement. */
  provideBookOpenMeasuredLayout(correlationId: string, contentGeneration: number,
    layout: ReaderUIBookOpenLayout): boolean {
    const executor = this.bookOpenExecutor;
    if (!this.bookOpenPilotEnabled || executor === null) return false;
    return executor.provideMeasuredLayout(correlationId, contentGeneration, layout);
  }

  /**
   * Starts the only effect executor for a direct import transaction. It
   * intentionally returns handled on a runtime/executor failure so the legacy
   * reducer/effect path cannot run after Pilot has been explicitly enabled.
   * Each event must emit exactly one next Core effect; otherwise the
   * transaction is fail-closed (ledger cleared, no partial state).
   */
  dispatchImportPilot(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIImportPilotResult {
    const executor = this.importExecutor;
    if (!this.importPilotEnabled || executor === null ||
      !this.isImportPilotEvent(event, nativeBefore)) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    const canonicalEvent = this.importCanonicalEvent(event);
    this.metrics.lastEvent = event.type;
    this.metrics.lastCanonicalEvent = canonicalEvent;
    this.metrics.lastRuntimeError = '';
    this.metrics.lastMismatch = '';
    this.lastEffectTypes = [];
    this.metrics.covered += 1;
    this.metrics.pilot += 1;
    let correlationId = '';
    try {
      this.correlationSequence += 1;
      correlationId = `harmony-import-pilot-${this.correlationSequence}`;
      const transition = this.runtime.dispatch(
        canonicalEvent, this.importPayload(event, nativeBefore), correlationId,
      );
      for (let index = 0; index < transition.effects.length; index += 1) {
        this.lastEffectTypes.push(transition.effects[index].type);
      }
      this.metrics.observedEffects += transition.effects.length;
      if (transition.effects.length !== 1) {
        throw new Error(`${canonicalEvent} must emit exactly one next Core effect, got ${transition.effects.length}`);
      }
      const jsonPayload = transition.effects[0].jsonPayload;
      if (jsonPayload === undefined) throw new Error(`${canonicalEvent} effect is missing lossless jsonPayload`);
      executor.start(correlationId, jsonPayload, transition.effects[0]);
      this.metrics.admittedTransactions += 1;
      return { handled: true, succeeded: true, canonicalEvent: canonicalEvent, correlationId: correlationId };
    } catch (error) {
      // Fail-closed: cancel the executor's correlation (if any) and clear the
      // ledger so a partially admitted transaction cannot leak into the legacy
      // ReaderEffects import path.
      if (correlationId.length > 0) {
        executor.cancel(correlationId);
      }
      this.metrics.pilotFailure += 1;
      this.metrics.runtimeError += 1;
      this.metrics.lastRuntimeError = (error as Error).message;
      return { handled: true, succeeded: false, canonicalEvent: canonicalEvent, correlationId: '' };
    }
  }

  /**
   * Dispatches source switch events through the Pilot. Overlay/route events
   * (source.switch.open/cancel, reader.sourceSwitch.open/close) are projected
   * without Core effects; effectful events (source.switch.confirm/rollback)
   * drive the single effect executor. It intentionally returns handled on a
   * runtime/executor failure so the legacy reducer/effect path cannot run
   * after Pilot has been explicitly enabled.
   */
  dispatchSourceSwitchPilot(event: UiEvent, nativeBefore: ReaderUiState): ReaderUISourceSwitchPilotResult {
    const executor = this.sourceSwitchExecutor;
    if (!this.sourceSwitchPilotEnabled || executor === null ||
      !this.isSourceSwitchPilotEvent(event, nativeBefore)) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    const canonicalEvent = this.sourceSwitchCanonicalEvent(event, nativeBefore);
    if (canonicalEvent.length === 0) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    this.metrics.lastEvent = event.type;
    this.metrics.lastCanonicalEvent = canonicalEvent;
    this.metrics.lastRuntimeError = '';
    this.metrics.lastMismatch = '';
    this.lastEffectTypes = [];
    this.metrics.covered += 1;
    this.metrics.pilot += 1;
    let correlationId = '';
    try {
      this.correlationSequence += 1;
      correlationId = `harmony-source-switch-pilot-${this.correlationSequence}`;
      const transition = this.runtime.dispatch(
        canonicalEvent, this.sourceSwitchPayload(event, nativeBefore), correlationId,
      );
      for (let index = 0; index < transition.effects.length; index += 1) {
        this.lastEffectTypes.push(transition.effects[index].type);
      }
      this.metrics.observedEffects += transition.effects.length;
      // Overlay/route events (effectPolicy=none) emit zero effects; their
      // semantic change is projected through the runtime state alone.
      if (transition.effects.length === 0) {
        this.sourceSwitchHost?.applyRuntimeState(transition.state);
        this.metrics.pilotStateChanges += 1;
        return { handled: true, succeeded: true, canonicalEvent: canonicalEvent, correlationId: '' };
      }
      if (transition.effects.length !== 1) {
        throw new Error(`${canonicalEvent} must emit exactly one next Core effect, got ${transition.effects.length}`);
      }
      const jsonPayload = transition.effects[0].jsonPayload;
      if (jsonPayload === undefined) throw new Error(`${canonicalEvent} effect is missing lossless jsonPayload`);
      executor.start(correlationId, jsonPayload, transition.effects[0]);
      this.metrics.admittedTransactions += 1;
      return { handled: true, succeeded: true, canonicalEvent: canonicalEvent, correlationId: correlationId };
    } catch (error) {
      // Fail-closed: cancel the executor's correlation (if any) so a partially
      // admitted transaction cannot leak into the legacy ReaderEffects source
      // switch path.
      if (correlationId.length > 0) {
        executor.cancel(correlationId);
      }
      this.metrics.pilotFailure += 1;
      this.metrics.runtimeError += 1;
      this.metrics.lastRuntimeError = (error as Error).message;
      return { handled: true, succeeded: false, canonicalEvent: canonicalEvent, correlationId: '' };
    }
  }

  /**
   * Dispatches replace rule events through the Pilot. Each event must emit
   * exactly one next Core effect; otherwise the transaction is fail-closed
   * (ledger cleared, no partial state). It intentionally returns handled on a
   * runtime/executor failure so the legacy reducer/effect path cannot run
   * after Pilot has been explicitly enabled.
   */
  dispatchReplaceRulePilot(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIReplaceRulePilotResult {
    const executor = this.replaceRuleExecutor;
    if (!this.replaceRulePilotEnabled || executor === null ||
      !this.isReplaceRulePilotEvent(event, nativeBefore)) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    const canonicalEvent = this.replaceRuleCanonicalEvent(event, nativeBefore);
    if (canonicalEvent.length === 0) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    this.metrics.lastEvent = event.type;
    this.metrics.lastCanonicalEvent = canonicalEvent;
    this.metrics.lastRuntimeError = '';
    this.metrics.lastMismatch = '';
    this.lastEffectTypes = [];
    this.metrics.covered += 1;
    this.metrics.pilot += 1;
    let correlationId = '';
    try {
      this.correlationSequence += 1;
      correlationId = `harmony-replace-rule-pilot-${this.correlationSequence}`;
      const transition = this.runtime.dispatch(
        canonicalEvent, this.replaceRulePayload(event, nativeBefore), correlationId,
      );
      for (let index = 0; index < transition.effects.length; index += 1) {
        this.lastEffectTypes.push(transition.effects[index].type);
      }
      this.metrics.observedEffects += transition.effects.length;
      if (transition.effects.length !== 1) {
        throw new Error(`${canonicalEvent} must emit exactly one next Core effect, got ${transition.effects.length}`);
      }
      const jsonPayload = transition.effects[0].jsonPayload;
      if (jsonPayload === undefined) throw new Error(`${canonicalEvent} effect is missing lossless jsonPayload`);
      executor.start(correlationId, jsonPayload, transition.effects[0]);
      this.metrics.admittedTransactions += 1;
      return { handled: true, succeeded: true, canonicalEvent: canonicalEvent, correlationId: correlationId };
    } catch (error) {
      // Fail-closed: cancel the executor's correlation (if any) so a partially
      // admitted transaction cannot leak into the legacy ReaderEffects replace
      // rule path.
      if (correlationId.length > 0) {
        executor.cancel(correlationId);
      }
      this.metrics.pilotFailure += 1;
      this.metrics.runtimeError += 1;
      this.metrics.lastRuntimeError = (error as Error).message;
      return { handled: true, succeeded: false, canonicalEvent: canonicalEvent, correlationId: '' };
    }
  }

  /**
   * Dispatches RSS events through the Pilot. Each event must emit exactly one
   * next Core effect; otherwise the transaction is fail-closed (ledger
   * cleared, no partial state). It intentionally returns handled on a
   * runtime/executor failure so the legacy reducer/effect path cannot run
   * after Pilot has been explicitly enabled.
   */
  dispatchRssPilot(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIRssPilotResult {
    const executor = this.rssExecutor;
    if (!this.rssPilotEnabled || executor === null ||
      !this.isRssPilotEvent(event, nativeBefore)) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    const canonicalEvent = this.rssCanonicalEvent(event, nativeBefore);
    if (canonicalEvent.length === 0) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    this.metrics.lastEvent = event.type;
    this.metrics.lastCanonicalEvent = canonicalEvent;
    this.metrics.lastRuntimeError = '';
    this.metrics.lastMismatch = '';
    this.lastEffectTypes = [];
    this.metrics.covered += 1;
    this.metrics.pilot += 1;
    let correlationId = '';
    try {
      this.correlationSequence += 1;
      correlationId = `harmony-rss-pilot-${this.correlationSequence}`;
      const transition = this.runtime.dispatch(
        canonicalEvent, this.rssPayload(event, nativeBefore), correlationId,
      );
      for (let index = 0; index < transition.effects.length; index += 1) {
        this.lastEffectTypes.push(transition.effects[index].type);
      }
      this.metrics.observedEffects += transition.effects.length;
      if (transition.effects.length !== 1) {
        throw new Error(`${canonicalEvent} must emit exactly one next Core effect, got ${transition.effects.length}`);
      }
      const jsonPayload = transition.effects[0].jsonPayload;
      if (jsonPayload === undefined) throw new Error(`${canonicalEvent} effect is missing lossless jsonPayload`);
      executor.start(correlationId, jsonPayload, transition.effects[0]);
      this.metrics.admittedTransactions += 1;
      return { handled: true, succeeded: true, canonicalEvent: canonicalEvent, correlationId: correlationId };
    } catch (error) {
      // Fail-closed: cancel the executor's correlation (if any) so a partially
      // admitted transaction cannot leak into the legacy ReaderEffects RSS
      // path. No orphan ledger remains.
      if (correlationId.length > 0) {
        executor.cancel(correlationId);
      }
      this.metrics.pilotFailure += 1;
      this.metrics.runtimeError += 1;
      this.metrics.lastRuntimeError = (error as Error).message;
      return { handled: true, succeeded: false, canonicalEvent: canonicalEvent, correlationId: '' };
    }
  }

  /**
   * Test-only Sync experiment. Production construction has no executor and
   * syncPilotEnabled remains false, so all seven Sync events continue through
   * native reduction plus read-only runtime observation.
   */
  dispatchSyncPilot(event: UiEvent, nativeBefore: ReaderUiState): ReaderUISyncPilotResult {
    const executor = this.syncExecutor;
    if (!this.syncPilotEnabled || executor === null ||
      !this.isSyncPilotEvent(event, nativeBefore)) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    const canonicalEvent = this.syncCanonicalEvent(event, nativeBefore);
    if (canonicalEvent.length === 0) {
      return { handled: false, succeeded: false, canonicalEvent: '', correlationId: '' };
    }
    this.metrics.lastEvent = event.type;
    this.metrics.lastCanonicalEvent = canonicalEvent;
    this.metrics.lastRuntimeError = '';
    this.metrics.lastMismatch = '';
    this.lastEffectTypes = [];
    this.metrics.covered += 1;
    this.metrics.pilot += 1;
    let correlationId = '';
    try {
      this.correlationSequence += 1;
      correlationId = `harmony-sync-pilot-${this.correlationSequence}`;
      const transition = this.runtime.dispatch(
        canonicalEvent, this.syncPayload(event, nativeBefore), correlationId,
      );
      for (let index = 0; index < transition.effects.length; index += 1) {
        this.lastEffectTypes.push(transition.effects[index].type);
      }
      this.metrics.observedEffects += transition.effects.length;
      if (transition.effects.length !== 1) {
        throw new Error(`${canonicalEvent} must emit exactly one next Core effect, got ${transition.effects.length}`);
      }
      const jsonPayload = transition.effects[0].jsonPayload;
      if (jsonPayload === undefined) throw new Error(`${canonicalEvent} effect is missing lossless jsonPayload`);
      executor.start(correlationId, jsonPayload, transition.effects[0]);
      this.metrics.admittedTransactions += 1;
      return { handled: true, succeeded: true, canonicalEvent: canonicalEvent, correlationId: correlationId };
    } catch (error) {
      // Fail-closed: cancel the executor's correlation (if any) so a partially
      // admitted transaction cannot leak into the legacy ReaderEffects sync
      // path. No orphan ledger remains.
      if (correlationId.length > 0) {
        executor.cancel(correlationId);
      }
      this.metrics.pilotFailure += 1;
      this.metrics.runtimeError += 1;
      this.metrics.lastRuntimeError = (error as Error).message;
      return { handled: true, succeeded: false, canonicalEvent: canonicalEvent, correlationId: '' };
    }
  }

  observe(event: UiEvent, nativeBefore: ReaderUiState, nativeAfter: ReaderUiState): void {
    this.metrics.lastEvent = event.type;
    this.metrics.lastCanonicalEvent = '';
    this.metrics.lastRuntimeError = '';
    this.metrics.lastMismatch = '';
    this.lastEffectTypes = [];

    try {
      const canonicalEvent = this.canonicalEvent(event, nativeBefore);
      this.metrics.lastCanonicalEvent = canonicalEvent;
      if (canonicalEvent.length === 0) {
        this.metrics.fallback += 1;
        this.resyncIfNeeded(nativeAfter);
        return;
      }

      this.metrics.covered += 1;
      if (GENERATED_RUNTIME_ACTIONS[canonicalEvent] === undefined) {
        this.recordRuntimeError(`GENERATED_RUNTIME_ACTIONS missing ${canonicalEvent}`, nativeAfter);
        return;
      }

      this.correlationSequence += 1;
      const correlationId = `harmony-shadow-${this.correlationSequence}`;
      const transition: ReaderUITransition = this.runtime.dispatch(
        canonicalEvent,
        this.payload(event),
        correlationId,
      );
      for (let index = 0; index < transition.effects.length; index += 1) {
        this.lastEffectTypes.push(transition.effects[index].type);
      }
      this.metrics.observedEffects += transition.effects.length;
      // Deliberately no executor call here. ReaderEffects remains the sole
      // production effect path throughout shadow rollout.

      const mismatch = stateDifference(transition.state, projectNativeState(nativeAfter));
      if (mismatch.length > 0) {
        this.metrics.mismatch += 1;
        this.metrics.lastMismatch = mismatch;
      }
    } catch (error) {
      this.recordRuntimeError((error as Error).message, nativeAfter);
    }
  }

  snapshot(): ReaderUIRuntimeShadowSnapshot {
    const bookEffects = this.bookOpenExecutor === null ? 0 : this.bookOpenExecutor.snapshot().executedEffects;
    const playbackEffects = this.playbackExecutor === null ? 0 : this.playbackExecutor.snapshot().executedEffects;
    const importEffects = this.importExecutor === null ? 0 : this.importExecutor.snapshot().executedEffects;
    const sourceSwitchEffects = this.sourceSwitchExecutor === null
      ? 0 : this.sourceSwitchExecutor.snapshot().executedEffects;
    const replaceRuleEffects = this.replaceRuleExecutor === null
      ? 0 : this.replaceRuleExecutor.snapshot().executedEffects;
    const rssEffects = this.rssExecutor === null
      ? 0 : this.rssExecutor.snapshot().executedEffects;
    const syncEffects = this.syncExecutor === null
      ? 0 : this.syncExecutor.snapshot().executedEffects;
    const actualExecutedEffects = this.metrics.executedEffects +
      bookEffects + playbackEffects + importEffects + sourceSwitchEffects + replaceRuleEffects +
      rssEffects + syncEffects;
    return {
      runtimeState: this.runtime.state,
      metrics: {
        covered: this.metrics.covered,
        fallback: this.metrics.fallback,
        pilot: this.metrics.pilot,
        pilotFailure: this.metrics.pilotFailure,
        pilotStateChanges: this.metrics.pilotStateChanges,
        runtimeError: this.metrics.runtimeError,
        mismatch: this.metrics.mismatch,
        observedEffects: this.metrics.observedEffects,
        admittedTransactions: this.metrics.admittedTransactions,
        executedEffects: actualExecutedEffects,
        resync: this.metrics.resync,
        lastEvent: this.metrics.lastEvent,
        lastCanonicalEvent: this.metrics.lastCanonicalEvent,
        lastRuntimeError: this.metrics.lastRuntimeError,
        lastMismatch: this.metrics.lastMismatch,
      },
      lastEffectTypes: this.lastEffectTypes.slice(),
    };
  }

  private playbackCanonicalEvent(event: UiEvent, nativeBefore: ReaderUiState): string {
    const normalized = event.type.replace(/\./g, '-');
    const active = this.playbackPilotSnapshot();
    if ((normalized === 'reader-exit' ||
      (normalized === 'route-pop' && nativeBefore.routeId === 'immersive-reading')) &&
      (active.activePageCorrelationId.length > 0 || active.activeTtsCorrelationId.length > 0 ||
        active.activeAutoPageCorrelationId.length > 0)) return 'reader.exit';
    if (normalized === 'reader-page-next') return 'reader.page.next';
    if (normalized === 'reader-page-prev') return 'reader.page.prev';
    if (normalized === 'reader-tts-start') return 'reader.tts.start';
    if (normalized === 'reader-tts-stop') return 'reader.tts.stop';
    if (normalized === 'reader-autoPage-start' || normalized === 'reader-auto-page-start') {
      return 'reader.autoPage.start';
    }
    if (normalized === 'reader-autoPage-stop' || normalized === 'reader-auto-page-stop') {
      return 'reader.autoPage.stop';
    }
    if (normalized === 'tts-toggle') {
      return this.runtime.state.ttsTransaction === undefined ? 'reader.tts.start' : 'reader.tts.stop';
    }
    if (normalized === 'auto-page-toggle') {
      return this.runtime.state.autoPageTransaction === undefined
        ? 'reader.autoPage.start' : 'reader.autoPage.stop';
    }
    return '';
  }

  private playbackCommitBoundaryMutation(event: UiEvent): string {
    if (this.runtime.state.pageTransaction?.stage !== 'persisting-progress') return '';
    let canonical = event.type;
    if (GENERATED_RUNTIME_ACTIONS[canonical] === undefined) {
      const normalized = event.type.replace(/\./g, '-');
      if (normalized === 'route-push') canonical = 'route.push';
      else if (normalized === 'route-replace') canonical = 'route.replace';
      else if (normalized === 'route-pop') canonical = 'route.pop';
      else if (normalized === 'route-pop-to-root') canonical = 'route.popToRoot';
      else if (normalized === 'switch-tab') canonical = 'mainTab.select';
      else return '';
    }
    const descriptor = GENERATED_RUNTIME_ACTIONS[canonical];
    if (descriptor === undefined) return '';
    const blockedActions = [
      'pushRoute', 'replaceRoute', 'popRoute', 'popToRoot', 'selectTab', 'bookOpenSequence',
    ];
    return blockedActions.indexOf(descriptor.action) >= 0 ? canonical : '';
  }

  private playbackCommitBoundaryPayload(canonicalEvent: string,
    event: UiEvent): ReaderUIJSONPayload {
    if (event.readerUIJSONPayload !== undefined) return event.readerUIJSONPayload;
    const payload: ReaderUIJSONPayload = {};
    if (canonicalEvent === 'route.push' || canonicalEvent === 'route.replace') {
      if (event.id !== undefined) payload['routeId'] = event.id;
    } else if (canonicalEvent === 'mainTab.select') {
      if (event.tab !== undefined) payload['tab'] = event.tab;
    } else {
      if (event.bookId !== undefined) payload['bookId'] = event.bookId;
      if (event.sourceId !== undefined) payload['sourceId'] = event.sourceId;
      if (event.sourceKind !== undefined) payload['sourceKind'] = event.sourceKind;
    }
    return payload;
  }

  private playbackPairEnabled(canonicalEvent: string): boolean {
    if (canonicalEvent === 'reader.page.next' || canonicalEvent === 'reader.page.prev') {
      return this.pagePilotEnabled;
    }
    if (canonicalEvent === 'reader.tts.start' || canonicalEvent === 'reader.tts.stop') {
      return this.ttsPilotEnabled;
    }
    if (canonicalEvent === 'reader.autoPage.start' || canonicalEvent === 'reader.autoPage.stop') {
      return this.autoPagePilotEnabled;
    }
    return canonicalEvent === 'reader.exit' &&
      (this.pagePilotEnabled || this.ttsPilotEnabled || this.autoPagePilotEnabled);
  }

  private playbackStartsTransaction(canonicalEvent: string): boolean {
    return canonicalEvent === 'reader.page.next' || canonicalEvent === 'reader.page.prev' ||
      canonicalEvent === 'reader.tts.start' || canonicalEvent === 'reader.autoPage.start';
  }

  private playbackKind(canonicalEvent: string): ReaderPlaybackPilotKind {
    if (canonicalEvent === 'reader.tts.start') return 'tts';
    if (canonicalEvent === 'reader.autoPage.start') return 'auto-page';
    return 'page';
  }

  private activePlaybackCorrelation(canonicalEvent: string): string {
    if (canonicalEvent === 'reader.tts.stop') {
      return this.runtime.state.ttsTransaction?.correlationId ?? '';
    }
    if (canonicalEvent === 'reader.autoPage.stop') {
      return this.runtime.state.autoPageTransaction?.correlationId ?? '';
    }
    return '';
  }

  private playbackPayload(canonicalEvent: string, nativeBefore: ReaderUiState): ReaderUIJSONPayload {
    const payload: ReaderUIJSONPayload = {};
    if (canonicalEvent === 'reader.tts.start') {
      if (nativeBefore.ttsSession.voice.trim().length > 0) {
        payload['voice'] = nativeBefore.ttsSession.voice;
      }
    }
    if (canonicalEvent === 'reader.autoPage.start') {
      payload['intervalMs'] = Math.max(250, nativeBefore.autoPageSession.intervalSeconds * 1000);
    }
    return payload;
  }

  private isCovered(event: string): boolean {
    return READER_UI_SHADOW_COVERED_EVENTS.indexOf(event) >= 0;
  }

  private directoryPilotEvent(event: UiEvent, nativeBefore: ReaderUiState): string {
    if (event.type === 'reader.directory.open' || event.type === 'reader.directory.close') {
      return event.type;
    }

    const normalized = event.type.replace(/\./g, '-');
    if (normalized === 'reader-module-switch' && event.module === 'directory') {
      return 'reader.directory.open';
    }
    if (normalized === 'route-pop' && nativeBefore.routeId === DIRECTORY_OVERLAY_ROUTE &&
      this.runtime.state.overlay === 'directory') {
      return 'reader.directory.close';
    }
    return '';
  }

  private isBookOpenPilotEvent(event: UiEvent, nativeBefore: ReaderUiState): boolean {
    const normalized = event.type.replace(/\./g, '-');
    return (event.type === 'book.open' || normalized === 'bookshelf-book-open') &&
      this.isDirectImmersiveReaderEntry(event, nativeBefore);
  }

  private isBookOpenBackEvent(event: UiEvent, nativeBefore: ReaderUiState): boolean {
    const normalized = event.type.replace(/\./g, '-');
    if (normalized === 'reader-exit') return true;
    // A control-layer pop only returns to the immersive surface; it must not
    // discard a still-running book.open. The immersive pop is the actual exit.
    return normalized === 'route-pop' && nativeBefore.routeId === 'immersive-reading';
  }

  private isImportPilotEvent(event: UiEvent, _nativeBefore: ReaderUiState): boolean {
    const normalized = event.type.replace(/\./g, '-');
    // Native aliases for import.start: local-import-parse-start signals the
    // beginning of a local-book parse. source-import-apply is the native alias
    // for import.apply. Import cancellation uses import.cancel directly.
    if (event.type === 'import.start' || event.type === 'import.apply' ||
      event.type === 'import.cancel') return true;
    if (normalized === 'local-import-parse-start') return true;
    if (normalized === 'source-import-apply') return true;
    if (normalized === 'source-package-import-json' ||
      normalized === 'source-package-import-url' ||
      normalized === 'source-package-import-clipboard') return true;
    return false;
  }

  private importCanonicalEvent(event: UiEvent): string {
    const normalized = event.type.replace(/\./g, '-');
    if (event.type === 'import.start' || event.type === 'import.apply' ||
      event.type === 'import.cancel') return event.type;
    if (normalized === 'local-import-parse-start' ||
      normalized === 'source-package-import-json' ||
      normalized === 'source-package-import-url' ||
      normalized === 'source-package-import-clipboard') return 'import.start';
    if (normalized === 'source-import-apply') return 'import.apply';
    return '';
  }

  private importPayload(event: UiEvent, _nativeBefore: ReaderUiState): ReaderUIJSONPayload {
    if (event.readerUIJSONPayload !== undefined) return event.readerUIJSONPayload;
    const payload: ReaderUIJSONPayload = {};
    if (event.bookId !== undefined) payload['bookId'] = event.bookId;
    if (event.sourceImportOrigin !== undefined) payload['origin'] = event.sourceImportOrigin;
    if (event.importFormat !== undefined) payload['format'] = event.importFormat;
    if (event.importCount !== undefined) payload['importCount'] = event.importCount;
    if (event.sourceImportPayload !== undefined) payload['bytesBase64'] = event.sourceImportPayload;
    if (event.sourceImportUrl !== undefined) payload['text'] = event.sourceImportUrl;
    return payload;
  }

  private isSourceSwitchPilotEvent(event: UiEvent, nativeBefore: ReaderUiState): boolean {
    // The runtime Pilot is a second line of defense, not an authority to turn
    // a local import into a remote-source replacement transaction.
    if (isLocalBookSourceId(nativeBefore.currentBook?.sourceId)) return false;
    // Canonical runtime events for the source switch Pilot.
    if (event.type === 'source.switch.open' || event.type === 'source.switch.cancel' ||
      event.type === 'source.switch.confirm' || event.type === 'source.switch.rollback' ||
      event.type === 'reader.sourceSwitch.open' || event.type === 'reader.sourceSwitch.close') {
      return true;
    }
    // Native aliases: source-switch-confirm/cancel are the legacy reducer
    // events that map to the runtime source.switch.confirm/cancel canonicals.
    const normalized = event.type.replace(/\./g, '-');
    if (normalized === 'source-switch-confirm') return true;
    if (normalized === 'source-switch-cancel') return true;
    return false;
  }

  private sourceSwitchCanonicalEvent(event: UiEvent, nativeBefore: ReaderUiState): string {
    if (event.type === 'source.switch.open' || event.type === 'source.switch.cancel' ||
      event.type === 'source.switch.confirm' || event.type === 'source.switch.rollback' ||
      event.type === 'reader.sourceSwitch.open' || event.type === 'reader.sourceSwitch.close') {
      return event.type;
    }
    const normalized = event.type.replace(/\./g, '-');
    // Native alias source-switch-confirm drives the effectful commit path.
    if (normalized === 'source-switch-confirm') return 'source.switch.confirm';
    // Native alias source-switch-cancel maps to the overlay/route cancel event.
    if (normalized === 'source-switch-cancel') {
      // When the route is the legacy source-switch stack entry, prefer the
      // runtime route pop (source.switch.cancel); otherwise the overlay close
      // (reader.sourceSwitch.close) is the canonical event.
      return nativeBefore.routeId === 'source-switch' ? 'source.switch.cancel' : 'reader.sourceSwitch.close';
    }
    return '';
  }

  private sourceSwitchPayload(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIJSONPayload {
    if (event.readerUIJSONPayload !== undefined) return event.readerUIJSONPayload;
    const payload: ReaderUIJSONPayload = {};
    if (event.bookId !== undefined) payload['bookId'] = event.bookId;
    // Canonical source.switch.confirm carries sourceId directly. Native UI
    // aliases bind the current radio selection from state.
    if (event.sourceId !== undefined && event.sourceId.trim().length > 0) {
      payload['selectedSourceId'] = event.sourceId.trim();
    } else if (nativeBefore.sourceSelection.length === 1) {
      payload['selectedSourceId'] = nativeBefore.sourceSelection[0];
    }
    const currentBook = nativeBefore.currentBook;
    if (currentBook !== null) {
      const previousSourceId = (currentBook.sourceId ?? '').trim();
      if (previousSourceId.length > 0) payload['previousSourceId'] = previousSourceId;
      if (currentBook.bookId.length > 0) payload['previousBookId'] = currentBook.bookId;
    }
    return payload;
  }

  private isReplaceRulePilotEvent(event: UiEvent, _nativeBefore: ReaderUiState): boolean {
    // Canonical runtime events for the replace rules Pilot.
    if (event.type === 'reader.replace.apply' || event.type === 'reader.replace.create' ||
      event.type === 'reader.replace.validate') {
      return true;
    }
    // Native aliases: replace-rule-add/edit/toggle/delete-confirm are the
    // legacy reducer events that map to the runtime reader.replace.* canonicals.
    const normalized = event.type.replace(/\./g, '-');
    if (normalized === 'replace-rule-add') return true;
    if (normalized === 'replace-rule-edit') return true;
    if (normalized === 'replace-rule-toggle') return true;
    if (normalized === 'replace-rule-delete-confirm') return true;
    if (normalized === 'replace-rule-validate') return true;
    return false;
  }

  private replaceRuleCanonicalEvent(event: UiEvent, nativeBefore: ReaderUiState): string {
    if (event.type === 'reader.replace.apply' || event.type === 'reader.replace.create' ||
      event.type === 'reader.replace.validate') {
      return event.type;
    }
    const normalized = event.type.replace(/\./g, '-');
    // Native alias replace-rule-add drives the create/persist path.
    if (normalized === 'replace-rule-add') return 'reader.replace.create';
    // Native alias replace-rule-validate drives the validate path.
    if (normalized === 'replace-rule-validate') return 'reader.replace.validate';
    // Native aliases replace-rule-edit, replace-rule-toggle, and
    // replace-rule-delete-confirm all drive the apply path. The action field
    // in the payload distinguishes update/toggle/delete.
    if (normalized === 'replace-rule-edit') return 'reader.replace.apply';
    if (normalized === 'replace-rule-toggle') return 'reader.replace.apply';
    if (normalized === 'replace-rule-delete-confirm') return 'reader.replace.apply';
    // Unused canonical to satisfy the compiler's return-path analysis.
    return '';
  }

  private replaceRulePayload(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIJSONPayload {
    if (event.readerUIJSONPayload !== undefined) return event.readerUIJSONPayload;
    const payload: ReaderUIJSONPayload = {};
    const normalized = event.type.replace(/\./g, '-');
    // Create path: pattern/replacement/scope from the event.
    if (event.type === 'reader.replace.create' || normalized === 'replace-rule-add') {
      payload['action'] = 'create';
      if (event.replaceRulePattern !== undefined) payload['pattern'] = event.replaceRulePattern;
      if (event.replaceRuleReplacement !== undefined) payload['replacement'] = event.replaceRuleReplacement;
      if (event.replaceRuleScope !== undefined) payload['scope'] = event.replaceRuleScope;
      return payload;
    }
    // Validate path: pattern/replacement/scope from the event.
    if (event.type === 'reader.replace.validate' || normalized === 'replace-rule-validate') {
      payload['action'] = 'validate';
      if (event.replaceRulePattern !== undefined) payload['pattern'] = event.replaceRulePattern;
      if (event.replaceRuleReplacement !== undefined) payload['replacement'] = event.replaceRuleReplacement;
      if (event.replaceRuleScope !== undefined) payload['scope'] = event.replaceRuleScope;
      return payload;
    }
    // Apply path: distinguish update/toggle/delete by the native event type.
    if (normalized === 'replace-rule-delete-confirm') {
      payload['action'] = 'delete';
      // The delete target is read from state (not the event) so a caller
      // cannot swap a target between selection and confirmation.
      payload['ruleId'] = nativeBefore.pendingReplaceRuleDeleteId;
      return payload;
    }
    if (normalized === 'replace-rule-toggle') {
      payload['action'] = 'toggle';
      const id = event.replaceRuleId ?? '';
      payload['ruleId'] = id;
      // Toggle reads the current rule fields from state so the Core update
      // carries the full field set with the flipped enabled value.
      for (let i = 0; i < nativeBefore.replaceRules.length; i += 1) {
        const rule = nativeBefore.replaceRules[i];
        if (rule.id === id) {
          payload['pattern'] = rule.pattern;
          payload['replacement'] = rule.replacement;
          payload['scope'] = rule.scope;
          payload['enabled'] = !rule.enabled;
          return payload;
        }
      }
      return payload;
    }
    // Default apply path (replace-rule-edit or canonical reader.replace.apply).
    payload['action'] = 'update';
    if (event.replaceRuleId !== undefined) payload['ruleId'] = event.replaceRuleId;
    if (event.replaceRulePattern !== undefined) payload['pattern'] = event.replaceRulePattern;
    if (event.replaceRuleReplacement !== undefined) payload['replacement'] = event.replaceRuleReplacement;
    if (event.replaceRuleScope !== undefined) payload['scope'] = event.replaceRuleScope;
    // Read the current enabled flag from state so the update preserves it.
    const editId = event.replaceRuleId ?? '';
    for (let i = 0; i < nativeBefore.replaceRules.length; i += 1) {
      if (nativeBefore.replaceRules[i].id === editId) {
        payload['enabled'] = nativeBefore.replaceRules[i].enabled;
        break;
      }
    }
    return payload;
  }

  private isRssPilotEvent(event: UiEvent, _nativeBefore: ReaderUiState): boolean {
    // Canonical runtime events for the RSS Pilot.
    if (event.type === 'rss.refresh' || event.type === 'rss.subscription.add' ||
      event.type === 'rss.subscription.delete' || event.type === 'rss.subscription.edit' ||
      event.type === 'rss.entry.open' || event.type === 'rss.favorite.add' ||
      event.type === 'rss.favorite.remove') {
      return true;
    }
    // Native aliases: rss-subscription-add/update/delete, rss-item-open,
    // rss-refresh, rss-favorite-add/remove are the legacy reducer events that
    // map to the runtime rss.* canonicals.
    const normalized = event.type.replace(/\./g, '-');
    if (normalized === 'rss-subscription-add') return true;
    if (normalized === 'rss-subscription-update') return true;
    if (normalized === 'rss-subscription-delete-confirm') return true;
    if (normalized === 'rss-subscription-delete') return true;
    if (normalized === 'rss-item-open') return true;
    if (normalized === 'rss-refresh') return true;
    if (normalized === 'rss-favorite-add') return true;
    if (normalized === 'rss-favorite-remove') return true;
    return false;
  }

  private rssCanonicalEvent(event: UiEvent, nativeBefore: ReaderUiState): string {
    if (event.type === 'rss.refresh' || event.type === 'rss.subscription.add' ||
      event.type === 'rss.subscription.delete' || event.type === 'rss.subscription.edit' ||
      event.type === 'rss.entry.open' || event.type === 'rss.favorite.add' ||
      event.type === 'rss.favorite.remove') {
      return event.type;
    }
    const normalized = event.type.replace(/\./g, '-');
    if (normalized === 'rss-subscription-add') return 'rss.subscription.add';
    if (normalized === 'rss-subscription-update') return 'rss.subscription.edit';
    if (normalized === 'rss-subscription-delete-confirm') return 'rss.subscription.delete';
    if (normalized === 'rss-subscription-delete') {
      // The unconfirmed delete event is rejected by the coordinator; only the
      // confirm alias drives the effectful delete path. Returning empty keeps
      // the coordinator fail-closed for the unconfirmed event.
      return nativeBefore.routeId === 'rss-source-delete-confirm'
        ? 'rss.subscription.delete' : '';
    }
    if (normalized === 'rss-item-open') return 'rss.entry.open';
    if (normalized === 'rss-refresh') return 'rss.refresh';
    if (normalized === 'rss-favorite-add') return 'rss.favorite.add';
    if (normalized === 'rss-favorite-remove') return 'rss.favorite.remove';
    return '';
  }

  private rssPayload(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIJSONPayload {
    if (event.readerUIJSONPayload !== undefined) return event.readerUIJSONPayload;
    const payload: ReaderUIJSONPayload = {};
    const normalized = event.type.replace(/\./g, '-');
    // rss.refresh: subscriptionId from the event (if present) or the first
    // enabled subscription in state.
    if (event.type === 'rss.refresh' || normalized === 'rss-refresh') {
      payload['action'] = 'refresh';
      const subscriptionId = event.rssSubscriptionId ?? '';
      if (subscriptionId.length > 0) {
        payload['subscriptionId'] = subscriptionId;
      } else if (nativeBefore.rssSubscriptions.length > 0) {
        payload['subscriptionId'] = nativeBefore.rssSubscriptions[0].subscriptionId;
      }
      return payload;
    }
    // rss.subscription.add: feedUrl/title/enabled from the event.
    if (event.type === 'rss.subscription.add' || normalized === 'rss-subscription-add') {
      payload['action'] = 'subscription.add';
      const subscriptionId = (event.rssSubscriptionId ?? '').trim();
      payload['subscriptionId'] = subscriptionId.length > 0 ? subscriptionId : `rss-${Date.now()}`;
      if (event.rssFeedUrl !== undefined) payload['feedUrl'] = event.rssFeedUrl.trim();
      if (event.rssTitle !== undefined) payload['title'] = event.rssTitle.trim();
      payload['enabled'] = event.rssEnabled !== false;
      return payload;
    }
    // rss.subscription.edit: subscriptionId + optional fields from the event.
    if (event.type === 'rss.subscription.edit' || normalized === 'rss-subscription-update') {
      payload['action'] = 'subscription.edit';
      payload['subscriptionId'] = (event.rssSubscriptionId ?? '').trim();
      if (event.rssFeedUrl !== undefined) payload['feedUrl'] = event.rssFeedUrl.trim();
      if (event.rssTitle !== undefined) payload['title'] = event.rssTitle.trim();
      if (event.rssEnabled !== undefined) payload['enabled'] = event.rssEnabled;
      return payload;
    }
    // rss.subscription.delete: subscriptionId from the event or pending state.
    if (event.type === 'rss.subscription.delete' || normalized === 'rss-subscription-delete-confirm') {
      payload['action'] = 'subscription.delete';
      const subscriptionId = (event.rssSubscriptionId ?? '').trim();
      payload['subscriptionId'] = subscriptionId.length > 0
        ? subscriptionId : nativeBefore.pendingRssSubscriptionDeleteId;
      return payload;
    }
    // rss.entry.open: guid + subscriptionId from the event.
    if (event.type === 'rss.entry.open' || normalized === 'rss-item-open') {
      payload['action'] = 'entry.open';
      payload['guid'] = event.rssGuid ?? '';
      payload['subscriptionId'] = event.rssSubscriptionId ?? '';
      return payload;
    }
    // rss.favorite.add: guid + subscriptionId + title + link from the event.
    if (event.type === 'rss.favorite.add' || normalized === 'rss-favorite-add') {
      payload['action'] = 'favorite.add';
      payload['guid'] = event.rssGuid ?? '';
      payload['subscriptionId'] = event.rssSubscriptionId ?? '';
      if (event.rssTitle !== undefined) payload['title'] = event.rssTitle;
      return payload;
    }
    // rss.favorite.remove: guid + subscriptionId from the event.
    if (event.type === 'rss.favorite.remove' || normalized === 'rss-favorite-remove') {
      payload['action'] = 'favorite.remove';
      payload['guid'] = event.rssGuid ?? '';
      payload['subscriptionId'] = event.rssSubscriptionId ?? '';
      return payload;
    }
    return payload;
  }

  private isSyncPilotEvent(event: UiEvent, _nativeBefore: ReaderUiState): boolean {
    // Canonical runtime events recognized by the disabled Sync experiment.
    if (event.type === 'sync.run' || event.type === 'webdav.config.test' ||
      event.type === 'sync.start' || event.type === 'sync.progress' ||
      event.type === 'sync.complete' || event.type === 'sync.conflict' ||
      event.type === 'sync.resolve') {
      return true;
    }
    // Native aliases: sync-run, webdav-config-test, sync-start, sync-progress,
    // sync-complete, sync-conflict, sync-resolve are the legacy reducer events
    // that map to the runtime sync.* / webdav.config.* canonicals.
    const normalized = event.type.replace(/\./g, '-');
    if (normalized === 'sync-run') return true;
    if (normalized === 'webdav-config-test') return true;
    if (normalized === 'sync-start') return true;
    if (normalized === 'sync-progress') return true;
    if (normalized === 'sync-complete') return true;
    if (normalized === 'sync-conflict') return true;
    if (normalized === 'sync-resolve') return true;
    return false;
  }

  private syncCanonicalEvent(event: UiEvent, _nativeBefore: ReaderUiState): string {
    if (event.type === 'sync.run' || event.type === 'webdav.config.test' ||
      event.type === 'sync.start' || event.type === 'sync.progress' ||
      event.type === 'sync.complete' || event.type === 'sync.conflict' ||
      event.type === 'sync.resolve') {
      return event.type;
    }
    const normalized = event.type.replace(/\./g, '-');
    if (normalized === 'sync-run') return 'sync.run';
    if (normalized === 'webdav-config-test') return 'webdav.config.test';
    if (normalized === 'sync-start') return 'sync.start';
    if (normalized === 'sync-progress') return 'sync.progress';
    if (normalized === 'sync-complete') return 'sync.complete';
    if (normalized === 'sync-conflict') return 'sync.conflict';
    if (normalized === 'sync-resolve') return 'sync.resolve';
    return '';
  }

  private syncPayload(event: UiEvent, nativeBefore: ReaderUiState): ReaderUIJSONPayload {
    if (event.readerUIJSONPayload !== undefined) return event.readerUIJSONPayload;
    const payload: ReaderUIJSONPayload = {};
    const normalized = event.type.replace(/\./g, '-');
    const canonical = this.syncCanonicalEvent(event, nativeBefore);
    // Map canonical events to action identifiers consumed by the executor.
    if (canonical === 'sync.run' || normalized === 'sync-run') {
      payload['action'] = 'run';
    } else if (canonical === 'webdav.config.test' || normalized === 'webdav-config-test') {
      payload['action'] = 'config.test';
      if (nativeBefore.webdavServerUrl.length > 0) payload['serverUrl'] = nativeBefore.webdavServerUrl;
      if (nativeBefore.webdavUsername.length > 0) payload['username'] = nativeBefore.webdavUsername;
      if (nativeBefore.webdavPassword.length > 0) payload['password'] = nativeBefore.webdavPassword;
    } else if (canonical === 'sync.start' || normalized === 'sync-start') {
      payload['action'] = 'start';
    } else if (canonical === 'sync.progress' || normalized === 'sync-progress') {
      payload['action'] = 'progress';
      if (event.value !== undefined) payload['progress'] = event.value;
    } else if (canonical === 'sync.complete' || normalized === 'sync-complete') {
      payload['action'] = 'complete';
      if (event.success !== undefined) payload['success'] = event.success;
    } else if (canonical === 'sync.conflict' || normalized === 'sync-conflict') {
      payload['action'] = 'conflict';
      if (event.message !== undefined) payload['conflict'] = event.message;
    } else if (canonical === 'sync.resolve' || normalized === 'sync-resolve') {
      payload['action'] = 'resolve';
      if (event.message !== undefined) payload['resolution'] = event.message;
    }
    return payload;
  }

  // Adapter-only native aliases. Runtime semantics remain generated upstream.
  private canonicalEvent(event: UiEvent, nativeBefore: ReaderUiState): string {
    // `book.open` has an unusually broad legacy alias (`bookshelf-book-open`).
    // Do not let a detail-page fetch, a fabricated event, or a stale source
    // identity create a shadow transaction that looks like an immersive reader
    // entry. The only eligible input is the explicit bookshelf reader CTA.
    if (event.type === 'book.open') {
      return this.isDirectImmersiveReaderEntry(event, nativeBefore) ? 'book.open' : '';
    }
    if (event.type !== 'reader.directory.open' && event.type !== 'reader.directory.close' &&
      this.isCovered(event.type)) return event.type;

    const normalized = event.type.replace(/\./g, '-');
    if (normalized === 'bookshelf-book-open' && this.isDirectImmersiveReaderEntry(event, nativeBefore)) {
      return 'book.open';
    }
    if (normalized === 'tts-toggle' && nativeBefore.activeSession !== 'tts') {
      return 'reader.tts.start';
    }
    if (normalized === 'auto-page-toggle' && nativeBefore.activeSession !== 'auto-page') {
      return 'reader.autoPage.start';
    }
    return '';
  }

  /**
   * A `bookshelf-book-open` is also used to fetch a normal detail page. The
   * contract runtime must only observe the narrow CTA that enters the
   * immersive reader directly. `sourceKind` is derived by the real shelf CTA
   * from Core's source id; validating that relationship prevents a local book
   * from being sent through the remote sequence (or vice versa).
   */
  private isDirectImmersiveReaderEntry(event: UiEvent, nativeBefore: ReaderUiState): boolean {
    if (event.readerEntry !== true || event.bookId === undefined || event.bookId.length === 0 ||
      event.sourceId === undefined || event.sourceId.length === 0) {
      return false;
    }
    const directEntryRoute = nativeBefore.routeId === 'bookshelf' ||
      nativeBefore.routeId === 'bookshelf-cover-mode' ||
      nativeBefore.routeId === 'bookshelf-list-mode';
    // A second explicit CTA can arrive while the first pointer transaction is
    // still entering immersive-reading. Treat that as a superseding reader
    // intent, not as a detail-page alias; the runtime returns the cancelled
    // correlation id and the executor cancels its exact CoreCommandHandle.
    const activePilotSupersede = this.bookOpenPilotEnabled && this.bookOpenExecutor !== null &&
      this.bookOpenExecutor.hasActiveCorrelation();
    if (!directEntryRoute && !activePilotSupersede) return false;
    const actualSourceKind = event.sourceId === 'local' ? 'local' : 'remote';
    return event.sourceKind === actualSourceKind;
  }

  private payload(event: UiEvent): ReaderUIJSONPayload {
    if (event.readerUIJSONPayload !== undefined) return event.readerUIJSONPayload;
    const payload: ReaderUIJSONPayload = {};
    if (event.bookId !== undefined) payload['bookId'] = event.bookId;
    if (event.sourceId !== undefined) payload['sourceId'] = event.sourceId;
    if (event.sourceKind !== undefined) payload['sourceKind'] = event.sourceKind;
    if (event.chapterIndex !== undefined) payload['chapterIndex'] = event.chapterIndex;
    return payload;
  }

  private recordRuntimeError(message: string, nativeAfter: ReaderUiState): void {
    this.metrics.runtimeError += 1;
    this.metrics.lastRuntimeError = message;
    this.resyncIfNeeded(nativeAfter);
  }

  private resyncIfNeeded(nativeState: ReaderUiState): void {
    const projected = projectNativeState(nativeState);
    if (stateDifference(this.runtime.state, projected).length === 0) return;
    const playback = this.playbackPilotSnapshot();
    const importActive = this.importExecutor !== null && this.importExecutor.hasActiveCorrelation();
    const sourceSwitchActive = this.sourceSwitchExecutor !== null &&
      this.sourceSwitchExecutor.hasActiveCorrelation();
    const replaceRuleActive = this.replaceRuleExecutor !== null &&
      this.replaceRuleExecutor.hasActiveCorrelation();
    const rssActive = this.rssExecutor !== null && this.rssExecutor.hasActiveCorrelation();
    const syncActive = this.syncExecutor !== null && this.syncExecutor.hasActiveCorrelation();
    if ((this.bookOpenExecutor !== null && this.bookOpenExecutor.hasActiveCorrelation()) ||
      importActive || sourceSwitchActive || replaceRuleActive || rssActive || syncActive ||
      playback.activePageCorrelationId.length > 0 || playback.activeTtsCorrelationId.length > 0 ||
      playback.activeAutoPageCorrelationId.length > 0) {
      // Replacing the driver would erase the shared transaction while its
      // request-scoped executor still owns Core/speech/timer handles. Native
      // fallback events may update unrelated fields, but cannot resynchronize
      // transaction-owned runtime state until the Pilot reaches a terminal.
      return;
    }
    this.runtime = new GeneratedReaderUIRuntimeDriver(projected);
    this.metrics.resync += 1;
  }
}
