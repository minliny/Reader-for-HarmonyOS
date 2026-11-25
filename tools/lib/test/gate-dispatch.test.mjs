import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { contractCaseSelection, contractListView, contractTests } from '../../run-contract-tests.mjs';
import { gateResourceDefinitionSha256 } from '../gate-resource-definition.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const events = (output, kind) => output.split(/\r?\n/).flatMap(line => {
  if (!line.startsWith('{')) return [];
  try {
    const row = JSON.parse(line);
    return row.stage === kind ? [row] : [];
  } catch { return []; }
});

function fixture(t) {
  const workspace = mkdtempSync(join(tmpdir(), 'reader-gate-dispatch-test-'));
  const root = join(workspace, 'Reader-for-HarmonyOS');
  const tools = join(root, 'tools');
  const runnerTemp = join(workspace, 'runner-temp');
  mkdirSync(join(tools, 'lib'), { recursive: true });
  mkdirSync(runnerTemp);
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  for (const file of ['gate-index.mjs', 'run-contract-tests.mjs', 'lib/contract-case-selection.mjs', 'lib/gate-resource-definition.mjs']) {
    copyFileSync(new URL('../../' + file, import.meta.url), join(tools, file));
  }
  const writeJSON = (name, data) => writeFileSync(join(tools, name), JSON.stringify(data));
  writeJSON('retired-contract-tests.json', { schemaVersion: 1, entries: [] });
  const tiers = { schemaVersion: 1, source: [], integration: [], pending: [] };
  const cases = { schemaVersion: 1, files: {}, legacy: {} };
  const catalog = { schemaVersion: 1, entries: [], caseEntries: [], reviewedDefinitionsFrozen: true };
  const addTest = (file, code, { ids, pending = false } = {}) => {
    const source = ids ? [
      "import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';",
      "import { writeFileSync } from 'node:fs';",
      'for (const id of selectContractCases(' + JSON.stringify(Object.fromEntries(
        ids.map(id => [id, { description: id }]))) + ')) {',
      code,
      'recordContractCasePass(id);',
      '}',
    ].join('\n') : code;
    writeFileSync(join(tools, file), source);
    (pending ? tiers.pending : tiers.source).push(file);
    if (ids) {
      cases.files[file] = { sourceSha256: sha(source), cases: Object.fromEntries(ids.map(id =>
        [id, { qualification: 'QUALIFIED', resources: [] }])) };
    } else {
      cases.legacy[file] = { resources: [] };
    }
  };
  const addGate = (id, file, { caseId, stale = false, definitionInputs = [], ...fields } = {}) => {
    const parent = { id, file: 'tools/' + file, qualification: caseId ? 'NAVIGATION' : 'QUALIFIED',
      tests: [file], necessityReason: 'synthetic reviewed scope' };
    catalog.entries.push(parent);
    const entry = caseId ? {
      ...parent, id: id + '#' + caseId, parentId: id, qualification: 'QUALIFIED',
      caseId, caseSelection: { [file]: [caseId] },
    } : parent;
    Object.assign(entry, fields, { definitionInputs: [...definitionInputs,
      { path: 'tools/' + file, sha256: stale ? '0'.repeat(64) : sha(readFileSync(join(tools, file))) }] });
    entry.resourceDefinitionSha256 = gateResourceDefinitionSha256(cases, entry);
    if (caseId) catalog.caseEntries.push(entry);
  };
  const save = () => {
    writeJSON('contract-test-tiers.json', tiers);
    writeJSON('contract-case-manifest.json', cases);
    writeJSON('gate-index.json', catalog);
  };
  const environment = { ...process.env, TMPDIR: runnerTemp, TMP: runnerTemp, TEMP: runnerTemp,
    READER_CONTRACT_TEST_TIMEOUT_MS: '5000', READER_CONTRACT_TEST_WORKERS: '1' };
  delete environment.READER_CONTRACT_RESULTS_FILE;
  delete environment.READER_CONTRACT_SCOPE_TIMEOUT_MS;
  delete environment.READER_CORE_ROOT;
  delete environment.READER_SOURCE_SWITCH_CORE_ROOT;
  const run = (script, args, environmentOverrides = {}) => spawnSync(process.execPath, [script, ...args],
    { cwd: root, env: { ...environment, ...environmentOverrides }, encoding: 'utf8', timeout: 15_000 });
  return { root, workspace, environment, cases, catalog, tiers, addTest, addGate, save, run };
}

