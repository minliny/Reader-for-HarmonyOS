import { ReaderCoreGateway, type BookshelfAddReceipt, type ShelfBook, type ShelfBookUpsert } from '../../app/ReaderCoreGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { BookshelfState } from '../../app/ReaderCoreGateway';
import { BookshelfFlowGateway } from './BookshelfFlowGateway';
import { BookshelfCatalogUpdate, type BookshelfCatalogProgress } from './BookshelfCatalogUpdate';
import type { RemoteReadingSession } from '../reading/RemoteReadingContract';
import { BookshelfReadOwner, type BookshelfReadResult } from './BookshelfReadOwner';
import type { BookshelfDataState, BookshelfFilter } from './BookshelfFlowGateway';
import { BookshelfOperationOwner, type BookshelfOperationSnapshot } from './BookshelfOperationOwner';
import { BookshelfReadableAdmissionOwner, type BookshelfReadableAdmissionSnapshot } from './BookshelfReadableAdmissionOwner';
import type { OperationFacts } from '../../app/ReaderOperationFacts';
import { BookshelfProjectionOwner } from './BookshelfProjectionOwner';
import { BookshelfCatalogOwner } from './BookshelfCatalogOwner';
import { SourceGateway } from '../source/SourceGateway';
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
  private static projectionOwner: BookshelfProjectionOwner | undefined;
  private static catalogOwner: BookshelfCatalogOwner | undefined;
  // One feature-local Runtime lane survives Index reconstruction caused by
  // the system picker. It is never an application-wide task/error registry.
  private static readableOwner: BookshelfReadableAdmissionOwner | undefined;
  private readableSubscription: (() => void) | undefined;
  private subscribedReadable: BookshelfReadableAdmissionOwner | undefined;
  private static operationOwner: BookshelfOperationOwner | undefined;
  private operationSubscription: (() => void) | undefined;
  private subscribedOperation: BookshelfOperationOwner | undefined;
  private static readonly managementOwners: WeakMap<ReaderRuntimeOwner, BookshelfManagementOrchestrator> = new WeakMap();
  private managementPresentationIdentity: string = '';
  private managementOrchestrator: BookshelfManagementOrchestrator | undefined = undefined;
  private readonly emitManagementSnapshot: (snapshot: BookshelfManagementSnapshot) => void;
  private readonly isManagementCurrent: () => boolean;
  private readonly owner: () => ReaderRuntimeOwner;
  private readonly emitReadable: (snapshot: BookshelfReadableAdmissionSnapshot[], owner: ReaderRuntimeOwner) => void;
  private readonly emitOperation: (snapshot: BookshelfOperationSnapshot, owner: ReaderRuntimeOwner) => void;

  projection(owner: ReaderRuntimeOwner): BookshelfProjectionOwner | undefined {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    if (BookshelfHost.projectionOwner === undefined || !BookshelfHost.projectionOwner.owns(owner)) {
      BookshelfHost.projectionOwner = new BookshelfProjectionOwner(owner, (): boolean => ReaderRuntimeOwner.isCurrent(owner),
        (filter: BookshelfFilter): BookshelfFlowGateway => new BookshelfFlowGateway(owner, filter),
        (ids: string[], current: () => boolean) => new SourceGateway(owner).loadSourcesForIds(ids, current));
    }
    return BookshelfHost.projectionOwner;
  }

  catalog(owner: ReaderRuntimeOwner): BookshelfCatalogOwner | undefined {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return undefined;
    if (BookshelfHost.catalogOwner === undefined || !BookshelfHost.catalogOwner.owns(owner))
      BookshelfHost.catalogOwner = new BookshelfCatalogOwner(owner, (): boolean => ReaderRuntimeOwner.isCurrent(owner),
        (filter: BookshelfFilter, background: boolean): BookshelfFlowGateway => new BookshelfFlowGateway(owner, filter, background));
    return BookshelfHost.catalogOwner;
  }

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
    emitOperation: (snapshot: BookshelfOperationSnapshot, owner: ReaderRuntimeOwner) => void = (): void => {},
    emitReadable: (snapshot: BookshelfReadableAdmissionSnapshot[], owner: ReaderRuntimeOwner) => void = (): void => {},
  ) {
    this.emitReadable = emitReadable;
    this.emitOperation = emitOperation;
    this.emitManagementSnapshot = emitManagementSnapshot;
    this.isManagementCurrent = isManagementCurrent;
    this.owner = owner ?? ((): ReaderRuntimeOwner => ReaderRuntimeOwner.current());
  }

  operations(owner: ReaderRuntimeOwner): BookshelfOperationOwner {
    if (!ReaderRuntimeOwner.isCurrent(owner)) {
      // A late close/read of an old Host may inspect its accepted task, but
      // must not replace the current Runtime's shared feature lane.
      if (this.subscribedOperation?.owns(owner)) return this.subscribedOperation;
      if (BookshelfHost.operationOwner?.owns(owner)) return BookshelfHost.operationOwner;
      throw new Error('BOOKSHELF_OPERATION_OWNER_RETIRED');
    }
    if (BookshelfHost.operationOwner === undefined || !BookshelfHost.operationOwner.owns(owner)) {
      BookshelfHost.operationOwner = new BookshelfOperationOwner(owner);
    }
    const operation = BookshelfHost.operationOwner;
    if (this.subscribedOperation !== operation || this.operationSubscription === undefined) {
      this.operationSubscription?.(); this.subscribedOperation = operation;
      this.operationSubscription = operation.subscribe((snapshot: BookshelfOperationSnapshot): void => this.emitOperation(snapshot, owner));
    }
    return operation;
  }
  detachOperationPresentation(): void { this.operationSubscription?.(); this.operationSubscription = undefined; }

  readable(owner: ReaderRuntimeOwner): BookshelfReadableAdmissionOwner {
    if (!ReaderRuntimeOwner.isCurrent(owner)) {
      if (this.subscribedReadable?.owns(owner)) return this.subscribedReadable;
      throw new Error('BOOKSHELF_READABLE_OWNER_RETIRED');
    }
    if (BookshelfHost.readableOwner === undefined || !BookshelfHost.readableOwner.owns(owner))
      BookshelfHost.readableOwner = new BookshelfReadableAdmissionOwner(owner);
    const readable = BookshelfHost.readableOwner;
    if (this.subscribedReadable !== readable || this.readableSubscription === undefined) {
      this.readableSubscription?.(); this.subscribedReadable = readable;
      this.readableSubscription = readable.subscribe((snapshots: BookshelfReadableAdmissionSnapshot[]): void => this.emitReadable(snapshots, owner));
      this.emitReadable(readable.current(), owner);
    }
    return readable;
  }
  detachReadablePresentation(): void { this.readableSubscription?.(); this.readableSubscription = undefined; }

  openManagement(identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.open(identity); }
  updateGroupName(value: string, identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.updateGroupName(value, identity); }
  updateGroupOrder(value: string, identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.updateGroupOrder(value, identity); }
  selectGroup(groupId: number, identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.selectGroup(groupId, identity); }
  clearGroupEditor(identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.clearGroupEditor(identity); }
  saveGroup(identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.saveGroup(identity); }
  toggleGroupShown(groupId: number, identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.toggleGroupShown(groupId, identity); }
  deleteGroup(groupId: number, identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.deleteGroup(groupId, identity); }
  selectBook(sourceId: string, bookId: string, identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.selectBook(sourceId, bookId, identity); }
  updateAssignmentGroup(value: string, identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.updateAssignmentGroup(value, identity); }
  assignSelectedBook(identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.assignSelectedBook(identity); }
  reconcileManagement(generation: number, identity: string = this.managementPresentationIdentity): void { this.getManagementOrchestrator()?.reconcile(generation, identity); }

  bindManagement(owner: ReaderRuntimeOwner, identity: string, current: () => boolean): boolean {
    if (!ReaderRuntimeOwner.isCurrent(owner)) return false;
    try { if (!current()) return false; } catch (_) { return false; }
    let host = BookshelfHost.managementOwners.get(owner);
    if (host === undefined) {
      host = new BookshelfManagementOrchestrator((_snapshot: BookshelfManagementSnapshot): void => {}, (): boolean => false, owner);
      BookshelfHost.managementOwners.set(owner, host);
    }
    if (this.managementOrchestrator === host && this.managementPresentationIdentity === identity)
      return host.isPresentationCurrent(identity);
    this.detachManagementPresentation(); this.managementOrchestrator = host; this.managementPresentationIdentity = identity;
    return host.attachPresentation(identity, this.emitManagementSnapshot, current);
  }
  isManagementPresentationCurrent(owner: ReaderRuntimeOwner, identity: string): boolean {
    return this.managementOrchestrator?.owns(owner) === true && identity === this.managementPresentationIdentity &&
      this.managementOrchestrator.isPresentationCurrent(identity);
  }
  detachManagementPresentation(): void {
    this.managementOrchestrator?.detachPresentation(this.managementPresentationIdentity);
    this.managementPresentationIdentity = '';
  }
  managementSnapshot(): BookshelfManagementSnapshot | undefined { return this.managementOrchestrator?.currentSnapshot(); }
  assignDefaultGroup(book: ShelfBook, identity: string = this.managementPresentationIdentity): Promise<BookshelfManagementSnapshot | undefined> {
    return this.getManagementOrchestrator()?.assignBookGroup(book, '', identity) ?? Promise.resolve(undefined);
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

  private getManagementOrchestrator(): BookshelfManagementOrchestrator | undefined {
    return this.managementOrchestrator;
  }
}
