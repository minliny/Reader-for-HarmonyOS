import { ReaderDirectoryDataPublication, sameReaderDirectoryData } from '../presentation/ReaderDirectoryDataSnapshot';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import type { ReaderDirectoryNavigationPortFactory } from '../application/ReaderDirectoryNavigation';
import { readerDirectoryScopeKey } from '../application/ReaderDirectoryNavigation';
import { readerDirectorySignalScrollCommand, readerDirectorySignalScrollIntent } from '../presentation/ReaderDirectoryViewport';
import hilog from '@ohos.hilog';
import { DEBUG } from '../../../../../../build/default/generated/profile/default/BuildProfile';
import inputMethod from '@ohos.inputMethod';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { mangaDirectoryDisplay } from '../../manga/ui/MangaDirectoryDisplay';
import { mangaDirectoryContextEntries, mangaDirectoryDownloadStatusWidth } from '../../manga/ui/MangaDirectoryState';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor, mangaDirectoryScale, mangaDirectoryHeaderHeight, mangaDirectoryFullFlowFooter } from '../../manga/ui/MangaDirectoryVisual';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { readerAppColor } from '../../../ui/foundation/ReaderAppColors';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { registerReaderFonts, prepareMangaSheetFonts } from '../../../ui/foundation/ReaderFonts';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout } from '../../../ui/layout/ReaderScrollLayout';
import { readerStableInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeTop, readerStableInteractiveSafeTop } from '../../../ui/foundation/ReaderWindowMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from '../../../ui/layout/SurfaceHorizontalGeometry';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowTypes';
import { projectReaderDirectoryEntries } from '../presentation/ReaderDirectoryProjection';
import { ReaderDirectoryToolbar } from './ReaderDirectoryToolbar';
import { ReaderDirectoryQuickActions, readerDirectoryQuickActionsHeight } from './ReaderDirectoryQuickActions';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { ReaderDirectoryList } from './ReaderDirectoryList';
import { ReaderDirectoryNavigationSurface } from './ReaderDirectoryNavigationSurface';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { ReaderMangaDownloadPopup } from '../../manga/ui/ReaderMangaDownloadPopup';
import type { MangaDownloadAction, MangaDownloadActionId } from '../../manga/application/MangaDownloadActionsGateway';
import { mangaDirectoryPresentation, mangaDirectoryVisibleEntries,
  type MangaDirectoryRowPresentation } from '../../manga/presentation/MangaDirectoryPresentation';
import { mangaDirectoryEntryRows, type MangaDirectoryLayoutRow } from '../../manga/ui/MangaDirectoryLayout';
import { MangaDirectoryEntryRow } from '../../manga/ui/MangaDirectoryEntryRow';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_BOLD } from '../../../ui/foundation/ReaderFontFamilies';
import { TOK_SCREEN_INSET } from '../../../ui/foundation/ReaderTokens';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { ReaderNativeSlotMeasurement } from '../../../ui/layout/ReaderNativeSlotMeasurement';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput,
  resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';

const MANGA_DOWNLOAD_POPUP_CLOSE_RECEIPT_TIMEOUT_MS = 750;
let bookDirectoryBackGeneration = 0;

/** Manga catalog shared by detail, the retained reader and source-switch candidates. */
@Component
export struct BookDirectoryPage {
  private readonly directoryPublication: ReaderDirectoryDataPublication = new ReaderDirectoryDataPublication();
  @State private directoryDataRevision: number = 0;
  @State private mangaSummaryText: string = '';
  private mangaContextSource: LocalReadingTocEntry[] | undefined = undefined;
  private mangaContextEntries: LocalReadingTocEntry[] = [];
  private projectedByIndex: Map<number, LocalReadingTocEntry> = new Map();
  private layoutRowsByFirst: Map<number, MangaDirectoryLayoutRow> = new Map();
  private displayedByIndex: Map<number, LocalReadingTocEntry> = new Map();
  private displayedRowByIndex: Map<number, number> = new Map();
  @State private firstLayoutEntries: LocalReadingTocEntry[] = [];
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('onMangaMetricsChanged') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onIdentityChanged') sourceId: string = '';
  @Prop @Watch('onIdentityChanged') bookId: string = '';
  @Prop @Watch('onMangaMetricsChanged') catalogContext: 'detail' | 'reader' = 'reader';
  @Prop @Watch('onEntriesChanged') entries: LocalReadingTocEntry[] = [];
  navigationPortFactory: ReaderDirectoryNavigationPortFactory | undefined = undefined;
  @Prop catalogMessage: string = '';
  @Prop catalogBusy: boolean = false;
  @Prop interactive: boolean = true;
  @Prop selectionBusy: boolean = false;
  @Prop reduceMotion: boolean = false;
  isOpeningCurrent: () => boolean = (): boolean => true;
  // The existing download popup presents original offline recovery. Other
  // original operation facts remain with the parent while the catalog owns input.
  @Prop directoryRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  onReconcileBookmarks: (generation: number, identity: string) => void = (): void => {};
  onContinueBookmarks: (generation: number, identity: string) => void = (): void => {};
  onReconcileOffline: (generation: number, identity: string) => void = (): void => {};
  onContinueOffline: (generation: number, identity: string) => void = (): void => {};