test('gate lookup and exact dispatch share admission while a failed ID leaves siblings isolated', t => {
  const f = fixture(t);
  const blocked = join(f.root, 'blocked');
  const pending = join(f.root, 'pending');
  const scoped = join(f.root, 'scope');
  f.addTest('test-blocked.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync(" + JSON.stringify(blocked) + ", 'unexpected');");
  f.addTest('test-pass.mjs', 'writeFileSync(' + JSON.stringify(scoped) + ', id);',
    { ids: ['chosen', 'unselected'] });
  f.addTest('test-fail.mjs', "throw new Error('intentional fixture failure');");
  f.addTest('test-after.mjs', "console.log('independent after failure');");
  f.addTest('test-pending.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync(" + JSON.stringify(pending) + ", 'unexpected');",
    { pending: true });
  f.addGate('H-stale', 'test-blocked.mjs', { stale: true });
  f.addGate('H-no-case', 'test-pass.mjs');
  f.addGate('H-invalid-case', 'test-pass.mjs', { caseId: 'chosen' });
  f.addGate('H-exact', 'test-pass.mjs', { caseId: 'chosen' });
  f.addGate('H-failure', 'test-fail.mjs');
  f.addGate('H-after', 'test-after.mjs');
  f.addGate('H-pending', 'test-pending.mjs');
  delete f.catalog.caseEntries[0].caseSelection;
  f.save();
  const ids = ['H-stale', 'H-no-case', 'H-invalid-case#chosen', 'H-exact#chosen', 'H-failure', 'H-after', 'H-pending'];
  const lookup = f.run('tools/gate-index.mjs', ids.flatMap(id => ['--id', id]));
  assert.equal(lookup.status, 0, lookup.stderr);
  assert.deepEqual(JSON.parse(lookup.stdout).entries.map(row => [row.admission.status, row.execution]),
    [['BLOCKED', 'NOT_RUN'], ['BLOCKED', 'NOT_RUN'], ['BLOCKED', 'NOT_RUN'], ['READY', 'NOT_RUN'],
      ['READY', 'NOT_RUN'], ['READY', 'NOT_RUN'], ['BLOCKED', 'NOT_RUN']]);
  assert.equal(existsSync(scoped), false);

  const selection = [...ids.slice(0, 2), 'H-unknown', ...ids.slice(2)];
  const mixedLookup = f.run('tools/gate-index.mjs', selection.flatMap(id => ['--id', id]));
  assert.equal(mixedLookup.status, 1, mixedLookup.stderr);
  const lookedUp = JSON.parse(mixedLookup.stdout).entries;
  assert.deepEqual(lookedUp.map(row => row.id), selection);
  assert.match(lookedUp[2].admission.reason, /Unknown gate/u);
  assert.match(lookedUp[3].admission.reason, /Invalid focused case identity/u);
  const result = f.run('tools/gate-index.mjs', [...selection.flatMap(id => ['--id', id]), '--run', '--change', 'independent outcomes']);
  assert.equal(result.status, 1, result.stderr);
  const outcomes = events(result.stdout, 'explicitGateResult');
  assert.deepEqual(outcomes.map(row => [row.id, row.status]), selection.map((id, index) =>
    [id, ['BLOCKED', 'BLOCKED', 'BLOCKED', 'BLOCKED', 'PASS', 'FAIL', 'PASS', 'BLOCKED'][index]]));
  assert.match(outcomes[0].reason, /changed definition/u);
  assert.match(outcomes[1].reason, /focused case selection required/u);
  assert.match(outcomes[2].reason, /Unknown gate/u);
  assert.match(outcomes[3].reason, /Invalid focused case identity/u);
  assert.deepEqual(read(outcomes[4].runnerReceipt).caseSelection, { 'test-pass.mjs': ['chosen'] });
  assert.equal(read(outcomes[5].runnerReceipt).selectedStatus, 'FAIL');
  assert.equal(readFileSync(scoped, 'utf8'), 'chosen');
  assert.equal(existsSync(blocked), false);
  assert.equal(existsSync(pending), false);
});

test('one reviewed case can adopt current test bytes while sibling identity stays frozen', t => {
  const f = fixture(t);
  const focused = 'test-focus.mjs';
  f.addTest(focused, 'console.log(id);', { ids: ['reviewed', 'sibling'] });
  const file = f.cases.files[focused];
  file.cases.reviewed.sourceSha256 = file.sourceSha256;
  file.sourceSha256 = '0'.repeat(64);
  f.addGate('H-reviewed', focused, { caseId: 'reviewed' });
  f.addGate('H-sibling', focused, { caseId: 'sibling' });
  f.save();
  const result = f.run('tools/gate-index.mjs', ['--id', 'H-reviewed#reviewed', '--id', 'H-sibling#sibling',
    '--run', '--change', 'scoped definition review']);
  assert.equal(result.status, 1, result.stderr);
  const outcomes = events(result.stdout, 'explicitGateResult');
  assert.deepEqual(outcomes.map(row => row.status), ['PASS', 'BLOCKED']);
  assert.match(outcomes[1].reason, /reviewed case\/resource definition changed/u);
});

test('compact static imports keep case selection and nested test admission exact', t => {
  const f = fixture(t);
  const focused = 'test-compact.mjs';
  f.addTest(focused, "assert.ok(id);", { ids: ['chosen'] });
  const path = join(f.root, 'tools', focused);
  const source = readFileSync(path, 'utf8').replace(/^import .*\n/u,
    "import{selectContractCases,recordContractCasePass}from'./lib/contract-case-selection.mjs';\nimport assert from 'node:assert/strict';\n");
  writeFileSync(path, source);
  f.cases.files[focused].sourceSha256 = sha(source);
  f.addTest('test-inner.mjs', 'export const value = true;');
  f.addTest('test-compact-import.mjs', "import'./test-inner.mjs';");
  f.addTest('test-compact-export.mjs', "export{value}from'./test-inner.mjs';");
  f.addGate('H-compact-focused', focused, { caseId: 'chosen' });
  f.addGate('H-compact-without-case', focused);
  f.addGate('H-compact-nested-import', 'test-compact-import.mjs');
  f.addGate('H-compact-nested-export', 'test-compact-export.mjs');
  f.save();

  const result = f.run('tools/gate-index.mjs', ['--id', 'H-compact-focused#chosen', '--id', 'H-compact-without-case',
    '--id', 'H-compact-nested-import', '--id', 'H-compact-nested-export', '--run', '--change', 'reviewed compact static declarations']);
  assert.equal(result.status, 1, result.stderr);
  const outcomes = events(result.stdout, 'explicitGateResult');
  assert.deepEqual(outcomes.map(row => row.status), ['PASS', 'BLOCKED', 'BLOCKED', 'BLOCKED']);
  assert.match(outcomes[1].reason, /focused case selection required/u);
  for (const outcome of outcomes.slice(2)) assert.match(outcome.reason, /explicit selection also requires imported test test-inner\.mjs/u);
});

test('a named scope dispatches only its exact reviewed default and leaves pending discovery out', t => {
  const f = fixture(t);
  const focused = 'test-focus.mjs';
  f.addTest(focused, "if (id === 'first') console.log('actual first case');",
    { ids: ['first', 'second'] });
  f.addTest('test-late.mjs', 'throw Error("omitted")', { pending: true });
  f.tiers.scopes = { 'manga-image-cache': [focused] };
  f.tiers.scopeCases = { 'manga-image-cache': { [focused]: ['first'] } };
  f.save();
  const list = contractListView(f.root);
  assert.deepEqual(list.availableTests, [focused]);
  assert.deepEqual(list.pendingTests, ['test-late.mjs']);
  assert.deepEqual(list.scopeAdmissions, [{ scope: 'manga-image-cache', status: 'READY',
    caseSelection: { [focused]: ['first'] } }]);
  assert.deepEqual(contractTests(f.root, 'full', 'manga-image-cache').selected, [focused]);
  assert.throws(() => contractCaseSelection(f.root, [focused]), /focused case selection required/u);
  const runScope = (name, override) => {
    const receipt = join(f.root, name + '.json');
    const runner = f.run('tools/run-contract-tests.mjs', ['--scope', 'manga-image-cache', '--rationale', 'fixture exact routing',
      '--results-file', receipt, ...(override ? ['--cases', focused + '#' + override] : [])]);
    assert.equal(runner.status, 0, runner.stderr);
    return read(receipt);
  };
  assert.deepEqual(runScope('scope-default').caseSelection, { [focused]: ['first'] });
  assert.deepEqual(runScope('scope-explicit', 'second').results[0].caseReceipts.map(row => row.case), ['second']);
  f.tiers.scopeCases = {};
  f.save();
  assert.deepEqual(contractListView(f.root).availableScopes, []);
  const blocked = f.run('tools/run-contract-tests.mjs', ['--scope', 'manga-image-cache', '--rationale', 'missing reviewed selector']);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /focused case selection required/u);
});

