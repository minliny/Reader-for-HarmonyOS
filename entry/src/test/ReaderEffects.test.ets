// ReaderEffects.test — pure-function tests for the Core-backed reading chain:
// ReaderEffects Core result
// mappers (mapSearchResults / mapBookDetail / mapChapterContent /
// getFirstChapterUrl / getVariables), and the reading-chain reducer action
// cases. The async effect methods (runSearch / runBookDetail / runChapter)
// need CoreRuntime + Core-issued Host HTTP continuations and are NOT tested
// here — they are covered by device self-check evidence instead.
import { describe, it, expect } from '@ohos/hypium';
import { ReaderReducer } from '../main/ets/ui/store/ReaderReducer';
import { ReaderEffects } from '../main/ets/ui/store/ReaderEffects';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';
import { RouteId } from '../main/ets/contract/generated/RouteTable';
import { SearchResultEntry, BookDetail, CoreSourceEntry, CoreSourceCheckResult, CoreSourceDebugResult, CoreContentSearchResult, CoreBookmark } from '../main/ets/ui/store/ReaderUiState';
import type { JsonObject } from '../main/ets/bridge/core/sdk/reader_core';
import type { CoreSourceDebugRunProjection } from '../main/ets/bridge/CoreRuntime';

function coreTestSource(): CoreSourceEntry {
  return {
    sourceId: 'core-test-source',
    name: 'Core 测试书源',
    baseUrl: 'https://core.example',
    enabled: true,
    enabledExplore: true,
  };
}

function coreReaderBook(): BookDetail {
  return {
    bookId: '/book/101', title: '三体', author: '刘慈欣', summary: '...',
    sourceId: 'core-test-source', sourceName: 'Core 测试书源', sourceUrl: 'https://core.example',
    latestChapter: '第三部', chapterListUrl: '/book/101/ch1.html',
  };
}

function loadedReaderState() {
  let state = ReaderReducer.reduce(DemoUiState.initial(), { type: 'book-detail-success', book: coreReaderBook() });
  state = ReaderReducer.reduce(state, { type: 'route-push', id: 'reader' });
  return ReaderReducer.reduce(state, {
    type: 'chapter-success', chapterParagraphs: ['第一段', '第二段'], chapterTitle: '第一章',
    bookId: '/book/101', sourceId: 'core-test-source', chapterIndex: 0,
  });
}

