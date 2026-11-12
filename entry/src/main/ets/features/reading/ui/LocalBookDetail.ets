import { sourceSwitchTriggerFocusId } from '../../source/presentation/SourceSwitchSurfaceLifecycle';
import { FrameCallback } from '@kit.ArkUI';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import type { MeasureOptions } from '@ohos.measure';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { bookCoverDisplayUrl } from '../../../app/library/BookCoverDisplay';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput,
  resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryScale, mangaDirectoryColor, mangaDirectoryHeaderHeight, mangaDirectoryPositionStacked } from '../../manga/ui/MangaDirectoryVisual';
import { TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_APP_INHERITED_BODY, TYPE_APP_SECTION_LABEL, TYPE_BOOK_DETAIL_ACTION, TYPE_BOOK_DETAIL_AUTHOR, TYPE_BOOK_DETAIL_DESCRIPTION, TYPE_BOOK_DETAIL_EMPTY, TYPE_BOOK_DETAIL_META, TYPE_BOOK_DETAIL_SOURCE_ACTION, TYPE_BOOK_DETAIL_TITLE, TYPE_BOOK_DIRECTORY_ENTRY } from '../../../ui/foundation/ReaderTypography';
import { bookAuthorLabel } from '../../../app/library/BookAuthorMetadata';
import { readerAppColor, type ReaderAppColorRole } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../../../ui/layout/ReaderRaisedShape';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderLabeledIconAction } from '../../../ui/controls/ReaderLabeledIconAction';
import type { ReadingBookDetail } from '../presentation/ReadingBookDetail';
import { bookIntroText } from '../../../app/library/BookIntroText';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import {
  readerVisualSafeLeft,
  readerVisualSafeRight, readerInteractiveSafeTop, readerInteractiveSafeBottom,
} from '../../../ui/foundation/ReaderWindowMetrics';
import {
  SurfaceHorizontalFrame,
  SurfaceWidthSpec,
  resolveHorizontalFrame,
} from '../../../ui/layout/SurfaceHorizontalGeometry';
import {
  TOK_ACTION_DIVIDER,
  TOK_BORDER,
  TOK_CARD_BG,
  TOK_CARD_BG_HI,
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
} from '../../../ui/foundation/ReaderTokens';

import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { ReaderDirectoryChapterRow } from './ReaderDirectoryChapterRow';
import { NoCoverCover } from '../../../ui/patterns/NoCoverCover';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_MEDIUM, READER_FONT_NOTO_SANS_SC_UI_600, READER_FONT_NOTO_SANS_SC_UI_650, READER_FONT_NOTO_SERIF_SC_BOLD } from '../../../ui/foundation/ReaderFontFamilies';
import { registerReaderFonts, prepareMangaSheetFonts, prepareReaderFontFamily } from '../../../ui/foundation/ReaderFonts';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { DetailHeaderSpec, detailHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';
import { mangaDirectoryIsGroup, mangaDirectoryPresentation, type MangaDirectoryRowPresentation } from '../../manga/presentation/MangaDirectoryPresentation';
import { mangaDirectoryEntryRows, mangaDirectoryNearbyEntries, type MangaDirectoryLayoutRow } from '../../manga/ui/MangaDirectoryLayout';
import { MangaDirectoryPressFeedback } from '../../../ui/foundation/MangaDirectoryPressFeedback';
import { MangaDirectoryEntryRow } from '../../manga/ui/MangaDirectoryEntryRow';

const PHONE_SUMMARY_HEIGHT = 120.313;
const TABLET_SUMMARY_HEIGHT = 98.875;
const CHAPTER_SECTION_HEIGHT = 282;
const CHAPTER_ROW_HEIGHT = 58;
const CHAPTER_PREVIEW_LIMIT = 8;
const TEXT_CHAPTER_PREVIEW_LIMIT = 20;
const DETAIL_DOCK_HEIGHT = 68;
const DETAIL_DOCK_BOTTOM_GAP = 12;
const DETAIL_DOCK_CONTENT_GAP = 24;

type DetailDirectoryFocusContext = 'detail' | 'directory' | 'inactive';

class DetailDirectoryFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
}

/** Shared detail presentation. Core facts decide the type and readable rows. */
@Component
export struct LocalBookDetail {
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
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
  @Prop @Watch('onShelfMessageChanged') shelfMessage: string = '';
  @Prop @Watch('onDirectoryFocusIdentityChanged') admissionIdentity: string = '';
  @Prop @Watch('onDirectoryFocusContextChanged') directoryFocusContext: DetailDirectoryFocusContext = 'detail';
  @Prop loadingMessage: string = '';
  @Prop catalogBusy: boolean = false;
  isDetailActionCurrent: () => boolean = (): boolean => true;
  onContinue: () => void = (): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onOpenDirectory: () => void = (): void => {};
  onSwitchSource: (focusId?: string) => void = (): void => {};
  onRemove: (identity?: string) => void = (_identity?: string): void => {};
  onCancelAdd: (identity?: string) => void = (_identity?: string): void => {};
  onBack: () => void = (): void => {};
  @State private viewportWidth: number = 0;
  private viewportHeight: number = 0;
  @State private introExpanded: boolean = false;
  @State private introOverflow: boolean = false;
  @State private introMeasured: boolean = false;
  private introMeasuredWidth: number = 0;
  private introMeasurementGeneration: number = 0;
  private introMeasurementSignature: string = '';
  @State private collapsedGroups: number[] = [];
  @State private mangaPresentation: Map<number, MangaDirectoryRowPresentation> = new Map<number, MangaDirectoryRowPresentation>();
  @State private mangaPreviewRows: MangaDirectoryLayoutRow[] = [];
  private collapseIdentity: string = '';
  private collapseEntries: LocalReadingTocEntry[] = [];
  @State private mangaFontsReady: boolean = false;
  @State private dockRaisedShape: ReaderRaisedShape | undefined = undefined;
  @State private headerScrolled: boolean = false;
  private readonly detailScroller: Scroller = new Scroller();
  @State private mangaFontsFailed: boolean = false;
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private measurementKey: number = 0;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  private layoutBookIdentity: string = '';
  private readonly headerSpec: DetailHeaderSpec = detailHeaderSpec();
  private mounted: boolean = false;
  private pendingDirectoryFocus: string = '';
  private directoryFocusGeneration: number = 0;
  private mangaFontGeneration: number = 0;
  private mangaFontIdentity: string = '';
  private mangaFontTask: Promise<boolean> | undefined = undefined;

