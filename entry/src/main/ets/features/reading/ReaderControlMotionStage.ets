import { FrameCallback } from '@kit.ArkUI';
import {
  advanceReaderControlSession, copyReaderControlSessionState, createReaderControlSessionState,
  readerControlContentLocation, readerControlSessionStateEquals,
  sampleReaderControlSession, toggleReaderControlSession,
  type ReaderControlSessionState,
} from './ReaderControlSessionState';
import {
  beginReaderControlGesture, cancelReaderControlGesture, createReaderControlGestureState,
  endReaderControlGesture, rebaseReaderControlGesture, updateReaderControlGesture,
  readerControlGestureToggleDuration,
  type ReaderControlGestureConfig, type ReaderControlGestureResult, type ReaderControlGestureState,
} from './ReaderControlGestureDriver';
import {
  readerControlMotionAxis, readerControlMotionBounds, sampleReaderControlMotionComposition,
  readerControlHasFullContentSurface, sampleReaderControlWholeVisibility,
  type ReaderControlMotionFrame, type ReaderControlMotionBounds,
} from './ReaderControlMotionGeometry';
import {
  advanceReaderControlLayoutCompensation, createReaderControlLayoutCompensation,
  pauseReaderControlLayoutCompensation, rebaseReaderControlLayout,
  settleReaderControlLayoutCompensation, type ReaderControlLayoutCompensation,
} from './ReaderControlLayoutRebase';
import { TOK_BORDER_W, TOK_LINE, TOK_LINE_STRONG, TOK_READ_HANDLE, TOK_READ_SURFACE, TOK_SURFACE_PANEL,
  TOK_SURFACE_SOLID }
  from '../common/ReaderTokens';
import type { ReaderControlBackdropRect } from './ReaderControlBackdropTouch';

class ReaderControlStageFrameCallback extends FrameCallback {
  private callback: (time: number) => void;
  constructor(callback: (time: number) => void) { super(); this.callback = callback; }
  onFrame(time: number): void { this.callback(time); }
  onIdle(_remaining: number): void {}
}

interface ReaderControlTopBarFrame {
  translateY: number;
  opacity: number;
}

/**
 * One ArkUI input/clock adapter. The host supplies sparse
 * semantic snapshots and receives only endpoint commits; VSync samples stay
 * inside this control subtree so the native reading surface is not rebuilt.
 *
 * This component is staged for representative-module integration/verification;
 * its presence alone does not claim that the existing reader routes use it.
 */
@Component
export struct ReaderControlMotionStage {
  /**
   * Sparse semantic input from the host.  The Stage never writes this prop;
   * direct frame/gesture samples stay in the local visual clock below and are
   * handed back only through `onSessionCommit` at a stable endpoint.
   */
  @Prop @Watch('onSemanticSessionChanged') semanticSession: ReaderControlSessionState =
    createReaderControlSessionState();
  // Width/height are part of the same measured motion axis as quickHeight and
  // bottomGap.  A rotation/window reflow can deliver these props before the
  // root Area callback; watching them keeps the local axis compensation from
  // rendering one frame with the previous endpoint geometry.
  @Prop @Watch('onAxisInputsChanged') availableWidth: number = 364;
  @Prop @Watch('onAxisInputsChanged') fullHeight: number = 736;
  @Prop @Watch('onAxisInputsChanged') quickHeight: number = 330;
  @Prop @Watch('onAxisInputsChanged') bottomGap: number = 19;
  /** Full-screen host geometry; the dock dimensions above remain local. */
  @Prop @Watch('onAxisInputsChanged') viewportWidth: number = 364;
  @Prop @Watch('onAxisInputsChanged') viewportHeight: number = 736;
  @Prop @Watch('onAxisInputsChanged') dockLeft: number = 0;
  @Prop @Watch('onAxisInputsChanged') dockTop: number = 0;
  @Prop @Watch('onAxisInputsChanged') topBarWidth: number = 0;
  @Prop @Watch('onAxisInputsChanged') topBarTop: number = 0;
  @Prop @Watch('onInputEnabledChanged') inputEnabled: boolean = true;
  @Prop temporaryLayerActive: boolean = false;
  // Persistent title actors own their own opacity and may overflow the header
  // slot into the Quick viewport. Added-only headers retain the common p fade.
  @Prop persistentHeader: boolean = false;
  // Caller supplies audited timings and platform recognition tuning. Zero is
  // an explicit immediate-settlement fallback, not a fabricated design value.
  @Prop settleDurationMs: number = 0;
  @Prop showDurationMs: number = -1;
  @Prop dismissDurationMs: number = -1;
  @Prop tapMaxDurationMs: number = 0;
  @Prop directionSlopVp: number = 0;
  // Read-only debug telemetry. No query, book text or business data is logged;
  // it observes this same production driver and never injects/sets progress.
  @Prop traceMotion: boolean = false;
  onDockGeometryChange: (rect: ReaderControlBackdropRect, ready: boolean) => void =
    (_rect: ReaderControlBackdropRect, _ready: boolean): void => {};
  onTopBarGeometryChange: (rect: ReaderControlBackdropRect, ready: boolean) => void =
    (_rect: ReaderControlBackdropRect, _ready: boolean): void => {};
  onDismiss: () => void = (): void => {};
  /** Plain callback for host decisions while a local transition is running. */
  onVisualSessionChange: (state: ReaderControlSessionState) => void =
    (_state: ReaderControlSessionState): void => {};
  /** Semantic hand-off only after a direct gesture/clock reaches an endpoint. */
  onSessionCommit: (state: ReaderControlSessionState) => void =
    (_state: ReaderControlSessionState): void => {};
  clockCurve: (fraction: number) => number = (fraction: number): number => fraction;
  @BuilderParam moduleContent: () => void;
  /** Top bar shares this Stage's visual visibility clock. */
  @BuilderParam topBarContent: () => void;
  // Static title and explicit session commands only (e.g. Collapse). Unlike
  // business slots, these commands may take over an automatic transition.
  @BuilderParam fullHeaderContent: () => void;
  @BuilderParam brightnessContent: () => void;
  @BuilderParam navigationContent: () => void;

