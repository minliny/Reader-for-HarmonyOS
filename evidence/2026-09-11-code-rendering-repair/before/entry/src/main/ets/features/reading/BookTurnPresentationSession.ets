import { image } from '@kit.ImageKit';
import bookTurnNative from 'libreader_bookturn_napi.so';
import type { BookTurnInput } from './BookTurnMotionState';
import type { ReaderPageTurnDirection } from './ReaderPageGestureState';

export const BOOK_TURN_TEXTURE_PREVIOUS = 0;
export const BOOK_TURN_TEXTURE_CURRENT = 1;
export const BOOK_TURN_TEXTURE_NEXT = 2;

export const BOOK_TURN_EVENT_SURFACE_READY = 1;
export const BOOK_TURN_EVENT_TEXTURE_READY = 2;
export const BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT = 3;
export const BOOK_TURN_EVENT_ROLLBACK_COMPLETE = 4;
export const BOOK_TURN_EVENT_SURFACE_LOST = 5;
export const BOOK_TURN_EVENT_RENDER_FAILURE = 6;
export const BOOK_TURN_EVENT_SLOTS_COMMITTED = 7;
/** The retained terminal frame was cleared after the generation-matched
 *  ArkUI presented confirmation (barrier closed). */
export const BOOK_TURN_EVENT_TERMINAL_RELEASED = 8;
/** Native surface has drawn the first frame for a new generation. */
export const BOOK_TURN_EVENT_FRAME_PRESENTED = 9;

export interface BookTurnRegrabFrame { generation: number; edgeX: number; edgeY: number; theta: number; }

export type BookTurnTextureSlot = 0 | 1 | 2;

export class BookTurnNativeEvent {
  event: number;
  generation: number;
  detail: number;

  constructor(event: number, generation: number, detail: number) {
    this.event = event;
    this.generation = generation;
    this.detail = detail;
  }
}

/**
 * Thin presentation-only bridge. It owns neither gesture arbitration nor the
 * Core page transaction; both remain in LocalReadingExperience.
 */
export class BookTurnPresentationSession {
  readonly componentId: string;
  private eventListener: (event: BookTurnNativeEvent) => void =
    (_event: BookTurnNativeEvent): void => {};

  constructor(componentId: string) {
    this.componentId = componentId;
    bookTurnNative.setEventCallback(componentId, (event: number, generation: number, detail: number): void => {
      this.eventListener(new BookTurnNativeEvent(event, generation, detail));
    });
  }

  setEventListener(listener: (event: BookTurnNativeEvent) => void): void {
    this.eventListener = listener;
  }

  setDynamicHighlights(identity: string, values: number[]): boolean {
    return bookTurnNative.setDynamicHighlights(this.componentId, identity, values);
  }

  configure(widthVp: number, heightVp: number): boolean {
    return bookTurnNative.configure(this.componentId, widthVp, heightVp);
  }

  isReady(): boolean {
    return bookTurnNative.isReady(this.componentId);
  }

  readyMask(): number {
    return bookTurnNative.readyMask(this.componentId);
  }

  canStart(direction: ReaderPageTurnDirection): boolean {
    return bookTurnNative.canStart(this.componentId, nativeDirection(direction));
  }

  uploadTexture(slot: BookTurnTextureSlot, pixelMap: image.PixelMap, identity: string,
    canPublish: () => boolean): Promise<boolean> {
    return bookTurnNative.uploadTexture(this.componentId, slot, pixelMap, identity, canPublish);
  }

  updateInput(input: BookTurnInput): boolean {
    return bookTurnNative.updateInput(
      this.componentId,
      input.generation,
      nativeDirection(input.direction),
      input.verticalPrevious,
      input.viewportWidth,
      input.viewportHeight,
      input.startX,
      input.startY,
      input.pointerX,
      input.pointerY,
      input.eventTimeMs,
    );
  }

  endGesture(input: BookTurnInput, commit: boolean): boolean {
    return bookTurnNative.endGesture(
      this.componentId,
      input.generation,
      nativeDirection(input.direction),
      input.verticalPrevious,
      input.viewportWidth,
      input.viewportHeight,
      input.startX,
      input.startY,
      input.pointerX,
      input.pointerY,
      input.eventTimeMs,
      commit,
    );
  }

  regrab(input: BookTurnInput, previousGeneration: number): BookTurnRegrabFrame | undefined {
    return bookTurnNative.regrab(
      this.componentId,
      input.generation,
      nativeDirection(input.direction),
      input.verticalPrevious,
      input.viewportWidth,
      input.viewportHeight,
      input.startX,
      input.startY,
      input.pointerX,
      input.pointerY,
      input.eventTimeMs,
      previousGeneration,
    );
  }

  settle(generation: number, commit: boolean): boolean {
    return bookTurnNative.settle(this.componentId, generation, commit);
  }

  startProgrammatic(generation: number, direction: ReaderPageTurnDirection, rapid: boolean = false): boolean {
    return bookTurnNative.startProgrammatic(this.componentId, generation, nativeDirection(direction), rapid);
  }

  commitSlots(generation: number, direction: ReaderPageTurnDirection): boolean {
    return bookTurnNative.commitSlots(this.componentId, generation, nativeDirection(direction));
  }

  /** ArkUI presentation barrier: after promote, hold the new-page terminal
   *  frame until this page's promoted content is confirmed composited. */
  retainTerminalFrame(generation: number): boolean {
    return bookTurnNative.retainTerminalFrame(this.componentId, generation);
  }

  /** Confirm the promoted content was composited; this only closes the native
   *  retain barrier. The ArkUI owner must hide the XComponent and then call
   *  clearSurface. Returns false for stale generations. */
  releaseTerminalFrame(generation: number): boolean {
    return bookTurnNative.releaseTerminalFrame(this.componentId, generation);
  }

  /** Clear the Native surface after ArkUI has hidden the XComponent and
   *  waited a frame. This is deliberately separate from release, which only
   *  closes the generation barrier. */
  clearSurface(generation: number): boolean {
    return bookTurnNative.clearSurface(this.componentId, generation);
  }

  /** Currently retained terminal generation (0 = none); diagnostics only. */
  committedSlotsGeneration(): number {
    return bookTurnNative.committedSlotsGeneration(this.componentId);
  }

  completedTerminalGeneration(): number {
    return bookTurnNative.completedTerminalGeneration(this.componentId);
  }

  retainedTerminalGeneration(): number {
    return bookTurnNative.retainedTerminalGeneration(this.componentId);
  }
}

function nativeDirection(direction: ReaderPageTurnDirection): number {
  return direction === 'next' ? -1 : 1;
}
