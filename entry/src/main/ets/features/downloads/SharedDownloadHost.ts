import type { BookAcquisitionChange } from '../../app/BookAcquisitionCoordinator';
import { BookshelfFlowGateway } from '../bookshelf/BookshelfFlowGateway';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { SharedDownloadGateway } from './SharedDownloadGateway';
import { createDownloadBookView, type DownloadBookView, type DownloadStorageSummary, type SharedDownloadActionTarget } from './SharedDownloadProjection';
import { ReadingOfflineHost, type ReadingOfflineBinding } from '../reading/ReadingOfflineHost';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';

export interface SharedDownloadSnapshot {
  books: DownloadBookView[];
  loading: boolean;
  error: string;
  storageSummary: DownloadStorageSummary;
}

type IndexedDownloadBook = {
  statusRevision: string;
  view: DownloadBookView;
};

// The download page is mounted again when returning from settings. Keep the
// last Core-certified per-book summary for the lifetime of the runtime, while
// binding every reuse to the independent download clock and catalog revision.
// This avoids thousands of repeated cache.book.status calls on a large shelf
// without treating a download/clear/source mutation as a fresh fact.
const DOWNLOAD_STATUS_INDEX = new WeakMap<object, Map<string, IndexedDownloadBook>>();

/** Read-only page projection over the existing bookshelf/cache authorities.
 * Never starts a download, changes retention or opens the reader. */
export class SharedDownloadHost {
  private generation: number = 0;
  private snapshot: SharedDownloadSnapshot = { books: [], loading: false, error: '', storageSummary: {} };
  private readonly gateway: SharedDownloadGateway;
  private readonly refreshes: Map<string, Promise<void>> = new Map();
  private readonly owner: ReaderRuntimeOwner;
  private readonly publish: (snapshot: SharedDownloadSnapshot) => void;
  private unsubscribeDownloadStatus: (() => void) | undefined;
  private progressTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingBookKeys: Set<string> = new Set();
  private progressInFlight: boolean = false;
  private readonly rowPositions: Map<string, number> = new Map();
  private readonly statusIndex: Map<string, IndexedDownloadBook> | undefined;

  constructor(owner: ReaderRuntimeOwner, publish: (snapshot: SharedDownloadSnapshot) => void) {
    this.owner = owner;
    this.publish = publish;
    this.gateway = new SharedDownloadGateway(owner);
    this.statusIndex = DOWNLOAD_STATUS_INDEX.get(owner) ?? new Map<string, IndexedDownloadBook>();
    DOWNLOAD_STATUS_INDEX.set(owner, this.statusIndex);
  }

  retire(): void {
    this.generation += 1; this.refreshes.clear(); this.stopProgress();
  }

  private stopProgress(): void {
    this.unsubscribeDownloadStatus?.(); this.unsubscribeDownloadStatus = undefined;
    if (this.progressTimer !== undefined) clearTimeout(this.progressTimer);
    this.progressTimer = undefined; this.pendingBookKeys.clear();
  }

  async reload(current: () => boolean): Promise<void> {
    const generation = ++this.generation;
    this.refreshes.clear(); this.stopProgress();
    const active = (): boolean => generation === this.generation && current();
    if (!active()) return;
    this.update({ books: this.snapshot.books, loading: true, error: '', storageSummary: this.snapshot.storageSummary }, active);
    try {
      const shelf = await new BookshelfFlowGateway(this.owner,
        { readingState: 'all', sourceKind: 'all', contentKind: 'all' }, true).loadAll(active);
      if (!active() || shelf === undefined) return;
      // Publish all shelf rows first. A cache/manifest failure cannot drop a
      // book or replace an unknown state with a fictitious download failure.
      const shelfKeys = new Set(shelf.books.map((book: ShelfBook): string => JSON.stringify([book.sourceId, book.bookId])));
      for (const key of this.statusIndex?.keys() ?? []) {
        if (!shelfKeys.has(key)) this.statusIndex?.delete(key);
      }
      const rows = shelf.books.map((book: ShelfBook): DownloadBookView => {
        const fresh = createDownloadBookView(book);
        return this.reuseIndexedRow(fresh, this.currentStatusRevision(fresh)) ?? fresh;
      });
      // Publish the real shelf rows before the advisory storage walk. On a
      // large library the summary may require bounded classification batches;
      // it must never delay the first usable frame or make a failed summary
      // look like a failed download projection.
      this.update({ books: rows, loading: rows.length > 0, error: '', storageSummary: this.snapshot.storageSummary }, active);
      this.bindProgress(active);
      void this.refreshStorageSummary(active);
      let next = 0;
      const hydrate = async (): Promise<void> => {
        while (active() && next < rows.length) {
          const row = rows[next++];
          const loaded = await this.loadRow(row, active, false, this.currentStatusRevision(row));
          if (!active()) return;
          this.replace(loaded, active);
        }
      };
      await Promise.all([hydrate(), hydrate(), hydrate()]);
      if (active()) this.scheduleProgress(active);
      if (active()) this.update({ books: this.snapshot.books, loading: false, error: '', storageSummary: this.snapshot.storageSummary }, active);
    } catch (_) {
      if (active()) this.update({ books: this.snapshot.books, loading: false,
        error: '书架下载信息暂时无法读取，请重试', storageSummary: this.snapshot.storageSummary }, active);
    }
  }

