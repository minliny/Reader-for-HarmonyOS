import {
  READER_TTS_RATE_MAX,
  READER_TTS_RATE_MIN,
  READER_TTS_RATE_STEP,
  READER_TTS_RATE_STEP_SCALE,
  READER_TTS_TIMER_MAX_MINUTES,
  READER_TTS_TIMER_MAX_SECONDS,
  READER_TTS_TIMER_MIN,
  type ReaderTtsState,
} from './ReaderTtsState';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_FIELD_SURFACE,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_ON_PRIMARY,
  TOK_READ_ELEVATED,
  TOK_READ_HANDLE,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_READ_SURFACE,
  TOK_SURFACE_PANEL,
  TOK_SURFACE_PANEL_SOFT,
} from '../common/ReaderTokens';
import { ReaderHttpTtsManagerPanel } from './ReaderHttpTtsManagerPanel';
import {
  READER_FULL_PANEL_HEIGHT_PHONE,
  READER_FULL_PANEL_HEIGHT_TABLET,
  READER_FULL_PANEL_MAX_WIDTH_PHONE,
  READER_FULL_PANEL_MAX_WIDTH_TABLET,
} from './ReaderLayoutGeometry';

const TTS_FULL_GRABBER_WIDTH = 42;
const TTS_FULL_GRABBER_HEIGHT = 4;
const TTS_FULL_GRABBER_Y = 9;
const TTS_FULL_HEADER_HEIGHT = 30;
const TTS_FULL_HEADER_X = 14;
const TTS_FULL_HEADER_Y = 20;
const TTS_FULL_SCROLL_X = 14;
const TTS_FULL_SCROLL_TOP = 58;
const TTS_FULL_SCROLL_BOTTOM_INSET_PHONE = 13;
const TTS_FULL_SCROLL_BOTTOM_INSET_TABLET = 12;
const TTS_FULL_SCROLL_PADDING_X_PHONE = 11;
const TTS_FULL_SCROLL_PADDING_X_TABLET = 12;
const TTS_FULL_SCROLL_PADDING_BOTTOM = 24;

export interface ReaderTtsEngineOption {
  id: number;
  name: string;
  url: string;
  lastUpdateTime: number;
}

/** Figma full TTS sheets: Phone `942:78`, Tablet `942:80`. */
@Component
export struct ReaderTtsFullPanel {
  @Prop isTablet: boolean = false;
  @Prop availableWidth: number = 0;
  @Prop availableHeight: number = 0;
  @Prop state: ReaderTtsState;
  @Prop timerMinutes: number = 15;
  @Prop timerSeconds: number = 0;
  @Prop followHighlight: boolean = true;
  @Prop allowMixing: boolean = false;
  @Prop failurePolicy: 'skip' | 'stop' = 'stop';
  @Prop engine: string = 'system';
  @Prop httpEngines: ReaderTtsEngineOption[] = [];
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
  onAllowMixingChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onFailurePolicyChange: (policy: 'skip' | 'stop') => void = (_policy: 'skip' | 'stop'): void => {};
  onEngineChange: (engine: string) => Promise<void> = (_engine: string): Promise<void> => Promise.resolve();
  onHttpEnginePut: (config: ReaderTtsEngineOption) => Promise<void> =
    (_config: ReaderTtsEngineOption): Promise<void> => Promise.resolve();
  onHttpEngineDelete: (id: number) => Promise<void> = (_id: number): Promise<void> => Promise.resolve();
  @State private ratePreview: number = -1;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(TTS_FULL_GRABBER_WIDTH)
        .height(TTS_FULL_GRABBER_HEIGHT)
        .backgroundColor(TOK_READ_HANDLE)
        .borderRadius(999)
        .position({ x: this.grabberX(), y: TTS_FULL_GRABBER_Y });

      this.header();

