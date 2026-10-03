import type { BookmarkOperationIntentStore, ReadingOperationContext, ReadingOperationPendingError } from './ReadingOperationIntents';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import type { CommitReadbackPhase } from '../../app/ReaderOperationFacts';
import { LocalReadingFlowGateway, LOCAL_SOURCE_ID, type LocalReadingTocEntry,
  type LocalReadingPositionBookmarkInput } from './LocalReadingFlowGateway';
import type { ReadingBookDetail } from './ReadingBookDetail';
import { loadReaderControlBookmarkProjection } from './ReaderControlBookmarkLoad';

export interface ReaderDirectoryOperation {
  action: 'createChapterStart' | 'createPosition' | 'delete';
  book: ReadingBookDetail;
  generation: number;
  requestedCount: number;
  confirmedCount: number;
  completion: 'notDispatched' | 'partial' | 'complete' | 'unknown';
  canContinueOriginal?: boolean;
  projection: PersistedReceiptProjection<LocalReadingTocEntry[]>;
}

export interface ReaderDirectoryBinding {
  book: ReadingBookDetail;
  /** Captured navigation, entity and reading-session identity; never used as
   * cancellation of a write already accepted by the gateway. */
  current: () => boolean;
  currentEntries: () => LocalReadingTocEntry[];
  emitEntries: (entries: LocalReadingTocEntry[]) => void;
  emitOperation?: (operation: ReaderDirectoryOperation) => void;
  failed?: (error: Error) => void;
  onSettled?: (confirmed: boolean) => void;
}

export interface ReaderDirectoryDependencies {
  gateway: LocalReadingFlowGateway;
  ownsRuntime: () => boolean;
  deliveryFailed?: (error: Error) => void;
}

/** Bookmark mutations and canonical projection belong here. The page owns
 * navigation and its current TOC; this finite owner retains one receipt and
 * one mutex, never another bookmark database or generic task journal. */
export class ReaderDirectoryHost {
  private static retainedRuntime: ReadingGatewayRuntime | undefined;
  private static retainedHost: ReaderDirectoryHost | undefined;

  /** A recreated Index in the same Runtime shares accepted writes/mutex.
   * A lookup from an obsolete Runtime must not replace the current cache. */
  static forRuntime(runtime: ReadingGatewayRuntime, ownsRuntime: () => boolean,
    deliveryFailed?: (error: Error) => void, intents?: BookmarkOperationIntentStore): ReaderDirectoryHost | undefined {
    let current = false;
    try { current = ownsRuntime(); } catch (_error) { return undefined; }
    if (!current) return undefined;
    if (ReaderDirectoryHost.retainedRuntime === runtime && ReaderDirectoryHost.retainedHost !== undefined) {
      if (intents !== undefined) ReaderDirectoryHost.retainedHost.dependencies.gateway.installBookmarkAuthority(intents);
      return ReaderDirectoryHost.retainedHost;
    }
    const host = new ReaderDirectoryHost({ gateway: new LocalReadingFlowGateway(runtime, intents), ownsRuntime, deliveryFailed });
    ReaderDirectoryHost.retainedRuntime = runtime;
    ReaderDirectoryHost.retainedHost = host;
    return host;
  }

  private readonly dependencies: ReaderDirectoryDependencies;
  private generation: number = 0;
  private active: boolean = false;
  private readGeneration: number = 0;
  private operation: ReaderDirectoryOperation | undefined;
  private bookmarkProjectionStale: boolean = false;

  constructor(dependencies: ReaderDirectoryDependencies) { this.dependencies = dependencies; }

  busy(): boolean { return this.active; }
  snapshot(): ReaderDirectoryOperation | undefined { return this.operation; }

  async createChapterStart(chapterIndex: number, binding: ReaderDirectoryBinding): Promise<void> {
    const entry = this.knownChapter(chapterIndex, binding);
    if (entry === undefined) { this.settled(binding, false); return; }
    const book = { ...binding.book };
    await this.write('createChapterStart', 1, binding, async (evidence, current): Promise<void> => {
      await this.dependencies.gateway.createChapterStartBookmark({ bookName: book.title,
        bookAuthor: book.author, chapterIndex, chapterTitle: entry.title }, current,
        book.sourceId === LOCAL_SOURCE_ID ? undefined : { sourceId: book.sourceId, bookId: book.bookId }, evidence, this.context(binding, 'createChapterStart'));
    });
  }

