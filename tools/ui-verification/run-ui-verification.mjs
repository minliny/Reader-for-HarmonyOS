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
import { evaluateLayout, assertionSummary, effectivelyVisible, indexLayout, parseLayout, selectLayoutNodes } from './layout-snapshot.mjs';

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
const failDetail = (message, detail) => { throw Object.assign(new Error(message), { detail }); };
const failedChecks = checks => (checks ?? []).filter(check => !check.ok)
  .map(({ id, field, expected, actual }) => ({ id, field, expected, actual }));
const sleep = ms => delay(ms);

function readJson(path) {
  const text = readFileSync(path, 'utf8');
  try { return { text, value: JSON.parse(text) }; }
  catch (error) { fail(`${path}: invalid JSON (${error.message})`); }
}

export function parseArgs(argv) {
  const options = { expectFail: false, preflightConfirmed: false, expectFailChecks: [] };
  const values = new Set(['--scenario', '--target', '--hdc', '--server', '--output-dir', '--manifest',
    '--expect-fail-step', '--deployment-receipt']);
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === '--expect-fail') {
      if (options.expectFail) fail('duplicate --expect-fail');
      options.expectFail = true;
    } else if (key === '--expect-fail-check') {
      const value = argv[++index];
      if (value === undefined || value.length === 0) fail('--expect-fail-check requires a value');
      options.expectFailChecks.push(value);
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
  if ((options.expectFailChecks.length > 0 || options.expectFailStep !== undefined) && !options.expectFail) {
    fail('--expect-fail-step/--expect-fail-check require --expect-fail');
  }
  if (options.expectFailStep !== undefined && options.expectFailStep !== 'ready' &&
      !/^(0|[1-9]\d{0,2})$/.test(options.expectFailStep)) fail('--expect-fail-step must be ready or an action index');
  if (new Set(options.expectFailChecks).size !== options.expectFailChecks.length) fail('duplicate --expect-fail-check');
  for (const check of options.expectFailChecks) {
    const dot = check.lastIndexOf('.');
    if (/[\0\r\n]/.test(check) || dot < 1 || dot === check.length - 1 || check.slice(0, dot).length > 128 ||
        !/^[A-Za-z][A-Za-z0-9]*$/.test(check.slice(dot + 1))) fail(`invalid --expect-fail-check ${JSON.stringify(check)}`);
  }
  if (!/^[A-Za-z0-9._:\[\]-]{1,256}$/.test(options.target) || options.target.startsWith('-')) fail('invalid exact target');
  const colon = options.server.lastIndexOf(':');
  const host = colon > 0 ? options.server.slice(0, colon).replace(/^\[|\]$/g, '') : '';
  const port = colon > 0 ? options.server.slice(colon + 1) : '';
  if (colon < 1 || host.length === 0 || !/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    fail('--server must be an explicit host and port');
  }
  for (const [key, flag] of [['hdc', 'hdc'], ['outputDir', 'output-dir'],
    ...(options.manifest === undefined ? [] : [['manifest', 'manifest']]),
    ...(options.deploymentReceipt === undefined ? [] : [['deploymentReceipt', 'deployment-receipt']])]) {
    if (!isAbsolute(options[key]) || /[\0\r\n]/.test(options[key])) fail(`--${flag} must be an absolute path`);
  }
  if (options.outputDir === '/') fail('output directory cannot be filesystem root');
  return options;
}

