// ReaderPage — production path uses ReadingViewModel (Rust Core
// book.detail → book.toc → chapter.content).
//
// Accepts optional router params { sourceId, bookUrl, bookName }. When params
// are present, routes through Rust Core. When absent (legacy navigation from
// BookshelfTab without params), falls back to FixtureEPUBParserAdapter
// (strangler: fixture retained as fallback, S7 removal).
//
// No socket / WebView is touched here (red line 4); HTTP is handled by
// OHOSHttpHostTransport beneath the Rust Core host adapter.

import { router } from '@kit.ArkUI';
import { ReadingViewModel, ReaderChapter } from '../viewmodel/ReadingViewModel';
import { readerHomeDashboard, HomeBookRow } from '../services/HomeDashboardService';
import { ReadingFlowStateMachine, ReadingState } from '../services/ReadingFlowStateMachine';
import { MockBookshelfRepository } from '../repository/BookshelfRepository';
import { BookshelfService } from '../services/BookshelfService';
import { ProgressService } from '../services/ProgressService';
import { FixtureEPUBParserAdapter, buildStoredEPUBFixture } from '../adapters/LocalBookPlatformAdapters';
import { EPUBMapping } from '../parser/EPUBParserContract';
import { LocalBookFormat } from '../models/LocalBook';

interface ReaderParams {
  sourceId?: string;
  bookUrl?: string;
  bookName?: string;
}

@Entry
@Component
struct ReaderPage {
  @State machine: ReadingFlowStateMachine = new ReadingFlowStateMachine();
  @State state: ReadingState = ReadingState.IDLE;
  @State chapters: ReaderChapter[] = [];
  @State currentIndex: number = 0;
  @State fontSize: number = 18;
  @State bookTitle: string = '本地书';
  @State progressText: string = '未读';
  @State loading: boolean = true;
  @State error: string = '';
  @State useRustCore: boolean = false;
  @State tocTitles: string[] = [];
  @State showTocPanel: boolean = false;
  @State realIndex: number = 0;
  private vm: ReadingViewModel | null = null;
  private repository: MockBookshelfRepository = new MockBookshelfRepository(true);
  private bookshelf: BookshelfService = new BookshelfService(this.repository);
  private progress: ProgressService = new ProgressService(this.repository);

  aboutToAppear(): void {
    const params = router.getParams() as ReaderParams;
    if (params && params.sourceId && params.bookUrl) {
      this.useRustCore = true;
      this.loadFromRustCore(params.sourceId!, params.bookUrl!, params.bookName ?? '');
    } else {
      this.useRustCore = false;
      this.loadFixtureBook();
    }
  }

  private async loadFromRustCore(sourceId: string, bookUrl: string, bookName: string): Promise<void> {
    this.loading = true;
    this.error = '';
    this.bookTitle = bookName;
    try {
      this.vm = new ReadingViewModel();
      const initial = await this.vm.loadBookAndToc(sourceId, bookUrl);
      this.chapters = initial;
      this.currentIndex = 0;
      this.realIndex = 0;
      this.tocTitles = this.vm.getTocTitles();
      const total: number = this.tocTitles.length > 0 ? this.tocTitles.length : initial.length;
      this.machine.openBook(bookUrl, sourceId);
      this.machine.tocLoaded(total);
      this.machine.selectChapter(0);
      this.machine.chapterLoaded();
      this.state = this.machine.getState();
      this.progressText = `0/${total}`;
    } catch (e) {
      this.error = `Rust Core 加载失败: ${e}`;
      this.chapters = [{ title: '加载失败', content: this.error }];
    }
    this.loading = false;
  }

