import { assertAppVersion } from '../../../../scripts/lib/app-build-identity.mjs';
import { captureRecord, pngSize } from '../../../lib/native-ui-evidence.mjs';
import { requireEvidence, validate } from '../../lib/evidence.mjs';
import { equalJson } from '../../lib/cases.mjs';
import { evaluateSearch } from '../../lib/search.mjs';
import { layoutTapPoint, normalizeHarmonyLayout, selectLayoutNode } from '../../lib/layout.mjs';

export const logCommand = ['shell', 'hilog', '-x', '-T', 'ReaderUIContract'];
export const installedCommand = ['shell', 'bm', 'dump', '-n', 'io.reader.minliny'];
export const startCommand = ['shell', 'aa', 'start', '-a', 'EntryAbility', '-b', 'io.reader.minliny', '-m', 'entry'];
const fragmentLine = /\/ReaderUIContract:\s+RUI1 ([0-9a-f-]{36})\/(\d+)\/(\d+)\/(\d+) (.*)$/u;

export function readProbeEvents(record, selectedInstance) {
  requireEvidence(record?.event === 'command' && record.ok === true && equalJson(record.args, logCommand),
    'App records require the successful UI contract Hilog command');
  const events = new Map();
  for (const line of record.stdout.split(/\r?\n/u)) {
    const match = fragmentLine.exec(line);
    if (!match || (selectedInstance && match[1] !== selectedInstance)) continue;
    const [, instanceId, seq, index, count, value] = match;
    const key = `${instanceId}:${seq}`;
    const fragment = events.get(key) ?? { instanceId, seq: Number(seq), total: Number(count), parts: [], invalid: false };
    if (fragment.total !== Number(count) || Number(index) !== fragment.parts.length || fragment.total < 1 || fragment.total > 512) {
      fragment.invalid = true;
    }
    fragment.parts.push(value);
    events.set(key, fragment);
  }
  const parsed = [];
  for (const { instanceId, seq, total, parts, invalid } of events.values()) {
    if (invalid || parts.length !== total) continue;
    try {
      const event = validate('event', JSON.parse(parts.join('')));
      if (event.instanceId === instanceId && event.eventSeq === seq &&
        event.semanticSeq <= seq && (event.kind === 'window-stable' || event.semanticSeq === seq)) parsed.push(event);
    } catch {
      // A missing piece is detected as a gap when its action window is decoded.
    }
  }
  return parsed;
}

export function latestProbeEvent(record, instanceId) {
  const events = readProbeEvents(record);
  if (!events.length) return null;
  const last = events.at(-1);
  if (instanceId && last.instanceId !== instanceId) throw new Error('Application instance changed during collection');
  return last;
}

export function checkpoint(record, instanceId) {
  const event = latestProbeEvent(record, instanceId);
  return event?.kind === 'window-stable' ? event : null;
}

export function probeEventsInRange(records, instanceId, afterSeq, throughSeq) {
  const bySequence = new Map();
  for (const record of records) {
    if (record.event !== 'command' || !record.ok || !equalJson(record.args, logCommand)) continue;
    for (const event of readProbeEvents(record, instanceId)) {
      if (event.eventSeq <= afterSeq || event.eventSeq > throughSeq) continue;
      const previous = bySequence.get(event.eventSeq);
      requireEvidence(!previous || equalJson(previous, event), 'Conflicting app event across probe log polls');
      if (!previous) bySequence.set(event.eventSeq, event);
    }
  }
  return [...bySequence.values()].sort((left, right) => left.eventSeq - right.eventSeq);
}

function windowStable(start, end) {
  return start.kind === 'window-stable' && end.kind === 'window-stable' &&
    start.instanceId === end.instanceId && start.eventSeq < end.eventSeq &&
    start.deviceMonoMs < end.deviceMonoMs && start.semanticSeq === end.semanticSeq &&
    start.windowRevision === end.windowRevision &&
    start.windowRevision === start.payload.report?.metrics?.revision &&
    end.windowRevision === end.payload.report?.metrics?.revision &&
    start.payload.windowId === end.payload.windowId &&
    start.payload.orientation === end.payload.orientation &&
    equalJson(start.payload.report?.metrics, end.payload.report?.metrics);
}

