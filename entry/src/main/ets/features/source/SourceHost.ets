import { SourceOrchestrator } from './SourceOrchestrator';
import type { BookSource } from './SourceGateway';
import type {
  SourceImportCompletion,
  SourceManagementStatusKind,
} from './SourceOrchestrator';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

export type { SourceImportCompletion, SourceManagementStatusKind } from './SourceOrchestrator';

/**
 * Entry-owned Source Management boundary. The Index keeps the ArkUI list and
 * status projections, while this host owns the gateway/orchestrator instance
 * and forwards source-management intents with their existing session guards.
 */
export class SourceHost {
  private orchestrator: SourceOrchestrator | undefined = undefined;

  constructor(
    private readonly emitSources: (sources: BookSource[]) => void,
    private readonly isCurrent: () => boolean,
    private readonly emitStatus: (kind: SourceManagementStatusKind, message: string) => void =
      (_kind: SourceManagementStatusKind, _message: string): void => {},
    private readonly owner: () => ReaderRuntimeOwner = (): ReaderRuntimeOwner => ReaderRuntimeOwner.current(),
  ) {}

  open(): void { this.getOrchestrator().open(); }
  retryLoad(): void { this.getOrchestrator().retryLoad(); }
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

  private getOrchestrator(): SourceOrchestrator {
    if (this.orchestrator === undefined) {
      this.orchestrator = new SourceOrchestrator(
        this.emitSources,
        this.isCurrent,
        this.emitStatus,
        this.owner(),
      );
    }
    return this.orchestrator;
  }
}
