/** Shared reduce-motion collapse for caller-supplied motion clocks. */
export function readerMotionValueDurationMs(durationMs: number, reduceMotion: boolean): number {
  return reduceMotion ? 0 : Math.max(0, durationMs);
}
