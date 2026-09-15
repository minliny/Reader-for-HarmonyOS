import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import * as readerControlState from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import * as readerControlHost from '../entry/src/main/ets/features/reading/ReaderControlHostSession.ts';
import * as readerControlKeyboard from '../entry/src/main/ets/features/reading/ReaderControlHostKeyboard.ts';
import * as readerTiming from '../entry/src/main/ets/features/common/ProductMotionTiming.ts';
import * as readerRapid from '../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts';
import * as readerAuto from '../entry/src/main/ets/features/reading/ReaderAutoPageState.ts';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const { searchCandidateRank } = await import('../entry/src/main/ets/features/search/SearchCandidatePolicy.ts');
const readingEvidence=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
const {RemoteChapterCacheRefreshError}=await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');

const source = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
function method(name) {
  const start = source.indexOf(`  private ${name}`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end).replace(/\n  \/\*\*[\s\S]*$/, '');
}
const methods = [
  'installRemoteReadingSession(', 'openShelfBook(', 'openShelfBookInfo(', 'openLocalBookDetail(', 'openRemoteBookDetail(',
  'openReading(', 'presentPreparedReading(', 'returnToReadingOrigin(', 'onReaderExited(',
  'returnFromDetail(', 'requestReaderBookInfo(', 'returnToBookshelf(', 'nextNavigationGeneration(', 'isKnownDetailChapter(',
  'async probeRemoteContentVerdict(', 'remoteContentVerdictLabel(', 'onReadingFailure(',
  'retryCurrentReadingSource(', 'runReadingFailureActionAfterExit(', 'openDetailSourceSwitch(',
  'onSearchResultSelected(', 'searchAcquisitionCandidate(', 'remoteSeedForSearchBook(',
  ...(source.includes('  private cancelReaderExitDestination(') ? ['cancelReaderExitDestination('] : []),
].map(method).join('\n');
const back = source.slice(source.indexOf('  onBackPress(): boolean {'), source.indexOf('\n  build() {'));
const harnessCode = stripTypeScriptTypes(`class Harness { ${methods}\n${back} }`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const settle = () => new Promise(resolve => setImmediate(resolve));

function create(remote = false) {
  const toc = deferred(), catalog = deferred(), body = deferred();
  const book = {
    sourceId: remote ? 'source' : 'local', bookId: 'book', title: 'Test book', author: 'Author',
    currentChapterIndex: 7, coverUrl: 'cover',
  };
  const entries = [...(remote ? [{ index: 5, title: '卷一', url: '' }] : []), { index: 7, title: 'Chapter seven', url: 'chapter-7' }];
  const session = { identity: book, book, entries, acquisitionMode: 'cache' };
  const probes = [];
  const Harness = new Function(
    'LOCAL_SOURCE_ID', 'ReaderRuntimeOwner', 'LocalReadingFlowGateway', 'RemoteReadingFlowGateway',
    'ReadingOfflineGateway', 'ReaderCoreGateway', 'SourceGateway', 'RemoteDetailAdmission',
    'hilog', 'DOMAIN', 'readerSourceCategoryIsText', 'readerSourceCategoryLabel',
    'remoteReadingFailureKindOf', 'verdictForFailureKind', 'isRemoteSourceFailureKind',
    'remoteSourceFailureSummary', 'RemoteReadingGatewayError', 'remoteReadingFailureRecord', 'searchCandidateRank',
    'sameRemoteSessionEvidence','preparedRemoteChapterMatches','withPreparedRemoteChapter','copyRemoteReadingSession','RemoteChapterCacheRefreshError',
    `${harnessCode}; return Harness;`,
  )(
    'local', { current: () => ({ bookAcquisitions: () => ({ readingProjectionRevision:()=>0, endSearch() {}, setPreparationVisible() {}, acquireBookWithBackgroundRefresh: (seed) => {
      assert.equal(seed.sourceId,book.sourceId,'a shelf preview or resume keeps its durable source identity');
      assert.equal(seed.bookId,book.bookId,'a shelf preview or resume keeps its durable book identity');
      return catalog.promise.then(session => ({ session }));
    }, acquireCandidateGroup:()=>assert.fail('a shelf book must not enter automatic candidate substitution'), recentFailures: () => [] }) }) },
    class { loadToc() { return toc.promise; } loadDirectoryProjection() { return Promise.resolve(entries); } },
    class {
      openCachedCatalogSession() { return catalog.promise; }
      openSession() { return catalog.promise; }
      loadChapter(_session, index) { probes.push(index); return body.promise.then(() => ({sourceId:book.sourceId,bookId:book.bookId,chapterIndex:index,chapterUrl:`chapter-${index}`,contentVersion:`body-${index}`,content:'正文',images:[]})); }
    },
    class {}, class { loadShelfBook() { return Promise.resolve(book); } },
    class { loadSources() { return Promise.resolve([{ sourceId: 'source', category: 'novel' }]); } },
    class { constructor(value) { this.session = value; } },
    { info() {}, warn() {}, error() {} }, 0, () => true, () => '小说',
    error => error.kind ?? 'NETWORK_FAILED', () => 'networkFailed',
    kind => kind === 'NETWORK_FAILED', () => '网络请求失败', class extends Error {}, () => ({}), searchCandidateRank,
    readingEvidence.sameRemoteSessionEvidence, readingEvidence.preparedRemoteChapterMatches, readingEvidence.withPreparedRemoteChapter, readingEvidence.copyRemoteReadingSession,RemoteChapterCacheRefreshError,
  );
  const h = new Harness(), routes = [], alerts = [];
  let route = 'bookshelf';
  Object.defineProperty(h, 'route', { get: () => route, set: value => { routes.push(value); route = value; } });
  Object.assign(h, {
    remoteSessionGeneration:0,remoteContentProbeGeneration:0,readingOriginRoute: 'detail', shelfReadingPreparation: false, navigationGeneration: 0,
    readingSessionActive: false, detailReturnRoute: 'bookshelf', detailToc: [], shelfBooks: [book],
    searchDetailCandidates: [],
    remoteCatalogRefreshAt: new Map(), offlineMutationGeneration: 0, bookshelfRemovalActiveKey: '',
    bookshelfRemovalGeneration: 0, bookshelfLoadGeneration: 0,
    sourceSwitchVisible: false, remoteContentVerdict: 'readable',
    sourceDisplayName: () => 'Test source', readingDetailForShelf: value => ({ ...value }),
    readingDetailForRemoteSeed: value => ({ ...value }), hasDeclaredCoverUrl: () => true,
    loadRemoteDirectoryProjection: async () => entries,
    refreshDetailAcquisitionProjection: async () => {},
    refreshBookshelf() {}, resetSearchDetailWarmups() {}, hasVisibleImportDialog: () => false,
    startSourceDiscovery() {}, showReadingFailure: (title, message) => alerts.push({ title, message }),
    getUIContext: () => ({ showAlertDialog: dialog => alerts.push(dialog) }),
  });
  return { h, book, session, toc, catalog, body, entries, probes, routes, alerts };
}

for (const remote of [false, true]) {
  const t = create(remote), { h } = t;
  h.openShelfBook(t.book);
  assert.equal(h.route, 'bookshelf');
  assert.equal(h.shelfReadingPreparation, true);
  assert.equal(h.readingSessionActive, false);
  if (remote) {
    t.catalog.resolve(t.session);
    await settle();
    assert.equal(h.readingSessionActive, false, 'catalog alone cannot reveal reading');
    assert.deepEqual(t.probes, [7], 'resume must probe the persisted chapter');
    t.body.resolve('body');
  } else {
    t.toc.resolve({ entries: t.entries });
  }
  await settle();
  assert.equal(h.readingSessionActive, true);
  assert.equal(h.route, 'bookshelf', 'first-page preparation retains the shelf');
  assert.equal(h.requestedChapterIndex, undefined, 'preserve the persisted offset');
  h.presentPreparedReading(7);
  assert.equal(h.route, 'reading');
  h.onReaderExited();
  assert.equal(h.route, 'bookshelf', 'reader back follows the shelf origin');
  assert.equal(h.readingSessionActive, false);
  assert.ok(!t.routes.includes('detail'), 'no transient detail route anywhere in the shelf journey');
}

for (const remote of [false, true]) {
  const t = create(remote);
  t.h.openShelfBookInfo(t.book);
  t.toc.resolve({ entries: t.entries });
  t.catalog.resolve(t.session);
  t.body.resolve('body');
  await settle();
  assert.equal(t.h.route, 'detail');
  assert.equal(t.h.readingSessionActive, false, 'long-press info must not automatically read');
  t.h.openReading(undefined);
  t.h.presentPreparedReading(7);
  t.h.onReaderExited();
  assert.equal(t.h.route, 'detail', 'explicit detail entry returns to detail');
}

{
  const t = create(true);
  t.h.route = 'search';
  // Exercise the actual search dispatcher: it supplies the exact durable shelf
  // snapshot. Calling its lower-level detail entry without that snapshot would
  // model a new-book trial instead of this persisted-book journey.
  t.h.onSearchResultSelected({...t.book,sourceName:'Test source',variables:[]},
    [{...t.book,sourceId:'alternative',sourceName:'Another source',variables:[]}]);
  t.catalog.resolve(t.session); t.body.resolve('body');
  await settle();
  assert.equal(t.h.route, 'detail');
  assert.equal(t.h.detailReturnRoute, 'search');
  assert.equal(t.h.readingSessionActive, false, 'search result remains a preview even for a shelf book');
}

for (const remote of [false, true]) {
  const t = create(remote);
  t.h.openShelfBook(t.book);
  assert.equal(t.h.onBackPress(), true);
  t.toc.resolve({ entries: t.entries }); t.catalog.resolve(t.session); t.body.resolve('body');
  await settle();
  assert.equal(t.h.route, 'bookshelf');
  assert.equal(t.h.readingSessionActive, false, 'late admission cannot revive a cancelled entry');
  assert.equal(t.h.shelfReadingPreparation, false);
}

{
  const t = create();
  t.h.openShelfBook(t.book); t.toc.resolve({ entries: t.entries }); await settle();
  let exits = 0;
  t.h.readingExitRequest = () => { exits++; };
  assert.equal(t.h.onBackPress(), true);
  t.h.presentPreparedReading(7);
  assert.equal(t.h.route, 'bookshelf', 'a late first page must not override Back');
  assert.equal(exits, 1);
  t.h.onReaderExited();
  assert.equal(t.h.readingSessionActive, false);
}

{
  const t = create();
  t.h.openShelfBook(t.book);
  t.h.nextNavigationGeneration(); t.h.route = 'search';
  t.toc.resolve({ entries: t.entries }); await settle();
  assert.equal(t.h.route, 'search');
  assert.equal(t.h.readingSessionActive, false, 'navigation invalidates delayed entry');
}

for (const remote of [false, true]) {
  const t = create(remote);
  t.h.openShelfBook(t.book);
  if (remote) {
    t.catalog.resolve(t.session); await settle(); t.body.reject(new Error('offline'));
  } else {
    t.toc.resolve({ entries: [] });
  }
  await settle();
  assert.equal(t.h.route, 'bookshelf');
  assert.equal(t.h.shelfReadingPreparation, false, 'failed entry releases shelf actions');
  assert.equal(t.h.readingSessionActive, false);
  assert.equal(t.alerts.length, 1, 'failed entry must explain why it stayed on the shelf');
}

{
  const t = create(true), { h } = t;
  h.openShelfBook(t.book); t.catalog.resolve(t.session); t.body.resolve('body'); await settle();
  h.onReadingFailure('source', 'book', 'offline', 'NETWORK_FAILED');
  h.onReaderExited();
  assert.equal(h.route, 'bookshelf');
  t.alerts[0].primaryButton.action();
  assert.equal(h.readingSessionActive, true, 'retry still owns the admitted book after serialized exit');
  assert.equal(h.route, 'bookshelf');
  h.onReaderExited();
  t.alerts[0].secondaryButton.action();
  assert.equal(h.sourceSwitchVisible, true, 'explicit source choice can recover over the shelf');
  assert.equal(h.route, 'bookshelf');
  assert.ok(!t.routes.includes('detail'));
  h.sourceSwitchVisible = false;
  h.detailBook = { ...t.book, bookId: 'different' };
  t.alerts[0].primaryButton.action();
  assert.equal(h.readingSessionActive, false, 'old failure actions cannot read a different selection');
}

console.log('bookshelf reading entry: PASS (local/remote, info/search, back, cancellation, failure, retry/source switch)');

{
 const t=create(true),h=t.h;h.openShelfBook(t.book);t.catalog.resolve(t.session);t.body.resolve('body');await settle();
 const session=h.remoteReadingSession,toc=h.detailToc;let exits=0;h.readingExitRequest=()=>{exits++;};
 h.requestReaderBookInfo();assert.equal(exits,1);assert.equal(h.readingSessionActive,true,'information waits for normal serialized exit');
 h.onReaderExited();assert.equal(h.route,'detail');assert.equal(h.detailReturnRoute,'bookshelf');
 assert.equal(h.remoteReadingSession,session);assert.equal(h.detailToc,toc,'information reuses exact admitted directory');
}

// Exercise the actual Panel -> LRE -> ReaderShell -> Index -> registered LRE exit closure ->
// durable save -> Index route chain. The former stub above could not detect an
// explicit Info action being consumed as one layered system Back operation.
const readingFile = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const readingSource = readFileSync(readingFile, 'utf8');
const exitRegistration = readingSource.match(/this\.onExitRequestHandler\(([\s\S]*?)\);/);
assert.ok(exitRegistration, 'production guarded exit registration');
const registerExit = new Function(`return function () { ${stripTypeScriptTypes(`this.onExitRequestHandler(${exitRegistration[1]});`)} };`)();
const infoBinding = readingSource.match(/onOpenBookInfo: \(\): void => (this\.\w+\(\)),/);
assert.ok(infoBinding, 'production More info callback');
const invokeInfo = new Function(`return function () { ${infoBinding[1]}; };`)();
const shellSource = readFileSync(new URL('../entry/src/main/ets/features/shell/ReaderShell.ets', import.meta.url), 'utf8');
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require = createRequire(import.meta.url), ts = require(`${sdk}/node_modules/typescript`);
const sdkOptions = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const parseComponent = text => ts.createSourceFile('/tmp/ReaderInfoAssembly.ets', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, sdkOptions);
const indexTree = parseComponent(source), shellTree = parseComponent(shellSource), readingTree = parseComponent(readingSource);
const callbacks = ['onExitRequestHandler', 'onExit', 'onExitCancelled', 'onOpenBookInfo'];
function exitCallbacksAt(tree, receiverTree, childName, owner) {
  let call;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === childName) call = node;
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.ok(call, `actual ${childName} assembly`);
  const receiver = receiverTree.statements.find(node => node.name?.getText(receiverTree) === childName);
  assert.ok(receiver, `${childName} declaration`);
  const properties = call.arguments[0].properties;
  for (const property of properties) assert.ok(receiver.members.some(member => member.name?.getText(receiverTree) === property.name.getText(tree)),
    `${childName} must declare actual supplied parameter ${property.name.getText(tree)}`);
  return Object.fromEntries(callbacks.map(name => {
    const property = properties.find(node => node.name?.getText(tree) === name);
    assert.ok(property, `${childName} must forward ${name}`);
    const factory = new Function(`return function () { return ${stripTypeScriptTypes(property.initializer.getText(tree))}; };`)();
    return [name, factory.call(owner)];
  }));
}
const Reading = productionMotionMethods(readingFile, ['requestExit', 'beginExit', 'finishExit', 'controlTiming'], {
  ...readerControlState, ...readerControlHost, ...readerControlKeyboard, ...readerTiming, ...readerRapid, ...readerAuto,
  ReaderWindowCoordinator: { metrics: () => ({ ready: true, keyboardInsets: { bottom: 0 } }) },
});
const MorePanel = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url),
  ['performMoreAction', 'dismissMoreMenu', 'setMoreMenuVisible']);
