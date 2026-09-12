import { PathShape } from '@ohos.arkui.shape';
import { createReaderControlMorphScroll, advanceReaderControlMorphScroll, observeReaderControlMorphScroll,
  readerControlMorphScrollTranslation, readerControlMorphScrollExtent, readerControlMorphScrollAllowsNative,
  type ReaderControlMorphScrollState } from './ReaderControlMorphScroll';
import {
  READER_TTS_RATE_MAX, READER_TTS_RATE_MIN, READER_TTS_RATE_STEP, READER_TTS_RATE_STEP_SCALE,
  READER_TTS_TIMER_MAX_MINUTES, READER_TTS_TIMER_MAX_SECONDS, READER_TTS_TIMER_MIN,
  type ReaderTtsState,
} from './ReaderTtsState';
import type { ReaderTtsVoiceOption } from './ReaderTtsPreferencesState';
import type { ReaderTtsEngineOption } from './ReaderTtsFullPanel';
import type { ReaderControlForm } from './ReaderControlSessionState';
import { readerSessionMorphActorId, type ReaderSessionMorphSourceKind } from './ReaderSessionMorphState';
import { readerControlUnit, type ReaderControlActorFrame } from './ReaderControlActorGeometry';
import {
  sampleReaderControlTts, readerControlPlaybackSourceKind, readerControlPlaybackMeasuredSource,
  readerControlTtsTimerVisibleRects,
  type ReaderControlTtsFrame, type ReaderControlTransportKind, type ReaderControlPlaybackMeasuredRect,
} from './ReaderControlPlaybackGeometry';
import { ReaderControlSwitchTrack } from './ReaderControlSwitchTrack';
import { TOK_TTS_INK, TOK_TTS_MUTED, TOK_TTS_TEAL, TOK_TTS_TEAL_SOFT, TOK_TTS_TEAL_LINE,
  TOK_TTS_PLAY_START, TOK_TTS_PLAY_END, TOK_TTS_CLAY, TOK_TTS_CLAY_SOFT, TOK_TTS_CLAY_LINE,
  TOK_TTS_PAPER, TOK_TTS_PAPER_START, TOK_TTS_PAPER_END, TOK_TTS_CARD, TOK_TTS_QUICK_CARD,
  TOK_TTS_LINE, TOK_TTS_FIELD, TOK_TTS_TRACK } from './ReaderControlTtsStyle';
import { sampleReaderControlMotionPresentation, readerControlMotionOutlineOpacity,
  readerControlMotionClipRects, readerControlMotionClipPath,
  type ReaderControlMotionPresentation } from './ReaderControlMotionPresentation';

type ReaderControlTtsSection = 'playback' | 'timer' | 'speed';
type ReaderControlTtsField = 'voice' | 'engine' | 'language' | 'session' | 'failure';
type ReaderControlTtsToggle = 'followHighlight' | 'pauseOnInterruption' | 'allowMixing';

/** Make v17 redraw on persistent Playback/Timer/Speed actors.
 * All actors consume the production Runtime's one p. Header, grabber, shell and whole visibility are
 * intentionally absent here. Business commands remain supplied by the owner. */
@Component
export struct ReaderControlTtsContent {
  @Prop @Watch('onMotionChanged') motionProgress: number = 0;
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop isTablet: boolean = false;
  @Prop @Watch('onMotionChanged') interactionEnabled: boolean = true;
  @Prop @Watch('reportMorphActor') form: ReaderControlForm = 'quick';
  @Prop state: ReaderTtsState;
  @Prop timerMinutes: number = 15;
  @Prop timerSeconds: number = 0;
  @Prop followHighlight: boolean = true;
  @Prop pauseOnInterruption: boolean = true;
  @Prop allowMixing: boolean = false;
  @Prop failurePolicy: 'skip' | 'stop' = 'stop';
  @Prop engine: string = 'system';
  @Prop httpEngines: ReaderTtsEngineOption[] = [];
  @Prop voiceOptions: ReaderTtsVoiceOption[] = [];
  @Prop language: string = 'zh-CN';
  @Prop person: number = 0;
  onCollapse: () => void = (): void => {};
  onToggle: () => void = (): void => {};
  onStop: () => void = (): void => {};
  onPrevious: () => void = (): void => {};
  onNext: () => void = (): void => {};
  onSeek: (sliceIndex: number) => void = (_sliceIndex: number): void => {};
  onTimerChange: (minutes: number, seconds: number) => void =
    (_minutes: number, _seconds: number): void => {};
  onRateChange: (rate: number) => void = (_rate: number): void => {};
  onFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onPauseOnInterruptionChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onAllowMixingChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onFailurePolicyChange: (policy: 'skip' | 'stop') => void = (_policy: 'skip' | 'stop'): void => {};
  onVoiceChange: (language: string, person: number) => void =
    (_language: string, _person: number): void => {};
  onEngineChange: (engine: string) => Promise<void> = (_engine: string): Promise<void> => Promise.resolve();
  onHttpEnginePut: (config: ReaderTtsEngineOption) => Promise<void> =
    (_config: ReaderTtsEngineOption): Promise<void> => Promise.resolve();
  onHttpEngineDelete: (id: number) => Promise<void> = (_id: number): Promise<void> => Promise.resolve();

  onMorphActorMeasured: (kind: ReaderSessionMorphSourceKind, left: number, top: number,
    width: number, height: number) => void =
    (_kind: ReaderSessionMorphSourceKind, _left: number, _top: number, _width: number, _height: number): void => {};
  @State private ratePreview: number = -1;
  @State private scrollMotion: ReaderControlMorphScrollState = createReaderControlMorphScroll();
  @Prop fullViewportHeight: number = 666;
  private readonly scroller: Scroller = new Scroller();
  private quickMeasurement: ReaderControlPlaybackMeasuredRect | undefined = undefined;
  private fullMeasurement: ReaderControlPlaybackMeasuredRect | undefined = undefined;
  private cachedProgress: number = -1;
  private cachedWidth: number = -1;
  private cachedRate: number = -1;
  private cachedSeek: number = -1;
  private cachedFrame: ReaderControlTtsFrame = sampleReaderControlTts(0, 286);

