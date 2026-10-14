import { LengthMetrics } from '@kit.ArkUI';
import { MangaDirectoryCurrentFooter } from '../manga/MangaDirectoryCurrentFooter';
import { MangaDirectoryPressFeedback } from '../manga/MangaDirectoryPressFeedback';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor, mangaDirectoryScale, mangaDirectoryLineBox, mangaDirectoryContentTop, mangaDirectoryFooterHeight, mangaDirectoryHeaderHeight, mangaDirectoryFullFlowFooter } from '../manga/MangaDirectoryVisual';
import { ReaderDirectoryRecoverySurface } from '../reading/ReaderDirectoryRecoverySurface';
import { EMPTY_READING_DIRECTORY_RECOVERY, type ReadingDirectoryRecovery } from '../reading/ReadingDirectoryRecovery';
import { TYPE_FORM_STATE_BODY } from '../common/ReaderTypography';
import { ReaderDirectoryRules } from '../reading/ReaderDirectoryRules';
import { ReaderRuntimeOwner } from '../../app/ReaderRuntimeOwner';
import { readerDirectoryScopeKey } from '../reading/ReaderDirectoryNavigation';
import type { JsonObject } from '@reader/core-harmony';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { PageBackBar } from '../common/PageBackBar';
import { registerReaderFonts, prepareMangaSheetFonts, prepareReaderFontFamily } from '../common/ReaderFonts';
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
import { ReaderMangaDownloadPopup } from '../common/ReaderMangaDownloadPopup';
import { ReaderRecoveryAction } from '../common/ReaderRecoveryAction';
import type { MangaDownloadAction, MangaDownloadActionId } from '../manga/MangaDownloadActionsGateway';
import { mangaDirectoryPresentation, mangaDirectoryVisibleEntries,
  type MangaDirectoryRowPresentation } from '../manga/MangaDirectoryPresentation';
import { mangaDirectoryEntryRows, type MangaDirectoryLayoutRow } from '../manga/MangaDirectoryLayout';
import { MangaDirectoryEntryRow } from '../manga/MangaDirectoryEntryRow';
import { ReaderSearchField } from '../common/ReaderSearchField';
import { READER_FONT_NOTO_SANS_SC_UI_REGULAR, READER_FONT_NOTO_SANS_SC_UI_MEDIUM, READER_FONT_NOTO_SERIF_SC_BOLD } from '../common/ReaderFontFamilies';
import { readerPageAreaLength, readerPageContentStartInset } from '../common/ReaderPageShell';
import { ReaderPageScaffold } from '../common/ReaderPageScaffold';

