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
  const { BookRequestNotDispatchedError } = await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
  const { compile } = await import('./lib/rules-mutation-durable-probe.mjs');
  let installed;
  const Runtime = runtimeOwnerIdentityProbe(() => installed);
  // Finite persistence and Core transport ports. The editor, Gateway, owner,
  // fixed DTO admission and receipt projection are production methods.
  class FiniteIntentStore {
    constructor(runtime) { this.runtime = runtime; }
    accepted() { return this.runtime.intent; }
    async load() { return this.runtime.intent; }
    async accept(label, method, params, queryHead, current, subscription) {
      assert(current());
      const sequence = await queryHead() + 1;
      const intent = { version:1,label,operationId:`finite-editor/${sequence}`,sequence,
        mutation:{method,params:structuredClone(params)},subscription:structuredClone(subscription) };
      this.runtime.intent = intent;
      return intent;
    }
    async qualifyTerminal() {}
    async ensureDurable() {}
    async retainTerminal(intent, terminal) { this.runtime.intent = {...intent,terminal}; }
    async clear() { this.runtime.intent = undefined; }
  }
  const mutationMethods = compile('features/settings/application/RulesMutationContract.ts','RULES_MUTATION_METHODS',{},true);
  const RulesMutationOwner = compile('features/settings/application/RulesMutationOwner.ts','RulesMutationOwner',{
    ReaderRuntimeOwner:Runtime,RulesMutationIntentStore:FiniteIntentStore,ReaderWriteEvidence,
    BookRequestNotDispatchedError,RULES_MUTATION_METHODS:mutationMethods,
  },true);
  const hilog = { info() {}, warn() {}, error() {} };
  const { SourceHost, SourceGateway } = actualSourceManagementTypes({ ReaderRuntimeOwner: Runtime, RulesMutationOwner, hilog });
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
      editorExact:false, conditionalCapability:true, head:undefined, receipt:undefined, beforeListResponse:undefined,
      supportsCoreCapability(value) { return value === 'source.check.mode.v1' || this.editorExact &&
        ['rules.mutation.exact.v1','rules.mutation.source-management.v1','source.import.conditional.v1'].includes(value) &&
        (value !== 'source.import.conditional.v1' || this.conditionalCapability); }, takeSourceHttpDiagnostics: () => [],
      async clearSourceCookieSession() {}, async openSourceLogin() {},
      async request(method, params, options = {}) {
        if (method === 'source.check.run') await this.dispatchPause?.promise;
        if (options.canDispatch?.() === false || options.canContinue?.() === false) throw Error('original dispatch retired');
        options.onDispatch?.(); this.calls.push({ method, params: clone(params) });
        if (method === 'source.list') {
          if (this.failReadAfterImport && this.imports > 0) { this.failReadAfterImport = false; throw Error('readback unavailable'); }
          const sources = clone(params.sourceId === undefined ? this.rows : this.rows.filter(source => source.sourceId === params.sourceId));
          const beforeResponse = this.beforeListResponse;
          this.beforeListResponse = undefined;
          await beforeResponse?.();
          return { data: { sources } };
        }
        if (method === 'source.export') {
          const sources = this.rows.filter(source => params.sourceIds === undefined || params.sourceIds.includes(source.sourceId));
          const data = sources.map(source => source.bookSource ?? {bookSourceName:source.name,bookSourceUrl:source.baseUrl});
          return {data:{format:'json',count:data.length,data:JSON.stringify(data)}};
        }
        if (method === 'rules.mutation.query') return {data:{head:this.head ?? null,
          receipt:params.operationId !== undefined && params.operationId === this.head?.operationId ? this.receipt : null}};
        if (method === 'rules.mutation.apply') {
          const mutation = params.mutation, source = this.rows.find(value => value.sourceId === mutation.params.sourceId);
          let data, outcome = 'applied';
          const lost = mutation.method === 'source.import' && this.lostImport;
          this.lostImport = false;
          if (mutation.method === 'source.import' && mutation.params.expectedVersion !== undefined &&
            source?.sourceVersion !== mutation.params.expectedVersion) {
            outcome = 'rejected'; data = {error:{code:'INVALID_PARAMS',message:'source changed or deleted',retryable:false}};
          } else if (mutation.method === 'source.import') {
            data = (await this.request('source.import',mutation.params)).data;
          } else if (mutation.method === 'source.update') {
            source.enabled = mutation.params.enabled;
            source.bookSource.enabled = mutation.params.enabled;
            source.sourceVersion = version('2');
            data = {source:{sourceId:source.sourceId,enabled:source.enabled}};
          } else if (mutation.method === 'source.delete') {
            const before = this.rows.length;
            this.rows = this.rows.filter(value => !mutation.params.sourceIds.includes(value.sourceId));
            data = {deleted:before-this.rows.length};
          } else assert.fail(`Unexpected original mutation ${mutation.method}`);
          this.head = {operationId:params.operationId,sequence:params.sequence,payloadFingerprint:version('a')};
          this.receipt = {binding:this.head,method:mutation.method,outcome,data,ackFingerprint:version('b')};
          if (lost) throw Error('write ACK lost');
          return {data:this.receipt};
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
          const rules = params.rules ?? (params.expectedVersion === undefined ? undefined : this.rows[index]?.rules) ??
            {search:null,explore:null,detail:null,toc:null,chapter:null};
          const value = { ...row(params.bookSource.bookSourceUrl, '8'), sourceId:params.sourceId, name: params.bookSource.bookSourceName,
            enabled: params.bookSource.enabled !== false, rules:clone(rules), bookSource: clone(params.bookSource) };
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
    const canonicalRules = {search:[{kind:'jsonPath',path:'$.books[*]'}],explore:null,detail:null,toc:null,chapter:null};
    for (const rawField of ['null','omitted']) {
      for (const retainsDraft of [false,true]) {
        const sourceId = 'canonical-1', rawId = 'https://raw-editor.example';
        const canonical = {...row('https://canonical.example'),sourceId,rules:clone(canonicalRules),bookSource:null};
        if (rawField === 'omitted') delete canonical.bookSource;
        const r = rpc([canonical,row(rawId)]); r.editorExact = true; installed = r;
        const before = clone(r.rows), p = tools(r, `canonical-${rawField}-${retainsDraft}`); await p.open();
        if (retainsDraft) {
          p.owner.openEditor(rawId); await p.settle();
          p.owner.updateEditorDraft(JSON.stringify({...r.rows[1].bookSource,bookSourceName:'retained raw draft'}));
        }
        const previousEditor = p.owner.current();
        const definition = await new SourceGateway(r).readSourceDefinition(sourceId);
        assert.equal(definition.sourceId,sourceId); assert.equal(definition.hasRawBookSource,false);
        assert.equal(JSON.parse(definition.text).bookSourceUrl,canonical.baseUrl,'diagnostics retain the legacy export projection');
        p.owner.openEditor(sourceId); await p.settle();
        assert.equal(p.owner.current().editorSourceId,previousEditor.editorSourceId);
        assert.equal(p.owner.current().editorText,previousEditor.editorText);
        assert.match(p.owner.current().statusMessage,/完整原始 BookSource JSON/);
        if (!retainsDraft) { p.owner.saveEditor(); await p.settle(); }
        assert.equal(r.imports,0); assert.equal(r.count('rules.mutation.apply'),0);
        assert.deepEqual(r.rows,before,'opening canonical metadata cannot replace its rules or convert its source mode');
      }
    }
    {
      const mixed = {...row(),rules:clone(canonicalRules)};
      const r = rpc([mixed]); r.editorExact = true; installed = r;
      const p = tools(r,'mixed-raw-canonical'); await p.open();
      p.owner.openEditor(mixed.sourceId); await p.settle();
      p.owner.updateEditorDraft(JSON.stringify({...mixed.bookSource,bookSourceName:'raw name edited'}));
      p.owner.saveEditor(); await p.settle();
      assert.equal(p.owner.current().editorReadback.confirmation,'confirmed');
      const edit = r.calls.filter(call => call.method === 'rules.mutation.apply').at(-1).params;
      assert.equal(Object.hasOwn(edit.mutation.params,'rules'),false,'Host never synthesizes hidden canonical rules');
      assert.deepEqual(r.rows[0].rules,canonicalRules);
    }
    for (const change of ['unchanged','url-changed','late-disable','late-delete']) {
      const sourceId = 'legacy-1', sourceUrl = 'https://example.org';
      const r = rpc([{...row(sourceUrl),sourceId}]); r.editorExact = true; installed = r;
      const p = tools(r, `opaque-${change}`); await p.open();
      p.owner.openEditor(sourceId); await p.settle();
      assert.equal(p.owner.current().editorSourceId,sourceId);
      const value = {...r.rows[0].bookSource,bookSourceName:'opaque-edited'};
      if (change === 'url-changed') value.bookSourceUrl = 'https://changed.example.org';
      const draft = JSON.stringify(value); p.owner.updateEditorDraft(draft);
      if (change === 'late-disable' || change === 'late-delete') {
        const other = new SourceGateway(r);
        r.beforeListResponse = async () => {
          if (change === 'late-disable') await other.updateSource(sourceId,{enabled:false});
          else await other.deleteSources([sourceId]);
        };
      }
      p.owner.saveEditor(); await p.settle();
      const state = p.owner.current();
      if (change === 'unchanged') {
        assert.equal(r.imports,1,'opaque ID with unchanged original URL remains editable');
        assert.equal(state.editorSourceId,''); assert.equal(state.editorReadback.confirmation,'confirmed');
        assert.equal(r.rows.length,1); assert.equal(r.rows[0].sourceId,sourceId);
        assert.equal(r.rows[0].bookSource.bookSourceUrl,sourceUrl); assert.equal(r.rows[0].name,'opaque-edited');
      } else {
        assert.equal(r.imports,0); assert.equal(state.editorText,draft);
        assert.equal(state.editorReadback.confirmation,'undispatched');
        if (change === 'url-changed') {
          assert.equal(r.count('rules.mutation.apply'),0);
          assert.equal(r.rows[0].bookSource.bookSourceUrl,sourceUrl);
        } else {
          assert.equal(RulesMutationOwner.forRuntime(r).snapshot().blocked,false);
          if (change === 'late-disable') assert.equal(r.rows[0].enabled,false);
          else assert.equal(r.rows.length,0);
        }
      }
      if (change !== 'url-changed') {
        const edit = r.calls.filter(call => call.method === 'rules.mutation.apply').at(-1).params;
        assert.equal(edit.mutation.params.sourceId,sourceId);
        assert.equal(edit.mutation.params.bookSource.bookSourceUrl,sourceUrl);
        assert.equal(edit.mutation.params.expectedVersion,version('1'));
      }
    }
    for (const drift of ['unchanged','raw-rules','disabled','deleted','unknown','confirmed-read-failed']) {
      const r = rpc(); r.editorExact = true; installed = r; const p = tools(r, `edit-${drift}`); await p.open();
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
        assert.equal(r.imports, 1,JSON.stringify({message:state.statusMessage,original:state.original,calls:r.calls})); assert.equal(state.editorSourceId, '',JSON.stringify({message:state.statusMessage,original:state.original,readback:state.editorReadback})); assert.equal(state.editorReadback.confirmation, 'confirmed');
      } else {
        const expected = drift === 'unknown' ? 'unknown' : 'confirmed';
        assert.equal(r.imports, 1); assert.equal(state.editorReadback.confirmation, expected);
        p.owner.updateEditorDraft('late-input'); p.owner.saveEditor(); await p.settle();
        assert.equal(r.imports, 1); assert.equal(p.owner.current().editorText, draft);
        assert.equal(p.owner.current().editorReadback.confirmation, expected, 'later save cannot downgrade accepted/unknown evidence');
        p.detach(); p.attach(); await p.open(); assert.equal(p.owner.current().editorText, draft);
      }
    }
    for (const boundary of ['old-core','missing-condition','invalid-version']) {
      const r = rpc(); r.editorExact = boundary !== 'old-core';
      r.conditionalCapability = boundary !== 'missing-condition';
      if (boundary === 'invalid-version') r.rows[0].sourceVersion = 'legacy';
      installed = r; const p = tools(r, boundary); await p.open();
      p.owner.openEditor(r.rows[0].sourceId); await p.settle();
      const draft = JSON.stringify({...r.rows[0].bookSource,bookSourceName:'retained'});
      p.owner.updateEditorDraft(draft); p.owner.saveEditor(); await p.settle();
      assert.equal(r.imports,0); assert.equal(r.count('rules.mutation.apply'),0);
      assert.equal(p.owner.current().editorText,draft);
      assert.equal(p.owner.current().editorReadback.confirmation,'undispatched');
      await new SourceGateway(r).importBookSourceDocument(draft);
      assert.equal(r.imports,1,'ordinary import retains its compatible upsert');
    }
    for (const action of ['disable','delete','replace']) {
      const r = rpc(); r.editorExact = true; installed = r;
      const p = tools(r, `late-${action}`); await p.open();
      const sourceId = r.rows[0].sourceId;
      p.owner.openEditor(sourceId); await p.settle();
      const draft = JSON.stringify({...r.rows[0].bookSource,bookSourceName:'retained-late-draft'});
      p.owner.updateEditorDraft(draft);
      const other = new SourceGateway(r);
      r.beforeListResponse = async () => {
        if (action === 'disable') await other.updateSource(sourceId,{enabled:false});
        else if (action === 'delete') await other.deleteSources([sourceId]);
        else await other.importBookSourceDocument(JSON.stringify({...r.rows[0].bookSource,ruleSearch:{bookList:'.replacement'}}));
      };
      p.owner.saveEditor(); await p.settle();
      const state = p.owner.current();
      assert.equal(state.editorText,draft);
      assert.equal(state.editorReadback.confirmation,'undispatched','exact Core rejection preserves a writable draft');
      assert.equal(RulesMutationOwner.forRuntime(r).snapshot().blocked,false);
      if (action === 'disable') assert.equal(r.rows[0].enabled,false);
      if (action === 'delete') assert.equal(r.rows.length,0);
      if (action === 'replace') assert.equal(r.rows[0].bookSource.ruleSearch.bookList,'.replacement');
      const edit = r.calls.filter(call => call.method === 'rules.mutation.apply').at(-1).params;
      assert.equal(edit.mutation.params.expectedVersion,version('1'),'late snapshot never replaces the editor-open SHA');
    }
    for (const hasReceipt of [true,false]) {
      const r = rpc(); r.editorExact = true; installed = r;
      const gateway = new SourceGateway(r);
      const draft = JSON.parse(await gateway.loadEditableSource(r.rows[0].sourceId));
      draft.bookSourceName = 'unknown-original'; r.lostImport = true;
      await assert.rejects(gateway.saveEditableSource(r.rows[0].sourceId,JSON.stringify(draft)));
      const original = clone(r.intent), writes = r.count('rules.mutation.apply');
      assert.equal(original.mutation.params.expectedVersion,version('1'));
      r.conditionalCapability = false;
      if (!hasReceipt) { r.receipt = undefined; r.head = undefined; }
      if (hasReceipt) {
        const recovered = await gateway.recoverOriginalSource(() => true,true,original.operationId);
        assert.equal(recovered.confirmation,'confirmed'); assert.equal(recovered.blocked,false);
        assert.equal(r.intent,undefined,'capability loss allows the qualified original ACK cleanup');
      } else {
        await assert.rejects(gateway.recoverOriginalSource(() => true,true,original.operationId),/条件编辑/);
        assert.deepEqual(r.intent,original,'missing capability preserves the fixed condition and original intent');
        assert.equal(RulesMutationOwner.forRuntime(r).snapshot().confirmation,'unknown');
      }
      assert.equal(r.count('rules.mutation.apply'),writes,'capability loss never dispatches another conditional write');
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
