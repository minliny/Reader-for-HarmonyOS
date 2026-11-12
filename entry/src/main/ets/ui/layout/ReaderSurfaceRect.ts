/** Window-space rectangles and identities supplied by the current surface owner. */
export interface ReaderSurfaceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReaderSurfaceRectIdentity {
  route: string;
  owner: string;
  generation: number;
}

export interface ReaderSurfaceRectReceipt {
  identity: ReaderSurfaceRectIdentity;
  rect: ReaderSurfaceRect;
}

export function readerSurfaceRectIdentityMatches(a: ReaderSurfaceRectIdentity,
  b: ReaderSurfaceRectIdentity): boolean {
  return a.route.length > 0 && a.owner.length > 0 && Number.isFinite(a.generation) &&
    a.route === b.route && a.owner === b.owner && a.generation === b.generation;
}

export function readerSurfaceRectValid(rect: ReaderSurfaceRect): boolean {
  return Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0;
}

/** Convert already measured window coordinates to the host's local coordinates.
 * Both rectangles must use the same unit and window coordinate system. */
export function readerSurfaceRectInHost(receipt: ReaderSurfaceRectReceipt,
  current: ReaderSurfaceRectIdentity, host: ReaderSurfaceRect): ReaderSurfaceRect | undefined {
  if (!readerSurfaceRectIdentityMatches(receipt.identity, current) ||
    !readerSurfaceRectValid(receipt.rect) || !readerSurfaceRectValid(host)) return undefined;
  return { x: receipt.rect.x - host.x, y: receipt.rect.y - host.y,
    width: receipt.rect.width, height: receipt.rect.height };
}
