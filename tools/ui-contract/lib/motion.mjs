import { layoutTapPoint, selectLayoutNode } from './layout.mjs';

const OWNER = 'entry/src/main/ets/features/reading/ui/';
const TIMING = 'entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';

const OWNER_INPUTS = {
  [OWNER + 'LocalReadingExperience.ets']: ['openReaderControl', 'requestExit', 'onControlSessionChanged'],
  [OWNER + 'ReaderControlHostSession.ts']: ['backReaderControlHostSession', 'readerControlHostCloseCommitted'],
  [OWNER + 'ReaderControlSessionState.ts']: ['openReaderControlSession', 'finishIfReached'],
  [OWNER + 'ReaderControlPanel.ets']: ['acceptRuntime', 'commitVisualSession'],
  [OWNER + 'ReaderControlVerificationSession.ts']: ['accept', 'observeHostState'],
};
const MOTION_INPUTS = {
  ...OWNER_INPUTS,
  [OWNER + 'ReaderControlSessionState.ts']: [...OWNER_INPUTS[OWNER + 'ReaderControlSessionState.ts'],
    'advanceReaderControlSession', 'rebaseReaderControlTransitionProgress'],
  [OWNER + 'ReaderControlPanel.ets']: ['scheduleRuntimeFrame', 'clockSample', 'controlContent'],
  [OWNER + 'ReaderControlMotionGeometry.ts']: ['sampleReaderControlWholeVisibility', 'sampleReaderControlMotionComposition',
    'ReaderControlMotionFrameCache'],
  [OWNER + 'ReaderControlMotionPolicy.ts']: ['readerControlMotionCommandTiming'],
  [OWNER + 'ReaderControlVerificationMotion.ets']: ['recordActor', 'ReaderControlVerificationMotion'],
  [TIMING]: ['READER_CONTROL_OPEN_MS', 'READER_CONTROL_DISMISS_MS'],
};
const ACTORS = {
  shell: 'reader-control-motion-shell',
  grabber: 'reader-control-motion-grabber',
  dock: 'reader-control-motion-dock',
  content: 'reader-control-content-host',
};
const CONTENT_CLIP = 'reader-control-motion-content-clip';
const IDENTITY_MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const levels = {
  open: { from: 'hidden', to: 'home', first: 'reading-before', last: 'control-open', op: 'click' },
  dismiss: { from: 'home', to: 'hidden', first: 'control-open', last: 'control-closed', op: 'keyEvent' },
};

const sequence = x => Number.isSafeInteger(x) && x >= 0;
const finite = Number.isFinite;
const present = (item, keys) => item && keys.every(key => finite(item[key]));
const box = rect => present(rect, ['x', 'y', 'width', 'height']) && rect.width > 0 && rect.height > 0;
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
const comparable = (value, tolerance, expected) => value.every((num, index) => near(num, expected[index], tolerance));

class MissingMotionEvidence extends Error {}

function requireEvidence(condition, reason) {
  if (!condition) throw new MissingMotionEvidence(reason);
}

function validState(state) {
  return state !== null && state && sequence(state.epoch) && sequence(state.openRevision) && sequence(state.closeRevision) &&
    typeof state.level === 'string' && typeof state.targetLevel === 'string' &&
    typeof state.transition === 'string' && Number.isSafeInteger(state.heldPointerId);
}

function sameState(a, b) {
  return validState(a) && validState(b) &&
    ['epoch','openRevision','closeRevision','level','targetLevel','transition','heldPointerId']
      .every(key => a[key] === b[key]);
}

function withinInterval(event, action) {
  return event.eventSeq > action.beforeSeq && event.eventSeq <= action.afterSeq;
}

function runtimeSegments(frames) {
  const segments = [];
  for (const frame of frames) {
    const segment = segments.at(-1);
    const previous = frames[frame.index - 1];
    const prior = frames[frame.index - 2];
    const { runtimeTicket: ticket, runtimeDurationMs: durationMs, runtimeElapsedMs: elapsedMs } = frame;
    if (segment?.ticket !== ticket) {
      // Revocation can reset elapsed without changing the owner epoch. A
      // sampled ticket boundary admits a local curve, not its cause.
      requireEvidence(elapsedMs === 0 && (segment === undefined ||
        (ticket > segment.ticket && durationMs <= segment.durationMs - previous.runtimeElapsedMs)),
      `Incomparable runtime ticket boundary at frame ${frame.index}`);
      segments.push({ ticket, durationMs, start: frame.index, end: frame.index });
      continue;
    }
    // A progress observation precedes publication of the current runtime tick.
    const hasPreviousDelta = prior?.runtimeTicket === ticket;
    requireEvidence(durationMs === segment.durationMs && elapsedMs > previous.runtimeElapsedMs &&
      (!hasPreviousDelta || elapsedMs - previous.runtimeElapsedMs === previous.runtimeTickMs - prior.runtimeTickMs),
    `Incomparable elapsed time for runtime ticket ${ticket} at frame ${frame.index}`);
    segment.end = frame.index;
  }
  return segments;
}

