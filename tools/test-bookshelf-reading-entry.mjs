import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { compileHost, setRuntime } from './lib/reading-entry-owner-probe.mjs';
import { searchReadingJourneyFixture } from './lib/search-reading-journey-owner-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import * as readerControlState from '../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts';
import * as readerControlHost from '../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts';
import * as readerControlKeyboard from '../entry/src/main/ets/ui/foundation/ReaderKeyboardBack.ts';
import * as readerTiming from '../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';
import * as readerRapid from '../entry/src/main/ets/features/reading/ui/ReaderRapidPageTurnState.ts';
import * as readerAuto from '../entry/src/main/ets/features/reading/ui/ReaderAutoPageState.ts';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});

const { readerControlMotionMs } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlMotionPolicy.ts');

const source = readFileSync(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url), 'utf8');
const sdk = resolveEtsLoaderRoot();
const require = createRequire(import.meta.url), ts = require(`${sdk}/node_modules/typescript`);
const sdkOptions = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const parseComponent = text => ts.createSourceFile(virtualFilePath('ReaderInfoAssembly.ets'), text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, sdkOptions);
const indexTree = parseComponent(source);
assert.equal(indexTree.parseDiagnostics.length, 0, 'production Index parses with the SDK');
const indexType = indexTree.statements.find(node => node.name?.getText(indexTree) === 'Index');
function method(signature) {
  const name = signature.replace(/^async /, '').replace(/\($/, '');
  const member = indexType.members.find(node => ts.isMethodDeclaration(node) && node.name?.getText(indexTree) === name);
  assert.ok(member, `production Index method ${name}`);
  assert.equal(ts.getAllDecorators(member).length, 0, 'ordinary reading harness excludes neighboring UI builders');
  return member.getText(indexTree);
}
const methodNames = [
  'onBackPress', 'dispatchBackDestination', 'cancelShelfReadingPreparation', 'requestReadingExit',
  'registerReadingExitRequest', 'onReaderExited', 'cancelReaderExitDestination', 'requestReaderBookInfo',
  'retainedReaderPorts', 'directoryNavigationPorts',
];
for (const name of methodNames) method(name + '(');
const IndexWiring = selectedProductionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'Index', methodNames);
const ReaderReturn = selectedProductionMethods(new URL('../entry/src/main/ets/app/composition/ReaderDownloadJourney.ets', import.meta.url),
  'ReaderDownloadJourney', ['restoreReaderReturn']);
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
  const probes = [], progressReads = [];
  const runtime = ({ current: () => ({ noteReadingPreparationIntent(sourceId, bookId) {
      assert.equal(sourceId, book.sourceId); assert.equal(bookId, book.bookId);
    }, bookAcquisitions: () => ({ readingProjectionRevision:()=>0, endSearch() {}, setPreparationVisible() {}, acquireBookWithBackgroundRefresh: (seed) => {
      assert.equal(seed.sourceId,book.sourceId,'a shelf preview or resume keeps its durable source identity');
      assert.equal(seed.bookId,book.bookId,'a shelf preview or resume keeps its durable book identity');
      return catalog.promise.then(session => ({ session }));
    }, acquireCandidateGroup:()=>assert.fail('a shelf book must not enter automatic candidate substitution'), recentFailures: () => [] }) }) }).current();
  const runtimeAuthority = runtimeOwnerIdentityProbe(() => runtime);
  runtime.request=async(method)=>{
    if(method==='bookmark.list')return{data:{bookmarks:[]}};
    if(method==='source.list')return{data:{sources:[{sourceId:'source',name:'Test source',enabled:true}]}};
    throw Error('unexpected shelf entry native request '+method);
  };
  setRuntime(runtime);
  const LocalGateway=class { loadToc() { return toc.promise; } loadDirectoryProjection() { return Promise.resolve(entries); } };
  const RemoteGateway=class {
    openCachedCatalogSession() { return catalog.promise; }
    openSession() { return catalog.promise; }
    async loadProgress() { progressReads.push(book.bookId); return {kind:'restored',progress:{...book,chapterIndex:book.currentChapterIndex,chapterOffset:10,chapterProgress:0,updatedAt:100}}; }
    loadChapter(_session,index) { probes.push(index);return body.promise.then(()=>({sourceId:book.sourceId,bookId:book.bookId,chapterIndex:index,chapterUrl:`chapter-${index}`,contentVersion:`body-${index}`,content:'正文',images:[]})); }
  };
  const Entry=compileHost(undefined,{ReaderRuntimeOwner:runtimeAuthority,LocalReadingFlowGateway:LocalGateway,RemoteReadingFlowGateway:RemoteGateway,
    ReaderCoreGateway:class {loadShelfBook(){return Promise.resolve(book);}},SourceGateway:class {loadSources(){return Promise.resolve([{sourceId:'source',category:'novel'}]);}}});
  const routes = [], alerts = [];
  const x = searchReadingJourneyFixture({runtime,ReadingHost:Entry,route:'bookshelf',shelfBooks:[book],
    sourceName:()=> 'Test source',loadLocal:async()=>book,failure:(title,message)=>alerts.push({title,message})});
  const returnOwner=Object.assign(new ReaderReturn(),{navigation:x.navigation,ports:{runtime:()=>runtime,
    downloads:()=>assert.fail('download return view outside this shelf fixture')}});
  x.actions.ports.restoreReaderReturn=context=>returnOwner.restoreReaderReturn(context);
  const show = x.navigation.show.bind(x.navigation);
  x.navigation.show = route => { routes.push(route); return show(route); };
  const wiring = Object.assign(new IndexWiring(), {
    currentReadingRuntime:()=>runtime,navigationOwner:x.navigation,readingEntry:x.entry,
    readingEntryActions:x.actions,readingExitActions:x.exit,libraryJourney:x.journey,
    mangaSourceSwitch:{selectionVisible:false},bookRemovalConfirmation:{isOpen:()=>false},
    jsonImportPresentation:{opening:undefined},sourceSwitchPresentation:x.source,sourceSwitchActions:{},
    shelfMutations:{snapshot:{}},shelfGroupPresentation:{back:()=>false},shelfMotion:{pendingExitId:-1},
    directoryJourney:{operations:{},navigationPorts:()=>({})},
  });
  Object.defineProperty(wiring,'route',{get:()=>x.navigation.snapshot().route});
  const registerExit = request => {
    const identity=x.entry.readerPresentationIdentity();
    return x.exit.attach(request,identity,()=>x.entry.sessionActive&&x.entry.readerPresentationIdentity()===identity);
  };
  return { ...x, wiring, registerExit, runtime, book, session, toc, catalog, body, entries, probes, progressReads, routes, alerts };
}

