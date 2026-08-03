import { describe, it, expect } from '@ohos/hypium';
import {
  PageTurnProviderRegistry, PageTurnProviderHandle, PageTurnProviderRegisterInput,
  PageTurnWithdrawInput, PageTurnAcquireRequest, PageTurnLiveReadingState,
  PageTurnOperationResult, OperationName, PageTurnOperationRequest,
} from 'pageturn';
import { PageTurnCapabilityId } from 'pageturn';

// A minimal provider handle for tests. Real providers (cover/slide/none,
// scroll-anchor-commit, real3d-page-turn) are wired in later tasks; this fake
// records the operations the registry routes to it so the lease lifecycle can
// be asserted without a native renderer.
class FakeProvider implements PageTurnProviderHandle {
  private readonly cap: PageTurnCapabilityId;
  private readonly kind: string;
  private readonly ops: string[];
  private selfCheck: boolean;
  lostReasons: string[] = [];
  invokedOps: string[] = [];

  constructor(capability: PageTurnCapabilityId, providerKind: string, requiredOperations: string[],
    selfCheck: boolean) {
    this.cap = capability;
    this.kind = providerKind;
    this.ops = requiredOperations;
    this.selfCheck = selfCheck;
  }

  capability(): PageTurnCapabilityId { return this.cap; }
  providerKind(): string { return this.kind; }
  requiredOperations(): OperationName[] { return this.ops; }
  selfCheckPasses(): boolean { return this.selfCheck; }
  onOperation(operation: OperationName, _request: PageTurnOperationRequest): PageTurnOperationResult {
    this.invokedOps.push(operation);
    return { status: 'completed', detail: `${operation}-ok` };
  }
  onLeaseLost(_leaseId: string, reason: string): void {
    this.lostReasons.push(reason);
  }

  failSelfCheck(): void { this.selfCheck = false; }
}

// ArkTS forbids nested functions, so acquire/build helpers live at module scope.
function liveState(adjacent: boolean, continuous: boolean): PageTurnLiveReadingState {
  return {
    readerSurfaceHandle: 'surface-1',
    surfaceRect: { widthLogical: 390, heightLogical: 844 },
    currentPage: { revision: 7, token: 'page-current' },
    adjacentPage: adjacent ? { revision: 7, token: 'page-adjacent' } : undefined,
    continuousContent: continuous ? { revision: 7, token: 'continuous-1' } : undefined,
  };
}

function real3dRegisterInput(registry: PageTurnProviderRegistry, provider: FakeProvider,
  readerSessionId: string, layoutRev: number, surfaceRev: number, contentRev: number,
): PageTurnProviderRegisterInput {
  // Derive capability + providerKind from the handle so the input and the
  // handle's self-report are always consistent; the registry cross-checks
  // them and a mismatch test must exercise the contract-admission check, not
  // the handle-input consistency check.
  return {
    registryInstanceId: registry.instanceId(),
    capability: provider.capability(),
    providerKind: provider.providerKind(),
    providerHandle: provider,
    requiredOperations: ['bind-live-current-adjacent-surfaces',
      'render-live-current-front-back-and-adjacent-underlay',
      'update-finger-progress-continuously', 'settle-after-stored-true', 'rollback', 'dispose'],
    readerSessionId: readerSessionId,
    layoutRevision: layoutRev,
    surfaceRevision: surfaceRev,
    contentRevision: contentRev,
  };
}

function real3dAcquireRequest(readerSessionId: string, layoutRev: number, surfaceRev: number,
  contentRev: number): PageTurnAcquireRequest {
  return {
    capability: 'reader.page.turn.real3d.v1',
    modeId: 'simulation',
    readerSessionId: readerSessionId,
    layoutRevision: layoutRev,
    surfaceRevision: surfaceRev,
    contentRevision: contentRev,
    liveReadingState: liveState(true, false),
  };
}

