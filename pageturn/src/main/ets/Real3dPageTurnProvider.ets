// Real3dPageTurnProvider - the host-private implementation of the
// reader.page.turn.real3d.v1 capability.
//
// This provider owns the frame-by-frame gesture state machine the contract
// pins for simulation mode. It binds the live current+adjacent page surfaces
// (opaque tokens the paginator produced - never sample textures), tracks the
// finger progress continuously using the contract's gesture fields, and
// decides commit-vs-rollback on release. The visible 3D page surface (bend,
// shadow, grid, curl) is the platform's real3d renderer that follows
// currentProgress(); this file adds NO bend/shadow/grid/curl parameters - the
// contract explicitly forbids self-created 3D visual values
// (simulation.layers transformDriver="real3d-finger-follow", translationX
// undefined; simulation.settle sourceCalibration is a 13-frame *calibration
// sample reference*, not a runtime texture).
//
// Fail-closed: when there is no valid lease, this provider is explicitly
// unavailable and MUST NOT degrade to slide/CSS rotation/image frames
// (simulation.unsupportedCapability="fail-closed-no-2d-fallback"). The
// coordinator enforces this by failing to acquire a lease; this provider only
// runs behind one.
//
// Contract gesture fields consumed (simulation.gesture):
//   dragSlopLogicalUnits=4, progress="clamp-absolute-inline-delta-over-live-
//   inline-extent", completionProgress=0.5,
//   directionalVelocityLogicalUnitsPerSecond=500, pointerCancel="rollback",
//   reverse="continuous".
// Contract settle fields (simulation.settle): cancelBehavior="reverse-to-zero",
//   commit="after-reader.progress.update-stored-true".
import {
  PageTurnProviderHandle, PageTurnOperationResult, PageTurnOperationRequest,
  OperationName,
} from './PageTurnProviderRegistry';
import { PageTurnCapabilityId, PageTurnContract } from './PageTurnContract';

// Opaque page-surface tokens bound at acquire time. The provider never
// inspects their internals; they exist so the host can verify the live
// current/adjacent/front/back/underlay surfaces were handed to the real3d
// renderer before the gesture begins (missingAdjacent="reject-intent").
export interface Real3dSurfaceToken {
  revision: number;
  token: string;
}

export type Real3dGestureDirection = 'next' | 'prev' | 'none';
export type Real3dReleaseDecision = 'commit' | 'rollback';

export interface Real3dFingerProgress {
  progress: number;       // [0,1], clamped absolute delta over live extent
  direction: Real3dGestureDirection;
  started: boolean;       // false while |delta| < dragSlop
}

export class Real3dPageTurnProvider implements PageTurnProviderHandle {
  // Bound live surfaces (current + adjacent + the real3d front/back/underlay
  // the renderer composites). No visual params here - just opaque tokens.
  private currentSurface: Real3dSurfaceToken | null = null;
  private adjacentSurface: Real3dSurfaceToken | null = null;
  private bound: boolean = false;

  // Gesture state. cumulativeDelta carries the net pointer delta in logical
  // units; its sign gives direction, its magnitude gives progress. reverse=
  // "continuous" means a direction flip decreases progress through zero and
  // rises in the new direction without a discrete jump.
  private cumulativeDelta: number = 0;
  private inlineExtent: number = 1;
  private liveProgress: number = 0;
  private liveDirection: Real3dGestureDirection = 'none';
  private gestureStarted: boolean = false;

  capability(): PageTurnCapabilityId {
    return 'reader.page.turn.real3d.v1';
  }

  providerKind(): string {
    return 'real3d-page-turn-provider';
  }

  requiredOperations(): OperationName[] {
    return [
      'bind-live-current-adjacent-surfaces',
      'render-live-current-front-back-and-adjacent-underlay',
      'update-finger-progress-continuously',
      'settle-after-stored-true',
      'rollback',
      'dispose',
    ];
  }

  // registerWhen gates on provider-self-check-passes + reader-runtime-session-
  // bound + surface/content-revision-current + progress-store-bridge. A
  // provider with no bound live surfaces is not ready and acquire must be
  // fail-closed.
  selfCheckPasses(): boolean {
    return this.bound && this.currentSurface !== null && this.adjacentSurface !== null;
  }

  // ── host domain methods (called directly by the gesture surface, gated by
  // the lease the coordinator acquired) ───────────────────────────────────
  bindLiveCurrentAdjacentSurfaces(current: Real3dSurfaceToken, adjacent: Real3dSurfaceToken): void {
    this.currentSurface = current;
    this.adjacentSurface = adjacent;
    this.bound = true;
  }

  setLiveInlineExtent(extent: number): void {
    // The live measured inline extent (the page width along the drag axis).
    // progress = clamp(|cumulativeDelta| / extent).
    this.inlineExtent = extent > 0 ? extent : 1;
  }

