import { readerReadableFontScale, readerScaledControlHeight } from '../foundation/ReaderSurfaceResolvers';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { ReaderLabeledIconActionSpecId, resolveReaderLabeledIconActionSpec } from './ReaderLabeledIconActionSpecs';
import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { TOK_BORDER_W } from '../foundation/ReaderTokens';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../layout/ReaderRaisedShape';
import { readerPageAreaLength } from '../layout/ReaderPageShell';

class ReaderLabeledIconLabelModifier implements AttributeModifier<TextAttribute> {
  private id: ReaderLabeledIconActionSpecId;
  private danger: boolean;
  private scheme: string;
  private scale: number;
  constructor(id: ReaderLabeledIconActionSpecId, danger: boolean, scheme: string, scale: number = 1) {
    this.id = id;
    this.danger = danger;
    this.scheme = scheme;
    this.scale = scale;
  }
  applyNormalAttribute(instance: TextAttribute): void {
    const spec = resolveReaderLabeledIconActionSpec(this.id), text = spec.text;
    if (text.fontFamily !== undefined) instance.fontFamily(text.fontFamily);
    if (text.fontWeight !== undefined) instance.fontWeight(text.fontWeight);
    instance.fontSize(text.fontSizeFp);
    if (this.id === 'source-management-add') {
      instance.minFontScale(1);
      instance.maxFontScale(readerReadableFontScale(this.scale));
    }
    if (text.lineHeightFp !== undefined) instance.lineHeight(text.lineHeightFp);
    if (text.letterSpacingFp !== undefined) instance.letterSpacing(text.letterSpacingFp);
    if (spec.labelMarginLeft !== undefined) instance.margin({ left: spec.labelMarginLeft });
    instance.fontColor(readerAppColor(this.danger && spec.dangerRole !== undefined ? spec.dangerRole : spec.textRole, this.scheme));
    if (!spec.naturalHeight) instance.maxLines(1);
  }
}
class ReaderLabeledIconRowModifier implements AttributeModifier<RowAttribute> {
  private id: ReaderLabeledIconActionSpecId;
  private divider: boolean;
  private scheme: string;
  private scale: number;
  private enabled: boolean;
  private paintRadius: number | undefined;
  constructor(id: ReaderLabeledIconActionSpecId, divider: boolean, scheme: string, enabled: boolean, scale: number = 1,
    paintRadius: number | undefined = undefined) {
    this.id = id;
    this.divider = divider;
    this.scheme = scheme;
    this.scale = scale;
    this.enabled = enabled;
    this.paintRadius = paintRadius;
  }
  applyNormalAttribute(instance: RowAttribute): void {
    const spec = resolveReaderLabeledIconActionSpec(this.id);
    if (spec.naturalHeight) {
      instance.constraintSize({ minHeight: spec.rowHeight ?? 44 });
    } else if (this.id === 'source-management-add') {
      instance.height(readerScaledControlHeight(spec.rowHeight ?? 44, spec.text.lineHeightFp ?? 20, this.scale));
    } else if (spec.rowHeight !== undefined) instance.height(spec.rowHeight);
    instance.alignItems(VerticalAlign.Center);
    if (spec.rowWidth !== undefined) instance.width(spec.naturalHeight && typeof spec.rowWidth === 'number' ? spec.rowWidth * this.scale : spec.rowWidth);
    if (spec.horizontalPadding !== undefined) {
      if (spec.leftPaddingOnly) instance.padding({ left: spec.horizontalPadding });
      else instance.padding({ left: spec.horizontalPadding, right: spec.horizontalPadding });
    }
    if (spec.centerRow) instance.justifyContent(FlexAlign.Center);
    if (spec.borderRole !== undefined) {
      if (spec.divided) instance.border({ width: { left: this.divider ? TOK_BORDER_W : 0 }, color: readerAppColor(spec.borderRole, this.scheme) });
      else instance.border({ width: TOK_BORDER_W, color: readerAppColor(spec.borderRole, this.scheme) });
    }
    if (spec.surfaceRole !== undefined && !spec.surfaceOnHit) this.feedback().applyNormalAttribute(instance);
    else if (spec.radius !== undefined && !spec.surfaceOnHit) instance.borderRadius(this.paintRadius ?? spec.radius);
    if (spec.gradientStart !== undefined && spec.gradientEnd !== undefined) this.gradient(instance, false);
    if (!spec.outerHit) {
      if (spec.equalLayout && !spec.naturalHeight) instance.layoutWeight(1);
      if (!spec.naturalHeight && spec.responseOffset !== undefined) instance.responseRegion({ x: 0, y: spec.responseOffset, width: '100%', height: 44 });
    }
  }
  applyPressedAttribute(instance: RowAttribute): void { this.applyNormalAttribute(instance); const spec = resolveReaderLabeledIconActionSpec(this.id); if (spec.gradientStart !== undefined && spec.gradientEnd !== undefined) this.gradient(instance, true); else if (spec.surfaceRole !== undefined && !spec.surfaceOnHit) this.feedback().applyPressedAttribute(instance); }
  applyDisabledAttribute(instance: RowAttribute): void { this.applyNormalAttribute(instance); }
  private gradient(instance: RowAttribute, pressed: boolean): void {
    const spec = resolveReaderLabeledIconActionSpec(this.id);
    if (spec.gradientStart === undefined || spec.gradientEnd === undefined) return;
    const start = readerAppColor(spec.gradientStart, this.scheme), end = readerAppColor(spec.gradientEnd, this.scheme);
    instance.linearGradient({ angle: 270, colors: [[pressed ? new ReaderPressFeedback(start, this.scheme, 0, 0, this.enabled).pressedSurface() : start, 0],
      [pressed ? new ReaderPressFeedback(end, this.scheme, 0, 0, this.enabled).pressedSurface() : end, 1]] });
  }
  private feedback(): ReaderPressFeedback {
    const spec = resolveReaderLabeledIconActionSpec(this.id);
    return new ReaderPressFeedback(readerAppColor(spec.surfaceRole ?? 'TOK_PAPER', this.scheme), this.scheme,
      this.paintRadius ?? spec.radius ?? 0, this.paintRadius ?? spec.radius ?? 0, this.enabled && spec.pressFeedback !== false);
  }
}
class ReaderLabeledIconHitModifier implements AttributeModifier<ButtonAttribute> {
  private id: ReaderLabeledIconActionSpecId;
  private scheme: string;
  private scale: number;
  private enabled: boolean;
  private fillWidth: boolean;
  constructor(id: ReaderLabeledIconActionSpecId, scheme: string, enabled: boolean, scale: number = 1, fillWidth: boolean = false) {
    this.id = id;
    this.scheme = scheme;
    this.scale = scale;
    this.enabled = enabled;
    this.fillWidth = fillWidth;
  }
  applyNormalAttribute(instance: ButtonAttribute): void {
    const spec = resolveReaderLabeledIconActionSpec(this.id);
    if (spec.naturalHeight) instance.constraintSize({ minHeight: 44 });
    else instance.height(this.id === 'source-management-add' ?
      readerScaledControlHeight(spec.rowHeight ?? 44, spec.text.lineHeightFp ?? 20, this.scale) : 44);
    if (typeof spec.rowWidth === 'number') instance.width(spec.naturalHeight ? spec.rowWidth * this.scale : spec.rowWidth);
    if (spec.equalLayout && !spec.naturalHeight && !this.fillWidth) instance.layoutWeight(1);
    if (spec.surfaceOnHit) this.feedback().applyNormalAttribute(instance);
  }
  applyPressedAttribute(instance: ButtonAttribute): void { this.applyNormalAttribute(instance); if (resolveReaderLabeledIconActionSpec(this.id).surfaceOnHit) this.feedback().applyPressedAttribute(instance); }
  applyDisabledAttribute(instance: ButtonAttribute): void { this.applyNormalAttribute(instance); }
  private feedback(): ReaderPressFeedback {
    const spec = resolveReaderLabeledIconActionSpec(this.id);
    return new ReaderPressFeedback(readerAppColor(spec.surfaceRole ?? 'TOK_PAPER', this.scheme), this.scheme,
      spec.radius ?? 0, spec.radius ?? 0, this.enabled && spec.pressFeedback !== false);
  }
}

