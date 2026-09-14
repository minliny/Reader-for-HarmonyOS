import {
  SearchGateway,
  type SearchBook,
  type SearchResultDelta,
  type SearchHistory,
  type SearchSource,
} from './SearchGateway';
import type {
  SearchPresentation,
} from './SearchPage';
import type { SearchBookPatch } from './SearchBookProjection';
import type { BookAcquisitionChange } from '../../app/BookAcquisitionCoordinator';
import type { RemoteReadingIdentity } from '../reading/RemoteReadingContract';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { errorMessageOf } from '../../app/ErrorMessage';
import { readerSourceCategoryIsText } from '../source/ReaderSourceCategory';

const DOMAIN = 0x5244;

/**
 * Feature-local bound on how many `book.search` source requests run at once.
 * Bounded so a slow or stuck source cannot stack latency across every enabled
 * source; outcomes are still assembled in source registration order.
 */
const MAX_SEARCH_CONCURRENCY = 4;
const SEARCH_PARTIAL_PUBLISH_INTERVAL_MS = 100;
const SEARCH_PARTIAL_PUBLISH_MAX_MS = 200;

/** One isolated source failure; healthy sources continue in the same search. */
interface WorkerFailure {
  source: SearchSource;
  error: string;
}

type SearchBranchStatus = 'running' | 'done' | 'failed';

/** Query ownership survives stop/retry and is independent of a rendered frame. */
class SearchQueryRun {
  keyword: string;
  requestId: string;
  scope: string[] | undefined;
  sources: SearchSource[] = [];
  sourceResults: Map<string, SearchBook[]> = new Map();
  completed: Set<string> = new Set();
  completedVersions: Map<string, string | undefined> = new Map();
  failures: Map<string, WorkerFailure> = new Map();
  localResults: SearchBook[] = [];
  localStatus: SearchBranchStatus = 'running';
  localFailed: boolean = false;
  historyWritten: boolean = false;
  onlineStatus: SearchBranchStatus = 'running';
  sourceListFailed: boolean = false;
  stopped: boolean = false;
  order: Map<string, number> = new Map();
  revision: number = 0;
  flattenedRevision: number = -1;
  flattened: SearchBook[] = [];
  timer: number = -1;
  pendingSince: number = 0;

  constructor(keyword: string, requestId: string, scope?: string[]) {
    this.keyword = keyword;
    this.requestId = requestId;
    this.scope = scope;
  }

