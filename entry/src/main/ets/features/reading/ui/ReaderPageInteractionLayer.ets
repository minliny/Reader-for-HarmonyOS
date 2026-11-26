import { hilog } from '@kit.PerformanceAnalysisKit';
import {
  abandonReaderPageGestureTracking,
  cancelReaderPagePan,
  createReaderPageGestureState,
  finishReaderPagePan,
  READER_PAGE_GESTURE_BOOKMARK_SLOP,
  READER_PAGE_GESTURE_LONG_PRESS_MS,
  READER_PAGE_GESTURE_TOUCH_SLOP,
  readerPageGestureCanTap,
  readerPagePointerCoordinate,
  readerPageTapIntent,
  readerPageTapSegmentWidth,
  startReaderPagePan,
  updateReaderPagePanInPlace,
  type ReaderPageGestureState,
  type ReaderPageGestureDecision,
  type ReaderPageTapIntent,
  type ReaderPageTurnDirection,
  type ReaderPageTurnOutcome,
} from './ReaderPageGestureState';
import { READER_ACTION_MIN_TARGET } from '../../../ui/controls/ReaderActionAccessibility';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { READER_LAYOUT_DEBUG_BUILD } from '../../../ui/foundation/ReaderLayoutInvariantSignals';
import { READER_PAGED_INPUT_SCOPE, type LayoutInvariantTag } from '../../../ui/layout/LayoutInvariantEvaluator';
import { ReaderPageInputClock } from './ReaderPageInputClock';
import {
  ReaderPagePalmCandidate,
  readerPageCanOfferPalmHandoff,
  readerPageGestureAdmission,
  readerPagePointerAtPalmEdge,
  readerPagePointerBlocksTap,
  readerPagePointerGeometryValueMatches,
  readerPagePointerLocalCoordinate,
  readerPageSystemOwnsPointer,
} from './ReaderPagePointerInput';

/** Tap and long press share the frozen HarmonyOS 500ms boundary. */
export const READER_PAGE_TAP_MAX_DURATION_MS = READER_PAGE_GESTURE_LONG_PRESS_MS;
/** Lost UP/CANCEL must never leave controls and page input permanently owned. */
export const READER_PAGE_POINTER_STALL_TIMEOUT_MS = 15000;

