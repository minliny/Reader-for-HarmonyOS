import {
  abandonReaderPageGestureTracking,
  cancelReaderPagePan,
  createReaderPageGestureState,
  finishReaderPagePan,
  readerPageTapIntent,
  startReaderPagePan,
  updateReaderPagePan,
  type ReaderPageGestureState,
  type ReaderPageGestureDecision,
  type ReaderPageTurnDirection,
  type ReaderPageTurnOutcome,
} from './ReaderPageGestureState';

/** A longer stationary press belongs to text selection, never to page tap. */
export const READER_PAGE_TAP_MAX_DURATION_MS = 320;
/** Lost UP/CANCEL must never leave controls and page input permanently owned. */
export const READER_PAGE_POINTER_STALL_TIMEOUT_MS = 1800;

/**
 * The single pointer owner above the reading page-turn stage.
 *
 * Raw DOWN/MOVE/UP is used instead of PanGesture so the owner sees the physical
 * pointer before ArkUI's recognition threshold. A pagination request is still
 * emitted at most once, on a valid UP; native curl receives each admitted MOVE
 * through the owner's synchronous state callback.
 */
@Component
export struct ReaderPageInteractionLayer {
  @Prop @Watch('onInteractionEnabledChanged') interactionEnabled: boolean = true;
  @Prop viewportWidth: number = 0;
  @Prop allowTextSelection: boolean = false;
  /** Pointer streams beginning in system-owned edge bands never enter the reader arena. */
  @Prop systemGestureLeftInset: number = 16;
  @Prop systemGestureRightInset: number = 16;
  @Prop systemGestureBottomInset: number = 24;

  onTurn: (direction: ReaderPageTurnDirection, originX?: number, originY?: number) => ReaderPageTurnOutcome =
    (_direction: ReaderPageTurnDirection, _originX?: number, _originY?: number): ReaderPageTurnOutcome =>
      ({ kind: 'busy' });
  onOpenControl: () => void = (): void => {};
  onManualInteraction: () => void = (): void => {};
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
  private pointerWatchdogTimer: number = -1;

