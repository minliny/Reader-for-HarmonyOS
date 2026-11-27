import type { UIContext } from '@ohos.arkui.UIContext';
import type { ReaderControlTemporaryInputKind } from './ReaderControlSessionState';
import { ReaderEditingVisibility } from '../../../ui/layout/ReaderEditingVisibility';
import { readerKeyboardViewport } from '../../../ui/layout/ReaderKeyboardGeometry';
import { readerWindowMetrics } from '../../../ui/foundation/ReaderWindowEnvironment';
import { ReaderRectVp, readerVisualSafeBottom, readerVisualSafeRight, readerVisualSafeTop } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerControlKeyboardVisible } from '../../../ui/foundation/ReaderKeyboardBack';
import { readerControlIslandHeight, type ReaderControlContentBudget } from './ReaderLayoutGeometry';
import { readerTtsWaveformSnapshot } from './ReaderTtsWaveform';
import type { ReaderTtsWaveformSample } from './ReaderTtsWaveformModel';
import { readerMotionReducedFadeParam } from '../../../ui/foundation/ReaderMotionPolicy';
import { readerControlIsDirectSheet } from './ReaderControlHostSession';
import type { ReaderSessionCapsuleType } from './ReaderSessionCapsuleModel';
import { ReaderControlMotionFrameCache } from './ReaderControlMotionGeometry';
import { readerControlPlaybackProfileMatches, readerControlPlaybackSourceKindMatches, type ReaderControlPlaybackProfileReceipt } from './ReaderControlPlaybackProfile';
import { FrameCallback } from '@kit.ArkUI';
import { readerControlMotionMs, sampleReaderControlMorphProgress } from './ReaderControlMotionPolicy';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { ReaderControlVerificationMotion, type ReaderControlVerificationLayoutInputs } from './ReaderControlVerificationMotion';
import type { ReaderControlVerificationOrigin, ReaderControlVerificationRequest } from './ReaderControlVerificationSession';
import { READER_CONTROL_OPEN_MS, READER_CONTROL_EXPAND_MS, READER_CONTROL_DISMISS_MS } from '../../../ui/foundation/ProductMotionTiming';
import { ReaderControlRuntime, type ReaderControlRuntimeUpdate } from './ReaderControlRuntime';
import { ReaderPageInputClock } from './ReaderPageInputClock';
import hilog from '@ohos.hilog';
import type { ReaderControlGestureConfig } from './ReaderControlGestureDriver';
import { ReaderControlAutoPageContent } from './ReaderControlAutoPageContent';
import { ReaderControlTtsContent } from './ReaderControlTtsContent';
import { ReaderSessionMorphSourceMeasurement, readerSessionMorphActorId, type ReaderSessionMorphSourceKind } from './ReaderSessionMorphState';
import { ReaderControlGeometry } from './ReaderControlGeometry';
import { ReaderControlLayoutSnapshot } from './ReaderLayoutGeometry';
import { ReaderControlPlacement, readerControlAlignment, readerControlDockLeft, type ReaderControlAlignment } from './ReaderControlPlacement';
import { subscribeReaderHoldingHand } from '../../../platform/interaction/HarmonyReaderGrip';
import type { ReaderHoldingHand } from '../../../platform/interaction/ReaderHoldingHand';
import curves from '@ohos.curves';
import { DEBUG } from '../../../../../../build/default/generated/profile/default/BuildProfile';
import type { ReaderControlPage } from './ReaderControlRouting';
import type { ReaderControlBackdropRect } from './ReaderControlBackdropTouch';
import { copyReaderControlSessionState, createReaderControlSessionState, readerControlContentLocation, readerControlTargetLocation, readerControlSessionStateEquals, sampleReaderControlSession, collapseReaderControlSession, toggleReaderControlSession,
  setReaderControlDirectoryTab, expandReaderControlSession, type ReaderControlLocation, type ReaderControlSessionState } from './ReaderControlSessionState';
import { readerControlMotionAxis, readerControlMotionBounds, sampleReaderControlMotionComposition, type ReaderControlMotionFrame, type ReaderControlMotionBounds } from './ReaderControlMotionGeometry';
import { type ReaderControlPanelFacts, type ReaderControlIntentHandler } from './ReaderControlPanelNativeContract';

export interface ReaderControlMotionEnvironment {
  readonly editingOffset: () => number;
  readonly setEditingOffset: (offset: number) => void;
  readonly alignmentPreference: () => string;
  readonly foreground: () => boolean;
}

export interface ReaderControlMotionMinimum {
  readonly layout: () => ReaderControlLayoutSnapshot;
  readonly currentIdentity: () => string;
  readonly committedIdentity: () => string;
  readonly presentationAvailable: () => boolean;
  readonly inputReady: () => boolean;
  readonly availabilityChanged: () => void;
  readonly publishPlaybackProfile: () => void;
  readonly registerFonts: () => void;
  readonly warmFonts: () => void;
  readonly retireDirectSheetReceipt: () => void;
  readonly retire: () => void;
}

export interface ReaderControlMotionQuickHome {
  readonly holdsPlacement: () => boolean;
  readonly syncProgress: () => void;
  readonly invalidateProgress: () => void;
  readonly cancelBrightness: () => void;
  readonly retirePress: () => void;
  readonly admitInitialBookmark: () => void;
  readonly canStepChapter: (direction: number) => boolean;
}

export interface ReaderControlMotionTopBar {
  readonly menuVisible: () => boolean;
  readonly dismiss: () => void;
  readonly rectangle: () => ReaderControlBackdropRect;
  readonly retireTrace: () => void;
}

export interface ReaderControlPanelRuntimeEnvironment {
  readonly facts: () => ReaderControlPanelFacts;
  readonly paint: () => ReaderControlPanelMotionPaint;
  readonly context: () => UIContext;
  readonly linkedSession: () => ReaderControlSessionState;
  readonly publishSession: (session: ReaderControlSessionState) => void;
  readonly intent: ReaderControlIntentHandler;
  readonly hasIntent: () => boolean;
  readonly environment: ReaderControlMotionEnvironment;
  readonly minimum: ReaderControlMotionMinimum;
  readonly quickHome: ReaderControlMotionQuickHome;
  readonly topBar: ReaderControlMotionTopBar;
}

@Observed
export class ReaderControlPanelMotionPaint {
  @Track dockAlignment: ReaderControlAlignment = 'center';
  @Track visualExpansionProgress: number = 0;
  @Track visualVisibilityProgress: number = 0;
  @Track controlActorsRetained: boolean = false;
  @Track visualHeldPointerId: number = -1;
  @Track visualTransitionKind: string = '';
  @Track motionOffsetY: number = 0;
  @Track contentMotionProgress: number = 0;
  @Track contentMotionWidth: number = 286;
  @Track contentMotionHeight: number = 190;
  @Track moduleMotionX: number = 0;
  @Track moduleMotionY: number = 0;
  @Track moduleMotionOpacity: number = 1;
  @Track visualDirectSheet: boolean = false;
  @Track directSheetClosing: boolean = false;
  @Track lastVisibleContentLocation: ReaderControlLocation = {
    level: 'home', module: 'directory', directoryTab: 'directory', form: 'quick',
  };
}

class ReaderControlFrameCallback extends FrameCallback {
  private callback: (time: number) => void;
  constructor(callback: (time: number) => void) { super(); this.callback = callback; }
  onFrame(time: number): void { this.callback(time); }
  onIdle(_remaining: number): void {}
}

/** A single native timeline owns control geometry, pointer tickets, retained
 * content, IME reveal and the capsule's same-frame handoff witness. */
