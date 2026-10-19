import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'host-lifecycle':{description:'Actual SDK Host reopen/import/reload, old generation and internal-owner regressions',resources:[]},
 'cold-recovery':{description:'Actual existing CLI/atomic journal original receipt recovery and SDK physical recovery actor',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const { installContentSearchOwnerProbe }=await import('./lib/reader-content-search-owner-probe.mjs');
const { installReaderLayoutOwners }=await import('./lib/reader-measurement-owner-fixture.mjs');
const {default:assert}=await import('node:assert/strict');
const { readFileSync }=await import('node:fs');
const { registerHooks, stripTypeScriptTypes }=await import('node:module');
const resolution=registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(specifier + '.ts', context);
    throw error;
  }
} });
const {cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
try {
console.log(JSON.stringify({kind:'reader-existing-tool-evidence',...durableFixtureToolEvidence()}));
const { readerReplaceSdkFixture, compileReaderReplaceSdkMethods, untilReaderReplaceSdk, mountReaderReplaceRecoveryActor } = await import('./lib/reader-replace-legacy-sdk-probe.mjs');
const actualSdk = await readerReplaceSdkFixture();
const RulesMutationOwner = actualSdk.Owner;
let activeRuntime;
const statePolicy = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const quickPolicy = await import('../entry/src/main/ets/features/reading/ReaderReplaceQuickState.ts');
const ReaderControlReplaceGatewayError = actualSdk.FullError;
const { copyReaderControlSessionState } =
  await import('../entry/src/main/ets/features/reading/ReaderControlSessionState.ts');
const {readerControlHostClosing}=await import('../entry/src/main/ets/features/reading/ReaderControlHostSession.ts');
// This exact platform module contains only type imports; execute its real body.
const { ReaderContentSearchPublication } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(
  readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderContentSearchPublication.ets', import.meta.url), 'utf8'))));
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',
  import.meta.url), 'utf8');
const names = ['openQuickReplace', 'controlReplaceCurrent', 'reloadControlReplace', 'runControlReplaceMutation',
  'readerReplaceRuntimeCurrent', 'projectReaderReplaceWriteFacts', 'beginReplaceMutation', 'isReplaceMutationCurrent', 'finishReplaceMutation', 'invalidateReplaceMutationOwner',
  'onControlSessionChanged','admitSessionControlClosing','publishQuickSearchState'];
function method(name) {
  const match = new RegExp('  private (?:async )?' + name + '\\(').exec(source);
  assert.ok(match, 'real Host method ' + name);
  const open = source.indexOf('{', match.index);
  let depth = 1, end = open + 1;
  while (depth > 0 && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0);
  return source.slice(match.index, end);
}
const deps = { ReaderRuntimeOwner: { current: () => activeRuntime }, ...statePolicy, ...quickPolicy, copyReaderControlSessionState, ReaderControlReplaceGatewayError, readerControlHostClosing,
  readerControlContentLocation: session => session.location,
  readerControlHostCloseCommitted: (session, revision) => session.closeRevision > revision,
  ReaderWindowCoordinator: { metrics: () => ({}) }, readerControlKeyboardVisible: () => false,
  hideReaderControlKeyboard: () => { throw Error('unexpected keyboard work'); },
};
function Host(mutate = code => code, sdk = actualSdk) {
  const code = mutate(names.map(method).join('\n'));
  return compileReaderReplaceSdkMethods('features/reading/LocalReadingExperience.methods.ts', 'ReplaceHostProbe', { ...deps, ReaderControlReplaceGatewayError: sdk.FullError }, true,
    'export class ReplaceHostProbe {' + code + '}');
}
const rule = (id, enabled = true) => ({ id, order: id, name: '规则' + id, pattern: 'old', replacement: 'new',
  group: '', scope: '', excludeScope: '', scopeTitle: false, scopeSource: false, scopeContent: true,
  isEnabled: enabled, isRegex: false, timeoutMillisecond: 3000 });
function ready(key, rows) {
  let state = statePolicy.beginReaderControlReplaceLoad(statePolicy.createReaderControlReplaceState(key));
  return statePolicy.admitReaderControlReplaceLoad(state, statePolicy.readerControlReplaceTicket(state), rows);
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject }; }
function owner(Type = Host(), sdk = actualSdk) {
  const host = new Type();
  const runtime = sdk === actualSdk ? { getUIAbilityContext: () => ({ filesDir: sdk.files }) } : sdk.runtime;
  activeRuntime = runtime; sdk.install(runtime);
  Object.assign(host, { replaceRuntime: runtime, rulesMutationOwner: sdk.Owner.forRuntime(runtime) });
  Object.assign(host, { sourceId: 'source', bookId: 'book', lifecycleToken: 1, mounted: true,
    exitRequested: false, visible: true, page: 'quickReplace', replacePanelGeneration: 1,
    replaceMutationGeneration: 0, replaceMutationActiveGeneration: -1,
    replaceMutationActiveLifecycleToken: -1, replaceMutationActiveBookId: '', replaceMutationActiveRuleId: -1,
    controlReplaceState: ready('source:book:1', [rule(1)]),
    replaceState: quickPolicy.createReaderReplaceQuickState([rule(1)]),
    controlSession: { closeRevision: 0, location: { level: 'secondary', module: 'replace' } },
    latestControlVisualSession: { closeRevision: 0, location: { level: 'secondary', module: 'replace' } },
    observedControlPage: 'quickReplace', observedControlModule: 'replace', observedControlCloseRevision: 0,
    searchGeneration: 0, quickSearchQuery: '', quickSearchState: { kind: 'idle' },
    quickSearchPublication: new ReaderContentSearchPublication(), quickSearchRevision: 0,
    reloadBookCalls: 0, loadCalls: 0,
    applyWindowPolicyForChromeOwner() {},
    controlVisible() { return this.visible; }, controlPage() { return this.page; },
    isSessionActive(token) { return this.mounted && !this.exitRequested && this.lifecycleToken === token; },
    errorMessage(error) { return error.message; },
    persistBeforeContentMutation: async () => () => true,
    reloadCurrentPageAfterReplacePersist(token, book) {
      assert.equal(token, this.lifecycleToken); assert.equal(book, this.bookId); this.reloadBookCalls++;
    },
    invalidateControlBackdrop() {}, dismissControlTemporaryLayers() {}, prepareControlPage() {},
    drainPageTurnPreparationQueue() {}, suspendAdjacentMeasurement() {},
    setControlPage(page) {
      this.page = page; this.controlSession.location = { level: 'secondary', module: 'replace' };
      this.onControlSessionChanged();
    },
    replaceGateway: sdk === actualSdk ? Object.assign(new sdk.Full(runtime), { loadRules: async () => { host.loadCalls++; return [rule(1), rule(2)]; } }) : new sdk.Full(runtime),
  });
  return host;
}
function closeReopen(host) {
  host.visible = false; host.page = 'home'; host.controlSession.closeRevision++;
  host.controlSession.location = { level: 'home', module: 'home' };
  host.onControlSessionChanged(); // execute the actual generation/reset observer
  host.visible = true; // the reader opened the initial Home before entering Replace
  host.openQuickReplace();
}
if(selectedCase==='host-lifecycle'){
{
  const host = owner();
  host.bookTitle = '真实阅读书名'; host.sourceId = 'https://real-source.example';
  host.page = 'home'; host.controlReplaceState = statePolicy.createReaderControlReplaceState();
  host.openQuickReplace();
  assert.equal(host.controlReplaceState.defaultScope, '真实阅读书名;https://real-source.example',
    'actual LRE entry passes admitted book title and source identity, not a parsed session key');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(host.controlReplaceState.defaultScope, '真实阅读书名;https://real-source.example', 'canonical reload preserves context');
}
async function reopenedImport(Type = Host()) {
  const host = owner(Type), write = deferred();
  const pending = host.runControlReplaceMutation(-2, () => write.promise);
  await Promise.resolve(); // visible-position confirmation precedes dispatch
  const active = host.replaceMutationActiveGeneration;
  closeReopen(host);
  assert.equal(host.controlReplaceState.mutationPending, true);
  assert.equal(host.replaceMutationActiveGeneration, active, 'closing/reopening never releases a dispatched write');
  assert.equal(host.loadCalls, 0, 'reopen cannot read old canonical data while a write is pending');
  await assert.rejects(host.runControlReplaceMutation(1, async () => ({ rule: rule(1, false), changed: true })),
    /请先完成|正在保存|等待/);
  write.resolve({ changed: true, needsReload: true });
  await pending;
  assert.equal(host.loadCalls, 1, 'new visible Replace session must load canonical import result after release');
  assert.equal(host.controlReplaceState.status, 'ready');
  assert.deepEqual(host.controlReplaceState.rules.map(row => row.id), [1, 2]);
  assert.equal(host.replaceMutationActiveGeneration, -1);
  assert.equal(host.reloadBookCalls, 1);
}
// Internal content invalidation is not a user chapter/bookmark/search choice.
// Exercise the actual reload method with its heavy reading dependencies mocked.
// A default (-2) selection owner would capture whichever control session happens
// to be open when an old write returns and close that new session after ready.
async function checkInternalReload(code = method('reloadMigratedContentPosition')) {
  const ReloadHost = new Function('hilog', stripTypeScriptTypes('class ReloadProbe {' +
    method('reloadCurrentPageAfterReplacePersist') + code + method('publishQuickSearchState') + '}') + ';return ReloadProbe;')({error(){}});
  const host = installReaderLayoutOwners(new ReloadHost()), selections = [];
  Object.assign(host, { sourceId: 'source', bookId: 'book', chapterSelectionToken: 1, pageTurnSettlementActive: false,
    isSessionActive: () => true, isSelectionActive: () => true, invalidatePageTurnRuntime() {}, contentMetrics: {},
    paginationIndex: { invalidateBook() {} }, chapterWindow: { clear() {} },
    knownContentVersions: [1], resetPaginationDraft() {}, chapter: { chapterIndex: 4 },
    searchGeneration: 0, quickSearchQuery: '原关键词', quickSearchState: { kind: 'results', results: [] },
    quickSearchPublication: new ReaderContentSearchPublication(), quickSearchRevision: 0,
    activeGateway: () => ({ loadProgress: async () => ({kind: 'restored', progress: {
      chapterIndex: 4, chapterOffset: 95, bodyVersion: 'new-body', processingVersion: 'new-rules' }}) }),
    visiblePage: { startScalar: 72 }, selectChapterAnchor: (...args) => selections.push(args) });
  installContentSearchOwnerProbe(host);
  host.reloadCurrentPageAfterReplacePersist(1, 'book');
  await Promise.resolve();
  assert.deepEqual(host.quickSearchState, { kind: 'idle' });
  assert.equal(host.searchGeneration, 1); assert.equal(host.quickSearchQuery, '原关键词');
  assert.equal(selections.length, 1);
  assert.deepEqual(selections[0].slice(0, 3), [4, 95, false], 'Core migrated anchor replaces the old numeric offset');
  assert.equal(selections[0][5], -1,
    'internal Replace reload must never capture/close the currently visible control selection session');
  assert.equal(selections[0][8].processingVersion, 'new-rules');
}
await checkInternalReload();
const internalReloadSource = method('reloadMigratedContentPosition');
const oldInternalReload = internalReloadSource.replace(
  'progress.chapterOffset, false, true, undefined, -1,',
  'progress.chapterOffset, false, true, undefined, -2,');
assert.notEqual(oldInternalReload, internalReloadSource);
await assert.rejects(checkInternalReload(oldInternalReload), /internal Replace reload must never capture/,
  'restoring the old default owner reproduces the close-after-internal-reload regression');
await reopenedImport();
const oldGeneration = code => {
  const patched = code.replace(
    'if (needsReload && this.controlReplaceCurrent(lifecycle, sourceId, bookId, this.replacePanelGeneration))',
    'if (needsReload && this.controlReplaceCurrent(lifecycle, sourceId, bookId, panelGeneration))');
  assert.notEqual(patched, code, 'mutation targets the actual fixed canonical reload condition');
  return patched;
};
await assert.rejects(reopenedImport(Host(oldGeneration)), /new visible Replace session must load/,
  're-injected old generation check reproduces the stale idle import bug, without reverting source');

for (const operation of ['save', 'delete']) {
  const host = owner(), write = deferred();
  const pending = host.runControlReplaceMutation(1, () => write.promise);
  await Promise.resolve();
  closeReopen(host);
  write.resolve(operation === 'save' ? { rule: rule(1, false), changed: true, needsReload: false } :
    { deletedId: 1, changed: true, needsReload: false });
  await pending;
  assert.equal(host.controlReplaceState.mutationPending, false);
  assert.equal(host.replaceMutationActiveGeneration, -1);
  assert.equal(host.controlReplaceState.status, 'ready');
  assert.equal(host.reloadBookCalls, 1, 'committed writes invalidate original book even if original UI expired');
  assert.equal(host.loadCalls, 0, 'confirmed CRUD has a complete returned rule/deletion, unlike import');
  if (operation === 'save') assert.equal(host.controlReplaceState.rules[0].isEnabled, false);
  else assert.deepEqual(host.controlReplaceState.rules, []);
}

// A failed canonical refresh after a CONFIRMED import must reject the Promise
// and must not make the retained pre-import collection writable.
{
  const host = owner();
  host.replaceGateway.loadRules = async () => { host.loadCalls++; throw Error('canonical read failed'); };
  await assert.rejects(host.runControlReplaceMutation(-2, async () => ({ changed: true, needsReload: true })),
    /canonical read failed/);
  assert.notEqual(host.controlReplaceState.status, 'ready',
    'confirmed import + failed canonical read cannot authorize writes using an old rule collection');
  assert.equal(host.replaceMutationActiveGeneration, -1, 'failure releases only its exact write owner');
  assert.equal(host.reloadBookCalls, 1, 'write already happened; content still reloads');
  assert.throws(() => statePolicy.beginReaderControlReplaceMutation(host.controlReplaceState));
  host.replaceGateway.loadRules = async () => [rule(3)];
  await host.reloadControlReplace();
  assert.equal(host.controlReplaceState.status, 'ready');
  assert.deepEqual(host.controlReplaceState.rules.map(r => r.id), [3]);
}

// Old list response after a new read and write cannot overwrite the committed rule.
{
  const host = owner(), oldRead = deferred(), newRead = deferred();
  const reads = [oldRead, newRead];
  host.replaceGateway.loadRules = async () => reads.shift().promise;
  const old = host.reloadControlReplace();
  // Preserve the original overlapping-read ordering after the real owner has
  // completed its bounded journal read; no mutation mutex is bypassed.
  await untilReaderReplaceSdk(() => reads.length === 1);
  const recent = host.reloadControlReplace();
  newRead.resolve([rule(1)]); await recent;
  await host.runControlReplaceMutation(1, async () => ({ rule: rule(1, false), changed: true, needsReload: false }));
  oldRead.resolve([rule(1, true), rule(99)]); await old;
  assert.deepEqual(host.controlReplaceState.rules.map(r => [r.id, r.isEnabled]), [[1, false]]);
}
{
  const host = owner();
  await assert.rejects(host.runControlReplaceMutation(1, async () => {
    throw new ReaderControlReplaceGatewayError('write reply lost', true);
  }), /write reply lost/);
  assert.equal(host.controlReplaceState.writeUncertain, true);
  assert.notEqual(host.controlReplaceState.status, 'ready');
  assert.equal(host.replaceMutationActiveGeneration, -1);
  assert.equal(host.reloadBookCalls, 1, 'unconfirmed reply is not proof no database write happened');
  await assert.rejects(host.runControlReplaceMutation(1, async () => ({ changed: true })), /请先完成/);
  await host.reloadControlReplace();
  assert.equal(host.controlReplaceState.writeUncertain, true, 'list reload cannot confirm the original write');
  assert.equal(host.reloadBookCalls, 2, 'current projection refresh re-materializes the book without confirming the original write');
  await assert.rejects(host.runControlReplaceMutation(1, async () => ({changed:true})), /请先完成/);
}
{
  const host = owner();
  await assert.rejects(host.runControlReplaceMutation(1, async () => { throw Error('validation failed'); }),
    /validation failed/);
  assert.equal(host.controlReplaceState.writeUncertain, false);
  assert.equal(host.controlReplaceState.status, 'ready');
  assert.equal(host.reloadBookCalls, 0);
  assert.equal(host.replaceMutationActiveGeneration, -1);
}

// An old confirmed response may resolve, but cannot mutate a new book session
// or release its write owner; this is not a false claim about a new UI action.
{
  const host = owner(), oldWrite = deferred();
  const pending = host.runControlReplaceMutation(1, () => oldWrite.promise);
  await Promise.resolve();
  host.invalidateReplaceMutationOwner();
  host.lifecycleToken = 2; host.bookId = 'other';
  host.controlReplaceState = ready('source:other:2', [rule(9)]);
  const nextGeneration = host.beginReplaceMutation(2, 'other', 9);
  oldWrite.resolve({ rule: rule(1, false), changed: true, needsReload: false });
  await pending;
  assert.equal(host.replaceMutationActiveGeneration, nextGeneration);
  assert.deepEqual(host.controlReplaceState.rules.map(r => r.id), [9]);
  assert.equal(host.reloadBookCalls, 0);
}
}
if(selectedCase==='cold-recovery'){
// The historical Promise/lifecycle matrix above remains intact. Qualify its
// current exact-recovery carrier with complete production Owner/Gateway and
// real cold SQLite IO, including null-query versus original accepted payload.
for (const phase of ['beforeMethod', 'afterMethod']) {
  const f = await readerReplaceSdkFixture();
  const seed = { ...rule(1) }; delete seed.id;
  await f.command('replace.persist', { operation: 'create', params: seed });
  const h = owner(Host(code => code, f), f); await h.reloadControlReplace();
  const draft = statePolicy.createReaderControlReplaceDraft(h.controlReplaceState.rules[0]);
  draft.name = 'exact-original-' + phase;
  f.options[phase] = 'rules.mutation.apply';
  await assert.rejects(h.runControlReplaceMutation(1, current => h.replaceGateway.save(draft, current)),
    e => e.writeUncertain === true);
  const original = JSON.parse(f.disk());
  assert.equal(h.controlReplaceState.writeUncertain, true);
  assert.equal(h.controlReplaceState.writeOperationId, original.operationId);
  f.retire();
  const cold = await readerReplaceSdkFixture(f), rebuilt = owner(Host(code => code, cold), cold);
  await rebuilt.reloadControlReplace();
  assert.equal(cold.writes().length, 0, 'cold reconciliation is only exact query and readonly projection');
  if (phase === 'beforeMethod') {
    assert.equal(rebuilt.controlReplaceState.writeUncertain, true, 'matching current list cannot prove original nonexecution');
    assert.equal(cold.owner.snapshot().canRetryOriginal, true);
    await assert.rejects(rebuilt.runControlReplaceMutation(1, () => cold.Full.prototype.save.call(rebuilt.replaceGateway, draft)),
      error => error.message === cold.owner.snapshot().message);
    const before = cold.calls.length;
    await rebuilt.reloadControlReplace(true, 'retired-other-intent');
    assert.equal(cold.calls.length, before, 'retained old recovery rejects another exact identity before any RPC');
    const recovery = await mountReaderReplaceRecoveryActor({ state: rebuilt.controlReplaceState, draft, layer: 'editor',
      onReload: id => rebuilt.reloadControlReplace(true, id) });
    const physicalAction = [...recovery.nodes.values()].find(n => n.type === 'Text');
    assert.equal(physicalAction.create, '重试已保留的原规则操作');
    physicalAction.onClick();
    await untilReaderReplaceSdk(() => !recovery.localPending);
    assert.equal(recovery.localError, '');
    assert.strictEqual(recovery.draft, draft); assert.equal(recovery.layer, 'editor');
    recovery.state = rebuilt.controlReplaceState;
    physicalAction.onClick(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(cold.writes().length, 1, 'settled old physical recovery cannot reapply the original write');
    assert.deepEqual(cold.writes()[0].params, { operationId: original.operationId, sequence: original.sequence, mutation: original.mutation },
      'explicit continuation sends the same immutable accepted content, sequence and ID');
  }
  assert.equal(rebuilt.controlReplaceState.writeUncertain, false);
  assert.equal(rebuilt.controlReplaceState.status, 'ready');
  assert.equal(rebuilt.controlReplaceState.rules[0].name, draft.name);
  assert.equal(cold.owner.snapshot().confirmation, 'confirmed');
  assert.equal(cold.disk(), '', 'local intent clears only after exact receipt and AtomicFile ACK');
}
}
console.log(`PASS Replace Host ${selectedCase}: actual SDK methods and selected IO boundary`);
}finally{await cleanupDurableFixtures();resolution.deregister();}

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
