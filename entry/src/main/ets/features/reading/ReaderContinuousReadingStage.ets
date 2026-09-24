import { FrameCallback } from '@kit.ArkUI';
import { LengthMetrics } from '@ohos.arkui.node';
import { readerMotionNowMs } from '../common/ReaderMotionClock';
import { ReaderPageInputClock } from './ReaderPageInputClock';
import { READER_PAGE_GESTURE_LONG_PRESS_MS } from './ReaderPageGestureState';
import { registerReaderFonts } from '../common/ReaderFonts';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceSnapshot,
} from './ReaderAppearanceState';
import { ReaderNativeParagraphView } from './ReaderNativeParagraphView';
import { ReaderNativeParagraphPosition, ReaderNativeParagraphRecipe, ReaderNativeParagraphPreparation,
  ReaderNativeParagraphResource, prepareReaderNativeParagraph } from './ReaderNativeParagraph';
import { readerThemeDefinition } from '../common/ReaderThemeRegistry';
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

interface ContinuousImageAnchor {
  id: string;
  y: number;
  height: number;
  fraction: number;
  manualScroll: number;
  generation: number;
}

const CONTINUOUS_TAP_SLOP = 12;
const CONTINUOUS_TITLE_ID = 'continuous-title';

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
  @Prop @Watch('onChapterIdentityChanged') geometryKey: string = '';
  titleRecipeProvider: () => ReaderNativeParagraphRecipe | undefined = (): ReaderNativeParagraphRecipe | undefined => undefined;
  @Prop @Watch('onContentRevisionChanged') contentRevision: number = 0;
  @Prop changedFragmentIndex: number = -1;
  // Keep chapter content behind a callback. ArkUI V1 may retain the first
  // complex-array value passed through @Prop even while primitive props such
  // as chapterTitle update, producing a mixed new-title/old-body frame.
  fragmentsProvider: () => ReadingSurfacePageFragment[] =
    (): ReadingSurfacePageFragment[] => [];
  @Prop initialFragmentIndex: number = 0;
  @Prop initialFragmentProgress: number = 0;
  @Prop @Watch('onInitialScrollAnchorChanged') initialAnchorRevision: number = 0;
  @Prop layout: ReaderReadingLayoutSnapshot = createDefaultReaderReadingLayout();
  @Prop appearance: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop ttsHighlightStart: number | undefined = undefined;
  @Prop ttsHighlightEnd: number | undefined = undefined;
  @Prop autoPageHighlightStart: number | undefined = undefined;
  @Prop autoPageHighlightEnd: number | undefined = undefined;
  @Prop longPressSelectText: boolean = false;
  @Prop @Watch('onInteractionEnabledChanged') interactionEnabled: boolean = true;

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
  private readonly listScroller: Scroller = new Scroller();
  private readonly fragmentDataSource: ContinuousFragmentDataSource = new ContinuousFragmentDataSource();
  private initialScrollPending: boolean = true;
  private initialScrollRequested: boolean = false;
  private initialScrollCancelledByInput: boolean = false;
  private initialScrollListIndex: number = -1;
  private initialScrollOffsetVp: number = 0;
  private initialSemanticAnchorProtected: boolean = false;
  private programmaticScrollPending: boolean = false;
  private initialParagraph: ReaderNativeParagraphPreparation | undefined;
  private initialParagraphKey: string = '';
  @State private listMountIdentity: string = '';
  private titleItemCount: number = 0;
  private touchActive: boolean = false;
  private touchPointerId: number = -1;
  private mounted: boolean = false;
  private listAttached: boolean = false;
  private imageAnchorGeneration: number = 0;
  private pendingImageAnchor: ContinuousImageAnchor | undefined = undefined;
  private touchMoved: boolean = false;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private touchStartTimeMs: number = 0;
  private inputClock: ReaderPageInputClock = new ReaderPageInputClock();
  private completedStationaryTouch: boolean = false;
  private manualInteractionReported: boolean = false;
  private visibleFragmentStart: number = 0;
  private visibleFragmentEnd: number = 0;
  private initialScrollGeneration: number = 0;
  private readonly paragraphPositions: Map<string, ReaderNativeParagraphPosition> = new Map();
  private readonly paragraphPositionOwners: Map<string, string> = new Map();
  private readonly fragmentIndexById: Map<string, number> = new Map();
  private lastAppliedContentRevision: number = -1;

  aboutToAppear(): void {
    this.mounted = true;
    this.onAnchorSamplerReady((): void => this.reportCurrentVisibleRange());
    registerReaderFonts(this.getUIContext().getFont());
    this.reloadFragments();
    this.onScrollerReady(this.listScroller);
    this.onProgrammaticScrollReady((): void => this.beginProgrammaticScroll());
    this.scheduleInitialScroll();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.listAttached = false;
    this.initialScrollGeneration += 1;
    this.imageAnchorGeneration += 1;
    this.pendingImageAnchor = undefined;
    this.onAnchorSamplerReady(undefined);
    this.resetTouch();
    this.onScrollerReady(undefined);
    this.onProgrammaticScrollReady(undefined);
    this.programmaticScrollPending = false;
    this.paragraphPositions.clear();
    this.paragraphPositionOwners.clear();
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

      ForEach([this.listMountIdentity], (mountIdentity: string) => {
      List({ space: 0, scroller: this.listScroller, initialIndex: this.initialListIndex() }) {
        // The List owns a notifying data source so only the viewport and its
        // small cache are materialized for long chapters. Stable fragment ids
        // preserve unaffected rows when an image refreshes this projection.
        LazyForEach(this.fragmentDataSource,
          (fragment: ReadingSurfacePageFragment, index: number) => {
          ListItem() {
            Column() {
              if (fragment.id === CONTINUOUS_TITLE_ID) {
                if (this.titleRecipeProvider() !== undefined) {
                  ReaderNativeParagraphView({ recipe: this.titleRecipeProvider()!,
                    inkColor: readerAppearanceThemeStyle(this.appearance.activeTheme).ink })
                    .margin({ bottom: this.layout.titleToBodySpacingVp });
                }
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
                    selectionColor: readerThemeDefinition(this.appearance.activeTheme).selection,
                    highlightStart: this.ttsHighlightStart ?? this.autoPageHighlightStart,
                    highlightEnd: this.ttsHighlightEnd ?? this.autoPageHighlightEnd,
                    highlightColor: this.ttsHighlightStart !== undefined ?
                      readerAppearanceThemeStyle(this.appearance.activeTheme).ink :
                      readerThemeDefinition(this.appearance.activeTheme).selection,
                    underline: this.ttsHighlightStart !== undefined,
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
        }, (fragment: ReadingSurfacePageFragment): string => this.fragmentRenderKey(fragment));
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
    }
    .width('100%')
    .height('100%')
    .clip(true);
  }

  private fragmentRenderKey(fragment: ReadingSurfacePageFragment): string {
    // LazyForEach retains the built branch for an unchanged key, even when
    // onDataReloaded replaces a plain fragment object. A decoded image must
    // replace its former Blank branch; untouched text/image rows keep keys.
    const imageRevision = fragment.text.length === 0 ?
      `:${fragment.fileUri ?? ''}:${fragment.imageHeight}:${fragment.imageWidthBasisPoints}` : '';
    return `${this.chapterIdentity}:${this.geometryKey}:${fragment.id}${imageRevision}`;
  }

  private hasTitleItem(): boolean {
    return this.titleItemCount > 0;
  }

  private handleTouch(event: TouchEvent): void {
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
      this.cancelInitialScrollForInput();
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
    if (!this.interactionEnabled || !this.completedStationaryTouch || event.fingerList.length === 0) {
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
    if (this.interactionEnabled) return;
    this.completedStationaryTouch = false;
    this.resetTouch();
  }

  private resetTouch(): void {
    const pointerId = this.touchPointerId;
    this.touchActive = false;
    this.touchPointerId = -1;
    this.touchMoved = false;
    if (pointerId >= 0) this.onPointerEnd(pointerId);
  }

  private reportCurrentVisibleRange(): void {
    if (!this.mounted || this.initialScrollPending || this.initialSemanticAnchorProtected) return;
    const title = this.hasTitleItem() ? 1 : 0;
    this.reportVisibleRange(this.visibleFragmentStart + title, this.visibleFragmentEnd + title);
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
    if (this.initialScrollPending || this.initialSemanticAnchorProtected) {
      return;
    }
    let startProgress = 0;
    try {
      if (start >= titleOffset) {
        const rect = this.listScroller.getItemRect(start);
        if (rect.height <= 0) return;
        const fragment = fragments[startFragment];
        const position = this.paragraphPositions.get(fragment.id);
        const y = Math.max(0, this.layout.contentTop - rect.y -
          ((fragment.continuousSpaceBefore ?? (startFragment > 0)) && fragment.isParagraphStart ? this.appearance.paragraphSpacing : 0));
        const span = fragment.endScalar - fragment.startScalar;
        if (fragment.nativeParagraph !== undefined && position === undefined) return;
        startProgress = position !== undefined && span > 0 ?
          Math.max(0, Math.min(1, (position.scalarForY(y) - fragment.startScalar) / span)) :
          Math.max(0, Math.min(1, y / rect.height));
      }
    } catch (_) {
      // Missing geometry is not a new reading position. Keep the last
      // canonical anchor until a real layout callback can refine it.
      return;
    }
    this.onVisibleRangeChanged(startFragment, endFragment, startProgress);
  }

  private acceptParagraphPosition(id: string, owner: string,
    position: ReaderNativeParagraphPosition | undefined, mountIdentity: string = this.listMountIdentity): void {
    if (!this.mounted || mountIdentity !== this.listMountIdentity) return;
    if (position === undefined) {
      if (this.paragraphPositionOwners.get(id) !== owner) return;
      this.paragraphPositions.delete(id); this.paragraphPositionOwners.delete(id);
    } else {
      // Lazy rows can report after a geometry replacement. Only the current
      // original paragraph recipe may supply this row's line coordinates.
      const index = this.fragmentIndexById.get(id);
      const current = index === undefined ? undefined : this.fragmentsProvider()[index];
      if (current?.nativeParagraph?.key !== owner) return;
      this.paragraphPositionOwners.set(id, owner); this.paragraphPositions.set(id, position);
    }
  }

  private onInitialScrollAnchorChanged(): void {
    this.scheduleInitialScroll();
  }

  private onChapterIdentityChanged(): void {
    this.completedStationaryTouch = false;
    this.resetTouch();
    this.imageAnchorGeneration += 1;
    this.pendingImageAnchor = undefined;
    this.paragraphPositions.clear();
    this.paragraphPositionOwners.clear();
    this.reloadFragments();
    this.scheduleInitialScroll();
  }

  private onContentScrollStopped(): void {
    this.programmaticScrollPending = false;
    if (this.initialScrollPending && this.initialScrollRequested) this.confirmInitialScroll(this.initialScrollGeneration);
    if (!this.mounted || this.initialScrollPending) return;
    this.reportCurrentVisibleRange();
    this.onScrollStopped();
  }

  private onContentScrolled(offset: number, state: ScrollState): void {
    if (offset !== 0 && ((this.touchActive && state === ScrollState.Scroll) || this.programmaticScrollPending)) {
      this.initialScrollPending = false;
      this.initialSemanticAnchorProtected = false;
      this.programmaticScrollPending = false;
    }
    if (this.initialScrollPending && this.initialScrollRequested) this.confirmInitialScroll(this.initialScrollGeneration);
    if (this.pendingImageAnchor !== undefined && state !== ScrollState.Idle) {
      this.pendingImageAnchor.manualScroll += offset;
    }
    this.reportCurrentVisibleRange();
  }

  private onContentRevisionChanged(): void {
    const fragments = this.fragmentsProvider();
    const changed = this.changedFragmentIndex;
    const previous = this.fragmentDataSource.getData(this.visibleFragmentStart + this.titleItemCount);
    const titleCount = this.chapterTitle.length > 0 ? 1 : 0;
    const singleRowUpdate = changed >= 0 && changed < fragments.length &&
      this.titleItemCount === titleCount &&
      this.fragmentDataSource.totalCount() === fragments.length + titleCount &&
      this.fragmentDataSource.getData(changed + titleCount)?.id === fragments[changed].id;
    if (changed < 0 && !this.initialScrollPending &&
      this.fragmentDataSource.extend(this.continuousListItems())) {
      this.titleItemCount = this.chapterTitle.length > 0 ? 1 : 0;
      this.rebuildFragmentIndex(fragments);
      this.lastAppliedContentRevision = this.contentRevision;
      const visible = previous === undefined ? -1 : (this.fragmentIndexById.get(previous.id) ?? -1);
      if (visible >= 0) {
        const span = this.visibleFragmentEnd - this.visibleFragmentStart;
        this.visibleFragmentStart = visible;
        this.visibleFragmentEnd = Math.min(fragments.length - 1, visible + span);
      }
      return;
    }
    const coalescedRows = singleRowUpdate && this.contentRevision - this.lastAppliedContentRevision !== 1;
    if (this.pendingImageAnchor === undefined && !this.initialScrollPending &&
      (changed < 0 || coalescedRows || changed <= this.visibleFragmentStart)) {
      const fragment = this.fragmentDataSource.getData(this.visibleFragmentStart + this.titleItemCount);
      if (fragment !== undefined) {
        try {
          const rect = this.listScroller.getItemRect(this.visibleFragmentStart + (this.hasTitleItem() ? 1 : 0));
          this.pendingImageAnchor = { id: fragment.id, y: rect.y, height: rect.height,
            fraction: rect.height > 0 ? Math.max(0, Math.min(1, (this.layout.contentTop - rect.y) / rect.height)) : 0,
            manualScroll: 0, generation: this.imageAnchorGeneration };
          const anchor = this.pendingImageAnchor;
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

  private restoreImageAnchor(anchor: ContinuousImageAnchor): void {
    if (!this.mounted || anchor !== this.pendingImageAnchor || anchor.generation !== this.imageAnchorGeneration) return;
    this.pendingImageAnchor = undefined;
    const index = this.fragmentIndexById.get(anchor.id);
    if (index === undefined) return;
    try {
      const rect = this.listScroller.getItemRect(index + (this.hasTitleItem() ? 1 : 0));
      // Correct only layout displacement. Preserve scrolling performed while
      // this coalesced image batch was waiting for layout, including inertia.
      const delta = rect.y - anchor.y + anchor.manualScroll + anchor.fraction * (rect.height - anchor.height);
      if (Math.abs(delta) > 0.5) this.listScroller.scrollBy(0, delta);
      this.reportCurrentVisibleRange();
    } catch (_error) { /* A newer chapter/row owns the viewport. */ }
  }

  private continuousListItems(): ReadingSurfacePageFragment[] {
    const fragments = this.contentRevision >= 0 ? this.fragmentsProvider() : [];
    if (this.chapterTitle.length === 0) return fragments;
    const previous = this.fragmentDataSource.getData(0);
    const title = previous?.id === CONTINUOUS_TITLE_ID && previous.text === this.chapterTitle ? previous :
      new ReadingSurfacePageFragment(CONTINUOUS_TITLE_ID, this.chapterTitle, false, 0, 0);
    return [title, ...fragments];
  }

  private reloadFragments(): void {
    const fragments = this.fragmentsProvider();
    const items = this.continuousListItems();
    this.titleItemCount = this.chapterTitle.length > 0 ? 1 : 0;
    this.fragmentDataSource.replace(items);
    this.rebuildFragmentIndex(fragments);
    this.lastAppliedContentRevision = this.contentRevision;
  }

  private rebuildFragmentIndex(fragments: ReadingSurfacePageFragment[]): void {
    this.fragmentIndexById.clear();
    for (let index = 0; index < fragments.length; index += 1) {
      this.fragmentIndexById.set(fragments[index].id, index);
    }
  }

  private initialListIndex(): number {
    const fragments = this.fragmentsProvider();
    const index = Math.max(0, Math.min(Math.max(0, fragments.length - 1), this.initialFragmentIndex));
    const startsChapter = index === 0 && fragments[index]?.startScalar === 0 && this.initialFragmentProgress === 0;
    return startsChapter && this.hasTitleItem() ? 0 : index + (this.hasTitleItem() ? 1 : 0);
  }

  private onListAttached(identity: string): void {
    if (!this.mounted || identity !== this.listMountIdentity) return;
    this.listAttached = true;
    this.tryApplyInitialScroll(this.initialScrollGeneration);
  }

  private cancelInitialScrollForInput(): void {
    if (!this.initialScrollPending && !this.initialSemanticAnchorProtected) return;
    this.initialScrollGeneration += 1;
    this.initialScrollCancelledByInput = true;
    // DOWN prevents a late initial receipt; only actual List movement may
    // replace the requested semantic position, including an EOF clamp.
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

  private scheduleInitialScroll(): void {
    if (!this.mounted) return;
    const identity = `${this.chapterIdentity}:${this.geometryKey}:${this.initialAnchorRevision}`;
    if (identity === this.listMountIdentity) return;
    this.initialScrollGeneration += 1;
    this.initialScrollPending = true;
    this.initialScrollRequested = false;
    this.initialScrollCancelledByInput = false;
    this.initialSemanticAnchorProtected = false;
    this.programmaticScrollPending = false;
    this.listAttached = false;
    this.initialScrollListIndex = -1;
    this.releaseInitialParagraph();
    const fragments = this.fragmentsProvider();
    const index = Math.max(0, Math.min(Math.max(0, fragments.length - 1), this.initialFragmentIndex));
    this.visibleFragmentStart = index;
    this.visibleFragmentEnd = index;
    const fragment = fragments[index];
    if (fragment === undefined) throw new Error('CONTINUOUS_INITIAL_CONTENT_UNAVAILABLE');
    const progress = Math.max(0, Math.min(1, this.initialFragmentProgress));
    const scalar = fragment.startScalar + Math.round((fragment.endScalar - fragment.startScalar) * progress);
    const paragraphSpace = (fragment.continuousSpaceBefore ?? (index > 0)) && fragment.isParagraphStart ?
      this.appearance.paragraphSpacing : 0;
    let y: number;
    if (fragment.nativeParagraph !== undefined) {
      this.initialParagraph = prepareReaderNativeParagraph(this.getUIContext(), fragment.nativeParagraph);
      this.initialParagraphKey = fragment.nativeParagraph.key;
      const position = this.initialParagraph.position;
      y = position.yForScalar(scalar);
      this.paragraphPositions.set(fragment.id, position);
      this.paragraphPositionOwners.set(fragment.id, fragment.nativeParagraph.key);
    } else if (fragment.imageHeight > 0) {
      y = fragment.imageHeight * progress;
    } else throw new Error('CONTINUOUS_INITIAL_GEOMETRY_UNAVAILABLE');
    if (!Number.isFinite(y) || y < 0) {
      this.releaseInitialParagraph();
      throw new Error('CONTINUOUS_INITIAL_GEOMETRY_INVALID');
    }
    this.initialScrollListIndex = this.initialListIndex();
    const startsWithTitle = this.hasTitleItem() && this.initialScrollListIndex === 0;
    this.initialScrollOffsetVp = startsWithTitle ? 0 : y + paragraphSpace;
    // Setting this state replaces the real List exactly for navigation or
    // geometry changes. Same-version window growth does not alter identity.
    this.listMountIdentity = identity;
  }

  private tryApplyInitialScroll(generation: number): void {
    if (!this.mounted || !this.listAttached || generation !== this.initialScrollGeneration || !this.initialScrollPending ||
      this.initialScrollRequested || this.initialScrollCancelledByInput || this.initialScrollListIndex < 0) return;
    // API >= 14: onAttach runs before the first List layout, and a nonanimated
    // jump overrides initialIndex. Both coordinates are already prepared.
    // No child onAppear or native resolver may issue the initial command.
    this.listScroller.scrollToIndex(this.initialScrollListIndex, false, ScrollAlign.START,
      { extraOffset: LengthMetrics.vp(this.initialScrollOffsetVp) });
    this.initialScrollRequested = true;
    this.getUIContext().postFrameCallback(new ContinuousLayoutFrame((): void => {
      if (this.confirmInitialScroll(generation)) this.onContentScrollStopped();
    }));
  }

  private confirmInitialScroll(generation: number): boolean {
    if (!this.mounted || generation !== this.initialScrollGeneration || !this.initialScrollPending || !this.initialScrollRequested ||
      this.initialScrollCancelledByInput || this.initialScrollListIndex < 0) return false;
    try {
      const rect = this.listScroller.getItemRect(this.initialScrollListIndex);
      if (rect.height <= 0 || !Number.isFinite(rect.y)) return false;
      const targetY = rect.y + this.initialScrollOffsetVp;
      const exact = Math.abs(targetY - this.layout.contentTop) <= 1;
      // The List applies its legal end clamp in the same initial layout.
      // Accept only a visible requested line at an actual end boundary. Keep
      // that semantic position until real user movement, never save the
      // earlier visual top as if the user had moved backwards.
      const clamped = !exact && this.listScroller.isAtEnd() && targetY >= this.layout.contentTop &&
        targetY < this.layout.viewportHeight - this.layout.contentBottom &&
        this.initialScrollOffsetVp < rect.height;
      if (!exact && !clamped) return false;
      this.initialScrollPending = false;
      this.initialSemanticAnchorProtected = clamped;
      if (clamped) this.onVisibleRangeChanged(this.initialFragmentIndex,
        Math.max(this.initialFragmentIndex, this.visibleFragmentEnd), this.initialFragmentProgress);
      return true;
    } catch (_) { return false; }
  }
}
