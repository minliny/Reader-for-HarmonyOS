import { ReaderButtonLayout, ReaderButtonMatrixPaint, ReaderButtonMatrixSize, ReaderButtonSize, ReaderButtonSpecId, ReaderButtonVariant,
  READER_DIALOG_FORM_ACTION_SIZE, resolveReaderButtonMatrixPaint, resolveReaderButtonMatrixSize, resolveReaderButtonSpec } from './ReaderControlSpecs';
import { readerSearchActionWidth, readerSearchControlHeight, readerSearchHistoryControlHeight } from '../foundation/ReaderSearchControlGeometry';
import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerPressAnimation, readerPressOpacity, readerPressPointer, readerPressScale } from '../foundation/ReaderPressMotion';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { TOK_BORDER_W, TOK_SPACE_XS } from '../foundation/ReaderTokens';
import { readerReadableFontScale, readerScaledControlHeight } from '../foundation/ReaderSurfaceResolvers';
import { TYPE_APP_COMPACT_PRIMARY_ACTION, TYPE_FORM_LABEL_ACTION } from '../foundation/ReaderTypography';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';

/** Shared action presentation. Admission and business work stay at the owner;
 * ArkUI owns pointer release/cancel and pressed state. A retained intent must
 * delegate to current parent state, or use a bounded parent identity key. */
