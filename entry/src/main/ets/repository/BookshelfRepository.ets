// BookshelfRepository — interface + preferences-backed + in-memory mock
import { LocalBook, LocalBookFormat } from '../models/LocalBook';
import { BookshelfItem } from '../models/BookshelfModels';

// MARK: - Repository Interface

export interface IBookshelfRepository {
  getAll(): LocalBook[];
  getById(id: string): LocalBook | undefined;
  add(book: LocalBook): boolean;
  update(book: LocalBook): boolean;
  remove(id: string): boolean;
  exists(id: string): boolean;
  count(): number;
  getProgress(bookId: string): BookshelfItem | undefined;
  getAllProgress(): BookshelfItem[];
  updateProgress(bookId: string, chapterIndex: number, chapterProgress: number, totalChapters: number): boolean;
  deleteProgress(bookId: string): void;
  getUnread(): LocalBook[];
}

// MARK: - Storage-backed Repository (serializes to JSON string via adapter)

export interface IStorageAdapter {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

const KEY_BOOKS = 'reader_books';
const KEY_PROGRESS = 'reader_progress';

export class StorageBookshelfRepository implements IBookshelfRepository {
  private books: Map<string, LocalBook> = new Map();
  private progress: Map<string, BookshelfItem> = new Map();
  private storage: IStorageAdapter;
  private initialized: boolean = false;

  constructor(storage: IStorageAdapter) {
    this.storage = storage;
  }

  initialize(): void {
    try {
      const booksJson = this.storage.read(KEY_BOOKS);
      if (booksJson) {
        const books: LocalBook[] = JSON.parse(booksJson);
        for (const b of books) {
          this.books.set(b.id, b);
        }
      }
      const progressJson = this.storage.read(KEY_PROGRESS);
      if (progressJson) {
        const progressMap: Record<string, BookshelfItem> = JSON.parse(progressJson);
        const keys = Object.keys(progressMap);
        for (let i = 0; i < keys.length; i++) {
          this.progress.set(keys[i], progressMap[keys[i]]);
        }
      }
    } catch (_e) {
      // First run: empty store
    }
    this.initialized = true;
  }

  private saveToStore(): void {
    this.storage.write(KEY_BOOKS, JSON.stringify(this.getAll()));
    const progressObj: Record<string, BookshelfItem> = {};
    const entries = this.progress.entries();
    let entry = entries.next();
    while (!entry.done) {
      progressObj[entry.value[0]] = entry.value[1];
      entry = entries.next();
    }
    this.storage.write(KEY_PROGRESS, JSON.stringify(progressObj));
  }

  getAll(): LocalBook[] { return Array.from(this.books.values()); }
  getById(id: string): LocalBook | undefined { return this.books.get(id); }

  add(book: LocalBook): boolean {
    if (this.books.has(book.id)) { return false; }
    this.books.set(book.id, book);
    this.saveToStore();
    return true;
  }
  update(book: LocalBook): boolean {
    if (!this.books.has(book.id)) { return false; }
    this.books.set(book.id, book);
    this.saveToStore();
    return true;
  }
  remove(id: string): boolean {
    if (!this.books.has(id)) { return false; }
    this.books.delete(id);
    this.progress.delete(id);
    this.saveToStore();
    return true;
  }
  exists(id: string): boolean { return this.books.has(id); }
  count(): number { return this.books.size; }

  getProgress(bookId: string): BookshelfItem | undefined { return this.progress.get(bookId); }
  getAllProgress(): BookshelfItem[] { return Array.from(this.progress.values()); }

