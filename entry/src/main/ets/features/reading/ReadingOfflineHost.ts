import type { CacheClearOperationIntentStore, ReadingOperationPendingError } from './ReadingOperationIntents';
import type { RemoteReadingIdentity } from './RemoteReadingContract';
import type { ReadingGatewayRuntime } from './ReadingGatewayRuntime';
import { ReaderWriteEvidence } from '../../app/ReaderWriteEvidence';
import { projectPersistedReceipt, type PersistedReceiptProjection } from '../../app/ReaderPersistedReceiptProjection';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { ReadingOfflineGateway, type ReadingOfflineBookProgress } from './ReadingOfflineGateway';
import type { RemoteReadingSession } from './RemoteReadingFlowGateway';
import { MangaDownloadActionsGateway, type MangaDownloadAction, type MangaDownloadActionId,
  type MangaDownloadChapterStatus, type MangaDownloadSnapshot, type MangaDownloadDeleteOutcome } from '../manga/MangaDownloadActionsGateway';

interface MangaDownloadIntent {
  session: RemoteReadingSession;
  generation: number;
  valid: boolean;
  excludedChapters: Set<number>;
  continuations: Set<Promise<void>>;
  evidence: ReaderWriteEvidence;
  failure?: Error;
  settled: Promise<void>;
  finish: () => void;
}

