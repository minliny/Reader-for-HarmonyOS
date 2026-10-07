import { BookshelfFlowGateway } from '../bookshelf/BookshelfFlowGateway';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { SharedDownloadGateway } from './SharedDownloadGateway';
import { createDownloadBookView, type DownloadBookView } from './SharedDownloadProjection';

export interface SharedDownloadSnapshot {
  books: DownloadBookView[];
  loading: boolean;
  error: string;
}

/** Read-only page projection over the existing bookshelf/cache authorities.
 * Never starts a download, changes retention or opens the reader. */
export class SharedDownloadHost {
  private generation: number = 0;
  private snapshot: SharedDownloadSnapshot = { books: [], loading: false, error: '' };
  private readonly gateway: SharedDownloadGateway;
  private readonly refreshes: Map<string, Promise<void>> = new Map();
  private readonly owner: ReaderRuntimeOwner;
  private readonly publish: (snapshot: SharedDownloadSnapshot) => void;

  constructor(owner: ReaderRuntimeOwner, publish: (snapshot: SharedDownloadSnapshot) => void) {
    this.owner = owner;
    this.publish = publish;
    this.gateway = new SharedDownloadGateway(owner);
  }

  retire(): void { this.generation += 1; this.refreshes.clear(); }

  async reload(current: () => boolean): Promise<void> {
    const generation = ++this.generation;
    this.refreshes.clear();
    const active = (): boolean => generation === this.generation && current();
    if (!active()) return;
    this.update({ books: this.snapshot.books, loading: true, error: '' }, active);
    try {
      const shelf = await new BookshelfFlowGateway(this.owner,
        { readingState: 'all', sourceKind: 'all', contentKind: 'all' }, true).loadAll(active);
      if (!active() || shelf === undefined) return;
      // Publish all shelf rows first. A cache/manifest failure cannot drop a
      // book or replace an unknown state with a fictitious download failure.
      const rows = shelf.books.map((book: ShelfBook): DownloadBookView => createDownloadBookView(book));
      this.update({ books: rows, loading: rows.length > 0, error: '' }, active);
      let next = 0;
      const hydrate = async (): Promise<void> => {
        while (active() && next < rows.length) {
          const row = rows[next++];
          const loaded = await this.loadRow(row, active);
          if (!active()) return;
          this.replace(loaded, active);
        }
      };
      await Promise.all([hydrate(), hydrate(), hydrate()]);
      if (active()) this.update({ books: this.snapshot.books, loading: false, error: '' }, active);
    } catch (_) {
      if (active()) this.update({ books: this.snapshot.books, loading: false,
        error: '书架下载信息暂时无法读取，请重试' }, active);
    }
  }

  async refreshBook(book: DownloadBookView, current: () => boolean): Promise<void> {
    // Avoid a second whole-book probe while the bounded refresh is active.
    if (this.snapshot.loading || !current()) return;
    const existing = this.refreshes.get(book.key);
    if (existing !== undefined) { await existing; return; }
    const generation = this.generation;
    const active = (): boolean => generation === this.generation && current();
    if (!this.snapshot.books.some((row: DownloadBookView): boolean => row.key === book.key)) return;
    const work = (async (): Promise<void> => {
      const loaded = await this.loadRow(book, active);
      if (active()) this.replace(loaded, active);
    })();
    this.refreshes.set(book.key, work);
    try { await work; }
    finally { if (this.refreshes.get(book.key) === work) this.refreshes.delete(book.key); }
  }

  private async loadRow(book: DownloadBookView, current: () => boolean): Promise<DownloadBookView> {
    try { return await this.gateway.load(book, current); }
    catch (_) {
      const unavailable = createDownloadBookView(book.shelfBook);
      unavailable.projectionStatus = 'unavailable';
      unavailable.projectionError = '下载信息暂时无法读取，请重试';
      return unavailable;
    }
  }

  private replace(book: DownloadBookView, current: () => boolean): void {
    this.update({ books: this.snapshot.books.map((row: DownloadBookView): DownloadBookView =>
      row.key === book.key ? book : row), loading: this.snapshot.loading, error: this.snapshot.error }, current);
  }

  private update(snapshot: SharedDownloadSnapshot, current: () => boolean): void {
    if (!current()) return;
    this.snapshot = snapshot;
    this.publish(snapshot);
  }
}
