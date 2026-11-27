import type { ReaderDirectoryTargetProof } from '../../reading/application/ReaderDirectoryTargetProof';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import { LengthMetrics } from '@kit.ArkUI';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { MangaDirectoryCurrentFooter } from './MangaDirectoryCurrentFooter';
import { MangaDirectoryPressFeedback } from '../../../ui/foundation/MangaDirectoryPressFeedback';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor, mangaDirectoryScale, mangaDirectoryLineBox, mangaDirectoryFooterHeight, mangaDirectoryQuickFlowGaps, mangaDirectoryQuickMinimumListHeight } from './MangaDirectoryVisual';
import { MANGA_DIRECTORY_UTILITY_ACTION_LINE, mangaDirectoryUtilityGeometry, type MangaDirectoryUtilityGeometry } from './MangaDirectoryUtilityGeometry';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { type RemoteReadingTocEntry } from '../../reading/application/RemoteReadingFlowGateway';
import { ReaderSearchField } from '../../../ui/controls/ReaderSearchField';
import { ReaderDirectoryNavigationSurface } from '../../reading/ui/ReaderDirectoryNavigationSurface';
import type { LocalReadingTocEntry } from '../../reading/application/LocalReadingFlowGateway';
import type { RemoteReadingPositionScope } from '../../reading/application/RemoteReadingPositionMigration';
import { mangaUsesPersistentDirectory, mangaDirectoryColumnWidth } from './MangaLayoutPolicy';
import { MangaBookPresentation } from '../presentation/MangaBookPresentation';
import { mangaDirectoryDisplay } from './MangaDirectoryDisplay';
import { MangaReadingDirectoryFallback } from './MangaReadingDirectoryFallback';
import { READER_FONT_NOTO_SANS_SC_UI_BOLD, READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_MEDIUM } from '../../../ui/foundation/ReaderFontFamilies';
import type { MangaReadingScene } from './MangaReadingSurface';

@Observed
export class MangaDirectoryRenderState {
  @Track quickHeaderMeasured: number = 0;
  @Track quickToolsMeasured: number = 0;
  @Track directoryUtilityMeasured: number = 0;
  @Track quickFooterMeasured: number = 0;
  @Track directoryQuery: string = '';
  @Track directoryAscending: boolean = true;
  @Track directoryRevision: number = 0;
  @Track directoryOpenRevision: number = 0;
}

/** Directory mount identity, search/sort scope and the rail or drawer scroll admission. */
export class MangaDirectoryDrawer {
  readonly scene: MangaReadingScene;
  private readonly readState: () => MangaDirectoryRenderState;

  constructor(scene: MangaReadingScene, readState: () => MangaDirectoryRenderState) {
    this.scene = scene;
    this.readState = readState;
  }

  get state(): MangaDirectoryRenderState { return this.readState(); }