  private mounted: boolean = false;
  private lifecycleRevision: number = 0;
  private pendingFrame: boolean = false;
  private lastFrameTime: number = -1;
  private frameEpoch: number = -1;
  private stageScreenY: number = 0;
  private stageScreenX: number = 0;
  private axisMeasured: boolean = false;
  private traceSequence: number = 0;
  private lastTraceAt: number = -1;
  // Sampling the same motion frame dozens of times from one ArkUI build used
  // to allocate a fresh actor graph for every property binding. On a device
  // that allocation coincided with native List/Scroll layout and could leave
  // a compositor buffer empty for a frame. Keep one immutable sample per
  // VSync/layout key; this changes no geometry or timing, it only removes
  // duplicate allocations inside the same build pass.
  private cachedFrameKey: string = '';
  private cachedFrameValue: ReaderControlMotionFrame | undefined = undefined;
  // A hidden dismiss endpoint is committed one presentation frame after the
  // dock opacity reaches zero. This keeps the previous List/TextInput tree
  // alive for the compositor's terminal frame instead of changing route/data
  // ownership in the same render pass as the final fade.
  private pendingHiddenEndpoint: ReaderControlSessionState | undefined = undefined;
  private hiddenEndpointPublicationScheduled: boolean = false;
  // Endpoint commits are semantic hand-offs, not frame notifications. Keep
  // the last hand-off key so a zero-duration UP/duplicate UP cannot assign a
  // fresh object to the Panel/Host a second time and trigger a needless tree
  // rebuild on the same display frame.
  private lastCommittedEpoch: number = -1;
  private lastCommittedCloseRevision: number = -1;
  private lastCommittedLocationKey: string = '';
  // Keep the last content actor identity through the semantic hidden
  // endpoint.  `readerControlContentLocation()` intentionally falls back to
  // the reducer's default directory after dismiss commits; rebuilding a
  // directory surface in that one invisible frame can still allocate a large
  // List while the dock is fading out on a physical compositor.
  private lastVisibleContentModule: string = 'directory';
  /**
   * VSync-owned presentation snapshot.  This is deliberately local to the
   * Stage: assigning it invalidates only this animation subtree, never the
   * Panel/reading host that owns the semantic route.
   */
  @State private visualSession: ReaderControlSessionState = createReaderControlSessionState();
  // Last semantic snapshot consumed by this instance.  If ArkUI briefly
  // tears down/re-attaches the Stage during an in-flight transition, retaining
  // a visual snapshot that still corresponds to this semantic input avoids an
  // endpoint snap on reappearance. A genuinely newer semantic command wins.
  private lastSemanticSession: ReaderControlSessionState = createReaderControlSessionState();
  @State private measuredBounds: ReaderControlMotionBounds = readerControlMotionBounds(364, 736, 19);
  @State private layoutCompensation: ReaderControlLayoutCompensation = createReaderControlLayoutCompensation();
  private pointerState: ReaderControlGestureState = createReaderControlGestureState({
    axis: { quickGrabberScreenY: 415, fullGrabberScreenY: 9, hiddenGrabberScreenY: 433 },
    tapMaxDurationMs: 0, directionSlopVp: 0, settleDurationMs: 0,
  });

