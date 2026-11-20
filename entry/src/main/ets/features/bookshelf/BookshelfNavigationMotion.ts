/** Window-space vp at the actual cover, never a cached card index or click point. */
export interface BookshelfMotionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BookshelfBookOrigin {
  sourceId: string;
  bookId: string;
  coverUrl: string;
  title: string;
  rect: BookshelfMotionRect;
  radius: number;
}

/** All geometry in a request is local to the padding-free visual host. */
export interface BookshelfMotionRequest {
  id: number;
  direction: 'open' | 'close';
  origin: BookshelfBookOrigin;
  target: BookshelfMotionRect;
  awaitingOrigin?: boolean;
  fadeOnly?: boolean;
  reversed?: boolean;
  paperColor: string;
  paperInk: string;
}

export interface BookshelfPaperPalette {
  color: string;
  ink: string;
}

/** The full local motion host, used as the open/close target surface. */
export function shelfMotionWindowRect(viewport: BookshelfMotionRect): BookshelfMotionRect {
  return { x: 0, y: 0, width: viewport.width, height: viewport.height };
}

/** The actor and its hinge share this host-local target rectangle. */
export function bookshelfMotionTarget(request: BookshelfMotionRequest): BookshelfMotionRect {
  return request.target;
}

export function bookshelfMotionRectAt(request: BookshelfMotionRequest, progress: number): BookshelfMotionRect {
  const p = Math.max(0, Math.min(1, progress));
  const source = request.origin.rect;
  const target = bookshelfMotionTarget(request);
  return { x: source.x + (target.x - source.x) * p, y: source.y + (target.y - source.y) * p,
    width: source.width + (target.width - source.width) * p,
    height: source.height + (target.height - source.height) * p };
}

export interface BookshelfMotionTransform {
  rect: BookshelfMotionRect;
  sx: number;
  sy: number;
  imageScaleX: number;
  imageScaleY: number;
  radiusX: number;
  radiusY: number;
}

/** Fixed target-size layout: compensate the outer scale so a centered Contain
 * bitmap remains undistorted and covers the current panel, like ObjectFit.Cover.
 * The request owner supplies valid positive source and target rectangles. */
export function bookshelfMotionTransformAt(request: BookshelfMotionRequest, carry: number,
  imageAspect: number): BookshelfMotionTransform {
  const p = Number.isFinite(carry) ? Math.max(0, Math.min(1, carry)) : 0;
  const rect = bookshelfMotionRectAt(request, p);
  const target = bookshelfMotionTarget(request);
  const sx = rect.width / target.width;
  const sy = rect.height / target.height;
  const aspect = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect :
    request.origin.rect.width / request.origin.rect.height;
  const baseWidth = Math.min(target.width, target.height * aspect);
  const baseHeight = Math.min(target.height, target.width / aspect);
  const imageScale = Math.max(rect.width / baseWidth, rect.height / baseHeight);
  const radius = request.origin.radius * (1 - p);
  return { rect, sx, sy, imageScaleX: imageScale / sx, imageScaleY: imageScale / sy,
    radiusX: radius / sx, radiusY: radius / sy };
}

export function bookshelfMotionBookKey(sourceId: string, bookId: string): string {
  return JSON.stringify([sourceId, bookId]);
}

export function bookshelfMotionRectValid(rect: BookshelfMotionRect): boolean {
  return Number.isFinite(rect.x) && Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0;
}

/** A return may animate only to a currently visible cover for the same identity. */
export function bookshelfMotionOriginFits(origin: BookshelfBookOrigin, viewport: BookshelfMotionRect): boolean {
  return bookshelfMotionRectValid(origin.rect) && bookshelfMotionRectValid(viewport) &&
    origin.rect.x >= viewport.x - 1 && origin.rect.y >= viewport.y - 1 &&
    origin.rect.x + origin.rect.width <= viewport.x + viewport.width + 1 &&
    origin.rect.y + origin.rect.height <= viewport.y + viewport.height + 1;
}

export function bookshelfMotionLocalOrigin(origin: BookshelfBookOrigin, viewport: BookshelfMotionRect): BookshelfBookOrigin {
  return { sourceId: origin.sourceId, bookId: origin.bookId, coverUrl: origin.coverUrl, title: origin.title,
    radius: origin.radius, rect: { x: origin.rect.x - viewport.x, y: origin.rect.y - viewport.y,
      width: origin.rect.width, height: origin.rect.height } };
}
