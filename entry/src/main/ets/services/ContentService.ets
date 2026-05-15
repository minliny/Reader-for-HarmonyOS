// ContentService — chapter content fetch + parse + cache
// BLOCKED_BY_BRIDGE_RUNTIME for live content
import { BookSource } from '../models/BookSource';
import { ContentPage } from '../models/ContentModels';
import { BridgeClientWithFallback } from './FixtureReplayInterceptor';

const contentCache: Map<string, ContentPage> = new Map();

export class ContentService {
  private client: BridgeClientWithFallback;

  constructor(client: BridgeClientWithFallback) {
    this.client = client;
  }

  async fetchContent(source: BookSource, chapterURL: string): Promise<ContentPage | null> {
    if (!chapterURL || chapterURL.trim().length === 0) { return null; }

    const cacheKey = `${source.bookSourceUrl}::${chapterURL}`;
    const cached = contentCache.get(cacheKey);
    if (cached) { return cached; }

    try {
      const page = await this.client.fetchContent(source, chapterURL);
      contentCache.set(cacheKey, page);
      return page;
    } catch (_e) {
      return null;
    }
  }

  getNextChapterURL(source: BookSource, currentChapterURL: string): string | null {
    const cacheKey = `${source.bookSourceUrl}::${currentChapterURL}`;
    const page = contentCache.get(cacheKey);
    return page?.nextChapterURL ?? null;
  }

  getCachedPage(source: BookSource, chapterURL: string): ContentPage | null {
    const cacheKey = `${source.bookSourceUrl}::${chapterURL}`;
    return contentCache.get(cacheKey) ?? null;
  }

  clearCache(source?: BookSource, chapterURL?: string): void {
    if (source && chapterURL) {
      contentCache.delete(`${source.bookSourceUrl}::${chapterURL}`);
    } else {
      contentCache.clear();
    }
  }

  isFixtureMode(): boolean { return this.client.isFixtureMode(); }
}
