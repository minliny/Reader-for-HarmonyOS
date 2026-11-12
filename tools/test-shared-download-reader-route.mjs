import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const { registerHooks }=await import('node:module');
const { productionMotionMethods }=await import('./lib/reader-motion-method-probe.mjs');
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; }
} });
const { ReaderNavigation } = await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
const { ReaderDownloadJourney } = await import('../entry/src/main/ets/app/composition/ReaderDownloadJourney.ts');
const { BookRemovalDialogPresentation } = await import('../entry/src/main/ets/features/bookshelf/presentation/BookRemovalDialogPresentation.ts');
const { JsonImportPresentation } = await import('./lib/json-import-presentation-probe.mjs');
const { actualReadingEntryPresentation } = await import('./lib/reading-entry-presentation-probe.mjs');
const { installDirectoryOperationIndex } = await import('./lib/reader-directory-operations-probe.mjs');
const { bookshelfOperationClass } = await import('./lib/bookshelf-operation-owner-probe.mjs');
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');

const index = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const methods = ['cancelReaderExitDestination', 'onReaderExited', 'currentReaderPresentationIdentity',
  'downloadNavigationPorts', 'openReading', 'readingEntryActionPorts', 'readingExitActionPorts',
  'currentReadingRuntime', 'isCurrentRuntime', 'navigateTo', 'publishNavigation', 'nextNavigationGeneration'];
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const runtimeFile = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
const hilog = { warn() {}, error() {} };

// Run the actual Index, navigation and feature presentations. Only Core/Host
// I/O and the downstream reader/page destinations are controlled here.
function fixture({ route = 'reading', active = true, view = {} } = {}) {
  const ack = deferred(), calls = [], toast = [], protection = [], probeReleases = [], hostCalls = [];
  const owner = { getDownloadCoordinator: () => ({ submit: (session, indexes) => {
    calls.push(['submit', session.identity, indexes]); return ack.promise;
  } }), setDownloadReadingProtection: (...args) => protection.push(args), supportsCoreCapability: () => true,
    finishMangaOfflineProbe: (...args) => probeReleases.push(args) };
  const ReaderRuntimeOwner = { isCurrent: candidate => candidate === owner };
  const Index = selectedProductionMethods(index, 'Index', methods, { ReaderRuntimeOwner, hilog, DOMAIN: 0 });
  class SharedDownloadHost {
    constructor(runtime, publish) { assert.equal(runtime, owner); this.publish = publish; }
    async reload(current) {
      assert.equal(current(), true);
      hostCalls.push('reload');
      this.publish({ books: [], loading: false, error: '', storageSummary: {} });
    }
    resume(snapshot, current) {
      assert.equal(current(), true);
      assert.equal(snapshot.loading, false);
      hostCalls.push('resume');
    }
    async refreshReadingMetadata() {}
    async refreshStorageSummary() {}
    retire() {}
  }
  const Download = bookshelfOperationClass('features/downloads/presentation/SharedDownloadPresentation.ets',
    'SharedDownloadPresentation', { Observed: value => value, SharedDownloadHost });
  const EntryActions = bookshelfOperationClass('app/composition/ReaderReadingEntryActions.ets',
    'ReaderReadingEntryActions', { Observed: value => value });
  const ExitActions = bookshelfOperationClass('app/composition/ReaderExitActions.ts', 'ReaderExitActions');
  const Reading = actualReadingEntryPresentation();
  const session = { contentKind: 'manga', identity: { sourceId: 'source', bookId: 'book' },
    entries: [{ index: 0, url: '/chapter-0', navigable: true }, { index: 1, url: '/chapter-1', navigable: true },
      { index: 2, url: '/volume', navigable: false }] };
  const book = { ...session.identity, title: 'Comic', author: 'Author', contentKind: 'manga' };
  const readingEntry = Object.assign(new Reading(), { book, session, contentKind: 'manga', sessionActive: active, readyGeneration: 7 });
  const downloadPresentation = new Download();
  downloadPresentation.restoreReturn(owner, { membershipRevision: 0, storageCleanupRevision: 0,
    view: { ...downloadPresentation.initialView(), detailKey: 'previous', ...view } });
  const dormant = { retire() {} };
  const page = Object.assign(new Index(), { mountedRuntimeOwner: owner, shelfReceiptRetired: false,
    libraryAcquisition: { currentOwner: () => owner },
    navigationOwner: new ReaderNavigation(), readingEntry, downloadPresentation, searchAppForeground: true,
    rssInstanceIdentity: 'instance', detailShelfAdmissionMount: 1,
    bookRemovalConfirmation: new BookRemovalDialogPresentation(), jsonImportPresentation: new JsonImportPresentation(),
    shelfRead: { snapshot: { books: [] } }, shelfMotion: { clear() {} }, transientFeedback: { reset() {} },
    sourceSwitchPresentation: { visible: false }, mangaSourceSwitch: { selectionVisible: false },
    readingCommits: dormant, settingsPresentation: dormant, sourceJourney: dormant, rssJourney: dormant,
    shelfCatalog: dormant, shelfManagement: dormant, shelfGroupPresentation: dormant, discoverPresentation: dormant, rulesPresentation: dormant,
    syncPresentation: dormant, nativeAlertOwner: dormant, retireSourceSwitchPresentation() {},
    shelfMutations: { snapshot: { removalKey: '' }, retireSelection() {} },
    bookshelfHost: { detachManagementPresentation() {} },
    showOfflineDownloadFeedback: text => toast.push(text),
    libraryJourney: { returnToBookshelf: () => calls.push(['shelf']), returnFromDetail: assert.fail },
    settingsNavigation: { returnToSettings: () => calls.push(['settings']) },
    bookshelfModalVisible: () => false, returnToReadingOrigin: () => calls.push(['origin']),
    openShelfBook: saved => calls.push(['reader', saved]),
  });
  page.readingEntryActions = new EntryActions(page.navigationOwner, { begin() {} }, page.readingEntryActionPorts());
  page.readingExitActions = new ExitActions(page.navigationOwner, page.readingExitActionPorts());
  page.downloadNavigation = new ReaderDownloadJourney(page.navigationOwner, page.downloadNavigationPorts());
  page.readingEntryActions.resumeShelf = saved => calls.push(['reader', saved]);
  page.readingEntryActions.openShelfEntry = (saved, intent, parent) => {
    assert.equal(intent, 'info');
    calls.push(['detail', saved, parent]); page.navigateTo('detail');
  };
  page.navigateTo(route);
  readingEntry.attachExitRequest(intent => calls.push(['saveExit', intent]), () => true);
  const directoryJourney = installDirectoryOperationIndex(page, { ReaderRuntimeOwner });
  const directory = directoryJourney.operations;
  directoryJourney.open = target => {
    assert.equal(target, 'detail');
    calls.push(['directory']); page.navigateTo('directory');
  };
  const openDownloads = page.downloadNavigation.open.bind(page.downloadNavigation);
  page.downloadNavigation.open = (...args) => { calls.push(['downloads', ...args]); openDownloads(...args); };
  return { ack, calls, toast, protection, probeReleases, hostCalls, owner, session, page, readingEntry, downloadPresentation, directory };
}

