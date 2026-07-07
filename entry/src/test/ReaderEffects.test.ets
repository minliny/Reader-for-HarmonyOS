// ReaderEffects.test — pure-function tests for the minimal reading chain:
// BookSourceRegistry URL builders, ReaderEffects HTML parsers, and the
// reading-chain reducer action cases. The async effect methods (runSearch /
// runBookDetail / runChapter) need CoreRuntime + Host HTTP and are NOT tested
// here — they are covered by device self-check evidence instead.
import { describe, it, expect } from '@ohos/hypium';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { ReaderEffects } from '../main/ets/ui/store/ReaderEffects';
import { BookSourceRegistry } from '../main/ets/ui/store/BookSourceRegistry';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { SearchResultEntry, BookDetail } from '../main/ets/ui/store/ReaderUiState';

export default function ReaderEffectsTests(): void {
  describe('BookSourceRegistry', () => {
    it('defaultSourceIsYodu', 0, () => {
      const s = BookSourceRegistry.getDefault();
      expect(s.id).assertEqual('yodu');
      expect(s.baseHost).assertEqual('https://www.yodu.org');
    });
    it('buildSearchUrlEncodesKeyword', 0, () => {
      const s = BookSourceRegistry.getDefault();
      const url = BookSourceRegistry.buildSearchUrl(s, '三体', 1);
      expect(url).assertEqual('https://www.yodu.org/sa/all-' + encodeURIComponent('三体') + '-1.html');
    });
    it('buildDetailUrlPrependsHost', 0, () => {
      const s = BookSourceRegistry.getDefault();
      const url = BookSourceRegistry.buildDetailUrl(s, '/book/123');
      expect(url).assertEqual('https://www.yodu.org/book/123');
    });
    it('buildChapterUrlPrependsHost', 0, () => {
      const s = BookSourceRegistry.getDefault();
      const url = BookSourceRegistry.buildChapterUrl(s, '/book/123/ch1.html');
      expect(url).assertEqual('https://www.yodu.org/book/123/ch1.html');
    });
  });

  describe('ReaderEffects.parseSearchResults', () => {
    it('extractsBookLinks', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const html = '<div>' +
        '<a href="/book/101">三体</a> 作者：刘慈欣 ' +
        '<a href="/book/102">球状闪电</a> 作者：刘慈欣 ' +
        '</div>';
      const results = ReaderEffects.parseSearchResults(html, source);
      expect(results.length).assertEqual(2);
      expect(results[0].title).assertEqual('三体');
      expect(results[0].bookId).assertEqual('/book/101');
      expect(results[0].sourceName).assertEqual('有度轻说');
      expect(results[1].title).assertEqual('球状闪电');
      expect(results[1].bookId).assertEqual('/book/102');
    });
    it('dedupesByBookId', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const html = '<a href="/book/101">三体</a><a href="/book/101">三体</a>';
      const results = ReaderEffects.parseSearchResults(html, source);
      expect(results.length).assertEqual(1);
    });
    it('returnsEmptyWhenNoLinks', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const results = ReaderEffects.parseSearchResults('<div>no links here</div>', source);
      expect(results.length).assertEqual(0);
    });
  });

  describe('ReaderEffects.parseBookDetail', () => {
    it('extractsTitleAuthorSummaryChapterUrl', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const html = '<h1>三体</h1>' +
        '<div>作者：刘慈欣</div>' +
        '<div class="intro">文化大革命如火如荼地进行。</div>' +
        '<div>最新章节：<a href="/book/101/last.html">第三部</a></div>' +
        '<div><a href="/book/101/ch1.html">第一章</a></div>';
      const book = ReaderEffects.parseBookDetail(html, '/book/101', source);
      expect(book.bookId).assertEqual('/book/101');
      expect(book.title).assertEqual('三体');
      expect(book.author).assertEqual('刘慈欣');
      expect(book.summary).assertEqual('文化大革命如火如荼地进行。');
      expect(book.latestChapter).assertEqual('第三部');
      expect(book.chapterListUrl).assertEqual('/book/101/ch1.html');
      expect(book.sourceName).assertEqual('有度轻说');
    });
    it('fallsBackOnMissingFields', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const book = ReaderEffects.parseBookDetail('<div>no data</div>', '/book/999', source);
      expect(book.title).assertEqual('未知书名');
      expect(book.author).assertEqual('未知作者');
      expect(book.summary).assertEqual('');
      expect(book.chapterListUrl).assertEqual('');
    });
  });

  describe('ReaderEffects.parseChapterContent', () => {
    it('splitsOnBrBr', 0, () => {
      const html = '<div id="content">第一段<br><br>第二段<br><br>第三段</div>';
      const paras = ReaderEffects.parseChapterContent(html);
      expect(paras.length).assertEqual(3);
      expect(paras[0]).assertEqual('第一段');
      expect(paras[1]).assertEqual('第二段');
      expect(paras[2]).assertEqual('第三段');
    });
    it('splitsOnPTags', 0, () => {
      const html = '<div id="content"><p>第一段</p><p>第二段</p></div>';
      const paras = ReaderEffects.parseChapterContent(html);
      expect(paras.length).assertEqual(2);
      expect(paras[0]).assertEqual('第一段');
      expect(paras[1]).assertEqual('第二段');
    });
    it('stripsInlineTags', 0, () => {
      const html = '<div id="content"><p>这是<b>加粗</b>文字</p></div>';
      const paras = ReaderEffects.parseChapterContent(html);
      expect(paras.length).assertEqual(1);
      expect(paras[0]).assertEqual('这是加粗文字');
    });
    it('returnsEmptyWhenNoContentDiv', 0, () => {
      const paras = ReaderEffects.parseChapterContent('<div>no content div</div>');
      expect(paras.length).assertEqual(0);
    });
    it('decodesNbspAndAmp', 0, () => {
      const html = '<div id="content"><p>第一&nbsp;段&amp;第二</p></div>';
      const paras = ReaderEffects.parseChapterContent(html);
      expect(paras[0]).assertEqual('第一 段&第二');
    });
  });

  describe('ReaderReducer reading chain', () => {
    it('searchSubmitSetsLoadingAndQuery', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, { type: 'search-submit', query: '三体' });
      expect(next.searchQuery).assertEqual('三体');
      expect(next.loading).assertEqual(true);
      expect(next.pageState).assertEqual('loading');
      expect(next.error).assertEqual(null);
    });
    it('searchSuccessSetsResultsAndClearsLoading', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.reduce(s, { type: 'search-submit', query: '三体' });
      const results: SearchResultEntry[] = [{
        title: '三体', author: '刘慈欣', bookId: '/book/101',
        sourceName: '有度轻说', sourceUrl: 'https://www.yodu.org',
      }];
      const next = ReaderReducer.reduce(loading, { type: 'search-success', searchResults: results });
      expect(next.searchResults.length).assertEqual(1);
      expect(next.loading).assertEqual(false);
      expect(next.pageState).assertEqual('default');
    });
    it('searchSuccessEmptyResultsSetsEmptyPageState', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.reduce(s, { type: 'search-submit', query: '三体' });
      const next = ReaderReducer.reduce(loading, { type: 'search-success', searchResults: [] });
      expect(next.searchResults.length).assertEqual(0);
      expect(next.pageState).assertEqual('empty');
    });
    it('searchFailureSetsError', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, {
        type: 'search-failure',
        error: { code: 'SEARCH_FAILED', message: 'timeout', retryable: true },
      });
      expect(next.error !== null).assertTrue();
      if (next.error !== null) {
        expect(next.error.code).assertEqual('SEARCH_FAILED');
        expect(next.error.retryable).assertEqual(true);
      }
    });
    it('bookDetailSuccessSetsCurrentBook', 0, () => {
      const s = DemoUiState.initial();
      const book: BookDetail = {
        bookId: '/book/101', title: '三体', author: '刘慈欣', summary: '...',
        sourceName: '有度轻说', sourceUrl: 'https://www.yodu.org',
        latestChapter: '第三部', chapterListUrl: '/book/101/ch1.html',
      };
      const next = ReaderReducer.reduce(s, { type: 'book-detail-success', book: book });
      expect(next.currentBook !== null).assertTrue();
      if (next.currentBook !== null) {
        expect(next.currentBook.title).assertEqual('三体');
      }
      expect(next.loading).assertEqual(false);
      expect(next.pageState).assertEqual('default');
    });
    it('chapterSuccessSetsParagraphs', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, {
        type: 'chapter-success',
        chapterParagraphs: ['第一段', '第二段'],
      });
      expect(next.chapterContent.length).assertEqual(2);
      expect(next.loading).assertEqual(false);
    });
    it('chapterLoadSetsLoading', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, { type: 'chapter-load', chapterId: '/book/101/ch1.html' });
      expect(next.loading).assertEqual(true);
    });
    it('newFieldsPresentInInitialState', 0, () => {
      const s = DemoUiState.initial();
      expect(s.searchQuery).assertEqual('');
      expect(s.searchResults.length).assertEqual(0);
      expect(s.currentBook).assertEqual(null);
      expect(s.chapterContent.length).assertEqual(0);
    });
  });
}
