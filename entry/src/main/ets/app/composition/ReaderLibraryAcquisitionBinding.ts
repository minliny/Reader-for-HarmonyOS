import type { BookAcquisitionChange, BookAcquisitionCoordinator } from '../../features/reading/application/BookAcquisitionCoordinator';
import type { ReaderRuntimeOwner } from '../ReaderRuntimeOwner';
import type { RemoteReadingIdentity } from '../../features/reading/application/RemoteReadingContract';

export interface ReaderLibraryAcquisitionPorts {
  ownsRuntime: (owner: ReaderRuntimeOwner) => boolean;
  detailBook: () => RemoteReadingIdentity | undefined;
  refreshShelf: () => void;
  refreshMembership: () => void;
  refreshDetail: () => void;
}

/** One mounted root drives acquisition visibility and the shared readbacks.
 * The runtime still owns search scheduling and preparation requests. */
export class ReaderLibraryAcquisitionBinding {
  private static active: ReaderLibraryAcquisitionBinding | undefined;
  private owner: ReaderRuntimeOwner | undefined;
  private ports: ReaderLibraryAcquisitionPorts | undefined;
  private unsubscribe: (() => void) | undefined;

  mount(owner: ReaderRuntimeOwner, ports: ReaderLibraryAcquisitionPorts): void {
    if (!ports.ownsRuntime(owner)) return;
    const previous = ReaderLibraryAcquisitionBinding.active;
    const replacesSameRuntime = previous?.currentOwner() === owner;
    previous?.disconnect();
    this.owner = owner;
    this.ports = ports;
    ReaderLibraryAcquisitionBinding.active = this;
    const current = (): boolean => this.ports === ports && this.currentOwner() === owner;
    if (replacesSameRuntime) {
      owner.readingEntryPreparations().setPaused(true);
      if (current()) owner.bookAcquisitions().endSearch();
    }
    if (!current()) return;
    this.unsubscribe = owner.bookAcquisitions().subscribe((change: BookAcquisitionChange): void => {
      if (!current()) return;
      if (change.shelfChanged === true) {
        ports.refreshShelf();
        if (current()) ports.refreshMembership();
      }
      if (!current()) return;
      const book = ports.detailBook();
      if (change.reset || (book !== undefined && change.identities.some((identity: RemoteReadingIdentity): boolean =>
        identity.sourceId === book.sourceId && identity.bookId === book.bookId))) ports.refreshDetail();
    });
  }

  currentOwner(): ReaderRuntimeOwner | undefined {
    const owner = this.owner;
    return ReaderLibraryAcquisitionBinding.active === this && owner !== undefined && this.ports?.ownsRuntime(owner) === true ?
      owner : undefined;
  }

  coordinator(): BookAcquisitionCoordinator | undefined { return this.currentOwner()?.bookAcquisitions(); }

  beginSearch(): boolean {
    const owner = this.currentOwner(), ports = this.ports;
    if (owner === undefined) return false;
    owner.bookAcquisitions().beginSearch();
    return this.currentOwner() === owner && this.ports === ports;
  }

  endSearch(): void { this.coordinator()?.endSearch(); }

  visibilityChanged(preparationVisible: boolean): void {
    const owner = this.currentOwner(), ports = this.ports;
    if (owner === undefined) return;
    const coordinator = owner.bookAcquisitions();
    coordinator.visibilityChanged();
    if (this.ports === ports && this.currentOwner() === owner) coordinator.setPreparationVisible(preparationVisible);
  }

  dispose(): void {
    const owner = this.currentOwner(), ports = this.ports;
    this.disconnect();
    if (ReaderLibraryAcquisitionBinding.active !== this) return;
    ReaderLibraryAcquisitionBinding.active = undefined;
    if (owner === undefined || ports === undefined) return;
    owner.readingEntryPreparations().setPaused(true);
    if (ReaderLibraryAcquisitionBinding.active === undefined && ports.ownsRuntime(owner)) owner.bookAcquisitions().endSearch();
  }

  private disconnect(): void {
    this.owner = undefined;
    this.ports = undefined;
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
