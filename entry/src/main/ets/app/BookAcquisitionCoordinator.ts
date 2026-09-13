import { remoteReadingFailureKindOf } from '../features/reading/RemoteContentAdmission';
import type { JsonObject, ReaderCoreResultEvent, RequestOptions } from '@reader/core-harmony';
import { BookRequestScheduler, type BookRequestExecutor, type BookRequestPriority, type BookRequestOptions } from './BookRequestScheduler';
import { errorMessageOf } from './ErrorMessage';
import {
  RemoteReadingFlowGateway, type RemoteReadingBookSeed, type RemoteReadingOpenOptions,
  type RemoteReadingSession,
} from '../features/reading/RemoteReadingFlowGateway';
import { decodeRemoteReadingVariables, RemoteReadingGatewayError, classifyRemoteReadingCommandFailure,
  isRemoteReadingCacheRecoveryEligible, remoteReadingFailureRecord,
  type RemoteReadingFailureRecord } from '../features/reading/RemoteReadingContract';

const PREPARED_SESSION_LIMIT = 32;
const CACHE_FRESH_MS = 24 * 60 * 60 * 1000;
type Preparation = { seed: RemoteReadingBookSeed; scope: number; forceRefresh: boolean };
type BookJob = { promise: Promise<RemoteReadingSession>; priority: BookRequestPriority };
type PreparedSession = { session: RemoteReadingSession; at: number };

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
  private registryReady: boolean = false;
  private jobs: Map<string, BookJob> = new Map();
  private prepared: Map<string, PreparedSession> = new Map();
  private pending: Map<string, Preparation> = new Map();
  private attempted: Set<string> = new Set();
  private preparationActive: number = 0;
  private scope: number = 0;
  private closed: boolean = false;
  private listeners: Set<() => void> = new Set();
  private notifyTimer: number = -1;
  private attemptClock: number = 0;
  private failures: RemoteReadingFailureRecord[] = [];
  private failureIdentities: Map<string, number> = new Map();
  private identityCounter: number = 0;

  private execute: BookRequestExecutor;

  constructor(execute: BookRequestExecutor) {
    this.execute = execute;
    this.scheduler = new BookRequestScheduler(execute);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return (): void => { this.listeners.delete(listener); };
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
    const sourceId = typeof params['sourceId'] === 'string' ? params['sourceId'] as string : '';
    const network = method === 'book.search' || method === 'book.detail' || method === 'book.toc' ||
      method === 'chapter.content' || method === 'change.bookSource';
    const result = network ? await this.scheduler.request(method, params, options,
      this.versions.get(sourceId) ?? '', priority ?? (method === 'book.search' || method === 'change.bookSource' ? 'search' : 'foreground')) :
      await this.execute(method, params, options);
    if (method === 'source.list') this.observeSources(result.data, params['enabledOnly'] !== true);
    if (method === 'book.detail' || method === 'book.toc') {
      const book = objectValue(params['book']);
      const bookId = params['bookId'] ?? book?.['bookId'];
      if (typeof bookId === 'string') {
        for (const [key, ready] of this.prepared) {
          if (ready.session.identity.sourceId === sourceId && ready.session.identity.bookId === bookId) this.prepared.delete(key);
        }
      }
    }
    if (method === 'source.import' || method === 'source.update' || method === 'source.delete') {
      if (method === 'source.import' || sourceId.length === 0) this.versions.clear();
      else this.versions.delete(sourceId);
      this.registryReady = false;
      this.prepared.clear();
      this.attempted.clear();
      this.changed();
    }
    if (method === 'book.search' || method === 'book.detail' || method === 'book.toc' ||
      method === 'search-book.put' || method === 'search-book.delete' || method === 'change.bookSource') this.changed();
    return result;
  }

  beginSearch(): void {
    this.scope += 1;
    this.pending.clear();
    this.attempted.clear();
  }

  endSearch(): void {
    this.scope += 1;
    this.pending.clear();
    this.scheduler.visibilityChanged();
    // Admitted detail/TOC/body work has independent ownership until completion.
  }

  visibilityChanged(): void { this.scheduler.visibilityChanged(); }

  prepare(seeds: RemoteReadingBookSeed[], forceRefresh: boolean = false): void {
    for (const seed of seeds) {
      const key = acquisitionBookKey(seed.sourceId, seed.bookId);
      if (seed.sourceId === 'local' || this.pending.has(key) || (!forceRefresh && this.attempted.has(key))) continue;
      this.pending.set(key, { seed, scope: this.scope, forceRefresh });
    }
    this.drainPreparations();
  }

  async acquireBook(seed: RemoteReadingBookSeed, options: RemoteReadingOpenOptions = {},
    priority: BookRequestPriority = 'foreground'): Promise<RemoteReadingSession> {
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    await this.ensureSources();
    const version = this.versions.get(seed.sourceId);
    const key = JSON.stringify([seed.sourceId, seed.bookId, version]);
    if (priority === 'foreground') {
      this.pending.delete(acquisitionBookKey(seed.sourceId, seed.bookId));
      this.scheduler.promote(seed.sourceId, seed.bookId);
    }
    const job = this.jobs.get(key);
    if (job !== undefined) {
      if (priority === 'foreground') job.priority = priority;
      return job.promise;
    }
    const ready = this.prepared.get(key);
    if (!options.forceRefresh && ready !== undefined && Date.now() - ready.at < CACHE_FRESH_MS) {
      this.prepared.delete(key);
      this.prepared.set(key, ready);
      return ready.session;
    }
    const next: BookJob = { priority, promise: Promise.resolve(undefined as unknown as RemoteReadingSession) };
    // The task's cancellation is process-owned. A page guard only controls its
    // subscriber; hiding/removing that page must not cancel a shared catalog.
    next.promise = this.openBook(seed, version, next, options.forceRefresh === true)
      .then((session: RemoteReadingSession): RemoteReadingSession => {
        if (this.versions.get(seed.sourceId) === version && !this.closed) {
          this.prepared.set(key, { session, at: Date.now() });
          while (this.prepared.size > PREPARED_SESSION_LIMIT) {
            const oldest = this.prepared.keys().next().value;
            if (oldest !== undefined) this.prepared.delete(oldest);
          }
        }
        return session;
      }).finally((): void => { if (this.jobs.get(key) === next) this.jobs.delete(key); });
    this.jobs.set(key, next);
    return next.promise;
  }

  /**
   * Admit the fastest known session and, when it came from the fresh prepared
   * cache, refresh that identity in the background. Keeping this decision in
   * the process coordinator prevents page layers from peeking at cache state.
   */
  async acquireBookWithBackgroundRefresh(seed: RemoteReadingBookSeed,
    options: RemoteReadingOpenOptions = {}, priority: BookRequestPriority = 'foreground'):
    Promise<BookAcquisitionAdmission> {
    await this.ensureSources();
    const version = this.versions.get(seed.sourceId);
    const key = JSON.stringify([seed.sourceId, seed.bookId, version]);
    const cachedEntry = this.prepared.get(key);
    const cached = !options.forceRefresh && cachedEntry !== undefined &&
      Date.now() - cachedEntry.at < CACHE_FRESH_MS;
    const session = await this.acquireBook(seed, options, priority);
    if ((!cached && session.refreshRecommended !== true) || options.forceRefresh || this.closed || version === undefined) return { session };
    // Do not pass the page's isCurrent guard to process-owned refresh work;
    // the visible subscriber may disappear while the refresh updates the
    // shared admission cache for the next opener.
    const backgroundRefresh = this.acquireBook(seed, { forceRefresh: true }, 'background');
    return { session, backgroundRefresh };
  }

  async currentSourceVersion(sourceId: string): Promise<string | undefined> {
    await this.ensureSources();
    return this.versions.get(sourceId);
  }

  beginAttempt(): number {
    this.attemptClock = Math.max(Date.now(), this.attemptClock + 1);
    return this.attemptClock;
  }

  async reportVerdict(session: RemoteReadingSession, chapterUrl: string, message?: string, checkedAt: number = this.beginAttempt()): Promise<void> {
    const version = session.sourceVersion;
    if (version === undefined || version.length === 0 || session.acquisitionMode === 'offline') return;
    const acquisition: JsonObject = { schemaVersion: 1, sourceVersion: version,
      stage: message === undefined ? 'readable' : 'failed', checkedAt };
    if (message === undefined) acquisition['chapterUrl'] = chapterUrl;
    else acquisition['message'] = message;
    await this.request('search-book.put', { origin: session.identity.sourceId, bookUrl: session.identity.bookId, acquisition });
  }

  close(): void {
    this.closed = true;
    this.scope += 1;
    this.pending.clear();
    this.scheduler.close();
    this.prepared.clear();
    this.listeners.clear();
    this.failureIdentities.clear();
    if (this.notifyTimer >= 0) clearTimeout(this.notifyTimer);
    this.notifyTimer = -1;
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
    const gateway = new RemoteReadingFlowGateway({
      request: (method: string, params?: JsonObject, options?: RequestOptions): Promise<ReaderCoreResultEvent> =>
        this.request(method, params, options, job.priority),
    });
    const isCurrent = (): boolean => !this.closed && this.versions.get(seed.sourceId) === version;
    let cacheFailure: RemoteReadingGatewayError | undefined;
    if (!forceRefresh) {
      try {
        const contextIsCurrent = current && storedVariablesValid && typeof facts?.['catalogAt'] === 'number';
        const cached = contextIsCurrent ? await gateway.openCachedCatalogSession(actual, isCurrent, true) :
          await gateway.openCachedSession(actual, isCurrent);
        if (this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消', 'cache.book.status');
        if (!isCurrent()) throw new RemoteReadingGatewayError('sourceVersionChanged', '书源规则已更新，请重试', 'cache.book.status');
        return { ...cached, sourceVersion: version, requiresContextRefresh: (!contextIsCurrent || cached.requiresContextRefresh === true) && version !== undefined,
          refreshRecommended: !contextIsCurrent || Date.now() - (facts?.['catalogAt'] as number) >= CACHE_FRESH_MS };
      } catch (error) {
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
      const classified = classifyRemoteReadingCommandFailure('book.toc', error);
      const failure = cacheFailure === undefined ? classified : new RemoteReadingGatewayError(classified.code,
        classified.message, classified.command, classified.capability, classified.diagnostic, cacheFailure, classified.category);
      this.recordFailure(failure, attemptId, failureContext('refresh'));
      throw failure;
    }
    if (!isCurrent() || (session.sourceVersion !== undefined && session.sourceVersion !== version)) {
      this.registryReady = false;
      throw new RemoteReadingGatewayError('sourceVersionChanged', '书源规则已更新，请重试');
    }
    return { ...session, sourceVersion: version };
  }

  private drainPreparations(): void {
    while (!this.closed && this.preparationActive < 2 && this.pending.size > 0) {
      const key = this.pending.keys().next().value;
      if (key === undefined) return;
      const task = this.pending.get(key);
      this.pending.delete(key);
      if (task === undefined || task.scope !== this.scope) continue;
      this.attempted.add(key);
      this.preparationActive += 1;
      void this.prepareOne(task.seed, task.forceRefresh).catch((): void => {}).finally((): void => {
        this.preparationActive -= 1;
        this.drainPreparations();
      });
    }
  }

  private async prepareOne(seed: RemoteReadingBookSeed, forceRefresh: boolean): Promise<void> {
    let session: RemoteReadingSession | undefined = undefined;
    await this.ensureSources();
    const versionAtStart = this.versions.get(seed.sourceId);
    const startedAt = this.beginAttempt();
    try {
      session = await this.acquireBook(seed, { forceRefresh }, 'background');
      const gateway = new RemoteReadingFlowGateway({
        request: (method: string, params?: JsonObject, options?: RequestOptions): Promise<ReaderCoreResultEvent> =>
          this.request(method, params, options, 'background'),
      });
      const progress = await gateway.loadProgress(session.identity);
      const start = progress.kind === 'restored' ? progress.progress.chapterIndex : 0;
      const entries = session.entries.filter((entry): boolean => entry.index >= start && entry.url.trim().length > 0).slice(0, progress.kind === 'restored' ? 1 : 3);
      let failure = '没有可读章节';
      let attemptAt = this.beginAttempt();
      for (const entry of entries) {
        attemptAt = this.beginAttempt();
        try {
          await gateway.loadChapter(session, entry.index, (): boolean => !this.closed);
          await this.reportVerdict(session, entry.url, undefined, attemptAt);
          return;
        } catch (error) {
          failure = errorMessageOf(error);
          if (remoteReadingFailureKindOf(error) !== 'SOURCE_CONTENT_EMPTY') break;
        }
      }
      await this.reportVerdict(session, '', failure, attemptAt);
    } catch (error) {
      const version = session?.sourceVersion ?? versionAtStart;
      if (version !== undefined && !this.closed) {
        try {
          await this.request('search-book.put', { origin: seed.sourceId, bookUrl: seed.bookId,
            acquisition: { schemaVersion: 1, sourceVersion: version, checkedAt: startedAt, stage: 'failed', message: errorMessageOf(error) } });
        } catch (_publicationError) { /* Deleted/replaced source rejects the old verdict. */ }
      }
    }
  }

  private async ensureSources(): Promise<void> {
    if (this.registryReady) return;
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

  private changed(): void {
    if (this.closed || this.notifyTimer >= 0) return;
    this.notifyTimer = setTimeout((): void => {
      this.notifyTimer = -1;
      for (const listener of this.listeners) {
        try { listener(); } catch (_error) { /* One disposed projection cannot block others. */ }
      }
    }, 16);
  }
}
