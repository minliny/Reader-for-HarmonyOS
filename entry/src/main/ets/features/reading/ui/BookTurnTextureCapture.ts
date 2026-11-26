import { errorMessageOf } from '../../../app/ErrorMessage.ts';
import type { ReaderPageTurnDirection } from './ReaderPageGestureState';

export const BOOK_TURN_TEXTURE_PREVIOUS = 0;
export const BOOK_TURN_TEXTURE_CURRENT = 1;
export const BOOK_TURN_TEXTURE_NEXT = 2;
export type BookTurnTextureSlot = 0 | 1 | 2;

export interface BookTurnTexturePage {
  readonly textureIdentity: string;
}

export interface BookTurnTexturePlan<TPage> {
  readonly current: TPage;
  readonly previous: TPage | undefined;
  readonly next: TPage | undefined;
}

export interface BookTurnTextureCache<TBitmap> {
  capturedIdentity(slot: BookTurnTextureSlot): string;
  takePendingSnapshot(identity: string, pageGeneration: number): TBitmap | undefined;
  retainPendingSnapshot(identity: string, pageGeneration: number, bitmap: TBitmap): void;
  uploadTexture(slot: BookTurnTextureSlot, bitmap: TBitmap, identity: string, canPublish: () => boolean): Promise<boolean>;
}

export type BookTurnTextureStep = 'snapshot' | 'decode' | 'before-upload' | 'upload' | 'retain';

export interface BookTurnTextureHost<TPage, TBitmap> {
  postFrame(callback: () => void): void;
  mounted(): boolean;
  plan(): BookTurnTexturePlan<TPage> | undefined;
  preferredDirection(): ReaderPageTurnDirection;
  pageGeneration(): number;
  allows(step: BookTurnTextureStep): boolean;
  /** Returns no request when the retained bitmap can be reused synchronously. */
  snapshot(slot: BookTurnTextureSlot, page: TPage, retained: boolean, mayDecode: () => boolean): Promise<TBitmap | undefined> | undefined;
  captureFailed(slot: BookTurnTextureSlot, generation: number, message: string): void;
  release(bitmap: TBitmap): void;
}

/** Owns capture scheduling and bitmap custody. The UI supplies frame timing,
 * snapshot dispatch and live admission. The presentation session owns native
 * texture identities, slot commits and the parked CPU bitmap. */
export class BookTurnTextureCapture<TPage extends BookTurnTexturePage, TBitmap> {
  private generation: number = 0;
  private surfaceEpoch: number = 0;
  private scheduled: boolean = false;
  private inFlight: Promise<void> | undefined = undefined;
  private readonly host: BookTurnTextureHost<TPage, TBitmap>;
  private readonly cache: BookTurnTextureCache<TBitmap>;

  constructor(host: BookTurnTextureHost<TPage, TBitmap>, cache: BookTurnTextureCache<TBitmap>) {
    this.host = host;
    this.cache = cache;
  }

  invalidate(clearScheduled: boolean = false): void {
    this.generation += 1;
    if (clearScheduled) this.scheduled = false;
  }

