import type { ReaderRuntimeOwner } from '../../../app/ReaderRuntimeOwner';
import type { BookshelfState, ShelfBook } from '../../../app/ReaderCoreGateway';
import { readerRecoveryView } from '../../../app/ReaderRecoveryProjection';
import type { ReaderRecoveryView } from '../../../ui/feedback/ReaderRecoveryView';
import type { BookshelfHost } from '../application/BookshelfHost';
import type { BookshelfProjectionSnapshot } from '../application/BookshelfProjectionOwner';
import type { BookshelfDataState, BookshelfFilter, BookshelfRemovalTarget,
  BookshelfRemoveBatchOutcome, BookshelfRemoveOutcome } from '../application/BookshelfFlowGateway';
import { EMPTY_BOOKSHELF_OPERATION_SNAPSHOT, type BookshelfOperationSnapshot } from '../application/BookshelfOperationOwner';
import { LOCAL_IMPORT_PRESENTATION_KEY } from './LocalImportPresentationOwner';

export interface BookshelfMutationScope {
  host: () => BookshelfHost;
  owner: () => ReaderRuntimeOwner | undefined;
  isCurrentOwner: (owner: ReaderRuntimeOwner | undefined) => boolean;
  route: () => string;
  generation: () => number;
  mounting: () => number;
  instance: () => number;
  retired: () => boolean;
  pickerInputAllowed: () => boolean;
  filter: () => BookshelfFilter;
  invalidate: () => void;
  refreshShelf: () => void;
  apply: (shelf: BookshelfDataState) => void;
  feedback: (message: string, current: () => boolean) => void;
  readSelection: () => Promise<BookshelfState | undefined>;
  shelfProjection: () => BookshelfProjectionSnapshot;
  readingActive: () => boolean;
  selectionMatches: (selection: BookshelfState, current: () => boolean, filter?: BookshelfFilter) => Promise<boolean | undefined>;
  confirmRemoval: (message: string, action: () => void) => void;
  leaveSelection: () => void;
  finishSelection: () => void;
}

export interface BookshelfRemovalDispatch {
  generation: number;
  outcome: Promise<BookshelfRemoveOutcome | BookshelfRemoveBatchOutcome | undefined>;
}

interface BookshelfSelectionSnapshot {
  readonly identity: number;
  readonly books: ShelfBook[];
  readonly initialKey: string;
  readonly ready: boolean;
}

interface BookshelfSelectionOpening {
  readonly identity: number;
  readonly current: () => boolean;
  source?: BookshelfState;
}

interface BookshelfImportFocusOpening {
  readonly identity: number;
  readonly target?: string;
  readonly routeCurrent: () => boolean;
}

interface BookshelfImportFocusReturn {
  readonly target?: string;
  readonly isCurrent: () => boolean;
}

const EMPTY_SELECTION: BookshelfSelectionSnapshot = { identity: 0, books: [], initialKey: '', ready: false };

function emptyRecovery(): ReaderRecoveryView {
  return { message: '', visible: false, canRetry: false, generation: 0 };
}

/** Screen projection and guarded intent routing. BookshelfOperationOwner still
 * owns the picker opening, accepted Core write, mutex, and durable receipt. */
@Observed
export class BookshelfMutationPresentation {
  snapshot: BookshelfOperationSnapshot = EMPTY_BOOKSHELF_OPERATION_SNAPSHOT;
  selection: BookshelfSelectionSnapshot = EMPTY_SELECTION;
  selectionVerifying: boolean = false;
  owner: ReaderRuntimeOwner | undefined;
  private selectionIdentity: number = 0;
  private selectionOpening: BookshelfSelectionOpening | undefined;
  private importFocus: BookshelfImportFocusOpening | undefined;
  private singleRemovalChecking: boolean = false;
  private feedbackKey: string = '';
  private readonly scope: BookshelfMutationScope;

  constructor(scope: BookshelfMutationScope) { this.scope = scope; }

