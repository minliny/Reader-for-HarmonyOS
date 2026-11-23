import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { bookmarkFixture, cleanupDurableFixtures, until, deferred } from './lib/reading-operation-durable-probe.mjs';
import { actualReaderDirectoryJourney } from './lib/reader-directory-operations-probe.mjs';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const { EMPTY_READING_DIRECTORY_RECOVERY } = await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');

const definitions = {
  'native-fixture': { description: 'Independent production original-record owner with finite memory gateway and actual SDK fixture/surface admission, single-flight, unavailable/confirmed and retired callbacks', resources: [] },
  metadata: { description: 'V1 missing metadata remains legal, provided malformed values fail closed, raw context guard stays exact', resources: [] },
  create: { description: 'Legacy create uses only immutable original DTO metadata, exact entity scope and original context/query', resources: [] },
  delete: { description: 'Legacy delete uses independent exact original operation owner, no continuation/current-book result, stale/busy/runtime guards', resources: [] },
  classification: { description: 'Actual serialized reconciliation distinguishes qualified notDispatched cleanup from absent or replaced intent without inferring ACK from undefined', resources: [] },
  ui: { description: 'Explicit reading recovery entry and original-record SDK action, independent busy/current/retired guards and observed revision', resources: [] },
};
const originalBook = { sourceId: 'local', sourceName: '本地', bookId: 'old-book', title: '原书', author: '作者' };
const currentBook = { sourceId: 'other', sourceName: '当前书源', bookId: 'current-book', title: '当前书', author: '当前作者' };
const operationId = '12345678-1234-4234-8123-000000000001/1';
function legacy(method = 'bookmark.delete', context = { sourceId: originalBook.sourceId, bookId: originalBook.bookId }) {
  const params = method === 'bookmark.delete' ? { time: 23, operationId, sequence: 1 } : {
    bookName: originalBook.title, bookAuthor: originalBook.author, chapterIndex: 0, chapterPos: 12,
    chapterName: '第一章', bookText: '正文', operationId, sequence: 1,
  };
  return { version: 1, method, params, context, phase: 'pending' };
}
function finiteTransport(intent, { receiptAvailable = true } = {}) {
  const calls = [];
  const binding = { operationId: intent.params.operationId, sequence: intent.params.sequence,
    payloadFingerprint: createHash('sha256').update(JSON.stringify(intent.params)).digest('hex') };
  const result = intent.method === 'bookmark.delete' ? { time: intent.params.time, deleted: true } : {
    bookmark: { ...intent.params, time: 23, content: intent.params.bookText },
  };
  let receipt = { binding, phase: 'committed', outcome: { action: intent.method === 'bookmark.delete' ? 'delete' : 'create', result } };
  const state = { calls, available: receiptAvailable, listUnavailable: false, pause: undefined, onQuery: undefined, async command(method, params) {
    calls.push({ method, params: structuredClone(params) });
    if (method === 'bookmark.list') {
      if (state.listUnavailable) throw new Error('finite current list unavailable');
      return { data: { bookmarks: [] } };
    }
    if (method === 'bookmark.operation.query') {
      assert.equal(params.operationId, intent.params.operationId);
      assert.deepEqual(params.expected, { action: intent.method === 'bookmark.delete' ? 'delete' : 'create', params: intent.params });
      state.onQuery?.();
      if (state.pause) await state.pause.promise;
      return { data: { head: binding, receipt: state.available ? receipt : null } };
    }
    assert.equal(method, 'bookmark.operation.settle', 'recovery must never dispatch a bookmark mutation');
    assert.deepEqual(params, binding);
    receipt = { ...receipt, phase: 'settled' };
    return { data: { binding, phase: 'settled' } };
  } };
  return state;
}
async function cold(intent, options) {
  const transport = finiteTransport(intent, options);
  const fixture = await bookmarkFixture(true, undefined, transport.command);
  writeFileSync(join(fixture.files, 'reader-bookmark-intent-v1.json'), JSON.stringify(intent));
  return Object.assign(fixture, { transport });
}
function consumer(fixture, book = currentBook) {
  const Entry = actualReadingEntryPresentation();
  const entry = new Entry();
  Object.assign(entry, { book: { ...book }, sessionActive: true, sessionGeneration: 7,
    toc: [{ index: 0, title: '第一章', navigable: true, bookmarks: [] }], scopeId: 1 });
  const route = { route: 'reading', generation: 3 };
  const scope = { owner: fixture.runtime, mount: 2, retired: false, foreground: true, covered: false };
  const feedback = [];
  const Journey = actualReaderDirectoryJourney({ ReaderDirectoryHost: fixture.Directory, ...fixture.types });
  const journey = new Journey({ snapshot: () => route }, { scope: () => scope, ownsRuntime: owner => fixture.Runtime.isCurrent(owner),
    runtime: () => undefined, entry: () => entry, shelfBooks: () => [], feedback: value => feedback.push(value), diagnostic() {} });
  const operations = journey.operations;
  const load = () => operations.loadControlBookmarks(book.sourceId, book.bookId, () => true);
  const recovery = () => operations.recovery(entry.directoryOperation, entry.offlineOperation, entry.bookmarkRecoveryRevision);
  return { entry, route, scope, operations, load, recovery, feedback };
}
function writes(fixture) {
  return fixture.transport.calls.filter(call => ['bookmark.create', 'bookmark.delete'].includes(call.method));
}
async function runMetadata() {
  const f = await cold(legacy());
  assert.deepEqual((await f.bookmarkStore.pending()).context, legacy().context);
  await assert.rejects(f.bookmarkStore.reconcile({ ...legacy().context, title: originalBook.title, author: originalBook.author }, () => {}, () => true),
    /另一实体/, 'raw four-field context comparison remains exact');
  assert.equal(f.transport.calls.length, 0);
  await assert.rejects(f.bookmarkStore.execute('bookmark.delete', { time: 1 }, { ...legacy().context, title: 5 },
    () => {}, undefined, () => true), /上下文格式无效/);
  assert.equal(f.transport.calls.length, 0, 'invalid new metadata cannot reach head query or persistence');
  for (const value of [null, 5, {}, []]) for (const field of ['title', 'author']) {
    const invalid = await cold(legacy('bookmark.delete', { ...legacy().context, [field]: value }));
    await assert.rejects(invalid.bookmarkStore.pending(), /身份\/内容无效/);
    assert.equal(invalid.disk('bookmark'), JSON.stringify(legacy('bookmark.delete', { ...legacy().context, [field]: value })));
    assert.equal(invalid.transport.calls.length, 0);
  }
}
async function runCreate() {
  const raw = legacy('bookmark.create');
  const f = await cold(raw);
  const c = consumer(f, originalBook);
  await c.load();
  assert.equal(f.directory.snapshot().projection.receipt.confirmation, 'confirmed');
  assert.deepEqual(f.directory.snapshot().book, c.entry.book);
  assert.equal(f.disk('bookmark'), '');
  assert.equal(writes(f).length, 0);
  const unknown = await cold(raw, { receiptAvailable: false });
  const u = consumer(unknown, originalBook); await u.load();
  assert.equal(unknown.directory.snapshot().canContinueOriginal, false);
  assert.deepEqual(JSON.parse(unknown.disk('bookmark')), raw, 'legacy query cannot rewrite original context/payload');
  const before = unknown.transport.calls.length;
  await unknown.directory.continueOriginal(unknown.directory.snapshot().generation, unknown.dirBinding);
  assert.equal(unknown.transport.calls.length, before);
  for (const book of [{ ...originalBook, title: '同ID异名' }, { ...originalBook, author: '另一作者' }, currentBook]) {
    const mismatched = await cold(raw); const m = consumer(mismatched, book); await m.load();
    assert.equal(mismatched.directory.snapshot(), undefined);
    assert.equal(mismatched.transport.calls.some(call => call.method === 'bookmark.operation.query'), false);
    assert.equal(m.recovery().bookmarks.visible, false);
    assert.match(m.recovery().bookmarkWriteBlockReason, /原书/);
  }
}
async function runDelete() {
  const raw = legacy(); const f = await cold(raw); const c = consumer(f);
  await c.load();
  const before = c.entry.bookmarkRecoveryRevision;
  const projection = c.recovery();
  assert.equal(projection.bookmarks.visible, false);
  assert.equal(c.entry.directoryOperation, undefined);
  assert.ok(projection.originalBookmarks);
  assert.match(projection.bookmarkWriteBlockReason, /当前阅读页/);
  const original = projection.originalBookmarks;
  assert.equal(await f.directory.continueOriginal(original.generation, c.operations.bookmarkBinding(f.runtime, currentBook)), false);
  assert.equal(await f.directory.reconcileOriginalBookmark(original.generation, 'wrong', c.operations.bookmarkBinding(f.runtime, currentBook)), 'rejected');
  const gate = deferred(); f.transport.pause = gate;
  c.operations.reconcileBookmarks(original.generation, projection.presentationId, false);
  await until(() => f.transport.calls.some(call => call.method === 'bookmark.operation.query'));
  assert.equal(c.recovery().originalBookmarks.busy, true);
  assert.ok(c.entry.bookmarkRecoveryRevision > before, 'same false admission still publishes original busy');
  c.operations.reconcileBookmarks(original.generation, projection.presentationId, false);
  gate.resolve(); await until(() => !f.directory.busy());
  assert.equal(f.transport.calls.filter(call => call.method === 'bookmark.operation.query').length, 1,
    'one exact query with successful settlement ACK; duplicate UI action is rejected');
  assert.equal(f.disk('bookmark'), ''); assert.equal(c.entry.directoryOperation, undefined);
  assert.equal(c.recovery().originalBookmarks, undefined);
  assert.equal(writes(f).length, 0);
  const count = f.transport.calls.length;
  c.operations.reconcileBookmarks(original.generation, projection.presentationId, false);
  assert.equal(f.transport.calls.length, count, 'old original generation cannot act after settlement');
  const readback = await cold(raw); const b = consumer(readback); await b.load();
  readback.transport.listUnavailable = true; const awaiting = b.recovery();
  b.operations.reconcileBookmarks(awaiting.originalBookmarks.generation, awaiting.presentationId, false);
  await until(() => !readback.directory.busy()); await until(() => b.feedback.length > 0);
  assert.equal(readback.disk('bookmark'), '', 'qualified original settlement survives a later canonical read failure');
  assert.equal(b.entry.directoryOperation, undefined);
  assert.equal(b.recovery().originalBookmarks, undefined, 'confirmed outcome leaves pending UI');
  assert.equal(readback.directory.bookmarkWriteEnabled(), false, 'stale canonical projection cannot admit new writes');
  assert.match(b.feedback.at(-1), /已核实.*读取失败/);
  const pending = await cold(raw, { receiptAvailable: false }); const p = consumer(pending); await p.load();
  const old = p.recovery(); p.operations.reconcileBookmarks(old.originalBookmarks.generation, old.presentationId, false);
  await until(() => !pending.directory.busy());
  assert.deepEqual(JSON.parse(pending.disk('bookmark')), raw);
  assert.equal(p.recovery().originalBookmarks.busy, false);
  assert.equal(p.entry.directoryOperation, undefined);
  const retired = await cold(raw); const r = consumer(retired); await r.load(); const visible = r.recovery();
  r.scope.retired = true;
  r.operations.reconcileBookmarks(visible.originalBookmarks.generation, visible.presentationId, false);
  assert.equal(retired.transport.calls.some(call => call.method === 'bookmark.operation.query'), false);
  const oldRuntime = await cold(raw); const stale = consumer(oldRuntime); await stale.load(); const snapshot = stale.recovery();
  oldRuntime.unset();
  stale.operations.reconcileBookmarks(snapshot.originalBookmarks.generation, snapshot.presentationId, false);
  assert.equal(oldRuntime.transport.calls.some(call => call.method === 'bookmark.operation.query'), false);
  const replaced = await cold(raw); const x = consumer(replaced); await x.load(); const oldRecord = x.recovery().originalBookmarks;
  const successor = { ...raw, params: { ...raw.params, operationId: operationId.replace('/1', '/2'), sequence: 2 } };
  // This private fixture replaces both the durable lane and disk as an external
  // original owner would. No production Runtime or real intent is touched.
  const next = await cold(successor); const n = consumer(next); await n.load();
  const binding = n.operations.bookmarkBinding(next.runtime, currentBook);
  assert.equal(await next.directory.reconcileOriginalBookmark(oldRecord.generation, oldRecord.identity, binding), 'rejected');
  await assert.rejects(next.bookmarkStore.reconcile(raw.context, () => {}, () => true, raw), /身份已变化/);
  assert.equal(next.transport.calls.some(call => call.method === 'bookmark.operation.query'), false,
    'the serialized store compares expected tuple before querying a replacement');
  const retiring = await cold(raw); const active = consumer(retiring); await active.load();
  const request = active.recovery(); const waiting = deferred(); retiring.transport.pause = waiting;
  active.operations.reconcileBookmarks(request.originalBookmarks.generation, request.presentationId, false);
  await until(() => retiring.transport.calls.some(call => call.method === 'bookmark.operation.query'));
  retiring.unset(); waiting.resolve(); await until(() => !retiring.directory.busy());
  assert.equal(retiring.transport.calls.some(call => call.method === 'bookmark.operation.settle'), false);
  assert.deepEqual(JSON.parse(retiring.disk('bookmark')), raw, 'retired Runtime cannot settle a pending exact query');
}
async function runClassification() {
  for (const phaseChanged of [false, true]) {
    const raw = { ...legacy(), phase: phaseChanged ? 'pending' : 'notDispatched' };
    const fixture = await cold(raw);
    const c = consumer(fixture); await c.load();
    const state = c.recovery().originalBookmarks;
    if (phaseChanged) {
      // A finite external local-abort port updates only the same original
      // tuple's phase. Host retains its previously captured pending snapshot.
      const current = await fixture.bookmarkStore.pending();
      current.phase = 'notDispatched';
      writeFileSync(join(fixture.files, 'reader-bookmark-intent-v1.json'), JSON.stringify(current));
    }
    const result = await fixture.directory.reconcileOriginalBookmark(state.generation, state.identity,
      c.operations.bookmarkBinding(fixture.runtime, currentBook));
    assert.equal(result, 'notDispatched', 'classification follows the actual serialized local-abort fact');
    assert.equal(fixture.disk('bookmark'), '');
    assert.equal(fixture.transport.calls.some(call => call.method === 'bookmark.operation.query' || call.method === 'bookmark.operation.settle'), false);
    assert.equal(writes(fixture).length, 0);
  }
  for (const replacement of [false, true]) {
    const fixture = await cold(legacy());
    const c = consumer(fixture); await c.load();
    const captured = c.recovery().originalBookmarks;
    const current = await fixture.bookmarkStore.pending();
    current.phase = 'notDispatched';
    writeFileSync(join(fixture.files, 'reader-bookmark-intent-v1.json'), JSON.stringify(current));
    const cleared = await fixture.bookmarkStore.reconcileResult(current.context, () => assert.fail('notDispatched has no Core result'),
      () => true, current);
    assert.equal(cleared.kind, 'notDispatched');
    const successor = { ...legacy(), params: { ...legacy().params,
      operationId: operationId.replace('/1', '/2'), sequence: 2 } };
    if (replacement) writeFileSync(join(fixture.files, 'reader-bookmark-intent-v1.json'), JSON.stringify(successor));
    const result = await fixture.directory.reconcileOriginalBookmark(captured.generation, captured.identity,
      c.operations.bookmarkBinding(fixture.runtime, currentBook));
    assert.equal(result, 'pending', 'absence or another original never supplies an ACK for this capture');
    assert.equal(fixture.disk('bookmark'), replacement ? JSON.stringify(successor) : '');
    if (replacement) assert.notEqual(fixture.directory.originalBookmarkRecovery().identity, captured.identity);
    assert.equal(fixture.transport.calls.some(call => call.method === 'bookmark.operation.query' || call.method === 'bookmark.operation.settle'), false);
    assert.equal(writes(fixture).length, 0);
  }
}
async function runUi() {
  const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryRecoverySurface.ets', import.meta.url), 'utf8');
  const sdk = boundedSurfaceSdk(); const calls = [];
  const original = { identity: 'original/1', generation: 7, busy: false, message: '旧版书签原操作记录缺少书名。' };
  const recovery = { ...EMPTY_READING_DIRECTORY_RECOVERY, presentationId: 'reader:1', originalBookmarks: original };
  const owner = sdk.consumer(source, boundedMembers(source), {}, { recovery,
    onReconcileBookmarks: (generation, presentation) => calls.push([generation, presentation]), onContinueBookmarks: () => assert.fail('legacy continuation') });
  owner.aboutToAppear(); owner.initialRender();
  const notice = sdk.walk(owner).find(actor => actor instanceof sdk.deps.ReaderRecoveryNotice);
  assert.equal(notice.tag, '原书签记录'); assert.equal(notice.actionLabel, '核对原记录'); assert.equal(notice.secondaryActionLabel, '');
  const action = sdk.nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '核对原记录');
  action.onClick(); assert.deepEqual(calls, [[7, 'reader:1']]);
  owner.recovery = { ...recovery, originalBookmarks: { ...original, busy: true } };
  action.onClick(); assert.equal(calls.length, 1);
  owner.recovery = { ...recovery, presentationId: 'reader:2' };
  action.onClick(); assert.equal(calls.length, 1);
  owner.aboutToDisappear(); action.onClick(); assert.equal(calls.length, 1);
  const lre = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url), 'utf8');
  const probe = createReaderBuilderProbe(lre, ['hasReaderRecoveryContent', 'hasReaderPendingGroup', 'readerBookmarkPending',
    'readerPreferenceModule', 'bookmarkRecoveryIdentity', 'reconcileBookmarkRecovery',
    'readerOfflineRecoveryVisible', 'readerOfflinePending'], {}).owner;
  Object.assign(probe, { readerRecoveryView: { visible: false }, readerSettingsRecovery: { visible: false }, ttsPreferencesRecovery: { visible: false },
    ttsConfigurationRecovery: { visible: false }, replaceRecovery: { visible: false }, bookmarkRecovery: recovery,
    lifecycleToken: 4, isSessionActive: () => true, isControlInputEnabled: () => true,
    controlLocation: () => ({ level: 'primary' }), onReconcileBookmarks: (g, p) => calls.push([g, p]), onContinueBookmarks: () => assert.fail('legacy continuation') });
  assert.equal(probe.hasReaderRecoveryContent(), true); assert.equal(probe.readerBookmarkPending(), true);
  const identity = probe.bookmarkRecoveryIdentity(); probe.reconcileBookmarkRecovery(identity, false);
  assert.deepEqual(calls.at(-1), [7, 'reader:1']);
  probe.reconcileBookmarkRecovery(identity, true); assert.equal(calls.length, 2);
  probe.bookmarkRecovery = { ...recovery, originalBookmarks: { ...original, identity: 'successor', generation: 8 } };
  probe.reconcileBookmarkRecovery(identity, false); assert.equal(calls.length, 2);
}
async function runNativeFixture() {
  const { ReaderLegacyBookmarkFixtureOwner } = await import('../entry/src/main/ets/pages/ReaderLegacyBookmarkFixtureOwner.ts');
  let current = true, changes = 0;
  const owner = new ReaderLegacyBookmarkFixtureOwner('native:1', () => current, () => { changes += 1; });
  await owner.load();
  const raw = owner.gateway.rawOriginal();
  const original = owner.recovery().originalBookmarks;
  assert.ok(original.message.includes('缺少书名或作者'));
  assert.deepEqual(JSON.parse(raw).context, { sourceId: 'legacy-memory', bookId: 'legacy-original' });
  assert.equal(owner.recovery().bookmarkWriteEnabled, false);
  const first = owner.reconcile(original.generation, 'native:1');
  await owner.reconcile(original.generation, 'native:1');
  assert.equal(owner.gateway.reconcileCount, 1);
  assert.equal(owner.recovery().originalBookmarks.busy, true);
  owner.complete(false); await first;
  assert.equal(owner.gateway.rawOriginal(), raw);
  assert.equal(owner.recovery().originalBookmarks.busy, false);
  await owner.reconcile(original.generation, 'obsolete');
  assert.equal(owner.gateway.reconcileCount, 1);
  const confirmed = owner.reconcile(original.generation, 'native:1');
  owner.complete(true); await confirmed;
  assert.equal(owner.gateway.rawOriginal(), '');
  assert.equal(owner.recovery().originalBookmarks, undefined);
  assert.equal(owner.runtime.unexpectedRequests, 0);
  assert.ok(changes > 0);
  owner.close(); current = false;
  await owner.reconcile(original.generation, 'native:1');
  assert.equal(owner.gateway.reconcileCount, 2);
  const sdk = boundedSurfaceSdk({ allowEmptyBranchAdmission: true });
  const fixtureSource = readFileSync(new URL('../entry/src/main/ets/pages/ReaderLegacyBookmarkRecoveryStructureFixture.ets', import.meta.url), 'utf8');
  const recoverySource = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryRecoverySurface.ets', import.meta.url), 'utf8');
  sdk.deps.EMPTY_READING_DIRECTORY_RECOVERY = EMPTY_READING_DIRECTORY_RECOVERY;
  sdk.childSources.ReaderDirectoryRecoverySurface = recoverySource;
  sdk.deps.ReaderDirectoryRecoverySurface = createReaderBuilderProbe(recoverySource, boundedMembers(recoverySource), sdk.deps, sdk.hooks).Component;
  for (const [debug, mode, fontsReady, allowed] of [[true, 'debug', true, true], [false, 'debug', true, false],
    [true, 'release', true, false], [true, 'debug', false, false]]) {
    const events = [], bridges = [];
    const page = sdk.consumer(fixtureSource, boundedMembers(fixtureSource), {
      DEBUG: debug, BUILD_MODE_NAME: mode, ReaderLegacyBookmarkFixtureOwner, EMPTY_READING_DIRECTORY_RECOVERY,
      hilog: { info(_domain, _tag, _format, raw) { events.push(JSON.parse(raw)); } },
      LengthMetrics: { vp: value => ({ value, unit: 'vp' }) }, FlexWrap: { Wrap: 'wrap' },
    }, { fontsReady, onTemporaryBackBridge: handler => bridges.push(handler) });
    page.aboutToAppear(); page.initialRender();
    assert.equal(sdk.nodes(page).some(node => node.id === 'reader-legacy-open'), allowed);
    if (allowed) {
      sdk.nodes(page).find(node => node.id === 'reader-legacy-open').onClick();
      await until(() => page.owner?.recovery().originalBookmarks !== undefined);
      sdk.properties.flush();
      const action = sdk.nodes(page).find(node => node.type === 'Button' && node.accessibilityText === '核对原记录');
      assert.ok(action);
      action.onClick(); action.onClick(); sdk.properties.flush();
      assert.equal(page.owner.gateway.reconcileCount, 1);
      const complete = sdk.nodes(page).find(node => node.id === 'reader-legacy-unavailable');
      assert.equal(complete.enabled, true, 'actual owner revision updates the finite receipt controls');
      complete.onClick(); await until(() => page.owner.recovery().originalBookmarks?.busy === false);
      // The finite probe does not model removal of the native busy branch.
      // Check parent control updates here; actual child removal is native evidence.
      sdk.properties.flush(actor => actor === page);
      assert.equal(sdk.nodes(page).find(node => node.id === 'reader-legacy-unavailable').enabled, false);
      const stale = action.onClick;
      sdk.nodes(page).find(node => node.id === 'reader-legacy-open').onClick();
      await until(() => page.owner.recovery().originalBookmarks !== undefined); sdk.properties.flush(actor => actor === page);
      stale(); assert.equal(page.owner.gateway.reconcileCount, 0);
      assert.equal(bridges[0](), true);
      assert.equal(page.opened, false);
      assert.ok(events.every(event => event.unexpectedRequests === 0));
    }
    page.aboutToDisappear();
  }
}
try {
  for (const id of selectContractCases(definitions)) {
    await ({ metadata: runMetadata, create: runCreate, delete: runDelete, classification: runClassification, ui: runUi, 'native-fixture': runNativeFixture })[id]();
    recordContractCasePass(id);
  }
} finally { await cleanupDurableFixtures(); }
