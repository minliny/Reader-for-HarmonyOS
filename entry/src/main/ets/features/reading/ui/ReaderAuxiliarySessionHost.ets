import type { ReaderControlPlaybackSourceMinimum } from './ReaderControlGeometryHost';
import type { ReaderControlLaunchSource } from './ReaderControlPanelNativeContract';
import type { UIContext } from '@ohos.arkui.UIContext';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { READER_CONTROL_OPEN_MS } from '../../../ui/foundation/ProductMotionTiming';
import { readerBeginTransition, readerTransitionsEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { readerTransitionLaunchNodes } from '../../../ui/layout/TransitionInvariantEvaluator';
import { ReadingAuxiliaryCapsuleMeasurements, type ReadingCapsuleMeasurement } from '../application/ReadingAuxiliaryFlowBridge';
import { createReaderTtsState, type ReaderTtsState } from '../application/ReaderTtsState';
import { ReaderPageChromeSnapshot } from '../presentation/ReaderPageChromeModel';
import type { ReaderControlCapsuleSpeechFacts, ReaderControlCapsuleVerification } from './ReaderControlCapsuleVerification';
import { readerControlMotionMs } from './ReaderControlMotionPolicy';
import { type ReaderControlPlaybackLaunchProfile } from './ReaderControlPlaybackProfile';
import type { ReaderControlPage } from './ReaderControlRouting';
import { copyReaderControlSessionState, createReaderControlSessionState, dismissReaderControlSession,
  readerControlContentLocation, resumeReaderControlSessionTarget,
  type ReaderControlLocation, type ReaderControlSessionState } from './ReaderControlSessionState';
import type { ReaderControlLayoutSnapshot, ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import { ReaderPageChromeMeasurements, resolveReaderPageChromeLayout, type ReaderPageChromeLayoutSnapshot } from './ReaderPageChromeLayout';
import type { ReaderPageTurnRenderPage } from './ReaderPageTurnStage';
import { measureReaderSessionCapsule, type ReaderSessionCapsuleMetrics } from './ReaderSessionCapsule';
import { deriveReaderSessionCapsule, type ReaderSessionCapsuleSnapshot,
  type ReaderSessionCapsuleState, type ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';
import { ReaderSessionLaunchController, type ReaderSessionLaunchCancelReason,
  type ReaderSessionLaunchIdentity, type ReaderSessionLaunchTransaction } from './ReaderSessionLaunchController';
import { READER_SESSION_LAUNCH_CURVES } from './ReaderSessionLaunchCurves';
import { ReaderSessionLaunchEffects } from './ReaderSessionLaunchEffects';
import { buildReaderSessionLaunchGeometry, type ReaderSessionLaunchGeometry,
  type ReaderSessionLaunchSample } from './ReaderSessionLaunchPresentation';
import { ReaderSessionMorphMeasurements, readerSessionMorphSourceKindForPage,
  type ReaderSessionMorphSourceMeasurement } from './ReaderSessionMorphState';
import type { ReaderAutoPageState, ReaderAutoPageStatus } from './ReaderAutoPageState';

export interface ReaderAuxiliarySessionView {
  readonly read: () => ReaderSessionLaunchTransaction | undefined;
  readonly publish: (launch: ReaderSessionLaunchTransaction | undefined) => void;
  readonly publishControlSource: (source: ReaderControlLaunchSource) => void;
  readonly stageOpacity: () => number;
  readonly setStageOpacity: (opacity: number) => void;
  readonly beginFooterExit: (launch: ReaderSessionLaunchTransaction) => void;
  readonly finalizeFooterExit: () => void;
  readonly clearFooterExit: () => void;
  readonly renderChanged: () => void;
}

export interface ReaderAuxiliarySessionControlSurface {
  readonly layoutKey: () => string;
  readonly hide: () => void;
  readonly restore: (duration: number) => void;
}

export interface ReaderAuxiliarySessionEnvironment {
  readonly ready: () => boolean;
  readonly mounted: () => boolean;
  readonly exiting: () => boolean;
  readonly uiContext: () => UIContext;
  readonly viewportRevision: () => number;
  readonly reducedMotion: () => boolean;
  readonly observing: () => boolean;
  readonly drainPageTurn: () => void;
  readonly updateWindow: () => void;
  readonly speechFacts: (launch: ReaderSessionLaunchTransaction) => ReaderControlCapsuleSpeechFacts | undefined;
  readonly automaticStatus: () => ReaderAutoPageStatus;
  readonly retireBusinessStart: (type: ReaderSessionCapsuleType) => void;
}

export interface ReaderAuxiliarySessionLaunch {
  readonly identity: ReaderSessionLaunchIdentity;
  readonly geometry: ReaderSessionLaunchGeometry;
  readonly originLayoutKey: string;
  readonly controlLocation: ReaderControlLocation;
  readonly minimum: (generation: number) => ReaderControlPlaybackLaunchProfile;
}

export interface ReaderAuxiliaryCapsuleRoute {
  readonly lifecycle: number;
  readonly sourceId: string;
  readonly bookId: string;
}

interface ReaderStaticCapsuleOrigin {
  readonly route: ReaderAuxiliaryCapsuleRoute;
  readonly location: ReaderControlLocation;
}

export interface ReaderAuxiliaryCapsuleFreeze {
  readonly frozen: boolean;
  readonly snapshot: ReaderSessionCapsuleSnapshot | undefined;
}

export interface ReaderAuxiliaryCapsulePresentation {
  readonly phase: () => 'loading' | 'measuring' | 'ready' | 'failed';
  readonly hasPaintedBody: () => boolean;
  readonly obscured: () => boolean;
  readonly blocked: () => boolean;
  readonly active: () => boolean;
  readonly freeze: () => ReaderAuxiliaryCapsuleFreeze;
  readonly pageChromeFrozen: () => boolean;
  readonly measurement: () => ReadingCapsuleMeasurement | undefined;
  readonly publishMeasurement: (receipt: ReadingCapsuleMeasurement) => void;
}

export interface ReaderAuxiliaryCapsuleControlRevisions {
  readonly open: number;
  readonly moduleVisit: number;
}

export interface ReaderAuxiliaryCapsuleControl {
  readonly visible: () => boolean;
  readonly closingForCapsule: () => boolean;
  readonly shellExitArmed: () => boolean;
  readonly currentPage: () => ReaderControlPage;
  readonly layout: (revision: number) => ReaderControlLayoutSnapshot;
  readonly revisions: () => ReaderAuxiliaryCapsuleControlRevisions;
  readonly playbackMinimum: (kind: 'tts' | 'autoPage', revision: number) => ReaderControlPlaybackSourceMinimum;
  readonly visualSession: () => ReaderControlSessionState;
  readonly cancelNavigation: () => void;
  readonly invalidateBackdrop: () => void;
  readonly publishRestoredSession: (restored: ReaderControlSessionState) => void;
}

export interface ReaderAuxiliaryCapsuleChromeAnchor {
  readonly chapterIndex: number;
  readonly pageStart: number | undefined;
  readonly clockText: string;
  readonly renderRevision: number;
}

export interface ReaderAuxiliaryCapsuleChrome {
  readonly continuous: () => boolean;
  readonly continuousProgressText: () => string;
  readonly continuousChrome: (progressText: string) => ReaderPageChromeSnapshot;
  readonly currentTurnPage: () => ReaderPageTurnRenderPage;
  readonly presentedAnchor: () => ReaderAuxiliaryCapsuleChromeAnchor;
  readonly presentedPageChrome: () => ReaderPageChromeSnapshot;
}

export interface ReaderAuxiliaryCapsuleLayoutIdentity {
  readonly width: number;
  readonly height: number;
  readonly scheme: string;
  readonly activeTheme: string;
}

export interface ReaderAuxiliaryCapsuleLayout {
  readonly route: () => ReaderAuxiliaryCapsuleRoute;
  readonly identity: () => ReaderAuxiliaryCapsuleLayoutIdentity;
  readonly paginationSignature: () => string;
  readonly readingLayout: () => ReaderReadingLayoutSnapshot;
  readonly epoch: () => number;
  readonly paletteRevision: () => number;
  readonly appearanceGeneration: () => number;
  readonly suspendAdjacent: () => void;
  readonly invalidateTextures: () => void;
}

export interface ReaderAuxiliaryCapsuleActivity {
  readonly automatic: () => Readonly<ReaderAutoPageState>;
  readonly speech: () => ReaderTtsState;
  readonly inputCurrent: () => boolean;
  readonly pageTurnIdle: () => boolean;
  readonly setSpeechDesiredPlaying: (desired: boolean) => void;
  readonly toggleAutoPage: () => void;
  readonly pauseAutoPage: () => void;
  readonly toggleSpeech: () => void;
}

export interface ReaderAuxiliaryCapsulePorts {
  readonly presentation: ReaderAuxiliaryCapsulePresentation;
  readonly control: ReaderAuxiliaryCapsuleControl;
  readonly chrome: ReaderAuxiliaryCapsuleChrome;
  readonly layout: ReaderAuxiliaryCapsuleLayout;
  readonly activity: ReaderAuxiliaryCapsuleActivity;
}

/** Owns the native capsule launch, moving footer and visibility handoff.
 * Only a current transaction can drive an ArkUI frame or restore controls. */
export class ReaderAuxiliarySessionHost {
  private readonly controller: ReaderSessionLaunchController = new ReaderSessionLaunchController(READER_SESSION_LAUNCH_CURVES);
  private readonly effects: ReaderSessionLaunchEffects;
  private readonly verification: ReaderControlCapsuleVerification;
  private readonly view: ReaderAuxiliarySessionView;
  private readonly control: ReaderAuxiliarySessionControlSurface;
  private readonly environment: ReaderAuxiliarySessionEnvironment;
  private readonly capsule: ReaderAuxiliaryCapsulePorts | undefined;
  private readonly capsuleMeasurements: ReadingAuxiliaryCapsuleMeasurements = new ReadingAuxiliaryCapsuleMeasurements();
  private readonly morphMeasurements: ReaderSessionMorphMeasurements = new ReaderSessionMorphMeasurements();
  private layoutKey: string = '';
  private minimumProfile: ReaderControlPlaybackLaunchProfile | undefined = undefined;
  private flightSourceSample: ReaderSessionLaunchSample | undefined = undefined;
  private flightSpeechState: ReaderTtsState = createReaderTtsState(false);
  private flightAutoStatus: ReaderAutoPageStatus = 'stopped';
  private flightControlState: ReaderControlSessionState = createReaderControlSessionState();
  private staticOrigin: ReaderStaticCapsuleOrigin | undefined = undefined;
  private flightChromeAnchor: string = '';
  private flightChrome: ReaderPageChromeSnapshot = new ReaderPageChromeSnapshot('', '', '', '', true, 96, 24);
  private topExit: number = 0;
  private dockExit: number = 0;

  constructor(verification: ReaderControlCapsuleVerification, view: ReaderAuxiliarySessionView,
    control: ReaderAuxiliarySessionControlSurface, environment: ReaderAuxiliarySessionEnvironment,
    capsule?: ReaderAuxiliaryCapsulePorts) {
    this.verification = verification;
    this.view = view;
    this.control = control;
    this.environment = environment;
    this.capsule = capsule;
    this.effects = new ReaderSessionLaunchEffects(this.controller, verification, {
      read: (): ReaderSessionLaunchTransaction | undefined => this.view.read(),
      publish: (launch: ReaderSessionLaunchTransaction): void => this.view.publish(launch),
      ready: (): boolean => this.environment.ready(),
      layoutCurrent: (): boolean => this.layoutCurrent(),
      retireForLayout: (): void => this.cancel('sourceChanged'),
      context: (): UIContext => this.environment.uiContext(),
      observing: (): boolean => this.environment.observing(),
      drainPageTurn: (): void => this.environment.drainPageTurn(),
      hideControl: (): void => this.control.hide(),
      updateWindow: (): void => this.environment.updateWindow(),
      viewportRevision: (): number => this.environment.viewportRevision(),
      reducedMotion: (): boolean => this.environment.reducedMotion(),
      stageOpacity: (): number => this.view.stageOpacity(),
      setStageOpacity: (opacity: number): void => this.view.setStageOpacity(opacity),
      finalizeFooter: (): void => this.view.finalizeFooterExit(),
      finish: (released?: ReaderSessionLaunchTransaction): void => this.finish(released),
    });
  }

  get sourceMinimum(): ReaderControlPlaybackLaunchProfile | undefined { return this.minimumProfile; }

  get sourceSample(): ReaderSessionLaunchSample | undefined { return this.flightSourceSample; }

  admitControlSource(source: ReaderControlLaunchSource): void {
    if (source.generation === this.view.read()?.generation) this.view.publishControlSource(source);
  }

  get sourceTtsState(): ReaderTtsState { return this.flightSpeechState; }
  get sourceAutoStatus(): ReaderAutoPageStatus { return this.flightAutoStatus; }
  get sourceControl(): ReaderControlSessionState { return this.flightControlState; }

  private capsulePorts(): ReaderAuxiliaryCapsulePorts {
    if (this.capsule === undefined) throw new Error('READING_CAPSULE_PORTS_NOT_CONNECTED');
    return this.capsule;
  }

  shouldShowSessionCapsule(): boolean {
    return this.view.read() !== undefined || this.sessionCapsuleSnapshot() !== undefined;
  }

  sessionCapsuleType(): ReaderSessionCapsuleType {
    return this.view.read()?.geometry.type ?? this.sessionCapsuleSnapshot()?.type ?? 'autoPage';
  }

  sessionCapsuleState(): ReaderSessionCapsuleState {
    return this.view.read() !== undefined ? this.sessionLaunchBusinessStatus() :
      this.sessionCapsuleSnapshot()?.sessionState ?? 'paused';
  }

  sessionLaunchBusinessStatus(): ReaderSessionCapsuleState {
    const launch = this.view.read();
    if (launch === undefined) return 'paused';
    if (launch.businessStatus === 'preparing') return 'preparing';
    const activity = this.capsulePorts().activity;
    if (launch.geometry.type === 'autoPage') return activity.automatic().status === 'running' ? 'playing' : 'paused';
    return activity.speech().status === 'playing' ? 'playing' :
      activity.speech().status === 'preparing' || activity.speech().status === 'resuming' ? 'preparing' : 'paused';
  }

  sessionCapsuleCountdown(): number {
    return this.sessionCapsuleSnapshot()?.countdown ?? 0;
  }

  sessionCapsuleSnapshot(): ReaderSessionCapsuleSnapshot | undefined {
    const freeze = this.capsulePorts().presentation.freeze();
    if (freeze.frozen) return freeze.snapshot;
    return this.liveSessionCapsuleSnapshot();
  }

  liveSessionCapsuleSnapshot(ignoreClosingControl: boolean = false): ReaderSessionCapsuleSnapshot | undefined {
    const ports = this.capsulePorts();
    return deriveReaderSessionCapsule({
      mounted: this.environment.mounted(),
      exitRequested: this.environment.exiting(),
      // The visible page remains mounted while a hidden neighbour is measured.
      pageReady: ports.presentation.phase() === 'ready' ||
        (ports.presentation.phase() !== 'failed' && ports.presentation.hasPaintedBody()),
      controlObscured: ports.presentation.obscured(),
      interactionBlocked: ports.presentation.blocked(),
      controlVisible: !ignoreClosingControl && ports.control.visible() &&
        !ports.control.closingForCapsule() && !ports.control.shellExitArmed(),
      autoPageStatus: ports.activity.automatic().status,
      autoPageRemainingSeconds: ports.activity.automatic().remainingSeconds,
      ttsStatus: ports.activity.speech().status,
    });
  }

  toggleSessionCapsule(): void {
    const activity = this.capsulePorts().activity;
    if (!activity.inputCurrent() || !activity.pageTurnIdle()) return;
    const launch = this.view.read();
    if (launch !== undefined) {
      if (launch.ownership !== 'stage') return;
      const desired = launch.businessStatus === 'preparing' ? !launch.desiredPlaying : this.sessionLaunchBusinessStatus() !== 'playing';
      this.desirePlaying(launch.generation, desired);
      if (launch.geometry.type === 'tts') activity.setSpeechDesiredPlaying(desired);
      if (launch.businessStatus === 'preparing') return;
      if (launch.geometry.type === 'autoPage') {
        if (desired && activity.automatic().status === 'paused') activity.toggleAutoPage();
        else if (!desired && activity.automatic().status === 'running') activity.pauseAutoPage();
      } else {
        if (desired && (activity.speech().status === 'paused' || activity.speech().status === 'interrupted')) activity.toggleSpeech();
        else if (!desired && activity.speech().status === 'playing') activity.toggleSpeech();
      }
      return;
    }
    const snapshot = this.sessionCapsuleSnapshot();
    if (snapshot?.type === 'autoPage') activity.toggleAutoPage();
    else if (snapshot?.type === 'tts') activity.toggleSpeech();
  }

  private currentCapsuleMeasurement(type: ReaderSessionCapsuleType): ReadingCapsuleMeasurement | undefined {
    const receipt = this.capsulePorts().presentation.measurement();
    return receipt?.kind === type && receipt.identity === this.sessionCapsuleMeasurementIdentity(type) ? receipt : undefined;
  }

  activeSessionCapsuleWidth(): number {
    const type = this.sessionCapsuleType();
    const receipt = this.currentCapsuleMeasurement(type);
    const minimum = this.sessionCapsuleMetrics(type).width;
    return receipt !== undefined && receipt.width > 0 ? Math.max(receipt.width, minimum) : minimum;
  }

  activeSessionCapsuleHeight(): number {
    const type = this.sessionCapsuleType();
    const minimum = this.sessionCapsuleMetrics(type).targetHeight;
    const receipt = this.currentCapsuleMeasurement(type);
    return receipt !== undefined && receipt.height > 0 ? Math.max(receipt.height, minimum) : minimum;
  }

  sessionCapsuleMetrics(type: ReaderSessionCapsuleType = 'autoPage'): ReaderSessionCapsuleMetrics {
    this.environment.viewportRevision();
    return measureReaderSessionCapsule(this.environment.uiContext(), type, ReaderWindowCoordinator.metrics().systemFontScale);
  }

  sessionCapsuleLayout(): ReaderPageChromeLayoutSnapshot {
    return resolveReaderPageChromeLayout(this.capsulePorts().layout.readingLayout(), new ReaderPageChromeMeasurements(
      0, 0, 0, 0, 0, 0, 0, 0, true, this.activeSessionCapsuleWidth(), this.activeSessionCapsuleHeight()));
  }

  sessionCapsuleMeasurementIdentity(type: ReaderSessionCapsuleType): string {
    const ports = this.capsulePorts();
    const generation = type === 'tts' ? ports.activity.speech().sessionGeneration : ports.activity.automatic().generation;
    return JSON.stringify([type, generation, this.sessionLaunchLayoutKey(), ports.layout.appearanceGeneration()]);
  }

  private capsuleMeasurementCurrent(identity: string, type: ReaderSessionCapsuleType): boolean {
    return this.capsulePorts().presentation.active() && this.view.read() === undefined &&
      this.sessionCapsuleSnapshot()?.type === type && identity === this.sessionCapsuleMeasurementIdentity(type);
  }

  onSessionCapsuleMeasured(identity: string, type: ReaderSessionCapsuleType, width: number, height: number): void {
    const view = this.capsulePorts().presentation;
    this.publishCapsuleMeasurement(this.capsuleMeasurements.observe(type, identity, width, height,
      (key: string, kind: ReaderSessionCapsuleType): boolean => this.capsuleMeasurementCurrent(key, kind),
      (): boolean => view.pageChromeFrozen(), (): ReadingCapsuleMeasurement | undefined => view.measurement()));
  }

  flushCapsuleMeasurement(): void {
    this.publishCapsuleMeasurement(this.capsuleMeasurements.flush(
      (key: string, kind: ReaderSessionCapsuleType): boolean => this.capsuleMeasurementCurrent(key, kind),
      (): ReadingCapsuleMeasurement | undefined => this.capsulePorts().presentation.measurement()));
  }

  retirePendingCapsuleMeasurement(): void { this.capsuleMeasurements.retirePending(); }

  private publishCapsuleMeasurement(receipt: ReadingCapsuleMeasurement | undefined): void {
    if (receipt === undefined) return;
    this.capsulePorts().presentation.publishMeasurement(receipt);
    this.view.renderChanged();
  }

  sessionLaunchLayoutKey(): string {
    this.environment.viewportRevision();
    const layout = this.capsulePorts().layout;
    const route = layout.route();
    const sizeAndPalette = layout.identity();
    return `${route.lifecycle}|${route.sourceId}|${route.bookId}|${sizeAndPalette.width}|${sizeAndPalette.height}|` +
      `${layout.paginationSignature()}|${sizeAndPalette.scheme}|${sizeAndPalette.activeTheme}|${ReaderWindowCoordinator.metrics().revision}`;
  }

  private sessionLaunchMeasurementKey(): string {
    const control = this.capsulePorts().control;
    const layout = control.layout(this.environment.viewportRevision());
    const launchLayout = this.sessionLaunchLayoutKey();
    const revisions = control.revisions();
    return `${launchLayout}|${revisions.open}|${revisions.moduleVisit}|` +
      `${layout.fullPanelWidth}|${layout.fullPanelHeight}|${layout.topBarTop}|${layout.dockBottomGap}|${layout.minimumKey}`;
  }

  admitSessionMorphSourceMeasurement(measurement: ReaderSessionMorphSourceMeasurement): void {
    if (this.view.read()?.ownership === 'stage') return;
    this.morphMeasurements.admit(measurement, (): string => this.sessionLaunchMeasurementKey());
  }

  noteShellExitDistances(topExit: number, dockExit: number): void {
    this.topExit = topExit;
    this.dockExit = dockExit;
  }

  /** Start from the exact visible native source before either business actor
   * dispatches. A stale geometry witness leaves the source available. */
  beginSessionCapsuleMorph(type: ReaderSessionCapsuleType): boolean {
    const launch = this.view.read();
    if (launch?.ownership === 'stage') return launch.geometry.type === type;
    if (launch?.ownership === 'handoffPending') return false;
    if (launch !== undefined) this.finish();

    const ports = this.capsulePorts();
    if (!this.environment.ready() || !ports.control.visible() || ports.presentation.obscured()) return false;
    ports.control.cancelNavigation();
    const kind = readerSessionMorphSourceKindForPage(ports.control.currentPage());
    if (kind === undefined || (type === 'tts') !== (kind === 'quickTts' || kind === 'fullTtsPlayback')) return false;
    const minimum = ports.control.playbackMinimum(type, this.environment.viewportRevision());
    if (minimum.required && minimum.receipt === undefined) return false;
    const source = this.morphMeasurements.current(kind, (): string => this.sessionLaunchMeasurementKey());
    if (source === undefined) {
      hilog.warn(0x0000, 'ReaderSessionLaunch', 'session launch retained source: measurement not current');
      return false;
    }
    const capsule = this.sessionCapsuleMetrics(type);
    const receipt = this.currentCapsuleMeasurement(type);
    const width = receipt !== undefined && receipt.width > 0 ? Math.max(receipt.width, capsule.width) : capsule.width;
    const target = resolveReaderPageChromeLayout(ports.layout.readingLayout(), new ReaderPageChromeMeasurements(
      0, 0, 0, 0, 0, 0, 0, 0, true, width, capsule.targetHeight));
    const geometry = buildReaderSessionLaunchGeometry({
      source, fixedIsland: true, targetLeft: target.sessionX,
      targetTop: target.sessionY + (capsule.targetHeight - capsule.paintHeight) / 2,
      capsuleWidth: width, capsuleHeight: capsule.paintHeight,
      topBarExitDistance: this.topExit, dockExitDistance: this.dockExit,
    });
    if (geometry === undefined || this.topExit <= 0 || this.dockExit <= 0) return false;
    const route = ports.layout.route();
    const identity: ReaderSessionLaunchIdentity = {
      lifecycle: route.lifecycle, bookIdentity: `${route.sourceId}:${route.bookId}`,
      moduleVisit: ports.control.revisions().moduleVisit, viewportRevision: this.environment.viewportRevision(),
      scrollRevision: source.revision, layoutRevision: ports.layout.epoch(),
      paletteRevision: ports.layout.paletteRevision(), fontRevision: ports.layout.appearanceGeneration(),
      sourceRevision: source.revision, sourceActorId: source.actorId,
    };
    if (ports.chrome.continuous()) {
      const chrome = ports.chrome.continuousChrome(ports.chrome.continuousProgressText());
      this.flightChrome = new ReaderPageChromeSnapshot(chrome.topStartText, chrome.topEndText,
        chrome.bottomStartText, chrome.bottomEndText, true, width, capsule.targetHeight);
    } else {
      const page = ports.chrome.currentTurnPage();
      this.flightChrome = new ReaderPageChromeSnapshot(page.chromeTopStartText, page.chromeTopEndText,
        page.chromeBottomStartText, page.chromeBottomEndText, true, width, capsule.targetHeight);
    }
    this.flightSpeechState = ports.activity.speech();
    this.flightAutoStatus = ports.activity.automatic().status;
    this.flightControlState = copyReaderControlSessionState(ports.control.visualSession());
    const request: ReaderAuxiliarySessionLaunch = {
      identity, geometry, originLayoutKey: this.sessionLaunchLayoutKey(),
      controlLocation: readerControlContentLocation(this.flightControlState),
      minimum: (generation: number): ReaderControlPlaybackLaunchProfile => ({
        generation, kind, requiresNaturalProfile: minimum.required, receipt: minimum.receipt,
      }),
    };
    if (!this.begin(request)) return false;
    ports.layout.suspendAdjacent();
    ports.layout.invalidateTextures();
    ports.control.invalidateBackdrop();
    this.present();
    return true;
  }

  sessionLaunchRenderWorkBlocked(): boolean {
    const launch = this.view.read();
    return launch !== undefined && launch.ownership !== 'released' && !launch.sample.settled && !launch.sample.finished;
  }

  sessionLaunchAllowsControlInput(): boolean {
    const ownership = this.view.read()?.ownership;
    return ownership !== 'stage' && ownership !== 'handoffPending';
  }

  sessionChromeForPresentation(continuousProgressText: string): ReaderPageChromeSnapshot {
    const ports = this.capsulePorts();
    if (ports.chrome.continuous() && !ports.presentation.pageChromeFrozen()) {
      return ports.chrome.continuousChrome(continuousProgressText);
    }
    const page = ports.chrome.presentedAnchor();
    const anchor = `${page.chapterIndex}|${page.pageStart}|${page.clockText}|${page.renderRevision}`;
    if (anchor !== this.flightChromeAnchor && !ports.presentation.pageChromeFrozen()) {
      this.flightChromeAnchor = anchor;
      this.flightChrome = ports.chrome.presentedPageChrome();
    }
    return this.flightChrome;
  }

  reconcileCapsuleLayout(): void {
    const retired = this.reconcileLayout();
    if (retired !== undefined) this.rememberStaticSessionCapsuleOrigin(retired.geometry.type, this.flightControlState);
  }

  rememberBackgroundCapsuleOrigin(): void {
    const launch = this.view.read();
    if (launch?.ownership === 'stage' && this.liveSessionCapsuleSnapshot(true)?.type === launch.geometry.type) {
      this.rememberStaticSessionCapsuleOrigin(launch.geometry.type, this.flightControlState);
    }
  }

  rememberStaticSessionCapsuleOrigin(type: ReaderSessionCapsuleType, controls: ReaderControlSessionState): void {
    const location = readerControlContentLocation(controls);
    if (location.level !== 'secondary' || location.module !== type) return;
    this.staticOrigin = { route: this.capsulePorts().layout.route(), location };
  }

  clearStaticCapsuleOrigin(type?: ReaderSessionCapsuleType): void {
    if (type === undefined || this.staticOrigin?.location.module === type) this.staticOrigin = undefined;
  }

  consumeStaticCapsuleOrigin(): ReaderControlLocation | undefined {
    const origin = this.staticOrigin;
    this.staticOrigin = undefined;
    if (origin === undefined) return undefined;
    const route = this.capsulePorts().layout.route();
    return origin.route.lifecycle === route.lifecycle && origin.route.sourceId === route.sourceId &&
      origin.route.bookId === route.bookId &&
      this.liveSessionCapsuleSnapshot()?.type === origin.location.module ? origin.location : undefined;
  }

  rememberCapsuleOnControlDismiss(type: ReaderSessionCapsuleType | undefined, controls: () => ReaderControlSessionState): void {
    this.clearStaticCapsuleOrigin();
    const activeType = type ?? this.liveSessionCapsuleSnapshot(true)?.type;
    if (activeType !== undefined) this.rememberStaticSessionCapsuleOrigin(activeType, controls());
  }

  restoreCapsuleControl(durationMs: number): void {
    const hidden = dismissReaderControlSession(this.flightControlState, 0);
    const restored = resumeReaderControlSessionTarget(hidden, readerControlContentLocation(this.flightControlState), durationMs);
    if (restored.transition !== undefined) {
      // Keep the module pose on the original open clock during handoff.
      restored.transition.kind = 'open';
      restored.transition.intent = 'forward';
    }
    this.capsulePorts().control.publishRestoredSession(restored);
  }

  layoutCurrent(): boolean { return this.layoutKey === this.control.layoutKey(); }

  begin(request: ReaderAuxiliarySessionLaunch): boolean {
    this.layoutKey = request.originLayoutKey;
    this.view.setStageOpacity(1);
    this.effects.invalidateExit();
    const admission = this.controller.begin(request.identity, request.geometry, readerMotionNowMs(), this.environment.reducedMotion());
    this.flightSourceSample = admission?.sample;
    this.view.publish(admission);
    const launch = this.view.read();
    if (launch === undefined) return false;
    if (readerTransitionsEnabled()) readerBeginTransition({ kind: 'launch', action: request.geometry.type,
      subject: 'reader-session-launch', scope: 'reader-session-launch',
      nodes: readerTransitionLaunchNodes(request.identity.sourceActorId), staticMotion: this.environment.reducedMotion() });
    this.verification.begin(launch, request.controlLocation, this.environment.reducedMotion());
    this.minimumProfile = request.minimum(launch.generation);
    return true;
  }

  present(): void {
    AppStorage.setOrCreate<boolean>('readerSessionChromeOverlayActive', true);
    this.view.renderChanged();
    const launch = this.view.read();
    if (launch === undefined) return;
    if (!launch.sample.controlsPresented) this.control.hide();
    this.environment.updateWindow();
    const current = this.view.read();
    if (current !== undefined) this.effects.scheduleFrame(current.generation);
  }

  acknowledgeAutomatic(generation: number, pause: () => void): boolean {
    if (!this.controller.mayStartBusiness(generation)) {
      pause();
      this.controller.acknowledgeBusiness(generation, 'paused');
      this.view.publish(this.controller.snapshot());
      return false;
    }
    this.controller.acknowledgeBusiness(generation, 'playing');
    this.view.publish(this.controller.snapshot());
    const launch = this.view.read();
    if (launch !== undefined) this.verification.ownerState('business-ack', launch);
    return true;
  }

  desirePlaying(generation: number, desired: boolean): void {
    this.controller.setDesiredPlaying(generation, desired);
    this.view.publish(this.controller.snapshot());
  }

  acknowledgeSpeech(previous: ReaderSessionLaunchTransaction, status: 'playing' | 'paused',
    speechFacts: (launch: ReaderSessionLaunchTransaction) => ReaderControlCapsuleSpeechFacts | undefined): void {
    if (!this.controller.acknowledgeBusiness(previous.generation, status)) return;
    const acknowledged = this.controller.snapshot();
    if (acknowledged === undefined) return;
    if (acknowledged !== previous) this.view.publish(acknowledged);
    this.verification.ownerState('business-ack', acknowledged, speechFacts(acknowledged));
  }

  reduceMotion(): void {
    const launch = this.view.read();
    if (!this.environment.reducedMotion() || launch === undefined) return;
    if (launch.ownership === 'handoffPending') {
      this.finishHandoff(launch.generation);
      return;
    }
    if (launch.ownership !== 'stage') {
      this.finish();
      return;
    }
    if (!launch.sample.finished) this.verification.finish(launch.generation, 'reduce-motion');
    this.view.publish(this.controller.setReduceMotion(true));
    this.control.hide();
    AppStorage.setOrCreate<boolean>('readerSessionChromeOverlayActive', true);
    this.view.renderChanged();
    this.environment.updateWindow();
  }

  private finishHandoff(generation: number): void {
    const launch = this.view.read();
    if (launch?.generation !== generation || launch.ownership !== 'handoffPending') return;
    // The live controls own the endpoint. The retired source rectangle never
    // turns into a readiness receipt for a later layout.
    this.control.restore(0);
    this.finish();
  }

  cancel(reason: ReaderSessionLaunchCancelReason): void {
    if (this.view.read()?.ownership !== 'stage') return;
    const launch = this.controller.cancel(reason);
    if (launch === undefined) return;
    this.view.publish(launch);
    this.verification.ownerState('cancel-request', launch, this.environment.speechFacts(launch),
      launch.geometry.type === 'autoPage' ? this.environment.automaticStatus() : undefined);
    this.verification.finish(launch.generation, reason);
    if (reason === 'stop' || reason === 'failure') this.environment.retireBusinessStart(launch.geometry.type);
    if (launch.ownership === 'released') { this.finish(); return; }
    if (reason === 'stop') {
      this.view.beginFooterExit(launch);
      if (launch.sample.finished) {
        AppStorage.setOrCreate<boolean>('readerSessionChromeOverlayActive', true);
        this.view.renderChanged();
      }
    }
    if (launch.ownership === 'handoffPending') {
      if (readerTransitionsEnabled()) readerBeginTransition({ kind: 'launch', action: launch.geometry.type,
        subject: 'reader-session-launch-handoff', scope: 'reader-session-launch-handoff',
        nodes: readerTransitionLaunchNodes(launch.identity.sourceActorId), launchHandoff: true });
      if (!this.layoutCurrent()) {
        this.finishHandoff(launch.generation);
        return;
      }
      const duration = readerControlMotionMs(READER_CONTROL_OPEN_MS, this.environment.reducedMotion());
      this.effects.armDeadline(duration, (): void => this.finishHandoff(launch.generation));
      this.control.restore(duration);
      this.environment.updateWindow();
    } else this.effects.fadeExit(launch.generation);
  }

  onSourceReady(generation: number): void {
    if (!this.environment.mounted()) return;
    const current = this.view.read();
    if (current?.generation !== generation || current.ownership !== 'handoffPending') return;
    if (!this.layoutCurrent()) {
      this.finishHandoff(generation);
      return;
    }
    if (!this.controller.confirmHandoffReady(generation)) return;
    this.view.publish(this.controller.snapshot());
    const launch = this.view.read();
    if (launch !== undefined) this.verification.ownerState('handoff-ready', launch, this.environment.speechFacts(launch),
      launch.geometry.type === 'autoPage' ? this.environment.automaticStatus() : undefined);
    this.effects.fadeExit(generation);
  }

  reconcileLayout(): ReaderSessionLaunchTransaction | undefined {
    const launch = this.view.read();
    if (launch === undefined || this.layoutCurrent()) return undefined;
    if (launch.ownership === 'handoffPending') {
      this.finishHandoff(launch.generation);
    } else if (launch.ownership === 'stage' && !launch.sample.finished) {
      this.cancel('sourceChanged');
    } else {
      this.finish();
      if (launch.ownership === 'stage') return launch;
    }
    return undefined;
  }

  finish(released?: ReaderSessionLaunchTransaction): void {
    this.effects.clearDeadline();
    this.verification.discardHandoffFade();
    this.effects.cancelExitAnimator();
    const launch = released ?? this.view.read();
    if (launch !== undefined) {
      this.verification.ownerState('retired', launch, this.environment.speechFacts(launch),
        launch.geometry.type === 'autoPage' ? this.environment.automaticStatus() : undefined);
      this.verification.finish(launch.generation, launch.cancelReason ?? 'retired');
    }
    this.effects.invalidateExit();
    this.controller.dispose();
    this.view.publish(undefined);
    this.flightSourceSample = undefined;
    this.minimumProfile = undefined;
    this.effects.retireFrame();
    this.view.setStageOpacity(1);
    this.view.clearFooterExit();
    AppStorage.setOrCreate<boolean>('readerSessionChromeOverlayActive', false);
    if (launch !== undefined) this.view.renderChanged();
    if (this.environment.mounted() && !this.environment.exiting()) {
      this.environment.updateWindow();
      this.environment.drainPageTurn();
    }
  }
}
