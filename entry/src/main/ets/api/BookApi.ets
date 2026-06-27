// BookApi — async facade for book.search/detail/toc/chapter.content.
//
// Mirrors Legado WebBook.searchBookAwait/getBookInfoAwait/getChapterListAwait/
// getContentAwait (app/src/main/java/io/legado/app/model/webBook/WebBook.kt).
// Each method sends a Core JSON command and awaits the matching result event.
import { ReaderCoreClient } from './ReaderCoreClient';

export interface Book {
  bookUrl: string;
  tocUrl: string;
  name: string;
  author: string;
  coverUrl: string;
  intro: string;
  kind: string;
  wordCount: string;
  latestChapterTitle: string;
  origin: string;
}

export interface SearchBook {
  bookUrl: string;
  name: string;
  author: string;
  coverUrl: string;
  intro: string;
  lastChapter: string;
  kind: string;
  origin: string;
}

export interface Chapter {
  title: string;
  url: string;
  index: number;
  isVip: boolean;
  isPay: boolean;
}

export class BookApi {
  private client: ReaderCoreClient;

  constructor(client: ReaderCoreClient) {
    this.client = client;
  }

  async search(sourceId: string, query: string, page: number = 1): Promise<SearchBook[]> {
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['sourceId'] = sourceId;
    params['query'] = query;
    params['page'] = page;
    const requestId = this.client.sendCommand('book.search', params);
    const data = await this.client.awaitResult(requestId);
    return parseSearchResult(data);
  }

  async detail(sourceId: string, book: Book): Promise<Book> {
    const bookParam: Record<string, Object> = {} as Record<string, Object>;
    bookParam['bookUrl'] = book.bookUrl;
    bookParam['name'] = book.name;
    bookParam['author'] = book.author;
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['sourceId'] = sourceId;
    params['book'] = bookParam;
    const requestId = this.client.sendCommand('book.detail', params);
    const data = await this.client.awaitResult(requestId);
    return parseBookDetail(data, book);
  }

  async toc(sourceId: string, book: Book): Promise<Chapter[]> {
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['sourceId'] = sourceId;
    params['bookId'] = book.bookUrl;
    const requestId = this.client.sendCommand('book.toc', params);
    const data = await this.client.awaitResult(requestId);
    return parseTocResult(data);
  }

  async content(sourceId: string, book: Book, chapter: Chapter): Promise<string> {
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['sourceId'] = sourceId;
    params['bookId'] = book.bookUrl;
    params['chapterTitle'] = chapter.title;
    params['chapterUrl'] = chapter.url;
    const requestId = this.client.sendCommand('chapter.content', params);
    const data = await this.client.awaitResult(requestId);
    const obj = data as Record<string, Object>;
    const contentValue = obj['content'];
    return typeof contentValue === 'string' ? (contentValue as string) : '';
  }
}

function parseSearchResult(data: object): SearchBook[] {
  const obj = data as Record<string, Object>;
  const arrValue = obj['books'];
  if (!(arrValue instanceof Array)) {
    return [];
  }
  const arr = arrValue as Object[];
  const result: SearchBook[] = [];
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i] as Record<string, Object>;
    const row: SearchBook = {
      bookUrl: stringOrEmpty(b['bookUrl']),
      name: stringOrEmpty(b['name']),
      author: stringOrEmpty(b['author']),
      coverUrl: stringOrEmpty(b['coverUrl']),
      intro: stringOrEmpty(b['intro']),
      lastChapter: stringOrEmpty(b['lastChapter']),
      kind: stringOrEmpty(b['kind']),
      origin: stringOrEmpty(b['origin'])
    };
    result.push(row);
  }
  return result;
}

function parseBookDetail(data: object, fallback: Book): Book {
  const obj = data as Record<string, Object>;
  const bookValue = obj['book'] ?? obj;
  const b = bookValue as Record<string, Object>;
  const book: Book = {
    bookUrl: stringOr(b['bookUrl'], fallback.bookUrl),
    tocUrl: stringOr(b['tocUrl'], fallback.tocUrl),
    name: stringOr(b['name'], fallback.name),
    author: stringOr(b['author'], fallback.author),
    coverUrl: stringOr(b['coverUrl'], fallback.coverUrl),
    intro: stringOr(b['intro'], fallback.intro),
    kind: stringOr(b['kind'], fallback.kind),
    wordCount: stringOr(b['wordCount'], fallback.wordCount),
    latestChapterTitle: stringOr(b['latestChapterTitle'], fallback.latestChapterTitle),
    origin: stringOr(b['origin'], fallback.origin)
  };
  return book;
}

function parseTocResult(data: object): Chapter[] {
  const obj = data as Record<string, Object>;
  const arrValue = obj['chapters'];
  if (!(arrValue instanceof Array)) {
    return [];
  }
  const arr = arrValue as Object[];
  const result: Chapter[] = [];
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i] as Record<string, Object>;
    const chapter: Chapter = {
      title: stringOrEmpty(c['title']),
      url: stringOrEmpty(c['url']),
      index: typeof c['index'] === 'number' ? (c['index'] as number) : i,
      isVip: typeof c['isVip'] === 'boolean' ? (c['isVip'] as boolean) : false,
      isPay: typeof c['isPay'] === 'boolean' ? (c['isPay'] as boolean) : false
    };
    result.push(chapter);
  }
  return result;
}

function stringOrEmpty(v: Object | undefined): string {
  return typeof v === 'string' ? (v as string) : '';
}

function stringOr(v: Object | undefined, fallback: string): string {
  return typeof v === 'string' ? (v as string) : fallback;
}
