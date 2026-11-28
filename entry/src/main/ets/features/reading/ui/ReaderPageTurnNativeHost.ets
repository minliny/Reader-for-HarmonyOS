import { ComponentContent } from '@kit.ArkUI';
import type { BusinessError } from '@kit.BasicServicesKit';
import { image } from '@kit.ImageKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import type { ReaderAppearanceSnapshot } from '../application/ReaderAppearanceState';
import type { ReaderPageTurnNativeEvent } from '../application/ReadingPageTurnCoordinator';
import {
  BOOK_TURN_EVENT_FRAME_PRESENTED, BOOK_TURN_EVENT_RENDER_FAILURE, BOOK_TURN_EVENT_ROLLBACK_COMPLETE,
  BOOK_TURN_EVENT_SLOTS_COMMITTED, BOOK_TURN_EVENT_SURFACE_LOST, BOOK_TURN_EVENT_SURFACE_READY,
  BOOK_TURN_EVENT_TERMINAL_RELEASED, BOOK_TURN_EVENT_TEXTURE_READY, BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT,
  type BookTurnPresentationSession,
} from './BookTurnPresentationSession';
import { BookTurnTextureBuildInput, BookTurnTextureBuilder } from './BookTurnTextureBuilder';
import {
  BOOK_TURN_TEXTURE_CURRENT, BookTurnTextureCapture, bookTurnTextureSnapshotScale, captureDecodedBookTurnBitmap,
  type BookTurnTexturePlan, type BookTurnTextureSlot, type BookTurnTextureStep,
} from './BookTurnTextureCapture';
import { readerNativeHighlightValues, type ReaderDynamicHighlightRect } from './ReaderDynamicHighlight';
import type { ReaderReadingLayoutSnapshot } from './ReaderLayoutGeometry';
import type { ReaderPageGesturePhase, ReaderPageTurnDirection } from './ReaderPageGestureState';
import type { ReaderPageTurnRenderPage, ReaderPageTurnSlot } from './ReaderPageTurnStage';
import { ReaderUIFrameCallback } from './ReaderUIFrameCallback';
import type { ReadingSurfacePageFragment } from './ReadingSurface';

export const READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID = 'reader-book-turn-current-page';

export function readerPageTurnNativeEvent(event: number): ReaderPageTurnNativeEvent | undefined {
  switch (event) {
    case BOOK_TURN_EVENT_SURFACE_READY: return 'surfaceReady';
    case BOOK_TURN_EVENT_TEXTURE_READY: return 'textureReady';
    case BOOK_TURN_EVENT_FRAME_PRESENTED: return 'framePresented';
    case BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT: return 'commitEndpoint';
    case BOOK_TURN_EVENT_ROLLBACK_COMPLETE: return 'rollbackComplete';
    case BOOK_TURN_EVENT_SLOTS_COMMITTED: return 'slotsCommitted';
    case BOOK_TURN_EVENT_TERMINAL_RELEASED: return 'terminalReleased';
    case BOOK_TURN_EVENT_SURFACE_LOST:
    case BOOK_TURN_EVENT_RENDER_FAILURE: return 'surfaceFailed';
    default: return undefined;
  }
}

export class ReaderPageTurnTextureGate {
  readonly mounted: boolean;
  readonly launchBlocked: boolean;
  readonly simulation: boolean;
  readonly controlVisible: boolean;
  readonly runtimeFailed: boolean;
  readonly exitRequested: boolean;
  readonly ready: boolean;
  readonly preparing: boolean;
  readonly inputPhase: ReaderPageGesturePhase;
  readonly generation: number;
  readonly contentRevision: number;

  constructor(
    mounted: boolean,
    launchBlocked: boolean,
    simulation: boolean,
    controlVisible: boolean,
    runtimeFailed: boolean,
    exitRequested: boolean,
    ready: boolean,
    preparing: boolean,
    inputPhase: ReaderPageGesturePhase,
    generation: number,
    contentRevision: number,
  ) {
    this.mounted = mounted;
    this.launchBlocked = launchBlocked;
    this.simulation = simulation;
    this.controlVisible = controlVisible;
    this.runtimeFailed = runtimeFailed;
    this.exitRequested = exitRequested;
    this.ready = ready;
    this.preparing = preparing;
    this.inputPhase = inputPhase;
    this.generation = generation;
    this.contentRevision = contentRevision;
  }
}