  readonly directoryOuterScroller: Scroller = new Scroller();
  private quickOuterViewportHeight: number = 0;
  private quickOuterContentHeight: number = 0;
  private quickOuterListReady: boolean = false;
  private quickOuterPositioned: boolean = false;
  private quickOuterOverflow: boolean = false;
  private quickOuterUserScrolled: boolean = false;
  private quickOuterPositionRevision: number = 0;
  async openDirectory(focusSearch: boolean = false): Promise<void> {
    const session = this.scene.book.remoteSession;
    if (session?.contentKind === 'manga' && session.identity.sourceId === this.scene.book.sourceId && session.identity.bookId === this.scene.book.bookId)
      this.scene.actions.onRemoteSessionReady(session, true);
    await this.scene.chrome().openPanel('directory', '', focusSearch);
  }
  async selectDirectoryTarget(index: number, proof?: ReaderDirectoryTargetProof, fromCatalog: boolean = false): Promise<void> {
    if (fromCatalog) {
      if (!this.persistentDirectory() || (this.scene.chrome().state.panelPhase !== 'closed' && this.scene.chrome().state.panelPhase !== 'open')) return;
    } else if (this.scene.chrome().state.panelPhase !== 'open' || this.scene.window.panel !== 'directory') return;
    await this.scene.chrome().performPanelAction((): void => {
      if (!fromCatalog && !this.scene.chrome().readerPanelForeground()) return;
      this.scene.chapter.chapterEnd = false;
      this.scene.actions.onSelectDirectoryTarget(index, proof);
    });
  }
  persistentDirectory(): boolean {
    return mangaUsesPersistentDirectory(this.scene.window.stageWidth, this.scene.window.stageHeight, ReaderWindowCoordinator.isTabletDevice());
  }
  directoryColumnWidth(): number { return mangaDirectoryColumnWidth(this.scene.window.stageWidth); }
  directoryEntries(): LocalReadingTocEntry[] {
    const session = this.scene.book.remoteSession;
    if (session === undefined) return this.scene.book.directoryProjection ?? [];
    if (session.contentKind !== 'manga' || session.identity.sourceId !== this.scene.book.sourceId ||
      session.identity.bookId !== this.scene.book.bookId || (session.requiresContextRefresh === true && session.acquisitionMode !== 'offline')) return [];
    const chapter = this.scene.book.controller?.chapter;
    if (session.acquisitionMode === 'offline' && chapter !== undefined &&
      (chapter.manifest.chapter.sourceId !== this.scene.book.sourceId || chapter.manifest.chapter.bookId !== this.scene.book.bookId ||
      !session.entries.some((entry: RemoteReadingTocEntry): boolean => entry.index === chapter.chapterIndex && entry.url === chapter.manifest.chapter.chapterId))) return [];
    const displayFactsCurrent = session.acquisitionMode !== 'offline' || chapter !== undefined &&
      session.sourceVersion !== undefined && session.sourceVersion === chapter.manifest.sourceRuleVersion;
    const projection: Map<number, LocalReadingTocEntry> = new Map();
    for (const row of this.scene.book.directoryProjection ?? []) projection.set(row.index, row);
    return session.entries.map((entry: RemoteReadingTocEntry): LocalReadingTocEntry => {
      const row = projection.get(entry.index);
      const proved = displayFactsCurrent && (session.acquisitionMode !== 'offline' || entry.proofState === 'verified');
      return { index: entry.index, title: entry.title, level: proved ? entry.level : undefined, navigable: entry.navigable,
        displayTitle: proved ? entry.displayTitle : undefined, isVip: proved ? entry.isVip : undefined,
        isPay: proved ? entry.isPay : undefined, contextTitle: proved ? entry.contextTitle : undefined,
        downloadState: row?.title === entry.title ? row.downloadState : 'unknown' };
    });
  }
  measureDirectorySheetHeader(height: number): void {
    if (this.scene.window.panel === 'directory' && Number.isFinite(height) && height > 0 && Math.abs(height - this.state.quickHeaderMeasured) > .1) {
      this.state.quickHeaderMeasured = height;
    }
  }
  directoryUtilityGeometry(): MangaDirectoryUtilityGeometry {
    return mangaDirectoryUtilityGeometry(this.directoryFontScale());
  }
  directoryUtilityHeight(): number {
    return Math.max(this.directoryUtilityGeometry().height, this.state.directoryUtilityMeasured);
  }
  directorySortIcon(): Resource {
    if (this.state.directoryAscending) return this.scene.chrome().sheetScheme() === 'night' ? $r('app.media.manga_directory_sort_ascending_theme_night') :
      $r('app.media.manga_directory_sort_ascending');
    return this.scene.chrome().sheetScheme() === 'night' ? $r('app.media.manga_directory_sort_descending_theme_night') :
      $r('app.media.manga_directory_sort_descending');
  }
  directoryCurrentIndex(): number {
    const live = (this.scene.boundary().pendingChapterTransition !== undefined ? this.scene.boundary().previousChapterController : this.scene.book.controller)?.chapter?.chapterIndex;
    if (live !== undefined && Number.isSafeInteger(live) && live >= 0) return live;
    const confirmed = MangaBookPresentation.get(this.scene.book.sourceId, this.scene.book.bookId)?.chapterIndex;
    if (confirmed !== undefined && Number.isSafeInteger(confirmed) && confirmed >= 0) return confirmed;
    return this.directoryCurrentCatalogEntry(this.scene.book.directoryCurrentChapterIndex)?.index ?? -1;
  }
  private directoryCurrentCatalogEntry(index: number): LocalReadingTocEntry | undefined {
    if (!Number.isSafeInteger(index) || index < 0 || !this.scene.book.isReaderIdentityCurrent()) return undefined;
    const session = this.scene.book.remoteSession;
    if (session !== undefined) {
      if (session.contentKind !== 'manga' || session.identity.sourceId !== this.scene.book.sourceId ||
        session.identity.bookId !== this.scene.book.bookId || (session.requiresContextRefresh === true && session.acquisitionMode !== 'offline')) return undefined;
      return this.directoryEntries().find((entry: LocalReadingTocEntry): boolean => entry.index === index && entry.navigable !== false);
    }
    // The Shell binds this projection to the same source/book reader identity.
    // A missing canonical session does not certify any page count or position.
    return this.scene.book.directoryProjection?.find((entry: LocalReadingTocEntry): boolean => entry.index === index && entry.navigable !== false);
  }
  directoryCurrentTitle(): string {
    const session = this.scene.book.remoteSession;
    const index = this.directoryCurrentIndex();
    if (session?.contentKind === 'manga' && session.identity.sourceId === this.scene.book.sourceId &&
      session.identity.bookId === this.scene.book.bookId && (session.requiresContextRefresh !== true || session.acquisitionMode === 'offline')) {
      const entry = session.entries.find((entry: RemoteReadingTocEntry): boolean => entry.index === index);
      if (entry !== undefined) return mangaDirectoryDisplay(entry).title;
    }
    if (this.scene.book.controller?.chapter !== undefined || index < 0) return this.scene.chapter.title;
    const saved = MangaBookPresentation.get(this.scene.book.sourceId, this.scene.book.bookId);
    if (saved?.chapterIndex === index && saved.chapterTitle !== undefined) return saved.chapterTitle;
    const entry = this.directoryCurrentCatalogEntry(index);
    return entry === undefined ? this.scene.chapter.title : mangaDirectoryDisplay(entry).title;
  }
  directoryCurrentPagePosition(): string {
    if (this.scene.book.controller?.chapter !== undefined && (this.scene.book.controller?.totalPages ?? 0) > 0)
      return `${this.scene.viewport().pageOrdinal() + 1} / ${this.scene.book.controller?.totalPages ?? 0} 页`;
    const saved = MangaBookPresentation.get(this.scene.book.sourceId, this.scene.book.bookId);
    const index = this.directoryCurrentIndex();
    if (index < 0 || saved === undefined || saved.chapterIndex !== index || !Number.isSafeInteger(saved.pageOrdinal) ||
      saved.pageOrdinal < 0 || saved.totalPages === undefined || !Number.isSafeInteger(saved.totalPages) ||
      saved.totalPages <= saved.pageOrdinal) return '';
    return `${saved.pageOrdinal + 1} / ${saved.totalPages} 页`;
  }
  onDirectoryMetricsChanged(): void {
    this.state.quickHeaderMeasured = 0; this.state.quickToolsMeasured = 0; this.state.quickFooterMeasured = 0;
    this.state.directoryUtilityMeasured = 0;
    // Wait for the new physical viewport/content areas before using their
    // scroll extent; old font measurements cannot reposition a retained Scroll.
    this.quickOuterViewportHeight = 0; this.quickOuterContentHeight = 0;
    this.quickOuterPositionRevision += 1;
  }
  directoryOuterIdentity(): string {
    return JSON.stringify([this.scene.book.sourceId, this.scene.book.bookId, this.state.directoryOpenRevision]);
  }
  directorySheetInputCurrent(identity: string): boolean {
    return this.scene.window.panel === 'directory' && this.scene.chrome().state.panelPhase === 'open' && identity === this.directoryOuterIdentity() &&
      this.scene.chrome().readerPanelForeground();
  }
  directoryContentInputCurrent(catalog: boolean, identity: string): boolean {
    return catalog ? this.scene.chrome().readerPanelForeground() && (this.scene.chrome().state.panelPhase === 'closed' || this.scene.chrome().state.panelPhase === 'open') :
      this.directorySheetInputCurrent(identity);
  }
  openDirectoryDestination(catalog: boolean, identity: string): void {
    if (!catalog && !this.directorySheetInputCurrent(identity)) return;
    void this.scene.chrome().performPanelAction((): void => {
      if (catalog || this.scene.chrome().readerPanelForeground()) this.scene.actions.onDirectory();
    });
  }
  resetDirectoryOuterLayout(): void {
    this.state.quickToolsMeasured = 0;
    this.quickOuterViewportHeight = 0; this.quickOuterContentHeight = 0;
    this.quickOuterListReady = false; this.quickOuterPositioned = false;
    this.quickOuterOverflow = false; this.quickOuterUserScrolled = false;
    this.quickOuterPositionRevision += 1;
  }
  onDirectoryOuterArea(identity: string, height: number): void {
    if (!this.scene.chapter.mounted || identity !== this.directoryOuterIdentity() || this.scene.window.panel !== 'directory' || !Number.isFinite(height) || height <= 0) return;
    this.quickOuterViewportHeight = height;
    this.scheduleDirectoryOuterPosition(identity);
  }
  onDirectoryOuterContentArea(identity: string, height: number): void {
    if (!this.scene.chapter.mounted || identity !== this.directoryOuterIdentity() || this.scene.window.panel !== 'directory' || !Number.isFinite(height) || height <= 0) return;
    this.quickOuterContentHeight = height;
    this.scheduleDirectoryOuterPosition(identity);
  }
  onDirectoryListFirstLayout(identity: string): void {
    if (!this.scene.chapter.mounted || identity !== this.directoryOuterIdentity() || this.scene.window.panel !== 'directory') return;
    this.quickOuterListReady = true;
    this.scheduleDirectoryOuterPosition(identity);
  }
  onDirectoryOuterUserScroll(identity: string): void {
    if (identity !== this.directoryOuterIdentity()) return;
    this.quickOuterUserScrolled = true;
    this.quickOuterPositionRevision += 1;
  }
  scheduleDirectoryOuterPosition(identity: string): void {
    if (!this.scene.chapter.mounted || this.scene.window.panel !== 'directory') return;
    const revision = ++this.quickOuterPositionRevision;
    setTimeout((): void => {
      if (!this.scene.chapter.mounted || !this.scene.book.isReaderIdentityCurrent() || identity !== this.directoryOuterIdentity() ||
        revision !== this.quickOuterPositionRevision || this.scene.window.panel !== 'directory' || this.scene.chrome().state.panelPhase !== 'open' ||
        !this.quickOuterListReady || this.quickOuterViewportHeight <= 0 || this.quickOuterContentHeight <= 0) return;
      const overflow = !this.scene.chrome().widePanel() && this.quickOuterContentHeight - this.quickOuterViewportHeight > .1;
      const wasOverflow = this.quickOuterOverflow;
      this.quickOuterOverflow = overflow;
      if (!overflow) {
        if (wasOverflow || !this.quickOuterPositioned) {
          this.directoryOuterScroller.scrollTo({ xOffset: 0, yOffset: 0, animation: false });
          this.quickOuterPositioned = true;
        }
        return;
      }
      if (!wasOverflow) this.quickOuterPositioned = false;
      if (this.quickOuterUserScrolled || this.quickOuterPositioned || this.state.quickToolsMeasured <= 0) return;
      const offset = Math.min(this.directoryQuickToolsHeight() + visual.quickGap,
        Math.max(0, this.quickOuterContentHeight - this.quickOuterViewportHeight));
      this.directoryOuterScroller.scrollTo({ xOffset: 0, yOffset: offset, animation: false });
      this.quickOuterPositioned = true;
    }, 0);
  }
  directoryFontScale(): number {
    const revision = this.scene.window.windowMetricsRevision;
    return mangaDirectoryScale(revision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale);
  }
  directoryToolHeight(): number { return mangaDirectoryLineBox(visual.toolHeight, visual.toolLineHeight, visual.toolPaddingY * 2, this.directoryFontScale()); }
  directoryInitialWidth(catalog: boolean): number {
    if (catalog) return Math.max(0, this.directoryColumnWidth() - this.scene.window.windowInteractiveInsets(this.scene.window.windowMetricsRevision).left);
    const insets = this.scene.chrome().panelInsets(this.scene.window.windowMetricsRevision);
    const horizontal = this.scene.chrome().widePanel() ? this.scene.chrome().panelContentInset() - 8 : visual.quickPaddingX;
    return Math.max(0, (this.scene.chrome().widePanel() ? Number(this.scene.chrome().panelWidth()) : this.scene.viewport().state.viewportWidth) - insets.left - insets.right - horizontal * 2);
  }
  directoryHeaderChrome(): number {
    if (this.scene.chrome().widePanel()) return (this.state.quickHeaderMeasured > 0 ? this.state.quickHeaderMeasured :
      Math.max(44 + visual.wideHeaderPaddingY * 2 + 1, visual.wideHeaderMinHeight, visual.wideHeaderLineHeight * this.directoryFontScale() + visual.wideHeaderPaddingY * 2)) + visual.wideHeaderBottom;
    return Math.max(visual.closeTop + 44 + 8, visual.handleZone + (this.state.quickHeaderMeasured > 0 ? this.state.quickHeaderMeasured : visual.quickHeaderLineHeight * this.directoryFontScale() + visual.quickHeaderPaddingBottom));
  }
  private directoryQuickToolsHeight(): number {
    return this.state.quickToolsMeasured > 0 ? this.state.quickToolsMeasured : this.directoryToolHeight() + visual.toolsTop + visual.toolsBottom;
  }
  private directoryQuickRemainingHeight(): number {
    const tools = this.directoryQuickToolsHeight();
    const chrome = this.directoryHeaderChrome() + tools + (this.state.quickFooterMeasured > 0 ? this.state.quickFooterMeasured : mangaDirectoryFooterHeight(this.directoryFontScale(), this.directoryInitialWidth(false), this.directoryCurrentPagePosition())) + mangaDirectoryQuickFlowGaps() + (this.scene.chrome().widePanel() ? 22 : visual.quickPaddingBottom);
    return this.scene.chrome().panelContentHeight() - chrome - this.directoryUtilityHeight();
  }
  directoryQuickHeight(): number {
    return Math.min(visual.quickMaxListHeight, Math.max(mangaDirectoryQuickMinimumListHeight(this.directoryFontScale()), this.directoryQuickRemainingHeight()));
  }
  directoryCurrentOpenInset(catalog: boolean): number {
    if (!catalog && this.scene.chrome().widePanel()) return 7;
    if (catalog) return 50;
    return this.directoryQuickHeight() < mangaDirectoryQuickMinimumListHeight(this.directoryFontScale()) + 50 ? 0 : 50;
  }
}

