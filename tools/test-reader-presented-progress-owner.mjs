import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { ReadingEntryPreparation } = await import('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts');
const layout = { viewportWidth: 390, viewportHeight: 800, fontScale: 1 };
const anchor = offset => ({ chapterIndex: 2, chapterOffset: offset, chapterProgress: offset / 1000,
  bodyVersion: 'body', processingVersion: 'processing' });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function settle() { for (let n = 0; n < 30; n++) await Promise.resolve(); }
function fixture(sourceId = 'local') {
  let durable = { sourceId, bookId: 'book', ...anchor(10), updatedAt: 1, locationRevision: 'r1' };
  const calls = [], gates = [], effects = [], readGates = [], readEffects = [];
  let closed = false, revision = 1;
  const runtime = { supportsCoreCapability: capability => capability === 'reading.progress.compareAndSet.v1',
    request: async (method, params, options = {}) => {
    calls.push({ method, params, options });
    if (options.shouldCancel?.()) throw Error('cancelled');
    if (method === 'reading.progress.get') {
      const gate = readGates.shift(); if (gate) await gate.promise;
      if (readEffects.shift() === 'reject') throw Error('temporary baseline read failure');
      return { data: { found: true, progress: { ...durable }, progressRevision: `op:${revision}` } };
    }
    assert.equal(method, 'reading.progress.update');
    const fence = preparation.beginRequest(method, params);
    try {
      const gate = gates.shift(); if (gate) await gate.promise;
      if (options.shouldCancel?.()) throw Error('cancelled');
      const effect = effects.shift();
      if (effect === 'reject') throw Error('write rejected before storage');
      if (effect === 'core-cas-rejected') throw {event:{type:'error',error:{code:'INVALID_PARAMS',details:{reason:'READING_PROGRESS_CHANGED'}}}};
      if (params.expectedProgressRevision !== undefined && params.expectedProgressRevision !== `op:${revision}`)
        throw Error('READING_PROGRESS_CHANGED');
      durable = { sourceId, bookId: 'book', chapterIndex: params.chapterIndex, chapterOffset: params.chapterOffset,
        chapterProgress: params.chapterProgress, bodyVersion: params.expectedBodyVersion, processingVersion: params.expectedProcessingVersion,
        deviceId: params.deviceId,
        updatedAt: ++revision, locationRevision: `r${revision}` };
      if (effect === 'lost') throw Error('receipt lost after storage');
      return { data: { stored: true, ...durable, progressRevision: `op:${revision}` } };
    } finally { if (fence) preparation.finishRequest(method, params); }
  }, captureReadingContentValidity: (source, book) => {
    const valid = preparation.captureContentValidity(source, book); return () => !closed && valid();
  } };
  const preparation = new ReadingEntryPreparation(runtime);
  const source = sourceId === 'local' ? { kind: 'local' } : { kind: 'remote', session: {
    identity: { sourceId, bookId: 'book' }, entries: [], preparedChapter: { content: 'not retained by progress owner' } } };
  return { sourceId, runtime, preparation, calls, gates, effects, readGates, readEffects,
    gateway: transaction => new ReadingSessionFlowGateway(sourceId, 'book', source, runtime, transaction),
    writes: () => calls.filter(call => call.method === 'reading.progress.update'),
    durable: () => durable, change: offset => { durable = { ...durable, ...anchor(offset), updatedAt: ++revision, locationRevision: `r${revision}` }; },
    sameSecondChange: () => { revision++; durable = { ...durable, deviceId: 'another-device' }; },
    close() { closed = true; preparation.close(); },
  };
}
const cases = [];
// Execute the actual retained-page exit, producer and local/remote CAS command
// path. Constructors are extracted unchanged from production, not restated.
const readerFile = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`), options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const tree = ts.createSourceFile('/tmp/ReaderRetainedProgress.ets', readFileSync(readerFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
const dto = Object.fromEntries(['CoreReadingAnchor', 'ReadingCommit'].map(name => {
  const node = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.getText(tree) === name);
  assert.ok(node, name);
  return [name, new Function(stripTypeScriptTypes(node.getText(tree)).replace(/^export /, '') + `;return ${name};`)()];
}));
const RetainedReader = productionMotionMethods(readerFile,
  ['commitVisiblePage', 'admitCommittedProgress', 'admitRetainedReadingRecency', 'isVisiblePageCurrent',
    'isSelectionCurrent', 'finishExit', 'awaitOrdinaryFirstPagePersistence', 'isOrdinaryFirstPagePresentationCurrent'], dto);
function retainedReaderFixture(f) {
  const gateway = f.gateway(), events = [], alerts = [], notices = [];
  let deviceReads = 0;
  const chapter = { chapterIndex: 2, chapterTitle: 'Retained chapter', bodyVersion: 'body', processingVersion: 'processing' };
  const page = { startScalar: 10, endScalar: 50 };
  // The acknowledged ratio intentionally differs from current host arithmetic:
  // a recency-only renewal cannot manufacture a new reading-progress value.
  const progress = new dto.ReadingCommit(f.sourceId, 'book', 2, 10, .01, 'r1', 1, undefined, 'body', 'processing', 'op:1');
  const owner = Object.assign(new RetainedReader(), { sourceId: f.sourceId, bookId: 'book', mounted: true,
    lifecycleToken: 1, chapterSelectionToken: 7, visiblePageSelectionToken: 7, materializedChapterSelectionToken: 7,
    chapter, visiblePage: page, phase: 'ready', commitInFlight: false, windowChromeActive: false, appForeground: true,
    retainedReadingRecencyReceipt: progress, retainedReadingRecencyVisible: false, lastCommittedProgress: progress,
    readerSettingsSnapshot: { navigationMode: 'paged' }, exitRequested: false, exitAttemptGeneration: 1, exitDelivered: false,
    isReaderIdentityCurrent: () => true, activeGateway: () => gateway, sessionGateway: gateway, coreLayout: () => layout,
    requireChapterLayoutMap: () => ({ scalarCount: () => 2000 }),
    readingRecordGateway: { async currentDeviceId() { deviceReads++; return 'harmony-current-device'; } },
    onReadingCommitted() { events.push('committed'); },
    flushReadingRecordForExit: async () => {},
    retainConfirmedEntryPresentation() {}, onExit() { events.push('exit'); },
    errorMessage: error => error.message,
    showReaderBackgroundNotice(message) { notices.push(message); },
    showReaderAlert(_category, options) { alerts.push(options); return {decision:Promise.resolve('pending')}; },
  });
  return { owner, gateway, progress, events, alerts, notices, deviceReads: () => deviceReads };
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), reader = retainedReaderFixture(f), owner = reader.owner;
  owner.admitRetainedReadingRecency();
  await owner.commitVisiblePage(1);
  assert.equal(f.calls.length, 0, 'an invisible same-page preparation does not renew recency or access storage');
  assert.equal(reader.deviceReads(), 0);
  owner.windowChromeActive = true;
  owner.admitRetainedReadingRecency(); owner.admitRetainedReadingRecency();
  owner.exitRequested = true;
  await owner.finishExit(1);
  assert.equal(f.writes().length, 1, 'a real same-page visit saves once before returning to the shelf');
  assert.equal(f.durable().updatedAt, 2, 'Core supplies the newer actual reading time');
  assert.deepEqual({ chapterIndex: f.durable().chapterIndex, chapterOffset: f.durable().chapterOffset,
    chapterProgress: f.durable().chapterProgress }, { chapterIndex: 2, chapterOffset: 10, chapterProgress: .01 });
  const params = f.writes()[0].params;
  assert.equal(params.sourceId, sourceId); assert.equal(params.bookId, 'book');
  assert.equal(params.deviceId, 'harmony-current-device', 'the existing device owner supplies this device, never an old progress author');
  assert.equal(params.expectedProgressRevision, 'op:1');
  assert.equal(params.expectedBodyVersion, 'body'); assert.equal(params.expectedProcessingVersion, 'processing');
  assert.equal(params.updatedAt, undefined, 'Host does not synthesize or increment a timestamp');
  assert.equal(Object.hasOwn(params, 'retainedProgressReceipt'), false, 'Host admission receipt is never a Core RPC field');
  assert.deepEqual(reader.events, ['committed', 'exit'], 'shelf navigation observes the actual save ACK first');
  assert.equal(owner.retainedReadingRecencyReceipt, undefined); assert.equal(owner.retainedReadingRecencyVisible, false);
  await owner.commitVisiblePage(1); await owner.finishExit(1);
  assert.equal(f.writes().length, 1); assert.equal(reader.deviceReads(), 1, 'repeat renders or exit requests cannot renew twice');
  f.close(); cases.push(`retained-same-page-visible-exit-renews-without-moving/${sourceId}`);
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), reader = retainedReaderFixture(f), owner = reader.owner;
  owner.windowChromeActive = true; owner.admitRetainedReadingRecency(); f.effects.push('lost');
  await assert.rejects(owner.commitVisiblePage(1), /receipt lost/);
  assert.equal(owner.retainedReadingRecencyVisible, true, 'an uncertain write cannot mark this visit complete');
  // The actual finishExit retry drains this existing durable owner before it
  // asks commitVisiblePage whether another write is required.
  await owner.awaitOrdinaryFirstPagePersistence();
  await owner.commitVisiblePage(1);
  assert.equal(f.writes().length, 1, 'same-anchor ACK loss reconciles the changed CAS revision without a duplicate write');
  assert.equal(owner.lastCommittedProgress.updatedAt, 2); assert.equal(owner.retainedReadingRecencyVisible, false);
  f.close(); cases.push(`retained-same-page-unknown-ACK-recovers-once/${sourceId}`);
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), reader = retainedReaderFixture(f), owner = reader.owner, gate = deferred();
  owner.windowChromeActive = true; owner.admitRetainedReadingRecency(); f.gates.push(gate);
  const writing = owner.commitVisiblePage(1);
  const rejected = assert.rejects(writing, /READING_PROGRESS_CHANGED/); await settle();
  f.change(40); gate.resolve(); await rejected;
  assert.equal(f.durable().chapterOffset, 40, 'CAS prevents the renewal overwriting a position changed after its baseline read');
  assert.equal(owner.lastCommittedProgress, reader.progress);
  assert.equal(owner.retainedReadingRecencyVisible, true, 'a rejected save keeps the existing retry boundary open');
  f.close(); cases.push(`retained-same-page-CAS-preserves-newer-position/${sourceId}`);
}
for (const sourceId of ['local', 'remote']) {
  for (const timing of ['before-baseline', 'during-baseline']) {
    for (const offset of [40, 10]) {
      const f = fixture(sourceId), reader = retainedReaderFixture(f), owner = reader.owner;
      owner.windowChromeActive = true; owner.admitRetainedReadingRecency();
      if (timing === 'before-baseline') f.change(offset);
      else {
        const gate = deferred(); f.readGates.push(gate);
        const pending = owner.commitVisiblePage(1);
        await settle(); f.change(offset); gate.resolve(); await pending;
      }
      if (timing === 'before-baseline') await owner.commitVisiblePage(1);
      assert.equal(f.writes().length, 0, 'retained renewal cannot borrow a baseline from a newer Core receipt');
      assert.equal(f.durable().chapterOffset, offset); assert.equal(f.durable().updatedAt, 2);
      assert.equal(owner.lastCommittedProgress, reader.progress, 'foreign receipt is not published as this visit');
      assert.equal(reader.gateway.pendingPresentedProgress(),undefined);
      owner.exitRequested=true; await owner.finishExit(1);
      assert.deepEqual(reader.events,['exit'],'optional refusal cannot block the actual exit');
      assert.equal(reader.alerts.length,0);
      f.close(); cases.push(`retained-origin-receipt-changed/${sourceId}/${timing}/${offset}`);
    }
  }
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), reader = retainedReaderFixture(f), owner = reader.owner;
  f.runtime.supportsCoreCapability = () => false;
  owner.windowChromeActive = true; owner.admitRetainedReadingRecency();
  owner.exitRequested=true; await owner.finishExit(1);
  assert.deepEqual(reader.events,['exit']); assert.equal(reader.alerts.length,0);
  assert.equal(f.writes().length, 0, 'a legacy runtime cannot safely renew over potentially late writes');
  f.close(); cases.push(`retained-renewal-requires-Core-CAS/${sourceId}`);
}
for (const sourceId of ['local', 'remote']) {
  for (const failure of ['device-identity-IO','baseline-read','missing-original-revision','same-second-same-position','formal-Core-CAS-refusal','transaction-pending']) {
    if (sourceId==='local' && failure==='transaction-pending') continue; // local sessions cannot own source-switch transactions.
    const f=fixture(sourceId), reader=retainedReaderFixture(f), owner=reader.owner;
    owner.windowChromeActive=true; owner.admitRetainedReadingRecency();
    if(failure==='device-identity-IO') owner.readingRecordGateway.currentDeviceId=async()=>{throw Error('Preferences unavailable');};
    if(failure==='baseline-read') f.readEffects.push('reject');
    if(failure==='missing-original-revision') reader.progress.progressRevision=undefined;
    if(failure==='same-second-same-position') f.sameSecondChange();
    if(failure==='formal-Core-CAS-refusal') f.effects.push('core-cas-rejected');
    if(failure==='transaction-pending') { const transaction=f.gateway('tx'); owner.activeGateway=()=>transaction; owner.sessionGateway=transaction; }
    owner.exitRequested=true; await owner.finishExit(1);
    assert.deepEqual(reader.events,['exit'],`${failure}: actual exit must not depend on optional recency`);
    assert.equal(reader.alerts.length,0,`${failure}: no unsaved-body warning for a proven-unsent renewal`);
    assert.equal(f.writes().length,failure==='formal-Core-CAS-refusal'?1:0);
    assert.equal(owner.lastCommittedProgress,reader.progress,'a skip is not a fabricated ACK or a foreign receipt admission');
    assert.equal(owner.retainedReadingRecencyReceipt,undefined); assert.equal(owner.retainedReadingRecencyVisible,false);
    assert.equal(owner.retainedReadingRecencySkipped,true,'unverified RAM presentation is not retained for another visit');
    assert.equal(reader.gateway.pendingPresentedProgress(),undefined);
    assert.equal(await reader.gateway.awaitPresentedProgressPersistence(),undefined,'no failed active remains to block another exit');
    f.close(); cases.push(`retained-optional-refusal-safe-real-exit/${sourceId}/${failure}`);
  }
  {
    const f=fixture(sourceId),reader=retainedReaderFixture(f),owner=reader.owner,gate=deferred();
    owner.windowChromeActive=true;owner.admitRetainedReadingRecency();
    const boundary=reader.gateway.runProgressCommitSerial(async()=>{await gate.promise;});await settle();
    owner.exitRequested=true;await owner.finishExit(1);gate.resolve();await boundary;
    assert.deepEqual(reader.events,['exit']);assert.equal(reader.alerts.length,0);
    assert.equal(f.writes().length,0);assert.equal(reader.gateway.pendingPresentedProgress(),undefined);
    f.close();cases.push(`retained-serial-boundary-safe-real-exit/${sourceId}`);
  }
  {
    const f=fixture(sourceId),reader=retainedReaderFixture(f),owner=reader.owner,gate=deferred();
    owner.windowChromeActive=true;owner.admitRetainedReadingRecency();f.gates.push(gate);
    const writing=owner.commitVisiblePage(1);await settle();owner.appForeground=false;gate.resolve();await writing;
    assert.equal(f.writes().length,1);assert.equal(owner.lastCommittedProgress,reader.progress,'background ACK has no current UI authority');
    owner.appForeground=true;owner.exitRequested=true;await owner.finishExit(1);
    assert.deepEqual(reader.events,['exit']);assert.equal(reader.alerts.length,0);assert.equal(f.writes().length,1);
    assert.equal(owner.lastCommittedProgress,reader.progress,'later skip cannot borrow the durable background row as its own ACK');
    f.close();cases.push(`retained-background-ACK-return-safe-real-exit/${sourceId}`);
  }
  {
    const f=fixture(sourceId),reader=retainedReaderFixture(f),owner=reader.owner;
    owner.windowChromeActive=true;owner.admitRetainedReadingRecency();f.effects.push('lost');
    owner.exitRequested=true;await owner.finishExit(1);
    assert.deepEqual(reader.events,['exit']);assert.equal(reader.alerts.length,0,'an unknown ACK cannot open a navigation-blocking modal');
    assert.deepEqual(reader.notices,['部分阅读记录保存尚未确认']);
    assert.equal(f.writes().length,1);assert.notEqual(reader.gateway.pendingPresentedProgress(),undefined);
    assert.equal(owner.lastCommittedProgress,reader.progress,'leaving is not a fabricated save receipt');
    const recovered=await reader.gateway.awaitPresentedProgressPersistence();
    assert.equal(recovered.progressRevision,'op:2');assert.equal(f.writes().length,1,'background receipt inspection does not repeat the write');
    assert.deepEqual(reader.events,['exit'],'background recovery cannot re-enter or repeat navigation');
    f.close();cases.push(`retained-dispatched-unknown-ACK-nonblocking-exit-preserves-recovery/${sourceId}`);
  }
  {
    const f=fixture(sourceId),reader=retainedReaderFixture(f),owner=reader.owner;
    owner.windowChromeActive=true;owner.admitRetainedReadingRecency();owner.visiblePage={startScalar:40,endScalar:50};f.effects.push('reject');
    owner.exitRequested=true;await owner.finishExit(1);
    assert.deepEqual(reader.events,['exit']);assert.equal(reader.alerts.length,0,'failed changed-page persistence is reported without blocking the requested exit');
    assert.deepEqual(reader.notices,['部分阅读记录保存尚未确认']);
    assert.equal(f.writes().length,1);assert.notEqual(reader.gateway.pendingPresentedProgress(),undefined);
    assert.equal(owner.lastCommittedProgress,reader.progress,'a weak notice cannot manufacture durable progress');
    assert.equal(f.durable().chapterOffset,10,'a rejected write preserves the confirmed stored position');
    f.close();cases.push(`ordinary-changed-position-error-retained-with-nonblocking-exit/${sourceId}`);
  }
}
// Keep the exact former same-position early return as a negative control.
// The unchanged real method now has to dispatch one renewal for the same input.
{
  const method = tree.statements.find(node => node.name?.getText(tree) === 'ReadingExperience').members
    .find(node => node.name?.getText(tree) === 'commitVisiblePage').getText(tree);
  const former = method.replace('if (sameCommittedPosition && !renewRetainedReading) return;',
    'if (sameCommittedPosition) return;');
  assert.notEqual(former, method, 'negative control must actually remove the renewal exception');
  const Former = new Function('CoreReadingAnchor', 'hilog',
    stripTypeScriptTypes(`class Former { ${former} }`) + ';return Former;')(dto.CoreReadingAnchor, { error() {} });
  const f = fixture(), reader = retainedReaderFixture(f), owner = reader.owner;
  owner.windowChromeActive = true; owner.admitRetainedReadingRecency();
  await Former.prototype.commitVisiblePage.call(owner, 1);
  assert.equal(f.writes().length, 0, 'the former real early return demonstrably loses this visit');
  await owner.commitVisiblePage(1);
  assert.equal(f.writes().length, 1, 'the current actual method renews the same visible visit');
  f.close(); cases.push('negative-control/former-retained-same-page-deduplication');
}
for (const sourceId of ['local', 'remote']) {
  for (const retired of ['foreground', 'window', 'identity', 'page', 'selection', 'receipt', 'unmount']) {
    const f = fixture(sourceId), reader = retainedReaderFixture(f), owner = reader.owner, gate = deferred();
    owner.windowChromeActive = true; owner.admitRetainedReadingRecency();
    owner.readingRecordGateway.currentDeviceId = async () => { await gate.promise; return 'harmony-current-device'; };
    const pending = owner.commitVisiblePage(1); await settle();
    if (retired === 'foreground') owner.appForeground = false;
    if (retired === 'window') owner.windowChromeActive = false;
    if (retired === 'identity') owner.isReaderIdentityCurrent = () => false;
    if (retired === 'page') owner.visiblePage = { ...owner.visiblePage, startScalar: 40 };
    if (retired === 'selection') owner.chapterSelectionToken++;
    if (retired === 'receipt') owner.lastCommittedProgress = { ...reader.progress, updatedAt: 2 };
    if (retired === 'unmount') owner.mounted = false;
    gate.resolve(); await pending;
    assert.equal(f.calls.length, 0, `${retired}: delayed device identity cannot admit a retired renewal`);
    assert.equal(f.durable().updatedAt, 1);
    f.close(); cases.push(`retained-device-identity-wait-retirement/${sourceId}/${retired}`);
  }
  for (const deviceId of ['', '   ']) {
    const f = fixture(sourceId), gateway = f.gateway();
    await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', { ...anchor(20), deviceId }, layout), /deviceId/);
    assert.equal(f.writes().length, 0, 'blank optional identity is rejected by actual local/remote command adapters');
    f.close(); cases.push(`retained-blank-device-rejected/${sourceId}/${deviceId.length}`);
  }
  {
    const f = fixture(sourceId), gateway = f.gateway();
    await gateway.persistPresentedProgress('book', 'ordinary page', anchor(20), layout);
    assert.equal(Object.hasOwn(f.writes()[0].params, 'deviceId'), false,
      'ordinary progress preserves its existing no-explicit-device command shape');
    f.close(); cases.push(`ordinary-progress-optional-device-omitted/${sourceId}`);
  }
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), gateway = f.gateway();
  await assert.rejects(gateway.persistPresentedProgress('book', 'retired before dispatch', anchor(20), layout, () => false), /SUPERSEDED/);
  assert.equal(f.calls.length, 0, 'a refused UI admission does not read or dispatch');
  let admitted = true; const gate = deferred(); f.readGates.push(gate);
  const pending = gateway.persistPresentedProgress('book', 'retired during baseline', anchor(20), layout, () => admitted);
  await settle(); assert.equal(f.calls.length, 1); admitted = false; gate.resolve();
  await assert.rejects(pending, /SUPERSEDED/);
  assert.equal(f.writes().length, 0, 'the real gateway checks admission again after the native baseline read');
  assert.equal(gateway.pendingPresentedProgress(), undefined);
  f.close(); cases.push(`UI-admission-before-native-dispatch/${sourceId}`);
}
for (const sourceId of ['local', 'remote']) {
  for (const effect of ['ack', 'lost']) {
    const f = fixture(sourceId), gateway = f.gateway(); let admitted = true;
    const gate = deferred(); f.gates.push(gate); if (effect === 'lost') f.effects.push(effect);
    const pending = gateway.persistPresentedProgress('book', 'accepted exit-visible', anchor(20), layout, () => admitted);
    await settle(); assert.equal(f.writes().length, 1); admitted = false; gate.resolve();
    if (effect === 'lost') {
      await assert.rejects(pending, /receipt lost/);
      assert.equal(gateway.pendingPresentedProgress().progress.chapterOffset, 20,
        'retirement cannot discard an already-dispatched unknown intent');
      assert.equal((await gateway.awaitPresentedProgressPersistence()).chapterOffset, 20);
    } else {
      assert.equal((await pending).chapterOffset, 20);
    }
    assert.equal(f.durable().chapterOffset, 20, 'UI retirement does not cancel accepted durable position');
    assert.equal(f.writes().length, 1, 'lost ACK is read-confirmed with the real CAS revision, never blindly rewritten');
    assert.equal(gateway.pendingPresentedProgress(), undefined);
    f.close(); cases.push(`dispatched-UI-retirement-preserves-durable-${effect}/${sourceId}`);
  }
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), gateway = f.gateway();
  const restored = await gateway.loadProgress('book');
  assert.equal(restored.kind, 'restored');
  assert.equal(restored.progressRevision, 'op:1', 'the shared gateway retains the Core operation revision');
  assert.equal(restored.progress.progressRevision,'op:1','the retained Host DTO preserves the exact original operation receipt');
  assert.equal(restored.progress.locationRevision, 'r1', 'the location revision is a separate receipt');
  const written=await gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout);
  assert.equal(written.progressRevision,'op:2','the exact update ACK operation revision survives the local/remote Host projection');
  assert.equal(f.writes()[0].params.expectedProgressRevision, 'op:1', 'CAS compares the operation revision, not the location revision');
  const stored = await gateway.loadProgress('book');
  assert.equal(stored.progressRevision, 'op:2');
  assert.equal(stored.progress.chapterOffset, 20);
  f.close(); cases.push(`durable-operation-revision-and-CAS/${sourceId}`);
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), gateway = f.gateway(); f.readEffects.push('reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout), /baseline read failure/);
  assert.equal(f.writes().length, 0, 'prerequisite failure is provably before write dispatch');
  const stored = await gateway.awaitPresentedProgressPersistence();
  assert.equal(stored.chapterOffset, 20); assert.equal(f.writes().length, 1);
  assert.equal(gateway.pendingPresentedProgress(), undefined);
  f.close(); cases.push(`prewrite-read-recovery/${sourceId}`);
}
{
  const f = fixture(), gateway = f.gateway(); f.readEffects.push('reject', 'reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout), /baseline read failure/);
  await assert.rejects(gateway.awaitPresentedProgressPersistence(), /baseline read failure/);
  assert.equal(f.writes().length, 0);
  assert.equal((await gateway.awaitPresentedProgressPersistence()).chapterOffset, 20);
  assert.equal(f.writes().length, 1); f.close(); cases.push('repeated-prewrite-read-failure-can-recover');
}
{
  const f = fixture(), gateway = f.gateway(); f.readEffects.push('reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'old', anchor(20), layout), /baseline read failure/);
  const gate = deferred(); f.readGates.push(gate);
  const boundary = gateway.awaitPresentedProgressPersistence(); await settle();
  const reopened = f.gateway();
  const newer = reopened.persistPresentedProgress('book', 'new displayed position', anchor(40), layout);
  gate.resolve(); await Promise.all([boundary, newer]);
  assert.deepEqual(f.writes().map(call => call.params.chapterOffset), [40], 'a superseded unsent save does not write its old anchor');
  assert.equal(f.durable().chapterOffset, 40); f.close(); cases.push('new-displayed-position-during-prewrite-recovery');
}
for (const sourceId of ['local', 'remote']) {
  const f = fixture(sourceId), old = f.gateway(), gate = deferred(); f.gates.push(gate);
  const write = old.persistPresentedProgress('book', 'chapter', anchor(20), layout); await settle();
  assert.equal(f.writes().length, 1);
  const writeOptions = f.writes()[0].options;
  assert.equal(writeOptions.canContinue?.() ?? !writeOptions.shouldCancel?.(), true,
    'an ordinary progress mutation must not invalidate its own content lease');
  if (sourceId === 'remote') assert.equal(writeOptions.shouldCancel, undefined, 'remote durable writes only use admission before SDK entry');
  const reopened = f.gateway(), pending = await reopened.loadProgress('book');
  assert.equal(pending.presentationPending, true); assert.equal(pending.progress.chapterOffset, 20);
  assert.equal(pending.progress.locationRevision, undefined, 'in-process intent is never fabricated as a durable receipt');
  assert.equal(f.durable().chapterOffset, 10);
  let newerStarted = false;
  const later = reopened.runProgressCommitSerial(async () => {
    newerStarted = true; await reopened.resolveAndUpdateProgress('book', 'chapter', anchor(30), layout, () => true);
  });
  await settle(); assert.equal(newerStarted, false, 'new gateway shares the old in-flight write lane');
  gate.resolve(); await Promise.all([write, later]);
  assert.equal((await reopened.loadProgress('book')).progress.chapterOffset, 30);
  assert.equal(reopened.pendingPresentedProgress(), undefined); f.close(); cases.push(`rebuild/shared-lane/${sourceId}`);
}
for (const effect of ['lost', 'reject']) {
  const f = fixture(), gateway = f.gateway(); f.effects.push(effect);
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout));
  assert.equal(gateway.pendingPresentedProgress().progress.chapterOffset, 20);
  const receipt = await gateway.awaitPresentedProgressPersistence();
  assert.equal(receipt.chapterOffset, 20); assert.equal(f.writes().length, effect === 'lost' ? 1 : 2);
  assert.equal(f.calls.at(effect === 'lost' ? -1 : -2).method, 'reading.progress.get', 'always read Core before retry');
  assert.equal(gateway.pendingPresentedProgress(), undefined); f.close(); cases.push(`unknown-reconcile/${effect}`);
}
{
  const f = fixture(), gateway = f.gateway(); f.effects.push('reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout));
  f.change(40);
  await assert.rejects(gateway.awaitPresentedProgressPersistence(), /RETRY_CONFLICT/);
  assert.equal(f.writes().length, 1); assert.equal(f.durable().chapterOffset, 40); f.close(); cases.push('conflicting-core-never-overwritten');
}
{
  const f = fixture(), gateway = f.gateway(); f.effects.push('reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout));
  const gate = deferred(); f.readGates.push(gate);
  const boundary = gateway.awaitPresentedProgressPersistence();
  const rejected = assert.rejects(boundary, /RETRY_CONFLICT/); await settle();
  f.change(40); gate.resolve(); await rejected;
  assert.equal(f.writes().length, 1); assert.equal(f.durable().chapterOffset, 40);
  f.close(); cases.push('Core-position-changed-during-uncertain-write-recovery-read');
}
for (const mutation of ['replace-rule.update', 'replace.undo', 'runtime-close']) {
  const f = fixture(), gateway = f.gateway(), gate = deferred(); f.gates.push(gate);
  const writing = gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout); await settle();
  if (mutation === 'runtime-close') f.close(); else f.preparation.beginRequest(mutation, {});
  assert.equal(gateway.pendingPresentedProgress(), undefined);
  assert.equal(f.writes()[0].options.shouldCancel(), true); gate.resolve(); await assert.rejects(writing);
  assert.equal(f.durable().chapterOffset, 10); f.close(); cases.push(`invalidation/${mutation}`);
}
{
  const f = fixture('remote'), gateway = f.gateway(), gate = deferred(); f.gates.push(gate);
  const write = gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout); await settle();
  const transaction = f.gateway('tx');
  assert.equal(transaction.pendingPresentedProgress(), undefined);
  assert.equal((await transaction.loadProgress('book')).progress.chapterOffset, 10);
  assert.throws(() => transaction.persistPresentedProgress('book', 'chapter', anchor(20), layout), /TRANSACTION_PENDING/);
  gate.resolve(); await write; f.close(); cases.push('source-switch-cannot-use-ordinary-intent');
}
{
  const f = fixture(), gateway = f.gateway(), gate = deferred(); f.gates.push(gate);
  const writing = gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout); await settle();
  const reopened = f.gateway(), opened = [];
  const Owner = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
    ['loadInitialChapter'], { LOCAL_READING_SOURCE_ID: 'local' });
  const owner = Object.assign(new Owner(), { sourceId: 'local', bookId: 'book', chapterSelectionToken: 2,
    preparedReadingEntry: { isCurrent: () => true, toc: { entries: [{ index: 1 }, { index: 2 }] },
      progress: { kind: 'restored', progress: { ...anchor(10), chapterIndex: 1 } }, chapter: { chapterIndex: 1 } },
    isSelectionActive: () => true, activeGateway: () => reopened, sessionGateway: reopened,
    admitTocEntries(entries) { this.tocEntries = entries; }, onDirectoryProjectionChanged() {},
    readingTocEntries() { return this.tocEntries; }, chapterWindow: { configure() {} },
    normalizedRequestedChapter: () => undefined, requireKnownChapter: index => index,
    async openChapter(index) { opened.push({ index, progress: this.restoredProgress }); }, fail: error => { throw error; } });
  await owner.loadInitialChapter(1, Promise.resolve([]));
  assert.equal(opened[0].index, 2); assert.equal(opened[0].progress.progress.chapterOffset, 20);
  assert.equal(opened[0].progress.presentationPending, true);
  assert.equal(owner.preparedReadingEntry, undefined, 'old prepared body cannot bypass the newer displayed anchor');
  gate.resolve(); await writing; f.close(); cases.push('LRE-prepared-A-yields-to-shared-pending-B');
}
// Invoke the production LRE boundary with the real gateway's unknown-write
// recovery. This is the same helper called by normal exit and content mutation.
for (const failure of ['lost-receipt', 'prewrite-read']) {
  const f = fixture(), gateway = f.gateway();
  if (failure === 'lost-receipt') f.effects.push('lost'); else f.readEffects.push('reject');
  await assert.rejects(gateway.persistPresentedProgress('book', 'chapter', anchor(20), layout));
  const Owner = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
    ['awaitOrdinaryFirstPagePersistence', 'isOrdinaryFirstPagePresentationCurrent']);
  const owner = Object.assign(new Owner(), { lifecycleToken: 1, chapterSelectionToken: 2, visiblePageSelectionToken: 2,
    visiblePage: { startScalar: 20 }, chapter: { chapterIndex: 2 }, sessionGateway: gateway,
    isMountedToken: token => token === 1, isReaderIdentityCurrent: () => true,
    admitCommittedProgress(stored) { this.lastCommittedProgress = stored; } });
  await owner.awaitOrdinaryFirstPagePersistence();
  assert.equal(owner.lastCommittedProgress.chapterOffset, 20); assert.equal(f.writes().length, 1);
  f.close(); cases.push(`exit/content-boundary-admits-reconciled-receipt/${failure}`);
}
console.log(JSON.stringify({ passed: true, scenarios: cases.length, cases,
  boundary: 'Actual preparation fences, shared session owner, local/remote gateway commands, serial queue and LRE persistence boundary; controlled Core I/O, no device paint claim.' }));