test('the local CLI uses the same listing and forwards exact scope selectors to the runner', t => {
  const f = fixture(t);
  const focused = 'test-subset.mjs';
  f.addTest(focused, "console.log('running case', id);", { ids: ['default', 'specified'] });
  f.addTest('test-pending.mjs', "throw Error('must stay unselected')", { pending: true });
  f.tiers.scopes = { 'manga-image-cache': [focused] };
  f.tiers.scopeCases = { 'manga-image-cache': { [focused]: ['default'] } };
  f.save();
  mkdirSync(join(f.root, 'scripts'));
  copyFileSync(new URL('../../../scripts/check-local.mjs', import.meta.url), join(f.root, 'scripts/check-local.mjs'));
  symlinkSync(fileURLToPath(new URL('../../../../Reader-Core/', import.meta.url)), join(f.workspace, 'Reader-Core'), 'junction');
  const git = args => execFileSync('git', args, { cwd: f.root, stdio: 'ignore' });
  git(['init', '-q']);
  git(['add', '.']);
  git(['-c', 'user.name=Reader fixture', '-c', 'user.email=reader@example.invalid', 'commit', '-qm', 'synthetic readiness']);
  const list = f.run('scripts/check-local.mjs', ['--list']);
  assert.equal(list.status, 0, list.stderr);
  const listing = JSON.parse(list.stdout);
  assert.deepEqual(listing.availableTests, [focused]);
  assert.deepEqual(listing.pendingTests, ['test-pending.mjs']);
  assert.equal(listing.scopeAdmissions[0].status, 'READY');
  const gateReceipt = join(f.workspace, 'local-gate', 'receipt.json');
  const result = f.run('scripts/check-local.mjs', ['--contracts-scope', 'manga-image-cache', '--cases',
    focused + '#specified', '--rationale', 'fixture local exact-selector forwarding'],
  { READER_HARMONY_GATE_RECEIPT: gateReceipt });
  assert.equal(result.status, 0, result.stderr);
  const receipt = read(gateReceipt);
  assert.equal(receipt.status, 'PASS');
  const execution = read(receipt.contracts.execution.path);
  assert.deepEqual(execution.caseSelection, { [focused]: ['specified'] });
  assert.deepEqual(execution.results[0].caseReceipts.map(row => row.case), ['specified']);
});

