import type { RemoteReadingGatewayError } from '../application/RemoteReadingContract';
import type { ReadingSessionFlowGateway, ReadingContentSearchCacheScope, ReadingContentSearchPage, ReadingContentSearchResult } from '../application/ReadingSessionFlowGateway';

interface ReaderQuickSearchIdleState {
  kind: 'idle';
}

interface ReaderQuickSearchLoadingState {
  kind: 'loading';
  keyword: string;
}

export interface ReaderQuickSearchResultsState {
  kind: 'results';
  keyword: string;
  cacheScope?: ReadingContentSearchCacheScope;
  results: ReadingContentSearchResult[];
  /** Number of matches consumed from Core's stable result stream. */
  offset?: number;
  /** Core observed another match beyond this bounded page. */
  hasMore?: boolean;
  /** A subsequent page is being fetched while existing rows remain visible. */
  loadingMore?: boolean;
  /** The displayed rows remain usable after this visit releases its cursor. */
  paginationRetired?: boolean;
  loadMoreError?: string;
  /** Retry permission is separate from the last successful Core continuation fact. */
  continuationRetryable?: boolean;
}

interface ReaderQuickSearchEmptyState {
  kind: 'empty';
  keyword: string;
  cacheScope?: ReadingContentSearchCacheScope;
}

interface ReaderQuickSearchErrorState {
  kind: 'error';
  message: string;
}

export type ReaderQuickSearchState =
  | ReaderQuickSearchIdleState
  | ReaderQuickSearchLoadingState
  | ReaderQuickSearchResultsState
  | ReaderQuickSearchEmptyState
  | ReaderQuickSearchErrorState;

/** Sole owner of search generation, cursor and result publication. Only a numeric
 * revision crosses ArkUI @Prop; animation frames never clone accumulated rows. */
export class ReaderContentSearchPublication {
  private state: ReaderQuickSearchState = { kind: 'idle' };
  private generation: number = 0;
  private bookId: string = '';
  private gateway: ReadingSessionFlowGateway | undefined = undefined;
  private cursor: string | undefined = undefined;
  private resultKeys: Set<string> = new Set<string>();
  private resultScrollVisit: number = 0;
  private resultScrollSequence: number = 0;
  private resultScrollScope: number = 0;
  private resultScrollAnchorRows: number = 0;

  publish(state: ReaderQuickSearchState): void {
    if (this.resultScrollScope === 0 || state.kind !== 'results' || this.state.kind !== 'results' ||
      state.keyword !== this.state.keyword || state.results !== this.state.results) {
      this.resultScrollScope = state.kind === 'results' ? ++this.resultScrollSequence : 0;
      this.resultScrollAnchorRows = 0;
    }
    if (state.kind === 'results' && (this.state.kind !== 'results' || this.state.results !== state.results)) {
      this.resultKeys = new Set<string>();
      for (const result of state.results) this.resultKeys.add(this.key(result));
    } else if (state.kind !== 'results') this.resultKeys.clear();
    this.state = state;
  }
  stateAt(_revision: number): ReaderQuickSearchState { return this.state; }

  attachResultScroll(): number { return ++this.resultScrollVisit; }

  detachResultScroll(visit: number): void {
    if (visit === this.resultScrollVisit) this.resultScrollVisit += 1;
  }

  resultScrollScopeFor(state: ReaderQuickSearchState): number {
    return state === this.state ? this.resultScrollScope : 0;
  }

  resultScrollAnchor(visit: number, scope: number): number {
    return this.ownsResultScroll(visit, scope) ? this.resultScrollAnchorRows : 0;
  }

  rememberResultScroll(visit: number, scope: number, anchorRows: number): void {
    if (this.ownsResultScroll(visit, scope) && Number.isFinite(anchorRows) && anchorRows >= 0) {
      this.resultScrollAnchorRows = anchorRows;
    }
  }

  private ownsResultScroll(visit: number, scope: number): boolean {
    return visit > 0 && visit === this.resultScrollVisit && scope > 0 && scope === this.resultScrollScope;
  }

  cancel(): void {
    this.cancelRequest();
    this.resultScrollScope = 0;
    this.resultScrollAnchorRows = 0;
  }

  private cancelRequest(): void {
    this.generation += 1;
    const cursor = this.cursor;
    const gateway = this.gateway;
    this.cursor = undefined;
    this.gateway = undefined;
    if (cursor !== undefined && gateway !== undefined) this.release(gateway, cursor);
  }

  retirePresentation(): boolean {
    const previous = this.state;
    this.cancelRequest();
    if (previous.kind === 'loading') {
      this.publish({ kind: 'idle' });
      return true;
    }
    if (previous.kind !== 'results' || (previous.hasMore !== true && previous.loadingMore !== true)) return false;
    // Keep admitted anchors selectable. The released cursor cannot append a
    // later snapshot to these rows, even when the query text is unchanged.
    this.publish({ kind: 'results', keyword: previous.keyword, results: previous.results,
      cacheScope: previous.cacheScope,
      offset: previous.offset, hasMore: previous.hasMore, loadingMore: false, paginationRetired: true });
    return true;
  }