  aboutToAppear(): void {
    this.dockRaisedShape = undefined;
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.onBookChanged();
    this.onShelfMessageChanged();
  }

  aboutToDisappear(): void {
    this.transientFeedback.reset();
    this.mounted = false;
    this.cancelDirectoryFocusRestore();
    this.headerScrolled = false;
    this.layoutBookIdentity = '';
    this.measurements.clear();
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.mangaFontGeneration += 1;
    this.mangaFontTask = undefined;
    this.introMeasurementGeneration += 1;
    this.introMeasurementSignature = '';
  }

  @Builder
  private fontPreparationContent() {
    Column() {
      ReaderPageState({ loading: !this.mangaFontsFailed,
        title: this.mangaFontsFailed ? '详情暂时无法显示' : '正在准备详情…',
        actionLabel: this.mangaFontsFailed ? '重试' : '',
        onAction: (): void => this.prepareMangaDetailFonts() });
    }.width('100%').height('100%').justifyContent(FlexAlign.Center);
  }

  @Builder
  private detailContent() {
    if (this.book.contentKind !== 'manga' || this.mangaFontsReady) {
      this.detailScroll();
    } else {
      this.fontPreparationContent();
    }
  }

  @Builder
  private detailFooter() {
    if (this.book.contentKind !== 'manga' || this.mangaFontsReady) {
      this.actionArea();
    }
  }

  build() {
    // Keep the same Back action available while the manga body prepares its fonts.
    ReaderPageScaffold({
      frameStyle: this.frameStyle(),
      geometry: this.geometry,
      headerMeasurementKey: this.measurementKey,
      footerMeasurementKey: this.measurementKey,
      content: (): void => { this.detailContent(); },
      header: (): void => { this.detailHeader(); },
      onHeaderHeightChange: (height: number, presentedKey: number): void => {
        this.recordFrameHeight('detail:header', height, presentedKey);
      },
      onFooterHeightChange: (height: number, presentedKey: number): void => {
        this.recordFrameHeight('detail:dock', height, presentedKey);
      },
      footer: (): void => { this.detailFooter(); },
    })
      .onTouch((event: TouchEvent): void => {
        if (event.type === TouchType.Down && this.acceptsDetailInput()) this.cancelDirectoryFocusRestore();
      })
      .onKeyEvent((event: KeyEvent): void => {
        if (event.type === KeyType.Down && this.acceptsDetailInput()) this.cancelDirectoryFocusRestore();
      })
      .onAreaChange((_old: Area, area: Area): void => {
        if (!this.mounted) return;
        const width = readerPageAreaLength(area.width);
        const height = readerPageAreaLength(area.height);
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
        const widthChanged = Math.abs(this.viewportWidth - width) > .1;
        if (!widthChanged && Math.abs(this.viewportHeight - height) <= .1) return;
        this.viewportWidth = width;
        this.viewportHeight = height;
        this.invalidateFrame();
        if (widthChanged && this.book.contentKind === 'manga') this.prepareMangaPreview();
      });
  }

  @Builder
  private detailScroll(scrollIdentity: string = this.detailScrollIdentity()) {
    Scroll(this.book.contentKind === 'manga' ? undefined : this.detailScroller) {
      Column({ space: this.book.contentKind === 'manga' ? 0 : 24 }) {
        this.hero();
        this.readingFacts();
        this.summary();
        this.catalog();
        if (!this.detailBookAvailable()) {
          ReaderPageState({ title: '书籍已移出书架', message: this.shelfMessage || '请返回书架重新导入本地文件后继续阅读。' });
        }
      }.width(this.contentFrame().width).alignItems(HorizontalAlign.Start)
        .margin({ left: this.contentFrame().left, right: this.contentFrame().right })
        .padding({ top: this.geometry.content.startInset, bottom: this.geometry.content.endInset });
    }.width('100%').height('100%').scrollBar(this.book.contentKind === 'manga' ? BarState.Auto : BarState.Off)
      .scrollBarWidth(this.book.contentKind === 'manga' ? visual.scrollbarWidth : undefined)
      .scrollBarColor(this.book.contentKind === 'manga' ? mangaDirectoryColor('scrollbar', this.appThemeScheme) : undefined)
      .onDidScroll((): void => this.onDetailScroll(scrollIdentity));
  }

  private detailScrollIdentity(): string {
    return `${this.admissionIdentity}\u0000${this.book.sourceId}\u0000${this.book.bookId}`;
  }

