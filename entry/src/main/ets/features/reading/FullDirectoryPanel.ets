import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
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

/**
 * Source-backed presentation layer for the expanded reader directory panel:
 * - Phone: Figma `943:11617`, Section `I943:11617;927:66`, at x=12, y=88, 364px wide.
 * - Tablet: Figma `943:11949`, Section `I943:11949;929:62`, at x=26, y=88, 720px wide.
 *
 * The panel deliberately consumes already materialized page state only. It
 * does not call Core, select chapters, commit reading progress, or infer
 * downloaded/bookmark facts that are not part of `LocalReadingTocEntry`.
 *
 * Every icon below is a direct SVG export from the current Phone instance
 * `I1995:60568;927:*`; the resource names deliberately do not reuse older
 * unproven Directory SVGs.
 */
@Component
export struct FullDirectoryPanel {
  @Prop entries: LocalReadingTocEntry[] = [];
  @Prop currentChapterIndex: number = -1;
  @Prop isTablet: boolean = false;
  // ReaderShell lays out below the status bar. Phone full-sheet geometry is
  // therefore capped by the real host viewport while retaining the Figma
  // 20vp bottom anchor; zero keeps the source-exact standalone endpoint.
  @Prop panelHeightOverride: number = 0;
  @State private activeTab: string = 'directory';
  @State private searchDraft: string = '';
  @State private searchQuery: string = '';
  @State private ascending: boolean = true;
  private readonly listScroller: Scroller = new Scroller();
  // R-LOCAL-TOC-01: allow the owning flow to react to a chapter tap so the
  // full-directory can be wired back into the actual reading flow.
  onSelectChapter: (index: number) => void = (_index: number): void => {};
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
        Image($r('app.media.reader_directory_directory'))
          .width(20)
          .height(20);
        Text('目录')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(14)
          .lineHeight(16.8)
          .fontColor(TOK_READ_INK);
      }
      .layoutWeight(1)
      .height(30)
      .alignItems(VerticalAlign.Center);

      Stack({ alignContent: Alignment.Center }) {
        Text('收起')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
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
      this.chapterList();
      this.statusFooter();
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
      Stack({ alignContent: Alignment.Center }) {
        Text('目录')
          .width('100%')
          .fontFamily('ReaderInter')
          .fontWeight(600)
          .fontSize(11)
          .fontColor(this.activeTab === 'directory' ? TOK_READ_PRIMARY : TOK_READ_MUTED)
          .textAlign(TextAlign.Center);
      }
        .width('100%')
        .height(36);
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
      this.activeTab = 'directory';
      this.listScroller.scrollEdge(Edge.Top);
    });
  }

  @Builder
  private bookmarkTab() {
    Stack({ alignContent: Alignment.Bottom }) {
      Row({ space: 5 }) {
        Image($r('app.media.reader_directory_bookmark'))
          .width(15)
          .height(15);
        Text('书签')
          .fontFamily('ReaderInter')
          .fontWeight(600)
          .fontSize(11)
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
      this.activeTab = 'bookmarks';
      this.listScroller.scrollEdge(Edge.Top);
    });
  }

  @Builder
  private searchControls() {
    Column({ space: 0 }) {
      Row({ space: 5 }) {
        Row({ space: 5 }) {
          Image($r('app.media.reader_directory_input_search'))
            .width(16)
            .height(16);
          TextInput({ text: this.searchDraft, placeholder: '搜索章节名称' })
            .layoutWeight(1)
            .height(24)
            .padding(0)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(10)
            .fontColor(TOK_READ_INK)
            .placeholderColor('#757575')
            .caretColor(TOK_READ_PRIMARY)
            .backgroundColor(Color.Transparent)
            .accessibilityText('搜索章节名称')
            .onChange((value: string): void => {
              this.searchDraft = value;
            })
            .onSubmit((_enterKey: EnterKeyType): void => this.applySearch());
        }
        .layoutWeight(1)
        .height(32)
        .padding({ left: 9, right: 9 })
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .borderRadius(8)
        .alignItems(VerticalAlign.Center);

        this.controlButton('search');
        this.controlButton('top');
        this.controlButton('bottom');
        this.controlButton('sort');
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
        Image($r('app.media.reader_directory_sort')).width(16).height(16);
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
    Scroll(this.listScroller) {
      Column() {
        ForEach(this.visibleEntries(), (entry: LocalReadingTocEntry) => {
          this.chapterRow(entry);
        }, (entry: LocalReadingTocEntry): string => `toc-entry-${entry.index}`);
      }
      .width('100%')
      .padding({ left: TOK_SPACE_CONTROL_INLINE, right: TOK_SPACE_CONTROL_INLINE, top: 5, bottom: 5 });
    }
    .width('100%')
    .height(this.chapterListHeight())
    .scrollBar(BarState.Off);
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    Row() {
      Row() {
        if (this.isCurrent(entry)) {
          Text('')
            .width(3)
            .height(40)
            .backgroundColor(TOK_ACCENT)
            .borderRadius(999);
        }
        Stack({ alignContent: Alignment.Center }) {
          Text(entry.title)
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
      .accessibilityText(`打开章节：${entry.title}`)
      .onClick((): void => this.onSelectChapter(entry.index));
      if (entry.downloadState !== 'unknown') {
        this.downloadMarkerHitTarget(entry);
      }
      if (entry.bookmarks !== undefined) {
        this.bookmarkMarkerHitTarget(entry);
      }
    }
    .width('100%')
    .height(40)
    .backgroundColor(this.isCurrent(entry) ? TOK_READ_ACTIVE_SOFT : Color.Transparent)
    .borderRadius(6);
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
    .enabled(false)
    .accessibilityText(this.downloadMarkerLabel(entry));
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
        Row({ space: 9 }) {
          Text('当前章节')
            .width(36)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Regular)
            .fontSize(9)
            .fontColor(TOK_READ_MUTED);
          Text(this.currentTitle())
            .layoutWeight(1)
            .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(11)
            .fontColor(TOK_READ_INK)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis });
        }
        .layoutWeight(1)
        .height(47)
        .alignItems(VerticalAlign.Center);

        Text(this.currentPosition())
          .width(20.08)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .fontColor(TOK_READ_MUTED)
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
    this.listScroller.scrollEdge(Edge.Top);
  }

  private handleControl(kind: string): void {
    if (kind === 'search') {
      this.applySearch();
      return;
    }
    if (kind === 'top') {
      this.listScroller.scrollEdge(Edge.Top);
      return;
    }
    if (kind === 'bottom') {
      this.listScroller.scrollEdge(Edge.Bottom);
      return;
    }
    this.ascending = !this.ascending;
    this.listScroller.scrollEdge(Edge.Top);
  }

  private controlButtonLabel(kind: string): string {
    if (kind === 'search') {
      return '搜索章节';
    }
    if (kind === 'top') {
      return '回到目录顶部';
    }
    if (kind === 'bottom') {
      return '前往目录底部';
    }
    return this.ascending ? '按章节倒序排列' : '按章节正序排列';
  }

  private visibleEntries(): LocalReadingTocEntry[] {
    const query = this.searchQuery.toLocaleLowerCase();
    const visible: LocalReadingTocEntry[] = [];
    for (const entry of this.entries) {
      if (this.activeTab === 'bookmarks' && !this.hasBookmark(entry)) {
        continue;
      }
      if (query.length > 0 && entry.title.toLocaleLowerCase().indexOf(query) < 0) {
        continue;
      }
      visible.push(entry);
    }
    if (!this.ascending) {
      visible.reverse();
    }
    return visible;
  }

  private hasBookmark(entry: LocalReadingTocEntry): boolean {
    return entry.bookmarks !== undefined && entry.bookmarks.length > 0;
  }

  private downloadMarker(entry: LocalReadingTocEntry): string {
    return entry.downloadState === 'cached' || entry.downloadState === 'completed' ?
      'reader_directory_marker_check' : 'reader_directory_marker_download';
  }

  private downloadMarkerLabel(entry: LocalReadingTocEntry): string {
    return entry.downloadState === 'cached' || entry.downloadState === 'completed' ? '已下载' : '未下载';
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
    return state.kind === 'unknown' ? '书签状态尚未载入' : '添加书签尚未接线';
  }

  private bookmarkMarker(entry: LocalReadingTocEntry): string {
    return this.hasBookmark(entry) ?
      'reader_directory_marker_bookmark_active' : 'reader_directory_marker_bookmark';
  }

  private panelWidth(): number {
    return this.isTablet ? 720 : 364;
  }

  private innerWidth(): number {
    return this.isTablet ? 694 : 338;
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

  private gripLeft(): number {
    return this.isTablet ? 489 : 134;
  }

  private activeTabLineWidth(): number {
    return this.isTablet ? 176 : 83;
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
