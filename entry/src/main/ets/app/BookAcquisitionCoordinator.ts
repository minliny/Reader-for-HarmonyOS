import { readBookAuthorIdentity, bookAuthorIdentity, bookIdentityText } from '../features/common/BookAuthorMetadata';
import { acquisitionFailureCategoryConfirmed } from '../features/common/BookAcquisitionPresentation';
import type { JsonObject, ReaderCoreResultEvent, RequestOptions } from '@reader/core-harmony';
import { BookRequestScheduler, type BookRequestExecutor, type BookRequestPriority, type BookRequestOptions } from './BookRequestScheduler';
import { errorMessageOf } from './ErrorMessage';
import { ReadingPreparationRunner, decodeReadingPreparationIntents, type ReadingPreparationIntent } from './ReadingPreparationRunner';
import { isRemoteSourceFailureKind, remoteReadingFailureKindOf, RemoteReadingSourceError } from '../features/reading/RemoteContentAdmission';
import { preparedRemoteChapterMatches, withPreparedRemoteChapter } from '../features/reading/RemoteReadingEvidence';
import { readingChapterRetainedBytes, type ReadingSessionChapter } from '../features/reading/ReadingChapterWindow';
import {
  RemoteReadingFlowGateway, type RemoteReadingBookSeed, type RemoteReadingOpenOptions,
  type RemoteReadingSession,
} from '../features/reading/RemoteReadingFlowGateway';
import { decodeRemoteReadingVariables, RemoteReadingGatewayError, classifyRemoteReadingCommandFailure,
  isRemoteReadingCacheRecoveryEligible, remoteReadingFailureRecord,
  type RemoteReadingFailureRecord, type RemoteReadingIdentity } from '../features/reading/RemoteReadingContract';

export interface BookAcquisitionChange {
  reset: boolean;
  identities: RemoteReadingIdentity[];
  shelfChanged?: boolean;
}

const PREPARED_SESSION_LIMIT = 32;
const CACHE_FRESH_MS = 24 * 60 * 60 * 1000;
export interface BookAcquisitionCandidate {
  seed: RemoteReadingBookSeed;
  catalogReady: boolean;
  failed: boolean;
}
export interface BookPreparationOpenOptions extends RemoteReadingOpenOptions {
  preparationRevision?: number;
}
export interface BookCandidateOpenOptions extends BookPreparationOpenOptions {
  /** Only the explicitly opened new-book group validates bodies. Viewport preparation stays catalog-only. */
  requireReadable?: boolean;
  /** The visible catalog is available while the bounded body probe continues. */
  onCatalog?: (session: RemoteReadingSession) => void;
  /** Whole foreground selection budget, including queueing and all candidates. */
  budgetMs?: number;
}
type Preparation = { candidates: BookAcquisitionCandidate[]; scope: number; forceRefresh: boolean };
type BookConsumer = { active: boolean; isCurrent?: () => boolean; canDispatch?: () => boolean };
type BookJob = { promise: Promise<RemoteReadingSession>; priority: BookRequestPriority; forceRefresh: boolean;
  started: boolean; consumers: BookConsumer[]; sourceId: string; bookId: string; preempted: boolean; cancelled: boolean; preparationRevision?: number };
type PreparedSession = { session: RemoteReadingSession; at: number; projectionRevision: number };
type ReadableBookAddition = { active: boolean; promise: Promise<ReaderCoreResultEvent>;
  begin?: Promise<ReaderCoreResultEvent> };

export type BookAcquisitionAdmission = {
  session: RemoteReadingSession;
  /** A refresh started after a fresh cached session was admitted. */
  backgroundRefresh?: Promise<RemoteReadingSession>;
};

export function acquisitionBookKey(sourceId: string, bookId: string): string {
  return JSON.stringify([sourceId, bookId]);
}

function objectValue(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : undefined;
}

/** Process-owned tasks and notifications; all durable book facts live in Core. */
export class BookAcquisitionCoordinator {
  private scheduler: BookRequestScheduler;
  private versions: Map<string, string> = new Map();
  private sourceLoad: Promise<void> | undefined = undefined;
  private sourceLoads: Map<string, Promise<void>> = new Map();
  private knownSources: Set<string> = new Set();
  private registryReady: boolean = false;
  private registryRevision: number = 0;
  private projectionRevision: number = 0;
  private jobs: Map<string, BookJob> = new Map();
  private refreshes: Map<string, BookJob> = new Map();
  private prepared: Map<string, PreparedSession> = new Map();
  private pending: Map<string, Preparation> = new Map();
  private attempted: Set<string> = new Set();
  private preparationActive: number = 0;
  private foregroundRequests: number = 0;
  private preparationVisible: boolean = true;
  private preparationGroups: Set<string> = new Set();
  private scope: number = 0;
  private closed: boolean = false;
  private listeners: Set<(change: BookAcquisitionChange) => void> = new Set();
  private changedIdentities: Map<string, RemoteReadingIdentity> = new Map();
  private changedReset: boolean = false;
  private changedShelf: boolean = false;
  private notifyTimer: number = -1;
  private attemptClock: number = 0;
  private failures: RemoteReadingFailureRecord[] = [];
  private failureIdentities: Map<string, number> = new Map();
  private identityCounter: number = 0;
  private readingPreparations: ReadingPreparationRunner;
  private preparationGeneration: number = 0;
  private preparationMutations: number = 0;
  private preparationRequests: Set<Promise<ReaderCoreResultEvent>> = new Set();
  private preparationRetirementError: Error | undefined = undefined;
  private addingBooks: Map<string, ReadableBookAddition> = new Map();
  private additionEpochs: Map<string, number> = new Map();
  private additionClock: number = 0;

  private execute: BookRequestExecutor;
  private supportsCapability: (capability: string) => boolean;

  constructor(execute: BookRequestExecutor, supportsCapability: (capability: string) => boolean = (): boolean => false) {
    this.execute = execute;
    this.supportsCapability = supportsCapability;
    this.scheduler = new BookRequestScheduler(execute);
    this.readingPreparations = new ReadingPreparationRunner({
      request: (method: string, params: JsonObject, options: BookRequestOptions, priority: BookRequestPriority): Promise<ReaderCoreResultEvent> =>
        this.request(method, params, options, priority),
      add: (intent: ReadingPreparationIntent, current: () => boolean, priority: BookRequestPriority): Promise<ReaderCoreResultEvent> =>
        this.completeReadableAdd(intent, current, priority),
      catalog: async (intent: ReadingPreparationIntent, book: JsonObject, current: () => boolean): Promise<void> => {
        await this.acquireBook(this.preparationSeed(book), { isCurrent: current, canDispatch: current,
          preparationRevision: intent.revision }, 'background');
      },
    });
  }

