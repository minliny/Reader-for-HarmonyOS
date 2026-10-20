import { ReaderChoiceSpec, ReaderChoiceSpecId, resolveReaderChoiceSpec } from './ReaderChoiceSpecs';
import { readerAppColor } from './ReaderThemeRegistry';
import type { ReaderTextStyle } from './ReaderTypography';

/** The finite row spec keeps AUTO attributes absent, rather than calling a
 * native setter with undefined (which has different platform semantics). */
class ReaderChoiceLabelModifier implements AttributeModifier<TextAttribute> {
  private id: ReaderChoiceSpecId;
  private selected: boolean;
  constructor(id: ReaderChoiceSpecId, selected: boolean) {
    this.id = id;
    this.selected = selected;
  }
  applyNormalAttribute(instance: TextAttribute): void {
    const spec = resolveReaderChoiceSpec(this.id);
    const text = this.selected ? spec.selectedText : spec.text;
    instance.fontFamily(text.fontFamily);
    const weight = this.selected ? spec.selectedWeight : text.fontWeight;
    if (spec.variableWeight) instance.fontWeight(weight, { enableVariableFontWeight: true });
    else instance.fontWeight(weight);
    instance.fontSize(text.fontSizeFp);
    if (text.lineHeightFp !== undefined) instance.lineHeight(text.lineHeightFp);
    if (spec.textAlignStart) instance.textAlign(TextAlign.Start);
    if (spec.ellipsis) instance.textOverflow({ overflow: TextOverflow.Ellipsis });
  }
}

/** Controlled option row shared by inline selectors and responsive Settings.
 * Caller owns choice identity/commit; the finite spec owns the whole row. */
@Component
export struct ReaderChoiceRow {
  @Prop specId: ReaderChoiceSpecId = 'default-option';
  @Prop label: string = '';
  @Prop selected: boolean = false;
  @Prop showDivider: boolean = false;
  @Prop scheme: string = 'day';
  @Prop availableWidth: number = 0;
  @Prop chevronAngle: number = 0;
  @Prop actionEnabled: boolean = true;
  onChoose: (value: string) => void = (): void => {};

  private mounted: boolean = false;
  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    Column() {
      if (this.spec().layout === 'positioned') {
        this.positionedRow();
      } else {
        this.normalRow();
      }
      if (this.showDivider && this.spec().dividerRole !== undefined) {
        Row() {
          Blank().layoutWeight(1).height(this.spec().dividerHeight)
            .backgroundColor(readerAppColor(this.spec().dividerRole!, this.scheme));
        }.width('100%').height(this.spec().dividerHeight)
          .padding({ left: this.spec().padding, right: this.spec().padding });
      }
    }.width('100%').height(this.spec().height);
  }

  @Builder
  private normalRow() {
    Row({ space: this.spec().gap }) {
      Text(this.label).layoutWeight(1)
        .attributeModifier(new ReaderChoiceLabelModifier(this.specId, this.selected))
        .fontColor(this.textColor()).maxLines(1);
      if (this.hasIcon()) {
        Image(this.icon()).width(this.spec().iconWidth).height(this.spec().iconHeight)
          .rotate({ angle: this.spec().rotateIcon ? this.chevronAngle : 0 });
      }
    }.width('100%').height(this.rowHeight())
      .padding({ left: this.spec().padding, right: this.spec().padding })
      .alignItems(VerticalAlign.Center).borderRadius(this.spec().radius)
      .backgroundColor(this.rowBackground())
      .enabled(this.actionEnabled).accessibilityText(this.accessibilityLabel())
      .onClick((): void => this.choose());
  }

  @Builder
  private positionedRow() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text(this.label).width(Math.max(0, this.availableWidth - this.spec().textWidthInset))
        .height(this.spec().textHeight)
        .fontFamily(this.textStyle().fontFamily).fontWeight(this.selected ? this.spec().selectedWeight : this.textStyle().fontWeight)
        .fontSize(this.textStyle().fontSizeFp).lineHeight(this.textStyle().lineHeightFp as number)
        .fontColor(this.textColor()).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: this.spec().textLeft, y: this.spec().textTop });
      Image(this.icon()).width(this.spec().iconWidth).height(this.spec().iconHeight)
        .rotate({ angle: this.chevronAngle })
        .position({ x: this.availableWidth - this.spec().iconRight, y: this.spec().iconTop });
    }.width('100%').height(this.rowHeight())
      .backgroundColor(this.rowBackground()).enabled(this.actionEnabled)
      .accessibilityText(this.accessibilityLabel()).onClick((): void => this.choose());
  }

  private spec(): ReaderChoiceSpec { return resolveReaderChoiceSpec(this.specId); }
  private textStyle(): ReaderTextStyle { return this.selected ? this.spec().selectedText : this.spec().text; }
  private rowHeight(): number { return this.spec().height - (this.showDivider ? this.spec().dividerHeight : 0); }
  private textColor(): ResourceColor { return readerAppColor(this.selected ? this.spec().selectedTextRole : this.spec().textRole, this.scheme); }
  private rowBackground(): ResourceColor {
    return this.selected && this.spec().selectedBackground !== undefined ?
      readerAppColor(this.spec().selectedBackground!, this.scheme) : Color.Transparent;
  }
  private hasIcon(): boolean { return this.spec().showIcon === 'always' || (this.spec().showIcon === 'selected' && this.selected); }
  private icon(): Resource { return $r(this.scheme === 'night' ? this.spec().iconNight : this.spec().iconDay); }
  private accessibilityLabel(): string { return this.specId === 'appearance-library' ? `${this.label}${this.selected ? '，已选择' : ''}` : this.label; }
  private choose(): void { if (this.mounted && this.actionEnabled) this.onChoose(this.label); }
}
