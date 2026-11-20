#!/usr/bin/env node
/**
 * Bounded debug-UI verifier. It starts exactly one existing device probe,
 * lets that probe own the HDC/target lease, and never invokes HDC itself.
 * Device use requires a fresh exact-target/boot/SceneBoard confirmation and
 * preserve-data install authorization from the operator; this tool is not a
 * build, installer or release gate.
 */
import { spawn as spawnProcess } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { evaluateLayout, assertionSummary, indexLayout, parseLayout } from './layout-snapshot.mjs';

const BUNDLE = 'io.reader.minliny';
const SCENE = /^[a-z][a-z0-9-]{0,31}$/;
const RUN = /^[A-Za-z0-9-]{8,64}$/;
const DEFAULT_SCENARIOS = new URL('./scenarios.json', import.meta.url);
const POLL_MS = 500;
const READY_TIMEOUT_MS = 15000;
const ACTION_BUDGET_MS = 30000;
const COMMAND_TIMEOUT_MS = 30000;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
const sleep = ms => delay(ms);

function readJson(path) {
  const text = readFileSync(path, 'utf8');
  try { return { text, value: JSON.parse(text) }; }
  catch (error) { fail(`${path}: invalid JSON (${error.message})`); }
}

export function parseArgs(argv) {
  const options = { expectFail: false, preflightConfirmed: false };
  const values = new Set(['--scenario', '--target', '--hdc', '--server', '--output-dir', '--manifest']);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--expect-fail') {
      if (options.expectFail) fail('duplicate --expect-fail');
      options.expectFail = true;
    } else if (key === '--preflight-confirmed') {
      if (options.preflightConfirmed) fail('duplicate --preflight-confirmed');
      options.preflightConfirmed = true;
    } else if (values.has(key)) {
      const value = argv[++index];
      if (value === undefined || value.length === 0 || value.startsWith('--')) fail(`${key} requires a value`);
      const name = key.slice(2).replace(/-([a-z])/g, (_m, letter) => letter.toUpperCase());
      if (options[name] !== undefined) fail(`duplicate ${key}`);
      options[name] = value;
    } else fail(`unknown option ${key}`);
  }
  for (const key of ['scenario', 'target', 'hdc', 'server', 'outputDir']) {
    if (typeof options[key] !== 'string') fail(`--${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)} is required`);
  }
  if (!/^[A-Za-z0-9._:\[\]-]{1,256}$/.test(options.target) || options.target.startsWith('-')) fail('invalid exact target');
  const colon = options.server.lastIndexOf(':');
  const host = colon > 0 ? options.server.slice(0, colon).replace(/^\[|\]$/g, '') : '';
  const port = colon > 0 ? options.server.slice(colon + 1) : '';
  if (colon < 1 || host.length === 0 || !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    fail('--server must be an explicit host and port');
  }
  for (const key of ['hdc', 'outputDir', ...(options.manifest === undefined ? [] : ['manifest'])]) {
    if (!isAbsolute(options[key]) || /[\0\r\n]/.test(options[key])) fail(`--${key === 'outputDir' ? 'output-dir' : key} must be an absolute path`);
  }
  if (options.outputDir === '/') fail('output directory cannot be filesystem root');
  return options;
}

