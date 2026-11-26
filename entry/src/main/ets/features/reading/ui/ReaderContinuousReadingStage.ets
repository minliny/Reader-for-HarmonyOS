import { ReaderContinuousViewport, type ReaderContinuousImageAnchor } from './ReaderContinuousViewport';
import { FrameCallback } from '@kit.ArkUI';
import type { ReaderQuoteCardAction } from '../application/ReaderShareActions';
import { LengthMetrics } from '@ohos.arkui.node';
import { READER_ACTION_MIN_TARGET } from '../../../ui/controls/ReaderActionAccessibility';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { ReaderPageInputClock } from './ReaderPageInputClock';
import { READER_PAGE_GESTURE_LONG_PRESS_MS } from './ReaderPageGestureState';
import { registerReaderFonts } from '../../../ui/foundation/ReaderFonts';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from '../application/ReaderAppearanceState';
import { ReaderNativeParagraphView } from './ReaderNativeParagraphView';
import { readerNativeTextGeometryKey } from './ReaderNativeTextMeasurement';
import { ReaderNativeParagraphPosition, ReaderNativeParagraphRecipe, ReaderNativeParagraphPreparation,
  ReaderNativeParagraphResource, prepareReaderNativeParagraph } from './ReaderNativeParagraph';
import { readerThemeDefinition } from '../../../ui/foundation/ReaderThemeRegistry';
import { readerAppearanceThemeStyle } from './ReaderAppearanceRenderStyle';
import {
  createDefaultReaderReadingLayout,
  type ReaderReadingLayoutSnapshot,
} from './ReaderLayoutGeometry';
import {
  ReadingSurface,
  ReadingSurfacePageFragment,
} from './ReadingSurface';
import {
  type ReaderPageTurnDirection,
  type ReaderPageTurnOutcome,
} from './ReaderPageGestureState';

class ContinuousLayoutFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

const CONTINUOUS_TAP_SLOP = 12;
const CONTINUOUS_TITLE_ID = 'continuous-title';

class ContinuousFragmentDataSource implements IDataSource {
  private items: ReadingSurfacePageFragment[];
  constructor(items: ReadingSurfacePageFragment[] = []) { this.items = items; }
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
  /** Same-version growth only: preserve every existing object and native row.
   * The two notifications each describe their current data source state. */
  extend(items: ReadingSurfacePageFragment[]): boolean {
    if (this.items.length === 0 || items.length <= this.items.length) return false;
    const offset = items.findIndex((item: ReadingSurfacePageFragment): boolean => item.id === this.items[0].id);
    if (offset < 0 || offset + this.items.length > items.length) return false;
    for (let index = 0; index < this.items.length; index += 1) {
      if (items[offset + index] !== this.items[index]) return false;
    }
    const oldLength = this.items.length;
    const suffix = items.slice(offset + oldLength);
    if (suffix.length > 0) {
      this.items = this.items.concat(suffix);
      for (const listener of this.listeners) listener.onDatasetChange([
        { type: DataOperationType.ADD, index: oldLength, count: suffix.length }]);
    }
    if (offset > 0) {
      this.items = items;
      for (const listener of this.listeners) listener.onDatasetChange([
        { type: DataOperationType.ADD, index: 0, count: offset }]);
    }
    return true;
  }

  update(index: number, item: ReadingSurfacePageFragment): void {
    if (index < 0 || index >= this.items.length) {
      return;
    }
    this.items[index] = item;
    for (const listener of this.listeners) listener.onDataChange(index);
  }
}

