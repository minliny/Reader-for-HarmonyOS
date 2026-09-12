import { FrameCallback } from '@kit.ArkUI';
import {
  TOK_BORDER_W,
  TOK_LINE_STRONG,
  TOK_RADIUS_XL,
  TOK_READ_HANDLE,
  TOK_READ_SURFACE,
} from '../common/ReaderTokens';
import {
  READER_APPEARANCE_FULL_HEIGHT,
  READER_APPEARANCE_MIN_INTERACTIVE_TRAVEL_VP,
  READER_APPEARANCE_QUICK_HEIGHT,
  READER_APPEARANCE_STAGE_WIDTH,
  type ReaderAppearanceMeasuredAxis,
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
  setReaderAppearanceMeasuredAxis,
  setReaderAppearanceMotionTimeScale,
  startReaderAppearanceProgrammatic,
  updateReaderAppearanceTracking,
  type ReaderAppearanceMotionEndpoint,
  type ReaderAppearanceMotionState,
} from './ReaderAppearanceMotionState';
import { ReaderAppearanceFullPanel } from './ReaderAppearanceFullPanel';
import type { ReaderChineseConversionMode } from './ReaderChineseConversionGateway';
import {
  createDefaultReaderAppearanceSnapshot,
  type ReaderAppearanceAlignment,
  type ReaderAppearanceFont,
  type ReaderAppearanceFontSlot,
  type ReaderAppearanceIndent,
  type ReaderAppearanceMetric,
  type ReaderAppearanceSnapshot,
  type ReaderAppearanceStepDirection,
  type ReaderAppearanceTheme,
} from './ReaderAppearanceState';
import type { ReaderPageTurnStyle } from './ReaderSettingsState';

/** Phone-only direct-manipulation appearance stage. Tablet keeps the static path. */
export const READER_APPEARANCE_MOTION_STAGE_WIDTH = READER_APPEARANCE_STAGE_WIDTH;
export const READER_APPEARANCE_MOTION_STAGE_HEIGHT = READER_APPEARANCE_FULL_HEIGHT;
export const READER_APPEARANCE_MOTION_QUICK_HEIGHT = READER_APPEARANCE_QUICK_HEIGHT;
export const READER_APPEARANCE_MOTION_GRABBER_HIT_WIDTH = 72;
export const READER_APPEARANCE_MOTION_GRABBER_HIT_HEIGHT =
  READER_APPEARANCE_MIN_INTERACTIVE_TRAVEL_VP;
export const READER_APPEARANCE_MOTION_GRABBER_WIDTH = 42;
export const READER_APPEARANCE_MOTION_GRABBER_HEIGHT = 4;

const READER_APPEARANCE_MOTION_GRABBER_TOP = 9;
const READER_APPEARANCE_MOTION_TAP_SLOP = 8;
const READER_APPEARANCE_MOTION_TAP_MAX_DURATION_MS = 500;
const READER_APPEARANCE_MOTION_VELOCITY_IDLE_MS = 100;
const READER_APPEARANCE_MOTION_MAX_FRAME_DELTA_MS = 100;
const READER_APPEARANCE_MOTION_POINTER_STALL_MS = 15000;

export const READER_APPEARANCE_MOTION_BRIGHTNESS_X = 312.44;
export const READER_APPEARANCE_MOTION_BRIGHTNESS_WIDTH = 38;
export const READER_APPEARANCE_MOTION_BRIGHTNESS_HEIGHT = 190;

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
 * AppearanceContent, BrightnessRail and ModuleNav stay mounted for the whole
 * master axis. The visible grabber is owned only here. Raw touch measures
 * the grabber in screen coordinates and produces the one master progress that
 * every actor samples. No animateTo call owns this clock.
 */
@Component
export struct ReaderAppearanceMotionStage {
  /** Stable route endpoint. It changes only after `onEndpointChange`. */
  @Prop @Watch('onRequestedEndpointChanged') expanded: boolean = false;
  @Prop @Watch('onReduceMotionChanged') reduceMotion: boolean = false;
  @Prop @Watch('onVisibleChanged') visible: boolean = true;
  @Prop @Watch('onInteractionEnabledChanged') interactionEnabled: boolean = true;
  @Prop @Watch('onCollapseRequestRevisionChanged') collapseRequestRevision: number = 0;
  @Prop availableWidth: number = READER_APPEARANCE_MOTION_STAGE_WIDTH;
  @Prop @Watch('onAvailableHeightChanged') availableHeight: number =
    READER_APPEARANCE_MOTION_STAGE_HEIGHT;
  @Prop @Watch('onMotionTimeScaleChanged') motionTimeScale: number = 1;

  /** Static business builders; every animated wrapper is owned by this clock. */
  @BuilderParam brightnessContent: () => void;
  @BuilderParam moduleNavContent: () => void;