// Exercise the actual shelf dispatcher and the original reading component.
function resumeAcquisition(t, book) {
 t.actions.resumeShelf(book);
 // The ordinary native reader mounting boundary supplies an exit registration.
 // The complete production LRE exit protocol is exercised below separately.
 t.registerExit(()=>t.exit.accepted(t.entry.readerPresentationIdentity()));
}
for (const remote of [false, true]) {
  const t = create(remote), h = t;
  resumeAcquisition(h,t.book);
  assert.equal(h.navigation.snapshot().route, 'reading');
  assert.equal(h.actions.shelfPreparing, false);
  assert.equal(h.entry.sessionActive, true, 'both local and remote books mount before acquisition');
  if (remote) {
    t.catalog.resolve(t.session);
    await settle();
    assert.equal(h.entry.sessionActive, true, 'the reader can restore progress and load its body as soon as the catalog is admitted');
    assert.equal(h.navigation.snapshot().route, 'reading', 'catalog completion does not route through detail');
    assert.deepEqual(t.probes, [], 'the parent must not duplicate the reader progress/body read');
    assert.deepEqual(t.progressReads, [], 'Core progress restoration belongs to the reader, once');
  } else {
    t.toc.resolve({ entries: t.entries });
  }
  await settle();
  assert.equal(h.entry.sessionActive, true);
  assert.equal(h.navigation.snapshot().route, 'reading', 'loading and errors belong to the mounted reader');
  assert.equal(h.entry.requestedChapterIndex, undefined, 'preserve the persisted offset');
  h.actions.presentPreparedReading(7);
  assert.equal(h.navigation.snapshot().route, 'reading');
  if (remote) assert.equal(h.entry.verdict, 'readable', 'real first-page admission also updates the retained detail verdict');
  h.exit.accepted(h.entry.readerPresentationIdentity());
  assert.equal(h.navigation.snapshot().route, 'bookshelf', 'reader back follows the shelf origin');
  assert.equal(h.entry.sessionActive, false);
  assert.ok(!t.routes.includes('detail'), 'no transient detail route anywhere in the shelf journey');
}

