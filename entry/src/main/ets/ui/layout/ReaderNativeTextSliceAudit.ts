import type { LayoutInvariantRect } from './LayoutInvariantEvaluator';

interface LayoutNativeTextSlice {
  readonly ownerId: number;
  readonly inkInText: LayoutInvariantRect;
  readonly clipRightOutsetVp: number;
}

interface LayoutNativeTextSlicePaint {
  readonly bounds: LayoutInvariantRect;
  readonly parentBounds: LayoutInvariantRect;
}

/** Admitted glyph ink for a mounted partial native paragraph. The owner
 * records uncut ink in Text coordinates and retires it before node disposal. */
export class ReaderNativeTextSliceAudit {
  private readonly slices: Map<number, LayoutNativeTextSlice> = new Map<number, LayoutNativeTextSlice>();

  publish(textId: number, ownerId: number, inkInText: LayoutInvariantRect, clipRightOutsetVp: number): void {
    this.slices.set(textId, { ownerId, inkInText, clipRightOutsetVp });
  }

  retire(textId: number): void {
    this.slices.delete(textId);
  }

  project(textId: number, parentKey: string, textFrame?: LayoutInvariantRect,
    ownerFrame?: LayoutInvariantRect): LayoutNativeTextSlicePaint | undefined {
    const slice = this.slices.get(textId);
    if (slice === undefined || slice.ownerId.toString() !== parentKey || textFrame === undefined || ownerFrame === undefined)
      return undefined;
    const ink = slice.inkInText;
    return {
      bounds: { x: textFrame.x + ink.x, y: textFrame.y + ink.y, width: ink.width, height: ink.height },
      parentBounds: { x: ownerFrame.x, y: ownerFrame.y,
        width: ownerFrame.width + slice.clipRightOutsetVp, height: ownerFrame.height },
    };
  }
}

export const readerNativeTextSliceAudit = new ReaderNativeTextSliceAudit();
