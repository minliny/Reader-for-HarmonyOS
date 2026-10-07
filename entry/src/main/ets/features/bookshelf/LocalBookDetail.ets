import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryScale, mangaDirectoryColor, mangaDirectoryContentTop, mangaDirectoryPositionStacked } from '../manga/MangaDirectoryVisual';
import { TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_APP_INHERITED_BODY, TYPE_APP_SECTION_LABEL, TYPE_BOOK_DETAIL_ACTION, TYPE_BOOK_DETAIL_AUTHOR, TYPE_BOOK_DETAIL_DESCRIPTION, TYPE_BOOK_DETAIL_EMPTY, TYPE_BOOK_DETAIL_META, TYPE_BOOK_DETAIL_SOURCE_ACTION, TYPE_BOOK_DETAIL_TITLE, TYPE_BOOK_DIRECTORY_ENTRY } from '../common/ReaderTypography';
import { bookAuthorLabel } from '../common/BookAuthorMetadata';
import { readerAppColor, type ReaderAppColorRole } from '../common/ReaderThemeRegistry';
import type { ReadingBookDetail } from '../reading/ReadingBookDetail';
import { bookIntroText } from '../common/BookIntroText';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import {
  READER_FLOATING_TOP_BAR_HEIGHT,
  readerFloatingBarBottomInset,
} from '../common/ReaderFloatingBarMetrics';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight, readerInteractiveSafeTop, readerInteractiveSafeBottom,
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
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_MEDIUM, READER_FONT_NOTO_SANS_SC_UI_600, READER_FONT_NOTO_SANS_SC_UI_650, READER_FONT_NOTO_SERIF_SC_BOLD } from '../common/ReaderFontFamilies';
import { registerReaderFonts, prepareMangaSheetFonts, prepareReaderFontFamily } from '../common/ReaderFonts';
import { PageBackBar } from '../common/PageBackBar';
import { mangaDirectoryIsGroup, mangaDirectoryPresentation, type MangaDirectoryRowPresentation } from '../manga/MangaDirectoryPresentation';
import { mangaDirectoryEntryRows, mangaDirectoryNearbyEntries, type MangaDirectoryLayoutRow } from '../manga/MangaDirectoryLayout';
import { MangaDirectoryPressFeedback } from '../manga/MangaDirectoryPressFeedback';
import { MangaDirectoryEntryRow } from '../manga/MangaDirectoryEntryRow';

const PHONE_SUMMARY_HEIGHT = 120.313;
const TABLET_SUMMARY_HEIGHT = 98.875;
const CHAPTER_SECTION_HEIGHT = 282;
const CHAPTER_ROW_HEIGHT = 58;
const CHAPTER_PREVIEW_LIMIT = 8;
const TEXT_CHAPTER_PREVIEW_LIMIT = 20;
const DETAIL_ACTION_AREA_HEIGHT = 77;

