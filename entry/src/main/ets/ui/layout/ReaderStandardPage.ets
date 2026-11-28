import { ReaderPageScaffold } from './ReaderPageScaffold';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { APP_FLOATING_HEADER_BAR_HEIGHT, APP_HEADER_BAR_HEIGHT } from '../foundation/ReaderHeaderMetrics';
import { ReaderMeasurementStore } from './ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, applyReaderStandardFloatingHeader, readerPageSafeLeft,
  readerPageSafeRight, resolveReaderPageGeometry } from './ReaderPageGeometry';
import { ReaderStandardPageVariant, readerStandardPageSpec,
  readerPageAreaLength, readerStandardPageContentEndInset, readerStandardPageFooterBottom,
  READER_STANDARD_PAGE_CONTENT_GAP } from './ReaderPageShell';
import { ReaderFrameStyle, readerFrameStyle } from './ReaderFrameStyle';
import { ReaderPageScrollHost } from './ReaderPageScrollHost';
import { ReaderScrollLayout, readerScrollLayout } from './ReaderScrollLayout';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { ReaderEditingVisibility } from './ReaderEditingVisibility';
import { ReaderEditingScrollBinding } from './ReaderEditingScrollBinding';

/** Standard pages share the resolved page geometry, Scroll body, measured
 * header clearance and footer budget. Pages supply business builders only. */
