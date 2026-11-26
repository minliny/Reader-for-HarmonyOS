import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { ReaderInsetsVp, ReaderRectVp } from '../foundation/ReaderWindowMetrics';
import { readerOverlayViewport } from '../layout/ReaderOverlayGeometry';

/** Center natural dialog content in a full-window overlay's usable region.
 * The same viewport becomes scrollable when the keyboard or text size makes a dialog taller. */
@Component
export struct ReaderDialogViewport {
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop edgeGapY: number = 12;
  @Prop nativeId: string = '';
  @Prop host: ReaderRectVp | undefined = undefined;
  scroller: Scroller = new Scroller();
  onScrollAppeared: () => void = (): void => {};
  onScrollDisappeared: () => void = (): void => {};
  onScrollChanged: () => void = (): void => {};
  @BuilderParam content: (widthVp: number, heightVp: number) => void = this.emptyContent;

  private viewport(): ReaderRectVp {
    this.metricsRevision;
    return readerOverlayViewport(readerWindowMetrics(), this.host, new ReaderInsetsVp(0, this.edgeGapY, 0, this.edgeGapY));
  }

  @Builder private emptyContent(_widthVp: number, _heightVp: number) {}

  build() {
    if (this.viewport().width > 0 && this.viewport().height > 0) {
      Scroll(this.scroller) {
        Column() {
          this.content(this.viewport().width, this.viewport().height);
        }.width('100%').constraintSize({ minHeight: this.viewport().height })
          .justifyContent(FlexAlign.Center).hitTestBehavior(HitTestMode.Transparent);
      }.id(this.nativeId).width(this.viewport().width).height(this.viewport().height)
        .position({ x: this.viewport().left - (this.host?.left ?? 0), y: this.viewport().top - (this.host?.top ?? 0) })
        .clip(true).scrollBar(BarState.Auto).hitTestBehavior(HitTestMode.Transparent)
        .onAppear((): void => this.onScrollAppeared())
        .onDisAppear((): void => this.onScrollDisappeared())
        .onAreaChange((): void => this.onScrollChanged());
    }
  }
}
