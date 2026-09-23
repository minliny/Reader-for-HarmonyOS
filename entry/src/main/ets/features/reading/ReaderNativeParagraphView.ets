import { ReaderNativeParagraphController, ReaderNativeParagraphRecipe, ReaderNativeParagraphResource, ReaderNativeParagraphPosition, readerNativeParagraphResource } from './ReaderNativeParagraph';
import { ReaderDynamicHighlightRect, readerHighlightCanvasColor } from './ReaderDynamicHighlight';
import { ReadingSurfaceLayoutMap } from './ReadingSurfaceLayoutMap';
import { readerSelectedOriginalText } from './ReaderTextSelectionProjection';
import { copyReaderSelection } from '../../app/ReaderClipboardHost';
import { readerNativeTextGeometryKey } from './ReaderNativeTextMeasurement';

/** A shaped paragraph stays intact through pagination, selection and TTS. */
@Component
export struct ReaderNativeParagraphView {
  @Prop @Watch('prepare') recipe: ReaderNativeParagraphRecipe;
  resourceProvider: (() => ReaderNativeParagraphResource | undefined) | undefined = undefined;
  @Prop @Watch('prepare') gapVp: number = 0;
  @Prop @Watch('updateInk') inkColor: ResourceColor = '#222222';
  @Prop @Watch('updateSelection') selectionEnabled: boolean = false;
  @Prop @Watch('updateSelection') selectionColor: ResourceColor = '#80667788';
  @Prop @Watch('updateHighlight') highlightStart: number | undefined = undefined;
  @Prop @Watch('updateHighlight') highlightEnd: number | undefined = undefined;
  @Prop @Watch('updateHighlight') highlightColor: string = '#222222';
  @Prop @Watch('updateHighlight') underline: boolean = false;
  queueHighlightMeasurement: ((action: () => void) => void) | undefined = undefined;
  onHighlightGeometry: (rects: ReaderDynamicHighlightRect[]) => void = (_rects): void => {};
  @Prop localHighlights: boolean = false;
  @Prop localHighlightViewportHeight: number = 0;
  onPositionResolver: (position: ReaderNativeParagraphPosition | undefined) => void = (_position): void => {};
  @State private heightVp: number = 0;
  private readonly controller: ReaderNativeParagraphController = new ReaderNativeParagraphController();
  private map: ReadingSurfaceLayoutMap | undefined;
  private mounted: boolean = false;
  private epoch: number = 0;
  private preparedKey: string = '';
  private x: number = 0;
  private y: number = 0;
  private localCanvas: CanvasRenderingContext2D | undefined;
  private localRects: ReaderDynamicHighlightRect[] = [];
  @State private localHighlightTop: number = 0;
  @State private localHighlightHeight: number = 0;

  aboutToAppear(): void { this.mounted = true; this.prepare(); }
  aboutToDisappear(): void {
    this.mounted = false; this.epoch += 1; this.preparedKey = '';
    this.controller.close(); this.map = undefined; this.onHighlightGeometry([]);
    this.onPositionResolver(undefined); this.localRects = []; this.localCanvas = undefined;
  }

  private prepare(): void {
    if (!this.mounted) return;
    const context = this.getUIContext();
    const key = `${this.recipe.key}:${this.recipe.firstLine}:${this.recipe.lastLine}:${this.recipe.wholeParagraph}:${this.gapVp}:` +
      `${readerNativeTextGeometryKey(this.recipe.style)}:${context.vp2px(1)}:${context.fp2px(1)}`;
    if (key === this.preparedKey) return;
    this.epoch += 1;
    const resource = this.resourceProvider?.() ?? readerNativeParagraphResource(this.recipe.key);
    this.controller.prepare(context, this.recipe, this.gapVp, resource);
    this.map = resource?.layoutMap ?? new ReadingSurfaceLayoutMap(this.recipe.text);
    this.heightVp = this.controller.heightVp();
    this.preparedKey = key;
    const epoch = this.epoch;
    this.onPositionResolver({
      yForScalar: (scalar: number): number => {
        if (!this.mounted || epoch !== this.epoch || this.map === undefined) return 0;
        const offset = Math.max(0, Math.min(this.map.scalarCount(), scalar - this.recipe.startScalar));
        return this.controller.lineTopForUtf16(this.map.utf16ForScalar(offset));
      },
      scalarForY: (yVp: number): number => {
        if (!this.mounted || epoch !== this.epoch || this.map === undefined) return this.recipe.startScalar;
        return this.recipe.startScalar + this.map.scalarForUtf16(this.controller.lineStartForY(yVp));
      },
    });
    this.updateInk(); this.updateSelection(); this.updateHighlight();
  }

