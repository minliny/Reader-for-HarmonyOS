import type { JsonObject } from '@reader/core-harmony';

export const READER_VM_JOURNEY_SCOPE = 'vm-journeys';
export const READER_VM_SHELF_TITLE = 'ReaderShelfNovel';
export const READER_VM_NEW_TITLE = 'ReaderNewNovel';
export const READER_VM_MANGA_TITLE = 'ReaderComic';
export const READER_VM_AUTHOR = 'Reader Fixture Author';
export const READER_VM_LOCAL_TITLE = 'Reader Phase 1 公共长目录';
export const READER_VM_LOCAL_SHA256 = '27792a0e5906b59c33ecf8fd5a9984654aadbdcf46d668dd61ad7a6a623b48df';

const TEXT_TITLES: string[] = [READER_VM_SHELF_TITLE, READER_VM_NEW_TITLE];
const MANGA_TITLES: string[] = [READER_VM_MANGA_TITLE];

interface JourneySource {
  id: string;
  name: string;
  manga: boolean;
}

const SOURCES: JourneySource[] = [
  { id: 'https://novel-a.reader-journeys.invalid', name: 'ReaderNovelA', manga: false },
  { id: 'https://novel-b.reader-journeys.invalid', name: 'ReaderNovelB', manga: false },
  { id: 'https://comic-a.reader-journeys.invalid', name: 'ReaderComicA', manga: true },
  { id: 'https://comic-b.reader-journeys.invalid', name: 'ReaderComicB', manga: true },
];
const IMPORT_SOURCE: JourneySource = {
  id: 'https://v9-import.reader-journeys.invalid', name: 'ReaderJourneyImportV9', manga: false,
};
const IMPORT_URL: string = 'https://novel-a.reader-journeys.invalid/fixtures/v9-source.json';

export const READER_VM_SHELF_SOURCE = SOURCES[0].id;
export const READER_VM_IMPORT_SOURCE = IMPORT_SOURCE.id;

export function readerVmJourneyBookId(sourceId: string, title: string): string {
  return `${sourceId}/book/${title}`;
}

export function readerVmJourneyTitle(sourceId: string, bookId: string): string | undefined {
  const source = SOURCES.find(row => row.id === sourceId);
  return source === undefined ? undefined : (source.manga ? MANGA_TITLES : TEXT_TITLES)
    .find(title => readerVmJourneyBookId(sourceId, title) === bookId);
}

function sourceDefinition(source: JourneySource): JsonObject {
  return {
    bookSourceUrl: source.id, bookSourceName: source.name, bookSourceType: source.manga ? 2 : 0,
    enabled: true, enabledExplore: false, enabledCookieJar: false,
    searchUrl: `${source.id}/search?q={{key}}`,
    ruleSearch: { bookList: 'ul.results li.book', name: 'span.name@text', author: 'span.author@text',
      bookUrl: 'a.detail@href', lastChapter: 'span.latest@text' },
    ruleBookInfo: { name: 'h1@text', author: 'span.author@text', intro: 'p.intro@text', tocUrl: 'a.toc@href' },
    ruleToc: { chapterList: 'ol.toc li', chapterName: 'a@text', chapterUrl: 'a@href' },
    ruleContent: { content: source.manga ? 'tag.img@src' : 'div.content@text' },
  };
}

export function readerVmJourneySources(): JsonObject[] {
  return SOURCES.map(sourceDefinition);
}

export function readerVmJourneyImportDocument(url: string): string | undefined {
  return url === IMPORT_URL ? JSON.stringify([sourceDefinition(IMPORT_SOURCE)]) : undefined;
}

