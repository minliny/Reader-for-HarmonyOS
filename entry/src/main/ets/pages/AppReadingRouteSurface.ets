import type { AnimatorResult } from '@ohos.animator';
import { RetainedReaderScene, type RetainedReaderScenePorts } from '../app/composition/RetainedReaderScene';
import { readerSceneTransition } from '../app/navigation/ReaderRouteMotion';
import { ReaderDetailSceneTransition, READER_RETAINED_DETAIL_LANE, READER_ROUTE_PARENT_DIM, readerConditionalSceneMotion,
  readerRouteMotionPose, type ReaderDetailSceneSnapshot } from '../app/navigation/ReaderRouteMotionModel';
import type { DirectoryReturnTarget, ReaderRoute } from '../app/navigation/ReaderNavigation';
import { retainedReaderRoute } from '../app/navigation/ReaderNavigation';
import type { ReadingCommitPresentation } from '../features/reading/presentation/ReadingCommitPresentation';
import type { ReadingEntryPresentation } from '../features/reading/presentation/ReadingEntryPresentation';
import type { MangaSourceSwitchPresentation } from '../features/manga/presentation/MangaSourceSwitchPresentation';
import type { SourceSwitchPresentation } from '../features/source/presentation/SourceSwitchPresentation';
import { ReaderPostLayoutFrame } from '../ui/layout/ReaderPostLayoutFrame';
import { motionSpecGet, readerMotionStandardCurve } from '../ui/foundation/MotionSpec';
import { readerMotionReducedFadeParam } from '../ui/foundation/ReaderMotionPolicy';
import { readerBeginTransition, readerRouteTransitionLaneId, readerTransitionActorX,
  readerTransitionsEnabled, READER_DETAIL_PRIMARY_ACTION, READER_DETAIL_TRANSITION_HEADER }
  from '../ui/foundation/ReaderTransitionSignals';

const DETAIL_NATIVE_FRAME_GRACE_MS = 300;

export interface AppReadingDetailMotionPorts {
  readonly current: () => ReaderDetailSceneSnapshot | undefined;
  readonly publish: (snapshot: ReaderDetailSceneSnapshot | undefined) => void;
  readonly ui: () => UIContext;
  readonly reduceMotion: () => boolean;
  readonly foreground: () => boolean;
  readonly viewportWidth: () => number;
  readonly canPreview: () => boolean;
  readonly bookKey: () => string | undefined;
  readonly back: () => boolean;
}

/** Owns native animation and its cancellation for the detail above the retained reader. */
export class AppReadingDetailMotion {
  private readonly transition: ReaderDetailSceneTransition = new ReaderDetailSceneTransition();
  private book: string = '';
  private animator: AnimatorResult | undefined;
  private deadline: number = -1;
  private backOriginX: number | undefined;

  private readonly ports: AppReadingDetailMotionPorts;

  constructor(ports: AppReadingDetailMotionPorts) {
    this.ports = ports;
  }

  matchesBook(): boolean {
    return this.book === this.ports.bookKey();
  }

  open(): void {
    this.book = this.ports.bookKey() ?? '';
    this.ports.publish(this.transition.open(true));
  }

  back(): void {
    if (this.ports.current() === undefined) {
      this.book = this.ports.bookKey() ?? '';
      this.transition.open(false);
    }
    this.ports.publish(this.transition.back());
  }

  clear(): void {
    this.transition.clear();
    this.stop();
    this.ports.publish(undefined);
    this.book = '';
  }

  viewportChanged(): void {
    if (this.ports.current()?.phase === 'preview' &&
      !this.transition.previewViewportMatches(this.ports.viewportWidth())) this.cancelPreview();
  }

  motionPolicyChanged(): void {
    this.settleActive();
  }

  foregroundLost(): void {
    this.settleActive();
  }

  private settleActive(): void {
    const scene = this.ports.current();
    if (scene !== undefined && scene.phase !== 'covered' && scene.phase !== 'retired') {
      this.ports.publish(this.transition.settle(scene.generation));
      this.stop();
    }
  }

  private stop(): void {
    if (this.deadline >= 0) clearTimeout(this.deadline);
    this.deadline = -1;
    const animator = this.animator;
    this.animator = undefined;
    try { animator?.cancel(); }
    catch (_error) { /* A completed native animator is already retired. */ }
  }

