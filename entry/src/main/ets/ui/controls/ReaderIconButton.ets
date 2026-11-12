import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerActionTouchRegion } from './ReaderActionAccessibility';
import { ReaderIconButtonSpecId, resolveReaderIconButtonSpec } from './ReaderControlSpecs';

type ReaderIconSelectionState = 'none' | 'active' | 'selected';

// Actual icon/hit/press geometry belongs to one finite current-UI recipe.
// Pages supply semantic identity, real action eligibility and their captured
// business action. Native ArkUI owns press/release/cancel and focus dispatch.
@Component
export struct ReaderIconButton {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop icon: Resource;
  @Prop specId: ReaderIconButtonSpecId = 'toolbar-standard';
  @Prop accessibilityLabel: string = '';
  @Prop focusId: string = '';
  @Prop actionEnabled: boolean = true;
  @Prop scheme: string = 'auto';
  @Prop selectionState: ReaderIconSelectionState = 'none';
  onTap: () => void = (): void => {};
  onFocused: () => void = (): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    if (this.specId === 'form-primary-icon') {
      this.formPrimaryButton();
    } else {
      this.iconStack();
    }
  }

  @Builder
  private formPrimaryButton() {
    Button({ type: ButtonType.Normal }) {
      Image(this.icon).width(resolveReaderIconButtonSpec(this.specId).iconSize)
        .height(resolveReaderIconButtonSpec(this.specId).iconSize).accessibilityLevel('no');
    }.width(resolveReaderIconButtonSpec(this.specId).boxSize).height(resolveReaderIconButtonSpec(this.specId).boxSize).padding(0)
      .attributeModifier(new ReaderPressFeedback(this.frameSurface(), this.effectiveScheme(),
        resolveReaderIconButtonSpec(this.specId).radius, resolveReaderIconButtonSpec(this.specId).pressedRadius))
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityText(this.accessibilityLabel).accessibilitySelected(false)
      .enabled(this.canAct())
      .id(this.focusId)
      .onFocus((): void => { if (this.mounted) this.onFocused(); })
      .responseRegion(readerActionTouchRegion(resolveReaderIconButtonSpec(this.specId).boxSize, resolveReaderIconButtonSpec(this.specId).boxSize))
      .onClick((): void => this.commit());
  }

  @Builder
  private iconStack() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Image(this.icon)
        .width(resolveReaderIconButtonSpec(this.specId).iconSize)
        .height(resolveReaderIconButtonSpec(this.specId).iconSize)
        .objectFit(ImageFit.Contain).opacity(this.specId === 'reader-chapter-step' || this.actionEnabled ? 1 : 0.45)
        .accessibilityLevel('no');
    }
    .padding(0)
    .width(resolveReaderIconButtonSpec(this.specId).boxSize)
    .height(resolveReaderIconButtonSpec(this.specId).boxSize)
    .attributeModifier(new ReaderPressFeedback(this.frameSurface(), this.effectiveScheme(),
      resolveReaderIconButtonSpec(this.specId).radius, resolveReaderIconButtonSpec(this.specId).pressedRadius,
      this.canAct() && resolveReaderIconButtonSpec(this.specId).pressFeedback !== false))
    .border(this.activeBorder())
    .opacity(this.specId === 'reader-chapter-step' && !this.actionEnabled ? 0.4 : 1)
    .enabled(this.canAct())
    .id(this.focusId)
    .onFocus((): void => { if (this.mounted) this.onFocused(); })
    .accessibilityText(this.accessibilityLabel)
    .accessibilityRole(AccessibilityRoleType.BUTTON)
    .accessibilitySelected(this.selectionState === 'selected')
    .responseRegion({ x: Math.min(0, (resolveReaderIconButtonSpec(this.specId).boxSize - 44) / 2),
      y: Math.min(0, (resolveReaderIconButtonSpec(this.specId).boxSize - 44) / 2),
      width: Math.max(44, resolveReaderIconButtonSpec(this.specId).boxSize),
      height: Math.max(44, resolveReaderIconButtonSpec(this.specId).boxSize) })
    .onClick((): void => this.commit());
  }

  private canAct(): boolean { return this.mounted && this.actionEnabled && this.accessibilityLabel.trim().length > 0; }
  private effectiveScheme(): string { return this.scheme === 'day' || this.scheme === 'night' ? this.scheme : this.appThemeScheme; }
  private frameSurface(): ResourceColor {
    const activeFill = resolveReaderIconButtonSpec(this.specId).activeFill;
    if (activeFill !== undefined && this.actionEnabled && this.selectionState !== 'none') {
      return readerAppColor(activeFill, this.effectiveScheme());
    }
    if (this.specId === 'form-primary-icon') return readerAppColor('TOK_PRIMARY_DARK', this.effectiveScheme());
    if (this.specId !== 'reader-chapter-step') return Color.Transparent;
    return readerAppColor(this.actionEnabled ? 'TOK_READ_ELEVATED' : 'TOK_READ_DISABLED_BG', this.effectiveScheme());
  }
  private activeBorder(): BorderOptions | undefined {
    const role = resolveReaderIconButtonSpec(this.specId).activeBorder;
    if (role === undefined) return undefined;
    return { width: this.actionEnabled && this.selectionState !== 'none' ? 1 : 0,
      color: readerAppColor(role, this.effectiveScheme()) };
  }
  private commit(): void { if (this.canAct()) this.onTap(); }
}