  async createPosition(input: LocalReadingPositionBookmarkInput, binding: ReaderDirectoryBinding): Promise<void> {
    const entry = this.knownChapter(input.chapterIndex, binding);
    if (entry === undefined || entry.title !== input.chapterTitle || input.bookName !== binding.book.title ||
      input.bookAuthor !== binding.book.author || !Number.isSafeInteger(input.chapterOffset) || input.chapterOffset < 0 ||
      (input.positionScope !== undefined && (input.positionScope.sourceId !== binding.book.sourceId ||
        input.positionScope.bookId !== binding.book.bookId || input.positionScope.chapterIndex !== input.chapterIndex))) {
      this.settled(binding, false); return;
    }
    const captured: LocalReadingPositionBookmarkInput = { ...input,
      positionScope: input.positionScope === undefined ? undefined : { ...input.positionScope } };
    await this.write('createPosition', 1, binding, async (evidence, current): Promise<void> => {
      await this.dependencies.gateway.createPositionBookmark(captured, current, evidence, this.context(binding, 'createPosition'));
    });
  }

  async deleteBookmarks(times: number[], binding: ReaderDirectoryBinding): Promise<void> {
    const known = new Set<number>();
    for (const entry of binding.currentEntries()) for (const bookmark of entry.bookmarks ?? []) known.add(bookmark.time);
    const captured = Array.from(new Set(times));
    if (captured.length === 0 || captured.some(time => !Number.isSafeInteger(time) || !known.has(time))) {
      this.settled(binding, false); return;
    }
    await this.write('delete', captured.length, binding, async (evidence, current): Promise<void> => {
      for (const time of captured) {
        // Admission only controls the next dispatch. A prior ACK remains a
        // confirmed fact even when navigation retired during its await.
        if (!current()) return;
        const deleted = await this.dependencies.gateway.deleteBookmark(time, current, evidence, { ...this.context(binding, 'delete'), requestedCount: captured.length, confirmedBefore: evidence.confirmedCount });
        if (!deleted) throw new Error('bookmark.delete confirmed that the projected bookmark was already absent');
      }
    });
  }

  /** Pure canonical list read. A matching list is current data, never proof
   * that an old unknown bookmark.create/delete transaction was confirmed. */
  async load(binding: ReaderDirectoryBinding): Promise<void> {
    if (this.active || !this.admitted(binding)) return;
    await this.recoverPending(binding, false);
    if (this.active || !this.admitted(binding)) return;
    const readGeneration = ++this.readGeneration;
    const operationGeneration = this.generation;
    const current = (): boolean => this.admitted(binding) && !this.active &&
      readGeneration === this.readGeneration && operationGeneration === this.generation;
    await this.read(binding, current);
  }

  async reconcile(generation: number, binding: ReaderDirectoryBinding): Promise<void> {
    if (this.operation?.generation !== generation || !this.sameBook(this.operation.book, binding.book) ||
      !this.operation.projection.facts.canRetry) return;
    await this.load(binding);
  }

  async continueOriginal(generation: number, binding: ReaderDirectoryBinding): Promise<void> {
    if (this.operation?.generation !== generation || !this.sameBook(this.operation.book, binding.book) || !this.operation.canContinueOriginal) return;
    await this.recoverPending(binding, true); if (!this.active && this.admitted(binding)) await this.load(binding);
  }

