import type { JsonObject } from '@reader/core-harmony';
import type { ShelfBook } from '../../app/ReaderCoreGateway';
import type { ReadingGatewayRuntime } from '../reading/ReadingGatewayRuntime';
import { ReadingOfflineGateway, type ReadingOfflineProjectionFailureObserver,
  type ReadingOfflineProjectionFailureStage } from '../reading/ReadingOfflineGateway';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import { RemoteReadingFlowGateway, type RemoteReadingSession, type RemoteReadingTocEntry } from '../reading/RemoteReadingFlowGateway';
import { MangaDownloadActionsGateway } from '../manga/MangaDownloadActionsGateway';
import { CacheClearOperationIntentStore } from '../reading/ReadingOperationIntents';
import { SharedDownloadIntentPreferences } from './SharedDownloadIntentPreferences';
import { readingOfflineFailureHint } from '../reading/ReadingOfflineFailurePresentation';

export type SharedDownloadAction = 'download' | 'pause' | 'resume' | 'cancel' | 'delete';
export type SharedDownloadJobStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
export interface SharedDownloadExpectedChapter { chapterIndex: number; chapterId: string; }
export interface SharedDownloadTarget {
  book: ShelfBook;
  chapterIndexes?: number[];
  /** Exact current page DTO proof, including a book's very first request. */
  expectedChapters?: SharedDownloadExpectedChapter[];
}
export interface SharedDownloadAcceptance { key: string; accepted: boolean; alreadyRunning: boolean; requestedChapters: number; }
/** Queue/content control and its final durable state have succeeded. A caller
 * may acknowledge that operation while presenting this separate read error. */
export class SharedDownloadProjectionRefreshError extends Error {
  readonly action: SharedDownloadAction;
  readonly originalFailure: unknown;

  constructor(action: SharedDownloadAction, originalFailure: unknown) {
    super('下载状态已更新，列表信息暂时无法读取，请刷新');
    this.name = 'SharedDownloadProjectionRefreshError';
    this.action = action;
    this.originalFailure = originalFailure;
  }
}
type DownloadOperationStage = 'intent-resolve' | 'resume-rebind' | 'target-admission' | 'intent-persist' |
  'control-before-drain' | 'consumer-drain' | 'control-after-drain' | 'resume-control' |
  'content-delete' | 'state-persist' | 'projection-refresh' | 'execution-start';
type DownloadOperationConfirmation = 'none' | 'intent-persisted' | 'queue-controlled' |
  'content-deleted' | 'state-persisted';
type DownloadQueueControlStage = 'status-read' | 'status-identity' | 'chapter-identity' |
  'queue-rpc' | 'queue-response';
export interface SharedDownloadPreservedRetention { chapterIndex: number; chapterId: string; }
export interface SharedDownloadIntent {
  version: 1;
  key: string;
  book: ShelfBook;
  session: RemoteReadingSession;
  requestedIndexes: number[];
  /** Explicitly saved content keeps its retention after task cancellation. */
  retainedIndexes: number[];
  /** Before-images retain old physical Core slots after an exact URL reindex. */
  preservedRetentions: SharedDownloadPreservedRetention[];
  pausedIndexes: number[];
  status: SharedDownloadJobStatus;
  error: string;
  updatedAt: number;
}
export interface SharedDownloadIntentPersistence {
  load(): Promise<SharedDownloadIntent[]>;
  save(intents: SharedDownloadIntent[]): Promise<void>;
}
export interface SharedDownloadJob {
  key: string;
  sourceId: string;
  bookId: string;
  book: ShelfBook;
  status: SharedDownloadJobStatus;
  requestedIndexes: number[];
  retainedIndexes: number[];
  preservedRetentions: SharedDownloadPreservedRetention[];
  pausedIndexes: number[];
  completedChapters: number;
  totalChapters: number;
  entries: LocalReadingTocEntry[];
  error: string;
  updatedAt: number;
  revision: number;
}
export interface SharedDownloadCoordinatorSnapshot { books: ShelfBook[]; jobs: SharedDownloadJob[]; restoring: boolean; error: string; }
interface SharedDownloadExecution {
  valid: boolean;
  settled: Promise<void>;
  gateway: ReadingOfflineGateway;
  current: () => boolean;
}

/** Runtime-owned Reader intent coordination over the existing Core queue and
 * Host materializer. Navigation never owns or cancels accepted downloads. */
export class SharedDownloadCoordinator {
  private readonly runtime: ReadingGatewayRuntime;
  private readonly ownsRuntime: () => boolean;
  private readonly persistence: SharedDownloadIntentPersistence;
  private readonly intents: Map<string, SharedDownloadIntent> = new Map();
  private readonly projections: Map<string, LocalReadingTocEntry[]> = new Map();
  private readonly revisions: Map<string, number> = new Map();
  private readonly executions: Map<string, SharedDownloadExecution> = new Map();
  private readonly operations: Map<string, Promise<void>> = new Map();
  private readonly listeners: Set<(snapshot: SharedDownloadCoordinatorSnapshot) => void> = new Set();
  private restoreWork?: Promise<void>;
  private writeTail: Promise<void> = Promise.resolve();
  private restoring: boolean = false;
  private error: string = '';
  private closed: boolean = false;

  constructor(runtime: ReadingGatewayRuntime, ownsRuntime: () => boolean, persistence?: SharedDownloadIntentPersistence) {
    this.runtime = runtime; this.ownsRuntime = ownsRuntime;
    if (persistence !== undefined) this.persistence = persistence;
    else {
      if (runtime.getUIAbilityContext === undefined) throw new Error('下载记录存储尚未就绪');
      this.persistence = new SharedDownloadIntentPreferences(runtime.getUIAbilityContext());
    }
  }