interface MangaTabletDirectoryInput {
  readonly host: MangaDirectoryDrawer;
}

@Builder
export function MangaTabletDirectory($$: MangaTabletDirectoryInput) {
    Column() {
      if ($$.host.scene.chrome().state.panelFontsReady) {
        Column({ space: visual.sidebarHeaderGap }) {
          Text($$.host.scene.book.bookTitle).fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontWeight(700)
            .fontSize($$.host.scene.window.stageWidth <= 700 ? visual.sidebarNarrowTitleFontSize : visual.sidebarTitleFontSize)
            .lineHeight(visual.sidebarTitleLineHeight).halfLeading(true)
            .minFontScale(Math.min(1, $$.host.directoryFontScale())).maxFontScale(Math.max(1, $$.host.directoryFontScale())).fontColor($$.host.scene.chrome().inkColor());
          Text('章节目录').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400)
            .fontSize(visual.sidebarCaptionFontSize).lineHeight(visual.sidebarCaptionLineHeight).halfLeading(true)
            .minFontScale(Math.min(1, $$.host.directoryFontScale())).maxFontScale(Math.max(1, $$.host.directoryFontScale())).fontColor($$.host.scene.chrome().mutedColor());
        }.width('100%').constraintSize({ minHeight: visual.sidebarHeaderMinHeight }).alignItems(HorizontalAlign.Start)
          .padding({ top: visual.sidebarPaddingTop, left: $$.host.scene.window.stageWidth <= 700 ? visual.sidebarNarrowPaddingX : visual.sidebarPaddingX,
            right: $$.host.scene.window.stageWidth <= 700 ? visual.sidebarNarrowPaddingX : visual.sidebarPaddingX, bottom: visual.sidebarPaddingBottom })
          .border({ width: { bottom: 1 }, color: $$.host.scene.chrome().lineColor() });
        MangaDirectoryBody($$.host, true, $$.host.directoryOuterIdentity());
      } else {
        Column() {
          ReaderPageState({ loading: $$.host.scene.chrome().state.panelFontsLoading,
            loadingActive: $$.host.scene.chrome().readerPanelForeground() && !$$.host.scene.window.reduceMotion,
            title: $$.host.scene.chrome().state.panelFontsFailed ? '目录暂时无法显示' : '',
            message: $$.host.scene.chrome().state.panelFontsLoading ? '正在准备目录…' :
              ($$.host.scene.chrome().state.panelFontsFailed ? '目录字体暂时无法载入，请重试' : '目录尚未就绪，请重试'),
            actionLabel: $$.host.scene.chrome().state.panelFontsLoading ? '' : '重试', actionGeneration: $$.host.scene.chrome().panelFontGeneration,
            actionEnabled: !$$.host.scene.chrome().state.panelFontsLoading && $$.host.scene.chrome().readerPanelForeground(),
            inkColor: $$.host.scene.chrome().inkColor(), mutedColor: $$.host.scene.chrome().mutedColor(),
            onAction: (generation: number): void => $$.host.scene.chrome().retryPanelFonts(generation) });
        }.width('100%').height('100%').justifyContent(FlexAlign.Center);
      }
    }.width($$.host.directoryColumnWidth()).height('100%')
      .padding({ left: $$.host.scene.window.windowInteractiveInsets($$.host.scene.window.windowMetricsRevision).left,
        top: $$.host.scene.window.windowInteractiveInsets($$.host.scene.window.windowMetricsRevision).top,
        bottom: $$.host.scene.window.windowInteractiveInsets($$.host.scene.window.windowMetricsRevision).bottom })
      .attributeModifier(new ReaderPanelFrame('manga-directory-rail', $$.host.scene.chrome().chromeScheme()))
      .onAppear((): void => { void $$.host.scene.chrome().preparePanelFonts(); });
  }

