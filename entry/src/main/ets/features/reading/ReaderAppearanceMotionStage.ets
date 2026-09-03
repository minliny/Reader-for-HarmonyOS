import { FrameCallback } from '@kit.ArkUI';
import {
  TOK_BORDER_W,
  TOK_LINE_STRONG,
  TOK_READ_HANDLE,
  TOK_READ_SURFACE,
  TOK_RADIUS_XL,
} from '../common/ReaderTokens';
import {
  READER_APPEARANCE_FULL_HEIGHT,
  READER_APPEARANCE_QUICK_HEIGHT,
  READER_APPEARANCE_SHELL_TRAVEL_VP,
  readerAppearanceExpansionFromDrag,
  type ReaderAppearanceMotionFrame,
} from './ReaderAppearanceMotionGeometry';
import {
  advanceReaderAppearanceMotion,
  beginReaderAppearanceTracking,
  cancelReaderAppearanceMotion,
  createReaderAppearanceMotionState,
  readerAppearanceMotionIsActive,
  releaseReaderAppearanceTracking,
  sampleReaderAppearanceMotionState,
  setReaderAppearanceMotionTimeScale,
  startReaderAppearanceProgrammatic,
  updateReaderAppearanceTracking,
  type ReaderAppearanceMotionEndpoint,
  type ReaderAppearanceMotionState,
} from './ReaderAppearanceMotionState';

/** Phone-only Figma N/O stage. Tablet keeps the existing static control path. */
export const READER_APPEARANCE_MOTION_STAGE_WIDTH = 364;
export const READER_APPEARANCE_MOTION_STAGE_HEIGHT = READER_APPEARANCE_FULL_HEIGHT;
export const READER_APPEARANCE_MOTION_QUICK_HEIGHT = READER_APPEARANCE_QUICK_HEIGHT;
export const READER_APPEARANCE_MOTION_DRAG_TRAVEL = READER_APPEARANCE_SHELL_TRAVEL_VP;
export const READER_APPEARANCE_MOTION_GRABBER_HIT_WIDTH = 72;
export const READER_APPEARANCE_MOTION_GRABBER_HIT_HEIGHT = 44;
export const READER_APPEARANCE_MOTION_GRABBER_WIDTH = 42;
export const READER_APPEARANCE_MOTION_GRABBER_HEIGHT = 4;

const READER_APPEARANCE_MOTION_GRABBER_TOP = 9;
const READER_APPEARANCE_MOTION_TAP_SLOP = 8;
const READER_APPEARANCE_MOTION_TAP_MAX_DURATION_MS = 500;
const READER_APPEARANCE_MOTION_VELOCITY_IDLE_MS = 100;
const READER_APPEARANCE_MOTION_MAX_FRAME_DELTA_MS = 100;
const READER_APPEARANCE_MOTION_POINTER_STALL_MS = 15000;

// N/Appearance Expand `1505:18040`: QuickMorph's full-state base is 13,57.
// Its frame translation starts at -0.896,-28.007, yielding the authored
// quick-state placement around 12.1,29 without a second layout coordinate set.
const READER_APPEARANCE_QUICK_MORPH_BASE_X = 13;
const READER_APPEARANCE_QUICK_MORPH_BASE_Y = 57;
const READER_APPEARANCE_BRIGHTNESS_BASE_X = 312.44;
// BrightnessRail is a fixed-screen sibling of MorphStage in Figma N. Its
// quick endpoint is shellTop(406) + localY(28), and it never inherits the
// shell's 406→0 translation; only its own +15 dissolve track may move it.
const READER_APPEARANCE_BRIGHTNESS_FIXED_Y =
  READER_APPEARANCE_MOTION_DRAG_TRAVEL + 28;
const READER_APPEARANCE_BRIGHTNESS_WIDTH = 38;
const READER_APPEARANCE_BRIGHTNESS_HEIGHT = 190;

export interface ReaderAppearanceMotionSlotContext {
  frame: ReaderAppearanceMotionFrame;
  interactionEnabled: boolean;
  requestCollapse: () => void;
}