export function validateScenario(scenario) {
  const allowed = ['id', 'scene', 'width', 'readyId', 'expect', 'actions', 'budgetMs'];
  if (scenario === null || typeof scenario !== 'object' || Array.isArray(scenario)) fail('scenario must be an object');
  if (Object.keys(scenario).some(key => !allowed.includes(key))) fail('unknown scenario field');
  if (typeof scenario.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(scenario.id)) fail('invalid scenario id');
  if (typeof scenario.scene !== 'string' || !SCENE.test(scenario.scene)) fail(`scenario ${scenario.id}: invalid scene`);
  if (scenario.width !== 320 && scenario.width !== 366) fail(`scenario ${scenario.id}: width must be 320 or 366`);
  if (typeof scenario.readyId !== 'string' || scenario.readyId.length === 0 || scenario.readyId.length > 128) {
    fail(`scenario ${scenario.id}: invalid readyId`);
  }
  if (scenario.budgetMs !== undefined && (!Number.isInteger(scenario.budgetMs) || scenario.budgetMs < 1000 || scenario.budgetMs > 60000)) {
    fail(`scenario ${scenario.id}: budgetMs must be 1000..60000`);
  }
  if (scenario.expect !== undefined) validateExpect(scenario.expect);
  if (scenario.actions !== undefined) {
    if (!Array.isArray(scenario.actions) || scenario.actions.length > 8) fail(`scenario ${scenario.id}: actions must be 0..8`);
    for (const action of scenario.actions) {
      const keys = action === null || typeof action !== 'object' || Array.isArray(action) ? [] : Object.keys(action);
      if (!(keys.includes('op') && (keys.includes('id') || keys.includes('key')))) fail(`scenario ${scenario.id}: invalid action`);
      if (keys.some(key => !['op', 'id', 'key', 'dy', 'expect'].includes(key))) fail(`scenario ${scenario.id}: unknown action field`);
      if (action.op === 'click' || action.op === 'scroll') {
        if (typeof action.id !== 'string' || action.id.length === 0) fail(`scenario ${scenario.id}: action id is required`);
      } else if (action.op === 'key') {
        if (!['Back', 'Home'].includes(action.key)) fail(`scenario ${scenario.id}: only Back/Home actions`);
      } else fail(`scenario ${scenario.id}: unsupported action`);
      if (action.op === 'scroll' && (!Number.isFinite(action.dy) || action.dy === 0 || Math.abs(action.dy) > 400)) {
        fail(`scenario ${scenario.id}: scroll dy must be -400..400 and non-zero`);
      }
      if (action.expect !== undefined) validateExpect(action.expect);
    }
  }
  return scenario;
}

function validateExpect(expect) {
  if (expect === null || typeof expect !== 'object' || Array.isArray(expect)) fail('expect must be an object');
  if (Object.keys(expect).some(key => !['nodes', 'order'].includes(key))) fail('unknown expect field');
  if (expect.nodes !== undefined && (!Array.isArray(expect.nodes) || expect.nodes.length > 32)) fail('expect.nodes must be 0..32');
  if (expect.order !== undefined && (!Array.isArray(expect.order) || expect.order.length > 16)) fail('expect.order must be 0..16');
  for (const node of expect.nodes ?? []) {
    if (node === null || typeof node !== 'object' || Array.isArray(node) || typeof node.id !== 'string') fail('expect node requires id');
    const fields = Object.keys(node);
    if (fields.some(key => !['id', 'exists', 'count', 'visible', 'enabled', 'textIncludes', 'heightVp', 'widthVp',
      'minHeightVp', 'maxHeightVp', 'minWidthVp', 'maxWidthVp', 'topAtLeastVp', 'topAtMostVp', 'leftAtLeastVp', 'leftAtMostVp'].includes(key))) {
      fail(`expect node ${node.id}: unknown field`);
    }
  }
  for (const pair of expect.order ?? []) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== 'string' || value.length === 0)) {
      fail('expect.order requires id pairs');
    }
  }
}

function loadScenario(source, id) {
  const { text, value } = readJson(source);
  if (value === null || typeof value !== 'object' || Array.isArray(value) || value.schema !== 1) fail('scenarios schema must be 1');
  if (!Array.isArray(value.scenarios)) fail('scenarios must be an array');
  if (text.length === 0) fail('scenarios file is empty');
  const matches = value.scenarios.filter(candidate => candidate?.id === id);
  if (matches.length !== 1) fail(`scenario ${id} must exist exactly once`);
  return { scenario: validateScenario(matches[0]), scenarios: value.scenarios, scenariosText: text };
}

function envWithoutProxy() {
  const env = { ...process.env };
  for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'SOCKS_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'socks_proxy']) delete env[key];
  env.NO_PROXY = '*'; env.no_proxy = '*';
  return env;
}

