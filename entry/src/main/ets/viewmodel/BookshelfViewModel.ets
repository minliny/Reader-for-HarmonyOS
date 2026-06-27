// BookshelfViewModel — drives BookshelfTab/BookshelfPage.
//
// Loads books via Core 'bookshelf.list' command (Core SqliteStorage backed).
// Row type matches the legacy HomeBookRow fields so UI field accesses don't
// change (strangler: business source switched, UI layout preserved).
import { ReaderCoreClient } from '../api/ReaderCoreClient';

export interface BookshelfRow {
  id: string;
  title: string;
  author: string;
  format: string;
  progressText: string;
  isReading: boolean;
  sourceId: string;
}

export class BookshelfViewModel {
  private client: ReaderCoreClient;

  constructor() {
    this.client = ReaderCoreClient.get();
  }

  async loadBooks(): Promise<BookshelfRow[]> {
    try {
      const requestId = this.client.sendCommand('bookshelf.list', {} as Record<string, Object>);
      const data = await this.client.awaitResult(requestId, 10000);
      const obj = data as Record<string, Object>;
      const arrValue = obj['books'];
      if (!(arrValue instanceof Array)) {
        return [];
      }
      const arr = arrValue as Object[];
      const rows: BookshelfRow[] = [];
      for (let i = 0; i < arr.length; i++) {
        const b = arr[i] as Record<string, Object>;
        const row: BookshelfRow = {
          id: stringOrEmpty(b['bookUrl']),
          title: stringOrEmpty(b['name']),
          author: stringOrEmpty(b['author']) || '未知作者',
          format: 'TXT',
          progressText: '',
          isReading: false,
          sourceId: stringOrEmpty(b['origin'])
        };
        rows.push(row);
      }
      return rows;
    } catch (_e) {
      return [];
    }
  }
}

function stringOrEmpty(v: Object | undefined): string {
  return typeof v === 'string' ? (v as string) : '';
}