@Component
export struct ReaderStandardPage {
  @StorageLink('readerWindowMetricsRevision') @Watch('onLayoutInputsChanged') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop @Watch('onLayoutInputsChanged') variant: ReaderStandardPageVariant = 'management';
  @Prop @Watch('onLayoutInputsChanged') floatingHeader: boolean = false;
  @Prop @Watch('onLayoutInputsChanged') embeddedWide: boolean = false;
  @Prop @Watch('onLayoutInputsChanged') contentLeadingRail: number = 0;
  @Prop @Watch('onLayoutInputsChanged') contentEndInset: number = -1;
  @Prop @Watch('onLayoutInputsChanged') initialFooterHeight: number = 0;
  @Prop auditFooterDock: boolean = true;
  @Prop scrollOwner: 'page' | 'native-list' = 'page';
  @Prop initialScrollY: number = 0;
  @State private geometry: ReaderPageGeometry = new ReaderPageGeometry();
  @State private measurementKey: number = 0;
  @State private footerMeasurementKey: number = 0;
  private headerInputs: string = '';
  private footerInputs: string = '';
  private geometryRevision: number = 0;
  private viewportWidth: number = 0;
  private viewportHeight: number = 0;
  private viewportOriginX: number = 0;
  private mounted: boolean = false;
  onViewportChange: (width: number, height: number) => void = (_width: number, _height: number): void => {};
  scroller: Scroller = new Scroller();
  editingHost: ReaderEditingVisibility | undefined = undefined;
  private readonly editingScroll: ReaderEditingScrollBinding = new ReaderEditingScrollBinding();
  @BuilderParam content: () => void = this.emptySlot;
  @BuilderParam nativeListItems: () => void = this.emptySlot;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam footer: () => void = this.emptySlot;
  @BuilderParam overlayContent: (contentStartInset: number) => void = this.emptyOverlaySlot;
  @Prop boundedOverlayVisible: boolean = false;
  @Prop boundedOverlayLeadingReserve: number = 0;
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
    this.viewportOriginX = 0;
  }

  private onLayoutInputsChanged(): void {
    if (!this.mounted) return;
    const metrics = readerWindowMetrics();
    const width = this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width;
    const originX = this.embeddedWide ? this.viewportOriginX : undefined;
    const headerInputs = JSON.stringify([width, metrics.systemFontScale, metrics.densityPixels, metrics.ready,
      readerPageSafeLeft(metrics, originX, true), readerPageSafeRight(metrics, originX, this.viewportWidth, true),
      this.variant, this.floatingHeader]);
    const footerInputs = JSON.stringify([headerInputs, this.contentLeadingRail > 0,
      this.initialFooterHeight, readerStandardPageFooterBottom(this.variant, metrics)]);
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
    return this.measurements.readForGeneration('standard:header', this.measurementKey,
      this.floatingHeader ? APP_FLOATING_HEADER_BAR_HEIGHT : APP_HEADER_BAR_HEIGHT);
  }

  private footerHeight(): number {
    return this.contentLeadingRail > 0 ? 0 :
      this.measurements.readForGeneration('standard:footer', this.footerMeasurementKey, this.initialFooterHeight);
  }

  private refreshGeometry(): void {
    const metrics = readerWindowMetrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.viewportWidth;
    input.viewportHeight = this.viewportHeight;
    input.originX = this.embeddedWide ? this.viewportOriginX : undefined;
    input.measurementRevision = ++this.geometryRevision;
    input.headerHeight = this.headerHeight();
    if (this.floatingHeader) applyReaderStandardFloatingHeader(input);
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
      headerTransparent: this.floatingHeader,
      headerBackground: this.variant === 'settingsHome' ? pageBackground :
        readerAppColor('TOK_SURFACE_SOLID', this.appThemeScheme),
      footerBackground: pageBackground });
  }

  private overlayBottom(): number {
    const geometry = this.geometry;
    if (this.viewportHeight <= 0) return 0;
    const contentBottom = this.viewportHeight - Math.max(geometry.content.endInset, geometry.content.nativeEndInset);
    return Math.min(contentBottom, geometry.footer.top);
  }

  private overlayTop(): number {
    const start = this.geometry.content.startInset;
    const reserved = start + this.boundedOverlayLeadingReserve;
    // Keep a route to the pending operation on extremely short windows.
    return this.overlayBottom() - reserved >= 44 ? reserved : start;
  }

  @Builder
  private pageOverlay() {
    this.overlayContent(this.geometry.content.startInset);
    if (this.boundedOverlayVisible && this.overlayBottom() > this.overlayTop()) {
      Scroll() { Column({ space: 8 }) { this.boundedOverlayContent(); }.width('100%'); }
        .width(this.geometry.content.frame.width).constraintSize({ maxHeight: this.overlayBottom() - this.overlayTop() })
        .margin({ left: this.geometry.content.frame.left, right: this.geometry.content.frame.right, top: this.overlayTop() })
        .scrollBar(BarState.Auto).clip(true).hitTestBehavior(HitTestMode.Default)
        .onTouch((event: TouchEvent): void => event.stopPropagation());
    }
  }

  build() {
    ReaderPageScaffold({ frameStyle: this.frameStyle(),
      geometry: this.geometry,
      headerMeasurementKey: this.measurementKey,
      footerMeasurementKey: this.footerMeasurementKey,
      auditFooterDock: this.auditFooterDock,
      content: (): void => { this.pageBody(); },
      header: (): void => { this.header(); }, footer: (): void => { this.footer(); },
      overlayContent: (): void => { this.pageOverlay(); },
      onHeaderHeightChange: (height: number, key: number): void => this.recordMeasurement('standard:header', height, key),
      onFooterHeightChange: (height: number, key: number): void => this.recordMeasurement('standard:footer', height, key),
    }).onAreaChange((_old: Area, next: Area): void => {
      if (!this.mounted) return;
      const width = readerPageAreaLength(next.width);
      const height = readerPageAreaLength(next.height);
      const originX = readerPageAreaLength(next.globalPosition.x);
      if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return;
      if (Math.abs(width - this.viewportWidth) <= .1 && Math.abs(height - this.viewportHeight) <= .1 &&
        (!this.embeddedWide || Math.abs(originX - this.viewportOriginX) <= .1)) return;
      this.viewportWidth = width;
      this.viewportHeight = height;
      this.viewportOriginX = originX;
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
        .id(this.editingScroll.id)
        .onAppear((): void => this.editingScroll.mount(this.getUIContext(), this.editingHost, this.scroller,
          (): number => this.geometry.content.startInset))
        .onDisAppear((): void => this.editingScroll.unmount())
        .onAreaChange((): void => this.editingHost?.refresh())
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
    ReaderPageScrollHost({ scroller: this.scroller, layout: this.scrollLayout(), editingHost: this.editingHost,
      initialScrollY: this.initialScrollY,
      content: (): void => { this.pageContent(); } });
  }

  @Builder private pageContent() {
    Column({ space: readerStandardPageSpec(this.variant).space }) { this.content(); }
      .width('100%').alignItems(HorizontalAlign.Start)
      .padding({ left: this.geometry.content.frame.left, right: this.geometry.content.frame.right });
  }
}
