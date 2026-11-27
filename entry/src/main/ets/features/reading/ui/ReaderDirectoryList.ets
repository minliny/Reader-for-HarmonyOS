import type { LocalReadingTocEntry } from '../application/LocalReadingFlowGateway';
import { ReaderScrollLayout, readerScrollEndOffset, readerScrollStartOffset } from '../../../ui/layout/ReaderScrollLayout';
import { sameReaderDirectoryData, snapshotReaderDirectoryData } from '../presentation/ReaderDirectoryDataSnapshot';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';

class DirectoryListDataSource implements IDataSource {
  private entries: LocalReadingTocEntry[] = [];
  private admittedSnapshot: LocalReadingTocEntry[] = [];
  private rowRevisions: Map<number, number> = new Map<number, number>();
  private rowRevision: number = 0;
  private listeners: DataChangeListener[] = [];
  totalCount(): number { return this.entries.length; }
  getData(index: number): LocalReadingTocEntry { return this.entries[index]; }
  rowKey(entry: LocalReadingTocEntry): string {
    return `reader-directory-row-${entry.index}-${this.rowRevisions.get(entry.index) ?? 0}`;
  }
  registerDataChangeListener(listener: DataChangeListener): void { this.listeners.push(listener); }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((value: DataChangeListener): boolean => value !== listener);
  }
  replace(entries: LocalReadingTocEntry[]): void {
    const previous = new Map<number, LocalReadingTocEntry>();
    for (const entry of this.admittedSnapshot) previous.set(entry.index, entry);
    const revisions = new Map<number, number>();
    const snapshots: LocalReadingTocEntry[] = [];
    const changed: number[] = [];
    let reload = entries.length !== this.admittedSnapshot.length;
    entries.forEach((entry: LocalReadingTocEntry, index: number): void => {
      if (entry.index !== this.admittedSnapshot[index]?.index) reload = true;
      const admitted = previous.get(entry.index);
      const revision = this.rowRevisions.get(entry.index);
      if (admitted !== undefined && revision !== undefined && sameReaderDirectoryData([admitted], [entry])) {
        revisions.set(entry.index, revision);
        snapshots.push(admitted);
      } else {
        revisions.set(entry.index, ++this.rowRevision);
        snapshots.push(snapshotReaderDirectoryData([entry])[0]);
        changed.push(index);
      }
    });
    if (!reload && changed.length === 0) return;
    this.rowRevisions = revisions;
    this.admittedSnapshot = snapshots;
    this.entries = entries.slice();
    for (const listener of this.listeners) {
      if (reload) listener.onDataReloaded();
      else for (const index of changed) listener.onDataChange(index);
    }
  }
}

/**
 * Shared directory list frame for both directory panels. Owns only the safe
 * virtualization policy (lazy creation, no row-node reuse) and the first-layout
 * notification; row content stays with each panel through `rowBuilder`.
 * Projections update the keyed Repeat in place so the native List identity and
 * compositor buffer survive control-bar morphs and reopen sessions.
 */
@Component
export struct ReaderDirectoryList {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('onEntriesChanged') entries: LocalReadingTocEntry[] = [];
  // The expanded control keeps one native List while its viewport morphs.
  // Compare chapter data at an endpoint, where the owning panel admits it.
  @Prop @Watch('onEntriesChanged') deferEntriesDuringMotion: boolean = false;
  private readonly dataSource: DirectoryListDataSource = new DirectoryListDataSource();
  @Prop @Watch('onRowHeightChanged') rowHeight: number = 44;
  /** Manga titles wrap naturally; text keeps its existing fixed virtual extent. */
  @Prop naturalRowHeight: boolean = false;
  /** Short manga viewports need scrollable spacers when native offsets would be reset. */
  @Prop materializedInsets: boolean = false;
  @State private itemSizes: ChildrenMainSize = new ChildrenMainSize(44);
  @Prop listPaddingX: number = 0;
  @Prop listPaddingRight: number = -1;
  @Prop listPaddingY: number = 0;
  @Prop scrollLayout: ReaderScrollLayout = new ReaderScrollLayout(0, 0, 'contentOffset');
  @Prop listPaddingTop: number = -1;
  @Prop listPaddingBottom: number = -1;
  @Prop edgeEffectMode: EdgeEffect = EdgeEffect.None;
  scroller: Scroller | undefined = undefined;
  onFirstLayout: () => void = (): void => {};
  onScrollOffset: (offset: number) => void = (_offset: number): void => {};
  onViewportChanged: (width: number, height: number) => void = (_width: number, _height: number): void => {};
  onUserScrollIntent: () => void = (): void => {};
  // Only the fixed DEBUG diagnostic page supplies a sink. No book data is logged.
  @Prop geometryProbeEnabled: boolean = false;
  onGeometryProbe: (event: string) => void = (_event: string): void => {};
  @BuilderParam rowBuilder: (repeatItem: RepeatItem<LocalReadingTocEntry>) => void;
  @BuilderParam emptyBuilder: () => void = this.emptyContent;
  @Prop prefixHeight: number = 0;
  @BuilderParam prefixBuilder: () => void = this.emptyContent;
  @Prop tailHeight: number = 0;
  @BuilderParam tailBuilder: () => void = this.emptyContent;

