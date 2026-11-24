import { FrameCallback } from '@kit.ArkUI';
import curves from '@ohos.curves';
import { readerMotionStandardCurve } from '../../../ui/foundation/MotionSpec';
import { motionSegment, ReversibleMotionTimeline } from '../../../ui/foundation/MotionTimeline';
import { READER_BOOK_CLOSE_MS, READER_BOOK_OPEN_MS, READER_REDUCED_FADE_MS } from '../../../ui/foundation/ProductMotionTiming';
import { readerMotionNowMs } from '../../../ui/foundation/ReaderMotionClock';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { TYPE_SHELF_CONTINUE_TITLE } from '../../../ui/foundation/ReaderTypography';
import { bookshelfMotionPaint, BookshelfMotionRequest } from '../presentation/BookshelfNavigationMotion';
import { BOOKSHELF_COVER_SHADOW_RADIUS, BOOKSHELF_COVER_SHADOW_OFFSET_Y } from './BookshelfCoverVisual';

const CARRY = readerMotionStandardCurve();
const SPINE = curves.cubicBezierCurve(0.22, 0.88, 0.26, 1);
const FADE = curves.cubicBezierCurve(0, 0, 0.58, 1);
const COVER_PERSPECTIVE_VP = 1400;
// Change the route while the paper plane covers the reader. The live shelf
// can measure the landing while the remaining close clock is still running.
const CLOSE_HANDOFF_FRACTION = 0.28;

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
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  onCovered: (id: number) => void = (_id: number): void => {};
  // The reader remains at its natural layout and scale; its visibility is a
  // track on this actor's clock, guarded by the caller's request identity.
  onReaderOpacity: (id: number, opacity: number) => void = (_id: number, _opacity: number): void => {};
  onShelfPaint: (id: number, opacity: number, scale: number, brightness: number) => void =
    (_id: number, _opacity: number, _scale: number, _brightness: number): void => {};
  onFinished: (id: number) => void = (_id: number): void => {};

  @State private visible: boolean = false;
  @State private renderedId: number = -1;
  @State private coverUrl: string = '';
  @State private title: string = '';
  @State private coverFailed: boolean = false;
  @State private actorWidth: number = 1;
  @State private actorHeight: number = 1;
  @State private actorX: number = 0;
  @State private actorY: number = 0;
  @State private actorRadius: number = 0;
  @State private actorOpacity: number = 1;
  @State private curtainOpacity: number = 0;
  @State private curtainWidth: number = 0;
  @State private curtainHeight: number = 0;
  @State private curtainX: number = 0;
  @State private curtainY: number = 0;
  @State private coverAngle: number = 0;
  @State private fadeSurface: boolean = false;

  private mounted: boolean = false;
  private generation: number = 0;
  private activeId: number = -1;
  private activeRequest: BookshelfMotionRequest | undefined = undefined;
  private duration: number = READER_BOOK_OPEN_MS;
  private timeline: ReversibleMotionTimeline = new ReversibleMotionTimeline(READER_BOOK_OPEN_MS);
  private running: boolean = false;
  private covered: boolean = false;
  private waiting: boolean = false;
  private fading: boolean = false;
  private readerProgress: number = 0;
  private fadeStartProgress: number = 0;
  private sampledPhase: number = 0;

  aboutToAppear(): void { this.mounted = true; this.onRequestChanged(); }
  aboutToDisappear(): void { this.mounted = false; this.clearActor(); }

  private clearActor(): void {
    this.generation += 1;
    this.running = false;
    this.waiting = false;
    this.activeRequest = undefined;
    this.visible = false;
  }

  private current(token: number): boolean {
    return this.mounted && this.running && token === this.generation &&
      this.activeRequest?.id === this.request?.id;
  }

  private onRequestChanged(): void {
    if (!this.mounted) return;
    const next = this.request;
    if (next === undefined) { this.clearActor(); this.activeId = -1; return; }
    if (next.id === this.activeId) {
      if (this.running) {
        this.activeRequest = next;
        if (next.direction === 'close' && this.covered && this.waiting && !next.awaitingTarget) this.resumeReturn();
      }
      return;
    }
    const now = readerMotionNowMs();
    const preceding = this.activeRequest;
    const reverse = this.running && !this.fading && preceding !== undefined && preceding.direction !== next.direction &&
      preceding.origin.sourceId === next.origin.sourceId && preceding.origin.bookId === next.origin.bookId;
    const reversedPosition = reverse ? next.direction === 'open' ? this.sampledPhase : 1 - this.sampledPhase : 0;
    this.clearActor();
    this.activeId = next.id;
    this.activeRequest = next;
    this.covered = false;
    if (!reverse) this.renderedId = next.id;
    this.coverUrl = next.origin.coverUrl;
    this.title = next.origin.title;
    if (!reverse) this.coverFailed = false;
    this.readerProgress = 0;
    this.fadeStartProgress = 0;
    this.curtainOpacity = 0;
    this.running = true;
    this.visible = true;
    this.fading = this.reduceMotion || next.fadeOnly === true;
    this.fadeSurface = this.fading;
    this.duration = this.fading ? READER_REDUCED_FADE_MS :
      next.direction === 'open' ? READER_BOOK_OPEN_MS : READER_BOOK_CLOSE_MS;
    this.timeline = new ReversibleMotionTimeline(this.duration);
    const position = this.fading ? 0 : reversedPosition * this.duration;
    this.timeline.seek(position, now);
    this.timeline.retarget(true, now);
    this.sample(position);
    this.scheduleFrame(this.generation);
  }

  private closeHandoffTime(): number {
    return this.duration * (this.fading ? 0.5 : CLOSE_HANDOFF_FRACTION);
  }

  private sampleCurtain(request: BookshelfMotionRequest, time: number): void {
    const handoff = this.closeHandoffTime();
    const easeOut = (value: number): number => FADE.interpolate(value);
    const ramp = motionSegment(time, 0, handoff, easeOut);
    this.curtainOpacity = !this.covered ? ramp :
      1 - motionSegment(time, handoff, this.duration - handoff, easeOut);
    this.curtainX = request.target.x; this.curtainY = request.target.y;
    this.curtainWidth = request.target.width; this.curtainHeight = request.target.height;
  }

  private sample(time: number): void {
    const request = this.activeRequest;
    if (request === undefined) return;
    if (request.direction === 'close') this.sampleCurtain(request, time);
    if (this.fadeSurface) {
      this.actorOpacity = 0;
      if (request.direction === 'open') {
        const p = motionSegment(time, 0, this.duration, (value: number): number => FADE.interpolate(value));
        this.readerProgress = this.fadeStartProgress + (1 - this.fadeStartProgress) * p;
        this.onReaderOpacity(request.id, this.readerProgress);
        this.onShelfPaint(request.id, 1, 1, 1);
      }
      return;
    }
    this.sampledPhase = request.direction === 'open' ? time / this.duration : 1 - time / this.duration;
    const paint = bookshelfMotionPaint(request, this.sampledPhase,
      (value: number): number => CARRY.interpolate(value), (value: number): number => SPINE.interpolate(value));
    this.actorX = paint.rect.x; this.actorY = paint.rect.y;
    this.actorWidth = paint.rect.width; this.actorHeight = paint.rect.height;
    this.actorRadius = paint.radius;
    this.coverAngle = paint.angle;
    this.actorOpacity = paint.coverOpacity;
    if (request.direction === 'open') {
      this.readerProgress = paint.readerOpacity;
      this.onReaderOpacity(request.id, paint.readerOpacity);
      this.onShelfPaint(request.id, paint.shelfOpacity, paint.shelfScale, paint.shelfBrightness);
    }
  }

  private scheduleFrame(token: number): void {
    this.getUIContext().postFrameCallback(new BookshelfNavigationFrameCallback((): void => {
      if (!this.current(token) || this.waiting) return;
      const now = readerMotionNowMs();
      const time = this.timeline.sample(now);
      const request = this.activeRequest;
      if (request === undefined) return;
      this.sample(time);
      if (request.direction === 'close' && !this.covered && time >= this.closeHandoffTime()) {
        this.covered = true;
        this.waiting = true;
        this.onCovered(request.id);
        if (this.current(token) && this.waiting && !this.activeRequest?.awaitingTarget) this.resumeReturn();
        return;
      }
      if (this.timeline.running(now)) this.scheduleFrame(token); else this.complete(token);
    }));
  }

  private resumeReturn(): void {
    const request = this.activeRequest;
    if (request === undefined || !this.running || !this.waiting) return;
    this.waiting = false;
    this.fadeSurface = this.fading || request.fadeOnly === true;
    const now = readerMotionNowMs();
    const token = this.generation;
    this.sample(this.timeline.sample(now));
    if (this.timeline.running(now)) this.scheduleFrame(token); else this.complete(token);
  }

  private complete(token: number): void {
    if (!this.current(token)) return;
    const id = this.activeId;
    this.clearActor();
    if (this.mounted && this.request?.id === id) this.onFinished(id);
  }

  private onReduceMotionChanged(): void {
    const request = this.activeRequest;
    if (!this.mounted || !this.reduceMotion || !this.running || request === undefined) return;
    if (this.fading) return;
    this.generation += 1;
    this.fading = true; this.fadeSurface = true;
    // A close that has already handed off must keep its opaque cover until
    // the destination is resolved, even when the accessibility setting flips.
    if (this.covered && this.waiting) {
      this.actorOpacity = 0;
      this.curtainOpacity = 1;
      this.duration = READER_REDUCED_FADE_MS;
      this.timeline = new ReversibleMotionTimeline(this.duration);
      const now = readerMotionNowMs();
      this.timeline.seek(this.closeHandoffTime(), now);
      this.timeline.retarget(true, now);
      return;
    }
    this.waiting = false;
    this.duration = READER_REDUCED_FADE_MS;
    this.timeline = new ReversibleMotionTimeline(this.duration);
    this.fadeStartProgress = request.direction === 'open' ? this.readerProgress : 0;
    const now = readerMotionNowMs();
    if (this.covered) this.timeline.seek(this.closeHandoffTime(), now);
    this.timeline.retarget(true, now);
    this.sample(this.timeline.sample(now));
    this.scheduleFrame(this.generation);
  }

  private onCoverError(id: number): void {
    if (this.mounted && this.running && id === this.renderedId) this.coverFailed = true;
  }

  @Builder
  private CoverContent(id: number) {
    if (this.coverUrl.length > 0 && !this.coverFailed) {
      Image(this.coverUrl).width('100%').height('100%').objectFit(ImageFit.Cover)
        .onError((): void => this.onCoverError(id));
    } else {
      Text(this.title).width('82%')
        .fontFamily(TYPE_SHELF_CONTINUE_TITLE.fontFamily).fontWeight(TYPE_SHELF_CONTINUE_TITLE.fontWeight)
        .fontSize(Math.min(48, Math.max(14, this.actorWidth * 0.13)))
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).textAlign(TextAlign.Center)
        .maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis });
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.visible) {
        if (this.curtainOpacity > 0) {
          Blank().width(this.curtainWidth).height(this.curtainHeight)
            .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
            .translate({ x: this.curtainX, y: this.curtainY }).opacity(this.curtainOpacity);
        }
        ForEach([this.renderedId], (id: number): void => {
          Stack({ alignContent: Alignment.Center }) {
            // The neutral paper is the inner face after the cover crosses the
            // hinge; at -90 degrees the face swap has no projected width.
            if (!this.fadeSurface && this.coverAngle > -90) this.CoverContent(id);
          }
          .width(this.actorWidth).height(this.actorHeight)
          .backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme))
          .borderRadius(this.actorRadius).clip(true).renderGroup(true)
          .shadow({ radius: !this.fadeSurface && this.coverUrl.length > 0 && !this.coverFailed ?
            BOOKSHELF_COVER_SHADOW_RADIUS : 0, color: readerAppColor('app.shadow.cover', this.appThemeScheme),
            offsetX: 0, offsetY: BOOKSHELF_COVER_SHADOW_OFFSET_Y })
          .rotate({ x: 0, y: 1, z: 0, angle: this.coverAngle, centerX: 0, centerY: '50%',
            perspective: -this.getUIContext().vp2px(COVER_PERSPECTIVE_VP) })
          .translate({ x: this.actorX, y: this.actorY }).opacity(this.fadeSurface ? 0 : this.actorOpacity);
        }, (id: number): string => id.toString());
      }
    }
    .width('100%').height('100%').clip(true)
    .hitTestBehavior(HitTestMode.None).enabled(false).accessibilityLevel('no-hide-descendants');
  }
}
