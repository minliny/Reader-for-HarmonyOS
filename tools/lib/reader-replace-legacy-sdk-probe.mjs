import { resolveEtsLoaderRoot } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { compile, fixture, until } from './rules-mutation-durable-probe.mjs';

// Execute the existing complete domain Owner/Gateway and AtomicFile thin seam
// with the installed HarmonyOS SDK emitter. Avoid pulling platform bootstrap
// and BundledSourceLedger into Node's unsupported strip-only dependency graph.
export const readerReplaceSdkFixture = existing => fixture(true, existing);
export const untilReaderReplaceSdk = until;
const path = 'features/reading/ReaderControlReplaceGateway.ts';
const source = readFileSync(new URL('../../entry/src/main/ets/' + path, import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(sdk + '/node_modules/typescript');
const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
assert.deepEqual(tree.parseDiagnostics, [], 'actual partial-update gateway SDK syntax');
const selected = ['changed', 'readerControlReplaceDraftParams'].map(name => {
  const node = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(node, 'actual production function ' + name);
  return node.getText(tree);
}).join('\n');
export const readerControlReplaceDraftParams = compile(path, 'readerControlReplaceDraftParams', {}, true, selected);
export { compile as compileReaderReplaceSdkMethods };

/** Real ArkUI SDK Builder/native callback; only platform rendering nodes are
 * observed. Deliberately keep old physical callbacks after the keyed actor
 * changes, rather than assuming the platform has already disposed them. */
export async function mountReaderReplaceRecoveryActor(values, sourceOverride) {
  const { createReaderBuilderProbe } = await import('./reader-control-builder-probe.mjs');
  const { readerControlReplaceEndpoint } = await import('../../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
  const source = sourceOverride ?? readFileSync(new URL('../../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets', import.meta.url), 'utf8');
  const { owner } = createReaderBuilderProbe(source,
    ['originalRecoveryAction', 'textAction', 'reload', 'perform', 'fullInput', 'quickInput'],
    { errorMessageOf: error => error.message, readerControlReplaceEndpoint });
  Object.assign(owner, { appThemeScheme: 'day', localError: '', localPending: false,
    interactionEnabled: true, presentationRevision: 0, motionProgress: 1, ...values });
  owner.originalRecoveryAction();
  return owner;
}
export async function checkReaderReplaceRecoveryActor(sourceOverride) {
  const { createReaderControlReplaceState, createReaderControlReplaceDraft } =
    await import('../../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
  const draft = createReaderControlReplaceDraft(); draft.name = 'original retained draft';
  const calls = [];
  const owner = await mountReaderReplaceRecoveryActor({ state: { ...createReaderControlReplaceState('book:1'), status: 'ready',
    writeUncertain: true, writeOperationId: 'exact-original-A' }, draft, layer: 'editor',
    appThemeScheme: 'day', localError: '', localPending: false, interactionEnabled: true,
    presentationRevision: 0, motionProgress: 1, onReload: async id => { calls.push(id); } }, sourceOverride);
  const oldActor = [...owner.nodes.values()].find(n => n.type === 'Text');
  assert.equal(oldActor.create, '核对原规则操作');
  assert.equal(oldActor.fontSize, 11); assert.equal(oldActor.borderRadius, 6);
  oldActor.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['exact-original-A']);
  assert.strictEqual(owner.draft, draft); assert.equal(owner.layer, 'editor');
  assert.equal(owner.state.writeUncertain, true, 'rendered query action never claims a durable receipt by itself');

  owner.state = { ...owner.state, writeOperationId: 'exact-original-B', recoveryLabel: '重试已保留的原规则操作' };
  owner.originalRecoveryAction();
  const newActor = [...owner.nodes.values()].findLast(n => n.type === 'Text');
  assert.notStrictEqual(newActor, oldActor, 'only the finite operation action is keyed to the new exact identity');
  assert.equal(newActor.create, '重试已保留的原规则操作');
  oldActor.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['exact-original-A'], 'old physical actor cannot query or continue another intent');
  newActor.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['exact-original-A', 'exact-original-B']);
  for (const field of ['localPending', 'mutationPending']) {
    if (field === 'localPending') owner.localPending = true; else owner.state.mutationPending = true;
    newActor.onClick(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 2, 'retained native callback observes current ' + field);
    if (field === 'localPending') owner.localPending = false; else owner.state.mutationPending = false;
  }
  owner.state = { ...owner.state, writeOperationId: undefined, writeUncertain: false };
  newActor.onClick(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 2, 'settled operation rejects its old physical callback');
  assert.strictEqual(owner.draft, draft); assert.equal(owner.layer, 'editor');
  return { callbacks: 2, oldActorRejected: true, pendingRejected: true, retainedDraft: true };
}
