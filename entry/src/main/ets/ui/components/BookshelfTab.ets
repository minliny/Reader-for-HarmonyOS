import { ReaderAdaptive } from '../ReaderAdaptive';
import { ReaderMotion } from '../ReaderMotion';
import { ReaderRoute } from '../ReaderRouteMapping';
import { ReaderEntryTarget, ReaderUiState } from '../ReaderUiState';

class BookshelfDemoBook {
  id: string = '';
  title: string = '';
  author: string = '';
  chapter: string = '';
  progress: string = '';
  coverKey: string = '';
}

class BookshelfDemoFixture {
  static books(): BookshelfDemoBook[] {
    return [
      {
        id: 'longNight',
        title: '长夜余火',
        author: '爱潜水的乌贼',
        chapter: '第 32 章 雨夜',
        progress: '38%',
        coverKey: 'longNight'
      },
      {
        id: 'mysteryLord',
        title: '诡秘之主',
        author: '爱潜水的乌贼',
        chapter: '第 1426 章',
        progress: '58%',
        coverKey: 'mysteryLord'
      },
      {
        id: 'brightMoon',
        title: '明朝那些事儿',
        author: '当年明月',
        chapter: '第 218 章',
        progress: '58%',
        coverKey: 'brightMoon'
      },
      {
        id: 'threeBody',
        title: '三体',
        author: '刘慈欣',
        chapter: '65%',
        progress: '65%',
        coverKey: 'threeBody'
      },
      {
        id: 'renjianCihua',
        title: '人间词话',
        author: '王国维',
        chapter: '卷上 · 境界',
        progress: '24%',
        coverKey: 'renjian'
      },
      {
        id: 'androidNotes',
        title: 'Android 开发笔记',
        author: '本地文档',
        chapter: 'Compose Shell 结构',
        progress: '12%',
        coverKey: 'androidNotes'
      },
      {
        id: 'oldEcho',
        title: '旧日回响',
        author: '离线书库',
        chapter: '第 18 章',
        progress: '41%',
        coverKey: 'longNight'
      },
      {
        id: 'betweenStars',
        title: '群星之间',
        author: '本地导入',
        chapter: '第 7 章',
        progress: '16%',
        coverKey: 'threeBody'
      },
      {
        id: 'lighthouseFog',
        title: '灯塔与雾',
        author: '书源同步',
        chapter: '第 51 章',
        progress: '73%',
        coverKey: 'brightMoon'
      },
      {
        id: 'paperCity',
        title: '纸上城市',
        author: '默认分组',
        chapter: '第 12 章',
        progress: '33%',
        coverKey: 'mysteryLord'
      },
      {
        id: 'longTitleSample',
        title: '长标题测试：这本书的名字很长需要两行截断',
        author: '排版样本',
        chapter: '很长的章节名称需要保持单行省略',
        progress: '8%',
        coverKey: 'renjian'
      }
    ];
  }
}

@Component
export struct BookshelfTab {
  @Prop uiState: ReaderUiState;
  onReaderEntry: (target: ReaderEntryTarget) => void = (_target: ReaderEntryTarget) => {};

  build() {
    BookshelfContent({
      uiState: this.uiState,
      onReaderEntry: this.onReaderEntry
    })
  }
}

@Component
struct BookshelfContent {
  @Prop uiState: ReaderUiState;
  onReaderEntry: (target: ReaderEntryTarget) => void = (_target: ReaderEntryTarget) => {};
  private books: BookshelfDemoBook[] = BookshelfDemoFixture.books();

  private openBook(book: BookshelfDemoBook, entryKind: string): void {
    const target = new ReaderEntryTarget();
    target.bookId = book.id;
    target.sourceId = 'demo-bookshelf';
    target.bookTitle = book.title;
    target.author = book.author;
    target.chapterTitle = book.chapter;
    target.progressText = book.progress;
    target.pageLabel = book.chapter;
    target.totalChapters = 128;
    target.contentPreview = '雨声在窗外连成一片，旧世界的线索在夜里慢慢浮出。';
    target.sourceRoute = ReaderRoute.bookshelf;
    target.entryKind = entryKind;
    this.onReaderEntry(target);
  }