/** All chapter and initial-position facts are read through one published revision. */
export interface ReaderContinuousRenderFrame {
  chapterIdentity: string;
  chapterTitle: string;
  geometryKey: string;
  titleRecipe: ReaderNativeParagraphRecipe | undefined;
  fragments: ReadingSurfacePageFragment[];
  changedFragmentIndex: number;
  initialFragmentIndex: number;
  initialFragmentProgress: number;
  initialAnchorRevision: number;
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
  @Prop @Watch('onContentRevisionChanged') contentRevision: number = 0;
  // The provider delivers a single frame. Separate @Prop watchers can observe
  // the new title before the corresponding fragments and anchor are assigned.
  frameProvider: () => ReaderContinuousRenderFrame | undefined =
    (): ReaderContinuousRenderFrame | undefined => undefined;
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;
  @Prop autoPageHighlightStart: number | undefined = undefined;
  @Prop autoPageHighlightEnd: number | undefined = undefined;
  @Prop longPressSelectText: boolean = false;
  selectionInputCurrent: (() => boolean) | undefined = undefined;
  quoteCardAction: ReaderQuoteCardAction | undefined = undefined;
  onSelectionActivity: ((owner: string, active: boolean) => void) | undefined = undefined;
  @Prop @Watch('onInteractionEnabledChanged') interactionEnabled: boolean = true;
  @Prop @Watch('onInputRevisionChanged') inputRevision: number = 0;
  inputCurrent: ((revision: number) => boolean) | undefined = undefined;
  onInputLost: (revision: number) => void = (_revision: number): void => {};

  onVisibleRangeChanged: (startFragment: number, endFragment: number, startProgress: number) => void =
    (_startFragment: number, _endFragment: number, _startProgress: number): void => {};
  onScrollStopped: () => void = (): void => {};
  onReachStart: () => void = (): void => {};
  onReachEnd: () => void = (): void => {};
  onBoundaryDrag: (direction: 'previous' | 'next') => void =
    (_direction: 'previous' | 'next'): void => {};
  onTurn: (direction: ReaderPageTurnDirection) => ReaderPageTurnOutcome =
    (_direction: ReaderPageTurnDirection): ReaderPageTurnOutcome => ({ kind: 'busy' });
  onOpenControl: () => void = (): void => {};
  onManualInteraction: () => void = (): void => {};
  onPointerStart: (pointerId: number) => boolean = (_pointerId: number): boolean => true;
  onPointerEnd: (pointerId: number) => void = (_pointerId: number): void => {};
  onScrollerReady: (scroller: Scroller | undefined) => void =
    (_scroller: Scroller | undefined): void => {};
  onProgrammaticScrollReady: (begin: (() => void) | undefined) => void =
    (_begin: (() => void) | undefined): void => {};

  onAnchorSamplerReady: (sample: (() => void) | undefined) => void =
    (_sample: (() => void) | undefined): void => {};
  private listScroller: Scroller = new Scroller();
  private fragmentDataSource: ContinuousFragmentDataSource = new ContinuousFragmentDataSource();
  private renderFrame: ReaderContinuousRenderFrame | undefined = undefined;
  private readonly viewport: ReaderContinuousViewport<ReadingSurfacePageFragment> =
    new ReaderContinuousViewport<ReadingSurfacePageFragment>();
  private programmaticScrollPending: boolean = false;
  private initialParagraph: ReaderNativeParagraphPreparation | undefined;
  private initialParagraphKey: string = '';
  @State private listMountIdentity: string = '';
  private titleItemCount: number = 0;
  private touchActive: boolean = false;
  private touchPointerId: number = -1;
  private mounted: boolean = false;
  private listAttached: boolean = false;
  private touchMoved: boolean = false;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTimeMs: number = 0;
  private inputClock: ReaderPageInputClock = new ReaderPageInputClock();
  private completedStationaryTouch: boolean = false;
  private manualInteractionReported: boolean = false;
  private lastAppliedContentRevision: number = -1;

