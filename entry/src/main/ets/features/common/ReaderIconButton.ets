import { ReaderPressFeedback } from './ReaderPressFeedback';
import { ReaderIconButtonSpecId, resolveReaderIconButtonSpec } from './ReaderControlSpecs';

// Actual icon/hit/press geometry belongs to one finite current-UI recipe.
// Pages supply semantic identity, real action eligibility and their captured
// business action. Native ArkUI owns press/release/cancel and focus dispatch.
@Component
export struct ReaderIconButton {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop icon: Resource;
  @Prop specId: ReaderIconButtonSpecId = 'toolbar-standard';
  @Prop accessibilityLabel: string = '';
  @Prop actionEnabled: boolean = true;
  onTap: () => void = (): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.icon)
        .width(resolveReaderIconButtonSpec(this.specId).iconSize)
        .height(resolveReaderIconButtonSpec(this.specId).iconSize);
    }
    .width(resolveReaderIconButtonSpec(this.specId).boxSize)
    .height(resolveReaderIconButtonSpec(this.specId).boxSize)
    .attributeModifier(new ReaderPressFeedback(Color.Transparent, this.appThemeScheme,
      resolveReaderIconButtonSpec(this.specId).radius, resolveReaderIconButtonSpec(this.specId).pressedRadius, this.canAct()))
    .enabled(this.canAct()).focusable(this.canAct())
    .accessibilityText(this.accessibilityLabel)
    .accessibilityRole(AccessibilityRoleType.BUTTON)
    .onClick((): void => this.commit());
  }

  private canAct(): boolean { return this.mounted && this.actionEnabled && this.accessibilityLabel.trim().length > 0; }
  private commit(): void { if (this.canAct()) this.onTap(); }
}
