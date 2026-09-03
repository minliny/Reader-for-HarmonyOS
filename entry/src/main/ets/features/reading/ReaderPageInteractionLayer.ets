import {
  abandonReaderPageGestureTracking,
  cancelReaderPagePan,
  createReaderPageGestureState,
  finishReaderPagePan,
  READER_PAGE_GESTURE_LONG_PRESS_MS,
  readerPageGestureCanTap,
  readerPagePointerCoordinate,
  readerPageTapIntent,
  startReaderPagePan,
  updateReaderPagePanInPlace,
  type ReaderPageGestureState,
  type ReaderPageGestureDecision,
  type ReaderPageTapIntent,
  type ReaderPageTurnDirection,
  type ReaderPageTurnOutcome,
} from './ReaderPageGestureState';

/** Tap and long press share the frozen HarmonyOS 500ms boundary. */
export const READER_PAGE_TAP_MAX_DURATION_MS = READER_PAGE_GESTURE_LONG_PRESS_MS;
/** Lost UP/CANCEL must never leave controls and page input permanently owned. */
export const READER_PAGE_POINTER_STALL_TIMEOUT_MS = 15000;

/**
 * The single pointer owner above the reading page-turn stage.
 *
 * Raw DOWN/MOVE/UP is used instead of PanGesture so the owner sees the physical
 * pointer before ArkUI's recognition threshold. A pagination request is still
 * emitted at most once, on a valid UP; admitted MOVE samples are forwarded
 * synchronously through the owner's state callback.
 */
@Component
export struct ReaderPageInteractionLayer {
  @Prop @Watch('onInteractionEnabledChanged') interactionEnabled: boolean = true;
  /** While a commit/preparation is non-interruptible, retain only short taps as queued intent. */
  @Prop @Watch('onInteractionModeChanged') tapOnly: boolean = false;
  @Prop viewportWidth: number = 0;
  @Prop viewportHeight: number = 0;
  @Prop allowTextSelection: boolean = false;
  /** Pointer streams beginning in system-owned edge bands never enter the reader arena. */
  @Prop systemGestureLeftInset: number = 16;
  @Prop systemGestureRightInset: number = 16;
  @Prop systemGestureBottomInset: number = 24;

  onTurn: (direction: ReaderPageTurnDirection) => ReaderPageTurnOutcome =
    (_direction: ReaderPageTurnDirection): ReaderPageTurnOutcome => ({ kind: 'busy' });
  /** Readiness/boundary gate checked before the first page-owned visual frame. */
  canStartTurn: (direction: ReaderPageTurnDirection) => boolean =
    (_direction: ReaderPageTurnDirection): boolean => true;
  /** Bookmark preview cannot run while the materialized page context is speculative. */
  canStartBookmark: () => boolean = (): boolean => true;
  onBookmarkStateChange: (state: ReaderPageGestureState) => void =
    (_state: ReaderPageGestureState): void => {};
  onBookmarkRelease: (changed: boolean) => void = (_changed: boolean): void => {};
  onOpenControl: () => void = (): void => {};
  onManualInteraction: () => void = (): void => {};
  /** Reserves one complete pointer segment while the current settlement is non-interruptible. */
  onDeferredSegmentStart: () => boolean = (): boolean => true;
  onDeferredSegmentResolve: (intent: ReaderPageTapIntent | undefined) => void =
    (_intent: ReaderPageTapIntent | undefined): void => {};
  onDeferredSegmentPromote: () => void = (): void => {};
  onGestureStateChange: (state: ReaderPageGestureState) => void =
    (_state: ReaderPageGestureState): void => {};
  onGestureDecision: (decision: ReaderPageGestureDecision) => ReaderPageGestureDecision =
    (decision: ReaderPageGestureDecision): ReaderPageGestureDecision => decision;

