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
  awaitingTarget?: boolean;
  fadeOnly?: boolean;
}

/** The actor and its hinge share this measured page-local rectangle. */
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