for (const remote of [false, true]) {
  const t = create(remote);
  t.actions.openShelfEntry(t.book,'info');
  t.toc.resolve({ entries: t.entries });
  t.catalog.resolve(t.session);
  t.body.resolve('body');
  await settle();
  assert.equal(t.navigation.snapshot().route, 'detail');
  assert.equal(t.entry.sessionActive, false, 'long-press info must not automatically read');
  t.actions.openReading(undefined);
  t.actions.presentPreparedReading(7);
  t.exit.accepted(t.entry.readerPresentationIdentity());
  assert.equal(t.navigation.snapshot().route, 'detail', 'explicit detail entry returns to detail');
}

{
  const t = create(true);
  t.navigation.show('search');
  // Exercise the actual search dispatcher: it supplies the exact durable shelf
  // snapshot. Calling its lower-level detail entry without that snapshot would
  // model a new-book trial instead of this persisted-book journey.
  t.journey.selectResult({...t.book,sourceName:'Test source',variables:[]},
    [{...t.book,sourceId:'alternative',sourceName:'Another source',variables:[]}]);
  t.catalog.resolve(t.session); t.body.resolve('body');
  await settle();
  assert.equal(t.navigation.snapshot().route, 'detail');
  assert.equal(t.navigation.returns.snapshot().detailParent, 'search');
  assert.equal(t.entry.sessionActive, false, 'search result remains a preview even for a shelf book');
}

for (const remote of [false, true]) {
  const t = create(remote);
  resumeAcquisition(t,t.book);
  assert.equal(t.wiring.onBackPress(), true);
  t.toc.resolve({ entries: t.entries }); t.catalog.resolve(t.session); t.body.resolve('body');
  await settle();
  assert.equal(t.navigation.snapshot().route, 'bookshelf');
  assert.equal(t.entry.sessionActive, false, 'late admission cannot revive a cancelled entry');
  assert.equal(t.actions.shelfPreparing, false);
}

{
  const t = create();
  resumeAcquisition(t,t.book); t.toc.resolve({ entries: t.entries }); await settle();
  let exits = 0;
  t.registerExit(() => { exits++; });
  assert.equal(t.wiring.onBackPress(), true);
  t.actions.presentPreparedReading(7);
  assert.equal(t.navigation.snapshot().route, 'reading', 'Back waits for the mounted reader exit transaction');
  assert.equal(exits, 1);
  t.exit.accepted(t.entry.readerPresentationIdentity());
  assert.equal(t.entry.sessionActive, false);
}

{
  const t = create();
  resumeAcquisition(t,t.book);
  t.entry.retire();t.actions.retirePreparation();t.navigation.advance(); t.navigation.show('search');
  t.entry.endReading();
  t.toc.resolve({ entries: t.entries }); await settle();
  assert.equal(t.navigation.snapshot().route, 'search');
  assert.equal(t.entry.sessionActive, false, 'navigation invalidates delayed entry');
}

