import { FrameCallback, LengthMetrics } from '@kit.ArkUI';
import { sampleReaderControlMotionPresentation, type ReaderControlMotionPresentation } from './ReaderControlMotionPresentation';
import type { LocalReadingTocEntry } from './LocalReadingFlowGateway';
import type { ReaderBookIdentity } from './ReaderBookmarkProjection';
import { readerControlDirectorySnapshot, ReaderControlDirectoryPosition,
  type ReaderControlDirectoryRow, type ReaderControlDirectorySnapshot } from './ReaderControlDirectoryModel';
import { readerDirectoryBookmarkMarkerState, type ReaderDirectoryChapterStartBookmarkRequest } from './ReaderDirectoryMarkerState';
import { ReaderBookmarkRow } from './ReaderBookmarkRow';
import { ReaderBookmarkEmptyState } from './ReaderBookmarkEmptyState';
import { ReaderBookmarkLoadingState } from './ReaderBookmarkLoadingState';
import { ReaderBookmarkErrorState } from './ReaderBookmarkErrorState';
import { ReaderSearchField } from '../common/ReaderSearchField';
import { TOK_ACCENT, TOK_LINE, TOK_READ_ACTIVE_SOFT, TOK_READ_INK, TOK_READ_MUTED,
  TOK_READ_PRIMARY, TOK_SURFACE_PANEL_SOFT, TOK_SPACE_SM } from '../common/ReaderTokens';

class ControlDirectoryDataSource implements IDataSource {
  private rows: ReaderControlDirectoryRow[] = [];
  private signatures: string[] = [];
  private listeners: DataChangeListener[] = [];
  totalCount(): number { return this.rows.length; }
  getData(index: number): ReaderControlDirectoryRow { return this.rows[index]; }
  registerDataChangeListener(listener: DataChangeListener): void { this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((value: DataChangeListener): boolean => value !== listener);
  }
  replace(rows: ReaderControlDirectoryRow[]): void {
    // Values can change while row identity remains stable. Notify changed
    // rows individually; use a reload only for a structural key change.
    const signatures = rows.map((row: ReaderControlDirectoryRow): string => JSON.stringify(row));
    const structural = rows.length !== this.rows.length ||
      rows.some((row: ReaderControlDirectoryRow, index: number): boolean => row.key !== this.rows[index].key);
    const previous = this.signatures;
    this.rows = rows; this.signatures = signatures;
    if (structural) {
      for (const listener of this.listeners) listener.onDataReloaded();
    } else {
      for (let index = 0; index < rows.length; index += 1) {
        if (signatures[index] === previous[index]) continue;
        for (const listener of this.listeners) listener.onDataChanged(index);
      }
    }
  }
}

class ControlDirectoryFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/** Control-only content. The shell owns its viewport; there is no standalone
 * page mode, hidden data sentinel, fixed Full mount box or alternate List tree.
 * Business data updates and visual progress are separate inputs.
 */
@Component
export struct ReaderControlDirectoryContent {
  @Prop @Watch('refreshData') entries: LocalReadingTocEntry[] = [];
  @Prop @Watch('refreshData') currentChapterIndex: number = -1;
  @Prop @Watch('openList') tab: string = 'directory';
  @Prop @Watch('openList') sessionKey: string = '';
  @Prop @Watch('refreshData') bookmarkIdentity: ReaderBookIdentity | undefined = undefined;
  @Prop @Watch('onProgressChanged') progress: number = 0;
  @Prop @Watch('onInputChanged') interactionEnabled: boolean = true;
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop chapterDownloadEnabled: boolean = false;
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  @Prop bookmarkLoadFailed: boolean = false;
  @Prop bookmarkLoadMessage: string = '';
  onTabChange: (tab: string) => void = (_tab: string): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onSelectBookmark: ((id: string, index: number, offset: number) => void) | undefined = undefined;
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  onRetryBookmarkLoad: () => void = (): void => {};
  @State private draft: string = '';
  @State private ascending: boolean = true;
  @State private snapshot: ReaderControlDirectorySnapshot =
    readerControlDirectorySnapshot([], 'directory', '', true, -1);
  private query: string = '';
  private scroller: Scroller = new Scroller();
  private dataSource: ControlDirectoryDataSource = new ControlDirectoryDataSource();
  private placement: ReaderControlDirectoryPosition = new ReaderControlDirectoryPosition();
  private mounted: boolean = false;
  private lifecycle: number = 0;
  private positionQueued: boolean = false;
  private previousRowHeight: number = 32;
  private leadingRow: number | undefined = undefined;
  private leadingKey: string | undefined = undefined;
  private leadingFraction: number = 0;
  private correctionQueued: boolean = false;

