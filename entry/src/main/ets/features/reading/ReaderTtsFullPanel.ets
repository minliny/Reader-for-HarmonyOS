import type { ReaderTtsState } from './ReaderTtsState';
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

/** Figma full TTS sheets: Phone `942:78`, Tablet `942:80`. */
@Component
export struct ReaderTtsFullPanel {
  @Prop isTablet: boolean = false;
  @Prop state: ReaderTtsState;
  @Prop timerMinutes: number = 15;
  @Prop timerSeconds: number = 0;
  @Prop followHighlight: boolean = true;
  @Prop allowMixing: boolean = false;
  @Prop failurePolicy: 'skip' | 'stop' = 'stop';
  onCollapse: () => void = (): void => {};
  onToggle: () => void = (): void => {};
  onStop: () => void = (): void => {};
  onPrevious: () => void = (): void => {};
  onNext: () => void = (): void => {};
  onTimerChange: (minutes: number, seconds: number) => void =
    (_minutes: number, _seconds: number): void => {};
  onRateChange: (rate: number) => void = (_rate: number): void => {};
  onFollowHighlightChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onAllowMixingChange: (enabled: boolean) => void = (_enabled: boolean): void => {};
  onFailurePolicyChange: (policy: 'skip' | 'stop') => void = (_policy: 'skip' | 'stop'): void => {};
  @State private ratePreview: number = -1;

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(42)
        .height(4)
        .backgroundColor(TOK_READ_HANDLE)
        .borderRadius(999)
        .position({ x: this.isTablet ? 339 : 161, y: 9 });

      this.header();

      Scroll() {
        Column() {
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
        .padding({ left: this.isTablet ? 12 : 11, right: this.isTablet ? 12 : 11, bottom: 24 })
        .alignItems(HorizontalAlign.Start);
      }
      .width(this.isTablet ? 692 : 338)
      .height(this.isTablet ? 782 : 665)
      .position({ x: 14, y: 58 })
      .scrollBar(BarState.Off)
      .edgeEffect(EdgeEffect.None)
      .backgroundColor(TOK_SURFACE_PANEL)
      .border({ width: TOK_BORDER_W, color: TOK_LINE })
      .borderRadius(12);
    }
    .width(this.isTablet ? 720 : 364)
    .height(this.isTablet ? 852 : 736)
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
    .width(this.isTablet ? 692 : 336)
    .height(30)
    .alignItems(VerticalAlign.Center)
    .position({ x: 14, y: 20 });
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
    }
    .width('100%')
    .height(128)
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
    .width(278)
    .height(158)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center);
  }

  @Builder
  private timerWheel(minutes: boolean) {
    Column() {
      Text(this.wheelValue(minutes, -1))
        .width(122)
        .height(43)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(12)
        .fontColor(TOK_READ_MUTED)
        .opacity(0.56)
        .textAlign(TextAlign.Center)
        .onClick((): void => this.stepTimer(minutes, -1));
      Text(this.wheelValue(minutes, 0))
        .width(122)
        .height(43)
        .fontFamily('ReaderInter')
        .fontWeight(800)
        .fontSize(17)
        .fontColor(TOK_READ_INK)
        .textAlign(TextAlign.Center)
        .border({ width: { top: TOK_BORDER_W, bottom: TOK_BORDER_W }, color: TOK_READ_PRIMARY });
      Text(this.wheelValue(minutes, 1))
        .width(122)
        .height(43)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Medium)
        .fontSize(12)
        .fontColor(TOK_READ_MUTED)
        .opacity(0.56)
        .textAlign(TextAlign.Center)
        .onClick((): void => this.stepTimer(minutes, 1));
      Text(minutes ? '分' : '秒')
        .width(122)
        .fontFamily('ReaderInter')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.Center);
    }
    .width(122)
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
        min: 0.5,
        max: 2,
        step: 0.1,
        style: SliderStyle.OutSet,
        direction: Axis.Horizontal,
        reverse: false,
      })
        .width('100%')
        .height(32)
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
      Row() {
        Text('0.5x').layoutWeight(1).fontFamily('ReaderInter').fontSize(9).fontColor(TOK_READ_MUTED);
        Text('2.0x').fontFamily('ReaderInter').fontSize(9).fontColor(TOK_READ_MUTED);
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
          .borderRadius(6);
        Text('在线 TTS')
          .layoutWeight(1)
          .height(52)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Bold)
          .fontSize(12)
          .fontColor(TOK_READ_MUTED)
          .opacity(0.42)
          .textAlign(TextAlign.Center)
          .border({ width: TOK_BORDER_W, color: TOK_LINE })
          .borderRadius(6);
      }
      .width('100%')
      .padding({ top: 8, bottom: 8 });
      this.selectorRow('系统引擎', '离线');
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
    const maximum = minutes ? 99 : 59;
    const current = minutes ? this.timerMinutes : this.timerSeconds;
    return this.twoDigits(Math.max(0, Math.min(maximum, current + delta)));
  }

  private stepTimer(minutes: boolean, delta: number): void {
    const nextMinutes = minutes ? Math.max(0, Math.min(99, this.timerMinutes + delta)) : this.timerMinutes;
    const nextSeconds = minutes ? this.timerSeconds : Math.max(0, Math.min(59, this.timerSeconds + delta));
    this.onTimerChange(nextMinutes, nextSeconds);
  }

  private twoDigits(value: number): string {
    const normalized = Math.max(0, Math.trunc(value));
    return normalized < 10 ? `0${normalized}` : `${normalized}`;
  }

  private effectiveRate(): number {
    return this.ratePreview >= 0.5 ? this.ratePreview : this.state.rate;
  }

  private statusText(): string {
    if (this.state.status === 'playing') return '播放中';
    if (this.state.status === 'paused') return '已暂停';
    if (this.state.status === 'interrupted') return '已中断';
    if (this.state.status === 'preparing' || this.state.status === 'resuming') return '准备中';
    if (this.state.status === 'completed') return '已完成';
    return '未开始';
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
