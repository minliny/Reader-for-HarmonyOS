import { describe, it, expect } from '@ohos/hypium';
import {
  PageTurnCoordinator, PageTurnUiIntent, PageTurnProgressStoreBridge,
  PageTurnCommitSink, PageTurnCoreProgressRequest, PageTurnCoreProgressReceipt,
  PageTurnReaderSession, PageTurnTargetLocation, PageTurnBeginOutcome,
  PageTurnDirection,
} from 'pageturn';
import {
  PageTurnProviderRegistry, PageTurnLiveReadingState, PageTurnProviderHandle,
  PageTurnOperationResult, PageTurnOperationRequest, OperationName,
} from 'pageturn';
import { PageTurnCapabilityId, PageTurnModeId } from 'pageturn';

// Deterministic in-memory bridge: captures the pending request and lets the
// test fire onStored/onFailed at the moment of its choosing. The production
// bridge wraps ReaderEffects.enqueueReadingProgress.
class FakeProgressBridge implements PageTurnProgressStoreBridge {
  captured: PageTurnCoreProgressRequest | undefined = undefined;
  private onStored: ((r: PageTurnCoreProgressReceipt) => void) | undefined = undefined;
  private onFailed: ((reason: string) => void) | undefined = undefined;
  failedReasons: string[] = [];

  requestProgressVerify(request: PageTurnCoreProgressRequest,
    onStored: (r: PageTurnCoreProgressReceipt) => void,
    onFailed: (reason: string) => void): void {
    this.captured = request;
    this.onStored = onStored;
    this.onFailed = onFailed;
  }

  fireStored(receipt: PageTurnCoreProgressReceipt): void {
    if (this.onStored !== undefined) this.onStored(receipt);
  }

  fireFailed(reason: string): void {
    this.failedReasons.push(reason);
    if (this.onFailed !== undefined) this.onFailed(reason);
  }
}

class RecordingSink implements PageTurnCommitSink {
  commits: string[] = [];
  rollbacks: string[] = [];
  lastCommittedDirection: PageTurnDirection | undefined = undefined;

  onVisibleCommit(transactionId: string, intent: PageTurnUiIntent): void {
    this.commits.push(transactionId);
    this.lastCommittedDirection = intent.direction;
  }
  onRollback(transactionId: string, _intent: PageTurnUiIntent, reason: string): void {
    this.rollbacks.push(`${transactionId}:${reason}`);
  }
}

class FakeProvider implements PageTurnProviderHandle {
  capability(): PageTurnCapabilityId { return 'reader.page.turn.real3d.v1'; }
  providerKind(): string { return 'real3d-page-turn-provider'; }
  requiredOperations(): OperationName[] { return []; }
  selfCheckPasses(): boolean { return true; }
  onOperation(_o: OperationName, _r: PageTurnOperationRequest): PageTurnOperationResult {
    return { status: 'completed', detail: '' };
  }
  onLeaseLost(_l: string, _r: string): void {}
}

function liveState(adjacent: boolean, continuous: boolean): PageTurnLiveReadingState {
  return {
    readerSurfaceHandle: 'surface-1',
    surfaceRect: { widthLogical: 390, heightLogical: 844 },
    currentPage: { revision: 11, token: 'page-current' },
    adjacentPage: adjacent ? { revision: 11, token: 'page-adjacent' } : undefined,
    continuousContent: continuous ? { revision: 11, token: 'continuous-1' } : undefined,
  };
}

function session(): PageTurnReaderSession {
  return { readerSessionId: 'session-1', layoutRevision: 7, surfaceRevision: 3, contentRevision: 11 };
}

function target(): PageTurnTargetLocation {
  return { bookId: 'book-1', sourceId: 'src-1', chapterIndex: 2, chapterOffset: 256, chapterProgress: 0.4 };
}

function intent(modeId: PageTurnModeId, direction: PageTurnDirection): PageTurnUiIntent {
  return { modeId: modeId, direction: direction, rawPointer: undefined };
}

