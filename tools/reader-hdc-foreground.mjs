/** Bounded, ownership-checked local HDC foreground startup.
 * Invoked only while reader-hdc-lease owns the local server lease. */
import { spawn, spawnSync } from 'node:child_process';
import { openSync, closeSync, writeFileSync, renameSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

export function hdcDirectEnvironment(environment = process.env) {
  const direct = { ...environment };
  for (const name of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'SOCKS_PROXY']) {
    delete direct[name]; delete direct[name.toLowerCase()];
  }
  return { ...direct, NO_PROXY: '*', no_proxy: '*' };
}

/** Only the observed WebDAV stat warning concerns a separate mounted file
 * system. Unknown warnings, partial socket records and errors remain fatal. */
export function validateLsofWarning(stderr) {
  const warning = String(stderr).trim();
  if (!warning) return false;
  if (!/^lsof: WARNING: can't stat\(\) webdav file system \/Volumes\/[^\r\n]+\r?\n\s+Output information may be incomplete\.\r?\n\s+assuming "dev=[0-9a-fA-F]+" from mount table$/.test(warning)) {
    throw new Error('lsof returned an unrecognized warning; listener inventory is not trusted');
  }
  return true;
}

export function parseLsofListeners(stdout, port) {
  const text = String(stdout).trim();
  if (!text) return [];
  let pid = 0, command = '', file = false, processListeners = 0;
  const listeners = [];
  for (const line of text.split(/\r?\n/)) {
    if (/^p[1-9]\d*$/.test(line)) {
      if (pid > 0 && (file || processListeners === 0)) throw new Error('lsof returned an incomplete listener process');
      pid = Number(line.slice(1)); command = ''; file = false; processListeners = 0;
    }
    else if (line.startsWith('c') && pid > 0 && line.length > 1) command = line.slice(1);
    else if (/^f\d+$/.test(line) && pid > 0 && command) file = true;
    else if (line.startsWith('n') && pid > 0 && command && file && line.slice(1).endsWith(`:${port}`)) {
      listeners.push({ pid, command, address: line.slice(1) }); file = false; processListeners += 1;
    } else throw new Error('lsof returned an incomplete or malformed listener record');
  }
  if (file || !listeners.length || processListeners === 0) throw new Error('lsof returned an incomplete listener record');
  return listeners;
}

export function inspectListeners(port = 8710) {
  const result = spawnSync('/usr/sbin/lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpcn'],
    { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  const warning = validateLsofWarning(result.stderr);
  if (result.status !== 0 && !(result.status === 1 && !result.stdout.trim())) {
    throw new Error(`lsof listener inventory failed (${result.status})`);
  }
  const listeners = parseLsofListeners(result.stdout, port);
  if (result.status === 0 && !listeners.length) throw new Error('lsof reported success without listener records');
  return { listeners, warning };
}

export function matchesOwnedListener(observation, pid, executable, port = 8710) {
  const listener = observation.listeners[0];
  return observation.listeners.length === 1 && listener.pid === pid &&
    listener.command === basename(executable) && listener.address === `127.0.0.1:${port}`;
}

export function ownedProcessNameMatches(pid, executable) {
  const result = spawnSync('/bin/ps', ['-p', String(pid), '-o', 'comm='],
    { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0 || result.stderr.trim()) return false;
  return basename(result.stdout.trim()) === basename(executable);
}

export function connectLocal(port = 8710) {
  return new Promise(resolveResult => {
    const socket = createConnection({ host: '127.0.0.1', port });
    let done = false;
    const finish = result => { if (done) return; done = true; socket.destroy(); resolveResult(result); };
    socket.setTimeout(300, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

const alive = child => child.exitCode === null && child.signalCode === null;
async function stopOwned(child) {
  if (!alive(child)) return true;
  child.kill('SIGTERM');
  const deadline = Date.now() + 1000;
  while (alive(child) && Date.now() < deadline) await delay(25);
  if (alive(child)) { child.kill('SIGKILL'); await delay(100); }
  return !alive(child);
}

/** `deps` is only used by the offline tests; the public CLI never sets it. */
export async function startForegroundServer({ hdc, command, root, serverRef, timeoutMs, owner, onSpawn, deps = {} }) {
  const observe = deps.observe ?? inspectListeners;
  const connect = deps.connect ?? connectLocal;
  const processMatches = deps.processMatches ?? ownedProcessNameMatches;
  const spawnServer = deps.spawnServer ?? ((path, args, logPath) => {
    const fd = openSync(logPath, 'a', 0o600);
    try { return spawn(path, args, { detached: true, stdio: ['ignore', fd, fd], env: hdcDirectEnvironment() }); }
    finally { closeSync(fd); }
  });
  const stop = deps.stop ?? stopOwned;
  const persist = deps.persist ?? ((path, data) => {
    const pending = `${path}.${process.pid}.tmp`;
    writeFileSync(pending, JSON.stringify(data), { mode: 0o600 });
    renameSync(pending, path);
  });
  let child;
  try {
    const before = observe();
    if (before.warning) console.error('lsof reported the known unrelated WebDAV stat warning');
    if (before.listeners.length !== 0 || await connect()) {
      console.error('Local HDC server already listening; refusing to replace it');
      return { exitCode: 1, safeToRelease: true };
    }
    child = spawnServer(hdc, command, resolve(root, `${serverRef}.foreground.log`));
    await new Promise((resolveSpawn, rejectSpawn) => {
      child.once('spawn', resolveSpawn);
      child.once('error', rejectSpawn);
    });
    onSpawn(child.pid);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && alive(child)) {
      const observation = observe();
      if (matchesOwnedListener(observation, child.pid, hdc) && processMatches(child.pid, hdc) && await connect()) {
        persist(resolve(root, `${serverRef}.foreground.json`), { pid: child.pid, executable: hdc,
          command, serverKey: owner.serverKey, startedAt: new Date().toISOString(), agentId: owner.agentId });
        child.unref();
        console.log(`Local HDC foreground server ready (pid ${child.pid})`);
        return { exitCode: 0, safeToRelease: true };
      }
      await delay(100);
    }
    console.error('Local HDC foreground server did not establish its own listener');
    return { exitCode: 1, safeToRelease: await stop(child) };
  } catch (error) {
    console.error(`Local HDC foreground startup failed: ${error instanceof Error ? error.message : String(error)}`);
    return { exitCode: 1, safeToRelease: child === undefined ? true : await stop(child) };
  }
}