  private setVisualSession(next: ReaderControlSessionState, commitEndpoint: boolean = false): void {
    // A queued layout/input callback can arrive after teardown has started.
    // Never write local state or publish a semantic endpoint from that stale
    // lifecycle window.
    if (!this.mounted) return;
    const previous = this.visualSession;
    const deferHiddenPublication = next.transition === undefined && next.location.level === 'hidden' &&
      previous.transition !== undefined && previous.transition.kind === 'dismiss';
    this.visualSession = copyReaderControlSessionState(next);
    this.rememberVisibleContentModule();
    if (!deferHiddenPublication) this.onVisualSessionChange(copyReaderControlSessionState(next));
    if (deferHiddenPublication) {
      this.scheduleHiddenEndpointPublication(next);
      return;
    }
    if (next.transition !== undefined) return;

    // `finishedTouch` is only a release hint. A long hold on an already stable
    // pose also reports a finished touch, but it must not write a fresh
    // semantic object to the host. A real endpoint hand-off is evidenced by a
    // transition ending, a location change (including Quick/Full), or a close
    // revision change; a held-pointer/epoch change alone is not material.
    const locationChanged = previous.location.level !== next.location.level ||
      previous.location.module !== next.location.module ||
      previous.location.directoryTab !== next.location.directoryTab ||
      previous.location.form !== next.location.form;
    const materialEndpointChange = previous.transition !== undefined || locationChanged ||
      previous.closeRevision !== next.closeRevision;
    const endpointRequested = commitEndpoint || previous.transition !== undefined ||
      locationChanged || previous.closeRevision !== next.closeRevision;
    if (!materialEndpointChange || !endpointRequested) return;
    const location = next.location;
    const locationKey = `${location.level}:${location.module}:${location.directoryTab}:${location.form}`;
    if (this.lastCommittedEpoch === next.epoch &&
      this.lastCommittedCloseRevision === next.closeRevision &&
      this.lastCommittedLocationKey === locationKey) return;
    this.lastCommittedEpoch = next.epoch;
    this.lastCommittedCloseRevision = next.closeRevision;
    this.lastCommittedLocationKey = locationKey;
    this.onSessionCommit(copyReaderControlSessionState(next));
  }

  aboutToAppear(): void {
    this.mounted = true;
    this.pendingFrame = false;
    this.lastFrameTime = -1;
    this.frameEpoch = -1;
    this.axisMeasured = false;
    const semantic = copyReaderControlSessionState(this.semanticSession);
    const semanticAdvanced = !readerControlSessionStateEquals(semantic, this.lastSemanticSession);
    if (semanticAdvanced || readerControlSessionStateEquals(this.visualSession, this.lastSemanticSession)) {
      this.visualSession = copyReaderControlSessionState(semantic);
    }
    this.lastSemanticSession = semantic;
    this.rememberVisibleContentModule();
    this.measuredBounds = readerControlMotionBounds(this.availableWidth,
      this.fullHeight, this.bottomGap, this.quickHeight);
    this.lifecycleRevision += 1;
    if (this.visualSession.transition === undefined) {
      this.lastCommittedEpoch = this.visualSession.epoch;
      this.lastCommittedCloseRevision = this.visualSession.closeRevision;
      const location = this.visualSession.location;
      this.lastCommittedLocationKey = `${location.level}:${location.module}:${location.directoryTab}:${location.form}`;
    } else {
      this.lastCommittedEpoch = -1;
      this.lastCommittedCloseRevision = -1;
      this.lastCommittedLocationKey = '';
    }
    this.scheduleFrame();
  }

  /** Consume a sparse host command without sharing its mutable object. */
  private onSemanticSessionChanged(): void {
    const semantic = copyReaderControlSessionState(this.semanticSession);
    if (!this.mounted) return;
    // ArkUI may re-deliver the same semantic object while a local transition
    // is progressing (for example when another prop causes a parent render).
    // Treat that as a no-op; only a genuinely new semantic value may replace
    // the visual clock. This is the guard that prevents progress resets and
    // visible flash on repeated parent builds.
    if (readerControlSessionStateEquals(semantic, this.lastSemanticSession)) return;
    this.lastSemanticSession = semantic;
    if (readerControlSessionStateEquals(this.visualSession, semantic)) return;
    this.visualSession = copyReaderControlSessionState(semantic);
    this.rememberVisibleContentModule();
    this.lastFrameTime = -1;
    this.frameEpoch = -1;
    this.layoutCompensation = settleReaderControlLayoutCompensation(
      this.layoutCompensation, this.visualSession, this.settleDurationMs);
    this.discardRevokedPointer();
    this.reportDockGeometry();
    this.scheduleFrame();
    this.traceFrame('semantic');
  }

  aboutToDisappear(): void {
    // ArkUI forbids state writes from aboutToDisappear.
    // Do not resolve the pointer through the reducer here: the Panel owns the
    // semantic snapshot, and this stage-local pointer can simply be dropped
    // as the subtree is torn down.
    this.mounted = false;
    this.lifecycleRevision += 1;
    this.pendingFrame = false;
    this.pendingHiddenEndpoint = undefined;
    this.hiddenEndpointPublicationScheduled = false;
    this.pointerState = createReaderControlGestureState(this.gestureConfig());
    this.reportDockGeometry();
  }

  private bounds(): ReaderControlMotionBounds {
    return this.measuredBounds;
  }

  /** Global screen origin of the dock-local motion axis. */
  private axisScreenTop(): number {
    const rootY = Number.isFinite(this.stageScreenY) ? this.stageScreenY : 0;
    return rootY + (Number.isFinite(this.dockTop) ? this.dockTop : 0);
  }

  private viewportWidthValue(): number {
    return Number.isFinite(this.viewportWidth) && this.viewportWidth > 0 ?
      this.viewportWidth : this.bounds().width;
  }

