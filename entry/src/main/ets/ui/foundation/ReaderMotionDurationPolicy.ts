import { READER_REDUCED_FADE_MS } from './ProductMotionTiming.ts';

/** Clock for callers that replace spatial motion with opacity. */
export function readerMotionValueDurationMs(durationMs: number, reduceMotion: boolean): number {
  return reduceMotion ? READER_REDUCED_FADE_MS : Math.max(0, durationMs);
}
