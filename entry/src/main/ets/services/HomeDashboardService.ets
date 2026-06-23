// HomeDashboardService - local app-facing composition for shell pages.
// Uses clean-room local services and fixture fallback; no external network or device execution is claimed.
import { IStorageAdapter, MockBookshelfRepository } from '../repository/BookshelfRepository';
import { BookSourceRepository } from '../repository/BookSourceRepository';
import { BookSource } from '../models/BookSource';
import { SearchQuery, SearchResultItem } from '../models/SearchModels';
import { JSONValue } from '../models/JSONValue';
import { BookshelfService } from './BookshelfService';
import { ProgressService } from './ProgressService';
import { SearchMode, SearchService } from './SearchService';
import { BridgeHTTPClient } from './BridgeHTTPClient';
import { BridgeClientWithFallback, FixtureReplayInterceptor } from './FixtureReplayInterceptor';
import { formatToString } from '../models/BookshelfModels';

export interface HomeBookRow {
  id: string;
  title: string;
  author: string;
  format: string;
  progressText: string;
  progressPercent: number;
  lastOpenedAt: number;
  isReading: boolean;
}

export interface HomeBookshelfSnapshot {
  totalBooks: number;
  activeBooks: number;
  unreadBooks: number;
  rows: HomeBookRow[];
}

export interface HomeSearchRow {
  title: string;
  author: string;
  detailURL: string;
  intro: string;
}

export interface HomeSearchSnapshot {
  rows: HomeSearchRow[];
  mode: SearchMode;
  error?: string;
}

export interface HomeReaderPreviewSnapshot {
  mode: string;
  bookTitle: string;
  author: string;
  chapterTitle: string;
  contentPreview: string;
  progressText: string;
  progressPercent: number;
  tocCount: number;
  currentChapterIndex: number;
  nextChapterTitle: string;
}

export interface HomeSourceManagementSnapshot {
  mode: string;
  sourceCount: number;
  enabledCount: number;
  disabledCount: number;
  groupCount: number;
  primarySourceName: string;
  ruleChain: string;
  debugStatus: string;
  redacted: boolean;
}

class HomeDashboardMemoryStorage implements IStorageAdapter {
  private data: Map<string, string> = new Map();

