import type { JsonObject, ReaderCoreResultEvent, RequestOptions } from '@reader/core-harmony';
import { BookRequestScheduler, type BookRequestExecutor, type BookRequestPriority, type BookRequestOptions } from './BookRequestScheduler';
import { errorMessageOf } from './ErrorMessage';
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
}

const PREPARED_SESSION_LIMIT = 32;
const CACHE_FRESH_MS = 24 * 60 * 60 * 1000;
export interface BookAcquisitionCandidate {
  seed: RemoteReadingBookSeed;
  catalogReady: boolean;
  failed: boolean;
}
type Preparation = { candidates: BookAcquisitionCandidate[]; scope: number; forceRefresh: boolean };
type BookJob = { promise: Promise<RemoteReadingSession>; priority: BookRequestPriority; forceRefresh: boolean };
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
  private registryRevision: number = 0;
  private jobs: Map<string, BookJob> = new Map();
  private prepared: Map<string, PreparedSession> = new Map();
  private pending: Map<string, Preparation> = new Map();
  private attempted: Set<string> = new Set();
  private preparationActive: number = 0;
  private preparationVisible: boolean = true;
  private preparationGroups: Set<string> = new Set();
  private scope: number = 0;
  private closed: boolean = false;
  private listeners: Set<(change: BookAcquisitionChange) => void> = new Set();
  private changedIdentities: Map<string, RemoteReadingIdentity> = new Map();
  private changedReset: boolean = false;
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

  subscribe(listener: (change: BookAcquisitionChange) => void): () => void {
    this.listeners.add(listener);
    return (): void => { this.listeners.delete(listener); };
  }

  /** Changes on both sides of a source mutation, including uncertain restore failures. */
  sourceRegistryRevision(): number { return this.registryRevision; }

  private invalidateSourceRegistry(): void {
    this.registryRevision += 1;
    this.registryReady = false;
    this.versions.clear();
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
    const changesSources = method === 'source.import' || method === 'source.update' || method === 'source.delete' ||
      method === 'runtime.storage.apply' || method === 'runtime.storage.restore';
    if (changesSources) { this.invalidateSourceRegistry(); this.changed(true); }
    const registryAtStart = this.registryRevision;
    try {
      const sourceId = typeof params['sourceId'] === 'string' ? params['sourceId'] as string : '';
      const network = method === 'book.search' || method === 'book.detail' || method === 'book.toc' ||
        method === 'chapter.content' || method === 'change.bookSource';
      const result = network ? await this.scheduler.request(method, params, options,
        this.versions.get(sourceId) ?? '', priority ?? (method === 'book.search' || method === 'change.bookSource' ? 'search' : 'foreground')) :
        await this.execute(method, params, options);
      if (method === 'source.list' && registryAtStart === this.registryRevision) {
        this.observeSources(result.data, params['enabledOnly'] !== true);
      }
      if (method === 'book.detail' || method === 'book.toc') {
        const book = objectValue(params['book']);
        const bookId = params['bookId'] ?? book?.['bookId'];
        if (typeof bookId === 'string') {
          for (const [key, ready] of this.prepared) {
            if (ready.session.identity.sourceId === sourceId && ready.session.identity.bookId === bookId) this.prepared.delete(key);
          }
        }
      }
      if (method === 'book.search' || method === 'book.detail' || method === 'book.toc' ||
        method === 'search-book.put' || method === 'search-book.delete' || method === 'change.bookSource') {
        this.observeChangedBooks(method, params, result.data);
        this.changed();
      }
      return result;
    } finally {
      if (changesSources) { this.invalidateSourceRegistry(); this.changed(true); }
    }
  }

  beginSearch(): void {
    this.scope += 1;
    this.pending.clear();
    this.attempted.clear();
    this.preparationGroups.clear();
    this.preparationVisible = true;
  }

  endSearch(): void {
    this.scope += 1;
    this.pending.clear();
    this.preparationGroups.clear();
    this.preparationVisible = false;
    this.scheduler.visibilityChanged();
    // Admitted detail/TOC/body work has independent ownership until completion.
  }

  visibilityChanged(): void { this.scheduler.visibilityChanged(); }

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
    this.drainPreparations();
  }

  setPreparationVisible(visible: boolean): void {
    this.preparationVisible = visible;
    if (visible) this.drainPreparations();
  }

  /** Business fallback for an admitted same-book group, never for a fixed shelf identity. */
  async acquireCandidateGroup(candidates: BookAcquisitionCandidate[], options: RemoteReadingOpenOptions = {},
    priority: BookRequestPriority = 'foreground'): Promise<BookAcquisitionAdmission> {
    const seen = new Set<string>();
    const ordered = candidates.slice().sort((a: BookAcquisitionCandidate, b: BookAcquisitionCandidate): number =>
      (a.failed ? 2 : a.catalogReady ? 0 : 1) - (b.failed ? 2 : b.catalogReady ? 0 : 1));
    let unverifiedAttempts = 0;
    let failure: Error = new Error('没有可用的同书候选');
    for (const candidate of ordered) {
      if (this.closed || options.isCurrent?.() === false) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
      const key = acquisitionBookKey(candidate.seed.sourceId, candidate.seed.bookId);
      if (seen.has(key)) continue;
      seen.add(key);
      if (candidate.failed && !options.forceRefresh) continue;
      if (!candidate.catalogReady && unverifiedAttempts >= 3) continue;
      if (!candidate.catalogReady) unverifiedAttempts += 1;
      try {
        const admission = await this.acquireBookWithBackgroundRefresh(candidate.seed, options, priority);
        if (options.isCurrent?.() === false) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
        return admission;
      } catch (error) {
        if (!(error instanceof RemoteReadingGatewayError) || !this.canTryAnotherCandidate(error)) throw error;
        failure = error;
      }
    }
    throw failure;
  }

  private canTryAnotherCandidate(error: RemoteReadingGatewayError): boolean {
    if (error.capability !== undefined || error.code === 'unsupportedHostCapability') return false;
    return error.code === 'emptyToc' || error.code === 'missingTocUrl' ||
      ((error.command === 'book.detail' || error.command === 'book.toc') &&
        (error.code === 'commandFailed' || error.code === 'invalidResponse'));
  }

  async acquireBook(seed: RemoteReadingBookSeed, options: RemoteReadingOpenOptions = {},
    priority: BookRequestPriority = 'foreground'): Promise<RemoteReadingSession> {
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    await this.ensureSources();
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    const version = this.versions.get(seed.sourceId);
    const key = JSON.stringify([seed.sourceId, seed.bookId, version]);
    if (priority === 'foreground') {
      this.pending.delete(acquisitionBookKey(seed.sourceId, seed.bookId));
      this.scheduler.promote(seed.sourceId, seed.bookId);
    }
    const job = this.jobs.get(key);
    if (job !== undefined) {
      if (priority === 'foreground') job.priority = priority;
      if (options.forceRefresh && !job.forceRefresh) {
        // A cache-only admission is not a refresh. Let its current consumers
        // finish, then revalidate owner/source/cancellation and join or start
        // one actual refresh. Never cancel shared work or clear durable data.
        await job.promise.catch((_error: Error): void => {});
        return this.acquireBook(seed, options, priority);
      }
      return job.promise;
    }
    const ready = this.prepared.get(key);
    if (!options.forceRefresh && ready !== undefined && Date.now() - ready.at < CACHE_FRESH_MS) {
      this.prepared.delete(key);
      this.prepared.set(key, ready);
      return ready.session;
    }
    const next: BookJob = { priority, forceRefresh: options.forceRefresh === true,
      promise: Promise.resolve(undefined as unknown as RemoteReadingSession) };
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
   * Admit the fastest known session and refresh it in the background only
   * when the admitted catalog recommends a refresh. Keeping this decision in
   * the process coordinator prevents page layers from peeking at cache state.
   */
  async acquireBookWithBackgroundRefresh(seed: RemoteReadingBookSeed,
    options: RemoteReadingOpenOptions = {}, priority: BookRequestPriority = 'foreground'):
    Promise<BookAcquisitionAdmission> {
    await this.ensureSources();
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    const version = this.versions.get(seed.sourceId);
    const session = await this.acquireBook(seed, options, priority);
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    if (session.refreshRecommended !== true || options.forceRefresh || this.closed || version === undefined) return { session };
    // Do not pass the page's isCurrent guard to process-owned refresh work;
    // the visible subscriber may disappear while the refresh updates the
    // shared admission cache for the next opener.
    const backgroundRefresh = this.acquireBook(seed, { forceRefresh: true }, 'background');
    // The process owns failure recording even if its page/viewport subscriber
    // has gone away. Keep the original promise rejectable for active callers.
    void backgroundRefresh.catch((_error: Error): void => {});
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
      if (isCurrent() && version !== undefined && this.canTryAnotherCandidate(failure)) {
        try {
          await this.request('search-book.put', { origin: seed.sourceId, bookUrl: seed.bookId,
            acquisition: { schemaVersion: 1, sourceVersion: version, checkedAt: attemptId,
              stage: 'failed', message: errorMessageOf(failure) } });
        } catch (_publicationError) { /* A failed fact publication never erases the original source failure. */ }
      }
      throw failure;
    }
    if (!isCurrent() || (session.sourceVersion !== undefined && session.sourceVersion !== version)) {
      this.registryReady = false;
      throw new RemoteReadingGatewayError('sourceVersionChanged', '书源规则已更新，请重试');
    }
    return { ...session, sourceVersion: version };
  }

  private drainPreparations(): void {
    while (!this.closed && this.preparationVisible && this.preparationActive < 2 && this.pending.size > 0) {
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
    const isCurrent = (): boolean => !this.closed && task.scope === this.scope &&
      this.preparationVisible && this.preparationGroups.has(key);
    await this.acquireCandidateGroup(task.candidates, { forceRefresh: task.forceRefresh, isCurrent }, 'background');
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
      this.changedReset = false;
      this.changedIdentities.clear();
      for (const listener of this.listeners) {
        try { listener(change); } catch (_error) { /* One disposed projection cannot block others. */ }
      }
    }, 16);
  }
}