class ReaderAppearanceStageFrameCallback extends FrameCallback {
  private readonly callback: (frameTimeInNano: number) => void;

  constructor(callback: (frameTimeInNano: number) => void) {
    super();
    this.callback = callback;
  }

  onFrame(frameTimeInNano: number): void {
    this.callback(frameTimeInNano);
  }

  onIdle(_timeLeftInNano: number): void {}
}

/**
 * Persistent, interruptible Phone appearance stage.
 *
 * Quick, Full, BrightnessRail and ModuleNav stay mounted for the whole N/O
 * trajectory. The visible grabber is owned only here. Raw touch controls the
 * physical 330↔736 shell range; the pure motion engine inverse-maps that
 * geometry to the authored Figma timeline. No animateTo call owns this clock.
 */
@Component
export struct ReaderAppearanceMotionStage {
  /** Stable route endpoint. It changes only after `onEndpointChange`. */
  @Prop @Watch('onRequestedEndpointChanged') expanded: boolean = false;
  @Prop @Watch('onReduceMotionChanged') reduceMotion: boolean = false;
  @Prop @Watch('onVisibleChanged') visible: boolean = true;
  @Prop @Watch('onInteractionEnabledChanged') interactionEnabled: boolean = true;
  @Prop availableWidth: number = READER_APPEARANCE_MOTION_STAGE_WIDTH;
  @Prop @Watch('onMotionTimeScaleChanged') motionTimeScale: number = 1;

  onEndpointChange: (endpoint: ReaderAppearanceMotionEndpoint) => void =
    (_endpoint: ReaderAppearanceMotionEndpoint): void => {};
  onMotionActivityChange: (active: boolean) => void = (_active: boolean): void => {};

  @BuilderParam quickMorph: (context: ReaderAppearanceMotionSlotContext) => void;
  @BuilderParam fullContent: (context: ReaderAppearanceMotionSlotContext) => void;
  @BuilderParam brightnessRail: (context: ReaderAppearanceMotionSlotContext) => void;
  @BuilderParam moduleNav: (context: ReaderAppearanceMotionSlotContext) => void;

  private motionState: ReaderAppearanceMotionState =
    createReaderAppearanceMotionState('quick');
  @State private renderFrame: ReaderAppearanceMotionFrame =
    sampleReaderAppearanceMotionState(createReaderAppearanceMotionState('quick'));

  private mounted: boolean = false;
  private activePointerId: number = -1;
  private pointerDownTimeMs: number = 0;
  private pointerStartWindowY: number = 0;
  private pointerLastWindowY: number = 0;
  private pointerLastTimeMs: number = 0;
  private pointerVelocityY: number = 0;
  private pointerWatchdogTimer: number = -1;
  private trackingStartRawExpansion: number = 0;
  private pointerDragging: boolean = false;
  private frameCallbackRevision: number = 0;
  private pendingFrameCallbackRevision: number = -1;
  private lifecycleRevision: number = 0;
  private lastFrameTimeInNano: number = -1;
  private frameClockEpoch: number = -1;
  private lastMotionActive: boolean = false;
  private lastReportedEndpoint: ReaderAppearanceMotionEndpoint | '' = '';

