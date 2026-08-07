// Discover main page — rebuilt 2026-08-06 against live Figma node 376:2
// (Reference/Discover/Phone · 390×844).
// Data honesty: source.explore results do not exist in the app yet, so the
// source card carries a neutral 书源 label and the result list renders an
// empty state. No book rows are fabricated.
// Icons: existing media only (no new SVG assets).

import { MainTabBar } from '../shell/MainTabBar';
import { ReaderIconButton } from '../common/ReaderIconButton';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_CARD_BG,
  TOK_CARD_BG_HI,
  TOK_GREEN,
  TOK_INK,
  TOK_LINE_STRONG,
  TOK_MUTED,
  TOK_PAPER,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_ROW_BLOCK,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';
import {
  type DiscoverBook,
  type DiscoverKind,
} from './DiscoverGateway';

const PHONE_CONTENT_WIDTH = 350.903;
const TABLET_CONTENT_WIDTH = 722;
const CURRENT_SOURCE_BG = TOK_CARD_BG_HI;   // rgba(255,252,248,0.92)
const CURRENT_SOURCE_BORDER = '#5CB4A697'; // rgba(180,166,151,0.36)
const ICON_BOX_BG = '#1A2D4A3E';         // rgba(45,74,62,0.10)
const CHIP_BG = '#D1EEE8DF';             // rgba(238,232,223,0.82)
const CARD_BG = TOK_CARD_BG;             // rgba(255,252,248,0.9)
const FILTER_BORDER = '#7AB4A697';       // rgba(180,166,151,0.48)
const APPLY_BORDER = '#C72D5D76';        // rgba(45,93,118,0.78)
const RESULT_BORDER = TOK_LINE_STRONG;       // rgba(180,166,151,0.34)
const TEXT_DARK = TOK_INK;
const TEXT_MUTED = TOK_MUTED;

export interface DiscoverPresentation {
  currentSourceName: string;
  kinds: DiscoverKind[];
  books: DiscoverBook[];
}

@Component
export struct DiscoverPage {
  @Prop presentation: DiscoverPresentation = {
    currentSourceName: '',
    kinds: [],
    books: [],
  };
  @Prop isTablet: boolean;
  onBack: () => void = (): void => {};
  onRssRequested: () => void = (): void => {};
  onSettingsRequested: () => void = (): void => {};

