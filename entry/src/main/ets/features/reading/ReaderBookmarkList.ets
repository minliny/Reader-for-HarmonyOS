import type { RemoteReadingPositionScope } from './RemoteReadingPositionMigration';
import { TOK_SPACE_CONTROL_INLINE } from '../common/ReaderTokens';
import type { ReaderBookmarkRowModel } from './ReaderBookmarkProjection';
import { BOOKMARK_ROW_HEIGHT, ReaderBookmarkRow } from './ReaderBookmarkRow';
import { sampleReaderControlBookmark } from './ReaderControlBookmarkGeometry';

/**
 * Flat bookmark list: one row per bookmark, same-chapter bookmarks as separate
 * rows. Consumers render the empty/loading/error states themselves; this
 * component never fabricates rows from directory data.
 */
@Component
export struct ReaderBookmarkList {
  @Prop rows: ReaderBookmarkRowModel[] = [];
  @Prop listPaddingX: number = TOK_SPACE_CONTROL_INLINE;
  @Prop listPaddingY: number = 4;
  @Prop @Watch('onRowGeometryChanged') motionProgress: number = 1;
  @Prop @Watch('onRowGeometryChanged') embeddedInControl: boolean = false;
  @Prop rowWidth: number = 316;
  // Embedded control-bar transitions keep the native List geometry stable
  // while ReaderBookmarkRow continues to consume the live visual progress.
  // Zero keeps the standalone/legacy contract (the materialized row is also
  // the virtual extent). The owner may supply endpoint dimensions so this
  // component does not infer phone-only values from the current frame.
  @Prop @Watch('onRowGeometryChanged') layoutRowHeight: number = 0;
  @Prop layoutViewportWidth: number = 0;
  @Prop layoutViewportHeight: number = 0;
  @Prop layoutPaddingX: number = -1;
  @State private itemSizes: ChildrenMainSize = new ChildrenMainSize(BOOKMARK_ROW_HEIGHT);
  scroller: Scroller | undefined = undefined;
  /** Fired once the native List has a non-zero first layout. */
  onFirstLayout: () => void = (): void => {};
  onViewportChanged: (width: number, height: number) => void = (_width: number, _height: number): void => {};
  onUserScrollIntent: () => void = (): void => {};
  onSelectBookmark: (bookmarkId: string, chapterIndex: number, chapterOffset: number, positionScope?: RemoteReadingPositionScope) => void =
    (_bookmarkId: string, _chapterIndex: number, _chapterOffset: number): void => {};

  private measuredWidth: number = -1;
  private measuredHeight: number = -1;
  // ChildrenMainSize is owned by the native virtual List. Defer updates that
  // arrive from motion/geometry @Watch callbacks so AceList never rebuilds its
  // PosMap in the middle of an animated control-bar render.
  private mounted: boolean = false;
  private rowGeometryGeneration: number = 0;
  private rowGeometryLifecycleGeneration: number = 0;
  private rowGeometryFlushScheduled: boolean = false;
  private rowGeometryFlushLifecycleGeneration: number = -1;
  private pendingRowGeometryHeight: number | undefined = undefined;
  private layoutReady: boolean = false;

  aboutToAppear(): void {
    this.rowGeometryLifecycleGeneration += 1;
    this.mounted = true;
    this.layoutReady = false;
    this.measuredWidth = -1;
    this.measuredHeight = -1;
    this.pendingRowGeometryHeight = undefined;
    const initialHeight = this.layoutRowHeightValue();
    if (Number.isFinite(initialHeight) && initialHeight > 0) {
      // Initial admission occurs before the first native List layout; unlike a
      // prop Watch this lifecycle hook is outside the reconciliation pass.
      this.itemSizes.childDefaultSize = initialHeight;
    }
    this.onRowGeometryChanged();
  }

  aboutToDisappear(): void {
    this.rowGeometryLifecycleGeneration += 1;
    this.rowGeometryGeneration += 1;
    this.mounted = false;
    this.pendingRowGeometryHeight = undefined;
    this.rowGeometryFlushScheduled = false;
    this.rowGeometryFlushLifecycleGeneration = -1;
  }

  private rowHeight(): number {
    return this.embeddedInControl ? sampleReaderControlBookmark(this.motionProgress, this.rowWidth).card.height : BOOKMARK_ROW_HEIGHT;
  }

  private stableLayoutEnabled(): boolean {
    return this.embeddedInControl && Number.isFinite(this.layoutRowHeight) && this.layoutRowHeight > 0;
  }

  private layoutRowHeightValue(): number {
    return this.stableLayoutEnabled() ? this.layoutRowHeight : this.rowHeight();
  }