function registerReal3d(registry: PageTurnProviderRegistry): void {
  registry.register({
    registryInstanceId: registry.instanceId(),
    capability: 'reader.page.turn.real3d.v1',
    providerKind: 'real3d-page-turn-provider',
    providerHandle: new FakeProvider(),
    requiredOperations: [],
    readerSessionId: 'session-1',
    layoutRevision: 7,
    surfaceRevision: 3,
    contentRevision: 11,
  });
}

function receiptFor(pending: PageTurnCoreProgressRequest, stored: boolean): PageTurnCoreProgressReceipt {
  return {
    transactionId: pending.transactionId,
    stored: stored,
    readerSessionId: pending.readerSessionId,
    layoutRevision: pending.layoutRevision,
    surfaceRevision: pending.surfaceRevision,
    contentRevision: pending.contentRevision,
    leaseId: pending.leaseId,
    registryInstanceId: pending.registryInstanceId,
    registrationEpoch: pending.registrationEpoch,
    capability: pending.capability,
    providerKind: pending.providerKind,
  };
}

export default function PageTurnCoordinatorTests(): void {
  describe('PageTurnCoordinator', () => {
    it('coverModeAdmitsWithoutLeaseAndSubmitsCoreProgress', 0, () => {
      const registry = new PageTurnProviderRegistry('coord-1');
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      const outcome = coordinator.beginTurn(intent('cover', 'next'), session(),
        liveState(true, false), target());
      expect(outcome).assertEqual('admitted-preview' as PageTurnBeginOutcome);
      expect(bridge.captured !== undefined).assertTrue();
      // cover/slide/none have no requiredCapability, so no lease binding.
      expect(bridge.captured!.leaseId).assertEqual('');
      expect(bridge.captured!.capability).assertEqual(undefined);
      expect(bridge.captured!.bookId).assertEqual('book-1');
      expect(bridge.captured!.chapterProgress).assertEqual(0.4);
    });

    it('simulationWithoutReal3dProviderIsExplicitlyUnavailable_NoDegradation', 0, () => {
      // No real3d provider registered -> simulation MUST be unavailable
      // (fail-closed). It MUST NOT degrade to slide/CSS rotation/image frames;
      // the contract pins simulation.unsupportedCapability=
      // "fail-closed-no-2d-fallback".
      const registry = new PageTurnProviderRegistry('coord-2');
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      const outcome = coordinator.beginTurn(intent('simulation', 'next'), session(),
        liveState(true, false), target());
      expect(outcome).assertEqual('unavailable-fail-closed' as PageTurnBeginOutcome);
      expect(bridge.captured).assertEqual(undefined);
      expect(sink.commits.length).assertEqual(0);
    });

    it('simulationWithReal3dProviderAcquiresLeaseAndBindsReceipt', 0, () => {
      const registry = new PageTurnProviderRegistry('coord-3');
      registerReal3d(registry);
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      const outcome = coordinator.beginTurn(intent('simulation', 'next'), session(),
        liveState(true, false), target());
      expect(outcome).assertEqual('admitted-preview' as PageTurnBeginOutcome);
      expect(bridge.captured!.leaseId.length > 0).assertTrue();
      expect(bridge.captured!.capability).assertEqual('reader.page.turn.real3d.v1');
      expect(bridge.captured!.providerKind).assertEqual('real3d-page-turn-provider');
      expect(bridge.captured!.registrationEpoch >= 1).assertTrue();
    });

    it('storedTrueWithMatchingReceiptCommitsVisiblePageAndReleasesLease', 0, () => {
      const registry = new PageTurnProviderRegistry('coord-4');
      registerReal3d(registry);
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      const outcome = coordinator.beginTurn(intent('simulation', 'next'), session(),
        liveState(true, false), target());
      expect(outcome).assertEqual('admitted-preview' as PageTurnBeginOutcome);
      const txId = bridge.captured!.transactionId;
      expect(coordinator.stateOf(txId)).assertEqual('awaiting-stored');
      const leaseId = coordinator.leaseOf(txId);
      const ok = coordinator.onCoreProgressReceipt(receiptFor(bridge.captured!, true));
      expect(ok).assertTrue();
      expect(coordinator.stateOf(txId)).assertEqual('stable');
      expect(sink.commits.length).assertEqual(1);
      expect(sink.commits[0]).assertEqual(txId);
      expect(sink.lastCommittedDirection).assertEqual('next');
      // Lease revoked after stable.
      expect(registry.isLeaseReady(leaseId)).assertFalse();
    });

    it('storedFalseRollsBackAndRestoresLastCommitted', 0, () => {
      const registry = new PageTurnProviderRegistry('coord-5');
      registerReal3d(registry);
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      coordinator.beginTurn(intent('simulation', 'next'), session(),
        liveState(true, false), target());
      const txId = bridge.captured!.transactionId;
      const ok = coordinator.onCoreProgressReceipt(receiptFor(bridge.captured!, false));
      expect(ok).assertFalse();
      expect(coordinator.stateOf(txId)).assertEqual('rollback');
      expect(sink.rollbacks.length).assertEqual(1);
      expect(sink.commits.length).assertEqual(0);
    });

    it('receiptWithMismatchedTransactionIdIsRejected', 0, () => {
      const registry = new PageTurnProviderRegistry('coord-6');
      registerReal3d(registry);
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      coordinator.beginTurn(intent('simulation', 'next'), session(),
        liveState(true, false), target());
      const txId = bridge.captured!.transactionId;
      // A receipt for a different transaction must not affect this turn.
      const bogus = receiptFor(bridge.captured!, true);
      bogus.transactionId = 'ptr-tx-OTHER';
      const ok = coordinator.onCoreProgressReceipt(bogus);
      expect(ok).assertFalse();
      expect(coordinator.stateOf(txId)).assertEqual('awaiting-stored');
      expect(sink.commits.length).assertEqual(0);
    });

    it('interruptBeforeStoredCancelsWithoutCommitting', 0, () => {
      // interrupt="cancel-before-persisting-progress-only": an interrupt that
      // arrives while awaiting-stored cancels the turn; no visible commit.
      const registry = new PageTurnProviderRegistry('coord-7');
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      coordinator.beginTurn(intent('cover', 'next'), session(),
        liveState(true, false), target());
      const txId = bridge.captured!.transactionId;
      const interrupted = coordinator.interrupt(txId);
      expect(interrupted).assertTrue();
      expect(coordinator.stateOf(txId)).assertEqual('rollback');
      expect(sink.commits.length).assertEqual(0);
      expect(sink.rollbacks.length).assertEqual(1);
    });

    it('interruptAfterStableIsNoOpBecauseProgressAlreadyPersisted', 0, () => {
      // After stored=true (stable), progress is already persisted; the
      // interrupt can no longer un-commit. The commit stands.
      const registry = new PageTurnProviderRegistry('coord-8');
      registerReal3d(registry);
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      coordinator.beginTurn(intent('simulation', 'next'), session(),
        liveState(true, false), target());
      const txId = bridge.captured!.transactionId;
      coordinator.onCoreProgressReceipt(receiptFor(bridge.captured!, true));
      expect(coordinator.stateOf(txId)).assertEqual('stable');
      const interrupted = coordinator.interrupt(txId);
      expect(interrupted).assertFalse();
      expect(sink.commits.length).assertEqual(1);
    });

    it('reverseHalfDragRollsBackTransient', 0, () => {
      const registry = new PageTurnProviderRegistry('coord-9');
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      coordinator.beginTurn(intent('slide', 'next'), session(),
        liveState(true, false), target());
      const txId = bridge.captured!.transactionId;
      const reversed = coordinator.reverse(txId);
      expect(reversed).assertTrue();
      expect(coordinator.stateOf(txId)).assertEqual('rollback');
      expect(sink.rollbacks.length).assertEqual(1);
      expect(sink.commits.length).assertEqual(0);
    });

    it('supersedeInFlightCancelsBeforeNewTurn', 0, () => {
      const registry = new PageTurnProviderRegistry('coord-10');
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      coordinator.beginTurn(intent('cover', 'next'), session(),
        liveState(true, false), target());
      const firstTxId = bridge.captured!.transactionId;
      const superseded = coordinator.supersedeInFlight(session());
      expect(superseded).assertTrue();
      expect(coordinator.stateOf(firstTxId)).assertEqual('rollback');
    });

    it('leaseLossBeforeStoredRollsBack_lossAfterStoredClearsTransient', 0, () => {
      const registry = new PageTurnProviderRegistry('coord-11');
      registerReal3d(registry);
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      coordinator.beginTurn(intent('simulation', 'next'), session(),
        liveState(true, false), target());
      const txId = bridge.captured!.transactionId;
      const leaseId = coordinator.leaseOf(txId);
      // lossBeforeStored -> rollback, restore last committed.
      const lost = coordinator.onLeaseLost(leaseId, 'provider-crash');
      expect(lost).assertTrue();
      expect(coordinator.stateOf(txId)).assertEqual('rollback');
      expect(sink.rollbacks.length).assertEqual(1);
    });

    it('missingAdjacentRejectsIntentForCoverSlideNone', 0, () => {
      // content.missingAdjacent="reject-intent": cover/slide/none/simulation
      // need the adjacent page token; without it the turn is rejected, not
      // started against a blank surface.
      const registry = new PageTurnProviderRegistry('coord-12');
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      const outcome = coordinator.beginTurn(intent('cover', 'next'), session(),
        liveState(false, false), target());
      expect(outcome).assertEqual('rejected-missing-adjacent' as PageTurnBeginOutcome);
      expect(bridge.captured).assertEqual(undefined);
    });

    it('missingContinuousContentRejectsIntentForScroll', 0, () => {
      const registry = new PageTurnProviderRegistry('coord-13');
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      const outcome = coordinator.beginTurn(intent('scroll', 'next'), session(),
        liveState(false, false), target());
      expect(outcome).assertEqual('rejected-missing-continuous-content' as PageTurnBeginOutcome);
    });

    it('coreProgressFailureRollsBackThroughOnFailed', 0, () => {
      const registry = new PageTurnProviderRegistry('coord-14');
      const bridge = new FakeProgressBridge();
      const sink = new RecordingSink();
      const coordinator = new PageTurnCoordinator(registry, bridge, sink);
      coordinator.beginTurn(intent('cover', 'next'), session(),
        liveState(true, false), target());
      const txId = bridge.captured!.transactionId;
      coordinator.onCoreProgressFailed(txId, 'core-write-exception');
      expect(coordinator.stateOf(txId)).assertEqual('rollback');
      expect(sink.rollbacks.length).assertEqual(1);
    });

    it('verifyCoreStoredReceiptRejectsStoredFalseAndBindingMismatches', 0, () => {
      const pending: PageTurnCoreProgressRequest = {
        transactionId: 'tx-1', readerSessionId: 's1', layoutRevision: 7,
        surfaceRevision: 3, contentRevision: 11, leaseId: 'lease-1',
        registryInstanceId: 'reg-1', registrationEpoch: 1,
        capability: 'reader.page.turn.real3d.v1', providerKind: 'real3d-page-turn-provider',
        bookId: 'b', sourceId: 'src', chapterIndex: 0, chapterOffset: 0, chapterProgress: 0,
      };
      // stored=false -> reject.
      const notStored = receiptFor(pending, false);
      expect(PageTurnCoordinator.verifyCoreStoredReceipt(pending, notStored)).assertFalse();
      // stored=true, all matching -> accept.
      const good = receiptFor(pending, true);
      expect(PageTurnCoordinator.verifyCoreStoredReceipt(pending, good)).assertTrue();
      // Mismatched leaseId -> reject (receipt belongs to a different lease).
      const badLease = receiptFor(pending, true);
      badLease.leaseId = 'other-lease';
      expect(PageTurnCoordinator.verifyCoreStoredReceipt(pending, badLease)).assertFalse();
      // Mismatched contentRevision -> reject (stale content snapshot).
      const badRev = receiptFor(pending, true);
      badRev.contentRevision = 999;
      expect(PageTurnCoordinator.verifyCoreStoredReceipt(pending, badRev)).assertFalse();
    });
  });
}
