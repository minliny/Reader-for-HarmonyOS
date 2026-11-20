import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { EventEmitter } from 'node:events';
import { parseLayout, indexLayout, evaluateLayout, assertionSummary, boundsVp, effectivelyVisible } from './ui-verification/layout-snapshot.mjs';
import { parseArgs, verifyScenario, exitCodeFor, expectedFailureMatches, validateScenario, waitTargetState } from './ui-verification/run-ui-verification.mjs';

const node = (id, bounds, extra = {}) => ({ attributes: { id, bounds, ...extra }, children: [] });
const tree = {
  attributes: { id: 'root', bounds: '[0,0][1317.6,2808]', visible: 'true', enabled: 'true' },
  children: [
    node('root', '[0,0][1317.6,2808]'),
    node('reader-verify-directory-root', '[0,0][1317.6,2808]', { visible: 'true' }),
    node('reader-verify-directory-tab', '[0,0][1317.6,172.8]', { visible: 'true' }),
    node('reader-verify-directory-toolbar', '[0,0][1317.6,172.8]', { visible: 'true' }),
    node('reader-verify-directory-viewport', '[0,172.8][1317.6,1000]', { visible: 'true' }),
    node('reader-verify-directory-footer', '[0,1000][1317.6,1172.8]', { visible: 'true' }),
    node('reader-verify-directory-row-0', '[0,200][1300,400]'),
  ],
};
const layoutText = JSON.stringify(tree);
const parsed = parseLayout(layoutText);
const index = indexLayout(parsed);
assert.equal(index.nodes.get('reader-verify-directory-root').visible, true);
assert.equal(index.duplicates.get('root'), 2, 'duplicate ids stay visible to the evaluator');
assert.deepEqual(boundsVp(index.nodes.get('reader-verify-directory-toolbar').bounds, 3.6).height.toFixed(1), '48.0');
assert.throws(() => parseLayout(''), /empty input/);
assert.throws(() => parseLayout('{'), /invalid JSON/);
assert.throws(() => parseLayout('[]'), /exactly one/);
const arrayBounds = parseLayout(JSON.stringify({ attributes: { id: 'a', bounds: [1, 2, 11, 22] }, children: [] }));
assert.deepEqual(boundsVp(arrayBounds.bounds, 2), { left: .5, top: 1, right: 5.5, bottom: 11, width: 5, height: 10 });
console.log('PASS layout parse, duplicate and vp conversion');

const ok = evaluateLayout(parsed, {
  nodes: [
    { id: 'reader-verify-directory-root', visible: true, widthVp: 366, minHeightVp: 700 },
    { id: 'reader-verify-directory-toolbar', minHeightVp: 44 },
    { id: 'reader-verify-directory-viewport', minHeightVp: 100 },
    { id: 'reader-verify-directory-row-0', minHeightVp: 44 },
    { id: 'reader-verify-missing', exists: false },
  ],
  order: [['reader-verify-directory-toolbar', 'reader-verify-directory-viewport']],
}, { density: 3.6 });
assert.equal(ok.ok, true, assertionSummary(ok));
const wrong = evaluateLayout(parsed, { nodes: [{ id: 'reader-verify-directory-root', widthVp: 320 }] }, { density: 3.6 });
assert.equal(wrong.ok, false);
assert.match(assertionSummary(wrong), /widthVp/);
const missingDensity = evaluateLayout(parsed, { nodes: [{ id: 'reader-verify-directory-root', minHeightVp: 1 }] }, {});
assert.equal(missingDensity.ok, false, 'missing density must not assume a default');
const duplicateExpectation = evaluateLayout(parsed, { nodes: [{ id: 'root', count: 2 }] }, { density: 3.6 });
assert.equal(duplicateExpectation.ok, true, 'explicit duplicate count is observable');
const duplicateRejected = evaluateLayout(parsed, { nodes: [{ id: 'root' }] }, { density: 3.6 });
assert.equal(duplicateRejected.ok, false);
const hiddenChrome = parseLayout(JSON.stringify({ attributes: { id: 'root', bounds: '[0,0][1317.6,2808]' }, children: [
  { attributes: { id: 'chrome', bounds: '[0,0][1317.6,240]', visible: 'true', enabled: 'false', opacity: '0.000000' }, children: [
    node('reader-verify-directory-toolbar', '[0,0][1317.6,172.8]', { visible: 'true' }),
  ] },
] }));
assert.equal(effectivelyVisible(indexLayout(hiddenChrome).nodes.get('reader-verify-directory-toolbar')), false,
  'an ancestor faded to zero opacity is not clickable');