  private layoutPaddingXValue(): number {
    return Number.isFinite(this.layoutPaddingX) && this.layoutPaddingX >= 0 ?
      this.layoutPaddingX : this.listPaddingX;
  }

  private onRowGeometryChanged(): void {
    // Keep virtual offscreen rows on the same height as materialized ListItems.
    // During an embedded morph the endpoint layout height is deliberately
    // stable; changing ChildrenMainSize on every motion sample resets AceList's
    // PosMap (prevTotalHeight=0) and can expose a black frame for large lists.
    if (!this.mounted) return;
    const nextHeight = this.layoutRowHeightValue();
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    this.pendingRowGeometryHeight = nextHeight;
    this.scheduleRowGeometryFlush();
  }

  private scheduleRowGeometryFlush(): void {
    this.rowGeometryGeneration += 1;
    const lifecycleGeneration = this.rowGeometryLifecycleGeneration;
    if (this.rowGeometryFlushScheduled && this.rowGeometryFlushLifecycleGeneration === lifecycleGeneration) return;
    this.rowGeometryFlushScheduled = true;
    this.rowGeometryFlushLifecycleGeneration = lifecycleGeneration;
    setTimeout((): void => {
      if (!this.mounted || lifecycleGeneration !== this.rowGeometryLifecycleGeneration ||
        this.rowGeometryFlushLifecycleGeneration !== lifecycleGeneration) return;
      this.rowGeometryFlushScheduled = false;
      this.rowGeometryFlushLifecycleGeneration = -1;
      const generation = this.rowGeometryGeneration;
      const nextHeight = this.pendingRowGeometryHeight;
      this.pendingRowGeometryHeight = undefined;
      if (nextHeight !== undefined && this.itemSizes.childDefaultSize !== nextHeight) {
        this.itemSizes.childDefaultSize = nextHeight;
      }
      if (generation !== this.rowGeometryGeneration && !this.rowGeometryFlushScheduled && this.mounted) {
        this.scheduleRowGeometryFlush();
      }
    }, 0);
  }

  build() {
    List({ space: 0, scroller: this.scroller }) {
      Repeat(this.rows)
        .each((repeatItem: RepeatItem<ReaderBookmarkRowModel>) => {
          ListItem() {
            ReaderBookmarkRow({
              row: repeatItem.item,
              onSelectBookmark: this.onSelectBookmark,
              embeddedInControl: this.embeddedInControl,
              motionProgress: this.motionProgress,
              availableWidth: this.rowWidth,
            });
          }
          .width('100%')
          .height(this.layoutRowHeightValue())
          // A live bookmark card may be taller than the source endpoint while
          // the List extent is held stable. Let the outer clipped viewport own
          // visibility rather than clipping the card at ListItem bounds.
          .clip(this.stableLayoutEnabled() ? false : true);
        })
        .key((row: ReaderBookmarkRowModel): string => `reader-bookmark-${row.bookmarkId}`)
        .virtualScroll({ totalCount: this.rows.length, reusable: false });
    }
    .width(this.layoutViewportWidth > 0 ? this.layoutViewportWidth : '100%')
    .height(this.layoutViewportHeight > 0 ? this.layoutViewportHeight : '100%')
    .childrenMainSize(this.itemSizes)
    .padding({
      left: this.layoutPaddingXValue(),
      right: this.layoutPaddingXValue(),
      top: this.listPaddingY,
      bottom: this.listPaddingY,
    })
    .scrollBar(BarState.Off)
    .onWillStartDragging((): void => this.onUserScrollIntent())
    .onWillScroll((_offset: number, _state: ScrollState, source: ScrollSource): void => {
      // Exclude both animated and non-animated Scroller commands, and spring
      // edge-effect callbacks that do not independently prove a user gesture.
      if (source === ScrollSource.DRAG || source === ScrollSource.FLING ||
        source === ScrollSource.OTHER_USER_INPUT || source === ScrollSource.SCROLL_BAR ||
        source === ScrollSource.SCROLL_BAR_FLING) {
        this.onUserScrollIntent();
      }
    })
    .onAreaChange((_oldArea: Area, newArea: Area): void => {
      const width = Number(newArea.width);
      const height = Number(newArea.height);
      if (Number.isFinite(width) && Number.isFinite(height) && width >= 0 && height >= 0 &&
        (width !== this.measuredWidth || height !== this.measuredHeight)) {
        this.measuredWidth = width;
        this.measuredHeight = height;
        this.onViewportChanged(width, height);
      }
      if (!this.layoutReady && Number(newArea.width) > 0 && Number(newArea.height) > 0) {
        this.layoutReady = true;
        this.onFirstLayout();
      }
    });
  }
}