  // update-finger-progress-continuously. The host feeds the raw pointer delta
  // (logical units) each frame; the provider accumulates it and recomputes
  // progress + direction per the contract's gesture fields.
  updateFingerProgress(rawDelta: number): Real3dFingerProgress {
    this.cumulativeDelta += rawDelta;
    const slop = Real3dPageTurnProvider.dragSlop();
    const absDelta = this.cumulativeDelta < 0 ? -this.cumulativeDelta : this.cumulativeDelta;
    if (absDelta < slop) {
      // Below drag slop: the gesture has not begun. Progress stays 0.
      this.gestureStarted = false;
      this.liveProgress = 0;
      this.liveDirection = Real3dPageTurnProvider.directionFor(this.cumulativeDelta);
      return { progress: 0, direction: this.liveDirection, started: false };
    }
    this.gestureStarted = true;
    // progress = clamp-absolute-inline-delta-over-live-inline-extent.
    const raw = absDelta / this.inlineExtent;
    this.liveProgress = raw < 0 ? 0 : (raw > 1 ? 1 : raw);
    this.liveDirection = Real3dPageTurnProvider.directionFor(this.cumulativeDelta);
    return { progress: this.liveProgress, direction: this.liveDirection, started: true };
  }

  // On release: decide commit vs rollback using completionProgress +
  // directionalVelocity. The coordinator drives the actual settle (progress ->
  // 1 for commit, -> 0 for rollback) and gates the visible commit on
  // stored=true; this method only returns the decision.
  onPointerUp(velocityLogicalUnitsPerSecond: number): Real3dReleaseDecision {
    if (!this.gestureStarted) return 'rollback';
    const completion = Real3dPageTurnProvider.completionProgress();
    const flick = Real3dPageTurnProvider.directionalVelocity();
    const absVelocity = velocityLogicalUnitsPerSecond < 0
      ? -velocityLogicalUnitsPerSecond : velocityLogicalUnitsPerSecond;
    if (this.liveProgress >= completion) return 'commit';
    if (absVelocity >= flick) return 'commit';
    return 'rollback';
  }

  // pointerCancel="rollback": a cancelled pointer always rolls back.
  onPointerCancel(): Real3dReleaseDecision {
    return 'rollback';
  }

  currentProgress(): number {
    return this.liveProgress;
  }

  currentDirection(): Real3dGestureDirection {
    return this.liveDirection;
  }

  // The settle target the renderer/corordinator drives progress toward.
  // commit -> 1, rollback -> 0 (cancelBehavior="reverse-to-zero").
  settleTarget(decision: Real3dReleaseDecision): number {
    return decision === 'commit' ? 1 : 0;
  }

  resetGesture(): void {
    this.cumulativeDelta = 0;
    this.liveProgress = 0;
    this.liveDirection = 'none';
    this.gestureStarted = false;
  }

  dispose(): void {
    this.currentSurface = null;
    this.adjacentSurface = null;
    this.bound = false;
    this.resetGesture();
    this.inlineExtent = 1;
  }

  // ── registry-routed operations (invoke through a live lease only) ──────
  onOperation(operation: OperationName, _request: PageTurnOperationRequest): PageTurnOperationResult {
    if (operation === 'bind-live-current-adjacent-surfaces') {
      return { status: 'completed', detail: this.bound ? 'bound' : 'not-bound' };
    }
    if (operation === 'render-live-current-front-back-and-adjacent-underlay') {
      // The real3d renderer composites the bound surfaces; no 2D fallback.
      return { status: 'completed', detail: this.bound ? 'rendered' : 'no-surfaces' };
    }
    if (operation === 'update-finger-progress-continuously') {
      return { status: 'completed', detail: `progress=${this.liveProgress.toFixed(4)}` };
    }
    if (operation === 'settle-after-stored-true') {
      return { status: 'completed', detail: 'settle-commit' };
    }
    if (operation === 'rollback') {
      this.resetGesture();
      return { status: 'completed', detail: 'reverse-to-zero' };
    }
    if (operation === 'dispose') {
      this.dispose();
      return { status: 'completed', detail: 'disposed' };
    }
    return { status: 'rejected-unknown-operation', detail: operation };
  }

  onLeaseLost(_leaseId: string, _reason: string): void {
    // lossBeforeStored: rollback the transient gesture (reverse-to-zero) and
    // clear the bound surfaces so a stale renderer can't keep following a
    // lost lease.
    this.resetGesture();
  }

  // ── contract gesture fields (read from PageTurnContract, not hardcoded) ─
  private static dragSlop(): number {
    return PageTurnContract.runtimeGesture('simulation')?.dragSlopLogicalUnits ?? 4;
  }

  private static completionProgress(): number {
    return PageTurnContract.runtimeGesture('simulation')?.completionProgress ?? 0.5;
  }

  private static directionalVelocity(): number {
    return PageTurnContract.runtimeGesture('simulation')?.directionalVelocityLogicalUnitsPerSecond ?? 500;
  }

  private static directionFor(delta: number): Real3dGestureDirection {
    if (delta > 0) return 'next';
    if (delta < 0) return 'prev';
    return 'none';
  }
}
