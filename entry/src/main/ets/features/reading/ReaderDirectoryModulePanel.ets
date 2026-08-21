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
const DIRECTORY_EDGE_FADE_COLOR = '#D9FFFCF8';
const DIRECTORY_EDGE_FADE_TRANSPARENT_COLOR = '#00FFFCF8';

/**
 * Figma Reader Module Directory / Phone (`943:9888`) content area only.
 * Bookmark/download markers appear only when the owning projection exposes
 * those facts; this component never fabricates them from a raw TOC row.
 */
@Component
export struct ReaderDirectoryModulePanel {
  @Prop @Watch('onInputsChanged') entries: LocalReadingTocEntry[] = [];
  @Prop @Watch('onInputsChanged') currentChapterIndex: number = -1;
  @Prop chapterDownloadEnabled: boolean = false;
  @State private activeTab: string = 'directory';
  @State private projectedEntries: LocalReadingTocEntry[] = [];
  private readonly listScroller: Scroller = new Scroller();
  private scrollReady: boolean = false;
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

  aboutToAppear(): void {
    this.rebuildProjection();
  }

  build() {
    Column() {
      this.tabs();
      Stack({ alignContent: Alignment.Top }) {
        List({ space: 0, scroller: this.listScroller }) {
          Repeat(this.projectedEntries)
            .each((repeatItem: RepeatItem<LocalReadingTocEntry>) => {
              ListItem() {
                this.chapterRow(repeatItem.item);
              }
              .width('100%')
              .height(READER_DIRECTORY_ROW_HEIGHT);
            })
            .key((entry: LocalReadingTocEntry): string => `reader-module-toc-${entry.index}`)
            // On the current phone runtime, reusable Repeat nodes cycle the
            // roughly 18 materialized rows through a long TOC without
            // refreshing their text. Keep lazy creation, but do not reuse
            // those chapter rows: Core's complete order remains untouched.
            .virtualScroll({ totalCount: this.projectedEntries.length, reusable: false });
        }
        .width('100%')
        .height(READER_DIRECTORY_VIEWPORT_HEIGHT)
        .constraintSize({ minHeight: READER_DIRECTORY_VIEWPORT_HEIGHT })
        .padding({
          left: DIRECTORY_LIST_PADDING_X,
          right: DIRECTORY_LIST_PADDING_X,
          top: READER_DIRECTORY_LIST_PADDING_Y,
          bottom: READER_DIRECTORY_LIST_PADDING_Y,
        })
        .scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None)
        .onAreaChange((_oldArea: Area, newArea: Area): void => {
          // First real layout: reproduce the make's initial scroll so the
          // current chapter row lands centered (viewport/2 + 3px py padding).
          if (!this.scrollReady && (newArea.height as number) > 0) {
            this.scrollReady = true;
            this.scheduleCenterScroll();
          }
        });
        if (this.shouldShowEdgeFade()) {
          Column() {
            Row()
              .width('100%')
              .height(READER_DIRECTORY_EDGE_FADE_HEIGHT)
              .linearGradient({
                direction: GradientDirection.Bottom,
                colors: [[DIRECTORY_EDGE_FADE_COLOR, 0], [DIRECTORY_EDGE_FADE_TRANSPARENT_COLOR, 1]],
              });
            Blank()
              .layoutWeight(1);
            Row()
              .width('100%')
              .height(READER_DIRECTORY_EDGE_FADE_HEIGHT)
              .linearGradient({
                direction: GradientDirection.Top,
                colors: [[DIRECTORY_EDGE_FADE_COLOR, 0], [DIRECTORY_EDGE_FADE_TRANSPARENT_COLOR, 1]],
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
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
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
            .fontColor(this.activeTab === 'directory' ? TOK_READ_PRIMARY : TOK_READ_MUTED)
            .textAlign(TextAlign.Center);
          if (this.activeTab === 'directory') {
            Row()
              .width(DIRECTORY_TAB_INDICATOR_WIDTH)
              .height(DIRECTORY_TAB_INDICATOR_HEIGHT)
              .backgroundColor(TOK_READ_PRIMARY)
              .borderRadius(TOK_RADIUS_PILL);
          }
        }
        .layoutWeight(1)
        .height(DIRECTORY_TAB_ROW_HEIGHT)
        .accessibilityText('目录')
        .onClick((): void => {
          this.activeTab = 'directory';
          this.rebuildProjection();
          this.scheduleCenterScroll();
        });

        Stack({ alignContent: Alignment.Bottom }) {
          Text('书签')
            .width('100%')
            .height(DIRECTORY_TAB_ROW_HEIGHT)
            .fontFamily('ReaderInter')
            .fontWeight(500)
            .fontSize(10)
            .fontColor(this.activeTab === 'bookmarks' ? TOK_READ_PRIMARY : TOK_READ_MUTED)
            .textAlign(TextAlign.Center);
          if (this.activeTab === 'bookmarks') {
            Row()
              .width(DIRECTORY_TAB_INDICATOR_WIDTH)
              .height(DIRECTORY_TAB_INDICATOR_HEIGHT)
              .backgroundColor(TOK_READ_PRIMARY)
              .borderRadius(TOK_RADIUS_PILL);
          }
        }
        .layoutWeight(1)
        .height(DIRECTORY_TAB_ROW_HEIGHT)
        .accessibilityText('书签')
        .onClick((): void => {
          this.activeTab = 'bookmarks';
          this.rebuildProjection();
          this.scheduleCenterScroll();
        });
      }
      .width('100%')
      .height(DIRECTORY_TAB_ROW_HEIGHT)
      .padding({ left: DIRECTORY_TAB_INLINE_PADDING, right: DIRECTORY_TAB_INLINE_PADDING });
      Row()
        .width('100%')
        .height(DIRECTORY_TAB_DIVIDER_HEIGHT)
        .backgroundColor(TOK_LINE);
    }
    .width('100%')
    .height(DIRECTORY_TABS_HEIGHT);
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    Row() {
      Row() {
        if (this.isCurrent(entry)) {
          Row()
            .width(DIRECTORY_CURRENT_BAR_WIDTH)
            .height(READER_DIRECTORY_ROW_HEIGHT)
            .backgroundColor(TOK_ACCENT)
            .borderRadius(TOK_RADIUS_PILL);
        }
        Stack({ alignContent: Alignment.Center }) {
          Text(entry.title)
            .width('100%')
            .padding({ left: this.isCurrent(entry) ? 5 : 8, right: 8 })
            .fontFamily('ReaderInter')
            .fontWeight(500)
            .fontSize(11)
            .lineHeight(12.32)
            .fontColor(this.titleColor(entry))
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .layoutWeight(1)
        .height(READER_DIRECTORY_ROW_HEIGHT);
      }
      .layoutWeight(1)
      .height(READER_DIRECTORY_ROW_HEIGHT)
      .accessibilityText(`打开章节：${entry.title}`)
      .onClick((): void => this.onSelectChapter(entry.index));
      this.statusMarkerHitTarget(entry);
      this.bookmarkMarkerHitTarget(entry);
    }
    .width('100%')
    .height(READER_DIRECTORY_ROW_HEIGHT)
    .backgroundColor(this.isCurrent(entry) ? TOK_READ_ACTIVE_SOFT : Color.Transparent)
    .border({ width: { top: 1 }, color: TOK_LINE })
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
    .backgroundColor(TOK_SURFACE_PANEL_SOFT)
    .borderRadius(TOK_RADIUS_PILL)
    .enabled(this.chapterDownloadEnabled && this.downloadMarkerEnabled(entry))
    .accessibilityText(this.downloadMarkerLabel(entry))
    .onClick((): void => this.onDownloadChapter(entry.index));
  }

  @Builder
  private statusMarkerHitTarget(entry: LocalReadingTocEntry) {
    if (this.isRead(entry)) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_directory_marker_check'))
          .width(DIRECTORY_MARKER_ICON_SIZE)
          .height(DIRECTORY_MARKER_ICON_SIZE);
      }
      .width(DIRECTORY_MARKER_HIT_SIZE)
      .height(DIRECTORY_MARKER_HIT_SIZE)
      .backgroundColor('#1A2F6373')
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
        Image($r('app.media.reader_directory_marker_bookmark_active'))
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
    this.rebuildProjection();
    if (this.scrollReady) {
      this.scheduleCenterScroll();
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

  private rebuildProjection(): void {
    if (this.activeTab === 'directory') {
      this.projectedEntries = this.entries;
      return;
    }
    const bookmarkedEntries: LocalReadingTocEntry[] = [];
    for (const entry of this.entries) {
      if (this.hasBookmark(entry)) {
        bookmarkedEntries.push(entry);
      }
    }
    this.projectedEntries = bookmarkedEntries;
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
      return TOK_READ_PRIMARY;
    }
    if (this.currentChapterIndex >= 0 && entry.index < this.currentChapterIndex) {
      return TOK_READ_INK;
    }
    return TOK_READ_UNREAD;
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
}