/** Shared detail presentation. Core facts decide the type and readable rows. */
@Component
export struct LocalBookDetail {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('onMangaGeometryChanged') readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onBookChanged') book: ReadingBookDetail;
  @Prop @Watch('onTocChanged') toc: LocalReadingTocEntry[] = [];
  @Prop sourceSwitchEnabled: boolean = false;
  @Prop readingEnabled: boolean = true;
  @Prop readingBlockedReason: string = '';
  @Prop inBookshelf: boolean = true;
  @Prop removalEnabled: boolean = true;
  @Prop removing: boolean = false;
  @Prop adding: boolean = false;
  @Prop cancellingAdd: boolean = false;
  @Prop shelfMessage: string = '';
  @Prop admissionIdentity: string = '';
  @Prop loadingMessage: string = '';
  onContinue: () => void = (): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onOpenDirectory: () => void = (): void => {};
  onSwitchSource: () => void = (): void => {};
  onRemove: (identity?: string) => void = (_identity?: string): void => {};
  onCancelAdd: (identity?: string) => void = (_identity?: string): void => {};
  onBack: () => void = (): void => {};
  @State private viewportWidth: number = 0;
  @State private introExpanded: boolean = false;
  @State private collapsedGroups: number[] = [];
  @State private mangaPresentation: Map<number, MangaDirectoryRowPresentation> = new Map<number, MangaDirectoryRowPresentation>();
  @State private mangaPreviewRows: MangaDirectoryLayoutRow[] = [];
  private collapseIdentity: string = '';
  private collapseEntries: LocalReadingTocEntry[] = [];
  @State private mangaFontsReady: boolean = false;
  @State private mangaDockMeasuredHeight: number = 68;
  @State private mangaFontsFailed: boolean = false;
  private mounted: boolean = false;
  private mangaFontGeneration: number = 0;
  private mangaFontIdentity: string = '';
  private mangaFontTask: Promise<boolean> | undefined = undefined;

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.onBookChanged();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.mangaFontGeneration += 1;
    this.mangaFontTask = undefined;
  }

  build() {
    if (this.book.contentKind !== 'manga' || this.mangaFontsReady) {
      this.detailPage();
    } else {
      Column({ space: 12 }) {
        if (this.mangaFontsFailed) {
          Text('详情暂时无法显示').fontSize(TYPE_BOOK_DETAIL_EMPTY.fontSizeFp);
          Button('重试').onClick((): void => this.prepareMangaDetailFonts());
        }
      }.width('100%').height('100%').justifyContent(FlexAlign.Center)
        .backgroundColor(mangaDirectoryColor('paper', this.appThemeScheme));
    }
  }

  @Builder
  private detailPage() {
    Stack({ alignContent: Alignment.Top }) {
      // Bars float over one full-viewport scroll owner. Only content inside
      // Scroll receives clearance; corner pixels remain paintable and draggable.
      Scroll() {
        Column({ space: this.book.contentKind === 'manga' ? 0 : 24 }) {
          this.hero();
          this.readingFacts();
          this.summary();
          this.catalog();
          if (this.shelfMessage.length > 0) {
            Text(this.shelfMessage).width('100%').fontSize(12)
              .fontColor(readerAppColor('TOK_DANGER', this.appThemeScheme));
          }
        }.width(this.contentFrame().width).alignItems(HorizontalAlign.Start)
          .margin({ left: this.contentFrame().left, right: this.contentFrame().right })
          .padding({ top: this.topInset() + (this.book.contentKind === 'manga' ? mangaDirectoryContentTop(this.mangaFontScale()) : 76),
            bottom: this.book.contentKind === 'manga' ? this.mangaContentBottomInset() : this.bottomInset() + 104 });
      }.width('100%').height('100%').scrollBar(this.book.contentKind === 'manga' ? BarState.Auto : BarState.Off)
        .scrollBarWidth(this.book.contentKind === 'manga' ? visual.scrollbarWidth : undefined)
        .scrollBarColor(this.book.contentKind === 'manga' ? '#47000000' : undefined);
      Row() {
        PageBackBar({ title: '书籍详情', floating: true, centered: true,
          variant: this.book.contentKind === 'manga' ? 'mangaDirectory' : 'standard',
          backIcon: this.book.contentKind === 'manga' ? (this.appThemeScheme === 'night' ? $r('app.media.manga_directory_back_theme_night') : $r('app.media.manga_directory_back')) :
            this.appThemeScheme === 'night' ? $r('app.media.book_detail_back_theme_night') : $r('app.media.book_detail_back'),
          onBack: (): void => this.onBack() });
      }.width('100%').padding({ left: this.book.contentKind === 'manga' ? this.headerFrame().left : 16 + this.safeLeft(),
        right: this.book.contentKind === 'manga' ? this.headerFrame().right : 16 + this.safeRight(), top: this.topInset() + 8 })
        .align(Alignment.Top).hitTestBehavior(HitTestMode.Transparent);
      // Keep the action dock in a full-viewport bottom-aligned owner. The
      // detail surface itself is top-aligned so the scroll and header retain
      // their coordinate space; aligning the dock row directly against that
      // stack placed it at the top edge on HarmonyOS.
      Stack({ alignContent: Alignment.Bottom }) {
        this.actionArea();
      }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%')
      .backgroundColor(this.detailColor('TOK_PAPER', 'paper'))
      .onAreaChange((_old: Area, area: Area): void => {
        const width = Number(area.width);
        if (Number.isFinite(width) && width > 0) {
          const wasNarrow = this.viewportWidth > 0 && this.viewportWidth <= 340;
          this.viewportWidth = width;
          if (wasNarrow !== (width <= 340) || this.book.contentKind === 'manga') this.prepareMangaPreview();
        }
      });
  }

  @Builder
  private hero() {
    if (this.book.contentKind === 'manga') this.mangaHero();
    else this.standardHero();
  }

  @Builder
  private mangaHero() {
    Row({ space: visual.heroGap }) {
      if (this.hasCover()) {
        Image(this.book.coverUrl as string).width(visual.heroWidth).height(visual.heroHeight)
          .objectFit(ImageFit.Cover).borderRadius(visual.heroRadius)
          .border({ width: visual.borderWidth, color: mangaDirectoryColor('frame', this.appThemeScheme) });
      } else {
        this.mangaCoverPlaceholder();
      }
      Column({ space: 0 }) {
        Row({ space: visual.heroTagGap }) {
          this.mangaMetadataTag('漫画', true);
          this.mangaMetadataTag(this.book.sourceId === 'local' ? '本地' : '在线', false);
        }.width('100%');
        Text(this.book.title).width('100%').fontFamily(READER_FONT_NOTO_SERIF_SC_BOLD)
          .fontWeight(visual.summaryFontWeight).fontSize(visual.summaryFontSize).lineHeight(visual.summaryLineHeight)
          .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
          .fontColor(mangaDirectoryColor('ink', this.appThemeScheme)).margin({ top: visual.heroTitleMargin, bottom: visual.heroTitleMargin })
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(bookAuthorLabel(this.book.author)).width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontWeight(visual.bodyFontWeight).fontSize(visual.heroAuthorFontSize).lineHeight(visual.heroAuthorLineHeight)
          .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
          .fontColor(mangaDirectoryColor('muted', this.appThemeScheme));
        Row({ space: visual.heroSourceGap }) {
          Text(this.book.sourceName).layoutWeight(1).constraintSize({ minWidth: 0 })
            .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
            .fontSize(visual.heroSourceFontSize).lineHeight(visual.heroSourceLineHeight)
            .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
            .fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
          if (this.sourceSwitchEnabled) {
            Text('换源').constraintSize({ minHeight: 30 }).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
              .fontWeight(visual.bodyFontWeight).fontSize(visual.heroSourceFontSize).lineHeight(visual.heroSourceLineHeight)
              .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
              .fontColor(mangaDirectoryColor('accent', this.appThemeScheme))
              .attributeModifier(new MangaDirectoryPressFeedback(this.sourceSwitchEnabled, true, this.appThemeScheme))
              .onClick((): void => { if (this.sourceSwitchEnabled) this.onSwitchSource(); });
          }
        }.width('100%').margin({ top: visual.heroSourceTop });
        if (this.book.lastChapter !== undefined && this.book.lastChapter.trim().length > 0) {
          Text(`最新：${this.book.lastChapter}`).width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .fontWeight(visual.bodyFontWeight).fontSize(visual.heroCountFontSize).lineHeight(visual.heroCountLineHeight)
            .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
            .fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).margin({ top: visual.heroCountTop })
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        Text(`章节目录 · ${this.mangaSummaryLabel()}`).width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontWeight(visual.bodyFontWeight).fontSize(visual.heroCountFontSize).lineHeight(visual.heroCountLineHeight)
          .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
          .fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).margin({ top: visual.heroCountTop });
      }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
    }.width('100%').padding({ top: visual.heroPaddingY, bottom: visual.heroPaddingY }).alignItems(VerticalAlign.Center);
  }

  @Builder
  private mangaCoverPlaceholder() {
    Stack({ alignContent: Alignment.Center }) {
      Column({ space: visual.coverGap }) {
        Text('MANGA / READER').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
          .fontSize(visual.coverTinySize).lineHeight(visual.coverTinyLine).letterSpacing(visual.coverTinyTracking)
          .minFontScale(1).maxFontScale(1).halfLeading(true).fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).opacity(.6);
        Text(this.book.title).width('100%').fontFamily(READER_FONT_NOTO_SERIF_SC_BOLD).fontWeight(visual.summaryFontWeight)
          .fontSize(visual.coverTitleFontSize).lineHeight(visual.coverTitleLineHeight)
          .minFontScale(1).maxFontScale(1).halfLeading(true).fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).textAlign(TextAlign.Center);
        Text('漫画').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
          .fontSize(visual.coverMediumSize).lineHeight(visual.coverMediumLine).letterSpacing(visual.coverMediumTracking)
          .minFontScale(1).maxFontScale(1).halfLeading(true).fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).opacity(.7);
      }.width('100%').alignItems(HorizontalAlign.Center);
      Text('封面占位').width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
        .fontSize(visual.coverFooterSize).lineHeight(visual.coverFooterLineHeight).halfLeading(true).fontColor(mangaDirectoryColor('muted', this.appThemeScheme))
        .minFontScale(1).maxFontScale(1).textAlign(TextAlign.Center).opacity(.7)
        .align(Alignment.Bottom).margin({ bottom: visual.coverFooterBottom });
    }.width(visual.heroWidth).height(visual.heroHeight).clip(true).borderRadius(visual.heroRadius)
      .border({ width: visual.borderWidth, color: mangaDirectoryColor('frame', this.appThemeScheme) })
      .backgroundColor(mangaDirectoryColor('soft', this.appThemeScheme))
      .foregroundColor(mangaDirectoryColor('muted', this.appThemeScheme)).accessibilityText('封面占位');
  }

  @Builder
  private mangaMetadataTag(label: string, primary: boolean) {
    Text(label).width(Math.max(visual.heroTagWidth, visual.heroTagFontSize * label.length * this.mangaFontScale() +
        visual.heroTagWidth - visual.heroTagFontSize * 2))
      .height(Math.max(visual.heroTagHeight, visual.heroTagLineHeight * this.mangaFontScale() + visual.heroTagHeight - visual.heroTagLineHeight))
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontWeight(visual.footerFontWeight)
      .fontSize(visual.heroTagFontSize).lineHeight(visual.heroTagLineHeight).halfLeading(true)
      .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).textAlign(TextAlign.Center).borderRadius(visual.heroTagRadius)
      .fontColor(mangaDirectoryColor(primary ? 'onGreen' : 'muted', this.appThemeScheme))
      .backgroundColor(mangaDirectoryColor(primary ? 'green' : 'soft', this.appThemeScheme));
  }

  @Builder
  private standardHero() {
    Row({ space: 18 }) {
      if (this.hasCover()) {
        Image(this.book.coverUrl as string).width(84).height(122).objectFit(ImageFit.Cover).borderRadius(8);
      } else {
        NoCoverCover({ coverWidth: 84, coverHeight: 122 });
      }
      Column({ space: 8 }) {
        Text(this.book.title).width('100%').fontFamily('ReaderNotoSerifSCBold')
          .fontWeight(FontWeight.Bold).fontSize(24).lineHeight(34)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(bookAuthorLabel(this.book.author)).width('100%').fontFamily('ReaderNotoSansSC')
          .fontSize(13).lineHeight(20).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Row({ space: 6 }) {
          this.metadataTag(this.book.contentKind === 'audio' ? '有声' : '小说');
          this.metadataTag(this.book.sourceId === 'local' ? '本地' : '在线');
        }.width('100%');
      }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
    }.width('100%').constraintSize({ minHeight: 122 }).alignItems(VerticalAlign.Top);
  }

  @Builder
  private metadataTag(label: string) {
    Text(label).fontSize(10).lineHeight(18).padding({ left: 7, right: 7 })
      .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: 0.5, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(4);
  }

  @Builder
  private readingFacts() {
    if (this.book.contentKind === 'manga') {
      // Keep the position separate from source metadata. When Core has no
      // admitted location, show an explicit empty state and never fabricate a
      // page number or chapter title.
      Column({ space: visual.positionGap }) {
        Text('上次读到').width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontWeight(visual.bodyFontWeight).fontSize(visual.metaFontSize).lineHeight(visual.metaLineHeight)
          .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
          .fontColor(mangaDirectoryColor('muted', this.appThemeScheme));
        if (mangaDirectoryPositionStacked(this.contentFrame().width, this.mangaFontScale(), this.mangaPositionLabel())) {
          Column({ space: visual.positionGap }) {
            this.mangaPositionTitle(true);
            this.mangaPositionPage(true);
          }.width('100%').alignItems(HorizontalAlign.Start);
        } else {
          Row({ space: visual.positionRowGap }) {
            this.mangaPositionTitle(false);
            this.mangaPositionPage(false);
          }.width('100%');
        }
      }.width('100%').padding({ left: visual.positionPaddingX, right: visual.positionPaddingX,
        top: visual.positionPaddingY, bottom: visual.positionPaddingY })
        .margin({ top: visual.positionTop }).backgroundColor(mangaDirectoryColor('soft', this.appThemeScheme))
        .borderRadius(visual.positionRadius).alignItems(HorizontalAlign.Start);
    } else {
      Column({ space: 9 }) {
        Row({ space: 12 }) {
          Text(`当前来源：${this.book.sourceName}`).layoutWeight(1).constraintSize({ minWidth: 0 })
            .fontSize(13).lineHeight(20).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
          if (this.sourceSwitchEnabled) {
            Text('换源').height(32).padding({ left: 12, right: 12 }).fontSize(12)
              .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
              .backgroundColor(readerAppColor('TOK_SETTING_ACTION_BG', this.appThemeScheme)).borderRadius(10)
              .textAlign(TextAlign.Center).onClick((): void => { if (this.sourceSwitchEnabled) this.onSwitchSource(); });
          }
        }.width('100%');
        Text(`最新：${this.book.lastChapter?.trim() || '暂无最新章节'}`).width('100%')
          .fontSize(12).lineHeight(20).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }.width('100%').alignItems(HorizontalAlign.Start);
    }
  }

  private mangaPositionLabel(): string {
    return this.book.mangaPosition === undefined ? '—' :
      `${this.book.mangaPosition.pageOrdinal + 1}${this.book.mangaPosition.totalPages !== undefined ? ` / ${this.book.mangaPosition.totalPages}` : ''} 页`;
  }

  @Builder
  private mangaPositionTitle(stacked: boolean) {
    Text(this.book.mangaPosition?.chapterTitle?.trim() || '尚未开始阅读')
      .width(stacked ? '100%' : undefined).layoutWeight(stacked ? 0 : 1).constraintSize({ minWidth: 0 })
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontWeight(visual.footerFontWeight)
      .fontSize(visual.positionFontSize).lineHeight(visual.positionLineHeight)
      .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
      .fontColor(mangaDirectoryColor('ink', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
  }

  @Builder
  private mangaPositionPage(stacked: boolean) {
    Text(this.mangaPositionLabel()).width(stacked ? '100%' : undefined).flexShrink(0)
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
      .fontSize(visual.positionPageFontSize).lineHeight(visual.positionPageLineHeight)
      .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true).fontFeature("'tnum' 1")
      .fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).textAlign(stacked ? TextAlign.Start : TextAlign.End);
  }

  @Builder
  private summary() {
    if (this.book.contentKind === 'manga') this.mangaIntro();
    else this.standardSummary();
  }

  @Builder
  private mangaIntro() {
    Column({ space: 0 }) {
      Text('简介').fontFamily(READER_FONT_NOTO_SANS_SC_UI_650).fontWeight(visual.sectionFontWeight, { enableVariableFontWeight: true })
        .fontSize(visual.sectionFontSize).lineHeight(visual.sectionLineHeight).halfLeading(true)
        .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
        .fontColor(mangaDirectoryColor('ink', this.appThemeScheme));
      Text(this.displayIntro() || '暂无简介').width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
        .fontWeight(visual.bodyFontWeight).fontSize(visual.introBodyFontSize).lineHeight(visual.introBodyLineHeight).halfLeading(true)
        .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
        .fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).margin({ top: visual.introBodyTop })
        .maxLines(this.introExpanded ? 10000 : 3).textOverflow({ overflow: TextOverflow.Ellipsis });
      if (this.displayIntro().length > 0) {
        Row({ space: visual.sectionActionGap }) {
          Text(this.introExpanded ? '收起' : '展开').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
            .fontWeight(visual.bodyFontWeight).fontSize(visual.sectionActionFontSize).lineHeight(visual.sectionActionLineHeight)
            .halfLeading(true).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
            .fontColor(mangaDirectoryColor('accent', this.appThemeScheme));
          Image(this.appThemeScheme === 'night' ? $r('app.media.manga_directory_chevron_down_accent_theme_night') : $r('app.media.manga_directory_chevron_down_accent'))
            .width(visual.sectionActionIcon).height(visual.sectionActionIcon).rotate({ angle: this.introExpanded ? 180 : 0 });
        }.constraintSize({ minHeight: visual.sectionActionHeight }).margin({ top: visual.introExpandTop })
          .attributeModifier(new MangaDirectoryPressFeedback(true, true, this.appThemeScheme))
          .onClick((): void => { this.introExpanded = !this.introExpanded; });
      }
    }.width('100%').alignItems(HorizontalAlign.Start).margin({ top: visual.introMarginTop })
      .padding({ top: visual.introTop, bottom: visual.introBottom })
      .border({ width: { top: visual.borderWidth, bottom: visual.borderWidth }, color: mangaDirectoryColor('line', this.appThemeScheme) });
  }

  @Builder
  private standardSummary() {
    Column({ space: 8 }) {
      Text('简介').fontSize(15).fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      Text(this.displayIntro() || '暂无简介').width('100%').fontFamily('ReaderNotoSansSC')
        .fontSize(13).lineHeight(24).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(this.introExpanded ? 10000 : 3).textOverflow({ overflow: TextOverflow.Ellipsis });
      if (this.displayIntro().length > 0) {
        Text(this.introExpanded ? '收起' : '展开').height(32).fontSize(12)
          .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .onClick((): void => { this.introExpanded = !this.introExpanded; });
      }
    }.width('100%').padding({ top: this.book.contentKind === 'manga' ? visual.introTop : 0, bottom: this.book.contentKind === 'manga' ? visual.introBottom : 0 })
      .margin({ top: this.book.contentKind === 'manga' ? visual.positionTop : 0 })
      .border({ width: { top: this.book.contentKind === 'manga' ? TOK_BORDER_W : 0,
        bottom: this.book.contentKind === 'manga' ? TOK_BORDER_W : 0 }, color: this.detailColor('TOK_LINE', 'line') })
      .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private catalog() {
    Column() {
      if (this.book.contentKind === 'manga') this.mangaCatalogHeading();
      else this.standardCatalogHeading();
      if (this.book !== undefined && this.book.contentKind === 'manga') {
        ForEach(this.mangaPreviewRows, (row: MangaDirectoryLayoutRow) => {
          MangaDirectoryEntryRow({ row: this.liveMangaPreviewRow(row), presentation: this.mangaPresentation,
            scheme: this.appThemeScheme, currentChapterIndex: this.book.mangaPosition?.chapterIndex ?? -1,
            showContext: this.previewShowsContext(this.liveMangaPreviewRow(row)), interactionEnabled: !this.removing, branchControlsEnabled: false,
            collapsedBranches: this.collapsedGroups,
            onSelectEntry: (entry: LocalReadingTocEntry): void => this.selectMangaPreviewEntry(entry),
          });
        }, (row: MangaDirectoryLayoutRow): string => JSON.stringify([this.book.sourceId, this.book.bookId,
          row.entries.map((entry: LocalReadingTocEntry): number => entry.index)]));
      } else {
        ForEach(this.visibleToc(), (entry: LocalReadingTocEntry) => {
          this.chapterRow(entry);
        }, (entry: LocalReadingTocEntry): string => JSON.stringify([this.book.sourceId, this.book.bookId,
          entry.index, entry.title, entry.level ?? null, entry.navigable ?? null]));
      }
      if (this.toc.length === 0) {
        Text(this.chapterEmptyMessage()).width('100%').padding({ top: 16, bottom: 16 })
          .fontSize(13).lineHeight(22).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      }
    }.width('100%').margin({ top: this.book.contentKind === 'manga' ? visual.catalogTop : 0 });
  }

  @Builder
  private mangaCatalogHeading() {
    Row({ space: visual.sectionGap }) {
      Column({ space: visual.summaryGap }) {
        Text('章节目录').fontFamily(READER_FONT_NOTO_SANS_SC_UI_650).fontWeight(visual.sectionFontWeight, { enableVariableFontWeight: true })
          .fontSize(visual.sectionFontSize).lineHeight(visual.sectionLineHeight).halfLeading(true)
          .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
          .fontColor(mangaDirectoryColor('ink', this.appThemeScheme));
        Text(this.mangaSummaryLabel()).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
          .fontSize(visual.countFontSize).lineHeight(visual.countLineHeight).halfLeading(true)
          .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
          .fontColor(mangaDirectoryColor('muted', this.appThemeScheme));
      }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
      Row({ space: visual.sectionActionGap }) {
        Text('完整目录').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
          .fontSize(visual.sectionActionFontSize).lineHeight(visual.sectionActionLineHeight).halfLeading(true)
          .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
          .fontColor(mangaDirectoryColor('accent', this.appThemeScheme));
        Image(this.appThemeScheme === 'night' ? $r('app.media.manga_directory_chevron_right_accent_theme_night') : $r('app.media.manga_directory_chevron_right_accent'))
          .width(visual.sectionActionIcon).height(visual.sectionActionIcon);
      }.constraintSize({ minHeight: visual.sectionActionHeight }).flexShrink(0).enabled(!this.removing)
        .attributeModifier(new MangaDirectoryPressFeedback(!this.removing, true, this.appThemeScheme))
        .onClick((): void => { if (!this.removing) this.onOpenDirectory(); });
    }.width('100%').margin({ bottom: visual.sectionBottom }).alignItems(VerticalAlign.Center);
  }

  @Builder
  private standardCatalogHeading() {
      Row({ space: 8 }) {
        Text(this.book !== undefined && this.book.contentKind === 'manga' ? '章节目录' : '目录').fontSize(15).fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        Text(this.book !== undefined && this.book.contentKind === 'manga' ? this.mangaSummaryLabel() :
          `${this.toc.filter((entry: LocalReadingTocEntry): boolean => entry.navigable !== false).length} 个可读条目`)
          .layoutWeight(1).fontSize(11).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        // Keep the 44vp hit target separate from the 30vp painted capsule.
        // The SVG is a real production asset; selecting the theme variant here
        // also keeps the action legible when the detail surface switches to
        // the night palette.
        Stack({ alignContent: Alignment.Center }) {
          Row({ space: 6 }) {
            Image(this.appThemeScheme === 'night' ? $r('app.media.book_detail_directory_theme_night') :
              $r('app.media.book_detail_directory')).width(20).height(20);
            Text('完整目录').fontFamily('ReaderInter').fontWeight(900).fontSize(12)
              .fontColor(readerAppColor(this.appThemeScheme === 'night' ? 'TOK_GREEN' : 'TOK_PRIMARY_DARK', this.appThemeScheme))
              .maxLines(1);
          }.width(94).height(30).padding({ left: 11, right: 11 })
            .backgroundColor(readerAppColor('app.LocalBookDetail.chapterSection.backgroundColor.A3FFFCF8', this.appThemeScheme))
            .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.appThemeScheme) })
            .borderRadius(999).alignItems(VerticalAlign.Center);
        }.width(94).height(44).enabled(!this.removing)
          .onClick((): void => { if (!this.removing) this.onOpenDirectory(); });
      }.width('100%').constraintSize({ minHeight: 44 });
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    Row({ space: 8 }) {
      Text(this.book.contentKind === 'manga' &&
        (entry.title.trim().length === 0 || entry.title.trim() === '第话' || entry.title.trim() === '第 话') ?
        `第${Math.max(1, entry.index + 1)}话` : entry.title)
        .layoutWeight(1).constraintSize({ minWidth: 0 })
        .fontFamily('ReaderNotoSansSC').fontSize(14).lineHeight(22)
        .fontWeight(entry.navigable === false ? FontWeight.Medium : FontWeight.Regular)
        .fontColor(readerAppColor(entry.navigable === false ? 'TOK_MUTED' : 'TOK_INK', this.appThemeScheme));
      if (entry.navigable === false && (this.book.contentKind !== 'manga' || this.chapterIsGroup(entry))) {
        Text(this.collapsedGroups.includes(entry.index) ? '›' : '⌄').width(24).fontSize(18)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      } else if (this.isCurrentChapter(entry)) {
        Text('正在读').fontSize(11).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
      }
    }.width('100%').constraintSize({ minHeight: entry.navigable === false ? 44 : 58 })
      .padding({ left: this.chapterIndent(entry), right: 10, top: 10, bottom: 10 })
      .border({ width: { bottom: 0.5 }, color: { bottom: readerAppColor('TOK_CHAPTER_DIVIDER', this.appThemeScheme) } })
      .backgroundColor(this.isCurrentChapter(entry) ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) :
        entry.navigable === false ? readerAppColor('TOK_CARD_BG', this.appThemeScheme) : Color.Transparent)
      .borderRadius(this.isCurrentChapter(entry) || entry.navigable === false ? 8 : 0)
      .enabled(!this.removing).onClick((): void => {
        if (this.removing) return;
        const current = this.toc.find((row: LocalReadingTocEntry): boolean => row.index === entry.index);
        if (current === undefined || current.title !== entry.title || current.level !== entry.level ||
          current.navigable !== entry.navigable) return;
        if (entry.navigable === false) {
          if (this.book.contentKind === 'manga' && !this.chapterIsGroup(entry)) return;
          this.collapsedGroups = this.collapsedGroups.includes(entry.index) ?
            this.collapsedGroups.filter((index: number): boolean => index !== entry.index) : [...this.collapsedGroups, entry.index];
        } else this.onSelectChapter(entry.index);
      });
  }

  @Builder
  private actionArea() {
    // Measure the 48vp action row independently from the 68vp painted dock;
    // horizontal insets must not shrink its vertical button bounds.
    Stack({ alignContent: Alignment.Center }) {
      Row({ space: this.book.contentKind === 'manga' ? visual.detailDockGap : 12 }) {
        Text(this.readingActionLabel()).layoutWeight(1).height(this.book.contentKind === 'manga' ? undefined : 48)
          .constraintSize({ minHeight: this.book.contentKind === 'manga' ? visual.detailActionMinHeight : 48 })
          .padding({ left: this.book.contentKind === 'manga' ? 16 : 0, right: this.book.contentKind === 'manga' ? 16 : 0 }).fontFamily(this.book.contentKind === 'manga' ? READER_FONT_NOTO_SANS_SC_UI_600 : 'ReaderNotoSansSCUIBold')
          .fontSize(this.book.contentKind === 'manga' ? visual.detailPrimaryFontSize : 14)
          .lineHeight(this.book.contentKind === 'manga' ? visual.detailPrimaryLineHeight : undefined)
          .minFontScale(this.book.contentKind === 'manga' ? Math.min(1, this.mangaFontScale()) : 0)
          .maxFontScale(this.book.contentKind === 'manga' ? Math.max(1, this.mangaFontScale()) : 2)
          .halfLeading(this.book.contentKind === 'manga')
          .fontWeight(this.book.contentKind === 'manga' ? visual.groupFontWeight : FontWeight.Bold)
          .fontColor(this.detailColor('TOK_ON_PRIMARY', 'onGreen'))
          .textAlign(TextAlign.Center).backgroundColor(this.detailColor('TOK_PRIMARY_DARK', 'green')).borderRadius(this.book.contentKind === 'manga' ? visual.detailActionRadius : 16)
          .enabled(!this.removing).opacity(this.removing ? (this.book.contentKind === 'manga' ? visual.disabledOpacity : 0.5) : 1)
          .attributeModifier(new MangaDirectoryPressFeedback(!this.removing, this.book.contentKind === 'manga', this.appThemeScheme))
          .onClick((): void => { if (!this.removing) this.onContinue(); });
        ForEach([this.admissionIdentity], (identity: string) => {
        Text(this.shelfActionLabel()).width(this.book.contentKind === 'manga' ? visual.detailSecondaryWidth : 94)
          .height(this.book.contentKind === 'manga' ? undefined : 48)
          .constraintSize({ minHeight: this.book.contentKind === 'manga' ? visual.detailActionMinHeight : 48 })
          .padding({ left: this.book.contentKind === 'manga' ? 6 : 0, right: this.book.contentKind === 'manga' ? 6 : 0 })
          .fontFamily('ReaderNotoSansSCUIMedium')
          .fontSize(this.book.contentKind === 'manga' ? visual.detailSecondaryFontSize : 12)
          .lineHeight(this.book.contentKind === 'manga' ? visual.detailSecondaryLineHeight : undefined)
          .minFontScale(this.book.contentKind === 'manga' ? Math.min(1, this.mangaFontScale()) : 0)
          .maxFontScale(this.book.contentKind === 'manga' ? Math.max(1, this.mangaFontScale()) : 2)
          .halfLeading(this.book.contentKind === 'manga').fontWeight(500)
          .textAlign(TextAlign.Center).fontColor(this.detailColor(this.inBookshelf ? 'TOK_MUTED' : 'TOK_GREEN',
            this.book.contentKind === 'manga' ? 'muted' : this.inBookshelf ? 'muted' : 'accent'))
          .backgroundColor(this.detailColor('TOK_SURFACE_PANEL_SOFT', 'soft')).borderRadius(this.book.contentKind === 'manga' ? visual.detailActionRadius : 16)
          .border({ width: 1, color: this.detailColor('TOK_LINE', 'line') })
          .enabled(this.removalEnabled && !this.removing && !this.cancellingAdd)
          .opacity(this.removalEnabled && !this.removing && !this.cancellingAdd ? 1 : this.book.contentKind === 'manga' ? visual.disabledOpacity : 0.4)
          .attributeModifier(new MangaDirectoryPressFeedback(this.removalEnabled && !this.removing && !this.cancellingAdd, this.book.contentKind === 'manga', this.appThemeScheme))
          .onClick((): void => {
            if (this.removalEnabled && !this.removing && !this.cancellingAdd) {
              if (this.adding) this.onCancelAdd(identity); else this.onRemove(identity);
            }
          });
        }, (identity: string): string => identity);
      }.width('100%').height(this.book.contentKind === 'manga' ? undefined : 48)
        .constraintSize({ minHeight: this.book.contentKind === 'manga' ? visual.detailActionMinHeight : 48 }).alignItems(VerticalAlign.Center);
    // The design dock reserves 9vp on every side. The viewport-bottom owner
    // aligns this entire 68vp surface; this Stack centers the 48vp row inside
    // the painted capsule and must not apply a second bottom alignment.
    }.width(this.dockFrame().width).height(this.book.contentKind === 'manga' ? undefined : 68)
      .constraintSize({ minHeight: this.book.contentKind === 'manga' ? visual.detailDockHeight : 68 })
      .padding(this.book.contentKind === 'manga' ? visual.detailDockPadding : 9)
      .backgroundColor(this.detailColor('TOK_CARD_BG', 'surface')).borderRadius(this.book.contentKind === 'manga' ? visual.detailDockRadius : 24)
      .border({ width: TOK_BORDER_W, color: this.detailColor('TOK_BORDER', 'line') })
      .clip(true)
      .shadow({ radius: this.book.contentKind === 'manga' ? visual.shadowRadius : this.appThemeScheme === 'night' ? 0 : 18,
        color: this.book.contentKind === 'manga' ? mangaDirectoryColor('shadow', this.appThemeScheme) : '#14000000', offsetY: 5 })
      .margin({ bottom: this.bottomInset() + (this.book.contentKind === 'manga' ? visual.detailDockBottom : 12) })
      .onAreaChange((_old: Area, area: Area): void => {
        const height = Number(area.height);
        if (this.book.contentKind === 'manga' && Number.isFinite(height) && height > 0 && Math.abs(height - this.mangaDockMeasuredHeight) > .1)
          this.mangaDockMeasuredHeight = height;
      });
  }

  private mangaContentBottomInset(): number {
    return this.bottomInset() + visual.detailDockBottom + Math.max(visual.detailDockHeight, this.mangaDockMeasuredHeight) + visual.detailDockClearance;
  }
  private detailColor(token: ReaderAppColorRole, role: string): string {
    return this.book.contentKind === 'manga' ? mangaDirectoryColor(role, this.appThemeScheme) : readerAppColor(token, this.appThemeScheme);
  }
  private mangaFontScale(): number {
    const revision = this.readerWindowMetricsRevision;
    return revision < 0 ? 1 : mangaDirectoryScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }
  private onMangaFontIdentityChanged(): void {
    const identity = `${this.book.sourceId}\u0000${this.book.bookId}\u0000${this.book.contentKind}`;
    if (identity === this.mangaFontIdentity) {
      if (this.mounted && this.book.contentKind === 'manga' && !this.mangaFontsReady && this.mangaFontTask === undefined) this.prepareMangaDetailFonts();
      return;
    }
    this.mangaFontIdentity = identity;
    this.mangaFontGeneration += 1;
    this.mangaFontTask = undefined;
    this.mangaFontsReady = false;
    this.mangaFontsFailed = false;
    if (this.mounted && this.book.contentKind === 'manga') this.prepareMangaDetailFonts();
  }
  private prepareMangaDetailFonts(): void {
    if (!this.mounted || this.book.contentKind !== 'manga' || this.mangaFontTask !== undefined) return;
    const generation = ++this.mangaFontGeneration;
    const identity = this.mangaFontIdentity;
    this.mangaFontsFailed = false;
    this.mangaFontsReady = false;
    const task = prepareReaderFontFamily(READER_FONT_NOTO_SERIF_SC_BOLD)
      .then((): Promise<boolean> => prepareMangaSheetFonts());
    this.mangaFontTask = task;
    void task.then((ready: boolean): void => {
      if (!this.mounted || generation !== this.mangaFontGeneration || identity !== this.mangaFontIdentity || this.book.contentKind !== 'manga') return;
      this.mangaFontTask = undefined;
      this.mangaFontsReady = ready;
      this.mangaFontsFailed = !ready;
    }).catch((_error: Error): void => {
      if (!this.mounted || generation !== this.mangaFontGeneration || identity !== this.mangaFontIdentity || this.book.contentKind !== 'manga') return;
      this.mangaFontTask = undefined;
      this.mangaFontsFailed = true;
    });
  }

  private contentFrame(): SurfaceHorizontalFrame {
    return resolveHorizontalFrame(this.liveWidth(), this.safeLeft(), this.safeRight(),
      new SurfaceWidthSpec(this.book.contentKind === 'manga' ? visual.contentWidthMax : 720, 20, 20, 'center'));
  }
  private headerFrame(): SurfaceHorizontalFrame {
    const frame = this.contentFrame();
    const expansion = visual.contentPaddingX - visual.headerInsetX;
    return new SurfaceHorizontalFrame(Math.max(0, frame.left - expansion), Math.max(0, frame.right - expansion), frame.width + expansion * 2);
  }
  private dockFrame(): SurfaceHorizontalFrame {
    return resolveHorizontalFrame(this.liveWidth(), this.safeLeft(), this.safeRight(),
      new SurfaceWidthSpec(this.book.contentKind === 'manga' ? visual.contentWidthMax - 2 * (visual.detailDockInset - visual.contentPaddingX) : 680,
        this.book.contentKind === 'manga' ? visual.detailDockInset : 30, this.book.contentKind === 'manga' ? visual.detailDockInset : 30, 'center'));
  }
  private liveWidth(): number {
    if (this.viewportWidth > 0) return this.viewportWidth;
    return this.readerWindowMetricsRevision < 0 ? 0 : ReaderWindowCoordinator.metrics().windowRect.width;
  }
  private safeLeft(): number { return readerVisualSafeLeft(ReaderWindowCoordinator.metrics()); }
  private safeRight(): number { return readerVisualSafeRight(ReaderWindowCoordinator.metrics()); }
  private topInset(): number { return readerInteractiveSafeTop(ReaderWindowCoordinator.metrics()); }
  private bottomInset(): number { return readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics()); }
  private displayIntro(): string { return bookIntroText(this.book.intro); }
  private chapterEmptyMessage(): string {
    return this.loadingMessage.trim() || (!this.readingEnabled ? this.readingBlockedReason.trim() : '') || '暂无章节信息';
  }
  private isCurrentChapter(entry: LocalReadingTocEntry): boolean {
    return entry.navigable !== false && this.book.contentKind === 'manga' && this.book.mangaPosition?.chapterIndex === entry.index;
  }
  private chapterIndent(entry: LocalReadingTocEntry): number {
    if (this.book.contentKind === 'manga') return 10 + Math.min(4, Math.max(0, (entry.level ?? 1) - 1)) * 16;
    if (entry.navigable === false) return 10;
    if ((entry.level ?? 1) > 1) return 26;
    const priorGroup = this.toc.slice(0, this.toc.indexOf(entry)).some((row: LocalReadingTocEntry): boolean => row.navigable === false);
    return priorGroup ? 26 : 10;
  }
  private visibleToc(): LocalReadingTocEntry[] {
    if (this.book.contentKind === 'manga') {
      return mangaDirectoryNearbyEntries(this.toc, this.mangaPresentation, this.book.mangaPosition?.chapterIndex ?? -1,
        3, Math.max(0, CHAPTER_PREVIEW_LIMIT - 4));
    }
    let collapsed: boolean = false;
    return this.toc.slice(0, TEXT_CHAPTER_PREVIEW_LIMIT).filter((entry: LocalReadingTocEntry): boolean => {
      if (entry.navigable === false) { collapsed = this.collapsedGroups.includes(entry.index); return true; }
      return !collapsed;
    });
  }
  private chapterIsGroup(entry: LocalReadingTocEntry): boolean {
    return mangaDirectoryIsGroup(this.toc, this.toc.findIndex((row: LocalReadingTocEntry): boolean => row.index === entry.index));
  }
  private onBookChanged(): void {
    if (this.mounted) this.onMangaFontIdentityChanged();
    const identity = `${this.book.sourceId}\u0000${this.book.bookId}`;
    if (identity === this.collapseIdentity) { this.prepareMangaPreview(); return; }
    this.collapseIdentity = identity;
    this.collapsedGroups = [];
    this.collapseEntries = this.toc.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
      index: entry.index, title: entry.title, level: entry.level, navigable: entry.navigable, downloadState: entry.downloadState }));
    this.prepareMangaPreview();
  }
  private onTocChanged(): void {
    const previous = this.collapseEntries;
    this.collapsedGroups = this.collapsedGroups.filter((index: number): boolean => {
      const before = previous.find((entry: LocalReadingTocEntry): boolean => entry.index === index);
      const after = this.toc.find((entry: LocalReadingTocEntry): boolean => entry.index === index);
      return before !== undefined && after !== undefined && this.chapterIsGroup(after) &&
        before.title === after.title && before.level === after.level && before.navigable === after.navigable;
    });
    this.collapseEntries = this.toc.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
      index: entry.index, title: entry.title, level: entry.level, navigable: entry.navigable, downloadState: entry.downloadState }));
    this.prepareMangaPreview();
  }
  private onMangaGeometryChanged(): void {
    if (this.book !== undefined && this.book.contentKind === 'manga') this.prepareMangaPreview();
  }

  private prepareMangaPreview(): void {
    this.mangaPresentation = mangaDirectoryPresentation(this.toc);
    const currentIndex = this.book.mangaPosition?.chapterIndex ?? -1;
    const ancestors = this.mangaPresentation.get(currentIndex)?.ancestorGroupIndexes ?? [];
    this.collapsedGroups = this.collapsedGroups.filter((index: number): boolean => !ancestors.includes(index));
    const entries = mangaDirectoryNearbyEntries(this.toc, this.mangaPresentation, currentIndex, 3, Math.max(0, CHAPTER_PREVIEW_LIMIT - 4));
    this.mangaPreviewRows = mangaDirectoryEntryRows(entries, this.mangaPresentation, this.liveWidth() > 0 && this.liveWidth() <= visual.narrowWidth,
      mangaDirectoryScale(ReaderWindowCoordinator.metrics().systemFontScale), this.contentFrame().width);
  }

  private liveMangaPreviewRow(row: MangaDirectoryLayoutRow): MangaDirectoryLayoutRow {
    const indices = row.entries.map((entry: LocalReadingTocEntry): number => entry.index);
    return this.mangaPreviewRows.find((current: MangaDirectoryLayoutRow): boolean => current.entries.length === indices.length &&
      current.entries.every((entry: LocalReadingTocEntry, at: number): boolean => entry.index === indices[at])) ??
      { kind: 'row', columns: 1, startIndex: 0, entries: [], labels: [] };
  }

  private previewShowsContext(row: MangaDirectoryLayoutRow): boolean {
    const rowIndex = this.mangaPreviewRows.findIndex((item: MangaDirectoryLayoutRow): boolean => item.entries[0]?.index === row.entries[0]?.index);
    const previousEntry = rowIndex > 0 ? this.mangaPreviewRows[rowIndex - 1].entries[0] : undefined;
    return previousEntry === undefined || this.mangaPresentation.get(previousEntry.index)?.contextTitle !==
      this.mangaPresentation.get(row.entries[0]?.index)?.contextTitle;
  }

  private selectMangaPreviewEntry(entry: LocalReadingTocEntry): void {
    if (this.removing || this.collapseIdentity !== `${this.book.sourceId}\u0000${this.book.bookId}`) return;
    if (!this.mangaPreviewRows.some((row: MangaDirectoryLayoutRow): boolean =>
      row.entries.some((candidate: LocalReadingTocEntry): boolean => candidate.index === entry.index &&
        candidate.title === entry.title && candidate.level === entry.level && candidate.navigable === entry.navigable))) return;
    const current = this.toc.find((row: LocalReadingTocEntry): boolean => row.index === entry.index);
    if (current === undefined || current.title !== entry.title || current.level !== entry.level ||
      current.navigable !== entry.navigable || current.navigable === false) return;
    this.onSelectChapter(entry.index);
  }

  private mangaSummaryLabel(): string {
    const readable = this.toc.filter((entry: LocalReadingTocEntry): boolean => entry.navigable === true).length;
    const unknown = this.toc.some((entry: LocalReadingTocEntry): boolean => entry.navigable === undefined);
    const groups = this.toc.filter((entry: LocalReadingTocEntry): boolean => this.mangaPresentation.get(entry.index)?.group === true).length;
    return `${readable} 个${unknown ? '已确认' : ''}可读条目${groups > 0 ? ` · ${groups} 个卷组` : ''}`;
  }

  private readingActionLabel(): string {
    if (this.book.contentKind === 'manga') return this.book.mangaPosition === undefined ? '开始阅读' : '继续阅读';
    return this.inBookshelf ? '继续阅读' : '开始阅读';
  }
  private shelfActionLabel(): string {
    if (this.cancellingAdd) return '正在取消…';
    if (this.adding) return '取消加入';
    if (this.removing) return this.inBookshelf ? '正在移除…' : '正在加入…';
    return this.inBookshelf ? '移除书架' : '加入书架';
  }
  private hasCover(): boolean {
    return this.book.coverUrl !== undefined && /^(https?:\/\/|data:image\/(png|jpeg|bmp|webp);base64,|file:\/\/)/.test(this.book.coverUrl.trim());
  }
}