const homeControl = () => readerControlState.openReaderControlSession(readerControlState.createReaderControlSessionState(), 0);
const autoControl = () => readerControlState.enterReaderControlModule(homeControl(), 'autoPage', 0);

async function infoExitHarness(state) {
  const t = create(true), index = t.h;
  index.openShelfBook(t.book); t.catalog.resolve(t.session); t.body.resolve('body'); await settle();
  index.route = 'reading';
  const calls = [], stop = deferred(), record = deferred(), progress = deferred();
  const onExited = index.onReaderExited.bind(index), onCancelled = index.cancelReaderExitDestination.bind(index);
  index.onReaderExited = () => { calls.push('route'); onExited(); };
  index.cancelReaderExitDestination = () => { calls.push('exit-cancelled'); onCancelled(); };
  const shell = exitCallbacksAt(indexTree, shellTree, 'ReaderShell', index);
  const readingCallbacks = exitCallbacksAt(shellTree, readingTree, 'ReadingExperience', shell);
  const reading = Object.assign(new Reading(), {
    mounted: true, lifecycleToken: 9, exitRequested: false, exitDelivered: false, exitAttemptGeneration: 0, reduceMotion: false,
    latestControlVisualSession: state, controlSession: state, controlTemporaryLayer: false,
    rapidPageTurnState: readerRapid.createReaderRapidPageTurnState(),
    autoPageState: readerAuto.pauseReaderAutoPage(readerAuto.startReaderAutoPage(readerAuto.createReaderAutoPageState(8)), 'manual'),
    readerSettingsSnapshot: { navigationMode: 'paged' },
    invalidateControlBackdrop() {}, isControlInputEnabled: () => true,
    controlKeyboardHost: () => ({ hideTextInput: async () => {}, onFailure() {} }),
    isSessionActive: token => token === 9, isMountedToken: token => token === 9,
    pageTurnInputPhase: () => 'idle', stopReaderTtsAudition() {}, captureReadingRecordElapsed() {},
    finishSessionCapsuleMorph: () => calls.push('capsule-finished'), clearReadingRecordTimer() {},
    clearAutoPageTimer() {}, clearAutoPageSessionTimer() {}, cancelFirstPageReadyDeadline() {},
    ttsCoordinator: { stop: () => { calls.push('stop'); return stop.promise; } },
    flushReadingRecordForExit: () => { calls.push('record'); return record.promise; },
    commitVisiblePage: () => { calls.push('progress'); return progress.promise; },
    ...readingCallbacks,
    beginReadingRecordClock: () => calls.push('resume-record'),
    getUIContext: () => ({ showAlertDialog: dialog => t.alerts.push(dialog) }),
  });
  registerExit.call(reading);
  const panel = Object.assign(new MorePanel(), {
    moreMenuVisible: true, inputEnabled: true, frame: () => ({ visibility: 1 }),
    onTemporaryLayerChange: visible => { reading.controlTemporaryLayer = visible; },
    onOpenBookInfo: () => invokeInfo.call(reading),
  });
  return { ...t, index, reading, panel, calls, stop, record, progress };
}