  @State private activeCategory: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      this.homeTopBar();
      this.discoverContent();
      MainTabBar({ current: 'discover', onSelect: (key: string): void => this.onMainTab(key) });
    }
    .width('100%')
    .height('100%')
    .backgroundColor(TOK_PAPER);
  }

  @Builder
  private homeTopBar() {
    Row() {
      Text('发现')
        .layoutWeight(1)
        .height(38)
        .fontFamily('ReaderNotoSerifSCBold')
        .fontWeight(FontWeight.Bold)
        .fontSize(29)
        .lineHeight(38)
        .fontColor(TEXT_DARK)
        .maxLines(1);

      ReaderIconButton({
        icon: $r('app.media.rss_refresh'),
        boxSize: 44,
        iconSize: 24,
        radius: 22,
        onTap: (): void => {
          // Refresh is inert until the discovery pipeline is wired.
        },
      });
    }
    .width('100%')
    .height(58)
    .padding({ left: 20, right: 20, top: 6 })
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private discoverContent() {
    Scroll() {
      Column({ space: 7 }) {
        this.currentSourceCard();
        this.categoryChips();
        this.filterRow();
        this.rankingHeader();
        this.resultList();
      }
      .width(this.contentWidth())
      .padding({ top: TOK_SPACE_XS, bottom: TOK_SPACE_SM });
    }
    .layoutWeight(1)
    .width('100%')
    .align(Alignment.Top)
    .padding({ left: 18.99, right: 20.11 })
    .scrollBar(BarState.Off);
  }

  @Builder
  private currentSourceCard() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.rss_source')).width(20).height(20);
      }
      .width(34)
      .height(34)
      .borderRadius(17)
      .backgroundColor(ICON_BOX_BG);

      Column({ space: 3 }) {
        Text(this.presentation.currentSourceName !== '' ? this.presentation.currentSourceName : '书源')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(18)
          .fontColor(TEXT_DARK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(this.presentation.currentSourceName !== '' ? '已启用发现' : '发现功能待接入')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(600)
          .fontSize(11)
          .lineHeight(13.2)
          .fontColor(TEXT_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);

      Image($r('app.media.rss_chevron')).width(20).height(20);
    }
    .width('100%')
    .height(58)
    .padding({ left: TOK_SPACE_SM, right: 13.1 })
    .alignItems(VerticalAlign.Center)
    .backgroundColor(CURRENT_SOURCE_BG)
    .border({ width: 1, color: CURRENT_SOURCE_BORDER })
    .borderRadius(8);
  }

  @Builder
  private categoryChips() {
    Row({ space: 7 }) {
      ForEach(this.kindTitles(), (label: string, index: number) => {
        Stack({ alignContent: Alignment.Center }) {
          Text(label)
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(12)
            .lineHeight(15.6)
            .fontColor(this.activeCategory === index ? '#FFFFFF' : '#3F372F')
            .maxLines(1);
        }
        .height(32)
        .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM })
        .backgroundColor(this.activeCategory === index ? TOK_GREEN : CHIP_BG)
        .borderRadius(999)
        .onClick((): void => {
          this.activeCategory = index;
        });
      }, (label: string): string => `discover-chip-${label}`);
    }
    .width('100%')
    .height(32)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private filterRow() {
    Row({ space: 7 }) {
      Row() {
        Image($r('app.media.bookshelf_filter')).width(20).height(20);
        Text('筛选')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .lineHeight(15.6)
          .fontColor('#3F372F')
          .maxLines(1)
          .margin({ left: 3 });
        Text('男频 · 人气')
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(11)
          .lineHeight(15.56)
          .fontColor(TEXT_MUTED)
          .textAlign(TextAlign.RIGHT)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .padding({ left: 7 });
        Image($r('app.media.rss_chevron')).width(20).height(20);
      }
      .layoutWeight(1)
      .height(34)
      .padding({ left: TOK_SPACE_CONTROL_INLINE, right: 5 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(CARD_BG)
      .border({ width: 1, color: FILTER_BORDER })
      .borderRadius(8);

      Row() {
        Image($r('app.media.import_success')).width(20).height(20);
        Text('应用')
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(12)
          .lineHeight(15.6)
          .fontColor('#FFFFFF')
          .maxLines(1)
          .margin({ left: TOK_SPACE_ROW_BLOCK });
      }
      .width(69.097)
      .height(34)
      .padding({ left: TOK_SPACE_CONTROL_INLINE })
      .alignItems(VerticalAlign.Center)
      .linearGradient({
        angle: 270,
        colors: [['#436F88', 0], ['#315F78', 1]],
      })
      .border({ width: 1, color: APPLY_BORDER })
      .borderRadius(8);
    }
    .width('100%')
    .height(34)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private rankingHeader() {
    Text('排行榜')
      .width('100%')
      .fontFamily('ReaderInter')
      .fontWeight(FontWeight.Bold)
      .fontSize(15)
      .lineHeight(18.75)
      .fontColor(TEXT_DARK)
      .maxLines(1)
      .padding({ left: 2, right: 2 });
  }

  @Builder
  private resultList() {
    Column({ space: 0 }) {
      if (this.presentation.books.length === 0) {
        Stack({ alignContent: Alignment.Center }) {
          Column({ space: TOK_SPACE_XS }) {
            Text('暂无发现内容')
              .fontFamily('ReaderInter')
              .fontWeight(800)
              .fontSize(14)
              .lineHeight(18)
              .fontColor(TEXT_MUTED)
              .maxLines(1);
            Text('书架 · 发现功能待接入')
              .fontFamily('ReaderInter')
              .fontWeight(FontWeight.Regular)
              .fontSize(12)
              .lineHeight(15)
              .fontColor('#A19A91')
              .maxLines(1);
          }
          .alignItems(HorizontalAlign.Center);
        }
        .width('100%')
        .height(200);
      } else {
        ForEach(this.presentation.books, (book: DiscoverBook) => {
          this.resultRow(book);
        }, (book: DiscoverBook): string => `discover-book-${book.bookId}`);
      }
    }
    .width('100%')
    .backgroundColor(CARD_BG)
    .border({ width: 1, color: RESULT_BORDER })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private resultRow(book: DiscoverBook) {
    Row({ space: TOK_SPACE_SM }) {
      Stack({ alignContent: Alignment.Center }) {
        if (book.coverUrl !== '') {
          Image(book.coverUrl)
            .width(52)
            .height(74)
            .objectFit(ImageFit.Cover)
            .borderRadius(4);
        } else {
          Row()
            .width(52)
            .height(74)
            .borderRadius(4)
            .backgroundColor('#E4E0D8');
        }
      }

      Column({ space: TOK_SPACE_ROW_BLOCK }) {
        Text(book.name)
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(15)
          .lineHeight(18.75)
          .fontColor(TEXT_DARK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
        if (book.author !== '') {
          Text(book.author)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(11)
            .lineHeight(15.56)
            .fontColor(TEXT_MUTED)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        if (book.intro !== '') {
          Text(book.intro)
            .width('100%')
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .lineHeight(17.4)
            .fontColor('#5C554D')
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start);
    }
    .width('100%')
    .height(98)
    .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: TOK_SPACE_SM, bottom: TOK_SPACE_SM })
    .alignItems(VerticalAlign.Top)
    .border({ width: { top: 0.5 }, color: RESULT_BORDER });
  }

  private onMainTab(key: string): void {
    if (key === 'bookshelf') {
      this.onBack();
    } else if (key === 'rss') {
      this.onRssRequested();
    } else if (key === 'settings') {
      this.onSettingsRequested();
    }
    // 'discover' is this page; MainTabBar suppresses the current tab.
  }

  private contentWidth(): number {
    return this.isTablet ? TABLET_CONTENT_WIDTH : PHONE_CONTENT_WIDTH;
  }

  private kindTitles(): string[] {
    if (this.presentation.kinds.length > 0) {
      return this.presentation.kinds.map((k: DiscoverKind): string => k.title);
    }
    return ['排行榜', '书源', '分类', '完本', '最新', '书单'];
  }
}
