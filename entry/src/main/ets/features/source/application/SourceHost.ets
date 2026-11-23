import { SourceOrchestrator } from './SourceOrchestrator';
import type { BookSource } from './SourceGateway';
import type {
  SourceImportCompletion,
  SourceManagementStatusKind,
  SourceManagementProjection,
} from './SourceOrchestrator';
import { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';

/**
 * Source Management boundary. The feature presentation consumes guarded list
 * and status projections while this host owns the gateway/orchestrator binding.
 */
export class SourceHost {
  private orchestrator: SourceOrchestrator | undefined = undefined;
  private boundOwner: ReaderRuntimeOwner | undefined;
  private presentationIdentity: string = '';
  private readonly emitSources: (sources: BookSource[]) => void;
  private readonly emitStatus: (kind: SourceManagementStatusKind, message: string) => void;
  private readonly emitProjection: (projection: SourceManagementProjection) => void;

  constructor(
    emitSources: (sources: BookSource[]) => void,
    emitStatus: (kind: SourceManagementStatusKind, message: string) => void,
    emitProjection: (projection: SourceManagementProjection) => void,
  ) {
    this.emitSources = emitSources;
    this.emitStatus = emitStatus;
    this.emitProjection = emitProjection;
  }

  bindPresentation(owner: ReaderRuntimeOwner, identity: string, current: () => boolean): boolean {
    if (identity.length === 0) return false;
    try { if (!ReaderRuntimeOwner.isCurrent(owner) || !current()) return false; } catch (_) { return false; }
    if (this.boundOwner === owner && this.presentationIdentity === identity)
      return this.orchestrator?.isPresentationCurrent(identity) ?? false;
    const host = SourceOrchestrator.forRuntime(owner);
    if (host === undefined) return false;
    const previousOwner = this.boundOwner, previousIdentity = this.presentationIdentity, previousHost = this.orchestrator;
    // Actual owner synchronously publishes its retained accepted DTO on attach.
    // The receiving presentation must observe this exact Host binding at that point.
    this.boundOwner = owner;
    this.presentationIdentity = identity;
    this.orchestrator = host;
    if (!host.attachPresentation(identity, this.emitSources, current, this.emitStatus, this.emitProjection)) {
      this.boundOwner = previousOwner;
      this.presentationIdentity = previousIdentity;
      this.orchestrator = previousHost;
      return false;
    }
    return true;
  }
  isPresentationCurrent(owner: ReaderRuntimeOwner, identity: string): boolean {
    return this.boundOwner === owner && this.presentationIdentity === identity &&
      (this.orchestrator?.isPresentationCurrent(identity) ?? false);
  }
  detachPresentation(identity: string): void {
    if (identity !== this.presentationIdentity) return;
    this.orchestrator?.detachPresentation(identity);
    this.orchestrator = undefined;
    this.boundOwner = undefined;
    this.presentationIdentity = '';
  }
  open(identity: string): void { this.admitted(identity)?.open(); }
  retryLoad(identity: string): void { this.admitted(identity)?.retryLoad(); }
  reconcile(generation: number, identity: string): void { this.admitted(identity)?.reconcile(generation); }
  continueOriginal(generation: number, identity: string): void { this.admitted(identity)?.continueOriginal(generation); }
  toggleSource(id: string, enabled: boolean, identity: string): void { this.admitted(identity)?.toggleSource(id, enabled); }
  checkSource(id: string, identity: string): void { this.admitted(identity)?.checkSource(id); }
  loginSource(id: string, loginUrl: string, identity: string): void { this.admitted(identity)?.loginSource(id, loginUrl); }
  importBookSources(onlineUrl: string | undefined,
    onComplete: (completion: SourceImportCompletion) => void, onFailure: (error: Error) => void, identity: string): void {
    this.admitted(identity)?.importBookSources(onlineUrl, onComplete, onFailure);
  }

  private admitted(identity: string): SourceOrchestrator | undefined {
    if (identity !== this.presentationIdentity) return undefined;
    return this.orchestrator?.isPresentationCurrent(identity) ? this.orchestrator : undefined;
  }
}