  @Prop snapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  @Prop chineseConversionMode: ReaderChineseConversionMode = 'none';
  @Prop pageTurnStyle: ReaderPageTurnStyle = 'slide';
  @Prop pageTurnSimulationAvailable: boolean = true;
  onCollapse: () => void = (): void => {};
  onThemeChange: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetDayTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onSetNightTheme: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onFontChange: (font: ReaderAppearanceFont) => void = (_font: ReaderAppearanceFont): void => {};
  onFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]) => void =
    (_fontOrder: ReaderAppearanceFontSlot[]): void => {};
  onFontReorderActivityChange: (active: boolean) => void = (_active: boolean): void => {};
  onCustomFontImport: () => void = (): void => {};
  onIndentRequest: (indent: ReaderAppearanceIndent) => void = (_indent: ReaderAppearanceIndent): void => {};
  onAlignmentRequest: (current: ReaderAppearanceAlignment) => void =
    (_current: ReaderAppearanceAlignment): void => {};
  onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection) => void =
    (_metric: ReaderAppearanceMetric, _direction: ReaderAppearanceStepDirection): void => {};
  onChineseConversionChange: (mode: ReaderChineseConversionMode) => void =
    (_mode: ReaderChineseConversionMode): void => {};
  onPageTurnStyleChange: (style: ReaderPageTurnStyle) => void =
    (_style: ReaderPageTurnStyle): void => {};

  onEndpointChange: (endpoint: ReaderAppearanceMotionEndpoint) => void =
    (_endpoint: ReaderAppearanceMotionEndpoint): void => {};
  onMotionActivityChange: (active: boolean) => void = (_active: boolean): void => {};
  /** Publish the one primitive spatial coordinate to the visual owner. */
  onMasterProgressChange: (progress: number) => void = (_progress: number): void => {};

  /** One primitive progress coordinate is retained across the complete gesture axis. */
  @State private masterProgress: number = 0;

  private motionState: ReaderAppearanceMotionState =
    createReaderAppearanceMotionState('quick');
  @State private renderFrame: ReaderAppearanceMotionFrame =
    sampleReaderAppearanceMotionState(createReaderAppearanceMotionState('quick'));

  private mounted: boolean = false;
  private stageScreenY: number = Number.NaN;
  private measuredGrabberScreenY: number = Number.NaN;
  private activePointerId: number = -1;
  private pointerDownTimeMs: number = 0;
  private pointerStartWindowY: number = 0;
  private pointerLastWindowY: number = 0;
  private pointerLastTimeMs: number = 0;
  private pointerVelocityY: number = 0;
  private pointerWatchdogTimer: number = -1;
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
    this.renderFrame = sampleReaderAppearanceMotionState(this.motionState, this.stageHeight());
    this.masterProgress = this.renderFrame.masterProgress;
    this.onMasterProgressChange(this.renderFrame.masterProgress);
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
      this.shellLayer();
      this.contentLayer();
      this.brightnessLayer();
      this.moduleNavLayer();
      this.grabberLayer();
    }
    .width(this.stageWidth())
    .height(this.stageHeight())
    .hitTestBehavior(HitTestMode.None)
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      this.stageScreenY = Number(newValue.globalPosition.y);
      this.refreshMeasuredAxisForLayout();
    });
  }

  @Builder
  private shellLayer() {
    Stack()
      .width(this.stageWidth())
      .height(this.renderFrame.shellHeight)
      .position({ x: 0, y: this.renderFrame.shellTranslateY })
      .backgroundColor(TOK_READ_SURFACE)
      .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
      .borderRadius(TOK_RADIUS_XL)
      .clip(true)
      .hitTestBehavior(HitTestMode.None)
      .zIndex(0);
  }

  @Builder
  private contentLayer() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.appearancePanel();
    }
    .width(this.stageWidth())
    .height(this.renderFrame.shellHeight)
    .position({ x: 0, y: this.renderFrame.shellTranslateY })
    .borderRadius(TOK_RADIUS_XL)
    .clip(true)
    .hitTestBehavior(this.contentInteractionEnabled() ? HitTestMode.Default : HitTestMode.None)
    .zIndex(2);
  }

  @Builder
  private appearancePanel() {
    ReaderAppearanceFullPanel({
      isTablet: false,
      availableWidth: this.availableWidth,
      availableHeight: this.availableHeight,
      reduceMotion: this.reduceMotion,
      motionProgress: this.masterProgress,
      motionEnabled: true,
      motionFullHeight: this.stageHeight(),
      interactionEnabled: this.contentInteractionEnabled(),
      showGrabber: false,
      snapshot: this.snapshot,
      chineseConversionMode: this.chineseConversionMode,
      pageTurnStyle: this.pageTurnStyle,
      pageTurnSimulationAvailable: this.pageTurnSimulationAvailable,
      onCollapse: (): void => this.onCollapse(),
      onThemeChange: (theme: ReaderAppearanceTheme): void => this.onThemeChange(theme),
      onSetDayTheme: (theme: ReaderAppearanceTheme): void => this.onSetDayTheme(theme),
      onSetNightTheme: (theme: ReaderAppearanceTheme): void => this.onSetNightTheme(theme),
      onFontChange: (font: ReaderAppearanceFont): void => this.onFontChange(font),
      onFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]): void =>
        this.onFontOrderChange(fontOrder),
      onFontReorderActivityChange: (active: boolean): void =>
        this.onFontReorderActivityChange(active),
      onCustomFontImport: (): void => this.onCustomFontImport(),
      onIndentRequest: (indent: ReaderAppearanceIndent): void => this.onIndentRequest(indent),
      onAlignmentRequest: (current: ReaderAppearanceAlignment): void =>
        this.onAlignmentRequest(current),
      onMetricStep: (metric: ReaderAppearanceMetric, direction: ReaderAppearanceStepDirection): void =>
        this.onMetricStep(metric, direction),
      onChineseConversionChange: (mode: ReaderChineseConversionMode): void =>
        this.onChineseConversionChange(mode),
      onPageTurnStyleChange: (style: ReaderPageTurnStyle): void =>
        this.onPageTurnStyleChange(style),
    });
  }


  @Builder
  private brightnessLayer() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.brightnessContent();
    }
    .width(READER_APPEARANCE_MOTION_BRIGHTNESS_WIDTH)
    .height(READER_APPEARANCE_MOTION_BRIGHTNESS_HEIGHT)
    .position({
      x: READER_APPEARANCE_MOTION_BRIGHTNESS_X,
      y: this.stageTravel() + 28,
    })
    .translate({
      x: this.renderFrame.brightnessRail.translateX,
      y: this.renderFrame.brightnessRail.translateY,
    })
    .opacity(this.renderFrame.brightnessRail.opacity)
    .blur(this.renderFrame.brightnessRail.blurVp)
    .enabled(this.quickInteractionEnabled())
    .hitTestBehavior(this.quickInteractionEnabled() ? HitTestMode.Default : HitTestMode.None)
    .zIndex(3);
  }

  @Builder
  private moduleNavLayer() {
    Stack({ alignContent: Alignment.Bottom }) {
      this.moduleNavContent();
    }
    .width(this.stageWidth())
    .height(this.stageHeight())
    .translate({
      x: this.renderFrame.moduleNav.translateX,
      y: this.renderFrame.moduleNav.translateY,
    })
    .opacity(this.renderFrame.moduleNav.opacity)
    .blur(this.renderFrame.moduleNav.blurVp)
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
    .enabled(this.visible && this.interactionEnabled && this.directManipulationAvailable())
    .hitTestBehavior(this.visible && this.interactionEnabled && this.directManipulationAvailable() ?
      HitTestMode.Block : HitTestMode.None)
    .accessibilityText(this.grabberAccessibilityText())
    .accessibilityTextHint('点击切换展开状态，上下拖动可连续调整')
    .onAreaChange((_oldValue: Area, newValue: Area): void => {
      this.measuredGrabberScreenY = Number(newValue.globalPosition.y) +
        READER_APPEARANCE_MOTION_GRABBER_TOP + READER_APPEARANCE_MOTION_GRABBER_HEIGHT / 2;
    })
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
    const grabberScreenY = this.currentGrabberScreenY();
    this.motionState = beginReaderAppearanceTracking(
      this.motionState,
      pointer.windowY,
      grabberScreenY,
      this.measuredAxis(grabberScreenY),
      eventTimeMs,
    );
    this.activePointerId = pointer.id;
    this.pointerDownTimeMs = eventTimeMs;
    this.pointerStartWindowY = pointer.windowY;
    this.pointerLastWindowY = pointer.windowY;
    this.pointerLastTimeMs = eventTimeMs;
    this.pointerVelocityY = 0;
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
    this.motionState = updateReaderAppearanceTracking(
      this.motionState,
      pointer.windowY,
      eventTimeMs,
      this.pointerVelocityY,
    );
    this.pointerLastWindowY = pointer.windowY;
    this.pointerLastTimeMs = eventTimeMs;
    if (Math.abs(deltaY) >= READER_APPEARANCE_MOTION_TAP_SLOP) {
      this.pointerDragging = true;
    }
    this.publishFrame();
  }

  private finishPointerInteraction(event: TouchEvent, pointer: TouchObject): void {
    const eventTimeMs = this.eventTimeMs(event);
    const deltaY = pointer.windowY - this.pointerStartWindowY;
    this.updatePointerVelocity(pointer.windowY, eventTimeMs);
    this.motionState = updateReaderAppearanceTracking(
      this.motionState,
      pointer.windowY,
      eventTimeMs,
      this.pointerVelocityY,
    );
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
    this.reportImmediateEndpointIfNeeded();
    this.scheduleNextFrame();
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
    this.renderFrame = sampleReaderAppearanceMotionState(this.motionState, this.stageHeight());
    this.masterProgress = this.renderFrame.masterProgress;
    this.onMasterProgressChange(this.renderFrame.masterProgress);
    this.publishMotionActivity(this.motionActive());
  }

  private contentInteractionEnabled(): boolean {
    return this.visible && this.interactionEnabled && !this.motionActive();
  }

  private quickInteractionEnabled(): boolean {
    return this.contentInteractionEnabled() && !this.expanded;
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
    if (endpoint === this.motionState.stableEndpoint &&
      (this.motionState.phase === 'idleQuick' || this.motionState.phase === 'idleFull')) {
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
      const endpoint: ReaderAppearanceMotionEndpoint = this.expanded ? 'full' : 'quick';
      this.motionState = createReaderAppearanceMotionState(
        endpoint,
        this.reduceMotion,
        this.effectiveTimeScale(),
      );
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
    this.publishFrame();
    this.lastReportedEndpoint = endpoint;
  }

  private onAvailableHeightChanged(): void {
    if (!this.mounted) {
      return;
    }
    // Layout changes resample geometry at the same p. They never choose a new
    // route endpoint or replace the persistent content tree. Re-anchor an
    // active pointer segment to the new measured axis so its next MOVE cannot
    // jump merely because the window changed size.
    this.publishFrame();
    this.refreshMeasuredAxisForLayout();
    this.resetFrameClock();
    this.scheduleNextFrame();
  }

  private onInteractionEnabledChanged(): void {
    if (!this.interactionEnabled) {
      this.cancelPointerInteraction();
    }
  }

  private onCollapseRequestRevisionChanged(): void {
    if (this.mounted) {
      this.requestCollapse();
    }
  }

  private programmaticTarget(): ReaderAppearanceMotionEndpoint {
    return this.motionState.stableEndpoint === 'quick' ? 'full' : 'quick';
  }

  private nearestEndpoint(): ReaderAppearanceMotionEndpoint {
    return this.motionState.masterProgress >= 0.5 ? 'full' : 'quick';
  }

  private motionActive(): boolean {
    return readerAppearanceMotionIsActive(this.motionState);
  }

  private shellTop(): number {
    return this.renderFrame.shellTranslateY;
  }

  private stageHeight(): number {
    if (!Number.isFinite(this.availableHeight) || this.availableHeight <= 0) {
      return READER_APPEARANCE_MOTION_STAGE_HEIGHT;
    }
    return Math.max(
      READER_APPEARANCE_MOTION_QUICK_HEIGHT,
      Math.min(READER_APPEARANCE_MOTION_STAGE_HEIGHT, this.availableHeight),
    );
  }

  private stageTravel(): number {
    return Math.max(0, this.stageHeight() - READER_APPEARANCE_MOTION_QUICK_HEIGHT);
  }

  private directManipulationAvailable(): boolean {
    return this.stageTravel() >= READER_APPEARANCE_MIN_INTERACTIVE_TRAVEL_VP;
  }

  private refreshMeasuredAxisForLayout(): void {
    if (!this.mounted || !Number.isFinite(this.stageScreenY) || !this.directManipulationAvailable()) {
      this.measuredGrabberScreenY = Number.NaN;
      return;
    }
    const grabberScreenY = this.stageScreenY + this.shellTop() +
      READER_APPEARANCE_MOTION_GRABBER_TOP + READER_APPEARANCE_MOTION_GRABBER_HEIGHT / 2;
    this.measuredGrabberScreenY = grabberScreenY;
    this.motionState = setReaderAppearanceMeasuredAxis(
      this.motionState,
      this.measuredAxis(grabberScreenY),
    );
  }

  private currentGrabberScreenY(): number {
    if (Number.isFinite(this.measuredGrabberScreenY)) {
      return this.measuredGrabberScreenY;
    }
    const stageY = Number.isFinite(this.stageScreenY) ? this.stageScreenY : 0;
    return stageY + this.shellTop() + READER_APPEARANCE_MOTION_GRABBER_TOP +
      READER_APPEARANCE_MOTION_GRABBER_HEIGHT / 2;
  }

  private measuredAxis(grabberScreenY: number): ReaderAppearanceMeasuredAxis {
    const progress = Math.max(0, Math.min(1, this.motionState.masterProgress));
    const travel = this.stageTravel();
    return {
      quickGrabberScreenY: grabberScreenY + progress * travel,
      fullGrabberScreenY: grabberScreenY - (1 - progress) * travel,
    };
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
