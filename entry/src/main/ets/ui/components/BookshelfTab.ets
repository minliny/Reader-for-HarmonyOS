import {
  HomeBookRow,
  HomeReaderPreviewSnapshot,
  readerHomeDashboard
} from '../../services/HomeDashboardService';
import { BookshelfViewModel, BookshelfRow } from '../../viewmodel/BookshelfViewModel';
import { ReaderAdaptive } from '../ReaderAdaptive';
import { ReaderMotion } from '../ReaderMotion';
import { ReaderRoute } from '../ReaderRouteMapping';
import { ReaderEntryTarget, ReaderUiState } from '../ReaderUiState';

@Component
export struct BookshelfTab {
  @Prop uiState: ReaderUiState;
  onReaderEntry: (target: ReaderEntryTarget) => void = (_target: ReaderEntryTarget) => {};

  build() {
    Navigation() {
      BookshelfContent({
        uiState: this.uiState,
        onReaderEntry: this.onReaderEntry
      })
    }
    .title('书架')
    .titleMode(NavigationTitleMode.Mini)
  }
}

@Component
struct BookshelfContent {
  @Prop uiState: ReaderUiState;
  onReaderEntry: (target: ReaderEntryTarget) => void = (_target: ReaderEntryTarget) => {};
  @State rows: HomeBookRow[] = [];
  @State readerPreview: HomeReaderPreviewSnapshot = {
    mode: 'FIXTURE',
    bookTitle: '',
    author: '',
    chapterTitle: '',
    contentPreview: '',
    progressText: '',
    progressPercent: 0,
    tocCount: 0,
    currentChapterIndex: 0,
    nextChapterTitle: ''
  };
  @State totalBooks: number = 0;
  @State activeBooks: number = 0;
  @State unreadBooks: number = 0;
  @State filter: string = 'all';
  @State useRustCore: boolean = false;
  @State rustError: string = '';
  private bookshelfVm: BookshelfViewModel | null = null;

  aboutToAppear() {
    this.reload();
  }

  private async reload(): Promise<void> {
    // Strangler: try Rust Core 'bookshelf.list' first, fallback to fixture.
    try {
      this.bookshelfVm = new BookshelfViewModel();
      const rustRows = await this.bookshelfVm.loadBooks();
      if (rustRows.length > 0) {
        this.rows = this.toHomeBookRows(rustRows);
        this.totalBooks = rustRows.length;
        this.activeBooks = rustRows.filter((r: BookshelfRow) => r.isReading).length;
        this.unreadBooks = this.totalBooks - this.activeBooks;
        this.useRustCore = true;
        this.rustError = '';
        this.readerPreview = readerHomeDashboard.getReaderPreviewSnapshot();
        return;
      }
    } catch (e) {
      this.rustError = `Rust Core 异常: ${e}`;
    }
    // Fallback: legacy fixture
    const snapshot = readerHomeDashboard.getBookshelfSnapshot();
    this.rows = snapshot.rows;
    this.totalBooks = snapshot.totalBooks;
    this.activeBooks = snapshot.activeBooks;
    this.unreadBooks = snapshot.unreadBooks;
    this.useRustCore = false;
    this.readerPreview = readerHomeDashboard.getReaderPreviewSnapshot();
  }

