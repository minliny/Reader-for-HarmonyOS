import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TOK_GREEN, TOK_ON_PRIMARY } from '../common/ReaderTokens';

/** Make SW2sjgSEPEPuPwyR0TULyP App.tsx Spinner, 1000ms linear (live CSS).
 * Actor stays mounted across partial results; only a new query resets it. */
@Component
export struct SearchSpinner {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @StorageLink('readerAppForeground') @Watch('updateAnimation') private foreground: boolean = true;
  @Prop @Watch('updateAnimation') active: boolean = false;
  @Prop @Watch('updateAnimation') runKey: number = 0;
  @Prop @Watch('updateAnimation') reduceMotion: boolean = false;
  @Prop diameter: number = 36;
  @Prop light: boolean = false;
  @State private angle: number = 0;
  private mounted: boolean = false;
  private spinning: boolean = false;
  private runningKey: number = -1;

  aboutToAppear(): void { this.mounted = true; this.updateAnimation(); }
  aboutToDisappear(): void { this.mounted = false; this.stopAnimation(); }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Circle({ width: this.diameter * 20 / 24, height: this.diameter * 20 / 24 })
        .fill(Color.Transparent).stroke(this.light ? readerAppColor('app.SearchSpinner.build.stroke.4DFFFAF4', this.appThemeScheme) : readerAppColor('app.SearchSpinner.build.stroke.262D4A3E', this.appThemeScheme))
        .strokeWidth(this.diameter * 2.5 / 24);
      Path().commands('M12 2 A10 10 0 0 1 22 12').width(24).height(24)
        .fill(Color.Transparent).stroke(this.light ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_GREEN', this.appThemeScheme))
        .strokeWidth(2.5).strokeLineCap(LineCapStyle.Round)
        .scale({ x: this.diameter / 24, y: this.diameter / 24 });
    }.width(this.diameter).height(this.diameter).rotate({ angle: this.angle })
      .visibility(this.active ? Visibility.Visible : Visibility.Hidden)
      .hitTestBehavior(HitTestMode.None);
  }

  private stopAnimation(): void {
    if (!this.spinning) return;
    this.spinning = false;
    this.getUIContext().animateTo({ duration: 0 }, (): void => { this.angle = 0; });
  }

  private updateAnimation(): void {
    if (!this.mounted) return;
    if (!this.active || !this.foreground || this.reduceMotion) { this.stopAnimation(); return; }
    if (this.spinning && this.runningKey === this.runKey) return;
    this.stopAnimation();
    this.runningKey = this.runKey;
    this.spinning = true;
    this.angle = 0;
    this.getUIContext().animateTo({ duration: 1000, curve: Curve.Linear, iterations: -1 },
      (): void => { this.angle = 360; });
  }
}