@Builder
export function MangaDirectorySheet(host: MangaDirectoryDrawer, directoryIdentity: string, opening: number) {
    Column() {
      Stack({ alignContent: Alignment.TopEnd }) {
        Column() {
          if (host.scene.chrome().widePanel()) { MangaDirectorySideHeader(host, opening); }
          else { MangaDirectoryBottomHeader(host, opening); }
          MangaDirectoryUtility(host, directoryIdentity);
          if (host.scene.chrome().widePanel()) {
            MangaDirectoryPanel(host, directoryIdentity);
          } else {
            Scroll(host.directoryOuterScroller) { MangaDirectoryPanel(host, directoryIdentity); }
              .width('100%').constraintSize({ maxHeight: Math.max(1, host.scene.chrome().panelContentHeight() - host.directoryHeaderChrome() - host.directoryUtilityHeight()) })
              .scrollBar(BarState.Auto).scrollBarWidth(visual.scrollbarWidth)
              .scrollBarColor(mangaDirectoryColor('scrollbar', host.scene.chrome().sheetScheme()))
              .onAreaChange((_old: Area, area: Area): void => host.onDirectoryOuterArea(directoryIdentity, Number(area.height)))
              .onWillStartDragging((): void => host.onDirectoryOuterUserScroll(directoryIdentity));
          }
        }.width('100%').height(host.scene.chrome().widePanel() ? host.scene.chrome().panelContentHeight() : undefined)
          .constraintSize({ minHeight: host.scene.chrome().widePanel() ? 0 : Math.min(260, host.scene.chrome().panelContentHeight()),
            maxHeight: host.scene.chrome().panelContentHeight() });
        if (!host.scene.chrome().widePanel()) {
          Button({ type: ButtonType.Normal, stateEffect: false }) {
            Image(host.scene.chrome().sheetScheme() === 'night' ? $r('app.media.manga_sheet_close_theme_night') : $r('app.media.manga_sheet_close'))
              .width(visual.closeIcon).height(visual.closeIcon);
          }.id(host.scene.chrome().panelCloseFocusId(opening)).width(44).height(44).padding(0)
            .backgroundColor(Color.Transparent).borderRadius(12)
            .attributeModifier(new MangaDirectoryPressFeedback(true, true, host.scene.chrome().sheetScheme(), 'nativeButton'))
            .margin({ top: visual.closeTop, right: visual.closeRight })
            .onClick((): void => {
              if (host.scene.chrome().panelInputCurrent(opening) && host.directorySheetInputCurrent(directoryIdentity)) void host.scene.chrome().closePanel();
            }).accessibilityText('关闭面板');
        }
      }.width(host.scene.chrome().panelWidth()).padding({
        left: host.scene.chrome().panelInsets(host.scene.window.windowMetricsRevision).left,
        right: host.scene.chrome().panelInsets(host.scene.window.windowMetricsRevision).right,
        top: host.scene.chrome().widePanel() ? host.scene.chrome().panelInsets(host.scene.window.windowMetricsRevision).top : 0,
        bottom: host.scene.chrome().panelInsets(host.scene.window.windowMetricsRevision).bottom,
      }).attributeModifier(new ReaderPanelFrame('manga-directory-sheet', host.scene.chrome().sheetScheme(), host.scene.chrome().widePanel(), undefined,
        host.scene.chrome().surfaceMaterial('modalSheet')))
        .enabled(host.scene.chrome().state.panelPhase === 'open' || host.scene.chrome().state.panelPhase === 'dragging');
    }.width(host.scene.chrome().panelWidth()).height(host.scene.chrome().widePanel() ? host.scene.chrome().panelHeight() : undefined)
      .translate({ x: host.scene.chrome().widePanel() ? host.scene.chrome().state.panelOffset : 0, y: host.scene.chrome().widePanel() ? 0 : host.scene.chrome().state.panelOffset })
      .opacity(host.scene.chrome().state.panelOpacity)
      // The sheet must admit its chapter rows while masking the scrim below.
      .hitTestBehavior(host.scene.chrome().widePanel() ? HitTestMode.Block : HitTestMode.Default);
  }

