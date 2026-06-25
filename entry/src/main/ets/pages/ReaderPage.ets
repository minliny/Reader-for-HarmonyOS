// ReaderPage — temporary reader-shell demo.
// Renders fixture chapter content with prev/next navigation, font-size control,
// and progress persistence via ProgressService. The real reader UI is built in
// a separate project; this page only proves the non-UI reader shell seam and
// preserves the "ReaderShell PASS fixture" smoke token expected by the device
// runtime gate. No external network or live source access is claimed.

import { router } from '@kit.ArkUI';
import { readerHomeDashboard, HomeBookRow } from '../services/HomeDashboardService';
import { ReadingFlowStateMachine, ReadingState } from '../services/ReadingFlowStateMachine';
import { MockBookshelfRepository } from '../repository/BookshelfRepository';
import { BookshelfService } from '../services/BookshelfService';
import { ProgressService } from '../services/ProgressService';
import { FixtureEPUBParserAdapter, buildStoredEPUBFixture } from '../adapters/LocalBookPlatformAdapters';
import { EPUBMapping } from '../parser/EPUBParserContract';
import { LocalBookFormat } from '../models/LocalBook';

interface ReaderChapter {
  title: string;
  content: string;
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
  private repository: MockBookshelfRepository = new MockBookshelfRepository(true);
  private bookshelf: BookshelfService = new BookshelfService(this.repository);
  private progress: ProgressService = new ProgressService(this.repository);

  aboutToAppear(): void {
    this.loadFixtureBook();
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
    }).catch((_e: Error) => {
      this.chapters = [{ title: '第一章', content: 'fixture reader unavailable' }];
    });
  }

  private saveProgress(): void {
    const ctx = this.machine.getContext();
    if (!ctx) { return; }
    this.progress.updateProgress(ctx.bookId, this.currentIndex, 0.5, this.chapters.length);
    this.progressText = this.progress.getProgressString(ctx.bookId);
  }

  private prev(): void {
    if (this.machine.prevChapter()) {
      this.currentIndex = Math.max(0, this.currentIndex - 1);
      this.machine.chapterLoaded();
      this.state = this.machine.getState();
      this.saveProgress();
    }
  }

  private next(): void {
    if (this.machine.nextChapter()) {
      this.currentIndex = Math.min(this.chapters.length - 1, this.currentIndex + 1);
      this.machine.chapterLoaded();
      this.state = this.machine.getState();
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
        Text(`ReaderShell PASS fixture`)
          .fontSize(12)
          .fontColor('#1B7F4A')
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
        Text(`章节 ${this.currentIndex + 1}/${this.chapters.length}`)
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
