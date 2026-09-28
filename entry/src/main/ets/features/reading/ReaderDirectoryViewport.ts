/** Session-only visible tree row. Fractions survive Quick/Full row-height
 * changes without trusting a virtual List's estimated total offset. */
export interface ReaderDirectoryViewportAnchor {
  bookId: string;
  navigationRevision: string;
  viewId: string;
  nodeId: string;
  visibleIndex: number;
  rowFraction: number;
}

const anchors: Map<string, ReaderDirectoryViewportAnchor> = new Map<string, ReaderDirectoryViewportAnchor>();

export function readerDirectoryViewportAnchor(bookId: string): ReaderDirectoryViewportAnchor | undefined {
  return anchors.get(bookId);
}

export function readerDirectorySaveViewportAnchor(anchor: ReaderDirectoryViewportAnchor): void {
  if (anchor.bookId.length === 0 || anchor.nodeId.length === 0 ||
    !Number.isSafeInteger(anchor.visibleIndex) || anchor.visibleIndex < 0 ||
    !Number.isFinite(anchor.rowFraction)) return;
  const retained: ReaderDirectoryViewportAnchor = { ...anchor,
    rowFraction: Math.max(0, Math.min(0.999999, anchor.rowFraction)) };
  // Refresh insertion order; keep only books visited in this UI session.
  anchors.delete(anchor.bookId);
  anchors.set(anchor.bookId, retained);
  if (anchors.size > 8) anchors.delete(anchors.keys().next().value as string);
}

export function readerDirectoryClearViewportAnchors(): void { anchors.clear(); }