  run(gateway: ReadingSessionFlowGateway, bookId: string, keyword: string, limit: number,
    active: () => boolean, changed: () => void): void {
    this.cancel();
    this.gateway = gateway;
    this.bookId = bookId;
    const generation = this.generation;
    const current = (): boolean => this.generation === generation && active();
    this.publish({ kind: 'loading', keyword });
    changed();
    const cacheScope = gateway.readContentSearchCacheScope?.(bookId, current)
      .catch((_error: Error): undefined => undefined);
    const first = gateway.searchContentPage(bookId, keyword, limit, 0, current);
    // Admit one scope observation with the first page. Cache writes do not
    // publish a new search revision or change the existing result list.
    void Promise.all([first, cacheScope]).then((results): void => {
      const page = results[0];
      const scope = results[1];
      if (!current()) { this.releasePage(gateway, page); return; }
      this.cursor = page.nextCursor;
      this.publish(page.results.length === 0 ? { kind: 'empty', keyword, cacheScope: scope } : {
        kind: 'results', keyword, cacheScope: scope, results: page.results, offset: page.results.length,
        hasMore: page.hasMore, loadingMore: false,
      });
      changed();
    }).catch((error: Error): void => {
      if (!current()) return;
      this.publish({ kind: 'error', message: error.message });
      changed();
    });
  }

  more(bookId: string, limit: number, active: () => boolean, changed: () => void): void {
    const before = this.state;
    const gateway = this.gateway;
    if (!active() || bookId !== this.bookId) return;
    if (gateway === undefined || before.kind !== 'results' || before.hasMore !== true || before.loadingMore === true || before.paginationRetired === true ||
      (before.loadMoreError !== undefined && before.continuationRetryable !== true)) return;
    const generation = this.generation;
    const current = (): boolean => this.generation === generation && active();
    const offset = before.offset === undefined ? before.results.length : before.offset;
    if (!Number.isSafeInteger(offset) || offset < 0) return;
    const cursor = this.cursor;
    this.publish({ kind: 'results', keyword: before.keyword, results: before.results,
      cacheScope: before.cacheScope,
      offset: before.offset, hasMore: before.hasMore, loadingMore: true, loadMoreError: undefined });
    changed();
    void gateway.searchContentPage(bookId, before.keyword, limit, offset, current, cursor).then((page): void => {
      if (!current() || this.state.kind !== 'results') { this.releasePage(gateway, page); return; }
      // A single in-flight continuation plus stable identities prevents retry append duplication.
      const latest = this.state;
      const merged = latest.results;
      let appended = 0;
      for (const result of page.results) {
        const key = this.key(result);
        if (this.resultKeys.has(key)) continue;
        this.resultKeys.add(key);
        merged.push(result);
        appended += 1;
      }
      if (page.hasMore && appended === 0) {
        this.releasePage(gateway, page);
        if (cursor !== undefined) this.release(gateway, cursor);
        this.cursor = undefined;
        this.publish({ kind: 'results', keyword: before.keyword, results: merged, cacheScope: before.cacheScope,
          offset: offset + page.results.length, hasMore: page.hasMore, loadingMore: false,
          paginationRetired: true, continuationRetryable: false, loadMoreError: '后续结果未能继续，请重新搜索' });
        changed();
        return;
      }
      this.cursor = page.nextCursor;
      // A final receipt may remain retryable in Core; proactively release its session.
      if (!page.hasMore && cursor !== undefined) this.release(gateway, cursor);
      // Exact cursor append preserves the existing prefix and its scroll anchor.
      this.state = { kind: 'results', keyword: before.keyword, results: merged, cacheScope: before.cacheScope,
        offset: offset + page.results.length, hasMore: page.hasMore, loadingMore: false };
      changed();
    }).catch((error: Error): void => {
      if (!current() || this.state.kind !== 'results') return;
      // Core keeps the last receipt for an exact cursor replay. Retain that
      // token after a transient/unknown failure, including a lost response;
      // never fall back to offset or merge a newly acquired snapshot. A stale
      // or expired snapshot explicitly requires a new search instead.
      const latest = this.state;
      if (latest.kind !== 'results') return;
      const failure = error as RemoteReadingGatewayError;
      const retryable = cursor !== undefined && failure.code !== 'positionContextStale' &&
        failure.code !== 'sourceVersionChanged' && failure.code !== 'invalidInput';
      this.publish({ kind: 'results', keyword: latest.keyword, results: latest.results, cacheScope: latest.cacheScope,
        offset: latest.offset, hasMore: latest.hasMore, continuationRetryable: retryable,
        paginationRetired: !retryable, loadingMore: false, loadMoreError: error.message });
      if (!retryable) {
        if (cursor !== undefined) this.release(gateway, cursor);
        this.cursor = undefined;
      }
      changed();
    });
  }

  /** Layout/scroll demand may advance only a healthy, exact continuation. */
  needMore(bookId: string, limit: number, active: () => boolean, changed: () => void): void {
    const state = this.state;
    if (state.kind !== 'results' || state.loadMoreError !== undefined || state.paginationRetired === true ||
      state.loadingMore === true || state.hasMore !== true) return;
    if (this.cursor === undefined) {
      this.publish({ kind: 'results', keyword: state.keyword, results: state.results, cacheScope: state.cacheScope, offset: state.offset,
        hasMore: state.hasMore, loadingMore: false, paginationRetired: true, continuationRetryable: false });
      changed();
      return;
    }
    this.more(bookId, limit, active, changed);
  }

  private key(result: ReadingContentSearchResult): string {
    return `${result.sourceId}\u0000${result.bookId}\u0000${result.chapterIndex}\u0000${result.chapterOffset}`;
  }
  private releasePage(gateway: ReadingSessionFlowGateway, page: ReadingContentSearchPage): void {
    if (page.nextCursor !== undefined) this.release(gateway, page.nextCursor);
  }
  private release(gateway: ReadingSessionFlowGateway, cursor: string): void {
    // Cleanup is best effort; Core also owns bounded idle and absolute expiry.
    void gateway.closeContentSearch(cursor).catch((_error: Error): void => {});
  }
}