class ReaderButtonLabelModifier implements AttributeModifier<TextAttribute> {
  private id: ReaderButtonSpecId;
  private primary: boolean;
  private scheme: string;
  private fontScale: number;
  constructor(id: ReaderButtonSpecId, primary: boolean, scheme: string, fontScale: number = 1) {
    this.id = id;
    this.primary = primary;
    this.scheme = scheme;
    this.fontScale = fontScale;
  }
  applyNormalAttribute(instance: TextAttribute): void {
    const spec = resolveReaderButtonSpec(this.id);
    const text = spec.text;
    if (text.fontFamily !== undefined) instance.fontFamily(text.fontFamily);
    const weight = this.primary ? (spec.selectedWeight ?? text.fontWeight) : text.fontWeight;
    if (weight !== undefined) instance.fontWeight(weight);
    instance.fontSize(text.fontSizeFp);
    if (this.id.startsWith('search-') || this.id.startsWith('source-management-') ||
      this.id === 'source-tools-action' || this.id === 'source-tools-compact') {
      instance.minFontScale(Math.min(1, this.fontScale));
      instance.maxFontScale(Math.max(1, this.fontScale));
    }
    if (text.lineHeightFp !== undefined) instance.lineHeight(text.lineHeightFp);
    // Split the line leading above/below CJK glyphs to center them beside the icon.
    if (spec.leadingSlot) instance.halfLeading(true);
    if (text.letterSpacingFp !== undefined) instance.letterSpacing(text.letterSpacingFp);
    instance.fontColor(readerAppColor(this.primary ? spec.primaryText : spec.secondaryText, this.scheme));
    if (spec.centerText) instance.textAlign(TextAlign.Center);
    if (spec.maxLines > 0) instance.maxLines(spec.maxLines);
    if (spec.textEllipsis) instance.textOverflow({ overflow: TextOverflow.Ellipsis });
  }
}
class ReaderButtonFrameModifier implements AttributeModifier<CommonAttribute> {
  private id: ReaderButtonSpecId;
  private primary: boolean;
  private enabled: boolean;
  private layout: ReaderButtonLayout;
  private scheme: string;
  private fontScale: number;
  private busy: boolean;
  private availableWidth: number;
  private selectionSemantic: boolean;
  constructor(id: ReaderButtonSpecId, primary: boolean, enabled: boolean, layout: ReaderButtonLayout, scheme: string, busy: boolean = false, availableWidth: number = 0, fontScale: number = 1, selectionSemantic: boolean = false) {
    this.id = id;
    this.primary = primary;
    this.enabled = enabled;
    this.layout = layout;
    this.scheme = scheme;
    this.fontScale = fontScale;
    this.busy = busy;
    this.availableWidth = availableWidth;
    this.selectionSemantic = selectionSemantic;
  }
  applyNormalAttribute(instance: CommonAttribute): void {
    const spec = resolveReaderButtonSpec(this.id);
    const lineHeight = spec.text.lineHeightFp ?? spec.text.fontSizeFp * 1.5;
    if (this.layout === 'equal') instance.layoutWeight(1);
    if (this.layout === 'full') instance.width('100%');
    if (spec.height !== undefined) instance.height(readerScaledControlHeight(spec.height, lineHeight, this.fontScale));
    if (this.id === 'search-field-wide') {
      instance.width(readerSearchActionWidth(this.id === 'search-field-wide', this.fontScale));
      instance.height(readerSearchControlHeight(this.fontScale));
    }
    if (this.id === 'search-history-keyword') instance.height(readerSearchHistoryControlHeight(this.fontScale));
    if (spec.fixedWidth > 0) {
      const width = spec.scaleWidth ? spec.fixedWidth * this.fontScale : spec.fixedWidth;
      instance.width(spec.responsiveStatusWidth ? width * Math.min(1, Math.max(0, this.availableWidth - TOK_SPACE_XS * 4) / 318) : width);
    }
    if (spec.minWidth !== undefined || spec.minHeight !== undefined) instance.constraintSize({
      minWidth: spec.minWidth, minHeight: spec.minHeight === undefined ? undefined :
        readerScaledControlHeight(spec.minHeight, lineHeight, this.fontScale) });
    if (spec.maxWidthKind === 'scope') instance.constraintSize({ maxWidth: 160 });
    else if (spec.maxWidthKind === 'history') instance.constraintSize({ maxWidth: this.availableWidth > 0 ? Math.max(0, this.availableWidth - TOK_SPACE_XS) : '100%' });
    if (spec.outerMargin !== undefined) instance.margin(spec.outerMargin);
    if (spec.allPadding !== undefined) instance.padding(spec.allPadding);
    else if (spec.verticalOnlyPadding) instance.padding({ top: spec.verticalPadding, bottom: spec.verticalPadding });
    else if (spec.verticalPadding > 0) instance.padding({ left: spec.horizontalPadding, right: spec.horizontalPadding, top: spec.verticalPadding, bottom: spec.verticalPadding });
    else if (spec.horizontalPadding > 0) instance.padding({ left: spec.horizontalPadding, right: spec.horizontalPadding });
    if (spec.hasBorder && (!this.primary || spec.primaryHasBorder)) instance.border({ width: TOK_BORDER_W, color: readerAppColor(this.primary ? spec.primaryBorder : spec.secondaryBorder, this.scheme) });
    const disabledOpacity = this.primary ? (spec.primaryDisabledOpacity ?? spec.disabledOpacity) : spec.disabledOpacity;
    if (disabledOpacity < 1) instance.opacity(this.enabled ? 1 : disabledOpacity);
    if (spec.busyOpacity < 1) instance.opacity(this.busy ? spec.busyOpacity : 1);
    if (spec.responseOffset !== undefined) instance.responseRegion({ x: 0, y: spec.responseOffset,
      width: '100%', height: readerScaledControlHeight(spec.responseHeight, lineHeight, this.fontScale) });
    if (spec.hasSurface) this.feedback().applyNormalAttribute(instance);
    else if (spec.outerRadius) instance.borderRadius(spec.radius);
    if (this.selectionSemantic) instance.accessibilityRole(AccessibilityRoleType.RADIO).accessibilitySelected(this.primary);
  }
  applyPressedAttribute(instance: CommonAttribute): void { this.applyNormalAttribute(instance); if (resolveReaderButtonSpec(this.id).hasSurface) this.feedback().applyPressedAttribute(instance); }
  applyDisabledAttribute(instance: CommonAttribute): void { this.applyNormalAttribute(instance); if (resolveReaderButtonSpec(this.id).hasSurface) this.feedback().applyDisabledAttribute(instance); }
  private feedback(): ReaderPressFeedback {
    const spec = resolveReaderButtonSpec(this.id);
    return new ReaderPressFeedback(readerAppColor(this.primary ? spec.primarySurface : spec.secondarySurface, this.scheme),
      this.scheme, spec.radius, spec.radius, this.enabled);
  }
}
// Compact capsules keep their painted frame inside the separate 44vp target.
// Their Text receives one combined modifier; ordinary actions put their frame
// on the native Button and keep only the label recipe on the child Text.
class ReaderButtonTextModifier implements AttributeModifier<TextAttribute> {
  private id: ReaderButtonSpecId;
  private primary: boolean;
  private enabled: boolean;
  private layout: ReaderButtonLayout;
  private scheme: string;
  private fontScale: number;
  private busy: boolean;
  private availableWidth: number;
  private pressed: boolean;
  constructor(id: ReaderButtonSpecId, primary: boolean, enabled: boolean, layout: ReaderButtonLayout, scheme: string,
    busy: boolean = false, availableWidth: number = 0, fontScale: number = 1, pressed: boolean = false) {
    this.id = id;
    this.primary = primary;
    this.enabled = enabled;
    this.layout = layout;
    this.scheme = scheme;
    this.fontScale = fontScale;
    this.busy = busy;
    this.availableWidth = availableWidth;
    this.pressed = pressed;
  }
  applyNormalAttribute(instance: TextAttribute): void {
    new ReaderButtonLabelModifier(this.id, this.primary, this.scheme, this.fontScale).applyNormalAttribute(instance);
    const frame = new ReaderButtonFrameModifier(this.id, this.primary, this.enabled, this.layout, this.scheme, this.busy,
      this.availableWidth, this.fontScale);
    if (this.enabled && this.pressed) frame.applyPressedAttribute(instance);
    else frame.applyNormalAttribute(instance);
  }
  applyPressedAttribute(instance: TextAttribute): void {
    new ReaderButtonLabelModifier(this.id, this.primary, this.scheme, this.fontScale).applyNormalAttribute(instance);
    new ReaderButtonFrameModifier(this.id, this.primary, this.enabled, this.layout, this.scheme, this.busy, this.availableWidth, this.fontScale).applyPressedAttribute(instance);
  }
  applyDisabledAttribute(instance: TextAttribute): void { this.applyNormalAttribute(instance); }
}
/** Native Button keeps its default semantics until a caller declares a choice. */
class ReaderButtonSelectionModifier implements AttributeModifier<CommonAttribute> {
  private choice: boolean;
  private selected: boolean;
  constructor(choice: boolean, selected: boolean) {
    this.choice = choice;
    this.selected = selected;
  }
  applyNormalAttribute(instance: CommonAttribute): void {
    if (this.choice) instance.accessibilityRole(AccessibilityRoleType.RADIO).accessibilitySelected(this.selected);
  }
}
@Component
export struct ReaderButton {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageProp('readerReduceMotion') private reduceMotion: boolean = false;
  @Prop scheme: string = 'day';
  @Prop specId: ReaderButtonSpecId = 'source-action';
  @Prop label: string = '';
  @Prop variant: ReaderButtonVariant | undefined = undefined;
  @Prop visualSize: ReaderButtonSize = 'medium';
  @Prop primary: boolean = false;
  @Prop @Watch('resetPress') actionEnabled: boolean = true;
  @Prop layout: ReaderButtonLayout = 'intrinsic';
  @Prop isBusy: boolean = false;
  // Available width remains an input for the variants that author a width cap.
  // Source management reserves its scaled status widths in the parent layout.
  @Prop availableWidth: number = 0;
  @Prop actionAccessibilityLabel: string = '';
  @Prop selectionSemantic: boolean = false;
  @Prop focusId: string = '';
  @State private pressPointer: number = -1;
  textLayoutOptions: TextOptions | undefined = undefined;
  @BuilderParam leading: () => void = this.emptyLeading;
  onAction: () => void = (): void => {};
  onFocused: () => void = (): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; this.resetPress(); }
  @Builder
  private emptyLeading() {}
  build() {
    if (this.variant !== undefined || this.specId === 'form-action') {
      this.matrixButton();
    } else if (this.specId === 'search-filter-option' || this.specId === 'source-management-category' ||
      this.specId === 'source-management-login') {
      // The capsule keeps its compact visual size inside a separate native
      // target. Its 44vp slot belongs to layout instead of an outer response
      // region, so adjacent filter targets never overlap.
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(this.label, this.textLayoutOptions)
          .scale(readerPressScale(this.pressPointer >= 0, this.reduceMotion))
          .opacity(readerPressOpacity(this.pressPointer >= 0, this.reduceMotion))
          .animation(readerPressAnimation(this.reduceMotion))
          .attributeModifier(new ReaderButtonTextModifier(this.specId, this.primary, this.actionEnabled,
            'intrinsic', this.scheme, this.isBusy, this.availableWidth, this.fontScale(), this.pressPointer >= 0))
          .accessibilityLevel('no')
          .hitTestBehavior(HitTestMode.None);
      }.padding(0).backgroundColor(Color.Transparent).borderRadius(0).opacity(1)
        .constraintSize({ minWidth: 44, minHeight: 44 })
        .enabled(this.actionEnabled)
        .id(this.focusId)
        .onFocus((): void => { if (this.mounted) this.onFocused(); })
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .attributeModifier(new ReaderButtonSelectionModifier(this.selectionSemantic, this.primary))
        .accessibilityText(this.actionAccessibilityLabel.length > 0 ? this.actionAccessibilityLabel : this.label)
        .onTouch((event: TouchEvent): void => this.observePress(event))
        .onClick((): void => this.commit());
    } else if (resolveReaderButtonSpec(this.specId).stacked) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Stack({ alignContent: resolveReaderButtonSpec(this.specId).leadingSlot ? Alignment.End : Alignment.Center }) {
          if (resolveReaderButtonSpec(this.specId).leadingSlot) {
            Row({ space: 5 }) { this.leading(); Text(this.label, this.textLayoutOptions).attributeModifier(new ReaderButtonLabelModifier(this.specId, this.primary, this.scheme, this.fontScale())); }
              .width('100%').justifyContent(FlexAlign.Center).alignItems(VerticalAlign.Center)
              .translate({ y: this.specId === 'source-management-detect' ? 8 : 0 });
          } else {
            Text(this.label, this.textLayoutOptions).attributeModifier(new ReaderButtonLabelModifier(this.specId, this.primary, this.scheme, this.fontScale()));
          }
        }.scale(readerPressScale(this.pressPointer >= 0, this.reduceMotion))
          .opacity(readerPressOpacity(this.pressPointer >= 0, this.reduceMotion))
          .animation(readerPressAnimation(this.reduceMotion))
          .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
      }.padding(0).backgroundColor(Color.Transparent).borderRadius(0).opacity(1)
        .type(resolveReaderButtonSpec(this.specId).radius === 999 ? ButtonType.Capsule : ButtonType.Normal)
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .attributeModifier(new ReaderButtonFrameModifier(this.specId, this.primary, this.actionEnabled, this.layout, this.scheme, this.isBusy, this.availableWidth, this.fontScale(), this.selectionSemantic))
        .enabled(this.actionEnabled)
        .id(this.focusId)
        .onFocus((): void => { if (this.mounted) this.onFocused(); })
        .onTouch((event: TouchEvent): void => this.observePress(event))
        .accessibilityText(this.actionAccessibilityLabel.length > 0 ? this.actionAccessibilityLabel : this.label).onClick((): void => this.commit());
    } else {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Text(this.label, this.textLayoutOptions)
          .scale(readerPressScale(this.pressPointer >= 0, this.reduceMotion))
          .opacity(readerPressOpacity(this.pressPointer >= 0, this.reduceMotion))
          .animation(readerPressAnimation(this.reduceMotion))
          .attributeModifier(new ReaderButtonLabelModifier(this.specId, this.primary, this.scheme, this.fontScale()))
          .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
      }.padding(0).backgroundColor(Color.Transparent).borderRadius(0).opacity(1)
        .type(resolveReaderButtonSpec(this.specId).radius === 999 ? ButtonType.Capsule : ButtonType.Normal)
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .attributeModifier(new ReaderButtonFrameModifier(this.specId, this.primary, this.actionEnabled, this.layout, this.scheme, this.isBusy, this.availableWidth, this.fontScale(), this.selectionSemantic))
        .enabled(this.actionEnabled)
        .id(this.focusId)
        .onFocus((): void => { if (this.mounted) this.onFocused(); })
        .onTouch((event: TouchEvent): void => this.observePress(event))
        .accessibilityText(this.actionAccessibilityLabel.length > 0 ? this.actionAccessibilityLabel : this.label).onClick((): void => this.commit());
    }
  }
  @Builder
  private matrixButton() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Row({ space: 5 }) {
        this.leading();
        Text(this.label, this.textLayoutOptions)
          .fontFamily(this.variant === undefined ? TYPE_FORM_LABEL_ACTION.fontFamily : TYPE_APP_COMPACT_PRIMARY_ACTION.fontFamily)
          .fontSize(this.matrixSize().fontSize)
          .lineHeight(`${this.matrixSize().lineHeight}fp`)
          .fontWeight(this.matrixVariant() === 'subtle' || !this.actionEnabled ? 500 : 600)
          .fontColor(readerAppColor(this.matrixPaint().ink, this.scheme))
          .fontFeature('"tnum" 1')
          .textAlign(TextAlign.Center);
      }.width(this.layout === 'intrinsic' ? undefined : '100%')
        .constraintSize({ minHeight: readerScaledControlHeight(this.matrixSize().height,
          this.matrixSize().lineHeight, this.fontScale()) })
        .padding({ left: this.matrixSize().horizontalPadding,
          right: this.matrixSize().horizontalPadding })
        .alignItems(VerticalAlign.Center).justifyContent(FlexAlign.Center)
        .scale(readerPressScale(this.pressPointer >= 0, this.reduceMotion))
        .opacity(readerPressOpacity(this.pressPointer >= 0, this.reduceMotion, this.actionEnabled ? 1 : 0.45))
        .animation(readerPressAnimation(this.reduceMotion))
        .attributeModifier(new ReaderPressFeedback(
          readerAppColor(this.matrixPaint().surface, this.scheme),
          this.scheme, 999, 999, this.actionEnabled, this.pressPointer >= 0))
        .accessibilityLevel('no-hide-descendants').hitTestBehavior(HitTestMode.None);
    }.padding(0).backgroundColor(Color.Transparent).borderRadius(0)
      .layoutWeight(this.layout === 'equal' ? 1 : undefined)
      .width(this.layout === 'full' ? '100%' : undefined)
      .constraintSize({ minWidth: 44, minHeight: 44 })
      .enabled(this.actionEnabled)
      .id(this.focusId)
      .onFocus((): void => { if (this.mounted) this.onFocused(); })
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .attributeModifier(new ReaderButtonSelectionModifier(this.selectionSemantic, this.primary))
      .accessibilityText(this.actionAccessibilityLabel.length > 0 ? this.actionAccessibilityLabel : this.label)
      .onTouch((event: TouchEvent): void => this.observePress(event))
      .onClick((): void => this.commit());
  }

  private matrixVariant(): ReaderButtonVariant { return this.variant ?? (this.primary ? 'primary' : 'subtle'); }
  private matrixSize(): ReaderButtonMatrixSize {
    return this.variant === undefined ? READER_DIALOG_FORM_ACTION_SIZE : resolveReaderButtonMatrixSize(this.visualSize);
  }
  private matrixPaint(): ReaderButtonMatrixPaint { return resolveReaderButtonMatrixPaint(this.matrixVariant(), this.actionEnabled); }

  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }
  private observePress(event: TouchEvent): void {
    this.pressPointer = readerPressPointer(event, this.pressPointer, this.mounted && this.actionEnabled);
  }
  private resetPress(): void { this.pressPointer = -1; }
  private commit(): void { if (this.mounted && this.actionEnabled) this.onAction(); }
}