/** One icon/label row implementation, with finite original RSS geometry.
 * Domain callbacks and presentation admission stay at each actual owner. */
@Component
export struct ReaderLabeledIconAction {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerUiConfigurationRevision') private uiConfigurationRevision: number = 0;
  @Prop scheme: string = 'day';
  @Prop specId: ReaderLabeledIconActionSpecId = 'rss-feed';
  @Prop label: string = '';
  @Prop fillWidth: boolean = false;
  @Prop icon: Resource;
  @Prop isDanger: boolean = false;
  @Prop showDivider: boolean = false;
  @Prop actionEnabled: boolean = true;
  @Prop focusId: string = '';
  textLayoutOptions: TextOptions | undefined = undefined;
  onAction: () => void = (): void => {};
  @State private rowPaintShape: ReaderRaisedShape | undefined = undefined;
  @State private rowPaintAppearanceRevision: number = 0;
  private mounted: boolean = false;
  aboutToAppear(): void {
    this.mounted = true;
    this.rowPaintAppearanceRevision += 1;
    this.rowPaintShape = undefined;
  }
  aboutToDisappear(): void { this.mounted = false; }
  @Builder
  private labelContents() {
    Image(this.icon).width(resolveReaderLabeledIconActionSpec(this.specId).iconSize).height(resolveReaderLabeledIconActionSpec(this.specId).iconSize)
      .objectFit(ImageFit.Contain).opacity(this.actionEnabled ? 1 : (resolveReaderLabeledIconActionSpec(this.specId).disabledIconOpacity ?? 0.45))
      .accessibilityLevel('no');
    Text(this.label, this.textLayoutOptions).attributeModifier(new ReaderLabeledIconLabelModifier(this.specId, this.isDanger, this.scheme, this.fontScale()));
  }
  build() {
    if (resolveReaderLabeledIconActionSpec(this.specId).outerHit ||
      (resolveReaderLabeledIconActionSpec(this.specId).naturalHeight &&
        (resolveReaderLabeledIconActionSpec(this.specId).rowHeight ?? 44) < 44)) {
      Button({ type: ButtonType.Normal, stateEffect: false }) {
        Row({ space: resolveReaderLabeledIconActionSpec(this.specId).gap }) { this.labelContents(); }
          .attributeModifier(new ReaderLabeledIconRowModifier(this.specId, this.showDivider, this.scheme, this.actionEnabled,
            this.fontScale(), this.rowPaintRadius()))
          .onAreaChange(this.rowPaintAreaChange());
      }.width(this.fillWidth ? '100%' : undefined).padding(0).backgroundColor(Color.Transparent).borderRadius(0).clip(false)
        .attributeModifier(new ReaderLabeledIconHitModifier(this.specId, this.scheme, this.actionEnabled, this.fontScale(), this.fillWidth))
        .enabled(this.actionEnabled)
        .id(this.focusId)
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .accessibilityText(this.label).onClick((): void => this.commit());
    } else {
      Row({ space: resolveReaderLabeledIconActionSpec(this.specId).gap }) { this.labelContents(); }
        .width(this.fillWidth ? '100%' : undefined)
        .attributeModifier(new ReaderLabeledIconRowModifier(this.specId, this.showDivider, this.scheme, this.actionEnabled,
          this.fontScale(), this.rowPaintRadius()))
        .onAreaChange(this.rowPaintAreaChange())
        .enabled(this.actionEnabled).focusable(this.actionEnabled)
        .id(this.focusId)
        .accessibilityRole(AccessibilityRoleType.BUTTON)
        .accessibilityText(this.label).onClick((): void => this.commit());
    }
  }
  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }
  private rowPaintIdentity(): string {
    return JSON.stringify([this.rowPaintAppearanceRevision, this.readerWindowMetricsRevision, this.uiConfigurationRevision,
      this.specId, this.label, this.fontScale(), this.fillWidth]);
  }
  private rowPaintRadius(): number | undefined {
    const spec = resolveReaderLabeledIconActionSpec(this.specId);
    if (spec.radius !== 999) return undefined;
    if (this.mounted && this.rowPaintShape !== undefined) return this.rowPaintShape.radius;
    const minimumWidth = typeof spec.rowWidth === 'number' ? spec.rowWidth :
      spec.iconSize + spec.gap + 2 * (spec.horizontalPadding ?? 0);
    return resolveReaderRaisedShape(this.rowPaintIdentity(), minimumWidth, spec.rowHeight ?? 44, spec.radius)?.radius ?? 0;
  }
  private rowPaintAreaChange(): (_old: Area, area: Area) => void {
    const identity = this.rowPaintIdentity();
    return (_old: Area, area: Area): void => {
      if (!this.mounted || identity !== this.rowPaintIdentity() || resolveReaderLabeledIconActionSpec(this.specId).radius !== 999) return;
      const shape = resolveReaderRaisedShape(identity, readerPageAreaLength(area.width), readerPageAreaLength(area.height), 999);
      if (shape === undefined || (this.rowPaintShape?.identity === identity &&
        this.rowPaintShape.width === shape.width && this.rowPaintShape.height === shape.height)) return;
      this.rowPaintShape = shape;
    };
  }
  private commit(): void { if (this.mounted && this.actionEnabled) this.onAction(); }
}
