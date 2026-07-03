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

class BookshelfBookWithIndex {
  book: BookshelfDemoBook = new BookshelfDemoBook();
  index: number = 0;
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
  onToggleMore: () => void = () => {};
  onCloseMore: () => void = () => {};
  onSetView: (view: string) => void = (_view: string) => {};
  onToggleFilter: () => void = () => {};
  onSelectFilterOption: (kind: string, value: string) => void = (_kind: string, _value: string) => {};

  build() {
    BookshelfContent({
      uiState: this.uiState,
      onReaderEntry: this.onReaderEntry,
      onToggleMore: this.onToggleMore,
      onCloseMore: this.onCloseMore,
      onSetView: this.onSetView,
      onToggleFilter: this.onToggleFilter,
      onSelectFilterOption: this.onSelectFilterOption
    })
  }
}

@Component
struct BookshelfContent {
  @Prop uiState: ReaderUiState;
  onReaderEntry: (target: ReaderEntryTarget) => void = (_target: ReaderEntryTarget) => {};
  onToggleMore: () => void = () => {};
  onCloseMore: () => void = () => {};
  onSetView: (view: string) => void = (_view: string) => {};
  onToggleFilter: () => void = () => {};
  onSelectFilterOption: (kind: string, value: string) => void = (_kind: string, _value: string) => {};
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
    Stack() {
      Column() {
        BookshelfTopBar({
          onToggleMore: this.onToggleMore
        })

        Scroll() {
          Column() {
            ContinueReadingCard({
              book: this.books[0],
              onOpenCover: (book: BookshelfDemoBook) => this.openBook(book, 'cover'),
              onOpenAction: (book: BookshelfDemoBook) => this.openBook(book, 'action')
            })

            BookshelfShelfSection({
              books: this.visibleBooks(),
              uiState: this.uiState,
              isListView: this.uiState.bookshelfView === 'list',
              columnsTemplate: this.columnsTemplate(),
              columnsGap: this.columnsGap(),
              coverHeight: this.coverHeight(),
              onOpenBook: (book: BookshelfDemoBook) => this.openBook(book, 'cover'),
              reducedMotion: this.uiState.reducedMotion,
              onSetView: this.onSetView,
              onToggleFilter: this.onToggleFilter,
              onSelectFilterOption: this.onSelectFilterOption
            })
          }
          .width('100%')
          .padding({
            left: this.contentSidePadding(),
            right: this.contentSidePadding(),
            top: 8,
            bottom: ReaderAdaptive.isNavRail(this.uiState.adaptive) ? 24 : 116
          })
        }
        .width('100%')
        .layoutWeight(1)
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None)
      }
      .width('100%')
      .height('100%')
      .backgroundColor('#FFF8F4')

      if (this.uiState.overlayState.isOpen && this.uiState.overlayState.kind === 'bookshelf-more') {
        BookshelfMoreLayer({
          onClose: this.onCloseMore,
          reducedMotion: this.uiState.reducedMotion
        })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#FFF8F4')
  }