  private viewportHeightValue(): number {
    return Number.isFinite(this.viewportHeight) && this.viewportHeight > 0 ?
      this.viewportHeight : this.bounds().fullHeight;
  }

  private dockLeftValue(): number {
    return Number.isFinite(this.dockLeft) ? this.dockLeft : 0;
  }

  private dockTopValue(): number {
    return Number.isFinite(this.dockTop) ? this.dockTop : 0;
  }

  private topBarWidthValue(): number {
    return Number.isFinite(this.topBarWidth) && this.topBarWidth > 0 ?
      this.topBarWidth : this.viewportWidthValue();
  }

  private topBarTopValue(): number {
    return Number.isFinite(this.topBarTop) && this.topBarTop >= 0 ? this.topBarTop : 0;
  }

  private topBarFrame(): ReaderControlTopBarFrame {
    return sampleReaderControlWholeVisibility(
      sampleReaderControlSession(this.visualSession).visibilityProgress).topBar;
  }

  private gestureConfig(): ReaderControlGestureConfig {
    return {
      axis: readerControlMotionAxis(this.bounds(), this.axisScreenTop()),
      tapMaxDurationMs: this.tapMaxDurationMs, directionSlopVp: this.directionSlopVp,
      settleDurationMs: this.settleDurationMs, showDurationMs: this.showDurationMs,
      dismissDurationMs: this.dismissDurationMs,
    };
  }

  private frame(): ReaderControlMotionFrame {
    const pose = sampleReaderControlSession(this.visualSession);
    const bounds = this.bounds();
    const compensation = this.layoutCompensation;
    const key = `${pose.expansionProgress}|${pose.visibilityProgress}|${bounds.width}|${bounds.fullHeight}|${bounds.quickHeight}|${bounds.bottomGap}|${compensation.revision}|${compensation.offsetY}`;
    if (this.cachedFrameValue !== undefined && this.cachedFrameKey === key) return this.cachedFrameValue;
    const frame = sampleReaderControlMotionComposition(pose, bounds);
    // Resize compensation applies to every actor AND the hit region; never
    // move just the handle while the rest of the composition jumps underneath.
    const offset = compensation.offsetY;
    frame.shell.y += offset;
    frame.grabber.y += offset;
    frame.header.y += offset;
    frame.contentSurface.y += offset;
    frame.content.y += offset;
    frame.brightness.y += offset;
    frame.navigation.y += offset;
    this.cachedFrameKey = key;
    this.cachedFrameValue = frame;
    return frame;
  }

  private scheduleHiddenEndpointPublication(state: ReaderControlSessionState): void {
    this.pendingHiddenEndpoint = copyReaderControlSessionState(state);
    if (this.hiddenEndpointPublicationScheduled) return;
    this.hiddenEndpointPublicationScheduled = true;
    const lifecycle = this.lifecycleRevision;
    const epoch = state.epoch;
    this.getUIContext().postFrameCallback(new ReaderControlStageFrameCallback((_time: number): void => {
      this.hiddenEndpointPublicationScheduled = false;
      const pending = this.pendingHiddenEndpoint;
      this.pendingHiddenEndpoint = undefined;
      if (!this.mounted || lifecycle !== this.lifecycleRevision || pending === undefined ||
        pending.epoch !== epoch || this.visualSession.epoch !== epoch) return;
      this.onVisualSessionChange(copyReaderControlSessionState(pending));
      const location = pending.location;
      const locationKey = `${location.level}:${location.module}:${location.directoryTab}:${location.form}`;
      if (this.lastCommittedEpoch === pending.epoch &&
        this.lastCommittedCloseRevision === pending.closeRevision &&
        this.lastCommittedLocationKey === locationKey) return;
      this.lastCommittedEpoch = pending.epoch;
      this.lastCommittedCloseRevision = pending.closeRevision;
      this.lastCommittedLocationKey = locationKey;
      this.onSessionCommit(copyReaderControlSessionState(pending));
    }));
  }

  private rememberVisibleContentModule(): void {
    const location = readerControlContentLocation(this.visualSession);
    if (location.level !== 'hidden') this.lastVisibleContentModule = location.module;
  }

  private contentModule(): string {
    const location = readerControlContentLocation(this.visualSession);
    return location.level === 'hidden' ? this.lastVisibleContentModule : location.module;
  }

