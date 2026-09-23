import { ReadingSurfaceLayoutMap } from './ReadingSurfaceLayoutMap';
import { FrameNode, NodeController } from '@ohos.arkui.node';
import { UIContext } from '@ohos.arkui.UIContext';
import { ReaderNativeTextMeasurement, ReaderNativeTextStyle } from './ReaderNativeTextMeasurement';
import { ReaderNativeTextWindow, ReaderNativeGlyphRect } from './ReaderNativeTextWindow';

let paragraphSerial: number = 0;
const paragraphResources: Map<string, ReaderNativeParagraphResource> = new Map();
export function readerNativeParagraphKey(): string { return `native-paragraph-${++paragraphSerial}`; }
export function readerNativeParagraphResource(key: string): ReaderNativeParagraphResource | undefined {
  return paragraphResources.get(key);
}

/** Plain reconstruction facts may cross a retained presentation boundary.
 * Platform nodes and UIContext never enter observed page state. */
export interface ReaderNativeParagraphRecipe {
  key: string;
  text: string;
  startScalar: number;
  firstLine: number;
  lastLine: number;
  wholeParagraph?: boolean;
  style: ReaderNativeTextStyle;
}

export interface ReaderNativeParagraphPosition {
  yForScalar: (scalar: number) => number;
  scalarForY: (yVp: number) => number;
}

export interface ReaderNativeParagraphPreparation {
  resource: ReaderNativeParagraphResource;
  position: ReaderNativeParagraphPosition;
  owned: boolean;
}

/** One mount owns one native parent. The page owner may release its interest
 * before ArkUI unmounts an outgoing slot; disposal waits for that last mount. */
export class ReaderNativeParagraphResource {
  private window: ReaderNativeTextWindow | undefined;
  private mounted: boolean = false;
  private retained: boolean = true;

  readonly layoutMap: ReadingSurfaceLayoutMap | undefined;

  constructor(window: ReaderNativeTextWindow, layoutMap?: ReadingSurfaceLayoutMap) {
    this.window = window; this.layoutMap = layoutMap;
  }

  claim(wholeParagraph: boolean = false, context?: UIContext,
    recipe?: ReaderNativeParagraphRecipe): ReaderNativeTextWindow | undefined {
    if (this.mounted || this.window === undefined) return undefined;
    if (context !== undefined && recipe !== undefined &&
      !this.window.matchesGeometry(context, recipe.style, recipe.text)) return undefined;
    if (wholeParagraph && !this.window.coversWholeParagraph()) return undefined;
    this.mounted = true;
    return this.window;
  }

  prepareWholePosition(context: UIContext, recipe: ReaderNativeParagraphRecipe): ReaderNativeParagraphPosition | undefined {
    const window = this.window;
    if (!this.retained || this.mounted || window === undefined || !window.matchesGeometry(context, recipe.style, recipe.text) ||
      !window.prepareWholeParagraph()) return undefined;
    const map = this.layoutMap ?? new ReadingSurfaceLayoutMap(recipe.text);
    return {
      yForScalar: (scalar: number): number => {
        if (this.window !== window || !this.retained) return 0;
        return window.lineTopForUtf16(map.utf16ForScalar(Math.max(0,
          Math.min(map.scalarCount(), scalar - recipe.startScalar))));
      },
      scalarForY: (yVp: number): number => {
        if (this.window !== window || !this.retained) return recipe.startScalar;
        return recipe.startScalar + map.scalarForUtf16(window.lineStartForY(yVp));
      },
    };
  }

  unmount(): void {
    this.mounted = false;
    if (!this.retained) this.dispose();
  }

  release(): void {
    this.retained = false;
    if (!this.mounted) this.dispose();
  }

  private dispose(): void {
    const window = this.window;
    this.window = undefined;
    window?.close();
  }
}

/** Prepare one actual forthcoming row before List attaches. The resulting
 * resource is handed to that row, so position calculation has no shadow Text.
 * A live outgoing parent is never borrowed or modified. */
export function prepareReaderNativeParagraph(context: UIContext,
  recipe: ReaderNativeParagraphRecipe): ReaderNativeParagraphPreparation {
  const existing = readerNativeParagraphResource(recipe.key);
  const position = existing?.prepareWholePosition(context, recipe);
  if (existing !== undefined && position !== undefined) return { resource: existing, position, owned: false };
  const measurement = new ReaderNativeTextMeasurement();
  const controller = new TextController();
  let resource: ReaderNativeParagraphResource | undefined;
  try {
    measurement.measure(context, recipe.text, controller, recipe.style);
    const window = new ReaderNativeTextWindow(context, measurement.take(controller), controller,
      context.vp2px(recipe.style.widthVp));
    resource = new ReaderNativeParagraphResource(window, new ReadingSurfaceLayoutMap(recipe.text));
    const prepared = resource.prepareWholePosition(context, recipe);
    if (prepared === undefined) throw new Error('NATIVE_PARAGRAPH_INITIAL_GEOMETRY_UNAVAILABLE');
    return { resource, position: prepared, owned: true };
  } catch (error) {
    resource?.release();
    throw error as Error;
  } finally { measurement.clear(); }
}