test('exact gate cancellation is forwarded to its running test and stops remaining IDs', { skip: process.platform === 'win32' }, async t => {
  const f = fixture(t);
  const ready = join(f.root, 'ready');
  const signalled = join(f.root, 'signalled');
  const later = join(f.root, 'later');
  f.addTest('test-wait.mjs', "import { writeFileSync } from 'node:fs';\nprocess.once('SIGTERM', () => { writeFileSync(" +
    JSON.stringify(signalled) + ", 'term'); process.exit(0); }); writeFileSync(" + JSON.stringify(ready) +
    ", 'ready'); await new Promise(done => setTimeout(done, 4000));");
  f.addTest('test-later.mjs', "import { writeFileSync } from 'node:fs'; writeFileSync(" + JSON.stringify(later) + ", 'unexpected');");
  f.addGate('H-wait', 'test-wait.mjs');
  f.addGate('H-later', 'test-later.mjs');
  f.save();
  const child = spawn(process.execPath, ['tools/gate-index.mjs', '--id', 'H-wait', '--id', 'H-later', '--run',
    '--change', 'fixture cancellation'], { cwd: f.root, env: f.environment, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; });
  child.stderr.on('data', data => { stderr += data; });
  const closed = once(child, 'close');
  let settled;
  try {
    for (let count = 0; count < 300 && !existsSync(ready); count++) await setTimeout(10);
    assert.ok(existsSync(ready), stderr);
    child.kill('SIGTERM');
    settled = await closed;
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await closed;
    }
  }
  assert.deepEqual(settled, [143, null], stderr);
  assert.equal(readFileSync(signalled, 'utf8'), 'term');
  assert.equal(existsSync(later), false);
  const [wait, laterGate] = events(stdout, 'explicitGateResult');
  assert.equal(wait.status, 'CANCELLED');
  assert.equal(laterGate.status, 'NOT_RUN');
  const receipt = read(wait.runnerReceipt);
  assert.equal(receipt.cancelled, true);
  assert.equal(receipt.selectedStatus, 'FAIL');
  assert.equal(receipt.treeSettled, true);
});

