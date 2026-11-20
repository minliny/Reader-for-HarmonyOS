import { hilog } from '@kit.PerformanceAnalysisKit';
import { FrameCallback } from '@kit.ArkUI';
import curves from '@ohos.curves';
import { MotionSpecEntry, motionSpecGet } from '../common/MotionSpec';
import { motionSegment, ReversibleMotionTimeline } from '../common/MotionTimeline';
import { readerMotionNowMs } from '../common/ReaderMotionClock';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TYPE_SHELF_CONTINUE_TITLE } from '../common/ReaderTypography';
import { bookshelfMotionTransformAt, BookshelfMotionRequest } from './BookshelfNavigationMotion';
import { BOOKSHELF_COVER_SHADOW_RADIUS, BOOKSHELF_COVER_SHADOW_OFFSET_Y } from './BookshelfCoverVisual';

function navigationMotion(id: string): MotionSpecEntry {
  const entry = motionSpecGet(id);
  if (entry === undefined) throw new Error(`Missing bookshelf motion: ${id}`);
  return entry;
}
const CARRY = navigationMotion('bookshelf.open.carry');
const TURN = navigationMotion('bookshelf.open.turn');
const HANDOFF = navigationMotion('bookshelf.open.handoff');
const FADE = navigationMotion('bookshelf.open.fade');
const TURN_START = CARRY.durationMs / 2;
const COVERED_TIME = CARRY.durationMs;
const HANDOFF_START = TURN_START + TURN.durationMs;
const TOTAL = HANDOFF_START + HANDOFF.durationMs;

interface BookshelfCoverLoad {
  width: number;
  height: number;
}

class BookshelfNavigationFrameCallback extends FrameCallback {
  private readonly callback: () => void;
  constructor(callback: () => void) { super(); this.callback = callback; }
  onFrame(_time: number): void { this.callback(); }
  onIdle(_remaining: number): void {}
}

/** One timeline owns every visual actor; callbacks never own reading state. */
@Component
export struct BookshelfNavigationTransition {
  @Prop @Watch('onRequestChanged') request: BookshelfMotionRequest | undefined = undefined;
  @Prop @Watch('onReduceMotionChanged') reduceMotion: boolean = false;
  // Prop delivery may follow an already queued native frame. Read the owner's
  // current request before that frame can sample or acknowledge an old goal.
  readCurrentRequest: () => BookshelfMotionRequest | undefined = (): BookshelfMotionRequest | undefined => this.request;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  onCovered: (id: number) => void = (_id: number): void => {};
  // The reader remains at its natural layout and scale; its visibility is a
  // track on this actor's clock, guarded by the caller's request identity.
  onReaderOpacity: (id: number, opacity: number) => void = (_id: number, _opacity: number): void => {};
  onFinished: (id: number, reversed: boolean) => void = (_id: number, _reversed: boolean): void => {};

  @State private visible: boolean = false;
  @State private renderedId: number = -1;
  @State private coverUrl: string = '';
  @State private title: string = '';
  @State private paperColor: string = '';
  @State private paperInk: string = '';
  @State private coverFailed: boolean = false;
  // Layout is fixed for one request. Frames update render transforms only.
  @State private layoutWidth: number = 1;
  @State private layoutHeight: number = 1;
  @State private actorScaleX: number = 1;
  @State private actorScaleY: number = 1;
  @State private imageScaleX: number = 1;
  @State private imageScaleY: number = 1;
  @State private titleScaleX: number = 1;
  @State private titleScaleY: number = 1;
  @State private titleLayoutWidth: number = 1;
  @State private titleBaseFont: number = 14;
  @State private clipRadiusX: number = 0;
  @State private clipRadiusY: number = 0;
  @State private shadowRadiusX: number = 0;
  @State private shadowRadiusY: number = 0;
  private actorWidth: number = 1;
  private actorHeight: number = 1;
  private actorRadius: number = 0;
  @State private actorX: number = 0;
  @State private actorY: number = 0;
  @State private actorOpacity: number = 1;
  @State private coverAngle: number = 0;
  @State private shadowScale: number = 0;
  @State private fadeSurface: boolean = false;

  private mounted: boolean = false;
  private generation: number = 0;
  private activeId: number = -1;
  private activeRequest: BookshelfMotionRequest | undefined = undefined;
  private timeline: ReversibleMotionTimeline = new ReversibleMotionTimeline(TOTAL);
  private running: boolean = false;
  private covered: boolean = false;
  private waiting: boolean = false;
  private fading: boolean = false;
  private reversed: boolean = false;
  private readerProgress: number = 0;
  private fadeStartProgress: number = 0;
  private imageAspect: number = 0;

