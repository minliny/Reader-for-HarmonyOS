import { ReaderFormFieldSpecId, resolveReaderFormFieldSpec } from './ReaderControlSpecs';
import { readerReadableFontScale, readerScaledControlHeight } from '../foundation/ReaderSurfaceResolvers';
import { readerAppColor } from '../foundation/ReaderAppColors';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { ReaderEditingVisibility } from '../layout/ReaderEditingVisibility';
import { ReaderEditableTarget, ReaderEditableInputModifier, ReaderEditableAreaModifier } from '../layout/ReaderEditableTarget';
import { ReaderRectVp } from '../foundation/ReaderWindowMetrics';

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
    if (spec.placeholderStyle !== undefined) instance.placeholderFont({ size: spec.placeholderStyle.fontSizeFp,
      family: spec.placeholderStyle.fontFamily, weight: spec.placeholderStyle.fontWeight });
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
class ReaderContentSearchNaturalFrame implements AttributeModifier<TextInputAttribute> {
  private heightVp: number;
  constructor(heightVp: number) { this.heightVp = heightVp; }
  applyNormalAttribute(instance: TextInputAttribute): void {
    if (Number.isFinite(this.heightVp) && this.heightVp > 0) instance.height(this.heightVp);
  }
}
@Component
export struct ReaderFormField {
  @StorageLink('readerWindowMetricsRevision') @Watch('editingGeometryChanged') private readerWindowMetricsRevision: number = 0;
  @Prop scheme: string = 'day';
  @Prop specId: ReaderFormFieldSpecId = 'rules-input';
  @Prop text: string = '';
  @Prop placeholder: string = '';
  @Prop isEditable: boolean = true;
  @Prop password: boolean = false;
  @Prop @Watch('bindEditingTarget') inputIdentity: string = '';
  @Prop fieldAccessibilityLabel: string = '';
  @Prop naturalInputHeightVp: number = 0;
  inputController: TextInputController | undefined = undefined;
  editingHost: ReaderEditingVisibility | undefined = undefined;
  editingContext: ((field: ReaderRectVp) => ReaderRectVp | undefined) | undefined = undefined;
  private readonly nativeInputController: TextInputController = new TextInputController();
  private readonly nativeAreaController: TextAreaController = new TextAreaController();
  private readonly editingTarget: ReaderEditableTarget = new ReaderEditableTarget();
  onEditingChange: (editing: boolean) => void = (_editing: boolean): void => {};
  onSubmit: () => void = (): void => {};
  onTextChange: (value: string) => void = (_value: string): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; this.bindEditingTarget(); }
  aboutToDisappear(): void { this.mounted = false; this.editingTarget.unmount(); }
  private nativeInputId(): string {
    // Only content search has an existing external native-focus API. Other
    // draft identities were never native IDs and may repeat in retained pages.
    return this.specId === 'reader-content-search' && this.inputIdentity.length > 0 ? this.inputIdentity :
      this.inputIdentity.length > 0 ? `${this.editingTarget.id}:${this.inputIdentity}` : this.editingTarget.id;
  }
  private bindEditingTarget(): void {
    if (!this.mounted) return;
    const spec = resolveReaderFormFieldSpec(this.specId);
    const id = this.nativeInputId();
    this.editingTarget.mount(this.getUIContext(), this.editingHost,
      spec.multiline ? this.nativeAreaController : this.inputController ?? this.nativeInputController,
      (): boolean => this.mounted && this.isEditable && id === this.nativeInputId(),
      (): number => (spec.text?.lineHeightFp ?? (spec.text?.fontSizeFp ?? 16) * 1.5) * this.fontScale(), id,
      this.editingContext === undefined ? undefined : (field: ReaderRectVp): ReaderRectVp | undefined => this.editingContext?.(field));
  }
  private editingGeometryChanged(): void { this.editingTarget.changed(); }
  private textChangeHandler(): (value: string) => void {
    const id = this.nativeInputId();
    return (value: string): void => { if (this.editingTarget.nativeCurrent(id)) this.change(value); };
  }
  private submitHandler(): () => void {
    const id = this.nativeInputId();
    return (): void => { if (this.editingTarget.nativeCurrent(id)) this.submit(); };
  }
  build() {
    if (resolveReaderFormFieldSpec(this.specId).multiline) {
      TextArea({ text: this.text, placeholder: this.placeholder, controller: this.nativeAreaController })
        .attributeModifier(new ReaderEditableAreaModifier(this.editingTarget, this.nativeInputId(), (editing: boolean): void => this.editChanged(editing)))
        .attributeModifier(new ReaderFormAreaModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange(this.textChangeHandler());
    } else if (this.specId === 'reader-content-search') {
      TextInput({ text: this.text, placeholder: this.placeholder, controller: this.inputController ?? this.nativeInputController })
        .attributeModifier(new ReaderEditableInputModifier(this.editingTarget, this.nativeInputId(), (editing: boolean): void => this.editChanged(editing)))
        .enableKeyboardOnFocus(true).maxLines(1).enterKeyType(EnterKeyType.Search).halfLeading(true)
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .attributeModifier(new ReaderContentSearchNaturalFrame(this.naturalInputHeightVp))
        .enabled(this.isEditable).onChange(this.textChangeHandler())
        .onSubmit(this.submitHandler());
    } else if (this.specId === 'directory-rule-level') {
      TextInput({ text: this.text, controller: this.inputController ?? this.nativeInputController })
        .attributeModifier(new ReaderEditableInputModifier(this.editingTarget, this.nativeInputId(), (editing: boolean): void => this.editChanged(editing))).attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange(this.textChangeHandler());
    } else if (resolveReaderFormFieldSpec(this.specId).numberInput) {
      TextInput({ text: this.text, placeholder: this.placeholder, controller: this.inputController ?? this.nativeInputController })
        .attributeModifier(new ReaderEditableInputModifier(this.editingTarget, this.nativeInputId(), (editing: boolean): void => this.editChanged(editing))).type(InputType.Number)
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange(this.textChangeHandler());
    } else if (this.password) {
      TextInput({ text: this.text, placeholder: this.placeholder, controller: this.inputController ?? this.nativeInputController })
        .attributeModifier(new ReaderEditableInputModifier(this.editingTarget, this.nativeInputId(), (editing: boolean): void => this.editChanged(editing))).type(InputType.Password)
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange(this.textChangeHandler());
    } else if (this.specId === 'form-url') {
      TextInput({ text: this.text, placeholder: this.placeholder, controller: this.inputController ?? this.nativeInputController })
        .attributeModifier(new ReaderEditableInputModifier(this.editingTarget, this.nativeInputId(), (editing: boolean): void => this.editChanged(editing)))
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange(this.textChangeHandler())
        .onSubmit(this.submitHandler());
    } else {
      TextInput({ text: this.text, placeholder: this.placeholder, controller: this.inputController ?? this.nativeInputController })
        .attributeModifier(new ReaderEditableInputModifier(this.editingTarget, this.nativeInputId(), (editing: boolean): void => this.editChanged(editing)))
        .attributeModifier(new ReaderFormFieldModifier(this.specId, this.scheme, this.fieldAccessibilityLabel, this.fontScale()))
        .enabled(this.isEditable).onChange(this.textChangeHandler());
    }
  }
  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }
  private editChanged(editing: boolean): void {
    this.editingTarget.edit(editing);
    if (this.mounted && this.isEditable) this.onEditingChange(editing);
  }
  private submit(): void { if (this.mounted && this.isEditable) this.onSubmit(); }
  private change(value: string): void { if (this.mounted && this.isEditable) this.onTextChange(value); }
}