assert.equal(evaluateLayout(hiddenChrome, { nodes: [{ id: 'reader-verify-directory-toolbar', visible: true }] }, { density: 3.6 }).ok, false);
assert.equal(evaluateLayout(hiddenChrome, { nodes: [{ id: 'reader-verify-directory-toolbar', visible: false }] }, { density: 3.6 }).ok, true);
console.log('PASS ancestor opacity hides descendant targets');
const orderFailure = evaluateLayout(parsed, { order: [['reader-verify-directory-footer', 'reader-verify-directory-toolbar']] }, { density: 3.6 });
assert.equal(orderFailure.ok, false);
console.log('PASS assertion semantics, duplicate count, missing density and order');

const args = parseArgs(['--scenario', 'directory-control-expanded', '--target', 'mock-target', '--hdc', '/bin/sh',
  '--server', '127.0.0.1:8710', '--output-dir', '/tmp/ui-evidence', '--preflight-confirmed', '--expect-fail']);
assert.equal(args.scenario, 'directory-control-expanded');
assert.equal(args.preflightConfirmed, true);
assert.equal(args.expectFail, true);
assert.equal(args.expectFailStep, undefined);
const structured = parseArgs(['--scenario', 'directory-control-expanded', '--target', 'mock-target', '--hdc', '/bin/sh',
  '--server', '127.0.0.1:8710', '--output-dir', '/tmp/ui-evidence', '--preflight-confirmed', '--expect-fail',
  '--expect-fail-step', '8', '--expect-fail-check', 'reader-journey-chapter-title.textEqualsCapture']);
assert.equal(structured.expectFailStep, '8');
assert.deepEqual(structured.expectFailChecks, ['reader-journey-chapter-title.textEqualsCapture']);
assert.throws(() => parseArgs(['--scenario', 'x', '--target', 'x', '--hdc', '/bin/sh', '--server', '127.0.0.1:8710',
  '--output-dir', '/tmp/x', '--expect-fail-step', '1']), /require --expect-fail/);
assert.throws(() => parseArgs(['--scenario', 'x', '--target', 'x', '--hdc', '/bin/sh', '--server', '127.0.0.1:8710',
  '--output-dir', '/tmp/x', '--expect-fail', '--expect-fail-check', 'nofield']), /invalid --expect-fail-check/);
assert.throws(() => parseArgs(['--scenario', 'x']), /is required/);
assert.throws(() => parseArgs(['--scenario', 'x', '--target', 'x', '--hdc', 'relative', '--server', '127.0.0.1:8710', '--output-dir', '/tmp/x']),
  /absolute path/);
assert.throws(() => parseArgs(['--scenario', 'x', '--target', 'x', '--hdc', '/bin/sh', '--server', 'not-a-server',
  '--output-dir', '/tmp/x']), /server/);
assert.equal(exitCodeFor({ receipt: { verdict: 'FAIL', failure: { stage: 'ready', kind: 'assertion', step: null,
  checks: [{ id: 'reader-verify-directory-root', field: 'widthVp', expected: 366, actual: 320 }] } } }, true), 0,
'expected assertion failure is a successful negative check');
assert.equal(exitCodeFor({ receipt: { verdict: 'PASS' } }, true), 1, 'unexpected pass fails the negative check');
assert.equal(exitCodeFor({ receipt: { verdict: 'PASS' } }, false), 0);
assert.equal(exitCodeFor({ receipt: { verdict: 'FAIL', failure: { stage: 'action', kind: 'assertion', step: 3,
  checks: [] } } }, false), 1);
