import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const index = read('pages/Index.ets');
const coordinator = read('app/BookAcquisitionCoordinator.ts');
assert.match(index, /allowGroupFallback = shelfSnapshot === undefined && originRoute === 'search' &&\s*this\.pendingSourceSwitch === undefined/,
  'automatic candidate recovery is restricted to an unshelved search preview without a pending explicit switch');
const remoteStart = index.indexOf('private openRemoteBookDetail(');
const fallbackStart = index.indexOf('let allowGroupFallback =', remoteStart);
assert.ok(remoteStart >= 0 && fallbackStart > remoteStart);
assert.match(index.slice(remoteStart, fallbackStart),
  /if \(resumeImmediately\) \{[\s\S]*this\.openReading\(undefined\);\s*return;\s*\}/,
  'direct reading returns before candidate fallback or acquisition; it must keep the selected identity');
assert.match(index, /acquireCandidateGroup\(candidates, \{ isCurrent, requireReadable: true, onCatalog: showCandidateCatalog \}\)/);
assert.match(index, /acquireBookWithBackgroundRefresh\(seed, \{ isCurrent \}\)/,
  'fixed shelf/manual identities retain single-book admission');
assert.doesNotMatch(index, /private async openSearchSessionCacheFirst/, 'remove the unused helper formerly covered by a misleading source assertion');
assert.doesNotMatch(index, /SEARCH_DETAIL_HEDGE_DELAY_MS|SEARCH_DETAIL_WARMUP_LIMIT|openSearchSessionWithFallback/,
  'page-local hedging and top-two caches must be removed');
assert.match(coordinator, /facts\?\.\['sourceVersion'\] === version/,
  'prepared sessions require the real source version');
assert.match(coordinator, /gateway\.openCachedCatalogSession/);
assert.match(coordinator, /gateway\.openSession/);
assert.match(index, /owner\.bookAcquisitions\(\)\.acquireBook\(seed, \{ forceRefresh: true \}\)/,
  'background refresh has process ownership');
assert.match(index, /this\.route === 'detail' && !this\.readingSessionActive/,
  'late catalog publication must not replace an active reader');
console.log('search detail shared cache admission wiring: PASS');