export function requireCommand(records, seq, args) {
  const command = records[seq - 1];
  requireEvidence(command?.event === 'command' && command.ok === true && equalJson(command.args, args),
    `Unexpected command at probe sequence ${seq}`);
  return command;
}

export function assertInstalled(identityRecord, candidate) {
  requireEvidence(identityRecord.installed?.bundlePresent === true, 'Current installed candidate unavailable');
  const installed = identityRecord.installed;
  assertAppVersion(candidate.expectedVersion, installed.appVersion, 'Live candidate');
  for (const field of ['appIdSha256','appIdentifierSha256','updateTime','cpuAbi','appProvisionType']) {
    requireEvidence(installed[field] === candidate.postInstall[field], `Installed candidate ${field} changed after deployment`);
  }
}

function onlyLogPolls(records, start, end) {
  return records.slice(start, end - 1).every(record => record.ok === true && equalJson(record.args, logCommand));
}

function partialMotionHeader(polls, instanceId, seq) {
  const parts = new Map();
  let count;
  for (const poll of polls) {
    let previousIndex = -1;
    for (const line of poll.stdout.split(/\r?\n/u)) {
      const match = fragmentLine.exec(line);
      if (!match || match[1] !== instanceId || Number(match[2]) !== seq) continue;
      const index = Number(match[3]);
      const total = Number(match[4]);
      const value = match[5];
      count ??= total;
      if (total !== count || count < 2 || count > 512 || index >= count || index <= previousIndex ||
          (parts.has(index) && parts.get(index) !== value)) return null;
      parts.set(index, value);
      previousIndex = index;
    }
  }
  const first = parts.get(0);
  const frames = first?.indexOf(',"frames":[') ?? -1;
  if (frames < 0 || parts.size >= count) return null;
  try {
    // Decode only the complete header. Retained frame fragments are never
    // turned into a motion event or passed to a behavior evaluator.
    const header = validate('event', JSON.parse(first.slice(0, frames) + '}}'));
    if (header.instanceId === instanceId && header.eventSeq === seq && header.semanticSeq === seq &&
        header.kind === 'reading.control-motion' && header.channel === 'motion') {
      return { header, count, available: parts.size };
    }
  } catch {
    return null;
  }
  return null;
}

function bindsPartialMotionBlock(header, events, direction) {
  const requests = events.filter(event => event.kind === 'reading.control-requested' && event.channel === 'business');
  const commits = events.filter(event => event.kind === 'reading.control-committed' && event.channel === 'business');
  if (requests.length !== 1 || commits.length !== 1) return false;
  const [request] = requests;
  const [commit] = commits;
  const { readingId, transitionId, accepted } = request.payload;
  const epoch = accepted?.epoch;
  if (typeof readingId !== 'string' || !readingId || typeof transitionId !== 'string' || !transitionId ||
      !Number.isSafeInteger(epoch) || request.payload.direction !== direction ||
      commit.eventSeq <= request.eventSeq || commit.payload.direction !== direction ||
      commit.payload.readingId !== readingId || commit.payload.transitionId !== transitionId || commit.payload.state?.epoch !== epoch) return false;
  const blocks = events.filter(event => event.kind === 'reading.control-motion' && event.channel === 'motion');
  blocks.push(header);
  blocks.sort((a, b) => a.eventSeq - b.eventSeq);
  return blocks.length >= 2 && blocks.length <= 72 && blocks[0].eventSeq > commit.eventSeq &&
    blocks.every(({eventSeq, payload}, index) => eventSeq === blocks[0].eventSeq + index &&
      payload.readingId === readingId && payload.transitionId === transitionId &&
      payload.epoch === epoch && payload.direction === direction &&
      payload.blockIndex === index && payload.blockCount === blocks.length &&
      payload.frameStart === index && payload.frameEnd === index && payload.endReason === 'completed' &&
      payload.droppedSamples === 0);
}

