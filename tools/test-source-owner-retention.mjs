import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'check-identity': 'Actual SourceHost/Orchestrator/Gateway single-flight, definition read boundaries, removed/replaced rules, successor finally and final dispatch guards. Finite transport, no Core process.',
  'tools-retention': 'Actual retained Tools owner keeps draft/selection/check settings/results across view detach, continues accepted checks, and honors explicit stop/runtime retirement.',
  'editor-conflict': 'Actual editor load/save refuses observed definition/enable/delete drift; confirmed/unknown receipts remain authoritative and real SDK editor parameter becomes read-only.',
});
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  const { actualSourceManagementTypes } = await import('./lib/source-management-owner-probe.mjs');
  const { runtimeOwnerIdentityProbe } = await import('./lib/reader-runtime-admission-probe.mjs');
  const { bookshelfOperationClass } = await import('./lib/bookshelf-operation-owner-probe.mjs');
  const { projectOperationFacts, projectCommitReadback } = await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
  const { ReaderWriteEvidence } = await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
  const { errorMessageOf } = await import('../entry/src/main/ets/app/ErrorMessage.ts');
  let installed;
  const Runtime = runtimeOwnerIdentityProbe(() => installed);
  const hilog = { info() {}, warn() {}, error() {} };
  const { SourceHost, SourceGateway } = actualSourceManagementTypes({ ReaderRuntimeOwner: Runtime, hilog });
  const projectPersistedReceipt = bookshelfOperationClass('app/ReaderPersistedReceiptProjection.ts', 'projectPersistedReceipt', { projectOperationFacts, projectCommitReadback });
  const SourceToolsOrchestrator = bookshelfOperationClass('features/source/application/SourceToolsOrchestrator.ets', 'SourceToolsOrchestrator', {
    ReaderRuntimeOwner: Runtime, SourceGateway, ReaderWriteEvidence, projectOperationFacts, projectCommitReadback,
    projectPersistedReceipt, errorMessageOf, hilog,
  });
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
  const clone = value => structuredClone(value);
  const version = digit => digit.repeat(64);
  const row = (id = 'https://a.test', digit = '1') => ({ sourceId: id, name: id, baseUrl: id,
    enabled: true, enabledExplore: false, sourceVersion: version(digit),
    bookSource: { bookSourceUrl: id, bookSourceName: id, bookSourceType: 0, enabled: true,
      loginUrl: `${id}/login`, ruleSearch: { bookList: '.books' } } });
  async function waitFor(predicate) { for (let n = 0; n < 200 && !predicate(); n++) await tick(); assert(predicate(), 'bounded fixture event was reached'); }
  function rpc(rows = [row()]) {
    return { rows: clone(rows), calls: [], imports: 0, dispatchPause: undefined, checkPause: undefined,
      lostImport: false, failReadAfterImport: false,
      supportsCoreCapability: value => value === 'source.check.mode.v1', takeSourceHttpDiagnostics: () => [],
      async clearSourceCookieSession() {}, async openSourceLogin() {},
      async request(method, params, options = {}) {
        if (method === 'source.check.run') await this.dispatchPause?.promise;
        if (options.canDispatch?.() === false || options.canContinue?.() === false) throw Error('original dispatch retired');
        options.onDispatch?.(); this.calls.push({ method, params: clone(params) });
        if (method === 'source.list') {
          if (this.failReadAfterImport && this.imports > 0) { this.failReadAfterImport = false; throw Error('readback unavailable'); }
          return { data: { sources: clone(params.sourceId === undefined ? this.rows : this.rows.filter(source => source.sourceId === params.sourceId)) } };
        }
        if (method === 'source.check.run') {
          await this.checkPause?.promise;
          return { requestId: 91, data: { traceId: 'check-fixture', results: [{ sourceId: params.sourceIds[0],
            available: true, levelsPassed: params.levels, durationMs: 1,
            debugLogs: [{ state: 1, msg: 'checked', timestampMs: 1 }] }] } };
        }
        if (method === 'source.import') {
          this.imports++;
          const index = this.rows.findIndex(source => source.sourceId === params.sourceId);
          const value = { ...row(params.sourceId, '8'), name: params.bookSource.bookSourceName,
            enabled: params.bookSource.enabled !== false, bookSource: clone(params.bookSource) };
          if (index < 0) this.rows.push(value); else this.rows[index] = value;
          if (this.lostImport) throw Error('write ACK lost');
          return { data: { imported: true, sourceId: params.sourceId, name: value.name } };
        }
        assert.fail(`Unexpected transport ${method}`);
      },
      count(method) { return this.calls.filter(call => call.method === method).length; },
    };
  }
  function presentation(runtime, identity) {
    let active = true;
    const values = [], projections = [];
    const host = new SourceHost(value => values.push(clone(value)), () => {},
      value => projections.push(clone(value)));
    assert.equal(host.bindPresentation(runtime, identity, () => active), true);
    const acceptedOwner = host.orchestrator;
    return { host, identity, values, projections, retire() { active = false; host.detachPresentation(identity); },
      async settle() { await tick(); await acceptedOwner.operationChain; await tick(); },
      async open() { host.open(identity); await this.settle(); } };
  }
  async function checkIdentity() {
    const runtime = rpc(); installed = runtime;
    const page = presentation(runtime, 'identity-current'); await page.open();
    const prior = clone(page.host.orchestrator.latestProjection);
    page.host.checkSource(runtime.rows[0].sourceId, page.identity); page.host.checkSource(runtime.rows[0].sourceId, page.identity);
    await page.settle();
    assert.equal(runtime.count('source.check.run'), 1);
    assert.equal(page.values.at(-1)[0].checkState, 'passed');
    assert.deepEqual(page.host.orchestrator.latestProjection, prior, 'diagnostics do not confirm/replay a source-write projection');
    {
      const owner = page.host.orchestrator, capture = owner.captureSourceCheck(runtime.rows[0].sourceId);
      capture.definition = await new SourceGateway(runtime).readSourceDefinition(runtime.rows[0].sourceId);
      owner.applySourceCheckOutcome({ sourceId:runtime.rows[0].sourceId,available:true,levelsPassed:['L1','L2'],durationMs:1,
        traceId:'typed-report-boundary',logs:[],hostEvidenceCount:0,
        report:{version:1,mode:'search',traceId:'typed-report-boundary',inputDigest:version('0'),ruleDigest:version('2'),steps:[]} },capture);
      assert.equal(page.values.at(-1)[0].checkState,'unchecked','an executed report digest cannot be stamped onto another source version');
      owner.checkingSourceIds.delete(capture.sourceId);
    }
    for (const drift of ['version', 'raw-rules', 'deleted']) {
      const r = rpc(); installed = r; const p = presentation(r, `drift-${drift}`); await p.open();
      const gate = deferred(); r.checkPause = gate;
      p.host.checkSource(r.rows[0].sourceId, p.identity); await waitFor(() => r.count('source.check.run') === 1);
      if (drift === 'version') r.rows[0].sourceVersion = version('2');
      if (drift === 'raw-rules') r.rows[0].bookSource.ruleSearch.bookList = '.replacement';
      if (drift === 'deleted') r.rows = [];
      gate.resolve(); await p.settle();
      assert(!p.values.at(-1).some(source => source.checkState === 'passed' || source.checkState === 'checking'), `old result cannot stamp ${drift}`);
      if (drift === 'deleted') assert.equal(p.values.at(-1).length, 0);
      if (drift === 'version') assert.equal(p.values.at(-1)[0].sourceVersion, version('2'));
    }
    {
      const r = rpc(); installed = r; const p = presentation(r, 'error-after-version-drift'); await p.open();
      const gate = deferred(); r.checkPause = gate;
      p.host.checkSource(r.rows[0].sourceId, p.identity); await waitFor(() => r.count('source.check.run') === 1);
      r.rows[0].sourceVersion = version('2'); gate.reject(new Error('old version transport failed')); await p.settle();
      assert.equal(p.values.at(-1)[0].sourceVersion, version('2'));
      assert.notEqual(p.values.at(-1)[0].checkState,'failed','old rejection cannot mark the replacement failed');
    }
    {
      const r = rpc(); installed = r; const p = presentation(r, 'queued-version'); await p.open();
      const queue = deferred(), check = deferred(); p.host.orchestrator.operationChain = queue.promise; r.checkPause = check;
      p.host.checkSource(r.rows[0].sourceId, p.identity);
      r.rows = [row('https://a.test', '2')];
      p.host.orchestrator.presentSources(await new SourceGateway(r).loadSources());
      p.host.checkSource(r.rows[0].sourceId, p.identity); p.host.checkSource(r.rows[0].sourceId, p.identity);
      queue.resolve(); await waitFor(() => r.count('source.check.run') === 1);
      assert.equal(p.host.orchestrator.checkingSourceIds.size, 1, 'old finally cannot clear successor single-flight');
      check.resolve(); await p.settle(); assert.equal(r.count('source.check.run'), 1);
      assert.equal(p.values.at(-1)[0].sourceVersion, version('2')); assert.equal(p.values.at(-1)[0].checkState, 'passed');
    }
    {
      const r = rpc(); installed = r; const p = presentation(r, 'dispatch-old'); await p.open();
      const gate = deferred(); r.dispatchPause = gate;
      p.host.checkSource(r.rows[0].sourceId, p.identity); await tick(); await tick();
      p.retire(); gate.resolve(); await p.settle();
      assert.equal(r.count('source.check.run'), 0, 'retirement after readiness cannot dispatch an old diagnostic');
    }
  }
  function tools(runtime, identity = 'tools') {
    let current = true;
    const values = [], owner = SourceToolsOrchestrator.forRuntime(runtime);
    owner.attachPresentation(identity, snapshot => values.push(clone(snapshot)), () => current);
    return { owner, values, async settle() { await tick(); await owner.operationTail; await tick(); },
      async open() { owner.open(runtime.rows); await this.settle(); },
      detach() { current = false; owner.detachPresentation(identity); },
      attach(next = 'tools-return') { current = true; identity = next; owner.attachPresentation(identity, snapshot => values.push(clone(snapshot)), () => current); } };
  }
  async function toolsRetention() {
    const r = rpc([row(), row('https://b.test')]); installed = r; const p = tools(r); await p.open();
    p.owner.setSelection([r.rows[0].sourceId]); p.owner.updateDebugKey('retained-key'); p.owner.updateCheckSelection('explore', 4);
    p.owner.checkSelected([r.rows[0].sourceId]); await p.settle();
    p.owner.openEditor(r.rows[0].sourceId); await p.settle();
    const draft = JSON.stringify({ ...r.rows[0].bookSource, bookSourceName: 'retained-draft' }); p.owner.updateEditorDraft(draft);
    const before = p.owner.current(); p.detach(); r.rows[0].enabled = false; p.attach(); await p.open();
    const after = p.owner.current();
    for (const field of ['editorSourceId','editorText','selectedSourceIds','debugKey','checkMode','checkDepth','batchCheck']) assert.deepEqual(after[field], before[field], `same-owner ${field} survives`);
    assert.equal(after.sources[0].enabled, false, 'library facts reload without overwriting the editor draft');
    p.detach(); r.rows = r.rows.filter(source => source.sourceId !== before.editorSourceId); p.attach(); await p.open();
    assert.equal(p.owner.current().selectedSourceCount,0,'removed entities cannot remain actionable phantom selections');
    assert.equal(p.owner.current().editorText,draft,'a deleted source does not discard its unsaved draft');
    p.owner.cancelEditor(); assert.equal(p.owner.current().editorSourceId, '', 'explicit cancel clears only the draft');
    const run = rpc([row(), row('https://b.test')]); installed = run; const task = tools(run, 'task'); await task.open();
    const gate = deferred(); run.checkPause = gate; task.owner.checkSelected(run.rows.map(source => source.sourceId));
    await waitFor(() => run.count('source.check.run') === 1); task.detach(); gate.resolve(); await task.settle();
    assert.equal(run.count('source.check.run'), 2, 'view close does not stop the accepted batch');
    task.attach(); assert.equal(task.owner.current().batchCheck.phase, 'completed');
    const stop = rpc([row(), row('https://b.test')]); installed = stop; const stopped = tools(stop, 'stop'); await stopped.open();
    const stopGate = deferred(); stop.checkPause = stopGate; stopped.owner.checkSelected(stop.rows.map(source => source.sourceId));
    await waitFor(() => stop.count('source.check.run') === 1); stopped.owner.stopCheckSelected(); stopGate.resolve(); await stopped.settle();
    assert.equal(stop.count('source.check.run'), 1); assert.equal(stopped.owner.current().batchCheck.phase, 'stopped');
    const fresh = rpc(); installed = fresh; const newer = tools(fresh, 'new-runtime'); await newer.open();
    assert.equal(newer.owner.current().editorSourceId, ''); assert.equal(newer.owner.current().selectedSourceCount, 0);
  }
  async function editorConflict() {
    for (const drift of ['unchanged','raw-rules','disabled','deleted','unknown','confirmed-read-failed']) {
      const r = rpc(); installed = r; const p = tools(r, `edit-${drift}`); await p.open();
      p.owner.openEditor(r.rows[0].sourceId); await p.settle();
      const draft = JSON.stringify({ ...r.rows[0].bookSource, bookSourceName: 'edited' }); p.owner.updateEditorDraft(draft);
      if (drift === 'raw-rules') r.rows[0].bookSource.ruleSearch.bookList = '.new';
      if (drift === 'disabled') r.rows[0].enabled = false;
      if (drift === 'deleted') r.rows = [];
      if (drift === 'unknown') r.lostImport = true;
      if (drift === 'confirmed-read-failed') r.failReadAfterImport = true;
      p.owner.saveEditor(); await p.settle(); const state = p.owner.current();
      if (['raw-rules','disabled','deleted'].includes(drift)) {
        assert.equal(r.imports, 0, `${drift} cannot be overwritten by an old editor`);
        assert.equal(state.editorText, draft); assert.equal(state.editorReadback.confirmation, 'undispatched');
      } else if (drift === 'unchanged') {
        assert.equal(r.imports, 1); assert.equal(state.editorSourceId, ''); assert.equal(state.editorReadback.confirmation, 'confirmed');
      } else {
        const expected = drift === 'unknown' ? 'unknown' : 'confirmed';
        assert.equal(r.imports, 1); assert.equal(state.editorReadback.confirmation, expected);
        p.owner.updateEditorDraft('late-input'); p.owner.saveEditor(); await p.settle();
        assert.equal(r.imports, 1); assert.equal(p.owner.current().editorText, draft);
        assert.equal(p.owner.current().editorReadback.confirmation, expected, 'later save cannot downgrade accepted/unknown evidence');
        p.detach(); p.attach(); await p.open(); assert.equal(p.owner.current().editorText, draft);
      }
    }
    const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
    const { foundationControls, withReaderSectionHeading } = await import('./lib/reader-foundation-control-probe.mjs');
    const sourceEditorReadbackPending = bookshelfOperationClass('features/source/application/SourceToolsOrchestrator.ets', 'sourceEditorReadbackPending');
    const source = readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceToolsPage.ets', import.meta.url), 'utf8');
    const owners = owner => [owner, ...[...owner.children.values()].filter(child => child.nodes).flatMap(owners)];
    for (const state of [{busy:false}, {busy:true}, {busy:false,editorReadback:{confirmation:'unknown'}}, {busy:false,editorReadback:{confirmation:'confirmed',fact:'confirmedRefreshFailed'}}]) {
      const controls = withReaderSectionHeading(foundationControls());
      const page = createReaderBuilderProbe(source,
        ['editorCard','canWriteSources','editorDraftIsEditable','editorDraftChange','editorAction','toolsInputIsCurrent','toolsOpeningIsCurrent'],
        { ...controls.dependencies, sourceEditorReadbackPending, AppStorage: { get: () => true } }, controls.hooks).owner;
      Object.assign(page, { appThemeScheme:'day', mounted:true, temporaryBackIdentity:'editor-sdk', editorInputRevision:0,
        snapshot:{editorSourceId:'a',editorRevision:1,editorText:'{}',...state}, actionButton(){} });
      page.editorCard(1);
      const field = owners(page).find(child => child instanceof controls.field.Component);
      assert.ok(field, 'actual ReaderCard mounts its current ReaderFormField');
      assert.equal(field.isEditable,!state.busy && state.editorReadback===undefined,'SDK editor follows actual owner readback admission');
    }
  }
  const cases = { 'check-identity':checkIdentity, 'tools-retention':toolsRetention, 'editor-conflict':editorConflict };
  for (const id of selected) { await cases[id](); recordContractCasePass(id); }
}
