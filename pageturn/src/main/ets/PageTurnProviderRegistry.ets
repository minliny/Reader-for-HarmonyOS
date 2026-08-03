// PageTurnProviderRegistry - host-private provider registry for the Reader-UI
// PageTurn v2 contract's capabilityRegistration block.
//
// This is deliberately NOT Core's generic HostCapabilityRegistry. The
// contract pins page-turn capability registration to a separate, host-owned
// authority (capabilityRegistration.registrationAuthority =
// "platform-reader-host-provider-registry") with its own opaque lease
// protocol. Reusing HostCapabilityRegistry would let Core/UI inject page-turn
// capability or fall back to the parent 220ms spec, both of which the contract
// forbids (uiCapabilityInjection="forbidden", parentPresentationFallback=
// "forbidden"). This registry is the single host-private surface that mints
// registryInstanceId + monotonic registrationEpoch, admits providers, and
// routes opaque leases + operations to them.
//
// Every field list below mirrors the synced contract artifact at
// ./contract/Motion.ets (reader.page.turn.next-prev ->
// engineeringProfile.capabilityRegistration). This file adds NO contract
// values; it only enforces the lifecycle the contract already carries.
import { PageTurnContract, PageTurnModeId, PageTurnCapabilityId } from './PageTurnContract';

// The host mints a registryInstanceId once per registry instance; it is
// replaced only on registry recreate and is never UI-controlled
// (registrationLifecycle.registryInstanceIdLifecycle).
export type RegistryInstanceId = string;
// Monotonic per-registry-instance, assigned on register, never reused;
// withdraw invalidates that epoch (registrationEpochLifecycle).
export type RegistrationEpoch = number;
export type LeaseId = string;
export type ReaderSessionId = string;
export type ProviderKind = string;
export type OperationName = string;
export type OperationId = string;

// Revisions carried through every register/acquire/operation/receipt so a
// provider built against a stale layout/surface/content snapshot fails closed
// rather than rendering against superseded page data.
export type LayoutRevision = number;
export type SurfaceRevision = number;
export type ContentRevision = number;

// The opaque platform-ephemeral pointer sample. UI/settings may pass it
// through (uiIntentFields includes "rawPointer") but neither this registry,
// the coordinator, nor settings may inspect or synthesize it
// (uiCapabilityInjection="forbidden"). It is only handed to a provider's
// gesture handler.
export interface PageTurnRawPointer {
  // Intentionally opaque. The host never reads these fields; they exist only
  // so a provider can echo the platform pointer token it was handed.
  token: string;
}

// A live reading surface handle + measured rect handed to a provider at
// acquire time (acquireRequestFields: readerSurfaceHandle, surfaceRect,
// currentPage, adjacentPage, continuousContent). currentPage/adjacentPage
// are opaque page tokens the paginator produced for the current revision;
// continuousContent is the continuous-content token for scroll mode. The
// registry and coordinator never inspect their internals.
export interface PageTurnSurfaceRect {
  widthLogical: number;
  heightLogical: number;
}
export interface PageTurnLivePageToken {
  revision: ContentRevision;
  token: string;
}
export interface PageTurnLiveReadingState {
  readerSurfaceHandle: string;
  surfaceRect: PageTurnSurfaceRect;
  currentPage: PageTurnLivePageToken;
  adjacentPage: PageTurnLivePageToken | undefined;
  continuousContent: PageTurnLivePageToken | undefined;
}

// A provider handle is what a native page-turn provider (cover/slide/none,
// scroll-anchor-commit, real3d-page-turn) implements and registers. The
// registry stores it keyed by capability and routes operations to it.
export interface PageTurnProviderHandle {
  capability(): PageTurnCapabilityId;
  providerKind(): ProviderKind;
  requiredOperations(): OperationName[];
  // registerWhen / withdrawWhen gate. A provider that fails its self-check
  // must not be admitted; a provider whose self-check later fails must be
  // withdrawn with providerLoss.
  selfCheckPasses(): boolean;
  // Invoked through a valid lease only. The provider must NOT be reachable
  // except via a lease the registry admitted (acquisition =
  // "registry-acquire-opaque-lease-v1").
  onOperation(operation: OperationName, request: PageTurnOperationRequest): PageTurnOperationResult;
  // The registry calls this when a lease is lost (onLost in leaseFields) so
  // the provider can roll back its transient state.
  onLeaseLost(leaseId: LeaseId, reason: string): void;
}

