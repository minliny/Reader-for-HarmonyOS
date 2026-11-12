import { randomBytes, createHash } from 'node:crypto';
import { constants, openSync, closeSync, fstatSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

export const diagnosticNonce = () => randomBytes(16).toString('hex');
const asBuffer = value => Buffer.isBuffer(value) ? value : value instanceof Uint8Array ? Buffer.from(value) : Buffer.from(typeof value === 'string' ? value : '');
const hash = value => createHash('sha256').update(value).digest('hex');
export const diagnosticLedgerRoot = () => resolve(homedir(), '.reader-state/storage-admission-diagnostic-claims-v2');
export const diagnosticNamespaceRef = root => hash(JSON.stringify(['reader-diagnostic-ledger-v2', process.platform, resolve(root)]));

// A fixed shell envelope, not an arbitrary RPC. The caller supplies only the
// finite diagnostic command set. The subshell contains exit/set -e locally.
export function frameRemoteCommand(command, nonce) {
  if (typeof command !== 'string' || !command || command.includes('\0') || !/^[a-f0-9]{32}$/.test(nonce)) throw Error('INVALID_REMOTE_FRAME_INPUT');
  return `(\n${command}\n)\nreader_diag_remote_status=$?\nprintf '\\nRSD_REMOTE_V2:${nonce}:%s\\n' "$reader_diag_remote_status"`;
}
export function decodeRemoteResult(result, nonce) {
  if (!/^[a-f0-9]{32}$/.test(nonce)) throw Error('INVALID_REMOTE_FRAME_NONCE');
  const raw = asBuffer(result?.stdout), stderr = asBuffer(result?.stderr);
  const output = { ...result, stdout: Buffer.alloc(0), stderr, frameRequired: true,
    rawStdoutBytes: result?.rawStdoutBytes ?? raw.length, rawStderrBytes: result?.rawStderrBytes ?? stderr.length,
    payloadStdoutBytes: 0, remoteExitCode: null, remoteState: 'unknown', frameState: 'invalid' };
  if (result?.error || result?.status !== 0 || result?.signal) { output.frameState = 'client-failed'; return output; }
  const marker = Buffer.from(`\nRSD_REMOTE_V2:${nonce}:`);
  const at = raw.lastIndexOf(marker);
  if (at < 0 || raw.indexOf(marker) !== at) return output;
  const ending = raw.subarray(at + marker.length).toString('latin1');
  if (!/^(?:0|[1-9]\d{0,2})\r?\n$/.test(ending)) return output;
  const code = Number(ending.trim()); if (code > 255) return output;
  output.remoteExitCode = code; output.remoteState = code === 0 ? 'success' : 'failure'; output.frameState = 'valid';
  output.payloadStdoutBytes = at;
  // Remote failure is never supplied as a successful reader payload.
  if (code === 0) output.stdout = raw.subarray(0, at);
  return output;
}

// Preserve only the canonical readiness observer's two exact permission
// denials. The failed payload never becomes successful query text. Returning
// the fixed error lets procRead select its existing VM boot-evidence fallback.
export function readinessProcDeniedError(command, raw, nonce) {
  const path = command === 'cat /proc/sys/kernel/random/boot_id' ? '/proc/sys/kernel/random/boot_id' :
    command === 'cat /proc/uptime' ? '/proc/uptime' : null;
  if (path === null || !/^[a-f0-9]{32}$/.test(nonce ?? '')) return null;
  const decoded = decodeRemoteResult(raw, nonce);
  if (decoded.frameState !== 'valid' || decoded.remoteState !== 'failure' ||
      decoded.remoteExitCode <= 0) return null;
  const messages = [asBuffer(raw.stdout).subarray(0, decoded.payloadStdoutBytes), asBuffer(raw.stderr)]
    .map(bytes => bytes.toString('utf8').trim()).filter(Boolean);
  if (messages.length !== 1) return null;
  const denied = /^(?:(?:\/bin\/sh|sh):\s*)?(?:cat:\s*)?(\/proc\/(?:sys\/kernel\/random\/boot_id|uptime)):\s*Permission denied$/i.exec(messages[0]);
  return denied?.[1] === path ? new Error(`cat: ${path}: Permission denied`) : null;
}

function readNative(path) {
  if (/\.(?:[cm]?js|cmd|bat)$/i.test(path)) throw Error('NATIVE_TOOL_REQUIRED');
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile()) throw Error('NATIVE_TOOL_REQUIRED');
    const bytes = readFileSync(fd), after = fstatSync(fd, { bigint: true });
    const identity = s => [s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].map(String).join(':');
    if (identity(before) !== identity(after) || BigInt(bytes.length) !== after.size) throw Error('TOOL_IDENTITY_CHANGED');
    if (!(bytes.subarray(0, 4).equals(Buffer.from([127, 69, 76, 70])) || bytes.subarray(0, 2).equals(Buffer.from('MZ')))) throw Error('NATIVE_TOOL_REQUIRED');
    return { sha256: hash(bytes), identity: identity(after) };
  } finally { closeSync(fd); }
}
export function createNativeToolGuard(path, expectedSha256) {
  const initial = readNative(path);
  if (!/^[a-f0-9]{64}$/.test(expectedSha256 ?? '') || initial.sha256 !== expectedSha256) throw Error('TOOL_IDENTITY_CHANGED');
  return { path, sha256: initial.sha256, binding: 'trusted-fixed-path-rechecked',
    requiresNoConcurrentLocalToolWrites: true, atomicExecIdentity: false,
    check() { const current = readNative(path); if (current.sha256 !== initial.sha256 || current.identity !== initial.identity) throw Error('TOOL_IDENTITY_CHANGED'); } };
}
export function spawnCheckedSync(tool, args, options = {}) {
  tool.check();
  return spawnSync(tool.path, args, { ...options, encoding: null, shell: false });
}
export function spawnChecked(tool, args, { timeout = 10000, maxBuffer = 1024 * 1024, signal, ...options } = {}) {
  tool.check();
  if (signal?.aborted) return Promise.resolve({ status: null, error: { code: 'DIAGNOSTIC_CANCELLED' }, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) });
  return new Promise(resolveResult => {
    let child, failure, timer, stdoutBytes = 0, stderrBytes = 0, kept = 0;
    const stdout = [], stderr = [];
    const stop = code => { failure ??= { code }; clearTimeout(timer); if (child && !child.killed) child.kill('SIGKILL'); };
    const abort = () => stop('DIAGNOSTIC_CANCELLED');
    try { child = spawn(tool.path, args, { ...options, shell: false, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { resolveResult({ status: null, error, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }); return; }
    const collect = (chunks, isStdout) => chunk => {
      if (isStdout) stdoutBytes += chunk.length; else stderrBytes += chunk.length;
      const take = Math.min(chunk.length, Math.max(0, maxBuffer - kept));
      if (take) { chunks.push(chunk.subarray(0, take)); kept += take; }
      if (stdoutBytes + stderrBytes > maxBuffer) stop('ENOBUFS');
    };
    child.stdout.on('data', collect(stdout, true)); child.stderr.on('data', collect(stderr, false));
    child.once('error', error => { failure ??= error; });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    timer = setTimeout(() => stop('ETIMEDOUT'), timeout);
    child.once('close', (status, childSignal) => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      resolveResult({ status, signal: childSignal, error: failure, pid: child.pid,
        stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), rawStdoutBytes: stdoutBytes, rawStderrBytes: stderrBytes });
    });
  });
}

export function createDiagnosticSignalScope(emitter = process) {
  const controller = new AbortController(); let reason = null;
  const handlers = Object.fromEntries(['SIGINT', 'SIGTERM'].map(name => [name, () => { reason ??= name; controller.abort(); }]));
  for (const [name, handler] of Object.entries(handlers)) emitter.on(name, handler);
  return { signal: controller.signal, get reason() { return reason; },
    async settleSignals() { await new Promise(done => setImmediate(done)); },
    dispose() { for (const [name, handler] of Object.entries(handlers)) emitter.removeListener(name, handler); } };
}