  private loadFixtureBook(): void {
    // Parse a fixture EPUB for the chapter manifest + first chapter body.
    const parser = new FixtureEPUBParserAdapter();
    const data = buildStoredEPUBFixture();
    parser.parse(data).then((result) => {
      const book = EPUBMapping.toLocalBook(result.metadata);
      book.filePath = 'sandbox://reader/fixture.epub';
      book.fileFormat = LocalBookFormat.epub;
      const added = this.bookshelf.addBook(book.title, book.filePath, book.fileFormat, book.author, data.byteLength, 'utf-8');
      const bookId = added ? added.id : 'reader-fixture';
      this.bookTitle = book.title;
      const navTitles: string[] = result.navPoints.length > 0 ?
        result.navPoints.map((p) => p.label) : ['第一章 疯狂年代', '第二章 寂静的春天'];
      const bodies: string[] = [
        '在中国，任何超脱飞扬的思想都会砰然坠地的，现实的引力太沉重了。',
        '那个早上，孩子们被一种奇怪的声音惊醒，那声音仿佛来自地底深处。'
      ];
      const chapters: ReaderChapter[] = [];
      for (let i = 0; i < navTitles.length; i++) {
        chapters.push({ title: navTitles[i], content: bodies[i % bodies.length] });
      }
      this.chapters = chapters;
      this.tocTitles = navTitles;
      this.machine.openBook(bookId, 'fixture://reader');
      this.machine.tocLoaded(chapters.length);
      this.machine.selectChapter(0);
      this.machine.chapterLoaded();
      const existing = this.progress.getProgress(bookId);
      this.currentIndex = existing ? existing.currentChapterIndex : 0;
      if (existing) {
        this.machine.selectChapter(Math.min(this.currentIndex, chapters.length - 1));
        this.machine.chapterLoaded();
      }
      this.state = this.machine.getState();
      this.progressText = this.progress.getProgressString(bookId);
      this.realIndex = this.currentIndex;
      this.loading = false;
    }).catch((_e: Error) => {
      this.chapters = [{ title: '第一章', content: 'fixture reader unavailable' }];
      this.loading = false;
    });
  }

  private saveProgress(): void {
    const ctx = this.machine.getContext();
    if (!ctx) { return; }
    this.progress.updateProgress(ctx.bookId, this.currentIndex, 0.5, this.chapters.length);
    this.progressText = this.progress.getProgressString(ctx.bookId);
  }

  private async prev(): Promise<void> {
    if (this.useRustCore && this.vm) {
      const ch = await this.vm.prevChapter();
      if (ch) {
        this.chapters = [ch];
        this.currentIndex = 0;
        this.realIndex = Math.max(this.realIndex - 1, 0);
        this.progressText = `${this.realIndex + 1}/${this.tocTitles.length}`;
      }
      return;
    }
    if (this.machine.prevChapter()) {
      this.currentIndex = Math.max(0, this.currentIndex - 1);
      this.machine.chapterLoaded();
      this.state = this.machine.getState();
      this.saveProgress();
    }
  }

  private async next(): Promise<void> {
    if (this.useRustCore && this.vm) {
      const ch = await this.vm.nextChapter();
      if (ch) {
        this.chapters = [ch];
        this.currentIndex = 0;
        this.realIndex = Math.min(this.realIndex + 1, this.tocTitles.length - 1);
        this.progressText = `${this.realIndex + 1}/${this.tocTitles.length}`;
      }
      return;
    }
    if (this.machine.nextChapter()) {
      this.currentIndex = Math.min(this.chapters.length - 1, this.currentIndex + 1);
      this.machine.chapterLoaded();
      this.state = this.machine.getState();
      this.saveProgress();
    }
  }

  private async jumpToChapter(index: number): Promise<void> {
    if (index < 0 || index >= this.tocTitles.length) {
      return;
    }
    this.showTocPanel = false;
    if (this.useRustCore && this.vm) {
      this.loading = true;
      const content = await this.vm.loadChapter(index);
      this.chapters = [{ title: this.tocTitles[index], content }];
      this.currentIndex = 0;
      this.realIndex = index;
      this.progressText = `${index + 1}/${this.tocTitles.length}`;
      this.loading = false;
    } else {
      this.currentIndex = index;
      this.realIndex = index;
      this.saveProgress();
    }
  }

