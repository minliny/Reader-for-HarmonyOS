import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const index = read('entry/src/main/ets/pages/Index.ets');
const search = read('entry/src/main/ets/features/search/SearchOrchestrator.ets');
const sdk = read('entry/vendor/core-harmony/sdk/reader_core.ts');
const imageCache = read('entry/src/main/ets/app/ReadingImageDiskCache.ts');
const imageHost = read('entry/src/main/ets/app/ReadingBodyImageHost.ts');
const reading = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const continuous = read('entry/src/main/ets/features/reading/ReaderContinuousReadingStage.ets');
const pageTurnStage = read('entry/src/main/ets/features/reading/ReaderPageTurnStage.ets');
const bookTurnSolver = read('entry/src/main/cpp/bookturn/bookturn_solver.cpp');
const bookTurnMotion = read('entry/src/main/cpp/bookturn/bookturn_motion.cpp');
const bookTurnHost = read('entry/src/main/cpp/bookturn/bookturn_host.cpp');
const shelfFlow = read('entry/src/main/ets/features/bookshelf/BookshelfFlowGateway.ts');
const multiSelect = read('entry/src/main/ets/features/bookshelf/BookshelfMultiSelectPage.ets');
const management = read('entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets');
const sourceTools = read('entry/src/main/ets/features/source/SourceToolsPage.ets');

assert.match(index, /SEARCH_DETAIL_WARMUP_LIMIT = 2/);
assert.match(index, /const cacheAttempt = this\.openCachedSearchCandidate[\s\S]*const onlineAttempt =/);
assert.match(index, /firstSuccessfulDetailAdmission\(\[cacheAttempt, onlineAttempt\]\)/);
assert.match(index, /PERF search-detail-admission/,
  'device runs must expose first-click admission latency instead of relying on subjective timing');

assert.match(search, /SEARCH_PARTIAL_PUBLISH_INTERVAL_MS = 16/);
assert.match(search, /partialPublishScheduled[\s\S]*schedulePartialPublish/);
assert.match(search, /new Set<string>\(scopeSourceIds\)/);

assert.match(sdk, /private async pollNativeQueue[\s\S]*await this\.pollNativeOnce\(\)[\s\S]*await delay\(waitMs\)[\s\S]*await this\.pollNativeOnce\(\)/);
assert.match(sdk, /pendingEventsByRequest = new Map/);
assert.doesNotMatch(sdk, /pendingEvents\.findIndex|pendingEvents\.splice/);

assert.match(imageCache, /writeLaneA[\s\S]*writeLaneB[\s\S]*inFlightWrites/);
assert.doesNotMatch(imageCache, /openSync|writeSync|renameSync/);
assert.match(imageHost, /displayFileWrites/);
assert.doesNotMatch(imageHost, /openSync|writeSync|statSync|renameSync|listFileSync|unlinkSync/);

assert.match(reading, /const layoutReady = Promise\.all/);
assert.ok(reading.indexOf('this.loadInitialToc(isCurrent)') < reading.indexOf('await layoutReady'),
  'initial TOC/progress must begin before the appearance barrier');
assert.match(reading, /chapterImageByStartScalar: Map<number, ReadingSessionImage>/);
assert.match(reading, /continuousFragmentIndexByStartScalar: Map<number, number>/);
assert.match(continuous, /fragmentDataSource\.update\(this\.changedFragmentIndex/);
assert.match(reading, /PAGETURN_PERF style=%\{public\}s path=%\{public\}s/,
  'every paged transition must expose end-to-end device timing');
assert.match(pageTurnStage, /\.renderGroup\(this\.compositorIsolation\)/,
  'moving flat-page trees must stay on isolated compositor groups');
assert.match(bookTurnSolver, /bool BookTurnSolver::SheetCoverageExceeds/);
assert.match(bookTurnMotion, /!BookTurnSolver::SheetCoverageExceeds\(pose, kSwapCoverRatio\)/,
  'the settlement gate must fast-reject wide boundary meshes before scanning the dense grid');
assert.ok(bookTurnHost.indexOf('SettlementSwapShouldFire') <
  bookTurnHost.indexOf('const float solveMs', bookTurnHost.indexOf('bool BookTurnHost::ProcessSettlementFrame')),
  'settlement solve diagnostics must include coverage-gate cost');

assert.match(shelfFlow, /this\.bookshelf\.removeBooks\(targets\)/);
assert.equal((shelfFlow.match(/loadBookshelf\(/g) ?? []).length, 1,
  'one bookshelf refresh must not issue a second continue-reading list query');
for (const [name, source] of [
  ['multi-select', multiSelect],
  ['management', management],
  ['source-tools', sourceTools],
]) {
  assert.match(source, /Repeat\([\s\S]*virtualScroll\(\{ reusable: true \}\)/,
    `${name} long collections must use reusable virtual rows`);
}

console.log('performance regression contracts: PASS');
