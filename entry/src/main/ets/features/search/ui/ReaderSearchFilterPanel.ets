import type { MeasureOptions } from '@ohos.measure';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { ReaderButton } from '../../../ui/controls/ReaderButton';
import { resolveReaderButtonSpec } from '../../../ui/controls/ReaderControlSpecs';
import { TYPE_APP_FILTER_OPTION } from '../../../ui/foundation/ReaderTypography';
import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { SheetSurfaceSpec, resolveSheetSpec } from '../../../ui/surfaces/ReaderSurfaceSpecs';
import { ReaderBoundedSurface } from '../../../ui/surfaces/ReaderBoundedSurface';
import { ReaderBoundedSurfaceHeader } from '../../../ui/surfaces/ReaderBoundedSurfaceHeader';
import { SurfaceWidthSpec, resolveHorizontalFrame } from '../../../ui/layout/SurfaceHorizontalGeometry';
import { readerVisualSafeLeft, readerVisualSafeRight, readerVisualSafeTop, readerVisualSafeBottom } from '../../../ui/foundation/ReaderWindowMetrics';
import { readerPageAreaLength } from '../../../ui/layout/ReaderPageShell';
import { TOK_BORDER_W } from '../../../ui/foundation/ReaderTokens';
import { SearchFilterGeometry } from './SearchFilterGeometry';
import { SEARCH_RESULT_GEOMETRY } from './SearchResultGeometry';
import { SearchResultSheetBinding } from './SearchResultSheetBinding';
import type { SearchContentType } from '../presentation/SearchViewState';

/** One filter trigger and native bottom-sheet host. Query facts and selected
 * conditions stay with SearchPage; the shared sheet owns its one frame. */
