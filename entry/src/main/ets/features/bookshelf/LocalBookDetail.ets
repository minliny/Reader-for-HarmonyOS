import { readerAppColor } from '../common/ReaderThemeRegistry';
import type { ReadingBookDetail } from '../reading/ReadingBookDetail';
import { bookIntroText } from '../common/BookIntroText';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight,
} from '../common/ReaderWindowMetrics';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../common/SurfaceHorizontalGeometry';
import {
  TOK_ACTION_DIVIDER,
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_CARD_BG,
  TOK_CARD_BG_HI,
  TOK_CHAPTER_DIVIDER,
  TOK_CONTENT_MAX_W_TABLET,
  TOK_DANGER,
  TOK_GREEN,
  TOK_INK,
  TOK_MUTED,
  TOK_ON_PRIMARY,
  TOK_PAPER,
  TOK_PRIMARY_DARK,
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
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerWindowMetricsRevision') readerWindowMetricsRevision: number = 0;
  @Prop book: ReadingBookDetail;
  @Prop toc: LocalReadingTocEntry[] = [];
  @Prop sourceSwitchEnabled: boolean = false;
  // Remote detail readability verdict: the start-reading action is enabled
  // only when the leading-chapter probe admits the content. Local books keep
  // the defaults (enabled, empty reason) and never see the gate.
  @Prop readingEnabled: boolean = true;
  @Prop readingBlockedReason: string = '';
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
  @State private viewportWidth: number = 0;

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
      .width('100%')
      .alignItems(HorizontalAlign.Center)
      .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
      .onAreaChange((_oldValue: Area, newValue: Area): void => {
        const width = this.numericAreaLength(newValue.width);
        if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
          this.viewportWidth = width;
        }
      });
    }
    .width('100%')
    .height('100%')
    .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme));
  }

  @Builder
  private backBar() {
    // Current Figma maps the former Songti title role to Noto Serif SC Bold.
    PageBackBar({
      title: '书籍详情',
      backIcon: (this.appThemeScheme === 'night' ? $r('app.media.book_detail_back_theme_night') : $r('app.media.book_detail_back')),
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
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(this.book.author)
          .width('100%')
          .margin({ top: TOK_SPACE_XS })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(13)
          .lineHeight(17.55)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Row({ space: 5 }) {
          Text('最新')
            .width(37)
            .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(11)
            .lineHeight(16.188)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1);
          Text(this.book.lastChapter ?? '')
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(12)
            .lineHeight(16.188)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
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
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });

          Stack({ alignContent: Alignment.Center }) {
            Text('更换书源')
              .fontFamily('ReaderInter')
              .fontWeight(900)
              .fontSize(9)
              .lineHeight(18)
              .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
              .textAlign(TextAlign.Center)
              .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS });
          }
          .width(52)
          .height(18)
          .borderRadius(999)
          .backgroundColor(readerAppColor('TOK_SETTING_ACTION_BG', this.appThemeScheme))
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
        Text('分组：默认')
          .fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).lineHeight(15)
          .margin({ top: 4 });
      }
      .layoutWeight(1)
      .constraintSize({ minHeight: 142 })
      .alignItems(HorizontalAlign.Start);
    }
    .width(this.contentWidth())
    .height(152)
    .padding(15)
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1);

      // Core may legitimately omit EPUB/TXT description metadata.  Do not
      // manufacture replacement copy; the local route still keeps the Figma
      // card geometry and shows only Core-owned text when available.
      Text(this.displayIntro())
        .width('100%')
        .height(this.summaryTextHeight())
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Regular)
        .fontSize(13)
        .lineHeight(21.45)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(this.usesWideContent() ? 2 : 3)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
    .width(this.contentWidth())
    .height(this.summaryHeight())
    .padding(15)
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1);

          // This is the 94 × 30 painted capsule from the Final component.
          // Its 94 × 44 prototype target is a separate Figma RECTANGLE
          // layered below, not an enlarged replacement for this visual.
          Row({ space: TOK_SPACE_XS }) {
            Image((this.appThemeScheme === 'night' ? $r('app.media.book_detail_directory_theme_night') : $r('app.media.book_detail_directory')))
              .width(20)
              .height(20);
            Text('完整目录')
              .fontFamily('ReaderInter')
              .fontWeight(900)
              .fontSize(12)
              .fontColor(readerAppColor('TOK_PRIMARY_TEXT', this.appThemeScheme))
              .maxLines(1);
          }
          .width(94)
          .height(30)
          .padding({ left: 11, right: 11 })
          .backgroundColor(readerAppColor('app.LocalBookDetail.chapterSection.backgroundColor.A3FFFCF8', this.appThemeScheme))
          .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
      Button()
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
    .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
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
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
      .width('100%')
      .height(CHAPTER_ROW_HEIGHT)
      .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING })
      .border({ width: { top: TOK_BORDER_W }, color: { top: readerAppColor('TOK_CHAPTER_DIVIDER', this.appThemeScheme) } })
      .alignItems(VerticalAlign.Center)
      .onClick((): void => this.onSelectChapter(entry.index));
  }

  @Builder
  private actionArea() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Text(this.readingActionLabel())
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(13)
          .lineHeight(14.3)
          .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
      }
      .width(this.actionButtonWidth())
      .height(46)
      .backgroundColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) })
      .borderRadius(999)
      .opacity(this.readingActionsReady() && !this.removing && this.readingEnabled ? 1 : 0.5)
      .enabled(this.readingActionsReady() && !this.removing && this.readingEnabled)
      .accessibilityText(this.readingActionLabel())
      .onClick((): void => {
        if (this.readingActionsReady() && !this.removing && this.readingEnabled) {
          this.onContinue();
        }
      });

      Stack({ alignContent: Alignment.Center }) {
        Text(this.shelfActionLabel())
          .fontFamily('ReaderInter')
          .fontWeight(900)
          .fontSize(13)
          .lineHeight(14.3)
          .fontColor(this.inBookshelf ? readerAppColor('TOK_DANGER', this.appThemeScheme) : readerAppColor('TOK_GREEN', this.appThemeScheme));
      }
      .width(this.actionButtonWidth())
      .height(46)
      .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_ACTION_DIVIDER', this.appThemeScheme) })
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
        [readerAppColor('app.LocalBookDetail.actionArea.linearGradient.00F9F0E6', this.appThemeScheme), 0.0],
        [readerAppColor('app.LocalBookDetail.actionArea.linearGradient.F5F9F0E6', this.appThemeScheme), 0.42],
        [readerAppColor('app.LocalBookDetail.actionArea.linearGradient.FFF9F0E6', this.appThemeScheme), 1.0],
      ],
    });
  }

  private displayIntro(): string {
    return bookIntroText(this.book.intro);
  }

  private contentWidth(): number {
    return this.contentFrame().width;
  }

  private contentFrame(): SurfaceHorizontalFrame {
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(
      this.liveViewportWidth(),
      readerVisualSafeLeft(metrics),
      readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_TABLET, 19, 19, 'center'),
    );
  }

  private liveViewportWidth(): number {
    if (this.viewportWidth > 0) {
      return this.viewportWidth;
    }
    // Reading this value makes a new Window snapshot observable without
    // inventing a 390/760 design-canvas fallback for the first detail frame.
    if (this.readerWindowMetricsRevision < 0) {
      return 0;
    }
    const width = ReaderWindowCoordinator.metrics().windowRect.width;
    return Number.isFinite(width) && width > 0 ? width : 0;
  }

  private usesWideContent(): boolean {
    return this.contentWidth() >= 600;
  }

  private summaryHeight(): number {
    return this.usesWideContent() ? TABLET_SUMMARY_HEIGHT : PHONE_SUMMARY_HEIGHT;
  }

  private summaryTextHeight(): number {
    return this.usesWideContent() ? 42.875 : 64.313;
  }

  private actionButtonWidth(): number {
    return Math.min(355, Math.max(0, (this.contentWidth() - TOK_SPACE_CONTROL_INLINE) / 2));
  }

  private numericAreaLength(value: Length): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
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

  private readingActionLabel(): string {
    if (!this.readingActionsReady()) {
      return this.pendingReadingLabel();
    }
    if (!this.readingEnabled && this.readingBlockedReason.trim().length > 0) {
      return this.readingBlockedReason;
    }
    return this.inBookshelf ? '继续阅读' : '开始阅读';
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
