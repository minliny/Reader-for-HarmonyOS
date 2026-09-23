import { ReaderTtsWaveform } from './ReaderTtsWaveform';
import type { ReaderTtsWaveformSample } from './ReaderTtsWaveformModel';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { PathShape } from '@ohos.arkui.shape';
import { createReaderControlMorphScroll, advanceReaderControlMorphScroll, observeReaderControlMorphScroll,
  readerControlMorphScrollTranslation, readerControlMorphScrollExtent, readerControlMorphScrollAllowsNative,
  type ReaderControlMorphScrollState } from './ReaderControlMorphScroll';
import {
  READER_TTS_RATE_MAX, READER_TTS_RATE_MIN, READER_TTS_RATE_STEP, READER_TTS_RATE_STEP_SCALE,
  READER_TTS_TIMER_DEFAULT_MINUTES, READER_TTS_TIMER_MAX_MINUTES, READER_TTS_TIMER_MAX_SECONDS,
  READER_TTS_TIMER_MIN, type ReaderTtsState, type ReaderTtsTimerMode,
} from './ReaderTtsState';
import type { ReaderTtsVoiceOption } from './ReaderTtsPreferencesState';
import { ReaderTtsConfigOverlay } from './ReaderTtsConfigOverlay';
import { readerTtsConfigChoices, readerTtsVoiceId, readerTtsLanguageLabel,
  type ReaderTtsConfigChoice, type ReaderTtsConfigField } from './ReaderTtsConfigOptions';
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
  TOK_TTS_LINE, TOK_TTS_FIELD, TOK_TTS_TRACK, readerTtsPlayGradientStart } from './ReaderControlTtsStyle';
import { sampleReaderControlMotionPresentation, ReaderControlMotionPathCache, readerControlMotionOutlineOpacity,
  readerControlMotionClipRects, readerControlMotionClipPath,
  type ReaderControlMotionPresentation } from './ReaderControlMotionPresentation';

type ReaderControlTtsSection = 'playback' | 'timer' | 'speed';
type ReaderControlTtsField = 'voice' | 'engine' | 'language' | 'session' | 'failure';
type ReaderControlTtsToggle = 'followHighlight' | 'pauseOnInterruption' | 'allowMixing' |
  'backgroundPlayback' | 'keepScreenOn';

/** Make v17 redraw on persistent Playback/Timer/Speed actors.
 * All actors consume the production Runtime's one p. Header, grabber, shell and whole visibility are
 * intentionally absent here. Business commands remain supplied by the owner. */
@Component
export struct ReaderControlTtsContent {
  @StorageLink('readerAppScheme') @Watch('reportMorphActor') private appScheme: string = 'day';

  // Pure retained source projections have no Scroll, IDs, callbacks or modal hosts.
  @Prop sourceOnly: 'none' | 'quick' | 'full' = 'none';
  @Prop frozenWaveformSample: ReaderTtsWaveformSample | undefined = undefined;
  @Prop reduceMotion: boolean = false;
  @Prop waveformActive: boolean = true;
  @Prop @Watch('onSourceDetachedChanged') sourceDetached: boolean = false;
  onMorphActorVisible: (kind: ReaderSessionMorphSourceKind) => void =
    (_kind: ReaderSessionMorphSourceKind): void => {};

  private onSourceDetachedChanged(): void {
    if (this.sourceOnly !== 'none' || this.sourceDetached) return;
    const measured = this.form === 'full' ? this.fullMeasurement : this.quickMeasurement;
    if (measured === undefined || measured.width <= 0 || measured.height <= 0) return;
    this.reportMorphActor();
    this.onMorphActorVisible(readerControlPlaybackSourceKind('tts', this.form));
  }