/** Only page-owned resources live here. A scalar recipe is sufficient after
 * a normal cross-view handoff; an expired UIContext is never retained. */
export class ReaderNativeParagraphResources {
  private readonly entries: Map<string, ReaderNativeParagraphResource> = new Map();

  set(key: string, window: ReaderNativeTextWindow, layoutMap?: ReadingSurfaceLayoutMap): void {
    this.entries.get(key)?.release();
    const resource = new ReaderNativeParagraphResource(window, layoutMap);
    this.entries.set(key, resource);
    paragraphResources.set(key, resource);
  }

  get(key: string): ReaderNativeParagraphResource | undefined { return this.entries.get(key); }

  retain(keys: Set<string>): void {
    for (const entry of this.entries) {
      if (keys.has(entry[0])) continue;
      this.entries.delete(entry[0]);
      if (paragraphResources.get(entry[0]) === entry[1]) paragraphResources.delete(entry[0]);
      entry[1].release();
    }
  }

  close(): void { this.retain(new Set<string>()); }
}

/** NodeContainer controller for exactly one physical paragraph window. */
export class ReaderNativeParagraphController extends NodeController {
  private window: ReaderNativeTextWindow | undefined;
  private resource: ReaderNativeParagraphResource | undefined;
  private owned: boolean = false;

  prepare(context: UIContext, recipe: ReaderNativeParagraphRecipe, gapVp: number,
    resource?: ReaderNativeParagraphResource): void {
    this.close();
    let lastLine = recipe.lastLine;
    const transferred = resource?.claim(recipe.wholeParagraph === true, context, recipe);
    if (transferred !== undefined) {
      this.resource = resource;
      this.window = transferred;
      if (recipe.wholeParagraph === true) lastLine = transferred.lineCount() - 1;
    } else {
      // Retained plain presentations and a simultaneous offscreen snapshot
      // require an independent parent. The same native paragraph engine and
      // unmodified source are used, never physical-row string reconstruction.
      const measurement = new ReaderNativeTextMeasurement();
      const controller = new TextController();
      try {
        measurement.measure(context, recipe.text, controller, recipe.style);
        if (recipe.wholeParagraph === true) lastLine = controller.getLayoutManager().getLineCount() - 1;
        this.window = new ReaderNativeTextWindow(context, measurement.take(controller), controller,
          context.vp2px(recipe.style.widthVp), recipe.firstLine, lastLine);
        this.owned = true;
      } finally { measurement.clear(); }
    }
    try {
      this.window.configure(recipe.firstLine, lastLine, 0);
      const baseHeight = this.window.clipHeightVp();
      const gaps = lastLine - recipe.firstLine;
      if (gapVp > 0 && gaps > 0) {
        this.window.configure(recipe.firstLine, lastLine, gapVp);
        const capacity = baseHeight + gaps * gapVp;
        const excess = this.window.clipHeightVp() - capacity;
        if (excess > 0.01) {
          this.window.configure(recipe.firstLine, lastLine, Math.max(0, gapVp - excess / gaps));
          // Fallback font ink is not a linear function of between-line space.
          // Never let optional bottom alignment crop the admitted last glyph.
          if (this.window.clipHeightVp() > capacity + 0.01)
            this.window.configure(recipe.firstLine, lastLine, 0);
        }
      }
    }
    catch (error) { this.close(); throw error as Error; }
    this.rebuild();
  }

  makeNode(_context: UIContext): FrameNode | null { return this.window?.frame() ?? null; }
  color(value: ResourceColor): void { this.window?.color(value); }
  heightVp(): number { return this.window?.clipHeightVp() ?? 0; }
  glyphRects(start: number, end: number): ReaderNativeGlyphRect[] { return this.window?.glyphRects(start, end) ?? []; }

  selection(enabled: boolean, background: ResourceColor, onCopy: (range: TextRange) => void): void {
    this.window?.selection(enabled, background, onCopy);
  }
  visibleStartUtf16(): number { return this.window?.visibleStartUtf16() ?? 0; }
  visibleEndUtf16(): number { return this.window?.visibleEndUtf16() ?? 0; }
  lineTopForUtf16(offset: number): number { return this.window?.lineTopForUtf16(offset) ?? 0; }
  lineStartForY(yVp: number): number { return this.window?.lineStartForY(yVp) ?? 0; }

  close(): void {
    const window = this.window, resource = this.resource, owned = this.owned;
    this.window = undefined;
    this.resource = undefined;
    this.owned = false;
    window?.selection(false, '#00000000', (_range: TextRange): void => {});
    // Rebind null before a formerly mounted root can be claimed elsewhere.
    this.rebuild();
    if (owned) window?.close();
    else resource?.unmount();
  }
}
