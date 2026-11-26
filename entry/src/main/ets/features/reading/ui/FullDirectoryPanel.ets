import { ReaderDirectoryDataPublication } from '../presentation/ReaderDirectoryDataSnapshot';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from '../../../ui/layout/ReaderEditingScrollBinding';
import { DIRECTORY_TOOL_SIZE, readerFullDirectoryHeights, readerDirectoryToolbarBudget, type ReaderFullDirectoryHeights } from '../presentation/ReaderFullDirectoryBudget';
import { readerReadableFontScale, readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import { readerCompactSearchHeight } from '../../../ui/foundation/ReaderSearchControlGeometry';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import type { ReaderDirectoryNavigationPortFactory } from '../application/ReaderDirectoryNavigation';
import type { ReaderDirectoryTargetProof } from '../application/ReaderDirectoryTargetProof';
import { mangaDirectoryContextEntries } from '../../manga/ui/MangaDirectoryState';
import { mangaDirectoryPresentation } from '../../manga/presentation/MangaDirectoryPresentation';
import { TYPE_READER_DIRECTORY_CURRENT_CAPTION, TYPE_READER_DIRECTORY_COLLAPSE, TYPE_READER_DIRECTORY_CURRENT_TITLE, TYPE_READER_DIRECTORY_HEADING, TYPE_READER_DIRECTORY_POSITION_INTER, TYPE_READER_DIRECTORY_TAB, TYPE_SEARCH_DIRECTORY_INPUT } from '../../../ui/foundation/ReaderTypography';
import { readerDirectoryScopeKey } from '../application/ReaderDirectoryNavigation';
import type { RemoteReadingPositionScope } from '../application/RemoteReadingPositionMigration';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { sameReaderDirectoryData, snapshotReaderDirectoryData } from '../presentation/ReaderDirectoryDataSnapshot';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../presentation/ReaderDirectoryMarkerState';
import {
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
} from '../../../ui/foundation/ReaderTokens';

import { registerReaderFonts, readerFontFamilyReady } from '../../../ui/foundation/ReaderFonts';
import { measureReaderControlText } from './ReaderControlTextMeasurement';
import { ReaderDirectoryToolbar } from './ReaderDirectoryToolbar';
import { ReaderDirectoryQuickActions, readerDirectoryQuickActionsHeight } from './ReaderDirectoryQuickActions';
import { ReaderActionAccessibility, readerActionTouchRegion } from '../../../ui/controls/ReaderActionAccessibility';
import { ReaderPressFeedback } from '../../../ui/foundation/ReaderPressFeedback';
import { ReaderPostLayoutFrame } from '../../../ui/layout/ReaderPostLayoutFrame';
import { ReaderPanelFrame } from '../../../ui/surfaces/ReaderPanelFrame';
import { ReaderPageState } from '../../../ui/feedback/ReaderPageState';
import { projectReaderDirectoryEntries } from '../presentation/ReaderDirectoryProjection';
import {
  projectReaderBookmarkRows,
  readerBookmarkEmptyCopy,
  readerBookmarkLoadState,
  type ReaderBookIdentity,
  type ReaderBookmarkRowModel,
} from '../presentation/ReaderBookmarkProjection';
import { ReaderDirectoryList } from './ReaderDirectoryList';
import { ReaderDirectoryChapterRow } from './ReaderDirectoryChapterRow';
import { ReaderDirectoryNavigationSurface } from './ReaderDirectoryNavigationSurface';
import { readerDirectorySignalScrollCommand, readerDirectorySignalScrollIntent } from '../presentation/ReaderDirectoryViewport';
import { ReaderBookmarkList } from './ReaderBookmarkList';
import { ReaderBookmarkEmptyState } from './ReaderBookmarkEmptyState';
import { ReaderBookmarkLoadingState } from './ReaderBookmarkLoadingState';
import { ReaderBookmarkErrorState } from './ReaderBookmarkErrorState';
import { BOOKMARK_ROW_HEIGHT, measureReaderStandaloneBookmark, type ReaderStandaloneBookmarkSize } from './ReaderBookmarkRow';
import { sampleReaderControlBookmark } from './ReaderControlBookmarkGeometry';
import {
  beginReaderControlListOpen,
  commitReaderControlListPosition,
  createReaderControlListPositioning,
  endReaderControlListOpen,
  markReaderControlListUserScrolled,
  prepareReaderControlListPosition,
  readerControlDirectoryTargetRow,
  readerControlListPositionIsCurrent,
  readerControlNearestBookmarkRow,
  readerControlUniformListViewport,
  type ReaderControlBookmarkPosition,
  type ReaderControlDirectoryPosition,
  type ReaderControlListPositioningState,
} from './ReaderControlListPositioning';

/**
 * Source-backed presentation layer for the expanded reader directory panel:
 * - Phone: Figma `943:11617`, Section `I943:11617;927:66`, at x=12, y=88, 364px wide.
 * - Tablet: Figma `943:11949`, Section `I943:11949;929:62`, at x=26, y=88, 720px wide.
 *
 * The panel deliberately consumes already materialized page state only. It
 * does not call Core, select chapters, commit reading progress, or infer
 * downloaded/bookmark facts that are not part of `LocalReadingTocEntry`.
 *
 * Icons derive from the current Phone instance `I1995:60568;927:*`. Sort
 * directions intentionally remain two explicit SVG resources instead of a
 * runtime rotation, so each visual state has its own source asset.
 */
@Component
export struct FullDirectoryPanel {
  private readonly directoryPublication: ReaderDirectoryDataPublication = new ReaderDirectoryDataPublication();
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();
  private readonly editingScroller: Scroller = new Scroller();
  private standaloneAvailableHeight(): number {
    if (this.detailPage) return this.panelHeight();
    return Math.max(0, this.standaloneShort() ? this.panelHeight() - 12 : this.contentHeight());
  }
  private standaloneEditorNaturalHeight(): number {
    const headerHeight = this.detailPage ? 0 : this.panelHeaderHeight() + TOK_SPACE_XS;
    return headerHeight + this.tabStripHeight() + this.searchControlsHeight() + 2;
  }
  private standaloneEditorHeight(): number {
    const minimumRowHeight = this.detailPage && this.activeTab === 'bookmarks' ? this.listRowHeight('bookmarks') : this.directoryRowHeight();
    const available = this.standaloneAvailableHeight();
    if (!this.standaloneShort()) return Math.min(available, this.standaloneEditorNaturalHeight());
    const flowFooter = this.flowCatalogFooter();
    const editorMinimum = Math.min(44, flowFooter ? available / 2 : available);
    const listMinimum = flowFooter ? Math.min(available / 2, minimumRowHeight) : minimumRowHeight;
    return Math.min(this.standaloneEditorNaturalHeight(), Math.max(editorMinimum, available - listMinimum));
  }
  @StorageLink('readerWindowMetricsRevision') @Watch('onMotionProgressChanged') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  private toolbarInputWidthKey: string = '';
  private toolbarInputWidthCached: number = 0;

  @Prop @Watch('onEntriesChanged') entries: LocalReadingTocEntry[] = [];
  navigationPortFactory: ReaderDirectoryNavigationPortFactory | undefined = undefined;
  @Prop catalogMessage: string = '';
  @Prop catalogBusy: boolean = false;
  onRetryCatalog: () => void = (): void => {};
  @Prop @Watch('onReadingAnchorChanged') currentChapterIndex: number = -1;
  // Detail catalogs can be browsed before a reading position exists. The
  // embedded reader still waits for its admitted current chapter.
  @Prop prepareLocalTxt: boolean = false;
  @Prop allowUnanchoredBrowse: boolean = false;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop mangaSearch: boolean = false;
  @Prop @Watch('onStandaloneLayoutChanged') expandedLayout: boolean = false;
  // The owner supplies the measured viewport-constrained width. Zero keeps
  // the source-exact standalone Figma endpoint.
  @Prop @Watch('onStandaloneLayoutChanged') panelWidthOverride: number = 0;
  // ReaderShell lays out below the status bar. Phone full-sheet geometry is
  // therefore capped by the real host viewport while retaining the Figma
  // 20vp bottom anchor; zero keeps the source-exact standalone endpoint.
  @Prop @Watch('onStandaloneLayoutChanged') panelHeightOverride: number = -1;
  // Optional endpoint bounds from ReaderControlPanel. The live panel
  // overrides above are sampled per visual frame; these values let a virtual
  // List keep one stable native viewport while the outer clip follows p.
  // Zero falls back to deriving the linear endpoints from the current frame.
  @Prop controlQuickContentWidth: number = 0;
  @Prop controlFullContentWidth: number = 0;
  @Prop controlQuickContentHeight: number = 0;
  @Prop controlFullContentHeight: number = 0;
  // Stable endpoint bounds for the embedded List. The outer control content
  // still receives the frame-varying override; these values keep AceList's
  // internal viewport/extent independent from motion progress.
  @Prop quickListWidth: number = 286;
  @Prop fullListWidth: number = 338;
  @Prop quickListHeight: number = 141;
  @Prop fullListHeight: number = 518;
  // The reading control owns the outer sheet, handle and Full header. This
  // mode only renders one persistent directory/bookmark content instance.
  @Prop embeddedInControl: boolean = false;
  @Prop standaloneCatalog: boolean = false;
  @Prop @Watch('onStandaloneLayoutChanged') detailPage: boolean = false;
  @Prop @Watch('onMotionProgressChanged') motionProgress: number = 1;
  @Prop initialTab: string = 'directory';
  // The control keeps this panel mounted across quick/full transitions. A
  // new key therefore means a genuinely new open session (and is the only
  // safe point to re-center the virtual list). Watching it avoids stale
  // chapter/bookmark positions after the panel is reopened without
  // remounting the native List.
  @Prop @Watch('onListSessionKeyChanged') listSessionKey: string = '';
  @Prop directoryRulesRevision: number = 0;
  @Prop chapterActionsEnabled: boolean = true;
  inputCurrent: (() => boolean) | undefined = undefined;
  onTabChange: (tab: string) => void = (_tab: string): void => {};
  onGeometryProbe: (event: string) => void = (_event: string): void => {};
  @Prop geometryProbeEnabled: boolean = false;
  @State private activeTab: string = 'directory';
  @State private searchDraft: string = '';
  @State private searchQuery: string = '';
  @State private ascending: boolean = true;
  @State private projectedEntries: LocalReadingTocEntry[] = [];
  @State private navigationInteracted: boolean = false;
  @State private navigationActive: boolean = false;
  @State private locateCurrentRevision: number = 0;
  @State private projectedBookmarks: ReaderBookmarkRowModel[] = [];
  @State private bookmarkTabLoading: boolean = false;
  // Optional stable book identity supplied by the owner. Undefined keeps the
  // session-scoped bookmark ids until the host wires full identity hand-off.
  bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  // Exact-offset bookmark selection. Undefined until the owner wires it; the
  // row tap then degrades to opening the chapter start (legacy behavior).
  onSelectBookmark: ((bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope) => void) | undefined =
    undefined;
  // Error is owner-driven: the data contract has no bookmark error channel.
  @Prop bookmarkLoadFailed: boolean = false;
  @Prop bookmarkLoadMessage: string = '';
  onRetryBookmarkLoad: () => void = (): void => {};
  @State private initialListPositionReady: boolean = false;
  private readonly listScroller: Scroller = new Scroller();
  // Projection changes update the keyed virtual List in place. Defer the
  // matching top scroll until the current native layout is usable, and let a
  // newer projection invalidate an older queued scroll during rapid sort taps.
  private projectionScrollGeneration: number = 0;
  private listPositioning: ReaderControlListPositioningState = createReaderControlListPositioning();
  private positioningTab: string = 'directory';
  private awaitingReadingAnchor: boolean = false;
  private listViewportHeight: number = 0;
  private positioningMounted: boolean = false;
  private lastListSessionKey: string = '';
  // Entries can be refreshed by the host while the shared p clock is between
  // endpoints. Deferring that projection prevents Repeat/List extent rebuilds
  // from competing with the compositor's active morph.
  private motionActive: boolean = false;
  private pendingEntries: LocalReadingTocEntry[] | undefined = undefined;
  // ArkUI invokes @Watch callbacks while it is reconciling the current tree.
  // Keep all cross-component mutations in one next-turn transaction so a
  // retained native List is never emptied/remounted from inside that render.
  private deferredMotionProgress: number | undefined = undefined;
  private deferredSessionKey: string | undefined = undefined;
  private deferredReadingAnchor: boolean = false;
  private deferredMutationGeneration: number = 0;
  private deferredLifecycleGeneration: number = 0;
  private deferredFlushScheduled: boolean = false;
  private deferredFlushLifecycleGeneration: number = -1;
  private leadingRowAnchor: number | undefined = undefined;
  private previousRowHeight: number = 40;
  private standaloneLayoutKey: string = '';
  private standaloneLayoutPrefix: number = 0;
  private standaloneLayoutRowHeight: number = 74;
  private standaloneRestoreAnchor: number | undefined = undefined;
  private standaloneRestoreGeneration: number = 0;
  // AceList rebuilds its extent whenever ChildrenMainSize changes. Keep the
  // real directory rows at the transition's source endpoint while p is
  // between 0 and 1; switch once at the settled endpoint and correct the
  // leading-row anchor there. The viewport/sheet still morphs continuously.
  private motionStableDirectoryRowHeight: number = 44;
  private motionStableDirectoryViewportHeight: number = 141;
  private motionStableDirectoryPaddingX: number = 16;
  // Bookmarks follow the same virtual-list rule. The card actors keep their
  // live motion sample, while native List geometry is held at one endpoint
  // until the transition settles. Endpoint values are computed from the
  // current control frame (or future parent-provided bounds), never from a
  // phone-only constant.
  private motionStableBookmarkRowHeight: number = BOOKMARK_ROW_HEIGHT;
  private motionStableBookmarkViewportWidth: number = 0;
  private motionStableBookmarkViewportHeight: number = 0;
  private motionStableBookmarkPaddingX: number = 10;
  private bookmarkMotionDirection: number = 0;
  private previousMotionProgress: number = 0;
  private motionDirectionIncreasing: boolean = true;
  private motionLayoutRevision: number = 0;
  private projectionRestoreOffset: number | undefined = undefined;
  @State private admittedEntries: LocalReadingTocEntry[] = [];
  // R-LOCAL-TOC-01: allow the owning flow to react to a chapter tap so the
  // full-directory can be wired back into the actual reading flow.
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onSelectNavigationTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof) => void =
    (_chapterIndex: number, _chapterOffsetScalar: number, _positionScope?: RemoteReadingPositionScope, _directoryTargetProof?: ReaderDirectoryTargetProof): void => {};
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  onOpenCacheManagement: () => void = (): void => {};
  // The marker is chapter-level while Core identities are bookmark-level.
  // Forward every existing identity represented by the marker so the owner
  // can perform explicit deletes and reload the projection without guessing.
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  // Creation stays disabled until an owner supplies the full book identity
  // required by bookmark.create and reloads the Core-backed projection.
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop bookmarkActionsEnabled: boolean = true;
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  // R-LOCAL-TOC-01: the owner resolves the correct return target. This panel
  // only emits the explicit collapse intent.
  onExit: () => void = (): void => {};

  aboutToAppear(): void {
    this.navigationInteracted = false;
    this.navigationActive = false;
    // Invalidate callbacks left by a previous retained instance before
    // admitting the new session's source snapshot.
    this.deferredLifecycleGeneration += 1;
    this.deferredFlushScheduled = false;
    this.deferredFlushLifecycleGeneration = -1;
    this.deferredMotionProgress = undefined;
    this.deferredSessionKey = undefined;
    this.deferredReadingAnchor = false;
    this.pendingEntries = undefined;
    this.admittedEntries = snapshotReaderDirectoryData(this.entries);
    registerReaderFonts(this.getUIContext().getFont());
    this.positioningMounted = true;
    this.lastListSessionKey = this.listSessionKey;
    this.motionActive = this.controlProgress() > 0 && this.controlProgress() < 1;
    const tab = this.initialTab === 'bookmarks' ? 'bookmarks' : 'directory';
    this.activeTab = tab;
    this.motionStableDirectoryRowHeight = this.directoryRowHeight();
    this.motionStableDirectoryViewportHeight = this.directoryViewportHeightAt(this.controlProgress());
    this.motionStableDirectoryPaddingX = this.directoryPaddingXAt(this.controlProgress());
    this.motionStableBookmarkRowHeight = this.bookmarkVisualRowHeight(this.controlProgress());
    this.motionStableBookmarkViewportWidth = this.bookmarkViewportWidthAt(this.controlProgress());
    this.motionStableBookmarkViewportHeight = this.bookmarkViewportHeightAt(this.controlProgress());
    this.motionStableBookmarkPaddingX = this.bookmarkPaddingXAt(this.controlProgress());
    this.bookmarkMotionDirection = 0;
    this.previousMotionProgress = this.controlProgress();
    this.rebuildProjection(tab, this.ascending, this.searchQuery);
    this.beginListPositioning(tab);
  }

  aboutToDisappear(): void {
    this.deferredLifecycleGeneration += 1;
    this.deferredMutationGeneration += 1;
    this.deferredFlushScheduled = false;
    this.deferredFlushLifecycleGeneration = -1;
    this.deferredMotionProgress = undefined;
    this.deferredSessionKey = undefined;
    this.deferredReadingAnchor = false;
    this.pendingEntries = undefined;
    this.projectionScrollGeneration += 1;
    this.positioningMounted = false;
    this.listPositioning = endReaderControlListOpen(this.listPositioning);
  }

  build() {
    if (this.embeddedInControl) {
      this.embeddedBody();
    } else if (this.detailPage) {
      this.standaloneBody();
    } else {
      this.standalonePanel();
    }
  }

  @Builder
  private standalonePanel() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('').width(42).height(4).backgroundColor(readerAppColor('TOK_READ_HANDLE', this.appThemeScheme))
        .borderRadius(2).margin({ left: this.gripLeft(), top: 9 });
      Stack().width(this.innerWidth()).height(this.standaloneShort() ? this.standaloneAvailableHeight() : this.bodyContentHeight())
        .position({ x: 13, y: this.standaloneShort() ? 6 : 6 + this.panelHeaderHeight() + TOK_SPACE_XS })
        .attributeModifier(new ReaderPanelFrame('reader-full-card', this.appThemeScheme)).hitTestBehavior(HitTestMode.None);
      this.standaloneBody();
    }.width(this.panelWidth()).height(this.panelHeight())
      .attributeModifier(new ReaderPanelFrame('reader', this.appThemeScheme)).clip(true);
  }

  @Builder
  private standaloneBody() {
    Column({ space: 0 }) {
      Scroll(this.editingScroller) {
        Column({ space: 0 }) {
          if (!this.detailPage) {
            this.panelHeader();
            Blank().height(TOK_SPACE_XS);
          }
          this.tabs(); this.searchControls();
        }.width(this.innerWidth()).height(this.standaloneEditorNaturalHeight());
      }.width(this.innerWidth()).height(this.standaloneEditorHeight()).clip(true).scrollBar(BarState.Off)
        .id(this.editingScroll.id)
        .onAppear((): void => this.editingScroll.mount(this.getUIContext(), this.editingHost, this.editingScroller))
        .onDisAppear((): void => this.editingScroll.unmount())
        .onAreaChange((): void => this.editingHost.refresh());
      if (this.activeTab === 'bookmarks') this.bookmarkBody();
      else {
        Stack() {
          this.chapterList();
          if (this.projectedEntries.length === 0 && !this.navigationActive && !this.flowCatalogFooter()) this.standaloneCatalogState();
        }.width(this.innerWidth()).height(this.chapterListHeight());
        if (!this.standaloneShort()) {
          if (this.standaloneCatalog) this.catalogFooter();
          else this.statusFooter();
        }
      }
    }.width(this.innerWidth()).height(this.standaloneAvailableHeight())
      .margin({ left: this.detailPage ? 0 : 13, top: this.detailPage ? 0 : 6 });
  }

  private standaloneShort(): boolean {
    if (this.embeddedInControl) return false;
    if (this.detailPage) {
      const needed = this.activeTab === 'bookmarks' ? this.listRowHeight('bookmarks') : this.directoryRowHeight() + this.standaloneFooterHeight();
      return this.panelHeight() - this.standaloneEditorNaturalHeight() < needed;
    }
    const heights = this.heights();
    return this.activeTab === 'bookmarks' ? heights.bookmarkList < this.listRowHeight('bookmarks') :
      heights.chapterList < this.directoryRowHeight();
  }

  private standalonePrefixHeight(): number {
    return 0;
  }

  private standaloneFooterHeight(): number {
    if (this.standaloneCatalog) return readerDirectoryQuickActionsHeight(this.fontScale(), this.currentPosition() !== '—');
    return readerScaledControlHeight(48, 16, this.fontScale());
  }

  private flowCatalogFooter(): boolean { return this.standaloneCatalog && this.standaloneShort(); }

  @Builder
  private standalonePrefix() { Column() {}.width('100%').height(0); }

  @Builder
  private standaloneCatalogState() {
    ReaderPageState({ loading: this.catalogBusy && this.entries.length === 0,
      message: this.catalogBusy && this.entries.length === 0 ? '正在加载目录' : this.catalogEmptyMessage(),
      actionLabel: this.catalogClearSearchVisible() ? '清除搜索' : this.catalogRetryVisible() ? '重试加载目录' : '',
      mutedColor: readerAppColor('TOK_READ_MUTED', this.appThemeScheme),
      onAction: (): void => {
        if (!this.panelInputCurrent()) return;
        if (this.catalogClearSearchVisible()) this.clearCatalogSearch();
        else if (this.catalogRetryVisible()) this.onRetryCatalog();
      } });
  }



  /**
   * Restored directory node 1689:1616 supplies these local actor endpoints.
   * The user's M-01 adjustment maps every actor to the same spatial progress,
   * not the source timeline's independent automatic easing. The outer viewport
   * translation (-28 -> 0) belongs to ReaderControlPanel, never this body too.
   */
  @Builder
  private embeddedBody() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        this.directoryTab();
      }
      .width(this.embeddedTabWidth())
      .height(this.tabHeight())
      .position({ x: this.controlValue(this.activeTab === 'bookmarks' ? 15 : 16, 9),
        y: this.controlValue(this.activeTab === 'bookmarks' ? 12 : 13, 6) });
      Stack({ alignContent: Alignment.TopStart }) {
        this.bookmarkTab();
      }
      .width(this.embeddedTabWidth())
      .height(this.tabHeight())
      .position({ x: this.controlValue(this.activeTab === 'bookmarks' ? 142 : 143, 169),
        y: this.controlValue(this.activeTab === 'bookmarks' ? 12 : 13, 6) });
      Text('')
        .width(this.activeTab === 'bookmarks' ? this.panelWidth() + 52 * (1 - this.controlProgress()) - 2 :
          Math.max(0, this.panelWidth() - this.controlValue(22, 2)))
        .height(1)
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .position({ x: this.activeTab === 'bookmarks' ? 1 : this.controlValue(11, 1),
          y: this.activeTab === 'bookmarks' ? this.controlValue(50, 42) : this.controlValue(44, 42) })
        .opacity(this.activeTab === 'bookmarks' ? this.controlProgress() : 1);
      Stack({ alignContent: Alignment.TopStart }) {
        this.searchControls();
        // Figma 1689:2137 is a CHILD of Toolbar 1689:2125. Its local
        // bottom edge, 12->0 translation and opacity inherit the parent's
        // 18->0 translation/opacity; do not flatten these two actor tracks.
        Text('')
          .width(Math.max(0, this.panelWidth() - 2))
          .height(1)
          .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
          .position({ x: 0, y: this.controlValue(63, this.searchControlsHeight() - 1) })
          .opacity(this.controlProgress());
      }
      .width(Math.max(0, this.panelWidth() - 2))
      .height(this.searchControlsHeight())
      .position({ x: 1, y: this.controlValue(61, 43) })
      .opacity(this.controlProgress())
      .enabled(this.controlProgress() > 0)
      .hitTestBehavior(this.controlProgress() > 0 ? HitTestMode.Default : HitTestMode.None)
      .accessibilityLevel(this.controlProgress() === 0 ? 'no-hide-descendants' : 'auto');
      if (this.activeTab === 'bookmarks') {
        Stack({ alignContent: Alignment.TopStart }) {
          this.bookmarkBody();
        }
        .width(Math.max(0, this.panelWidth() - 2))
        .height(this.bookmarkListHeight())
        .position({ x: 1, y: this.controlValue(47, 99) + this.embeddedToolbarGrowth() });
      } else {
        Stack() {
          // The directory rows are persistent Figma actors. Keep one native
          // List identity through Quick/Full, reopen, search and sort; keyed
          // Repeat updates its rows without throwing away the compositor
          // buffer or briefly replacing a populated projection with an empty
          // one.
          this.chapterList();
        }
        .width(Math.max(0, this.panelWidth() - 2))
        .height(this.chapterListHeight())
        .position({ x: 1, y: this.controlValue(48, 99) + this.embeddedToolbarGrowth() });
        Stack() {
          this.statusFooter();
        }
        .width(Math.max(0, this.panelWidth() - 2))
        .height(48)
        .position({ x: 1, y: this.panelHeight() - 49 + this.controlValue(24, 0) })
        .opacity(this.controlProgress())
        .enabled(this.controlProgress() === 1)
        .hitTestBehavior(HitTestMode.None)
        .accessibilityLevel(this.controlProgress() === 0 ? 'no-hide-descendants' : 'auto');
      }
    }
    .width(this.panelWidth())
    .height(this.panelHeight())
    .clip(true);
  }

  @Builder
  private panelHeader() {
    Row() {
      Row({ space: TOK_SPACE_XS }) {
        if (this.activeTab === 'bookmarks') {
          Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark')))
            .width(16)
            .height(16);
        } else {
          Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_directory_theme_night') : $r('app.media.reader_directory_directory')))
            .width(16)
            .height(16);
        }
        Text(this.activeTab === 'bookmarks' ? '书签' : '目录')
          .fontFamily(TYPE_READER_DIRECTORY_HEADING.fontFamily)
          .fontWeight(TYPE_READER_DIRECTORY_HEADING.fontWeight)
          .fontSize(TYPE_READER_DIRECTORY_HEADING.fontSizeFp)
          .lineHeight(TYPE_READER_DIRECTORY_HEADING.lineHeightFp as number).halfLeading(true)
          .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme));
      }
      .layoutWeight(1)
      .height(this.panelHeaderHeight())
      .alignItems(VerticalAlign.Center);

      if (this.expandedLayout) {
        Stack({ alignContent: Alignment.Center }) {
          this.collapseLabel();
        }
        .constraintSize({ minWidth: 44 }).height(this.collapseHeight()).flexShrink(0)
        .padding({ left: 10, right: 10, top: 0, bottom: 0 })
        .responseRegion(readerActionTouchRegion('100%', this.collapseHeight()))
        .attributeModifier(new ReaderActionAccessibility('收起目录', this.panelInputCurrent(), false, true,
          new ReaderPressFeedback(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme),
            this.appThemeScheme, 8, 8, this.panelInputCurrent())))
        .onClick((): void => { if (this.panelInputCurrent()) this.onExit(); });
      } else {
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          this.collapseLabel();
        }
        .constraintSize({ minWidth: 44 }).height(this.collapseHeight()).flexShrink(0)
        .padding({ left: 10, right: 10, top: 0, bottom: 0 })
        .responseRegion(readerActionTouchRegion('100%', this.collapseHeight()))
        .attributeModifier(new ReaderActionAccessibility('收起目录', this.panelInputCurrent(), false, true,
          new ReaderPressFeedback(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme),
            this.appThemeScheme, 8, 8, this.panelInputCurrent()), 'nativeButton'))
        .onClick((): void => { if (this.panelInputCurrent()) this.onExit(); });
      }
    }
    .width(this.innerWidth())
    .height(this.panelHeaderHeight())
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private collapseLabel() {
    Text('收起')
      .maxLines(1)
      .fontFamily(TYPE_READER_DIRECTORY_COLLAPSE.fontFamily)
      .fontWeight(TYPE_READER_DIRECTORY_COLLAPSE.fontWeight)
      .fontSize(TYPE_READER_DIRECTORY_COLLAPSE.fontSizeFp)
      .lineHeight(TYPE_READER_DIRECTORY_COLLAPSE.lineHeightFp as number)
      .fontColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
      .textAlign(TextAlign.Center)
      .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
  }



  private catalogEmptyMessage(): string {
    if (this.entries.length > 0) return '没有匹配的章节';
    if (this.catalogMessage.trim().length > 0) return this.catalogMessage;
    return this.allowUnanchoredBrowse ? '暂无可用章节，可返回书籍详情重试或更换书源' :
      '暂无可用章节，可返回阅读页重试或更换书源';
  }

  private catalogRetryVisible(): boolean {
    if (this.entries.length > 0 || this.navigationActive) return false;
    return !this.catalogBusy;
  }

  private catalogClearSearchVisible(): boolean {
    return !this.navigationActive && this.entries.length > 0 && this.projectedEntries.length === 0 &&
      this.searchQuery.length > 0;
  }

  @Builder
  private tabs() {
    Column({ space: 0 }) {
      Row() {
        this.directoryTab();
        this.bookmarkTab();
      }
      .width('100%')
      .height(this.tabStripHeight() - 1)
      .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS, top: 5 });
      Text('')
        .width('100%')
        .height(1)
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
    }
    .width('100%')
    .height(this.tabStripHeight());
  }

  @Builder
  private directoryTab() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack({ alignContent: Alignment.Bottom }) { this.directoryTabContent(); }
        .width('100%').height(this.tabHeight())
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.layoutWeight(1).height(this.tabHeight()).padding(0)
      .attributeModifier(new ReaderActionAccessibility('目录', this.panelInputCurrent(), this.activeTab === 'directory', true,
        new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 0, 0, this.panelInputCurrent()), 'nativeButton'))
      .responseRegion(readerActionTouchRegion('100%', this.tabHeight()))
      .onClick((): void => { this.choosePanelTab('directory'); });
  }

  @Builder
  private directoryTabContent() {
      Row() {
        Text('目录')
          .fontFamily(TYPE_READER_DIRECTORY_TAB.fontFamily)
          .fontWeight(TYPE_READER_DIRECTORY_TAB.fontWeight)
          .fontSize(TYPE_READER_DIRECTORY_TAB.fontSizeFp)
          .lineHeight(TYPE_READER_DIRECTORY_TAB.lineHeightFp as number).halfLeading(true)
          .fontColor(this.activeTab === 'directory' ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .textAlign(TextAlign.Center);
      }
      .width('100%')
      .height(this.tabHeight())
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center);
      if (this.activeTab === 'directory') {
        Text('')
          .width(this.activeTabLineWidth())
          .height(2)
          .backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
          .borderRadius(Math.min(this.activeTabLineWidth(), 2) / 2);
      }
  }

  @Builder
  private bookmarkTab() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack({ alignContent: Alignment.Bottom }) { this.bookmarkTabContent(); }
        .width('100%').height(this.tabHeight())
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.layoutWeight(1).height(this.tabHeight()).padding(0)
      .attributeModifier(new ReaderActionAccessibility('书签', this.panelInputCurrent(), this.activeTab === 'bookmarks', true,
        new ReaderPressFeedback(Color.Transparent, this.appThemeScheme, 0, 0, this.panelInputCurrent()), 'nativeButton'))
      .responseRegion(readerActionTouchRegion('100%', this.tabHeight()))
      .onClick((): void => { this.choosePanelTab('bookmarks'); });
  }

  @Builder
  private bookmarkTabContent() {
      Row({ space: 5 }) {
        if (this.activeTab === 'bookmarks') {
          Image(this.appThemeScheme === 'night' ? $r('app.media.reader_page_bookmark_filled_theme_night') :
            $r('app.media.reader_page_bookmark_filled'))
            .width(14)
            .height(14);
        } else {
          Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark')))
            .width(14)
            .height(14);
        }
        Text('书签')
          .fontFamily(TYPE_READER_DIRECTORY_TAB.fontFamily)
          .fontWeight(TYPE_READER_DIRECTORY_TAB.fontWeight)
          .fontSize(TYPE_READER_DIRECTORY_TAB.fontSizeFp)
          .lineHeight(TYPE_READER_DIRECTORY_TAB.lineHeightFp as number).halfLeading(true)
          .fontColor(this.activeTab === 'bookmarks' ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      }
      .width('100%')
      .height(this.tabHeight())
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center);
      if (this.activeTab === 'bookmarks') {
        Text('')
          .width(this.activeTabLineWidth())
          .height(2)
          .backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
          .borderRadius(Math.min(this.activeTabLineWidth(), 2) / 2);
      }
  }

  private choosePanelTab(tab: string): void {
    if (!this.panelInputCurrent()) return;
    if (this.activeTab === tab) {
      this.cancelProjectionTopScroll();
      this.listScroller.scrollEdge(Edge.Top);
      return;
    }
    this.switchTab(tab);
  }

  @Builder
  private searchControls() {
    Column({ space: 0 }) {
      ReaderDirectoryToolbar({ editingHost: this.editingHost,
        editingCurrent: (): boolean => this.panelInputCurrent(),
        variant: this.catalogToolbar() ? 'standalone-catalog' : 'full-directory',
        readingPalette: !this.standaloneCatalog || this.embeddedInControl,
        text: this.searchDraft, placeholder: this.searchPlaceholder(),
        ascending: this.ascending, showChapterTools: this.activeTab === 'directory',
        availableWidthVp: this.innerWidth(), inputMinimumWidthVp: this.toolbarInputMinimumWidth(),
        naturalFieldHeightVp: this.queryHeight(), naturalToolbarHeightVp: this.searchControlsHeight() - (this.embeddedInControl ? 0 : 1),
        onTextChange: (value: string): void => {
          if (!this.panelInputCurrent()) return;
          this.searchDraft = value;
          this.applySearch(value);
        },
        onSearch: (): void => this.handleControl('search'),
        onTop: (): void => this.handleControl('top'),
        onBottom: (): void => this.handleControl('bottom'),
        onToggleSort: (): void => this.handleControl('sort'),
        onOpenCacheManagement: (): void => { if (this.panelInputCurrent()) this.onOpenCacheManagement(); },
      });
      if (!this.embeddedInControl) {
        Text('')
          .width('100%')
          .height(1)
          .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
      }
    }
    .width('100%')
    .height(this.searchControlsHeight());
  }

  @Builder
  private chapterList() {
    // The outer actor keeps the Full mount height. Centering its shorter
    // Quick viewport moves every row below the Stage's Quick clip.
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        if (this.bookmarkIdentity !== undefined) {
          ReaderDirectoryNavigationSurface({ navigationPortFactory: this.navigationPortFactory,
            inputCurrent: (): boolean => this.panelInputCurrent(),
            sourceId: this.bookmarkIdentity.sourceId, bookId: this.bookmarkIdentity.bookId, query: this.searchQuery, ascending: this.ascending,
            currentChapterIndex: this.currentChapterIndex, openRevision: this.listSessionKey, prepareLocalTxt: this.prepareLocalTxt,
            locateCurrentRevision: this.standaloneCatalog ? this.locateCurrentRevision : 0,
            refreshRevision: this.directoryRulesRevision,
            showLoadStatus: this.projectedEntries.length > 0 || this.navigationActive,
            interacted: this.navigationInteracted, rowHeight: this.directoryListRowHeight(),
            interactionEnabled: this.chapterActionsEnabled && !this.motionActive,
            listPaddingX: this.directoryListPaddingX(), listPaddingY: this.embeddedInControl ? 0 : 5,
            edgeEffectMode: EdgeEffect.Spring, scroller: this.listScroller,
            directoryPublication: this.directoryPublication,
          directoryEntriesRevision: this.directoryPublication.publish(this.admittedEntries),
            chapterDownloadEnabled: this.chapterDownloadEnabled,
            chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
            bookmarkActionsEnabled: this.bookmarkActionsEnabled,
            headerCount: 0,
            prefixHeight: this.standalonePrefixHeight(), prefixIdentity: `${this.listSessionKey}:${this.activeTab}:${this.fontScale()}:${this.innerWidth()}`,
            prefixBuilder: (): void => { this.standalonePrefix(); },
            tailHeight: this.flowCatalogFooter() ? this.standaloneFooterHeight() : 0,
            tailBuilder: (): void => { this.catalogFooter(); },
            fallbackBuilder: (): void => { this.flatChapterList(); },
            onSelectTarget: (chapterIndex: number, chapterOffsetScalar: number, positionScope?: RemoteReadingPositionScope, directoryTargetProof?: ReaderDirectoryTargetProof): void => {
              this.onSelectNavigationTarget(chapterIndex, chapterOffsetScalar, positionScope, directoryTargetProof);
            },
            onFirstLayout: (): void => this.onListFirstLayout(),
            onUserScrollIntent: (): void => this.onListUserScroll(),
            onClearSearch: (): void => { if (this.navigationActive) this.clearCatalogSearch(); },
            onTreeStateChange: (active: boolean): void => {
              this.navigationActive = active;
              if (active) this.initialListPositionReady = true;
              else if (this.standaloneCatalog) this.scheduleOpenPositioning();
            },
            onDeleteBookmarks: (times: number[]): void => { if (this.bookmarkActionsEnabled) this.onDeleteBookmarks(times); },
            onDownloadChapter: (chapterIndex: number): void => this.onDownloadChapter(chapterIndex),
            onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void =>
              { if (this.bookmarkActionsEnabled) this.onCreateChapterStartBookmark(request); },
          });
        } else {
          this.flatChapterList();
        }
      }
      .width(this.directoryListWidth())
      .height(this.directoryListViewportHeight())
    }
    .width('100%')
    .height(this.chapterListHeight())
    .clip(true)
    .opacity(this.standaloneShort() || this.projectedEntries.length > 0 || this.navigationActive ? 1 : 0)
    .enabled(this.standaloneShort() ? this.chapterActionsEnabled : this.initialListPositionReady)
    .accessibilityLevel(this.standaloneShort() || this.initialListPositionReady ? 'auto' : 'no-hide-descendants')
    .hitTestBehavior(this.standaloneShort() || this.initialListPositionReady ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private flatChapterList() {
    ReaderDirectoryList({
        entries: this.projectedEntries,
        prefixHeight: this.standalonePrefixHeight(),
        prefixBuilder: (): void => { this.standalonePrefix(); },
        emptyBuilder: (): void => { if (this.embeddedInControl || this.flowCatalogFooter()) this.standaloneCatalogState(); },
        tailHeight: this.flowCatalogFooter() ? this.standaloneFooterHeight() : 0,
        tailBuilder: (): void => { this.catalogFooter(); },
        deferEntriesDuringMotion: this.embeddedInControl && this.controlProgress() > 0 && this.controlProgress() < 1,
        rowHeight: this.directoryListRowHeight(),
        listPaddingX: this.directoryListPaddingX(),
        listPaddingY: this.embeddedInControl ? 0 : 5,
        edgeEffectMode: EdgeEffect.Spring,
        scroller: this.listScroller,
        onViewportChanged: (_width: number, height: number): void => this.onListViewportChanged(height),
        onFirstLayout: (): void => this.onListFirstLayout(),
        onUserScrollIntent: (): void => this.onListUserScroll(),
        onGeometryProbe: (event: string): void => this.onGeometryProbe(`p=${this.controlProgress()} ${event}`),
        geometryProbeEnabled: this.geometryProbeEnabled,
        rowBuilder: (repeatItem: RepeatItem<LocalReadingTocEntry>) => {
          this.chapterRow(repeatItem.item);
        },
    });
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    ReaderDirectoryChapterRow({ variant: 'standalone', entry: entry, rowHeight: this.directoryListRowHeight(),
      currentChapterIndex: this.currentChapterIndex, chapterDownloadEnabled: this.chapterDownloadEnabled,
      chapterStartBookmarkCreationEnabled: this.chapterStartBookmarkCreationEnabled,
      bookmarkActionsEnabled: this.bookmarkActionsEnabled,
      canActOnEntry: (current: LocalReadingTocEntry): boolean =>
        sameReaderDirectoryData([current], [entry]) && this.flatChapterIsCurrent(entry),
      onSelectChapter: (index: number): void => this.onSelectChapter(index),
      onDownloadChapter: (index: number): void => this.onDownloadChapter(index),
      onDeleteBookmarks: (times: number[]): void => { if (this.bookmarkActionsEnabled) this.onDeleteBookmarks(times); },
      onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest): void => {
        if (this.bookmarkActionsEnabled) this.onCreateChapterStartBookmark(request);
      },
    });
  }

  private flatChapterIsCurrent(entry: LocalReadingTocEntry): boolean {
    if (!this.panelInputCurrent() || !this.initialListPositionReady ||
      this.navigationActive || entry.navigable === false) {
      return false;
    }
    const current = this.projectedEntries.find((chapter: LocalReadingTocEntry): boolean => chapter.index === entry.index);
    return current !== undefined && sameReaderDirectoryData([entry], [current]);
  }

  private panelInputCurrent(): boolean {
    return this.positioningMounted && this.chapterActionsEnabled && !this.motionActive && (this.inputCurrent?.() ?? true);
  }

  /**
   * Explicit tab switch: the projection always receives the next tab value.
   * Never reads the freshly written `activeTab` back — on the device runtime
   * that read can still expose the previous value, keeping the old projection.
   */
  private switchTab(nextTab: string): void {
    if (!this.panelInputCurrent()) return;
    this.activeTab = nextTab;
    this.rebuildProjection(nextTab, this.ascending, this.searchQuery);
    this.beginListPositioning(nextTab);
    this.onTabChange(nextTab);
    if (nextTab === 'bookmarks') this.navigationActive = false;
  }

  private selectBookmark(bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void {
    if (!this.panelInputCurrent()) return;
    if (this.onSelectBookmark !== undefined) {
      this.onSelectBookmark(bookmarkId, chapterIndex, chapterOffset, positionScope);
      return;
    }
    // Legacy fallback until the owner wires exact-offset selection.
    this.onSelectChapter(chapterIndex);
  }

  @Builder
  private bookmarkBody() {
    Column() {
      if (this.standaloneShort() && (this.bookmarkLoadFailed || this.bookmarkTabLoading || this.projectedBookmarks.length === 0)) {
        List({ space: 0, scroller: this.listScroller }) {
          ListItem() {
            ReaderPageState({ loading: this.bookmarkTabLoading && !this.bookmarkLoadFailed,
              variant: !this.bookmarkLoadFailed && !this.bookmarkTabLoading && this.searchQuery.length > 0 ? 'inline' : 'default',
              padded: this.bookmarkLoadFailed || this.bookmarkTabLoading || this.searchQuery.length === 0,
              title: this.bookmarkLoadFailed ? '书签载入失败' : this.bookmarkTabLoading ? '' : readerBookmarkEmptyCopy(this.searchQuery.length > 0).title,
              message: this.bookmarkLoadFailed ? this.bookmarkLoadMessage : this.bookmarkTabLoading ? '书签载入中…' :
                readerBookmarkEmptyCopy(this.searchQuery.length > 0).message,
              actionLabel: this.bookmarkLoadFailed ? '重试' : this.bookmarkTabLoading ? '' : readerBookmarkEmptyCopy(this.searchQuery.length > 0).action,
              actionGeneration: this.shortBookmarkStateActionKey(),
              onAction: (generation: number): void => this.shortBookmarkStateAction(generation) });
          }.width('100%').constraintSize({ minHeight: 44 });
        }.width('100%').height('100%').scrollBar(BarState.Off);
      } else if (this.bookmarkLoadFailed) {
        ReaderBookmarkErrorState({
          message: this.bookmarkLoadMessage.length > 0 ? this.bookmarkLoadMessage : '书签载入失败，请稍后重试',
          onRetry: (): void => { if (this.panelInputCurrent()) this.onRetryBookmarkLoad(); },
        });
      } else if (this.bookmarkTabLoading) {
        ReaderBookmarkLoadingState();
      } else if (this.projectedBookmarks.length === 0) {
        ReaderBookmarkEmptyState({
          filtered: this.searchQuery.length > 0, actionGeneration: this.listPositioning.listOpenRevision,
          onAction: (generation: number, filtered: boolean): void => this.bookmarkEmptyAction(generation, filtered),
        });
      } else {
        ReaderBookmarkList({
          rows: this.projectedBookmarks,
          embeddedInControl: this.embeddedInControl,
          motionProgress: this.controlProgress(),
          rowWidth: this.bookmarkRowWidth(),
          standaloneSize: this.standaloneBookmarkSize(),
          prefixHeight: this.standalonePrefixHeight(),
          prefixBuilder: (): void => { this.standalonePrefix(); },
          listPaddingX: this.embeddedInControl ? this.controlValue(15, 10) : TOK_SPACE_CONTROL_INLINE,
          listPaddingY: this.embeddedInControl ? 0 : 4,
          layoutRowHeight: this.bookmarkListLayoutRowHeight(),
          layoutViewportWidth: this.bookmarkListLayoutViewportWidth(),
          layoutViewportHeight: this.bookmarkListLayoutViewportHeight(),
          layoutPaddingX: this.bookmarkListLayoutPaddingX(),
          scroller: this.listScroller,
          onViewportChanged: (_width: number, height: number): void => this.onListViewportChanged(height),
          onFirstLayout: (): void => this.onListFirstLayout(),
          onUserScrollIntent: (): void => this.onListUserScroll(),
          onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void => {
            this.selectBookmark(bookmarkId, chapterIndex, chapterOffset, positionScope);
          },
        })
        // Bookmark cards are persistent actors as well; only their input is
        // gated until the initial positioning command is committed.
        .opacity(this.projectedBookmarks.length > 0 ? 1 : 0)
        .enabled(this.standaloneShort() ? this.chapterActionsEnabled : this.initialListPositionReady)
        .accessibilityLevel(this.standaloneShort() || this.initialListPositionReady ? 'auto' : 'no-hide-descendants')
        .hitTestBehavior(this.standaloneShort() || this.initialListPositionReady ? HitTestMode.Default : HitTestMode.None);
      }
    }
    .width('100%')
    .height(this.bookmarkBodyViewportHeight())
    // The inner native List may stay at its endpoint viewport during a morph;
    // this live wrapper owns the visible clip and therefore never unmounts or
    // asks AceList to recompute 1,000+ rows for every progress sample.
    .clip(this.embeddedInControl);
  }

  @Builder
  private catalogFooter() {
    Column() {
      ReaderDirectoryQuickActions({
        title: this.currentTitle(), positionLabel: this.currentPosition() === '—' ? '' : this.currentPosition(),
        scheme: this.appThemeScheme, fontScale: this.fontScale(),
        locateEnabled: this.panelInputCurrent() && this.currentEntry() !== undefined,
        edgeEnabled: this.panelInputCurrent() && (this.projectedEntries.length > 0 || this.navigationActive),
        onLocateCurrent: (): void => this.locateCurrent(),
        onTop: (): void => this.handleControl('top'),
        onBottom: (): void => this.handleControl('bottom'),
      }).width(Math.min(540, this.innerWidth()));
    }.width('100%').height(this.standaloneFooterHeight()).alignItems(HorizontalAlign.Center);
  }

  private locateCurrent(): void {
    if (!this.panelInputCurrent() || this.activeTab !== 'directory' || this.currentEntry() === undefined) return;
    this.searchDraft = '';
    this.searchQuery = '';
    this.rebuildProjection('directory', this.ascending, '');
    this.locateCurrentRevision += 1;
    this.beginListPositioning('directory', false);
  }

  @Builder
  private statusFooter() {
    Column({ space: 0 }) {
      Text('')
        .width('100%')
        .height(1)
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
      Row({ space: TOK_SPACE_CONTROL_INLINE }) {
        Text('当前章节')
          .flexShrink(0)
          .fontFamily(TYPE_READER_DIRECTORY_CURRENT_CAPTION.fontFamily).fontWeight(TYPE_READER_DIRECTORY_CURRENT_CAPTION.fontWeight).fontSize(TYPE_READER_DIRECTORY_CURRENT_CAPTION.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(1);
        Text(this.currentTitle())
          .layoutWeight(1)
          .constraintSize({ minWidth: 0 })
          .fontFamily(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontFamily)
          .fontWeight(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontWeight)
          .fontSize(TYPE_READER_DIRECTORY_CURRENT_TITLE.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(this.currentPosition())
          .flexShrink(0)
          .fontFamily(TYPE_READER_DIRECTORY_POSITION_INTER.fontFamily)
          .fontWeight(TYPE_READER_DIRECTORY_POSITION_INTER.fontWeight)
          .fontSize(TYPE_READER_DIRECTORY_POSITION_INTER.fontSizeFp)
          .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
          .maxLines(1)
          .textAlign(TextAlign.End);
      }
      .width('100%')
      .height(this.standaloneFooterHeight() - 1)
      .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: 1 })
      .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
      .alignItems(VerticalAlign.Center);
    }
    .width('100%')
    .height(this.standaloneFooterHeight());
  }

  private applySearch(value: string = this.searchDraft): void {
    const nextQuery = value.trim();
    if (nextQuery === this.searchQuery) return;
    this.searchQuery = nextQuery;
    this.rebuildProjection(this.activeTab, this.ascending, nextQuery);
    this.scheduleProjectionTopScroll();
  }

  private clearCatalogSearch(): void {
    if (!this.panelInputCurrent() || this.activeTab !== 'directory' || this.searchQuery.length === 0) return;
    this.searchDraft = '';
    this.applySearch('');
  }

  private shortBookmarkStateActionKey(): number {
    return this.listPositioning.listOpenRevision * 3 + (this.bookmarkLoadFailed ? 2 : this.searchQuery.length > 0 ? 1 : 0);
  }

  private shortBookmarkStateAction(generation: number): void {
    if (!this.panelInputCurrent() || this.activeTab !== 'bookmarks' || generation !== this.shortBookmarkStateActionKey()) return;
    if (this.bookmarkLoadFailed) this.onRetryBookmarkLoad();
    else this.bookmarkEmptyAction(this.listPositioning.listOpenRevision, this.searchQuery.length > 0);
  }

  private bookmarkEmptyAction(generation: number, filtered: boolean): void {
    if (!this.panelInputCurrent() || this.activeTab !== 'bookmarks' || generation !== this.listPositioning.listOpenRevision ||
      this.bookmarkLoadFailed || this.bookmarkTabLoading || this.projectedBookmarks.length !== 0 ||
      filtered !== (this.searchQuery.length > 0)) return;
    if (!filtered) {
      this.switchTab('directory');
      return;
    }
    this.searchDraft = '';
    this.searchQuery = '';
    this.rebuildProjection('bookmarks', this.ascending, '');
    this.scheduleProjectionTopScroll();
  }

  private handleControl(kind: string): void {
    if (!this.panelInputCurrent()) return;
    if (kind === 'search') {
      this.applySearch();
      return;
    }
    if (kind === 'top') {
      const localBookId = this.activeTab === 'directory' && this.bookmarkIdentity !== undefined ?
        readerDirectoryScopeKey(this.bookmarkIdentity.sourceId, this.bookmarkIdentity.bookId) : undefined;
      if (localBookId !== undefined) readerDirectorySignalScrollIntent(localBookId);
      this.cancelProjectionTopScroll();
      this.listScroller.scrollEdge(Edge.Top);
      if (localBookId !== undefined) readerDirectorySignalScrollCommand(localBookId);
      return;
    }
    if (kind === 'bottom') {
      const localBookId = this.activeTab === 'directory' && this.bookmarkIdentity !== undefined ?
        readerDirectoryScopeKey(this.bookmarkIdentity.sourceId, this.bookmarkIdentity.bookId) : undefined;
      if (localBookId !== undefined) readerDirectorySignalScrollIntent(localBookId);
      this.cancelProjectionTopScroll();
      this.listScroller.scrollEdge(Edge.Bottom);
      if (localBookId !== undefined) readerDirectorySignalScrollCommand(localBookId);
      return;
    }
    // Do not read @State back in the same event after assigning it. On the
    // current device runtime that read can still expose the previous value,
    // making the arrow update while the projected data keeps the old order.
    const nextAscending = !this.ascending;
    this.ascending = nextAscending;
    this.rebuildProjection(this.activeTab, nextAscending, this.searchQuery);
    this.scheduleProjectionTopScroll();
  }

  private onEntriesChanged(): void {
    // ArkUI may refresh the entries prop along with every motion frame. Only
    // actual business-data changes may flip the virtual List's mount branch.
    // A retained embedded control can briefly receive the shared empty
    // sentinel when its host commits the hidden endpoint. Do not mutate the
    // projection from that render callback: replacing a populated Repeat/List
    // with zero rows while the dismiss clock is painting is illegal in Ace
    // state management and is the direct source of the hardware black frame.
    // A new book owns a new FullDirectoryPanel instance/listSessionKey, so a
    // genuinely empty catalog is still admitted on its fresh mount.
    if (!this.positioningMounted) return;
    if (this.embeddedInControl && this.entries.length === 0 && this.admittedEntries.length > 0) return;
    // Retain the latest source until the endpoint. Comparing and copying a
    // large TOC here repeats O(chapters) work on every motion prop delivery.
    // The admitted snapshot stays independent, so same-reference edits are
    // still detected when the deferred transaction is finally safe to apply.
    this.pendingEntries = this.entries;
    this.scheduleDeferredMutationFlush();
  }

  private onListSessionKeyChanged(): void {
    if (!this.positioningMounted) return;
    // Keep only the newest key. If the owner restores the applied key before
    // the next turn, cancel the stale reopen request instead of recentering.
    if (this.listSessionKey === this.lastListSessionKey) {
      this.deferredSessionKey = undefined;
      return;
    }
    this.deferredSessionKey = this.listSessionKey;
    this.scheduleDeferredMutationFlush();
  }

  private onReadingAnchorChanged(): void {
    if (!this.positioningMounted) return;
    this.deferredReadingAnchor = true;
    this.scheduleDeferredMutationFlush();
  }

  /**
   * Coalesce all @Watch notifications into one next-turn transaction. ArkUI
   * can invoke these callbacks while a Repeat/List subtree is being rendered;
   * writing @State there makes the native virtual extent change mid-render.
   * The mutation generation notices writes that arrive while a flush is
   * running and drains one more turn; the lifecycle generation prevents a
   * retained panel from applying work after it disappeared and reappeared.
   */
  private scheduleDeferredMutationFlush(): void {
    this.deferredMutationGeneration += 1;
    const lifecycleGeneration = this.deferredLifecycleGeneration;
    if (this.deferredFlushScheduled && this.deferredFlushLifecycleGeneration === lifecycleGeneration) return;
    this.deferredFlushScheduled = true;
    this.deferredFlushLifecycleGeneration = lifecycleGeneration;
    setTimeout((): void => {
      if (!this.positioningMounted || lifecycleGeneration !== this.deferredLifecycleGeneration ||
        this.deferredFlushLifecycleGeneration !== lifecycleGeneration) return;
      this.deferredFlushScheduled = false;
      this.deferredFlushLifecycleGeneration = -1;
      const generation = this.deferredMutationGeneration;
      this.flushDeferredMutations();
      if (generation !== this.deferredMutationGeneration && !this.deferredFlushScheduled &&
        this.positioningMounted) {
        this.scheduleDeferredMutationFlush();
      }
    }, 0);
  }

  /**
   * Apply the latest motion sample first, then admit business/list changes
   * only after the shared clock reaches an endpoint. This keeps all native
   * List remounts out of intermediate morph frames and combines session,
   * anchor and data updates into at most one projection rebuild.
   */
  private flushDeferredMutations(): void {
    const queuedProgress = this.deferredMotionProgress;
    this.deferredMotionProgress = undefined;
    const progress = queuedProgress === undefined ? this.controlProgress() : queuedProgress;
    const nextMotionActive = progress > 0 && progress < 1;
    this.motionActive = nextMotionActive;
    this.applyMotionProgress(progress);
    if (nextMotionActive) return;

    const queuedSessionKey = this.deferredSessionKey;
    const sessionChanged = queuedSessionKey !== undefined && queuedSessionKey !== this.lastListSessionKey;
    if (queuedSessionKey !== undefined) this.deferredSessionKey = undefined;
    if (sessionChanged) this.lastListSessionKey = queuedSessionKey as string;

    const queuedEntries = this.pendingEntries;
    const hasEntriesUpdate = queuedEntries !== undefined &&
      !sameReaderDirectoryData(this.admittedEntries, queuedEntries);
    if (queuedEntries !== undefined) this.pendingEntries = undefined;

    const tab = this.initialTab === 'bookmarks' ? 'bookmarks' : 'directory';
    const tabChanged = sessionChanged && this.activeTab !== tab;
    if (tabChanged) this.activeTab = tab;

    let previousOffset: number | undefined = undefined;
    if (hasEntriesUpdate) {
      previousOffset = this.projectionRestoreOffset ?? this.readListOffset();
      this.admittedEntries = snapshotReaderDirectoryData(queuedEntries as LocalReadingTocEntry[]);
      this.projectionScrollGeneration += 1;
    }
    if (tabChanged || hasEntriesUpdate) {
      this.rebuildProjection(this.activeTab, this.ascending, this.searchQuery);
    }

    if (sessionChanged) {
      // A persistent panel must recenter on every open. The native List stays
      // mounted; only its positioning state is reset after the endpoint.
      this.beginListPositioning(tab);
    } else if (hasEntriesUpdate) {
      if (this.awaitingReadingAnchor) this.beginListPositioning(this.positioningTab, false);
      if (this.listPositioning.status === 'pending') {
        this.scheduleOpenPositioning();
      } else if (previousOffset !== undefined) {
        // Projection updates restore the user's window, not current-chapter
        // centering, after the one safe endpoint remount.
        this.projectionRestoreOffset = previousOffset;
        this.scheduleRetainedOffset(previousOffset);
      }
    } else if (this.deferredReadingAnchor && this.awaitingReadingAnchor) {
      this.beginListPositioning(this.positioningTab, false);
    }
    this.deferredReadingAnchor = false;
  }

  private canonicalOrdinal(chapterIndex: number): number {
    for (let index = 0; index < this.admittedEntries.length; index += 1) {
      if (this.admittedEntries[index].index === chapterIndex) return index;
    }
    return -1;
  }

  private beginListPositioning(tab: string, resetViewport: boolean = true): void {
    this.standaloneRestoreGeneration += 1;
    this.standaloneRestoreAnchor = undefined;
    this.admitStandaloneLayout();
    const previousTab = this.positioningTab;
    this.positioningTab = tab;
    this.previousRowHeight = this.listRowHeight(tab);
    this.projectionScrollGeneration += 1;
    this.motionLayoutRevision += 1;
    this.leadingRowAnchor = undefined;
    this.projectionRestoreOffset = undefined;
    // A retained native List often keeps the same measured viewport across a
    // close/reopen. Do not erase that measurement: doing so leaves positioning
    // pending forever because ArkUI does not necessarily emit a second
    // onAreaChange for an unchanged retained node. A tab switch mounts a
    // different List and intentionally waits for its first layout.
    if (resetViewport && previousTab !== tab) this.listViewportHeight = 0;
    this.initialListPositionReady = false;
    const ordinal = this.canonicalOrdinal(this.currentChapterIndex);
    if (!this.positioningMounted || ordinal < 0) {
      const browseWithoutAnchor = this.positioningMounted && ordinal < 0 &&
        this.allowUnanchoredBrowse && !this.embeddedInControl;
      this.awaitingReadingAnchor = !browseWithoutAnchor;
      this.listPositioning = endReaderControlListOpen(this.listPositioning);
      this.initialListPositionReady = browseWithoutAnchor;
      return;
    }
    this.awaitingReadingAnchor = false;
    const sessionKey = this.listSessionKey.length > 0 ? this.listSessionKey : 'mounted-directory';
    this.listPositioning = beginReaderControlListOpen(this.listPositioning, `${sessionKey}:${tab}`, ordinal);
    this.scheduleOpenPositioning();
  }

  private onListViewportChanged(height: number): void {
    this.listViewportHeight = height;
    this.restoreStandaloneLayout();
    this.scheduleOpenPositioning();
  }

  /**
   * ReaderDirectoryList reports its first native layout independently of
   * area-change delivery.  HarmonyOS can suppress an onAreaChange callback
   * when an ancestor is clipped during a morph; without this second signal the
   * list remained permanently pending/transparent in the Quick endpoint.
   */
  private onListFirstLayout(): void {
    if (!this.positioningMounted) return;
    if (this.listViewportHeight <= 0) {
      this.listViewportHeight = this.positioningTab === 'bookmarks' ?
        this.bookmarkViewportHeightAt(this.controlProgress()) :
        this.directoryListViewportHeight();
    }
    this.scheduleOpenPositioning();
    this.restoreStandaloneLayout();
  }

  private onListUserScroll(): void {
    this.standaloneRestoreGeneration += 1;
    this.standaloneRestoreAnchor = undefined;
    this.listPositioning = markReaderControlListUserScrolled(
      this.listPositioning, this.listPositioning.listOpenRevision);
    this.navigationInteracted = true;
    this.leadingRowAnchor = undefined;
    this.projectionRestoreOffset = undefined;
    this.awaitingReadingAnchor = false;
    this.initialListPositionReady = true;
    this.motionLayoutRevision += 1;
    this.projectionScrollGeneration += 1;
  }

  private scheduleOpenPositioning(): void {
    if (!this.positioningMounted || this.navigationActive || this.listPositioning.status !== 'pending') return;
    const openRevision = this.listPositioning.listOpenRevision;
    const generation = this.projectionScrollGeneration;
    const context = this.getUIContext();
    context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
      if (!this.positioningMounted || generation !== this.projectionScrollGeneration ||
        openRevision !== this.listPositioning.listOpenRevision || this.listViewportHeight <= 0 ||
        this.navigationActive || this.listPositioning.status !== 'pending') return;
      const tab = this.positioningTab;
      const ordinalByChapter = new Map<number, number>();
      for (let index = 0; index < this.admittedEntries.length; index += 1) {
        ordinalByChapter.set(this.admittedEntries[index].index, index);
      }
      const directoryRows: ReaderControlDirectoryPosition[] = [];
      const bookmarkRows: ReaderControlBookmarkPosition[] = [];
      if (tab === 'bookmarks') {
        for (const row of this.projectedBookmarks) {
          bookmarkRows.push({
            chapterOrdinal: ordinalByChapter.get(row.chapterIndex) ?? -1,
            chapterOffset: row.chapterOffset,
          });
        }
      } else {
        for (const row of this.projectedEntries) {
          directoryRows.push({ chapterOrdinal: ordinalByChapter.get(row.index) ?? -1 });
        }
      }
      const target = tab === 'bookmarks' ?
        readerControlNearestBookmarkRow(bookmarkRows, this.listPositioning.currentChapterOrdinal) :
        readerControlDirectoryTargetRow(directoryRows, this.listPositioning.currentChapterOrdinal);
      const padding = this.embeddedInControl ? 0 : (tab === 'bookmarks' ? 4 : 5);
      const viewport = target === undefined ? undefined : readerControlUniformListViewport({
        rowCount: tab === 'bookmarks' ? bookmarkRows.length : directoryRows.length,
        rowIndex: target,
        rowHeight: this.listRowHeight(tab),
        rowSpacing: 0,
        paddingTop: padding + this.standalonePrefixHeight(),
        paddingBottom: padding + (tab === 'directory' && this.flowCatalogFooter() ? this.standaloneFooterHeight() : 0),
        viewportHeight: this.listViewportHeight,
      });
      const prepared = prepareReaderControlListPosition(this.listPositioning, openRevision,
        tab !== 'bookmarks' || (!this.bookmarkTabLoading && !this.bookmarkLoadFailed), viewport);
      this.listPositioning = prepared.state;
      const command = prepared.command;
      if (command === undefined || !readerControlListPositionIsCurrent(this.listPositioning, command)) return;
      try {
        this.listScroller.scrollTo({ xOffset: 0, yOffset: command.yOffset,
          animation: { duration: 0, curve: Curve.Linear } });
        this.listPositioning = commitReaderControlListPosition(this.listPositioning, command);
        this.leadingRowAnchor = undefined;
        this.initialListPositionReady = true;
      } catch (_error) {
        // Keep this opening pending until the real list has a usable layout.
      }
    }));
  }

  private readListOffset(): number | undefined {
    try {
      const offset = this.listScroller.currentOffset().yOffset;
      return Number.isFinite(offset) ? Math.max(0, offset) : undefined;
    } catch (_error) {
      return undefined;
    }
  }

  private scheduleRetainedOffset(offset: number): void {
    const generation = this.projectionScrollGeneration;
    const openRevision = this.listPositioning.listOpenRevision;
    setTimeout((): void => {
      if (!this.positioningMounted || generation !== this.projectionScrollGeneration ||
        openRevision !== this.listPositioning.listOpenRevision || this.listPositioning.status === 'pending') return;
      try {
        this.listScroller.scrollTo({ xOffset: 0, yOffset: offset,
          animation: { duration: 0, curve: Curve.Linear } });
        this.projectionRestoreOffset = undefined;
      } catch (_error) {}
    }, 0);
  }

  private onMotionProgressChanged(): void {
    this.onStandaloneLayoutChanged();
    const progress = this.controlProgress();
    if (!this.positioningMounted) return;
    this.deferredMotionProgress = progress;
    this.scheduleDeferredMutationFlush();
  }

  private currentStandaloneLayoutKey(): string {
    return `${this.activeTab}:${this.standaloneShort()}:${this.panelWidth()}:${this.panelHeight()}:${this.fontScale()}`;
  }

  private admitStandaloneLayout(): void {
    this.standaloneLayoutKey = this.currentStandaloneLayoutKey();
    this.standaloneLayoutPrefix = this.standalonePrefixHeight();
    this.standaloneLayoutRowHeight = this.listRowHeight(this.activeTab);
  }

  private onStandaloneLayoutChanged(): void {
    if (this.embeddedInControl || !this.positioningMounted || this.standaloneLayoutKey.length === 0 ||
      this.currentStandaloneLayoutKey() === this.standaloneLayoutKey || this.listPositioning.status === 'pending') return;
    if (this.standaloneRestoreAnchor === undefined) {
      const offset = this.readListOffset();
      if (offset === undefined) return;
      this.standaloneRestoreAnchor = offset < this.standaloneLayoutPrefix ? -1 :
        Math.max(0, offset - this.standaloneLayoutPrefix) / Math.max(1, this.standaloneLayoutRowHeight);
    }
  }

  private restoreStandaloneLayout(): void {
    const anchor = this.standaloneRestoreAnchor;
    if (anchor === undefined || !this.positioningMounted || this.embeddedInControl) return;
    const generation = ++this.standaloneRestoreGeneration, lifecycle = this.deferredLifecycleGeneration;
    const key = this.currentStandaloneLayoutKey(), opening = this.listPositioning.listOpenRevision;
    const offset = anchor < 0 ? 0 : this.standalonePrefixHeight() + anchor * this.listRowHeight(this.activeTab);
    setTimeout((): void => {
      if (!this.positioningMounted || lifecycle !== this.deferredLifecycleGeneration || generation !== this.standaloneRestoreGeneration ||
        key !== this.currentStandaloneLayoutKey() || opening !== this.listPositioning.listOpenRevision ||
        this.listPositioning.status === 'pending') return;
      try {
        this.listScroller.scrollTo({ xOffset: 0, yOffset: offset, animation: { duration: 0, curve: Curve.Linear } });
        this.standaloneRestoreAnchor = undefined;
        this.admitStandaloneLayout();
      } catch (_) { /* A later native layout may complete this same bounded transfer. */ }
    }, 0);
  }

  private applyMotionProgress(progress: number): void {
    const previousProgress = this.previousMotionProgress;
    const directionIncreasing = progress >= previousProgress;
    this.motionDirectionIncreasing = directionIncreasing;
    this.previousMotionProgress = progress;
    const rowHeight = this.listRowHeight(this.positioningTab);
    const previousHeight = this.previousRowHeight;
    // Do not feed a continuously changing row height into AceList. Its
    // ChildrenMainSize update resets the virtual extent (prevTotalHeight=0)
    // and causes a visible black flash for large TOCs. One endpoint update is
    // enough; the sheet viewport itself continues to follow p.
    const intermediate = progress > 0 && progress < 1;
    if (this.embeddedInControl && this.positioningTab === 'bookmarks' && intermediate) {
      // Lock the bookmark List to the transition's first observed direction.
      // A deliberate reversal may change this once, but ordinary VSync
      // samples never write a new ChildrenMainSize value.
      const delta = progress - previousProgress;
      const direction = delta === 0 ? this.bookmarkMotionDirection : (delta > 0 ? 1 : -1);
      if (direction !== 0 && direction !== this.bookmarkMotionDirection) {
        this.bookmarkMotionDirection = direction;
        const endpoint = direction > 0 ? 1 : 0;
        this.motionStableBookmarkRowHeight = this.bookmarkVisualRowHeight(endpoint);
        this.motionStableBookmarkViewportWidth = this.bookmarkViewportWidthAt(endpoint);
        this.motionStableBookmarkViewportHeight = this.bookmarkViewportHeightAt(endpoint);
        this.motionStableBookmarkPaddingX = this.bookmarkPaddingXAt(endpoint);
      }
      return;
    }
    if (this.embeddedInControl && this.positioningTab === 'directory' && progress > 0 && progress < 1) {
      // Change the native List viewport once at transition start, then keep it
      // fixed while the outer Stack clips/reveals the expanding window.
      this.motionStableDirectoryViewportHeight = this.directoryViewportHeightAt(
        directionIncreasing ? 1 : 0);
      this.motionStableDirectoryPaddingX = this.directoryPaddingXAt(directionIncreasing ? 1 : 0);
      return;
    }
    this.previousRowHeight = rowHeight;
    if (this.embeddedInControl && this.positioningTab === 'directory') {
      this.motionStableDirectoryRowHeight = rowHeight;
      this.motionStableDirectoryPaddingX = this.directoryPaddingXAt(progress);
    }
    if (this.embeddedInControl && this.positioningTab === 'bookmarks') {
      this.motionStableBookmarkRowHeight = this.bookmarkVisualRowHeight(progress);
      this.motionStableBookmarkViewportWidth = this.bookmarkViewportWidthAt(progress);
      this.motionStableBookmarkViewportHeight = this.bookmarkViewportHeightAt(progress);
      this.motionStableBookmarkPaddingX = this.bookmarkPaddingXAt(progress);
      this.bookmarkMotionDirection = 0;
    }
    if (!this.positioningMounted || !this.embeddedInControl ||
      this.listPositioning.status === 'pending' || previousHeight === rowHeight) return;
    if (this.leadingRowAnchor === undefined) {
      const offset = this.readListOffset();
      if (offset === undefined) return;
      this.leadingRowAnchor = offset / previousHeight;
    }
    const offset = this.leadingRowAnchor * rowHeight;
    if (this.geometryProbeEnabled) {
      this.onGeometryProbe(`request p=${progress} anchor=${this.leadingRowAnchor}` +
        ` previousHeight=${previousHeight} row=${rowHeight} offset=${offset}`);
    }
    this.motionLayoutRevision += 1;
    const revision = this.motionLayoutRevision;
    const openRevision = this.listPositioning.listOpenRevision;
    setTimeout((): void => {
      if (!this.positioningMounted || this.navigationActive || revision !== this.motionLayoutRevision ||
        openRevision !== this.listPositioning.listOpenRevision) return;
      try {
        // Preserve the same leading row as its layout height changes. This is
        // anchor maintenance, not a new open or a current-chapter recenter.
        this.listScroller.scrollTo({ xOffset: 0, yOffset: offset,
          animation: { duration: 0, curve: Curve.Linear } });
      } catch (_error) {}
    }, 0);
  }

  /**
   * Pure parameterized projection: tab, sort direction and search query are
   * always explicit arguments. Never reads a @State written in the same event
   * — the device runtime can still expose the previous value there.
   */
  private rebuildProjection(tab: string, ascending: boolean, query: string): void {
    // Use the admitted snapshot, never the transient prop value. The host
    // intentionally sends an empty sentinel while the control is hidden; the
    // snapshot keeps the already-painted directory rows alive until a real
    // data/session commit reaches a stable endpoint.
    const sourceEntries = this.mangaSearch ? mangaDirectoryContextEntries(this.admittedEntries, mangaDirectoryPresentation(this.admittedEntries)) : this.admittedEntries;
    if (tab === 'bookmarks') {
      this.projectedEntries = [];
      this.bookmarkTabLoading = readerBookmarkLoadState(sourceEntries) === 'loading';
      this.projectedBookmarks = projectReaderBookmarkRows(
        sourceEntries, query, this.bookmarkIdentity);
      return;
    }
    this.projectedEntries = projectReaderDirectoryEntries(sourceEntries, query, ascending, this.mangaSearch);
    this.projectedBookmarks = [];
    this.bookmarkTabLoading = false;
  }

  private scheduleProjectionTopScroll(): void {
    this.onListUserScroll();
    this.projectionScrollGeneration += 1;
    const generation = this.projectionScrollGeneration;
    setTimeout((): void => {
      if (generation !== this.projectionScrollGeneration) {
        return;
      }
      this.listScroller.scrollEdge(Edge.Top);
    }, 0);
  }

  private cancelProjectionTopScroll(): void {
    this.onListUserScroll();
    this.projectionScrollGeneration += 1;
  }

  private searchPlaceholder(): string {
    return this.activeTab === 'bookmarks' ? '搜索书签内容' : '搜索章节名称';
  }

  private panelWidth(): number {
    if (this.panelWidthOverride > 0) {
      return this.panelWidthOverride;
    }
    return this.embeddedInControl ? this.controlValue(286, 338) : (this.expandedLayout ? 720 : 364);
  }

  private innerWidth(): number {
    if (this.embeddedInControl || this.detailPage) return this.panelWidth();
    return Math.max(0, this.panelWidth() - 26);
  }

  private panelHeight(): number {
    if (this.panelHeightOverride >= 0) {
      return this.panelHeightOverride;
    }
    return this.embeddedInControl ? this.controlValue(190, 666) : (this.expandedLayout ? 852 : 736);
  }

  private fontScale(): number {
    this.readerWindowMetricsRevision;
    return readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }
  private panelHeaderHeight(): number { return readerScaledControlHeight(30, 20, this.fontScale()); }
  private collapseHeight(): number {
    return readerScaledControlHeight(26, TYPE_READER_DIRECTORY_COLLAPSE.lineHeightFp as number, this.fontScale());
  }
  private catalogToolbar(): boolean { return this.standaloneCatalog && !this.embeddedInControl && this.activeTab === 'directory'; }
  private queryHeight(): number {
    return readerCompactSearchHeight(DIRECTORY_TOOL_SIZE, TYPE_SEARCH_DIRECTORY_INPUT.lineHeightFp as number, this.fontScale());
  }
  private tabStripHeight(): number { return this.tabHeight() + 6; }
  private toolbarInputMinimumWidth(): number {
    const scale = this.fontScale();
    const ready = readerFontFamilyReady(TYPE_SEARCH_DIRECTORY_INPUT.fontFamily);
    const key = `${this.searchPlaceholder()}:${this.readerWindowMetricsRevision}:${ready}`;
    if (key === this.toolbarInputWidthKey) return this.toolbarInputWidthCached;
    const fallback = Math.max(44, TYPE_SEARCH_DIRECTORY_INPUT.fontSizeFp * 6 * scale);
    if (!ready) return fallback;
    const context = this.getUIContext();
    const placeholder = measureReaderControlText(context, this.searchPlaceholder(), TYPE_SEARCH_DIRECTORY_INPUT, this.innerWidth());
    const glyph = measureReaderControlText(context, '字', TYPE_SEARCH_DIRECTORY_INPUT, this.innerWidth());
    if (placeholder === undefined || glyph === undefined) return fallback;
    const width = Math.max(fallback, Math.min(placeholder.singleLineWidthVp, glyph.singleLineWidthVp * 6));
    this.toolbarInputWidthKey = key;
    this.toolbarInputWidthCached = width;
    return width;
  }
  private searchControlsHeight(): number {
    const catalog = this.catalogToolbar();
    return readerDirectoryToolbarBudget(this.innerWidth(), this.activeTab === 'directory',
      this.queryHeight(), this.toolbarInputMinimumWidth(), 0, catalog).height + (this.embeddedInControl ? 0 : 1);
  }
  private embeddedToolbarGrowth(): number {
    return (this.searchControlsHeight() - 52) * this.controlProgress();
  }
  private heights(): ReaderFullDirectoryHeights {
    const heights = readerFullDirectoryHeights(this.panelHeight());
    const headerGrowth = this.panelHeaderHeight() - 30;
    const queryGrowth = this.searchControlsHeight() - (this.embeddedInControl ? 52 : 51);
    const tabGrowth = this.tabStripHeight() - 42;
    return { panel: heights.panel, content: heights.content, body: Math.max(0, heights.body - headerGrowth),
      chapterList: Math.max(0, heights.chapterList - headerGrowth - queryGrowth - tabGrowth - this.standaloneFooterHeight() + 48),
      bookmarkList: Math.max(0, heights.bookmarkList - headerGrowth - queryGrowth - tabGrowth) };
  }

  private contentHeight(): number {
    return this.heights().content;
  }

  private bodyContentHeight(): number {
    if (this.embeddedInControl) return this.panelHeight();
    return this.heights().body;
  }

  private chapterListHeight(): number {
    if (this.standaloneShort()) return Math.max(0, this.standaloneAvailableHeight() - this.standaloneEditorHeight());
    if (this.detailPage) return Math.max(0, this.panelHeight() - this.standaloneEditorHeight() - this.standaloneFooterHeight());
    if (this.embeddedInControl) {
      return Math.max(0, this.panelHeight() - this.controlValue(48, 99) - this.embeddedToolbarGrowth() - 48 * this.controlProgress() - 1);
    }
    return this.heights().chapterList;
  }

  private bookmarkListHeight(): number {
    if (this.standaloneShort()) return Math.max(0, this.standaloneAvailableHeight() - this.standaloneEditorHeight());
    if (this.detailPage) return Math.max(0, this.panelHeight() - this.standaloneEditorHeight());
    if (this.embeddedInControl) return Math.max(0, this.panelHeight() - this.controlValue(47, 99) - this.embeddedToolbarGrowth() - 1);
    return this.heights().bookmarkList;
  }

  private bookmarkBodyViewportHeight(): number {
    if (!this.embeddedInControl) return this.bookmarkListHeight();
    // Empty/loading/error states center inside their parent's height. Keep
    // that parent inside the visible Quick/Full clip, not the Full mount box.
    return Math.max(0, this.bookmarkContentHeightAt(this.controlProgress()) - this.controlValue(47, 99) - this.embeddedToolbarGrowth() - 1);
  }

  private gripLeft(): number {
    const figmaLeft = this.expandedLayout ? 489 : 134;
    return Math.min(figmaLeft, Math.max(0, this.panelWidth() - 42));
  }

  private controlProgress(): number {
    return Number.isFinite(this.motionProgress) ? Math.max(0, Math.min(1, this.motionProgress)) : 1;
  }

  private controlValue(quick: number, full: number): number {
    return quick + (full - quick) * this.controlProgress();
  }

  private directoryRowHeight(): number {
    return readerScaledControlHeight(44, 20, this.fontScale());
  }

  private directoryListRowHeight(): number {
    const progress = this.controlProgress();
    return this.embeddedInControl && progress > 0 && progress < 1 ?
      this.motionStableDirectoryRowHeight : this.directoryRowHeight();
  }

  private directoryViewportHeightAt(progress: number): number {
    if (!this.embeddedInControl) return this.chapterListHeight();
    return progress >= 1 ? Math.max(0, this.fullListHeight) : Math.max(0, this.quickListHeight);
  }

  private directoryListViewportHeight(): number {
    const progress = this.controlProgress();
    return this.embeddedInControl && progress > 0 && progress < 1 ?
      this.motionStableDirectoryViewportHeight : this.directoryViewportHeightAt(progress);
  }

  private directoryListWidth(): number {
    if (!this.embeddedInControl) return this.innerWidth();
    const progress = this.controlProgress();
    const endpoint = progress >= 1 ? this.fullListWidth : this.quickListWidth;
    return progress > 0 && progress < 1 ?
      (this.motionDirectionIncreasing ? this.fullListWidth : this.quickListWidth) : endpoint;
  }

  private directoryPaddingXAt(progress: number): number {
    if (!this.embeddedInControl) return TOK_SPACE_CONTROL_INLINE;
    return progress >= 1 ? 10 : 16;
  }

  private directoryListPaddingX(): number {
    const progress = this.controlProgress();
    return this.embeddedInControl && progress > 0 && progress < 1 ?
      this.motionStableDirectoryPaddingX : this.directoryPaddingXAt(progress);
  }

  /**
   * Resolve the bookmark content width at an arbitrary progress without
   * reading a future frame from the reactive host. ReaderControlPanel passes
   * the live content width; when endpoint props are not wired yet, the source
   * width track (252 -> 316 row width, i.e. 52vp panel delta) is extrapolated
   * from that current sample. This keeps the fallback responsive on phones
   * and tablets instead of baking one device's pixel values into the List.
   */
  private bookmarkContentWidthAt(progress: number): number {
    if (!this.embeddedInControl) return this.innerWidth();
    const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 1));
    const currentProgress = this.controlProgress();
    const currentWidth = this.panelWidthOverride > 0 ? this.panelWidthOverride : this.controlValue(286, 338);
    const quick = this.controlQuickContentWidth > 0 ? this.controlQuickContentWidth :
      (this.panelWidthOverride > 0 ? currentWidth - 52 * currentProgress : 286);
    const full = this.controlFullContentWidth > 0 ? this.controlFullContentWidth :
      (this.panelWidthOverride > 0 ? currentWidth + 52 * (1 - currentProgress) : 338);
    return Math.max(0, quick + (full - quick) * p);
  }

  private bookmarkContentHeightAt(progress: number): number {
    if (!this.embeddedInControl) return this.panelHeight();
    const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 1));
    const currentProgress = this.controlProgress();
    const quick = this.controlQuickContentHeight > 0 ? this.controlQuickContentHeight : 190;
    let full = this.controlFullContentHeight;
    if (!(full > 0)) {
      const currentHeight = this.panelHeightOverride > 0 ? this.panelHeightOverride :
        (this.expandedLayout ? 782 : 666);
      // The content track is linear. Infer the Full endpoint from any
      // non-zero sample; use the design fallback only at the exact Quick
      // endpoint where division would be undefined.
      full = currentProgress > 0.0001 ?
        quick + (currentHeight - quick) / currentProgress : (this.expandedLayout ? 782 : 666);
    }
    return Math.max(0, quick + (full - quick) * p);
  }

  private bookmarkVisualRowWidthAt(progress: number): number {
    const contentWidth = this.bookmarkContentWidthAt(progress);
    const padding = this.embeddedInControl ? this.bookmarkPaddingXAt(progress) : TOK_SPACE_CONTROL_INLINE;
    return Math.max(0, contentWidth - 2 - 2 * padding);
  }

  private bookmarkVisualRowHeight(progress: number): number {
    return this.embeddedInControl ?
      sampleReaderControlBookmark(progress, this.bookmarkVisualRowWidthAt(progress)).card.height : BOOKMARK_ROW_HEIGHT;
  }

  private bookmarkViewportWidthAt(progress: number): number {
    return this.embeddedInControl ? Math.max(0, this.bookmarkContentWidthAt(progress) - 2) : 0;
  }

  private bookmarkViewportHeightAt(progress: number): number {
    if (!this.embeddedInControl) return 0;
    const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 1));
    return Math.max(0, this.bookmarkContentHeightAt(p) - this.controlValueAt(47, 99, p) - 1);
  }

  private bookmarkPaddingXAt(progress: number): number {
    if (!this.embeddedInControl) return TOK_SPACE_CONTROL_INLINE;
    const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 1));
    return 15 + (10 - 15) * p;
  }

  private controlValueAt(quick: number, full: number, progress: number): number {
    const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 1));
    return quick + (full - quick) * p;
  }

  private bookmarkListLayoutRowHeight(): number {
    if (!this.embeddedInControl) return 0;
    const progress = this.controlProgress();
    return progress > 0 && progress < 1 ? this.motionStableBookmarkRowHeight :
      this.bookmarkVisualRowHeight(progress);
  }

  private bookmarkListLayoutViewportWidth(): number {
    if (!this.embeddedInControl) return 0;
    const progress = this.controlProgress();
    return progress > 0 && progress < 1 ? this.motionStableBookmarkViewportWidth :
      this.bookmarkViewportWidthAt(progress);
  }

  private bookmarkListLayoutViewportHeight(): number {
    if (!this.embeddedInControl) return 0;
    const progress = this.controlProgress();
    return progress > 0 && progress < 1 ? this.motionStableBookmarkViewportHeight :
      this.bookmarkViewportHeightAt(progress);
  }

  private bookmarkListLayoutPaddingX(): number {
    if (!this.embeddedInControl) return -1;
    const progress = this.controlProgress();
    return progress > 0 && progress < 1 ? this.motionStableBookmarkPaddingX : this.bookmarkPaddingXAt(progress);
  }

  private bookmarkRowWidth(): number {
    return Math.max(0, this.innerWidth() - 2 -
      2 * (this.embeddedInControl ? this.controlValue(15, 10) : TOK_SPACE_CONTROL_INLINE));
  }

  private standaloneBookmarkSize(): ReaderStandaloneBookmarkSize | undefined {
    if (this.embeddedInControl || this.readerWindowMetricsRevision < 0) return undefined;
    return measureReaderStandaloneBookmark(this.getUIContext(), this.bookmarkRowWidth(), this.fontScale());
  }

  private listRowHeight(tab: string): number {
    if (tab !== 'bookmarks') return this.directoryRowHeight();
    return this.embeddedInControl ?
      sampleReaderControlBookmark(this.controlProgress(), this.bookmarkRowWidth()).card.height :
      this.standaloneBookmarkSize()?.rowHeight ?? BOOKMARK_ROW_HEIGHT;
  }

  private tabHeight(): number {
    return readerScaledControlHeight(this.embeddedInControl ? 36 : 44,
      TYPE_READER_DIRECTORY_TAB.lineHeightFp as number, this.fontScale());
  }

  private embeddedTabWidth(): number {
    return Math.min(this.controlValue(127, 160), Math.max(0, (this.panelWidth() - 18) / 2));
  }

  private activeTabLineWidth(): number {
    const figmaWidth = this.expandedLayout ? 176 : 83;
    return Math.min(figmaWidth, Math.max(0, (this.innerWidth() - TOK_SPACE_XS * 2) / 2));
  }

  private isCurrent(entry: LocalReadingTocEntry): boolean {
    return entry.index === this.currentChapterIndex;
  }

  private currentEntry(): LocalReadingTocEntry | undefined {
    for (const entry of this.admittedEntries) {
      if (this.isCurrent(entry)) {
        return entry;
      }
    }
    return undefined;
  }

  private currentTitle(): string {
    const entry = this.currentEntry();
    if (entry === undefined) return '尚未开始阅读';
    return entry.title.trim().length > 0 && entry.title.trim() !== '第话' && entry.title.trim() !== '第 话' ?
      entry.title : `第${Math.max(1, entry.index + 1)}话`;
  }

  private currentPosition(): string {
    const entry = this.currentEntry();
    if (entry === undefined) {
      return '—';
    }
    let ordinal = 0;
    let count = 0;
    for (const chapter of this.admittedEntries) {
      if (chapter.navigable === false) continue;
      count += 1;
      if (chapter.index === entry.index) ordinal = count;
    }
    return ordinal === 0 ? '' : `${ordinal} / ${count}`;
  }
}
