#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalServerKey } from './reader-hdc-lease.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lease = resolve(here, 'reader-hdc-lease.mjs');
const root = mkdtempSync(resolve(tmpdir(), 'reader-hdc-lease-test-'));
const run = args => new Promise((resolveRun, rejectRun) => {
  const child = spawn(process.execPath, [lease, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', rejectRun);
  child.on('close', code => resolveRun({ code, stdout, stderr }));
});

try {
  assert.equal(canonicalServerKey('::ffff:127.0.0.1:8710'), '127.0.0.1:8710');
  const base = ['--target', 'test-device:5555', '--hdc', process.execPath, '--lock-root', root, '--wait-ms', '2000'];
  const first = run([...base, '--agent-id', 'a', '--', '-e', 'setTimeout(() => {}, 300)']);
  await new Promise(resolveWait => setTimeout(resolveWait, 40));
  const second = run([...base, '--agent-id', 'b', '--', '-e', 'setTimeout(() => {}, 1)']);
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.code, 0, a.stderr);
  assert.equal(b.code, 0, b.stderr);
  const events = readFileSync(resolve(root, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(events.filter(event => event.type === 'acquire').map(event => event.agentId), ['a', 'b']);
  assert.equal(events.filter(event => event.type === 'release').length, 2);
  const immediate = await run([...base, '--agent-id', 'c', '--', '-e', 'setTimeout(() => {}, 1)']);
  assert.equal(immediate.code, 0, immediate.stderr);
  // VM and USB targets can share one HDC server. A target-only lock would let
  // these overlap; the server-level lock must serialize them as well.
  const otherBase = ['--target', 'other-device:5555', '--hdc', process.execPath, '--lock-root', root, '--wait-ms', '2000'];
  const crossFirst = run([...otherBase, '--agent-id', 'd', '--', '-e', 'setTimeout(() => {}, 300)']);
  await new Promise(resolveWait => setTimeout(resolveWait, 40));
  const crossSecond = run([...base, '--agent-id', 'e', '--', '-e', 'setTimeout(() => {}, 1)']);
  const [d, e] = await Promise.all([crossFirst, crossSecond]);
  assert.equal(d.code, 0, d.stderr);
  assert.equal(e.code, 0, e.stderr);
  const crossAcquires = readFileSync(resolve(root, 'events.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line))
    .filter(event => event.type === 'acquire').slice(-2).map(event => event.agentId);
  assert.deepEqual(crossAcquires, ['d', 'e']);
  console.log('reader HDC target lease serialization: PASS');
} finally {
  rmSync(root, { recursive: true, force: true });
}
