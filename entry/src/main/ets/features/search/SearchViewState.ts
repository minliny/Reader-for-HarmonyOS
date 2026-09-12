/** Navigation-owned presentation state. No network work or Core facts live here. */
export class SearchViewState {
  revision: number = 0;
  category: string = '全部';
  keywordDraft: string = '';
  historyExpanded: boolean = false;
  anchorKey: string = '';
  anchorIndex: number = 0;
  anchorOffset: number = 0;
  anchorItemY: number = 0;
  order: Map<string, number> = new Map();

  reset(keyword: string = ''): void {
    this.revision += 1;
    this.category = '全部';
    this.keywordDraft = keyword;
    this.historyExpanded = false;
    this.anchorKey = '';
    this.anchorIndex = 0;
    this.anchorOffset = 0;
    this.anchorItemY = 0;
    this.order.clear();
  }

  rank(key: string): number {
    let rank = this.order.get(key);
    if (rank === undefined) { rank = this.order.size; this.order.set(key, rank); }
    return rank;
  }
}
