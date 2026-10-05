import { ReaderDirectoryRules } from '../reading/ReaderDirectoryRules';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { readerDirectoryScopeKey } from '../reading/ReaderDirectoryNavigation';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { PageBackBar } from '../common/PageBackBar';
import { registerReaderFonts } from '../common/ReaderFonts';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight, readerInteractiveSafeTop } from '../common/ReaderWindowMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from '../common/SurfaceHorizontalGeometry';
import { TOK_CONTENT_MAX_W_TABLET } from '../common/ReaderTokens';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../reading/ReaderDirectoryMarkerState';
import { snapshotReaderDirectoryData, sameReaderDirectoryData } from '../reading/ReaderDirectoryDataSnapshot';
import { projectReaderDirectoryEntries } from '../reading/ReaderDirectoryProjection';
import { ReaderDirectoryToolbar } from '../reading/ReaderDirectoryToolbar';
import { ReaderDirectoryChapterRow } from '../reading/ReaderDirectoryChapterRow';
import { ReaderDirectoryList } from '../reading/ReaderDirectoryList';
import { ReaderDirectoryNavigationSurface } from '../reading/ReaderDirectoryNavigationSurface';
import { readerDirectorySignalScrollCommand, readerDirectorySignalScrollIntent } from '../reading/ReaderDirectoryViewport';
import type { RemoteReadingPositionScope } from '../reading/RemoteReadingPositionMigration';
import { MangaDownloadOperationsPanel } from '../manga/MangaDownloadOperationsPanel';
import type { MangaDownloadAction, MangaDownloadActionId } from '../manga/MangaDownloadActionsGateway';
import { mangaDirectoryPresentation, mangaDirectoryVisibleEntries,
  type MangaDirectoryRowPresentation } from '../manga/MangaDirectoryPresentation';