  private updateInk(): void {
    if (this.mounted) this.controller.color(this.inkColor);
  }

  private updateSelection(): void {
    if (!this.mounted) return;
    const epoch = this.epoch;
    this.controller.selection(this.selectionEnabled, this.selectionColor, (range: TextRange): void => {
      if (!this.mounted || !this.selectionEnabled || epoch !== this.epoch) return;
      const original = readerSelectedOriginalText(this.recipe.text, 0, range.start, range.end,
        this.controller.visibleStartUtf16(), this.controller.visibleEndUtf16());
      if (original === undefined || original.length === 0) return;
      try { copyReaderSelection(original); }
      catch (_) { this.getUIContext().getPromptAction().showToast({ message: '复制失败，请重试' }); }
    });
  }

  private updateHighlight(): void {
    if (!this.mounted) return;
    const epoch = this.epoch;
    const action = (): void => {
      if (!this.mounted || epoch !== this.epoch || this.map === undefined) return;
      const rects: ReaderDynamicHighlightRect[] = [];
      const count = this.map.scalarCount();
      const start = Math.max(0, Math.min(count, (this.highlightStart ?? 0) - this.recipe.startScalar));
      const end = Math.max(start, Math.min(count, (this.highlightEnd ?? 0) - this.recipe.startScalar));
      if (end > start) {
        const context = this.getUIContext();
        for (const rect of this.controller.glyphRects(this.map.utf16ForScalar(start), this.map.utf16ForScalar(end))) {
          const bottom = this.y + context.px2vp(rect.bottom);
          rects.push({ left: this.x + context.px2vp(rect.left), right: this.x + context.px2vp(rect.right),
            top: this.underline ? bottom - 1.5 : this.y + context.px2vp(rect.top), bottom,
            color: this.highlightColor, multiply: !this.underline });
        }
      }
      this.onHighlightGeometry(rects);
      if (this.localHighlights) {
        this.localRects = rects.filter((rect: ReaderDynamicHighlightRect): boolean =>
          rect.bottom > 0 && rect.top < this.localHighlightViewportHeight);
        const top = this.localRects.reduce((value: number, rect: ReaderDynamicHighlightRect): number =>
          Math.min(value, Math.max(0, rect.top)), this.localHighlightViewportHeight);
        const bottom = this.localRects.reduce((value: number, rect: ReaderDynamicHighlightRect): number =>
          Math.max(value, Math.min(this.localHighlightViewportHeight, rect.bottom)), 0);
        this.localHighlightTop = Math.max(0, top - this.y);
        this.localHighlightHeight = Math.max(0, bottom - top);
        this.drawLocalHighlights();
      }
    };
    if (this.queueHighlightMeasurement !== undefined) this.queueHighlightMeasurement(action);
    else action();
  }

  private highlightCanvas(): CanvasRenderingContext2D {
    if (this.localCanvas === undefined) this.localCanvas = new CanvasRenderingContext2D(new RenderingContextSettings(true));
    return this.localCanvas;
  }

  private drawLocalHighlights(): void {
    const canvas = this.localCanvas;
    if (!this.mounted || !this.localHighlights || canvas === undefined) return;
    canvas.clearRect(0, 0, this.recipe.style.widthVp, this.localHighlightHeight);
    for (const rect of this.localRects) {
      canvas.fillStyle = readerHighlightCanvasColor(rect.color);
      canvas.fillRect(rect.left - this.x, rect.top - this.y - this.localHighlightTop,
        rect.right - rect.left, rect.bottom - rect.top);
    }
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
    NodeContainer(this.controller)
      .width('100%').height(this.heightVp)
      .onAreaChange((_old: Area, area: Area): void => {
        this.x = Number.parseFloat(`${area.globalPosition.x}`);
        this.y = Number.parseFloat(`${area.globalPosition.y}`);
        this.updateHighlight();
      });
      if (this.localHighlights && this.localHighlightHeight > 0) {
        Canvas(this.highlightCanvas()).width('100%').height(this.localHighlightHeight)
          .translate({ y: this.localHighlightTop })
          .blendMode(this.underline ? BlendMode.SRC_OVER : BlendMode.MULTIPLY)
          .hitTestBehavior(HitTestMode.None)
          .onReady((): void => this.drawLocalHighlights());
      }
    }.width('100%').height(this.heightVp);
  }
}
