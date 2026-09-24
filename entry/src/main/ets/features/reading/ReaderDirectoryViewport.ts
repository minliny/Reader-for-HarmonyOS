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
const scrollIntentObservers: Map<string, Set<() => void>> = new Map<string, Set<() => void>>();
const scrollCommandObservers: Map<string, Set<() => void>> = new Map<string, Set<() => void>>();

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

/** Toolbar Top/Bottom is user navigation even though List does not report a
 * native drag. Notify the mounted tree before Scroller moves its viewport. */
export function readerDirectoryObserveScrollIntent(bookId: string, onIntent: () => void): () => void {
  let observers = scrollIntentObservers.get(bookId);
  if (observers === undefined) {
    observers = new Set<() => void>();
    scrollIntentObservers.set(bookId, observers);
  }
  observers.add(onIntent);
  return (): void => {
    observers?.delete(onIntent);
    if (observers?.size === 0) scrollIntentObservers.delete(bookId);
  };
}

export function readerDirectorySignalScrollIntent(bookId: string): void {
  scrollIntentObservers.get(bookId)?.forEach((onIntent: () => void): void => onIntent());
}

/** Called after a toolbar's synchronous scrollEdge command. A List also
 * receives native onScrollStop for real motion; this covers an edge no-op. */
export function readerDirectoryObserveScrollCommand(bookId: string, onCommand: () => void): () => void {
  let observers = scrollCommandObservers.get(bookId);
  if (observers === undefined) {
    observers = new Set<() => void>();
    scrollCommandObservers.set(bookId, observers);
  }
  observers.add(onCommand);
  return (): void => {
    observers?.delete(onCommand);
    if (observers?.size === 0) scrollCommandObservers.delete(bookId);
  };
}

export function readerDirectorySignalScrollCommand(bookId: string): void {
  scrollCommandObservers.get(bookId)?.forEach((onCommand: () => void): void => onCommand());
}
