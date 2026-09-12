import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import { sameReaderDirectoryData, snapshotReaderDirectoryData } from './ReaderDirectoryDataSnapshot';
import {
  readerDirectoryBookmarkMarkerState,
  type ReaderDirectoryBookmarkMarkerState,
  type ReaderDirectoryChapterStartBookmarkRequest,
} from './ReaderDirectoryMarkerState';
import {
  TOK_ACCENT,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_READ_ACTIVE_SOFT,
  TOK_READ_HANDLE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_READ_SURFACE,
  TOK_SPACE_CONTROL_INLINE,
  TOK_SPACE_SM,
  TOK_SPACE_XS,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
  TOK_BORDER_W,
} from '../common/ReaderTokens';

import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderSearchField } from '../common/ReaderSearchField';
import { projectReaderDirectoryEntries } from './ReaderDirectoryProjection';
import {
  projectReaderBookmarkRows,
  readerBookmarkLoadState,
  type ReaderBookIdentity,
  type ReaderBookmarkRowModel,
} from './ReaderBookmarkProjection';
import { ReaderDirectoryList } from './ReaderDirectoryList';
import { ReaderBookmarkList } from './ReaderBookmarkList';
import { ReaderBookmarkEmptyState } from './ReaderBookmarkEmptyState';
import { ReaderBookmarkLoadingState } from './ReaderBookmarkLoadingState';
import { ReaderBookmarkErrorState } from './ReaderBookmarkErrorState';
import { BOOKMARK_ROW_HEIGHT } from './ReaderBookmarkRow';
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
  @Prop @Watch('onEntriesChanged') entries: LocalReadingTocEntry[] = [];
  @Prop @Watch('onReadingAnchorChanged') currentChapterIndex: number = -1;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop isTablet: boolean = false;
  // The owner supplies the measured viewport-constrained width. Zero keeps
  // the source-exact standalone Figma endpoint.
  @Prop panelWidthOverride: number = 0;
  // ReaderShell lays out below the status bar. Phone full-sheet geometry is
  // therefore capped by the real host viewport while retaining the Figma
  // 20vp bottom anchor; zero keeps the source-exact standalone endpoint.
  @Prop panelHeightOverride: number = 0;
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
  @Prop @Watch('onMotionProgressChanged') motionProgress: number = 1;
  @Prop initialTab: string = 'directory';
  // The control keeps this panel mounted across quick/full transitions. A
  // new key therefore means a genuinely new open session (and is the only
  // safe point to re-center the virtual list). Watching it avoids stale
  // chapter/bookmark positions after the panel is reopened without
  // remounting the native List.
  @Prop @Watch('onListSessionKeyChanged') listSessionKey: string = '';
  onTabChange: (tab: string) => void = (_tab: string): void => {};
  onGeometryProbe: (event: string) => void = (_event: string): void => {};
  @Prop geometryProbeEnabled: boolean = false;
  @State private activeTab: string = 'directory';
  @State private searchDraft: string = '';
  @State private searchQuery: string = '';
  @State private ascending: boolean = true;
  @State private projectedEntries: LocalReadingTocEntry[] = [];
  @State private projectedBookmarks: ReaderBookmarkRowModel[] = [];
  @State private bookmarkTabLoading: boolean = false;
  // Optional stable book identity supplied by the owner. Undefined keeps the
  // session-scoped bookmark ids until the host wires full identity hand-off.
  bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  // Exact-offset bookmark selection. Undefined until the owner wires it; the
  // row tap then degrades to opening the chapter start (legacy behavior).
  onSelectBookmark: ((bookmarkId: string, chapterIndex: number, chapterOffset: number) => void) | undefined =
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
  // AceList rebuilds its extent whenever ChildrenMainSize changes. Keep the
  // real directory rows at the transition's source endpoint while p is
  // between 0 and 1; switch once at the settled endpoint and correct the
  // leading-row anchor there. The viewport/sheet still morphs continuously.
  private motionStableDirectoryRowHeight: number = 32;
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
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  // The marker is chapter-level while Core identities are bookmark-level.
  // Forward every existing identity represented by the marker so the owner
  // can perform explicit deletes and reload the projection without guessing.
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  // Creation stays disabled until an owner supplies the full book identity
  // required by bookmark.create and reloads the Core-backed projection.
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  // R-LOCAL-TOC-01: the owner resolves the correct return target. This panel
  // only emits the explicit collapse intent.
  onExit: () => void = (): void => {};

  aboutToAppear(): void {
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
    } else {
      this.standalonePanel();
    }
  }

  @Builder
  private standalonePanel() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('')
        .width(42)
        .height(4)
        .backgroundColor(TOK_READ_HANDLE)
        .borderRadius(999)
        .margin({ left: this.gripLeft(), top: 9 });

      Column({ space: TOK_SPACE_XS }) {
        this.panelHeader();
        this.directoryBody();
      }
      .width(this.innerWidth())
      .height(this.contentHeight())
      .margin({ left: 13, top: 6 });
    }
    .width(this.panelWidth())
    .height(this.panelHeight())
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(24)
    .clip(true);
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
        .backgroundColor(TOK_LINE)
        .position({ x: this.activeTab === 'bookmarks' ? 1 : this.controlValue(11, 1),
          y: this.activeTab === 'bookmarks' ? this.controlValue(50, 42) : this.controlValue(44, 42) })
        .opacity(this.activeTab === 'bookmarks' ? this.controlProgress() : 1);
      Stack({ alignContent: Alignment.TopStart }) {
        this.searchControls();
        // Figma 1689:2137 is a CHILD of Toolbar 1689:2125. Its local
        // y=51 plus 12->0 translation and opacity inherit the parent's
        // 18->0 translation/opacity; do not flatten these two actor tracks.
        Text('')
          .width(Math.max(0, this.panelWidth() - 2))
          .height(1)
          .backgroundColor(TOK_LINE)
          .position({ x: 0, y: this.controlValue(63, 51) })
          .opacity(this.controlProgress());
      }
      .width(Math.max(0, this.panelWidth() - 2))
      .height(52)
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
        .position({ x: 1, y: this.controlValue(47, 99) });
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
        .position({ x: 1, y: this.controlValue(48, 99) });
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
          Image($r('app.media.reader_directory_marker_bookmark'))
            .width(16)
            .height(16);
        } else {
          Image($r('app.media.reader_directory_directory'))
            .width(16)
            .height(16);
        }
        Text(this.activeTab === 'bookmarks' ? '书签' : '目录')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(14)
          .lineHeight(20)
          .fontColor(TOK_READ_INK);
      }
      .layoutWeight(1)
      .height(30)
      .alignItems(VerticalAlign.Center);

      Stack({ alignContent: Alignment.Center }) {
        Text('收起')
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .lineHeight(14)
          .fontColor(TOK_READ_PRIMARY)
          .textAlign(TextAlign.Center);
      }
      .width(40)
      .height(26)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .borderRadius(8)
      .accessibilityText('收起目录')
      .onClick((): void => this.onExit());
    }
    .width(this.innerWidth())
    .height(30)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private directoryBody() {
    Column() {
      this.tabs();
      this.searchControls();
      if (this.activeTab === 'bookmarks') {
        this.bookmarkBody();
      } else {
        this.chapterList();
        this.statusFooter();
      }
    }
    .width(this.innerWidth())
    .height(this.bodyContentHeight())
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(12)
    .clip(true);
  }

  @Builder
  private tabs() {
    Column({ space: 0 }) {
      Row() {
        this.directoryTab();
        this.bookmarkTab();
      }
      .width('100%')
      .height(41)
      .padding({ left: TOK_SPACE_XS, right: TOK_SPACE_XS, top: 5 });
      Text('')
        .width('100%')
        .height(1)
        .backgroundColor(TOK_LINE);
    }
    .width('100%')
    .height(42);
  }

  @Builder
  private directoryTab() {
    Stack({ alignContent: Alignment.Bottom }) {
      Row() {
        Text('目录')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(600)
          .fontSize(11)
          .lineHeight(16)
          .fontColor(this.activeTab === 'directory' ? TOK_READ_PRIMARY : TOK_READ_MUTED)
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
          .backgroundColor(TOK_READ_PRIMARY)
          .borderRadius(999);
      }
    }
    .layoutWeight(1)
    .height(this.tabHeight())
    .accessibilityText('目录')
    .onClick((): void => {
      if (this.activeTab === 'directory') {
        this.cancelProjectionTopScroll();
        this.listScroller.scrollEdge(Edge.Top);
        return;
      }
      this.switchTab('directory');
    });
  }

  @Builder
  private bookmarkTab() {
    Stack({ alignContent: Alignment.Bottom }) {
      Row({ space: 5 }) {
        if (this.activeTab === 'bookmarks') {
          Image($r('app.media.reader_directory_marker_bookmark_active'))
            .width(15)
            .height(15);
        } else {
          Image($r('app.media.reader_directory_marker_bookmark'))
            .width(15)
            .height(15);
        }
        Text('书签')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(600)
          .fontSize(11)
          .lineHeight(16)
          .fontColor(this.activeTab === 'bookmarks' ? TOK_READ_PRIMARY : TOK_READ_MUTED);
      }
      .width('100%')
      .height(this.tabHeight())
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center);
      if (this.activeTab === 'bookmarks') {
        Text('')
          .width(this.activeTabLineWidth())
          .height(2)
          .backgroundColor(TOK_READ_PRIMARY)
          .borderRadius(999);
      }
    }
    .layoutWeight(1)
    .height(this.tabHeight())
    .accessibilityText('书签')
    .onClick((): void => {
      if (this.activeTab === 'bookmarks') {
        this.cancelProjectionTopScroll();
        this.listScroller.scrollEdge(Edge.Top);
        return;
      }
      this.switchTab('bookmarks');
    });
  }

  @Builder
  private searchControls() {
    Column({ space: 0 }) {
      Row({ space: 5 }) {
        Row() {
          ReaderSearchField({
            variant: 'readerDirectory',
            mode: 'submit',
            text: this.searchDraft,
            placeholder: this.searchPlaceholder(),
            accessibilityLabel: this.searchPlaceholder(),
            onTextChange: (value: string): void => {
              this.searchDraft = value;
            },
            onSubmit: (): void => this.applySearch(),
          });
        }
        .layoutWeight(1)
        .height(32)
        .alignItems(VerticalAlign.Center);

        this.controlButton('search');
        if (this.activeTab === 'directory') {
          this.controlButton('top');
          this.controlButton('bottom');
          this.controlButton('sort');
        }
      }
      .width('100%')
      .height(50)
      .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE, top: 9 });
      if (!this.embeddedInControl) {
        Text('')
          .width('100%')
          .height(1)
          .backgroundColor(TOK_LINE);
      }
    }
    .width('100%')
    .height(this.embeddedInControl ? 52 : 51);
  }

  @Builder
  private controlButton(kind: string) {
    Stack({ alignContent: Alignment.Center }) {
      if (kind === 'search') {
        Image($r('app.media.reader_directory_search')).width(16).height(16);
      } else if (kind === 'top') {
        Image($r('app.media.reader_directory_top')).width(16).height(16);
      } else if (kind === 'bottom') {
        Image($r('app.media.reader_directory_bottom')).width(16).height(16);
      } else {
        if (this.ascending) {
          Image($r('app.media.reader_directory_sort_ascending'))
            .width(16)
            .height(16);
        } else {
          Image($r('app.media.reader_directory_sort_descending'))
            .width(16)
            .height(16);
        }
      }
    }
    .width(32)
    .height(32)
    .backgroundColor(TOK_SURFACE_PANEL_SOFT)
    .borderRadius(8)
    .accessibilityText(this.controlButtonLabel(kind))
    .onClick((): void => this.handleControl(kind));
  }

  @Builder
  private chapterList() {
    // The outer actor keeps the Full mount height. Centering its shorter
    // Quick viewport moves every row below the Stage's Quick clip.
    Stack({ alignContent: Alignment.TopStart }) {
      Column() {
        ReaderDirectoryList({
        entries: this.projectedEntries,
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
          this.chapterRow(repeatItem);
        },
        });
      }
      .width(this.directoryListWidth())
      .height(this.directoryListViewportHeight())
    }
    .width('100%')
    .height(this.chapterListHeight())
    .clip(true)
    // Chapter rows are persistent Figma actors: they have no opacity track in
    // either direction.  Keep them painted while the asynchronous centering
    // command is pending; hiding the whole List here made the Quick directory
    // look empty and produced the f5->f6 reveal seam during expansion.
    .opacity(this.projectedEntries.length > 0 ? 1 : 0)
    .enabled(this.initialListPositionReady)
    .accessibilityLevel(this.initialListPositionReady ? 'auto' : 'no-hide-descendants')
    .hitTestBehavior(this.initialListPositionReady ? HitTestMode.Default : HitTestMode.None);
  }

  @Builder
  private chapterRow(repeatItem: RepeatItem<LocalReadingTocEntry>) {
    Row() {
      Row() {
        if (this.isCurrent(repeatItem.item)) {
            Text('')
            .width(3)
            .height(this.directoryListRowHeight())
            .backgroundColor(TOK_ACCENT)
            .borderRadius(999);
        }
        Stack({ alignContent: Alignment.Center }) {
          Text(repeatItem.item.title)
            .width('100%')
            .padding({ left: 9, right: 9 })
            .fontFamily('ReaderInter')
            .fontWeight(500)
            .fontSize(11)
            .fontColor(TOK_READ_INK)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .layoutWeight(1)
        .height(this.directoryListRowHeight());
      }
      .layoutWeight(1)
      .height(this.directoryListRowHeight())
      .accessibilityText(`打开章节：${repeatItem.item.title}`)
      .onClick((): void => this.onSelectChapter(repeatItem.item.index));
      if (this.chapterDownloadEnabled && repeatItem.item.downloadState !== 'unknown') {
        this.downloadMarkerHitTarget(repeatItem.item);
      }
      if (repeatItem.item.bookmarks !== undefined) {
        this.bookmarkMarkerHitTarget(repeatItem.item);
      }
    }
    .width('100%')
    .height(this.directoryListRowHeight())
    .backgroundColor(this.isCurrent(repeatItem.item) ? TOK_READ_ACTIVE_SOFT : Color.Transparent)
    .borderRadius(6);
  }

  /**
   * Explicit tab switch: the projection always receives the next tab value.
   * Never reads the freshly written `activeTab` back — on the device runtime
   * that read can still expose the previous value, keeping the old projection.
   */
  private switchTab(nextTab: string): void {
    this.activeTab = nextTab;
    this.rebuildProjection(nextTab, this.ascending, this.searchQuery);
    this.beginListPositioning(nextTab);
    this.onTabChange(nextTab);
  }

  private selectBookmark(bookmarkId: string, chapterIndex: number, chapterOffset: number): void {
    if (this.onSelectBookmark !== undefined) {
      this.onSelectBookmark(bookmarkId, chapterIndex, chapterOffset);
      return;
    }
    // Legacy fallback until the owner wires exact-offset selection.
    this.onSelectChapter(chapterIndex);
  }

  @Builder
  private bookmarkBody() {
    Column() {
      if (this.bookmarkLoadFailed) {
        ReaderBookmarkErrorState({
          message: this.bookmarkLoadMessage.length > 0 ? this.bookmarkLoadMessage : '书签载入失败，请稍后重试',
          onRetry: (): void => this.onRetryBookmarkLoad(),
        });
      } else if (this.bookmarkTabLoading) {
        ReaderBookmarkLoadingState();
      } else if (this.projectedBookmarks.length === 0) {
        ReaderBookmarkEmptyState({
          onReturnToDirectory: (): void => this.switchTab('directory'),
        });
      } else {
        ReaderBookmarkList({
          rows: this.projectedBookmarks,
          embeddedInControl: this.embeddedInControl,
          motionProgress: this.controlProgress(),
          rowWidth: this.bookmarkRowWidth(),
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
          onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number): void => {
            this.selectBookmark(bookmarkId, chapterIndex, chapterOffset);
          },
        })
        // Bookmark cards are persistent actors as well; only their input is
        // gated until the initial positioning command is committed.
        .opacity(this.projectedBookmarks.length > 0 ? 1 : 0)
        .enabled(this.initialListPositionReady)
        .accessibilityLevel(this.initialListPositionReady ? 'auto' : 'no-hide-descendants')
        .hitTestBehavior(this.initialListPositionReady ? HitTestMode.Default : HitTestMode.None);
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
  private downloadMarkerHitTarget(entry: LocalReadingTocEntry) {
    Stack({ alignContent: Alignment.Center }) {
      Image($r(`app.media.${this.downloadMarker(entry)}`))
        .width(15)
        .height(15);
    }
    .width(26)
    .height(26)
    .borderRadius(6)
    .enabled(this.chapterDownloadEnabled && this.downloadMarkerEnabled(entry))
    .accessibilityText(this.downloadMarkerLabel(entry))
    .onClick((): void => this.onDownloadChapter(entry.index));
  }

  @Builder
  private bookmarkMarkerHitTarget(entry: LocalReadingTocEntry) {
    Stack({ alignContent: Alignment.Center }) {
      Image($r(`app.media.${this.bookmarkMarker(entry)}`))
        .width(15)
        .height(15);
    }
    .width(26)
    .height(26)
    .backgroundColor(this.hasBookmark(entry) ? TOK_READ_ACTIVE_SOFT : Color.Transparent)
    .borderRadius(6)
    .margin({ right: 5 })
    .enabled(this.bookmarkMarkerEnabled(readerDirectoryBookmarkMarkerState(entry)))
    .accessibilityText(this.bookmarkMarkerLabel(readerDirectoryBookmarkMarkerState(entry)))
    .onClick((): void => {
      const markerState = readerDirectoryBookmarkMarkerState(entry);
      if (markerState.kind === 'bookmarked') {
        this.onDeleteBookmarks(markerState.bookmarkTimes);
      } else if (markerState.kind === 'empty' && this.chapterStartBookmarkCreationEnabled) {
        this.onCreateChapterStartBookmark(markerState.createRequest);
      }
    });
  }

  @Builder
  private statusFooter() {
    Column({ space: 0 }) {
      Text('')
        .width('100%')
        .height(1)
        .backgroundColor(TOK_LINE);
      Row({ space: TOK_SPACE_CONTROL_INLINE }) {
        Text(this.currentTitle())
          .layoutWeight(1)
          .constraintSize({ minWidth: 0 })
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(11)
          .fontColor(TOK_READ_INK)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis });

        Text(this.currentPosition())
          .flexShrink(0)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .fontColor(TOK_READ_MUTED)
          .maxLines(1)
          .textAlign(TextAlign.End);
      }
      .width('100%')
      .height(47)
      .padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: 1 })
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .alignItems(VerticalAlign.Center);
    }
    .width('100%')
    .height(48);
  }

  private applySearch(): void {
    const nextQuery = this.searchDraft.trim();
    this.searchQuery = nextQuery;
    this.rebuildProjection(this.activeTab, this.ascending, nextQuery);
    this.scheduleProjectionTopScroll();
  }

  private handleControl(kind: string): void {
    if (kind === 'search') {
      this.applySearch();
      return;
    }
    if (kind === 'top') {
      this.cancelProjectionTopScroll();
      this.listScroller.scrollEdge(Edge.Top);
      return;
    }
    if (kind === 'bottom') {
      this.cancelProjectionTopScroll();
      this.listScroller.scrollEdge(Edge.Bottom);
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

  private controlButtonLabel(kind: string): string {
    if (kind === 'search') {
      return this.activeTab === 'bookmarks' ? '搜索书签内容' : '搜索章节';
    }
    if (kind === 'top') {
      return '回到目录顶部';
    }
    if (kind === 'bottom') {
      return '前往目录底部';
    }
    return this.ascending ? '按章节倒序排列' : '按章节正序排列';
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
    if (sameReaderDirectoryData(this.admittedEntries, this.entries)) {
      // The producer may have emitted a transient replacement and then
      // restored the admitted snapshot before the morph settled. Do not let
      // that obsolete pending copy win at the endpoint.
      this.pendingEntries = undefined;
      return;
    }
    this.pendingEntries = snapshotReaderDirectoryData(this.entries);
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
      this.admittedEntries = queuedEntries as LocalReadingTocEntry[];
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
      this.awaitingReadingAnchor = true;
      this.listPositioning = endReaderControlListOpen(this.listPositioning);
      return;
    }
    this.awaitingReadingAnchor = false;
    const sessionKey = this.listSessionKey.length > 0 ? this.listSessionKey : 'mounted-directory';
    this.listPositioning = beginReaderControlListOpen(this.listPositioning, `${sessionKey}:${tab}`, ordinal);
    this.scheduleOpenPositioning();
  }

  private onListViewportChanged(height: number): void {
    this.listViewportHeight = height;
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
  }

  private onListUserScroll(): void {
    this.listPositioning = markReaderControlListUserScrolled(
      this.listPositioning, this.listPositioning.listOpenRevision);
    this.leadingRowAnchor = undefined;
    this.projectionRestoreOffset = undefined;
    this.awaitingReadingAnchor = false;
    this.initialListPositionReady = true;
    this.motionLayoutRevision += 1;
    this.projectionScrollGeneration += 1;
  }

  private scheduleOpenPositioning(): void {
    if (!this.positioningMounted || this.listPositioning.status !== 'pending') return;
    const openRevision = this.listPositioning.listOpenRevision;
    const generation = this.projectionScrollGeneration;
    setTimeout((): void => {
      if (!this.positioningMounted || generation !== this.projectionScrollGeneration ||
        openRevision !== this.listPositioning.listOpenRevision || this.listViewportHeight <= 0) return;
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
        paddingTop: padding,
        paddingBottom: padding,
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
    }, 0);
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
    const progress = this.controlProgress();
    if (!this.positioningMounted) return;
    this.deferredMotionProgress = progress;
    this.scheduleDeferredMutationFlush();
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
      if (!this.positioningMounted || revision !== this.motionLayoutRevision ||
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
    const sourceEntries = this.admittedEntries;
    if (tab === 'bookmarks') {
      this.projectedEntries = [];
      this.bookmarkTabLoading = readerBookmarkLoadState(sourceEntries) === 'loading';
      this.projectedBookmarks = projectReaderBookmarkRows(
        sourceEntries, query, this.bookmarkIdentity);
      return;
    }
    this.projectedEntries = projectReaderDirectoryEntries(sourceEntries, query, ascending);
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

  private hasBookmark(entry: LocalReadingTocEntry): boolean {
    return entry.bookmarks !== undefined && entry.bookmarks.length > 0;
  }

  private downloadMarker(entry: LocalReadingTocEntry): string {
    return entry.downloadState === 'completed' ?
      'reader_directory_marker_check' : 'reader_directory_marker_download';
  }

  private downloadMarkerLabel(entry: LocalReadingTocEntry): string {
    if (entry.downloadState === 'completed' ||
      (!this.chapterDownloadEnabled && entry.downloadState === 'cached')) {
      return '已下载';
    }
    if (entry.downloadState === 'cached') {
      return '正文已缓存，补齐离线资源';
    }
    if (entry.downloadState === 'queued') {
      return '等待下载';
    }
    if (entry.downloadState === 'inProgress') {
      return '下载中';
    }
    if (entry.downloadState === 'failed') {
      return '下载失败，点按重试';
    }
    if (entry.downloadState === 'cancelled') {
      return '下载已取消，点按重试';
    }
    return '未下载，点按下载';
  }

  private downloadMarkerEnabled(entry: LocalReadingTocEntry): boolean {
    return entry.downloadState === 'missing' || entry.downloadState === 'cached' ||
      entry.downloadState === 'failed' || entry.downloadState === 'cancelled';
  }

  private bookmarkMarkerEnabled(state: ReaderDirectoryBookmarkMarkerState): boolean {
    return state.kind === 'bookmarked' ||
      (state.kind === 'empty' && this.chapterStartBookmarkCreationEnabled);
  }

  private bookmarkMarkerLabel(state: ReaderDirectoryBookmarkMarkerState): string {
    if (state.kind === 'bookmarked') {
      return '删除本章已有书签';
    }
    if (state.kind === 'empty' && this.chapterStartBookmarkCreationEnabled) {
      return '添加本章章首书签';
    }
    return state.kind === 'unknown' ? '书签状态尚未载入' : '当前章节不支持添加书签';
  }

  private bookmarkMarker(entry: LocalReadingTocEntry): string {
    return this.hasBookmark(entry) ?
      'reader_directory_marker_bookmark_active' : 'reader_directory_marker_bookmark';
  }

  private panelWidth(): number {
    if (this.panelWidthOverride > 0) {
      return this.panelWidthOverride;
    }
    return this.embeddedInControl ? this.controlValue(286, 338) : (this.isTablet ? 720 : 364);
  }

  private innerWidth(): number {
    if (this.embeddedInControl) return this.panelWidth();
    return Math.max(0, this.panelWidth() - 26);
  }

  private panelHeight(): number {
    if ((this.embeddedInControl || !this.isTablet) && this.panelHeightOverride > 0) {
      return this.panelHeightOverride;
    }
    return this.embeddedInControl ? this.controlValue(190, 666) : (this.isTablet ? 852 : 736);
  }

  private contentHeight(): number {
    return Math.max(298, this.panelHeight() - 32);
  }

  private bodyContentHeight(): number {
    if (this.embeddedInControl) return this.panelHeight();
    return Math.max(260, this.contentHeight() - 38);
  }

  private chapterListHeight(): number {
    if (this.embeddedInControl) {
      return Math.max(0, this.panelHeight() - this.controlValue(48, 99) - 48 * this.controlProgress() - 1);
    }
    return Math.max(117, this.bodyContentHeight() - 143);
  }

  private bookmarkListHeight(): number {
    if (this.embeddedInControl) return Math.max(0, this.panelHeight() - this.controlValue(47, 99) - 1);
    return Math.max(117, this.bodyContentHeight() - 93);
  }

  private bookmarkBodyViewportHeight(): number {
    if (!this.embeddedInControl) return this.bookmarkListHeight();
    // Empty/loading/error states center inside their parent's height. Keep
    // that parent inside the visible Quick/Full clip, not the Full mount box.
    return Math.max(0, this.bookmarkContentHeightAt(this.controlProgress()) - this.controlValue(47, 99) - 1);
  }

  private gripLeft(): number {
    const figmaLeft = this.isTablet ? 489 : 134;
    return Math.min(figmaLeft, Math.max(0, this.panelWidth() - 42));
  }

  private controlProgress(): number {
    return Number.isFinite(this.motionProgress) ? Math.max(0, Math.min(1, this.motionProgress)) : 1;
  }

  private controlValue(quick: number, full: number): number {
    return quick + (full - quick) * this.controlProgress();
  }

  private directoryRowHeight(): number {
    return this.embeddedInControl ? this.controlValue(32, 40) : 40;
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
        (this.isTablet ? 782 : 666);
      // The content track is linear. Infer the Full endpoint from any
      // non-zero sample; use the design fallback only at the exact Quick
      // endpoint where division would be undefined.
      full = currentProgress > 0.0001 ?
        quick + (currentHeight - quick) / currentProgress : (this.isTablet ? 782 : 666);
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

  private listRowHeight(tab: string): number {
    if (tab !== 'bookmarks') return this.directoryRowHeight();
    return this.embeddedInControl ?
      sampleReaderControlBookmark(this.controlProgress(), this.bookmarkRowWidth()).card.height : BOOKMARK_ROW_HEIGHT;
  }

  private tabHeight(): number {
    return this.embeddedInControl ? this.controlValue(31, 36) : 36;
  }

  private embeddedTabWidth(): number {
    return Math.min(this.controlValue(127, 160), Math.max(0, (this.panelWidth() - 18) / 2));
  }

  private activeTabLineWidth(): number {
    const figmaWidth = this.isTablet ? 176 : 83;
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
    return entry === undefined ? '' : entry.title;
  }

  private currentPosition(): string {
    const entry = this.currentEntry();
    if (entry === undefined) {
      return '';
    }
    let ordinal = 0;
    for (let index = 0; index < this.admittedEntries.length; index += 1) {
      if (this.admittedEntries[index].index === entry.index) {
        ordinal = index + 1;
        break;
      }
    }
    return ordinal === 0 ? '' : `${ordinal} / ${this.admittedEntries.length}`;
  }
}
