import type { JsonObject } from '@reader/core-harmony';

export type BookSearchTiming = {
  latencyMs: number;
  latencyKind: 'search';
  latencyMeasuredAt: number;
};

/** Reader's source-version-bound search fact. Legacy body respondTime and
 * timing from another source rule cannot represent this request stage. */
export function readBookSearchTiming(acquisition: unknown,
  sourceVersion: string | undefined): BookSearchTiming | undefined {
  if (acquisition === null || typeof acquisition !== 'object' || Array.isArray(acquisition) ||
    sourceVersion === undefined || sourceVersion.length === 0) return undefined;
  const facts = acquisition as JsonObject;
  const value = facts['searchTiming'];
  if (facts['sourceVersion'] !== sourceVersion || value === null || typeof value !== 'object' ||
    Array.isArray(value)) return undefined;
  const timing = value as JsonObject;
  if (timing['kind'] !== 'search' || timing['sourceVersion'] !== sourceVersion ||
    typeof timing['durationMs'] !== 'number' || !Number.isSafeInteger(timing['durationMs']) ||
    timing['durationMs'] < 0 || timing['durationMs'] > 0xFFFFFFFF ||
    typeof timing['measuredAt'] !== 'number' || !Number.isSafeInteger(timing['measuredAt']) ||
    timing['measuredAt'] <= 0) return undefined;
  return { latencyMs: timing['durationMs'] as number, latencyKind: 'search',
    latencyMeasuredAt: timing['measuredAt'] as number };
}
