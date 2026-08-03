// PageTurnCoordinator - the host-private transaction coordinator for the
// Reader-UI PageTurn v2 contract.
//
// It owns the per-turn state machine (idle -> prepared -> preview ->
// awaiting-stored -> settling -> stable, + rollback) and is the single place
// that ties three contract boundaries together:
//   1. capabilityRegistration - acquire/revoke the opaque lease from the
//      host-private PageTurnProviderRegistry (NOT Core's HostCapabilityRegistry).
//   2. shared.transaction / shared.stateMachine - visibleCommit only after
//      Core returns stored=true; failure/interrupt restore the last committed
//      page; interrupt cancels only before progress is persisted.
//   3. capabilityRegistration.coreProgressBridgeProtocol - the host-private
//      request-and-verify-progress-receipt lane. The coordinator submits the
//      turn's target location through an injected PageTurnProgressStoreBridge
//      (the production bridge reuses ReaderEffects.enqueueReadingProgress, so
//      Core stored=true is verified by the SAME lane the rest of the reader
//      uses - no parallel progress path is invented).
//
// The coordinator adds NO visual/motion parameters. It does not render pages,
// apply easing, or touch ArkUI. It only admits/revokes leases, drives the
// state machine, verifies the Core receipt, and signals the commit sink. The
// transient visual surfaces (cover/slide/none square surfaces, real3d surface,
// scroll anchor) are provider concerns in later tasks.
//
// All state-machine / transaction / loss values below are READ from the synced
// contract (PageTurnContract); if the upstream contract drifts, the
// PageTurnContract tests fail before this coordinator can misbehave.
import { PageTurnContract, PageTurnModeId, PageTurnCapabilityId } from './PageTurnContract';
import {
  PageTurnProviderRegistry, PageTurnRawPointer, PageTurnLiveReadingState,
  PageTurnLeaseBinding, LeaseId, RegistryInstanceId, RegistrationEpoch,
  ReaderSessionId, LayoutRevision, SurfaceRevision, ContentRevision,
  ProviderKind, PageTurnLease, PageTurnAcquireRequest, PageTurnAcquireResponse,
} from './PageTurnProviderRegistry';

export type PageTurnDirection = 'next' | 'prev';

// uiIntentFields = ["modeId", "direction", "rawPointer"]. The UI/settings may
// pass ONLY these three; capability injection is forbidden
// (uiCapabilityInjection="forbidden"). The coordinator never inspects
// rawPointer - it is opaque platform-ephemeral pointer state passed straight
// to a provider's gesture handler.
export interface PageTurnUiIntent {
  modeId: PageTurnModeId;
  direction: PageTurnDirection;
  rawPointer: PageTurnRawPointer | undefined;
}

export type PageTurnStateName =
  | 'idle' | 'prepared' | 'preview' | 'awaiting-stored' | 'settling' | 'stable' | 'rollback';

export type PageTurnBeginOutcome =
  | 'admitted-preview'
  | 'unavailable-fail-closed'
  | 'rejected-missing-adjacent'
  | 'rejected-missing-continuous-content'
  | 'rejected-no-contract'
  | 'rejected-mode-not-authorized';

export interface PageTurnReaderSession {
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
}

// The durable Core reading location the turn targets. The coordinator submits
// this through the progress bridge; Core stored=true for exactly this location
// is what gates the visible commit.
export interface PageTurnTargetLocation {
  bookId: string;
  sourceId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
}

// coreProgressRequestFields (plus the durable location Core must store).
export interface PageTurnCoreProgressRequest {
  transactionId: string;
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
  leaseId: LeaseId;
  registryInstanceId: RegistryInstanceId;
  registrationEpoch: RegistrationEpoch;
  capability: PageTurnCapabilityId | undefined;
  providerKind: ProviderKind;
  bookId: string;
  sourceId: string;
  chapterIndex: number;
  chapterOffset: number;
  chapterProgress: number;
}

// coreProgressReceiptFields. The host-private bridge verifies the pending
// transaction against this receipt (coreProgressReceiptVerification =
// "host-private-bridge-verifies-pending-transaction-v1").
export interface PageTurnCoreProgressReceipt {
  transactionId: string;
  stored: boolean;
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
  leaseId: LeaseId;
  registryInstanceId: RegistryInstanceId;
  registrationEpoch: RegistrationEpoch;
  capability: PageTurnCapabilityId | undefined;
  providerKind: ProviderKind;
}

