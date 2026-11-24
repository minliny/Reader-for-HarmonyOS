import { readerMotionAnimateParam, readerMotionReducedFadeParam } from './ReaderMotionPolicy';

const REDUCED_PRESS_OPACITY: number = 0.92;

export function readerPressScale(pressed: boolean, reduceMotion: boolean): ScaleOptions {
  const scale = pressed && !reduceMotion ? 0.978 : 1;
  return { x: scale, y: scale };
}

export function readerPressAnimation(reduceMotion: boolean): AnimateParam {
  return reduceMotion ? readerMotionReducedFadeParam() : readerMotionAnimateParam('app.control.press', false);
}

export function readerPressOpacity(pressed: boolean, reduceMotion: boolean, resting: number = 1): number {
  return pressed && reduceMotion ? resting * REDUCED_PRESS_OPACITY : resting;
}

/** Observe the native target without registering a separate gesture or changing its hit area. */
export function readerPressPointer(event: TouchEvent, active: number, enabled: boolean): number {
  if (!enabled || event.type === TouchType.Cancel) return -1;
  if (event.type === TouchType.Down && active < 0) return event.changedTouches[0]?.id ?? -1;
  if (event.type === TouchType.Up && event.changedTouches.some(touch => touch.id === active)) return -1;
  return active;
}