const negativeReceipt = { receipt: { verdict: 'FAIL', failure: { stage: 'action', kind: 'assertion', step: 3,
  checks: [{ id: 'reader-verify-directory-root', field: 'widthVp', expected: 366, actual: 320 }] } } };
assert.equal(exitCodeFor({ receipt: { verdict: 'FAIL', failure: { stage: 'action', kind: 'infrastructure', step: 3,
  checks: [] } } }, true), 1, 'infrastructure failure is never a proven negative');
assert.equal(exitCodeFor({ receipt: { verdict: 'FAIL', failure: { stage: 'action', kind: 'timeout', step: 3,
  checks: [] } } }, true), 1, 'a timeout is not a proven negative');
assert.equal(exitCodeFor(negativeReceipt, true, { step: 3 }), 0);
assert.equal(exitCodeFor(negativeReceipt, true, { step: 4 }), 1, 'the failure must occur at the declared step');
assert.equal(expectedFailureMatches({ verdict: 'FAIL', failure: { stage: 'ready', kind: 'assertion', step: null,
  checks: [] } }, { step: 'ready' }), true);
assert.equal(exitCodeFor(negativeReceipt, true,
  { checks: ['reader-verify-directory-root.widthVp'] }), 0);
assert.equal(exitCodeFor(negativeReceipt, true,
  { checks: ['reader-verify-directory-root.minHeightVp'] }), 1, 'unexpected failing fields are not that negative');
console.log('PASS CLI admission and expect-fail exit semantics');

const waitTree = parseLayout(JSON.stringify({ attributes: { id: 'root', bounds: '[0,0][100,100]' }, children: [
  node('wait-shown', '[0,0][10,10]', { visible: 'true' }),
  node('wait-hidden', '[0,0][10,10]', { visible: 'false' }),
  { attributes: { id: 'wait-faded', bounds: '[0,0][100,100]', visible: 'true', opacity: '0.000000' }, children: [
    node('wait-inside-faded', '[0,0][10,10]', { visible: 'true' }),
  ] },
] }));
assert.equal(waitTargetState(waitTree, { id: 'wait-shown', visible: true }), true);
assert.equal(waitTargetState(waitTree, { id: 'wait-shown', visible: false }), false,
  'a still-visible node cannot satisfy visible:false');
assert.equal(waitTargetState(waitTree, { id: 'wait-hidden', visible: false }), true);
assert.equal(waitTargetState(waitTree, { id: 'wait-inside-faded', visible: false }), true,
  'an ancestor faded to zero opacity counts as hidden');
assert.equal(waitTargetState(waitTree, { id: 'wait-missing', absent: true }), true);
assert.equal(waitTargetState(waitTree, { id: 'wait-missing', visible: false }), false,
  'absence and hidden presence are different wait states');
assert.equal(waitTargetState(waitTree, { id: 'wait-shown', absent: true }), false);
console.log('PASS waitFor distinguishes absent, hidden and visible');

for (const invalid of [
  { id: 'bad', scene: 'Directory', width: 366, readyId: 'x' },
  { id: 'bad', scene: 'menu', width: 321, readyId: 'x' },
  { id: 'bad', scene: 'menu', width: 366, readyId: '' },
  { id: 'bad', scene: 'menu', width: 366, readyId: 'x', actions: [{ op: 'key', key: 'Power' }] },
  { id: 'bad', scene: 'menu', width: 366, readyId: 'x', actions: [{ op: 'click', id: 'x',
    observe: { event: 'Bad_Event', stateIncludes: ['a'] } }] },
  { id: 'bad', scene: 'menu', width: 366, readyId: 'x', actions: [{ op: 'click', id: 'x',
    observe: { event: 'ok', stateIncludes: [] } }] },
  { id: 'bad', scene: 'menu', width: 366, readyId: 'x', actions: [{ op: 'click', id: 'x',
    observe: { event: 'ok', stateIncludes: ['a'], extra: true } }] },
  { id: 'bad', mode: 'normal', readyIdPrefix: 'x', width: 366,
    actions: [{ op: 'click', id: 'x', waitFor: { id: 'x', visible: true, absent: true } }] },
  { id: 'bad', mode: 'normal', readyIdPrefix: 'x', width: 366,
    actions: [{ op: 'click', id: 'x', waitFor: { id: 'x', absent: 'yes' } }] },
]) assert.throws(() => validateScenario(invalid));
console.log('PASS scenario admission rejects invalid scene/width/ready/action/observe');

