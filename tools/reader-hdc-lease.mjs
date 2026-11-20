#!/usr/bin/env node
/**
 * Shared-server HDC lease.
 *
 * Every host-side HDC invocation that can touch a shared device should run
 * through this wrapper.  The lease is a cross-process mkdir lock keyed by the
 * shared HDC server. A server can multiplex several targets, but its
 * session/channel state is shared; serializing only by target still permits
 * the contention that caused the 8710 incident. While held it records the
 * caller, server and exact argv, then releases the lock even when the child is
 * interrupted. The caller selects any service maintenance deliberately;
 * this wrapper never restarts HDC or changes targets on its own.
 *
 *   node tools/reader-hdc-lease.mjs --target 127.0.0.1:5555 \
 *     --hdc /absolute/path/hdc -- node-command args...
 *
 * The command after `--` is appended to the HDC executable.  No shell is
 * involved, so arguments cannot be interpreted as shell syntax.  Set
 * READER_HDC_LEASE_ROOT to use a project-specific temporary directory.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync, mkdirSync, readFileSync, renameSync,
  rmSync, writeFileSync,
} from 'node:fs';
import { isAbsolute, parse, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { startForegroundServer } from './reader-hdc-foreground.mjs';

const DEFAULT_ROOT = resolve(process.env.READER_LOCK_DIR || tmpdir(), 'reader-hdc-target-leases');
const DEFAULT_WAIT_MS = 30000;
const DEFAULT_SERVER_KEY = '127.0.0.1:8710';
const POLL_MS = 100;

const fail = message => { throw new Error(message); };
const targetRef = target => createHash('sha256').update(target).digest('hex').slice(0, 12);
const canonicalServerKey = value => String(value).trim()
  .replace(/^\[::ffff:([^\]]+)\]:/, '$1:').replace(/^::ffff:/, '')
  .replace(/^localhost:/, '127.0.0.1:').replace(/^\[::1\]:/, '127.0.0.1:');

// Bind service operations to their server-wide lease and device operations to
// their exact target. Callers decide whether maintenance is appropriate and
// coordinate users of that server before disrupting their sessions.
function admitCommand(argv, serverKey, target, maintenanceReason) {
  const args = [...argv];
  let server, selected;
  while (args.length && args[0].startsWith('-') && !['-h', '-v', '-m'].includes(args[0])) {
    const option = args.shift();
    if (option === '-p') continue;
    if (!['-s', '-t'].includes(option) || !args.length) fail('unsupported HDC global option');
    if (option === '-s') {
      if (server !== undefined) fail('duplicate HDC server');
      server = canonicalServerKey(args.shift());
    } else {
      if (selected !== undefined) fail('duplicate HDC target');
      selected = args.shift();
    }
  }
  if (server !== undefined && server !== serverKey) fail('HDC server differs from lease');
  if (selected !== undefined && selected !== target) fail('HDC target differs from lease');
  const verb = args[0];
  if (maintenanceReason !== undefined && (!maintenanceReason.trim() || maintenanceReason.length > 500 || /[\r\n\0]/.test(maintenanceReason))) {
    fail('maintenance reason must be a nonempty single line');
  }
  if (verb === 'start' || verb === 'kill') {
    if (target !== 'maintenance' || selected !== undefined || args.length > 2 ||
        (args.length === 2 && args[1] !== '-r')) fail('start/kill requires the server maintenance lease and optional -r');
    // Starting must be able to create the server. Killing must not start an
    // absent one just to issue the command.
    return { command: [...(verb === 'kill' ? ['-p'] : []), '-s', serverKey, ...args], timeoutMs: 10000, serviceMaintenance: true };
  }
  if (verb === '-m') {
    if (target !== 'maintenance' || selected !== undefined || args.length !== 1 || serverKey !== '127.0.0.1:8710') {
      fail('foreground server requires the local server maintenance lease');
    }
    return { command: ['-m', '-s', serverKey], timeoutMs: 10000, serviceMaintenance: true, foreground: true };
  }
  const hostOnly = ['list', 'checkserver', '-h', '-v'].includes(verb);
  if (!hostOnly && !['tconn', 'reconnect', 'shell', 'file', 'install', 'fport'].includes(verb)) {
    fail('HDC command denied: unsupported or unmanaged command');
  }
  if (verb === 'list' && (args[1] !== 'targets' || args.slice(2).some(v => v !== '-v'))) fail('only list targets is allowed');
  if (['checkserver', '-h', '-v'].includes(verb) && args.length !== 1) fail('unexpected host command arguments');
  if (verb === 'tconn' && (args[1] !== target || args.length > 3 || (args[2] && args[2] !== '-remove'))) fail('tconn requires the exact lease target');
  if (verb === 'reconnect' && (args.length !== 2 || args[1] !== target || selected !== undefined || target === 'maintenance')) {
    fail('reconnect requires the exact lease target');
  }
  return { command: ['-p', '-s', serverKey, ...(!hostOnly && verb !== 'tconn' && verb !== 'reconnect' ? ['-t', target] : []), ...args],
    timeoutMs: verb === 'install' ? 180000 : verb === 'file' ? 120000 : 30000 };
}

const now = () => new Date().toISOString();
const pidAlive = pid => {
  try { process.kill(pid, 0); return true; } catch (error) {
    if (error?.code === 'ESRCH') return false;
    return true;
  }
};
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

function parseArgs(argv) {
  const separator = argv.indexOf('--');
  if (separator < 0) fail('command separator -- is required');
  const options = {};
  const accepted = new Set(['--target', '--hdc', '--server-key', '--lock-root', '--wait-ms', '--agent-id', '--timeout-ms', '--maintenance-reason']);
  for (let i = 0; i < separator; i += 2) {
    const key = argv[i];
    if (!accepted.has(key) || options[key] !== undefined || i + 1 >= separator) fail('invalid or duplicate startup option');
    options[key] = argv[i + 1];
  }
  for (const key of ['--target', '--hdc']) if (typeof options[key] !== 'string' || !options[key]) fail(`${key} is required`);
  if (!/^[A-Za-z0-9._:\[\]-]{1,256}$/.test(options['--target']) || options['--target'].startsWith('-')) fail('invalid exact target');
  if (!isAbsolute(options['--hdc']) || /[\0\r\n]/.test(options['--hdc'])) fail('--hdc must be an absolute path');
  const root = resolve(options['--lock-root'] ?? process.env.READER_HDC_LEASE_ROOT ?? DEFAULT_ROOT);
  if (root === parse(root).root) fail('lock root cannot be filesystem root');
  const waitMs = Number(options['--wait-ms'] ?? DEFAULT_WAIT_MS);
  if (!Number.isInteger(waitMs) || waitMs < 0 || waitMs > 3600000) fail('--wait-ms must be an integer in 0..3600000');
  const command = argv.slice(separator + 1);
  if (!command.length) fail('at least one HDC argument is required after --');
  const serverKey = canonicalServerKey(options['--server-key'] ?? process.env.READER_HDC_SERVER_KEY ?? DEFAULT_SERVER_KEY);
  if (!/^[A-Za-z0-9._:\[\]-]{1,256}$/.test(serverKey)) fail('invalid server key');
  const agentId = String(options['--agent-id'] ?? process.env.CODEX_AGENT_ID ?? process.env.AGENT_ID ?? 'unspecified');
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(agentId)) fail('invalid agent id');
  const admitted = admitCommand(command, serverKey, options['--target'], options['--maintenance-reason']);
  const timeoutMs = Number(options['--timeout-ms'] ?? admitted.timeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > admitted.timeoutMs) fail('--timeout-ms must be positive and cannot exceed command budget');
  return { target: options['--target'], hdc: options['--hdc'], serverKey, root, waitMs: admitted.serviceMaintenance ? 0 : waitMs, command: admitted.command, timeoutMs, agentId, maintenanceReason: options['--maintenance-reason'], foreground: admitted.foreground === true };
}

function appendEvent(root, event) {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  appendFileSync(resolve(root, 'events.jsonl'), `${JSON.stringify(event)}\n`, { mode: 0o600 });
}

function readOwner(lockDir) {
  try {
    const owner = JSON.parse(readFileSync(resolve(lockDir, 'owner.json'), 'utf8'));
    if (!Number.isInteger(owner.pid) || owner.pid <= 0 || typeof owner.token !== 'string') return null;
    return owner;
  } catch (_) { return null; }
}

async function acquireLease({ root, target, targetRefValue, lockRefValue, waitMs, owner }) {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const lockDir = resolve(root, `${lockRefValue ?? targetRefValue}.lock`);
  const deadline = Date.now() + waitMs;
  for (;;) {
    // Populate a private staging directory first, then publish it with one
    // same-filesystem rename.  A crash cannot leave an owner-less live lock.
    const staging = `${lockDir}.new-${process.pid}-${randomUUID()}`;
    try {
      mkdirSync(staging, { mode: 0o700 });
      writeFileSync(resolve(staging, 'owner.json'), `${JSON.stringify(owner, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      renameSync(staging, lockDir);
      appendEvent(root, { type: 'acquire', at: now(), ...owner });
      return { lockDir };
    } catch (error) {
      try { rmSync(staging, { recursive: true, force: true }); } catch {}
      if (!['EEXIST', 'ENOTEMPTY'].includes(error?.code)) throw error;
      const previous = readOwner(lockDir);
      if (previous === null) {
        // An incomplete owner record is not safely reclaimable.  Waiting and
        // failing is safer than deleting a lock another process may own.
        if (Date.now() >= deadline) fail(`target lease is busy with unreadable owner: ${lockDir}`);
      } else if (!previous.foregroundStartPending && !previous.commandStartPending && !pidAlive(previous.pid) && !(previous.childPid && pidAlive(previous.childPid))) {
        // Rename is atomic on the same filesystem.  Only the process that wins
        // this rename may reclaim the stale lock, avoiding rm/race deletion.
        const stale = `${lockDir}.stale-${process.pid}-${randomUUID()}`;
        try {
          renameSync(lockDir, stale);
          rmSync(stale, { recursive: true, force: true });
          appendEvent(root, { type: 'reclaim-stale', at: now(), previous, by: owner });
          continue;
        } catch (renameError) {
          if (!['ENOENT', 'EEXIST'].includes(renameError?.code)) throw renameError;
        }
      }
      if (Date.now() >= deadline) fail(`target lease wait timed out: ${lockDir}`);
      await sleep(POLL_MS);
    }
  }
}

function releaseLease(root, lockDir, owner) {
  const current = readOwner(lockDir);
  if (!current || current.token !== owner.token) {
    appendEvent(root, { type: 'release-skipped', at: now(), ...owner });
    return;
  }
  // Rename first so a waiter cannot observe a partially removed lock.
  const releasing = `${lockDir}.release-${process.pid}-${randomUUID()}`;
  try {
    renameSync(lockDir, releasing);
    rmSync(releasing, { recursive: true, force: true });
    appendEvent(root, { type: 'release', at: now(), ...owner });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

export function hdcDirectEnvironment(environment = process.env) {
  const direct = { ...environment };
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'SOCKS_PROXY']) {
    delete direct[name]; delete direct[name.toLowerCase()];
  }
  return { ...direct, NO_PROXY: '*', no_proxy: '*' };
}

// A bounded synchronous batch can retain the exact same server lease across
// observation, a real application write barrier, final recheck and install.
// The HDC binary is only invoked here, with the same command admission rules.
export async function withHdcCommandSession({ hdc, target, serverKey, waitMs = DEFAULT_WAIT_MS }, action) {
  const parsed = parseArgs(['--hdc', hdc, '--target', target, '--server-key', serverKey,
    '--wait-ms', String(waitMs), '--', 'list', 'targets', '-v']);
  const ref = targetRef(target), serverRef = targetRef(parsed.serverKey);
  const owner = { token: randomUUID(), pid: process.pid, ppid: process.ppid, agentId: parsed.agentId,
    serverKey: parsed.serverKey, serverRef, target, targetRef: ref, hdc, startedAt: now(), purpose: 'bounded-storage-deployment' };
  const lease = await acquireLease({ ...parsed, targetRefValue: ref, lockRefValue: serverRef, owner });
  const started = Date.now();
  let live = true;
  const saveOwner = () => {
    const pending = resolve(lease.lockDir, 'owner.pending.json');
    writeFileSync(pending, JSON.stringify(owner), { mode: 0o600 });
    renameSync(pending, resolve(lease.lockDir, 'owner.json'));
  };
  const session = Object.freeze({ hdc, target, serverKey: parsed.serverKey,
    runSync(args, options = {}) {
      if (!live || Date.now() - started > 600000) fail('HDC deployment session expired');
      const admitted = admitCommand(args, parsed.serverKey, target);
      if (admitted.serviceMaintenance) fail('HDC deployment session cannot maintain shared service');
      const timeoutMs = options.timeoutMs ?? admitted.timeoutMs;
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > admitted.timeoutMs) fail('HDC command exceeds its bounded budget');
      // A parent crash during spawnSync cannot expose the child PID. Retain the
      // uncertain lock for explicit reconciliation rather than reclaiming it.
      owner.commandStartPending = true; owner.command = admitted.command; saveOwner();
      const result = spawnSync(hdc, admitted.command, { encoding: options.encoding ?? 'utf8',
        maxBuffer: options.maxBuffer ?? 16 * 1024 * 1024, env: hdcDirectEnvironment(options.env),
        timeout: timeoutMs, killSignal: 'SIGKILL', stdio: 'pipe' });
      owner.commandStartPending = false; saveOwner();
      if (result.error) throw result.error;
      if (result.status !== 0 && !options.allowFailure) fail(`HDC command failed (${result.status}): ${result.stderr || result.stdout}`);
      return result;
    },
  });
  try { return await action(session); }
  finally { live = false; if (!owner.commandStartPending) releaseLease(parsed.root, lease.lockDir, owner); }
}

function runChild(hdc, command, owner, root, lockDir, timeoutMs) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(hdc, command, { stdio: 'inherit', env: hdcDirectEnvironment() });
    let timedOut = false, cancelled = false, killTimer, spawnError;
    const stop = () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      killTimer ??= setTimeout(() => child.kill('SIGKILL'), 1000);
    };
    const forward = () => { cancelled = true; stop(); };
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, forward);
    const timer = setTimeout(() => {
      timedOut = true;
      appendEvent(root, { type: 'command-timeout', at: now(), ...owner, timeoutMs });
      stop();
    }, timeoutMs);
    child.once('spawn', () => {
      owner.childPid = child.pid;
      const pending = resolve(lockDir, 'owner.pending.json');
      writeFileSync(pending, JSON.stringify(owner), { mode: 0o600 });
      renameSync(pending, resolve(lockDir, 'owner.json'));
    });
    child.once('error', error => { spawnError = error; });
    child.once('close', (code, signal) => {
      clearTimeout(timer); clearTimeout(killTimer);
      for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.removeListener(name, forward);
      const exitCode = timedOut ? 124 : cancelled ? 1 : code ?? 1;
      appendEvent(root, { type: 'command-exit', at: now(), ...owner, exitCode, signal });
      if (spawnError) rejectRun(spawnError); else resolveRun(exitCode);
    });
  });
}

async function main(argv) {
  const options = parseArgs(argv);
  const ref = targetRef(options.target);
  const serverRef = targetRef(options.serverKey);
  const owner = {
    token: randomUUID(), pid: process.pid, ppid: process.ppid,
    agentId: options.agentId, serverKey: options.serverKey, serverRef,
    target: options.target, targetRef: ref,
    hdc: options.hdc, command: options.command, maintenanceReason: options.maintenanceReason, startedAt: now(),
  };
  const lease = await acquireLease({ ...options, targetRefValue: ref, lockRefValue: serverRef, owner });
  let exitCode = 1;
  let release = true;
  try {
    if (options.foreground) {
      // Persist before spawning: if this wrapper dies before recording the
      // child, another agent must reconcile the uncertain owner, not reclaim.
      owner.foregroundStartPending = true;
      writeFileSync(resolve(lease.lockDir, 'owner.json'), JSON.stringify(owner), { mode: 0o600 });
      release = false;
      const result = await startForegroundServer({ hdc: options.hdc, command: options.command,
        root: options.root, serverRef, timeoutMs: options.timeoutMs, owner,
        onSpawn: pid => {
          owner.childPid = pid;
          writeFileSync(resolve(lease.lockDir, 'owner.json'), JSON.stringify(owner), { mode: 0o600 });
        } });
      release = result.safeToRelease;
      if (!release) appendEvent(options.root, { type: 'release-retained', at: now(), ...owner });
      exitCode = result.exitCode;
    } else exitCode = await runChild(options.hdc, options.command, owner, options.root, lease.lockDir, options.timeoutMs);
  } finally {
    if (release) releaseLease(options.root, lease.lockDir, owner);
  }
  process.exitCode = exitCode;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2)).catch(error => { console.error(`reader-hdc-lease: ${error.message}`); process.exitCode = 2; });
}

export { admitCommand, acquireLease, canonicalServerKey, releaseLease, targetRef };
