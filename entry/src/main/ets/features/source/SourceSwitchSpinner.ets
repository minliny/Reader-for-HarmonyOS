import { readerAppColor } from '../common/ReaderThemeRegistry';

/** Native indeterminate loading with the source-switch owner's admission.
 * The platform owns the ring geometry and animation timing. */
@Component
export struct SourceSwitchSpinner {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') private foreground: boolean = true;
  @Prop active: boolean = false;
  @Prop reduceMotion: boolean = false;
  @Prop diameter: number = 18;
  @State private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    LoadingProgress()
      .width(this.diameter).height(this.diameter)
      .color(readerAppColor('TOK_PRIMARY_DARK', this.appThemeScheme))
      .enableLoading(this.mounted && this.active && this.foreground && !this.reduceMotion)
      .visibility(this.active ? Visibility.Visible : Visibility.Hidden)
      .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
  }
}