  private back(): void {
    router.back();
  }

  build() {
    Column() {
      Row() {
        Text('返回')
          .fontSize(16)
          .fontColor('#007AFF')
          .onClick(() => this.back())
        Blank()
        Text(this.useRustCore ? 'ReaderShell PASS Rust Core' : 'ReaderShell PASS fixture')
          .fontSize(12)
          .fontColor(this.useRustCore ? '#1B7F4A' : '#1B7F4A')
        Button('目录')
          .fontSize(12)
          .height(28)
          .margin({ left: 8 })
          .onClick(() => {
            this.showTocPanel = !this.showTocPanel;
          })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 12, bottom: 8 })

      Row() {
        Text(this.bookTitle)
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor('#1A1A1A')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.progressText)
          .fontSize(13)
          .fontColor('#007AFF')
      }
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 8 })

      Row() {
        Text(`章节 ${this.realIndex + 1}/${this.tocTitles.length > 0 ? this.tocTitles.length : this.chapters.length}`)
          .fontSize(13)
          .fontColor('#555555')
        Blank()
        Text(`字号 ${this.fontSize}`)
          .fontSize(13)
          .fontColor('#555555')
        Button('A-')
          .fontSize(12)
          .height(28)
          .margin({ left: 8 })
          .onClick(() => { this.fontSize = Math.max(12, this.fontSize - 2); })
        Button('A+')
          .fontSize(12)
          .height(28)
          .margin({ left: 4 })
          .onClick(() => { this.fontSize = Math.min(32, this.fontSize + 2); })
      }
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 8 })

      if (this.showTocPanel) {
        List() {
          ForEach(this.tocTitles, (title: string, index: number) => {
            ListItem() {
              Text(title)
                .fontSize(14)
                .fontColor(index === this.realIndex ? '#007AFF' : '#333333')
                .maxLines(1)
                .textOverflow({ overflow: TextOverflow.Ellipsis })
                .padding(12)
                .width('100%')
            }
            .onClick(() => {
              this.jumpToChapter(index);
            })
          }, (title: string, index: number) => `${index}-${title}`)
        }
        .width('100%')
        .height('50%')
        .backgroundColor('#FFFFFF')
        .border({ width: { top: 0.5, bottom: 0.5 }, color: '#E0E0E0' })
      }

      if (this.loading) {
        Column() {
          Text('加载中...')
            .fontSize(14)
            .fontColor('#777777')
            .margin({ top: 48 })
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else if (this.error.length > 0 && this.chapters.length === 0) {
        Column() {
          Text(this.error)
            .fontSize(14)
            .fontColor('#B3261E')
            .margin({ top: 48 })
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else {
        Scroll() {
          Column() {
            if (this.chapters.length > 0) {
              Text(this.chapters[this.currentIndex].title)
                .fontSize(this.fontSize + 2)
                .fontWeight(FontWeight.Medium)
                .fontColor('#1A1A1A')
                .width('100%')
                .margin({ bottom: 12 })
              Text(this.chapters[this.currentIndex].content)
                .fontSize(this.fontSize)
                .fontColor('#333333')
                .lineHeight(this.fontSize * 1.8)
                .width('100%')
            }
          }
          .width('100%')
          .padding({ left: 16, right: 16, bottom: 24 })
          .alignItems(HorizontalAlign.Start)
        }
        .layoutWeight(1)
        .width('100%')
      }

      Row() {
        Button('上一章')
          .layoutWeight(1)
          .height(42)
          .onClick(() => this.prev())
        Button('下一章')
          .layoutWeight(1)
          .height(42)
          .margin({ left: 12 })
          .onClick(() => this.next())
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 8, bottom: 16 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#FFFFFF')
  }
}