  private gestureState: ReaderPageGestureState = createReaderPageGestureState();
  private activePointerId: number = -1;
  private pointerDownTimeMs: number = 0;
  private lastSampleTimeMs: number = 0;
  private lastLocalX: number = 0;
  private lastLocalY: number = 0;
  private velocityX: number = 0;
  private velocityY: number = 0;
  private tapOnlyPointer: boolean = false;
  private pointerRejected: boolean = false;
  private deferredSegmentReserved: boolean = false;
  private manualInteractionReported: boolean = false;
  private pointerWatchdogTimer: number = -1;
  private longPressTimer: number = -1;

  build() {
    Row()
      .width('100%')
      .height('100%')
      // XComponent composition order is device-dependent; make the sole raw
      // input owner explicitly higher while leaving the capsule at zIndex 8.
      .zIndex(7)
      .backgroundColor('#00000000')
      .hitTestBehavior(this.interactionEnabled ?
        (this.allowTextSelection ? HitTestMode.Transparent : HitTestMode.Block) : HitTestMode.None)
      .accessibilityText('阅读翻页区域')
      .accessibilityTextHint('左侧上一页，中间打开阅读控制，右侧下一页')
      .onTouch((event: TouchEvent): void => this.handleTouch(event));
  }

  private handleTouch(event: TouchEvent): void {
    if (!this.interactionEnabled) {
      this.cancelPan();
      return;
    }
    if (event.type === TouchType.Down) {
      // The first effective pointer owns the complete segment. Every later
      // finger is ignored and can neither cancel nor restart it.
      if (this.activePointerId >= 0) {
        return;
      }
      this.startRawPointer(event);
      return;
    }
    if (event.type === TouchType.Cancel) {
      this.cancelPan();
      this.resolveDeferredSegment(undefined);
      this.resetRawPointer();
      return;
    }
    if (this.activePointerId < 0) {
      return;
    }
    const pointer = event.type === TouchType.Up ?
      this.changedPointerForEvent(event) : this.pointerForEvent(event);
    if (pointer === undefined) {
      return;
    }
    if (event.type === TouchType.Move) {
      this.updateRawPointer(event, pointer);
      return;
    }
    if (event.type === TouchType.Up) {
      this.finishRawPointer(event, pointer);
    }
  }

  private startRawPointer(event: TouchEvent): void {
    const pointer = event.changedTouches.length > 0 ? event.changedTouches[0] : event.touches[0];
    if (pointer === undefined) {
      this.cancelPan();
      this.resetRawPointer();
      return;
    }
    if (this.systemOwnsPointer(event, pointer)) {
      // Do not stop propagation: Harmony's back/home recognizer retains the
      // complete DOWN stream and the reader never flashes a provisional turn.
      return;
    }
    const eventTimeMs = this.eventTimeMs(event);
    const localX = this.pageLocalX(event, pointer);
    const localY = this.pageLocalY(event, pointer);
    this.activePointerId = pointer.id;
    this.pointerDownTimeMs = eventTimeMs;
    this.lastSampleTimeMs = this.pointerDownTimeMs;
    this.lastLocalX = localX;
    this.lastLocalY = localY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.tapOnlyPointer = this.tapOnly;
    this.pointerRejected = false;
    if (this.tapOnlyPointer) {
      this.deferredSegmentReserved = this.onDeferredSegmentStart();
      if (!this.deferredSegmentReserved) {
        this.resetRawPointer();
        return;
      }
      // The first pending segment is parsed by the same arena but remains
      // presentation-silent until the current non-interruptible settle ends.
      this.gestureState = startReaderPagePan(
        this.pageViewportWidth(event),
        localX,
        localY,
        eventTimeMs,
        this.pageViewportHeight(event),
      );
      this.armPointerWatchdog();
      this.armLongPressTimer();
      return;
    }
    this.gestureState = startReaderPagePan(
      this.pageViewportWidth(event),
      localX,
      localY,
      eventTimeMs,
      this.pageViewportHeight(event),
    );
    this.onGestureStateChange(this.gestureState);
    this.armPointerWatchdog();
    this.armLongPressTimer();
  }

