import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const index = read('pages/Index.ets');
const coordinator = read('app/BookAcquisitionCoordinator.ts');
assert.match(index, /const allowGroupFallback = shelfSnapshot === undefined && !resumeImmediately && originRoute === 'search'/,
  'automatic candidate recovery is restricted to a search preview');
assert.match(index, /acquireCandidateGroup\(candidates, \{ isCurrent \}\)/);
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
