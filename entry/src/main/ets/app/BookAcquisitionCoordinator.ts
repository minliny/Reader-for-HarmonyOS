import { readBookAuthorIdentity, bookAuthorIdentity, bookIdentityText } from '../features/common/BookAuthorMetadata';
import { acquisitionFailureCategoryConfirmed } from '../features/common/BookAcquisitionPresentation';
import type { JsonObject, ReaderCoreResultEvent, RequestOptions } from '@reader/core-harmony';
import { BookRequestScheduler, type BookRequestExecutor, type BookRequestPriority, type BookRequestOptions } from './BookRequestScheduler';
import { errorMessageOf } from './ErrorMessage';
import { isRemoteSourceFailureKind, remoteReadingFailureKindOf, RemoteReadingSourceError } from '../features/reading/RemoteContentAdmission';
import { preparedRemoteChapterMatches, withPreparedRemoteChapter } from '../features/reading/RemoteReadingEvidence';
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
export interface BookCandidateOpenOptions extends RemoteReadingOpenOptions {
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
  started: boolean; consumers: BookConsumer[]; sourceId: string; bookId: string; preempted: boolean; cancelled: boolean };
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

  readingProjectionRevision(): number { return this.projectionRevision; }

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
    const changesProjection = changesSources || method === 'reader.chinese-conversion.put' ||
      method === 'replace.persist' || method === 'replace-rule.put' || method === 'replace-rule.delete' ||
      method === 'dict-rule.put' || method === 'dict-rule.delete' || method === 'rule-bundle.import' ||
      method === 'cache.clear' || method === 'cache.book.prefetch' ||
      (method === 'chapter.content' && params['forceRefresh'] === true);
    if (changesProjection) this.projectionRevision += 1;
    if (changesSources) { this.invalidateSourceRegistry(); this.changed(true); }
    const registryAtStart = this.registryRevision;
    let foregroundRequest = false;
    try {
      const sourceId = typeof params['sourceId'] === 'string' ? params['sourceId'] as string : '';
      const network = method === 'book.search' || method === 'book.detail' || method === 'book.toc' ||
        method === 'chapter.content' || method === 'change.bookSource';
      const actualPriority = priority ?? (method === 'book.search' || method === 'change.bookSource' ? 'search' : 'foreground');
      foregroundRequest = network && actualPriority === 'foreground';
      if (foregroundRequest) {
        this.foregroundRequests += 1;
        const bookId = params['bookId'] ?? objectValue(params['book'])?.['bookId'];
        this.preemptBackgroundAcquisitions(sourceId, typeof bookId === 'string' ? bookId : '');
      }
      const result = network ? await this.scheduler.request(method, params, options,
        this.versions.get(sourceId) ?? '', actualPriority) :
        await this.execute(method, params, options);
      if (method === 'source.list' && registryAtStart === this.registryRevision) {
        this.observeSources(result.data, params['enabledOnly'] !== true);
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
      return result;
    } finally {
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

  private async verifyCandidateBody(session: RemoteReadingSession, options: RemoteReadingOpenOptions,
    priority: BookRequestPriority): Promise<RemoteReadingSession> {
    const revision = this.readingProjectionRevision();
    if (preparedRemoteChapterMatches(session.preparedChapter, session, undefined, revision)) return session;
    const isCurrent = (): boolean => options.isCurrent?.() !== false && revision === this.readingProjectionRevision();
    const gateway = new RemoteReadingFlowGateway({ bookAcquisitions: (): BookAcquisitionCoordinator => this,
      request: (method: string, params: JsonObject = {}, requestOptions: RequestOptions = {}): Promise<ReaderCoreResultEvent> =>
        this.request(method, params, { ...requestOptions, canContinue: isCurrent }, priority) });
    const entries = session.entries.filter((entry): boolean => entry.url.trim().length > 0).slice(0, 3);
    for (let index = 0; index < entries.length; index += 1) {
      try {
        const chapter = await gateway.loadChapter(session, entries[index].index, isCurrent);
        if (!isCurrent()) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
        return withPreparedRemoteChapter(session, chapter, revision);
      } catch (error) {
        if (!isCurrent()) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
        if (remoteReadingFailureKindOf(error) === 'SOURCE_CONTENT_EMPTY' && index + 1 < entries.length) continue;
        throw error;
      }
    }
    throw new RemoteReadingSourceError('SOURCE_CONTENT_EMPTY', '目录没有可验证的正文章节', 'chapter.content');
  }

  async acquireBook(seed: RemoteReadingBookSeed, options: RemoteReadingOpenOptions = {},
    priority: BookRequestPriority = 'foreground'): Promise<RemoteReadingSession> {
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    if (priority === 'foreground') this.preemptBackgroundAcquisitions(seed.sourceId, seed.bookId);
    // Register a known-source join before yielding: another caller may leave
    // in this same turn, but must not orphan a request this caller now needs.
    if (!this.registryReady) await this.ensureSources();
    if (options.isCurrent?.() === false || this.closed) throw new RemoteReadingGatewayError('cancelled', '书籍请求已取消');
    const version = this.versions.get(seed.sourceId);
    const key = JSON.stringify([seed.sourceId, seed.bookId, version]);
    const ready = this.prepared.get(key);
    if (!options.forceRefresh && ready !== undefined && Date.now() - ready.at < CACHE_FRESH_MS) {
      const session = this.withCatalogFreshness(ready.session);
      this.prepared.delete(key);
      this.prepared.set(key, { session, at: ready.at });
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
      promise: Promise.resolve(undefined as unknown as RemoteReadingSession) };
    // The process shares one detail→TOC chain only while a real consumer owns it.
    // Starting a request does not grant it a lifetime beyond every caller.
    next.promise = this.openBook(seed, version, next, options.forceRefresh === true)
      .then((session: RemoteReadingSession): RemoteReadingSession => {
        if (this.versions.get(seed.sourceId) === version && !this.bookJobCancelled(next)) {
          this.prepared.set(key, { session, at: Date.now() });
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
    if (!this.registryReady) await this.ensureSources();
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
    await this.ensureSources();
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
        this.request(method, params, { ...options, shouldCancel: (): boolean => !isCurrent(),
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
        classified.message, classified.command, classified.capability, classified.diagnostic, cacheFailure, classified.category,
        classified.transientTransport);
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
