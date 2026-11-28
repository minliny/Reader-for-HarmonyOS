import type { UIContext } from '@ohos.arkui.UIContext';
import type { AnimatorResult } from '@ohos.animator';
import type { FrameNode } from '@ohos.arkui.node';
import { motionAnimateParam } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerTransitionsEnabled } from '../../../ui/foundation/ReaderTransitionSignals';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { READER_LAUNCH_PROXY, READER_LAUNCH_SHARP } from '../../../ui/layout/TransitionInvariantEvaluator';
import { READER_SESSION_SOURCE_TRANSFER_DEADLINE_MS } from './ReaderSessionLaunchController';
import type { ReaderSessionLaunchController, ReaderSessionLaunchTransaction } from './ReaderSessionLaunchController';
import type { ReaderControlCapsuleVerification } from './ReaderControlCapsuleVerification';
import { ReaderUIFrameCallback } from './ReaderUIFrameCallback';

import type { ReaderSessionLaunchViewHost } from './ReaderSessionLaunchViewHost';

const SESSION_LAUNCH_CALLBACK_GRACE_MS = 250;

/** Drives the reader's native frame/exit work with the existing transaction
 * controller. The page publishes the view state and owns control handoff. */
export class ReaderSessionLaunchEffects {
  private sessionLaunchFramePending: boolean = false;
  private pendingSessionLaunchGeneration: number = 0;
  private sessionLaunchExitGeneration: number = 0;
  private sessionLaunchExitAnimator: AnimatorResult | undefined = undefined;
  private sessionLaunchDeadlineTimer: number = -1;
  private readonly controller: ReaderSessionLaunchController;
  private readonly verification: ReaderControlCapsuleVerification;
  private readonly host: ReaderSessionLaunchViewHost;

  constructor(controller: ReaderSessionLaunchController, verification: ReaderControlCapsuleVerification,
    host: ReaderSessionLaunchViewHost) {
    this.controller = controller;
    this.verification = verification;
    this.host = host;
  }

  invalidateExit(): void { this.sessionLaunchExitGeneration += 1; }

  retireFrame(): void { this.sessionLaunchFramePending = false; }

  cancelExitAnimator(): void {
    const animator = this.sessionLaunchExitAnimator;
    this.sessionLaunchExitAnimator = undefined;
    animator?.cancel();
  }

  clearDeadline(): void {
    if (this.sessionLaunchDeadlineTimer >= 0) clearTimeout(this.sessionLaunchDeadlineTimer);
    this.sessionLaunchDeadlineTimer = -1;
  }

  armDeadline(durationMs: number, action: () => void): void {
    this.clearDeadline();
    this.sessionLaunchDeadlineTimer = setTimeout(action, durationMs + SESSION_LAUNCH_CALLBACK_GRACE_MS);
  }

  armSourceTransferDeadline(generation: number): void {
    this.clearDeadline();
    this.sessionLaunchDeadlineTimer = setTimeout((): void => {
      this.sessionLaunchDeadlineTimer = -1;
      this.host.fallbackSourceTransfer(generation);
    }, READER_SESSION_SOURCE_TRANSFER_DEADLINE_MS);
  }

  scheduleFrame(generation: number): void {
    const active = this.host.read();
    if ((this.sessionLaunchFramePending && this.pendingSessionLaunchGeneration === generation) ||
      !this.controller.isCurrent(generation) || (active?.sourceTransfer === 'presenting' && active.sample.finished)) return;
    this.sessionLaunchFramePending = true;
    this.pendingSessionLaunchGeneration = generation;
    const queuedMs = this.verification.queuedFrameTime(generation);
    this.host.context().postFrameCallback(new ReaderUIFrameCallback((frameTimeNs: number): void => {
      const enteredMs = queuedMs === undefined ? undefined : readerMotionNowMs();
      if (this.pendingSessionLaunchGeneration !== generation) return;
      this.sessionLaunchFramePending = false;
      if (!this.host.ready() || !this.controller.isCurrent(generation)) return;
      if (!this.host.layoutCurrent()) {
        this.host.retireForLayout(); return;
      }
      const previous = this.host.read();
      const tick = readerMotionNowMs();
      if (previous === undefined) return;
      if (this.host.observing())
        this.verification.read(this.host.context(), previous, frameTimeNs, queuedMs, enteredMs, tick);
      if (previous.sourceTransfer !== 'presenting') {
        this.advanceSourceTransfer(previous, tick);
        return;
      }
      const next = this.controller.advance(generation, tick);
      if (next === undefined) return;
      this.host.publish(next);
      this.verification.update(next, tick, previous);
      if (previous?.sample.settled !== true && next.sample.settled && this.host.observing()) {
        const endpointQueuedMs = this.verification.queuedFrameTime(generation);
        this.host.context().postFrameCallback(new ReaderUIFrameCallback((endpointNs: number): void => {
          const endpointEnteredMs = endpointQueuedMs === undefined ? undefined : readerMotionNowMs();
          const current = this.host.read();
          if (current?.generation !== generation || current.ownership !== 'stage') return;
          this.verification.read(this.host.context(), current, endpointNs,
            endpointQueuedMs, endpointEnteredMs);
          this.verification.finish(generation, 'visual-settled');
        }));
      }
      if (!previous?.sample.settled && next.sample.settled) this.host.drainPageTurn();
      if (previous?.sample.controlsPresented && !next.sample.controlsPresented) {
        this.host.hideControl();
        this.verification.ownerState('panel-hidden', next);
      }
      if (previous?.sample.controlsPresented !== next.sample.controlsPresented || next.sample.finished) {
        this.host.updateWindow();
      }
      if (!next.sample.finished) this.scheduleFrame(generation);
    }));
  }

