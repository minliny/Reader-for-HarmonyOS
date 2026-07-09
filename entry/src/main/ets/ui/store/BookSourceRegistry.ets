// BookSourceRegistry — book source URL template + Legado rule registry.
// Single source of truth for search/detail/chapter URL patterns AND the
// inline Legado source definition passed to Core's RemoteContentPipeline
// (book.search / book.detail / book.toc / chapter.content). The minimal
// visible reading chain uses the default yodu.org source; later phases can
// add more sources here without touching ReaderEffects.
import type { JsonObject } from '../../bridge/core/sdk/reader_core';

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

  // Inline Legado source definition for Core's RemoteContentPipeline. Passed
  // as the `source` parameter to book.search / book.detail / book.toc /
  // chapter.content. Core uses ruleSearch / ruleBookInfo / ruleToc /
  // ruleContent to parse the HTML responses that Host prefetches via
  // HttpHostAdapter. Rules are clean-room descriptions of yodu.org's HTML
  // structure (CSS selectors + Legado DSL operators || && ##).
  private static readonly YODU_LEGADO_SOURCE_JSON: string =
    '{"sourceId":"legado-yodu-src","name":"有度轻说","baseUrl":"https://www.yodu.org",' +
    '"bookSource":{"bookSourceName":"有度轻说","bookSourceUrl":"https://www.yodu.org","bookSourceType":0,' +
    '"searchUrl":"https://www.yodu.org/sa/all-{{key}}-{{page}}.html",' +
    '"ruleSearch":{"bookList":"class.ser-ret@li||class.j_bookList@li","name":"h3@text||h2@text","author":"class.vam mr10.1@text||class.c_small mb5 mr15 ell ttc fs16.0@text","bookUrl":"a@href","coverUrl":"img@_src","kind":"class.vam mr10.0@text&&tag.span.2@text&&class.c_small mb5 mr15 ell ttc fs16.1@text","lastChapter":"class.vam@a@text"},' +
    '"ruleBookInfo":{"name":"class.mb15 lh1d2 oh@text","author":"class.mr15 ttl@a@text","coverUrl":"class.g_thumb@img@src","intro":"class.h112 mb15 det-abt lh1d8 c_strong fs16 hm-scroll@html","kind":"class.mr15 ttc hisp@text","lastChapter":"class.ell lst-chapter dib vam@text"},' +
    '"ruleToc":{"chapterList":"id.chapterList@li@a","chapterName":"text","chapterUrl":"href"},' +
    '"ruleContent":{"content":"id.TextContent@html##（本章未完）","nextContentUrl":"text.下一章@href"}},' +
    '"rules":{}}';

  static getDefault(): BookSourceTemplate {
    return BookSourceRegistry.DEFAULT_SOURCE;
  }

  // Return the inline Legado source definition for Core commands. Parsed
  // fresh each call so callers cannot mutate the shared constant.
  static getDefaultLegadoSource(): JsonObject {
    return JSON.parse(BookSourceRegistry.YODU_LEGADO_SOURCE_JSON) as JsonObject;
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
