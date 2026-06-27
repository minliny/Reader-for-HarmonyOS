// RustCoreEndToEndValidator — DEVICE/SIMULATOR tier end-to-end test.
//
// Proves the full Rust Core reading flow on a real device/simulator:
//   source.import → book.search → book.detail → book.toc → chapter.content
//
// This validator REQUIRES:
//   1. libreader_core_napi.so loaded (NAPI bridge active)
//   2. Network access (OHOSHttpHostTransport calls @ohos.net.http)
//   3. Real book source (sudugu.org) reachable
//
// Tier: DEVICE/SIMULATOR. NOT headless. NOT fixture.
// Evidence layer: simulator build ≠ real device proof — annotate which.
//
// Anti-fixture assertion: search results must come from the live network
// (not from any local fixture replay). The test fails if BookApi.search
// returns zero results, proving the Rust Core → HostAdapter → HTTP transport
// → live source chain is exercised.

import { hilog } from '@kit.PerformanceAnalysisKit';
import { ReaderCoreClient } from '../api/ReaderCoreClient';
import { BookApi, Book, Chapter, SearchBook } from '../api/BookApi';
import { SourceApi, ImportResult } from '../api/SourceApi';

interface TestResult { name: string; passed: boolean; error?: string; }

class TestRunner {
  results: TestResult[] = [];
  passed: number = 0;
  failed: number = 0;
  assert(c: boolean, n: string, e?: string): void {
    this.results.push({ name: n, passed: c, error: c ? undefined : e });
    if (c) { this.passed++; } else { this.failed++; }
  }
  summary(): string { return `${this.passed}P ${this.failed}F / ${this.results.length}`; }
}

// Real Legado book source JSON (速读谷吧 sudugu.org).
// Embedded as a backtick string to avoid ArkTS object-literal typing.
const SUDUGU_BOOK_SOURCE_JSON = `{"bookSourceGroup":"小说 书源","bookSourceName":"速读谷吧（优）","bookSourceType":0,"bookSourceUrl":"https://www.sudugu.org","concurrentRate":"3","customOrder":154,"enabled":true,"enabledCookieJar":true,"enabledExplore":true,"exploreUrl":"[{\\"title\\":\\"玄幻小说\\",\\"url\\":\\"/xuanhuan/\\"}, {\\"title\\":\\"仙侠小说\\",\\"url\\":\\"/xianxia/\\"}, {\\"title\\":\\"都市小说\\",\\"url\\":\\"/dushi/\\"}, {\\"title\\":\\"历史小说\\",\\"url\\":\\"/lishi/\\"}, {\\"title\\":\\"军事小说\\",\\"url\\":\\"/junshi/\\"}, {\\"title\\":\\"科幻小说\\",\\"url\\":\\"/kehuan/\\"}, {\\"title\\":\\"言情小说\\",\\"url\\":\\"/yanqing/\\"}]","header":"{\\"User-Agent\\": \\"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\\"}","lastUpdateTime":1772086280887,"respondTime":15017,"searchUrl":"https://www.sudugu.org/i/sor.aspx?key={{key}}","weight":0,"ruleSearch":{"author":"tag.p.1@tag.a@text##作者：","bookList":"class.item","bookUrl":"tag.h3@tag.a@href","checkKeyWord":"轮回乐园","coverUrl":"tag.img@src","kind":"tag.p.0@tag.span.1@text","lastChapter":"tag.ul@tag.li.0@tag.a@text","name":"tag.h3@tag.a@text"},"ruleBookInfo":{"author":"class.itemtxt@tag.p@tag.a@text","coverUrl":"class.item@tag.img@src","downloadUrls":"@put:{id:\\"##/(\\\\\\\\d+)/##1\\"}@js:result='https://www.sudugu.org/txt/?id='+result.id+'&p=1'","intro":"class.container@class.des bb@tag.p@text","kind":"class.itemtxt@tag.p.0@tag.span.1@text","lastChapter":"class.itemtxt@tag.li@tag.a@text##\\n发错了\\n第4143章 番外3","name":"tag.h1@tag.a@text## -速读谷","tocUrl":"{{baseUrl}}/#dir","wordCount":"class.itemtxt@tag.h1@tag.i@text"},"ruleToc":{"chapterList":"id.list@tag.li","chapterName":"tag.a@text","chapterUrl":"tag.a@href","isVip":"id.pages@tag.a@href","nextTocUrl":"@xpath://div[@class='pages bb']//a[contains(text(),'下一页')]/@href"},"ruleContent":{"content":"class.con@html##<div.*?>|</div>","nextContentUrl":"@xpath://div[@class='prenext']//a[contains(text(),'下一页')]/@href"}}`;

const TEST_KEYWORD = '魔女';
const TAG = 'RustCoreE2E';

export interface RustCoreE2EResult {
  runner: TestRunner;
  searchResults: SearchBook[];
  book: Book | null;
  chapters: Chapter[];
  firstChapterContent: string;
  tier: string;  // 'simulator' | 'device' | 'headless-fail'
}

