import { ReaderFormFieldSpecId, resolveReaderFormFieldSpec } from './ReaderControlSpecs';
import { readerAppColor } from './ReaderThemeRegistry';
import { TOK_BORDER_W } from './ReaderTokens';

/** Controlled native field. Draft and keyboard ownership remain with its
 * caller; AUTO omissions and credential masking belong to finite variants. */
class ReaderFormFieldModifier implements AttributeModifier<TextInputAttribute> {
  constructor(private id: ReaderFormFieldSpecId, private scheme: string) {}
  // Shared normal recipe; the two native modifier signatures are thin ArkUI
  // adapters, so input and multiline fields never acquire duplicate recipes.
  applyNormalAttribute(instance: TextInputAttribute | TextAreaAttribute): void {
    const spec = resolveReaderFormFieldSpec(this.id);
    const text = spec.text;
    instance.width('100%').height(spec.height);
    if (text !== undefined) {
      if (text.fontFamily !== undefined) instance.fontFamily(text.fontFamily);
      if (text.fontWeight !== undefined) instance.fontWeight(text.fontWeight);
      instance.fontSize(text.fontSizeFp);
      if (text.lineHeightFp !== undefined) instance.lineHeight(text.lineHeightFp);
      if (text.letterSpacingFp !== undefined) instance.letterSpacing(text.letterSpacingFp);
    }
    if (spec.textRole !== undefined) instance.fontColor(readerAppColor(spec.textRole, this.scheme));
    if (spec.surfaceRole !== undefined) instance.backgroundColor(readerAppColor(spec.surfaceRole, this.scheme));
    if (spec.hasBorder) instance.border({ width: TOK_BORDER_W, color: readerAppColor('TOK_BORDER', this.scheme) });
    if (spec.radius !== undefined) instance.borderRadius(spec.radius);
    if (spec.allPadding !== undefined) instance.padding(spec.allPadding);
    else if (spec.horizontalPadding !== undefined) instance.padding({ left: spec.horizontalPadding, right: spec.horizontalPadding });
    if (spec.placeholderRole !== undefined) instance.placeholderColor(readerAppColor(spec.placeholderRole, this.scheme));
  }
}
class ReaderFormAreaModifier implements AttributeModifier<TextAreaAttribute> {
  constructor(private id: ReaderFormFieldSpecId, private scheme: string) {}
  applyNormalAttribute(instance: TextAreaAttribute): void { new ReaderFormFieldModifier(this.id, this.scheme).applyNormalAttribute(instance); }
}
@Component
export struct ReaderFormField {
  @Prop scheme: string = 'day';
  @Prop specId: ReaderFormFieldSpecId = 'rules-input';
  @Prop text: string = '';
  @Prop placeholder: string = '';
  @Prop isEditable: boolean = true;
  @Prop password: boolean = false;
  onSubmit: () => void = (): void => {};
  onTextChange: (value: string) => void = (_value: string): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  build() {
    if (resolveReaderFormFieldSpec(this.specId).multiline) {
      TextArea({ text: this.text, placeholder: this.placeholder })
        .attributeModifier(new ReaderFormAreaModifier(this.specId, this.scheme))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value));
    } else if (resolveReaderFormFieldSpec(this.specId).numberInput) {
      TextInput({ text: this.text, placeholder: this.placeholder }).type(InputType.Number)
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value));
    } else if (this.password) {
      TextInput({ text: this.text, placeholder: this.placeholder }).type(InputType.Password)
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value));
    } else if (this.specId === 'form-url') {
      TextInput({ text: this.text, placeholder: this.placeholder })
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value))
        .onSubmit((_enterKey: EnterKeyType): void => this.submit());
    } else {
      TextInput({ text: this.text, placeholder: this.placeholder })
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme))
        .enabled(this.isEditable).onChange((value: string): void => this.change(value));
    }
  }
  private submit(): void { if (this.mounted && this.isEditable) this.onSubmit(); }
  private change(value: string): void { if (this.mounted && this.isEditable) this.onTextChange(value); }
}