@Builder
function MangaDirectorySideHeader(host: MangaDirectoryDrawer, opening: number) {
    Column() {
      Row({ space: 12 }) {
        Text(host.scene.chrome().panelTitle()).fontSize(visual.wideHeaderFontSize)
          .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontWeight(visual.wideHeaderFontWeight)
          .fontColor(host.scene.chrome().inkColor(host.scene.chrome().sheetScheme())).lineHeight(visual.wideHeaderLineHeight).halfLeading(true)
          .minFontScale(Math.min(1, host.directoryFontScale())).maxFontScale(Math.max(1, host.directoryFontScale())).layoutWeight(1);
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image(host.scene.chrome().sheetScheme() === 'night' ? $r('app.media.manga_sheet_close_theme_night') : $r('app.media.manga_sheet_close'))
            .width(18).height(18);
        }.id(host.scene.chrome().panelCloseFocusId(opening)).width(44).height(44).padding(0)
          .attributeModifier(new ReaderPressFeedback(Color.Transparent, host.scene.chrome().sheetScheme(), 12, 12, host.scene.chrome().panelInputCurrent(opening)))
          .enabled(host.scene.chrome().panelInputCurrent(opening))
          .onClick((): void => { if (host.scene.chrome().panelInputCurrent(opening)) void host.scene.chrome().closePanel(); }).accessibilityText('关闭宽屏面板');
      }.width('100%').constraintSize({ minHeight: Math.max(visual.wideHeaderMinHeight, 44 + visual.wideHeaderPaddingY * 2 + 1) })
        .padding({ top: visual.wideHeaderPaddingY, bottom: visual.wideHeaderPaddingY })
        .onAreaChange((_old: Area, area: Area): void => host.measureDirectorySheetHeader(Number(area.height)))
        .border({ width: { bottom: 1 }, color: host.scene.chrome().lineColor(host.scene.chrome().sheetScheme()) });
    }.width('100%').padding({ left: host.scene.chrome().panelContentInset(), right: host.scene.chrome().panelContentInset() })
      .margin({ bottom: visual.wideHeaderBottom });
  }

