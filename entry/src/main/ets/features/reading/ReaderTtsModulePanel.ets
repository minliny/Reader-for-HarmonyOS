import type { ReaderTtsState } from './ReaderTtsState';
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
    Column({ space: 8 }) {
      this.playbackRow();
      this.timerRow();
      this.rateRow();
    }
    .width('100%')
    .height(this.isTablet ? 190 : 196)
    .padding({ left: 11, right: 11, top: 13, bottom: 13 })
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
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .lineHeight(12)
          .fontColor(TOK_READ_INK);
      }
      .width(106)
      .height(64)
      .alignItems(VerticalAlign.Center);

      Stack({ alignContent: Alignment.TopStart }) {
        this.previousButton();
        this.playPauseButton();
        this.stopButton();
        this.nextButton();
      }
      .width(128)
      .height(32);
    }
    .width('100%')
    .height(66)
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
    .height(42)
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
      .width(72)
      .alignItems(VerticalAlign.Center);

      Slider({
        value: this.effectiveRate(),
        min: 0.5,
        max: 2,
        step: 0.1,
        style: SliderStyle.OutSet,
        direction: Axis.Horizontal,
        reverse: false,
      })
        .width(116)
        .height(32)
        // The source master reserves this semantic range without a visible
        // track/thumb in the default variant.
        .opacity(0.001)
        .accessibilityText('调整朗读语速')
        .onChange((value: number, mode: SliderChangeMode): void => {
          this.ratePreview = Math.round(value * 10) / 10;
          if (mode === SliderChangeMode.End) {
            const rate = this.ratePreview;
            this.ratePreview = -1;
            this.onRateChange(rate);
          }
        });

      Text(`${this.effectiveRate().toFixed(1)}x`)
        .layoutWeight(1)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(12)
        .lineHeight(12)
        .fontColor(TOK_READ_PRIMARY)
        .textAlign(TextAlign.End);
    }
    .width('100%')
    .height(42)
    .padding({ left: 11, right: 11 })
    .alignItems(VerticalAlign.Center)
    .border({ width: TOK_BORDER_W, color: TOK_LINE_STRONG })
    .borderRadius(6);
  }

  private effectiveRate(): number {
    return this.ratePreview >= 0.5 ? this.ratePreview : this.state.rate;
  }

  private isActivelySpeaking(): boolean {
    return this.state.status === 'preparing' || this.state.status === 'playing' || this.state.status === 'resuming';
  }

  private hasActiveQueue(): boolean {
    return this.state.status === 'preparing' || this.state.status === 'playing' ||
      this.state.status === 'paused' || this.state.status === 'resuming' || this.state.status === 'interrupted';
  }
}