  subscribe(listener: (change: BookAcquisitionChange) => void): () => void {
    this.listeners.add(listener);
    return (): void => { this.listeners.delete(listener); };
  }

  /** Changes on both sides of a source mutation, including uncertain restore failures. */
  sourceRegistryRevision(): number { return this.registryRevision; }

  readingProjectionRevision(): number { return this.projectionRevision; }

  /** Only reuse the exact Core projection still owned by this coordinator. */
  hasCurrentCatalogProjection(session: RemoteReadingSession): boolean {
    if (this.closed || session.catalogVersion === undefined || session.contextVersion === undefined ||
      this.versions.get(session.identity.sourceId) !== session.sourceVersion) return false;
    const key = JSON.stringify([session.identity.sourceId, session.identity.bookId, session.sourceVersion]);
    const ready = this.prepared.get(key);
    return ready !== undefined && ready.projectionRevision === this.projectionRevision &&
      ready.session.entries === session.entries && ready.session.catalogVersion === session.catalogVersion &&
      ready.session.contextVersion === session.contextVersion &&
      !this.jobs.has(key) && !this.refreshes.has(key);
  }

  private invalidateSourceRegistry(): void {
    this.registryRevision += 1;
    this.registryReady = false;
    this.versions.clear();
    this.knownSources.clear();
    this.prepared.clear();
    this.attempted.clear();
  }

  recentFailures(): RemoteReadingFailureRecord[] { return this.failures.map((record) => ({ ...record })); }

  recordFailure(error: RemoteReadingGatewayError, attemptId: number = this.beginAttempt(),
    context: Partial<RemoteReadingFailureRecord> = {}): void {
    this.failures.push({ ...remoteReadingFailureRecord(error, attemptId), ...context });
    if (this.failures.length > 32) this.failures.shift();
    this.changed();
  }

  async request(method: string, params: JsonObject = {}, options: BookRequestOptions = {},
    priority?: BookRequestPriority): Promise<ReaderCoreResultEvent> {
    if (this.closed) throw new Error('书籍任务已关闭');
    const changesSources = (method === 'source.supply' && (params['operation'] === 'apply' || params['operation'] === 'withdraw')) || method === 'source.import' || method === 'source.update' || method === 'source.delete' ||
      method === 'runtime.storage.apply' || method === 'runtime.storage.restore';
    // Ordinary prefetch fills missing bodies and materializes assets without
    // replacing a cached body. It must not cancel another book's validated
    // chapter handoff or active body admission.
    const changesProjection = changesSources || method === 'reader.chinese-conversion.put' ||
      method === 'replace.persist' || method === 'replace-rule.put' || method === 'replace-rule.delete' ||
      method === 'dict-rule.put' || method === 'dict-rule.delete' || method === 'rule-bundle.import' ||
      method === 'cache.clear' ||
      (method === 'chapter.content' && (params['forceRefresh'] === true || params['upgradeCachedContent'] === true));
    // Cancellation happens before a destructive/configuration request begins.
    // A completed clear/remove must never restart this optional acquisition.
    const changesAddedBook = changesProjection || method === 'replace.undo' || method === 'replace-rule.create' ||
      method === 'replace-rule.update' || method === 'bookshelf.remove' || method === 'bookshelf.removeBatch' ||
      (method.startsWith('source.switch.') && method !== 'source.switch.pending.list');
    if (changesAddedBook) {
      this.preparationMutations += 1;
      this.preparationGeneration += 1;
      this.readingPreparations.suspend();
      this.scheduler.visibilityChanged();
    }
    if (changesProjection) this.projectionRevision += 1;
    if (changesSources) { this.invalidateSourceRegistry(); this.changed(true); }
    const registryAtStart = this.registryRevision;
    let foregroundRequest = false;
    try {
      if (changesAddedBook) {
        if (this.preparationRetirementError !== undefined) throw this.preparationRetirementError;
        try { await this.scheduler.settleCancelledRequests(Array.from(this.preparationRequests)); }
        catch (_) {
          this.preparationRetirementError = new Error('后台书籍请求尚未确认终止，已保留数据，请重新打开应用后重试清理');
          throw this.preparationRetirementError;
        }
      }
      const sourceId = typeof params['sourceId'] === 'string' ? params['sourceId'] as string : '';
      const network = method === 'book.search' || method === 'book.detail' || method === 'book.toc' ||
        method === 'chapter.content' || method === 'cache.book.prefetch' || method === 'change.bookSource';
      const actualPriority = priority ?? (method === 'book.search' || method === 'change.bookSource' ? 'search' : 'foreground');
      foregroundRequest = network && actualPriority === 'foreground';
      if (foregroundRequest) {
        this.foregroundRequests += 1;
        const bookId = params['bookId'] ?? objectValue(params['book'])?.['bookId'];
        this.preemptBackgroundAcquisitions(sourceId, typeof bookId === 'string' ? bookId : '');
      }
      // Cached-only preparation also consumes the single Core/SQLite resource.
      // A background label must reach the scheduler, not bypass it merely
      // because this work has no HTTP. Keep ordinary writes out of deduplication.
      const scheduled = network || (actualPriority === 'background' &&
        (method === 'reading.entry.prepare' || method === 'reading.entry.snapshot' || method === 'reading.preparation' ||
          method === 'bookshelf.get' || method === 'bookshelf.list'));
      const operation = scheduled ? this.scheduler.request(method, params, options,
        this.versions.get(sourceId) ?? '', actualPriority) : this.execute(method, params, options);
      if (network && typeof params['preparationRevision'] === 'number') {
        this.preparationRequests.add(operation);
        void operation.then((): void => { this.preparationRequests.delete(operation); }, (error: Error): void => {
          // Keep an uncertain terminal result available to the cleanup fence.
          const event = (error as Error & { event?: { type?: string; requestId?: number } }).event;
          const terminal = error.name === 'ReaderCoreRequestError' && event?.type === 'error' && Number.isSafeInteger(event.requestId);
          if (terminal || /^Reader-Core request (cancelled by caller|timed out): \d+$/.test(error.message))
            this.preparationRequests.delete(operation);
        });
      }
      const result = await operation;
      if (method === 'source.list' && registryAtStart === this.registryRevision) {
        const exactSource = typeof params['sourceId'] === 'string' ? params['sourceId'] as string : undefined;
        if (exactSource !== undefined) {
          const rows = result.data['sources'];
          if (!Array.isArray(rows) || rows.length > 1 ||
            (rows.length === 1 && objectValue(rows[0])?.['sourceId'] !== exactSource)) {
            throw new RemoteReadingGatewayError('invalidResponse', 'source.list returned a different source identity', 'source.list');
          }
          this.versions.delete(exactSource);
        }
        this.observeSources(result.data, params['enabledOnly'] !== true && exactSource === undefined);
        if (exactSource !== undefined && Array.isArray(result.data['sources'])) this.knownSources.add(exactSource);
      }
      if (method === 'book.toc' && result.data['catalogInstalled'] !== false) {
        const book = objectValue(params['book']);
        const bookId = params['bookId'] ?? book?.['bookId'];
        if (typeof bookId === 'string') {
          for (const [key, ready] of this.prepared) {
            // A detail alone is never a replacement for a complete session.
            // Our own refresh publishes its new session only after the whole
            // gateway has validated it. An external TOC invalidates projection.
            if (ready.session.identity.sourceId === sourceId && ready.session.identity.bookId === bookId &&
              !this.jobs.has(key) && !this.refreshes.has(key)) this.prepared.delete(key);
          }
        }
      }
      if (method === 'book.search' || method === 'book.detail' || method === 'book.toc' ||
        method === 'search-book.put' || method === 'search-book.delete' || method === 'change.bookSource') {
        this.observeChangedBooks(method, params, result.data);
        this.changed();
      }
      if (method === 'bookshelf.add') {
        this.changedShelf = true;
        this.observeChangedBooks(method, params, result.data);
        this.changed();
      }
      return result;
    } finally {
      if (changesAddedBook) {
        this.preparationGeneration += 1;
        this.preparationMutations -= 1;
      }
      if (foregroundRequest) {
        this.foregroundRequests -= 1;
        this.scheduler.visibilityChanged();
        this.drainPreparations();
      }
      if (changesProjection) this.projectionRevision += 1;
      if (changesSources) { this.invalidateSourceRegistry(); this.changed(true); }
    }
  }

