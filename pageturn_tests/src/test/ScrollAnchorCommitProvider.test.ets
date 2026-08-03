import { describe, it, expect } from '@ohos/hypium';
import {
  ScrollAnchorCommitProvider, ScrollAnchorLayout,
} from 'pageturn';
import {
  PageTurnProviderRegistry, PageTurnAcquireRequest, PageTurnLiveReadingState,
  PageTurnLeaseBinding, PageTurnOperationRequest,
} from 'pageturn';

// Mirror the paginator's vertical fragment layouts. sourceOffset grows with
// top so resolveAnchorOnIdle can be asserted against the same logic
// reportVerticalScrollAnchor uses.
function layouts(): ScrollAnchorLayout[] {
  return [
    { top: 0, height: 100, sourceOffset: 0, bookId: 'b1', sourceId: 's1', chapterIndex: 0 },
    { top: 100, height: 100, sourceOffset: 500, bookId: 'b1', sourceId: 's1', chapterIndex: 0 },
    { top: 200, height: 100, sourceOffset: 1000, bookId: 'b1', sourceId: 's1', chapterIndex: 0 },
  ];
}

function liveState(): PageTurnLiveReadingState {
  return {
    readerSurfaceHandle: 'surface-1',
    surfaceRect: { widthLogical: 390, heightLogical: 844 },
    currentPage: { revision: 11, token: 'page-current' },
    adjacentPage: undefined,
    continuousContent: { revision: 11, token: 'continuous-1' },
  };
}

function scrollAcquireRequest(): PageTurnAcquireRequest {
  return {
    capability: 'reader.scroll.anchor-commit.v1',
    modeId: 'scroll',
    readerSessionId: 'session-1',
    layoutRevision: 7,
    surfaceRevision: 3,
    contentRevision: 11,
    liveReadingState: liveState(),
  };
}