const directory = mkdtempSync(join(tmpdir(), 'ui-verification-offline-'));
const observation = (kind, run, overrides = {}) => ({
  schema: 1, kind, run, scene: 'directory-control-expanded', requestedWidthVp: 366,
  actualWidthVp: 366, actualHeightVp: 780, systemFontScale: 1, densityPixels: 3.6,
  contentTopInsetVp: 0, font: { status: 'ready', following: true, maxScale: 3.2, scaleVp: 1 },
  state: { event: kind }, ...overrides,
});
function fakeProbe() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  const commands = [];
  let run;
  let clicked = false;
  const emit = record => queueMicrotask(() => child.stdout.emit('data', `${JSON.stringify(record)}\n`));
  const command = (args, stdout = '') => emit({ event: 'command', args, ok: true, stdout, stderr: '' });
  child.stdin = {
    write(line) {
      const operation = JSON.parse(line);
      if (operation.op === 'quit') return;
      if (operation.op === 'force-stop') return command(['shell', 'aa', 'force-stop', 'io.reader.minliny']);
      if (operation.op === 'verifyStart') {
        run = operation.run;
        return command(['shell', 'aa', 'start', '-a', 'EntryAbility', '-b', 'io.reader.minliny', '-m', 'entry',
          '--ps', 'readerVerifyScene', operation.scene, '--ps', 'readerVerifyWidth', String(operation.width),
          '--ps', 'readerVerifyRun', operation.run]);
      }
      if (operation.op === 'dumpLayout') return command(['shell', 'uitest', 'dumpLayout', '-p', operation.path]);
      if (operation.op === 'recv') return command(['file', 'recv', operation.path, join(directory, basename(operation.path))]);
      if (operation.op === 'verifyLog') {
        const lines = [`07-01 00:00:00.000  5244 5244 I A00000/ReaderVerify: READER_VERIFY ${JSON.stringify(observation('ready', run))}`];
        if (clicked) {
          lines.push(`07-01 00:00:01.000  5244 5244 I A00000/ReaderVerify: READER_VERIFY ${JSON.stringify(observation('summary', run, {
            state: { event: 'fixture-action-select-bookmark',
              selection: 'bookmarkId=demo chapter=21 offset=141 scope=fixture:0:21:fixture-body:fixture-processing' },
          }))}`);
        }
        return command(['shell', 'hilog', '-x', '-T', 'ReaderVerify'], `${lines.join('\n')}\n`);
      }
      if (operation.op === 'screenCap') return command(['shell', 'uitest', 'screenCap', '-p', operation.path]);
      if (operation.op === 'keyEvent') return command(['shell', 'uitest', 'uiInput', 'keyEvent', operation.key]);
      if (operation.op === 'click') {
        clicked = true;
        return command(['shell', 'uitest', 'uiInput', 'click', String(operation.x), String(operation.y)]);
      }
      throw new Error(`offline fake probe rejected ${operation.op}`);
    },
    end() { queueMicrotask(() => child.emit('close', 0, null)); },
  };
  child.kill = () => child.emit('close', 0, 'SIGKILL');
  queueMicrotask(() => child.stdout.emit('data', `${JSON.stringify({ event: 'ready' })}\n`));
  return { child, commands };
}
const scenario = {
  id: 'directory-control-expanded', scene: 'directory-control-expanded', width: 366,
  readyId: 'reader-verify-directory-root',
  expect: { nodes: [
    { id: 'reader-verify-directory-root', visible: true, widthVp: 366, minHeightVp: 700 },
    { id: 'reader-verify-directory-toolbar', minHeightVp: 44 },
    { id: 'reader-verify-directory-viewport', minHeightVp: 100 },
    { id: 'reader-verify-directory-row-0', minHeightVp: 44 },
  ], order: [['reader-verify-directory-toolbar', 'reader-verify-directory-viewport']] },
  actions: [{
    op: 'click', id: 'reader-verify-directory-row-0',
    observe: { event: 'fixture-action-select-bookmark', stateIncludes: ['chapter=21 offset=141', 'fixture-processing'] },
  }],
};
const options = { scenario: scenario.id, target: 'mock-target', hdc: '/bin/sh', server: '127.0.0.1:8710',
  outputDir: directory, preflightConfirmed: true, expectFail: false };
