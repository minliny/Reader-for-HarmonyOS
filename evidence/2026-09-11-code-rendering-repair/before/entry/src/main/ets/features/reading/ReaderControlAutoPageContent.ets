import { PathShape } from '@ohos.arkui.shape';
import { sampleReaderControlMotionPresentation, readerControlMotionClipRects, readerControlMotionClipPath,
  type ReaderControlMotionPresentation, type ReaderControlMotionClipRect } from './ReaderControlMotionPresentation';
import { createReaderControlMorphScroll, advanceReaderControlMorphScroll, observeReaderControlMorphScroll,
  readerControlMorphScrollTranslation, readerControlMorphScrollExtent, readerControlMorphScrollAllowsNative,
  type ReaderControlMorphScrollState } from './ReaderControlMorphScroll';
import { TOK_BORDER_W, TOK_LINE, TOK_READ_ELEVATED, TOK_READ_INK, TOK_READ_MUTED,
  TOK_READ_PRIMARY, TOK_READ_SURFACE, TOK_SURFACE_PANEL, TOK_SURFACE_PANEL_SOFT } from '../common/ReaderTokens';
import type { ReaderAutoPageStatus } from './ReaderAutoPageState';
import {
  READER_AUTO_PAGE_FULL_MAX_MINUTES, READER_AUTO_PAGE_FULL_MAX_SECONDS,
  READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS, READER_AUTO_PAGE_FULL_MIN_MINUTES,
  READER_AUTO_PAGE_FULL_MIN_SECONDS, READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS,
} from './ReaderAutoPageFullState';
import type { ReaderControlForm } from './ReaderControlSessionState';
import { readerSessionMorphActorId, type ReaderSessionMorphSourceKind } from './ReaderSessionMorphState';
import { readerControlUnit, type ReaderControlActorFrame } from './ReaderControlActorGeometry';
import {
  sampleReaderControlAutoPage, readerControlPlaybackSourceKind, readerControlPlaybackMeasuredSource,
  type ReaderControlAutoPageFrame, type ReaderControlPlaybackMeasuredRect,
} from './ReaderControlPlaybackGeometry';
import { ReaderControlSwitchTrack } from './ReaderControlSwitchTrack';
import { ReaderControlTimerWheel } from './ReaderControlTimerWheel';

/** Restored 1938:6245 content-only actor tree. No Full-sheet adapter, local
 * animation clock, background, grabber or Full header. Existing playback,
 * wheel and native range-input business commands are supplied by the owner. */