  books(): ShelfBook[] { return Array.from(this.intents.values()).map(intent => ({ ...intent.book })); }
  jobs(): SharedDownloadJob[] { return Array.from(this.intents.values()).map(intent => this.projectJob(intent)); }
  job(sourceId: string, bookId: string): SharedDownloadJob | undefined {
    const intent = this.intents.get(this.key(sourceId, bookId));
    return intent === undefined ? undefined : this.projectJob(intent);
  }
  projectionRevision(sourceId: string, bookId: string): string {
    const key = this.key(sourceId, bookId), intent = this.intents.get(key);
    return JSON.stringify(intent === undefined ? [] : [this.revisions.get(key) ?? 0, intent.status, intent.updatedAt,
      intent.requestedIndexes.length, intent.pausedIndexes.length, intent.retainedIndexes.length]);
  }
  ownershipSignature(): string {
    return JSON.stringify(Array.from(this.intents.values()).map(intent => ({ sourceId: intent.book.sourceId,
      bookId: intent.book.bookId, status: intent.status, requestedIndexes: intent.requestedIndexes,
      retainedIndexes: intent.retainedIndexes, preservedRetentions: intent.preservedRetentions })));
  }
  private projectJob(intent: SharedDownloadIntent): SharedDownloadJob {
    const entries = (this.projections.get(intent.key) ?? []).map(entry => ({ ...entry }));
    const readable = this.readableIndexes(intent.session);
    const complete = entries.filter(entry => entry.navigable !== false &&
      (intent.session.contentKind === 'manga' ? entry.downloadState === 'completed' :
        entry.downloadState === 'completed' || entry.downloadState === 'cached')).length;
    return { key: intent.key, sourceId: intent.book.sourceId, bookId: intent.book.bookId,
      book: { ...intent.book }, status: intent.status, requestedIndexes: intent.requestedIndexes.slice(),
      retainedIndexes: intent.retainedIndexes.slice(),
      preservedRetentions: intent.preservedRetentions.map(row => ({ ...row })),
      pausedIndexes: intent.pausedIndexes.slice(), completedChapters: complete,
      totalChapters: intent.session.entries.filter(entry => readable.has(entry.index)).length,
      entries, error: intent.error, updatedAt: intent.updatedAt, revision: this.revisions.get(intent.key) ?? 0 };
  }
  snapshot(): SharedDownloadCoordinatorSnapshot {
    return { books: this.books(), jobs: this.jobs(), restoring: this.restoring, error: this.error };
  }
  subscribe(listener: (snapshot: SharedDownloadCoordinatorSnapshot) => void): () => void {
    this.listeners.add(listener); listener(this.snapshot());
    return (): void => { this.listeners.delete(listener); };
  }

  restore(): Promise<void> {
    if (this.restoreWork !== undefined) return this.restoreWork;
    this.restoring = true; this.publish();
    this.restoreWork = (async (): Promise<void> => {
      try {
        const stored = await this.persistence.load();
        this.assertCurrent();
        const admitted = new Map<string, SharedDownloadIntent>();
        for (const record of stored) {
          const intent = JSON.parse(JSON.stringify(record)) as SharedDownloadIntent;
          intent.retainedIndexes ??= intent.requestedIndexes.slice();
          intent.preservedRetentions ??= [];
          this.validate(intent);
          if (admitted.has(intent.key)) throw new Error('下载记录归属重复，原记录已保留');
          // An interrupted active job keeps the FULL accepted range, including
          // chapters never submitted to Core before the process exited.
          if (intent.status === 'downloading') intent.status = 'queued';
          admitted.set(intent.key, intent);
        }
        // No valid prefix may escape when a later record fails validation.
        this.intents.clear(); for (const intent of admitted.values()) this.intents.set(intent.key, intent);
        this.error = '';
        this.restoring = false; this.publish();
        for (const intent of this.intents.values()) {
          if (intent.status === 'queued') this.start(intent);
          else void this.refresh(intent).catch((): void => {});
        }
      } catch (error) {
        this.error = '下载记录暂时无法读取，原记录已保留'; this.restoring = false; this.publish();
        // A user refresh can retry a transient platform read or repaired
        // journal; nothing is saved or replaced after failed admission.
        this.restoreWork = undefined;
        throw error;
      }
    })();
    // RuntimeReady may deliberately fire restoration in the background.
    void this.restoreWork.catch((): void => {});
    return this.restoreWork;
  }

  async submit(session: RemoteReadingSession, indexes?: number[]): Promise<SharedDownloadAcceptance> {
    await this.runtime.waitForDownloadStorageIdle?.();
    await this.restore(); this.assertCurrent();
    const key = this.key(session.identity.sourceId, session.identity.bookId);
    return this.serialized(key, async (): Promise<SharedDownloadAcceptance> => this.accept(session, indexes))
      .catch((error): Promise<never> => this.failSubmission(key, error as Error));
  }

  async submitBook(book: ShelfBook, indexes?: number[], expectedChapters?: SharedDownloadExpectedChapter[]): Promise<SharedDownloadAcceptance> {
    await this.runtime.waitForDownloadStorageIdle?.();
    await this.restore(); this.assertCurrent();
    if (book.sourceId === 'local') throw new Error('本地书籍无需网络下载');
    if (book.contentKind !== 'text' && book.contentKind !== 'manga') throw new Error('下载内容类型需要重新确认');
    const key = this.key(book.sourceId, book.bookId);
    return this.serialized(key, async (): Promise<SharedDownloadAcceptance> => {
      const existing = this.intents.get(key);
      // Whole-book content deletion can remove Core's cached catalog. Re-read
      // its admission before reusing an intent; never submit stale indexes to
      // a missing/new directory just because presentation metadata survived.
      const session = await this.resolve(book, existing?.session);
      this.assertExpectedChapters(session, indexes, expectedChapters);
      return this.accept(session, indexes, book);
    }).catch((error): Promise<never> => this.failSubmission(key, error as Error));
  }

