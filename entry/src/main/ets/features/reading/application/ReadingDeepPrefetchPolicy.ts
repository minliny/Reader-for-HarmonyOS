const READING_TRIAL_DURATION_MS = 300_000;
const READING_TRIAL_IDLE_MS = 60_000;
const IMMEDIATE_PREFETCH_RADIUS = 2;
const DEEP_PREFETCH_MAX_AHEAD = 15;
const DEEP_PREFETCH_LOW_WATER = 10;
export const DEEP_PREFETCH_STEP_INTERVAL_MS = 800;
const DEEP_PREFETCH_COOLDOWN_MS = 10 * 60 * 1000;

interface ReadingTrialProgress {
  elapsedMs: number;
  advanced: boolean;
}

interface ActiveReadingTrial {
  bookKey: string;
  observedAt: number;
  lastInteractionAt?: number;
  playing: boolean;
}

/** Accumulates per-book foreground time from Host activity and playback observations. */
export class ReadingTrialClock {
  private readonly progress: Map<string, ReadingTrialProgress> = new Map();
  private active?: ActiveReadingTrial;

  observe(bookKey: string, now: number, active: boolean, playing: boolean,
    advanced: boolean = false, interacted: boolean = advanced): void {
    now = Math.max(now, this.active?.observedAt ?? now);
    const prior = this.active?.bookKey === bookKey ? this.active : undefined;
    this.pause(now);
    if (!active) return;

    let progress = this.progress.get(bookKey);
    const firstObservation = progress === undefined;
    if (progress === undefined) {
      progress = { elapsedMs: 0, advanced: false };
      this.progress.set(bookKey, progress);
    }
    progress.advanced = progress.advanced || advanced;
    this.active = {
      bookKey, observedAt: now, playing,
      lastInteractionAt: interacted || advanced || firstObservation ? now : prior?.lastInteractionAt,
    };
  }

  pause(now: number): void {
    if (this.active === undefined) return;
    const progress = this.progress.get(this.active.bookKey);
    if (progress !== undefined) {
      progress.elapsedMs = Math.min(READING_TRIAL_DURATION_MS,
        progress.elapsedMs + this.elapsedSinceObservation(this.active, now));
    }
    this.active = undefined;
  }

  isUnlocked(bookKey: string, now: number, isOnShelf: boolean, readablePosition: number): boolean {
    if (isOnShelf && readablePosition >= 2) return true;
    const progress = this.progress.get(bookKey);
    return progress?.advanced === true && this.elapsedFor(bookKey, now, progress) >= READING_TRIAL_DURATION_MS;
  }

  unlockDelay(bookKey: string, now: number): number | undefined {
    const active = this.active;
    const progress = this.progress.get(bookKey);
    if (active?.bookKey !== bookKey || progress?.advanced !== true) return undefined;
    const remaining = Math.max(0, READING_TRIAL_DURATION_MS - this.elapsedFor(bookKey, now, progress));
    return remaining === 0 || now + remaining <= this.activityEndsAt(active) ? remaining : undefined;
  }

  private elapsedFor(bookKey: string, now: number, progress: ReadingTrialProgress): number {
    return progress.elapsedMs + (this.active?.bookKey === bookKey ? this.elapsedSinceObservation(this.active, now) : 0);
  }

  private elapsedSinceObservation(active: ActiveReadingTrial, now: number): number {
    return Math.max(0, Math.min(now, this.activityEndsAt(active)) - active.observedAt);
  }

  private activityEndsAt(active: ActiveReadingTrial): number {
    if (active.playing) return Number.POSITIVE_INFINITY;
    return active.lastInteractionAt === undefined ? active.observedAt : active.lastInteractionAt + READING_TRIAL_IDLE_MS;
  }
}

export interface ReadingPrefetchRange {
  startInclusive: number;
  endExclusive: number;
}

export function immediateReadingPrefetchWindow(readableIndexes: number[], currentPosition: number): ReadingPrefetchRange | undefined {
  if (!Number.isInteger(currentPosition) || currentPosition < 0 || currentPosition >= readableIndexes.length) return undefined;
  const start = Math.max(0, currentPosition - IMMEDIATE_PREFETCH_RADIUS);
  const end = Math.min(readableIndexes.length, currentPosition + IMMEDIATE_PREFETCH_RADIUS + 1);
  return { startInclusive: readableIndexes[start], endExclusive: readableIndexes[end - 1] + 1 };
}

export function hasDeepPrefetchLowWater(readableIndexes: number[], currentPosition: number,
  isCached: (chapterIndex: number) => boolean): boolean {
  const first = currentPosition + 1;
  const end = first + DEEP_PREFETCH_LOW_WATER;
  return end > readableIndexes.length || !readableIndexes.slice(first, end).every(isCached);
}

/** Selects a single miss in [+3, +15]. A refill already in progress can
 * advance past the low-water boundary if foreground work remains idle. */
export function nextDeepPrefetchChapter(readableIndexes: number[], currentPosition: number,
  isCached: (chapterIndex: number) => boolean, attempted: ReadonlySet<number>, refilling: boolean,
  highPriorityBusy: boolean): number | undefined {
  if (highPriorityBusy || !Number.isInteger(currentPosition) || currentPosition < 0 || currentPosition >= readableIndexes.length) {
    return undefined;
  }
  if (!refilling && !hasDeepPrefetchLowWater(readableIndexes, currentPosition, isCached)) return undefined;
  const end = Math.min(readableIndexes.length, currentPosition + 1 + DEEP_PREFETCH_MAX_AHEAD);
  for (let position = currentPosition + IMMEDIATE_PREFETCH_RADIUS + 1; position < end; position += 1) {
    const chapterIndex = readableIndexes[position];
    if (!attempted.has(chapterIndex) && !isCached(chapterIndex)) return chapterIndex;
  }
  return undefined;
}

export function deepPrefetchAllowed(contentKind: string | undefined, sourceId: string,
  unmeteredNetwork: boolean, storageAvailable: boolean): boolean {
  return contentKind === 'text' && sourceId !== 'local' && unmeteredNetwork && storageAvailable;
}

export type DeepPrefetchOutcome = 'success' | 'failed' | 'throttled';

interface DeepPrefetchFailures {
  failures: number;
  coolingUntil?: number;
}

/** Per-source circuit breaker. A successful chapter clears a failure streak. */
export class ReadingDeepPrefetchBreaker {
  private readonly states: Map<string, DeepPrefetchFailures> = new Map();

  blockedUntil(sourceId: string, now: number): number | undefined {
    const until = this.states.get(sourceId)?.coolingUntil;
    if (until !== undefined && now >= until) {
      this.states.delete(sourceId);
      return undefined;
    }
    return until;
  }

  record(sourceId: string, now: number, outcome: DeepPrefetchOutcome): void {
    if (this.blockedUntil(sourceId, now) !== undefined) return;
    if (outcome === 'success') {
      this.states.delete(sourceId);
      return;
    }
    const failures = (this.states.get(sourceId)?.failures ?? 0) + 1;
    this.states.set(sourceId, outcome === 'throttled' || failures >= 3 ?
      { failures: 0, coolingUntil: now + DEEP_PREFETCH_COOLDOWN_MS } : { failures });
  }
}