class MotionEvidence {
  constructor(context, assertion) {
    this.context = context;
    this.assertion = assertion;
    this.refs = new Map();
  }

  use(record) {
    for (const ref of record?.evidenceRefs ?? []) this.add(ref);
    return record;
  }

  add(ref) {
    if (ref?.path) this.refs.set(ref.path, ref);
  }

  source(name) {
    requireEvidence(this.assertion.sources?.includes(name), `Unapproved reading evidence source: ${name}`);
  }

  sample(id) {
    const sample = this.use(this.context.samples[id]);
    requireEvidence(sample && sequence(sample.beforeSeq) && sequence(sample.afterSeq) &&
      sample.afterSeq >= sample.beforeSeq && finite(sample.hostBeginMs) &&
      finite(sample.hostEndMs) && sample.hostEndMs >= sample.hostBeginMs,
    `Missing stable sample interval for ${id}`);
    this.source('window-metrics');
    const kb = sample.window?.keyboard;
    requireEvidence(kb && kb.visible === false && kb.revision === sample.window.revision,
      `${id} does not establish a hidden keyboard in the captured revision`);
    return sample;
  }

  event(kind, channel, instanceId, select) {
    return this.context.events.filter(event => event.kind === kind && event.channel === channel &&
      event.instanceId === instanceId && select(event)).map(event => this.use(event));
  }

  ownerSources(inputs) {
    return Object.entries(inputs).map(([path, symbols]) => {
      const source = this.context.candidate?.ownerSources?.[path];
      const sha256 = typeof source === 'string' ? source : source?.sha256;
      requireEvidence(typeof sha256 === 'string' && /^[a-f0-9]{64}$/u.test(sha256),
        `Deployed snapshot lacks the owner source SHA-256 for ${path}`);
      this.add(source);
      return { path, symbols, sha256 };
    });
  }

  node(sample, id) {
    this.source('native-tree');
    try {
      return selectLayoutNode(sample, id);
    } catch (error) {
      throw new MissingMotionEvidence(error.message);
    }
  }

  request(direction) {
    this.source('app-owner');
    const config = levels[direction];
    const first = this.sample(config.first);
    const last = this.sample(config.last);
    const action = this.use(this.context.actions[direction]);
    requireEvidence(action?.op === config.op && typeof action?.actionId === 'string' &&
      action.instanceId === first.instanceId && action.instanceId === last.instanceId &&
      first.window.id === last.window.id && sequence(action.beforeSeq) && sequence(action.afterSeq) &&
      first.afterSeq <= action.beforeSeq && action.beforeSeq <= action.afterSeq && action.afterSeq <= last.beforeSeq &&
      finite(action.hostBeginMs) && finite(action.hostEndMs) &&
      first.hostEndMs <= action.hostBeginMs && action.hostBeginMs <= action.hostEndMs && action.hostEndMs <= last.hostBeginMs,
    `No same-window causal action interval for ${direction}`);
    const requests = this.event('reading.control-requested', 'business', action.instanceId,
      event => withinInterval(event, action));
    requireEvidence(requests.length === 1 && requests[0].payload.direction === direction,
      `The ${direction} action has no unique accepted owner transition`);
    const request = requests[0];
    const payload = request.payload;
    requireEvidence(typeof payload.readingId === 'string' && typeof payload.transitionId === 'string' &&
      validState(payload.before) && validState(payload.accepted) && finite(payload.durationMs),
    'The accepted owner transition is missing its reading and generation state');
    const commits = this.event('reading.control-committed', 'business', action.instanceId,
      event => event.eventSeq > request.eventSeq && event.eventSeq <= last.beforeSeq &&
        event.payload.readingId === payload.readingId && event.payload.transitionId === payload.transitionId &&
        event.payload.direction === direction && event.payload.state?.epoch === payload.accepted.epoch);
    requireEvidence(commits.length === 1 && validState(commits[0].payload.state),
      `The current ${direction} transition has no unique committed host endpoint`);
    this.node(first, 'reader-reading-stage');
    this.node(last, 'reader-reading-stage');
    return { action, request, commit: commits[0], first, last };
  }

