import type { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import type { BookshelfState, ShelfBook } from '../../app/ReaderCoreGateway';
import { projectOperationFacts, type OperationFacts } from '../../app/ReaderOperationFacts';
import { BookshelfFlowGateway, type BookshelfDataState, type BookshelfFilter } from './BookshelfFlowGateway';
import { BookshelfCatalogUpdate, type BookshelfCatalogProgress } from './BookshelfCatalogUpdate';
import type { RemoteReadingSession } from '../reading/RemoteReadingFlowGateway';
import type { ReadingEntrySeed } from '../reading/ReadingEntryPreparation';

export interface BookshelfCatalogSeeds {
  owner: ReaderRuntimeOwner;
  revision: string;
  seeds: Promise<ReadingEntrySeed[] | undefined>;
}
export interface BookshelfCatalogSnapshot {
  generation: number;
  manualRunning: boolean;
  automaticRunning: boolean;
  done: number;
  total: number;
  readbackFailed: boolean;
  facts?: OperationFacts<BookshelfCatalogProgress>;
  seeds?: BookshelfCatalogSeeds;
}
export interface BookshelfCatalogBinding {
  identity: string;
  current: () => boolean;
  automaticAllowed: () => boolean;
  revision: () => string;
  filter: () => BookshelfFilter;
  emit: (snapshot: BookshelfCatalogSnapshot) => void;
  project: (state: BookshelfDataState) => void;
  prefetch: (session: RemoteReadingSession, current: () => boolean) => Promise<void>;
  diagnostic: (message: string) => void;
}
interface AutomaticIntent { books: ShelfBook[]; binding: BookshelfCatalogBinding; revisionRetry: boolean; }

/** Feature-local bounded sweep and recovery. Acquisition remains the existing
 * Coordinator; the page owns navigation/scroll, and never owns this mutex. */
export class BookshelfCatalogOwner {
  private binding: BookshelfCatalogBinding | undefined;
  private active: number | undefined;
  private automaticEpoch: number = 0;
  private pendingAutomatic: AutomaticIntent | undefined;
  private value: BookshelfCatalogSnapshot = { generation: 0, manualRunning: false,
    automaticRunning: false, done: 0, total: 0, readbackFailed: false };
  constructor(private readonly owner: ReaderRuntimeOwner, private readonly ownsRuntime: () => boolean,
    private readonly gateway: (filter: BookshelfFilter, background: boolean) => BookshelfFlowGateway) {}
  owns(owner: ReaderRuntimeOwner): boolean { return owner === this.owner; }
  snapshot(): BookshelfCatalogSnapshot { return this.value; }
  attach(binding: BookshelfCatalogBinding): boolean {
    if (!this.admitted(binding)) return false;
    this.binding = binding; this.publish(); return true;
  }
  detach(identity: string): void { if (this.binding?.identity === identity) this.binding = undefined; }
  private current(binding: BookshelfCatalogBinding): boolean { return this.binding === binding && this.admitted(binding); }
  private admitted(binding: BookshelfCatalogBinding): boolean { try { return this.ownsRuntime() && binding.current(); } catch (_) { return false; } }
  private publish(): void { const binding = this.binding; if (binding !== undefined && this.current(binding))
    try { binding.emit(this.value); } catch (_) { /* Presentation cannot replace the accepted catalog facts. */ } }
  private diagnose(binding: BookshelfCatalogBinding, message: string): void { if (this.current(binding)) try { binding.diagnostic(message); } catch (_) {} }
  private targets(books: ShelfBook[], revision: string, automatic: boolean, current: () => boolean): Promise<BookshelfState | undefined> {
    return revision.length > 0 ? this.gateway({ readingState: 'all', sourceKind: 'all' }, automatic).loadAll(current) :
      Promise.resolve(current() ? { books, total: books.length } : undefined);
  }
  automatic(books: ShelfBook[], binding: BookshelfCatalogBinding, intervalMs: number, revisionRetry: boolean = false): void {
    if (!this.current(binding) || !binding.automaticAllowed() || this.value.manualRunning) return;
    if (this.active !== undefined) {
      if (this.value.automaticRunning) this.pendingAutomatic = { books, binding, revisionRetry };
      return;
    }
    const epoch = ++this.automaticEpoch, revision = binding.revision();
    let ownPublishedRevision: string | undefined;
    const current = (): boolean => epoch === this.automaticEpoch && this.current(binding) && revision === binding.revision() && binding.automaticAllowed();
    this.active = epoch; this.value = { ...this.value, automaticRunning: true }; this.publish();
    const targets = this.targets(books, revision, true, current);
    if (revision.length > 0) this.value = { ...this.value, seeds: { owner: this.owner, revision,
      seeds: targets.then(shelf => shelf !== undefined && shelf.projectionRevision === revision ?
        shelf.books.filter(book => book.contentKind === undefined || book.contentKind === 'text')
          .map(book => ({ sourceId: book.sourceId, bookId: book.bookId })) : undefined).catch(() => undefined) } };
    this.publish();
    void targets.then(async shelf => {
      if (!current() || shelf === undefined || (revision.length > 0 && shelf.projectionRevision !== revision)) return;
      await this.runBatch(shelf.books, binding, true, intervalMs, current,
        published => { ownPublishedRevision = published; });
    }).catch(error => { if (current()) this.diagnose(binding, `Background bookshelf targets: ${(error as Error).message}`); })
      .finally(() => {
        if (this.active !== epoch) return;
        this.active = undefined; this.value = { ...this.value, automaticRunning: false }; this.publish();
        const pending = this.pendingAutomatic; this.pendingAutomatic = undefined;
        if (pending !== undefined && this.current(pending.binding) && pending.binding.automaticAllowed()) {
          // Preserve the single bounded retry; never drain an old presentation.
          if (pending.binding !== binding) this.automatic(pending.books, pending.binding, intervalMs, pending.revisionRetry);
          else if (!revisionRetry && pending.binding.revision() !== revision && pending.binding.revision() !== ownPublishedRevision)
            this.automatic(pending.books, pending.binding, intervalMs, true);
        } else if (!revisionRetry && this.current(binding) && revision !== binding.revision() &&
          ownPublishedRevision !== binding.revision() && binding.automaticAllowed()) {
          this.automatic(books, binding, intervalMs, true);
        }
      });
  }
  manual(books: ShelfBook[], binding: BookshelfCatalogBinding, intervalMs: number): void {
    if (this.active !== undefined || !this.current(binding)) return;
    const generation = this.value.generation + 1;
    this.active = generation; this.value = { ...this.value, generation, manualRunning: true,
      done: 0, total: 0, readbackFailed: false, facts: undefined }; this.publish();
    const current = (): boolean => this.active === generation && this.current(binding);
    let executionStarted = false, lastProgress: BookshelfCatalogProgress | undefined;
    void this.targets(books, binding.revision(), false, current).then(async shelf => {
      if (shelf === undefined || !current()) return;
      executionStarted = true;
      const progress = await this.runBatch(shelf.books, binding, false, intervalMs, current, undefined,
        value => { lastProgress = value; this.value = { ...this.value, done: value.attempted, total: value.total }; this.publish(); });
      lastProgress = progress;
      // Accepted work settles in its original owner even if its UI retired.
      this.value = { ...this.value, done: progress.attempted, total: progress.total };
      const message = `${progress.cancelled ? '检查中断' : '检查完成'}：成功 ${progress.succeeded}/${progress.total}，失败 ${progress.failed}` +
        (progress.preparationFailed > 0 ? `；${progress.preparationFailed} 本章节预加载未完成` : '') +
        (this.value.readbackFailed ? '；刷新失败，保留原书架，可只读刷新' : progress.failed > 0 ? '；保留已有目录和阅读进度' : '');
      this.value = { ...this.value, facts: projectOperationFacts({ phase: this.value.readbackFailed ? 'refreshFailed' :
        progress.cancelled || progress.failed > 0 || progress.preparationFailed > 0 ? 'partial' : 'succeeded', value: progress,
        canRetry: this.value.readbackFailed, generation: -generation, message }) }; this.publish();
    }).catch(error => {
      this.value = { ...this.value, facts: projectOperationFacts({ phase: executionStarted ? 'partial' : 'failed',
        generation: -generation, value: lastProgress, canRetry: executionStarted && this.value.readbackFailed,
        message: executionStarted ? `检查反馈未完成；已确认成功 ${lastProgress?.succeeded ?? 0} 本，已知失败 ${lastProgress?.failed ?? 0} 本：${(error as Error).message}` :
          `检查目标读取失败，未启动检查：${(error as Error).message}` }) }; this.publish();
    }).finally(() => { if (this.active === generation) {
      this.active = undefined; this.value = { ...this.value, manualRunning: false }; this.publish(); } });
  }
  private async runBatch(books: ShelfBook[], binding: BookshelfCatalogBinding, automatic: boolean, intervalMs: number,
    current: () => boolean, published?: (revision: string) => void,
    progress?: (value: BookshelfCatalogProgress) => void): Promise<BookshelfCatalogProgress> {
    const result = await new BookshelfCatalogUpdate(this.owner).run(books, automatic, intervalMs, current,
      (session, live) => binding.prefetch(session, live), value => progress?.(value));
    if (!current() || result.cancelled || result.total === 0) return result;
    try {
      const state = await this.gateway(binding.filter(), false).load(current);
      if (!current()) return result;
      binding.project(state);
      if (automatic) published?.(binding.revision());
      else this.value = { ...this.value, readbackFailed: false };
    } catch (error) {
      if (current()) { if (!automatic) this.value = { ...this.value, readbackFailed: true };
        this.diagnose(binding, `Bookshelf update projection failed: ${(error as Error).message}`); }
    }
    return result;
  }
  async reconcile(generation: number, binding: BookshelfCatalogBinding): Promise<void> {
    const facts = this.value.facts;
    if (this.active !== undefined || !this.current(binding) || generation !== -this.value.generation ||
      facts?.generation !== generation || !facts.canRetry || !this.value.readbackFailed) return;
    const sequence = this.value.generation;
    this.active = sequence;
    const current = (): boolean => this.active === sequence && this.value.generation === sequence && this.current(binding);
    this.value = { ...this.value, facts: projectOperationFacts({ phase: 'refreshing', value: facts.value,
      generation, canRetry: false, message: '正在刷新书架…' }) }; this.publish();
    try {
      const state = await this.gateway(binding.filter(), false).load(current);
      if (!current()) return;
      binding.project(state); this.value = { ...this.value, readbackFailed: false,
        facts: projectOperationFacts({ phase: facts.value?.cancelled || (facts.value?.failed ?? 0) > 0 ||
          (facts.value?.preparationFailed ?? 0) > 0 ? 'partial' : 'succeeded', value: facts.value, generation,
          canRetry: false, message: facts.message?.replace('；刷新失败，保留原书架，可只读刷新', '') }) }; this.publish();
    } catch (_) { if (current()) { this.value = { ...this.value, facts: { ...facts, canRetry: true } }; this.publish(); } }
    finally { if (this.active === sequence) this.active = undefined; }
  }
}
