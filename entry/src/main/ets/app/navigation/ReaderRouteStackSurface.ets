import type { ReaderRoute, ReaderRouteMotionKind } from './ReaderNavigation';
import { READER_ROUTE_PARENT_DIM, READER_ROUTE_PARENT_PARALLAX, readerRouteTransition } from './ReaderRouteMotion';
import { ReaderPostLayoutFrame } from '../../ui/layout/ReaderPostLayoutFrame';
import { motionAnimateParam, motionSpecGet } from '../../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../../ui/foundation/ReaderMotionPolicy';

const ROOT_LANE = 'reader-route-root';
const EDGE_WIDTH_VP = 18;
const EDGE_BACK_COMMIT_FRACTION = 0.33;

type ReaderRouteSurfaceMotion = ReaderRouteMotionKind | 'none';

interface ReaderRoutePaint {
  from: string;
  to: string;
  motion: ReaderRouteSurfaceMotion;
  fade: boolean;
}

interface ReaderRouteBackPreview {
  from: ReaderRoute;
  to: ReaderRoute;
  width: number;
  progress: number;
  requested: boolean;
  result?: 'commit' | 'cancel';
  proxy?: NavigationTransitionProxy;
}

/** Renders the admitted app route in a native stack. Index owns all Back decisions. */
@Component
export struct ReaderRouteStackSurface {
  @Prop @Watch('onRouteChanged') route: ReaderRoute = 'settings';
  @Prop routeMotion: ReaderRouteSurfaceMotion = 'none';
  @Prop @Watch('onEdgeAvailabilityChanged') reduceMotion: boolean = false;
  @Prop @Watch('onEdgeAvailabilityChanged') viewportWidth: number = 0;
  @Prop @Watch('onEdgeAvailabilityChanged') backGestureEnabled: boolean = false;
  @BuilderParam content: (route: ReaderRoute) => void;
  onBack: () => boolean = (): boolean => false;

  private readonly pathStack: NavPathStack = new NavPathStack();
  @State private rootRoute: ReaderRoute = 'settings';
  @State private hasDestination: boolean = false;
  @State private paint: ReaderRoutePaint | undefined = undefined;
  @State private progress: number = 1;
  private mounted: boolean = false;
  private routeUpdate: number = 0;
  private animationGeneration: number = 0;
  private animationProxy: NavigationTransitionProxy | undefined = undefined;
  private preview: ReaderRouteBackPreview | undefined = undefined;

  aboutToAppear(): void {
    this.mounted = true;
    this.rootRoute = this.route;
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.routeUpdate += 1;
    this.resolvePreview('cancel');
    this.finishRouteAnimation();
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
    const preview = this.preview;
    if (preview !== undefined) {
      if (preview.requested && this.route === preview.to) this.resolvePreview('commit');
      else if (this.route !== preview.from) this.resolvePreview('cancel');
      return;
    }
    const names = this.pathStack.getAllPathName();
    const top = names.length > 0 ? names[names.length - 1] : this.rootRoute;
    if (top === this.route) return;
    this.finishRouteAnimation();
    const animate = this.routeMotion !== 'none';
    if (this.routeMotion === 'tab') {
      this.pathStack.clear(false);
      this.rootRoute = this.route;
    } else if (this.route === this.rootRoute) {
      this.pathStack.clear(animate);
    } else if (this.routeMotion === 'pop') {
      if (names.includes(this.route)) this.pathStack.popToName(this.route, animate);
      else if (names.length > 0) this.pathStack.replacePath({ name: this.route }, animate);
      else this.rootRoute = this.route;
    } else if (names.includes(this.route)) {
      this.pathStack.popToName(this.route, animate);
    } else {
      this.pathStack.pushPath({ name: this.route }, animate);
    }
    this.hasDestination = this.pathStack.size() > 0;
  }

  private finishRouteAnimation(): void {
    this.animationGeneration += 1;
    const proxy = this.animationProxy;
    this.animationProxy = undefined;
    this.paint = undefined;
    proxy?.finishTransition();
  }

  private nativeTransition(from: NavContentInfo, to: NavContentInfo, operation: NavigationOperation): NavigationAnimatedTransition {
    const ticket = ++this.animationGeneration;
    const preview = operation === NavigationOperation.POP && from.name === this.preview?.from ? this.preview : undefined;
    const motion: ReaderRouteSurfaceMotion = operation === NavigationOperation.POP || this.routeMotion === 'pop' ?
      'pop' : this.routeMotion === 'tab' ? 'tab' : 'push';
    const id = motion === 'pop' ? 'app.navigation.pop' : motion === 'tab' ? 'app.navigation.tab' : 'app.navigation.push';
    const fade = this.reduceMotion || motion === 'tab';
    const duration = this.reduceMotion ? motionSpecGet('app.motion.reduced.fade')?.durationMs : motionSpecGet(id)?.durationMs;
    return {
      isInteractive: preview !== undefined,
      timeout: preview === undefined && duration !== undefined ? duration + 300 : undefined,
      transition: (proxy: NavigationTransitionProxy): void => {
        if (!this.mounted || ticket !== this.animationGeneration) {
          if (preview !== undefined && proxy.cancelTransition !== undefined) proxy.cancelTransition();
          else proxy.finishTransition();
          return;
        }
        this.animationProxy = preview === undefined ? proxy : undefined;
        this.paint = { from: from.name ?? ROOT_LANE, to: to.name ?? ROOT_LANE, motion, fade };
        this.progress = 0;
        if (preview !== undefined) preview.proxy = proxy;
        const finish = (): void => {
          if (preview === undefined && this.animationProxy === proxy) proxy.finishTransition();
        };
        const parameters = this.reduceMotion ? readerMotionReducedFadeParam(finish) : motionAnimateParam(id, finish);
        // Native interactive progress must map directly to pointer distance.
        if (preview !== undefined) parameters.curve = Curve.Linear;
        this.getUIContext().animateTo(parameters, (): void => { this.progress = 1; });
        if (preview !== undefined) {
          proxy.updateTransition?.(preview.progress);
          this.applyPreviewResult(preview);
        }
      },
      onTransitionEnd: (_success: boolean): void => {
        if (!this.mounted || ticket !== this.animationGeneration) return;
        this.animationProxy = undefined;
        this.paint = undefined;
        if (preview !== undefined && this.preview === preview) {
          this.preview = undefined;
          this.hasDestination = this.pathStack.size() > 0;
          this.onRouteChanged();
        }
      },
    };
  }

