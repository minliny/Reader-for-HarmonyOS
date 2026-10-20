import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const { readFileSync }=await import('node:fs');
const { stripTypeScriptTypes }=await import('node:module');
const { dirname, resolve }=await import('node:path');
const { fileURLToPath }=await import('node:url');
const { runtimeOwnerIdentityProbe }=await import('./lib/reader-runtime-admission-probe.mjs');
const { productionMotionMethods }=await import('./lib/reader-motion-method-probe.mjs');

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');

// SourceToolsOrchestrator is a plain state coordinator, but its production
// module imports Harmony-only owners and logging. Inline the real gateway and
// its pure helpers, then remove only those platform imports so Node exercises
// the same progress, failure, cancellation, and snapshot code shipped by the
// app.
const errorMessageSource = read('entry/src/main/ets/app/ErrorMessage.ts')
  .replace(/^export /gm, '');
const transportPolicySource = read('entry/src/main/ets/app/HttpTransportPolicy.ts')
  .replace(/^export /gm, '');
const sourceCategorySource = read('entry/src/main/ets/features/source/ReaderSourceCategory.ts')
  .replace(/^export /gm, '');
const gatewaySource = read('entry/src/main/ets/features/source/SourceGateway.ts')
  .replace(/^import type \{ JsonObject \} from ['"]@reader\/core-harmony['"];\n/m, '')
  .replace(/^import \{ errorMessageOf \} from ['"][^'"]*ErrorMessage['"];\n/m, '')
  .replace(/^import \{ httpUrlHostname, isPrivateNetworkTarget \} from ['"][^'"]*HttpTransportPolicy['"];\n/m, '')
  .replace(/^import \{ classifyReaderSource, type ReaderSourceCategory \} from ['"]\.\/ReaderSourceCategory['"];\n/m, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '');
const orchestratorSource = read('entry/src/main/ets/features/source/SourceToolsOrchestrator.ets')
  .replace(/^import \{ hilog \} from ['"]@kit\.PerformanceAnalysisKit['"];\n/m, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '')
  .replace(/^import \{[\s\S]*?\} from ['"]\.\/SourceGateway['"];\n/m, '');
const sharedFacts=read('entry/src/main/ets/app/ReaderOperationFacts.ts').replace(/^export /gm,'');
const persistedFacts=read('entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,'');
const writeEvidence=read('entry/src/main/ets/app/ReaderWriteEvidence.ts').replace(/^export /gm,'');
const executable = stripTypeScriptTypes(
  `${sharedFacts}\n${persistedFacts}\n${writeEvidence}\n${errorMessageSource}\n${transportPolicySource}\n${sourceCategorySource}\n${gatewaySource.replace(/^import[^\n]+\n/gm,'')}\n${orchestratorSource.replace(/^import[^\n]+\n/gm,'')}`,
);
assert.doesNotMatch(executable, /^import /m, 'the Node harness must not retain platform imports');

let currentOwner;const owned=[];const {isReaderCoreTransactionPendingError}=await import('../entry/vendor/core-harmony/sdk/reader_core.ts');
const {SourceGateway,SourceToolsOrchestrator}=new Function('ReaderRuntimeOwner','isReaderCoreTransactionPendingError','hilog',executable.replace(/^export /gm,'')+';return{SourceGateway,SourceToolsOrchestrator};')(runtimeOwnerIdentityProbe(()=>currentOwner),isReaderCoreTransactionPendingError,{warn(){},error(){},info(){},debug(){},fatal(){}});
const tick = () => new Promise((resolveTick) => setImmediate(resolveTick));

async function waitUntil(predicate, label) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (predicate()) return;
    await tick();
  }
  throw new Error(`timed out waiting for ${label}`);
}

function source(sourceId, name) {
  return {
    sourceId,
    name,
    baseUrl: `https://${sourceId}.example`,
    enabled: true,
    enabledExplore: true,
  };
}

function rawSource(item) {
  return {
    sourceId: item.sourceId,
    name: item.name,
    baseUrl: item.baseUrl,
    enabled: item.enabled,
    enabledExplore: item.enabledExplore,
    bookSource: {},
  };
}

function checkEnvelope(sourceId, available, requestId) {
  const durationMs = available ? 24 : 19;
  const levelsPassed = available ? ['L1', 'L2'] : ['L1'];
  const result = {
    sourceId,
    available,
    levelsPassed,
    durationMs,
    debugLogs: [{
      state: available ? 1000 : -1,
      msg: available ? '真实检测完成' : 'L2 搜索失败',
      timestampMs: durationMs,
      step: available ? 'content' : 'search',
    }],
  };
  if (!available) result.failureReason = 'L2: no searchable books';
  return {
    requestId,
    data: {
      traceId: `source.check.run:${requestId}:1`,
      results: [result],
    },
  };
}

function controlledOwner(sources) {
  const state = {
    calls: [],
    pending: new Map(),
  };
  return {
    state,
    supportsCoreCapability: capability => capability === 'source.check.mode.v1',
    request(method, params, options) {
      if (method === 'source.list') {
        return Promise.resolve({ data: { sources: sources.map(rawSource) } });
      }
      assert.equal(method, 'source.check.run');
      const sourceId = params.sourceIds[0];
      state.calls.push(sourceId);
      return new Promise((resolveRequest, rejectRequest) => {
        state.pending.set(sourceId, {
          options,
          resolve: resolveRequest,
          reject: rejectRequest,
        });
      });
    },
    takeSourceHttpDiagnostics() {
      return [];
    },
  };
}

function capture(owner, consume = () => {}) {
  currentOwner=owner;
  const snapshots = [];
  const orchestrator = new SourceToolsOrchestrator(
    (snapshot) => { snapshots.push(snapshot); consume(snapshot); },
    () => true,
    owner,
  );
  owned.push({orchestrator,owner});return { orchestrator, snapshots };
}

const latest = (snapshots) => snapshots[snapshots.length - 1];
const matching = (snapshots, predicate) => snapshots.find(predicate);

async function openReady(orchestrator, snapshots, sources) {
  orchestrator.open(sources);
  await waitUntil(
    () => latest(snapshots)?.busy === false && latest(snapshots)?.sources.length === sources.length,
    'source tools to open',
  );
}

function reportEnvelope(sourceId, version, timeoutMs) {
  const envelope = checkEnvelope(sourceId, true, 55);
  if (version !== undefined) {
    const report = {
      version, mode: 'search', traceId: envelope.data.traceId,
      ruleDigest: 'a'.repeat(64), inputDigest: 'b'.repeat(64),
      steps: ['L1', 'L2', 'L3', 'L4', 'L5'].map((level, index) => ({
        level, requested: index < 2, executed: index < 2,
        status: index < 2 ? 'pass' : 'not_requested', durationMs: index === 0 ? 1 : index === 1 ? 23 : 0,
      })),
    };
    if (version === 2) {
      report.executionOptions = { timeoutMs };
      report.executionOptionsDigest = 'c'.repeat(64);
    }
    envelope.data.results[0].report = report;
  }
  return envelope;
}

function reportOwner(version, mutate = () => {}, history = []) {
  const calls = [];
  return {
    calls,
    supportsCoreCapability: capability => capability === 'source.check.mode.v1' ||
      (version !== undefined && capability === `source.check.report.v${version}`),
    async request(method, params, options) {
      calls.push({ method, params: structuredClone(params), options });
      if (method === 'source.list') return { data: { sources: [{
        ...rawSource(source('report-source', '报告源')), sourceVersion: 'a'.repeat(64), checkReports: history,
      }] } };
      assert.equal(method, 'source.check.run');
      const envelope = reportEnvelope(params.sourceIds[0], version, params.timeoutMs);
      mutate(envelope);
      return envelope;
    },
    takeSourceHttpDiagnostics() { return []; },
  };
}

const reportMutationCases = [
  report => { delete report.executionOptions; },
  report => { delete report.executionOptionsDigest; },
  report => { report.executionOptions.timeoutMs = 1235; },
  report => { report.executionOptions.timeoutMs = 1.5; },
  report => { report.executionOptions.timeoutMs = -1; },
  report => { report.executionOptions.timeoutMs = 4294967296; },
  report => { report.executionOptions.cookie = 'PRIVATE'; },
  report => { report.executionOptionsDigest = 'not-a-digest'; },
  report => { report.version = 1; },
  report => { report.version = 3; },
  report => { report.rawBody = 'PRIVATE'; },
  report => { report.steps[0].header = 'PRIVATE'; },
];
const legacyHistory = { checkedAtMs: 10, stale: false, report: reportEnvelope('report-source', 1, 1234).data.results[0].report };
const currentHistory = { checkedAtMs: 20, stale: false, report: reportEnvelope('report-source', 2, 1234).data.results[0].report };

try{
if(id==='followup-feedback'){
const SourceToolsFeedback = productionMotionMethods(new URL(
  '../entry/src/main/ets/features/source/SourceToolsPage.ets', import.meta.url), ['feedbackIdentity', 'showTransientFeedback']);

// Retained batch results do not own feedback from later operations. Exercise
// real check progress, editor/export Gateway calls, receipt facts and the
// production Page feedback method together for both terminal batch states.
for (const phase of ['completed', 'stopped']) for (const action of ['saved', 'readbackFailed', 'exported']) {
  const sources = [source('https://after-a.example', '甲源'), source('https://after-b.example', '乙源')];
  const owner = controlledOwner(sources), originalRequest = owner.request.bind(owner);
  let failReadback = false, imports = 0, exports = 0;
  owner.request = async (method, params, options) => {
    if (method === 'source.list' && failReadback) { failReadback = false; throw new Error('readback unavailable'); }
    if (method === 'source.export') {
      const selected = sources.filter(item => params.sourceIds === undefined || params.sourceIds.includes(item.sourceId));
      return { data: { data: JSON.stringify(selected.map(item => ({ bookSourceUrl: item.sourceId, bookSourceName: item.name, enabled: true }))), count: selected.length, format: 'json' } };
    }
    if (method === 'source.import') { options.onDispatch(); imports++; return { data: { imported: true, sourceId: params.sourceId, name: params.bookSource.bookSourceName } }; }
    return originalRequest(method, params, options);
  };
  owner.saveBookSourceJson = async () => { exports++; return 'saved-sources.json'; };
  const notices = [],page = Object.assign(new SourceToolsFeedback(), { mounted: true, lastFeedbackIdentity: '',
    getUIContext: () => ({ getPromptAction: () => ({ showToast: notice => notices.push(notice) }) }) });
  const { orchestrator, snapshots } = capture(owner, snapshot => { page.snapshot = snapshot; page.showTransientFeedback(); });
  await openReady(orchestrator, snapshots, sources);
  const selected = sources.map(item => item.sourceId);
  orchestrator.setSelection(selected);orchestrator.checkSelected(selected);
  await waitUntil(() => owner.state.pending.has('https://after-a.example'), 'feedback regression first source');
  owner.state.pending.get('https://after-a.example').resolve(checkEnvelope('https://after-a.example', true, 701));
  await waitUntil(() => owner.state.pending.has('https://after-b.example'), 'feedback regression second source');
  if (phase === 'stopped') { orchestrator.stopCheckSelected();owner.state.pending.get('https://after-b.example').reject(new Error('request cancelled')); }
  else owner.state.pending.get('https://after-b.example').resolve(checkEnvelope('https://after-b.example', true, 702));
  await orchestrator.operationTail;
  const retained = structuredClone(latest(snapshots).batchCheck);
  assert.equal(retained.phase, phase);assert.ok(retained.results.length > 0);
  assert.deepEqual(notices, [], 'initial read/selection/batch messages keep their own existing carriers');
  assert.equal(latest(snapshots).statusEvent, 'batch');
  if (action === 'exported') orchestrator.exportSelected(['https://after-a.example']);
  else {
    orchestrator.openEditor('https://after-a.example');await orchestrator.operationTail;
    assert.deepEqual(notices, [], 'opening the editor does not replay the retained batch result');
    failReadback = action === 'readbackFailed';orchestrator.saveEditor();
  }
  await orchestrator.operationTail;
  assert.deepEqual(latest(snapshots).batchCheck, retained, 'later operations preserve original progress, counts and item results');
  assert.equal(latest(snapshots).statusEvent, 'feedback');
  assert.equal(notices.length, 1, `${phase}/${action}: later operation emits one own result`);
  page.showTransientFeedback();assert.equal(notices.length, 1, 'repainting a terminal operation cannot replay feedback');
  if (action === 'exported') { assert.equal(exports, 1);assert.match(notices[0].message, /已导出 1 个书源/); }
  else {
    assert.equal(imports, 1, 'follow-up read failure never repeats source.import');
    assert.equal(latest(snapshots).receipt.receipt.confirmation, 'confirmed');
    if (action === 'readbackFailed') { assert.equal(latest(snapshots).receipt.receipt.fact, 'confirmedRefreshFailed');assert.match(notices[0].message, /已确认.*刷新失败/);assert.ok(latest(snapshots).editorText.length > 0, 'failed readback retains the original draft'); }
    else { assert.equal(latest(snapshots).editorSourceId, '');assert.match(notices[0].message, /校验并保存/); }
  }
}
}
if(id==='streaming'){
{
  const sources = [source('alpha', '甲源'), source('beta', '乙源'), source('gamma', '丙源')];
  const owner = controlledOwner(sources);
  const { orchestrator, snapshots } = capture(owner);
  await openReady(orchestrator, snapshots, sources);
  const selectedIds = sources.map((item) => item.sourceId);
  orchestrator.setSelection(selectedIds);
  const firstBatchSnapshot = snapshots.length;
  orchestrator.checkSelected(selectedIds);

  await waitUntil(() => owner.state.pending.has('alpha'), 'first source check to start');
  const started = latest(snapshots);
  assert.equal(started.busy, true);
  assert.equal(started.batchCheck.phase, 'running');
  assert.equal(started.batchCheck.total, 3);
  assert.equal(started.batchCheck.completed, 0, 'start publishes before the first source completes');
  assert.equal(started.batchCheck.currentSourceId, 'alpha');
  assert.equal(started.batchCheck.currentSourceName, '甲源');
  assert.deepEqual(started.selectedSourceIds, selectedIds, 'starting a check must not consume selection');

  owner.state.pending.get('alpha').resolve(checkEnvelope('alpha', true, 101));
  await waitUntil(() => owner.state.pending.has('beta'), 'second source check to start');
  const afterAlpha = matching(snapshots.slice(firstBatchSnapshot), (snapshot) =>
    snapshot.batchCheck.completed === 1 && snapshot.batchCheck.results[0]?.sourceId === 'alpha');
  assert.ok(afterAlpha, 'the first result must publish before the second source completes');
  assert.equal(afterAlpha.batchCheck.passed, 1);
  assert.equal(afterAlpha.batchCheck.failed, 0);
  assert.equal(afterAlpha.busy, true);

  owner.state.pending.get('beta').reject(new Error('transport exploded'));
  await waitUntil(() => owner.state.pending.has('gamma'), 'third source after one source throws');
  const afterBeta = matching(snapshots.slice(firstBatchSnapshot), (snapshot) =>
    snapshot.batchCheck.completed === 2 && snapshot.batchCheck.results[0]?.sourceId === 'beta');
  assert.ok(afterBeta, 'a thrown single-source error must publish one execution-error result');
  assert.equal(afterBeta.batchCheck.passed, 1);
  assert.equal(afterBeta.batchCheck.failed, 0,
    'transport/runtime errors must not be misreported as an unavailable source verdict');
  assert.equal(afterBeta.batchCheck.errors, 1);
  assert.equal(afterBeta.batchCheck.results[0].state, 'error');
  assert.match(afterBeta.batchCheck.results[0].message, /transport exploded/);

  owner.state.pending.get('gamma').resolve(checkEnvelope('gamma', false, 103));
  await waitUntil(() => latest(snapshots)?.batchCheck.phase === 'completed', 'batch completion');
  const completed = latest(snapshots);
  assert.equal(completed.busy, false);
  assert.equal(completed.batchCheck.total, 3);
  assert.equal(completed.batchCheck.completed, 3);
  assert.equal(completed.batchCheck.passed, 1);
  assert.equal(completed.batchCheck.failed, 1);
  assert.equal(completed.batchCheck.errors, 1);
  assert.equal(completed.batchCheck.results.length, 3);
  assert.deepEqual(owner.state.calls, selectedIds, 'a failed item must not abort the remaining selection');
  assert.deepEqual(completed.selectedSourceIds, selectedIds, 'completed checks retain the selected scope');
}
}
if(id==='mode-proof'){
for (const mode of ['search', 'explore']) {
  const sources = [source('mode-check', 'Mode')];
  const owner = controlledOwner(sources);
  const { orchestrator, snapshots } = capture(owner);
  await openReady(orchestrator, snapshots, sources);
  orchestrator.updateCheckSelection(mode, 2);
  orchestrator.checkSelected(['mode-check']);
  await waitUntil(() => owner.state.pending.has('mode-check'), `${mode} check to start`);
  owner.state.pending.get('mode-check').resolve(checkEnvelope('mode-check', true, 120));
  await waitUntil(() => latest(snapshots)?.batchCheck.phase === 'completed', `${mode} check to finish`);
  const message = latest(snapshots).batchCheck.results[0].message;
  assert.match(message, mode === 'explore' ? /^发现 / : /^搜索 /);
  orchestrator.updateCheckSelection(mode === 'explore' ? 'search' : 'explore', 5);
  assert.equal(latest(snapshots).batchCheck.results[0].message, message,
    'a later selection cannot relabel the completed capability evidence');
}
}
if(id==='stop'){
{
  const sources = [source('stop-a', '停止甲'), source('stop-b', '停止乙')];
  const owner = controlledOwner(sources);
  const { orchestrator, snapshots } = capture(owner);
  await openReady(orchestrator, snapshots, sources);
  const selectedIds = sources.map((item) => item.sourceId);
  orchestrator.setSelection(selectedIds);
  orchestrator.checkSelected(selectedIds);
  await waitUntil(() => owner.state.pending.has('stop-a'), 'stoppable source check to start');

  orchestrator.stopCheckSelected();
  const stopping = latest(snapshots);
  assert.equal(stopping.batchCheck.phase, 'stopping');
  assert.equal(stopping.batchCheck.completed, 0);
  assert.equal(stopping.batchCheck.failed, 0);
  assert.equal(stopping.batchCheck.errors, 0);
  assert.deepEqual(stopping.selectedSourceIds, selectedIds);
  const pending = owner.state.pending.get('stop-a');
  assert.equal(pending.options.shouldCancel(), true, 'stop must reach the Core request cancellation guard');
  pending.reject(new Error('Reader-Core request cancelled by caller'));

  await waitUntil(() => latest(snapshots)?.batchCheck.phase === 'stopped', 'stopped terminal state');
  const stopped = latest(snapshots);
  assert.equal(stopped.busy, false);
  assert.equal(stopped.batchCheck.completed, 0);
  assert.equal(stopped.batchCheck.passed, 0);
  assert.equal(stopped.batchCheck.failed, 0, 'user cancellation must not be reported as source failure');
  assert.equal(stopped.batchCheck.errors, 0, 'user cancellation must not be reported as execution error');
  assert.equal(stopped.batchCheck.results.length, 0);
  assert.deepEqual(owner.state.calls, ['stop-a'], 'stop prevents the next selected source from starting');
  assert.deepEqual(stopped.selectedSourceIds, selectedIds, 'stopping retains the selected scope');
}
}
if(id==='index-selection'){
const sources=[source('selected-a','甲'),source('selected-b','乙')],owner=controlledOwner(sources);const {orchestrator,snapshots}=capture(owner);await openReady(orchestrator,snapshots,sources);orchestrator.setSelection(sources.map(s=>s.sourceId));
const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),pageSource=read('entry/src/main/ets/features/source/SourceToolsPage.ets');sdk.hooks.childSources.SourceToolsPage=pageSource;
const leaf=sdk.consumer(pageSource,['snapshot','onCheckSelected'],{EMPTY_SOURCE_TOOLS_SNAPSHOT:latest(snapshots)}).constructor;
const index=sdk.consumer(read('entry/src/main/ets/pages/Index.ets'),['sourceToolsContent','sourceToolsSurface','isCurrentSourceToolsPresentation','isCurrentRuntime'],{SourceToolsPage:leaf,ReaderRuntimeOwner:runtimeOwnerIdentityProbe(()=>currentOwner)});
Object.assign(index,{navigationGeneration:1,mountedRuntimeOwner:owner,detailShelfAdmissionMount:1,sourceToolsOrchestrator:orchestrator,sourceToolsPresentationIdentity:'source-tools:1',sourceToolsSnapshot:latest(snapshots),shelfReceiptRetired:false,route:'sourceTools'});orchestrator.attachPresentation('source-tools:1',snapshot=>{snapshots.push(snapshot);index.sourceToolsSnapshot=snapshot;},()=>true);
index.sourceToolsContent();const child=sdk.walk(index).find(actor=>actor instanceof leaf);assert.ok(child);const check=child.onCheckSelected;check(['selected-a','selected-b']);await waitUntil(()=>owner.state.pending.has('selected-a'),'actual Index starts canonical first selection');assert.deepEqual(orchestrator.current().selectedSourceIds,['selected-a','selected-b']);orchestrator.stopCheckSelected();owner.state.pending.get('selected-a').reject(Error('cancelled'));await orchestrator.operationTail;
const count=owner.state.calls.length;index.navigationGeneration++;check(['selected-b']);await tick();assert.equal(owner.state.calls.length,count,'old physical callback cannot start successor check');

}
if(id==='scale-selection'){
{
  const sourceCount = 1777;
  const sources = Array.from({ length: sourceCount }, (_unused, index) =>
    source(`scale-${index}`, `规模源 ${index + 1}`));
  const owner = controlledOwner(sources);
  const { orchestrator, snapshots } = capture(owner);
  await openReady(orchestrator, snapshots, sources);
  const catalogRevision = latest(snapshots).sourceListRevision;
  const initialSelectionRevision = latest(snapshots).selectionRevision;
  const catalogIds = sources.map((item) => item.sourceId);
  const requestedIds = [catalogIds[1], catalogIds[0], catalogIds[1], 'unknown-source']
    .concat(catalogIds.slice(2));
  const selectedIds = [catalogIds[1], catalogIds[0]].concat(catalogIds.slice(2));

  orchestrator.setSelection(requestedIds);
  const selected = latest(snapshots);
  assert.equal(selected.selectedSourceCount, sourceCount);
  assert.deepEqual(selected.selectedSourceIds, selectedIds);
  assert.equal(selected.sourceListRevision, catalogRevision,
    'selection-only updates must not remount the 1,777-row source catalog');
  assert.ok(selected.selectionRevision > initialSelectionRevision,
    'selection-only updates have their own observable revision');
  const selectionRevision = selected.selectionRevision;

  orchestrator.checkSelected(requestedIds);
  await waitUntil(() => owner.state.pending.has('scale-1'), '1,777-source check to start');
  const running = latest(snapshots);
  assert.equal(running.batchCheck.total, sourceCount);
  assert.equal(running.batchCheck.completed, 0);
  assert.equal(running.selectedSourceCount, sourceCount);
  assert.deepEqual(running.selectedSourceIds, selectedIds,
    'starting the full-source check retains all 1,777 selected identities');
  assert.equal(running.sourceListRevision, catalogRevision,
    'progress-only updates must not remount the source catalog');
  assert.equal(running.selectionRevision, selectionRevision,
    'progress-only updates must not invalidate row selection state');

  orchestrator.stopCheckSelected();
  owner.state.pending.get('scale-1').reject(new Error('Reader-Core request cancelled by caller'));
  await waitUntil(() => latest(snapshots)?.batchCheck.phase === 'stopped', '1,777-source check to stop');
  const stopped = latest(snapshots);
  assert.equal(stopped.selectedSourceCount, sourceCount);
  assert.deepEqual(stopped.selectedSourceIds, selectedIds,
    'stopping the full-source check retains all 1,777 selected identities');
  assert.equal(stopped.sourceListRevision, catalogRevision);
  assert.equal(stopped.selectionRevision, selectionRevision);
  assert.equal(stopped.batchCheck.completed, 0);
  assert.equal(stopped.batchCheck.errors, 0,
    'cancelling an in-flight item is not an execution-error result');
}
}
if(id==='list-notifications'){
const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');const {ts,options}=installedEtsCompiler();const sourceText=read('entry/src/main/ets/features/source/SourceToolsPage.ets');const tree=ts.createSourceFile('SourceToolsData.ets',sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);
const names=['SourceToolListRow','SourceToolListDataSource','SourceCheckResultDataSource','SourceDebugLogDataSource'];const declarations=tree.statements.filter(n=>n.name&&names.includes(n.name.getText(tree)));assert.equal(declarations.length,names.length);
const code=ts.transpileModule(declarations.map(n=>n.getText(tree)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;const types=new Function(code+';return{'+names.join(',')+'};')();
const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});const snapshot={sources:Array.from({length:1777},(_,i)=>source('row-'+i,'源'+i)),selectedSourceIds:[],sourceListRevision:1,selectionRevision:1,busy:false,batchCheck:{results:[]},debugLogs:[],debugSourceId:''};
const page=sdk.consumer(sourceText,['snapshot','sourceDataSource','batchResultDataSource','debugLogDataSource','projectedSourceListRevision','projectedSelectionRevision','projectedBusy','projectedCanWrite','projectedBatchResultsIdentity','projectedDebugLogsIdentity','mounted','lastFeedbackIdentity','feedbackIdentity','showTransientFeedback','syncListDataSources','canWriteSources','batchResultsIdentity','debugLogsIdentity'],{...types,EMPTY_SOURCE_TOOLS_SNAPSHOT:snapshot},{snapshot});
let reloads=0,resultReloads=0;const listener={onDataReloaded(){reloads++;}};page.sourceDataSource.registerDataChangeListener(listener);page.sourceDataSource.registerDataChangeListener(listener);page.batchResultDataSource.registerDataChangeListener({onDataReloaded(){resultReloads++;}});
page.syncListDataSources();assert.equal(reloads,1);assert.equal(page.sourceDataSource.totalCount(),1777);assert.deepEqual(page.sourceDataSource.getData(1776).source,snapshot.sources[1776]);
page.snapshot={...snapshot,selectionRevision:2,selectedSourceIds:['row-100','row-1776']};page.syncListDataSources();assert.equal(reloads,2);assert.equal(page.sourceDataSource.getData(100).selected,true);assert.equal(page.sourceDataSource.getData(0).selected,false);assert.equal(page.sourceDataSource.getData(1776).actionsEnabled,true);
page.snapshot={...page.snapshot,batchCheck:{results:[{sourceId:'row-100',traceId:'t',state:'passed',message:'ok'}]}};page.syncListDataSources();assert.equal(reloads,2,'progress-only update does not reload source catalog');assert.equal(resultReloads,2,'actual results IDataSource receives changed result identity');
page.snapshot={...page.snapshot,busy:true};page.syncListDataSources();assert.equal(reloads,3);assert.equal(page.sourceDataSource.getData(100).actionsEnabled,false);page.sourceDataSource.unregisterDataChangeListener(listener);page.snapshot={...page.snapshot,busy:false};page.syncListDataSources();assert.equal(reloads,3,'unregistered listener receives no later reload');assert.equal(page.sourceDataSource.getData(100).actionsEnabled,true);

}
if(id==='report-negotiation'){
for (const version of [undefined, 1, 2]) {
  const owner = reportOwner(version);
  const gateway = new SourceGateway(owner);
  const outcome = await gateway.checkSource('report-source', () => true, undefined, 'search', ['L1', 'L2'], 1234);
  assert.equal(owner.calls[0].params.reportVersion, version);
  assert.equal(owner.calls[0].params.timeoutMs, 1234);
  assert.equal(owner.calls[0].options.timeoutMs, 6234);
  assert.equal(outcome.report?.version, version);
  assert.equal(outcome.report?.executionOptions?.timeoutMs, version === 2 ? 1234 : undefined);
  await gateway.loadSources(undefined, true);
  assert.equal(owner.calls[1].params.includeCheckReports, version === undefined ? undefined : true);
  assert.equal(owner.calls[1].params.checkReportVersion, version === 2 ? 2 : undefined,
    'older Core never receives a new parameter');
}
}
if(id==='report-schema'){
for (const mutate of reportMutationCases) {
  const owner = reportOwner(2, envelope => mutate(envelope.data.results[0].report));
  await assert.rejects(new SourceGateway(owner).checkSource('report-source', () => true, undefined,
    'search', ['L1', 'L2'], 1234), /report|execution options/);
}
}
if(id==='v1-fields'){
for (const field of ['executionOptions', 'executionOptionsDigest']) {
  const owner = reportOwner(1, envelope => { envelope.data.results[0].report[field] = null; });
  await assert.rejects(new SourceGateway(owner).checkSource('report-source'), /unknown fields/,
    'strict v1 rejects v2-only fields even when null');
}
}
if(id==='budget'){
for (const timeout of [0, -1, 1.5, 4294967296, NaN]) {
  const owner = reportOwner(2);
  await assert.rejects(new SourceGateway(owner).checkSource('report-source', () => true, undefined,
    'search', ['L1', 'L2'], timeout), /Core budget/);
  assert.equal(owner.calls.length, 0, 'invalid budget is rejected before dispatch');
}
}
if(id==='report-history'){
{
  const owner = reportOwner(2, undefined, [currentHistory, legacyHistory]);
  const sources = await new SourceGateway(owner).loadSources(undefined, true);
  assert.deepEqual(sources[0].checkReports.map(row => row.report.version), [2, 1]);
  assert.match(sources[0].lastCheckSummary, /Core 预算 1234ms/);
  const legacy = await new SourceGateway(reportOwner(1, undefined, [legacyHistory])).loadSources(undefined, true);
  assert.match(legacy[0].lastCheckSummary, /预算未知（旧版记录）/);
  await assert.rejects(new SourceGateway(reportOwner(1, undefined, [currentHistory])).loadSources(undefined, true),
    /unrequested report version/);
  const ordinaryOwner = reportOwner(2, undefined, [null]);
  delete ordinaryOwner.supportsCoreCapability;
  const ignored = await new SourceGateway(ordinaryOwner).loadSources();
  assert.equal(ignored[0].checkReports, undefined, 'history remains opt-in');
  assert.deepEqual(ordinaryOwner.calls[0].params, {}, 'ordinary listing never requires diagnostic capability negotiation');
}
}
}finally{for(const {orchestrator,owner}of owned){orchestrator.stopCheckSelected();for(const pending of owner.state?.pending?.values()??[])pending.reject(Error('fixture cleanup'));await Promise.allSettled([orchestrator.operationTail]);}currentOwner=undefined;}
}
const definitions={"followup-feedback": "followup-feedback actual scoped owner/gateway/storage path; controlled Core/OS ports", "streaming": "streaming actual scoped owner/gateway/storage path; controlled Core/OS ports", "mode-proof": "mode-proof actual scoped owner/gateway/storage path; controlled Core/OS ports", "stop": "stop actual scoped owner/gateway/storage path; controlled Core/OS ports", "index-selection": "index-selection actual scoped owner/gateway/storage path; controlled Core/OS ports", "scale-selection": "scale-selection actual scoped owner/gateway/storage path; controlled Core/OS ports", "list-notifications": "list-notifications actual scoped owner/gateway/storage path; controlled Core/OS ports", "report-negotiation": "report-negotiation actual scoped owner/gateway/storage path; controlled Core/OS ports", "report-schema": "report-schema actual scoped owner/gateway/storage path; controlled Core/OS ports", "v1-fields": "v1-fields actual scoped owner/gateway/storage path; controlled Core/OS ports", "budget": "budget actual scoped owner/gateway/storage path; controlled Core/OS ports", "report-history": "report-history actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