  private directoryFocusKey(): string {
    return `reader-detail-directory:${JSON.stringify([this.admissionIdentity, this.book.sourceId, this.book.bookId])}`;
  }

  private detailBackFocusKey(): string { return sourceSwitchTriggerFocusId(this.book.sourceId, this.book.bookId, 'detail-back'); }

  private acceptsDetailInput(): boolean {
    return this.mounted && this.directoryFocusContext === 'detail' && this.isDetailActionCurrent();
  }

  private onDirectoryFocusContextChanged(): void {
    const generation = ++this.directoryFocusGeneration;
    if (!this.mounted) return;
    // An inactive interval cancels the frame, but preserves this directory's return target.
    if (this.directoryFocusContext === 'directory') this.pendingDirectoryFocus = this.directoryFocusKey();
    if (this.directoryFocusContext !== 'detail') {
      this.transientFeedback.reset();
      return;
    }
    if (this.pendingDirectoryFocus.length > 0) this.restoreDirectoryFocus(generation, this.pendingDirectoryFocus, true);
  }

  private onDirectoryFocusIdentityChanged(): void {
    if (this.pendingDirectoryFocus.length > 0 && this.pendingDirectoryFocus !== this.directoryFocusKey()) {
      this.cancelDirectoryFocusRestore();
    }
  }

  private cancelDirectoryFocusRestore(): void {
    if (this.pendingDirectoryFocus.length === 0) return;
    this.pendingDirectoryFocus = '';
    this.directoryFocusGeneration += 1;
  }