  aboutToAppear(): void { this.mounted = true; this.onRequestChanged(); }
  aboutToDisappear(): void { this.mounted = false; this.clearActor(); }

  private clearActor(): void {
    this.generation += 1;
    this.running = false;
    this.waiting = false;
    this.reversed = false;
    this.activeRequest = undefined;
    this.visible = false;
  }

  private current(token: number): boolean {
    return this.mounted && this.running && token === this.generation &&
      this.activeRequest?.id === this.readCurrentRequest()?.id;
  }

  private traceShelfMotion(phase: string): void {
    try {
      const request = this.activeRequest;
      hilog.info(0x5244, 'ReaderShelfMotion', '%{public}s', JSON.stringify({
        uptimeMs: readerMotionNowMs(), requestId: request?.id ?? -1,
        direction: request?.direction ?? 'none', reversed: request?.reversed === true,
        fadeOnly: request?.fadeOnly === true, reduceMotion: this.reduceMotion,
        phase: phase, terminalGeneration: this.generation,
      }));
    } catch (_) { /* Diagnostics must not affect the actor lifecycle. */ }
  }

  private onRequestChanged(): void {
    if (!this.mounted) return;
    const next = this.readCurrentRequest();
    if (next === undefined) { this.clearActor(); this.activeId = -1; return; }
    if (next.id === this.activeId) {
      if (this.running) {
        this.activeRequest = next;
        this.configureLayout(next);
        if (next.direction === 'open' && next.reversed && !this.reversed && !this.fading) {
          this.reversed = true;
          // Invalidate the queued forward frame without replacing the timeline.
          this.generation += 1;
          this.timeline.retarget(false, readerMotionNowMs());
          this.traceShelfMotion('transition-same-id-retarget');
          this.scheduleFrame(this.generation);
        }
        if (next.direction === 'close' && this.covered && this.waiting && !next.awaitingOrigin) this.resumeReturn();
      }
      return;
    }
    this.clearActor();
    this.activeId = next.id;
    this.activeRequest = next;
    this.covered = false;
    this.renderedId = next.id;
    this.coverUrl = next.origin.coverUrl;
    this.title = next.origin.title;
    this.paperColor = next.paperColor;
    this.paperInk = next.paperInk;
    this.coverFailed = false;
    this.imageAspect = 0;
    this.configureLayout(next);
    this.readerProgress = 0;
    this.fadeStartProgress = 0;
    this.running = true;
    this.visible = true;
    this.fading = this.reduceMotion || next.fadeOnly === true;
    // ArkUI may batch the initial open and its return request before mounting.
    this.reversed = !this.fading && next.direction === 'open' && next.reversed === true;
    this.fadeSurface = this.fading;
    const now = readerMotionNowMs();
    if (this.fading) {
      this.timeline = new ReversibleMotionTimeline(FADE.durationMs);
      this.timeline.retarget(true, now);
      this.sampleFade(0);
    } else {
      this.timeline = new ReversibleMotionTimeline(TOTAL);
      this.timeline.seek(next.direction === 'close' ? TOTAL : 0, now);
      this.timeline.retarget(next.direction === 'open' && !this.reversed, now);
      this.sampleActor(next.direction === 'close' ? TOTAL : 0);
    }
    this.traceShelfMotion('transition-start');
    this.scheduleFrame(this.generation);
  }

  private sampleFade(time: number): void {
    const request = this.activeRequest;
    if (request === undefined) return;
    const p = motionSegment(time, 0, FADE.durationMs, (x: number): number =>
      (FADE.curve as curves.ICurve).interpolate(x));
    const target = request.target;
    this.actorX = target.x; this.actorY = target.y;
    this.actorWidth = target.width; this.actorHeight = target.height;
    this.actorScaleX = 1; this.actorScaleY = 1;
    this.clipRadiusX = 0; this.clipRadiusY = 0;
    this.actorRadius = 0; this.coverAngle = 0;
    this.shadowScale = 0;
    const openProgress = this.fadeStartProgress + (1 - this.fadeStartProgress) * p;
    this.actorOpacity = request.direction === 'open' ? 1 - openProgress : this.covered ? 1 - p : p;
    if (request.direction === 'open') {
      this.readerProgress = openProgress;
      this.onReaderOpacity(request.id, openProgress);
    }
  }