@Component
export struct ReaderControlAutoPageContent {
  @Prop @Watch('onMotionChanged') motionProgress: number = 0;
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop isTablet: boolean = false;
  @Prop @Watch('onMotionChanged') interactionEnabled: boolean = true;
  @Prop @Watch('reportMorphActor') form: ReaderControlForm = 'quick';
  @Prop status: ReaderAutoPageStatus = 'stopped';
  @Prop timerSummaryText: string = '15:00';
  @Prop timerMinutes: number = 15;
  @Prop timerSeconds: number = 0;
  @Prop speedSeconds: number = 8;
  @Prop followHighlight: boolean = false;
  @Prop canPreviousChapter: boolean = false;
  @Prop canNextChapter: boolean = false;
  onPreviousChapter: () => void = (): void => {};
  onToggleRunning: () => void = (): void => {};
  onStop: () => void = (): void => {};
  onNextChapter: () => void = (): void => {};
  onTimerChange: (minutes: number, seconds: number) => void =
    (_minutes: number, _seconds: number): void => {};
  onSpeedChange: (seconds: number) => void = (_seconds: number): void => {};
  onFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};

  onBack: () => void = (): void => {};
  onMorphActorMeasured: (kind: ReaderSessionMorphSourceKind, left: number, top: number,
    width: number, height: number) => void =
    (_kind: ReaderSessionMorphSourceKind, _left: number, _top: number, _width: number, _height: number): void => {};
  @State private speedPreviewSeconds: number = -1;
  @State private scrollMotion: ReaderControlMorphScrollState = createReaderControlMorphScroll();
  @Prop fullViewportHeight: number = 666;
  private readonly scroller: Scroller = new Scroller();
  private quickMeasurement: ReaderControlPlaybackMeasuredRect | undefined = undefined;
  private fullMeasurement: ReaderControlPlaybackMeasuredRect | undefined = undefined;
  private cachedProgress: number = -1;
  private cachedWidth: number = -1;
  private cachedFrame: ReaderControlAutoPageFrame = sampleReaderControlAutoPage(0, 286);

  private p(): number { return readerControlUnit(this.motionProgress); }
  private frame(): ReaderControlAutoPageFrame {
    if (this.cachedProgress !== this.motionProgress || this.cachedWidth !== this.availableWidth) {
      this.cachedProgress = this.motionProgress; this.cachedWidth = this.availableWidth;
      this.cachedFrame = sampleReaderControlAutoPage(this.motionProgress, this.availableWidth);
    }
    return this.cachedFrame;
  }
  private onMotionChanged(): void {
    this.syncMorphScroll();
    if (!this.sharedInput()) this.speedPreviewSeconds = -1;
  }
  private syncMorphScroll(): void {
    const update = advanceReaderControlMorphScroll(this.scrollMotion, this.motionProgress,
      this.interactionEnabled, this.scroller.currentOffset().yOffset);
    this.scrollMotion = update.state;
    if (update.targetOffset !== undefined) {
      this.scroller.scrollTo({ xOffset: 0, yOffset: update.targetOffset, animation: false });
      this.onFullDidScroll();
    }
  }
  private onFullDidScroll(): void {
    this.scrollMotion = observeReaderControlMorphScroll(this.scrollMotion,
      this.scroller.currentOffset().yOffset, this.fullInput());
  }
  private nativeScrollDelta(y: number, source: ScrollSource): OffsetResult {
    return { xOffset: 0, yOffset: readerControlMorphScrollAllowsNative(this.scrollMotion,
      this.fullInput(), source === ScrollSource.SCROLLER) ? y : 0 };
  }
  private sharedScrollTranslation(): number {
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress);
  }
  private fullOnlyScrollTranslation(): number {
    return readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress, 'fullOnly');
  }

  private fullInput(): boolean { return this.interactionEnabled && this.p() === 1; }
  private presentation(): ReaderControlMotionPresentation {
    return sampleReaderControlMotionPresentation(this.motionProgress);
  }
  private sharedPaintRect(kind: 'control' | 'speed', p: number): ReaderControlMotionClipRect {
    const f = sampleReaderControlAutoPage(p, this.availableWidth);
    // Preserve the source's overflow: control icons begin 5vp above their
    // group; Quick speed's 44vp children extend beyond its 32vp actor.
    return kind === 'control' ? { x: f.content.x + 4, y: f.content.y + 27.3906,
      width: f.content.width - 8, height: 67 } :
      { x: f.content.x + f.details.x + f.speed.x, y: f.content.y + f.details.y + f.speed.y,
        width: f.speed.width, height: 64 };
  }
  private sharedClip(kind: 'control' | 'speed'): PathShape {
    const rects = readerControlMotionClipRects(this.p(), this.sharedPaintRect(kind, 1),
      this.sharedPaintRect(kind, this.p()), this.sharedPaintRect(kind, 0),
      this.fullViewportHeight, this.scrollMotion.fullScrollOffset);
    if (kind === 'control') for (const rect of rects) rect.y -= 5;
    return new PathShape().commands(readerControlMotionClipPath(rects, this.getUIContext().vp2px(1)));
  }
  private sharedInput(): boolean { return this.interactionEnabled && (this.p() === 0 || this.p() === 1); }
  private contentWidth(): number { return this.frame().content.width; }
  private sectionInnerWidth(): number { return Math.max(0, this.frame().content.width - 8); }
  private actorId(full: boolean): string {
    if ((this.form === 'full') === full) return readerSessionMorphActorId(readerControlPlaybackSourceKind('autoPage', this.form));
    return full ? 'reader-control-auto-page-playback' : 'reader-control-auto-page-viewport';
  }
  private measureActor(full: boolean, area: Area): void {
    const rect: ReaderControlPlaybackMeasuredRect = { left: Number(area.globalPosition.x),
      top: Number(area.globalPosition.y), width: Number(area.width), height: Number(area.height) };
    if (full) this.fullMeasurement = rect; else this.quickMeasurement = rect;
    this.reportMorphActor();
  }
  private reportMorphActor(): void {
    const rect = readerControlPlaybackMeasuredSource(this.form, this.quickMeasurement, this.fullMeasurement);
    if (rect !== undefined) this.onMorphActorMeasured(readerControlPlaybackSourceKind('autoPage', this.form),
      rect.left, rect.top, rect.width, rect.height);
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row().width(this.availableWidth).height(this.availableHeight).backgroundColor(TOK_SURFACE_PANEL)
        .border({ width: TOK_BORDER_W, color: TOK_LINE }).borderRadius(12).hitTestBehavior(HitTestMode.None);
      Scroll(this.scroller) {
        Stack({ alignContent: Alignment.TopStart }) {
          this.quickBack();
          Stack({ alignContent: Alignment.TopStart }) {
            this.controlSection();
            this.timerSection();
            Stack({ alignContent: Alignment.TopStart }) {
              this.moduleHeader('details');
              this.speedRow();
              this.followHighlightRow();
            }.width(this.frame().details.width).height(this.frame().details.height)
              .position({ x: this.frame().details.x, y: this.frame().details.y });
          }.width(this.frame().content.width).height(this.frame().content.height)
            .position({ x: this.frame().content.x, y: this.frame().content.y });
        }.width(this.availableWidth)
          .height(Math.max(this.frame().contentHeight, this.availableHeight + readerControlMorphScrollExtent(this.scrollMotion)));
      }.width(this.availableWidth).height(this.availableHeight).scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None).enableScrollInteraction(this.fullInput())
        .onWillScroll((_x: number, y: number, _state: ScrollState, source: ScrollSource): OffsetResult =>
          this.nativeScrollDelta(y, source))
        .onDidScroll((): void => this.onFullDidScroll());
    }.width(this.availableWidth).height(this.availableHeight).clip(true)
      .id(this.actorId(false)).onAreaChange((_old: Area, area: Area): void => this.measureActor(false, area));
  }

  @Builder
  private quickBack() {
    Row({ space: 4 }) {
      Image($r('app.media.reader_quick_back')).width(11).height(11);
      Text('返回').fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Bold)
        .fontSize(10).fontColor(TOK_READ_PRIMARY);
    }.width(this.frame().back.width).height(this.frame().back.height)
      .padding({ left: 9, right: 9 }).backgroundColor(TOK_SURFACE_PANEL).borderRadius(8)
      .alignItems(VerticalAlign.Center).position({ x: this.frame().back.x, y: this.frame().back.y })
      .translate({ y: readerControlMorphScrollTranslation(this.scrollMotion, this.motionProgress, 'quickOnly') })
      .opacity(this.frame().back.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .enabled(this.interactionEnabled && this.p() === 0)
      .accessibilityLevel(this.p() === 0 ? 'auto' : 'no-hide-descendants')
      .accessibilityText('返回阅读控制首页').onClick((): void => this.onBack());
  }

  private headerActor(kind: 'control' | 'details'): ReaderControlActorFrame {
    return kind === 'control' ? this.frame().controlHeader : this.frame().detailsHeader;
  }

  private headerMeta(kind: 'control' | 'details'): string {
    if (kind === 'details') return '即时生效';
    return this.status === 'running' ? '运行中' : (this.status === 'paused' ? '已暂停' : '未开始');
  }

  // Builder arguments are stable identity only. ArkUI's update closures must
  // read the current owner, not capture the first Quick actor/meta by value.
  @Builder
  private moduleHeader(kind: 'control' | 'details') {
    Row() {
      Text(kind === 'control' ? '自动翻页控制' : '详细配置').layoutWeight(1).fontFamily('ReaderInter').fontWeight(FontWeight.Bold)
        .fontSize(12).fontColor(TOK_READ_INK).maxLines(1);
      Text(this.headerMeta(kind)).fontFamily('ReaderInter').fontSize(10).fontColor(TOK_READ_MUTED);
    }.width(this.headerActor(kind).width).height(this.headerActor(kind).height).alignItems(VerticalAlign.Center)
      .position({ x: this.headerActor(kind).x, y: this.headerActor(kind).y })
      .translate({ y: this.fullOnlyScrollTranslation() })
      .opacity(this.headerActor(kind).opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
      .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private controlSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.moduleHeader('control');
      Stack({ alignContent: Alignment.TopStart }) {
        this.chapterButton(true); this.runningButton(); this.stopButton(); this.chapterButton(false);
      }.width(this.sectionInnerWidth()).height(62).position({ x: 4, y: 32.3906 })
        .translate({ y: this.sharedScrollTranslation() })
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
        .clipShape(this.sharedClip('control'));
    }.width(this.frame().control.width).height(this.frame().control.height)
      .id(this.actorId(true)).onAreaChange((_old: Area, area: Area): void => this.measureActor(true, area));
  }

  private chapterActor(previous: boolean): ReaderControlActorFrame {
    return previous ? this.frame().previous : this.frame().next;
  }
  @Builder
  private chapterButton(previous: boolean) {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        Image($r(previous ? 'app.media.reader_auto_full_chevron_left' : 'app.media.reader_auto_full_chevron_right'))
          .width(16).height(16).position({ x: 3, y: 5.5 });
        Image($r(previous ? 'app.media.reader_auto_full_chevron_left' : 'app.media.reader_auto_full_chevron_right'))
          .width(16).height(16).position({ x: 8, y: 5.5 });
      }.width(27).height(27).backgroundColor(TOK_READ_ELEVATED)
        .border({ width: TOK_BORDER_W, color: TOK_LINE }).borderRadius(8).position({ x: 22.5, y: 5 });
      Text(previous ? '上一章' : '下一章').width(27).height(9).fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold).fontSize(9).lineHeight(9).fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center).position({ x: 22.5, y: 39 });
    }.width(this.chapterActor(previous).width).height(this.chapterActor(previous).height)
      .position({ x: this.chapterActor(previous).x, y: this.chapterActor(previous).y })
      .enabled(this.sharedInput() && (previous ? this.canPreviousChapter : this.canNextChapter))
      .opacity((previous ? this.canPreviousChapter : this.canNextChapter) ? 1 : 0.4)
      .accessibilityText(previous ? '上一章' : '下一章').onClick((): void => {
        if (!this.sharedInput()) return;
        if (previous && this.canPreviousChapter) this.onPreviousChapter();
        else if (!previous && this.canNextChapter) this.onNextChapter();
      });
  }

  @Builder
  private runningButton() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r(this.status === 'running' ? 'app.media.reader_session_pause' : 'app.media.reader_auto_full_play'))
          .width(20).height(20);
      }.width(this.frame().playIcon.width).height(this.frame().playIcon.height)
        .backgroundColor(TOK_READ_PRIMARY).borderRadius(16)
        .position({ x: this.frame().playIcon.x, y: this.frame().playIcon.y });
      // 1939:803 is static inside its parent. The -31.492/-2.5 track belongs
      // to 1939:801 above, not this label (the previous Full adapter mixed them).
      Text('自动翻页').width(36).height(9).fontFamily('ReaderInter').fontWeight(800).fontSize(9)
        .lineHeight(9).fontColor(TOK_READ_INK).textAlign(TextAlign.Center)
        .position({ x: 29.4921875, y: 39 });
    }.width(this.frame().toggle.width).height(this.frame().toggle.height)
      .position({ x: this.frame().toggle.x, y: this.frame().toggle.y }).clip(true)
      .enabled(this.sharedInput()).accessibilityText(this.status === 'running' ? '暂停自动翻页' :
        (this.status === 'paused' ? '继续自动翻页' : '开始自动翻页'))
      .onClick((): void => { if (this.sharedInput()) this.onToggleRunning(); });
  }

  @Builder
  private stopButton() {
    Stack({ alignContent: Alignment.Center }) {
      Image($r('app.media.reader_auto_full_stop')).width(17).height(17);
    }.width(this.frame().stop.width).height(this.frame().stop.height)
      .backgroundColor(TOK_READ_ELEVATED).border({ width: TOK_BORDER_W, color: TOK_LINE }).borderRadius(12)
      .position({ x: this.frame().stop.x, y: this.frame().stop.y })
      .enabled(this.sharedInput() && this.status !== 'stopped').opacity(this.status === 'stopped' ? 0.4 : 1)
      .accessibilityText('停止自动翻页').onClick((): void => { if (this.sharedInput() && this.status !== 'stopped') this.onStop(); });
    Text('停止').width(this.frame().stopLabel.width).height(this.frame().stopLabel.height)
      .fontFamily('ReaderInter').fontWeight(FontWeight.Bold).fontSize(9).lineHeight(9)
      .fontColor('#8C3D36').textAlign(TextAlign.Center)
      .position({ x: this.frame().stopLabel.x, y: this.frame().stopLabel.y }).hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private timerWheel(minutes: boolean) {
    ReaderControlTimerWheel({
      value: this.currentTimerValue(minutes),
      minimum: minutes ? READER_AUTO_PAGE_FULL_MIN_MINUTES : READER_AUTO_PAGE_FULL_MIN_SECONDS,
      maximum: minutes ? READER_AUTO_PAGE_FULL_MAX_MINUTES : READER_AUTO_PAGE_FULL_MAX_SECONDS,
      wheelWidth: 76, rowHeight: 34, neighbours: 1, selectedSize: 17, neighbourSize: 11,
      unit: minutes ? '分' : '秒', interactionEnabled: this.fullInput(),
      onStep: (delta: number): void => this.commitTimerStep(minutes, delta),
    }).position({ x: minutes ? 0 : 100, y: 0 });
  }
  @Builder
  private timerSection() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('定时')
          .layoutWeight(1)
          .constraintSize({ maxWidth: 270.2 })
          .height(14.4)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(14.4)
          .fontColor(TOK_READ_INK)
          .maxLines(1);
        Text(this.timerSummaryText)
          .width(27.8)
          .height(12)
          .margin({ left: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(10)
          .lineHeight(12)
          .fontColor(TOK_READ_MUTED)
          .textAlign(TextAlign.End)
          .maxLines(1);
      }
      .width(this.sectionInnerWidth())
      .height(14.4)
      .position({ x: 4, y: 11 });

      Stack({ alignContent: Alignment.TopStart }) {
        Row({ space: 8 }) {
          Stack({ alignContent: Alignment.Center }) {
            Image($r('app.media.reader_auto_full_clock'))
              .width(18)
              .height(18);
          }
          .width(30)
          .height(30)
          .borderRadius(15);
          Text('自动停止')
          .fontFamily('ReaderInter')
            .fontWeight(FontWeight.Bold)
            .fontSize(11)
            .lineHeight(11)
            .fontColor(TOK_READ_INK)
            .maxLines(1);
        }
        .width(84)
        .height(30)
        .alignItems(VerticalAlign.Center)
        .position({ x: 15, y: 54 });

        Stack({ alignContent: Alignment.TopStart }) {
          this.timerWheel(true);
          Text(':')
            .width(8)
            .height(22)
          .fontFamily('ReaderInter')
            .fontWeight(800)
            .fontSize(18)
            .lineHeight(22)
            .fontColor(TOK_READ_PRIMARY)
            .textAlign(TextAlign.Center)
            .position({ x: 84, y: 40.5 });
          this.timerWheel(false);
        }
        .width(176)
        .height(114)
        .position({ x: 115, y: 12 });
      }
      .width(this.sectionInnerWidth())
      .height(138)
      .backgroundColor(TOK_SURFACE_PANEL_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_LINE })
      .borderRadius(10)
      .position({ x: 4, y: 33.39 });
    }
    .width(this.contentWidth())
    .height(this.frame().timer.height)
    .border({ width: { top: TOK_BORDER_W }, color: TOK_LINE })
    .position({ x: this.frame().timer.x, y: this.frame().timer.y })
    .translate({ y: this.fullOnlyScrollTranslation() })
    .opacity(this.frame().timer.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .enabled(this.fullInput())
    .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants');
  }

  @Builder
  private speedRow() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Text('翻页速度')
          .width(80.56)
          .height(14)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(10)
          .lineHeight(13)
          .fontColor(TOK_READ_INK)
          .maxLines(1);
        Text(`${this.effectiveSpeedSeconds()} 秒`)
          .width(19.44)
          .height(14)
          .margin({ left: 8 })
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(10)
          .lineHeight(13)
          .fontColor(TOK_READ_MUTED)
          .maxLines(1);
      }
      .width(108)
      .height(44)
      .constraintSize({ minHeight: 44 })
      .alignItems(VerticalAlign.Center)
      .position({ x: 11, y: 10 });

      Stack({ alignContent: Alignment.TopStart }) {
        Text('2 秒')
          .width(17.3)
          .height(13)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .lineHeight(13)
          .fontColor(TOK_READ_MUTED)
          .maxLines(1)
          .position({ x: 0, y: 15.5 });

        // Figma node `1764:11058` is an intentionally empty 109×44 frame.
        // The nearly-transparent native slider supplies semantics without
        // inventing a visible track or thumb absent from the source design.
        Slider({
          value: this.effectiveSpeedSeconds(),
          min: READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS,
          max: READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS,
          step: 1,
          style: SliderStyle.OutSet,
          direction: Axis.Horizontal,
          reverse: false,
        })
          .width(109)
          .height(44)
          .opacity(0.001)
          .accessibilityText('调整自动翻页速度')
          .onChange((value: number, mode: SliderChangeMode): void => {
            if (!this.sharedInput()) { this.speedPreviewSeconds = -1; return; }
            this.speedPreviewSeconds = Math.round(value);
            if (mode === SliderChangeMode.End) {
              const committed = this.speedPreviewSeconds;
              this.speedPreviewSeconds = -1;
              this.onSpeedChange(committed);
            }
          })
          .position({ x: 26.3, y: 0 });

        Text('20 秒')
          .width(23.14)
          .height(13)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Regular)
          .fontSize(9)
          .lineHeight(13)
          .fontColor(TOK_READ_MUTED)
          .textAlign(TextAlign.End)
          .maxLines(1)
          .position({ x: 143.86, y: 15.5 });
      }
      .width(167)
      .height(44)
      .constraintSize({ minHeight: 44 })
      .position({ x: 128, y: 10 });
    }
      .width(this.frame().speed.width).height(this.frame().speed.height)
      .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur);
    }
    .width(this.frame().speed.width)
    .height(this.frame().speed.height)
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(6)
    // 1939:848 keeps its 32 -> 64 actor track, but its source layout has
    // min-h44 children and no overflow clip. Quick text extends below the
    // 32vp actor and must remain visible inside the shared content viewport.
    .position({ x: this.frame().speed.x, y: this.frame().speed.y })
    .translate({ y: this.sharedScrollTranslation() })
    .clipShape(this.sharedClip('speed'))
    .enabled(this.sharedInput());
  }

  @Builder
  private followHighlightRow() {
    Row() {
      Text('跟随高亮')
        .layoutWeight(1)
        .constraintSize({ maxWidth: 236 })
        .height(13)
          .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(13)
        .fontColor(TOK_READ_INK)
        .maxLines(1);
      ReaderControlSwitchTrack({ value: this.followHighlight, inactiveColor: TOK_SURFACE_PANEL_SOFT })
        .margin({ left: 8 }).accessibilityText(`跟随高亮，${this.followHighlight ? '已开启' : '已关闭'}`);
    }
    .width(this.sectionInnerWidth())
    .height(36)
    .padding({ left: 9, right: 9, top: 6, bottom: 6 })
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE })
    .borderRadius(6)
    .alignItems(VerticalAlign.Center)
    .position({ x: this.frame().follow.x, y: this.frame().follow.y })
    .translate({ y: this.fullOnlyScrollTranslation() })
    .enabled(this.fullInput() && this.status === 'stopped')
    .opacity(this.frame().follow.opacity * this.presentation().contentOpacity).blur(this.presentation().contentBlur)
    .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants')
    .onClick((): void => this.onFollowHighlightChange(!this.followHighlight));
  }

  private effectiveSpeedSeconds(): number {
    if (this.speedPreviewSeconds >= READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS) {
      return this.speedPreviewSeconds;
    }
    return Math.max(READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS,
      Math.min(READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS, Math.round(this.speedSeconds)));
  }

  private currentTimerValue(minutes: boolean): number {
    const raw = minutes ? this.timerMinutes : this.timerSeconds;
    const minimum = minutes ? READER_AUTO_PAGE_FULL_MIN_MINUTES : READER_AUTO_PAGE_FULL_MIN_SECONDS;
    const maximum = minutes ? READER_AUTO_PAGE_FULL_MAX_MINUTES : READER_AUTO_PAGE_FULL_MAX_SECONDS;
    if (!Number.isFinite(raw)) {
      return minimum;
    }
    return Math.max(minimum, Math.min(maximum, Math.trunc(raw)));
  }

  private adjacentTimerValue(minutes: boolean, delta: number): number {
    return this.currentTimerValue(minutes) + delta;
  }

  private hasAdjacentTimerValue(minutes: boolean, delta: number): boolean {
    const next = this.adjacentTimerValue(minutes, delta);
    const minimum = minutes ? READER_AUTO_PAGE_FULL_MIN_MINUTES : READER_AUTO_PAGE_FULL_MIN_SECONDS;
    const maximum = minutes ? READER_AUTO_PAGE_FULL_MAX_MINUTES : READER_AUTO_PAGE_FULL_MAX_SECONDS;
    return next >= minimum && next <= maximum;
  }

  private commitTimerStep(minutes: boolean, delta: number): void {
    if (minutes) {
      this.onTimerChange(this.adjacentTimerValue(true, delta), this.currentTimerValue(false));
    } else {
      this.onTimerChange(this.currentTimerValue(true), this.adjacentTimerValue(false, delta));
    }
  }
}