// Execute actual reader callbacks: the accepted write and the saved reader
// exit are separate boundaries. Neither is synthesized by a toast.

try{
if(id==='view-state'){
{
  const retained={query:'325',type:'text',state:'downloading',sourceId:'source',
    sort:'size',direction:'asc',listScroll:389,chapterScroll:0,detailKey:'old'};
  const {page,readingEntry,downloadPresentation,hostCalls,calls}=fixture({route:'directory',active:false,view:retained});
  const book=page.downloadNavigation.currentBook(), previous=downloadPresentation.initialView();
  page.downloadNavigation.open({ kind: 'fresh', detailKey: 'job' });
  assert.deepEqual(downloadPresentation.initialView(),{...retained,detailKey:'job'});
  assert.notEqual(downloadPresentation.initialView(),previous);assert.equal(previous.detailKey,'old');
  const same=downloadPresentation.initialView();
  page.downloadNavigation.open({ kind: 'fresh', detailKey: 'duplicate' });
  assert.equal(downloadPresentation.initialView(),same,'a duplicate fresh entry cannot replace the directory return');
  page.downloadNavigation.open({ kind: 'readerRequest', detailKey: '' });assert.equal(downloadPresentation.initialView(),same);
  page.downloadNavigation.open({ kind: 'readerRequest', detailKey: 'next' });assert.deepEqual(downloadPresentation.initialView(),{...retained,detailKey:'next'});
  readingEntry.sessionActive=true;page.downloadNavigation.open({ kind: 'readerRequest', detailKey: 'blocked' });
  assert.deepEqual(hostCalls,['reload','reload','reload']);
  assert.equal(downloadPresentation.initialView().detailKey,'next','active reading waits for its saved exit before opening downloads');
  readingEntry.sessionActive=false;page.downloadNavigation.returnFromDownloads();
  assert.deepEqual(calls.slice(-2),[['detail',book,'bookshelf'],['directory']]);
  assert.equal(page.route,'directory');
}
}
if(id==='accepted-exit'){
{
  const f = fixture(); f.directory.downloadBook();
  assert.deepEqual(f.calls, [['submit', f.session.identity, undefined]]);
  assert.deepEqual(f.toast, []); assert.equal(f.page.route, 'reading');
  f.ack.resolve({ key: '["source","book"]', accepted: true, alreadyRunning: false, requestedChapters: 2 });
  await tick();
  assert.deepEqual(f.calls.at(-1), ['saveExit', 'navigation']);
  assert.equal(f.calls.some(call => call[0] === 'downloads'), false, 'position save has not acknowledged exit');
  f.page.onReaderExited(f.page.currentReaderPresentationIdentity());
  assert.deepEqual(f.calls.at(-1), ['downloads', { kind: 'readerRequest', detailKey: '["source","book"]' }]);
  assert.equal(f.page.route, 'downloads'); assert.equal(f.readingEntry.sessionActive, false); assert.deepEqual(f.protection, [[]]);
  assert.deepEqual(f.probeReleases, [['source', 'book']], 'saved route exit releases reading observation before download work');
  f.page.downloadNavigation.returnFromDownloads();
  assert.deepEqual(f.calls.at(-1), ['reader', f.page.downloadNavigation.currentBook()], 'the acknowledged reader owns the download return');
}
}
if(id==='failure-privacy'){
{
  const f = fixture(); f.directory.downloadBook();
  f.ack.reject(Error('https://fixture.invalid/?token=PRIVATE_TOKEN Cookie=PRIVATE_COOKIE'));
  await tick();
  assert.equal(f.calls.some(call => call[0] === 'saveExit' || call[0] === 'downloads'), false);
  assert.equal(f.toast.length, 1); assert.doesNotMatch(f.toast[0], /PRIVATE_|fixture\.invalid|Cookie=/);
}
}
if(id==='late-navigation'){
{
  const f = fixture(); f.directory.downloadBook(); f.page.nextNavigationGeneration();
  f.ack.resolve({ accepted: true, key: 'kept', requestedChapters: 2 }); await tick();
  assert.equal(f.calls.length, 1, 'a persisted request cannot pull a newer navigation back');
  assert.deepEqual(f.toast, []);
}
{
  const f = fixture(); f.directory.downloadBook();
  f.page.arkWebCapturesInput = true;
  f.ack.resolve({ accepted: true, key: 'kept', requestedChapters: 2 }); await tick();
  assert.equal(f.calls.length, 1, 'a covered directory cannot navigate after the original submit settles');
  assert.equal(f.page.route, 'reading');
}
}
if(id==='chapter-scope'){
{
  const f = fixture(); f.directory.downloadChapter(2); assert.deepEqual(f.calls, []);
  f.directory.downloadChapter(1); assert.deepEqual(f.calls, [['submit', f.session.identity, [1]]]);
  f.ack.resolve({ accepted: true, key: 'kept', requestedChapters: 1 }); await tick();
  assert.equal(f.calls.some(call => call[0] === 'saveExit'), false, 'chapter quick action remains in the reader');
}
}
if(id==='cancel-exit'){
{
  const f = fixture(); f.page.downloadNavigation.requestFromReader();
  const identity = f.page.currentReaderPresentationIdentity();
  f.page.cancelReaderExitDestination(identity);
  f.page.onReaderExited('obsolete-reader'); assert.equal(f.calls.length, 1);
  assert.deepEqual(f.probeReleases, [], 'a stale exit cannot release the current reader observation');
  f.page.onReaderExited(identity);
  assert.deepEqual(f.calls, [['saveExit', 'navigation'], ['origin']], 'cancelled position save withdraws download navigation');
}
}
if(id==='text-exit'){
{
  const f = fixture(); f.readingEntry.contentKind = 'text'; f.page.downloadNavigation.requestFromReader();
  f.page.onReaderExited(f.page.currentReaderPresentationIdentity());
  assert.deepEqual(f.probeReleases, [], 'novel exit cannot terminate another manga scope');
}
}
if(id==='download-return'){
{
  const f = fixture({ route: 'bookshelf', active: false });
  f.page.downloadNavigation.open({ kind: 'fresh', detailKey: 'previous' });
  const book = f.page.downloadNavigation.currentBook();
  const seed = { ...book, detailUrl: book.bookId };
  f.page.librarySearch = { host: { visibilityChanged() {} }, admissionCandidates: () => [] };
  f.page.readingEntryPorts = () => ({});
  f.page.bindReadingEntryReader = () => {
    assert.equal(f.page.route, 'reading');
    assert.equal(f.readingEntry.requestedChapterIndex, 1, 'the first reader binding already has the requested chapter');
    assert.equal(f.readingEntry.requestedMangaOfflineChapterId, '/chapter-1');
  };
  f.readingEntry.enterRemoteDetail = (owner, input, open) => {
    assert.equal(owner, f.owner);
    assert.equal(input.seed, seed); assert.equal(input.shelfSnapshot, book);
    assert.equal(input.validatedSession, f.session); assert.equal(input.resumeImmediately, true);
    open(() => {}, []);
    return true;
  };
  f.page.downloadNavigation.openChapter({ shelfBook: book, chapterIndex: 1, seed, sourceLabel: 'Source',
    session: f.session, mangaOfflineChapterId: '/chapter-1' });
  assert.equal(f.readingEntry.requestedChapterIndex, 1);
  assert.equal(f.page.downloadNavigation.captureReaderReturn().fromDownloads, true);
  const identity = f.page.currentReaderPresentationIdentity();
  f.page.readingExitActions.requestExit();
  f.page.readingExitActions.requestExit();
  assert.equal(f.page.route, 'reading');
  assert.ok(f.page.readingExitActions.attach(() => {
    f.calls.push(['saveDownloadedExit']);
    f.page.onReaderExited(identity);
  }, identity, () => true, f.readingEntry.mangaChapterRequestGeneration));
  await tick();
  assert.equal(f.calls.filter(([kind]) => kind === 'saveDownloadedExit').length, 1);
  assert.deepEqual(f.calls.at(-1), ['downloads', { kind: 'resume' }]);
  assert.equal(f.downloadPresentation.initialView().detailKey, 'previous');
  assert.equal(f.page.downloadNavigation.captureReaderReturn().fromDownloads, false);
  assert.deepEqual(f.hostCalls, ['reload', 'resume']);
}
}
if(id==='reader-return'){
{
  const f = fixture(), book = f.page.downloadNavigation.currentBook();
  f.page.downloadNavigation.requestFromReader('focused');
  f.page.onReaderExited(f.page.currentReaderPresentationIdentity());
  f.page.downloadNavigation.returnFromDownloads();
  assert.deepEqual(f.calls.at(-1), ['reader', book]);
  assert.equal(f.calls.at(-1)[1].sourceId, 'source');
}
}
if(id==='mount-before-io'){
{
  const {page,owner,session,readingEntry}=fixture({route:'detail',active:false});
  const io=deferred(), events=[], dispatches=[];
  const IoRuntime=productionMotionMethods(runtimeFile,['requestDirect'],{
    DEFAULT_CORE_REQUEST_TIMEOUT_MS:30000, LOG_DOMAIN:0, hilog,
    coreAdmissionFailureSummary:()=>undefined, httpResponseFailureSummary:()=>undefined,
  });
  const runtime=Object.assign(new IoRuntime(),{state:'ready',start:async()=>{},
    downloadStorageGateway:{waitForActiveMutation:()=>io.promise},
    readingEntryPreparations:()=>({beginRequest:()=>false}),
    runtime:{request:async (method,params)=>{dispatches.push([method,params]);return {data:{}};}},
  });
  const params={...session.identity,chapterIndex:4};
  session.entries.push({index:4,url:'/chapter-4',navigable:true});
  owner.setDownloadReadingProtection=(...args)=>events.push(['protect',...args]);
  let body;
  page.bindReadingEntryReader=()=>{
    events.push(['mountReader']);
    body=runtime.requestDirect('manga.chapter.get',params);
  };
  page.openReading(4);
  assert.deepEqual(events, [['protect', 'source', 'book'], ['mountReader']]);
  assert.equal(readingEntry.sessionActive, true, 'new reader mounts immediately with dynamic loading while the Runtime IO barrier still holds');
  await tick();
  assert.deepEqual(dispatches, [], 'reader mounting does not authorize content IO before cleanup settles');
  io.resolve(); await body;
  assert.deepEqual(dispatches,[['manga.chapter.get',params]]);
  assert.equal(page.route, 'reading'); assert.equal(readingEntry.requestedChapterIndex, 4);
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
