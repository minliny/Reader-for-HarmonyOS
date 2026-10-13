import { ReaderButtonLayout, ReaderButtonSpecId, resolveReaderButtonSpec } from './ReaderControlSpecs';
import { ReaderPressFeedback } from './ReaderPressFeedback';
import { readerAppColor } from './ReaderThemeRegistry';
import { TOK_BORDER_W, TOK_SPACE_XS } from './ReaderTokens';

/** Shared action presentation. Admission and business work stay at the owner;
 * ArkUI owns pointer release/cancel and pressed state. A retained intent must
 * delegate to current parent state, or use a bounded parent identity key. */
class ReaderButtonLabelModifier implements AttributeModifier<TextAttribute> {
  private id: ReaderButtonSpecId;
  private primary: boolean;
  private scheme: string;
  constructor(id: ReaderButtonSpecId, primary: boolean, scheme: string) {
    this.id = id;
    this.primary = primary;
    this.scheme = scheme;
  }
  applyNormalAttribute(instance: TextAttribute): void {
    const spec = resolveReaderButtonSpec(this.id);
    const text = spec.text;
    if (text.fontFamily !== undefined) instance.fontFamily(text.fontFamily);
    const weight = this.primary ? (spec.selectedWeight ?? text.fontWeight) : text.fontWeight;
    if (weight !== undefined) instance.fontWeight(weight);
    instance.fontSize(text.fontSizeFp);
    if (text.lineHeightFp !== undefined) instance.lineHeight(text.lineHeightFp);
    // Only search-field variants have a leading slot. Split the line leading
    // above/below CJK glyphs so the label centers with the native indicator.
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
  private busy: boolean;
  private availableWidth: number;
  constructor(id: ReaderButtonSpecId, primary: boolean, enabled: boolean, layout: ReaderButtonLayout, scheme: string, busy: boolean = false, availableWidth: number = 0) {
    this.id = id;
    this.primary = primary;
    this.enabled = enabled;
    this.layout = layout;
    this.scheme = scheme;
    this.busy = busy;
    this.availableWidth = availableWidth;
  }
  applyNormalAttribute(instance: CommonAttribute): void {
    const spec = resolveReaderButtonSpec(this.id);
    if (this.layout === 'equal') instance.layoutWeight(1);
    if (this.layout === 'full') instance.width('100%');
    if (spec.height !== undefined) instance.height(spec.height);
    if (spec.fixedWidth > 0) instance.width(spec.responsiveStatusWidth ? spec.fixedWidth * Math.min(1, Math.max(0, this.availableWidth - TOK_SPACE_XS * 4) / 318) : spec.fixedWidth);
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
    if (spec.responseOffset !== undefined) instance.responseRegion({ x: 0, y: spec.responseOffset, width: '100%', height: spec.responseHeight });
    if (spec.hasSurface) this.feedback().applyNormalAttribute(instance);
    else if (spec.outerRadius) instance.borderRadius(spec.radius);
  }
  applyPressedAttribute(instance: CommonAttribute): void { this.applyNormalAttribute(instance); if (resolveReaderButtonSpec(this.id).hasSurface) this.feedback().applyPressedAttribute(instance); }
  applyDisabledAttribute(instance: CommonAttribute): void { this.applyNormalAttribute(instance); if (resolveReaderButtonSpec(this.id).hasSurface) this.feedback().applyDisabledAttribute(instance); }
  private feedback(): ReaderPressFeedback {
    const spec = resolveReaderButtonSpec(this.id);
    return new ReaderPressFeedback(readerAppColor(this.primary ? spec.primarySurface : spec.secondarySurface, this.scheme),
      this.scheme, spec.radius, spec.radius, this.enabled);
  }
}
// Text receives one modifier registration. Repeated attributeModifier calls
// must not rely on platform ordering to keep the earlier label recipe alive.
class ReaderButtonTextModifier implements AttributeModifier<TextAttribute> {
  private id: ReaderButtonSpecId;
  private primary: boolean;
  private enabled: boolean;
  private layout: ReaderButtonLayout;
  private scheme: string;
  private busy: boolean;
  private availableWidth: number;
  constructor(id: ReaderButtonSpecId, primary: boolean, enabled: boolean, layout: ReaderButtonLayout, scheme: string, busy: boolean = false, availableWidth: number = 0) {
    this.id = id;
    this.primary = primary;
    this.enabled = enabled;
    this.layout = layout;
    this.scheme = scheme;
    this.busy = busy;
    this.availableWidth = availableWidth;
  }
  applyNormalAttribute(instance: TextAttribute): void {
    new ReaderButtonLabelModifier(this.id, this.primary, this.scheme).applyNormalAttribute(instance);
    new ReaderButtonFrameModifier(this.id, this.primary, this.enabled, this.layout, this.scheme, this.busy, this.availableWidth).applyNormalAttribute(instance);
  }
  applyPressedAttribute(instance: TextAttribute): void {
    new ReaderButtonLabelModifier(this.id, this.primary, this.scheme).applyNormalAttribute(instance);
    new ReaderButtonFrameModifier(this.id, this.primary, this.enabled, this.layout, this.scheme, this.busy, this.availableWidth).applyPressedAttribute(instance);
  }
  applyDisabledAttribute(instance: TextAttribute): void { this.applyNormalAttribute(instance); }
}
@Component
export struct ReaderButton {
  @Prop scheme: string = 'day';
  @Prop specId: ReaderButtonSpecId = 'source-action';
  @Prop label: string = '';
  @Prop primary: boolean = false;
  @Prop actionEnabled: boolean = true;
  @Prop layout: ReaderButtonLayout = 'intrinsic';
  @Prop isBusy: boolean = false;
  // Measured layout authority only; finite Source status variants own the
  // admitted 58/72 design widths and existing 318vp shrink formula.
  @Prop availableWidth: number = 0;
  @Prop actionAccessibilityLabel: string = '';
  @BuilderParam leading: () => void = this.emptyLeading;
  onAction: () => void = (): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  @Builder
  private emptyLeading() {}
  build() {
    if (resolveReaderButtonSpec(this.specId).stacked) {
      Stack({ alignContent: Alignment.Center }) {
        if (resolveReaderButtonSpec(this.specId).leadingSlot && this.isBusy) {
          Row({ space: 6 }) { this.leading(); Text(this.label).attributeModifier(new ReaderButtonLabelModifier(this.specId, this.primary, this.scheme)); }
            .alignItems(VerticalAlign.Center);
        } else {
          Text(this.label).attributeModifier(new ReaderButtonLabelModifier(this.specId, this.primary, this.scheme));
        }
      }.attributeModifier(new ReaderButtonFrameModifier(this.specId, this.primary, this.actionEnabled, this.layout, this.scheme, this.isBusy, this.availableWidth))
        .enabled(this.actionEnabled).focusable(this.actionEnabled)
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .accessibilityText(this.actionAccessibilityLabel.length > 0 ? this.actionAccessibilityLabel : this.label).onClick((): void => this.commit());
    } else {
      Text(this.label).attributeModifier(new ReaderButtonTextModifier(this.specId, this.primary, this.actionEnabled, this.layout, this.scheme, this.isBusy, this.availableWidth))
        .enabled(this.actionEnabled).focusable(this.actionEnabled)
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .accessibilityText(this.actionAccessibilityLabel.length > 0 ? this.actionAccessibilityLabel : this.label).onClick((): void => this.commit());
    }
  }
  private commit(): void { if (this.mounted && this.actionEnabled) this.onAction(); }
}