  updateProgress(bookId: string, chapterIndex: number, chapterProgress: number, totalChapters: number): boolean {
    const book = this.books.get(bookId);
    if (!book) { return false; }
    const lastOpenedAt = Date.now();
    const item: BookshelfItem = { book, currentChapterIndex: chapterIndex, chapterProgress, totalChapters, lastOpenedAt };
    this.progress.set(bookId, item);
    book.lastOpenedAt = lastOpenedAt;
    this.books.set(bookId, book);
    this.saveToStore();
    return true;
  }
  deleteProgress(bookId: string): void {
    this.progress.delete(bookId);
    this.saveToStore();
  }
  getUnread(): LocalBook[] {
    const readIds: Set<string> = new Set();
    const entries = this.progress.entries();
    let entry = entries.next();
    while (!entry.done) {
      readIds.add(entry.value[0]);
      entry = entries.next();
    }
    return this.getAll().filter(b => !readIds.has(b.id));
  }
}

// MARK: - In-Memory Mock Repository (for testing/dev)

const MOCK_BOOKS: LocalBook[] = [

// MARK: - In-Memory Mock Repository (for testing/dev)
  {
    id: 'mock-001',
    title: '三体',
    author: '刘慈欣',
    coverPath: '',
    filePath: '/books/santi.txt',
    fileFormat: LocalBookFormat.txt,
    fileSize: 2048000,
    encoding: 'utf-8',
    addedAt: 1715702400000,
    lastOpenedAt: 1715788800000,
    unknownFields: {}
  },
  {
    id: 'mock-002',
    title: '活着',
    author: '余华',
    coverPath: '',
    filePath: '/books/huozhe.epub',
    fileFormat: LocalBookFormat.epub,
    fileSize: 512000,
    encoding: 'utf-8',
    addedAt: 1715616000000,
    lastOpenedAt: 1715875200000,
    unknownFields: {}
  },
  {
    id: 'mock-003',
    title: '百年孤独',
    author: '加西亚·马尔克斯',
    coverPath: '',
    filePath: '/books/bainiangudu.txt',
    fileFormat: LocalBookFormat.txt,
    fileSize: 3072000,
    encoding: 'utf-8',
    addedAt: 1715529600000,
    unknownFields: {}
  },
  {
    id: 'mock-004',
    title: '围城',
    author: '钱钟书',
    coverPath: '',
    filePath: '/books/weicheng.pdf',
    fileFormat: LocalBookFormat.pdf,
    fileSize: 4096000,
    encoding: 'utf-8',
    addedAt: 1715443200000,
    lastOpenedAt: 1715702400000,
    unknownFields: {}
  },
  {
    id: 'mock-005',
    title: '红楼梦',
    author: '曹雪芹',
    coverPath: '',
    filePath: '/books/hongloumeng.epub',
    fileFormat: LocalBookFormat.epub,
    fileSize: 8192000,
    encoding: 'utf-8',
    addedAt: 1715356800000,
    unknownFields: {}
  },
  {
    id: 'mock-006',
    title: '1984',
    author: 'George Orwell',
    coverPath: '',
    filePath: '/books/1984.txt',
    fileFormat: LocalBookFormat.txt,
    fileSize: 1024000,
    encoding: 'utf-8',
    addedAt: 1715270400000,
    lastOpenedAt: 1715616000000,
    unknownFields: {}
  },
  {
    id: 'mock-007',
    title: '小王子',
    author: 'Antoine de Saint-Exupéry',
    coverPath: '',
    filePath: '/books/xiaowangzi.epub',
    fileFormat: LocalBookFormat.epub,
    fileSize: 256000,
    encoding: 'utf-8',
    addedAt: 1715184000000,
    unknownFields: {}
  }
];

const MOCK_PROGRESS: Record<string, BookshelfItem> = {
  'mock-001': { book: MOCK_BOOKS[0], currentChapterIndex: 12, chapterProgress: 0.35, totalChapters: 34, lastOpenedAt: 1715788800000 },
  'mock-002': { book: MOCK_BOOKS[1], currentChapterIndex: 5, chapterProgress: 0.80, totalChapters: 12, lastOpenedAt: 1715875200000 },
  'mock-004': { book: MOCK_BOOKS[3], currentChapterIndex: 1, chapterProgress: 0.10, totalChapters: 9, lastOpenedAt: 1715702400000 },
  'mock-006': { book: MOCK_BOOKS[5], currentChapterIndex: 8, chapterProgress: 0.50, totalChapters: 24, lastOpenedAt: 1715616000000 },
};

export class MockBookshelfRepository implements IBookshelfRepository {
  private books: Map<string, LocalBook> = new Map();
  private progress: Map<string, BookshelfItem> = new Map();

  constructor(useMockData: boolean = true) {
    if (useMockData) {
      this.seedMockData();
    }
  }

  private seedMockData(): void {
    for (const book of MOCK_BOOKS) {
      this.books.set(book.id, book);
    }
    const keys = Object.keys(MOCK_PROGRESS);
    for (let i = 0; i < keys.length; i++) {
      const id = keys[i];
      const item = MOCK_PROGRESS[id];
      this.progress.set(id, item);
    }
  }

  // Book CRUD

  getAll(): LocalBook[] {
    return Array.from(this.books.values());
  }

  getById(id: string): LocalBook | undefined {
    return this.books.get(id);
  }

  add(book: LocalBook): boolean {
    if (this.books.has(book.id)) {
      return false;
    }
    this.books.set(book.id, book);
    return true;
  }

  update(book: LocalBook): boolean {
    if (!this.books.has(book.id)) {
      return false;
    }
    this.books.set(book.id, book);
    return true;
  }

  remove(id: string): boolean {
    if (!this.books.has(id)) {
      return false;
    }
    this.books.delete(id);
    this.progress.delete(id);
    return true;
  }

  exists(id: string): boolean {
    return this.books.has(id);
  }

  count(): number {
    return this.books.size;
  }

  // Reading progress

  getProgress(bookId: string): BookshelfItem | undefined {
    return this.progress.get(bookId);
  }

  getAllProgress(): BookshelfItem[] {
    // Return bookshelf items for books being read (have progress)
    return Array.from(this.progress.values());
  }

  updateProgress(bookId: string, chapterIndex: number, chapterProgress: number, totalChapters: number): boolean {
    const book = this.books.get(bookId);
    if (!book) {
      return false;
    }
    const lastOpenedAt = Date.now();
    const item: BookshelfItem = { book, currentChapterIndex: chapterIndex, chapterProgress, totalChapters, lastOpenedAt };
    this.progress.set(bookId, item);

    // Update lastOpenedAt on the book
    book.lastOpenedAt = lastOpenedAt;
    this.books.set(bookId, book);
    return true;
  }

  deleteProgress(bookId: string): void {
    this.progress.delete(bookId);
  }

  // Query helpers

  getSorted(sortBy: string = 'lastOpened'): BookshelfItem[] {
    const items = this.getAllProgress();
    switch (sortBy) {
      case 'title':
        return items.sort((a, b) => a.book.title.localeCompare(b.book.title));
      case 'author':
        return items.sort((a, b) => (a.book.author ?? '').localeCompare(b.book.author ?? ''));
      case 'addedAt':
        return items.sort((a, b) => b.book.addedAt - a.book.addedAt);
      case 'lastOpened':
      default:
        return items.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
    }
  }

  getUnread(): LocalBook[] {
    const readIds = new Set(this.progress.keys());
    return this.getAll().filter(b => !readIds.has(b.id));
  }
}
