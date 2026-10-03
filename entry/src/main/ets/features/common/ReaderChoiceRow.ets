import { ReaderChoiceSpec, ReaderChoiceSpecId, resolveReaderChoiceSpec } from './ReaderChoiceSpecs';
import { readerAppColor } from './ReaderThemeRegistry';
import type { ReaderTextStyle } from './ReaderTypography';

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
  @Prop enabled: boolean = true;
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
        .fontFamily(this.textStyle().fontFamily)
        .fontWeight(this.selected ? this.spec().selectedWeight : this.textStyle().fontWeight, this.spec().variableWeight ? { enableVariableFontWeight: true } : undefined)
        .fontSize(this.textStyle().fontSizeFp).lineHeight(this.textStyle().lineHeightFp as number)
        .fontColor(this.textColor()).maxLines(1)
        .textAlign(this.spec().textAlignStart ? TextAlign.Start : undefined)
        .textOverflow(this.spec().ellipsis ? { overflow: TextOverflow.Ellipsis } : undefined);
      if (this.hasIcon()) {
        Image(this.icon()).width(this.spec().iconWidth).height(this.spec().iconHeight)
          .rotate({ angle: this.spec().rotateIcon ? this.chevronAngle : 0 });
      }
    }.width('100%').height(this.rowHeight())
      .padding({ left: this.spec().padding, right: this.spec().padding })
      .alignItems(VerticalAlign.Center).borderRadius(this.spec().radius)
      .backgroundColor(this.backgroundColor())
      .enabled(this.enabled).accessibilityText(this.accessibilityLabel())
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
      .backgroundColor(this.backgroundColor()).enabled(this.enabled)
      .accessibilityText(this.accessibilityLabel()).onClick((): void => this.choose());
  }

  private spec(): ReaderChoiceSpec { return resolveReaderChoiceSpec(this.specId); }
  private textStyle(): ReaderTextStyle { return this.selected ? this.spec().selectedText : this.spec().text; }
  private rowHeight(): number { return this.spec().height - (this.showDivider ? this.spec().dividerHeight : 0); }
  private textColor(): ResourceColor { return readerAppColor(this.selected ? this.spec().selectedTextRole : this.spec().textRole, this.scheme); }
  private backgroundColor(): ResourceColor {
    return this.selected && this.spec().selectedBackground !== undefined ?
      readerAppColor(this.spec().selectedBackground!, this.scheme) : Color.Transparent;
  }
  private hasIcon(): boolean { return this.spec().showIcon === 'always' || (this.spec().showIcon === 'selected' && this.selected); }
  private icon(): Resource { return $r(this.scheme === 'night' ? this.spec().iconNight : this.spec().iconDay); }
  private accessibilityLabel(): string { return this.specId === 'appearance-library' ? `${this.label}${this.selected ? '，已选择' : ''}` : this.label; }
  private choose(): void { if (this.mounted && this.enabled) this.onChoose(this.label); }
}