  admit(books: SearchBook[], previous: SearchBook[] = []): SearchBook[] {
    const admitted: SearchBook[] = [];
    const seen = new Set<string>();
    for (const book of books) {
      if (book.searchRequestId !== this.requestId) continue;
      const key = `${book.sourceId}\u0000${book.bookId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let rank = this.order.get(key);
      if (rank === undefined) { rank = this.order.size; this.order.set(key, rank); }
      admitted.push({ ...book, admittedOrder: rank });
    }
    // A successful empty source changes completion counters only. Replacing
    // an earlier nonempty bucket still changes membership and must invalidate.
    if (admitted.length > 0 || previous.length > 0) this.revision += 1;
    return admitted;
  }

  results(): SearchBook[] {
    if (this.flattenedRevision === this.revision) return this.flattened;
    const results = this.localResults.slice();
    for (const source of this.sources) {
      const books = this.sourceResults.get(source.sourceId);
      if (books !== undefined) results.push(...books);
    }
    this.flattened = results;
    this.flattenedRevision = this.revision;
    return results;
  }
}

/**
 * Owns the Search page's orchestration. A plain class, not a component:
 * per-entry `session` and per-submit `work` counters guard every async write-back,
 * source/history loading and result dedup live here, and it emits typed
 * `SearchPresentation` / `SearchSource[]` snapshots. Index only mounts the page
 * and forwards snapshots; it never re-implements search logic.
 *
 * `isCurrent()` is provided by Index and answers "is the Search route still the
 * active one?" so the orchestrator needs no knowledge of navigation.
 */
export class SearchOrchestrator {
  private gateway: SearchGateway;
  private emitPresentation: (presentation: SearchPresentation) => void;
  private emitSources: (sources: SearchSource[]) => void;
  /** Visibility gates dispatch only; it never cancels an admitted request. */
  private isCurrent: () => boolean;
  private sessionOpen: boolean = false;
  private dispatchWaiters: Array<() => void> = [];
  /** Authoritative mirror; Index's @State is a projection of it. */
  private presentation: SearchPresentation = { kind: 'initial', history: [] };
  private sources: SearchSource[] = [];
  private unsubscribeBooks: (() => void) | undefined = undefined;
  private refreshPending: boolean = false;
  private refreshAgain: boolean = false;
  private resultGeneration: number = 0;
  private pendingBookReset: boolean = false;
  private pendingBookIdentities: Map<string, RemoteReadingIdentity> = new Map();
  private rawResultsInput: SearchBook[] | undefined = undefined;
  private owner: ReaderRuntimeOwner;
  /** Bumped on every entry into Search; stale-entry async work is dropped. */
  private session: number = 0;
  /** Bumped on every submit/clear; a newer submit supersedes an older one. */
  private work: number = 0;
  private sourceLoad: Promise<SearchSource[]> | undefined = undefined;
  private sourceLoadSession: number = 0;
  /**
   * True while the live sweep has active or paused workers.
   */
  private sweepAlive: boolean = false;
  private searchedSources: Set<string> = new Set();

  searchedSourceIds(): string[] { return Array.from(this.searchedSources); }
  /**
   * Completed (ok or failed) sources of the live sweep. stop() reads it to
   * settle an interrupted loading surface with an honest source count.
   */
  private sweepCompletedSourceCount: number = 0;
  /** Scope of the most recent search; an explicit retry uses the same subset. */
  private lastScope: string[] | undefined = undefined;
  private resultIndex: Map<string, SearchBook> = new Map();
  private resultRevision: number = 0;
  private rawIdentityKeys: Set<string> = new Set();
  private run: SearchQueryRun | undefined = undefined;

  constructor(
    emitPresentation: (presentation: SearchPresentation) => void,
    emitSources: (sources: SearchSource[]) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.owner = owner;
    this.gateway = new SearchGateway(owner);
    this.emitPresentation = emitPresentation;
    this.emitSources = emitSources;
    this.isCurrent = isCurrent;
  }

  /** Enter the Search page: invalidate prior entries, load sources + history. */
  open(): void {
    this.close();
    this.sessionOpen = true;
    this.unsubscribeBooks = this.owner.bookAcquisitions?.().subscribe((change: BookAcquisitionChange): void => {
      if (change !== undefined && !change.reset && change.identities.length === 0) return;
      void this.refreshSharedBooks(change ?? { reset: true, identities: [] });
    });
    this.session += 1;
    const session = this.session;
    this.work = 0;
    this.sweepAlive = false;
    // Source and history are independent Core facts. In particular, a
    // history failure must not make a valid source list disappear, and an
    // early submit must be able to await this very source-list transaction.
    this.presentInitial();
    this.presentSources([]);
    const sourceLoad = this.gateway.loadSources();
    this.sourceLoad = sourceLoad;
    this.sourceLoadSession = session;
    sourceLoad
      .then((sources: SearchSource[]): void => {
        if (!this.isCurrentSession(session)) {
          return;
        }
        this.presentSources(sources);
        // Online-source availability does not disable local book search.
        // A user who already left Initial keeps the active search state.
        if (this.presentation.kind === 'initial') {
          const entry = this.entryPresentationForSources(sources);
          if (entry !== undefined) {
            this.present(entry);
          }
        }
      })
      .catch((error: Error): void => {
        if (!this.isCurrentSession(session)) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Search source list failed to load: %{private}s', error.message);
        if (this.presentation.kind === 'initial') {
          this.presentInitial();
        }
        this.presentSources([]);
      });
    this.gateway.loadHistory()
      .then((history: SearchHistory): void => {
        // A search that started while history was still loading keeps the
        // Loading/Results state; only an untouched Initial surface adopts it.
        if (!this.isCurrentSession(session) || this.presentation.kind !== 'initial') {
          return;
        }
        this.present({ kind: 'initial', history: history.keywords });
      })
      .catch((error: Error): void => {
        if (!this.isCurrentSession(session)) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Search history failed to load: %{private}s', error.message);
        // An unavailable history has no admitted error state. Keep the empty
        // Initial Figma state; it must not block a real search.
      });
  }

  /**
   * Begin a real search across enabled sources. An explicit `scopeSourceIds`
   * subset (ACQ-02) restricts the sweep to those sources; omitted scope means
   * all enabled sources. Explicit retry retains the subset; resume retains
   * the existing workers and cursor.
   */
  search(keyword: string, scopeSourceIds?: string[]): void {
    if (keyword.trim().length === 0) {
      return;
    }
    this.cancelRunTimer();
    this.searchedSources.clear();
    this.resultGeneration += 1;
    this.gateway.resetBookProjection();
    this.pendingBookReset = false;
    this.pendingBookIdentities.clear();
    this.sourceLoad = this.gateway.loadSources();
    this.sourceLoadSession = this.session;
    this.work += 1;
    this.wakeDispatchers();
    this.sweepAlive = true;
    this.lastScope = scopeSourceIds === undefined ? undefined : scopeSourceIds.slice();
    this.sweepCompletedSourceCount = 0;
    const run = new SearchQueryRun(keyword, this.gateway.generateSearchRequestId(keyword), this.lastScope);
    this.run = run;
    this.present({ kind: 'loading', keyword });
    void this.performSearch(this.work, this.session, run, true, true);
  }

  /**
   * Stop the live sweep (ACQ-02): supersede the workers so no further source
   * requests are issued and settle the visible surface with what already
   * landed. Partial results stay; stopping is never destructive.
   */
  stop(): void {
    const run = this.run;
    if (run !== undefined && this.sweepAlive) {
      // The run owns already decoded outcomes even when the batching timer has
      // not published them yet. Stop is a synchronous commit boundary.
      this.cancelRunTimer();
      run.stopped = true;
      hilog.info(DOMAIN, 'Reader', 'Search sweep stopped by user: %{private}s',
        this.truncatedKeywordForLog(run.keyword));
      this.publishRun(run, true);
      this.work += 1;
      this.sweepAlive = false;
      this.wakeDispatchers();
      return;
    }
    const presentation = this.presentation;
    if (presentation.kind === 'loading') {
      this.work += 1;
      this.wakeDispatchers();
      this.sweepAlive = false;
      hilog.info(DOMAIN, 'Reader', 'Search sweep stopped by user: %{private}s',
        this.truncatedKeywordForLog(presentation.keyword));
      this.present({
        kind: 'empty',
        keyword: presentation.keyword,
        searchedSourceCount: this.sweepCompletedSourceCount,
        stopped: true,
      });
      return;
    }
    if (presentation.kind === 'results' && presentation.searching) {
      this.work += 1;
      this.wakeDispatchers();
      this.sweepAlive = false;
      hilog.info(DOMAIN, 'Reader', 'Search sweep stopped by user: %{private}s',
        this.truncatedKeywordForLog(presentation.keyword));
      this.present({
        kind: 'results',
        keyword: presentation.keyword,
        results: presentation.results,
        searching: false,
        totalSourceCount: presentation.totalSourceCount,
        completedSourceCount: presentation.completedSourceCount,
        failedSourceCount: presentation.failedSourceCount,
        stopped: true,
        localSearchFailed: presentation.localSearchFailed, sourceListFailed: presentation.sourceListFailed,
      });
    }
  }

  /** Re-run the last failed or empty search, or reload sources after a list failure. */
  retry(): void {
    const run = this.run;
    if (run !== undefined) {
      const retryLocal = run.localStatus === 'failed' || (!this.sweepAlive && run.localStatus !== 'done');
      const retryOnline = (!this.sweepAlive || run.onlineStatus !== 'running') && (run.onlineStatus !== 'done' || run.failures.size > 0 ||
        run.sources.some((source: SearchSource): boolean => !run.completed.has(source.sourceId)));
      if (!retryLocal && !retryOnline) {
        // The empty surface labels this action as a new search, not failure recovery.
        if (this.presentation.kind === 'empty') this.search(run.keyword, run.scope);
        return;
      }
      this.cancelRunTimer();
      if (!this.sweepAlive) this.work += 1;
      this.wakeDispatchers();
      run.stopped = false;
      this.sweepAlive = true;
      if (retryLocal) run.localStatus = 'running';
      if (retryOnline) {
        run.onlineStatus = 'running';
        this.sourceLoad = this.gateway.loadSources();
        this.sourceLoadSession = this.session;
      }
      this.publishRun(run);
      void this.performSearch(this.work, this.session, run, retryLocal, retryOnline);
      return;
    }
    if (this.presentation.kind === 'empty' || this.presentation.kind === 'error') {
      this.search(this.presentation.keyword, this.lastScope);
    } else if (this.presentation.kind === 'sourceLoadError') {
      this.retrySourceLoad();
    }
  }

  /** Resume the same workers and source cursor; never create a new query. */
  resume(): void {
    this.wakeDispatchers();
  }

  /** Called after route or Ability foreground changes. In-flight work is retained. */
  visibilityChanged(): void {
    this.wakeDispatchers();
    if (this.isCurrent() && (this.pendingBookReset || this.pendingBookIdentities.size > 0)) {
      void this.refreshSharedBooks();
    }
  }

  /** Logical exit releases the query, including workers waiting for foreground. */
  close(): void {
    this.cancelRunTimer();
    this.run = undefined;
    this.resultIndex.clear(); this.rawIdentityKeys.clear(); this.rawResultsInput = undefined;
    this.resultGeneration += 1;
    this.gateway.resetBookProjection();
    this.pendingBookReset = false;
    this.pendingBookIdentities.clear();
    this.unsubscribeBooks?.();
    this.unsubscribeBooks = undefined;
    this.sessionOpen = false;
    this.work += 1;
    this.sweepAlive = false;
    this.wakeDispatchers();
  }

  private async refreshSharedBooks(change?: BookAcquisitionChange): Promise<void> {
    if (change !== undefined) {
      this.pendingBookReset = this.pendingBookReset || change.reset;
      for (const identity of change.identities) {
        this.pendingBookIdentities.set(`${identity.sourceId}\u0000${identity.bookId}`, identity);
      }
    }
    if (this.refreshPending) { this.refreshAgain = true; return; }
    if (!this.sessionOpen || this.presentation.kind !== 'results' || !this.isCurrent()) return;
    const delta: BookAcquisitionChange = { reset: this.pendingBookReset || this.pendingBookIdentities.size === 0,
      identities: Array.from(this.pendingBookIdentities.values()) };
    this.pendingBookReset = false;
    this.pendingBookIdentities.clear();
    this.refreshAgain = false;
    this.refreshPending = true;
    const session = this.session;
    const resultGeneration = this.resultGeneration;
    const current = this.presentation;
    try {
      if (typeof this.gateway.refreshBookDelta === 'function') {
        const patch = await this.gateway.refreshBookDelta(this.resultIndex, delta);
        if (!this.isCurrentSession(session) || resultGeneration !== this.resultGeneration || this.presentation.kind !== 'results') return;
        const accepted: SearchBook[] = []; const removed: string[] = [];
        for (const diagnostic of patch.diagnostics ?? []) hilog.warn(DOMAIN, 'Reader', 'Search projection retained incomplete facts: %{private}s', this.sanitizedLogText(diagnostic));
        for (const identity of patch.retryIdentities) this.pendingBookIdentities.set(`${identity.sourceId}\u0000${identity.bookId}`, identity);
        const accepts = (key: string): boolean => {
          if (this.resultIndex.get(key) === patch.captured.get(key)) return true;
          const book = this.resultIndex.get(key);
          if (book !== undefined) this.pendingBookIdentities.set(key, { sourceId: book.sourceId, bookId: book.bookId });
          this.refreshAgain = true; return false;
        };
        for (const book of patch.upserted) if (accepts(`${book.sourceId}\u0000${book.bookId}`)) accepted.push(book);
        for (const key of patch.removedKeys) if (accepts(key)) removed.push(key);
        if (accepted.length === 0 && removed.length === 0) return;
        const latest = this.presentation;
        for (const key of removed) this.resultIndex.delete(key);
        for (const book of accepted) this.resultIndex.set(`${book.sourceId}\u0000${book.bookId}`, book);
        const resultDelta: SearchResultDelta = { baseRevision: this.resultRevision, revision: this.resultRevision + 1,
          reset: false, upserted: accepted, removedKeys: removed };
        this.present({ ...latest, results: Array.from(this.resultIndex.values()), delta: resultDelta }, false);
      } else {
      const results = await this.gateway.refreshBooks(current.results, delta);
      if (this.isCurrentSession(session) && resultGeneration === this.resultGeneration && this.presentation.kind === 'results') {
        const latest = this.presentation;
        // Counters and later source arrivals must not invalidate completed
        // canonical facts. Replace only the exact rows captured by this read;
        // a newer identity payload remains owned by the newer publication.
        const captured = new Map<string, SearchBook>();
        const projected = new Map<string, SearchBook>();
        for (const book of current.results) captured.set(`${book.sourceId}\u0000${book.bookId}`, book);
        for (const book of results) projected.set(`${book.sourceId}\u0000${book.bookId}`, book);
        const merged: SearchBook[] = [];
        const seen = new Set<string>();
        for (const book of latest.results) {
          const key = `${book.sourceId}\u0000${book.bookId}`;
          seen.add(key);
          if (captured.get(key) === book) {
            const refreshed = projected.get(key);
            if (refreshed !== undefined) merged.push(refreshed);
          } else {
            merged.push(book);
            this.refreshAgain = true;
            this.pendingBookIdentities.set(key, { sourceId: book.sourceId, bookId: book.bookId });
          }
        }
        for (const book of results) {
          const key = `${book.sourceId}\u0000${book.bookId}`;
          if (!seen.has(key) && !captured.has(key)) merged.push(book);
        }
        if (merged.length === latest.results.length &&
          merged.every((book: SearchBook, index: number): boolean => book === latest.results[index])) return;
        this.present({ kind: 'results', keyword: latest.keyword, results: merged,
          localSearchFailed: latest.localSearchFailed, sourceListFailed: latest.sourceListFailed,
          searching: latest.searching, stopped: latest.stopped, totalSourceCount: latest.totalSourceCount,
          completedSourceCount: latest.completedSourceCount, failedSourceCount: latest.failedSourceCount }, false);
      }
      }

    } catch (_error) {
      // Keep the displayed results and retry these exact facts only on a later
      // event/visibility change. Dropping a consumed delta loses it permanently
      // once unrelated changes stop triggering full cache reads.
      if (this.isCurrentSession(session) && resultGeneration === this.resultGeneration) {
        this.pendingBookReset = this.pendingBookReset || delta.reset;
        for (const identity of delta.identities) {
          this.pendingBookIdentities.set(`${identity.sourceId}\u0000${identity.bookId}`, identity);
        }
      }
    }
    finally {
      this.refreshPending = false;
      if (this.refreshAgain) void this.refreshSharedBooks();
    }
  }

  private wakeDispatchers(): void {
    const waiters = this.dispatchWaiters;
    this.dispatchWaiters = [];
    for (const wake of waiters) wake();
  }

  private async waitForDispatch(work: number, session: number): Promise<boolean> {
    while (this.isCurrentWork(work, session) && !this.isCurrent()) {
      await new Promise<void>((resolve: () => void): void => {
        this.dispatchWaiters.push(resolve);
      });
    }
    return this.isCurrentWork(work, session);
  }

  /**
   * Reload sources without discarding the current presentation. Used when the
   * user returns to Search from Source Management without an explicit
   * re-search: chips refresh, and a resolved configuration gap re-enters the
   * normal Initial surface.
   */
  refreshSources(): void {
    const session = this.session;
    const sourceLoad = this.gateway.loadSources();
    this.sourceLoad = sourceLoad;
    this.sourceLoadSession = session;
    sourceLoad
      .then((sources: SearchSource[]): void => {
        if (!this.isCurrentSession(session)) {
          return;
        }
        this.presentSources(sources);
        const kind = this.presentation.kind;
        if (kind === 'sourceRequired' || kind === 'sourceLoadError') {
          const entry = this.entryPresentationForSources(sources);
          if (entry === undefined) {
            // The configuration gap is resolved; the normal entry reset keeps
            // Initial, history and sources coherent.
            this.open();
            return;
          }
          this.present(entry);
        }
      })
      .catch((error: Error): void => {
        if (!this.isCurrentSession(session)) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Search source list failed to refresh: %{private}s', error.message);
        // Keep the current presentation; the next explicit action retries.
      });
  }

  /** Clear recent history back to the Initial surface. */
  clearHistory(): void {
    this.cancelRunTimer();
    this.run = undefined;
    this.resultIndex.clear(); this.rawIdentityKeys.clear(); this.rawResultsInput = undefined;
    this.resultGeneration += 1;
    this.gateway.resetBookProjection();
    this.work += 1;
    this.wakeDispatchers();
    this.sweepAlive = false;
    const work = this.work;
    const session = this.session;
    const gateway = this.gateway;
    gateway.clearHistory()
      .then((): Promise<SearchHistory> => gateway.loadHistory())
      .then((history: SearchHistory): void => {
        if (!this.isCurrentWork(work, session)) {
          return;
        }
        this.present({ kind: 'initial', history: history.keywords });
      })
      .catch((error: Error): void => {
        if (!this.isCurrentWork(work, session)) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Search history clear failed: %{private}s', error.message);
      });
  }

  private cancelRunTimer(): void {
    if (this.run !== undefined && this.run.timer >= 0) clearTimeout(this.run.timer);
    if (this.run !== undefined) { this.run.timer = -1; this.run.pendingSince = 0; }
  }

  private publishRun(run: SearchQueryRun, stopped: boolean = false): void {
    if (this.run !== run || !this.sessionOpen) return;
    const results = run.results();
    const searching = !stopped && (run.localStatus === 'running' || run.onlineStatus === 'running');
    this.sweepCompletedSourceCount = run.completed.size;
    if (results.length > 0) {
      this.present({ kind: 'results', keyword: run.keyword, results, searching,
        totalSourceCount: run.sources.length, completedSourceCount: run.completed.size,
        failedSourceCount: run.failures.size, localSearchFailed: run.localFailed,
        sourceListFailed: run.sourceListFailed, stopped: stopped || undefined });
    } else if (!searching) {
      const failed = run.localFailed || run.sourceListFailed ||
        (run.sources.length > 0 && run.failures.size === run.sources.length);
      this.present({ kind: failed && !stopped ? 'error' : 'empty', keyword: run.keyword,
        searchedSourceCount: run.completed.size, failedSourceCount: run.failures.size,
        localSearchFailed: run.localFailed, sourceListFailed: run.sourceListFailed,
        stopped: stopped || undefined });
    } else if (this.presentation.kind !== 'loading') {
      this.present({ kind: 'loading', keyword: run.keyword });
    }
  }

  private scheduleRunPublish(run: SearchQueryRun, work: number, session: number): void {
    if (!this.isCurrentWork(work, session) || this.run !== run) return;
    const settled = run.localStatus !== 'running' && run.onlineStatus !== 'running';
    let first = this.presentation.kind !== 'results' && run.localResults.length > 0;
    if (!first && this.presentation.kind !== 'results') {
      for (const books of run.sourceResults.values()) if (books.length > 0) { first = true; break; }
    }
    if (settled || first) {
      this.cancelRunTimer();
      this.publishRun(run);
      return;
    }
    if (run.timer >= 0) return;
    const now = Date.now();
    if (run.pendingSince === 0) run.pendingSince = now;
    const delay = Math.max(0, Math.min(SEARCH_PARTIAL_PUBLISH_INTERVAL_MS,
      SEARCH_PARTIAL_PUBLISH_MAX_MS - (now - run.pendingSince)));
    run.timer = setTimeout((): void => {
      run.timer = -1;
      run.pendingSince = 0;
      if (this.isCurrentWork(work, session) && this.run === run) this.publishRun(run);
    }, delay);
  }

  private async performSearch(work: number, session: number, run: SearchQueryRun,
    searchLocal: boolean, searchOnline: boolean): Promise<void> {
    if (!run.historyWritten) {
      run.historyWritten = true;
      void this.gateway.addHistory(run.keyword).catch((error: Error): void => {
        hilog.warn(DOMAIN, 'Reader', 'Search history add failed: %{private}s', error.message);
      });
    }
    const local = async (): Promise<void> => {
      if (!searchLocal) return;
      try {
        const books = await this.gateway.searchLocalBooks(run.keyword, run.requestId);
        if (!this.isCurrentWork(work, session)) return;
        run.localResults = run.admit(books, run.localResults);
        run.localStatus = 'done';
        run.localFailed = false;
      } catch (_error) {
        if (!this.isCurrentWork(work, session)) return;
        run.localStatus = 'failed';
        run.localFailed = true;
      }
      this.scheduleRunPublish(run, work, session);
    };
    const online = async (): Promise<void> => {
      if (!searchOnline) return;
      try {
        const sources = await this.sourcesForSession(session);
        if (!this.isCurrentWork(work, session)) return;
        this.presentSources(sources);
        const scope = run.scope === undefined ? undefined : new Set<string>(run.scope);
        const enabled = sources.filter((source: SearchSource): boolean => source.enabled &&
          source.name.trim().length > 0 && readerSourceCategoryIsText(source.category) &&
          (scope === undefined || scope.has(source.sourceId)));
        run.sources = enabled;
        run.sourceListFailed = false;
        // Keep successful source buckets on retry. Replaced/deleted sources
        // cannot survive an explicit registry refresh through a stale bucket.
        const retained = new Set<string>(enabled.map((source: SearchSource): string => source.sourceId));
        for (const id of run.sourceResults.keys()) if (!retained.has(id)) run.sourceResults.delete(id);
        for (const id of run.completed) if (!retained.has(id)) run.completed.delete(id);
        for (const id of run.failures.keys()) if (!retained.has(id)) run.failures.delete(id);
        for (const source of enabled) {
          if (run.completed.has(source.sourceId) && run.completedVersions.get(source.sourceId) !== source.sourceVersion) {
            run.completed.delete(source.sourceId); run.sourceResults.delete(source.sourceId);
          }
        }
        run.revision += 1;
        const pending = enabled.filter((source: SearchSource): boolean =>
          !run.completed.has(source.sourceId) || run.failures.has(source.sourceId));
        let next = 0;
        const worker = async (): Promise<void> => {
          while (next < pending.length) {
            if (!await this.waitForDispatch(work, session)) return;
            if (!this.isCurrent()) continue;
            const source = pending[next++];
            if (source === undefined) return;
            this.searchedSources.add(source.sourceId);
            const outcome = await this.gateway.searchBySource(source, run.keyword,
              (): boolean => this.isCurrentWork(work, session), run.requestId, (): boolean => this.isCurrent());
            if (!this.isCurrentWork(work, session)) return;
            run.completed.add(source.sourceId);
            run.completedVersions.set(source.sourceId, source.sourceVersion);
            if (outcome.ok === false) {
              run.failures.set(source.sourceId, { source, error: outcome.error });
              hilog.warn(DOMAIN, 'Reader', 'Search source %{private}s failed: %{private}s',
                this.sourceIdentityForLog(source), this.sanitizedLogText(outcome.error));
            } else {
              run.failures.delete(source.sourceId);
              run.sourceResults.set(source.sourceId, run.admit(outcome.results, run.sourceResults.get(source.sourceId) ?? []));
            }
            this.scheduleRunPublish(run, work, session);
          }
        };
        const workers: Promise<void>[] = [];
        for (let index = 0; index < Math.min(MAX_SEARCH_CONCURRENCY, pending.length); index++) workers.push(worker());
        await Promise.all(workers);
        if (!this.isCurrentWork(work, session)) return;
        run.onlineStatus = 'done';
      } catch (_error) {
        if (!this.isCurrentWork(work, session)) return;
        run.sourceListFailed = true;
        run.onlineStatus = 'failed';
      }
      this.scheduleRunPublish(run, work, session);
    };
    await Promise.all([local(), online()]);
    if (this.isCurrentWork(work, session) && this.run === run) {
      this.cancelRunTimer();
      this.publishRun(run);
      this.sweepAlive = run.localStatus === 'running' || run.onlineStatus === 'running';
    }
  }

  private isCurrentSession(session: number): boolean {
    return this.sessionOpen && session === this.session;
  }

  private isCurrentWork(work: number, session: number): boolean {
    return this.sessionOpen && session === this.session && work === this.work;
  }

  /** P2-9: hilog never carries a raw search keyword; keep a bounded prefix. */
  private truncatedKeywordForLog(keyword: string): string {
    const normalized = keyword.trim();
    if (normalized.length <= 12) {
      return normalized;
    }
    return `${normalized.slice(0, 12)}…`;
  }

  /**
   * P2-9: hilog identity for a failing source. sourceId is the Legado
   * bookSourceUrl, so only its host is logged; a non-URL id falls back to the
   * bounded display name.
   */
  private sourceIdentityForLog(source: SearchSource): string {
    const host = this.hostOfUrlText(source.sourceId);
    if (host.length > 0) {
      return host;
    }
    return this.truncatedKeywordForLog(source.name);
  }

  /**
   * P2-9: Core and transport error text can embed the request URL or the
   * final redirect URL; every http(s) URL is reduced to its host and the
   * whole text is bounded before it reaches hilog.
   */
  private sanitizedLogText(text: string): string {
    const reduced = text.replace(/https?:\/\/[^\s"'<>]+/gi,
      (match: string): string => {
        const host = this.hostOfUrlText(match);
        return host.length > 0 ? `[host:${host}]` : '[url]';
      });
    return reduced.length > 240 ? `${reduced.slice(0, 240)}…` : reduced;
  }

  private hostOfUrlText(value: string): string {
    let rest = value.trim();
    const schemeMatch = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.exec(rest);
    if (schemeMatch !== null) {
      rest = rest.slice(schemeMatch[0].length);
    }
    const authority = rest.split(/[/?#]/)[0];
    const atSign = authority.lastIndexOf('@');
    const hostPort = atSign >= 0 ? authority.slice(atSign + 1) : authority;
    if (hostPort.startsWith('[')) {
      const bracketEnd = hostPort.indexOf(']');
      return bracketEnd < 0 ? '' : hostPort.slice(1, bracketEnd).toLowerCase();
    }
    const colon = hostPort.indexOf(':');
    const host = colon >= 0 ? hostPort.slice(0, colon) : hostPort;
    return host.toLowerCase();
  }

  private async sourcesForSession(session: number): Promise<SearchSource[]> {
    if (!this.isCurrentSession(session)) {
      throw new Error('search session is no longer active');
    }
    const loading = this.sourceLoad;
    if (loading !== undefined && this.sourceLoadSession === session) {
      return await loading;
    }
    return this.sources;
  }

  /**
   * Entry-surface decision for a freshly loaded source list: `undefined` means
   * the list is usable and the caller keeps its current surface (Initial), any
   * result is the configuration gap the entry must show instead.
   */
  private entryPresentationForSources(sources: SearchSource[]): SearchPresentation | undefined {
    return undefined;
  }

  /** Re-run the source-list load after a sourceLoadError, staying on the same session. */
  private retrySourceLoad(): void {
    const session = this.session;
    const sourceLoad = this.gateway.loadSources();
    this.sourceLoad = sourceLoad;
    this.sourceLoadSession = session;
    sourceLoad
      .then((sources: SearchSource[]): void => {
        if (!this.isCurrentSession(session)) {
          return;
        }
        this.presentSources(sources);
        const entry = this.entryPresentationForSources(sources);
        if (entry !== undefined) {
          this.present(entry);
          return;
        }
        // Sources recovered; the normal entry reset keeps Initial, history and
        // sources coherent.
        this.open();
      })
      .catch((error: Error): void => {
        if (!this.isCurrentSession(session)) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Search source list retry failed: %{private}s', error.message);
        this.present({ kind: 'sourceLoadError' });
      });
  }

  private dedupeSearchResults(results: SearchBook[]): SearchBook[] {
    const deduped: SearchBook[] = [];
    const seenKeys = new Set<string>();
    for (const result of results) {
      const key = `${result.sourceId}\u0000${result.bookId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        deduped.push(result);
      }
    }
    return deduped;
  }

