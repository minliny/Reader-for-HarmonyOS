import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, openSync, closeSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';

export function contractTests(root, tier) {
  assert.ok(['source', 'full'].includes(tier));
  const manifest = JSON.parse(readFileSync(resolve(root, 'tools/contract-test-tiers.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  const discovered = readdirSync(resolve(root, 'tools')).filter(name =>
    /^test-.*\.mjs$/.test(name) && !/-server\.mjs$/.test(name)).sort();
  const declared = [...manifest.source, ...manifest.integration];
  assert.equal(new Set(declared).size, declared.length, 'duplicate test classification');
  assert.deepEqual([...declared].sort(), discovered, 'every discovered test must be classified');
  const selected = tier === 'source' ? manifest.source : discovered;
  assert.ok(selected.length > 0, 'empty test tier is not PASS');
  return { selected, integrationCount: manifest.integration.length };
}

export function runContracts(root, tier) {
  const { selected, integrationCount } = contractTests(root, tier);
  for (const name of selected) {
    const result = spawnSync(process.execPath, [resolve(root, 'tools', name)], {
      cwd: root, stdio: 'inherit', timeout: 300_000,
    });
    if (result.error || result.status !== 0) throw new Error(`${name} failed (${result.error?.code ?? result.status ?? result.signal})`);
  }
  console.log(`Host ${tier} contract tests passed: ${selected.length}; integration tests classified: ${integrationCount}`);
}

/** Opt-in bounded execution of the same classified inventory. Each test has
 * its own process and log. All started tests settle; every failure is retained
 * and the gate is nonzero. No test result or prior source snapshot is reused. */
export async function runContractsBounded(root, tier, workers = 1, testOptions = {}) {
  assert.ok(Number.isInteger(workers) && workers >= 1 && workers <= 4, 'workers must be an integer in 1..4');
  // Shorter deadlines are only an imported test seam, never a CLI/env option.
  const timeoutMs = testOptions.timeoutMs ?? 300_000;
  const killGraceMs = testOptions.killGraceMs ?? 1_000;
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300_000, 'invalid test deadline');
  assert.ok(Number.isInteger(killGraceMs) && killGraceMs > 0 && killGraceMs <= 10_000, 'invalid termination grace');
  const { selected, integrationCount } = contractTests(root, tier);
  const logRoot = mkdtempSync(resolve(tmpdir(), 'reader-contract-run-'));
  const results = []; let cursor = 0;
  async function worker() {
    while (cursor < selected.length) {
      const name = selected[cursor++], started = performance.now(), wallStarted = Date.now(), log = resolve(logRoot, name + '.log');
      const temporaryDirectory = resolve(logRoot, 'temporary', name);
      mkdirSync(temporaryDirectory, { recursive: true });
      const fd = openSync(log, 'wx');
      const result = await new Promise(resolveResult => {
        let child, error, deadline, escalation;
        let timedOut = false, exited = false;
        const termination = [];
        try {
          child = spawn(process.execPath, [resolve(root, 'tools', name)],
            { cwd: root, stdio: ['ignore', fd, fd],
              env: { ...process.env, TMPDIR: temporaryDirectory, TMP: temporaryDirectory, TEMP: temporaryDirectory } });
        } catch (failure) { resolveResult({ error: failure.code ?? failure.message, timedOut, termination }); return; }
        const terminate = signal => {
          try { termination.push({ signal, sent: child.kill(signal) }); }
          catch (failure) { error ??= failure.code ?? failure.message; termination.push({ signal, sent: false }); }
        };
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
          resolveResult({ status, signal, error, timedOut, termination });
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
  await Promise.all(Array.from({ length: Math.min(workers, selected.length) }, worker));
  results.sort((a, b) => a.name.localeCompare(b.name));
  assert.equal(results.length, selected.length, 'every selected test must settle');
  writeFileSync(resolve(logRoot, 'results.json'), JSON.stringify({ tier, workers, results }, null, 2) + '\n');
  const failed = results.filter(row => row.error || row.timedOut || row.status !== 0);
  if (failed.length) throw new Error(failed.map(row => `${row.name} failed (${row.timedOut
    ? `timeout ${timeoutMs}ms; exit ${row.status ?? row.signal}; termination ${row.termination.map(entry => entry.signal).join(',')}`
    : row.error ?? row.status ?? row.signal}); ${row.log}`).join('\n'));
  console.log(`Host ${tier} contract tests passed: ${selected.length}; integration tests classified: ${integrationCount}; logs: ${logRoot}`);
  return { selected, results, logRoot };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  assert.ok(['--source', '--full'].includes(process.argv[2]) && process.argv.length === 3,
    'Usage: node tools/run-contract-tests.mjs --source|--full');
  await runContractsBounded(resolve(dirname(fileURLToPath(import.meta.url)), '..'), process.argv[2].slice(2),
    Number(process.env.READER_CONTRACT_TEST_WORKERS ?? 1));
}