export default function ReaderEffectsTests(): void {
  describe('ReaderEffects.mapSearchResults', () => {
    it('extractsBooksFromCoreResult', 0, () => {
      const source = coreTestSource();
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
      expect(results[0].sourceId).assertEqual('core-test-source');
      expect(results[0].sourceName).assertEqual('Core 测试书源');
      expect(results[0].sourceUrl).assertEqual('https://core.example');
      expect(results[1].title).assertEqual('球状闪电');
      expect(results[1].bookId).assertEqual('/book/102');
      // Missing author → default '未知作者'
      expect(results[1].author).assertEqual('未知作者');
      // Missing lastChapter → empty string
      expect(results[1].latestChapter).assertEqual('');
    });
    it('skipsEntriesWithMissingTitleOrBookId', 0, () => {
      const source = coreTestSource();
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
      const source = coreTestSource();
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
      const source = coreTestSource();
      const data = JSON.parse('{"sourceId":""}') as JsonObject;
      const results = ReaderEffects.mapSearchResults(data, source);
      expect(results.length).assertEqual(0);
    });
  });

  describe('ReaderEffects.mapContentSearchResults', () => {
    it('keepsOnlyCurrentCoreSourceAndBookWithCanonicalOffsets', 0, () => {
      const data = JSON.parse('{' +
        '"results":[' +
        '{"sourceId":"core-test-source","bookId":"/book/101","bookName":"三体",' +
        '"chapterIndex":4,"chapterOffset":128,"matchLength":2,"snippetStart":80,' +
        '"chapterTitle":"第五章","snippet":"……包含关键词的上下文……"},' +
        '{"sourceId":"other-source","bookId":"/book/101","chapterIndex":0,"chapterOffset":0,"matchLength":1,"snippetStart":0},' +
        '{"sourceId":"core-test-source","bookId":"/book/other","chapterIndex":0,"chapterOffset":0,"matchLength":1,"snippetStart":0}' +
        ']}') as JsonObject;
      const results = ReaderEffects.mapContentSearchResults(data, 'core-test-source', '/book/101');
      expect(results.length).assertEqual(1);
      expect(results[0].sourceId).assertEqual('core-test-source');
      expect(results[0].bookId).assertEqual('/book/101');
      expect(results[0].chapterIndex).assertEqual(4);
      expect(results[0].chapterOffset).assertEqual(128);
      expect(results[0].chapterTitle).assertEqual('第五章');
      expect(results[0].snippet).assertEqual('……包含关键词的上下文……');
    });

    it('dropsMalformedCoreRowsRatherThanInventingJumpTargets', 0, () => {
      const data = JSON.parse('{' +
        '"results":[' +
        '{"sourceId":"core-test-source","bookId":"/book/101","chapterIndex":-1,"chapterOffset":0,"matchLength":1,"snippetStart":0},' +
        '{"sourceId":"core-test-source","bookId":"/book/101","chapterIndex":1,"chapterOffset":-1,"matchLength":1,"snippetStart":0},' +
        '{"sourceId":"core-test-source","bookId":"/book/101","chapterIndex":1.5,"chapterOffset":0,"matchLength":1,"snippetStart":0},' +
        '{"sourceId":"core-test-source","bookId":"/book/101","chapterIndex":1,"chapterOffset":0,"matchLength":-1,"snippetStart":0}' +
        ']}') as JsonObject;
      expect(ReaderEffects.mapContentSearchResults(data, 'core-test-source', '/book/101').length).assertEqual(0);
    });
  });

  describe('ReaderEffects.mapDiscoverKinds / mapDiscoverBooks', () => {
    it('keepsCoreKindUrlsAndOnlyCoreBookIdentity', 0, () => {
      const source = coreTestSource();
      const kinds = ReaderEffects.mapDiscoverKinds(JSON.parse('{' +
        '"kinds":[' +
        '{"title":"榜单","url":"https://core.example/rank?page={{page}}"},' +
        '{"title":"分组标题"}' +
        ']}') as JsonObject);
      expect(kinds.length).assertEqual(2);
      expect(kinds[0].title).assertEqual('榜单');
      expect(kinds[0].url).assertEqual('https://core.example/rank?page={{page}}');
      expect(kinds[1].url).assertEqual('');

      const books = ReaderEffects.mapDiscoverBooks(JSON.parse('{' +
        '"sourceId":"ignored-by-ui","books":[' +
        '{"bookId":"/book/101","title":"Core 发现书","author":"作者","intro":"简介","kind":"科幻","lastChapter":"第十章"},' +
        '{"bookUrl":"/book/102","title":"另一册"},' +
        '{"bookId":"","title":"无 URL"}' +
        ']}') as JsonObject, source);
      expect(books.length).assertEqual(2);
      expect(books[0].sourceId).assertEqual('core-test-source');
      expect(books[0].bookUrl).assertEqual('/book/101');
      expect(books[0].title).assertEqual('Core 发现书');
      expect(books[0].lastChapter).assertEqual('第十章');
      expect(books[1].bookUrl).assertEqual('/book/102');
      expect(books[1].author).assertEqual('未知作者');
    });
  });

  describe('ReaderEffects.mapSourceCheckResult', () => {
    it('keepsOnlyTheMatchingCoreVerdict', 0, () => {
      const data = JSON.parse('{' +
        '"results":[' +
        '{"sourceId":"other","available":true,"levelsPassed":["L1"],"durationMs":1},' +
        '{"sourceId":"core-test-source","available":false,"levelsPassed":["L1","L2"],' +
        '"failureReason":"L3 detail: missing prefetched response","durationMs":19}' +
        ']}') as JsonObject;
      const result = ReaderEffects.mapSourceCheckResult(data, 'core-test-source');
      expect(result !== null).assertTrue();
      if (result !== null) {
        expect(result.sourceId).assertEqual('core-test-source');
        expect(result.available).assertFalse();
        expect(result.levelsPassed.length).assertEqual(2);
        expect(result.levelsPassed[1]).assertEqual('L2');
        expect(result.failureReason).assertEqual('L3 detail: missing prefetched response');
        expect(result.durationMs).assertEqual(19);
      }
    });

    it('doesNotInventAVerdictWhenTheExpectedSourceIsAbsent', 0, () => {
      const data = JSON.parse('{"results":[{"sourceId":"other","available":true}]}') as JsonObject;
      expect(ReaderEffects.mapSourceCheckResult(data, 'core-test-source')).assertEqual(null);
    });

    it('failsClosedUnlessCoreReturnsEveryRequestedL1ToL5Pass', 0, () => {
      const complete: CoreSourceCheckResult = {
        sourceId: 'core-test-source',
        available: true,
        levelsPassed: ['L1', 'L2', 'L3', 'L4', 'L5'],
        failureReason: '',
        durationMs: 44,
      };
      const full = ReaderEffects.validateFullSourceCheckRunResult(complete);
      expect(full.available).assertTrue();
      expect(full.levelsPassed.length).assertEqual(5);

      const incomplete: CoreSourceCheckResult = {
        sourceId: 'core-test-source',
        available: true,
        levelsPassed: ['L1', 'L2'],
        failureReason: '',
        durationMs: 12,
      };
      const rejectedIncomplete = ReaderEffects.validateFullSourceCheckRunResult(incomplete);
      expect(rejectedIncomplete.available).assertFalse();
      expect(rejectedIncomplete.failureReason.indexOf('L3') >= 0).assertTrue();

      const networkFailure: CoreSourceCheckResult = {
        sourceId: 'core-test-source',
        available: false,
        levelsPassed: ['L1'],
        failureReason: 'L2: host HTTP failed: connection refused',
        durationMs: 18,
      };
      const rejectedNetwork = ReaderEffects.validateFullSourceCheckRunResult(networkFailure);
      expect(rejectedNetwork.available).assertFalse();
      expect(rejectedNetwork.failureReason).assertEqual('L2: host HTTP failed: connection refused');
    });
  });

  describe('ReaderEffects.mapSourceDebugResult', () => {
    it('keepsOnlyStructuredCoreLogsAndStageProjection', 0, () => {
      const projection: CoreSourceDebugRunProjection = {
        sourceId: 'core-test-source',
        sourceCheckData: JSON.parse('{' +
          '"results":[{"sourceId":"core-test-source","available":true,' +
          '"levelsPassed":["L1","L2","L3","L4","L5"],"durationMs":31}]}') as JsonObject,
        sourceCheckError: '',
        sourceDebugData: JSON.parse('{' +
          '"logs":[{"state":1,"msg":"L2 搜索成功","timestampMs":8,"step":"search","extractedCount":2},' +
          '{"state":1000,"msg":"调试完成","timestampMs":13}],"finalState":1000,"durationMs":13}') as JsonObject,
        sourceDebugError: '',
        stages: [{
          stage: 'L2', requestCount: 1, responseCount: 1, selectedResponseIndex: 0,
          statusCode: 200, failed: false, failureMessage: '', replayLimited: false,
        }, {
          stage: 'L3', requestCount: 0, responseCount: 0, selectedResponseIndex: -1,
          statusCode: 0, failed: false, failureMessage: '', replayLimited: false,
        }, {
          stage: 'L4', requestCount: 2, responseCount: 2, selectedResponseIndex: 0,
          statusCode: 200, failed: false, failureMessage: '', replayLimited: true,
        }, {
          stage: 'L5', requestCount: 1, responseCount: 0, selectedResponseIndex: -1,
          statusCode: 0, failed: true, failureMessage: 'HTTP_TRANSPORT_TIMEOUT', replayLimited: false,
        }],
        replayAttempted: true,
        replayLimited: true,
        replayNotice: 'L4 收集到 2 份响应，仅重放第 1 份。',
      };
      const result = ReaderEffects.mapSourceDebugResult(projection);
      expect(result.sourceCheck !== null).assertTrue();
      if (result.sourceCheck !== null) expect(result.sourceCheck.available).assertTrue();
      expect(result.logs.length).assertEqual(2);
      expect(result.logs[0].message).assertEqual('L2 搜索成功');
      expect(result.logs[0].extractedCount).assertEqual(2);
      expect(result.finalState).assertEqual(1000);
      expect(result.stages.length).assertEqual(4);
      expect(result.stages[2].replayLimited).assertTrue();
      expect(result.stages[3].failureMessage).assertEqual('HTTP_TRANSPORT_TIMEOUT');
      // This UI DTO intentionally has no HTTP body/finalUrl fields.
      const fields = result as Object as Record<string, Object>;
      expect(fields['body'] === undefined).assertTrue();
      expect(fields['finalUrl'] === undefined).assertTrue();
    });

    it('doesNotTurnPartialReplayIntoSourceAvailability', 0, () => {
      const partial: CoreSourceDebugResult = ReaderEffects.mapSourceDebugResult({
        sourceId: 'core-test-source',
        sourceCheckData: JSON.parse('{' +
          '"results":[{"sourceId":"core-test-source","available":false,' +
          '"levelsPassed":["L1","L2"],"failureReason":"L3: host HTTP failed","durationMs":12}]}') as JsonObject,
        sourceCheckError: '',
        sourceDebugData: JSON.parse('{"logs":[{"state":1000,"msg":"调试完成","timestampMs":3}],"finalState":1000,"durationMs":3}') as JsonObject,
        sourceDebugError: '',
        stages: [],
        replayAttempted: true,
        replayLimited: false,
        replayNotice: '单份回放。',
      });
      expect(partial.sourceCheck !== null).assertTrue();
      if (partial.sourceCheck !== null) expect(partial.sourceCheck.available).assertFalse();
      const summary = ReaderEffects.sourceDebugSummary(partial);
      expect(summary.indexOf('未通过') >= 0).assertTrue();
      expect(summary.indexOf('不代表书源可用') >= 0).assertTrue();
    });

    it('reducerRejectsDisabledSourceDebugSelection', 0, () => {
      const initial = DemoUiState.initial();
      initial.availableSources = [{
        sourceId: 'disabled-source', name: '已停用源', baseUrl: 'https://disabled.example', enabled: false,
      }, {
        sourceId: 'enabled-source', name: '启用源', baseUrl: 'https://enabled.example', enabled: true,
      }];
      const rejected = ReaderReducer.reduce(initial, { type: 'source-debug-select', sourceId: 'disabled-source' });
      expect(rejected.selectedSourceId ?? '').assertEqual('');
      const selected = ReaderReducer.reduce(initial, { type: 'source-debug-select', sourceId: 'enabled-source' });
      expect(selected.selectedSourceId ?? '').assertEqual('enabled-source');
      expect(selected.sourceDebugResult).assertEqual(null);
    });
  });

  describe('ReaderEffects.mapBookGroups', () => {
    it('projectsCoreBookGroupRowsWithoutFixtureFallback', 0, () => {
      const data = JSON.parse('{"groups":[' +
        '{"groupId":2,"groupName":"科幻","cover":"","order":4,"enableRefresh":true,"show":false},' +
        '{"groupId":3,"groupName":"待读","order":5,"enableRefresh":false,"show":true}' +
        ']}') as JsonObject;
      const groups = ReaderEffects.mapBookGroups(data);
      expect(groups.length).assertEqual(2);
      expect(groups[0].groupId).assertEqual(2);
      expect(groups[0].groupName).assertEqual('科幻');
      expect(groups[0].show).assertFalse();
      expect(groups[1].enableRefresh).assertFalse();
    });

    it('omitsMalformedCoreBookGroupRows', 0, () => {
      const data = JSON.parse('{"groups":[{"groupName":"缺少 ID"},"bad"]}') as JsonObject;
      expect(ReaderEffects.mapBookGroups(data).length).assertEqual(0);
    });
  });

  describe('ReaderEffects.mapCoreBookmarks and reducer projection', () => {
    it('keepsExactCoreBookmarkAnchorsWithoutSourceIdInventing', 0, () => {
      const data = JSON.parse('{"bookmarks":[' +
        '{"time":21,"bookName":"Core 书","bookAuthor":"作者","chapterIndex":4,"chapterPos":128,' +
        '"chapterName":"第五章","bookText":"真实原文","content":"真实批注"}' +
        ']}') as JsonObject;
      const bookmarks = ReaderEffects.mapCoreBookmarks(data);
      expect(bookmarks.length).assertEqual(1);
      expect(bookmarks[0].time).assertEqual(21);
      expect(bookmarks[0].chapterIndex).assertEqual(4);
      expect(bookmarks[0].chapterPos).assertEqual(128);
      expect(bookmarks[0].bookName).assertEqual('Core 书');
      expect(bookmarks[0].content).assertEqual('真实批注');
    });

    it('dropsMalformedBookmarkAnchorsAndKeepsListStateSeparateFromReaderLoading', 0, () => {
      const data = JSON.parse('{"bookmarks":[' +
        '{"time":-1,"chapterIndex":0,"chapterPos":0},' +
        '{"time":1,"chapterIndex":-1,"chapterPos":0},' +
        '{"time":2,"chapterIndex":0,"chapterPos":-1}' +
        ']}') as JsonObject;
      expect(ReaderEffects.mapCoreBookmarks(data).length).assertEqual(0);

      const initial = DemoUiState.initial();
      const loading = ReaderReducer.reduce(initial, { type: 'bookmark-list-start' });
      expect(loading.bookmarksLoading).assertTrue();
      expect(loading.loading).assertEqual(initial.loading);
      const rows: CoreBookmark[] = [{
        time: 7, bookName: 'Core 书', bookAuthor: '作者', chapterIndex: 0, chapterPos: 0,
        chapterName: '第一章', bookText: '正文', content: '',
      }];
      const loaded = ReaderReducer.reduce(loading, { type: 'bookmark-list-loaded', bookmarks: rows });
      expect(loaded.bookmarksLoading).assertFalse();
      expect(loaded.bookmarksLoaded).assertTrue();
      expect(loaded.bookmarks.length).assertEqual(1);
      const history = ReaderReducer.reduce(loaded, {
        type: 'search-history-loaded', searchHistory: ['真实关键词'],
      });
      expect(history.searchHistoryLoaded).assertTrue();
      expect(history.searchHistory[0]).assertEqual('真实关键词');
    });
  });

  describe('ReaderEffects.mapBookDetail', () => {
    it('extractsDetailFromCoreResult', 0, () => {
      const source = coreTestSource();
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
      expect(detail.sourceId).assertEqual('core-test-source');
      expect(detail.sourceName).assertEqual('Core 测试书源');
      expect(detail.sourceUrl).assertEqual('https://core.example');
    });
    it('fallsBackOnMissingFields', 0, () => {
      const source = coreTestSource();
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
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'book-search' });
      const next = ReaderReducer.reduce(s, { type: 'search-submit', query: '三体' });
      expect(next.searchQuery).assertEqual('三体');
      expect(next.loading).assertEqual(true);
      expect(next.pageState).assertEqual('loading');
      expect(next.error).assertEqual(null);
    });
    it('searchSuccessSetsResultsAndClearsLoading', 0, () => {
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'book-search' });
      const loading = ReaderReducer.reduce(s, { type: 'search-submit', query: '三体' });
      const results: SearchResultEntry[] = [{
        title: '三体', author: '刘慈欣', bookId: '/book/101',
        sourceId: 'core-test-source', sourceName: 'Core 测试书源', sourceUrl: 'https://core.example',
      }];
      const next = ReaderReducer.reduce(loading, { type: 'search-success', searchResults: results });
      expect(next.searchResults.length).assertEqual(1);
      expect(next.loading).assertEqual(false);
      expect(next.pageState).assertEqual('default');
    });
    it('searchSuccessEmptyResultsSetsEmptyPageState', 0, () => {
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'book-search' });
      const loading = ReaderReducer.reduce(s, { type: 'search-submit', query: '三体' });
      const next = ReaderReducer.reduce(loading, { type: 'search-success', searchResults: [] });
      expect(next.searchResults.length).assertEqual(0);
      expect(next.pageState).assertEqual('empty');
    });
    it('searchFailureSetsErrorAndClearsLoadingAndPageState', 0, () => {
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'book-search' });
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
        sourceId: 'core-test-source', sourceName: 'Core 测试书源', sourceUrl: 'https://core.example',
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
      const next = loadedReaderState();
      const reloaded = ReaderReducer.reduce(next, {
        type: 'chapter-success',
        chapterParagraphs: ['第一段', '第二段'],
        chapterTitle: '第一章', bookId: '/book/101', sourceId: 'core-test-source', chapterIndex: 0,
      });
      expect(reloaded.chapterContent.length).assertEqual(2);
      expect(reloaded.loading).assertEqual(false);
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
      const s = loadedReaderState();
      const loading = ReaderReducer.reduce(s, { type: 'chapter-load', chapterId: '/book/101/ch1.html' });
      expect(loading.pageState).assertEqual('loading');
      const next = ReaderReducer.reduce(loading, {
        type: 'chapter-success',
        chapterParagraphs: ['第一段', '第二段'],
        chapterTitle: '第一章', bookId: '/book/101', sourceId: 'core-test-source', chapterIndex: 0,
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
        sourceId: 'core-test-source', sourceName: 'Core 测试书源', sourceUrl: 'https://core.example',
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
      expect(s.contentSearchResults.length).assertEqual(0);
      expect(s.contentSearchLoading).assertFalse();
      expect(s.contentSearchLoaded).assertFalse();
    });

    it('contentSearchUsesDedicatedLoadingEmptyAndErrorProjection', 0, () => {
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'content-search' });
      const loading = ReaderReducer.reduce(s, { type: 'content-search-submit', query: '魔法' });
      expect(loading.contentSearchQuery).assertEqual('魔法');
      expect(loading.contentSearchLoading).assertTrue();
      expect(loading.loading).assertFalse();
      const results: CoreContentSearchResult[] = [{
        sourceId: 'core-test-source', bookId: '/book/101', bookName: '三体',
        chapterIndex: 2, chapterOffset: 64, matchLength: 2, snippetStart: 20,
        chapterTitle: '第三章', snippet: '含有魔法的正文',
      }];
      const success = ReaderReducer.reduce(loading, {
        type: 'content-search-success', contentSearchResults: results,
      });
      expect(success.contentSearchLoading).assertFalse();
      expect(success.contentSearchLoaded).assertTrue();
      expect(success.contentSearchResults.length).assertEqual(1);
      const failed = ReaderReducer.reduce(success, {
        type: 'content-search-failure', contentSearchMessage: 'Core search.content failed',
      });
      expect(failed.contentSearchLoaded).assertTrue();
      expect(failed.contentSearchResults.length).assertEqual(0);
      expect(failed.contentSearchError).assertEqual('Core search.content failed');
      expect(failed.error).assertEqual(null);
    });
  });

  describe('Native reader text selection gate', () => {
    it('keepsOnlyTheActualArkUISelectionAndSupportedActions', 0, () => {
      const initial = DemoUiState.initial();
      const selected = ReaderReducer.reduce(initial, {
        type: 'selection-show', selectedText: '  用户长按选中的真实正文  ',
      });
      expect(selected.selection.visible).assertTrue();
      // Whitespace remains part of the exact native range for clipboard copy;
      // the reducer only uses trim to reject an empty range.
      expect(selected.selection.selectedText).assertEqual('  用户长按选中的真实正文  ');
      expect(selected.selection.action).assertEqual('');

      const copy = ReaderReducer.reduce(selected, {
        type: 'selection-action', selectionAction: 'copy',
      });
      expect(copy.selection.action).assertEqual('copy');
      expect(copy.selection.selectedText).assertEqual('  用户长按选中的真实正文  ');

      const search = ReaderReducer.reduce(copy, {
        type: 'selection-action', selectionAction: 'search',
      });
      expect(search.selection.action).assertEqual('search');
    });

    it('rejectsBlankRangesAndUnavailableHighlightOrNoteActions', 0, () => {
      const initial = DemoUiState.initial();
      const blank = ReaderReducer.reduce(initial, {
        type: 'selection-show', selectedText: '   ',
      });
      expect(blank.selection.visible).assertFalse();
      expect(blank.selection.selectedText).assertEqual('');

      const selected = ReaderReducer.reduce(initial, {
        type: 'selection-show', selectedText: '真实正文',
      });
      const highlight = ReaderReducer.reduce(selected, {
        type: 'selection-action', selectionAction: 'highlight',
      });
      expect(highlight.selection.action).assertEqual('');
      const note = ReaderReducer.reduce(selected, {
        type: 'selection-action', selectionAction: 'note',
      });
      expect(note.selection.action).assertEqual('');

      const closed = ReaderReducer.reduce(selected, { type: 'selection-close' });
      expect(closed.selection.visible).assertFalse();
      expect(closed.selection.selectedText).assertEqual('');
    });
  });

  describe('Slice 2 reader entry chain', () => {
    it('routePushToImmersiveReadingSetsRoute', 0, () => {
      const s = DemoUiState.initial();
      expect(s.routeId).assertEqual('bookshelf');
      const next = ReaderReducer.reduce(s, { type: 'route-push', id: 'immersive-reading' });
      expect(next.routeId).assertEqual('immersive-reading');
      expect(next.pageState).assertEqual('default');
    });

    it('routePopFromReaderReturnsToBookshelf', 0, () => {
      const s = DemoUiState.initial();
      const reader = ReaderReducer.reduce(s, { type: 'route-push', id: 'immersive-reading' });
      expect(reader.routeId).assertEqual('immersive-reading');
      const back = ReaderReducer.reduce(reader, { type: 'route-pop' });
      expect(back.routeId).assertEqual('bookshelf');
    });

    it('pageTurnNextIncrementsPageIndex', 0, () => {
      const s = DemoUiState.initial();
      const reader = ReaderReducer.reduce(s, { type: 'route-push', id: 'immersive-reading' });
      const withPages = ReaderReducer.reduce(reader, { type: 'set-reader-page-count', readerPageCount: 5 });
      expect(withPages.readerPageIndex).assertEqual(0);
      const next = ReaderReducer.reduce(withPages, { type: 'reader-page-next' });
      expect(next.readerPageIndex).assertEqual(1);
    });

    it('pageTurnPrevFloorsAtZero', 0, () => {
      const s = DemoUiState.initial();
      const reader = ReaderReducer.reduce(s, { type: 'route-push', id: 'immersive-reading' });
      const withPages = ReaderReducer.reduce(reader, { type: 'set-reader-page-count', readerPageCount: 5 });
      const page1 = ReaderReducer.reduce(withPages, { type: 'set-reader-page-index', readerPageIndex: 1 });
      const page0 = ReaderReducer.reduce(page1, { type: 'reader-page-prev' });
      expect(page0.readerPageIndex).assertEqual(0);
      const clamped = ReaderReducer.reduce(page0, { type: 'reader-page-prev' });
      expect(clamped.readerPageIndex).assertEqual(0);
    });

    it('readerReflowSettingsKeepTheMeasuredCoreAnchor', 0, () => {
      const initial = loadedReaderState();
      const anchored = ReaderReducer.reduce(initial, {
        type: 'reader-location-anchor', readerChapterOffset: 256, readerChapterProgress: 0.4,
        bookId: '/book/101', sourceId: 'core-test-source', chapterIndex: 0,
      });
      const vertical = ReaderReducer.reduce(anchored, {
        type: 'set-pagination-mode', paginationMode: 'vertical',
      });
      expect(vertical.readerChapterOffset).assertEqual(256);
      expect(vertical.readerChapterProgress).assertEqual(0.4);
      const larger = ReaderReducer.reduce(vertical, {
        type: 'set-reader-render-metric', readerMetric: 'fontSize', value: 22,
      });
      expect(larger.readerChapterOffset).assertEqual(256);
      expect(larger.readerChapterProgress).assertEqual(0.4);
      const reset = ReaderReducer.reduce(larger, { type: 'reset-reader-render-settings' });
      expect(reset.readerChapterOffset).assertEqual(256);
      expect(reset.readerChapterProgress).assertEqual(0.4);
    });

    it('pageAnimationAtomicallyOwnsPaginationLayout', 0, () => {
      const initial = DemoUiState.initial();
      for (const animation of ['slide', 'cover', 'simulation', 'none']) {
        const next = ReaderReducer.reduce(initial, {
          type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: animation,
        });
        expect(next.readerSettingOptions.pageAnimation).assertEqual(animation);
        expect(next.readerSettingOptions.pageMode).assertEqual('horizontal');
        expect(next.paginationMode).assertEqual('horizontal');
      }
      const scrolling = ReaderReducer.reduce(initial, {
        type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: '滚动',
      });
      expect(scrolling.readerSettingOptions.pageAnimation).assertEqual('scroll');
      expect(scrolling.readerSettingOptions.pageMode).assertEqual('vertical');
      expect(scrolling.paginationMode).assertEqual('vertical');
      const restoredHorizontal = ReaderReducer.reduce(scrolling, {
        type: 'set-reader-setting-option', optionKey: 'pageAnimation', optionValue: '覆盖',
      });
      expect(restoredHorizontal.readerSettingOptions.pageAnimation).assertEqual('cover');
      expect(restoredHorizontal.readerSettingOptions.pageMode).assertEqual('horizontal');
      expect(restoredHorizontal.paginationMode).assertEqual('horizontal');
      const legacyVertical = ReaderReducer.reduce(initial, {
        type: 'set-pagination-mode', paginationMode: 'vertical',
      });
      expect(legacyVertical.readerSettingOptions.pageAnimation).assertEqual('scroll');
      expect(legacyVertical.readerSettingOptions.pageMode).assertEqual('vertical');
      const legacyHorizontal = ReaderReducer.reduce(legacyVertical, {
        type: 'set-pagination-mode', paginationMode: 'horizontal',
      });
      expect(legacyHorizontal.readerSettingOptions.pageAnimation).assertEqual('slide');
      expect(legacyHorizontal.readerSettingOptions.pageMode).assertEqual('horizontal');

      const persistedSimulation = ReaderReducer.reduce(initial, {
        type: 'hydrate-reader-page-turn-preference',
        preferencePageAnimation: 'simulation',
        preferencePageMode: 'horizontal',
      });
      expect(persistedSimulation.readerSettingOptions.pageAnimation).assertEqual('simulation');
      expect(persistedSimulation.readerSettingOptions.pageMode).assertEqual('horizontal');
      const rejectedMismatch = ReaderReducer.reduce(persistedSimulation, {
        type: 'hydrate-reader-page-turn-preference',
        preferencePageAnimation: 'scroll',
        preferencePageMode: 'horizontal',
      });
      expect(rejectedMismatch.readerSettingOptions.pageAnimation).assertEqual('simulation');
      expect(rejectedMismatch.readerSettingOptions.pageMode).assertEqual('horizontal');
      const rejectedUnknown = ReaderReducer.reduce(persistedSimulation, {
        type: 'hydrate-reader-page-turn-preference',
        preferencePageAnimation: 'smooth',
        preferencePageMode: 'horizontal',
      });
      expect(rejectedUnknown.readerSettingOptions.pageAnimation).assertEqual('simulation');
    });

    it('chapterJumpSetsLoadingAndPageState', 0, () => {
      const s = DemoUiState.initial();
      const reader = ReaderReducer.reduce(s, { type: 'route-push', id: 'immersive-reading' });
      const next = ReaderReducer.reduce(reader, { type: 'chapter-load', chapterId: '/book/101/ch5.html' });
      expect(next.loading).assertEqual(true);
      expect(next.pageState).assertEqual('loading');
      expect(next.error).assertEqual(null);
    });

    it('chapterSuccessClearsLoadingAndSetsContent', 0, () => {
      const s = loadedReaderState();
      const reader = ReaderReducer.reduce(s, { type: 'route-push', id: 'immersive-reading' });
      const loading = ReaderReducer.reduce(reader, { type: 'chapter-load', chapterId: '/book/101/ch5.html' });
      const next = ReaderReducer.reduce(loading, {
        type: 'chapter-success',
        chapterParagraphs: ['章节内容第一段', '章节内容第二段'],
        chapterTitle: '第一章', bookId: '/book/101', sourceId: 'core-test-source', chapterIndex: 0,
      });
      expect(next.loading).assertEqual(false);
      expect(next.pageState).assertEqual('default');
      expect(next.chapterContent.length).assertEqual(2);
    });

    it('continuousRoutePushesKeepLastOnTop', 0, () => {
      const s = DemoUiState.initial();
      const detail = ReaderReducer.reduce(s, { type: 'route-push', id: 'book-detail' });
      const reader = ReaderReducer.reduce(detail, { type: 'route-push', id: 'immersive-reading' });
      expect(reader.routeId).assertEqual('immersive-reading');
      expect(reader.stack.length).assertEqual(3);
      const back = ReaderReducer.reduce(reader, { type: 'route-pop' });
      expect(back.routeId).assertEqual('book-detail');
    });
  });

  describe('Slice 5 RSS / discover / source golden tests', () => {
    it('switchToRssTabSetsRouteId', 0, () => {
      const s = DemoUiState.initial();
      expect(s.routeId).assertEqual('bookshelf');
      const rss = ReaderReducer.reduce(s, { type: 'switch-tab', tab: 'rss' });
      expect(rss.routeId).assertEqual('rss');
      expect(rss.tab).assertEqual('rss');
      expect(rss.stack.length).assertEqual(1);
    });

    it('switchToDiscoverTabSetsRouteId', 0, () => {
      const s = DemoUiState.initial();
      const discover = ReaderReducer.reduce(s, { type: 'switch-tab', tab: 'discover' });
      expect(discover.routeId).assertEqual('discover');
      expect(discover.tab).assertEqual('discover');
    });

    it('discoverReducerKeepsCoreSourceKindAndBookUrlTogether', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.reduce(s, { type: 'discover-load-start' });
      expect(loading.discoverLoading).assertTrue();
      const loaded = ReaderReducer.reduce(loading, {
        type: 'discover-data-loaded',
        discoverSources: [coreTestSource()],
        discoverSourceId: 'core-test-source',
        discoverKinds: [{ title: 'Core 榜单', url: 'https://core.example/rank?page={{page}}' }],
        discoverKindUrl: 'https://core.example/rank?page={{page}}',
        discoverKindTitle: 'Core 榜单',
        discoverBooks: [{
          sourceId: 'core-test-source',
          bookUrl: '/book/from-core',
          title: 'Core 书籍',
          author: '作者',
          coverUrl: '',
          intro: '',
          kind: '',
          lastChapter: '',
        }],
      });
      expect(loaded.discoverLoading).assertFalse();
      expect(loaded.discoverSourceId).assertEqual('core-test-source');
      expect(loaded.discoverKindUrl).assertEqual('https://core.example/rank?page={{page}}');
      expect(loaded.discoverBooks[0].sourceId).assertEqual('core-test-source');
      expect(loaded.discoverBooks[0].bookUrl).assertEqual('/book/from-core');
      const failed = ReaderReducer.reduce(loaded, {
        type: 'discover-failed',
        discoverError: 'Core http.execute 超时',
      });
      expect(failed.discoverLoading).assertFalse();
      expect(failed.discoverError).assertEqual('Core http.execute 超时');
      expect(failed.error === null).assertTrue();
    });

    it('sourceCheckReducerKeepsRealCoreFailureSeparateFromTransportError', 0, () => {
      const s = DemoUiState.initial();
      const checking = ReaderReducer.reduce(s, {
        type: 'source-detect-run', sourceCheckSourceId: 'core-test-source',
      });
      expect(checking.sourceCheckLoading).assertTrue();
      expect(checking.sourceCheckResult).assertEqual(null);

      const resolved = ReaderReducer.reduce(checking, {
        type: 'source-check-source-resolved',
        sourceCheckSourceId: 'core-test-source',
        sourceCheckSourceName: 'Core 测试书源',
      });
      expect(resolved.sourceCheckLoading).assertTrue();
      expect(resolved.sourceCheckLoaded).assertFalse();
      expect(resolved.sourceCheckSourceName).assertEqual('Core 测试书源');

      const actual = ReaderReducer.reduce(resolved, {
        type: 'source-check-success',
        sourceCheckResult: {
          sourceId: 'core-test-source', available: false, levelsPassed: ['L1'],
          failureReason: 'L2: host HTTP failed', durationMs: 23,
        },
        sourceCheckMessage: 'Core 返回真实失败 verdict。',
      });
      expect(actual.sourceCheckResult !== null).assertTrue();
      if (actual.sourceCheckResult !== null) {
        expect(actual.sourceCheckResult.available).assertFalse();
        expect(actual.sourceCheckResult.failureReason).assertEqual('L2: host HTTP failed');
      }
      expect(actual.sourceCheckError).assertEqual('');

      const transportFailure = ReaderReducer.reduce(resolved, {
        type: 'source-check-failed',
        sourceCheckError: 'Core request timed out',
      });
      expect(transportFailure.sourceCheckResult).assertEqual(null);
      expect(transportFailure.sourceCheckError).assertEqual('Core request timed out');
    });

    it('searchSubmitSetsQuery', 0, () => {
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'book-search' });
      const next = ReaderReducer.reduce(s, { type: 'search-submit', query: '凡人修仙' });
      expect(next.searchQuery).assertEqual('凡人修仙');
      expect(next.loading).assertTrue();
      expect(next.pageState).assertEqual('loading');
    });

    it('searchStartSetsLoading', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, { type: 'search-start' });
      expect(next.loading).assertEqual(true);
    });

    it('searchSuccessSetsResults', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.reduce(s, { type: 'search-start' });
      const results: SearchResultEntry[] = [
        { title: '凡人修仙传', author: '忘语', bookId: '/book/1', sourceId: 'core-test-source', sourceName: 'Core 测试书源', sourceUrl: 'https://core.example' },
        { title: '仙逆', author: '耳根', bookId: '/book/2', sourceId: 'core-test-source', sourceName: 'Core 测试书源', sourceUrl: 'https://core.example' },
      ];
      const next = ReaderReducer.reduce(loading, {
        type: 'search-success',
        searchResults: results,
      });
      expect(next.loading).assertEqual(false);
      expect(next.searchResults.length).assertEqual(2);
      expect(next.searchResults[0].title).assertEqual('凡人修仙传');
    });

    it('searchErrorClearsLoading', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.reduce(s, { type: 'search-start' });
      const next = ReaderReducer.reduce(loading, {
        type: 'search-failure',
        error: { code: 'SEARCH_FAILED', message: '网络超时', retryable: false },
      });
      expect(next.loading).assertEqual(false);
      expect(next.error !== null).assertTrue();
      if (next.error !== null) {
        expect(next.error.message).assertEqual('网络超时');
      }
    });

    it('discoverFilterToggleAddsTag', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, { type: 'set-discover-filter-toggle', discoverFilterToggle: '玄幻' });
      expect(next.discoverFilter.filters.includes('玄幻')).assertTrue();
    });

    it('discoverFilterToggleRemovesExistingTag', 0, () => {
      const s = DemoUiState.initial();
      const withFilter = ReaderReducer.reduce(s, { type: 'set-discover-filter-toggle', discoverFilterToggle: '玄幻' });
      expect(withFilter.discoverFilter.filters.includes('玄幻')).assertTrue();
      const withoutFilter = ReaderReducer.reduce(withFilter, { type: 'set-discover-filter-toggle', discoverFilterToggle: '玄幻' });
      expect(withoutFilter.discoverFilter.filters.includes('玄幻')).assertFalse();
    });

    it('discoverSortChangeUpdatesSort', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, { type: 'set-discover-sort', discoverSort: 'recent' });
      expect(next.discoverFilter.sort).assertEqual('recent');
    });

    it('sourceImportOpenKeepsInvokingRouteForSystemPicker', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, { type: 'source-import-open' });
      expect(next.routeId).assertEqual(s.routeId);
      expect(next.stack.length).assertEqual(s.stack.length);
      expect(next.overlay).assertEqual('');
      expect(next.localImportDialogPhase).assertEqual('idle');
    });

    it('localImportDialogShowsOnlyBatchOutcomesAndRequiresConfirmation', 0, () => {
      const s = DemoUiState.initial();
      const loading = ReaderReducer.reduce(s, {
        type: 'local-import-dialog-loading', localImportDialogEpoch: 1,
        localImportDialogResults: [],
      });
      expect(loading.routeId).assertEqual(s.routeId);
      expect(loading.overlay).assertEqual('local-import');
      expect(loading.localImportDialogPhase).assertEqual('loading');
      expect(loading.loading).assertEqual(false);
      const ignoredBack = ReaderReducer.reduce(loading, { type: 'set-overlay', overlay: '' });
      expect(ignoredBack.overlay).assertEqual('local-import');
      const result = ReaderReducer.reduce(loading, {
        type: 'local-import-dialog-result',
        localImportDialogEpoch: 1,
        localImportDialogResults: [
          { id: 'local-import-1-0', fileName: '第一本.txt', status: 'success' },
          { id: 'local-import-1-1', fileName: '第二本.epub', status: 'failure' },
        ],
      });
      expect(result.localImportDialogPhase).assertEqual('result');
      expect(result.localImportDialogResults.length).assertEqual(2);
      expect(result.localImportDialogResults[0].fileName).assertEqual('第一本.txt');
      expect(result.localImportDialogResults[1].status).assertEqual('failure');
      const confirmed = ReaderReducer.reduce(result, { type: 'local-import-dialog-confirm' });
      expect(confirmed.overlay).assertEqual('');
      expect(confirmed.localImportDialogPhase).assertEqual('idle');
      expect(confirmed.localImportDialogResults.length).assertEqual(0);
    });

    it('localImportDialogRejectsStaleCompletionAndNavigation', 0, () => {
      const s = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'local-import-dialog-loading', localImportDialogEpoch: 3,
        localImportDialogResults: [],
      });
      const stale = ReaderReducer.reduce(s, {
        type: 'local-import-dialog-result',
        localImportDialogEpoch: 2,
        localImportDialogResults: [{ id: 'local-import-2-0', fileName: '旧回调.txt', status: 'success' }],
      });
      expect(stale.localImportDialogPhase).assertEqual('loading');
      expect(stale.localImportDialogResults.length).assertEqual(0);
      const moved = ReaderReducer.reduce(s, { type: 'route-push', id: 'book-search' });
      expect(moved.routeId).assertEqual(s.routeId);
      expect(moved.stack.length).assertEqual(s.stack.length);
    });

    it('retiredLocalImportRoutesNeverReopenFullPageFlow', 0, () => {
      const retired: RouteId[] = [
        'local-import',
        'import-permission-denied',
        'import-format-unsupported',
        'import-empty-file',
        'import-parsing',
        'import-duplicate',
        'import-conflict-resolve',
        'import-partial-success',
        'import-result-detail',
        'local-format-support',
      ];
      for (let index = 0; index < retired.length; index += 1) {
        const pushed = ReaderReducer.reduce(DemoUiState.initial(), {
          type: 'route-push', id: retired[index],
        });
        expect(pushed.routeId).assertEqual('bookshelf');
        expect(pushed.stack.length).assertEqual(1);

        const detail = ReaderReducer.reduce(DemoUiState.initial(), {
          type: 'route-push', id: 'book-detail',
        });
        const replaced = ReaderReducer.reduce(detail, {
          type: 'route-replace', id: retired[index],
        });
        expect(replaced.routeId).assertEqual('bookshelf');
        expect(replaced.stack[replaced.stack.length - 1].id).assertEqual('bookshelf');
      }
    });

    it('rssTabBackReturnsToBookshelf', 0, () => {
      const s = DemoUiState.initial();
      const rss = ReaderReducer.reduce(s, { type: 'switch-tab', tab: 'rss' });
      const back = ReaderReducer.reduce(rss, { type: 'switch-tab', tab: 'bookshelf' });
      expect(back.routeId).assertEqual('bookshelf');
      expect(back.tab).assertEqual('bookshelf');
    });
  });

  describe('Slice 4 TTS / auto-page session golden tests', () => {
    it('ttsToggleStartsTtsSession', 0, () => {
      const s = DemoUiState.initial();
      expect(s.activeSession).assertEqual('');
      const next = ReaderReducer.reduce(s, { type: 'tts-toggle' });
      expect(next.activeSession).assertEqual('tts');
      expect(next.ttsSession.playback).assertEqual('playing');
    });

    it('ttsToggleIsIdempotentWhilePlaying', 0, () => {
      const s = DemoUiState.initial();
      const playing = ReaderReducer.reduce(s, { type: 'tts-toggle' });
      expect(playing.ttsSession.playback).assertEqual('playing');
      // Figma has separate play and stop actions. Harmony's speech host does
      // not expose a faithful pause/resume cursor, so a second play is a no-op
      // instead of claiming a fabricated paused position.
      const repeatedPlay = ReaderReducer.reduce(playing, { type: 'tts-toggle' });
      expect(repeatedPlay.ttsSession.playback).assertEqual('playing');
      expect(repeatedPlay.activeSession).assertEqual('tts');
    });

    it('ttsStopClearsTheActiveTtsSession', 0, () => {
      const s = DemoUiState.initial();
      const playing = ReaderReducer.reduce(s, { type: 'tts-toggle' });
      const stopped = ReaderReducer.reduce(playing, { type: 'reader-tts-stop' });
      expect(stopped.ttsSession.playback).assertEqual('idle');
      expect(stopped.activeSession).assertEqual('');
    });

    it('autoPageToggleStartsAutoPageSession', 0, () => {
      const s = DemoUiState.initial();
      expect(s.activeSession).assertEqual('');
      const next = ReaderReducer.reduce(s, { type: 'auto-page-toggle' });
      expect(next.activeSession).assertEqual('auto-page');
      expect(next.autoPageSession.playing).assertTrue();
      expect(next.readerToggles.autoPage).assertTrue();
    });

    it('autoPageToggleStopsActiveAutoPageSession', 0, () => {
      const s = DemoUiState.initial();
      const active = ReaderReducer.reduce(s, { type: 'auto-page-toggle' });
      expect(active.activeSession).assertEqual('auto-page');
      const stopped = ReaderReducer.reduce(active, { type: 'auto-page-toggle' });
      expect(stopped.activeSession).assertEqual('');
      expect(stopped.readerToggles.autoPage).assertFalse();
    });

    it('ttsAndAutoPageMutualExclusionTtsFirst', 0, () => {
      const s = DemoUiState.initial();
      const tts = ReaderReducer.reduce(s, { type: 'tts-toggle' });
      expect(tts.activeSession).assertEqual('tts');
      const autoPage = ReaderReducer.reduce(tts, { type: 'auto-page-toggle' });
      expect(autoPage.activeSession).assertEqual('auto-page');
    });

    it('ttsAndAutoPageMutualExclusionAutoPageFirst', 0, () => {
      const s = DemoUiState.initial();
      const autoPage = ReaderReducer.reduce(s, { type: 'auto-page-toggle' });
      expect(autoPage.activeSession).assertEqual('auto-page');
      const tts = ReaderReducer.reduce(autoPage, { type: 'tts-toggle' });
      expect(tts.activeSession).assertEqual('tts');
      expect(tts.autoPageSession.playing).assertFalse();
      expect(tts.readerToggles.autoPage).assertFalse();
    });

    it('setActiveSessionTtsSetsTtsSessionFields', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, { type: 'set-active-session', session: 'tts' });
      expect(next.activeSession).assertEqual('tts');
      expect(next.ttsSession.playback).assertEqual('paused');
    });

    it('setActiveSessionAutoPageInitializesCountdown', 0, () => {
      const s = DemoUiState.initial();
      const next = ReaderReducer.reduce(s, { type: 'set-active-session', session: 'auto-page' });
      expect(next.activeSession).assertEqual('auto-page');
      expect(next.autoPageSession.playing).assertTrue();
      expect(next.autoPageSession.countdownSeconds).assertEqual(next.autoPageSession.intervalSeconds);
    });

    it('setActiveSessionClearsPreviousSession', 0, () => {
      const s = DemoUiState.initial();
      const tts = ReaderReducer.reduce(s, { type: 'tts-toggle' });
      expect(tts.activeSession).assertEqual('tts');
      const cleared = ReaderReducer.reduce(tts, { type: 'set-active-session', session: '' });
      expect(cleared.activeSession).assertEqual('');
    });

    it('readerExitClearsDirectReaderHostStates', 0, () => {
      const s = ReaderReducer.push(DemoUiState.initial(), 'immersive-reading');
      const auto = ReaderReducer.reduce(s, { type: 'auto-page-toggle' });
      const keepOn = ReaderReducer.reduce(auto, {
        type: 'set-reader-toggle', toggleKey: 'keepScreenOn', toggleValue: true,
      });
      const exited = ReaderReducer.reduce(keepOn, { type: 'reader-exit' });
      expect(exited.activeSession).assertEqual('');
      expect(exited.autoPageSession.playing).assertFalse();
      expect(exited.readerToggles.autoPage).assertFalse();
      expect(exited.readerToggles.keepScreenOn).assertFalse();
      expect(exited.ttsSession.playback).assertEqual('idle');
    });

    it('hostRollbackEventsRestoreVisibleReaderControlsWithoutEffectRetry', 0, () => {
      const s = DemoUiState.initial();
      const changedBrightness = ReaderReducer.reduce(s, { type: 'set-brightness', value: 24 });
      const restoredBrightness = ReaderReducer.reduce(changedBrightness, {
        type: 'reader-brightness-host-revert', value: 80,
      });
      expect(restoredBrightness.brightness).assertEqual(80);
      const autoBrightness = ReaderReducer.reduce(restoredBrightness, {
        type: 'toggle-brightness-auto', enabled: true,
      });
      expect(autoBrightness.brightnessAuto).assertTrue();
      const manualBrightness = ReaderReducer.reduce(autoBrightness, {
        type: 'set-brightness', value: 42,
      });
      expect(manualBrightness.brightnessAuto).assertFalse();
      const restoredAutoBrightness = ReaderReducer.reduce(autoBrightness, {
        type: 'reader-brightness-auto-host-revert', enabled: false,
      });
      expect(restoredAutoBrightness.brightnessAuto).assertFalse();
      const hidden = ReaderReducer.reduce(restoredBrightness, {
        type: 'set-reader-toggle', toggleKey: 'hideStatusBar', toggleValue: true,
      });
      const restoredBar = ReaderReducer.reduce(hidden, {
        type: 'reader-toggle-host-revert', toggleKey: 'hideStatusBar', toggleValue: false,
      });
      expect(restoredBar.readerToggles.hideStatusBar).assertFalse();
      const messaged = ReaderReducer.reduce(restoredBar, {
        type: 'reader-host-message', readerHostMessage: '亮度设置未生效：Host 拒绝请求。',
      });
      expect(messaged.readerHostMessage).assertEqual('亮度设置未生效：Host 拒绝请求。');
    });

    it('autoPageSingleModeIsReducerBackedForTheTimerToConsume', 0, () => {
      const s = DemoUiState.initial();
      const single = ReaderReducer.reduce(s, { type: 'auto-page-set-mode', autoPageMode: 'single' });
      expect(single.autoPageMode).assertEqual('single');
    });

    it('ttsNextIncrementsSegment', 0, () => {
      const s = DemoUiState.initial();
      const tts = ReaderReducer.reduce(s, { type: 'tts-toggle' });
      const withSegments = ReaderReducer.setTtsSegments(tts, 0, 5);
      const next = ReaderReducer.reduce(withSegments, { type: 'tts-next' });
      expect(next.ttsSession.currentSegment).assertEqual(1);
    });

    it('ttsPrevDecrementsSegmentFloorsAtZero', 0, () => {
      const s = DemoUiState.initial();
      const tts = ReaderReducer.reduce(s, { type: 'tts-toggle' });
      const withSegments = ReaderReducer.setTtsSegments(tts, 2, 5);
      const prev1 = ReaderReducer.reduce(withSegments, { type: 'tts-prev' });
      expect(prev1.ttsSession.currentSegment).assertEqual(1);
      const prev0 = ReaderReducer.reduce(prev1, { type: 'tts-prev' });
      expect(prev0.ttsSession.currentSegment).assertEqual(0);
      const clamped = ReaderReducer.reduce(prev0, { type: 'tts-prev' });
      expect(clamped.ttsSession.currentSegment).assertEqual(0);
    });

    it('autoPageCountdownTickDecrementsSeconds', 0, () => {
      const s = DemoUiState.initial();
      const active = ReaderReducer.reduce(s, { type: 'auto-page-toggle' });
      expect(active.autoPageSession.countdownSeconds).assertEqual(active.autoPageSession.intervalSeconds);
      const ticked = ReaderReducer.reduce(active, { type: 'session-capsule-countdown-tick' });
      expect(ticked.autoPageSession.countdownSeconds).assertEqual(active.autoPageSession.countdownSeconds - 1);
    });
  });

  describe('Slice 6 sync / webdav / offline golden tests', () => {
    it('webdavFieldUpdateSetsServerUrl', 0, () => {
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'webdav-config' });
      const next = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'serverUrl', settingsValue: 'https://dav.example.com' });
      expect(next.webdavServerUrl).assertEqual('https://dav.example.com');
    });

    it('webdavFieldUpdateSetsUsername', 0, () => {
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'webdav-config' });
      const next = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'username', settingsValue: 'user1' });
      expect(next.webdavUsername).assertEqual('user1');
    });

    it('webdavFieldUpdateSetsPassword', 0, () => {
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'webdav-config' });
      const next = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'password', settingsValue: 'secret' });
      expect(next.webdavPassword).assertEqual('secret');
    });

    it('webdavFieldUpdateSetsSyncDir', 0, () => {
      const s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'webdav-config' });
      const next = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'syncDir', settingsValue: '/reader-sync' });
      expect(next.webdavSyncDir).assertEqual('/reader-sync');
    });

    it('webdavTestSetsTestingStatus', 0, () => {
      let s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'webdav-config' });
      s = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'serverUrl', settingsValue: 'https://dav.example.com' });
      const next = ReaderReducer.reduce(s, { type: 'webdav-test' });
      expect(next.webdavTestStatus).assertEqual('testing');
    });

    it('syncBackupInlineWebdavTestSetsTestingStatus', 0, () => {
      let s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'sync-backup' });
      s = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'serverUrl', settingsValue: 'https://dav.example.com' });
      const next = ReaderReducer.reduce(s, { type: 'webdav-test' });
      expect(next.webdavTestStatus).assertEqual('testing');
    });

    it('webdavTestResultSetsSuccessStatus', 0, () => {
      let s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'webdav-config' });
      s = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'serverUrl', settingsValue: 'https://dav.example.com' });
      const testing = ReaderReducer.reduce(s, { type: 'webdav-test' });
      const next = ReaderReducer.reduce(testing, { type: 'webdav-test-result', success: true, message: '连接成功' });
      expect(next.webdavTestStatus).assertEqual('success');
      expect(next.webdavTestMessage).assertEqual('连接成功');
    });

    it('webdavTestResultSetsErrorStatus', 0, () => {
      let s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'webdav-config' });
      s = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'serverUrl', settingsValue: 'https://dav.example.com' });
      const testing = ReaderReducer.reduce(s, { type: 'webdav-test' });
      const next = ReaderReducer.reduce(testing, { type: 'webdav-test-result', success: false, message: '认证失败' });
      expect(next.webdavTestStatus).assertEqual('error');
      expect(next.webdavTestMessage).assertEqual('认证失败');
    });

    it('webdavSaveSetsSavingStatus', 0, () => {
      let s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'webdav-config' });
      s = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'serverUrl', settingsValue: 'https://dav.example' });
      const next = ReaderReducer.reduce(s, { type: 'webdav-save' });
      expect(next.webdavSaveStatus).assertEqual('saving');
    });

    it('syncBackupInlineWebdavSaveSetsSavingStatus', 0, () => {
      let s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'sync-backup' });
      s = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'serverUrl', settingsValue: 'https://dav.example' });
      const next = ReaderReducer.reduce(s, { type: 'webdav-save' });
      expect(next.webdavSaveStatus).assertEqual('saving');
    });

    it('webdavSaveResultSetsSavedStatus', 0, () => {
      let s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'webdav-config' });
      s = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'serverUrl', settingsValue: 'https://dav.example' });
      const saving = ReaderReducer.reduce(s, { type: 'webdav-save' });
      const next = ReaderReducer.reduce(saving, { type: 'webdav-save-result', success: true, message: '' });
      expect(next.webdavSaveStatus).assertEqual('saved');
    });

    it('webdavSaveResultSetsErrorStatus', 0, () => {
      let s = ReaderReducer.reduce(DemoUiState.initial(), { type: 'route-push', id: 'webdav-config' });
      s = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'serverUrl', settingsValue: 'https://dav.example' });
      const saving = ReaderReducer.reduce(s, { type: 'webdav-save' });
      const next = ReaderReducer.reduce(saving, { type: 'webdav-save-result', success: false, message: '保存失败' });
      expect(next.webdavSaveStatus).assertEqual('error');
      expect(next.webdavSaveMessage).assertEqual('保存失败');
    });

    it('webdavFieldsPersistAcrossTabSwitch', 0, () => {
      // webdav-field-update only applies on webdav-config or sync-backup routes.
      const s = DemoUiState.initial();
      s.routeId = 'webdav-config';
      const configured = ReaderReducer.reduce(s, { type: 'webdav-field-update', field: 'serverUrl', settingsValue: 'https://dav.example.com' });
      const switched = ReaderReducer.switchTab(configured, 'rss');
      const back = ReaderReducer.switchTab(switched, 'settings');
      expect(back.webdavServerUrl).assertEqual('https://dav.example.com');
    });
  });

  describe('Replace rule Core identity boundary', () => {
    it('newRuleUsesPendingIdInsteadOfCallerOrCoreRuleId', 0, () => {
      const state = ReaderReducer.reduce(DemoUiState.initial(), {
        type: 'route-push', id: 'reader-replace-overlay-v2',
      });
      const next = ReaderReducer.reduce(state, {
        type: 'replace-rule-add',
        replaceRuleId: 'rule-7',
        replaceRulePattern: 'old',
        replaceRuleReplacement: 'new',
        replaceRuleScope: 'chapter',
      });
      expect(next.replaceRules.length).assertEqual(1);
      expect(next.replaceRules[0].id).assertEqual('pending-rule-1');
      expect(next.replaceRules[0].pattern).assertEqual('old');
    });
  });
}