let clock = 0;
let runSequence = 0;
const deps = {
  scenario, scenarioSource: '/virtual/scenarios.json', probePath: '/virtual/probe.mjs',
  spawn: (_exec, _args, spawnOptions) => {
    assert.equal(spawnOptions.shell, false);
    assert.equal(spawnOptions.env.NO_PROXY, '*');
    assert.equal(spawnOptions.env.HTTP_PROXY, undefined);
    return fakeProbe().child;
  },
  readFile: (path, encoding) => {
    if (String(path).endsWith('.json')) return layoutText;
    if (String(path) === '/bin/sh') return Buffer.from('hdc-binary');
    return readFileSync(path, encoding);
  },
  now: () => clock, sleep: async ms => { clock += ms; },
  randomUUID: () => `ui-offline-run-000${++runSequence}`,
};
const result = await verifyScenario(options, deps);
assert.equal(result.receipt.verdict, 'PASS', result.receipt.error);
assert.equal(result.receipt.run, 'ui-offline-run-0001');
assert.equal(result.receipt.assertions.every(check => check.ok), true);
assert.equal(result.receipt.observation.kind, 'ready');
assert.equal(result.receipt.actions[0].observe.every(check => check.ok), true, 'app-logged intent must satisfy observe');
assert.ok(result.receipt.hdcSha256.length === 64);
assert.ok(result.receiptPath.endsWith('.json'));
console.log('PASS offline runner start/ready/layout/assertion/receipt flow');

const negative = await verifyScenario({ ...options, scenario: 'directory-control-expanded', expectFail: true },
  { ...deps, scenario: { ...scenario, expect: { nodes: [{ id: 'reader-verify-directory-root', widthVp: 320 }] } } });
assert.equal(negative.receipt.verdict, 'FAIL');
assert.equal(negative.receipt.failure.kind, 'assertion');
assert.equal(negative.receipt.failure.stage, 'ready');
assert.equal(exitCodeFor(negative, true), 0);
assert.equal(exitCodeFor(negative, true, { checks: ['reader-verify-directory-root.widthVp'] }), 0);
assert.equal(exitCodeFor(negative, true, { checks: ['reader-verify-directory-root.minHeightVp'] }), 1);
assert.ok(negative.receipt.assertions.some(check => !check.ok && check.id === 'reader-verify-directory-root'));
console.log('PASS offline flipped expectation yields FAIL with actual values');

const crashed = await verifyScenario({ ...options, expectFail: true }, { ...deps,
  spawn: () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.stdin = { write() {}, end() {} };
    child.kill = () => child.emit('close', 9, null);
    queueMicrotask(() => child.emit('close', 9, null));
    return child;
  },
});
assert.equal(crashed.receipt.verdict, 'FAIL');
assert.equal(crashed.receipt.failure.kind, 'infrastructure');
assert.equal(exitCodeFor(crashed, true), 1, 'a crashed probe cannot satisfy an expected failure');
console.log('PASS infrastructure failure is not accepted as an expected negative');

const flippedObserve = await verifyScenario({ ...options, expectFail: true }, { ...deps,
  scenario: { ...scenario, actions: [{ op: 'click', id: 'reader-verify-directory-row-0',
    observe: { event: 'fixture-action-select-chapter', stateIncludes: ['chapter=21'] } }] } });