  beginSearch(): void {
    this.scope += 1;
    this.pending.clear();
    this.attempted.clear();
    this.preparationGroups.clear();
    this.preparationVisible = true;
    this.scheduler.visibilityChanged();
  }

  endSearch(): void {
    this.scope += 1;
    this.pending.clear();
    this.preparationGroups.clear();
    this.preparationVisible = false;
    this.scheduler.visibilityChanged();
    // Shared consumers retain their work; requests with no live consumer cancel.
  }

  visibilityChanged(): void { this.scheduler.visibilityChanged(); }

  /** Explicit add succeeds only after Core confirms a locally readable body. */
  addReadableBook(book: JsonObject): Promise<ReaderCoreResultEvent> {
    const seed = this.preparationSeed(book);
    if (seed.sourceId === 'local') return this.request('bookshelf.add', book);
    const key = acquisitionBookKey(seed.sourceId, seed.bookId);
    const existing = this.addingBooks.get(key);
    if (existing?.active === true) return existing.promise;
    const addition: ReadableBookAddition = { active: true, promise: Promise.resolve(undefined as unknown as ReaderCoreResultEvent) };
    const additionEpoch = ++this.additionClock;
    this.additionEpochs.set(key, additionEpoch);
    const generation = this.preparationGeneration;
    const current = (): boolean => !this.closed && this.preparationMutations === 0 &&
      generation === this.preparationGeneration && this.preparationRetirementError === undefined && addition.active &&
      this.additionEpochs.get(key) === additionEpoch;
    const run = async (): Promise<ReaderCoreResultEvent> => {
      if (!current()) throw new RemoteReadingGatewayError('cancelled', '书籍准备已取消');
      // Publish the begin owner before dispatch, including reentrant adapters.
      // Cancel waits for this metadata request only, never for chapter HTTP.
      addition.begin = Promise.resolve().then((): Promise<ReaderCoreResultEvent> => {
        if (!current()) throw new RemoteReadingGatewayError('cancelled', '书籍准备已取消');
        return this.request('reading.preparation', { action: 'begin', sourceId: seed.sourceId,
          bookId: seed.bookId, reason: 'add', pendingAdd: book });
      });
      const result = await addition.begin;
      const intent = decodeReadingPreparationIntents(result.data).find((row: ReadingPreparationIntent): boolean =>
        row.sourceId === seed.sourceId && row.bookId === seed.bookId && row.state === 'active');
      if (intent === undefined) throw new Error('READING_PREPARATION_ADD_INTENT_MISSING');
      try { return await this.completeReadableAdd(intent, current, 'foreground'); }
      catch (error) { await this.readingPreparations.block(intent, error as Error, current); throw error; }
    };
    addition.promise = Promise.resolve().then(run).finally((): void => {
      if (this.addingBooks.get(key) === addition) this.addingBooks.delete(key);
    });
    this.addingBooks.set(key, addition);
    return addition.promise;
  }

