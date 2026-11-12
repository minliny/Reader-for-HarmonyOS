import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT, type BookshelfHost, type BookshelfManagementSnapshot } from '../application/BookshelfHost';

interface BookshelfManagementOpening {
  owner: ReaderRuntimeOwner;
  host: BookshelfHost;
  identity: string;
  routeCurrent: () => boolean;
}

@Observed
export class BookshelfManagementPresentation {
  snapshot: BookshelfManagementSnapshot = EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT;
  identity: string = '';
  private opening: BookshelfManagementOpening | undefined;

  open(owner: ReaderRuntimeOwner, host: BookshelfHost, identity: string, routeCurrent: () => boolean): void {
    this.retire();
    const opening: BookshelfManagementOpening = { owner, host, identity, routeCurrent };
    this.opening = opening;
    this.identity = identity;
    if (host.bindManagement(owner, identity, (): boolean => this.opening === opening && routeCurrent())) {
      host.openManagement(identity);
    } else {
      this.retire();
    }
  }

  host(identity: string): BookshelfHost | undefined {
    const opening = this.opening;
    if (opening === undefined || identity !== opening.identity || !opening.routeCurrent() ||
      !opening.host.isManagementPresentationCurrent(opening.owner, identity)) return undefined;
    return opening.host;
  }

  accept(snapshot: BookshelfManagementSnapshot): void {
    if (this.host(this.identity) !== undefined) this.snapshot = snapshot;
  }

  retire(): void {
    const opening = this.opening;
    this.opening = undefined;
    this.identity = '';
    opening?.host.detachManagementPresentation();
  }
}