  @Builder
  private emptyContent() {}

  private layoutReady: boolean = false;
  private measuredWidth: number = -1;
  private measuredHeight: number = -1;
  private firstVisibleIndex: number = 0;
  // ChildrenMainSize is a native virtual-list extent. Mutating it from an
  // ArkUI @Watch callback can invalidate AceList while the parent control is
  // painting a morph frame, so admit changes on the next turn only.
  private mounted: boolean = false;
  private rowHeightGeneration: number = 0;
  private rowHeightLifecycleGeneration: number = 0;
  private rowHeightFlushScheduled: boolean = false;
  private rowHeightFlushLifecycleGeneration: number = -1;
  private pendingRowHeight: number | undefined = undefined;

  aboutToAppear(): void {
    this.dataSource.replace(this.entries);
    this.rowHeightLifecycleGeneration += 1;
    this.mounted = true;
    this.layoutReady = false;
    this.measuredWidth = -1;
    this.measuredHeight = -1;
    this.pendingRowHeight = undefined;
    const initialSize = this.rowHeight;
    if (Number.isFinite(initialSize) && initialSize > 0) {
      // Initial admission occurs before the first native List layout; unlike a
      // prop Watch this lifecycle hook is not running during reconciliation.
      this.itemSizes.childDefaultSize = initialSize;
    }
    this.onRowHeightChanged();
  }

  private onEntriesChanged(): void {
    if (this.deferEntriesDuringMotion) return;
    this.dataSource.replace(this.entries);
  }

  aboutToDisappear(): void {
    this.rowHeightLifecycleGeneration += 1;
    this.rowHeightGeneration += 1;
    this.mounted = false;
    this.pendingRowHeight = undefined;
    this.rowHeightFlushScheduled = false;
    this.rowHeightFlushLifecycleGeneration = -1;
  }

  private onRowHeightChanged(): void {
    // Materialized rows change height, but virtual offscreen rows retain their
    // old measured sizes. Keep the List's entire extent on the same geometry
    // as ListItem; otherwise offset/rowHeight points at a different chapter.
    // ArkUI can deliver the same @Prop again while the outer control stage is
    // sampling p. Avoid writing ChildrenMainSize on an equal value: each write
    // invalidates AceList's PosMap and may submit an empty buffer for one
    // compositor frame, which is visible as a flash/black seam on hardware.
    if (!this.mounted) return;
    const nextSize = this.rowHeight;
    if (!Number.isFinite(nextSize) || nextSize <= 0) return;
    this.pendingRowHeight = nextSize;
    this.scheduleRowHeightFlush();
  }

  private scheduleRowHeightFlush(): void {
    this.rowHeightGeneration += 1;
    const lifecycleGeneration = this.rowHeightLifecycleGeneration;
    if (this.rowHeightFlushScheduled && this.rowHeightFlushLifecycleGeneration === lifecycleGeneration) return;
    this.rowHeightFlushScheduled = true;
    this.rowHeightFlushLifecycleGeneration = lifecycleGeneration;
    setTimeout((): void => {
      if (!this.mounted || lifecycleGeneration !== this.rowHeightLifecycleGeneration ||
        this.rowHeightFlushLifecycleGeneration !== lifecycleGeneration) return;
      this.rowHeightFlushScheduled = false;
      this.rowHeightFlushLifecycleGeneration = -1;
      const generation = this.rowHeightGeneration;
      const nextSize = this.pendingRowHeight;
      this.pendingRowHeight = undefined;
      if (nextSize !== undefined && this.itemSizes.childDefaultSize !== nextSize) {
        this.itemSizes.childDefaultSize = nextSize;
      }
      if (generation !== this.rowHeightGeneration && !this.rowHeightFlushScheduled && this.mounted) {
        this.scheduleRowHeightFlush();
      }
    }, 0);
  }

  private probeGeometry(event: string): void {
    if (!this.geometryProbeEnabled || this.scroller === undefined) return;
    try {
      const rect = this.scroller.getItemRect(this.firstVisibleIndex);
      this.onGeometryProbe(`${event} row=${this.rowHeight} viewport=${this.measuredHeight}` +
        ` offset=${this.scroller.currentOffset().yOffset} first=${this.firstVisibleIndex}` +
        ` rectY=${rect.y} rectH=${rect.height}`);
    } catch (_error) {}
  }

