import { readerAppColor } from '../common/ReaderThemeRegistry';

/** Restore the pre-repair platform LoadingProgress appearance and motion.
 * One retained component serves loading and streamed results; only native
 * animation enablement changes with visibility, foreground and reduced motion. */
@Component
export struct SearchSpinner {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') private foreground: boolean = true;
  @Prop active: boolean = false;
  @Prop runKey: number = 0;
  @Prop reduceMotion: boolean = false;
  @Prop diameter: number = 36;
  @Prop light: boolean = false;

  build() {
    Stack() {
      LoadingProgress()
        .width(this.diameter).height(this.diameter)
        .color(this.light ? readerAppColor('TOK_ON_PRIMARY', this.appThemeScheme) :
          readerAppColor('TOK_GREEN', this.appThemeScheme))
        .enableLoading(this.shouldAnimate());
    }
    .width(this.diameter).height(this.diameter)
    .visibility(this.active ? Visibility.Visible : Visibility.Hidden)
    .hitTestBehavior(HitTestMode.None);
  }

  private shouldAnimate(): boolean {
    return this.active && this.foreground && !this.reduceMotion;
  }
}
