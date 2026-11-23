import { readerRaisedSurfaceSpec, ReaderShadowLayerSpec } from './ReaderSurfaceSpecs';
import { readerAppColor } from '../foundation/ReaderThemeRegistry';
import { ReaderRaisedShape, resolveReaderRaisedShape } from '../layout/ReaderRaisedShape';

/** Shadow-only child of the surface owner's Stack. The owner supplies measured
 * vp geometry and paints its own material; this absolute Canvas takes no space. */
@Component
export struct ReaderRaisedSurface {
  @Prop @Watch('onDrawingInputChanged') resolvedShape: ReaderRaisedShape | undefined = undefined;
  // The existing navigation rail is the sole legacy consumer. Phone owners
  // supply resolvedShape and never feed these raw geometry properties.
  @Prop @Watch('onDrawingInputChanged') surfaceWidth: number = 0;
  @Prop @Watch('onDrawingInputChanged') surfaceHeight: number = 0;
  @Prop @Watch('onDrawingInputChanged') cornerRadius: number = 0;
  @Prop @Watch('onDrawingInputChanged') scheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') @Watch('onDrawingInputChanged') private metricsRevision: number = 0;
  private context: CanvasRenderingContext2D = new CanvasRenderingContext2D(new RenderingContextSettings(true));
  private ready: boolean = false;

  private onDrawingInputChanged(): void { this.draw(); }

  private drawingShape(): ReaderRaisedShape | undefined {
    if (this.resolvedShape !== undefined) return this.resolvedShape;
    if (this.surfaceWidth <= 0 || this.surfaceHeight <= 0) return undefined;
    return resolveReaderRaisedShape('legacy-navigation-rail', this.surfaceWidth, this.surfaceHeight, this.cornerRadius);
  }

  private drawingWidth(): number { return this.drawingShape()?.width ?? 0; }
  private drawingHeight(): number { return this.drawingShape()?.height ?? 0; }

  private extent(value: number): number {
    return (Number.isFinite(value) ? Math.max(0, value) : 0) + 2 * readerRaisedSurfaceSpec().canvasOutsetVp;
  }

  private rounded(x: number, y: number, width: number, height: number, radius: number): void {
    this.context.beginPath();
    this.context.moveTo(x + radius, y);
    this.context.lineTo(x + width - radius, y);
    this.context.arcTo(x + width, y, x + width, y + radius, radius);
    this.context.lineTo(x + width, y + height - radius);
    this.context.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    this.context.lineTo(x + radius, y + height);
    this.context.arcTo(x, y + height, x, y + height - radius, radius);
    this.context.lineTo(x, y + radius);
    this.context.arcTo(x, y, x + radius, y, radius);
    this.context.closePath();
  }

  private layer(layer: ReaderShadowLayerSpec, shape: ReaderRaisedShape): void {
    const spec = readerRaisedSurfaceSpec();
    // The caster stays outside the bitmap; only its translated shadow enters.
    // Filling a spread caster in-place would leave an opaque outer ring.
    const casterShift = Math.max(spec.casterShiftVp, this.context.width + layer.spreadVp + 1);
    this.context.shadowBlur = this.getUIContext().vp2px(layer.radiusVp);
    this.context.shadowOffsetX = layer.offsetXVp - casterShift;
    this.context.shadowOffsetY = layer.offsetYVp;
    this.context.shadowColor = readerAppColor(layer.shadowRole, this.scheme);
    this.context.fillStyle = '#FF000000';
    this.rounded(spec.canvasOutsetVp + casterShift - layer.spreadVp,
      spec.canvasOutsetVp - layer.spreadVp,
      shape.width + 2 * layer.spreadVp, shape.height + 2 * layer.spreadVp,
      shape.radius + layer.spreadVp);
    this.context.fill();
  }

  private draw(): void {
    if (!this.ready) return;
    this.context.clearRect(0, 0, this.context.width, this.context.height);
    const shape = this.drawingShape();
    if (shape === undefined) return;
    const spec = readerRaisedSurfaceSpec();
    this.context.save();
    for (const layer of spec.layers) this.layer(layer, shape);
    this.context.shadowColor = '#00000000';
    this.context.shadowBlur = 0;
    this.context.shadowOffsetX = 0;
    this.context.shadowOffsetY = 0;
    this.context.globalCompositeOperation = 'destination-out';
    this.context.fillStyle = '#FF000000';
    this.rounded(spec.canvasOutsetVp, spec.canvasOutsetVp, shape.width, shape.height, shape.radius);
    this.context.fill();
    this.context.restore();
  }

  build() {
    // Native custom components still contribute an absolutely positioned root
    // Canvas to Stack measurement. A zero-sized host owns the layout boundary;
    // consumer modifiers address this host, preserving the Canvas's -48 offset.
    Stack({ alignContent: Alignment.TopStart }) {
      Canvas(this.context).width(this.extent(this.drawingWidth())).height(this.extent(this.drawingHeight()))
        .position({ x: -readerRaisedSurfaceSpec().canvasOutsetVp, y: -readerRaisedSurfaceSpec().canvasOutsetVp })
        .clip(false).hitTestBehavior(HitTestMode.None).accessibilityLevel('no-hide-descendants')
        .onReady((): void => { this.ready = true; this.draw(); })
        .onAreaChange((): void => this.draw());
    }.width(0).height(0).clip(false).hitTestBehavior(HitTestMode.None)
      .accessibilityLevel('no-hide-descendants');
  }
}