export default function PageTurnProviderRegistryTests(): void {
  describe('PageTurnProviderRegistry', () => {
    it('registerAdmitsSelfCheckPassingProviderAtRegisteredReady', 0, () => {
      const registry = new PageTurnProviderRegistry('seed-1');
      const provider = new FakeProvider('reader.page.turn.real3d.v1',
        'real3d-page-turn-provider', [], true);
      const receipt = registry.register(real3dRegisterInput(registry, provider,
        'session-1', 7, 3, 11));
      expect(receipt.registered).assertTrue();
      expect(receipt.state).assertEqual('registered-ready');
      expect(receipt.registryInstanceId).assertEqual(registry.instanceId());
      expect(receipt.capability).assertEqual('reader.page.turn.real3d.v1');
      expect(receipt.providerKind).assertEqual('real3d-page-turn-provider');
      expect(receipt.registrationEpoch >= 1).assertTrue();
    });

    it('registerRejectsProviderKindNotAdmittedByCapability', 0, () => {
      const registry = new PageTurnProviderRegistry('seed-2');
      // real3d capability is pinned to providerKind 'real3d-page-turn-provider';
      // a mismatched kind is rejected, not silently normalized.
      const provider = new FakeProvider('reader.page.turn.real3d.v1',
        'wrong-kind', [], true);
      const receipt = registry.register(real3dRegisterInput(registry, provider,
        'session-1', 7, 3, 11));
      expect(receipt.registered).assertFalse();
      expect(receipt.state).assertEqual('rejected-capability-provider-kind-mismatch');
    });

    it('registerRejectsProviderWhoseSelfCheckFails', 0, () => {
      const registry = new PageTurnProviderRegistry('seed-3');
      const provider = new FakeProvider('reader.page.turn.real3d.v1',
        'real3d-page-turn-provider', [], false);
      const receipt = registry.register(real3dRegisterInput(registry, provider,
        'session-1', 7, 3, 11));
      expect(receipt.registered).assertFalse();
      expect(receipt.state).assertEqual('rejected-self-check-failed');
    });

    it('acquireAdmitsLeaseForReadyProviderWithBinding', 0, () => {
      const registry = new PageTurnProviderRegistry('seed-4');
      const provider = new FakeProvider('reader.page.turn.real3d.v1',
        'real3d-page-turn-provider', [], true);
      registry.register(real3dRegisterInput(registry, provider, 'session-1', 7, 3, 11));
      const response = registry.acquire(real3dAcquireRequest('session-1', 7, 3, 11));
      expect(response.admitted).assertTrue();
      expect(response.state).assertEqual('registered-ready');
      expect(response.capability).assertEqual('reader.page.turn.real3d.v1');
      expect(response.providerKind).assertEqual('real3d-page-turn-provider');
      expect(response.leaseId.length > 0).assertTrue();
      expect(response.lease !== undefined).assertTrue();
      expect(response.lease!.isReady).assertTrue();
      expect(response.lease!.registrationEpoch >= 1).assertTrue();
    });

    it('acquireFailsClosedWhenNoProviderRegistered_NoFallback', 0, () => {
      // The contract pins unavailable="fail-closed". With no provider
      // registered, acquire MUST return admitted=false and no lease; there is
      // no degradation to slide/CSS rotation/image frames. The coordinator
      // relies on this to make simulation explicitly unavailable.
      const registry = new PageTurnProviderRegistry('seed-5');
      const response = registry.acquire(real3dAcquireRequest('session-1', 7, 3, 11));
      expect(response.admitted).assertFalse();
      expect(response.state).assertEqual('unavailable-no-provider');
      expect(response.lease).assertEqual(undefined);
      expect(response.leaseId).assertEqual('');
    });

    it('acquireFailsClosedWhenRevisionsMismatch', 0, () => {
      const registry = new PageTurnProviderRegistry('seed-6');
      const provider = new FakeProvider('reader.page.turn.real3d.v1',
        'real3d-page-turn-provider', [], true);
      registry.register(real3dRegisterInput(registry, provider, 'session-1', 7, 3, 11));
      // Stale layout revision -> not ready -> fail closed.
      const response = registry.acquire(real3dAcquireRequest('session-1', 999, 3, 11));
      expect(response.admitted).assertFalse();
      expect(response.state).assertEqual('unavailable-no-provider');
    });

    it('withdrawInvalidatesEpochAndRevokesLiveLease', 0, () => {
      const registry = new PageTurnProviderRegistry('seed-7');
      const provider = new FakeProvider('reader.page.turn.real3d.v1',
        'real3d-page-turn-provider', [], true);
      const reg = registry.register(real3dRegisterInput(registry, provider,
        'session-1', 7, 3, 11));
      const acquire = registry.acquire(real3dAcquireRequest('session-1', 7, 3, 11));
      expect(acquire.admitted).assertTrue();
      const withdrawInput: PageTurnWithdrawInput = {
        registryInstanceId: registry.instanceId(),
        registrationEpoch: reg.registrationEpoch,
        capability: 'reader.page.turn.real3d.v1',
        providerKind: 'real3d-page-turn-provider',
        readerSessionId: 'session-1',
        layoutRevision: 7,
        surfaceRevision: 3,
        contentRevision: 11,
        reason: 'session-detached',
      };
      const withdrawn = registry.withdraw(withdrawInput);
      expect(withdrawn.withdrawn).assertTrue();
      expect(withdrawn.state).assertEqual('withdrawn');
      // The live lease was revoked and onLeaseLost fired on the provider.
      expect(provider.lostReasons.length).assertEqual(1);
      expect(provider.lostReasons[0]).assertEqual('session-detached');
      expect(registry.isLeaseReady(acquire.leaseId)).assertFalse();
      // A subsequent acquire is fail-closed.
      const again = registry.acquire(real3dAcquireRequest('session-1', 7, 3, 11));
      expect(again.admitted).assertFalse();
    });

    it('invokeRoutesOperationThroughLiveLeaseOnly', 0, () => {
      const registry = new PageTurnProviderRegistry('seed-8');
      const provider = new FakeProvider('reader.page.turn.real3d.v1',
        'real3d-page-turn-provider', [], true);
      registry.register(real3dRegisterInput(registry, provider, 'session-1', 7, 3, 11));
      const acquire = registry.acquire(real3dAcquireRequest('session-1', 7, 3, 11));
      const binding = registry.leaseBinding(acquire.leaseId);
      expect(binding !== undefined).assertTrue();
      const receipt = registry.invoke('update-finger-progress-continuously',
        acquire.leaseId, binding!);
      expect(receipt.result.status).assertEqual('completed');
      expect(provider.invokedOps.length).assertEqual(1);
      expect(provider.invokedOps[0]).assertEqual('update-finger-progress-continuously');
    });

    it('invokeRejectedAfterLeaseLost', 0, () => {
      const registry = new PageTurnProviderRegistry('seed-9');
      const provider = new FakeProvider('reader.page.turn.real3d.v1',
        'real3d-page-turn-provider', [], true);
      registry.register(real3dRegisterInput(registry, provider, 'session-1', 7, 3, 11));
      const acquire = registry.acquire(real3dAcquireRequest('session-1', 7, 3, 11));
      const binding = registry.leaseBinding(acquire.leaseId);
      expect(registry.reportLoss(acquire.leaseId, 'provider-crash')).assertTrue();
      const receipt = registry.invoke('settle-after-stored-true', acquire.leaseId, binding!);
      expect(receipt.result.status).assertEqual('rejected-no-lease');
      // onLeaseLost was fired by reportLoss.
      expect(provider.lostReasons.length).assertEqual(1);
    });

    it('isCapabilityAvailableReflectsSelfCheckRevisionsAndWithdrawal', 0, () => {
      const registry = new PageTurnProviderRegistry('seed-10');
      const provider = new FakeProvider('reader.page.turn.real3d.v1',
        'real3d-page-turn-provider', [], true);
      registry.register(real3dRegisterInput(registry, provider, 'session-1', 7, 3, 11));
      expect(registry.isCapabilityAvailable('reader.page.turn.real3d.v1',
        'session-1', 7, 3, 11)).assertTrue();
      expect(registry.isCapabilityAvailable('reader.page.turn.real3d.v1',
        'session-1', 999, 3, 11)).assertFalse();
      provider.failSelfCheck();
      expect(registry.isCapabilityAvailable('reader.page.turn.real3d.v1',
        'session-1', 7, 3, 11)).assertFalse();
    });
  });
}
