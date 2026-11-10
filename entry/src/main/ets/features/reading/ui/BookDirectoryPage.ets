import hilog from '@ohos.hilog';
import inputMethod from '@ohos.inputMethod';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { mangaDirectoryDisplay } from '../../manga/ui/MangaDirectoryDisplay';
import { mangaDirectoryContextEntries, mangaDirectoryDownloadStatusWidth } from '../../manga/ui/MangaDirectoryState';
import { LengthMetrics } from '@kit.ArkUI';
import { MangaDirectoryCurrentFooter } from '../../manga/ui/MangaDirectoryCurrentFooter';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor, mangaDirectoryScale, mangaDirectoryFooterHeight, mangaDirectoryHeaderHeight, mangaDirectoryFullFlowFooter } from '../../manga/ui/MangaDirectoryVisual';
import { ReaderDirectoryRecoverySurface } from './ReaderDirectoryRecoverySurface';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../presentation/ReadingDirectoryRecovery';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { consumeReaderControlKeyboardBack } from '../../../ui/foundation/ReaderKeyboardBack';
import { PageBackBar } from '../../../ui/chrome/PageBackBar';
import { registerReaderFonts, prepareMangaSheetFonts, prepareReaderFontFamily } from '../../../ui/foundation/ReaderFonts';
import { ReaderFrameStyle, readerFrameStyle } from '../../../ui/layout/ReaderFrameStyle';
import { ReaderScrollLayout, readerScrollLayout } from '../../../ui/layout/ReaderScrollLayout';
import { readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeTop } from '../../../ui/foundation/ReaderWindowMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from '../../../ui/layout/SurfaceHorizontalGeometry';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { snapshotReaderDirectoryData, sameReaderDirectoryData } from '../presentation/ReaderDirectoryDataSnapshot';
import { projectReaderDirectoryEntries } from '../presentation/ReaderDirectoryProjection';
import { ReaderDirectoryToolbar } from './ReaderDirectoryToolbar';
import { ReaderDirectoryList } from './ReaderDirectoryList';
import { ReaderDirectoryNavigationSurface } from './ReaderDirectoryNavigationSurface';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { ReaderMangaDownloadPopup } from '../../manga/ui/ReaderMangaDownloadPopup';
import type { MangaDownloadAction, MangaDownloadActionId } from '../../manga/application/MangaDownloadActionsGateway';
import { mangaDirectoryPresentation, mangaDirectoryVisibleEntries,
  type MangaDirectoryRowPresentation } from '../../manga/presentation/MangaDirectoryPresentation';
import { mangaDirectoryEntryRows, type MangaDirectoryLayoutRow } from '../../manga/ui/MangaDirectoryLayout';
import { MangaDirectoryEntryRow } from '../../manga/ui/MangaDirectoryEntryRow';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SERIF_SC_BOLD } from '../../../ui/foundation/ReaderFontFamilies';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { ReaderPageScaffold } from '../../../ui/layout/ReaderPageScaffold';
import { ReaderMeasurementStore } from '../../../ui/layout/ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput,
  resolveReaderPageGeometry } from '../../../ui/layout/ReaderPageGeometry';

const MANGA_DOWNLOAD_POPUP_CLOSE_RECEIPT_TIMEOUT_MS = 750;
let bookDirectoryBackGeneration = 0;

