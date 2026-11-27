#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { applyVmJourneyProfile, journeys } from './lib/vm-journey-cases.mjs';
import { renderVisualReview } from './lib/vm-visual-review.mjs';
import { layoutReports, layoutReceiptProblem, matchesVmEnvironment, matchingTransitions, records, shareReports,
  supportedVmDimensions, transitionReceiptProblem, transitionReports, transitionWatermark, verticalSwipeLane,
  ttsAuditionReports, vmJourneyMatrix } from './lib/vm-journey-evidence.mjs';
import { openProbe } from '../tools/ui-contract/collectors/harmonyos/transport.mjs';
import { assertInstalled, assertRemoteVmReadiness, remoteVmServer } from '../tools/ui-contract/collectors/harmonyos/candidate-evidence.mjs';
import { assertUnlockedFocus, assertVmLockDismissed, classifyFocusWindow, vmLockDismissalOperation } from '../tools/ui-contract/collectors/harmonyos/focus-window.mjs';
import { candidateIdentity, nativeBounds, normalReaderWindowRoots, sha256 } from '../tools/lib/native-ui-evidence.mjs';

const STEP_MS = 12000;
const MAX_TRANSPARENT_OPACITY = 0.01;
const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const demand = (condition, message) => { if (!condition) throw Error(message); };
const isUnpainted = attrs => attrs.visible === 'false' || attrs.visible === false ||
  Number(attrs.opacity ?? 1) <= MAX_TRANSPARENT_OPACITY;

class JourneyBlocked extends Error {}

function appTree(tree) {
  const roots = normalReaderWindowRoots(tree);
  demand(roots.length === 1, `Expected one normal Reader window, observed ${roots.length}`);
  return roots[0];
}

