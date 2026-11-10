import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { DEFAULT_SYNC_SNAPSHOT, type SyncSnapshot } from '../application/SyncGateway';
import { SyncOrchestrator } from '../application/SyncOrchestrator';

/** The sync screen's binding to the original serialized operation owner. */
@Observed
export class SyncPresentation {
  snapshot: SyncSnapshot = DEFAULT_SYNC_SNAPSHOT;
  ready: boolean = false;
  private host: SyncOrchestrator | undefined;
  private identity: string = '';

  open(owner: ReaderRuntimeOwner, identity: string, current: () => boolean): void {
    if (!current() || identity === this.identity) return;
    const host = SyncOrchestrator.forRuntime(owner);
    if (host === undefined) return;
    this.retire();
    this.host = host;
    this.identity = identity;
    const attached = (): boolean => this.host === host && this.identity === identity && current();
    if (!host.attachPresentation(identity, (snapshot: SyncSnapshot): void => {
      if (!attached()) return;
      this.snapshot = snapshot;
      this.ready = true;
    }, (): SyncSnapshot => this.snapshot, attached)) {
      this.retire();
      return;
    }
    host.open();
  }

  operations(identity: string): SyncOrchestrator | undefined {
    const host = this.host;
    return this.identity === identity && host?.isPresentationCurrent(identity) === true ? host : undefined;
  }

  retire(): void {
    this.host?.detachPresentation(this.identity);
    this.host = undefined;
    this.identity = '';
    this.ready = false;
  }
}
