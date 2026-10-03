import { ReaderLabeledIconActionSpecId, resolveReaderLabeledIconActionSpec } from './ReaderLabeledIconActionSpecs';
import { ReaderPressFeedback } from './ReaderPressFeedback';
import { readerAppColor } from './ReaderThemeRegistry';
import { TOK_BORDER_W } from './ReaderTokens';

class ReaderLabeledIconLabelModifier implements AttributeModifier<TextAttribute> {
  constructor(private id: ReaderLabeledIconActionSpecId, private danger: boolean, private scheme: string) {}
  applyNormalAttribute(instance: TextAttribute): void {
    const spec = resolveReaderLabeledIconActionSpec(this.id), text = spec.text;
    if (text.fontFamily !== undefined) instance.fontFamily(text.fontFamily);
    if (text.fontWeight !== undefined) instance.fontWeight(text.fontWeight);
    instance.fontSize(text.fontSizeFp);
    if (text.lineHeightFp !== undefined) instance.lineHeight(text.lineHeightFp);
    if (text.letterSpacingFp !== undefined) instance.letterSpacing(text.letterSpacingFp);
    instance.fontColor(readerAppColor(this.danger && spec.dangerRole !== undefined ? spec.dangerRole : spec.textRole, this.scheme)).maxLines(1);
  }
}
class ReaderLabeledIconRowModifier implements AttributeModifier<RowAttribute> {
  constructor(private id: ReaderLabeledIconActionSpecId, private divider: boolean, private scheme: string, private enabled: boolean) {}
  applyNormalAttribute(instance: RowAttribute): void {
    const spec = resolveReaderLabeledIconActionSpec(this.id);
    instance.height(spec.rowHeight).alignItems(VerticalAlign.Center);
    if (spec.rowWidth !== undefined) instance.width(spec.rowWidth);
    if (spec.horizontalPadding !== undefined) instance.padding({ left: spec.horizontalPadding, right: spec.horizontalPadding });
    if (spec.centerRow) instance.justifyContent(FlexAlign.Center);
    if (spec.borderRole !== undefined) {
      if (spec.divided) instance.border({ width: { left: this.divider ? TOK_BORDER_W : 0 }, color: readerAppColor(spec.borderRole, this.scheme) });
      else instance.border({ width: TOK_BORDER_W, color: readerAppColor(spec.borderRole, this.scheme) });
    }
    if (spec.surfaceRole !== undefined) this.feedback().applyNormalAttribute(instance);
    else if (spec.radius !== undefined) instance.borderRadius(spec.radius);
    if (!spec.outerHit) {
      if (spec.equalLayout) instance.layoutWeight(1);
      if (spec.responseOffset !== undefined) instance.responseRegion({ x: 0, y: spec.responseOffset, width: '100%', height: 44 });
    }
  }
  applyPressedAttribute(instance: RowAttribute): void { this.applyNormalAttribute(instance); if (resolveReaderLabeledIconActionSpec(this.id).surfaceRole !== undefined) this.feedback().applyPressedAttribute(instance); }
  applyDisabledAttribute(instance: RowAttribute): void { this.applyNormalAttribute(instance); }
  private feedback(): ReaderPressFeedback {
    const spec = resolveReaderLabeledIconActionSpec(this.id);
    return new ReaderPressFeedback(readerAppColor(spec.surfaceRole ?? 'TOK_PAPER', this.scheme), this.scheme, spec.radius ?? 0, spec.radius ?? 0, this.enabled);
  }
}
class ReaderLabeledIconHitModifier implements AttributeModifier<StackAttribute> {
  constructor(private id: ReaderLabeledIconActionSpecId) {}
  applyNormalAttribute(instance: StackAttribute): void {
    instance.height(44);
    if (resolveReaderLabeledIconActionSpec(this.id).equalLayout) instance.layoutWeight(1);
  }
}

/** One icon/label row implementation, with finite original RSS geometry.
 * Domain callbacks and presentation admission stay at each actual owner. */
@Component
export struct ReaderLabeledIconAction {
  @Prop scheme: string = 'day';
  @Prop specId: ReaderLabeledIconActionSpecId = 'rss-feed';
  @Prop label: string = '';
  @Prop icon: Resource;
  @Prop isDanger: boolean = false;
  @Prop showDivider: boolean = false;
  @Prop actionEnabled: boolean = true;
  onAction: () => void = (): void => {};
  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }
  @Builder
  private labelContents() {
    Image(this.icon).width(resolveReaderLabeledIconActionSpec(this.specId).iconSize).height(resolveReaderLabeledIconActionSpec(this.specId).iconSize);
    Text(this.label).attributeModifier(new ReaderLabeledIconLabelModifier(this.specId, this.isDanger, this.scheme));
  }
  build() {
    if (resolveReaderLabeledIconActionSpec(this.specId).outerHit) {
      Stack({ alignContent: Alignment.Center }) {
        Row({ space: 5 }) { this.labelContents(); }
          .attributeModifier(new ReaderLabeledIconRowModifier(this.specId, this.showDivider, this.scheme, this.actionEnabled));
      }.attributeModifier(new ReaderLabeledIconHitModifier(this.specId))
        .enabled(this.actionEnabled).accessibilityText(this.label).onClick((): void => this.commit());
    } else {
      Row({ space: 5 }) { this.labelContents(); }
        .attributeModifier(new ReaderLabeledIconRowModifier(this.specId, this.showDivider, this.scheme, this.actionEnabled))
        .enabled(this.actionEnabled).accessibilityText(this.label).onClick((): void => this.commit());
    }
  }
  private commit(): void { if (this.mounted && this.actionEnabled) this.onAction(); }
}
