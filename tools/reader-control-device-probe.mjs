#!/usr/bin/env node
/**
 * Exact-target, preserve-data HDC transport for scripts/vm-journeys.mjs.
 * One NDJSON request is processed at a time while holding the shared server
 * lease. Each operation following readiness requires caller confirmation.
 * Quit or EOF closes this session and releases its lease.
 */
import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  accessSync, appendFileSync, constants, lstatSync, mkdirSync,
  readFileSync, realpathSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, parse, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { acquireLease, canonicalServerKey, hdcDirectEnvironment, releaseLease, targetRef } from './reader-hdc-lease.mjs';
import { inspectNativePng, sha256 } from './lib/native-ui-evidence.mjs';
import { remoteVmServer } from './ui-contract/collectors/harmonyos/candidate-evidence.mjs';
import { focusWindowCommand } from './ui-contract/collectors/harmonyos/focus-window.mjs';

const BUNDLE = 'io.reader.minliny';
const TIMEOUT_MS = 30000;
const TRANSFER_TIMEOUT_MS = 120000;
const IDLE_MS = 60000;
const SESSION_MS = 600000;
const hdcEnvironment = hdcDirectEnvironment();
const MAX_OUTPUT = 4 * 1024 * 1024;
const fatalOutput = /Connect server failed|Device not found|No devices|LIFECYCLE_TIMEOUT|SceneBoard exits 4times|kernel panic|guest reset|9568332|9568320|Error loading shared library|Error relocating|\berror\s*:|\bfailed\b/i;
const fatalLogTransportOutput = /Connect server failed|Device not found|No devices|LIFECYCLE_TIMEOUT|SceneBoard exits 4times|kernel panic|guest reset|9568332|9568320|Error loading shared library|Error relocating|^(?:\/bin\/|\/system\/bin\/)?sh:[^\r\n]*\bsyntax error\b/im;
const logRead = args => Array.isArray(args) && args[0] === 'shell' && args[1] === 'hilog' && args[2] === '-x';
const inputDispatch = args => Array.isArray(args) && args[0] === 'shell' && args[1] === 'uitest' &&
  args[2] === 'uiInput' && args[3] !== 'help';
const inputDispatchOK = result => String(result.stdout ?? '').trim() === 'No Error' &&
  String(result.stderr ?? '').trim() === '';
const commandOK = (result, args = []) => !result.error && result.status === 0 &&
  (!inputDispatch(args) || inputDispatchOK(result)) &&
  !(logRead(args) ? fatalLogTransportOutput : fatalOutput).test(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);
const fail = message => { throw new Error(message); };

function readOperation(line) {
  try { return JSON.parse(line); }
  catch { fail('invalid device operation JSON'); }
}

function publicCommandResult(args, result, redact, privateBundleOutput = false) {
  const isInput = args[0] === 'shell' && args[1] === 'uitest' && args[2] === 'uiInput' && args[3] === 'inputText';
  const publicArgs = isInput ? [...args.slice(0, -1), `[length:${args.at(-1).length}]`] : args;
  const sensitive = isInput || privateBundleOutput;
  return {
    args: publicArgs, status: result.status, signal: result.signal ?? null,
    error: result.error ? (sensitive ? 'device-command-error' : redact(result.error.message)) : null,
    stdout: sensitive ? '' : redact(result.stdout),
    stderr: sensitive ? '' : redact(result.stderr),
  };
}

function optionsFrom(argv) {
  const options = {};
  const keys = ['--target', '--hdc', '--server', '--output-dir'];
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    if (!keys.includes(key) || options[key] !== undefined || argv[index + 1] === undefined) {
      fail('invalid/duplicate startup option');
    }
    options[key] = argv[index + 1];
  }
  if (keys.some(key => !options[key])) fail('all four startup options are required');
  const target = options['--target'];
  const server = options['--server'];
  if (server !== remoteVmServer || !/^(?:127\.0\.0\.1|\[::1\]):[0-9]{1,5}$/u.test(target)) {
    fail('Probe requires the configured LAN server and exact loopback VM target');
  }
  for (const key of ['--hdc', '--output-dir']) {
    if (!isAbsolute(options[key]) || /[\0\r\n]/u.test(options[key])) fail(key + ' must be an absolute path');
  }
  const outputDir = resolve(options['--output-dir']);
  if (outputDir === parse(outputDir).root) fail('output directory cannot be filesystem root');
  return { target, hdc: options['--hdc'], server, outputDir };
}

