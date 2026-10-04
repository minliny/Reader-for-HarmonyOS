import type { ShelfBook } from '../../app/ReaderCoreGateway';
import { MangaBookPresentation } from '../manga/MangaBookPresentation.ts';

export type ShelfProgressVariant = 'list-status' | 'grid-caption';

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

  /** Whole-book basis points only. Missing/nonfinite progress retains the
   * existing unread List / absent Grid baseline; it is not a page position. */
  static progress(book: ShelfBook, variant: ShelfProgressVariant = 'list-status'): string {
    // Unknown catalog mapping is distinct from a known zero-percent chapter.
    if (book.contentKind === 'manga' && !this.hasMangaChapterProgress(book)) return '*%';
    const value = this.progressPercent(book);
    if (value <= 0) return book.contentKind === 'manga' ? '已读 0%' : variant === 'grid-caption' ? '' : '未读';
    return value < 1 ? '已读 <1%' : `已读 ${Math.floor(value)}%`;
  }

  static progressPercent(book: ShelfBook): number {
    if (book.contentKind === 'manga' && !this.hasMangaChapterProgress(book)) return 0;
    const value = book.readProgress ?? 0;
    return Number.isFinite(value) ? Math.max(0, Math.min(10000, value)) / 100 : 0;
  }

  private static hasMangaChapterProgress(book: ShelfBook): boolean {
    const count = book.chapterCount, progress = book.readProgress;
    return count !== undefined && Number.isSafeInteger(count) && count > 0 &&
      progress !== undefined && Number.isFinite(progress) && progress >= 0 && progress <= 10000;
  }

  static readingPosition(book: ShelfBook): string {
    if (book.contentKind === 'manga') {
      return MangaBookPresentation.label(MangaBookPresentation.get(book.sourceId, book.bookId));
    }
    return book.currentChapterTitle?.trim() || '尚未阅读';
  }

  static contentLabel(book: ShelfBook): string {
    return book.contentKind === 'manga' ? '漫画' : book.contentKind === 'audio' ? '有声' : '小说';
  }

  static originLabel(book: ShelfBook): string {
    return book.sourceId === 'local' ? '本地' : '在线';
  }

  static visible(books: ShelfBook[], selectedGroup: string,
    readingState: string = 'all', sourceKind: string = 'all'): ShelfBook[] {
    return books.filter((book: ShelfBook): boolean => {
      const group = book.group?.trim() ?? '';
      const inGroup = selectedGroup === '' || (selectedGroup === '默认' ? group === '' || group === '默认' : group === selectedGroup);
      const progress = this.progressPercent(book);
      const mangaHasPosition = book.contentKind === 'manga' &&
        MangaBookPresentation.get(book.sourceId, book.bookId) !== undefined;
      const inState = book.contentKind === 'manga' ? (readingState === 'unread' ? !mangaHasPosition :
        readingState === 'reading' ? mangaHasPosition : readingState === 'finished' ? false : true) :
        readingState === 'unread' ? progress === 0 :
        readingState === 'reading' ? progress > 0 && progress < 100 :
        readingState === 'finished' ? progress === 100 : true;
      const inKind = sourceKind === 'local' ? book.sourceId === 'local' :
        sourceKind === 'online' ? book.sourceId !== 'local' : true;
      return inGroup && inState && inKind;
    });
  }
}
