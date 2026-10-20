import type { BookAcquisitionChange } from '../../app/BookAcquisitionCoordinator';
import { BookshelfFlowGateway } from '../bookshelf/BookshelfFlowGateway';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { ReaderCoreGateway } from '../../app/ReaderCoreGateway';
import type { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { SharedDownloadGateway } from './SharedDownloadGateway';
import { createDownloadBookView, projectDownloadBookAvailability, type DownloadBookView, type DownloadStorageSummary, type DownloadStoragePolicyView, type SharedDownloadActionTarget } from './SharedDownloadProjection';
import type { SharedDownloadCoordinatorSnapshot } from './SharedDownloadCoordinator';

export interface SharedDownloadSnapshot {
  books: DownloadBookView[];
  loading: boolean;
  error: string;
  storageSummary: DownloadStorageSummary;
  storagePolicy?: DownloadStoragePolicyView;
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

/** Incremental page projection over bookshelf/cache authorities. Mutations
 * delegate to the durable Runtime coordinator and storage owner. */
export class SharedDownloadHost {
  private generation: number = 0;
  private snapshot: SharedDownloadSnapshot = { books: [], loading: false, error: '', storageSummary: {} };
  private readonly gateway: SharedDownloadGateway;
  private readonly shelfGateway: ReaderCoreGateway;
  private readonly refreshes: Map<string, Promise<void>> = new Map();
  private readonly owner: ReaderRuntimeOwner;
  private readonly publish: (snapshot: SharedDownloadSnapshot) => void;
  private unsubscribeDownloadStatus: (() => void) | undefined;
  private unsubscribeDownloadIntents: (() => void) | undefined;
  private progressTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingBookKeys: Set<string> = new Set();
  private progressInFlight: boolean = false;
  private readonly rowPositions: Map<string, number> = new Map();
  private readonly intentSignatures: Map<string, string> = new Map();
  private readonly statusIndex: Map<string, IndexedDownloadBook> | undefined;

  constructor(owner: ReaderRuntimeOwner, publish: (snapshot: SharedDownloadSnapshot) => void) {
    this.owner = owner;
    this.publish = publish;
    this.gateway = new SharedDownloadGateway(owner);
    this.shelfGateway = new ReaderCoreGateway(owner);
    this.statusIndex = DOWNLOAD_STATUS_INDEX.get(owner) ?? new Map<string, IndexedDownloadBook>();
    DOWNLOAD_STATUS_INDEX.set(owner, this.statusIndex);
  }

  retire(): void {
    this.generation += 1; this.refreshes.clear(); this.stopProgress();
  }

  private stopProgress(): void {
    this.unsubscribeDownloadStatus?.(); this.unsubscribeDownloadStatus = undefined;
    this.unsubscribeDownloadIntents?.(); this.unsubscribeDownloadIntents = undefined;
    this.intentSignatures.clear();
    if (this.progressTimer !== undefined) clearTimeout(this.progressTimer);
    this.progressTimer = undefined; this.pendingBookKeys.clear();
  }

  /** Return from the reader to the same runtime's loaded page. Rebind the
   * presentation and reconcile changed download clocks without a shelf walk. */
  resume(snapshot: SharedDownloadSnapshot, current: () => boolean): void {
    const generation = ++this.generation;
    this.refreshes.clear(); this.stopProgress();
    const active = (): boolean => generation === this.generation && current();
    if (!active()) return;
    this.rowPositions.clear();
    snapshot.books.forEach((book: DownloadBookView, index: number): void => { this.rowPositions.set(book.key, index); });
    this.snapshot = { ...snapshot, loading: false };
    this.publish(this.snapshot);
    this.bindProgress(active);
    this.bindAcceptedIntents(active);
    for (const book of this.snapshot.books) {
      if (this.reuseIndexedRow(book, this.currentStatusRevision(book)) === undefined)
        this.pendingBookKeys.add(book.key);
    }
    this.scheduleProgress(active);
  }

  updateShelfBook(book: ShelfBook, current: () => boolean): void {
    if (!current()) return;
    const index = this.rowPositions.get(JSON.stringify([book.sourceId, book.bookId]));
    if (index === undefined) return;
    const books = this.snapshot.books.slice();
    books[index] = this.withShelfMetadata(books[index], book);
    this.update({ ...this.snapshot, books }, current);
  }

  async refreshReadingMetadata(sourceId: string, bookId: string, current: () => boolean): Promise<void> {
    const generation = this.generation;
    const active = (): boolean => generation === this.generation && current();
    if (!active()) return;
    const book = await this.shelfGateway.loadShelfBook(sourceId, bookId, active);
    if (active() && book !== undefined) this.updateShelfBook(book, active);
  }

  private withShelfMetadata(view: DownloadBookView, book: ShelfBook): DownloadBookView {
    const fresh = createDownloadBookView(book);
    return { ...view, key: fresh.key, shelfBook: book, sourceId: fresh.sourceId,
      bookId: fresh.bookId, coverUrl: fresh.coverUrl, title: fresh.title, author: fresh.author,
      sourceLabel: fresh.sourceLabel, contentKind: fresh.contentKind, recentRead: fresh.recentRead };
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
      const allBooks = new Map(shelf.books.map((book: ShelfBook) => [JSON.stringify([book.sourceId, book.bookId]), book]));
      for (const book of this.owner.getDownloadCoordinator?.().books() ?? [])
        if (!allBooks.has(JSON.stringify([book.sourceId, book.bookId]))) allBooks.set(JSON.stringify([book.sourceId, book.bookId]), book);
      const rows = Array.from(allBooks.values()).map((book: ShelfBook): DownloadBookView => {
        const fresh = createDownloadBookView(book);
        return this.reuseIndexedRow(fresh, this.currentStatusRevision(fresh)) ?? fresh;
      });
      // Publish the real shelf rows before the advisory storage walk. On a
      // large library the summary may require bounded classification batches;
      // it must never delay the first usable frame or make a failed summary
      // look like a failed download projection.
      this.update({ books: rows, loading: rows.length > 0, error: '', storageSummary: this.snapshot.storageSummary }, active);
      this.bindProgress(active);
      this.bindAcceptedIntents(active);
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
      const measuredPolicy = await this.owner.getDownloadStorageGateway?.().readPolicy();
      if (current()) {
        const storage = this.owner.getDownloadStorageGateway?.();
        const books = this.snapshot.books.map(book => {
          if (storage === undefined || book.projectionStatus !== 'ready') return book;
          const images = storage.bookImageBytes(book.sourceId, book.bookId);
          const bytes = images === undefined ? undefined : book.contentKind === 'manga' ? images :
            book.bytes === undefined ? undefined : book.bytes + images;
          return bytes === book.bytes ? book : { ...book, bytes };
        });
        const oldPolicy = this.snapshot.storagePolicy;
        const storagePolicy = measuredPolicy !== undefined && oldPolicy?.capacityBytes === measuredPolicy.capacityBytes &&
          oldPolicy.expiryDays === measuredPolicy.expiryDays ? oldPolicy : measuredPolicy;
        this.update({ ...this.snapshot, books, storageSummary: measured, storagePolicy }, current);
      }
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
    current: () => boolean, cacheLimitMb?: number, cleanupAfterDays?: number): Promise<string | undefined> {
    if (!current()) return;
    if (action === 'configureStorage') {
      const saved = await this.owner.configureDownloadStorage(cacheLimitMb ?? 2048, cleanupAfterDays ?? 7);
      return saved.maintenanceMessage;
    }
    if (action === 'cleanup') {
      await this.owner.clearDownloadRebuildableCache();
      return;
    }
    const coordinator = this.owner.getDownloadCoordinator();
    for (const target of targets) {
      if (!current()) return;
      const book = this.snapshot.books.find(row => row.sourceId === target.sourceId && row.bookId === target.bookId);
      if (book === undefined || book.projectionStatus !== 'ready') continue;
      const selected = target.chapterIndices === undefined ? undefined : book.chapters.filter(chapter => chapter.navigable &&
        target.chapterIndices!.includes(chapter.index));
      if (selected !== undefined && selected.length !== new Set(target.chapterIndices).size)
        throw new Error('目录已变化，目标章节操作已停止，请重新读取目录');
      // Flushed Runtime intent ACK is the end of this UI operation. The page
      // generation never owns the accepted Core/Host materialization loop.
      await coordinator.operate(action === 'deleteLocal' ? 'delete' : action, { book: book.shelfBook,
        chapterIndexes: selected?.map(chapter => chapter.index),
        expectedChapters: selected?.map(chapter => ({ chapterIndex: chapter.index, chapterId: chapter.chapterId })) });
    }
  }

  private bindAcceptedIntents(current: () => boolean): void {
    const coordinator = this.owner.getDownloadCoordinator?.();
    if (coordinator === undefined) return;
    void coordinator.restore().catch((): void => {});
    let initialized = false;
    this.unsubscribeDownloadIntents = coordinator.subscribe((state: SharedDownloadCoordinatorSnapshot): void => {
      if (!current()) return;
      const missing = state.books.filter(book => !this.rowPositions.has(JSON.stringify([book.sourceId, book.bookId])));
      if (missing.length > 0) this.update({ ...this.snapshot,
        books: [...this.snapshot.books, ...missing.map(book => createDownloadBookView(book))] }, current);
      const missingKeys = new Set(missing.map(book => JSON.stringify([book.sourceId, book.bookId])));
      const present = new Set<string>();
      for (const job of state.jobs) {
        present.add(job.key);
        const signature = JSON.stringify([job.revision, job.status, job.updatedAt,
          job.requestedIndexes.length, job.pausedIndexes.length, job.retainedIndexes.length]);
        if ((initialized && this.intentSignatures.get(job.key) !== signature) || missingKeys.has(job.key))
          this.pendingBookKeys.add(job.key);
        this.intentSignatures.set(job.key, signature);
      }
      for (const key of this.intentSignatures.keys()) if (!present.has(key)) this.intentSignatures.delete(key);
      initialized = true;
      this.scheduleProgress(current);
    });
  }

  private async loadRow(book: DownloadBookView, current: () => boolean, force: boolean,
    statusRevision: string | undefined): Promise<DownloadBookView> {
    if (!force) {
      const indexed = this.reuseIndexedRow(book, statusRevision);
      if (indexed !== undefined) return this.withAcceptedIntent(indexed);
    }
    try {
      const loaded = await this.gateway.load(book, current);
      this.indexLoadedRow(loaded, statusRevision);
      return this.withAcceptedIntent(loaded);
    }
    catch (_) {
      const unavailable = createDownloadBookView(book.shelfBook);
      unavailable.projectionStatus = 'unavailable';
      unavailable.projectionError = '下载信息暂时无法读取，请重试';
      return unavailable;
    }
  }

  private withAcceptedIntent(view: DownloadBookView): DownloadBookView {
    const job = this.owner.getDownloadCoordinator?.().job(view.sourceId, view.bookId);
    if (job === undefined || view.projectionStatus !== 'ready') return view;
    const requested = new Set(job.requestedIndexes), paused = new Set(job.pausedIndexes);
    const running = job.status === 'queued' || job.status === 'downloading';
    const chapters = view.chapters.map(chapter => chapter.localComplete || !requested.has(chapter.index) ? chapter :
      paused.has(chapter.index) ? { ...chapter, queueState: 'paused' as const, stateLabel: '已暂停' } :
        running && chapter.queueState === 'missing' ? { ...chapter, queueState: 'queued' as const, stateLabel: '等待下载' } : chapter);
    const projected = projectDownloadBookAvailability(view, chapters, view.totalChapters, view.bytes);
    // A failed accepted range can later be completed through the reader's
    // existing download path. Preserve that historical Runtime failure, but
    // do not let it mask newly proven local completeness in this read model.
    const complete = new Set(chapters.filter(chapter => chapter.navigable && chapter.localComplete)
      .map(chapter => chapter.index));
    const requestedComplete = requested.size > 0 && Array.from(requested).every(index => complete.has(index));
    const failed = job.status === 'failed' && !requestedComplete;
    return { ...projected, state: running || failed ? 'downloading' : projected.state,
      stateLabel: running ? '下载中' : failed ? '下载失败' : projected.stateLabel,
      downloadError: failed ? (job.error || '下载任务已停止，请重试') : undefined };
  }

  private currentStatusRevision(book: DownloadBookView): string | undefined {
    try {
      const coordinator = this.owner.bookAcquisitions?.();
      const downloadRevision = coordinator?.downloadStatusRevision?.(book.sourceId, book.bookId);
      return typeof downloadRevision === 'number' && Number.isSafeInteger(downloadRevision) && downloadRevision >= 0 ?
        `${downloadRevision}:${this.owner.getDownloadCoordinator?.().projectionRevision(book.sourceId, book.bookId) ?? ''}` : undefined;
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
    return this.withShelfMetadata(cached, fresh.shelfBook);
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
          if (index === undefined) continue;
          const nextRow = this.withShelfMetadata(row, this.snapshot.books[index].shelfBook);
          if (this.sameRow(this.snapshot.books[index], nextRow)) continue;
          if (books === undefined) books = this.snapshot.books.slice();
          books[index] = nextRow;
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
    if (index === undefined) return;
    const next = this.withShelfMetadata(book, this.snapshot.books[index].shelfBook);
    if (this.sameRow(this.snapshot.books[index], next)) return;
    // Clone only the outer list and replace the changed row. Unchanged book
    // objects retain identity so ArkUI can skip their full projection.
    const books = this.snapshot.books.slice(); books[index] = next;
    this.update({ ...this.snapshot, books }, current);
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