  private contentSidePadding(): number {
    if (this.uiState.adaptive.widthVp >= 840) {
      return 24;
    }
    return 19;
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

  private visibleBooks(): BookshelfDemoBook[] {
    const normalized: BookshelfBookWithIndex[] = [];
    for (let index = 0; index < this.books.length; index++) {
      const book = this.books[index];
      if (this.matchesGroup(book, index) && this.matchesFilter(book)) {
        const item = new BookshelfBookWithIndex();
        item.book = book;
        item.index = index;
        normalized.push(item);
      }
    }

    if (this.uiState.bookshelfSort === '阅读进度') {
      normalized.sort((left: BookshelfBookWithIndex, right: BookshelfBookWithIndex): number => {
        const progressDiff = this.bookProgressValue(right.book) - this.bookProgressValue(left.book);
        return progressDiff !== 0 ? progressDiff : left.index - right.index;
      });
    } else if (this.uiState.bookshelfSort === '书名') {
      normalized.sort((left: BookshelfBookWithIndex, right: BookshelfBookWithIndex): number => {
        const textDiff = this.compareText(left.book.title, right.book.title);
        return textDiff !== 0 ? textDiff : left.index - right.index;
      });
    } else if (this.uiState.bookshelfSort === '作者') {
      normalized.sort((left: BookshelfBookWithIndex, right: BookshelfBookWithIndex): number => {
        const textDiff = this.compareText(left.book.author, right.book.author);
        return textDiff !== 0 ? textDiff : left.index - right.index;
      });
    }

    return normalized.map((item: BookshelfBookWithIndex): BookshelfDemoBook => item.book);
  }

  private matchesGroup(book: BookshelfDemoBook, index: number): boolean {
    if (this.uiState.bookshelfGroup === '全部') {
      return true;
    }
    return this.bookGroup(book, index) === this.uiState.bookshelfGroup;
  }

  private bookGroup(book: BookshelfDemoBook, index: number): string {
    if (book.author.indexOf('本地') >= 0 ||
      book.author.indexOf('离线') >= 0 ||
      book.author.indexOf('导入') >= 0 ||
      book.author.indexOf('文档') >= 0) {
      return '本地书';
    }
    if (index < 4 ||
      book.author.indexOf('书源') >= 0 ||
      book.author.indexOf('同步') >= 0 ||
      book.title.indexOf('灯塔与雾') >= 0) {
      return '追更';
    }
    return '默认';
  }

  private matchesFilter(book: BookshelfDemoBook): boolean {
    if (this.uiState.bookshelfFilter === '未读') {
      return this.bookProgressValue(book) < 20;
    }
    if (this.uiState.bookshelfFilter === '已完结') {
      return book.title.indexOf('三体') >= 0 || book.title.indexOf('人间词话') >= 0;
    }
    if (this.uiState.bookshelfFilter === '更新失败') {
      return book.title.indexOf('长标题测试') >= 0 ||
        book.title.indexOf('灯塔与雾') >= 0 ||
        book.author.indexOf('书源同步') >= 0;
    }
    return true;
  }

  private bookProgressValue(book: BookshelfDemoBook): number {
    const normalized = book.progress.replace('%', '');
    const value = Number(normalized);
    return value >= 0 ? value : 0;
  }

  private compareText(left: string, right: string): number {
    if (left === right) {
      return 0;
    }
    return left > right ? 1 : -1;
  }
}

@Component
struct BookshelfTopBar {
  onToggleMore: () => void = () => {};

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
          accessibilityLabel: '更多',
          onPress: this.onToggleMore
        })
      }
      .justifyContent(FlexAlign.End)
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20, top: 6 })
    .margin({ top: 9 })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct BookshelfTopActionButton {
  @Prop iconName: string = '';
  @Prop accessibilityLabel: string = '';
  onPress: () => void = () => {};

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
    .onClick(() => this.onPress())
  }
}

@Component
struct BookshelfMoreLayer {
  @Prop reducedMotion: boolean = false;
  onClose: () => void = () => {};

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Column()
        .width('100%')
        .height('100%')
        .backgroundColor('#1F1B172E')
        .hitTestBehavior(HitTestMode.Block)
        .onClick(() => this.onClose())
        .accessibilityText('关闭书架更多操作')

      Column() {
        Text('书架更多操作')
          .fontSize(15)
          .lineHeight(18)
          .fontWeight(FontWeight.Bold)
          .fontColor('#201B16')
          .width('100%')
          .margin({ bottom: 2 })

        BookshelfMoreMenuItem({
          iconName: 'ui_icon_check_dark',
          title: '批量管理',
          detail: '选择多本书后移动或删除'
        })
        BookshelfMoreMenuItem({
          iconName: 'bookshelf_icon_people_dark',
          title: '分组管理',
          detail: '编辑书架分组与归属'
        })
        BookshelfMoreMenuItem({
          iconName: 'bookshelf_icon_book_open_dark',
          title: '本地书导入',
          detail: '导入本地文件到书架'
        })
      }
      .width(238)
      .padding({ left: 12, right: 12, top: 12, bottom: 12 })
      .margin({ top: 89, right: 18 })
      .backgroundColor('#FFFCF8')
      .border({ width: 1, color: '#D8CCBC' })
      .borderRadius(14)
      .shadow({ radius: 22, color: '#1F1B172E', offsetX: 0, offsetY: 10 })
      .hitTestBehavior(HitTestMode.Block)
      .accessibilityText('书架更多操作')
    }
    .width('100%')
    .height('100%')
    .zIndex(30)
    .animation({ duration: ReaderMotion.durationOverlay(this.reducedMotion), curve: Curve.EaseOut })
  }
}

@Component
struct BookshelfMoreMenuItem {
  @Prop iconName: string = '';
  @Prop title: string = '';
  @Prop detail: string = '';