  accept(snapshot: BookshelfOperationSnapshot, owner: ReaderRuntimeOwner): void {
    if (!this.scope.isCurrentOwner(owner)) return;
    // Keep one process-local serialized view, including picker-driven Index rebuilds.
    AppStorage.setOrCreate<string>(LOCAL_IMPORT_PRESENTATION_KEY, snapshot.importSerialized);
    if (this.scope.retired() || (snapshot.action === 'import' &&
      !this.scope.host().operations(owner).isImportPresentationInstance(this.scope.instance()))) return;
    if (snapshot.receipt !== undefined && (this.snapshot.receipt === undefined || this.snapshot.generation !== snapshot.generation))
      this.scope.invalidate();
    const filter = this.scope.filter();
    const presentImportResult = snapshot.action === 'import' && snapshot.importPresentation?.state === 'result' &&
      (this.snapshot.importPresentation?.state !== 'result' || this.snapshot.receipt !== snapshot.receipt) &&
      this.scope.route() === 'bookshelf' && snapshot.filter.sourceKind === filter.sourceKind &&
      (snapshot.filter.contentKind ?? 'all') === (filter.contentKind ?? 'all');
    this.owner = owner;
    this.snapshot = snapshot;
    this.publishRemovalFeedback(snapshot, owner);
    if (snapshot.busy || snapshot.reconcileBusy) this.feedbackKey = '';
    if (presentImportResult && snapshot.receipt?.value !== undefined) this.scope.apply(snapshot.receipt.value);
  }

  private publishRemovalFeedback(snapshot: BookshelfOperationSnapshot, owner: ReaderRuntimeOwner): void {
    const route = this.scope.route();
    if ((route !== 'bookshelf' && route !== 'detail') || snapshot.action === 'import' ||
      snapshot.receipt?.receipt.confirmation === 'unknown' || snapshot.removalMutation?.blocked === true || snapshot.busy) return;
    const feedback = readerRecoveryView(snapshot.receipt);
    const message = snapshot.cleanupWarning.length > 0 ? `书籍已移出书架；应用内 EPUB 文件清理未完成：${snapshot.cleanupWarning}` :
      feedback.visible ? feedback.message : '';
    if (message.length === 0) {
      this.feedbackKey = '';
      return;
    }
    const key = `${snapshot.generation}:${message}`;
    if (key === this.feedbackKey) return;
    this.feedbackKey = key;
    try {
      this.scope.feedback(message, (): boolean => !this.scope.retired() &&
        this.scope.isCurrentOwner(owner) && this.scope.owner() === owner);
    } catch (_) {}
  }

  restore(): void {
    const owner = this.scope.owner();
    if (owner === undefined) return;
    const current = this.bookshelfAdmission(owner);
    const operation = this.scope.host().operations(owner);
    operation.restoreImport(AppStorage.get<string>(LOCAL_IMPORT_PRESENTATION_KEY) ?? '', current,
      (): boolean => this.scope.pickerInputAllowed(), this.scope.instance());
    if (!operation.isImportPresentationInstance(this.scope.instance())) return;
    this.owner = owner;
    this.snapshot = operation.current();
    this.importFocus = this.snapshot.importPresentation === undefined ? undefined :
      { identity: this.snapshot.importIdentity, routeCurrent: current };
    void operation.recoverRemoval(this.scope.filter(), current);
  }

  detach(): void {
    this.importFocus = undefined;
    this.retireSelection();
    this.scope.host().detachOperationPresentation();
  }

  openSelection(initialBook: ShelfBook | undefined, fallback: ShelfBook[]): void {
    const owner = this.scope.owner();
    if (owner === undefined) return;
    const navigation = this.scope.generation(), mounting = this.scope.mounting();
    const identity = ++this.selectionIdentity;
    const current = (): boolean => this.selectionOpening?.identity === identity && !this.scope.retired() &&
      this.scope.route() === 'bookshelfMultiSelect' && this.scope.generation() === navigation &&
      this.scope.mounting() === mounting && this.scope.owner() === owner && this.scope.isCurrentOwner(owner);
    const opening: BookshelfSelectionOpening = { identity, current };
    this.selectionOpening = opening;
    this.selectionVerifying = false;
    const initialKey = initialBook === undefined ? '' : this.selectionBookKey(initialBook);
    this.selection = { identity, books: fallback, initialKey, ready: false };
    void this.scope.readSelection().then((source: BookshelfState | undefined): void => {
      if (!current() || source === undefined) return;
      opening.source = source;
      this.selection = { identity, books: source.books, initialKey, ready: true };
    }).catch((_error: Error): void => {
      if (!current()) return;
      this.scope.feedback('书架读取失败，请重试', current);
      this.scope.leaveSelection();
    });
  }

