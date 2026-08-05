/**
 * Phone-only empty shelf from Figma `Reference/LiveCapture/M3/bookshelf-empty`
 * (`574:198`). The source is explicitly reference-only, so this file is a
 * constrained development entry for a genuinely empty Core shelf, not a
 * claim that a Phone/Tablet Final Empty state exists.
 */
const PHONE_CONTENT_WIDTH = 350.903;

@Component
export struct BookshelfEmptyPage {
  @Prop isTablet: boolean;
  onImportRequested: () => void = (): void => {};

  aboutToAppear(): void {
    this.getUIContext().getFont().registerFont({
      familyName: 'ReaderInter',
      familySrc: $rawfile('InterVariable.ttf'),
    });
  }

  build() {
    Column() {
      this.topBar();
      Scroll() {
        Column({ space: 9 }) {
          this.sectionHeader();
          this.emptyShelfCard();
        }
        .width(this.contentWidth())
        .padding({ top: 8, bottom: 116 });
      }
      .layoutWeight(1)
      .width('100%')
      .padding({ left: 19, right: 20 })
      .scrollBar(BarState.Off);

      this.navigation();
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F8F4EC');
  }

  @Builder
  private topBar() {
    Row({ space: 18 }) {
      Image($r('app.media.bookshelf_title'))
        .width(56)
        .height(28)
        .objectFit(ImageFit.Contain)
        .layoutWeight(1);

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_search')).width(24).height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22);

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.bookshelf_more')).width(24).height(24);
      }
      .width(44)
      .height(44)
      .borderRadius(22)
      .onClick((): void => this.onImportRequested());
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20, top: 6 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private sectionHeader() {
    Row() {
      Text('我的书架')
        .fontFamily('ReaderInter')
        .fontWeight(700)
        .fontSize(15)
        .lineHeight(18)
        .fontColor('#1F1B17')
        .layoutWeight(1);

      Row({ space: 8 }) {
        this.headerAction('bookshelf_grid');
        this.headerAction('bookshelf_list');
        this.headerAction('bookshelf_filter');
        this.headerAction('bookshelf_search');
        this.headerAction('bookshelf_settings');
      }
      .height(34);
    }
    .width(this.contentWidth())
    .height(38)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private headerAction(asset: string) {
    Stack({ alignContent: Alignment.Center }) {
      if (asset === 'bookshelf_grid') {
        Image($r('app.media.bookshelf_grid')).width(20).height(20);
      } else if (asset === 'bookshelf_list') {
        Image($r('app.media.bookshelf_list')).width(20).height(20);
      } else if (asset === 'bookshelf_filter') {
        Image($r('app.media.bookshelf_filter')).width(20).height(20);
      } else if (asset === 'bookshelf_search') {
        Image($r('app.media.bookshelf_section_search')).width(20).height(20);
      } else {
        Image($r('app.media.bookshelf_settings')).width(20).height(20);
      }
    }
    .width(34)
    .height(34)
    .opacity(0.42)
    .borderRadius(17);
  }

  @Builder
  private emptyShelfCard() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.Center }) {
        Text('')
          .width(72)
          .height(52)
          .backgroundColor('#B8FFFCF8')
          .border({ width: 1, color: '#66B4A697' })
          .borderRadius(6)
          .rotate({ angle: -8 });
      }
      .width(78.536)
      .height(61.514)
      .position({ x: 120.63, y: 55.24 });

      Stack({ alignContent: Alignment.Center }) {
        Text('')
          .width(72)
          .height(52)
          .backgroundColor('#B8FFFCF8')
          .border({ width: 1, color: '#66B4A697' })
          .borderRadius(6)
          .rotate({ angle: 8 });
      }
      .width(78.536)
      .height(61.514)
      .position({ x: 148.63, y: 55.24 });

      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.empty_shelf_library')).width(28).height(28);
      }
      .width(62)
      .height(62)
      .backgroundColor('#1A2379A4')
      .border({ width: 1, color: '#3D2379A4' })
      .borderRadius(12)
      .position({ x: 144.45, y: 42.98 });

      Text('书架还是空的')
        .width(this.contentWidth())
        .fontFamily('ReaderInter')
        .fontWeight(900)
        .fontSize(19)
        .lineHeight(23.75)
        .fontColor('#1F1B17')
        .textAlign(TextAlign.Center)
        .position({ x: 0, y: 133.98 });

      Text('添加网络书籍或导入本地文件后，会在这里显示继续阅读和书架内容。')
        .width(280)
        .fontFamily('ReaderInter')
        .fontWeight(400)
        .fontSize(13)
        .lineHeight(20.15)
        .fontColor('#756F69')
        .textAlign(TextAlign.Center)
        .position({ x: 35.45, y: 171.73 });