  build() {
    Row() {
      BookshelfIcon({ iconName: this.iconName, iconSize: 24 })
        .width(24)
        .height(24)
        .margin({ right: 10 })

      Column() {
        Text(this.title)
          .fontSize(13)
          .lineHeight(16.25)
          .fontWeight(FontWeight.Bold)
          .fontColor('#3C352F')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')

        Text(this.detail)
          .fontSize(11)
          .lineHeight(13.2)
          .fontColor('#7F756A')
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
          .margin({ top: 2 })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height(48)
    .padding({ left: 8, right: 8 })
    .alignItems(VerticalAlign.Center)
    .borderRadius(8)
    .margin({ top: 8 })
    .accessibilityText(`${this.title} ${this.detail}`)
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
        .width(82)
        .height(40)
        .fontSize(13)
        .fontWeight(FontWeight.Bolder)
        .fontColor('#FFFFFF')
        .textAlign(TextAlign.Center)
        .backgroundColor('#366179')
        .borderRadius(20)
        .onClick(() => this.onOpenAction(this.book))
    }
    .width('100%')
    .height(100)
    .padding({ left: 16, right: 16, top: 3, bottom: 3 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor('#E6FFFCF8')
    .border({ width: 1, color: '#C1C7CD' })
    .borderRadius(8)
    .shadow({ radius: 26, color: '#1A594632', offsetX: 0, offsetY: 8 })
  }
}

@Component
struct BookshelfShelfSection {
  @Prop books: BookshelfDemoBook[];
  @Prop uiState: ReaderUiState;
  @Prop isListView: boolean = false;
  @Prop columnsTemplate: string = '1fr 1fr 1fr';
  @Prop columnsGap: number = 30;
  @Prop coverHeight: number = 150;
  @Prop reducedMotion: boolean = false;
  onOpenBook: (book: BookshelfDemoBook) => void = (_book: BookshelfDemoBook) => {};
  onSetView: (view: string) => void = (_view: string) => {};
  onToggleFilter: () => void = () => {};
  onSelectFilterOption: (kind: string, value: string) => void = (_kind: string, _value: string) => {};

  private stableSectionMinHeight(): number {
    if (ReaderAdaptive.isNavRail(this.uiState.adaptive)) {
      return 520;
    }
    return 560;
  }

  build() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Column() {
        BookshelfSectionHeader({
          uiState: this.uiState,
          onSetView: this.onSetView,
          onToggleFilter: this.onToggleFilter
        })

        if (this.isListView) {
          Column() {
            ForEach(this.books, (book: BookshelfDemoBook) => {
              BookshelfBookListRow({
                book,
                onOpenBook: this.onOpenBook,
                reducedMotion: this.reducedMotion
              })
            }, (book: BookshelfDemoBook) => book.id)
          }
          .width('100%')
        } else {
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
      }
      .width('100%')

      if (this.uiState.bookshelfFilterOpen) {
        BookshelfFilterPopover({
          uiState: this.uiState,
          onSelectFilterOption: this.onSelectFilterOption
        })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: this.stableSectionMinHeight() })
    .margin({ top: 8 })
  }
}

@Component
struct BookshelfSectionHeader {
  @Prop uiState: ReaderUiState;
  onSetView: (view: string) => void = (_view: string) => {};
  onToggleFilter: () => void = () => {};

  private filterActive(): boolean {
    return this.uiState.bookshelfFilterOpen ||
      this.uiState.bookshelfGroup !== '全部' ||
      this.uiState.bookshelfSort !== '最近更新' ||
      this.uiState.bookshelfFilter !== '全部';
  }

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
          active: this.uiState.bookshelfView !== 'list',
          onPress: () => this.onSetView('cover')
        })
        BookshelfShelfActionButton({
          iconName: 'bookshelf_icon_list_dark',
          accessibilityLabel: '列表视图',
          active: this.uiState.bookshelfView === 'list',
          onPress: () => this.onSetView('list')
        })
        BookshelfShelfActionButton({
          iconName: 'bookshelf_icon_filter_dark',
          accessibilityLabel: `书架筛选：${this.uiState.bookshelfGroup}，${this.uiState.bookshelfSort}，${this.uiState.bookshelfFilter}`,
          active: this.filterActive(),
          onPress: this.onToggleFilter
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
  onPress: () => void = () => {};

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
    .backgroundColor('#00000000')
    .accessibilityText(this.accessibilityLabel)
    .onClick(() => this.onPress())
  }
}

@Component
struct BookshelfFilterPopover {
  @Prop uiState: ReaderUiState;
  onSelectFilterOption: (kind: string, value: string) => void = (_kind: string, _value: string) => {};