  private p(): number { return readerControlUnit(this.motionProgress); }
  private frame(): ReaderControlTtsFrame {
    const rate = (this.effectiveRate() - READER_TTS_RATE_MIN) / (READER_TTS_RATE_MAX - READER_TTS_RATE_MIN);
    const seek = (this.state.totalSlices > 1 ? 32 : 0) + (this.state.errorMessage ? 24 : 0);
    if (this.cachedProgress !== this.motionProgress || this.cachedWidth !== this.availableWidth ||
      this.cachedRate !== rate || this.cachedSeek !== seek) {
      this.cachedProgress = this.motionProgress; this.cachedWidth = this.availableWidth;
      this.cachedRate = rate; this.cachedSeek = seek;
      this.cachedFrame = sampleReaderControlTts(this.motionProgress, this.availableWidth, rate, seek);
    }
    return this.cachedFrame;
  }
  private onMotionChanged(): void {
    this.syncMorphScroll();
    if (!this.sharedInput()) this.ratePreview = -1;
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
  private presentation(): ReaderControlMotionPresentation {
    return sampleReaderControlMotionPresentation(this.motionProgress);
  }
  private outlineOpacity(kind: ReaderControlTtsSection): number {
    const seek = (this.state.totalSlices > 1 ? 32 : 0) + (this.state.errorMessage ? 24 : 0);
    const full = sampleReaderControlTts(1, this.availableWidth, 0, seek);
    const actor = kind === 'playback' ? full.playback : kind === 'timer' ? full.timer : full.speed;
    return readerControlMotionOutlineOpacity(this.motionProgress, actor.y, actor.height,
      this.fullViewportHeight, this.scrollMotion.fullScrollOffset);
  }
  private fullInput(): boolean { return this.interactionEnabled && this.p() === 1; }
  private sharedClip(kind: ReaderControlTtsSection): PathShape {
    const seek = (this.state.totalSlices > 1 ? 32 : 0) + (this.state.errorMessage ? 24 : 0);
    const full = sampleReaderControlTts(1, this.availableWidth, 0, seek);
    const quick = sampleReaderControlTts(0, this.availableWidth, 0, seek);
    const current = this.frame();
    const a = kind === 'playback' ? full.playback : kind === 'timer' ? full.timer : full.speed;
    const b = kind === 'playback' ? current.playback : kind === 'timer' ? current.timer : current.speed;
    const c = kind === 'playback' ? quick.playback : kind === 'timer' ? quick.timer : quick.speed;
    const clips = readerControlMotionClipRects(this.p(), a, b, c,
      this.fullViewportHeight, this.scrollMotion.fullScrollOffset);
    return new PathShape().commands(readerControlMotionClipPath(kind === 'timer' ?
      readerControlTtsTimerVisibleRects(clips, current,
        readerControlMotionClipRects(this.p(), full.speed, current.speed, quick.speed,
          this.fullViewportHeight, this.scrollMotion.fullScrollOffset)) : clips, this.getUIContext().vp2px(1)));
  }
  private sharedInput(): boolean { return this.interactionEnabled && (this.p() === 0 || this.p() === 1); }
  private playbackLabel(): string {
    if (this.state.status === 'playing') return '朗读中';
    if (this.state.status === 'preparing' || this.state.status === 'resuming') return '准备中';
    if (this.state.status === 'paused' || this.state.status === 'interrupted') return '继续';
    if (this.state.status === 'error' || this.state.status === 'failed') return '失败·重试';
    if (this.state.status === 'unavailable') return '不可用';
    if (this.state.status === 'stopping') return '停止中';
    if (this.state.status === 'completed') return '已完成';
    if (this.state.status === 'probing') return '检查中';
    return '未开始';
  }
  private actorId(full: boolean): string {
    if ((this.form === 'full') === full) return readerSessionMorphActorId(readerControlPlaybackSourceKind('tts', this.form));
    return full ? 'reader-control-tts-playback' : 'reader-control-tts-viewport';
  }
  private measureActor(full: boolean, area: Area): void {
    const rect: ReaderControlPlaybackMeasuredRect = { left: Number(area.globalPosition.x),
      top: Number(area.globalPosition.y), width: Number(area.width), height: Number(area.height) };
    if (full) this.fullMeasurement = rect; else this.quickMeasurement = rect;
    this.reportMorphActor();
  }
  private reportMorphActor(): void {
    const rect = readerControlPlaybackMeasuredSource(this.form, this.quickMeasurement, this.fullMeasurement);
    if (rect !== undefined) this.onMorphActorMeasured(readerControlPlaybackSourceKind('tts', this.form),
      rect.left, rect.top, rect.width, rect.height);
  }
  private transport(kind: ReaderControlTransportKind): ReaderControlActorFrame {
    if (kind === 'previous') return this.frame().previous;
    if (kind === 'toggle') return this.frame().toggle;
    if (kind === 'stop') return this.frame().stop;
    return this.frame().next;
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Scroll(this.scroller) {
        Stack({ alignContent: Alignment.TopStart }) {
          this.playback();
          this.timer();
          this.speed();
          Column() { this.detailSection(); }
            .width(this.frame().detail.width).height(this.frame().detail.height)
            .position({ x: this.frame().detail.x, y: this.frame().detail.y })
            .translate({ y: this.fullOnlyScrollTranslation() })
            .opacity(this.frame().detail.opacity * this.presentation().contentOpacity)
            .blur(this.presentation().contentBlur).enabled(this.fullInput())
            .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants');
          Column() { this.systemSection(); }
            .width(this.frame().config.width).height(this.frame().config.height)
            .position({ x: this.frame().config.x, y: this.frame().config.y })
            .translate({ y: this.fullOnlyScrollTranslation() })
            .opacity(this.frame().config.opacity * this.presentation().contentOpacity)
            .blur(this.presentation().contentBlur).enabled(this.fullInput())
            .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants');
        }.width(this.availableWidth)
          .height(Math.max(this.frame().contentHeight,
            this.availableHeight + readerControlMorphScrollExtent(this.scrollMotion)));
      }.width(this.availableWidth).height(this.availableHeight).scrollBar(BarState.Off)
        .edgeEffect(EdgeEffect.None).enableScrollInteraction(this.fullInput())
        .onWillScroll((_x: number, y: number, _state: ScrollState, source: ScrollSource): OffsetResult =>
          this.nativeScrollDelta(y, source))
        .onDidScroll((): void => this.onFullDidScroll());
    }.width(this.availableWidth).height(this.availableHeight).clip(true)
      .id(this.actorId(false)).onAreaChange((_old: Area, area: Area): void => this.measureActor(false, area));
  }

