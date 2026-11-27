export interface MangaViewportPoint { x: number; y: number; }

export function mangaPinchImagePoint(center: MangaViewportPoint, origin: MangaViewportPoint,
  size: MangaViewportPoint): MangaViewportPoint | undefined {
  if (![center.x, center.y, origin.x, origin.y, size.x, size.y].every(Number.isFinite) ||
    size.x <= 0 || size.y <= 0) return undefined;
  return { x: Math.max(0, Math.min(size.x, center.x - origin.x)),
    y: Math.max(0, Math.min(size.y, center.y - origin.y)) };
}

export function mangaPinchRestoreOffset(content: MangaViewportPoint, center: MangaViewportPoint): MangaViewportPoint {
  return { x: Math.max(0, content.x - center.x), y: content.y - center.y };
}

/** Compare native offsets only after the requested source point is measured. */
export function mangaPinchRestoreMatches(requested: MangaViewportPoint, actual: MangaViewportPoint,
  maximumX: number, atStart: boolean, atEnd: boolean): boolean {
  if (![requested.x, requested.y, actual.x, actual.y, maximumX].every(Number.isFinite) || maximumX < 0) return false;
  const expectedX = Math.max(0, Math.min(maximumX, requested.x));
  const tolerance = 2;
  return Math.abs(actual.x - expectedX) <= tolerance &&
    (Math.abs(actual.y - requested.y) <= tolerance || (atStart && actual.y < requested.y) ||
      (atEnd && actual.y > requested.y));
}