  pair(direction) {
    const open = this.request('open');
    const data = direction === 'open' ? open : this.request('dismiss');
    const opened = open.request.payload;
    const shelf = this.sample('reading-book-entry');
    const enter = this.use(this.context.actions['enter-reading']);
    requireEvidence(enter?.op === 'click' && typeof enter.actionId === 'string' &&
      shelf.instanceId === open.first.instanceId && enter.instanceId === open.first.instanceId &&
      shelf.afterSeq <= enter.beforeSeq && enter.beforeSeq <= enter.afterSeq && enter.afterSeq <= open.first.beforeSeq &&
      shelf.hostEndMs <= enter.hostBeginMs && enter.hostBeginMs <= enter.hostEndMs && enter.hostEndMs <= open.first.hostBeginMs,
    'No current normal entry from the controlled shelf to the reader');
    requireEvidence(typeof shelf.publicBookTitle === 'string' && shelf.publicBookTitle.length > 0,
      'The normal shelf sample has no public book fixture identity');
    this.node(shelf, { publicBookTitle: shelf.publicBookTitle });
    const readies = this.event('reading.ready', 'business', open.first.instanceId,
      event => withinInterval(event, enter) && event.payload.readingId === opened.readingId &&
        event.payload.interactionHostId === open.action.targetId &&
        ['paged','continuous'].includes(event.payload.mode));
    requireEvidence(readies.length === 1 && readies[0].payload.localBook === true &&
      readies[0].payload.reduceMotion === false && sameState(readies[0].payload.state, opened.before),
    'The controlled reading instance has no matching ready state in standard motion mode');
    const ready = readies[0];
    const target = this.node(open.first, ready.payload.interactionHostId);
    let point;
    try {
      point = layoutTapPoint(target, { requireClickable: false });
    } catch (error) {
      throw new MissingMotionEvidence(error.message);
    }
    const rect = target.rectPx;
    const centerRatio = (point.x - rect.left) / rect.width;
    requireEvidence(finite(centerRatio) && centerRatio >= 1 / 3 && centerRatio <= 2 / 3,
      'The physical tap point is outside the central control gesture region');
    if (direction === 'dismiss') {
      requireEvidence(data.first.sampleId === open.last.sampleId &&
        data.request.payload.readingId === opened.readingId &&
        sameState(data.request.payload.before, open.commit.payload.state) &&
        data.request.payload.transitionId !== opened.transitionId,
      'Back is disconnected from the just-opened reading control session');
    }
    return { ...data, ready, point };
  }

