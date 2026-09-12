import {
  SearchGateway,
  type SearchBook,
  type SearchHistory,
  type SearchSource,
} from './SearchGateway';
import type {
  SearchPresentation,
} from './SearchPage';
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
const SEARCH_PARTIAL_PUBLISH_INTERVAL_MS = 16;

/** One isolated source failure; healthy sources continue in the same search. */
interface WorkerFailure {
  source: SearchSource;
  error: string;
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
  /**
   * Completed (ok or failed) sources of the live sweep. stop() reads it to
   * settle an interrupted loading surface with an honest source count.
   */
  private sweepCompletedSourceCount: number = 0;
  /** Scope of the most recent search; an explicit retry uses the same subset. */
  private lastScope: string[] | undefined = undefined;

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
    this.unsubscribeBooks = this.owner.bookAcquisitions?.().subscribe((): void => { void this.refreshSharedBooks(); });
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
    this.sourceLoad = this.gateway.loadSources();
    this.sourceLoadSession = this.session;
    this.work += 1;
    this.wakeDispatchers();
    this.sweepAlive = true;
    this.lastScope = scopeSourceIds === undefined ? undefined : scopeSourceIds.slice();
    this.sweepCompletedSourceCount = 0;
    const work = this.work;
    const session = this.session;
    const searchRequestId = this.gateway.generateSearchRequestId(keyword);
    this.present({ kind: 'loading', keyword: keyword });
    void this.performSearch(work, session, keyword, searchRequestId, this.lastScope);
  }

  /**
   * Stop the live sweep (ACQ-02): supersede the workers so no further source
   * requests are issued and settle the visible surface with what already
   * landed. Partial results stay; stopping is never destructive.
   */
  stop(): void {
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
      });
    }
  }

  /** Re-run the last failed or empty search, or reload sources after a list failure. */
  retry(): void {
    if (this.presentation.kind === 'empty' || this.presentation.kind === 'error') {
      this.search(this.presentation.keyword, this.lastScope);
      return;
    }
    if (this.presentation.kind === 'sourceLoadError') {
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
  }

  /** Logical exit releases the query, including workers waiting for foreground. */
  close(): void {
    this.unsubscribeBooks?.();
    this.unsubscribeBooks = undefined;
    this.sessionOpen = false;
    this.work += 1;
    this.sweepAlive = false;
    this.wakeDispatchers();
  }

  private async refreshSharedBooks(): Promise<void> {
    if (this.refreshPending) { this.refreshAgain = true; return; }
    if (!this.sessionOpen || this.presentation.kind !== 'results') return;
    this.refreshAgain = false;
    this.refreshPending = true;
    const session = this.session;
    const work = this.work;
    const current = this.presentation;
    try {
      const results = await this.gateway.refreshBooks(current.results);
      if (this.isCurrentWork(work, session) && this.presentation === current) {
        this.present({ kind: 'results', keyword: current.keyword, results,
          localSearchFailed: current.localSearchFailed, sourceListFailed: current.sourceListFailed,
          searching: current.searching, stopped: current.stopped, totalSourceCount: current.totalSourceCount,
          completedSourceCount: current.completedSourceCount, failedSourceCount: current.failedSourceCount }, false);
      } else if (this.isCurrentWork(work, session)) {
        this.refreshAgain = true;
      }
    } catch (_error) { /* Keep the latest live results when cache projection fails. */ }
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

  private async performSearch(work: number, session: number, keyword: string,
    searchRequestId: string, scopeSourceIds?: string[]): Promise<void> {
    // Search history is auxiliary. Do not wait for a persistence failure
    // before issuing the user-requested source search.
    void this.gateway.addHistory(keyword)
      .catch((error: Error): void => {
        if (this.isCurrentWork(work, session)) {
          hilog.warn(DOMAIN, 'Reader', 'Search history add failed: %{private}s', error.message);
        }
      });
    let attemptedSourceCount = 0;
    try {
      let localSearchFailed = false;
      let sourceListFailed = false;
      const localAttempt = this.gateway.searchLocalBooks(keyword, searchRequestId)
        .catch((): SearchBook[] => { localSearchFailed = true; return []; });
      const sourceAttempt = this.sourcesForSession(session)
        .catch((): SearchSource[] => { sourceListFailed = true; return []; });
      // Start both paths before awaiting either. A missing online source never
      // prevents searching the imported local collection.
      const sources = await sourceAttempt;
      const localResults = await localAttempt;
      if (!this.isCurrentWork(work, session)) {
        return;
      }
      this.presentSources(sources);
      const scope = scopeSourceIds === undefined ? undefined : new Set<string>(scopeSourceIds);
      const enabled = sources.filter((source) => source.enabled && source.name.trim().length > 0 &&
        readerSourceCategoryIsText(source.category) &&
        (scope === undefined || scope.has(source.sourceId)));
      attemptedSourceCount = enabled.length;
      if (enabled.length === 0) {
        if (localResults.length > 0) {
          this.present({ kind: 'results', keyword, results: localResults, searching: false,
            totalSourceCount: 0, completedSourceCount: 0, failedSourceCount: 0,
            localSearchFailed, sourceListFailed });
        } else if (localSearchFailed || sourceListFailed) {
          this.present({ kind: 'error', keyword, searchedSourceCount: 0, failedSourceCount: 0 });
        } else {
          this.present({ kind: 'empty', keyword, searchedSourceCount: 0, failedSourceCount: 0 });
        }
        return;
      }
      // Bounded, feature-local concurrency: up to MAX_SEARCH_CONCURRENCY
      // workers pull the next enabled source, so wall time tracks the longest
      // sources instead of their sum. Each outcome lands in its registration
      // slot, so streaming partial results share the final stable order.
      // Each source is deduped exactly once when it lands. Partial publishes
      // only concatenate those stable buckets instead of rescanning every
      // previously collected result after every source completion.
      const collectedBySource: Array<SearchBook[] | undefined> = new Array(enabled.length);
      let successfulSourceCount = 0;
      // A broken source is normal in a user-managed Legado source set. Keep
      // its failure isolated so later healthy sources still run and any valid
      // results remain usable. The whole-search error surface is reserved for
      // the case where every enabled source failed.
      const failures: WorkerFailure[] = [];
      let nextSourceIndex = 0;
      let partialPublishScheduled = false;
      let finalized = false;
      // A result may only enter this sweep's surface if it still carries this
      // sweep's searchRequestId: a superseded request's late payload must never
      // bleed into the live list.
      const admitsResult = (book: SearchBook): boolean => book.searchRequestId === searchRequestId;
      const flattenCollected = (): SearchBook[] => {
        const collected: SearchBook[] = localResults.slice();
        for (const bucket of collectedBySource) {
          if (bucket !== undefined) {
            for (const book of bucket) {
              if (admitsResult(book)) {
                collected.push(book);
              }
            }
          }
        }
        return collected;
      };
      // Streaming presentation: every finished source republishes the
      // accumulated, deduped results so cards, per-book source counts and the
      // source counts update live. Until a book exists the Figma
      // loading surface stays up; empty/error stay end-of-sweep verdicts.
      const publishPartial = (): void => {
        if (!this.isCurrentWork(work, session)) {
          return;
        }
        const results = flattenCollected();
        if (results.length === 0) {
          return;
        }
        this.present({
          kind: 'results',
          keyword: keyword,
          results: results,
          searching: true,
          totalSourceCount: attemptedSourceCount,
          completedSourceCount: this.sweepCompletedSourceCount,
          failedSourceCount: failures.length,
          localSearchFailed, sourceListFailed,
        });
      };
      const schedulePartialPublish = (): void => {
        if (partialPublishScheduled || finalized) {
          return;
        }
        partialPublishScheduled = true;
        setTimeout((): void => {
          partialPublishScheduled = false;
          if (!finalized) {
            publishPartial();
          }
        }, SEARCH_PARTIAL_PUBLISH_INTERVAL_MS);
      };
      const worker = async (): Promise<void> => {
        while (true) {
          if (nextSourceIndex >= enabled.length || !await this.waitForDispatch(work, session)) {
            return;
          }
          if (!this.isCurrent()) continue;
          const index = nextSourceIndex;
          nextSourceIndex += 1;
          if (index >= enabled.length) {
            return;
          }
          const source = enabled[index];
          const outcome = await this.gateway.searchBySource(
            source,
            keyword,
            (): boolean => this.isCurrentWork(work, session),
            searchRequestId,
            (): boolean => this.isCurrent(),
          );
          if (!this.isCurrentWork(work, session)) {
            return;
          }
          this.sweepCompletedSourceCount += 1;
          if (outcome.ok === false) {
            failures.push({ source: source, error: outcome.error });
            schedulePartialPublish();
            continue;
          }
          collectedBySource[index] = this.dedupeSearchResults(outcome.results);
          successfulSourceCount += 1;
          schedulePartialPublish();
        }
      };
      publishPartial();
      const workerCount = Math.min(MAX_SEARCH_CONCURRENCY, enabled.length);
      const workerPromises: Array<Promise<void>> = [];
      for (let index = 0; index < workerCount; index += 1) {
        workerPromises.push(worker());
      }
      await Promise.all(workerPromises);
      if (!this.isCurrentWork(work, session)) {
        return;
      }
      // Flush one final streaming snapshot before the closed verdict. This
      // preserves the observable partial-result contract even when every
      // healthy source completes inside the coalescing interval.
      if (partialPublishScheduled) {
        publishPartial();
      }
      finalized = true;
      for (const failure of failures) {
        // P2-9 log hygiene: sourceId is the Legado bookSourceUrl (a URL that
        // must not reach hilog verbatim) and Core error text can embed the
        // request or final redirect URL, so both are reduced before logging.
        hilog.warn(DOMAIN, 'Reader', 'Search source %{private}s failed: %{private}s',
          this.sourceIdentityForLog(failure.source), this.sanitizedLogText(failure.error));
      }
      if (localResults.length === 0 && successfulSourceCount === 0 && failures.length > 0) {
        this.present({
          kind: 'error',
          keyword: keyword,
          searchedSourceCount: attemptedSourceCount,
          failedSourceCount: failures.length,
          localSearchFailed, sourceListFailed,
        });
        return;
      }
      const results: SearchBook[] = flattenCollected();
      if (results.length === 0) {
        this.present({
          kind: 'empty',
          keyword: keyword,
          searchedSourceCount: attemptedSourceCount,
          failedSourceCount: failures.length,
          localSearchFailed, sourceListFailed,
        });
        return;
      }
      this.present({
        kind: 'results',
        keyword: keyword,
        results: results,
        searching: false,
        totalSourceCount: attemptedSourceCount,
        completedSourceCount: this.sweepCompletedSourceCount,
        failedSourceCount: failures.length,
        localSearchFailed, sourceListFailed,
      });
    } catch (error) {
      if (!this.isCurrentWork(work, session)) {
        return;
      }
      const message = errorMessageOf(error);
      hilog.error(DOMAIN, 'Reader', 'Search failed: %{private}s', this.sanitizedLogText(message));
      this.present({
        kind: 'error',
        keyword: keyword,
        searchedSourceCount: attemptedSourceCount,
        failedSourceCount: 0,
      });
    } finally {
      // A paused queue remains alive until it resumes or is explicitly closed.
      if (work === this.work && session === this.session) {
        this.sweepAlive = false;
      }
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
    if (retainShared && presentation.kind === 'results' && previous.kind === 'results' &&
      presentation.keyword === previous.keyword) {
      const results: SearchBook[] = presentation.results.slice();
      const positions = new Map<string, number>();
      for (let index = 0; index < results.length; index += 1) {
        positions.set(`${results[index].sourceId}\u0000${results[index].bookId}`, index);
      }
      for (const book of previous.results) {
        const position = positions.get(`${book.sourceId}\u0000${book.bookId}`);
        if (position === undefined) results.push(book);
        else if (book.acquisition !== undefined && book.sourceRuleVersion === results[position].sourceRuleVersion) results[position] = book;
      }
      presentation.results = results;
    }
    this.presentation = presentation;
    this.emitPresentation(presentation);
    // Core may publish before the first partial result is visible. Refresh
    // the newly admitted identities too, so that notification cannot be lost.
    if (retainShared && presentation.kind === 'results' && this.unsubscribeBooks !== undefined) {
      void this.refreshSharedBooks();
    }
  }

  private presentSources(sources: SearchSource[]): void {
    this.sources = sources;
    this.emitSources(sources);
  }
}
