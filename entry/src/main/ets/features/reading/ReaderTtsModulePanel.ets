import {
  READER_TTS_RATE_MAX,
  READER_TTS_RATE_MIN,
  READER_TTS_RATE_STEP,
  READER_TTS_RATE_STEP_SCALE,
  type ReaderTtsState,
} from './ReaderTtsState';
import {
  TOK_BORDER,
  TOK_BORDER_W,
  TOK_FIELD_SURFACE,
  TOK_LINE,
  TOK_LINE_STRONG,
  TOK_ON_PRIMARY,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
} from '../common/ReaderTokens';

// Phone and Tablet outer heights are separate Figma surfaces. Their equal
// inner section geometry does not make either outer height derivable.
const TTS_MODULE_PANEL_HEIGHT_PHONE = 196;
const TTS_MODULE_PANEL_HEIGHT_TABLET = 190;
const TTS_MODULE_PANEL_WIDTH_PHONE = 286;
const TTS_MODULE_PANEL_WIDTH_TABLET = 262;
const TTS_MODULE_PANEL_PADDING_X = 11;
const TTS_MODULE_PANEL_PADDING_Y = 13;
const TTS_MODULE_SECTION_GAP = 8;
const TTS_MODULE_PLAYBACK_HEIGHT = 66;
const TTS_MODULE_TIMER_HEIGHT = 42;
const TTS_MODULE_RATE_HEIGHT = 42;
const TTS_MODULE_PLAYBACK_LABEL_WIDTH = 106;
const TTS_MODULE_PLAYBACK_CONTROL_WIDTH = 128;
const TTS_MODULE_RATE_LABEL_WIDTH = 72;
const TTS_MODULE_RATE_SLIDER_WIDTH = 116;
const TTS_MODULE_RATE_VALUE_WIDTH_PHONE = 54;
const TTS_MODULE_RATE_VALUE_WIDTH_TABLET = 30;

/** Figma quick TTS panel: Phone `942:62`, Tablet `942:64`. */
@Component
export struct ReaderTtsModulePanel {
  @Prop isTablet: boolean = false;
  @Prop state: ReaderTtsState;
  @Prop timerMinutes: number = 15;
  onToggle: () => void = (): void => {};
  onStop: () => void = (): void => {};
  onPrevious: () => void = (): void => {};
  onNext: () => void = (): void => {};
  onRateChange: (rate: number) => void = (_rate: number): void => {};
  @State private ratePreview: number = -1;

  build() {
    Column({ space: TTS_MODULE_SECTION_GAP }) {
      this.playbackRow();
      this.timerRow();
      this.rateRow();
    }
    .width('100%')
    .constraintSize({ maxWidth: this.panelWidth() })
    .height(this.isTablet ? TTS_MODULE_PANEL_HEIGHT_TABLET : TTS_MODULE_PANEL_HEIGHT_PHONE)
    .padding({
      left: TTS_MODULE_PANEL_PADDING_X,
      right: TTS_MODULE_PANEL_PADDING_X,
      top: TTS_MODULE_PANEL_PADDING_Y,
      bottom: TTS_MODULE_PANEL_PADDING_Y,
    })
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(TOK_SURFACE_PANEL)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(8)
    .clip(true);
  }

  @Builder
  private playbackRow() {
    Row() {
      Row({ space: 8 }) {
        Image($r('app.media.reader_tts_headphones'))
          .width(20)
          .height(20);
        Text('播放')
          .layoutWeight(1)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(12)
          .fontColor(TOK_READ_INK)
          .maxLines(1);
      }
      .layoutWeight(1)
      .constraintSize({ maxWidth: TTS_MODULE_PLAYBACK_LABEL_WIDTH })
      .height(64)
      .alignItems(VerticalAlign.Center);

      Stack({ alignContent: Alignment.TopStart }) {
        this.previousButton();
        this.playPauseButton();
        this.stopButton();
        this.nextButton();
      }
      .width(TTS_MODULE_PLAYBACK_CONTROL_WIDTH)
      .height(32);
    }
    .width('100%')
    .height(TTS_MODULE_PLAYBACK_HEIGHT)
    .padding({ left: 11, right: 11 })
    .alignItems(VerticalAlign.Center)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(6);
  }

  @Builder
  private previousButton() {
    Stack({ alignContent: Alignment.Center }) {
      Image($r('app.media.reader_tts_previous'))
        .width(20)
        .height(16);
    }
    .width(32)
    .height(32)
    .borderRadius(16)
    .enabled(this.hasActiveQueue())
    .opacity(this.hasActiveQueue() ? 1 : 0.42)
    .accessibilityText('上一句')
    .onClick((): void => this.onPrevious());
  }

