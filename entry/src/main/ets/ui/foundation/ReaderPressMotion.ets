import { readerMotionAnimateParam, readerMotionReducedFadeParam } from './ReaderMotionPolicy';
import { ReaderPressFeedback } from './ReaderPressFeedback';
import { ReaderRowPressMachine, ReaderRowPressTouchKind } from './ReaderDelayedRowPress';

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

/** Shared visual feedback for a row in a scrolling container. The native
 * click and the surrounding scroll owner keep their original input roles. */
export class ReaderDelayedRowPress {
  private readonly machine: ReaderRowPressMachine;

  constructor(publish: (key: string) => void) {
    this.machine = new ReaderRowPressMachine(publish);
  }

  cancel(): void {
    this.machine.cancel();
  }

  /** True only on an admitted down. A moving list can observe it while
   * suppressing paint, for example to keep the row order stable under touch. */
  observe(event: TouchEvent, key: string, enabled: boolean, paint: boolean = true): boolean {
    const kind: ReaderRowPressTouchKind = event.type === TouchType.Down ? 'down' :
      event.type === TouchType.Up ? 'up' :
      event.type === TouchType.Cancel ? 'cancel' : 'move';
    const touchCount = event.touches?.length ?? (kind === 'down' ? 1 : 0);
    if (kind === 'down') {
      const touch = event.changedTouches?.[0] ?? event.touches?.[0];
      return this.machine.observe(kind, touch?.id ?? -1, touch?.windowX ?? 0, touch?.windowY ?? 0,
        touchCount, key, enabled, paint);
    }
    const active = this.machine.activePointer();
    const touch = active < 0 ? undefined :
      event.changedTouches?.find((point: TouchObject): boolean => point.id === active) ??
      event.touches?.find((point: TouchObject): boolean => point.id === active);
    return this.machine.observe(kind, touch?.id ?? -1, touch?.windowX ?? 0, touch?.windowY ?? 0,
      touchCount, key, enabled, paint);
  }
}