type ReaderPageGestureDropReason = 'system-edge' | 'second-pointer-ignored' | 'undecided-drop' |
  'longpress-locked' | 'rollback' | 'geometry-changed' | 'bottom-tap-ignored';

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
  @Prop @Watch('onInteractionEnabledInputsChanged') interactionEnabled: boolean = true;
  /** While a commit/preparation is non-interruptible, retain only short taps as queued intent. */
  @Prop @Watch('onInteractionModeInputsChanged') tapOnly: boolean = false;
  /** Prop delivery can lag a new DOWN; the owner supplies its live transaction gate. */
  currentTapOnly: (() => boolean) | undefined = undefined;
  @Prop @Watch('onReadinessInputsChanged') readinessRevision: number = 0;
  @Prop @Watch('onInputRevisionInputsChanged') inputRevision: number = 0;
  inputCurrent: ((revision: number) => boolean) | undefined = undefined;
  onInputLost: (revision: number) => void = (_revision: number): void => {};
  @Prop @Watch('onPointerGeometryInputsChanged') viewportWidth: number = 0;
  @Prop @Watch('onPointerGeometryInputsChanged') viewportHeight: number = 0;
  @Prop allowTextSelection: boolean = false;
  /** Full system insets. Only the innermost side bands reject DOWN. */
  @Prop @Watch('onPointerGeometryInputsChanged') systemGestureLeftInset: number = 16;
  @Prop @Watch('onPointerGeometryInputsChanged') systemGestureRightInset: number = 16;
  @Prop @Watch('onPointerGeometryInputsChanged') systemGestureBottomInset: number = 24;

  onTurn: (direction: ReaderPageTurnDirection) => ReaderPageTurnOutcome =
    (_direction: ReaderPageTurnDirection): ReaderPageTurnOutcome => ({ kind: 'busy' });
  /** Readiness/boundary gate checked before the first page-owned visual frame. */
  canStartTurn: (direction: ReaderPageTurnDirection) => boolean =
    (_direction: ReaderPageTurnDirection): boolean => true;
  onPreparationNeeded: (direction: ReaderPageTurnDirection) => void =
    (_direction: ReaderPageTurnDirection): void => {};
  /** Bookmark preview cannot run while the materialized page context is speculative. */
  canStartBookmark: () => boolean = (): boolean => true;
  onBookmarkStateChange: (state: ReaderPageGestureState) => void =
    (_state: ReaderPageGestureState): void => {};
  onBookmarkRelease: (changed: boolean) => void = (_changed: boolean): void => {};
  onBookmarkUnavailable: (reason: 'busy' | 'unavailable') => void =
    (_reason: 'busy' | 'unavailable'): void => {};
  onOpenControl: () => void = (): void => {};
  onManualInteraction: () => void = (): void => {};
  onRegrab: (width: number, height: number, x: number, y: number, time: number,
    direction: ReaderPageTurnDirection) => ReaderPageGestureState | undefined =
    (_width: number, _height: number, _x: number, _y: number, _time: number,
      _direction: ReaderPageTurnDirection): ReaderPageGestureState | undefined => undefined;
  /** Every accepted DOWN owns a lease, including undecided and cold pointers. */
  onPointerStart: (pointerId: number) => boolean = (_pointerId: number): boolean => true;
  onPointerEnd: (pointerId: number) => void = (_pointerId: number): void => {};
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
  private palmCandidate: ReaderPagePalmCandidate | undefined = undefined;
  private pointerDownTimeMs: number = 0;
  private pointerDownReceivedMs: number = 0;
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
  private pointerLastActivityMs: number = 0;
  private inputClock: ReaderPageInputClock = new ReaderPageInputClock();
  private pointerGeometryFrozen: boolean = false;
  private pointerTargetWidth: number = 0;
  private pointerTargetHeight: number = 0;
  private pointerStageWidth: number = 0;
  private pointerStageHeight: number = 0;
  private pointerTargetX: number = 0;
  private pointerTargetY: number = 0;
  private pointerLeftInset: number = 0;
  private pointerRightInset: number = 0;
  private pointerBottomInset: number = 0;
  private pointerInputStartX: number = 0;
  private pointerInputStartY: number = 0;
  private lastInputX: number = 0;
  private lastInputY: number = 0;
  private bookmarkUnavailableReported: boolean = false;

  aboutToDisappear(): void {
    this.cancelRawPointer();
  }

  build() {
    Row()
      .id(this.interactionEnabled ? 'reader-reading-interaction-host-paged' : '')
      .customProperty('readerLayoutInvariant', typeof READER_LAYOUT_DEBUG_BUILD === 'boolean' && READER_LAYOUT_DEBUG_BUILD && this.interactionEnabled
        ? { role: 'main-input', id: 'reader-paged-input', scope: READER_PAGED_INPUT_SCOPE } as LayoutInvariantTag : undefined)
      .width('100%')
      .height('100%')
      // XComponent composition order is device-dependent; make the sole raw
      // input owner explicitly higher while leaving the capsule at zIndex 8.
      .zIndex(7)
      .backgroundColor('#00000000')
      .hitTestBehavior(this.interactionEnabled ?
        (this.allowTextSelection ? HitTestMode.Transparent : HitTestMode.Block) : HitTestMode.None)
      .accessibilityLevel('no')
      .accessibilityVirtualNode(this.accessiblePageActions)
      .onTouch((event: TouchEvent): void => this.handleTouch(event));
  }

  @Builder
  private accessiblePageActions() {
    Row() {
      this.accessiblePageAction('上一页', 'previous');
      this.accessiblePageAction('打开阅读控制栏', 'control');
      this.accessiblePageAction('下一页', 'next');
    }.direction(Direction.Ltr).width(readerPageTapSegmentWidth(this.viewportWidth) * 3)
      .height(this.accessibleActionHeight()).position({ x: 0, y: this.accessibleActionTop() });
  }

  @Builder
  private accessiblePageAction(label: string, intent: ReaderPageTapIntent) {
    Text(label).id(`reader-paged-action-${intent}`)
      .width(readerPageTapSegmentWidth(this.viewportWidth)).height(this.accessibleActionHeight())
      .accessibilityText(label)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityLevel(this.accessibleActionsAvailable() ? 'yes' : 'no')
      .enabled(this.accessibleActionsAvailable() && !this.tapOnly)
      .onClick((): void => this.activatePageFromAccessibility(intent));
  }

  private accessibleActionHeight(): number {
    return Number.isFinite(this.viewportHeight) && this.viewportHeight > 0 ?
      Math.min(READER_ACTION_MIN_TARGET, this.viewportHeight) : 0;
  }

  private accessibleActionTop(): number {
    const height = this.accessibleActionHeight();
    // Leave the rest of the page available for text exploration.
    return height > 0 ? (this.viewportHeight - height) / 2 : 0;
  }

  private accessibleActionsAvailable(): boolean {
    return this.interactionEnabled && readerPageTapSegmentWidth(this.viewportWidth) > 0 &&
      this.accessibleActionHeight() > 0;
  }

  private activatePageFromAccessibility(intent: ReaderPageTapIntent): void {
    if (!this.accessibleActionsAvailable() || this.activePointerId >= 0 || this.tapOnlyNow() ||
      this.gestureState.phase !== 'idle' || !this.acceptCurrentInput()) return;
    if (intent === 'control') {
      this.onOpenControl();
      return;
    }
    this.onManualInteraction();
    this.onTurn(intent);
  }

  private acceptCurrentInput(): boolean {
    if (this.inputCurrent?.(this.inputRevision) !== false) return true;
    this.onInputLost(this.inputRevision);
    this.onInputRevisionChanged();
    return false;
  }

  private handleTouch(event: TouchEvent): void {
    if (!this.acceptCurrentInput()) return;
    if (!this.interactionEnabled) {
      this.cancelRawPointer();
      return;
    }
    if (event.type === TouchType.Down) {
      if (this.activePointerId >= 0) {
        this.trackPalmCandidate(event);
        return;
      }
      this.startRawPointer(event);
      return;
    }
    if (event.type === TouchType.Cancel) {
      this.cancelRawPointer();
      return;
    }
    if (this.activePointerId < 0) {
      return;
    }
    const pointer = event.type === TouchType.Up ?
      this.changedPointerForEvent(event, this.activePointerId) : this.pointerForEvent(event, this.activePointerId);
    if (event.type === TouchType.Move) {
      // If both fingers moved in this sample, the original pointer gets the
      // first opportunity to commit to a gesture or leave its stationary band.
      if (pointer !== undefined) this.updateRawPointer(event, pointer);
      this.updatePalmCandidate(event);
      return;
    }
    if (event.type === TouchType.Up) {
      if (pointer !== undefined) this.finishRawPointer(event, pointer);
      else this.finishPalmCandidate(event);
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
      this.reportDownDrop('system-edge', pointer);
      return;
    }
    if (!this.onPointerStart(pointer.id)) {
      this.reportDownDrop('undecided-drop', pointer);
      return;
    }
    this.freezePointerGeometry(event, pointer);
    this.inputClock = new ReaderPageInputClock();
    const eventTimeMs = this.eventTimeMs(event);
    const localX = this.pageLocalX(event, pointer);
    const localY = this.pageLocalY(event, pointer);
    this.activePointerId = pointer.id;
    this.pointerDownTimeMs = eventTimeMs;
    this.pointerDownReceivedMs = readerMotionNowMs();
    this.lastSampleTimeMs = this.pointerDownTimeMs;
    this.lastLocalX = localX;
    this.lastLocalY = localY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.tapOnlyPointer = this.tapOnlyNow();
    this.pointerRejected = false;
    if (this.tapOnlyPointer) {
      this.deferredSegmentReserved = this.onDeferredSegmentStart();
      if (!this.deferredSegmentReserved) {
        this.reportDownDrop('undecided-drop', pointer);
        this.resetRawPointer();
        return;
      }
    }
    this.gestureState = startReaderPagePan(
      this.pointerStageWidth,
      localX,
      localY,
      eventTimeMs,
      this.pointerStageHeight,
      this.allowTextSelection,
    );
    // Deferred samples use the same arena without displaying a second sheet.
    if (!this.tapOnlyPointer) this.onGestureStateChange(this.gestureState);
    this.armPointerWatchdog();
    this.armLongPressTimer();
  }

  private trackPalmCandidate(event: TouchEvent): void {
    const pointer = event.changedTouches[0];
    if (pointer === undefined || pointer.id === this.activePointerId) return;
    if (this.palmCandidate !== undefined || !this.canOfferPalmHandoff() ||
      readerPagePointerAtPalmEdge(pointer.x, this.pointerTargetWidth) || !this.pointerGeometryMatches(event)) {
      this.reportDownDrop('second-pointer-ignored', pointer);
      return;
    }
    this.palmCandidate = new ReaderPagePalmCandidate(pointer.id, pointer.x, pointer.y, readerMotionNowMs(),
      startReaderPagePan(this.pointerStageWidth, this.pageLocalX(event, pointer), this.pageLocalY(event, pointer),
        this.eventTimeMs(event), this.pointerStageHeight, this.allowTextSelection));
  }

  private canOfferPalmHandoff(): boolean {
    return this.activePointerId >= 0 && readerPageCanOfferPalmHandoff(this.gestureState, this.tapOnlyPointer,
      this.pointerInputStartX, this.pointerTargetWidth);
  }

  private updatePalmCandidate(event: TouchEvent): void {
    const candidate = this.palmCandidate;
    if (candidate === undefined) return;
    if (!this.canOfferPalmHandoff()) {
      this.palmCandidate = undefined;
      return;
    }
    const pointer = this.pointerForEvent(event, candidate.pointerId);
    if (pointer === undefined || !candidate.claimsHorizontal(pointer.x, pointer.y)) return;
    if (this.takeOverPalmPointer(event, candidate)) this.updateRawPointer(event, pointer);
  }

  private takeOverPalmPointer(event: TouchEvent, candidate: ReaderPagePalmCandidate): boolean {
    const moved = event.type === TouchType.Move;
    if (!this.pointerGeometryMatches(event)) {
      this.cancelRawPointer('geometry-changed', moved);
      return false;
    }
    const previousPointerId = this.activePointerId;
    this.palmCandidate = undefined;
    this.activePointerId = -1;
    this.clearLongPressTimer();
    if (!candidate.replaceLease(previousPointerId, this.onPointerEnd, this.onPointerStart)) {
      this.cancelRawPointer('rollback', moved);
      return false;
    }
    // Use the candidate's real DOWN. The previous physical id is now retired,
    // so a later MOVE/UP from it cannot settle the replacement gesture.
    this.activePointerId = candidate.pointerId;
    this.pointerInputStartX = candidate.startX;
    this.pointerInputStartY = candidate.startY;
    this.lastInputX = candidate.startX;
    this.lastInputY = candidate.startY;
    this.gestureState = candidate.state;
    this.pointerDownTimeMs = candidate.state.startEventTimeMs;
    this.pointerDownReceivedMs = candidate.downReceivedMs;
    this.lastSampleTimeMs = this.pointerDownTimeMs;
    this.lastLocalX = candidate.state.startLocalX;
    this.lastLocalY = candidate.state.startLocalY;
    this.velocityX = 0;
    this.velocityY = 0;
    this.manualInteractionReported = false;
    return true;
  }

  private finishPalmCandidate(event: TouchEvent): void {
    const candidate = this.palmCandidate;
    if (candidate === undefined) return;
    const pointer = this.changedPointerForEvent(event, candidate.pointerId);
    if (pointer === undefined) return;
    if (this.canOfferPalmHandoff() && candidate.claimsHorizontal(pointer.x, pointer.y, true)) {
      if (this.takeOverPalmPointer(event, candidate)) this.finishRawPointer(event, pointer);
      return;
    }
    this.palmCandidate = undefined;
    this.logGestureDrop('second-pointer-ignored', candidate.startX, candidate.startY,
      pointer.x - candidate.startX, pointer.y - candidate.startY,
      Math.max(0, readerMotionNowMs() - candidate.downReceivedMs),
      this.pointerLeftInset, this.pointerRightInset, this.pointerBottomInset);
  }

  private updateRawPointer(event: TouchEvent, pointer: TouchObject, allowRegrab: boolean = true,
    finalSample: boolean = false): void {
    if (!this.pointerGeometryMatches(event)) {
      this.lastInputX = pointer.x;
      this.lastInputY = pointer.y;
      this.cancelRawPointer('geometry-changed', event.type === TouchType.Move);
      return;
    }
    // A native sample can arrive before the deferred @Watch reconciles the
    // live settlement gate. Promote the held segment before consuming it.
    if (this.tapOnlyPointer && !this.tapOnlyNow()) {
      this.promoteDeferredPointer();
      if (this.activePointerId !== pointer.id) return;
    }
    const localX = this.pageLocalX(event, pointer);
    const localY = this.pageLocalY(event, pointer);
    const inputOffsetX = pointer.x - this.pointerInputStartX;
    const inputOffsetY = pointer.y - this.pointerInputStartY;
    this.lastInputX = pointer.x;
    this.lastInputY = pointer.y;
    const eventTimeMs = this.eventTimeMs(event);
    this.updateVelocity(localX, localY, eventTimeMs);
    const priorOwner = this.gestureState.owner;
    this.gestureState = updateReaderPagePanInPlace(
      this.gestureState,
      localX - this.gestureState.startLocalX,
      localY - this.gestureState.startLocalY,
      this.velocityX,
      localX,
      localY,
      this.velocityY,
      eventTimeMs,
      inputOffsetX,
      inputOffsetY,
      finalSample,
    );
    this.lastLocalX = localX;
    this.lastLocalY = localY;
    this.armPointerWatchdog();
    if (this.tapOnlyPointer) {
      // A new DOWN may still be the next rapid tap. Replacing the in-flight
      // intent on DOWN made every second tap merely re-release the same page.
      // Transfer the visible pose only once a real MOVE claims a page drag;
      // short taps and a sparse final UP remain separate queued requests.
      const requestedDirection = this.gestureState.direction;
      if (allowRegrab && priorOwner === 'undecided' && this.gestureState.owner === 'horizontalPage' &&
        requestedDirection !== undefined) {
        const regrab = this.onRegrab(this.pointerStageWidth, this.pointerStageHeight,
          localX, localY, eventTimeMs, requestedDirection);
        if (regrab !== undefined) {
          this.tapOnlyPointer = false;
          if (this.deferredSegmentReserved) {
            this.deferredSegmentReserved = false;
            this.onDeferredSegmentPromote();
          }
          // The re-grab's visible pose is in stage coordinates. Preserve that
          // pose in physical vp too, instead of restarting its commit distance
          // at the small movement made since this new DOWN.
          const inputPose = readerPagePointerCoordinate(regrab.currentOffsetX,
            this.pointerStageWidth, this.pointerTargetWidth);
          this.pointerInputStartX = pointer.x - inputPose;
          this.pointerInputStartY = pointer.y;
          regrab.inputOffsetX = inputPose;
          regrab.inputOffsetY = 0;
          this.gestureState = regrab;
          this.reportManualInteraction();
          this.clearLongPressTimer();
          this.onGestureStateChange(this.gestureState);
          this.ownPointer(event);
        }
      }
      if (this.tapOnlyPointer) this.reportBookmarkUnavailable('busy');
      return;
    }
    if (this.pointerRejected) {
      this.reportBookmarkUnavailable('unavailable');
      return;
    }
    if (priorOwner === 'undecided' && this.gestureState.owner !== 'undecided') {
      this.admitGestureOwner();
    }
    if (!this.pointerRejected) this.publishCurrentGestureState();
    if (this.gestureState.owner !== 'undecided' && this.gestureState.owner !== 'longPress') {
      this.ownPointer(event);
    }
  }

  private admitGestureOwner(): void {
    const admission = readerPageGestureAdmission(this.gestureState, this.canStartTurn, this.canStartBookmark);
    this.reportManualInteraction();
    this.clearLongPressTimer();
    this.pointerRejected = admission !== 'admitted';
    const direction = this.gestureState.direction;
    if (admission === 'preparing' && direction !== undefined) this.onPreparationNeeded(direction);
    if (admission === 'bookmark-unavailable') this.reportBookmarkUnavailable('unavailable');
  }

  private publishCurrentGestureState(): void {
    this.onGestureStateChange(this.gestureState);
    if (this.gestureState.owner === 'bookmark') this.onBookmarkStateChange(this.gestureState);
  }

  private finishRawPointer(event: TouchEvent, pointer: TouchObject): void {
    // UP can contain the only threshold-crossing sample. Admission, direction
    // and the last visible posture must consume it before tap/settle dispatch.
    this.updateRawPointer(event, pointer, false, true);
    if (this.activePointerId < 0) return;
    const localX = this.pageLocalX(event, pointer);
    const localY = this.pageLocalY(event, pointer);
    const viewportWidth = this.pointerStageWidth;
    if (this.tapOnlyPointer) {
      const eventTimeMs = this.eventTimeMs(event);
      const offsetX = localX - this.gestureState.startLocalX;
      const offsetY = localY - this.gestureState.startLocalY;
      this.updateVelocity(localX, localY, eventTimeMs);
      let intent: ReaderPageTapIntent | undefined = undefined;
      if (this.gestureState.phase === 'tracking') {
        intent = this.rawTapIntent(pointer, localX, viewportWidth, eventTimeMs);
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
          pointer.x - this.pointerInputStartX,
          pointer.y - this.pointerInputStartY,
        ).direction;
        if (intent === undefined) this.reportActiveDrop('rollback');
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
        pointer.x - this.pointerInputStartX,
        pointer.y - this.pointerInputStartY,
      );
      if (decision.direction === undefined) this.reportActiveDrop('rollback');
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
      const intent = this.rawTapIntent(pointer, localX, viewportWidth, eventTimeMs);
      this.gestureState = abandonReaderPageGestureTracking(this.gestureState);
      this.onGestureStateChange(this.gestureState);
      this.resetRawPointer();
      if (intent !== undefined) this.handleRawTap(intent);
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
      pointer.x - this.pointerInputStartX,
      pointer.y - this.pointerInputStartY,
    );
    decision = this.onGestureDecision(decision);
    if (decision.direction === undefined && !decision.bookmarkChanged) this.reportActiveDrop('rollback');
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
    if (this.tapOnlyPointer) {
      this.gestureState = createReaderPageGestureState();
      return;
    }
    if (this.gestureState.phase === 'tracking') {
      this.gestureState = abandonReaderPageGestureTracking(this.gestureState);
      this.onGestureStateChange(this.gestureState);
      return;
    }
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
    if (cancelled.owner === 'bookmark') {
      this.onBookmarkStateChange(cancelled);
      this.onBookmarkRelease(false);
    }
  }

  private cancelRawPointer(reason: ReaderPageGestureDropReason = 'rollback', delayedLog: boolean = false): void {
    const dropReason = reason === 'rollback' && this.gestureState.owner === 'longPress' ? 'longpress-locked' : reason;
    this.reportActiveDrop(dropReason, delayedLog);
    this.cancelPan();
    this.resolveDeferredSegment(undefined);
    this.resetRawPointer();
  }

  private rawTapIntent(pointer: TouchObject, localX: number, viewportWidth: number,
    eventTimeMs: number): ReaderPageTapIntent | undefined {
    if (!readerPageGestureCanTap(this.gestureState, eventTimeMs)) {
      this.reportActiveDrop(this.gestureState.owner === 'longPress' ? 'longpress-locked' : 'undecided-drop');
      return undefined;
    }
    if (readerPagePointerBlocksTap(pointer.y, this.pointerTargetHeight, this.pointerBottomInset)) {
      this.reportActiveDrop('bottom-tap-ignored');
      return undefined;
    }
    const intent = readerPageTapIntent(localX, viewportWidth);
    if (intent === undefined) this.reportActiveDrop('undecided-drop');
    return intent;
  }

  private handleRawTap(intent: ReaderPageTapIntent): void {
    if (!this.acceptCurrentInput() || !this.interactionEnabled || this.gestureState.phase !== 'idle') {
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
    return readerPagePointerLocalCoordinate(pointer.x,
      this.pointerGeometryFrozen ? this.pointerTargetWidth : this.eventViewportWidth(event),
      this.pointerGeometryFrozen ? this.pointerStageWidth : this.pageViewportWidth(event),
    );
  }

  private pageLocalY(event: TouchEvent, pointer: TouchObject): number {
    return readerPagePointerLocalCoordinate(pointer.y,
      this.pointerGeometryFrozen ? this.pointerTargetHeight : this.eventViewportHeight(event),
      this.pointerGeometryFrozen ? this.pointerStageHeight : this.pageViewportHeight(event),
    );
  }

  private eventTargetPosition(value: Length | undefined): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string' && value.indexOf('%') < 0) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  private freezePointerGeometry(event: TouchEvent, pointer: TouchObject): void {
    this.pointerTargetWidth = this.eventViewportWidth(event);
    this.pointerTargetHeight = this.eventViewportHeight(event);
    this.pointerStageWidth = this.pageViewportWidth(event);
    this.pointerStageHeight = this.pageViewportHeight(event);
    this.pointerTargetX = this.eventTargetPosition(event.target.area.globalPosition?.x);
    this.pointerTargetY = this.eventTargetPosition(event.target.area.globalPosition?.y);
    this.pointerLeftInset = this.finiteInset(this.systemGestureLeftInset);
    this.pointerRightInset = this.finiteInset(this.systemGestureRightInset);
    this.pointerBottomInset = this.finiteInset(this.systemGestureBottomInset);
    this.pointerInputStartX = pointer.x;
    this.pointerInputStartY = pointer.y;
    this.lastInputX = pointer.x;
    this.lastInputY = pointer.y;
    this.bookmarkUnavailableReported = false;
    this.pointerGeometryFrozen = true;
  }

  private pointerGeometryMatches(event: TouchEvent): boolean {
    return this.pointerGeometryPropsMatch() &&
      readerPagePointerGeometryValueMatches(this.pointerTargetWidth, this.eventViewportWidth(event)) &&
      readerPagePointerGeometryValueMatches(this.pointerTargetHeight, this.eventViewportHeight(event)) &&
      readerPagePointerGeometryValueMatches(this.pointerTargetX,
        this.eventTargetPosition(event.target.area.globalPosition?.x)) &&
      readerPagePointerGeometryValueMatches(this.pointerTargetY,
        this.eventTargetPosition(event.target.area.globalPosition?.y));
  }

  private pointerGeometryPropsMatch(): boolean {
    const width = Number.isFinite(this.viewportWidth) && this.viewportWidth > 0 ?
      this.viewportWidth : this.pointerTargetWidth;
    const height = Number.isFinite(this.viewportHeight) && this.viewportHeight > 0 ?
      this.viewportHeight : this.pointerTargetHeight;
    return this.pointerGeometryFrozen &&
      readerPagePointerGeometryValueMatches(this.pointerStageWidth, width) &&
      readerPagePointerGeometryValueMatches(this.pointerStageHeight, height) &&
      readerPagePointerGeometryValueMatches(this.pointerLeftInset, this.finiteInset(this.systemGestureLeftInset)) &&
      readerPagePointerGeometryValueMatches(this.pointerRightInset, this.finiteInset(this.systemGestureRightInset)) &&
      readerPagePointerGeometryValueMatches(this.pointerBottomInset, this.finiteInset(this.systemGestureBottomInset));
  }

  private deferPointerWatch(reconcile: () => void): void {
    const clock = this.inputClock, pointer = this.activePointerId, revision = this.inputRevision;
    void Promise.resolve().then((): void => {
      if (clock === this.inputClock && pointer === this.activePointerId && revision === this.inputRevision) reconcile();
    });
  }

  private onInteractionEnabledInputsChanged(): void {
    this.deferPointerWatch((): void => this.onInteractionEnabledChanged());
  }
  private onInteractionModeInputsChanged(): void {
    this.deferPointerWatch((): void => this.onInteractionModeChanged());
  }
  private onReadinessInputsChanged(): void {
    this.deferPointerWatch((): void => this.onReadinessChanged());
  }
  private onInputRevisionInputsChanged(): void {
    this.deferPointerWatch((): void => this.onInputRevisionChanged());
  }
  private onPointerGeometryInputsChanged(): void {
    this.deferPointerWatch((): void => this.onPointerGeometryChanged());
  }

  private onPointerGeometryChanged(): void {
    if (this.activePointerId >= 0 && !this.pointerGeometryPropsMatch()) this.cancelRawPointer('geometry-changed');
  }

  private pointerForEvent(event: TouchEvent, pointerId: number): TouchObject | undefined {
    const changed = this.changedPointerForEvent(event, pointerId);
    if (changed !== undefined) return changed;
    for (let index = 0; index < event.touches.length; index += 1) {
      if (event.touches[index].id === pointerId) {
        return event.touches[index];
      }
    }
    return undefined;
  }

  private changedPointerForEvent(event: TouchEvent, pointerId: number): TouchObject | undefined {
    for (let index = 0; index < event.changedTouches.length; index += 1) {
      if (event.changedTouches[index].id === pointerId) {
        return event.changedTouches[index];
      }
    }
    // An UP for any later finger must not be reinterpreted as the active
    // first finger merely because that first finger is still in `touches`.
    return undefined;
  }

  private updateVelocity(localX: number, localY: number, eventTimeMs: number): void {
    const elapsedMs = eventTimeMs - this.lastSampleTimeMs;
    if (this.inputClock.resetVelocity) {
      this.velocityX = 0;
      this.velocityY = 0;
    } else if (elapsedMs > 0) {
      this.velocityX = (localX - this.lastLocalX) * 1000 / elapsedMs;
      this.velocityY = (localY - this.lastLocalY) * 1000 / elapsedMs;
    }
    if (eventTimeMs >= this.lastSampleTimeMs) {
      this.lastSampleTimeMs = eventTimeMs;
    }
  }

  private eventTimeMs(event: TouchEvent): number {
    return this.inputClock.sample(event.timestamp, readerMotionNowMs());
  }

  private systemOwnsPointer(event: TouchEvent, pointer: TouchObject): boolean {
    return readerPageSystemOwnsPointer(pointer.x, this.eventViewportWidth(event),
      this.finiteInset(this.systemGestureLeftInset), this.finiteInset(this.systemGestureRightInset));
  }

  private finiteInset(value: number): number {
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  private reportDownDrop(reason: ReaderPageGestureDropReason, pointer: TouchObject): void {
    this.logGestureDrop(reason, pointer.x, pointer.y, 0, 0, 0, this.finiteInset(this.systemGestureLeftInset),
      this.finiteInset(this.systemGestureRightInset), this.finiteInset(this.systemGestureBottomInset));
  }

  private reportActiveDrop(reason: ReaderPageGestureDropReason, delayedLog: boolean = false): void {
    if (!this.pointerGeometryFrozen) return;
    const startX = this.pointerInputStartX;
    const startY = this.pointerInputStartY;
    const dx = this.lastInputX - startX;
    const dy = this.lastInputY - startY;
    const durationMs = Math.max(0, this.lastSampleTimeMs - this.pointerDownTimeMs,
      readerMotionNowMs() - this.pointerDownReceivedMs);
    const left = this.pointerLeftInset;
    const right = this.pointerRightInset;
    const bottom = this.pointerBottomInset;
    if (delayedLog) {
      // Only a terminal rejection detected by a MOVE schedules this log.
      setTimeout((): void => this.logGestureDrop(reason, startX, startY, dx, dy, durationMs, left, right, bottom), 0);
      return;
    }
    this.logGestureDrop(reason, startX, startY, dx, dy, durationMs, left, right, bottom);
  }

  private logGestureDrop(reason: ReaderPageGestureDropReason, startX: number, startY: number,
    dx: number, dy: number, durationMs: number, left: number, right: number, bottom: number): void {
    hilog.info(0x5244, 'Reader',
      'GESTURE_DROP reason=%{public}s startX=%{public}.1f startY=%{public}.1f dx=%{public}.1f dy=%{public}.1f ' +
      'durationMs=%{public}.1f insets=%{public}.1f/%{public}.1f/%{public}.1f',
      reason, startX, startY, dx, dy, durationMs, left, right, bottom);
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
    const pointerId = this.activePointerId;
    this.clearPointerWatchdog();
    this.clearLongPressTimer();
    this.activePointerId = -1;
    this.palmCandidate = undefined;
    this.pointerDownTimeMs = 0;
    this.pointerDownReceivedMs = 0;
    this.lastSampleTimeMs = 0;
    this.lastLocalX = 0;
    this.lastLocalY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.tapOnlyPointer = false;
    this.pointerRejected = false;
    this.deferredSegmentReserved = false;
    this.manualInteractionReported = false;
    this.pointerGeometryFrozen = false;
    this.bookmarkUnavailableReported = false;
    this.pointerInputStartX = 0; this.pointerInputStartY = 0;
    this.lastInputX = 0; this.lastInputY = 0;
    if (pointerId >= 0) this.onPointerEnd(pointerId);
  }

  private reportManualInteraction(): void {
    if (this.manualInteractionReported) return;
    this.manualInteractionReported = true;
    this.onManualInteraction();
  }

  private reportBookmarkUnavailable(reason: 'busy' | 'unavailable'): void {
    if (this.bookmarkUnavailableReported || this.gestureState.owner !== 'bookmark' ||
      this.gestureState.inputOffsetY < READER_PAGE_GESTURE_BOOKMARK_SLOP) return;
    this.bookmarkUnavailableReported = true;
    this.onBookmarkUnavailable(reason);
  }

  private armLongPressTimer(): void {
    this.clearLongPressTimer();
    if (!this.gestureState.allowLongPress || this.activePointerId < 0) return;
    const remainingMs = this.pointerDownReceivedMs + READER_PAGE_GESTURE_LONG_PRESS_MS - readerMotionNowMs();
    if (remainingMs <= 0) {
      this.lockLongPress();
      return;
    }
    this.longPressTimer = setTimeout((): void => this.lockLongPress(), remainingMs);
  }

  private lockLongPress(): void {
    this.longPressTimer = -1;
    if (!this.acceptCurrentInput() || this.activePointerId < 0 || this.gestureState.owner !== 'undecided' ||
      this.gestureState.maxDistance2D >= READER_PAGE_GESTURE_TOUCH_SLOP) return;
    this.gestureState = updateReaderPagePanInPlace(
      this.gestureState,
      this.lastLocalX - this.gestureState.startLocalX,
      this.lastLocalY - this.gestureState.startLocalY,
      0,
      this.lastLocalX,
      this.lastLocalY,
      0,
      this.pointerDownTimeMs + READER_PAGE_GESTURE_LONG_PRESS_MS,
      this.lastInputX - this.pointerInputStartX,
      this.lastInputY - this.pointerInputStartY,
    );
    if (!this.canOfferPalmHandoff()) this.palmCandidate = undefined;
    // Preserve text selection's original hold deadline while the previous
    // turn still owns the presentation. Publish only if this segment is live.
    if (this.tapOnlyPointer) return;
    this.reportManualInteraction();
    this.publishCurrentGestureState();
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer < 0) return;
    clearTimeout(this.longPressTimer);
    this.longPressTimer = -1;
  }

  private armPointerWatchdog(): void {
    this.pointerLastActivityMs = readerMotionNowMs();
    if (this.pointerWatchdogTimer >= 0) return;
    this.schedulePointerWatchdog(READER_PAGE_POINTER_STALL_TIMEOUT_MS);
  }

  private schedulePointerWatchdog(delayMs: number): void {
    this.pointerWatchdogTimer = setTimeout((): void => {
      this.pointerWatchdogTimer = -1;
      if (!this.acceptCurrentInput()) return;
      if (this.activePointerId < 0) return;
      const remaining = READER_PAGE_POINTER_STALL_TIMEOUT_MS -
        Math.max(0, readerMotionNowMs() - this.pointerLastActivityMs);
      if (remaining > 0) {
        this.schedulePointerWatchdog(remaining);
        return;
      }
      this.cancelRawPointer();
    }, delayMs);
  }

  private clearPointerWatchdog(): void {
    if (this.pointerWatchdogTimer < 0) return;
    clearTimeout(this.pointerWatchdogTimer);
    this.pointerWatchdogTimer = -1;
  }

  private onInteractionEnabledChanged(): void {
    if (!this.acceptCurrentInput()) return;
    if (!this.interactionEnabled) {
      this.cancelRawPointer();
    }
  }

  private onInputRevisionChanged(): void {
    // The parent already invalidated the presentation. Do not send a stale
    // rollback into the replacement page or surface generation.
    this.reportActiveDrop('rollback');
    this.gestureState = createReaderPageGestureState();
    this.resolveDeferredSegment(undefined);
    this.resetRawPointer();
  }

  private onReadinessChanged(): void {
    if (!this.acceptCurrentInput()) return;
    const direction = this.gestureState.direction;
    if (this.activePointerId < 0 || !this.pointerRejected || this.tapOnlyPointer ||
      !this.interactionEnabled || direction === undefined || !this.canStartTurn(direction)) return;
    // Readiness is not an input sample. The pointer may have travelled a long
    // way and then stopped while pagination was being prepared. Re-basing the
    // origin to the latest point here discards that displacement and makes the
    // page appear to start moving only after the next MOVE/UP. Keep the
    // original DOWN origin and replay the latest already-recorded sample once
    // into the presentation owner. This is a local state hand-off, not a
    // synthetic physical event, so velocity remains zero until the next real
    // MOVE and the eventual UP still consumes the same segment exactly once.
    this.pointerRejected = false;
    this.velocityX = 0; this.velocityY = 0;
    this.gestureState = updateReaderPagePanInPlace(
      this.gestureState,
      this.lastLocalX - this.gestureState.startLocalX,
      this.lastLocalY - this.gestureState.startLocalY,
      0,
      this.lastLocalX,
      this.lastLocalY,
      0,
      this.lastSampleTimeMs,
      this.lastInputX - this.pointerInputStartX,
      this.lastInputY - this.pointerInputStartY,
    );
    this.onGestureStateChange(this.gestureState);
  }

  private onInteractionModeChanged(): void {
    if (!this.acceptCurrentInput()) return;
    if (this.activePointerId < 0) return;
    const tapOnly = this.tapOnlyNow();
    if (this.tapOnlyPointer && !tapOnly) {
      if (!this.pointerGeometryPropsMatch()) this.cancelRawPointer('geometry-changed');
      else this.promoteDeferredPointer();
      return;
    }
    if (!this.tapOnlyPointer && tapOnly) {
      this.cancelRawPointer();
    }
  }

  private promoteDeferredPointer(): void {
    this.tapOnlyPointer = false;
    if (this.deferredSegmentReserved) {
      this.deferredSegmentReserved = false;
      this.onDeferredSegmentPromote();
    }
    // Admission uses the already sampled gesture, including its DOWN, owner
    // and current pose. UP still settles the full physical displacement.
    if (this.gestureState.owner !== 'undecided') this.admitGestureOwner();
    if (!this.pointerRejected) this.publishCurrentGestureState();
  }

  private tapOnlyNow(): boolean {
    return this.currentTapOnly === undefined ? this.tapOnly : this.currentTapOnly();
  }

  private resolveDeferredSegment(intent: ReaderPageTapIntent | undefined): void {
    if (!this.deferredSegmentReserved) return;
    this.deferredSegmentReserved = false;
    this.onDeferredSegmentResolve(intent);
  }
}
