import { SourceOrchestrator } from './SourceOrchestrator';
import { SourceGateway, type BookSource } from './SourceGateway';
import type {
  SourceImportCompletion,
  SourceManagementStatusKind,
  SourceManagementProjection,
} from './SourceOrchestrator';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

export type { SourceImportCompletion, SourceManagementStatusKind, SourceManagementProjection } from './SourceOrchestrator';

/**
 * Entry-owned Source Management boundary. The Index keeps the ArkUI list and
 * status projections, while this host owns the gateway/orchestrator instance
 * and forwards source-management intents with their existing session guards.
 */
let sourceHostPresentationSequence: number = 0;
export class SourceHost {
  private orchestrator: SourceOrchestrator | undefined = undefined;
  private boundOwner: ReaderRuntimeOwner | undefined;
  private presentationIdentity: string = '';
  private explicitBinding: boolean = false;
  private readonly emitSources: (sources: BookSource[]) => void;
  private readonly isCurrent: () => boolean;
  private readonly emitStatus: (kind: SourceManagementStatusKind, message: string) => void;
  private readonly owner: () => ReaderRuntimeOwner;
  private readonly emitProjection: (projection: SourceManagementProjection) => void;

  constructor(
    emitSources: (sources: BookSource[]) => void,
    isCurrent: () => boolean,
    emitStatus?: (kind: SourceManagementStatusKind, message: string) => void,
    owner?: () => ReaderRuntimeOwner,
    emitProjection: (projection: SourceManagementProjection) => void = (_projection: SourceManagementProjection): void => {},
  ) {
    this.emitSources = emitSources;
    this.isCurrent = isCurrent;
    this.emitStatus = emitStatus ?? ((_kind: SourceManagementStatusKind, _message: string): void => {});
    this.owner = owner ?? ((): ReaderRuntimeOwner => ReaderRuntimeOwner.current());
    this.emitProjection = emitProjection;
  }

  bindPresentation(owner: ReaderRuntimeOwner, identity: string, current: () => boolean): boolean {
    if (identity.length === 0) return false;
    try { if (!ReaderRuntimeOwner.isCurrent(owner) || !current()) return false; } catch (_) { return false; }
    if (this.boundOwner === owner && this.presentationIdentity === identity)
      return this.orchestrator?.isPresentationCurrent(identity) ?? false;
    const host = SourceOrchestrator.forRuntime(owner);
    if (host === undefined || !host.attachPresentation(identity, this.emitSources, current,
      this.emitStatus, this.emitProjection)) return false;
    this.boundOwner = owner; this.presentationIdentity = identity; this.explicitBinding = true;
    this.orchestrator = host; return true;
  }
  isPresentationCurrent(owner: ReaderRuntimeOwner, identity: string): boolean {
    return this.boundOwner === owner && this.presentationIdentity === identity &&
      (this.orchestrator?.isPresentationCurrent(identity) ?? false);
  }
  detachPresentation(identity: string): void { this.orchestrator?.detachPresentation(identity); }
  open(identity?: string): void { this.admitted(identity)?.open(); }
  retryLoad(identity?: string): void { this.admitted(identity)?.retryLoad(); }
  reconcile(generation: number, identity?: string): void { this.admitted(identity)?.reconcile(generation); }
  toggleSource(id: string, enabled: boolean, identity?: string): void { this.admitted(identity)?.toggleSource(id, enabled); }
  checkSource(id: string, identity?: string): void { this.admitted(identity)?.checkSource(id); }
  loginSource(id: string, identity?: string): void { this.admitted(identity)?.loginSource(id); }
  importBookSources(onlineUrl?: string,
    onComplete: (completion: SourceImportCompletion) => void = (_completion: SourceImportCompletion): void => {},
    onFailure: (error: Error) => void = (_error: Error): void => {}, identity?: string): void {
    this.admitted(identity)?.importBookSources(onlineUrl, onComplete, onFailure);
  }

  /**
   * Resolve only the exact source identities already admitted by another
   * owner (for example, a shelf or remote detail projection).  The page keeps
   * its own route-generation guard; this boundary supplies the Core read and
   * never invents a source row when the registry is unavailable.
   */
  loadSourcesForIds(sourceIds: string[], isCurrent: () => boolean): Promise<BookSource[]> {
    const owner = this.capturedOwner();
    return new SourceGateway(owner).loadSourcesForIds(sourceIds,
      (): boolean => ReaderRuntimeOwner.isCurrent(owner) && isCurrent());
  }

  /** Read an optional exact source projection without exposing SourceGateway
   * construction to Index.  Callers own the lifetime/cancellation policy. */
  loadSources(sourceId?: string): Promise<BookSource[]> {
    const owner = this.capturedOwner();
    return new SourceGateway(owner).loadSources(sourceId, false, (): boolean => ReaderRuntimeOwner.isCurrent(owner));
  }

  private capturedOwner(): ReaderRuntimeOwner {
    if (this.boundOwner === undefined) this.boundOwner = this.owner();
    return this.boundOwner;
  }
  private admitted(identity?: string): SourceOrchestrator | undefined {
    if (this.orchestrator === undefined) {
      const owner = this.capturedOwner();
      const legacyIdentity = `source-host:${++sourceHostPresentationSequence}`;
      if (!this.bindPresentation(owner, legacyIdentity, this.isCurrent)) return undefined;
      this.explicitBinding = false;
    }
    if ((identity === undefined && this.explicitBinding) ||
      (identity !== undefined && identity !== this.presentationIdentity)) return undefined;
    return this.orchestrator?.isPresentationCurrent(this.presentationIdentity) ? this.orchestrator : undefined;
  }
}