  private traceFrame(source: string, event: TouchEvent | undefined = undefined): void {
    if (!this.traceMotion || !this.mounted) return;
    const now = Date.now();
    // Keep routine clock observations bounded; raw touch terminals are never
    // dropped by this limiter. Captures must still be checked against pixels.
    if (event === undefined && now - this.lastTraceAt < 40) return;
    this.lastTraceAt = now;
    const pose = sampleReaderControlSession(this.visualSession);
    const location = readerControlContentLocation(this.visualSession);
    const frame = this.frame();
    const changedIds: number[] = [];
    const changedY: number[] = [];
    if (event !== undefined) {
      for (let i = 0; i < event.changedTouches.length; i += 1) {
        changedIds.push(event.changedTouches[i].id);
        changedY.push(event.changedTouches[i].windowY);
      }
    }
    console.info(`ReaderControlMotionProbe ${JSON.stringify({ version: 1,
      sequence: this.traceSequence++, wallMs: now, source: source,
      eventType: event === undefined ? -1 : event.type,
      eventTime: event === undefined ? -1 : event.timestamp,
      changedIds: changedIds, changedY: changedY,
      epoch: this.visualSession.epoch, closeRevision: this.visualSession.closeRevision,
      level: location.level, module: location.module, tab: location.directoryTab,
      form: location.form, kind: this.visualSession.transition?.kind ?? 'stable',
      held: this.visualSession.heldPointerId, pointer: this.pointerState.pointerId,
      pointerY: this.pointerState.lastPointerScreenY, direction: this.pointerState.recentDirection,
      p: pose.expansionProgress, v: pose.visibilityProgress,
      screenX: this.stageScreenX, screenY: this.stageScreenY,
      shell: frame.shell, grabber: frame.grabber, brightness: frame.brightness,
      navigation: frame.navigation, dock: frame.dock })}`);
  }

  private reportDockGeometry(): void {
    const frame = this.frame();
    this.onDockGeometryChange({ x: this.stageScreenX + this.dockLeftValue(),
      y: this.axisScreenTop() + frame.shell.y + frame.dock.translateY,
      width: frame.shell.width, height: frame.shell.height }, this.axisMeasured && this.mounted);
  }

  /** Full endpoint mount box used behind the live content viewport. */
  private fullContentMountWidth(): number {
    const bounds = this.bounds();
    const inset = Math.min(13, bounds.width / 4);
    return Math.max(0, bounds.width - inset * 2);
  }

  private fullContentMountHeight(): number {
    return Math.max(0, this.bounds().fullHeight - 70);
  }

  private discardRevokedPointer(): void {
    if (this.pointerState.pointerId < 0 || (this.pointerState.sessionEpoch === this.visualSession.epoch &&
      this.visualSession.heldPointerId === this.pointerState.pointerId)) return;
    this.pointerState = createReaderControlGestureState(this.gestureConfig());
  }

  private onInputEnabledChanged(): void {
    // Revoke posted callbacks, and resume with a fresh timestamp baseline.
    // Background wall time must not be counted as foreground animation time.
    this.lifecycleRevision += 1;
    this.pendingFrame = false;
    this.lastFrameTime = -1;
    if (!this.inputEnabled) this.cancelTouch();
    else this.scheduleFrame();
  }

  private onAxisInputsChanged(): void {
    if (this.axisMeasured) this.admitLayout(this.stageScreenY);
  }

  private admitLayout(nextScreenY: number): void {
    // Area/layout notifications may be delivered after disappearance.  A
    // stale rebase would write measuredBounds/layoutCompensation while the
    // subtree is being torn down and could post another frame.
    if (!this.mounted) return;
    if (!Number.isFinite(nextScreenY) || !Number.isFinite(this.availableWidth) ||
      !Number.isFinite(this.fullHeight) || this.availableWidth <= 0 || this.fullHeight <= 0 ||
      !Number.isFinite(this.quickHeight) || this.quickHeight <= 0 ||
      !Number.isFinite(this.bottomGap) || this.bottomGap < 0) return;
    const nextBounds = readerControlMotionBounds(this.availableWidth,
      this.fullHeight, this.bottomGap, this.quickHeight);
    const nextAxis = readerControlMotionAxis(nextBounds, nextScreenY + this.dockTopValue());
    if (!this.axisMeasured) {
      this.axisMeasured = true;
      this.measuredBounds = nextBounds;
      this.stageScreenY = nextScreenY;
      this.pointerState = rebaseReaderControlGesture(this.pointerState, nextAxis,
        this.pointerState.lastPointerScreenY);
      this.reportDockGeometry();
      return;
    }
    const result = rebaseReaderControlLayout(this.visualSession, this.pointerState,
      this.layoutCompensation, nextAxis);
    if (!result.accepted) return;
    this.measuredBounds = nextBounds;
    this.stageScreenY = nextScreenY;
    // Width-only and repeated layout notifications must not restart time.
    if (result.reason === 'unchanged') { this.reportDockGeometry(); return; }
    this.pointerState = result.gesture;
    this.layoutCompensation = result.compensation;
    this.lastFrameTime = -1;
    this.setVisualSession(result.session);
    this.reportDockGeometry();
    this.scheduleFrame();
  }

  private acceptTouch(result: ReaderControlGestureResult): void {
    // Native touch delivery can race teardown.  The gesture result is stale
    // once the stage is unmounted, so avoid both @State writes and a semantic
    // endpoint callback in that lifecycle window.
    if (!this.mounted) return;
    this.pointerState = result.gesture;
    if (result.session.heldPointerId >= 0) {
      this.layoutCompensation = pauseReaderControlLayoutCompensation(this.layoutCompensation);
    } else if (result.finishedTouch) {
      this.layoutCompensation = settleReaderControlLayoutCompensation(
        this.layoutCompensation, result.session, this.settleDurationMs);
    }
    this.setVisualSession(result.session, result.finishedTouch);
    this.scheduleFrame();
  }

