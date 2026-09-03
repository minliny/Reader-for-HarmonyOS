import type { LocalReadingBookmark, LocalReadingTocEntry } from './LocalReadingFlowGateway';
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
import {
  projectReaderDirectoryBookmarks,
  projectReaderDirectoryEntries,
} from './ReaderDirectoryProjection';

const BOOKMARK_ROW_HEIGHT = 74;
const BOOKMARK_EXCERPT_ACCENT = '#8C9B8466';

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
  @Prop currentChapterIndex: number = -1;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop isTablet: boolean = false;
  // The owner supplies the measured viewport-constrained width. Zero keeps
  // the source-exact standalone Figma endpoint.
  @Prop panelWidthOverride: number = 0;
  // ReaderShell lays out below the status bar. Phone full-sheet geometry is
  // therefore capped by the real host viewport while retaining the Figma
  // 20vp bottom anchor; zero keeps the source-exact standalone endpoint.
  @Prop panelHeightOverride: number = 0;
  @State private activeTab: string = 'directory';
  @State private searchDraft: string = '';
  @State private searchQuery: string = '';
  @State private ascending: boolean = true;
  @State private projectedEntries: LocalReadingTocEntry[] = [];
  @State private projectedBookmarks: LocalReadingBookmark[] = [];
  // The current physical-device Repeat runtime keeps the mounted virtual
  // window when the same business keys are reordered. Alternating the ArkUI
  // conditional branch remounts only the virtual List subtree after a real
  // projection change; it does not eagerly materialize the whole directory.
  @State private projectionMountPrimary: boolean = true;
  private readonly listScroller: Scroller = new Scroller();
  // Projection changes remount the virtual List. Defer the matching top scroll
  // until that subtree is mounted, and let a newer projection invalidate an
  // older queued scroll during rapid sort taps.
  private projectionScrollGeneration: number = 0;
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
    registerReaderFonts(this.getUIContext().getFont());
    this.rebuildProjection(this.ascending);
  }

  aboutToDisappear(): void {
    this.projectionScrollGeneration += 1;
  }

  build() {
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
        if (this.projectionMountPrimary) {
          this.bookmarkList();
        } else {
          this.bookmarkList();
        }
      } else {
        if (this.projectionMountPrimary) {
          this.chapterList();
        } else {
          this.chapterList();
        }
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
      .height(36)
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
    .height(36)
    .accessibilityText('目录')
    .onClick((): void => {
      if (this.activeTab === 'directory') {
        this.cancelProjectionTopScroll();
        this.listScroller.scrollEdge(Edge.Top);
        return;
      }
      this.activeTab = 'directory';
      this.rebuildProjection(this.ascending);
      this.scheduleProjectionTopScroll();
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
      .height(36)
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
    .height(36)
    .accessibilityText('书签')
    .onClick((): void => {
      if (this.activeTab === 'bookmarks') {
        this.cancelProjectionTopScroll();
        this.listScroller.scrollEdge(Edge.Top);
        return;
      }
      this.activeTab = 'bookmarks';
      this.rebuildProjection(this.ascending);
      this.scheduleProjectionTopScroll();
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
      Text('')
        .width('100%')
        .height(1)
        .backgroundColor(TOK_LINE);
    }
    .width('100%')
    .height(51);
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
    List({ space: 0, scroller: this.listScroller }) {
      Repeat(this.projectedEntries)
        .each((repeatItem: RepeatItem<LocalReadingTocEntry>) => {
          ListItem() {
            this.chapterRow(repeatItem);
          }
          .width('100%')
          .height(40);
        })
        .key((entry: LocalReadingTocEntry): string => `toc-entry-${entry.index}`)
        .virtualScroll({ totalCount: this.projectedEntries.length, reusable: false });
    }
    .width('100%')
    .height(this.chapterListHeight())
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE, top: 5, bottom: 5 })
    .scrollBar(BarState.Off);
  }

  @Builder
  private chapterRow(repeatItem: RepeatItem<LocalReadingTocEntry>) {
    Row() {
      Row() {
        if (this.isCurrent(repeatItem.item)) {
          Text('')
            .width(3)
            .height(40)
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
        .height(40);
      }
      .layoutWeight(1)
      .height(40)
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
    .height(40)
    .backgroundColor(this.isCurrent(repeatItem.item) ? TOK_READ_ACTIVE_SOFT : Color.Transparent)
    .borderRadius(6);
  }

  @Builder
  private bookmarkList() {
    List({ space: 0, scroller: this.listScroller }) {
      Repeat(this.projectedBookmarks)
        .each((repeatItem: RepeatItem<LocalReadingBookmark>) => {
          ListItem() {
            this.bookmarkRow(repeatItem);
          }
          .width('100%')
          .height(BOOKMARK_ROW_HEIGHT);
        })
        .key((bookmark: LocalReadingBookmark): string => `bookmark-${bookmark.time}`)
        .virtualScroll({ totalCount: this.projectedBookmarks.length, reusable: false });
    }
    .width('100%')
    .height(this.bookmarkListHeight())
    .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE, top: 4 })
    .scrollBar(BarState.Off);
  }

  @Builder
  private bookmarkRow(repeatItem: RepeatItem<LocalReadingBookmark>) {
    Column({ space: 0 }) {
      Text(repeatItem.item.chapterTitle)
        .width('100%')
        .height(14)
        .margin({ top: 9 })
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(500)
        .fontSize(11)
        .lineHeight(14)
        .fontColor(TOK_READ_INK)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis });
      Row({ space: 17 }) {
        Text('')
          .width(1)
          .height(28)
          .backgroundColor(BOOKMARK_EXCERPT_ACCENT)
          .borderRadius(1);
        Text(repeatItem.item.content)
          .layoutWeight(1)
          .height(28)
          .fontFamily('ReaderNotoSerifSCRegular')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .lineHeight(14)
          .fontColor(TOK_READ_MUTED)
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }
      .width('100%')
      .height(28)
      .margin({ top: 9 })
      .alignItems(VerticalAlign.Center);
      Text('')
        .width('100%')
        .height(1)
        .margin({ top: 13 })
        .backgroundColor(TOK_LINE);
    }
    .width('100%')
    .height(BOOKMARK_ROW_HEIGHT)
    .padding({ left: 10, right: 10 })
    .accessibilityText(`打开书签：${repeatItem.item.chapterTitle}`)
    .onClick((): void => this.onSelectChapter(repeatItem.item.chapterIndex));
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
    this.searchQuery = this.searchDraft.trim();
    this.rebuildProjection(this.ascending);
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
    this.rebuildProjection(nextAscending);
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
    this.rebuildProjection(this.ascending);
  }

  private rebuildProjection(ascending: boolean): void {
    if (this.activeTab === 'bookmarks') {
      this.projectedEntries = [];
      this.projectedBookmarks = projectReaderDirectoryBookmarks(this.entries, this.searchQuery);
      this.projectionMountPrimary = !this.projectionMountPrimary;
      return;
    }
    this.projectedEntries = projectReaderDirectoryEntries(this.entries, this.searchQuery, ascending);
    this.projectedBookmarks = [];
    this.projectionMountPrimary = !this.projectionMountPrimary;
  }

  private scheduleProjectionTopScroll(): void {
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
    return this.isTablet ? 720 : 364;
  }

  private innerWidth(): number {
    return Math.max(0, this.panelWidth() - 26);
  }

  private panelHeight(): number {
    if (!this.isTablet && this.panelHeightOverride > 0) {
      return this.panelHeightOverride;
    }
    return this.isTablet ? 852 : 736;
  }

  private contentHeight(): number {
    return Math.max(298, this.panelHeight() - 32);
  }

  private bodyContentHeight(): number {
    return Math.max(260, this.contentHeight() - 38);
  }

  private chapterListHeight(): number {
    return Math.max(117, this.bodyContentHeight() - 143);
  }

  private bookmarkListHeight(): number {
    return Math.max(117, this.bodyContentHeight() - 93);
  }

  private gripLeft(): number {
    const figmaLeft = this.isTablet ? 489 : 134;
    return Math.min(figmaLeft, Math.max(0, this.panelWidth() - 42));
  }

  private activeTabLineWidth(): number {
    const figmaWidth = this.isTablet ? 176 : 83;
    return Math.min(figmaWidth, Math.max(0, (this.innerWidth() - TOK_SPACE_XS * 2) / 2));
  }

  private isCurrent(entry: LocalReadingTocEntry): boolean {
    return entry.index === this.currentChapterIndex;
  }

  private currentEntry(): LocalReadingTocEntry | undefined {
    for (const entry of this.entries) {
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
    for (let index = 0; index < this.entries.length; index += 1) {
      if (this.entries[index].index === entry.index) {
        ordinal = index + 1;
        break;
      }
    }
    return ordinal === 0 ? '' : `${ordinal} / ${this.entries.length}`;
  }
}