  read(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  write(key: string, value: string): void {
    this.data.set(key, value);
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}

export class HomeDashboardService {
  private bookshelfRepository: MockBookshelfRepository;
  private sourceRepository: BookSourceRepository;
  private bookshelfService: BookshelfService;
  private progressService: ProgressService;
  private searchService: SearchService;
  private defaultSearchSource: BookSource;

  constructor() {
    this.bookshelfRepository = new MockBookshelfRepository(true);
    this.sourceRepository = new BookSourceRepository(new HomeDashboardMemoryStorage());
    this.sourceRepository.initialize();
    this.bookshelfService = new BookshelfService(this.bookshelfRepository);
    this.progressService = new ProgressService(this.bookshelfRepository);
    this.searchService = new SearchService(new BridgeClientWithFallback(new BridgeHTTPClient(), new FixtureReplayInterceptor()));
    const unknownFields: Record<string, JSONValue> = {};
    const source: BookSource = {
      bookSourceName: 'Fixture Source',
      bookSourceUrl: 'fixture://default-source',
      searchUrl: 'fixture://search?key={{key}}',
      enabled: true,
      weight: 100,
      unknownFields: unknownFields
    };
    this.defaultSearchSource = source;
    this.seedSourceRepository(source);
  }

  getBookshelfSnapshot(): HomeBookshelfSnapshot {
    const books = this.bookshelfService.listAll();
    const rows: HomeBookRow[] = [];
    let activeBooks = 0;

    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      const progress = this.progressService.getProgress(book.id);
      const isReading = progress !== null;
      if (isReading) {
        activeBooks++;
      }
      const row: HomeBookRow = {
        id: book.id,
        title: book.title,
        author: book.author ?? '未知作者',
        format: formatToString(book.fileFormat),
        progressText: this.progressService.getProgressString(book.id),
        progressPercent: progress ? Math.round(progress.chapterProgress * 100) : 0,
        lastOpenedAt: book.lastOpenedAt ?? book.addedAt,
        isReading
      };
      rows.push(row);
    }

    const snapshot: HomeBookshelfSnapshot = {
      totalBooks: books.length,
      activeBooks,
      unreadBooks: books.length - activeBooks,
      rows
    };
    return snapshot;
  }

  getReaderPreviewSnapshot(): HomeReaderPreviewSnapshot {
    const books = this.bookshelfService.listAll();
    const book = books.length > 0 ? books[0] : null;
    const bookId = book ? book.id : 'reader-preview';
    const progress = this.progressService.getProgress(bookId);
    const currentChapterIndex = progress ? progress.currentChapterIndex : 0;
    const progressPercent = progress ? Math.round(progress.chapterProgress * 100) : 0;
    const snapshot: HomeReaderPreviewSnapshot = {
      mode: 'FIXTURE',
      bookTitle: book ? book.title : '本地书',
      author: book?.author ?? '未知作者',
      chapterTitle: '第一章 疯狂年代',
      contentPreview: '在中国，任何超脱飞扬的思想都会砰然坠地的，现实的引力太沉重了。',
      progressText: this.progressService.getProgressString(bookId),
      progressPercent,
      tocCount: progress ? progress.totalChapters : 3,
      currentChapterIndex,
      nextChapterTitle: '第二章 寂静的春天'
    };
    return snapshot;
  }

  getSourceManagementSnapshot(): HomeSourceManagementSnapshot {
    const sources = this.sourceRepository.getAllSources();
    const enabled = this.sourceRepository.getEnabledSources();
    const groups: Set<string> = new Set();
    for (let i = 0; i < sources.length; i++) {
      groups.add(sources[i].bookSourceGroup ?? '默认');
    }
    const snapshot: HomeSourceManagementSnapshot = {
      mode: 'FIXTURE',
      sourceCount: sources.length,
      enabledCount: enabled.length,
      disabledCount: sources.length - enabled.length,
      groupCount: groups.size,
      primarySourceName: enabled.length > 0 ? enabled[0].bookSourceName : '无启用书源',
      ruleChain: 'search+detail+toc+content',
      debugStatus: 'DEBUG fixture',
      redacted: sources.every((source: BookSource) => source.bookSourceUrl.indexOf('fixture://') === 0)
    };
    return snapshot;
  }

  async search(keyword: string): Promise<HomeSearchSnapshot> {
    const trimmed = keyword.trim();
    if (trimmed.length === 0) {
      const rows: HomeSearchRow[] = [];
      const snapshot: HomeSearchSnapshot = {
        rows: rows,
        mode: SearchMode.ERROR,
        error: 'EMPTY_KEYWORD'
      };
      return snapshot;
    }

    const query: SearchQuery = {
      keyword: trimmed,
      page: 1,
      pageSize: 20
    };
    const result = await this.searchService.search(this.defaultSearchSource, query);

    const rows = this.mapSearchRows(result.items);
    const snapshot: HomeSearchSnapshot = {
      rows: rows,
      mode: result.mode,
      error: result.error
    };
    return snapshot;
  }

  private mapSearchRows(items: SearchResultItem[]): HomeSearchRow[] {
    const rows: HomeSearchRow[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row: HomeSearchRow = {
        title: item.title,
        author: item.author ?? '未知作者',
        detailURL: item.detailURL,
        intro: item.intro ?? ''
      };
      rows.push(row);
    }
    return rows;
  }

  private seedSourceRepository(defaultSource: BookSource): void {
    const detailSource: BookSource = {
      bookSourceName: 'Fixture Detail Source',
      bookSourceGroup: '默认',
      bookSourceUrl: 'fixture://detail-source',
      searchUrl: 'fixture://detail-source/search?key={{key}}',
      searchRule: {
        name: 'fixture-search',
        searchUrl: 'fixture://detail-source/search?key={{key}}',
        method: 'GET',
        resultRule: '$.items',
        bookList: '$.items[*]',
        bookName: '$.title',
        bookAuthor: '$.author',
        bookDetail: '$.detail'
      },
      bookInfoRule: {
        name: 'fixture-detail',
        init: '$.book',
        bookName: '$.title',
        bookAuthor: '$.author',
        toc: '$.toc'
      },
      tocRule: {
        name: 'fixture-toc',
        chapterList: '$.chapters[*]',
        chapterName: '$.name',
        chapterUrl: '$.url',
        isVolume: false
      },
      contentRule: {
        name: 'fixture-content',
        content: '$.content'
      },
      enabled: true,
      weight: 90,
      unknownFields: {}
    };
    const disabledLoginSource: BookSource = {
      bookSourceName: 'Fixture Login Source',
      bookSourceGroup: '登录',
      bookSourceUrl: 'fixture://login-source',
      searchUrl: 'fixture://login-source/search?key={{key}}',
      loginDescriptor: {
        loginUrl: 'fixture://login',
        loginCheckJs: 'return true',
        loginUi: 'fixture'
      },
      enabled: false,
      weight: 10,
      unknownFields: {}
    };

    this.sourceRepository.addSource(defaultSource);
    this.sourceRepository.addSource(detailSource);
    this.sourceRepository.addSource(disabledLoginSource);
  }
}

export const readerHomeDashboard = new HomeDashboardService();
