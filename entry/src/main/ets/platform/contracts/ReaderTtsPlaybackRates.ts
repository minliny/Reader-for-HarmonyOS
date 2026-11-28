export const READER_TTS_RATE_MIN = 0.5;
export const READER_TTS_RATE_MAX = 2;
/** Product speed precision: integer percentages 50..200 in five-point steps. */
export const READER_TTS_RATE_STEP = 0.05;
export const READER_TTS_RATE_STEP_SCALE = 1 / READER_TTS_RATE_STEP;

export function isReaderTtsSupportedPlaybackRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= READER_TTS_RATE_MIN && rate <= READER_TTS_RATE_MAX &&
    Math.abs(rate * READER_TTS_RATE_STEP_SCALE - Math.round(rate * READER_TTS_RATE_STEP_SCALE)) <= 1e-9;
}

export function readerTtsSupportedPlaybackRates(): number[] {
  const rates: number[] = [];
  const first = Math.round(READER_TTS_RATE_MIN * READER_TTS_RATE_STEP_SCALE);
  const last = Math.round(READER_TTS_RATE_MAX * READER_TTS_RATE_STEP_SCALE);
  for (let step = first; step <= last; step += 1) rates.push(step / READER_TTS_RATE_STEP_SCALE);
  return rates;
}
