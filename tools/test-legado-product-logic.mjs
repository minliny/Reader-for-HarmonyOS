import { readingPrefetchOwnerProbe } from './lib/reading-prefetch-owner-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const index = read('entry/src/main/ets/pages/Index.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');
const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const shelfFlow = read('entry/src/main/ets/features/bookshelf/BookshelfFlowGateway.ts');
const shelfMoreMenu = read('entry/src/main/ets/features/bookshelf/BookshelfMoreMenu.ets');
const remote = read('entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const entryHost = read('entry/src/main/ets/features/reading/ReadingEntryHost.ts');
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
  assert.match(read('entry/src/main/ets/features/reading/ReadingPrefetchHost.ts'), declaration);
}

assert.match(index, /private openShelfBook\([\s\S]*openRemoteBookDetail\([\s\S]*selection, true\);/,
  'a shelf tap must resume instead of stopping at detail');
assert.match(entryHost, /const coordinator = this\.runtime\.bookAcquisitions\(\);[\s\S]*coordinator\.acquireBookWithBackgroundRefresh\(seed, \{ isCurrent: current \}\)/,
  'a shelf cold start must admit the durable TOC before online recovery');
assert.match(read('entry/src/main/ets/app/ReaderCoreGateway.ts'), /\.addReadableBook\(params\)/,
  'remote shelf success requires the selected-source durable readable admission');
assert.match(index, /private applyReadingCommit\([\s\S]*this\.prefetchReadingWindow\(session, commit\.chapterIndex\)/,
  'each durable reading commit must maintain the rolling cache window');
assert.match(index, /if \(this\.isRemoteCatalogNearEnd\(session, commit\.chapterIndex\)\) \{\s*this\.refreshRemoteCatalogNearEnd\(session\);/,
  'reading near the current end must trigger a throttled TOC refresh');
const boundaryRuntime={};
const boundaryProbe=readingPrefetchOwnerProbe(()=>boundaryRuntime);
const CatalogBoundary = productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  ['isRemoteCatalogNearEnd'], boundaryProbe);
const catalogBoundary = Object.assign(new CatalogBoundary(),{mountedRuntimeOwner:boundaryRuntime});
const sparseCatalog = { entries: [10, 20, 30, 40, 50, 60, 70].map((chapterIndex, position) =>
  ({ index: chapterIndex, url: position < 5 ? `https://source.invalid/${chapterIndex}` : '' })) };
assert.equal(catalogBoundary.isRemoteCatalogNearEnd(sparseCatalog, 10), false,
  'four remaining readable chapters are outside the refresh boundary regardless of ordinal gaps');
for (const chapterIndex of [20, 30, 40, 50]) {
  assert.equal(catalogBoundary.isRemoteCatalogNearEnd(sparseCatalog, chapterIndex), true,
    'the last three readable successors ignore trailing volume headings');
}
for (const chapterIndex of [60, 99]) assert.equal(catalogBoundary.isRemoteCatalogNearEnd(sparseCatalog, chapterIndex), false);
// Groups consume canonical indexes but never the readable-neighbour budget.
// Execute the real refresh/prefetch and independent shelf-owner regressions.
await import('./test-reader-directory-business-boundaries.mjs');
assert.match(read('entry/src/main/ets/features/bookshelf/BookshelfCatalogUpdate.ts'), /for \(let start = 0; start < targets\.length; start \+= 2\)[\s\S]*Promise\.all\(batch\.map/,
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
const sourceOwner=read('entry/src/main/ets/features/source/SourceSwitchHost.ts');
assert.doesNotMatch(sourceOwner, /autoPickFirst|automaticSourceRecoveryKey/,
  'the unused explicit auto-pick path is retired; only a user candidate intent dispatches a source mutation');
assert.match(index, /private onPickSource[\s\S]*this\.sourceSwitchHost\?\.pick\(candidate, scopeId\)/,
  'physical source choice delegates its captured scope to the original owner');
assert.match(sourceOwner, /const knownCandidates = \(\): SourceSwitchCandidate\[\] => context\.readKnownCandidates\?\.\(\) \?\? context\.knownCandidates/,
  'late search publications are captured through the current known-candidate port');
assert.match(sourceOwner, /this\.gateway\.loadCachedCandidates\(context\.query, current, knownCandidates\(\)/,
  'source owner reads the same durable candidates as search');
assert.match(sourceOwner, /this\.gateway\.refreshCandidates\(context\.query,[\s\S]{0,200}context\.searchedSourceIds/,
  'an empty picker only discovers sources not already dispatched by its search');
assert.match(sourceSwitchGateway, /const SOURCE_SWITCH_CACHE_TTL_MS = 24 \* 60 \* 60 \* 1000;/);
assert.match(sourceSwitchGateway, /acquisitionState = stale/,
  'cache expiry is explicit and retains previous source information');
assert.doesNotMatch(sourceSwitchGateway, /bookAcquisitions\?\.\(\)\.prepare/,
  'candidate discovery must not enqueue an unbounded speculative body sweep');
assert.match(sourceSwitchRow, /acquisitionState === 'catalogReady'/);
assert.match(sourceSwitchRow, /acquisitionState === 'readable'/,
  'a discovered source must not be labeled readable');
assert.match(sourceSwitchWindow, /build\(\)\s*\{\s*Stack\(\{ alignContent: Alignment\.Bottom \}\)/,
  'both formats use the selected bottom-aligned live source drawer');
assert.match(sourceSwitchWindow, /\.width\('100%'\)\.constraintSize\(\{ maxWidth: SOURCE_SWITCH_VISUAL\.drawerMaxWidth \}\)\.height\(this\.drawerHeight\(\)\)/,
  'the shared source drawer derives its bounded extent from the actual host viewport');
assert.match(sourceSwitchWindow, /backgroundColor\(readerAppColor\('TOK_SS_WINDOW_BG'/,
  'both formats retain the selected themed source-drawer paper');
assert.doesNotMatch(sourceSwitchWindow, /resolvePopupSpec\('source-switch-window'\)|this\.surfaceSpec\(\)\.height/,
  'the live picker is not clipped to the retired 300 by 385 popup');
assert.match(sourceSwitchWindow, /readerInteractiveSafeLeft\(metrics\)[\s\S]*readerInteractiveSafeRight\(ReaderWindowCoordinator\.metrics\(\)\)/,
  'source-switch keeps asymmetric safe edges for both phone and tablet hosts');
assert.match(sourceSwitchWindow, /padding\(\{ left: this\.novelSafeLeft\(\) \+ this\.sideInset\(\), right: this\.novelSafeRight\(\) \+ this\.sideInset\(\), bottom: this\.safeBottom\(\) \}\)/,
  'both formats keep asymmetric safe edges and bottom clearance inside the responsive drawer');
assert.match(sourceSwitchWindow, /contentStartOffset\(this\.listStartInset\(\)\)\.contentEndOffset\(0\)/,
  'both result lists avoid duplicating the shared drawer safe-edge clearance');
assert.doesNotMatch(sourceSwitchWindow, /new SurfaceWidthSpec\(300, 0, 0, 'center'\)/,
  'source-switch consumer does not duplicate its outer width');

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
assert.match(shelf, /ShelfBookPresentation\.visible\(this\.books, '', 'all', this\.sourceFilter\)/,
  'SHF-02 revised: the removed group entry cannot leave an unreachable group condition');
assert.match(shelfMoreMenu, /检查更新/,
  'SHF-03: More must present a manual shelf-wide update entry');
// SHF-03 moved with the persistent chrome. Execute the actual More -> Shell
// guard -> Index callback instead of looking for an obsolete Page field.
const shellFile = new URL('../entry/src/main/ets/features/bookshelf/BookshelfShell.ets', import.meta.url);
const ShellUpdate = productionMotionMethods(shellFile, ['moreIntentAction','dismissMoreMenu','requestCheckUpdates']);
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
function suppliedCallback(text, component, property, owner) {
  const tree = ts.createSourceFile('ShelfUpdateContract.ets', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0);
  const calls = [];
  const visit = node => {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && node.expression.getText(tree) === component) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.equal(calls.length, 1, `one production ${component} owner`);
  const value = calls[0].arguments[0].properties.find(node => node.name?.getText(tree) === property);
  assert.ok(value, `${component} forwards ${property}`);
  return new Function(`return ${stripTypeScriptTypes(value.initializer.getText(tree))};`).call(owner);
}
let updateIntents = 0;
const shellUpdate = Object.assign(new ShellUpdate(), { mounted:true, moreSelectionId:'live-menu', canCheckUpdates: true, updateRunning: false,
  backgroundUpdateRunning: false, moreMenuVisible: true,
  onCheckUpdatesRequested: suppliedCallback(index, 'BookshelfShell', 'onCheckUpdatesRequested', {
    startManualBookshelfUpdate: () => { updateIntents++; },
  }),
});
const requestUpdate = suppliedCallback(readFileSync(shellFile, 'utf8'), 'BookshelfMoreMenu', 'onCheckUpdates', shellUpdate);
for (const blocked of ['canCheckUpdates', 'updateRunning', 'backgroundUpdateRunning']) {
  shellUpdate[blocked] = blocked !== 'canCheckUpdates'; requestUpdate();
  assert.equal(updateIntents, 0, 'empty/local-only and concurrent sweeps cannot dispatch another update');
  shellUpdate[blocked] = blocked === 'canCheckUpdates';
}
requestUpdate(); assert.equal(updateIntents, 1, 'More delegates the foreground sweep to the existing Index owner');
assert.equal(shellUpdate.moreMenuVisible, false, 'accepted update closes the menu');
assert.match(index, /private startManualBookshelfUpdate\(\)/,
  'SHF-03: Index must dispatch the user foreground update intent');
const catalogOwner = read('entry/src/main/ets/features/bookshelf/BookshelfCatalogOwner.ts');
assert.match(index, /this\.bookshelfHost\.catalog\(owner\)/, 'SHF-03: existing BookshelfHost owns the exact Runtime sweep');
assert.match(catalogOwner, /new BookshelfCatalogUpdate\(this\.owner\)\.run\(targets, automatic/,
  'SHF-03: original bounded sweep uses the exact owner');
assert.match(catalogOwner, /const targets = automatic \? books\.filter\(book =>\s*this\.owner\.mangaOfflineProbeProtectsAutomaticCatalog\?\.\(book\.sourceId, book\.bookId\) !== true\) : books;/,
  'automatic refresh protects an active manga offline probe; the explicit manual sweep retains its full target set');
assert.match(catalogOwner, /done: value\.attempted/,
  'SHF-03: the sweep reports attempted chunk progress, distinct from result success counts');
assert.match(catalogOwner, /if \(this\.active !== undefined \|\| !this\.current\(binding\)\) return;/,
  'SHF-03: manual and background sweeps must stay mutually exclusive');
await import('./test-bookshelf-manual-update.mjs');
assert.match(shelf, /onBookGroupRequested/,
  'explicit per-book grouping is isolated from opening the shelf tool');
assert.doesNotMatch(shelfMoreMenu, /分组管理/,
  'the approved four-item More menu does not expose the legacy group editor');

assert.match(shelf, /Text\(`更新 \$\{book\.unreadCount\} 章`\)/);
assert.match(shelf, /Text\(this\.gridProgressLabel\(book\)\)/,
  'grid progress renders through the basis-point formatter');
assert.match(shelf, /ShelfBookPresentation\.progress\(book, 'grid-caption'\)/,
  'Grid delegates its sub-1% label to the same actual projection as List');
for (const variant of ['list-status', 'grid-caption']) assert.equal(
  ShelfBookPresentation.progress({ readProgress: 1 }, variant), '已读 <1%',
  'sub-1% progress stays visible instead of collapsing to 0%');

console.log('Legado product behavior contract: PASS');