/** Detail-owned catalog. Reuses the control's toolbar/rows, never its sheet or reading session. */
@Component
export struct BookDirectoryPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onIdentityChanged') sourceId: string = '';
  @Prop @Watch('onIdentityChanged') bookId: string = '';
  @Prop @Watch('onRulesKindChanged') bookKind: string = '';
  @Prop @Watch('onEntriesChanged') entries: LocalReadingTocEntry[] = [];
  @Prop catalogMessage: string = '';
  @Prop contentKind: string = 'text';
  @Prop bookTitle: string = '';
  @Prop currentChapterIndex: number = -1;
  /** Core manga location page, kept separate from the TOC row ordinal. */
  @Prop currentPageOrdinal: number = -1;
  @Prop currentPageTotal: number = -1;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop mangaDownloadEnabled: boolean = false;
  onLoadDownloadActions: (chapterIndex?: number) => Promise<MangaDownloadAction[]> = async (): Promise<MangaDownloadAction[]> => [];
  onDownloadAction: (action: MangaDownloadActionId, chapterIndex?: number) => Promise<void> = async (): Promise<void> => {};
  @State private downloadMenuVisible: boolean = false;
  @State private downloadActions: MangaDownloadAction[] = [];
  @State private downloadActionsLoading: boolean = false;
  @State private downloadActionsFailure: string = '';
  private downloadMenuChapterIndex: number | undefined = undefined;
  private downloadMenuGeneration: number = 0;
  private downloadMenuIdentity: string = '';
  onBack: () => void = (): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: JsonObject): void => {};
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  @State private rulesExpanded: boolean = false;
  @State private rulesRevision: number = 0;
  @State private searchDraft: string = '';
  @State private searchQuery: string = '';
  @State private ascending: boolean = true;
  @State private projectedEntries: LocalReadingTocEntry[] = [];
  @State private viewportWidth: number = 0;
  @State private navigationInteracted: boolean = false;
  @State private navigationActive: boolean = false;
  @State private locateCurrentRevision: number = 0;
  @State private mangaCollapsedGroups: number[] = [];
  @State private mangaPresentation: Map<number, MangaDirectoryRowPresentation> = new Map<number, MangaDirectoryRowPresentation>();
  private admittedEntries: LocalReadingTocEntry[] = [];
  @State private admittedIdentity: string = '';
  private mounted: boolean = false;
  private projectionGeneration: number = 0;
  private scrollGeneration: number = 0;
  private listReady: boolean = false;
  private pendingScrollEdge: Edge | undefined = undefined;
  private pendingScrollUserIntent: boolean = false;
  private readonly listScroller: Scroller = new Scroller();

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.mounted = true;
    this.admitEntries(true);
  }

  aboutToDisappear(): void {
    this.downloadMenuGeneration += 1;
    this.downloadMenuVisible = false;
    this.mounted = false;
    this.projectionGeneration += 1;
    this.scrollGeneration += 1;
    this.admittedIdentity = '';
    this.listReady = false;
    this.pendingScrollEdge = undefined;
    this.pendingScrollUserIntent = false;
  }

  build() {
    if (this.contentKind === 'manga') {
      this.mangaPage();
    } else {
      this.standardPage();
    }
  }

  @Builder
  private standardPage() {
    Column() {
      PageBackBar({ title: '目录', onBack: (): void => this.onBack() });
      if (this.supportsDirectoryRules() && ReaderRuntimeOwner.current().supportsCoreCapability('reading.directory.view.v2')) {
        Button(this.rulesExpanded ? '收起层级规则' : '本书目录层级规则').onClick((): void => { this.rulesExpanded = !this.rulesExpanded; });
        if (this.rulesExpanded) { ReaderDirectoryRules({ bookId: this.bookId, onApplied: (): void => { this.rulesRevision += 1; } }); }
      }
      Column() {
        ReaderDirectoryToolbar({
          text: this.searchDraft,
          placeholder: '搜索章节名称',
          ascending: this.ascending,
          showChapterTools: true,
          onTextChange: (value: string): void => { this.searchDraft = value; },
          onSearch: (): void => this.applySearch(),
          onTop: (): void => this.scrollToEdge(Edge.Top),
          onBottom: (): void => this.scrollToEdge(Edge.Bottom),
          onToggleSort: (): void => this.toggleSort(),
        });
        Text('').width('100%').height(1)
          .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
        Stack({ alignContent: Alignment.TopStart }) {
          // Only a different book replaces the List. Filtering, sorting and
          // projection refreshes keep its native owner and use original indexes.
          ForEach([this.admittedIdentity], (identity: string) => {
            if (this.sourceId.length > 0) {
              ReaderDirectoryNavigationSurface({
                sourceId: this.sourceId, bookId: this.bookId, query: this.searchQuery, ascending: this.ascending,
                currentChapterIndex: this.currentChapterIndex, openRevision: `${identity}:${this.rulesRevision}`,
                interacted: this.navigationInteracted,
                rowHeight: 40, listPaddingX: 10, listPaddingY: 5,
                edgeEffectMode: EdgeEffect.Spring, scroller: this.listScroller,
                chapterEntries: this.admittedEntries,
                chapterDownloadEnabled: this.sourceId !== 'local',
                chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
                fallbackBuilder: (): void => { this.flatList(identity); },
                onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject): void => {
                  if (this.mounted && identity === this.admittedIdentity && identity === this.identity())
                    this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
                },
                onFirstLayout: (): void => this.onListFirstLayout(identity),
                onUserScrollIntent: (): void => this.onListUserScroll(),
                onTreeStateChange: (active: boolean): void => {
                  this.navigationActive = active;
                  this.listReady = false;
                },
                onDeleteBookmarks: (times: number[]): void => this.onDeleteBookmarks(times),
                onDownloadChapter: (chapterIndex: number): void => {
                  if (this.mounted && identity === this.admittedIdentity && identity === this.identity())
                    this.onDownloadChapter(chapterIndex);
                },
                onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
                  this.onCreateChapterStartBookmark(request),
              }).width('100%').height('100%');
            } else {
              this.flatList(identity);
            }
          }, (identity: string): string => identity);
          if (this.projectedEntries.length === 0 && !this.navigationActive) {
            Text(this.emptyMessage())
              .width('100%').height('100%').padding(20)
              .fontFamily('ReaderNotoSansSC').fontSize(14)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
              .textAlign(TextAlign.Center);
          }
        }.layoutWeight(1).width('100%');
      }
      .width(this.contentFrame().width)
      .layoutWeight(1)
      .margin({ left: this.contentFrame().left, right: this.contentFrame().right })
      .padding({ bottom: this.bottomInset() });
    }
    .width('100%').height('100%')
    .backgroundColor(readerAppColor('app.window.background', this.appThemeScheme))
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = Number(newValue.width);
      if (Number.isFinite(width) && width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
        this.viewportWidth = width;
      }
    });
  }

  @Builder
  private mangaPage() {
    Stack({ alignContent: Alignment.Top }) {
      ForEach([this.admittedIdentity], (identity: string) => {
        ReaderDirectoryNavigationSurface({
          sourceId: this.sourceId, bookId: this.bookId, query: this.searchQuery, ascending: this.ascending,
          currentChapterIndex: this.currentChapterIndex, openRevision: `${identity}:${this.rulesRevision}`,
          locateCurrentRevision: this.locateCurrentRevision,
          interacted: this.navigationInteracted, mangaDisplay: true,
          rowHeight: 58, listPaddingX: this.contentFrame().left,
          listPaddingRight: this.contentFrame().right,
          listPaddingY: 8, listPaddingTop: this.topInset() + 200,
          listPaddingBottom: this.bottomInset() + 72,
          edgeEffectMode: EdgeEffect.Spring, scroller: this.listScroller,
          chapterEntries: this.admittedEntries,
          chapterDownloadEnabled: this.mangaDownloadEnabled,
          chapterDownloadActionsEnabled: this.mangaDownloadEnabled,
          onDownloadChapter: (index: number): void => {
            if (this.mounted && identity === this.admittedIdentity && identity === this.identity()) void this.openDownloadActions(index);
          },
          fallbackBuilder: (): void => { this.mangaFlatList(identity); },
          onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number,
            positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject): void => {
            if (this.mounted && identity === this.admittedIdentity && identity === this.identity())
              this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
          },
          onFirstLayout: (): void => this.onListFirstLayout(identity),
          onUserScrollIntent: (): void => this.onListUserScroll(),
          onTreeStateChange: (active: boolean): void => { this.navigationActive = active; this.listReady = false; },
        }).width('100%').height('100%');
      }, (identity: string): string => identity);
      Row() {
        PageBackBar({ title: '目录', floating: true, centered: true, onBack: (): void => this.onBack(),
          trailing: (): void => { this.mangaDownloadMenuButton(); } });
      }.width('100%').padding({ left: this.contentFrame().left, right: this.contentFrame().right, top: this.topInset() + 8 })
        .align(Alignment.Top).hitTestBehavior(HitTestMode.Transparent);
      Column() {
        Row() {
          Column({ space: 2 }) {
            Text(this.bookTitle || '漫画目录')
              .fontFamily('ReaderNotoSerifSCBold').fontWeight(FontWeight.Bold).fontSize(18).lineHeight(24)
              .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis });
            Text(`${this.admittedEntries.filter((entry: LocalReadingTocEntry): boolean => entry.navigable !== false).length} 个可读条目${this.admittedEntries.filter((entry: LocalReadingTocEntry): boolean => entry.navigable === false).length > 0 ? ` · ${this.admittedEntries.filter((entry: LocalReadingTocEntry): boolean => entry.navigable === false).length} 个卷组` : ''}`)
              .fontFamily('ReaderNotoSansSC').fontSize(11).lineHeight(16)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1);
          }.layoutWeight(1).alignItems(HorizontalAlign.Start);
        }.width('100%').height(42);
        ReaderDirectoryToolbar({ text: this.searchDraft, placeholder: '搜索话／卷名称', ascending: this.ascending,
          showChapterTools: true, onTextChange: (value: string): void => { this.searchDraft = value; },
          onSearch: (): void => this.applySearch(), onTop: (): void => this.scrollToEdge(Edge.Top),
          onBottom: (): void => this.scrollToEdge(Edge.Bottom), onToggleSort: (): void => this.toggleSort() });
        Row() {
          Text('可读条目与卷组').layoutWeight(1).fontSize(11).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
          Text('定位当前').height(24).fontSize(12).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
            .enabled(this.currentChapterIndex >= 0).opacity(this.currentChapterIndex >= 0 ? 1 : 0.4)
            .onClick((): void => this.locateCurrent());
        }.width('100%').height(24).padding({ left: 10, right: 10 });
      }.width(this.contentFrame().width).height(126)
        .padding({ left: 10, right: 10, bottom: 8 })
        .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme)).borderRadius(14)
        .align(Alignment.Top).margin({ top: this.topInset() + 66 });
      Stack({ alignContent: Alignment.Bottom }) {
        Row({ space: 10 }) {
          Text('当前章节')
            .flexShrink(0)
            .fontFamily('ReaderNotoSansSC')
            .fontSize(10)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1);
          Text(this.mangaCurrentTitle())
            .layoutWeight(1)
            .constraintSize({ minWidth: 0 })
            .fontFamily('ReaderNotoSansSC')
            .fontWeight(FontWeight.Medium)
            .fontSize(12)
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(this.mangaCurrentPosition())
            .flexShrink(0)
            .fontFamily('ReaderInter')
            .fontSize(10)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .maxLines(1)
            .textAlign(TextAlign.End);
        }
        .width(this.contentFrame().width)
        .height(48)
        .padding({ left: 13, right: 13 })
        .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
        .border({ width: 1, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
        .borderRadius(14)
        .margin({ left: this.contentFrame().left, right: this.contentFrame().right, bottom: this.bottomInset() + 12 });
      }
      .width('100%')
      .height('100%')
      .hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%')
      .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
      .onAreaChange((_old: Area, area: Area): void => {
        const width = Number(area.width);
        if (Number.isFinite(width) && width > 0) this.viewportWidth = width;
      });
  }

  @Builder
  private mangaFlatList(identity: string) {
    ReaderDirectoryList({
      entries: this.mangaVisibleEntries(), rowHeight: 58, naturalRowHeight: true,
      listPaddingX: this.contentFrame().left, listPaddingY: 8,
      listPaddingRight: this.contentFrame().right,
      listPaddingTop: this.topInset() + 200, listPaddingBottom: this.bottomInset() + 24,
      edgeEffectMode: EdgeEffect.Spring, scroller: this.listScroller,
      onFirstLayout: (): void => this.onListFirstLayout(identity),
      onUserScrollIntent: (): void => this.onListUserScroll(),
      rowBuilder: (item: RepeatItem<LocalReadingTocEntry>) => { this.mangaFlatRow(item.item, identity); },
    }).width('100%').height('100%');
    if (this.projectedEntries.length === 0) {
      Text(this.emptyMessage()).width('100%').padding({ top: this.topInset() + 166, left: 24, right: 24 })
        .fontSize(13).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).hitTestBehavior(HitTestMode.None);
    }
  }

  @Builder
  private mangaFlatRow(entry: LocalReadingTocEntry, identity: string) {
    Row({ space: 8 }) {
      Column({ space: 3 }) {
        Text(entry.title).width('100%').fontSize(14).lineHeight(22)
          .fontWeight(entry.navigable === false ? FontWeight.Medium : FontWeight.Regular)
          .fontColor(readerAppColor(entry.navigable === false ? 'TOK_MUTED' : 'TOK_INK', this.appThemeScheme));
        if (this.searchQuery.length > 0 && this.mangaGroupFor(entry) !== undefined) {
          Text(this.mangaGroupFor(entry)?.title ?? '').width('100%').fontSize(11).lineHeight(16)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
      }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        .onClick((): void => this.selectMangaEntry(entry, identity));
      if (this.mangaDownloadEnabled && entry.navigable !== false && entry.downloadState !== 'unknown') {
        Stack() {
          Image(entry.downloadState === 'completed' ?
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download')))
            .width(15).height(15);
        }.width(26).height(58).accessibilityText('管理本章下载')
          .onClick((): void => {
            if (this.mounted && identity === this.admittedIdentity && identity === this.identity() &&
              sameReaderDirectoryData(this.admittedEntries, this.entries)) void this.openDownloadActions(entry.index);
          });
      }
      if (this.mangaIsGroup(entry)) {
        Text(this.mangaCollapsedGroups.includes(entry.index) ? '›' : '⌄').width(24).fontSize(18)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .onClick((): void => this.selectMangaEntry(entry, identity));
      } else if (entry.index === this.currentChapterIndex) {
        Text('正在读').fontSize(11).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .onClick((): void => this.selectMangaEntry(entry, identity));
      }
    }.width('100%').constraintSize({ minHeight: entry.navigable === false ? 44 : 58 })
      .padding({ left: this.mangaGroupFor(entry) === undefined ? 10 : 26, right: 10, top: 10, bottom: 10 })
      .backgroundColor(entry.navigable !== false && entry.index === this.currentChapterIndex ?
        readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) :
        entry.navigable === false ? readerAppColor('TOK_CARD_BG', this.appThemeScheme) : Color.Transparent)
      .borderRadius(8);
  }

  private selectMangaEntry(entry: LocalReadingTocEntry, identity: string): void {
    if (!this.mounted || identity !== this.identity() || identity !== this.admittedIdentity ||
      !sameReaderDirectoryData(this.admittedEntries, this.entries)) return;
    if (entry.navigable === false) {
      if (!this.mangaIsGroup(entry)) return;
      this.mangaCollapsedGroups = this.mangaCollapsedGroups.includes(entry.index) ?
        this.mangaCollapsedGroups.filter((index: number): boolean => index !== entry.index) : [...this.mangaCollapsedGroups, entry.index];
    } else if (this.rowIsCurrent(entry, identity)) this.onSelectChapter(entry.index);
  }

  private mangaGroupFor(entry: LocalReadingTocEntry): LocalReadingTocEntry | undefined {
    const ancestors = this.mangaPresentation.get(entry.index)?.ancestorGroupIndexes ?? [];
    const index = ancestors[ancestors.length - 1];
    return index === undefined ? undefined : this.admittedEntries.find((row: LocalReadingTocEntry): boolean => row.index === index);
  }

  private mangaIsGroup(entry: LocalReadingTocEntry): boolean {
    return this.mangaPresentation.get(entry.index)?.group === true;
  }

  @Builder
  private mangaDownloadMenuButton() {
    if (this.mangaDownloadEnabled) {
      Stack({ alignContent: Alignment.Center }) {
        Image(this.appThemeScheme === 'night' ? $r('app.media.reader_directory_more_theme_night') : $r('app.media.reader_directory_more'))
          .width(20).height(20);
      }.width(44).height(44).accessibilityText('漫画下载管理')
        .onClick((): void => { void this.openDownloadActions(); })
        .bindPopup(this.downloadMenuVisible, { builder: (): void => { this.downloadOperationsMenu(); },
          placement: Placement.BottomLeft, enableArrow: false,
          popupColor: readerAppColor('TOK_CARD_BG', this.appThemeScheme),
          onStateChange: (event: PopupStateChangeParam): void => { if (!event.isVisible) this.downloadMenuVisible = false; } });
    }
  }

  @Builder
  private downloadOperationsMenu() {
    Scroll() {
      MangaDownloadOperationsPanel({ actions: this.downloadActions, loading: this.downloadActionsLoading,
        failureMessage: this.downloadActionsFailure,
        onAction: (action: MangaDownloadActionId): void => this.performDownloadAction(action),
        onRetry: (): void => { void this.openDownloadActions(this.downloadMenuChapterIndex); } });
    }.width(Math.min(240, this.contentFrame().width)).constraintSize({ maxHeight: 340 }).padding(8).scrollBar(BarState.Off);
  }

  private async openDownloadActions(chapterIndex?: number): Promise<void> {
    if (!this.mounted || !this.mangaDownloadEnabled || this.contentKind !== 'manga') return;
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
    if (!this.mounted || !this.mangaDownloadEnabled || this.contentKind !== 'manga' ||
      !this.downloadMenuVisible || this.downloadMenuIdentity !== this.identity() || this.downloadActionsLoading ||
      !this.downloadActions.some(item => item.id === action)) return;
    const chapterIndex = this.downloadMenuChapterIndex;
    this.downloadMenuVisible = false;
    void this.onDownloadAction(action, chapterIndex).catch((): void => {
      // Index owns operation feedback. Do not turn a catalog action into a
      // failed/unhandled reader lifecycle promise.
    });
  }

  private mangaCurrentTitle(): string {
    const entry = this.admittedEntries.find((row: LocalReadingTocEntry): boolean => row.index === this.currentChapterIndex);
    return entry?.title ?? '尚未开始阅读';
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
    this.publishProjection(projectReaderDirectoryEntries(this.admittedEntries, '', this.ascending));
    this.locateCurrentRevision += 1;
    const generation = ++this.scrollGeneration;
    setTimeout((): void => {
      if (!this.mounted || generation !== this.scrollGeneration || this.navigationActive) return;
      const index = this.mangaVisibleEntries().findIndex((entry: LocalReadingTocEntry): boolean => entry.index === this.currentChapterIndex);
      if (index >= 0 && this.listReady) this.listScroller.scrollToIndex(index, false, ScrollAlign.CENTER);
    }, 0);
  }

  @Builder
  private flatList(identity: string) {
    ReaderDirectoryList({
      entries: this.projectedEntries,
      rowHeight: 40,
      listPaddingX: 10,
      listPaddingY: 5,
      edgeEffectMode: EdgeEffect.Spring,
      scroller: this.listScroller,
      onFirstLayout: (): void => this.onListFirstLayout(identity),
      onUserScrollIntent: (): void => this.onListUserScroll(),
      rowBuilder: (item: RepeatItem<LocalReadingTocEntry>) => { this.chapterRow(item, identity); },
    }).width('100%').height('100%');
  }

  @Builder
  private chapterRow(item: RepeatItem<LocalReadingTocEntry>, identity: string) {
    ReaderDirectoryChapterRow({
      entry: item.item,
      rowHeight: 40,
      chapterDownloadEnabled: this.sourceId !== 'local',
      chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
      onSelectChapter: (index: number): void => {
        if (this.rowIsCurrent(item.item, identity) && index === item.item.index) this.onSelectChapter(index);
      },
      onDownloadChapter: (index: number): void => {
        if (this.rowIsCurrent(item.item, identity) && index === item.item.index) this.onDownloadChapter(index);
      },
      onDeleteBookmarks: (times: number[]): void => {
        if (this.rowIsCurrent(item.item, identity)) this.onDeleteBookmarks(times);
      },
      onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void => {
        if (this.rowIsCurrent(item.item, identity) && request.chapterIndex === item.item.index &&
          request.chapterTitle === item.item.title) this.onCreateChapterStartBookmark(request);
      },
    });
  }

  private identity(): string { return `${this.sourceId}\u0000${this.bookId}`; }

  private supportsDirectoryRules(): boolean {
    // Both values are emitted by Core's TXT parsers. Never infer format from
    // the filename, title or merely being a local book; Core rechecks integrity.
    const kind = this.bookKind.trim().toLowerCase();
    return this.sourceId === 'local' && (kind === 'txt' || kind === 'local');
  }

  private onRulesKindChanged(): void { this.rulesExpanded = false; }

  private rowIsCurrent(entry: LocalReadingTocEntry, identity: string): boolean {
    if (!this.mounted || identity !== this.identity() || identity !== this.admittedIdentity ||
      entry.navigable === false || !sameReaderDirectoryData(this.admittedEntries, this.entries)) return false;
    // ArkUI @Prop copies the List's objects. Compare the Core-backed facts,
    // never object references across that component boundary.
    const current = this.projectedEntries.find((candidate: LocalReadingTocEntry): boolean => candidate.index === entry.index);
    return current !== undefined && sameReaderDirectoryData([entry], [current]);
  }

  private onIdentityChanged(): void {
    this.downloadMenuGeneration += 1;
    this.downloadMenuVisible = false;
    this.downloadMenuIdentity = '';
    this.rulesExpanded = false;
    this.rulesRevision = 0;
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
      return before !== undefined && after !== undefined && this.mangaIsGroup(after) && sameReaderDirectoryData([before], [after]);
    }) : [];
    this.publishProjection(projectReaderDirectoryEntries(this.admittedEntries,
      reset ? '' : this.searchQuery, reset ? true : this.ascending));
    if (reset || wasEmpty) this.scheduleTopScroll();
  }

  private applySearch(): void {
    const nextQuery = this.searchDraft.trim();
    this.searchQuery = nextQuery;
    this.publishProjection(projectReaderDirectoryEntries(this.admittedEntries, nextQuery, this.ascending));
    this.scheduleTopScroll();
  }

  private toggleSort(): void {
    const nextAscending = !this.ascending;
    this.ascending = nextAscending;
    this.publishProjection(projectReaderDirectoryEntries(this.admittedEntries, this.searchQuery, nextAscending));
    this.scheduleTopScroll();
  }

  private scheduleTopScroll(): void {
    const generation = ++this.scrollGeneration;
    this.pendingScrollEdge = Edge.Top;
    this.pendingScrollUserIntent = false;
    setTimeout((): void => {
      if (generation === this.scrollGeneration) this.flushPendingScroll();
    }, 0);
  }

  private scrollToEdge(edge: Edge): void {
    if (this.sourceId.length > 0) readerDirectorySignalScrollIntent(readerDirectoryScopeKey(this.sourceId, this.bookId));
    this.scrollGeneration += 1;
    this.pendingScrollEdge = edge;
    this.pendingScrollUserIntent = this.sourceId.length > 0;
    this.flushPendingScroll();
  }

  private publishProjection(entries: LocalReadingTocEntry[]): void {
    // The List remains mounted beneath the empty-state text. Empty and
    // nonempty updates may coalesce; neither invalidates its native readiness.
    this.projectedEntries = entries;
  }

  private onListFirstLayout(identity: string): void {
    if (!this.mounted || identity !== this.admittedIdentity || identity !== this.identity()) return;
    this.listReady = true;
    this.flushPendingScroll();
  }

  private onListUserScroll(): void {
    this.scrollGeneration += 1;
    this.pendingScrollEdge = undefined;
    this.pendingScrollUserIntent = false;
    this.navigationInteracted = true;
  }

  private flushPendingScroll(): void {
    const edge = this.pendingScrollEdge;
    if (!this.mounted || !this.listReady ||
      (this.projectedEntries.length === 0 && !this.navigationActive) || edge === undefined) return;
    this.pendingScrollEdge = undefined;
    const userIntent = this.pendingScrollUserIntent;
    this.pendingScrollUserIntent = false;
    this.listScroller.scrollEdge(edge);
    if (userIntent) readerDirectorySignalScrollCommand(readerDirectoryScopeKey(this.sourceId, this.bookId));
  }

  private emptyMessage(): string {
    if (this.searchQuery.length > 0 && this.admittedEntries.length > 0) return '没有匹配的章节';
    return this.catalogMessage.trim().length > 0 ? this.catalogMessage : '暂无章节信息';
  }

  private contentFrame(): SurfaceHorizontalFrame {
    const metrics = ReaderWindowCoordinator.metrics();
    const width = this.viewportWidth > 0 ? this.viewportWidth :
      (this.readerWindowMetricsRevision < 0 ? 0 : metrics.windowRect.width);
    return resolveHorizontalFrame(width, readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics),
      new SurfaceWidthSpec(TOK_CONTENT_MAX_W_TABLET, 20, 20, 'center'));
  }

  private bottomInset(): number {
    if (this.readerWindowMetricsRevision < 0) return 12;
    return Math.max(12, readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics()));
  }
}
