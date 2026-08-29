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

  uploadTexture(slot: BookTurnTextureSlot, pixelMap: image.PixelMap, identity: string): boolean {
    return bookTurnNative.uploadTexture(this.componentId, slot, pixelMap, identity);
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
      input.edgeX,
      input.edgeY,
      input.pointerVelocityX,
      input.eventTimeMs,
    );
  }

  settle(generation: number, commit: boolean): boolean {
    return bookTurnNative.settle(this.componentId, generation, commit);
  }

  startProgrammatic(generation: number, direction: ReaderPageTurnDirection): boolean {
    return bookTurnNative.startProgrammatic(this.componentId, generation, nativeDirection(direction));
  }

  commitSlots(generation: number, direction: ReaderPageTurnDirection): boolean {
    return bookTurnNative.commitSlots(this.componentId, generation, nativeDirection(direction));
  }
}

function nativeDirection(direction: ReaderPageTurnDirection): number {
  return direction === 'next' ? -1 : 1;
}