  trace(data) {
    this.source('debug-frame');
    const p = data.request.payload;
    const events = this.event('reading.control-motion', 'motion', data.action.instanceId,
      event => event.eventSeq > data.request.eventSeq && event.eventSeq <= data.last.beforeSeq &&
        event.payload.readingId === p.readingId && event.payload.transitionId === p.transitionId &&
        event.payload.direction === p.direction && event.payload.epoch === p.accepted.epoch);
    const blocks = events.map(event => event.payload);
    const revision = data.request.windowRevision;
    requireEvidence(sequence(revision) && data.first.window.revision === revision && data.last.window.revision === revision &&
      data.commit.windowRevision === revision && events.every(event => event.windowRevision === revision),
    `The ${p.direction} trace crosses window revisions`);
    requireEvidence(blocks.length > 0 && blocks.length <= 72 && blocks.every((block, index) =>
      block.blockIndex === index && block.blockCount === blocks.length &&
      block.endReason === 'completed' && block.droppedSamples === 0 &&
      Array.isArray(block.frames) && block.frames.length > 0 &&
      block.frameStart === block.frames[0].index && block.frameEnd === block.frames.at(-1).index),
    `The ${p.direction} trace has missing or duplicate blocks, a missing endpoint, or discarded frames`);
    const frames = blocks.flatMap(block => block.frames);
    requireEvidence(frames.length >= 3 && frames.length <= 72 && frames.every((frame, index) => {
      const previous = frames[index - 1];
      const phase = index === 0 ? 'start' : index === frames.length - 1 ? 'endpoint' : 'progress';
      return frame.index === index && frame.phase === phase && frame.runtimeEpoch === p.accepted.epoch &&
        sequence(frame.runtimeTicket) &&
        present(frame, ['frameTimeNs', 'captureStartMs', 'captureEndMs', 'runtimeElapsedMs', 'runtimeTickMs',
          'runtimeDurationMs', 'visibilityProgress', 'expansionProgress', 'runtimeLayoutOffsetVp', 'density']) &&
        frame.runtimeDurationMs > 0 && frame.runtimeElapsedMs >= 0 &&
        (phase === 'endpoint' ? frame.runtimeElapsedMs >= frame.runtimeDurationMs :
          frame.runtimeElapsedMs < frame.runtimeDurationMs) &&
        frame.visibilityProgress >= 0 && frame.visibilityProgress <= 1 &&
        frame.density > 0 && frame.density === frames[0].density &&
        frame.captureStartMs >= data.request.deviceMonoMs && frame.captureEndMs >= frame.captureStartMs &&
        frame.captureEndMs <= events.at(-1).deviceMonoMs &&
        frame.observationPhase === (phase === 'endpoint' ? 'after-endpoint-publication' : 'before-runtime-publication') &&
        frame.runtimeElapsedSource === (phase === 'endpoint' ? 'runtime-tick-delta' : 'runtime-transition') &&
        (!previous || frame.frameTimeNs > previous.frameTimeNs && frame.captureStartMs >= previous.captureEndMs &&
          (phase === 'endpoint' ? frame.runtimeTickMs === previous.runtimeTickMs :
            frame.runtimeTickMs > previous.runtimeTickMs));
    }), `The ${p.direction} frame sequence or timestamp endpoints are incomplete or incomparable`);
    const segments = runtimeSegments(frames);
    const final = segments.at(-1);
    requireEvidence(final.end - final.start >= 2 &&
      frames.some(frame => frame.phase === 'progress' && frame.visibilityProgress > 0 && frame.visibilityProgress < 1),
    'No complete runtime-time interval from start through an interior observation to the endpoint');
    const vis = this.event('reading.control-visual', 'motion', data.action.instanceId,
      event => event.eventSeq > data.request.eventSeq && event.eventSeq < data.commit.eventSeq &&
        event.payload.transitionId === p.transitionId && event.payload.readingId === p.readingId &&
        event.payload.direction === p.direction && event.payload.epoch === p.accepted.epoch);
    requireEvidence(vis.length === 1 && vis[0].windowRevision === revision && vis[0].payload.source === 'runtime-progress' &&
      vis[0].payload.visibilityProgress > 0 && vis[0].payload.visibilityProgress < 1,
    'The current transition has no matching admitted visual progression before commit');
    return { frames, events, segments };
  }
}

function ownerResult(evidence, direction, data) {
  const sourceRefs = evidence.ownerSources(OWNER_INPUTS);
  const p = data.request.payload;
  const committed = data.commit.payload.state;
  const level = levels[direction];
  const open = direction === 'open';
  const expected = evidence.assertion.expected;
  requireEvidence(open ? expected?.open === true : expected?.hidden === true,
    'The versioned case is missing its committed owner fact');
  const openRevision = p.before.openRevision + (open ? 1 : 0);
  const closeRevision = p.before.closeRevision + (open ? 0 : 1);
  const reason = [];
  if (p.origin !== (open ? `${data.ready.payload.mode}-tap` : 'system-back')) reason.push('unexpected owner origin');
  if (p.before.level !== level.from || p.before.targetLevel !== level.from || p.before.transition !== '' ||
    p.before.heldPointerId >= 0) reason.push('unstable pre-action state');
  if (p.accepted.targetLevel !== level.to || p.accepted.transition !== direction ||
    p.accepted.epoch <= p.before.epoch || p.accepted.openRevision !== openRevision ||
    p.accepted.closeRevision !== p.before.closeRevision) reason.push('unexpected accepted transition');
  if (committed.level !== level.to || committed.targetLevel !== level.to || committed.transition !== '' ||
    committed.heldPointerId >= 0 || committed.openRevision !== openRevision || committed.closeRevision !== closeRevision) {
    reason.push('unexpected committed endpoint');
  }
  // The business fact is independent of completeness of optional geometry
  // fields, but it should cite any admitted blocks belonging to its transition.
  const blocks = evidence.event('reading.control-motion', 'motion', data.action.instanceId, event =>
    event.eventSeq > data.commit.eventSeq && event.eventSeq <= data.last.beforeSeq &&
    event.payload.transitionId === p.transitionId && event.payload.readingId === p.readingId &&
    event.payload.direction === p.direction && event.payload.epoch === p.accepted.epoch);
  const actual = {
    fact: 'reader.control-open', open: committed.level === 'home' && committed.transition === '' && committed.heldPointerId < 0,
    hidden: committed.level === 'hidden' && committed.transition === '' && committed.heldPointerId < 0,
    readingId: p.readingId, transitionId: p.transitionId, actionId: data.action.actionId,
    origin: p.origin, ...(open ? { hitPointPx: data.point, hitTarget: data.action.targetId } : {}),
    requestedSeq: data.request.eventSeq, committedSeq: data.commit.eventSeq, motionEventSeqs: blocks.map(event => event.eventSeq),
    before: p.before, accepted: p.accepted, committed, sourceRefs,
  };
  return { actual, expected, verdict: reason.length > 0 ? 'FAIL' : 'PASS',
    reason: reason.length > 0 ? reason.join(', ') : null };
}