  async operate(action: SharedDownloadAction, target: SharedDownloadTarget): Promise<SharedDownloadAcceptance | undefined> {
    if (action === 'download') return this.submitBook(target.book, target.chapterIndexes, target.expectedChapters);
    await this.runtime.waitForDownloadStorageIdle?.();
    await this.restore(); this.assertCurrent();
    const key = this.key(target.book.sourceId, target.book.bookId);
    let stage: DownloadOperationStage = 'intent-resolve';
    let lastConfirmed: DownloadOperationConfirmation = 'none';
    return this.serialized(key, async (): Promise<SharedDownloadAcceptance | undefined> => {
      let intent = this.intents.get(key);
      if (intent === undefined) {
        const session = await this.resolve(target.book);
        intent = this.createIntent(session, target.book, []);
        this.intents.set(key, intent);
      }
      if (action === 'resume') {
        stage = 'resume-rebind';
        const fresh = await this.resolve(target.book, intent.session);
        await this.rebind(intent, fresh);
      }
      stage = 'target-admission';
      const selected = this.selected(intent.session, target.chapterIndexes ??
        (action === 'resume' ? intent.requestedIndexes : undefined));
      const selectedSet = new Set(selected);
      this.assertExpectedChapters(intent.session, target.chapterIndexes, target.expectedChapters);
      if (action === 'resume' && selected.length === 0) throw new Error('没有可继续的下载，请选择下载');
      if (target.chapterIndexes !== undefined) await this.assertChapterIdentities(intent, selected);
      const active = this.executions.get(key);
      const wasRunning = active !== undefined;
      if (action === 'pause') {
        const requested = new Set(intent.requestedIndexes);
        intent.pausedIndexes = this.union(intent.pausedIndexes, selected.filter(index => requested.has(index)));
        intent.status = 'paused';
      } else if (action === 'cancel' || action === 'delete') {
        // Persist withdrawal before any destructive dispatch: process death
        // must not resume a range the user just cancelled or removed.
        intent.requestedIndexes = intent.requestedIndexes.filter(index => !selectedSet.has(index));
        intent.pausedIndexes = intent.pausedIndexes.filter(index => !selectedSet.has(index));
        intent.status = intent.pausedIndexes.length > 0 ? 'paused' : 'cancelled';
      }
      intent.updatedAt = Date.now();
      stage = 'intent-persist';
      await this.persist(); this.publish();
      lastConfirmed = 'intent-persisted';
      // Withdraw the consumer before queue control; a claim accepted during
      // the first RPC must settle before a destructive operation is dispatched.
      if (active !== undefined) active.valid = false;
      if (action === 'pause' || action === 'cancel' || action === 'delete') {
        stage = 'control-before-drain';
        await this.control(intent, action === 'pause' ? 'pause' : 'cancel', selected);
      }
      stage = 'consumer-drain';
      if (active !== undefined) await active.settled;
      this.assertCurrent();
      if (action === 'pause' || action === 'cancel' || action === 'delete') {
        stage = 'control-after-drain';
        await this.control(intent, action === 'pause' ? 'pause' : 'cancel', selected);
        lastConfirmed = 'queue-controlled';
      }
      if (action === 'pause') {
        const requested = new Set(intent.requestedIndexes);
        intent.pausedIndexes = this.union(intent.pausedIndexes, selected.filter(index => requested.has(index)));
      } else if (action === 'resume') {
        intent.requestedIndexes = this.union(intent.requestedIndexes, selected);
        intent.retainedIndexes = this.union(intent.retainedIndexes, selected);
        intent.pausedIndexes = intent.pausedIndexes.filter(index => !selectedSet.has(index));
        stage = 'resume-control';
        await this.control(intent, 'resume', selected);
        lastConfirmed = 'queue-controlled';
      } else {
        intent.requestedIndexes = intent.requestedIndexes.filter(index => !selectedSet.has(index));
        intent.pausedIndexes = intent.pausedIndexes.filter(index => !selectedSet.has(index));
        if (action === 'delete') {
          stage = 'content-delete';
          await this.deleteContent(intent, selected, target.chapterIndexes === undefined);
          lastConfirmed = 'content-deleted';
          await this.runtime.releaseLegacyDownloadProtection?.(intent.book.sourceId, intent.book.bookId,
            target.chapterIndexes === undefined ? undefined : selected);
          intent.retainedIndexes = intent.retainedIndexes.filter(index => !selectedSet.has(index));
          const catalog = this.catalogByIndex(intent.session);
          const selectedIds = new Set(selected.map(index => catalog.get(index)?.url));
          intent.preservedRetentions = target.chapterIndexes === undefined ? [] :
            intent.preservedRetentions.filter(row => !selectedIds.has(row.chapterId));
        }
      }
      const paused = new Set(intent.pausedIndexes);
      const runnable = intent.requestedIndexes.filter(index => !paused.has(index));
      intent.status = runnable.length > 0 && (wasRunning || action === 'resume') ? 'queued' :
        intent.pausedIndexes.length > 0 ? 'paused' : 'cancelled';
      intent.error = ''; intent.updatedAt = Date.now();
      stage = 'state-persist';
      await this.persist(); this.publish();
      lastConfirmed = 'state-persisted';
      stage = 'projection-refresh';
      await this.refresh(intent, (): boolean => this.current(),
        new ReadingOfflineGateway(this.runtime, undefined, true), action);
      stage = 'execution-start';
      if (intent.status === 'queued') this.start(intent);
      return action === 'resume' ? { key, accepted: true, alreadyRunning: false, requestedChapters: selected.length } : undefined;
    }).catch(async (error): Promise<SharedDownloadAcceptance | undefined> => {
      this.controlDiagnostic(action, stage, lastConfirmed, error);
      const intent = this.intents.get(key);
      if (lastConfirmed === 'state-persisted' && stage === 'projection-refresh') {
        // The committed queue/content transaction is independent of this
        // optional read. Preserve the durable state and runnable siblings;
        // report this exact boundary instead of inventing a failed download.
        // start() cannot enter while serialized() still owns this key. Its
        // tail is terminal-only and removes that ownership before this wait
        // resumes; a projection rejection must not strand a resumed range.
        await this.operations.get(key);
        if (intent !== undefined && this.current() && intent.status === 'queued') this.drain();
        throw new SharedDownloadProjectionRefreshError(action, error);
      }
      if (intent !== undefined && this.current()) {
        intent.status = 'failed'; intent.error = this.publicFailure(error as Error); intent.updatedAt = Date.now();
        try { await this.persist(); this.publish(); }
        catch (persistenceError) {
          this.controlDiagnostic(action, 'state-persist', lastConfirmed, persistenceError);
          this.error = '下载记录暂时无法保存，请重试'; this.publish();
        }
      }
      throw error;
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const execution of this.executions.values()) execution.valid = false;
    await Promise.all(Array.from(this.executions.values()).map(execution => execution.settled));
    await Promise.all(Array.from(this.operations.values()));
    for (const intent of this.intents.values()) if (intent.status === 'downloading') intent.status = 'queued';
    await this.persist(); this.listeners.clear();
  }

  private async accept(session: RemoteReadingSession, indexes?: number[], suppliedBook?: ShelfBook): Promise<SharedDownloadAcceptance> {
    this.assertCurrent();
    if (session.identity.sourceId === 'local') throw new Error('本地书籍无需网络下载');
    if (session.contentKind !== 'text' && session.contentKind !== 'manga') throw new Error('下载内容类型需要重新确认');
    const key = this.key(session.identity.sourceId, session.identity.bookId);
    const requested = this.selected(session, indexes);
    if (requested.length === 0) throw new Error('本书暂无可下载章节');
    const prior = this.intents.get(key);
    if (prior !== undefined) await this.rebind(prior, session);
    const running = this.executions.has(key);
    const intent = prior ?? this.createIntent(session, suppliedBook, requested);
    intent.session = this.persistedSession(session);
    intent.book = suppliedBook === undefined ? { ...intent.book, ...session.book } : { ...suppliedBook };
    intent.requestedIndexes = this.union(intent.requestedIndexes, requested);
    intent.retainedIndexes = this.union(intent.retainedIndexes, requested);
    const requestedSet = new Set(requested);
    intent.pausedIndexes = intent.pausedIndexes.filter(index => !requestedSet.has(index));
    intent.status = running ? 'downloading' : 'queued'; intent.error = ''; intent.updatedAt = Date.now();
    this.intents.set(key, intent);
    // Full intent is flushed before ACK or first Core chunk is dispatched.
    await this.persist(); this.assertCurrent();
    await this.control(intent, 'resume', requested);
    this.publish(); if (!running) this.start(intent);
    return { key, accepted: true, alreadyRunning: running, requestedChapters: requested.length };
  }

  private createIntent(session: RemoteReadingSession, suppliedBook: ShelfBook | undefined, indexes: number[]): SharedDownloadIntent {
    const book: ShelfBook = suppliedBook ?? { ...session.book, ...session.identity,
      contentKind: session.contentKind, addedAt: Date.now() };
    return { version: 1, key: this.key(book.sourceId, book.bookId), book: { ...book },
      session: this.persistedSession(session), requestedIndexes: indexes.slice(), retainedIndexes: indexes.slice(),
      preservedRetentions: [], pausedIndexes: [],
      status: 'queued', error: '', updatedAt: Date.now() };
  }

  private start(intent: SharedDownloadIntent): void {
    if (!this.current() || this.operations.has(intent.key) || this.executions.has(intent.key) || this.executions.size >= 2) return;
    const gateway = new ReadingOfflineGateway(this.runtime, new CacheClearOperationIntentStore(this.runtime, this.ownsRuntime), true);
    const captured = this.runtime.captureMangaImageContentValidity?.(intent.book.sourceId, intent.book.bookId) ??
      this.runtime.captureReadingContentValidity?.(intent.book.sourceId, intent.book.bookId);
    const execution: SharedDownloadExecution = { valid: true, settled: Promise.resolve(), gateway,
      current: (): boolean => execution.valid && this.current() && captured?.() !== false };
    this.executions.set(intent.key, execution);
    intent.status = 'downloading'; this.publish();
    execution.settled = this.run(intent, execution).finally(async (): Promise<void> => {
      // A real content/source mutation is a visible stopped job. It must not
      // silently remain downloading or adopt a new epoch for old chapter URLs.
      if (execution.valid && this.current() && !execution.current() && intent.status === 'downloading') {
        intent.status = 'failed'; intent.error = '书源或内容已变化，请重新读取目录后下载'; intent.updatedAt = Date.now();
        try { await this.persist(); } catch (_) { this.error = '下载记录暂时无法保存，请重试'; }
        this.publish();
      }
      if (this.executions.get(intent.key) === execution) this.executions.delete(intent.key);
      this.drain();
    });
    void execution.settled.catch((): void => {});
  }

  private drain(): void {
    if (!this.current()) return;
    for (const intent of this.intents.values()) {
      if (this.executions.size >= 2) break;
      if (intent.status === 'queued') this.start(intent);
    }
  }

  private async run(intent: SharedDownloadIntent, execution: SharedDownloadExecution): Promise<void> {
    try {
      await this.persist();
      // Process restoration and explicit retries validate the present catalog
      // before adopting a fresh runtime epoch for persisted chapter identities.
      const fresh = await this.resolve(intent.book, intent.session);
      if (!execution.current()) return;
      await this.rebind(intent, fresh, execution);
      if (!execution.current()) return;
      await this.persist();
      await this.refresh(intent, execution.current, execution.gateway);
      const processed = new Set<number>();
      let requested = intent.requestedIndexes, next = 0;
      let pausedIndexes = intent.pausedIndexes, paused = new Set(pausedIndexes);
      const emptyProjection: LocalReadingTocEntry[] = [];
      let projection: LocalReadingTocEntry[] = emptyProjection;
      let projectedByIndex = new Map<number, LocalReadingTocEntry>();
      for (;;) {
        if (!execution.current()) return;
        // Accepted ranges can grow during an awaited chapter. Rebuild only
        // this execution's cursor/set when the current intent arrays change.
        if (requested !== intent.requestedIndexes) { requested = intent.requestedIndexes; next = 0; }
        if (pausedIndexes !== intent.pausedIndexes) { pausedIndexes = intent.pausedIndexes; paused = new Set(pausedIndexes); }
        let index: number | undefined;
        while (next < requested.length) {
          const candidate = requested[next++];
          if (!paused.has(candidate) && !processed.has(candidate)) { index = candidate; break; }
        }
        if (index === undefined) break;
        processed.add(index);
        const currentProjection = this.projections.get(intent.key) ?? emptyProjection;
        if (projection !== currentProjection) {
          projection = currentProjection; projectedByIndex = new Map<number, LocalReadingTocEntry>();
          for (const entry of projection) if (!projectedByIndex.has(entry.index)) projectedByIndex.set(entry.index, entry);
        }
        const existing = projectedByIndex.get(index);
        const complete = intent.session.contentKind === 'manga' ? existing?.downloadState === 'completed' :
          existing?.downloadState === 'completed' || existing?.downloadState === 'cached';
        if (complete) continue;
        // One existing Core lease transaction at a time gives pause/delete a
        // bounded drain and publishes true materialization after each chapter.
        const progress = await execution.gateway.prefetchSelectedChapter(intent.session, index, execution.current);
        if (!execution.current()) return;
        this.mergeProjection(intent.key, progress.entries);
        if (progress.failedChapters > 0) throw new Error(progress.firstFailure?.reason ?? '下载失败');
        intent.updatedAt = Date.now(); this.publish();
      }
      if (!execution.current()) return;
      await this.refresh(intent, execution.current, execution.gateway);
      const entries = this.projections.get(intent.key) ?? [];
      const finalPaused = new Set(intent.pausedIndexes);
      const completed = new Set(entries.filter(entry => intent.session.contentKind === 'manga' ?
        entry.downloadState === 'completed' : entry.downloadState === 'cached' || entry.downloadState === 'completed')
        .map(entry => entry.index));
      const all = intent.requestedIndexes.every(index => finalPaused.has(index) || completed.has(index));
      if (!all) throw new Error('部分章节未完整保存，请重试下载');
      intent.status = intent.pausedIndexes.length > 0 ? 'paused' : 'completed';
      intent.error = ''; intent.updatedAt = Date.now(); await this.persist(); this.publish();
    } catch (error) {
      if (!execution.current()) return;
      intent.status = 'failed'; intent.error = this.publicFailure(error as Error); intent.updatedAt = Date.now();
      try { await this.persist(); } catch (_) { this.error = '下载记录暂时无法保存，请重试'; }
      this.publish();
      try { await this.refresh(intent, execution.current, execution.gateway); } catch (_) { /* Keep the failure and last verified projection. */ }
    }
  }

  private async resolve(book: ShelfBook, original?: RemoteReadingSession): Promise<RemoteReadingSession> {
    this.assertCurrent();
    if (book.sourceId === 'local') throw new Error('本地导入内容由书籍导入管理，不支持网络下载');
    const gateway = new RemoteReadingFlowGateway(this.runtime);
    const seed = { ...book, detailUrl: original?.detailUrl ?? book.bookId,
      sourceVersion: original?.sourceVersion, searchVariables: original?.continuationVariables ?? [] };
    try { return await gateway.openCachedCatalogSession(seed, (): boolean => this.current(), true, book.contentKind === 'manga'); }
    catch (_) {
      this.assertCurrent();
      return gateway.openSession(seed, { allowMangaCatalog: book.contentKind === 'manga', isCurrent: (): boolean => this.current() });
    }
  }

  private async rebind(intent: SharedDownloadIntent, fresh: RemoteReadingSession, ownExecution?: SharedDownloadExecution): Promise<void> {
    if (fresh.identity.sourceId !== intent.book.sourceId || fresh.identity.bookId !== intent.book.bookId)
      throw new Error('下载书籍归属无法确认');
    const byUrl = new Map<string, number[]>();
    for (const entry of fresh.entries) {
      if (entry.navigable === false || entry.url.trim() === '') continue;
      const matches = byUrl.get(entry.url);
      if (matches === undefined) byUrl.set(entry.url, [entry.index]);
      else matches.push(entry.index);
    }
    const originalEntries = intent.session.entries;
    let previousByIndex = this.catalogByIndex(intent.session);
    const mappings = new Map<number, number>();
    for (const index of this.union(intent.requestedIndexes, intent.retainedIndexes)) {
      const previous = previousByIndex.get(index);
      const matches = previous === undefined ? [] : byUrl.get(previous.url) ?? [];
      if (matches.length !== 1) throw new Error('目录已变化，原下载已保留；请重新读取目录后重试');
      mappings.set(index, matches[0]);
    }
    const moved = Array.from(mappings.entries()).some(pair => pair[0] !== pair[1]);
    if (moved) {
      const active = this.executions.get(intent.key);
      if (active !== undefined && active !== ownExecution) { active.valid = false; await active.settled; this.assertCurrent(); }
    }
    const preserved = intent.preservedRetentions.slice();
    if (intent.session.entries !== originalEntries) previousByIndex = this.catalogByIndex(intent.session);
    const preservedByIndex = new Map<number, Set<string>>();
    for (const row of preserved) {
      const ids = preservedByIndex.get(row.chapterIndex) ?? new Set<string>();
      ids.add(row.chapterId); preservedByIndex.set(row.chapterIndex, ids);
    }
    for (const index of intent.retainedIndexes) {
      const previous = previousByIndex.get(index);
      if (previous !== undefined && mappings.get(index) !== index &&
        !preservedByIndex.get(index)?.has(previous.url)) {
        preserved.push({ chapterIndex: index, chapterId: previous.url });
        const ids = preservedByIndex.get(index) ?? new Set<string>();
        ids.add(previous.url); preservedByIndex.set(index, ids);
      }
    }
    intent.requestedIndexes = this.union([], intent.requestedIndexes.map(index => mappings.get(index)!));
    intent.retainedIndexes = this.union([], intent.retainedIndexes.map(index => mappings.get(index)!));
    intent.pausedIndexes = this.union([], intent.pausedIndexes.map(index => mappings.get(index)!));
    intent.preservedRetentions = preserved;
    intent.session = this.persistedSession(fresh);
    // Projection indexes belong to the prior catalog. Re-read their physical
    // provenance instead of remapping cached/completed labels optimistically.
    if (moved) this.projections.delete(intent.key);
  }

  private async control(intent: SharedDownloadIntent, action: 'pause' | 'resume' | 'cancel', indexes: number[]): Promise<void> {
    let stage: DownloadQueueControlStage = 'status-read';
    let confirmedQueueRows = 0;
    try {
      const result = await this.runtime.request('cache.book.status', { ...intent.session.identity, includeGlobalStats: false,
        includeChapterStates: true }, { shouldCancel: (): boolean => !this.current() });
      this.assertCurrent();
      stage = 'status-identity';
      if (result.data['sourceId'] !== intent.book.sourceId || result.data['bookId'] !== intent.book.bookId ||
        !Array.isArray(result.data['chapters'])) throw new Error('下载任务状态无法读取');
      const rows = result.data['chapters'] as JsonObject[];
      const selected = new Set(indexes), status = this.statusByIndex(rows);
      let catalogEntries = intent.session.entries, catalog = this.catalogByIndex(intent.session);
      stage = 'chapter-identity';
      for (const index of indexes) {
        const expected = catalog.get(index);
        const actual = status.get(index);
        if (expected === undefined || actual === undefined || actual['navigable'] === false || actual['url'] !== expected.url)
          throw new Error('目录已变化，目标章节操作已停止，请重新读取目录');
      }
      for (const value of rows) {
        const index = value['chapterIndex'];
        if (typeof index !== 'number' || !selected.has(index)) continue;
        if (catalogEntries !== intent.session.entries) { catalogEntries = intent.session.entries; catalog = this.catalogByIndex(intent.session); }
        const expected = catalog.get(index);
        if (expected === undefined || value['navigable'] === false || value['url'] !== expected.url)
          throw new Error('目录已变化，目标章节操作已停止，请重新读取目录');
        // A first request has no queue row yet. Its URL proof is still checked
        // before the maxAttempts=0 shortcut; an index alone admits no chapter.
        if (typeof value['maxAttempts'] !== 'number' || value['maxAttempts'] === 0) continue;
        const state = value['state'];
        const applicable = action === 'resume' ? state === 'paused' : action === 'pause' ?
          state === 'queued' || state === 'inProgress' || state === 'failed' :
          state === 'queued' || state === 'inProgress' || state === 'paused' || state === 'failed';
        if (!applicable) continue;
        stage = 'queue-rpc';
        const controlled = await this.runtime.request(`cache.download.${action}`, { ...intent.session.identity, chapterIndex: index },
          { shouldCancel: (): boolean => !this.current() });
        this.assertCurrent();
        stage = 'queue-response';
        if (controlled.data['sourceId'] !== intent.book.sourceId || controlled.data['bookId'] !== intent.book.bookId ||
          controlled.data['chapterIndex'] !== index) throw new Error('下载操作归属无法确认');
        confirmedQueueRows += 1;
        stage = 'chapter-identity';
      }
    } catch (error) {
      console.warn(`DOWNLOAD_QUEUE_CONTROL_DIAGNOSTIC action=${action} stage=${stage} confirmedQueueRows=${confirmedQueueRows} code=${this.controlFailureCode(error)}`);
      throw error;
    }
  }

  private controlDiagnostic(action: SharedDownloadAction, stage: DownloadOperationStage,
    lastConfirmed: DownloadOperationConfirmation, error: unknown): void {
    console.warn(`DOWNLOAD_CONTROL_DIAGNOSTIC action=${action} stage=${stage} lastConfirmed=${lastConfirmed} code=${this.controlFailureCode(error)}`);
  }

  /** Only fixed domain codes and finite platform numbers reach ordinary logs.
   * Raw error messages, envelope details and business identifiers stay owned
   * by the original rejection; they are never serialized into diagnostics. */
  private controlFailureCode(error: unknown): string {
    const raw = error !== null && typeof error === 'object' ? error as Record<string, unknown> : undefined;
    const event = raw?.['event'];
    const eventObject = event !== null && typeof event === 'object' ? event as Record<string, unknown> : undefined;
    const nested = eventObject?.['error'];
    const failure = nested !== null && typeof nested === 'object' ? nested as Record<string, unknown> : raw;
    const code = failure?.['code'];
    if (typeof code === 'number' && Number.isSafeInteger(code) && code >= -2147483648 && code <= 2147483647)
      return `PLATFORM_${code}`;
    if (typeof code === 'string' && ['UNKNOWN_METHOD', 'INVALID_PARAMS', 'INVALID_PROTOCOL_VERSION', 'CANCELLED',
      'TIMEOUT', 'INVALID_MESSAGE', 'INTERNAL', 'TRANSACTION_PENDING', 'BUSY', 'RESOURCE_EXHAUSTED',
      'BOOK_ALREADY_ON_SHELF', 'NOT_FOUND', 'HOST_REQUEST_FAILED', 'IO_ERROR', 'NO_SPACE', 'storage_full',
      'cancelled', 'host_materialization_failed'].includes(code)) return code;
    const message = raw?.['message'];
    // Host image/cache guards throw these exact constants as Error.message.
    // Do not broaden this to prefixes, arbitrary messages or business IDs.
    if (typeof message === 'string' && ['MANGA_DECODE_CAPACITY', 'MANGA_CACHE_EVICTING',
      'MANGA_CACHE_STORAGE_RESTORING', 'MANGA_CACHE_PROFILE_REQUIRED', 'MANGA_CACHE_RESOURCE_CORRUPT']
      .includes(message)) return message;
    if (message === '目录已变化，目标章节操作已停止，请重新读取目录' ||
      message === '目录已变化，原下载已保留；请重新读取目录后重试') return 'DIRECTORY_CHANGED';
    if (message === '下载任务状态无法读取') return 'STATUS_IDENTITY_INVALID';
    if (message === '下载操作归属无法确认') return 'CONTROL_IDENTITY_INVALID';
    if (message === '下载运行环境已关闭') return 'RUNTIME_CLOSED';
    if (message === 'reading offline request was superseded') return 'CANCELLED';
    if (typeof message === 'string' && /^Reader-Core request cancelled by caller: [0-9]+$/.test(message)) return 'CANCELLED';
    if (typeof message === 'string' && /^Reader-Core request timed out: [0-9]+$/.test(message)) return 'TIMEOUT';
    return 'UNKNOWN';
  }

  private safeDiagnosticAction(action: string): string {
    return ['restore', 'run', 'pause', 'resume', 'cancel', 'delete', 'download', 'refresh'].includes(action) ? action : 'refresh';
  }

  private projectionFailureName(error: unknown): string {
    const name = error instanceof Error ? error.name : '';
    return ['Error', 'ReaderCoreRequestError', 'ReadingOfflineMaterializationError', 'RemoteReadingGatewayError',
      'RemoteChapterCacheRefreshError', 'BookRequestNotDispatchedError', 'NetworkEnvironmentError',
      'ReadingImageHttpError', 'SharedDownloadProjectionRefreshError'].includes(name) ? name : 'Error';
  }

  private assertExpectedChapters(session: RemoteReadingSession, indexes?: number[], proofs?: SharedDownloadExpectedChapter[]): void {
    if (proofs === undefined) return;
    const selected = new Set(indexes);
    if (indexes === undefined || proofs.length !== indexes.length || selected.size !== indexes.length ||
      new Set(proofs.map(proof => proof.chapterIndex)).size !== proofs.length)
      throw new Error('目标章节归属无法确认，请重新读取目录');
    const catalog = this.catalogByIndex(session);
    for (const proof of proofs) {
      const entry = catalog.get(proof.chapterIndex);
      if (!selected.has(proof.chapterIndex) || typeof proof.chapterId !== 'string' || proof.chapterId.trim() === '' ||
        entry === undefined || entry.navigable === false || entry.url !== proof.chapterId)
        throw new Error('目录已变化，目标章节操作已停止，请重新读取目录');
    }
  }

  private async assertChapterIdentities(intent: SharedDownloadIntent, indexes: number[]): Promise<void> {
    const result = await this.runtime.request('cache.book.status', { ...intent.session.identity,
      includeGlobalStats: false, includeChapterStates: true }, { shouldCancel: (): boolean => !this.current() });
    this.assertCurrent();
    if (result.data['sourceId'] !== intent.book.sourceId || result.data['bookId'] !== intent.book.bookId ||
      !Array.isArray(result.data['chapters'])) throw new Error('目标章节归属无法确认，请重新读取目录');
    const rows = result.data['chapters'] as JsonObject[];
    const catalog = this.catalogByIndex(intent.session), status = this.statusByIndex(rows);
    for (const index of indexes) {
      const expected = catalog.get(index);
      const actual = status.get(index);
      if (expected === undefined || actual === undefined || actual['navigable'] === false || actual['url'] !== expected.url)
        throw new Error('目录已变化，目标章节操作已停止，请重新读取目录');
    }
  }

  private async deleteContent(intent: SharedDownloadIntent, indexes: number[], wholeBook: boolean): Promise<void> {
    const current = (): boolean => this.current();
    const offline = new ReadingOfflineGateway(this.runtime, new CacheClearOperationIntentStore(this.runtime, this.ownsRuntime), true);
    if (intent.session.contentKind === 'manga') {
      const manga = new MangaDownloadActionsGateway(this.runtime);
      if (wholeBook) {
        const outcome = await manga.deleteDownloads(intent.session, undefined, current);
        if (outcome.protectedVersions > 0) throw new Error('当前阅读内容受到保护，请退出本书后删除');
      } else for (const index of indexes) {
        const outcome = await manga.deleteDownloads(intent.session, index, current);
        if (outcome.protectedVersions > 0) throw new Error('当前阅读章节受到保护，请退出本章后删除');
      }
    }
    if (wholeBook) await offline.clearBook(intent.session, current);
    else for (const index of indexes) await offline.clearChapter(intent.session, index, current);
    if (wholeBook) this.projections.set(intent.key, []);
    else {
      const selected = new Set(indexes);
      this.projections.set(intent.key, (this.projections.get(intent.key) ?? []).map(entry => selected.has(entry.index) ?
        { ...entry, downloadState: 'missing' } : entry));
    }
  }

  private async refresh(intent: SharedDownloadIntent, current: () => boolean = (): boolean => this.current(),
    gateway: ReadingOfflineGateway = new ReadingOfflineGateway(this.runtime, undefined, true),
    action: string = 'refresh'): Promise<void> {
    const observer: ReadingOfflineProjectionFailureObserver =
      (failureStage: ReadingOfflineProjectionFailureStage, error: unknown): void => {
        console.warn(`DOWNLOAD_PROJECTION_DIAGNOSTIC action=${this.safeDiagnosticAction(action)} stage=${failureStage}` +
          ` name=${this.projectionFailureName(error)} code=${this.controlFailureCode(error)}`);
      };
    const entries = await gateway.loadDirectoryProjection(intent.session, current, observer);
    if (!current()) return;
    this.projections.set(intent.key, entries);
    this.revisions.set(intent.key, (this.revisions.get(intent.key) ?? 0) + 1); this.publish();
  }
  private mergeProjection(key: string, entries: LocalReadingTocEntry[]): void {
    const byIndex = new Map<number, LocalReadingTocEntry>();
    for (const entry of this.projections.get(key) ?? []) byIndex.set(entry.index, entry);
    for (const entry of entries) byIndex.set(entry.index, entry);
    this.projections.set(key, Array.from(byIndex.values()).sort((left, right) => left.index - right.index));
    this.revisions.set(key, (this.revisions.get(key) ?? 0) + 1);
  }
  private persistedSession(session: RemoteReadingSession): RemoteReadingSession {
    return { ...session, preparedChapter: undefined, identity: { ...session.identity }, book: { ...session.book },
      entries: session.entries.map(entry => ({ ...entry, variables: entry.variables.map(variable => ({ ...variable })) })),
      continuationVariables: session.continuationVariables.map(variable => ({ ...variable })), hostRequirements: session.hostRequirements.slice() };
  }
  private selected(session: RemoteReadingSession, indexes?: number[]): number[] {
    const selected = indexes ?? session.entries.filter(entry => entry.navigable !== false && entry.url.trim() !== '').map(entry => entry.index);
    const readable = this.readableIndexes(session);
    if (selected.some(index => !Number.isSafeInteger(index) || !readable.has(index))) throw new Error('目标章节不可下载，请重新读取目录');
    return this.union([], selected);
  }
  private readableIndexes(session: RemoteReadingSession): Set<number> {
    const indexes = new Set<number>();
    for (const entry of session.entries) if (!Number.isNaN(entry.index) && entry.navigable !== false && entry.url.trim().length > 0)
      indexes.add(entry.index);
    return indexes;
  }
  private catalogByIndex(session: RemoteReadingSession): Map<number, RemoteReadingTocEntry> {
    const entries = new Map<number, RemoteReadingTocEntry>();
    // Keep Array.find's first matching row, including malformed duplicates.
    for (const entry of session.entries) if (!Number.isNaN(entry.index) && !entries.has(entry.index)) entries.set(entry.index, entry);
    return entries;
  }
  private statusByIndex(rows: JsonObject[]): Map<number, JsonObject> {
    const entries = new Map<number, JsonObject>();
    for (const row of rows) {
      const index = row['chapterIndex'];
      if (typeof index === 'number' && !Number.isNaN(index) && !entries.has(index)) entries.set(index, row);
    }
    return entries;
  }
  private union(first: number[], second: number[]): number[] { return Array.from(new Set([...first, ...second])).sort((left, right) => left - right); }
  private key(sourceId: string, bookId: string): string {
    if (sourceId.trim() === '' || bookId.trim() === '') throw new Error('下载书籍归属无效');
    return JSON.stringify([sourceId, bookId]);
  }
  private validate(intent: SharedDownloadIntent): void {
    if (intent.version !== 1 || intent.key !== this.key(intent.book.sourceId, intent.book.bookId) ||
      intent.session.identity.sourceId !== intent.book.sourceId || intent.session.identity.bookId !== intent.book.bookId ||
      !['queued', 'downloading', 'paused', 'completed', 'failed', 'cancelled'].includes(intent.status) ||
      !Array.isArray(intent.requestedIndexes) || !Array.isArray(intent.pausedIndexes) || !Array.isArray(intent.retainedIndexes) ||
      !Array.isArray(intent.preservedRetentions) || intent.preservedRetentions.some(row => !Number.isSafeInteger(row.chapterIndex) ||
        row.chapterIndex < 0 || typeof row.chapterId !== 'string' || row.chapterId.trim() === ''))
      throw new Error('下载记录无法验证，原记录已保留');
    const readable = this.readableIndexes(intent.session), requested = new Set(intent.requestedIndexes);
    if (intent.requestedIndexes.some(index => !readable.has(index)) ||
      intent.retainedIndexes.some(index => !readable.has(index)) ||
      intent.pausedIndexes.some(index => !requested.has(index))) throw new Error('下载记录无法验证，原记录已保留');
  }
  private persist(): Promise<void> {
    const encoded = JSON.stringify(Array.from(this.intents.values()));
    const work = this.writeTail.then((): Promise<void> => this.persistence.save(JSON.parse(encoded) as SharedDownloadIntent[]));
    this.writeTail = work.then((): void => {}, (): void => {});
    return work;
  }
  private serialized<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const prior = this.operations.get(key) ?? Promise.resolve();
    let succeeded = false;
    const work = prior.then(operation).then((value): T => { succeeded = true; return value; });
    const tail = work.then((): void => {}, (): void => {});
    this.operations.set(key, tail);
    void tail.finally((): void => {
      if (this.operations.get(key) === tail) this.operations.delete(key);
      if (succeeded) this.drain();
    });
    return work;
  }
  private async failSubmission(key: string, error: Error): Promise<never> {
    const intent = this.intents.get(key);
    if (intent !== undefined && this.current() && (intent.status === 'queued' || intent.status === 'downloading')) {
      const execution = this.executions.get(key); if (execution !== undefined) execution.valid = false;
      intent.status = 'failed'; intent.error = this.publicFailure(error); intent.updatedAt = Date.now();
      try { await this.persist(); } catch (_) { this.error = '下载记录暂时无法保存，请重试'; }
      this.publish();
    }
    throw error;
  }
  private current(): boolean { try { return !this.closed && this.ownsRuntime(); } catch (_) { return false; } }
  private publicFailure(error: Error): string {
    if (error.message === '当前阅读内容受到保护，请退出本书后删除' ||
      error.message === '当前阅读章节受到保护，请退出本章后删除' ||
      error.message === '目录已变化，原下载已保留；请重新读取目录后重试' ||
      error.message === '目录已变化，目标章节操作已停止，请重新读取目录') return error.message;
    return readingOfflineFailureHint(error) || '下载失败，请重试';
  }
  private assertCurrent(): void { if (!this.current()) throw new Error('下载运行环境已关闭'); }
  private publish(): void {
    if (this.closed || this.listeners.size === 0) return;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      try { listener(snapshot); } catch (_) { /* Observers never own accepted work. */ }
    }
  }
}
