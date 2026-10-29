import type { SearchResultRelevance } from './SearchResultRelevance';

export type SearchContentType = '全部类型' | '小说' | '漫画';

/** Navigation-owned presentation state. No network work or Core facts live here. */
export class SearchViewState {
  revision: number = 0;
  category: string = '全部';
  contentType: SearchContentType = '全部类型';
  filtersExpanded: boolean = false;
  keywordDraft: string = '';
  private inputFocusRequested: boolean = false;
  anchorKey: string = '';
  anchorIndex: number = 0;
  anchorOffset: number = 0;
  anchorItemY: number = 0;
  /** A semantic List boundary, distinct from a saved numeric offset of zero. */
  anchorAtStart: boolean = true;
  pageRevision: number = 0;
  listRevision: number = 0;
  anchorNeighbors: string[] = [];
  redirects: Map<string, string> = new Map();
  order: Map<string, number> = new Map();
  private relevanceKeyword: string | undefined = undefined;
  private queryRelevance: SearchResultRelevance | undefined = undefined;
  private displayedKeyword: string | undefined = undefined;
  private displayedKeys: string[] = [];

  reset(keyword: string = ''): void {
    this.revision += 1;
    this.category = '全部';
    this.contentType = '全部类型';
    this.filtersExpanded = false;
    this.keywordDraft = keyword;
    this.inputFocusRequested = false;
    this.anchorKey = '';
    this.anchorIndex = 0;
    this.anchorOffset = 0;
    this.anchorItemY = 0;
    this.anchorAtStart = true;
    this.listRevision = 0;
    this.anchorNeighbors = [];
    this.redirects.clear();
    this.order.clear();
    this.relevanceKeyword = undefined;
    this.queryRelevance = undefined;
    this.displayedKeyword = undefined;
    this.displayedKeys = [];
  }

  /** The query survives a Detail round trip. Its exact-title normalization
   * must survive too, rather than repeating locale setup on native remount.
   * A fresh submit/reset or a different keyword discards the whole scorer. */
  relevanceFor(keyword: string, create: () => SearchResultRelevance): SearchResultRelevance {
    if (this.queryRelevance === undefined || this.relevanceKeyword !== keyword) {
      this.queryRelevance = create();
      this.relevanceKeyword = keyword;
    }
    return this.queryRelevance;
  }

  /** Keep the query's visible order through a Detail round trip. Admission
   * ranks still belong to rank(); they cannot reconstruct an already shown
   * relevance-ranked batch after later results have arrived. */
  displayedOrderFor(keyword: string): string[] {
    return this.displayedKeyword === keyword ? this.displayedKeys : [];
  }

  rememberDisplayedOrder(keyword: string, keys: string[]): void {
    this.displayedKeyword = keyword;
    this.displayedKeys = keys;
  }

  requestInputFocus(): void { this.inputFocusRequested = true; }

  consumeInputFocusRequest(): boolean {
    const requested = this.inputFocusRequested;
    this.inputFocusRequested = false;
    return requested;
  }

  rank(key: string, admittedOrder?: number): number {
    let rank = this.order.get(key);
    if (rank === undefined) { rank = admittedOrder ?? this.order.size; this.order.set(key, rank); }
    else if (admittedOrder !== undefined && admittedOrder < rank) { rank = admittedOrder; this.order.set(key, rank); }
    return rank;
  }

  resolveKey(key: string): string {
    const seen = new Set<string>();
    while (this.redirects.has(key) && !seen.has(key)) {
      seen.add(key);
      key = this.redirects.get(key) as string;
    }
    return key;
  }
}
