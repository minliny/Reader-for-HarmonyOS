import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(specifier + '.ts', context);
    throw error;
  }
} });
const statePolicy = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const quickPolicy = await import('../entry/src/main/ets/features/reading/ReaderReplaceQuickState.ts');
const { ReaderControlReplaceGatewayError } =
  await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGateway.ts');
const { copyReaderControlSessionState } =
  await import('../entry/src/main/ets/features/reading/ReaderControlSessionState.ts');
const {readerControlHostClosing}=await import('../entry/src/main/ets/features/reading/ReaderControlHostSession.ts');
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',
  import.meta.url), 'utf8');
const names = ['openQuickReplace', 'controlReplaceCurrent', 'reloadControlReplace', 'runControlReplaceMutation',
  'beginReplaceMutation', 'isReplaceMutationCurrent', 'finishReplaceMutation', 'invalidateReplaceMutationOwner',
  'onControlSessionChanged','admitSessionControlClosing'];
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
const deps = { ...statePolicy, ...quickPolicy, copyReaderControlSessionState, ReaderControlReplaceGatewayError, readerControlHostClosing,
  readerControlContentLocation: session => session.location,
  readerControlHostCloseCommitted: (session, revision) => session.closeRevision > revision,
  ReaderWindowCoordinator: { metrics: () => ({}) }, readerControlKeyboardVisible: () => false,
  hideReaderControlKeyboard: () => { throw Error('unexpected keyboard work'); },
};
function Host(mutate = code => code) {
  const code = mutate(names.map(method).join('\n'));
  return new Function(...Object.keys(deps),
    stripTypeScriptTypes('class ReplaceHostProbe {' + code + '}') + ';return ReplaceHostProbe;')(
      ...Object.values(deps));
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
function owner(Type = Host()) {
  const host = new Type();
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
    reloadBookCalls: 0, loadCalls: 0,
    applyWindowPolicyForChromeOwner() {},
    controlVisible() { return this.visible; }, controlPage() { return this.page; },
    isSessionActive(token) { return this.mounted && !this.exitRequested && this.lifecycleToken === token; },
    errorMessage(error) { return error.message; },
    reloadCurrentPageAfterReplacePersist(token, book) {
      assert.equal(token, this.lifecycleToken); assert.equal(book, this.bookId); this.reloadBookCalls++;
    },
    invalidateControlBackdrop() {}, dismissControlTemporaryLayers() {}, prepareControlPage() {},
    drainPageTurnPreparationQueue() {}, suspendAdjacentMeasurement() {},
    setControlPage(page) {
      this.page = page; this.controlSession.location = { level: 'secondary', module: 'replace' };
      this.onControlSessionChanged();
    },
    replaceGateway: { loadRules: async () => { host.loadCalls++; return [rule(1), rule(2)]; } },
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
async function reopenedImport(Type = Host()) {
  const host = owner(Type), write = deferred();
  const pending = host.runControlReplaceMutation(-2, () => write.promise);
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
function checkInternalReload(code = method('reloadCurrentPageAfterReplacePersist')) {
  const ReloadHost = new Function(stripTypeScriptTypes('class ReloadProbe {' +
    code + '}') + ';return ReloadProbe;')();
  const host = new ReloadHost(), selections = [];
  Object.assign(host, { sourceId: 'source', bookId: 'book', pageTurnSettlementActive: false,
    isSessionActive: () => true, invalidatePageTurnRuntime() {}, contentMetrics: {},
    paginationIndex: { invalidateBook() {} }, chapterWindow: { clear() {} },
    knownContentVersions: [1], resetPaginationDraft() {}, chapter: { chapterIndex: 4 },
    visiblePage: { startScalar: 72 }, selectChapterAnchor: (...args) => selections.push(args) });
  host.reloadCurrentPageAfterReplacePersist(1, 'book');
  assert.equal(selections.length, 1);
  assert.deepEqual(selections[0].slice(0, 3), [4, 72, false]);
  assert.equal(selections[0][5], -1,
    'internal Replace reload must never capture/close the currently visible control selection session');
}
checkInternalReload();
const internalReloadSource = method('reloadCurrentPageAfterReplacePersist');
const oldInternalReload = internalReloadSource.replace(
  'this.selectChapterAnchor(chapter.chapterIndex, page.startScalar, false, true, undefined, -1);',
  'this.selectChapterAnchor(chapter.chapterIndex, page.startScalar, false);');
assert.notEqual(oldInternalReload, internalReloadSource);
assert.throws(() => checkInternalReload(oldInternalReload), /internal Replace reload must never capture/,
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
  assert.equal(host.controlReplaceState.writeUncertain, false);
  assert.equal(host.reloadBookCalls, 2, 'canonical uncertainty resolution re-materializes the original book');
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
console.log('PASS Replace Host actual methods: reopen/import canonical read, stale reads, write ownership, uncertainty and Promise rejection; NOT device acceptance');