assert.equal(flippedObserve.receipt.verdict, 'FAIL');
assert.equal(exitCodeFor(flippedObserve, true), 0);
assert.match(flippedObserve.receipt.error, /observation failed/);
console.log('PASS unchecked click intent without an app observation fails');

await assert.rejects(() => verifyScenario({ ...options, preflightConfirmed: false }, { ...deps, scenario }), /preflight-confirmed/);
console.log('PASS device run requires explicit preflight confirmation');

const scenarioSet = JSON.parse(readFileSync(new URL('./ui-verification/scenarios.json', import.meta.url), 'utf8'));
const normalScenario = scenarioSet.scenarios.find(candidate => candidate.id === 'normal-entry-position');
assert.ok(normalScenario, 'normal-entry-position is declared');
assert.equal(validateScenario(normalScenario).mode, 'normal');

const shelfCover = 'reader.bookshelf.cover:4:shelf:["source","book"]';
const shelfLayout = JSON.stringify({ attributes: { id: 'root', bounds: '[0,0][1317.6,2808]' }, children: [
  node('reader-journey-bookshelf-root', '[0,0][1317.6,2808]', { visible: 'true' }),
  node(shelfCover, '[40,300][300,620]', { visible: 'true', enabled: 'true' }),
] });
const readingLayout = (title, visible, controls) => JSON.stringify({
  attributes: { id: 'root', bounds: '[0,0][1317.6,2808]' }, children: [
    node('reader-journey-reading-surface', '[0,0][1317.6,2808]', { visible: 'true', enabled: 'true' }),
    node('reader-journey-chapter-title', '[300,100][1000,200]', { visible: visible ? 'true' : 'false', text: title }),
    ...(controls ? [
      node('reader-journey-next-chapter', '[1000,100][1100,200]', { visible: 'true', enabled: 'true' }),
      node('reader-journey-exit-reading', '[20,20][100,100]', { visible: 'true', enabled: 'true' }),
    ] : []),
  ],
});
const shelfAfterExit = JSON.stringify({ attributes: { id: 'root', bounds: '[0,0][1317.6,2808]' }, children: [
  node(shelfCover, '[40,300][300,620]', { visible: 'true', enabled: 'true' }),
] });

function fakeNormalProbe(finalTitle = 'Chapter 8') {
  const child = new EventEmitter();
  child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  let step = 0;
  let layout = shelfLayout;
  const emit = record => queueMicrotask(() => child.stdout.emit('data', `${JSON.stringify(record)}\n`));
  const command = (args, stdout = '') => emit({ event: 'command', args, ok: true, stdout, stderr: '' });
  const frame = () => {
    if (step === 0) return shelfLayout;
    if (step === 1) return readingLayout('Chapter 7', false, false);
    if (step === 2) return readingLayout('Chapter 7', true, true);
    if (step === 3) return readingLayout('Chapter 8', false, false);
    if (step === 4) return readingLayout('Chapter 8', true, true);
    if (step === 5) return shelfAfterExit;
    if (step === 6) return readingLayout(finalTitle, false, false);
    return readingLayout(finalTitle, true, true);
  };
  child.stdin = {
    write(line) {
      const operation = JSON.parse(line);
      if (operation.op === 'quit') return;
      if (operation.op === 'force-stop') return command(['shell', 'aa', 'force-stop', 'io.reader.minliny']);
      if (operation.op === 'startNormal') {
        assert.deepEqual(operation, { op: 'startNormal', preflightConfirmed: true });
        return command(['shell', 'aa', 'start', '-a', 'EntryAbility', '-b', 'io.reader.minliny', '-m', 'entry']);
      }
      if (operation.op === 'dumpLayout') {
        layout = frame();
        return command(['shell', 'uitest', 'dumpLayout', '-p', operation.path]);
      }
      if (operation.op === 'recv') return command(['file', 'recv', operation.path, join(directory, basename(operation.path))]);
      if (operation.op === 'click') {
        step += 1;
        return command(['shell', 'uitest', 'uiInput', 'click', String(operation.x), String(operation.y)]);
      }
      if (operation.op === 'screenCap') return command(['shell', 'uitest', 'screenCap', '-p', operation.path]);
      throw new Error(`normal fake probe rejected ${operation.op}`);
    },
    end() { queueMicrotask(() => child.emit('close', 0, null)); },
  };
  child.kill = () => child.emit('close', 0, 'SIGKILL');
  queueMicrotask(() => child.stdout.emit('data', `${JSON.stringify({ event: 'ready' })}\n`));
  return { child, layout: () => layout };
}

