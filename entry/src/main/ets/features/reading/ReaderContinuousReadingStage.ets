import { registerReaderFonts } from '../common/ReaderFonts';
import { TYPE_READER_CHAPTER_TITLE } from '../common/ReaderTypography';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import { readerAppearanceThemeStyle } from './ReaderAppearanceRenderStyle';
import {
  createDefaultReaderReadingLayout,
  type ReaderReadingLayoutSnapshot,
} from './ReaderLayoutGeometry';
import {
  ReaderReadingTextFragment,
  ReadingSurface,
  type ReadingSurfacePageFragment,
} from './ReadingSurface';

const CONTINUOUS_TAP_SLOP = 12;

class ContinuousFragmentDataSource implements IDataSource {
  private items: ReadingSurfacePageFragment[] = [];
  private listeners: DataChangeListener[] = [];

  totalCount(): number { return this.items.length; }
  getData(index: number): ReadingSurfacePageFragment { return this.items[index]; }
  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) this.listeners.push(listener);
  }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }
  replace(items: ReadingSurfacePageFragment[]): void {
    this.items = items;
    for (const listener of this.listeners) listener.onDataReloaded();
  }
  update(index: number, item: ReadingSurfacePageFragment): void {
    if (index < 0 || index >= this.items.length) {
      return;
    }
    this.items[index] = item;
    for (const listener of this.listeners) listener.onDataChange(index);
  }
}

/**
 * A real vertically scrolling reading surface.
 *
 * The owner still owns chapter materialization and Core progress. This stage
 * owns only one ArkUI List/Scroller and reports the first visible canonical
 * fragment so the owner can persist the same Unicode-scalar anchor used by
 * paged reading.
 */
@Component
export struct ReaderContinuousReadingStage {
  @Prop @Watch('onChapterIdentityChanged') chapterIdentity: string = '';
  @Prop chapterTitle: string = '';
  @Prop @Watch('onContentRevisionChanged') contentRevision: number = 0;
  @Prop changedFragmentIndex: number = -1;
  // Keep chapter content behind a callback. ArkUI V1 may retain the first
  // complex-array value passed through @Prop even while primitive props such
  // as chapterTitle update, producing a mixed new-title/old-body frame.
  fragmentsProvider: () => ReadingSurfacePageFragment[] =
    (): ReadingSurfacePageFragment[] => [];
  @Prop @Watch('onInitialScrollAnchorChanged') initialFragmentIndex: number = 0;
  @Prop @Watch('onInitialScrollAnchorChanged') initialFragmentProgress: number = 0;
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;
  @Prop autoPageHighlightStart: number | undefined = undefined;
  @Prop autoPageHighlightEnd: number | undefined = undefined;
  @Prop longPressSelectText: boolean = false;
  @Prop interactionEnabled: boolean = true;

  onVisibleRangeChanged: (startFragment: number, endFragment: number, startProgress: number) => void =
    (_startFragment: number, _endFragment: number, _startProgress: number): void => {};
  onScrollStopped: () => void = (): void => {};
  onReachStart: () => void = (): void => {};
  onReachEnd: () => void = (): void => {};
  onBoundaryDrag: (direction: 'previous' | 'next') => void =
    (_direction: 'previous' | 'next'): void => {};
  onOpenControl: () => void = (): void => {};
  onManualInteraction: () => void = (): void => {};
  onScrollerReady: (scroller: Scroller | undefined) => void =
    (_scroller: Scroller | undefined): void => {};