  private toHomeBookRows(rows: BookshelfRow[]): HomeBookRow[] {
    const out: HomeBookRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const row: HomeBookRow = {
        id: r.id,
        title: r.title,
        author: r.author,
        format: r.format,
        progressText: r.progressText,
        progressPercent: 0,
        lastOpenedAt: 0,
        isReading: r.isReading,
        sourceId: r.sourceId
      };
      out.push(row);
    }
    return out;
  }

  private visibleRows(): HomeBookRow[] {
    if (this.filter === 'reading') {
      return this.rows.filter((item: HomeBookRow) => item.isReading);
    }
    if (this.filter === 'unread') {
      return this.rows.filter((item: HomeBookRow) => !item.isReading);
    }
    return this.rows;
  }

  build() {
    Column() {
      Row() {
        StatCell({ label: '藏书', value: this.totalBooks.toString() })
        StatCell({ label: '在读', value: this.activeBooks.toString() })
        StatCell({ label: '未读', value: this.unreadBooks.toString() })
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 16, bottom: 8 })

      Row() {
        FilterChip({ label: '全部', selected: this.filter === 'all' })
          .onClick(() => { this.filter = 'all'; })
        FilterChip({ label: '在读', selected: this.filter === 'reading' })
          .onClick(() => { this.filter = 'reading'; })
        FilterChip({ label: '未读', selected: this.filter === 'unread' })
          .onClick(() => { this.filter = 'unread'; })
      }
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 8 })

      ReaderPreviewPanel({
        item: this.readerPreview,
        onReaderEntry: this.onReaderEntry
      })

      Row() {
        Text('我的书架')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor('#1A1A1A')
        Blank()
        Text(`${this.uiState.adaptive.bookshelfColumns} 列`)
          .fontSize(12)
          .fontColor('#777777')
      }
      .width('100%')
      .padding({ left: 16, right: 16, top: 6, bottom: 10 })

      Grid() {
        ForEach(this.visibleRows(), (item: HomeBookRow) => {
          GridItem() {
            BookCoverTile({
              item,
              onReaderEntry: this.onReaderEntry
            })
          }
        }, (item: HomeBookRow) => item.id)
      }
      .columnsTemplate(ReaderAdaptive.bookshelfGridTemplate(this.uiState.adaptive))
      .columnsGap(12)
      .rowsGap(14)
      .layoutWeight(1)
      .width('100%')
      .padding({ left: 16, right: 16, bottom: 12 })
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F5F5')
  }
}

@Component
struct ReaderPreviewPanel {
  @Prop item: HomeReaderPreviewSnapshot;
  onReaderEntry: (target: ReaderEntryTarget) => void = (_target: ReaderEntryTarget) => {};

  private openPreview(): void {
    const target = new ReaderEntryTarget();
    target.bookId = 'continue-reading';
    target.sourceId = 'home-preview';
    target.bookTitle = this.item.bookTitle;
    target.author = this.item.author;
    target.chapterTitle = this.item.chapterTitle;
    target.progressText = this.item.progressText;
    target.contentPreview = this.item.contentPreview;
    target.sourceRoute = ReaderRoute.bookshelf;
    target.entryKind = 'action';
    this.onReaderEntry(target);
  }

  build() {
    Column() {
      Row() {
        Text('继续阅读')
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#1A1A1A')
        Blank()
        Text('上次读到')
          .fontSize(12)
          .fontColor('#777777')
      }
      .width('100%')

      Row() {
        Text(this.item.bookTitle)
          .fontSize(14)
          .fontColor('#333333')
          .layoutWeight(1)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.item.progressText)
          .fontSize(12)
          .fontColor('#007AFF')
          .margin({ left: 8 })
      }
      .width('100%')
      .margin({ top: 8 })

      Text(`章节 ${this.item.currentChapterIndex + 1}/${this.item.tocCount} ${this.item.chapterTitle}`)
        .fontSize(13)
        .fontColor('#555555')
        .width('100%')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 6 })

      Text(this.item.contentPreview)
        .fontSize(13)
        .fontColor('#444444')
        .width('100%')
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .margin({ top: 6 })

      Row() {
        Text(`TOC ${this.item.tocCount}`)
          .fontSize(12)
          .fontColor('#777777')
        Blank()
        Text(`下一章 ${this.item.nextChapterTitle}`)
          .fontSize(12)
          .fontColor('#777777')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .margin({ top: 8 })
    }
    .width('100%')
    .padding(12)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .margin({ left: 16, right: 16, bottom: 8 })
    .onClick(() => this.openPreview())
  }
}

@Component
struct BookCoverTile {
  @Prop item: HomeBookRow;
  onReaderEntry: (target: ReaderEntryTarget) => void = (_target: ReaderEntryTarget) => {};

