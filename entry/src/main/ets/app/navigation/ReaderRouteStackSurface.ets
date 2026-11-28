import type { AnimatorResult } from '@ohos.animator';
import { readerRebaseSettingsViewport } from './ReaderSettingsPresentationPolicy';
import type { ReaderRoute, ReaderRouteMotionKind } from './ReaderNavigation';
import { READER_RETAINED_DETAIL_LANE, READER_ROUTE_EDGE_BACK_COMMIT_FRACTION, READER_ROUTE_PARENT_DIM,
  readerDetailSceneOpacity, readerRouteMotionPose, type ReaderDetailSceneSnapshot } from './ReaderRouteMotionModel';
import { ReaderPostLayoutFrame } from '../../ui/layout/ReaderPostLayoutFrame';
import { motionAnimateParam, motionSpecGet, readerMotionStandardCurve } from '../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../ui/foundation/ReaderMotionPolicy';
import { readerMotionNowMs } from '../../ui/foundation/ReaderMotionClock';
import { readerBeginTransition, readerRouteTransitionLaneId, readerTransitionActorX,
  readerTransitionsEnabled } from '../../ui/foundation/ReaderTransitionSignals';
import { readerAppColor } from '../../ui/foundation/ReaderThemeRegistry';

const ROOT_LANE = 'reader-route-root';
const EDGE_WIDTH_VP = 18;
const NATIVE_START_TIMEOUT_MS = 300;
const NATIVE_END_GRACE_MS = 100;
const PREVIEW_END_TIMEOUT_MS = 1000;

type ReaderRouteSurfaceMotion = ReaderRouteMotionKind | 'none';
export type ReaderRouteSurfaceKey = ReaderRoute |
  'settings-home' | 'settings-general' | 'settings-backup' | 'settings-about' | 'settings-licenses' |
  'settings-developer' | 'settings-message-preview';

interface ReaderRoutePaint {
  from: string;
  to: string;
  motion: ReaderRouteSurfaceMotion;
  fade: boolean;
  fadeOutgoing: boolean;
}

interface ReaderRouteBackPreview {
  from: ReaderRouteSurfaceKey;
  to: ReaderRouteSurfaceKey;
  width: number;
  progress: number;
  requested: boolean;
  originX?: number;
  result?: 'commit' | 'cancel';
  animation?: ReaderRouteAnimation;
}

interface ReaderRouteAnimation {
  proxy?: NavigationTransitionProxy;
  settled: boolean;
  interactiveReady?: boolean;
  deadline?: number;
}

/** Renders the admitted app route in a native stack. Index owns all Back decisions. */
@Component
export struct ReaderRouteStackSurface {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @Prop @Watch('onRouteChanged') route: ReaderRouteSurfaceKey = 'settings';
  @Prop surfaceId: string = '';
  // The outer route owns its own insets. Nested settings stacks are already inside that content.
  @Prop extendsToWindowEdges: boolean = false;
  @Prop initialRoot: ReaderRouteSurfaceKey | undefined = undefined;
  @Prop @Watch('onRouteChanged') wideSettingsLayout: boolean = false;
  @Prop settingsPresentationRoot: ReaderRouteSurfaceKey | undefined = undefined;
  @Prop @Watch('onRouteChanged') routeMotion: ReaderRouteSurfaceMotion = 'none';
  @Prop @Watch('onEdgeAvailabilityChanged') reduceMotion: boolean = false;
  @Prop @Watch('onEdgeAvailabilityChanged') viewportWidth: number = 0;
  @Prop @Watch('onEdgeAvailabilityChanged') backGestureEnabled: boolean = false;
  // The detail cover is a single live destination above an external retained reader.
  @Prop @Watch('onRouteChanged') readerDetailActive: boolean = false;
  @Prop readerDetailScene: ReaderDetailSceneSnapshot | undefined = undefined;
  @BuilderParam content: (route: ReaderRouteSurfaceKey) => void;
  onBack: () => boolean = (): boolean => false;

