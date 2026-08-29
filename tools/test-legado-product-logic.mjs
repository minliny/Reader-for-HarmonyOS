import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const index = read('entry/src/main/ets/pages/Index.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');
const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const remote = read('entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const sourceSwitchGateway = read('entry/src/main/ets/features/source/SourceSwitchGateway.ts');
const sourceSwitchWindow = read('entry/src/main/ets/features/source/SourceSwitchWindow.ets');
const sourceSwitchRow = read('entry/src/main/ets/features/source/CandidateRow.ets');

for (const declaration of [
  /const READING_CACHE_BEFORE = 2;/,
  /const READING_CACHE_AFTER = 2;/,
  /const CATALOG_REFRESH_NEAR_END = 3;/,
  /const CATALOG_REFRESH_INTERVAL_MS = 10 \* 60 \* 1000;/,
]) {
  assert.match(index, declaration);
}

assert.match(index, /private openShelfBook\([\s\S]*openRemoteBookDetail\([\s\S]*selection, true\);/,
  'a shelf tap must resume instead of stopping at detail');
assert.match(index, /gateway\.openCachedCatalogSession\(seed, isCurrent\)[\s\S]*\.catch\(\(\): Promise<RemoteReadingSession> => gateway\.openSession/,
  'a shelf cold start must admit the durable TOC before online recovery');
assert.match(index, /private addDetailBook\([\s\S]*\.upsertBook\([\s\S]*void this\.prefetchReadingWindow\(session\)/,
  'an explicit shelf join must immediately start the rolling cache window');
assert.match(index, /private applyReadingCommit\([\s\S]*this\.prefetchReadingWindow\(session, commit\.chapterIndex\)/,
  'each durable reading commit must maintain the rolling cache window');
assert.match(index, /session\.entries\.length - commit\.chapterIndex - 1 <= CATALOG_REFRESH_NEAR_END/,
  'reading near the current end must trigger a throttled TOC refresh');
assert.match(index, /for \(let start = 0; start < books\.length; start \+= 2\)[\s\S]*Promise\.all\(batch\.map/,
  'bookshelf updates must use a bounded two-book batch');
assert.match(index, /private onReadingFailure\([\s\S]*this\.startSourceDiscovery\(generation, true\)/,
  'remote read failure must enter the ranked automatic source-recovery seam');
assert.match(index,
  /if \(autoPickFirst\) \{[\s\S]*value\.isCurrent !== true[\s\S]*this\.onPickSource\(candidate\);/,
  'automatic recovery must skip the failed/current identity and use the normal transaction');
assert.match(index,
  /gateway\.loadCachedCandidates\(query, isCurrent\)[\s\S]*cached\.length > 0[\s\S]*gateway\.refreshCandidates/,
  'opening source switch must admit durable candidates before any remote refresh');
assert.match(sourceSwitchGateway, /const SOURCE_SWITCH_CACHE_TTL_MS = 24 \* 60 \* 60 \* 1000;/);
assert.match(sourceSwitchGateway,
  /'chapter\.content',[\s\S]*const latencyMs = Math\.max\(0, Date\.now\(\) - startedAt\)/,
  'response time must measure the mapped chapter body probe instead of a source ping');
assert.match(sourceSwitchGateway,
  /chapterWordCountText,[\s\S]*respondTime:[\s\S]*'search-book\.put'/,
  'chapter and response-time projections must be persisted through Core SearchBook storage');
assert.match(sourceSwitchWindow, /Refresh\(\{ refreshing: this\.isRefreshing\(\)/);
assert.match(sourceSwitchWindow, /\.onRefreshing\([\s\S]*this\.onRefresh\(\)/,
  'the candidate list pull gesture must own the explicit full refresh');
assert.match(sourceSwitchRow, /return this\.currentChapterTitle\.trim\(\)\.length > 0/,
  'the current-chapter column must render the persisted probe result');

assert.match(remote, /async openCachedCatalogSession\([\s\S]*acquisitionMode: 'online'/,
  'a cached catalog must retain online body fallback semantics');
assert.match(search, /this\.normalizedBookKey\(book\.title, book\.author\)/,
  'search results must group the same title and author across origins');
assert.match(search, /right\.sourceCount - left\.sourceCount/,
  'multi-origin search results must be promoted like Legado');
assert.match(search, /Text\('已在书架'\)/,
  'grouped search results must expose current shelf membership');
// ACQ-02 supersedes the P0-DEAD-CONTROL-CLEANUP deferral: scope chips and the
// stop control are now wired, so the surface must prove the intent exists.
assert.match(search, /搜索范围/,
  'ACQ-02: the scope control must be presented on the search surface');
assert.match(search, /toggleScopeSource/,
  'ACQ-02: scope chips must toggle real filter state');
assert.match(search, /onSearch\(keyword, scope\)/,
  'ACQ-02: submitting must forward the scope subset to the orchestrator');
assert.match(search, /onStop/,
  'ACQ-02: the search page must expose a stop intent for the live sweep');
assert.match(index, /stopSearch\(\)/,
  'ACQ-02: Index must wire the stop intent into the orchestrator');
assert.match(shelf, /Text\(`更新 \$\{book\.unreadCount\} 章`\)/);
assert.match(shelf, /Text\(this\.gridProgressLabel\(book\)\)/,
  'grid progress renders through the basis-point formatter');
assert.match(shelf, /已读 <1%/,
  'sub-1% progress stays visible instead of collapsing to 0%');

console.log('Legado product behavior contract: PASS');