export function validateScenario(scenario) {
  const allowed = ['id', 'mode', 'scene', 'width', 'readyId', 'readyIdPrefix', 'readyIdIncludes', 'readyIdExcludes',
    'expect', 'actions', 'budgetMs'];
  if (scenario === null || typeof scenario !== 'object' || Array.isArray(scenario)) fail('scenario must be an object');
  if (Object.keys(scenario).some(key => !allowed.includes(key))) fail('unknown scenario field');
  if (typeof scenario.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(scenario.id)) fail('invalid scenario id');
  const mode = scenario.mode ?? 'fixture';
  if (mode !== 'fixture' && mode !== 'normal') fail(`scenario ${scenario.id}: mode must be fixture or normal`);
  if (scenario.scene !== undefined) {
    if (typeof scenario.scene !== 'string' || !SCENE.test(scenario.scene)) fail(`scenario ${scenario.id}: invalid scene`);
  } else if (mode === 'fixture') fail(`scenario ${scenario.id}: invalid scene`);
  if (scenario.width !== undefined && scenario.width !== 320 && scenario.width !== 366) {
    fail(`scenario ${scenario.id}: width must be 320 or 366`);
  } else if (scenario.width === undefined && mode === 'fixture') fail(`scenario ${scenario.id}: width must be 320 or 366`);
  validateReadySelector(scenario);
  if (scenario.budgetMs !== undefined && (!Number.isInteger(scenario.budgetMs) || scenario.budgetMs < 1000 || scenario.budgetMs > 60000)) {
    fail(`scenario ${scenario.id}: budgetMs must be 1000..60000`);
  }
  if (scenario.expect !== undefined) validateExpect(scenario.expect, { mode, captures: new Set() });
  if (scenario.actions !== undefined) {
    if (!Array.isArray(scenario.actions) || scenario.actions.length > 10) fail(`scenario ${scenario.id}: actions must be 0..10`);
    const captures = new Set();
    for (const action of scenario.actions) {
      validateAction(action, mode, captures);
      if (action.op === 'capture') captures.add(action.as);
      if (action.expect !== undefined) validateExpect(action.expect, { mode, captures });
    }
  }
  return scenario;
}

function validateReadySelector(scenario) {
  const exact = scenario.readyId !== undefined;
  const prefix = scenario.readyIdPrefix !== undefined;
  if (exact === prefix) fail(`scenario ${scenario.id}: exactly one of readyId or readyIdPrefix is required`);
  const value = exact ? scenario.readyId : scenario.readyIdPrefix;
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    fail(`scenario ${scenario.id}: invalid ${exact ? 'readyId' : 'readyIdPrefix'}`);
  }
  for (const key of ['readyIdIncludes', 'readyIdExcludes']) {
    if (scenario[key] !== undefined && (typeof scenario[key] !== 'string' || scenario[key].length === 0 || scenario[key].length > 128)) {
      fail(`scenario ${scenario.id}: invalid ${key}`);
    }
  }
}

function validateSelector(value, context) {
  const exact = value.id !== undefined;
  const prefix = value.idPrefix !== undefined;
  if (exact === prefix) fail(`${context}: exactly one of id or idPrefix is required`);
  const id = exact ? value.id : value.idPrefix;
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) fail(`${context}: invalid selector`);
  for (const key of ['idIncludes', 'idExcludes']) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length === 0 || value[key].length > 128)) {
      fail(`${context}: invalid ${key}`);
    }
  }
}

function validateAction(action, mode, captures) {
  const keys = action === null || typeof action !== 'object' || Array.isArray(action) ? [] : Object.keys(action);
  if (mode === 'fixture') {
    if (!(keys.includes('op') && (keys.includes('id') || keys.includes('key')))) fail('scenario: invalid action');
    if (keys.some(key => !['op', 'id', 'key', 'dy', 'expect', 'observe'].includes(key))) fail('scenario: unknown action field');
    if (action.op === 'click' || action.op === 'scroll') {
      if (typeof action.id !== 'string' || action.id.length === 0) fail('scenario: action id is required');
    } else if (action.op === 'key') {
      if (!['Back', 'Home'].includes(action.key)) fail('scenario: only Back/Home actions');
    } else fail('scenario: unsupported action');
    if (action.op === 'scroll' && (!Number.isFinite(action.dy) || action.dy === 0 || Math.abs(action.dy) > 400)) {
      fail('scenario: scroll dy must be -400..400 and non-zero');
    }
    if (action.observe !== undefined) validateObserve(action.observe);
    return;
  }
  const allowed = ['op', 'id', 'idPrefix', 'idIncludes', 'idExcludes', 'first', 'key', 'expect', 'waitFor', 'requireEnabled', 'as'];
  if (keys.some(key => !allowed.includes(key))) fail('scenario: unknown normal action field');
  if (action.op === 'click' || action.op === 'capture') {
    validateSelector(action, `scenario ${action.op} action`);
    if (action.first !== undefined && typeof action.first !== 'boolean') fail('scenario: first must be boolean');
    if (action.op === 'click' && action.as !== undefined) fail('scenario: only capture actions name a capture');
    if (action.op === 'capture') {
      if (typeof action.as !== 'string' || !/^[a-z][A-Za-z0-9]{0,31}$/.test(action.as)) fail('scenario: invalid capture name');
      if (action.requireEnabled !== undefined) fail('scenario: capture cannot require enabled');
    }
  } else if (action.op === 'key') {
    if (!['Back', 'Home'].includes(action.key)) fail('scenario: only Back/Home actions');
    if (action.id !== undefined || action.idPrefix !== undefined) fail('scenario: key action cannot have a selector');
  } else fail('scenario: normal mode supports click, key and capture only');
  if (action.requireEnabled !== undefined && typeof action.requireEnabled !== 'boolean') {
    fail('scenario: requireEnabled must be boolean');
  }
  if (action.waitFor !== undefined) validateWaitFor(action.waitFor);
  if (action.expect !== undefined) validateExpect(action.expect, { mode, captures });
}

