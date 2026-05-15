// TOCService — table of contents fetch + parse + cache
// BLOCKED_BY_BRIDGE_RUNTIME for live TOC
import { BookSource } from '../models/BookSource';
import { TOCItem } from '../models/ContentModels';
import { BridgeClientWithFallback } from './FixtureReplayInterceptor';

const tocCache: Map<string, TOCItem[]> = new Map();

export class TOCService {
  private client: BridgeClientWithFallback;

  constructor(client: BridgeClientWithFallback) {
    this.client = client;
  }

  async fetchTOC(source: BookSource, detailURL: string): Promise<TOCItem[]> {
    if (!detailURL || detailURL.trim().length === 0) {
      return [];
    }

    const cacheKey = `${source.bookSourceUrl}::${detailURL}`;
    const cached = tocCache.get(cacheKey);
    if (cached) { return cached; }

    try {
      const items = await this.client.fetchTOC(source, detailURL);
      tocCache.set(cacheKey, items);
      return items;
    } catch (_e) {
      return [];
    }
  }

  getChapterCount(source: BookSource, detailURL: string): number {
    const cacheKey = `${source.bookSourceUrl}::${detailURL}`;
    const cached = tocCache.get(cacheKey);
    return cached ? cached.length : 0;
  }

  getChapterAt(source: BookSource, detailURL: string, index: number): TOCItem | null {
    const cacheKey = `${source.bookSourceUrl}::${detailURL}`;
    const cached = tocCache.get(cacheKey);
    if (!cached || index < 0 || index >= cached.length) { return null; }
    return cached[index];
  }

  hasNextChapter(source: BookSource, detailURL: string, currentIndex: number): boolean {
    const count = this.getChapterCount(source, detailURL);
    return currentIndex < count - 1;
  }

  hasPrevChapter(currentIndex: number): boolean {
    return currentIndex > 0;
  }

  clearCache(source?: BookSource, detailURL?: string): void {
    if (source && detailURL) {
      tocCache.delete(`${source.bookSourceUrl}::${detailURL}`);
    } else {
      tocCache.clear();
    }
  }

  isFixtureMode(): boolean {
    return this.client.isFixtureMode();
  }
}
