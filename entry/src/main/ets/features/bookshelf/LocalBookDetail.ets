import { TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_APP_INHERITED_BODY, TYPE_APP_SECTION_LABEL, TYPE_BOOK_DETAIL_ACTION, TYPE_BOOK_DETAIL_AUTHOR, TYPE_BOOK_DETAIL_DESCRIPTION, TYPE_BOOK_DETAIL_EMPTY, TYPE_BOOK_DETAIL_META, TYPE_BOOK_DETAIL_SOURCE_ACTION, TYPE_BOOK_DETAIL_TITLE, TYPE_BOOK_DIRECTORY_ENTRY } from '../common/ReaderTypography';
import { bookAuthorLabel } from '../common/BookAuthorMetadata';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import type { ReadingBookDetail } from '../reading/ReadingBookDetail';
import { bookIntroText } from '../common/BookIntroText';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  READER_FLOATING_TOP_BAR_HEIGHT,
  readerFloatingBarBottomInset,
} from '../common/ReaderFloatingBarMetrics';
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
const CHAPTER_PREVIEW_LIMIT = 20;
const DETAIL_ACTION_AREA_HEIGHT = 77;

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
  // Remote acquisition errors may explain the chapter area, but never gate
  // entry to reading: the reader owns its loading, retry and error surface.
  @Prop readingEnabled: boolean = true;
  @Prop readingBlockedReason: string = '';
  @Prop inBookshelf: boolean = true;
  @Prop removalEnabled: boolean = true;
  @Prop removing: boolean = false;
  @Prop adding: boolean = false;
  @Prop cancellingAdd: boolean = false;
  @Prop shelfMessage: string = '';
  @Prop loadingMessage: string = '';
  onContinue: () => void = (): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onOpenDirectory: () => void = (): void => {};
  onSwitchSource: () => void = (): void => {};
  onRemove: () => void = (): void => {};
  onCancelAdd: () => void = (): void => {};
  onBack: () => void = (): void => {};
  @State private viewportWidth: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.detailScroll();
      this.backBar();
      Stack({ alignContent: Alignment.Bottom }) {
        this.actionArea();
      }
      .width('100%')
      .height('100%')
      .padding({
        left: this.contentFrame().left,
        right: this.contentFrame().right,
        bottom: this.actionAreaBottomOffset(),
      })
      .hitTestBehavior(HitTestMode.Transparent);
    }
    .width('100%')
    .height('100%')
    .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = this.numericAreaLength(newValue.width);
      if (width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
        this.viewportWidth = width;
      }
    });
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
        if (this.shelfMessage.length > 0) {
          Text(this.shelfMessage)
            .fontSize(TYPE_APP_INHERITED_BODY.fontSizeFp)
            .fontColor(readerAppColor('TOK_DANGER', this.appThemeScheme))
            .width(this.contentWidth())
            .padding({ bottom: TOK_SPACE_MD });
        }
      }
      .width(this.contentWidth())
      .padding({
        top: READER_FLOATING_TOP_BAR_HEIGHT + TOK_SPACE_XS,
        bottom: DETAIL_ACTION_AREA_HEIGHT + this.actionAreaBottomOffset(),
      });
    }
    .height('100%')
    .width('100%')
    .padding({ left: this.contentFrame().left, right: this.contentFrame().right })
    .align(Alignment.Top)
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
          .height(25.96)
          .fontFamily(TYPE_BOOK_DETAIL_TITLE.fontFamily)
          .fontWeight(TYPE_BOOK_DETAIL_TITLE.fontWeight)
          .fontSize(TYPE_BOOK_DETAIL_TITLE.fontSizeFp)
          .lineHeight(TYPE_BOOK_DETAIL_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(`作者：${bookAuthorLabel(this.book.author)}`)
          .width('100%')
          .height(17.55)
          .fontFamily(TYPE_BOOK_DETAIL_AUTHOR.fontFamily)
          .fontWeight(TYPE_BOOK_DETAIL_AUTHOR.fontWeight)
          .fontSize(TYPE_BOOK_DETAIL_AUTHOR.fontSizeFp)
          .lineHeight(TYPE_BOOK_DETAIL_AUTHOR.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(`最新：${this.book.lastChapter?.trim() || '暂无最新章节'}`)
          .width('100%').height(18)
          .fontFamily(TYPE_BOOK_DETAIL_META.fontFamily).fontWeight(TYPE_BOOK_DETAIL_META.fontWeight)
          .fontSize(TYPE_BOOK_DETAIL_META.fontSizeFp).lineHeight(TYPE_BOOK_DETAIL_META.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });

        // Figma `2260:1432`/`2260:1433`: the Hero's 4th row — source label +
        // 更换书源 pill. The geometry stays shared, while the label is the
        // source identity admitted by the local or remote reading session.
        Row({ space: TOK_SPACE_XS }) {
          Text(`书源：${this.book.sourceName}`)
            .constraintSize({ minWidth: 0 })
            .flexShrink(1)
            .height(18)
            .fontFamily(TYPE_BOOK_DETAIL_META.fontFamily)
            .fontWeight(TYPE_BOOK_DETAIL_META.fontWeight)
            .fontSize(TYPE_BOOK_DETAIL_META.fontSizeFp)
            .lineHeight(TYPE_BOOK_DETAIL_META.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });

          Stack({ alignContent: Alignment.Center }) {
            Text('更换书源')
              .width(52)
              .height(12)
              .fontFamily(TYPE_BOOK_DETAIL_SOURCE_ACTION.fontFamily)
              .fontWeight(TYPE_BOOK_DETAIL_SOURCE_ACTION.fontWeight)
              .fontSize(TYPE_BOOK_DETAIL_SOURCE_ACTION.fontSizeFp)
              .lineHeight(TYPE_BOOK_DETAIL_SOURCE_ACTION.lineHeightFp as number)
              .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
              .textAlign(TextAlign.Center)
              .maxLines(1);
          }
          .width(52)
          .height(18)
          .flexShrink(0)
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
        .alignItems(VerticalAlign.Center);
        Text('分组：默认')
          .width('100%').height(18)
          .fontFamily(TYPE_BOOK_DETAIL_META.fontFamily).fontWeight(TYPE_BOOK_DETAIL_META.fontWeight)
          .fontSize(TYPE_BOOK_DETAIL_META.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).lineHeight(TYPE_BOOK_DETAIL_META.lineHeightFp as number)
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .layoutWeight(1)
      .height(122)
      .justifyContent(FlexAlign.SpaceBetween)
      .constraintSize({ minWidth: 0 })
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
        .fontFamily(TYPE_APP_SECTION_LABEL.fontFamily)
        .fontWeight(TYPE_APP_SECTION_LABEL.fontWeight)
        .fontSize(TYPE_APP_SECTION_LABEL.fontSizeFp)
        .lineHeight(TYPE_APP_SECTION_LABEL.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1);

      // A display placeholder never becomes book metadata or a fake chapter.
      Text(this.displayIntro().length > 0 ? this.displayIntro() : '暂无简介')
        .width('100%')
        .height(this.summaryTextHeight())
        .fontFamily(TYPE_BOOK_DETAIL_DESCRIPTION.fontFamily)
        .fontWeight(TYPE_BOOK_DETAIL_DESCRIPTION.fontWeight)
        .fontSize(TYPE_BOOK_DETAIL_DESCRIPTION.fontSizeFp)
        .lineHeight(TYPE_BOOK_DETAIL_DESCRIPTION.lineHeightFp as number)
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
            .fontFamily(TYPE_APP_SECTION_LABEL.fontFamily)
            .fontWeight(TYPE_APP_SECTION_LABEL.fontWeight)
            .fontSize(TYPE_APP_SECTION_LABEL.fontSizeFp)
            .lineHeight(TYPE_APP_SECTION_LABEL.lineHeightFp as number)
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
              .fontFamily(TYPE_APP_COMPACT_PRIMARY_ACTION.fontFamily)
              .fontWeight(TYPE_APP_COMPACT_PRIMARY_ACTION.fontWeight)
              .fontSize(TYPE_APP_COMPACT_PRIMARY_ACTION.fontSizeFp)
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
        }, (entry: LocalReadingTocEntry): string => `book-detail-toc-${this.book.sourceId}-${this.book.bookId}-${entry.index}`);
        if (this.toc.length === 0) {
          Text(this.chapterEmptyMessage())
            .width('100%')
            .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING, top: TOK_SPACE_XS })
            .fontFamily(TYPE_BOOK_DETAIL_EMPTY.fontFamily as string).fontSize(TYPE_BOOK_DETAIL_EMPTY.fontSizeFp).lineHeight(TYPE_BOOK_DETAIL_EMPTY.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis });
        }
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
        .accessibilityText('完整目录')
        .enabled(!this.removing)
        .onClick((): void => {
          if (!this.removing) {
            this.onOpenDirectory();
          }
        });

    }
    .width(this.contentWidth())
    .height(this.chapterSectionHeight())
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
        .fontFamily(TYPE_BOOK_DIRECTORY_ENTRY.fontFamily)
        .fontWeight(TYPE_BOOK_DIRECTORY_ENTRY.fontWeight)
        .fontSize(TYPE_BOOK_DIRECTORY_ENTRY.fontSizeFp)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
    }
      .width('100%')
      .height(CHAPTER_ROW_HEIGHT)
      .padding({ left: TOK_SPACE_CARD_PADDING, right: TOK_SPACE_CARD_PADDING })
      .border({ width: { top: TOK_BORDER_W }, color: { top: readerAppColor('TOK_CHAPTER_DIVIDER', this.appThemeScheme) } })
      .alignItems(VerticalAlign.Center)
      .enabled(entry.navigable !== false && !this.removing)
      .onClick((): void => {
        if (entry.navigable !== false && !this.removing) {
          this.onSelectChapter(entry.index);
        }
      });
  }

  @Builder
  private actionArea() {
    Row({ space: TOK_SPACE_CONTROL_INLINE }) {
      Stack({ alignContent: Alignment.Center }) {
        Text(this.readingActionLabel())
          .fontFamily(TYPE_BOOK_DETAIL_ACTION.fontFamily)
          .fontWeight(TYPE_BOOK_DETAIL_ACTION.fontWeight)
          .fontSize(TYPE_BOOK_DETAIL_ACTION.fontSizeFp)
          .lineHeight(TYPE_BOOK_DETAIL_ACTION.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme));
      }
      .width(this.actionButtonWidth())
      .margin({ left: 4, right: 4 })
      .height(46)
      .backgroundColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme) })
      .borderRadius(999)
      .opacity(this.removing ? 0.5 : 1)
      .enabled(!this.removing)
      .accessibilityText(this.readingActionLabel())
      .onClick((): void => {
        if (!this.removing) {
          this.onContinue();
        }
      });

      Stack({ alignContent: Alignment.Center }) {
        Text(this.shelfActionLabel())
          .fontFamily(TYPE_BOOK_DETAIL_ACTION.fontFamily)
          .fontWeight(TYPE_BOOK_DETAIL_ACTION.fontWeight)
          .fontSize(TYPE_BOOK_DETAIL_ACTION.fontSizeFp)
          .lineHeight(TYPE_BOOK_DETAIL_ACTION.lineHeightFp as number)
          .fontColor(this.inBookshelf ? readerAppColor('TOK_DANGER', this.appThemeScheme) : readerAppColor('TOK_GREEN', this.appThemeScheme));
      }
      .width(this.actionButtonWidth())
      .margin({ left: 4, right: 4 })
      .height(46)
      .backgroundColor(readerAppColor('TOK_CARD_BG_HI', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_ACTION_DIVIDER', this.appThemeScheme) })
      .borderRadius(999)
      .enabled(this.removalEnabled && !this.removing && !this.cancellingAdd)
      .opacity(this.removalEnabled && !this.removing && !this.cancellingAdd ? 1 : 0.4)
      .accessibilityText(this.shelfActionLabel())
      .onClick((): void => {
        if (this.removalEnabled && !this.removing && !this.cancellingAdd) {
          if (this.adding) this.onCancelAdd();
          else this.onRemove();
        }
      });
    }
    .width(this.contentWidth())
    .height(DETAIL_ACTION_AREA_HEIGHT)
    .padding({ top: TOK_SPACE_MD, bottom: 15 })
    .alignItems(VerticalAlign.Top)
    .hitTestBehavior(HitTestMode.Transparent);
  }

  private actionAreaBottomOffset(): number {
    if (this.readerWindowMetricsRevision < 0) return 0;
    // The action area already includes its original 15 vp bottom clearance.
    return Math.max(0, readerFloatingBarBottomInset(ReaderWindowCoordinator.metrics(), 15) - 15);
  }

  private displayIntro(): string {
    return bookIntroText(this.book.intro);
  }

  private chapterEmptyMessage(): string {
    if (this.loadingMessage.trim().length > 0) return this.loadingMessage;
    if (!this.readingEnabled && this.readingBlockedReason.trim().length > 0) return this.readingBlockedReason;
    return '暂无章节信息';
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
    return Math.max(0, Math.min(355, (this.contentWidth() - TOK_SPACE_CONTROL_INLINE) / 2) - 8);
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
    // PH116: show the confirmed twenty-row preview in the detail page's own
    // scroll. Four static Figma example rows are not a runtime height cap.
    return this.toc.slice(0, CHAPTER_PREVIEW_LIMIT);
  }

  private chapterSectionHeight(): number {
    return this.toc.length > 0 ? 50 + CHAPTER_ROW_HEIGHT * Math.min(this.toc.length, CHAPTER_PREVIEW_LIMIT) :
      CHAPTER_SECTION_HEIGHT;
  }

  private readingActionLabel(): string {
    return this.inBookshelf ? '继续阅读' : '开始阅读';
  }

  private shelfActionLabel(): string {
    if (this.cancellingAdd) return '正在取消…';
    if (this.adding) return '取消加入';
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