test('reviewed Core inputs bind the canonical root and the actual SDK or data it reads', t => {
  const f = fixture(t);
  const sdk = 'bindings/harmony/sdk/reader_core.ts';
  const localCore = join(f.workspace, 'Reader-Core');
  mkdirSync(join(localCore, 'bindings/harmony/sdk'), { recursive: true });
  writeFileSync(join(localCore, sdk), 'export const fixtureOnly = true;\n');
  writeFileSync(join(localCore, 'labels.json'), '{"fixtureOnly":true}\n');
  const dataInput = { path: '../Reader-Core/labels.json', sha256: sha(readFileSync(join(localCore, 'labels.json'))) };
  const executionEnvRoots = { READER_CORE_ROOT: '../Reader-Core' };
  f.addTest('test-core.mjs', "import assert from 'node:assert/strict'; import { realpathSync } from 'node:fs'; " +
    "import { resolve } from 'node:path'; import { pathToFileURL } from 'node:url'; " +
    'const core = process.env.READER_CORE_ROOT; ' +
    'assert.equal(realpathSync(core), realpathSync(' + JSON.stringify(localCore) + ')); ' +
    'const sdk = await import(pathToFileURL(resolve(core, ' + JSON.stringify(sdk) + ')).href); ' +
    'assert.equal(sdk.fixtureOnly, true);');
  f.addTest('test-core-data.mjs', "import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'; " +
    "import { resolve } from 'node:path'; const core = process.env.READER_CORE_ROOT; " +
    "assert.equal(JSON.parse(readFileSync(resolve(core, 'labels.json'), 'utf8')).fixtureOnly, true);");
  f.addGate('H-unbound-core', 'test-core.mjs');
  f.addGate('H-unbound-sdk', 'test-core.mjs', { executionEnvRoots, definitionInputs: [dataInput] });
  f.addGate('H-bound-core', 'test-core.mjs', {
    executionEnvRoots,
    definitionInputs: [{ path: '../Reader-Core/' + sdk, sha256: sha(readFileSync(join(localCore, sdk))) }],
  });
  f.addGate('H-bound-data', 'test-core-data.mjs', { executionEnvRoots, definitionInputs: [dataInput] });
  f.save();
  const look = f.run('tools/gate-index.mjs', ['--id', 'H-unbound-core', '--id', 'H-unbound-sdk',
    '--id', 'H-bound-core', '--id', 'H-bound-data']);
  const lookedUp = JSON.parse(look.stdout).entries;
  assert.deepEqual(lookedUp.map(row => row.admission.status), ['BLOCKED', 'BLOCKED', 'READY', 'READY']);
  assert.match(lookedUp[0].admission.reason, /unbound Core fixture/u);
  assert.match(lookedUp[1].admission.reason, /unbound Core SDK definition/u);
  const args = ['--id', 'H-bound-core', '--run', '--change', 'fixture input root'];
  const changed = f.run('tools/gate-index.mjs', args, { READER_CORE_ROOT: f.workspace });
  assert.equal(changed.status, 1);
  assert.match(events(changed.stdout, 'explicitGateResult')[0].reason, /different fixture root/u);
  const eligible = f.run('tools/gate-index.mjs', ['--id', 'H-bound-data', ...args]);
  assert.equal(eligible.status, 0, eligible.stderr);
  assert.deepEqual(events(eligible.stdout, 'explicitGateResult').map(row => row.status), ['PASS', 'PASS']);
});
