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
  private isCurrent: () => boolean;
  /** Authoritative mirror; Index's @State is a projection of it. */
  private presentation: SearchPresentation = { kind: 'initial', history: [] };
  private sources: SearchSource[] = [];
  /** Bumped on every entry into Search; stale-entry async work is dropped. */
  private session: number = 0;
  /** Bumped on every submit/clear; a newer submit supersedes an older one. */
  private work: number = 0;
  private sourceLoad: Promise<SearchSource[]> | undefined = undefined;
  private sourceLoadSession: number = 0;
  /**
   * True while a sweep is still winding through its workers for the live
   * session/work. Leaving the route cancels a sweep's requests and drops its
   * terminal publish, so the last partial (searching:true) would otherwise
   * read as a live sweep forever; resumeStaleSweep uses this flag to tell
   * that residue apart from a genuinely running sweep.
   */
  private sweepAlive: boolean = false;
  /**
   * Completed (ok or failed) sources of the live sweep. stop() reads it to
   * settle an interrupted loading surface with an honest source count.
   */
  private sweepCompletedSourceCount: number = 0;
  /** Scope of the most recent search; retry/resume re-run the same subset. */
  private lastScope: string[] | undefined = undefined;

  constructor(
    emitPresentation: (presentation: SearchPresentation) => void,
    emitSources: (sources: SearchSource[]) => void,
    isCurrent: () => boolean,
    owner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(),
  ) {
    this.gateway = new SearchGateway(owner);
    this.emitPresentation = emitPresentation;
    this.emitSources = emitSources;
    this.isCurrent = isCurrent;
  }

  /** Enter the Search page: invalidate prior entries, load sources + history. */
  open(): void {
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
        // A fresh entry whose source list is empty or fully disabled cannot
        // offer the Initial search surface; surface the configuration gap
        // instead. A user who already left Initial keeps their state.
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
        hilog.error(DOMAIN, 'Reader', 'Search source list failed to load: %{public}s', error.message);
        if (this.presentation.kind === 'initial') {
          this.present({ kind: 'sourceLoadError' });
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
        hilog.error(DOMAIN, 'Reader', 'Search history failed to load: %{public}s', error.message);
        // An unavailable history has no admitted error state. Keep the empty
        // Initial Figma state; it must not block a real search.
      });
  }

  /**
   * Begin a real search across enabled sources. An explicit `scopeSourceIds`
   * subset (ACQ-02) restricts the sweep to those sources; omitted scope means
   * all enabled sources. The scope is retained so retry/resume re-run the
   * same subset instead of silently widening it.
   */
  search(keyword: string, scopeSourceIds?: string[]): void {
    if (keyword.trim().length === 0) {
      return;
    }
    this.work += 1;
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
      this.sweepAlive = false;
      hilog.info(DOMAIN, 'Reader', 'Search sweep stopped by user: %{public}s', presentation.keyword);
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
      this.sweepAlive = false;
      hilog.info(DOMAIN, 'Reader', 'Search sweep stopped by user: %{public}s', presentation.keyword);
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

  /**
   * Restore a search whose route was re-entered without a fresh open(): if the
   * visible presentation still claims an in-flight sweep but no sweep is
   * running — leaving the route cancelled its requests and dropped its
   * terminal publish — re-run the same keyword. A live sweep keeps its
   * course; restoring the route re-arms its guards and it settles alone.
   */
  resumeStaleSweep(): void {
    if (!this.isCurrent()) {
      return;
    }
    const presentation = this.presentation;
    if (presentation.kind !== 'results') {
      return;
    }
    if (!presentation.searching || this.sweepAlive) {
      return;
    }
    this.search(presentation.keyword, this.lastScope);
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
        hilog.error(DOMAIN, 'Reader', 'Search source list failed to refresh: %{public}s', error.message);
        // Keep the current presentation; the next explicit action retries.
      });
  }

  /** Clear recent history back to the Initial surface. */
  clearHistory(): void {
    this.work += 1;
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
        hilog.error(DOMAIN, 'Reader', 'Search history clear failed: %{public}s', error.message);
      });
  }

  private async performSearch(work: number, session: number, keyword: string,
    searchRequestId: string, scopeSourceIds?: string[]): Promise<void> {
    // Search history is auxiliary. Do not wait for a persistence failure
    // before issuing the user-requested source search.
    void this.gateway.addHistory(keyword)
      .catch((error: Error): void => {
        if (this.isCurrentWork(work, session)) {
          hilog.warn(DOMAIN, 'Reader', 'Search history add failed: %{public}s', error.message);
        }
      });
    let attemptedSourceCount = 0;
    try {
      const sources = await this.sourcesForSession(session);
      if (!this.isCurrentWork(work, session)) {
        return;
      }
      this.presentSources(sources);
      const scope = scopeSourceIds === undefined ? undefined : new Set<string>(scopeSourceIds);
      const enabled = sources.filter((source) => source.enabled && source.name.trim().length > 0 &&
        (scope === undefined || scope.has(source.sourceId)));
      attemptedSourceCount = enabled.length;
      if (enabled.length === 0) {
        if (scopeSourceIds !== undefined &&
          sources.some((source) => source.enabled && source.name.trim().length > 0)) {
          // The scope excluded every usable source: an honest empty verdict for
          // this attempt, not a missing-source configuration gap.
          this.present({ kind: 'empty', keyword: keyword, searchedSourceCount: 0, failedSourceCount: 0 });
          return;
        }
        // Zero enabled sources is a configuration gap, not a network failure:
        // route the user to the add/enable-source flow instead of the generic
        // search-error surface.
        this.present({
          kind: 'sourceRequired',
          reason: sources.length === 0 ? 'noSources' : 'allDisabled',
        });
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
        const collected: SearchBook[] = [];
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
      // source-count ranking update live. Until a book exists the Figma
      // loading surface stays up; empty/error stay end-of-sweep verdicts.
      const publishPartial = (): void => {
        if (!this.isCurrentWork(work, session) || successfulSourceCount === 0) {
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
          if (!this.isCurrentWork(work, session)) {
            return;
          }
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
        hilog.warn(DOMAIN, 'Reader', 'Search source %{public}s failed: %{public}s',
          failure.source.sourceId, failure.error);
      }
      if (successfulSourceCount === 0 && failures.length > 0) {
        this.present({
          kind: 'error',
          keyword: keyword,
          searchedSourceCount: attemptedSourceCount,
          failedSourceCount: failures.length,
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
      });
    } catch (error) {
      if (!this.isCurrentWork(work, session)) {
        return;
      }
      const message = errorMessageOf(error);
      hilog.error(DOMAIN, 'Reader', 'Search failed: %{public}s', message);
      this.present({
        kind: 'error',
        keyword: keyword,
        searchedSourceCount: attemptedSourceCount,
        failedSourceCount: 0,
      });
    } finally {
      // A sweep ended by route-leave cancellation publishes nothing: workers
      // exit early and the terminal present is dropped. Marking it dead here
      // is what lets resumeStaleSweep recognize the searching:true residue.
      if (work === this.work && session === this.session) {
        this.sweepAlive = false;
      }
    }
  }

  private isCurrentSession(session: number): boolean {
    return this.isCurrent() && session === this.session;
  }

  private isCurrentWork(work: number, session: number): boolean {
    return this.isCurrent() && session === this.session && work === this.work;
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
    if (sources.length === 0) {
      return { kind: 'sourceRequired', reason: 'noSources' };
    }
    const enabled = sources.filter((source) => source.enabled && source.name.trim().length > 0);
    if (enabled.length === 0) {
      return { kind: 'sourceRequired', reason: 'allDisabled' };
    }
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
        hilog.error(DOMAIN, 'Reader', 'Search source list retry failed: %{public}s', error.message);
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

  private present(presentation: SearchPresentation): void {
    this.presentation = presentation;
    this.emitPresentation(presentation);
  }

  private presentSources(sources: SearchSource[]): void {
    this.sources = sources;
    this.emitSources(sources);
  }
}