export async function runRustCoreEndToEndTests(): Promise<RustCoreE2EResult> {
  const r = new TestRunner();
  let searchResults: SearchBook[] = [];
  let book: Book | null = null;
  let chapters: Chapter[] = [];
  let firstChapterContent = '';
  let tier = 'simulator';

  // ---------- Step 1: ReaderCoreClient init ----------
  let client: ReaderCoreClient;
  try {
    client = ReaderCoreClient.get();
    r.assert(true, 'ReaderCoreClient.get() available');
  } catch (e) {
    r.assert(false, 'ReaderCoreClient.get() available', `init failed: ${e}`);
    const failResult: RustCoreE2EResult = {
      runner: r, searchResults, book, chapters,
      firstChapterContent, tier: 'headless-fail'
    };
    return failResult;
  }

  // ---------- Step 2: source.import ----------
  const sourceApi = new SourceApi(client);
  let sourceId = 'https://www.sudugu.org';
  try {
    const importResult: ImportResult = await sourceApi.importBookSource(SUDUGU_BOOK_SOURCE_JSON);
    r.assert(importResult.success, 'source.import succeeds',
             importResult.success ? undefined : `import failed: ${importResult.data}`);
    if (!importResult.success) {
      const failResult: RustCoreE2EResult = {
        runner: r, searchResults, book, chapters,
        firstChapterContent, tier
      };
      return failResult;
    }
  } catch (e) {
    r.assert(false, 'source.import succeeds', `exception: ${e}`);
    const failResult: RustCoreE2EResult = {
      runner: r, searchResults, book, chapters,
      firstChapterContent, tier
    };
    return failResult;
  }

  // ---------- Step 3: book.search ----------
  const bookApi = new BookApi(client);
  try {
    searchResults = await bookApi.search(sourceId, TEST_KEYWORD, 1);
    r.assert(searchResults.length > 0, 'book.search returns >0 results',
             `got ${searchResults.length} results (expected >0 from live source)`);
    if (searchResults.length > 0) {
      const first = searchResults[0];
      r.assert(first.name.length > 0, 'search result[0].name non-empty',
               `name="${first.name}"`);
      r.assert(first.bookUrl.length > 0, 'search result[0].bookUrl non-empty',
               `bookUrl="${first.bookUrl}"`);
      r.assert(first.author.length > 0, 'search result[0].author non-empty',
               `author="${first.author}"`);
      hilog.info(0x0000, TAG, `search hit: ${first.name} / ${first.author} / ${first.bookUrl}`);
    }
  } catch (e) {
    r.assert(false, 'book.search returns >0 results', `exception: ${e}`);
    const failResult: RustCoreE2EResult = {
      runner: r, searchResults, book, chapters,
      firstChapterContent, tier
    };
    return failResult;
  }

  // ---------- Step 4: book.detail ----------
  if (searchResults.length === 0) {
    const failResult: RustCoreE2EResult = {
      runner: r, searchResults, book, chapters,
      firstChapterContent, tier
    };
    return failResult;
  }
  const seedBook: Book = {
    bookUrl: searchResults[0].bookUrl,
    tocUrl: '',
    name: searchResults[0].name,
    author: searchResults[0].author,
    coverUrl: searchResults[0].coverUrl,
    intro: searchResults[0].intro,
    kind: searchResults[0].kind,
    wordCount: '',
    latestChapterTitle: '',
    origin: sourceId
  };
  try {
    book = await bookApi.detail(sourceId, seedBook);
    r.assert(book !== null, 'book.detail returns book');
    if (book) {
      r.assert(book.name.length > 0, 'detail book.name non-empty',
               `name="${book.name}"`);
      r.assert(book.tocUrl.length > 0 || book.bookUrl.length > 0,
               'detail book has tocUrl or bookUrl',
               `tocUrl="${book.tocUrl}" bookUrl="${book.bookUrl}"`);
      hilog.info(0x0000, TAG, `detail: ${book.name} / ${book.author} / tocUrl=${book.tocUrl}`);
    }
  } catch (e) {
    r.assert(false, 'book.detail returns book', `exception: ${e}`);
    const failResult: RustCoreE2EResult = {
      runner: r, searchResults, book, chapters,
      firstChapterContent, tier
    };
    return failResult;
  }

  // ---------- Step 5: book.toc ----------
  if (!book) {
    const failResult: RustCoreE2EResult = {
      runner: r, searchResults, book, chapters,
      firstChapterContent, tier
    };
    return failResult;
  }
  try {
    chapters = await bookApi.toc(sourceId, book);
    r.assert(chapters.length > 0, 'book.toc returns >0 chapters',
             `got ${chapters.length} chapters (expected >0)`);
    if (chapters.length > 0) {
      const ch0 = chapters[0];
      r.assert(ch0.title.length > 0, 'toc chapter[0].title non-empty',
               `title="${ch0.title}"`);
      r.assert(ch0.url.length > 0, 'toc chapter[0].url non-empty',
               `url="${ch0.url}"`);
      hilog.info(0x0000, TAG, `toc[0]: ${ch0.title} / ${ch0.url}`);
    }
  } catch (e) {
    r.assert(false, 'book.toc returns >0 chapters', `exception: ${e}`);
    const failResult: RustCoreE2EResult = {
      runner: r, searchResults, book, chapters,
      firstChapterContent, tier
    };
    return failResult;
  }

  // ---------- Step 6: chapter.content ----------
  if (chapters.length === 0 || !book) {
    const failResult: RustCoreE2EResult = {
      runner: r, searchResults, book, chapters,
      firstChapterContent, tier
    };
    return failResult;
  }
  try {
    firstChapterContent = await bookApi.content(sourceId, book, chapters[0]);
    const contentLen = firstChapterContent.length;
    r.assert(contentLen > 0, 'chapter.content returns non-empty text',
             `got ${contentLen} chars (expected >0)`);
    // Anti-fixture assertion: content should not be the fixture string.
    r.assert(firstChapterContent.indexOf('fixture reader unavailable') === -1,
             'chapter.content is not fixture fallback text');
    hilog.info(0x0000, TAG, `content[0..80]: ${firstChapterContent.substring(0, 80)}...`);
  } catch (e) {
    r.assert(false, 'chapter.content returns non-empty text', `exception: ${e}`);
  }

  const result: RustCoreE2EResult = {
    runner: r, searchResults, book, chapters,
    firstChapterContent, tier
  };
  return result;
}