  private restoreDirectoryFocus(generation: number, target: string, canRetry: boolean): void {
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new DetailDirectoryFocusFrame((): void => {
        if (!this.acceptsDetailInput() || generation !== this.directoryFocusGeneration ||
          target !== this.pendingDirectoryFocus || target !== this.directoryFocusKey()) return;
        if (!this.removing) {
          try {
            context.getFocusController().requestFocus(target);
            this.pendingDirectoryFocus = '';
            return;
          } catch (_unavailableTarget) {
            if (canRetry) { this.restoreDirectoryFocus(generation, target, false); return; }
          }
        }
        this.pendingDirectoryFocus = '';
        try { context.getFocusController().requestFocus(this.detailBackFocusKey()); } catch (_unavailableBack) {}
      }));
    } catch (_unmounted) {}
  }

  private onDetailScroll(identity: string): void {
    if (!this.mounted || this.book.contentKind === 'manga' || identity !== this.detailScrollIdentity()) return;
    const offset = this.detailScroller.currentOffset().yOffset;
    if (!Number.isFinite(offset)) return;
    const scrolled = offset > this.headerSpec.scrollThreshold;
    if (scrolled !== this.headerScrolled) this.headerScrolled = scrolled;
  }

  @Builder
  private detailHeader() {
    PageBackBar({ title: '书籍详情', floating: true,
      elevation: this.book.contentKind === 'manga' ? 'fixed' : 'raised',
      material: this.book.contentKind === 'manga' ? 'solid' : 'veil',
      scrolled: this.book.contentKind !== 'manga' && this.headerScrolled, centered: true,
      variant: this.book.contentKind === 'manga' ? 'mangaDirectory' : 'standard',
      backFocusId: this.detailBackFocusKey(),
      onBack: (): void => this.onBack() });
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
        Image(this.displayCoverUrl() as string).width(visual.heroWidth).height(visual.heroHeight)
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
          if (this.book.sourceId !== 'local') {
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Text('换源').constraintSize({ minHeight: 30 }).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
                .fontWeight(visual.bodyFontWeight).fontSize(visual.heroSourceFontSize).lineHeight(visual.heroSourceLineHeight)
                .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).halfLeading(true)
                .fontColor(mangaDirectoryColor('accent', this.appThemeScheme));
            }.padding(0).backgroundColor(Color.Transparent).borderRadius(0).constraintSize({ minHeight: 30 })
              .id(sourceSwitchTriggerFocusId(this.book.sourceId, this.book.bookId, 'detail-source'))
              .opacity(this.sourceSwitchEnabled ? 1 : visual.disabledOpacity)
              .attributeModifier(new ReaderActionAccessibility('换源', this.sourceSwitchEnabled, false, true,
                new MangaDirectoryPressFeedback(this.sourceSwitchEnabled, true, this.appThemeScheme, 'nativeButton'), 'nativeButton'))
              .onClick((): void => { if (this.sourceSwitchEnabled) this.onSwitchSource(sourceSwitchTriggerFocusId(this.book.sourceId, this.book.bookId, 'detail-source')); });
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
        Image(this.displayCoverUrl() as string).width(84).height(122).objectFit(ImageFit.Cover).borderRadius(8);
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
      }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start)
        .padding({ top: this.headerSpec.contentGap + this.headerSpec.contentUnderlap });
    }.width('100%').constraintSize({ minHeight: 122 + this.headerSpec.contentGap + this.headerSpec.contentUnderlap })
      .alignItems(VerticalAlign.Top);
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
          if (this.book.sourceId !== 'local') {
            Button({ type: ButtonType.Normal, stateEffect: false }) {
              Text('换源').height(32).padding({ left: 12, right: 12 }).fontSize(12)
                .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
                .backgroundColor(readerAppColor('TOK_SETTING_ACTION_BG', this.appThemeScheme)).borderRadius(10)
                .textAlign(TextAlign.Center);
            }.height(32).padding(0).backgroundColor(Color.Transparent).borderRadius(10)
              .id(sourceSwitchTriggerFocusId(this.book.sourceId, this.book.bookId, 'detail-source'))
              .opacity(this.sourceSwitchEnabled ? 1 : 0.4)
              .attributeModifier(new ReaderActionAccessibility('换源', this.sourceSwitchEnabled, false, true, undefined, 'nativeButton'))
              .onClick((): void => { if (this.sourceSwitchEnabled) this.onSwitchSource(sourceSwitchTriggerFocusId(this.book.sourceId, this.book.bookId, 'detail-source')); });
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
        .fontWeight(visual.bodyFontWeight).fontSize(visual.introBodyFontSize).lineHeight(visual.introBodyLineHeight).halfLeading(false).wordBreak(WordBreak.BREAK_WORD)
        .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
        .fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).margin({ top: visual.introBodyTop })
        .maxLines(this.introExpanded || !this.introMeasured ? 10000 : 3).textOverflow({ overflow: TextOverflow.Ellipsis })
        .onAreaChange((_old: Area, area: Area): void => {
          const width = readerPageAreaLength(area.width);
          if (Number.isFinite(width) && width > 0 && Math.abs(width - this.introMeasuredWidth) > .1) {
            this.introMeasuredWidth = width; this.measureIntro();
          }
        });
      if (this.introOverflow) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Row({ space: visual.sectionActionGap }) {
            Text(this.introExpanded ? '收起' : '展开').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
              .fontWeight(visual.bodyFontWeight).fontSize(visual.sectionActionFontSize).lineHeight(visual.sectionActionLineHeight)
              .halfLeading(true).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
              .fontColor(mangaDirectoryColor('accent', this.appThemeScheme));
            Image(this.appThemeScheme === 'night' ? $r('app.media.manga_directory_chevron_down_accent_theme_night') : $r('app.media.manga_directory_chevron_down_accent'))
              .width(visual.sectionActionIcon).height(visual.sectionActionIcon).rotate({ angle: this.introExpanded ? 180 : 0 });
          }.constraintSize({ minHeight: visual.sectionActionHeight });
        }.padding(0).backgroundColor(Color.Transparent).borderRadius(0)
          .constraintSize({ minHeight: visual.sectionActionHeight }).margin({ top: visual.introExpandTop })
          .attributeModifier(new ReaderActionAccessibility(this.introExpanded ? '收起简介' : '展开简介', true, false, true,
            new MangaDirectoryPressFeedback(true, true, this.appThemeScheme, 'nativeButton'), 'nativeButton'))
          .onClick((): void => this.toggleIntro());
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
        .fontWeight(400).fontSize(13).lineHeight(24).halfLeading(false).wordBreak(WordBreak.BREAK_WORD).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(this.introExpanded || !this.introMeasured ? 10000 : 3).textOverflow({ overflow: TextOverflow.Ellipsis })
        .onAreaChange((_old: Area, area: Area): void => {
          const width = readerPageAreaLength(area.width);
          if (Number.isFinite(width) && width > 0 && Math.abs(width - this.introMeasuredWidth) > .1) {
            this.introMeasuredWidth = width; this.measureIntro();
          }
        });
      if (this.introOverflow) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Text(this.introExpanded ? '收起' : '展开').height(32).fontSize(12)
            .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
        }.height(32).padding(0).backgroundColor(Color.Transparent).borderRadius(0)
          .attributeModifier(new ReaderActionAccessibility(this.introExpanded ? '收起简介' : '展开简介', true, false, true, undefined, 'nativeButton'))
          .onClick((): void => this.toggleIntro());
      }
    }.width('100%').alignItems(HorizontalAlign.Start);
  }

  private toggleIntro(): void {
    if (this.acceptsDetailInput() && this.introOverflow) this.introExpanded = !this.introExpanded;
  }

  @Builder
  private catalog() {
    Column() {
      if (this.book.contentKind === 'manga') {
        this.mangaCatalogHeading();
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
        this.standardCatalogHeading();
        ForEach(this.visibleToc(), (entry: LocalReadingTocEntry) => {
          this.chapterPreviewRow(entry);
        }, (entry: LocalReadingTocEntry): string => JSON.stringify([this.book.sourceId, this.book.bookId,
          entry.index, entry.title, entry.level ?? null, entry.navigable ?? null]));
      }
      if (this.toc.length === 0) {
        ReaderPageState({ title: this.chapterEmptyMessage(), loading: this.catalogLoading() })
          .padding({ top: 24, bottom: 24 });
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
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: visual.sectionActionGap }) {
          Text('完整目录').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
            .fontSize(visual.sectionActionFontSize).lineHeight(visual.sectionActionLineHeight).halfLeading(true)
            .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
            .fontColor(mangaDirectoryColor('accent', this.appThemeScheme));
          Image(this.appThemeScheme === 'night' ? $r('app.media.manga_directory_chevron_right_accent_theme_night') : $r('app.media.manga_directory_chevron_right_accent'))
            .width(visual.sectionActionIcon).height(visual.sectionActionIcon);
        }.constraintSize({ minHeight: visual.sectionActionHeight });
      }.padding(0).backgroundColor(Color.Transparent).borderRadius(0)
        .constraintSize({ minHeight: visual.sectionActionHeight }).flexShrink(0)
        .id(this.directoryFocusKey())
        .attributeModifier(new ReaderActionAccessibility('完整目录', !this.removing, false, true,
          new MangaDirectoryPressFeedback(!this.removing, true, this.appThemeScheme, 'nativeButton'), 'nativeButton'))
        .onClick((): void => { if (!this.removing) this.onOpenDirectory(); });
    }.width('100%').margin({ bottom: visual.sectionBottom }).alignItems(VerticalAlign.Center);
  }

  @Builder
  private standardCatalogHeading() {
      Row({ space: 8 }) {
        Text('目录').fontSize(15).fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
        Text(`${this.toc.filter((entry: LocalReadingTocEntry): boolean => entry.navigable !== false).length} 个可读条目`)
          .layoutWeight(1).fontSize(11).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        ReaderLabeledIconAction({ specId: 'detail-directory', label: '完整目录', scheme: this.appThemeScheme,
          icon: this.appThemeScheme === 'night' ? $r('app.media.book_detail_directory_theme_night') :
            $r('app.media.book_detail_directory'),
          focusId: this.directoryFocusKey(), actionEnabled: !this.removing,
          onAction: (): void => { if (!this.removing) this.onOpenDirectory(); } });
      }.width('100%').constraintSize({ minHeight: 44 });
  }

  @Builder
  private chapterPreviewRow(entry: LocalReadingTocEntry) {
    ReaderDirectoryChapterRow({ variant: 'detail-preview', entry,
      previewNested: this.chapterPreviewNested(entry), previewGroupCollapsed: this.collapsedGroups.includes(entry.index),
      previewEnabled: !this.removing && this.detailBookAvailable(),
      canActOnEntry: (candidate: LocalReadingTocEntry): boolean => this.canActOnChapterPreview(candidate),
      onSelectChapter: (index: number): void => this.onSelectChapter(index),
      onTogglePreviewGroup: (index: number): void => {
        this.collapsedGroups = this.collapsedGroups.includes(index) ?
          this.collapsedGroups.filter((candidate: number): boolean => candidate !== index) : [...this.collapsedGroups, index];
      },
    });
  }

  private canActOnChapterPreview(entry: LocalReadingTocEntry): boolean {
    if (!this.acceptsDetailInput() || this.removing || this.book.contentKind === 'manga' || !this.detailBookAvailable()) return false;
    const current = this.toc.find((row: LocalReadingTocEntry): boolean => row.index === entry.index);
    return current !== undefined && current.title === entry.title && current.level === entry.level &&
      current.navigable === entry.navigable;
  }

  @Builder
  private actionArea() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.actionSurface();
    }.width('100%').clip(false);
  }

  private dockAreaChangeHandler(presentedKey: number): (_old: Area, next: Area) => void {
    const identity = this.dockShapeIdentity();
    return (_old: Area, next: Area): void => {
      if (!this.mounted || presentedKey !== this.measurementKey || identity !== this.dockShapeIdentity()) return;
      const width = readerPageAreaLength(next.width);
      const height = readerPageAreaLength(next.height);
      const shape = resolveReaderRaisedShape(identity, width, height, this.dockRequestedRadius());
      if (shape === undefined) return;
      const previous = this.dockRaisedShape;
      if (previous?.identity === identity && Math.abs(width - previous.width) <= .1 && Math.abs(height - previous.height) <= .1) return;
      this.dockRaisedShape = shape;
    };
  }

  private dockShapeIdentity(): string {
    return JSON.stringify(['detail-dock', this.measurementKey, this.book.sourceId, this.book.bookId, this.book.contentKind]);
  }
  private dockRequestedRadius(): number { return this.book.contentKind === 'manga' ? visual.detailDockRadius : 24; }
  private currentDockShape(): ReaderRaisedShape | undefined { return this.mounted ? this.dockRaisedShape : undefined; }
  private dockNativeShape(): ReaderRaisedShape | undefined {
    return this.currentDockShape() ?? resolveReaderRaisedShape(this.dockShapeIdentity(), this.liveWidth(),
      this.book.contentKind === 'manga' ? visual.detailDockHeight : DETAIL_DOCK_HEIGHT, this.dockRequestedRadius());
  }

  @Builder
  private actionSurface() {
    // Measure the 48vp action row independently from the 68vp painted dock;
    // horizontal insets must not shrink its vertical button bounds.
    Stack({ alignContent: Alignment.Center }) {
      Row({ space: this.book.contentKind === 'manga' ? visual.detailDockGap : 12 }) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(this.readingActionLabel()).width('100%').height(this.book.contentKind === 'manga' ? undefined : 48)
          .constraintSize({ minHeight: this.book.contentKind === 'manga' ? visual.detailActionMinHeight : 48 })
          .padding({ left: this.book.contentKind === 'manga' ? 16 : 0, right: this.book.contentKind === 'manga' ? 16 : 0 }).fontFamily(this.book.contentKind === 'manga' ? READER_FONT_NOTO_SANS_SC_UI_600 : 'ReaderNotoSansSCUIBold')
          .fontSize(this.book.contentKind === 'manga' ? visual.detailPrimaryFontSize : 14)
          .lineHeight(this.book.contentKind === 'manga' ? visual.detailPrimaryLineHeight : undefined)
          .minFontScale(this.book.contentKind === 'manga' ? Math.min(1, this.mangaFontScale()) : 0)
          .maxFontScale(this.book.contentKind === 'manga' ? Math.max(1, this.mangaFontScale()) : 2)
          .halfLeading(this.book.contentKind === 'manga')
          .fontWeight(this.book.contentKind === 'manga' ? visual.groupFontWeight : FontWeight.Bold)
          .fontColor(this.detailColor('TOK_ON_PRIMARY', 'onGreen'))
          .textAlign(TextAlign.Center).backgroundColor(this.detailColor('TOK_PRIMARY_DARK', 'green')).borderRadius(this.book.contentKind === 'manga' ? visual.detailActionRadius : 16);
        }.layoutWeight(1).height(this.book.contentKind === 'manga' ? undefined : 48)
          .constraintSize({ minHeight: this.book.contentKind === 'manga' ? visual.detailActionMinHeight : 48 })
          .padding(0).backgroundColor(Color.Transparent).borderRadius(this.book.contentKind === 'manga' ? visual.detailActionRadius : 16)
          .opacity(this.removing || !this.detailBookAvailable() ? (this.book.contentKind === 'manga' ? visual.disabledOpacity : 0.5) : 1)
          .attributeModifier(new ReaderActionAccessibility(this.readingActionLabel(), !this.removing && this.detailBookAvailable(), false, true,
            new MangaDirectoryPressFeedback(!this.removing && this.detailBookAvailable(), this.book.contentKind === 'manga', this.appThemeScheme, 'nativeButton'), 'nativeButton'))
          .onClick((): void => { if (!this.removing && this.detailBookAvailable()) this.onContinue(); });
        ForEach([this.admissionIdentity], (identity: string) => {
        Stack({ alignContent: Alignment.Center }) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
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
          .textAlign(TextAlign.Center).fontColor(this.removing || this.cancellingAdd ? Color.Transparent : this.detailColor(this.inBookshelf ? 'TOK_MUTED' : 'TOK_GREEN',
            this.book.contentKind === 'manga' ? 'muted' : this.inBookshelf ? 'muted' : 'accent'))
          .backgroundColor(this.detailColor('TOK_SURFACE_PANEL_SOFT', 'soft')).borderRadius(this.book.contentKind === 'manga' ? visual.detailActionRadius : 16)
          .border({ width: 1, color: this.detailColor('TOK_LINE', 'line') });
        }.width(this.book.contentKind === 'manga' ? visual.detailSecondaryWidth : 94)
          .height(this.book.contentKind === 'manga' ? undefined : 48)
          .constraintSize({ minHeight: this.book.contentKind === 'manga' ? visual.detailActionMinHeight : 48 })
          .padding(0).backgroundColor(Color.Transparent).borderRadius(this.book.contentKind === 'manga' ? visual.detailActionRadius : 16)
          .opacity(this.removalEnabled && !this.removing && !this.cancellingAdd && this.detailBookAvailable() ? 1 : this.book.contentKind === 'manga' ? visual.disabledOpacity : 0.4)
          .attributeModifier(new ReaderActionAccessibility(this.shelfActionLabel(),
            this.removalEnabled && !this.removing && !this.cancellingAdd && this.detailBookAvailable(), false, true,
            new MangaDirectoryPressFeedback(this.removalEnabled && !this.removing && !this.cancellingAdd && this.detailBookAvailable(), this.book.contentKind === 'manga', this.appThemeScheme, 'nativeButton'), 'nativeButton'))
          .onClick((): void => {
            if (this.removalEnabled && !this.removing && !this.cancellingAdd && this.detailBookAvailable()) {
              if (this.adding) this.onCancelAdd(identity); else this.onRemove(identity);
            }
          });
          if (this.removing || this.cancellingAdd) {
            LoadingProgress().width(18).height(18).color(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme));
          }
        }
        }, (identity: string): string => identity);
      }.width('100%').height(this.book.contentKind === 'manga' ? undefined : 48)
        .constraintSize({ minHeight: this.book.contentKind === 'manga' ? visual.detailActionMinHeight : 48 }).alignItems(VerticalAlign.Center);
    // The design dock reserves 9vp on every side. The viewport-bottom owner
    // aligns this entire 68vp surface; this Stack centers the 48vp row inside
    // the painted capsule and must not apply a second bottom alignment.
    }.width('100%').height(this.book.contentKind === 'manga' ? undefined : DETAIL_DOCK_HEIGHT)
      .constraintSize({ minHeight: this.book.contentKind === 'manga' ? visual.detailDockHeight : DETAIL_DOCK_HEIGHT })
      .padding(this.book.contentKind === 'manga' ? visual.detailDockPadding : 9)
      .attributeModifier(new ReaderPanelFrame('floating-action-dock', this.appThemeScheme, false, this.dockNativeShape()))
      .onAreaChange(this.dockAreaChangeHandler(this.measurementKey));
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
      if (ready) this.measureIntro();
    }).catch((_error: Error): void => {
      if (!this.mounted || generation !== this.mangaFontGeneration || identity !== this.mangaFontIdentity || this.book.contentKind !== 'manga') return;
      this.mangaFontTask = undefined;
      this.mangaFontsFailed = true;
    });
  }

  private recordFrameHeight(slot: string, height: number, key: number): void {
    if (!this.mounted || key !== this.measurementKey || height <= 0) return;
    if (!this.measurements.record(slot, height, key, .1)) return;
    this.refreshGeometry();
  }

  private invalidateFrame(): void {
    this.measurementKey += 1;
    this.refreshGeometry();
  }

  private frameStyle(): ReaderFrameStyle {
    const manga = this.book.contentKind === 'manga';
    const pageBackground = manga ? mangaDirectoryColor('paper', this.appThemeScheme) :
      readerAppColor('TOK_PAPER', this.appThemeScheme);
    return readerFrameStyle({ backgroundColor: pageBackground, alignment: 'top',
      headerBackground: pageBackground, headerTransparent: true, footerBackground: pageBackground });
  }

  private refreshGeometry(): void {
    const metrics = ReaderWindowCoordinator.metrics();
    const manga = this.book.contentKind === 'manga';
    const minimumDockHeight = manga ? visual.detailDockHeight : DETAIL_DOCK_HEIGHT;
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.liveWidth();
    input.viewportHeight = this.viewportHeight;
    input.measurementRevision = this.measurementKey;
    input.headerTop = this.headerSpec.headerTop(readerInteractiveSafeTop(metrics));
    const minimumHeaderHeight = manga ? mangaDirectoryHeaderHeight(this.mangaFontScale()) : this.headerSpec.barHeight;
    input.headerHeight = Math.max(minimumHeaderHeight, this.measurements.readForGeneration('detail:header', this.measurementKey, minimumHeaderHeight));
    input.headerInsetLeft = Math.max(8, this.safeLeft());
    input.headerInsetRight = Math.max(8, this.safeRight());
    input.footerBottom = readerInteractiveSafeBottom(metrics) + (manga ? visual.detailDockBottom : DETAIL_DOCK_BOTTOM_GAP);
    input.footerHeight = Math.max(minimumDockHeight, this.measurements.readForGeneration('detail:dock', this.measurementKey, minimumDockHeight));
    input.contentGap = manga ? visual.contentTop - visual.headerHeight - this.headerSpec.topGap : this.headerSpec.contentGap;
    input.contentUnderlap = manga ? 0 : this.headerSpec.contentUnderlap;
    input.contentMaxWidth = manga ? visual.contentWidthMax : TOK_CONTENT_MAX_W_TABLET;
    input.contentHorizontalPadding = manga ? 20 : 18;
    input.contentEndInset = input.footerBottom + input.footerHeight + (manga ? visual.detailDockClearance : DETAIL_DOCK_CONTENT_GAP);
    const geometry = resolveReaderPageGeometry(input);
    if (manga) {
      const expansion = visual.contentPaddingX - visual.headerInsetX;
      geometry.header.insetLeft = Math.max(0, geometry.content.frame.left - expansion);
      geometry.header.insetRight = Math.max(0, geometry.content.frame.right - expansion);
    }
    const dock = this.dockFrame(geometry.content.frame);
    geometry.footer.insetLeft = dock.left;
    geometry.footer.insetRight = dock.right;
    this.geometry = geometry;
  }

  private contentFrame(): SurfaceHorizontalFrame {
    return this.geometry.content.frame;
  }
  private dockFrame(content: SurfaceHorizontalFrame = this.contentFrame()): SurfaceHorizontalFrame {
    if (this.book.contentKind !== 'manga') {
      const inset = Math.min(TOK_SPACE_SM, content.width / 2);
      return new SurfaceHorizontalFrame(content.left + inset, content.right + inset, content.width - 2 * inset);
    }
    return resolveHorizontalFrame(this.liveWidth(), this.safeLeft(), this.safeRight(),
      new SurfaceWidthSpec(visual.contentWidthMax - 2 * (visual.detailDockInset - visual.contentPaddingX),
        visual.detailDockInset, visual.detailDockInset, 'center'));
  }
  private liveWidth(): number {
    if (this.viewportWidth > 0) return this.viewportWidth;
    return this.readerWindowMetricsRevision < 0 ? 0 : ReaderWindowCoordinator.metrics().windowRect.width;
  }
  private safeLeft(): number { return readerVisualSafeLeft(ReaderWindowCoordinator.metrics()); }
  private safeRight(): number { return readerVisualSafeRight(ReaderWindowCoordinator.metrics()); }
  private displayIntro(): string { return bookIntroText(this.book.intro); }
  private measureIntro(): void {
    if (!this.mounted || this.book === undefined || (this.book.contentKind === 'manga' && !this.mangaFontsReady)) return;
    const text = this.displayIntro();
    const width = this.introMeasuredWidth > 0 ? this.introMeasuredWidth : this.contentFrame().width;
    const context = this.getUIContext();
    let vpUnit: number;
    let fpUnit: number;
    try { vpUnit = context.px2vp(1); fpUnit = context.fp2px(1); }
    catch (_) {
      this.introOverflow = false; this.introMeasured = false; this.introMeasurementSignature = '';
      return;
    }
    const signature = JSON.stringify([this.book.sourceId, this.book.bookId, text, width,
      this.mangaFontScale(), this.book.contentKind === 'manga' ? READER_FONT_NOTO_SANS_SC_UI_REGULAR : 'ReaderNotoSansSC', visual.introBodyFontSize,
      visual.introBodyLineHeight, vpUnit, fpUnit, this.mangaFontGeneration]);
    if (signature === this.introMeasurementSignature) return;
    this.introMeasurementSignature = signature;
    const generation = ++this.introMeasurementGeneration;
    if (text.length === 0) {
      this.introExpanded = false;
      this.introOverflow = false;
      this.introMeasured = true;
      return;
    }
    // MeasureUtils and Text receive the same fp font/line height, family,
    // weight and word-break. Width is explicitly vp; returned heights are px.
    // Comparing two platform layouts accounts for glyph leading and newlines
    // without estimating character widths or multiplying the system scale.
    const options: MeasureOptions = { textContent: text, constraintWidth: `${width}vp`,
      fontFamily: this.book.contentKind === 'manga' ? READER_FONT_NOTO_SANS_SC_UI_REGULAR : 'ReaderNotoSansSC', fontSize: `${visual.introBodyFontSize}fp`,
      lineHeight: `${visual.introBodyLineHeight}fp`, fontWeight: visual.bodyFontWeight,
      wordBreak: WordBreak.BREAK_WORD, overflow: TextOverflow.Ellipsis, maxLines: 10000 };
    // MeasureUtils is synchronous. Publish the completed receipt before the
    // first build or book update can paint an unmeasured, expanded synopsis.
    try {
      if (!this.mounted || (this.book.contentKind === 'manga' && !this.mangaFontsReady) || generation !== this.introMeasurementGeneration ||
        signature !== this.introMeasurementSignature) return;
      const measure = context.getMeasureUtils();
      const full = Number(measure.measureTextSize(options).height);
      options.maxLines = 3;
      const folded = Number(measure.measureTextSize(options).height);
      if (!Number.isFinite(full) || !Number.isFinite(folded) || full <= 0 || folded <= 0)
        throw new Error('DETAIL_INTRO_MEASURE_INVALID');
      if (!this.mounted || generation !== this.introMeasurementGeneration ||
        signature !== this.introMeasurementSignature) return;
      this.introOverflow = full > folded + .5;
      if (!this.introOverflow) this.introExpanded = false;
      this.introMeasured = true;
    } catch (_) {
      if (!this.mounted || generation !== this.introMeasurementGeneration ||
        signature !== this.introMeasurementSignature) return;
      // A measurement failure keeps the entire synopsis readable and hides
      // the unavailable action; the next content/geometry change can retry.
      this.introOverflow = false;
      this.introMeasured = false;
      this.introMeasurementSignature = '';
      hilog.warn(0xD003210, 'Reader', 'Detail synopsis platform measurement unavailable');
    }
  }
  private lastShelfFeedback: string = '';
  private onShelfMessageChanged(): void {
    if (!this.shelfMessage) { this.lastShelfFeedback = ''; return; }
    const current = (): boolean => this.mounted && this.directoryFocusContext === 'detail' && this.detailBookAvailable();
    if (!current() || this.shelfMessage === this.lastShelfFeedback) return;
    this.lastShelfFeedback = this.shelfMessage;
    this.transientFeedback.show(() => this.getUIContext(), { message: this.shelfMessage, duration: READER_FEEDBACK_BRIEF_MS }, current);
  }
  private catalogLoading(): boolean { return this.catalogBusy; }
  private chapterEmptyMessage(): string {
    return this.loadingMessage.trim() || (!this.readingEnabled ? this.readingBlockedReason.trim() : '') || '暂无章节信息';
  }
  private chapterPreviewNested(entry: LocalReadingTocEntry): boolean {
    return entry.navigable !== false && ((entry.level ?? 1) > 1 ||
      this.toc.slice(0, this.toc.indexOf(entry)).some((row: LocalReadingTocEntry): boolean => row.navigable === false));
  }
  private visibleToc(): LocalReadingTocEntry[] {
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
    this.onDirectoryFocusIdentityChanged();
    const layoutIdentity = `${this.book.sourceId}\u0000${this.book.bookId}\u0000${this.book.contentKind}`;
    if (this.mounted && this.layoutBookIdentity !== layoutIdentity) {
      if (!this.layoutBookIdentity.endsWith(`\u0000${this.book.contentKind}`)) this.measurements.clear();
      this.layoutBookIdentity = layoutIdentity;
      this.invalidateFrame();
    }
    if (this.mounted) this.onMangaFontIdentityChanged();
    const identity = `${this.book.sourceId}\u0000${this.book.bookId}`;
    if (identity === this.collapseIdentity) { this.prepareMangaPreview(); this.measureIntro(); return; }
    this.headerScrolled = false;
    this.introExpanded = false;
    this.introMeasuredWidth = 0;
    this.introMeasurementSignature = '';
    this.collapseIdentity = identity;
    this.collapsedGroups = [];
    this.collapseEntries = this.toc.map((entry: LocalReadingTocEntry): LocalReadingTocEntry => ({
      index: entry.index, title: entry.title, level: entry.level, navigable: entry.navigable, downloadState: entry.downloadState }));
    this.prepareMangaPreview();
    this.measureIntro();
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
    if (!this.mounted) return;
    this.invalidateFrame();
    if (this.book !== undefined && this.book.contentKind === 'manga') this.prepareMangaPreview();
    this.introMeasuredWidth = 0;
    this.measureIntro();
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
    return previousEntry === undefined || (previousEntry.contextTitle ?? this.mangaPresentation.get(previousEntry.index)?.contextTitle) !==
      (row.entries[0]?.contextTitle ?? this.mangaPresentation.get(row.entries[0]?.index)?.contextTitle);
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
    if (!this.detailBookAvailable()) return '请重新导入';
    if (this.book.contentKind === 'manga') return this.book.mangaPosition === undefined ? '开始阅读' : '继续阅读';
    return this.inBookshelf ? '继续阅读' : '开始阅读';
  }
  private shelfActionLabel(): string {
    if (this.cancellingAdd) return '取消加入';
    if (this.adding) return '取消加入';
    if (this.removing) return this.inBookshelf ? '移除书架' : '加入书架';
    if (!this.detailBookAvailable()) return '已移除';
    return this.inBookshelf ? '移除书架' : '加入书架';
  }
  private detailBookAvailable(): boolean { return this.book.sourceId !== 'local' || this.inBookshelf; }
  private displayCoverUrl(): string | undefined { return bookCoverDisplayUrl(this.book.displayCoverUrl) ?? bookCoverDisplayUrl(this.book.coverUrl); }

  private hasCover(): boolean { return this.displayCoverUrl() !== undefined; }
}
