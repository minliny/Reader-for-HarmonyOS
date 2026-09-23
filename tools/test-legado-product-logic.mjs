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
const reading = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');

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
assert.match(index, /owner\.bookAcquisitions\(\)[\s\S]*\.acquireBookWithBackgroundRefresh\(seed, \{ isCurrent \}\)/,
  'a shelf cold start must admit the durable TOC before online recovery');
assert.match(read('entry/src/main/ets/app/ReaderCoreGateway.ts'), /\.addReadableBook\(params\)/,
  'remote shelf success requires the selected-source durable readable admission');
assert.match(index, /private applyReadingCommit\([\s\S]*this\.prefetchReadingWindow\(session, commit\.chapterIndex\)/,
  'each durable reading commit must maintain the rolling cache window');
assert.match(index, /session\.entries\.length - commit\.chapterIndex - 1 <= CATALOG_REFRESH_NEAR_END/,
  'reading near the current end must trigger a throttled TOC refresh');
assert.match(index, /for \(let start = 0; start < books\.length; start \+= 2\)[\s\S]*Promise\.all\(batch\.map/,
  'bookshelf updates must use a bounded two-book batch');
// PH116 explicitly keeps failures and recovery in the normal reading page.
// Neither acquisition failure nor error presentation may auto-pick a source.
const failureBlock = index.slice(index.indexOf('private onReadingFailure('), index.indexOf('private onRemoteSessionReady('));
assert.ok(failureBlock.length > 0, 'onReadingFailure must retain the current reader');
assert.match(reading, /const failureKind: RemoteReadingFailureKind = remoteReadingFailureKindOf\(error\)/,
  'the original typed failure remains available for diagnosis');
assert.doesNotMatch(failureBlock, /showAlertDialog|readingSessionActive = false|rollbackPendingSourceSwitch|returnToBookshelf/,
  'body failure must not remove the reader or compensate a source switch automatically');
assert.match(reading, /Button\('重试'\)/);
assert.match(reading, /Button\('阅读设置'\)/);
assert.match(reading, /Button\('切换书源'\)/);
assert.doesNotMatch(failureBlock, /startSourceDiscovery/,
  'read failure must never auto-open or auto-pick source discovery');
assert.doesNotMatch(failureBlock, /automaticSourceRecoveryKey/,
  'the automatic recovery latch is retired together with the auto-switch path');
assert.match(index,
  /if \(autoPickFirst\) \{[\s\S]*value\.isCurrent !== true[\s\S]*this\.onPickSource\(candidate\);/,
  'the discovery auto-pick branch stays available only to explicit non-failure callers');
assert.match(index, /gateway\.loadCachedCandidates\(query, isCurrent, known\)/,
  'source picker reads the same durable candidates as search');
assert.match(index, /gateway\.refreshCandidates\(query, isCurrent,[\s\S]{0,150}searchedSourceIds\(\)/,
  'an empty picker only discovers sources not already dispatched by its search');
assert.match(sourceSwitchGateway, /const SOURCE_SWITCH_CACHE_TTL_MS = 24 \* 60 \* 60 \* 1000;/);
assert.match(sourceSwitchGateway, /acquisitionState = stale/,
  'cache expiry is explicit and retains previous source information');
assert.doesNotMatch(sourceSwitchGateway, /bookAcquisitions\?\.\(\)\.prepare/,
  'candidate discovery must not enqueue an unbounded speculative body sweep');
assert.match(sourceSwitchRow, /acquisitionState === 'catalogReady'/);
assert.match(sourceSwitchRow, /acquisitionState === 'readable'/,
  'a discovered source must not be labeled readable');

assert.match(remote, /async openCachedCatalogSession\([\s\S]*acquisitionMode: contextIsCurrent && !cached\.requiresContextRefresh \? 'online' : 'offline'/,
  'only current continuation context enables online fallback; stale or deleted source remains offline-readable');
assert.match(search, /this\.normalizedBookKey\(book\.title, book\.author\)/,
  'search results must group the same title and author across origins');
// Ordering is a behavior contract: relevance may move a late exact title
// ahead of fan fiction, but ties and a retained viewport must remain stable.
// Execute the real production grouping/data-source/anchor regression rather
// than fixing the comparator to one spelling of its intermediate keys.
await import('./test-search-view-state.mjs');
assert.match(search, /Text\('已在书架'\)/,
  'grouped search results must expose current shelf membership');
// ACQ-02 keeps the canonical result-chip surface. Current Local/Online tabs
// filter one unified session; explicit query submissions still forward scope.
assert.match(search, /groupScopeRow\(\)/,
  'the search surface must present the source-group chip row under the bar');
assert.match(search, /selectGroup\(/,
  'group chips must apply the current result category');
assert.match(search, /return \['本地', '在线'\]/, 'result tabs filter one unified session');
assert.match(search, /onSearch\(keyword, scope\)/,
  'ACQ-02: submitting must forward the scope subset to the orchestrator');
assert.match(search, /onStop/,
  'ACQ-02: the search page must expose a stop intent for the live sweep');
assert.match(index, /stopSearch\(\)/,
  'ACQ-02: Index must wire the stop intent into the orchestrator');
// SHF-02/03: the main shelf projects recent-reading order, state/type filtering,
// and a foreground shelf-wide update queue; the previously dead filter control
// now owns the tools row, so the deferral is superseded by wired intent.
assert.match(shelfFlow, /sortBy: 'lastReadAt', sortDirection: 'descending'/,
  'SHF-02: the shelf load must default to recent-reading order');
assert.match(shelf, /filterRowVisible = !this\.filterRowVisible/,
  'SHF-02: the filter control must toggle the shelf tools row');
assert.match(shelf, /LazyForEach\(this\.rowDataSource/,
  'SHF-02: long shelf lists must use one notifying lazy projection shared by both modes');
assert.doesNotMatch(shelf, /bookDataSource/,
  'SHF-02: cover/list switching must not duplicate the lazy data source');
assert.match(shelf, /private rebuildShelfProjection\(\)/,
  'SHF-02: filtering and row projection must be rebuilt once per input change');
assert.match(shelf, /ShelfBookPresentation\.visible\(this\.books, '', this\.readingFilter, this\.sourceFilter\)/,
  'SHF-02 revised: the removed group entry cannot leave an unreachable group condition');
assert.match(shelfMoreMenu, /检查更新/,
  'SHF-03: More must present a manual shelf-wide update entry');
assert.match(shelf, /onCheckUpdatesRequested/,
  'SHF-03: the update menu item must emit an intent, not run the sweep itself');
assert.match(index, /private startManualBookshelfUpdate\(\)/,
  'SHF-03: Index must own the foreground update queue');
assert.match(index, /onProgress\(completed, books\.length\)/,
  'SHF-03: the sweep must report chunk progress for the page');
assert.match(index, /bookshelfBackgroundRefreshRunning \|\| this\.bookshelfUpdateRunning/,
  'SHF-03: manual and background sweeps must stay mutually exclusive');
assert.match(shelf, /onBookGroupRequested/,
  'explicit per-book grouping is isolated from opening the shelf tool');
assert.doesNotMatch(shelfMoreMenu, /分组管理/,
  'the approved four-item More menu does not expose the legacy group editor');

assert.match(shelf, /Text\(`更新 \$\{book\.unreadCount\} 章`\)/);
assert.match(shelf, /Text\(this\.gridProgressLabel\(book\)\)/,
  'grid progress renders through the basis-point formatter');
assert.match(shelf, /已读 <1%/,
  'sub-1% progress stays visible instead of collapsing to 0%');

console.log('Legado product behavior contract: PASS');
