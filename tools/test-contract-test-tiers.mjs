import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, copyFileSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { runContracts, runContractsBounded, contractTests, MAX_CONTRACT_TIMEOUT_MS, MAX_CONTRACT_KILL_GRACE_MS } from './run-contract-tests.mjs';

export async function runContractTierFixtures() {
contractTests(fileURLToPath(new URL('..', import.meta.url)), 'full');

const workspace = mkdtempSync(join(tmpdir(), 'reader-contract-gate-'));
const root = join(workspace, 'Reader-for-HarmonyOS');
mkdirSync(root);
symlinkSync(fileURLToPath(new URL('../../Reader-Core-Native', import.meta.url)), join(workspace, 'Reader-Core-Native'), 'junction');
try {
  mkdirSync(join(root, 'tools'));
  const manifest = { schemaVersion: 1, source: ['test-pass.mjs'], integration: ['test-fail.mjs'] };
  const save = () => writeFileSync(join(root, 'tools/contract-test-tiers.json'), JSON.stringify(manifest));
  writeFileSync(join(root, 'tools/test-pass.mjs'), 'process.exit(0)');
  writeFileSync(join(root, 'tools/test-fail.mjs'), 'process.exit(7)');
  save();
  runContracts(root, 'source');
  assert.throws(() => runContracts(root, 'full'), /test-fail.mjs failed \(7\)/);
  await assert.rejects(runContractsBounded(root, 'full', 2), /test-fail.mjs failed \(7\)/,
    'bounded full gate must retain the actual failure exit');
  await assert.rejects(runContractsBounded(root, 'full', 0), /workers/);
  await assert.rejects(runContractsBounded(root, 'full', 5), /workers/);
  assert.equal(MAX_CONTRACT_TIMEOUT_MS, 110_000, 'formal per-test deadline stays at 110 seconds');
  assert.equal(MAX_CONTRACT_KILL_GRACE_MS, 1_000, 'formal termination grace stays at one second');
  await assert.rejects(runContractsBounded(root, 'full', 1, { timeoutMs: 110_001 }), /invalid test deadline/,
    'imported options cannot extend the formal 110-second test deadline');
  await assert.rejects(runContractsBounded(root, 'full', 1, { killGraceMs: 1_001 }), /invalid termination grace/,
    'imported options cannot extend the formal one-second termination grace');
  writeFileSync(join(root, 'tools/test-new.mjs'), 'process.exit(0)');
  assert.throws(() => runContracts(root, 'source'), /every discovered test must be classified/);
  rmSync(join(root, 'tools/test-new.mjs'));
  manifest.source.push('test-fail.mjs'); save();
  assert.throws(() => runContracts(root, 'source'), /duplicate test classification/);
  manifest.source = []; manifest.integration = ['test-pass.mjs', 'test-fail.mjs']; save();
  assert.throws(() => runContracts(root, 'source'), /empty test tier/);
  await assert.rejects(runContractsBounded(root, 'source', 2), /empty test tier/);
  writeFileSync(join(root, 'tools/test-fail.mjs'), 'process.exit(0)');
  const completed = await runContractsBounded(root, 'full', 2);
  assert.deepEqual(completed.results.map(row => row.name).sort(), ['test-fail.mjs', 'test-pass.mjs']);
  assert.ok(completed.results.every(row => row.status === 0 && row.timedOut === false && row.termination.length === 0));

  // Scope is an explicit subset of the same complete, classified inventory.
  // Execute the real CLI against a fixture whose omitted child would fail.
  manifest.scopes = { 'manga-image-cache': ['test-pass.mjs'] }; save();
  writeFileSync(join(root, 'tools/test-fail.mjs'), 'process.exit(7)');
  assert.deepEqual(contractTests(root, 'full', 'manga-image-cache').selected, ['test-pass.mjs']);
  assert.deepEqual(contractTests(root, 'full', 'manga-image-cache').omitted, ['test-fail.mjs']);
  assert.equal(contractTests(root, 'full').selected.length, 2, 'default full never inherits the scope');
  assert.throws(() => contractTests(root, 'full', 'unknown'), /unknown contract scope/);
  assert.throws(() => contractTests(root, 'source', 'manga-image-cache'), /source tier/);
  manifest.scopes['manga-image-cache'] = []; save();
  assert.throws(() => contractTests(root, 'full'), /empty contract scope/);
  manifest.scopes['manga-image-cache'] = ['test-pass.mjs', 'test-pass.mjs']; save();
  assert.throws(() => contractTests(root, 'full'), /duplicate scope test/);
  manifest.scopes['manga-image-cache'] = ['test-not-declared.mjs']; save();
  assert.throws(() => contractTests(root, 'full'), /unclassified scope test/);
  manifest.scopes['manga-image-cache'] = ['test-pass.mjs']; save();
  writeFileSync(join(root, 'tools/test-new.mjs'), 'process.exit(0)');
  assert.throws(() => contractTests(root, 'full', 'manga-image-cache'), /every discovered test/);
  rmSync(join(root, 'tools/test-new.mjs'));
  const fixtureRunner = join(root, 'tools/run-contract-tests.mjs');
  copyFileSync(new URL('./run-contract-tests.mjs', import.meta.url), fixtureRunner);
  const resultsFile = join(root, 'cli-results.json');
  const cli = spawnSync(process.execPath, [fixtureRunner, '--scope', 'manga-image-cache', '--results-file', resultsFile,
    '--test-timeout-ms', '2000'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(cli.status, 0, cli.stderr); assert.match(cli.stdout, /full suite NOT_RUN/);
  const cliReport = JSON.parse(readFileSync(resultsFile, 'utf8'));
  assert.deepEqual(cliReport.selected, ['test-pass.mjs']); assert.deepEqual(cliReport.omitted, ['test-fail.mjs']);
  assert.equal(cliReport.results.length, 1); assert.equal(cliReport.results[0].status, 0);
  assert.equal(cliReport.scopeTimeoutMs, 110000); assert.equal(cliReport.scopeExpired, false); assert.deepEqual(cliReport.unrun, []);
  assert.ok(cliReport.millisecondsTotal <= cliReport.scopeTimeoutMs);
  for (const argv of [['--scope', 'manga-image-cache', '--test-timeout-ms', String(MAX_CONTRACT_TIMEOUT_MS + 1)],
    ['--scope', 'unknown'], ['--full', '--test-timeout-ms', '0'], ['--full', '--test-timeout-ms', '2', '--test-timeout-ms', '2']]) {
    const rejected = spawnSync(process.execPath, [fixtureRunner, ...argv], { encoding: 'utf8', timeout: 5000 });
    assert.notEqual(rejected.status, 0, 'invalid scope/deadline/duplicate cannot execute the fixture suite');
  }
  await assert.rejects(runContractsBounded(root, 'full', 1, { timeoutMs: MAX_CONTRACT_TIMEOUT_MS + 1 }), /invalid test deadline/);

  const nativeFixture = (label, scripts) => {
    const directory = join(root, label); mkdirSync(join(directory, 'tools'), { recursive: true });
    for (const [name, source] of Object.entries(scripts)) writeFileSync(join(directory, 'tools', name), source);
    writeFileSync(join(directory, 'tools/contract-test-tiers.json'), JSON.stringify({ schemaVersion: 1, source: Object.keys(scripts), integration: [] }));
    return directory;
  };
  const failedResults = async (directory, workers, options, expected) => {
    let failure;
    try { await runContractsBounded(directory, 'full', workers, options); } catch (error) { failure = error; }
    assert.ok(failure, 'an actual failed/expired child cannot report PASS');
    assert.match(failure.message, expected);
    const log = failure.message.match(/\); ([^\n]+\.log)/)?.[1]; assert.ok(log, 'per-child failure log retained');
    return JSON.parse(readFileSync(join(dirname(log), 'results.json'), 'utf8')).results;
  };

  const scopedFixture = (label, scripts) => {
    const directory = nativeFixture(label, scripts), manifestPath = join(directory, 'tools/contract-test-tiers.json');
    const classification = JSON.parse(readFileSync(manifestPath, 'utf8'));
    classification.scopes = { 'manga-image-cache': Object.keys(scripts).sort() };
    writeFileSync(manifestPath, JSON.stringify(classification)); return directory;
  };
  const scopeFailure = async (directory, workers) => {
    // This exercises delivery to an installed child signal handler, rather than
    // the separate process-startup deadline path. SDK/compiler peers can consume
    // most of a 250ms window before Node has evaluated the fixture at all.
    const scopeTimeoutMs = 2_000;
    let failure;
    try { await runContractsBounded(directory, 'full', workers,
      { scope: 'manga-image-cache', scopeTimeoutMs, timeoutMs: 4_000, killGraceMs: 1_000 }); } catch (error) { failure = error; }
    assert.ok(failure); assert.match(failure.message, new RegExp(`total timeout ${scopeTimeoutMs}ms`));
    const report = JSON.parse(readFileSync(failure.message.split('); ')[1], 'utf8'));
    assert.equal(report.scopeExpired, true); assert.ok(report.unrun.length > 0);
    assert.ok(report.millisecondsTotal >= report.scopeTimeoutMs);
    assert.equal(report.results.length + report.unrun.length, report.selected.length);
    assert.ok(report.results.every(row => row.scopeTimedOut && row.timedOut), 'every active child is terminated and settled');
    return report;
  };
  const unrunMarker = join(root, 'unrun-must-not-execute');
  const afterScript = `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(unrunMarker)},'incorrect dispatch');`;
  const signalFixture = (label, exits) => {
    const ready = join(root, `${label}-ready`), term = join(root, `${label}-term`);
    const script = `import {writeFileSync} from 'node:fs';` +
      `process.on('SIGTERM',()=>{writeFileSync(${JSON.stringify(term)},String(process.pid));${exits ? 'process.exit(0);' : ''}});` +
      `writeFileSync(${JSON.stringify(ready)},String(process.pid));setInterval(()=>{},1000);`;
    return { ready, term, script };
  };
  const cleanSignal = signalFixture('scope-clean', true);
  const scopeClean = scopedFixture('scope-term-clean', {
    'test-active.mjs': cleanSignal.script,
    'test-unrun.mjs': afterScript,
  });
  const scopeCleanReport = await scopeFailure(scopeClean, 1);
  assert.equal(readFileSync(cleanSignal.ready, 'utf8'), readFileSync(cleanSignal.term, 'utf8'), 'the actual initialized child received TERM');
  assert.equal(scopeCleanReport.results[0].status, 0, 'TERM exit0 is still a failed overall scope');
  assert.equal(scopeCleanReport.results[0].signal, null);
  assert.deepEqual(scopeCleanReport.results[0].termination, [{ signal: 'SIGTERM', sent: true }]);
  assert.deepEqual(scopeCleanReport.unrun, ['test-unrun.mjs']); assert.equal(existsSync(unrunMarker), false);
  const ignoredSignals = [signalFixture('scope-ignore-a', false), signalFixture('scope-ignore-b', false)];
  const scopeIgnore = scopedFixture('scope-term-ignored', {
    'test-active-a.mjs': ignoredSignals[0].script,
    'test-active-b.mjs': ignoredSignals[1].script,
    'test-unrun-a.mjs': afterScript, 'test-unrun-b.mjs': afterScript,
  });
  const scopeIgnoreReport = await scopeFailure(scopeIgnore, 2);
  for (const fixture of ignoredSignals)
    assert.equal(readFileSync(fixture.ready, 'utf8'), readFileSync(fixture.term, 'utf8'), 'each initialized child received and ignored TERM');
  assert.equal(scopeIgnoreReport.results.length, 2);
  assert.ok(scopeIgnoreReport.results.every(row => row.signal === 'SIGKILL' && row.termination.length === 2));
  assert.deepEqual(scopeIgnoreReport.unrun, ['test-unrun-a.mjs', 'test-unrun-b.mjs']); assert.equal(existsSync(unrunMarker), false);
  const unlimitedFull = nativeFixture('full-no-scope-cap', { 'test-slow.mjs': 'setTimeout(()=>process.exit(0),90);' });
  const fullWithoutScopeCap = await runContractsBounded(unlimitedFull, 'full', 1, { scopeTimeoutMs: 1, timeoutMs: 2000 });
  assert.equal(fullWithoutScopeCap.scopeTimeoutMs, null); assert.equal(fullWithoutScopeCap.scopeExpired, false);
  assert.ok(fullWithoutScopeCap.millisecondsTotal > 1, 'full keeps per-child deadlines without a new total limit');
  const ioFailure = scopedFixture('scope-worker-io-failure', {
    'test-a-injector.mjs': "import {tmpdir} from 'node:os';import {dirname,join} from 'node:path';import {mkdirSync} from 'node:fs';" +
      "mkdirSync(join(dirname(dirname(tmpdir())),'test-c-next.mjs.log'));setTimeout(()=>process.exit(0),200);",
    'test-b-active.mjs': "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);",
    'test-c-next.mjs': afterScript,
  });
  let ioError;
  try { await runContractsBounded(ioFailure, 'full', 2,
    { scope: 'manga-image-cache', scopeTimeoutMs: 2000, timeoutMs: 2000, killGraceMs: 100 }); } catch (error) { ioError = error; }
  assert.ok(ioError); assert.match(ioError.message, /contract worker failed/);
  const ioReport = JSON.parse(readFileSync(ioError.message.split('); ')[1], 'utf8'));
  assert.deepEqual(ioReport.unrun, ['test-c-next.mjs']);
  assert.equal(ioReport.results.find(row => row.name === 'test-b-active.mjs').signal, 'SIGKILL');
  assert.equal(ioReport.results.length, 2, 'I/O failure still reaps the other worker before reporting failure');
  assert.equal(existsSync(unrunMarker), false);

  // A real child still uses the unchanged finite timeout after wall-clock
  // adjustment. Duration is monotonic; the raw wall difference stays visible.
  const clock = nativeFixture('wall-clock-adjustment', {
    'test-clock.mjs': 'setTimeout(()=>process.exit(0),120);',
  });
  const originalWallNow = Date.now;
  let clockOffset = 0;
  Date.now = () => originalWallNow() + clockOffset;
  try {
    const pending = runContractsBounded(clock, 'full', 1, { timeoutMs: 2_000 });
    clockOffset = -60_000;
    const measured = await pending;
    const row = measured.results[0];
    assert.equal(row.status, 0); assert.equal(row.timedOut, false);
    assert.ok(row.milliseconds >= 100 && row.milliseconds < 2_000);
    assert.ok(row.wallMilliseconds < -58_000, 'wall-clock rollback remains explicit diagnostic evidence');
    assert.equal(row.temporaryStorageRemoved, true);
  } finally { Date.now = originalWallNow; }

  // A child which cleans up and exits zero after TERM still exceeded its deadline.
  const cleanTimeout = nativeFixture('term-clean-exit', {
    'test-cleanup.mjs': "process.on('SIGTERM',()=>process.exit(0));setInterval(()=>{},1000);",
    'test-after.mjs': 'process.exit(0);',
  });
  const cleanRows = await failedResults(cleanTimeout, 1, { timeoutMs: 1_000, killGraceMs: 180 }, /test-cleanup.mjs failed \(timeout/);
  const cleanRow = cleanRows.find(row => row.name === 'test-cleanup.mjs');
  assert.equal(cleanRow.status, 0); assert.equal(cleanRow.signal, null); assert.equal(cleanRow.timedOut, true);
  assert.deepEqual(cleanRow.termination, [{ signal: 'SIGTERM', sent: true }]);
  assert.equal(cleanRows.find(row => row.name === 'test-after.mjs').status, 0, 'other selected child still executes');

  // An uncooperative real child is forcibly reaped after a finite grace period.
  const ignoreTimeout = nativeFixture('term-ignored', {
    'test-ignore.mjs': "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);",
    'test-after.mjs': 'process.exit(0);',
  });
  const ignoredRows = await failedResults(ignoreTimeout, 1, { timeoutMs: 1_000, killGraceMs: 180 }, /test-ignore.mjs failed \(timeout/);
  const ignored = ignoredRows.find(row => row.name === 'test-ignore.mjs');
  assert.equal(ignored.status, null); assert.equal(ignored.signal, 'SIGKILL'); assert.equal(ignored.timedOut, true);
  assert.deepEqual(ignored.termination, [{ signal: 'SIGTERM', sent: true }, { signal: 'SIGKILL', sent: true }]);
  assert.equal(ignoredRows.find(row => row.name === 'test-after.mjs').status, 0);

  // Observe real process overlap, failure exit 7 and all eight settlements.
  const trace = join(root, 'native-child-overlap.jsonl'), scripts = {};
  for (let index = 0; index < 8; index++) scripts[`test-child-${index}.mjs`] =
    `import {appendFileSync} from 'node:fs';const trace=${JSON.stringify(trace)};` +
    `appendFileSync(trace,JSON.stringify({kind:'start',pid:process.pid})+'\\n');` +
    `setTimeout(()=>{appendFileSync(trace,JSON.stringify({kind:'end',pid:process.pid})+'\\n');process.exit(${index === 0 ? 7 : 0});},80);`;
  const concurrent = nativeFixture('actual-concurrency', scripts);
  const rows = await failedResults(concurrent, 2, { timeoutMs: 2_000, killGraceMs: 180 }, /test-child-0.mjs failed \(7\)/);
  assert.deepEqual(rows.map(row => row.name), Object.keys(scripts));
  assert.equal(rows[0].status, 7); assert.ok(rows.slice(1).every(row => row.status === 0 && !row.timedOut));
  let active = 0, peak = 0; const pids = new Set();
  for (const event of readFileSync(trace, 'utf8').trim().split('\n').map(line => JSON.parse(line))) {
    if (event.kind === 'start') { assert.equal(pids.has(event.pid), false); pids.add(event.pid); active++; peak = Math.max(peak, active); }
    else { assert.equal(pids.delete(event.pid), true); active--; }
    assert.ok(active >= 0 && active <= 2, 'actual native overlap stays within the configured two workers');
  }
  assert.equal(active, 0); assert.equal(peak, 2); assert.equal(pids.size, 0);
  // Actual child OS temp writes are isolated, released only after successful
  // process termination, and retained for a failed child. A sibling sentinel
  // and per-test logs/results cannot be deleted by scratch cleanup.
  const sentinel = join(root, 'outside-scratch.txt'); writeFileSync(sentinel, 'preserve');
  const scratchTrace = join(root, 'temporary-storage.jsonl');
  const storageScript = status => `import {tmpdir} from 'node:os';import {join} from 'node:path';` +
    `import {mkdirSync,writeFileSync,appendFileSync} from 'node:fs';` +
    `const directory=tmpdir();const nested=join(directory,'actual-core-fixture');mkdirSync(nested);` +
    `writeFileSync(join(nested,'receipt.db'),'actual child fixture');` +
    `appendFileSync(${JSON.stringify(scratchTrace)},JSON.stringify({pid:process.pid,directory})+'\\n');` +
    `console.log('native fixture written');process.exit(${status});`;
  const storage = nativeFixture('temporary-storage', {
    'test-storage-pass.mjs': storageScript(0), 'test-storage-fail.mjs': storageScript(7),
  });
  const storageRows = await failedResults(storage, 2, {}, /test-storage-fail.mjs failed \(7\)/);
  const writes = readFileSync(scratchTrace, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.equal(new Set(writes.map(row => row.directory)).size, 2, 'concurrent actual OS temp directories are distinct');
  for (const row of storageRows) {
    assert.ok(writes.some(write => write.directory === row.temporaryDirectory));
    assert.equal(row.temporaryStorageRemoved, row.status === 0);
    assert.equal(existsSync(row.temporaryDirectory), row.status !== 0);
    assert.match(readFileSync(row.log, 'utf8'), /native fixture written/, 'logs survive successful fixture removal');
    if (row.status !== 0) {
      assert.equal(readFileSync(join(row.temporaryDirectory, 'actual-core-fixture/receipt.db'), 'utf8'), 'actual child fixture');
      rmSync(row.temporaryDirectory, { recursive: true }); // Failed fixture inspected; this test owns it.
    }
  }
  assert.equal(readFileSync(sentinel, 'utf8'), 'preserve');
  assert.ok(cleanRows.find(row => row.timedOut).temporaryStorageRemoved === false, 'expired exit0 cannot trigger successful scratch cleanup');
  assert.ok(ignoredRows.find(row => row.timedOut).temporaryStorageRemoved === false);
  console.log('PASS: complete inventory and explicit scope CLI, finite deadline, failed/unclassified/duplicate/empty tiers, timeout cleanup exit0, TERM ignore/KILL, actual concurrency bound and every selected settlement');
} finally { rmSync(workspace, { recursive: true, force: true }); }
}

// Importable independently: these are real, tiny Node process groups. They do
// not acquire a build lease or invoke SDK, Cargo, HDC or the full contract CLI.
export async function runProcessTreeCleanupFixtures() {
  if (process.platform === 'win32') {
    console.log('NOT_RUN: POSIX process-tree fixtures; Windows retains direct-child capability without descendant proof');
    return;
  }
  const fixture = mkdtempSync(join(tmpdir(), 'reader-contract-process-tree-'));
  const ownedGroups = new Set(), reports = [];
  let passed = false;
  try {
    for (const mode of ['clean', 'timeout', 'orphan-exit0', 'orphan-exit7', 'cancelled', 'unreclaimed']) {
      const directory = join(fixture, mode), tools = join(directory, 'tools'), pidFile = join(directory, 'grandchild.pid');
      const parentPidFile = join(directory, 'parent.pid'), sentinel = join(directory, 'must-not-run');
      mkdirSync(tools, { recursive: true });
      writeFileSync(join(tools, 'contract-test-tiers.json'), JSON.stringify({ schemaVersion: 1,
        source: ['cancelled', 'unreclaimed'].includes(mode) ? ['test-a-tree.mjs', 'test-z-sentinel.mjs'] : ['test-a-tree.mjs'], integration: [] }));
      const grandchild = `const {writeFileSync}=require('node:fs');` +
        `process.on('SIGTERM',()=>{});setInterval(()=>{},1000);` +
        `writeFileSync(${JSON.stringify(pidFile)},String(process.pid));process.send('ready');`;
      const parent = mode === 'clean' ? 'process.exit(0);' :
        `import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';` +
        `writeFileSync(${JSON.stringify(parentPidFile)},String(process.pid));process.on('SIGTERM',()=>{});` +
        `const child=spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],` +
        `{stdio:['ignore','ignore','ignore','ipc']});` +
        `child.once('message',()=>{${['timeout', 'cancelled', 'unreclaimed'].includes(mode) ? '' : `process.exit(${mode === 'orphan-exit7' ? 7 : 0});`}});`;
      writeFileSync(join(tools, 'test-a-tree.mjs'), parent);
      writeFileSync(join(tools, 'test-z-sentinel.mjs'), `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(sentinel)},'unexpected');`);
      if (!['cancelled', 'unreclaimed'].includes(mode)) rmSync(join(tools, 'test-z-sentinel.mjs'));
      let report, failure;
      const realKill = process.kill;
      const cancellation = new AbortController();
      try {
        if (mode === 'unreclaimed') process.kill = (pid, requestedSignal = 'SIGTERM') => {
          // Refuse termination only for this real, fixture-owned process group.
          // Observation still goes to the OS; no invented PID or host load.
          if (requestedSignal !== 0 && existsSync(parentPidFile) && pid === -Number(readFileSync(parentPidFile, 'utf8'))) {
            throw Object.assign(new Error('fixture signal refusal'), { code: 'EPERM' });
          }
          return realKill(pid, requestedSignal);
        };
        const pending = runContractsBounded(directory, 'full', 1, { timeoutMs: 1000,
          killGraceMs: mode === 'unreclaimed' ? 200 : 1000, signal: cancellation.signal })
          .then(value => ({ report: value }), error => ({ failure: error, report: error.report }));
        if (mode === 'cancelled') {
          const readyDeadline = performance.now() + 1000;
          while (!existsSync(pidFile)) {
            assert.ok(performance.now() < readyDeadline, 'actual grandchild must be ready before cancellation');
            await new Promise(resolveWait => setTimeout(resolveWait, 10));
          }
          cancellation.abort();
        }
        ({ report, failure } = await pending);
      } finally { process.kill = realKill; }
      assert.ok(report, failure?.stack);
      reports.push(report);
      const [row] = report.results;
      ownedGroups.add(row.processGroupId);
      if (mode === 'unreclaimed') {
        assert.ok(failure); assert.equal(failure.treeSettled, false);
        assert.equal(row.treeSettled, false); assert.equal(report.treeSettled, false);
        assert.equal(report.treeRecoveryBlocked, true); assert.equal(report.results.length, 1);
        assert.deepEqual(report.unrun, ['test-z-sentinel.mjs']); assert.equal(existsSync(sentinel), false);
        assert.match(failure.message, /could not be reclaimed/);
        process.kill(-row.processGroupId, 'SIGKILL');
        const cleanupDeadline = performance.now() + 1000;
        while (true) {
          try { process.kill(-row.processGroupId, 0); }
          catch (error) {
            if (error.code === 'ESRCH') break;
            // Teardown of the deliberately unreclaimed fixture is complete
            // only on ESRCH. A transient EPERM after real KILL is not proof
            // of settlement; keep waiting within the same bounded teardown.
            if (error.code !== 'EPERM') throw error;
          }
          assert.ok(performance.now() < cleanupDeadline, 'fixture must reclaim its real group after restoring OS signals');
          await new Promise(resolveWait => setTimeout(resolveWait, 10));
        }
        ownedGroups.delete(row.processGroupId);
        continue;
      }
      assert.equal(row.treeSettled, true, `${mode}: every owned group must be gone before the result returns`);
      assert.equal(report.treeSettled, true);
      assert.throws(() => process.kill(-row.processGroupId, 0), error => error.code === 'ESRCH');
      ownedGroups.delete(row.processGroupId);
      if (mode === 'clean') {
        assert.equal(failure, undefined); assert.equal(row.status, 0);
        assert.equal(row.orphanDescendants, false); assert.deepEqual(row.termination, []);
      } else {
        assert.ok(failure, `${mode}: cleanup must not turn a timeout or orphan into PASS`);
        const pid = Number(readFileSync(pidFile, 'utf8'));
        assert.throws(() => process.kill(pid, 0), error => error.code === 'ESRCH', `${mode}: grandchild must not survive`);
        assert.ok(row.termination.some(entry => entry.signal === 'SIGKILL' && entry.sent));
        assert.equal(row.temporaryStorageRemoved, false);
        if (mode === 'cancelled') {
          assert.equal(report.cancelled, true); assert.equal(row.timedOut, false);
          assert.deepEqual(report.unrun, ['test-z-sentinel.mjs']); assert.equal(existsSync(sentinel), false);
          assert.match(failure.message, /contract run cancelled/);
        } else if (mode === 'timeout') {
          assert.equal(row.timedOut, true); assert.equal(row.orphanDescendants, false);
          assert.match(failure.message, /timeout 1000ms/);
        } else {
          assert.equal(row.timedOut, false); assert.equal(row.orphanDescendants, true);
          assert.equal(row.status, mode === 'orphan-exit7' ? 7 : 0);
          assert.match(failure.message, /orphan descendants remained/);
        }
      }
    }
    for (const mode of ['nested-cancelled', 'nested-timeout']) {
      const directory = join(fixture, mode), tools = join(directory, 'tools');
      const inner = join(directory, 'inner'), innerTools = join(inner, 'tools');
      const leafPidFile = join(directory, 'leaf.pid'), grandchildPidFile = join(directory, 'grandchild.pid');
      mkdirSync(tools, { recursive: true }); mkdirSync(innerTools, { recursive: true });
      writeFileSync(join(tools, 'contract-test-tiers.json'), JSON.stringify({ schemaVersion: 1,
        source: ['test-nested.mjs'], integration: [] }));
      writeFileSync(join(innerTools, 'contract-test-tiers.json'), JSON.stringify({ schemaVersion: 1,
        source: ['test-leaf.mjs'], integration: [] }));
      const grandchild = `const {writeFileSync}=require('node:fs');process.on('SIGTERM',()=>{});` +
        `setInterval(()=>{},1000);writeFileSync(${JSON.stringify(grandchildPidFile)},String(process.pid));process.send('ready');`;
      writeFileSync(join(innerTools, 'test-leaf.mjs'),
        `import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';` +
        `writeFileSync(${JSON.stringify(leafPidFile)},String(process.pid));process.on('SIGTERM',()=>{});` +
        `const child=spawn(process.execPath,['-e',${JSON.stringify(grandchild)}],{stdio:['ignore','ignore','ignore','ipc']});` +
        `child.once('message',()=>{});`);
      writeFileSync(join(tools, 'test-nested.mjs'),
        `import {runContractsBounded} from ${JSON.stringify(new URL('./run-contract-tests.mjs', import.meta.url).href)};` +
        `try{await runContractsBounded(${JSON.stringify(inner)},'full',1,{timeoutMs:5000,killGraceMs:1000});}` +
        `catch{process.exitCode=1;}`);
      const cancellation = new AbortController();
      const pending = runContractsBounded(directory, 'full', 1, { timeoutMs: 1000, killGraceMs: 1000, signal: cancellation.signal })
        .then(report => ({ report }), failure => ({ report: failure.report, failure }));
      if (mode === 'nested-cancelled') {
        const readyDeadline = performance.now() + 1000;
        while (!existsSync(grandchildPidFile)) {
          assert.ok(performance.now() < readyDeadline, 'real nested grandchild must be ready before outer cancellation');
          await new Promise(resolveWait => setTimeout(resolveWait, 10));
        }
        cancellation.abort();
      }
      const { report, failure } = await pending;
      assert.ok(report, failure?.stack); reports.push(report);
      const [row] = report.results;
      for (const pid of row.ownedProcessGroups) ownedGroups.add(pid);
      const leafPid = Number(readFileSync(leafPidFile, 'utf8'));
      const grandchildPid = Number(readFileSync(grandchildPidFile, 'utf8'));
      assert.ok(failure); assert.equal(report.treeSettled, true);
      assert.equal(row.treeSettled, true); assert.equal(row.treeCapability, 'posix-process-group');
      assert.ok(row.ownedProcessGroups.includes(leafPid), 'outer receipt must own the real inner PGID received through private IPC');
      assert.ok(row.ownedProcessGroups.includes(row.processGroupId));
      for (const pid of row.ownedProcessGroups) {
        assert.throws(() => process.kill(-pid, 0), error => error.code === 'ESRCH', 'every registered real group must disappear');
        ownedGroups.delete(pid);
      }
      assert.throws(() => process.kill(grandchildPid, 0), error => error.code === 'ESRCH', 'nested grandchild must not remain after outer result');
      assert.equal(report.cancelled, mode === 'nested-cancelled');
      assert.equal(row.timedOut, mode === 'nested-timeout');
    }
    for (const denyRemoval of [false, true]) {
      const directory = join(fixture, denyRemoval ? 'nested-removal-denied' : 'nested-parallel-removal');
      const tools = join(directory, 'tools'), inner = join(directory, 'inner'), innerTools = join(inner, 'tools');
      const fastPidFile = join(directory, 'fast.pid'), slowPidFile = join(directory, 'slow.pid');
      const release = join(directory, 'release'), done = join(directory, 'done');
      mkdirSync(tools, { recursive: true }); mkdirSync(innerTools, { recursive: true });
      writeFileSync(join(tools, 'contract-test-tiers.json'), JSON.stringify({ schemaVersion: 1,
        source: ['test-controller.mjs'], integration: [] }));
      writeFileSync(join(innerTools, 'contract-test-tiers.json'), JSON.stringify({ schemaVersion: 1,
        source: ['test-fast.mjs', 'test-slow.mjs'], integration: [] }));
      writeFileSync(join(innerTools, 'test-fast.mjs'),
        `import {writeFileSync,existsSync} from 'node:fs';writeFileSync(${JSON.stringify(fastPidFile)},String(process.pid));` +
        `setInterval(()=>{if(existsSync(${JSON.stringify(slowPidFile)}))process.exit(0)},5);`);
      writeFileSync(join(innerTools, 'test-slow.mjs'),
        `import {writeFileSync,existsSync} from 'node:fs';writeFileSync(${JSON.stringify(slowPidFile)},String(process.pid));` +
        `setInterval(()=>{if(existsSync(${JSON.stringify(release)})){writeFileSync(${JSON.stringify(done)},'done');process.exit(0)}},5);`);
      writeFileSync(join(tools, 'test-controller.mjs'),
        `import {runContractsBounded} from ${JSON.stringify(new URL('./run-contract-tests.mjs', import.meta.url).href)};` +
        `await runContractsBounded(${JSON.stringify(inner)},'full',2,{timeoutMs:2000});`);
      const realKill = process.kill;
      let report, failure, siblingObservations = 0, deniedObservations = 0;
      try {
        process.kill = (pid, requestedSignal = 'SIGTERM') => {
          if (requestedSignal === 0 && existsSync(slowPidFile) && pid === -Number(readFileSync(slowPidFile, 'utf8')) && !existsSync(done)) {
            siblingObservations++;
            throw Object.assign(new Error('fixture live sibling observation'), { code: 'EPERM' });
          }
          try { return realKill(pid, requestedSignal); }
          catch (error) {
            if (error.code === 'ESRCH' && requestedSignal === 0 && existsSync(fastPidFile) && pid === -Number(readFileSync(fastPidFile, 'utf8'))) {
              writeFileSync(release, 'the fast group is independently confirmed gone');
              if (denyRemoval && deniedObservations++ === 0) {
                throw Object.assign(new Error('fixture removal observation refusal'), { code: 'EPERM' });
              }
            }
            throw error;
          }
        };
        try { report = await runContractsBounded(directory, 'full', 1, { timeoutMs: 4000 }); }
        catch (error) { failure = error; report = error.report; }
      } finally { process.kill = realKill; }
      assert.ok(report, failure?.stack); reports.push(report);
      const [row] = report.results;
      for (const pid of row.ownedProcessGroups) ownedGroups.add(pid);
      assert.equal(siblingObservations, 0, 'one removal must not probe another live sibling group');
      assert.equal(row.status, 0); assert.equal(row.timedOut, false); assert.equal(row.treeSettled, true);
      if (denyRemoval) {
        assert.ok(deniedObservations > 0); assert.ok(failure);
        assert.match(failure.message, /process group observation: EPERM/, 'a refused observation for the actual removal remains a failed gate');
      } else { assert.equal(failure, undefined); assert.equal(row.error, undefined); }
      for (const pid of row.ownedProcessGroups) {
        assert.throws(() => process.kill(-pid, 0), error => error.code === 'ESRCH');
        ownedGroups.delete(pid);
      }
    }
    passed = true;
    console.log('PASS: original eight process-tree cases, targeted nested parallel removal and EPERM fail-closed observation');
  } finally {
    let cleanupFailure;
    for (const pid of ownedGroups) {
      try { process.kill(-pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') cleanupFailure ??= error; }
    }
    if (passed) for (const report of reports) rmSync(report.logRoot, { recursive: true, force: true });
    rmSync(fixture, { recursive: true, force: true });
    if (passed && cleanupFailure) throw cleanupFailure;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runContractTierFixtures();
  await runProcessTreeCleanupFixtures();
}
