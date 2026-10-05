import type { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import { BookshelfReadOwner } from './BookshelfReadOwner';
import type { BookshelfReadResult } from './BookshelfReadOwner';
import type { BookshelfDataState, BookshelfFilter, BookshelfFlowGateway } from './BookshelfFlowGateway';
import type { BookSource } from '../source/SourceGateway';
import { bookshelfSourceDisplayName, readableBookshelfSourceName, type BookshelfNamedSource } from './BookshelfSourceNameProjection';

export interface BookshelfProjectionSnapshot {
  generation: number;
  filter: BookshelfFilter;
  books: ShelfBook[];
  revision: string;
  matchedTotal: number;
  offset: number;
  hasOnlineBooks: boolean;
  continueReading?: ShelfBook;
  value?: BookshelfDataState;
  facts?: OperationFacts<BookshelfDataState>;
  pageLoading: boolean;
  visualAdmitted: boolean;
  coreEmpty: boolean;
}
export interface BookshelfProjectionBinding {
  identity: string;
  current: () => boolean;
  anchorKey: () => string;
  sources: () => BookshelfNamedSource[][];
  emit: (snapshot: BookshelfProjectionSnapshot) => void;
  membership: (books: ShelfBook[]) => void;
  membershipNeeded?: () => boolean;
  accepted?: (state: BookshelfDataState) => void;
  failed?: (error: Error) => void;
}

/** Finite shelf read/window/source-metadata owner. Core owns durable rows and
 * cursors; this owner never dispatches book/import mutations. UI owns scroll. */
export class BookshelfProjectionOwner {
  private binding: BookshelfProjectionBinding | undefined;
  private sourceNameRequest: number = 0;
  private membershipRequest: number = 0;
  private pageTask: number = 0;
  private deliveryFailed: boolean = false;
  private value: BookshelfProjectionSnapshot = { generation: 0,
    filter: { readingState: 'all', sourceKind: 'all' }, books: [], revision: '',
    matchedTotal: 0, offset: 0, hasOnlineBooks: false, pageLoading: false,
    visualAdmitted: false, coreEmpty: false };
  constructor(private readonly owner: ReaderRuntimeOwner, private readonly ownsRuntime: () => boolean,
    private readonly gateway: (filter: BookshelfFilter) => BookshelfFlowGateway,
    private readonly loadSources: (ids: string[], current: () => boolean) => Promise<BookSource[]>) {}
  owns(owner: ReaderRuntimeOwner): boolean { return owner === this.owner; }
  snapshot(): BookshelfProjectionSnapshot { return this.value; }
  attach(binding: BookshelfProjectionBinding): boolean {
    if (!this.admitted(binding)) return false;
    this.binding = binding; this.publish(binding); return true;
  }
  detach(identity: string): void { if (this.binding?.identity === identity) this.binding = undefined; }
  invalidate(): void {
    this.value = { ...this.value, generation: this.value.generation + 1, pageLoading: false };
    this.pageTask += 1; this.sourceNameRequest += 1; this.membershipRequest += 1;
    this.publish();
  }
  async refresh(filter: BookshelfFilter, binding: BookshelfProjectionBinding,
    retryBlank: boolean): Promise<BookshelfReadResult | undefined> {
    if (!this.admitted(binding)) return;
    this.attach(binding); this.invalidate();
    const generation = this.value.generation;
    this.deliveryFailed = false;
    const captured: BookshelfFilter = { readingState: filter.readingState, sourceKind: filter.sourceKind,
      contentKind: filter.contentKind ?? 'all' };
    this.value = { ...this.value, filter: captured };
    const current = (): boolean => this.current(binding) && generation === this.value.generation;
    const retained = this.value.value;
    const admittedBeforeRead = this.value.visualAdmitted;
    const read = new BookshelfReadOwner(this.owner, (live): Promise<BookshelfDataState> => this.gateway(captured).load(live));
    const result = await read.read(generation, current, retained, retryBlank, (facts): void => {
      if (!current()) return;
      this.value = { ...this.value, facts };
      if ((facts.fact === 'current' || facts.fact === 'empty') && facts.value !== undefined) {
        if (this.value.visualAdmitted && facts.value.kind !== 'populated') {
          this.value = { ...this.value, facts: projectOperationFacts({ phase: 'partial', value: retained,
            generation, canRetry: true, message: '当前读回为空，暂保留原书架，可重新读取以核对' }) };
          this.publish(binding);
        } else this.accept(facts.value, captured, binding, true);
      } else this.publish(binding);
    });
    const presentationFailed = result?.presentationFailed === true || this.deliveryFailed;
    if (current() && presentationFailed) {
      this.value = { ...this.value, visualAdmitted: admittedBeforeRead, facts: projectOperationFacts({ phase: 'partial', value: this.value.value,
        generation, canRetry: true, message: '书架读取已完成，显示更新未完成，请重新读取' }) };
      this.publish(binding);
    }
    return result === undefined ? undefined : { facts: result.facts, presentationFailed };
  }
  accept(state: BookshelfDataState, filter: BookshelfFilter, binding: BookshelfProjectionBinding,
    refreshOnly: boolean = false, preserveAnchor: boolean = true): void {
    if (!this.current(binding)) return;
    const generation = this.value.generation;
    const anchor = state.shelf.projectionRevision === undefined ? '' : binding.anchorKey();
    if (preserveAnchor && state.kind === 'populated' && state.shelf.projectionRevision !== undefined &&
      anchor.length > 0 && this.value.books.some(book => this.key(book) === anchor) &&
      !state.shelf.books.some(book => this.key(book) === anchor)) {
      const book = this.value.books.find(item => this.key(item) === anchor);
      if (book === undefined) return;
      const current = (): boolean => this.current(binding) && generation === this.value.generation;
      void this.gateway(filter).loadAnchor({ sourceId: book.sourceId, bookId: book.bookId }, this.value.offset, current)
        .then((shelf): void => { if (current() && shelf !== undefined)
          this.accept({ kind: 'populated', shelf, continueReading: state.continueReading }, filter, binding, refreshOnly, false); })
        .catch((error: Error): void => { if (current()) this.diagnose(binding, error); });
      return;
    }
    if (refreshOnly && state.kind !== 'populated' && this.value.visualAdmitted) return;
    const cached = new Map<string, string>();
    for (const book of this.value.books) {
      const name = book.sourceName?.trim() ?? '';
      if (readableBookshelfSourceName(book.sourceId, name)) cached.set(book.sourceId, name);
    }
    const books = state.shelf.books.map((book): ShelfBook => {
      const saved = book.sourceName?.trim() ?? '';
      const name = saved === '书源已移除' || readableBookshelfSourceName(book.sourceId, saved) ? saved :
        cached.get(book.sourceId) ?? bookshelfSourceDisplayName(book.sourceId, '', binding.sources());
      return this.copyName(book, name);
    });
    let facts = this.value.facts;
    if (facts?.fact === 'refreshFailed' || facts?.fact === 'partial') facts = projectOperationFacts({
      phase: state.kind === 'empty' ? 'empty' : 'succeeded', value: state, generation, canRetry: false });
    this.value = { ...this.value, filter: { readingState: filter.readingState, sourceKind: filter.sourceKind,
      contentKind: filter.contentKind ?? 'all' }, value: state,
      books, facts, revision: state.shelf.projectionRevision ?? '', matchedTotal: state.shelf.total,
      offset: state.shelf.offset ?? 0, hasOnlineBooks: (state.shelf.unfilteredOnlineTotal ?? 0) > 0,
      continueReading: state.continueReading, coreEmpty: state.kind === 'empty', visualAdmitted: state.kind === 'populated' };
    this.publish(binding);
    if (this.completeMembership()) this.deliver(binding, (): void => binding.membership(books));
    else if (binding.membershipNeeded?.() === true) void this.refreshMembership(binding);
    this.deliver(binding, (): void => binding.accepted?.(state));
    if (state.shelf.books.some(book => book.sourceId !== 'local' && (book.sourceName === undefined ||
      book.sourceName.trim().length === 0 || book.sourceName === '书源名称暂不可用'))) void this.hydrate(binding);
  }
  async page(previous: boolean, binding: BookshelfProjectionBinding): Promise<void> {
    const before = this.value, start = before.offset, count = before.books.length;
    if (!this.current(binding) || before.pageLoading || before.revision.length === 0 ||
      (previous ? start === 0 : start + count >= before.matchedTotal)) return;
    const task = ++this.pageTask, generation = before.generation, revision = before.revision;
    const offset = previous ? Math.max(0, start - 48) : start + count;
    const current = (): boolean => task === this.pageTask && this.current(binding) && generation === this.value.generation &&
      revision === this.value.revision && start === this.value.offset && count === this.value.books.length;
    this.value = { ...before, pageLoading: true }; this.publish(binding);
    try {
      const page = await this.gateway(before.filter).loadPage(offset, revision, false, current);
      if (!current()) return;
      if (page.changed) { await this.refresh(before.filter, binding, false); return; }
      if (page.projectionRevision !== revision || page.total !== before.matchedTotal || page.books.length === 0 ||
        (page.offset !== undefined && page.offset !== offset) || (previous && page.books.length !== start - offset)) throw Error('BOOKSHELF_PAGE_INCONSISTENT');
      const identities = new Set(before.books.map(book => this.key(book)));
      if (page.books.some(book => identities.has(this.key(book)))) throw Error('BOOKSHELF_PAGE_DUPLICATE');
      const combined = previous ? page.books.concat(before.books) : before.books.concat(page.books);
      const drop = Math.ceil(Math.max(0, combined.length - 144) / 48) * 48;
      this.value = { ...this.value, offset: previous ? offset : start + drop,
        books: previous ? combined.slice(0, 144) : combined.slice(drop) };
      this.publish(binding);
    } catch (error) { if (current()) this.diagnose(binding, error as Error); }
    finally { if (task === this.pageTask) { this.value = { ...this.value, pageLoading: false }; this.publish(binding); } }
  }
  async refreshMembership(binding: BookshelfProjectionBinding): Promise<void> {
    const request = ++this.membershipRequest;
    const current = (): boolean => request === this.membershipRequest && this.current(binding);
    if (!current()) return;
    try { const shelf = await this.gateway({ readingState: 'all', sourceKind: 'all' }).loadAll(current, true);
      if (current() && shelf !== undefined) this.deliver(binding, (): void => binding.membership(shelf.books));
    } catch (error) { if (current()) this.diagnose(binding, error as Error); }
  }
  async selection(binding: BookshelfProjectionBinding): Promise<ShelfBook[] | undefined> {
    const generation = this.value.generation;
    const current = (): boolean => generation === this.value.generation && this.current(binding);
    if (!current()) return undefined;
    try {
      const shelf = await this.gateway({ readingState: 'all', sourceKind: 'all' }).loadAll(current);
      return current() ? shelf?.books : undefined;
    } catch (error) { if (current()) throw error; return undefined; }
  }
  private async hydrate(binding: BookshelfProjectionBinding): Promise<void> {
    const request = ++this.sourceNameRequest, generation = this.value.generation, books = this.value.books;
    const current = (): boolean => request === this.sourceNameRequest && generation === this.value.generation &&
      books === this.value.books && this.current(binding);
    try {
      const sources = await this.loadSources(books.map(book => book.sourceId), current);
      if (!current()) return;
      const names = new Map<string, string>();
      for (const source of sources) { const name = source.name.trim(); if (readableBookshelfSourceName(source.sourceId, name)) names.set(source.sourceId, name); }
      let changed = false;
      const projected = books.map((book): ShelfBook => {
        if (book.sourceName === '书源已移除') return book;
        const name = book.sourceId === 'local' ? '本地书籍' : names.get(book.sourceId);
        if (name === undefined || book.sourceName === name) return book;
        changed = true; return this.copyName(book, name);
      });
      if (!changed) return;
      this.value = { ...this.value, books: projected }; this.publish(binding);
      if (this.completeMembership()) this.deliver(binding, (): void => binding.membership(projected));
    } catch (_) { /* Exact Core persisted name survives a transient registry read. */ }
  }
  private completeMembership(): boolean { return this.value.revision.length === 0 ||
    (this.value.filter.readingState === 'all' && this.value.filter.sourceKind === 'all' &&
      (this.value.filter.contentKind ?? 'all') === 'all' && this.value.books.length === this.value.matchedTotal); }
  private key(book: ShelfBook): string { return JSON.stringify([book.sourceId, book.bookId]); }
  private admitted(binding: BookshelfProjectionBinding): boolean { try { return this.ownsRuntime() && binding.current(); } catch (_) { return false; } }
  private current(binding: BookshelfProjectionBinding): boolean { return this.binding === binding && this.admitted(binding); }
  private publish(binding: BookshelfProjectionBinding | undefined = this.binding): void { if (binding !== undefined)
    this.deliver(binding, (): void => binding.emit(this.value)); }
  private deliver(binding: BookshelfProjectionBinding, action: () => void): void { if (this.current(binding)) try { action(); } catch (_) { this.deliveryFailed = true; } }
  private diagnose(binding: BookshelfProjectionBinding, error: Error): void { this.deliver(binding, (): void => binding.failed?.(error)); }
  private copyName(book: ShelfBook, sourceName: string): ShelfBook {
    const copy: ShelfBook = { sourceId: book.sourceId, sourceName, bookId: book.bookId, title: book.title, author: book.author, addedAt: book.addedAt };
    if (book.kind !== undefined) copy.kind = book.kind;
    if (book.coverUrl !== undefined) copy.coverUrl = book.coverUrl;
    if (book.intro !== undefined) copy.intro = book.intro;
    if (book.lastChapter !== undefined) copy.lastChapter = book.lastChapter;
    if (book.lastReadAt !== undefined) copy.lastReadAt = book.lastReadAt;
    if (book.group !== undefined) copy.group = book.group;
    if (book.sortIndex !== undefined) copy.sortIndex = book.sortIndex;
    if (book.unreadCount !== undefined) copy.unreadCount = book.unreadCount;
    if (book.lastCheckAt !== undefined) copy.lastCheckAt = book.lastCheckAt;
    if (book.currentChapterTitle !== undefined) copy.currentChapterTitle = book.currentChapterTitle;
    if (book.currentChapterIndex !== undefined) copy.currentChapterIndex = book.currentChapterIndex;
    if (book.chapterCount !== undefined) copy.chapterCount = book.chapterCount;
    if (book.readProgress !== undefined) copy.readProgress = book.readProgress;
    if (book.readingPosition !== undefined) copy.readingPosition = book.readingPosition;
    return copy;
  }
}