function validateWaitFor(waitFor) {
  if (waitFor === null || typeof waitFor !== 'object' || Array.isArray(waitFor)) fail('scenario: waitFor must be an object');
  if (Object.keys(waitFor).some(key => !['id', 'idPrefix', 'idIncludes', 'idExcludes', 'visible', 'absent'].includes(key))) {
    fail('scenario: unknown waitFor field');
  }
  validateSelector(waitFor, 'scenario waitFor');
  if (waitFor.visible !== undefined && typeof waitFor.visible !== 'boolean') fail('scenario: waitFor.visible must be boolean');
  if (waitFor.absent !== undefined && typeof waitFor.absent !== 'boolean') fail('scenario: waitFor.absent must be boolean');
  // Presence, explicit hiding and absence are separate states; a hidden node
  // is present but not effectively visible, which is not the same as absent.
  if (waitFor.absent === true && waitFor.visible !== undefined) fail('scenario: waitFor.absent cannot combine with visible');
}

function validateObserve(observe) {
  if (observe === null || typeof observe !== 'object' || Array.isArray(observe)) fail('observe must be an object');
  if (Object.keys(observe).some(key => !['event', 'stateIncludes'].includes(key))) fail('unknown observe field');
  if (typeof observe.event !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(observe.event)) fail('observe.event is invalid');
  if (!Array.isArray(observe.stateIncludes) || observe.stateIncludes.length === 0 || observe.stateIncludes.length > 8 ||
    observe.stateIncludes.some(value => typeof value !== 'string' || value.length === 0 || value.length > 128)) {
    fail('observe.stateIncludes must be 1..8 non-empty strings');
  }
}

/** A click only counts if the app itself logged the resulting intent. */
export function evaluateObserve(observations, observe) {
  const match = [...observations].reverse().find(observation => observation.kind === 'summary' &&
    observation.state !== null && typeof observation.state === 'object' && observation.state.event === observe.event);
  const stateText = match === undefined ? '' : JSON.stringify(match.state);
  const checks = [{ id: observe.event, field: 'event', expected: observe.event,
    actual: match === undefined ? null : observe.event, ok: match !== undefined }];
  for (const expected of observe.stateIncludes ?? []) {
    checks.push({ id: observe.event, field: 'stateIncludes', expected, actual: match === undefined ? null : stateText.slice(0, 300),
      ok: match !== undefined && stateText.includes(expected) });
  }
  return { ok: checks.every(item => item.ok), checks };
}

const NUMERIC_EXPECT_FIELDS = ['heightVp', 'widthVp', 'minHeightVp', 'maxHeightVp', 'minWidthVp', 'maxWidthVp',
  'topAtLeastVp', 'topAtMostVp', 'leftAtLeastVp', 'leftAtMostVp'];
const NODE_EXPECT_FIELDS = ['id', 'idPrefix', 'idIncludes', 'idExcludes', 'first', 'exists', 'count', 'visible',
  'enabled', 'textIncludes', 'textNonEmpty', 'textEqualsCapture', 'textNotEqualsCapture', ...NUMERIC_EXPECT_FIELDS];

