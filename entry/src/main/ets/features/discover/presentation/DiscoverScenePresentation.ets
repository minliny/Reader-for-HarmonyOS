import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { DiscoverOrchestrator, EMPTY_DISCOVER_PRESENTATION, type DiscoverPresentation } from '../application/DiscoverOrchestrator';

@Observed
export class DiscoverScenePresentation {
  snapshot: DiscoverPresentation = EMPTY_DISCOVER_PRESENTATION;
  private host: DiscoverOrchestrator | undefined;
  private identity: string = '';

  open(owner: ReaderRuntimeOwner, identity: string, current: () => boolean): void {
    if (!current() || identity === this.identity) return;
    const host = DiscoverOrchestrator.forRuntime(owner);
    if (host === undefined) return;
    this.retire();
    this.host = host;
    this.identity = identity;
    const attached = (): boolean => this.host === host && this.identity === identity && current();
    if (!host.attachPresentation(identity, (snapshot: DiscoverPresentation): void => {
      if (attached()) this.snapshot = snapshot;
    }, attached)) {
      this.retire();
      return;
    }
    host.open();
  }

  operations(identity: string): DiscoverOrchestrator | undefined {
    const host = this.host;
    return this.identity === identity && host?.isPresentationCurrent(identity) === true ? host : undefined;
  }

  retire(): void {
    this.host?.detachPresentation(this.identity);
    this.host = undefined;
    this.identity = '';
  }
}