  private cancelTouch(): void {
    if (!this.mounted) return;
    if (this.pointerState.pointerId < 0) return;
    this.acceptTouch(cancelReaderControlGesture(this.visualSession, this.pointerState, this.pointerState.pointerId));
  }

  private scheduleFrame(): void {
    if (!this.mounted || !this.inputEnabled || this.pendingFrame ||
      (this.visualSession.transition === undefined && !this.layoutCompensation.running) ||
      this.visualSession.heldPointerId >= 0) return;
    const epoch = this.visualSession.epoch;
    const lifecycle = this.lifecycleRevision;
    const layoutRevision = this.layoutCompensation.revision;
    this.pendingFrame = true;
    this.getUIContext().postFrameCallback(new ReaderControlStageFrameCallback((time: number): void => {
      if (lifecycle !== this.lifecycleRevision) return;
      this.pendingFrame = false;
      if (!this.mounted || !this.inputEnabled) return;
      if (epoch !== this.visualSession.epoch || layoutRevision !== this.layoutCompensation.revision) {
        // The queued callback belongs to an older visual/layout revision. It
        // no longer owns the pending slot, so clear it before handing control
        // to the current revision; otherwise scheduleFrame() is a no-op.
        this.pendingFrame = false;
        this.scheduleFrame(); return;
      }
      const delta = this.frameEpoch === epoch && this.lastFrameTime >= 0 ?
        Math.max(0, (time - this.lastFrameTime) / 1000000) : 0;
      this.frameEpoch = epoch;
      this.lastFrameTime = time;
      this.layoutCompensation = advanceReaderControlLayoutCompensation(this.layoutCompensation,
        this.visualSession, delta, layoutRevision, this.clockCurve);
      const previous = this.visualSession;
      const next = advanceReaderControlSession(this.visualSession, delta, epoch, this.clockCurve);
      this.setVisualSession(next, previous.transition !== undefined && next.transition === undefined);
      // Layout compensation can move without changing the session object, so
      // its measured input exclusion cannot rely on the semantic Watch.
      this.reportDockGeometry();
      this.traceFrame('frame');
      this.scheduleFrame();
    }));
  }

  private eventTime(event: TouchEvent): number {
    return Number.isFinite(event.timestamp) && event.timestamp >= 0 ?
      event.timestamp / 1000000 : Date.now();
  }

  private touch(event: TouchEvent): void {
    if (!this.mounted) return;
    this.discardRevokedPointer();
    if (!this.inputEnabled) { this.cancelTouch(); return; }
    if (event.type === TouchType.Cancel) {
      // Once the grabber owns a pointer, cancellation belongs to this gesture
      // surface; do not let an ancestor recognizer observe the same
      // cancellation. With no owner, preserve normal background propagation.
      if (this.pointerState.pointerId >= 0) event.stopPropagation();
      this.cancelTouch(); return;
    }
    if (event.type === TouchType.Down) {
      if (this.pointerState.pointerId >= 0) { event.stopPropagation(); return; }
      const pointer = event.changedTouches.length > 0 ? event.changedTouches[0] : event.touches[0];
      if (pointer === undefined) return;
      this.pointerState = createReaderControlGestureState(this.gestureConfig());
      this.acceptTouch(beginReaderControlGesture(this.visualSession, this.pointerState,
        pointer.id, pointer.windowY, this.eventTime(event)));
      // Stack has no preventable default action. Calling preventDefault here
      // throws ArkUI 100017 on the device; Block + propagation control own input.
      event.stopPropagation();
      return;
    }
    const pointers = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    for (let i = 0; i < pointers.length; i += 1) {
      const pointer = pointers[i];
      if (pointer.id !== this.pointerState.pointerId) continue;
      event.stopPropagation();
      if (event.type === TouchType.Move) {
        this.acceptTouch(updateReaderControlGesture(this.visualSession, this.pointerState,
          pointer.id, pointer.windowY, this.eventTime(event)));
      } else if (event.type === TouchType.Up) {
        // Some devices deliver a final displacement only with UP. Admit that
        // real sample once, but do not synthesize a zero-distance MOVE which
        // would erase the short fling's measured velocity.
        if (pointer.windowY !== this.pointerState.lastPointerScreenY) {
          this.acceptTouch(updateReaderControlGesture(this.visualSession, this.pointerState,
            pointer.id, pointer.windowY, this.eventTime(event)));
        }
        this.acceptTouch(endReaderControlGesture(this.visualSession, this.pointerState,
          pointer.id, this.eventTime(event)));
      }
      return;
    }
    // A secondary pointer's delta set may not contain our owner. While the
    // primary pointer is held, consume that event at the grabber so it cannot
    // bubble to an ancestor recognizer; no-owner events remain untouched.
    if (this.pointerState.pointerId >= 0) event.stopPropagation();
  }

