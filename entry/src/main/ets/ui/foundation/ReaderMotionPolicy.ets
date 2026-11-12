import curves from '@ohos.curves';
import { motionAnimateParam, motionSpecGet, MotionSpecEntry } from './MotionSpec';
import { readerMotionValueDurationMs as collapseMotionDurationMs } from './ReaderMotionDurationPolicy';

export const READER_REDUCE_MOTION_STORAGE_KEY: string = 'readerReduceMotion';

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

/** Registered duration with the one reduce-motion collapse applied. */
export function readerMotionDurationMs(id: string, reduceMotion: boolean): number {
  return reduceMotion ? 0 : requireMotion(id).durationMs;
}

/** Collapse a caller-supplied motion clock through the same reduce-motion rule
 * used by registered MotionSpec entries. Specialized motion domains may keep
 * their own nominal-duration selection, but must not reimplement this branch.
 */
export function readerMotionValueDurationMs(durationMs: number, reduceMotion: boolean): number {
  return collapseMotionDurationMs(durationMs, reduceMotion);
}

/** Registered AnimateParam; reduce motion keeps the curve but drops the clock. */
export function readerMotionAnimateParam(id: string, reduceMotion: boolean, onFinish?: () => void): AnimateParam {
  if (!reduceMotion) return motionAnimateParam(id, onFinish);
  const curve = requireMotion(id).curve;
  if (onFinish === undefined) return { duration: 0, curve };
  return { duration: 0, curve, onFinish };
}
