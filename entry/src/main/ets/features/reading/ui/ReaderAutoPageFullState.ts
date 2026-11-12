/**
 * Pure configuration bounds for the Phone Full Auto Page panel.
 *
 * Figma source `1764:10223` exposes a 0–180 minute wheel, a 0–59 second
 * wheel, a 2–20 second page interval, and a follow-highlight switch. This
 * file owns only those typed UI constraints; the reading experience remains
 * the sole owner of timers, page commits, and lifecycle interruption.
 */
export const READER_AUTO_PAGE_FULL_MIN_MINUTES = 0;
export const READER_AUTO_PAGE_FULL_MAX_MINUTES = 180;
export const READER_AUTO_PAGE_FULL_MIN_SECONDS = 0;
export const READER_AUTO_PAGE_FULL_MAX_SECONDS = 59;
export const READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS = 2;
export const READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS = 20;

export type ReaderAutoPageFullConfiguration = {
  timerMinutes: number;
  timerSeconds: number;
  speedSeconds: number;
  followHighlight: boolean;
};

export function createDefaultReaderAutoPageFullConfiguration(): ReaderAutoPageFullConfiguration {
  return {
    // Figma Phone Full endpoint `1771:10280` displays a real 15:00
    // selection. Keep the state and the rendered wheel on that same source
    // value instead of pairing a hard-coded summary with a 00:00 model.
    timerMinutes: 15,
    timerSeconds: 0,
    speedSeconds: 8,
    followHighlight: false,
  };
}

export function normalizeReaderAutoPageFullConfiguration(
  value: ReaderAutoPageFullConfiguration,
): ReaderAutoPageFullConfiguration {
  return {
    timerMinutes: clampInteger(value.timerMinutes,
      READER_AUTO_PAGE_FULL_MIN_MINUTES, READER_AUTO_PAGE_FULL_MAX_MINUTES),
    timerSeconds: clampInteger(value.timerSeconds,
      READER_AUTO_PAGE_FULL_MIN_SECONDS, READER_AUTO_PAGE_FULL_MAX_SECONDS),
    speedSeconds: clampInteger(value.speedSeconds,
      READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS, READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS),
    followHighlight: value.followHighlight === true,
  };
}

export function stepReaderAutoPageFullTimer(
  value: ReaderAutoPageFullConfiguration,
  unit: 'minutes' | 'seconds',
  delta: -1 | 1,
): ReaderAutoPageFullConfiguration {
  const current = normalizeReaderAutoPageFullConfiguration(value);
  if (unit === 'minutes') {
    return {
      ...current,
      timerMinutes: clampInteger(current.timerMinutes + delta,
        READER_AUTO_PAGE_FULL_MIN_MINUTES, READER_AUTO_PAGE_FULL_MAX_MINUTES),
    };
  }
  return {
    ...current,
    timerSeconds: clampInteger(current.timerSeconds + delta,
      READER_AUTO_PAGE_FULL_MIN_SECONDS, READER_AUTO_PAGE_FULL_MAX_SECONDS),
  };
}

export function setReaderAutoPageFullSpeed(
  value: ReaderAutoPageFullConfiguration,
  speedSeconds: number,
): ReaderAutoPageFullConfiguration {
  const current = normalizeReaderAutoPageFullConfiguration(value);
  return {
    ...current,
    speedSeconds: clampInteger(speedSeconds,
      READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS, READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS),
  };
}

export function setReaderAutoPageFullFollowHighlight(
  value: ReaderAutoPageFullConfiguration,
  followHighlight: boolean,
): ReaderAutoPageFullConfiguration {
  const current = normalizeReaderAutoPageFullConfiguration(value);
  return {
    ...current,
    followHighlight,
  };
}

export function formatReaderAutoPageFullWheelValue(value: number): string {
  const normalized = Math.max(0, Math.trunc(value));
  return normalized < 10 ? `0${normalized}` : `${normalized}`;
}

export function readerAutoPageFullTimerDurationSeconds(
  value: ReaderAutoPageFullConfiguration,
): number {
  const normalized = normalizeReaderAutoPageFullConfiguration(value);
  return (normalized.timerMinutes * 60) + normalized.timerSeconds;
}

export function formatReaderAutoPageFullTimerSummary(
  value: ReaderAutoPageFullConfiguration,
): string {
  const normalized = normalizeReaderAutoPageFullConfiguration(value);
  return `${formatReaderAutoPageFullWheelValue(normalized.timerMinutes)}:` +
    formatReaderAutoPageFullWheelValue(normalized.timerSeconds);
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum;
  }
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}
