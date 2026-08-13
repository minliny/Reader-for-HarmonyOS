import {
  SearchGateway,
  type SearchBook,
  type SearchHistory,
  type SearchOutcome,
  type SearchSource,
} from './SearchGateway';
import type {
  SearchPresentation,
  SearchScope,
} from './SearchPage';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN = 0x5244;
// Match the already-admitted source-switch fan-out: eight remote probes keep
// all-source search responsive without issuing one unbounded request per
// imported source.
const SEARCH_SOURCE_CONCURRENCY = 8;

interface SearchBatchOutcome {
  results: SearchBook[];
  succeeded: boolean;
}

/**
 * Feature-local bound on how many `book.search` source requests run at once.
 * Bounded so a slow or stuck source cannot stack latency across every enabled
 * source; outcomes are still assembled in source registration order.
 */
const MAX_SEARCH_CONCURRENCY = 4;

/** A failing worker reports which source failed and why. */
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
  /** Session-local UI intent. Undefined means all enabled sources. */
  private scopeSourceId: SearchScope = undefined;
  /** Last submitted keyword; changing scope re-runs only a real search. */
  private keyword: string = '';

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
    this.scopeSourceId = undefined;
    this.keyword = '';
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
      })
      .catch((error: Error): void => {
        if (!this.isCurrentSession(session)) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Search source list failed to load: %{public}s', error.message);
        this.presentSources([]);
      });
    this.gateway.loadHistory()
      .then((history: SearchHistory): void => {
        // A search that started while history was still loading keeps the
        // Loading/Results state; only an untouched Initial surface adopts it.
        if (!this.isCurrentSession(session) || this.presentation.kind !== 'initial') {
          return;
        }
        this.presentWithScope({ kind: 'initial', history: history.keywords });
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

  /** Begin a real search across enabled sources. */
  search(keyword: string): void {
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword.length === 0) {
      return;
    }
    this.keyword = normalizedKeyword;
    this.work += 1;
    const work = this.work;
    const session = this.session;
    this.presentWithScope({ kind: 'loading', keyword: normalizedKeyword });
    void this.performSearch(work, session, normalizedKeyword);
  }

  /** Select all sources (`undefined`) or one exact source and re-run the query. */
  changeScope(sourceId: SearchScope): void {
    if (sourceId !== undefined && sourceId.trim().length === 0) {
      return;
    }
    if (this.scopeSourceId === sourceId) {
      return;
    }
    // sourceId is an opaque Core registry identity; validate blankness without
    // trimming or otherwise deriving a second identity in the UI layer.
    this.scopeSourceId = sourceId;
    if (this.keyword.length > 0 && this.presentation.kind !== 'initial') {
      this.search(this.keyword);
      return;
    }
    this.presentCurrentWithScope();
  }

  /** Re-run the last failed or empty search. */
  retry(): void {
    if (this.presentation.kind === 'empty' || this.presentation.kind === 'error') {
      this.search(this.presentation.keyword);
    }
  }

  /** Clear recent history back to the Initial surface. */
  clearHistory(): void {
    this.work += 1;
    const work = this.work;
    const session = this.session;
    const gateway = this.gateway;
    gateway.clearHistory()
      .then((): Promise<SearchHistory> => gateway.loadHistory())
      .then((history: SearchHistory): void => {
        if (!this.isCurrentWork(work, session)) {
          return;
        }
        this.presentWithScope({ kind: 'initial', history: history.keywords });
      })
      .catch((error: Error): void => {
        if (!this.isCurrentWork(work, session)) {
          return;
        }
        hilog.error(DOMAIN, 'Reader', 'Search history clear failed: %{public}s', error.message);
      });
  }

  private async performSearch(work: number, session: number, keyword: string): Promise<void> {
    // Search history is auxiliary. Do not wait for a persistence failure
    // before issuing the user-requested source search.
    void this.gateway.addHistory(keyword)
      .catch((error: Error): void => {
        if (this.isCurrentWork(work, session)) {
          hilog.warn(DOMAIN, 'Reader', 'Search history add failed: %{public}s', error.message);
        }
      });
    try {
      const sources = await this.sourcesForSession(session);
      if (!this.isCurrentWork(work, session)) {
        return;
      }
      this.presentSources(sources);
      const selected = this.selectedSources(sources);
      if (selected.length === 0) {
        this.presentWithScope({ kind: 'error', keyword: keyword });
        return;
      }
      // Bounded, feature-local concurrency: up to MAX_SEARCH_CONCURRENCY
      // workers pull the next enabled source, so wall time tracks the longest
      // sources instead of their sum. Each outcome lands in its registration
      // slot, keeping the final result order stable.
      const outcomes: Array<SearchOutcome | undefined> = new Array(enabled.length);
      let nextSourceIndex = 0;
      // Shared cancellation flag. Read and written only inside the worker
      // closures; the failure itself flows out through the worker return value
      // so the post-await code reads a fresh local, never a captured variable.
      let failedSource: SearchSource | undefined = undefined;
      const worker = async (): Promise<WorkerFailure | undefined> => {
        while (true) {
          if (!this.isCurrentWork(work, session) || failedSource !== undefined) {
            return undefined;
          }
          const index = nextSourceIndex;
          nextSourceIndex += 1;
          if (index >= enabled.length) {
            return undefined;
          }
          const source = enabled[index];
          const outcome = await this.gateway.searchBySource(
            source,
            keyword,
            (): boolean => this.isCurrentWork(work, session) && failedSource === undefined,
          );
          if (!this.isCurrentWork(work, session)) {
            return undefined;
          }
          if (outcome.ok === false) {
            failedSource = source;
            const failure: WorkerFailure = { source: source, error: outcome.error };
            return failure;
          }
          outcomes[index] = outcome;
        }
      };
      const workerCount = Math.min(MAX_SEARCH_CONCURRENCY, enabled.length);
      const workerPromises: Array<Promise<WorkerFailure | undefined>> = [];
      for (let index = 0; index < workerCount; index += 1) {
        workerPromises.push(worker());
      }
      const failures: Array<WorkerFailure | undefined> = await Promise.all(workerPromises);
      if (!this.isCurrentWork(work, session)) {
        return;
      }
      let failed: WorkerFailure | undefined = undefined;
      for (const failure of failures) {
        if (failure !== undefined) {
          failed = failure;
          break;
        }
      }
      if (failed !== undefined) {
        hilog.warn(DOMAIN, 'Reader', 'Search source %{public}s failed: %{public}s',
          failed.source.sourceId, failed.error);
        this.present({ kind: 'error', keyword: keyword });
        return;
      }
      const results: SearchBook[] = [];
      for (const outcome of outcomes) {
        if (outcome !== undefined && outcome.ok === true) {
          for (const book of outcome.results) {
            results.push(book);
          }
        }
      }
      const deduped = this.dedupeSearchResults(results);
      if (deduped.length > 0) {
        this.presentWithScope({ kind: 'results', keyword: keyword, results: deduped });
        return;
      }
      if (succeededCount === selected.length) {
        this.presentWithScope({ kind: 'empty', keyword: keyword });
        return;
      }
      this.presentWithScope({ kind: 'error', keyword: keyword });
    } catch (error) {
      if (!this.isCurrentWork(work, session)) {
        return;
      }
      const message = error instanceof Error ? error.message : `${error}`;
      hilog.error(DOMAIN, 'Reader', 'Search failed: %{public}s', message);
      this.presentWithScope({ kind: 'error', keyword: keyword });
    }
  }

  private async searchSource(
    source: SearchSource,
    keyword: string,
    work: number,
    session: number,
  ): Promise<SearchBatchOutcome> {
    const outcome = await this.gateway.searchBySource(
      source,
      keyword,
      (): boolean => this.isCurrentWork(work, session),
    );
    if (outcome.ok === false) {
      if (this.isCurrentWork(work, session)) {
        hilog.warn(DOMAIN, 'Reader', 'Search source %{public}s failed: %{public}s',
          source.sourceId, outcome.error);
      }
      const failed: SearchBatchOutcome = { results: [], succeeded: false };
      return failed;
    }
    const succeeded: SearchBatchOutcome = { results: outcome.results, succeeded: true };
    return succeeded;
  }

  private selectedSources(sources: SearchSource[]): SearchSource[] {
    const selected: SearchSource[] = [];
    for (const source of sources) {
      if (!source.enabled || source.name.trim().length === 0) {
        continue;
      }
      if (this.scopeSourceId === undefined || source.sourceId === this.scopeSourceId) {
        selected.push(source);
      }
    }
    return selected;
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

  private dedupeSearchResults(results: SearchBook[]): SearchBook[] {
    const deduped: SearchBook[] = [];
    const seenKeys = new Set<string>();
    for (const result of results) {
      const key = `${result.sourceId} ${result.bookId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        deduped.push(result);
      }
    }
    return deduped;
  }

  private presentInitial(): void {
    this.presentation = { kind: 'initial', history: [], scopeSourceId: this.scopeSourceId };
    this.emitPresentation(this.presentation);
  }

  private presentWithScope(presentation: SearchPresentation): void {
    if (presentation.kind === 'initial') {
      this.present({ kind: 'initial', history: presentation.history, scopeSourceId: this.scopeSourceId });
    } else if (presentation.kind === 'loading') {
      this.present({ kind: 'loading', keyword: presentation.keyword, scopeSourceId: this.scopeSourceId });
    } else if (presentation.kind === 'results') {
      this.present({
        kind: 'results',
        keyword: presentation.keyword,
        results: presentation.results,
        scopeSourceId: this.scopeSourceId,
      });
    } else if (presentation.kind === 'empty') {
      this.present({ kind: 'empty', keyword: presentation.keyword, scopeSourceId: this.scopeSourceId });
    } else {
      this.present({ kind: 'error', keyword: presentation.keyword, scopeSourceId: this.scopeSourceId });
    }
  }

  private presentCurrentWithScope(): void {
    this.presentWithScope(this.presentation);
  }

  private present(presentation: SearchPresentation): void {
    this.presentation = presentation;
    this.emitPresentation(presentation);
  }

  private presentSources(sources: SearchSource[]): void {
    const visible: SearchSource[] = [];
    for (const source of sources) {
      if (source.enabled && source.name.trim().length > 0) {
        visible.push(source);
      }
    }
    this.sources = visible;
    this.emitSources(visible);
  }
}
