import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';

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

let currentOwner;
globalThis.ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>currentOwner);
globalThis.isReaderCoreTransactionPendingError=()=>false;
globalThis.hilog = {
  warn() {}, error() {}, info() {}, debug() {}, fatal() {},
};

const moduleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`;
const { SourceGateway, SourceToolsOrchestrator } = await import(moduleUrl);

const tick = () => new Promise((resolveTick) => setTimeout(resolveTick, 0));

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

function capture(owner) {
  currentOwner=owner;
  const snapshots = [];
  const orchestrator = new SourceToolsOrchestrator(
    (snapshot) => snapshots.push(snapshot),
    () => true,
    owner,
  );
  return { orchestrator, snapshots };
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

function privateMethod(sourceText, signature, nextSignature) {
  const start = sourceText.indexOf(signature);
  const end = sourceText.indexOf(nextSignature, start + signature.length);
  assert.ok(start >= 0 && end > start, `expected ${signature} before ${nextSignature}`);
  return sourceText.slice(start, end);
}

// One controlled sweep proves that progress is observable before terminal
// completion, that every source publishes its own verdict, and that a thrown
// single-source execution error stays distinct and does not abort later sources.
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

// Stopping cancels the in-flight request through the real shouldContinue /
// shouldCancel boundary. Cancellation is not a source verdict, so it must not
// increment completed or failed and the next selected source must not start.
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

// The route adapter used to consume (clear) selection immediately before
// starting detection. Keep this integration edge guarded even though Index is
// an ArkUI component and cannot be executed in plain Node.
{
  const index = read('entry/src/main/ets/pages/Index.ets');
  const adapter = index.match(/onCheckSelected:[^\n]*/)?.[0];
  assert.ok(adapter, 'Index exposes the guarded original owner selected-source intent');
  assert.match(adapter, /isCurrentSourceToolsPresentation/);
  assert.match(adapter, /host\?\.checkSelected\(sourceIds\)/);
  assert.doesNotMatch(adapter, /consumeSelection/,
    'starting detection must not clear the owner canonical visible selected scope');
}

// Scale contract for the actual imported-source cardinality seen by the
// product. Selecting all 1,777 sources must remain one normalized O(N) state
// transition: it must not invalidate the source catalog revision (which is the
// virtual-list mount key), and detection/stopping must retain that scope.
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

// ArkUI structure guard: each reusable row receives a precomputed membership
// value. A row must never scan the whole selectedSourceIds array, and selection
// changes update the IDataSource instead of remounting the 1,777-item list.
{
  const page = read('entry/src/main/ets/features/source/SourceToolsPage.ets');
  const sourceCard = privateMethod(page, 'private sourceCard(', 'private sourceRow(');
  const sourceRow = privateMethod(page, 'private sourceRow(', 'private editorCard(');

  assert.match(page, /class\s+\w*Source\w*DataSource\s+implements\s+IDataSource/,
    'large source rows are owned by an ArkUI IDataSource');
  assert.match(sourceCard, /LazyForEach\(/,
    'the 1,777-row catalog uses LazyForEach virtualization');
  assert.doesNotMatch(sourceCard, /Repeat\(/,
    'Repeat virtualScroll is not a valid replacement for LazyForEach in this @Component');
  assert.doesNotMatch(page, /\.virtualScroll\(/,
    'Repeat virtualScroll is illegal in this @Component; growing results must use an IDataSource/LazyForEach path');
  assert.match(page, /class\s+SourceToolListRow[\s\S]*?readonly\s+selected:\s*boolean/,
    'source rows carry precomputed selection membership');
  assert.match(sourceRow, /row\.selected/,
    'source-row rendering consumes the precomputed membership bit');
  assert.doesNotMatch(sourceRow, /selectedSourceIds/,
    'a reusable source row must receive precomputed selection membership');
  assert.doesNotMatch(sourceRow, /\.indexOf\(/,
    'a reusable source row must not linearly scan selection for every one of 1,777 rows');
  assert.match(sourceCard,
    /sourceId[^\n]*row\.selected[\s\S]*row\.actionsEnabled|sourceId[^\n]*\$\{row\.selected[^\n]*\$\{row\.actionsEnabled/,
    'LazyForEach row identity must change when selection or enabled state changes');
  assert.doesNotMatch(page, /ForEach\(\[`\$\{this\.snapshot\.sourceListRevision\}/,
    'source-list updates must not be implemented by changing a one-item ForEach mount key');
  assert.match(page, /ForEach\(\[this\.batchControlsRenderKey\(\)\]/,
    'the small V1 batch-control subtree must remount when captured enabled/selection inputs change');
  assert.match(page, /ForEach\(\[this\.batchProgressRenderKey\(\)\]/,
    'the small V1 progress subtree must remount for each observable batch transition');
  const controlsRenderKey = privateMethod(
    page,
    'private batchControlsRenderKey(',
    'private batchProgressRenderKey(',
  );
  assert.match(controlsRenderKey, /selectionRevision/);
  assert.match(controlsRenderKey, /selectedSourceCount/);
  assert.match(controlsRenderKey, /snapshot\.busy/);
  assert.match(controlsRenderKey, /batchCheck\.phase/);
  assert.doesNotMatch(controlsRenderKey, /sourceListRevision/,
    'control refresh must not couple selection changes back to the catalog revision');
  const progressRenderKey = privateMethod(
    page,
    'private batchProgressRenderKey(',
    'private debugLogsIdentity(',
  );
  assert.match(progressRenderKey, /progress\.completed/);
  assert.match(progressRenderKey, /progress\.currentSourceId/);
  assert.match(progressRenderKey, /batchResultsIdentity\(\)/);

  const orchestratorSource = read('entry/src/main/ets/features/source/SourceToolsOrchestrator.ets');
  const publish = privateMethod(orchestratorSource, 'private publish(', 'private copySnapshot(');
  const revisionAssignment = publish.slice(
    publish.indexOf('const sourceListRevision'),
    publish.indexOf('const selectionRevision'),
  );
  assert.doesNotMatch(revisionAssignment, /selectedSourceIds/,
    'sourceListRevision is catalog-only and must not change for selection updates');
  const normalize = privateMethod(orchestratorSource, 'private normalizeSourceIds(', 'private enqueue(');
  assert.doesNotMatch(normalize, /normalized\.(?:indexOf|includes)/,
    'normalizing a 1,777-source selection must use O(1) duplicate membership checks');
}

// Execute the production DTO/capability boundary with controlled Core receipts.
// This proves negotiation and rejection behavior, not a network/device result.
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
for (const mutate of reportMutationCases) {
  const owner = reportOwner(2, envelope => mutate(envelope.data.results[0].report));
  await assert.rejects(new SourceGateway(owner).checkSource('report-source', () => true, undefined,
    'search', ['L1', 'L2'], 1234), /report|execution options/);
}
for (const field of ['executionOptions', 'executionOptionsDigest']) {
  const owner = reportOwner(1, envelope => { envelope.data.results[0].report[field] = null; });
  await assert.rejects(new SourceGateway(owner).checkSource('report-source'), /unknown fields/,
    'strict v1 rejects v2-only fields even when null');
}
for (const timeout of [0, -1, 1.5, 4294967296, NaN]) {
  const owner = reportOwner(2);
  await assert.rejects(new SourceGateway(owner).checkSource('report-source', () => true, undefined,
    'search', ['L1', 'L2'], timeout), /Core budget/);
  assert.equal(owner.calls.length, 0, 'invalid budget is rejected before dispatch');
}

const legacyHistory = { checkedAtMs: 10, stale: false, report: reportEnvelope('report-source', 1, 1234).data.results[0].report };
const currentHistory = { checkedAtMs: 20, stale: false, report: reportEnvelope('report-source', 2, 1234).data.results[0].report };
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

console.log('source check streaming progress and versioned report options contract: PASS');
