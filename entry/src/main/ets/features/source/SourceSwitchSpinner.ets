import type { AnimatorResult } from '@ohos.animator';
import { readerAppColor } from '../common/ReaderThemeRegistry';

/** The selected novel demo's CSS border ring. ArkUI owns SVG path drawing and
 * the linear vSync animator; this component only binds their product settings.
 * The 36px drawing viewport is explicit because SVG path coordinates are px,
 * while the surrounding component is sized in vp. */
@Component
export struct SourceSwitchSpinner {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') @Watch('motionChanged') private foreground: boolean = true;
  @Prop @Watch('motionChanged') active: boolean = false;
  @Prop @Watch('motionChanged') reduceMotion: boolean = false;
  @Prop diameter: number = 18;
  @Prop strokeWidth: number = 1.5;
  @Prop @Watch('motionChanged') durationMs: number = 1000;
  @State private angle: number = 0;
  private mounted: boolean = false;
  private animator: AnimatorResult | undefined = undefined;
  private animatorDuration: number = 0;
  private animationEpoch: number = 0;

  aboutToAppear(): void {
    this.mounted = true;
    this.motionChanged();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.stopAnimation();
  }

  private shouldAnimate(): boolean {
    return this.mounted && this.active && this.foreground && !this.reduceMotion;
  }

  private stopAnimation(): void {
    this.animationEpoch += 1;
    const animator = this.animator;
    this.animator = undefined;
    this.animatorDuration = 0;
    // cancel can emit the end value. Detach first, then reject any already
    // queued vSync callback by its epoch and retained animator identity.
    if (animator !== undefined) {
      animator.onFrame = (_value: number): void => {};
      animator.cancel();
    }
    this.angle = 0;
  }

  private motionChanged(): void {
    if (!this.shouldAnimate()) {
      this.stopAnimation();
      return;
    }
    const duration = Number.isFinite(this.durationMs) && this.durationMs > 0 ? this.durationMs : 1000;
    if (this.animator !== undefined && this.animatorDuration === duration) return;
    this.stopAnimation();
    const epoch = this.animationEpoch;
    const animator = this.getUIContext().createAnimator({
      duration: duration, easing: 'linear', delay: 0, fill: 'forwards',
      direction: 'normal', iterations: -1, begin: 0, end: 360,
    });
    this.animator = animator;
    this.animatorDuration = duration;
    animator.onFrame = (value: number): void => {
      if (epoch !== this.animationEpoch || this.animator !== animator || !this.shouldAnimate()) return;
      this.angle = value;
    };
    animator.play();
  }

  private innerRadius(): number {
    const diameter = Number.isFinite(this.diameter) && this.diameter > 0 ? this.diameter : 18;
    const stroke = Number.isFinite(this.strokeWidth) && this.strokeWidth > 0 ? this.strokeWidth : 1.5;
    return Math.max(0, 18 - 36 * Math.min(stroke, diameter / 2) / diameter);
  }

  private trackCommands(): string {
    const inner = this.innerRadius();
    const outerStart = 18 - 18 * Math.SQRT1_2;
    const outerEnd = 18 + 18 * Math.SQRT1_2;
    const innerStart = 18 - inner * Math.SQRT1_2;
    const innerEnd = 18 + inner * Math.SQRT1_2;
    // The other three CSS borders form the remaining 270 degrees. Separate
    // fills avoid painting the translucent track underneath the top border.
    return `M${outerEnd} ${outerStart} A18 18 0 1 1 ${outerStart} ${outerStart} ` +
      `L${innerStart} ${innerStart} A${inner} ${inner} 0 1 0 ${innerEnd} ${innerStart} Z`;
  }

  private topCommands(): string {
    const inner = this.innerRadius();
    const outerStart = 18 - 18 * Math.SQRT1_2;
    const outerEnd = 18 + 18 * Math.SQRT1_2;
    const innerStart = 18 - inner * Math.SQRT1_2;
    const innerEnd = 18 + inner * Math.SQRT1_2;
    return `M${outerStart} ${outerStart} A18 18 0 0 1 ${outerEnd} ${outerStart} ` +
      `L${innerEnd} ${innerStart} A${inner} ${inner} 0 0 0 ${innerStart} ${innerStart} Z`;
  }

  build() {
    Shape() {
      Path({ width: '36px', height: '36px' }).commands(this.trackCommands())
        .fill(readerAppColor('TOK_LINE', this.appThemeScheme)).strokeWidth(0);
      Path({ width: '36px', height: '36px' }).commands(this.topCommands())
        .fill(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme)).strokeWidth(0);
    }.viewPort({ x: '0px', y: '0px', width: '36px', height: '36px' })
      .width(this.diameter).height(this.diameter).antiAlias(true)
      .rotate({ angle: this.angle }).visibility(this.active ? Visibility.Visible : Visibility.Hidden)
      .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
  }
}