  build() {
    List({ space: 0, scroller: this.scroller }) {
      if (this.materializedInsets) {
        ListItem() { this.prefixBuilder(); }.width('100%')
          .height(this.listPaddingTop >= 0 ? this.listPaddingTop : this.listPaddingY);
      }
      if (this.prefixHeight > 0 && !this.materializedInsets) {
        ListItem() { this.prefixBuilder(); }.width('100%').constraintSize({ minHeight: this.prefixHeight });
      }
      if ((this.naturalRowHeight || this.prefixHeight > 0 || this.tailHeight > 0) && this.entries.length === 0) {
        ListItem() { this.emptyBuilder(); }.width('100%');
      }
      // Repeat.virtualScroll retained an empty native range when the control
      // mounted hidden before its TOC arrived. Explicit data notifications
      // admit that empty -> populated transition without remounting the List.
      LazyForEach(this.dataSource, (entry: LocalReadingTocEntry, index: number) => {
          ListItem() {
            this.rowBuilder({ item: entry, index: index });
          }
          .width('100%')
          .height(this.naturalRowHeight ? undefined : this.rowHeight);
        }, (entry: LocalReadingTocEntry): string => this.dataSource.rowKey(entry));
      if (this.materializedInsets || this.tailHeight > 0) {
        ListItem() { this.tailBuilder(); }.width('100%')
          .constraintSize({ minHeight: this.tailHeight })
          .padding({ bottom: this.materializedInsets ? this.listPaddingBottom >= 0 ? this.listPaddingBottom : this.listPaddingY : 0 });
      }
    }
    .width('100%')
    .height('100%')
    .childrenMainSize(this.naturalRowHeight || this.prefixHeight > 0 || this.tailHeight > 0 ? undefined : this.itemSizes)
    .padding({
      left: this.listPaddingX,
      right: this.listPaddingRight >= 0 ? this.listPaddingRight : this.listPaddingX,
      top: this.naturalRowHeight ? 0 : this.listPaddingTop >= 0 ? this.listPaddingTop : this.listPaddingY,
      bottom: this.naturalRowHeight ? 0 : this.listPaddingBottom >= 0 ? this.listPaddingBottom : this.listPaddingY,
    })
    // Publish one pair: text keeps the parent's overlay clearance, while
    // natural manga rows carry their own padding inside the scroll content.
    .contentStartOffset(this.materializedInsets ? 0 : this.naturalRowHeight ? (this.listPaddingTop >= 0 ? this.listPaddingTop : this.listPaddingY) :
      readerScrollStartOffset(this.scrollLayout))
    .contentEndOffset(this.materializedInsets ? 0 : this.naturalRowHeight ? (this.listPaddingBottom >= 0 ? this.listPaddingBottom : this.listPaddingY) :
      readerScrollEndOffset(this.scrollLayout))
    .scrollBar(this.naturalRowHeight ? BarState.Auto : BarState.Off)
    .scrollBarWidth(this.naturalRowHeight ? 4 : undefined)
    .scrollBarColor(this.naturalRowHeight ? readerAppColor('TOK_SS_SCROLLBAR', this.appThemeScheme) : undefined)
    .edgeEffect(this.edgeEffectMode)
    .cachedCount(4)
    // API 21 drag ownership is reported even before a positive scroll delta.
    // A Scroller.scrollTo callback is not evidence of user scroll intent.
    .onWillStartDragging((): void => this.onUserScrollIntent())
    .onWillScroll((_offset: number, _state: ScrollState, source: ScrollSource): void => {
      this.probeGeometry(`will source=${source} delta=${_offset}`);
      if (source === ScrollSource.DRAG || source === ScrollSource.FLING ||
        source === ScrollSource.OTHER_USER_INPUT || source === ScrollSource.SCROLL_BAR ||
        source === ScrollSource.SCROLL_BAR_FLING) {
        this.onUserScrollIntent();
      }
    })
    .onDidScroll((offset: number, _state: ScrollState): void => {
      this.probeGeometry(`did delta=${offset}`);
      const current = this.scroller?.currentOffset().yOffset;
      if (current !== undefined && Number.isFinite(current)) this.onScrollOffset(current);
    })
    .onScrollIndex((start: number, _end: number, _center: number): void => {
      this.firstVisibleIndex = start;
      this.probeGeometry('index');
    })
    .onAreaChange((_oldArea: Area, newArea: Area): void => {
      const width = Number(newArea.width);
      const height = Number(newArea.height);
      if (Number.isFinite(width) && Number.isFinite(height) && width >= 0 && height >= 0 &&
        (width !== this.measuredWidth || height !== this.measuredHeight)) {
        this.measuredWidth = width;
        this.measuredHeight = height;
        this.onViewportChanged(width, height);
        this.probeGeometry('layout');
      }
      if (!this.layoutReady && (newArea.height as number) > 0) {
        this.layoutReady = true;
        this.onFirstLayout();
      }
    });
  }
}
