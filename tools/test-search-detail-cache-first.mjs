import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const index = read('pages/Index.ets');
const entry = read('features/reading/ReadingEntryHost.ts');
const coordinator = read('app/BookAcquisitionCoordinator.ts');
assert.match(entry, /group = shelf === undefined && input\.fromSearch === true && input\.sourceSwitchPending !== true &&\s*!membership\.blocked && !membership\.value/,
  'automatic candidate recovery is restricted to an unshelved search preview without a pending explicit switch');
const remoteStart = index.indexOf('private openRemoteBookDetail(');
const fallbackStart = entry.indexOf('group = shelf === undefined');
assert.ok(remoteStart >= 0 && fallbackStart >= 0);
assert.match(entry.slice(entry.indexOf('async openRemote('), fallbackStart),
  /if \(input\.resumeImmediately\) \{[\s\S]*return;\s*\}/,
  'direct reading returns before candidate fallback or acquisition; it must keep the selected identity');
assert.match(entry, /acquireCandidateGroup\(candidates, \{ isCurrent: admissionCurrent, requireReadable: true,[\s\S]*onCatalog:/);
assert.match(entry, /acquireBookWithBackgroundRefresh\(seed, \{ isCurrent: current \}\)/,
  'fixed shelf/manual identities retain single-book admission');
assert.doesNotMatch(index, /private async openSearchSessionCacheFirst/, 'remove the unused helper formerly covered by a misleading source assertion');
assert.doesNotMatch(index, /SEARCH_DETAIL_HEDGE_DELAY_MS|SEARCH_DETAIL_WARMUP_LIMIT|openSearchSessionWithFallback/,
  'page-local hedging and top-two caches must be removed');
assert.match(coordinator, /facts\?\.\['sourceVersion'\] === version/,
  'prepared sessions require the real source version');
assert.match(coordinator, /gateway\.openCachedCatalogSession/);
assert.match(coordinator, /gateway\.openSession/);
assert.match(entry, /this\.runtime\.bookAcquisitions\(\)\.acquireBook\(seed, \{ forceRefresh: true, isCurrent: current \}\)/,
  'background refresh has process ownership');
assert.match(index, /this\.route === 'detail' && !this\.readingSessionActive/,
  'late catalog publication must not replace an active reader');
console.log('search detail shared cache admission wiring: PASS');

const { fixture, seed, book, until } = await import('./lib/reading-entry-index-fixture.mjs');
// Complete production Entry+Coordinator+Gateways: unreadable selected identity
// may fall back only for an exact absent, unblocked unshelved search admission.
for (const mode of ['unshelved-search', 'shelved-search', 'manual', 'pending-switch', 'membership-unknown', 'resume']) {
  const f = fixture(); for (const i of [0, 1, 2]) f.bodies.set(f.key('s1', 'book') + ':' + i, '章节内容正在加载，请稍候...');
  if (mode === 'shelved-search') f.shelves.set(f.key('s1', 'book'), book());
  if (mode === 'membership-unknown') f.control.blocked = true;
  await f.host.openRemote({ seed: seed(), sourceName: 'Source', fromSearch: mode !== 'manual',
    sourceSwitchPending: mode === 'pending-switch', resumeImmediately: mode === 'resume',
    fallbackSeeds: [seed('fallback', 's2')], fallbackSourceNames: ['Fallback'] }, f.lease);
  if (mode === 'unshelved-search') { await until(() => f.host.snapshot().verdict === 'readable'); assert.equal(f.host.snapshot().book.sourceId, 's2'); }
  else { assert.equal(f.host.snapshot().book.sourceId, 's1'); assert.equal(f.calls.some(c => c.p?.sourceId === 's2'), false); }
  if (mode === 'resume') assert.equal(f.calls.length, 0);
  else if (mode !== 'manual') assert.equal(f.calls.find(c => c.method === 'bookshelf.get').p.bookId, 'book');
  f.close();
}
console.log('actual Entry precise membership/candidate boundary matrix: PASS');
