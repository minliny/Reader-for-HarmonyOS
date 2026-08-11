import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';

export type DiscoverKind = {
  title: string;
  url: string;
};

export type DiscoverBook = {
  sourceId: string;
  bookId: string;
  name: string;
  author: string;
  coverUrl: string;
  intro: string;
};

export type DiscoverSource = {
  sourceId: string;
  name: string;
};

/**
 * Feature-local gateway for Discover. Owns the `source.exploreKinds` and
 * `source.explore` boundary. Both commands need a stored + enabled source that
 * declares an explore URL and require the `http.execute` host transport (the
 * Core resolves the pending http continuation before the promise settles).
 */
export class DiscoverGateway {
  private readonly runtimeOwner: ReaderRuntimeOwner;

  constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current()) {
    this.runtimeOwner = runtimeOwner;
  }

  async loadExploreKinds(sourceId: string): Promise<DiscoverKind[]> {
    const result = await this.runtimeOwner.request('source.exploreKinds', { sourceId });
    const raw = result.data['kinds'];
    if (!Array.isArray(raw)) {
      throw new Error('source.exploreKinds returned invalid data');
    }
    const kinds: DiscoverKind[] = [];
    for (const item of raw) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const obj = item as JsonObject;
      const title = this.string(obj, 'title');
      const url = this.string(obj, 'url');
      if (title === undefined || url === undefined) {
        continue;
      }
      kinds.push({ title, url });
    }
    return kinds;
  }

  async loadExplore(sourceId: string, url: string, page: number): Promise<DiscoverBook[]> {
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new Error('source.explore page must be a positive safe integer');
    }
    const result = await this.runtimeOwner.request('source.explore', { sourceId, url, page });
    const raw = result.data['books'];
    if (!Array.isArray(raw)) {
      throw new Error('source.explore returned invalid data');
    }
    const books: DiscoverBook[] = [];
    for (const item of raw) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      const obj = item as JsonObject;
      const bookId = this.string(obj, 'bookId');
      const name = this.string(obj, 'name');
      if (bookId === undefined || name === undefined) {
        continue;
      }
      books.push({
        sourceId: this.string(obj, 'sourceId') ?? sourceId,
        bookId,
        name,
        author: this.string(obj, 'author') ?? '',
        coverUrl: this.string(obj, 'coverUrl') ?? '',
        intro: this.string(obj, 'intro') ?? '',
      });
    }
    return books;
  }

  private string(obj: JsonObject, key: string): string | undefined {
    const value = obj[key];
    return typeof value === 'string' ? value : undefined;
  }
}