  @Builder
  private playPauseButton() {
    Stack({ alignContent: Alignment.Center }) {
      if (this.isActivelySpeaking()) {
        Row({ space: 4 }) {
          Row().width(3).height(13).backgroundColor(TOK_ON_PRIMARY).borderRadius(1);
          Row().width(3).height(13).backgroundColor(TOK_ON_PRIMARY).borderRadius(1);
        }
      } else {
        Image($r('app.media.reader_tts_play'))
          .width(21)
          .height(21);
      }
    }
    .width(24)
    .height(24)
    .backgroundColor(TOK_READ_PRIMARY)
    .borderRadius(12)
    .position({ x: 36, y: 4 })
    .enabled(this.state.status !== 'unavailable' && this.state.status !== 'stopping')
    .opacity(this.state.status === 'unavailable' ? 0.42 : 1)
    .accessibilityText(this.isActivelySpeaking() ? '暂停朗读' : '开始或继续朗读')
    .onClick((): void => this.onToggle());
  }

  @Builder
  private stopButton() {
    Stack({ alignContent: Alignment.Center }) {
      Image($r('app.media.reader_tts_stop'))
        .width(26)
        .height(26);
    }
    .width(22)
    .height(22)
    .backgroundColor('#D7473E')
    .borderRadius(11)
    .position({ x: 69, y: 5 })
    .enabled(this.hasActiveQueue())
    .opacity(this.hasActiveQueue() ? 1 : 0.42)
    .accessibilityText('停止朗读')
    .onClick((): void => this.onStop());
  }

  @Builder
  private nextButton() {
    Stack({ alignContent: Alignment.Center }) {
      Image($r('app.media.reader_tts_next'))
        .width(20)
        .height(16);
    }
    .width(32)
    .height(32)
    .borderRadius(16)
    .position({ x: 96, y: 0 })
    .enabled(this.hasActiveQueue())
    .opacity(this.hasActiveQueue() ? 1 : 0.42)
    .accessibilityText('下一句')
    .onClick((): void => this.onNext());
  }

  @Builder
  private timerRow() {
    Row() {
      Row({ space: 8 }) {
        Image($r('app.media.reader_tts_clock'))
          .width(20)
          .height(20);
        Text('定时')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(12)
          .fontColor(TOK_READ_INK);
      }
      .layoutWeight(1)
      .alignItems(VerticalAlign.Center);

      Row() {
        Text(`${this.timerMinutes}min`)
          .layoutWeight(1)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor('#41484C');
        Text('⌃')
          .width(14)
          .fontFamily('ReaderInter')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor('#41484C')
          .textAlign(TextAlign.Center);
      }
      .width(86)
      .height(30)
      .padding({ left: 9, right: 5 })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(TOK_FIELD_SURFACE)
      .border({ width: TOK_BORDER_W, color: TOK_BORDER })
      .borderRadius(6)
      .enabled(false)
      .accessibilityText(`朗读将在 ${this.timerMinutes} 分钟后停止`);
    }
    .width('100%')
    .height(TTS_MODULE_TIMER_HEIGHT)
    .padding({ left: 11, right: 11 })
    .alignItems(VerticalAlign.Center)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(6);
  }

  @Builder
  private rateRow() {
    Row() {
      Row({ space: 8 }) {
        Image($r('app.media.reader_tts_rate'))
          .width(20)
          .height(20);
        Text('语速')
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(12)
          .fontColor(TOK_READ_INK);
      }
      .width(TTS_MODULE_RATE_LABEL_WIDTH)
      .alignItems(VerticalAlign.Center);

      Slider({
        value: this.effectiveRate(),
        min: READER_TTS_RATE_MIN,
        max: READER_TTS_RATE_MAX,
        step: READER_TTS_RATE_STEP,
        style: SliderStyle.OutSet,
        direction: Axis.Horizontal,
        reverse: false,
      })
        .layoutWeight(1)
        .constraintSize({ maxWidth: TTS_MODULE_RATE_SLIDER_WIDTH })
        .height(32)
        // The source master reserves this semantic range without a visible
        // track/thumb in the default variant.
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

      Text(`${this.effectiveRate().toFixed(1)}x`)
        .width(this.rateValueWidth())
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(12)
        .fontColor(TOK_READ_PRIMARY)
        .textAlign(TextAlign.End);
    }
    .width('100%')
    .height(TTS_MODULE_RATE_HEIGHT)
    .padding({ left: 11, right: 11 })
    .alignItems(VerticalAlign.Center)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(6);
  }

  private effectiveRate(): number {
    return this.ratePreview >= READER_TTS_RATE_MIN ? this.ratePreview : this.state.rate;
  }

  private panelWidth(): number {
    return this.isTablet ? TTS_MODULE_PANEL_WIDTH_TABLET : TTS_MODULE_PANEL_WIDTH_PHONE;
  }

  private rateValueWidth(): number {
    return this.isTablet ? TTS_MODULE_RATE_VALUE_WIDTH_TABLET : TTS_MODULE_RATE_VALUE_WIDTH_PHONE;
  }

  private isActivelySpeaking(): boolean {
    return this.state.status === 'preparing' || this.state.status === 'playing' || this.state.status === 'resuming';
  }

  private hasActiveQueue(): boolean {
    return this.state.status === 'preparing' || this.state.status === 'playing' ||
      this.state.status === 'paused' || this.state.status === 'resuming' || this.state.status === 'interrupted';
  }
}