  private readonly listScroller: Scroller = new Scroller();
  private readonly fragmentDataSource: ContinuousFragmentDataSource = new ContinuousFragmentDataSource();
  private initialScrollPending: boolean = true;
  private touchActive: boolean = false;
  private touchMoved: boolean = false;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private completedStationaryTouch: boolean = false;
  private visibleFragmentStart: number = 0;
  private visibleFragmentEnd: number = 0;
  private initialScrollGeneration: number = 0;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
    this.reloadFragments();
    this.onScrollerReady(this.listScroller);
    this.scheduleInitialScroll();
  }

  aboutToDisappear(): void {
    this.onScrollerReady(undefined);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // Reuse the exact reading paper implementation; the scrolling content
      // is the only overlay and therefore cannot drift from paged themes.
      ReadingSurface({
        chapterTitle: '',
        showChapterTitle: false,
        pageFragments: [],
        layout: this.layout,
        appearance: this.appearance,
      });

      List({ space: 0, scroller: this.listScroller }) {
        if (this.chapterTitle.length > 0) {
          ListItem() {
            Text(this.chapterTitle)
              .width('100%')
              .fontFamily(TYPE_READER_CHAPTER_TITLE.fontFamily)
              .fontWeight(TYPE_READER_CHAPTER_TITLE.fontWeight)
              .fontSize(TYPE_READER_CHAPTER_TITLE.fontSizeFp)
              .lineHeight(this.layout.titleLineHeightFp)
              .fontColor(readerAppearanceThemeStyle(this.appearance.activeTheme).ink)
              .textAlign(TextAlign.Center)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
              .margin({ bottom: this.layout.titleToBodySpacingVp });
          }
          .width('100%');
        }

        // The List owns a notifying data source so only the viewport and its
        // small cache are materialized for long chapters. Stable fragment ids
        // preserve unaffected rows when an image refreshes this projection.
        LazyForEach(this.fragmentDataSource,
          (fragment: ReadingSurfacePageFragment, index: number) => {
          ListItem() {
            Column() {
              if (index > 0 && fragment.isParagraphStart) {
                Blank().height(this.appearance.paragraphSpacing);
              }
              if (fragment.fileUri !== undefined && fragment.fileUri.length > 0) {
                Image(fragment.fileUri)
                  .width('100%')
                  .height(fragment.imageHeight)
                  .objectFit(ImageFit.Contain)
                  .interpolation(ImageInterpolation.High);
              } else if (fragment.imageSource !== undefined) {
                Image(fragment.imageSource)
                  .width('100%')
                  .height(fragment.imageHeight)
                  .objectFit(ImageFit.Contain)
                  .interpolation(ImageInterpolation.High);
              } else if (fragment.imageHeight > 0) {
                Blank().height(fragment.imageHeight);
              } else {
                ReaderReadingTextFragment({
                  text: fragment.text,
                  isParagraphStart: fragment.isParagraphStart,
                  startScalar: fragment.startScalar,
                  endScalar: fragment.endScalar,
                  appearance: this.appearance,
                  ttsHighlightStart: this.ttsHighlightStart,
                  ttsHighlightEnd: this.ttsHighlightEnd,
                  autoPageHighlightStart: this.autoPageHighlightStart,
                  autoPageHighlightEnd: this.autoPageHighlightEnd,
                  longPressSelectText: this.longPressSelectText,
                });
              }
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start);
          }
          .width('100%');
        }, (fragment: ReadingSurfacePageFragment): string =>
          `${this.chapterIdentity}:${fragment.id}`);
      }
      .width('100%')
      .height('100%')
      .padding({
        top: this.layout.contentTop,
        right: this.layout.contentRight,
        bottom: this.layout.contentBottom,
        left: this.layout.contentLeft,
      })
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.Spring)
      .cachedCount(6)
      .enabled(this.interactionEnabled)
      .onScrollIndex((start: number, end: number, _center: number): void =>
        this.reportVisibleRange(start, end))
      .onScrollStop((): void => this.onScrollStopped())
      .onReachStart((): void => this.onReachStart())
      .onReachEnd((): void => this.onReachEnd())
      // List may synthesize ClickEvent/TapGesture after an edge drag on a
      // chapter shorter than the viewport. Classify the raw pointer sequence
      // first; the tap recognizer is admitted only when that sequence did not
      // move, while vertical boundary intent remains owned by onTouch.
      .onTouch((event: TouchEvent): void => this.handleTouch(event))
      .gesture(
        TapGesture({ fingers: 1, count: 1 })
          .onAction((event: GestureEvent): void => this.handleStationaryTap(event)),
      );
    }
    .width('100%')
    .height('100%')
    .clip(true);
  }

  private hasTitleItem(): boolean {
    return this.chapterTitle.length > 0;
  }

  private handleTouch(event: TouchEvent): void {
    if (!this.interactionEnabled) {
      this.resetTouch();
      return;
    }
    const touch = event.changedTouches.length > 0 ? event.changedTouches[0] : event.touches[0];
    if (event.type === TouchType.Down) {
      this.onManualInteraction();
      this.completedStationaryTouch = false;
      if (touch === undefined) {
        this.resetTouch();
        return;
      }
      this.touchActive = true;
      this.touchMoved = false;
      this.touchStartX = touch.x;
      this.touchStartY = touch.y;
      return;
    }
    if (!this.touchActive || touch === undefined) {
      return;
    }
    const moved = Math.abs(touch.x - this.touchStartX) > CONTINUOUS_TAP_SLOP ||
      Math.abs(touch.y - this.touchStartY) > CONTINUOUS_TAP_SLOP;
    this.touchMoved = this.touchMoved || moved;
    if (event.type === TouchType.Move) {
      return;
    }
    const deltaX = touch.x - this.touchStartX;
    const deltaY = touch.y - this.touchStartY;
    this.completedStationaryTouch = event.type === TouchType.Up && !this.touchMoved;
    const boundaryDirection = event.type === TouchType.Up && Math.abs(deltaY) > CONTINUOUS_TAP_SLOP &&
      Math.abs(deltaY) > Math.abs(deltaX) ? (deltaY < 0 ? 'next' : 'previous') : undefined;
    this.resetTouch();
    if (boundaryDirection === 'next' && this.isScrollerAtEnd()) {
      this.onBoundaryDrag('next');
    } else if (boundaryDirection === 'previous' && this.isScrollerAtStart()) {
      this.onBoundaryDrag('previous');
    }
  }

  private isScrollerAtStart(): boolean {
    try {
      return this.listScroller.currentOffset().yOffset <= 0.5;
    } catch (_) {
      return false;
    }
  }

  private isScrollerAtEnd(): boolean {
    try {
      return this.listScroller.isAtEnd();
    } catch (_) {
      return false;
    }
  }

  private handleStationaryTap(event: GestureEvent): void {
    if (!this.interactionEnabled || !this.completedStationaryTouch || event.fingerList.length === 0) {
      return;
    }
    this.completedStationaryTouch = false;
    const localX = event.fingerList[0].localX;
    if (localX >= this.layout.viewportWidth / 3 &&
      localX <= this.layout.viewportWidth * 2 / 3) {
      this.onOpenControl();
    }
  }

  private resetTouch(): void {
    this.touchActive = false;
    this.touchMoved = false;
  }

  private reportVisibleRange(start: number, end: number): void {
    const fragments = this.fragmentsProvider();
    if (fragments.length === 0) {
      return;
    }
    const titleOffset = this.hasTitleItem() ? 1 : 0;
    const startFragment = Math.max(0, Math.min(fragments.length - 1, start - titleOffset));
    const endFragment = Math.max(startFragment,
      Math.min(fragments.length - 1, end - titleOffset));
    this.visibleFragmentStart = startFragment;
    this.visibleFragmentEnd = endFragment;
    if (this.initialScrollPending) {
      return;
    }
    let startProgress = 0;
    try {
      if (start >= titleOffset) {
        const rect = this.listScroller.getItemRect(start);
        if (rect.height > 0) {
          startProgress = Math.max(0, Math.min(1, -rect.y / rect.height));
        }
      }
    } catch (_) {
      // The visible callback can race a List remount. The fragment start is a
      // safe canonical fallback and the next callback refines the anchor.
    }
    this.onVisibleRangeChanged(startFragment, endFragment, startProgress);
  }

  private onInitialScrollAnchorChanged(): void {
    this.scheduleInitialScroll();
  }

  private onChapterIdentityChanged(): void {
    this.reloadFragments();
    this.scheduleInitialScroll();
  }

  private onContentRevisionChanged(): void {
    const fragments = this.fragmentsProvider();
    if (this.changedFragmentIndex >= 0 && this.changedFragmentIndex < fragments.length) {
      this.fragmentDataSource.update(this.changedFragmentIndex, fragments[this.changedFragmentIndex]);
      return;
    }
    this.fragmentDataSource.replace(fragments);
  }

  private reloadFragments(): void {
    this.fragmentDataSource.replace(this.contentRevision >= 0 ? this.fragmentsProvider() : []);
  }

  private scheduleInitialScroll(): void {
    this.initialScrollGeneration += 1;
    const generation = this.initialScrollGeneration;
    this.initialScrollPending = true;
    const fragments = this.fragmentsProvider();
    const initial = Math.max(0, Math.min(Math.max(0, fragments.length - 1), this.initialFragmentIndex));
    this.visibleFragmentStart = initial;
    this.visibleFragmentEnd = initial;
    setTimeout((): void => {
      if (generation !== this.initialScrollGeneration) {
        return;
      }
      const currentFragments = this.fragmentsProvider();
      if (currentFragments.length === 0) {
        this.initialScrollPending = false;
        return;
      }
      const clamped = Math.max(0, Math.min(currentFragments.length - 1, this.initialFragmentIndex));
      const listIndex = clamped + (this.hasTitleItem() ? 1 : 0);
      try {
        this.listScroller.scrollToIndex(listIndex, false, ScrollAlign.START);
      } catch (_) {
        // A stale remount can release the old Scroller before this microtask.
        this.initialScrollPending = false;
        return;
      }
      // scrollToIndex makes the target row visible first. Defer one layout so
      // getItemRect observes its real wrapped height, then restore the scalar's
      // intra-fragment fraction instead of snapping to the row boundary.
      setTimeout((): void => {
        if (generation !== this.initialScrollGeneration) {
          return;
        }
        try {
          const progress = Math.max(0, Math.min(1, this.initialFragmentProgress));
          const rect = this.listScroller.getItemRect(listIndex);
          if (progress > 0 && rect.height > 0) {
            this.listScroller.scrollBy(0, rect.height * progress);
          }
        } catch (_) {
          // The canonical fragment start remains a bounded fallback if ArkUI
          // releases the row between the two layout turns.
        } finally {
          this.visibleFragmentStart = clamped;
          this.visibleFragmentEnd = clamped;
          this.initialScrollPending = false;
        }
      }, 0);
    }, 0);
  }
}