      this.emptyAction(
        '#2D4A3E',
        '#00000000',
        'empty_shelf_search',
        '#FFFFFF',
        '搜索书籍',
        '按书名、作者或关键词查找',
        228.01,
        undefined,
      );
      this.emptyAction(
        '#142379A4',
        '#2E2379A4',
        'empty_shelf_import',
        '#1F3528',
        '导入本地书',
        '添加本机文件到书架',
        295,
        (): void => this.onImportRequested(),
      );

      Row({ space: 8 }) {
        this.optionalAction('empty_shelf_discover', '去发现');
        this.optionalAction('empty_shelf_settings', '书架设置');
      }
      .position({ x: 93.42, y: 368.98 });
    }
    .width(this.contentWidth())
    .height(428.09)
    .backgroundColor('#E6FFFCF8')
    .border({ width: 1, color: '#C1C7CD' })
    .borderRadius(8);
  }

  @Builder
  private emptyAction(
    background: string,
    borderColor: string,
    icon: string,
    textColor: string,
    title: string,
    helper: string,
    top: number,
    action: (() => void) | undefined,
  ) {
    Row({ space: 10 }) {
      Stack({ alignContent: Alignment.Center }) {
        if (icon === 'empty_shelf_search') {
          Image($r('app.media.empty_shelf_search')).width(32).height(32);
        } else {
          Image($r('app.media.empty_shelf_import')).width(32).height(32);
        }
      }
      .width(32)
      .height(32);

      Column({ space: 3 }) {
        Text(title)
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(13)
          .lineHeight(15.6)
          .fontColor(textColor);
        Text(helper)
          .fontFamily('ReaderInter')
          .fontWeight(400)
          .fontSize(10)
          .lineHeight(12)
          .fontColor(textColor)
          .opacity(0.72);
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
    }
    .width(313.802)
    .height(57.99)
    .padding({ left: 12.556, right: 12.556, top: 9.556, bottom: 9.556 })
    .backgroundColor(background)
    .border({ width: 1, color: borderColor })
    .borderRadius(8)
    .position({ x: 17.99, y: top })
    .onClick((): void => {
      if (action !== undefined) {
        action();
      }
    });
  }

  @Builder
  private optionalAction(icon: string, text: string) {
    Row({ space: 5 }) {
      if (icon === 'empty_shelf_discover') {
        Image($r('app.media.empty_shelf_discover')).width(14).height(14);
      } else {
        Image($r('app.media.empty_shelf_settings')).width(14).height(14);
      }
      Text(text)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(11)
        .fontColor('#4D463F');
    }
    .height(30)
    .padding({ left: 10, right: 10 })
    .backgroundColor('#E6EEE8DF')
    .borderRadius(999)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private navigation() {
    Row() {
      this.navigationItem('bookshelf_library', '书架', true);
      this.navigationItem('bookshelf_compass', '发现', false);
      this.navigationItem('bookshelf_rss', 'RSS', false);
      this.navigationItem('bookshelf_settings', '设置', false);
    }
    .width(360)
    .height(68)
    .padding(8)
    .backgroundColor('#E6FFFCF8')
    .border({ width: 1, color: '#C1C7CD' })
    .borderRadius(24)
    .margin({ bottom: 16 });
  }

  @Builder
  private navigationItem(asset: string, label: string, active: boolean) {
    Column({ space: 2 }) {
      Stack({ alignContent: Alignment.Center }) {
        if (asset === 'bookshelf_library') {
          Image($r('app.media.bookshelf_library')).width(24).height(24);
        } else if (asset === 'bookshelf_compass') {
          Image($r('app.media.bookshelf_compass')).width(24).height(24);
        } else if (asset === 'bookshelf_rss') {
          Image($r('app.media.bookshelf_rss')).width(24).height(24);
        } else {
          Image($r('app.media.bookshelf_settings')).width(24).height(24);
        }
      }
      .width(30)
      .height(30);
      Text(label)
        .fontFamily('ReaderInter')
        .fontWeight(700)
        .fontSize(11)
        .lineHeight(18)
        .fontColor(active ? '#FFFAF4' : '#756F69');
    }
    .width(86.5)
    .height(54)
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(active ? '#1F3528' : Color.Transparent)
    .borderRadius(24);
  }

  private contentWidth(): number {
    // H-NOTE-1: Figma supplies only the Phone `State/BookshelfEmpty`
    // reference. There is no Tablet empty assembly, so Tablet reuses the
    // Phone-width layout (not a stretched inference) to avoid a blank page.
    return PHONE_CONTENT_WIDTH;
  }
}