for (const remote of [false, true]) {
  const t = create(remote);
  resumeAcquisition(t,t.book);
  t.entry.projectReaderFailure(t.book.sourceId, t.book.bookId, 'source acquisition failed', 'SOURCE_HTTP_FAILED');
  await settle();
  assert.equal(t.navigation.snapshot().route, 'reading');
  assert.equal(t.actions.shelfPreparing, false);
  assert.equal(t.entry.sessionActive, true);
  assert.equal(t.alerts.length, 0, 'the mounted reader owns the error and recovery actions');
}

{
  const t = create(true), h = t;
  resumeAcquisition(h,t.book);
  h.entry.projectReaderFailure('source', 'book', 'offline', 'SOURCE_HTTP_FAILED');
  assert.equal(h.navigation.snapshot().route, 'reading');
  assert.equal(h.entry.sessionActive, true);
  assert.deepEqual(t.alerts, [], 'source errors stay in the reader; no old exit/dialog action may own navigation');
  h.exit.accepted(h.entry.readerPresentationIdentity());
  assert.equal(h.navigation.snapshot().route, 'bookshelf');
  assert.equal(h.entry.sessionActive, false);
}

console.log('bookshelf reading entry: PASS (local/remote, info/search, back, cancellation, failure)');

// A reader mount never borrows a shelf projection's chapter index or performs
// the old parent cache-refresh admission. Actual retry/migration callbacks are
// exercised in test-reader-recoverable-entry and the position suites.
for (const snapshot of [undefined, true]) {
  const t = create(true), h = t;
  h.actions.openRemoteDetail({seed:t.book,sourceName:'Test source',shelfSnapshot:snapshot ? t.book : undefined,resumeImmediately:true});
  assert.equal(h.navigation.snapshot().route, 'reading');
  assert.equal(h.entry.sessionActive, true);
  assert.equal(h.entry.requestedChapterIndex, undefined, 'Core progress restores the saved offset inside the reader');
  assert.deepEqual(t.probes, []);
  assert.deepEqual(t.progressReads, []);
}

{
 const t=create(true),h=t;resumeAcquisition(h,t.book);t.catalog.resolve(t.session);t.body.resolve('body');await settle();
 const session=h.entry.session,toc=h.entry.toc,returnContext=h.navigation.returns.captureReaderReturn(h.runtime,()=>undefined);let exits=0;h.registerExit(()=>{exits++;});
 h.exit.requestBookInfo();assert.equal(exits,1);assert.equal(h.entry.sessionActive,true,'information waits for normal serialized exit');
 h.exit.accepted(h.entry.readerPresentationIdentity());assert.equal(h.navigation.snapshot().route,'detail');assert.equal(h.navigation.returns.snapshot().detailParent,'reader','current Info contract returns through the captured reader context');
 assert.deepEqual(h.navigation.returns.snapshot().retainedReader,returnContext,'Info retains the original bookshelf origin instead of replacing it');
 assert.equal(h.entry.session,session);assert.equal(h.entry.toc,toc,'information reuses exact admitted directory');
 h.journey.returnFromDetail();
 assert.equal(h.navigation.snapshot().route,'reading','reader parent re-admits through current EntryActions');
 h.registerExit(()=>h.exit.accepted(h.entry.readerPresentationIdentity()));h.exit.requestExit();
 assert.equal(h.navigation.snapshot().route,'bookshelf','the preserved origin still owns the next reader exit');
}