  private updateRawPointer(event: TouchEvent, pointer: TouchObject): void {
    const localX = this.pageLocalX(event, pointer);
    const localY = this.pageLocalY(event, pointer);
    if (this.tapOnlyPointer) {
      const eventTimeMs = this.eventTimeMs(event);
      this.updateVelocity(localX, localY, eventTimeMs);
      this.gestureState = updateReaderPagePanInPlace(
        this.gestureState,
        localX - this.gestureState.startLocalX,
        localY - this.gestureState.startLocalY,
        this.velocityX,
        localX,
        localY,
        this.velocityY,
        eventTimeMs,
      );
      this.lastLocalX = localX;
      this.lastLocalY = localY;
      this.armPointerWatchdog();
      return;
    }
    if (this.pointerRejected) {
      const eventTimeMs = this.eventTimeMs(event);
      this.updateVelocity(localX, localY, eventTimeMs);
      this.gestureState = updateReaderPagePanInPlace(
        this.gestureState,
        localX - this.gestureState.startLocalX,
        localY - this.gestureState.startLocalY,
        this.velocityX,
        localX,
        localY,
        this.velocityY,
        eventTimeMs,
      );
      this.lastLocalX = localX;
      this.lastLocalY = localY;
      this.armPointerWatchdog();
      return;
    }
    const offsetX = localX - this.gestureState.startLocalX;
    const offsetY = localY - this.gestureState.startLocalY;
    const eventTimeMs = this.eventTimeMs(event);
    this.updateVelocity(localX, localY, eventTimeMs);
    const priorOwner = this.gestureState.owner;
    this.gestureState = updateReaderPagePanInPlace(
      this.gestureState,
      offsetX,
      offsetY,
      this.velocityX,
      localX,
      localY,
      this.velocityY,
      eventTimeMs,
    );
    const pageOwnerBlocked = this.isPageOwner(this.gestureState) &&
      this.gestureState.direction !== undefined && !this.canStartTurn(this.gestureState.direction);
    const bookmarkBlocked = this.gestureState.owner === 'bookmark' && !this.canStartBookmark();
    if (priorOwner === 'undecided' && this.gestureState.owner !== 'undecided') {
      this.reportManualInteraction();
    }
    if (priorOwner === 'undecided' && (pageOwnerBlocked || bookmarkBlocked)) {
      this.pointerRejected = true;
      this.clearLongPressTimer();
      this.ownPointer(event);
      this.lastLocalX = localX;
      this.lastLocalY = localY;
      this.armPointerWatchdog();
      return;
    }
    this.onGestureStateChange(this.gestureState);
    if (this.gestureState.owner === 'bookmark') {
      this.onBookmarkStateChange(this.gestureState);
    }
    this.lastLocalX = localX;
    this.lastLocalY = localY;
    this.armPointerWatchdog();
    if (this.gestureState.owner !== 'undecided' && this.gestureState.owner !== 'longPress') {
      this.ownPointer(event);
      this.clearLongPressTimer();
    }
  }

