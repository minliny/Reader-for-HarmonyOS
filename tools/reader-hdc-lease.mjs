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
 * interrupted. It intentionally does not restart HDC or discover/switch
 * targets.
 *
 *   node tools/reader-hdc-lease.mjs --target 127.0.0.1:5555 \
 *     --hdc /absolute/path/hdc -- node-command args...
 *
 * The command after `--` is appended to the HDC executable.  No shell is
 * involved, so arguments cannot be interpreted as shell syntax.  Set
 * READER_HDC_LEASE_ROOT to use a project-specific temporary directory.
 */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync, mkdirSync, readFileSync, renameSync,
  rmSync, writeFileSync,
} from 'node:fs';
import { isAbsolute, parse, resolve } from 'node:path';

const DEFAULT_ROOT = '/private/tmp/reader-hdc-target-leases';
const DEFAULT_WAIT_MS = 30000;
const DEFAULT_SERVER_KEY = '127.0.0.1:8710';
const POLL_MS = 100;

const fail = message => { throw new Error(message); };
const targetRef = target => createHash('sha256').update(target).digest('hex').slice(0, 12);
const canonicalServerKey = value => String(value).trim().replace(/^::ffff:/, '').replace(/^\[|\]$/g, '');
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
  const accepted = new Set(['--target', '--hdc', '--server-key', '--lock-root', '--wait-ms', '--agent-id']);
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
  return { target: options['--target'], hdc: options['--hdc'], serverKey, root, waitMs, command, agentId };
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
      } else if (!pidAlive(previous.pid)) {
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

function runChild(hdc, command, owner, root, lockDir) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(hdc, command, { stdio: 'inherit', env: process.env });
    let settled = false;
    const forward = signal => { if (!child.killed) child.kill(signal); };
    process.once('SIGINT', () => forward('SIGINT'));
    process.once('SIGTERM', () => forward('SIGTERM'));
    child.once('error', error => { settled = true; rejectRun(error); });
    child.once('close', code => {
      if (settled) return;
      settled = true;
      appendEvent(root, { type: 'command-exit', at: now(), ...owner, exitCode: code });
      resolveRun(code ?? 1);
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
    hdc: options.hdc, command: options.command, startedAt: now(),
  };
  const lease = await acquireLease({ ...options, targetRefValue: ref, lockRefValue: serverRef, owner });
  let exitCode = 1;
  try {
    exitCode = await runChild(options.hdc, options.command, owner, options.root, lease.lockDir);
  } finally {
    releaseLease(options.root, lease.lockDir, owner);
  }
  process.exitCode = exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).catch(error => { console.error(`reader-hdc-lease: ${error.message}`); process.exitCode = 2; });
}

export { acquireLease, canonicalServerKey, releaseLease, targetRef };
