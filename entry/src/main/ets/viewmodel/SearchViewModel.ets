// SearchViewModel — drives SearchTab/SearchPage.
//
// Searches across all imported sources via BookApi.search (Rust Core).
// Row type matches the legacy HomeSearchRow fields so UI field accesses don't
// change (strangler: business source switched, UI layout preserved).
import { ReaderCoreClient } from '../api/ReaderCoreClient';
import { BookApi, SearchBook } from '../api/BookApi';

export interface SearchRow {
  title: string;
  author: string;
  detailURL: string;
  intro: string;
  sourceId: string;
}

export class SearchViewModel {
  private client: ReaderCoreClient;
  private bookApi: BookApi;

  constructor() {
    this.client = ReaderCoreClient.get();
    this.bookApi = new BookApi(this.client);
  }

  async search(keyword: string): Promise<SearchRow[]> {
    const trimmed = keyword.trim();
    if (trimmed.length === 0) {
      return [];
    }
    const sourceIds = await this.getSourceIds();
    if (sourceIds.length === 0) {
      return [];
    }
    const allResults: SearchBook[] = [];
    for (let i = 0; i < sourceIds.length; i++) {
      try {
        const results = await this.bookApi.search(sourceIds[i], trimmed, 1);
        for (let j = 0; j < results.length; j++) {
          allResults.push(results[j]);
        }
      } catch (_e) {
        // single source failure does not block others
      }
    }
    const rows: SearchRow[] = [];
    for (let i = 0; i < allResults.length; i++) {
      const r = allResults[i];
      const row: SearchRow = {
        title: r.name,
        author: r.author,
        detailURL: r.bookUrl,
        intro: r.intro,
        sourceId: r.origin
      };
      rows.push(row);
    }
    return rows;
  }

  private async getSourceIds(): Promise<string[]> {
    try {
      const requestId = this.client.sendCommand('source.list', {} as Record<string, Object>);
      const data = await this.client.awaitResult(requestId, 5000);
      const obj = data as Record<string, Object>;
      const arrValue = obj['sources'];
      if (!(arrValue instanceof Array)) {
        return [];
      }
      const arr = arrValue as Object[];
      const ids: string[] = [];
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i] as Record<string, Object>;
        const idValue = s['bookSourceUrl'];
        if (typeof idValue === 'string') {
          ids.push(idValue as string);
        }
      }
      return ids;
    } catch (_e) {
      return [];
    }
  }
}