export type PageTurnOperationStatus =
  | 'completed'
  | 'rejected-no-lease'
  | 'rejected-stale-revision'
  | 'rejected-withdrawn'
  | 'rejected-unknown-operation';

export interface PageTurnOperationResult {
  status: PageTurnOperationStatus;
  detail: string;
}

// ── register / withdraw DTOs (registerInputFields / withdrawInputFields) ──
export interface PageTurnProviderRegisterInput {
  registryInstanceId: RegistryInstanceId;
  capability: PageTurnCapabilityId;
  providerKind: ProviderKind;
  providerHandle: PageTurnProviderHandle;
  requiredOperations: OperationName[];
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
}

export interface PageTurnRegisterReceipt {
  registered: boolean;
  state: string; // "registered-ready" | "rejected-self-check-failed" | ...
  registryInstanceId: RegistryInstanceId;
  registrationEpoch: RegistrationEpoch;
  capability: PageTurnCapabilityId;
  providerKind: ProviderKind;
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
}

export interface PageTurnWithdrawInput {
  registryInstanceId: RegistryInstanceId;
  registrationEpoch: RegistrationEpoch;
  capability: PageTurnCapabilityId;
  providerKind: ProviderKind;
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
  reason: string;
}

export interface PageTurnWithdrawReceipt {
  withdrawn: boolean;
  state: string; // "withdrawn" | "rejected-unknown-epoch" | ...
  registryInstanceId: RegistryInstanceId;
  registrationEpoch: RegistrationEpoch;
  capability: PageTurnCapabilityId;
  providerKind: ProviderKind;
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
  reason: string;
}

// ── acquire DTOs (acquireRequestFields / acquireResponseFields) ──
export interface PageTurnAcquireRequest {
  capability: PageTurnCapabilityId;
  modeId: PageTurnModeId;
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
  liveReadingState: PageTurnLiveReadingState;
}

// The opaque lease (leaseFields). onLost/invoke are exposed as registry
// methods (reportLoss / invoke) keyed by leaseId rather than as function
// fields, so the lease object stays serializable and the registry remains the
// single routing authority.
export interface PageTurnLease {
  leaseId: LeaseId;
  registryInstanceId: RegistryInstanceId;
  registrationEpoch: RegistrationEpoch;
  isReady: boolean;
}

export interface PageTurnAcquireResponse {
  admitted: boolean;
  state: string; // "registered-ready" | "unavailable-no-provider" | ...
  registryInstanceId: RegistryInstanceId;
  capability: PageTurnCapabilityId;
  providerKind: ProviderKind;
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
  leaseId: LeaseId;
  registrationEpoch: RegistrationEpoch;
  lease: PageTurnLease | undefined;
}

// leaseBindingFields - the binding carried alongside every operation/receipt
// so a stale or withdrawn epoch is rejected before reaching the provider.
export interface PageTurnLeaseBinding {
  registryInstanceId: RegistryInstanceId;
  registrationEpoch: RegistrationEpoch;
  capability: PageTurnCapabilityId;
  providerKind: ProviderKind;
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
}

export interface PageTurnOperationRequest {
  operation: OperationName;
  operationId: OperationId;
  leaseId: LeaseId;
  binding: PageTurnLeaseBinding;
}

export interface PageTurnOperationReceipt {
  operationId: OperationId;
  leaseId: LeaseId;
  binding: PageTurnLeaseBinding;
  result: PageTurnOperationResult;
}

interface RegisteredProvider {
  capability: PageTurnCapabilityId;
  providerKind: ProviderKind;
  handle: PageTurnProviderHandle;
  requiredOperations: OperationName[];
  readerSessionId: ReaderSessionId;
  layoutRevision: LayoutRevision;
  surfaceRevision: SurfaceRevision;
  contentRevision: ContentRevision;
  epoch: RegistrationEpoch;
  withdrawn: boolean;
}

interface ActiveLease {
  leaseId: LeaseId;
  binding: PageTurnLeaseBinding;
  providerCapability: PageTurnCapabilityId;
  lost: boolean;
}

// A self-contained registryInstanceId minted at construction. The contract
// says it is "minted-by-host-on-registry-create-replaced-on-registry-recreate-
// not-ui-controlled"; a deterministic counter keeps tests reproducible without
// Date.now/random.
function mintRegistryInstanceId(seed: string): RegistryInstanceId {
  return `ptr-registry-${seed}`;
}