/** Detail-owned catalog. Reuses the control's toolbar/rows, never its sheet or reading session. */
@Component
export struct BookDirectoryPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('onMangaMetricsChanged') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onIdentityChanged') sourceId: string = '';
  @Prop @Watch('onIdentityChanged') bookId: string = '';
  @Prop @Watch('onRulesKindChanged') bookKind: string = '';
  @Prop @Watch('onEntriesChanged') entries: LocalReadingTocEntry[] = [];
  @Prop catalogMessage: string = '';
  @Prop directoryRecovery: ReadingDirectoryRecovery = EMPTY_READING_DIRECTORY_RECOVERY;
  onReconcileBookmarks: (generation: number, identity: string) => void = (): void => {};
  onContinueBookmarks: (generation: number, identity: string) => void = (): void => {};
  onReconcileOffline: (generation: number, identity: string) => void = (): void => {};
  onContinueOffline: (generation: number, identity: string) => void = (): void => {};

  @Prop @Watch('onMangaKindChanged') contentKind: string = 'text';
  @Prop bookTitle: string = '';
  @Prop currentChapterIndex: number = -1;
  /** Core manga location page, kept separate from the TOC row ordinal. */
  @Prop @Watch('onMangaPositionChanged') currentPageOrdinal: number = -1;
  @Prop @Watch('onMangaPositionChanged') currentPageTotal: number = -1;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
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
  onBack: () => void = (): void => {};
  onRetryCatalog: () => void = (): void => {};
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
  @State private mangaViewportHeight: number = 0;
  @State private standardHeaderHeight: number = readerPageContentStartInset() + 51;
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
  private pendingScrollUserIntent: boolean = false;
  private pendingMangaCurrentScroll: boolean = false;
  private readonly listScroller: Scroller = new Scroller();

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.mounted = true;
    if (this.contentKind === 'manga') this.prepareMangaPageFonts();
    this.admitEntries(true);
  }

  aboutToDisappear(): void {
    this.downloadMenuGeneration += 1;
    this.mangaFontGeneration += 1;
    this.downloadMenuVisible = false;
    this.mounted = false;
    this.projectionGeneration += 1;
    this.scrollGeneration += 1;
    this.admittedIdentity = '';
    this.listReady = false;
    this.pendingScrollEdge = undefined;
    this.pendingScrollUserIntent = false;
    this.pendingMangaCurrentScroll = false;
  }

  private supportsCurrentDirectoryView(): boolean {
    let owner: ReaderRuntimeOwner;
    try { owner = ReaderRuntimeOwner.current(); } catch (_) { return false; }
    return owner.supportsCoreCapability('reading.directory.view.v2');
  }

  @Builder
  private recoveryContent() {
    if (this.directoryRecovery.bookmarks.visible || this.directoryRecovery.offline.visible) {
      ReaderDirectoryRecoverySurface({ recovery: this.directoryRecovery,
        onReconcileBookmarks: this.onReconcileBookmarks, onContinueBookmarks: this.onContinueBookmarks,
        onReconcileOffline: this.onReconcileOffline, onContinueOffline: this.onContinueOffline });
    }
  }

  build() {
    if (this.contentKind === 'manga') {
      if (this.mangaFontsReady) { this.mangaPage(); }
      else {
        ReaderPageScaffold({ variant: 'mangaDirectory', headerKind: 'mangaDirectory',
          content: (): void => { this.fontPreparationContent(); } });
      }
    } else {
      this.standardPage();
    }
  }

  @Builder
  private fontPreparationContent() {
    Column({ space: 12 }) {
      if (this.mangaFontsFailed) {
        Text('目录暂时无法显示').fontSize(TYPE_FORM_STATE_BODY.fontSizeFp);
        Button('重试').onClick((): void => this.prepareMangaPageFonts());
      }
    }.width('100%').height('100%').justifyContent(FlexAlign.Center);
  }

  @Builder
  private standardPage() {
    ReaderPageScaffold({ variant: 'directory', headerKind: 'standard',
      content: (): void => { this.standardContent(); },
      header: (): void => { this.standardHeader(); },
      onHeaderHeightChange: (height: number): void => {
        if (Number.isFinite(height) && height > 0 && Math.abs(height - this.standardHeaderHeight) > .1)
          this.standardHeaderHeight = height;
      },
    }).onAreaChange((_oldValue: Area, newValue: Area): void => {
      const width = readerPageAreaLength(newValue.width);
      if (Number.isFinite(width) && width > 0 && Math.abs(width - this.viewportWidth) >= 0.01) {
        this.viewportWidth = width;
      }
    });
  }

  @Builder
  private standardHeader() {
    Column() {
      PageBackBar({ title: '目录', onBack: (): void => this.onBack() });
      this.standardToolbar();
    }.width('100%');
  }

  @Builder
  private standardToolbar() {
    Column() {
      if (this.supportsDirectoryRules() && this.supportsCurrentDirectoryView()) {
        Button(this.rulesExpanded ? '收起层级规则' : '本书目录层级规则').onClick((): void => { this.rulesExpanded = !this.rulesExpanded; });
        if (this.rulesExpanded) { ReaderDirectoryRules({ bookId: this.bookId, onApplied: (): void => { this.rulesRevision += 1; } }); }
      }
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
      this.recoveryContent();
      Text('').width('100%').height(1)
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
    }
    .width(this.contentFrame().width)
    .margin({ left: this.contentFrame().left, right: this.contentFrame().right })
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private standardContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      // Only a different book replaces the List. Filtering, sorting and
      // projection refreshes keep its native owner and use original indexes.
      ForEach([this.admittedIdentity], (identity: string) => {
        if (this.sourceId.length > 0) {
          ReaderDirectoryNavigationSurface({
            sourceId: this.sourceId, bookId: this.bookId, query: this.searchQuery, ascending: this.ascending,
            currentChapterIndex: this.currentChapterIndex, openRevision: `${identity}:${this.rulesRevision}`,
            interacted: this.navigationInteracted,
            rowHeight: 40, listPaddingX: 10, listPaddingY: 0,
            contentStartInset: this.standardHeaderHeight + 5, contentEndInset: this.bottomInset() + 5,
            edgeEffectMode: EdgeEffect.Spring, scroller: this.listScroller,
            chapterEntries: this.admittedEntries,
            chapterDownloadEnabled: this.sourceId !== 'local' && this.directoryRecovery.offlineBlocked !== true,
            chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
            fallbackBuilder: (): void => { this.flatList(identity); },
            onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: JsonObject): void => {
              if (this.mounted && identity === this.admittedIdentity && identity === this.identity())
                this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
            },
            onFirstLayout: (): void => this.onListFirstLayout(identity),
            onUserScrollIntent: (): void => this.onListUserScroll(),
            onClearSearch: (): void => { this.searchDraft = ''; this.applySearch(); },
            onTreeStateChange: (active: boolean): void => {
              this.navigationActive = active;
              this.listReady = false;
            },
            onDeleteBookmarks: (times: number[]): void => this.onDeleteBookmarks(times),
            onDownloadChapter: (chapterIndex: number): void => {
              if (this.mounted && identity === this.admittedIdentity && identity === this.identity())
                if (this.directoryRecovery.offlineBlocked !== true) this.onDownloadChapter(chapterIndex);
            },
            onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
              this.onCreateChapterStartBookmark(request),
          }).width('100%').height('100%');
        } else {
          this.flatList(identity);
        }
      }, (identity: string): string => identity);
      if (this.projectedEntries.length === 0 && !this.navigationActive) {
        Column({ space: 10 }) {
          Text(this.emptyMessage())
            .width('100%')
            .fontFamily(TYPE_FORM_STATE_BODY.fontFamily as string).fontSize(TYPE_FORM_STATE_BODY.fontSizeFp)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
            .textAlign(TextAlign.Center);
          if (this.catalogRetryVisible()) {
            ReaderRecoveryAction({ label: '重试加载目录', generation: this.projectionGeneration,
              actionEnabled: this.mounted, onReconcile: (): void => this.onRetryCatalog() });
          }
        }
          .width('100%').height('100%')
          .justifyContent(FlexAlign.Center)
          .padding({ left: 20, right: 20, top: this.standardHeaderHeight, bottom: this.bottomInset() + 20 });
      }
    }.height('100%').width(this.contentFrame().width)
      .margin({ left: this.contentFrame().left, right: this.contentFrame().right });
  }

  @Builder
  private mangaPage() {
    ReaderPageScaffold({ variant: 'mangaDirectory', headerKind: 'mangaDirectory',
      headerTop: this.topInset() + visual.headerSafeGap,
      headerInsetLeft: this.headerFrame().left, headerInsetRight: this.headerFrame().right,
      footerInsetLeft: this.contentFrame().left, footerInsetRight: this.contentFrame().right,
      footerBottom: this.mangaBottomInset() + this.mangaFooterBottomOffset(),
      footerSurface: this.mangaFlowFooter() ? 'transparent' : 'solid',
      contentEndInset: this.mangaFlowFooter() ? 0 : this.mangaBottomClearance(),
      content: (): void => { this.mangaContent(); },
      header: (): void => { this.mangaHeader(); },
      footer: (): void => { this.mangaFixedFooter(); },
    })
      .onAreaChange((_old: Area, area: Area): void => {
        const width = readerPageAreaLength(area.width);
        const height = readerPageAreaLength(area.height);
        if (Number.isFinite(height) && height > 0) this.mangaViewportHeight = height;
        if (Number.isFinite(width) && width > 0) {
          const previousWidth = this.viewportWidth;
          this.viewportWidth = width;
          if (Math.abs(previousWidth - width) > .1) { this.mangaFooterMeasured = 0; this.prepareMangaLayout(); }
        }
      });
  }

  @Builder
  private mangaContent() {
    // The summary/tools track the directory scroll offset inside the body;
    // the fixed header and current-chapter dock are owned by the scaffold.
    Stack({ alignContent: Alignment.Top }) {
      ForEach([this.admittedIdentity], (identity: string) => {
        ReaderDirectoryNavigationSurface({
          sourceId: this.sourceId, bookId: this.bookId, query: this.searchQuery, ascending: this.ascending,
          currentChapterIndex: this.currentChapterIndex, openRevision: `${identity}:${this.rulesRevision}`,
          locateCurrentRevision: this.locateCurrentRevision,
          interacted: this.navigationInteracted, mangaDisplay: true,
          mangaInitialViewportWidth: this.viewportWidth > 0 ? this.viewportWidth : ReaderWindowCoordinator.metrics().windowRect.width,
          mangaVisibleTopInset: this.mangaVisibleTopInset(), mangaCatalogNarrow: this.mangaNarrow(),
          rowHeight: visual.gridHeight, listPaddingX: this.contentFrame().left,
          listPaddingRight: this.contentFrame().right,
          listPaddingY: visual.gridGap, listPaddingTop: this.mangaContentTopInset(),
          listPaddingBottom: this.mangaListBottomClearance(),
          contentEndInset: Math.max(0, this.mangaListBottomClearance() - 18),
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
          onScrollOffset: (offset: number): void => this.onMangaScrollOffset(offset),
          onClearSearch: (): void => { this.searchDraft = ''; this.applySearch(); },
                onTreeStateChange: (active: boolean): void => { this.navigationActive = active; this.listReady = false; },
        }).width('100%').height('100%');
      }, (identity: string): string => identity);
      this.mangaToolbar();
    }.width('100%').height('100%');
  }

  @Builder
  private mangaHeader() {
    PageBackBar({ title: '章节目录', floating: true, centered: true, variant: 'mangaDirectory',
      backIcon: this.appThemeScheme === 'night' ? $r('app.media.manga_directory_back_theme_night') : $r('app.media.manga_directory_back'), onBack: (): void => this.onBack(),
      trailing: (): void => { this.mangaDownloadMenuButton(); } });
  }

  @Builder
  private mangaFixedFooter() {
    if (!this.mangaFlowFooter()) { this.mangaCurrentFooter(); }
  }

  @Builder
  private mangaToolbar() {
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
      // Keep the sort control beside the compact query field. The detail
      // directory uses the shared ascending/descending asset pair.
      Row({ space: 5 }) {
        Row() {
          ReaderSearchField({ variant: 'readerDirectory', mode: 'live', text: this.searchDraft,
            placeholder: '搜索章名或序号', accessibilityLabel: '搜索章名或序号', clearable: true,
            onTextChange: (value: string): void => { this.searchDraft = value; this.applySearch(); },
            onSubmit: (): void => this.applySearch(),
          });
        }.layoutWeight(1).height(32);
        Stack() { Image(this.mangaSortIcon()).width(16).height(16); }
          .width(32).height(32).backgroundColor(mangaDirectoryColor('soft', this.appThemeScheme)).borderRadius(8)
          .accessibilityText('切换排序').onClick((): void => this.toggleSort());
      }.width('100%').height(32).padding({ left: 0, right: 0 });
      Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween, alignItems: ItemAlign.Center, space: { main: LengthMetrics.vp(visual.toolsGap), cross: LengthMetrics.vp(visual.toolsGap) } }) {
        Row({ space: visual.toolGap }) {
          Image(this.appThemeScheme === 'night' ? $r('app.media.manga_sheet_locate_theme_night') :
            $r('app.media.manga_sheet_locate')).width(visual.toolIcon).height(visual.toolIcon);
          Text('定位当前条目').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(400)
            .fontSize(visual.toolFontSize).lineHeight(visual.toolLineHeight).halfLeading(true).minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale())).fontColor(mangaDirectoryColor('accent', this.appThemeScheme));
        }.constraintSize({ minHeight: this.mangaToolHeight() }).enabled(this.currentChapterIndex >= 0).opacity(this.currentChapterIndex >= 0 ? 1 : .36)
          .attributeModifier(new MangaDirectoryPressFeedback(this.currentChapterIndex >= 0, true, this.appThemeScheme))
          .accessibilityText('定位当前条目').onClick((): void => this.locateCurrent());
      }.width('100%').margin({ top: visual.toolsTop, bottom: visual.toolsBottom });
      if (this.mangaFlowFooter()) {
        Row() { this.mangaCurrentFooter(); }.width('100%').margin({ top: this.mangaFooterBottomOffset() });
      }
    }.width(this.contentFrame().width).alignItems(HorizontalAlign.Start)
      .position({ x: this.contentFrame().left, y: this.topInset() + mangaDirectoryContentTop(this.mangaFontScale()) - this.mangaScrollOffset })
      .onAreaChange((_old: Area, area: Area): void => {
        const height = readerPageAreaLength(area.height);
        if (Number.isFinite(height) && height > 0 && Math.abs(height - this.mangaToolsHeight) > .1) this.mangaToolsHeight = height;
      });
  }

  @Builder
  private mangaCurrentFooter() {
    MangaDirectoryCurrentFooter({ title: this.mangaCurrentTitle(), pagePosition: this.mangaCurrentPosition(), scheme: this.appThemeScheme,
      availableWidth: this.contentFrame().width,
      onHeightChanged: (height: number): void => { if (Math.abs(height - this.mangaFooterMeasured) > .1) this.mangaFooterMeasured = height; },
    }).width('100%');
  }

  private mangaSortIcon(): Resource {
    if (this.appThemeScheme === 'night') return this.ascending ?
      $r('app.media.reader_directory_sort_ascending_theme_night') : $r('app.media.reader_directory_sort_descending_theme_night');
    return this.ascending ? $r('app.media.reader_directory_sort_ascending') : $r('app.media.reader_directory_sort_descending');
  }

  private mangaNarrow(): boolean {
    const width = this.viewportWidth > 0 ? this.viewportWidth : ReaderWindowCoordinator.metrics().windowRect.width;
    return width > 0 && width <= visual.narrowWidth;
  }

  private mangaVisibleTopInset(): number {
    return this.topInset() + visual.headerSafeGap + mangaDirectoryHeaderHeight(this.mangaFontScale());
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
    // The native paged Grid and fallback List share the measured chrome
    // clearance, including title wrapping and system font scaling.
    return this.topInset() + mangaDirectoryContentTop(this.mangaFontScale()) + this.mangaToolsHeight;
  }

  private onMangaScrollOffset(offset: number): void {
    if (Number.isFinite(offset) && Math.abs(offset - this.mangaScrollOffset) > .1) this.mangaScrollOffset = offset;
  }

  private mangaFontScale(): number {
    const revision = this.readerWindowMetricsRevision;
    return mangaDirectoryScale(revision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale);
  }

  private mangaToolHeight(): number { return mangaDirectoryLineBox(visual.toolHeight, visual.toolLineHeight, visual.toolPaddingY * 2, this.mangaFontScale()); }
  private mangaFooterHeight(): number { return this.mangaFooterMeasured > 0 ? this.mangaFooterMeasured : mangaDirectoryFooterHeight(this.mangaFontScale(), this.contentFrame().width, this.mangaCurrentPosition()); }
  private mangaBottomInset(): number { return Math.max(0, readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics())); }
  /** The footer follows the safe area closely; the released 4vp is usable list space. */
  private mangaFooterBottomOffset(): number { return Math.max(0, visual.footerBottom - 4); }
  private mangaBottomClearance(): number { return this.mangaBottomInset() + (this.mangaFlowFooter() ? 0 : this.mangaFooterHeight()) + this.mangaFooterBottomOffset() * 2; }
  /** The fixed dock is already outside the clipped viewport. Catalog Grid owns
   * an 18vp tail; flowing chrome still needs its existing bottom safe clearance. */
  private mangaListBottomClearance(): number { return this.mangaFlowFooter() ? this.mangaBottomClearance() : 18; }

  private headerFrame(): SurfaceHorizontalFrame {
    const frame = this.contentFrame();
    const expansion = visual.contentPaddingX - visual.headerInsetX;
    return new SurfaceHorizontalFrame(Math.max(0, frame.left - expansion), Math.max(0, frame.right - expansion), frame.width + expansion * 2);
  }

  private onMangaMetricsChanged(): void {
    this.mangaFooterMeasured = 0;
    if (this.mounted && this.contentKind === 'manga') this.prepareMangaLayout();
  }

  private onMangaPositionChanged(): void { this.mangaFooterMeasured = 0; }

  private onMangaKindChanged(): void {
    this.mangaFontsReady = false;
    this.mangaFooterMeasured = 0;
    this.mangaScrollOffset = 0;
    if (this.mounted && this.contentKind === 'manga') this.prepareMangaPageFonts();
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
      listPaddingX: this.contentFrame().left, listPaddingY: 8,
      listPaddingRight: this.contentFrame().right,
      listPaddingTop: this.mangaContentTopInset(), listPaddingBottom: this.mangaListBottomClearance(),
      edgeEffectMode: EdgeEffect.Spring, scroller: this.listScroller,
      onFirstLayout: (): void => this.onListFirstLayout(identity),
      onScrollOffset: (offset: number): void => this.onMangaScrollOffset(offset + this.mangaContentTopInset()),
      onUserScrollIntent: (): void => this.onListUserScroll(),
      rowBuilder: (item: RepeatItem<LocalReadingTocEntry>) => { this.mangaFlatRow(item.item, identity); },
      emptyBuilder: (): void => { this.mangaEmptyState(); },
    }).width('100%').height('100%');
  }

  @Builder
  private mangaEmptyState() {
    Column({ space: visual.quietEmptyGap }) {
      Text(this.emptyMessage()).fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
        .fontSize(visual.quietEmptyFontSize).lineHeight(visual.quietEmptyLineHeight).halfLeading(true)
        .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
        .fontColor(mangaDirectoryColor('muted', this.appThemeScheme)).textAlign(TextAlign.Center);
      if (this.searchQuery.trim().length > 0) {
        Text('清除搜索').fontFamily(READER_FONT_NOTO_SANS_SC_UI_REGULAR).fontWeight(visual.bodyFontWeight)
          .fontSize(visual.quietEmptyFontSize).lineHeight(visual.quietEmptyLineHeight).halfLeading(true)
          .minFontScale(Math.min(1, this.mangaFontScale())).maxFontScale(Math.max(1, this.mangaFontScale()))
          .fontColor(mangaDirectoryColor('accent', this.appThemeScheme)).constraintSize({ minHeight: visual.quietEmptyClearHeight })
          .attributeModifier(new MangaDirectoryPressFeedback(true, true, this.appThemeScheme))
          .onClick((): void => { this.searchDraft = ''; this.applySearch(); });
      }
    }.width('100%').constraintSize({ minHeight: visual.quietEmptyMinHeight })
      .padding({ left: visual.quietEmptyPaddingX, right: visual.quietEmptyPaddingX,
        top: visual.quietEmptyPaddingY, bottom: visual.quietEmptyPaddingY }).justifyContent(FlexAlign.Center)
      .border({ width: { top: visual.borderWidth }, color: mangaDirectoryColor('line', this.appThemeScheme) });
  }

  @Builder
  private mangaFlatRow(entry: LocalReadingTocEntry, identity: string) {
    MangaDirectoryEntryRow({ row: this.mangaLayoutRow(entry), presentation: this.mangaPresentation,
      scheme: this.appThemeScheme, currentChapterIndex: this.currentChapterIndex,
      collapsedBranches: this.mangaCollapsedGroups, query: this.searchQuery,
      chapterDownloadEnabled: this.mangaDownloadEnabled,
      onSelectEntry: (selected: LocalReadingTocEntry): void => this.selectMangaEntry(selected, identity),
      onToggleBranch: (selected: LocalReadingTocEntry): void => this.toggleMangaBranch(selected, identity),
      onDownloadEntry: (selected: LocalReadingTocEntry): void => {
        if (this.rowIsCurrent(selected, identity) && this.mangaEntryIsDisplayed(selected) && selected.downloadState !== 'unknown')
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
      this.mangaNarrow(), this.mangaFontScale(), this.contentFrame().width, this.mangaDownloadEnabled ? visual.downloadGridWidth : 0);
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

  @Builder
  private mangaDownloadMenuButton() {
    if (this.mangaDownloadEnabled) {
      ForEach([this.identity()], (identity: string): void => {
        ReaderMangaDownloadPopup({ specId: 'manga-download', visible: this.downloadMenuVisible, generation: this.downloadMenuGeneration,
          availableWidth: this.contentFrame().width, actions: this.downloadActions, loading: this.downloadActionsLoading,
          failureMessage: this.downloadActionsFailure,
          onOpen: (): void => { if (this.mounted && identity === this.identity()) void this.openDownloadActions(); },
          onClosed: (generation: number): void => {
            if (this.mounted && identity === this.identity() && generation === this.downloadMenuGeneration) this.downloadMenuVisible = false;
          },
          onAction: (action: MangaDownloadActionId, generation: number): void => {
            if (this.mounted && identity === this.identity() && generation === this.downloadMenuGeneration) this.performDownloadAction(action);
          },
          onRetry: (generation: number): void => {
            if (this.mounted && identity === this.identity() && generation === this.downloadMenuGeneration) void this.openDownloadActions(this.downloadMenuChapterIndex);
          } });
      }, (identity: string): string => identity);
    }
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
      const index = this.mangaLayoutRows.findIndex((row: MangaDirectoryLayoutRow): boolean =>
        row.entries.some((entry: LocalReadingTocEntry): boolean => entry.index === this.currentChapterIndex));
      if (index >= 0 && this.listReady) this.scrollMangaCurrent(index);
    }, 0);
  }

  @Builder
  private flatList(identity: string) {
    ReaderDirectoryList({
      entries: this.projectedEntries,
      rowHeight: 40,
      listPaddingX: 10,
      listPaddingY: 0,
      contentStartInset: this.standardHeaderHeight + 5,
      contentEndInset: this.bottomInset() + 5,
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
      chapterDownloadEnabled: this.sourceId !== 'local' && this.directoryRecovery.offlineBlocked !== true,
      chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
      onSelectChapter: (index: number): void => {
        if (this.rowIsCurrent(item.item, identity) && index === item.item.index) this.onSelectChapter(index);
      },
      onDownloadChapter: (index: number): void => {
        if (this.rowIsCurrent(item.item, identity) && index === item.item.index && this.directoryRecovery.offlineBlocked !== true) this.onDownloadChapter(index);
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
      return before !== undefined && after !== undefined && this.mangaPresentation.get(after.index)?.hasChildren === true && sameReaderDirectoryData([before], [after]);
    }) : [];
    this.publishProjection(projectReaderDirectoryEntries(this.admittedEntries,
      reset ? '' : this.searchQuery, reset ? true : this.ascending));
    if (reset || wasEmpty) {
      this.scheduleTopScroll();
      this.pendingMangaCurrentScroll = this.contentKind === 'manga' && this.currentChapterIndex >= 0;
    }
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
    if (this.contentKind === 'manga') this.prepareMangaLayout();
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

  private catalogRetryVisible(): boolean {
    if (this.searchQuery.length > 0 || this.navigationActive) return false;
    const message = this.catalogMessage.trim();
    // Do not expose a retry action while the owner is still acquiring the
    // first catalog. Empty/error projections remain actionable in place.
    return !/^正在|^加载|^读取/.test(message);
  }

  private contentFrame(): SurfaceHorizontalFrame {
    const metrics = ReaderWindowCoordinator.metrics();
    const width = this.viewportWidth > 0 ? this.viewportWidth :
      (this.readerWindowMetricsRevision < 0 ? 0 : metrics.windowRect.width);
    return resolveHorizontalFrame(width, readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics),
      new SurfaceWidthSpec(this.contentKind === 'manga' ? visual.contentWidthMax : TOK_CONTENT_MAX_W_TABLET, 20, 20, 'center'));
  }

  private bottomInset(): number {
    if (this.readerWindowMetricsRevision < 0) return 12;
    return Math.max(12, readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics()));
  }
}
