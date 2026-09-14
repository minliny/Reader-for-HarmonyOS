/** Navigation-owned presentation state. No network work or Core facts live here. */
export class SearchViewState {
  revision: number = 0;
  category: string = '全部';
  keywordDraft: string = '';
  private inputFocusRequested: boolean = false;
  anchorKey: string = '';
  anchorIndex: number = 0;
  anchorOffset: number = 0;
  anchorItemY: number = 0;
  pageRevision: number = 0;
  listRevision: number = 0;
  anchorNeighbors: string[] = [];
  redirects: Map<string, string> = new Map();
  order: Map<string, number> = new Map();

  reset(keyword: string = ''): void {
    this.revision += 1;
    this.category = '全部';
    this.keywordDraft = keyword;
    this.inputFocusRequested = false;
    this.anchorKey = '';
    this.anchorIndex = 0;
    this.anchorOffset = 0;
    this.anchorItemY = 0;
    this.listRevision = 0;
    this.anchorNeighbors = [];
    this.redirects.clear();
    this.order.clear();
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
