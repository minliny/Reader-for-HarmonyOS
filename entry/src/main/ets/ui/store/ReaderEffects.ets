// ReaderEffects — async effect layer intercepting dispatch events.
//
// The reducer is a pure function (no side effects). When a search/book/chapter
// event needs real Host HTTP access, the store calls ReaderEffects.maybeRun()
// AFTER the synchronous reducer pass. The effect fires the HTTP request
// asynchronously and dispatches a success/failure event back into the store,
// which flows through the reducer again to update searchResults / currentBook /
// chapterContent.
//
// Parse strategy: simple regex over HTML. This is NOT the Core
// RemoteContentPipeline — it is a minimal host-side parser sufficient for the
// visible reading chain. Core-side parsing replaces this in a later phase.
//
// Safety: CoreRuntime may not be initialized when an early dispatch fires
// (e.g. during first UI build before EntryAbility.init). We guard with
// try/catch and the promise rejects — the caller surfaces an error state and
// the user can retry once CoreRuntime is ready.
import { UiEvent, SearchResultEntry, BookDetail } from './ReaderUiState';
import { ReaderUiStore } from './ReaderUiStore';
import { BookSourceRegistry, BookSourceTemplate } from './BookSourceRegistry';
import { CoreRuntime } from '../../bridge/CoreRuntime';
import { HostHttpRequest } from '../../host/types/HostRequest';

export class ReaderEffects {
  // Dispatcher: called by ReaderUiStore.dispatch after the reducer pass.
  // Routes events that need async Host work to their handlers.
  static maybeRun(event: UiEvent): void {
    switch (event.type) {
      case 'search-submit': {
        const q = event.query ?? '';
        if (q.length > 0) {
          ReaderEffects.runSearch(q);
        }
        break;
      }
      case 'book-detail-load': {
        const bookId = event.bookId ?? '';
        if (bookId.length > 0) {
          ReaderEffects.runBookDetail(bookId);
        }
        break;
      }
      case 'chapter-load': {
        const chapterId = event.chapterId ?? '';
        if (chapterId.length > 0) {
          ReaderEffects.runChapter(chapterId);
        }
        break;
      }
      default:
        break;
    }
  }

  // ── Search ────────────────────────────────────────────────────────────
  static runSearch(query: string): void {
    const source = BookSourceRegistry.getDefault();
    const url = BookSourceRegistry.buildSearchUrl(source, query, 1);
    ReaderEffects.httpGet(url).then((html) => {
      const results = ReaderEffects.parseSearchResults(html, source);
      ReaderUiStore.dispatch({ type: 'search-success', searchResults: results });
    }).catch((e: Error) => {
      ReaderUiStore.dispatch({
        type: 'search-failure',
        error: { code: 'SEARCH_FAILED', message: e.message, retryable: true },
      });
    });
  }

