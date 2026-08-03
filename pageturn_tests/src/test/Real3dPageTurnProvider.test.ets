import { describe, it, expect } from '@ohos/hypium';
import {
  Real3dPageTurnProvider, Real3dSurfaceToken,
} from 'pageturn';
import {
  PageTurnProviderRegistry, PageTurnAcquireRequest, PageTurnLiveReadingState,
  PageTurnLeaseBinding, PageTurnOperationRequest,
} from 'pageturn';

// ArkTS forbids nested functions; float comparison lives at module scope.
function assertClose(actual: number, expected: number, tol: number): void {
  const diff = actual - expected;
  const abs = diff < 0 ? -diff : diff;
  expect(abs <= tol).assertTrue();
}

function currentToken(): Real3dSurfaceToken {
  return { revision: 11, token: 'page-current' };
}

function adjacentToken(): Real3dSurfaceToken {
  return { revision: 11, token: 'page-adjacent' };
}

function liveState(): PageTurnLiveReadingState {
  return {
    readerSurfaceHandle: 'surface-1',
    surfaceRect: { widthLogical: 390, heightLogical: 844 },
    currentPage: { revision: 11, token: 'page-current' },
    adjacentPage: { revision: 11, token: 'page-adjacent' },
    continuousContent: undefined,
  };
}

function real3dAcquireRequest(): PageTurnAcquireRequest {
  return {
    capability: 'reader.page.turn.real3d.v1',
    modeId: 'simulation',
    readerSessionId: 'session-1',
    layoutRevision: 7,
    surfaceRevision: 3,
    contentRevision: 11,
    liveReadingState: liveState(),
  };
}

function registerReal3d(registry: PageTurnProviderRegistry, provider: Real3dPageTurnProvider): void {
  registry.register({
    registryInstanceId: registry.instanceId(),
    capability: provider.capability(),
    providerKind: provider.providerKind(),
    providerHandle: provider,
    requiredOperations: provider.requiredOperations(),
    readerSessionId: 'session-1',
    layoutRevision: 7,
    surfaceRevision: 3,
    contentRevision: 11,
  });
}