@Builder
function MangaDirectoryBottomHeader(host: MangaDirectoryDrawer, opening: number) {
    Row() {
      Column().width(visual.handleWidth).height(visual.handleHeight).borderRadius(3)
        .backgroundColor(mangaDirectoryColor('handle', host.scene.chrome().sheetScheme()));
    }.width('100%').height(visual.handleZone).justifyContent(FlexAlign.Center)
      .gesture(PanGesture({ fingers: 1, direction: PanDirection.Vertical, distance: 1 })
        .onActionStart((): void => { if (host.scene.chrome().panelInputCurrent(opening)) host.scene.chrome().beginPanelDrag(); })
        .onActionUpdate((event: GestureEvent): void => { if (host.scene.chrome().panelInputCurrent(opening)) host.scene.chrome().updatePanelDrag(event.offsetY); })
        .onActionEnd((event: GestureEvent): void => { if (host.scene.chrome().panelInputCurrent(opening)) host.scene.chrome().finishPanelDrag(event.offsetY, event.velocityY); })
        .onActionCancel((): void => { if (host.scene.chrome().panelInputCurrent(opening)) host.scene.chrome().finishPanelDrag(0, 0); }));
    Text(host.scene.chrome().panelTitle()).fontSize(visual.quickHeaderFontSize)
      .fontFamily(READER_FONT_NOTO_SANS_SC_UI_BOLD).fontWeight(700).fontColor(host.scene.chrome().inkColor(host.scene.chrome().sheetScheme()))
      .width('100%').padding({ left: visual.quickPaddingX, right: Math.max(visual.quickHeaderPaddingRight, 44 + visual.closeRight + 8), bottom: visual.quickHeaderPaddingBottom })
      .lineHeight(visual.quickHeaderLineHeight).halfLeading(true)
      .minFontScale(Math.min(1, host.directoryFontScale())).maxFontScale(Math.max(1, host.directoryFontScale()))
      .onAreaChange((_old: Area, area: Area): void => {
        if (opening === host.scene.chrome().state.actionPanelPresentationGeneration) host.measureDirectorySheetHeader(Number(area.height));
      });
  }

@Builder
function MangaDirectoryPanel(host: MangaDirectoryDrawer, directoryIdentity: string) {
    Column({ space: visual.quickGap }) {
      MangaDirectoryTools(host, directoryIdentity);
      MangaDirectoryBody(host, false, directoryIdentity);
      MangaDirectoryFooterContent({ host: host });
    }.layoutWeight(host.scene.chrome().widePanel() ? 1 : 0).width('100%')
      .padding({ left: host.scene.chrome().widePanel() ? host.scene.chrome().panelContentInset() - 8 : visual.quickPaddingX,
        right: host.scene.chrome().widePanel() ? host.scene.chrome().panelContentInset() - 8 : visual.quickPaddingX, bottom: host.scene.chrome().widePanel() ? 22 : visual.quickPaddingBottom })
      .onAreaChange((_old: Area, area: Area): void => host.onDirectoryOuterContentArea(directoryIdentity, Number(area.height)));
  }

@Builder
function MangaDirectoryUtility(host: MangaDirectoryDrawer, identity: string) {
    Column({ space: host.directoryUtilityGeometry().gap }) {
      ReaderSearchField({ variant: 'readerDirectory', mode: 'live', colorScheme: host.scene.chrome().sheetScheme(), text: host.state.directoryQuery,
        naturalFieldHeightVp: host.directoryUtilityGeometry().searchHeight,
        placeholder: host.directoryFontScale() >= 1.75 ? '话名或序号' : '搜索话名或序号…',
        accessibilityLabel: '搜索话名或序号', editingFocusId: `reader-manga-directory-query:${identity}`,
        editingCurrent: (): boolean => host.directorySheetInputCurrent(identity),
        onTextChange: (value: string): void => {
          if (host.directorySheetInputCurrent(identity)) host.state.directoryQuery = value;
        } });
      Row({ space: 8 }) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Row({ space: 4 }) {
            Image(host.scene.chrome().sheetScheme() === 'night' ? $r('app.media.manga_sheet_locate_theme_night') : $r('app.media.manga_sheet_locate'))
              .width(14).height(14).accessibilityLevel('no');
            Text('定位当前话').fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontWeight(500).fontSize(12)
              .lineHeight(MANGA_DIRECTORY_UTILITY_ACTION_LINE).halfLeading(true).maxLines(1)
              .minFontScale(Math.min(1, host.directoryFontScale())).maxFontScale(Math.max(1, host.directoryFontScale()))
              .fontColor(host.scene.chrome().greenColor(host.scene.chrome().sheetScheme()));
          }.accessibilityLevel('no-hide-descendants');
        }.constraintSize({ minWidth: 44 }).height(host.directoryUtilityGeometry().actionHeight).padding({ left: 8, right: 8 })
          .responseRegion({ x: 0, y: host.directoryUtilityGeometry().actionResponseY,
            width: '100%', height: host.directoryUtilityGeometry().actionResponseHeight })
          .attributeModifier(new ReaderPressFeedback(Color.Transparent, host.scene.chrome().sheetScheme(), 8, 8, host.directoryCurrentIndex() >= 0))
          .accessibilityText('定位当前话').enabled(host.directoryCurrentIndex() >= 0)
          .onClick((): void => {
            if (!host.directorySheetInputCurrent(identity) || host.directoryCurrentIndex() < 0) return;
            if (host.state.directoryQuery.length > 0) host.state.directoryQuery = '';
            host.state.directoryRevision += 1;
          });
        Blank();
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Row({ space: 4 }) {
            Image(host.directorySortIcon()).width(14).height(14).accessibilityLevel('no');
            Text(host.state.directoryAscending ? '正序' : '倒序').fontFamily(READER_FONT_NOTO_SANS_SC_UI_MEDIUM).fontWeight(500).fontSize(12)
              .lineHeight(MANGA_DIRECTORY_UTILITY_ACTION_LINE).halfLeading(true).maxLines(1)
              .minFontScale(Math.min(1, host.directoryFontScale())).maxFontScale(Math.max(1, host.directoryFontScale()))
              .fontColor(host.scene.chrome().greenColor(host.scene.chrome().sheetScheme()));
          }.accessibilityLevel('no-hide-descendants');
        }.constraintSize({ minWidth: 44 }).height(host.directoryUtilityGeometry().actionHeight).padding({ left: 8, right: 8 })
          .responseRegion({ x: 0, y: host.directoryUtilityGeometry().actionResponseY,
            width: '100%', height: host.directoryUtilityGeometry().actionResponseHeight })
          .attributeModifier(new ReaderPressFeedback(Color.Transparent, host.scene.chrome().sheetScheme(), 8))
          .accessibilityText(host.state.directoryAscending ? '正序，切换倒序' : '倒序，切换正序')
          .onClick((): void => {
            if (host.directorySheetInputCurrent(identity)) host.state.directoryAscending = !host.state.directoryAscending;
          });
      }.width('100%').height(host.directoryUtilityGeometry().actionHeight);
    }.width('100%').padding({ left: host.scene.chrome().panelContentInset(), right: host.scene.chrome().panelContentInset(),
      bottom: host.directoryUtilityGeometry().bottomInset })
      .onAreaChange((_old: Area, area: Area): void => {
        const height = Number(area.height);
        if (identity === host.directoryOuterIdentity() && Number.isFinite(height) && height > 0 &&
          Math.abs(height - host.state.directoryUtilityMeasured) > .1) host.state.directoryUtilityMeasured = height;
      });
  }