// The production implementation wraps ReaderEffects.enqueueReadingProgress;
// tests inject a fake. The bridge MUST verify stored=true against the pending
// request before invoking onStored (mirroring
// ReaderEffects.requireStoredReadingProgress), so the coordinator treats
// onStored as already-verified.
export interface PageTurnProgressStoreBridge {
  requestProgressVerify(request: PageTurnCoreProgressRequest,
    onStored: (receipt: PageTurnCoreProgressReceipt) => void,
    onFailed: (reason: string) => void): void;
}

// The coordinator signals commit/rollback here; the reducer integration
// (task #4) translates these into reader-page-commit / reader-page-rollback.
// For horizontal modes (cover/slide/simulation/none) the sink advances the
// page index; for scroll the sink commits the anchor. The coordinator itself
// applies no index delta.
export interface PageTurnCommitSink {
  onVisibleCommit(transactionId: string, intent: PageTurnUiIntent): void;
  onRollback(transactionId: string, intent: PageTurnUiIntent, reason: string): void;
}

interface ActiveTurn {
  transactionId: string;
  intent: PageTurnUiIntent;
  session: PageTurnReaderSession;
  state: PageTurnStateName;
  leaseId: LeaseId;
  binding: PageTurnLeaseBinding | undefined;
  pending: PageTurnCoreProgressRequest | undefined;
}

export class PageTurnCoordinator {
  private readonly registry: PageTurnProviderRegistry;
  private readonly bridge: PageTurnProgressStoreBridge;
  private readonly sink: PageTurnCommitSink;
  private readonly turns: Map<string, ActiveTurn> = new Map<string, ActiveTurn>();
  private nextTransactionId: number = 1;

  constructor(registry: PageTurnProviderRegistry, bridge: PageTurnProgressStoreBridge,
    sink: PageTurnCommitSink) {
    this.registry = registry;
    this.bridge = bridge;
    this.sink = sink;
  }

  // ── beginTurn: idle -> prepared -> preview ────────────────────────────
  //
  // For modes with a requiredCapability (simulation -> real3d, scroll ->
  // anchor-commit), acquire the opaque lease; if no provider is ready, the
  // contract says unavailable="fail-closed" - the turn is explicitly
  // unavailable and MUST NOT degrade to slide/CSS rotation/image frames
  // (simulation.unsupportedCapability="fail-closed-no-2d-fallback",
  //  scroll.unsupportedCapability="fail-closed-no-local-scroll-commit").
  // For cover/slide/none there is no requiredCapability and no lease; the
  // state machine + stored=true gate still applies (none.commit: "沿用共享的
  // stored=true 后一次性提交").
  beginTurn(intent: PageTurnUiIntent, session: PageTurnReaderSession,
    live: PageTurnLiveReadingState, target: PageTurnTargetLocation,
  ): PageTurnBeginOutcome {
    if (!PageTurnContract.isContractPresent()) return 'rejected-no-contract';
    if (!PageTurnCoordinator.modeAuthorized(intent.modeId)) return 'rejected-mode-not-authorized';

    // content.missingAdjacent="reject-intent": cover/slide/simulation/none
    // need the adjacent page token; scroll needs continuous content.
    if (intent.modeId === 'scroll') {
      if (live.continuousContent === undefined) return 'rejected-missing-continuous-content';
    } else if (live.adjacentPage === undefined) {
      return 'rejected-missing-adjacent';
    }

    // Acquire the lease only if the mode requires a capability. cover/slide/
    // none are forbidden from declaring any capability, so they proceed with
    // no lease and an empty binding.
    const requiredCapability = PageTurnContract.requiredCapabilityFor(intent.modeId);
    let leaseId: LeaseId = '';
    let binding: PageTurnLeaseBinding | undefined = undefined;
    if (requiredCapability !== undefined) {
      const request: PageTurnAcquireRequest = {
        capability: requiredCapability,
        modeId: intent.modeId,
        readerSessionId: session.readerSessionId,
        layoutRevision: session.layoutRevision,
        surfaceRevision: session.surfaceRevision,
        contentRevision: session.contentRevision,
        liveReadingState: live,
      };
      const response: PageTurnAcquireResponse = this.registry.acquire(request);
      if (!response.admitted || response.lease === undefined) {
        // Explicitly unavailable. NO degradation path is taken.
        return 'unavailable-fail-closed';
      }
      leaseId = response.leaseId;
      binding = {
        registryInstanceId: response.registryInstanceId,
        registrationEpoch: response.registrationEpoch,
        capability: response.capability,
        providerKind: response.providerKind,
        readerSessionId: response.readerSessionId,
        layoutRevision: response.layoutRevision,
        surfaceRevision: response.surfaceRevision,
        contentRevision: response.contentRevision,
      };
    }

    const transactionId = `ptr-tx-${this.nextTransactionId}`;
    this.nextTransactionId += 1;
    const turn: ActiveTurn = {
      transactionId: transactionId,
      intent: intent,
      session: session,
      state: 'prepared',
      leaseId: leaseId,
      binding: binding,
      pending: undefined,
    };
    this.turns.set(transactionId, turn);

    // prepared -> preview: uncommitted live page snapshots (frozen during the
    // transient per content.snapshotPolicy="freeze-during-transient").
    turn.state = 'preview';

    // preview -> awaiting-stored: submit the Core progress request through
    // the host-private bridge. The bridge verifies stored=true and calls
    // back into onCoreProgressReceipt / onCoreProgressFailed.
    const pending: PageTurnCoreProgressRequest = {
      transactionId: transactionId,
      readerSessionId: session.readerSessionId,
      layoutRevision: session.layoutRevision,
      surfaceRevision: session.surfaceRevision,
      contentRevision: session.contentRevision,
      leaseId: leaseId,
      registryInstanceId: binding?.registryInstanceId ?? '',
      registrationEpoch: binding?.registrationEpoch ?? 0,
      capability: requiredCapability,
      providerKind: binding?.providerKind ?? '',
      bookId: target.bookId,
      sourceId: target.sourceId,
      chapterIndex: target.chapterIndex,
      chapterOffset: target.chapterOffset,
      chapterProgress: target.chapterProgress,
    };
    turn.pending = pending;
    turn.state = 'awaiting-stored';
    this.bridge.requestProgressVerify(pending,
      (receipt: PageTurnCoreProgressReceipt): void => { this.onCoreProgressReceipt(receipt); },
      (reason: string): void => { this.onCoreProgressFailed(transactionId, reason); });
    return 'admitted-preview';
  }

