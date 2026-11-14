import { ReaderPageScaffold } from './ReaderPageScaffold';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../foundation/ReaderWindowMetrics';
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
  @Prop scrollOwner: 'page' | 'native-list' = 'page';
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private measurementKey: number = 0;
  @State private footerMeasurementKey: number = 0;
  private headerInputs: string = '';
  private footerInputs: string = '';
  private geometryRevision: number = 0;
  private viewportWidth: number = 0;
  private viewportHeight: number = 0;
  private mounted: boolean = false;
  onViewportChange: (width: number, height: number) => void = (_width: number, _height: number): void => {};
  scroller: Scroller = new Scroller();
  @BuilderParam content: () => void = this.emptySlot;
  @BuilderParam nativeListItems: () => void = this.emptySlot;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam footer: () => void = this.emptySlot;
  @BuilderParam overlayContent: (contentStartInset: number) => void = this.emptyOverlaySlot;
  @Prop boundedOverlayVisible: boolean = false;
  @BuilderParam boundedOverlayContent: () => void = this.emptySlot;
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
    this.headerInputs = '';
    this.footerInputs = '';
    this.viewportWidth = 0;
    this.viewportHeight = 0;
  }

  private onLayoutInputsChanged(): void {
    if (!this.mounted) return;
    const metrics = readerWindowMetrics();
    const width = this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width;
    const headerInputs = JSON.stringify([width, metrics.systemFontScale, metrics.densityPixels, metrics.ready,
      readerInteractiveSafeLeft(metrics), readerInteractiveSafeRight(metrics), this.variant]);
    const footerInputs = JSON.stringify([headerInputs, this.contentLeadingRail > 0,
      readerStandardPageFooterBottom(this.variant, metrics)]);
    if (headerInputs !== this.headerInputs) {
      this.headerInputs = headerInputs;
      this.measurementKey += 1;
    }
    if (footerInputs !== this.footerInputs) {
      this.footerInputs = footerInputs;
      this.footerMeasurementKey += 1;
    }
    this.refreshGeometry();
  }

  private recordMeasurement(slot: string, height: number, presentedKey: number): void {
    const currentKey = slot === 'standard:footer' ? this.footerMeasurementKey : this.measurementKey;
    if (!this.mounted || presentedKey !== currentKey || (slot === 'standard:footer' && this.contentLeadingRail > 0)) return;
    if (this.measurements.record(slot, height, presentedKey)) this.refreshGeometry();
  }

  private headerHeight(): number {
    return this.measurements.readForGeneration('standard:header', this.measurementKey, APP_HEADER_BAR_HEIGHT);
  }

  private footerHeight(): number {
    return this.contentLeadingRail > 0 ? 0 : this.measurements.readForGeneration('standard:footer', this.footerMeasurementKey, 0);
  }

  private refreshGeometry(): void {
    const metrics = readerWindowMetrics();
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

  private overlayAvailableHeight(): number {
    const geometry = this.geometry;
    if (this.viewportHeight <= 0) return 0;
    const contentBottom = this.viewportHeight - Math.max(geometry.content.endInset, geometry.content.nativeEndInset);
    return Math.max(0, Math.min(contentBottom, geometry.footer.top) - geometry.content.startInset);
  }

  @Builder
  private pageOverlay() {
    this.overlayContent(this.geometry.content.startInset);
    if (this.boundedOverlayVisible && this.overlayAvailableHeight() > 0) {
      Scroll() { Column({ space: 8 }) { this.boundedOverlayContent(); }.width('100%'); }
        .width(this.geometry.content.frame.width).constraintSize({ maxHeight: this.overlayAvailableHeight() })
        .margin({ left: this.geometry.content.frame.left, right: this.geometry.content.frame.right, top: this.geometry.content.startInset })
        .scrollBar(BarState.Auto).clip(true).hitTestBehavior(HitTestMode.Default)
        .onTouch((event: TouchEvent): void => event.stopPropagation());
    }
  }

  build() {
    ReaderPageScaffold({ frameStyle: this.frameStyle(),
      geometry: this.geometry,
      headerMeasurementKey: this.measurementKey,
      footerMeasurementKey: this.footerMeasurementKey,
      content: (): void => { this.pageBody(); },
      header: (): void => { this.header(); }, footer: (): void => { this.footer(); },
      overlayContent: (): void => { this.pageOverlay(); },
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

  @Builder private pageBody() {
    if (this.scrollOwner === 'native-list') {
      List({ scroller: this.scroller }) { this.nativeListItems(); }
        .width('100%').height('100%')
        .contentStartOffset(this.geometry.content.startInset)
        .contentEndOffset(this.geometry.content.endInset)
        .padding({ left: this.geometry.content.frame.left, right: this.geometry.content.frame.right })
        .scrollBar(BarState.Off).clip(true);
    } else {
      this.scrollContent();
    }
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
