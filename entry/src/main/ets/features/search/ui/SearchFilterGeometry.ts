function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Native text measurement supplies the label/choice sizes. This owner only
 * resolves their two-group sheet layout; it never estimates text by character. */
export class SearchFilterGeometry {
  readonly padding: number;
  readonly groupGap: number = 8;
  readonly labelGap: number = 12;
  readonly choiceGap: number = 6;
  readonly width: number;
  readonly innerWidth: number;
  readonly stackedLabels: boolean;
  readonly labelWidth: number;
  readonly labelHeight: number;
  readonly choiceWidths: number[];
  readonly choiceHeight: number;
  readonly choiceRows: number[][] = [];
  readonly groupHeight: number;
  readonly naturalHeight: number;
  readonly maxHeight: number;
  readonly scrollRequired: boolean;

  constructor(availableWidth: number, maximumContentHeight: number, labelWidth: number, labelHeight: number,
    choiceWidths: number[], choiceHeight: number, contentPadding: number) {
    this.padding = Math.min(nonNegative(contentPadding), nonNegative(availableWidth) / 2);
    this.labelWidth = Math.ceil(nonNegative(labelWidth));
    this.labelHeight = Math.ceil(nonNegative(labelHeight));
    this.choiceHeight = Math.max(44, Math.ceil(nonNegative(choiceHeight)));
    const chrome = this.padding * 2;
    const measuredWidths = choiceWidths.map((width: number): number => Math.max(44, Math.ceil(nonNegative(width))));
    const choiceLane = measuredWidths.reduce((width: number, item: number): number => width + item, 0) +
      Math.max(0, measuredWidths.length - 1) * this.choiceGap;
    const naturalWidth = chrome + this.labelWidth + this.labelGap + choiceLane;
    this.width = nonNegative(availableWidth);
    this.innerWidth = Math.max(0, this.width - chrome);
    this.stackedLabels = naturalWidth > this.width;
    const laneWidth = this.stackedLabels ? this.innerWidth : Math.max(0, this.innerWidth - this.labelWidth - this.labelGap);
    this.choiceWidths = measuredWidths.map((width: number): number => Math.min(width, laneWidth));
    let row: number[] = [];
    let used = 0;
    this.choiceWidths.forEach((width: number, index: number): void => {
      if (row.length > 0 && used + this.choiceGap + width > laneWidth) {
        this.choiceRows.push(row); row = []; used = 0;
      }
      used += (row.length > 0 ? this.choiceGap : 0) + width;
      row.push(index);
    });
    if (row.length > 0) this.choiceRows.push(row);
    const choicesHeight = this.choiceRows.length * this.choiceHeight +
      Math.max(0, this.choiceRows.length - 1) * this.choiceGap;
    this.groupHeight = this.stackedLabels ? this.labelHeight + this.groupGap + choicesHeight :
      Math.max(this.labelHeight, choicesHeight);
    this.naturalHeight = this.groupHeight * 2 + this.groupGap + chrome;
    this.maxHeight = nonNegative(maximumContentHeight);
    this.scrollRequired = this.naturalHeight > this.maxHeight;
  }
}