  private context(binding: ReaderDirectoryBinding, ownerAction?: ReadingOperationContext['ownerAction']): ReadingOperationContext {
    return { sourceId: binding.book.sourceId, bookId: binding.book.bookId, title: binding.book.title, author: binding.book.author, ownerAction };
  }
  private async recoverPending(binding: ReaderDirectoryBinding, continueOriginal: boolean): Promise<void> {
    if (this.active || !this.admitted(binding)) return;
    this.active = true; const previous = this.operation !== undefined && this.sameBook(this.operation.book, binding.book) ? this.operation : undefined;
    const current = (): boolean => this.admitted(binding);
    try {
      const pending = await this.dependencies.gateway.pendingBookmarkOperation();
      if (pending === undefined) return;
      if (pending.context.sourceId !== binding.book.sourceId || pending.context.bookId !== binding.book.bookId ||
        pending.context.title !== binding.book.title || pending.context.author !== binding.book.author) {
        this.deliver(binding, (): void => binding.failed?.(new Error('另一书籍的原书签操作仍需核对，请返回原书籍'))); return;
      }
      const evidence = new ReaderWriteEvidence();
      try {
        const recovered = await this.dependencies.gateway.reconcileBookmarkOperation(this.context(binding), current, evidence, continueOriginal);
        if (recovered === undefined) return;
        const requestedCount = previous?.requestedCount ?? pending.context.requestedCount ?? 1;
        const confirmedCount = Math.min(requestedCount, (previous?.confirmedCount ?? pending.context.confirmedBefore ?? 0) +
          (previous?.projection.receipt.confirmation === 'confirmed' ? 0 : 1));
        const generation = previous?.generation ?? ++this.generation;
        const action = pending.context.ownerAction === 'createChapterStart' ? 'createChapterStart' : pending.method === 'bookmark.delete' ? 'delete' : 'createPosition';
        this.operation = { action, book: { ...binding.book }, generation, requestedCount, confirmedCount,
          completion: confirmedCount === requestedCount ? 'complete' : 'partial', canContinueOriginal: false,
          projection: projectPersistedReceipt({ confirmation: 'confirmed', readback: 'idle', generation, canRetry: true,
            message: confirmedCount === requestedCount ? '原书签操作已核实' : '原操作已核实，未派发后续书签操作' }) };
        this.deliver(binding, (): void => binding.emitOperation?.(this.operation!));
      } catch (error) {
        const issue = error as ReadingOperationPendingError;
        const generation = previous?.generation ?? ++this.generation;
        const confirmed = issue.confirmed === true || previous?.projection.receipt.confirmation === 'confirmed';
        const requestedCount = previous?.requestedCount ?? pending.context.requestedCount ?? 1;
        const confirmedCount = confirmed ? Math.min(requestedCount, (previous?.confirmedCount ?? pending.context.confirmedBefore ?? 0) + (previous?.projection.receipt.confirmation === 'confirmed' ? 0 : 1)) : previous?.confirmedCount ?? pending.context.confirmedBefore ?? 0;
        this.operation = { action: pending.context.ownerAction === 'createChapterStart' ? 'createChapterStart' : pending.method === 'bookmark.delete' ? 'delete' : 'createPosition',
          book: { ...binding.book }, generation, requestedCount, confirmedCount, completion: confirmed ? (confirmedCount === requestedCount ? 'complete' : 'partial') : 'unknown', canContinueOriginal: !confirmed && issue.blocked !== true,
          projection: projectPersistedReceipt({ confirmation: confirmed ? 'confirmed' : 'unknown', readback: 'failed', generation, canRetry: true,
            message: issue.message, blockedReason: issue.blocked ? issue.message : undefined, refreshError: issue.message, value: binding.currentEntries(), stale: true }) };
        this.deliver(binding, (): void => binding.emitOperation?.(this.operation!));
        this.deliver(binding, (): void => binding.failed?.(error as Error));
      }
    } catch (error) {
      this.bookmarkProjectionStale = true; const issue = error as ReadingOperationPendingError;
      const generation = previous?.generation ?? ++this.generation;
      this.operation = { action: previous?.action ?? 'createPosition', book: { ...binding.book }, generation,
        requestedCount: previous?.requestedCount ?? 1, confirmedCount: previous?.confirmedCount ?? 0,
        completion: previous?.completion ?? 'unknown', canContinueOriginal: false,
        projection: projectPersistedReceipt({ confirmation: previous?.projection.receipt.confirmation ?? 'unknown',
          readback: 'failed', generation, canRetry: true, value: binding.currentEntries(), stale: true,
          blockedReason: issue.message, message: issue.message, refreshError: issue.message }) };
      this.deliver(binding, (): void => binding.emitOperation?.(this.operation!));
      this.deliver(binding, (): void => binding.failed?.(error as Error));
    } finally { this.active = false; }
  }

  private async write(action: ReaderDirectoryOperation['action'], requestedCount: number,
    binding: ReaderDirectoryBinding, mutation: (evidence: ReaderWriteEvidence, current: () => boolean) => Promise<void>): Promise<void> {
    if (this.active || !this.admitted(binding)) { this.settled(binding, false); return; }
    // Exact receipts can recover the original operation. A new mutation can
    // neither replace unknown nor use an old/stale bookmark projection.
    if (this.bookmarkProjectionStale) {
      this.deliver(binding, (): void => binding.failed?.(new Error('书签视图尚未刷新，请先重新载入核对')));
      this.settled(binding, false); return;
    }
    if (this.operation?.projection.receipt.confirmation === 'unknown') {
      this.deliver(binding, (): void => binding.failed?.(new Error('书签操作结果未确认，请重新载入核对，不要重复操作')));
      this.settled(binding, false); return;
    }
    const generation = ++this.generation;
    ++this.readGeneration;
    const book = { ...binding.book };
    const evidence = new ReaderWriteEvidence();
    this.active = true;
    const current = (): boolean => generation === this.generation && this.active && this.admitted(binding);
    this.publish(action, book, generation, requestedCount, evidence, 'idle', binding);
    try {
      await mutation(evidence, current);
      this.publish(action, book, generation, requestedCount, evidence, 'idle', binding);
      if (current()) await this.read(binding, current, false);
    } catch (error) {
      this.publish(action, book, generation, requestedCount, evidence, 'failed', binding, (error as Error).message);
      if (current()) {
        this.bookmarkProjectionStale = true;
        this.deliver(binding, (): void => binding.failed?.(error as Error));
      }
    } finally {
      this.settled(binding, evidence.confirmation() === 'confirmed' && evidence.confirmedCount === requestedCount);
      if (generation === this.generation) this.active = false;
    }
  }