// Exercise the actual Panel -> LRE -> RetainedReaderScene -> ReaderShell ->
// current Index ports -> ExitActions -> registered LRE exit closure and handoff chain. The former stub above could not detect an
// explicit Info action being consumed as one layered system Back operation.
const readingFile = new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url);
const readingSource = readFileSync(readingFile, 'utf8');
const exitRegistration = readingSource.match(/this\.onExitRequestHandler\(([\s\S]*?)\);/);
assert.ok(exitRegistration, 'production guarded exit registration');
const registerExit = new Function(`return function () { ${stripTypeScriptTypes(`this.onExitRequestHandler(${exitRegistration[1]});`)} };`)();
const infoBinding = readingSource.match(/onOpenBookInfo: \(\): void => (this\.\w+\(\)),/);
assert.ok(infoBinding, 'production More info callback');
const invokeInfo = new Function(`return function () { ${infoBinding[1]}; };`)();
const retainedTree = parseComponent(readFileSync(new URL('../entry/src/main/ets/app/composition/RetainedReaderScene.ets', import.meta.url),'utf8'));
const shellFile = new URL('../entry/src/main/ets/features/reading/ui/ReaderShell.ets', import.meta.url);
const shellSource = readFileSync(shellFile, 'utf8');
const ShellIdentity = productionMotionMethods(shellFile, ['readingIdentityKey','acceptsTextInput','readingContentIsForeground']);
const shellTree = parseComponent(shellSource), readingTree = parseComponent(readingSource);
const callbacks = ['onExitRequestHandler', 'onExit', 'onExitCancelled', 'onOpenBookInfo'];
function childAssembly(tree, receiverTree, childName) {
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
  return properties;
}
function exitCallbacksAt(tree, receiverTree, childName, owner) {
  const properties=childAssembly(tree,receiverTree,childName);
  return Object.fromEntries(callbacks.map(name => {
    const property = properties.find(node => node.name?.getText(tree) === name);
    assert.ok(property, `${childName} must forward ${name}`);
    // The production ForEach captures its source/book identity before creating
    // child callbacks. Keep that lexical owner when exercising the exact closure.
    const factory = new Function('_identity', `return function () { return ${stripTypeScriptTypes(property.initializer.getText(tree))}; };`)(owner.readingIdentityKey?.());
    return [name, factory.call(owner)];
  }));
}
const Reading = productionMotionMethods(readingFile, ['requestExit', 'beginExit', 'finishExit', 'controlTiming'], {
  ...readerControlState, ...readerControlHost, ...readerControlKeyboard, ...readerTiming, ...readerRapid, ...readerAuto, readerControlMotionMs,
  ReaderWindowCoordinator: { metrics: () => ({ ready: true, keyboardInsets: { bottom: 0 } }) },
});
const MorePanel = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets', import.meta.url),
  ['performMoreAction', 'dismissMoreMenu', 'setMoreMenuVisible', 'syncProgressInput', 'progressInputEnabled',
    'invalidateProgressInput', 'contentLocation', 'contentInputEnabled', 'minimumInputReady', 'isExpanded',
    'hasCurrentTemporaryInput', 'currentTemporaryInputScope']);
const homeControl = () => readerControlState.openReaderControlSession(readerControlState.createReaderControlSessionState(), 0);
const autoControl = () => readerControlState.enterReaderControlModule(homeControl(), 'autoPage', 0);