  private laneX(lane: string): number {
    const paint = this.paint;
    if (paint === undefined || paint.fade) return 0;
    const width = Math.max(0, this.viewportWidth);
    if (paint.motion === 'pop') {
      if (lane === paint.from) return width * this.progress;
      if (lane === paint.to) return -width * READER_ROUTE_PARENT_PARALLAX * (1 - this.progress);
    } else {
      if (lane === paint.from) return -width * READER_ROUTE_PARENT_PARALLAX * this.progress;
      if (lane === paint.to) return width * (1 - this.progress);
    }
    return 0;
  }

  private laneBrightness(lane: string): number {
    const paint = this.paint;
    if (paint === undefined || paint.fade) return 1;
    return paint.motion === 'pop' ?
      (lane === paint.to ? 1 - READER_ROUTE_PARENT_DIM * (1 - this.progress) : 1) :
      (lane === paint.from ? 1 - READER_ROUTE_PARENT_DIM * this.progress : 1);
  }

  private laneOpacity(lane: string): number {
    return this.paint?.fade === true && lane === this.paint.to ? this.progress : 1;
  }

  private destinationBack(route: ReaderRoute): boolean {
    // Consume the platform pop only on the active destination. No automatic
    // native pop may retire a route while Index handles a modal or an exit ACK.
    if (route === this.route) {
      if (this.preview !== undefined) this.requestPreviewBack(this.preview);
      else this.onBack();
    }
    return true;
  }

  private beginPreview(offset: number): void {
    if (!this.backGestureEnabled || this.reduceMotion || !this.hasDestination || this.viewportWidth <= 0 ||
      this.preview !== undefined || this.paint !== undefined) return;
    const names = this.pathStack.getAllPathName();
    if (names[names.length - 1] !== this.route) return;
    const target = names.length < 2 ? this.rootRoute : names[names.length - 2] as ReaderRoute;
    this.preview = { from: this.route, to: target, width: this.viewportWidth, progress: 0, requested: false };
    this.updatePreview(offset);
    this.pathStack.pop(true);
  }

  private updatePreview(offset: number): void {
    const preview = this.preview;
    if (preview === undefined || preview.requested || preview.result !== undefined) return;
    preview.progress = Math.min(1, Math.max(0, offset / preview.width));
    preview.proxy?.updateTransition?.(preview.progress);
  }

  private endPreview(offset: number): void {
    const preview = this.preview;
    if (preview === undefined) return;
    this.updatePreview(offset);
    if (preview.progress >= EDGE_BACK_COMMIT_FRACTION) this.requestPreviewBack(preview);
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
    const context = this.getUIContext();
    context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
      if (this.preview === preview && preview.result === undefined)
        this.resolvePreview(this.route === preview.to ? 'commit' : 'cancel');
    }));
  }

  private resolvePreview(result: 'commit' | 'cancel'): void {
    const preview = this.preview;
    if (preview === undefined || preview.result !== undefined) return;
    preview.result = result;
    this.applyPreviewResult(preview);
  }

  private applyPreviewResult(preview: ReaderRouteBackPreview): void {
    if (preview.proxy === undefined || preview.result === undefined) return;
    if (preview.result === 'commit') preview.proxy.finishTransition();
    else preview.proxy.cancelTransition?.();
  }

  @Builder
  private lane(route: ReaderRoute, lane: string) {
    Stack({ alignContent: Alignment.TopStart }) {
      this.content(route);
    }
    .width('100%').height('100%')
    .translate({ x: this.laneX(lane) }).brightness(this.laneBrightness(lane))
    .opacity(this.laneOpacity(lane))
    .enabled(route === this.route)
    .hitTestBehavior(route === this.route ? HitTestMode.Default : HitTestMode.None)
    .accessibilityLevel(route === this.route ? 'auto' : 'no-hide-descendants');
  }

  @Builder
  private destination(name: string) {
    NavDestination() {
      this.lane(name as ReaderRoute, name);
    }
    .hideTitleBar(true)
    .onBackPressed((): boolean => this.destinationBack(name as ReaderRoute));
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Navigation(this.pathStack) {
        ForEach([this.rootRoute], (route: ReaderRoute): void => {
          Stack() {
            this.lane(route, ROOT_LANE);
          }
          .width('100%').height('100%')
          .transition(TransitionEffect.asymmetric(
            readerRouteTransition('tab', 0, this.reduceMotion), TransitionEffect.IDENTITY));
        }, (route: ReaderRoute): string => route);
      }
      .mode(NavigationMode.Stack)
      .hideTitleBar(true)
      .navDestination(this.destination)
      .customNavContentTransition((from: NavContentInfo, to: NavContentInfo, operation: NavigationOperation): NavigationAnimatedTransition =>
        this.nativeTransition(from, to, operation))
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
    .id('reader-route-stack-surface')
    .width('100%').height('100%').clip(true);
  }
}