  private finishRawPointer(event: TouchEvent, pointer: TouchObject): void {
    const localX = this.pageLocalX(event, pointer);
    const localY = this.pageLocalY(event, pointer);
    const viewportWidth = this.pageViewportWidth(event);
    if (this.tapOnlyPointer) {
      const eventTimeMs = this.eventTimeMs(event);
      const offsetX = localX - this.gestureState.startLocalX;
      const offsetY = localY - this.gestureState.startLocalY;
      this.updateVelocity(localX, localY, eventTimeMs);
      let intent: ReaderPageTapIntent | undefined = undefined;
      if (this.gestureState.phase === 'tracking') {
        if (readerPageGestureCanTap(this.gestureState, eventTimeMs)) {
          intent = readerPageTapIntent(localX, viewportWidth);
        }
      } else if (this.gestureState.phase === 'dragging') {
        intent = finishReaderPagePan(
          this.gestureState,
          offsetX,
          offsetY,
          this.velocityX,
          localX,
          localY,
          this.velocityY,
          eventTimeMs,
        ).direction;
      }
      this.gestureState = createReaderPageGestureState();
      if (intent !== undefined && intent !== 'control') {
        this.reportManualInteraction();
      }
      this.resolveDeferredSegment(intent);
      this.resetRawPointer();
      return;
    }
    if (this.pointerRejected) {
      const eventTimeMs = this.eventTimeMs(event);
      const offsetX = localX - this.gestureState.startLocalX;
      const offsetY = localY - this.gestureState.startLocalY;
      this.updateVelocity(localX, localY, eventTimeMs);
      const decision = finishReaderPagePan(
        this.gestureState,
        offsetX,
        offsetY,
        this.velocityX,
        localX,
        localY,
        this.velocityY,
        eventTimeMs,
      );
      this.gestureState = createReaderPageGestureState();
      this.onGestureStateChange(this.gestureState);
      this.resetRawPointer();
      if (decision.direction !== undefined) {
        // A page whose texture was not ready remains presentation-silent, but
        // the final relative position still produces one observable preparing
        // intent instead of silently dropping the complete pointer segment.
        this.reportManualInteraction();
        this.onTurn(decision.direction);
      }
      return;
    }
    const offsetX = localX - this.gestureState.startLocalX;
    const offsetY = localY - this.gestureState.startLocalY;
    const eventTimeMs = this.eventTimeMs(event);
    this.updateVelocity(localX, localY, eventTimeMs);
    this.lastLocalX = localX;
    this.lastLocalY = localY;
    if (this.gestureState.phase === 'tracking') {
      const tapCandidate = readerPageGestureCanTap(this.gestureState, eventTimeMs);
      this.gestureState = abandonReaderPageGestureTracking(this.gestureState);
      this.onGestureStateChange(this.gestureState);
      this.resetRawPointer();
      if (tapCandidate) {
        this.handleRawTap(localX, viewportWidth);
      }
      return;
    }
    let decision = finishReaderPagePan(
      this.gestureState,
      offsetX,
      offsetY,
      this.velocityX,
      localX,
      localY,
      this.velocityY,
      eventTimeMs,
    );
    decision = this.onGestureDecision(decision);
    this.gestureState = decision.state;
    this.onGestureStateChange(this.gestureState);
    if (decision.state.owner === 'bookmark') {
      this.onBookmarkStateChange(decision.state);
    }
    this.ownPointer(event);
    this.resetRawPointer();
    if (decision.state.owner === 'bookmark') {
      this.onBookmarkRelease(decision.bookmarkChanged);
      return;
    }
    if (decision.direction !== undefined) {
      this.onTurn(decision.direction);
    }
  }

  private cancelPan(): void {
    if (this.pointerRejected) {
      this.gestureState = createReaderPageGestureState();
      this.onGestureStateChange(this.gestureState);
      return;
    }
    const cancelled = cancelReaderPagePan(this.gestureState);
    if (cancelled === this.gestureState) {
      return;
    }
    this.gestureState = cancelled;
    this.onGestureStateChange(this.gestureState);
  }

  private handleRawTap(localX: number, viewportWidth: number): void {
    if (!this.interactionEnabled || this.gestureState.phase !== 'idle') {
      return;
    }
    const intent = readerPageTapIntent(localX, viewportWidth);
    if (intent === undefined) {
      return;
    }
    if (intent === 'control') {
      this.onOpenControl();
      return;
    }
    this.reportManualInteraction();
    this.onTurn(intent);
  }