  retireSelection(): void {
    if (this.selectionOpening === undefined) return;
    this.selectionOpening = undefined;
    this.selectionVerifying = false;
    this.selection = EMPTY_SELECTION;
  }

  requestSingleRemoval(book: ShelfBook): void {
    const owner = this.scope.owner(), projection = this.scope.shelfProjection();
    const source = projection.value?.shelf;
    if (owner === undefined || source === undefined || !this.canStartSingleRemoval()) return;
    const current = this.bookshelfAdmission(owner);
    const filter = projection.filter;
    const target: BookshelfRemovalTarget = { sourceId: book.sourceId, bookId: book.bookId };
    const addedAt = book.addedAt;
    const selected = (): boolean => {
      if (!current() || this.scope.readingActive()) return false;
      const latest = this.scope.shelfProjection(), activeFilter = this.scope.filter();
      return latest.generation === projection.generation && latest.revision === projection.revision &&
        filter.readingState === activeFilter.readingState && filter.sourceKind === activeFilter.sourceKind &&
        (filter.contentKind ?? 'all') === (activeFilter.contentKind ?? 'all') &&
        latest.books.some((candidate: ShelfBook): boolean => candidate.sourceId === target.sourceId &&
          candidate.bookId === target.bookId && candidate.addedAt === addedAt);
    };
    if (!selected()) return;
    const message = book.sourceId === 'local' ?
      `确定将“${book.title}”从书架移除吗？应用内解析内容、阅读进度和离线任务将一并删除；系统中的原始文件不受影响。` :
      `确定将“${book.title}”从书架移除吗？书源、阅读进度和已缓存正文不会删除，可再次通过搜索加入书架。`;
    this.scope.confirmRemoval(message, (): void => {
      void this.confirmSingleRemoval(owner, source, filter, target, current, selected);
    });
  }

  private async confirmSingleRemoval(owner: ReaderRuntimeOwner, source: BookshelfState, filter: BookshelfFilter,
    target: BookshelfRemovalTarget, current: () => boolean, selected: () => boolean): Promise<void> {
    if (!current() || !this.canStartSingleRemoval()) return;
    if (!selected()) {
      this.scope.feedback('书架已变化，请重新选择', current);
      return;
    }
    this.singleRemovalChecking = true;
    let matches: boolean | undefined;
    try {
      matches = await this.scope.selectionMatches(source, selected, filter);
    } catch (_) {
      if (selected()) this.scope.feedback('暂时无法核对书架，请重试', selected);
      return;
    } finally {
      this.singleRemovalChecking = false;
    }
    if (!current()) return;
    if (!selected() || matches === false) {
      if (matches === false) this.scope.refreshShelf();
      this.scope.feedback('书架已变化，请重新选择', current);
      return;
    }
    if (matches !== true || !this.canStartSingleRemoval()) return;
    const outcome = await this.remove(owner, [target], false, current).outcome;
    if (current() && outcome?.shelf !== undefined) {
      this.scope.invalidate();
      this.scope.apply(outcome.shelf);
    }
  }

  private canStartSingleRemoval(): boolean {
    return !this.singleRemovalChecking && this.snapshot.removalKey.length === 0 &&
      !this.snapshot.busy && !this.snapshot.reconcileBusy && !this.hasUnknownWrite();
  }

