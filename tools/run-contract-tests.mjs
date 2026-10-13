import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, openSync, closeSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export const MAX_CONTRACT_TIMEOUT_MS = 110_000;

export function contractSelection(manifest, discovered, tier, scope) {
  assert.ok(['source', 'full'].includes(tier));
  assert.equal(manifest.schemaVersion, 1);
  const declared = [...manifest.source, ...manifest.integration];
  assert.equal(new Set(declared).size, declared.length, 'duplicate test classification');
  assert.deepEqual([...declared].sort(), discovered, 'every discovered test must be classified');
  for (const [name, tests] of Object.entries(manifest.scopes ?? {})) {
    assert.match(name, /^[a-z][a-z0-9-]+$/, 'invalid contract scope name');
    assert.ok(Array.isArray(tests) && tests.length > 0, 'empty contract scope is not PASS');
    assert.equal(new Set(tests).size, tests.length, 'duplicate scope test');
    assert.ok(tests.every(test => discovered.includes(test)), 'unclassified scope test');
  }
  if (scope !== undefined) {
    assert.equal(tier, 'full', 'scope cannot replace the source tier');
    assert.ok(Object.hasOwn(manifest.scopes ?? {}, scope), 'unknown contract scope');
  }
  const selected = [...(scope === undefined ? tier === 'source' ? manifest.source : discovered : manifest.scopes[scope])].sort();
  assert.ok(selected.length > 0, 'empty test tier is not PASS');
  return { selected, omitted: discovered.filter(test => !selected.includes(test)), inventory: discovered,
    integrationCount: manifest.integration.length };
}

export function contractTests(root, tier, scope) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'tools/contract-test-tiers.json'), 'utf8'));
  const discovered = readdirSync(resolve(root, 'tools')).filter(name =>
    /^test-.*\.mjs$/.test(name) && !/-server\.mjs$/.test(name)).sort();
  return contractSelection(manifest, discovered, tier, scope);
}

export function runContracts(root, tier) {
  const { selected, integrationCount } = contractTests(root, tier);
  for (const name of selected) {
    const result = spawnSync(process.execPath, [resolve(root, 'tools', name)], {
      cwd: root, stdio: 'inherit', timeout: MAX_CONTRACT_TIMEOUT_MS, killSignal: 'SIGKILL',
    });
    if (result.error || result.status !== 0) throw new Error(`${name} failed (${result.error?.code ?? result.status ?? result.signal})`);
  }
  console.log(`Host ${tier} contract tests passed: ${selected.length}; integration tests classified: ${integrationCount}`);
}

/** Opt-in bounded execution of the same classified inventory. Each test has
 * its own process and log. All started tests settle; every failure is retained
 * and the gate is nonzero. No test result or prior source snapshot is reused. */