function exactFields(operation, names) {
  if (operation === null || typeof operation !== 'object' || Array.isArray(operation)) fail('operation must be a JSON object');
  const allowed = ['op', 'preflightConfirmed', ...names];
  if (Object.keys(operation).some(key => !allowed.includes(key))) fail('unknown operation field');
}
function integer(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) fail(`${name} must be an integer in ${min}..${max}`);
  return String(value);
}
function remotePath(path, extension) {
  if (typeof path !== 'string' || !/^\/data\/local\/tmp\/reader-control-[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(png|json)$/.test(path)) fail('device path must be a reader-control-* png/json file directly in /data/local/tmp');
  if (extension && !path.endsWith(extension)) fail(`operation requires ${extension}`);
  return path;
}
function dragArguments(operation) {
  return [integer(operation.fromX, 0, 16384, 'fromX'), integer(operation.fromY, 0, 16384, 'fromY'),
    integer(operation.toX, 0, 16384, 'toX'), integer(operation.toY, 0, 16384, 'toY'),
    integer(operation.velocity ?? 600, 200, 40000, 'velocity')];
}
function operationPlan(operation, outputDir) {
  if (operation === null || typeof operation !== 'object' || Array.isArray(operation)) {
    fail('operation must be a JSON object');
  }
  if (operation.op === 'quit') {
    exactFields(operation, []);
    return { kind: 'quit' };
  }
  if (operation.op === 'uiContractReadiness') {
    exactFields(operation, ['targetKind', 'vmLocation']);
    if (operation.targetKind !== 'vm' || operation.vmLocation !== 'remote') {
      fail('Readiness requires a remote VM');
    }
    return { kind: 'uiContractReadiness' };
  }
  if (operation.preflightConfirmed !== true) fail('fresh external boot/SceneBoard/exact-target preflight confirmation is required');
  const shell = (...args) => ({ kind: 'command', args: ['shell', ...args] });
  if (operation.op === 'click' || operation.op === 'longClick') {
    exactFields(operation, ['x', 'y']);
    return shell('uitest', 'uiInput', operation.op, integer(operation.x, 0, 16384, 'x'), integer(operation.y, 0, 16384, 'y'));
  }
  if (operation.op === 'inputText') {
    exactFields(operation, ['x', 'y', 'text']);
    const text = operation.text;
    if (typeof text !== 'string' || !/^[\p{L}\p{N}][\p{L}\p{N}._-]{0,63}$/u.test(text)) {
      fail('inputText requires one fixture search word');
    }
    return shell('uitest', 'uiInput', 'inputText', integer(operation.x, 0, 16384, 'x'),
      integer(operation.y, 0, 16384, 'y'), text);
  }
  if (operation.op === 'inputSourceJourneyUrl') {
    exactFields(operation, ['x', 'y']);
    return shell('uitest', 'uiInput', 'inputText', integer(operation.x, 0, 16384, 'x'),
      integer(operation.y, 0, 16384, 'y'), 'https://novel-a.reader-journeys.invalid/fixtures/v9-source.json');
  }
  if (operation.op === 'swipe' || operation.op === 'drag') {
    exactFields(operation, ['fromX', 'fromY', 'toX', 'toY', 'velocity']);
    return shell('uitest', 'uiInput', operation.op, ...dragArguments(operation));
  }
  if (operation.op === 'keyEvent') {
    exactFields(operation, ['key']);
    if (!['Back', 'Home', 'Enter'].includes(operation.key)) fail('only Back/Home/Enter key events are allowed');
    return shell('uitest', 'uiInput', 'keyEvent', operation.key === 'Enter' ? '2054' : operation.key);
  }
  if (operation.op === 'dumpLayout' || operation.op === 'screenCap') {
    exactFields(operation, ['path']);
    return shell('uitest', operation.op, '-p', remotePath(operation.path, operation.op === 'screenCap' ? '.png' : '.json'));
  }
  if (operation.op === 'recv') {
    exactFields(operation, ['path']);
    const path = remotePath(operation.path);
    return { kind: 'command', args: ['file', 'recv', path, resolve(outputDir, basename(path))], localPath: resolve(outputDir, basename(path)) };
  }
  if (['startRemoteJourneyFixture', 'startRemoteEmptySearchFixture', 'startRemoteBackupJourneyFixture'].includes(operation.op)) {
    exactFields(operation, []);
    const fixture = operation.op === 'startRemoteEmptySearchFixture'
      ? ['--ps', 'readerPublicFixture', 'empty-sources', '--ps', 'readerPublicFixtureBook', 'long-directory']
      : ['--ps', 'readerPublicFixture', 'vm-journeys'];
    if (operation.op === 'startRemoteBackupJourneyFixture') fixture.push('--pb', 'readerPublicFixtureRecovery', 'true');
    return { ...shell('aa','start','-a','EntryAbility','-b',BUNDLE,'-m','entry',
      ...fixture), kind:'startRemoteJourneyFixture' };
  }
  if (operation.op === 'openJourneyInvalidBook') {
    exactFields(operation, []);
    return { ...shell('aa', 'start', '-a', 'EntryAbility', '-b', BUNDLE, '-m', 'entry',
      '--pb', 'readerPublicFixtureInvalidBook', 'true'), kind: 'openJourneyInvalidBook' };
  }
  if (operation.op === 'journeyFixtureLog') {
    exactFields(operation, []);
    return shell('hilog', '-x', '-T', 'ReaderVmJourney');
  }
  if (operation.op === 'journeyEmptySearchFixtureLog') {
    exactFields(operation, []);
    return shell('hilog', '-x', '-e', 'Public UI fixture long-directory book verified');
  }
  if (operation.op === 'journeyLayoutLog') {
    exactFields(operation, []);
    return shell('hilog', '-x', '-e', 'READER_LAYOUT_INVARIANTS');
  }
  if (operation.op === 'journeyTransitionLog') {
    exactFields(operation, []);
    return shell('hilog', '-x', '-e', 'READER_TRANSITION_');
  }
  if (operation.op === 'journeyShareLog') {
    exactFields(operation, []);
    return shell('hilog', '-x', '-e', 'READER_JOURNEY_SHARE');
  }
  if (operation.op === 'journeyTtsAuditionLog') {
    exactFields(operation, []);
    return shell('hilog', '-x', '-e', 'READER_VM_TTS_AUDITION');
  }
  if (operation.op === 'journeySampledAction') {
    exactFields(operation, ['action', 'captures']);
    const action = operation.action;
    if (!action || !['click', 'keyEvent', 'swipe', 'longClick'].includes(action.op))
      fail('sampled action requires a supported fixture input');
    const plan = operationPlan({ ...action, preflightConfirmed: true }, outputDir);
    if (!Array.isArray(operation.captures) || operation.captures.length < 2 || operation.captures.length > 4)
      fail('sampled action requires two to four capture slots');
    let previous = -1;
    const usedPaths = new Set();
    const captures = operation.captures.map(slot => {
      if (!slot || typeof slot !== 'object' || Object.keys(slot).length !== 2) fail('invalid capture slot');
      const atMs = Number(integer(slot.atMs, 0, 400, 'atMs'));
      const path = remotePath(slot.path, '.png');
      if (atMs <= previous || usedPaths.has(path)) fail('capture slots must have unique increasing times and paths');
      previous = atMs;
      usedPaths.add(path);
      return { atMs, path };
    });
    return { kind: 'journeySampledAction', args: plan.args, captures };
  }
  if (operation.op === 'uiContractFocusWindow') {
    exactFields(operation, []);
    return { kind: 'command', args: focusWindowCommand };
  }
  if (operation.op === 'uiContractInstalledIdentity') {
    exactFields(operation, []);
    return { ...shell('bm', 'dump', '-n', BUNDLE), privateBundleOutput: true };
  }
  if (operation.op === 'force-stop') {
    exactFields(operation, ['explicitPermit']);
    if (operation.explicitPermit !== true) fail('force-stop requires explicitPermit:true for the current operation');
    return shell('aa', 'force-stop', BUNDLE);
  }
  fail('operation is not on the diagnostic whitelist');
}

function evidenceEntryExists(path) {
  try { lstatSync(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function pngExtent(bytes) {
  return { bytes: bytes.length, chunks: inspectNativePng(bytes).chunks };
}
async function acquireTargetLock(target, hdc, server) {
  const reference = targetRef(target);
  // HDC session/channel state is shared by all targets on one server.
  const serverKey = canonicalServerKey(server);
  const serverRef = targetRef(serverKey);
  const root = process.env.READER_HDC_LEASE_ROOT || resolve(process.env.READER_LOCK_DIR || tmpdir(), 'reader-hdc-target-leases');
  const owner = {
    pid: process.pid, ppid: process.ppid, agentId: process.env.CODEX_AGENT_ID || process.env.AGENT_ID || 'unspecified',
    target, targetRef: reference, serverKey, serverRef, hdc, command: ['probe-session'], startedAt: new Date().toISOString(), token: randomUUID(),
  };
  const configuredWait = Number(process.env.READER_HDC_LEASE_WAIT_MS || '30000');
  const waitMs = Number.isInteger(configuredWait) && configuredWait >= 0 && configuredWait <= 3600000 ? configuredWait : 30000;
  const lease = await acquireLease({ root, target, targetRefValue: reference, lockRefValue: serverRef, waitMs, owner });
  return {
    targetRef: reference,
    release() { releaseLease(root, lease.lockDir, owner); },
  };
}

async function probe(options) {
  accessSync(options.hdc, constants.X_OK);
  if (!statSync(options.hdc).isFile()) fail('hdc must be an executable file');
  const lock = await acquireTargetLock(options.target, options.hdc, options.server);
  let input;
  let stopping = false;
  let idleTimer;
  const deadline = performance.now() + SESSION_MS;
  const burstAbort = new AbortController();
  const stop = () => { stopping = true; burstAbort.abort(); input?.close(); };
  const sessionTimer = setTimeout(stop, SESSION_MS);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  process.on('SIGHUP', stop);
  try {
    mkdirSync(options.outputDir, { recursive: true, mode: 0o700 });
    options.outputDir = realpathSync(options.outputDir);
    const log = resolve(options.outputDir, `reader-control-probe-${Date.now()}-${randomUUID()}.jsonl`);
    writeFileSync(log, '', { flag: 'wx', mode: 0o600 });
    const redact = value => String(value ?? '').split(options.target).join(`[target:${lock.targetRef}]`);
    let seq = 0;
    const record = value => {
      const row = {recordedAt:new Date().toISOString(),targetRef:lock.targetRef,seq:++seq,...value};
      const line = `${JSON.stringify(row)}\n`;
      appendFileSync(log, line);
      process.stdout.write(line);
    };
    const prefix = ['-p', '-s', options.server, '-t', options.target];
    let remoteVmReady = false;
    let parseBundleMetadata;

    const run = plan => {
      if (plan.localPath && evidenceEntryExists(plan.localPath)) fail('refusing to overwrite existing local evidence or symlink');
      const start = performance.now();
      if (stopping || deadline <= start) fail('probe is stopping');
      const startedAt = new Date().toISOString();
      const timeout = Math.min(plan.localPath ? TRANSFER_TIMEOUT_MS : TIMEOUT_MS, Math.max(1, Math.floor(deadline - start)));
      const result = spawnSync(options.hdc, [...prefix, ...plan.args], {
        shell: false, encoding: 'utf8', timeout, env: hdcEnvironment, maxBuffer: MAX_OUTPUT, stdio: ['ignore', 'pipe', 'pipe'],
      });
      const elapsedMs = performance.now() - start;
      let ok = commandOK(result, plan.args);
      let installed;
      if (ok && plan.privateBundleOutput) {
        try { installed = parseBundleMetadata(String(result.stdout)); }
        catch { ok = false; }
        if (!installed?.appVersion) ok = false;
      }
      // Keep bundle readback and possible echoes of text out of the receipt.
      record({ event: 'command', startedAt, elapsedMs, ok,
        ...publicCommandResult(plan.args, result, redact, plan.privateBundleOutput),
        ...(installed ? { installed } : {}) });
      if (!ok) fail('device command failed or stop-condition output observed; no automatic retry');
      if (plan.localPath) {
        const bytes = readFileSync(plan.localPath);
        const extent = plan.localPath.endsWith('.png') ? pngExtent(bytes) :
          { bytes: bytes.length, jsonParsed: Boolean(JSON.parse(bytes.toString('utf8'))) };
        record({ event: 'capture-integrity', path: plan.localPath,
          sha256: sha256(bytes), ...extent, meaning: 'native file extent, parse and capture identity' });
      }
    };

    // One bounded burst holds the same target lease as its input. Timestamps
    // refer to host acquisition requests, not guest input or display frames.
    const sampleAction = async plan => {
      const start = performance.now();
      if (stopping || deadline <= start) fail('probe is stopping');
      const startedAt = new Date().toISOString();
      const execute = args => new Promise(resolveResult => {
        execFile(options.hdc, [...prefix, ...args], {
          shell: false, encoding: 'utf8', env: hdcEnvironment, maxBuffer: MAX_OUTPUT, signal: burstAbort.signal,
          timeout: Math.min(10000, Math.max(1, Math.floor(deadline - performance.now()))),
        }, (error, stdout, stderr) => resolveResult({ error, stdout, stderr, status: error ? Number(error.code) : 0 }));
      });
      const command = execute(plan.args);
      const captures = plan.captures.map(async ({ atMs, path }) => {
        await delay(atMs, undefined, { signal: burstAbort.signal });
        const requested = performance.now();
        const args = ['shell', 'uitest', 'screenCap', '-p', path];
        const result = await execute(args);
        const ok = commandOK(result, args);
        return { path, timestampMs: Math.round(requested - start),
          acquisitionMs: Math.round(performance.now() - requested), ok,
          ...(ok ? {} : { failure: publicCommandResult(args, result, redact) }) };
      });
      // Await all children before a transport failure can release the lease.
      const [action, ...sampled] = await Promise.allSettled([command, ...captures]);
      const screenshots = sampled.flatMap(item => item.status === 'fulfilled' ? [item.value] : []);
      const ok = action.status === 'fulfilled' && commandOK(action.value, plan.args) &&
        screenshots.length === captures.length && screenshots.every(item => item.ok);
      record({ event: 'command', startedAt, elapsedMs: performance.now() - start, ok, screenshots,
        ...(action.status === 'fulfilled' ? publicCommandResult(plan.args, action.value, redact) : {}) });
      if (!ok) fail('native input or screen burst failed; no automatic retry');
    };

    const readiness = async () => {
      const { readinessQueryOutput, targetReadiness } = await import('../scripts/lib/hap-delivery-evidence.mjs');
      const query = command => {
        if (stopping || deadline <= performance.now()) fail('probe is stopping');
        const result = spawnSync(options.hdc, [...prefix, 'shell', command], {
          shell: false, encoding: 'utf8', env: hdcEnvironment, timeout: Math.min(10000, Math.max(1, Math.floor(deadline - performance.now()))),
          maxBuffer: 1024 * 1024,
        });
        return readinessQueryOutput(command, result);
      };
      const listing = spawnSync(options.hdc, ['-p','-s',options.server,'list','targets','-v'],
        { shell: false, encoding: 'utf8', env: hdcEnvironment, timeout: 10000, maxBuffer: 1024 * 1024 });
      const exact = (listing.stdout ?? '').split(/\r?\n/u).filter(line => line.split(/\s+/u)[0] === options.target);
      if (!commandOK(listing) || exact.length !== 1 || !/\bConnected\b/u.test(exact[0])) fail('Exact target is not independently confirmed Connected');
      const checked = targetReadiness({ targetKind: 'vm', targetEndpoint: options.target, query });
      remoteVmReady = checked.status === 'PASS' && checked.bootCompleted === true &&
        checked.sceneBoardStable === true && checked.evidenceScope === 'guest-only' &&
        checked.emulatorLog?.status === 'NOT_PROVIDED' &&
        ['kernel-boot-id', 'vm-guest-boot-milestones-v1'].includes(checked.bootIdentitySource);
      record({ event: 'readiness', ...checked, hdcServer: options.server, targetKind: 'vm',
        exactConnected: true, vmLocation: 'remote' });
    };

    record({ event: 'ready', log, warning: 'Lock acquired only; boot readiness/authorization must already be established externally. No retries or service startup.' });
    input = createInterface({ input: process.stdin, crlfDelay: Infinity });
    const waitForInput = () => { idleTimer = setTimeout(stop, IDLE_MS); };
    waitForInput();
    for await (const line of input) {
      if (stopping) break;
      if (line.length > 32768) fail('operation line exceeds limit');
      if (line.trim() === '') continue;
      clearTimeout(idleTimer);
      const plan = operationPlan(readOperation(line), options.outputDir);
      if (plan.kind === 'quit') break;
      if (plan.kind === 'uiContractReadiness') await readiness();
      else {
        if (['startRemoteJourneyFixture', 'openJourneyInvalidBook'].includes(plan.kind) && !remoteVmReady) {
          fail('Remote public storage launch requires this probe’s verified remote VM');
        }
        if (plan.privateBundleOutput) ({ parseBundleMetadata } = await import('../scripts/hap-pipeline.mjs'));
        if (plan.kind === 'journeySampledAction') await sampleAction(plan);
        else run(plan);
      }
      waitForInput();
    }
    record({ event: 'closed', reason: stopping ? 'signal' : 'quit-or-eof' });
  } finally {
    clearTimeout(idleTimer);
    clearTimeout(sessionTimer);
    input?.close();
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
    process.off('SIGHUP', stop);
    lock.release();
  }
}

function selfTest() {
  const out = '/tmp/reader-vm-probe-self-test';
  const target = '127.0.0.1:5555';
  const args = ['--target', target, '--hdc', '/tool/hdc', '--server', remoteVmServer, '--output-dir', out];
  assert.deepEqual(optionsFrom(args), { target, hdc: '/tool/hdc', server: remoteVmServer, outputDir: out });
  assert.throws(() => optionsFrom(args.map(value => value === target ? '192.0.2.1:5555' : value)), /exact loopback/);
  const plan = (op, fields = {}) => operationPlan({ op, preflightConfirmed: true, ...fields }, out);
  const path = '/data/local/tmp/reader-control-journey-self-test.json';
  assert.deepEqual(plan('quit'), { kind: 'quit' });
  assert.deepEqual(plan('uiContractReadiness', { targetKind: 'vm', vmLocation: 'remote' }), { kind: 'uiContractReadiness' });
  assert.throws(() => plan('uiContractReadiness', { targetKind: 'physical' }), /remote VM/);
  assert.deepEqual(plan('dumpLayout', { path }).args, ['shell', 'uitest', 'dumpLayout', '-p', path]);
  assert.deepEqual(plan('recv', { path }).args, ['file', 'recv', path, resolve(out, basename(path))]);
  assert.throws(() => plan('recv', { path: '/data/local/tmp/../Reader.json' }), /reader-control/);
  assert.deepEqual(plan('longClick', { x: 15, y: 25 }).args, ['shell', 'uitest', 'uiInput', 'longClick', '15', '25']);
  assert.throws(() => plan('click', { x: 15, y: -1 }), /integer/);
  assert.deepEqual(plan('keyEvent', { key: 'Enter' }).args, ['shell', 'uitest', 'uiInput', 'keyEvent', '2054']);
  assert.equal(plan('inputText', { x: 1, y: 2, text: 'ReaderShelfNovel' }).args.at(-1), 'ReaderShelfNovel');
  assert.throws(() => plan('inputText', { x: 1, y: 2, text: 'Book & Other' }), /search word/);
  assert.throws(() => plan('force-stop'), /explicitPermit:true/);
  assert.deepEqual(plan('force-stop', { explicitPermit: true }).args, ['shell', 'aa', 'force-stop', BUNDLE]);
  assert.throws(() => plan('click', { x: 1, y: 2, preflightConfirmed: false }), /preflight confirmation/);
  assert.throws(() => plan('sampledDrag'), /whitelist/);
  assert.throws(() => plan('startRemoteEmptyShelf'), /whitelist/);
  assert.deepEqual(plan('startRemoteEmptySearchFixture'), { kind: 'startRemoteJourneyFixture', args:
    ['shell', 'aa', 'start', '-a', 'EntryAbility', '-b', BUNDLE, '-m', 'entry',
      '--ps', 'readerPublicFixture', 'empty-sources', '--ps', 'readerPublicFixtureBook', 'long-directory'] });
  assert.deepEqual(plan('journeyEmptySearchFixtureLog').args, ['shell', 'hilog', '-x', '-e', 'Public UI fixture long-directory book verified']);
  const transitionLogArgs = plan('journeyTransitionLog').args;
  assert.deepEqual(transitionLogArgs, ['shell', 'hilog', '-x', '-e', 'READER_TRANSITION_']);
  assert.deepEqual(plan('journeyTtsAuditionLog').args, ['shell', 'hilog', '-x', '-e', 'READER_VM_TTS_AUDITION']);
  assert.throws(() => plan('journeyTtsAuditionLog', { filter: '.*' }), /operation field/);
  assert.match(transitionLogArgs.at(-1), /^[A-Z_]+$/u);
  const guestShellFailure = "/bin/sh: syntax error: unexpected '('\n";
  assert.equal(commandOK({ status: 0, stdout: guestShellFailure, stderr: '' }, transitionLogArgs), false);
  assert.equal(commandOK({ status: 0, stdout: '', stderr: guestShellFailure }, transitionLogArgs), false);
  assert.equal(commandOK({ status: 0, stdout: '', stderr: '' }, transitionLogArgs), true);
  const nativeLog = '11-27 19:56:11.000 17907 17907 I A05244/Reader: READER_TRANSITION_FRAMES 3/0/1 ' +
    '{"detail":"/bin/sh: syntax error: recorded content"}\n';
  assert.equal(commandOK({ status: 0, stdout: nativeLog, stderr: '' }, transitionLogArgs), true);
  assert.deepEqual(plan('startRemoteBackupJourneyFixture').args.slice(-3), ['--pb', 'readerPublicFixtureRecovery', 'true']);
  assert.deepEqual(plan('openJourneyInvalidBook').args.slice(-3), ['--pb', 'readerPublicFixtureInvalidBook', 'true']);
  assert.equal(plan('inputSourceJourneyUrl', { x: 1, y: 2 }).args.at(-1), 'https://novel-a.reader-journeys.invalid/fixtures/v9-source.json');
  assert.throws(() => plan('inputSourceJourneyUrl', { x: 1, y: 2, url: 'https://example.com' }), /operation field/);
  assert.deepEqual(plan('drag', { fromX: 8, fromY: 13, toX: 29, toY: 43, velocity: 200 }).args,
    ['shell', 'uitest', 'uiInput', 'drag', '8', '13', '29', '43', '200']);
  const captures = [0, 150].map(atMs => ({ atMs, path: `/data/local/tmp/reader-control-journey-${atMs}.png` }));
  const action = { op: 'click', x: 1, y: 2 };
  assert.equal(plan('journeySampledAction', { action, captures }).kind, 'journeySampledAction');
  assert.throws(() => plan('journeySampledAction', { action, captures: [captures[0], captures[0]] }), /increasing/);
  assert.throws(() => plan('journeySampledAction', { action: { op: 'quit' }, captures }), /supported fixture input/);
  process.stdout.write('Reader VM transport self-test: PASS (no HDC)\n');
}

if (process.argv.length === 3 && process.argv[2] === '--self-test') selfTest();
else {
  try { await probe(optionsFrom(process.argv.slice(2))); }
  catch (error) { process.stderr.write('Reader VM transport stopped: ' + error.message + '\n'); process.exitCode = 1; }
}