  aboutToAppear(): void { this.mounted = true; this.lifecycle += 1; this.openList(); }
  aboutToDisappear(): void { this.mounted = false; this.lifecycle += 1; this.positionQueued = false; }

  private openList(): void {
    if (!this.mounted) return;
    this.placement.open(`${this.sessionKey}:${this.tab}`);
    this.leadingRow = undefined;
    this.previousRowHeight = this.rowHeight();
    this.refreshData();
  }

  private refreshData(): void {
    if (!this.mounted) return;
    const next = readerControlDirectorySnapshot(this.entries, this.tab, this.query,
      this.ascending, this.currentChapterIndex, this.bookmarkIdentity);
    if (this.leadingKey !== undefined) {
      const index = next.rows.findIndex((row: ReaderControlDirectoryRow): boolean => row.key === this.leadingKey);
      this.leadingRow = index < 0 ? undefined : index + this.leadingFraction;
    }
    this.dataSource.replace(next.rows);
    this.snapshot = next;
    this.queuePosition();
  }

  private queuePosition(): void {
    if (!this.mounted || this.positionQueued) return;
    const lifecycle = this.lifecycle;
    const ticket = this.placement.ticket();
    this.positionQueued = true;
    this.getUIContext().postFrameCallback(new ControlDirectoryFrame((): void => {
      if (!this.mounted || lifecycle !== this.lifecycle) return;
      this.positionQueued = false;
      const offset = this.placement.offset(this.snapshot, this.listHeight(), this.rowHeight(), ticket);
      if (offset === undefined) return;
      try {
        this.scroller.scrollToIndex(this.snapshot.targetRow, false, ScrollAlign.CENTER);
        this.placement.commit(ticket);
      } catch (_error) { /* First layout will retry this same request. */ }
    }));
  }

  private onProgressChanged(): void {
    if (!this.mounted) return;
    const nextHeight = this.rowHeight();
    if (nextHeight === this.previousRowHeight) return;
    if (this.leadingRow === undefined) this.captureLeadingRow();
    this.previousRowHeight = nextHeight;
    if (this.correctionQueued) return;
    this.correctionQueued = true;
    const lifecycle = this.lifecycle;
    this.getUIContext().postFrameCallback(new ControlDirectoryFrame((): void => {
      this.correctionQueued = false;
      if (!this.mounted || lifecycle !== this.lifecycle || this.leadingRow === undefined) return;
      try {
        const index = Math.floor(this.leadingRow);
        this.scroller.scrollToIndex(index, false, ScrollAlign.START,
          { extraOffset: LengthMetrics.vp(this.leadingFraction * this.rowHeight()) });
      } catch (_error) { /* The next mounted frame can restore the anchor. */ }
      if (this.interactionEnabled && (this.progress === 0 || this.progress === 1)) {
        this.leadingRow = undefined; this.leadingKey = undefined;
      }
    }));
  }

  private captureLeadingRow(): void {
    try {
      // Lazy List's total offset includes estimates for offscreen row heights.
      // Dividing it by the current animated height invents a different row
      // after deep scrolling. Read the actual visible item and its local rect.
      const index = this.scroller.getItemIndex(this.availableWidth / 2, 0.5);
      if (index < 0 || index >= this.snapshot.rows.length) return;
      const rect = this.scroller.getItemRect(index);
      if (!Number.isFinite(rect.y) || !Number.isFinite(rect.height) || rect.height <= 0) return;
      this.leadingFraction = Math.max(0, Math.min(0.999999, -rect.y / rect.height));
      this.leadingRow = index + this.leadingFraction;
      this.leadingKey = this.snapshot.rows[index]?.key;
    } catch (_error) { /* No mounted List during loading and empty states. */ }
  }