function validateExpect(expect, options = {}) {
  const mode = options.mode ?? 'fixture';
  const captures = options.captures ?? new Set();
  if (expect === null || typeof expect !== 'object' || Array.isArray(expect)) fail('expect must be an object');
  if (Object.keys(expect).some(key => !['nodes', 'order'].includes(key))) fail('unknown expect field');
  if (expect.nodes !== undefined && (!Array.isArray(expect.nodes) || expect.nodes.length > 32)) fail('expect.nodes must be 0..32');
  if (expect.order !== undefined && (!Array.isArray(expect.order) || expect.order.length > 16)) fail('expect.order must be 0..16');
  for (const node of expect.nodes ?? []) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) fail('expect node must be an object');
    const label = node.id ?? node.idPrefix ?? 'unnamed';
    if (Object.keys(node).some(key => !NODE_EXPECT_FIELDS.includes(key))) fail(`expect node ${label}: unknown field`);
    if (mode === 'fixture') {
      if (typeof node.id !== 'string' || node.id.length === 0) fail('expect node requires id');
      if (node.idPrefix !== undefined || node.idIncludes !== undefined || node.idExcludes !== undefined) {
        fail(`expect node ${label}: selectors are normal-mode only`);
      }
    } else {
      validateSelector(node, `expect node ${label}`);
      for (const field of NUMERIC_EXPECT_FIELDS) {
        if (node[field] !== undefined) fail(`expect node ${label}: ${field} needs a density observation unavailable in normal mode`);
      }
    }
    if (node.first !== undefined && typeof node.first !== 'boolean') fail(`expect node ${label}: first must be boolean`);
    if (node.textNonEmpty !== undefined && typeof node.textNonEmpty !== 'boolean') fail(`expect node ${label}: textNonEmpty must be boolean`);
    for (const field of ['textEqualsCapture', 'textNotEqualsCapture']) {
      if (node[field] === undefined) continue;
      if (typeof node[field] !== 'string' || !captures.has(node[field])) {
        fail(`expect node ${label}: ${field} must reference an earlier capture`);
      }
    }
  }
  for (const pair of expect.order ?? []) {
    if (!Array.isArray(pair) || pair.length !== 2 || pair.some(value => typeof value !== 'string' || value.length === 0)) {
      fail('expect.order requires id pairs');
    }
  }
}

function selectorLabel(value) {
  const exact = value.id !== undefined ? value.id : `${value.idPrefix ?? ''}*`;
  const includes = value.idIncludes === undefined ? '' : ` includes ${value.idIncludes}`;
  const excludes = value.idExcludes === undefined ? '' : ` excludes ${value.idExcludes}`;
  return `${exact}${includes}${excludes}`;
}

function readySelector(scenario) {
  return { id: scenario.readyId, idPrefix: scenario.readyIdPrefix,
    idIncludes: scenario.readyIdIncludes, idExcludes: scenario.readyIdExcludes };
}

/** A production ID may carry a runtime generation/book key. Select only the
 * exact requested identity family, then require the caller's uniqueness rule. */
function resolveTarget(root, value, options = {}) {
  const matches = selectLayoutNodes(root, value).filter(node =>
    (options.visible !== true || effectivelyVisible(node)) &&
    (options.bounds === false || node.bounds !== undefined));
  if (matches.length === 0) return undefined;
  if (matches.length > 1 && options.first !== true) {
    fail(`selector ${selectorLabel(value)} matched ${matches.length} nodes; set first or narrow it`);
  }
  return matches[0];
}

/** Three distinct wait states: a node that is absent, present but hidden by
 * its own or an ancestor's visibility/opacity, or present and visible. */
export function waitTargetState(root, waitFor) {
  const target = resolveTarget(root, waitFor, { first: true });
  if (waitFor.absent === true) return target === undefined;
  if (target === undefined) return false;
  return waitFor.visible === false ? !effectivelyVisible(target) : effectivelyVisible(target);
}

/** Turn a selector expectation into the concrete ID observed in this layout.
 * The assertion receipt then records the actual generation/book identity. */
function resolveExpect(root, expect) {
  if (expect.nodes === undefined) return expect;
  return {
    ...expect,
    nodes: expect.nodes.map(node => {
      if (node.id !== undefined) return node;
      const target = resolveTarget(root, node, { first: node.first === true, bounds: false });
      if (target === undefined) fail(`expect selector ${selectorLabel(node)} matched no node`);
      const resolved = { ...node, id: target.id };
      delete resolved.idPrefix;
      delete resolved.idIncludes;
      delete resolved.idExcludes;
      delete resolved.first;
      return resolved;
    }),
  };
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

function readBindingJson(readFile, path, flag) {
  let text;
  try { text = String(readFile(path, 'utf8')); }
  catch (error) { fail(`--${flag} is not readable: ${error.message}`); }
  let value;
  try { value = JSON.parse(text); }
  catch (error) { fail(`--${flag} is not valid JSON (${error.message})`); }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`--${flag} must be a JSON object`);
  return { text, value };
}