// ArkUI cubicBezierCurve(.2, 0, 0, 1) uses the x coordinate as elapsed
// fraction. Invert the monotone x cubic before evaluating the y coordinate.
function easedFraction(fraction) {
  let from = 0, to = 1;
  for (let index = 0; index < 20; index++) {
    const t = (from + to) / 2;
    const x = 0.6 * t * (1 - t) ** 2 + t ** 3;
    if (x < fraction) from = t;
    else to = t;
  }
  const t = (from + to) / 2;
  return fraction === 0 ? 0 : fraction === 1 ? 1 : (3 - 2 * t) * t * t;
}

function motionResult(evidence, direction, data) {
  const expected = evidence.assertion.expected;
  requireEvidence(present(expected, ['durationMs', 'dockTravelVp', 'layoutToleranceVp',
    'opacityTolerance', 'transformTolerance', 'cadenceGapFactor']) && expected.durationMs > 0 &&
    expected.dockTravelVp > 0 && expected.layoutToleranceVp >= 0 && expected.opacityTolerance >= 0 &&
    expected.transformTolerance >= 0 && expected.cadenceGapFactor >= 1 &&
    Array.isArray(expected.actors) && expected.actors.length === Object.values(ACTORS).length &&
    Object.values(ACTORS).every(id => expected.actors.includes(id)),
  'The versioned motion expectation lacks a sourced duration, tolerance, or cadence rule');
  const sourceRefs = evidence.ownerSources(MOTION_INPUTS);
  const { frames, events, segments } = evidence.trace(data);
  const p = data.request.payload;
  const failures = new Map(), missing = new Map();
  const checks = {};
  const sessionActorIds = new Map();
  const baselineActors = new Map();
  const firstMount = {};
  const lastActor = new Map();
  const segmentStarts = new Map(segments.map(segment => [segment.start, segment]));
  const segmentDiagnostics = [];
  const ticketBoundaries = [];
  const targetVisibility = direction === 'open' ? 1 : 0;
  let segment, segmentDiagnostic;

  function check(actor, field, frame, actual, want, result) {
    const label = `${actor}.${field}`;
    checks[label] ??= { observed: 0, missing: 0, failed: 0 };
    const entry = checks[label];
    if (result == null) {
      entry.missing += 1;
      if (!missing.has(label)) missing.set(label, { actor, field, frame, actual, expected: want });
    } else {
      entry.observed += 1;
      if (entry.first === undefined) entry.first = { frame, actual, expected: want };
      entry.last = { frame, actual, expected: want };
      if (!result) {
        entry.failed += 1;
        if (!failures.has(label)) failures.set(label, { actor, field, frame, actual, expected: want });
      }
    }
  }

  check('runtime', 'commandDurationMs', 0, p.durationMs, expected.durationMs, p.durationMs === expected.durationMs);
  check('runtime', 'durationMs', 0, segments[0].durationMs, expected.durationMs,
    segments[0].durationMs === expected.durationMs);
  check('runtime', 'startVisibility', 0, frames[0].visibilityProgress, 1 - targetVisibility,
    near(frames[0].visibilityProgress, 1 - targetVisibility, expected.opacityTolerance));
  for (const frame of frames) {
    const i = frame.index;
    const v = frame.visibilityProgress;
    const nextSegment = segmentStarts.get(i);
    if (nextSegment) {
      segment = nextSegment;
      baselineActors.clear();
      lastActor.clear();
      segmentDiagnostic = {
        ticket: segment.ticket, firstFrame: i, lastFrame: segment.end, durationMs: segment.durationMs,
        lastElapsedMs: frames[segment.end].runtimeElapsedMs,
        startVisibility: v, targetVisibility, comparedFrames: 0, maxVisibilityError: null,
      };
      segmentDiagnostics.push(segmentDiagnostic);
    } else {
      const fraction = Math.min(1, frame.runtimeElapsedMs / segment.durationMs);
      const startVisibility = segment.start === 0 ? 1 - targetVisibility : segmentDiagnostic.startVisibility;
      const predicted = startVisibility + (targetVisibility - startVisibility) * easedFraction(fraction);
      const error = Math.abs(v - predicted);
      segmentDiagnostic.comparedFrames += 1;
      segmentDiagnostic.maxVisibilityError = Math.max(segmentDiagnostic.maxVisibilityError ?? 0, error);
      check('runtime', 'normalizedCurve', i, v, predicted, error <= expected.opacityTolerance);
    }
    check('runtime', 'expansionProgress', i, frame.expansionProgress, 0,
      near(frame.expansionProgress, 0, expected.transformTolerance));
    const content = frame.content;
    const retainedHome = { level: 'home', module: 'directory', directoryTab: 'directory', form: 'quick' };
    check('content', 'retainedRoute', i, content ?? null, retainedHome,
      content ? Object.entries(retainedHome).every(([field, value]) => content[field] === value) : null);

    const actorArray = Array.isArray(frame.actors) ? frame.actors : [];
    const selected = Object.fromEntries(Object.entries(ACTORS).map(([role, id]) => {
      const matches = actorArray.filter(actor => actor?.id === id);
      return [role, matches.length === 1 ? matches[0] : null];
    }));
    if (nextSegment && i > 0) {
      const previous = frames[i - 1];
      const previousActors = Array.isArray(previous.actors) ? previous.actors : [];
      const previousGrabbers = previousActors.filter(actor => actor?.id === ACTORS.grabber && actor.mounted === true);
      const previousGrabber = previousGrabbers.length === 1 ? previousGrabbers[0] : null;
      const grabber = selected.grabber;
      const boundary = {
        frame: i, fromTicket: previous.runtimeTicket, toTicket: frame.runtimeTicket,
        visibilityBefore: previous.visibilityProgress, visibilityAfter: v,
        layoutOffsetBeforeVp: previous.runtimeLayoutOffsetVp, layoutOffsetAfterVp: frame.runtimeLayoutOffsetVp,
        grabberWindowDeltaYVp: present(previousGrabber?.windowOriginVp, ['y']) &&
          grabber?.mounted === true && present(grabber.windowOriginVp, ['y']) ?
          grabber.windowOriginVp.y - previousGrabber.windowOriginVp.y : null,
      };
      ticketBoundaries.push(boundary);
      // Geometry before and after the boundary does not establish the state
      // and measured axes that the runtime used to project its prior anchor.
      check('runtime', 'rebaseCause', i, boundary, 'owner rebase cause, input axes and transition state', null);
    }
    check('runtime', 'actorSet', i, actorArray.map(actor => actor?.id ?? null), Object.values(ACTORS),
      actorArray.length === Object.values(ACTORS).length && Object.values(selected).every(Boolean) ? true : null);
    const y = expected.dockTravelVp * (1 - v);
    const ancestors = { dock: selected.dock, clip: frame.contentClip?.id === CONTENT_CLIP ? frame.contentClip : null };
    const firstAllowed = direction === 'open' && v === 0 && i === 0;
    for (const [role, actor] of Object.entries(selected)) {
      if (firstAllowed && actor && actor.mounted === false) continue;
      if (!actor || actor.mounted !== true || !sequence(actor.uniqueId) || !box(actor.layoutRectVp)) {
        check(role, 'mountedLayout', i, actor ?? null, 'one attached, laid-out native node', null);
        continue;
      }
      firstMount[role] ??= i;
      if (!sessionActorIds.has(role)) sessionActorIds.set(role, actor.uniqueId);
      const baseline = baselineActors.get(role) ?? { actor, layoutOffsetVp: frame.runtimeLayoutOffsetVp };
      baselineActors.set(role, baseline);
      check(role, 'uniqueId', i, actor.uniqueId, sessionActorIds.get(role), actor.uniqueId === sessionActorIds.get(role));
      const rect = actor.layoutRectVp;
      const baselineRect = baseline.actor.layoutRectVp;
      const position = actor.windowOriginVp;
      const output = [rect.width, rect.height];
      const stableSize = role === 'grabber' ? [72, 28] : [baselineRect.width, baselineRect.height];
      check(role, 'layoutSizeVp', i, output, stableSize, comparable(output, expected.layoutToleranceVp, stableSize));
      const dockBox = ancestors.dock?.layoutRectVp;
      const initialDockBox = baselineActors.get('dock')?.actor.layoutRectVp ?? dockBox;
      const actualOffset = box(dockBox) ? [rect.x - dockBox.x, rect.y - dockBox.y] : null;
      const initialOffset = box(initialDockBox) ?
        [baselineRect.x - initialDockBox.x,
          baselineRect.y - initialDockBox.y + frame.runtimeLayoutOffsetVp - baseline.layoutOffsetVp] : null;
      if (role !== 'dock') {
        check(role, 'layoutRelativeToDockVp', i, actualOffset, initialOffset,
          actualOffset && initialOffset ? comparable(actualOffset, expected.layoutToleranceVp, initialOffset) : null);
      }
      const translation = actor.translateVp;
      const intended = [0, role === 'dock' ? y : 0, 0];
      check(role, 'translateVp', i, translation ?? null, intended,
        present(translation, ['x', 'y', 'z']) ? comparable([translation.x, translation.y, translation.z],
          expected.layoutToleranceVp, intended) : null);
      const previous = lastActor.get(role);
      if (role === 'dock' && present(previous?.translateVp, ['y']) && present(translation, ['y'])) {
        const distance = translation.y - previous.translateVp.y;
        check(role, 'directionalPathVp', i, distance, direction === 'open' ? 'nonincreasing' : 'nondecreasing',
          direction === 'open' ? distance <= expected.layoutToleranceVp : distance >= -expected.layoutToleranceVp);
      }
      const scale = actor.scale;
      check(role, 'scale', i, scale ?? null, [1, 1, 1], present(scale, ['x', 'y', 'z', 'centerX', 'centerY']) ?
        comparable([scale.x, scale.y, scale.z], expected.transformTolerance, [1, 1, 1]) : null);
      const rotation = actor.rotation;
      check(role, 'rotation', i, rotation ?? null, { angle: 0 }, present(rotation, ['x', 'y', 'z', 'angle', 'centerX', 'centerY']) ?
        near(rotation.angle, 0, expected.transformTolerance) : null);
      const matrix = actor.matrix;
      check(role, 'matrix', i, matrix ?? null, IDENTITY_MATRIX,
        Array.isArray(matrix) && matrix.length === 16 && matrix.every(finite) ?
          comparable(matrix, expected.transformTolerance, IDENTITY_MATRIX) : null);
      const opacity = role === 'dock' ? v : 1;
      check(role, 'opacity', i, actor.opacity ?? null, opacity, finite(actor.opacity) ?
        near(actor.opacity, opacity, expected.opacityTolerance) : null);

      const chain = Array.isArray(actor.ancestors) ? actor.ancestors : [];
      const chainReadable = actor.ancestorChainComplete === true && chain.length > 0 &&
        chain[0].uniqueId === actor.parentUniqueId &&
        chain.every((entry, index) => sequence(entry.uniqueId) &&
          (index === chain.length - 1 ? entry.parentUniqueId === undefined : entry.parentUniqueId === chain[index + 1].uniqueId));
      const dockParent = role === 'dock' || chain.some(ancestor => ancestor.uniqueId === ancestors.dock?.uniqueId);
      check(role, 'ancestorContext', i, chain.map(item => item.uniqueId), 'complete chain through the dock',
        chainReadable ? dockParent : null);
      const expectedPosition = [rect.x, rect.y + y];
      check(role, 'transformedWindowOriginVp', i, position ?? null, expectedPosition,
        present(position, ['x', 'y']) && chainReadable && dockParent ?
          comparable([position.x, position.y], expected.layoutToleranceVp, expectedPosition) : null);
      if (role === 'dock') {
        // The dock's layout anchor stays fixed within a ticket. Its visibility
        // translation moves the entire group.
        const anchoredPosition = [baselineRect.x, baselineRect.y + y];
        check(role, 'anchoredWindowPathVp', i, position ?? null, anchoredPosition,
          present(position, ['x', 'y']) && chainReadable ?
            comparable([position.x, position.y], expected.layoutToleranceVp, anchoredPosition) : null);
      }
      const clipAncestor = chain.find(item => item.uniqueId === ancestors.clip?.uniqueId);
      const clipEvidence = { self: actor.clipToFrame ?? null,
        ancestorClipIds: chain.filter(item => item.clipToFrame === true).map(item => item.uniqueId),
        contentClip: clipAncestor?.borderRadiusVp ?? null };
      const selfClip = false;
      const clipObserved = typeof actor.clipToFrame === 'boolean' && chainReadable &&
        chain.every(item => typeof item.clipToFrame === 'boolean' &&
          (!item.clipToFrame || box(item.measuredSizeVp)));
      const expectedRadius = expected.contentCornerVp ?? 8;
      const knownClip = role !== 'content' || (clipAncestor && finite(clipAncestor.borderRadiusVp));
      check(role, 'clipConfiguration', i, clipEvidence,
        { self: selfClip, ...(role === 'content' ? { contentClip: expectedRadius } : {}) },
        clipObserved && knownClip ? actor.clipToFrame === selfClip &&
          (role !== 'content' || clipAncestor.clipToFrame === true &&
          near(clipAncestor.borderRadiusVp, expectedRadius, expected.layoutToleranceVp)) : null);
      const z = role === 'grabber' ? 3 : 0;
      const stackingContext = role === 'dock' ? chainReadable :
        role === 'content' ? dockParent && Boolean(clipAncestor) : actor.parentUniqueId === ancestors.dock?.uniqueId;
      check(role, 'stackingContext', i,
        { zIndex: actor.zIndex ?? null, parentUniqueId: actor.parentUniqueId ?? null, relativeToDock: stackingContext },
        { zIndex: z, relativeToDock: true },
        actor.inspectorSource === 'FrameNode.getInspectorInfo' && finite(actor.zIndex) && chainReadable ?
          actor.zIndex === z && stackingContext : null);
      lastActor.set(role, actor);
    }
  }

  const gaps = frames.slice(1).map((frame, index) => (frame.frameTimeNs - frames[index].frameTimeNs) / 1e6);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)];
  for (const [index, gap] of gaps.entries()) {
    const limit = medianGap * expected.cadenceGapFactor;
    // Coverage rule for the sampled callback, without claiming a physical
    // display refresh rate or inferring compositor-dropped frames.
    check('runtime', 'sampleGapMs', index + 1, gap, limit, gap <= limit ? true : null);
  }
  const captureMs = frames.map(frame => frame.captureEndMs - frame.captureStartMs);
  const actual = {
    direction, actionId: data.action.actionId, transitionId: p.transitionId, readingId: p.readingId,
    frameCount: frames.length, firstMount, windowUnit: 'vp', affineMatrixOrder: 'column-first',
    sampleClock: 'FrameCallback nanoseconds', displayedRefreshSource: null,
    elapsedMs: segments.length === 1 ? frames.at(-1).runtimeElapsedMs : null,
    callbackSpanMs: gaps.reduce((sum, gap) => sum + gap, 0),
    runtimeSegments: segmentDiagnostics, ticketBoundaries,
    sampleCadenceMs: { median: medianGap, max: Math.max(...gaps) },
    acquisitionMs: { total: captureMs.reduce((sum, ms) => sum + ms, 0), max: Math.max(...captureMs) },
    motionEventSeqs: events.map(event => event.eventSeq), sourceRefs, checks,
    missing: [...missing.values()], deviations: [...failures.values()],
  };
  const unusableCadence = missing.has('runtime.sampleGapMs');
  const unverifiedBoundary = missing.get('runtime.rebaseCause');
  const verdict = unusableCadence || unverifiedBoundary ? 'NOT_RUN' : failures.size ? 'FAIL' : missing.size ? 'NOT_RUN' : 'PASS';
  const first = verdict === 'FAIL' ? failures.values().next().value : unverifiedBoundary ?? missing.values().next().value;
  return { actual, expected, verdict, observationsComplete: missing.size === 0,
    reason: first ? `${first.actor}.${first.field} at frame ${first.frame}: ${verdict === 'FAIL' ? 'observed deviation' : 'missing comparable evidence'}` : null };
}

export function evaluateMotion(assertion, context) {
  const evidence = new MotionEvidence(context, assertion);
  try {
    const kinds = ['control-open', 'control-dismiss', 'motion-open', 'motion-dismiss'];
    requireEvidence(kinds.includes(assertion.kind), 'Unknown reading motion assertion kind');
    const direction = assertion.kind.endsWith('-open') ? 'open' : 'dismiss';
    const data = evidence.pair(direction);
    const result = assertion.kind.startsWith('control-') ? ownerResult(evidence, direction, data) :
      motionResult(evidence, direction, data);
    return { ...result, evidenceRefs: [...evidence.refs.values()] };
  } catch (error) {
    if (!(error instanceof MissingMotionEvidence)) throw error;
    return { actual: null, expected: assertion.expected, verdict: 'NOT_RUN',
      reason: error.message, evidenceRefs: [...evidence.refs.values()] };
  }
}
