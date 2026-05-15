// SearchService — search orchestration with bridge/fixture fallback
// BLOCKED_BY_BRIDGE_RUNTIME for live search execution
import { BookSource } from '../models/BookSource';
import { SearchQuery, SearchResultItem } from '../models/SearchModels';
import { BridgeClientWithFallback } from './FixtureReplayInterceptor';
import { BridgeHTTPClient } from './BridgeHTTPClient';

export enum SearchMode {
  LIVE = 'LIVE',
  FIXTURE = 'FIXTURE',
  ERROR = 'ERROR'
}

export interface SearchResult {
  items: SearchResultItem[];
  totalResults: number;
  page: number;
  mode: SearchMode;
  error?: string;
}

export class SearchService {
  private client: BridgeClientWithFallback;

  constructor(client: BridgeClientWithFallback) {
    this.client = client;
  }

  async search(source: BookSource, query: SearchQuery): Promise<SearchResult> {
    // Validate
    if (!source.searchUrl || source.searchUrl.trim().length === 0) {
      return {
        items: [],
        totalResults: 0,
        page: query.page,
        mode: SearchMode.ERROR,
        error: 'Source has no searchUrl configured'
      };
    }

    if (!query.keyword || query.keyword.trim().length === 0) {
      return {
        items: [],
        totalResults: 0,
        page: query.page,
        mode: SearchMode.ERROR,
        error: 'Search keyword is empty'
      };
    }

    try {
      const results = await this.client.search(source, query);
      const mode = this.client.isFixtureMode() ? SearchMode.FIXTURE : SearchMode.LIVE;
      return {
        items: results,
        totalResults: results.length,
        page: query.page,
        mode
      };
    } catch (e) {
      return {
        items: [],
        totalResults: 0,
        page: query.page,
        mode: SearchMode.ERROR,
        error: e instanceof Error ? e.message : 'Unknown search error'
      };
    }
  }

  async searchMultiple(sources: BookSource[], query: SearchQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    for (let i = 0; i < sources.length; i++) {
      const r = await this.search(sources[i], query);
      results.push(r);
    }
    return results;
  }

  // Merge results from multiple sources, deduplicate by detailURL
  mergeResults(allResults: SearchResult[]): SearchResultItem[] {
    const seen: Set<string> = new Set();
    const merged: SearchResultItem[] = [];

    for (let i = 0; i < allResults.length; i++) {
      const items = allResults[i].items;
      for (let j = 0; j < items.length; j++) {
        const item = items[j];
        if (!seen.has(item.detailURL)) {
          seen.add(item.detailURL);
          merged.push(item);
        }
      }
    }
    return merged;
  }

  isLiveMode(): boolean {
    return !this.client.isFixtureMode();
  }
}
