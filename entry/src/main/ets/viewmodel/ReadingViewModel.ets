// ReadingViewModel — drives ReaderPage.
//
// Loads book detail → TOC → content via BookApi (Rust Core). Retires
// FixtureEPUBParserAdapter from production path (strangler: fixture retained
// as fallback in ReaderPage when no sourceId/bookUrl params are provided).
import { ReaderCoreClient } from '../api/ReaderCoreClient';
import { BookApi, Book, Chapter } from '../api/BookApi';

export interface ReaderChapter {
  title: string;
  content: string;
}

export class ReadingViewModel {
  private client: ReaderCoreClient;
  private bookApi: BookApi;
  private book: Book | null = null;
  private chapters: Chapter[] = [];
  private currentIndex: number = 0;

  constructor() {
    this.client = ReaderCoreClient.get();
    this.bookApi = new BookApi(this.client);
  }

  async loadBookAndToc(sourceId: string, bookUrl: string): Promise<ReaderChapter[]> {
    const seedBook: Book = {
      bookUrl: bookUrl,
      tocUrl: '',
      name: '',
      author: '',
      coverUrl: '',
      intro: '',
      kind: '',
      wordCount: '',
      latestChapterTitle: '',
      origin: sourceId
    };
    try {
      this.book = await this.bookApi.detail(sourceId, seedBook);
    } catch (_e) {
      this.book = seedBook;
    }
    try {
      this.chapters = await this.bookApi.toc(sourceId, this.book);
    } catch (_e) {
      this.chapters = [];
    }
    if (this.chapters.length === 0) {
      return [{ title: '无章节', content: '加载失败:TOC 为空' }];
    }
    this.currentIndex = 0;
    const firstContent = await this.loadChapter(0);
    return [{ title: this.chapters[0].title, content: firstContent }];
  }

  async loadChapter(index: number): Promise<string> {
    if (index < 0 || index >= this.chapters.length) {
      return '超出范围';
    }
    if (this.book === null) {
      return '书籍未加载';
    }
    this.currentIndex = index;
    try {
      const content = await this.bookApi.content(this.book.origin, this.book, this.chapters[index]);
      return content;
    } catch (e) {
      return `加载失败: ${e}`;
    }
  }

  async nextChapter(): Promise<ReaderChapter | null> {
    if (this.currentIndex + 1 >= this.chapters.length) {
      return null;
    }
    const index = this.currentIndex + 1;
    const content = await this.loadChapter(index);
    return { title: this.chapters[index].title, content };
  }

  async prevChapter(): Promise<ReaderChapter | null> {
    if (this.currentIndex - 1 < 0) {
      return null;
    }
    const index = this.currentIndex - 1;
    const content = await this.loadChapter(index);
    return { title: this.chapters[index].title, content };
  }

  get currentChapterIndex(): number {
    return this.currentIndex;
  }

  get totalChapters(): number {
    return this.chapters.length;
  }
}
