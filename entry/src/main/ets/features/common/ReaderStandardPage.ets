import { ReaderPageScaffold } from './ReaderPageScaffold';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerPageInitialHeaderHeight } from './ReaderHeaderSpecs';
import { ReaderMeasurementStore } from './ReaderMeasurements';
import { ReaderPageGeometry, ReaderPageGeometryInput, resolveReaderPageGeometry } from './ReaderPageGeometry';
import { ReaderStandardPageVariant, readerStandardPageSpec,
  readerPageAreaLength, readerStandardPageContentEndInset, readerStandardPageFooterBottom,
  READER_STANDARD_PAGE_CONTENT_GAP } from './ReaderPageShell';
import { ReaderFrameStyle, readerFrameStyle } from './ReaderFrameStyle';
import { ReaderPageScrollHost } from './ReaderPageScrollHost';
import { ReaderScrollLayout, readerScrollLayout } from './ReaderScrollLayout';
import { readerAppColor } from './ReaderThemeRegistry';

/** Standard pages share the resolved page geometry, Scroll body, measured
 * header clearance and footer budget. Pages supply business builders only. */
@Component
export struct ReaderStandardPage {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop variant: ReaderStandardPageVariant = 'management';
  @State private measurementRevision: number = 0;
  @State private viewportWidth: number = 0;
  scroller: Scroller = new Scroller();
  @BuilderParam content: () => void = this.emptySlot;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam footer: () => void = this.emptySlot;
  @BuilderParam overlayContent: (contentStartInset: number) => void = this.emptyOverlaySlot;
  private readonly measurements: ReaderMeasurementStore = new ReaderMeasurementStore();
  @Builder private emptySlot() {}
  @Builder private emptyOverlaySlot(_contentStartInset: number) {}

  private measurementGeneration(): number {
    return Math.max(0, this.readerWindowMetricsRevision);
  }

  private headerHeight(): number {
    return this.measurements.read('standard:header', readerPageInitialHeaderHeight('standard'));
  }

  private footerHeight(): number {
    return this.measurements.read('standard:footer', 0);
  }

  private pageGeometry(): ReaderPageGeometry {
    const metrics = ReaderWindowCoordinator.metrics();
    const input = new ReaderPageGeometryInput(metrics);
    input.viewportWidth = this.viewportWidth;
    input.measurementRevision = this.measurementRevision;
    input.headerHeight = this.headerHeight();
    input.contentGap = READER_STANDARD_PAGE_CONTENT_GAP;
    input.footerHeight = this.footerHeight();
    input.footerBottom = readerStandardPageFooterBottom(this.variant, metrics);
    input.contentEndInset = readerStandardPageContentEndInset(this.variant, metrics, this.footerHeight());
    input.contentMaxWidth = readerStandardPageSpec(this.variant).maxWidth;
    input.contentHorizontalPadding = 19;
    return resolveReaderPageGeometry(input);
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
      geometry: this.pageGeometry(),
      headerMeasurementKey: this.measurementGeneration(),
      footerMeasurementKey: this.measurementGeneration(),
      content: (): void => { this.scrollContent(); },
      header: (): void => { this.header(); }, footer: (): void => { this.footer(); },
      overlayContent: (): void => { this.overlayContent(this.pageGeometry().content.startInset); },
      onHeaderHeightChange: (height: number, presentedKey: number): void => {
        if (this.measurements.record('standard:header', height, presentedKey)) this.measurementRevision += 1;
      },
      onFooterHeightChange: (height: number): void => {
        if (this.measurements.record('standard:footer', height, this.measurementGeneration())) this.measurementRevision += 1;
      },
    }).onAreaChange((_old: Area, next: Area): void => {
      const width = readerPageAreaLength(next.width);
      if (Number.isFinite(width) && width > 0 && Math.abs(width - this.viewportWidth) > .1) this.viewportWidth = width;
    });
  }

  private scrollLayout(): ReaderScrollLayout {
    return readerScrollLayout(this.pageGeometry());
  }

  @Builder private scrollContent() {
    ReaderPageScrollHost({ scroller: this.scroller, layout: this.scrollLayout(),
      content: (): void => { this.pageContent(); } });
  }

  @Builder private pageContent() {
    Column({ space: readerStandardPageSpec(this.variant).space }) { this.content(); }
      .width('100%').alignItems(HorizontalAlign.Start)
      .padding({ left: this.pageGeometry().content.frame.left, right: this.pageGeometry().content.frame.right });
  }
}