/** A behavior receipt is only bound to a candidate when both the manifest and
 * the actual deployment receipt agree with the target of this run. */
function manifestBinding(readFile, path) {
  const { text, value } = readBindingJson(readFile, path, 'manifest');
  if (typeof value.runId !== 'string' || value.runId.length === 0) fail('--manifest requires a runId');
  const artifacts = Array.isArray(value.artifacts) ? value.artifacts : [];
  const signed = artifacts.find(candidate => candidate?.kind === 'signed') ?? artifacts[0];
  if (!signed || !/^[a-f0-9]{64}$/.test(signed.sha256 ?? '')) fail('--manifest requires an artifact sha256');
  return { sha256: sha256(Buffer.from(text)), runId: value.runId, buildClass: value.buildClass ?? null,
    acceptanceEligible: value.acceptanceEligible === true, artifactSha256: signed.sha256 };
}

function deploymentBinding(readFile, path, target, manifest) {
  const { text, value } = readBindingJson(readFile, path, 'deployment-receipt');
  if (typeof value.runId !== 'string' || value.runId.length === 0) fail('--deployment-receipt requires a runId');
  const expectedRef = sha256(Buffer.from(target)).slice(0, 12);
  if (value.targetRef !== expectedRef) {
    fail(`--deployment-receipt target ${value.targetRef} does not match --target ${expectedRef}`);
  }
  const artifactSha256 = value.artifact?.sha256;
  if (!/^[a-f0-9]{64}$/.test(artifactSha256 ?? '')) fail('--deployment-receipt requires an artifact sha256');
  if (manifest !== null) {
    if (value.runId !== manifest.runId) fail('--deployment-receipt runId does not match --manifest');
    if (artifactSha256 !== manifest.artifactSha256) fail('--deployment-receipt artifact does not match --manifest');
  }
  return { sha256: sha256(Buffer.from(text)), runId: value.runId, targetRef: value.targetRef, artifactSha256,
    dataPolicy: value.dataPolicy ?? null, install: value.install ?? null,
    dataRecheck: value.dataRecheck?.status ?? null };
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
    while (waiters.length > 0) {
      const waiter = waiters.shift();
      clearTimeout(waiter.timer);
      waiter.reject(new Error(message));
    }
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
    let timer;
    await Promise.race([
      new Promise(resolvePromise => child.once('close', resolvePromise)),
      new Promise(resolvePromise => {
        timer = setTimeout(() => { child.kill?.('SIGKILL'); resolvePromise(); }, 5000);
      }),
    ]);
    clearTimeout(timer);
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
  const manifest = options.manifest === undefined ? null : manifestBinding(readFile, options.manifest);
  const deployment = options.deploymentReceipt === undefined ? null :
    deploymentBinding(readFile, options.deploymentReceipt, options.target, manifest);
  const run = assertRunId(makeId());
  mkdirSync(options.outputDir, { recursive: true, mode: 0o700 });
  const startedAt = new Date(now()).toISOString();
  const probePath = dependencies.probePath ?? new URL('../reader-control-device-probe.mjs', import.meta.url);
  const child = spawn(process.execPath, [
    probePath instanceof URL ? probePath.pathname : probePath,
    '--target', options.target, '--hdc', options.hdc, '--server', options.server, '--output-dir', options.outputDir,
  ], { shell: false, env: envWithoutProxy(), stdio: ['pipe', 'pipe', 'pipe'] });
  const session = probeSession(child);
  const normal = (scenario.mode ?? 'fixture') === 'normal';
  let readyObservation;
  let finalLayout;
  let finalDensity;
  let logText = '';
  let screenshotPath;
  let observedCount = 0;
  const captures = {};
  const actionReceipts = [];
  const assertionReceipts = [];
  let error;
  let failureDetail;
  let stage = 'startup';
  let step = null;
  try {
    await session.waitRecord(record => record.event === 'ready', 'probe ready', 30000);
    await session.command({ op: 'force-stop', explicitPermit: true, preflightConfirmed: true }, 'force-stop',
      exactArgs('shell', 'aa', 'force-stop', BUNDLE));
    if (normal) {
      await session.command({ op: 'startNormal', preflightConfirmed: true }, 'startNormal',
        exactArgs('shell', 'aa', 'start', '-a', 'EntryAbility', '-b', BUNDLE, '-m', 'entry'));
    } else {
      await session.command({ op: 'verifyStart', scene: scenario.scene, width: scenario.width, run, preflightConfirmed: true },
        'verifyStart', exactArgs('shell', 'aa', 'start', '-a', 'EntryAbility', '-b', BUNDLE, '-m', 'entry',
          '--ps', 'readerVerifyScene', scenario.scene, '--ps', 'readerVerifyWidth', String(scenario.width),
          '--ps', 'readerVerifyRun', run));
    }
    stage = 'ready';
    const ready = readySelector(scenario);
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
      if (resolveTarget(root, ready, { first: true, visible: true }) !== undefined) {
        finalLayout = root;
        observed = true;
        break;
      }
      frame += 1;
      await wait(POLL_MS);
    }
    if (!observed) failDetail(`ready ${selectorLabel(ready)} did not appear within ${scenario.budgetMs ?? READY_TIMEOUT_MS} ms`,
      { stage: 'ready', kind: 'timeout', step: null });

    if (normal) {
      finalDensity = undefined;
    } else {
      const logRecord = await session.command({ op: 'verifyLog', preflightConfirmed: true }, 'verifyLog',
        exactArgs('shell', 'hilog', '-x', '-T', 'ReaderVerify'));
      logText = String(logRecord.stdout ?? '');
      const observations = parseVerifyLog(logText, run);
      observedCount = observations.length;
      readyObservation = observations.find(candidate => candidate.kind === 'ready');
      if (readyObservation === undefined) fail('READER_VERIFY ready was not observed; dump cannot substitute for app state');
      validateReady(readyObservation, scenario, run);
      finalDensity = readyObservation.densityPixels;
    }
    const evaluated = evaluateLayout(finalLayout, resolveExpect(finalLayout, scenario.expect ?? {}),
      { density: finalDensity, captures });
    assertionReceipts.push(...evaluated.checks);
    if (!evaluated.ok) failDetail(`layout assertions failed: ${assertionSummary(evaluated)}`,
      { stage: 'ready', kind: 'assertion', step: null, checks: failedChecks(evaluated.checks) });
    let actionFrame = 100;
    let actionIndex = -1;
    for (const action of scenario.actions ?? []) {
      actionIndex += 1;
      stage = action.op === 'capture' ? 'capture' : 'action';
      step = actionIndex;
      if (action.op === 'capture') {
        const node = resolveTarget(finalLayout, action, { first: action.first === true, bounds: false });
        if (node === undefined) failDetail(`capture target ${selectorLabel(action)} is not present`,
          { stage, kind: 'precondition', step });
        captures[action.as] = node.text;
        const evaluatedCapture = evaluateLayout(finalLayout, resolveExpect(finalLayout, action.expect ?? {}),
          { density: finalDensity, captures });
        assertionReceipts.push(...evaluatedCapture.checks);
        actionReceipts.push({ op: 'capture', id: node.id, key: null, dy: null, as: action.as,
          text: node.text, checks: evaluatedCapture.checks, observe: [] });
        if (!evaluatedCapture.ok) failDetail(`capture ${action.as} assertions failed: ${assertionSummary(evaluatedCapture)}`,
          { stage, kind: 'assertion', step, checks: failedChecks(evaluatedCapture.checks) });
        continue;
      }
      let actionTargetId = action.id ?? null;
      if (action.op === 'key') {
        await session.command({ op: 'keyEvent', key: action.key, preflightConfirmed: true }, `key ${action.key}`,
          exactArgs('shell', 'uitest', 'uiInput', 'keyEvent', action.key));
      } else {
        // Chrome animates after the first reveal, so a target resolved from an
        // older dump can shift by a few pixels before the tap lands. Require two
        // consecutive identical bounds, then click the settled target.
        let node;
        let previous;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const remote = `/data/local/tmp/reader-control-${run}-action-${actionFrame++}.json`;
          const local = resolve(options.outputDir, basename(remote));
          await session.command({ op: 'dumpLayout', path: remote, preflightConfirmed: true }, 'dumpLayout before action',
            exactArgs('shell', 'uitest', 'dumpLayout', '-p', remote));
          await session.command({ op: 'recv', path: remote, preflightConfirmed: true }, 'recv action layout',
            exactArgs('file', 'recv', remote, local));
          const settledLayout = parseLayout(String(readFile(local, 'utf8')));
          finalLayout = settledLayout;
          node = resolveTarget(settledLayout, action, { first: action.first === true, visible: true });
          if (node !== undefined && previous !== undefined && node.id === previous.id &&
              JSON.stringify(node.bounds) === JSON.stringify(previous.bounds)) break;
          previous = node;
          await wait(250);
        }
        if (node === undefined) failDetail(`action target ${selectorLabel(action)} is not present with bounds`,
          { stage, kind: 'precondition', step });
        actionTargetId = node.id;
        if (action.requireEnabled === true && node.enabled === false) {
          failDetail(`action target ${selectorLabel(action)} is disabled`, { stage, kind: 'precondition', step });
        }
        const centerX = Math.round((node.bounds.left + node.bounds.right) / 2);
        const centerY = Math.round((node.bounds.top + node.bounds.bottom) / 2);
        if (action.op === 'click') {
          await session.command({ op: 'click', x: centerX, y: centerY, preflightConfirmed: true }, `click ${selectorLabel(action)}`,
            exactArgs('shell', 'uitest', 'uiInput', 'click', String(centerX), String(centerY)));
        } else {
          const delta = Math.round(action.dy * finalDensity);
          const toY = centerY - delta;
          if (toY < 0 || toY > 16384) failDetail(`scroll target for ${selectorLabel(action)} leaves the display`,
            { stage, kind: 'precondition', step });
          await session.command({ op: 'drag', fromX: centerX, fromY: centerY, toX: centerX, toY, velocity: 600,
            preflightConfirmed: true }, `scroll ${selectorLabel(action)}`,
            exactArgs('shell', 'uitest', 'uiInput', 'drag', String(centerX), String(centerY), String(centerX), String(toY), '600'));
        }
      }
      await wait(300);
      const actionDeadline = now() + ACTION_BUDGET_MS;
      let nextLayout;
      let waitSatisfied = action.waitFor === undefined;
      let lastAssertion;
      while (now() < actionDeadline) {
        const remote = `/data/local/tmp/reader-control-${run}-action-${actionFrame++}.json`;
        const local = resolve(options.outputDir, basename(remote));
        await session.command({ op: 'dumpLayout', path: remote, preflightConfirmed: true }, 'dumpLayout after action',
          exactArgs('shell', 'uitest', 'dumpLayout', '-p', remote));
        await session.command({ op: 'recv', path: remote, preflightConfirmed: true }, 'recv action layout',
          exactArgs('file', 'recv', remote, local));
        nextLayout = parseLayout(String(readFile(local, 'utf8')));
        if (action.waitFor !== undefined) {
          const targetSatisfied = waitTargetState(nextLayout, action.waitFor);
          lastAssertion = evaluateLayout(nextLayout, resolveExpect(nextLayout, action.expect ?? {}),
            { density: finalDensity, captures });
          if (targetSatisfied && (action.expect === undefined || lastAssertion.ok)) {
            waitSatisfied = true;
            break;
          }
        } else if (!normal) {
          if (action.expect === undefined || indexLayout(nextLayout).nodes.has(action.id)) break;
        } else {
          break;
        }
        await wait(POLL_MS);
      }
      if (nextLayout === undefined) failDetail(`no layout after action ${action.op} ${selectorLabel(action)}`,
        { stage, kind: 'timeout', step });
      if (!waitSatisfied) {
        if (lastAssertion !== undefined && !lastAssertion.ok) {
          failDetail(`action ${action.op} ${selectorLabel(action)} assertions failed: ${assertionSummary(lastAssertion)}`,
            { stage, kind: 'assertion', step, checks: failedChecks(lastAssertion.checks) });
        }
        failDetail(`waitFor ${selectorLabel(action.waitFor)} did not appear within ${ACTION_BUDGET_MS} ms`,
          { stage, kind: 'timeout', step });
      }
      finalLayout = nextLayout;
      const evaluatedAction = lastAssertion ?? evaluateLayout(nextLayout, resolveExpect(nextLayout, action.expect ?? {}),
        { density: finalDensity, captures });
      assertionReceipts.push(...evaluatedAction.checks);
      const actionReceipt = { op: action.op, id: actionTargetId, key: action.key ?? null,
        dy: action.dy ?? null, checks: evaluatedAction.checks, observe: [] };
      actionReceipts.push(actionReceipt);
      if (!evaluatedAction.ok) {
        failDetail(`action ${action.op} ${action.id ?? action.key ?? selectorLabel(action)} assertions failed: ${assertionSummary(evaluatedAction)}`,
          { stage, kind: 'assertion', step, checks: failedChecks(evaluatedAction.checks) });
      }
      if (action.observe !== undefined) {
        const actionLog = await session.command({ op: 'verifyLog', preflightConfirmed: true }, 'verifyLog after action',
          exactArgs('shell', 'hilog', '-x', '-T', 'ReaderVerify'));
        logText = String(actionLog.stdout ?? '');
        const appended = parseVerifyLog(logText, run);
        const observed = evaluateObserve(appended.slice(observedCount), action.observe);
        observedCount = appended.length;
        actionReceipt.observe = observed.checks;
        assertionReceipts.push(...observed.checks);
        if (!observed.ok) {
          const failed = observed.checks.find(item => !item.ok);
          failDetail(`action ${action.op} ${action.id ?? action.key} observation failed: ` +
            `${failed.id}.${failed.field} expected ${JSON.stringify(failed.expected)} actual ${JSON.stringify(failed.actual)}`,
            { stage, kind: 'assertion', step, checks: failedChecks(observed.checks) });
        }
      }
    }
  } catch (failure) {
    error = failure.message;
    failureDetail = failure.detail ?? { stage, kind: 'infrastructure', step };
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
  const receipt = {
    schema: 1, run, scenario: scenario.id, mode: normal ? 'normal' : 'fixture',
    startOp: normal ? 'startNormal' : 'verifyStart',
    scene: scenario.scene ?? 'normal', requestedWidthVp: scenario.width ?? null,
    verdict, expectFail: options.expectFail === true,
    expectation: options.expectFail === true ? { step: options.expectFailStep ?? null, checks: options.expectFailChecks ?? [] } : null,
    failure: verdict === 'FAIL' ? failureDetail ?? { stage, kind: 'infrastructure', step } : null,
    targetRef: sha256(Buffer.from(options.target)).slice(0, 12),
    server: options.server, hdcPath: options.hdc, hdcSha256: hdcBytes === undefined ? null : sha256(hdcBytes),
    scenarioSha256: sha256(scenarioBytes), scenariosSha256: sha256(scenariosBytes), inputBytes: scenarioBytes.length,
    manifest: manifest === null ? null : { sha256: manifest.sha256, runId: manifest.runId,
      buildClass: manifest.buildClass, acceptanceEligible: manifest.acceptanceEligible, artifactSha256: manifest.artifactSha256 },
    deployment: deployment === null ? null : { sha256: deployment.sha256, runId: deployment.runId,
      targetRef: deployment.targetRef, artifactSha256: deployment.artifactSha256, dataPolicy: deployment.dataPolicy,
      install: deployment.install, dataRecheck: deployment.dataRecheck },
    hapManifestSha256: manifest === null ? null : manifest.sha256,
    startedAt, finishedAt, elapsedMs: now() - Date.parse(startedAt),
    captures, observation: readyObservation ?? null, assertions: assertionReceipts, actions: actionReceipts,
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

/** A negative check only passes when the run failed by assertion at the
 * declared step and produced exactly the declared failing fields; timeouts,
 * preconditions and infrastructure errors never count as a proven negative. */
export function expectedFailureMatches(receipt, expectation = {}) {
  const failure = receipt.failure;
  if (receipt.verdict !== 'FAIL' || failure == null || failure.kind !== 'assertion') return false;
  if (expectation.step !== undefined && expectation.step !== null) {
    if (expectation.step === 'ready') {
      if (failure.stage !== 'ready') return false;
    } else if (failure.step !== Number(expectation.step)) return false;
  }
  const expected = expectation.checks ?? [];
  if (expected.length === 0) return true;
  const actual = new Set((failure.checks ?? []).map(check => `${check.id}.${check.field}`));
  return actual.size === expected.length && expected.every(key => actual.has(key));
}

export function exitCodeFor(result, expectFail, expectation) {
  if (expectFail) return expectedFailureMatches(result.receipt, expectation) ? 0 : 1;
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
    process.exitCode = exitCodeFor(result, options.expectFail,
      { step: options.expectFailStep ?? null, checks: options.expectFailChecks });
  } catch (error) {
    process.stderr.write(`ui verification stopped: ${error.message}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
