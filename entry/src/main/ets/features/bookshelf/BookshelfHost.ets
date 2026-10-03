import { ReaderCoreGateway, type BookshelfAddReceipt, type ShelfBook, type ShelfBookUpsert } from '../../app/ReaderCoreGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { BookshelfState } from '../../app/ReaderCoreGateway';
import { BookshelfFlowGateway } from './BookshelfFlowGateway';
import { BookshelfCatalogUpdate, type BookshelfCatalogProgress } from './BookshelfCatalogUpdate';
import type { RemoteReadingSession } from '../reading/RemoteReadingContract';
import { BookshelfReadOwner, type BookshelfReadResult } from './BookshelfReadOwner';
import type { BookshelfDataState, BookshelfFilter } from './BookshelfFlowGateway';
import type { OperationFacts } from '../../app/ReaderOperationFacts';
import {
  BookshelfManagementGateway,
} from './BookshelfManagementGateway';
import {
  BookshelfManagementOrchestrator,
  type BookshelfManagementSnapshot,
} from './BookshelfManagementOrchestrator';

export {
  EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT,
  type BookshelfManagementSnapshot,
} from './BookshelfManagementOrchestrator';

/**
 * Entry-owned bookshelf domain boundary. Index keeps navigation, temporary
 * presentation leases and ArkUI snapshots. This host owns management IO and
 * page read/recovery and catalog scans through existing Core/acquisition boundaries.
 * Page reads use BookshelfFlowGateway; every operation always carries
 * the Runtime and current predicate captured by its originating presentation.
 */
export class BookshelfHost {
  private managementOrchestrator: BookshelfManagementOrchestrator | undefined = undefined;
  private readonly emitManagementSnapshot: (snapshot: BookshelfManagementSnapshot) => void;
  private readonly isManagementCurrent: () => boolean;
  private readonly owner: () => ReaderRuntimeOwner;

  readShelf(owner: ReaderRuntimeOwner, filter: BookshelfFilter, generation: number, current: () => boolean,
    retained: BookshelfDataState | undefined, retryBlank: boolean,
    emit: (facts: OperationFacts<BookshelfDataState>) => void): Promise<BookshelfReadResult | undefined> {
    // Filter and Runtime are per-read snapshots. No late retry may reacquire
    // current() or accidentally query the replacement Runtime.
    return new BookshelfReadOwner(owner, (live: () => boolean): Promise<BookshelfDataState> =>
      new BookshelfFlowGateway(owner, filter).load(live)).read(generation, current, retained, retryBlank, emit);
  }

  constructor(
    emitManagementSnapshot: (snapshot: BookshelfManagementSnapshot) => void,
    isManagementCurrent: () => boolean,
    owner?: () => ReaderRuntimeOwner,
  ) {
    this.emitManagementSnapshot = emitManagementSnapshot;
    this.isManagementCurrent = isManagementCurrent;
    this.owner = owner ?? ((): ReaderRuntimeOwner => ReaderRuntimeOwner.current());
  }

  openManagement(): void { this.getManagementOrchestrator().open(); }
  updateGroupName(value: string): void { this.getManagementOrchestrator().updateGroupName(value); }
  updateGroupOrder(value: string): void { this.getManagementOrchestrator().updateGroupOrder(value); }
  selectGroup(groupId: number): void { this.getManagementOrchestrator().selectGroup(groupId); }
  clearGroupEditor(): void { this.getManagementOrchestrator().clearGroupEditor(); }
  saveGroup(): void { this.getManagementOrchestrator().saveGroup(); }
  toggleGroupShown(groupId: number): void { this.getManagementOrchestrator().toggleGroupShown(groupId); }
  deleteGroup(groupId: number): void { this.getManagementOrchestrator().deleteGroup(groupId); }
  selectBook(sourceId: string, bookId: string): void {
    this.getManagementOrchestrator().selectBook(sourceId, bookId);
  }
  updateAssignmentGroup(value: string): void {
    this.getManagementOrchestrator().updateAssignmentGroup(value);
  }
  assignSelectedBook(): void { this.getManagementOrchestrator().assignSelectedBook(); }
  reconcileManagement(generation: number): void { this.getManagementOrchestrator().reconcile(generation); }

  assignDefaultGroup(book: ShelfBook): Promise<ShelfBook> {
    return new BookshelfManagementGateway(this.owner()).assignGroup(book, '');
  }

  loadShelfBook(sourceId: string, bookId: string): Promise<ShelfBook | undefined> {
    return new ReaderCoreGateway(this.owner()).loadShelfBook(sourceId, bookId);
  }

  upsertBook(book: ShelfBookUpsert): Promise<BookshelfAddReceipt> {
    return new ReaderCoreGateway(this.owner()).upsertBook(book);
  }

  catalogTargets(owner: ReaderRuntimeOwner, books: ShelfBook[], revision: string,
    automatic: boolean, current: () => boolean): Promise<BookshelfState | undefined> {
    // Only a complete exact revision can be shared with durable preparation.
    return revision.length > 0 ? new BookshelfFlowGateway(owner, { readingState: 'all', sourceKind: 'all' }, automatic)
      .loadAll(current) : Promise.resolve(current() ? { books, total: books.length } : undefined);
  }

  refreshCatalogs(owner: ReaderRuntimeOwner, books: ShelfBook[], automatic: boolean,
    intervalMs: number, current: () => boolean,
    prefetch: (session: RemoteReadingSession, current: () => boolean) => Promise<void>,
    emit: (progress: BookshelfCatalogProgress) => void): Promise<BookshelfCatalogProgress> {
    return new BookshelfCatalogUpdate(owner).run(books, automatic, intervalMs, current, prefetch, emit);
  }

  reloadCatalogProjection(owner: ReaderRuntimeOwner, filter: BookshelfFilter,
    current: () => boolean): Promise<BookshelfDataState> {
    return new BookshelfFlowGateway(owner, filter).load(current);
  }

  private getManagementOrchestrator(): BookshelfManagementOrchestrator {
    if (this.managementOrchestrator === undefined || !this.managementOrchestrator.owns(this.owner())) {
      this.managementOrchestrator = new BookshelfManagementOrchestrator(
        this.emitManagementSnapshot,
        this.isManagementCurrent,
        this.owner(),
      );
    }
    return this.managementOrchestrator;
  }
}