export class PageTurnProviderRegistry {
  private readonly registryInstanceId: RegistryInstanceId;
  private readonly providers: Map<PageTurnCapabilityId, RegisteredProvider> =
    new Map<PageTurnCapabilityId, RegisteredProvider>();
  private readonly leases: Map<LeaseId, ActiveLease> = new Map<LeaseId, ActiveLease>();
  private nextEpoch: RegistrationEpoch = 1;
  private nextLeaseId: number = 1;

  constructor(registryInstanceIdSeed: string) {
    this.registryInstanceId = mintRegistryInstanceId(registryInstanceIdSeed);
  }

  instanceId(): RegistryInstanceId {
    return this.registryInstanceId;
  }

  // ── register / withdraw ───────────────────────────────────────────────
  register(input: PageTurnProviderRegisterInput): PageTurnRegisterReceipt {
    // A provider whose self-check fails is not admitted (registerWhen gates
    // on provider-self-check-passes).
    if (input.registryInstanceId !== this.registryInstanceId) {
      return PageTurnProviderRegistry.rejectRegister(input, 'rejected-unknown-registry-instance');
    }
    if (!input.providerHandle.selfCheckPasses()) {
      return PageTurnProviderRegistry.rejectRegister(input, 'rejected-self-check-failed');
    }
    // The handle must self-report the same capability + providerKind the
    // registration input declares, so a handle can never be stored under a
    // capability/kind it does not actually serve.
    if (input.providerHandle.capability() !== input.capability ||
      input.providerHandle.providerKind() !== input.providerKind) {
      return PageTurnProviderRegistry.rejectRegister(input, 'rejected-handle-input-mismatch');
    }
    if (!PageTurnProviderRegistry.capabilityAdmitsProviderKind(input.capability, input.providerKind)) {
      return PageTurnProviderRegistry.rejectRegister(input, 'rejected-capability-provider-kind-mismatch');
    }
    const epoch = this.nextEpoch;
    this.nextEpoch += 1;
    const provider: RegisteredProvider = {
      capability: input.capability,
      providerKind: input.providerKind,
      handle: input.providerHandle,
      requiredOperations: input.requiredOperations,
      readerSessionId: input.readerSessionId,
      layoutRevision: input.layoutRevision,
      surfaceRevision: input.surfaceRevision,
      contentRevision: input.contentRevision,
      epoch: epoch,
      withdrawn: false,
    };
    this.providers.set(input.capability, provider);
    return {
      registered: true,
      state: PageTurnContract.capabilityRegistration()?.registrationLifecycle.registerState ?? 'registered-ready',
      registryInstanceId: this.registryInstanceId,
      registrationEpoch: epoch,
      capability: input.capability,
      providerKind: input.providerKind,
      readerSessionId: input.readerSessionId,
      layoutRevision: input.layoutRevision,
      surfaceRevision: input.surfaceRevision,
      contentRevision: input.contentRevision,
    };
  }

  private static rejectRegister(input: PageTurnProviderRegisterInput, state: string): PageTurnRegisterReceipt {
    return {
      registered: false,
      state: state,
      registryInstanceId: input.registryInstanceId,
      registrationEpoch: 0,
      capability: input.capability,
      providerKind: input.providerKind,
      readerSessionId: input.readerSessionId,
      layoutRevision: input.layoutRevision,
      surfaceRevision: input.surfaceRevision,
      contentRevision: input.contentRevision,
    };
  }

