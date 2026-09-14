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

const acquisition = read('entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const scheduler = read('entry/src/main/ets/app/BookRequestScheduler.ts');
assert.match(acquisition, /this\.preparationActive < 2/);
assert.match(scheduler, /job\.priority !== 'foreground' && this\.active >= 5/,
  'reading retains reserved capacity while source/search work is running');
const remoteOpen = index.slice(index.indexOf('  private openRemoteBookDetail('),
  index.indexOf('  private refreshCachedSearchDetailInBackground('));
assert.match(remoteOpen, /owner\.bookAcquisitions\(\)\s*\.acquireCandidateGroup\(candidates, \{ isCurrent \}\)/,
  'group fallback uses the shared coordinator with the active navigation guard');
assert.match(remoteOpen, /owner\.bookAcquisitions\(\)\s*\.acquireBookWithBackgroundRefresh\(seed, \{ isCurrent \}\)/,
  'fixed-source detail admission uses the shared cache-first/background-refresh coordinator');
assert.ok(remoteOpen.indexOf('this.route = entryRoute') < remoteOpen.indexOf('const sessionAdmission:'),
  'detail remains visible before either asynchronous admission branch');
assert.match(index, /PERF search-detail-admission/,
  'device runs must expose first-click admission latency instead of relying on subjective timing');

assert.match(search, /SEARCH_PARTIAL_PUBLISH_INTERVAL_MS = 100/);
assert.match(search, /SEARCH_PARTIAL_PUBLISH_MAX_MS = 200/);
assert.match(search, /if \(run\.timer >= 0\) return;/, 'arrivals must not extend an already scheduled batch');
assert.match(search, /Math\.min\(SEARCH_PARTIAL_PUBLISH_INTERVAL_MS,[\s\S]*SEARCH_PARTIAL_PUBLISH_MAX_MS - \(now - run\.pendingSince\)/,
  'the coalescing delay remains bounded independently of new source arrivals');
assert.match(search, /new Set<string>\(run\.scope\)/);

// R8's SDK runtime suite covers completion, timeout and cancellation behavior.
// Keep this Host wiring guard focused on the non-blocking native read lane
// and its interruptible wait; a fixed delay is no longer the intended policy.
const nativePoll = sdk.slice(sdk.indexOf('private async pollNativeQueue('), sdk.indexOf('private takePendingForRequest('));
assert.match(nativePoll, /await this\.pollNativeOnce\(\)[\s\S]*await this\.waitForWake\(waiter, waitMs\)[\s\S]*this\.checkWaiter\(waiter\)[\s\S]*await this\.pollNativeOnce\(\)/,
  'empty native polls wait interruptibly and recheck cancellation before reading again');
assert.doesNotMatch(nativePoll, /await delay\(/,
  'a fixed sleep must not replace the waiter wakeup boundary');
assert.match(nativePoll, /await predecessor;[\s\S]*this\.readNativeEvent\(0\)[\s\S]*finally \{\s*release\?\.\(\)/,
  'only the non-blocking native read is serialized, and its lane always releases');
assert.match(sdk, /private interruptWaiter[\s\S]*?waiter\.interruption = error;\s*waiter\.wake\?\.\(\)/,
  'cancellation/close must wake the owned waiter');
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
assert.match(continuous, /fragmentDataSource\.update\(changed/);
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
]) {
  assert.match(source, /Repeat\([\s\S]*virtualScroll\(\{ reusable: true \}\)/,
    `${name} long collections must use reusable virtual rows`);
}
assert.match(sourceTools,
  /class SourceToolListDataSource implements IDataSource[\s\S]*LazyForEach\(this\.sourceDataSource/,
  'source-tools long collection must use the V1-compatible lazy data-source path');
assert.doesNotMatch(sourceTools, /Repeat\([\s\S]*virtualScroll/,
  'source-tools V1 component must not use unsupported Repeat virtualScroll');

console.log('performance regression contracts: PASS');