  private reportActorVisible(full: boolean, visible: boolean, ratio: number): void {
    if (this.sourceOnly !== 'none' || this.sourceDetached || !visible || ratio <= 0 ||
      (this.form === 'full') !== full) return;
    this.reportMorphActor();
    this.onMorphActorVisible(readerControlPlaybackSourceKind('tts', this.form));
  }
  @Prop @Watch('onMotionChanged') motionProgress: number = 0;
  @Prop availableWidth: number = 286;
  @Prop availableHeight: number = 190;
  @Prop isTablet: boolean = false;
  @Prop @Watch('onMotionChanged') interactionEnabled: boolean = true;
  @Prop @Watch('reportMorphActor') form: ReaderControlForm = 'quick';
  @Prop state: ReaderTtsState;
  @Prop timerMode: ReaderTtsTimerMode = 'duration';
  @Prop timerMinutes: number = READER_TTS_TIMER_DEFAULT_MINUTES;
  @Prop timerSeconds: number = 0;
  @Prop followHighlight: boolean = true;
  @Prop pauseOnInterruption: boolean = true;
  @Prop allowMixing: boolean = false;
  @Prop backgroundPlayback: boolean = true;
  @Prop keepScreenOn: boolean = false;
  @Prop failurePolicy: 'skip' | 'stop' = 'stop';
  @Prop @Watch('onEngineChanged') engine: string = 'system';
  @Prop httpEngines: ReaderTtsEngineOption[] = [];
  @Prop voiceOptions: ReaderTtsVoiceOption[] = [];
  @Prop language: string = 'zh-CN';
  @Prop person: number = 0;
  @Prop @Watch('dismissConfiguration') dismissTemporaryRevision: number = 0;
  onTemporaryLayerChange: (active: boolean) => void = (_active: boolean): void => {};
  onCollapse: () => void = (): void => {};
  onToggle: () => void = (): void => {};
  onStop: () => void = (): void => {};
  onPrevious: () => void = (): void => {};
  onNext: () => void = (): void => {};
  onSeek: (sliceIndex: number) => void = (_sliceIndex: number): void => {};
  onTimerChange: (minutes: number, seconds: number, mode?: ReaderTtsTimerMode) => void =
    (_minutes: number, _seconds: number, _mode?: ReaderTtsTimerMode): void => {};
  onRateChange: (rate: number) => void = (_rate: number): void => {};
  onFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onPauseOnInterruptionChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onAllowMixingChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onBackgroundPlaybackChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onKeepScreenOnChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onFailurePolicyChange: (policy: 'skip' | 'stop') => void = (_policy: 'skip' | 'stop'): void => {};
  onVoiceAudition: (language: string, person: number) => Promise<void> =
    (_language: string, _person: number): Promise<void> => Promise.resolve();
  onAuditionStop: () => void = (): void => {};
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
  private committedSliderRate: number = -1;
  private committedSliderSeek: number = -1;
  @State private configField: ReaderTtsConfigField | 'manage' | '' = '';
  @State private configIdentity: string = '';
  @State private managerBusy: boolean = false;
  @State private serviceTab: string = '';
  @State private serviceBusy: boolean = false;
  @State private serviceError: string = '';
  private serviceGeneration: number = 0;
  private cachedOnlinePage: boolean = false;
  private configGeneration: number = 0;
  @State private scrollMotion: ReaderControlMorphScrollState = createReaderControlMorphScroll();
  @Prop fullViewportHeight: number = 666;
  private readonly scroller: Scroller = new Scroller();
  private quickMeasurement: ReaderControlPlaybackMeasuredRect | undefined = undefined;
  private fullMeasurement: ReaderControlPlaybackMeasuredRect | undefined = undefined;
  private fullMeasurementScrollOffset: number = 0;
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
      this.cachedRate !== rate || this.cachedSeek !== seek || this.cachedOnlinePage !== this.onlineServicePage()) {
      this.cachedProgress = this.motionProgress; this.cachedWidth = this.availableWidth;
      this.cachedRate = rate; this.cachedSeek = seek; this.cachedOnlinePage = this.onlineServicePage();
      this.cachedFrame = sampleReaderControlTts(this.motionProgress, this.availableWidth, rate, seek, this.cachedOnlinePage);
    }
    return this.cachedFrame;
  }
  private onMotionChanged(): void {
    if (this.sourceOnly !== 'none') return;
    this.syncMorphScroll();
    if (!this.sharedInput()) this.ratePreview = -1;
    if (!this.fullInput()) this.dismissConfiguration();
  }
  aboutToDisappear(): void { if (this.sourceOnly !== 'none') return; this.serviceGeneration += 1; this.dismissConfiguration(); }

  private dismissConfiguration(): void {
    if (this.sourceOnly !== 'none') return;
    this.onAuditionStop();
    this.configGeneration += 1;
    this.configField = '';
    this.configIdentity = '';
    this.onTemporaryLayerChange(false);
  }

  private openConfiguration(field: ReaderTtsConfigField | 'manage'): void {
    if (!this.fullInput()) return;
    this.configField = field;
    this.configIdentity = `${field}:${++this.configGeneration}`;
    this.onTemporaryLayerChange(true);
  }

  private configurationChoices(): ReaderTtsConfigChoice[] {
    const online = this.onlineServicePage();
    return readerTtsConfigChoices(this.configField === '' || this.configField === 'manage' ? 'engine' : this.configField,
      online ? 'http-tts:configuration' : this.engine, this.httpEngines, this.voiceOptions);
  }

  private configurationSelectedId(): string {
    if (this.configField === 'engine' || this.configField === 'manage') return this.engine;
    if (this.configField === 'language') return this.language;
    if (this.configField === 'voice') return `voice:${this.language}:${this.person}`;
    if (this.configField === 'session') return this.allowMixing ? 'mix' : 'exclusive';
    return this.failurePolicy;
  }

  private configurationMessage(): string {
    if (this.configField !== 'voice' && this.configField !== 'language') return '';
    if (this.onlineServicePage()) return '音色和语言由在线服务的配置决定，可在“管理在线 TTS”中编辑。';
    return this.voiceOptions.length === 0 ? '当前没有可用的系统音色，请先在系统中安装或启用语音服务，也可以配置在线 TTS。' : '';
  }

  private async previewConfigurationVoice(id: string, identity: string): Promise<void> {
    if (!this.fullInput() || identity !== this.configIdentity || this.configField !== 'voice') return;
    const voice = this.voiceOptions.find((item: ReaderTtsVoiceOption): boolean => readerTtsVoiceId(item) === id);
    if (voice === undefined) throw new Error('当前音色已不可用，请重新选择');
    await this.onVoiceAudition(voice.language, voice.person);
  }

  private async commitConfiguration(id: string, identity: string): Promise<void> {
    if (!this.fullInput() || identity !== this.configIdentity || this.configField === '' ||
      !this.configurationChoices().some((choice: ReaderTtsConfigChoice): boolean => choice.id === id)) return;
    const field = this.configField;
    if (field === 'engine' || field === 'manage') {
      if (id !== this.engine) await this.onEngineChange(id);
    } else if (field === 'session') {
      if ((id === 'mix') !== this.allowMixing) this.onAllowMixingChange(id === 'mix');
    } else if (field === 'failure') {
      if (id !== this.failurePolicy) this.onFailurePolicyChange(id === 'skip' ? 'skip' : 'stop');
    } else {
      const voice = field === 'voice' ? this.voiceOptions.find((item: ReaderTtsVoiceOption): boolean => readerTtsVoiceId(item) === id) :
        this.voiceOptions.find((item: ReaderTtsVoiceOption): boolean => item.language === id && item.person === this.person) ??
        this.voiceOptions.find((item: ReaderTtsVoiceOption): boolean => item.language === id);
      if (voice !== undefined && (voice.language !== this.language || voice.person !== this.person))
        this.onVoiceChange(voice.language, voice.person);
    }
  }
  private syncMorphScroll(): void {
    const offset = this.scroller.currentOffset()?.yOffset;
    if (offset === undefined || !Number.isFinite(offset)) return;
    const update = advanceReaderControlMorphScroll(this.scrollMotion, this.motionProgress,
      this.interactionEnabled, offset);
    this.scrollMotion = update.state;
    if (update.targetOffset !== undefined) {
      this.scroller.scrollTo({ xOffset: 0, yOffset: update.targetOffset, animation: false });
      this.onFullDidScroll();
    }
  }
  private onFullDidScroll(): void {
    if (this.sourceOnly !== 'none') return;
    const offset = this.scroller.currentOffset()?.yOffset;
    if (offset === undefined || !Number.isFinite(offset)) return;
    this.scrollMotion = observeReaderControlMorphScroll(this.scrollMotion,
      offset, this.fullInput());
    this.reportMorphActor();
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
  private cachedPaint: ReaderControlMotionPresentation | undefined = undefined;
  private paintProgress: number = -1;
  private presentation(): ReaderControlMotionPresentation {
    if (this.cachedPaint === undefined || this.paintProgress !== this.motionProgress) {
      this.paintProgress = this.motionProgress;
      this.cachedPaint = sampleReaderControlMotionPresentation(this.motionProgress);
    }
    return this.cachedPaint;
  }
  private outlineOpacity(kind: ReaderControlTtsSection): number {
    const seek = (this.state.totalSlices > 1 ? 32 : 0) + (this.state.errorMessage ? 24 : 0);
    const full = sampleReaderControlTts(1, this.availableWidth, 0, seek);
    const actor = kind === 'playback' ? full.playback : kind === 'timer' ? full.timer : full.speed;
    return readerControlMotionOutlineOpacity(this.motionProgress, actor.y, actor.height,
      this.fullViewportHeight, this.scrollMotion.fullScrollOffset);
  }
  private fullInput(): boolean { return this.interactionEnabled && this.p() === 1; }
  private pathCache: ReaderControlMotionPathCache<PathShape> = new ReaderControlMotionPathCache<PathShape>(
    (path: string): PathShape => new PathShape().commands(path));
  private sharedClip(kind: ReaderControlTtsSection): PathShape {
    const density = this.getUIContext().vp2px(1);
    return this.pathCache.sample(kind, [this.motionProgress, this.availableWidth, this.fullViewportHeight,
      this.scrollMotion.fullScrollOffset, density, this.state.totalSlices > 1 ? 32 : 0, this.state.errorMessage ? 24 : 0, this.effectiveRate()], (): string => {
      const seek = (this.state.totalSlices > 1 ? 32 : 0) + (this.state.errorMessage ? 24 : 0);
      const full = sampleReaderControlTts(1, this.availableWidth, 0, seek);
      const quick = sampleReaderControlTts(0, this.availableWidth, 0, seek);
      const current = this.frame();
      const a = kind === 'playback' ? full.playback : kind === 'timer' ? full.timer : full.speed;
      const b = kind === 'playback' ? current.playback : kind === 'timer' ? current.timer : current.speed;
      const c = kind === 'playback' ? quick.playback : kind === 'timer' ? quick.timer : quick.speed;
      const clips = readerControlMotionClipRects(this.p(), a, b, c,
        this.fullViewportHeight, this.scrollMotion.fullScrollOffset);
      return readerControlMotionClipPath(kind === 'timer' ?
        readerControlTtsTimerVisibleRects(clips, current,
          readerControlMotionClipRects(this.p(), full.speed, current.speed, quick.speed,
            this.fullViewportHeight, this.scrollMotion.fullScrollOffset)) : clips, density);
    });
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
    if (this.sourceOnly !== 'none') return '';
    if ((this.form === 'full') === full) return readerSessionMorphActorId(readerControlPlaybackSourceKind('tts', this.form));
    return full ? 'reader-control-tts-playback' : 'reader-control-tts-viewport';
  }
  private measureActor(full: boolean, area: Area): void {
    if (this.sourceOnly !== 'none' || this.sourceDetached) return;
    const rect: ReaderControlPlaybackMeasuredRect = { left: Number(area.globalPosition.x),
      top: Number(area.globalPosition.y), width: Number(area.width), height: Number(area.height) };
    if (full) {
      const offset = this.scroller.currentOffset()?.yOffset;
      if (offset === undefined || !Number.isFinite(offset)) return;
      this.fullMeasurement = rect;
      this.fullMeasurementScrollOffset = offset;
    } else this.quickMeasurement = rect;
    this.reportMorphActor();
  }
  private reportMorphActor(): void {
    if (this.sourceOnly !== 'none' || this.sourceDetached) return;
    const full = this.fullMeasurement;
    let scrolled: ReaderControlPlaybackMeasuredRect | undefined = undefined;
    if (this.form === 'full' && full !== undefined) {
      const offset = this.scroller.currentOffset()?.yOffset;
      if (offset === undefined || !Number.isFinite(offset)) return;
      scrolled = { left: full.left, top: full.top - (offset - this.fullMeasurementScrollOffset),
        width: full.width, height: full.height };
    }
    const rect = readerControlPlaybackMeasuredSource(this.form, this.quickMeasurement, scrolled);
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
    if (this.sourceOnly !== 'none') {
      this.launchSourceContent();
    } else {
      this.normalContent();
    }
  }


  @Builder
  private launchSourceContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack({ alignContent: Alignment.TopStart }) {
        this.playback();
        if (this.sourceOnly === 'quick') { this.timer(); this.speed(); }
      }.width(this.availableWidth).height(this.availableHeight)
        .translate({ x: this.sourceOnly === 'full' ? -this.frame().playback.x : 0,
          y: this.sourceOnly === 'full' ? -this.frame().playback.y : 0 });
    }.width(this.sourceOnly === 'full' ? this.frame().playback.width : this.availableWidth)
      .height(this.sourceOnly === 'full' ? this.frame().playback.height : this.availableHeight)
      .clip(true).enabled(false).hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants');
  }

  @Builder
  private normalContent() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.quickBackdrop();
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
        .edgeEffect(EdgeEffect.None).enableScrollInteraction(this.fullInput() && this.configField === '')
        .onAppear((): void => this.syncMorphScroll())
        .onWillScroll((_x: number, y: number, _state: ScrollState, source: ScrollSource): OffsetResult =>
          this.nativeScrollDelta(y, source))
        .onDidScroll((): void => this.onFullDidScroll());
      this.configurationOverlay();
    }.width(this.availableWidth).height(this.availableHeight).clip(true)
      .opacity(this.sourceDetached && this.form === 'quick' ? 0 : 1)
      .id(this.actorId(false)).onAreaChange((_old: Area, area: Area): void => this.measureActor(false, area))
      .onVisibleAreaChange([0, 0.01, 1], (visible: boolean, ratio: number): void => this.reportActorVisible(false, visible, ratio))
      .bindContentCover(this.configField === 'manage', this.managerOverlay(), {
        modalTransition: ModalTransition.NONE, backgroundColor: Color.Transparent,
        onWillDismiss: (action: DismissContentCoverAction): void => {
          if (!this.managerBusy) { action.dismiss(); this.dismissConfiguration(); }
        },
      });
  }

  @Builder
  private quickBackdrop() {
    Row().width(this.availableWidth).height(this.availableHeight)
        .linearGradient({ angle: 155, colors: [[readerAppColor('app.control.paint.FFFAF4', this.appScheme), 0], [readerAppColor('app.control.paint.F6ECDD', this.appScheme), 1]] })
        .border({ width: 0.5, color: readerAppColor('app.control.paint.66B4A697', this.appScheme) }).borderRadius(8)
        .opacity(1 - this.p()).hitTestBehavior(HitTestMode.None);
  }

  private configurationAnchorY(): number {
    const nativeOffset = this.scroller.currentOffset()?.yOffset;
    const offset = nativeOffset !== undefined && Number.isFinite(nativeOffset) ?
      nativeOffset : this.scrollMotion.nativeScrollOffset;
    if (this.configField === 'voice') return this.frame().detail.y + 26 + 52 - offset;
    if (this.configField === 'failure') return this.frame().detail.y + 270 - offset;
    const row = this.configField === 'language' ? 1 : 0;
    return this.frame().config.y + 26 + 116 + (row + 1) * 48 - offset;
  }

  @Builder
  private managerOverlay() {
    ReaderTtsConfigOverlay({ title: '第三方 TTS 配置', manager: true, windowModal: true,
      engines: this.httpEngines, engine: this.onlineEngineId(), selectionId: this.configIdentity,
      onChoose: (id: string, identity: string): Promise<void> => this.commitConfiguration(id, identity),
      onPut: this.onHttpEnginePut, onDelete: this.onHttpEngineDelete,
      onBusyChange: (busy: boolean): void => { this.managerBusy = busy; },
      onClose: (identity: string): void => { if (identity === this.configIdentity) this.dismissConfiguration(); },
    });
  }

  @Builder
  private configurationOverlay() {
    if (this.configField !== '' && this.configField !== 'manage') {
      ReaderTtsConfigOverlay({ title: this.fieldLabel(this.configField),
        choices: this.configurationChoices(), selectedId: this.configurationSelectedId(),
        message: this.configurationMessage(), manager: false,
        showManage: this.configField === 'engine' || this.configurationMessage().length > 0,
        availableWidth: this.availableWidth, availableHeight: this.availableHeight,
        anchorY: this.configurationAnchorY(), voicePicker: this.configField === 'voice',
        engines: this.httpEngines, engine: this.engine, selectionId: this.configIdentity,
        onChoose: (id: string, identity: string): Promise<void> => this.commitConfiguration(id, identity),
        onPreview: (id: string, identity: string): Promise<void> => this.previewConfigurationVoice(id, identity),
        onPreviewStop: (): void => this.onAuditionStop(),
        onPut: this.onHttpEnginePut, onDelete: this.onHttpEngineDelete,
        onManage: (): void => this.openConfiguration('manage'),
        onClose: (identity: string): void => { if (identity === this.configIdentity) this.dismissConfiguration(); },
      });
    }
  }

  private headerActor(kind: ReaderControlTtsSection): ReaderControlActorFrame {
    if (kind === 'playback') return this.frame().playbackHeader;
    return kind === 'timer' ? this.frame().timerHeader : this.frame().speedHeader;
  }

  private headerMeta(kind: ReaderControlTtsSection): string {
    if (kind === 'playback') return this.statusText();
    return kind === 'timer' ? this.timerSummary() : this.effectiveRate().toFixed(2) + 'x';
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
        .layoutWeight(1).fontFamily('ReaderNotoSansSCUIBold').fontWeight(FontWeight.Bold)
        .fontSize(12).fontColor(readerAppColor('TOK_TTS_INK', this.appScheme));
      Row({ space: 5 }) {
        if (kind === 'playback') {
          Row().width(5).height(5).borderRadius(999)
            .backgroundColor(this.isActivelySpeaking() ? readerAppColor('TOK_TTS_TEAL', this.appScheme) : readerAppColor('app.control.paint.B4A697', this.appScheme));
        } else if (kind === 'timer') {
          Image($r(this.appScheme === 'night' ? 'app.media.reader_tts_clock_theme_night' : 'app.media.reader_tts_clock')).width(13).height(13);
        }
        Text(this.headerMeta(kind)).fontFamily(kind === 'speed' ? 'ReaderInter' : 'ReaderNotoSansSCUIMedium')
          .fontWeight(FontWeight.Medium, { enableVariableFontWeight: true }).fontSize(kind === 'speed' ? 11 : 10)
          .lineHeight(14).fontColor(kind === 'timer' && this.timerMode === 'off' ? readerAppColor('TOK_TTS_MUTED', this.appScheme) :
            kind === 'playback' && !this.isActivelySpeaking() ? readerAppColor('TOK_TTS_MUTED', this.appScheme) : readerAppColor('TOK_TTS_TEAL', this.appScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.height(18).padding({ left: kind === 'playback' ? 8 : 0, right: kind === 'playback' ? 8 : 0 })
        .borderRadius(999).backgroundColor(kind === 'playback' ?
          (this.isActivelySpeaking() ? readerAppColor('app.control.paint.1A2F6373', this.appScheme) : readerAppColor('TOK_TTS_FIELD', this.appScheme)) : Color.Transparent)
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
        Image($r(kind === 'playback' ? (this.appScheme === 'night' ? 'app.media.reader_tts_headphones_theme_night' : 'app.media.reader_tts_headphones') :
          (kind === 'timer' ? (this.appScheme === 'night' ? 'app.media.reader_tts_clock_theme_night' : 'app.media.reader_tts_clock') : (this.appScheme === 'night' ? 'app.media.reader_tts_rate_theme_night' : 'app.media.reader_tts_rate'))))
          .width(kind === 'playback' ? 18 : 16).height(kind === 'playback' ? 18 : 16);
      }.width(kind === 'playback' ? 34 : 26).height(kind === 'playback' ? 34 : 26)
        .backgroundColor(readerAppColor('TOK_TTS_TEAL_SOFT', this.appScheme)).borderRadius(kind === 'playback' ? 10 : 8)
        .border({ width: 0.5, color: readerAppColor('TOK_TTS_TEAL_LINE', this.appScheme) });
      Column({ space: 0 }) {
        Text(kind === 'playback' ? '播放' : (kind === 'timer' ? '定时' : '语速'))
          .fontFamily('ReaderNotoSansSCUIBold').fontWeight(FontWeight.Bold).fontSize(kind === 'playback' ? 13 : 12)
          .fontColor(readerAppColor('TOK_TTS_INK', this.appScheme)).height(kind === 'playback' ? 16 : 18).maxLines(1);
        if (kind === 'playback') {
          Row({ space: 4 }) {
            Row().width(5).height(5).borderRadius(3)
              .backgroundColor(this.isActivelySpeaking() ? readerAppColor('TOK_TTS_TEAL', this.appScheme) : readerAppColor('app.control.paint.B4A697', this.appScheme));
            Text(this.playbackLabel()).fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(10)
              .fontColor(this.isActivelySpeaking() ? readerAppColor('TOK_TTS_TEAL', this.appScheme) : readerAppColor('TOK_TTS_MUTED', this.appScheme))
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
      Row().width('100%').height('100%').backgroundColor(readerAppColor('TOK_TTS_QUICK_CARD', this.appScheme))
        .opacity(1 - this.p()).hitTestBehavior(HitTestMode.None);
      Row().width('100%').height('100%').backgroundColor(readerAppColor('TOK_TTS_CARD', this.appScheme))
        .opacity(this.p()).hitTestBehavior(HitTestMode.None);
      Row().width('100%').height(1).backgroundColor(readerAppColor('app.control.paint.99FFFFFF', this.appScheme))
        .position({ x: 0, y: 0 }).opacity(this.p()).hitTestBehavior(HitTestMode.None);
    }.width(this.sectionActor(kind).width)
      .height(this.sectionActor(kind).height - this.surfaceY(kind))
      .position({ x: 0, y: this.surfaceY(kind) })
      .border({ width: 0.5, color: readerAppColor('TOK_TTS_LINE', this.appScheme) })
      .borderRadius(9 + 5 * this.p()).clip(true).opacity(this.outlineOpacity(kind))
      .hitTestBehavior(HitTestMode.None);
  }

  @Builder
  private playback() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.sourceOnly !== 'full') { this.sectionSurface('playback'); }
      Stack({ alignContent: Alignment.TopStart }) {
        Row().width(3).height(42).borderRadius(2)
          .backgroundColor(this.isActivelySpeaking() ? readerAppColor('TOK_TTS_TEAL', this.appScheme) : readerAppColor('app.control.paint.B4A697', this.appScheme))
          .position({ x: 0, y: 12 }).opacity(1 - this.p()).hitTestBehavior(HitTestMode.None);
        this.moduleHeader('playback');
        this.quickLabel('playback');
        this.waveform();
        this.roundControl('previous'); this.roundControl('toggle');
        this.roundControl('stop'); this.roundControl('next');
        Row({ space: 6 }) {
          Image($r(this.appScheme === 'night' ? 'app.media.reader_tts_header_theme_night' : 'app.media.reader_tts_header')).width(16).height(16);
          Text('当前音色 · ' + this.currentVoiceLabel()).fontFamily('ReaderNotoSansSCUIMedium').fontSize(11).fontWeight(FontWeight.Medium)
            .fontColor(readerAppColor('app.control.paint.5B5046', this.appScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1);
        }.width(this.frame().voice.width).height(this.frame().voice.height).alignItems(VerticalAlign.Center)
          .position({ x: this.frame().voice.x, y: this.frame().voice.y })
          .opacity(this.frame().voice.opacity).hitTestBehavior(HitTestMode.None);
        if (this.state.totalSlices > 1) {
          Slider({ value: this.state.sliceIndex ?? 0, min: 0, max: this.state.totalSlices - 1,
            step: 1, style: SliderStyle.OutSet, direction: Axis.Horizontal, reverse: false })
            .width(this.frame().playback.width - 32).height(24).position({ x: 16, y: 198 })
            .selectedColor(readerAppColor('TOK_TTS_TEAL', this.appScheme)).enabled(this.fullInput()).opacity(this.p())
            .accessibilityText('跳转朗读句子')
            .onChange((value: number, mode: SliderChangeMode): void => {
              this.changeSeekSlider(value, mode);
            });
        }
        if (this.state.errorMessage !== undefined && this.state.errorMessage.length > 0) {
          Text(this.state.errorMessage).width(this.frame().playback.width - 32).height(24)
            .fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(10).lineHeight(12).fontColor(readerAppColor('TOK_TTS_CLAY', this.appScheme)).maxLines(2)
            .position({ x: 16, y: this.state.totalSlices > 1 ? 230 : 198 }).opacity(this.p());
        }
      }.width(this.frame().playback.width).height(this.frame().playback.height)
        .opacity(this.presentation().contentOpacity).blur(this.presentation().contentBlur)
        .accessibilityLevel(this.sharedInput() ? 'auto' : 'no-hide-descendants');
    }.width(this.frame().playback.width).height(this.frame().playback.height)
      .position({ x: this.frame().playback.x, y: this.frame().playback.y })
      .translate({ y: this.sharedScrollTranslation() }).clipShape(this.sharedClip('playback'))
      .opacity(this.sourceDetached && this.form === 'full' ? 0 : 1)
      .id(this.actorId(true)).onAreaChange((_old: Area, area: Area): void => this.measureActor(true, area))
      .onVisibleAreaChange([0, 0.01, 1], (visible: boolean, ratio: number): void => this.reportActorVisible(true, visible, ratio));
  }

  @Builder
  private waveform() {
    ReaderTtsWaveform({ playing: this.isActivelySpeaking(), appThemeScheme: this.appScheme,
      frozen: this.sourceOnly !== 'none', frozenSample: this.frozenWaveformSample, reduceMotion: this.reduceMotion,
      active: this.waveformActive })
      .width(this.frame().waveform.width).height(this.frame().waveform.height)
      .position({ x: this.frame().waveform.x, y: this.frame().waveform.y })
      .opacity(this.frame().waveform.opacity).hitTestBehavior(HitTestMode.None).accessibilityLevel('no');
  }

  @Builder
  private roundControl(kind: ReaderControlTransportKind) {
    Stack({ alignContent: Alignment.Center }) {
      if (kind === 'toggle') {
        Row().width('100%').height('100%').borderRadius(999)
          .linearGradient({ angle: 155, colors: [[readerTtsPlayGradientStart(this.p(), this.appScheme), 0], [readerAppColor('TOK_TTS_PLAY_END', this.appScheme), 1]] })
          .border({ width: { top: 0.5 }, color: readerAppColor('app.control.paint.33FFFFFF', this.appScheme) })
          .shadow({ radius: 6 + 2 * this.p(), color: readerAppColor('app.control.paint.5C2F6373', this.appScheme), offsetY: 4 });
      }
      Row({ space: 4 * this.p() }) {
        Image($r(kind === 'toggle' ? (this.isActivelySpeaking() ? (this.appScheme === 'night' ? 'app.media.reader_tts_make_pause_theme_night' : 'app.media.reader_tts_make_pause') : (this.appScheme === 'night' ? 'app.media.reader_tts_make_play_theme_night' : 'app.media.reader_tts_make_play')) :
          (kind === 'stop' ? 'app.media.reader_tts_make_stop' :
          (kind === 'previous' ? (this.p() === 0 ? (this.appScheme === 'night' ? 'app.media.reader_tts_make_previous_quick_theme_night' : 'app.media.reader_tts_make_previous_quick') : (this.appScheme === 'night' ? 'app.media.reader_tts_make_previous_theme_night' : 'app.media.reader_tts_make_previous')) : (this.p() === 0 ? (this.appScheme === 'night' ? 'app.media.reader_tts_make_next_quick_theme_night' : 'app.media.reader_tts_make_next_quick') : (this.appScheme === 'night' ? 'app.media.reader_tts_make_next_theme_night' : 'app.media.reader_tts_make_next'))))))
          .width(kind === 'toggle' ? 13 + 7 * this.p() : kind === 'stop' ? 10 : 14 + 12 * this.p())
          .height(kind === 'toggle' ? 13 + 7 * this.p() : kind === 'stop' ? 10 : 14 + 12 * this.p());
        if (kind === 'stop') {
          Text('停止').fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(11).fontColor(readerAppColor('TOK_TTS_CLAY', this.appScheme))
            .width(24 * this.p()).height(14).opacity(this.p()).maxLines(1);
        }
      }.justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center);
    }.width(this.transport(kind).width).height(this.transport(kind).height)
      .position({ x: this.transport(kind).x, y: this.transport(kind).y })
      .backgroundColor(kind === 'stop' ? readerAppColor('TOK_TTS_CLAY_SOFT', this.appScheme) : Color.Transparent)
      .border({ width: kind === 'stop' ? 0.5 : 0, color: readerAppColor('TOK_TTS_CLAY_LINE', this.appScheme) }).borderRadius(999)
      .enabled(this.sharedInput() && !this.serviceBusy && !(this.onlineServicePage() && !this.isHttpEngineSelected()) && (kind === 'toggle' ?
        this.state.status !== 'stopping' : this.hasActiveQueue()))
      .opacity((kind === 'toggle' || this.hasActiveQueue()) ? 1 : 0.42)
      .accessibilityText(this.controlText(kind)).onClick((): void => {
        if (!this.sharedInput() || this.serviceBusy || (this.onlineServicePage() && !this.isHttpEngineSelected())) return;
        if (kind === 'toggle' && this.state.status === 'stopping') return;
        if (kind !== 'toggle' && !this.hasActiveQueue()) return;
        if (kind === 'previous') this.onPrevious(); else if (kind === 'next') this.onNext();
        else if (kind === 'stop') this.onStop(); else this.onToggle();
      });
  }

  private cycleQuickTimer(): void {
    if (!this.sharedInput() || this.p() !== 0) return;
    const presets: Array<number | 'chapterEnd'> = [0, 15, 30, 60, 'chapterEnd'];
    const current = this.timerMode === 'chapterEnd' ? presets.length - 1 :
      (this.timerMode === 'off' || (this.timerSeconds === 0 && this.timerMinutes === 0) ? 0 :
        (this.timerSeconds === 0 ? presets.indexOf(this.timerMinutes) : -1));
    const next = presets[(current + 1) % presets.length];
    if (next === 'chapterEnd') this.onTimerChange(0, 0, 'chapterEnd');
    else if (next === 0) this.onTimerChange(0, 0, 'off');
    else this.onTimerChange(next, 0, 'duration');
  }

  private timerPresetSelected(minutes: number): boolean {
    return this.timerMode === 'duration' && this.timerMinutes === minutes && this.timerSeconds === 0;
  }
  private timerCaption(): string {
    if (this.timerMode === 'chapterEnd') return '本章结束';
    if (this.timerMode === 'off' || (this.timerMinutes === 0 && this.timerSeconds === 0)) return '不开启';
    return this.timerSeconds === 0 ? `${this.timerMinutes} 分钟` : this.timerSummary();
  }
  private chooseTimerPreset(minutes: number | 'chapterEnd'): void {
    if (!this.fullInput()) return;
    if (minutes === 'chapterEnd') this.onTimerChange(0, 0, 'chapterEnd');
    else if (minutes === 0) this.onTimerChange(0, 0, 'off');
    else this.onTimerChange(minutes, 0, 'duration');
  }
  @Builder
  private timer() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.sectionSurface('timer');
      Stack({ alignContent: Alignment.TopStart }) {
        this.moduleHeader('timer'); this.quickLabel('timer');
        Row({ space: 4 }) {
          Text(this.timerCaption()).fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(11).fontColor(readerAppColor('TOK_TTS_TEAL', this.appScheme))
            .layoutWeight(1).maxLines(1).textAlign(TextAlign.Center);
          Image($r(this.appScheme === 'night' ? 'app.media.reader_chevron_down_theme_night' : 'app.media.reader_chevron_down')).width(8).height(4);
        }.width(this.frame().quickTimerSelect.width).height(this.frame().quickTimerSelect.height)
          .padding({ left: 8, right: 8 }).alignItems(VerticalAlign.Center)
          .position({ x: this.frame().quickTimerSelect.x, y: this.frame().quickTimerSelect.y })
          .backgroundColor(readerAppColor('TOK_TTS_TEAL_SOFT', this.appScheme)).border({ width: 0.5, color: readerAppColor('TOK_TTS_TEAL_LINE', this.appScheme) }).borderRadius(999)
          .opacity(this.frame().quickTimerSelect.opacity).enabled(this.sharedInput())
          .accessibilityText(`定时${this.timerCaption()}，切换定时`)
          .onClick((): void => this.cycleQuickTimer());
        Column({ space: 12 }) {
          Column({ space: 8 }) {
            Row({ space: 8 }) { this.timerPreset(0); this.timerPreset(15); this.timerPreset(30); }
              .width('100%');
            Row({ space: 8 }) { this.timerPreset(45); this.timerPreset(60); this.timerPreset('chapterEnd'); }
              .width('100%');
          }.width('100%');
          Row({ space: 4 }) {
            Column({ space: 2 }) {
              Text('自定义时长').fontFamily('ReaderNotoSansSCUIMedium').fontSize(12).fontWeight(FontWeight.Medium).fontColor(readerAppColor('TOK_TTS_INK', this.appScheme));
              Text('分 · 秒').fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(9).fontColor(readerAppColor('TOK_TTS_MUTED', this.appScheme));
            }.layoutWeight(1).alignItems(HorizontalAlign.Start);
            this.timerStepper(true); this.timerStepper(false);
          }.width('100%').height(48).padding({ left: 10, right: 6 }).alignItems(VerticalAlign.Center)
            .border({ width: 0.5, color: readerAppColor('TOK_TTS_LINE', this.appScheme) }).borderRadius(10);
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
  private timerPreset(minutes: number | 'chapterEnd') {
    Text(this.timerPresetLabel(minutes)).fontFamily('ReaderNotoSansSCUIMedium').fontSize(12).fontWeight(FontWeight.Medium)
      .fontColor(this.timerPresetIsSelected(minutes) ? readerAppColor('TOK_TTS_PAPER', this.appScheme) : readerAppColor('app.control.paint.5B5046', this.appScheme))
      .layoutWeight(1).height(36).textAlign(TextAlign.Center)
      .backgroundColor(this.timerPresetIsSelected(minutes) ? readerAppColor('TOK_TTS_TEAL', this.appScheme) : readerAppColor('TOK_TTS_FIELD', this.appScheme))
      .border({ width: this.timerPresetIsSelected(minutes) ? 0 : 0.5, color: readerAppColor('TOK_TTS_LINE', this.appScheme) }).borderRadius(10)
      .shadow({ radius: 7, color: this.timerPresetIsSelected(minutes) ? readerAppColor('app.control.paint.472F6373', this.appScheme) : Color.Transparent, offsetY: 2 })
      .enabled(this.fullInput())
      .accessibilityText(minutes === 'chapterEnd' ? '朗读到本章结束停止' : (minutes === 0 ? '关闭定时停止' : `定时${minutes}分钟`))
      .onClick((): void => this.chooseTimerPreset(minutes));
  }

  private timerPresetLabel(minutes: number | 'chapterEnd'): string {
    return minutes === 'chapterEnd' ? '本章结束' : (minutes === 0 ? '不开启' : `${minutes} 分钟`);
  }

  private timerPresetIsSelected(minutes: number | 'chapterEnd'): boolean {
    return minutes === 'chapterEnd' ? this.timerMode === 'chapterEnd' :
      (this.timerMode === 'off' ? minutes === 0 : this.timerPresetSelected(minutes));
  }
  @Builder
  private timerStepper(minutes: boolean) {
    Row({ space: 1 }) {
      this.timerStepButton(minutes, -5);
      Text(this.twoDigits(minutes ? this.timerMinutes : this.timerSeconds))
        .fontFamily('ReaderNotoSansSCUIBold').fontSize(14).fontWeight(FontWeight.Bold).fontColor(readerAppColor('TOK_TTS_INK', this.appScheme))
        .width(23).height(24).textAlign(TextAlign.Center);
      this.timerStepButton(minutes, 5);
    }.height(32).alignItems(VerticalAlign.Center)
      .accessibilityText(minutes ? `${this.timerMinutes}分（每次五分钟）` : `${this.timerSeconds}秒`);
  }
  @Builder
  private timerStepButton(minutes: boolean, delta: number) {
    Stack({ alignContent: Alignment.Center }) {
      Image($r(delta < 0 ? (this.appScheme === 'night' ? 'app.media.reader_tts_make_minus_theme_night' : 'app.media.reader_tts_make_minus') : (this.appScheme === 'night' ? 'app.media.reader_tts_make_plus_theme_night' : 'app.media.reader_tts_make_plus'))).width(12).height(12);
    }.width(24).height(30).backgroundColor(readerAppColor('TOK_TTS_TEAL_SOFT', this.appScheme)).borderRadius(999)
      .enabled(this.fullInput() && (delta > 0 ?
        (minutes ? this.timerMinutes < READER_TTS_TIMER_MAX_MINUTES : this.timerSeconds < READER_TTS_TIMER_MAX_SECONDS) :
        (minutes ? this.timerMinutes > 0 : this.timerSeconds > 0)))
      .accessibilityText(`${delta > 0 ? '增加' : '减少'}${minutes ? '五分钟' : '一秒'}`)
      .onClick((): void => { if (this.fullInput()) this.stepTimer(minutes, delta); });
  }

  private ratePresets(): number[] { return [0.50, 0.75, 1.0, 1.25, 1.5]; }
  private ratePresetWidth(): number {
    // Five presets share the Make 8vp gaps and consume the full responsive
    // row, keeping 0.50x visible at the left edge without horizontal overflow.
    return Math.max(0, (this.frame().speedPresets.width - 32) / 5);
  }
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
        Text(this.effectiveRate().toFixed(2) + 'x').fontFamily('ReaderInter').fontSize(12)
          .fontColor(readerAppColor('TOK_TTS_TEAL', this.appScheme)).textAlign(TextAlign.End)
          .width(this.frame().quickSpeedValue.width).height(this.frame().quickSpeedValue.height)
          .position({ x: this.frame().quickSpeedValue.x, y: this.frame().quickSpeedValue.y })
          .opacity(this.frame().quickSpeedValue.opacity);
        Row().width(this.frame().speedTrack.width).height(this.frame().speedTrack.height)
          .backgroundColor(readerAppColor('TOK_TTS_TRACK', this.appScheme)).borderRadius(999)
          .position({ x: this.frame().speedTrack.x, y: this.frame().speedTrack.y });
        Row().width(this.frame().speedThumb.x + 9 - this.frame().speedTrack.x)
          .height(this.frame().speedTrack.height).backgroundColor(readerAppColor('TOK_TTS_TEAL', this.appScheme)).borderRadius(999)
          .position({ x: this.frame().speedTrack.x, y: this.frame().speedTrack.y });
        Row().width(18).height(18).border({ width: 1.5, color: readerAppColor('TOK_TTS_TEAL', this.appScheme) }).borderRadius(999)
          .backgroundColor(readerAppColor('TOK_TTS_PAPER', this.appScheme)).shadow({ radius: 2, color: readerAppColor('app.control.paint.382F2314', this.appScheme), offsetY: 1 })
          .position({ x: this.frame().speedThumb.x, y: this.frame().speedThumb.y });
        Text(READER_TTS_RATE_MIN.toFixed(2) + 'x').fontFamily('ReaderInter').fontSize(9).fontColor(readerAppColor('TOK_TTS_MUTED', this.appScheme))
          .position({ x: 16, y: 75 }).opacity(this.p());
        Text(READER_TTS_RATE_MAX.toFixed(2) + 'x').fontFamily('ReaderInter').fontSize(9).fontColor(readerAppColor('TOK_TTS_MUTED', this.appScheme))
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
            this.changeRateSlider(value, mode);
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
    Text(rate.toFixed(2) + 'x').fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(12)
      .fontColor(this.effectiveRate() === rate ? readerAppColor('TOK_TTS_PAPER', this.appScheme) : readerAppColor('app.control.paint.5B5046', this.appScheme))
      .width(this.ratePresetWidth()).height(32).textAlign(TextAlign.Center).borderRadius(10)
      .backgroundColor(this.effectiveRate() === rate ? readerAppColor('TOK_TTS_TEAL', this.appScheme) : readerAppColor('TOK_TTS_FIELD', this.appScheme))
      .border({ width: this.effectiveRate() === rate ? 0 : 0.5, color: readerAppColor('TOK_TTS_LINE', this.appScheme) })
      .shadow({ radius: 7, color: this.effectiveRate() === rate ? readerAppColor('app.control.paint.472F6373', this.appScheme) : Color.Transparent, offsetY: 2 })
      .enabled(this.fullInput())
      .accessibilityText(`语速${rate.toFixed(2)}倍`).onClick((): void => this.chooseRatePreset(rate));
  }

  @Builder
  private detailSection() {
    Column({ space: 8 }) {
      this.sectionHeader('播放配置', '即时生效');
      Column({ space: 0 }) {
        this.voiceSelectorRow();
        this.toggleRow('followHighlight'); this.toggleRow('pauseOnInterruption'); this.toggleRow('allowMixing');
        this.toggleRow('backgroundPlayback'); this.toggleRow('keepScreenOn');
        this.ttsClosedConfigRow('failure');
      }.width('100%').height(340).backgroundColor(readerAppColor('TOK_TTS_CARD', this.appScheme))
        .border({ width: 0.5, color: readerAppColor('TOK_TTS_LINE', this.appScheme) }).borderRadius(14).clip(true);
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
      }.width('100%').height(this.onlineServicePage() ? 164 : 212).padding({ top: 14 }).backgroundColor(readerAppColor('TOK_TTS_CARD', this.appScheme))
        .border({ width: 0.5, color: readerAppColor('TOK_TTS_LINE', this.appScheme) }).borderRadius(14).clip(true);
    }.width('100%').alignItems(HorizontalAlign.Start);
  }
  @Builder
  private ttsConfigHeader() { this.sectionHeader('朗读引擎', this.serviceError); }

  @Builder
  private ttsServiceTypeTabs() {
    Row({ space: 10 }) { this.ttsServiceTypeTab(false); this.ttsServiceTypeTab(true); }
      .width('100%').height(87).padding({ left: 14, right: 14 });
  }
  @Builder
  private ttsServiceTypeTab(http: boolean) {
    Column({ space: 7 }) {
      Row() {
        Image($r(http ? (this.appScheme === 'night' ? 'app.media.reader_tts_online_engine_theme_night' : 'app.media.reader_tts_online_engine') : (this.appScheme === 'night' ? 'app.media.reader_tts_system_engine_theme_night' : 'app.media.reader_tts_system_engine'))).width(20).height(20);
        Blank();
        Image($r(this.appScheme === 'night' ? 'app.media.reader_tts_make_engine_check_theme_night' : 'app.media.reader_tts_make_engine_check')).width(16).height(16)
          .opacity(this.isTtsServiceTabSelected(http) ? 1 : 0);
      }.width('100%').height(20);
      Column({ space: 3 }) {
        Text(http ? '在线 TTS' : '系统 TTS').fontFamily('ReaderNotoSansSCUIBold').fontWeight(FontWeight.Bold)
          .fontSize(12).fontColor(readerAppColor('TOK_TTS_INK', this.appScheme)).height(17).maxLines(1);
        Text(http ? this.onlineServiceDescription() : '设备内置语音').fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular)
          .fontSize(10).fontColor(readerAppColor('TOK_TTS_MUTED', this.appScheme)).height(14).maxLines(1);
      }.width('100%').alignItems(HorizontalAlign.Start);
    }.layoutWeight(1).height(87).padding(12).alignItems(HorizontalAlign.Start)
      .backgroundColor(this.isTtsServiceTabSelected(http) ? readerAppColor('app.control.paint.172F6373', this.appScheme) : readerAppColor('app.control.paint.99FFF8EF', this.appScheme))
      .border({ width: this.isTtsServiceTabSelected(http) ? 1.5 : 0.5,
        color: this.isTtsServiceTabSelected(http) ? readerAppColor('TOK_TTS_TEAL', this.appScheme) : readerAppColor('app.control.paint.66B4A697', this.appScheme) }).borderRadius(10)
      .enabled(this.fullInput() && !this.serviceBusy)
      .accessibilityText(http ? this.onlineTtsAccessibilityText() : '系统 TTS，使用设备内置语音')
      .onClick((): void => this.selectTtsServiceType(http));
  }

  /** Each value opens a real choice list without cycling hidden state. */
  @Builder
  private ttsClosedConfigPanel() {
    Column({ space: 0 }) {
      if (this.onlineServicePage()) {
        this.onlineServiceInfoRow();
      } else {
        this.ttsClosedConfigRow('engine'); this.ttsClosedConfigRow('language');
      }
    }.width('100%').height(this.onlineServicePage() ? 48 : 96);
  }
  @Builder
  private ttsClosedConfigRow(kind: ReaderControlTtsField) {
    Row({ space: 8 }) {
      Text(this.fieldLabel(kind)).layoutWeight(1).fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular)
        .fontSize(12).fontColor(readerAppColor('TOK_TTS_INK', this.appScheme)).maxLines(1);
      this.ttsSelectValueField(kind);
    }.width('100%').height(48).padding({ left: 14, right: 14 }).alignItems(VerticalAlign.Center)
      .border({ width: { top: 0.5 }, color: readerAppColor('app.control.paint.2E9B8466', this.appScheme) });
  }
  @Builder
  private sectionHeader(title: string, meta: string) {
    Row() {
      Text(title).layoutWeight(1).fontFamily('ReaderNotoSansSCUIBold').fontWeight(FontWeight.Bold)
        .fontSize(12).fontColor(readerAppColor('TOK_TTS_INK', this.appScheme));
      Text(meta).fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(10).fontColor(readerAppColor('TOK_TTS_MUTED', this.appScheme));
    }.width('100%').height(18).padding({ left: 3, right: 3 }).alignItems(VerticalAlign.Center);
  }
  @Builder
  private voiceSelectorRow() {
    Row() {
      Text('音色').layoutWeight(1).fontFamily('ReaderNotoSansSCUIMedium').fontWeight(FontWeight.Medium).fontSize(12).fontColor(readerAppColor('TOK_TTS_INK', this.appScheme));
      this.ttsSelectValueField('voice');
    }.width('100%').height(52).padding({ left: 14, right: 14 }).alignItems(VerticalAlign.Center)
      .enabled(this.fullInput());
  }
  @Builder
  private ttsSelectValueField(kind: ReaderControlTtsField) {
    Row({ space: 6 }) {
      if (kind === 'voice') {
        Text(this.currentVoiceLabel().includes('女') ? '女' : this.currentVoiceLabel().includes('男') ? '男' : '声')
          .width(24).height(24).textAlign(TextAlign.Center).fontFamily('ReaderNotoSansSCUIBold')
          .fontWeight(FontWeight.Bold).fontSize(10).fontColor(readerAppColor('TOK_TTS_TEAL', this.appScheme))
          .backgroundColor(readerAppColor('app.control.paint.212F6373', this.appScheme)).borderRadius(999);
      }
      Text(this.fieldValue(kind)).layoutWeight(1).fontFamily('ReaderNotoSansSCUIRegular').fontWeight(FontWeight.Regular).fontSize(12)
        .fontColor(kind === 'voice' ? readerAppColor('TOK_TTS_INK', this.appScheme) : readerAppColor('app.control.paint.5B5046', this.appScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .textAlign(TextAlign.End);
      Image($r(this.appScheme === 'night' ? 'app.media.reader_appearance_make_chevron_theme_night' : 'app.media.reader_appearance_make_chevron')).width(12).height(12);
    }.width(this.fieldWidth(kind)).height(kind === 'voice' ? 30 : 48)
      .padding({ left: kind === 'voice' ? 4 : 0, right: kind === 'voice' ? 8 : 0 }).alignItems(VerticalAlign.Center)
      .backgroundColor(kind === 'voice' ? readerAppColor('TOK_TTS_FIELD', this.appScheme) : Color.Transparent)
      .border({ width: kind === 'voice' ? 0.5 : 0, color: readerAppColor('TOK_TTS_LINE', this.appScheme) })
      .borderRadius(999).enabled(this.fullInput())
      .accessibilityText(`${this.fieldLabel(kind)}：${this.fieldValue(kind)}，选择配置`)
      .onClick((): void => this.openConfiguration(kind));
  }
  @Builder
  private toggleRow(kind: ReaderControlTtsToggle) {
    Row({ space: 8 }) {
      Text(kind === 'followHighlight' ? '跟随高亮' :
        (kind === 'pauseOnInterruption' ? '来电自动暂停' :
          (kind === 'allowMixing' ? '允许与其他应用同时播放' :
            (kind === 'backgroundPlayback' ? '后台继续朗读' : '朗读时屏幕常亮'))))
        .layoutWeight(1).fontFamily('ReaderNotoSansSCUIMedium').fontWeight(FontWeight.Medium).fontSize(12).fontColor(readerAppColor('TOK_TTS_INK', this.appScheme))
        .maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis });
      ReaderControlSwitchTrack({ value: this.toggleValue(kind), trackWidth: 42,
        activeColor: readerAppColor('TOK_TTS_TEAL', this.appScheme), inactiveColor: readerAppColor('app.control.paint.C6BFB2', this.appScheme), thumbColor: readerAppColor('TOK_TTS_PAPER', this.appScheme) })
        .enabled(true).opacity(1).onClick((): void => this.changeToggle(kind));
    }.width('100%').height(48).padding({ left: 14, right: 14 }).alignItems(VerticalAlign.Center)
      .border({ width: { top: 0.5 }, color: readerAppColor('app.control.paint.2E9B8466', this.appScheme) });
  }

  private fieldLabel(kind: ReaderControlTtsField): string {
    if (kind === 'voice') return '音色选项';
    if (kind === 'engine') return '语音引擎';
    if (kind === 'language') return '朗读语言';
    return kind === 'session' ? '音频会话' : '不可用处理';
  }

  private fieldValue(kind: ReaderControlTtsField): string {
    if (kind === 'voice') return this.currentVoiceLabel();
    if (kind === 'engine') return this.systemEngineDisplay();
    if (kind === 'language') return this.isHttpEngineSelected() ? '由在线服务提供' : readerTtsLanguageLabel(this.language);
    if (kind === 'session') return this.allowMixing ? '混音播放' : '语音播放';
    return this.failurePolicy === 'skip' ? '跳过不可用内容' : '停止并提示';
  }

  private fieldWidth(kind: ReaderControlTtsField): number {
    return Math.max(70, Math.min(170, this.frame().config.width * 0.56));
  }

  private toggleValue(kind: ReaderControlTtsToggle): boolean {
    if (kind === 'followHighlight') return this.followHighlight;
    if (kind === 'pauseOnInterruption') return this.pauseOnInterruption;
    if (kind === 'allowMixing') return this.allowMixing;
    return kind === 'backgroundPlayback' ? this.backgroundPlayback : this.keepScreenOn;
  }

  private changeToggle(kind: ReaderControlTtsToggle): void {
    if (!this.fullInput()) return;
    const next = !this.toggleValue(kind);
    if (kind === 'followHighlight') this.onFollowHighlightChange(next);
    else if (kind === 'pauseOnInterruption') this.onPauseOnInterruptionChange(next);
    else if (kind === 'allowMixing') this.onAllowMixingChange(next);
    else if (kind === 'backgroundPlayback') this.onBackgroundPlaybackChange(next);
    else this.onKeepScreenOnChange(next);
  }

  private timerSummary(): string {
    return `${this.twoDigits(this.timerMinutes)}:${this.twoDigits(this.timerSeconds)}`;
  }

  private stepTimer(minutes: boolean, delta: number): void {
    if (minutes) {
      // A one-shot chapter target has no numeric value. The first explicit
      // minute adjustment converts it to a normal duration instead of
      // silently retaining a stale chapter identity.
      const base = this.timerMode === 'duration' ? this.timerMinutes : 0;
      const nextMinutes = this.timerMode !== 'duration' ?
        (delta > 0 ? READER_TTS_TIMER_DEFAULT_MINUTES : READER_TTS_TIMER_MIN) :
        Math.max(delta < 0 ? READER_TTS_TIMER_MIN : 1,
          Math.min(READER_TTS_TIMER_MAX_MINUTES, base + delta));
      this.onTimerChange(nextMinutes, this.timerMode === 'duration' ? this.timerSeconds : 0, 'duration');
      return;
    }
    const nextSeconds = Math.max(READER_TTS_TIMER_MIN,
      Math.min(READER_TTS_TIMER_MAX_SECONDS, this.timerSeconds + delta));
    this.onTimerChange(this.timerMode === 'duration' ? this.timerMinutes : READER_TTS_TIMER_DEFAULT_MINUTES,
      nextSeconds, 'duration');
  }

  private twoDigits(value: number): string {
    const normalized = Math.max(READER_TTS_TIMER_MIN, Math.trunc(value));
    return normalized < 10 ? `0${normalized}` : `${normalized}`;
  }

  private effectiveRate(): number {
    return this.ratePreview >= READER_TTS_RATE_MIN ? this.ratePreview : this.state.rate;
  }

  private changeRateSlider(value: number, mode: SliderChangeMode): void {
    if (!this.sharedInput()) { this.ratePreview = -1; return; }
    if (mode === SliderChangeMode.Begin) this.committedSliderRate = -1;
    this.ratePreview = Math.round(value * READER_TTS_RATE_STEP_SCALE) / READER_TTS_RATE_STEP_SCALE;
    if (mode !== SliderChangeMode.End && mode !== SliderChangeMode.Click) return;
    const rate = this.ratePreview;
    this.ratePreview = -1;
    if (this.committedSliderRate === rate) return;
    this.committedSliderRate = rate;
    this.onRateChange(rate);
  }

  private changeSeekSlider(value: number, mode: SliderChangeMode): void {
    if (!this.fullInput()) return;
    if (mode === SliderChangeMode.Begin) this.committedSliderSeek = -1;
    if (mode !== SliderChangeMode.End && mode !== SliderChangeMode.Click) return;
    const index = Math.round(value);
    if (index === this.committedSliderSeek) return;
    this.committedSliderSeek = index;
    this.onSeek(index);
  }

  private isHttpEngineSelected(): boolean {
    return this.engine.startsWith('http-tts:');
  }

  private onlineServicePage(): boolean {
    return this.serviceTab === '' ? this.isHttpEngineSelected() : this.serviceTab === 'online';
  }

  private onEngineChanged(): void {
    if (this.isHttpEngineSelected()) this.serviceTab = 'online';
  }

  private onlineEngineId(): string {
    return this.isHttpEngineSelected() ? this.engine :
      this.httpEngines.length > 0 ? `http-tts:${this.httpEngines[0].id}` : '';
  }

  private onlineServiceDescription(): string {
    const id = this.onlineEngineId();
    return this.httpEngines.find((option: ReaderTtsEngineOption): boolean => `http-tts:${option.id}` === id)?.name ??
      '第三方语音服务';
  }

  private isTtsServiceTabSelected(http: boolean): boolean {
    return http === this.onlineServicePage();
  }

  private selectTtsServiceType(http: boolean): void {
    if (!this.fullInput() || this.serviceBusy) return;
    this.serviceTab = http ? 'online' : 'system';
    this.serviceError = '';
    const target = http ? this.onlineEngineId() : 'system';
    // Browsing the unconfigured Online tab cannot invent an executable engine.
    if (target === '') { if (this.hasActiveQueue()) this.onStop(); return; }
    if (target === this.engine) return;
    const generation = ++this.serviceGeneration;
    this.serviceBusy = true;
    void this.onEngineChange(target).catch((error: Error): void => {
      if (generation !== this.serviceGeneration) return;
      this.serviceTab = this.isHttpEngineSelected() ? 'online' : 'system';
      this.serviceError = error.message;
    }).finally((): void => {
      if (generation === this.serviceGeneration) this.serviceBusy = false;
    });
  }

  @Builder
  private onlineServiceInfoRow() {
    Row({ space: 8 }) {
      Text('服务信息').layoutWeight(1).fontFamily('ReaderNotoSansSCUIMedium')
        .fontWeight(FontWeight.Medium).fontSize(12).fontColor(readerAppColor('TOK_TTS_INK', this.appScheme));
      Row({ space: 6 }) {
        Text(this.httpEngines.length > 0 ? '已配置 · 编辑' : '立即配置').fontFamily('ReaderNotoSansSCUIMedium')
          .fontWeight(FontWeight.Medium).fontSize(11)
          .fontColor(this.httpEngines.length > 0 ? readerAppColor('TOK_TTS_TEAL', this.appScheme) : readerAppColor('app.control.paint.FFFAF4', this.appScheme));
        Image($r(this.appScheme === 'night' ? 'app.media.reader_appearance_make_chevron_theme_night' : 'app.media.reader_appearance_make_chevron')).width(12).height(12);
      }.height(30).padding({ left: 11, right: 9 }).borderRadius(999)
        .backgroundColor(this.httpEngines.length > 0 ? readerAppColor('app.control.paint.1A2F6373', this.appScheme) : readerAppColor('TOK_TTS_TEAL', this.appScheme))
        .border({ width: this.httpEngines.length > 0 ? .5 : 0, color: readerAppColor('app.control.paint.4D2F6373', this.appScheme) })
        .shadow({ radius: 7, color: this.httpEngines.length > 0 ? Color.Transparent : readerAppColor('app.control.paint.472F6373', this.appScheme), offsetY: 2 })
        .enabled(this.fullInput() && !this.serviceBusy)
        .accessibilityText(this.httpEngines.length > 0 ? '已配置在线 TTS，编辑服务信息' : '立即配置在线 TTS')
        .onClick((): void => this.openConfiguration('manage'));
    }.width('100%').height(48).padding({ left: 14, right: 14 }).alignItems(VerticalAlign.Center)
      .border({ width: { top: 1 }, color: readerAppColor('app.control.paint.299B8466', this.appScheme) });
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
    if (this.onlineServicePage() && !this.isHttpEngineSelected()) return '尚未配置在线服务';
    if (this.isHttpEngineSelected()) return '由在线服务提供';
    if (this.voiceOptions.length === 0) return '暂无可用音色';
    return this.voiceOptions.find((option: ReaderTtsVoiceOption): boolean =>
      option.language === this.language && option.person === this.person)?.label ??
      `${this.language} · 音色 ${this.person}`;
  }

  private statusText(): string {
    if (this.state.status === 'playing') return '朗读中';
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

  private controlText(kind: 'previous' | 'toggle' | 'stop' | 'next'): string {
    if (kind === 'previous') return '上一句';
    if (kind === 'next') return '下一句';
    if (kind === 'stop') return '停止朗读';
    if (kind === 'toggle' && (this.state.status === 'error' || this.state.status === 'failed' || this.state.status === 'unavailable')) return '重试朗读';
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