export async function runContractsBounded(root, tier, workers = 1, testOptions = {}) {
  const runStarted = performance.now();
  assert.ok(Number.isInteger(workers) && workers >= 1 && workers <= 4, 'workers must be an integer in 1..4');
  const timeoutMs = testOptions.timeoutMs ?? MAX_CONTRACT_TIMEOUT_MS;
  const killGraceMs = testOptions.killGraceMs ?? 1_000;
  const scopeTimeoutMs = testOptions.scope === undefined ? null : testOptions.scopeTimeoutMs ?? MAX_CONTRACT_TIMEOUT_MS;
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= MAX_CONTRACT_TIMEOUT_MS, 'invalid test deadline');
  assert.ok(Number.isInteger(killGraceMs) && killGraceMs > 0 && killGraceMs <= 10_000, 'invalid termination grace');
  assert.ok(scopeTimeoutMs === null || Number.isInteger(scopeTimeoutMs) && scopeTimeoutMs > 0 && scopeTimeoutMs <= MAX_CONTRACT_TIMEOUT_MS,
    'invalid scope deadline');
  assert.ok(scopeTimeoutMs === null || killGraceMs <= 1_000, 'scope termination grace must be at most one second');
  const { selected, omitted, inventory, integrationCount } = contractTests(root, tier, testOptions.scope);
  const logRoot = mkdtempSync(resolve(tmpdir(), 'reader-contract-run-'));
  const results = [], active = new Map(); let cursor = 0, scopeExpired = false;
  const expireScope = () => {
    scopeExpired = true;
    for (const abort of active.values()) abort();
  };
  const scopeDeadline = scopeTimeoutMs === null ? undefined : setTimeout(expireScope,
    Math.max(0, scopeTimeoutMs - (performance.now() - runStarted)));
  async function worker() {
    while (cursor < selected.length) {
      if (scopeTimeoutMs !== null && performance.now() - runStarted >= scopeTimeoutMs) expireScope();
      if (scopeExpired) return;
      const name = selected[cursor++], started = performance.now(), wallStarted = Date.now(), log = resolve(logRoot, name + '.log');
      const temporaryDirectory = resolve(logRoot, 'temporary', name);
      mkdirSync(temporaryDirectory, { recursive: true });
      const fd = openSync(log, 'wx');
      const result = await new Promise(resolveResult => {
        let child, error, deadline, escalation;
        let timedOut = false, scopeTimedOut = false, exited = false;
        const termination = [];
        const childEnvironment = { ...process.env, TMPDIR: temporaryDirectory, TMP: temporaryDirectory, TEMP: temporaryDirectory };
        // A nested fixture runner must not overwrite this run's result file or
        // inherit the canonical parent's remaining scope budget as a new run.
        delete childEnvironment.READER_CONTRACT_RESULTS_FILE;
        delete childEnvironment.READER_CONTRACT_SCOPE_TIMEOUT_MS;
        try {
          child = spawn(process.execPath, [resolve(root, 'tools', name)],
            { cwd: root, stdio: ['ignore', fd, fd], env: childEnvironment });
        } catch (failure) { resolveResult({ error: failure.code ?? failure.message, timedOut, scopeTimedOut, termination }); return; }
        const terminate = signal => {
          try { termination.push({ signal, sent: child.kill(signal) }); }
          catch (failure) { error ??= failure.code ?? failure.message; termination.push({ signal, sent: false }); }
        };
        active.set(child, () => {
          if (exited) return;
          scopeTimedOut = true;
          if (timedOut) return; // Existing per-child escalation still owns reaping.
          timedOut = true;
          clearTimeout(deadline);
          terminate('SIGTERM');
          escalation = setTimeout(() => { if (!exited) terminate('SIGKILL'); }, killGraceMs);
        });
        deadline = setTimeout(() => {
          if (exited) return;
          timedOut = true;
          terminate('SIGTERM');
          escalation = setTimeout(() => { if (!exited) terminate('SIGKILL'); }, killGraceMs);
        }, timeoutMs);
        child.once('error', event => { error = event.code ?? event.message; });
        child.once('exit', () => { exited = true; clearTimeout(deadline); clearTimeout(escalation); });
        child.once('close', (status, signal) => {
          clearTimeout(deadline); clearTimeout(escalation);
          active.delete(child);
          resolveResult({ status, signal, error, timedOut, scopeTimedOut, termination });
        });
      });
      closeSync(fd);
      // Only an actually successful, closed child releases its own temporary
      // storage. Failed/expired children retain fixtures alongside their logs.
      // This never scans or removes the shared OS temp root or user data.
      let temporaryStorageRemoved = false;
      if (!result.error && !result.timedOut && result.status === 0) {
        try { rmSync(temporaryDirectory, { recursive: true }); temporaryStorageRemoved = true; }
        catch (failure) { result.error = `temporary cleanup: ${failure.code ?? failure.message}`; }
      }
      const row = { name, ...result, milliseconds: Math.round(performance.now() - started),
        wallMilliseconds: Date.now() - wallStarted, log, temporaryDirectory, temporaryStorageRemoved };
      results.push(row);
      console.log(`${name}: ${!row.error && !row.timedOut && row.status === 0 ? 'PASS' : 'FAIL'} (${row.milliseconds}ms)`);
    }
  }
  const workersStarted = Array.from({ length: Math.min(workers, selected.length) }, worker);
  let workerFailure;
  try { await Promise.all(workersStarted); }
  catch (error) {
    workerFailure = error;
    expireScope();
    await Promise.allSettled(workersStarted); // Reap every owned child before clearing the deadline.
  } finally { clearTimeout(scopeDeadline); }
  const millisecondsTotal = Math.ceil(performance.now() - runStarted);
  if (scopeTimeoutMs !== null && millisecondsTotal > scopeTimeoutMs) scopeExpired = true;
  results.sort((a, b) => a.name.localeCompare(b.name));
  const unrun = selected.filter(name => !results.some(row => row.name === name));
  assert.equal(active.size, 0, 'every started child must settle');
  if (!scopeExpired) assert.equal(results.length, selected.length, 'every selected test must settle');
  const report = { schemaVersion: 1, name: 'reader-harmony-contract-results', tier,
    scope: testOptions.scope ?? tier, selected, omitted, inventory, workers, timeoutMs, killGraceMs,
    scopeTimeoutMs, scopeExpired, millisecondsTotal, unrun, results };
  writeFileSync(resolve(logRoot, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  if (testOptions.resultsFile) writeFileSync(testOptions.resultsFile, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const failed = results.filter(row => row.error || row.timedOut || row.status !== 0);
  if (workerFailure) throw new Error(`contract worker failed (${workerFailure.message}); ${resolve(logRoot, 'results.json')}`);
  if (scopeExpired) throw new Error(`scope ${testOptions.scope} failed (total timeout ${scopeTimeoutMs}ms; elapsed ${millisecondsTotal}ms; ` +
    `unrun ${unrun.join(',') || '<none>'}); ${resolve(logRoot, 'results.json')}`);
  if (failed.length) throw new Error(failed.map(row => `${row.name} failed (${row.timedOut
    ? `timeout ${timeoutMs}ms; exit ${row.status ?? row.signal}; termination ${row.termination.map(entry => entry.signal).join(',')}`
    : row.error ?? row.status ?? row.signal}); ${row.log}`).join('\n'));
  console.log(`Host ${testOptions.scope ? `scope ${testOptions.scope} (full suite NOT_RUN)` : tier} contract tests passed: ${selected.length}; integration tests classified: ${integrationCount}; logs: ${logRoot}`);
  return { ...report, logRoot };
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2], options = new Map();
  assert.ok(['--source', '--full', '--scope'].includes(mode),
    'Usage: node tools/run-contract-tests.mjs --source|--full|--scope <name> [--results-file <file>] [--test-timeout-ms <1..110000>]');
  let cursor = 3, scope;
  if (mode === '--scope') { scope = process.argv[cursor++]; assert.ok(scope && !scope.startsWith('--'), 'missing contract scope'); }
  for (; cursor < process.argv.length; cursor += 2) {
    const key = process.argv[cursor], value = process.argv[cursor + 1];
    assert.ok(['--results-file', '--test-timeout-ms'].includes(key) && !options.has(key) && value && !value.startsWith('--'), 'invalid contract runner argument');
    options.set(key, value);
  }
  await runContractsBounded(resolve(dirname(fileURLToPath(import.meta.url)), '..'), mode === '--source' ? 'source' : 'full',
    Number(process.env.READER_CONTRACT_TEST_WORKERS ?? 1), { scope,
      timeoutMs: Number(options.get('--test-timeout-ms') ?? process.env.READER_CONTRACT_TEST_TIMEOUT_MS ?? MAX_CONTRACT_TIMEOUT_MS),
      scopeTimeoutMs: scope === undefined ? undefined : Number(process.env.READER_CONTRACT_SCOPE_TIMEOUT_MS ?? MAX_CONTRACT_TIMEOUT_MS),
      resultsFile: options.get('--results-file') ?? process.env.READER_CONTRACT_RESULTS_FILE });
}