function registerScroll(registry: PageTurnProviderRegistry, provider: ScrollAnchorCommitProvider): void {
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

export default function ScrollAnchorCommitProviderTests(): void {
  describe('ScrollAnchorCommitProvider', () => {
    it('providerKindAndRequiredOperationsMatchContract', 0, () => {
      const provider = new ScrollAnchorCommitProvider();
      expect(provider.capability()).assertEqual('reader.scroll.anchor-commit.v1');
      expect(provider.providerKind()).assertEqual('scroll-anchor-commit-provider');
      const ops = provider.requiredOperations();
      expect(ops.length).assertEqual(6);
      expect(ops[0]).assertEqual('bind-live-continuous-content');
      expect(ops[1]).assertEqual('subscribe-native-scroll-phase');
      expect(ops[2]).assertEqual('resolve-anchor-on-native-idle');
      expect(ops[3]).assertEqual('commit-anchor-after-stored-true');
      expect(ops[4]).assertEqual('restore-last-committed-anchor');
      expect(ops[5]).assertEqual('dispose');
    });

    it('selfCheckFailsBeforeBindAndPassesAfter', 0, () => {
      const provider = new ScrollAnchorCommitProvider();
      expect(provider.selfCheckPasses()).assertFalse();
      provider.bindLiveContinuousContent(layouts(), 2000);
      expect(provider.selfCheckPasses()).assertTrue();
    });

    it('resolveAnchorOnIdleMirrorsReportVerticalScrollAnchor', 0, () => {
      // offset within fragment A (0<=50<100) -> A, progress 0/2000.
      const provider = new ScrollAnchorCommitProvider();
      provider.bindLiveContinuousContent(layouts(), 2000);
      provider.onNativeScrollPhase(50);
      const a = provider.resolveAnchorOnIdle();
      expect(a !== null).assertTrue();
      expect(a!.sourceOffset).assertEqual(0);
      expect(a!.progress).assertEqual(0);
      // offset within fragment B (100<=150<200) -> B, progress 500/2000=0.25.
      provider.onNativeScrollPhase(150);
      const b = provider.resolveAnchorOnIdle();
      expect(b!.sourceOffset).assertEqual(500);
      expect(b!.progress).assertEqual(0.25);
      // offset within fragment C -> C, progress 1000/2000=0.5.
      provider.onNativeScrollPhase(250);
      const c = provider.resolveAnchorOnIdle();
      expect(c!.sourceOffset).assertEqual(1000);
      expect(c!.progress).assertEqual(0.5);
    });

    it('resolveAnchorFallsToNearestBeforeWhenBelowAllFragments', 0, () => {
      // offset 350 is below all fragments; nearestBefore is C (top<=350).
      const provider = new ScrollAnchorCommitProvider();
      provider.bindLiveContinuousContent(layouts(), 2000);
      provider.onNativeScrollPhase(350);
      const anchor = provider.resolveAnchorOnIdle();
      expect(anchor !== null).assertTrue();
      expect(anchor!.sourceOffset).assertEqual(1000);
      expect(anchor!.progress).assertEqual(0.5);
    });

    it('progressIsClampedToZeroOne', 0, () => {
      // sourceLength shorter than sourceOffset would clamp to 1.
      const provider = new ScrollAnchorCommitProvider();
      provider.bindLiveContinuousContent(layouts(), 100);
      provider.onNativeScrollPhase(250);
      const anchor = provider.resolveAnchorOnIdle();
      expect(anchor !== null).assertTrue();
      expect(anchor!.progress).assertEqual(1);
    });

    it('registerAndAcquireLeaseForScrollMode', 0, () => {
      const registry = new PageTurnProviderRegistry('scroll-1');
      const provider = new ScrollAnchorCommitProvider();
      provider.bindLiveContinuousContent(layouts(), 2000);
      registerScroll(registry, provider);
      const response = registry.acquire(scrollAcquireRequest());
      expect(response.admitted).assertTrue();
      expect(response.capability).assertEqual('reader.scroll.anchor-commit.v1');
      expect(response.providerKind).assertEqual('scroll-anchor-commit-provider');
      expect(response.leaseId.length > 0).assertTrue();
    });

    it('acquireFailsClosedBeforeContentIsBound', 0, () => {
      // registerWhen gates on provider-self-check-passes; an unbound provider
      // is not ready and acquire must be fail-closed (no fallback to a
      // local scroll commit).
      const registry = new PageTurnProviderRegistry('scroll-2');
      const provider = new ScrollAnchorCommitProvider();
      registerScroll(registry, provider); // not bound yet
      const response = registry.acquire(scrollAcquireRequest());
      expect(response.admitted).assertFalse();
      expect(response.state).assertEqual('unavailable-no-provider');
    });

    it('commitAndRestoreLastCommittedAnchor', 0, () => {
      const provider = new ScrollAnchorCommitProvider();
      provider.bindLiveContinuousContent(layouts(), 2000);
      provider.onNativeScrollPhase(150);
      const anchor = provider.resolveAnchorOnIdle()!;
      provider.recordCommittedAnchor(anchor);
      const restored = provider.restoreLastCommittedAnchor();
      expect(restored !== null).assertTrue();
      expect(restored!.sourceOffset).assertEqual(500);
      expect(restored!.progress).assertEqual(0.25);
    });

    it('onLeaseLostClearsTransientButRetainsLastCommitted', 0, () => {
      // lossBeforeStored clears the transient scroll offset; the last
      // committed anchor is retained so the host can restore it.
      const provider = new ScrollAnchorCommitProvider();
      provider.bindLiveContinuousContent(layouts(), 2000);
      provider.onNativeScrollPhase(150);
      const anchor = provider.resolveAnchorOnIdle()!;
      provider.recordCommittedAnchor(anchor);
      provider.onLeaseLost('lease-1', 'content-revision-invalidated');
      // After loss, resolving at the (now-cleared) transient offset yields the
      // first fragment, not the pre-loss position - transient is gone.
      const after = provider.resolveAnchorOnIdle();
      expect(after !== null).assertTrue();
      expect(after!.sourceOffset).assertEqual(0);
      // But the last committed anchor is still available for restore.
      const restored = provider.restoreLastCommittedAnchor();
      expect(restored !== null).assertTrue();
      expect(restored!.sourceOffset).assertEqual(500);
    });

    it('onOperationRoutesContractedOperations', 0, () => {
      const provider = new ScrollAnchorCommitProvider();
      provider.bindLiveContinuousContent(layouts(), 2000);
      const leaseId = 'lease-op';
      const binding: PageTurnLeaseBinding = {
        registryInstanceId: 'reg',
        registrationEpoch: 1,
        capability: 'reader.scroll.anchor-commit.v1',
        providerKind: 'scroll-anchor-commit-provider',
        readerSessionId: 'session-1',
        layoutRevision: 7,
        surfaceRevision: 3,
        contentRevision: 11,
      };
      const resolveReq: PageTurnOperationRequest = {
        operation: 'resolve-anchor-on-native-idle', operationId: 'op-1',
        leaseId: leaseId, binding: binding,
      };
      const resolve = provider.onOperation('resolve-anchor-on-native-idle', resolveReq);
      expect(resolve.status).assertEqual('completed');
      const restoreReq: PageTurnOperationRequest = {
        operation: 'restore-last-committed-anchor', operationId: 'op-2',
        leaseId: leaseId, binding: binding,
      };
      const restore = provider.onOperation('restore-last-committed-anchor', restoreReq);
      expect(restore.status).assertEqual('completed');
      const unknownReq: PageTurnOperationRequest = {
        operation: 'bogus', operationId: 'op-3',
        leaseId: leaseId, binding: binding,
      };
      const unknown = provider.onOperation('bogus', unknownReq);
      expect(unknown.status).assertEqual('rejected-unknown-operation');
    });

    it('disposeReleasesBoundContent', 0, () => {
      const provider = new ScrollAnchorCommitProvider();
      provider.bindLiveContinuousContent(layouts(), 2000);
      expect(provider.selfCheckPasses()).assertTrue();
      provider.dispose();
      expect(provider.selfCheckPasses()).assertFalse();
    });
  });
}