  private toggleFromAccessibility(): void {
    if (!this.accessibilityToggleEnabled()) return;
    this.setVisualSession(toggleReaderControlSession(this.visualSession,
      readerControlGestureToggleDuration(this.visualSession, this.gestureConfig())));
  }

  private accessibilityToggleEnabled(): boolean {
    return this.inputEnabled && !this.temporaryLayerActive && this.mounted &&
      readerControlContentLocation(this.visualSession).level === 'secondary' &&
      this.visualSession.transition === undefined;
  }

  private accessibilityToggleLabel(): string {
    const location = readerControlContentLocation(this.visualSession);
    if (location.level !== 'secondary') return '';
    return location.form === 'quick' ? '展开完整控制栏' : '收回快捷控制栏';
  }

  private closeFromAccessibility(): void {
    if (!this.inputEnabled || !this.mounted ||
      readerControlContentLocation(this.visualSession).level === 'hidden') return;
    this.onDismiss();
  }

  @Builder
  private accessibleControlActions() {
    if (readerControlContentLocation(this.visualSession).level !== 'hidden') {
      Text('关闭控制栏并返回阅读').width(1).height(1)
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .accessibilityLevel(this.inputEnabled && this.mounted ? 'yes' : 'no')
        .enabled(this.inputEnabled && this.mounted)
        .onClick((): void => this.closeFromAccessibility());
      if (this.accessibilityToggleLabel().length > 0) {
        Text(this.accessibilityToggleLabel()).width(1).height(1)
          .accessibilityRole(AccessibilityRoleType.BUTTON)
          .accessibilityLevel(this.accessibilityToggleEnabled() ? 'yes' : 'no')
          .enabled(this.accessibilityToggleEnabled())
          .onClick((): void => this.toggleFromAccessibility());
      }
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      // The title bar is a sibling of the dock but lives in this same Stage,
      // so it samples the local visual clock on every frame instead of relying
      // on a reactive Panel mirror. Keeping both actors in one full-screen
      // normal compositor tree also avoids a second opacity/cache seam.
      Stack({ alignContent: Alignment.Top }) { this.topBarContent(); }
        .width(this.topBarWidthValue()).height(54)
        .position({ x: (this.viewportWidthValue() - this.topBarWidthValue()) / 2,
          y: this.topBarTopValue() })
        .translate({ y: this.topBarFrame().translateY }).opacity(this.topBarFrame().opacity)
        .enabled(this.inputEnabled && this.topBarFrame().opacity > 0)
        .hitTestBehavior(this.topBarFrame().opacity > 0 ? HitTestMode.Transparent : HitTestMode.None)
        .onAreaChange((_previous: Area, current: Area): void => {
          this.onTopBarGeometryChange({ x: Number(current.globalPosition.x),
            y: Number(current.globalPosition.y), width: Number(current.width),
            height: Number(current.height) }, this.mounted);
        });
      // Keep the dock actor tree mounted for hidden endpoints as well.  The
      // parent visibility axis drives one opacity/translation; removing this
      // subtree in the same commit that clears the native reading surface can
      // expose a compositor hole on physical devices.  Child content remains
      // inert while the parent is at v=0.
      // MR1 fades the already-composited dock once. Child opacities below
      // describe only expansion; multiplying visibility per sibling changes
      // the appearance of overlapping content and translucent surfaces.
      Stack({ alignContent: Alignment.TopStart }) {
        Stack()
          .id('reader-control-verification-shell')
          .width(this.frame().shell.width).height(this.frame().shell.height)
          .position({ x: 0, y: this.frame().shell.y })
          .backgroundColor(TOK_READ_SURFACE).borderRadius(24)
          .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
          .opacity(this.frame().shell.opacity)
          .hitTestBehavior(this.frame().visibility > 0 ? HitTestMode.Block : HitTestMode.None);
        // Keep the independent Full-content surface mounted for the entire
        // visual session.  The previous route guard removed/re-added this
        // Stack on a frame where the dock was also changing opacity/clip;
        // ArkUI could then expose an uninitialised compositor buffer as a
        // black flash.  Visibility is a paint/accessibility gate only, so the
        // node identity and native surface survive every VSync sample.
        Stack()
          .id('reader-control-verification-content-surface')
          .width(this.frame().contentSurface.width).height(this.frame().contentSurface.height)
          .position({ x: this.frame().contentSurface.x, y: this.frame().contentSurface.y })
          .backgroundColor(TOK_SURFACE_PANEL).borderRadius(12)
          .border({ width: TOK_BORDER_W, color: TOK_LINE })
          // Keep the compositor node visible for every route. Toggling
          // Visibility at the same VSync as a morph asks ArkUI/RenderService
          // to detach and reattach the layer; on hardware that can expose an
          // uninitialised buffer for one or more frames. Routes without the
          // authored FullContentSurface still get an alpha-zero paint gate,
          // so this does not add a visible surface to Search/Auto/Replace.
          .opacity(readerControlHasFullContentSurface(this.contentModule()) ?
            this.frame().contentSurface.opacity : 0)
          .visibility(Visibility.Visible)
          .enabled(false).hitTestBehavior(HitTestMode.None);
        // The changing content actor is a lightweight viewport only. Its
        // child mount box stays at the Full endpoint, so native List/Scroll/
        // TextInput descendants do not receive a new layout constraint for
        // every p sample. The viewport's position, size and clip still follow
        // the exact shared Figma trajectory.
        Stack({ alignContent: Alignment.TopStart }) {
          Stack({ alignContent: Alignment.TopStart }) { this.moduleContent(); }
            .width(this.fullContentMountWidth()).height(this.fullContentMountHeight())
            .position({ x: 0, y: 0 }).clip(true);
        }
          .width(this.frame().content.width).height(this.frame().content.height)
          .position({ x: this.frame().content.x, y: this.frame().content.y })
          .clip(true).opacity(this.frame().content.opacity)
          .enabled(this.inputEnabled && this.frame().visibility > 0 &&
            this.visualSession.transition === undefined && this.visualSession.heldPointerId < 0)
          .hitTestBehavior(this.frame().visibility > 0 ? HitTestMode.Default : HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) { this.fullHeaderContent(); }
          .width(this.frame().header.width).height(this.frame().header.height)
          .position({ x: this.frame().header.x, y: this.frame().header.y })
          .opacity(this.persistentHeader ? 1 : this.frame().header.opacity)
          .zIndex(this.persistentHeader ? 1 : 0)
          .hitTestBehavior(HitTestMode.Transparent)
          .enabled(this.inputEnabled && this.frame().visibility > 0 && this.visualSession.heldPointerId < 0);
        Stack({ alignContent: Alignment.TopStart }) { this.brightnessContent(); }
          .width(this.frame().brightness.width).height(this.frame().brightness.height)
          .position({ x: this.frame().brightness.x, y: this.frame().brightness.y })
          .opacity(this.frame().brightness.opacity)
          .enabled(this.inputEnabled && this.frame().visibility > 0 &&
            this.visualSession.transition === undefined && this.visualSession.heldPointerId < 0)
          .hitTestBehavior(this.frame().brightness.opacity > 0 ? HitTestMode.Default : HitTestMode.None);
        Stack({ alignContent: Alignment.TopStart }) { this.navigationContent(); }
          .width(this.frame().navigation.width).height(this.frame().navigation.height)
          .position({ x: this.frame().navigation.x, y: this.frame().navigation.y })
          .opacity(this.frame().navigation.opacity)
          .enabled(this.inputEnabled && this.frame().visibility > 0 &&
            this.visualSession.transition === undefined && this.visualSession.heldPointerId < 0)
          .hitTestBehavior(this.frame().navigation.opacity > 0 ? HitTestMode.Default : HitTestMode.None);
        Stack({ alignContent: Alignment.Top }) {
          Row().width(42).height(4).borderRadius(2).backgroundColor(TOK_READ_HANDLE)
            .margin({ top: 9 }).opacity(this.frame().grabber.opacity);
        }
        .width(72).height(28)
        .id('reader-control-verification-grabber')
        .position({ x: (this.bounds().width - 72) / 2, y: this.frame().shell.y })
        .hitTestBehavior(HitTestMode.Block)
        .accessibilityText(readerControlContentLocation(this.visualSession).level === 'home' ?
          '控制栏拖动区域，向下关闭' : '控制栏展开或收起，向下关闭')
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        // The visible grabber is a touch surface, not a standalone semantic
        // action. Virtual children below expose explicit Close/Expand actions
        // so screen readers never invoke a missing parent click handler.
        .accessibilityLevel('no')
        .accessibilityVirtualNode(this.accessibleControlActions)
        .onTouch((event: TouchEvent): void => {
          this.touch(event);
          this.traceFrame('touch', event);
        });
        }
        .width(this.bounds().width).height(this.bounds().fullHeight)
        .translate({ y: this.frame().dock.translateY })
        .opacity(this.frame().dock.opacity)
        .position({ x: this.dockLeftValue(), y: this.dockTopValue() })
        // Do not force an off-screen render target here. The dock contains
        // dynamic Scroll/TextInput/Image subtrees and its bounds, translation
        // and opacity change on every animation frame. ArkUI documents that
        // renderGroup may vary the drawing result when opacity is not 1 and
        // is intended for stable child content; on device this combination can
        // expose an uninitialised (black) buffer. A normal parent opacity still
        // applies to the complete subtree without introducing that cache seam.
        .enabled(this.inputEnabled && this.frame().visibility > 0)
          .hitTestBehavior(this.inputEnabled && this.frame().visibility > 0 ?
          HitTestMode.Transparent : HitTestMode.None);
    }
    .width(this.viewportWidthValue())
    .height(this.viewportHeightValue())
    .accessibilityLevel(this.frame().visibility > 0 ? 'auto' : 'no-hide-descendants')
    .hitTestBehavior(HitTestMode.Transparent)
    .onAreaChange((_previous: Area, current: Area): void => {
      this.stageScreenX = Number(current.globalPosition.x);
      this.admitLayout(Number(current.globalPosition.y));
    });
  }
}
