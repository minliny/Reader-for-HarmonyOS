// BookshelfApi — facade for bookshelf.list / bookshelf.get.
//
// Mirrors Legado BookshelfViewModel + BookDao
// (app/src/main/java/io/legado/app/ui/book/changes/BookshelfViewModel.kt and
// app/src/main/java/io/legado/app/data/dao/BookDao.kt). Core's bookshelf
// commands return the user's saved books (Core SqliteStorage-backed), so the
// HarmonyOS host can render a real bookshelf without fixture data.
//
// S6 note: the bookshelf.list / bookshelf.get protocol commands are new — if
// Core does not yet implement them, callers should fall back to the local
// BookSourceRepository (S7 wires full parity). The facade degrades gracefully:
// it returns an empty list / null when Core responds with an error.
import { ReaderCoreClient } from './ReaderCoreClient';

export interface BookshelfItem {
  bookUrl: string;       // unique id within the source
  name: string;
  author: string;
  coverUrl: string;
  intro: string;
  lastChapterTitle: string;
  origin: string;        // sourceId (bookSourceUrl)
  lastReadAt: number;    // epoch millis, 0 if never opened
}

export class BookshelfApi {
  private client: ReaderCoreClient;

  constructor(client: ReaderCoreClient) {
    this.client = client;
  }

  // List all books on the bookshelf. Returns [] on Core error (graceful
  // degradation — caller renders an empty shelf rather than crashing).
  async list(): Promise<BookshelfItem[]> {
    const params: Record<string, Object> = {} as Record<string, Object>;
    const requestId = this.client.sendCommand('bookshelf.list', params);
    try {
      const data = await this.client.awaitResult(requestId, 10000);
      return parseBookshelfList(data);
    } catch (_e) {
      return [];
    }
  }

  // Get a single bookshelf entry by bookUrl. Returns null on Core error or
  // when the book is not on the shelf.
  async get(bookUrl: string): Promise<BookshelfItem | null> {
    const params: Record<string, Object> = {} as Record<string, Object>;
    params['bookUrl'] = bookUrl;
    const requestId = this.client.sendCommand('bookshelf.get', params);
    try {
      const data = await this.client.awaitResult(requestId, 10000);
      const obj = data as Record<string, Object>;
      const bookValue = obj['book'] ?? obj;
      if (bookValue === null || bookValue === undefined) {
        return null;
      }
      return parseBookshelfItem(bookValue as Record<string, Object>);
    } catch (_e) {
      return null;
    }
  }
}

function parseBookshelfList(data: object): BookshelfItem[] {
  const obj = data as Record<string, Object>;
  const arrValue = obj['books'];
  if (!(arrValue instanceof Array)) {
    return [];
  }
  const arr = arrValue as Object[];
  const result: BookshelfItem[] = [];
  for (let i = 0; i < arr.length; i++) {
    const item = parseBookshelfItem(arr[i] as Record<string, Object>);
    if (item !== null) {
      result.push(item);
    }
  }
  return result;
}

function parseBookshelfItem(b: Record<string, Object>): BookshelfItem | null {
  const bookUrlValue = b['bookUrl'];
  if (typeof bookUrlValue !== 'string') {
    return null; // required field missing
  }
  const lastReadAtValue = b['lastReadAt'];
  const item: BookshelfItem = {
    bookUrl: bookUrlValue as string,
    name: stringOrEmpty(b['name']),
    author: stringOrEmpty(b['author']),
    coverUrl: stringOrEmpty(b['coverUrl']),
    intro: stringOrEmpty(b['intro']),
    lastChapterTitle: stringOrEmpty(b['lastChapterTitle']),
    origin: stringOrEmpty(b['origin']),
    lastReadAt: typeof lastReadAtValue === 'number' ? (lastReadAtValue as number) : 0
  };
  return item;
}

function stringOrEmpty(v: Object | undefined): string {
  return typeof v === 'string' ? (v as string) : '';
}