  build() {
    Row()
      .width('100%')
      .height('100%')
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
      // A repeated DOWN for the already owned pointer must not restart the
      // reducer halfway through one physical gesture. A real second finger is
      // still treated as cancellation below.
      if (this.activePointerId >= 0) {
        if (event.touches.length > 1) {
          this.cancelPan();
          this.resetRawPointer();
        }
        return;
      }
      this.startRawPointer(event);
      return;
    }
    if (event.type === TouchType.Cancel) {
      this.cancelPan();
      this.resetRawPointer();
      return;
    }
    if (this.activePointerId < 0 || event.touches.length > 1) {
      if (event.touches.length > 1) {
        this.cancelPan();
        this.resetRawPointer();
      }
      return;
    }
    const pointer = this.pointerForEvent(event);
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
    if (pointer === undefined || event.touches.length > 1) {
      this.cancelPan();
      this.resetRawPointer();
      return;
    }
    if (this.systemOwnsPointer(event, pointer)) {
      // Do not stop propagation: Harmony's back/home recognizer retains the
      // complete DOWN stream and the reader never flashes a provisional curl.
      return;
    }
    const eventTimeMs = this.eventTimeMs(event);
    this.activePointerId = pointer.id;
    this.pointerDownTimeMs = eventTimeMs;
    this.lastSampleTimeMs = this.pointerDownTimeMs;
    this.lastLocalX = pointer.x;
    this.lastLocalY = pointer.y;
    this.velocityX = 0;
    this.velocityY = 0;
    this.gestureState = startReaderPagePan(
      0,
      this.eventViewportWidth(event),
      0,
      pointer.x,
      pointer.y,
      eventTimeMs,
    );
    this.onGestureStateChange(this.gestureState);
    this.onManualInteraction();
    this.armPointerWatchdog();
  }

  private updateRawPointer(event: TouchEvent, pointer: TouchObject): void {
    const offsetX = pointer.x - this.gestureState.startLocalX;
    const offsetY = pointer.y - this.gestureState.startLocalY;
    const eventTimeMs = this.eventTimeMs(event);
    this.updateVelocity(pointer.x, pointer.y, eventTimeMs);
    this.gestureState = updateReaderPagePan(
      this.gestureState,
      offsetX,
      offsetY,
      this.velocityX,
      pointer.x,
      pointer.y,
      this.velocityY,
      eventTimeMs,
    );
    this.onGestureStateChange(this.gestureState);
    this.lastLocalX = pointer.x;
    this.lastLocalY = pointer.y;
    this.armPointerWatchdog();
    if (this.gestureState.phase === 'dragging') {
      this.ownHorizontalPointer(event);
    }
  }

  private finishRawPointer(event: TouchEvent, pointer: TouchObject): void {
    const offsetX = pointer.x - this.gestureState.startLocalX;
    const offsetY = pointer.y - this.gestureState.startLocalY;
    const eventTimeMs = this.eventTimeMs(event);
    this.updateVelocity(pointer.x, pointer.y, eventTimeMs);
    this.lastLocalX = pointer.x;
    this.lastLocalY = pointer.y;
    if (this.gestureState.phase === 'tracking') {
      const tapCandidate = this.gestureState.axis === 'undecided' &&
        eventTimeMs - this.pointerDownTimeMs <= READER_PAGE_TAP_MAX_DURATION_MS;
      this.gestureState = abandonReaderPageGestureTracking(this.gestureState);
      this.onGestureStateChange(this.gestureState);
      this.resetRawPointer();
      if (tapCandidate) {
        this.handleRawTap(
          pointer.x,
          pointer.y,
          this.eventViewportWidth(event),
          this.eventViewportHeight(event),
        );
      }
      return;
    }
    let decision = finishReaderPagePan(
      this.gestureState,
      offsetX,
      offsetY,
      this.velocityX,
      pointer.x,
      pointer.y,
      this.velocityY,
      eventTimeMs,
    );
    decision = this.onGestureDecision(decision);
    this.gestureState = decision.state;
    this.onGestureStateChange(this.gestureState);
    this.ownHorizontalPointer(event);
    this.resetRawPointer();
    if (decision.direction !== undefined) {
      this.onTurn(decision.direction);
    }
  }

  private cancelPan(): void {
    const cancelled = cancelReaderPagePan(this.gestureState);
    if (cancelled === this.gestureState) {
      return;
    }
    this.gestureState = cancelled;
    this.onGestureStateChange(this.gestureState);
  }

  private handleRawTap(localX: number, localY: number, viewportWidth: number, viewportHeight: number): void {
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
    const normalizedX = viewportWidth > 0 ? Math.max(0, Math.min(1, localX / viewportWidth)) : undefined;
    const normalizedY = viewportHeight > 0 ? Math.max(0, Math.min(1, localY / viewportHeight)) : undefined;
    this.onTurn(intent, normalizedX, normalizedY);
  }

  private eventViewportWidth(event: TouchEvent): number {
    const targetWidth = event.target.area.width;
    if (typeof targetWidth === 'number') {
      return Number.isFinite(targetWidth) && targetWidth > 0 ? targetWidth : this.viewportWidth;
    }
    if (typeof targetWidth === 'string') {
      const parsed = Number.parseFloat(targetWidth);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return this.viewportWidth;
  }

  private eventViewportHeight(event: TouchEvent): number {
    const targetHeight = event.target.area.height;
    if (typeof targetHeight === 'number') {
      return Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight : 0;
    }
    if (typeof targetHeight === 'string') {
      const parsed = Number.parseFloat(targetHeight);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 0;
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

  private updateVelocity(localX: number, localY: number, eventTimeMs: number): void {
    const elapsedMs = eventTimeMs - this.lastSampleTimeMs;
    if (elapsedMs > 0 && elapsedMs <= 160) {
      const instantaneous = (localX - this.lastLocalX) * 1000 / elapsedMs;
      const instantaneousY = (localY - this.lastLocalY) * 1000 / elapsedMs;
      const limit = Math.max(2400, this.viewportWidth * 8);
      const clamped = Math.max(-limit, Math.min(limit, instantaneous));
      const clampedY = Math.max(-limit, Math.min(limit, instantaneousY));
      this.velocityX = this.velocityX === 0 ? clamped : this.velocityX * 0.3 + clamped * 0.7;
      this.velocityY = this.velocityY === 0 ? clampedY : this.velocityY * 0.3 + clampedY * 0.7;
    }
    if (eventTimeMs >= this.lastSampleTimeMs) {
      this.lastSampleTimeMs = eventTimeMs;
    }
  }

  private eventTimeMs(event: TouchEvent): number {
    return Number.isFinite(event.timestamp) && event.timestamp >= 0 ? event.timestamp : Date.now();
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

  private ownHorizontalPointer(event: TouchEvent): void {
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
    this.activePointerId = -1;
    this.pointerDownTimeMs = 0;
    this.lastSampleTimeMs = 0;
    this.lastLocalX = 0;
    this.lastLocalY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  private armPointerWatchdog(): void {
    this.clearPointerWatchdog();
    this.pointerWatchdogTimer = setTimeout((): void => {
      this.pointerWatchdogTimer = -1;
      if (this.activePointerId < 0) return;
      this.cancelPan();
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
      this.resetRawPointer();
    }
  }
}
