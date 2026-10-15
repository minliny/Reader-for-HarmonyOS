/** Native Image.onComplete payload. Component/content fields share the native
 * event's unit; no source pixels or vp layout coordinates are inspected here. */
export interface MangaNativeImageGeometry {
  width: number; height: number;
  componentWidth: number; componentHeight: number;
  loadingStatus: number;
  contentWidth: number; contentHeight: number;
  contentOffsetX: number; contentOffsetY: number;
}

export interface MangaImageOriginGeometryCheck {
  status: 'OPEN' | 'PASS' | 'FAIL';
  reason: 'missing' | 'not-decoded' | 'invalid-numeric-geometry' | 'destination-offset' | 'destination-size' | 'native-destination';
}

/** This checks only the destination inside Image. It is not proof of a
 * submitted frame, an ancestor's screen origin, or the source's first color. */
export function checkMangaImageOriginGeometry(event: MangaNativeImageGeometry | undefined): MangaImageOriginGeometryCheck {
  if (event === undefined) return { status: 'OPEN', reason: 'missing' };
  if (event.loadingStatus !== 1) return { status: 'OPEN', reason: 'not-decoded' };
  if (![event.width, event.height, event.componentWidth, event.componentHeight,
    event.contentWidth, event.contentHeight, event.contentOffsetX, event.contentOffsetY].every(Number.isFinite) ||
    event.width <= 0 || event.height <= 0 || event.componentWidth <= 0 || event.componentHeight <= 0 ||
    event.contentWidth <= 0 || event.contentHeight <= 0) {
    return { status: 'OPEN', reason: 'invalid-numeric-geometry' };
  }
  // Half a native unit tolerates subpixel rounding; it does not subtract any
  // status/gesture height or transform the reported destination rectangle.
  if (Math.abs(event.contentOffsetX) > 0.5 || Math.abs(event.contentOffsetY) > 0.5)
    return { status: 'FAIL', reason: 'destination-offset' };
  if (Math.abs(event.contentWidth - event.componentWidth) > 0.5 ||
    Math.abs(event.contentHeight - event.componentHeight) > 0.5)
    return { status: 'FAIL', reason: 'destination-size' };
  return { status: 'PASS', reason: 'native-destination' };
}
