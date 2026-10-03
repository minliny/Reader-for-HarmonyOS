import { ReaderButtonLayout, ReaderButtonSpecId, resolveReaderButtonSpec } from './ReaderControlSpecs';
import { ReaderPressFeedback } from './ReaderPressFeedback';
import { readerAppColor } from './ReaderThemeRegistry';
import { TOK_BORDER_W } from './ReaderTokens';

/** Shared action presentation. Admission and business work stay at the owner;
 * ArkUI owns pointer release/cancel and pressed state. A retained intent must
 * delegate to current parent state, or use a bounded parent identity key. */
class ReaderButtonLabelModifier implements AttributeModifier<TextAttribute> {
  constructor(private id: ReaderButtonSpecId, private primary: boolean, private scheme: string) {}
  applyNormalAttribute(instance: TextAttribute): void {
    const spec = resolveReaderButtonSpec(this.id);
    const text = spec.text;
    if (text.fontFamily !== undefined) instance.fontFamily(text.fontFamily);
    if (text.fontWeight !== undefined) instance.fontWeight(text.fontWeight);
    instance.fontSize(text.fontSizeFp);
    if (text.lineHeightFp !== undefined) instance.lineHeight(text.lineHeightFp);
    if (text.letterSpacingFp !== undefined) instance.letterSpacing(text.letterSpacingFp);
    instance.fontColor(readerAppColor(this.primary ? spec.primaryText : spec.secondaryText, this.scheme));
    if (spec.centerText) instance.textAlign(TextAlign.Center);
    if (spec.maxLines > 0) instance.maxLines(spec.maxLines);
  }
}
class ReaderButtonFrameModifier implements AttributeModifier<CommonAttribute> {
  constructor(private id: ReaderButtonSpecId, private primary: boolean, private enabled: boolean,
    private layout: ReaderButtonLayout, private scheme: string, private busy: boolean = false) {}
  applyNormalAttribute(instance: CommonAttribute): void {
    const spec = resolveReaderButtonSpec(this.id);
    if (this.layout === 'equal') instance.layoutWeight(1);
    if (this.layout === 'full') instance.width('100%');
    if (spec.height !== undefined) instance.height(spec.height);
    if (spec.fixedWidth > 0) instance.width(spec.fixedWidth);
    if (spec.outerMargin !== undefined) instance.margin(spec.outerMargin);
    if (spec.allPadding !== undefined) instance.padding(spec.allPadding);
    else if (spec.verticalPadding > 0) instance.padding({ left: spec.horizontalPadding, right: spec.horizontalPadding, top: spec.verticalPadding, bottom: spec.verticalPadding });
    else if (spec.horizontalPadding > 0) instance.padding({ left: spec.horizontalPadding, right: spec.horizontalPadding });
    if (spec.hasBorder && (!this.primary || spec.primaryHasBorder)) instance.border({ width: TOK_BORDER_W, color: readerAppColor(this.primary ? spec.primaryBorder : spec.secondaryBorder, this.scheme) });
    const disabledOpacity = this.primary ? (spec.primaryDisabledOpacity ?? spec.disabledOpacity) : spec.disabledOpacity;
    if (disabledOpacity < 1) instance.opacity(this.enabled ? 1 : disabledOpacity);
    if (spec.busyOpacity < 1) instance.opacity(this.busy ? spec.busyOpacity : 1);
    if (spec.responseOffset !== undefined) instance.responseRegion({ x: 0, y: spec.responseOffset, width: '100%', height: 44 });
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
  constructor(private id: ReaderButtonSpecId, private primary: boolean, private enabled: boolean,
    private layout: ReaderButtonLayout, private scheme: string, private busy: boolean = false) {}
  applyNormalAttribute(instance: TextAttribute): void {
    new ReaderButtonLabelModifier(this.id, this.primary, this.scheme).applyNormalAttribute(instance);
    new ReaderButtonFrameModifier(this.id, this.primary, this.enabled, this.layout, this.scheme, this.busy).applyNormalAttribute(instance);
  }
  applyPressedAttribute(instance: TextAttribute): void {
    new ReaderButtonLabelModifier(this.id, this.primary, this.scheme).applyNormalAttribute(instance);
    new ReaderButtonFrameModifier(this.id, this.primary, this.enabled, this.layout, this.scheme, this.busy).applyPressedAttribute(instance);
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
  onAction: () => void = (): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  build() {
    if (resolveReaderButtonSpec(this.specId).stacked) {
      Stack({ alignContent: Alignment.Center }) {
        Text(this.label).attributeModifier(new ReaderButtonLabelModifier(this.specId, this.primary, this.scheme));
      }.attributeModifier(new ReaderButtonFrameModifier(this.specId, this.primary, this.actionEnabled, this.layout, this.scheme, this.isBusy))
        .enabled(this.actionEnabled).accessibilityText(this.label).onClick((): void => this.commit());
    } else {
      Text(this.label).attributeModifier(new ReaderButtonTextModifier(this.specId, this.primary, this.actionEnabled, this.layout, this.scheme, this.isBusy))
        .enabled(this.actionEnabled).accessibilityText(this.label).onClick((): void => this.commit());
    }
  }
  private commit(): void { if (this.mounted && this.actionEnabled) this.onAction(); }
}
