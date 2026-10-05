import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');

const indexSource = read('entry/src/main/ets/pages/Index.ets');
assert.match(indexSource, /if \(presentImportResult && snapshot\.receipt\?\.value !== undefined\) this\.applyBookshelfState\(snapshot\.receipt\.value\);/,
  'Index must guard the optional shelf read-back before applying it');
assert.match(indexSource, /onReconcileEditor:[^\n]*isCurrentSourceToolsPresentation[^\n]*host\?\.reconcileEditor\(\)/,
  'Index must expose the read-only editor reconciliation action');

// ReaderOperationFacts is a pure mapping module with no IO and no platform
// imports. Load it directly so the contract pins the exact shipped table.
const factsCode = stripTypeScriptTypes(read('entry/src/main/ets/app/ReaderOperationFacts.ts'));
const factsModule = await import(`data:text/javascript;base64,${Buffer.from(factsCode).toString('base64')}`);
const { projectCommitReadback } = factsModule;

// --- Fixed mapping: four table rows ---------------------------------------
{
  const refreshing = projectCommitReadback('confirmed', 'reading');
  assert.equal(refreshing.fact, 'confirmedRefreshing');
  assert.equal(refreshing.message, '已确认，正在刷新');
  assert.equal(refreshing.confirmation, 'confirmed');
  assert.equal(refreshing.readback, 'reading');

  const failed = projectCommitReadback('confirmed', 'failed');
  assert.equal(failed.fact, 'confirmedRefreshFailed');
  assert.equal(failed.message, '已确认，刷新失败');

  const current = projectCommitReadback('confirmed', 'succeeded');
  assert.equal(current.fact, 'confirmedCurrent');
  assert.equal(current.message, '已确认，当前读取结果可用');

  const pending = projectCommitReadback('unknown', 'succeeded');
  assert.equal(pending.fact, 'pendingReconciliation');
  assert.equal(pending.message, '等待核对');

  const notDispatched = projectCommitReadback('undispatched', 'failed');
  assert.equal(notDispatched.fact, 'notDispatched');
  assert.equal(notDispatched.message, '尚未执行');
}

// `idle` is only meaningful with a confirmed commit: the read-back has not
// reported yet, so the committed write is still refreshing.
{
  const idle = projectCommitReadback('confirmed', 'idle');
  assert.equal(idle.fact, 'confirmedRefreshing');
}

// --- Mutation negatives ----------------------------------------------------
// Flipping the confirmation kind must flip exactly the projected fact; no
// other input channel may compensate for it.
{
  for (const phase of ['reading', 'failed', 'succeeded', 'idle']) {
    const confirmed = projectCommitReadback('confirmed', phase);
    const unknown = projectCommitReadback('unknown', phase);
    const undispatched = projectCommitReadback('undispatched', phase);
    assert.notEqual(confirmed.fact, unknown.fact,
      `unknown commit must never share the confirmed fact (phase=${phase})`);
    assert.notEqual(confirmed.fact, undispatched.fact,
      `undispatched must never masquerade as a confirmed commit (phase=${phase})`);
    assert.equal(unknown.fact, 'pendingReconciliation');
    assert.equal(undispatched.fact, 'notDispatched');
  }
  // Flipping the read-back phase under a confirmed commit flips only the
  // refresh outcome; the commit itself stays confirmed.
  const a = projectCommitReadback('confirmed', 'failed');
  const b = projectCommitReadback('confirmed', 'succeeded');
  assert.equal(a.confirmation, 'confirmed');
  assert.equal(b.confirmation, 'confirmed');
  assert.notEqual(a.fact, b.fact);
  assert.equal(a.fact, 'confirmedRefreshFailed');
  assert.equal(b.fact, 'confirmedCurrent');
}