  animate(nativePoseReady: boolean = false): void {
    this.stop();
    const motion = this.ports.current();
    if (motion === undefined || motion.phase === 'preview' || motion.phase === 'cancel-pending' ||
      motion.phase === 'covered' ||
      motion.phase === 'retired') return;
    const target = motion.phase === 'pop' ? 0 : 1;
    const distance = Math.abs(target - motion.coverage);
    if (motion.phase === 'cancel') this.observe('cancel', distance < .001);
    const current = (): boolean => this.transition.snapshot()?.generation === motion.generation;
    const finish = (): void => {
      if (!current()) return;
      this.ports.publish(this.transition.settle(motion.generation));
      this.stop();
    };
    const id = this.ports.reduceMotion() ? 'app.motion.reduced.fade' :
      motion.phase === 'pop' ? 'app.navigation.pop' : 'app.navigation.push';
    if (distance < .001 || !this.ports.foreground()) {
      if (motion.phase === 'pop') this.observe('pop', distance < .001);
      finish();
      return;
    }
    const duration = Math.max(1, Math.round((motionSpecGet(id)?.durationMs ?? 200) * distance));
    const context = this.ports.ui();
    const reduced = this.ports.reduceMotion();
    this.deadline = setTimeout(finish, duration + DETAIL_NATIVE_FRAME_GRACE_MS);
    const start = (): void => {
      if (!current()) return;
      if (motion.phase === 'push' && readerTransitionsEnabled()) {
        this.observe('push');
        // Both real detail anchors may move horizontally with this route.
        // Their vertical geometry and size must settle without a jump.
        readerBeginTransition({ kind: 'surface', action: 'mount', subject: 'reader-detail',
          scope: 'reader-detail-anchors', nodes: [READER_DETAIL_TRANSITION_HEADER, READER_DETAIL_PRIMARY_ACTION], axis: 'x' });
      }
      try {
        if (readerTransitionsEnabled()) {
          const animator = context.createAnimator({ duration, easing: reduced ? 'ease-out' : 'linear',
            delay: 0, fill: 'forwards', direction: 'normal', iterations: 1, begin: 0, end: 1 });
          this.animator = animator;
          animator.onFrame = (fraction: number): void => {
            if (this.animator !== animator || !current()) return;
            const progress = reduced ? fraction : readerMotionStandardCurve().interpolate(fraction);
            this.ports.publish(this.transition.sample(motion.generation, progress));
          };
          animator.onFinish = (): void => {
            if (this.animator === animator) finish();
          };
          // Queue the first detail sample before native playback queues movement.
          if (motion.phase === 'pop') this.observe('pop');
          animator.play();
        } else {
          context.animateTo({
            duration,
            curve: reduced ? readerMotionReducedFadeParam(finish).curve : readerMotionStandardCurve(),
            onFinish: finish,
          }, (): void => {
            if (current()) this.ports.publish(this.transition.sample(motion.generation, 1));
          });
        }
      } catch (_error) { finish(); }
    };
    if (nativePoseReady) start();
    else {
      // A freshly pushed detail and a restored reader receive native layout before motion.
      try { context.postFrameCallback(new ReaderPostLayoutFrame(context, start)); }
      catch (_error) { finish(); }
    }
  }

  private observe(action: string, stationary: boolean = false): void {
    if (!readerTransitionsEnabled()) return;
    readerBeginTransition({ kind: 'route', action, subject: 'reader-detail', scope: 'reader-detail',
      nodes: [readerRouteTransitionLaneId('reader-app-route-stack', READER_RETAINED_DETAIL_LANE)],
      staticMotion: stationary || this.ports.reduceMotion(), routeOriginX: this.backOriginX });
  }

  beginPreview(offset: number): void {
    if (!this.ports.canPreview()) return;
    const preview = this.transition.preview(this.ports.viewportWidth());
    if (preview === undefined) return;
    this.backOriginX = readerTransitionsEnabled() ? readerTransitionActorX(this.ports.ui(),
      readerRouteTransitionLaneId('reader-app-route-stack', READER_RETAINED_DETAIL_LANE)) : undefined;
    this.observe('preview');
    this.ports.publish(this.transition.updatePreview(preview.generation, offset));
  }

  updatePreview(offset: number): void {
    const scene = this.ports.current();
    if (scene?.phase === 'preview') this.ports.publish(this.transition.updatePreview(scene.generation, offset));
  }

