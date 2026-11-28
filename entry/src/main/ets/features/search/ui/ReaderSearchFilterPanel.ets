import { readerScaledControlHeight } from '../../../ui/foundation/ReaderSurfaceResolvers';
import type { MeasureOptions } from '@ohos.measure';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { ReaderRecessedSegmentRail, type ReaderRecessedSegmentOption } from '../../../ui/controls/ReaderRecessedSegmentRail';
import { resolveReaderButtonSpec } from '../../../ui/controls/ReaderControlSpecs';
import { TYPE_APP_FILTER_OPTION } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { SheetSurfaceSpec, resolveSheetSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../ui/surfaces/ReaderBoundedSurfaceHeader';
import { readerOverlayViewport } from '../../../ui/layout/ReaderOverlayGeometry';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { SearchFilterGeometry } from './SearchFilterGeometry';
import type { SearchContentType } from '../presentation/SearchViewState';

/** Bounded search filter content. SearchPage owns the current presentation and input. */
@Component
export struct ReaderSearchFilterPanel {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('metricsChanged') private metricsRevision: number = 0;
  @Prop expanded: boolean = false;
  @Prop presentationIdentity: string = '';
  @Prop surfaceWidth: number = 0;
  @Prop selectedGroup: string = '全部';
  @Prop selectedType: SearchContentType = '全部类型';
  onReset: (identity: string) => void = (_identity: string): void => {};
  onDismiss: (identity: string) => void = (_identity: string): void => {};
  onGroup: (value: string, identity: string) => void = (_value: string, _identity: string): void => {};
  onType: (value: SearchContentType, identity: string) => void = (_value: SearchContentType, _identity: string): void => {};
  private mounted: boolean = false;
  private geometryKey: string = '';
  @State private measuredHeaderHeight: number = 0;
  private measuredGeometry: SearchFilterGeometry | undefined = undefined;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  private systemFontScale(): number {
    const value = this.metricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(value) && value > 0 ? value : 1;
  }
  private active(): boolean { return this.selectedGroup !== '全部' || this.selectedType !== '全部类型'; }
  private accepts(identity: string): boolean {
    return this.mounted && this.expanded && identity === this.presentationIdentity;
  }
  private metricsChanged(): void {
    this.geometryKey = '';
    this.measuredHeaderHeight = 0;
  }
  // Native fp measurement already applies system scaling. The shared search
  // controls floor scales below one, so only that case uses unscaled vp.
  private measureLength(size: number): string {
    return `${size}${this.systemFontScale() < 1 ? 'vp' : 'fp'}`;
  }
  private sheetSpec(): SheetSurfaceSpec { return resolveSheetSpec('search-result-filter'); }
  private sheetGeometry(): SearchFilterGeometry {
    const windowHeight = ReaderWindowCoordinator.metrics().windowRect.height;
    const key = `${this.metricsRevision}:${this.surfaceWidth}:${windowHeight}:${this.measuredHeaderHeight}:${this.bodyHeightLimit()}`;
    if (key === this.geometryKey && this.measuredGeometry !== undefined) return this.measuredGeometry;
    const context = this.getUIContext();
    const measure = context.getMeasureUtils();
    const spec = resolveReaderButtonSpec('search-filter-option');
    const style = spec.text;
    const labels: string[] = ['全部', '小说', '漫画', '本地', '在线'];
    const widths: number[] = [];
    let optionHeight = 0;
    labels.forEach((label: string): void => {
      const options: MeasureOptions = { textContent: label, fontSize: this.measureLength(style.fontSizeFp),
        fontFamily: style.fontFamily, fontWeight: Math.max(style.fontWeight ?? 400, spec.selectedWeight ?? 400),
        lineHeight: this.measureLength(style.lineHeightFp ?? style.fontSizeFp * 1.5) };
      if (style.letterSpacingFp !== undefined) options.letterSpacing = this.measureLength(style.letterSpacingFp);
      const size = measure.measureTextSize(options);
      widths.push(Math.ceil(context.px2vp(Number(size.width))) + spec.horizontalPadding * 2 + TOK_BORDER_W * 2);
      optionHeight = Math.max(optionHeight, Math.ceil(context.px2vp(Number(size.height))));
    });
    const labelStyle = TYPE_APP_FILTER_OPTION;
    let labelWidth = 0;
    let labelHeight = 0;
    ['内容', '来源'].forEach((label: string): void => {
      const size = measure.measureTextSize({ textContent: label, fontSize: this.measureLength(labelStyle.fontSizeFp),
        fontFamily: labelStyle.fontFamily, fontWeight: labelStyle.fontWeight,
        lineHeight: this.measureLength(labelStyle.lineHeightFp ?? labelStyle.fontSizeFp * 1.5) });
      labelWidth = Math.max(labelWidth, Math.ceil(context.px2vp(Number(size.width))));
      labelHeight = Math.max(labelHeight, Math.ceil(context.px2vp(Number(size.height))));
    });
    this.measuredGeometry = new SearchFilterGeometry(this.surfaceWidth, this.bodyHeightLimit(), labelWidth, labelHeight,
      [widths[0], Math.max(widths[1], widths[3]), Math.max(widths[2], widths[4])],
      optionHeight + spec.verticalPadding * 2 + TOK_BORDER_W * 2, this.sheetSpec().horizontalInset);
    this.geometryKey = key;
    return this.measuredGeometry;
  }
  private bodyHeightLimit(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const spec = this.sheetSpec();
    const reset = resolveReaderButtonSpec('search-retry-progress');
    const resetHeight = readerScaledControlHeight(reset.minHeight ?? 44,
      reset.text.lineHeightFp ?? reset.text.fontSizeFp * 1.5, this.systemFontScale());
    const header = this.measuredHeaderHeight > 0 ? this.measuredHeaderHeight :
      spec.handleTop + spec.handleHeight + spec.handleBottom +
      Math.max(spec.titleHeight, spec.titleLineHeight * Math.max(1, this.systemFontScale()), resetHeight) + spec.titleBottom;
    const viewport = readerOverlayViewport(metrics);
    return Math.max(0, Math.min(metrics.windowRect.height * .6,
      viewport.height - header - spec.contentBottom - spec.hostBorderWidth));
  }
  private headerMeasurement(identity: string): (_old: Area, area: Area) => void {
    return (_old: Area, area: Area): void => {
      const height = readerPageAreaLength(area.height);
      if (this.accepts(identity) && Number.isFinite(height) && height > 0 &&
        Math.abs(height - this.measuredHeaderHeight) > .1) this.measuredHeaderHeight = height;
    };
  }
  private contentType(index: number): SearchContentType {
    return index === 0 ? '全部类型' : (index === 1 ? '小说' : '漫画');
  }
  private sourceGroup(index: number): string { return index === 0 ? '全部' : (index === 1 ? '本地' : '在线'); }
  private contentRailOptions(): ReaderRecessedSegmentOption[] {
    const types: SearchContentType[] = ['全部类型', '小说', '漫画'];
    return types.map((typeValue: SearchContentType): ReaderRecessedSegmentOption => ({
      id: typeValue,
      label: typeValue === '全部类型' ? '全部' : typeValue,
      elementId: `search-content-type-${typeValue}`,
      accessibilityText: this.selectedType === typeValue ? `当前内容:${typeValue}` : `筛选内容:${typeValue}`,
    }));
  }
  private sourceRailOptions(): ReaderRecessedSegmentOption[] {
    const groups: string[] = ['全部', '本地', '在线'];
    return groups.map((groupValue: string): ReaderRecessedSegmentOption => ({
      id: groupValue,
      label: groupValue,
      elementId: groupValue === '在线' ? 'reader-search-filter-online' : '',
      accessibilityText: this.selectedGroup === groupValue ? `当前来源:${groupValue}` : `筛选来源:${groupValue}`,
    }));
  }
  private railHeight(): number {
    return Math.max(34, this.sheetGeometry().choiceHeight);
  }
  @Builder
  private groupChip(label: string, index: number, identity: string) {
    ReaderButton({ scheme: this.scheme, specId: 'search-filter-option', label, primary: this.selectedGroup === label,
      focusId: label === '在线' ? 'reader-search-filter-online' : '',
      actionAccessibilityLabel: this.selectedGroup === label ? `当前来源:${label}` : `筛选来源:${label}`,
      onAction: (): void => { if (this.accepts(identity)) this.onGroup(label, identity); } })
      .width(this.sheetGeometry().choiceWidths[index]).height(this.sheetGeometry().choiceHeight);
  }
  @Builder
  private typeChip(label: SearchContentType, index: number, identity: string) {
    ReaderButton({ scheme: this.scheme, specId: 'search-filter-option', label: label === '全部类型' ? '全部' : label,
      primary: this.selectedType === label,
      actionAccessibilityLabel: this.selectedType === label ? `当前内容:${label}` : `筛选内容:${label}`,
      onAction: (): void => { if (this.accepts(identity)) this.onType(label, identity); } })
      .width(this.sheetGeometry().choiceWidths[index]).height(this.sheetGeometry().choiceHeight).id(`search-content-type-${label}`);
  }
  @Builder
  private groupLabel(label: string) {
    Text(label).fontFamily(TYPE_APP_FILTER_OPTION.fontFamily).fontWeight(TYPE_APP_FILTER_OPTION.fontWeight)
      .fontSize(TYPE_APP_FILTER_OPTION.fontSizeFp).lineHeight(TYPE_APP_FILTER_OPTION.lineHeightFp as number)
      .minFontScale(1)
      .maxFontScale(Math.max(1, this.systemFontScale()))
      .width(this.sheetGeometry().stackedLabels ? this.sheetGeometry().innerWidth : this.sheetGeometry().labelWidth)
      .fontColor(readerAppColor('TOK_MUTED', this.scheme));
  }
  @Builder
  private choiceRows(isContent: boolean, identity: string) {
    Column({ space: this.sheetGeometry().choiceGap }) {
      ForEach(this.sheetGeometry().choiceRows, (row: number[]) => {
        Row({ space: this.sheetGeometry().choiceGap }) {
          ForEach(row, (index: number) => {
            if (isContent) this.typeChip(this.contentType(index), index, identity);
            else this.groupChip(this.sourceGroup(index), index, identity);
          }, (index: number): string => `${identity}:${isContent}:${index}:${this.sheetGeometry().choiceWidths[index]}:${this.sheetGeometry().choiceHeight}`);
        }.alignItems(VerticalAlign.Center);
      }, (row: number[]): string => `${identity}:${row.join(':')}:${this.sheetGeometry().choiceWidths.join(':')}:${this.sheetGeometry().choiceHeight}`);
    }.alignItems(HorizontalAlign.Start);
  }
  @Builder
  private choiceRail(isContent: boolean, identity: string) {
    ReaderRecessedSegmentRail({
      options: isContent ? this.contentRailOptions() : this.sourceRailOptions(),
      selectedId: isContent ? this.selectedType : this.sourceGroupSelected(),
      accessibilityGroupLabel: isContent ? '内容' : '来源',
      trackHeight: this.railHeight(),
      pillShape: true,
      onSelect: (value: string): void => {
        if (!this.accepts(identity)) return;
        if (isContent) this.onType(value as SearchContentType, identity);
        else this.onGroup(value, identity);
      },
    });
  }
  private sourceGroupSelected(): string {
    return this.selectedGroup;
  }
  @Builder
  private optionGroup(label: string, isContent: boolean, identity: string) {
    if (this.sheetGeometry().stackedLabels) {
      Column({ space: this.sheetGeometry().groupGap }) {
        this.groupLabel(label);
        if (this.sheetGeometry().choiceRows.length === 1) {
          Row() { this.choiceRail(isContent, identity); }.width(this.sheetGeometry().innerWidth);
        } else {
          this.choiceRows(isContent, identity);
        }
      }.width(this.sheetGeometry().innerWidth).alignItems(HorizontalAlign.Start);
    } else {
      Row({ space: this.sheetGeometry().labelGap }) {
        this.groupLabel(label);
        if (this.sheetGeometry().choiceRows.length === 1) {
          Row() { this.choiceRail(isContent, identity); }
            .width(Math.max(0, this.sheetGeometry().innerWidth - this.sheetGeometry().labelWidth - this.sheetGeometry().labelGap));
        } else {
          this.choiceRows(isContent, identity);
        }
      }.width(this.sheetGeometry().innerWidth).alignItems(VerticalAlign.Center);
    }
  }
  @Builder
  private optionContent(identity: string) {
    Column({ space: this.sheetGeometry().groupGap }) {
      this.optionGroup('内容', true, identity);
      this.optionGroup('来源', false, identity);
    }.width('100%').alignItems(HorizontalAlign.Start).padding(this.sheetGeometry().padding);
  }
  @Builder
  private resetAction(identity: string) {
    ReaderButton({ scheme: this.scheme, specId: 'search-retry-progress', label: '重置',
      focusId: 'reader-search-filter-reset',
      actionEnabled: this.active(), onAction: (): void => { if (this.accepts(identity)) this.onReset(identity); } });
  }
  @Builder
  private sheetHeader(identity: string) {
    ReaderBoundedSurfaceHeader({ specId: 'search-result-filter', title: '筛选',
      accessory: (): void => { this.resetAction(identity); },
      onClose: (): void => { if (this.accepts(identity)) this.onDismiss(identity); },
      onAreaChanged: this.headerMeasurement(identity) });
  }
  @Builder
  private sheetBody(identity: string) {
    if (this.sheetGeometry().naturalHeight > this.bodyHeightLimit()) {
      Scroll() { this.optionContent(identity); }
        .width('100%').constraintSize({ maxHeight: this.bodyHeightLimit() }).scrollBar(BarState.Auto);
    } else {
      this.optionContent(identity);
    }
  }
  build() {
    ForEach([this.presentationIdentity], (identity: string): void => {
      ReaderBoundedSurface({ specId: 'search-result-filter',
        header: (): void => { this.sheetHeader(identity); },
        body: (): void => { this.sheetBody(identity); } });
    }, (identity: string): string => identity);
  }
}