  private async refreshStorageSummary(current: () => boolean): Promise<void> {
    try {
      const measured = await this.owner.mangaStorageSummary();
      if (current()) this.update({ ...this.snapshot, storageSummary: measured }, current);
    } catch (_) {
      // Storage summary is advisory; leave the rows usable and preserve the
      // last known summary for an explicit retry.
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
      const loaded = await this.loadRow(book, active, true, this.currentStatusRevision(book));
      if (active()) this.replace(loaded, active);
    })();
    this.refreshes.set(book.key, work);
    try { await work; }
    finally { if (this.refreshes.get(book.key) === work) this.refreshes.delete(book.key); }
  }

  async runAction(action: 'download' | 'pause' | 'cancel' | 'deleteLocal' | 'cleanup' | 'configureStorage',
    targets: SharedDownloadActionTarget[],
    current: () => boolean, cacheLimitMb?: number, cleanupAfterDays?: number): Promise<void> {
    if (!current()) return;
    if (action === 'configureStorage') {
      await this.owner.configureDownloadStorage(cacheLimitMb ?? 2048, cleanupAfterDays ?? 7);
      return;
    }
    if (action === 'cleanup') {
      await this.owner.clearDownloadRebuildableCache();
      return;
    }
    for (const target of targets) {
      if (!current()) return;
      const book = this.snapshot.books.find(row => row.sourceId === target.sourceId && row.bookId === target.bookId);
      if (book === undefined || book.projectionStatus !== 'ready') continue;
      const selected = book.chapters.filter(chapter => chapter.navigable &&
        (target.chapterIndices === undefined || target.chapterIndices.includes(chapter.index)));
      if (action === 'deleteLocal') {
        await this.owner.clearDownloadBook(book.sourceId, book.bookId);
        continue;
      }
      if (action === 'pause' || action === 'cancel') {
        for (const chapter of selected) {
          if (chapter.localComplete || (action === 'pause' && chapter.queueState !== 'queued' && chapter.queueState !== 'inProgress') ||
            (action === 'cancel' && chapter.queueState !== 'queued' && chapter.queueState !== 'inProgress' &&
              chapter.queueState !== 'paused' && chapter.queueState !== 'failed')) continue;
          await this.owner.controlDownloadTask(action, book.sourceId, book.bookId, chapter.index);
        }
        continue;
      }
      const session = await this.gateway.loadOfflineSession(book, current);
      const offline = ReadingOfflineHost.forRuntime(this.owner, current);
      if (offline === undefined) throw new Error('DOWNLOAD_OFFLINE_HOST_UNAVAILABLE');
      const binding = this.downloadBinding(session, book, current);
      const indexes = selected.filter(chapter => !chapter.localComplete).map(chapter => chapter.index);
      for (const chapter of selected) if (chapter.queueState === 'paused')
        await this.owner.controlDownloadTask('resume', book.sourceId, book.bookId, chapter.index);
      if (indexes.length === 0) continue;
      if (target.chapterIndices === undefined) await offline.downloadBook(binding, indexes);
      else for (const index of indexes) await offline.downloadChapter(index, binding);
    }
  }

  private downloadBinding(session: import('../reading/RemoteReadingFlowGateway').RemoteReadingSession,
    book: DownloadBookView, current: () => boolean): ReadingOfflineBinding {
    const entries = (): LocalReadingTocEntry[] => book.chapters.map(chapter => ({
      index: chapter.index, title: chapter.title,
      navigable: chapter.navigable, downloadState: chapter.queueState,
    }));
    return { session, current, currentEntries: entries, emitEntries: (): void => {},
      onProgress: (): void => {}, failed: (error: Error): void => { throw error; } };
  }

  private async loadRow(book: DownloadBookView, current: () => boolean, force: boolean,
    statusRevision: string | undefined): Promise<DownloadBookView> {
    if (!force) {
      const indexed = this.reuseIndexedRow(book, statusRevision);
      if (indexed !== undefined) return indexed;
    }
    try {
      const loaded = await this.gateway.load(book, current);
      this.indexLoadedRow(loaded, statusRevision);
      return loaded;
    }
    catch (_) {
      const unavailable = createDownloadBookView(book.shelfBook);
      unavailable.projectionStatus = 'unavailable';
      unavailable.projectionError = '下载信息暂时无法读取，请重试';
      return unavailable;
    }
  }

  private currentStatusRevision(book: DownloadBookView): string | undefined {
    try {
      const coordinator = this.owner.bookAcquisitions?.();
      const downloadRevision = coordinator?.downloadStatusRevision?.(book.sourceId, book.bookId);
      return typeof downloadRevision === 'number' && Number.isSafeInteger(downloadRevision) && downloadRevision >= 0 ?
        String(downloadRevision) : undefined;
    } catch (_) {
      // Test/runtime adapters without the optional acquisition coordinator do
      // not get an index entry; their existing read behavior is unchanged.
      return undefined;
    }
  }

  private reuseIndexedRow(fresh: DownloadBookView, revision: string | undefined): DownloadBookView | undefined {
    if (revision === undefined || fresh.contentKind === undefined) return undefined;
    const indexed = this.statusIndex?.get(fresh.key);
    if (indexed === undefined || indexed.statusRevision !== revision || indexed.view.contentKind !== fresh.contentKind) return undefined;
    const cached = indexed.view;
    if (JSON.stringify(cached.shelfBook) === JSON.stringify(fresh.shelfBook)) return cached;
    return { ...cached, key: fresh.key, shelfBook: fresh.shelfBook, sourceId: fresh.sourceId,
      bookId: fresh.bookId, coverUrl: fresh.coverUrl, title: fresh.title, author: fresh.author,
      sourceLabel: fresh.sourceLabel, contentKind: fresh.contentKind, recentRead: fresh.recentRead };
  }

  private indexLoadedRow(view: DownloadBookView, revision: string | undefined): void {
    if (revision === undefined || view.projectionStatus !== 'ready' || view.contentKind === undefined ||
      this.currentStatusRevision(view) !== revision) return;
    this.statusIndex?.set(view.key, { statusRevision: revision, view });
  }

  private sameRow(left: DownloadBookView, right: DownloadBookView): boolean {
    return left === right || JSON.stringify(left) === JSON.stringify(right);
  }

  private bindProgress(current: () => boolean): void {
    this.unsubscribeDownloadStatus = this.owner.bookAcquisitions?.().subscribeDownloadStatus?.((change: BookAcquisitionChange): void => {
      if (!current()) return;
      if (change.reset) for (const book of this.snapshot.books) this.pendingBookKeys.add(book.key);
      for (const identity of change.identities) {
        const key = JSON.stringify([identity.sourceId, identity.bookId]);
        if (this.rowPositions.has(key)) this.pendingBookKeys.add(key);
      }
      this.scheduleProgress(current);
    });
  }

  /** Coalesce progress bursts, read only changed books and publish one patch.
   * Notification refreshes never rebuild unrelated shelf rows or catalog facts. */
  private scheduleProgress(current: () => boolean): void {
    if (!current() || this.progressTimer !== undefined || this.progressInFlight || this.pendingBookKeys.size === 0) return;
    this.progressTimer = setTimeout((): void => {
      this.progressTimer = undefined;
      if (!current()) return;
      if (this.snapshot.loading) { this.scheduleProgress(current); return; }
      this.progressInFlight = true;
      const keys = Array.from(this.pendingBookKeys); this.pendingBookKeys.clear();
      const changed: DownloadBookView[] = [];
      let next = 0;
      const hydrate = async (): Promise<void> => {
        while (current() && next < keys.length) {
          const index = this.rowPositions.get(keys[next++]);
          if (index === undefined) continue;
          const row = this.snapshot.books[index];
          const loaded = await this.loadRow(row, current, true, this.currentStatusRevision(row));
          if (current()) changed.push(loaded);
        }
      };
      void Promise.all([hydrate(), hydrate(), hydrate()]).then((): void => {
        if (!current()) return;
        let books: DownloadBookView[] | undefined;
        for (const row of changed) {
          const index = this.rowPositions.get(row.key);
          if (index === undefined || this.sameRow(this.snapshot.books[index], row)) continue;
          if (books === undefined) books = this.snapshot.books.slice();
          books[index] = row;
        }
        if (books !== undefined) this.update({ ...this.snapshot, books }, current);
      }).finally((): void => {
        this.progressInFlight = false;
        if (current()) this.scheduleProgress(current);
      });
    }, 100);
  }

  private replace(book: DownloadBookView, current: () => boolean): void {
    const index = this.rowPositions.get(book.key);
    if (index === undefined || this.sameRow(this.snapshot.books[index], book)) return;
    // Clone only the outer list and replace the changed row. Unchanged book
    // objects retain identity so ArkUI can skip their full projection.
    const books = this.snapshot.books.slice(); books[index] = book;
    this.update({ books, loading: this.snapshot.loading, error: this.snapshot.error,
      storageSummary: this.snapshot.storageSummary }, current);
  }

  private update(snapshot: SharedDownloadSnapshot, current: () => boolean): void {
    if (!current()) return;
    if (snapshot.books !== this.snapshot.books) {
      this.rowPositions.clear();
      snapshot.books.forEach((book: DownloadBookView, index: number): void => { this.rowPositions.set(book.key, index); });
    }
    this.snapshot = snapshot;
    this.publish(snapshot);
  }
}