function eventSlice(records, entry, session, from, direction) {
  const before = checkpoint(requireCommand(records, entry.beforeLog, logCommand), session.instanceId);
  const floor = latestProbeEvent(requireCommand(records, entry.floorLog, logCommand), session.instanceId);
  const endLog = requireCommand(records, entry.afterLog, logCommand);
  const after = checkpoint(endLog, session.instanceId);
  requireEvidence(before && after && before.eventSeq === entry.beforeSeq && after.eventSeq === entry.afterSeq &&
    before.eventSeq < after.eventSeq && after.deviceMonoMs >= before.deviceMonoMs &&
    entry.beforeLog > from && entry.beforeLog < entry.floorLog && entry.floorLog < entry.afterLog &&
    floor && floor.eventSeq >= before.eventSeq && floor.eventSeq < after.eventSeq &&
    onlyLogPolls(records, from, entry.beforeLog) && onlyLogPolls(records, entry.floorLog, entry.afterLog),
  'Broken action or sample observation interval');
  const polls = records.slice(entry.floorLog - 1, entry.afterLog);
  const events = probeEventsInRange(polls, session.instanceId, before.eventSeq, after.eventSeq);
  const length = after.eventSeq - before.eventSeq;
  const chronologyError = 'Missing or out-of-order app event in the selected action or sample interval';
  let partial;
  let chronology = events;
  if (events.length !== length) {
    requireEvidence(direction && events.length === length - 1, chronologyError);
    const offset = events.findIndex((event, index) => event.eventSeq !== before.eventSeq + index + 1);
    requireEvidence(offset >= 0, chronologyError);
    partial = partialMotionHeader(polls, session.instanceId, before.eventSeq + offset + 1);
    requireEvidence(partial && bindsPartialMotionBlock(partial.header, events, direction), chronologyError);
    chronology = [...events.slice(0, offset), partial.header, ...events.slice(offset)];
  }
  requireEvidence(chronology.every((event, i) => event.eventSeq === before.eventSeq + i + 1 &&
      event.deviceMonoMs >= (chronology[i - 1]?.deviceMonoMs ?? before.deviceMonoMs)), chronologyError);
  return { before, after, events, partial };
}

const nodeVisible = (layout, id) => layout.nodes.some(node => node.id === id && node.visible === true && node.opacity > 0);

export function normalizeSample({ store, records, entry, before, after, refs, fixture }) {
  requireEvidence(windowStable(before, after), `Capture changed window, instance, semantic state or revision: ${entry.id}`);
  const bounds = { first: entry.beforeLog, last: entry.floorLog - 1 };
  const screenshot = entry.screenshot ? captureRecord(records, entry.screenshot, store.bytes(entry.screenshot), 'screenCap', bounds) : null;
  const layout = captureRecord(records, entry.layout, store.bytes(entry.layout), 'dumpLayout', bounds);
  const captureInterval = records.slice(entry.beforeLog, entry.floorLog - 1);
  requireEvidence(captureInterval.length === (screenshot ? 6 : 3) && captureInterval.every(record => record.event === 'capture-integrity' ||
    (record.event === 'command' && record.ok && (
      /^(screenCap|dumpLayout)$/.test(record.args?.[2] ?? '') && record.args?.slice(0, 2).join(' ') === 'shell uitest' ||
      record.args?.slice(0, 2).join(' ') === 'file recv'
    ))), 'A noncapture operation split one stable sample');
  const content = normalizeHarmonyLayout({
    tree: JSON.parse(layout.bytes), report: after.payload.report, sampleId: entry.id, state: entry.id,
    instanceId: after.instanceId, windowId: after.payload.windowId,
    publicBookTitle: fixture?.bookTitle,
    evidenceRefs: [entry.screenshot, entry.layout, ...refs].filter(Boolean),
  });
  const image = screenshot && pngSize(screenshot.bytes);
  requireEvidence((!image || content.window.displayRectPx?.width === image.width && content.window.displayRectPx?.height === image.height) &&
    content.window.orientation === after.payload.orientation,
  'Native screenshot, tree and window metrics do not describe the same display');
  return { ...content, beforeSeq: before.eventSeq, afterSeq: after.eventSeq, semanticSeq: after.semanticSeq,
    hostBeginMs: entry.hostBeginMs, hostEndMs: entry.hostEndMs };
}

