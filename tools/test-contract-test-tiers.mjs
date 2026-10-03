import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runContracts, runContractsBounded, contractTests } from './run-contract-tests.mjs';

contractTests(fileURLToPath(new URL('..', import.meta.url)), 'full');

const root = mkdtempSync(join(tmpdir(), 'reader-contract-gate-'));
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
  console.log('PASS: failed/unclassified/duplicate/empty tiers, timeout cleanup exit0, TERM ignore/KILL, actual concurrency bound and every selected settlement');
} finally { rmSync(root, { recursive: true, force: true }); }