  async cancelReadableBook(sourceId: string, bookId: string): Promise<void> {
    if (sourceId.trim().length === 0 || bookId.trim().length === 0) throw new Error('READING_PREPARATION_INVALID_BOOK');
    const key = acquisitionBookKey(sourceId, bookId);
    const addition = this.addingBooks.get(key);
    if (addition !== undefined) addition.active = false;
    const cancellationEpoch = ++this.additionClock;
    this.additionEpochs.set(key, cancellationEpoch);
    this.scheduler.visibilityChanged();
    let uncertainBegin: Error | undefined;
    if (addition?.begin !== undefined) {
      try { await addition.begin; }
      catch (error) {
        const failure = error as Error;
        const event = (failure as Error & { event?: { type?: string; requestId?: number } }).event;
        const terminal = failure.name === 'ReaderCoreRequestError' && event?.type === 'error' && Number.isSafeInteger(event.requestId);
        if (!(failure instanceof RemoteReadingGatewayError && failure.code === 'cancelled') && !terminal &&
          !/^Reader-Core request (cancelled by caller|timed out): \d+$/.test(failure.message)) uncertainBegin = failure;
      }
    }
    // A competing strict add or failure can advance the revision once while
    // cancellation is dispatched. Re-read its fact; never cancel read intent.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (this.additionEpochs.get(key) !== cancellationEpoch) return;
      const status = await this.request('reading.preparation', { action: 'status', sourceId, bookId });
      if (this.additionEpochs.get(key) !== cancellationEpoch) return;
      const intent = decodeReadingPreparationIntents(status.data).find((row: ReadingPreparationIntent): boolean =>
        row.sourceId === sourceId && row.bookId === bookId);
      if (intent === undefined) {
        if (uncertainBegin !== undefined) throw new Error('入架请求终止状态尚未确认，请稍后重试取消');
        return;
      }
      if (intent.reason !== 'add' || intent.pendingAdd === undefined || intent.state === 'cancelled') return;
      try {
        await this.request('reading.preparation', { action: 'cancel', sourceId, bookId, revision: intent.revision });
        return;
      } catch (error) { if (attempt > 0) throw error; }
    }
  }

  resumeReadingPreparations(allowed: () => boolean,
    allowCatalogAcquisition: () => boolean = (): boolean => true): Promise<void> {
    if (!this.supportsCapability('reading.preparation.v1')) return Promise.resolve();
    return this.readingPreparations.resume((): boolean => allowed() && !this.closed &&
      this.preparationMutations === 0 && this.preparationRetirementError === undefined && this.foregroundRequests === 0,
      allowCatalogAcquisition);
  }

  private preparationSeed(book: JsonObject): RemoteReadingBookSeed {
    const sourceId = book['sourceId'], bookId = book['bookId'], title = book['title'], author = book['author'];
    if (typeof sourceId !== 'string' || sourceId.trim().length === 0 || typeof bookId !== 'string' ||
      bookId.trim().length === 0 || typeof title !== 'string' || title.trim().length === 0 || typeof author !== 'string')
      throw new Error('READING_PREPARATION_INVALID_BOOK');
    return { sourceId, bookId, title, author, detailUrl: bookId,
      coverUrl: typeof book['coverUrl'] === 'string' ? book['coverUrl'] as string : undefined,
      intro: typeof book['intro'] === 'string' ? book['intro'] as string : undefined,
      kind: typeof book['kind'] === 'string' ? book['kind'] as string : undefined,
      lastChapter: typeof book['lastChapter'] === 'string' ? book['lastChapter'] as string : undefined };
  }

  private async completeReadableAdd(intent: ReadingPreparationIntent, current: () => boolean,
    priority: BookRequestPriority): Promise<ReaderCoreResultEvent> {
    const key = acquisitionBookKey(intent.sourceId, intent.bookId);
    const epoch = this.additionEpochs.get(key);
    const ownerCurrent = current;
    current = (): boolean => ownerCurrent() && this.additionEpochs.get(key) === epoch;
    const book = intent.pendingAdd;
    if (book === undefined) throw new Error('READING_PREPARATION_PENDING_ADD_MISSING');
    const options: BookPreparationOpenOptions = { isCurrent: current, canDispatch: current,
      preparationRevision: intent.revision };
    const session = await this.acquireBook(this.preparationSeed(book), options, priority);
    this.assertCandidateCurrent(options, Number.POSITIVE_INFINITY);
    const readable = await this.verifyCandidateBody(session, options, priority);
    this.assertCandidateCurrent(options, Number.POSITIVE_INFINITY);
    const chapterIndex = readable.preparedChapter?.chapter.chapterIndex;
    if (chapterIndex === undefined) throw new Error('READING_PREPARATION_READABLE_BODY_MISSING');
    const prepared = await this.request('reading.entry.prepare', { sourceId: intent.sourceId, bookId: intent.bookId,
      chapterIndex, neighborOffset: 0 }, { shouldCancel: (): boolean => !current(), canContinue: current, canDispatch: current }, priority);
    this.assertCandidateCurrent(options, Number.POSITIVE_INFINITY);
    if (prepared.data['sourceId'] !== intent.sourceId || prepared.data['bookId'] !== intent.bookId ||
      prepared.data['chapterIndex'] !== chapterIndex || prepared.data['kind'] !== 'ready')
      throw new Error(`READING_PREPARATION_ADD_NOT_READY:${prepared.data['reason'] ?? 'invalidResult'}`);
    return this.request('bookshelf.add', { ...book, requireReadable: true, preparationRevision: intent.revision },
      { shouldCancel: (): boolean => !current(), canContinue: current, canDispatch: current }, priority);
  }

  prepare(seeds: RemoteReadingBookSeed[], forceRefresh: boolean = false): void {
    this.prepareGroups(seeds.slice(0, 6).map((seed): BookAcquisitionCandidate[] =>
      [{ seed, catalogReady: false, failed: false }]), forceRefresh);
  }

  /** Only the visible book groups own speculative catalog work; never fetch bodies. */
  prepareGroups(groups: BookAcquisitionCandidate[][], forceRefresh: boolean = false): void {
    this.pending.clear();
    this.preparationGroups.clear();
    for (const candidates of groups.slice(0, 6)) {
      if (candidates.length === 0 || candidates[0].seed.sourceId === 'local') continue;
      const key = JSON.stringify(candidates.map((candidate: BookAcquisitionCandidate): string =>
        JSON.stringify([candidate.seed.sourceId, candidate.seed.bookId, candidate.seed.sourceVersion])));
      this.preparationGroups.add(key);
      if (!forceRefresh && this.attempted.has(key)) continue;
      this.pending.set(key, { candidates, scope: this.scope, forceRefresh });
    }
    this.scheduler.visibilityChanged();
    this.drainPreparations();
  }

  setPreparationVisible(visible: boolean): void {
    this.preparationVisible = visible;
    this.scheduler.visibilityChanged();
    if (visible) this.drainPreparations();
  }

  /** Business fallback for an admitted same-book group, never for a fixed shelf identity. */
  async acquireCandidateGroup(candidates: BookAcquisitionCandidate[], options: BookCandidateOpenOptions = {},
    priority: BookRequestPriority = 'foreground'): Promise<BookAcquisitionAdmission> {
    const deadline = priority === 'background' ? Number.POSITIVE_INFINITY :
      Date.now() + Math.max(1, options.budgetMs ?? 45000);
    const isCurrent = (): boolean => !this.closed && options.isCurrent?.() !== false && Date.now() < deadline;
    const actualOptions: RemoteReadingOpenOptions = { ...options, isCurrent };
    const primary = candidates[0]?.seed;
    const normalize = bookIdentityText;
    const title = normalize(primary?.title ?? '');
    const author = bookAuthorIdentity(primary?.author ?? '', primary?.authorIdentity, primary?.sourceVersion);
    const seen = new Set<string>();
    const ordered = candidates.slice().sort((a: BookAcquisitionCandidate, b: BookAcquisitionCandidate): number =>
      (a.failed ? 2 : a.catalogReady ? 0 : 1) - (b.failed ? 2 : b.catalogReady ? 0 : 1));
    let unverifiedAttempts = 0;
    let failure: Error = new Error('没有可用的同书候选');
    for (const candidate of ordered) {
      this.assertCandidateCurrent(options, deadline);
      // A display grouping is not proof of identity. In particular, blank
      // authors cannot authorize automatic substitution between sources.
      if (primary !== undefined && (candidate.seed.sourceId !== primary.sourceId || candidate.seed.bookId !== primary.bookId) &&
        (author.length === 0 || normalize(candidate.seed.title) !== title || bookAuthorIdentity(candidate.seed.author, candidate.seed.authorIdentity, candidate.seed.sourceVersion) !== author)) continue;
      const key = acquisitionBookKey(candidate.seed.sourceId, candidate.seed.bookId);
      if (seen.has(key)) continue;
      seen.add(key);
      if (priority === 'background' && candidate.failed && !options.forceRefresh) continue;
      if (priority === 'background' && !candidate.catalogReady && unverifiedAttempts >= 3) continue;
      if (!candidate.catalogReady) unverifiedAttempts += 1;
      try {
        let admission = await this.waitForCandidate(this.acquireBookWithBackgroundRefresh(candidate.seed, actualOptions, priority), options, deadline);
        this.assertCandidateCurrent(options, deadline);
        if (normalize(admission.session.book.title) !== title ||
          (author.length > 0 && bookAuthorIdentity(admission.session.book.author, admission.session.book.authorIdentity, admission.session.sourceVersion) !== author)) {
          throw new RemoteReadingGatewayError('invalidResponse', '详情书名或作者与所选书籍不一致', 'book.detail');
        }
        options.onCatalog?.(admission.session);
        if (options.requireReadable === true) {
          const session = await this.waitForCandidate(this.verifyCandidateBody(admission.session, actualOptions, priority), options, deadline);
          admission = { ...admission, session };
        }
        this.assertCandidateCurrent(options, deadline);
        return admission;
      } catch (error) {
        this.assertCandidateCurrent(options, deadline);
        if (!(error instanceof RemoteReadingGatewayError) || !this.canTryAnotherCandidate(error)) throw error;
        failure = error;
      }
    }
    throw failure;
  }

  private canTryAnotherCandidate(error: RemoteReadingGatewayError): boolean {
    if (error.category === 'NETWORK_ENVIRONMENT') return false;
    // Contract/storage/cancellation failures are never masked by another source.
    if (['cancelled', 'identityMismatch', 'sourceVersionChanged', 'storageFailure', 'positionContextStale'].includes(error.code)) return false;
    if (error.capability !== undefined || error.code === 'unsupportedHostCapability') return true;
    return error.code === 'emptyToc' || error.code === 'missingTocUrl' ||
      (error.command === 'chapter.content' && isRemoteSourceFailureKind(remoteReadingFailureKindOf(error))) ||
      ((error.command === 'book.detail' || error.command === 'book.toc') &&
        (error.code === 'commandFailed' || error.code === 'invalidResponse'));
  }

  private assertCandidateCurrent(options: BookCandidateOpenOptions, deadline: number): void {
    if (this.closed || options.isCurrent?.() === false) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    if (Date.now() >= deadline) throw new RemoteReadingGatewayError('cancelled', '验证可用书源超时，已保留已获取的目录，请重试或手动选择书源');
  }

  private async waitForCandidate<T>(operation: Promise<T>, options: BookCandidateOpenOptions, deadline: number): Promise<T> {
    let timer: number = -1;
    const cancelled = new Promise<T>((_resolve, reject): void => {
      const check = (): void => {
        try { this.assertCandidateCurrent(options, deadline); }
        catch (error) { reject(error); return; }
        timer = setTimeout(check, Math.min(100, Math.max(1, deadline - Date.now())));
      };
      check();
    });
    try { return await Promise.race([operation, cancelled]); }
    finally { if (timer >= 0) clearTimeout(timer); }
  }

  private async verifyCandidateBody(session: RemoteReadingSession, options: BookPreparationOpenOptions,
    priority: BookRequestPriority): Promise<RemoteReadingSession> {
    const revision = this.readingProjectionRevision();
    if (preparedRemoteChapterMatches(session.preparedChapter, session, undefined, revision)) return session;
    const isCurrent = (): boolean => options.isCurrent?.() !== false && revision === this.readingProjectionRevision();
    const gateway = new RemoteReadingFlowGateway({ bookAcquisitions: (): BookAcquisitionCoordinator => this,
      supportsCoreCapability: (capability: string): boolean => this.supportsCapability(capability),
      request: (method: string, params: JsonObject = {}, requestOptions: RequestOptions = {}): Promise<ReaderCoreResultEvent> =>
        this.request(method, this.withPreparationRevision(method, params, options.preparationRevision), { ...requestOptions, canContinue: isCurrent,
          canDispatch: options.canDispatch }, priority) });
    const entries = session.entries.filter((entry): boolean => entry.url.trim().length > 0).slice(0, 3);
    for (let index = 0; index < entries.length; index += 1) {
      try {
        const chapter = await gateway.loadChapter(session, entries[index].index, isCurrent);
        if (!isCurrent()) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
        const admitted = withPreparedRemoteChapter(session, chapter, revision);
        // Search validation, detail, add-to-shelf and reading must share the
        // exact admitted body, not just the earlier catalog-only session.
        // A concurrent catalog publication must never be overwritten here.
        const key = JSON.stringify([session.identity.sourceId, session.identity.bookId, session.sourceVersion]);
        const ready = this.prepared.get(key);
        if (ready !== undefined && ready.projectionRevision === revision &&
          ready.session.entries === session.entries && ready.session.catalogVersion === session.catalogVersion &&
          ready.session.contextVersion === session.contextVersion &&
          this.versions.get(session.identity.sourceId) === session.sourceVersion && this.canRetainPreparedBody(key, chapter)) {
          this.prepared.set(key, { ...ready, session: admitted });
        }
        return admitted;
      } catch (error) {
        if (!isCurrent()) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
        if (remoteReadingFailureKindOf(error) === 'SOURCE_CONTENT_EMPTY' && index + 1 < entries.length) continue;
        throw error;
      }
    }
    throw new RemoteReadingSourceError('SOURCE_CONTENT_EMPTY', '目录没有可验证的正文章节', 'chapter.content');
  }

  private canRetainPreparedBody(key: string, chapter: ReadingSessionChapter): boolean {
    let bytes = readingChapterRetainedBytes(chapter);
    if (bytes > 1024 * 1024) return false;
    for (const [otherKey, ready] of this.prepared) {
      const body = ready.session.preparedChapter?.chapter;
      if (otherKey !== key && body !== undefined) bytes += readingChapterRetainedBytes(body);
      if (bytes > 4 * 1024 * 1024) return false;
    }
    return true;
  }

  async acquireBook(seed: RemoteReadingBookSeed, options: BookPreparationOpenOptions = {},
    priority: BookRequestPriority = 'foreground'): Promise<RemoteReadingSession> {
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    if (priority === 'foreground') this.preemptBackgroundAcquisitions(seed.sourceId, seed.bookId);
    // Register a known-source join before yielding: another caller may leave
    // in this same turn, but must not orphan a request this caller now needs.
    if (!this.registryReady) await this.ensureSources(seed.sourceId);
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    const version = this.versions.get(seed.sourceId);
    const cacheKey = JSON.stringify([seed.sourceId, seed.bookId, version]);
    const key = options.preparationRevision === undefined ? cacheKey : JSON.stringify([seed.sourceId, seed.bookId, version, options.preparationRevision]);
    const ready = this.prepared.get(cacheKey);
    if (!options.forceRefresh && ready !== undefined && Date.now() - ready.at < CACHE_FRESH_MS) {
      const session = this.withCatalogFreshness(ready.session);
      this.prepared.delete(cacheKey);
      this.prepared.set(cacheKey, { ...ready, session });
      return session;
    }
    const consumer: BookConsumer = { active: true, isCurrent: options.isCurrent, canDispatch: options.canDispatch };
    const jobs = options.forceRefresh ? this.refreshes : this.jobs;
    let job = jobs.get(key) ?? (!options.forceRefresh ? this.refreshes.get(key) : undefined);
    if (job !== undefined && this.bookJobCancelled(job)) {
      await this.waitForCandidate(job.promise.catch((_error: Error): void => {}), options, Number.POSITIVE_INFINITY);
      return this.acquireBook(seed, options, priority);
    }
    if (options.forceRefresh && job === undefined && this.jobs.has(key)) {
      // A cache admission cannot satisfy forceRefresh. Its complete session
      // remains owned by its existing consumers; then start/join real refresh.
      await this.waitForCandidate(this.jobs.get(key)?.promise.catch((_error: Error): void => {}) ??
        Promise.resolve(), options, Number.POSITIVE_INFINITY);
      return this.acquireBook(seed, options, priority);
    }
    if (priority === 'foreground') {
      if (job !== undefined) job.priority = priority;
    }
    if (job !== undefined) {
      job.consumers.push(consumer);
      if (priority === 'foreground') this.scheduler.promote(seed.sourceId, seed.bookId);
      this.scheduler.visibilityChanged();
      return this.consumeJob(job, consumer);
    }
    const next: BookJob = { priority, forceRefresh: options.forceRefresh === true,
      started: false, consumers: [consumer], sourceId: seed.sourceId, bookId: seed.bookId, preempted: false, cancelled: false,
      preparationRevision: options.preparationRevision,
      promise: Promise.resolve(undefined as unknown as RemoteReadingSession) };
    // The process shares one detail→TOC chain only while a real consumer owns it.
    // Starting a request does not grant it a lifetime beyond every caller.
    const projectionAtStart = this.projectionRevision;
    next.promise = this.openBook(seed, version, next, options.forceRefresh === true)
      .then((session: RemoteReadingSession): RemoteReadingSession => {
        if (this.versions.get(seed.sourceId) === version && !this.bookJobCancelled(next)) {
          this.prepared.set(cacheKey, { session, at: Date.now(), projectionRevision: projectionAtStart });
          while (this.prepared.size > PREPARED_SESSION_LIMIT) {
            const oldest = this.prepared.keys().next().value;
            if (oldest !== undefined) this.prepared.delete(oldest);
          }
        }
        return session;
      }).finally((): void => {
        if (jobs.get(key) === next) jobs.delete(key);
        this.scheduler.visibilityChanged();
        this.drainPreparations();
      });
    jobs.set(key, next);
    return this.consumeJob(next, consumer);
  }

  private async consumeJob(job: BookJob, consumer: BookConsumer): Promise<RemoteReadingSession> {
    try {
      const session = await this.waitForCandidate(job.promise,
        { isCurrent: consumer.isCurrent }, Number.POSITIVE_INFINITY);
      if (this.closed || consumer.isCurrent?.() === false) {
        throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
      }
      return session;
    } finally {
      consumer.active = false;
      this.scheduler.visibilityChanged();
    }
  }

  private bookJobCancelled(job: BookJob): boolean {
    if (this.closed || job.preempted || job.cancelled) return true;
    if (!job.consumers.some((consumer: BookConsumer): boolean =>
      consumer.active && consumer.isCurrent?.() !== false)) {
      job.cancelled = true;
      return true;
    }
    return false;
  }

  private preemptBackgroundAcquisitions(sourceId: string, bookId: string): void {
    for (const jobs of [this.jobs, this.refreshes]) {
      for (const job of jobs.values()) {
        if (this.bookJobCancelled(job) || job.priority !== 'background') continue;
        if (job.sourceId === sourceId && job.bookId === bookId) {
          job.priority = 'foreground';
          this.scheduler.promote(sourceId, bookId);
        } else if (job.started) {
          // Unlike navigation detachment, a foreground preemption explicitly
          // cancels speculative Core/JS work so the reading lane is released.
          job.preempted = true;
        }
      }
    }
    this.scheduler.visibilityChanged();
  }

  private hasForegroundAcquisition(): boolean {
    if (this.foregroundRequests > 0) return true;
    for (const jobs of [this.jobs, this.refreshes]) {
      for (const job of jobs.values()) if (!this.bookJobCancelled(job) && job.priority === 'foreground') return true;
    }
    return false;
  }

  private withCatalogFreshness(session: RemoteReadingSession): RemoteReadingSession {
    const at = session.catalogAt;
    const now = Date.now();
    const refreshRecommended = at === undefined || !Number.isFinite(at) || at > now || now - at >= CACHE_FRESH_MS;
    return session.refreshRecommended === refreshRecommended ? session : { ...session, refreshRecommended };
  }

  /**
   * Admit the fastest known session and refresh it in the background only
   * when the admitted catalog recommends a refresh. Keeping this decision in
   * the process coordinator prevents page layers from peeking at cache state.
   */
  async acquireBookWithBackgroundRefresh(seed: RemoteReadingBookSeed,
    options: RemoteReadingOpenOptions = {}, priority: BookRequestPriority = 'foreground'):
    Promise<BookAcquisitionAdmission> {
    if (!this.registryReady) await this.ensureSources(seed.sourceId);
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    const version = this.versions.get(seed.sourceId);
    const session = await this.acquireBook(seed, options, priority);
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    if (session.refreshRecommended !== true || options.forceRefresh || this.closed || version === undefined) return { session };
    const backgroundRefresh = this.acquireBook(seed,
      { forceRefresh: true, isCurrent: options.isCurrent, canDispatch: options.canDispatch }, 'background');
    // The process owns failure recording even if its page/viewport subscriber
    // has gone away. Keep the original promise rejectable for active callers.
    void backgroundRefresh.catch((_error: Error): void => {});
    return { session, backgroundRefresh };
  }

  async currentSourceVersion(sourceId: string): Promise<string | undefined> {
    await this.ensureSources(sourceId);
    return this.versions.get(sourceId);
  }

  beginAttempt(): number {
    this.attemptClock = Math.max(Date.now(), this.attemptClock + 1);
    return this.attemptClock;
  }

  async reportVerdict(session: RemoteReadingSession, chapterIndex: number, chapterUrl: string,
    contentVersion: string, bodyVersion: string | undefined, processingVersion: string | undefined,
    message?: string, checkedAt: number = this.beginAttempt()): Promise<void> {
    const version = session.sourceVersion;
    if (version === undefined || version.length === 0 || session.acquisitionMode === 'offline' ||
      session.catalogVersion === undefined || session.contextVersion === undefined ||
      bodyVersion === undefined || processingVersion === undefined) return;
    const acquisition: JsonObject = { schemaVersion: 2, sourceVersion: version,
      catalogVersion: session.catalogVersion, contextVersion: session.contextVersion,
      chapterIndex, chapterUrl, contentVersion, projectionVersion: 'reader-document-v1',
      bodyVersion, processingVersion,
      stage: message === undefined ? 'readable' : 'failed', checkedAt };
    if (message !== undefined) { acquisition['message'] = message; acquisition['failureStage'] = 'chapter'; }
    await this.request('search-book.put', { origin: session.identity.sourceId, bookUrl: session.identity.bookId, acquisition });
  }

  close(): void {
    this.closed = true;
    this.preparationGeneration += 1;
    this.readingPreparations.close();
    this.scope += 1;
    this.pending.clear();
    this.scheduler.close();
    this.prepared.clear();
    this.jobs.clear();
    this.refreshes.clear();
    this.listeners.clear();
    this.failureIdentities.clear();
    if (this.notifyTimer >= 0) clearTimeout(this.notifyTimer);
    this.notifyTimer = -1;
  }

  private withPreparationRevision(method: string, params: JsonObject, revision: number | undefined): JsonObject {
    return revision !== undefined && (method === 'book.detail' || method === 'book.toc' || method === 'chapter.content' ||
      method === 'cache.book.prefetch') ? { ...params, preparationRevision: revision } : params;
  }

  private async openBook(seed: RemoteReadingBookSeed, version: string | undefined, job: BookJob,
    forceRefresh: boolean): Promise<RemoteReadingSession> {
    const attemptId = this.beginAttempt();
    const started = Date.now();
    const identityKey = acquisitionBookKey(seed.sourceId, seed.bookId);
    let identityRef = this.failureIdentities.get(identityKey);
    if (identityRef === undefined) {
      identityRef = ++this.identityCounter;
      this.failureIdentities.set(identityKey, identityRef);
      if (this.failureIdentities.size > PREPARED_SESSION_LIMIT) {
        const oldest = this.failureIdentities.keys().next().value;
        if (oldest !== undefined) this.failureIdentities.delete(oldest);
      }
    }
    const failureContext = (cacheDecision: RemoteReadingFailureRecord['cacheDecision']): Partial<RemoteReadingFailureRecord> => ({
      identityRef, ruleVersion: version !== undefined && /^[a-f0-9]{64}$/i.test(version) ? version : undefined,
      elapsedMs: Math.max(0, Date.now() - started), cacheDecision,
    });
    const stored = await this.request('search-book.get', { origin: seed.sourceId, bookUrl: seed.bookId });
    const row = objectValue(stored.data['book']);
    if ((typeof row?.['origin'] === 'string' && row['origin'] !== seed.sourceId) ||
      (typeof row?.['bookUrl'] === 'string' && row['bookUrl'] !== seed.bookId)) {
      throw new RemoteReadingGatewayError('identityMismatch', 'search-book.get returned a different identity');
    }
    const facts = objectValue(row?.['acquisition']);
    const current = version !== undefined && facts?.['sourceVersion'] === version;
    const actual: RemoteReadingBookSeed = { sourceId: seed.sourceId, bookId: seed.bookId,
      detailUrl: seed.detailUrl, title: current && typeof row?.['name'] === 'string' ? row['name'] as string : seed.title,
      author: current && typeof row?.['author'] === 'string' ? row['author'] as string : seed.author,
      coverUrl: current && typeof row?.['coverUrl'] === 'string' ? row['coverUrl'] as string : seed.coverUrl,
      intro: current && typeof row?.['intro'] === 'string' ? row['intro'] as string : seed.intro,
      kind: current && typeof row?.['kind'] === 'string' ? row['kind'] as string : seed.kind,
      lastChapter: current && typeof row?.['latestChapterTitle'] === 'string' ? row['latestChapterTitle'] as string : seed.lastChapter,
      searchVariables: version !== undefined && seed.sourceVersion === version ? seed.searchVariables : [],
      sourceVersion: version };
    actual.authorIdentity = readBookAuthorIdentity(current ? facts?.['authorIdentity'] : seed.authorIdentity, actual.author, version);
    let storedVariablesValid = true;
    if (current && typeof row?.['variable'] === 'string') {
      try {
        actual.searchVariables = decodeRemoteReadingVariables(
          JSON.parse(row['variable'] as string),
          'search-book.get',
          true,
        );
      } catch (_) {
        // A legacy or partially-written continuation is a cache miss, not a
        // permanent book-open failure. The fresh detail response replaces it.
        storedVariablesValid = false;
        actual.searchVariables = seed.sourceVersion === version ? seed.searchVariables : [];
      }
    }
    const processCurrent = (): boolean => !this.bookJobCancelled(job) && this.versions.get(seed.sourceId) === version;
    const isCurrent = (): boolean => processCurrent();
    const canDispatch = (): boolean => (job.priority !== 'background' || !this.hasForegroundAcquisition()) &&
      (job.started || job.consumers.some((consumer: BookConsumer): boolean =>
      consumer.active && consumer.isCurrent?.() !== false && consumer.canDispatch?.() !== false));
    const gateway = new RemoteReadingFlowGateway({
      request: (method: string, params?: JsonObject, options?: RequestOptions): Promise<ReaderCoreResultEvent> =>
        this.request(method, this.withPreparationRevision(method, params ?? {}, job.preparationRevision), { ...options, shouldCancel: (): boolean => !isCurrent(),
          canContinue: processCurrent, canDispatch, onDispatch: (): void => { job.started = true; } }, job.priority),
    });
    let cacheFailure: RemoteReadingGatewayError | undefined;
    if (!forceRefresh) {
      try {
        const contextIsCurrent = current && storedVariablesValid && typeof facts?.['catalogAt'] === 'number';
        const cached = contextIsCurrent ? await gateway.openCachedCatalogSession(actual, isCurrent, true) :
          await gateway.openCachedSession(actual, isCurrent);
        if (this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消', 'cache.book.status');
        if (this.bookJobCancelled(job)) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消', 'cache.book.status');
        if (!isCurrent()) throw new RemoteReadingGatewayError('sourceVersionChanged', '书源规则已更新，请重试', 'cache.book.status');
        return this.withCatalogFreshness({ ...cached, sourceVersion: version,
          catalogAt: cached.catalogAt ?? (typeof facts?.['catalogAt'] === 'number' ? facts['catalogAt'] as number : undefined),
          requiresContextRefresh: (!contextIsCurrent || cached.requiresContextRefresh === true) && version !== undefined });
      } catch (error) {
        if (this.bookJobCancelled(job)) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
        const classified = classifyRemoteReadingCommandFailure('cache.book.status', error);
        this.recordFailure(classified, attemptId, failureContext(classified.code === 'cachedSessionUnavailable' ? 'miss' : classified.code === 'cacheDerivedCorrupt' ? 'derivedCorrupt' : 'blocked'));
        if (!isRemoteReadingCacheRecoveryEligible(classified)) throw classified;
        cacheFailure = classified;
      }
    }
    if (version === undefined) {
      throw new RemoteReadingGatewayError('cachedSessionUnavailable', '书源已停用或删除，且本机没有可读目录',
        'cache.book.status', undefined, undefined, cacheFailure);
    }
    let session: RemoteReadingSession;
    try {
      session = await gateway.openSession(actual, { isCurrent });
    } catch (error) {
      if (this.bookJobCancelled(job)) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
      const classified = classifyRemoteReadingCommandFailure('book.toc', error);
      const failure = cacheFailure === undefined ? classified : new RemoteReadingGatewayError(classified.code,
        classified.message, classified.command, classified.capability, classified.diagnostic, classified, classified.category,
        classified.transientTransport, cacheFailure.category);
      this.recordFailure(failure, attemptId, failureContext('refresh'));
      if (isCurrent() && version !== undefined && !failure.transientTransport &&
        acquisitionFailureCategoryConfirmed(failure.category) && this.canTryAnotherCandidate(failure)) {
        try {
          await this.request('search-book.put', { origin: seed.sourceId, bookUrl: seed.bookId,
            acquisition: { schemaVersion: 2, sourceVersion: version, checkedAt: attemptId,
              failureStage: forceRefresh ? 'refresh' : failure.command === 'book.detail' ? 'detail' : 'catalog',
              stage: 'failed', failureCategory: failure.category, message: errorMessageOf(failure) } });
        } catch (_publicationError) { /* A failed fact publication never erases the original source failure. */ }
      }
      throw failure;
    }
    if (this.bookJobCancelled(job)) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    if (!isCurrent() || (session.sourceVersion !== undefined && session.sourceVersion !== version)) {
      this.registryReady = false;
      throw new RemoteReadingGatewayError('sourceVersionChanged', '书源规则已更新，请重试');
    }
    return this.withCatalogFreshness({ ...session, sourceVersion: version, catalogAt: session.catalogAt ?? started });
  }

  private drainPreparations(): void {
    while (!this.closed && !this.hasForegroundAcquisition() && this.preparationVisible && this.preparationActive < 2 && this.pending.size > 0) {
      const key = this.pending.keys().next().value;
      if (key === undefined) return;
      const task = this.pending.get(key);
      this.pending.delete(key);
      if (task === undefined || task.scope !== this.scope) continue;
      this.attempted.add(key);
      this.preparationActive += 1;
      void this.prepareOne(task, key).catch((error: Error): void => {
        if (error instanceof RemoteReadingGatewayError && error.code === 'cancelled' && task.scope === this.scope) {
          this.attempted.delete(key);
          if (this.preparationGroups.has(key)) this.pending.set(key, task);
        }
      }).finally((): void => {
        this.preparationActive -= 1;
        this.drainPreparations();
      });
    }
  }

  private async prepareOne(task: Preparation, key: string): Promise<void> {
    const isCurrent = (): boolean => !this.closed && task.scope === this.scope && this.preparationGroups.has(key);
    await this.acquireCandidateGroup(task.candidates, { forceRefresh: task.forceRefresh, isCurrent,
      canDispatch: (): boolean => this.preparationVisible }, 'background');
  }

  private async ensureSources(sourceId: string): Promise<void> {
    if (this.registryReady || this.knownSources.has(sourceId)) return;
    if (this.supportsCapability('source.list.byId.v1')) {
      let pending = this.sourceLoads.get(sourceId);
      if (pending === undefined) {
        pending = this.request('source.list', { sourceId }).then((): void => {}).finally((): void => {
          this.sourceLoads.delete(sourceId);
        });
        this.sourceLoads.set(sourceId, pending);
      }
      await pending;
      if (this.closed) throw new Error('书籍任务已关闭');
      // A rule mutation may have invalidated this response while it was in
      // flight. Re-read the one identity instead of admitting a stale version.
      if (!this.registryReady && !this.knownSources.has(sourceId)) await this.ensureSources(sourceId);
      return;
    }
    if (this.sourceLoad === undefined) {
      this.sourceLoad = this.request('source.list', {}).then((): void => {}).finally((): void => { this.sourceLoad = undefined; });
    }
    await this.sourceLoad;
  }

  private observeSources(data: JsonObject, complete: boolean): void {
    const rows = data['sources'];
    if (!Array.isArray(rows)) return;
    const versions = complete ? new Map<string, string>() : new Map(this.versions);
    for (const value of rows) {
      const source = objectValue(value);
      if (source === undefined || typeof source['sourceId'] !== 'string') continue;
      const id = source['sourceId'] as string;
      if (source['enabled'] !== true || typeof source['sourceVersion'] !== 'string') { versions.delete(id); continue; }
      versions.set(id, source['sourceVersion'] as string);
    }
    this.versions = versions;
    if (complete) this.registryReady = true;
  }

  private observeChangedBooks(method: string, params: JsonObject, data: JsonObject): void {
    const admit = (sourceId: unknown, bookId: unknown): void => {
      if (typeof sourceId !== 'string' || typeof bookId !== 'string' || sourceId.length === 0 || bookId.length === 0) return;
      this.changedIdentities.set(acquisitionBookKey(sourceId, bookId), { sourceId, bookId });
    };
    if (method === 'book.search' && Array.isArray(data['books'])) {
      for (const value of data['books']) admit(data['sourceId'] ?? params['sourceId'], objectValue(value)?.['bookId']);
    } else if (method === 'change.bookSource' && Array.isArray(data['candidates'])) {
      for (const value of data['candidates']) {
        const row = objectValue(value);
        admit(row?.['sourceId'], row?.['bookUrl']);
      }
    } else {
      admit(params['sourceId'] ?? params['origin'], params['bookId'] ?? params['bookUrl'] ?? objectValue(params['book'])?.['bookId']);
    }
  }

  private changed(reset: boolean = false): void {
    this.changedReset = this.changedReset || reset;
    if (this.closed || this.notifyTimer >= 0) return;
    this.notifyTimer = setTimeout((): void => {
      this.notifyTimer = -1;
      const change: BookAcquisitionChange = { reset: this.changedReset, identities: Array.from(this.changedIdentities.values()) };
      if (this.changedShelf) change.shelfChanged = true;
      this.changedReset = false;
      this.changedShelf = false;
      this.changedIdentities.clear();
      for (const listener of this.listeners) {
        try { listener(change); } catch (_error) { /* One disposed projection cannot block others. */ }
      }
    }, 16);
  }
}
