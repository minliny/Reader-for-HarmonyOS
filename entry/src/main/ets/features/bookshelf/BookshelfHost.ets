import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
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
 * Entry-owned bookshelf management boundary. Index keeps the route and the
 * ArkUI snapshot projection, while this host owns the management
 * orchestrator, its Core gateway, and management intent dispatch.
 *
 * The broader BookshelfFlowGateway remains the page-loading boundary for the
 * shelf projection; this host intentionally starts with the independent
 * management subdomain so the existing shelf UI and route behavior stay
 * unchanged while the construction seam becomes explicit.
 */
export class BookshelfHost {
  private managementOrchestrator: BookshelfManagementOrchestrator | undefined = undefined;

  constructor(
    private readonly emitManagementSnapshot: (snapshot: BookshelfManagementSnapshot) => void,
    private readonly isManagementCurrent: () => boolean,
    private readonly owner: () => ReaderRuntimeOwner =
      (): ReaderRuntimeOwner => ReaderRuntimeOwner.current(),
  ) {}

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

  assignDefaultGroup(book: ShelfBook): Promise<ShelfBook> {
    return new BookshelfManagementGateway(this.owner()).assignGroup(book, '');
  }

  private getManagementOrchestrator(): BookshelfManagementOrchestrator {
    if (this.managementOrchestrator === undefined) {
      this.managementOrchestrator = new BookshelfManagementOrchestrator(
        this.emitManagementSnapshot,
        this.isManagementCurrent,
        this.owner(),
      );
    }
    return this.managementOrchestrator;
  }
}
