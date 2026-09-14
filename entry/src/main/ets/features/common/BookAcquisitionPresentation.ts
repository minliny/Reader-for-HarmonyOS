import type { JsonObject } from '@reader/core-harmony';

const ACQUISITION_FRESH_MS = 24 * 60 * 60 * 1000;
function currentFacts(facts: JsonObject | undefined, sourceVersion: string): boolean {
  return facts !== undefined && sourceVersion.length > 0 && facts['sourceVersion'] === sourceVersion && facts['stale'] !== true;
}
function stamp(facts: JsonObject, key: string): number {
  return typeof facts[key] === 'number' ? facts[key] as number : 0;
}
function fresh(at: number, now: number): boolean { return at > 0 && now >= at && now - at < ACQUISITION_FRESH_MS; }

/** Core's derived validity flag binds the actual verified chapter and all evidence versions. */
export function acquisitionReadableCurrent(facts: JsonObject | undefined, sourceVersion: string,
  now: number = Date.now()): boolean {
  return facts !== undefined && currentFacts(facts, sourceVersion) && facts['schemaVersion'] === 2 && facts['verificationCurrent'] === true &&
    stamp(facts, 'catalogCount') > 0 && fresh(stamp(facts, 'catalogAt'), now) && fresh(stamp(facts, 'readableAt'), now);
}

/** Only current detail/catalog admission failure applies to the whole candidate. */
export function acquisitionBookFailureCurrent(facts: JsonObject | undefined, sourceVersion: string,
  now: number = Date.now()): boolean {
  if (facts === undefined || !currentFacts(facts, sourceVersion) || facts['schemaVersion'] !== 2 || facts['failureCurrent'] !== true) return false;
  const raw = facts['failure'];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const failure = raw as JsonObject;
  if (failure['schemaVersion'] !== 2 || failure['stage'] !== 'failed' || failure['sourceVersion'] !== sourceVersion ||
    (failure['failureStage'] !== 'detail' && failure['failureStage'] !== 'catalog')) return false;
  const at = stamp(failure, 'checkedAt');
  return fresh(at, now) && at > Math.max(stamp(facts, 'catalogAt'), stamp(facts, 'readableAt'));
}

/** Shared Search/Source Switch display policy: readable, catalog, unknown, failed. */
export function acquisitionCandidateRank(facts: JsonObject | undefined, sourceVersion: string,
  now: number = Date.now()): number {
  if (facts === undefined || !currentFacts(facts, sourceVersion)) return 2;
  if (acquisitionBookFailureCurrent(facts, sourceVersion, now)) return 3;
  if (acquisitionReadableCurrent(facts, sourceVersion, now)) return 0;
  return stamp(facts, 'catalogCount') > 0 && fresh(stamp(facts, 'catalogAt'), now) ? 1 : 2;
}