export class ReaderControlPanelRuntimeHost {
  readonly host: ReaderControlPanelRuntimeEnvironment;
  private readonly launchCapture: ReaderControlCapturedLaunchSource = new ReaderControlCapturedLaunchSource();
  private readonly placement: ReaderControlPlacement = new ReaderControlPlacement();
  private readonly placementPointers: Set<number> = new Set();
  private gripRequested: boolean = false;
  private holdingHand: ReaderHoldingHand = undefined;
  private unbindHoldingHand: (() => void) | undefined = undefined;
  private placementTimer: number = -1;
  private readonly editingHost: ReaderEditingVisibility = new ReaderEditingVisibility();
  private launchSourceVisibleGeneration: number = 0;
  private launchSourceVisibleKind: ReaderSessionMorphSourceKind | undefined = undefined;
  private launchSourceReadyGeneration: number = 0;
  private capturedLaunchGeneration: number = 0;
  private launchMotionBounds: ReaderControlMotionBounds | undefined = undefined;
  private launchFrameCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();
  private sessionMorphMeasurementRevision: number = 0;
  private visualSession: ReaderControlSessionState = createReaderControlSessionState();
  private runtime: ReaderControlRuntime | undefined = undefined;
  private inputClock: ReaderPageInputClock = new ReaderPageInputClock();
  private inputMoveCount: number = 0;
  private inputResetCount: number = 0;
  private inputDownTime: number = 0;
  private inputLastMoveTime: number = 0;
  private diagnosticControlMoveLogged: boolean = false;
  private diagnosticTemporaryEvents: number = 0;
  private temporaryInputScope: string = '';
  private temporaryInputKind: ReaderControlTemporaryInputKind = '';
  private endInlineEditing: (() => void | Promise<void>) | undefined = undefined;
  private runtimeMounted: boolean = false;
  private previousTopBarVisibility: boolean = true;
  private verificationMotion: ReaderControlVerificationMotion | undefined = undefined;
  private verificationPointerFramePending: boolean = false;
  private verificationPointerStartY: number | undefined = undefined;
  private verificationLayerGeneration: number = 0;
  private pendingRuntimeFrame: boolean = false;
  private pendingRuntimeTicket: number = -1;
  private runtimeLifecycle: number = 0;
  private rootScreenX: number = 0;
  private rootScreenY: number = 0;
  private directBudgetSource: ReaderControlContentBudget | undefined = undefined;
  private directBudget: ReaderControlContentBudget | undefined = undefined;
  private directBudgetAvailable: number = 0;
  private modulePaintKey: string = '';
  private appearanceFontReorderActive: boolean = false;
  private geo: ReaderControlGeometry = new ReaderControlGeometry(false);
  private dockRect: ReaderControlBackdropRect = { x: 0, y: 0, width: 0, height: 0, borderRadius: 24 };
  private dockMeasured: boolean = false;
  private readonly backdropRegions: ReaderControlBackdropRect[] = [
    this.dockRect,
    { x: 0, y: 0, width: 0, height: 0, borderRadius: 24 },
  ];
  private readonly expandCurve = curves.cubicBezierCurve(0, 0, 0.58, 1);
  private readonly collapseCurve = curves.cubicBezierCurve(0.42, 0, 1, 1);
  private readonly controlMotionCurve = curves.cubicBezierCurve(0.2, 0, 0, 1);
  private motionFrameCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();
  private quickEndpointCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();
  private fullEndpointCache: ReaderControlMotionFrameCache = new ReaderControlMotionFrameCache();
  private quickGeometryMode: boolean | undefined = undefined;
  private quickGeometry: ReaderControlGeometry | undefined = undefined;
  private navigationIntentPending: boolean = false;

  constructor(host: ReaderControlPanelRuntimeEnvironment) { this.host = host; }

  mount(): void {
    this.mountEditingHost();
    this.runtimeMounted = true;
    this.host.quickHome.admitInitialBookmark();
    this.temporaryInputScope = this.host.facts().geometry.temporary.layer !== '' ? this.currentTemporaryInputScope() : '';
    this.temporaryInputKind = this.host.facts().geometry.temporary.layer;
    this.runtimeLifecycle += 1;
    this.runtime = new ReaderControlRuntime(this.runtimeConfig(), readerMotionNowMs);
    this.acceptRuntime(this.runtime.start(this.host.linkedSession()));
    this.onRuntimeEnabledChanged();
    this.host.minimum.registerFonts();
    this.geo = new ReaderControlGeometry(this.isExpanded());
    this.host.minimum.warmFonts();
  }

  unmount(): void {
    this.host.quickHome.retirePress();
    this.verificationMotion?.finish('unmounted');
    this.verificationPointerFramePending = false;
    this.host.topBar.retireTrace();
    this.editingHost.unmount();
    this.host.topBar.dismiss();
    this.runtimeMounted = false;
    this.retireDockPlacement();
    this.runtimeLifecycle += 1;
    this.host.minimum.retire();
    this.launchCapture.minimum = undefined;
    this.launchMotionBounds = undefined;
    this.host.quickHome.syncProgress();
    this.pendingRuntimeFrame = false;
    this.host.quickHome.cancelBrightness();
    this.runtime?.stop();
    this.host.intent({ kind: 'backdropRegionsChange', regions: [], ready: false });
    this.host.intent({ kind: 'temporaryLayerChange', active: false });
    this.setAppearanceFontReorderActivity(false);
  }

  mounted(): boolean { return this.runtimeMounted; }
  mountGeneration(): number { return this.runtimeLifecycle; }
  inputTicket(): number { return this.runtime?.ticket() ?? -1; }
  inputOwner(): number { return this.runtime?.owner() ?? -1; }
  nativeGeometry(): ReaderControlGeometry { return this.geo; }
  editingVisibility(): ReaderEditingVisibility { return this.editingHost; }
  visualState(): ReaderControlSessionState { return this.visualSession; }
  windowX(): number { return this.rootScreenX; }
  windowY(): number { return this.rootScreenY; }

  panelAreaChanged(area: Area): void {
    this.rootScreenX = Number(area.globalPosition.x);
    this.rootScreenY = Number(area.globalPosition.y);
    this.dockMeasured = true;
    this.onLayoutChanged();
  }

  retireTemporaryInput(): void {
    this.temporaryInputKind = '';
    this.endInlineEditing = undefined;
    this.temporaryInputScope = '';
  }

  admitVisibleLocation(location: ReaderControlLocation): void { this.host.paint().lastVisibleContentLocation = location; }

  launchSource(): Readonly<ReaderControlCapturedLaunchSource> { return this.launchCapture; }

  requestDirectoryTab(tab: string): void {
    if (DEBUG) hilog.info(0xD004, 'ReaderControlDiagnostic',
      'stage=panel-directory-tab tab=%{public}d ready=%{public}s owner=%{public}d',
      tab === 'bookmarks' ? 1 : 0, String(this.host.minimum.inputReady()), this.inputOwner());
    this.host.intent({ kind: 'inputActivity' });
    this.applySemanticSession(setReaderControlDirectoryTab(this.host.linkedSession(),
      tab === 'bookmarks' ? 'bookmarks' : 'directory'), 'directory-tab');
  }

