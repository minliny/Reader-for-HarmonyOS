import { FrameCallback } from '@kit.ArkUI';
import type { ShelfBook } from '../../../app/ReaderCoreGateway';
import { ReaderWindowCoordinator } from '../../../app/ReaderWindowCoordinator';
import { readerMeasureSurfaceRect } from '../../../ui/layout/ReaderSurfaceRectMeasurement';
import type { ReaderSurfaceRectIdentity } from '../../../ui/layout/ReaderSurfaceRect';
import type { ReadingBookDetail } from '../../reading/presentation/ReadingBookDetail';
import { resolveReaderReadingLayout } from '../../reading/ui/ReaderLayoutGeometry';
import { type BookshelfBookOrigin, type BookshelfMotionRect, type BookshelfMotionRequest,
  bookshelfMotionBookKey, bookshelfMotionOriginFits, bookshelfMotionLocalOrigin } from '../presentation/BookshelfNavigationMotion';

export interface BookshelfNavigationMotionScope {
  context: () => UIContext;
  route: () => string;
  readingOrigin: () => string;
  readingActive: () => boolean;
  book: () => ReadingBookDetail | undefined;
  contentKind: () => string;
  generation: () => number;
  expanded: () => boolean;
  completeReturn: (coveredMotionId?: number) => void;
}

class BookshelfNavigationFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void { this.action(); }
  onIdle(_remaining: number): void {}
}

/** Cover transition geometry and visual phases. The root owns reader admission and exit. */
@Observed
export class BookshelfNavigationPresentation {
  request: BookshelfMotionRequest | undefined = undefined;
  readerOpacity: number = 1;
  returnBookKey: string = '';
  private shelfMotionSequence: number = 0;
  private shelfMotionOrigin: BookshelfBookOrigin | undefined = undefined;
  private shelfMotionWindow: BookshelfMotionRect | undefined = undefined;
  private shelfMotionReturnNavigation: number = -1;
  pendingExitId: number = -1;
  private deferredShelfMotionProjection: (() => void) | undefined = undefined;
  private readonly scope: BookshelfNavigationMotionScope;

  constructor(scope: BookshelfNavigationMotionScope) { this.scope = scope; }

  clear(forgetOrigin: boolean, completeExit: boolean = true, flushProjection: boolean = true): void {
    const finishApprovedExit = completeExit && this.pendingExitId >= 0;
    const project = this.deferredShelfMotionProjection;
    this.pendingExitId = -1;
    this.deferredShelfMotionProjection = undefined;
    this.shelfMotionSequence += 1;
    this.request = undefined;
    this.readerOpacity = 1;
    this.returnBookKey = '';
    this.shelfMotionReturnNavigation = -1;
    if (forgetOrigin) {
      this.shelfMotionOrigin = undefined;
      this.shelfMotionWindow = undefined;
    }
    if (finishApprovedExit) this.scope.completeReturn();
    else if (flushProjection) project?.();
  }

  finish(id: number): void {
    if (this.request?.id !== id) return;
    if (this.pendingExitId === id) this.coverClosed(id);
    this.request = undefined;
    this.readerOpacity = 1;
    this.returnBookKey = '';
    const project = this.deferredShelfMotionProjection;
    this.deferredShelfMotionProjection = undefined;
    project?.();
  }

  retainsOpeningBackground(): boolean {
    return this.scope.route() === 'reading' && this.scope.readingOrigin() === 'bookshelf' &&
      this.request?.direction === 'open';
  }

  publishReaderOpacity(id: number, opacity: number): void {
    if (this.request?.id !== id || this.request.direction !== 'open' ||
      !this.scope.readingActive() || this.scope.route() !== 'reading' || !Number.isFinite(opacity)) return;
    const next = Math.max(0, Math.min(1, opacity));
    if (Math.abs(next - this.readerOpacity) > 0.0001) this.readerOpacity = next;
  }

  coverClosed(id: number): void {
    if (this.pendingExitId !== id || this.request?.id !== id) return;
    this.pendingExitId = -1;
    this.scope.completeReturn(id);
  }