  confirmOriginalRetired(generation: number, actorId: string): void {
    const launch = this.host.read();
    if (launch?.generation !== generation || launch.sourceTransfer !== 'retiringSource' ||
      launch.identity.sourceActorId !== actorId || !this.host.ready() || !this.host.layoutCurrent()) return;
    this.advanceSourceTransfer(launch, readerMotionNowMs());
  }

  private advanceSourceTransfer(previous: ReaderSessionLaunchTransaction, tick: number): void {
    const context = this.host.context();
    const proxyReady = this.receivesLayout(context, READER_LAUNCH_PROXY) && (!previous.sample.sourceNeeded ||
      (this.host.controlSourceReady(previous.generation) && this.receivesLayout(context, READER_LAUNCH_SHARP)));
    const sourceRetired = previous.sourceTransfer === 'retiringSource' &&
      this.originalHasRetired(context, previous.identity.sourceActorId);
    const outcome = this.controller.confirmSourceTransfer(previous.generation, tick, proxyReady, sourceRetired);
    if (outcome === 'fallback') {
      this.host.fallbackSourceTransfer(previous.generation);
      return;
    }
    const admitted = this.controller.snapshot();
    if (admitted === undefined || admitted.generation !== previous.generation || outcome === 'stale') return;
    if (admitted !== previous) {
      this.host.publish(admitted);
      this.verification.update(admitted, tick, previous);
    }
    if (outcome === 'present') {
      this.clearDeadline();
      if (!admitted.sample.controlsPresented) {
        this.host.hideControl();
        this.host.updateWindow();
        this.host.drainPageTurn();
      }
    }
    this.scheduleFrame(previous.generation);
  }

  private receivesLayout(context: UIContext, id: string): boolean {
    try {
      const node = context.getAttachedFrameNodeById(id);
      if (node === null || node.isDisposed() || !node.isAttached()) return false;
      const size = node.getMeasuredSize();
      return Number(size.width) > 0 && Number(size.height) > 0;
    } catch (_) { return false; }
  }

  private originalHasRetired(context: UIContext, id: string): boolean {
    try {
      let node: FrameNode | null = context.getAttachedFrameNodeById(id);
      let depth = 0;
      while (node !== null && depth < 64) {
        if (node.isDisposed() || !node.isAttached() || !node.isVisible() || node.getOpacity() <= 0) return true;
        node = node.getParent();
        depth += 1;
      }
      return depth === 0;
    } catch (_) { return false; }
  }

  fadeExit(generation: number): void {
    const exit = ++this.sessionLaunchExitGeneration;
    const launch = this.host.read();
    const viewportRevision = this.host.viewportRevision();
    const ownsExit = (): boolean => exit === this.sessionLaunchExitGeneration &&
      this.host.read()?.generation === generation;
    const canObserveFade = (): boolean => this.host.ready() &&
      this.host.viewportRevision() === viewportRevision && ownsExit() &&
      this.host.read()?.ownership === 'exitPending';
    const reducedMotion = this.host.reducedMotion();
    const ui = this.host.ready() ? this.host.context() : undefined;
    const observingFade = !reducedMotion && ui !== undefined && launch?.generation === generation && canObserveFade() &&
      this.verification.beginHandoffFade(ui, launch);
    const finish = (): void => {
      if (!ownsExit()) return;
      const released = this.controller.finishExit(generation);
      if (released && ui !== undefined && observingFade && canObserveFade()) {
        this.verification.finishHandoffFade(ui, generation);
      }
      this.host.finish(released ? this.controller.snapshot() : undefined);
    };
    if (ui === undefined) { finish(); return; }
    const parameters = reducedMotion ? readerMotionReducedFadeParam(finish) :
      motionAnimateParam('reader.session.capsule.exit', finish);
    this.armDeadline(parameters.duration ?? 0, finish);
    if (reducedMotion) this.host.finalizeFooter();
    const applyExit = (): void => {
      this.host.setStageOpacity(0);
      if (!reducedMotion) this.host.finalizeFooter();
    };
    if ((observingFade || readerTransitionsEnabled()) && !reducedMotion && launch?.cancelReason === 'openControl' && parameters.duration !== undefined) {
      // Render the exit curve on the still-mounted capsule while the restored
      // controls own input. Each opacity is written to the actual stage.
      try {
        const animator = ui.createAnimator({
          duration: parameters.duration, easing: 'ease-out', delay: 0, fill: 'forwards',
          direction: 'normal', iterations: 1, begin: this.host.stageOpacity(), end: 0,
        });
        this.sessionLaunchExitAnimator = animator;
        animator.onFrame = (value: number): void => {
          if (this.sessionLaunchExitAnimator === animator && ownsExit()) this.host.setStageOpacity(value);
        };
        animator.onFinish = (): void => {
          if (this.sessionLaunchExitAnimator !== animator || !ownsExit()) return;
          this.sessionLaunchExitAnimator = undefined;
          applyExit();
          ui.postFrameCallback(new ReaderUIFrameCallback((): void => finish()));
        };
        animator.play();
      } catch (_) {
        this.sessionLaunchExitAnimator = undefined;
        ui.animateTo(parameters, applyExit);
      }
    } else {
      ui.animateTo(parameters, applyExit);
    }
    if (observingFade && canObserveFade()) {
      const context = ui;
      const observeFrame = (frameTimeNs: number): void => {
        if (canObserveFade() && this.verification.readHandoffFade(context, generation, frameTimeNs)) {
          context.postFrameCallback(new ReaderUIFrameCallback(observeFrame));
        }
      };
      context.postFrameCallback(new ReaderUIFrameCallback(observeFrame));
    }
  }
}