  // ── onCoreProgressReceipt: verify + transition to stable / rollback ────
  //
  // coreProgressReceiptVerification="host-private-bridge-verifies-pending-
  // transaction-v1": every binding field in the receipt must match the pending
  // request, and stored must be true. A mismatch means the receipt belongs to
  // a different/Superseded transaction and is rejected.
  onCoreProgressReceipt(receipt: PageTurnCoreProgressReceipt): boolean {
    const turn = this.turns.get(receipt.transactionId);
    if (turn === undefined) return false;
    if (!PageTurnCoordinator.verifyCoreStoredReceipt(turn.pending, receipt)) {
      this.rollback(turn, 'receipt-verification-failed');
      return false;
    }
    // awaiting-stored -> settling -> stable. visibleCommit fires at stable.
    turn.state = 'settling';
    turn.state = 'stable';
    this.sink.onVisibleCommit(turn.transactionId, turn.intent);
    // The lease is revoked once the turn is stable; the provider is released
    // for the next turn.
    if (turn.leaseId.length > 0) {
      this.registry.release(turn.leaseId);
    }
    return true;
  }

  onCoreProgressFailed(transactionId: string, reason: string): void {
    const turn = this.turns.get(transactionId);
    if (turn === undefined) return;
    this.rollback(turn, reason);
  }

  // ── interrupt: cancel-before-persisting-progress-only ──────────────────
  //
  // An interrupt (oppositeTurn / chapterJump / routeChange / sessionTick)
  // cancels the turn ONLY if it arrives before Core has persisted progress
  // (state preview or awaiting-stored). After stored=true (stable), progress
  // is already persisted and the interrupt is a no-op for this turn - the
  // next intent begins a fresh turn.
  interrupt(transactionId: string): boolean {
    const turn = this.turns.get(transactionId);
    if (turn === undefined) return false;
    if (turn.state === 'stable' || turn.state === 'settling') return false;
    this.rollback(turn, 'interrupt-cancel-before-persisting');
    return true;
  }