  aboutToAppear(): void {
    this.lifecycleRevision += 1;
    this.pendingFrameCallbackRevision = -1;
    this.mounted = true;
    const endpoint: ReaderAppearanceMotionEndpoint = this.expanded ? 'full' : 'quick';
    this.motionState = createReaderAppearanceMotionState(
      endpoint,
      this.reduceMotion,
      this.effectiveTimeScale(),
    );
    this.renderFrame = sampleReaderAppearanceMotionState(this.motionState);
    this.lastReportedEndpoint = endpoint;
    this.lastMotionActive = false;
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.lifecycleRevision += 1;
    this.pendingFrameCallbackRevision = -1;
    this.motionState = cancelReaderAppearanceMotion(this.motionState);
    this.resetPointer();
    this.resetFrameClock();
    this.publishMotionActivity(false);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // Real height morph with a fixed bottom edge. scaleY would deform the
      // border, corner radius and child geometry and is forbidden here.
      Stack()
        .width(this.stageWidth())
        .height(this.renderFrame.shellHeight)
        .position({ x: 0, y: this.shellTop() })
        .backgroundColor(TOK_READ_SURFACE)
        .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
        .borderRadius(TOK_RADIUS_XL)
        .clip(true)
        .hitTestBehavior(HitTestMode.None)
        .zIndex(0);

      this.fullMorphStageLayer();
      this.quickDockLayer();
      this.grabberLayer();
    }
    .width(this.stageWidth())
    .height(READER_APPEARANCE_MOTION_STAGE_HEIGHT)
    // The fixed 736vp coordinate canvas must not swallow reading-page taps
    // above a stable 330vp quick shell. Concrete shell/actor/grabber children
    // own only their visible regions.
    .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private fullMorphStageLayer() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.fullLayer();
    }
    .width(this.stageWidth())
    .height(this.contentShellHeight())
    .position({
      x: this.renderFrame.morphStage.translateX,
      y: this.contentShellTop(),
    })
    .borderRadius(TOK_RADIUS_XL)
    .clip(true)
    .hitTestBehavior(HitTestMode.Default)
    .zIndex(2);
  }

  @Builder
  private quickDockLayer() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.quickMorphStageLayer();
      this.brightnessLayer();
      this.moduleNavLayer();
    }
    .width(this.stageWidth())
    .height(READER_APPEARANCE_MOTION_STAGE_HEIGHT)
    .enabled(this.quickInteractionEnabled())
    .hitTestBehavior(HitTestMode.None)
    .zIndex(3);
  }

  @Builder
  private quickMorphStageLayer() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.quickMorphLayer();
    }
    .width(this.stageWidth())
    .height(this.contentShellHeight())
    .position({
      x: this.renderFrame.morphStage.translateX,
      y: this.contentShellTop(),
    })
    .borderRadius(TOK_RADIUS_XL)
    .clip(true)
    .hitTestBehavior(this.quickInteractionEnabled() ? HitTestMode.Default : HitTestMode.None)
    .zIndex(1);
  }

  @Builder
  private quickMorphLayer() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.quickMorph({
        frame: this.renderFrame,
        interactionEnabled: this.quickInteractionEnabled(),
        requestCollapse: (): void => this.requestCollapse(),
      });
    }
    // The slot consumes quickMorph + element actors itself. This wrapper owns
    // only the immutable full-state base origin, preventing transforms from
    // being applied twice when the shared element reflows.
    .width(READER_APPEARANCE_MOTION_STAGE_WIDTH - READER_APPEARANCE_QUICK_MORPH_BASE_X * 2)
    .height(READER_APPEARANCE_MOTION_STAGE_HEIGHT - READER_APPEARANCE_QUICK_MORPH_BASE_Y)
    .position({
      x: READER_APPEARANCE_QUICK_MORPH_BASE_X,
      y: READER_APPEARANCE_QUICK_MORPH_BASE_Y,
    })
    .enabled(this.quickInteractionEnabled())
    .hitTestBehavior(this.quickInteractionEnabled() ? HitTestMode.Default : HitTestMode.None)
    .zIndex(1);
  }

  @Builder
  private fullLayer() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        this.fullContent({
          frame: this.renderFrame,
          interactionEnabled: this.fullInteractionEnabled(),
          requestCollapse: (): void => this.requestCollapse(),
        });
      }
      .width(READER_APPEARANCE_MOTION_STAGE_WIDTH)
      .height(READER_APPEARANCE_MOTION_STAGE_HEIGHT);
    }
    .width(READER_APPEARANCE_MOTION_STAGE_WIDTH)
    .height(READER_APPEARANCE_MOTION_STAGE_HEIGHT)
    .enabled(this.fullInteractionEnabled())
    .hitTestBehavior(this.fullInteractionEnabled() ? HitTestMode.Default : HitTestMode.None)
    .zIndex(2);
  }

  @Builder
  private brightnessLayer() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.brightnessRail({
        frame: this.renderFrame,
        interactionEnabled: this.quickInteractionEnabled(),
        requestCollapse: (): void => this.requestCollapse(),
      });
    }
    .width(READER_APPEARANCE_BRIGHTNESS_WIDTH)
    .height(READER_APPEARANCE_BRIGHTNESS_HEIGHT)
    .position({
      x: READER_APPEARANCE_BRIGHTNESS_BASE_X,
      y: READER_APPEARANCE_BRIGHTNESS_FIXED_Y,
    })
    .translate({
      x: this.brightnessTranslateX(),
      y: this.brightnessTranslateY(),
    })
    .opacity(this.brightnessOpacity())
    .blur(this.brightnessBlur())
    .enabled(this.quickInteractionEnabled())
    .hitTestBehavior(this.quickInteractionEnabled() ? HitTestMode.Default : HitTestMode.None)
    .zIndex(2);
  }

  @Builder
  private moduleNavLayer() {
    Stack({ alignContent: Alignment.Bottom }) {
      this.moduleNav({
        frame: this.renderFrame,
        interactionEnabled: this.quickInteractionEnabled(),
        requestCollapse: (): void => this.requestCollapse(),
      });
    }
    .width(this.stageWidth())
    .height(READER_APPEARANCE_MOTION_STAGE_HEIGHT)
    .translate({
      x: this.moduleNavTranslateX(),
      y: this.moduleNavTranslateY(),
    })
    .opacity(this.moduleNavOpacity())
    .blur(this.moduleNavBlur())
    .enabled(this.quickInteractionEnabled())
    .hitTestBehavior(this.quickInteractionEnabled() ? HitTestMode.Default : HitTestMode.None)
    .zIndex(3);
  }

  @Builder
  private grabberLayer() {
    Stack({ alignContent: Alignment.Top }) {
      Row()
        .width(READER_APPEARANCE_MOTION_GRABBER_WIDTH)
        .height(READER_APPEARANCE_MOTION_GRABBER_HEIGHT)
        .margin({ top: READER_APPEARANCE_MOTION_GRABBER_TOP })
        .backgroundColor(TOK_READ_HANDLE)
        .borderRadius(999)
        .hitTestBehavior(HitTestMode.None);
    }
    .width(READER_APPEARANCE_MOTION_GRABBER_HIT_WIDTH)
    .height(READER_APPEARANCE_MOTION_GRABBER_HIT_HEIGHT)
    .position({
      x: (this.stageWidth() - READER_APPEARANCE_MOTION_GRABBER_HIT_WIDTH) / 2,
      y: this.shellTop(),
    })
    .zIndex(10)
    .enabled(this.visible && this.interactionEnabled)
    .hitTestBehavior(this.visible && this.interactionEnabled ? HitTestMode.Block : HitTestMode.None)
    .accessibilityText(this.grabberAccessibilityText())
    .accessibilityTextHint('点击切换展开状态，上下拖动可连续调整')
    .onTouch((event: TouchEvent): void => this.handleGrabberTouch(event));
  }

  private handleGrabberTouch(event: TouchEvent): void {
    if (!this.visible || !this.interactionEnabled) {
      this.cancelPointerInteraction();
      return;
    }
    if (event.type === TouchType.Down) {
      if (this.activePointerId >= 0) {
        return;
      }
      this.beginPointerInteraction(event);
      return;
    }
    if (event.type === TouchType.Cancel) {
      this.cancelPointerInteraction();
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
    this.ownPointer(event);
    if (event.type === TouchType.Move) {
      this.updatePointerInteraction(event, pointer);
      return;
    }
    if (event.type === TouchType.Up) {
      this.finishPointerInteraction(event, pointer);
    }
  }

  private beginPointerInteraction(event: TouchEvent): void {
    const pointer = event.changedTouches.length > 0 ? event.changedTouches[0] : event.touches[0];
    if (pointer === undefined) {
      return;
    }
    this.ownPointer(event);
    const eventTimeMs = this.eventTimeMs(event);
    // Fold shell-only elastic displacement into the physical start coordinate
    // before the engine cancels it. The first re-grab frame therefore stays at
    // the already rendered top edge rather than jumping by the rebound amount.
    this.motionState = beginReaderAppearanceTracking(this.motionState, eventTimeMs);
    this.activePointerId = pointer.id;
    this.pointerDownTimeMs = eventTimeMs;
    this.pointerStartWindowY = pointer.windowY;
    this.pointerLastWindowY = pointer.windowY;
    this.pointerLastTimeMs = eventTimeMs;
    this.pointerVelocityY = 0;
    this.trackingStartRawExpansion = this.motionState.rawExpansionProgress;
    this.pointerDragging = false;
    this.armPointerWatchdog();
    this.seedFrameClock(event);
    this.publishFrame();
  }

  private updatePointerInteraction(event: TouchEvent, pointer: TouchObject): void {
    const eventTimeMs = this.eventTimeMs(event);
    const deltaY = pointer.windowY - this.pointerStartWindowY;
    this.armPointerWatchdog();
    this.updatePointerVelocity(pointer.windowY, eventTimeMs);
    if (!this.pointerDragging && Math.abs(deltaY) < READER_APPEARANCE_MOTION_TAP_SLOP) {
      return;
    }
    this.pointerDragging = true;
    const rawExpansion = readerAppearanceExpansionFromDrag(this.trackingStartRawExpansion, deltaY);
    this.motionState = updateReaderAppearanceTracking(
      this.motionState,
      rawExpansion,
      eventTimeMs,
      this.pointerVelocityY,
    );
    this.pointerLastWindowY = pointer.windowY;
    this.pointerLastTimeMs = eventTimeMs;
    this.publishFrame();
  }

  private finishPointerInteraction(event: TouchEvent, pointer: TouchObject): void {
    const eventTimeMs = this.eventTimeMs(event);
    const deltaY = pointer.windowY - this.pointerStartWindowY;
    this.updatePointerVelocity(pointer.windowY, eventTimeMs);
    if (this.pointerDragging) {
      const rawExpansion = readerAppearanceExpansionFromDrag(this.trackingStartRawExpansion, deltaY);
      this.motionState = updateReaderAppearanceTracking(
        this.motionState,
        rawExpansion,
        eventTimeMs,
        this.pointerVelocityY,
      );
    }
    const elapsedMs = eventTimeMs - this.pointerDownTimeMs;
    const isTap = !this.pointerDragging &&
      Math.abs(deltaY) < READER_APPEARANCE_MOTION_TAP_SLOP &&
      elapsedMs <= READER_APPEARANCE_MOTION_TAP_MAX_DURATION_MS;
    if (isTap) {
      this.motionState = startReaderAppearanceProgrammatic(
        this.motionState,
        this.programmaticTarget(),
      );
    } else {
      const releaseVelocity = eventTimeMs - this.pointerLastTimeMs >
        READER_APPEARANCE_MOTION_VELOCITY_IDLE_MS ? 0 : this.pointerVelocityY;
      this.motionState = releaseReaderAppearanceTracking(
        this.motionState,
        releaseVelocity,
        eventTimeMs,
      );
    }
    this.resetPointer();
    this.seedFrameClock(event);
    this.publishFrame();
    this.reportImmediateEndpointIfNeeded();
    this.scheduleNextFrame();
  }

  private cancelPointerInteraction(): void {
    if (this.activePointerId < 0 && !this.motionActive()) {
      return;
    }
    this.motionState = cancelReaderAppearanceMotion(this.motionState);
    this.resetPointer();
    this.resetFrameClock();
    this.publishFrame();
  }

  private requestCollapse(): void {
    if (!this.visible || !this.interactionEnabled) {
      return;
    }
    this.motionState = startReaderAppearanceProgrammatic(this.motionState, 'quick');
    this.resetPointer();
    this.resetFrameClock();
    this.publishFrame();
    this.reportImmediateEndpointIfNeeded();
    this.scheduleNextFrame();
  }

  private scheduleNextFrame(): void {
    if (!this.mounted || !this.visible || !this.motionActive() ||
      this.pendingFrameCallbackRevision >= 0) {
      return;
    }
    const expectedEpoch = this.motionState.epoch;
    const lifecycleRevision = this.lifecycleRevision;
    const callbackRevision = this.frameCallbackRevision + 1;
    this.frameCallbackRevision = callbackRevision;
    this.pendingFrameCallbackRevision = callbackRevision;
    this.getUIContext().postFrameCallback(new ReaderAppearanceStageFrameCallback(
      (frameTimeInNano: number): void => this.handleMotionFrame(
        frameTimeInNano,
        expectedEpoch,
        lifecycleRevision,
        callbackRevision,
      ),
    ));
  }

  private handleMotionFrame(
    frameTimeInNano: number,
    expectedEpoch: number,
    lifecycleRevision: number,
    callbackRevision: number,
  ): void {
    if (lifecycleRevision !== this.lifecycleRevision) {
      return;
    }
    if (this.pendingFrameCallbackRevision === callbackRevision) {
      this.pendingFrameCallbackRevision = -1;
    }
    if (!this.mounted || !this.visible) {
      return;
    }
    if (expectedEpoch !== this.motionState.epoch) {
      // A DOWN may interrupt a posted settlement frame. Never let the stale
      // callback overwrite the new pointer segment; if that segment has since
      // released, schedule its own epoch now.
      this.scheduleNextFrame();
      return;
    }
    const deltaMs = this.frameDeltaMs(frameTimeInNano, expectedEpoch);
    const result = advanceReaderAppearanceMotion(this.motionState, deltaMs, expectedEpoch);
    this.motionState = result.state;
    this.publishFrame();
    if (result.completedEndpoint !== undefined) {
      this.reportEndpoint(result.completedEndpoint);
    }
    if (result.shouldContinue) {
      this.scheduleNextFrame();
    }
  }

  private frameDeltaMs(frameTimeInNano: number, expectedEpoch: number): number {
    if (this.frameClockEpoch !== expectedEpoch || this.lastFrameTimeInNano < 0) {
      this.frameClockEpoch = expectedEpoch;
      this.lastFrameTimeInNano = frameTimeInNano;
      return 0;
    }
    const deltaMs = (frameTimeInNano - this.lastFrameTimeInNano) / 1_000_000;
    this.lastFrameTimeInNano = frameTimeInNano;
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
      return 0;
    }
    return Math.min(deltaMs, READER_APPEARANCE_MOTION_MAX_FRAME_DELTA_MS);
  }

  private publishFrame(): void {
    this.renderFrame = sampleReaderAppearanceMotionState(this.motionState);
    this.publishMotionActivity(this.motionActive());
  }

  private publishMotionActivity(active: boolean): void {
    if (active === this.lastMotionActive) {
      return;
    }
    this.lastMotionActive = active;
    this.onMotionActivityChange(active);
  }

  private reportImmediateEndpointIfNeeded(): void {
    if (this.motionState.phase === 'idleQuick') {
      this.reportEndpoint('quick');
    } else if (this.motionState.phase === 'idleFull') {
      this.reportEndpoint('full');
    }
  }

  private reportEndpoint(endpoint: ReaderAppearanceMotionEndpoint): void {
    if (endpoint === this.lastReportedEndpoint) {
      return;
    }
    this.lastReportedEndpoint = endpoint;
    this.onEndpointChange(endpoint);
  }

  private onRequestedEndpointChanged(): void {
    if (!this.mounted) {
      return;
    }
    const endpoint: ReaderAppearanceMotionEndpoint = this.expanded ? 'full' : 'quick';
    // Gesture settlement reports its logical endpoint before the independent
    // shell-only rebound finishes. The parent then commits activePage and
    // reflects this prop. Matching that committed stable endpoint must not
    // restart a second O/N timeline over the live elastic frames.
    if (endpoint === this.motionState.stableEndpoint &&
      (this.motionState.phase === 'elastic' || this.motionState.phase === 'idleQuick' ||
        this.motionState.phase === 'idleFull')) {
      this.lastReportedEndpoint = endpoint;
      return;
    }
    if (endpoint === this.motionState.target && this.motionActive()) {
      return;
    }
    if ((endpoint === 'quick' && this.motionState.phase === 'idleQuick') ||
      (endpoint === 'full' && this.motionState.phase === 'idleFull')) {
      this.lastReportedEndpoint = endpoint;
      return;
    }
    this.motionState = startReaderAppearanceProgrammatic(this.motionState, endpoint);
    this.resetFrameClock();
    this.publishFrame();
    this.reportImmediateEndpointIfNeeded();
    this.scheduleNextFrame();
  }

  private onReduceMotionChanged(): void {
    if (!this.mounted) {
      return;
    }
    const endpoint: ReaderAppearanceMotionEndpoint = this.nearestEndpoint();
    this.motionState = createReaderAppearanceMotionState(
      endpoint,
      this.reduceMotion,
      this.effectiveTimeScale(),
    );
    this.resetPointer();
    this.resetFrameClock();
    this.publishFrame();
    this.reportEndpoint(endpoint);
  }

  private onMotionTimeScaleChanged(): void {
    if (!this.mounted) {
      return;
    }
    this.motionState = setReaderAppearanceMotionTimeScale(
      this.motionState,
      this.effectiveTimeScale(),
    );
    // The pure rescaler preserves the normalized frame and increments epoch.
    // Resetting only the clock makes the next VSync continue from that exact
    // image with the new remaining duration; a pending old-epoch callback is
    // discarded by the normal handoff path.
    this.resetFrameClock();
    this.publishFrame();
    this.scheduleNextFrame();
  }

  private onVisibleChanged(): void {
    if (!this.mounted) {
      return;
    }
    if (!this.visible) {
      this.motionState = cancelReaderAppearanceMotion(this.motionState);
      this.resetPointer();
      this.resetFrameClock();
      this.publishFrame();
      return;
    }
    const endpoint: ReaderAppearanceMotionEndpoint = this.expanded ? 'full' : 'quick';
    this.motionState = createReaderAppearanceMotionState(
      endpoint,
      this.reduceMotion,
      this.effectiveTimeScale(),
    );
    this.renderFrame = sampleReaderAppearanceMotionState(this.motionState);
    this.lastReportedEndpoint = endpoint;
  }

  private onInteractionEnabledChanged(): void {
    if (!this.interactionEnabled) {
      this.cancelPointerInteraction();
    }
  }

  private programmaticTarget(): ReaderAppearanceMotionEndpoint {
    return this.motionState.profile === 'expandN' ? 'full' : 'quick';
  }

  private nearestEndpoint(): ReaderAppearanceMotionEndpoint {
    return this.motionState.expansionProgress >= 0.5 ? 'full' : 'quick';
  }

  private quickInteractionEnabled(): boolean {
    return this.visible && this.interactionEnabled && this.motionState.phase === 'idleQuick';
  }

  private fullInteractionEnabled(): boolean {
    return this.visible && this.interactionEnabled && this.motionState.phase === 'idleFull';
  }

  private motionActive(): boolean {
    return readerAppearanceMotionIsActive(this.motionState);
  }

  private shellTop(): number {
    // The state sampler already folds raw overflow/elastic into shell geometry
    // only. Content actors continue to read the clamped authored trajectory.
    return this.renderFrame.shellTranslateY;
  }

  private contentShellHeight(): number {
    return READER_APPEARANCE_MOTION_QUICK_HEIGHT +
      this.renderFrame.expansionProgress * READER_APPEARANCE_MOTION_DRAG_TRAVEL;
  }

  private contentShellTop(): number {
    // Raw drag overflow and rebound are shell-only supplements. The content
    // clip follows the clamped authored MorphStage, so no opacity/blur/shared
    // actor is displaced by the elastic channel.
    return READER_APPEARANCE_MOTION_STAGE_HEIGHT - this.contentShellHeight();
  }

  private brightnessOpacity(): number {
    return this.motionState.profile === 'expandN' ? this.renderFrame.brightnessRail.opacity : 1;
  }

  private brightnessTranslateX(): number {
    return this.motionState.profile === 'expandN' ? this.renderFrame.brightnessRail.translateX : 0;
  }

  private brightnessTranslateY(): number {
    return this.motionState.profile === 'expandN' ? this.renderFrame.brightnessRail.translateY : 0;
  }

  private brightnessBlur(): number {
    return this.motionState.profile === 'expandN' ? this.renderFrame.brightnessRail.blurVp : 0;
  }

  private moduleNavOpacity(): number {
    return this.motionState.profile === 'expandN' ? this.renderFrame.moduleNav.opacity : 1;
  }

  private moduleNavTranslateX(): number {
    return this.motionState.profile === 'expandN' ? this.renderFrame.moduleNav.translateX : 0;
  }

  private moduleNavTranslateY(): number {
    return this.motionState.profile === 'expandN' ? this.renderFrame.moduleNav.translateY : 0;
  }

  private moduleNavBlur(): number {
    return this.motionState.profile === 'expandN' ? this.renderFrame.moduleNav.blurVp : 0;
  }

  private stageWidth(): number {
    if (!Number.isFinite(this.availableWidth) || this.availableWidth <= 0) {
      return READER_APPEARANCE_MOTION_STAGE_WIDTH;
    }
    return Math.min(READER_APPEARANCE_MOTION_STAGE_WIDTH, this.availableWidth);
  }

  private effectiveTimeScale(): number {
    if (!Number.isFinite(this.motionTimeScale)) {
      return 1;
    }
    return Math.max(0.25, Math.min(4, this.motionTimeScale));
  }

  private grabberAccessibilityText(): string {
    if (this.motionState.phase === 'idleFull') {
      return '收起界面完整控制';
    }
    if (this.motionState.phase === 'idleQuick') {
      return '展开界面完整控制';
    }
    return '调整界面控制面板';
  }

  private updatePointerVelocity(windowY: number, eventTimeMs: number): void {
    const elapsedMs = eventTimeMs - this.pointerLastTimeMs;
    if (elapsedMs > 0) {
      const instantaneous = (windowY - this.pointerLastWindowY) * 1000 / elapsedMs;
      // Retain enough of the previous sample to avoid one noisy MOVE deciding
      // the endpoint while still making a fast final flick responsive.
      this.pointerVelocityY = this.pointerVelocityY * 0.25 + instantaneous * 0.75;
    }
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
    return undefined;
  }

  private eventTimeMs(event: TouchEvent): number {
    return Number.isFinite(event.timestamp) && event.timestamp >= 0 ?
      event.timestamp / 1_000_000 : Date.now();
  }

  private ownPointer(event: TouchEvent): void {
    event.stopPropagation();
    try {
      event.preventDefault();
    } catch (_error) {
      // Current ArkUI exposes preventDefault; keep older runtimes usable.
    }
  }

  private resetPointer(): void {
    this.clearPointerWatchdog();
    this.activePointerId = -1;
    this.pointerDownTimeMs = 0;
    this.pointerStartWindowY = 0;
    this.pointerLastWindowY = 0;
    this.pointerLastTimeMs = 0;
    this.pointerVelocityY = 0;
    this.trackingStartRawExpansion = 0;
    this.pointerDragging = false;
  }

  private armPointerWatchdog(): void {
    this.clearPointerWatchdog();
    if (this.activePointerId < 0) {
      return;
    }
    this.pointerWatchdogTimer = setTimeout((): void => {
      this.pointerWatchdogTimer = -1;
      if (this.activePointerId >= 0) {
        this.cancelPointerInteraction();
      }
    }, READER_APPEARANCE_MOTION_POINTER_STALL_MS);
  }

  private clearPointerWatchdog(): void {
    if (this.pointerWatchdogTimer < 0) {
      return;
    }
    clearTimeout(this.pointerWatchdogTimer);
    this.pointerWatchdogTimer = -1;
  }

  private resetFrameClock(): void {
    this.lastFrameTimeInNano = -1;
    this.frameClockEpoch = -1;
  }

  private seedFrameClock(event: TouchEvent): void {
    this.resetFrameClock();
    if (Number.isFinite(event.timestamp) && event.timestamp >= 0) {
      this.frameClockEpoch = this.motionState.epoch;
      this.lastFrameTimeInNano = event.timestamp;
    }
  }
}