export function assertCurrentActionState(step, sample, mark) {
  requireEvidence(sample && sample.instanceId === mark.instanceId &&
    sample.window.id === mark.payload.windowId && sample.window.revision === mark.windowRevision &&
    sample.semanticSeq === mark.semanticSeq && sample.afterSeq <= mark.eventSeq,
  `The native target is stale before ${step.id}`);
}

export function assertOwnerActionState(step, context, contract, mark) {
  if (step.id === 'input-search' || step.id === 'submit-search') {
    const requirement = step.id === 'input-search' ? 'focus' : 'edit-selection';
    const assertion = contract.assertions.find(item => item.evaluator === 'search' && item.kind === requirement);
    const result = evaluateSearch(assertion, context);
    requireEvidence(result.verdict === 'PASS', `Search precondition before ${step.id}: ${result.reason ?? result.verdict}`);
  } else if (step.id === 'open' || step.id === 'dismiss') {
    const preceding = context.actions[step.id === 'open' ? 'enter-reading' : 'open'];
    const kind = step.id === 'open' ? 'reading.ready' : 'reading.control-committed';
    const ready = context.events.filter(event => preceding && event.channel === 'business' && event.kind === kind &&
      event.instanceId === mark.instanceId && event.eventSeq > preceding.beforeSeq && event.eventSeq <= mark.eventSeq &&
      (step.id === 'open' || event.payload.direction === 'open'));
    const payload = ready[0]?.payload;
    const state = payload?.state;
    requireEvidence(ready.length === 1 && state?.heldPointerId === -1 &&
      state?.transition === '' && state?.targetLevel === (step.id === 'open' ? 'hidden' : 'home') &&
      state?.level === state?.targetLevel && (step.id === 'dismiss' || payload.localBook === true && payload.reduceMotion === false),
    `Reader owner or motion mode is not ready before ${step.id}`);
  }
}

export function requestedOperation(step, samples, inputWord) {
  if (step.op === 'keyEvent') return { op: 'keyEvent', key: 'Back' };
  const sample = samples[step.from];
  requireEvidence(sample, `Action ${step.id} has no measured target sample`);
  let target = step.target;
  if (Array.isArray(target)) {
    const present = target.filter(id => nodeVisible(sample, id));
    requireEvidence(present.length === 1, 'Reading interaction host is missing or ambiguous');
    [target] = present;
  }
  const node = selectLayoutNode(sample, target);
  const point = layoutTapPoint(node, { requireClickable: step.gesture !== true && step.op !== 'inputText' });
  requireEvidence(step.id !== 'submit-search' || node.searchSemantic === 'search',
    'The current native button has no enabled search semantics');
  if (step.gesture) {
    const ratio = (point.x - node.rectPx.left) / node.rectPx.width;
    requireEvidence(ratio >= 1/3 && ratio <= 2/3, 'The clipped native tap point is outside the reader control gesture region');
  }
  if (step.op === 'inputText') {
    requireEvidence(node.focused === true && sample.window.keyboard?.visible === true, 'Input requires the focused editor and visible IME');
    return { op: 'inputText', ...point, text: inputWord };
  }
  requireEvidence(step.op === 'click', 'Unknown Phase 0 input operation');
  return { op: 'click', ...point };
}

