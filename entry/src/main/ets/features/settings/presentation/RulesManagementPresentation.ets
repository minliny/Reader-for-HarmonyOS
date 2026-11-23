import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { EMPTY_RULES_MANAGEMENT_SNAPSHOT, RulesManagementOrchestrator, type RulesManagementSnapshot } from '../application/RulesManagementOrchestrator';

@Observed
export class RulesManagementPresentation {
  snapshot: RulesManagementSnapshot = EMPTY_RULES_MANAGEMENT_SNAPSHOT;
  identity: string = '';
  private host: RulesManagementOrchestrator | undefined;

  open(owner: ReaderRuntimeOwner, identity: string, current: () => boolean, inputCurrent: () => boolean = current): void {
    if (!current() || identity === this.identity) return;
    const host = RulesManagementOrchestrator.forRuntime(owner);
    if (host === undefined) return;
    this.retire();
    this.host = host;
    this.identity = identity;
    const attached = (): boolean => this.host === host && this.identity === identity && current();
    if (!host.attachPresentation(identity, (snapshot: RulesManagementSnapshot): void => {
      if (attached()) this.snapshot = snapshot;
    }, attached, (): boolean => attached() && inputCurrent())) {
      this.retire();
      return;
    }
    host.open(identity);
  }

  operations(identity: string): RulesManagementOrchestrator | undefined {
    const host = this.host;
    return this.identity === identity && host?.isPresentationCurrent(identity) === true ? host : undefined;
  }

  inputAllowed(identity: string): boolean {
    return this.identity === identity && this.host?.isPresentationInputCurrent(identity) === true;
  }

  inputOperations(identity: string): RulesManagementOrchestrator | undefined {
    return this.inputAllowed(identity) ? this.operations(identity) : undefined;
  }

  retire(): void {
    this.host?.detachPresentation(this.identity);
    this.host = undefined;
    this.identity = '';
  }
}