@Component
export struct ReaderSearchFilterPanel {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('metricsChanged') private metricsRevision: number = 0;
  @Prop expanded: boolean = false;
  @Prop presentationIdentity: string = '';
  @Prop triggerFocusId: string = '';
  @Prop selectedGroup: string = '全部';
  @Prop selectedType: SearchContentType = '全部类型';
  onToggle: (identity: string, expanded: boolean) => void = (_identity: string, _expanded: boolean): void => {};
  onNativeOpening: (identity: string) => void = (_identity: string): void => {};
  onNativeClosing: (identity: string) => void = (_identity: string): void => {};
  onClosed: (identity: string) => void = (_identity: string): void => {};
  onReset: (identity: string) => void = (_identity: string): void => {};
  onDismiss: (identity: string) => void = (_identity: string): void => {};
  onGroup: (value: string, identity: string) => void = (_value: string, _identity: string): void => {};
  onType: (value: SearchContentType, identity: string) => void = (_value: SearchContentType, _identity: string): void => {};
  private mounted: boolean = false;
  private geometryKey: string = '';
  private readonly nativeSheet: SearchResultSheetBinding = new SearchResultSheetBinding();
  @State private measuredHeaderHeight: number = 0;
  private measuredGeometry: SearchFilterGeometry | undefined = undefined;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; this.nativeSheet.retire(this.onNativeClosing); }

  private systemFontScale(): number {
    const value = this.metricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
    return Number.isFinite(value) && value > 0 ? value : 1;
  }
  private active(): boolean { return this.selectedGroup !== '全部' || this.selectedType !== '全部类型'; }
  private accepts(identity: string): boolean {
    return this.mounted && this.expanded && identity === this.presentationIdentity;
  }
  private toggleAction(identity: string, expanded: boolean): () => void {
    return (): void => { if (this.mounted) this.onToggle(identity, expanded); };
  }
  private metricsChanged(): void {
    // A native bottom sheet can publish avoid-area/window facts during entry.
    // It has no popup anchor to retire: remeasure in place, and let explicit
    // dismiss/navigation ownership close it. Closing here cancels its opening.
    this.geometryKey = '';
    this.measuredHeaderHeight = 0;
  }
  // Native fp measurement already applies system scaling. The shared search
  // controls floor scales below one, so only that case uses unscaled vp.
  private measureLength(size: number): string {
    return `${size}${this.systemFontScale() < 1 ? 'vp' : 'fp'}`;
  }
  private sheetSpec(): SheetSurfaceSpec { return resolveSheetSpec('search-result-filter'); }
  private sheetWidth(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(metrics.windowRect.width, readerVisualSafeLeft(metrics), readerVisualSafeRight(metrics),
      new SurfaceWidthSpec(this.sheetSpec().maxWidth)).width;
  }
  private sheetGeometry(): SearchFilterGeometry {
    const windowHeight = ReaderWindowCoordinator.metrics().windowRect.height;
    const key = `${this.metricsRevision}:${this.sheetWidth()}:${windowHeight}:${this.measuredHeaderHeight}:${this.bodyHeightLimit()}`;
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
    this.measuredGeometry = new SearchFilterGeometry(this.sheetWidth(), this.bodyHeightLimit(), labelWidth, labelHeight,
      [widths[0], Math.max(widths[1], widths[3]), Math.max(widths[2], widths[4])],
      optionHeight + spec.verticalPadding * 2 + TOK_BORDER_W * 2, this.sheetSpec().horizontalInset);
    this.geometryKey = key;
    return this.measuredGeometry;
  }
  private sheetOptions(identity: string): SheetOptions {
    return this.nativeSheet.options(this.sheetSpec(), this.sheetWidth(), this.scheme, identity, {
      isMountedOpening: (): boolean => this.mounted && identity === this.presentationIdentity,
      isExpandedOpening: (): boolean => this.accepts(identity),
      onOpening: this.onNativeOpening, onClosing: this.onNativeClosing,
      onDismiss: this.onDismiss, onClosed: this.onClosed,
    });
  }
  private bodyHeightLimit(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    const spec = this.sheetSpec();
    const header = this.measuredHeaderHeight > 0 ? this.measuredHeaderHeight :
      spec.handleTop + spec.handleHeight + spec.handleBottom +
      Math.max(spec.titleHeight, spec.titleLineHeight * Math.max(1, this.systemFontScale())) + spec.titleBottom;
    return Math.max(0, Math.min(metrics.windowRect.height * .6, metrics.windowRect.height -
      readerVisualSafeTop(metrics) - readerVisualSafeBottom(metrics) - header - spec.contentBottom));
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
  @Builder
  private groupChip(label: string, index: number, identity: string, geometry: SearchFilterGeometry) {
    ReaderButton({ scheme: this.scheme, specId: 'search-filter-option', label, primary: this.selectedGroup === label,
      actionAccessibilityLabel: this.selectedGroup === label ? `当前来源:${label}` : `筛选来源:${label}`,
      onAction: (): void => { if (this.accepts(identity)) this.onGroup(label, identity); } })
      .width(geometry.choiceWidths[index]).height(geometry.choiceHeight);
  }
  @Builder
  private typeChip(label: SearchContentType, index: number, identity: string, geometry: SearchFilterGeometry) {
    ReaderButton({ scheme: this.scheme, specId: 'search-filter-option', label: label === '全部类型' ? '全部' : label,
      primary: this.selectedType === label,
      actionAccessibilityLabel: this.selectedType === label ? `当前内容:${label}` : `筛选内容:${label}`,
      onAction: (): void => { if (this.accepts(identity)) this.onType(label, identity); } })
      .width(geometry.choiceWidths[index]).height(geometry.choiceHeight).id(`search-content-type-${label}`);
  }
  @Builder
  private groupLabel(label: string, geometry: SearchFilterGeometry) {
    Text(label).fontFamily(TYPE_APP_FILTER_OPTION.fontFamily).fontWeight(TYPE_APP_FILTER_OPTION.fontWeight)
      .fontSize(TYPE_APP_FILTER_OPTION.fontSizeFp).lineHeight(TYPE_APP_FILTER_OPTION.lineHeightFp as number)
      .minFontScale(1)
      .maxFontScale(Math.max(1, this.systemFontScale()))
      .width(geometry.stackedLabels ? geometry.innerWidth : geometry.labelWidth)
      .fontColor(readerAppColor('TOK_MUTED', this.scheme));
  }
  @Builder
  private choiceRows(isContent: boolean, identity: string, geometry: SearchFilterGeometry) {
    Column({ space: geometry.choiceGap }) {
      ForEach(geometry.choiceRows, (row: number[]) => {
        Row({ space: geometry.choiceGap }) {
          ForEach(row, (index: number) => {
            if (isContent) this.typeChip(this.contentType(index), index, identity, geometry);
            else this.groupChip(this.sourceGroup(index), index, identity, geometry);
          }, (index: number): string => `${identity}:${isContent}:${index}:${geometry.choiceWidths[index]}:${geometry.choiceHeight}`);
        }.alignItems(VerticalAlign.Center);
      }, (row: number[]): string => `${identity}:${row.join(':')}:${geometry.choiceWidths.join(':')}:${geometry.choiceHeight}`);
    }.alignItems(HorizontalAlign.Start);
  }
  @Builder
  private optionGroup(label: string, isContent: boolean, identity: string, geometry: SearchFilterGeometry) {
    if (geometry.stackedLabels) {
      Column({ space: geometry.groupGap }) {
        this.groupLabel(label, geometry); this.choiceRows(isContent, identity, geometry);
      }.width(geometry.innerWidth).alignItems(HorizontalAlign.Start);
    } else {
      Row({ space: geometry.labelGap }) {
        this.groupLabel(label, geometry); this.choiceRows(isContent, identity, geometry);
      }.width(geometry.innerWidth).alignItems(VerticalAlign.Center);
    }
  }
  @Builder
  private optionContent(identity: string, geometry: SearchFilterGeometry) {
    Column({ space: geometry.groupGap }) {
      this.optionGroup('内容', true, identity, geometry);
      this.optionGroup('来源', false, identity, geometry);
    }.width('100%').alignItems(HorizontalAlign.Start).padding(geometry.padding);
  }
  @Builder
  private resetAction(identity: string) {
    ReaderButton({ scheme: this.scheme, specId: 'search-retry-progress', label: '重置',
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
      Scroll() { this.optionContent(identity, this.sheetGeometry()); }
        .width('100%').constraintSize({ maxHeight: this.bodyHeightLimit() }).scrollBar(BarState.Auto);
    } else {
      this.optionContent(identity, this.sheetGeometry());
    }
  }
  @Builder
  private sheetContent() {
    // bindSheet must receive the named @Builder so the SDK emits its native
    // { builder } port. Capture each presentation inside that Builder, rather
    // than returning a raw function from a factory the native host cannot use.
    ForEach([this.presentationIdentity], (identity: string): void => {
      ReaderBoundedSurface({ specId: 'search-result-filter',
        header: (): void => { this.sheetHeader(identity); },
        body: (): void => { this.sheetBody(identity); } });
    }, (identity: string): string => identity);
  }
  build() {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Stack({ alignContent: Alignment.Center }) {
      Image(this.scheme === 'night' ?
        (this.active() ? $r('app.media.bookshelf_filter_active_theme_night') : $r('app.media.bookshelf_filter_theme_night')) :
        (this.active() ? $r('app.media.bookshelf_filter_active') : $r('app.media.bookshelf_filter')))
        .width(SEARCH_RESULT_GEOMETRY.filterIconSize).height(SEARCH_RESULT_GEOMETRY.filterIconSize);
      }.width(SEARCH_RESULT_GEOMETRY.filterActionSize).height(SEARCH_RESULT_GEOMETRY.filterActionSize);
    }.width(SEARCH_RESULT_GEOMETRY.filterActionSize).height(SEARCH_RESULT_GEOMETRY.filterActionSize)
      .padding(0).backgroundColor(Color.Transparent).borderRadius(0)
      .id(this.triggerFocusId)
      .accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityText(`${this.expanded ? '收起筛选' : '展开筛选'}，内容${this.selectedType}，来源${this.selectedGroup}`)
      .onClick(this.toggleAction(this.presentationIdentity, this.expanded))
      .bindSheet(this.expanded, this.sheetContent, this.sheetOptions(this.presentationIdentity));
  }
}