  // ── Book detail ───────────────────────────────────────────────────────
  // bookId from search results is a relative path like '/book/123'.
  static runBookDetail(bookId: string): void {
    const source = BookSourceRegistry.getDefault();
    const url = BookSourceRegistry.buildDetailUrl(source, bookId);
    ReaderEffects.httpGet(url).then((html) => {
      const book = ReaderEffects.parseBookDetail(html, bookId, source);
      ReaderUiStore.dispatch({ type: 'book-detail-success', book: book });
    }).catch((e: Error) => {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'BOOK_DETAIL_FAILED', message: e.message, retryable: true },
      });
    });
  }

  // ── Chapter content ───────────────────────────────────────────────────
  // chapterId is a full relative path (e.g. '/book/123/ch1.html') captured
  // from the detail page's TOC link by the UI tap handler.
  static runChapter(chapterId: string): void {
    const source = BookSourceRegistry.getDefault();
    const url = BookSourceRegistry.buildChapterUrl(source, chapterId);
    ReaderEffects.httpGet(url).then((html) => {
      const paragraphs = ReaderEffects.parseChapterContent(html);
      ReaderUiStore.dispatch({ type: 'chapter-success', chapterParagraphs: paragraphs });
    }).catch((e: Error) => {
      ReaderUiStore.dispatch({
        type: 'set-error',
        error: { code: 'CHAPTER_FAILED', message: e.message, retryable: true },
      });
    });
  }

  // ── HTTP helper ───────────────────────────────────────────────────────
  // Reaches the Host HTTP adapter via CoreRuntime. If CoreRuntime is not yet
  // initialized (early dispatch before EntryAbility.init), the promise rejects
  // and the caller surfaces an error state — user can retry.
  private static httpGet(url: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let runtime: CoreRuntime;
      try {
        runtime = CoreRuntime.get();
      } catch (e) {
        reject(new Error('runtime not ready'));
        return;
      }
      const req: HostHttpRequest = {
        url: url,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; HarmonyOS) Reader/1.0',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
        followRedirects: true,
        maxRedirects: 5,
        usePlatformCookieJar: true,
      };
      runtime.getHttpAdapter().execute(req).then((resp) => {
        if (resp.status >= 200 && resp.status < 300) {
          resolve(resp.body);
        } else {
          reject(new Error(`http ${resp.status}`));
        }
      }).catch((e: Error) => {
        reject(e);
      });
    });
  }

  // ── Parsers (minimal host-side regex; Core replaces later) ────────────

  // Search result page: <a href="/book/xxx">title</a> rows.
  // Each result also has an author line nearby.
  static parseSearchResults(html: string, source: BookSourceTemplate): SearchResultEntry[] {
    const results: SearchResultEntry[] = [];
    const linkRe = /<a[^>]*href="\/book\/[^"]*"[^>]*>([^<]+)<\/a>/g;
    let m: RegExpExecArray | null;
    const seen: Set<string> = new Set();
    while ((m = linkRe.exec(html)) !== null) {
      const title = m[1].trim();
      const hrefMatch = m[0].match(/href="([^"]+)"/);
      if (hrefMatch === null) continue;
      const bookId = hrefMatch[1];
      if (seen.has(bookId)) continue;
      seen.add(bookId);
      if (title.length === 0 || title.length > 80) continue;
      results.push({
        title: title,
        author: ReaderEffects.extractNearby(html, m.index, /作者[：:]\s*([^<\s]+)/),
        bookId: bookId,
        sourceName: source.name,
        sourceUrl: source.baseHost,
      });
      if (results.length >= 20) break;
    }
    return results;
  }

  // Book detail page: <h1>title</h1>, 作者：xxx, class="intro" summary,
  // 最新章节：xxx, and the first TOC link href.
  static parseBookDetail(html: string, bookId: string, source: BookSourceTemplate): BookDetail {
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const title = titleMatch !== null ? titleMatch[1].trim() : '未知书名';
    const authorMatch = html.match(/作者[：:]\s*([^<\s]+)/);
    const author = authorMatch !== null ? authorMatch[1].trim() : '未知作者';
    const introMatch = html.match(/class="intro"[^>]*>([\s\S]*?)<\/div>/);
    const summary = introMatch !== null
      ? introMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 300)
      : '';
    const latestMatch = html.match(/最新章节[：:]\s*<a[^>]*>([^<]+)<\/a>/);
    const latestChapter = latestMatch !== null ? latestMatch[1].trim() : '';
    // First chapter link: <a href="/book/xxx/yyy.html"> — full relative path.
    const chapterLinkMatch = html.match(/<a[^>]*href="(\/book\/[^"]+\/[^"]+\.html)"/);
    const chapterListUrl = chapterLinkMatch !== null ? chapterLinkMatch[1] : '';
    return {
      bookId: bookId,
      title: title,
      author: author,
      summary: summary,
      sourceName: source.name,
      sourceUrl: source.baseHost,
      latestChapter: latestChapter,
      chapterListUrl: chapterListUrl,
    };
  }

  // Chapter page: <div id="content">…</div>. Split into paragraphs on <br><br>
  // or <p> tags. Strip remaining HTML tags.
  static parseChapterContent(html: string): string[] {
    const contentMatch = html.match(/<div[^>]*id="content"[^>]*>([\s\S]*?)<\/div>/);
    if (contentMatch === null) return [];
    const raw = contentMatch[1];
    // Normalize <br><br> and <p>…</p> into paragraph breaks.
    const normalized = raw
      .replace(/<br\s*\/?>(\s*<br\s*\/?>)+/g, '\u0001')
      .replace(/<\/p>\s*<p[^>]*>/g, '\u0001')
      .replace(/<p[^>]*>/g, '')
      .replace(/<\/p>/g, '\u0001');
    const parts = normalized.split('\u0001');
    const paragraphs: string[] = [];
    for (const p of parts) {
      const text = p.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
      if (text.length > 0) {
        paragraphs.push(text);
      }
    }
    return paragraphs;
  }

  // Helper: search a regex in a window around an anchor offset, to pull
  // metadata (author) near a search-result link.
  private static extractNearby(html: string, anchor: number, re: RegExp): string {
    const start = Math.max(0, anchor - 400);
    const end = Math.min(html.length, anchor + 400);
    const slice = html.slice(start, end);
    const m = slice.match(re);
    return m !== null ? m[1].trim() : '未知作者';
  }
}