async function infoExitHarness(state) {
  const t = create(true), index = t;
  resumeAcquisition(index,t.book); t.catalog.resolve(t.session); t.body.resolve('body'); await settle();
  index.actions.acceptReaderSession(t.session);
  assert.equal(index.entry.session.identity.bookId, t.book.bookId);
  assert.equal(index.entry.toc[1].index, 7, 'Info retains the actual reader-admitted catalog');
  index.navigation.show('reading');
  const calls = [], stop = deferred(), record = deferred(), progress = deferred();
  const onExited = index.wiring.onReaderExited.bind(index.wiring), onCancelled = index.wiring.cancelReaderExitDestination.bind(index.wiring);
  index.wiring.onReaderExited = identity => { calls.push('route'); onExited(identity); };
  index.wiring.cancelReaderExitDestination = identity => { calls.push('exit-cancelled'); onCancelled(identity); };
  const retainedProperties=childAssembly(indexTree,retainedTree,'RetainedReaderScene');
  const retained=Object.fromEntries(['reading','ports'].map(name=>{
    const property=retainedProperties.find(node=>node.name?.getText(indexTree)===name);
    assert.ok(property,`actual retained scene forwards ${name}`);
    return [name,new Function(`return (${stripTypeScriptTypes(property.initializer.getText(indexTree))});`).call(index.wiring)];
  }));
  const shell = exitCallbacksAt(retainedTree, shellTree, 'ReaderShell', retained);
  Object.assign(shell, { sourceId: index.entry.book.sourceId, bookId: index.entry.book.bookId, readingReadyGeneration: index.entry.readyGeneration,
    contentKind:'text',sourceSwitchVisible:false,sourceSwitchCovered:false,
    readingIdentityKey: ShellIdentity.prototype.readingIdentityKey,acceptsTextInput:ShellIdentity.prototype.acceptsTextInput,
    readingContentIsForeground:ShellIdentity.prototype.readingContentIsForeground });
  Object.defineProperties(shell,{route:{get:()=>index.navigation.snapshot().route},
    visible:{get:()=>index.entry.sessionActive},inputAllowed:{get:()=>index.controls.foreground}});
  const readingCallbacks = exitCallbacksAt(shellTree, readingTree, 'ReadingExperience', shell);
  const reading = Object.assign(new Reading(), {
    mounted: true, lifecycleToken: 9, exitRequested: false, exitDelivered: false, exitAttemptGeneration: 0, reduceMotion: false,
    latestControlVisualSession: state, controlSession: state, controlTemporaryLayer: false,
    rapidPageTurnState: readerRapid.createReaderRapidPageTurnState(),
    autoPageState: readerAuto.pauseReaderAutoPage(readerAuto.startReaderAutoPage(readerAuto.createReaderAutoPageState(8)), 'manual'),
    autoPageCoordinator: { cancelPendingTurn() {}, dispose() {} },
    readerSettingsSnapshot: { navigationMode: 'paged' },
    invalidateControlBackdrop() {}, isControlInputEnabled: () => true,
    controlKeyboardHost: () => ({ hideTextInput: async () => {}, onFailure() {} }),
    isSessionActive: token => token === 9, isMountedToken: token => token === 9,
    pageTurnInputPhase: () => 'idle', stopReaderTtsAudition() {}, captureReadingRecordElapsed() {},
    finishSessionCapsuleMorph: () => calls.push('capsule-finished'), clearReadingRecordTimer() {},
    clearAutoPageTimer() {}, clearAutoPageSessionTimer() {}, cancelFirstPageReadyDeadline() {},
    ttsCoordinator: { captureCompletedProgress: () => { calls.push('capture-tts'); return undefined; },
      stop: () => { calls.push('stop'); return stop.promise; } },
    readingRecordHost: { handoff: () => { calls.push('record-handoff'); void record.promise.catch(() => calls.push('record-pending')); } },
    handoffExitProgress: () => { calls.push('progress-handoff'); void progress.promise.catch(() => calls.push('progress-pending')); },
    flushReadingRecordForExit: () => assert.fail('route never waits on duration RPC'),
    awaitOrdinaryFirstPagePersistence: async () => {}, retainConfirmedEntryPresentation() {},
    commitVisiblePage: () => assert.fail('route never waits on page progress RPC'),
    ...readingCallbacks,
    beginReadingRecordClock: () => calls.push('resume-record'),
    getUIContext: () => ({ showAlertDialog: dialog => t.alerts.push(dialog) }),
  });
  registerExit.call(reading);
  const panel = Object.assign(new MorePanel(), {
    moreMenuVisible: true, moreMenuGeneration:0, inputEnabled: true, controlObscured:false, frame: () => ({ visibility: 1 }),
    runtimeMounted:true,runtimeLifecycle:1,controlOpenRevision:0,progressInputScope:'',progressInputRevision:0,progressPreviewPercent:-1,
    lastVisibleContentLocation:state.location,layout:{isExpanded:()=>state.location.form==='full'},minimumIdentity:'',
    minimumReady:false,minimumKey:'',temporaryLayerActive:false,visualVisibilityProgress:1,visualTransitionKind:'',visualHeldPointerId:-1,
    onTemporaryLayerChange: visible => { reading.controlTemporaryLayer = visible; },
    onOpenBookInfo: () => invokeInfo.call(reading),
  });
  return { ...t, index, reading, shell, panel, calls, stop, record, progress };
}