  withdraw(input: PageTurnWithdrawInput): PageTurnWithdrawReceipt {
    const provider = this.providers.get(input.capability);
    if (provider === undefined || provider.epoch !== input.registrationEpoch ||
      input.registryInstanceId !== this.registryInstanceId) {
      return PageTurnProviderRegistry.rejectWithdraw(input, 'rejected-unknown-epoch');
    }
    provider.withdrawn = true;
    // Revoke every live lease bound to this provider's epoch so onLost fires
    // for each (leaseProtocol "opaque-lease-isReady-onLost-invoke-v1").
    const revokedLeaseIds: LeaseId[] = [];
    this.leases.forEach((lease: ActiveLease, leaseId: LeaseId) => {
      if (lease.binding.registrationEpoch === input.registrationEpoch &&
        lease.binding.capability === input.capability && !lease.lost) {
        lease.lost = true;
        revokedLeaseIds.push(leaseId);
      }
    });
    for (let i = 0; i < revokedLeaseIds.length; i++) {
      const lease = this.leases.get(revokedLeaseIds[i]);
      if (lease !== undefined) {
        provider.handle.onLeaseLost(revokedLeaseIds[i], input.reason);
      }
    }
    return {
      withdrawn: true,
      state: PageTurnContract.capabilityRegistration()?.registrationLifecycle.withdrawState ?? 'withdrawn',
      registryInstanceId: this.registryInstanceId,
      registrationEpoch: input.registrationEpoch,
      capability: input.capability,
      providerKind: input.providerKind,
      readerSessionId: input.readerSessionId,
      layoutRevision: input.layoutRevision,
      surfaceRevision: input.surfaceRevision,
      contentRevision: input.contentRevision,
      reason: input.reason,
    };
  }

  private static rejectWithdraw(input: PageTurnWithdrawInput, state: string): PageTurnWithdrawReceipt {
    return {
      withdrawn: false,
      state: state,
      registryInstanceId: input.registryInstanceId,
      registrationEpoch: input.registrationEpoch,
      capability: input.capability,
      providerKind: input.providerKind,
      readerSessionId: input.readerSessionId,
      layoutRevision: input.layoutRevision,
      surfaceRevision: input.surfaceRevision,
      contentRevision: input.contentRevision,
      reason: input.reason,
    };
  }

  // ── availabilityCheck: "lease-is-ready-before-each-transition" ────────
  isCapabilityAvailable(capability: PageTurnCapabilityId, readerSessionId: ReaderSessionId,
    layoutRevision: LayoutRevision, surfaceRevision: SurfaceRevision,
    contentRevision: ContentRevision): boolean {
    const provider = this.providers.get(capability);
    if (provider === undefined || provider.withdrawn) return false;
    if (!provider.handle.selfCheckPasses()) return false;
    if (provider.readerSessionId !== readerSessionId ||
      provider.layoutRevision !== layoutRevision ||
      provider.surfaceRevision !== surfaceRevision ||
      provider.contentRevision !== contentRevision) {
      return false;
    }
    return true;
  }

  // ── acquire: "registry-acquire-opaque-lease-v1" ───────────────────────
  acquire(request: PageTurnAcquireRequest): PageTurnAcquireResponse {
    const provider = this.providers.get(request.capability);
    const admitted = provider !== undefined && !provider.withdrawn &&
      provider.handle.selfCheckPasses() &&
      provider.readerSessionId === request.readerSessionId &&
      provider.layoutRevision === request.layoutRevision &&
      provider.surfaceRevision === request.surfaceRevision &&
      provider.contentRevision === request.contentRevision;
    if (!admitted || provider === undefined) {
      // unavailable="fail-closed": no provider, no lease, no fallback.
      return PageTurnProviderRegistry.unavailable(request);
    }
    const leaseId = `ptr-lease-${this.nextLeaseId}`;
    this.nextLeaseId += 1;
    const binding: PageTurnLeaseBinding = {
      registryInstanceId: this.registryInstanceId,
      registrationEpoch: provider.epoch,
      capability: request.capability,
      providerKind: provider.providerKind,
      readerSessionId: request.readerSessionId,
      layoutRevision: request.layoutRevision,
      surfaceRevision: request.surfaceRevision,
      contentRevision: request.contentRevision,
    };
    const lease: PageTurnLease = {
      leaseId: leaseId,
      registryInstanceId: this.registryInstanceId,
      registrationEpoch: provider.epoch,
      isReady: true,
    };
    this.leases.set(leaseId, {
      leaseId: leaseId,
      binding: binding,
      providerCapability: request.capability,
      lost: false,
    });
    return {
      admitted: true,
      state: PageTurnContract.capabilityRegistration()?.readyState ?? 'registered-ready',
      registryInstanceId: this.registryInstanceId,
      capability: request.capability,
      providerKind: provider.providerKind,
      readerSessionId: request.readerSessionId,
      layoutRevision: request.layoutRevision,
      surfaceRevision: request.surfaceRevision,
      contentRevision: request.contentRevision,
      leaseId: leaseId,
      registrationEpoch: provider.epoch,
      lease: lease,
    };
  }