  private presentation(): ReaderControlMotionPresentation {
    return sampleReaderControlMotionPresentation(this.progress);
  }
  private onInputChanged(): void {
    if (!this.mounted || this.snapshot.rows.length === 0) return;
    if (!this.interactionEnabled) {
      if (this.leadingRow === undefined) this.captureLeadingRow();
      // Native input is disabled and onWillScroll rejects inertia. Do not
      // round-trip an estimated absolute offset to "stop" the virtual List.
    } else if (this.progress === 0 || this.progress === 1) this.leadingRow = undefined;
  }

  private userScroll(): void { this.placement.userScroll(); this.leadingRow = undefined; this.leadingKey = undefined; }
  private value(quick: number, full: number): number { return quick + (full - quick) * this.progress; }
  private rowHeight(): number { return this.tab === 'bookmarks' ? this.value(54, 74) : this.value(32, 40); }
  private listTop(): number { return this.tab === 'bookmarks' ? this.value(47, 99) : this.value(48, 99); }
  private listHeight(): number { return Math.max(0, this.availableHeight - this.listTop() -
    (this.tab === 'bookmarks' ? 1 : 1 + 48 * this.progress)); }
  private rowPadding(): number { return this.tab === 'bookmarks' ? this.value(15, 10) : this.value(16, 10); }
  private rowWidth(): number { return Math.max(0, this.availableWidth - 2 - this.rowPadding() * 2); }
  private placeholder(): string { return this.tab === 'bookmarks' ? '搜索书签内容' : '搜索章节名称'; }

  private search(): void {
    this.query = this.draft.trim(); this.userScroll(); this.refreshData();
    this.scroller.scrollEdge(Edge.Top);
  }
  private sort(): void {
    this.ascending = !this.ascending; this.userScroll(); this.refreshData();
    this.scroller.scrollEdge(Edge.Top);
  }
  private marker(entry: LocalReadingTocEntry): void {
    const state = readerDirectoryBookmarkMarkerState(entry);
    if (state.kind === 'bookmarked') this.onDeleteBookmarks(state.bookmarkTimes);
    else if (state.kind === 'empty' && this.chapterStartBookmarkCreationEnabled) {
      this.onCreateChapterStartBookmark(state.createRequest);
    }
  }

  @Builder
  private tabButton(tab: string, title: string) {
    Stack({ alignContent: Alignment.Bottom }) {
      Row({ space: 5 }) {
        if (tab === 'directory') {
          Image(this.tab === tab ? $r('app.media.rc_list') :
            $r('app.media.reader_directory_directory')).width(15).height(15);
        } else {
          Image(this.tab === tab ? $r('app.media.reader_directory_marker_bookmark_active') :
            $r('app.media.reader_directory_marker_bookmark')).width(15).height(15);
        }
        Text(title).fontFamily('ReaderNotoSansSC').fontWeight(500).fontSize(11).lineHeight(16)
          .fontColor(this.tab === tab ? TOK_READ_PRIMARY : TOK_READ_MUTED);
      }.width('100%').height(this.value(31, 36)).justifyContent(FlexAlign.Center)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
      if (this.tab === tab) {
        Row().width('52%').height(2).borderRadius(999).backgroundColor(TOK_READ_PRIMARY);
      }
    }.width(Math.max(0, (this.availableWidth - this.value(32, 18)) / 2)).height(this.value(31, 36))
      .borderRadius(8).backgroundColor(this.tab === tab ? TOK_READ_ACTIVE_SOFT : Color.Transparent)
      .accessibilityText(title).onClick((): void => this.onTabChange(tab));
  }

  @Builder
  private tool(icon: Resource, title: string, action: () => void) {
    Stack() { Image(icon).width(16).height(16); }
      .width(32).height(32).backgroundColor(TOK_SURFACE_PANEL_SOFT).borderRadius(8)
      .accessibilityText(title).onClick(action);
  }