  endPreview(offset: number): void {
    this.updatePreview(offset);
    if (this.transition.shouldCommitPreview()) this.ports.back();
    this.cancelPreview();
  }

  cancelPreview(): void {
    const released = this.transition.requestPreviewCancel();
    if (released === undefined) return;
    this.stop();
    this.ports.publish(released);
    const settle = (): void => {
      if (this.transition.snapshot()?.generation === released.generation) this.settleActive();
    };
    if (!this.ports.foreground()) { settle(); return; }
    const context = this.ports.ui();
    this.deadline = setTimeout(settle, DETAIL_NATIVE_FRAME_GRACE_MS);
    // Keep the last touch pose through native layout before the return takes ownership.
    try {
      context.postFrameCallback(new ReaderPostLayoutFrame(context, (): void => {
        if (!this.ports.foreground()) { settle(); return; }
        const cancel = this.transition.beginPreviewCancel(released.generation);
        if (cancel === undefined) return;
        this.ports.publish(cancel);
        this.animate(true);
      }));
    } catch (_error) { settle(); }
  }
}

export interface AppReadingRouteSurfaceInput {
  readonly reading: ReadingEntryPresentation;
  readonly commits: ReadingCommitPresentation;
  readonly source: SourceSwitchPresentation;
  readonly manga: MangaSourceSwitchPresentation;
  readonly route: ReaderRoute;
  readonly directoryTarget: DirectoryReturnTarget;
  readonly detail: ReaderDetailSceneSnapshot | undefined;
  readonly detailMatchesBook: () => boolean;
  readonly detailAboveReader: boolean;
  readonly foreground: boolean;
  readonly covered: boolean;
  readonly expanded: boolean;
  readonly reduceMotion: boolean;
  readonly viewportWidth: number;
  readonly ports: () => RetainedReaderScenePorts;
  readonly backGestureEnabled: boolean;
  readonly detailMotion: AppReadingDetailMotion;
}

@Builder
export function AppReadingRouteSurface($$: AppReadingRouteSurfaceInput) {
  Stack({ alignContent: Alignment.TopStart }) {
    if (($$.reading.sessionActive || ($$.detail !== undefined && $$.detailMatchesBook())) &&
      $$.reading.book !== undefined) {
      RetainedReaderScene({
        reading: $$.reading, commits: $$.commits, source: $$.source, manga: $$.manga,
        visibleRoute: $$.detail !== undefined ? 'reading' : retainedReaderRoute($$.route, $$.directoryTarget),
        ownsWindowChrome: retainedReaderRoute($$.route, $$.directoryTarget) !== undefined && $$.detail === undefined,
        expandedLayout: $$.expanded, reduceMotion: $$.reduceMotion,
        inputAllowed: $$.reading.sessionActive && $$.foreground && !$$.covered && $$.detail === undefined,
        ports: $$.ports(),
      }).id(readerTransitionsEnabled() ? 'reader-transition-retained-scene' : undefined)
        .transition(readerSceneTransition($$.viewportWidth, $$.reduceMotion,
          readerConditionalSceneMotion($$.foreground, $$.detail !== undefined).enter === 'push'));
      if ($$.detail !== undefined) {
        Column().width('100%').height('100%').backgroundColor(Color.Black)
          .opacity($$.reduceMotion ? 0 : $$.detail.coverage * READER_ROUTE_PARENT_DIM)
          .hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
      }
    }
  }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent)
    .translate({ x: readerRouteMotionPose('push', 'parent', $$.viewportWidth,
      $$.detail?.coverage ?? 0, $$.reduceMotion) })
    .zIndex($$.detailAboveReader ? 0 : 1);
  if ($$.backGestureEnabled) {
    Row().width(18).height('100%').zIndex(2)
      .hitTestBehavior(HitTestMode.Transparent).accessibilityLevel('no-hide-descendants')
      .gesture(PanGesture({ fingers: 1, direction: PanDirection.Right })
        .onActionStart((event: GestureEvent): void => $$.detailMotion.beginPreview(event.offsetX))
        .onActionUpdate((event: GestureEvent): void => $$.detailMotion.updatePreview(event.offsetX))
        .onActionEnd((event: GestureEvent): void => $$.detailMotion.endPreview(event.offsetX))
        .onActionCancel((): void => $$.detailMotion.cancelPreview()));
  }
}
