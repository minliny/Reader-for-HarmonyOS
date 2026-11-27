import type { UIContext } from '@ohos.arkui.UIContext';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { READER_CONTROL_OPEN_MS } from '../../../ui/foundation/ProductMotionTiming';
import { readerBeginTransition, readerTransitionsEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { readerTransitionLaunchNodes } from '../../../ui/layout/TransitionInvariantEvaluator';
import type { ReaderControlCapsuleSpeechFacts, ReaderControlCapsuleVerification } from './ReaderControlCapsuleVerification';
import { readerControlMotionMs } from './ReaderControlMotionPolicy';
import type { ReaderControlPlaybackLaunchProfile } from './ReaderControlPlaybackProfile';
import type { ReaderControlLocation } from './ReaderControlSessionState';
import type { ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';
import { ReaderSessionLaunchController, type ReaderSessionLaunchCancelReason,
  type ReaderSessionLaunchIdentity, type ReaderSessionLaunchTransaction } from './ReaderSessionLaunchController';
import { READER_SESSION_LAUNCH_CURVES } from './ReaderSessionLaunchCurves';
import { ReaderSessionLaunchEffects } from './ReaderSessionLaunchEffects';
import type { ReaderSessionLaunchGeometry } from './ReaderSessionLaunchPresentation';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';

export interface ReaderAuxiliarySessionView {
  readonly read: () => ReaderSessionLaunchTransaction | undefined;
  readonly publish: (launch: ReaderSessionLaunchTransaction | undefined) => void;
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

/** Owns the native capsule launch, moving footer and visibility handoff.
 * Only a current transaction can drive an ArkUI frame or restore controls. */
export class ReaderAuxiliarySessionHost {
  private readonly controller: ReaderSessionLaunchController = new ReaderSessionLaunchController(READER_SESSION_LAUNCH_CURVES);
  private readonly effects: ReaderSessionLaunchEffects;
  private readonly verification: ReaderControlCapsuleVerification;
  private readonly view: ReaderAuxiliarySessionView;
  private readonly control: ReaderAuxiliarySessionControlSurface;
  private readonly environment: ReaderAuxiliarySessionEnvironment;
  private layoutKey: string = '';
  private minimumProfile: ReaderControlPlaybackLaunchProfile | undefined = undefined;

  constructor(verification: ReaderControlCapsuleVerification, view: ReaderAuxiliarySessionView,
    control: ReaderAuxiliarySessionControlSurface, environment: ReaderAuxiliarySessionEnvironment) {
    this.verification = verification;
    this.view = view;
    this.control = control;
    this.environment = environment;
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

  layoutCurrent(): boolean { return this.layoutKey === this.control.layoutKey(); }

  begin(request: ReaderAuxiliarySessionLaunch): boolean {
    this.layoutKey = request.originLayoutKey;
    this.view.setStageOpacity(1);
    this.effects.invalidateExit();
    this.view.publish(this.controller.begin(request.identity, request.geometry, readerMotionNowMs(), this.environment.reducedMotion()));
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