  private static unavailable(request: PageTurnAcquireRequest): PageTurnAcquireResponse {
    // unavailable="fail-closed": no provider, no lease, no fallback. The
    // coordinator must treat this as explicitly unavailable and MUST NOT
    // degrade to slide/CSS rotation/image frames.
    return {
      admitted: false,
      state: 'unavailable-no-provider',
      registryInstanceId: '',
      capability: request.capability,
      providerKind: '',
      readerSessionId: request.readerSessionId,
      layoutRevision: request.layoutRevision,
      surfaceRevision: request.surfaceRevision,
      contentRevision: request.contentRevision,
      leaseId: '',
      registrationEpoch: 0,
      lease: undefined,
    };
  }

  // ── invoke: route an operation to the provider behind a live lease ────
  invoke(operation: OperationName, leaseId: LeaseId,
    binding: PageTurnLeaseBinding): PageTurnOperationReceipt {
    const lease = this.leases.get(leaseId);
    if (lease === undefined || lease.lost) {
      return PageTurnProviderRegistry.rejectedReceipt(leaseId, binding, 'rejected-no-lease', 'lease missing or lost');
    }
    if (!PageTurnProviderRegistry.bindingMatches(lease.binding, binding)) {
      return PageTurnProviderRegistry.rejectedReceipt(leaseId, binding, 'rejected-stale-revision', 'binding mismatch');
    }
    const provider = this.providers.get(lease.providerCapability);
    if (provider === undefined || provider.withdrawn || provider.epoch !== binding.registrationEpoch) {
      return PageTurnProviderRegistry.rejectedReceipt(leaseId, binding, 'rejected-withdrawn', 'provider withdrawn');
    }
    const operationId = `ptr-op-${leaseId}-${operation}`;
    const request: PageTurnOperationRequest = {
      operation: operation,
      operationId: operationId,
      leaseId: leaseId,
      binding: binding,
    };
    const result = provider.handle.onOperation(operation, request);
    return {
      operationId: operationId,
      leaseId: leaseId,
      binding: binding,
      result: result,
    };
  }

  // ── onLost: reportLoss withdraws the provider + fires onLeaseLost ─────
  reportLoss(leaseId: LeaseId, reason: string): boolean {
    const lease = this.leases.get(leaseId);
    if (lease === undefined) return false;
    if (lease.lost) return true;
    lease.lost = true;
    const provider = this.providers.get(lease.providerCapability);
    if (provider !== undefined && !provider.withdrawn) {
      provider.withdrawn = true;
      provider.handle.onLeaseLost(leaseId, reason);
    }
    return true;
  }

  // ── release: revoke a lease without withdrawing the provider ─────────
  release(leaseId: LeaseId): boolean {
    return this.leases.delete(leaseId);
  }

  // ── queries for tests / coordinator ───────────────────────────────────
  isLeaseReady(leaseId: LeaseId): boolean {
    const lease = this.leases.get(leaseId);
    return lease !== undefined && !lease.lost;
  }

  leaseBinding(leaseId: LeaseId): PageTurnLeaseBinding | undefined {
    return this.leases.get(leaseId)?.binding;
  }

  private static bindingMatches(a: PageTurnLeaseBinding, b: PageTurnLeaseBinding): boolean {
    return a.registryInstanceId === b.registryInstanceId &&
      a.registrationEpoch === b.registrationEpoch &&
      a.capability === b.capability &&
      a.providerKind === b.providerKind &&
      a.readerSessionId === b.readerSessionId &&
      a.layoutRevision === b.layoutRevision &&
      a.surfaceRevision === b.surfaceRevision &&
      a.contentRevision === b.contentRevision;
  }

  private static rejectedReceipt(leaseId: LeaseId, binding: PageTurnLeaseBinding,
    status: PageTurnOperationStatus, detail: string): PageTurnOperationReceipt {
    return {
      operationId: '',
      leaseId: leaseId,
      binding: binding,
      result: { status: status, detail: detail },
    };
  }

  // The contract pins each capability to exactly one providerKind
  // (capabilities[] in capabilityRegistration).
  private static capabilityAdmitsProviderKind(capability: PageTurnCapabilityId,
    providerKind: ProviderKind): boolean {
    const defs = PageTurnContract.capabilityDefinitions();
    for (let i = 0; i < defs.length; i++) {
      if (defs[i].capability === capability) {
        return defs[i].providerKind === providerKind;
      }
    }
    return false;
  }
}