let normalProbe;
const normalDeps = {
  scenario: normalScenario, scenarioSource: '/virtual/scenarios.json', probePath: '/virtual/probe.mjs',
  spawn: () => { normalProbe = fakeNormalProbe(); return normalProbe.child; },
  readFile: (path, encoding) => {
    if (String(path).endsWith('.json')) return normalProbe.layout();
    if (String(path) === '/bin/sh') return Buffer.from('hdc-binary');
    return readFileSync(path, encoding);
  },
  now: () => clock, sleep: async ms => { clock += ms; },
  randomUUID: () => `ui-offline-run-000${++runSequence}`,
};
const normalOptions = { ...options, scenario: 'normal-entry-position' };
const normalResult = await verifyScenario(normalOptions, normalDeps);
assert.equal(normalResult.receipt.verdict, 'PASS', normalResult.receipt.error);
assert.equal(normalResult.receipt.mode, 'normal');
assert.equal(normalResult.receipt.startOp, 'startNormal');
assert.equal(normalResult.receipt.observation, null, 'normal entry has no fixture READY observation');
assert.equal(normalResult.receipt.captures.before, 'Chapter 7');
assert.equal(normalResult.receipt.captures.after, 'Chapter 8');
assert.equal(normalResult.receipt.actions[0].id, shelfCover);
assert.equal(normalResult.receipt.actions[2].op, 'capture');
assert.equal(normalResult.receipt.actions[2].text, 'Chapter 7');
assert.equal(normalResult.receipt.actions[3].id, 'reader-journey-next-chapter');
assert.equal(normalResult.receipt.actions[4].op, 'click');
assert.ok(normalResult.receipt.actions[4].checks.some(check => check.id === 'reader-journey-chapter-title' &&
  check.field === 'textNotEqualsCapture' && check.ok), 'the turned title must differ from the captured one');
assert.equal(normalResult.receipt.actions[5].op, 'capture');
assert.equal(normalResult.receipt.actions[5].text, 'Chapter 8');
assert.equal(normalResult.receipt.actions[6].id, 'reader-journey-exit-reading');
assert.equal(normalResult.receipt.actions.length, 9);
assert.ok(normalResult.receipt.actions.every(action => action.checks.every(check => check.ok)));
console.log('PASS offline normal-entry shelf/read/turn/exit/re-enter position journey');

const normalNegative = await verifyScenario({ ...normalOptions, expectFail: true }, {
  ...normalDeps,
  spawn: () => { normalProbe = fakeNormalProbe('Chapter 9'); return normalProbe.child; },
});
assert.equal(normalNegative.receipt.verdict, 'FAIL');
assert.match(normalNegative.receipt.error, /textEqualsCapture/);
assert.equal(normalNegative.receipt.captures.after, 'Chapter 8');
assert.equal(normalNegative.receipt.failure.step, 8);
assert.equal(exitCodeFor(normalNegative, true,
  { step: 8, checks: ['reader-journey-chapter-title.textEqualsCapture'] }), 0);
assert.equal(exitCodeFor(normalNegative, true,
  { step: 7, checks: ['reader-journey-chapter-title.textEqualsCapture'] }), 1);
console.log('PASS offline normal-entry position mismatch fails the re-entry assertion');

rmSync(directory, { recursive: true, force: true });
console.log('PASS ui verification runner offline self-test');