// A lost commit reply is never collapsed into a refresh failure: the durable
// truth must be reconciled first, regardless of how the read-back ended.
{
  for (const phase of ['reading', 'failed', 'succeeded', 'idle']) {
    assert.equal(projectCommitReadback('unknown', phase).fact, 'pendingReconciliation');
    assert.equal(projectCommitReadback('undispatched', phase).fact, 'notDispatched');
  }
}

// --- FS-021: saveEditor keeps persist and refresh as two facts -------------
// Drive the real SourceToolsOrchestrator + SourceGateway against a controlled
// owner. Persist succeeds, the follow-up source.list rejects, and the page
// must observe "saved but refresh failed" — never "save failed" — while the
// draft stays open for reconciliation. Re-tapping refresh must not re-issue
// the write.
const errorMessageSource = read('entry/src/main/ets/app/ErrorMessage.ts')
  .replace(/^export /gm, '');
const transportPolicySource = read('entry/src/main/ets/app/HttpTransportPolicy.ts')
  .replace(/^export /gm, '');
const sourceCategorySource = read('entry/src/main/ets/features/source/ReaderSourceCategory.ts')
  .replace(/^export /gm, '');
const operationFactsSource = read('entry/src/main/ets/app/ReaderOperationFacts.ts')
  .replace(/^export /gm, '');