for (const state of [homeControl(), autoControl(), readerControlState.expandReaderControlSession(autoControl(), 0)]) {
  const t = await infoExitHarness(state);
  const admittedSession = t.index.remoteReadingSession, admittedToc = t.index.detailToc;
  t.panel.performMoreAction('info');
  assert.equal(t.panel.moreMenuVisible, false);
  assert.equal(t.reading.exitRequested, true, 'Info must enter durable exit immediately, not be consumed as control Back');
  assert.equal(t.index.route, 'reading', 'Info cannot navigate before persistence completes');
  assert.deepEqual(t.calls, ['capsule-finished', 'stop']);
  t.stop.resolve(); await settle(); assert.deepEqual(t.calls, ['capsule-finished', 'stop', 'record']);
  assert.equal(t.index.route, 'reading');
  t.record.resolve(); await settle(); assert.equal(t.calls.at(-1), 'progress');
  assert.equal(t.index.route, 'reading');
  t.progress.resolve(); await settle();
  assert.equal(t.index.route, 'detail'); assert.equal(t.index.readingSessionActive, false);
  assert.equal(t.calls.filter(value => value === 'route').length, 1);
  assert.equal(t.index.remoteReadingSession, admittedSession); assert.equal(t.index.detailToc, admittedToc);
  assert.equal(t.probes.length, 1, 'Info does not acquire the book or request chapter content again');
}

