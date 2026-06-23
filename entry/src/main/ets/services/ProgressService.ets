// ProgressService — reading progress tracking per book
import { IBookshelfRepository } from '../repository/BookshelfRepository';

export interface ReadingProgress {
  bookId: string;
  currentChapterIndex: number;
  chapterProgress: number;     // 0.0 - 1.0
  totalChapters: number;
  lastOpenedAt: number;
}

export interface ProgressSummary {
  totalBooksTracked: number;
  totalChaptersRead: number;
  averageProgress: number;
  recentlyRead: ReadingProgress[];
}

export class ProgressService {
  private repo: IBookshelfRepository;

  constructor(repository: IBookshelfRepository) {
    this.repo = repository;
  }

  // Get progress for a book
  getProgress(bookId: string): ReadingProgress | null {
    const item = this.repo.getProgress(bookId);
    if (!item) { return null; }
    return {
      bookId: item.book.id,
      currentChapterIndex: item.currentChapterIndex,
      chapterProgress: item.chapterProgress,
      totalChapters: item.totalChapters,
      lastOpenedAt: item.lastOpenedAt ?? item.book.addedAt
    };
  }

  // Update progress with validation
  updateProgress(bookId: string, chapterIndex: number, chapterProgress: number, totalChapters: number): boolean {
    if (chapterIndex < 0 || chapterProgress < 0.0 || chapterProgress > 1.0 || totalChapters <= 0) {
      return false;
    }
    return this.repo.updateProgress(bookId, chapterIndex, chapterProgress, totalChapters);
  }

  // Mark book as finished
  markFinished(bookId: string, totalChapters: number): boolean {
    return this.repo.updateProgress(bookId, totalChapters - 1, 1.0, totalChapters);
  }

  // Delete progress (reset reading state)
  deleteProgress(bookId: string): void {
    this.repo.deleteProgress(bookId);
  }

  // Get all books being actively read (have progress data)
  getActiveBooks(): ReadingProgress[] {
    const items = this.repo.getAllProgress();
    const result: ReadingProgress[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const progress: ReadingProgress = {
        bookId: item.book.id,
        currentChapterIndex: item.currentChapterIndex,
        chapterProgress: item.chapterProgress,
        totalChapters: item.totalChapters,
        lastOpenedAt: item.lastOpenedAt ?? item.book.addedAt
      };
      result.push(progress);
    }
    return result;
  }

  // Get recently read books, sorted by lastOpenedAt
  getRecentBooks(limit: number = 5): ReadingProgress[] {
    const active = this.getActiveBooks();
    active.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
    return active.slice(0, limit);
  }

  // Calculate summary statistics
  getSummary(): ProgressSummary {
    const active = this.getActiveBooks();
    const totalBooksTracked = active.length;
    let totalChaptersRead = 0;
    let totalProgress = 0;

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      totalChaptersRead += p.currentChapterIndex + 1;
      totalProgress += p.chapterProgress;
    }

    const averageProgress = totalBooksTracked > 0 ? totalProgress / totalBooksTracked : 0;
    const recentlyRead = this.getRecentBooks(3);

    return {
      totalBooksTracked,
      totalChaptersRead,
      averageProgress,
      recentlyRead
    };
  }

  // Check if a book has any progress
  hasProgress(bookId: string): boolean {
    return this.repo.getProgress(bookId) !== undefined;
  }

  // Get progress percentage as formatted string
  getProgressString(bookId: string): string {
    const progress = this.getProgress(bookId);
    if (!progress) { return '未读'; }
    if (progress.chapterProgress >= 1.0 &&
      progress.currentChapterIndex >= progress.totalChapters - 1) {
      return '已读完';
    }
    return `${Math.round(progress.chapterProgress * 100)}%`;
  }
}
