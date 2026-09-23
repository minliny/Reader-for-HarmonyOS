import { image } from '@kit.ImageKit';
import bookTurnNative from 'libreader_bookturn_napi.so';
import type { BookTurnInput } from './BookTurnMotionState';
import type { ReaderPageTurnDirection } from './ReaderPageGestureState';
import { readerHighlightValuesEqual } from './ReaderDynamicHighlight';

export const BOOK_TURN_TEXTURE_PREVIOUS = 0;
export const BOOK_TURN_TEXTURE_CURRENT = 1;
export const BOOK_TURN_TEXTURE_NEXT = 2;

export const BOOK_TURN_PROFILE_MANUAL = 0;
export const BOOK_TURN_PROFILE_RAPID = 1;
export const BOOK_TURN_PROFILE_AUTOMATIC = 2;

export const BOOK_TURN_EVENT_SURFACE_READY = 1;
export const BOOK_TURN_EVENT_TEXTURE_READY = 2;
export const BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT = 3;
export const BOOK_TURN_EVENT_ROLLBACK_COMPLETE = 4;
export const BOOK_TURN_EVENT_SURFACE_LOST = 5;
export const BOOK_TURN_EVENT_RENDER_FAILURE = 6;
export const BOOK_TURN_EVENT_SLOTS_COMMITTED = 7;
/** The retained terminal frame was cleared after the generation-matched
 *  ArkUI content admission and scheduled hide (barrier closed; no display fence). */
export const BOOK_TURN_EVENT_TERMINAL_RELEASED = 8;
/** Native submitted the first buffer, not a display fence. For an automatic
 *  turn, detail is the positive token required by startAutomaticTimeline. */
export const BOOK_TURN_EVENT_FRAME_PRESENTED = 9;

export interface BookTurnRegrabFrame { generation: number; edgeX: number; edgeY: number; theta: number; }

export type BookTurnTextureSlot = 0 | 1 | 2;

interface BookTurnPendingSnapshot {
  identity: string;
  pageGeneration: number;
  pixelMap: image.PixelMap;
}

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
  private capturedIdentities: string[] = ['', '', ''];
  private pendingSlotGeneration: number = -1;
  private pendingSlotDirection: ReaderPageTurnDirection | undefined = undefined;
  private pendingSnapshot: BookTurnPendingSnapshot | undefined = undefined;
  private highlightIdentity: string = '';
  private highlightValues: number[] = [];
  private configuredWidth: number = 0;
  private configuredHeight: number = 0;
  private eventListener: (event: BookTurnNativeEvent) => void =
    (_event: BookTurnNativeEvent): void => {};

  constructor(componentId: string) {
    this.componentId = componentId;
    bookTurnNative.setEventCallback(componentId, (event: number, generation: number, detail: number): void => {
      this.onNativeEvent(event, generation, detail);
    });
  }

  private onNativeEvent(event: number, generation: number, detail: number): void {
    if (event === BOOK_TURN_EVENT_SURFACE_READY || event === BOOK_TURN_EVENT_SURFACE_LOST ||
      event === BOOK_TURN_EVENT_RENDER_FAILURE) this.highlightIdentity = '';
    if (event === BOOK_TURN_EVENT_SLOTS_COMMITTED && generation === this.pendingSlotGeneration) {
      const direction = this.pendingSlotDirection;
      this.pendingSlotGeneration = -1;
      this.pendingSlotDirection = undefined;
      if (direction === 'next') this.capturedIdentities = [this.capturedIdentities[1], this.capturedIdentities[2], ''];
      else if (direction === 'previous') this.capturedIdentities = ['', this.capturedIdentities[0], this.capturedIdentities[1]];
    }
    this.eventListener(new BookTurnNativeEvent(event, generation, detail));
  }

  capturedIdentity(slot: BookTurnTextureSlot): string { return this.capturedIdentities[slot]; }

  /** Revokes in-flight upload publication and the retained CPU bitmap together. */
  clearCapturedTextures(): void {
    this.capturedIdentities = ['', '', ''];
    this.pendingSlotGeneration = -1;
    this.pendingSlotDirection = undefined;
    this.releasePendingSnapshot();
  }

  retainPendingSnapshot(identity: string, pageGeneration: number, pixelMap: image.PixelMap): void {
    this.releasePendingSnapshot();
    this.pendingSnapshot = { identity, pageGeneration, pixelMap };
  }

  takePendingSnapshot(identity: string, pageGeneration: number): image.PixelMap | undefined {
    const pending = this.pendingSnapshot;
    if (pending === undefined) return undefined;
    if (pending.pageGeneration !== pageGeneration) { this.releasePendingSnapshot(); return undefined; }
    if (pending.identity !== identity) return undefined;
    this.pendingSnapshot = undefined;
    return pending.pixelMap;
  }

  releasePendingSnapshot(): void {
    const pending = this.pendingSnapshot;
    this.pendingSnapshot = undefined;
    if (pending !== undefined) { try { pending.pixelMap.release(); } catch (_) {} }
  }

  setEventListener(listener: (event: BookTurnNativeEvent) => void): void {
    this.eventListener = listener;
  }

  setDynamicHighlights(identity: string, values: number[]): boolean {
    if (identity.length > 0 && identity === this.highlightIdentity && readerHighlightValuesEqual(values, this.highlightValues)) return true;
    const accepted: boolean = bookTurnNative.setDynamicHighlights(this.componentId, identity, values);
    if (accepted) { this.highlightIdentity = identity; this.highlightValues = values.slice(); }
    return accepted;
  }

  configure(widthVp: number, heightVp: number): boolean {
    if (widthVp !== this.configuredWidth || heightVp !== this.configuredHeight) {
      this.highlightIdentity = ''; this.configuredWidth = widthVp; this.configuredHeight = heightVp;
    }
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

  async uploadTexture(slot: BookTurnTextureSlot, pixelMap: image.PixelMap, identity: string,
    canPublish: () => boolean): Promise<boolean> {
    if (!canPublish()) return false;
    const identities = this.capturedIdentities;
    const canUpload = (): boolean => identities === this.capturedIdentities && canPublish();
    const accepted: boolean = await bookTurnNative.uploadTexture(this.componentId, slot, pixelMap, identity, canUpload);
    if (!accepted || !canUpload()) return false;
    this.capturedIdentities[slot] = identity;
    return true;
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

  startProgrammatic(generation: number, direction: ReaderPageTurnDirection,
    profile: number = BOOK_TURN_PROFILE_MANUAL): boolean {
    return bookTurnNative.startProgrammatic(this.componentId, generation, nativeDirection(direction), profile);
  }

  startAutomaticTimeline(generation: number, surfaceToken: number): boolean {
    return bookTurnNative.startAutomaticTimeline(this.componentId, generation, surfaceToken);
  }

  commitSlots(generation: number, direction: ReaderPageTurnDirection): boolean {
    this.pendingSlotGeneration = generation;
    this.pendingSlotDirection = direction;
    const accepted: boolean = bookTurnNative.commitSlots(this.componentId, generation, nativeDirection(direction));
    if (!accepted && this.pendingSlotGeneration === generation) {
      this.pendingSlotGeneration = -1; this.pendingSlotDirection = undefined;
    }
    return accepted;
  }

  /** ArkUI presentation barrier: after promote, hold the new-page terminal
   *  frame until the owner admits this page's promoted content and hides Native. */
  retainTerminalFrame(generation: number): boolean {
    return bookTurnNative.retainTerminalFrame(this.componentId, generation);
  }

  /** Confirm the owner admitted promoted content and scheduled its hide; this closes the native
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