export class ReaderPageTurnTextureGeometry {
  readonly width: number;
  readonly height: number;
  readonly slot: ReaderPageTurnSlot;

  constructor(
    width: number,
    height: number,
    slot: ReaderPageTurnSlot,
  ) {
    this.width = width;
    this.height = height;
    this.slot = slot;
  }
}

/** Owns the bounded native offscreen tree and the serialized snapshot lease.
 * The same live presentation session still owns the XComponent and native texture slots. */
export class ReaderPageTurnNativeHost {
  private readonly capture: BookTurnTextureCapture<ReaderPageTurnRenderPage, image.PixelMap>;
  private content: ComponentContent<BookTurnTextureBuildInput> | undefined = undefined;
  private buildPage: ReaderPageTurnRenderPage | undefined = undefined;
  private highlightIdentity: string = '';
  private highlightValues: number[] = [];
  preferredDirection: ReaderPageTurnDirection = 'next';

  private readonly session: BookTurnPresentationSession;
  private readonly context: () => UIContext;
  private readonly gate: () => ReaderPageTurnTextureGate;
  private readonly geometry: () => ReaderPageTurnTextureGeometry;
  private readonly layout: () => ReaderReadingLayoutSnapshot;
  private readonly appearance: () => ReaderAppearanceSnapshot;
  private readonly current: () => ReaderPageTurnRenderPage;
  private readonly adjacent: (direction: ReaderPageTurnDirection) => ReaderPageTurnRenderPage | undefined;
  private readonly onCaptureFailure: () => void;

  constructor(
    session: BookTurnPresentationSession,
    context: () => UIContext,
    gate: () => ReaderPageTurnTextureGate,
    geometry: () => ReaderPageTurnTextureGeometry,
    layout: () => ReaderReadingLayoutSnapshot,
    appearance: () => ReaderAppearanceSnapshot,
    current: () => ReaderPageTurnRenderPage,
    adjacent: (direction: ReaderPageTurnDirection) => ReaderPageTurnRenderPage | undefined,
    onCaptureFailure: () => void,
  ) {
    this.session = session;
    this.context = context;
    this.gate = gate;
    this.geometry = geometry;
    this.layout = layout;
    this.appearance = appearance;
    this.current = current;
    this.adjacent = adjacent;
    this.onCaptureFailure = onCaptureFailure;
    this.capture = new BookTurnTextureCapture<ReaderPageTurnRenderPage, image.PixelMap>({
      postFrame: (callback: () => void): void => this.context().postFrameCallback(new ReaderUIFrameCallback(callback)),
      mounted: (): boolean => this.gate().mounted,
      plan: (): BookTurnTexturePlan<ReaderPageTurnRenderPage> | undefined => this.plan(),
      preferredDirection: (): ReaderPageTurnDirection => this.preferredDirection,
      pageGeneration: (): number => this.gate().generation,
      allows: (step: BookTurnTextureStep): boolean => this.allows(step),
      snapshot: (slot: BookTurnTextureSlot, page: ReaderPageTurnRenderPage, retained: boolean, mayDecode: () => boolean):
        Promise<image.PixelMap | undefined> | undefined => this.snapshot(slot, page, retained, mayDecode),
      captureFailed: (slot: BookTurnTextureSlot, generation: number, message: string): void =>
        this.captureFailed(slot, generation, message),
      release: (bitmap: image.PixelMap): void => { bitmap.release(); },
    }, session);
  }

  updateHighlights(identity: string, rects: ReaderDynamicHighlightRect[]): void {
    const bounds = this.geometry();
    this.highlightIdentity = identity;
    this.highlightValues = readerNativeHighlightValues(rects, bounds.width, bounds.height);
    this.session.setDynamicHighlights(identity, this.highlightValues);
  }

  replayHighlights(): void {
    if (this.highlightIdentity.length > 0) this.session.setDynamicHighlights(this.highlightIdentity, this.highlightValues);
  }

  schedule(): void {
    const gate = this.gate();
    if (gate.mounted && gate.simulation && !gate.launchBlocked) this.capture.schedule();
  }

