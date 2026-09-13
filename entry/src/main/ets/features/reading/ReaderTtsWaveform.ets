import curves from '@ohos.curves';
import { FrameCallback } from '@kit.ArkUI';
import { readerMotionNowMs } from '../common/ReaderMotionClock';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { readerHighlightColor } from './ReaderDynamicHighlight';
import { ReaderTtsWaveformClock, createReaderTtsWaveformSample, type ReaderTtsWaveformSample } from './ReaderTtsWaveformModel';

const EASE = curves.cubicBezierCurve(.25, .1, .25, 1);
const EASE_IN_OUT = curves.cubicBezierCurve(.42, 0, .58, 1);
const WAVEFORM_CLOCK = new ReaderTtsWaveformClock({
  ease: (p: number): number => EASE.interpolate(p),
  easeInOut: (p: number): number => EASE_IN_OUT.interpolate(p),
}, readerMotionNowMs);

export function readerTtsWaveformSnapshot(): ReaderTtsWaveformSample { return WAVEFORM_CLOCK.snapshot(); }

class ReaderTtsWaveformFrame extends FrameCallback {
  private readonly callback: () => void;
  constructor(callback: () => void) { super(); this.callback = callback; }
  onFrame(_time: number): void { this.callback(); }
}

@Component
export struct ReaderTtsWaveform {
  @Prop @Watch('onPlaybackChanged') playing: boolean = false;
  @Prop @Watch('onPlaybackChanged') active: boolean = true;
  @Prop @Watch('onPlaybackChanged') reduceMotion: boolean = false;
  @Prop appThemeScheme: string = 'day';
  @Prop @Watch('onPlaybackChanged') frozen: boolean = false;
  @Prop frozenSample: ReaderTtsWaveformSample | undefined = undefined;
  @State private liveSample: ReaderTtsWaveformSample = createReaderTtsWaveformSample();
  private frozenFallback: ReaderTtsWaveformSample = createReaderTtsWaveformSample();
  private subscription: number = -1;
  private mounted: boolean = false;
  private visible: boolean = false;
  private colorScheme: string = '';
  private colorProgress: number = -1;
  private colorValue: number = 0;

  aboutToAppear(): void {
    this.mounted = true; this.frozenFallback = readerTtsWaveformSnapshot(); this.liveSample = this.frozenFallback;
    this.onPlaybackChanged();
  }
  aboutToDisappear(): void {
    this.mounted = false; WAVEFORM_CLOCK.unsubscribe(this.subscription); this.subscription = -1;
  }
  private onPlaybackChanged(): void {
    if (!this.mounted) return;
    if (this.frozen || !this.active || !this.visible) {
      WAVEFORM_CLOCK.unsubscribe(this.subscription); this.subscription = -1;
      return;
    }
    if (this.subscription < 0) {
      this.subscription = WAVEFORM_CLOCK.subscribe(this.playing, this.reduceMotion,
        (sample: ReaderTtsWaveformSample): void => { if (this.mounted && this.active && this.visible && !this.frozen) this.liveSample = sample; },
        (callback: () => void): void => this.getUIContext().postFrameCallback(new ReaderTtsWaveformFrame(callback)));
    } else WAVEFORM_CLOCK.update(this.subscription, this.playing, this.reduceMotion);
  }
  private sample(): ReaderTtsWaveformSample { return this.frozen ? this.frozenSample ?? this.frozenFallback : this.liveSample; }
  private barColor(): number {
    const progress = this.sample().colorProgress;
    if (this.colorProgress === progress && this.colorScheme === this.appThemeScheme) return this.colorValue;
    const idle = readerHighlightColor(readerAppColor('app.control.paint.B4A697', this.appThemeScheme));
    const active = readerHighlightColor(readerAppColor('TOK_TTS_TEAL', this.appThemeScheme));
    // Make's rgba(...,.42) becomes the same application role at 42% alpha.
    const a0 = idle[3] * .42 * (1 - progress), a1 = active[3] * progress, alpha = a0 + a1;
    const r = Math.round((idle[0] * a0 + active[0] * a1) / Math.max(.0001, alpha) * 255);
    const g = Math.round((idle[1] * a0 + active[1] * a1) / Math.max(.0001, alpha) * 255);
    const b = Math.round((idle[2] * a0 + active[2] * a1) / Math.max(.0001, alpha) * 255);
    this.colorProgress = progress; this.colorScheme = this.appThemeScheme;
    this.colorValue = ((Math.round(alpha * 255) << 24) | (r << 16) | (g << 8) | b) >>> 0;
    return this.colorValue;
  }
  build() {
    Row() {
      ForEach(this.sample().heights, (height: number, index: number): void => {
        Row().width(2.5).height(height).borderRadius(2)
          .scale({ x: 1, y: this.sample().scales[index], centerY: '50%' })
          .backgroundColor(this.barColor()).opacity(this.sample().opacities[index]);
      }, (_height: number, index: number): string => index.toString());
    }.width('100%').height(26).justifyContent(FlexAlign.SpaceBetween).alignItems(VerticalAlign.Center)
      .hitTestBehavior(HitTestMode.None).accessibilityLevel('no')
      .onVisibleAreaChange([0, 0.01, 1], (visible: boolean, ratio: number): void => {
        this.visible = visible && ratio > 0;
        this.onPlaybackChanged();
      });
  }
}