  build() {
    Column() {
      BookshelfTopBar()

      Scroll() {
        Column() {
          ContinueReadingCard({
            book: this.books[0],
            onOpenCover: (book: BookshelfDemoBook) => this.openBook(book, 'cover'),
            onOpenAction: (book: BookshelfDemoBook) => this.openBook(book, 'action')
          })

          BookshelfShelfSection({
            books: this.books,
            columnsTemplate: this.columnsTemplate(),
            columnsGap: this.columnsGap(),
            coverHeight: this.coverHeight(),
            onOpenBook: (book: BookshelfDemoBook) => this.openBook(book, 'cover'),
            reducedMotion: this.uiState.reducedMotion
          })
        }
        .width('100%')
        .padding({
          left: this.contentSidePadding(),
          right: this.contentSidePadding(),
          top: 8,
          bottom: ReaderAdaptive.isNavRail(this.uiState.adaptive) ? 24 : 122
        })
      }
      .width('100%')
      .layoutWeight(1)
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F4EFE8')
  }

  private contentSidePadding(): number {
    if (this.uiState.adaptive.widthVp >= 840) {
      return 24;
    }
    return 15;
  }

  private columnsTemplate(): string {
    if (this.gridColumns() === 2) {
      return '1fr 1fr';
    }
    if (this.gridColumns() === 3) {
      return '1fr 1fr 1fr';
    }
    return ReaderAdaptive.bookshelfGridTemplate(this.uiState.adaptive);
  }

  private gridColumns(): number {
    if (this.uiState.adaptive.widthVp < 360) {
      return 2;
    }
    if (this.uiState.adaptive.widthVp < 600) {
      return 3;
    }
    return this.uiState.adaptive.bookshelfColumns;
  }

  private columnsGap(): number {
    if (this.uiState.adaptive.widthVp < 600) {
      return 30;
    }
    return 24;
  }

  private coverHeight(): number {
    const columns = this.gridColumns();
    const contentWidth = Math.max(240, this.uiState.adaptive.widthVp - this.contentSidePadding() * 2);
    const columnWidth = Math.max(76, (contentWidth - this.columnsGap() * (columns - 1)) / columns);
    return Math.round(columnWidth * 1.5);
  }
}

@Component
struct BookshelfTopBar {
  build() {
    Row() {
      Text('书架')
        .fontSize(29)
        .fontWeight(FontWeight.Medium)
        .fontFamily('Songti SC')
        .fontColor('#201B16')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)

      Row() {
        BookshelfTopActionButton({
          iconName: 'bookshelf_icon_search_dark',
          accessibilityLabel: '搜索'
        })
        BookshelfTopActionButton({
          iconName: 'reader_icon_more_dark',
          accessibilityLabel: '更多'
        })
      }
      .justifyContent(FlexAlign.End)
    }
    .width('100%')
    .height(62)
    .padding({ left: 20, right: 20, top: 6 })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct BookshelfTopActionButton {
  @Prop iconName: string = '';
  @Prop accessibilityLabel: string = '';

  build() {
    Row() {
      BookshelfIcon({ iconName: this.iconName, iconSize: 24 })
    }
    .width(44)
    .height(44)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .margin({ left: 18 })
    .borderRadius(22)
    .accessibilityText(this.accessibilityLabel)
  }
}

@Component
struct ContinueReadingCard {
  @Prop book: BookshelfDemoBook;
  onOpenCover: (book: BookshelfDemoBook) => void = (_book: BookshelfDemoBook) => {};
  onOpenAction: (book: BookshelfDemoBook) => void = (_book: BookshelfDemoBook) => {};

