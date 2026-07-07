// BookSourceRegistry — book source URL template registry.
// Single source of truth for search/detail/chapter URL patterns. The minimal
// visible reading chain uses the default yodu.org source; later phases can add
// more sources here without touching ReaderEffects.
export interface BookSourceTemplate {
  id: string;
  name: string;
  baseHost: string;          // e.g. 'https://www.yodu.org'
  searchUrlPattern: string;  // {{key}} = encoded keyword, {{page}} = page number
  detailUrlPattern: string;  // {{bookId}} = book relative path
  chapterUrlPattern: string; // {{chapterId}} = full chapter relative path
}

export class BookSourceRegistry {
  // Default golden fixture source. yodu.org is a lightweight novel site whose
  // search/detail/chapter pages are simple HTML — enough for the minimal chain.
  // Network reachability is best-effort (HttpHostAdapter has 15s timeout); an
  // unreachable source surfaces as an error state in the reducer, not a crash.
  private static readonly DEFAULT_SOURCE: BookSourceTemplate = {
    id: 'yodu',
    name: '有度轻说',
    baseHost: 'https://www.yodu.org',
    searchUrlPattern: 'https://www.yodu.org/sa/all-{{key}}-{{page}}.html',
    detailUrlPattern: '{{bookId}}',
    chapterUrlPattern: '{{chapterId}}',
  };

  static getDefault(): BookSourceTemplate {
    return BookSourceRegistry.DEFAULT_SOURCE;
  }

  // Build the search URL by substituting {{key}} (URL-encoded) and {{page}}.
  static buildSearchUrl(source: BookSourceTemplate, keyword: string, page: number = 1): string {
    const encoded = encodeURIComponent(keyword);
    return source.searchUrlPattern
      .replace('{{key}}', encoded)
      .replace('{{page}}', String(page));
  }

  // Resolve a bookId (relative path like '/book/123') to a full detail URL.
  static buildDetailUrl(source: BookSourceTemplate, bookId: string): string {
    const path = source.detailUrlPattern.replace('{{bookId}}', bookId);
    return path.startsWith('http') ? path : `${source.baseHost}${path}`;
  }

  // Resolve a chapter relative path (e.g. '/book/123/ch1.html') to a full URL.
  static buildChapterUrl(source: BookSourceTemplate, chapterId: string): string {
    const path = source.chapterUrlPattern.replace('{{chapterId}}', chapterId);
    return path.startsWith('http') ? path : `${source.baseHost}${path}`;
  }
}
