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

export interface BookshelfMotionPaint {
  rect: BookshelfMotionRect;
  radius: number;
  angle: number;
  coverOpacity: number;
  readerOpacity: number;
  shelfOpacity: number;
  shelfScale: number;
  shelfBrightness: number;
}

function bookshelfMotionTrack(progress: number, from: number, to: number, start: number, end: number,
  curve: (fraction: number) => number): number {
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)));
  return from + (to - from) * curve(t);
}

/** All tracks sample one direction-independent authored phase. */
export function bookshelfMotionPaint(request: BookshelfMotionRequest, phase: number,
  carryCurve: (fraction: number) => number, spineCurve: (fraction: number) => number): BookshelfMotionPaint {
  const p = Math.max(0, Math.min(1, phase));
  const carry = carryCurve(p);
  let angle: number;
  if (p < 0.12) angle = bookshelfMotionTrack(p, 0, -10, 0, 0.12, spineCurve);
  else if (p < 0.56) angle = bookshelfMotionTrack(p, -10, -82, 0.12, 0.56, spineCurve);
  else if (p < 0.88) angle = bookshelfMotionTrack(p, -82, -116, 0.56, 0.88, spineCurve);
  else angle = bookshelfMotionTrack(p, -116, -122, 0.88, 1, spineCurve);
  return {
    rect: bookshelfMotionRectAt(request, carry),
    radius: request.origin.radius * (1 - carry),
    angle,
    coverOpacity: p < 0.56 ? bookshelfMotionTrack(p, 1, 0.95, 0.12, 0.56, spineCurve) :
      bookshelfMotionTrack(p, 0.95, 0, 0.56, 0.88, spineCurve),
    readerOpacity: carry,
    shelfOpacity: p < 0.75 ? bookshelfMotionTrack(p, 1, 0.9, 0, 0.75, carryCurve) :
      bookshelfMotionTrack(p, 0.9, 0, 0.75, 1, carryCurve),
    shelfScale: p < 0.75 ? bookshelfMotionTrack(p, 1, 0.978, 0, 0.75, carryCurve) :
      bookshelfMotionTrack(p, 0.978, 0.97, 0.75, 1, carryCurve),
    shelfBrightness: p < 0.75 ? bookshelfMotionTrack(p, 1, 0.68, 0, 0.75, carryCurve) :
      bookshelfMotionTrack(p, 0.68, 0.6, 0.75, 1, carryCurve),
  };
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