  private sampleActor(time: number): void {
    const request = this.activeRequest;
    if (request === undefined) return;
    const carry = motionSegment(time, 0, CARRY.durationMs, (x: number): number =>
      (CARRY.curve as curves.ICurve).interpolate(x));
    const turn = motionSegment(time, TURN_START, TURN.durationMs, (x: number): number =>
      (TURN.curve as curves.ICurve).interpolate(x));
    const handoff = motionSegment(time, HANDOFF_START, HANDOFF.durationMs, (x: number): number =>
      (HANDOFF.curve as curves.ICurve).interpolate(x));
    const pose = bookshelfMotionTransformAt(request, carry, this.imageAspect);
    const rect = pose.rect;
    this.actorX = rect.x; this.actorY = rect.y;
    this.actorWidth = rect.width; this.actorHeight = rect.height;
    this.actorRadius = request.origin.radius * (1 - carry);
    this.actorScaleX = pose.sx; this.actorScaleY = pose.sy;
    this.imageScaleX = pose.imageScaleX; this.imageScaleY = pose.imageScaleY;
    this.clipRadiusX = pose.radiusX; this.clipRadiusY = pose.radiusY;
    this.coverAngle = -78 * turn - 18 * handoff;
    this.shadowScale = (1 - carry) * Math.max(0, Math.min(1, 1 + this.coverAngle / 45));
    const titleScale = Math.min(48, Math.max(14, rect.width * 0.13)) / this.titleBaseFont;
    this.titleScaleX = titleScale / pose.sx; this.titleScaleY = titleScale / pose.sy;
    this.actorOpacity = 1 - handoff;
    if (request.direction === 'open') {
      this.readerProgress = carry;
      this.onReaderOpacity(request.id, carry);
    }
  }

  private scheduleFrame(token: number): void {
    this.getUIContext().postFrameCallback(new BookshelfNavigationFrameCallback((): void => {
      if (!this.current(token) || this.waiting) return;
      this.onRequestChanged();
      if (!this.current(token) || this.waiting) return;
      const now = readerMotionNowMs();
      const time = this.timeline.sample(now);
      const request = this.activeRequest;
      if (request === undefined) return;
      if (this.fading) {
        this.sampleFade(time);
        if (!this.timeline.running(now)) {
          if (request.direction === 'close' && !this.covered) {
            this.covered = true;
            this.waiting = true;
            this.traceShelfMotion('transition-covered');
            this.onCovered(request.id);
            if (this.current(token) && this.waiting && !this.activeRequest?.awaitingOrigin) this.resumeReturn();
            return;
          }
          this.complete(token);
        } else this.scheduleFrame(token);
        return;
      }
      // The unrotated paper is full-window and opaque here, even though the
      // cover is still turning. Keep it held until the new shelf origin arrives.
      if (request.direction === 'close' && !this.covered && time <= COVERED_TIME) {
        this.timeline.seek(COVERED_TIME, now);
        this.sampleActor(COVERED_TIME);
        this.covered = true;
        this.waiting = true;
        this.traceShelfMotion('transition-covered');
        this.onCovered(request.id);
        if (this.current(token) && this.waiting && !this.activeRequest?.awaitingOrigin) this.resumeReturn();
        return;
      }
      this.sampleActor(time);
      if (this.timeline.running(now)) this.scheduleFrame(token); else this.complete(token);
    }));
  }

  private resumeReturn(): void {
    const request = this.activeRequest;
    if (request === undefined || !this.running || !this.waiting) return;
    this.waiting = false;
    const now = readerMotionNowMs();
    if (this.fading || request.fadeOnly || this.reduceMotion) {
      this.fading = true; this.fadeSurface = true;
      this.timeline = new ReversibleMotionTimeline(FADE.durationMs);
      this.timeline.retarget(true, now);
      this.sampleFade(0);
    } else {
      this.timeline.retarget(false, now);
      this.sampleActor(COVERED_TIME);
    }
    this.scheduleFrame(this.generation);
  }

  private complete(token: number): void {
    if (!this.current(token)) return;
    this.onRequestChanged();
    if (!this.current(token)) return;
    const id = this.activeId;
    const reversed = this.reversed;
    this.traceShelfMotion('transition-finished');
    this.clearActor();
    if (this.mounted && this.readCurrentRequest()?.id === id) this.onFinished(id, reversed);
  }

  private onReduceMotionChanged(): void {
    const request = this.activeRequest;
    if (!this.mounted || !this.reduceMotion || !this.running || request === undefined) return;
    if (this.reversed) return;
    if (this.fading) return;
    this.generation += 1;
    this.fading = true; this.fadeSurface = true;
    // A close that has already handed off must keep its opaque cover until
    // the destination is resolved, even when the accessibility setting flips.
    if (this.covered && this.waiting) {
      this.actorOpacity = 1;
      return;
    }
    this.waiting = false;
    this.timeline = new ReversibleMotionTimeline(FADE.durationMs);
    this.fadeStartProgress = request.direction === 'open' ? this.readerProgress : 0;
    this.timeline.retarget(true, readerMotionNowMs());
    this.sampleFade(0);
    this.scheduleFrame(this.generation);
  }

