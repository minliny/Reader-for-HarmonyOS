#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { journeys } from './lib/vm-journey-cases.mjs';
import { openProbe } from '../tools/ui-contract/collectors/harmonyos/transport.mjs';
import { assertInstalled, assertRemoteVmReadiness } from '../tools/ui-contract/collectors/harmonyos/records.mjs';
import { assertUnlockedFocus, assertVmLockDismissed, classifyFocusWindow, vmLockDismissalOperation } from '../tools/ui-contract/collectors/harmonyos/focus-window.mjs';
import { candidateIdentity, nativeBounds, normalReaderWindowRoots, sha256 } from '../tools/lib/native-ui-evidence.mjs';

const SERVER = '192.168.1.10:8710';
const LAYOUT_MARKER = 'READER_LAYOUT_INVARIANTS ';
const FIXTURE_MARKER = 'Public UI fixture VM journeys verified';
const STEP_MS = 12000;
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const demand = (condition, message) => { if (!condition) throw Error(message); };

function appTree(tree) {
  const roots = normalReaderWindowRoots(tree);
  demand(roots.length === 1, `Expected one normal Reader window, observed ${roots.length}`);
  return roots[0];
}

function nativeNodes(root) {
  const result = [];
  const visit = (node, parents) => {
    const attrs = node.attributes ?? {};
    const bounds = nativeBounds(attrs.bounds);
    if (bounds && bounds[2] > bounds[0] && bounds[3] > bounds[1] && attrs.visible !== 'false' && Number(attrs.opacity ?? 1) > 0)
      result.push({ attrs, bounds, parents, node });
    for (const child of node.children ?? []) visit(child, [...parents, attrs]);
  };
  visit(root, []);
  return result;
}

function attributeMatches(matcher, values) {
  return matcher === undefined || values.some(value => value !== undefined &&
    (matcher instanceof RegExp ? new RegExp(matcher.source, matcher.flags.replace(/[gy]/g, '')).test(value) : String(matcher) === String(value)));
}

function matchesAttributes(attributes, selector, childLabels = []) {
  return attributeMatches(selector.id, [attributes.id, attributes.key]) && attributeMatches(selector.type, [attributes.type]) &&
    attributeMatches(selector.text, [attributes.text]) &&
    attributeMatches(selector.label, [attributes.text, attributes.description, attributes.accessibilityText, ...childLabels]) &&
    attributeMatches(selector.enabled, [attributes.enabled]);
}

function buttonLabels(node) {
  return (node.children ?? []).flatMap(child => {
    const attributes = child.attributes ?? {};
    if (attributes.clickable === 'true' || attributes.visible === 'false' || Number(attributes.opacity ?? 1) <= 0) return [];
    return attributes.type === 'Text' && attributes.text ? [attributes.text] : buttonLabels(child);
  });
}

function matchingNodes(root, selector) {
  const scopes = [selector.within].flat().filter(scope => scope !== undefined);
  return nativeNodes(root).filter(node => matchesAttributes(node.attrs, selector,
    selector.label === undefined ? [] : buttonLabels(node.node)) &&
    scopes.every(scope => node.parents.some(parent => matchesAttributes(parent, scope))));
}

function actor(root, selector) {
  const found = [...new Map(matchingNodes(root, selector).filter(node => node.attrs.enabled === 'true' || node.attrs.enabled === true)
    .map(node => [node.bounds.join(','), node])).values()];
  demand(found.length === 1, `Expected one enabled input target for ${showSelector(selector)}, observed ${found.length}`);
  return found[0].bounds;
}

function showSelector(selector) {
  return JSON.stringify(selector, (_key, value) => value instanceof RegExp ? value.toString() : value);
}

function center(bounds) {
  return { x: Math.round((bounds[0] + bounds[2]) / 2), y: Math.round((bounds[1] + bounds[3]) / 2) };
}

function records(text, marker) {
  return String(text).split(/\r?\n/).flatMap(line => {
    const index = line.indexOf(marker);
    const prefix = index >= 0 ? line.slice(0, index) : '';
    const pid = /\s(\d+)\s+\d+\s+[VDIWEF]\s/u.exec(prefix)?.[1];
    return pid ? [{ pid, line, payload: line.slice(index + marker.length) }] : [];
  });
}

