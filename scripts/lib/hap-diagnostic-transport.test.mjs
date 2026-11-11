import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EventEmitter } from 'node:events';
import { frameRemoteCommand, decodeRemoteResult, readinessProcDeniedError, createNativeToolGuard, spawnChecked,
  spawnCheckedSync, createDiagnosticSignalScope, diagnosticLedgerRoot, diagnosticNamespaceRef } from './hap-diagnostic-transport.mjs';
const nonce = 'a'.repeat(32), hash = b => createHash('sha256').update(b).digest('hex');
const framed = (payload, code = 0) => Buffer.concat([Buffer.from(payload), Buffer.from(`\nRSD_REMOTE_V2:${nonce}:${code}\n`)]);
const result = stdout => ({ status: 0, stdout, stderr: Buffer.from('PRIVATE_STDERR') });
const node = realpathSync(process.execPath), tool = () => createNativeToolGuard(node, hash(readFileSync(node)));

test('fixed nonce envelope preserves bytes and reports client and remote status independently', () => {
  const payload = Buffer.from([0xff, 0x20, 0x0a]);
  const decoded = decodeRemoteResult(result(framed(payload)), nonce);
  assert.deepEqual(decoded.stdout, payload); assert.equal(decoded.remoteExitCode, 0);
  assert.equal(decoded.rawStdoutBytes, framed(payload).length); assert.equal(decoded.payloadStdoutBytes, payload.length);
  const failed = decodeRemoteResult(result(framed('partial private output', 9)), nonce);
  assert.equal(failed.remoteExitCode, 9); assert.equal(failed.status, 0); assert.equal(failed.stdout.length, 0);
  const command = frameRemoteCommand('exit 9', nonce);
  assert.match(command, /^\(\nexit 9\n\)/); assert.match(command, /reader_diag_remote_status=\$\?/);
});
test('missing, foreign, duplicate, malformed, nonASCII and truncated frames never produce a payload', () => {
  const valid = framed('private');
  for (const raw of [Buffer.from('private'), framed('private', 256), valid.subarray(0, -1),
    Buffer.from(`\nRSD_REMOTE_V2:${'b'.repeat(32)}:0\n`), Buffer.concat([valid, valid]),
    Buffer.concat([Buffer.from(`\nRSD_REMOTE_V2:${nonce}:`), Buffer.from([0xb0, 10])]),
    Buffer.from(`\nRSD_REMOTE_V2:${nonce}:00\n`)]) {
    const decoded = decodeRemoteResult(result(raw), nonce);
    assert.equal(decoded.remoteState, 'unknown'); assert.equal(decoded.stdout.length, 0);
  }
  for (const error of [{ code: 'ETIMEDOUT' }, { code: 'ENOBUFS' }]) {
    assert.equal(decodeRemoteResult({ ...result(valid), error }, nonce).remoteState, 'unknown');
  }
});
test('readiness keeps only exact framed proc permission denials as errors for its existing fallback', () => {
  for (const path of ['/proc/sys/kernel/random/boot_id', '/proc/uptime']) {
    for (const prefix of ['', 'cat: ', 'sh: cat: ', '/bin/sh: cat: ']) {
      const raw = { status: 0, stdout: framed(`${prefix}${path}: Permission denied\n`, 1), stderr: Buffer.alloc(0) };
      const denied = readinessProcDeniedError(`cat ${path}`, raw, nonce);
      assert.equal(denied?.message, `cat: ${path}: Permission denied`);
      assert.equal(decodeRemoteResult(raw, nonce).stdout.length, 0, 'remote failure never becomes a successful reader payload');
    }
    const stderr = { status: 0, stdout: framed('', 1), stderr: Buffer.from(`cat: ${path}: Permission denied`) };
    assert.equal(readinessProcDeniedError(`cat ${path}`, stderr, nonce)?.message, `cat: ${path}: Permission denied`);
  }
  const command = 'cat /proc/uptime', payload = 'cat: /proc/uptime: Permission denied';
  for (const raw of [
    {status:0,stdout:framed(payload,0)}, {status:7,stdout:framed(payload,1)},
    {status:0,error:{code:'EPERM'},stdout:framed(payload,1)}, {status:0,signal:'SIGTERM',stdout:framed(payload,1)},
    {status:0,stdout:Buffer.from(payload)}, {status:0,stdout:Buffer.concat([framed(payload,1),framed(payload,1)])},
    {status:0,stdout:framed('copied '+payload,1)}, {status:0,stdout:framed(payload+'\nextra',1)},
    {status:0,stdout:framed('cat: /proc/sys/kernel/random/boot_id: Permission denied',1)},
    {status:0,stdout:framed(payload,1),stderr:Buffer.from('unrelated failure')}
  ]) assert.equal(readinessProcDeniedError(command,raw,nonce),null);
  assert.equal(readinessProcDeniedError('cat /proc/private',{status:0,stdout:framed(payload,1)},nonce),null);
  assert.equal(readinessProcDeniedError(command,{status:0,stdout:framed(payload,1)},'b'.repeat(32)),null);
});
test('tool guard rejects changed native bytes or inode before dispatch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reader-tool-fixture-'));
  try {
    const path = join(dir, 'native-fixture'), first = Buffer.from([127,69,76,70,1]);
    writeFileSync(path, first); const guard = createNativeToolGuard(path, hash(first)); guard.check();
    writeFileSync(path, Buffer.from([127,69,76,70,2])); assert.throws(() => guard.check(), /TOOL_IDENTITY_CHANGED/);
    assert.throws(() => createNativeToolGuard(path + '.js', hash(first)), /NATIVE_TOOL_REQUIRED/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('local native Node child completion, timeout and output limits settle only after close', async () => {
  const ok = await spawnChecked(tool(), ['-e', 'process.stdout.write("ok")']);
  assert.equal(ok.error,undefined,'client status0 cannot conceal a spawn error');
  assert.equal(ok.status, 0); assert.equal(ok.stdout.toString(), 'ok');
  const timed = await spawnChecked(tool(), ['-e', 'setTimeout(()=>{},2000)'], { timeout: 35 });
  assert.equal(timed.error.code, 'ETIMEDOUT'); assert.equal(timed.signal, 'SIGKILL');
  const limited = await spawnChecked(tool(), ['-e', 'process.stdout.write("x".repeat(65536));setTimeout(()=>{},1000)'], { maxBuffer: 1024 });
  assert.equal(limited.error.code, 'ENOBUFS'); assert.ok(limited.stdout.length <= 1024); assert.ok(limited.rawStdoutBytes > 1024);
});
test('controlled cancellation kills owned local child and closes before caller cleanup', async () => {
  const controller = new AbortController();
  const work = spawnChecked(tool(), ['-e', 'setTimeout(()=>{},2000)'], { signal: controller.signal });
  setTimeout(() => controller.abort(), 35);
  const closed = await work;
  assert.equal(closed.error.code, 'DIAGNOSTIC_CANCELLED'); assert.equal(closed.signal, 'SIGKILL');
});
test('synchronous readiness may defer SIGTERM but signal drain prevents the next dispatch', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'reader-signal-fixture-'));
  try {
    const file = join(dir, 'parent.mjs');
    const module = new URL('./hap-diagnostic-transport.mjs', import.meta.url).href;
    writeFileSync(file, `import {createDiagnosticSignalScope,createNativeToolGuard,spawnCheckedSync} from ${JSON.stringify(module)};\n` +
      `const scope=createDiagnosticSignalScope();const t=createNativeToolGuard(${JSON.stringify(node)},${JSON.stringify(hash(readFileSync(node)))});\n` +
      'process.stdout.write("START\\n");spawnCheckedSync(t,["-e","setTimeout(()=>{},180)"],{timeout:1000});\n' +
      'await scope.settleSignals();if(scope.signal.aborted)process.stdout.write("CANCEL_BEFORE_BMS\\n");else process.stdout.write("BAD_BMS\\n");scope.dispose();\n');
    // This is a private local Node program, never HDC or a device script.
    const { spawn } = await import('node:child_process');
    const child = spawn(node, [file], { stdio: ['ignore','pipe','pipe'] });
    let output = '', signalSent = false;
    child.stdout.on('data', b => {
      output += b;
      if (!signalSent && output.includes('START')) { signalSent = true; child.kill('SIGTERM'); }
    });
    const status = await new Promise(resolve => child.once('close', resolve));
    assert.equal(status, 0); assert.match(output, /CANCEL_BEFORE_BMS/); assert.doesNotMatch(output, /BAD_BMS/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('fixed host ledger does not follow READER_LOCK_DIR and scope removes only its own signal listeners', () => {
  const previous = process.env.READER_LOCK_DIR;
  try { const first = diagnosticLedgerRoot(); process.env.READER_LOCK_DIR = '/synthetic/other';
    assert.equal(diagnosticLedgerRoot(), first); assert.equal(diagnosticNamespaceRef(first), diagnosticNamespaceRef(first));
  } finally { if (previous === undefined) delete process.env.READER_LOCK_DIR; else process.env.READER_LOCK_DIR = previous; }
  const emitter = new EventEmitter(), scope = createDiagnosticSignalScope(emitter);
  emitter.emit('SIGTERM'); assert.equal(scope.signal.aborted, true); assert.equal(scope.reason, 'SIGTERM');
  scope.dispose(); assert.equal(emitter.listenerCount('SIGTERM'), 0);
});
