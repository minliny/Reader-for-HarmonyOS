import type { RemoteReadingIdentity } from './RemoteReadingContract';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { ReadingOfflineGateway, type ReadingOfflineBookProgress } from './ReadingOfflineGateway';
import type { RemoteReadingSession } from './RemoteReadingFlowGateway';

export interface ReadingOfflineOperation {
  action: 'chapter' | 'book' | 'clear';
  sourceId: string;
  bookId: string;
  chapterIndex?: number;
  generation: number;
  /** Queue/cache ACK is distinct from Host image materialization/cleanup. */
  materialization: 'idle' | 'running' | 'succeeded' | 'failed' | 'retired';
  progress?: ReadingOfflineBookProgress;
  projection: PersistedReceiptProjection<LocalReadingTocEntry[]>;
}

export interface ReadingOfflineBinding {
  session: RemoteReadingSession;
  /** Exact session pointer/generation, navigation and entity admission. */
  current: () => boolean;
  currentEntries: () => LocalReadingTocEntry[];
  emitEntries: (entries: LocalReadingTocEntry[]) => void;
  emitOperation?: (operation: ReadingOfflineOperation) => void;
  onProgress?: (progress: ReadingOfflineBookProgress, finished: boolean) => void;
  failed?: (error: Error) => void;
}

export interface ReadingOfflineDependencies {
  gateway: ReadingOfflineGateway;
  ownsRuntime: () => boolean;
  deliveryFailed?: (error: Error) => void;
}

/** Finite manual-download/cache-clear coordination. Core retains its real
 * durable queue and lease algorithm; this owner has one mutex, one progress
 * snapshot and one receipt, with no body store or generic retry machinery. */
export class ReadingOfflineHost {
  private static retainedRuntime: ReadingGatewayRuntime | undefined;
  private static retainedHost: ReadingOfflineHost | undefined;

  /** A recreated Index in the same Runtime shares accepted writes/mutex.
   * A lookup from an obsolete Runtime must not replace the current cache. */
  static forRuntime(runtime: ReadingGatewayRuntime, ownsRuntime: () => boolean,
    deliveryFailed?: (error: Error) => void): ReadingOfflineHost | undefined {
    let current = false;
    try { current = ownsRuntime(); } catch (_error) { return undefined; }
    if (!current) return undefined;
    if (ReadingOfflineHost.retainedRuntime === runtime && ReadingOfflineHost.retainedHost !== undefined) return ReadingOfflineHost.retainedHost;
    const host = new ReadingOfflineHost({ gateway: new ReadingOfflineGateway(runtime), ownsRuntime, deliveryFailed });
    ReadingOfflineHost.retainedRuntime = runtime;
    ReadingOfflineHost.retainedHost = host;
    return host;
  }

  private readonly dependencies: ReadingOfflineDependencies;
  private active: boolean = false;
  private generation: number = 0;
  private readGeneration: number = 0;
  private operation: ReadingOfflineOperation | undefined;

  constructor(dependencies: ReadingOfflineDependencies) { this.dependencies = dependencies; }
  busy(): boolean { return this.active; }
  snapshot(): ReadingOfflineOperation | undefined { return this.operation; }

  /** SourceSwitch post-commit cleanup of one captured old identity. Its Core
   * and physical-image effects have independent facts. No current reader
   * session, source cookie or desired-book inference participates. */
  async cleanupRetiredSource(identity: RemoteReadingIdentity, isCurrent?: () => boolean): Promise<void> {
    const current = (): boolean => { try { return this.dependencies.ownsRuntime() && (isCurrent?.() ?? true); } catch (_) { return false; } };
    if (!current()) throw new Error('retired source cleanup Runtime is no longer current');
    if (identity.sourceId.trim() === '' || identity.bookId.trim() === '') throw new Error('retired source cleanup requires exact book identity');
    if (this.active || (this.operation?.action === 'clear' && this.operation.projection.receipt.confirmation === 'unknown'))
      throw new Error('an earlier offline operation still requires reconciliation');
    this.active = true; ++this.readGeneration; const generation = ++this.generation;
    const evidence = new ReaderWriteEvidence();
    this.operation = { action: 'clear', sourceId: identity.sourceId, bookId: identity.bookId, generation,
      materialization: 'running', projection: projectPersistedReceipt({ confirmation: 'undispatched', readback: 'idle', generation }) };
    try {
      await this.dependencies.gateway.clearBookIdentity(identity.sourceId, identity.bookId, current, evidence);
      this.operation.materialization = current() ? 'succeeded' : 'retired';
      this.updateReceipt(evidence, 'idle');
    } catch (error) {
      this.operation.materialization = current() ? 'failed' : 'retired';
      this.updateReceipt(evidence, 'failed', (error as Error).message);
      throw error as Error;
    } finally { if (this.generation === generation) this.active = false; }
  }