async function runJourney(id, run, candidate, options, outputDir) {
  const probe = openProbe({ hdc: options.hdc, server: SERVER, target: options.target, outputDir });
  const steps = [];
  const receipt = { journey: id, appBuildId: candidate.appBuildId, hapSha256: candidate.hapSha256, status: 'FAIL', steps };
  const start = performance.now();
  const nonce = randomUUID();
  let captureNumber = 0;
  let processId;
  let root;
  let sample;
  let canCapture = false;
  let lastReason = 'No UI observation';
  let currentStep = 'fixture setup';

  async function capture(op) {
    const path = `/data/local/tmp/reader-control-journey-${nonce}-${++captureNumber}.${op === 'screenCap' ? 'png' : 'json'}`;
    const dispatched = await probe.command({ op, path });
    const transferred = await probe.command({ op: 'recv', path });
    const file = probe.capturePath(path);
    const content = readFileSync(file);
    demand(content.length === transferred.bytes && sha256(content) === transferred.sha256, 'Capture bytes do not match native transfer');
    return { seq: dispatched.seq, received: transferred.seq, sha256: transferred.sha256, file: file.slice(outputDir.length + 1), content };
  }

  async function layoutLog() {
    const log = await probe.command({ op: 'journeyLayoutLog' });
    const samples = records(log.stdout, LAYOUT_MARKER).filter(item => item.pid === processId).map(item => {
      try { return JSON.parse(item.payload); } catch { return undefined; }
    }).filter(item => item?.schemaVersion === 1 && Number.isSafeInteger(item.sequence) && item.sequence > 0);
    return { seq: log.seq, sample: samples.at(-1) };
  }

  async function checkpoint(description, outcome, dispatch) {
    currentStep = description;
    const stepStart = performance.now();
    const priorSequence = (await layoutLog()).sample?.sequence ?? 0;
    const recoverModal = sample?.modalOpen === true && outcome.modalOpen === false;
    const input = dispatch === undefined ? undefined : await dispatch();
    const until = performance.now() + STEP_MS;
    do {
      const raw = await capture('dumpLayout');
      const afterLog = await layoutLog();
      let afterRoot;
      try { afterRoot = appTree(JSON.parse(raw.content.toString('utf8'))); }
      catch (error) { lastReason = error.message; await delay(180); continue; }
      const observed = afterLog.sample;
      const present = (outcome.all ?? []).every(selector => matchingNodes(afterRoot, selector).length > 0);
      const absent = (outcome.none ?? []).every(selector => matchingNodes(afterRoot, selector).length === 0);
      const fresh = observed?.sequence > priorSequence;
      const state = fresh && (outcome.route === undefined || observed.route === outcome.route) &&
        (outcome.modalOpen === undefined || observed.modalOpen === outcome.modalOpen);
      if (present && absent && state && observed.status === 'measured' && !observed.recoveryPending &&
          (!recoverModal || observed.observedRules?.includes('R6') === true)) {
        steps.push({ step: description, elapsedMs: Math.round(performance.now() - stepStart), actionSeq: input?.seq ?? null,
          layout: { seq: raw.seq, received: raw.received, sha256: raw.sha256, file: raw.file }, reportSeq: afterLog.seq, report: observed });
        demand(Array.isArray(observed.violations) && observed.violations.length === 0 &&
          Array.isArray(observed.missing) && observed.missing.length === 0, `Layout invariants failed for ${description}`);
        root = afterRoot;
        sample = observed;
        return;
      }
      const missing = (outcome.all ?? []).filter(selector => matchingNodes(afterRoot, selector).length === 0).map(showSelector);
      lastReason = JSON.stringify({ fresh, present, absent, missing, route: observed?.route, modal: observed?.modalOpen,
        pending: observed?.recoveryPending, scan: observed?.status, rules: observed?.observedRules, unmeasured: observed?.missing });
      await delay(180);
    } while (performance.now() < until);
    throw Error(`Step did not settle: ${description} (${lastReason})`);
  }

  const ui = {
    has: selector => matchingNodes(root, selector).length > 0,
    wait: (description, outcome) => checkpoint(description, outcome),
    tap: (description, selector, outcome) => checkpoint(description, outcome,
      () => probe.command({ op: 'click', ...center(actor(root, selector)) })),
    longPress: (description, selector, outcome) => checkpoint(description, outcome,
      () => probe.command({ op: 'longClick', ...center(actor(root, selector)) })),
    key: (description, key, outcome) => checkpoint(description, outcome, () => probe.command({ op: 'keyEvent', key })),
    input: (description, selector, text, outcome) => checkpoint(description, outcome,
      () => probe.command({ op: 'inputText', text, ...center(actor(root, selector)) })),
    swipe: (description, selector, direction, outcome) => checkpoint(description, outcome, () => {
      const [left, top, right, bottom] = actor(root, selector);
      const { x, y } = center([left, top, right, bottom]);
      const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
      const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
      demand(dx || dy, 'Unsupported swipe direction');
      const horizontal = Math.round((right - left) / 4);
      const vertical = Math.round((bottom - top) / 4);
      return probe.command({ op: 'swipe', fromX: x - dx * horizontal, fromY: y - dy * vertical,
        toX: x + dx * horizontal, toY: y + dy * vertical, velocity: 500 });
    }),
  };

  try {
    await probe.ready();
    const readiness = await probe.command({ op: 'uiContractReadiness', targetKind: 'vm', vmLocation: 'remote' });
    assertRemoteVmReadiness(readiness, candidate);
    assertInstalled(await probe.command({ op: 'uiContractInstalledIdentity' }), candidate);
    const focus = (await probe.command({ op: 'uiContractFocusWindow' })).stdout;
    if (classifyFocusWindow(focus) === 'LOCKED') {
      await probe.command(vmLockDismissalOperation(focus));
      await delay(1000);
      assertVmLockDismissed((await probe.command({ op: 'uiContractFocusWindow' })).stdout);
    } else assertUnlockedFocus(focus, 'before-launch');
    const prior = await probe.command({ op: 'journeyFixtureLog' });
    const oldEntries = new Set(records(prior.stdout, FIXTURE_MARKER).map(entry => entry.line));
    await probe.command({ op: 'force-stop', explicitPermit: true });
    await probe.command({ op: 'startRemoteJourneyFixture' });
    const setupDeadline = performance.now() + 30000;
    while (processId === undefined && performance.now() < setupDeadline) {
      const log = await probe.command({ op: 'journeyFixtureLog' });
      processId = records(log.stdout, FIXTURE_MARKER).filter(entry => !oldEntries.has(entry.line)).at(-1)?.pid;
      if (processId === undefined) await delay(350);
    }
    demand(processId !== undefined, 'No fresh isolated public fixture startup receipt');
    canCapture = true;
    await run(ui);
    assertInstalled(await probe.command({ op: 'uiContractInstalledIdentity' }), candidate);
    receipt.status = 'PASS';
  } catch (error) {
    receipt.failure = { step: currentStep, message: error.message };
    if (canCapture) {
      for (const op of ['dumpLayout', 'screenCap']) {
        try {
          const { content, ...captureReceipt } = await capture(op);
          receipt.failure[op] = captureReceipt;
        } catch (captureError) { receipt.failure[`${op}Error`] = captureError.message; }
      }
    }
  } finally {
    receipt.probe = await probe.close();
    receipt.seconds = Math.round(performance.now() - start) / 1000;
    if (!receipt.probe.clean) receipt.status = 'FAIL';
    writeFileSync(join(outputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, { mode: 0o600 });
  }
  return receipt;
}

async function main() {
  const { values } = parseArgs({ options: {
    all: { type: 'boolean' }, journey: { type: 'string', multiple: true }, manifest: { type: 'string' },
    deployment: { type: 'string' }, 'output-dir': { type: 'string' }, hdc: { type: 'string' }, target: { type: 'string' },
    'dry-run': { type: 'boolean' }, help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Usage: node scripts/vm-journeys.mjs (--all | --journey J1 ...) --manifest /path --deployment /path --hdc /path --target <discovered remote target> --output-dir /new/path');
    return;
  }
  demand(Boolean(values.all) !== Boolean(values.journey?.length), 'Select --all or one or more --journey ids');
  const requested = values.all ? Object.keys(journeys) : [...new Set(values.journey)];
  demand(requested.every(id => Object.hasOwn(journeys, id)), 'Unknown journey id');
  if (values['dry-run']) { console.log(JSON.stringify({ status: 'NOT_RUN', journeys: requested })); return; }
  for (const key of ['manifest', 'deployment', 'hdc', 'output-dir']) demand(isAbsolute(values[key] ?? ''), `--${key} must be absolute`);
  demand(/^127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(values.target ?? ''), 'Specify the exact discovered remote VM target');
  const manifest = readJson(values.manifest);
  const deployment = readJson(values.deployment);
  const identity = candidateIdentity(manifest, deployment, readJson(join(dirname(values.manifest), 'source-snapshot.json')));
  demand(deployment.targetKind === 'vm' && deployment.vmLocation === 'remote' && deployment.hdcServer === SERVER &&
    deployment.dataPolicy === 'preserve' && deployment.readiness?.evidenceScope === 'guest-only' &&
    manifest.abi === 'x86_64' && deployment.postInstall?.cpuAbi === 'x86_64' &&
    identity.targetRef === sha256(values.target).slice(0, 12), 'Deployment is not an admitted x86_64 remote VM candidate');
  const output = resolve(values['output-dir']);
  mkdirSync(output, { mode: 0o700 });
  const candidate = { ...identity, expectedVersion: manifest.expectedVersion, postInstall: deployment.postInstall,
    targetKind: deployment.targetKind, hdcServer: deployment.hdcServer, remoteGuestReadiness: deployment.readiness };
  const results = [];
  for (const id of requested) {
    const directory = join(output, id);
    mkdirSync(directory, { mode: 0o700 });
    const receipt = await runJourney(id, journeys[id], candidate, values, directory);
    results.push({ journey: id, status: receipt.status, seconds: receipt.seconds, failure: receipt.failure });
    console.log(`${id} ${receipt.status} ${receipt.seconds}s${receipt.failure ? ` ${receipt.failure.step}` : ''}`);
    // If the package, target or scope cannot be proved, no journey can accept actions.
    if (receipt.failure?.step === 'fixture setup' || !receipt.probe.clean) break;
  }
  for (const id of requested.slice(results.length)) results.push({ journey: id, status: 'NOT_RUN' });
  writeFileSync(join(output, 'summary.json'), `${JSON.stringify(results, null, 2)}\n`, { mode: 0o600 });
  if (results.some(result => result.status !== 'PASS')) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