export interface ReadingOfflineOperation {
  action: 'chapter' | 'book' | 'clear';
  sourceId: string;
  bookId: string;
  chapterIndex?: number;
  generation: number;
  /** Queue/cache ACK is distinct from Host image materialization/cleanup. */
  materialization: 'idle' | 'running' | 'succeeded' | 'failed' | 'retired';
  materializationFailure?: string;
  operationFailure?: string;
  canContinueOriginal?: boolean;
  /** A foreign fixed intent is a capacity fact, not this book's write ACK. */
  blockingClear?: { scope: 'cache' | 'book'; active: boolean };
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
  mangaActions?: MangaDownloadActionsGateway;
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
    deliveryFailed?: (error: Error) => void, intents?: CacheClearOperationIntentStore): ReadingOfflineHost | undefined {
    let current = false;
    try { current = ownsRuntime(); } catch (_error) { return undefined; }
    if (!current) return undefined;
    if (ReadingOfflineHost.retainedRuntime === runtime && ReadingOfflineHost.retainedHost !== undefined) {
      if (intents !== undefined) ReadingOfflineHost.retainedHost.dependencies.gateway.installClearAuthority(intents);
      return ReadingOfflineHost.retainedHost;
    }
    const host = new ReadingOfflineHost({ gateway: new ReadingOfflineGateway(runtime, intents),
      mangaActions: new MangaDownloadActionsGateway(runtime), ownsRuntime, deliveryFailed });
    ReadingOfflineHost.retainedRuntime = runtime;
    ReadingOfflineHost.retainedHost = host;
    return host;
  }

  private readonly dependencies: ReadingOfflineDependencies;
  private active: boolean = false;
  /** One latest captured read intent may join accepted work after UI recreation.
   * It never becomes a mutation or obtains a fresh operation identity. */
  private pendingRead: { binding: ReadingOfflineBinding; resolve: () => void; reject: (error: Error) => void } | undefined;
  private generation: number = 0;
  private readGeneration: number = 0;
  private operation: ReadingOfflineOperation | undefined;
  private mangaIntent: MangaDownloadIntent | undefined;
  private mangaActionActive: boolean = false;

  constructor(dependencies: ReadingOfflineDependencies) { this.dependencies = dependencies; }
  busy(): boolean { return this.active || this.mangaActionActive; }
  snapshot(): ReadingOfflineOperation | undefined { return this.operation; }

  /** The queue and exact physical projection jointly admit download actions.
   * A remembered Completed receipt alone cannot certify retained bytes. */
  async loadMangaActions(chapterIndex: number | undefined, binding: ReadingOfflineBinding): Promise<MangaDownloadAction[]> {
    if (binding.session.contentKind !== 'manga' || !this.admitted(binding)) return [];
    const gateway = this.dependencies.mangaActions;
    if (gateway === undefined) throw new Error('MANGA_DOWNLOAD_ACTIONS_HOST_REQUIRED');
    const current = (): boolean => this.admitted(binding);
    const snapshot = await gateway.snapshot(binding.session, current);
    const projection = await this.dependencies.gateway.loadProjection(binding.session, current);
    if (!current()) return [];
    this.deliver(binding, (): void => binding.emitEntries(this.merge(binding.currentEntries(), projection)));
    const byIndex: Map<number, LocalReadingTocEntry> = new Map();
    for (const entry of projection) byIndex.set(entry.index, entry);
    const presentation: MangaDownloadSnapshot = {
      chapters: snapshot.chapters.map((chapter): MangaDownloadChapterStatus => {
        const state = byIndex.get(chapter.chapterIndex)?.downloadState;
        if (chapter.state === 'completed' && (state === undefined || state === 'unknown')) {
          throw new Error('漫画下载状态需要重新读取，请重试');
        }
        return { chapterIndex: chapter.chapterIndex, chapter: chapter.chapter,
          state: state === undefined || state === 'unknown' ? chapter.state : state,
          attempts: chapter.attempts, maxAttempts: chapter.maxAttempts };
      }), retentions: snapshot.retentions, downloadChapters: snapshot.downloadChapters,
    };
    return gateway.actions(presentation, chapterIndex, this.busy());
  }

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
      this.operation.operationFailure = (error as Error).message;
      if (evidence.confirmation() === 'confirmed' && (error as ReadingOperationPendingError).intent === undefined)
        this.operation.materializationFailure = (error as Error).message;
      this.updateReceipt(evidence, 'failed', (error as Error).message);
      throw error as Error;
    } finally { if (this.generation === generation) this.active = false; this.drainPendingRead(); }
  }

  async downloadChapter(chapterIndex: number, binding: ReadingOfflineBinding, update: boolean = false): Promise<void> {
    if (!Number.isSafeInteger(chapterIndex) || !binding.session.entries.some(entry => entry.index === chapterIndex &&
      entry.navigable !== false && entry.url.trim().length > 0)) return;
    await this.write('chapter', binding, chapterIndex, undefined, update);
  }

  async downloadBook(binding: ReadingOfflineBinding, onlyIndexes?: number[]): Promise<void> {
    if (!binding.session.entries.some(entry => entry.navigable !== false && entry.url.trim().length > 0)) return;
    await this.write('book', binding, undefined, onlyIndexes);
  }

  async clearBook(binding: ReadingOfflineBinding): Promise<void> {
    if (binding.session.contentKind === 'manga') await this.prepareMangaMutation(binding);
    await this.write('clear', binding);
  }

  /** Stop only this explicit download consumer. Shared reading/cache work and
   * retained bytes remain with their existing coordinator/platform owners. */
  async prepareMangaMutation(binding: ReadingOfflineBinding, chapterIndex?: number): Promise<void> {
    const intent = this.mangaIntent;
    if (intent === undefined || !this.sameMangaBook(intent, binding.session)) return;
    if (chapterIndex !== undefined) {
      intent.excludedChapters.add(chapterIndex);
      await this.dependencies.gateway.waitForMangaChapter(chapterIndex);
    } else {
      intent.valid = false;
      await intent.settled;
    }
  }

  /** Finite chapter/book commands over the existing durable queue adapter.
   * Resume supplements only the chapters continued by the user, including a
   * chapter already passed by the original bounded whole-book loop. */
  async operateManga(action: MangaDownloadActionId, chapterIndex: number | undefined,
    binding: ReadingOfflineBinding): Promise<MangaDownloadDeleteOutcome | undefined> {
    if (binding.session.contentKind !== 'manga' || !this.admitted(binding)) return undefined;
    if (action === 'downloadChapter') { if (chapterIndex !== undefined) await this.downloadChapter(chapterIndex, binding); return undefined; }
    if (action === 'downloadBook') { await this.downloadBook(binding); return undefined; }
    if (action === 'clearCache') { await this.clearBook(binding); return undefined; }
    if (this.mangaActionActive) return undefined;
    const gateway = this.dependencies.mangaActions;
    if (gateway === undefined) throw new Error('MANGA_DOWNLOAD_ACTIONS_HOST_REQUIRED');
    this.mangaActionActive = true;
    const session = binding.session, intent = this.mangaIntent;
    const current = (): boolean => this.admitted(binding);
    let resumeIndexes: number[] = [], resume = false, update = false;
    let deletion: MangaDownloadDeleteOutcome | undefined;
    try {
      if (action === 'pause' || action === 'cancel' || action === 'deleteDownloads') {
        const operation = action === 'pause' ? 'pause' : 'cancel';
        await gateway.operate(session, operation, chapterIndex, current);
        await this.prepareMangaMutation(binding, chapterIndex);
        if (!current()) return undefined;
        // Cover a final native claim accepted while the first RPC was pending.
        await gateway.operate(session, operation, chapterIndex, current);
      }
      if (action === 'updateChapter') {
        if (chapterIndex === undefined || !session.entries.some(entry => entry.index === chapterIndex &&
          entry.navigable !== false && entry.url.trim().length > 0)) return undefined;
        await this.prepareMangaMutation(binding, chapterIndex);
        if (!current()) return undefined;
        update = true;
      } else if (action === 'resume') {
        const before = await gateway.snapshot(session, current);
        resumeIndexes = before.chapters.filter(chapter => chapter.state === 'paused' &&
          (chapterIndex === undefined || chapter.chapterIndex === chapterIndex)).map(chapter => chapter.chapterIndex);
        await gateway.operate(session, 'resume', chapterIndex, current);
        resume = true;
      } else if (action === 'releaseRetention') {
        await this.prepareMangaMutation(binding, chapterIndex);
        if (!current()) return undefined;
        await gateway.releaseRetention(session, chapterIndex, current);
      } else if (action === 'deleteDownloads') {
        deletion = await gateway.deleteDownloads(session, chapterIndex, current);
      }
      const entries = await this.dependencies.gateway.loadProjection(session, current);
      if (current()) this.deliver(binding, (): void => binding.emitEntries(this.merge(binding.currentEntries(), entries)));
    } finally { this.mangaActionActive = false; }
    if (update && current() && chapterIndex !== undefined) {
      if (!this.continueMangaIntent(intent, binding, chapterIndex, [], true)) void this.downloadChapter(chapterIndex, binding, true);
    } else if (resume && current() && resumeIndexes.length > 0) {
      if (!this.continueMangaIntent(intent, binding, chapterIndex, resumeIndexes)) {
        // The accepted download has its own materialization lifetime. Returning
        // its queue action releases the controls so pause/cancel remain usable.
        if (chapterIndex === undefined) void this.downloadBook(binding, resumeIndexes);
        else void this.downloadChapter(chapterIndex, binding);
      }
    }
    return deletion;
  }

  private sameMangaBook(intent: MangaDownloadIntent, session: RemoteReadingSession): boolean {
    return session.contentKind === 'manga' && intent.session.identity.sourceId === session.identity.sourceId &&
      intent.session.identity.bookId === session.identity.bookId;
  }

  private continueMangaIntent(intent: MangaDownloadIntent | undefined, binding: ReadingOfflineBinding,
    chapterIndex: number | undefined, resumedIndexes: number[], update: boolean = false): boolean {
    if (intent === undefined || this.mangaIntent !== intent || !intent.valid || intent.generation !== this.generation ||
      !this.sameMangaBook(intent, binding.session) || !this.admitted(binding)) return false;
    for (const index of resumedIndexes) intent.excludedChapters.delete(index);
    if (update && chapterIndex !== undefined) intent.excludedChapters.delete(chapterIndex);
    const current = (): boolean => intent.valid && this.mangaIntent === intent && intent.generation === this.generation && this.admitted(binding);
    const chapterCurrent = (index: number): boolean => current() && !intent.excludedChapters.has(index);
    const evidence = intent.evidence;
    const preparation = chapterIndex === undefined ? this.dependencies.gateway.prefetchBook(intent.session, current,
      (progress): void => { if (current()) this.deliver(binding, (): void => binding.emitEntries(this.merge(binding.currentEntries(), progress.entries))); },
      evidence, (index: number): boolean => chapterCurrent(index) && resumedIndexes.includes(index)) :
      update ? this.dependencies.gateway.updateMangaChapter(intent.session, chapterIndex, (): boolean => chapterCurrent(chapterIndex), evidence) :
        this.dependencies.gateway.prefetchChapter(intent.session, chapterIndex, (): boolean => chapterCurrent(chapterIndex), evidence);
    const work = preparation.then((entries): void => {
      if (!current()) return;
      this.updateReceipt(evidence, 'succeeded', undefined, entries); this.publish(binding);
      this.deliver(binding, (): void => binding.emitEntries(this.merge(binding.currentEntries(), entries)));
    }).catch((error): void => {
      if (current() && (chapterIndex === undefined || chapterCurrent(chapterIndex))) {
        intent.failure = error as Error;
        this.updateReceipt(evidence, 'failed', (error as Error).message); this.publish(binding);
        this.deliver(binding, (): void => binding.failed?.(error as Error));
      }
    }).finally((): void => { intent.continuations.delete(work); });
    intent.continuations.add(work);
    return true;
  }

  private async drainMangaContinuations(intent: MangaDownloadIntent): Promise<void> {
    while (intent.continuations.size > 0) await Promise.all(Array.from(intent.continuations));
  }

  /** Exact receipt reads may settle metadata; availability reads never dispatch
   * cache.clear, prefetch or image cleanup or infer confirmation from counts. */
  async load(binding: ReadingOfflineBinding): Promise<void> {
    if (!this.admitted(binding)) return;
    if (this.active) {
      if (this.operation !== undefined && this.matches(this.operation, binding))
        this.deliver(binding, (): void => binding.emitOperation?.(this.operation!));
      return new Promise<void>((resolve, reject): void => {
        this.pendingRead?.resolve();
        this.pendingRead = { binding, resolve, reject };
      });
    }
    try {
      await this.recoverClear(binding, false);
      if (this.active || !this.admitted(binding)) return;
      const read = ++this.readGeneration;
      const generation = this.generation;
      const current = (): boolean => this.admitted(binding) && !this.active &&
        generation === this.generation && read === this.readGeneration;
      await this.read(binding, current);
    } finally { this.drainPendingRead(); }
  }

  private drainPendingRead(): void {
    if (this.active || this.pendingRead === undefined) return;
    const pending = this.pendingRead;
    this.pendingRead = undefined;
    if (!this.admitted(pending.binding)) { pending.resolve(); return; }
    void this.load(pending.binding).then(pending.resolve, pending.reject);
  }

  async reconcile(generation: number, binding: ReadingOfflineBinding): Promise<void> {
    if (this.operation?.generation !== generation || !this.matches(this.operation, binding) ||
      !this.operation.projection.facts.canRetry) return;
    await this.load(binding);
  }

  async continueOriginal(generation: number, binding: ReadingOfflineBinding): Promise<void> {
    if (this.operation?.generation !== generation || !this.matches(this.operation, binding) || !this.operation.canContinueOriginal) return;
    try { await this.recoverClear(binding, true); if (!this.active && this.admitted(binding)) await this.load(binding); }
    finally { this.drainPendingRead(); }
  }
  private async recoverClear(binding: ReadingOfflineBinding, continueOriginal: boolean): Promise<void> {
    if (this.active || !this.admitted(binding)) return;
    this.active = true; const previous = this.operation !== undefined && this.matches(this.operation, binding) ? this.operation : undefined;
    const context = { sourceId: binding.session.identity.sourceId, bookId: binding.session.identity.bookId };
    const current = (): boolean => this.admitted(binding);
    try {
      const pending = await this.dependencies.gateway.pendingClearOperation();
      if (pending === undefined) {
        if (this.operation?.blockingClear?.active) {
          this.operation.blockingClear.active = false;
          this.publish(binding);
        }
        return;
      }
      if (pending.params['scope'] !== 'book' || pending.context.sourceId !== context.sourceId || pending.context.bookId !== context.bookId) {
        const message = pending.params['scope'] === 'cache' ?
          '原全局文字缓存清理尚未确认，请返回设置核对；暂不能开始新的本书离线操作，已有正文仍可使用' :
          '另一书籍的原缓存清理尚未确认，请返回原内容核对；已有正文仍可使用';
        const generation = this.operation?.blockingClear?.active === true &&
          this.operation.sourceId === pending.context.sourceId && this.operation.bookId === pending.context.bookId ?
          this.operation.generation : ++this.generation;
        this.operation = { action: 'clear', sourceId: pending.context.sourceId, bookId: pending.context.bookId,
          generation, materialization: 'idle', canContinueOriginal: false,
          blockingClear: { scope: pending.params['scope'] === 'cache' ? 'cache' : 'book', active: true },
          projection: projectPersistedReceipt({ confirmation: 'unknown', readback: 'idle', generation,
            message, blockedReason: message, canRetry: false }) };
        this.publish(binding);
        this.deliver(binding, (): void => binding.failed?.(new Error(message))); return;
      }
      const generation = previous?.generation ?? ++this.generation;
      try {
        const recovered = await this.dependencies.gateway.reconcileClearOperation(context, current, undefined, continueOriginal);
        if (recovered === undefined) return;
        // Core-only read recovery does not claim the physical image step ran.
        this.operation = { action: 'clear', ...context, generation, materialization: previous?.materialization ?? 'idle',
          materializationFailure: previous?.materializationFailure, canContinueOriginal: false,
          projection: projectPersistedReceipt({ confirmation: 'confirmed', readback: 'idle', generation, canRetry: true,
            message: previous?.materializationFailure ?? '原清理已核实；图片缓存整理保留原执行状态' }) };
        this.publish(binding);
      } catch (error) {
        const issue = error as ReadingOperationPendingError;
        const confirmed = issue.confirmed === true || previous?.projection.receipt.confirmation === 'confirmed';
        this.operation = { action: 'clear', ...context, generation, materialization: previous?.materialization ?? 'idle',
          materializationFailure: previous?.materializationFailure, operationFailure: issue.message,
          canContinueOriginal: !confirmed && issue.blocked !== true,
          projection: projectPersistedReceipt({ confirmation: confirmed ? 'confirmed' : 'unknown', readback: 'failed', generation,
            message: previous?.materializationFailure ?? issue.message, blockedReason: issue.blocked ? issue.message : undefined, refreshError: issue.message, canRetry: true, stale: true }) };
        this.publish(binding); this.deliver(binding, (): void => binding.failed?.(error as Error));
      }
    } catch (error) {
      const issue = error as ReadingOperationPendingError; const generation = previous?.generation ?? ++this.generation;
      this.operation = { action: 'clear', ...context, generation, materialization: previous?.materialization ?? 'idle',
        materializationFailure: previous?.materializationFailure, operationFailure: issue.message, canContinueOriginal: false,
        projection: projectPersistedReceipt({ confirmation: previous?.projection.receipt.confirmation ?? 'unknown',
          readback: 'failed', generation, canRetry: true, blockedReason: issue.message, message: issue.message,
          value: binding.currentEntries(), stale: true }) };
      this.publish(binding); this.deliver(binding, (): void => binding.failed?.(error as Error));
    } finally { this.active = false; }
  }

  private async write(action: ReadingOfflineOperation['action'], binding: ReadingOfflineBinding,
    chapterIndex?: number, onlyIndexes?: number[], update: boolean = false): Promise<void> {
    if (this.active || this.mangaActionActive || !this.admitted(binding)) return;
    // An unknown clear could still delete a later new download. A list/status
    // read is not a transaction receipt and cannot silently lift this barrier.
    if (this.operation?.action === 'clear' && this.operation.projection.receipt.confirmation === 'unknown' &&
      this.operation.blockingClear?.active !== false) {
      this.deliver(binding, (): void => binding.failed?.(new Error('离线清除结果未确认，请重新载入核对，不要重复操作'))); return;
    }
    if (action !== 'clear') {
      try {
        if (await this.dependencies.gateway.pendingClearOperation() !== undefined) {
          this.deliver(binding, (): void => binding.failed?.(new Error('原缓存清理仍需核对，不能开始新的下载'))); return;
        }
      } catch (error) { this.deliver(binding, (): void => binding.failed?.(error as Error)); return; }
      if (this.active || !this.admitted(binding)) return;
    }
    this.active = true;
    ++this.readGeneration;
    const generation = ++this.generation;
    const captured: RemoteReadingSession = { ...binding.session, identity: { ...binding.session.identity },
      book: { ...binding.session.book }, entries: binding.session.entries.map(entry => ({ ...entry })) };
    const evidence = new ReaderWriteEvidence();
    let finish = (): void => {};
    const intent: MangaDownloadIntent | undefined = captured.contentKind === 'manga' && action !== 'clear' ? {
      session: captured, generation, valid: true,
      excludedChapters: new Set(onlyIndexes === undefined ? [] : captured.entries.filter(entry => !onlyIndexes.includes(entry.index)).map(entry => entry.index)),
      continuations: new Set(), evidence,
      settled: new Promise<void>(resolve => { finish = resolve; }), finish: (): void => finish(),
    } : undefined;
    if (intent !== undefined) this.mangaIntent = intent;
    const current = (): boolean => generation === this.generation && this.active && this.admitted(binding) && intent?.valid !== false;
    const chapterCurrent = (index: number): boolean => current() && intent?.excludedChapters.has(index) !== true;
    this.operation = { action, sourceId: captured.identity.sourceId, bookId: captured.identity.bookId,
      chapterIndex, generation, materialization: 'running', projection: projectPersistedReceipt({
        confirmation: 'undispatched', readback: 'idle', generation }) };
    this.publish(binding);
    if (action !== 'clear') this.deliver(binding, (): void => binding.emitEntries(binding.currentEntries().map(entry =>
      entry.navigable === false || entry.downloadState === 'completed' ||
        intent?.excludedChapters.has(entry.index) === true ||
        (action === 'chapter' && entry.index !== chapterIndex) ? entry : { ...entry, downloadState: 'queued' })));
    try {
      let entries: LocalReadingTocEntry[];
      if (action === 'clear') {
        await this.dependencies.gateway.clearBook(captured, current, evidence);
        entries = captured.contentKind === 'manga' ? await this.dependencies.gateway.loadProjection(captured, current) :
          binding.currentEntries().map(entry => ({ ...entry, downloadState: 'missing' }));
      } else if (action === 'chapter') {
        entries = update && captured.contentKind === 'manga' ?
          await this.dependencies.gateway.updateMangaChapter(captured, chapterIndex!, (): boolean => chapterCurrent(chapterIndex!), evidence) :
          await this.dependencies.gateway.prefetchChapter(captured, chapterIndex!, (): boolean => chapterCurrent(chapterIndex!), evidence);
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
        }, evidence, intent === undefined ? undefined : chapterCurrent);
      }
      if (intent !== undefined) {
        await this.drainMangaContinuations(intent);
        if (intent.failure !== undefined) throw intent.failure;
        if (current()) entries = await this.dependencies.gateway.loadProjection(captured, current);
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
      this.operation.operationFailure = (error as Error).message;
      if (evidence.confirmation() === 'confirmed' && (error as ReadingOperationPendingError).intent === undefined)
        this.operation.materializationFailure = (error as Error).message;
      this.updateReceipt(evidence, 'failed', (error as Error).message);
      this.publish(binding);
      this.deliver(binding, (): void => binding.failed?.(error as Error));
      // Fresh canonical availability preserves cached bodies and partial
      // results; never flatten the whole requested range to failed/missing.
      if (current()) await this.read(binding, current);
    } finally {
      try { if (intent !== undefined) await this.drainMangaContinuations(intent); }
      finally {
        if (this.mangaIntent === intent) this.mangaIntent = undefined;
        if (generation === this.generation) this.active = false;
        intent?.finish(); this.drainPendingRead();
      }
    }
  }

  private async read(binding: ReadingOfflineBinding, current: () => boolean): Promise<void> {
    if (!current()) return;
    const operation = this.operation;
    if (operation !== undefined && this.matches(operation, binding)) {
      operation.projection = projectPersistedReceipt({ confirmation: operation.projection.receipt.confirmation,
        readback: 'reading', generation: operation.generation, message: operation.materializationFailure ?? operation.operationFailure, blockedReason: operation.projection.facts.blockedReason });
      this.publish(binding);
    }
    try {
      const entries = await this.dependencies.gateway.loadDirectoryProjection(binding.session, current);
      if (!current()) return;
      this.deliver(binding, (): void => binding.emitEntries(this.merge(binding.currentEntries(), entries)));
      if (operation !== undefined && this.operation === operation && this.matches(operation, binding)) {
        operation.projection = projectPersistedReceipt({ confirmation: operation.projection.receipt.confirmation,
          readback: 'succeeded', generation: operation.generation, value: entries,
          message: operation.materializationFailure ?? operation.operationFailure, blockedReason: operation.projection.facts.blockedReason,
          canRetry: operation.projection.receipt.confirmation === 'unknown' || operation.materialization === 'failed' || operation.canContinueOriginal === true });
        operation.progress = this.progress(binding.session, entries, operation.progress);
        this.publish(binding);
      }
    } catch (error) {
      if (!current()) return;
      if (operation !== undefined && this.operation === operation && this.matches(operation, binding)) {
        operation.projection = projectPersistedReceipt({ confirmation: operation.projection.receipt.confirmation,
          readback: 'failed', generation: operation.generation, refreshError: (error as Error).message, message: operation.materializationFailure ?? operation.operationFailure ?? (error as Error).message, blockedReason: operation.projection.facts.blockedReason, canRetry: true });
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
      // A readable cached body and a failed image/materialization step overlap.
      // Canonical row availability cannot erase the same operation's failures.
      failedChapters: Math.max(previous?.failedChapters ?? 0,
        entries.filter(entry => entry.navigable !== false && entry.downloadState === 'failed').length),
      firstFailure: previous?.firstFailure, entries };
  }

  private updateReceipt(evidence: ReaderWriteEvidence, readback: 'idle' | 'reading' | 'failed' | 'succeeded',
    message?: string, value?: LocalReadingTocEntry[]): void {
    if (this.operation === undefined) return;
    this.operation.projection = projectPersistedReceipt({ confirmation: evidence.confirmation(), readback,
      generation: this.operation.generation, value, refreshError: message, message: this.operation.materializationFailure ?? this.operation.operationFailure ?? message,
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
