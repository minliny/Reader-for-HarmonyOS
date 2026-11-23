import { typeNode, LengthMetrics } from '@ohos.arkui.node';
import { UIContext } from '@ohos.arkui.UIContext';

export interface ReaderNativeTextStyle {
  widthVp: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number | FontWeight | string;
  lineHeight: number;
  letterSpacing: number;
  color: ResourceColor;
  alignment: TextAlign;
  breakAll: boolean;
  indentVp?: number;
  direction?: Direction;
  extraLineSpacingVp?: number;
}

// Identity belongs to the shaped node, not to a later presentation recipe.
// Ink is deliberately absent: changing theme must not invalidate geometry.
const nativeTextGeometry: WeakMap<typeNode.Text, string> = new WeakMap();
const nativeTextContent: WeakMap<typeNode.Text, string> = new WeakMap();
export function readerNativeTextGeometryKey(style: ReaderNativeTextStyle): string {
  return JSON.stringify([style.widthVp, style.fontFamily, style.fontSize, style.fontWeight,
    style.lineHeight, style.letterSpacing, style.alignment, style.breakAll,
    style.indentVp ?? 0, style.direction ?? null, style.extraLineSpacingVp ?? 0]);
}
export function readerNativeTextNodeGeometry(node: typeNode.Text): string | undefined {
  return nativeTextGeometry.get(node);
}
export function readerNativeTextNodeContent(node: typeNode.Text): string | undefined {
  return nativeTextContent.get(node);
}

/** Bounded platform adapter. Text shaping remains entirely in ArkUI, using
 * the same attributes and original measurement string as the former tree.
 * The caller must have completed font loading before entering this owner. */
export class ReaderNativeTextMeasurement {
  private nodes: typeNode.Text[] = [];
  private controllers: TextController[] = [];

  measure(context: UIContext, content: string, controller: TextController, style: ReaderNativeTextStyle): void {
    if (!Number.isFinite(style.widthVp) || style.widthVp <= 0) throw new Error('NATIVE_TEXT_WIDTH_INVALID');
    const node = typeNode.createNode(context, 'Text');
    this.nodes.push(node);
    this.controllers.push(controller);
    try {
      node.initialize(content, { controller });
      node.attribute.width(style.widthVp).fontFamily(style.fontFamily)
        .fontWeight(style.fontWeight).fontSize(style.fontSize).lineHeight(style.lineHeight)
        .letterSpacing(style.letterSpacing).fontColor(style.color).textAlign(style.alignment);
      if (style.breakAll) node.attribute.wordBreak(WordBreak.BREAK_ALL);
      if (style.indentVp !== undefined) node.attribute.textIndent(style.indentVp);
      if (style.direction !== undefined) node.attribute.direction(style.direction);
      if (style.extraLineSpacingVp !== undefined) node.attribute.lineSpacing(
        LengthMetrics.vp(style.extraLineSpacingVp), { onlyBetweenLines: true });
      const width = context.vp2px(style.widthVp);
      node.measure({ minSize: { width, height: 0 }, maxSize: { width, height: 1048576 },
        percentReference: { width, height: 1048576 } });
      node.layout({ x: 0, y: 0 });
      if (controller.getLayoutManager().getLineCount() === 0) throw new Error('NATIVE_TEXT_LAYOUT_UNAVAILABLE');
      nativeTextGeometry.set(node, readerNativeTextGeometryKey(style));
      nativeTextContent.set(node, content);
    } catch (error) {
      this.clear();
      throw error as Error;
    }
  }

  /** Transfers the measured node, not its text or a rebuilt display tree.
   * The recipient must detach and dispose it; clear owns only untaken nodes. */
  take(controller: TextController): typeNode.Text {
    const index = this.controllers.indexOf(controller);
    if (index < 0) throw new Error('NATIVE_TEXT_OWNERSHIP_MISSING');
    this.controllers.splice(index, 1);
    return this.nodes.splice(index, 1)[0];
  }

  clear(): void {
    for (const node of this.nodes) node.dispose();
    this.nodes = [];
    this.controllers = [];
  }
}
