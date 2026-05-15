// BookshelfService — validated CRUD operations wrapping IBookshelfRepository
import { IBookshelfRepository } from '../repository/BookshelfRepository';
import { LocalBook, LocalBookFormat } from '../models/LocalBook';
import { BookshelfItem } from '../models/BookshelfModels';

export class BookshelfService {
  private repo: IBookshelfRepository;

  constructor(repository: IBookshelfRepository) {
    this.repo = repository;
  }

  // Add book with validation
  addBook(title: string, filePath: string, format: LocalBookFormat, author?: string, fileSize?: number, encoding?: string): LocalBook | null {
    if (!title || title.trim().length === 0) {
      return null;
    }
    if (!filePath || filePath.trim().length === 0) {
      return null;
    }

    const book: LocalBook = {
      id: this.generateId(),
      title: title.trim(),
      author: author?.trim() || undefined,
      coverPath: undefined,
      filePath: filePath,
      fileFormat: format,
      fileSize: fileSize,
      encoding: encoding,
      addedAt: Date.now(),
      unknownFields: {}
    };

    const added = this.repo.add(book);
    return added ? book : null;
  }

  // Remove book (must exist)
  removeBook(id: string): boolean {
    if (!this.repo.exists(id)) {
      return false;
    }
    return this.repo.remove(id);
  }

  // Update book metadata (partial merge, preserves unknownFields)
  updateBook(id: string, updates: Partial<LocalBook>): LocalBook | null {
    const existing = this.repo.getById(id);
    if (!existing) {
      return null;
    }

    const merged: LocalBook = {
      id: existing.id,
      title: updates.title ?? existing.title,
      author: updates.author !== undefined ? updates.author : existing.author,
      coverPath: updates.coverPath !== undefined ? updates.coverPath : existing.coverPath,
      filePath: updates.filePath ?? existing.filePath,
      fileFormat: updates.fileFormat ?? existing.fileFormat,
      fileSize: updates.fileSize !== undefined ? updates.fileSize : existing.fileSize,
      encoding: updates.encoding !== undefined ? updates.encoding : existing.encoding,
      addedAt: existing.addedAt,
      lastOpenedAt: updates.lastOpenedAt !== undefined ? updates.lastOpenedAt : existing.lastOpenedAt,
      unknownFields: existing.unknownFields
    };

    const updated = this.repo.update(merged);
    return updated ? merged : null;
  }

  // List all books, sorted by lastOpenedAt desc
  listAll(): LocalBook[] {
    const all = this.repo.getAll();
    return all.sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt));
  }

  // List with progress
  listWithProgress(): BookshelfItem[] {
    return this.repo.getAllProgress();
  }

  // Get single book
  getBook(id: string): LocalBook | undefined {
    return this.repo.getById(id);
  }

  // Check existence
  hasBook(id: string): boolean {
    return this.repo.exists(id);
  }

  // Book count
  bookCount(): number {
    return this.repo.count();
  }

  // Update reading progress
  updateProgress(bookId: string, chapterIndex: number, chapterProgress: number, totalChapters: number): boolean {
    if (!this.repo.exists(bookId)) {
      return false;
    }
    if (chapterIndex < 0 || chapterProgress < 0 || chapterProgress > 1 || totalChapters <= 0) {
      return false;
    }
    return this.repo.updateProgress(bookId, chapterIndex, chapterProgress, totalChapters);
  }

  // Delete progress
  deleteProgress(bookId: string): void {
    this.repo.deleteProgress(bookId);
  }

  // Get unread books
  getUnread(): LocalBook[] {
    return this.repo.getUnread();
  }

  private generateId(): string {
    const now = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 10);
    return `${now}-${rand}`;
  }
}
