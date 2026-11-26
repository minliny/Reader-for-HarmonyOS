import { readerIsExpandedWidth } from '../../../ui/foundation/ReaderWidthClass';
import { readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { ReaderActionMenuSurface, ReaderMenuActionView } from '../../../ui/surfaces/ReaderActionMenuSurface';
import { ReaderIconButton } from '../../../ui/controls/ReaderIconButton';
import { readerActionIcon } from '../../../ui/foundation/ReaderActionIconResources';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { readerPressAnimation, readerPressOpacity, readerPressPointer, readerPressScale } from '../../../ui/foundation/ReaderPressMotion';
import { motionAnimateParam, readerMotionStandardCurve } from '../../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { detailChapterPreview } from '../presentation/DetailChapterPreview';
import { sourceSwitchTriggerFocusId } from '../../source/presentation/SourceSwitchSurfaceLifecycle';
import { FrameCallback } from '@kit.ArkUI';
import { ReaderTransientFeedback, READER_FEEDBACK_BRIEF_MS } from '../../../ui/feedback/ReaderTransientFeedback';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { READER_ACTION_MIN_TARGET, ReaderActionAccessibility } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import type { MeasureOptions } from '@ohos.measure';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { bookCoverDisplayUrl } from '../../../app/library/BookCoverDisplay';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput,
  resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryScale, mangaDirectoryColor, mangaDirectoryHeaderHeight } from '../../manga/ui/MangaDirectoryVisual';
import { TYPE_APP_PRIMARY_ACTION, TYPE_APP_ROW_DETAIL, TYPE_APP_SEGMENT_LABEL, TYPE_CARD_SECTION_HEADING, TYPE_BOOK_DETAIL_WIDE_TITLE, TYPE_BOOK_DETAIL_SUMMARY, TYPE_BOOK_DETAIL_TAG, TYPE_READER_PANEL_LABEL, TYPE_READER_PANEL_META, TYPE_APP_COMPACT_BADGE, TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_APP_INHERITED_BODY, TYPE_BOOK_DETAIL_ACTION, TYPE_BOOK_DETAIL_AUTHOR, TYPE_BOOK_DETAIL_DESCRIPTION, TYPE_BOOK_DETAIL_EMPTY, TYPE_BOOK_DETAIL_META, TYPE_BOOK_DETAIL_SOURCE_ACTION, TYPE_BOOK_DETAIL_TITLE, TYPE_BOOK_DIRECTORY_ENTRY } from '../../../ui/foundation/ReaderTypography';
import { bookAuthorLabel } from '../../../app/library/BookAuthorMetadata';
import { readerAppColor, type ReaderAppColorRole } from '../../../ui/foundation/ReaderThemeRegistry';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../../../ui/layout/ReaderRaisedShape';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderLabeledIconAction } from '../../../ui/controls/ReaderLabeledIconAction';
import type { ReadingBookDetail } from '../presentation/ReadingBookDetail';
import { common } from '@kit.AbilityKit';
import { ReaderDocumentSaveHost, type ReaderDocumentSaveResult } from '../../../platform/share/ReaderDocumentSaveHost';
import { readerCanShareOriginal, readerOriginalBookExtension, type ReaderShareResult, type RetainedShareFile } from '../application/ReaderShareActions';
import { readerDocumentSaveMessage, readerShareMessage, readerSystemShareActions } from './ReaderSharePresentation';
import { bookIntroText } from '../../../app/library/BookIntroText';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import type { ReaderNavigationPreferences } from '../../../app/HarmonyCapabilityPolicy';
import { ReaderUIVerificationProbe } from '../../../app/diagnostics/ReaderUIVerificationProbe';
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
  TOK_CONTENT_MAX_W_TABLET,
  TOK_SPACE_CARD_PADDING,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_MD,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../../../ui/foundation/ReaderTokens';

import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { NoCoverCover } from '../../../ui/patterns/NoCoverCover';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../../../ui/foundation/ReaderFontFamilies';
import { registerReaderFonts, prepareMangaSheetFonts } from '../../../ui/foundation/ReaderFonts';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { DetailHeaderSpec, detailHeaderSpec } from '../../../ui/foundation/ReaderHeaderSpecs';

const DETAIL_INFO_WIDTH = 228;
const DETAIL_COLUMN_GAP = 16;
const DETAIL_MENU_WIDTH = 184;
const DETAIL_DOCK_HEIGHT = 68;
const DETAIL_DOCK_BOTTOM_GAP = 12;
const DETAIL_DOCK_CONTENT_GAP = 24;
const DETAIL_SUMMARY_PADDING = 12;
const DETAIL_SUMMARY_BORDER = 1;

type DetailDirectoryFocusContext = 'detail' | 'directory' | 'inactive';

class DetailDirectoryFocusFrame extends FrameCallback {
  private readonly action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/** Shared detail presentation. Core facts decide the type and readable rows. */
@Component
export struct LocalBookDetail {
  private readonly transientFeedback: ReaderTransientFeedback = new ReaderTransientFeedback();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') @Watch('onShareForegroundChanged') private appForeground: boolean = true;
  @StorageProp('readerReduceMotion') private appReduceMotion: boolean = false;
  @StorageProp('readerNavigationAppearancePreferences') private navigationAppearance: ReaderNavigationPreferences = {
    override: 'unset', reduceTransparency: false,
  };
  @StorageLink('readerWindowMetricsRevision') @Watch('onMangaGeometryChanged') readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onBookChanged') book: ReadingBookDetail;
  @Prop @Watch('onTocChanged') toc: LocalReadingTocEntry[] = [];
  @Prop sourceSwitchEnabled: boolean = false;
  @Prop groupEnabled: boolean = false;
  @Prop downloadsEnabled: boolean = false;
  @Prop @Watch('refreshChapterPreview') currentChapterIndex: number = -1;
  @Prop readingEnabled: boolean = true;
  @Prop readingBlockedReason: string = '';
  @Prop @Watch('invalidateFrame') inBookshelf: boolean = true;
  @Prop removalEnabled: boolean = true;
  @Prop @Watch('invalidateFrame') removing: boolean = false;
  @Prop @Watch('invalidateFrame') adding: boolean = false;
  @Prop @Watch('invalidateFrame') cancellingAdd: boolean = false;
  @Prop @Watch('onShelfMessageChanged') shelfMessage: string = '';
  @Prop @Watch('onDirectoryFocusIdentityChanged') admissionIdentity: string = '';
  @Prop @Watch('onDirectoryFocusContextChanged') directoryFocusContext: DetailDirectoryFocusContext = 'detail';
  @Prop loadingMessage: string = '';
  @Prop catalogBusy: boolean = false;
  isDetailActionCurrent: () => boolean = (): boolean => true;
  retainedShareFile: RetainedShareFile | undefined = undefined;
  captureDocumentSave: (() => (() => boolean)) | undefined = undefined;
  onContinue: () => void = (): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onOpenDirectory: () => void = (): void => {};
  onRetryCatalog: () => void = (): void => {};
  onSwitchSource: (focusId?: string) => void = (): void => {};
  onOpenDownloads: () => void = (): void => {};
  onOpenGroup: (focusId: string) => void = (_focusId: string): void => {};
  onMoreBack: (handler: (() => boolean) | undefined, lease: string) => void =
    (_handler: (() => boolean) | undefined, _lease: string): void => {};
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
  @State private previewChapters: LocalReadingTocEntry[] = [];
  @State private detailPressedAction: string = '';
  private detailPressPointer: number = -1;
  @State private moreOpen: boolean = false;
  private moreLease: string = '';
  private moreRevision: number = 0;
  private shownBookIdentity: string = '';
  @State @Watch('invalidateFrame') private mangaFontsReady: boolean = false;
  @State private dockRaisedShape: ReaderRaisedShape | undefined = undefined;
  @State private headerScrolled: boolean = false;
  @State private failedCoverUrls: string[] = [];
  private readonly detailScroller: Scroller = new Scroller();
  @State private mangaFontsFailed: boolean = false;
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private measurementKey: number = 0;
  @State private footerMeasurementKey: number = 0;
  private headerInputs: string = '';
  private footerInputs: string = '';
  private geometryRevision: number = 0;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  private layoutBookIdentity: string = '';
  private readonly headerSpec: DetailHeaderSpec = detailHeaderSpec();
  private mounted: boolean = false;
  private shareGeneration: number = 0;
  @State private shareBusy: boolean = false;
  @State private savingOriginal: boolean = false;
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
    this.closeMore(false);
    this.clearDetailPress();
    this.retireShareAction();
    this.transientFeedback.reset();
    this.mounted = false;
    this.cancelDirectoryFocusRestore();
    this.headerScrolled = false;
    this.layoutBookIdentity = '';
    this.measurements.clear();
    this.headerInputs = '';
    this.footerInputs = '';
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
    if (!this.detailKindConfirmed()) {
      this.kindPreparationContent();
    } else if (this.book.contentKind !== 'manga' || this.mangaFontsReady) {
      if (this.wideDetail()) this.expandedDetail();
      else this.detailScroll();
    } else {
      this.fontPreparationContent();
    }
  }