  private eventViewportWidth(event: TouchEvent): number {
    const targetWidth = event.target.area.width;
    if (typeof targetWidth === 'number') {
      return Number.isFinite(targetWidth) && targetWidth > 0 ? targetWidth : this.viewportWidth;
    }
    if (typeof targetWidth === 'string') {
      const normalized = targetWidth.trim();
      const parsed = normalized.indexOf('%') < 0 ? Number.parseFloat(normalized) : Number.NaN;
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return this.viewportWidth;
  }

  private eventViewportHeight(event: TouchEvent): number {
    const targetHeight = event.target.area.height;
    if (typeof targetHeight === 'number') {
      return Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight : this.viewportHeight;
    }
    if (typeof targetHeight === 'string') {
      const normalized = targetHeight.trim();
      const parsed = normalized.indexOf('%') < 0 ? Number.parseFloat(normalized) : Number.NaN;
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return this.viewportHeight;
  }

  private pageViewportWidth(event: TouchEvent): number {
    return Number.isFinite(this.viewportWidth) && this.viewportWidth > 0 ?
      this.viewportWidth : this.eventViewportWidth(event);
  }

  private pageViewportHeight(event: TouchEvent): number {
    return Number.isFinite(this.viewportHeight) && this.viewportHeight > 0 ?
      this.viewportHeight : this.eventViewportHeight(event);
  }

  private pageLocalX(event: TouchEvent, pointer: TouchObject): number {
    const left = this.finiteInset(this.systemGestureLeftInset);
    const right = this.finiteInset(this.systemGestureRightInset);
    const logicalExtent = Math.max(1, this.eventViewportWidth(event) - left - right);
    return readerPagePointerCoordinate(
      Math.max(0, Math.min(logicalExtent, pointer.x - left)),
      logicalExtent,
      this.pageViewportWidth(event),
    );
  }

  private pageLocalY(event: TouchEvent, pointer: TouchObject): number {
    const bottom = this.finiteInset(this.systemGestureBottomInset);
    const logicalExtent = Math.max(1, this.eventViewportHeight(event) - bottom);
    return readerPagePointerCoordinate(
      Math.max(0, Math.min(logicalExtent, pointer.y)),
      logicalExtent,
      this.pageViewportHeight(event),
    );
  }

  private pointerForEvent(event: TouchEvent): TouchObject | undefined {
    for (let index = 0; index < event.changedTouches.length; index += 1) {
      if (event.changedTouches[index].id === this.activePointerId) {
        return event.changedTouches[index];
      }
    }
    for (let index = 0; index < event.touches.length; index += 1) {
      if (event.touches[index].id === this.activePointerId) {
        return event.touches[index];
      }
    }
    return undefined;
  }

  private changedPointerForEvent(event: TouchEvent): TouchObject | undefined {
    for (let index = 0; index < event.changedTouches.length; index += 1) {
      if (event.changedTouches[index].id === this.activePointerId) {
        return event.changedTouches[index];
      }
    }
    // An UP for any later finger must not be reinterpreted as the active
    // first finger merely because that first finger is still in `touches`.
    return undefined;
  }

  private updateVelocity(localX: number, localY: number, eventTimeMs: number): void {
    const elapsedMs = eventTimeMs - this.lastSampleTimeMs;
    if (elapsedMs > 0) {
      this.velocityX = (localX - this.lastLocalX) * 1000 / elapsedMs;
      this.velocityY = (localY - this.lastLocalY) * 1000 / elapsedMs;
    }
    if (eventTimeMs >= this.lastSampleTimeMs) {
      this.lastSampleTimeMs = eventTimeMs;
    }
  }

  private eventTimeMs(event: TouchEvent): number {
    // ArkUI TouchEvent.timestamp is monotonic nanoseconds. Gesture contracts,
    // timers, and velocities are all expressed in milliseconds.
    return Number.isFinite(event.timestamp) && event.timestamp >= 0 ?
      event.timestamp / 1_000_000 : Date.now();
  }

  private systemOwnsPointer(event: TouchEvent, pointer: TouchObject): boolean {
    const width = this.eventViewportWidth(event);
    const height = this.eventViewportHeight(event);
    const left = this.finiteInset(this.systemGestureLeftInset);
    const right = this.finiteInset(this.systemGestureRightInset);
    const bottom = this.finiteInset(this.systemGestureBottomInset);
    return (width > 0 && (pointer.x < left || pointer.x > width - right)) ||
      (height > 0 && pointer.y > height - bottom);
  }

  private finiteInset(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  private ownPointer(event: TouchEvent): void {
    event.stopPropagation();
    try {
      event.preventDefault();
    } catch (_error) {
      // Some older ArkUI components do not expose preventDefault. The page
      // overlay already owns hit testing when selection is disabled.
    }
  }

  private resetRawPointer(): void {
    this.clearPointerWatchdog();
    this.clearLongPressTimer();
    this.activePointerId = -1;
    this.pointerDownTimeMs = 0;
    this.lastSampleTimeMs = 0;
    this.lastLocalX = 0;
    this.lastLocalY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.tapOnlyPointer = false;
    this.pointerRejected = false;
    this.deferredSegmentReserved = false;
    this.manualInteractionReported = false;
  }

  private reportManualInteraction(): void {
    if (this.manualInteractionReported) return;
    this.manualInteractionReported = true;
    this.onManualInteraction();
  }

  private isPageOwner(state: ReaderPageGestureState): boolean {
    return state.owner === 'horizontalPage' || state.owner === 'verticalPrevious';
  }

  private armLongPressTimer(): void {
    this.clearLongPressTimer();
    if (!this.allowTextSelection || this.tapOnlyPointer || this.activePointerId < 0) return;
    this.longPressTimer = setTimeout((): void => {
      this.longPressTimer = -1;
      if (this.activePointerId < 0 || this.gestureState.owner !== 'undecided') return;
      this.gestureState = updateReaderPagePanInPlace(
        this.gestureState,
        this.lastLocalX - this.gestureState.startLocalX,
        this.lastLocalY - this.gestureState.startLocalY,
        0,
        this.lastLocalX,
        this.lastLocalY,
        0,
        this.pointerDownTimeMs + READER_PAGE_GESTURE_LONG_PRESS_MS,
      );
      this.reportManualInteraction();
      this.onGestureStateChange(this.gestureState);
    }, READER_PAGE_GESTURE_LONG_PRESS_MS);
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer < 0) return;
    clearTimeout(this.longPressTimer);
    this.longPressTimer = -1;
  }

  private armPointerWatchdog(): void {
    this.clearPointerWatchdog();
    this.pointerWatchdogTimer = setTimeout((): void => {
      this.pointerWatchdogTimer = -1;
      if (this.activePointerId < 0) return;
      this.cancelPan();
      this.resolveDeferredSegment(undefined);
      this.resetRawPointer();
    }, READER_PAGE_POINTER_STALL_TIMEOUT_MS);
  }

  private clearPointerWatchdog(): void {
    if (this.pointerWatchdogTimer < 0) return;
    clearTimeout(this.pointerWatchdogTimer);
    this.pointerWatchdogTimer = -1;
  }

  private onInteractionEnabledChanged(): void {
    if (!this.interactionEnabled) {
      this.cancelPan();
      this.resolveDeferredSegment(undefined);
      this.resetRawPointer();
    }
  }

  private onInteractionModeChanged(): void {
    if (this.activePointerId < 0) return;
    if (this.tapOnlyPointer && !this.tapOnly) {
      if (this.deferredSegmentReserved) {
        this.deferredSegmentReserved = false;
        this.onDeferredSegmentPromote();
      }
      this.tapOnlyPointer = false;
      this.gestureState = startReaderPagePan(
        this.viewportWidth,
        this.lastLocalX,
        this.lastLocalY,
        this.lastSampleTimeMs,
        this.viewportHeight,
      );
      this.onGestureStateChange(this.gestureState);
      this.armLongPressTimer();
      return;
    }
    if (!this.tapOnlyPointer && this.tapOnly) {
      this.cancelPan();
      this.resetRawPointer();
    }
  }

  private resolveDeferredSegment(intent: ReaderPageTapIntent | undefined): void {
    if (!this.deferredSegmentReserved) return;
    this.deferredSegmentReserved = false;
    this.onDeferredSegmentResolve(intent);
  }
}
