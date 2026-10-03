import { readerAppColor } from './ReaderThemeRegistry';
import { ReaderPressFeedback } from './ReaderPressFeedback';
import { ReaderToggleSpecId, resolveReaderToggleSpec } from './ReaderSwitchSpecs';

/** Controlled value: clicking emits an intent; only the original owner can
 * publish the accepted/draft value. Native ArkUI owns press/release/cancel. */
@Component
export struct ReaderToggle {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop specId: ReaderToggleSpecId = 'standard-toggle';
  @Prop value: boolean = false;
  @Prop actionEnabled: boolean = true;
  @Prop isBusy: boolean = false;
  @Prop inputIdentity: string = '';
  @Prop accessibilityLabel: string = '';
  onToggle: (next: boolean) => void = (_next: boolean): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  build() {
    ForEach([this.inputIdentity], (identity: string): void => {
      Stack({ alignContent: Alignment.Center }) {
        Text('')
          .width(resolveReaderToggleSpec(this.specId).thumbSize)
          .height(resolveReaderToggleSpec(this.specId).thumbSize)
          .borderRadius(resolveReaderToggleSpec(this.specId).thumbRadius)
          .backgroundColor(readerAppColor(resolveReaderToggleSpec(this.specId).thumbColor, this.appThemeScheme))
          .position({ x: this.value ? resolveReaderToggleSpec(this.specId).thumbOnX : resolveReaderToggleSpec(this.specId).thumbOffX,
            y: resolveReaderToggleSpec(this.specId).thumbY });
      }
      .width(resolveReaderToggleSpec(this.specId).width)
      .height(resolveReaderToggleSpec(this.specId).height)
      .attributeModifier(new ReaderPressFeedback(readerAppColor(this.value ? resolveReaderToggleSpec(this.specId).checkedColor :
        resolveReaderToggleSpec(this.specId).uncheckedColor, this.appThemeScheme), this.appThemeScheme,
        resolveReaderToggleSpec(this.specId).radius, resolveReaderToggleSpec(this.specId).pressedRadius, this.canAct(identity)))
      .responseRegion({ x: 0, y: resolveReaderToggleSpec(this.specId).responseY,
        width: resolveReaderToggleSpec(this.specId).width, height: resolveReaderToggleSpec(this.specId).responseHeight })
      .enabled(this.canAct(identity)).focusable(this.canAct(identity))
      .accessibilityRole(AccessibilityRoleType.SWITCH).accessibilityChecked(this.value)
      .accessibilityText(this.accessibilityLabel)
      .onClick((): void => this.toggle(identity));
    }, (identity: string): string => identity);
  }
  private canAct(identity: string): boolean {
    return this.mounted && identity.length > 0 && this.actionEnabled && !this.isBusy && identity === this.inputIdentity;
  }
  private toggle(identity: string): void { if (this.canAct(identity)) this.onToggle(!this.value); }
}
