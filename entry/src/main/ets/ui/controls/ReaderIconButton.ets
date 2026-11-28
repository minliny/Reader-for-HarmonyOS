import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerPressAnimation, readerPressOpacity, readerPressPointer, readerPressScale } from '../foundation/ReaderPressMotion';
import { readerAppColor } from '../foundation/ReaderAppColors';
import { readerActionTouchRegion } from './ReaderActionAccessibility';
import { ReaderIconButtonSpecId, resolveReaderIconButtonSpec } from './ReaderControlSpecs';

type ReaderIconSelectionState = 'none' | 'active' | 'selected';

// Actual icon/hit/press geometry belongs to one finite current-UI recipe.
// Pages supply semantic identity, real action eligibility and their captured
// business action. Native ArkUI owns press/release/cancel and focus dispatch.
@Component
export struct ReaderIconButton {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageProp('readerReduceMotion') private reduceMotion: boolean = false;
  @Prop icon: Resource;
  @Prop specId: ReaderIconButtonSpecId = 'toolbar-standard';
  @Prop accessibilityLabel: string = '';
  @Prop focusId: string = '';
  @Prop minimumTargetSize: number = 0;
  @Prop @Watch('resetPress') actionEnabled: boolean = true;
  @Prop @Watch('resetPress') actionScope: string = '';
  @Prop scheme: string = 'auto';
  @Prop selectionState: ReaderIconSelectionState = 'none';
  @State private pressPointer: number = -1;
  onTap: () => void = (): void => {};
  onFocused: () => void = (): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; this.resetPress(); }

  build() {
    if (this.specId === 'form-primary-icon') {
      this.formPrimaryButton();
    } else {
      this.iconStack();
    }
  }

  @Builder
  private formPrimaryButton() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      this.iconPaint();
    }.width(this.formPrimaryBoxSize()).height(this.formPrimaryBoxSize()).padding(0)
      .backgroundColor(Color.Transparent).borderRadius(this.restingRadius())
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityText(this.accessibilityLabel).accessibilitySelected(false)
      .enabled(this.canAct())
      .id(this.focusId)
      .onFocus((): void => { if (this.mounted) this.onFocused(); })
      .responseRegion(readerActionTouchRegion(this.formPrimaryBoxSize(), this.formPrimaryBoxSize()))
      .onTouch((event: TouchEvent): void => this.observePress(event))
      .onClick(this.actionHandler());
  }

  @Builder
  private iconStack() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      this.iconPaint();
    }
    .padding(0)
    .width(resolveReaderIconButtonSpec(this.specId).boxSize)
    .height(resolveReaderIconButtonSpec(this.specId).boxSize)
    .backgroundColor(Color.Transparent).borderRadius(this.restingRadius())
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
    .onTouch((event: TouchEvent): void => this.observePress(event))
    .onClick(this.actionHandler());
  }

  @Builder
  private iconPaint() {
    Stack({ alignContent: Alignment.Center }) {
      Image(this.icon)
        .width(resolveReaderIconButtonSpec(this.specId).iconSize)
        .height(resolveReaderIconButtonSpec(this.specId).iconSize)
        .objectFit(ImageFit.Contain)
        .opacity(this.specId === 'reader-chapter-step' || this.actionEnabled ? 1 : 0.45)
        .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
    }.width(this.paintBoxSize()).height(this.paintBoxSize()).border(this.activeBorder()).borderRadius(this.restingRadius())
      .scale(readerPressScale(this.pressPointer >= 0, this.reduceMotion))
      .opacity(readerPressOpacity(this.pressPointer >= 0, this.reduceMotion,
        this.specId === 'reader-chapter-step' && !this.actionEnabled ? 0.4 : 1))
      .animation(readerPressAnimation(this.reduceMotion))
      .attributeModifier(new ReaderPressFeedback(this.frameSurface(), this.effectiveScheme(),
        this.restingRadius(),
        Math.min(resolveReaderIconButtonSpec(this.specId).pressedRadius, this.paintBoxSize() / 2),
        this.canAct() && resolveReaderIconButtonSpec(this.specId).pressFeedback !== false, this.pressPointer >= 0))
      .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
  }

  private observePress(event: TouchEvent): void {
    this.pressPointer = readerPressPointer(event, this.pressPointer,
      this.canAct() && resolveReaderIconButtonSpec(this.specId).pressFeedback !== false);
  }

  private resetPress(): void { this.pressPointer = -1; }

  private canAct(): boolean { return this.mounted && this.actionEnabled && this.accessibilityLabel.trim().length > 0; }
  private restingRadius(): number {
    const spec = resolveReaderIconButtonSpec(this.specId);
    return Math.min(spec.radius, this.paintBoxSize() / 2);
  }

  private paintBoxSize(): number {
    const spec = resolveReaderIconButtonSpec(this.specId);
    return this.specId === 'form-primary-icon' ? this.formPrimaryBoxSize() : spec.paintSize ?? spec.boxSize;
  }
  private formPrimaryBoxSize(): number {
    return Math.max(resolveReaderIconButtonSpec(this.specId).boxSize, this.minimumTargetSize);
  }
  private effectiveScheme(): string { return this.scheme === 'day' || this.scheme === 'night' ? this.scheme : this.appThemeScheme; }
  private frameSurface(): ResourceColor {
    const spec = resolveReaderIconButtonSpec(this.specId);
    const fill = this.actionEnabled && this.selectionState !== 'none' ? spec.activeFill ?? spec.restingFill : spec.restingFill;
    if (fill !== undefined) return readerAppColor(fill, this.effectiveScheme());
    if (this.specId === 'form-primary-icon') return readerAppColor('TOK_PRIMARY_DARK', this.effectiveScheme());
    if (this.specId !== 'reader-chapter-step') return Color.Transparent;
    return readerAppColor(this.actionEnabled ? 'TOK_READ_ELEVATED' : 'TOK_READ_DISABLED_BG', this.effectiveScheme());
  }
  private activeBorder(): BorderOptions | undefined {
    const spec = resolveReaderIconButtonSpec(this.specId);
    const role = this.actionEnabled && this.selectionState !== 'none' ?
      spec.activeBorder ?? spec.restingBorder : spec.restingBorder;
    return role === undefined ? undefined : { width: 1, color: readerAppColor(role, this.effectiveScheme()) };
  }
  private commit(): void { if (this.canAct()) this.onTap(); }
  private actionHandler(): () => void {
    const scope = this.actionScope;
    return (): void => { if (scope === this.actionScope) this.commit(); };
  }
}
