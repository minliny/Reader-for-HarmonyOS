import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import {
  readerDirectoryBookmarkMarkerState,
  type ReaderDirectoryBookmarkMarkerState,
  type ReaderDirectoryChapterStartBookmarkRequest,
} from './ReaderDirectoryMarkerState';
import {
  readerDirectoryIsScrollable,
  readerDirectoryScrollY,
  READER_DIRECTORY_EDGE_FADE_HEIGHT,
  READER_DIRECTORY_LIST_PADDING_Y,
  READER_DIRECTORY_ROW_HEIGHT,
  READER_DIRECTORY_VIEWPORT_HEIGHT,
} from './ReaderDirectoryScrollGeometry';
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
import {
  TOK_ACCENT,
  TOK_BORDER_W,
  TOK_LINE,
  TOK_READ_ACTIVE_SOFT,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_READ_UNREAD,
  TOK_RADIUS_MD,
  TOK_RADIUS_PILL,
  TOK_RADIUS_SM,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';

const DIRECTORY_PANEL_HEIGHT = 190;
const DIRECTORY_PANEL_PADDING_X = 11;
const DIRECTORY_PANEL_PADDING_TOP = 1;
const DIRECTORY_PANEL_PADDING_BOTTOM = 13;
const DIRECTORY_TABS_HEIGHT = 32;
const DIRECTORY_TAB_ROW_HEIGHT = 31;
const DIRECTORY_TAB_INLINE_PADDING = 5;
const DIRECTORY_TAB_DIVIDER_HEIGHT = 1;
const DIRECTORY_TAB_INDICATOR_WIDTH = 66;
const DIRECTORY_TAB_INDICATOR_HEIGHT = 2;
const DIRECTORY_LIST_PADDING_X = 6;
const DIRECTORY_CURRENT_BAR_WIDTH = 3;
const DIRECTORY_MARKER_HIT_SIZE = 26;
const DIRECTORY_MARKER_ICON_SIZE = 15;
const DIRECTORY_BOOKMARK_TRAILING_GAP = 3;

/**
 * Figma Reader Module Directory / Phone (`943:9888`) content area only.
 * Bookmark/download markers appear only when the owning projection exposes
 * those facts; this component never fabricates them from a raw TOC row.
 */
@Component
export struct ReaderDirectoryModulePanel {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop @Watch('onInputsChanged') entries: LocalReadingTocEntry[] = [];
  @Prop @Watch('onInputsChanged') currentChapterIndex: number = -1;
  @Prop chapterDownloadEnabled: boolean = false;
  @State private activeTab: string = 'directory';
  @State private projectedEntries: LocalReadingTocEntry[] = [];
  @State private bookmarkRows: ReaderBookmarkRowModel[] = [];
  @State private bookmarkTabLoading: boolean = false;
  private readonly listScroller: Scroller = new Scroller();
  private scrollReady: boolean = false;
  // Optional stable book identity supplied by the owner. Undefined keeps the
  // session-scoped bookmark ids until the host wires full identity hand-off.
  bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  // Exact-offset bookmark selection. Undefined until the owner wires it; the
  // row tap then degrades to opening the chapter start (legacy behavior).
  onSelectBookmark: ((bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope) => void) | undefined =
    undefined;
  onSelectChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  onDownloadChapter: (chapterIndex: number) => void = (_chapterIndex: number): void => {};
  // A filled chapter marker represents every existing Core bookmark projected
  // onto that chapter. An empty marker may emit only the exact chapter-start
  // request; the owner adds book identity and reloads after Core confirmation.
  onDeleteBookmarks: (bookmarkTimes: number[]) => void = (_bookmarkTimes: number[]): void => {};
  // Creation stays disabled until the owning reading transaction supplies
  // book identity and refreshes the projection after Core confirmation.
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  // Error is owner-driven: the data contract has no bookmark error channel.
  @Prop bookmarkLoadFailed: boolean = false;
  onRetryBookmarkLoad: () => void = (): void => {};

  aboutToAppear(): void {
    this.rebuildProjection(this.activeTab);
  }

  build() {
    Column() {
      this.tabs();
      Stack({ alignContent: Alignment.Top }) {
        if (this.activeTab === 'bookmarks') {
          this.bookmarkBody();
        } else {
          ReaderDirectoryList({
            entries: this.projectedEntries,
            rowHeight: READER_DIRECTORY_ROW_HEIGHT,
            listPaddingX: DIRECTORY_LIST_PADDING_X,
            listPaddingY: READER_DIRECTORY_LIST_PADDING_Y,
            edgeEffectMode: EdgeEffect.None,
            scroller: this.listScroller,
            onFirstLayout: (): void => {
              this.scrollReady = true;
              this.scheduleCenterScroll();
            },
            rowBuilder: (repeatItem: RepeatItem<LocalReadingTocEntry>) => {
              this.chapterRow(repeatItem);
            },
          })
        }
        if (this.shouldShowEdgeFade()) {
          Column() {
            Row()
              .width('100%')
              .height(READER_DIRECTORY_EDGE_FADE_HEIGHT)
              .linearGradient({
                direction: GradientDirection.Bottom,
                colors: [[readerAppColor('app.ReaderDirectoryModulePanel.DIRECTORY_EDGE_FADE_COLOR', this.appThemeScheme), 0], [readerAppColor('app.ReaderDirectoryModulePanel.DIRECTORY_EDGE_FADE_TRANSPARENT_COLOR', this.appThemeScheme), 1]],
              });
            Blank()
              .layoutWeight(1);
            Row()
              .width('100%')
              .height(READER_DIRECTORY_EDGE_FADE_HEIGHT)
              .linearGradient({
                direction: GradientDirection.Top,
                colors: [[readerAppColor('app.ReaderDirectoryModulePanel.DIRECTORY_EDGE_FADE_COLOR', this.appThemeScheme), 0], [readerAppColor('app.ReaderDirectoryModulePanel.DIRECTORY_EDGE_FADE_TRANSPARENT_COLOR', this.appThemeScheme), 1]],
              });
          }
          .width('100%')
          .height(READER_DIRECTORY_VIEWPORT_HEIGHT)
          .hitTestBehavior(HitTestMode.Transparent);
        }
      }
      .width('100%')
      .height(READER_DIRECTORY_VIEWPORT_HEIGHT)
      .clip(true);
    }
    .width('100%')
    .height(DIRECTORY_PANEL_HEIGHT)
    .padding({
      left: DIRECTORY_PANEL_PADDING_X,
      right: DIRECTORY_PANEL_PADDING_X,
      top: DIRECTORY_PANEL_PADDING_TOP,
      bottom: DIRECTORY_PANEL_PADDING_BOTTOM,
    })
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL', this.appThemeScheme))
    .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
    .borderRadius(TOK_RADIUS_MD)
    .clip(true);
  }

  @Builder
  private tabs() {
    Column() {
      Row() {
        Stack({ alignContent: Alignment.Bottom }) {
          Text('目录')
            .width('100%')
            .height(DIRECTORY_TAB_ROW_HEIGHT)
            .fontFamily('ReaderInter')
            .fontWeight(500)
            .fontSize(10)
            .fontColor(this.activeTab === 'directory' ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
            .textAlign(TextAlign.Center);
          if (this.activeTab === 'directory') {
            Row()
              .width(DIRECTORY_TAB_INDICATOR_WIDTH)
              .height(DIRECTORY_TAB_INDICATOR_HEIGHT)
              .backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
              .borderRadius(TOK_RADIUS_PILL);
          }
        }
        .layoutWeight(1)
        .height(DIRECTORY_TAB_ROW_HEIGHT)
        .accessibilityText('目录')
        .onClick((): void => {
          this.switchTab('directory');
        });

        Stack({ alignContent: Alignment.Bottom }) {
          Text('书签')
            .width('100%')
            .height(DIRECTORY_TAB_ROW_HEIGHT)
            .fontFamily('ReaderInter')
            .fontWeight(500)
            .fontSize(10)
            .fontColor(this.activeTab === 'bookmarks' ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
            .textAlign(TextAlign.Center);
          if (this.activeTab === 'bookmarks') {
            Row()
              .width(DIRECTORY_TAB_INDICATOR_WIDTH)
              .height(DIRECTORY_TAB_INDICATOR_HEIGHT)
              .backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme))
              .borderRadius(TOK_RADIUS_PILL);
          }
        }
        .layoutWeight(1)
        .height(DIRECTORY_TAB_ROW_HEIGHT)
        .accessibilityText('书签')
        .onClick((): void => {
          this.switchTab('bookmarks');
        });
      }
      .width('100%')
      .height(DIRECTORY_TAB_ROW_HEIGHT)
      .padding({ left: DIRECTORY_TAB_INLINE_PADDING, right: DIRECTORY_TAB_INLINE_PADDING });
      Row()
        .width('100%')
        .height(DIRECTORY_TAB_DIVIDER_HEIGHT)
        .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
    }
    .width('100%')
    .height(DIRECTORY_TABS_HEIGHT);
  }

  @Builder
  private chapterRow(repeatItem: RepeatItem<LocalReadingTocEntry>) {
    Row() {
      Row() {
        if (this.isCurrent(repeatItem.item)) {
          Row()
            .width(DIRECTORY_CURRENT_BAR_WIDTH)
            .height(READER_DIRECTORY_ROW_HEIGHT)
            .backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme))
            .borderRadius(TOK_RADIUS_PILL);
        }
        Stack({ alignContent: Alignment.Center }) {
          Text(repeatItem.item.title)
            .width('100%')
            .padding({ left: this.isCurrent(repeatItem.item) ? 5 : 8, right: 8 })
            .fontFamily('ReaderInter')
            .fontWeight(500)
            .fontSize(11)
            .lineHeight(12.32)
            .fontColor(this.titleColor(repeatItem.item))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .layoutWeight(1)
        .height(READER_DIRECTORY_ROW_HEIGHT);
      }
      .layoutWeight(1)
      .height(READER_DIRECTORY_ROW_HEIGHT)
      .accessibilityText(repeatItem.item.navigable === false ? `卷标题：${repeatItem.item.title}` : `打开章节：${repeatItem.item.title}`)
      .enabled(repeatItem.item.navigable !== false)
      .onClick((): void => { if (repeatItem.item.navigable !== false) this.onSelectChapter(repeatItem.item.index); });
      if (repeatItem.item.navigable !== false) {
        this.statusMarkerHitTarget(repeatItem.item);
        this.bookmarkMarkerHitTarget(repeatItem.item);
      }
    }
    .width('100%')
    .height(READER_DIRECTORY_ROW_HEIGHT)
    .backgroundColor(this.isCurrent(repeatItem.item) ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent)
    .border({ width: { top: 1 }, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
    .borderRadius(TOK_RADIUS_SM)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private downloadMarkerHitTarget(entry: LocalReadingTocEntry) {
    Stack({ alignContent: Alignment.Center }) {
      Image($r(`app.media.${this.downloadMarker(entry)}`))
        .width(DIRECTORY_MARKER_ICON_SIZE)
        .height(DIRECTORY_MARKER_ICON_SIZE);
    }
    .width(DIRECTORY_MARKER_HIT_SIZE)
    .height(DIRECTORY_MARKER_HIT_SIZE)
    .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme))
    .borderRadius(TOK_RADIUS_PILL)
    .enabled(entry.navigable !== false && this.chapterDownloadEnabled && this.downloadMarkerEnabled(entry))
    .accessibilityText(this.downloadMarkerLabel(entry))
    .onClick((): void => { if (entry.navigable !== false) this.onDownloadChapter(entry.index); });
  }

  @Builder
  private statusMarkerHitTarget(entry: LocalReadingTocEntry) {
    if (this.isRead(entry)) {
      Stack({ alignContent: Alignment.Center }) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')))
          .width(DIRECTORY_MARKER_ICON_SIZE)
          .height(DIRECTORY_MARKER_ICON_SIZE);
      }
      .width(DIRECTORY_MARKER_HIT_SIZE)
      .height(DIRECTORY_MARKER_HIT_SIZE)
      .backgroundColor(readerAppColor('app.ReaderDirectoryModulePanel.statusMarkerHitTarget.backgroundColor.1A2F6373', this.appThemeScheme))
      .borderRadius(TOK_RADIUS_PILL)
      .accessibilityText('已读');
    } else if (this.chapterDownloadEnabled) {
      this.downloadMarkerHitTarget(entry);
    }
  }

  @Builder
  private bookmarkMarkerHitTarget(entry: LocalReadingTocEntry) {
    Stack({ alignContent: Alignment.Center }) {
      if (this.hasBookmark(entry)) {
        Image((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')))
          .width(DIRECTORY_MARKER_ICON_SIZE)
          .height(DIRECTORY_MARKER_ICON_SIZE);
      }
    }
    .width(DIRECTORY_MARKER_HIT_SIZE)
    .height(DIRECTORY_MARKER_HIT_SIZE)
    .margin({ right: DIRECTORY_BOOKMARK_TRAILING_GAP })
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

  private onInputsChanged(): void {
    this.rebuildProjection(this.activeTab);
    if (this.scrollReady) {
      this.scheduleCenterScroll();
    }
  }

  /** Explicit tab switch: the projection always receives the next tab value. */
  private switchTab(nextTab: string): void {
    this.activeTab = nextTab;
    this.rebuildProjection(nextTab);
    this.scheduleCenterScroll();
  }

  private selectBookmark(bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void {
    if (this.onSelectBookmark !== undefined) {
      this.onSelectBookmark(bookmarkId, chapterIndex, chapterOffset, positionScope);
      return;
    }
    // Legacy fallback until the owner wires exact-offset selection.
    this.onSelectChapter(chapterIndex);
  }

  @Builder
  private bookmarkBody() {
    if (this.bookmarkLoadFailed) {
      ReaderBookmarkErrorState({
        onRetry: (): void => this.onRetryBookmarkLoad(),
      });
    } else if (this.bookmarkTabLoading) {
      ReaderBookmarkLoadingState();
    } else if (this.bookmarkRows.length === 0) {
      ReaderBookmarkEmptyState({
        onReturnToDirectory: (): void => this.switchTab('directory'),
      });
    } else {
      ReaderBookmarkList({
        rows: this.bookmarkRows,
        listPaddingX: DIRECTORY_LIST_PADDING_X,
        listPaddingY: READER_DIRECTORY_LIST_PADDING_Y,
        scroller: this.listScroller,
        onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope): void => {
          this.selectBookmark(bookmarkId, chapterIndex, chapterOffset, positionScope);
        },
      });
    }
  }

  private scheduleCenterScroll(): void {
    setTimeout((): void => {
      this.listScroller.scrollTo({
        xOffset: 0,
        yOffset: this.currentScrollY(),
        animation: { duration: 0, curve: Curve.Linear },
      });
    }, 0);
  }

  /**
   * Center the current row when possible, then clamp to both content bounds.
   * The shared viewport, row and padding values keep layout and math coupled.
   */
  private currentScrollY(): number {
    const entries = this.projectedEntries;
    if (entries.length === 0) {
      return 0;
    }
    let currentIndex = -1;
    for (let index = 0; index < entries.length; index += 1) {
      if (entries[index].index === this.currentChapterIndex) {
        currentIndex = index;
        break;
      }
    }
    if (currentIndex < 0) {
      return 0;
    }
    return readerDirectoryScrollY(entries.length, currentIndex);
  }

  private shouldShowEdgeFade(): boolean {
    return readerDirectoryIsScrollable(this.projectedEntries.length);
  }

  /**
   * Pure tab-parameterized projection. Never reads the freshly written
   * `activeTab` back: on the device runtime that read can still expose the
   * previous value, so callers must pass the tab explicitly.
   */
  private rebuildProjection(tab: string): void {
    if (tab === 'directory') {
      this.projectedEntries = this.entries;
      this.bookmarkRows = [];
      this.bookmarkTabLoading = false;
      return;
    }
    this.projectedEntries = [];
    this.bookmarkTabLoading = readerBookmarkLoadState(this.entries) === 'loading';
    this.bookmarkRows = projectReaderBookmarkRows(this.entries, '', this.bookmarkIdentity);
  }

  private isCurrent(entry: LocalReadingTocEntry): boolean {
    return entry.index === this.currentChapterIndex;
  }

  private isRead(entry: LocalReadingTocEntry): boolean {
    return this.currentChapterIndex >= 0 && entry.index < this.currentChapterIndex;
  }

  /**
   * make three-state title: current teal, read (before current) ink, unread
   * (after current) grey. The make models read purely by position relative to
   * the current chapter, so `currentChapterIndex` reproduces it exactly.
   */
  private titleColor(entry: LocalReadingTocEntry): ResourceColor {
    if (this.isCurrent(entry)) {
      return readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme);
    }
    if (this.currentChapterIndex >= 0 && entry.index < this.currentChapterIndex) {
      return readerAppColor('TOK_READ_INK', this.appThemeScheme);
    }
    return readerAppColor('TOK_READ_UNREAD', this.appThemeScheme);
  }

  private hasBookmark(entry: LocalReadingTocEntry): boolean {
    return entry.bookmarks !== undefined && entry.bookmarks.length > 0;
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

  private downloadMarker(entry: LocalReadingTocEntry): string {
    const resource = entry.downloadState === 'completed' ?
      'reader_directory_marker_check' : 'reader_directory_marker_download';
    return this.appThemeScheme === 'night' ? `${resource}_theme_night` : resource;
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
}