const persistedReceiptProjectionSource = read('entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts')
  .replace(/^import \{[\s\S]*?\} from ['"]\.\/ReaderOperationFacts['"];\n/m, '')
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
  .replace(/^import \{ projectCommitReadback \} from ['"][^'"]*ReaderOperationFacts['"];\n/m, '')
  .replace(/^import \{ projectPersistedReceipt \} from ['"][^'"]*ReaderPersistedReceiptProjection['"];\n/m, '')
  .replace(/^import \{[\s\S]*?\} from ['"]\.\/SourceGateway['"];\n/m, '');
assert.match(orchestratorSource,
  /await this\.gateway\.saveEditableSource\(sourceId, text\);[\s\S]*?projectCommitReadback\('confirmed', 'reading'\)[\s\S]*?await this\.gateway\.loadSources\(undefined, true\)/,
  'saveEditor must expose confirmed/refreshing before the read-only list refresh');
const writeEvidenceSource = read('entry/src/main/ets/app/ReaderWriteEvidence.ts').replace(/^import[^\n]+\n/gm,'').replace(/^export /gm,'');
const executable = stripTypeScriptTypes(
  `${writeEvidenceSource}\n${errorMessageSource}\n${transportPolicySource}\n${sourceCategorySource}\n${operationFactsSource}\n${persistedReceiptProjectionSource}\n${gatewaySource.replace(/^import[^\n]+\n/gm,'')}\n${orchestratorSource.replace(/^import[^\n]+\n/gm,'')}`,
);
assert.doesNotMatch(executable, /^import /m, 'the Node harness must not retain platform imports');

let currentOwner;
globalThis.ReaderRuntimeOwner = runtimeOwnerIdentityProbe(() => currentOwner);
globalThis.isReaderCoreTransactionPendingError = () => false;
globalThis.hilog = { warn() {}, error() {}, info() {}, debug() {}, fatal() {} };

const orchestratorModuleUrl = `data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`;
const { SourceToolsOrchestrator } = await import(orchestratorModuleUrl);

const tick = () => new Promise((resolveTick) => setTimeout(resolveTick, 0));
async function waitUntil(predicate, label) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (predicate()) return;
    await tick();
  }
  throw new Error(`timed out waiting for ${label}`);
}

const editableSourceJson = JSON.stringify({
  bookSourceUrl: 'https://a.example',
  bookSourceName: '甲源',
  bookSourceType: 0,
  enabled: true,
});

function saveOwner({ failList = false } = {}) {
  const calls = [];
  let listFailure = failList;
  return {
    calls,
    setListFailure(value) { listFailure = value; },
    supportsCoreCapability: () => false,
    async request(method, params) {
      calls.push(method);
      if (method === 'source.list') {
        if (listFailure) throw new Error('source.list transport exploded');
        return { data: { sources: [{ sourceId: 'https://a.example', name: '甲源', baseUrl: 'https://a.example', enabled: true, enabledExplore: true }] } };
      }
      if (method === 'source.export') {
        return { data: { data: `[${editableSourceJson}]`, count: 1, format: 'json' } };
      }
      if (method === 'source.import') {
        return { data: { imported: true, sourceId: params.sourceId, name: params.bookSource.bookSourceName } };
      }
      throw new Error(`unhandled ${method}`);
    },
  };
}

function captureOrchestrator(owner) {
  currentOwner = owner;
  const snapshots = [];
  const orchestrator = new SourceToolsOrchestrator(
    (snapshot) => snapshots.push(snapshot),
    () => true,
    owner,
  );
  return { orchestrator, snapshots };
}
const latestSnapshot = (snapshots) => snapshots[snapshots.length - 1];

async function openEditorFor(orchestrator, snapshots) {
  orchestrator.open([]);
  await waitUntil(() => latestSnapshot(snapshots)?.busy === false, 'source tools to open');
  orchestrator.openEditor('https://a.example');
  await waitUntil(
    () => latestSnapshot(snapshots)?.editorSourceId === 'https://a.example' &&
      latestSnapshot(snapshots)?.busy === false,
    'editor to open',
  );
  orchestrator.updateEditorDraft(editableSourceJson);
}

{
  // save succeeds AND refresh succeeds: editor closes with the saved fact.
  const owner = saveOwner();
  const { orchestrator, snapshots } = captureOrchestrator(owner);
  await openEditorFor(orchestrator, snapshots);
  orchestrator.saveEditor();
  await waitUntil(() => latestSnapshot(snapshots)?.busy === false &&
    latestSnapshot(snapshots)?.statusMessage.includes('保存'), 'save to settle');
  const done = latestSnapshot(snapshots);
  assert.equal(done.editorSourceId, '', 'saved editor must close');
  assert.equal(done.editorText, '', 'saved draft must clear');
  assert.equal(done.editorOperation.fact, 'current');
  assert.equal(done.editorOperation.hasValue, true);
  assert.ok(owner.calls.includes('source.import'));
}

{
  // FS-021 core case: save succeeds, refresh rejects. The persisted fact must
  // survive; the message must NOT claim the save failed; the draft stays for
  // reconciliation; and crucially the refresh must not re-dispatch the write.
  const owner = saveOwner({ failList: true });
  const { orchestrator, snapshots } = captureOrchestrator(owner);
  await openEditorFor(orchestrator, snapshots);
  const writesBefore = owner.calls.filter((method) => method === 'source.import').length;
  orchestrator.saveEditor();
  await waitUntil(() => latestSnapshot(snapshots)?.busy === false &&
    latestSnapshot(snapshots)?.statusMessage.includes('刷新失败'), 'save-with-failed-refresh to settle');
  const done = latestSnapshot(snapshots);
  assert.match(done.statusMessage, /已确认，刷新失败/);
  assert.doesNotMatch(done.statusMessage, /保存失败/,
    'a committed save must never be reclassified as a save failure');
  assert.equal(done.editorSourceId, 'https://a.example',
    'the draft stays open for reconciliation after a refresh failure');
  assert.equal(done.editorText, editableSourceJson,
    'the draft text is retained so the user can reconcile, not re-typed');
  assert.equal(done.editorOperation.fact, 'refreshFailed');
  assert.equal(done.editorOperation.stale, true);
  assert.equal(done.editorOperation.canRetry, true);
  assert.equal(done.editorOperation.hasValue, true);
  const writesAfter = owner.calls.filter((method) => method === 'source.import').length;
  assert.equal(writesAfter, writesBefore + 1, 'exactly one persist was dispatched');
  const listCalls = owner.calls.filter((method) => method === 'source.list').length;
  assert.ok(listCalls >= 2, 'the refresh was attempted after the commit');
  // The refresh failure must not have issued any further write.
  assert.equal(owner.calls.filter((method) => method === 'source.import').length, writesAfter,
    'a failed refresh must not trigger a rewrite');
  owner.setListFailure(false);
  orchestrator.reconcileEditor();
  await waitUntil(() => latestSnapshot(snapshots)?.busy === false &&
    latestSnapshot(snapshots)?.editorSourceId === '', 'read-only reconciliation to settle');
  assert.equal(owner.calls.filter((method) => method === 'source.import').length, writesAfter,
    'read-only reconciliation must not dispatch source.import');
  assert.equal(latestSnapshot(snapshots).editorReadback.fact, 'confirmedCurrent');
  assert.equal(latestSnapshot(snapshots).editorOperation.fact, 'current');
}

{
  // Mutation negative: a genuine save rejection still reports save failure and
  // never reaches the refresh path (no source.list issued after the failed
  // import; no refresh-failure wording).
  const calls = [];
  const owner = {
    calls,
    supportsCoreCapability: () => false,
    async request(method, params, options) {
      calls.push(method);
      if (options?.canDispatch?.() === false) throw new Error('fixture request retired before actual dispatch');
      options?.onDispatch?.();
      if (method === 'source.list') return { data: { sources: [] } };
      if (method === 'source.export') {
        return { data: { data: `[${editableSourceJson}]`, count: 1, format: 'json' } };
      }
      if (method === 'source.import') throw new Error('Core rejected the edited source');
      throw new Error(`unhandled ${method}`);
    },
  };
  const { orchestrator, snapshots } = captureOrchestrator(owner);
  await openEditorFor(orchestrator, snapshots);
  const listBefore = calls.filter((method) => method === 'source.list').length;
  orchestrator.saveEditor();
  await waitUntil(() => latestSnapshot(snapshots)?.busy === false &&
    latestSnapshot(snapshots)?.statusMessage.includes('等待核对'), 'failed save to settle');
  const done = latestSnapshot(snapshots);
  assert.match(done.statusMessage, /等待核对/);
  assert.doesNotMatch(done.statusMessage, /刷新失败/,
    'a rejected save must not be dressed up as a refresh failure');
  assert.equal(done.editorOperation.fact, 'pendingReconciliation',
    'a dispatched write with a lost ACK remains unknown');
  assert.equal(done.editorSourceId, 'https://a.example', 'the draft survives a real save failure');
  assert.equal(calls.filter((method) => method === 'source.list').length, listBefore,
    'a failed save must not dispatch the follow-up refresh');
}

// --- LS-031: a committed import batch survives a failed shelf refresh ------
// BookshelfFlowGateway is loaded with its Core/import collaborators injected,
// so the real commit/read-back split is exercised without dragging the whole
// ReaderCoreGateway into Node.
const flowSource = read('entry/src/main/ets/features/bookshelf/BookshelfFlowGateway.ts')
  .replace(/^import \{[\s\S]*?\} from ['"][^'"]*ReaderCoreGateway['"];\n/m, '')
  .replace(/^import \{ ReaderRuntimeOwner \} from ['"][^'"]*ReaderRuntimeOwner['"];\n/m, '')
  .replace(/^import \{[\s\S]*?\} from ['"][^'"]*ReaderOperationFacts['"];\n/m, '')
  .replace(/^import \{ projectPersistedReceipt \} from ['"][^'"]*ReaderPersistedReceiptProjection['"];\n/m, '')
  .replace(/^import \{ errorMessageOf \} from ['"][^'"]*ErrorMessage['"];\n/m, '')
  .replace(/^import \{[\s\S]*?\} from ['"]\.\/LocalBookImportGateway['"];\n/m, '')
  .replace(/^import type \{ LocalBookPreparation \} from ['"][^'"]*ReaderHostRegistry['"];\n/m, '');
// Node's strip-only TypeScript runner intentionally rejects constructor
// parameter properties. Expand the one production constructor into ordinary
// assignments so this harness can exercise the real gateway behaviour.
const flowExecutableSource = flowSource.replace(
  /constructor\(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner\.current\(\),\n\s*private readonly filter: BookshelfFilter = \{ readingState: 'all', sourceKind: 'all' \},\n\s*private readonly background: boolean = false\) \{/,
  "constructor(runtimeOwner: ReaderRuntimeOwner = ReaderRuntimeOwner.current(), filter: BookshelfFilter = { readingState: 'all', sourceKind: 'all' }, background: boolean = false) {\n    this.filter = filter;\n    this.background = background;",
).replace(/^import[^\n]+\n/gm, '').replace(/^export /gm, '');
const flowExecutable = stripTypeScriptTypes(`${operationFactsSource}\n${persistedReceiptProjectionSource}\n${flowExecutableSource}`);
assert.doesNotMatch(flowExecutable, /^import /m, 'flow harness must not retain platform imports');
const flowFactory = new Function(
  'ReaderCoreGateway',
  'ReaderRuntimeOwner',
  'LocalBookImportGateway',
  'errorMessageOf',
  `${flowExecutable}; return { BookshelfFlowGateway, BOOKSHELF_PAGE_SIZE };`,
);

function flowFixture({ failLoad = false, batch: batchOverride } = {}) {
  const calls = { imports: 0, loads: 0 };
  const batch = batchOverride ?? {
    state: 'completed',
    imported: 2,
    failed: 1,
    items: [
      { fileName: 'a.txt', state: 'success' },
      { fileName: 'b.txt', state: 'success' },
      { fileName: 'c.txt', state: 'failed' },
    ],
  };
  class FakeReaderCoreGateway {
    supportsShelfPages() { return false; }
    async loadBookshelf() {
      calls.loads += 1;
      if (failLoad) throw new Error('bookshelf.list transport exploded');
      return { books: [], total: 0 };
    }
    async loadContinueReading() { return undefined; }
  }
  class FakeLocalBookImportGateway {
    async importPreparedSelections() {
      calls.imports += 1;
      return batch;
    }
  }
  const { BookshelfFlowGateway } = flowFactory(
    FakeReaderCoreGateway,
    class {},
    FakeLocalBookImportGateway,
    (error) => (error instanceof Error ? error.message : String(error)),
  );
  return { BookshelfFlowGateway, calls, batch };
}

// A picker cancellation never proves a write. The shelf read may still be
// useful for restoring the current Core projection, but its fact remains
// `notDispatched`.
{
  const { BookshelfFlowGateway, batch } = flowFixture({ batch: {
    state: 'cancelled', imported: 0, failed: 0, items: [],
  } });
  const outcome = await new BookshelfFlowGateway({}).importPreparedSelections([]);
  assert.equal(outcome.batch, batch);
  assert.equal(outcome.readback.fact, 'notDispatched');
  assert.equal(outcome.operation.fact, 'notDispatched');
  assert.ok(outcome.shelf !== undefined);
}

// An all-rejected batch is distinct from an unknown commit: no item has
// established a durable write, so it stays `notDispatched`.
{
  const { BookshelfFlowGateway, batch } = flowFixture({ batch: {
    state: 'completed', imported: 0, failed: 1,
    items: [{ fileName: 'bad.txt', state: 'failed', failure: { code: 'invalidBook', message: 'bad' } }],
  } });
  const outcome = await new BookshelfFlowGateway({}).importPreparedSelections([{ state: 'ready' }]);
  assert.equal(outcome.batch, batch);
  assert.equal(outcome.readback.fact, 'notDispatched');
  assert.equal(outcome.operation.fact, 'notDispatched');
}

// A recovery-pending item is the one existing receipt that can say the write
// reply was lost; it must remain pending reconciliation even if the shelf
// read itself succeeds.
{
  const { BookshelfFlowGateway, batch } = flowFixture({ batch: {
    state: 'completed', imported: 0, failed: 1,
    items: [{ fileName: 'lost.txt', state: 'failed', failure: { code: 'recoveryPending', message: 'unknown' } }],
  } });
  const outcome = await new BookshelfFlowGateway({}).importPreparedSelections([{ state: 'ready' }]);
  assert.equal(outcome.batch, batch);
  assert.equal(outcome.readback.fact, 'pendingReconciliation');
  assert.equal(outcome.operation.fact, 'pendingReconciliation');
}

{
  const { BookshelfFlowGateway, calls, batch } = flowFixture();
  const gateway = new BookshelfFlowGateway({});
  const outcome = await gateway.importPreparedSelections([{ state: 'ready' }]);
  assert.equal(outcome.batch, batch, 'the committed batch is returned unchanged');
  assert.equal(outcome.readback.fact, 'confirmedCurrent');
  assert.equal(outcome.operation.fact, 'current');
  assert.equal(outcome.operation.hasValue, true);
  assert.equal(outcome.refreshWarning, undefined);
  assert.ok(outcome.shelf !== undefined);
  assert.equal(calls.imports, 1);
  assert.equal(calls.loads, 1);
}

{
  // The shelf refresh rejects after the batch committed. The batch must NOT be
  // swallowed by the rejection: the outcome resolves with the batch, a
  // confirmed/refresh-failed projection, and no fabricated shelf.
  const { BookshelfFlowGateway, calls, batch } = flowFixture({ failLoad: true });
  const gateway = new BookshelfFlowGateway({});
  const outcome = await gateway.importPreparedSelections([{ state: 'ready' }]);
  assert.equal(outcome.batch, batch,
    'a refresh failure must not swallow the committed per-file batch');
  assert.equal(outcome.shelf, undefined,
    'a failed refresh must not fabricate an empty or stale shelf');
  assert.equal(outcome.readback.fact, 'confirmedRefreshFailed');
  assert.equal(outcome.readback.message, '已确认，刷新失败');
  assert.equal(outcome.operation.fact, 'refreshFailed');
  assert.equal(outcome.operation.canRetry, true);
  assert.equal(outcome.operation.hasValue, false);
  assert.match(outcome.refreshWarning, /导入已确认，书架刷新失败/);
  assert.match(outcome.refreshWarning, /bookshelf\.list transport exploded/);
  assert.equal(calls.imports, 1, 'the refresh failure must not re-dispatch the import');
  assert.equal(calls.loads, 1, 'the refresh was attempted exactly once');
}

{
  // Mutation negative: flipping only the load outcome flips only the readback
  // fact, never the committed batch.
  const ok = flowFixture();
  const bad = flowFixture({ failLoad: true });
  const okOutcome = await new ok.BookshelfFlowGateway({}).importPreparedSelections([{ state: 'ready' }]);
  const badOutcome = await new bad.BookshelfFlowGateway({}).importPreparedSelections([{ state: 'ready' }]);
  assert.deepEqual(
    { state: okOutcome.batch.state, imported: okOutcome.batch.imported, failed: okOutcome.batch.failed },
    { state: badOutcome.batch.state, imported: badOutcome.batch.imported, failed: badOutcome.batch.failed },
    'the committed batch is identical whether or not the refresh succeeds',
  );
  assert.notEqual(okOutcome.readback.fact, badOutcome.readback.fact);
  assert.equal(okOutcome.readback.fact, 'confirmedCurrent');
  assert.equal(badOutcome.readback.fact, 'confirmedRefreshFailed');
  assert.equal(okOutcome.operation.fact, 'current');
  assert.equal(badOutcome.operation.fact, 'refreshFailed');
}

console.log('commit/readback facts (ReaderOperationFacts, FS-021 saveEditor, LS-031 importPreparedSelections): PASS');