  @Builder
  private detailFooter() {
    if (!this.wideDetail() && this.detailKindConfirmed() && (this.book.contentKind !== 'manga' || this.mangaFontsReady)) {
      this.actionArea();
    }
  }

  private detailKindConfirmed(): boolean {
    return this.book.contentKind === 'text' || this.book.contentKind === 'manga' ||
      (this.book.sourceId === 'local' && this.book.contentKind === undefined);
  }

  @Builder
  private kindPreparationContent() {
    ReaderPageState({ title: this.book.contentKind === 'audio' ? '暂不支持此类阅读' :
      this.catalogBusy ? '正在确认书籍类型…' : '书籍类型尚未确认',
      message: this.catalogBusy ? '' : this.loadingMessage || this.readingBlockedReason,
      loading: this.book.contentKind !== 'audio' && this.catalogBusy,
      actionLabel: this.book.contentKind === undefined && !this.catalogBusy ? '重试' : '',
      onAction: (): void => {
        if (this.acceptsDetailInput() && this.book.contentKind === undefined && !this.catalogBusy) this.onRetryCatalog();
      } }).width('100%').padding({ left: 18, right: 18, top: this.geometry.content.startInset });
  }

  build() {
    // Keep the same Back action available while the manga body prepares its fonts.
    Stack({ alignContent: Alignment.TopEnd }) {
    ReaderPageScaffold({
      frameStyle: this.frameStyle(),
      geometry: this.geometry,
      headerMeasurementKey: this.measurementKey,
      footerMeasurementKey: this.footerMeasurementKey,
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
      .id(ReaderUIVerificationProbe.enabled() ? 'reader-book-detail-verification' : '')
      .accessibilityLevel(this.moreOpen ? 'no-hide-descendants' : 'auto')
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
      });
      if (this.moreOpen) this.detailMoreMenu();
    }.width('100%').height('100%');
  }

  @Builder
  private detailScroll(scrollIdentity: string = this.detailScrollIdentity()) {
    Scroll(this.detailScroller) {
      Column({ space: 16 }) {
        this.hero();
        this.detailDocuments();
        if (!this.detailBookAvailable()) {
          ReaderPageState({ title: '书籍已移出书架', message: this.shelfMessage || '请返回书架重新导入本地文件后继续阅读。' });
        }
      }.width(this.contentFrame().width).alignItems(HorizontalAlign.Start)
        .margin({ left: this.contentFrame().left, right: this.contentFrame().right })
        .padding({ top: this.geometry.content.startInset, bottom: this.geometry.content.endInset });
    }.width('100%').height('100%').align(Alignment.Top).scrollBar(this.book.contentKind === 'manga' ? BarState.Auto : BarState.Off)
      .scrollBarWidth(this.book.contentKind === 'manga' ? visual.scrollbarWidth : undefined)
      .scrollBarColor(this.book.contentKind === 'manga' ? mangaDirectoryColor('scrollbar', this.appThemeScheme) : undefined)
      .onDidScroll((): void => this.onDetailScroll(scrollIdentity));
  }

  private wideDetail(): boolean { return readerIsExpandedWidth(this.liveWidth()); }

  @Builder
  private expandedDetail(scrollIdentity: string = this.detailScrollIdentity()) {
    Row({ space: DETAIL_COLUMN_GAP }) {
      Column() { this.pinnedInfoCard(); }
        .width(DETAIL_INFO_WIDTH).height('100%')
        .padding({ top: this.geometry.content.startInset, bottom: this.geometry.content.endInset });
      Scroll(this.detailScroller) {
        Column({ space: 16 }) {
          this.detailDocuments();
          if (!this.detailBookAvailable()) {
            ReaderPageState({ title: '书籍已移出书架', message: this.shelfMessage || '请返回书架重新导入本地文件后继续阅读。' });
          }
        }.width('100%').padding({ right: 4, top: this.geometry.content.startInset,
          bottom: this.geometry.content.endInset }).alignItems(HorizontalAlign.Start);
      }.layoutWeight(1).height('100%').align(Alignment.Top).scrollBar(BarState.Auto)
        .id('reader-detail-document-scroll')
        .onDidScroll((): void => this.onDetailScroll(scrollIdentity));
    }.width(this.contentFrame().width).height('100%')
      .alignItems(VerticalAlign.Top)
      .margin({ left: this.contentFrame().left, right: this.contentFrame().right });
  }

  @Builder
  private detailDocuments() {
    this.readingFacts();
    this.summary();
    this.catalog();
    if (this.book.contentKind !== 'manga' && this.detailBookAvailable()) this.shareActions();
  }