function probeSession(child) {
  const records = [];
  const waiters = [];
  let buffer = '';
  let sequence = 0;
  let stderr = '';
  let closed = false;
  let exit = null;
  const rejectAll = message => {
    while (waiters.length > 0) waiters.shift().reject(new Error(message));
  };
  child.stdout.setEncoding?.('utf8');
  child.stderr.setEncoding?.('utf8');
  child.stdout.on('data', chunk => {
    buffer += String(chunk);
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line.length === 0) continue;
      let record;
      try { record = JSON.parse(line); }
      catch { rejectAll(`probe emitted invalid JSON: ${line.slice(0, 200)}`); continue; }
      const recordIndex = sequence++;
      records.push(record);
      for (let index = waiters.length - 1; index >= 0; index -= 1) {
        if (recordIndex >= waiters[index].after && waiters[index].predicate(record)) {
          const waiter = waiters.splice(index, 1)[0];
          clearTimeout(waiter.timer);
          waiter.resolve(record);
        }
      }
    }
  });
  child.stderr.on('data', chunk => { stderr += String(chunk); });
  child.on('error', error => { exit = { error }; rejectAll(`probe could not start: ${error.message}`); });
  child.on('close', (status, signal) => {
    closed = true;
    exit = { status, signal };
    rejectAll(`probe exited${stderr ? `: ${stderr.trim().slice(0, 500)}` : ''}`);
  });
  const waitRecord = (predicate, label, timeoutMs = COMMAND_TIMEOUT_MS, after = 0) => {
    if (after === 0) {
      const previous = records.find(predicate);
      if (previous !== undefined) return Promise.resolve(previous);
    }
    if (closed) return Promise.reject(new Error(`probe closed before ${label}`));
    return new Promise((resolvePromise, rejectPromise) => {
      const waiter = {
        predicate, after, resolve: resolvePromise, reject: rejectPromise,
        timer: setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          rejectPromise(new Error(`timed out waiting for ${label}`));
        }, timeoutMs),
      };
      waiters.push(waiter);
    });
  };
  const send = operation => {
    if (closed) fail('probe is already closed');
    child.stdin.write(`${JSON.stringify(operation)}\n`);
  };
  const command = async (operation, label, predicate = record => record.event === 'command' && record.ok === true) => {
    const after = records.length;
    send(operation);
    const record = await waitRecord(predicate, label, COMMAND_TIMEOUT_MS, after);
    if (record.event === 'command' && record.ok !== true) fail(`${label} failed: ${String(record.stderr || record.stdout || 'no output').slice(0, 500)}`);
    return record;
  };
  const stop = async () => {
    if (closed) return;
    try { child.stdin.write(`${JSON.stringify({ op: 'quit' })}\n`); } catch { /* already closed */ }
    try { child.stdin.end(); } catch { /* already closed */ }
    await Promise.race([
      new Promise(resolvePromise => child.once('close', resolvePromise)),
      sleep(5000).then(() => child.kill?.('SIGKILL')),
    ]);
  };
  return { records, waitRecord, command, send, stop, stderr: () => stderr, exit: () => exit };
}

function exactArgs(...args) {
  return record => record.event === 'command' && Array.isArray(record.args) &&
    args.length === record.args.length && args.every((value, index) => value === record.args[index]);
}

function parseVerifyLog(text, run) {
  const observations = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const marker = raw.indexOf('READER_VERIFY ');
    if (marker < 0) continue;
    const payload = raw.slice(marker + 'READER_VERIFY '.length).trim();
    let observation;
    try { observation = JSON.parse(payload); }
    catch { fail(`READER_VERIFY line is not valid JSON: ${raw.slice(0, 300)}`); }
    if (observation === null || typeof observation !== 'object' || Array.isArray(observation)) fail('READER_VERIFY observation is not an object');
    if (observation.schema !== 1) fail('READER_VERIFY schema mismatch');
    if (typeof observation.run !== 'string' || !RUN.test(observation.run)) fail('READER_VERIFY run is invalid');
    if (observation.run !== run) continue;
    observations.push(observation);
  }
  return observations;
}

