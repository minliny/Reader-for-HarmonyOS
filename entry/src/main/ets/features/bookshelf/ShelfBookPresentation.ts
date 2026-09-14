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
    const value = this.progressPercent(book);
    if (value <= 0) return '未读';
    return value < 1 ? '已读 <1%' : `已读 ${Math.floor(value)}%`;
  }

  static progressPercent(book: ShelfBook): number {
    const value = book.readProgress ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.min(10000, value)) / 100 : 0;
  }

  static visible(books: ShelfBook[], selectedGroup: string,
    readingState: string = 'all', sourceKind: string = 'all'): ShelfBook[] {
    return books.filter((book: ShelfBook): boolean => {
      const group = book.group?.trim() ?? '';
      const inGroup = selectedGroup === '' || (selectedGroup === '默认' ? group === '' || group === '默认' : group === selectedGroup);
      const progress = this.progressPercent(book);
      const inState = readingState === 'unread' ? progress === 0 :
        readingState === 'reading' ? progress > 0 && progress < 100 :
        readingState === 'finished' ? progress === 100 : true;
      const inKind = sourceKind === 'local' ? book.sourceId === 'local' :
        sourceKind === 'online' ? book.sourceId !== 'local' : true;
      return inGroup && inState && inKind;
    });
  }
}
