import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const { registerHooks }=await import('node:module');
const { productionMotionMethods }=await import('./lib/reader-motion-method-probe.mjs');
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; }
} });
const { readingOfflineFailureHint } = await import('../entry/src/main/ets/features/reading/ReadingOfflineFailurePresentation.ts');

const index = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const methods = ['downloadDirectoryBook', 'downloadDirectoryChapter', 'submitReaderDownload',
  'currentDownloadBook', 'requestReaderDownloads', 'cancelReaderExitDestination', 'onReaderExited',
  'returnFromDownloads', 'currentReaderPresentationIdentity','captureReaderReturnContext','captureDownloadReturnContext','copyDownloadViewState','restoreReaderReturnContext','restoreDownloadReturnContext'];
const Index = productionMotionMethods(index, methods, { readingOfflineFailureHint,
  hilog: { warn() {}, error() {} }, DOMAIN: 0 });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
// Execute the actual ArkTS-compatible view-state copy and its opening guards.
// Download list I/O remains the existing Host seam; no layout is reconstructed.
function fixture() {
  const ack = deferred(), calls = [], toast = [], protection = [], probeReleases = [];
  const owner = { getDownloadCoordinator: () => ({ submit: (session, indexes) => {
    calls.push(['submit', session.identity, indexes]); return ack.promise;
  } }), setDownloadReadingProtection: (...args) => protection.push(args), supportsCoreCapability: () => true,
    finishMangaOfflineProbe: (...args) => probeReleases.push(args) };
  const session = { contentKind: 'manga', identity: { sourceId: 'source', bookId: 'book' },
    entries: [{ index: 0, url: '/chapter-0', navigable: true }, { index: 1, url: '/chapter-1', navigable: true },
      { index: 2, url: '/volume', navigable: false }] };
  const page = Object.assign(new Index(), { mountedRuntimeOwner: owner, shelfReceiptRetired: false,
    route: 'reading', readingContentKind: 'manga', readingSessionActive: true, readingReadyGeneration: 7, navigationGeneration: 9,
    remoteReadingSession: session, detailBook: { ...session.identity, title: 'Comic', author: 'Author', contentKind: 'manga' },
    shelfBooks: [], downloadViewState: { detailKey: 'previous' },
    readingExitRequest: intent => calls.push(['saveExit', intent]),
    isCurrentRuntime: input => input === owner,
    isKnownDetailChapter: index => session.entries.some(entry => entry.index === index && entry.navigable),
    showOfflineDownloadFeedback: text => toast.push(text),
    openDownloads: (...args) => calls.push(['downloads', ...args]),
    returnToBookshelf: () => calls.push(['shelf']), returnToReadingOrigin: () => calls.push(['origin']),
    openShelfBook: book => calls.push(['reader', book]), openShelfBookInfo: book => calls.push(['detail', book]),
    returnToSettings: () => calls.push(['settings']),
  });
  return { ack, calls, toast, protection, probeReleases, owner, session, page };
}

// Execute actual reader callbacks: the accepted write and the saved reader
// exit are separate boundaries. Neither is synthesized by a toast.

