import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { PageBackBar } from '../common/PageBackBar';
import { registerReaderFonts } from '../common/ReaderFonts';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../common/ReaderWindowMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from '../common/SurfaceHorizontalGeometry';
import { TOK_CONTENT_MAX_W_TABLET } from '../common/ReaderTokens';
import type { LocalReadingTocEntry } from '../reading/LocalReadingFlowGateway';
import type { ReaderDirectoryChapterStartBookmarkRequest } from '../reading/ReaderDirectoryMarkerState';
import { snapshotReaderDirectoryData, sameReaderDirectoryData } from '../reading/ReaderDirectoryDataSnapshot';
import { projectReaderDirectoryEntries } from '../reading/ReaderDirectoryProjection';
import { ReaderDirectoryToolbar } from '../reading/ReaderDirectoryToolbar';
import { ReaderDirectoryChapterRow } from '../reading/ReaderDirectoryChapterRow';
import { ReaderDirectoryList } from '../reading/ReaderDirectoryList';

/** Detail-owned catalog. Reuses the control's toolbar/rows, never its sheet or reading session. */
@Component
export struct BookDirectoryPage {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop @Watch('onIdentityChanged') sourceId: string = '';
  @Prop @Watch('onIdentityChanged') bookId: string = '';
  @Prop @Watch('onEntriesChanged') entries: LocalReadingTocEntry[] = [];
  @Prop catalogMessage: string = '';
  @Prop chapterStartBookmarkCreationEnabled: boolean = false;
  onBack: () => void = (): void => {};
  onSelectChapter: (index: number) => void = (_index: number): void => {};
  onDownloadChapter: (index: number) => void = (_index: number): void => {};
  onDeleteBookmarks: (times: number[]) => void = (_times: number[]): void => {};
  onCreateChapterStartBookmark: (request: ReaderDirectoryChapterStartBookmarkRequest) => void =
    (_request: ReaderDirectoryChapterStartBookmarkRequest): void => {};
  @State private searchDraft: string = '';
  @State private searchQuery: string = '';
  @State private ascending: boolean = true;
  @State private projectedEntries: LocalReadingTocEntry[] = [];
  @State private viewportWidth: number = 0;
  private admittedEntries: LocalReadingTocEntry[] = [];
  @State private admittedIdentity: string = '';
  private mounted: boolean = false;
  private projectionGeneration: number = 0;
  private scrollGeneration: number = 0;
  private listReady: boolean = false;
  private pendingScrollEdge: Edge | undefined = undefined;
  private readonly listScroller: Scroller = new Scroller();

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.mounted = true;
    this.admitEntries(true);
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.projectionGeneration += 1;
    this.scrollGeneration += 1;
    this.admittedIdentity = '';
    this.listReady = false;
    this.pendingScrollEdge = undefined;
  }

  build() {
    Column() {
      PageBackBar({ title: '目录', onBack: (): void => this.onBack() });
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
          }, (identity: string): string => identity);
          if (this.projectedEntries.length === 0) {
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

  private rowIsCurrent(entry: LocalReadingTocEntry, identity: string): boolean {
    if (!this.mounted || identity !== this.identity() || identity !== this.admittedIdentity ||
      entry.navigable === false || !sameReaderDirectoryData(this.admittedEntries, this.entries)) return false;
    // ArkUI @Prop copies the List's objects. Compare the Core-backed facts,
    // never object references across that component boundary.
    const current = this.projectedEntries.find((candidate: LocalReadingTocEntry): boolean => candidate.index === entry.index);
    return current !== undefined && sameReaderDirectoryData([entry], [current]);
  }

  private onIdentityChanged(): void {
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
    if (reset) {
      this.searchDraft = '';
      this.searchQuery = '';
      this.ascending = true;
      this.listReady = false;
    }
    this.admittedIdentity = this.identity();
    this.admittedEntries = snapshotReaderDirectoryData(this.entries);
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
    setTimeout((): void => {
      if (generation === this.scrollGeneration) this.flushPendingScroll();
    }, 0);
  }

  private scrollToEdge(edge: Edge): void {
    this.scrollGeneration += 1;
    this.pendingScrollEdge = edge;
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
  }

  private flushPendingScroll(): void {
    const edge = this.pendingScrollEdge;
    if (!this.mounted || !this.listReady || this.projectedEntries.length === 0 || edge === undefined) return;
    this.pendingScrollEdge = undefined;
    this.listScroller.scrollEdge(edge);
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
