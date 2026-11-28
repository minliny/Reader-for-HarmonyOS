export type ReadingPhase = 'loading' | 'measuring' | 'ready' | 'failed';

/** Preserve the phase-specific publication boundary when unrelated fields in
 * the same render snapshot change. Phase observers read the committed value
 * synchronously, including when they schedule a successor transition. */
export function publishReadingPresentationPhase(previous: ReadingPhase, next: ReadingPhase,
  publish: (phase: ReadingPhase) => void, changed: () => void): void {
  if (previous === next) return;
  publish(next);
  changed();
}

export interface ReadingOptionalRenderValue<T> {
  readonly value: T | undefined;
}
