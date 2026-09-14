import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';
import { readerAppColor } from '../common/ReaderThemeRegistry';
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
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

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
  onSelectBookmark: ((id: string, index: number, offset: number, positionScope?: RemoteReadingPositionScope) => void) | undefined = undefined;
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
  private positionTicket: number = -1;
  private previousRowHeight: number = 32;
  private leadingRow: number | undefined = undefined;
  private leadingKey: string | undefined = undefined;
  private leadingFraction: number = 0;
  private correctionQueued: boolean = false;
  private cachedPaint: ReaderControlMotionPresentation | undefined = undefined;
  private paintProgress: number = -1;

  aboutToAppear(): void { this.mounted = true; this.lifecycle += 1; this.openList(); }
  aboutToDisappear(): void {
    this.mounted = false; this.lifecycle += 1; this.positionQueued = false; this.correctionQueued = false;
  }

  private openList(): void {
    if (!this.mounted) return;
    this.placement.open(`${this.sessionKey}:${this.tab}`);
    this.leadingRow = undefined;
    this.leadingKey = undefined;
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
    if (this.leadingRow !== undefined) this.queueLeadingCorrection();
  }

  private queuePosition(): void {
    if (!this.mounted) return;
    const lifecycle = this.lifecycle;
    const ticket = this.placement.ticket();
    if (this.positionQueued && this.positionTicket === ticket) return;
    this.positionQueued = true;
    this.positionTicket = ticket;
    this.getUIContext().postFrameCallback(new ControlDirectoryFrame((): void => {
      if (!this.mounted || lifecycle !== this.lifecycle || this.positionTicket !== ticket) return;
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
    this.queueLeadingCorrection();
  }

  private queueLeadingCorrection(): void {
    // With the first row at zero, changing row height cannot change its anchor.
    if (!this.mounted || this.leadingRow === undefined || this.leadingRow === 0) return;
    if (this.correctionQueued) return;
    this.correctionQueued = true;
    const lifecycle = this.lifecycle;
    this.getUIContext().postFrameCallback(new ControlDirectoryFrame((): void => {
      if (!this.mounted || lifecycle !== this.lifecycle) return;
      this.correctionQueued = false;
      if (this.leadingRow === undefined) return;
      try {
        const index = Math.floor(this.leadingRow);
        const height = this.rowHeight();
        const offset = this.leadingFraction * height;
        if (!this.leadingAnchorIsAligned()) {
          this.scroller.scrollToIndex(index, false, ScrollAlign.START,
            { extraOffset: LengthMetrics.vp(offset) });
        }
      } catch (_error) { /* The next mounted frame can restore the anchor. */ }
      if (this.interactionEnabled && (this.progress === 0 || this.progress === 1) &&
        this.leadingAnchorIsAligned()) {
        this.leadingRow = undefined; this.leadingKey = undefined;
      }
    }));
  }

  private leadingAnchorIsAligned(): boolean {
    if (this.leadingRow === undefined) return false;
    try {
      const height = this.rowHeight();
      const rect = this.scroller.getItemRect(Math.floor(this.leadingRow));
      const tolerance = 0.5 / this.getUIContext().vp2px(1);
      return Number.isFinite(rect.y) && Number.isFinite(rect.height) && rect.height > 0 &&
        Math.abs(rect.height - height) <= tolerance &&
        Math.abs(rect.y + this.leadingFraction * height) <= tolerance;
    } catch (_error) { return false; }
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
    if (this.cachedPaint === undefined || this.paintProgress !== this.progress) {
      this.paintProgress = this.progress;
      this.cachedPaint = sampleReaderControlMotionPresentation(this.progress);
    }
    return this.cachedPaint;
  }
  private onInputChanged(): void {
    if (!this.mounted || this.snapshot.rows.length === 0) return;
    if (!this.interactionEnabled) {
      if (this.leadingRow === undefined) this.captureLeadingRow();
      // Native input is disabled and onWillScroll rejects inertia. Do not
      // round-trip an estimated absolute offset to "stop" the virtual List.
    } else if ((this.progress === 0 || this.progress === 1) && this.leadingAnchorIsAligned()) {
      // A larger Full viewport can clamp the native List before the desired
      // trailing row. Keep that semantic intent through the endpoint so a
      // later collapse can restore it; real user scrolling still invalidates it.
      this.leadingRow = undefined; this.leadingKey = undefined;
    }
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
          Image(this.tab === tab ? (this.appThemeScheme === 'night' ? $r('app.media.rc_list_theme_night') : $r('app.media.rc_list')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_directory_theme_night') : $r('app.media.reader_directory_directory'))).width(15).height(15);
        } else {
          Image(this.tab === tab ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark'))).width(15).height(15);
        }
        Text(title).fontFamily('ReaderNotoSansSC').fontWeight(500).fontSize(11).lineHeight(16)
          .fontColor(this.tab === tab ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_READ_MUTED', this.appThemeScheme));
      }.width('100%').height(this.value(31, 36)).justifyContent(FlexAlign.Center)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
      if (this.tab === tab) {
        Row().width('52%').height(2).borderRadius(999).backgroundColor(readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme));
      }
    }.width(Math.max(0, (this.availableWidth - this.value(32, 18)) / 2)).height(this.value(31, 36))
      .borderRadius(8).backgroundColor(this.tab === tab ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent)
      .accessibilityText(title).onClick((): void => this.onTabChange(tab));
  }

  @Builder
  private tool(icon: Resource, title: string, action: () => void) {
    Stack() { Image(icon).width(16).height(16); }
      .width(32).height(32).backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme)).borderRadius(8)
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
        this.tool((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_search_theme_night') : $r('app.media.reader_directory_search')), '搜索', (): void => this.search());
        if (this.tab === 'directory') {
          this.tool((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_top_theme_night') : $r('app.media.reader_directory_top')), '到顶部', (): void => {
            this.userScroll(); this.scroller.scrollEdge(Edge.Top);
          });
          this.tool((this.appThemeScheme === 'night' ? $r('app.media.reader_directory_bottom_theme_night') : $r('app.media.reader_directory_bottom')), '到底部', (): void => {
            this.userScroll(); this.scroller.scrollEdge(Edge.Bottom);
          });
          this.tool(this.ascending ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_sort_ascending_theme_night') : $r('app.media.reader_directory_sort_ascending')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_sort_descending_theme_night') : $r('app.media.reader_directory_sort_descending')), '切换排序', (): void => this.sort());
        }
      }.width('100%').height(50).padding({ left: 10, right: 10, top: 9 });
      Row().width('100%').height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
        .position({ x: 0, y: this.value(63, 51) }).opacity(this.progress);
    }.width(Math.max(0, this.availableWidth - 2)).height(52);
  }

  @Builder
  private chapterRow(entry: LocalReadingTocEntry) {
    Row() {
      Row() {
        if (entry.index === this.currentChapterIndex) {
          Row().width(3).height(this.rowHeight()).borderRadius(999).backgroundColor(readerAppColor('TOK_ACCENT', this.appThemeScheme));
        }
        Text(entry.title).layoutWeight(1).padding({ left: 9, right: 9 })
          .fontFamily('ReaderNotoSansSC').fontWeight(500).fontSize(11).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.layoutWeight(1).height(this.rowHeight()).accessibilityText(entry.navigable === false ? `卷标题：${entry.title}` : `打开章节：${entry.title}`)
        .enabled(entry.navigable !== false)
        .onClick((): void => { if (entry.navigable !== false) this.onSelectChapter(entry.index); });
      if (entry.navigable !== false && this.chapterDownloadEnabled && entry.downloadState !== 'unknown') {
        Stack() {
          Image(entry.downloadState === 'completed' ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_check_theme_night') : $r('app.media.reader_directory_marker_check')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_download_theme_night') : $r('app.media.reader_directory_marker_download'))).width(15).height(15);
        }.width(26).height(this.rowHeight()).accessibilityText(entry.downloadState === 'completed' ? '已下载' : '下载章节')
          .enabled(entry.downloadState === 'missing' || entry.downloadState === 'cached' ||
            entry.downloadState === 'failed' || entry.downloadState === 'cancelled')
          .onClick((): void => this.onDownloadChapter(entry.index));
      }
      if (entry.navigable !== false && entry.bookmarks !== undefined) {
        Stack() {
          Image(entry.bookmarks.length > 0 ? (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_active_theme_night') : $r('app.media.reader_directory_marker_bookmark_active')) :
            (this.appThemeScheme === 'night' ? $r('app.media.reader_directory_marker_bookmark_theme_night') : $r('app.media.reader_directory_marker_bookmark'))).width(15).height(15);
        }.width(26).height(this.rowHeight()).accessibilityText(entry.bookmarks.length > 0 ? '删除本章已有书签' : '添加本章章首书签')
          .onClick((): void => this.marker(entry));
      }
    }.width('100%').height(this.rowHeight()).borderRadius(6)
      .backgroundColor(entry.index === this.currentChapterIndex ? readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme) : Color.Transparent);
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
      Text('没有匹配的章节').fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).fontSize(12);
    } else {
      List({ scroller: this.scroller }) {
        LazyForEach(this.dataSource, (row: ReaderControlDirectoryRow) => {
          ListItem() {
            if (row.chapter !== undefined) {
              this.chapterRow(row.chapter);
            } else if (row.bookmark !== undefined) {
              ReaderBookmarkRow({ row: row.bookmark, embeddedInControl: true,
                motionProgress: this.progress, availableWidth: this.rowWidth(),
                onSelectBookmark: (id: string, chapter: number, offset: number, positionScope?: RemoteReadingPositionScope): void => {
                  if (this.onSelectBookmark !== undefined) this.onSelectBookmark(id, chapter, offset, positionScope);
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
        Math.max(0, this.availableWidth - this.value(22, 2))).height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
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
          Row().width('100%').height(1).backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme));
          Row({ space: 10 }) {
            Text('当前章节').fontFamily('ReaderNotoSansSC').fontSize(9).fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
              .flexShrink(0);
            Text(this.snapshot.currentTitle).layoutWeight(1).fontFamily('ReaderNotoSansSC')
              .fontWeight(FontWeight.Bold).fontSize(11).fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
              .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
            Text(this.snapshot.currentPosition).fontFamily('ReaderNotoSansSC').fontSize(9)
              .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme)).flexShrink(0).maxLines(1).textAlign(TextAlign.End);
          }.width('100%').height(47).padding({ left: TOK_SPACE_SM, right: TOK_SPACE_SM, top: 1 })
            .backgroundColor(readerAppColor('TOK_SURFACE_PANEL_SOFT', this.appThemeScheme));
        }.width(Math.max(0, this.availableWidth - 2)).height(48)
          .position({ x: 1, y: this.availableHeight - 49 + this.value(24, 0) })
          .opacity(this.progress * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
          .hitTestBehavior(HitTestMode.None)
          .accessibilityLevel(this.progress === 0 ? 'no-hide-descendants' : 'auto');
      }
    }.width(this.availableWidth).height(this.availableHeight).clip(true);
  }
}