  requestSelectionRemoval(identity: number, keys: string[]): void {
    const opening = this.selectionOpening, source = opening?.source;
    if (opening === undefined || opening.identity !== identity || source === undefined ||
      !this.canRemoveSelection(opening) || keys.length === 0) return;
    const selectedKeys = new Set<string>(keys);
    const targets = source.books.filter((book: ShelfBook): boolean => selectedKeys.has(this.selectionBookKey(book)))
      .map((book: ShelfBook): BookshelfRemovalTarget => ({ sourceId: book.sourceId, bookId: book.bookId }));
    if (targets.length !== keys.length) return;
    this.scope.confirmRemoval(`确定将已选择的 ${targets.length} 本书移出书架吗？本地原始文件不受影响。`,
      (): void => { void this.confirmSelectionRemoval(opening, source, targets); });
  }

  private async confirmSelectionRemoval(opening: BookshelfSelectionOpening, source: BookshelfState,
    targets: BookshelfRemovalTarget[]): Promise<void> {
    const owner = this.scope.owner();
    if (owner === undefined || opening.source !== source || !this.canRemoveSelection(opening)) return;
    this.selectionVerifying = true;
    let matches: boolean | undefined;
    try {
      matches = await this.scope.selectionMatches(source, opening.current);
    } catch (_) {
      if (opening.current()) this.scope.feedback('暂时无法核对书架，请重试', opening.current);
      return;
    } finally {
      if (opening.current()) this.selectionVerifying = false;
    }
    if (opening.source !== source || !this.canRemoveSelection(opening) || matches === undefined) return;
    if (!matches) {
      this.openSelection(undefined, source.books);
      const current = this.selectionOpening?.current;
      if (current !== undefined) this.scope.feedback('书架已变化，请重新选择', current);
      return;
    }
    const outcome = await this.remove(owner, targets, true, opening.current).outcome;
    if (outcome === undefined || !opening.current()) return;
    if (outcome.shelf !== undefined) this.scope.apply(outcome.shelf);
    this.scope.finishSelection();
  }

  private canRemoveSelection(opening: BookshelfSelectionOpening): boolean {
    return opening.current() && !this.selectionVerifying && !this.snapshot.busy &&
      !this.snapshot.reconcileBusy && !this.hasUnknownWrite();
  }

  private selectionBookKey(book: ShelfBook): string { return `${book.sourceId}\u0000${book.bookId}`; }

  hasUnknownWrite(): boolean {
    return this.scope.isCurrentOwner(this.owner) &&
      (this.snapshot.receipt?.receipt.confirmation === 'unknown' || this.snapshot.removalMutation?.blocked === true);
  }

  canContinueRemoval(): boolean {
    const original = this.snapshot.removalMutation;
    return this.scope.isCurrentOwner(this.owner) && !this.snapshot.busy && !this.snapshot.reconcileBusy &&
      original?.blocked === true && original.canContinueOriginal &&
      (original.method === 'bookshelf.remove' || original.method === 'bookshelf.removeBatch');
  }

  recovery(): ReaderRecoveryView {
    if (!this.scope.isCurrentOwner(this.owner)) return emptyRecovery();
    const original = this.snapshot.removalMutation;
    if (original?.blocked) return { message: original.message || '原书架操作尚待核对，已保留原内容', visible: true,
      canRetry: (original.method === 'bookshelf.remove' || original.method === 'bookshelf.removeBatch') &&
        !this.snapshot.busy && !this.snapshot.reconcileBusy, generation: this.snapshot.generation };
    return this.snapshot.receipt?.receipt.confirmation === 'unknown' ? readerRecoveryView(this.snapshot.receipt) : emptyRecovery();
  }

  importRecovery(): ReaderRecoveryView {
    return this.snapshot.action === 'import' ? readerRecoveryView(this.snapshot.receipt) : emptyRecovery();
  }

  importBlockMessage(): string {
    if (this.snapshot.busy) return '上次书架操作仍在处理中，请稍候。关闭窗口不会取消已开始的导入。';
    if (this.snapshot.reconcileBusy) return '正在读取书架状态，请稍候。';
    return this.hasUnknownWrite() ? '上次操作结果待核对，请先刷新书架。' : '';
  }