  replaceSurface(): void {
    this.generation += 1;
    this.surfaceEpoch += 1;
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  schedule(): void {
    this.generation += 1;
    if (this.scheduled) return;
    this.scheduled = true;
    this.host.postFrame((): void => {
      this.scheduled = false;
      void this.refresh();
    });
  }

  async refresh(generation: number = this.generation): Promise<void> {
    while (this.inFlight !== undefined) await this.inFlight;
    if (!this.isCurrent(generation) || !this.host.mounted()) return;
    const operation = this.performRefresh(generation);
    this.inFlight = operation;
    try { await operation; } finally {
      if (this.inFlight === operation) this.inFlight = undefined;
    }
  }

  disposeAfterRefresh(dispose: () => void): void {
    const pending = this.inFlight;
    if (pending === undefined) dispose();
    else void pending.then(dispose, dispose);
  }

  private async performRefresh(generation: number): Promise<void> {
    if (!this.isCurrent(generation)) return;
    const plan = this.host.plan();
    if (plan === undefined) return;
    let capturedThisFrame = this.cache.capturedIdentity(BOOK_TURN_TEXTURE_CURRENT) !== plan.current.textureIdentity;
    if (!await this.capture(BOOK_TURN_TEXTURE_CURRENT, plan.current, generation)) return;
    // Priority can change while the current page snapshot is in flight.
    const previousFirst = this.host.preferredDirection() === 'previous';
    const first = previousFirst ? plan.previous : plan.next;
    const second = previousFirst ? plan.next : plan.previous;
    const firstSlot = previousFirst ? BOOK_TURN_TEXTURE_PREVIOUS : BOOK_TURN_TEXTURE_NEXT;
    const secondSlot = previousFirst ? BOOK_TURN_TEXTURE_NEXT : BOOK_TURN_TEXTURE_PREVIOUS;
    // Cached slots need no work or extra frame. Every new texture still goes
    // through the current idle and publication gates.
    if (first !== undefined && this.cache.capturedIdentity(firstSlot) !== first.textureIdentity) {
      if (capturedThisFrame) await this.yieldFrame();
      if (!await this.capture(firstSlot, first, generation)) return;
      capturedThisFrame = true;
    }
    if (second !== undefined && this.cache.capturedIdentity(secondSlot) !== second.textureIdentity) {
      if (capturedThisFrame) await this.yieldFrame();
      await this.capture(secondSlot, second, generation);
    }
  }

  private yieldFrame(): Promise<void> {
    return new Promise<void>((resolve: () => void): void => this.host.postFrame(resolve));
  }

  private async capture(slot: BookTurnTextureSlot, page: TPage, generation: number): Promise<boolean> {
    if (!this.isCurrent(generation) || !this.host.allows('snapshot')) return false;
    if (this.cache.capturedIdentity(slot) === page.textureIdentity) return true;
    const pageGeneration = this.host.pageGeneration();
    const surfaceEpoch = this.surfaceEpoch;
    let published = false;
    let bitmap = this.cache.takePendingSnapshot(page.textureIdentity, pageGeneration);
    try {
      const request = this.host.snapshot(slot, page, bitmap !== undefined,
        (): boolean => this.isCurrent(generation) && this.host.allows('decode'));
      if (request !== undefined) bitmap = await request;
      if (bitmap === undefined || !this.isCurrent(generation) || !this.host.allows('before-upload')) return false;
      const canPublish = (): boolean => this.isCurrent(generation) && this.host.allows('upload');
      const uploaded = await this.cache.uploadTexture(slot, bitmap, page.textureIdentity, canPublish);
      if (!canPublish()) return false;
      if (!uploaded) {
        this.host.captureFailed(slot, generation, 'Native rejected the PixelMap');
        return false;
      }
      published = true;
      return true;
    } catch (error) {
      this.host.captureFailed(slot, generation, errorMessageOf(error));
      return false;
    } finally {
      if (bitmap !== undefined) {
        if (!published && surfaceEpoch === this.surfaceEpoch && pageGeneration === this.host.pageGeneration() &&
          this.host.allows('retain')) {
          // A DOWN may invalidate the upload while the same page and EGL
          // surface still own the pixels. Preserve only the one exact bitmap.
          this.cache.retainPendingSnapshot(page.textureIdentity, pageGeneration, bitmap);
        } else {
          try { this.host.release(bitmap); } catch (_) {}
        }
      }
    }
  }
}

/** Code 160001 means decoding is pending. Other failures and the last
 * attempt retain the platform error and follow the caller's fallback path. */
export async function captureDecodedBookTurnBitmap<TBitmap>(
  snapshot: (delay: number) => Promise<TBitmap>, current: () => boolean, decodingPending: (error: Error) => boolean,
): Promise<TBitmap | undefined> {
  const delays: number[] = [0, 16, 64, 128];
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (!current()) return undefined;
    try {
      return await snapshot(delays[attempt]);
    } catch (error) {
      if (!decodingPending(error as Error) || attempt === delays.length - 1) throw (error as Error);
    }
  }
  return undefined;
}

const BOOK_TURN_TEXTURE_MAX_PIXELS = 3_000_000;

export function bookTurnTextureSnapshotScale(viewportWidthPx: number, viewportHeightPx: number): number {
  const widthPx = Math.max(1, viewportWidthPx);
  const heightPx = Math.max(1, viewportHeightPx);
  const pixelCount = widthPx * heightPx;
  // ComponentSnapshot rounds both edges. Leave a small area margin before
  // Native's pixel ceiling when a downscale is required.
  return pixelCount <= BOOK_TURN_TEXTURE_MAX_PIXELS ? 1 :
    Math.sqrt(BOOK_TURN_TEXTURE_MAX_PIXELS / pixelCount) * 0.99;
}
