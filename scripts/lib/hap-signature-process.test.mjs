import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { canOverlapHapSignature, startHapSignatureProcess } from './hap-signature-process.mjs';

const announcesAndWaits = `
  require('node:fs').writeFileSync(process.argv[1], String(process.pid));
  setInterval(() => {}, 1000);
`;

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'reader-test-hap-signer-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

async function waitForPid(marker) {
  const deadline = Date.now() + 4000;
  do {
    if (existsSync(marker)) {
      const pid = Number(readFileSync(marker, 'utf8'));
      if (Number.isSafeInteger(pid) && pid > 0) return pid;
    }
    await delay(20);
  } while (Date.now() < deadline);
  assert.fail('fixture verifier did not start');
}

test('only a native executable enters the concurrent verifier', t => {
  const launcher = join(fixture(t), 'java');
  writeFileSync(launcher, '#!/bin/sh\nexit 0\n');
  assert.equal(canOverlapHapSignature(process.execPath), true);
  assert.equal(canOverlapHapSignature(launcher), false);
  assert.equal(canOverlapHapSignature(launcher + '.cmd'), false);
});

test('the verifier captures its original stdout, stderr and zero or nonzero exit status', async t => {
  const root = fixture(t);
  for (const status of [0, 1]) {
    const child = startHapSignatureProcess(process.execPath, ['-e',
      `console.log('verifier stdout'); console.error('verifier stderr'); process.exitCode = ${status};`], root);
    try {
      assert.deepEqual(await child.result, { status, stdout: 'verifier stdout\n', stderr: 'verifier stderr\n', commandError: undefined });
    } finally { await child.stop(); }
  }
  const missing = startHapSignatureProcess(join(root, 'missing-verifier'), [], root);
  try {
    assert.equal((await missing.result).commandError, 'ENOENT');
  } finally { await missing.stop(); }
});

test('a verifier starts during synchronous inspection and is reaped after an inspection error', async t => {
  const root = fixture(t);
  const marker = join(root, 'verifier-pid');
  const signer = startHapSignatureProcess(process.execPath, ['-e', announcesAndWaits, marker], root);
  let pid;
  await assert.rejects(async () => {
    try {
      const sleep = new Int32Array(new SharedArrayBuffer(4));
      const deadline = Date.now() + 4000;
      while (!existsSync(marker) && Date.now() < deadline) Atomics.wait(sleep, 0, 0, 10);
      assert.ok(existsSync(marker), 'verifier starts while the inspecting thread is occupied');
      pid = await waitForPid(marker);
      throw new Error('archive validation failed');
    } finally { await signer.stop(); }
  }, /archive validation failed/);
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('SIGTERM aborts the verifier before the owning process exits', { skip: process.platform === 'win32' }, async t => {
  const root = fixture(t);
  const marker = join(root, 'verifier-pid');
  const script = `
    import { startHapSignatureProcess } from ${JSON.stringify(new URL('./hap-signature-process.mjs', import.meta.url).href)};
    const signer = startHapSignatureProcess(process.execPath, ['-e', ${JSON.stringify(announcesAndWaits)}, process.argv[1]], process.cwd());
    try { await signer.result; }
    catch (error) { process.exitCode = error.exitCode; }
    finally { await signer.stop().catch(() => {}); }
  `;
  const parent = spawn(process.execPath, ['--input-type=module', '-e', script, marker], { cwd: root, stdio: 'ignore' });
  const closed = new Promise(resolveClose => parent.once('close', resolveClose));
  try {
    const pid = await waitForPid(marker);
    assert.equal(parent.kill('SIGTERM'), true);
    assert.equal(await closed, 143);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  } finally {
    if (parent.exitCode === null && parent.signalCode === null) parent.kill('SIGTERM');
    await closed;
  }
});
