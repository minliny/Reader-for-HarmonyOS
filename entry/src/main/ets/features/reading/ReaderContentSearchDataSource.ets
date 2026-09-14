import type { ReadingContentSearchResult } from './ReadingSessionFlowGateway';

export type ReaderContentSearchDataChange = 'same' | 'append' | 'replace';

export function readerContentSearchResultKey(row: ReadingContentSearchResult): string {
  return JSON.stringify([row.sourceId, row.bookId, row.chapterIndex, row.chapterOffset]);
}

/** Native LazyForEach owns virtualization. This adapter only publishes the
 * admitted query and canonical row identities; it never slices a viewport. */
export class ReaderContentSearchDataSource implements IDataSource {
  private rows: ReadingContentSearchResult[] = [];
  private keys: string[] = [];
  private query: string = '';
  private listeners: DataChangeListener[] = [];

  totalCount(): number { return this.rows.length; }
  getData(index: number): ReadingContentSearchResult { return this.rows[index]; }
  registerDataChangeListener(listener: DataChangeListener): void { this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((value: DataChangeListener): boolean => value !== listener);
  }

  publish(query: string, rows: ReadingContentSearchResult[]): ReaderContentSearchDataChange {
    if (query === this.query && rows === this.rows) return 'same';
    const keys = rows.map(readerContentSearchResultKey);
    const prefix = query === this.query && this.keys.length > 0 && this.keys.length <= keys.length &&
      this.keys.every((key: string, index: number): boolean => key === keys[index]);
    const previous = this.rows;
    this.query = query;
    this.rows = rows;
    this.keys = keys;
    if (!prefix) {
      for (const listener of this.listeners) listener.onDataReloaded();
      return 'replace';
    }
    // Stable-prefix pagination preserves the native anchor. Reloading the
    // entire LazyForEach would defeat maintainVisibleContentPosition.
    for (const listener of this.listeners) {
      for (let index = 0; index < previous.length; index += 1) {
        if (previous[index] !== rows[index]) listener.onDataChange(index);
      }
      for (let index = previous.length; index < rows.length; index += 1) listener.onDataAdd(index);
    }
    return rows.length > previous.length ? 'append' : 'same';
  }
}
