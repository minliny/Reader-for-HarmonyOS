#!/usr/bin/env node
/**
 * Read-only HDC preflight.
 *
 * Turns the 2026-10-27 / 2026-10-28 field lessons into a deterministic,
 * bounded checklist so a device call is attempted "right the first time"
 * instead of being diagnosed by hand each session.
 *
 * Hard guarantees:
 *   - Never starts, kills, restarts, retargets or rewrites anything.
 *   - Never changes ports, lock roots, proxies or server context.
 *   - Never retries on its own; each HDC call is one bounded invocation.
 *   - Every HDC call goes through reader-hdc-lease.mjs, the sole entry point.
 *   - Environment-variable stripping is never reported as proof that no
 *     system TUN / transparent proxy is present.
 *
 * Usage:
 *   node tools/reader-hdc-preflight.mjs \
 *     --hdc <absolute hdc path> \
 *     --target <exact target, e.g. 127.0.0.1:5555> \
 *     [--server-key 127.0.0.1:8710] [--json]
 *
 * Exit codes: 0 READY, 1 NEEDS_ACTION, 2 STOP, 3 usage error.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectListeners } from './reader-hdc-foreground.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEASE = resolve(HERE, 'reader-hdc-lease.mjs');
const DEFAULT_SERVER_KEY = '127.0.0.1:8710';
const TARGET_RE = /^[A-Za-z0-9._:\[\]-]{1,256}$/;
const SERVER_RE = /^[A-Za-z0-9._:\[\]-]{1,256}$/;
const PROXY_VARS = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'SOCKS_PROXY',
  'http_proxy', 'https_proxy', 'all_proxy', 'socks_proxy'];

const STEPS = [];
const note = (id, severity, detail, action) => STEPS.push({ id, severity, detail, action });

function parseEndpoint(serverKey) {
  const s = String(serverKey).trim();
  const bracketed = s.match(/^\[([^\]]+)\]:(\d+)$/);
  const raw = bracketed ? { host: bracketed[1], port: Number(bracketed[2]) }
    : (() => { const i = s.lastIndexOf(':'); return i > 0 ? { host: s.slice(0, i), port: Number(s.slice(i + 1)) } : null; })();
  if (!raw || !Number.isInteger(raw.port) || raw.port <= 0 || raw.port > 65535) return null;
  const host = raw.host === '0.0.0.0' || raw.host === '::' ? '127.0.0.1' : raw.host;
  return { host, port: raw.port };
}

function parseTargetState(listing, target) {
  const rows = listing.split(/\r?\n/).map(line => line.trim().split(/\s+/))
    .filter(columns => columns[0] === target);
  if (rows.length === 0) return 'absent';
  if (rows.length !== 1) return 'ambiguous';
  const columns = rows[0];
  // Verbose HDC listings can include a transport column before the state.
  const state = /^(TCP|USB|UART|SERIAL)$/i.test(columns[1]) ? columns[2] : columns[1];
  return /^(Connected|Disconnected|Connecting|Offline|Unknown)$/i.test(state) ? state.toLowerCase() : 'unknown';
}

function probeTcp(host, port, timeoutMs = 1500) {
  return new Promise(done => {
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      socket.destroy();
      done(value);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function directEnvironment() {
  const env = { ...process.env };
  for (const name of PROXY_VARS) delete env[name];
  return { ...env, NO_PROXY: '*', no_proxy: '*' };
}

function runLease(hdc, target, serverKey, args, timeoutMs = 12000) {
  return spawnSync(process.execPath, [
    LEASE, '--hdc', hdc, '--target', target, '--server-key', serverKey,
    '--wait-ms', '5000', '--timeout-ms', String(timeoutMs), '--', ...args,
  ], { encoding: 'utf8', timeout: timeoutMs + 5000, env: directEnvironment() });
}

function isLanAddress(host) {
  if (/^127\./.test(host) || host === 'localhost' || host === '::1') return false;
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || /:/.test(host);
}

async function inspect(option) {
  const { hdc, target, serverKey } = option;

  // 1. Inputs: absolute executable + exact target + server key.
  let inputOk = true;
  if (!isAbsolute(hdc)) { note('input', 'block', '--hdc must be an absolute path'); inputOk = false; }
  else {
    try { accessSync(hdc, constants.X_OK); }
    catch { note('input', 'block', `hdc not executable: ${hdc}`); inputOk = false; }
  }
  if (!TARGET_RE.test(target) || target.startsWith('-')) { note('input', 'block', `invalid exact target: ${target}`); inputOk = false; }
  if (!SERVER_RE.test(serverKey)) { note('input', 'block', `invalid server key: ${serverKey}`); inputOk = false; }
  if (inputOk) note('input', 'ok', `hdc + exact target ${target} + server ${serverKey}`);

  const endpoint = parseEndpoint(serverKey);
  if (inputOk && !endpoint) { note('server-endpoint', 'block', `cannot parse server endpoint: ${serverKey}`); inputOk = false; }

  // 2. Server endpoint reachability. Failure here is a server/address problem,
  //    not proof the phone is unauthorized.
  let reachable = false;
  if (inputOk) {
    const started = Date.now();
    reachable = await probeTcp(endpoint.host, endpoint.port);
    note('server-tcp', reachable ? 'ok' : 'block',
      reachable ? `${endpoint.host}:${endpoint.port} reachable in ${Date.now() - started}ms`
        : `${endpoint.host}:${endpoint.port} unreachable; check the server process and endpoint, not the phone`,
      reachable ? undefined : `Confirm the server is running and the endpoint is correct. Do not change ports or route through a proxy to "fix" this.`);
  }

  // 3. Local listener ownership (only meaningful for a local server on macOS).
  const localServer = endpoint && (endpoint.host === '127.0.0.1' || endpoint.host === 'localhost');
  if (inputOk && reachable && localServer && process.platform === 'darwin') {
    try {
      const observation = inspectListeners(endpoint.port);
      if (observation.listeners.length === 1) {
        note('listener', 'ok', `single listener pid ${observation.listeners[0].pid} (${observation.listeners[0].command}) on 127.0.0.1:${endpoint.port}`);
      } else {
        note('listener', 'warn', `${observation.listeners.length} listeners on port ${endpoint.port}; ownership is ambiguous`,
          'Identify the intended listener and stop/coordinate the others with their owners before installing.');
      }
    } catch (error) {
      // An incomplete listener inventory must not be reported as healthy.
      note('listener', 'warn', `listener inventory unavailable: ${error.message}`,
        'Do not treat this as "no proxy / healthy". Re-inspect the real listener process by hand.');
    }
  } else if (localServer && process.platform !== 'darwin') {
    note('listener', 'note', 'local listener inventory is only implemented for macOS; skipped');
  } else if (endpoint && !localServer) {
    note('listener', 'note', 'remote server: local listener inventory does not apply');
  }

  // 4. Proxy environment. The lease strips these for every HDC call, so their
  //    presence is informational, not a defect. This is never proof of "no
  //    system TUN proxy".
  const present = PROXY_VARS.filter(name => process.env[name] !== undefined);
  if (present.length) {
    note('proxy-env', 'note', `proxy vars set: ${present.join(', ')}; lease strips them for each HDC call`,
      'If connections still fail, verify the actual route/process/socket for a system TUN proxy. Clearing env vars is not proof.');
  } else {
    note('proxy-env', 'note', 'no proxy env vars; stripping is not proof that no system TUN proxy exists');
  }

  // 5. Target/server location consistency (heuristic, never a hard block).
  if (endpoint && inputOk) {
    if (localServer && isLanAddress(target.split(':')[0])) {
      note('consistency', 'warn', `local server ${serverKey} with LAN-looking target ${target}`,
        'Confirm the device actually attaches to this server; a LAN target is not a local-server device by default.');
    } else if (!localServer && /^127\./.test(target)) {
      note('consistency', 'note', `loopback target ${target} is scoped to remote server ${serverKey}`);
    }
  }

  // 6. checkserver through the lease (host-only, bounded).
  let serverOk = false;
  if (inputOk && reachable) {
    const result = runLease(hdc, target, serverKey, ['checkserver'], 10000);
    const text = `${result.stdout || ''}${result.stderr || ''}`.trim();
    serverOk = result.status === 0 && !/not\s+running/i.test(text);
    note('checkserver', serverOk ? 'ok' : 'block',
      serverOk ? `checkserver: ${text || 'ok'}` : `checkserver failed (exit ${result.status}): ${text || 'no output'}`,
      serverOk ? undefined : 'Start the server through the lease maintenance path, or fix the endpoint. Do not loop-kill or change ports.');
  }

  // 7. Target state via `list targets -v`.
  let targetState = 'unknown';
  if (serverOk) {
    const result = runLease(hdc, target, serverKey, ['list', 'targets', '-v'], 10000);
    const text = `${result.stdout || ''}${result.stderr || ''}`;
    if (result.status !== 0) {
      note('targets', 'block', `list targets failed (exit ${result.status}): ${text.trim() || 'no output'}`);
    } else {
      targetState = parseTargetState(text, target);
      if (targetState === 'absent') {
        note('targets', 'warn', `target ${target} not listed`,
          `tconn to attach it: node tools/reader-hdc-lease.mjs --hdc <hdc> --target ${target} -- tconn ${target}`);
      } else if (targetState === 'ambiguous') {
        note('targets', 'block', `multiple rows report the exact target ${target}`);
      } else {
        if (targetState === 'connected') note('targets', 'ok', `${target} Connected`);
        else note('targets', 'warn', `${target} reported ${targetState}`,
          'Offline/Unknown does not prove the phone denied authorization. Check device TCP and authorization separately; do not reconnect in a loop.');
      }
    }
  }

  // 8. Stale foreground ledger. It is advisory only; actual listener wins.
  if (localServer && process.platform === 'darwin') {
    try {
      const leaseRoot = resolve(process.env.READER_HDC_LEASE_ROOT
        || resolve(process.env.READER_LOCK_DIR || tmpdir(), 'reader-hdc-target-leases'));
      const serverRef = createHash('sha256').update(serverKey).digest('hex').slice(0, 12);
      const ledger = JSON.parse(readFileSync(resolve(leaseRoot, `${serverRef}.foreground.json`), 'utf8'));
      if (ledger && Number.isInteger(ledger.pid)) {
        let live = true;
        try { process.kill(ledger.pid, 0); } catch (error) { if (error?.code === 'ESRCH') live = false; }
        if (!live) note('foreground-ledger', 'warn', `foreground.json pid ${ledger.pid} is not alive`,
          'The ledger is stale; trust the actual listener, not this file. Do not use it to claim ownership.');
        else note('foreground-ledger', 'note', `foreground.json pid ${ledger.pid} alive; verify it matches the real listener`);
      }
    } catch { /* absent or unreadable ledger is not itself a failure */ }
  }

  const hasBlock = STEPS.some(s => s.severity === 'block');
  const hasWarn = STEPS.some(s => s.severity === 'warn');
  const result = hasBlock ? 'STOP' : hasWarn ? 'NEEDS_ACTION' : 'READY';
  return {
    result,
    target, serverKey, hdc,
    targetState,
    steps: STEPS,
    next: STEPS.filter(s => s.severity === 'block' || s.severity === 'warn').map(s => s.action).filter(Boolean),
  };
}

