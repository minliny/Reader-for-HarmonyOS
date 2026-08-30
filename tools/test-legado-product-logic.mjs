import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const index = read('entry/src/main/ets/pages/Index.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');
const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const shelfFlow = read('entry/src/main/ets/features/bookshelf/BookshelfFlowGateway.ts');
const shelfMoreMenu = read('entry/src/main/ets/features/bookshelf/BookshelfMoreMenu.ets');
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
// SHF-02/03: the main shelf projects recent-reading order, group filtering,
// and a foreground shelf-wide update queue; the previously dead filter control
// now owns the tools row, so the deferral is superseded by wired intent.
assert.match(shelfFlow, /sortBy: 'lastReadAt', sortDirection: 'descending'/,
  'SHF-02: the shelf load must default to recent-reading order');
assert.match(shelf, /filterRowVisible = !this\.filterRowVisible/,
  'SHF-02: the filter control must toggle the shelf tools row');
assert.match(shelf, /LazyForEach\(this\.bookDataSource/,
  'SHF-02: long shelf lists must use a notifying lazy projection');
assert.match(shelf, /private rebuildShelfProjection\(\)/,
  'SHF-02: group filtering and row projection must be rebuilt once per input change');
assert.match(shelf, /const seenGroups: Set<string>/,
  'SHF-02: group chips must derive from Core books without repeated linear scans');
assert.match(shelf, /检查更新/,
  'SHF-03: the tools row must present a manual shelf-wide update entry');
assert.match(shelf, /onCheckUpdatesRequested/,
  'SHF-03: the update chip must emit an intent, not run the sweep itself');
assert.match(index, /private startManualBookshelfUpdate\(\)/,
  'SHF-03: Index must own the foreground update queue');
assert.match(index, /onProgress\(completed, books\.length\)/,
  'SHF-03: the sweep must report chunk progress for the page');
assert.match(index, /bookshelfBackgroundRefreshRunning \|\| this\.bookshelfUpdateRunning/,
  'SHF-03: manual and background sweeps must stay mutually exclusive');
assert.match(shelf, /onManageGroups/,
  'SHF-02: the shelf more-menu must reach group management');
assert.match(shelfMoreMenu, /分组管理/,
  'SHF-02: the more-menu must present the group management entry');

assert.match(shelf, /Text\(`更新 \$\{book\.unreadCount\} 章`\)/);
assert.match(shelf, /Text\(this\.gridProgressLabel\(book\)\)/,
  'grid progress renders through the basis-point formatter');
assert.match(shelf, /已读 <1%/,
  'sub-1% progress stays visible instead of collapsing to 0%');

console.log('Legado product behavior contract: PASS');