{
  const t = await infoExitHarness(autoControl());
  t.panel.performMoreAction('info'); t.stop.resolve(); t.record.resolve(); await settle();
  t.progress.reject(new Error('durable save failed')); await settle();
  assert.equal(t.index.route, 'reading'); assert.equal(t.index.readingSessionActive, true);
  assert.equal(t.reading.exitRequested, false);
  assert.equal(t.alerts.at(-1).title, '阅读进度尚未保存');
  assert.equal(t.alerts.at(-1).message, '请重试保存后退出。当前阅读位置已保留。');
  assert.equal(t.calls.includes('route'), false, 'failed save never grants route ownership');
  const retried = deferred(); t.reading.commitVisiblePage = () => retried.promise;
  const failureDialog = t.alerts.at(-1);
  failureDialog.primaryButton.action(); await settle(); assert.equal(t.index.route, 'reading');
  retried.resolve(); await settle(); assert.equal(t.index.route, 'detail', 'retry retains Info destination');
  assert.equal(t.calls.includes('exit-cancelled'), false, 'retry and successful save never cancel navigation');
  const callsAfterExit = [...t.calls]; failureDialog.secondaryButton.action();
  assert.deepEqual(t.calls, callsAfterExit, 'old cancellation cannot revive reading after retry success');
}