  build() {
    Column() {
      BookshelfFilterGroup({
        title: '分组',
        kind: 'group',
        currentValue: this.uiState.bookshelfGroup,
        optionA: '全部',
        optionB: '默认',
        optionC: '本地书',
        optionD: '追更',
        onSelectFilterOption: this.onSelectFilterOption
      })
      BookshelfFilterGroup({
        title: '排序',
        kind: 'sort',
        currentValue: this.uiState.bookshelfSort,
        optionA: '最近更新',
        optionB: '阅读进度',
        optionC: '书名',
        optionD: '作者',
        onSelectFilterOption: this.onSelectFilterOption
      })
      BookshelfFilterGroup({
        title: '筛选',
        kind: 'filter',
        currentValue: this.uiState.bookshelfFilter,
        optionA: '全部',
        optionB: '未读',
        optionC: '已完结',
        optionD: '更新失败',
        onSelectFilterOption: this.onSelectFilterOption
      })
    }
    .width(286)
    .padding({ left: 10, right: 10, top: 10, bottom: 10 })
    .margin({ top: 42 })
    .backgroundColor('#FAFFFCF8')
    .border({ width: 1, color: '#70B4A697' })
    .borderRadius(14)
    .shadow({ radius: 30, color: '#295242301F', offsetX: 0, offsetY: 14 })
    .zIndex(18)
    .accessibilityText('书架排序与筛选选项')
  }
}

@Component
struct BookshelfFilterGroup {
  @Prop title: string = '';
  @Prop kind: string = '';
  @Prop currentValue: string = '';
  @Prop optionA: string = '';
  @Prop optionB: string = '';
  @Prop optionC: string = '';
  @Prop optionD: string = '';
  onSelectFilterOption: (kind: string, value: string) => void = (_kind: string, _value: string) => {};

  build() {
    Column() {
      Text(this.title)
        .fontSize(11)
        .lineHeight(12.1)
        .fontWeight(FontWeight.Bolder)
        .fontColor('#7F756A')
        .width('100%')

      Flex({ wrap: FlexWrap.Wrap }) {
        BookshelfFilterChip({
          label: this.optionA,
          active: this.currentValue === this.optionA,
          onPress: () => this.onSelectFilterOption(this.kind, this.optionA)
        })
        BookshelfFilterChip({
          label: this.optionB,
          active: this.currentValue === this.optionB,
          onPress: () => this.onSelectFilterOption(this.kind, this.optionB)
        })
        BookshelfFilterChip({
          label: this.optionC,
          active: this.currentValue === this.optionC,
          onPress: () => this.onSelectFilterOption(this.kind, this.optionC)
        })
        BookshelfFilterChip({
          label: this.optionD,
          active: this.currentValue === this.optionD,
          onPress: () => this.onSelectFilterOption(this.kind, this.optionD)
        })
      }
      .width('100%')
      .margin({ top: 7 })
    }
    .width('100%')
    .margin({ bottom: 10 })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct BookshelfFilterChip {
  @Prop label: string = '';
  @Prop active: boolean = false;
  onPress: () => void = () => {};

  build() {
    Row() {
      Text(this.label)
        .fontSize(11)
        .fontWeight(FontWeight.Bolder)
        .fontColor(this.active ? '#FFFFFF' : '#3F372F')
        .textAlign(TextAlign.Center)
        .maxLines(1)
    }
      .height(30)
      .constraintSize({ minWidth: 52 })
      .padding({ left: 10, right: 10 })
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(this.active ? '#2F6373' : '#B8EEE8DF')
      .border({ width: 1, color: this.active ? '#2F6373' : '#6BB4A697' })
      .borderRadius(15)
      .margin({ right: 6, bottom: 6 })
      .accessibilityText(`${this.label}${this.active ? '，当前选中' : ''}`)
      .onClick(() => this.onPress())
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
        radius: 8
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
struct BookshelfBookListRow {
  @Prop book: BookshelfDemoBook;
  @Prop reducedMotion: boolean = false;
  onOpenBook: (book: BookshelfDemoBook) => void = (_book: BookshelfDemoBook) => {};

  build() {
    Row() {
      BookshelfCover({
        coverKey: this.book.coverKey,
        widthValue: 48,
        heightValue: 72,
        radius: 6
      })
        .margin({ right: 10 })

      Column() {
        Text(this.book.title)
          .fontSize(15)
          .fontFamily('Songti SC')
          .fontWeight(FontWeight.Medium)
          .fontColor('#201B16')
          .lineHeight(18.3)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')

        Text(this.book.author)
          .fontSize(12)
          .fontColor('#7F756A')
          .lineHeight(15)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .width('100%')
          .margin({ top: 2 })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height(72)
    .alignItems(VerticalAlign.Center)
    .margin({ bottom: 10 })
    .accessibilityText(`打开 ${this.book.title}`)
    .onClick(() => this.onOpenBook(this.book))
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
    .backgroundColor('#E6FFFCF8')
    .shadow({ radius: 26, color: '#1A594632', offsetX: 0, offsetY: 8 })
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
    } else if (this.iconName === 'ui_icon_check_dark') {
      Image($r('app.media.ui_icon_check_dark'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.iconName === 'bookshelf_icon_people_dark') {
      Image($r('app.media.bookshelf_icon_people_dark'))
        .width(this.iconSize)
        .height(this.iconSize)
        .objectFit(ImageFit.Contain)
    } else if (this.iconName === 'bookshelf_icon_book_open_dark') {
      Image($r('app.media.bookshelf_icon_book_open_dark'))
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
