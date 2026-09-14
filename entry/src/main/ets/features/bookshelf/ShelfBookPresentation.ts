import type { ShelfBook } from '../../app/ReaderCoreGateway';

/** Shared, display-only projection. It never changes Core metadata or order. */
export class ShelfBookPresentation {
  static source(book: ShelfBook): string {
    if (book.sourceId === 'local') {
      const kind = book.kind?.trim() ?? '';
      // Core's legacy local kind identifies imported plain text, not a format label.
      if (kind.toLowerCase() === 'local' || kind.toLowerCase() === 'txt') return '本地 TXT';
      return kind.length > 0 ? `本地 ${kind.toUpperCase()}` : '本地书';
    }
    const name = book.sourceName?.trim() ?? '';
    return name.length > 0 && name !== book.sourceId.trim() && !/^[a-z][a-z0-9+.-]*:/i.test(name) && !/^www\./i.test(name)
      ? name : '书源名称暂不可用';
  }

  static latestChapter(book: ShelfBook): string {
    return book.lastChapter?.trim() || '暂无最新章节';
  }

  static progress(book: ShelfBook): string {
    const value = Math.max(0, Math.min(10000, book.readProgress ?? 0));
    if (value <= 0) return '未读';
    return value < 100 ? '已读 <1%' : `已读 ${Math.floor(value / 100)}%`;
  }

  static visible(books: ShelfBook[], selectedGroup: string): ShelfBook[] {
    return books.filter((book: ShelfBook): boolean => {
      const group = book.group?.trim() ?? '';
      return selectedGroup === '' || (selectedGroup === '默认' ? group === '' || group === '默认' : group === selectedGroup);
    });
  }
}