for (const cancelKind of ['continue', 'dismiss']) {
  const t = await infoExitHarness(homeControl());
  t.panel.performMoreAction('info'); t.stop.resolve(); t.record.resolve(); await settle();
  t.progress.reject(new Error('durable save failed')); await settle();
  const failureDialog = t.alerts.at(-1);
  if (cancelKind === 'continue') failureDialog.secondaryButton.action();
  else failureDialog.cancel?.();
  assert.equal(t.index.route, 'reading');
  const closed = readerControlState.createReaderControlSessionState();
  t.reading.latestControlVisualSession = closed; t.reading.controlSession = closed;
  t.reading.commitVisiblePage = async () => {};
  t.index.readingExitRequest(); await settle();
  assert.equal(t.index.route, 'bookshelf', 'cancelled Info request must not redirect a later ordinary reading exit');
  assert.equal(t.calls.filter(value => value === 'exit-cancelled').length, 1);
  assert.equal(t.calls.filter(value => value === 'resume-record').length, 1);
  const settledCalls = [...t.calls];
  failureDialog.primaryButton.action(); failureDialog.secondaryButton.action(); failureDialog.cancel?.();
  assert.deepEqual(t.calls, settledCalls, 'cancelled dialog cannot retry or cancel twice');
}

{
  const t = await infoExitHarness(homeControl());
  t.panel.performMoreAction('info'); t.stop.resolve(); t.record.resolve(); await settle();
  t.progress.reject(new Error('durable save failed')); await settle();
  const oldDialog = t.alerts.at(-1), newProgress = deferred();
  t.reading.commitVisiblePage = () => newProgress.promise;
  t.index.requestReaderBookInfo(); await settle();
  oldDialog.secondaryButton.action(); oldDialog.primaryButton.action(); oldDialog.cancel?.();
  assert.equal(t.calls.includes('exit-cancelled'), false, 'old dialog cannot cancel a newer explicit exit request');
  newProgress.resolve(); await settle(); assert.equal(t.index.route, 'detail');
}

{
  const t = await infoExitHarness(homeControl());
  t.panel.performMoreAction('info'); t.stop.resolve(); t.record.resolve(); await settle();
  t.progress.reject(new Error('durable save failed')); await settle();
  const oldDialog = t.alerts.at(-1), calls = [...t.calls];
  t.reading.isMountedToken = () => false;
  oldDialog.secondaryButton.action(); oldDialog.primaryButton.action(); oldDialog.cancel?.();
  assert.deepEqual(t.calls, calls, 'unmounted reader cannot cancel a different lifecycle navigation');
}

for (const state of [homeControl(), autoControl(), readerControlState.expandReaderControlSession(autoControl(), 0)]) {
  const t = await infoExitHarness(state);
  t.index.readingExitRequest();
  assert.equal(t.reading.exitRequested, false, 'ordinary registered system Back retains layered semantics');
  assert.equal(t.index.route, 'reading'); assert.equal(t.calls.length, 0);
  assert.notDeepEqual(t.reading.controlSession, state, 'Back changes one control layer');
}
console.log('Reader Info production chain: explicit navigation, serialized stop/record/progress, save failure/retry and layered Back PASS');