function parseArgs(argv) {
  const out = { serverKey: DEFAULT_SERVER_KEY, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--help') { out.help = true; continue; }
    if (key === '--json') { out.json = true; continue; }
    if (!['--hdc', '--target', '--server-key'].includes(key)) throw new Error(`unknown option: ${key}`);
    const value = argv[i + 1];
    if (value === undefined) throw new Error(`missing value for ${key}`);
    i += 1;
    if (key === '--hdc') out.hdc = value;
    else if (key === '--target') out.target = value;
    else out.serverKey = value;
  }
  if (out.help) return out;
  if (!out.hdc) throw new Error('--hdc is required');
  if (!out.target) throw new Error('--target is required');
  return out;
}

function render(report) {
  const mark = { ok: '[ok]  ', note: '[note]', warn: '[warn]', block: '[fail]' };
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));
  for (const step of report.steps) console.log(`${mark[step.severity]} ${pad(step.id, 17)} ${step.detail}`);
  console.log('');
  console.log(`RESULT: ${report.result}`);
  if (report.next.length) {
    console.log('Next (run manually; do not auto-retry or change ports):');
    for (const item of report.next) console.log(`  - ${item}`);
  }
}

async function main(argv) {
  const option = parseArgs(argv);
  if (option.help) {
    console.log('Usage: node tools/reader-hdc-preflight.mjs --hdc <abs hdc> --target <exact target> [--server-key 127.0.0.1:8710] [--json]');
    return 0;
  }
  const report = await inspect(option);
  if (option.json) console.log(JSON.stringify(report, null, 2));
  else render(report);
  return report.result === 'READY' ? 0 : report.result === 'NEEDS_ACTION' ? 1 : 2;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main(process.argv.slice(2))
    .then(code => { process.exitCode = code; })
    .catch(error => { console.error(`reader-hdc-preflight: ${error.message}`); process.exitCode = 3; });
}

export { inspect, parseEndpoint, parseTargetState };