function validateReady(observation, scenario, run) {
  if (observation.kind !== 'ready') fail('no READER_VERIFY ready observation for this run');
  if (observation.scene !== scenario.scene) fail(`actual scene ${observation.scene} does not match ${scenario.scene}`);
  if (observation.requestedWidthVp !== scenario.width) fail(`requested width ${observation.requestedWidthVp} does not match ${scenario.width}`);
  if (!Number.isFinite(observation.actualWidthVp) || observation.actualWidthVp <= 0 ||
    !Number.isFinite(observation.actualHeightVp) || observation.actualHeightVp <= 0) fail('actual area was not measured before ready');
  if (!Number.isFinite(observation.densityPixels) || observation.densityPixels <= 0 || observation.densityPixels > 12) {
    fail('densityPixels is missing or out of range');
  }
  if (observation.font === null || typeof observation.font !== 'object' || observation.font.status !== 'ready') {
    fail('font readiness is not ready');
  }
  if (observation.run !== run) fail('ready run mismatch');
}

function createRunId() {
  return `ui-${randomUUID()}`;
}
function assertRunId(run) {
  if (!RUN.test(run)) fail('generated run id is invalid');
  return run;
}

export async function verifyScenario(options, dependencies = {}) {
  const spawn = dependencies.spawn ?? spawnProcess;
  const readFile = dependencies.readFile ?? readFileSync;
  const now = dependencies.now ?? (() => Date.now());
  const wait = dependencies.sleep ?? sleep;
  const makeId = dependencies.randomUUID ?? createRunId;
  const scenariosPath = dependencies.scenariosPath ?? DEFAULT_SCENARIOS;
  const scenarioSource = dependencies.scenarioSource ?? scenariosPath;
  const { scenario, scenariosText } = dependencies.scenario === undefined ?
    loadScenario(scenarioSource, options.scenario) : { scenario: validateScenario(dependencies.scenario), scenariosText: JSON.stringify(dependencies.scenario) };
  if (!options.preflightConfirmed) fail('--preflight-confirmed is required for any device operation');
  const run = assertRunId(makeId());
  mkdirSync(options.outputDir, { recursive: true, mode: 0o700 });
  const startedAt = new Date(now()).toISOString();
  const probePath = dependencies.probePath ?? new URL('../reader-control-device-probe.mjs', import.meta.url);
  const child = spawn(process.execPath, [
    probePath instanceof URL ? probePath.pathname : probePath,
    '--target', options.target, '--hdc', options.hdc, '--server', options.server, '--output-dir', options.outputDir,
  ], { shell: false, env: envWithoutProxy(), stdio: ['pipe', 'pipe', 'pipe'] });
  const session = probeSession(child);
  let readyObservation;
  let finalLayout;
  let finalDensity;
  let logText = '';
  let screenshotPath;
  const actionReceipts = [];
  const assertionReceipts = [];
  let error;
  try {
    await session.waitRecord(record => record.event === 'ready', 'probe ready', 30000);
    await session.command({ op: 'force-stop', explicitPermit: true, preflightConfirmed: true }, 'force-stop',
      exactArgs('shell', 'aa', 'force-stop', BUNDLE));
    await session.command({ op: 'verifyStart', scene: scenario.scene, width: scenario.width, run, preflightConfirmed: true },
      'verifyStart', exactArgs('shell', 'aa', 'start', '-a', 'EntryAbility', '-b', BUNDLE, '-m', 'entry',
        '--ps', 'readerVerifyScene', scenario.scene, '--ps', 'readerVerifyWidth', String(scenario.width),
        '--ps', 'readerVerifyRun', run));
    const deadline = now() + (scenario.budgetMs ?? READY_TIMEOUT_MS);
    let frame = 0;
    let observed = false;
    while (now() < deadline) {
      const remote = `/data/local/tmp/reader-control-${run}-layout-${frame}.json`;
      const local = resolve(options.outputDir, basename(remote));
      await session.command({ op: 'dumpLayout', path: remote, preflightConfirmed: true }, 'dumpLayout',
        exactArgs('shell', 'uitest', 'dumpLayout', '-p', remote));
      await session.command({ op: 'recv', path: remote, preflightConfirmed: true }, 'recv layout',
        exactArgs('file', 'recv', remote, local));
      const text = String(readFile(local, 'utf8'));
      let root;
      try { root = parseLayout(text); }
      catch (parseError) { fail(`dumpLayout parse failed: ${parseError.message}`); }
      if (indexLayout(root).nodes.has(scenario.readyId)) {
        finalLayout = root;
        observed = true;
        break;
      }
      frame += 1;
      await wait(POLL_MS);
    }
    if (!observed) fail(`ready id ${scenario.readyId} did not appear within ${scenario.budgetMs ?? READY_TIMEOUT_MS} ms`);
    const logRecord = await session.command({ op: 'verifyLog', preflightConfirmed: true }, 'verifyLog',
      exactArgs('shell', 'hilog', '-x', '-T', 'ReaderVerify'));
    logText = String(logRecord.stdout ?? '');
    const observations = parseVerifyLog(logText, run);
    readyObservation = observations.find(candidate => candidate.kind === 'ready');
    if (readyObservation === undefined) fail('READER_VERIFY ready was not observed; dump cannot substitute for app state');
    validateReady(readyObservation, scenario, run);
    finalDensity = readyObservation.densityPixels;
    const evaluated = evaluateLayout(finalLayout, scenario.expect ?? {}, { density: finalDensity });
    assertionReceipts.push(...evaluated.checks);
    if (!evaluated.ok) fail(`layout assertions failed: ${assertionSummary(evaluated)}`);
    const index = indexLayout(finalLayout);
    for (const action of scenario.actions ?? []) {
      if (action.op === 'key') {
        await session.command({ op: 'keyEvent', key: action.key, preflightConfirmed: true }, `key ${action.key}`,
          exactArgs('shell', 'uitest', 'uiInput', 'keyEvent', action.key));
      } else {
        const node = index.nodes.get(action.id);
        if (node === undefined || node.bounds === undefined) fail(`action target ${action.id} is not present with bounds`);
        const centerX = Math.round((node.bounds.left + node.bounds.right) / 2);
        const centerY = Math.round((node.bounds.top + node.bounds.bottom) / 2);
        if (action.op === 'click') {
          await session.command({ op: 'click', x: centerX, y: centerY, preflightConfirmed: true }, `click ${action.id}`,
            exactArgs('shell', 'uitest', 'uiInput', 'click', String(centerX), String(centerY)));
        } else {
          const delta = Math.round(action.dy * finalDensity);
          const toY = centerY - delta;
          if (toY < 0 || toY > 16384) fail(`scroll target for ${action.id} leaves the display`);
          await session.command({ op: 'drag', fromX: centerX, fromY: centerY, toX: centerX, toY, velocity: 600,
            preflightConfirmed: true }, `scroll ${action.id}`,
            exactArgs('shell', 'uitest', 'uiInput', 'drag', String(centerX), String(centerY), String(centerX), String(toY), '600'));
        }
      }
      await wait(300);
      const actionDeadline = now() + ACTION_BUDGET_MS;
      let nextLayout;
      let nextFrame = 100;
      while (now() < actionDeadline) {
        const remote = `/data/local/tmp/reader-control-${run}-action-${nextFrame}.json`;
        const local = resolve(options.outputDir, basename(remote));
        await session.command({ op: 'dumpLayout', path: remote, preflightConfirmed: true }, 'dumpLayout after action',
          exactArgs('shell', 'uitest', 'dumpLayout', '-p', remote));
        await session.command({ op: 'recv', path: remote, preflightConfirmed: true }, 'recv action layout',
          exactArgs('file', 'recv', remote, local));
        nextLayout = parseLayout(String(readFile(local, 'utf8')));
        if (action.expect === undefined || indexLayout(nextLayout).nodes.has(action.id)) break;
        nextFrame += 1;
        await wait(POLL_MS);
      }
      if (nextLayout === undefined) fail(`no layout after action ${action.op} ${action.id}`);
      finalLayout = nextLayout;
      const evaluatedAction = evaluateLayout(nextLayout, action.expect ?? {}, { density: finalDensity });
      assertionReceipts.push(...evaluatedAction.checks);
      actionReceipts.push({ op: action.op, id: action.id ?? null, key: action.key ?? null,
        dy: action.dy ?? null, checks: evaluatedAction.checks });
      if (!evaluatedAction.ok) fail(`action ${action.op} ${action.id ?? action.key} assertions failed: ${assertionSummary(evaluatedAction)}`);
    }
  } catch (failure) {
    error = failure.message;
  }
  try {
    if (error !== undefined) {
      const remote = `/data/local/tmp/reader-control-${run}-failure.png`;
      const local = resolve(options.outputDir, basename(remote));
      try {
        await session.command({ op: 'screenCap', path: remote, preflightConfirmed: true }, 'failure screenshot',
          exactArgs('shell', 'uitest', 'screenCap', '-p', remote));
        await session.command({ op: 'recv', path: remote, preflightConfirmed: true }, 'failure screenshot recv',
          exactArgs('file', 'recv', remote, local));
        screenshotPath = local;
      } catch (captureError) {
        if (error === undefined) error = captureError.message;
      }
    }
  } finally {
    await session.stop();
  }
  const finishedAt = new Date(now()).toISOString();
  const verdict = error === undefined ? 'PASS' : 'FAIL';
  const scenariosBytes = Buffer.from(scenariosText);
  const scenarioBytes = Buffer.from(JSON.stringify(scenario));
  const hdcBytes = (() => { try { return readFile(options.hdc); } catch { return undefined; } })();
  const manifestBytes = options.manifest === undefined ? undefined : (() => { try { return readFile(options.manifest); } catch { return undefined; } })();
  const receipt = {
    schema: 1, run, scenario: scenario.id, scene: scenario.scene, requestedWidthVp: scenario.width,
    verdict, expectFail: options.expectFail === true, targetRef: sha256(Buffer.from(options.target)).slice(0, 12),
    server: options.server, hdcPath: options.hdc, hdcSha256: hdcBytes === undefined ? null : sha256(hdcBytes),
    scenarioSha256: sha256(scenarioBytes), scenariosSha256: sha256(scenariosBytes), inputBytes: scenarioBytes.length,
    hapManifestSha256: manifestBytes === undefined ? null : sha256(manifestBytes),
    startedAt, finishedAt, elapsedMs: now() - Date.parse(startedAt),
    observation: readyObservation ?? null, assertions: assertionReceipts, actions: actionReceipts,
    layoutPath: finalLayout === undefined ? null : resolve(options.outputDir, `reader-control-${run}-final.json`),
    logPath: logText.length === 0 ? null : resolve(options.outputDir, `reader-control-${run}.hilog.txt`),
    screenshotPath: screenshotPath ?? null, error: error ?? null,
  };
  if (finalLayout !== undefined) {
    writeFileSync(receipt.layoutPath, `${JSON.stringify(finalLayout, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  }
  if (logText.length > 0) writeFileSync(receipt.logPath, logText, { flag: 'wx', mode: 0o600 });
  const receiptPath = resolve(options.outputDir, `ui-verification-${run}.json`);
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return { receipt, receiptPath };
}

export function exitCodeFor(result, expectFail) {
  if (expectFail) return result.receipt.verdict === 'FAIL' ? 0 : 1;
  return result.receipt.verdict === 'PASS' ? 0 : 1;
}

async function main(argv) {
  let options;
  try { options = parseArgs(argv); }
  catch (error) { process.stderr.write(`ui verification: ${error.message}\n`); process.exitCode = 2; return; }
  try {
    const result = await verifyScenario(options);
    process.stdout.write(`${JSON.stringify({ receipt: result.receiptPath, run: result.receipt.run,
      scenario: result.receipt.scenario, verdict: result.receipt.verdict, error: result.receipt.error })}\n`);
    process.exitCode = exitCodeFor(result, options.expectFail);
  } catch (error) {
    process.stderr.write(`ui verification stopped: ${error.message}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
