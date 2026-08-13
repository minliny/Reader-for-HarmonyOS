import type { ReadingBookDetail } from '../reading/ReadingBookDetail';
import {
  TOK_ACTION_DIVIDER,
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CARD_BG_HI,
  TOK_CHAPTER_DIVIDER,
  TOK_CONTENT_MAX_W_PHONE,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_DANGER,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
  TOK_SCREEN_INSET,
  TOK_SETTING_ACTION_BG,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../common/ReaderTokens';

import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import { NoCoverCover } from './NoCoverCover';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';

const PHONE_SUMMARY_HEIGHT = 120.313;
const TABLET_SUMMARY_HEIGHT = 98.875;
const CHAPTER_SECTION_HEIGHT = 282;
const CHAPTER_ROW_HEIGHT = 58;

/**
 * Local-book detail, translated only from the two Final local variants:
 * - Phone: `23 · Pages · Final` `2987:11445`
 * - Tablet: `23 · Pages · Final` `2987:11517`
 *
 * This is deliberately a presentation component. Its owner supplies a
 * validated Core `ShelfBook` and materialized TOC; it neither creates a
 * runtime nor knows Core envelopes, import storage, or directory routing.
 *
 * The original variants used Songti SC Bold. The current Figma file and the
 * product decision map that role to Noto Serif SC, so dynamic titles use the
 * bundled `ReaderNotoSerifSCBold` face directly.
 */
@Component
export struct LocalBookDetail {
  @Prop book: ReadingBookDetail;
  @Prop toc: LocalReadingTocEntry[] = [];
  @Prop isTablet: boolean = false;
  @Prop sourceSwitchEnabled: boolean = false;
  @Prop inBookshelf: boolean = true;
  @Prop removalEnabled: boolean = true;
  @Prop removing: boolean = false;
  @Prop loadingMessage: string = '';
  onContinue: () => void = (): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onOpenDirectory: () => void = (): void => {};
  onSwitchSource: () => void = (): void => {};
  onRemove: () => void = (): void => {};
  onBack: () => void = (): void => {};

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Column() {
      this.backBar();
      Column() {
        this.detailScroll();
        this.actionArea();
      }
      .layoutWeight(1)
      .width('100%');
    }
    .width('100%')
    .height('100%')
    .backgroundColor(TOK_PAPER);
  }

  @Builder
  private backBar() {
    // Current Figma maps the former Songti title role to Noto Serif SC Bold.
    PageBackBar({
      title: '书籍详情',
      backIcon: $r('app.media.book_detail_back'),
      onBack: (): void => this.onBack(),
    });
  }

  @Builder
  private detailScroll() {
    Scroll() {
      Column({ space: TOK_SPACE_XS }) {
        this.heroCard();
        this.summaryCard();
        this.chapterSection();
      }
      .width(this.contentWidth())
      .padding({ top: TOK_SPACE_XS, bottom: 112 });
    }
    .layoutWeight(1)
    .width('100%')
    .padding({ left: TOK_SCREEN_INSET, right: TOK_SCREEN_INSET })
    .scrollBar(BarState.Off);
  }

  @Builder
  private heroCard() {
    Row({ space: TOK_SPACE_CARD_PADDING }) {
      // N-COVER-HERO-01 (user decision 2026-08-05): reuse the shelf-card
      // `BookCover` NoCover `3612:1796` scaled into the 86×122 Hero cover slot
      // when the local book has no cover; no new Figma variant drawn.
      if (this.hasCover()) {
        Image(this.book.coverUrl as string)
          .width(86)
          .height(122)
          .objectFit(ImageFit.Cover)
          .borderRadius(6);
      } else {
        NoCoverCover({ coverWidth: 86, coverHeight: 122 });
      }

      Column() {
        Text(this.book.title)
          // Current Figma maps the former Songti title role to Noto Serif SC Bold.
          .width('100%')
          .fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold)
          .fontSize(22)
          .lineHeight(25.96)
          .fontColor(TOK_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(this.book.author)
          .width('100%')
          .margin({ top: TOK_SPACE_XS })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(13)
          .lineHeight(17.55)
          .fontColor(TOK_MUTED)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Row({ space: 5 }) {
          Text('最新')
            .width(37)
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(11)
            .lineHeight(16.188)
            .fontColor(TOK_MUTED)
            .maxLines(1);
          Text(this.book.lastChapter ?? '')
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .lineHeight(16.188)
            .fontColor(TOK_INK)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .width('100%')
        .height(16.188)
        .margin({ top: TOK_SPACE_CONTROL_INLINE });

        // Figma `2260:1432`/`2260:1433`: the Hero's 4th row — source label +
        // 更换书源 pill. The geometry stays shared, while the label is the
        // source identity admitted by the local or remote reading session.
        Row({ space: TOK_SPACE_XS }) {
          Text(`书源：${this.book.sourceName}`)
            .width(72)
            .height(15)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(12)
            .lineHeight(15)
            .fontColor(TOK_MUTED)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });

          Stack({ alignContent: Alignment.Center }) {
            Text('更换书源')
              .fontFamily('ReaderInter')
              .fontWeight(900)
              .fontSize(9)
              .lineHeight(18)
              .fontColor(TOK_GREEN)
              .textAlign(TextAlign.Center)
              .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS });
          }
          .width(52)
          .height(18)
          .borderRadius(999)
          .backgroundColor(TOK_SETTING_ACTION_BG)
          .opacity(this.sourceSwitchEnabled ? 1 : 0.4)
          .enabled(this.sourceSwitchEnabled)
          .accessibilityText(this.sourceSwitchEnabled ? '更换书源' : '本地书籍暂不支持更换书源')
          .onClick((): void => {
            if (this.sourceSwitchEnabled) {
              this.onSwitchSource();
            }
          });
        }
        .width('100%')
        .height(18)
        .margin({ top: TOK_SPACE_XS });
      }
      .layoutWeight(1)
      .height(122)
      .alignItems(HorizontalAlign.Start);
    }
    .width(this.contentWidth())
    .height(152)
    .padding(15)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(8)
    .alignItems(VerticalAlign.Top);
  }

  @Builder
  private summaryCard() {
    Column({ space: TOK_SPACE_XS }) {
      Text('简介')
        .width('100%')
        .height(18)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(15)
        .lineHeight(18)
        .fontColor(TOK_INK)
        .maxLines(1);

      // Core may legitimately omit EPUB/TXT description metadata.  Do not
      // manufacture replacement copy; the local route still keeps the Figma
      // card geometry and shows only Core-owned text when available.
      Text(this.book.intro ?? '')
        .width('100%')
        .height(this.summaryTextHeight())
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(21.45)
        .fontColor(TOK_MUTED)
        .maxLines(this.isTablet ? 2 : 3)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width(this.contentWidth())
    .height(this.summaryHeight())
    .padding(15)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(8)
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private chapterSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        Row({ space: TOK_SPACE_SM }) {
          Text('章节信息')
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(15)
            .lineHeight(18)
            .fontColor(TOK_INK)
            .maxLines(1);

          // This is the 94 × 30 painted capsule from the Final component.
          // Its 94 × 44 prototype target is a separate Figma RECTANGLE
          // layered below, not an enlarged replacement for this visual.
          Row({ space: TOK_SPACE_XS }) {
            Image($r('app.media.book_detail_directory'))
              .width(20)
              .height(20);
            Text('完整目录')
              .fontFamily('ReaderInter')
              .fontWeight(900)
              .fontSize(12)
              .fontColor(TOK_PRIMARY_DARK)
              .maxLines(1);
          }
          .width(94)
          .height(30)
          .padding({ left: 11, right: 11 })
          .backgroundColor('#A3FFFCF8')
          .border({ width: TOK_BORDER_W, color: TOK_BORDER })
          .borderRadius(999)
          .alignItems(VerticalAlign.Center);
        }
        .width('100%')
        .height(48)
        .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING })
        .alignItems(VerticalAlign.Center);

        ForEach(this.visibleToc(), (entry: LocalReadingTocEntry) => {
          this.chapterRow(entry);
        }, (entry: LocalReadingTocEntry): string => `book-detail-toc-${entry.index}`);
      }
      .width('100%')
      .height('100%')
      // The full-size visual layer must not block the separate Figma
      // PrototypeHit sibling underneath it. Its own interactive chapter rows
      // still receive events; noninteractive painted pixels pass through.
      .hitTestBehavior(HitTestMode.Transparent);

      // Phone `1996:30381` and Tablet `1996:30397` are independent Figma
      // RECTANGLE prototype targets at (section width − 109, 3), 94 × 44,
      // with white fill at 0.001 opacity and no corner radius. The native
      // Button is only an event host for that existing invisible rectangle:
      // it has no label, no state effect, and does not replace the 94 × 30
      // painted capsule above.
      Button() {
        Image($r('app.media.book_detail_full_directory_hit'))
          .width(94)
          .height(44);
      }
        .type(ButtonType.Normal)
        .width(94)
        .height(44)
        .position({ x: this.contentWidth() - 109, y: 3 })
        .padding(0)
        .backgroundColor(Color.Transparent)
        .border({ width: 0 })
        .borderRadius(0)
        .stateEffect(false)
        .enabled(this.readingActionsReady())
        .onClick((): void => {
          if (this.readingActionsReady()) {
            this.onOpenDirectory();
          }
        });

    }
    .width(this.contentWidth())
    .height(CHAPTER_SECTION_HEIGHT)
    .padding(1)
    .backgroundColor(TOK_CARD_BG)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    Row() {
      Text(entry.title)
        .width('100%')
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(14)
        .fontColor(TOK_INK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
      .width('100%')
      .height(CHAPTER_ROW_HEIGHT)
      .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING })
      .border({ width: { top: TOK_BORDER_W }, color: { top: TOK_CHAPTER_DIVIDER } })
      .alignItems(VerticalAlign.Center)
      .onClick((): void => this.onSelectChapter(entry.index));
  }

  @Builder
  private actionArea() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Text(this.readingActionsReady() ? '继续阅读' : this.pendingReadingLabel())
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(13)
          .lineHeight(14.3)
          .fontColor(TOK_ON_PRIMARY);
      }
      .width(this.actionButtonWidth())
      .height(46)
      .backgroundColor(TOK_PRIMARY_DARK)
      .border({ width: TOK_BORDER_W, color: TOK_PRIMARY_DARK })
      .borderRadius(999)
      .opacity(this.readingActionsReady() && !this.removing ? 1 : 0.5)
      .enabled(this.readingActionsReady() && !this.removing)
      .accessibilityText(this.readingActionsReady() ? '继续阅读' : this.pendingReadingLabel())
      .onClick((): void => {
        if (this.readingActionsReady() && !this.removing) {
          this.onContinue();
        }
      });

      Stack({ alignContent: Alignment.Center }) {
        Text(this.shelfActionLabel())
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(13)
          .lineHeight(14.3)
          .fontColor(this.inBookshelf ? TOK_DANGER : TOK_GREEN);
      }
      .width(this.actionButtonWidth())
      .height(46)
      .backgroundColor(TOK_CARD_BG_HI)
      .border({ width: TOK_BORDER_W, color: TOK_ACTION_DIVIDER })
      .borderRadius(999)
      .enabled(this.removalEnabled && !this.removing)
      .opacity(this.removalEnabled && !this.removing ? 1 : 0.4)
      .accessibilityText(this.shelfActionLabel())
      .onClick((): void => {
        if (this.removalEnabled && !this.removing) {
          this.onRemove();
        }
      });
    }
    .width(this.contentWidth())
    .height(77)
    .padding({ top: TOK_SPACE_MD, bottom: 15 })
    .alignItems(VerticalAlign.Top)
    // Figma `860:105`: vertical fade behind the ActionBar — transparent →
    // rgba(249,240,230,0.96) at 42% → #f9f0e6, so scrolled content dissolves
    // into the page background beneath the two buttons.
    .linearGradient({
      direction: GradientDirection.Bottom,
      colors: [
        ['#00F9F0E6', 0.0],
        ['#F5F9F0E6', 0.42],
        ['#FFF9F0E6', 1.0],
      ],
    });
  }

  private contentWidth(): number {
    return this.isTablet ? TOK_CONTENT_MAX_W_TABLET : TOK_CONTENT_MAX_W_PHONE;
  }

  private summaryHeight(): number {
    return this.isTablet ? TABLET_SUMMARY_HEIGHT : PHONE_SUMMARY_HEIGHT;
  }

  private summaryTextHeight(): number {
    return this.isTablet ? 42.875 : 64.313;
  }

  private actionButtonWidth(): number {
    return this.isTablet ? 355 : 170;
  }

  private visibleToc(): LocalReadingTocEntry[] {
    // The Final Detail component draws exactly four 58px rows.  Expanding it
    // into a scrolling or paged directory would create an unsourced state.
    return this.toc.slice(0, 4);
  }

  private readingActionsReady(): boolean {
    return this.toc.length > 0;
  }

  private pendingReadingLabel(): string {
    return this.loadingMessage.trim().length > 0 ? this.loadingMessage : '正在准备阅读…';
  }

  private shelfActionLabel(): string {
    if (this.removing) {
      return this.inBookshelf ? '正在移除…' : '正在加入…';
    }
    return this.inBookshelf ? '移除书架' : '加入书架';
  }

  private hasCover(): boolean {
    if (this.book.coverUrl === undefined) {
      return false;
    }
    return /^(https?:\/\/|data:image\/(png|jpeg|bmp|webp);base64,|file:\/\/)/.test(this.book.coverUrl.trim());
  }
}