  // ── reverse: half-drag cancel/reverse recovery ───────────────────────
  //
  // The pointer crossed back past the completion threshold (or the user
  // reversed direction mid-drag). The transient is reversed and the last
  // committed page is restored. This is the rollback path used by gesture
  // cancel/reverse.
  reverse(transactionId: string): boolean {
    const turn = this.turns.get(transactionId);
    if (turn === undefined) return false;
    if (turn.state === 'stable') return false;
    this.rollback(turn, 'reverse-to-last-committed');
    return true;
  }

  // ── reorder recovery: a new turn supersedes an in-flight one ───────────
  //
  // If a new turn arrives while one is still in-flight (e.g., next then
  // quickly prev), the in-flight turn is interrupted (cancel-before-
  // persisting) before the new turn begins. Returns true if a turn was
  // superseded.
  supersedeInFlight(session: PageTurnReaderSession): boolean {
    let superseded = false;
    this.turns.forEach((turn: ActiveTurn) => {
      if (turn.session.readerSessionId === session.readerSessionId &&
        turn.state !== 'stable' && turn.state !== 'rollback') {
        this.rollback(turn, 'superseded-by-reorder');
        superseded = true;
      }
    });
    return superseded;
  }

  // ── lease loss: lossBeforeStored vs lossAfterStored ────────────────────
  //
  // capabilityRegistration.lossBeforeStored=
  //   "provider-rollback-or-restore-and-clear-transient"
  // lossAfterStored=
  //   "rebuild-from-core-canonical-state-and-clear-transient"
  onLeaseLost(leaseId: LeaseId, reason: string): boolean {
    let handled = false;
    this.turns.forEach((turn: ActiveTurn) => {
      if (turn.leaseId === leaseId) {
        if (turn.state === 'stable') {
          // lossAfterStored: the commit already happened; rebuild from Core's
          // canonical state. The transient is cleared; no rollback of the
          // committed page.
          turn.state = 'rollback';
          if (turn.leaseId.length > 0) this.registry.release(turn.leaseId);
        } else {
          // lossBeforeStored: rollback the transient and restore the last
          // committed page.
          this.rollback(turn, `lease-lost-before-stored:${reason}`);
        }
        handled = true;
      }
    });
    return handled;
  }

  // ── revoke: release the lease after the turn is done ───────────────────
  revoke(transactionId: string): boolean {
    const turn = this.turns.get(transactionId);
    if (turn === undefined) return false;
    if (turn.leaseId.length > 0) this.registry.release(turn.leaseId);
    return this.turns.delete(transactionId);
  }

  // ── queries for tests / integration ───────────────────────────────────
  stateOf(transactionId: string): PageTurnStateName | undefined {
    return this.turns.get(transactionId)?.state;
  }

  intentOf(transactionId: string): PageTurnUiIntent | undefined {
    return this.turns.get(transactionId)?.intent;
  }

  leaseOf(transactionId: string): LeaseId {
    return this.turns.get(transactionId)?.leaseId ?? '';
  }

  // ── host-private-bridge-verifies-pending-transaction-v1 ────────────────
  static verifyCoreStoredReceipt(pending: PageTurnCoreProgressRequest | undefined,
    receipt: PageTurnCoreProgressReceipt): boolean {
    if (pending === undefined) return false;
    if (receipt.transactionId !== pending.transactionId) return false;
    if (receipt.stored !== true) return false;
    if (receipt.readerSessionId !== pending.readerSessionId) return false;
    if (receipt.layoutRevision !== pending.layoutRevision) return false;
    if (receipt.surfaceRevision !== pending.surfaceRevision) return false;
    if (receipt.contentRevision !== pending.contentRevision) return false;
    if (receipt.leaseId !== pending.leaseId) return false;
    if (receipt.registryInstanceId !== pending.registryInstanceId) return false;
    if (receipt.registrationEpoch !== pending.registrationEpoch) return false;
    if (receipt.capability !== pending.capability) return false;
    if (receipt.providerKind !== pending.providerKind) return false;
    return true;
  }

  private rollback(turn: ActiveTurn, reason: string): void {
    turn.state = 'rollback';
    this.sink.onRollback(turn.transactionId, turn.intent, reason);
    if (turn.leaseId.length > 0) {
      this.registry.release(turn.leaseId);
    }
  }

  private static modeAuthorized(modeId: PageTurnModeId): boolean {
    const ids = PageTurnContract.modeIds();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] === modeId) return true;
    }
    return false;
  }
}

// Re-export the lease type for the coordinator's callers so they do not need a
// second import path.
export type { PageTurnLease };
