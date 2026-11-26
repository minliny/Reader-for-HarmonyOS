import { readerMotionAnimateParam, readerMotionReducedFadeParam } from './ReaderMotionPolicy';
import { ReaderPressFeedback } from './ReaderPressFeedback';

const REDUCED_PRESS_OPACITY: number = 0.92;

export function readerPressScale(pressed: boolean, reduceMotion: boolean): ScaleOptions {
  const scale = pressed && !reduceMotion ? 0.978 : 1;
  return { x: scale, y: scale };
}

export function readerPressAnimation(reduceMotion: boolean): AnimateParam {
  return reduceMotion ? readerMotionReducedFadeParam() : readerMotionAnimateParam('app.control.press', false);
}

export function readerAnimatePress(context: UIContext, reduceMotion: boolean, paint: () => void): void {
  try { context.animateTo(readerPressAnimation(reduceMotion), paint); }
  catch (_) { paint(); }
}

export function readerPressOpacity(pressed: boolean, reduceMotion: boolean, resting: number = 1): number {
  return pressed && reduceMotion ? resting * REDUCED_PRESS_OPACITY : resting;
}

export function readerPressSurface(surface: ResourceColor, scheme: string, pressed: boolean,
  reduceMotion: boolean): ResourceColor {
  return pressed && !reduceMotion ? new ReaderPressFeedback(surface, scheme).pressedSurface() : surface;
}

/** Observe the native target without registering a separate gesture or changing its hit area. */
export function readerPressPointer(event: TouchEvent, active: number, enabled: boolean): number {
  if (!enabled || event.type === TouchType.Cancel) return -1;
  if (event.type === TouchType.Down && active < 0) return event.changedTouches?.[0]?.id ?? -1;
  if (event.type === TouchType.Up && event.changedTouches?.some(touch => touch.id === active)) return -1;
  return active;
}

const ROW_PRESS_DELAY_MS: number = 90;
const ROW_PRESS_RELEASE_MS: number = 110;
const ROW_PRESS_SLOP_VP: number = 8;

/** Shared visual feedback for a row in a scrolling container. The native
 * click and the surrounding scroll owner keep their original input roles. */
export class ReaderDelayedRowPress {
  private pointer: number = -1;
  private candidateKey: string = '';
  private pressedKey: string = '';
  private originX: number = 0;
  private originY: number = 0;
  private timer: number = -1;
  private readonly publish: (key: string) => void;

  constructor(publish: (key: string) => void) {
    this.publish = publish;
  }

  cancel(): void {
    if (this.timer >= 0) clearTimeout(this.timer);
    this.timer = -1;
    this.pointer = -1;
    this.candidateKey = '';
    this.show('');
  }

  /** True only on an admitted down. A moving list can observe it while
   * suppressing paint, for example to keep the row order stable under touch. */
  observe(event: TouchEvent, key: string, enabled: boolean, paint: boolean = true): boolean {
    if (!enabled || event.type === TouchType.Cancel) {
      this.cancel();
      return false;
    }
    if (event.type === TouchType.Down) {
      const primary = this.pointer < 0 && (event.touches?.length ?? 1) <= 1;
      this.cancel();
      const touch = event.changedTouches?.[0] ?? event.touches?.[0];
      if (!primary || touch === undefined) return false;
      if (!paint) return true;
      this.candidateKey = key;
      this.pointer = touch.id;
      this.originX = touch.windowX;
      this.originY = touch.windowY;
      this.schedule((): void => this.show(key), ROW_PRESS_DELAY_MS);
      return true;
    }
    if (this.pointer < 0 || this.candidateKey !== key) return false;
    const touch = event.changedTouches?.find(point => point.id === this.pointer) ??
      event.touches?.find(point => point.id === this.pointer);
    if ((event.touches?.length ?? 0) > 1 || (touch !== undefined &&
      Math.hypot(touch.windowX - this.originX, touch.windowY - this.originY) > ROW_PRESS_SLOP_VP)) {
      this.cancel();
    } else if (event.type === TouchType.Up && readerPressPointer(event, this.pointer, true) < 0) {
      const quickTap = this.pressedKey.length === 0;
      this.cancel();
      if (quickTap) {
        this.show(key);
        this.schedule((): void => this.cancel(), ROW_PRESS_RELEASE_MS);
      }
    }
    return false;
  }

  private show(key: string): void {
    if (key === this.pressedKey) return;
    this.pressedKey = key;
    this.publish(key);
  }

  private schedule(action: () => void, delayMs: number): void {
    const timer = setTimeout((): void => {
      if (this.timer !== timer) return;
      this.timer = -1;
      action();
    }, delayMs);
    this.timer = timer;
  }
}
