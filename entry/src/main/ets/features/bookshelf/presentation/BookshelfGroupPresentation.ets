import { hilog } from '@kit.PerformanceAnalysisKit';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import { errorMessageOf } from '../../../app/ErrorMessage';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import { BookshelfHost, EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT, type BookshelfManagementSnapshot } from '../application/BookshelfHost';

interface BookshelfGroupOpening {
  readonly owner: ReaderRuntimeOwner;
  readonly book: ShelfBook;
  readonly identity: string;
  readonly isRouteCurrent: () => boolean;
  readonly onApplied: () => void;
  readonly onNotice: (message: string, isCurrent: () => boolean) => void;
  readonly focusTarget?: string;
  readonly canRestoreFocus: () => boolean;
}

export interface BookshelfGroupFocusReturn {
  readonly target?: string;
  readonly isCurrent: () => boolean;
}

/** The temporary group dialog attaches to the existing runtime management
 * lane. Its opening and recovery projection expire independently of the write. */
@Observed
export class BookshelfGroupPresentation {
  book: ShelfBook | undefined;
  identity: string = '';
  assigning: boolean = false;
  snapshot: BookshelfManagementSnapshot = EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT;
  private sequence: number = 0;
  private opening: BookshelfGroupOpening | undefined;
  private host: BookshelfHost | undefined;

  open(owner: ReaderRuntimeOwner, book: ShelfBook, routeIdentity: string, isRouteCurrent: () => boolean,
    onApplied: () => void, onNotice: (message: string, isCurrent: () => boolean) => void,
    focusTarget?: string, canRestoreFocus: () => boolean = (): boolean => true): void {
    if (this.assigning || !isRouteCurrent()) return;
    this.retire();
    const identity = JSON.stringify([routeIdentity, ++this.sequence, book.sourceId, book.bookId]);
    this.opening = { owner, book, identity, isRouteCurrent, onApplied, onNotice, focusTarget, canRestoreFocus };
    // Bind from the observed instance, so async snapshots use its reactive setter.
    const host = this.host ?? new BookshelfHost((snapshot: BookshelfManagementSnapshot): void => {
      if (this.opening?.isRouteCurrent() === true) this.snapshot = snapshot;
    }, (): boolean => this.opening?.isRouteCurrent() === true);
    this.host = host;
    const attached = host.bindManagement(owner, identity, (): boolean =>
      this.opening?.identity === identity && isRouteCurrent());
    if (!attached) {
      this.retire();
      return;
    }
    this.book = book;
    this.identity = identity;
    host.openManagement(identity);
  }

  retire(): void {
    this.opening = undefined;
    this.identity = '';
    this.book = undefined;
    this.assigning = false;
    this.snapshot = EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT;
    this.host?.detachManagementPresentation();
  }

  back(): boolean {
    if (this.identity.length === 0) return false;
    if (!this.assigning) this.retire();
    return true;
  }

  dismiss(identity: string): void {
    if (!this.assigning && this.isCurrent(identity)) this.retire();
  }

  captureFocusReturn(identity: string): BookshelfGroupFocusReturn | undefined {
    const opening = this.opening;
    if (opening === undefined || opening.identity !== identity) return undefined;
    const sequence = this.sequence;
    return { target: opening.focusTarget, isCurrent: (): boolean =>
      this.sequence === sequence && this.opening === undefined && opening.isRouteCurrent() && opening.canRestoreFocus() };
  }

  private isCurrent(identity: string): boolean {
    const opening = this.opening;
    return opening !== undefined && opening.identity === identity && this.identity === identity &&
      opening.isRouteCurrent() && this.host?.isManagementPresentationCurrent(opening.owner, identity) === true;
  }

  canContinue(expected: number): boolean {
    const mutation = this.snapshot.managementMutation;
    return this.snapshot.receipt?.facts.generation === expected && !this.snapshot.busy &&
      mutation?.canContinueOriginal === true && mutation.method === 'bookshelf.group.assign' &&
      mutation.sourceId === this.book?.sourceId && mutation.bookId === this.book?.bookId && mutation.group === '';
  }

  recovery(expected: number): ReaderRecoveryView {
    const receipt = this.snapshot.receipt;
    const mutation = this.snapshot.managementMutation;
    if (receipt === undefined || receipt.facts.generation !== expected ||
      (receipt.receipt.confirmation === 'confirmed' && mutation?.blocked !== true))
      return { message: '', visible: false, canRetry: false, generation: expected };
    const view = readerRecoveryView(receipt, this.snapshot.readFacts);
    return mutation?.blocked === true && mutation.message.length > 0 ?
      { message: `${view.message}：${mutation.message}`, visible: true, canRetry: view.canRetry || !this.snapshot.busy, generation: expected } : view;
  }

  reconcile(identity: string, expected: number, continuing: boolean = false): void {
    if (!this.isCurrent(identity) || this.snapshot.receipt?.facts.generation !== expected) return;
    if (continuing) {
      if (this.canContinue(expected)) this.host?.continueOriginalManagement(expected, identity);
    } else {
      this.host?.reconcileManagement(expected, identity);
    }
  }

  async assignDefault(identity: string): Promise<void> {
    const opening = this.opening;
    const host = this.host;
    const current = (): boolean => this.isCurrent(identity);
    if (opening === undefined || host === undefined || !current() || this.assigning) return;
    this.assigning = true;
    try {
      const result = await host.assignDefaultGroup(opening.book, identity);
      if (!current() || result?.receipt?.receipt.confirmation !== 'confirmed' || result.managementMutation?.blocked === true) return;
      opening.onApplied();
      if (result.receipt.receipt.fact === 'confirmedRefreshFailed') opening.onNotice('分组已保存，列表刷新失败', current);
      this.retire();
    } catch (error) {
      if (!current()) return;
      hilog.error(0x5244, 'Reader', 'Group selection failed: %{private}s', errorMessageOf(error));
      opening.onNotice('分组操作暂不可用，请重新打开核对', current);
    } finally {
      if (this.identity === identity) this.assigning = false;
    }
  }
}
