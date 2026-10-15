import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise the real entry in a tiny repository, including a failing assertion
// and a hanging process. Never recurse into the real contract test directory.
const script = readFileSync(new URL('../scripts/check-local.sh', import.meta.url), 'utf8');
const root = mkdtempSync(join(tmpdir(), 'reader-contract-runner-'));
try {
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'tools'));
  const entry = join(root, 'scripts/check-local.sh');
  writeFileSync(entry, script, { mode: 0o755 });
  const fixture = (name, body) => writeFileSync(join(root, 'tools', name), body);
  const env = { ...process.env };
  // Node explicitly disallows nesting run() in a test child; this fixture is a
  // separate application invocation, with its own isolated miniature test tree.
  delete env.NODE_TEST_CONTEXT;
  const invoke = () => spawnSync(entry, [], { encoding: 'utf8', env, timeout: 10000 });
  fixture('test-one.mjs', "console.log('first executed');");
  fixture('test-name with spaces.mjs', "console.log('spaces executed');");
  fixture('test-excluded-server.mjs', "throw Error('server must stay excluded');");
  const passed = invoke();
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
  assert.match(passed.stdout, /first executed/);
  assert.match(passed.stdout, /spaces executed/);
  assert.match(passed.stdout, /Harmony contract tests passed: 2/);

  fixture('test-new-failure.mjs', "throw Error('failure must propagate');");
  const failed = invoke();
  assert.equal(failed.status, 1, failed.stdout + failed.stderr);
  assert.match(failed.stdout + failed.stderr, /failure must propagate/);
  assert.doesNotMatch(failed.stdout, /Harmony contract tests passed:/);
  rmSync(join(root, 'tools/test-new-failure.mjs'));

  fixture('test-hanging.mjs', `import { writeFileSync } from 'node:fs';
    writeFileSync('hanging.pid', String(process.pid)); setInterval(() => {}, 1000);`);
  // Shorten the same production deadline only in this private fixture.
  writeFileSync(entry, script.replace('AbortSignal.timeout(120000)', 'AbortSignal.timeout(1500)'));
  const cancelled = invoke();
  assert.equal(cancelled.status, 1, cancelled.stdout + cancelled.stderr);
  assert.match(cancelled.stderr, /wall-clock budget/);
  assert.doesNotMatch(cancelled.stdout, /Harmony contract tests passed:/);
  const child = Number(readFileSync(join(root, 'hanging.pid'), 'utf8'));
  assert.throws(() => process.kill(child, 0), { code: 'ESRCH' }, 'deadline must reap its hanging test child');
  console.log('PASS contract runner: complete discovery, quoted names, server exclusion, failure propagation, global deadline and child cleanup');
} finally {
  rmSync(root, { recursive: true, force: true });
}