@Builder
function MangaDirectoryTools(host: MangaDirectoryDrawer, directoryIdentity: string) {
      Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Center, space: { main: LengthMetrics.vp(visual.toolsGap), cross: LengthMetrics.vp(visual.toolsGap) } }) {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: visual.toolGap }) {
          Image(host.scene.chrome().sheetScheme() === 'night' ? $r('app.media.manga_directory_previous_theme_night') : $r('app.media.manga_directory_previous')).width(visual.toolIcon).height(visual.toolIcon);
          Text('上一章节').fontSize(visual.toolFontSize).lineHeight(visual.toolLineHeight).halfLeading(true).minFontScale(Math.min(1, host.directoryFontScale())).maxFontScale(Math.max(1, host.directoryFontScale())).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontColor(host.scene.chrome().accentColor(host.scene.chrome().sheetScheme()));
        }.accessibilityLevel('no-hide-descendants');
        }.padding(0).backgroundColor(Color.Transparent).borderRadius(0)
          .constraintSize({ minHeight: host.directoryToolHeight() }).enabled(host.scene.boundary().adjacentChapter(-1) !== undefined)
          .opacity(host.scene.boundary().adjacentChapter(-1) === undefined ? 0.36 : 1)
          .attributeModifier(new MangaDirectoryPressFeedback(host.scene.boundary().adjacentChapter(-1) !== undefined, true, host.scene.chrome().sheetScheme(), 'nativeButton'))
          .onClick((): void => {
            if (host.directorySheetInputCurrent(directoryIdentity)) void host.scene.boundary().selectAdjacentChapter(-1, true);
          }).accessibilityText('上一章节');
        Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: visual.toolGap }) {
          Text('完整目录').fontSize(visual.toolFontSize).lineHeight(visual.toolLineHeight).halfLeading(true).minFontScale(Math.min(1, host.directoryFontScale())).maxFontScale(Math.max(1, host.directoryFontScale())).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontColor(host.scene.chrome().accentColor(host.scene.chrome().sheetScheme()));
          Image(host.scene.chrome().sheetScheme() === 'night' ? $r('app.media.manga_directory_chevron_right_accent_theme_night') : $r('app.media.manga_directory_chevron_right_accent')).width(visual.toolIcon).height(visual.toolIcon);
        }.accessibilityLevel('no-hide-descendants');
        }.padding(0).backgroundColor(Color.Transparent).borderRadius(0)
          .constraintSize({ minHeight: host.directoryToolHeight() })
          .attributeModifier(new MangaDirectoryPressFeedback(true, true, host.scene.chrome().sheetScheme(), 'nativeButton'))
          .onClick((): void => host.openDirectoryDestination(false, directoryIdentity)).accessibilityText('完整目录');
        Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: visual.toolGap }) {
          Text('下一章节').fontSize(visual.toolFontSize).lineHeight(visual.toolLineHeight).halfLeading(true).minFontScale(Math.min(1, host.directoryFontScale())).maxFontScale(Math.max(1, host.directoryFontScale())).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400).fontColor(host.scene.chrome().accentColor(host.scene.chrome().sheetScheme()));
          Image(host.scene.chrome().sheetScheme() === 'night' ? $r('app.media.manga_directory_chevron_right_accent_theme_night') : $r('app.media.manga_directory_chevron_right_accent')).width(visual.toolIcon).height(visual.toolIcon);
        }.accessibilityLevel('no-hide-descendants');
        }.padding(0).backgroundColor(Color.Transparent).borderRadius(0)
          .constraintSize({ minHeight: host.directoryToolHeight() }).enabled(host.scene.boundary().adjacentChapter(1) !== undefined)
          .opacity(host.scene.boundary().adjacentChapter(1) === undefined ? 0.36 : 1)
          .attributeModifier(new MangaDirectoryPressFeedback(host.scene.boundary().adjacentChapter(1) !== undefined, true, host.scene.chrome().sheetScheme(), 'nativeButton'))
          .onClick((): void => {
            if (host.directorySheetInputCurrent(directoryIdentity)) void host.scene.boundary().selectAdjacentChapter(1, true);
          }).accessibilityText('下一章节');
      }.width('100%').margin({ top: visual.toolsTop, bottom: visual.toolsBottom })
        .onAreaChange((_old: Area, area: Area): void => {
          if (!host.scene.chapter.mounted || directoryIdentity !== host.directoryOuterIdentity() || host.scene.window.panel !== 'directory') return;
          const next = Number(area.height) + visual.toolsTop + visual.toolsBottom;
          if (Number.isFinite(next) && next > 0) {
            if (Math.abs(next - host.state.quickToolsMeasured) > .1) host.state.quickToolsMeasured = next;
            host.scheduleDirectoryOuterPosition(directoryIdentity);
          }
        });
  }

interface MangaDirectoryFooterContentInput {
  readonly host: MangaDirectoryDrawer;
}

@Builder
function MangaDirectoryFooterContent($$: MangaDirectoryFooterContentInput) {
    Row() {
    MangaDirectoryCurrentFooter({ title: $$.host.directoryCurrentTitle(),
      pagePosition: $$.host.directoryCurrentPagePosition(),
      scheme: $$.host.scene.chrome().sheetScheme(),
      availableWidth: $$.host.directoryInitialWidth(false),
      onHeightChanged: (height: number): void => { if (Math.abs(height - $$.host.state.quickFooterMeasured) > .1) $$.host.state.quickFooterMeasured = height; },
    }).width('100%');
    }.width('100%');
  }