  build() {
    Row() {
      BookshelfCover({
        coverKey: this.book.coverKey,
        widthValue: 62,
        heightValue: 93,
        radius: 6
      })
        .onClick(() => this.onOpenCover(this.book))

      Column() {
        Text('继续阅读')
          .fontSize(13)
          .fontWeight(FontWeight.Bolder)
          .fontColor('#2F6373')
          .maxLines(1)
          .width('100%')

        Text(this.book.title)
          .fontSize(20)
          .fontWeight(FontWeight.Medium)
          .fontFamily('Songti SC')
          .fontColor('#201B16')
          .lineHeight(24)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
          .margin({ top: 6 })

        Text(this.book.author)
          .fontSize(14)
          .fontColor('#7F756A')
          .lineHeight(17)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
          .margin({ top: 5 })
      }
      .layoutWeight(1)
      .margin({ left: 14, right: 14 })

      Text('阅读')
        .width(74)
        .height(40)
        .fontSize(13)
        .fontWeight(FontWeight.Bolder)
        .fontColor('#FFFFFF')
        .textAlign(TextAlign.Center)
        .backgroundColor('#2F6373')
        .borderRadius(20)
        .onClick(() => this.onOpenAction(this.book))
    }
    .width('100%')
    .height(100)
    .padding({ left: 16, right: 16, top: 3, bottom: 3 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#FFFCF7')
    .border({ width: 1, color: '#D8CCBC' })
    .borderRadius(12)
    .shadow({ radius: 14, color: '#34261A1F', offsetX: 0, offsetY: 5 })
  }
}

@Component
struct BookshelfShelfSection {
  @Prop books: BookshelfDemoBook[];
  @Prop columnsTemplate: string = '1fr 1fr 1fr';
  @Prop columnsGap: number = 30;
  @Prop coverHeight: number = 150;
  @Prop reducedMotion: boolean = false;
  onOpenBook: (book: BookshelfDemoBook) => void = (_book: BookshelfDemoBook) => {};

  build() {
    Column() {
      BookshelfSectionHeader()

      Grid() {
        ForEach(this.books, (book: BookshelfDemoBook) => {
          GridItem() {
            BookshelfBookCard({
              book,
              coverHeight: this.coverHeight,
              reducedMotion: this.reducedMotion,
              onOpenBook: this.onOpenBook
            })
          }
        }, (book: BookshelfDemoBook) => book.id)
      }
      .columnsTemplate(this.columnsTemplate)
      .columnsGap(this.columnsGap)
      .rowsGap(16)
      .width('100%')
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .margin({ top: 8 })
  }
}

@Component
struct BookshelfSectionHeader {
  build() {
    Row() {
      Text('我的书架')
        .fontSize(15)
        .fontWeight(FontWeight.Bold)
        .fontColor('#201B16')

      Blank()

      Row() {
        BookshelfShelfActionButton({
          iconName: 'bookshelf_icon_grid_primary',
          accessibilityLabel: '封面视图',
          active: true
        })
        BookshelfShelfActionButton({
          iconName: 'bookshelf_icon_list_dark',
          accessibilityLabel: '列表视图'
        })
        BookshelfShelfActionButton({
          iconName: 'bookshelf_icon_filter_dark',
          accessibilityLabel: '书架筛选：全部，最近更新，全部'
        })
        BookshelfShelfActionButton({
          iconName: 'bookshelf_icon_gear_dark',
          accessibilityLabel: '书架显示设置'
        })
      }
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .height(38)
    .alignItems(VerticalAlign.Center)
    .margin({ bottom: 10 })
  }
}

@Component
struct BookshelfShelfActionButton {
  @Prop iconName: string = '';
  @Prop accessibilityLabel: string = '';
  @Prop active: boolean = false;

  build() {
    Row() {
      BookshelfIcon({ iconName: this.iconName, iconSize: 20 })
    }
    .width(34)
    .height(34)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .borderRadius(17)
    .margin({ left: 8 })
    .backgroundColor(this.active ? '#E8F0EE' : '#00000000')
    .accessibilityText(this.accessibilityLabel)
  }
}

@Component
struct BookshelfBookCard {
  @Prop book: BookshelfDemoBook;
  @Prop coverHeight: number = 150;
  @Prop reducedMotion: boolean = false;
  onOpenBook: (book: BookshelfDemoBook) => void = (_book: BookshelfDemoBook) => {};

  build() {
    Column() {
      BookshelfCover({
        coverKey: this.book.coverKey,
        widthValue: '100%',
        heightValue: this.coverHeight,
        radius: 10
      })
        .onClick(() => this.onOpenBook(this.book))

      Text(this.book.title)
        .fontSize(15)
        .fontFamily('Songti SC')
        .fontWeight(FontWeight.Medium)
        .fontColor('#201B16')
        .lineHeight(18)
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
        .margin({ top: 6 })

      Text(this.book.author)
        .fontSize(12)
        .fontColor('#7F756A')
        .lineHeight(15)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .animation({ duration: ReaderMotion.durationTabPress(this.reducedMotion), curve: Curve.EaseOut })
  }
}

@Component
struct BookshelfCover {
  @Prop coverKey: string = '';
  @Prop widthValue: Length = 62;
  @Prop heightValue: Length = 93;
  @Prop radius: number = 8;

  build() {
    Stack() {
      if (this.coverKey === 'mysteryLord') {
        Image($r('app.media.bookshelf_cover_mystery_lord'))
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
      } else if (this.coverKey === 'brightMoon') {
        Image($r('app.media.bookshelf_cover_bright_moon'))
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
      } else if (this.coverKey === 'threeBody') {
        Image($r('app.media.bookshelf_cover_three_body'))
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
      } else if (this.coverKey === 'renjian') {
        Image($r('app.media.bookshelf_cover_renjian_cihua'))
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
      } else if (this.coverKey === 'androidNotes') {
        Image($r('app.media.bookshelf_cover_android_notes'))
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
      } else {
        Image($r('app.media.bookshelf_cover_long_night'))
          .width('100%')
          .height('100%')
          .objectFit(ImageFit.Cover)
      }
    }
    .width(this.widthValue)
    .height(this.heightValue)
    .borderRadius(this.radius)
    .clip(true)
    .backgroundColor('#FFFCF7')
    .shadow({ radius: 14, color: '#34261A24', offsetX: 0, offsetY: 5 })
  }
}

@Component
struct BookshelfIcon {
  @Prop iconName: string = '';
  @Prop iconSize: number = 24;

  build() {
    if (this.iconName === 'reader_icon_more_dark') {
      Image($r('app.media.reader_icon_more_dark'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.iconName === 'bookshelf_icon_list_dark') {
      Image($r('app.media.bookshelf_icon_list_dark'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.iconName === 'bookshelf_icon_filter_dark') {
      Image($r('app.media.bookshelf_icon_filter_dark'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.iconName === 'bookshelf_icon_gear_dark') {
      Image($r('app.media.bookshelf_icon_gear_dark'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.iconName === 'bookshelf_icon_grid_primary') {
      Image($r('app.media.bookshelf_icon_grid_primary'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else {
      Image($r('app.media.bookshelf_icon_search_dark'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    }
  }
}