  private shelfMotionViewport(): BookshelfMotionRect | undefined {
    try {
      const context = this.scope.context();
      const node = context.getFrameNodeById('reader-bookshelf-motion-host');
      if (node === null) return undefined;
      const component = context.getComponentUtils().getRectangleById('reader-bookshelf-motion-host');
      const position = node.getPositionToWindowWithTransform();
      const width = context.px2vp(component.size.width);
      const height = context.px2vp(component.size.height);
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y) ||
        !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return undefined;
      return { x: position.x, y: position.y, width, height };
    } catch (_error) {
      return undefined;
    }
  }

  private sameShelfMotionWindow(viewport: BookshelfMotionRect | undefined): boolean {
    const previous = this.shelfMotionWindow;
    return viewport !== undefined && previous !== undefined &&
      Math.abs(previous.x - viewport.x) < 1 && Math.abs(previous.y - viewport.y) < 1 &&
      Math.abs(previous.width - viewport.width) < 1 && Math.abs(previous.height - viewport.height) < 1;
  }

  windowChanged(): void {
    // Insets may change when the reader hides system bars. Only a changed
    // visual host invalidates the geometry; a stable full-window host does not.
    this.scope.context().postFrameCallback(new BookshelfNavigationFrame((): void => {
      // Compare the current request, even if a tap replaced it after this
      // layout notification. A new request may have measured the old layout.
      if (this.shelfMotionWindow === undefined) return;
      if (!this.sameShelfMotionWindow(this.shelfMotionViewport())) this.clear(true);
    }));
  }

  private shelfMotionPageFallback(viewport: BookshelfMotionRect): BookshelfMotionRect {
    const layout = resolveReaderReadingLayout(viewport.width, viewport.height, this.scope.expanded(),
      ReaderWindowCoordinator.metrics());
    return { x: layout.contentLeft, y: layout.contentTop, width: layout.bodyWidth(),
      height: layout.bodyHeight(false) };
  }

  private shelfMotionPageIdentity(id: number): ReaderSurfaceRectIdentity {
    return { route: this.scope.route(), owner: JSON.stringify([this.scope.book()?.sourceId ?? '',
      this.scope.book()?.bookId ?? '', id]), generation: this.scope.generation() };
  }

  private measureShelfMotionPage(id: number, identity: ReaderSurfaceRectIdentity): BookshelfMotionRect | undefined {
    return readerMeasureSurfaceRect(this.scope.context(), 'reader-bookshelf-page-slot',
      'reader-bookshelf-motion-host', identity, (): ReaderSurfaceRectIdentity => this.shelfMotionPageIdentity(id));
  }

  private backfillShelfMotionPage(id: number, identity: ReaderSurfaceRectIdentity, framesRemaining: number): void {
    this.scope.context().postFrameCallback(new BookshelfNavigationFrame((): void => {
      const request = this.request;
      if (request?.id !== id || request.direction !== 'open') return;
      const target = this.measureShelfMotionPage(id, identity);
      if (target === undefined) {
        if (framesRemaining > 1) this.backfillShelfMotionPage(id, identity, framesRemaining - 1);
        return;
      }
      this.request = { id: request.id, direction: request.direction, origin: request.origin,
        target, awaitingTarget: request.awaitingTarget, fadeOnly: request.fadeOnly };
    }));
  }

  open(selection: ShelfBook, origin: BookshelfBookOrigin | undefined, openBook: (selection: ShelfBook) => void): void {
    this.clear(true);
    const viewport = this.shelfMotionViewport();
    // Navigation and body preparation begin synchronously in their existing
    // owner. Visual completion never gates reading or publishes readiness.
    openBook(selection);
    if (this.scope.route() !== 'reading' || !this.scope.readingActive() || viewport === undefined ||
      this.scope.book()?.sourceId !== selection.sourceId || this.scope.book()?.bookId !== selection.bookId) return;
    const measured = origin !== undefined && origin.sourceId === selection.sourceId &&
      origin.bookId === selection.bookId && bookshelfMotionOriginFits(origin, viewport);
    const source: BookshelfBookOrigin = measured && origin !== undefined ? origin : {
      sourceId: selection.sourceId, bookId: selection.bookId, title: selection.title,
      coverUrl: selection.coverUrl ?? '', rect: viewport, radius: 0,
    };
    this.shelfMotionOrigin = source;
    this.shelfMotionWindow = viewport;
    const request: BookshelfMotionRequest = { id: ++this.shelfMotionSequence, direction: 'open',
      origin: bookshelfMotionLocalOrigin(source, viewport),
      target: this.shelfMotionPageFallback(viewport),
      fadeOnly: !measured || this.scope.contentKind() !== 'text' };
    this.readerOpacity = 0;
    this.request = request;
    this.backfillShelfMotionPage(request.id, this.shelfMotionPageIdentity(request.id), 4);
  }

  private beginShelfReturnMotion(origin: BookshelfBookOrigin | undefined): boolean {
    const viewport = this.shelfMotionViewport();
    const book = this.scope.book();
    if (!this.scope.readingActive() || this.scope.route() !== 'reading' || viewport === undefined || book === undefined) return false;
    const source: BookshelfBookOrigin = origin ?? { sourceId: book.sourceId,
      bookId: book.bookId, title: book.title, coverUrl: book.coverUrl ?? book.displayCoverUrl ?? '', rect: viewport, radius: 0 };
    const id = ++this.shelfMotionSequence;
    this.pendingExitId = id;
    this.shelfMotionWindow = viewport;
    this.deferredShelfMotionProjection = undefined;
    const target = this.measureShelfMotionPage(id, this.shelfMotionPageIdentity(id)) ?? this.shelfMotionPageFallback(viewport);
    this.request = { id, direction: 'close', origin: bookshelfMotionLocalOrigin(source, viewport),
      target, awaitingTarget: true, fadeOnly: origin === undefined || this.scope.contentKind() !== 'text' };
    return true;
  }

  private resolveShelfReturnMotionFallback(id: number, generation: number, framesRemaining: number): void {
    this.scope.context().postFrameCallback(new BookshelfNavigationFrame((): void => {
      const request = this.request;
      if (request?.id !== id || request.direction !== 'close' || !request.awaitingTarget ||
        generation !== this.scope.generation() || this.scope.route() !== 'bookshelf') return;
      if (framesRemaining > 1) {
        this.resolveShelfReturnMotionFallback(id, generation, framesRemaining - 1);
        return;
      }
      this.returnBookKey = '';
      this.request = { id, direction: 'close', origin: request.origin,
        target: request.target, awaitingTarget: false, fadeOnly: true };
    }));
  }

  receiveReturnOrigin(origin: BookshelfBookOrigin): void {
    const request = this.request;
    if (request === undefined || request.direction !== 'close' || !request.awaitingTarget ||
      this.scope.route() !== 'bookshelf' || this.shelfMotionReturnNavigation !== this.scope.generation() ||
      this.returnBookKey !== bookshelfMotionBookKey(origin.sourceId, origin.bookId)) return;
    const viewport = this.shelfMotionViewport();
    if (viewport === undefined || !this.sameShelfMotionWindow(viewport) || !bookshelfMotionOriginFits(origin, viewport)) return;
    this.request = { id: request.id, direction: 'close',
      origin: bookshelfMotionLocalOrigin(origin, viewport), target: request.target, awaitingTarget: false,
      fadeOnly: request.fadeOnly };
    this.returnBookKey = '';
  }

  visibilityChanged(foreground: boolean): void {
    if (!foreground || (this.request?.direction === 'open' && this.scope.route() !== 'reading') ||
      (this.request?.direction === 'close' && this.scope.route() !== this.scope.readingOrigin() &&
        !(this.scope.route() === 'reading' && this.pendingExitId === this.request.id))) {
      this.clear(!foreground);
    }
  }

  projectAfterOpening(project: () => void): void {
    if (this.request?.direction === 'open') {
      const previous = this.deferredShelfMotionProjection;
      this.deferredShelfMotionProjection = (): void => { previous?.(); project(); };
    } else project();
  }

  returnToOrigin(animateCover: boolean): void {
    if (this.pendingExitId >= 0) return;
    const book = this.scope.book();
    const origin = this.scope.readingOrigin() === 'bookshelf' && book !== undefined &&
      book.sourceId === this.shelfMotionOrigin?.sourceId && book.bookId === this.shelfMotionOrigin?.bookId ? this.shelfMotionOrigin : undefined;
    if (animateCover && this.beginShelfReturnMotion(origin)) return;
    this.scope.completeReturn();
  }

  resumeReturn(coveredMotionId: number): void {
    const request = this.request;
    if (coveredMotionId < 0 || request?.id !== coveredMotionId) return;
    if (this.scope.route() === 'bookshelf') {
      const generation = this.scope.generation();
      this.shelfMotionReturnNavigation = generation;
      this.returnBookKey = bookshelfMotionBookKey(request.origin.sourceId, request.origin.bookId);
      this.resolveShelfReturnMotionFallback(coveredMotionId, generation, 4);
    } else {
      this.request = { id: request.id, direction: 'close', origin: request.origin,
        target: request.target, awaitingTarget: false, fadeOnly: true };
    }
  }
}