function nativeNodes(root) {
  const result = [];
  const visit = (node, parents, clip) => {
    const attrs = node.attributes ?? {};
    if (isUnpainted(attrs)) return;
    const bounds = nativeBounds(attrs.bounds);
    const visible = bounds && clip ? [
      Math.max(bounds[0], clip[0]), Math.max(bounds[1], clip[1]),
      Math.min(bounds[2], clip[2]), Math.min(bounds[3], clip[3]),
    ] : bounds;
    const hasArea = visible && visible[2] > visible[0] && visible[3] > visible[1];
    if (hasArea) result.push({ attrs, bounds: visible, parents, node });
    const clipsChildren = parents.length === 0 || ['Scroll', 'List', 'Grid'].includes(attrs.type);
    if (clipsChildren && visible && !hasArea) return;
    const childClip = clipsChildren && hasArea ? visible : clip;
    for (const child of node.children ?? []) visit(child, [...parents, attrs], childClip);
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
    attributeMatches(selector.text, [attributes.text]) && attributeMatches(selector.originalText, [attributes.originalText]) &&
    attributeMatches(selector.label, [attributes.text, attributes.description, attributes.accessibilityText, ...childLabels]) &&
    attributeMatches(selector.enabled, [attributes.enabled]) && attributeMatches(selector.clickable, [attributes.clickable]) &&
    attributeMatches(selector.selected, [attributes.selected]) && attributeMatches(selector.opacity, [attributes.opacity]) &&
    attributeMatches(selector.hitTestBehavior, [attributes.hitTestBehavior]) &&
    attributeMatches(selector.checked, [attributes.checked]);
}

function buttonLabels(node) {
  return (node.children ?? []).flatMap(child => {
    const attributes = child.attributes ?? {};
    if (attributes.clickable === 'true' || isUnpainted(attributes)) return [];
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
  if (selector.first === true && found.length > 0) return found[0].bounds;
  demand(found.length === 1, `Expected one enabled input target for ${showSelector(selector)}, observed ${found.length}`);
  return found[0].bounds;
}

function showSelector(selector) {
  return JSON.stringify(selector, (_key, value) => value instanceof RegExp ? value.toString() : value);
}

function center(bounds) {
  return { x: Math.round((bounds[0] + bounds[2]) / 2), y: Math.round((bounds[1] + bounds[3]) / 2) };
}

function nodeOrder(root, selectors) {
  const points = selectors.map(selector => matchingNodes(root, selector)).map(matches =>
    matches.length === 1 ? center(matches[0].bounds) : undefined);
  return points.some(point => !point) ? undefined : points;
}

const pointBefore = (left, right) => Math.abs(left.y - right.y) <= 3 ? left.x < right.x : left.y < right.y;

async function runJourney(id, run, candidate, options, outputDir, profile, relativeDirectory) {
  const probe = openProbe({ hdc: options.hdc, server: remoteVmServer, target: options.target, outputDir });
  const fixture = id === 'J8'
    ? { scope: 'empty-sources', start: 'startRemoteEmptySearchFixture', log: 'journeyEmptySearchFixtureLog',
      marker: 'Public UI fixture long-directory book verified' }
    : { scope: 'vm-journeys', start: id === 'J14' ? 'startRemoteBackupJourneyFixture' : 'startRemoteJourneyFixture', log: 'journeyFixtureLog',
      marker: 'Public UI fixture VM journeys verified' };
  const steps = [];
  const receipt = { journey: id, relativeDirectory, profile, fixtureScope: fixture.scope,
    appBuildId: candidate.appBuildId, hapSha256: candidate.hapSha256, status: 'FAIL', steps };
  const start = performance.now();
  const nonce = randomUUID();
  let captureNumber = 0;
  let processId;
  let root;
  let sample;
  let canCapture = false;
  let lastReason = 'No UI observation';
  let currentStep = 'fixture setup';

  function capturePath(extension) {
    return `/data/local/tmp/reader-control-journey-${nonce}-${++captureNumber}.${extension}`;
  }

  async function receiveCapture(path) {
    const transferred = await probe.command({ op: 'recv', path });
    const file = probe.capturePath(path);
    const content = readFileSync(file);
    demand(content.length > 0 && content.length === transferred.bytes &&
      sha256(content) === transferred.sha256, 'Capture is empty or does not match native transfer');
    return { received: transferred.seq, bytes: transferred.bytes, sha256: transferred.sha256,
      file: file.slice(outputDir.length + 1), content };
  }

  async function capture(op) {
    const path = capturePath(op === 'screenCap' ? 'png' : 'json');
    const dispatched = await probe.command({ op, path });
    return { seq: dispatched.seq, ...await receiveCapture(path) };
  }

  async function layoutLog() {
    const log = await probe.command({ op: 'journeyLayoutLog' });
    return { seq: log.seq, sample: layoutReports(log.stdout, processId).at(-1) };
  }

  async function transitionLog() {
    const log = await probe.command({ op: 'journeyTransitionLog' });
    const reports = transitionReports(log.stdout, processId);
    return { seq: log.seq, reports, watermark: transitionWatermark(log.stdout, processId, reports) };
  }

  async function transitionBeforeLayout(expectations, watermark) {
    const deadline = performance.now() + STEP_MS;
    do {
      const evidence = await transitionLog();
      if (expectations.every(expected => matchingTransitions(evidence.reports, watermark, expected)
        .some(report => report.frames.length === report.frameCount))) return evidence;
      await delay(180);
    } while (performance.now() < deadline);
    return undefined;
  }

  async function waitShare(predicate, until = performance.now() + STEP_MS) {
    do {
      const result = await probe.command({ op: 'journeyShareLog' });
      const match = shareReports(result.stdout, processId).find(predicate);
      if (match) return { seq: result.seq, ...match };
      await delay(180);
    } while (performance.now() < until);
    throw Error('No matching native ShareController receipt');
  }

  async function checkpoint(description, outcome, command) {
    currentStep = description;
    const stepStart = performance.now();
    const priorSequence = (await layoutLog()).sample?.sequence ?? 0;
    const expectations = [outcome.transition].flat().filter(Boolean);
    const priorTransition = expectations.length ? (await transitionLog()).watermark : 0;
    const recoverModal = sample?.modalOpen === true && outcome.modalOpen === false;
    const transitionCaptures = [];
    const action = command?.();
    demand(!outcome.filmstrip || (action && expectations.length > 0), 'A filmstrip requires one dispatched, observed transition');
    const input = action === undefined ? undefined : outcome.filmstrip ?
      await probe.command({ op: 'journeySampledAction', action,
        captures: [0, 100, 200, 320].map(atMs => ({ atMs, path: capturePath('png') })) }) :
      await probe.command(action);
    for (const image of input?.screenshots ?? []) {
      const { content, ...evidence } = await receiveCapture(image.path);
      transitionCaptures.push({ ...evidence, timestampMs: image.timestampMs, acquisitionMs: image.acquisitionMs });
    }
    // Native tree export overlaps the VM UI thread's frame window. Read the
    // completed native sampling receipt before requesting the steady tree.
    let sampledTransition = action && expectations.length && !outcome.filmstrip ?
      await transitionBeforeLayout(expectations, priorTransition) : undefined;
    const until = performance.now() + STEP_MS;
    let lastStep;
    do {
      const raw = await capture('dumpLayout');
      const afterLog = await layoutLog();
      let afterRoot;
      try { afterRoot = appTree(JSON.parse(raw.content.toString('utf8'))); }
      catch (error) { lastReason = error.message; await delay(180); continue; }
      const observed = afterLog.sample;
      const present = (outcome.all ?? []).every(selector => matchingNodes(afterRoot, selector).length > 0);
      const absent = (outcome.none ?? []).every(selector => matchingNodes(afterRoot, selector).length === 0);
      const textValues = outcome.sameText?.map(selector =>
        [...new Set(matchingNodes(afterRoot, selector).map(node => node.attrs.text)
          .filter(text => typeof text === 'string' && text.length > 0))]);
      const sameText = textValues === undefined ||
        (textValues.length > 0 && textValues.every(values => values.length === 1 && values[0] === textValues[0][0]));
      const orderedPoints = outcome.order ? nodeOrder(afterRoot, outcome.order) : undefined;
      const ordered = !outcome.order || (orderedPoints && orderedPoints.every((point, index) =>
        index === 0 || pointBefore(orderedPoints[index - 1], point)));
      const fresh = observed?.sequence > priorSequence;
      const state = fresh && (outcome.route === undefined || observed.route === outcome.route) &&
        (outcome.modalOpen === undefined || observed.modalOpen === outcome.modalOpen) &&
        (outcome.scheme === undefined || observed.scheme === outcome.scheme) &&
        (outcome.reducedMotion === undefined || observed.environment?.reducedMotion === outcome.reducedMotion);
      if (present && absent && sameText && ordered && state && observed.status === 'measured' && !observed.recoveryPending &&
          (!recoverModal || observed.observedRules?.includes('R6') === true)) {
        const step = { step: description, elapsedMs: Math.round(performance.now() - stepStart), actionSeq: input?.seq ?? null,
          layout: { seq: raw.seq, received: raw.received, sha256: raw.sha256, file: raw.file }, reportSeq: afterLog.seq, report: observed };
        if (textValues !== undefined) step.matchedText = textValues[0]?.[0];
        if (orderedPoints !== undefined) step.orderedNativeCenters = orderedPoints;
        if (outcome.filmstrip) step.transitionCaptures = transitionCaptures;
        lastStep = step;
        const problems = [layoutReceiptProblem(observed, outcome)].filter(Boolean);
        let waitingForTransition = false;
        if (expectations.length) {
          const transition = sampledTransition ?? await transitionLog();
          sampledTransition = undefined;
          step.transitionReportSeq = transition.seq;
          step.transition = [];
          for (const expected of expectations) {
            const matches = matchingTransitions(transition.reports, priorTransition, expected);
            if (!matches.length) waitingForTransition = true;
            for (const matched of matches) {
              step.transition.push(matched);
              const problem = transitionReceiptProblem(matched, expected.rules ?? []);
              if (problem === '逐帧分片不完整') { waitingForTransition = true; continue; }
              if (problem) problems.push(`${problem} (${matched.kind}/${matched.action})`);
            }
          }
        }
        if (problems.length) {
          steps.push(step);
          throw Error(`${description}: ${problems.join('；')}`);
        }
        if (!waitingForTransition) {
          steps.push(step);
          if (outcome.screenCapture) {
            const { content, ...screenshot } = await capture('screenCap');
            step.screenCap = screenshot;
          }
          root = afterRoot;
          sample = observed;
          return;
        }
      }
      const missing = (outcome.all ?? []).filter(selector => matchingNodes(afterRoot, selector).length === 0).map(showSelector);
      lastReason = JSON.stringify({ fresh, present, absent, textValues, orderedPoints, missing, route: observed?.route, modal: observed?.modalOpen,
        scheme: observed?.scheme, pending: observed?.recoveryPending, scan: observed?.status, rules: observed?.observedRules,
        unmeasured: observed?.missing, expectedTransition: expectations });
      await delay(180);
    } while (performance.now() < until);
    if (lastStep) steps.push(lastStep);
    else if (transitionCaptures.length) steps.push({ step: description, actionSeq: input?.seq ?? null, transitionCaptures });
    throw Error(`Step did not settle: ${description} (${lastReason})`);
  }

  const ui = {
    has: selector => matchingNodes(root, selector).length > 0,
    scheme: () => sample?.scheme,
    environment: () => sample?.environment,
    profile: profile.dimensions,
    block: message => { throw new JourneyBlocked(message); },
    defer: (step, reason) => {
      (receipt.blockers ??= []).push({ step, reason });
      steps.push({ step, status: 'BLOCKED', reason });
    },
    note: (step, detail) => steps.push({ step, detail }),
    externalCoverage: (step, reason) => {
      const entry = { step, status: 'NOT_RUN', reason };
      (receipt.externalCoverage ??= []).push(entry);
      steps.push(entry);
    },
    observedReadingMode: readingMode => { receipt.readingMode = readingMode; },
    value: (selector, attribute = 'text') => {
      const values = [...new Set(matchingNodes(root, selector).map(node => node.attrs[attribute]).filter(Boolean))];
      return values.length === 1 ? values[0] : undefined;
    },
    inOrder: (...selectors) => {
      const points = nodeOrder(root, selectors);
      return points !== undefined && points.every((point, index) => index === 0 || pointBefore(points[index - 1], point));
    },
    assertProfile: () => {
      const mismatches = matchesVmEnvironment(profile, sample ?? {});
      if (mismatches.length) throw new JourneyBlocked(mismatches.join('；'));
      receipt.environment = { ...sample.environment, scheme: sample.scheme };
    },
    wait: (description, outcome) => checkpoint(description, outcome),
    tap: (description, selector, outcome) => checkpoint(description, outcome,
      () => ({ op: 'click', ...center(actor(root, selector)) })),
    audition: async (description, selector, outcome) => {
      currentStep = description;
      const before = await probe.command({ op: 'journeyTtsAuditionLog' });
      const baseline = Math.max(0, ...ttsAuditionReports(before.stdout, processId).map(item => item.operationId));
      const input = await probe.command({ op: 'click', ...center(actor(root, selector)) });
      const step = { step: description, actionSeq: input.seq };
      steps.push(step);
      const deadline = performance.now() + 18000;
      do {
        const log = await probe.command({ op: 'journeyTtsAuditionLog' });
        const reports = ttsAuditionReports(log.stdout, processId).filter(item => item.operationId > baseline);
        const terminal = reports.find(item => item.state !== 'started');
        if (terminal) {
          step.ttsAudition = { seq: log.seq, reports };
          demand(reports.every(item => item.operationId === terminal.operationId) &&
            reports.filter(item => item.state !== 'started').length === 1,
            'Expected a single native audition operation for this click');
          if (terminal.state === 'unavailable') {
            demand(terminal.code === 'system-capability-missing' && reports.length === 1,
              'Native audition did not confirm a missing platform capability');
            ui.defer(description, '当前 VM 缺少系统朗读能力');
            await checkpoint('系统音色不可用后仍显示音色面板', outcome);
            return false;
          }
          demand(terminal.state === 'completed', `系统试听失败 (${terminal.code ?? 'unknown'})`);
          demand(reports.indexOf(terminal) > 0 && reports[0].state === 'started',
            'No native playback start before audition completion');
          await checkpoint('试听完成后仍显示音色面板', outcome);
          return true;
        }
        await delay(250);
      } while (performance.now() < deadline);
      throw Error('No native audio completion or explicit unavailability after audition click');
    },
    slideTo: (description, selector, fraction, outcome) => checkpoint(description, outcome, () => {
      demand(selector.type === 'Slider' && fraction >= 0 && fraction <= 1, 'Expected an observed slider and valid fraction');
      const [left, top, right, bottom] = actor(root, selector);
      return { op: 'click', x: Math.round(left + fraction * (right - left - 2) + 1), y: center([left, top, right, bottom]).y };
    }),
    longPress: (description, selector, outcome) => checkpoint(description, outcome,
      () => ({ op: 'longClick', ...center(actor(root, selector)) })),
    share: async (description, selector, outcome) => {
      currentStep = description;
      const before = await probe.command({ op: 'journeyShareLog' });
      const baseline = Math.max(0, ...shareReports(before.stdout, processId).map(item => item.operationId));
      const input = await probe.command({ op: 'click', ...center(actor(root, selector)) });
      const presented = await waitShare(item => item.operationId > baseline && ['presented', 'unavailable', 'unsafe'].includes(item.state));
      const step = { step: description, actionSeq: input.seq, share: [presented] };
      steps.push(step);
      demand(presented.state !== 'unsafe', 'Controlled public input rejected by ShareController');
      if (presented.state === 'unavailable') {
        ui.defer(description, '此 VM 没有可用的系统分享控制器');
        await checkpoint('系统分享不可用后仍在原 Reader 页面', outcome);
        return;
      }
      const { content, ...screenshot } = await capture('screenCap');
      step.screenCap = screenshot;
      await checkpoint('系统 Back 关闭分享并恢复原 Reader 页面', outcome, () => ({ op: 'keyEvent', key: 'Back' }));
      step.share.push(await waitShare(item => item.operationId === presented.operationId && item.state === 'dismissed'));
    },
    key: (description, key, outcome) => checkpoint(description, outcome, () => ({ op: 'keyEvent', key })),
    openInvalidBook: (description, outcome) => checkpoint(description, outcome, () => ({ op: 'openJourneyInvalidBook' })),
    input: (description, selector, text, outcome) => checkpoint(description, outcome,
      () => ({ op: 'inputText', text, ...center(actor(root, selector)) })),
    inputSourceUrl: (description, selector, outcome) => checkpoint(description, outcome,
      () => ({ op: 'inputSourceJourneyUrl', ...center(actor(root, selector)) })),
    drag: (description, from, to, outcome) => checkpoint(description, outcome, () => {
      const start = center(actor(root, from));
      const end = center(actor(root, to));
      return { op: 'drag', fromX: start.x, fromY: start.y, toX: end.x, toY: end.y, velocity: 200 };
    }),
    cancelEdgeBack: (description, outcome) => checkpoint(description, outcome, () => {
      const bounds = nativeBounds(root.attributes?.bounds);
      demand(bounds && bounds[2] - bounds[0] >= 160, 'No observable Reader window bounds for partial edge gesture');
      const [left, top, right, bottom] = bounds;
      const y = Math.round((top + bottom) / 2);
      const density = (right - left) / sample.environment.widthVp;
      // Stay inside the reader's native 18 vp edge lane but away from the
      // OS-facing margin where the previous VM swipe reached no app gesture.
      return { op: 'swipe', fromX: left + Math.max(4, Math.round(17 * density)), fromY: y,
        toX: left + Math.round((right - left) * .18), toY: y, velocity: 350 };
    }),
    swipe: (description, selector, direction, outcome, { avoid } = {}) => checkpoint(description, outcome, () => {
      const bounds = actor(root, selector);
      const [left, top, right, bottom] = bounds;
      const { x, y } = center(bounds);
      const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
      const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
      demand(dx || dy, 'Unsupported swipe direction');
      const horizontal = Math.round((right - left) / 4);
      const vertical = Math.round((bottom - top) / 4);
      const fromY = y - dy * vertical;
      const toY = y + dy * vertical;
      if (avoid) {
        demand(dy, 'An obstruction selector requires a vertical scroll');
        const lane = verticalSwipeLane(bounds, fromY, toY, matchingNodes(root, avoid).map(node => node.bounds));
        demand(lane !== undefined, 'No unobstructed vertical scroll lane in the native viewport');
        return { op: 'swipe', fromX: lane, fromY, toX: lane, toY, velocity: 500 };
      }
      return { op: 'swipe', fromX: x - dx * horizontal, fromY, toX: x + dx * horizontal, toY, velocity: 500 };
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
    const prior = await probe.command({ op: fixture.log });
    const oldEntries = new Set(records(prior.stdout, fixture.marker).map(entry => entry.line));
    await probe.command({ op: 'force-stop', explicitPermit: true });
    await probe.command({ op: fixture.start });
    const setupDeadline = performance.now() + 30000;
    while (processId === undefined && performance.now() < setupDeadline) {
      const log = await probe.command({ op: fixture.log });
      processId = records(log.stdout, fixture.marker).filter(entry => !oldEntries.has(entry.line)).at(-1)?.pid;
      if (processId === undefined) await delay(350);
    }
    demand(processId !== undefined, 'No fresh isolated public fixture startup receipt');
    canCapture = true;
    await applyVmJourneyProfile(ui);
    await run(ui);
    assertInstalled(await probe.command({ op: 'uiContractInstalledIdentity' }), candidate);
    receipt.status = receipt.blockers?.length ? 'BLOCKED' : 'PASS';
  } catch (error) {
    if (error instanceof JourneyBlocked) receipt.status = 'BLOCKED';
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
    material: { type: 'string' }, motion: { type: 'string' }, scheme: { type: 'string' },
    'reading-mode': { type: 'string' }, 'font-scale': { type: 'string' }, window: { type: 'string' },
  } });
  if (values.help) {
    console.log('Usage: node scripts/vm-journeys.mjs (--all | --journey J1 ...) --manifest /path --deployment /path --hdc /path --target <discovered remote target> --output-dir /new/path');
    console.log('Matrix axes (comma-separated combinations): --material native,performance --motion standard,reduced --scheme day,night --reading-mode paged,continuous --font-scale actual,1.6,2.0 --window actual,portrait,landscape,narrow');
    console.log('The remote VM probe observes system font scale and window size. Provision these settings externally or validate them on a physical device. Use --dry-run to expand the selected combinations.');
    return;
  }
  demand(Boolean(values.all) !== Boolean(values.journey?.length), 'Select --all or one or more --journey ids');
  const requested = values.all ? Object.keys(journeys) : [...new Set(values.journey)];
  demand(requested.every(id => Object.hasOwn(journeys, id)), 'Unknown journey id');
  const profiles = vmJourneyMatrix(values);
  if (values['dry-run']) {
    console.log(JSON.stringify({ status: 'NOT_RUN', journeys: requested, profiles, dimensions: supportedVmDimensions }));
    return;
  }
  for (const key of ['manifest', 'deployment', 'hdc', 'output-dir']) demand(isAbsolute(values[key] ?? ''), `--${key} must be absolute`);
  demand(/^127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(values.target ?? ''), 'Specify the exact discovered remote VM target');
  const manifest = readJson(values.manifest);
  const deployment = readJson(values.deployment);
  const identity = candidateIdentity(manifest, deployment, readJson(join(dirname(values.manifest), 'source-snapshot.json')));
  demand(deployment.targetKind === 'vm' && deployment.vmLocation === 'remote' && deployment.hdcServer === remoteVmServer &&
    deployment.dataPolicy === 'preserve' && deployment.readiness?.evidenceScope === 'guest-only' &&
    manifest.abi === 'x86_64' && deployment.postInstall?.cpuAbi === 'x86_64' &&
    identity.targetRef === sha256(values.target).slice(0, 12), 'Deployment is not an admitted x86_64 remote VM candidate');
  const output = resolve(values['output-dir']);
  mkdirSync(output, { mode: 0o700 });
  const candidate = { ...identity, expectedVersion: manifest.expectedVersion, postInstall: deployment.postInstall,
    targetKind: deployment.targetKind, hdcServer: deployment.hdcServer, remoteGuestReadiness: deployment.readiness };
  const results = [];
  const visualReceipts = [];
  let transportFailed = false;
  for (const profile of profiles) {
    for (const id of requested) {
      const relativeDirectory = profile.id === 'observed-default' ? id : `${profile.id}/${id}`;
      if (transportFailed) {
        const skipped = { journey: id, profile, relativeDirectory, status: 'NOT_RUN' };
        results.push(skipped);
        visualReceipts.push(skipped);
        continue;
      }
      const directory = join(output, relativeDirectory);
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const receipt = await runJourney(id, journeys[id], candidate, values, directory, profile, relativeDirectory);
      visualReceipts.push(receipt);
      results.push({ journey: id, profile, relativeDirectory, status: receipt.status, seconds: receipt.seconds,
        environment: receipt.environment, readingMode: receipt.readingMode, blockers: receipt.blockers,
        externalCoverage: receipt.externalCoverage, failure: receipt.failure });
      console.log(`${relativeDirectory} ${receipt.status} ${receipt.seconds}s${receipt.failure ? ` ${receipt.failure.step}` : ''}`);
      // If package, target, or fixture ownership is lost, no later case can dispatch input.
      transportFailed = receipt.failure?.step === 'fixture setup' || !receipt.probe.clean;
    }
  }
  writeFileSync(join(output, 'summary.json'), `${JSON.stringify(results, null, 2)}\n`, { mode: 0o600 });
  const review = renderVisualReview(visualReceipts);
  writeFileSync(join(output, 'visual-review.md'), review.markdown, { mode: 0o600 });
  writeFileSync(join(output, 'visual-review.html'), review.html, { mode: 0o600 });
  if (results.some(result => result.status !== 'PASS')) process.exitCode = 1;
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
