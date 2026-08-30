import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');

const method = (start, end) => {
  const from = index.indexOf(start);
  const to = index.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing method slice: ${start}`);
  return index.slice(from, to);
};

const remoteOpen = method('private openRemoteBookDetail(', 'private async openSearchSessionCacheFirst(');
assert.match(remoteOpen,
  /shelfSnapshot !== undefined \?[\s\S]*?openCachedCatalogSession\(seed, isCurrent\)[\s\S]*?:\s*this\.openSearchSessionCacheFirst/,
  'search detail must use its cache-first dispatcher while shelf detail keeps its existing path');
assert.match(remoteOpen, /this\.openSearchSessionCacheFirst\(gateway, candidateSeeds, isCurrent\)/,
  'search detail must delegate to the real-time cache/online admission race');

const cacheFirst = method('private async openSearchSessionCacheFirst(', 'private openSearchSessionWithFallback(');
assert.match(cacheFirst,
  /const cacheAttempt = this\.openCachedSearchCandidate[\s\S]*const onlineAttempt =[\s\S]*firstSuccessfulDetailAdmission/,
  'cache admission and online detail/TOC must start together and first success must win');
assert.match(cacheFirst, /SEARCH_DETAIL_CACHE_PROBE_CONCURRENCY[\s\S]*Promise\.race\(Array\.from\(active\.values\(\)\)\)/,
  'same-book source variants must use one bounded local cache probe sweep');
assert.match(cacheFirst, /this\.searchWarmupForSeeds\(seeds\)/,
  'selection must join the exact bounded search-result warmup when available');
assert.match(index, /const SEARCH_DETAIL_WARMUP_LIMIT = 2/);
assert.match(index, /scheduleSearchDetailWarmups\(presentation\)/);

const fallback = method('private openSearchSessionWithFallback(', 'private refreshCachedSearchDetailInBackground(');
assert.match(fallback, /SEARCH_DETAIL_HEDGE_DELAY_MS/,
  'the clicked source must receive a bounded head start before an alternate is hedged');
assert.match(fallback, /active\.size < 2/,
  'online detail fallback must cap candidate concurrency at two');
assert.match(fallback, /Promise\.race\(racers\)/,
  'the first healthy same-book source must win without waiting for a slow sibling');
assert.match(fallback, /cancelled\.add\(activeIndex\)/,
  'losing candidate requests must observe cancellation after a winner is admitted');
assert.doesNotMatch(fallback, /this\.detailBook = this\.readingDetailForRemoteSeed/,
  'hedged attempts must not flicker the mounted detail shell between candidates');

const background = method('private refreshCachedSearchDetailInBackground(', 'private resolveRemoteDetailSourceName(');
assert.match(background, /this\.route === 'detail' && !this\.readingSessionActive/,
  'background refresh must stop before it can replace an active reader session');
assert.match(background, /this\.bookshelfRemovalActiveKey\.length === 0/,
  'background refresh must not race an explicit shelf mutation');
assert.match(background, /new RemoteReadingFlowGateway\(owner\)\.openSession\(seed, \{ isCurrent \}\)/,
  'online detail and TOC refresh must run outside cache admission');
assert.doesNotMatch(background, /this\.detailBook = undefined|this\.detailToc = \[\]/,
  'a background refresh failure must retain the admitted cache');

console.log('search detail cache-first contract: PASS');