@Builder
function MangaDirectoryBody(host: MangaDirectoryDrawer, catalog: boolean, directoryIdentity: string) {
    ReaderDirectoryNavigationSurface({
      inputCurrent: (): boolean => host.directoryContentInputCurrent(catalog, directoryIdentity),
      sourceId: host.scene.book.sourceId, bookId: host.scene.book.bookId, query: catalog ? '' : host.state.directoryQuery, ascending: host.state.directoryAscending,
      currentChapterIndex: host.directoryCurrentIndex(),
      openRevision: catalog ? host.scene.viewport().publishedManifestVersion : `${host.scene.viewport().publishedManifestVersion}:${host.state.directoryOpenRevision}`,
      locateCurrentRevision: host.state.directoryRevision, mangaDisplay: true,
      mangaInitialViewportWidth: host.directoryInitialWidth(catalog),
      mangaScheme: catalog ? host.scene.chrome().chromeScheme() : host.scene.chrome().sheetScheme(), rowHeight: 58, listPaddingX: 0, listPaddingY: 0,
      chapterEntries: host.directoryEntries(), mangaRowMinHeight: 58,
      mangaCurrentOpenInset: host.directoryCurrentOpenInset(catalog),
      mangaCatalogDisplay: catalog, mangaCatalogNarrow: catalog ? host.scene.window.stageWidth <= 700 :
        host.scene.chrome().widePanel() ? Number(host.scene.chrome().panelWidth()) <= 340 : (host.scene.window.stageWidth > 0 ? host.scene.window.stageWidth : host.scene.viewport().state.viewportWidth) <= visual.narrowWidth,
      mangaQuickDisplay: !catalog,
      interactionEnabled: catalog ? host.scene.chrome().state.panelPhase === 'closed' || host.scene.chrome().state.panelPhase === 'open' : host.directorySheetInputCurrent(directoryIdentity),
      chapterStartBookmarkCreationEnabled: false, bookmarkActionsEnabled: false, chapterDownloadEnabled: host.scene.book.downloadEnabled,
      chapterDownloadActionsEnabled: host.scene.book.downloadEnabled,
      onDownloadChapter: (index: number): void => {
        if (catalog || host.directorySheetInputCurrent(directoryIdentity)) void host.scene.chrome().openDownloadActions(index);
      },
      onClearSearch: (): void => { if (catalog || host.directorySheetInputCurrent(directoryIdentity)) host.state.directoryQuery = ''; },
      onFirstLayout: (): void => { if (!catalog) host.onDirectoryListFirstLayout(directoryIdentity); },
      onUserScrollIntent: (): void => { if (!catalog) host.onDirectoryOuterUserScroll(directoryIdentity); },
      fallbackBuilder: (): void => { host.scene.slots.directoryFallback(catalog, directoryIdentity); },
      onSelectTarget: (chapterIndex: number, _offset: number, _scope?: RemoteReadingPositionScope, proof?: ReaderDirectoryTargetProof): void => {
        if (catalog || host.directorySheetInputCurrent(directoryIdentity)) void host.selectDirectoryTarget(chapterIndex, proof, catalog);
      },
    }).width('100%').height(catalog || host.scene.chrome().widePanel() ? undefined : host.directoryQuickHeight())
      .layoutWeight(catalog || host.scene.chrome().widePanel() ? 1 : 0);
  }

@Builder
export function MangaDirectoryFallback(host: MangaDirectoryDrawer, catalog: boolean, directoryIdentity: string) {
    MangaReadingDirectoryFallback({
      inputCurrent: (): boolean => host.directoryContentInputCurrent(catalog, directoryIdentity),
      sourceId: host.scene.book.sourceId, bookId: host.scene.book.bookId, entries: host.directoryEntries(),
      query: catalog ? '' : host.state.directoryQuery, ascending: host.state.directoryAscending,
      currentChapterIndex: host.directoryCurrentIndex(),
      locateCurrentRevision: host.state.directoryRevision,
      mangaScheme: catalog ? host.scene.chrome().chromeScheme() : host.scene.chrome().sheetScheme(),
      rowHeight: 58, mangaCatalogDisplay: catalog, mangaCatalogNarrow: catalog ? host.scene.window.stageWidth <= 700 :
        host.scene.chrome().widePanel() ? Number(host.scene.chrome().panelWidth()) <= 340 : (host.scene.window.stageWidth > 0 ? host.scene.window.stageWidth : host.scene.viewport().state.viewportWidth) <= visual.narrowWidth,
      currentOpenInset: host.directoryCurrentOpenInset(catalog),
      onListFirstLayout: (): void => { if (!catalog) host.onDirectoryListFirstLayout(directoryIdentity); },
      onListUserScroll: (): void => { if (!catalog) host.onDirectoryOuterUserScroll(directoryIdentity); },
      chapterDownloadEnabled: host.scene.book.downloadEnabled,
      onDownloadChapter: (index: number): void => {
        if (catalog || host.directorySheetInputCurrent(directoryIdentity)) void host.scene.chrome().openDownloadActions(index);
      },
      onSelectChapter: (index: number): void => {
        if (catalog || host.directorySheetInputCurrent(directoryIdentity)) void host.selectDirectoryTarget(index, undefined, catalog);
      },
      onOpenFullDirectory: (): void => host.openDirectoryDestination(catalog, directoryIdentity),
      onClearSearch: (): void => { if (catalog || host.directorySheetInputCurrent(directoryIdentity)) host.state.directoryQuery = ''; },
    }).enabled(catalog ? host.scene.chrome().state.panelPhase === 'closed' || host.scene.chrome().state.panelPhase === 'open' : host.directorySheetInputCurrent(directoryIdentity));
  }
