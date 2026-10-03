import { TYPE_APP_SEGMENT_LABEL } from './ReaderTypography';
import { readerAppColor } from './ReaderThemeRegistry';
import { ReaderSegmentSpecId, resolveReaderSegmentSpec } from './ReaderSwitchSpecs';

/** Existing 168×36 short enum. Stable option IDs identify the intent; the
 * accepted selection always comes back from the original theme owner. */
@Component
export struct ReaderSegmentedControl {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop specId: ReaderSegmentSpecId = 'app-theme-segment';
  @Prop options: string[] = [];
  @Prop optionIds: string[] = [];
  @Prop selectedIndex: number = 0;
  @Prop actionEnabled: boolean = true;
  @Prop isBusy: boolean = false;
  @Prop inputIdentity: string = '';
  @Prop accessibilityLabel: string = '';
  onSelect: (index: number) => void = (_index: number): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  build() {
    ForEach([this.inputIdentity], (identity: string): void => {
      Row() {
        ForEach(this.optionIds, (optionId: string): void => {
          Stack({ alignContent: Alignment.Center }) {
            Text(this.optionLabel(optionId))
              .fontFamily(TYPE_APP_SEGMENT_LABEL.fontFamily)
              .fontWeight(TYPE_APP_SEGMENT_LABEL.fontWeight)
              .fontSize(TYPE_APP_SEGMENT_LABEL.fontSizeFp)
              .fontColor(this.isSelected(optionId) ? readerAppColor(resolveReaderSegmentSpec(this.specId).activeText, this.appThemeScheme) :
                readerAppColor(resolveReaderSegmentSpec(this.specId).inactiveText, this.appThemeScheme))
              .maxLines(1);
          }
          .layoutWeight(1)
          .height(resolveReaderSegmentSpec(this.specId).itemHeight)
          .borderRadius(resolveReaderSegmentSpec(this.specId).itemRadius)
          .backgroundColor(this.isSelected(optionId) ? readerAppColor(resolveReaderSegmentSpec(this.specId).selectedSurface, this.appThemeScheme) : Color.Transparent)
          .border(this.isSelected(optionId) ? { width: resolveReaderSegmentSpec(this.specId).borderWidth,
            color: readerAppColor(resolveReaderSegmentSpec(this.specId).selectedBorder, this.appThemeScheme) } : { width: 0 })
          .enabled(this.canAct(identity, optionId)).focusable(this.canAct(identity, optionId))
          .accessibilityRole(AccessibilityRoleType.RADIO).accessibilitySelected(this.isSelected(optionId))
          .accessibilityText(this.optionLabel(optionId))
          .onClick((): void => this.select(identity, optionId));
        }, (optionId: string): string => optionId);
      }
      .width(resolveReaderSegmentSpec(this.specId).width)
      .height(resolveReaderSegmentSpec(this.specId).height)
      .padding({ left: resolveReaderSegmentSpec(this.specId).padding, right: resolveReaderSegmentSpec(this.specId).padding,
        top: resolveReaderSegmentSpec(this.specId).padding, bottom: resolveReaderSegmentSpec(this.specId).padding })
      .backgroundColor(readerAppColor(resolveReaderSegmentSpec(this.specId).surface, this.appThemeScheme))
      .border({ width: resolveReaderSegmentSpec(this.specId).borderWidth, color: readerAppColor(resolveReaderSegmentSpec(this.specId).border, this.appThemeScheme) })
      .borderRadius(resolveReaderSegmentSpec(this.specId).radius)
      .accessibilityText(this.accessibilityLabel)
      .alignItems(VerticalAlign.Center);
    }, (identity: string): string => identity);
  }
  private optionLabel(id: string): string { return this.options[this.optionIds.indexOf(id)] ?? ''; }
  private isSelected(id: string): boolean { return this.optionIds.indexOf(id) === this.selectedIndex; }
  private canAct(identity: string, id: string): boolean {
    return this.mounted && identity.length > 0 && this.actionEnabled && !this.isBusy && identity === this.inputIdentity &&
      this.optionIds.length === this.options.length && this.optionIds.indexOf(id) >= 0 &&
      this.optionIds.every((value: string, index: number): boolean => value.length > 0 && this.optionIds.indexOf(value) === index);
  }
  private select(identity: string, id: string): void { if (this.canAct(identity, id)) this.onSelect(this.optionIds.indexOf(id)); }
}