// Public, deterministic fixture. Only the scope-specific HTTP adapter calls
// this resolver, and the finite synthetic origins are never sent to a network.
export function readerVmJourneyResponse(params: JsonObject): JsonObject | undefined {
  const url = params['url'];
  if (typeof url !== 'string' || params['method'] !== 'GET' || params['usePlatformCookieJar'] === true) return undefined;
  const importDocument = readerVmJourneyImportDocument(url);
  if (importDocument !== undefined) {
    return { status: 200, body: importDocument,
      headers: { 'content-type': 'application/json; charset=utf-8' }, charsetHint: 'utf-8',
      finalUrl: url, redirects: [], cookies: [] };
  }
  const source = [...SOURCES, IMPORT_SOURCE].find(row => url.startsWith(`${row.id}/`));
  if (source === undefined) return undefined;
  const path = url.slice(source.id.length);
  const titles = source.manga ? MANGA_TITLES : TEXT_TITLES;
  let body = '';
  const search = /^\/search\?q=([A-Za-z]+)$/.exec(path);
  if (search !== null) {
    const matches = titles.filter(title => title.toLowerCase().includes(search[1].toLowerCase()));
    body = `<ul class="results">${matches.map(title => `<li class="book"><span class="name">${title}</span>` +
      `<span class="author">${READER_VM_AUTHOR}</span><span class="latest">第二章 校验</span>` +
      `<a class="detail" href="/book/${title}">详情</a></li>`).join('')}</ul>`;
  } else {
    const book = /^\/book\/([A-Za-z]+)(\/toc|\/chapter\/[12])?$/.exec(path);
    if (book === null || !titles.includes(book[1])) return undefined;
    const title = book[1];
    if (book[2] === undefined) {
      body = `<h1>${title}</h1><span class="author">${READER_VM_AUTHOR}</span>` +
        `<p class="intro">Reader 自动化公开样本。</p><a class="toc" href="/book/${title}/toc">目录</a>`;
    } else if (book[2] === '/toc') {
      body = `<ol class="toc"><li><a href="/book/${title}/chapter/1">第一章 启程</a></li>` +
        `<li><a href="/book/${title}/chapter/2">第二章 校验</a></li></ol>`;
    } else if (source.manga) {
      body = '<img src="/fixture-image/1.png"><img src="/fixture-image/2.png">';
    } else {
      body = '<div class="content">Reader 公开验证章节。<br>' +
        Array.from({ length: 32 }, (_, index: number): string =>
          `第 ${index + 1} 段。用同一份公开内容验证目录、阅读、切换书源和退出后的书架状态。<br>`).join('') + '</div>';
    }
  }
  return { status: 200, body, headers: { 'content-type': 'text/html; charset=utf-8' },
    charsetHint: 'utf-8', finalUrl: url, redirects: [], cookies: [] };
}

export function readerVmJourneyImageDataUri(params: JsonObject): string | undefined {
  const url = params['url'];
  if (typeof url !== 'string' || params['method'] !== 'GET' || params['usePlatformCookieJar'] === true) return undefined;
  const admitted = SOURCES.some((source: JourneySource): boolean => source.manga &&
    (url === `${source.id}/fixture-image/1.png` || url === `${source.id}/fixture-image/2.png`));
  return admitted ? MANGA_IMAGE_DATA_URI : undefined;
}

// Generated 128 × 224 RGB fixture PNG.
const MANGA_IMAGE_DATA_URI = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAIAAAADgCAIAAABEqPnGAAABY0lEQVR42u3dUQkAIBBEwetmKvsYxxz+28AOgizIwEtw871c7TUV' +
  'rJwAAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAPQAoPWhYAAAABAAAAIAQAAACAAAAQAgAAAEAIAAABAAAAIAQAAACAAAAQAg' +
  'AAAEAIAAABAAALoFMBS1EwYgAAAEAIAAABAAAAIAQAAACAAAAQAgAAAEAIAAABAAAAIAQAAACIAvSrKQASAAAAQAgAAAEAAAAgBA' +
  'AAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAAArgAAgAAAUAbAUNROGIAAABAAAAIAQAAACAAAAQAgAAAEAIAAABAAAAIAQAAACAAA' +
  'AQAgAL4oyUIGgAAAEAAAAgBAAAAIAAABACAAAAQAgAAAEAAAAgBAAAAIAAABACAAAAC4AgAAAgBAGQBDUTthAAIAQAAACAAAAQAg' +
  'AAAEAIAAABAAAAIAQAC+7ADhTXIS6XXm3AAAAABJRU5ErkJggg==';
