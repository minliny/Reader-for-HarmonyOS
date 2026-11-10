import { ReaderPageScaffold } from './ReaderPageScaffold';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { APP_HEADER_BAR_HEIGHT } from '../foundation/ReaderHeaderMetrics';
import { ReaderMeasurementStore } from './ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from './ReaderPageGeometry';
import { ReaderStandardPageVariant, readerStandardPageSpec,
  readerPageAreaLength, readerStandardPageContentEndInset, readerStandardPageFooterBottom,
  READER_STANDARD_PAGE_CONTENT_GAP } from './ReaderPageShell';
import { ReaderFrameStyle, readerFrameStyle } from './ReaderFrameStyle';
import { ReaderPageScrollHost } from './ReaderPageScrollHost';
import { ReaderScrollLayout, readerScrollLayout } from './ReaderScrollLayout';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';

/** Standard pages share the resolved page geometry, Scroll body, measured
 * header clearance and footer budget. Pages supply business builders only. */
@Component
export struct ReaderStandardPage {
  @StorageLink('readerWindowMetricsRevision') @Watch('onLayoutInputsChanged') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('onLayoutInputsChanged') variant: ReaderStandardPageVariant = 'management';
  @Prop @Watch('onLayoutInputsChanged') contentLeadingRail: number = 0;
  @Prop @Watch('onLayoutInputsChanged') contentEndInset: number = -1;
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private measurementKey: number = 0;
  private geometryRevision: number = 0;
  private viewportWidth: number = 0;
  private viewportHeight: number = 0;
  private mounted: boolean = false;
  onViewportChange: (width: number, height: number) => void = (_width: number, _height: number): void => {};
  scroller: Scroller = new Scroller();
  @BuilderParam content: () => void = this.emptySlot;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam footer: () => void = this.emptySlot;
  @BuilderParam overlayContent: (contentStartInset: number) => void = this.emptyOverlaySlot;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  @Builder private emptySlot() {}
  @Builder private emptyOverlaySlot(_contentStartInset: number) {}

  aboutToAppear(): void {
    this.mounted = true;
    this.onLayoutInputsChanged();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.measurements.clear();
    this.viewportWidth = 0;
    this.viewportHeight = 0;
  }

  private onLayoutInputsChanged(): void {
    if (!this.mounted) return;
    this.measurementKey += 1;
    this.refreshGeometry();
  }

  private recordMeasurement(slot: string, height: number, presentedKey: number): void {
    if (!this.mounted || presentedKey !== this.measurementKey) return;
    if (this.measurements.record(slot, height, presentedKey)) this.refreshGeometry();
  }

  private headerHeight(): number {
    return this.measurements.read('standard:header', APP_HEADER_BAR_HEIGHT);
  }

  private footerHeight(): number {
    return this.contentLeadingRail > 0 ? 0 : this.measurements.read('standard:footer', 0);
  }

  private refreshGeometry(): void {
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.viewportWidth;
    input.viewportHeight = this.viewportHeight;
    input.measurementRevision = ++this.geometryRevision;
    input.headerHeight = this.headerHeight();
    input.contentGap = READER_STANDARD_PAGE_CONTENT_GAP;
    input.footerHeight = this.footerHeight();
    input.footerBottom = readerStandardPageFooterBottom(this.variant, metrics);
    input.contentLeadingRail = this.contentLeadingRail;
    input.contentEndInset = this.contentEndInset >= 0 ? this.contentEndInset :
      readerStandardPageContentEndInset(this.variant, metrics, input.footerHeight);
    input.contentMaxWidth = readerStandardPageSpec(this.variant).maxWidth;
    input.contentHorizontalPadding = 19;
    this.geometry = resolveReaderPageGeometry(input);
  }

  private frameStyle(): ReaderFrameStyle {
    const pageBackground = readerAppColor('TOK_PAPER', this.appThemeScheme);
    return readerFrameStyle({ backgroundColor: pageBackground,
      headerBackground: this.variant === 'settingsHome' ? pageBackground :
        readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme),
      footerBackground: pageBackground });
  }

  build() {
    ReaderPageScaffold({ frameStyle: this.frameStyle(),
      geometry: this.geometry,
      headerMeasurementKey: this.measurementKey,
      footerMeasurementKey: this.measurementKey,
      content: (): void => { this.scrollContent(); },
      header: (): void => { this.header(); }, footer: (): void => { this.footer(); },
      overlayContent: (): void => { this.overlayContent(this.geometry.content.startInset); },
      onHeaderHeightChange: (height: number, key: number): void => this.recordMeasurement('standard:header', height, key),
      onFooterHeightChange: (height: number, key: number): void => this.recordMeasurement('standard:footer', height, key),
    }).onAreaChange((_old: Area, next: Area): void => {
      if (!this.mounted) return;
      const width = readerPageAreaLength(next.width);
      const height = readerPageAreaLength(next.height);
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
      if (Math.abs(width - this.viewportWidth) <= .1 && Math.abs(height - this.viewportHeight) <= .1) return;
      this.viewportWidth = width;
      this.viewportHeight = height;
      this.onLayoutInputsChanged();
      this.onViewportChange(width, height);
    });
  }

  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.geometry);
  }

  @Builder private scrollContent() {
    ReaderPageScrollHost({ scroller: this.scroller, layout: this.scrollLayout(),
      content: (): void => { this.pageContent(); } });
  }

  @Builder private pageContent() {
    Column({ space: readerStandardPageSpec(this.variant).space }) { this.content(); }
      .width('100%').alignItems(HorizontalAlign.Start)
      .padding({ left: this.geometry.content.frame.left, right: this.geometry.content.frame.right });
  }
}
