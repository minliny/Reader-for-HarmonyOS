import curves from '@ohos.curves';
import { motionAnimateParam, motionSpecGet, MotionSpecEntry } from './MotionSpec';
import { readerMotionValueDurationMs as collapseMotionDurationMs } from './ReaderMotionDurationPolicy';

export const READER_REDUCE_MOTION_STORAGE_KEY: string = 'readerReduceMotion';
export const READER_SYSTEM_REDUCE_MOTION_STORAGE_KEY: string = 'readerSystemReduceMotion';

/** Single read of the persisted motion preference for non-Prop hosts. */
export function readerReduceMotionFromStorage(): boolean {
  return AppStorage.get<boolean>(READER_REDUCE_MOTION_STORAGE_KEY) === true;
}

function requireMotion(id: string): MotionSpecEntry {
  const entry = motionSpecGet(id);
  if (entry === undefined) {
    throw new Error(`MotionSpec: unknown motion id "${id}"`);
  }
  return entry;
}

export function readerMotionCurve(id: string): Curve | curves.ICurve {
  return requireMotion(id).curve;
}

/** Registered duration with the shared opacity fallback. */
export function readerMotionDurationMs(id: string, reduceMotion: boolean): number {
  return collapseMotionDurationMs(requireMotion(id).durationMs, reduceMotion);
}

/** Apply the same opacity clock to caller-supplied durations. */
export function readerMotionValueDurationMs(durationMs: number, reduceMotion: boolean): number {
  return collapseMotionDurationMs(durationMs, reduceMotion);
}

/** With reduced motion the caller applies this parameter only to opacity. */
export function readerMotionAnimateParam(id: string, reduceMotion: boolean, onFinish?: () => void): AnimateParam {
  return reduceMotion ? readerMotionReducedFadeParam(onFinish) : motionAnimateParam(id, onFinish);
}

/** A reduced-motion transition whose caller animates only opacity. */
export function readerMotionReducedFadeParam(onFinish?: () => void): AnimateParam {
  return motionAnimateParam('app.motion.reduced.fade', onFinish);
}
