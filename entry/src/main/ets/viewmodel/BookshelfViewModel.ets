// BookshelfViewModel — SHELL_ONLY_PLACEHOLDER
// DO NOT bind to UI pages until bridge service (HOS-2B-002) is complete.
// Currently unlinked from Index.ets. Use BookshelfService for headless operations.
import { IBookshelfRepository, MockBookshelfRepository } from '../repository/BookshelfRepository';
import { LocalBook } from '../models/LocalBook';
import {
  BookshelfItem,
  BookshelfState,
  BookshelfStats,
  SortOrder,
  FilterCriteria,
  defaultBookshelfState,
  filterMatchesFormat
} from '../models/BookshelfModels';

@Observed
export class BookshelfViewModel {
  private repository: IBookshelfRepository;
  state: BookshelfState;

  constructor(repository: IBookshelfRepository = new MockBookshelfRepository(true)) {
    this.repository = repository;
    this.state = defaultBookshelfState();
    this.loadBooks();
  }

  // Data loading

  loadBooks(): void {
    this.state.loading = true;
    try {
      this.state.items = this.applySortAndFilter();
    } finally {
      this.state.loading = false;
    }
  }

  refresh(): void {
    this.loadBooks();
  }

  // Sort & Filter

  setSortOrder(order: SortOrder): void {
    this.state.sortOrder = order;
    this.loadBooks();
  }

  setFilter(filter: FilterCriteria): void {
    this.state.filter = filter;
    this.loadBooks();
  }

  setSearchQuery(query: string): void {
    this.state.searchQuery = query;
    this.loadBooks();
  }

  private applySortAndFilter(): BookshelfItem[] {
    let items = this.repository.getAllProgress();

    // Apply filter
    if (this.state.filter !== FilterCriteria.all) {
      items = items.filter(item => filterMatchesFormat(this.state.filter, item.book.fileFormat));
    }

    // Apply search
    if (this.state.searchQuery.trim() !== '') {
      const q = this.state.searchQuery.toLowerCase();
      items = items.filter(item =>
        item.book.title.toLowerCase().includes(q) ||
      (item.book.author ?? '').toLowerCase().includes(q)
      );
    }

    // Apply sort
    switch (this.state.sortOrder) {
      case SortOrder.title:
        items.sort((a, b) => a.book.title.localeCompare(b.book.title));
        break;
      case SortOrder.author:
        items.sort((a, b) => (a.book.author ?? '').localeCompare(b.book.author ?? ''));
        break;
      case SortOrder.addedAt:
        items.sort((a, b) => b.book.addedAt - a.book.addedAt);
        break;
      case SortOrder.lastOpened:
      default:
        items.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
        break;
    }

    return items;
  }

  // Book operations

  addBook(book: LocalBook): boolean {
    const added = this.repository.add(book);
    if (added) {
      this.loadBooks();
    }
    return added;
  }

  removeBook(id: string): boolean {
    const removed = this.repository.remove(id);
    if (removed) {
      this.loadBooks();
    }
    return removed;
  }

  updateBook(book: LocalBook): boolean {
    const updated = this.repository.update(book);
    if (updated) {
      this.loadBooks();
    }
    return updated;
  }

  // Progress

  updateProgress(bookId: string, chapterIndex: number, chapterProgress: number, totalChapters: number): void {
    this.repository.updateProgress(bookId, chapterIndex, chapterProgress, totalChapters);
    this.loadBooks();
  }

  // Computed properties (non-reactive helpers)

  getStats(): BookshelfStats {
    const all = this.repository.getAll();
    const reading = this.repository.getAllProgress().length;
    const byFormat: Record<string, number> = {};

    for (const book of all) {
      const key = book.fileFormat.toString();
      byFormat[key] = (byFormat[key] ?? 0) + 1;
    }

    return {
      totalBooks: all.length,
      booksReading: reading,
      booksFinished: 0,
      byFormat
    };
  }

  getUnreadBooks(): LocalBook[] {
    return this.repository.getUnread();
  }

  getSortedBooks(): LocalBook[] {
    // All books, sorted by title
    return this.repository.getAll().sort((a, b) => a.title.localeCompare(b.title));
  }
}