  expandReplace(): void {
    if (this.host.facts().geometry.temporary.layer !== '') return;
    this.host.intent({ kind: 'inputActivity' });
    this.applySemanticSession(expandReaderControlSession(this.host.linkedSession(),
      readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.host.facts().geometry.reduceMotion)), 'replace-expand');
  }

  activateAccessibleGrabber(): void {
    if (!this.controlActionInputEnabled() || !this.contentInputEnabled()) return;
    this.host.intent({ kind: 'inputActivity' });
    this.applySemanticSession(toggleReaderControlSession(this.visualSession,
      readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.host.facts().geometry.reduceMotion)), 'grabber-accessibility');
  }

  onEditingWindowChanged(): void {
    if (!readerControlKeyboardVisible(readerWindowMetrics())) this.host.environment.setEditingOffset(0);
    this.editingHost.refresh();
  }

  onEditingOffsetChanged(): void {
    if (this.runtimeMounted) this.configureRuntime();
    this.editingHost.refresh();
  }

  presentedDockTop(): number { return this.dockTop() + this.host.environment.editingOffset(); }

  contentEditingHeight(): number {
    const frame = this.frame();
    const host = new ReaderRectVp(this.rootScreenX + this.dockLeft() + frame.content.x,
      this.rootScreenY + this.presentedDockTop() + frame.dock.translateY + frame.content.y,
      frame.content.width, frame.content.height);
    return readerKeyboardViewport(readerWindowMetrics(), host).rect.height;
  }

  private editingRevealRegion(task: ReaderRectVp): ReaderRectVp {
    const frame = this.frame();
    const shell = new ReaderRectVp(this.rootScreenX + this.dockLeft() + frame.shell.x,
      this.rootScreenY + this.presentedDockTop() + frame.dock.translateY + frame.shell.y,
      frame.shell.width, frame.shell.height);
    const viewport = readerKeyboardViewport(readerWindowMetrics(), new ReaderRectVp(this.rootScreenX, this.rootScreenY,
      this.host.minimum.layout().viewportWidth, this.host.minimum.layout().viewportHeight), shell);
    // Compact surfaces that fit above the IME move as one complete surface.
    // A tall Full surface cannot fit there: preserve its task region and let
    // the module allocate input/results/actions inside its visible viewport.
    return viewport.known && viewport.occluded && shell.height <= viewport.rect.height &&
      task.top >= shell.top - .5 && task.top + task.height <= shell.top + shell.height + .5 ? shell : task;
  }

  private mountEditingHost(): void {
    this.editingHost.mount({ current: (): boolean => this.runtimeMounted && this.host.facts().geometry.inputEnabled && !this.host.facts().geometry.obscured &&
        this.frame().visibility > 0,
      metrics: readerWindowMetrics,
      viewport: (): ReaderRectVp => new ReaderRectVp(this.rootScreenX, this.rootScreenY,
        this.host.minimum.layout().viewportWidth, this.host.minimum.layout().viewportHeight),
      scroll: (_delta: number): void => {},
      revealRegion: (task: ReaderRectVp): ReaderRectVp => this.editingRevealRegion(task),
      translate: (delta: number): void => {
        const frame = this.frame();
        const limit = Math.max(0, this.rootScreenY + this.dockTop() + frame.shell.y -
          readerKeyboardViewport(readerWindowMetrics(), new ReaderRectVp(this.rootScreenX, this.rootScreenY,
            this.host.minimum.layout().viewportWidth, this.host.minimum.layout().viewportHeight)).rect.top);
        this.host.environment.setEditingOffset(Math.min(0, Math.max(-limit, this.host.environment.editingOffset() - delta)));
        this.reportBackdropRegions();
      } });
  }

  private runtimeConfig(): ReaderControlGestureConfig {
    return { axis: readerControlMotionAxis(readerControlMotionBounds(this.host.minimum.layout().fullPanelWidth,
      this.controlPanelHeight(), this.host.minimum.layout().dockBottomGap, this.controlQuickHeight(), this.host.minimum.layout().contentBudget),
      this.rootScreenY + this.presentedDockTop()), tapMaxDurationMs: 500, directionSlopVp: 8,
      settleDurationMs: readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.host.facts().geometry.reduceMotion),
      showDurationMs: readerControlMotionMs(READER_CONTROL_OPEN_MS, this.host.facts().geometry.reduceMotion),
      dismissDurationMs: readerControlMotionMs(READER_CONTROL_DISMISS_MS, this.host.facts().geometry.reduceMotion), coordinatedMotion: true };
  }

  private configureRuntime(): void {
    const runtime = this.runtime;
    if (runtime === undefined) return;
    const verification = this.runtimeMounted ? this.host.facts().geometry.verification : undefined;
    const request = verification?.current(this.visualSession);
    const observe = request !== undefined && request.direction === this.visualSession.transition?.kind;
    const update = runtime.configure(this.runtimeConfig(), observe);
    if (update.layoutRebase !== undefined) verification?.observeLayoutRebase(update.session, update.layoutRebase);
    this.acceptRuntime(update);
  }

  private acceptRuntime(update: ReaderControlRuntimeUpdate): void {
    if (!this.runtimeMounted) return;
    const observed = this.host.facts().geometry.verification?.current(this.visualSession);
    if (this.visualSession.epoch !== update.session.epoch) {
      if (observed !== undefined) this.verificationMotion?.finish('interrupted', observed.transitionId);
      else this.verificationMotion?.finish('interrupted');
    }
    this.rememberVisibleContentLocation(update.session);
    const sessionChanged = !readerControlSessionStateEquals(this.visualSession, update.session);
    if (sessionChanged) {
      this.visualSession = update.session;
    }
    const visual = sampleReaderControlSession(update.session);
    const placementInputChanged = this.host.paint().visualHeldPointerId !== update.session.heldPointerId ||
      this.host.paint().visualTransitionKind !== (update.session.transition?.kind ?? '');
    // Keep only the lightweight command owner on reading entry. Once opened,
    // retain the actor tree through every close to preserve compositor/input
    // continuity. The first open command itself admits the tree at progress 0.
    if (visual.visibilityProgress > 0 || (update.session.transition?.to.visibilityProgress ?? 0) > 0 ||
      update.session.heldPointerId >= 0) this.host.paint().controlActorsRetained = true;
    if (this.host.topBar.menuVisible() && visual.visibilityProgress <= 0) this.host.topBar.dismiss();
    this.host.paint().visualExpansionProgress = visual.expansionProgress;
    this.host.paint().visualVisibilityProgress = visual.visibilityProgress;
    this.host.paint().visualHeldPointerId = update.session.heldPointerId;
    this.host.paint().visualTransitionKind = update.session.transition?.kind ?? '';
    this.updateModuleMotion(update.session);
    this.host.paint().motionOffsetY = update.offsetY;
    this.host.quickHome.syncProgress();
    if (placementInputChanged) this.refreshDockPlacement();
    if (sessionChanged) this.host.intent({ kind: 'visualSessionChange', state: update.session });
    if (update.endpoint !== undefined) this.commitVisualSession(update.endpoint);
    const f = this.frame();
    if (this.host.paint().contentMotionProgress !== f.progress) this.host.paint().contentMotionProgress = f.progress;
    if (this.host.paint().contentMotionWidth !== f.content.width) this.host.paint().contentMotionWidth = f.content.width;
    if (this.host.paint().contentMotionHeight !== f.content.height) this.host.paint().contentMotionHeight = f.content.height;
    this.dockRect.x = this.rootScreenX + this.dockLeft();
    this.dockRect.y = this.rootScreenY + this.presentedDockTop() + f.shell.y + f.dock.translateY;
    this.dockRect.width = f.shell.width;
    this.dockRect.height = f.shell.height;
    this.reportBackdropRegions();
    this.confirmLaunchSourceReady();
    this.scheduleRuntimeFrame();
  }

  private updateModuleMotion(session: ReaderControlSessionState): void {
    const location = readerControlContentLocation(session);
    const active = `${location.level}:${location.module}`;
    const transition = session.transition;
    const target = readerControlTargetLocation(session);
    const fromDirect = transition?.fromLocation.level === 'secondary' && readerControlIsDirectSheet(transition.fromLocation.module);
    const toDirect = target.level === 'secondary' && readerControlIsDirectSheet(target.module);
    this.host.paint().visualDirectSheet = toDirect || fromDirect;
    this.host.paint().directSheetClosing = this.host.facts().geometry.directSheet && fromDirect && target.level === 'home';
    if (this.host.facts().geometry.directSheet && !this.host.paint().visualDirectSheet) this.host.minimum.retireDirectSheetReceipt();
    const previous = this.modulePaintKey;
    this.modulePaintKey = active;
    if (this.host.facts().geometry.reduceMotion) {
      this.host.paint().moduleMotionX = 0;
      this.host.paint().moduleMotionY = 0;
      if (fromDirect || toDirect) { this.host.paint().moduleMotionOpacity = 1; return; }
      if (previous.length > 0 && previous !== active && location.level !== 'hidden' && !previous.startsWith('hidden:')) {
        this.host.paint().moduleMotionOpacity = 0;
        this.host.context().animateTo(readerMotionReducedFadeParam(), (): void => { this.host.paint().moduleMotionOpacity = 1; });
      }
      return;
    }
    if (transition === undefined || transition.fromLocation.level === 'hidden' || target.level === 'hidden') {
      this.host.paint().moduleMotionX = 0;
      this.host.paint().moduleMotionY = 0;
      this.host.paint().moduleMotionOpacity = 1;
      return;
    }
    const remainder = Math.max(0, 1 - transition.progress);
    const from = transition.fromLocation;
    const slides = from.level === 'secondary' && target.level === 'secondary' &&
      !fromDirect && !toDirect && from.module !== target.module;
    const fromIndex = this.moduleIndex(from.module);
    const toIndex = this.moduleIndex(target.module);
    this.host.paint().moduleMotionX = slides ? (toIndex < fromIndex ? -1 : 1) * this.host.minimum.layout().fullPanelWidth * remainder : 0;
    const lift = from.level !== target.level && !fromDirect && !toDirect;
    this.host.paint().moduleMotionY = lift ? (target.level === 'home' ? -14 : 14) * remainder : 0;
    this.host.paint().moduleMotionOpacity = lift ? 1 - remainder * .24 : 1;
  }

  private moduleIndex(module: string): number {
    if (module === 'autoPage') return 0;
    if (module === 'tts') return 1;
    return module === 'appearance' ? 2 : 3;
  }

  private scheduleRuntimeFrame(): void {
    const runtime = this.runtime;
    if (!this.runtimeMounted || runtime === undefined || !runtime.needsFrame()) return;
    const ticket = runtime.ticket();
    if (this.pendingRuntimeFrame && this.pendingRuntimeTicket === ticket) return;
    const lifecycle = this.runtimeLifecycle;
    this.pendingRuntimeFrame = true;
    this.pendingRuntimeTicket = ticket;
    this.host.context().postFrameCallback(new ReaderControlFrameCallback((frameTimeNs: number): void => {
      if (!this.runtimeMounted || lifecycle !== this.runtimeLifecycle || this.pendingRuntimeTicket !== ticket) return;
      this.pendingRuntimeFrame = false;
      const runtimeTickMs = readerMotionNowMs();
      const update = runtime.frame(runtimeTickMs, ticket, (p: number): number => this.clockSample(p));
      if (update !== undefined) {
        const previous = this.visualSession;
        const verification = this.host.facts().geometry.verification;
        const request = verification?.current(previous);
        // Use the component snapshot preceding this frame's publication. No
        // probe value is fed back to runtime or used to advance its clock.
        if (request !== undefined && previous.transition?.kind === request.direction) {
          this.recordVerificationFrame(request, previous, frameTimeNs, runtimeTickMs, ticket, false);
        }
        if (previous.epoch !== update.session.epoch && update.session.transition !== undefined) {
          verification?.accept('runtime-resume', previous, update.session, this.host.facts().geometry.openRevision);
        }
        this.acceptRuntime(update);
        if (request !== undefined && previous.transition?.kind === request.direction && this.verificationMotion !== undefined) {
          verification?.observeVisual(update.session, this.host.paint().visualVisibilityProgress);
          if (update.endpoint !== undefined) {
            const endpoint = update.endpoint;
            const expectedLocation = request.target;
            const trace = this.verificationMotion;
            // Observe native nodes after the normal endpoint publication has
            // reached a following frame. This callback never advances runtime.
            this.host.context().postFrameCallback(new ReaderControlFrameCallback((endpointFrameNs: number): void => {
              if (!this.runtimeMounted || lifecycle !== this.runtimeLifecycle || runtime.ticket() !== ticket ||
                verification?.current(this.visualSession)?.transitionId !== request.transitionId ||
                this.visualSession.transition !== undefined || this.visualSession.location.level !== expectedLocation.level ||
                this.visualSession.location.module !== expectedLocation.module ||
                this.visualSession.location.form !== expectedLocation.form ||
                this.visualSession.location.directoryTab !== expectedLocation.directoryTab) {
                trace.finish('interrupted', request.transitionId);
                return;
              }
              this.recordVerificationFrame(request, endpoint, endpointFrameNs, runtimeTickMs, ticket, true);
              trace.finish('completed', request.transitionId);
            }));
          }
        }
      } else this.scheduleRuntimeFrame();
    }));
  }

  private recordVerificationFrame(request: ReaderControlVerificationRequest, state: ReaderControlSessionState,
    frameTimeNs: number, runtimeTickMs: number, ticket: number, endpoint: boolean): void {
    if (this.verificationMotion === undefined) this.verificationMotion = new ReaderControlVerificationMotion();
    const layout = this.host.minimum.layout();
    const layoutInputs: ReaderControlVerificationLayoutInputs = {
      dockLeftVp: this.dockLeft(), dockTopVp: this.presentedDockTop(), widthVp: layout.fullPanelWidth,
      fullHeightVp: this.controlPanelHeight(), quickHeightVp: this.controlQuickHeight(),
      quickContentHeightVp: this.contentEndpointHeight(false), fullContentHeightVp: this.contentEndpointHeight(true),
      fullContentTopVp: layout.contentBudget === undefined ? 57 : 19 + layout.contentBudget.headerHeightVp + 8,
    };
    this.verificationMotion.sample(request, this.host.context(), state, this.contentLocation(),
      frameTimeNs, runtimeTickMs, ticket, this.host.paint().motionOffsetY, endpoint, layoutInputs,
      this.runtime?.verificationContinuationSlope(),
      state.heldPointerId >= 0 ? this.runtime?.lastPointerY() : undefined,
      state.heldPointerId >= 0 ? this.verificationPointerStartY : undefined,
      this.host.minimum.presentationAvailable());
  }

  private acceptVerificationGesture(update: ReaderControlRuntimeUpdate, origin: ReaderControlVerificationOrigin): void {
    const previous = this.visualSession;
    const verification = this.host.facts().geometry.verification;
    if (origin === 'grabber-down' && update.session.heldPointerId >= 0) this.verificationPointerStartY = this.runtime?.lastPointerY();
    verification?.accept(origin, previous, update.session, this.host.facts().geometry.openRevision, update.releaseMotion, update.cancelMotion);
    this.acceptRuntime(update);
    const request = verification?.current(update.session);
    if (request === undefined || update.session.heldPointerId < 0 || this.verificationPointerFramePending) return;
    const lifecycle = this.runtimeLifecycle;
    this.verificationPointerFramePending = true;
    this.host.context().postFrameCallback(new ReaderControlFrameCallback((frameTimeNs: number): void => {
      this.verificationPointerFramePending = false;
      const state = this.visualSession;
      const ticket = this.runtime?.ticket();
      if (!this.runtimeMounted || lifecycle !== this.runtimeLifecycle || ticket === undefined ||
        verification?.current(state)?.transitionId !== request.transitionId || state.heldPointerId < 0) return;
      this.recordVerificationFrame(request, state, frameTimeNs, readerMotionNowMs(), ticket, false);
    }));
  }

  onLayoutChanged(): void {
    this.refreshDockPlacement();
    this.geo = new ReaderControlGeometry(this.isExpanded());
    this.configureRuntime();
    if (this.previousTopBarVisibility !== this.host.minimum.layout().topBarVisible && this.host.topBar.menuVisible()) {
      this.host.topBar.dismiss();
    }
    this.previousTopBarVisibility = this.host.minimum.layout().topBarVisible;
    this.host.minimum.availabilityChanged();
    this.host.minimum.publishPlaybackProfile();
  }

  onRuntimeEnabledChanged(): void {
    if (this.host.topBar.menuVisible() && (!this.host.facts().geometry.inputEnabled || this.host.facts().geometry.obscured)) this.host.topBar.dismiss();
    if (this.runtime !== undefined) {
      this.acceptRuntime(this.runtime.setEnabled((this.host.facts().geometry.inputEnabled || this.host.facts().launch.recovering) && !this.host.facts().geometry.obscured));
    }
    this.host.quickHome.syncProgress();
    if (!this.host.facts().geometry.inputEnabled || this.host.facts().geometry.obscured) this.placementPointers.clear();
    this.refreshDockPlacement();
  }

  onTemporaryLayerActivityChanged(): void {
    this.temporaryInputScope = (this.host.facts().geometry.temporary.layer !== '') ? this.currentTemporaryInputScope() : '';
    this.temporaryInputKind = this.host.facts().geometry.temporary.layer;
    if (DEBUG && this.diagnosticTemporaryEvents < 32) {
      this.diagnosticTemporaryEvents += 1;
      hilog.info(0xD004, 'ReaderControlDiagnostic',
        'stage=temporary-changed active=%{public}s ready=%{public}s input=%{public}s obscured=%{public}s',
        String((this.host.facts().geometry.temporary.layer !== '')), String(this.host.minimum.inputReady()),
        String(this.host.facts().geometry.inputEnabled), String(this.host.facts().geometry.obscured));
    }
    if ((this.host.facts().geometry.temporary.layer !== '')) this.host.quickHome.cancelBrightness();
    this.host.quickHome.syncProgress();
    this.refreshDockPlacement();
  }

  onControlSessionChanged(): void {
    if (this.runtime !== undefined) this.acceptRuntime(this.runtime.command(this.host.linkedSession()));
    if (readerControlContentLocation(this.host.linkedSession()).module !== 'appearance' ||
      readerControlContentLocation(this.host.linkedSession()).level !== 'secondary') {
      this.setAppearanceFontReorderActivity(false);
    }
  }

  private handleControlTouch(event: TouchEvent): void {
    if (this.host.facts().geometry.fixedIsland) return;
    const runtime = this.runtime;
    if (DEBUG) {
      if (event.type === TouchType.Down) this.diagnosticControlMoveLogged = false;
      if (event.type === TouchType.Down || event.type === TouchType.Up || event.type === TouchType.Cancel ||
        (event.type === TouchType.Move && !this.diagnosticControlMoveLogged)) {
        if (event.type === TouchType.Move) this.diagnosticControlMoveLogged = true;
        hilog.info(0xD004, 'ReaderControlDiagnostic',
          'stage=control-touch type=%{public}d ready=%{public}s owner=%{public}d input=%{public}s obscured=%{public}s',
          event.type, String(this.host.minimum.inputReady()), runtime?.owner() ?? -1,
          String(this.host.facts().geometry.inputEnabled), String(this.host.facts().geometry.obscured));
      }
    }
    if (!this.runtimeMounted || runtime === undefined || !this.host.facts().geometry.inputEnabled || this.host.facts().geometry.obscured) return;
    if (event.type === TouchType.Cancel) {
      if (runtime.owner() >= 0) event.stopPropagation();
      this.acceptVerificationGesture(
        runtime.cancel(this.host.facts().geometry.verification?.observing() === true), 'grabber-cancel'); return;
    }
    const pointers = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    if (event.type === TouchType.Down) {
      // A successor measurement fences new gestures, not the original
      // pointer's Move/Up/Cancel while its accepted runtime rebases the axis.
      if ((this.host.intent({ kind: 'inputCurrent' }) as boolean | undefined) === false || !this.host.minimum.inputReady()) return;
      if (pointers.length > 0 && runtime.owner() < 0 && this.host.facts().geometry.temporary.layer === '') {
        this.host.intent({ kind: 'inputActivity' });
        this.inputClock = new ReaderPageInputClock();
        const time = this.inputClock.sample(event.timestamp, readerMotionNowMs());
        if (DEBUG) {
          this.inputMoveCount = 0;
          this.inputResetCount = 0;
          this.inputDownTime = event.timestamp;
          this.inputLastMoveTime = event.timestamp;
        }
        this.acceptVerificationGesture(runtime.down(pointers[0].id, pointers[0].windowY, time), 'grabber-down');
      }
      event.stopPropagation(); return;
    }
    for (const pointer of pointers) {
      if (pointer.id !== runtime.owner()) continue;
      event.stopPropagation();
      const time = this.inputClock.sample(event.timestamp, readerMotionNowMs());
      if (this.inputClock.resetVelocity) runtime.resetInputVelocity(pointer.id, time);
      if (DEBUG) {
        if (this.inputClock.resetVelocity) this.inputResetCount += 1;
        if (event.type === TouchType.Move) {
          this.inputMoveCount += 1;
          this.inputLastMoveTime = event.timestamp;
        }
        if (event.type === TouchType.Up) hilog.info(0xD004, 'ReaderControlInput',
          'UP id=%{public}d y=%{public}f lastY=%{public}f moves=%{public}d resets=%{public}d downNs=%{public}f moveNs=%{public}f upNs=%{public}f progress=%{public}f',
          pointer.id, pointer.windowY, runtime.lastPointerY(), this.inputMoveCount, this.inputResetCount,
          this.inputDownTime, this.inputLastMoveTime, event.timestamp, this.host.paint().visualExpansionProgress);
      }
      if (event.type === TouchType.Move) this.acceptVerificationGesture(runtime.move(pointer.id, pointer.windowY, time), 'grabber-move');
      if (event.type === TouchType.Up) this.acceptVerificationGesture(
        runtime.up(pointer.id, pointer.windowY, time, this.host.facts().geometry.verification?.observing() === true), 'grabber-release');
      return;
    }
    if (runtime.owner() >= 0) event.stopPropagation();
  }

  private isExpanded(): boolean { return this.host.minimum.layout().isExpanded(); }

  frame(): ReaderControlMotionFrame {
    const launch = this.host.facts().launch.sample;
    if (launch !== undefined && (this.host.facts().launch.ownsControls || this.host.facts().launch.recovering)) {
      const heldBounds = this.capturedLaunchGeneration === this.host.facts().launch.generation ? this.launchMotionBounds : undefined;
      const bounds = heldBounds ?? readerControlMotionBounds(this.host.minimum.layout().fullPanelWidth,
        this.controlPanelHeight(), this.host.minimum.layout().dockBottomGap, this.controlQuickHeight(), this.host.minimum.layout().contentBudget);
      const frame = this.launchFrameCache.sample(1, this.launchCapture.progress,
        bounds.width, bounds.fullHeight, bounds.bottomGap, bounds.quickHeight, 0, bounds.contentBudget,
        this.host.facts().geometry.fixedIsland ? 'module' : 'legacy', this.host.facts().geometry.reduceMotion);
      // Recovery shares the existing control Runtime clock. Rebase the actual
      // outgoing offsets rather than flashing at its unrelated hidden endpoint.
      const remainder = this.host.facts().launch.recovering ? 1 - this.host.paint().visualVisibilityProgress : 1;
      frame.topBar.translateY = this.host.facts().geometry.reduceMotion ? 0 : launch.topBarOffsetY * remainder;
      frame.dock.translateY = this.host.facts().geometry.reduceMotion ? 0 : launch.dockOffsetY * remainder;
      return frame;
    }
    if (this.host.facts().geometry.directSheet && this.host.paint().visualDirectSheet) {
      const layout = this.host.minimum.layout();
      const height = this.controlPanelHeight();
      return this.motionFrameCache.sample(this.host.paint().visualVisibilityProgress, 1, layout.fullPanelWidth, height,
        this.directSheetBottom(), this.controlQuickHeight(), 0, this.directSheetBudget(layout, height),
        'legacy', this.host.facts().geometry.reduceMotion);
    }
    return this.motionFrameCache.sample(this.host.paint().visualVisibilityProgress, this.host.paint().visualExpansionProgress,
      this.host.minimum.layout().fullPanelWidth, this.controlPanelHeight(), this.host.minimum.layout().dockBottomGap,
      this.controlQuickHeight(), this.host.paint().motionOffsetY, this.host.minimum.layout().contentBudget,
      this.host.facts().geometry.fixedIsland ? (this.contentLocation().level === 'secondary' ? 'module' : 'home') : 'legacy', this.host.facts().geometry.reduceMotion);
  }

  private directSheetBudget(layout: ReaderControlLayoutSnapshot, height: number): ReaderControlContentBudget | undefined {
    const source = layout.contentBudget;
    if (source === undefined) return undefined;
    const safeBottom = layout.isExpanded() ? 0 : readerVisualSafeBottom(readerWindowMetrics());
    const contentHeight = Math.max(0, source.fullContentHeightVp + height - layout.fullPanelHeight - safeBottom);
    if (this.directBudgetSource !== source || this.directBudgetAvailable !== contentHeight) {
      this.directBudgetSource = source;
      this.directBudgetAvailable = contentHeight;
      this.directBudget = {
        key: source.key,
        quickContentHeightVp: source.quickContentHeightVp,
        fullContentHeightVp: contentHeight,
        brightnessContentHeightVp: source.brightnessContentHeightVp,
        navigationHeightVp: source.navigationHeightVp,
        headerHeightVp: source.headerHeightVp,
        brightnessAutoHeightVp: source.brightnessAutoHeightVp,
        brightnessAutoWidthVp: source.brightnessAutoWidthVp,
      };
    }
    return this.directBudget;
  }

  controlPanelHeight(): number {
    if (this.host.facts().geometry.directSheet && this.host.paint().visualDirectSheet) {
      const layout = this.host.minimum.layout();
      const safeTop = readerVisualSafeTop(readerWindowMetrics());
      return layout.isExpanded() ? Math.max(0, layout.viewportHeight - this.directSheetBottom() - Math.max(12, safeTop)) :
        Math.min(layout.viewportHeight * .78, Math.max(0, layout.viewportHeight - safeTop));
    }
    if (this.host.facts().geometry.fixedIsland) return readerControlIslandHeight(this.host.minimum.layout().fullPanelHeight);
    if (this.host.minimum.layout().quickPanelHeight !== undefined) return this.host.minimum.layout().fullPanelHeight;
    return Math.min(Math.max(0, this.host.minimum.layout().fullPanelHeight), this.isExpanded() ? 852 : 736);
  }

  private controlQuickHeight(): number {
    if (this.host.facts().geometry.fixedIsland && !this.host.paint().visualDirectSheet) return this.controlPanelHeight();
    const currentQuickHeight = this.host.minimum.layout().quickPanelHeight;
    if (currentQuickHeight !== undefined) return currentQuickHeight;
    // Both device layouts retain the full 190vp Quick content above the
    // navigation row. Only a genuinely short window limits that endpoint.
    const expanded = this.isExpanded();
    if (this.quickGeometry === undefined || this.quickGeometryMode !== expanded) {
      this.quickGeometry = new ReaderControlGeometry(expanded);
      this.quickGeometryMode = expanded;
    }
    const authored = this.quickGeometry.sheetH;
    return Math.min(Math.max(0, this.controlPanelHeight()), authored);
  }

  contentEndpointHeight(full: boolean): number {
    if (full && this.host.facts().geometry.directSheet && this.host.paint().visualDirectSheet) return this.frame().content.height;
    if (this.host.facts().geometry.fixedIsland) return this.frame().content.height;
    const cache = full ? this.fullEndpointCache : this.quickEndpointCache;
    return cache.sample(1, full ? 1 : 0, this.host.minimum.layout().fullPanelWidth,
      this.controlPanelHeight(), this.host.minimum.layout().dockBottomGap, this.controlQuickHeight(), 0, this.host.minimum.layout().contentBudget).content.height;
  }

  private clockSample(fraction: number): number {
    const transition = this.visualSession.transition;
    if (transition === undefined) return fraction;
    if (this.host.facts().geometry.reduceMotion) return this.expandCurve.interpolate(fraction);
    const direct = this.host.facts().geometry.directSheet && (transition.fromLocation.level === 'secondary' &&
      readerControlIsDirectSheet(transition.fromLocation.module) || transition.toLocation.level === 'secondary' &&
      readerControlIsDirectSheet(transition.toLocation.module));
    if (direct || transition.kind === 'navigate') return this.controlMotionCurve.interpolate(fraction);
    if (transition.kind === 'morph') return sampleReaderControlMorphProgress(fraction);
    if (transition.kind === 'dismiss' || transition.kind === 'open') {
      return this.controlMotionCurve.interpolate(fraction);
    }
    const direction = transition.targetProgress - transition.startProgress;
    const visibilityDelta = (transition.to.visibilityProgress - transition.from.visibilityProgress) * direction;
    const expansionDelta = (transition.to.expansionProgress - transition.from.expansionProgress) * direction;
    return (visibilityDelta < 0 || (visibilityDelta === 0 && expansionDelta < 0)) ?
      this.collapseCurve.interpolate(fraction) : this.expandCurve.interpolate(fraction);
  }

  contentInputEnabled(): boolean {
    // A dismissed Stage intentionally keeps its actor tree mounted for the
    // compositor's retained hidden frame.  Do not leave the cached content
    // slots interactive at that endpoint: requiring the same local visibility
    // sample used by the Stage prevents hidden Lists/TextInputs from receiving
    // events or doing avoidable work while their parent opacity is zero.
    const visibility = this.host.paint().visualVisibilityProgress;
    const currentOwner = !this.host.facts().geometry.minimum.preparedRequired || this.host.minimum.currentIdentity() === this.host.minimum.committedIdentity();
    return !this.host.paint().directSheetClosing && currentOwner && this.host.facts().geometry.inputEnabled && ((this.host.intent({ kind: 'inputCurrent' }) as boolean | undefined) ?? true) && !this.host.facts().geometry.obscured &&
      (this.host.minimum.inputReady() || this.hasCurrentTemporaryInput()) && visibility > 0 &&
      (this.host.paint().visualTransitionKind === '' || this.host.paint().visualTransitionKind === 'open') &&
      this.host.paint().visualHeldPointerId < 0;
  }

  private currentTemporaryInputScope(): string {
    const location = this.contentLocation();
    return JSON.stringify([this.host.facts().document.source.id, this.host.facts().document.bookmarks.book?.libraryBookId ?? '',
      this.host.facts().document.bookmarks.book?.bookId ?? this.host.facts().document.bookTitle, this.host.facts().geometry.openRevision,
      location.level, location.module, location.directoryTab]);
  }

  private hasCurrentTemporaryInput(): boolean {
    // Keep an accepted native editor/modal through its own measurement reflow.
    // Metrics, selected key and p are outputs; a successor opening/module is not.
    return (this.temporaryInputKind !== '') && this.temporaryInputScope.length > 0 &&
      this.temporaryInputScope === this.currentTemporaryInputScope();
  }

  moduleTemporaryLayerHandler(module: string): (active: boolean, kind?: ReaderControlTemporaryInputKind, endEditing?: () => void | Promise<void>) => void {
    const identity = this.host.minimum.currentIdentity();
    const scope = this.currentTemporaryInputScope();
    return (active: boolean, kind: ReaderControlTemporaryInputKind = 'modal', endEditing?: () => void | Promise<void>): void => {
      if (!this.runtimeMounted || scope !== this.currentTemporaryInputScope() || this.contentLocation().module !== module ||
        (this.host.facts().geometry.minimum.preparedRequired && (identity !== this.host.minimum.committedIdentity() || identity !== this.host.minimum.currentIdentity()))) return;
      if (active && !this.host.minimum.inputReady() && !this.hasCurrentTemporaryInput()) return;
      const oldKind = this.temporaryInputKind;
      this.temporaryInputKind = active ? kind : '';
      this.temporaryInputScope = active ? scope : '';
      this.endInlineEditing = active && kind === 'inlineEditor' ? endEditing : undefined;
      this.host.intent({ kind: 'temporaryLayerChange', active, layer: this.temporaryInputKind });
      const verification = this.host.facts().geometry.verification;
      if (verification?.observing() === true && oldKind !== this.temporaryInputKind) {
        if (active) this.verificationLayerGeneration += 1;
        verification.layer(module, active, this.verificationLayerGeneration, this.visualSession,
          active ? kind : oldKind);
      }
      if (active && module === 'tts' && this.secondaryModuleInputEnabled('tts')) this.host.intent({ kind: 'ttsConfigurationOpen' });
    };
  }

  hasCurrentModalInput(): boolean {
    return this.hasCurrentTemporaryInput() && this.temporaryInputKind !== 'inlineEditor';
  }

  moduleEditorInputEnabled(module: 'search' | 'directory' | 'tts'): boolean {
    return this.contentLocation().module === module && this.contentInputEnabled() &&
      (this.host.minimum.inputReady() || this.hasCurrentTemporaryInput());
  }

  private commitVisualSession(state: ReaderControlSessionState): void {
    if (readerControlSessionStateEquals(this.host.linkedSession(), state)) return;
    this.host.publishSession(copyReaderControlSessionState(state));
  }

  applySemanticSession(next: ReaderControlSessionState, origin: ReaderControlVerificationOrigin): void {
    if (this.host.facts().geometry.minimum.preparedRequired && this.host.hasIntent()) {
      this.host.intent({ kind: 'sessionRequest', next, origin });
      return;
    }
    if (!readerControlSessionStateEquals(this.host.linkedSession(), next)) this.host.publishSession(next);
    if (this.runtime !== undefined) this.acceptRuntime(this.runtime.command(next));
  }

  private rememberVisibleContentLocation(state: ReaderControlSessionState): void {
    const location = readerControlContentLocation(state);
    if (this.host.facts().geometry.directSheet && location.level === 'home' && state.transition?.fromLocation.level === 'secondary' &&
      readerControlIsDirectSheet(state.transition.fromLocation.module)) return;
    if (this.host.facts().geometry.minimum.preparedRequired && (!this.host.minimum.presentationAvailable() ||
      this.host.facts().geometry.minimum.receipt?.identity !== this.host.minimum.committedIdentity() ||
      (location.level === 'secondary' ? location.module : 'home') !== this.host.facts().geometry.minimum.receipt?.profile.module)) return;
    const previous = this.host.paint().lastVisibleContentLocation;
    if (location.level !== 'hidden' && (location.level !== previous.level ||
      location.module !== previous.module || location.directoryTab !== previous.directoryTab ||
      location.form !== previous.form)) {
      this.host.paint().lastVisibleContentLocation = location;
    }
  }

  contentLocation(): ReaderControlLocation {
    return this.host.paint().lastVisibleContentLocation;
  }

  reportBackdropRegions(): void {
    const frame = this.frame();
    const ready = this.dockMeasured && this.host.topBar.rectangle().width > 0 && !this.host.facts().geometry.obscured;
    const topBar = this.backdropRegions[1];
    topBar.x = this.host.topBar.rectangle().x;
    topBar.y = this.host.topBar.rectangle().y + frame.topBar.translateY;
    topBar.width = this.host.topBar.rectangle().width;
    topBar.height = this.host.topBar.rectangle().height;
    topBar.borderRadius = 24;
    this.host.intent({ kind: 'backdropRegionsChange', regions: this.backdropRegions, ready });
  }

  requestPage(page: ReaderControlPage, origin: ReaderControlVerificationOrigin = 'module-button'): void {
    this.host.quickHome.invalidateProgress();
    this.host.intent({ kind: 'inputActivity' });
    this.host.intent({ kind: 'pageChange', page, origin });
  }

  controlActionInputEnabled(allowInlineEditor: boolean = false, forAppearance: boolean = false): boolean {
    const blockedByTemporaryInput = allowInlineEditor ? this.hasCurrentModalInput() : this.hasCurrentTemporaryInput();
    const moreOwnsInput = this.host.topBar.menuVisible() || this.host.facts().geometry.temporary.layer === 'moreMenu';
    return this.runtimeMounted && this.host.facts().geometry.inputEnabled && ((this.host.intent({ kind: 'inputCurrent' }) as boolean | undefined) ?? true) && !this.host.facts().geometry.obscured &&
      (!this.host.facts().geometry.minimum.preparedRequired || this.host.minimum.presentationAvailable()) &&
      (!blockedByTemporaryInput || (forAppearance && this.temporaryInputKind === 'moreMenu')) &&
      (forAppearance || !moreOwnsInput) && this.host.paint().visualVisibilityProgress > 0 &&
      this.host.paint().visualHeldPointerId < 0;
  }

  collapseControl(): void {
    if (!this.controlActionInputEnabled() || this.contentLocation().level !== 'secondary') return;
    if (this.host.facts().geometry.fixedIsland || this.host.facts().geometry.directSheet && readerControlIsDirectSheet(this.contentLocation().module)) {
      this.requestPage('home');
      return;
    }
    this.host.intent({ kind: 'inputActivity' });
    // A collapse button can be tapped while a handle transition is still in
    // flight. Retarget from the exact local visual sample, not the sparse host
    // snapshot, so the shape/visibility path never jumps back to its command
    // origin before the runtime applies the module-specific settle timing.
    this.applySemanticSession(collapseReaderControlSession(this.visualSession,
      readerControlMotionMs(READER_CONTROL_EXPAND_MS, this.host.facts().geometry.reduceMotion)), 'header-collapse');
  }

  async activateModule(module: string): Promise<void> {
    if (this.navigationIntentPending) return;
    let page: ReaderControlPage;
    if (module === 'autoPage') page = 'quickAutoPage';
    else if (module === 'tts') page = 'moduleTts';
    else if (module === 'appearance') page = 'moduleAppearance';
    else if (module === 'settings') page = 'moduleSettings';
    else return;
    const destination: ReaderControlPage = this.isActiveModule(module) ? 'home' : page;
    if (!this.navigationInputEnabled()) return;
    const scope = this.currentTemporaryInputScope();
    this.navigationIntentPending = true;
    try {
      if (this.hasCurrentTemporaryInput() && this.temporaryInputKind === 'inlineEditor') {
        const end = this.endInlineEditing;
        if (end === undefined) return;
        await end();
        if (!this.runtimeMounted || scope !== this.currentTemporaryInputScope() || !this.navigationInputEnabled()) return;
      }
      this.requestPage(destination);
      this.host.intent({ kind: 'moduleSelect', module: destination === 'home' ? 'home' : module });
    } finally { this.navigationIntentPending = false; }
  }

  promoteSearch(): void { this.requestPage('fullSearch'); }

  refreshDockPlacement(): void {
    if (!this.runtimeMounted) return;
    this.syncGripSubscription();
    if (this.placementTimer >= 0) clearTimeout(this.placementTimer);
    this.placementTimer = -1;
    const locked = this.host.paint().visualHeldPointerId >= 0 || this.host.paint().visualTransitionKind.length > 0 ||
      this.placementPointers.size > 0 || this.host.quickHome.holdsPlacement() ||
      this.host.topBar.menuVisible() || this.host.facts().geometry.temporary.layer !== '' || this.host.facts().geometry.allowsTextSelection || this.host.facts().geometry.obscured ||
      this.host.facts().launch.sample !== undefined || !this.host.facts().geometry.inputEnabled || !this.host.environment.foreground();
    const result = this.placement.update(readerControlAlignment(this.host.environment.alignmentPreference()),
      this.holdingHand, locked, readerMotionNowMs());
    if (result.alignment !== this.host.paint().dockAlignment) {
      this.host.paint().dockAlignment = result.alignment;
      this.dockRect.x = this.rootScreenX + this.dockLeft();
      this.reportBackdropRegions();
      this.editingHost.refresh();
    }
    if (result.settleInMs > 0) {
      this.placementTimer = setTimeout((): void => this.refreshDockPlacement(), Math.ceil(result.settleInMs));
    }
  }

  private syncGripSubscription(): void {
    const layout = this.host.minimum.layout();
    const requested = this.host.environment.foreground() && this.host.facts().geometry.inputEnabled && !this.host.facts().geometry.obscured && this.isExpanded() &&
      layout.viewportWidth - layout.fullPanelWidth > layout.fullPanelLeftGap + layout.fullPanelRightGap;
    if (requested === this.gripRequested) return;
    this.gripRequested = requested;
    if (requested) {
      this.unbindHoldingHand = subscribeReaderHoldingHand((hand: ReaderHoldingHand): void => {
        this.holdingHand = hand;
        this.refreshDockPlacement();
      });
    } else {
      this.unbindHoldingHand?.();
      this.unbindHoldingHand = undefined;
      this.holdingHand = undefined;
      this.placement.retireGrip();
    }
  }

  private retireDockPlacement(): void {
    this.unbindHoldingHand?.();
    this.unbindHoldingHand = undefined;
    this.gripRequested = false;
    this.holdingHand = undefined;
    this.placement.retireGrip();
    this.placementPointers.clear();
    if (this.placementTimer >= 0) clearTimeout(this.placementTimer);
    this.placementTimer = -1;
  }

  onDockPlacementTouch(event: TouchEvent): void {
    if (event.type === TouchType.Move) return;
    if (event.type === TouchType.Cancel) {
      this.placementPointers.clear();
    } else {
      for (const touch of event.changedTouches) {
        if (event.type === TouchType.Down) this.placementPointers.add(touch.id);
        else if (event.type === TouchType.Up) this.placementPointers.delete(touch.id);
      }
    }
    this.refreshDockPlacement();
  }

  dockLeft(): number {
    const layout = this.host.minimum.layout();
    if (this.host.facts().geometry.directSheet && this.host.paint().visualDirectSheet && layout.isExpanded()) {
      return Math.max(0, layout.viewportWidth - layout.fullPanelWidth - Math.max(12, readerVisualSafeRight(readerWindowMetrics())));
    }
    return readerControlDockLeft(layout.viewportWidth, layout.fullPanelWidth, layout.fullPanelLeftGap,
      layout.fullPanelRightGap, this.host.paint().dockAlignment);
  }

  private dockTop(): number {
    const bottom = this.host.facts().geometry.directSheet && this.host.paint().visualDirectSheet ? this.directSheetBottom() : this.host.minimum.layout().dockBottomGap;
    return this.host.minimum.layout().viewportHeight - bottom - this.controlPanelHeight();
  }

  private directSheetBottom(): number {
    return this.host.minimum.layout().isExpanded() ? Math.max(12, readerVisualSafeBottom(readerWindowMetrics())) : 0;
  }

  directSheetVisible(): boolean {
    return this.host.facts().geometry.directSheet && this.host.paint().visualDirectSheet && this.host.paint().visualVisibilityProgress > 0;
  }

  directSheetTranslation(): number {
    if (!this.directSheetVisible() || this.host.facts().geometry.reduceMotion) return 0;
    const layout = this.host.minimum.layout();
    return (1 - this.host.paint().visualExpansionProgress) * (layout.isExpanded() ? layout.viewportWidth - this.dockLeft() :
      this.controlPanelHeight() + this.directSheetBottom());
  }

  closeDirectSheet(): void {
    if (this.directSheetVisible() && !this.host.paint().directSheetClosing && this.controlActionInputEnabled()) this.requestPage('home');
  }

  controlCallbackGuard(): () => boolean {
    const owner = this.host.facts().geometry.minimum.ownerKey;
    const identity = this.host.minimum.currentIdentity();
    const scope = this.currentMoreMenuOwnerScope();
    return (): boolean => scope === this.currentMoreMenuOwnerScope() &&
      (!this.host.facts().geometry.minimum.preparedRequired || (owner === this.host.facts().geometry.minimum.ownerKey && identity === this.host.minimum.currentIdentity()));
  }

  controlActionScope(): string {
    return JSON.stringify([this.currentMoreMenuOwnerScope(), this.host.facts().geometry.minimum.preparedRequired ? this.host.facts().geometry.minimum.ownerKey : '',
      this.host.facts().geometry.minimum.preparedRequired ? this.host.minimum.currentIdentity() : '']);
  }

  controlActionHandler(action: () => void): () => void {
    const current = this.controlCallbackGuard();
    return (): void => { if (current()) action(); };
  }

  controlTouchHandler(): (event: TouchEvent) => void {
    const runtime = this.runtime;
    const lifecycle = this.runtimeLifecycle;
    const owner = this.host.facts().geometry.minimum.ownerKey;
    const identity = this.host.minimum.currentIdentity();
    const scope = this.currentMoreMenuOwnerScope();
    return (event: TouchEvent): void => {
      if (runtime !== this.runtime || lifecycle !== this.runtimeLifecycle || owner !== this.host.facts().geometry.minimum.ownerKey ||
        scope !== this.currentMoreMenuOwnerScope()) return;
      if (event.type === TouchType.Down && (this.host.facts().geometry.directSheet && this.host.paint().visualDirectSheet ||
        this.host.facts().geometry.minimum.preparedRequired && identity !== this.host.minimum.currentIdentity())) return;
      this.handleControlTouch(event);
    };
  }

  navigationInputEnabled(forAppearance: boolean = false): boolean {
    return this.controlActionInputEnabled(true, forAppearance) && (!this.host.facts().geometry.minimum.preparedRequired || this.host.minimum.presentationAvailable()) &&
      (!this.host.facts().geometry.minimum.preparedRequired || this.host.facts().geometry.minimum.receipt?.environmentKey === this.host.facts().geometry.minimum.environmentKey) &&
      this.frame().navigation.opacity > 0 && this.frame().navigation.height > 0;
  }

  activeNavigationModule(): string {
    const location = this.contentLocation();
    return location.level === 'secondary' ? location.module : '';
  }

  private isActiveModule(module: string): boolean {
    const location = this.contentLocation();
    return location.level === 'secondary' && location.module === module;
  }

  setAppearanceFontReorderActivity(active: boolean): void {
    if (this.appearanceFontReorderActive === active) return;
    this.appearanceFontReorderActive = active;
    this.host.intent({ kind: 'appearanceFontReorderActivityChange', active });
  }

  secondaryModuleInputEnabled(module: string): boolean {
    return this.runtimeMounted && !this.host.topBar.menuVisible() && this.contentLocation().level === 'secondary' &&
      this.contentLocation().module === module && this.contentInputEnabled() &&
      (!this.host.facts().geometry.minimum.preparedRequired || this.host.minimum.inputReady());
  }

  currentMoreMenuOwnerScope(): string {
    return JSON.stringify([this.host.facts().document.source.id, this.host.facts().document.source.bookId, this.host.facts().document.bookmarks.book?.libraryBookId ?? '',
      this.host.facts().geometry.openRevision, this.runtimeLifecycle]);
  }

  onLaunchSampleChanged(): void {
    this.refreshDockPlacement();
    const sample = this.host.facts().launch.sample;
    if (sample === undefined) {
      this.launchCapture.minimum = undefined;
      this.launchMotionBounds = undefined;
      this.launchSourceVisibleGeneration = 0;
      this.launchSourceVisibleKind = undefined;
      return;
    }
    if (this.capturedLaunchGeneration === this.host.facts().launch.generation) return;
    const bundleRequired = this.host.facts().geometry.minimum.identity.length > 0;
    const source = this.host.facts().launch.sourceMinimum;
    if (bundleRequired && (source === undefined || source.generation !== this.host.facts().launch.generation ||
      !readerControlPlaybackSourceKindMatches(source.kind, sample.type))) return;
    const receipt = bundleRequired ? source?.receipt : undefined;
    const naturalContract = bundleRequired && source?.requiresNaturalProfile === true;
    if (bundleRequired && source?.requiresNaturalProfile === false && receipt !== undefined) return;
    if (naturalContract && (receipt === undefined || receipt.metricsRevision !== this.host.facts().geometry.minimum.metricsRevision ||
      !readerControlPlaybackProfileMatches(receipt, sample.type,
      receipt.identity, receipt.key, receipt.metricsRevision))) return;
    this.capturedLaunchGeneration = this.host.facts().launch.generation;
    this.launchCapture.waveform = readerTtsWaveformSnapshot();
    if (this.launchSourceVisibleGeneration !== this.host.facts().launch.generation) {
      this.launchSourceVisibleGeneration = 0;
      this.launchSourceVisibleKind = undefined;
    }
    this.launchCapture.minimum = naturalContract ? receipt : undefined;
    this.launchCapture.kind = bundleRequired && source !== undefined ? source.kind : this.host.facts().launch.sourceKind;
    this.launchCapture.progress = naturalContract && source !== undefined ?
      (source.kind === 'fullTtsPlayback' || source.kind === 'fullAutoPagePlayback' ? 1 : 0) : this.host.paint().contentMotionProgress;
    const measuredBounds = this.host.facts().geometry.fixedIsland ? undefined : this.launchCapture.minimum?.bounds;
    this.launchMotionBounds = measuredBounds ?? readerControlMotionBounds(this.host.minimum.layout().fullPanelWidth,
      this.controlPanelHeight(), this.host.minimum.layout().dockBottomGap, this.controlQuickHeight(), this.host.minimum.layout().contentBudget);
    const endpoint = sampleReaderControlMotionComposition({ visibilityProgress: 1,
      expansionProgress: this.launchCapture.progress }, this.launchMotionBounds);
    this.launchCapture.width = this.host.facts().geometry.fixedIsland ? sample.sourceWidth :
      this.launchCapture.minimum === undefined ? this.host.paint().contentMotionWidth : endpoint.content.width;
    this.launchCapture.height = this.host.facts().geometry.fixedIsland ? sample.sourceHeight :
      this.launchCapture.minimum === undefined ? this.host.paint().contentMotionHeight : endpoint.content.height;
    this.launchCapture.viewportHeight = this.launchCapture.minimum?.fullContentHeightVp ?? this.contentEndpointHeight(true);
    this.confirmLaunchSourceReady();
  }

  onLaunchSourceVisible(kind: ReaderSessionMorphSourceKind): void {
    if (!this.host.facts().launch.recovering) return;
    const source = this.host.facts().launch.sourceMinimum;
    const expected = source?.generation === this.host.facts().launch.generation ? source.kind :
      this.capturedLaunchGeneration === this.host.facts().launch.generation ? this.launchCapture.kind : undefined;
    if (expected !== undefined && kind !== expected) return;
    this.launchSourceVisibleGeneration = this.host.facts().launch.generation;
    this.launchSourceVisibleKind = kind;
    this.confirmLaunchSourceReady();
  }

  launchSourceDetached(type: ReaderSessionCapsuleType): boolean {
    return this.host.facts().launch.sample?.type === type && (this.host.facts().launch.ownsControls || this.host.facts().launch.recovering);
  }

  confirmLaunchSourceReady(): void {
    if (!this.host.facts().launch.recovering || (this.host.facts().geometry.fixedIsland && (this.launchSourceVisibleGeneration !== this.host.facts().launch.generation ||
      this.launchSourceVisibleKind !== this.launchCapture.kind)) ||
      this.launchSourceReadyGeneration === this.host.facts().launch.generation || this.host.paint().visualVisibilityProgress < 1 ||
      !this.launchSourceCurrent()) return;
    this.launchSourceReadyGeneration = this.host.facts().launch.generation;
    this.host.intent({ kind: 'launchSourceReady', generation: this.host.facts().launch.generation });
  }

  launchSourceCurrent(): boolean {
    if (!this.runtimeMounted) return false;
    const sample = this.host.facts().launch.sample;
    if (sample === undefined || this.capturedLaunchGeneration !== this.host.facts().launch.generation) return false;
    if (this.host.facts().geometry.minimum.identity.length === 0) return true;
    const source = this.host.facts().launch.sourceMinimum;
    const receipt = this.launchCapture.minimum;
    if (source === undefined || source.generation !== this.host.facts().launch.generation || source.kind !== this.launchCapture.kind ||
      !readerControlPlaybackSourceKindMatches(source.kind, sample.type)) return false;
    if (!source.requiresNaturalProfile) return receipt === undefined && source.receipt === undefined;
    return receipt !== undefined && source.receipt !== undefined &&
      receipt.module === sample.type && receipt.metricsRevision === this.host.facts().geometry.minimum.metricsRevision &&
      readerControlPlaybackProfileMatches(receipt, receipt.module, receipt.identity, receipt.key, receipt.metricsRevision) &&
      readerControlPlaybackProfileMatches(source.receipt, receipt.module, receipt.identity, receipt.key, receipt.metricsRevision);
  }

  reportSessionMorphSource(
    kind: ReaderSessionMorphSourceKind,
    left: number,
    top: number,
    width: number,
    height: number,
  ): void {
    if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(width) ||
      !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }
    if (this.host.facts().launch.ownsControls || this.host.facts().launch.recovering) return;
    this.host.intent({ kind: 'sessionLaunchShellMeasured', topExit: this.host.minimum.layout().topBarTop + this.host.minimum.layout().topBarHeight, dockExit: this.host.minimum.layout().viewportHeight - this.presentedDockTop() - this.frame().shell.y });
    const frame = this.frame();
    const localLeft = left - this.rootScreenX;
    const localTop = top - this.rootScreenY;
    const clipLeft = this.dockLeft() + frame.content.x;
    const clipTop = this.presentedDockTop() + frame.content.y + frame.dock.translateY;
    const visibleLeft = Math.max(0, clipLeft - localLeft);
    const visibleTop = Math.max(0, clipTop - localTop);
    const visibleRight = Math.min(width, clipLeft + frame.content.width - localLeft);
    const visibleBottom = Math.min(height, clipTop + frame.content.height - localTop);
    if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return;
    this.sessionMorphMeasurementRevision += 1;
    this.host.intent({ kind: 'sessionMorphSourceMeasured', measurement: new ReaderSessionMorphSourceMeasurement(
      kind,
      readerSessionMorphActorId(kind),
      left - this.rootScreenX,
      top - this.rootScreenY,
      width,
      height,
      this.sessionMorphMeasurementRevision, visibleLeft, visibleTop, visibleRight, visibleBottom,
      this.host.facts().geometry.fixedIsland || kind === 'quickAutoPage' ? 12 : kind === 'fullTtsPlayback' ? 14 : 8,
    ) });
  }
}