function actionArgs(operation) {
  if (operation.op === 'keyEvent') return ['shell','uitest','uiInput','keyEvent','Back'];
  const args = ['shell','uitest','uiInput',operation.op,String(operation.x),String(operation.y)];
  if (operation.op === 'inputText') args.push(`[length:${operation.text.length}]`);
  return args;
}

export function readyForStep(step, sample) {
  if (step.book) selectLayoutNode(sample, {publicBookTitle: step.publicBookTitle});
  return step.anchors.every(id => nodeVisible(sample, id)) &&
    (!step.anyAnchor || step.anyAnchor.some(id => nodeVisible(sample, id))) &&
    (step.keyboard === undefined || sample.window.keyboard?.visible === step.keyboard) &&
    (!step.focus || selectLayoutNode(sample, step.focus).focused === true);
}

export function sessionContext({store, session, sessionRef, candidate, contract}) {
  const context = { actions: {}, samples: {}, events: [], candidate };
  const raw = store.bytes(session.commands).toString('utf8').trim();
  const records = raw ? raw.split(/\r?\n/u).map(line => JSON.parse(line)) : [];
  const problems = [];
  if (!records.length) return { ...context, problems: ['Probe did not produce a session'], records };
  requireEvidence(records[0]?.event === 'ready' && records.every((record, index) =>
    record.seq === index + 1 && record.targetRef === candidate.targetRef), 'Probe journal sequence or exact target mismatch');
  requireEvidence(Date.parse(records[0].recordedAt) >= Date.parse(candidate.completedAt),
    'Probe session predates the supplied deployment');
  if (session.result === 'COMPLETED') {
    requireEvidence(records.at(-1)?.event === 'closed' && records.at(-1)?.reason === 'quit-or-eof' &&
      !records.some(record => record.ok === false), 'Completed run has no successful probe teardown');
  }
  let last = 0;
  let hostEndMs = 0;
  const allEvents = new Map();
  let previousAppSeq = 0;
  for (const [index, link] of session.chain.entries()) {
    const entry = link.entry;
    if (index === 0) {
      requireEvidence(entry.kind === 'preflight' && entry.readiness === 2 && entry.installed === 3 && entry.baselineLog === 4 &&
        entry.start === 5 && entry.startFloor === 6 && entry.startFloor < entry.initialLog &&
        onlyLogPolls(records, entry.startFloor, entry.initialLog),
        'Missing ordered boot, identity and normal startup');
      const readiness = records[entry.readiness - 1];
      requireEvidence(readiness?.event === 'readiness' && readiness.status === 'PASS' && readiness.exactConnected === true &&
        readiness.bootCompleted === true && readiness.sceneBoardStable === true &&
        readiness.targetKind === candidate.targetKind &&
        (candidate.targetKind !== 'vm' || readiness.emulatorLog?.bootMarker === true &&
          readiness.emulatorLog.instabilityAfterMarker === false) &&
        readiness.hdcServer === candidate.hdcServer, 'Unverified target, emulator boot, or SceneBoard');
      assertInstalled(requireCommand(records, entry.installed, installedCommand), candidate);
      requireCommand(records, entry.start, startCommand);
      const baseline = checkpoint(requireCommand(records, entry.baselineLog, logCommand));
      const floor = latestProbeEvent(requireCommand(records, entry.startFloor, logCommand));
      const initial = checkpoint(requireCommand(records, entry.initialLog, logCommand), session.instanceId);
      requireEvidence(initial && (baseline?.instanceId !== initial.instanceId || initial.eventSeq > baseline.eventSeq) &&
        (floor?.instanceId !== initial.instanceId || initial.eventSeq > floor.eventSeq),
        'No fresh normal-launch probe instance or Developer Mode heartbeat');
      previousAppSeq = initial.eventSeq;
      last = entry.initialLog;
      continue;
    }
    if (entry.kind === 'postflight') {
      requireEvidence(index === session.chain.length - 1 && index === contract.steps.length + 1 &&
        entry.installed === last + 1 && records.length === entry.installed + 1,
        'Unexpected final installed-candidate check');
      assertInstalled(requireCommand(records, entry.installed, installedCommand), candidate);
      last = entry.installed;
      continue;
    }
    const step = contract.steps[index - 1];
    requireEvidence(step?.id === entry.id && step.kind === entry.kind && Number.isFinite(entry.hostBeginMs) &&
      Number.isFinite(entry.hostEndMs) && entry.hostBeginMs >= hostEndMs && entry.hostEndMs >= entry.hostBeginMs,
    'Missing or out-of-order case steps');
    const refs = [sessionRef, session.commands];
    const prior = last;
    last = entry.afterLog;
    hostEndMs = entry.hostEndMs;
    try {
      const direction = contract.id === 'reading.control-open-motion' && step.kind === 'action' &&
        (step.id === 'open' || step.id === 'dismiss') ? step.id : undefined;
      const { before, after, events, partial } = eventSlice(records, entry, session, prior, direction);
      if (previousAppSeq) {
        const intervening = probeEventsInRange(records.slice(prior, entry.beforeLog),
          session.instanceId, previousAppSeq, before.eventSeq);
        requireEvidence(intervening.length === before.eventSeq - previousAppSeq &&
          intervening.every((event, i) => event.eventSeq === previousAppSeq + i + 1), 'Lost app events between steps');
        for (const event of intervening) allEvents.set(event.eventSeq, { ...event, evidenceRefs: refs });
      }
      previousAppSeq = after.eventSeq;
      for (const event of events) allEvents.set(event.eventSeq, { ...event, evidenceRefs: refs });
      // The checkpoint's sequence is useful to assert readiness as it stood
      // before a command even if there are no intervening semantic callbacks.
      allEvents.set(before.eventSeq, { ...before, evidenceRefs: refs });
      if (step.kind === 'sample' || step.kind === 'locate') {
        requireEvidence(Boolean(entry.screenshot) === (step.kind === 'sample'), 'Sample has incorrect capture class');
        const sample = normalizeSample({store, records, entry, before, after, refs, fixture: contract.fixture});
        requireEvidence(readyForStep({...step, publicBookTitle:contract.fixture.bookTitle}, sample), `Normal route or state not established at ${step.id}`);
        context.samples[step.id] = sample;
      } else {
        assertCurrentActionState(step, context.samples[step.from], before);
        assertOwnerActionState(step, {...context, events:[...allEvents.values()].filter(event => event.eventSeq <= before.eventSeq)}, contract, before);
        const operation = requestedOperation(step, context.samples, contract.fixture.inputWord);
        requireEvidence(entry.command === entry.beforeLog + 1 && entry.floorLog === entry.command + 1,
          'Action command is outside its causal interval');
        requireCommand(records, entry.command, actionArgs(operation));
        context.actions[step.id] = { actionId: `${session.runId}:${step.id}`, instanceId: before.instanceId,
          op: step.op,
          targetId: typeof step.target === 'string' ? step.target : Array.isArray(step.target) ?
            step.target.find(id => nodeVisible(context.samples[step.from], id)) : step.target?.id,
          beforeSeq: before.eventSeq, afterSeq: after.eventSeq,
          hostBeginMs: entry.hostBeginMs, hostEndMs: entry.hostEndMs, evidenceRefs: refs };
        if (partial) {
          const { eventSeq, payload } = partial.header;
          problems.push(`${entry.id}: Incomplete motion block ${payload.blockIndex + 1}/${payload.blockCount} (app event ${eventSeq}, ${partial.available}/${partial.count} Hilog fragments)`);
        }
      }
    } catch (error) {
      problems.push(`${entry.id}: ${error.message}`);
    }
  }
  requireEvidence(session.result !== 'COMPLETED' ||
    (session.chain.length === contract.steps.length + 2 && session.chain.at(-1).entry.kind === 'postflight'),
  'Completed session omitted a required case step');
  context.events = [...allEvents.values()].sort((a, b) => a.eventSeq - b.eventSeq);
  return { ...context, problems, records };
}