export default function Real3dPageTurnProviderTests(): void {
  describe('Real3dPageTurnProvider', () => {
    it('providerKindAndRequiredOperationsMatchContract', 0, () => {
      const provider = new Real3dPageTurnProvider();
      expect(provider.capability()).assertEqual('reader.page.turn.real3d.v1');
      expect(provider.providerKind()).assertEqual('real3d-page-turn-provider');
      const ops = provider.requiredOperations();
      expect(ops.length).assertEqual(6);
      expect(ops[0]).assertEqual('bind-live-current-adjacent-surfaces');
      expect(ops[1]).assertEqual('render-live-current-front-back-and-adjacent-underlay');
      expect(ops[2]).assertEqual('update-finger-progress-continuously');
      expect(ops[3]).assertEqual('settle-after-stored-true');
      expect(ops[4]).assertEqual('rollback');
      expect(ops[5]).assertEqual('dispose');
    });

    it('selfCheckFailsBeforeBindAndPassesAfter', 0, () => {
      const provider = new Real3dPageTurnProvider();
      expect(provider.selfCheckPasses()).assertFalse();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      expect(provider.selfCheckPasses()).assertTrue();
    });

    it('updateFingerProgressAppliesDragSlopThenClampsAbsolute', 0, () => {
      // progress = "clamp-absolute-inline-delta-over-live-inline-extent";
      // dragSlopLogicalUnits=4 gates when the gesture starts.
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      provider.setLiveInlineExtent(200);
      // Below drag slop (cumulative=3 < 4): not started, progress 0.
      const below = provider.updateFingerProgress(3);
      expect(below.started).assertFalse();
      expect(below.progress).assertEqual(0);
      // Cross slop (cumulative=5): started, progress=5/200=0.025, next.
      const started = provider.updateFingerProgress(2);
      expect(started.started).assertTrue();
      assertClose(started.progress, 0.025, 1e-9);
      expect(started.direction).assertEqual('next');
      // Push to clamp 1 (cumulative=200 -> 1.0).
      provider.updateFingerProgress(195);
      expect(provider.currentProgress()).assertEqual(1);
      // Beyond extent clamps to 1 (cumulative=300 -> 1.5 -> 1).
      provider.updateFingerProgress(100);
      expect(provider.currentProgress()).assertEqual(1);
    });

    it('onPointerUpCommitsAtOrAboveCompletionProgress', 0, () => {
      // completionProgress=0.5: at or above -> commit (no flick needed).
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      provider.setLiveInlineExtent(200);
      provider.updateFingerProgress(100); // cumulative=100 -> 0.5
      expect(provider.onPointerUp(0)).assertEqual('commit');
      provider.updateFingerProgress(20); // cumulative=120 -> 0.6
      expect(provider.onPointerUp(0)).assertEqual('commit');
    });

    it('onPointerUpRollsBackBelowCompletionWithoutFlick', 0, () => {
      // progress 0.3 < 0.5 and velocity 100 < 500 -> rollback.
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      provider.setLiveInlineExtent(200);
      provider.updateFingerProgress(60); // cumulative=60 -> 0.3
      expect(provider.onPointerUp(100)).assertEqual('rollback');
    });

    it('onPointerUpCommitsOnFlickEvenBelowCompletion', 0, () => {
      // directionalVelocityLogicalUnitsPerSecond=500: a flick at/above 500
      // commits even when progress is below 0.5.
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      provider.setLiveInlineExtent(200);
      provider.updateFingerProgress(60); // 0.3
      expect(provider.onPointerUp(500)).assertEqual('commit');
      provider.updateFingerProgress(20); // cumulative=80 -> 0.4
      expect(provider.onPointerUp(600)).assertEqual('commit');
    });

    it('onPointerUpRollsBackWhenGestureNeverStarted', 0, () => {
      // No gesture (below slop) on release -> rollback.
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      provider.setLiveInlineExtent(200);
      provider.updateFingerProgress(3); // below slop
      expect(provider.onPointerUp(0)).assertEqual('rollback');
    });

    it('onPointerCancelAlwaysRollsBack', 0, () => {
      // pointerCancel="rollback": a cancelled pointer always rolls back,
      // even mid-gesture above completion.
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      provider.setLiveInlineExtent(200);
      provider.updateFingerProgress(120); // 0.6, would commit on release
      expect(provider.onPointerCancel()).assertEqual('rollback');
    });

    it('continuousReverseProgressFollowsDirectionFlip', 0, () => {
      // reverse="continuous": a direction flip decreases progress through
      // zero and rises in the new direction without a discrete jump.
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      provider.setLiveInlineExtent(200);
      provider.updateFingerProgress(50); // cumulative=50 -> 0.25, next
      expect(provider.currentDirection()).assertEqual('next');
      assertClose(provider.currentProgress(), 0.25, 1e-9);
      provider.updateFingerProgress(-50); // cumulative=0 -> 0, none
      expect(provider.currentProgress()).assertEqual(0);
      expect(provider.currentDirection()).assertEqual('none');
      provider.updateFingerProgress(-50); // cumulative=-50 -> 0.25, prev
      assertClose(provider.currentProgress(), 0.25, 1e-9);
      expect(provider.currentDirection()).assertEqual('prev');
    });

    it('settleTargetMatchesCancelBehavior', 0, () => {
      // cancelBehavior="reverse-to-zero": commit -> 1, rollback -> 0.
      const provider = new Real3dPageTurnProvider();
      expect(provider.settleTarget('commit')).assertEqual(1);
      expect(provider.settleTarget('rollback')).assertEqual(0);
    });

    it('registerAndAcquireLeaseForSimulation', 0, () => {
      const registry = new PageTurnProviderRegistry('real3d-1');
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      registerReal3d(registry, provider);
      const response = registry.acquire(real3dAcquireRequest());
      expect(response.admitted).assertTrue();
      expect(response.capability).assertEqual('reader.page.turn.real3d.v1');
      expect(response.providerKind).assertEqual('real3d-page-turn-provider');
      expect(response.leaseId.length > 0).assertTrue();
      expect(response.lease !== undefined).assertTrue();
      expect(response.lease!.isReady).assertTrue();
    });

    it('acquireFailsClosedBeforeSurfacesBoundNoDegradation', 0, () => {
      // unsupportedCapability="fail-closed-no-2d-fallback": an unbound
      // provider is not registered (self-check fails) and acquire MUST be
      // fail-closed - NO degradation to slide/CSS rotation/image frames.
      const registry = new PageTurnProviderRegistry('real3d-2');
      const provider = new Real3dPageTurnProvider();
      registerReal3d(registry, provider); // not bound -> register rejects
      const response = registry.acquire(real3dAcquireRequest());
      expect(response.admitted).assertFalse();
      expect(response.state).assertEqual('unavailable-no-provider');
      expect(response.leaseId).assertEqual('');
      expect(response.lease).assertUndefined();
    });

    it('onLeaseLostResetsTransientGesture', 0, () => {
      // lossBeforeStored: the transient gesture is rolled back (reverse-to-
      // zero) so a stale renderer can't keep following a lost lease.
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      provider.setLiveInlineExtent(200);
      provider.updateFingerProgress(120); // 0.6, started, next
      provider.onLeaseLost('lease-1', 'content-revision-invalidated');
      expect(provider.currentProgress()).assertEqual(0);
      expect(provider.currentDirection()).assertEqual('none');
    });

    it('onOperationRoutesContractedOperations', 0, () => {
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      const leaseId = 'lease-op';
      const binding: PageTurnLeaseBinding = {
        registryInstanceId: 'reg',
        registrationEpoch: 1,
        capability: 'reader.page.turn.real3d.v1',
        providerKind: 'real3d-page-turn-provider',
        readerSessionId: 'session-1',
        layoutRevision: 7,
        surfaceRevision: 3,
        contentRevision: 11,
      };
      const bindReq: PageTurnOperationRequest = {
        operation: 'bind-live-current-adjacent-surfaces', operationId: 'op-1',
        leaseId: leaseId, binding: binding,
      };
      expect(provider.onOperation('bind-live-current-adjacent-surfaces', bindReq).status)
        .assertEqual('completed');
      const renderReq: PageTurnOperationRequest = {
        operation: 'render-live-current-front-back-and-adjacent-underlay', operationId: 'op-2',
        leaseId: leaseId, binding: binding,
      };
      expect(provider.onOperation('render-live-current-front-back-and-adjacent-underlay', renderReq).status)
        .assertEqual('completed');
      const updateReq: PageTurnOperationRequest = {
        operation: 'update-finger-progress-continuously', operationId: 'op-3',
        leaseId: leaseId, binding: binding,
      };
      expect(provider.onOperation('update-finger-progress-continuously', updateReq).status)
        .assertEqual('completed');
      const settleReq: PageTurnOperationRequest = {
        operation: 'settle-after-stored-true', operationId: 'op-4',
        leaseId: leaseId, binding: binding,
      };
      expect(provider.onOperation('settle-after-stored-true', settleReq).status)
        .assertEqual('completed');
      const rollbackReq: PageTurnOperationRequest = {
        operation: 'rollback', operationId: 'op-5',
        leaseId: leaseId, binding: binding,
      };
      expect(provider.onOperation('rollback', rollbackReq).status).assertEqual('completed');
      const unknownReq: PageTurnOperationRequest = {
        operation: 'bogus', operationId: 'op-6',
        leaseId: leaseId, binding: binding,
      };
      expect(provider.onOperation('bogus', unknownReq).status)
        .assertEqual('rejected-unknown-operation');
    });

    it('disposeReleasesBoundSurfaces', 0, () => {
      const provider = new Real3dPageTurnProvider();
      provider.bindLiveCurrentAdjacentSurfaces(currentToken(), adjacentToken());
      expect(provider.selfCheckPasses()).assertTrue();
      provider.dispose();
      expect(provider.selfCheckPasses()).assertFalse();
    });
  });
}
