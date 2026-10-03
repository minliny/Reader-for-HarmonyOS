import type { JsonObject } from '@reader/core-harmony';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { type ReaderSourceCategory } from '../source/ReaderSourceCategory';

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
  category: ReaderSourceCategory;
};

export type DiscoverSource = {
  sourceId: string;
  name: string;
  category: ReaderSourceCategory;
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

  async loadExploreKinds(sourceId: string, onPartial?: (invalidCount: number) => void): Promise<DiscoverKind[]> {
    const result = await this.runtimeOwner.request('source.exploreKinds', { sourceId });
    const raw = result.data['kinds'];
    if (!Array.isArray(raw)) {
      throw new Error('source.exploreKinds returned invalid data');
    }
    const kinds: DiscoverKind[] = [];
    let invalidCount = 0;
    for (const item of raw) {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        invalidCount += 1;
        continue;
      }
      const obj = item as JsonObject;
      const title = this.string(obj, 'title');
      const url = this.string(obj, 'url');
      // Legado exploreUrl arrays commonly include group headings whose URL is
      // intentionally blank. Core preserves those source semantics; this
      // executable-only product list must not dispatch a heading as
      // `source.explore`, which requires a concrete category URL.
      if (title === undefined || url === undefined) { invalidCount += 1; continue; }
      if (url.trim().length === 0) continue;
      kinds.push({ title, url });
    }
    if (invalidCount > 0 && onPartial === undefined) throw new Error('source.exploreKinds returned malformed categories');
    onPartial?.(invalidCount);
    return kinds;
  }

  async loadExplore(sourceId: string, url: string, page: number,
    category: ReaderSourceCategory = 'novel', onPartial?: (invalidCount: number) => void): Promise<DiscoverBook[]> {
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new Error('source.explore page must be a positive safe integer');
    }
    const result = await this.runtimeOwner.request('source.explore', { sourceId, url, page });
    const raw = result.data['books'];
    if (!Array.isArray(raw)) {
      throw new Error('source.explore returned invalid data');
    }
    const books: DiscoverBook[] = [];
    const identities = new Set<string>();
    let invalidCount = 0;
    for (const item of raw) {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        invalidCount += 1;
        continue;
      }
      const obj = item as JsonObject;
      const bookId = this.string(obj, 'bookId');
      // `source.explore` deliberately mirrors Core's `BookSearchBookData`
      // wire shape.  The stable title field is `title`; `name` is only a
      // presentation label inside this Harmony feature.
      const name = this.string(obj, 'title');
      if (bookId === undefined || bookId.trim().length === 0 || name === undefined ||
        (obj['sourceId'] !== undefined && obj['sourceId'] !== sourceId) ||
        ['author', 'coverUrl', 'intro'].some((field: string): boolean =>
          obj[field] !== undefined && typeof obj[field] !== 'string')) {
        invalidCount += 1;
        continue;
      }
      if (identities.has(bookId)) { invalidCount += 1; continue; }
      identities.add(bookId);
      books.push({
        sourceId: this.string(obj, 'sourceId') ?? sourceId,
        bookId,
        name,
        author: this.string(obj, 'author') ?? '',
        coverUrl: this.string(obj, 'coverUrl') ?? '',
        intro: this.string(obj, 'intro') ?? '',
        // The explore response is already scoped to one source. The
        // orchestrator supplies the source's authoritative category when it
        // projects this row; the gateway keeps the wire decoder total.
        category,
      });
    }
    if (invalidCount > 0 && onPartial === undefined) throw new Error('source.explore returned malformed books');
    onPartial?.(invalidCount);
    return books;
  }

  private string(obj: JsonObject, key: string): string | undefined {
    const value = obj[key];
    return typeof value === 'string' ? value : undefined;
  }
}