  private headerActor(kind: ReaderControlTtsSection): ReaderControlActorFrame {
    if (kind === 'playback') return this.frame().playbackHeader;
    return kind === 'timer' ? this.frame().timerHeader : this.frame().speedHeader;
  }

  private headerMeta(kind: ReaderControlTtsSection): string {
    if (kind === 'playback') return this.statusText();
    return kind === 'timer' ? this.timerSummary() : this.effectiveRate().toFixed(1) + 'x';
  }

  private quickLabelActor(kind: ReaderControlTtsSection): ReaderControlActorFrame {
    if (kind === 'playback') return this.frame().quickPlaybackLabel;
    return kind === 'timer' ? this.frame().quickTimerLabel : this.frame().quickSpeedLabel;
  }

  // Keep Builder arguments semantic; every observer reads current geometry.
  @Builder
  private moduleHeader(kind: ReaderControlTtsSection) {
    Row() {
      Text(kind === 'playback' ? '朗读控制' : (kind === 'timer' ? '定时停止' : '语速'))
        .layoutWeight(1).fontFamily('ReaderInter').fontWeight(FontWeight.Bold)
        .fontSize(12).fontColor(TOK_TTS_INK);
      Text(this.headerMeta(kind)).fontFamily('ReaderInter').fontSize(10).fontColor(TOK_TTS_TEAL)
        .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .constraintSize({ maxWidth: this.headerActor(kind).width * 0.45 });
    }.width(this.headerActor(kind).width).height(this.headerActor(kind).height)
      .padding({ left: 3, right: 3 }).alignItems(VerticalAlign.Center)
      .position({ x: this.headerActor(kind).x, y: this.headerActor(kind).y })
      .opacity(this.headerActor(kind).opacity).hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private quickLabel(kind: ReaderControlTtsSection) {
    Row({ space: kind === 'playback' ? 9 : 8 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r(kind === 'playback' ? 'app.media.reader_tts_headphones' :
          (kind === 'timer' ? 'app.media.reader_tts_clock' : 'app.media.reader_tts_rate')))
          .width(kind === 'playback' ? 18 : 16).height(kind === 'playback' ? 18 : 16);
      }.width(kind === 'playback' ? 34 : 26).height(kind === 'playback' ? 34 : 26)
        .backgroundColor(TOK_TTS_TEAL_SOFT).borderRadius(kind === 'playback' ? 10 : 8)
        .border({ width: 0.5, color: TOK_TTS_TEAL_LINE });
      Column({ space: 0 }) {
        Text(kind === 'playback' ? '播放' : (kind === 'timer' ? '定时' : '语速'))
          .fontFamily('ReaderInter').fontWeight(FontWeight.Bold).fontSize(kind === 'playback' ? 13 : 12)
          .fontColor(TOK_TTS_INK).height(kind === 'playback' ? 16 : 18).maxLines(1);
        if (kind === 'playback') {
          Row({ space: 4 }) {
            Row().width(5).height(5).borderRadius(3).backgroundColor(TOK_TTS_TEAL);
            Text(this.playbackLabel()).fontFamily('ReaderInter').fontSize(10).fontColor(TOK_TTS_TEAL)
              .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1);
          }.height(13).width('100%').alignItems(VerticalAlign.Center);
        }
      }.layoutWeight(1).alignItems(HorizontalAlign.Start);
    }.width(this.quickLabelActor(kind).width).height(this.quickLabelActor(kind).height)
      .alignItems(VerticalAlign.Center)
      .position({ x: this.quickLabelActor(kind).x, y: this.quickLabelActor(kind).y })
      .opacity(this.quickLabelActor(kind).opacity).hitTestBehavior(HitTestMode.None);
  }

  private surfaceY(kind: ReaderControlTtsSection): number {
    return (kind === 'playback' ? 27 : 26) * this.p();
  }
  private sectionActor(kind: ReaderControlTtsSection): ReaderControlActorFrame {
    return kind === 'playback' ? this.frame().playback : kind === 'timer' ? this.frame().timer : this.frame().speed;
  }
  @Builder
  private sectionSurface(kind: ReaderControlTtsSection) {
    Stack() {
      Row().width('100%').height('100%')
        .linearGradient({ angle: 150, colors: [[TOK_TTS_PAPER_START, 0], [TOK_TTS_PAPER_END, 1]] })
        .opacity(1 - this.p()).hitTestBehavior(HitTestMode.None);
    }.width(this.sectionActor(kind).width)
      .height(this.sectionActor(kind).height - this.surfaceY(kind))
      .position({ x: 0, y: this.surfaceY(kind) })
      .backgroundColor(TOK_TTS_CARD).border({ width: 0.5, color: TOK_TTS_LINE })
      .borderRadius(9 + 5 * this.p()).clip(true).opacity(this.outlineOpacity(kind))
      .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private playback() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.sectionSurface('playback');
      Stack({ alignContent: Alignment.TopStart }) {
        Row().width(3).height(42).borderRadius(2).backgroundColor(TOK_TTS_TEAL)
          .position({ x: 0, y: 12 }).opacity(1 - this.p()).hitTestBehavior(HitTestMode.None);
        this.moduleHeader('playback');
        this.quickLabel('playback');
        this.waveform();
        this.roundControl('previous'); this.roundControl('toggle');
        this.roundControl('stop'); this.roundControl('next');
        Row({ space: 6 }) {
          Image($r('app.media.reader_tts_header')).width(16).height(16);
          Text('当前音色 · ' + this.currentVoiceLabel()).fontFamily('ReaderInter').fontSize(10)
            .fontColor(TOK_TTS_INK).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1);
        }.width(this.frame().voice.width).height(this.frame().voice.height).alignItems(VerticalAlign.Center)
          .position({ x: this.frame().voice.x, y: this.frame().voice.y })
          .opacity(this.frame().voice.opacity).hitTestBehavior(HitTestMode.None);
        if (this.state.totalSlices > 1) {
          Slider({ value: this.state.sliceIndex ?? 0, min: 0, max: this.state.totalSlices - 1,
            step: 1, style: SliderStyle.OutSet, direction: Axis.Horizontal, reverse: false })
            .width(this.frame().playback.width - 32).height(24).position({ x: 16, y: 198 })
            .selectedColor(TOK_TTS_TEAL).enabled(this.fullInput()).opacity(this.p())
            .accessibilityText('跳转朗读句子')
            .onChange((value: number, mode: SliderChangeMode): void => {
              if (mode === SliderChangeMode.End && this.fullInput()) this.onSeek(Math.round(value));
            });
        }
        if (this.state.errorMessage !== undefined && this.state.errorMessage.length > 0) {
          Text(this.state.errorMessage).width(this.frame().playback.width - 32).height(24)
            .fontFamily('ReaderInter').fontSize(10).lineHeight(12).fontColor(TOK_TTS_CLAY).maxLines(2)
            .position({ x: 16, y: this.state.totalSlices > 1 ? 230 : 198 }).opacity(this.p());
        }
      }.width(this.frame().playback.width).height(this.frame().playback.height)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
        .accessibilityLevel(this.sharedInput() ? 'auto' : 'no-hide-descendants');
    }.width(this.frame().playback.width).height(this.frame().playback.height)
      .position({ x: this.frame().playback.x, y: this.frame().playback.y })
      .translate({ y: this.sharedScrollTranslation() }).clipShape(this.sharedClip('playback'))
      .id(this.actorId(true)).onAreaChange((_old: Area, area: Area): void => this.measureActor(true, area));
  }

  /** A static decorative sample from Make, not an audio-level meter or a second clock. */
  private waveformHeights(): number[] {
    return [3.14, 6.02, 3.60, 17.03, 8.72, 8.89, 9.74, 4.36, 15.13, 12.62, 4.20, 15.27,
      6.24, 12.03, 13.56, 7.14, 17.37, 9.28, 8.53, 11.27, 14.69, 9.20, 14.72, 4.41];
  }
  @Builder
  private waveform() {
    Row() {
      ForEach(this.waveformHeights(), (height: number): void => {
        Row().width(2.5).height(height).borderRadius(2).backgroundColor(TOK_TTS_TEAL);
      }, (_height: number, index: number): string => index.toString());
    }.width(this.frame().waveform.width).height(this.frame().waveform.height)
      .justifyContent(FlexAlign.SpaceBetween).alignItems(VerticalAlign.Center)
      .position({ x: this.frame().waveform.x, y: this.frame().waveform.y })
      .opacity(this.frame().waveform.opacity * 0.7).hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
  }

  @Builder
  private roundControl(kind: ReaderControlTransportKind) {
    Stack({ alignContent: Alignment.Center }) {
      if (kind === 'toggle') {
        Row().width('100%').height('100%').borderRadius(999)
          .linearGradient({ angle: 155, colors: [[TOK_TTS_PLAY_START, 0], [TOK_TTS_PLAY_END, 1]] })
          .border({ width: { top: 0.5 }, color: '#33FFFFFF' })
          .shadow({ radius: 6 + 2 * this.p(), color: '#5C2F6373', offsetY: 4 });
      }
      Row({ space: 4 * this.p() }) {
        Image($r(kind === 'toggle' ? (this.isActivelySpeaking() ? 'app.media.reader_session_pause' : 'app.media.reader_tts_play') :
          (kind === 'stop' ? 'app.media.reader_tts_make_stop' :
          (kind === 'previous' ? 'app.media.reader_tts_make_previous' : 'app.media.reader_tts_make_next'))))
          .width(kind === 'toggle' ? 18 + 2 * this.p() : kind === 'stop' ? 10 : 14 + 12 * this.p())
          .height(kind === 'toggle' ? 18 + 2 * this.p() : kind === 'stop' ? 10 : 14 + 12 * this.p());
        if (kind === 'stop') {
          Text('停止').fontFamily('ReaderInter').fontSize(10).fontColor(TOK_TTS_CLAY)
            .width(24 * this.p()).height(14).opacity(this.p()).maxLines(1);
        }
      }.justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center);
    }.width(this.transport(kind).width).height(this.transport(kind).height)
      .position({ x: this.transport(kind).x, y: this.transport(kind).y })
      .backgroundColor(kind === 'stop' ? TOK_TTS_CLAY_SOFT : Color.Transparent)
      .border({ width: kind === 'stop' ? 0.5 : 0, color: TOK_TTS_CLAY_LINE }).borderRadius(999)
      .enabled(this.sharedInput() && (kind === 'toggle' ?
        this.state.status !== 'unavailable' && this.state.status !== 'stopping' : this.hasActiveQueue()))
      .opacity((kind === 'toggle' ? this.state.status !== 'unavailable' : this.hasActiveQueue()) ? 1 : 0.42)
      .accessibilityText(this.controlText(kind)).onClick((): void => {
        if (!this.sharedInput()) return;
        if (kind === 'toggle' && (this.state.status === 'unavailable' || this.state.status === 'stopping')) return;
        if (kind !== 'toggle' && !this.hasActiveQueue()) return;
        if (kind === 'previous') this.onPrevious(); else if (kind === 'next') this.onNext();
        else if (kind === 'stop') this.onStop(); else this.onToggle();
      });
  }

  private timerPresetSelected(minutes: number): boolean {
    return this.timerMinutes === minutes && this.timerSeconds === 0;
  }
  private timerCaption(): string {
    if (this.timerMinutes === 0 && this.timerSeconds === 0) return '不开启';
    return this.timerSeconds === 0 ? `${this.timerMinutes} 分钟` : this.timerSummary();
  }
  private chooseTimerPreset(minutes: number): void {
    if (this.fullInput()) this.onTimerChange(minutes, 0);
  }
  @Builder
  private timer() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.sectionSurface('timer');
      Stack({ alignContent: Alignment.TopStart }) {
        this.moduleHeader('timer'); this.quickLabel('timer');
        Row({ space: 4 }) {
          Text(this.timerCaption()).fontFamily('ReaderInter').fontSize(11).fontColor(TOK_TTS_TEAL)
            .layoutWeight(1).maxLines(1).textAlign(TextAlign.Center);
          Image($r('app.media.reader_chevron_down')).width(8).height(4);
        }.width(this.frame().quickTimerSelect.width).height(this.frame().quickTimerSelect.height)
          .padding({ left: 8, right: 8 }).alignItems(VerticalAlign.Center)
          .position({ x: this.frame().quickTimerSelect.x, y: this.frame().quickTimerSelect.y })
          .backgroundColor(TOK_TTS_TEAL_SOFT).border({ width: 0.5, color: TOK_TTS_TEAL_LINE }).borderRadius(999)
          .opacity(this.frame().quickTimerSelect.opacity).enabled(false)
          .accessibilityText(`定时${this.timerCaption()}，可在完整控制页调整`);
        Column({ space: 12 }) {
          Column({ space: 8 }) {
            Row({ space: 8 }) { this.timerPreset(0); this.timerPreset(15); this.timerPreset(30); }
              .width('100%');
            Row({ space: 8 }) { this.timerPreset(45); this.timerPreset(60); this.timerPreset(90); }
              .width('100%');
          }.width('100%');
          Row({ space: 4 }) {
            Column({ space: 2 }) {
              Text('自定义时长').fontFamily('ReaderInter').fontSize(11).fontColor(TOK_TTS_INK);
              Text('分 · 秒').fontFamily('ReaderInter').fontSize(9).fontColor(TOK_TTS_MUTED);
            }.layoutWeight(1).alignItems(HorizontalAlign.Start);
            this.timerStepper(true); this.timerStepper(false);
          }.width('100%').height(48).padding({ left: 10, right: 6 }).alignItems(VerticalAlign.Center)
            .border({ width: 0.5, color: TOK_TTS_LINE }).borderRadius(10);
        }.width(this.frame().timer.width).height(this.frame().timerCard.height).padding(14)
          .position({ x: this.frame().timerCard.x, y: this.frame().timerCard.y })
          .opacity(this.frame().timerCard.opacity).enabled(this.fullInput())
          .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants');
      }.width(this.frame().timer.width).height(this.frame().timer.height)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
        .accessibilityLevel(this.sharedInput() ? 'auto' : 'no-hide-descendants');
    }.width(this.frame().timer.width).height(this.frame().timer.height)
      .position({ x: this.frame().timer.x, y: this.frame().timer.y }).clip(true)
      .translate({ y: this.sharedScrollTranslation() }).clipShape(this.sharedClip('timer'));
  }
  @Builder
  private timerPreset(minutes: number) {
    Text(minutes === 0 ? '不开启' : `${minutes} 分钟`).fontFamily('ReaderInter').fontSize(11)
      .fontColor(this.timerPresetSelected(minutes) ? TOK_TTS_PAPER : TOK_TTS_INK)
      .layoutWeight(1).height(36).textAlign(TextAlign.Center)
      .backgroundColor(this.timerPresetSelected(minutes) ? TOK_TTS_TEAL : TOK_TTS_FIELD)
      .border({ width: 0.5, color: TOK_TTS_LINE }).borderRadius(9).enabled(this.fullInput())
      .accessibilityText(minutes === 0 ? '关闭定时停止' : `定时${minutes}分钟`)
      .onClick((): void => this.chooseTimerPreset(minutes));
  }
  @Builder
  private timerStepper(minutes: boolean) {
    Row({ space: 1 }) {
      this.timerStepButton(minutes, -1);
      Text(this.twoDigits(minutes ? this.timerMinutes : this.timerSeconds))
        .fontFamily('ReaderInter').fontSize(14).fontWeight(FontWeight.Bold).fontColor(TOK_TTS_INK)
        .width(23).height(24).textAlign(TextAlign.Center);
      this.timerStepButton(minutes, 1);
    }.height(32).alignItems(VerticalAlign.Center)
      .accessibilityText(minutes ? `${this.timerMinutes}分` : `${this.timerSeconds}秒`);
  }
  @Builder
  private timerStepButton(minutes: boolean, delta: number) {
    Stack({ alignContent: Alignment.Center }) {
      Image($r(delta < 0 ? 'app.media.reader_tts_make_minus' : 'app.media.reader_tts_make_plus')).width(12).height(12);
    }.width(24).height(30).backgroundColor(TOK_TTS_TEAL_SOFT).borderRadius(999)
      .enabled(this.fullInput() && (delta > 0 ?
        (minutes ? this.timerMinutes < READER_TTS_TIMER_MAX_MINUTES : this.timerSeconds < READER_TTS_TIMER_MAX_SECONDS) :
        (minutes ? this.timerMinutes > 0 : this.timerSeconds > 0)))
      .accessibilityText(`${delta > 0 ? '增加' : '减少'}${minutes ? '一分钟' : '一秒'}`)
      .onClick((): void => { if (this.fullInput()) this.stepTimer(minutes, delta); });
  }

  private ratePresets(): number[] { return [0.8, 1.0, 1.2, 1.5]; }
  private chooseRatePreset(rate: number): void {
    if (!this.fullInput()) return;
    this.ratePreview = -1;
    this.onRateChange(rate);
  }
  @Builder
  private speed() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.sectionSurface('speed');
      Stack({ alignContent: Alignment.TopStart }) {
        this.moduleHeader('speed'); this.quickLabel('speed');
        Text(this.effectiveRate().toFixed(1) + 'x').fontFamily('ReaderInter').fontSize(12)
          .fontColor(TOK_TTS_TEAL).textAlign(TextAlign.End)
          .width(this.frame().quickSpeedValue.width).height(this.frame().quickSpeedValue.height)
          .position({ x: this.frame().quickSpeedValue.x, y: this.frame().quickSpeedValue.y })
          .opacity(this.frame().quickSpeedValue.opacity);
        Row().width(this.frame().speedTrack.width).height(this.frame().speedTrack.height)
          .backgroundColor(TOK_TTS_TRACK).borderRadius(999)
          .position({ x: this.frame().speedTrack.x, y: this.frame().speedTrack.y });
        Row().width(this.frame().speedThumb.x + 9 - this.frame().speedTrack.x)
          .height(this.frame().speedTrack.height).backgroundColor(TOK_TTS_TEAL).borderRadius(999)
          .position({ x: this.frame().speedTrack.x, y: this.frame().speedTrack.y });
        Row().width(18).height(18).border({ width: 1.5, color: TOK_TTS_TEAL }).borderRadius(999)
          .backgroundColor(TOK_TTS_PAPER).shadow({ radius: 2, color: '#382F2314', offsetY: 1 })
          .position({ x: this.frame().speedThumb.x, y: this.frame().speedThumb.y });
        Text(READER_TTS_RATE_MIN.toFixed(1) + 'x').fontFamily('ReaderInter').fontSize(9).fontColor(TOK_TTS_MUTED)
          .position({ x: 16, y: 75 }).opacity(this.p());
        Text(READER_TTS_RATE_MAX.toFixed(1) + 'x').fontFamily('ReaderInter').fontSize(9).fontColor(TOK_TTS_MUTED)
          .position({ x: this.frame().speed.width - 37, y: 75 }).opacity(this.p());
        Row({ space: 8 }) {
          ForEach(this.ratePresets(), (rate: number): void => { this.ratePreset(rate); }, (rate: number): string => rate.toString());
        }.width(this.frame().speedPresets.width).height(this.frame().speedPresets.height)
          .position({ x: this.frame().speedPresets.x, y: this.frame().speedPresets.y })
          .opacity(this.frame().speedPresets.opacity).enabled(this.fullInput())
          .accessibilityLevel(this.fullInput() ? 'auto' : 'no-hide-descendants');
        Slider({ value: this.effectiveRate(), min: READER_TTS_RATE_MIN, max: READER_TTS_RATE_MAX,
          step: READER_TTS_RATE_STEP, style: SliderStyle.OutSet, direction: Axis.Horizontal, reverse: false })
          .width(this.frame().speedTrack.width).height(44)
          .position({ x: this.frame().speedTrack.x, y: this.frame().speedTrack.y - 20 })
          .opacity(0.001).enabled(this.sharedInput()).accessibilityText('调整朗读语速')
          .onChange((value: number, mode: SliderChangeMode): void => {
            if (!this.sharedInput()) { this.ratePreview = -1; return; }
            this.ratePreview = Math.round(value * READER_TTS_RATE_STEP_SCALE) / READER_TTS_RATE_STEP_SCALE;
            if (mode === SliderChangeMode.End) {
              const rate = this.ratePreview; this.ratePreview = -1; this.onRateChange(rate);
            }
          });
      }.width(this.frame().speed.width).height(this.frame().speed.height)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
        .accessibilityLevel(this.sharedInput() ? 'auto' : 'no-hide-descendants');
    }.width(this.frame().speed.width).height(this.frame().speed.height)
      .position({ x: this.frame().speed.x, y: this.frame().speed.y })
      .translate({ y: this.sharedScrollTranslation() }).clipShape(this.sharedClip('speed'));
  }
  @Builder
  private ratePreset(rate: number) {
    Text(rate.toFixed(1) + 'x').fontFamily('ReaderInter').fontSize(12)
      .fontColor(this.effectiveRate() === rate ? TOK_TTS_PAPER : TOK_TTS_INK)
      .width(50).height(32).textAlign(TextAlign.Center).borderRadius(9)
      .backgroundColor(this.effectiveRate() === rate ? TOK_TTS_TEAL : TOK_TTS_FIELD)
      .border({ width: 0.5, color: TOK_TTS_LINE }).enabled(this.fullInput())
      .accessibilityText(`语速${rate.toFixed(1)}倍`).onClick((): void => this.chooseRatePreset(rate));
  }

  @Builder
  private detailSection() {
    Column({ space: 8 }) {
      this.sectionHeader('播放配置', '即时生效');
      Column({ space: 0 }) {
        this.voiceSelectorRow();
        this.toggleRow('followHighlight'); this.toggleRow('pauseOnInterruption'); this.toggleRow('allowMixing');
      }.width('100%').height(196).backgroundColor(TOK_TTS_CARD)
        .border({ width: 0.5, color: TOK_TTS_LINE }).borderRadius(14).clip(true);
    }.width('100%').alignItems(HorizontalAlign.Start);
  }
  @Builder
  private systemSection() {
    Column({ space: 8 }) {
      this.ttsConfigHeader();
      Column({ space: 0 }) {
        this.ttsServiceTypeTabs();
        Blank().height(15);
        this.ttsClosedConfigPanel();
      }.width('100%').height(308).padding({ top: 14 }).backgroundColor(TOK_TTS_CARD)
        .border({ width: 0.5, color: TOK_TTS_LINE }).borderRadius(14).clip(true);
    }.width('100%').alignItems(HorizontalAlign.Start);
  }
  @Builder
  private ttsConfigHeader() { this.sectionHeader('朗读引擎', ''); }

  @Builder
  private ttsServiceTypeTabs() {
    Row({ space: 10 }) { this.ttsServiceTypeTab(false); this.ttsServiceTypeTab(true); }
      .width('100%').height(87).padding({ left: 14, right: 14 });
  }
  @Builder
  private ttsServiceTypeTab(http: boolean) {
    Column({ space: 7 }) {
      Row() {
        Image($r(http ? 'app.media.reader_tts_online_engine' : 'app.media.reader_tts_system_engine')).width(20).height(20);
        Blank();
        Image($r('app.media.settings_select_check')).width(16).height(16)
          .opacity(this.isTtsServiceTabSelected(http) ? 1 : 0);
      }.width('100%').height(20);
      Column({ space: 3 }) {
        Text(http ? '在线 TTS' : '系统 TTS').fontFamily('ReaderInter').fontWeight(FontWeight.Bold)
          .fontSize(12).fontColor(TOK_TTS_INK).height(17).maxLines(1);
        Text(http ? '第三方语音服务' : '设备内置语音').fontFamily('ReaderInter')
          .fontSize(10).fontColor(TOK_TTS_MUTED).height(14).maxLines(1);
      }.width('100%').alignItems(HorizontalAlign.Start);
    }.layoutWeight(1).height(87).padding(12).alignItems(HorizontalAlign.Start)
      .backgroundColor(this.isTtsServiceTabSelected(http) ? TOK_TTS_TEAL_SOFT : TOK_TTS_QUICK_CARD)
      .border({ width: this.isTtsServiceTabSelected(http) ? 1.5 : 0.5,
        color: this.isTtsServiceTabSelected(http) ? TOK_TTS_TEAL : TOK_TTS_LINE }).borderRadius(9)
      .accessibilityText(http ? this.onlineTtsAccessibilityText() : '系统 TTS，使用设备内置语音')
      .onClick((): void => this.selectTtsServiceType(http));
  }

  /** Existing read-only engine/language/session/failure values remain real. */
  @Builder
  private ttsClosedConfigPanel() {
    Column({ space: 0 }) {
      this.ttsClosedConfigRow('engine'); this.ttsClosedConfigRow('language');
      this.ttsClosedConfigRow('session'); this.ttsClosedConfigRow('failure');
    }.width('100%').height(192);
  }
  @Builder
  private ttsClosedConfigRow(kind: ReaderControlTtsField) {
    Row({ space: 8 }) {
      Text(this.fieldLabel(kind)).layoutWeight(1).fontFamily('ReaderInter')
        .fontSize(12).fontColor(TOK_TTS_INK).maxLines(1);
      this.ttsSelectValueField(kind);
    }.width('100%').height(48).padding({ left: 14, right: 14 }).alignItems(VerticalAlign.Center)
      .border({ width: { top: 0.5 }, color: TOK_TTS_LINE });
  }
  @Builder
  private sectionHeader(title: string, meta: string) {
    Row() {
      Text(title).layoutWeight(1).fontFamily('ReaderInter').fontWeight(FontWeight.Bold)
        .fontSize(12).fontColor(TOK_TTS_INK);
      Text(meta).fontFamily('ReaderInter').fontSize(10).fontColor(TOK_TTS_MUTED);
    }.width('100%').height(18).padding({ left: 3, right: 3 }).alignItems(VerticalAlign.Center);
  }
  @Builder
  private voiceSelectorRow() {
    Row() {
      Text('音色').layoutWeight(1).fontFamily('ReaderInter').fontSize(12).fontColor(TOK_TTS_INK);
      this.ttsSelectValueField('voice');
    }.width('100%').height(52).padding({ left: 14, right: 14 }).alignItems(VerticalAlign.Center)
      .enabled(this.voiceSelectionAvailable()).opacity(this.voiceSelectionAvailable() ? 1 : 0.72)
      .onClick((): void => { if (this.voiceSelectionAvailable()) this.selectNextVoice(); });
  }
  @Builder
  private ttsSelectValueField(kind: ReaderControlTtsField) {
    Row({ space: 6 }) {
      Text(this.fieldValue(kind)).layoutWeight(1).fontFamily('ReaderInter').fontSize(12)
        .fontColor(TOK_TTS_INK).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.End);
      if (kind === 'voice') {
        Image($r('app.media.reader_chevron_right')).width(12).height(12);
      }
    }.width(this.fieldWidth(kind)).height(kind === 'voice' ? 30 : 36)
      .padding({ left: 10, right: 8 }).alignItems(VerticalAlign.Center)
      .backgroundColor(kind === 'voice' ? TOK_TTS_FIELD : Color.Transparent).borderRadius(999)
      .accessibilityText(`${this.fieldLabel(kind)}：${this.fieldValue(kind)}${kind === 'voice' ? '' : '，暂不可展开'}`);
  }
  @Builder
  private toggleRow(kind: ReaderControlTtsToggle) {
    Row({ space: 8 }) {
      Text(kind === 'followHighlight' ? '跟随高亮' :
        (kind === 'pauseOnInterruption' ? '来电自动暂停' : '允许与其他应用同时播放'))
        .layoutWeight(1).fontFamily('ReaderInter').fontSize(12).fontColor(TOK_TTS_INK)
        .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
      ReaderControlSwitchTrack({ value: this.toggleValue(kind), trackWidth: 42,
        activeColor: TOK_TTS_TEAL, inactiveColor: '#C6BFB2', thumbColor: TOK_TTS_PAPER })
        .enabled(true).opacity(1).onClick((): void => this.changeToggle(kind));
    }.width('100%').height(48).padding({ left: 14, right: 14 }).alignItems(VerticalAlign.Center)
      .border({ width: { top: 0.5 }, color: TOK_TTS_LINE });
  }

  private voiceSelectionAvailable(): boolean {
    return !this.isHttpEngineSelected() && this.voiceOptions.length > 1;
  }

  private fieldLabel(kind: ReaderControlTtsField): string {
    if (kind === 'voice') return '音色选项';
    if (kind === 'engine') return '系统引擎';
    if (kind === 'language') return '语言';
    return kind === 'session' ? '音频会话' : '不可用处理';
  }

  private fieldValue(kind: ReaderControlTtsField): string {
    if (kind === 'voice') return this.currentVoiceLabel();
    if (kind === 'engine') return this.systemEngineDisplay();
    if (kind === 'language') return this.language;
    if (kind === 'session') return this.allowMixing ? '混音播放' : '语音播放';
    return this.failurePolicy === 'skip' ? '跳过不可用内容' : '提示安装或启用';
  }

  private fieldWidth(kind: ReaderControlTtsField): number {
    return Math.max(70, Math.min(170, this.frame().config.width * 0.56));
  }

  private toggleValue(kind: ReaderControlTtsToggle): boolean {
    if (kind === 'followHighlight') return this.followHighlight;
    return kind === 'pauseOnInterruption' ? this.pauseOnInterruption : this.allowMixing;
  }

  private changeToggle(kind: ReaderControlTtsToggle): void {
    const next = !this.toggleValue(kind);
    if (kind === 'followHighlight') this.onFollowHighlightChange(next);
    else if (kind === 'pauseOnInterruption') this.onPauseOnInterruptionChange(next);
    else this.onAllowMixingChange(next);
  }

  private timerSummary(): string {
    return `${this.twoDigits(this.timerMinutes)}:${this.twoDigits(this.timerSeconds)}`;
  }

  private stepTimer(minutes: boolean, delta: number): void {
    const nextMinutes = minutes ? Math.max(READER_TTS_TIMER_MIN,
      Math.min(READER_TTS_TIMER_MAX_MINUTES, this.timerMinutes + delta)) : this.timerMinutes;
    const nextSeconds = minutes ? this.timerSeconds : Math.max(READER_TTS_TIMER_MIN,
      Math.min(READER_TTS_TIMER_MAX_SECONDS, this.timerSeconds + delta));
    this.onTimerChange(nextMinutes, nextSeconds);
  }

  private twoDigits(value: number): string {
    const normalized = Math.max(READER_TTS_TIMER_MIN, Math.trunc(value));
    return normalized < 10 ? `0${normalized}` : `${normalized}`;
  }

  private effectiveRate(): number {
    return this.ratePreview >= READER_TTS_RATE_MIN ? this.ratePreview : this.state.rate;
  }

  private isHttpEngineSelected(): boolean {
    return this.engine.startsWith('http-tts:');
  }

  private isTtsServiceTabSelected(http: boolean): boolean {
    return http === this.isHttpEngineSelected();
  }

  private selectTtsServiceType(http: boolean): void {
    if (!http) {
      if (this.isHttpEngineSelected()) this.requestEngineChange('system');
      return;
    }
    if (this.isHttpEngineSelected() || this.httpEngines.length === 0) return;
    this.requestEngineChange(`http-tts:${this.httpEngines[0].id}`);
  }

  private onlineTtsAccessibilityText(): string {
    if (this.httpEngines.length === 0) return '在线 TTS，尚未配置第三方或自定义服务';
    return `在线 TTS，${this.httpEngines.length} 个已配置服务`;
  }

  private systemEngineDisplay(): string {
    return this.isHttpEngineSelected() ? this.currentEngineLabel() : '系统默认';
  }

  private currentEngineLabel(): string {
    if (!this.isHttpEngineSelected()) return '系统离线';
    const id = Number(this.engine.slice('http-tts:'.length));
    return this.httpEngines.find((option: ReaderTtsEngineOption): boolean => option.id === id)?.name ?? '在线配置失效';
  }

  private currentVoiceLabel(): string {
    return this.voiceOptions.find((option: ReaderTtsVoiceOption): boolean =>
      option.language === this.language && option.person === this.person)?.label ??
      `${this.language} · 音色 ${this.person}`;
  }

  private selectNextVoice(): void {
    if (this.voiceOptions.length === 0) return;
    const index = this.voiceOptions.findIndex((option: ReaderTtsVoiceOption): boolean =>
      option.language === this.language && option.person === this.person);
    const next = this.voiceOptions[(index + 1 + this.voiceOptions.length) % this.voiceOptions.length];
    this.onVoiceChange(next.language, next.person);
  }

  private statusText(): string {
    if (this.state.status === 'playing') return '播放中';
    if (this.state.status === 'paused') return '已暂停';
    if (this.state.status === 'interrupted') return '已中断';
    if (this.state.status === 'probing') return '正在检查朗读可用性';
    if (this.state.status === 'preparing' || this.state.status === 'resuming') return '准备中';
    if (this.state.status === 'completed') return '已完成';
    if (this.state.status === 'stopping') return '停止中';
    if (this.state.status === 'error') return '播放失败';
    if (this.state.status === 'failed') return '播放失败';
    if (this.state.status === 'unavailable') return '当前引擎不可用';
    return '未开始';
  }

  private requestEngineChange(engine: string): void {
    void this.onEngineChange(engine).catch((_error: Error): void => {
      // The owner projects the same failure into ReaderTtsState; the manager
      // variant additionally keeps its inline draft/error surface.
    });
  }

  private controlText(kind: 'previous' | 'toggle' | 'stop' | 'next'): string {
    if (kind === 'previous') return '上一句';
    if (kind === 'next') return '下一句';
    if (kind === 'stop') return '停止朗读';
    if (kind === 'toggle' && (this.state.status === 'error' || this.state.status === 'failed')) return '重试朗读';
    return this.isActivelySpeaking() ? '暂停朗读' : '开始或继续朗读';
  }

  private isActivelySpeaking(): boolean {
    return this.state.status === 'preparing' || this.state.status === 'playing' || this.state.status === 'resuming';
  }

  private hasActiveQueue(): boolean {
    return this.state.status === 'preparing' || this.state.status === 'playing' ||
      this.state.status === 'paused' || this.state.status === 'resuming' || this.state.status === 'interrupted';
  }
}
