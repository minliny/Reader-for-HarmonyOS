import { ReaderFormFieldSpecId, resolveReaderFormFieldSpec } from './ReaderControlSpecs';
import { readerReadableFontScale, readerScaledControlHeight } from './ReaderSurfaceResolvers';
import { readerAppColor } from './ReaderThemeRegistry';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';

/** Controlled native field. Draft and keyboard ownership remain with its
 * caller; AUTO omissions and credential masking belong to finite variants. */
class ReaderFormFieldModifier implements AttributeModifier<TextInputAttribute> {
  private id: ReaderFormFieldSpecId;
  private scheme: string;
  private accessibilityLabel: string;
  private fontScale: number;
  constructor(id: ReaderFormFieldSpecId, scheme: string, accessibilityLabel: string, fontScale: number = 1) {
    this.id = id;
    this.scheme = scheme;
    this.accessibilityLabel = accessibilityLabel;
    this.fontScale = fontScale;
  }
  // Shared normal recipe; the two native modifier signatures are thin ArkUI
  // adapters, so input and multiline fields never acquire duplicate recipes.
  applyNormalAttribute(instance: TextInputAttribute | TextAreaAttribute): void {
    if (this.accessibilityLabel.length > 0) instance.accessibilityText(this.accessibilityLabel);
    const spec = resolveReaderFormFieldSpec(this.id);
    const text = spec.text;
    if (spec.width !== undefined) instance.width(spec.width);
    if (spec.nativeLayoutWeight !== undefined) instance.layoutWeight(spec.nativeLayoutWeight);
    instance.height(readerScaledControlHeight(spec.height,
      text === undefined ? 16 : (text.lineHeightFp ?? text.fontSizeFp * 1.5), this.fontScale));
    if (text !== undefined) {
      if (text.fontFamily !== undefined) instance.fontFamily(text.fontFamily);
      if (text.fontWeight !== undefined) instance.fontWeight(text.fontWeight);
      instance.fontSize(text.fontSizeFp);
      if (text.lineHeightFp !== undefined) instance.lineHeight(text.lineHeightFp);
      if (text.letterSpacingFp !== undefined) instance.letterSpacing(text.letterSpacingFp);
    }
    if (spec.textRole !== undefined) instance.fontColor(readerAppColor(spec.textRole, this.scheme));
    const background = spec.transparentSurface ? Color.Transparent :
      (spec.surfaceRole === undefined ? undefined : readerAppColor(spec.surfaceRole, this.scheme));
    if (background !== undefined) instance.backgroundColor(background);
    if (spec.hasBorder) instance.border({ width: spec.borderWidth, color: readerAppColor(spec.borderRole, this.scheme) });
    if (spec.radius !== undefined) instance.borderRadius(spec.radius);
    if (spec.nativeInsets !== undefined) instance.padding(spec.nativeInsets);
    else if (spec.allPadding !== undefined) instance.padding(spec.allPadding);
    else if (spec.horizontalPadding !== undefined) instance.padding({ left: spec.horizontalPadding, right: spec.horizontalPadding });
    if (spec.caretRole !== undefined) instance.caretColor(readerAppColor(spec.caretRole, this.scheme));
    if (spec.placeholderStyle !== undefined) instance.placeholderFont({ size: spec.placeholderStyle.fontSizeFp, family: spec.placeholderStyle.fontFamily });
    if (spec.placeholderRole !== undefined) instance.placeholderColor(readerAppColor(spec.placeholderRole, this.scheme));
  }
}
class ReaderFormAreaModifier implements AttributeModifier<TextAreaAttribute> {
  private id: ReaderFormFieldSpecId;
  private scheme: string;
  private accessibilityLabel: string;
  private fontScale: number;
  constructor(id: ReaderFormFieldSpecId, scheme: string, accessibilityLabel: string, fontScale: number = 1) {
    this.id = id;
    this.scheme = scheme;
    this.accessibilityLabel = accessibilityLabel;
    this.fontScale = fontScale;
  }
  applyNormalAttribute(instance: TextAreaAttribute): void { new ReaderFormFieldModifier(this.id, this.scheme, this.accessibilityLabel, this.fontScale).applyNormalAttribute(instance); }
}
@Component
export struct ReaderFormField {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop scheme: string = 'day';
  @Prop specId: ReaderFormFieldSpecId = 'rules-input';
  @Prop text: string = '';
  @Prop placeholder: string = '';
  @Prop isEditable: boolean = true;
  @Prop password: boolean = false;
  @Prop inputIdentity: string = '';
  @Prop fieldAccessibilityLabel: string = '';
  inputController: TextInputController | undefined = undefined;
  onEditingChange: (editing: boolean) => void = (_editing: boolean): void => {};
  onSubmit: () => void = (): void => {};
  onTextChange: (value: string) => void = (_value: string): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  build() {
    if (resolveReaderFormFieldSpec(this.specId).multiline) {
      TextArea({ text: this.text, placeholder: this.placeholder })
        .attributeModifier(new ReaderFormAreaModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value));
    } else if (this.specId === 'reader-content-search') {
      TextInput({ text: this.text, placeholder: this.placeholder, controller: this.inputController })
        .id(this.inputIdentity).enableKeyboardOnFocus(true).maxLines(1).enterKeyType(EnterKeyType.Search)
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value))
        .onEditChange((editing: boolean): void => this.editChanged(editing))
        .onSubmit((_key: EnterKeyType): void => this.submit());
    } else if (this.specId === 'directory-rule-level') {
      TextInput({ text: this.text }).attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value));
    } else if (resolveReaderFormFieldSpec(this.specId).numberInput) {
      TextInput({ text: this.text, placeholder: this.placeholder }).type(InputType.Number)
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value));
    } else if (this.password) {
      TextInput({ text: this.text, placeholder: this.placeholder }).type(InputType.Password)
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value));
    } else if (this.specId === 'form-url') {
      TextInput({ text: this.text, placeholder: this.placeholder })
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value))
        .onSubmit((_enterKey: EnterKeyType): void => this.submit());
    } else {
      TextInput({ text: this.text, placeholder: this.placeholder })
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value));
    }
  }
  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
  }
  private editChanged(editing: boolean): void { if (this.mounted && this.isEditable) this.onEditingChange(editing); }
  private submit(): void { if (this.mounted && this.isEditable) this.onSubmit(); }
  private change(value: string): void { if (this.mounted && this.isEditable) this.onTextChange(value); }
}