  openImport(focusTarget?: string): void {
    const owner = this.scope.owner();
    if (owner === undefined || this.scope.retired() || this.scope.route() !== 'bookshelf') return;
    const operation = this.scope.host().operations(owner);
    const previousIdentity = operation.current().importIdentity;
    const current = this.bookshelfAdmission(owner);
    operation.openImport(current, (): boolean => this.scope.pickerInputAllowed(), this.scope.instance());
    const opened = operation.current();
    if (opened.importIdentity !== previousIdentity && opened.importPresentation !== undefined) {
      this.importFocus = { identity: opened.importIdentity, target: focusTarget, routeCurrent: current };
    }
  }

  importFocusReturn(identity: number): BookshelfImportFocusReturn | undefined {
    const opening = this.importFocus;
    if (opening === undefined || opening.identity !== identity) return undefined;
    return { target: opening.target, isCurrent: (): boolean => this.importFocus === opening &&
      this.snapshot.importPresentation === undefined && this.snapshot.importIdentity !== identity && opening.routeCurrent() };
  }

  closeImport(): void {
    const owner = this.owner;
    if (owner !== undefined && this.scope.isCurrentOwner(owner))
      this.scope.host().operations(owner).closeImport(this.scope.instance());
  }

  async selectImport(identity: number, navigation: number, mayOpenPicker: () => boolean): Promise<void> {
    const owner = this.owner;
    if (owner === undefined) return;
    // The operation owner checks this caller lease before launching the picker.
    // Once opened, the system can background Reader while the exact import
    // opening still owns the selection and any accepted write.
    const admitted = (): boolean => mayOpenPicker() && this.isCurrentImport(identity, navigation, owner);
    if (!admitted()) return;
    await this.scope.host().operations(owner).importFiles(this.scope.filter(), admitted);
  }

  dismissImport(identity: number, navigation: number): void {
    const owner = this.owner;
    if (owner !== undefined && this.isCurrentImport(identity, navigation, owner)) this.closeImport();
  }

  async reconcile(generation: number, importIdentity?: number, navigation: number = this.scope.generation()): Promise<void> {
    const owner = this.owner;
    if (owner === undefined || (importIdentity !== undefined && !this.isCurrentImport(importIdentity, navigation, owner))) return;
    const admitted = this.bookshelfAdmission(owner, navigation);
    const identity = this.snapshot.importIdentity;
    const dialogVisible = this.snapshot.importPresentation !== undefined;
    const current = (): boolean => admitted() && (!dialogVisible || identity === this.snapshot.importIdentity);
    if (!current()) return;
    const read = await this.scope.host().operations(owner).reconcile(generation, this.scope.filter(), current);
    if (current() && read?.value !== undefined) { this.scope.invalidate(); this.scope.apply(read.value); }
  }

  async continueRemoval(generation: number): Promise<void> {
    const owner = this.owner;
    if (owner === undefined || generation !== this.snapshot.generation || !this.canContinueRemoval()) return;
    const current = this.bookshelfAdmission(owner);
    if (!current()) return;
    const read = await this.scope.host().operations(owner).continueRemoval(generation, this.scope.filter(), current);
    if (current() && read?.value !== undefined) { this.scope.invalidate(); this.scope.apply(read.value); }
  }

  remove(owner: ReaderRuntimeOwner, targets: BookshelfRemovalTarget[], batch: boolean,
    current: () => boolean): BookshelfRemovalDispatch {
    const operation = this.scope.host().operations(owner);
    const outcome = operation.remove(targets, batch, this.scope.filter(), current);
    return { generation: operation.current().generation, outcome };
  }

  private isCurrentImport(identity: number, navigation: number, owner: ReaderRuntimeOwner): boolean {
    return this.bookshelfAdmission(owner, navigation)() &&
      this.snapshot.importIdentity === identity && this.snapshot.importPresentation !== undefined &&
      this.scope.host().operations(owner).isImportPresentationInstance(this.scope.instance());
  }

  private bookshelfAdmission(owner: ReaderRuntimeOwner, navigation: number = this.scope.generation()): () => boolean {
    const mounting = this.scope.mounting();
    return (): boolean => !this.scope.retired() && this.scope.owner() === owner && this.scope.isCurrentOwner(owner) &&
      this.scope.route() === 'bookshelf' && this.scope.generation() === navigation && this.scope.mounting() === mounting;
  }
}
