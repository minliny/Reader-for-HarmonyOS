import { FrameCallback } from '@kit.ArkUI';
import curves from '@ohos.curves';
import { MotionSpecEntry, motionSpecGet } from '../common/MotionSpec';
import { motionSegment, ReversibleMotionTimeline } from '../common/MotionTimeline';
import { readerMotionNowMs } from '../common/ReaderMotionClock';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TYPE_SHELF_CONTINUE_TITLE } from '../common/ReaderTypography';
import { bookshelfMotionRectAt, BookshelfMotionRequest } from './BookshelfNavigationMotion';
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
const TURN_START = CARRY.durationMs;
const HANDOFF_START = TURN_START + TURN.durationMs;
const TOTAL = HANDOFF_START + HANDOFF.durationMs;

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
  @State private coverAngle: number = 0;
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
  private readerProgress: number = 0;
  private fadeStartProgress: number = 0;

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
    this.clearActor();
    this.activeId = next.id;
    this.activeRequest = next;
    this.covered = false;
    this.renderedId = next.id;
    this.coverUrl = next.origin.coverUrl;
    this.title = next.origin.title;
    this.coverFailed = false;
    this.readerProgress = 0;
    this.fadeStartProgress = 0;
    this.running = true;
    this.visible = true;
    this.fading = this.reduceMotion || next.fadeOnly === true;
    this.fadeSurface = this.fading;
    const now = readerMotionNowMs();
    if (this.fading) {
      this.timeline = new ReversibleMotionTimeline(FADE.durationMs);
      this.timeline.retarget(true, now);
      this.sampleFade(0);
    } else {
      this.timeline = new ReversibleMotionTimeline(TOTAL);
      this.timeline.seek(next.direction === 'close' ? TOTAL : 0, now);
      this.timeline.retarget(next.direction === 'open', now);
      this.sampleActor(next.direction === 'close' ? TOTAL : 0);
    }
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
    this.actorRadius = 0; this.coverAngle = 0;
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
    const rect = bookshelfMotionRectAt(request, carry);
    this.actorX = rect.x; this.actorY = rect.y;
    this.actorWidth = rect.width; this.actorHeight = rect.height;
    this.actorRadius = request.origin.radius * (1 - carry);
    this.coverAngle = -78 * turn - 18 * handoff;
    this.actorOpacity = 1 - handoff;
    if (request.direction === 'open') {
      this.readerProgress = carry;
      this.onReaderOpacity(request.id, carry);
    }
  }

  private scheduleFrame(token: number): void {
    this.getUIContext().postFrameCallback(new BookshelfNavigationFrameCallback((): void => {
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
            this.onCovered(request.id);
            if (this.current(token) && this.waiting && !this.activeRequest?.awaitingTarget) this.resumeReturn();
            return;
          }
          this.complete(token);
        } else this.scheduleFrame(token);
        return;
      }
      // Closing must cover the reader before its route can be changed. Hold
      // precisely at the carry boundary until the new shelf rect is resolved.
      if (request.direction === 'close' && !this.covered && time <= TURN_START) {
        this.timeline.seek(TURN_START, now);
        this.sampleActor(TURN_START);
        this.covered = true;
        this.waiting = true;
        this.onCovered(request.id);
        if (this.current(token) && this.waiting && !this.activeRequest?.awaitingTarget) this.resumeReturn();
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
      this.sampleActor(TURN_START);
    }
    this.scheduleFrame(this.generation);
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
    if (this.mounted && this.running && id === this.activeId) this.coverFailed = true;
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
          .rotate({ x: 0, y: 1, z: 0, angle: this.coverAngle, centerX: 0, centerY: '50%' })
          .translate({ x: this.actorX, y: this.actorY }).opacity(this.actorOpacity);
        }, (id: number): string => id.toString());
      }
    }
    .width('100%').height('100%').clip(true)
    .hitTestBehavior(HitTestMode.None).enabled(false).accessibilityLevel('no-hide-descendants');
  }
}
