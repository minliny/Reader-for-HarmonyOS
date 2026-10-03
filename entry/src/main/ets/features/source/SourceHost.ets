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
export class SourceHost {
  private orchestrator: SourceOrchestrator | undefined = undefined;
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

  open(): void { this.getOrchestrator().open(); }
  retryLoad(): void { this.getOrchestrator().retryLoad(); }
  reconcile(generation: number): void { this.getOrchestrator().reconcile(generation); }
  toggleSource(id: string, enabled: boolean): void { this.getOrchestrator().toggleSource(id, enabled); }
  checkSource(id: string): void { this.getOrchestrator().checkSource(id); }
  loginSource(id: string): void { this.getOrchestrator().loginSource(id); }
  importBookSources(
    onlineUrl?: string,
    onComplete: (completion: SourceImportCompletion) => void =
      (_completion: SourceImportCompletion): void => {},
    onFailure: (error: Error) => void = (_error: Error): void => {},
  ): void {
    this.getOrchestrator().importBookSources(onlineUrl, onComplete, onFailure);
  }

  /**
   * Resolve only the exact source identities already admitted by another
   * owner (for example, a shelf or remote detail projection).  The page keeps
   * its own route-generation guard; this boundary supplies the Core read and
   * never invents a source row when the registry is unavailable.
   */
  loadSourcesForIds(sourceIds: string[], isCurrent: () => boolean): Promise<BookSource[]> {
    return new SourceGateway(this.owner()).loadSourcesForIds(sourceIds, isCurrent);
  }

  /** Read an optional exact source projection without exposing SourceGateway
   * construction to Index.  Callers own the lifetime/cancellation policy. */
  loadSources(sourceId?: string): Promise<BookSource[]> {
    return new SourceGateway(this.owner()).loadSources(sourceId);
  }

  private getOrchestrator(): SourceOrchestrator {
    if (this.orchestrator === undefined || !this.orchestrator.owns(this.owner())) {
      this.orchestrator = new SourceOrchestrator(
        this.emitSources,
        this.isCurrent,
        this.emitStatus,
        this.owner(),
        this.emitProjection,
      );
    }
    return this.orchestrator;
  }
}
