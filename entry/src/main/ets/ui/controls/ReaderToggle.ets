import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import type { ReaderAppColorRole } from '../foundation/ReaderThemeRegistry';

type ReaderToggleSpecId = 'standard-toggle' | 'bookshelf-update-toggle';
interface ReaderToggleSpec {
  thumbColor: ReaderAppColorRole;
  checkedColor: ReaderAppColorRole;
  uncheckedColor: ReaderAppColorRole;
}
const STANDARD_TOGGLE: ReaderToggleSpec = {
  thumbColor: 'app.toggle.thumb',
  checkedColor: 'TOK_PRIMARY_DARK', uncheckedColor: 'app.toggle.offTrack',
};
// Preserves the bookshelf settings page's pre-migration green track while
// adopting the one shared switch geometry and interaction contract.
const BOOKSHELF_UPDATE_TOGGLE: ReaderToggleSpec = {
  thumbColor: 'app.toggle.thumb',
  checkedColor: 'TOK_GREEN', uncheckedColor: 'app.toggle.offTrack',
};
function resolveReaderToggleSpec(id: ReaderToggleSpecId): ReaderToggleSpec {
  if (id === 'bookshelf-update-toggle') return BOOKSHELF_UPDATE_TOGGLE;
  if (id !== 'standard-toggle') throw new Error('Unknown ReaderToggle specification');
  return STANDARD_TOGGLE;
}

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
  @State private nativeRevision: number = 0;
  onToggle: (next: boolean) => void = (_next: boolean): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  build() {
    ForEach([this.inputIdentity], (identity: string): void => {
      Stack({ alignContent: Alignment.Center }) {
        Toggle({ type: ToggleType.Switch, isOn: this.value })
          .width(44).height(24)
          .selectedColor(readerAppColor(resolveReaderToggleSpec(this.specId).checkedColor, this.appThemeScheme))
          .switchStyle({ pointRadius: 10, trackBorderRadius: 12,
            pointColor: readerAppColor(resolveReaderToggleSpec(this.specId).thumbColor, this.appThemeScheme),
            unselectedColor: readerAppColor(resolveReaderToggleSpec(this.specId).uncheckedColor, this.appThemeScheme) })
          .responseRegion({ x: 0, y: -10, width: 44, height: 44 })
          .enabled(this.canAct(identity)).focusable(this.canAct(identity))
          .accessibilityText(this.accessibilityLabel)
          .onChange(this.nativeChangeHandler(identity, this.nativeRevision));
      }.width(44).height(44);
    }, (identity: string): string => identity);
  }
  private canAct(identity: string): boolean {
    return this.mounted && identity.length > 0 && this.actionEnabled && !this.isBusy && identity === this.inputIdentity;
  }
  private nativeChangeHandler(identity: string, revision: number): (next: boolean) => void {
    return (next: boolean): void => this.toggle(identity, revision, next);
  }
  private toggle(identity: string, revision: number, next: boolean): void {
    if (revision !== this.nativeRevision || !this.canAct(identity) || next === this.value) return;
    // This revision is read by the native observer when binding onChange.
    // Its update reapplies the controlled isOn value on the same Toggle node,
    // including rejected intents whose owner value stays unchanged.
    this.nativeRevision += 1;
    this.onToggle(next);
  }
}
