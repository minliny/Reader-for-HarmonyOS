// ReaderEffects.test — pure-function tests for the minimal reading chain:
// BookSourceRegistry URL builders + Legado source, ReaderEffects Core result
// mappers (mapSearchResults / mapBookDetail / mapChapterContent /
// getFirstChapterUrl / getVariables), and the reading-chain reducer action
// cases. The async effect methods (runSearch / runBookDetail / runChapter)
// need CoreRuntime + Host HTTP and are NOT tested here — they are covered by
// device self-check evidence instead.
import { describe, it, expect } from '@ohos/hypium';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { ReaderEffects } from '../main/ets/ui/store/ReaderEffects';
import { BookSourceRegistry } from '../main/ets/ui/store/BookSourceRegistry';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { SearchResultEntry, BookDetail } from '../main/ets/ui/store/ReaderUiState';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';

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
    it('getDefaultLegadoSourceReturnsJsonObjectWithRules', 0, () => {
      const src = BookSourceRegistry.getDefaultLegadoSource();
      expect(typeof src).assertEqual('object');
      expect(src !== null).assertTrue();
      const bookSourceVal = src['bookSource'] as Object;
      expect(bookSourceVal !== null && bookSourceVal !== undefined).assertTrue();
      expect(typeof bookSourceVal).assertEqual('object');
      const bookSource = bookSourceVal as JsonObject;
      const ruleSearchVal = bookSource['ruleSearch'] as Object;
      expect(ruleSearchVal !== null && ruleSearchVal !== undefined).assertTrue();
      const ruleSearch = ruleSearchVal as JsonObject;
      expect(typeof ruleSearch['bookList']).assertEqual('string');
      expect(typeof ruleSearch['name']).assertEqual('string');
      expect(typeof ruleSearch['bookUrl']).assertEqual('string');
      const ruleContentVal = bookSource['ruleContent'] as Object;
      expect(ruleContentVal !== null && ruleContentVal !== undefined).assertTrue();
      const ruleContent = ruleContentVal as JsonObject;
      expect(typeof ruleContent['content']).assertEqual('string');
    });
    it('getDefaultLegadoSourceReturnsFreshInstance', 0, () => {
      const a = BookSourceRegistry.getDefaultLegadoSource();
      const b = BookSourceRegistry.getDefaultLegadoSource();
      // Fresh parse each call — mutations to one must not leak to the other.
      a['sourceId'] = 'mutated';
      expect(b['sourceId'] as string).assertEqual('legado-yodu-src');
    });
  });

  describe('ReaderEffects.mapSearchResults', () => {
    it('extractsBooksFromCoreResult', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const raw = '{"sourceId":"","books":[' +
        '{"bookId":"/book/101","title":"三体","author":"刘慈欣","lastChapter":"第三部"},' +
        '{"bookId":"/book/102","title":"球状闪电"}' +
        ']}';
      const data = JSON.parse(raw) as JsonObject;
      const results = ReaderEffects.mapSearchResults(data, source);
      expect(results.length).assertEqual(2);
      expect(results[0].title).assertEqual('三体');
      expect(results[0].bookId).assertEqual('/book/101');
      expect(results[0].author).assertEqual('刘慈欣');
      expect(results[0].latestChapter).assertEqual('第三部');
      expect(results[0].sourceName).assertEqual('有度轻说');
      expect(results[0].sourceUrl).assertEqual('https://www.yodu.org');
      expect(results[1].title).assertEqual('球状闪电');
      expect(results[1].bookId).assertEqual('/book/102');
      // Missing author → default '未知作者'
      expect(results[1].author).assertEqual('未知作者');
      // Missing lastChapter → empty string
      expect(results[1].latestChapter).assertEqual('');
    });
    it('skipsEntriesWithMissingTitleOrBookId', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const raw = '{"books":[' +
        '{"bookId":"/book/101","title":"三体"},' +
        '{"bookId":"","title":"无ID"},' +
        '{"bookId":"/book/103","title":""}' +
        ']}';
      const data = JSON.parse(raw) as JsonObject;
      const results = ReaderEffects.mapSearchResults(data, source);
      expect(results.length).assertEqual(1);
      expect(results[0].bookId).assertEqual('/book/101');
    });
    it('capsAtTwentyResults', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const books: string[] = [];
      for (let i = 0; i < 25; i++) {
        books.push('{"bookId":"/book/' + i + '","title":"书' + i + '"}');
      }
      const raw = '{"books":[' + books.join(',') + ']}';
      const data = JSON.parse(raw) as JsonObject;
      const results = ReaderEffects.mapSearchResults(data, source);
      expect(results.length).assertEqual(20);
    });
    it('returnsEmptyWhenNoBooksArray', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const data = JSON.parse('{"sourceId":""}') as JsonObject;
      const results = ReaderEffects.mapSearchResults(data, source);
      expect(results.length).assertEqual(0);
    });
  });

  describe('ReaderEffects.mapBookDetail', () => {
    it('extractsDetailFromCoreResult', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const raw = '{"sourceId":"","book":{' +
        '"bookId":"/book/101","title":"三体","author":"刘慈欣",' +
        '"coverUrl":"https://example.com/cover.jpg",' +
        '"intro":"文化大革命如火如荼地进行。",' +
        '"lastChapter":"第三部"' +
        '},"tocUrl":"/book/101/chapters"}';
      const data = JSON.parse(raw) as JsonObject;
      const detail = ReaderEffects.mapBookDetail(data, '/book/101', source);
      expect(detail.bookId).assertEqual('/book/101');
      expect(detail.title).assertEqual('三体');
      expect(detail.author).assertEqual('刘慈欣');
      expect(detail.coverUrl).assertEqual('https://example.com/cover.jpg');
      expect(detail.summary).assertEqual('文化大革命如火如荼地进行。');
      expect(detail.latestChapter).assertEqual('第三部');
      expect(detail.chapterListUrl).assertEqual('/book/101/chapters');
      expect(detail.sourceName).assertEqual('有度轻说');
      expect(detail.sourceUrl).assertEqual('https://www.yodu.org');
    });
    it('fallsBackOnMissingFields', 0, () => {
      const source = BookSourceRegistry.getDefault();
      const data = JSON.parse('{"sourceId":""}') as JsonObject;
      const detail = ReaderEffects.mapBookDetail(data, '/book/999', source);
      expect(detail.bookId).assertEqual('/book/999');
      expect(detail.title).assertEqual('未知书名');
      expect(detail.author).assertEqual('未知作者');
      expect(detail.summary).assertEqual('');
      expect(detail.latestChapter).assertEqual('');
      expect(detail.chapterListUrl).assertEqual('');
    });
  });

  describe('ReaderEffects.getFirstChapterUrl', () => {
    it('returnsFirstTocEntryUrl', 0, () => {
      const raw = '{"toc":[' +
        '{"index":0,"title":"第一章","url":"/book/101/ch1.html"},' +
        '{"index":1,"title":"第二章","url":"/book/101/ch2.html"}' +
        ']}';
      const data = JSON.parse(raw) as JsonObject;
      expect(ReaderEffects.getFirstChapterUrl(data)).assertEqual('/book/101/ch1.html');
    });
    it('returnsEmptyWhenNoTocArray', 0, () => {
      const data = JSON.parse('{"sourceId":""}') as JsonObject;
      expect(ReaderEffects.getFirstChapterUrl(data)).assertEqual('');
    });
    it('returnsEmptyWhenEmptyToc', 0, () => {
      const data = JSON.parse('{"toc":[]}') as JsonObject;
      expect(ReaderEffects.getFirstChapterUrl(data)).assertEqual('');
    });
  });

  describe('ReaderEffects.getVariables', () => {
    it('returnsVariablesObjectWhenPresent', 0, () => {
      const data = JSON.parse('{"variables":{"k":"v","n":1}}') as JsonObject;
      const v = ReaderEffects.getVariables(data);
      expect(v !== undefined).assertTrue();
      if (v !== undefined) {
        expect(typeof v['k']).assertEqual('string');
        expect(v['k'] as string).assertEqual('v');
      }
    });
    it('returnsUndefinedWhenNoVariables', 0, () => {
      const data = JSON.parse('{"sourceId":""}') as JsonObject;
      expect(ReaderEffects.getVariables(data)).assertEqual(undefined);
    });
    it('returnsUndefinedWhenVariablesIsArray', 0, () => {
      const data = JSON.parse('{"variables":[1,2,3]}') as JsonObject;
      expect(ReaderEffects.getVariables(data)).assertEqual(undefined);
    });
  });

  describe('ReaderEffects.mapChapterContent', () => {
    it('splitsOnBrBr', 0, () => {
      const raw = '{"content":"第一段<br><br>第二段<br><br>第三段"}';
      const data = JSON.parse(raw) as JsonObject;
      const paras = ReaderEffects.mapChapterContent(data);
      expect(paras.length).assertEqual(3);
      expect(paras[0]).assertEqual('第一段');
      expect(paras[1]).assertEqual('第二段');
      expect(paras[2]).assertEqual('第三段');
    });
    it('splitsOnPTags', 0, () => {
      const raw = '{"content":"<p>第一段</p><p>第二段</p>"}';
      const data = JSON.parse(raw) as JsonObject;
      const paras = ReaderEffects.mapChapterContent(data);
      expect(paras.length).assertEqual(2);
      expect(paras[0]).assertEqual('第一段');
      expect(paras[1]).assertEqual('第二段');
    });
    it('stripsInlineTags', 0, () => {
      const raw = '{"content":"<p>这是<b>加粗</b>文字</p>"}';
      const data = JSON.parse(raw) as JsonObject;
      const paras = ReaderEffects.mapChapterContent(data);
      expect(paras.length).assertEqual(1);
      expect(paras[0]).assertEqual('这是加粗文字');
    });
    it('returnsEmptyWhenNoContent', 0, () => {
      const data = JSON.parse('{"sourceId":""}') as JsonObject;
      expect(ReaderEffects.mapChapterContent(data).length).assertEqual(0);
    });
    it('returnsEmptyWhenContentEmpty', 0, () => {
      const data = JSON.parse('{"content":""}') as JsonObject;
      expect(ReaderEffects.mapChapterContent(data).length).assertEqual(0);
    });
    it('decodesNbspAndAmp', 0, () => {
      const raw = '{"content":"<p>第一&nbsp;段&amp;第二</p>"}';
      const data = JSON.parse(raw) as JsonObject;
      const paras = ReaderEffects.mapChapterContent(data);
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
    it('searchFailureSetsErrorAndClearsLoadingAndPageState', 0, () => {
      const s = DemoUiState.initial();
      // Simulate the real flow: search-submit sets loading+pageState=loading,
      // then search-failure should clear loading and switch pageState=error.
      const loading = ReaderReducer.reduce(s, { type: 'search-submit', query: '斗破' });
      expect(loading.loading).assertEqual(true);
      expect(loading.pageState).assertEqual('loading');
      const next = ReaderReducer.reduce(loading, {
        type: 'search-failure',
        error: { code: 'SEARCH_FAILED', message: 'timeout', retryable: true },
      });
      expect(next.error !== null).assertTrue();
      if (next.error !== null) {
        expect(next.error.code).assertEqual('SEARCH_FAILED');
        expect(next.error.retryable).assertEqual(true);
      }
      expect(next.loading).assertEqual(false);
      expect(next.pageState).assertEqual('error');
    });
    it('setErrorClearsLoadingAndSwitchesPageStateToError', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.setRouteLoading(s);
      expect(loading.loading).assertEqual(true);
      expect(loading.pageState).assertEqual('loading');
      const next = ReaderReducer.setError(loading, { code: 'BOOK_DETAIL_FAILED', message: 'timeout', retryable: true });
      expect(next.loading).assertEqual(false);
      expect(next.pageState).assertEqual('error');
      expect(next.error !== null).assertTrue();
      if (next.error !== null) {
        expect(next.error.code).assertEqual('BOOK_DETAIL_FAILED');
      }
    });
    it('setErrorWithNullKeepsPageState', 0, () => {
      const s = DemoUiState.initial();
      const errorState = ReaderReducer.setError(s, { code: 'X', message: 'y', retryable: false });
      expect(errorState.pageState).assertEqual('error');
      const cleared = ReaderReducer.setError(errorState, null);
      expect(cleared.pageState).assertEqual('error');
      expect(cleared.error).assertEqual(null);
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
    it('chapterLoadSetsLoadingAndPageState', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, { type: 'chapter-load', chapterId: '/book/101/ch1.html' });
      expect(next.loading).assertEqual(true);
      expect(next.pageState).assertEqual('loading');
      expect(next.error).assertEqual(null);
    });
    it('bookDetailLoadSetsLoadingPageState', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, { type: 'book-detail-load', bookId: '/book/101' });
      expect(next.loading).assertEqual(true);
      expect(next.pageState).assertEqual('loading');
      expect(next.error).assertEqual(null);
    });
    it('chapterSuccessResetsPageStateToDefault', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.reduce(s, { type: 'chapter-load', chapterId: '/book/101/ch1.html' });
      expect(loading.pageState).assertEqual('loading');
      const next = ReaderReducer.reduce(loading, {
        type: 'chapter-success',
        chapterParagraphs: ['第一段', '第二段'],
      });
      expect(next.loading).assertEqual(false);
      expect(next.pageState).assertEqual('default');
      expect(next.chapterContent.length).assertEqual(2);
    });
    it('routePushThenBookDetailLoadLandsLoadingOnNewRoute', 0, () => {
      // Mirrors SearchResultsPanel tap: route-push first, then book-detail-load.
      // route-push resets pageState='default'; book-detail-load must switch it
      // back to 'loading' on the new route so book-detail/loading ViewState shows.
      const s = DemoUiState.initial();
      const pushed = ReaderReducer.reduce(s, { type: 'route-push', id: 'book-detail' });
      expect(pushed.routeId).assertEqual('book-detail');
      expect(pushed.pageState).assertEqual('default');
      const loading = ReaderReducer.reduce(pushed, { type: 'book-detail-load', bookId: '/book/101' });
      expect(loading.routeId).assertEqual('book-detail');
      expect(loading.pageState).assertEqual('loading');
      expect(loading.loading).assertEqual(true);
    });
    it('bookDetailSuccessResetsPageStateToDefault', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.reduce(s, { type: 'book-detail-load', bookId: '/book/101' });
      expect(loading.pageState).assertEqual('loading');
      const book: BookDetail = {
        bookId: '/book/101', title: '三体', author: '刘慈欣', summary: '...',
        sourceName: '有度轻说', sourceUrl: 'https://www.yodu.org',
        latestChapter: '第三部', chapterListUrl: '/book/101/ch1.html',
      };
      const next = ReaderReducer.reduce(loading, { type: 'book-detail-success', book: book });
      expect(next.loading).assertEqual(false);
      expect(next.pageState).assertEqual('default');
      expect(next.currentBook !== null).assertTrue();
      if (next.currentBook !== null) {
        expect(next.currentBook.title).assertEqual('三体');
      }
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