  private async read(binding: ReaderDirectoryBinding, current: () => boolean, reportFailure: boolean = true): Promise<void> {
    if (!current()) return;
    this.updateReadback(binding, 'reading');
    try {
      await loadReaderControlBookmarkProjection({ isCurrent: current, currentEntries: binding.currentEntries,
        read: (entries, guard): Promise<LocalReadingTocEntry[]> => this.dependencies.gateway.loadBookmarkProjection(
          binding.book.title, binding.book.author, entries, guard),
        commit: (entries): void => this.deliver(binding, (): void => binding.emitEntries(entries)) });
      if (current()) { this.bookmarkProjectionStale = false; this.updateReadback(binding, 'succeeded'); }
    } catch (error) {
      if (!current()) return;
      this.bookmarkProjectionStale = true; this.updateReadback(binding, 'failed', (error as Error).message);
      if (reportFailure) this.deliver(binding, (): void => binding.failed?.(error as Error));
      throw error;
    }
  }

  private updateReadback(binding: ReaderDirectoryBinding, readback: CommitReadbackPhase, message?: string): void {
    const operation = this.operation;
    if (operation === undefined || !this.sameBook(operation.book, binding.book)) return;
    operation.projection = projectPersistedReceipt({ confirmation: operation.projection.receipt.confirmation,
      readback, generation: operation.generation, value: binding.currentEntries(),
      refreshError: message, message: operation.completion === 'partial' ? '部分书签已更新，后续操作未派发，请重新载入核对' : message ??
        (operation.projection.receipt.confirmation === 'unknown' ? operation.projection.facts.message : undefined),
      blockedReason: operation.projection.facts.blockedReason,
      canRetry: readback === 'failed' || operation.projection.receipt.confirmation === 'unknown', stale: readback === 'failed' });
    this.deliver(binding, (): void => binding.emitOperation?.(operation));
  }

  private publish(action: ReaderDirectoryOperation['action'], book: ReadingBookDetail, generation: number,
    requestedCount: number, evidence: ReaderWriteEvidence, readback: CommitReadbackPhase,
    binding: ReaderDirectoryBinding, message?: string): void {
    const completion: ReaderDirectoryOperation['completion'] = evidence.confirmation() === 'unknown' ? 'unknown' :
      evidence.confirmation() === 'undispatched' ? 'notDispatched' : evidence.confirmedCount === requestedCount ? 'complete' : 'partial';
    this.operation = { action, book, generation, requestedCount, confirmedCount: evidence.confirmedCount, completion,
      projection: projectPersistedReceipt({ confirmation: evidence.confirmation(), readback, generation,
        refreshError: message, message: completion === 'partial' ? '部分书签已更新，后续操作未派发，请重新载入核对' : message,
        canRetry: evidence.confirmation() !== 'undispatched' && readback !== 'reading',
        stale: readback === 'failed' }) };
    const operation = this.operation;
    this.deliver(binding, (): void => binding.emitOperation?.(operation));
  }

  private knownChapter(index: number, binding: ReaderDirectoryBinding): LocalReadingTocEntry | undefined {
    if (!Number.isSafeInteger(index) || index < 0 || !this.admitted(binding)) return undefined;
    return binding.currentEntries().find(entry => entry.index === index && entry.navigable !== false && entry.title.trim().length > 0);
  }

  private sameBook(a: ReadingBookDetail, b: ReadingBookDetail): boolean {
    return a.sourceId === b.sourceId && a.bookId === b.bookId && a.title === b.title && a.author === b.author;
  }
  private admitted(binding: ReaderDirectoryBinding): boolean {
    try { return this.dependencies.ownsRuntime() && binding.current(); } catch (_error) { return false; }
  }
  private settled(binding: ReaderDirectoryBinding, confirmed: boolean): void {
    this.deliver(binding, (): void => binding.onSettled?.(confirmed));
  }
  private deliver(binding: ReaderDirectoryBinding, callback: () => void): void {
    if (!this.admitted(binding)) return;
    try { callback(); } catch (error) {
      try { this.dependencies.deliveryFailed?.(error as Error); } catch (_reportError) { /* UI-only reporting cannot change write facts. */ }
    }
  }
}