  private openBook(): void {
    const target = new ReaderEntryTarget();
    target.bookId = this.item.id;
    target.sourceId = this.item.sourceId ?? '';
    target.bookTitle = this.item.title;
    target.author = this.item.author;
    target.chapterTitle = '';
    target.progressText = this.item.progressText;
    target.contentPreview = '';
    target.sourceRoute = ReaderRoute.bookshelf;
    target.entryKind = 'cover';
    this.onReaderEntry(target);
  }

  build() {
    Column() {
      Column() {
        Text(this.item.format)
          .fontSize(12)
          .fontColor('#FFFFFF')
        Text(this.item.isReading ? '在读' : '未读')
          .fontSize(11)
          .fontColor('#DCEFE8')
          .margin({ top: 6 })
      }
      .width('100%')
      .height(118)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(this.item.isReading ? '#2E7D68' : '#6A6F7A')
      .borderRadius(6)

      Text(this.item.title)
        .fontSize(13)
        .fontWeight(FontWeight.Medium)
        .fontColor('#1A1A1A')
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
        .margin({ top: 8 })

      Text(this.item.progressText)
        .fontSize(11)
        .fontColor(this.item.isReading ? '#007AFF' : '#777777')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
        .margin({ top: 4 })
    }
    .width('100%')
    .padding(8)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .animation({ duration: ReaderMotion.durationTabPress(false), curve: Curve.EaseOut })
    .onClick(() => this.openBook())
  }
}

@Component
struct StatCell {
  @Prop label: string = '';
  @Prop value: string = '';

  build() {
    Column() {
      Text(this.value)
        .fontSize(20)
        .fontWeight(FontWeight.Medium)
        .fontColor('#1A1A1A')
      Text(this.label)
        .fontSize(12)
        .fontColor('#777777')
        .margin({ top: 2 })
    }
    .layoutWeight(1)
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct FilterChip {
  @Prop label: string = '';
  @Prop selected: boolean = false;

  build() {
    Text(this.label)
      .fontSize(14)
      .fontColor(this.selected ? '#FFFFFF' : '#333333')
      .padding({ left: 14, right: 14, top: 7, bottom: 7 })
      .backgroundColor(this.selected ? '#007AFF' : '#FFFFFF')
      .borderRadius(8)
      .margin({ right: 8 })
  }
}

@Component
struct BookRow {
  @Prop item: HomeBookRow;
  onReaderEntry: (target: ReaderEntryTarget) => void = (_target: ReaderEntryTarget) => {};

  private openBook(): void {
    const target = new ReaderEntryTarget();
    target.bookId = this.item.id;
    target.sourceId = this.item.sourceId ?? '';
    target.bookTitle = this.item.title;
    target.author = this.item.author;
    target.chapterTitle = '';
    target.progressText = this.item.progressText;
    target.contentPreview = '';
    target.sourceRoute = ReaderRoute.bookshelf;
    target.entryKind = 'cover';
    this.onReaderEntry(target);
  }

  build() {
    Row() {
      Column() {
        Text(this.item.format)
          .fontSize(12)
          .fontColor('#FFFFFF')
      }
      .width(48)
      .height(56)
      .justifyContent(FlexAlign.Center)
      .alignItems(HorizontalAlign.Center)
      .backgroundColor(this.item.isReading ? '#2E7D68' : '#6A6F7A')
      .borderRadius(8)
      .margin({ right: 12 })

      Column() {
        Text(this.item.title)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor('#1A1A1A')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.item.author)
          .fontSize(13)
          .fontColor('#666666')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .margin({ top: 4 })
      }
      .layoutWeight(1)

      Text(this.item.progressText)
        .fontSize(13)
        .fontColor(this.item.isReading ? '#007AFF' : '#999999')
        .margin({ left: 8 })
    }
    .width('100%')
    .padding(12)
    .backgroundColor('#FFFFFF')
    .borderRadius(8)
    .animation({ duration: ReaderMotion.durationTabPress(false), curve: Curve.EaseOut })
    .onClick(() => this.openBook())
  }
}
