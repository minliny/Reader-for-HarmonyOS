// Bookshelf domain models — builds on LocalBook DTO from LocalBook.ets
import { LocalBook, LocalBookFormat } from './LocalBook';

export enum SortOrder {
  lastOpened = 'lastOpened',
  addedAt = 'addedAt',
  title = 'title',
  author = 'author'
}

export enum FilterCriteria {
  all = 'all',
  txt = 'txt',
  epub = 'epub',
  pdf = 'pdf'
}

export interface BookshelfItem {
  book: LocalBook;
  currentChapterIndex: number;
  chapterProgress: number;    // 0.0 - 1.0
  totalChapters: number;
  lastOpenedAt?: number;
}

export interface BookshelfState {
  items: BookshelfItem[];
  loading: boolean;
  error?: string;
  sortOrder: SortOrder;
  filter: FilterCriteria;
  searchQuery: string;
}

export interface BookshelfStats {
  totalBooks: number;
  booksReading: number;
  booksFinished: number;
  byFormat: Record<string, number>;
}

export function defaultBookshelfState(): BookshelfState {
  return {
    items: [],
    loading: false,
    sortOrder: SortOrder.lastOpened,
    filter: FilterCriteria.all,
    searchQuery: ''
  };
}

export function formatToString(format: LocalBookFormat): string {
  switch (format) {
    case LocalBookFormat.txt: return 'TXT';
    case LocalBookFormat.epub: return 'EPUB';
    case LocalBookFormat.pdf: return 'PDF';
    case LocalBookFormat.html: return 'HTML';
    default: return 'Unknown';
  }
}

export function filterMatchesFormat(filter: FilterCriteria, format: LocalBookFormat): boolean {
  if (filter === FilterCriteria.all) return true;
  return filter === format;
}