      Scroll() {
        Column() {
          ReaderHttpTtsManagerPanel({
            engines: this.httpEngines,
            selectedEngine: this.engine,
            onSelect: (engine: string): Promise<void> => this.onEngineChange(engine),
            onPut: (config: ReaderTtsEngineOption): Promise<void> => this.onHttpEnginePut(config),
            onDelete: (id: number): Promise<void> => this.onHttpEngineDelete(id),
          });
          this.sectionDivider();
          this.playbackSection();
          this.sectionDivider();
          this.timerSection();
          this.sectionDivider();
          this.rateSection();
          this.sectionDivider();
          this.detailSection();
          this.sectionDivider();
          this.systemSection();
        }
        .width('100%')
        .padding({
          left: this.scrollPaddingX(),
          right: this.scrollPaddingX(),
          bottom: TTS_FULL_SCROLL_PADDING_BOTTOM,
        })
        .alignItems(HorizontalAlign.Start);
      }
      .width(this.scrollWidth())
      .height(this.scrollHeight())
      .position({ x: TTS_FULL_SCROLL_X, y: TTS_FULL_SCROLL_TOP })
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
      .backgroundColor(TOK_SURFACE_PANEL)
      .border({ width: TOK_BORDER_W, color: TOK_LINE })
      .borderRadius(12);
    }
    .width(this.panelWidth())
    .height(this.panelHeight())
    .backgroundColor(TOK_READ_SURFACE)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(24)
    .clip(true);
  }

  @Builder
  private header() {
    Row() {
      Row({ space: 8 }) {
        Image($r('app.media.reader_tts_headphones'))
          .width(16)
          .height(16);
        Text('朗读')
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(14)
          .lineHeight(17)
          .fontColor(TOK_READ_INK);
      }
      .layoutWeight(1)
      .alignItems(VerticalAlign.Center);

      Text('收起')
        .width(40)
        .height(26)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(10)
        .lineHeight(13)
        .fontColor(TOK_READ_PRIMARY)
        .textAlign(TextAlign.Center)
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .borderRadius(8)
        .accessibilityText('收起朗读完整控制')
        .onClick((): void => this.onCollapse());
    }
    .width(this.headerWidth())
    .height(TTS_FULL_HEADER_HEIGHT)
    .alignItems(VerticalAlign.Center)
    .position({ x: TTS_FULL_HEADER_X, y: TTS_FULL_HEADER_Y });
  }

  @Builder
  private playbackSection() {
    Column({ space: 14 }) {
      Row() {
        Text('播放控制区')
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor(TOK_READ_INK);
        Text(this.statusText())
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(10)
          .fontColor(TOK_READ_MUTED);
      }
      .width('100%');

      Row({ space: 10 }) {
        this.roundControl('previous');
        this.roundControl('toggle');
        this.roundControl('stop');
        this.roundControl('next');
      }
      .width('100%')
      .height(62)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center);

      if (this.state.errorMessage !== undefined && this.state.errorMessage.length > 0) {
        Text(this.state.errorMessage)
          .width('100%')
          .fontFamily('ReaderNotoSansSC')
          .fontSize(10)
          .fontColor('#B93D35')
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis });
      }

      if (this.state.totalSlices > 1) {
        Slider({
          value: this.state.sliceIndex ?? 0,
          min: 0,
          max: this.state.totalSlices - 1,
          step: 1,
          style: SliderStyle.OutSet,
          direction: Axis.Horizontal,
          reverse: false,
        })
          .width('100%')
          .height(18)
          .accessibilityText('跳转朗读句子')
          .onChange((value: number, mode: SliderChangeMode): void => {
            if (mode === SliderChangeMode.End) this.onSeek(Math.round(value));
          });
      }
    }
    .width('100%')
    .height(this.state.totalSlices > 1 ? 160 : 128)
    .padding({ top: 28, left: 4, right: 4 })
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private roundControl(kind: 'previous' | 'toggle' | 'stop' | 'next') {
    Stack({ alignContent: Alignment.Center }) {
      if (kind === 'toggle') {
        if (this.isActivelySpeaking()) {
          Row({ space: 6 }) {
            Row().width(4).height(18).backgroundColor(TOK_ON_PRIMARY).borderRadius(1);
            Row().width(4).height(18).backgroundColor(TOK_ON_PRIMARY).borderRadius(1);
          }
        } else {
          Image($r('app.media.reader_tts_play')).width(25).height(25);
        }
      } else if (kind === 'stop') {
        Image($r('app.media.reader_tts_stop')).width(28).height(28);
      } else {
        Image($r(kind === 'previous' ? 'app.media.reader_tts_previous' : 'app.media.reader_tts_next'))
          .width(22)
          .height(18);
      }
    }
    .width(kind === 'toggle' ? 52 : (kind === 'stop' ? 32 : 44))
    .height(kind === 'toggle' ? 52 : (kind === 'stop' ? 32 : 44))
    .backgroundColor(kind === 'toggle' ? '#254A3D' : (kind === 'stop' ? '#D7473E' : TOK_READ_ELEVATED))
    .border({ width: kind === 'previous' || kind === 'next' ? TOK_BORDER_W : 0, color: TOK_BORDER })
    .borderRadius(kind === 'toggle' ? 26 : (kind === 'stop' ? 16 : 22))
    .enabled(kind === 'toggle' ? this.state.status !== 'unavailable' && this.state.status !== 'stopping' :
      this.hasActiveQueue())
    .opacity((kind === 'toggle' ? this.state.status !== 'unavailable' : this.hasActiveQueue()) ? 1 : 0.42)
    .accessibilityText(this.controlText(kind))
    .onClick((): void => {
      if (kind === 'previous') this.onPrevious();
      else if (kind === 'next') this.onNext();
      else if (kind === 'stop') this.onStop();
      else this.onToggle();
    });
  }

  @Builder
  private timerSection() {
    Column({ space: 14 }) {
      Row() {
        Text('定时')
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor(TOK_READ_INK);
        Text(this.timerSummary())
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Medium)
          .fontSize(10)
          .fontColor(TOK_READ_MUTED);
      }
      .width('100%');

      if (this.isTablet) {
        Row() {
          this.timerSummaryBlock();
          this.timerWheels();
        }
        .width('100%')
        .height(194)
        .padding({ left: 12, right: 12 })
        .justifyContent(FlexAlign.SpaceBetween)
        .alignItems(VerticalAlign.Center)
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .border({ width: TOK_BORDER_W, color: TOK_LINE })
        .borderRadius(10);
      } else {
        Column({ space: 10 }) {
          this.timerSummaryBlock();
          this.timerWheels();
        }
        .width('100%')
        .height(252)
        .padding({ top: 12, bottom: 12 })
        .backgroundColor(TOK_SURFACE_PANEL_SOFT)
        .border({ width: TOK_BORDER_W, color: TOK_LINE })
        .borderRadius(10);
      }
    }
    .width('100%')
    .padding({ top: 18, bottom: 12, left: 4, right: 4 })
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private timerSummaryBlock() {
    Row({ space: 8 }) {
      Stack({ alignContent: Alignment.Center }) {
        Image($r('app.media.reader_tts_clock')).width(20).height(20);
      }
      .width(44)
      .height(44)
      .backgroundColor(TOK_FIELD_SURFACE)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(6);
      Column() {
        Text('朗读后停止')
          .fontFamily('ReaderInter')
          .fontSize(10)
          .fontColor(TOK_READ_MUTED);
        Text(this.timerSummary())
          .fontFamily('ReaderInter')
          .fontWeight(800)
          .fontSize(20)
          .lineHeight(22)
          .fontColor(TOK_READ_INK);
      }
      .alignItems(HorizontalAlign.Start);
    }
    .width(this.isTablet ? 190 : 170)
    .height(52)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private timerWheels() {
    Row({ space: 12 }) {
      this.timerWheel(true);
      Text(':')
        .width(8)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(18)
        .fontColor(TOK_READ_PRIMARY)
        .textAlign(TextAlign.Center);
      this.timerWheel(false);
    }
    .width(this.timerWheelsWidth())
    .height(158)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private timerWheel(minutes: boolean) {
    Column() {
      Text(this.wheelValue(minutes, -1))
        .width(this.timerWheelWidth())
        .height(43)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(12)
        .fontColor(TOK_READ_MUTED)
        .opacity(0.56)
        .textAlign(TextAlign.Center)
        .onClick((): void => this.stepTimer(minutes, -1));
      Text(this.wheelValue(minutes, 0))
        .width(this.timerWheelWidth())
        .height(43)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(17)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center)
        .border({ width: { top: TOK_BORDER_W, bottom: TOK_BORDER_W }, color: TOK_READ_PRIMARY });
      Text(this.wheelValue(minutes, 1))
        .width(this.timerWheelWidth())
        .height(43)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(12)
        .fontColor(TOK_READ_MUTED)
        .opacity(0.56)
        .textAlign(TextAlign.Center)
        .onClick((): void => this.stepTimer(minutes, 1));
      Text(minutes ? '分' : '秒')
        .width(this.timerWheelWidth())
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.Center);
    }
    .width(this.timerWheelWidth())
    .height(158)
    .border({ width: TOK_BORDER_W, color: TOK_BORDER })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private rateSection() {
    Column({ space: 16 }) {
      Row() {
        Text('语速')
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor(TOK_READ_INK);
        Text(`${this.effectiveRate().toFixed(1)}x`)
          .fontFamily('ReaderInter')
          .fontSize(10)
          .fontColor(TOK_READ_MUTED);
      }
      .width('100%');
      Slider({
        value: this.effectiveRate(),
        min: READER_TTS_RATE_MIN,
        max: READER_TTS_RATE_MAX,
        step: READER_TTS_RATE_STEP,
        style: SliderStyle.OutSet,
        direction: Axis.Horizontal,
        reverse: false,
      })
        .width('100%')
        .height(32)
        .opacity(0.001)
        .accessibilityText('调整朗读语速')
        .onChange((value: number, mode: SliderChangeMode): void => {
          this.ratePreview = Math.round(value * READER_TTS_RATE_STEP_SCALE) /
            READER_TTS_RATE_STEP_SCALE;
          if (mode === SliderChangeMode.End) {
            const rate = this.ratePreview;
            this.ratePreview = -1;
            this.onRateChange(rate);
          }
        });
      Row() {
        Text(`${READER_TTS_RATE_MIN.toFixed(1)}x`)
          .layoutWeight(1).fontFamily('ReaderInter').fontSize(9).fontColor(TOK_READ_MUTED);
        Text(`${READER_TTS_RATE_MAX.toFixed(1)}x`)
          .fontFamily('ReaderInter').fontSize(9).fontColor(TOK_READ_MUTED);
      }
      .width('100%');
    }
    .width('100%')
    .height(108)
    .padding({ top: 18, bottom: 12, left: 4, right: 4 })
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private detailSection() {
    Column({ space: 0 }) {
      this.sectionHeader('详细配置', '即时生效');
      this.selectorRow('音色选项', '系统默认');
      this.toggleRow('跟随高亮', this.followHighlight, true,
        (enabled: boolean): void => this.onFollowHighlightChange(enabled));
      this.toggleRow('来电暂停', true, false, (_enabled: boolean): void => {});
      this.toggleRow('允许与其他应用同时播放', this.allowMixing, true,
        (enabled: boolean): void => this.onAllowMixingChange(enabled));
    }
    .width('100%')
    .padding({ top: 18, left: 4, right: 4, bottom: 12 })
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private systemSection() {
    Column({ space: 0 }) {
      this.sectionHeader('TTS 配置', '设备引擎');
      Row({ space: 8 }) {
        Text('系统 TTS')
          .layoutWeight(1)
          .height(52)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor(TOK_READ_INK)
          .textAlign(TextAlign.Center)
          .border({ width: TOK_BORDER_W, color: TOK_READ_PRIMARY })
          .borderRadius(6)
          .opacity(this.isHttpEngineSelected() ? 0.58 : 1)
          .onClick((): void => this.requestEngineChange('system'));
        Text(this.httpEngineLabel())
          .layoutWeight(1)
          .height(52)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor(this.isHttpEngineSelected() ? TOK_READ_INK : TOK_READ_MUTED)
          .opacity(this.httpEngines.length > 0 ? 1 : 0.42)
          .textAlign(TextAlign.Center)
          .border({
            width: TOK_BORDER_W,
            color: this.isHttpEngineSelected() ? TOK_READ_PRIMARY : TOK_LINE,
          })
          .borderRadius(6)
          .enabled(this.httpEngines.length > 0)
          .onClick((): void => {
            const engine = this.nextHttpEngine();
            if (engine !== undefined) this.requestEngineChange(engine);
          });
      }
      .width('100%')
      .padding({ top: 8, bottom: 8 });
      this.selectorRow('当前引擎', this.currentEngineLabel());
      this.selectorRow('语言', 'zh-CN');
      this.selectorRow('音频会话', this.allowMixing ? '混音' : '媒体独占');
      this.selectorRow('不可用处理', this.failurePolicy === 'skip' ? '跳过' : '停止');
    }
    .width('100%')
    .padding({ top: 18, left: 4, right: 4, bottom: 24 })
    .alignItems(HorizontalAlign.Start);
  }

  @Builder
  private sectionHeader(title: string, meta: string) {
    Row() {
      Text(title)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor(TOK_READ_INK);
      Text(meta)
        .fontFamily('ReaderInter')
        .fontSize(10)
        .fontColor(TOK_READ_MUTED);
    }
    .width('100%')
    .height(34)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private selectorRow(label: string, value: string) {
    Row() {
      Text(label)
        .layoutWeight(1)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .fontColor('#41484C');
      Text(value)
        .height(36)
        .padding({ left: 12, right: 12 })
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(11)
        .fontColor('#41484C')
        .textAlign(TextAlign.Center)
        .backgroundColor(TOK_FIELD_SURFACE)
        .border({ width: TOK_BORDER_W, color: TOK_BORDER })
        .borderRadius(6);
    }
    .width('100%')
    .height(45)
    .padding({ left: 10, right: 10 })
    .alignItems(VerticalAlign.Center)
    .border({ width: { bottom: TOK_BORDER_W }, color: TOK_BORDER })
    .enabled(false);
  }

  @Builder
  private toggleRow(label: string, value: boolean, enabled: boolean, onChange: (enabled: boolean) => void) {
    Row() {
      Text(label)
        .layoutWeight(1)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(11)
        .fontColor(TOK_READ_INK);
      Stack({ alignContent: Alignment.TopStart }) {
        Row()
          .width(20)
          .height(20)
          .backgroundColor(TOK_READ_ELEVATED)
          .borderRadius(10)
          .position({ x: value ? 22 : 2, y: 2 });
      }
      .width(44)
      .height(24)
      .backgroundColor(value ? TOK_READ_PRIMARY : '#B3ACA4')
      .borderRadius(999)
      .enabled(enabled)
      .opacity(enabled ? 1 : 0.72)
      .onClick((): void => onChange(!value));
    }
    .width('100%')
    .height(45)
    .padding({ left: 10, right: 10 })
    .alignItems(VerticalAlign.Center)
    .border({ width: { bottom: TOK_BORDER_W }, color: TOK_BORDER });
  }

  @Builder
  private sectionDivider() {
    Row().width('100%').height(1).backgroundColor(TOK_LINE);
  }

  private timerSummary(): string {
    return `${this.twoDigits(this.timerMinutes)}:${this.twoDigits(this.timerSeconds)}`;
  }

  private wheelValue(minutes: boolean, delta: number): string {
    const maximum = minutes ? READER_TTS_TIMER_MAX_MINUTES : READER_TTS_TIMER_MAX_SECONDS;
    const current = minutes ? this.timerMinutes : this.timerSeconds;
    return this.twoDigits(Math.max(READER_TTS_TIMER_MIN, Math.min(maximum, current + delta)));
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

  private panelWidth(): number {
    const designWidth = this.isTablet ? READER_FULL_PANEL_MAX_WIDTH_TABLET :
      READER_FULL_PANEL_MAX_WIDTH_PHONE;
    return this.availableWidth > 0 ? Math.min(designWidth, this.availableWidth) : designWidth;
  }

  private panelHeight(): number {
    const designHeight = this.isTablet ? READER_FULL_PANEL_HEIGHT_TABLET : READER_FULL_PANEL_HEIGHT_PHONE;
    return this.availableHeight > 0 ? Math.min(designHeight, this.availableHeight) : designHeight;
  }

  private grabberX(): number {
    return (this.panelWidth() - TTS_FULL_GRABBER_WIDTH) / 2;
  }

  private scrollWidth(): number {
    return Math.max(0, this.panelWidth() - TTS_FULL_SCROLL_X * 2);
  }

  private headerWidth(): number {
    return Math.max(0, this.panelWidth() - TTS_FULL_HEADER_X * 2);
  }

  private scrollHeight(): number {
    const bottomInset = this.isTablet ? TTS_FULL_SCROLL_BOTTOM_INSET_TABLET :
      TTS_FULL_SCROLL_BOTTOM_INSET_PHONE;
    return this.panelHeight() - TTS_FULL_SCROLL_TOP - bottomInset;
  }

  private scrollPaddingX(): number {
    return this.isTablet ? TTS_FULL_SCROLL_PADDING_X_TABLET : TTS_FULL_SCROLL_PADDING_X_PHONE;
  }

  private timerSectionContentWidth(): number {
    return Math.max(0, this.scrollWidth() - this.scrollPaddingX() * 2 - 8);
  }

  private timerWheelsWidth(): number {
    return Math.min(278, this.timerSectionContentWidth());
  }

  private timerWheelWidth(): number {
    // Two 12vp gaps plus the 8vp colon reserve 32vp inside the wheel row.
    return Math.min(122, Math.max(0, (this.timerWheelsWidth() - 32) / 2));
  }

  private isHttpEngineSelected(): boolean {
    return this.engine.startsWith('http-tts:');
  }

  private currentEngineLabel(): string {
    if (!this.isHttpEngineSelected()) return '系统离线';
    const id = Number(this.engine.slice('http-tts:'.length));
    return this.httpEngines.find((option: ReaderTtsEngineOption): boolean => option.id === id)?.name ?? '在线配置失效';
  }

  private httpEngineLabel(): string {
    if (this.httpEngines.length === 0) return '在线 TTS（未配置）';
    if (this.isHttpEngineSelected()) return this.currentEngineLabel();
    return this.httpEngines.length === 1 ? this.httpEngines[0].name : `在线 TTS（${this.httpEngines.length}）`;
  }

  private nextHttpEngine(): string | undefined {
    if (this.httpEngines.length === 0) return undefined;
    if (!this.isHttpEngineSelected()) return `http-tts:${this.httpEngines[0].id}`;
    const currentId = Number(this.engine.slice('http-tts:'.length));
    const index = this.httpEngines.findIndex(
      (option: ReaderTtsEngineOption): boolean => option.id === currentId,
    );
    const next = this.httpEngines[(index + 1 + this.httpEngines.length) % this.httpEngines.length];
    return `http-tts:${next.id}`;
  }

  private statusText(): string {
    if (this.state.status === 'playing') return '播放中';
    if (this.state.status === 'paused') return '已暂停';
    if (this.state.status === 'interrupted') return '已中断';
    if (this.state.status === 'preparing' || this.state.status === 'resuming') return '准备中';
    if (this.state.status === 'completed') return '已完成';
    if (this.state.status === 'stopping') return '停止中';
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
