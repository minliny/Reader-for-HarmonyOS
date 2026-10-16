import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { assertBuildTools, REQUIRED_PNPM } from './reader-build-tools.mjs';

const root = mkdtempSync(resolve(tmpdir(), 'reader-input-safety-'));
const write = (path, data) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, data); };
try {
  const tools = resolve(root, 'tools');
  assert.throws(() => assertBuildTools(tools), /Prepare Hvigor/);
  write(resolve(tools, 'node_modules/pnpm/package.json'), JSON.stringify({ version: '10.27.0' }));
  assert.throws(() => assertBuildTools(tools), /Prepare Hvigor/);
  write(resolve(tools, 'node_modules/pnpm/package.json'), JSON.stringify({ version: REQUIRED_PNPM }));
  write(resolve(tools, 'node_modules/pnpm/bin/pnpm.cjs'), `console.log('${REQUIRED_PNPM}');`);
  assert.deepEqual(assertBuildTools(tools), { pnpm: REQUIRED_PNPM });
  write(resolve(tools, 'node_modules/pnpm/bin/pnpm.cjs'), "console.log('10.27.0');");
  assert.throws(() => assertBuildTools(tools), /executable\/version mismatch/);

  // The current provenance checker retains the original wrong Native/SDK and
  // same-dirty-input regressions, and adds symlink, ABI-header and smoke checks.
  await import('./test-native-input-preflight.mjs');

  // Exercise the real default lease path under a custom temp directory, with
  // Node standing in for HDC. No actual device operation can occur.
  const env = { ...process.env, TMPDIR: root, TMP: root, TEMP: root }; delete env.READER_HDC_LEASE_ROOT; delete env.READER_LOCK_DIR;
  const defaultLease = spawnSync(process.execPath, [resolve('tools/reader-hdc-lease.mjs'),
    '--target', 'fixture', '--hdc', process.execPath, '--', '-e', 'process.exit(0)'], { encoding: 'utf8', env });
  assert.equal(defaultLease.status, 0, defaultLease.stderr);
  assert.match(readFileSync(resolve(root, 'reader-hdc-target-leases/events.jsonl'), 'utf8'), /"type":"release"/);
  console.log('PASS build input safety: cold/vulnerable pnpm, dirty Core drift, stale native/vendor, portable HDC lease');
} finally { rmSync(root, { recursive: true, force: true }); }