  async downloadChapter(chapterIndex: number, binding: ReadingOfflineBinding): Promise<void> {
    if (!Number.isSafeInteger(chapterIndex) || !binding.session.entries.some(entry => entry.index === chapterIndex &&
      entry.navigable !== false && entry.url.trim().length > 0)) return;
    await this.write('chapter', binding, chapterIndex);
  }

  async downloadBook(binding: ReadingOfflineBinding): Promise<void> {
    if (!binding.session.entries.some(entry => entry.navigable !== false && entry.url.trim().length > 0)) return;
    await this.write('book', binding);
  }

  async clearBook(binding: ReadingOfflineBinding): Promise<void> { await this.write('clear', binding); }

  /** Cache status only: no source HTTP, PUT-like prefetch, cache.clear or Host
   * image cleanup. New matching availability never confirms an old ACK. */
  async load(binding: ReadingOfflineBinding): Promise<void> {
    if (this.active || !this.admitted(binding)) return;
    const read = ++this.readGeneration;
    const generation = this.generation;
    const current = (): boolean => this.admitted(binding) && !this.active &&
      generation === this.generation && read === this.readGeneration;
    await this.read(binding, current);
  }

  async reconcile(generation: number, binding: ReadingOfflineBinding): Promise<void> {
    if (this.operation?.generation !== generation || !this.matches(this.operation, binding) ||
      !this.operation.projection.facts.canRetry) return;
    await this.load(binding);
  }

  private async write(action: ReadingOfflineOperation['action'], binding: ReadingOfflineBinding,
    chapterIndex?: number): Promise<void> {
    if (this.active || !this.admitted(binding)) return;
    // An unknown clear could still delete a later new download. A list/status
    // read is not a transaction receipt and cannot silently lift this barrier.
    if (this.operation?.action === 'clear' && this.operation.projection.receipt.confirmation === 'unknown') {
      this.deliver(binding, (): void => binding.failed?.(new Error('离线清除结果未确认，请重新载入核对，不要重复操作'))); return;
    }
    this.active = true;
    ++this.readGeneration;
    const generation = ++this.generation;
    const captured: RemoteReadingSession = { ...binding.session, identity: { ...binding.session.identity },
      book: { ...binding.session.book }, entries: binding.session.entries.map(entry => ({ ...entry })) };
    const evidence = new ReaderWriteEvidence();
    const current = (): boolean => generation === this.generation && this.active && this.admitted(binding);
    this.operation = { action, sourceId: captured.identity.sourceId, bookId: captured.identity.bookId,
      chapterIndex, generation, materialization: 'running', projection: projectPersistedReceipt({
        confirmation: 'undispatched', readback: 'idle', generation }) };
    this.publish(binding);
    if (action !== 'clear') this.deliver(binding, (): void => binding.emitEntries(binding.currentEntries().map(entry =>
      entry.navigable === false || entry.downloadState === 'completed' ||
        (action === 'chapter' && entry.index !== chapterIndex) ? entry : { ...entry, downloadState: 'queued' })));
    try {
      let entries: LocalReadingTocEntry[];
      if (action === 'clear') {
        await this.dependencies.gateway.clearBook(captured, current, evidence);
        entries = binding.currentEntries().map(entry => ({ ...entry, downloadState: 'missing' }));
      } else if (action === 'chapter') {
        entries = await this.dependencies.gateway.prefetchChapter(captured, chapterIndex!, current, evidence);
      } else {
        entries = await this.dependencies.gateway.prefetchBook(captured, current, (progress): void => {
          // Gateway progress has passed actual Core/Host qualification. Store
          // it before the UI guard so retirement cannot erase partial facts.
          if (this.operation?.generation !== generation) return;
          this.operation.progress = progress;
          this.updateReceipt(evidence, 'reading');
          this.publish(binding);
          this.deliver(binding, (): void => binding.emitEntries(this.merge(binding.currentEntries(), progress.entries)));
          this.deliver(binding, (): void => binding.onProgress?.(progress, false));
        }, evidence);
      }
      if (this.operation?.generation !== generation) return;
      this.operation.materialization = current() ? 'succeeded' : 'retired';
      this.updateReceipt(evidence, current() ? 'succeeded' : 'idle', undefined, current() ? entries : undefined);
      this.publish(binding);
      this.deliver(binding, (): void => binding.emitEntries(this.merge(binding.currentEntries(), entries)));
      if (action !== 'clear') {
        const progress = this.progress(captured, entries, this.operation.progress);
        this.operation.progress = progress;
        this.deliver(binding, (): void => binding.onProgress?.(progress, true));
      }
    } catch (error) {
      if (this.operation?.generation !== generation) return;
      this.operation.materialization = current() ? 'failed' : 'retired';
      this.updateReceipt(evidence, 'failed', (error as Error).message);
      this.publish(binding);
      this.deliver(binding, (): void => binding.failed?.(error as Error));
      // Fresh canonical availability preserves cached bodies and partial
      // results; never flatten the whole requested range to failed/missing.
      if (current()) await this.read(binding, current);
    } finally { if (generation === this.generation) this.active = false; }
  }