try{
if(id==='view-state'){
{
  let reloads=0;
  class Host { async reload(current){assert.equal(current(),true);reloads++;} }
  const Page=productionMotionMethods(index,['openDownloads'],{SharedDownloadHost:Host});
  const owner={},book={sourceId:'source',bookId:'book'};
  const retained={query:'325',type:'text',state:'downloading',sourceId:'source',
    sort:'size',direction:'asc',listScroll:389,detailKey:'old'};
  const page=Object.assign(new Page(),{mountedRuntimeOwner:owner,readingSessionActive:false,
    shelfReceiptRetired:false,route:'directory',downloadViewState:retained,
    rssInstanceIdentity:'instance',detailShelfAdmissionMount:1,navigationGeneration:1,
    isCurrentRuntime:value=>value===owner,currentDownloadBook:()=>book,
    nextNavigationGeneration(){return ++this.navigationGeneration;},
    isCurrentDownloadPresentation:(generation,value)=>value===owner&&generation===page.navigationGeneration});
  page.openDownloads('job');
  assert.deepEqual(page.downloadViewState,{...retained,detailKey:'job'});
  assert.notEqual(page.downloadViewState,retained);assert.equal(retained.detailKey,'old');
  assert.equal(page.downloadReturnTarget,'directory');assert.equal(page.downloadReturnBook,book);
  const same=page.downloadViewState;page.openDownloads('',true);assert.equal(page.downloadViewState,same);
  page.openDownloads('next',true);assert.deepEqual(page.downloadViewState,{...retained,detailKey:'next'});
  page.readingSessionActive=true;page.openDownloads('blocked');assert.equal(reloads,3);
  assert.equal(page.downloadViewState.detailKey,'next','active reading waits for its saved exit before opening downloads');
}
}
if(id==='accepted-exit'){
{
  const f = fixture(); f.page.downloadDirectoryBook();
  assert.deepEqual(f.calls, [['submit', f.session.identity, undefined]]);
  assert.deepEqual(f.toast, []); assert.equal(f.page.route, 'reading');
  f.ack.resolve({ key: '["source","book"]', accepted: true, alreadyRunning: false, requestedChapters: 2 });
  await tick();
  assert.deepEqual(f.calls.at(-1), ['saveExit', 'navigation']);
  assert.equal(f.calls.some(call => call[0] === 'downloads'), false, 'position save has not acknowledged exit');
  f.page.onReaderExited(f.page.currentReaderPresentationIdentity());
  assert.deepEqual(f.calls.at(-1), ['downloads', '["source","book"]', true]);
  assert.equal(f.page.readingSessionActive, false); assert.deepEqual(f.protection, [[]]);
  assert.deepEqual(f.probeReleases, [['source', 'book']], 'saved route exit releases reading observation before download work');
  assert.equal(f.page.downloadReturnTarget, 'reading');
}
}
if(id==='failure-privacy'){
{
  const f = fixture(); f.page.downloadDirectoryBook();
  f.ack.reject(Error('https://fixture.invalid/?token=PRIVATE_TOKEN Cookie=PRIVATE_COOKIE'));
  await tick();
  assert.equal(f.calls.some(call => call[0] === 'saveExit' || call[0] === 'downloads'), false);
  assert.equal(f.toast.length, 1); assert.doesNotMatch(f.toast[0], /PRIVATE_|fixture\.invalid|Cookie=/);
}
}
if(id==='late-navigation'){
{
  const f = fixture(); f.page.downloadDirectoryBook(); f.page.navigationGeneration++;
  f.ack.resolve({ accepted: true, key: 'kept', requestedChapters: 2 }); await tick();
  assert.equal(f.calls.length, 1, 'a persisted request cannot pull a newer navigation back');
  assert.deepEqual(f.toast, []);
}
}
if(id==='chapter-scope'){
{
  const f = fixture(); f.page.downloadDirectoryChapter(2); assert.deepEqual(f.calls, []);
  f.page.downloadDirectoryChapter(1); assert.deepEqual(f.calls, [['submit', f.session.identity, [1]]]);
  f.ack.resolve({ accepted: true, key: 'kept', requestedChapters: 1 }); await tick();
  assert.equal(f.calls.some(call => call[0] === 'saveExit'), false, 'chapter quick action remains in the reader');
}
}
if(id==='cancel-exit'){
{
  const f = fixture(); f.page.requestReaderDownloads();
  const identity = f.page.currentReaderPresentationIdentity();
  f.page.cancelReaderExitDestination(identity);
  assert.equal(f.page.downloadsAfterReaderExit, undefined, 'cancelled position save withdraws navigation');
  f.page.onReaderExited('obsolete-reader'); assert.equal(f.calls.length, 1);
  assert.deepEqual(f.probeReleases, [], 'a stale exit cannot release the current reader observation');
}
}
if(id==='text-exit'){
{
  const f = fixture(); f.page.readingContentKind = 'text'; f.page.requestReaderDownloads();
  f.page.onReaderExited(f.page.currentReaderPresentationIdentity());
  assert.deepEqual(f.probeReleases, [], 'novel exit cannot terminate another manga scope');
}
}
if(id==='download-return'){
{
  const f = fixture(); f.page.readingFromDownloads = true;
  f.page.onReaderExited(f.page.currentReaderPresentationIdentity());
  assert.deepEqual(f.calls.at(-1), ['downloads', 'previous', true]);
  assert.equal(f.page.readingFromDownloads, false);
}
}
if(id==='reader-return'){
{
  const f = fixture(); f.page.requestReaderDownloads('focused');
  f.page.route = 'downloads'; f.page.readingSessionActive = false;
  f.page.returnFromDownloads();
  assert.equal(f.calls.at(-1)[0], 'reader');
  assert.deepEqual(f.calls.at(-1)[1], f.page.downloadReturnBook);
  assert.equal(f.calls.at(-1)[1].sourceId, 'source');
}
}
if(id==='mount-before-io'){
const ReadingIndex = productionMotionMethods(index, ['openReading'], { hilog: { warn() {} }, DOMAIN: 0 });
{
  const io = deferred(), events = []; let clearing = true;
  const runtime = { setDownloadReadingProtection: (...args) => events.push(['protect', ...args]),
    getDownloadStorageGateway: () => ({ hasActiveMutation: () => clearing, waitForActiveMutation: () => io.promise }) };
  const page = Object.assign(new ReadingIndex(), { mountedRuntimeOwner: runtime, shelfReceiptRetired: false,
    detailBook: { sourceId: 'source', bookId: 'book' }, shelfOperation: { removalKey: '' }, route: 'detail',
    readingContentKind: 'manga', readingSessionActive: false, navigationGeneration: 3,
    isKnownDetailChapter: () => true, isCurrentRuntime: owner => owner === runtime,
    beginReadingStartupTrace() {}, nextNavigationGeneration() { this.navigationGeneration++; },
    bindReadingEntryReader: () => events.push(['mountReader']),
  });
  page.openReading(4);
  assert.deepEqual(events, [['protect', 'source', 'book'], ['mountReader']]);
  assert.equal(page.readingSessionActive, true, 'new reader mounts immediately with dynamic loading while the Runtime IO barrier still holds');
  assert.equal(clearing, true, 'UI mounting does not claim the prior physical cleanup settled');
  clearing = false; io.resolve(); await tick();
  assert.equal(page.route, 'reading'); assert.equal(page.requestedChapterIndex, 4);
  assert.deepEqual(events.at(-1), ['mountReader']);
}
}
if(id==='storage-protection'){
const runtimeFile = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
const RuntimeOwner = productionMotionMethods(runtimeFile, ['setDownloadReadingProtection', 'captureDownloadStorageValidity',
  'readDownloadStorageBindings', 'closeDownloadsAndRuntime'], { ReaderRuntimeOwner: { isCurrent: () => true } });
{
  const jobs = [{ sourceId: 'source', bookId: 'book', book: { contentKind: 'text' }, status: 'cancelled',
    requestedIndexes: [], retainedIndexes: [2], preservedRetentions: [{ chapterIndex: 8, chapterId: '/old' }] }];
  const runtime = Object.assign(new RuntimeOwner(), { state: 'ready', downloadProtectionRevision: 0,
    getDownloadCoordinator: () => ({ restore: async () => {}, jobs: () => jobs, ownershipSignature: () => JSON.stringify(jobs) }) });
  const bindings = await runtime.readDownloadStorageBindings();
  assert.deepEqual(bindings.retainedChapters.map(row => row.chapterIndex), [2, 8], 'cancel retains original physical slots');
  const valid = runtime.captureDownloadStorageValidity();
  runtime.setDownloadReadingProtection('source', 'book', 4); assert.equal(valid(), false);
  const readingValid = runtime.captureDownloadStorageValidity();
  runtime.setDownloadReadingProtection('source', 'book', 4); assert.equal(readingValid(), true, 'same chapter progress is not a new cleanup boundary');
  jobs[0].status = 'downloading'; jobs[0].requestedIndexes = [5]; assert.equal(readingValid(), false);
  assert.deepEqual((await runtime.readDownloadStorageBindings()).protectedChapters.map(row => row.chapterIndex), [5, 4]);
  const retiringRevision = runtime.downloadProtectionRevision;
  runtime.state = 'closing'; runtime.setDownloadReadingProtection('source', 'book', 9);
  assert.equal(runtime.downloadProtectionRevision, retiringRevision, 'retiring Runtime cannot replace active chapter protection');
}
}
if(id==='close-drain'){
const runtimeFile = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
const RuntimeOwner = productionMotionMethods(runtimeFile, ['setDownloadReadingProtection', 'captureDownloadStorageValidity',
  'readDownloadStorageBindings', 'closeDownloadsAndRuntime'], { ReaderRuntimeOwner: { isCurrent: () => true } });
{
  const drain = deferred(), events = [];
  const runtime = Object.assign(new RuntimeOwner(), { downloadCoordinator: { close: () => drain.promise },
    readingImageDiskCache: { close: () => events.push('diskClosed') }, closeRuntime: async () => events.push('coreClosed') });
  const closing = runtime.closeDownloadsAndRuntime(); assert.deepEqual(events, []);
  drain.resolve(); await closing; assert.deepEqual(events, ['diskClosed', 'coreClosed']);
}
}
if(id==='content-dispatch'){
const runtimeFile = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
const RuntimeOwner = productionMotionMethods(runtimeFile, ['setDownloadReadingProtection', 'captureDownloadStorageValidity',
  'readDownloadStorageBindings', 'closeDownloadsAndRuntime'], { ReaderRuntimeOwner: { isCurrent: () => true } });
const IoRuntime = productionMotionMethods(runtimeFile, ['requestDirect'], {
  DEFAULT_CORE_REQUEST_TIMEOUT_MS: 30000, LOG_DOMAIN: 0,
  coreAdmissionFailureSummary: () => undefined, httpResponseFailureSummary: () => undefined,
  hilog: { warn() {} },
});
for (const method of ['chapter.content', 'manga.chapter.get', 'manga.entry.get', 'reading.entry.prepare']) {
  const barrier = deferred(), dispatches = [], finishes = [];
  const runtime = Object.assign(new IoRuntime(), { state: 'ready', preparationIntentEpoch: 0,
    start: async () => {}, downloadStorageGateway: { waitForActiveMutation: () => barrier.promise },
    readingEntryPreparations: () => ({ beginRequest: () => true,
      finishRequest: (method, params) => finishes.push([method, params]) }),
    runtime: { request: async (...args) => { dispatches.push(args); return { data: {} }; } },
  });
  const params = { sourceId: 'source', bookId: 'book', chapterIndex: 325 };
  const pending = runtime.requestDirect(method, params); await tick();
  assert.equal(dispatches.length, 0, 'actual content IO cannot overtake prior acknowledged cleanup');
  barrier.resolve(); await pending; assert.equal(dispatches.length, 1);
  assert.equal(dispatches[0][0], method); assert.equal(dispatches[0][1], params);
  assert.deepEqual(finishes, [[method, params]]);
}
}
if(id==='verification-cleanup'){
const runtimeFile = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
const RuntimeOwner = productionMotionMethods(runtimeFile, ['setDownloadReadingProtection', 'captureDownloadStorageValidity',
  'readDownloadStorageBindings', 'closeDownloadsAndRuntime'], { ReaderRuntimeOwner: { isCurrent: () => true } });
const VerificationRuntime = productionMotionMethods(runtimeFile, ['clearRebuildableCachesForVerification']);
{
  const cleanup = { automaticBytes: 1000, removedContentBytes: 18, deletedBytes: 2048, deletedFiles: 3 };
  const runtime = Object.assign(new VerificationRuntime(), { state: 'ready',
    getDownloadStorageGateway: () => ({ cleanup: async () => cleanup }) });
  assert.deepEqual(await runtime.clearRebuildableCachesForVerification(), { ordinaryBytes: 1000,
    derivedDisplayFiles: 3, removedContentBytes: 18, deletedBytes: 2048, deletedFiles: 3 });
  cleanup.cleanupError = 'PARTIAL_CLEANUP';
  await assert.rejects(runtime.clearRebuildableCachesForVerification(), /PARTIAL_CLEANUP/);
}
}
}finally{}
}
const definitions={"view-state": "view-state actual scoped owner/gateway/storage path; controlled Core/OS ports", "accepted-exit": "accepted-exit actual scoped owner/gateway/storage path; controlled Core/OS ports", "failure-privacy": "failure-privacy actual scoped owner/gateway/storage path; controlled Core/OS ports", "late-navigation": "late-navigation actual scoped owner/gateway/storage path; controlled Core/OS ports", "chapter-scope": "chapter-scope actual scoped owner/gateway/storage path; controlled Core/OS ports", "cancel-exit": "cancel-exit actual scoped owner/gateway/storage path; controlled Core/OS ports", "text-exit": "text-exit actual scoped owner/gateway/storage path; controlled Core/OS ports", "download-return": "download-return actual scoped owner/gateway/storage path; controlled Core/OS ports", "reader-return": "reader-return actual scoped owner/gateway/storage path; controlled Core/OS ports", "mount-before-io": "mount-before-io actual scoped owner/gateway/storage path; controlled Core/OS ports", "storage-protection": "storage-protection actual scoped owner/gateway/storage path; controlled Core/OS ports", "close-drain": "close-drain actual scoped owner/gateway/storage path; controlled Core/OS ports", "content-dispatch": "content-dispatch actual scoped owner/gateway/storage path; controlled Core/OS ports", "verification-cleanup": "verification-cleanup actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