  private onCoverError(id: number): void {
    if (this.mounted && this.running && id === this.activeId && this.readCurrentRequest()?.id === id) this.coverFailed = true;
  }

  private onCoverLoaded(id: number, width: number, height: number): void {
    if (!this.mounted || !this.running || id !== this.activeId || this.readCurrentRequest()?.id !== id ||
      !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
    this.imageAspect = width / height;
    // A load callback cannot advance a clock whose goal may already have been
    // reversed by the owner. The next frame reconciles it; a held pose is fixed.
    if (!this.fading && this.waiting) this.sampleActor(COVERED_TIME);
  }

  private configureLayout(request: BookshelfMotionRequest): void {
    if (this.layoutWidth !== request.target.width) this.layoutWidth = request.target.width;
    if (this.layoutHeight !== request.target.height) this.layoutHeight = request.target.height;
    const titleWidth = request.origin.rect.width * 0.82;
    if (this.titleLayoutWidth !== titleWidth) this.titleLayoutWidth = titleWidth;
    const font = Math.min(48, Math.max(14, request.origin.rect.width * 0.13));
    if (this.titleBaseFont !== font) this.titleBaseFont = font;
    const radiusX = request.origin.radius * request.target.width / request.origin.rect.width;
    const radiusY = request.origin.radius * request.target.height / request.origin.rect.height;
    if (this.shadowRadiusX !== radiusX) this.shadowRadiusX = radiusX;
    if (this.shadowRadiusY !== radiusY) this.shadowRadiusY = radiusY;
  }

  @Builder
  private CoverContent(id: number) {
    if (this.coverUrl.length > 0 && !this.coverFailed) {
      Image(this.coverUrl).width(this.layoutWidth).height(this.layoutHeight).objectFit(ImageFit.Contain)
        .scale({ x: this.imageScaleX, y: this.imageScaleY })
        .onComplete((event?: BookshelfCoverLoad): void => {
          if (event !== undefined) this.onCoverLoaded(id, event.width, event.height);
        })
        .onError((): void => this.onCoverError(id));
    } else {
      Text(this.title).width(this.titleLayoutWidth)
        .fontFamily(TYPE_SHELF_CONTINUE_TITLE.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_TITLE.fontWeight)
        .fontSize(this.titleBaseFont)
        .fontColor(this.paperInk).textAlign(TextAlign.Center)
        .maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis })
        .scale({ x: this.titleScaleX, y: this.titleScaleY }).renderGroup(true);
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.visible) {
        ForEach([this.renderedId], (id: number): void => {
          Stack({ alignContent: Alignment.TopStart }) {
            // A fixed shadow texture fades; its blur radius is never animated.
            Rect({ width: this.layoutWidth, height: this.layoutHeight,
              radiusWidth: this.shadowRadiusX, radiusHeight: this.shadowRadiusY })
              .fill(this.paperColor)
              .shadow({ radius: BOOKSHELF_COVER_SHADOW_RADIUS,
                color: readerAppColor('app.shadow.cover', this.appThemeScheme),
                offsetX: 0, offsetY: BOOKSHELF_COVER_SHADOW_OFFSET_Y })
              .renderGroup(true).opacity(!this.fadeSurface && this.coverUrl.length > 0 &&
                !this.coverFailed ? this.shadowScale : 0);
            // This face never rotates: the return route handshake is protected
            // by an opaque full-window sheet throughout the origin wait.
            Stack().width(this.layoutWidth).height(this.layoutHeight)
              .backgroundColor(this.paperColor)
              .clipShape(new Rect({ width: this.layoutWidth, height: this.layoutHeight,
                radiusWidth: this.clipRadiusX, radiusHeight: this.clipRadiusY }));
            if (!this.fadeSurface && this.coverAngle > -90) {
              Stack({ alignContent: Alignment.Center }) { this.CoverContent(id); }
                .width(this.layoutWidth).height(this.layoutHeight)
                .backgroundColor(this.paperColor)
                .clipShape(new Rect({ width: this.layoutWidth, height: this.layoutHeight,
                  radiusWidth: this.clipRadiusX, radiusHeight: this.clipRadiusY }))
                .rotate({ x: 0, y: 1, z: 0, angle: this.coverAngle, centerX: 0, centerY: '50%' });
            }
          }
          .width(this.layoutWidth).height(this.layoutHeight)
          .scale({ x: this.actorScaleX, y: this.actorScaleY, centerX: 0, centerY: 0 })
          .translate({ x: this.actorX, y: this.actorY }).opacity(this.actorOpacity);
        }, (id: number): string => id.toString());
      }
    }
    .width('100%').height('100%').clip(true)
    .hitTestBehavior(HitTestMode.None).enabled(false).accessibilityLevel('no-hide-descendants');
  }
}
