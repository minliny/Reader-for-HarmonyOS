import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'foreground-before-picker': {
    description: 'Actual LRE export/read-to-save handoff: current original session/input, revoked eligibility and accepted-save continuation',
    resources: [],
  },
};

for (const id of selectContractCases(definitions)) {
  await runCase();
  recordContractCasePass(id);
}

async function runCase() {
  const { default: assert } = await import('node:assert/strict');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const {
    createReaderControlSessionState, openReaderControlSession, enterReaderControlModule,
    expandReaderControlSession, dismissReaderControlSession, readerControlContentLocation,
  } = await import('../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts');
  const { readerControlHostInputEnabled, readerControlHostVisible } =
    await import('../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts');

  const source = new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url);
  const names = ['exportControlReplace', 'controlReplaceCurrent', 'readerReplaceRuntimeCurrent',
    'isControlInputEnabled', 'isSessionActive', 'isMountedToken', 'controlVisible'];
  let currentRuntime;
  const ReaderRuntimeOwner = { current() { if (currentRuntime === undefined) throw Error('runtime unavailable'); return currentRuntime; } };
  const Actual = selectedProductionMethods(source, 'ReadingExperience', names,
    { ReaderRuntimeOwner, readerControlHostInputEnabled, readerControlHostVisible, readerControlContentLocation });
  function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
  }
  function fixture() {
    const read = deferred(), save = deferred(), reads = [], saves = [];
    const runtime = { saveRuleBundleJson(json, name) { saves.push({ runtime: this, json, name }); return save.promise; } };
    currentRuntime = runtime;
    const session = expandReaderControlSession(enterReaderControlModule(
      openReaderControlSession(createReaderControlSessionState(), 0), 'replace', 0), 0);
    const owner = Object.assign(new Actual(), {
      mounted: true, exitRequested: false, lifecycleToken: 7, sourceId: 'source-original', bookId: 'book-original',
      replacePanelGeneration: 13, replaceRuntime: runtime, controlSession: session,
      appForeground: true, windowChromeActive: true, interactionBlocked: false, controlObscured: false,
      isReaderIdentityCurrent: () => true,
      replaceGateway: { exportJson(current) { reads.push({ current }); return read.promise; } },
    });
    assert.equal(readerControlContentLocation(owner.controlSession).form, 'full');
    assert.equal(owner.controlReplaceCurrent(7, 'source-original', 'book-original', 13), true);
    assert.equal(owner.isControlInputEnabled(), true);
    return { owner, runtime, read, save, reads, saves, setRuntime(value) { currentRuntime = value; } };
  }
  const json = '{"schemaVersion":1,"replaceRules":[]}';
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const checks = [];

  {
    const f = fixture(), pending = f.owner.exportControlReplace();
    assert.equal(f.reads.length, 1); assert.equal(f.saves.length, 0);
    assert.equal(f.reads[0].current(), true);
    f.read.resolve(json); await tick();
    assert.deepEqual(f.saves, [{ runtime: f.runtime, json, name: 'reader-replace-rules.json' }]);
    f.save.resolve(undefined); await pending;
    assert.equal(f.saves.length, 1, 'an original foreground export opens exactly one save invocation');
    checks.push('foreground export preserves original text/name and single save');
  }

  const revoke = {
    background: f => { f.owner.appForeground = false; },
    'arkweb-covered': f => { f.owner.interactionBlocked = true; },
    'control-obscured': f => { f.owner.controlObscured = true; },
    'window-inactive': f => { f.owner.windowChromeActive = false; },
    'panel-generation': f => { f.owner.replacePanelGeneration += 1; },
    'other-module': f => { f.owner.controlSession = enterReaderControlModule(f.owner.controlSession, 'directory', 0); },
    'hidden-panel': f => { f.owner.controlSession = dismissReaderControlSession(f.owner.controlSession, 0); },
    book: f => { f.owner.bookId = 'book-successor'; },
    source: f => { f.owner.sourceId = 'source-successor'; },
    runtime: f => { f.setRuntime({}); },
    'runtime-unavailable': f => { f.setRuntime(undefined); },
    unmounted: f => { f.owner.mounted = false; },
    lifecycle: f => { f.owner.lifecycleToken += 1; },
    'reader-identity': f => { f.owner.isReaderIdentityCurrent = () => false; },
    'exit-requested': f => { f.owner.exitRequested = true; },
  };
  for (const [reason, change] of Object.entries(revoke)) {
    const f = fixture(), pending = f.owner.exportControlReplace();
    assert.equal(f.reads.length, 1); assert.equal(f.saves.length, 0);
    change(f);
    f.read.resolve(json); await tick();
    // Resolve an incorrectly admitted save too, so the assertion reports the
    // concrete late window rather than hanging on our controlled port.
    f.save.resolve(undefined); await pending;
    console.log(JSON.stringify({ stage: 'actual-export-read-handoff', reason, reads: f.reads.length, saves: f.saves.length }));
    assert.equal(f.saves.length, 0, `${reason}: a revoked original input cannot start a new save picker`);
    assert.equal(f.reads.length, 1, `${reason}: eligibility loss cannot replay the read`);
    checks.push(reason + ' before save: no new picker');
  }

  {
    const f = fixture(); f.owner.appForeground = false;
    await assert.rejects(f.owner.exportControlReplace(), /规则面板已关闭/);
    assert.equal(f.reads.length, 0); assert.equal(f.saves.length, 0);
    checks.push('already-background input starts neither read nor save');
  }
  {
    const f = fixture(), pending = f.owner.exportControlReplace();
    f.read.resolve(json); await tick(); assert.equal(f.saves.length, 1);
    f.owner.appForeground = false; f.owner.interactionBlocked = true;
    f.owner.bookId = 'book-successor'; f.setRuntime({}); f.owner.mounted = false;
    f.save.resolve('controlled-save-result'); await pending;
    assert.equal(f.saves.length, 1, 'an already accepted save is neither canceled nor replayed by later UI retirement');
    assert.equal(f.saves[0].runtime, f.runtime);
    checks.push('already accepted save settles through its original port after retirement');
  }
  {
    const f = fixture(), failure = Error('controlled original read failure'), pending = f.owner.exportControlReplace();
    f.read.reject(failure); await assert.rejects(pending, error => error === failure);
    assert.equal(f.saves.length, 0); checks.push('read rejection remains the original error without save');
  }
  {
    const f = fixture(), failure = Error('controlled original save failure'), pending = f.owner.exportControlReplace();
    f.read.resolve(json); await tick(); f.save.reject(failure);
    await assert.rejects(pending, error => error === failure); assert.equal(f.saves.length, 1);
    checks.push('accepted save rejection remains the original error');
  }
  console.log(JSON.stringify({ contract: 'actual LRE replace export before save', status: 'PASS', checks,
    boundary: 'unchanged selected LRE methods and actual pure session/input policies; deferred export-read/save I/O only, no Core/Native/device execution or physical picker-disappearance claim' }));
}