  aboutToAppear(): void {
    this.mounted = true;
    this.onAnchorSamplerReady((): void => this.reportCurrentVisibleRange());
    registerReaderFonts(this.getUIContext().getFont());
    this.onContentRevisionChanged();
    this.onProgrammaticScrollReady((): void => this.beginProgrammaticScroll());
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.listAttached = false;
    this.viewport.retireInitialReceipt();
    this.viewport.retireImageAnchor();
    this.onAnchorSamplerReady(undefined);
    this.resetTouch();
    this.onScrollerReady(undefined);
    this.onProgrammaticScrollReady(undefined);
    this.programmaticScrollPending = false;
    this.viewport.clearParagraphPositions();
    this.releaseInitialParagraph();
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

      ForEach(this.listMountIdentity.length > 0 ? [this.listMountIdentity] : [], (mountIdentity: string) => {
      List({ space: 0, scroller: this.listScroller, initialIndex: this.viewport.initialListIndex }) {
        // The List owns a notifying data source so only the viewport and its
        // small cache are materialized for long chapters. Stable fragment ids
        // preserve unaffected rows when an image refreshes this projection.
        LazyForEach(this.fragmentDataSource,
          (fragment: ReadingSurfacePageFragment, index: number) => {
          ListItem() {
            Column() {
              if (fragment.id === CONTINUOUS_TITLE_ID) {
                // A retained outgoing row must keep its own measured title
                // until native disposal, even after the provider moves on.
                ForEach(this.titleRecipes(),
                  (recipe: ReaderNativeParagraphRecipe) => {
                  ReaderNativeParagraphView({ recipe,
                    inkColor: readerAppearanceThemeStyle(this.appearance.activeTheme).ink })
                    .margin({ bottom: this.layout.titleToBodySpacingVp });
                }, (recipe: ReaderNativeParagraphRecipe): string => recipe.key);
              } else {
              if ((fragment.continuousSpaceBefore ?? (index > (this.hasTitleItem() ? 1 : 0))) && fragment.isParagraphStart) {
                Blank().height(this.appearance.paragraphSpacing);
              }
              if (fragment.fileUri !== undefined && fragment.fileUri.length > 0) {
                Image(fragment.fileUri)
                  .width(`${fragment.imageWidthBasisPoints / 100}%`)
                  .height(fragment.imageHeight)
                  .objectFit(ImageFit.Contain)
                  .interpolation(ImageInterpolation.High);
              } else if (fragment.imageSource !== undefined) {
                Image(fragment.imageSource)
                  .width(`${fragment.imageWidthBasisPoints / 100}%`)
                  .height(fragment.imageHeight)
                  .objectFit(ImageFit.Contain)
                  .interpolation(ImageInterpolation.High);
              } else if (fragment.imageHeight > 0) {
                Blank().height(fragment.imageHeight);
              } else {
                if (fragment.nativeParagraph !== undefined) {
                  ReaderNativeParagraphView({
                    recipe: fragment.nativeParagraph,
                    resourceProvider: (): ReaderNativeParagraphResource | undefined =>
                      fragment.nativeParagraph?.key === this.initialParagraphKey ? this.initialParagraph?.resource : undefined,
                    inkColor: readerAppearanceThemeStyle(this.appearance.activeTheme).ink,
                    selectionEnabled: this.longPressSelectText,
                    selectionInputCurrent: (): boolean => this.selectionInputCurrent?.() !== false,
                    quoteCardAction: this.quoteCardAction,
                    onSelectionActivity: this.onSelectionActivity,
                    selectionColor: readerThemeDefinition(this.appearance.activeTheme).selection,
                    highlightStart: this.ttsHighlightStart ?? this.autoPageHighlightStart,
                    highlightEnd: this.ttsHighlightEnd ?? this.autoPageHighlightEnd,
                    highlightColor: this.ttsHighlightStart !== undefined ?
                      readerAppearanceThemeStyle(this.appearance.activeTheme).ink :
                      readerThemeDefinition(this.appearance.activeTheme).selection,
                    underline: this.ttsHighlightStart !== undefined,
                    highlightLayoutKey: readerNativeTextGeometryKey(fragment.nativeParagraph.style),
                    localHighlights: true,
                    localHighlightViewportHeight: this.layout.viewportHeight,
                    onPositionResolver: (position: ReaderNativeParagraphPosition | undefined): void => {
                      this.acceptParagraphPosition(fragment.id, fragment.nativeParagraph?.key ?? '', position, mountIdentity);
                    },
                  });
                }
              }
              }
            }
            .width('100%')
            .alignItems(HorizontalAlign.Start);
          }
          .width('100%');
        }, (fragment: ReadingSurfacePageFragment): string => this.fragmentRenderKey(fragment, mountIdentity));
      }
      .id('reader-reading-interaction-host-continuous')
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
      .maintainVisibleContentPosition(true)
      .enabled(this.interactionEnabled)
      .onAttach((): void => this.onListAttached(mountIdentity))
      .onScrollIndex((start: number, end: number, _center: number): void => {
        if (mountIdentity === this.listMountIdentity) this.reportVisibleRange(start, end);
      })
      .onDidScroll((offset: number, state: ScrollState): void => {
        if (mountIdentity === this.listMountIdentity) this.onContentScrolled(offset, state);
      })
      .onScrollStop((): void => {
        if (mountIdentity === this.listMountIdentity) this.onContentScrollStopped();
      })
      .onReachStart((): void => { if (mountIdentity === this.listMountIdentity) this.onReachStart(); })
      .onReachEnd((): void => { if (mountIdentity === this.listMountIdentity) this.onReachEnd(); })
      // List may synthesize ClickEvent/TapGesture after an edge drag on a
      // chapter shorter than the viewport. Classify the raw pointer sequence
      // first; the tap recognizer is admitted only when that sequence did not
      // move, while vertical boundary intent remains owned by onTouch.
      .onTouch((event: TouchEvent): void => {
        if (mountIdentity === this.listMountIdentity) this.handleTouch(event);
      })
      // Observe taps alongside List's built-in vertical pan recognizer. An
      // exclusive gesture here prevents the live List from scrolling on the
      // VM and can also starve native long-press text selection.
      .parallelGesture(
        TapGesture({ fingers: 1, count: 1 })
          .onAction((event: GestureEvent): void => {
            if (mountIdentity === this.listMountIdentity) this.handleStationaryTap(event);
          }),
      );
      }, (mountIdentity: string): string => mountIdentity);
      this.accessibleOpenControlCarrier();
    }
    .width('100%')
    .height('100%')
    .clip(true);
  }

  @Builder
  private accessibleOpenControlCarrier() {
    // A sibling keeps the List and its paragraphs in the native accessibility tree.
    Row().width(READER_ACTION_MIN_TARGET).height(READER_ACTION_MIN_TARGET)
      .position({ x: this.accessibleControlOffset(this.layout.viewportWidth),
        y: this.accessibleControlOffset(this.layout.viewportHeight) })
      .hitTestBehavior(HitTestMode.None)
      .accessibilityLevel('no')
      .accessibilityVirtualNode(this.accessibleOpenControl);
  }

  @Builder
  private accessibleOpenControl() {
    Text('打开阅读控制栏').id('reader-continuous-action-control')
      .width(READER_ACTION_MIN_TARGET).height(READER_ACTION_MIN_TARGET)
      .accessibilityText('打开阅读控制栏')
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityLevel(this.accessibleControlAvailable() ? 'yes' : 'no')
      .enabled(this.accessibleControlAvailable())
      .onClick((): void => this.activateControlFromAccessibility());
  }

  private accessibleControlOffset(viewportExtent: number): number {
    return Number.isFinite(viewportExtent) ? Math.max(0, (viewportExtent - READER_ACTION_MIN_TARGET) / 2) : 0;
  }

  private accessibleControlAvailable(): boolean {
    return this.interactionEnabled &&
      Number.isFinite(this.layout.viewportWidth) && this.layout.viewportWidth >= READER_ACTION_MIN_TARGET &&
      Number.isFinite(this.layout.viewportHeight) && this.layout.viewportHeight >= READER_ACTION_MIN_TARGET;
  }

  private activateControlFromAccessibility(): void {
    if (!this.mounted || this.touchActive || !this.accessibleControlAvailable() || !this.acceptCurrentInput()) return;
    this.onOpenControl();
  }

  private fragmentRenderKey(fragment: ReadingSurfacePageFragment, mountIdentity: string): string {
    // LazyForEach retains the built branch for an unchanged key, even when
    // onDataReloaded replaces a plain fragment object. A decoded image must
    // replace its former Blank branch; untouched text/image rows keep keys.
    const imageRevision = fragment.text.length === 0 ?
      `:${fragment.fileUri ?? ''}:${fragment.imageHeight}:${fragment.imageWidthBasisPoints}` : '';
    return `${mountIdentity}:${fragment.id}${imageRevision}`;
  }

  private hasTitleItem(): boolean {
    return this.titleItemCount > 0;
  }

  private handleTouch(event: TouchEvent): void {
    if (!this.acceptCurrentInput()) return;
    if (!this.interactionEnabled) {
      this.resetTouch();
      return;
    }
    if (event.type === TouchType.Cancel) {
      this.completedStationaryTouch = false; this.resetTouch(); return;
    }
    const touch = event.type === TouchType.Down ?
      (event.changedTouches.length > 0 ? event.changedTouches[0] : event.touches[0]) :
      (event.type === TouchType.Up ? event.changedTouches : event.touches.concat(event.changedTouches))
        .find((pointer: TouchObject): boolean => pointer.id === this.touchPointerId);
    if (event.type === TouchType.Down) {
      if (this.touchActive) return;
      this.completedStationaryTouch = false;
      this.manualInteractionReported = false;
      if (touch === undefined) {
        this.resetTouch();
        return;
      }
      // Register DOWN even before the native List has recognized movement.
      // Auto Page, volume keys and queued work share this physical owner.
      if (!this.onPointerStart(touch.id)) return;
      this.programmaticScrollPending = false;
      this.viewport.cancelInitialForInput();
      this.touchPointerId = touch.id;
      this.touchActive = true;
      this.touchMoved = false;
      this.touchStartX = touch.x;
      this.touchStartY = touch.y;
      this.inputClock = new ReaderPageInputClock();
      this.touchStartTimeMs = this.inputClock.sample(event.timestamp, readerMotionNowMs());
      return;
    }
    if (!this.touchActive || touch === undefined) {
      return;
    }
    const eventTimeMs = this.inputClock.sample(event.timestamp, readerMotionNowMs());
    const moved = Math.abs(touch.x - this.touchStartX) > CONTINUOUS_TAP_SLOP ||
      Math.abs(touch.y - this.touchStartY) > CONTINUOUS_TAP_SLOP;
    this.touchMoved = this.touchMoved || moved;
    if (event.type === TouchType.Move) {
      if (this.touchMoved) {
        this.reportManualInteraction();
      }
      return;
    }
    const deltaX = touch.x - this.touchStartX;
    const deltaY = touch.y - this.touchStartY;
    // List can recognize a stationary six-second press as a TapGesture.
    // Use the same input clock and long-press boundary as paged reading.
    this.completedStationaryTouch = event.type === TouchType.Up && !this.touchMoved &&
      eventTimeMs - this.touchStartTimeMs < READER_PAGE_GESTURE_LONG_PRESS_MS;
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
    if (!this.acceptCurrentInput() || !this.interactionEnabled || !this.completedStationaryTouch || event.fingerList.length === 0) {
      return;
    }
    this.completedStationaryTouch = false;
    const localX = event.fingerList[0].localX;
    if (localX >= this.layout.viewportWidth / 3 &&
      localX <= this.layout.viewportWidth * 2 / 3) {
      this.onOpenControl();
      return;
    }
    this.reportManualInteraction();
    this.onTurn(localX < this.layout.viewportWidth / 3 ? 'previous' : 'next');
  }

  private reportManualInteraction(): void {
    if (this.manualInteractionReported) return;
    this.manualInteractionReported = true;
    // Movement intent can be horizontal or rejected by the List. Only an
    // actual native scroll receipt may replace an unconfirmed entry anchor.
    this.onManualInteraction();
  }

  private onInteractionEnabledChanged(): void {
    if (!this.acceptCurrentInput()) return;
    if (this.interactionEnabled) return;
    this.completedStationaryTouch = false;
    this.resetTouch();
  }

  private acceptCurrentInput(): boolean {
    if (this.inputCurrent?.(this.inputRevision) !== false) return true;
    this.onInputLost(this.inputRevision);
    this.onInputRevisionChanged();
    return false;
  }

  private onInputRevisionChanged(): void {
    this.completedStationaryTouch = false;
    // The parent has already retired the old pointer. A delayed child receipt
    // must not release a newer pointer with the same native id.
    this.touchActive = false;
    this.touchPointerId = -1;
    this.touchMoved = false;
  }

  private resetTouch(): void {
    const pointerId = this.touchPointerId;
    this.touchActive = false;
    this.touchPointerId = -1;
    this.touchMoved = false;
    if (pointerId >= 0) this.onPointerEnd(pointerId);
  }

  private reportCurrentVisibleRange(): void {
    if (!this.mounted || !this.viewport.allowSemanticReport) return;
    const title = this.hasTitleItem() ? 1 : 0;
    this.reportVisibleRange(this.viewport.visibleStart + title, this.viewport.visibleEnd + title);
  }

  private reportVisibleRange(start: number, end: number): void {
    const fragments = this.renderFrame?.fragments ?? [];
    if (fragments.length === 0) return;
    const titleOffset = this.hasTitleItem() ? 1 : 0;
    const visible = this.viewport.updateVisibleItems(fragments.length, start, end, titleOffset);
    if (!this.viewport.allowSemanticReport) return;
    let startProgress = 0;
    try {
      if (start >= titleOffset) {
        const rect = this.listScroller.getItemRect(start);
        if (rect.height <= 0) return;
        const progress = this.viewport.progressForVisibleRow(fragments[visible.start], visible.start, rect,
          (): number => this.layout.contentTop, (): number => this.appearance.paragraphSpacing);
        if (progress === undefined) return;
        startProgress = progress;
      }
    } catch (_) {
      // Missing geometry is not a new reading position. Keep the last
      // canonical anchor until a real layout callback can refine it.
      return;
    }
    this.onVisibleRangeChanged(visible.start, visible.end, startProgress);
  }

  private acceptParagraphPosition(id: string, owner: string,
    position: ReaderNativeParagraphPosition | undefined, mountIdentity: string = this.listMountIdentity): void {
    if (!this.mounted || mountIdentity !== this.listMountIdentity) return;
    this.viewport.acceptParagraphPosition(id, owner, position,
      (): ReadingSurfacePageFragment[] => this.renderFrame?.fragments ?? []);
  }

  private onContentScrollStopped(): void {
    this.programmaticScrollPending = false;
    if (this.viewport.initialPending && this.viewport.initialRequested) this.confirmInitialScroll(this.viewport.initialGeneration);
    if (!this.mounted || this.viewport.initialPending) return;
    this.reportCurrentVisibleRange();
    this.onScrollStopped();
  }

  private onContentScrolled(offset: number, state: ScrollState): void {
    if (offset !== 0 && ((this.touchActive && state === ScrollState.Scroll) || this.programmaticScrollPending)) {
      this.viewport.admitListMovement();
      this.programmaticScrollPending = false;
    }
    if (this.viewport.initialPending && this.viewport.initialRequested) this.confirmInitialScroll(this.viewport.initialGeneration);
    if (this.viewport.hasImageAnchor && state !== ScrollState.Idle) this.viewport.accumulateImageScroll(offset);
    this.reportCurrentVisibleRange();
  }

  private onContentRevisionChanged(): void {
    if (!this.mounted) return;
    const frame = this.frameProvider();
    if (frame === undefined || frame.fragments.length === 0) return;
    const identity = JSON.stringify([frame.chapterIdentity, frame.geometryKey, frame.initialAnchorRevision]);
    if (identity !== this.listMountIdentity) {
      this.mountListAtAnchor(frame, identity);
      return;
    }
    this.renderFrame = frame;
    const fragments = frame.fragments;
    const changed = frame.changedFragmentIndex;
    const previous = this.fragmentDataSource.getData(this.viewport.visibleStart + this.titleItemCount);
    const titleCount = frame.chapterTitle.length > 0 ? 1 : 0;
    const singleRowUpdate = changed >= 0 && changed < fragments.length &&
      this.titleItemCount === titleCount &&
      this.fragmentDataSource.totalCount() === fragments.length + titleCount &&
      this.fragmentDataSource.getData(changed + titleCount)?.id === fragments[changed].id;
    if (changed < 0 && !this.viewport.initialPending &&
      this.fragmentDataSource.extend(this.continuousListItems())) {
      this.titleItemCount = titleCount;
      this.viewport.reindex(fragments);
      this.lastAppliedContentRevision = this.contentRevision;
      this.viewport.retainVisibleRows(previous?.id, fragments.length);
      return;
    }
    const coalescedRows = singleRowUpdate && this.contentRevision - this.lastAppliedContentRevision !== 1;
    if (!this.viewport.hasImageAnchor && !this.viewport.initialPending &&
      (changed < 0 || coalescedRows || changed <= this.viewport.visibleStart)) {
      const fragment = this.fragmentDataSource.getData(this.viewport.visibleStart + this.titleItemCount);
      if (fragment !== undefined) {
        try {
          const rect = this.listScroller.getItemRect(this.viewport.visibleStart + (this.hasTitleItem() ? 1 : 0));
          const anchor = this.viewport.captureImageAnchor(fragment.id, rect, (): number => this.layout.contentTop);
          this.getUIContext().postFrameCallback(new ContinuousLayoutFrame((): void => {
            this.restoreImageAnchor(anchor);
          }));
        } catch (_error) { /* A recycled row will report its next actual anchor. */ }
      }
    }
    if (singleRowUpdate) {
      if (coalescedRows) {
        // ArkUI may deliver one @Watch callback for several completed image
        // promises. Reconcile their changed objects without remounting the List.
        for (let index = 0; index < fragments.length; index += 1) {
          if (this.fragmentDataSource.getData(index + titleCount)?.id !== fragments[index].id) {
            this.reloadFragments();
            return;
          }
          if (this.fragmentDataSource.getData(index + titleCount) !== fragments[index]) {
            this.fragmentDataSource.update(index + titleCount, fragments[index]);
          }
        }
      } else {
        this.fragmentDataSource.update(changed + titleCount, fragments[changed]);
      }
      this.lastAppliedContentRevision = this.contentRevision;
      return;
    }
    this.reloadFragments();
  }

  private restoreImageAnchor(anchor: ReaderContinuousImageAnchor): void {
    if (!this.mounted) return;
    const index = this.viewport.consumeImageAnchor(anchor);
    if (index === undefined) return;
    try {
      const rect = this.listScroller.getItemRect(index + (this.hasTitleItem() ? 1 : 0));
      const delta = this.viewport.imageAnchorDelta(anchor, rect);
      if (Math.abs(delta) > 0.5) this.listScroller.scrollBy(0, delta);
      this.reportCurrentVisibleRange();
    } catch (_error) { /* A newer chapter/row owns the viewport. */ }
  }

  private titleRecipes(): ReaderNativeParagraphRecipe[] {
    const recipe = this.renderFrame?.titleRecipe;
    return recipe === undefined || !this.hasTitleItem() ? [] : [recipe];
  }

  private continuousListItems(): ReadingSurfacePageFragment[] {
    const frame = this.renderFrame;
    if (frame === undefined) return [];
    if (frame.chapterTitle.length === 0) return frame.fragments;
    const previous = this.fragmentDataSource.getData(0);
    const title = previous?.id === CONTINUOUS_TITLE_ID && previous.text === frame.chapterTitle ? previous :
      new ReadingSurfacePageFragment(CONTINUOUS_TITLE_ID, frame.chapterTitle, false, 0, 0);
    return [title, ...frame.fragments];
  }

  private reloadFragments(): void {
    const fragments = this.renderFrame?.fragments ?? [];
    this.titleItemCount = (this.renderFrame?.chapterTitle.length ?? 0) > 0 ? 1 : 0;
    this.fragmentDataSource.replace(this.continuousListItems());
    this.viewport.reindex(fragments);
    this.lastAppliedContentRevision = this.contentRevision;
  }

  private onListAttached(identity: string): void {
    if (!this.mounted || identity !== this.listMountIdentity) return;
    this.listAttached = true;
    this.tryApplyInitialScroll(this.viewport.initialGeneration);
    this.onScrollerReady(this.listScroller);
  }

  private releaseInitialParagraph(): void {
    if (this.initialParagraph?.owned) this.initialParagraph.resource.release();
    this.initialParagraph = undefined;
    this.initialParagraphKey = '';
  }

  private beginProgrammaticScroll(): void {
    if (!this.mounted || !this.listAttached) return;
    // The owner calls immediately before its actual scrollPage command.
    // An intent alone never saves a different position; require real movement.
    this.programmaticScrollPending = true;
  }

  private mountListAtAnchor(frame: ReaderContinuousRenderFrame, identity: string): void {
    this.viewport.beginInitialScroll();
    this.viewport.retireImageAnchor();
    this.viewport.clearParagraphPositions();
    this.listAttached = false;
    this.onScrollerReady(undefined);
    this.completedStationaryTouch = false;
    this.resetTouch();
    this.programmaticScrollPending = false;
    this.releaseInitialParagraph();
    const target = this.viewport.initialTarget(frame.fragments, frame.initialFragmentIndex,
      (): number => frame.initialFragmentProgress, (): number => this.appearance.paragraphSpacing);
    const fragment = target.fragment;
    let y: number;
    if (fragment.nativeParagraph !== undefined) {
      this.initialParagraph = prepareReaderNativeParagraph(this.getUIContext(), fragment.nativeParagraph);
      this.initialParagraphKey = fragment.nativeParagraph.key;
      const position = this.initialParagraph.position;
      y = position.yForScalar(target.scalar);
      this.viewport.bindParagraphPosition(fragment.id, fragment.nativeParagraph.key, position);
    } else if (fragment.imageHeight > 0) {
      y = fragment.imageHeight * target.progress;
    } else throw new Error('CONTINUOUS_INITIAL_GEOMETRY_UNAVAILABLE');
    if (!Number.isFinite(y) || y < 0) {
      this.releaseInitialParagraph();
      throw new Error('CONTINUOUS_INITIAL_GEOMETRY_INVALID');
    }
    const hasTitle = (): boolean => frame.chapterTitle.length > 0;
    const index = this.viewport.listIndex(frame.fragments, frame.initialFragmentIndex,
      (): number => frame.initialFragmentProgress, hasTitle);
    this.viewport.setInitialCommand(index, y, target.paragraphSpace, hasTitle);

    // The old native List keeps its own rows and Scroller until disposal.
    // Attach the destination with the exact index and offset already prepared.
    this.renderFrame = frame;
    this.fragmentDataSource = new ContinuousFragmentDataSource(this.continuousListItems());
    this.listScroller = new Scroller();
    this.titleItemCount = hasTitle() ? 1 : 0;
    this.viewport.reindex(frame.fragments);
    this.lastAppliedContentRevision = this.contentRevision;
    this.listMountIdentity = identity;
  }

  private tryApplyInitialScroll(generation: number): void {
    if (!this.mounted || !this.listAttached || !this.viewport.canIssueInitialScroll(generation)) return;
    // API >= 14: onAttach runs before the first List layout, and a nonanimated
    // jump overrides initialIndex. Both coordinates are already prepared.
    // No child onAppear or native resolver may issue the initial command.
    this.listScroller.scrollToIndex(this.viewport.initialListIndex, false, ScrollAlign.START,
      { extraOffset: LengthMetrics.vp(this.viewport.initialOffset) });
    this.viewport.markInitialScrollIssued();
    this.getUIContext().postFrameCallback(new ContinuousLayoutFrame((): void => {
      if (this.confirmInitialScroll(generation)) this.onContentScrollStopped();
    }));
  }

  private confirmInitialScroll(generation: number): boolean {
    if (!this.mounted || !this.viewport.canConfirmInitialScroll(generation)) return false;
    try {
      const rect = this.listScroller.getItemRect(this.viewport.initialListIndex);
      const receipt = this.viewport.admitInitialGeometry(rect, (): number => this.layout.contentTop,
        (): boolean => this.listScroller.isAtEnd(), (): number => this.layout.viewportHeight - this.layout.contentBottom);
      if (receipt === undefined) return false;
      const frame = this.renderFrame;
      if (receipt === 'clamped' && frame !== undefined) this.onVisibleRangeChanged(frame.initialFragmentIndex,
        Math.max(frame.initialFragmentIndex, this.viewport.visibleEnd), frame.initialFragmentProgress);
      return true;
    } catch (_) { return false; }
  }
}