  @Builder
  private directoryToolbar() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: 5 }) {
        Row() {
          ReaderSearchField({ variant: 'readerDirectory', mode: 'submit', text: this.draft,
            placeholder: this.placeholder(), accessibilityLabel: this.placeholder(),
            onTextChange: (value: string): void => { this.draft = value; },
            onSubmit: (): void => this.search() });
        }.layoutWeight(1).height(32);
        this.tool($r('app.media.reader_directory_search'), '搜索', (): void => this.search());
        if (this.tab === 'directory') {
          this.tool($r('app.media.reader_directory_top'), '到顶部', (): void => {
            this.userScroll(); this.scroller.scrollEdge(Edge.Top);
          });
          this.tool($r('app.media.reader_directory_bottom'), '到底部', (): void => {
            this.userScroll(); this.scroller.scrollEdge(Edge.Bottom);
          });
          this.tool(this.ascending ? $r('app.media.reader_directory_sort_ascending') :
            $r('app.media.reader_directory_sort_descending'), '切换排序', (): void => this.sort());
        }
      }.width('100%').height(50).padding({ left: 10, right: 10, top: 9 });
      Row().width('100%').height(1).backgroundColor(TOK_LINE)
        .position({ x: 0, y: this.value(63, 51) }).opacity(this.progress);
    }.width(Math.max(0, this.availableWidth - 2)).height(52);
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    Row() {
      Row() {
        if (entry.index === this.currentChapterIndex) {
          Row().width(3).height(this.rowHeight()).borderRadius(999).backgroundColor(TOK_ACCENT);
        }
        Text(entry.title).layoutWeight(1).padding({ left: 9, right: 9 })
          .fontFamily('ReaderNotoSansSC').fontWeight(500).fontSize(11).fontColor(TOK_READ_INK)
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.layoutWeight(1).height(this.rowHeight()).accessibilityText(`打开章节：${entry.title}`)
        .onClick((): void => this.onSelectChapter(entry.index));
      if (this.chapterDownloadEnabled && entry.downloadState !== 'unknown') {
        Stack() {
          Image(entry.downloadState === 'completed' ? $r('app.media.reader_directory_marker_check') :
            $r('app.media.reader_directory_marker_download')).width(15).height(15);
        }.width(26).height(this.rowHeight()).accessibilityText(entry.downloadState === 'completed' ? '已下载' : '下载章节')
          .enabled(entry.downloadState === 'missing' || entry.downloadState === 'cached' ||
            entry.downloadState === 'failed' || entry.downloadState === 'cancelled')
          .onClick((): void => this.onDownloadChapter(entry.index));
      }
      if (entry.bookmarks !== undefined) {
        Stack() {
          Image(entry.bookmarks.length > 0 ? $r('app.media.reader_directory_marker_bookmark_active') :
            $r('app.media.reader_directory_marker_bookmark')).width(15).height(15);
        }.width(26).height(this.rowHeight()).accessibilityText(entry.bookmarks.length > 0 ? '删除本章已有书签' : '添加本章章首书签')
          .onClick((): void => this.marker(entry));
      }
    }.width('100%').height(this.rowHeight()).borderRadius(6)
      .backgroundColor(entry.index === this.currentChapterIndex ? TOK_READ_ACTIVE_SOFT : Color.Transparent);
  }

  @Builder
  private listBody() {
    if (this.tab === 'bookmarks' && this.bookmarkLoadFailed) {
      ReaderBookmarkErrorState({ message: this.bookmarkLoadMessage,
        onRetry: (): void => this.onRetryBookmarkLoad() });
    } else if (this.snapshot.loading) {
      ReaderBookmarkLoadingState();
    } else if (this.snapshot.rows.length === 0 && this.tab === 'bookmarks') {
      ReaderBookmarkEmptyState({ onReturnToDirectory: (): void => this.onTabChange('directory') });
    } else if (this.snapshot.rows.length === 0) {
      Text('没有匹配的章节').fontColor(TOK_READ_MUTED).fontSize(12);
    } else {
      List({ scroller: this.scroller }) {
        LazyForEach(this.dataSource, (row: ReaderControlDirectoryRow) => {
          ListItem() {
            if (row.chapter !== undefined) {
              this.chapterRow(row.chapter);
            } else if (row.bookmark !== undefined) {
              ReaderBookmarkRow({ row: row.bookmark, embeddedInControl: true,
                motionProgress: this.progress, availableWidth: this.rowWidth(),
                onSelectBookmark: (id: string, chapter: number, offset: number): void => {
                  if (this.onSelectBookmark !== undefined) this.onSelectBookmark(id, chapter, offset);
                } });
            }
          }.width('100%').height(this.rowHeight());
        }, (row: ReaderControlDirectoryRow): string => row.key);
      }.width('100%').height('100%').padding({ left: this.rowPadding(), right: this.rowPadding() })
        .scrollBar(BarState.Off).edgeEffect(EdgeEffect.Spring).cachedCount(4)
        .enableScrollInteraction(this.interactionEnabled)
        .onWillScroll((offset: number, _state: ScrollState, source: ScrollSource): ScrollResult =>
          ({ offsetRemain: this.interactionEnabled || source === ScrollSource.SCROLLER ? offset : 0 }))
        .onWillStartDragging((): void => this.userScroll())
        .onAreaChange((): void => this.queuePosition());
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack() { this.tabButton('directory', '章节'); }
        .position({ x: this.value(this.tab === 'bookmarks' ? 15 : 16, 9),
          y: this.value(this.tab === 'bookmarks' ? 12 : 13, 6) });
      Stack() { this.tabButton('bookmarks', '书签'); }
        .position({ x: this.value(this.tab === 'bookmarks' ? 142 : 143, 169) + (this.availableWidth - this.value(286, 338)) / 2,
          y: this.value(this.tab === 'bookmarks' ? 12 : 13, 6) });
      Row().width(this.tab === 'bookmarks' ? this.availableWidth + 52 * (1 - this.progress) - 2 :
        Math.max(0, this.availableWidth - this.value(22, 2))).height(1).backgroundColor(TOK_LINE)
        .position({ x: this.tab === 'bookmarks' ? 1 : this.value(11, 1),
          y: this.tab === 'bookmarks' ? this.value(50, 42) : this.value(44, 42) })
        .opacity(this.tab === 'bookmarks' ? this.progress : 1);
      Stack({ alignContent: Alignment.TopStart }) { this.directoryToolbar(); }
        .position({ x: 1, y: this.value(61, 43) })
        .opacity(this.progress * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
        .enabled(this.progress === 1).hitTestBehavior(this.progress === 1 ? HitTestMode.Default : HitTestMode.None);
      Stack({ alignContent: Alignment.TopStart }) { this.listBody(); }
        .width(Math.max(0, this.availableWidth - 2)).height(this.listHeight())
        .position({ x: 1, y: this.listTop() }).clip(true)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
      if (this.tab === 'directory') {
        Column({ space: 0 }) {
          Row().width('100%').height(1).backgroundColor(TOK_LINE);
          Row({ space: 10 }) {
            Text('当前章节').fontFamily('ReaderNotoSansSC').fontSize(9).fontColor(TOK_READ_MUTED)
              .flexShrink(0);
            Text(this.snapshot.currentTitle).layoutWeight(1).fontFamily('ReaderNotoSansSC')
              .fontWeight(FontWeight.Bold).fontSize(11).fontColor(TOK_READ_INK)
              .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
            Text(this.snapshot.currentPosition).fontFamily('ReaderNotoSansSC').fontSize(9)
              .fontColor(TOK_READ_MUTED).flexShrink(0).maxLines(1).textAlign(TextAlign.End);
          }.width('100%').height(47).padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: 1 })
            .backgroundColor(TOK_SURFACE_PANEL_SOFT);
        }.width(Math.max(0, this.availableWidth - 2)).height(48)
          .position({ x: 1, y: this.availableHeight - 49 + this.value(24, 0) })
          .opacity(this.progress * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
          .hitTestBehavior(HitTestMode.None)
          .accessibilityLevel(this.progress === 0 ? 'no-hide-descendants' : 'auto');
      }
    }.width(this.availableWidth).height(this.availableHeight).clip(true);
  }
}