  invalidate(resident?: boolean): void { this.capture.invalidate(resident); }

  replaceSurface(): void { this.capture.replaceSurface(); }

  refresh(): Promise<void> { return this.capture.refresh(); }

  releaseContent(): void {
    const content = this.content;
    this.content = undefined;
    this.buildPage = undefined;
    if (content !== undefined) this.capture.disposeAfterRefresh((): void => content.dispose());
  }

  private plan(): BookTurnTexturePlan<ReaderPageTurnRenderPage> | undefined {
    const gate = this.gate();
    if (!gate.mounted || gate.launchBlocked || !gate.simulation || gate.controlVisible || gate.runtimeFailed ||
      !this.session.isReady() || !gate.ready || gate.preparing || gate.inputPhase !== 'idle') return undefined;
    const current = this.current();
    // Snapshot paint readiness cannot acknowledge a pending parent revision.
    if (gate.contentRevision !== current.renderRevision) return undefined;
    return { current, previous: this.adjacent('previous'), next: this.adjacent('next') };
  }

  private allows(step: BookTurnTextureStep): boolean {
    const gate = this.gate();
    if (!gate.mounted) return false;
    switch (step) {
      case 'snapshot':
      case 'upload':
        return !gate.launchBlocked && gate.simulation && !gate.controlVisible &&
          !gate.runtimeFailed && gate.ready && gate.inputPhase === 'idle';
      case 'decode':
        return gate.simulation && !gate.controlVisible && gate.ready && gate.inputPhase === 'idle' && !gate.runtimeFailed;
      case 'before-upload':
        return gate.simulation && !gate.controlVisible && gate.inputPhase === 'idle';
      case 'retain':
        return !gate.exitRequested && gate.simulation && !gate.runtimeFailed;
    }
  }

  private snapshot(slot: BookTurnTextureSlot, page: ReaderPageTurnRenderPage,
    retained: boolean, mayDecode: () => boolean): Promise<image.PixelMap | undefined> | undefined {
    const uiContext = this.context();
    const snapshot = uiContext.getComponentSnapshot();
    const hasBodyImages = page.fragments.some((fragment: ReadingSurfacePageFragment): boolean =>
      (fragment.fileUri?.length ?? 0) > 0 || fragment.imageSource !== undefined);
    if (retained) return undefined;
    const bounds = this.geometry();
    if (slot === BOOK_TURN_TEXTURE_CURRENT && !hasBodyImages) {
      // The mounted physical slot may supply only the current text-only page.
      return snapshot.get(`${READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID}-${bounds.slot}`, {
        scale: this.scale(), waitUntilRenderFinished: true,
      });
    }
    // Keep one offscreen tree. Checked capture verifies its decoded images.
    const input = new BookTurnTextureBuildInput(page, bounds.width, bounds.height, this.layout(),
      page.appearance ?? this.appearance(), (): ReadingSurfacePageFragment[] => this.buildPage?.fragments ?? []);
    this.buildPage = page;
    let content = this.content;
    if (content === undefined) {
      content = new ComponentContent<BookTurnTextureBuildInput>(uiContext, wrapBuilder(BookTurnTextureBuilder), input);
      this.content = content;
    } else content.update(input);
    const captureContent = content;
    return captureDecodedBookTurnBitmap<image.PixelMap>(
      (delay: number): Promise<image.PixelMap> => this.context().getComponentSnapshot().createFromComponent(
        captureContent, delay, true, { scale: this.scale(), waitUntilRenderFinished: true }),
      mayDecode, (error: Error): boolean => (error as BusinessError).code === 160001);
  }

  private captureFailed(slot: BookTurnTextureSlot, generation: number, message: string): void {
    hilog.error(0x5244, 'Reader', '%{private}s', `ReadingExperience book-turn texture failed slot=${slot}: ${message}`);
    const gate = this.gate();
    if (this.capture.isCurrent(generation) && gate.mounted && gate.simulation) this.onCaptureFailure();
  }

  private scale(): number {
    const context = this.context();
    const bounds = this.geometry();
    return bookTurnTextureSnapshotScale(context.vp2px(bounds.width), context.vp2px(bounds.height));
  }
}