class ReaderControlCapturedLaunchSource {
  kind: ReaderSessionMorphSourceKind = 'quickAutoPage';
  minimum: ReaderControlPlaybackProfileReceipt | undefined = undefined;
  waveform: ReaderTtsWaveformSample | undefined = undefined;
  progress: number = 0;
  width: number = 286;
  height: number = 190;
  viewportHeight: number = 666;
}

interface ReaderControlLaunchSourceBuilderInput {
  readonly motion: ReaderControlPanelRuntimeHost;
}

/** Native sharp source stays pinned to its admitted generation until capsule handoff. */
@Builder
export function ReaderControlLaunchSource($$: ReaderControlLaunchSourceBuilderInput) {
  if ($$.motion.launchSourceCurrent()) {
  if ($$.motion.launchSource().kind === 'quickAutoPage' || $$.motion.launchSource().kind === 'fullAutoPagePlayback') {
    ReaderControlAutoPageContent({
      fixedIsland: $$.motion.host.facts().geometry.fixedIsland,
      sourceMinimum: $$.motion.launchSource().minimum,
      sourceMinimumIdentity: $$.motion.launchSource().minimum?.identity ?? '',
      sourceMinimumKey: $$.motion.launchSource().minimum?.key ?? '',
      sourceMinimumMetricsRevision: $$.motion.launchSource().minimum?.metricsRevision ?? -1,
      sourceOnly: $$.motion.launchSource().kind === 'quickAutoPage' ? 'quick' : 'full',
      form: $$.motion.launchSource().kind === 'quickAutoPage' ? 'quick' : 'full',
      motionProgress: $$.motion.launchSource().progress, availableWidth: $$.motion.launchSource().width,
      availableHeight: $$.motion.launchSource().height, fullViewportHeight: $$.motion.launchSource().viewportHeight,
      interactionEnabled: false, status: $$.motion.host.facts().launch.sourceAutomatic,
      speedSeconds: $$.motion.host.facts().playback.automatic.speedSeconds, timerSummaryText: $$.motion.host.facts().playback.automatic.timerSummary,
      timerMinutes: $$.motion.host.facts().playback.automatic.timerMinutes, timerSeconds: $$.motion.host.facts().playback.automatic.timerSeconds,
      followHighlight: $$.motion.host.facts().playback.automatic.followHighlight, canPreviousChapter: $$.motion.host.quickHome.canStepChapter(-1),
      canNextChapter: $$.motion.host.quickHome.canStepChapter(1),
    });
  } else {
    ReaderControlTtsContent({
      fixedIsland: $$.motion.host.facts().geometry.fixedIsland,
      sourceMinimum: $$.motion.launchSource().minimum,
      sourceMinimumIdentity: $$.motion.launchSource().minimum?.identity ?? '',
      sourceMinimumKey: $$.motion.launchSource().minimum?.key ?? '',
      sourceMinimumMetricsRevision: $$.motion.launchSource().minimum?.metricsRevision ?? -1,
      sourceOnly: $$.motion.launchSource().kind === 'quickTts' ? 'quick' : 'full',
      frozenWaveformSample: $$.motion.launchSource().waveform, reduceMotion: $$.motion.host.facts().geometry.reduceMotion,
      form: $$.motion.launchSource().kind === 'quickTts' ? 'quick' : 'full',
      motionProgress: $$.motion.launchSource().progress, availableWidth: $$.motion.launchSource().width,
      availableHeight: $$.motion.launchSource().height, fullViewportHeight: $$.motion.launchSource().viewportHeight,
      interactionEnabled: false, state: $$.motion.host.facts().launch.sourceSpeech,
      timerMode: $$.motion.host.facts().playback.speech.timerMode, timerMinutes: $$.motion.host.facts().playback.speech.timerMinutes, timerSeconds: $$.motion.host.facts().playback.speech.timerSeconds,
      engine: $$.motion.host.facts().playback.speech.engine, language: $$.motion.host.facts().playback.speech.language, person: $$.motion.host.facts().playback.speech.person,
      voiceOptions: $$.motion.host.facts().playback.speech.voiceOptions, followHighlight: $$.motion.host.facts().playback.speech.followHighlight,
    });
  }
  }
}