  @Prop @Watch('onMangaContentChanged') bookTitle: string = '';
  @Prop @Watch('onMangaContentChanged') currentChapterIndex: number = -1;
  /** Core manga location page, kept separate from the TOC row ordinal. */
  @Prop @Watch('onMangaPositionChanged') currentPageOrdinal: number = -1;
  @Prop @Watch('onMangaPositionChanged') currentPageTotal: number = -1;
  @Prop @Watch('prepareMangaLayout') mangaDownloadEnabled: boolean = false;
  onLoadDownloadActions: (chapterIndex?: number) => Promise<MangaDownloadAction[]> = async (): Promise<MangaDownloadAction[]> => [];
  onDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number) => Promise<void> = async (): Promise<void> => {};
  onOpenCacheManagement: () => void = (): void => {};
  @State private downloadMenuVisible: boolean = false;
  @State private downloadActions: MangaDownloadAction[] = [];
  @State private downloadActionsLoading: boolean = false;
  @State private downloadActionsFailure: string = '';
  private downloadMenuChapterIndex: number | undefined = undefined;
  private downloadMenuGeneration: number = 0;
  private downloadMenuIdentity: string = '';
  private downloadMenuCloseTimer: number = -1;
  private temporaryBackIdentity: string = '';
  onBack: () => void = (): void => {};
  onTemporaryBackBridge: (handler: (() => boolean) | undefined, identity: string) => void = (): void => {};
  onRetryCatalog: () => void = (): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: ReaderDirectoryTargetProof): void => {};
  @State private searchDraft: string = '';
  @State private searchQuery: string = '';
  @State private ascending: boolean = true;
  @State private projectedEntries: LocalReadingTocEntry[] = [];
  @State private viewportWidth: number = 0;
  @State private mangaViewportHeight: number = 0;
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private measurementKey: number = 0;
  @State private mangaMeasurementKey: number = 0;
  private headerInputs: string = '';
  private mangaInputs: string = '';
  private geometryRevision: number = 0;
  private readonly toolsMeasurement: ReaderNativeSlotMeasurement = new ReaderNativeSlotMeasurement();
  private readonly footerMeasurement: ReaderNativeSlotMeasurement = new ReaderNativeSlotMeasurement();
  private readonly flowFooterMeasurement: ReaderNativeSlotMeasurement = new ReaderNativeSlotMeasurement();
  private readonly treeFooterMeasurement: ReaderNativeSlotMeasurement = new ReaderNativeSlotMeasurement();
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  @State private mangaToolsHeight: number = 175;
  @State private mangaFooterMeasured: number = 0;
  @State @Watch('invalidateFrame') private mangaFontsReady: boolean = false;
  @State private mangaFontsFailed: boolean = false;
  private mangaFontGeneration: number = 0;
  @State private navigationInteracted: boolean = false;
  @State private navigationActive: boolean = false;
  @State private locateCurrentRevision: number = 0;
  @State private mangaCollapsedGroups: number[] = [];
  @State private mangaPresentation: Map<number, MangaDirectoryRowPresentation> = new Map<number, MangaDirectoryRowPresentation>();
  @State private mangaLayoutRows: MangaDirectoryLayoutRow[] = [];
  private admittedEntries: LocalReadingTocEntry[] = [];
  @State private admittedIdentity: string = '';
  private mounted: boolean = false;
  private projectionGeneration: number = 0;
  private scrollGeneration: number = 0;
  private listReady: boolean = false;
  private pendingScrollEdge: Edge | undefined = undefined;
  private pendingLocateChapter: number = -1;
  private readonly listScroller: Scroller = new Scroller();

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.mounted = true;
    const identity = `book-directory:${++bookDirectoryBackGeneration}`;
    this.temporaryBackIdentity = identity;
    this.onTemporaryBackBridge((): boolean => this.consumeTemporaryBack(identity), identity);
    this.invalidateFrame();
    this.prepareMangaPageFonts();
    this.admitEntries(true);
  }

  aboutToDisappear(): void {
    const identity = this.temporaryBackIdentity;
    this.mounted = false;
    this.temporaryBackIdentity = '';
    this.onTemporaryBackBridge(undefined, identity);
    this.retireDownloadMenu();
    this.mangaFontGeneration += 1;
    this.measurements.clear();
    this.headerInputs = '';
    this.mangaInputs = '';
    this.toolsMeasurement.unmount();
    this.footerMeasurement.unmount();
    this.flowFooterMeasurement.unmount();
    this.treeFooterMeasurement.unmount();
    this.projectionGeneration += 1;
    this.scrollGeneration += 1;
    this.admittedIdentity = '';
    this.listReady = false;
    this.pendingScrollEdge = undefined;
    this.pendingLocateChapter = -1;
  }

  build() {
    this.mangaPage();
  }

  @Builder
  private fontPreparationContent() {
    Column() {
      ReaderPageState({ loading: !this.mangaFontsFailed,
        title: this.mangaFontsFailed ? '目录暂时无法显示' : '正在准备目录…',
        actionLabel: this.mangaFontsFailed ? '重试' : '',
        onAction: (): void => this.prepareMangaPageFonts() });
    }.width('100%').height('100%').justifyContent(FlexAlign.Center);
  }

  @Builder
  private mangaPage() {
    // The page shell and its Back action stay mounted through font preparation.
    ReaderPageScaffold({ frameStyle: this.mangaFrameStyle(),
      geometry: this.geometry,
      headerMeasurementKey: this.measurementKey,
      content: (): void => { this.mangaContentSlot(); },
      header: (): void => { this.mangaHeader(); },
      footer: (): void => { this.mangaFooterSlot(); },
      onHeaderHeightChange: (height: number, presentedKey: number): void => {
        this.recordHeaderHeight('bookDirectory:mangaHeader', height, presentedKey);
      },
    }).onAreaChange((_old: Area, area: Area): void => this.recordViewport(area));
  }

  @Builder
  private mangaContentSlot() {
    if (this.mangaFontsReady) {
      this.mangaContent();
    } else {
      this.fontPreparationContent();
    }
  }

  @Builder
  private mangaFooterSlot() {
    if (this.mangaFontsReady) { this.mangaFixedFooter(); }
  }

  @Builder
  private mangaContent() {
    // The list reserves the measured catalog rail while its content scrolls
    // under the fixed header, query tools and current-chapter dock.
    Stack({ alignContent: Alignment.Top }) {
      ForEach([this.admittedIdentity], (identity: string) => {
        ReaderDirectoryNavigationSurface({ navigationPortFactory: this.navigationPortFactory,
          inputCurrent: (): boolean => this.directoryInputIsCurrent(identity) && !this.selectionBusy,
          sourceId: this.sourceId, bookId: this.bookId, query: this.searchQuery, ascending: this.ascending,
          currentChapterIndex: this.currentChapterIndex, openRevision: identity,
          interactionEnabled: this.interactive && !this.selectionBusy,
          locateCurrentRevision: this.locateCurrentRevision,
          interacted: this.navigationInteracted, mangaDisplay: true, mangaFullCatalog: true,
          mangaInitialViewportWidth: this.viewportWidth > 0 ? this.viewportWidth : readerWindowMetrics().windowRect.width,
          mangaVisibleTopInset: this.mangaVisibleTopInset(), mangaCatalogNarrow: this.mangaNarrow(),
          rowHeight: visual.gridHeight, listPaddingX: this.geometry.content.frame.left,
          listPaddingRight: this.geometry.content.frame.right,
          listPaddingY: visual.gridGap, listPaddingTop: 0, listPaddingBottom: 0,
          scrollLayout: this.directoryScrollLayout(),
          headerCount: this.mangaFlowFooter() ? 1 : 0,
          prefixHeight: this.mangaFlowFooter() ? this.geometry.content.startInset : 0,
          prefixIdentity: identity,
          prefixBuilder: (): void => { this.mangaFlatPrefix(); },
          mangaTailBuilder: (): void => { this.mangaFlowSummary(this.treeFooterMeasurement); },
          edgeEffectMode: EdgeEffect.Spring, scroller: this.listScroller,
          directoryPublication: this.directoryPublication,
          directoryEntriesRevision: this.directoryDataRevision,
          bookmarkActionsEnabled: false,
          chapterDownloadEnabled: this.mangaDownloadEnabled,
          chapterDownloadActionsEnabled: this.mangaDownloadEnabled,
          onDownloadChapter: (index: number): void => {
            if (this.navigationActive && this.directoryInputIsCurrent(identity)) void this.openDownloadActions(index);
          },
          fallbackBuilder: (): void => { this.mangaFlatList(identity); },
          onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number,
            positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void => {
            if (!this.selectionBusy && this.navigationActive && this.directoryInputIsCurrent(identity))
              this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
          },
          onFirstLayout: (): void => {
            if (this.directoryListIsCurrent(identity, true)) this.onListFirstLayout(identity);
          },
          onUserScrollIntent: (): void => {
            if (this.navigationActive && this.directoryInputIsCurrent(identity)) this.onListUserScroll();
          },
          onClearSearch: (): void => {
            if (this.navigationActive && this.directoryInputIsCurrent(identity)) { this.searchDraft = ''; this.applySearch(''); }
          },
          onTreeStateChange: (active: boolean): void => {
            if (!this.mounted || identity !== this.admittedIdentity || identity !== this.identity() ||
              active === this.navigationActive) return;
            this.navigationActive = active; this.listReady = false;
            if (active) {
              this.scrollGeneration += 1;
              this.pendingScrollEdge = undefined;
              this.pendingLocateChapter = -1;
            } else this.refreshFlatProjection(this.searchQuery, this.ascending, this.mangaCollapsedGroups, false);
          },
        }).width('100%').height('100%');
        this.mangaToolbar(identity);
      }, (identity: string): string => identity);
    }.width('100%').height('100%').id(this.editingScroll.id)
      .onAppear((): void => this.editingScroll.mount(this.getUIContext(), this.editingHost, this.listScroller,
        (): number => this.geometry.header.bottom))
      .onDisAppear((): void => this.editingScroll.unmount())
      .onAreaChange((): void => this.editingHost.refresh());
  }

  @Builder
  private mangaHeader() {
    PageBackBar({ title: '章节目录', floating: true, centered: true, variant: 'mangaDirectory',
      elevation: 'floating', material: 'veil',
      onBack: (): void => {
        if (this.directoryInputIsCurrent() && !this.consumeTemporaryBack(this.temporaryBackIdentity)) this.onBack();
      },
      trailing: (): void => { this.mangaHeaderTrailingSlot(); } });
  }

  @Builder
  private mangaHeaderTrailingSlot() {
    if (this.mangaFontsReady) { this.mangaDownloadMenuButton(); }
  }

  @Builder
  private mangaFixedFooter() {
    if (!this.mangaFlowFooter()) { this.mangaCurrentFooter(); }
  }

  @Builder
  private mangaToolbar(identity: string, inline: boolean = false,
    measurement: ReaderNativeSlotMeasurement = this.toolsMeasurement) {
    Column() {
      Column() {
        if (!this.mangaFlowFooter()) { this.mangaSummary(); }
        ReaderDirectoryToolbar({ editingHost: this.editingHost,
          editingCurrent: (): boolean => this.directoryInputIsCurrent(identity) && !this.selectionBusy,
          variant: 'standalone-catalog', text: this.searchDraft, placeholder: '搜索章名或序号',
          availableWidthVp: this.geometry.content.frame.width,
          actionEnabled: this.interactive && !this.selectionBusy,
          ascending: this.ascending, mangaFontScale: this.mangaFontScale(),
          onTextChange: (value: string): void => {
            if (this.directoryInputIsCurrent(identity)) { this.searchDraft = value; this.applySearch(value); }
          },
          onSearch: (): void => { if (this.directoryInputIsCurrent(identity)) this.applySearch(); },
          onToggleSort: (): void => { if (this.directoryInputIsCurrent(identity)) this.toggleSort(); },
          onOpenCacheManagement: (): void => {
            if (this.directoryInputIsCurrent(identity) && !this.selectionBusy) this.onOpenCacheManagement();
          },
        }).hitTestBehavior(HitTestMode.Default);
      }.width('100%').alignItems(HorizontalAlign.Start)
        .id(measurement.id)
        .onAppear((): void => measurement.mount(this.getUIContext(), this.mangaMeasurementKey,
          (height: number, key: number): void => this.recordMangaHeight('tools', height, key)))
        .onDisAppear((): void => measurement.unmount())
        .onAreaChange(this.mangaHeightHandler('tools', this.mangaMeasurementKey));
    }.width(this.geometry.content.frame.width).alignItems(HorizontalAlign.Start)
      .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
      .hitTestBehavior(HitTestMode.Default)
      .onTouch((): void => {})
      .position(inline ? undefined : { x: this.geometry.content.frame.left,
        y: this.geometry.content.startInset - this.mangaToolsHeight });
  }

  @Builder
  private mangaSummary() {
    Column({ space: visual.summaryGap }) {
      Text(this.bookTitle || '漫画目录').fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD)
        .fontWeight(visual.summaryFontWeight).fontSize(visual.summaryFontSize).lineHeight(visual.summaryLineHeight)
        .halfLeading(true).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
        .fontColor(mangaDirectoryColor('ink', this.appThemeScheme)).width('100%').wordBreak(WordBreak.BREAK_WORD);
      Text(this.mangaSummaryLabel()).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
        .fontWeight(visual.bodyFontWeight).fontSize(visual.countFontSize).lineHeight(visual.countLineHeight)
        .halfLeading(true).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
        .fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).width('100%');
    }.width('100%').alignItems(HorizontalAlign.Start).margin({ bottom: visual.summaryBottom });
  }

  @Builder
  private mangaFlowSummary(measurement: ReaderNativeSlotMeasurement) {
    Column() {
      this.mangaSummary();
      this.mangaCurrentFooter(measurement);
    }.width('100%').padding({ top: this.mangaFooterBottomOffset() });
  }

  @Builder
  private mangaCurrentFooter(measurement: ReaderNativeSlotMeasurement = this.footerMeasurement) {
    ReaderDirectoryQuickActions({ title: this.mangaCurrentTitle(), positionLabel: this.mangaCurrentPosition() === '—' ? '' : this.mangaCurrentPosition(),
      scheme: this.appThemeScheme, fontScale: this.mangaFontScale(),
      locateEnabled: this.interactive && !this.selectionBusy && this.currentChapterIndex >= 0,
      edgeEnabled: this.interactive && !this.selectionBusy && (this.mangaLayoutRows.length > 0 || this.navigationActive),
      onLocateCurrent: (): void => this.locateCurrent(),
      onTop: (): void => this.jumpToEdge(Edge.Top),
      onBottom: (): void => this.jumpToEdge(Edge.Bottom),
    }).width(this.mangaFooterFrame(this.geometry.content.frame).width)
      .id(measurement.id)
      .onAppear((): void => measurement.mount(this.getUIContext(), this.mangaMeasurementKey,
        (height: number, key: number): void => this.recordMangaHeight('footer', height, key)))
      .onDisAppear((): void => measurement.unmount())
      .onAreaChange(this.mangaHeightHandler('footer', this.mangaMeasurementKey));
  }

  private mangaHeightHandler(slot: 'tools' | 'footer', presentedKey: number): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => this.recordMangaHeight(slot, readerPageAreaLength(next.height), presentedKey);
  }

  private recordMangaHeight(slot: 'tools' | 'footer', height: number, presentedKey: number): void {
    if (!this.mounted || presentedKey !== this.mangaMeasurementKey || !Number.isFinite(height) || height <= 0) return;
    const previous = slot === 'tools' ? this.mangaToolsHeight : this.mangaFooterMeasured;
    if (Math.abs(height - previous) <= .1) return;
    if (slot === 'tools') this.mangaToolsHeight = height;
    else this.mangaFooterMeasured = height;
    this.refreshGeometry();
  }

  private mangaNarrow(): boolean {
    const width = this.viewportWidth > 0 ? this.viewportWidth : readerWindowMetrics().windowRect.width;
    return width > 0 && width <= visual.narrowWidth;
  }

  private mangaVisibleTopInset(): number {
    return this.geometry.header.bottom;
  }

  private mangaFlowFooter(): boolean {
    const height = this.mangaViewportHeight > 0 ? this.mangaViewportHeight : readerWindowMetrics().windowRect.height;
    return mangaDirectoryFullFlowFooter(height, this.mangaFontScale(), this.topInset(), this.mangaBottomInset(), this.mangaFooterHeight());
  }

  private mangaFontScale(): number {
    const revision = this.readerWindowMetricsRevision;
    return mangaDirectoryScale(revision < 0 ? 1 : readerWindowMetrics().systemFontScale);
  }

  private mangaFooterHeight(): number {
    return this.mangaFooterMeasured > 0 ? this.mangaFooterMeasured :
      readerDirectoryQuickActionsHeight(this.mangaFontScale(), this.mangaCurrentPosition() !== '—');
  }
  private mangaBottomInset(): number { return Math.max(0, readerStableInteractiveSafeBottom(readerWindowMetrics())); }
  /** The footer follows the safe area closely; the released 4vp is usable list space. */
  private mangaFooterBottomOffset(): number { return Math.max(0, visual.footerBottom - 4); }
  private mangaBottomClearance(): number { return this.mangaBottomInset() + (this.mangaFlowFooter() ? 0 : this.mangaFooterHeight()) + this.mangaFooterBottomOffset() * 2; }
  /** Keep the native viewport full height. The dock and its safe gap are paid
   * once inside scroll content, alongside the catalog's existing 18vp tail. */
  private mangaListBottomClearance(): number {
    return this.mangaBottomClearance() + (this.mangaFlowFooter() ? 0 : 18);
  }

  private mangaFooterFrame(frame: SurfaceHorizontalFrame = this.contentFrame()): SurfaceHorizontalFrame {
    // The approved catalog uses 18vp content and a 30vp light dock.
    const inset = Math.max(Math.min(visual.detailDockInset - 18, frame.width / 2), (frame.width - 540) / 2);
    return new SurfaceHorizontalFrame(frame.left + inset, frame.right + inset, Math.max(0, frame.width - inset * 2));
  }

  private headerFrame(): SurfaceHorizontalFrame {
    const frame = this.contentFrame();
    const metrics = readerWindowMetrics();
    const expansion = 18 - 8;
    const left = Math.max(readerInteractiveSafeLeft(metrics), frame.left - expansion);
    const right = Math.max(readerInteractiveSafeRight(metrics), frame.right - expansion);
    return new SurfaceHorizontalFrame(left, right, frame.width + frame.left - left + frame.right - right);
  }

  private onMangaMetricsChanged(): void {
    if (!this.mounted) return;
    this.invalidateFrame();
    this.prepareMangaLayout();
  }

  private onMangaPositionChanged(): void { this.onMangaContentChanged(); }

  private onMangaContentChanged(): void {
    if (this.mounted) this.invalidateFrame();
  }

  private prepareMangaPageFonts(): void {
    const generation = ++this.mangaFontGeneration;
    this.mangaFontsFailed = false;
    this.traceMangaFontPreparation(generation, 'prepare.begin');
    this.traceMangaFontPreparation(generation, 'batch.begin');
    void prepareMangaSheetFonts(DEBUG ? (family: string, phase: string): void => {
      this.traceMangaFontPreparation(generation, `face.${phase}`, family);
    } : undefined)
      .then((ready: boolean): void => {
        this.traceMangaFontPreparation(generation, 'batch.resolve', '', ready);
        this.traceMangaFontPreparation(generation,
          this.mounted && generation === this.mangaFontGeneration ? 'prepare.accept' : 'prepare.discard', '', ready);
        if (this.mounted && generation === this.mangaFontGeneration) {
          this.mangaFontsReady = ready;
          this.mangaFontsFailed = !ready;
        }
      }).catch((): void => {
        this.traceMangaFontPreparation(generation, 'batch.reject');
        this.traceMangaFontPreparation(generation,
          this.mounted && generation === this.mangaFontGeneration ? 'prepare.failed' : 'prepare.discard');
        if (this.mounted && generation === this.mangaFontGeneration) this.mangaFontsFailed = true;
      });
  }

  private traceMangaFontPreparation(generation: number, phase: string, family: string = '', ready: boolean = false): void {
    if (!DEBUG) return;
    hilog.info(0x5244, 'Reader', 'Manga directory font phase=%{public}s generation=%{public}d current=%{public}d mounted=%{public}s family=%{public}s ready=%{public}s',
      phase, generation, this.mangaFontGeneration, String(this.mounted), family, String(ready));
  }

  @Builder
  private mangaFlatList(identity: string) {
    ReaderDirectoryList({
      entries: this.mangaLayoutEntries(), rowHeight: visual.gridHeight, naturalRowHeight: true,
      materializedInsets: this.mangaFlowFooter(),
      prefixBuilder: (): void => { this.mangaFlatPrefix(); },
      tailBuilder: (): void => { this.mangaFlowSummary(this.flowFooterMeasurement); },
      listPaddingX: this.geometry.content.frame.left, listPaddingY: 8,
      listPaddingRight: this.geometry.content.frame.right,
      listPaddingTop: this.geometry.content.startInset, listPaddingBottom: this.geometry.content.endInset,
      edgeEffectMode: EdgeEffect.Spring, scroller: this.listScroller,
      onFirstLayout: (): void => {
        if (this.directoryListIsCurrent(identity, false)) this.onListFirstLayout(identity);
      },
      onUserScrollIntent: (): void => {
        if (!this.navigationActive && this.directoryInputIsCurrent(identity)) this.onListUserScroll();
      },
      rowBuilder: (item: RepeatItem<LocalReadingTocEntry>) => { this.mangaFlatRow(item.item, identity); },
      emptyBuilder: (): void => { this.mangaEmptyState(identity); },
    }).width('100%').height('100%');
  }

  @Builder
  private mangaFlatPrefix() {
    Column() {
      // The actual editor remains in the same overlay parent through a
      // flow/footer threshold; this List prefix reserves its measured space.
      Blank().height(Math.max(0, this.geometry.content.startInset));
    }.width('100%');
  }

  @Builder
  private mangaEmptyState(identity: string = this.admittedIdentity) {
    Column() {
      ReaderPageState({ title: this.emptyMessage(), loading: this.catalogLoading(),
        actionLabel: this.searchQuery.trim().length > 0 ? '清除搜索' : this.catalogRetryVisible() ? '重试加载目录' : '',
        onAction: (): void => {
          if (this.navigationActive || !this.directoryInputIsCurrent(identity)) return;
          if (this.searchQuery.trim().length > 0) { this.searchDraft = ''; this.applySearch(); }
          else this.onRetryCatalog();
        } });
    }.width('100%').constraintSize({ minHeight: visual.quietEmptyMinHeight })
      .padding({ left: visual.quietEmptyPaddingX, right: visual.quietEmptyPaddingX,
        top: visual.quietEmptyPaddingY, bottom: visual.quietEmptyPaddingY }).justifyContent(FlexAlign.Center);
  }

  @Builder
  private mangaFlatRow(entry: LocalReadingTocEntry, identity: string) {
    MangaDirectoryEntryRow({ row: this.mangaLayoutRow(entry), presentation: this.mangaPresentation,
      scheme: this.appThemeScheme, currentChapterIndex: this.currentChapterIndex,
      collapsedBranches: this.mangaCollapsedGroups, query: this.searchQuery,
      interactionEnabled: this.interactive && !this.selectionBusy && !this.navigationActive, chapterDownloadEnabled: this.mangaDownloadEnabled,
      onSelectEntry: (selected: LocalReadingTocEntry): void => {
        if (!this.selectionBusy && !this.navigationActive && this.directoryInputIsCurrent(identity)) this.selectMangaEntry(selected, identity);
      },
      onToggleBranch: (selected: LocalReadingTocEntry): void => {
        if (!this.selectionBusy && !this.navigationActive && this.directoryInputIsCurrent(identity)) this.toggleMangaBranch(selected, identity);
      },
      onDownloadEntry: (selected: LocalReadingTocEntry): void => {
        if (!this.navigationActive && this.directoryInputIsCurrent(identity) && this.rowIsCurrent(selected, identity) &&
          this.mangaEntryIsDisplayed(selected) && selected.downloadState !== 'unknown')
          void this.openDownloadActions(selected.index);
      },
    });
  }

  private selectMangaEntry(entry: LocalReadingTocEntry, identity: string): void {
    if (this.rowIsCurrent(entry, identity) && this.mangaEntryIsDisplayed(entry)) this.onSelectChapter(entry.index);
  }

  private toggleMangaBranch(entry: LocalReadingTocEntry, identity: string): void {
    if (!this.mounted || this.searchQuery.trim().length > 0 || identity !== this.identity() || identity !== this.admittedIdentity ||
      !sameReaderDirectoryData(this.admittedEntries, this.entries) || this.mangaPresentation.get(entry.index)?.hasChildren !== true ||
      !this.mangaEntryIsDisplayed(entry)) return;
    const current = this.projectedByIndex.get(entry.index);
    if (current === undefined || !sameReaderDirectoryData([current], [entry])) return;
    this.mangaCollapsedGroups = this.mangaCollapsedGroups.includes(entry.index) ?
      this.mangaCollapsedGroups.filter((index: number): boolean => index !== entry.index) : [...this.mangaCollapsedGroups, entry.index];
    this.onListUserScroll();
    this.prepareMangaLayout();
  }

  private prepareMangaLayout(entries: LocalReadingTocEntry[] = this.projectedEntries, query: string = this.searchQuery,
    collapsed: number[] = this.mangaCollapsedGroups, treeActive: boolean = this.navigationActive): void {
    if (treeActive) return;
    const rows = mangaDirectoryEntryRows(this.mangaVisibleEntries(entries, query, collapsed), this.mangaPresentation,
      this.mangaNarrow(), this.mangaFontScale(), this.contentFrame().width, (entry: LocalReadingTocEntry): number => {
        const glyph = this.mangaDownloadEnabled && entry.navigable !== false && entry.downloadState !== 'unknown';
        return (glyph ? visual.downloadGridWidth : 0) + mangaDirectoryDownloadStatusWidth(entry.downloadState, glyph, this.mangaFontScale());
      }, query);
    this.layoutRowsByFirst.clear();
    this.displayedByIndex.clear();
    this.displayedRowByIndex.clear();
    const firstEntries: LocalReadingTocEntry[] = [];
    rows.forEach((row: MangaDirectoryLayoutRow, position: number): void => {
      const first = row.entries[0];
      this.layoutRowsByFirst.set(first.index, row);
      firstEntries.push(first);
      for (const entry of row.entries) {
        this.displayedByIndex.set(entry.index, entry);
        this.displayedRowByIndex.set(entry.index, position);
      }
    });
    this.firstLayoutEntries = firstEntries;
    this.mangaLayoutRows = rows;
  }

  private mangaLayoutEntries(): LocalReadingTocEntry[] {
    return this.firstLayoutEntries;
  }

  private mangaLayoutRow(entry: LocalReadingTocEntry): MangaDirectoryLayoutRow {
    return this.layoutRowsByFirst.get(entry.index) ?? { kind: 'row', columns: 1, startIndex: 0, entries: [], labels: [] };
  }

  private mangaEntryIsDisplayed(entry: LocalReadingTocEntry): boolean {
    const current = this.displayedByIndex.get(entry.index);
    return current !== undefined && sameReaderDirectoryData([current], [entry]);
  }

  private mangaSummaryLabel(): string {
    return this.mangaSummaryText;
  }

  private refreshMangaSummary(entries: LocalReadingTocEntry[]): void {
    let readable = 0, groups = 0;
    let unknown = false;
    for (const entry of entries) {
      if (entry.navigable === true) readable++;
      if (entry.navigable === undefined) unknown = true;
      if (this.mangaIsGroup(entry)) groups++;
    }
    this.mangaSummaryText = `${readable} 个${unknown ? '已确认' : ''}可读条目${groups > 0 ? ` · ${groups} 个卷组` : ''}`;
  }

  private mangaIsGroup(entry: LocalReadingTocEntry): boolean {
    return this.mangaPresentation.get(entry.index)?.group === true;
  }

  private consumeTemporaryBack(identity: string): boolean {
    if (!this.mounted || identity.length === 0 || identity !== this.temporaryBackIdentity) return false;
    if (consumeReaderControlKeyboardBack(readerWindowMetrics(), {
      hideTextInput: (): Promise<void> => inputMethod.getController().hideTextInput(),
      onFailure: (error: Error): void => {
        if (this.mounted && identity === this.temporaryBackIdentity) {
          hilog.warn(0x5244, 'Reader', 'Manga directory keyboard dismissal: %{private}s', error.message);
        }
      },
    })) return true;
    if (this.downloadMenuCloseTimer >= 0) return true;
    if (!this.downloadMenuVisible) return false;
    this.closeDownloadMenu();
    return true;
  }

  private closeDownloadMenu(): void {
    const generation = this.downloadMenuGeneration;
    // Native onClosed releases Back. If show and hide are coalesced before
    // native presentation, there may be no dismissal event to release it.
    this.downloadMenuCloseTimer = setTimeout((): void => {
      if (this.mounted && generation === this.downloadMenuGeneration) this.retireDownloadMenu();
    }, MANGA_DOWNLOAD_POPUP_CLOSE_RECEIPT_TIMEOUT_MS);
    this.downloadMenuVisible = false;
  }

  private retireDownloadMenu(): void {
    this.downloadMenuGeneration += 1;
    if (this.downloadMenuCloseTimer >= 0) clearTimeout(this.downloadMenuCloseTimer);
    this.downloadMenuCloseTimer = -1;
    this.downloadMenuVisible = false;
    this.downloadMenuIdentity = '';
  }

  @Builder
  private mangaDownloadMenuButton() {
    if (this.mangaDownloadEnabled) {
      ForEach([this.identity()], (identity: string): void => {
        ReaderMangaDownloadPopup({ specId: 'manga-download', visible: this.downloadMenuVisible, generation: this.downloadMenuGeneration,
          reduceMotion: this.reduceMotion,
          focusId: 'reader-manga-download:' + JSON.stringify([identity, this.temporaryBackIdentity]),
          availableWidth: this.contentFrame().width, actions: this.downloadActions, loading: this.downloadActionsLoading,
          failureMessage: this.downloadActionsFailure,
          directoryRecovery: this.directoryRecovery, recoveryActive: this.directoryInputIsCurrent(identity),
          onReconcileOffline: (generation: number, presentation: string, popupGeneration: number): void => {
            if (this.directoryInputIsCurrent(identity) && this.downloadMenuVisible && popupGeneration === this.downloadMenuGeneration)
              this.onReconcileOffline(generation, presentation);
          },
          onContinueOffline: (generation: number, presentation: string, popupGeneration: number): void => {
            if (this.directoryInputIsCurrent(identity) && this.downloadMenuVisible && popupGeneration === this.downloadMenuGeneration)
              this.onContinueOffline(generation, presentation);
          },
          onOpen: (): void => { if (this.mounted && identity === this.identity()) void this.openDownloadActions(); },
          onClosed: (generation: number): void => {
            if (this.mounted && identity === this.identity() && generation === this.downloadMenuGeneration) this.retireDownloadMenu();
          },
          onAction: (action: MangaDownloadActionId, generation: number): void => {
            if (this.mounted && identity === this.identity() && generation === this.downloadMenuGeneration) this.performDownloadAction(action);
          },
          onRetry: (generation: number): void => {
            if (this.mounted && this.downloadMenuVisible && identity === this.identity() && generation === this.downloadMenuGeneration)
              void this.openDownloadActions(this.downloadMenuChapterIndex);
          } });
      }, (identity: string): string => identity);
    }
  }

  private async openDownloadActions(chapterIndex?: number): Promise<void> {
    if (!this.directoryInputIsCurrent() || !this.mangaDownloadEnabled || this.downloadMenuCloseTimer >= 0) return;
    const generation = ++this.downloadMenuGeneration, identity = this.identity();
    this.downloadMenuIdentity = identity;
    this.downloadMenuChapterIndex = chapterIndex; this.downloadMenuVisible = true;
    this.downloadActions = []; this.downloadActionsFailure = ''; this.downloadActionsLoading = true;
    const current = (): boolean => this.mounted && this.downloadMenuVisible && generation === this.downloadMenuGeneration && identity === this.identity();
    try {
      const actions = await this.onLoadDownloadActions(chapterIndex);
      if (current()) this.downloadActions = actions;
    } catch (_) {
      if (current()) this.downloadActionsFailure = '下载状态暂时无法读取，请重试';
    } finally {
      if (current()) this.downloadActionsLoading = false;
    }
  }

  private performDownloadAction(action: MangaDownloadActionId): void {
    if (!this.directoryInputIsCurrent() || !this.mangaDownloadEnabled ||
      !this.downloadMenuVisible || this.downloadMenuIdentity !== this.identity() || this.downloadActionsLoading ||
      !this.downloadActions.some(item => item.id === action)) return;
    const chapterIndex = this.downloadMenuChapterIndex;
    this.closeDownloadMenu();
    void this.onDownloadAction(action, chapterIndex).catch((): void => {
      // Index owns operation feedback. Do not turn a catalog action into a
      // failed/unhandled reader lifecycle promise.
    });
  }

  private mangaCurrentTitle(): string {
    const entry = this.directoryPublication.entryAt(this.directoryDataRevision, this.currentChapterIndex);
    return entry === undefined ? '尚未开始阅读' : mangaDirectoryDisplay(entry).title;
  }

  private mangaCurrentPosition(): string {
    // This footer describes the current image inside the chapter. The TOC
    // ordinal is not a page number and must never be shown as one.
    if (this.currentPageOrdinal === undefined || this.currentPageTotal === undefined ||
      this.currentPageOrdinal < 0 || this.currentPageTotal <= this.currentPageOrdinal) return '—';
    return `${this.currentPageOrdinal + 1} / ${this.currentPageTotal} 页`;
  }

  private mangaVisibleEntries(entries: LocalReadingTocEntry[] = this.projectedEntries, query: string = this.searchQuery,
    collapsed: number[] = this.mangaCollapsedGroups): LocalReadingTocEntry[] {
    // Search reveals matches and their original volume path even when folded.
    if (query.length > 0) return entries;
    return mangaDirectoryVisibleEntries(entries, this.mangaPresentation, collapsed);
  }

  private topInset(): number {
    if (this.readerWindowMetricsRevision < 0) return 0;
    const metrics = readerWindowMetrics();
    return this.catalogContext === 'detail' ? readerStableInteractiveSafeTop(metrics) : readerInteractiveSafeTop(metrics);
  }

  private locateCurrent(): void {
    if (!this.directoryInputIsCurrent() || this.selectionBusy || this.currentChapterIndex < 0) return;
    this.searchDraft = '';
    this.searchQuery = '';
    const currentEntry = this.directoryPublication.entryAt(this.directoryDataRevision, this.currentChapterIndex);
    const ancestors = currentEntry === undefined ? [] : this.mangaPresentation.get(currentEntry.index)?.ancestorGroupIndexes ?? [];
    const collapsed = this.mangaCollapsedGroups.filter((index: number): boolean => !ancestors.includes(index));
    this.mangaCollapsedGroups = collapsed;
    this.navigationInteracted = false;
    this.refreshFlatProjection('', this.ascending, collapsed);
    this.pendingScrollEdge = undefined;
    this.pendingLocateChapter = this.currentChapterIndex;
    this.locateCurrentRevision += 1;
    const generation = ++this.scrollGeneration;
    const context = this.getUIContext();
    context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
      if (generation === this.scrollGeneration && this.directoryInputIsCurrent()) this.flushPendingScroll();
    }));
  }

  private identity(): string { return `${this.sourceId}\u0000${this.bookId}`; }

  private directoryListIsCurrent(identity: string, tree: boolean): boolean {
    return this.mounted && identity === this.admittedIdentity && identity === this.identity() && this.navigationActive === tree;
  }

  private directoryInputIsCurrent(identity: string = this.admittedIdentity): boolean {
    return this.mounted && this.interactive && identity === this.admittedIdentity && identity === this.identity() && this.isOpeningCurrent();
  }

  private rowIsCurrent(entry: LocalReadingTocEntry, identity: string): boolean {
    if (!this.mounted || identity !== this.identity() || identity !== this.admittedIdentity ||
      entry.navigable === false || !sameReaderDirectoryData(this.admittedEntries, this.entries)) return false;
    // ArkUI @Prop copies the List's objects. Compare the Core-backed facts,
    // never object references across that component boundary.
    const current = this.projectedByIndex.get(entry.index);
    return current !== undefined && sameReaderDirectoryData([entry], [current]);
  }

  private onIdentityChanged(): void {
    if (this.mounted) this.invalidateFrame();
    this.retireDownloadMenu();
    this.mangaCollapsedGroups = [];
    this.locateCurrentRevision = 0;
    this.pendingLocateChapter = -1;
    // The identity comparison blocks old-row callbacks immediately; publish
    // the next keyed List and projection together after reconciliation.
    this.onEntriesChanged();
  }

  private onEntriesChanged(): void {
    if (!this.mounted) return;
    const generation = ++this.projectionGeneration;
    setTimeout((): void => {
      if (!this.mounted || generation !== this.projectionGeneration) return;
      this.admitEntries(this.admittedIdentity !== this.identity());
    }, 0);
  }

  private admitEntries(reset: boolean): void {
    const wasEmpty = this.projectedEntries.length === 0;
    const previous = new Map<number, LocalReadingTocEntry>();
    for (const index of this.mangaCollapsedGroups ?? []) {
      const entry = this.directoryPublication.entryAt(this.directoryDataRevision, index);
      if (entry !== undefined) previous.set(index, entry);
    }
    const previousIdentity = this.admittedIdentity;
    if (reset) {
      this.searchDraft = '';
      this.searchQuery = '';
      this.ascending = true;
      this.listReady = false;
      this.navigationInteracted = false;
      this.navigationActive = false;
    }
    this.admittedIdentity = this.identity();
    const revision = this.directoryPublication.publish(this.entries);
    const admitted = this.directoryPublication.entriesAt(revision);
    if (!reset && this.admittedEntries === admitted) return;
    this.directoryDataRevision = revision;
    this.admittedEntries = admitted;
    this.mangaPresentation = mangaDirectoryPresentation(admitted);
    this.refreshMangaSummary(admitted);
    const previousGroups = this.mangaCollapsedGroups ?? [];
    const collapsed = previousIdentity === this.admittedIdentity ? previousGroups.filter((index: number): boolean => {
      const before = previous.get(index);
      const after = this.directoryPublication.entryAt(revision, index);
      return before !== undefined && after !== undefined && this.mangaPresentation.get(after.index)?.hasChildren === true &&
        sameReaderDirectoryData([before], [after]);
    }) : [];
    this.mangaCollapsedGroups = collapsed;
    this.refreshFlatProjection(reset ? '' : this.searchQuery, reset ? true : this.ascending, collapsed,
      !reset && this.navigationActive);
    this.invalidateFrame();
    if (reset || wasEmpty && !this.navigationActive) this.scheduleTopScroll();
  }

  private applySearch(value: string = this.searchDraft): void {
    const nextQuery = value.trim();
    if (nextQuery === this.searchQuery) return;
    if (nextQuery.length === 0 && this.currentChapterIndex >= 0) {
      this.locateCurrent();
      return;
    }
    this.searchQuery = nextQuery;
    if (nextQuery.length === 0) this.navigationInteracted = false;
    this.refreshFlatProjection(nextQuery, this.ascending, this.mangaCollapsedGroups);
    if (!this.navigationActive) {
      if (this.mangaFlowFooter() && nextQuery.length > 0) this.onListUserScroll();
      else this.scheduleTopScroll();
    }
  }

  private toggleSort(): void {
    const nextAscending = !this.ascending;
    this.ascending = nextAscending;
    this.refreshFlatProjection(this.searchQuery, nextAscending, this.mangaCollapsedGroups);
    if (!this.navigationActive) this.scheduleTopScroll();
  }

  private scheduleTopScroll(): void {
    if (this.navigationActive) return;
    const generation = ++this.scrollGeneration;
    this.pendingLocateChapter = -1;
    this.pendingScrollEdge = Edge.Top;
    setTimeout((): void => {
      if (generation === this.scrollGeneration && !this.navigationActive) this.flushPendingScroll();
    }, 0);
  }

  private refreshFlatProjection(query: string, ascending: boolean, collapsed: number[],
    treeActive: boolean = this.navigationActive): void {
    if (treeActive) return;
    if (this.mangaContextSource !== this.admittedEntries) {
      this.mangaContextSource = this.admittedEntries;
      this.mangaContextEntries = mangaDirectoryContextEntries(this.admittedEntries, this.mangaPresentation);
    }
    const entries = projectReaderDirectoryEntries(this.mangaContextEntries, query, ascending, true);
    this.projectedByIndex.clear();
    for (const entry of entries) this.projectedByIndex.set(entry.index, entry);
    this.projectedEntries = entries;
    this.prepareMangaLayout(entries, query, collapsed, false);
  }

  private onListFirstLayout(identity: string): void {
    if (!this.mounted || identity !== this.admittedIdentity || identity !== this.identity()) return;
    this.listReady = true;
    this.flushPendingScroll();
  }

  private onListUserScroll(): void {
    this.scrollGeneration += 1;
    this.pendingScrollEdge = undefined;
    this.pendingLocateChapter = -1;
    this.navigationInteracted = true;
  }

  private flushPendingScroll(): void {
    if (!this.mounted || !this.listReady) return;
    const locate = this.pendingLocateChapter;
    if (locate >= 0) {
      this.pendingLocateChapter = -1;
      if (this.navigationActive) return;
      const index = this.displayedRowByIndex.get(locate);
      if (index !== undefined) this.listScroller.scrollToIndex(index + (this.mangaFlowFooter() ? 1 : 0), false, ScrollAlign.CENTER);
      return;
    }
    const edge = this.pendingScrollEdge;
    if (!this.mounted || !this.listReady ||
      (this.projectedEntries.length === 0 && !this.navigationActive) || edge === undefined) return;
    this.pendingScrollEdge = undefined;
    if (edge === Edge.Top && !this.mangaFlowFooter()) {
      // Fixed catalogs reserve the tracked editor/header with contentStartOffset.
      // START keeps that reservation; the container edge can hide it and a row.
      this.listScroller.scrollToIndex(0, false, ScrollAlign.START);
    } else {
      // The short-host variant materializes its spacer as the first item.
      this.listScroller.scrollEdge(edge);
    }
    if (this.navigationActive) readerDirectorySignalScrollCommand(readerDirectoryScopeKey(this.sourceId, this.bookId));
  }

  private jumpToEdge(edge: Edge): void {
    if (!this.directoryInputIsCurrent() || this.selectionBusy) return;
    readerDirectorySignalScrollIntent(readerDirectoryScopeKey(this.sourceId, this.bookId));
    this.onListUserScroll();
    this.pendingScrollEdge = edge;
    this.flushPendingScroll();
  }

  private emptyMessage(): string {
    if (this.searchQuery.length > 0 && this.admittedEntries.length > 0) return '没有匹配的章节';
    return this.catalogMessage.trim().length > 0 ? this.catalogMessage : '暂无章节信息';
  }

  private catalogLoading(): boolean { return this.catalogBusy; }

  private catalogRetryVisible(): boolean {
    if (this.searchQuery.length > 0 || this.navigationActive) return false;
    // Do not expose a retry action while the owner is still acquiring the
    // first catalog. Empty/error projections remain actionable in place.
    return !this.catalogBusy;
  }

  private contentFrame(): SurfaceHorizontalFrame {
    this.readerWindowMetricsRevision;
    const metrics = readerWindowMetrics();
    const width = this.viewportWidth > 0 ? this.viewportWidth :
      (this.readerWindowMetricsRevision < 0 ? 0 : metrics.windowRect.width);
    return resolveHorizontalFrame(width, readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics),
      new SurfaceWidthSpec(visual.contentWidthMax, 18, 18, 'center'));
  }

  private recordViewport(area: Area): void {
    if (!this.mounted) return;
    const width = readerPageAreaLength(area.width);
    const height = readerPageAreaLength(area.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
    const widthChanged = Math.abs(width - this.viewportWidth) > .1;
    if (!widthChanged && Math.abs(height - this.mangaViewportHeight) <= .1) return;
    this.viewportWidth = width;
    this.mangaViewportHeight = height;
    this.invalidateFrame();
    if (widthChanged) this.prepareMangaLayout();
  }

  private recordHeaderHeight(slot: string, height: number, presentedKey: number): void {
    if (!this.mounted || presentedKey !== this.measurementKey || height <= 0) return;
    if (this.measurements.record(slot, height, presentedKey, .1)) this.refreshGeometry();
  }

  private invalidateFrame(): void {
    if (!this.mounted) return;
    const metrics = readerWindowMetrics();
    const header = this.headerFrame();
    const headerInputs = JSON.stringify([this.identity(), this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width,
      header.left, header.right, metrics.systemFontScale, metrics.densityPixels, metrics.ready, this.mangaFontsReady]);
    const mangaInputs = JSON.stringify([headerInputs, this.mangaFooterFrame().width, this.bookTitle,
      this.mangaSummaryLabel(), this.mangaCurrentTitle(), this.mangaCurrentPosition()]);
    if (headerInputs !== this.headerInputs) {
      this.headerInputs = headerInputs;
      this.measurementKey += 1;
    }
    if (mangaInputs !== this.mangaInputs) {
      this.mangaInputs = mangaInputs;
      this.mangaMeasurementKey += 1;
      this.mangaFooterMeasured = 0;
      this.toolsMeasurement.request(this.mangaMeasurementKey);
      this.footerMeasurement.request(this.mangaMeasurementKey);
      this.flowFooterMeasurement.request(this.mangaMeasurementKey);
      this.treeFooterMeasurement.request(this.mangaMeasurementKey);
    }
    this.refreshGeometry();
  }

  private directoryScrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.geometry, { mode: 'contentOffset' });
  }

  private mangaFrameStyle(): ReaderFrameStyle {
    const pageBackground = readerAppColor('TOK_PAPER', this.appThemeScheme);
    return readerFrameStyle({ backgroundColor: pageBackground, alignment: 'top',
      headerBackground: pageBackground, headerTransparent: true, footerBackground: pageBackground });
  }

  private refreshGeometry(): void {
    const metrics = readerWindowMetrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.viewportWidth > 0 ? this.viewportWidth :
      (this.readerWindowMetricsRevision < 0 ? 0 : metrics.windowRect.width);
    input.viewportHeight = this.mangaViewportHeight;
    input.measurementRevision = ++this.geometryRevision;
    input.contentHorizontalSafeArea = 'interactive';
    const minimumHeaderHeight = mangaDirectoryHeaderHeight(this.mangaFontScale());
    const header = this.headerFrame();
    const footer = this.mangaFooterFrame();
    input.headerTop = this.topInset() + visual.headerSafeGap;
    input.headerHeight = Math.max(minimumHeaderHeight, this.measurements.readForGeneration('bookDirectory:mangaHeader', this.measurementKey, minimumHeaderHeight));
    input.headerInsetLeft = header.left;
    input.headerInsetRight = header.right;
    input.footerInsetLeft = footer.left;
    input.footerInsetRight = footer.right;
    input.footerBottom = this.mangaBottomInset() + this.mangaFooterBottomOffset();
    input.footerHeight = this.mangaFlowFooter() ? 0 : this.mangaFooterHeight();
    input.contentGap = visual.contentTop - visual.headerHeight - visual.headerSafeGap + this.mangaToolsHeight;
    input.contentMaxWidth = visual.contentWidthMax;
    input.contentHorizontalPadding = TOK_SCREEN_INSET;
    input.contentEndInset = this.mangaListBottomClearance();
    this.geometry = resolveReaderPageGeometry(input);
  }

}