  @Builder
  private pinnedInfoCard() {
    Column({ space: 12 }) {
      Scroll() {
        Column({ space: 8 }) {
          this.detailCover(104, 142);
          Text(this.book.title).width('100%').maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
            .fontFamily(TYPE_BOOK_DETAIL_WIDE_TITLE.fontFamily).fontWeight(TYPE_BOOK_DETAIL_WIDE_TITLE.fontWeight).fontSize(TYPE_BOOK_DETAIL_WIDE_TITLE.fontSizeFp).lineHeight(TYPE_BOOK_DETAIL_WIDE_TITLE.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).textAlign(TextAlign.Center);
          Text(bookAuthorLabel(this.book.author)).width('100%').fontFamily(TYPE_APP_ROW_DETAIL.fontFamily).fontWeight(TYPE_APP_ROW_DETAIL.fontWeight).fontSize(TYPE_APP_ROW_DETAIL.fontSizeFp).lineHeight(TYPE_APP_ROW_DETAIL.lineHeightFp as number)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center)
            .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
          this.bookTags();
        }.width('100%').alignItems(HorizontalAlign.Center);
      }.width('100%').layoutWeight(1).align(Alignment.Top).scrollBar(BarState.Off)
        .id('reader-detail-info-card-content');
      Column({ space: 8 }) {
        this.pinnedAction(true);
        this.pinnedAction(false);
      }.width('100%').padding({ top: 12 })
        .border({ width: { top: 1 }, color: readerAppColor('TOK_LINE', this.appThemeScheme) });
    }.width(DETAIL_INFO_WIDTH).height('100%').padding(16)
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .borderRadius(18).border({ width: 1, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
      .shadow(readerSurfaceElevation('card', this.appThemeScheme)).id('reader-detail-info-card');
  }

  @Builder
  private pinnedAction(primary: boolean) {
    Stack() {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(primary ? this.readingActionLabel() : this.shelfActionLabel()).width('100%')
          .constraintSize({ minHeight: primary ? 40 : 36 })
          .fontFamily(TYPE_APP_PRIMARY_ACTION.fontFamily).fontWeight(TYPE_APP_PRIMARY_ACTION.fontWeight)
          .fontSize(TYPE_APP_PRIMARY_ACTION.fontSizeFp)
          .fontColor(!primary && (this.removing || this.cancellingAdd) ? Color.Transparent :
            readerAppColor(primary ? 'TOK_ON_PRIMARY' : 'TOK_INK', this.appThemeScheme))
          .scale(readerPressScale(this.detailPressedAction === (primary ? 'read' : 'shelf'), this.appReduceMotion))
          .opacity(readerPressOpacity(this.detailPressedAction === (primary ? 'read' : 'shelf'), this.appReduceMotion))
          .animation(readerPressAnimation(this.appReduceMotion))
          .attributeModifier(this.detailPaintFeedback(primary ? 'TOK_PRIMARY_DARK' : 'TOK_SURFACE_FIELD',
            999, primary ? 'read' : 'shelf', primary ? this.readingActionAvailable() : this.shelfActionAvailable()))
          .textAlign(TextAlign.Center).accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      }.width('100%').constraintSize({ minWidth: 44, minHeight: 44 })
        .padding(0).backgroundColor(Color.Transparent).borderRadius(999)
        .enabled(primary ? this.readingActionAvailable() : this.shelfActionAvailable())
        .opacity((primary ? this.readingActionAvailable() : this.shelfActionAvailable()) ? 1 : .45)
        .accessibilityText(primary ? this.readingActionLabel() : this.shelfActionLabel())
        .onTouch((event: TouchEvent): void => this.observeDetailPress(primary ? 'read' : 'shelf', event,
          primary ? this.readingActionAvailable() : this.shelfActionAvailable()))
        .onClick((): void => {
          if (!this.acceptsDetailInput()) return;
          if (primary && this.readingActionAvailable()) this.onContinue();
          if (!primary && this.shelfActionAvailable()) this.commitShelfAction(this.admissionIdentity);
        });
      if (!primary && (this.removing || this.cancellingAdd)) {
        LoadingProgress().width(18).height(18).color(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme))
          .enableLoading(this.appForeground && this.directoryFocusContext === 'detail' && !this.appReduceMotion)
          .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      }
    }.width('100%');
  }

  @Builder
  private shareActions() {
    Flex({ wrap: FlexWrap.Wrap }) {
      this.shareAction('分享书籍信息', 'book');
      this.shareAction('复制书籍信息', 'copy');
      if (this.retainedShareFile !== undefined && readerCanShareOriginal(this.book)) {
        this.shareAction('分享原文件', 'file');
        this.shareAction('保存原书', 'save');
      }
    }.width('100%');
  }

  @Builder
  private shareAction(label: string, action: 'book' | 'copy' | 'file' | 'save') {
    Button(label, { type: ButtonType.Normal, stateEffect: false })
      .constraintSize({ minWidth: READER_ACTION_MIN_TARGET, minHeight: READER_ACTION_MIN_TARGET })
      .padding({ left: 10, right: 10 })
      .fontFamily(TYPE_READER_PANEL_LABEL.fontFamily).fontWeight(TYPE_READER_PANEL_LABEL.fontWeight).fontSize(TYPE_READER_PANEL_LABEL.fontSizeFp)
      .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
      .id(`reader-detail-share-${action}`)
      .attributeModifier(new ReaderActionAccessibility(label, this.shareActionAvailable(), false, true,
        new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 999, 999, this.shareActionAvailable()), 'nativeButton'))
      .onClick((): void => {
        if (action === 'save') void this.saveOriginalBook();
        else void this.runShareAction(action);
      });
  }

  private shareActionAvailable(): boolean {
    return this.appForeground && !this.shareBusy && !this.savingOriginal && this.acceptsDetailInput() && this.detailBookAvailable();
  }

  private async saveOriginalBook(): Promise<void> {
    const book = this.book;
    const retained = this.retainedShareFile;
    const extension = readerOriginalBookExtension(book);
    if (!this.shareActionAvailable() || !readerCanShareOriginal(book) || retained === undefined || extension === undefined) return;
    const context = this.getUIContext().getHostContext() as common.UIAbilityContext | undefined;
    const identity = this.detailScrollIdentity();
    const routeCurrent = this.captureDocumentSave?.() ?? this.isDetailActionCurrent;
    const current = (): boolean => this.mounted && routeCurrent() && this.detailBookAvailable() &&
      this.detailScrollIdentity() === identity;
    this.savingOriginal = true;
    let result: ReaderDocumentSaveResult = 'failed';
    try {
      const path = await retained(book.bookId, current);
      if (context !== undefined && path !== undefined && current()) {
        result = await new ReaderDocumentSaveHost(context).saveOriginal(path, book.title, extension, current);
      }
    } catch (_) { /* The retained bytes were unavailable for this request. */ }
    finally { this.savingOriginal = false; }
    const message = readerDocumentSaveMessage(result, '原书');
    if (message !== undefined) this.transientFeedback.show(() => this.getUIContext(), { message }, current);
  }

  private async runShareAction(action: 'book' | 'copy' | 'file'): Promise<void> {
    if (!this.shareActionAvailable()) return;
    const identity = this.detailScrollIdentity();
    const generation = ++this.shareGeneration;
    const current = (): boolean => generation === this.shareGeneration && this.appForeground &&
      this.acceptsDetailInput() && this.detailBookAvailable() && this.detailScrollIdentity() === identity;
    const actions = readerSystemShareActions(() => this.getUIContext(), `reader-detail-share-${action}`);
    const book = this.book;
    const retained = this.retainedShareFile;
    this.shareBusy = true;
    try {
      let result: ReaderShareResult;
      switch (action) {
        case 'book': result = await actions.shareBook(book, current); break;
        case 'copy': result = actions.copyBook(book, current); break;
        case 'file':
          if (retained === undefined) return;
          result = await actions.shareFile(book, retained, current);
          break;
      }
      const message = readerShareMessage(result, action === 'copy' ? '已复制书籍信息' : undefined);
      if (message !== undefined) this.transientFeedback.show(() => this.getUIContext(), { message }, current);
    } finally {
      if (generation === this.shareGeneration) this.shareBusy = false;
    }
  }

  private retireShareAction(): void {
    this.shareGeneration += 1;
    this.shareBusy = false;
  }

  private onShareForegroundChanged(): void {
    if (!this.appForeground) {
      this.closeMore(false);
      this.retireShareAction();
    }
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
      this.closeMore(false);
      this.clearDetailPress();
      this.retireShareAction();
      this.transientFeedback.reset();
      return;
    }
    if (this.pendingDirectoryFocus.length > 0) this.restoreDirectoryFocus(generation, this.pendingDirectoryFocus, true);
  }

  private onDirectoryFocusIdentityChanged(): void {
    if (this.moreOpen && !this.moreLease.startsWith(`${this.detailScrollIdentity()}:`)) this.closeMore(false);
    this.clearDetailPress();
    this.retireShareAction();
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
    if (!this.mounted || identity !== this.detailScrollIdentity()) return;
    const offset = this.detailScroller.currentOffset().yOffset;
    if (!Number.isFinite(offset)) return;
    const scrolled = offset > this.headerSpec.scrollThreshold;
    if (scrolled !== this.headerScrolled) this.headerScrolled = scrolled;
  }

  @Builder
  private detailHeader() {
    PageBackBar({ title: '书籍详情', floating: true, elevation: 'raised', material: 'veil',
      scrolled: this.headerScrolled, centered: true, backFocusId: this.detailBackFocusKey(),
      trailing: (): void => { this.detailMoreTrigger(); },
      onBack: (): void => { if (this.moreOpen) this.closeMore(true); else this.onBack(); } });
  }

  @Builder
  private detailMoreTrigger() {
    ReaderIconButton({ icon: this.appThemeScheme === 'night' ? $r('app.media.rc_dots_theme_night') : $r('app.media.rc_dots'), specId: 'toolbar-standard',
      accessibilityLabel: '更多操作', focusId: this.moreFocusKey(), actionScope: this.admissionIdentity,
      actionEnabled: this.detailKindConfirmed() && this.acceptsDetailInput(),
      selectionState: this.moreOpen ? 'selected' : 'none',
      onTap: (): void => { if (this.moreOpen) this.closeMore(true); else this.openMore(); } });
  }

  private moreFocusKey(): string { return sourceSwitchTriggerFocusId(this.book.sourceId, this.book.bookId, 'detail-more'); }

  private openMore(): void {
    if (!this.acceptsDetailInput() || !this.detailKindConfirmed() || this.moreOpen) return;
    this.clearDetailPress();
    const revision = ++this.moreRevision;
    this.moreLease = `${this.detailScrollIdentity()}:${revision}`;
    this.moreOpen = true;
    this.onMoreBack((): boolean => {
      if (!this.moreOpen || revision !== this.moreRevision || !this.acceptsDetailInput()) return false;
      this.closeMore(true);
      return true;
    }, this.moreLease);
    const first = this.detailMenuActions().find((action: ReaderMenuActionView): boolean => action.enabled);
    if (first !== undefined) this.scheduleMoreFocus(revision, `${this.moreFocusKey()}-menu-item-${first.id}`);
  }

  private closeMore(restoreFocus: boolean): void {
    if (!this.moreOpen) return;
    const revision = ++this.moreRevision;
    this.moreOpen = false;
    this.onMoreBack(undefined, this.moreLease);
    this.moreLease = '';
    if (restoreFocus) this.scheduleMoreFocus(revision, this.moreFocusKey());
  }

  private scheduleMoreFocus(revision: number, id: string): void {
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new DetailDirectoryFocusFrame((): void => {
        if (!this.acceptsDetailInput() || revision !== this.moreRevision) return;
        try { context.getFocusController().requestFocus(id); } catch (_) {}
      }));
    } catch (_) {}
  }

  private detailMenuActions(): ReaderMenuActionView[] {
    return [
      new ReaderMenuActionView('source', '更换书源', this.sourceSwitchEnabled && !this.removing,
        this.appThemeScheme === 'night' ? $r('app.media.rc_switch_horizontal_theme_night') : $r('app.media.rc_switch_horizontal')),
      new ReaderMenuActionView('downloads', '缓存与下载', this.downloadsEnabled && !this.removing,
        readerActionIcon('download', this.appThemeScheme)),
      new ReaderMenuActionView('group', '编辑书籍分组', this.groupEnabled && !this.removing,
        readerActionIcon('folder', this.appThemeScheme)),
    ];
  }

  private chooseMoreAction(id: string): void {
    if (!this.moreOpen || !this.acceptsDetailInput() || this.removing) return;
    if (id === 'source' && this.sourceSwitchEnabled) {
      this.closeMore(false);
      this.onSwitchSource(this.moreFocusKey());
    } else if (id === 'downloads' && this.downloadsEnabled) {
      this.closeMore(false);
      this.onOpenDownloads();
    } else if (id === 'group' && this.groupEnabled) {
      this.closeMore(true);
      this.onOpenGroup(this.moreFocusKey());
    }
  }

  @Builder
  private detailMoreMenu() {
    Stack({ alignContent: Alignment.TopEnd }) {
      Column().width('100%').height('100%').opacity(.32)
        .backgroundColor(readerAppColor('app.scrim.select', this.appThemeScheme))
        .backdropBlur(this.navigationAppearance.reduceTransparency ? 0 : 6)
        .accessibilityLevel('no').onClick((): void => this.closeMore(true));
      Stack({ alignContent: Alignment.TopEnd }) {
        Column() {
          ReaderActionMenuSurface({ nativeId: `${this.moreFocusKey()}-menu`,
            scheme: this.appThemeScheme, availableWidth: DETAIL_MENU_WIDTH,
            viewportHeight: Math.max(0, this.viewportHeight - this.geometry.content.startInset - 20),
            reduceMotion: this.appReduceMotion, actions: this.detailMenuActions(),
            onAction: (id: string): void => this.chooseMoreAction(id) });
        }.width('100%').padding({ top: 6, bottom: 6 }).borderRadius(16)
          .backgroundColor(readerAppColor('TOK_SURFACE_ELEVATED', this.appThemeScheme))
          .border({ width: 1, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
          .shadow(readerSurfaceElevation('dialog', this.appThemeScheme));
        Column().width(12).height(12).rotate({ angle: 45 })
          .backgroundColor(readerAppColor('TOK_SURFACE_ELEVATED', this.appThemeScheme))
          .border({ width: { top: 1, left: 1 }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
          .position({ x: DETAIL_MENU_WIDTH - 28, y: -6 }).zIndex(1)
          .hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
      }.width(DETAIL_MENU_WIDTH).clip(false)
        .margin({ top: this.geometry.content.startInset, right: this.geometry.header.insetRight })
        .transition(this.detailMoreTransition());
    }.width('100%').height('100%');
  }

  private detailMoreTransition(): TransitionEffect {
    if (this.appReduceMotion) return TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam());
    return TransitionEffect.asymmetric(
      TransitionEffect.scale({ x: 1, y: .84, centerX: '100%', centerY: 0 })
        .combine(TransitionEffect.opacity(.55)).animation({
          duration: motionAnimateParam('dropdown.menu.expand').duration, curve: readerMotionStandardCurve() }),
      TransitionEffect.OPACITY.animation({
        duration: motionAnimateParam('dropdown.menu.collapse').duration, curve: readerMotionStandardCurve() }),
    );
  }

  @Builder
  private hero() { this.standardHero(); }

  @Builder
  private detailCover(width: number, height: number) {
    if (this.hasCover()) {
      Image(this.displayCoverUrl() as string).width(width).height(height).objectFit(ImageFit.Cover).borderRadius(8)
        .onError(this.coverErrorHandler(this.displayCoverUrl()));
    } else {
      NoCoverCover({ coverWidth: width, coverHeight: height, glyph: this.book.title,
        kindLabel: this.book.contentKind === 'manga' ? '漫画' : '小说' });
    }
  }

  @Builder
  private standardHero() {
    Row({ space: 16 }) {
      this.detailCover(86, 118);
      Column({ space: 8 }) {
        Text(this.book.title).width('100%').fontFamily(TYPE_BOOK_DETAIL_TITLE.fontFamily).fontWeight(TYPE_BOOK_DETAIL_TITLE.fontWeight).fontSize(TYPE_BOOK_DETAIL_TITLE.fontSizeFp).lineHeight(TYPE_BOOK_DETAIL_TITLE.lineHeightFp as number)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(bookAuthorLabel(this.book.author)).width('100%').fontFamily(TYPE_BOOK_DETAIL_AUTHOR.fontFamily).fontWeight(TYPE_BOOK_DETAIL_AUTHOR.fontWeight).fontSize(TYPE_BOOK_DETAIL_AUTHOR.fontSizeFp).lineHeight(TYPE_BOOK_DETAIL_AUTHOR.lineHeightFp as number).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        this.bookTags();
      }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
    }.width('100%').constraintSize({ minHeight: 118 }).alignItems(VerticalAlign.Center);
  }

  @Builder
  private bookTags() {
    Row({ space: 6 }) {
      this.metadataTag(this.book.contentKind === 'manga' ? '漫画' : '小说', false);
      this.metadataTag(this.book.sourceId === 'local' ? '本地藏书' : '在线', true);
    }
  }

  @Builder
  private metadataTag(label: string, tonal: boolean) {
    Text(label).fontFamily(TYPE_BOOK_DETAIL_TAG.fontFamily).fontWeight(TYPE_BOOK_DETAIL_TAG.fontWeight).fontSize(TYPE_BOOK_DETAIL_TAG.fontSizeFp).lineHeight(TYPE_BOOK_DETAIL_TAG.lineHeightFp as number).padding({ left: 8, right: 8 })
      .fontColor(readerAppColor(tonal ? 'TOK_PRIMARY_DARK' : 'TOK_MUTED', this.appThemeScheme))
      .backgroundColor(readerAppColor(tonal ? 'TOK_PRIMARY_SOFT' : 'TOK_SURFACE_FIELD', this.appThemeScheme))
      .borderRadius(6);
  }

  @Builder
  private readingFacts() {
    Column({ space: 8 }) {
      Row({ space: 8 }) {
        Column({ space: 2 }) {
          Text('当前书源').fontFamily(TYPE_READER_PANEL_META.fontFamily).fontWeight(TYPE_READER_PANEL_META.fontWeight).fontSize(TYPE_READER_PANEL_META.fontSizeFp).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          Text(this.book.sourceName?.trim() || (this.book.sourceId === 'local' ? '本地文件' : '书源未知'))
            .width('100%').fontFamily(TYPE_READER_PANEL_LABEL.fontFamily).fontWeight(TYPE_READER_PANEL_LABEL.fontWeight).fontSize(TYPE_READER_PANEL_LABEL.fontSizeFp).fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
        }.layoutWeight(1).constraintSize({ minWidth: 0 }).alignItems(HorizontalAlign.Start);
        if (this.book.sourceId !== 'local') {
          Button({ type: ButtonType.Normal, stateEffect: false }) {
            Row({ space: 3 }) {
              Image(this.appThemeScheme === 'night' ? $r('app.media.rc_switch_horizontal_theme_night') : $r('app.media.rc_switch_horizontal'))
                .width(14).height(14).accessibilityLevel('no');
              Text('换源').fontFamily(TYPE_APP_SEGMENT_LABEL.fontFamily).fontWeight(TYPE_APP_SEGMENT_LABEL.fontWeight).fontSize(TYPE_APP_SEGMENT_LABEL.fontSizeFp).lineHeight(TYPE_APP_SEGMENT_LABEL.lineHeightFp as number).halfLeading(true)
                .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
            }.constraintSize({ minHeight: 32 }).padding({ left: 8, right: 10 })
              .scale(readerPressScale(this.detailPressedAction === 'source', this.appReduceMotion))
              .opacity(readerPressOpacity(this.detailPressedAction === 'source', this.appReduceMotion))
              .animation(readerPressAnimation(this.appReduceMotion))
              .attributeModifier(this.detailPaintFeedback('TOK_PAPER', 999, 'source', this.sourceSwitchEnabled && !this.removing))
              .border({ width: 1, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
              .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
          }.constraintSize({ minWidth: 44, minHeight: 44 }).flexShrink(0)
            .padding(0).backgroundColor(Color.Transparent).borderRadius(999)
            .id(sourceSwitchTriggerFocusId(this.book.sourceId, this.book.bookId, 'detail-source'))
            .enabled(this.sourceSwitchEnabled && !this.removing)
            .opacity(this.sourceSwitchEnabled && !this.removing ? 1 : .45).accessibilityText('换源')
            .onTouch((event: TouchEvent): void => this.observeDetailPress('source', event, this.sourceSwitchEnabled && !this.removing))
            .onClick((): void => {
              if (this.acceptsDetailInput() && this.sourceSwitchEnabled && !this.removing) {
                this.onSwitchSource(sourceSwitchTriggerFocusId(this.book.sourceId, this.book.bookId, 'detail-source'));
              }
            });
        }
      }.width('100%').alignItems(VerticalAlign.Center);
      Text(`最新：${this.book.lastChapter?.trim() || '暂无最新章节'}`).width('100%')
        .padding({ top: 8 }).border({ width: { top: 1 }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
        .fontFamily(TYPE_APP_ROW_DETAIL.fontFamily).fontWeight(TYPE_APP_ROW_DETAIL.fontWeight).fontSize(TYPE_APP_ROW_DETAIL.fontSizeFp).lineHeight(TYPE_APP_ROW_DETAIL.lineHeightFp as number).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
        .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
    }.width('100%').padding(12).alignItems(HorizontalAlign.Start)
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: 1, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(14);
  }

  @Builder
  private summary() {
    if (this.book.contentKind === 'manga') this.mangaIntro();
    else this.standardSummary();
  }

  @Builder
  private mangaIntro() {
    Column({ space: 0 }) {
      Text('简介').fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontWeight(visual.sectionFontWeight)
        .fontSize(visual.sectionFontSize).lineHeight(visual.sectionLineHeight).halfLeading(true)
        .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
        .fontColor(mangaDirectoryColor('ink', this.appThemeScheme));
      Text(this.displayIntro() || '暂无简介').width('100%').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
        .fontWeight(visual.bodyFontWeight).fontSize(visual.introBodyFontSize).lineHeight(visual.introBodyLineHeight).halfLeading(false).wordBreak(WordBreak.BREAK_WORD)
        .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
        .fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).margin({ top: visual.introBodyTop })
        .maxLines(this.introExpanded || !this.introMeasured ? 10000 : 3).textOverflow({ overflow: TextOverflow.Ellipsis })
        .onAreaChange(this.introAreaChange());
      if (this.introOverflow) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Row({ space: visual.sectionActionGap }) {
            Text(this.introExpanded ? '收起' : '展开').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
              .fontWeight(visual.bodyFontWeight).fontSize(visual.sectionActionFontSize).lineHeight(visual.sectionActionLineHeight)
              .halfLeading(true).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
              .fontColor(mangaDirectoryColor('accent', this.appThemeScheme));
            Image(this.appThemeScheme === 'night' ? $r('app.media.manga_directory_chevron_down_accent_theme_night') : $r('app.media.manga_directory_chevron_down_accent'))
              .width(visual.sectionActionIcon).height(visual.sectionActionIcon).rotate({ angle: this.introExpanded ? 180 : 0 })
              .accessibilityLevel('no');
          }.constraintSize({ minHeight: visual.sectionActionHeight });
        }.padding(0).backgroundColor(Color.Transparent).borderRadius(0)
          .constraintSize({ minWidth: READER_ACTION_MIN_TARGET, minHeight: visual.sectionActionHeight }).margin({ top: visual.introExpandTop })
          .attributeModifier(new ReaderActionAccessibility(this.introExpanded ? '收起简介' : '展开简介', true, false, true,
            new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 999), 'nativeButton'))
          .onClick((): void => this.toggleIntro());
      }
    }.width('100%').alignItems(HorizontalAlign.Start).margin({ top: visual.introMarginTop })
      .padding(DETAIL_SUMMARY_PADDING).backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: DETAIL_SUMMARY_BORDER, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(14);
  }

  @Builder
  private standardSummary() {
    Column({ space: 8 }) {
      Text('内容简介').fontFamily(TYPE_CARD_SECTION_HEADING.fontFamily).fontWeight(TYPE_CARD_SECTION_HEADING.fontWeight)
        .fontSize(TYPE_CARD_SECTION_HEADING.fontSizeFp).lineHeight(TYPE_CARD_SECTION_HEADING.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      Stack({ alignContent: Alignment.Bottom }) {
        Text(this.displayIntro() || '暂无简介').width('100%').fontFamily(TYPE_BOOK_DETAIL_SUMMARY.fontFamily).fontWeight(TYPE_BOOK_DETAIL_SUMMARY.fontWeight).fontSize(TYPE_BOOK_DETAIL_SUMMARY.fontSizeFp)
          .lineHeight(`${TYPE_BOOK_DETAIL_SUMMARY.lineHeightFp}fp`)
          .halfLeading(false).wordBreak(WordBreak.BREAK_WORD)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(this.introExpanded || !this.introMeasured ? 10000 : this.introFoldedLines())
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .onAreaChange(this.introAreaChange());
        if (this.introOverflow && !this.introExpanded) {
          Row().width('100%').height(20)
            .linearGradient({ direction: GradientDirection.Bottom, colors: [
              [readerAppColor('app.detail.summaryFadeTransparent', this.appThemeScheme), 0],
              [readerAppColor('TOK_CARD_BG', this.appThemeScheme), 1],
            ] }).hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
        }
      }.width('100%');
      if (this.introOverflow) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Row({ space: 4 }) {
            Text(this.introExpanded ? '收起' : '展开全部').fontFamily(TYPE_APP_SEGMENT_LABEL.fontFamily).fontWeight(TYPE_APP_SEGMENT_LABEL.fontWeight).fontSize(TYPE_APP_SEGMENT_LABEL.fontSizeFp).lineHeight(TYPE_APP_SEGMENT_LABEL.lineHeightFp as number).halfLeading(true)
              .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
            Image(this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_down_primary_theme_night') :
              $r('app.media.reader_chevron_down_primary')).width(14).height(14)
              .rotate({ angle: this.introExpanded ? 180 : 0 }).accessibilityLevel('no');
          }
        }.id('reader-detail-summary-toggle').width('100%')
          .constraintSize({ minWidth: READER_ACTION_MIN_TARGET, minHeight: READER_ACTION_MIN_TARGET })
          .padding(0).backgroundColor(Color.Transparent).borderRadius(0)
          .border({ width: { top: DETAIL_SUMMARY_BORDER }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
          .attributeModifier(new ReaderActionAccessibility(this.introExpanded ? '收起简介' : '展开简介', true, false, true,
            new ReaderPressFeedback(Color.Transparent, this.appThemeScheme), 'nativeButton'))
          .onClick((): void => this.toggleIntro());
      }
    }.width('100%').alignItems(HorizontalAlign.Start).padding(DETAIL_SUMMARY_PADDING)
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: DETAIL_SUMMARY_BORDER, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(14);
  }

  private toggleIntro(): void {
    if (this.acceptsDetailInput() && this.introOverflow) this.introExpanded = !this.introExpanded;
  }

  @Builder
  private catalog() {
    Column({ space: 8 }) {
      this.standardCatalogHeading();
      if (this.previewChapters.length === 0) {
        ReaderPageState({ title: this.chapterEmptyMessage(), loading: this.catalogLoading() })
          .padding({ top: 24, bottom: 24 });
      } else if (this.wideDetail()) {
        Column({ space: 8 }) {
          ForEach([0, 2, 4], (start: number): void => {
            if (start < this.previewChapters.length) {
              Row({ space: 8 }) {
                this.chapterPreviewRow(this.previewChapters[start], true, start);
                if (start + 1 < this.previewChapters.length) this.chapterPreviewRow(this.previewChapters[start + 1], true, start + 1);
                else Blank().layoutWeight(1);
              }.width('100%');
            }
          }, (start: number): string => JSON.stringify([
            this.previewKey(this.previewChapters[start]), this.previewKey(this.previewChapters[start + 1]) ]));
        }.width('100%');
      } else {
        Column() {
          ForEach(this.previewChapters, (entry: LocalReadingTocEntry, position: number): void => {
            this.chapterPreviewRow(entry, false, position);
          }, (entry: LocalReadingTocEntry): string => this.previewKey(entry));
        }.width('100%').backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
          .border({ width: 1, color: readerAppColor('TOK_LINE', this.appThemeScheme) }).borderRadius(14).clip(true);
      }
    }.width('100%');
  }

  private previewKey(entry: LocalReadingTocEntry | undefined): string {
    if (entry === undefined) return '';
    return JSON.stringify([this.admissionIdentity, entry.index, entry.title, entry.displayTitle, entry.level, entry.navigable]);
  }

  private chapterCountLabel(): string {
    const manga = this.book.contentKind === 'manga';
    const count = this.toc.filter((entry: LocalReadingTocEntry): boolean =>
      manga ? entry.navigable === true : entry.navigable !== false).length;
    return `${count} ${manga ? '话' : '章'}`;
  }

  @Builder
  private standardCatalogHeading() {
    Row({ space: 6 }) {
      Text('目录预览').fontFamily(TYPE_CARD_SECTION_HEADING.fontFamily).fontWeight(TYPE_CARD_SECTION_HEADING.fontWeight).fontSize(TYPE_CARD_SECTION_HEADING.fontSizeFp).lineHeight(TYPE_CARD_SECTION_HEADING.lineHeightFp as number)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
      Text(this.chapterCountLabel())
        .layoutWeight(1).fontFamily(TYPE_APP_ROW_DETAIL.fontFamily).fontWeight(TYPE_APP_ROW_DETAIL.fontWeight).fontSize(TYPE_APP_ROW_DETAIL.fontSizeFp).lineHeight(TYPE_APP_ROW_DETAIL.lineHeightFp as number).fontFeature('"tnum" 1').fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
      ReaderLabeledIconAction({ specId: 'detail-directory', label: '完整目录', scheme: this.appThemeScheme,
        icon: this.appThemeScheme === 'night' ? $r('app.media.book_detail_directory_theme_night') : $r('app.media.book_detail_directory'),
        focusId: this.directoryFocusKey(), actionEnabled: !this.removing,
        onAction: (): void => { if (this.acceptsDetailInput() && !this.removing) this.onOpenDirectory(); } });
    }.width('100%').constraintSize({ minHeight: 44 });
  }

  @Builder
  private chapterPreviewRow(entry: LocalReadingTocEntry, wide: boolean, position: number) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 6 }) {
        Text(entry.displayTitle ?? entry.title)
          .layoutWeight(1)
          .fontFamily(this.currentChapterIndex === entry.index ? TYPE_APP_COMPACT_PRIMARY_ACTION.fontFamily : TYPE_APP_ROW_DETAIL.fontFamily)
          .fontWeight(this.currentChapterIndex === entry.index ? TYPE_APP_COMPACT_PRIMARY_ACTION.fontWeight : TYPE_APP_ROW_DETAIL.fontWeight)
          .fontSize(wide ? TYPE_APP_ROW_DETAIL.fontSizeFp : TYPE_READER_PANEL_LABEL.fontSizeFp)
          .lineHeight(TYPE_APP_ROW_DETAIL.lineHeightFp as number).halfLeading(true)
          .fontColor(readerAppColor(this.currentChapterIndex === entry.index ? 'TOK_PRIMARY_DARK' : 'TOK_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.currentChapterIndex === entry.index) {
          Text('在读').fontFamily(TYPE_APP_COMPACT_BADGE.fontFamily).fontWeight(TYPE_APP_COMPACT_BADGE.fontWeight).fontSize(TYPE_APP_COMPACT_BADGE.fontSizeFp).lineHeight(14).halfLeading(true).padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .fontColor(readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme))
            .backgroundColor(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme)).borderRadius(5);
        } else {
          Image(this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
            .width(wide ? 13 : 14).height(wide ? 13 : 14);
        }
      }.width('100%').constraintSize({ minHeight: wide ? 40 : 44 }).padding({ left: wide ? 12 : 14, right: wide ? 12 : 14 })
        .scale(readerPressScale(this.detailPressedAction === `chapter:${entry.index}`, this.appReduceMotion))
        .opacity(readerPressOpacity(this.detailPressedAction === `chapter:${entry.index}`, this.appReduceMotion))
        .animation(readerPressAnimation(this.appReduceMotion))
        .attributeModifier(this.detailPaintFeedback(this.currentChapterIndex === entry.index ? 'TOK_PRIMARY_SOFT' :
          wide ? 'TOK_CARD_BG' : 'app.surface.transparent', wide ? 12 : 0, `chapter:${entry.index}`, this.readingActionAvailable()))
        .border({ width: wide ? 1 : { top: position > 0 ? 1 : 0 }, color: readerAppColor(
          this.currentChapterIndex === entry.index && wide ? 'TOK_PRIMARY_BORDER' : 'TOK_LINE', this.appThemeScheme) })
        .borderRadius(wide ? 12 : 0).accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.width(wide ? undefined : '100%').layoutWeight(wide ? 1 : undefined)
      .constraintSize({ minWidth: 44, minHeight: 44 }).padding(0).backgroundColor(Color.Transparent).borderRadius(wide ? 12 : 0)
      .enabled(this.readingActionAvailable())
      .id(`reader-detail-preview-${entry.index}`)
      .accessibilityText(`${entry.displayTitle ?? entry.title}${this.currentChapterIndex === entry.index ? '，在读' : ''}`)
      .onTouch((event: TouchEvent): void => this.observeDetailPress(`chapter:${entry.index}`, event, this.canActOnChapterPreview(entry)))
      .onClick((): void => { if (this.canActOnChapterPreview(entry)) this.onSelectChapter(entry.index); });
  }

  private detailPaintFeedback(role: ReaderAppColorRole, radius: number, action: string, enabled: boolean): ReaderPressFeedback {
    return new ReaderPressFeedback(readerAppColor(role, this.appThemeScheme), this.appThemeScheme,
      radius, radius, enabled, this.detailPressedAction === action);
  }

  private observeDetailPress(action: string, event: TouchEvent, enabled: boolean): void {
    if (this.detailPressedAction !== '' && this.detailPressedAction !== action) return;
    this.detailPressPointer = readerPressPointer(event, this.detailPressPointer, enabled && this.acceptsDetailInput());
    this.detailPressedAction = this.detailPressPointer < 0 ? '' : action;
  }

  private clearDetailPress(): void {
    this.detailPressPointer = -1;
    this.detailPressedAction = '';
  }

  private canActOnChapterPreview(entry: LocalReadingTocEntry): boolean {
    return this.acceptsDetailInput() && this.readingActionAvailable() &&
      this.previewChapters.some((current: LocalReadingTocEntry): boolean =>
        current.index === entry.index && current.title === entry.title && current.displayTitle === entry.displayTitle &&
        current.level === entry.level &&
        current.navigable === entry.navigable);
  }

  @Builder
  private actionArea() {
    Stack({ alignContent: Alignment.TopStart }) {
      // Keep the fade out of the scaffold's footer measurement loop.
      Stack({ alignContent: Alignment.TopStart }) {
        Column().width(this.liveWidth()).height(this.geometry.footer.height + this.geometry.footer.bottom + this.dockContentGap())
          .position({ x: -this.geometry.footer.insetLeft, y: -this.dockContentGap() })
          .linearGradient({ direction: GradientDirection.Top, colors: [
            [readerAppColor('app.detail.footerFadeSolid', this.appThemeScheme), 0],
            [readerAppColor('app.detail.footerFadeSoft', this.appThemeScheme), .68],
            [readerAppColor('app.detail.footerFadeTransparent', this.appThemeScheme), 1],
          ] }).hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
      }.width(0).height(0).clip(false).hitTestBehavior(HitTestMode.None);
      this.actionSurface();
    }.width('100%').clip(false);
  }

  private dockContentGap(): number {
    return this.book.contentKind === 'manga' ? visual.detailDockClearance : DETAIL_DOCK_CONTENT_GAP;
  }

  private dockAreaChangeHandler(presentedKey: number): (_old: Area, next: Area) => void {
    const identity = this.dockShapeIdentity();
    return (_old: Area, next: Area): void => {
      if (!this.mounted || presentedKey !== this.footerMeasurementKey || identity !== this.dockShapeIdentity()) return;
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
    return JSON.stringify(['detail-dock', this.footerMeasurementKey, this.book.sourceId, this.book.bookId, this.book.contentKind]);
  }
  private dockRequestedRadius(): number { return 999; }
  private currentDockShape(): ReaderRaisedShape | undefined { return this.mounted ? this.dockRaisedShape : undefined; }
  private dockNativeShape(): ReaderRaisedShape | undefined {
    return this.currentDockShape() ?? resolveReaderRaisedShape(this.dockShapeIdentity(), this.liveWidth(),
      this.book.contentKind === 'manga' ? visual.detailDockHeight : DETAIL_DOCK_HEIGHT, this.dockRequestedRadius());
  }

  @Builder
  private actionSurface() {
    // The action row and painted dock grow together. The scaffold records
    // their actual height for the matching scroll clearance.
    Stack({ alignContent: Alignment.Center }) {
      Row({ space: this.book.contentKind === 'manga' ? visual.detailDockGap : 12 }) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(this.readingActionLabel()).width('100%')
          .constraintSize({ minHeight: 44 })
          .padding({ left: this.book.contentKind === 'manga' ? 16 : 0, right: this.book.contentKind === 'manga' ? 16 : 0 }).fontFamily(this.book.contentKind === 'manga' ? READER_FONT_NOTO_SANS_SC_UI_BOLD : TYPE_APP_PRIMARY_ACTION.fontFamily)
          .fontSize(this.book.contentKind === 'manga' ? visual.detailPrimaryFontSize : TYPE_CARD_SECTION_HEADING.fontSizeFp)
          .lineHeight(this.book.contentKind === 'manga' ? visual.detailPrimaryLineHeight : undefined)
          .minFontScale(Math.min(1, this.mangaFontScale()))
          .maxFontScale(Math.max(1, this.mangaFontScale()))
          .halfLeading(this.book.contentKind === 'manga')
          .fontWeight(this.book.contentKind === 'manga' ? visual.groupFontWeight : TYPE_APP_PRIMARY_ACTION.fontWeight)
          .fontColor(this.detailColor('TOK_ON_PRIMARY', 'onGreen'))
          .textAlign(TextAlign.Center).accessibilityLevel('no');
        }.layoutWeight(1)
          .constraintSize({ minHeight: 44 })
          .padding(0).borderRadius(999)
          .opacity(this.readingActionAvailable() ? 1 : this.book.contentKind === 'manga' ? visual.disabledOpacity : 0.5)
          .attributeModifier(new ReaderActionAccessibility(this.readingActionLabel(), this.readingActionAvailable(), false, true,
            new ReaderPressFeedback(this.detailColor('TOK_PRIMARY_DARK', 'green'), this.appThemeScheme,
              999, 999, this.readingActionAvailable()), 'nativeButton'))
          .onClick((): void => { if (this.acceptsDetailInput() && this.readingActionAvailable()) this.onContinue(); });
        ForEach([this.admissionIdentity], (identity: string) => {
        Stack({ alignContent: Alignment.Center }) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(this.shelfActionLabel()).width(this.book.contentKind === 'manga' ? visual.detailSecondaryWidth : 94)
          .constraintSize({ minHeight: 44 })
          .padding({ left: this.book.contentKind === 'manga' ? 6 : 0, right: this.book.contentKind === 'manga' ? 6 : 0 })
          .fontFamily(TYPE_APP_SEGMENT_LABEL.fontFamily)
          .fontSize(this.book.contentKind === 'manga' ? visual.detailSecondaryFontSize : TYPE_APP_SEGMENT_LABEL.fontSizeFp)
          .lineHeight(this.book.contentKind === 'manga' ? visual.detailSecondaryLineHeight : undefined)
          .minFontScale(Math.min(1, this.mangaFontScale()))
          .maxFontScale(Math.max(1, this.mangaFontScale()))
          .halfLeading(this.book.contentKind === 'manga').fontWeight(TYPE_APP_SEGMENT_LABEL.fontWeight)
          .textAlign(TextAlign.Center).fontColor(this.removing || this.cancellingAdd ? Color.Transparent : this.detailColor(this.inBookshelf ? 'TOK_MUTED' : 'TOK_GREEN',
            this.book.contentKind === 'manga' ? 'muted' : this.inBookshelf ? 'muted' : 'accent'))
          .accessibilityLevel('no');
        }.width(this.book.contentKind === 'manga' ? visual.detailSecondaryWidth : 94)
          .constraintSize({ minHeight: 44 })
          .padding(0).borderRadius(999)
          .opacity(this.shelfActionAvailable() ? 1 : this.book.contentKind === 'manga' ? visual.disabledOpacity : 0.4)
          .border({ width: 1, color: this.detailColor('TOK_LINE', 'line') })
          .attributeModifier(new ReaderActionAccessibility(this.shelfActionLabel(), this.shelfActionAvailable(), false, true,
            new ReaderPressFeedback(this.detailColor('TOK_SURFACE_PANEL_SOFT', 'soft'), this.appThemeScheme,
              999, 999, this.shelfActionAvailable()), 'nativeButton'))
          .onClick((): void => {
            if (this.acceptsDetailInput()) this.commitShelfAction(identity);
          });
          if (this.removing || this.cancellingAdd) {
            LoadingProgress().width(18).height(18).color(readerAppColor('TOK_MESSAGE_MUTED', this.appThemeScheme))
              .enableLoading(this.appForeground && !this.appReduceMotion);
          }
        }
        }, (identity: string): string => identity);
      }.width('100%')
        .constraintSize({ minHeight: 44 }).alignItems(VerticalAlign.Center);
    // The viewport-bottom owner aligns this complete measured surface.
    }.width('100%')
      .constraintSize({ minHeight: this.book.contentKind === 'manga' ? visual.detailDockHeight : DETAIL_DOCK_HEIGHT })
      .padding(this.book.contentKind === 'manga' ? visual.detailDockPadding : 9)
      .attributeModifier(new ReaderPanelFrame('floating-action-dock', this.appThemeScheme, false, this.dockNativeShape()))
      .hitTestBehavior(HitTestMode.Default)
      .onTouch((): void => {})
      .onAreaChange(this.dockAreaChangeHandler(this.footerMeasurementKey));
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
    const task = prepareMangaSheetFonts();
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
    const currentKey = slot === 'detail:dock' ? this.footerMeasurementKey : this.measurementKey;
    if (!this.mounted || key !== currentKey || height < 0) return;
    if (!this.measurements.record(slot, height, key, .1)) return;
    this.refreshGeometry();
  }

  private invalidateFrame(): void {
    if (!this.mounted || this.book === undefined) return;
    const metrics = ReaderWindowCoordinator.metrics();
    const headerInputs = JSON.stringify([this.liveWidth(), this.safeLeft(), this.safeRight(),
      metrics.systemFontScale, metrics.densityPixels, metrics.ready,
      this.book.sourceId, this.book.bookId, this.book.contentKind, this.book.contentKind === 'manga' && this.mangaFontsReady]);
    const footerInputs = JSON.stringify([headerInputs, this.detailKindConfirmed(), this.readingActionLabel(), this.shelfActionLabel()]);
    if (headerInputs !== this.headerInputs) {
      this.headerInputs = headerInputs;
      this.measurementKey += 1;
    }
    if (footerInputs !== this.footerInputs) {
      this.footerInputs = footerInputs;
      this.footerMeasurementKey += 1;
    }
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
    input.measurementRevision = ++this.geometryRevision;
    input.headerTop = this.headerSpec.headerTop(readerInteractiveSafeTop(metrics));
    const minimumHeaderHeight = manga ? mangaDirectoryHeaderHeight(this.mangaFontScale()) : this.headerSpec.barHeight;
    input.headerHeight = Math.max(minimumHeaderHeight, this.measurements.readForGeneration('detail:header', this.measurementKey, minimumHeaderHeight));
    input.headerInsetLeft = Math.max(8, this.safeLeft());
    input.headerInsetRight = Math.max(8, this.safeRight());
    input.footerBottom = readerInteractiveSafeBottom(metrics) + (manga ? visual.detailDockBottom : DETAIL_DOCK_BOTTOM_GAP);
    input.footerHeight = Math.max(minimumDockHeight, this.measurements.readForGeneration('detail:dock', this.footerMeasurementKey, minimumDockHeight));
    input.contentGap = manga ? visual.contentTop - visual.headerHeight - this.headerSpec.topGap : this.headerSpec.contentGap;
    input.contentUnderlap = 0;
    input.contentMaxWidth = manga ? visual.contentWidthMax : TOK_CONTENT_MAX_W_TABLET;
    input.contentHorizontalPadding = manga ? 20 : 18;
    input.contentEndInset = this.wideDetail() ? readerInteractiveSafeBottom(metrics) + 16 :
      input.footerBottom + input.footerHeight + this.dockContentGap();
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
  private introFoldedLines(): number { return this.book.contentKind === 'manga' ? 3 : 4; }
  private introAreaChange(): (_old: Area, area: Area) => void {
    const book = this.book;
    return (_old: Area, area: Area): void => {
      if (!this.mounted || this.book.sourceId !== book.sourceId || this.book.bookId !== book.bookId ||
        this.book.contentKind !== book.contentKind) return;
      const width = readerPageAreaLength(area.width);
      if (Number.isFinite(width) && width > 0 && Math.abs(width - this.introMeasuredWidth) > .1) {
        this.introMeasuredWidth = width;
        this.measureIntro();
      }
    };
  }
  private measureIntro(): void {
    if (!this.mounted || this.book === undefined || (this.book.contentKind === 'manga' && !this.mangaFontsReady)) return;
    const text = this.displayIntro();
    const manga = this.book.contentKind === 'manga';
    const initialWidth = this.contentFrame().width - 2 * (DETAIL_SUMMARY_PADDING + DETAIL_SUMMARY_BORDER);
    const width = this.introMeasuredWidth > 0 ? this.introMeasuredWidth : Math.max(0, initialWidth);
    const fontFamily = manga ? READER_FONT_NOTO_SANS_SC_UI_REGULAR : TYPE_BOOK_DETAIL_SUMMARY.fontFamily;
    const fontSize = manga ? visual.introBodyFontSize : TYPE_BOOK_DETAIL_SUMMARY.fontSizeFp;
    const lineHeight = manga ? visual.introBodyLineHeight : TYPE_BOOK_DETAIL_SUMMARY.lineHeightFp as number;
    const fontWeight = manga ? visual.bodyFontWeight : TYPE_BOOK_DETAIL_SUMMARY.fontWeight;
    const foldedLines = this.introFoldedLines();
    const context = this.getUIContext();
    let vpUnit: number;
    let fpUnit: number;
    try { vpUnit = context.px2vp(1); fpUnit = context.fp2px(1); }
    catch (_) {
      this.introOverflow = false; this.introMeasured = false; this.introMeasurementSignature = '';
      return;
    }
    const signature = JSON.stringify([this.book.sourceId, this.book.bookId, text, width,
      this.mangaFontScale(), fontFamily, fontSize, lineHeight, fontWeight, foldedLines, vpUnit, fpUnit, this.mangaFontGeneration]);
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
      fontFamily, fontSize: `${fontSize}fp`, lineHeight: `${lineHeight}fp`, fontWeight,
      wordBreak: WordBreak.BREAK_WORD, overflow: TextOverflow.Ellipsis, maxLines: 10000 };
    // MeasureUtils is synchronous. Publish the completed receipt before the
    // first build or book update can paint an unmeasured, expanded synopsis.
    try {
      if (!this.mounted || (this.book.contentKind === 'manga' && !this.mangaFontsReady) || generation !== this.introMeasurementGeneration ||
        signature !== this.introMeasurementSignature) return;
      const measure = context.getMeasureUtils();
      const full = Number(measure.measureTextSize(options).height);
      options.maxLines = foldedLines;
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
  private refreshChapterPreview(): void {
    if (this.book === undefined) return;
    this.previewChapters = detailChapterPreview(this.toc, this.currentChapterIndex, this.book.contentKind === 'manga');
    if (this.detailPressedAction.startsWith('chapter:') && !this.previewChapters.some((entry: LocalReadingTocEntry): boolean =>
      this.detailPressedAction === `chapter:${entry.index}`)) this.clearDetailPress();
  }

  private onBookChanged(): void {
    this.onDirectoryFocusIdentityChanged();
    const layoutIdentity = `${this.book.sourceId}\u0000${this.book.bookId}\u0000${this.book.contentKind}`;
    if (this.mounted && this.layoutBookIdentity !== layoutIdentity) {
      if (!this.layoutBookIdentity.endsWith(`\u0000${this.book.contentKind}`)) this.measurements.clear();
      this.layoutBookIdentity = layoutIdentity;
    }
    if (this.mounted) {
      this.invalidateFrame();
      this.onMangaFontIdentityChanged();
    }
    const identity = layoutIdentity;
    if (identity !== this.shownBookIdentity) {
      this.headerScrolled = false;
      this.failedCoverUrls = [];
      this.introExpanded = false;
      this.introMeasuredWidth = 0;
      this.introMeasurementSignature = '';
      this.shownBookIdentity = identity;
    }
    this.refreshChapterPreview();
    this.measureIntro();
  }

  private onTocChanged(): void { this.refreshChapterPreview(); }

  private onMangaGeometryChanged(): void {
    if (!this.mounted || this.book === undefined) return;
    this.invalidateFrame();
    this.introMeasuredWidth = 0;
    this.measureIntro();
  }

  private readingActionLabel(): string {
    if (!this.detailBookAvailable()) return '请重新导入';
    if (this.book.contentKind === 'manga') return this.book.mangaPosition === undefined ? '开始阅读' : '继续阅读';
    return this.inBookshelf ? '继续阅读' : '开始阅读';
  }
  private readingActionAvailable(): boolean {
    return !this.removing && this.detailBookAvailable() && (this.book.sourceId !== 'local' || this.readingEnabled);
  }
  private shelfActionLabel(): string {
    if (this.cancellingAdd) return '取消加入';
    if (this.adding) return '取消加入';
    if (this.removing) return this.inBookshelf ? '移除书架' : '加入书架';
    if (!this.detailBookAvailable()) return '已移除';
    return this.inBookshelf ? '已在书架' : '加入书架';
  }
  private shelfActionAvailable(): boolean {
    return this.removalEnabled && !this.removing && !this.cancellingAdd && this.detailBookAvailable();
  }
  private commitShelfAction(identity: string): void {
    if (!this.shelfActionAvailable() || identity !== this.admissionIdentity) return;
    if (this.adding) this.onCancelAdd(identity); else this.onRemove(identity);
  }
  private detailBookAvailable(): boolean { return this.book.sourceId !== 'local' || this.inBookshelf; }
  private displayCoverUrl(): string | undefined {
    return [bookCoverDisplayUrl(this.book.displayCoverUrl), bookCoverDisplayUrl(this.book.coverUrl)]
      .find((url: string | undefined): boolean => url !== undefined && !this.failedCoverUrls.includes(url));
  }

  private coverErrorHandler(url: string | undefined): () => void {
    const identity = this.shownBookIdentity;
    return (): void => {
      if (!this.mounted || url === undefined || identity !== this.shownBookIdentity ||
        url !== this.displayCoverUrl()) return;
      this.failedCoverUrls = [...this.failedCoverUrls, url];
    };
  }

  private hasCover(): boolean { return this.displayCoverUrl() !== undefined; }
}