for (const state of [homeControl(), autoControl(), readerControlState.expandReaderControlSession(autoControl(), 0)]) {
  const t = await infoExitHarness(state);
  const admittedSession = t.index.entry.session, admittedToc = t.index.entry.toc;
  t.panel.performMoreAction('info');
  assert.equal(t.panel.moreMenuVisible, false);
  assert.equal(t.reading.exitRequested, true, 'Info enters explicit navigation immediately instead of consuming a control layer');
  assert.equal(t.index.navigation.snapshot().route, 'detail', 'Info navigates before any storage or TTS RPC resolves');
  assert.equal(t.index.entry.sessionActive, false);
  assert.deepEqual(t.calls, ['capsule-finished', 'record-handoff', 'capture-tts', 'progress-handoff', 'stop', 'route']);
  assert.equal(t.calls.filter(value => value === 'route').length, 1);
  assert.equal(t.index.entry.session, admittedSession); assert.equal(t.index.entry.toc, admittedToc);
  assert.equal(t.probes.length, 0, 'shelf entry and Info do not duplicate the reader chapter request');
  assert.equal(t.alerts.length, 0);
  t.reading.beginExit();
  assert.equal(t.calls.filter(value => value === 'route').length, 1, 'repeated exit never replays the destination');
  t.stop.resolve(); t.record.resolve(); t.progress.resolve(); await settle();
  assert.equal(t.index.navigation.snapshot().route, 'detail'); assert.equal(t.calls.filter(value => value === 'route').length, 1);
}

for (const failedTail of ['stop', 'record', 'progress']) {
  const t = await infoExitHarness(autoControl());
  t.panel.performMoreAction('info');
  assert.equal(t.index.navigation.snapshot().route, 'detail');
  t[failedTail].reject(new Error('background receipt pending'));
  for (const name of ['stop', 'record', 'progress']) if (name !== failedTail) t[name].resolve();
  await settle();
  assert.equal(t.index.navigation.snapshot().route, 'detail', 'late receipt failure cannot revoke the completed Info destination');
  assert.equal(t.index.entry.sessionActive, false);
  assert.equal(t.alerts.length, 0, 'background receipt failure does not reopen a save/cancel modal');
  assert.equal(t.calls.filter(value => value === 'route').length, 1);
  assert.equal(t.calls.includes('exit-cancelled'), false);
  assert.equal(t.calls.includes('resume-record'), false, 'retired page cannot resume a reading clock');
}

for (const state of [homeControl(), autoControl(), readerControlState.expandReaderControlSession(autoControl(), 0)]) {
  const t = await infoExitHarness(state);
  t.index.entry.currentExitRequest()();
  assert.equal(t.reading.exitRequested, false, 'ordinary registered system Back retains layered semantics');
  assert.equal(t.index.navigation.snapshot().route, 'reading'); assert.equal(t.calls.length, 0);
  assert.notDeepEqual(t.reading.controlSession, state, 'Back changes one control layer');
}
console.log('Reader Info production chain: immediate once-only navigation before TTS/duration/progress RPC, late failure preserves destination without modal, and layered Back PASS');

// Retained physical handlers must not borrow another foreground/generation.
for(const covered of ['background','successor-reader']) {
 const t=await infoExitHarness(homeControl());
 if(covered==='background')t.index.controls.foreground=false;
 else {t.index.entry.beginReaderPresentation();t.shell.readingReadyGeneration=t.index.entry.readyGeneration;}
 t.panel.performMoreAction('info');
 assert.equal(t.reading.exitRequested,false,'covered or old physical Info callback cannot start exit');
 assert.equal(t.index.navigation.snapshot().route,'reading');
 assert.deepEqual(t.calls,[],'foreground and reader identity both guard actual Shell callback');
 t.stop.resolve();t.record.resolve();t.progress.resolve();
}
console.log('Retained Info callback foreground and successor identity rejection PASS');