  private readonly pathStack: NavPathStack = new NavPathStack();
  @State private rootRoute: ReaderRouteSurfaceKey = 'settings';
  @State private previousTab: ReaderRouteSurfaceKey | undefined = undefined;
  @State private tabProgress: number = 1;
  @State private hasDestination: boolean = false;
  @State private paint: ReaderRoutePaint | undefined = undefined;
  @State private pendingPushLane: string | undefined = undefined;
  @State private progress: number = 1;
  private mounted: boolean = false;
  private routeUpdate: number = 0;
  private animationGeneration: number = 0;
  private tabGeneration: number = 0;
  private pendingTabResetFrom: string | undefined = undefined;
  private activeRouteAnimation: ReaderRouteAnimation | undefined = undefined;
  private routeAnimator: AnimatorResult | undefined = undefined;
  private routeEndTimer: number = -1;
  private pendingPushTimer: number = -1;
  private preview: ReaderRouteBackPreview | undefined = undefined;
  private appliedWideSettingsLayout: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    this.appliedWideSettingsLayout = this.wideSettingsLayout;
    this.rootRoute = this.initialRoot ?? this.settingsPresentationRoot ?? this.route;
    if (this.rootRoute !== this.route) {
      this.pathStack.pushPath({ name: this.route }, false);
      this.hasDestination = true;
    }
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.setPendingPushLane(undefined);
    this.routeUpdate += 1;
    this.resolvePreview('cancel');
    const preview = this.preview;
    if (preview?.animation !== undefined) this.settleAnimation(preview.animation, preview.result === 'commit');
    this.clearRouteDeadline();
    this.stopRouteAnimator();
    this.animationGeneration += 1;
    this.activeRouteAnimation = undefined;
    this.pendingTabResetFrom = undefined;
    this.preview = undefined;
    this.paint = undefined;
    this.finishTabTransition();
  }

  private onEdgeAvailabilityChanged(): void {
    if (this.preview?.requested === true && this.route === this.preview.to) {
      this.resolvePreview('commit');
      return;
    }
    if (this.preview !== undefined && (!this.backGestureEnabled || this.reduceMotion ||
      this.viewportWidth !== this.preview.width)) this.resolvePreview('cancel');
  }

  private onRouteChanged(): void {
    if (!this.mounted) return;
    const update = ++this.routeUpdate;
    // Let the other props from the same Index publication reach the host first.
    void Promise.resolve().then((): void => {
      if (this.mounted && update === this.routeUpdate) this.reconcile();
    });
  }

  private reconcile(): void {
    const settingsRoot = this.settingsPresentationRoot;
    const rebaseSettings = readerRebaseSettingsViewport(this.appliedWideSettingsLayout, this.wideSettingsLayout,
      settingsRoot !== undefined);
    if (this.pendingPushLane !== undefined && (this.routeMotion === 'none' || this.route !== this.pendingPushLane)) {
      this.setPendingPushLane(undefined);
    }
    const preview = this.preview;
    if (preview !== undefined) {
      if (rebaseSettings) this.resolvePreview('cancel');
      else if (preview.requested && this.route === preview.to) this.resolvePreview('commit');
      else if (this.route !== preview.from) this.resolvePreview('cancel');
      return;
    }
    const names = this.pathStack.getAllPathName();
    const top = names.length > 0 ? names[names.length - 1] : this.rootRoute;
    // Reconcile the latest destination after the native end acknowledgement.
    if (this.activeRouteAnimation !== undefined) return;
    if (this.pendingTabResetFrom !== undefined) {
      // ArkUI has not yet observed the clear. A newer tab can replace the
      // incoming root under the same outgoing destination.
      if (this.routeMotion === 'tab' && !rebaseSettings) this.rootRoute = this.route;
      return;
    }
    this.appliedWideSettingsLayout = this.wideSettingsLayout;
    if (rebaseSettings && settingsRoot !== undefined && (this.rootRoute !== settingsRoot || top !== this.route)) {
      // Width changes transfer the active pane to the outer stack without a
      // tab or Back intent. Keep Settings as the native ancestor.
      this.finishTabTransition();
      this.setPendingPushLane(undefined);
      this.rootRoute = settingsRoot;
      this.pathStack.clear(false);
      if (this.route !== settingsRoot) this.pathStack.pushPath({ name: this.route }, false);
      this.hasDestination = this.pathStack.size() > 0;
      return;
    }
    if (top === this.route) return;
    if (this.routeMotion !== 'tab') this.finishTabTransition();
    const animate = this.routeMotion !== 'none';
    if (this.readerDetailActive && this.route === 'detail') {
      // Treat detail as the foreground even when a detail ancestor exists below a directory.
      // Index samples this lane's actual coverage, so there is no concurrent native push.
      this.pathStack.pushPath({ name: this.route }, false);
    } else if (this.routeMotion === 'tab') {
      if (names.length === 0) {
        this.switchRootTab(this.route);
      } else {
        // Reveal the new root under the actual outgoing destination. Clearing
        // without a native transition would show the previous tab's root first.
        this.finishTabTransition();
        this.pendingTabResetFrom = top;
        this.rootRoute = this.route;
        this.armRouteDeadline(NATIVE_START_TIMEOUT_MS, (): void => {
          if (this.pendingTabResetFrom !== top) return;
          this.pendingTabResetFrom = undefined;
          this.onRouteChanged();
        });
        this.pathStack.clear(true);
      }
    } else if (this.route === this.rootRoute) {
      this.pathStack.clear(animate);
    } else if (this.routeMotion === 'pop') {
      if (names.includes(this.route)) this.pathStack.popToName(this.route, animate);
      else if (names.length > 0) this.pathStack.replacePath({ name: this.route }, animate);
      else this.rootRoute = this.route;
    } else if (names.includes(this.route)) {
      this.pathStack.popToName(this.route, animate);
    } else {
      if (animate) this.setPendingPushLane(this.route);
      this.pathStack.pushPath({ name: this.route }, animate);
    }
    this.hasDestination = this.pathStack.size() > 0;
  }

  private finishTabTransition(): void {
    this.tabGeneration += 1;
    this.previousTab = undefined;
    this.tabProgress = 1;
  }

  private switchRootTab(route: ReaderRouteSurfaceKey): void {
    if (route === this.rootRoute) return;
    const previous = this.rootRoute;
    const generation = ++this.tabGeneration;
    this.previousTab = previous;
    this.tabProgress = 0;
    this.rootRoute = route;
    const isCurrent = (): boolean => this.mounted && generation === this.tabGeneration && this.rootRoute === route;
    const finish = (): void => { if (isCurrent()) this.finishTabTransition(); };
    const context = this.getUIContext();
    try {
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (!isCurrent()) return;
        try {
          context.animateTo(this.reduceMotion ? readerMotionReducedFadeParam(finish) : motionAnimateParam('app.navigation.tab', finish),
            (): void => { this.tabProgress = 1; });
        } catch (_) { finish(); }
      }));
    } catch (_) { finish(); }
  }

  private rootTabs(): ReaderRouteSurfaceKey[] {
    return this.previousTab === undefined ? [this.rootRoute] : [this.previousTab, this.rootRoute];
  }

  private rootTabOpacity(route: ReaderRouteSurfaceKey): number {
    if (route !== this.rootRoute) return 1;
    return this.reduceMotion ? this.tabProgress : .72 + .28 * this.tabProgress;
  }

  private rootTabScale(route: ReaderRouteSurfaceKey): number {
    return this.reduceMotion || route !== this.rootRoute ? 1 : .992 + .008 * this.tabProgress;
  }

  private settleAnimation(animation: ReaderRouteAnimation, finish: boolean): void {
    const proxy = animation.proxy;
    if (animation.settled || proxy === undefined) return;
    // The platform can finish before delivering onTransitionEnd. After its
    // deadline only the native timeout path is allowed to settle this proxy.
    if (animation.deadline !== undefined && readerMotionNowMs() >= animation.deadline) return;
    animation.settled = true;
    try {
      if (finish) proxy.finishTransition();
      else proxy.cancelTransition?.();
    } catch (_) {
      // The local deadline still releases the route if the native proxy disappeared.
    }
  }

  private stopRouteAnimator(): void {
    const animator = this.routeAnimator;
    this.routeAnimator = undefined;
    try { animator?.cancel(); } catch (_) {}
  }

  private clearRouteDeadline(): void {
    if (this.routeEndTimer >= 0) clearTimeout(this.routeEndTimer);
    this.routeEndTimer = -1;
  }

  // ArkUI can mount the destination before it supplies the native transition proxy.
  private setPendingPushLane(lane: string | undefined): void {
    if (this.pendingPushTimer >= 0) clearTimeout(this.pendingPushTimer);
    this.pendingPushTimer = -1;
    this.pendingPushLane = lane;
    if (lane !== undefined) {
      this.pendingPushTimer = setTimeout((): void => {
        this.pendingPushTimer = -1;
        this.pendingPushLane = undefined;
      }, NATIVE_START_TIMEOUT_MS);
    }
  }

  private armRouteDeadline(delay: number, expire: () => void): void {
    this.clearRouteDeadline();
    this.routeEndTimer = setTimeout((): void => {
      this.routeEndTimer = -1;
      expire();
    }, delay);
  }

  private completeRouteAnimation(animation: ReaderRouteAnimation, preview?: ReaderRouteBackPreview): void {
    if (!this.mounted || this.activeRouteAnimation !== animation) return;
    this.setPendingPushLane(undefined);
    this.clearRouteDeadline();
    this.stopRouteAnimator();
    this.activeRouteAnimation = undefined;
    this.paint = undefined;
    this.progress = 1;
    if (preview !== undefined && this.preview === preview) this.preview = undefined;
    this.hasDestination = this.pathStack.size() > 0;
    this.onRouteChanged();
  }

  private nativeTransition(from: NavContentInfo, to: NavContentInfo, operation: NavigationOperation): NavigationAnimatedTransition {
    const nativePop = operation === NavigationOperation.POP;
    const ticket = ++this.animationGeneration;
    const preview = nativePop && from.name === this.preview?.from ? this.preview : undefined;
    const tabReset = nativePop && from.name !== undefined && from.name === this.pendingTabResetFrom && to.name === undefined;
    if (this.pendingTabResetFrom !== undefined) {
      this.pendingTabResetFrom = undefined;
      this.clearRouteDeadline();
    }
    const motion: ReaderRouteSurfaceMotion = tabReset ? 'tab' : nativePop || this.routeMotion === 'pop' ?
      'pop' : this.routeMotion === 'tab' ? 'tab' : 'push';
    const id = motion === 'pop' ? 'app.navigation.pop' : motion === 'tab' ? 'app.navigation.tab' : 'app.navigation.push';
    const fade = this.reduceMotion || motion === 'tab';
    const duration = this.reduceMotion ? motionSpecGet('app.motion.reduced.fade')?.durationMs : motionSpecGet(id)?.durationMs;
    const timeout = preview !== undefined ? undefined : duration === undefined ? 1000 : duration + 300;
    const animation: ReaderRouteAnimation = {
      settled: false, deadline: timeout === undefined ? undefined : readerMotionNowMs() + timeout,
    };
    if (this.mounted) {
      this.activeRouteAnimation = animation;
      if (preview !== undefined) preview.animation = animation;
      if (timeout !== undefined) {
        this.armRouteDeadline(timeout + NATIVE_END_GRACE_MS, (): void => this.completeRouteAnimation(animation));
      }
    }
    return {
      isInteractive: preview !== undefined,
      timeout,
      transition: (proxy: NavigationTransitionProxy): void => {
        if (animation.settled || animation.proxy !== undefined) return;
        animation.proxy = proxy;
        if (!this.mounted || ticket !== this.animationGeneration || this.activeRouteAnimation !== animation) {
          if (preview !== undefined) this.settleAnimation(animation, preview.result === 'commit');
          return;
        }
        this.stopRouteAnimator();
        this.paint = { from: from.name ?? ROOT_LANE, to: to.name ?? ROOT_LANE, motion, fade,
          fadeOutgoing: nativePop || motion === 'pop' };
        if (motion === 'push' || motion === 'pop') {
          if (preview?.result === undefined) this.observeRouteMotion(preview === undefined ? motion : 'preview',
            motion === 'pop' ? from.name ?? ROOT_LANE : to.name ?? ROOT_LANE, preview?.originX);
        }
        this.setPendingPushLane(undefined);
        this.progress = 0;
        const finish = (): void => {
          if (preview === undefined && this.activeRouteAnimation === animation) this.settleAnimation(animation, true);
        };
        const parameters = this.reduceMotion ? readerMotionReducedFadeParam(finish) : motionAnimateParam(id, finish);
        if (duration !== undefined) parameters.duration = duration;
        // Native interactive progress must map directly to pointer distance.
        if (preview !== undefined) parameters.curve = Curve.Linear;
        const context = this.getUIContext();
        const start = (): void => {
          if (!this.mounted || this.activeRouteAnimation !== animation || animation.settled) return;
          try {
            if (readerTransitionsEnabled() && preview === undefined && !fade && duration !== undefined && duration > 0) {
              this.stopRouteAnimator();
              const animator = context.createAnimator({
                duration, easing: 'linear', delay: 0, fill: 'forwards',
                direction: 'normal', iterations: 1, begin: 0, end: 1,
              });
              this.routeAnimator = animator;
              animator.onFrame = (fraction: number): void => {
                if (this.routeAnimator === animator && this.mounted && this.activeRouteAnimation === animation && !animation.settled) {
                  this.progress = readerMotionStandardCurve().interpolate(fraction);
                }
              };
              animator.onFinish = (): void => {
                if (this.routeAnimator === animator) {
                  this.routeAnimator = undefined;
                  if (this.mounted && this.activeRouteAnimation === animation && !animation.settled) {
                    this.progress = 1;
                    finish();
                  }
                }
              };
              animator.play();
            } else {
              context.animateTo(parameters, (): void => {
                if (this.activeRouteAnimation === animation) this.progress = 1;
              });
              if (preview !== undefined) {
                animation.interactiveReady = true;
                proxy.updateTransition?.(preview.progress);
                this.applyPreviewResult(preview);
              }
            }
          } catch (_) {
            if (preview !== undefined) {
              animation.interactiveReady = true;
              this.resolvePreview('cancel');
              this.applyPreviewResult(preview);
            } else {
              finish();
            }
          }
        };
        try {
          context.postFrameCallback(new ReaderPostLayoutFrame(context, start));
        } catch (_) {
          start();
        }
      },
      onTransitionEnd: (_success: boolean): void => {
        animation.settled = true;
        this.completeRouteAnimation(animation, preview);
      },
    };
  }

  private laneX(route: ReaderRouteSurfaceKey, lane: string): number {
    const width = Math.max(0, this.viewportWidth);
    const detail = this.readerDetailScene;
    if (detail !== undefined && route === 'detail') {
      return readerRouteMotionPose('push', 'child', width, detail.coverage, this.reduceMotion);
    }
    if (detail !== undefined && detail.phase !== 'retired') return 0;
    const paint = this.paint;
    if (paint === undefined) return this.pendingPushLane === lane ? width : 0;
    if (paint.fade || paint.motion === 'tab' || paint.motion === 'none') return 0;
    if (lane === paint.from) return readerRouteMotionPose(paint.motion, paint.motion === 'pop' ? 'child' : 'parent',
      width, this.progress);
    if (lane === paint.to) return readerRouteMotionPose(paint.motion, paint.motion === 'pop' ? 'parent' : 'child',
      width, this.progress);
    return 0;
  }

  private laneDimOpacity(lane: string): number {
    const paint = this.paint;
    if (paint === undefined || paint.fade ||
      (this.readerDetailScene !== undefined && this.readerDetailScene.phase !== 'retired')) return 0;
    return paint.motion === 'pop' ?
      (lane === paint.to ? READER_ROUTE_PARENT_DIM * (1 - this.progress) : 0) :
      (lane === paint.from ? READER_ROUTE_PARENT_DIM * this.progress : 0);
  }

  private laneOpacity(route: ReaderRouteSurfaceKey, lane: string): number {
    const detail = this.readerDetailScene;
    if (detail !== undefined && detail.phase !== 'retired') {
      return route !== 'detail' ? 0 : readerDetailSceneOpacity(detail.coverage, this.reduceMotion);
    }
    const paint = this.paint;
    if (paint === undefined && this.pendingPushLane === lane && this.reduceMotion) return 0;
    if (paint?.fade !== true) return 1;
    if (paint.fadeOutgoing) return lane === paint.from ? 1 - this.progress : 1;
    return lane === paint.to ? this.progress : 1;
  }

  private laneAcceptsInput(route: ReaderRouteSurfaceKey): boolean {
    if (route !== this.route) return false;
    const detail = this.readerDetailScene;
    return detail === undefined || (detail.phase === 'retired' ? route !== 'detail' : detail.phase === 'covered');
  }

  private laneId(route: ReaderRouteSurfaceKey, lane: string): string | undefined {
    if (!readerTransitionsEnabled()) return undefined;
    return readerRouteTransitionLaneId(this.surfaceId,
      route === 'detail' && this.readerDetailScene !== undefined ? READER_RETAINED_DETAIL_LANE : lane);
  }

  private destinationBack(route: ReaderRouteSurfaceKey): boolean {
    // Consume the platform pop only on the active destination. No automatic
    // native pop may retire a route while Index handles a modal or an exit ACK.
    if (route === this.route) {
      if (this.preview !== undefined) this.requestPreviewBack(this.preview);
      else this.onBack();
    }
    return true;
  }

  private beginPreview(offset: number): void {
    if (this.readerDetailActive || !this.backGestureEnabled || this.reduceMotion || !this.hasDestination || this.viewportWidth <= 0 ||
      this.preview !== undefined || this.activeRouteAnimation !== undefined) return;
    const names = this.pathStack.getAllPathName();
    if (names[names.length - 1] !== this.route) return;
    this.setPendingPushLane(undefined);
    const target = names.length < 2 ? this.rootRoute : names[names.length - 2] as ReaderRouteSurfaceKey;
    const originX = readerTransitionsEnabled() ? readerTransitionActorX(this.getUIContext(),
      readerRouteTransitionLaneId(this.surfaceId, this.route)) : undefined;
    this.preview = { from: this.route, to: target, width: this.viewportWidth, progress: 0, requested: false, originX };
    this.updatePreview(offset);
    this.pathStack.pop(true);
  }

  private updatePreview(offset: number): void {
    const preview = this.preview;
    if (preview === undefined || preview.requested || preview.result !== undefined) return;
    preview.progress = Math.min(1, Math.max(0, offset / preview.width));
    const animation = preview.animation;
    if (animation?.interactiveReady === true && !animation.settled) animation.proxy?.updateTransition?.(preview.progress);
  }

  private endPreview(offset: number): void {
    const preview = this.preview;
    if (preview === undefined) return;
    this.updatePreview(offset);
    if (preview.progress >= READER_ROUTE_EDGE_BACK_COMMIT_FRACTION) this.requestPreviewBack(preview);
    else this.resolvePreview('cancel');
  }

  private requestPreviewBack(preview: ReaderRouteBackPreview): void {
    if (preview.requested || preview.result !== undefined) return;
    if (this.route !== preview.from) { this.resolvePreview('cancel'); return; }
    preview.requested = true;
    let consumed: boolean = false;
    try { consumed = this.onBack(); }
    catch (_error) { this.resolvePreview('cancel'); return; }
    if (!consumed) { this.resolvePreview('cancel'); return; }
    if (this.preview !== preview || !this.mounted) return;
    const resolve = (): void => {
      if (this.preview === preview && preview.result === undefined)
        this.resolvePreview(this.route === preview.to ? 'commit' : 'cancel');
    };
    if (preview.result === undefined) this.armRouteDeadline(PREVIEW_END_TIMEOUT_MS, resolve);
    try {
      const context = this.getUIContext();
      context.postFrameCallback(new ReaderPostLayoutFrame(context, resolve));
    }
    catch (_) { resolve(); }
  }

  private resolvePreview(result: 'commit' | 'cancel'): void {
    const preview = this.preview;
    if (preview === undefined || preview.result !== undefined) return;
    preview.result = result;
    const remaining = (result === 'cancel' ? preview.progress : 1 - preview.progress) * preview.width;
    this.observeRouteMotion(result === 'cancel' ? 'cancel' : 'pop', preview.from, preview.originX, remaining <= 2);
    if (this.mounted) {
      this.armRouteDeadline(PREVIEW_END_TIMEOUT_MS, (): void => {
        if (this.preview !== preview) return;
        if (preview.animation !== undefined) {
          this.settleAnimation(preview.animation, result === 'commit');
          this.completeRouteAnimation(preview.animation, preview);
        } else {
          this.preview = undefined;
          this.hasDestination = this.pathStack.size() > 0;
          this.onRouteChanged();
        }
      });
    }
    this.applyPreviewResult(preview);
  }

  private applyPreviewResult(preview: ReaderRouteBackPreview): void {
    if (preview.animation?.interactiveReady === true && preview.result !== undefined) {
      this.settleAnimation(preview.animation, preview.result === 'commit');
    }
  }

  private observeRouteMotion(action: string, lane: string, routeOriginX?: number, stationary: boolean = false): void {
    if (!readerTransitionsEnabled()) return;
    readerBeginTransition({ kind: 'route', action, subject: lane, scope: `route:${this.surfaceId}`,
      nodes: [readerRouteTransitionLaneId(this.surfaceId, lane)], staticMotion: this.reduceMotion || stationary, routeOriginX });
  }

  @Builder
  private lane(route: ReaderRouteSurfaceKey, lane: string) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.content(route);
      Column().width('100%').height('100%').backgroundColor(Color.Black)
        .opacity(this.laneDimOpacity(lane)).hitTestBehavior(HitTestMode.None)
        .accessibilityLevel('no-hide-descendants');
    }
    .width('100%').height('100%')
    .id(this.laneId(route, lane))
    .backgroundColor(readerAppColor('app.window.background', this.scheme))
    .translate({ x: this.laneX(route, lane) })
    .opacity(this.laneOpacity(route, lane))
    .visibility(route === 'detail' && this.readerDetailScene?.phase === 'retired' ? Visibility.Hidden : Visibility.Visible)
    .enabled(this.laneAcceptsInput(route))
    .hitTestBehavior(this.laneAcceptsInput(route) ? HitTestMode.Default : HitTestMode.None)
    .accessibilityLevel(this.laneAcceptsInput(route) ? 'auto' : 'no-hide-descendants');
  }

  @Builder
  private destination(name: string) {
    NavDestination() {
      this.lane(name as ReaderRouteSurfaceKey, name);
    }
    .backgroundColor(Color.Transparent)
    .hideTitleBar(true)
    .hideToolBar(true)
    .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], this.extendsToWindowEdges ?
      [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM] : [])
    .onBackPressed((): boolean => this.destinationBack(name as ReaderRouteSurfaceKey));
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Navigation(this.pathStack) {
        Stack() {
          ForEach(this.rootTabs(), (route: ReaderRouteSurfaceKey): void => {
            Stack() {
              this.lane(route, ROOT_LANE);
            }.width('100%').height('100%')
              .zIndex(route === this.rootRoute ? 1 : 0)
              .opacity(this.rootTabOpacity(route))
              .scale({ x: this.rootTabScale(route), y: this.rootTabScale(route) })
              .hitTestBehavior(route === this.rootRoute ? HitTestMode.Transparent : HitTestMode.None);
          }, (route: ReaderRouteSurfaceKey): string => route);
        }.width('100%').height('100%');
      }
      .mode(NavigationMode.Stack)
      .hideTitleBar(true)
      .hideToolBar(true)
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], this.extendsToWindowEdges ?
        [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM] : [])
      .navDestination(this.destination)
      .customNavContentTransition((from: NavContentInfo, to: NavContentInfo, operation: NavigationOperation): NavigationAnimatedTransition =>
        this.nativeTransition(from, to, operation))
      .backgroundColor(Color.Transparent)
      .width('100%').height('100%');
      if (this.backGestureEnabled && !this.reduceMotion && this.hasDestination) {
        Row()
          .width(EDGE_WIDTH_VP).height('100%')
          .hitTestBehavior(HitTestMode.Transparent)
          .accessibilityLevel('no-hide-descendants')
          .gesture(PanGesture({ fingers: 1, direction: PanDirection.Right })
            .onActionStart((event: GestureEvent): void => this.beginPreview(event.offsetX))
            .onActionUpdate((event: GestureEvent): void => this.updatePreview(event.offsetX))
            .onActionEnd((event: GestureEvent): void => this.endPreview(event.offsetX))
            .onActionCancel((): void => this.resolvePreview('cancel')));
      }
    }
    .id(this.surfaceId)
    .width('100%').height('100%').clip(true);
  }
}