  private async read(binding: ReadingOfflineBinding, current: () => boolean): Promise<void> {
    if (!current()) return;
    const operation = this.operation;
    if (operation !== undefined && this.matches(operation, binding)) {
      operation.projection = projectPersistedReceipt({ confirmation: operation.projection.receipt.confirmation,
        readback: 'reading', generation: operation.generation });
      this.publish(binding);
    }
    try {
      const entries = await this.dependencies.gateway.loadDirectoryProjection(binding.session, current);
      if (!current()) return;
      this.deliver(binding, (): void => binding.emitEntries(this.merge(binding.currentEntries(), entries)));
      if (operation !== undefined && this.operation === operation && this.matches(operation, binding)) {
        operation.projection = projectPersistedReceipt({ confirmation: operation.projection.receipt.confirmation,
          readback: 'succeeded', generation: operation.generation, value: entries,
          canRetry: operation.projection.receipt.confirmation === 'unknown' || operation.materialization === 'failed' });
        operation.progress = this.progress(binding.session, entries, operation.progress);
        this.publish(binding);
      }
    } catch (error) {
      if (!current()) return;
      if (operation !== undefined && this.operation === operation && this.matches(operation, binding)) {
        operation.projection = projectPersistedReceipt({ confirmation: operation.projection.receipt.confirmation,
          readback: 'failed', generation: operation.generation, refreshError: (error as Error).message, canRetry: true });
        this.publish(binding);
      }
      this.deliver(binding, (): void => binding.failed?.(error as Error));
    }
  }

  private progress(session: RemoteReadingSession, entries: LocalReadingTocEntry[], previous?: ReadingOfflineBookProgress): ReadingOfflineBookProgress {
    return { processedChapters: previous?.processedChapters ?? 0,
      totalChapters: session.entries.filter(entry => entry.navigable !== false && entry.url.trim().length > 0).length,
      completedChapters: entries.filter(entry => entry.navigable !== false && entry.downloadState === 'completed').length,
      cachedChapters: entries.filter(entry => entry.navigable !== false && entry.downloadState === 'cached').length,
      failedChapters: entries.filter(entry => entry.navigable !== false && entry.downloadState === 'failed').length,
      firstFailure: previous?.firstFailure, entries };
  }

  private updateReceipt(evidence: ReaderWriteEvidence, readback: 'idle' | 'reading' | 'failed' | 'succeeded',
    message?: string, value?: LocalReadingTocEntry[]): void {
    if (this.operation === undefined) return;
    this.operation.projection = projectPersistedReceipt({ confirmation: evidence.confirmation(), readback,
      generation: this.operation.generation, value, refreshError: message,
      canRetry: readback !== 'reading' && (readback === 'failed' || evidence.confirmation() === 'unknown'), stale: readback === 'failed' });
  }
  private merge(current: LocalReadingTocEntry[], projected: LocalReadingTocEntry[]): LocalReadingTocEntry[] {
    const byIndex = new Map(projected.map(entry => [entry.index, entry]));
    return current.map(entry => {
      const source = byIndex.get(entry.index);
      return source === undefined ? entry : { ...entry, downloadState: source.downloadState };
    });
  }
  private matches(operation: ReadingOfflineOperation, binding: ReadingOfflineBinding): boolean {
    return operation.sourceId === binding.session.identity.sourceId && operation.bookId === binding.session.identity.bookId;
  }
  private admitted(binding: ReadingOfflineBinding): boolean {
    try { return this.dependencies.ownsRuntime() && binding.current(); } catch (_error) { return false; }
  }
  private publish(binding: ReadingOfflineBinding): void {
    const operation = this.operation;
    if (operation !== undefined) this.deliver(binding, (): void => binding.emitOperation?.(operation));
  }
  private deliver(binding: ReadingOfflineBinding, callback: () => void): void {
    if (!this.admitted(binding)) return;
    try { callback(); } catch (error) {
      try { this.dependencies.deliveryFailed?.(error as Error); } catch (_reportError) { /* UI-only reporting cannot change write facts. */ }
    }
  }
}