/** Manga catalog shared by detail, the retained reader and source-switch candidates. */
@Component
export struct BookDirectoryPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('onMangaMetricsChanged') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onIdentityChanged') sourceId: string = '';
  @Prop @Watch('onIdentityChanged') bookId: string = '';
  @Prop @Watch('onEntriesChanged') entries: LocalReadingTocEntry[] = [];
  @Prop catalogMessage: string = '';
  @Prop catalogBusy: boolean = false;
  @Prop interactive: boolean = true;
  isOpeningCurrent: () => boolean = (): boolean => true;
  @Prop directoryRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  onReconcileBookmarks: (generation: number, identity: string) => void = (): void => {};
  onContinueBookmarks: (generation: number, identity: string) => void = (): void => {};
  onReconcileOffline: (generation: number, identity: string) => void = (): void => {};
  onContinueOffline: (generation: number, identity: string) => void = (): void => {};

  @Prop bookTitle: string = '';
  @Prop currentChapterIndex: number = -1;
  /** Core manga location page, kept separate from the TOC row ordinal. */
  @Prop @Watch('onMangaPositionChanged') currentPageOrdinal: number = -1;
  @Prop @Watch('onMangaPositionChanged') currentPageTotal: number = -1;
  @Prop @Watch('prepareMangaLayout') mangaDownloadEnabled: boolean = false;
  onLoadDownloadActions: (chapterIndex?: number) => Promise<MangaDownloadAction[]> = async (): Promise<MangaDownloadAction[]> => [];
  onDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number) => Promise<void> = async (): Promise<void> => {};
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
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  @State private mangaToolsHeight: number = 175;
  @State private mangaFooterMeasured: number = 0;
  @State private mangaScrollOffset: number = 0;
  @State private mangaFontsReady: boolean = false;
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
  private pendingMangaCurrentScroll: boolean = false;
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
    this.projectionGeneration += 1;
    this.scrollGeneration += 1;
    this.admittedIdentity = '';
    this.listReady = false;
    this.pendingScrollEdge = undefined;
    this.pendingMangaCurrentScroll = false;
  }

  @Builder
  private recoveryContent() {
    if (this.directoryRecovery.bookmarks.visible || this.directoryRecovery.offline.visible) {
      ReaderDirectoryRecoverySurface({ recovery: this.directoryRecovery,
        onReconcileBookmarks: this.onReconcileBookmarks, onContinueBookmarks: this.onContinueBookmarks,
        onReconcileOffline: this.onReconcileOffline, onContinueOffline: this.onContinueOffline });
    }
  }

  @Builder
  private pageRecoveryOverlay() {
    if (this.directoryRecovery.bookmarks.visible || this.directoryRecovery.offline.visible) {
      Scroll() {
        Column({ space: 8 }) {
          this.recoveryContent();
        }.width('100%').hitTestBehavior(HitTestMode.Transparent);
      }.width(this.geometry.content.frame.width)
        .constraintSize({ maxHeight: Math.max(0, ReaderWindowCoordinator.metrics().windowRect.height / 3) })
        .margin({ left: this.geometry.content.frame.left, right: this.geometry.content.frame.right,
          top: this.geometry.header.bottom })
        .visibility(this.downloadMenuVisible ? Visibility.Hidden : Visibility.Visible)
        .hitTestBehavior(HitTestMode.Transparent);
    }
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
      content: (): void => {
        if (this.mangaFontsReady) {
          this.mangaContent();
        } else {
          this.fontPreparationContent();
        }
      },
      header: (): void => { this.mangaHeader(); },
      footer: (): void => {
        if (this.mangaFontsReady) {
          this.mangaFixedFooter();
        }
      },
      overlayContent: (): void => {
        if (this.mangaFontsReady) {
          this.pageRecoveryOverlay();
        }
      },
      onHeaderHeightChange: (height: number, presentedKey: number): void => {
        this.recordHeaderHeight('bookDirectory:mangaHeader', height, presentedKey);
      },
    }).onAreaChange((_old: Area, area: Area): void => this.recordViewport(area));
  }

  @Builder
  private mangaContent() {
    // The summary/tools track the directory scroll offset inside the body;
    // the fixed header and current-chapter dock are owned by the scaffold.
    Stack({ alignContent: Alignment.Top }) {
      ForEach([this.admittedIdentity], (identity: string) => {
        ReaderDirectoryNavigationSurface({
          sourceId: this.sourceId, bookId: this.bookId, query: this.searchQuery, ascending: this.ascending,
          currentChapterIndex: this.currentChapterIndex, openRevision: identity,
          interactionEnabled: this.interactive,
          locateCurrentRevision: this.locateCurrentRevision,
          interacted: this.navigationInteracted, mangaDisplay: true,
          mangaInitialViewportWidth: this.viewportWidth > 0 ? this.viewportWidth : ReaderWindowCoordinator.metrics().windowRect.width,
          mangaVisibleTopInset: this.mangaVisibleTopInset(), mangaCatalogNarrow: this.mangaNarrow(),
          rowHeight: visual.gridHeight, listPaddingX: this.geometry.content.frame.left,
          listPaddingRight: this.geometry.content.frame.right,
          listPaddingY: visual.gridGap, listPaddingTop: 0, listPaddingBottom: 0,
          scrollLayout: this.directoryScrollLayout(),
          edgeEffectMode: EdgeEffect.Spring, scroller: this.listScroller,
          chapterEntries: this.admittedEntries,
          chapterDownloadEnabled: this.mangaDownloadEnabled,
          chapterDownloadActionsEnabled: this.mangaDownloadEnabled,
          onDownloadChapter: (index: number): void => {
            if (this.navigationActive && this.directoryInputIsCurrent(identity)) void this.openDownloadActions(index);
          },
          fallbackBuilder: (): void => { this.mangaFlatList(identity); },
          onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number,
            positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void => {
            if (this.navigationActive && this.directoryInputIsCurrent(identity))
              this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
          },
          onFirstLayout: (): void => {
            if (this.directoryListIsCurrent(identity, true)) this.onListFirstLayout(identity);
          },
          onUserScrollIntent: (): void => {
            if (this.navigationActive && this.directoryInputIsCurrent(identity)) this.onListUserScroll();
          },
          onScrollOffset: (offset: number): void => {
            if (this.directoryListIsCurrent(identity, true)) this.onMangaScrollOffset(offset);
          },
          onClearSearch: (): void => {
            if (this.navigationActive && this.directoryInputIsCurrent(identity)) { this.searchDraft = ''; this.applySearch(); }
          },
          onTreeStateChange: (active: boolean): void => {
            if (!this.mounted || identity !== this.admittedIdentity || identity !== this.identity() ||
              active === this.navigationActive) return;
            this.navigationActive = active; this.listReady = false;
          },
        }).width('100%').height('100%');
        this.mangaToolbar(identity);
      }, (identity: string): string => identity);
    }.width('100%').height('100%');
  }

  @Builder
  private mangaHeader() {
    PageBackBar({ title: '章节目录', floating: true, centered: true, variant: 'mangaDirectory',
      onBack: (): void => {
        if (this.directoryInputIsCurrent() && !this.consumeTemporaryBack(this.temporaryBackIdentity)) this.onBack();
      },
      trailing: (): void => {
        if (this.mangaFontsReady) {
          this.mangaDownloadMenuButton();
        }
      } });
  }

  @Builder
  private mangaFixedFooter() {
    if (!this.mangaFlowFooter()) { this.mangaCurrentFooter(); }
  }

  @Builder
  private mangaToolbar(identity: string) {
    Column() {
      Column({ space: visual.summaryGap }) {
        Text(this.bookTitle || '漫画目录').fontFamily(READER_FONT_NOTO_SERIF_SC_BOLD)
          .fontWeight(visual.summaryFontWeight).fontSize(visual.summaryFontSize).lineHeight(visual.summaryLineHeight).halfLeading(true).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).fontColor(mangaDirectoryColor('ink', this.appThemeScheme))
          .width('100%').wordBreak(WordBreak.BREAK_WORD)
          .accessibilityText(this.bookTitle || '漫画目录');
        Text(this.mangaSummaryLabel()).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR)
          .fontWeight(visual.bodyFontWeight).fontSize(visual.countFontSize).lineHeight(visual.countLineHeight).halfLeading(true).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).fontColor(mangaDirectoryColor('muted', this.appThemeScheme))
          .width('100%');
      }.width('100%').alignItems(HorizontalAlign.Start).margin({ bottom: visual.summaryBottom });
      ReaderDirectoryToolbar({
        variant: 'manga-catalog', text: this.searchDraft, placeholder: '搜索章名或序号',
        ascending: this.ascending, mangaFontScale: this.mangaFontScale(), locateEnabled: this.currentChapterIndex >= 0,
        onTextChange: (value: string): void => {
          if (this.directoryInputIsCurrent(identity)) { this.searchDraft = value; this.applySearch(); }
        },
        onSearch: (): void => { if (this.directoryInputIsCurrent(identity)) this.applySearch(); },
        onToggleSort: (): void => { if (this.directoryInputIsCurrent(identity)) this.toggleSort(); },
        onLocateCurrent: (): void => { if (this.directoryInputIsCurrent(identity)) this.locateCurrent(); },
      });
      if (this.mangaFlowFooter()) {
        Row() { this.mangaCurrentFooter(); }.width('100%').justifyContent(FlexAlign.Center)
          .margin({ top: this.mangaFooterBottomOffset() });
      }
    }.width(this.geometry.content.frame.width).alignItems(HorizontalAlign.Start)
      .position({ x: this.geometry.content.frame.left, y: this.geometry.content.startInset - this.mangaToolsHeight - this.mangaScrollOffset })
      .onAreaChange(this.mangaHeightHandler('tools', this.measurementKey));
  }

  @Builder
  private mangaCurrentFooter() {
    MangaDirectoryCurrentFooter({ title: this.mangaCurrentTitle(), pagePosition: this.mangaCurrentPosition(), scheme: this.appThemeScheme,
      availableWidth: this.mangaFooterFrame(this.geometry.content.frame).width,
    }).width(this.mangaFooterFrame(this.geometry.content.frame).width)
      .onAreaChange(this.mangaHeightHandler('footer', this.measurementKey));
  }

  private mangaHeightHandler(slot: 'tools' | 'footer', presentedKey: number): (_old: Area, next: Area) => void {
    return (_old: Area, next: Area): void => {
      if (!this.mounted || presentedKey !== this.measurementKey) return;
      const height = readerPageAreaLength(next.height);
      const previous = slot === 'tools' ? this.mangaToolsHeight : this.mangaFooterMeasured;
      if (!Number.isFinite(height) || height <= 0 || Math.abs(height - previous) <= .1) return;
      if (slot === 'tools') this.mangaToolsHeight = height;
      else this.mangaFooterMeasured = height;
      this.refreshGeometry();
    };
  }

  private mangaNarrow(): boolean {
    const width = this.viewportWidth > 0 ? this.viewportWidth : ReaderWindowCoordinator.metrics().windowRect.width;
    return width > 0 && width <= visual.narrowWidth;
  }

  private mangaVisibleTopInset(): number {
    return this.geometry.header.bottom;
  }

  private mangaFlowFooter(): boolean {
    const height = this.mangaViewportHeight > 0 ? this.mangaViewportHeight : ReaderWindowCoordinator.metrics().windowRect.height;
    return mangaDirectoryFullFlowFooter(height, this.mangaFontScale(), this.topInset(), this.mangaBottomInset(), this.mangaFooterHeight());
  }

  private scrollMangaCurrent(index: number, currentInset: number = 12): void {
    this.listScroller.scrollToIndex(index, false, ScrollAlign.START, { extraOffset: LengthMetrics.vp(
      this.mangaContentTopInset() - this.mangaVisibleTopInset() - currentInset) });
  }

  private mangaContentTopInset(): number {
    return this.geometry.content.startInset;
  }

  private onMangaScrollOffset(offset: number): void {
    if (Number.isFinite(offset) && Math.abs(offset - this.mangaScrollOffset) > .1) this.mangaScrollOffset = offset;
  }

  private mangaFontScale(): number {
    const revision = this.readerWindowMetricsRevision;
    return mangaDirectoryScale(revision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private mangaFooterHeight(): number { return this.mangaFooterMeasured > 0 ? this.mangaFooterMeasured : mangaDirectoryFooterHeight(this.mangaFontScale(), this.mangaFooterFrame().width, this.mangaCurrentPosition()); }
  private mangaBottomInset(): number { return Math.max(0, readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics())); }
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
    const inset = Math.min(visual.detailDockInset - 18, frame.width / 2);
    return new SurfaceHorizontalFrame(frame.left + inset, frame.right + inset, Math.max(0, frame.width - inset * 2));
  }

  private headerFrame(): SurfaceHorizontalFrame {
    const frame = this.contentFrame();
    const metrics = ReaderWindowCoordinator.metrics();
    const expansion = 18 - 8;
    const left = Math.max(readerInteractiveSafeLeft(metrics), frame.left - expansion);
    const right = Math.max(readerInteractiveSafeRight(metrics), frame.right - expansion);
    return new SurfaceHorizontalFrame(left, right, frame.width + frame.left - left + frame.right - right);
  }

  private onMangaMetricsChanged(): void {
    this.mangaFooterMeasured = 0;
    if (!this.mounted) return;
    this.invalidateFrame();
    this.prepareMangaLayout();
  }

  private onMangaPositionChanged(): void {
    this.mangaFooterMeasured = 0;
    if (this.mounted) this.invalidateFrame();
  }

  private prepareMangaPageFonts(): void {
    const generation = ++this.mangaFontGeneration;
    this.mangaFontsFailed = false;
    void prepareReaderFontFamily(READER_FONT_NOTO_SERIF_SC_BOLD).then((): Promise<boolean> => prepareMangaSheetFonts())
      .then((ready: boolean): void => {
        if (this.mounted && generation === this.mangaFontGeneration) {
          this.mangaFontsReady = ready;
          this.mangaFontsFailed = !ready;
        }
      }).catch((): void => {
        if (this.mounted && generation === this.mangaFontGeneration) this.mangaFontsFailed = true;
      });
  }

  @Builder
  private mangaFlatList(identity: string) {
    ReaderDirectoryList({
      entries: this.mangaLayoutEntries(), rowHeight: visual.gridHeight, naturalRowHeight: true,
      listPaddingX: this.geometry.content.frame.left, listPaddingY: 8,
      listPaddingRight: this.geometry.content.frame.right,
      listPaddingTop: this.geometry.content.startInset, listPaddingBottom: this.geometry.content.endInset,
      edgeEffectMode: EdgeEffect.Spring, scroller: this.listScroller,
      onFirstLayout: (): void => {
        if (this.directoryListIsCurrent(identity, false)) this.onListFirstLayout(identity);
      },
      onScrollOffset: (offset: number): void => {
        if (this.directoryListIsCurrent(identity, false)) this.onMangaScrollOffset(offset + this.mangaContentTopInset());
      },
      onUserScrollIntent: (): void => {
        if (!this.navigationActive && this.directoryInputIsCurrent(identity)) this.onListUserScroll();
      },
      rowBuilder: (item: RepeatItem<LocalReadingTocEntry>) => { this.mangaFlatRow(item.item, identity); },
      emptyBuilder: (): void => { this.mangaEmptyState(identity); },
    }).width('100%').height('100%');
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
      interactionEnabled: this.interactive && !this.navigationActive, chapterDownloadEnabled: this.mangaDownloadEnabled,
      onSelectEntry: (selected: LocalReadingTocEntry): void => {
        if (!this.navigationActive && this.directoryInputIsCurrent(identity)) this.selectMangaEntry(selected, identity);
      },
      onToggleBranch: (selected: LocalReadingTocEntry): void => {
        if (!this.navigationActive && this.directoryInputIsCurrent(identity)) this.toggleMangaBranch(selected, identity);
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
    const current = this.projectedEntries.find((row: LocalReadingTocEntry): boolean => row.index === entry.index);
    if (current === undefined || !sameReaderDirectoryData([current], [entry])) return;
    this.mangaCollapsedGroups = this.mangaCollapsedGroups.includes(entry.index) ?
      this.mangaCollapsedGroups.filter((index: number): boolean => index !== entry.index) : [...this.mangaCollapsedGroups, entry.index];
    this.onListUserScroll();
    this.prepareMangaLayout();
  }

  private prepareMangaLayout(): void {
    this.mangaLayoutRows = mangaDirectoryEntryRows(this.mangaVisibleEntries(), this.mangaPresentation,
      this.mangaNarrow(), this.mangaFontScale(), this.contentFrame().width, (entry: LocalReadingTocEntry): number => {
        const glyph = this.mangaDownloadEnabled && entry.navigable !== false && entry.downloadState !== 'unknown';
        return (glyph ? visual.downloadGridWidth : 0) + mangaDirectoryDownloadStatusWidth(entry.downloadState, glyph, this.mangaFontScale());
      }, this.searchQuery);
  }

  private mangaLayoutEntries(): LocalReadingTocEntry[] {
    return this.mangaLayoutRows.map((row: MangaDirectoryLayoutRow): LocalReadingTocEntry => row.entries[0]);
  }

  private mangaLayoutRow(entry: LocalReadingTocEntry): MangaDirectoryLayoutRow {
    return this.mangaLayoutRows.find((row: MangaDirectoryLayoutRow): boolean => row.entries[0]?.index === entry.index) ??
      { kind: 'row', columns: 1, startIndex: 0, entries: [], labels: [] };
  }

  private mangaEntryIsDisplayed(entry: LocalReadingTocEntry): boolean {
    return this.mangaLayoutRows.some((row: MangaDirectoryLayoutRow): boolean => row.entries.some((candidate: LocalReadingTocEntry): boolean =>
      candidate.index === entry.index && sameReaderDirectoryData([candidate], [entry])));
  }

  private mangaSummaryLabel(): string {
    const readable = this.admittedEntries.filter((entry: LocalReadingTocEntry): boolean => entry.navigable === true).length;
    const unknown = this.admittedEntries.some((entry: LocalReadingTocEntry): boolean => entry.navigable === undefined);
    const groups = this.admittedEntries.filter((entry: LocalReadingTocEntry): boolean => this.mangaIsGroup(entry)).length;
    return `${readable} 个${unknown ? '已确认' : ''}可读条目${groups > 0 ? ` · ${groups} 个卷组` : ''}`;
  }

  private mangaIsGroup(entry: LocalReadingTocEntry): boolean {
    return this.mangaPresentation.get(entry.index)?.group === true;
  }

  private consumeTemporaryBack(identity: string): boolean {
    if (!this.mounted || identity.length === 0 || identity !== this.temporaryBackIdentity) return false;
    if (consumeReaderControlKeyboardBack(ReaderWindowCoordinator.metrics(), {
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
          focusId: 'reader-manga-download:' + JSON.stringify([identity, this.temporaryBackIdentity]),
          availableWidth: this.contentFrame().width, actions: this.downloadActions, loading: this.downloadActionsLoading,
          failureMessage: this.downloadActionsFailure,
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
    const entry = this.admittedEntries.find((row: LocalReadingTocEntry): boolean => row.index === this.currentChapterIndex);
    return entry === undefined ? '尚未开始阅读' : mangaDirectoryDisplay(entry).title;
  }

  private mangaCurrentPosition(): string {
    // This footer describes the current image inside the chapter. The TOC
    // ordinal is not a page number and must never be shown as one.
    if (this.currentPageOrdinal === undefined || this.currentPageTotal === undefined ||
      this.currentPageOrdinal < 0 || this.currentPageTotal <= this.currentPageOrdinal) return '—';
    return `${this.currentPageOrdinal + 1} / ${this.currentPageTotal} 页`;
  }

  private mangaVisibleEntries(): LocalReadingTocEntry[] {
    // Search reveals matches and their original volume path even when folded.
    if (this.searchQuery.length > 0) return this.projectedEntries;
    return mangaDirectoryVisibleEntries(this.projectedEntries, this.mangaPresentation, this.mangaCollapsedGroups);
  }

  private topInset(): number {
    if (this.readerWindowMetricsRevision < 0) return 0;
    return readerInteractiveSafeTop(ReaderWindowCoordinator.metrics());
  }

  private locateCurrent(): void {
    if (this.currentChapterIndex < 0) return;
    this.searchDraft = '';
    this.searchQuery = '';
    const currentEntry = this.admittedEntries.find((entry: LocalReadingTocEntry): boolean => entry.index === this.currentChapterIndex);
    const ancestors = currentEntry === undefined ? [] : this.mangaPresentation.get(currentEntry.index)?.ancestorGroupIndexes ?? [];
    this.mangaCollapsedGroups = this.mangaCollapsedGroups.filter((index: number): boolean => !ancestors.includes(index));
    this.publishProjection(projectReaderDirectoryEntries(mangaDirectoryContextEntries(this.admittedEntries, this.mangaPresentation),
      '', this.ascending, true));
    this.locateCurrentRevision += 1;
    const generation = ++this.scrollGeneration;
    setTimeout((): void => {
      if (!this.mounted || generation !== this.scrollGeneration || this.navigationActive) return;
      const index = this.mangaLayoutRows.findIndex((row: MangaDirectoryLayoutRow): boolean =>
        row.entries.some((entry: LocalReadingTocEntry): boolean => entry.index === this.currentChapterIndex));
      if (index >= 0 && this.listReady) this.scrollMangaCurrent(index);
    }, 0);
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
    const current = this.projectedEntries.find((candidate: LocalReadingTocEntry): boolean => candidate.index === entry.index);
    return current !== undefined && sameReaderDirectoryData([entry], [current]);
  }

  private onIdentityChanged(): void {
    if (this.mounted) this.invalidateFrame();
    this.retireDownloadMenu();
    this.mangaCollapsedGroups = [];
    this.locateCurrentRevision = 0;
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
    const previous = this.admittedEntries;
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
    this.admittedEntries = snapshotReaderDirectoryData(this.entries);
    this.mangaPresentation = mangaDirectoryPresentation(this.admittedEntries);
    this.mangaCollapsedGroups = previousIdentity === this.admittedIdentity ? (this.mangaCollapsedGroups ?? []).filter((index: number): boolean => {
      const before = previous.find((entry: LocalReadingTocEntry): boolean => entry.index === index);
      const after = this.admittedEntries.find((entry: LocalReadingTocEntry): boolean => entry.index === index);
      return before !== undefined && after !== undefined && this.mangaPresentation.get(after.index)?.hasChildren === true && sameReaderDirectoryData([before], [after]);
    }) : [];
    this.publishProjection(projectReaderDirectoryEntries(mangaDirectoryContextEntries(this.admittedEntries, this.mangaPresentation),
      reset ? '' : this.searchQuery, reset ? true : this.ascending, true));
    if (reset || wasEmpty) {
      this.scheduleTopScroll();
      this.pendingMangaCurrentScroll = this.currentChapterIndex >= 0;
    }
  }

  private applySearch(): void {
    const nextQuery = this.searchDraft.trim();
    this.searchQuery = nextQuery;
    this.publishProjection(projectReaderDirectoryEntries(mangaDirectoryContextEntries(this.admittedEntries, this.mangaPresentation),
      nextQuery, this.ascending, true));
    this.scheduleTopScroll();
  }

  private toggleSort(): void {
    const nextAscending = !this.ascending;
    this.ascending = nextAscending;
    this.publishProjection(projectReaderDirectoryEntries(mangaDirectoryContextEntries(this.admittedEntries, this.mangaPresentation),
      this.searchQuery, nextAscending, true));
    this.scheduleTopScroll();
  }

  private scheduleTopScroll(): void {
    const generation = ++this.scrollGeneration;
    this.pendingScrollEdge = Edge.Top;
    setTimeout((): void => {
      if (generation === this.scrollGeneration) this.flushPendingScroll();
    }, 0);
  }

  private publishProjection(entries: LocalReadingTocEntry[]): void {
    // The List remains mounted beneath the empty-state text. Empty and
    // nonempty updates may coalesce; neither invalidates its native readiness.
    this.projectedEntries = entries;
    this.prepareMangaLayout();
  }

  private onListFirstLayout(identity: string): void {
    if (!this.mounted || identity !== this.admittedIdentity || identity !== this.identity()) return;
    this.listReady = true;
    if (this.pendingMangaCurrentScroll && !this.navigationActive) {
      this.pendingMangaCurrentScroll = false;
      const index = this.mangaLayoutRows.findIndex((row: MangaDirectoryLayoutRow): boolean =>
        row.entries.some((entry: LocalReadingTocEntry): boolean => entry.index === this.currentChapterIndex));
      if (index >= 0) {
        this.pendingScrollEdge = undefined;
        this.scrollMangaCurrent(index, 50);
        return;
      }
    }
    this.flushPendingScroll();
  }

  private onListUserScroll(): void {
    this.pendingMangaCurrentScroll = false;
    this.scrollGeneration += 1;
    this.pendingScrollEdge = undefined;
    this.navigationInteracted = true;
  }

  private flushPendingScroll(): void {
    const edge = this.pendingScrollEdge;
    if (!this.mounted || !this.listReady ||
      (this.projectedEntries.length === 0 && !this.navigationActive) || edge === undefined) return;
    this.pendingScrollEdge = undefined;
    this.listScroller.scrollEdge(edge);
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
    const metrics = ReaderWindowCoordinator.metrics();
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
    if (widthChanged) this.mangaFooterMeasured = 0;
    this.invalidateFrame();
    if (widthChanged) this.prepareMangaLayout();
  }

  private recordHeaderHeight(slot: string, height: number, presentedKey: number): void {
    if (!this.mounted || presentedKey !== this.measurementKey || height <= 0) return;
    if (this.measurements.record(slot, height, presentedKey, .1)) this.refreshGeometry();
  }

  private invalidateFrame(): void {
    this.measurementKey += 1;
    this.refreshGeometry();
  }

  private directoryScrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.geometry, { mode: 'contentOffset' });
  }

  private mangaFrameStyle(): ReaderFrameStyle {
    const pageBackground = mangaDirectoryColor('paper', this.appThemeScheme);
    return readerFrameStyle({ backgroundColor: pageBackground, alignment: 'top',
      headerBackground: pageBackground, headerTransparent: true, footerBackground: pageBackground });
  }

  private refreshGeometry(): void {
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.viewportWidth > 0 ? this.viewportWidth :
      (this.readerWindowMetricsRevision < 0 ? 0 : metrics.windowRect.width);
    input.viewportHeight = this.mangaViewportHeight;
    input.measurementRevision = this.measurementKey;
    input.contentHorizontalSafeArea = 'interactive';
    const minimumHeaderHeight = mangaDirectoryHeaderHeight(this.mangaFontScale());
    const header = this.headerFrame();
    const footer = this.mangaFooterFrame();
    input.headerTop = this.topInset() + visual.headerSafeGap;
    input.headerHeight = Math.max(minimumHeaderHeight, this.measurements.read('bookDirectory:mangaHeader', minimumHeaderHeight));
    input.headerInsetLeft = header.left;
    input.headerInsetRight = header.right;
    input.footerInsetLeft = footer.left;
    input.footerInsetRight = footer.right;
    input.footerBottom = this.mangaBottomInset() + this.mangaFooterBottomOffset();
    input.footerHeight = this.mangaFlowFooter() ? 0 : this.mangaFooterHeight();
    input.contentGap = visual.contentTop - visual.headerHeight - visual.headerSafeGap + this.mangaToolsHeight;
    input.contentMaxWidth = visual.contentWidthMax;
    input.contentHorizontalPadding = 18;
    input.contentEndInset = this.mangaListBottomClearance();
    this.geometry = resolveReaderPageGeometry(input);
  }

}
