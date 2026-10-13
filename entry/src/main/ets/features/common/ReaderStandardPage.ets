import { ReaderPageScaffold } from './ReaderPageScaffold';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { SurfaceHorizontalFrame } from './SurfaceHorizontalGeometry';
import { ReaderStandardPageVariant, readerStandardPageSpec, readerStandardPageContentFrame,
  readerPageAreaLength, readerPageContentStartInset, readerStandardPageContentEndInset, readerStandardPageFooterBottom } from './ReaderPageShell';

/** Standard pages share actual Scroll/Column, measured header clearance,
 * horizontal geometry and footer budget. Pages supply business builders. */
@Component
export struct ReaderStandardPage {
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop variant: ReaderStandardPageVariant = 'management';
  @State private headerHeight: number = readerPageContentStartInset();
  @State private footerHeight: number = 0;
  @State private viewportWidth: number = 0;
  scroller: Scroller = new Scroller();
  @BuilderParam content: () => void = this.emptySlot;
  @BuilderParam header: () => void = this.emptySlot;
  @BuilderParam footer: () => void = this.emptySlot;
  @BuilderParam overlayContent: () => void = this.emptySlot;
  @Builder private emptySlot() {}

  build() {
    ReaderPageScaffold({ variant: 'standard', headerKind: this.variant === 'settingsHome' ? 'home' : 'standard',
      content: (): void => { this.scrollContent(); },
      header: (): void => { this.header(); }, footer: (): void => { this.footer(); }, overlayContent: (): void => { this.overlayContent(); },
      footerBottom: readerStandardPageFooterBottom(this.variant, ReaderWindowCoordinator.metrics()),
      onHeaderHeightChange: (height: number): void => { if (height > 0 && Math.abs(height - this.headerHeight) > .1) this.headerHeight = height; },
      onFooterHeightChange: (height: number): void => { if (Math.abs(height - this.footerHeight) > .1) this.footerHeight = height; },
    }).onAreaChange((_old: Area, next: Area): void => {
      const width = readerPageAreaLength(next.width);
      if (Number.isFinite(width) && width > 0 && Math.abs(width - this.viewportWidth) > .1) this.viewportWidth = width;
    });
  }

  @Builder private scrollContent() {
    Scroll(this.scroller) {
      Column({ space: readerStandardPageSpec(this.variant).space }) { this.content(); }
        .width('100%').alignItems(HorizontalAlign.Start)
        .padding({ left: this.contentFrame().left, right: this.contentFrame().right,
          top: readerPageContentStartInset(this.headerHeight, 0, 8),
          bottom: readerStandardPageContentEndInset(this.variant, ReaderWindowCoordinator.metrics(), this.footerHeight) });
    }.width('100%').height('100%').align(Alignment.TopStart).scrollBar(BarState.Off);
  }

  private contentFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) return new SurfaceHorizontalFrame(0, 0, 0);
    const metrics = ReaderWindowCoordinator.metrics();
    return readerStandardPageContentFrame(this.variant, metrics, this.viewportWidth > 0 ? this.viewportWidth : metrics.windowRect.width);
  }
}