  private presentInitial(): void {
    this.presentation = { kind: 'initial', history: [] };
    this.emitPresentation(this.presentation);
  }

  private present(presentation: SearchPresentation, retainShared: boolean = true): void {
    const previous = this.presentation;
    if (presentation.kind === 'results' && presentation.delta !== undefined &&
      (presentation.delta.baseRevision !== this.resultRevision || presentation.delta.revision <= this.resultRevision)) {
      presentation.delta = undefined;
    }
    let newBooks: SearchBook[] = [];
    if (presentation.kind === 'results') {
      const rawResults = presentation.results;
      if (retainShared && previous.kind === 'results' && previous.keyword === presentation.keyword && this.rawResultsInput === rawResults) {
        presentation.results = previous.results;
        presentation.delta = previous.delta;
      } else if (presentation.delta === undefined) {
        const next = new Map<string, SearchBook>();
        const rawKeys = new Set<string>();
        for (const book of rawResults) {
          const key = `${book.sourceId}\u0000${book.bookId}`;
          rawKeys.add(key);
          const old = this.resultIndex.get(key);
          const retained = retainShared && old !== undefined && old.sourceRuleVersion === book.sourceRuleVersion && old.searchRequestId === book.searchRequestId;
          next.set(key, retained ? old as SearchBook : book);
          if (old === undefined) newBooks.push(book);
        }
        if (retainShared) {
          // Retain only cache-discovered variants. A replaced/removed raw source
          // bucket is authoritative and must not be resurrected by an old frame.
          const enabled = this.run === undefined ? undefined : new Set(this.run.sources.map((source: SearchSource): string => source.sourceId));
          for (const [key, book] of this.resultIndex) if (!next.has(key) && !this.rawIdentityKeys.has(key) &&
            (book.sourceId === 'local' || enabled === undefined || enabled.has(book.sourceId))) next.set(key, book);
        }
        const upserted: SearchBook[] = []; const removedKeys: string[] = [];
        for (const [key, book] of next) if (this.resultIndex.get(key) !== book) upserted.push(book);
        for (const key of this.resultIndex.keys()) if (!next.has(key)) removedKeys.push(key);
        const changed = upserted.length > 0 || removedKeys.length > 0 || previous.kind !== 'results';
        if (changed) {
          presentation.results = Array.from(next.values());
          presentation.delta = { baseRevision: this.resultRevision, revision: this.resultRevision + 1,
            reset: previous.kind !== 'results', upserted, removedKeys };
          this.resultIndex = next;
        } else if (previous.kind === 'results') { presentation.results = previous.results; presentation.delta = previous.delta; }
        if (retainShared) this.rawIdentityKeys = rawKeys;
      }
      this.resultRevision = presentation.delta?.revision ?? this.resultRevision;
      if (retainShared) this.rawResultsInput = rawResults;
    } else {
      this.rawResultsInput = undefined;
      if (presentation.kind === 'loading' || presentation.kind === 'initial') {
        this.resultIndex.clear(); this.rawIdentityKeys.clear();
      }
    }
    this.presentation = presentation;
    this.emitPresentation(presentation);
    if (retainShared && newBooks.length > 0 && this.unsubscribeBooks !== undefined) {
      void this.refreshSharedBooks({ reset: false, identities: newBooks.map((book: SearchBook): RemoteReadingIdentity =>
        ({ sourceId: book.sourceId, bookId: book.bookId })) });
    }
  }

  private presentSources(sources: SearchSource[]): void {
    this.sources = sources;
    this.emitSources(sources);
  }
}
