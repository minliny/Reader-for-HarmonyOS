import type { ReaderQuickSearchState } from './ReaderQuickSearchPanel';
import type { ReadingSessionFlowGateway, ReadingContentSearchPage, ReadingContentSearchResult } from './ReadingSessionFlowGateway';

/** Sole owner of search generation, cursor and result publication. Only a numeric
 * revision crosses ArkUI @Prop; animation frames never clone accumulated rows. */
export class ReaderContentSearchPublication {
  private state: ReaderQuickSearchState = { kind: 'idle' };
  private generation: number = 0;
  private gateway: ReadingSessionFlowGateway | undefined = undefined;
  private cursor: string | undefined = undefined;

  publish(state: ReaderQuickSearchState): void { this.state = state; }
  stateAt(_revision: number): ReaderQuickSearchState { return this.state; }

  cancel(): void {
    this.generation += 1;
    const cursor = this.cursor;
    const gateway = this.gateway;
    this.cursor = undefined;
    this.gateway = undefined;
    if (cursor !== undefined && gateway !== undefined) this.release(gateway, cursor);
  }

  run(gateway: ReadingSessionFlowGateway, bookId: string, keyword: string, limit: number,
    active: () => boolean, changed: () => void): void {
    this.cancel();
    this.gateway = gateway;
    const generation = this.generation;
    const current = (): boolean => this.generation === generation && active();
    this.publish({ kind: 'loading', keyword });
    changed();
    void gateway.searchContentPage(bookId, keyword, limit, 0, current).then((page): void => {
      if (!current()) { this.releasePage(gateway, page); return; }
      this.cursor = page.nextCursor;
      this.publish(page.results.length === 0 ? { kind: 'empty', keyword } : {
        kind: 'results', keyword, results: page.results, offset: page.results.length,
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
    if (gateway === undefined || before.kind !== 'results' || before.hasMore !== true || before.loadingMore === true) return;
    const generation = this.generation;
    const current = (): boolean => this.generation === generation && active();
    const offset = before.offset === undefined ? before.results.length : before.offset;
    if (!Number.isSafeInteger(offset) || offset < 0) return;
    const cursor = this.cursor;
    this.publish({ kind: 'results', keyword: before.keyword, results: before.results,
      offset: before.offset, hasMore: before.hasMore, loadingMore: true, loadMoreError: undefined });
    changed();
    void gateway.searchContentPage(bookId, before.keyword, limit, offset, current, cursor).then((page): void => {
      if (!current() || this.state.kind !== 'results') { this.releasePage(gateway, page); return; }
      // A single in-flight continuation plus stable identities prevents retry append duplication.
      const latest = this.state;
      const seen = new Set<string>(latest.results.map((result: ReadingContentSearchResult): string => this.key(result)));
      const merged = latest.results.slice();
      for (const result of page.results) {
        const key = this.key(result);
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(result);
      }
      this.cursor = page.nextCursor;
      // A final receipt may remain retryable in Core; proactively release its session.
      if (!page.hasMore && cursor !== undefined) this.release(gateway, cursor);
      this.publish({ kind: 'results', keyword: before.keyword, results: merged,
        offset: offset + page.results.length, hasMore: page.hasMore, loadingMore: false });
      changed();
    }).catch((error: Error): void => {
      if (!current() || this.state.kind !== 'results') return;
      // Never merge a new snapshot through offset fallback after cursor failure.
      // Keep visible hits and require a new search to obtain a new position space.
      const latest = this.state;
      if (latest.kind !== 'results') return;
      this.publish({ kind: 'results', keyword: latest.keyword, results: latest.results,
        offset: latest.offset, hasMore: false, loadingMore: false, loadMoreError: error.message });
      if (cursor !== undefined) this.release(gateway, cursor);
      this.cursor = undefined;
      changed();
    });
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
