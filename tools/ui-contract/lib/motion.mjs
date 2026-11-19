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
  [OWNER + 'LocalReadingExperience.ets']: [...OWNER_INPUTS[OWNER + 'LocalReadingExperience.ets'], 'build', 'controlLayout'],
  [OWNER + 'ReaderControlSessionState.ts']: [...OWNER_INPUTS[OWNER + 'ReaderControlSessionState.ts'],
    'advanceReaderControlSession', 'rebaseReaderControlTransitionProgress'],
  [OWNER + 'ReaderControlPanel.ets']: ['configureRuntime', 'runtimeConfig', 'presentedDockTop', 'scheduleRuntimeFrame',
    'clockSample', 'dockLeft', 'build', 'controlContent'],
  [OWNER + 'ReaderControlRuntime.ts']: ['configure', 'frame', 'invalidate', 'rebaseSample'],
  [OWNER + 'ReaderControlGestureDriver.ts']: ['readerControlGrabberScreenY'],
  [OWNER + 'ReaderControlLayoutRebase.ts']: ['rebaseReaderControlLayout', 'advanceReaderControlLayoutCompensation'],
  [OWNER + 'ReaderControlSpatialPath.ts']: ['readerControlSpatialY', 'projectReaderControlSpatialPath'],
  [OWNER + 'ReaderControlMotionGeometry.ts']: ['sampleReaderControlWholeVisibility', 'sampleReaderControlMotionComposition',
    'readerControlMotionAxis', 'ReaderControlMotionFrameCache', 'READER_CONTROL_MOTION_GRABBER_TOP',
    'READER_CONTROL_MOTION_CONTENT_TOP_QUICK', 'READER_CONTROL_MOTION_CONTENT_INSET_MAX'],
  [OWNER + 'ReaderControlMotionPolicy.ts']: ['readerControlMotionCommandTiming'],
  [OWNER + 'ReaderControlVerificationMotion.ets']: ['recordActor', 'ReaderControlVerificationMotion'],
  [OWNER + 'ReaderControlVerificationSession.ts']: [...OWNER_INPUTS[OWNER + 'ReaderControlVerificationSession.ts'],
    'observeLayoutRebase'],
  [TIMING]: ['READER_CONTROL_OPEN_MS', 'READER_CONTROL_DISMISS_MS'],
};
const ACTORS = {
  shell: 'reader-control-motion-shell',
  grabber: 'reader-control-motion-grabber',
  dock: 'reader-control-motion-dock',
  content: 'reader-control-content-host',
};
const CONTENT_CLIP = 'reader-control-motion-content-clip';
const READING_STAGE = 'reader-reading-stage';
// ReaderControlMotionGeometry positions the painted bar below the native
// grabber carrier's top. The runtime axis describes the painted bar.
const GRABBER_TOP_VP = 9;
const GRABBER_CARRIER_WIDTH_VP = 72;
const CONTENT_QUICK_TOP_VP = 29;
const CONTENT_MAX_INSET_VP = 13;
// ReaderLayoutGeometry selects the viewport width class and expanded right gap.
const EXPANDED_VIEWPORT_MIN_VP = 600;
const EXPANDED_RIGHT_GAP_VP = 14;
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
    const rebases = this.event('reading.control-rebased', 'motion', data.action.instanceId,
      event => event.eventSeq > data.request.eventSeq && event.eventSeq < data.commit.eventSeq &&
        event.payload.transitionId === p.transitionId && event.payload.readingId === p.readingId &&
        event.payload.direction === p.direction && event.payload.epoch === p.accepted.epoch);
    return { frames, events, segments, rebases };
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

const axisKeys = ['quickGrabberScreenY', 'fullGrabberScreenY', 'hiddenGrabberScreenY'];
const visualKeys = ['expansionProgress', 'visibilityProgress'];
const transitionKeys = ['progress', 'startProgress', 'targetProgress', 'elapsedMs', 'durationMs'];
const compensationKeys = ['offsetY', 'startOffsetY', 'elapsedMs', 'durationMs', 'revision'];
const unit = value => Math.max(0, Math.min(1, value));
const sameFields = (a, b, keys) => keys.every(key => a[key] === b[key]);
const motionFraction = (elapsed, duration) => easedFraction(duration > 0 ? unit(elapsed / duration) : 1);

function completeRebaseSample(sample) {
  return present(sample?.axis, axisKeys) && present(sample.transition, transitionKeys) &&
    typeof sample.transition.kind === 'string' && present(sample.transition.from, visualKeys) &&
    present(sample.transition.to, visualKeys) && present(sample.compensation, compensationKeys) &&
    typeof sample.compensation.running === 'boolean' && finite(sample.compensatedGrabberScreenY);
}

function rebaseChain(rebases, fromTicket, frame, previous, data) {
  const toTicket = frame.runtimeTicket;
  const candidates = rebases.filter(event => event.payload.fromTicket >= fromTicket && event.payload.fromTicket < toTicket);
  const beginMs = previous?.captureEndMs ?? data.request.deviceMonoMs;
  if (candidates.length !== toTicket - fromTicket || !candidates.every((event, index) => {
    const p = event.payload;
    return event.windowRevision === data.request.windowRevision && p.source === 'ReaderControlRuntime.configure' &&
      p.fromTicket === fromTicket + index && p.toTicket === p.fromTicket + 1 &&
      finite(event.deviceMonoMs) && event.deviceMonoMs >= beginMs && event.deviceMonoMs <= frame.runtimeTickMs &&
      (!index || (event.eventSeq > candidates[index - 1].eventSeq && event.deviceMonoMs >= candidates[index - 1].deviceMonoMs)) &&
      present(p, ['beforeTickMs', 'ticketStartTickMs']) &&
      typeof p.rebaseReason === 'string' && typeof p.anchorPreserved === 'boolean' &&
      completeRebaseSample(p.before) && completeRebaseSample(p.after);
  })) return null;
  return candidates;
}

function visualAt(transition, progress) {
  return {
    expansionProgress: transition.from.expansionProgress +
      (transition.to.expansionProgress - transition.from.expansionProgress) * progress,
    visibilityProgress: transition.from.visibilityProgress +
      (transition.to.visibilityProgress - transition.from.visibilityProgress) * progress,
  };
}

function grabberY(axis, visual) {
  return axis.quickGrabberScreenY + (axis.fullGrabberScreenY - axis.quickGrabberScreenY) * visual.expansionProgress +
    (axis.hiddenGrabberScreenY - axis.quickGrabberScreenY) * (1 - visual.visibilityProgress);
}

function rebaseProjection(before, axis) {
  const transition = before.transition;
  const anchor = grabberY(before.axis, visualAt(transition, transition.progress)) + before.compensation.offsetY;
  const fromY = grabberY(axis, transition.from);
  const toY = grabberY(axis, transition.to);
  const travel = toY - fromY;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(fromY), Math.abs(toY), Math.abs(anchor)) * 16;
  const spatiallyStatic = Math.abs(travel) <= epsilon;
  const currentY = grabberY(axis, visualAt(transition, transition.progress));
  const projected = (anchor - fromY) / travel;
  const reachableRoot = finite(projected) &&
    projected >= -Number.EPSILON * 64 && projected <= 1 + Number.EPSILON * 64;
  const alreadyAtAnchor = Math.abs(currentY - anchor) <= epsilon;
  const progress = !alreadyAtAnchor && !spatiallyStatic && reachableRoot ? unit(projected) : transition.progress;
  const reason = spatiallyStatic ? 'compensated-static-segment' :
    alreadyAtAnchor || reachableRoot ? 'projected' : 'compensated-outside-segment';
  const offsetY = anchor - grabberY(axis, visualAt(transition, progress));
  const durationMs = Math.max(0, transition.durationMs - transition.elapsedMs);
  const running = offsetY !== 0 && durationMs > 0;
  return { reason, progress, anchor, durationMs, compensation: {
    offsetY, startOffsetY: offsetY, elapsedMs: 0, durationMs: running ? durationMs : 0, running,
    revision: before.compensation.revision + (running ? 2 : 1),
  } };
}

function compensationAt(compensation, elapsedMs) {
  return compensation.running ?
    compensation.startOffsetY * (1 - motionFraction(elapsedMs, compensation.durationMs)) : compensation.offsetY;
}

function progressAt(transition, elapsedMs) {
  return transition.startProgress + (transition.targetProgress - transition.startProgress) *
    motionFraction(elapsedMs, transition.durationMs);
}

function actorsByRole(actorArray) {
  return Object.fromEntries(Object.entries(ACTORS).map(([role, id]) => {
    const matches = actorArray.filter(actor => actor?.id === id);
    return [role, matches.length === 1 ? matches[0] : null];
  }));
}

function boundaryCompensationVp(snapshot, frame, side) {
  const comp = snapshot.compensation;
  if (side === 'after') return compensationAt(comp, frame.runtimeElapsedMs);
  if (comp.durationMs === 0) return comp.offsetY;
  // The before-event snapshot follows the preceding frame's runtime update.
  // Rewind that update to the frame's pre-publication observation. A stopped
  // compensation has no subsequent clock, so it only proves zero here when
  // the rewind is still past its settlement time.
  const advancedMs = snapshot.transition.elapsedMs - frame.runtimeElapsedMs;
  const sampleElapsedMs = comp.elapsedMs - advancedMs;
  if (advancedMs < 0 || sampleElapsedMs < 0 || (!comp.running && sampleElapsedMs < comp.durationMs)) return null;
  return comp.startOffsetY * (1 - motionFraction(sampleElapsedMs, comp.durationMs));
}

function boundaryViewport(data) {
  const measure = sample => {
    const { rectPx: window, density, contentSafeHorizontalVp } = sample.window;
    let stage;
    try {
      stage = selectLayoutNode(sample, READING_STAGE).rectPx;
    } catch {
      return null;
    }
    if (!present(window, ['left', 'width']) || !present(stage, ['left', 'width']) ||
      !finite(density) || density <= 0 || stage.width <= 0 || stage.left < window.left ||
      stage.left + stage.width > window.left + window.width) return null;
    return { originXVp: (stage.left - window.left) / density, widthVp: stage.width / density, density,
      windowLeftPx: window.left, windowWidthPx: window.width, contentSafeHorizontalVp };
  };
  const first = measure(data.first);
  const last = measure(data.last);
  if (!first || !last || !sameFields(first, last, ['originXVp', 'widthVp', 'density', 'windowLeftPx', 'windowWidthPx'])) return null;
  if (first.widthVp < EXPANDED_VIEWPORT_MIN_VP) return { ...first, branch: 'compact' };
  if (!finite(first.contentSafeHorizontalVp) || first.contentSafeHorizontalVp < 0 ||
    first.contentSafeHorizontalVp !== last.contentSafeHorizontalVp) return null;
  return { ...first, branch: 'expanded', rightGapVp: Math.max(EXPANDED_RIGHT_GAP_VP, first.contentSafeHorizontalVp) };
}

function checkBoundaryActors(check, frame, actors, viewport, snapshot, side, event, expected, direction) {
  if (!frame) return;
  const width = actors.dock?.layoutRectVp?.width;
  const xOffsets = { dock: 0, shell: 0, grabber: (width - GRABBER_CARRIER_WIDTH_VP) / 2,
    content: Math.min(CONTENT_MAX_INSET_VP, width / 4), contentClip: Math.min(CONTENT_MAX_INSET_VP, width / 4) };
  let dockX = null;
  if (viewport && frame.density === viewport.density && finite(width) && width > 0 && width <= viewport.widthVp) {
    const remainingWidth = viewport.widthVp - width;
    dockX = viewport.originXVp + (viewport.branch === 'compact' ? remainingWidth / 2 : remainingWidth - viewport.rightGapVp);
  }
  let dockY = null;
  let shellY = null;
  let travelVp = null;
  if (snapshot) {
    const transition = snapshot.transition;
    const layoutOffsetVp = boundaryCompensationVp(snapshot, frame, side);
    const visual = visualAt(transition, progressAt(transition, frame.runtimeElapsedMs));
    travelVp = expected.dockTravelVp * (1 - visual.visibilityProgress);
    // ArkUI Area.globalPosition (used by runtimeConfig) and both FrameNode/
    // ComponentUtils reads use the current window's coordinate system.
    dockY = snapshot.axis.fullGrabberScreenY - GRABBER_TOP_VP;
    if (layoutOffsetVp !== null) shellY = grabberY(snapshot.axis, visual) - GRABBER_TOP_VP + layoutOffsetVp - travelVp;
  }
  const contentY = shellY === null ? null : shellY + CONTENT_QUICK_TOP_VP;
  const yPositions = { dock: dockY, shell: shellY, grabber: shellY, content: contentY, contentClip: contentY };
  const clip = frame.contentClip?.id === CONTENT_CLIP ? frame.contentClip : null;
  const dockId = actors.dock?.mounted === true && sequence(actors.dock.uniqueId) ? actors.dock.uniqueId : null;
  const clipInDock = dockId !== null && clip?.mounted === true && sequence(clip.uniqueId) && clip.parentUniqueId === dockId;
  for (const [role, actor] of Object.entries({ ...actors, contentClip: clip })) {
    if (direction === 'open' && frame.index === 0 && frame.visibilityProgress === 0 && actor?.mounted === false) continue;
    // ArkUI may expose an intermediate Stack between the content host and the clip.
    const ancestors = Array.isArray(actor?.ancestors) ? actor.ancestors : [];
    const related = role === 'dock' ||
      (role === 'content' ? clipInDock && ancestors.some(node => node.uniqueId === clip.uniqueId && node.parentUniqueId === dockId) :
        dockId !== null && actor?.parentUniqueId === dockId);
    const usable = related && actor?.mounted === true && sequence(actor.uniqueId) && actor.ancestorChainComplete === true;
    const x = dockX === null ? null : dockX + xOffsets[role];
    const y = yPositions[role];
    const metadata = { side, runtimeTicket: frame.runtimeTicket, runtimeElapsedMs: frame.runtimeElapsedMs,
      rebaseEventSeq: event?.eventSeq ?? null };
    for (const [axis, field, layoutVp, windowVp] of [
      ['x', 'rebaseWindowAnchorXVp', x, x],
      ['y', 'rebaseWindowAnchorVp', y, y === null ? null : y + travelVp],
    ]) {
      const measured = { layoutVp: actor?.layoutRectVp?.[axis] ?? null, windowVp: actor?.windowOriginVp?.[axis] ?? null };
      const target = { layoutVp, windowVp, ...metadata, ...(axis === 'x' ? { viewport, dockWidthVp: width ?? null } : {}) };
      const readings = usable && finite(layoutVp) ?
        [[measured.layoutVp, layoutVp], [measured.windowVp, windowVp]].filter(([value]) => finite(value)) : [];
      const failed = readings.some(([value, targetVp]) => !near(value, targetVp, expected.layoutToleranceVp));
      if (readings.length < 2) check(role, field, frame.index, measured, target, null);
      if (failed || readings.length === 2) check(role, field, frame.index, measured, target, !failed);
    }
  }
}

function checkRebase(check, event, frame, priorFrame, priorTick, incoming, initialTicket, data, expected) {
  const p = event.payload;
  const { before, after } = p;
  const old = before.transition;
  const next = after.transition;
  const direction = data.request.payload.direction;
  const target = direction === 'open' ? 1 : 0;
  const model = rebaseProjection(before, after.axis);
  const sourceAxis = axis => axis.fullGrabberScreenY <= axis.quickGrabberScreenY &&
    near(axis.hiddenGrabberScreenY - axis.quickGrabberScreenY, expected.dockTravelVp, expected.transformTolerance);
  const initial = p.fromTicket === initialTicket;
  const previous = incoming?.payload.after;
  const p0 = previous?.transition.startProgress ?? (initial ? 0 : old.startProgress);
  const oldExpected = { ...old, startProgress: p0 };
  const oldProgress = progressAt(oldExpected, old.elapsedMs);
  const offsetBefore = previous ? compensationAt(previous.compensation, old.elapsedMs) :
    before.compensation.durationMs === 0 ? before.compensation.startOffsetY :
      before.compensation.startOffsetY * (1 - motionFraction(before.compensation.elapsedMs, before.compensation.durationMs));
  const intermediate = !priorFrame;
  const oldTick = intermediate ? incoming?.payload.ticketStartTickMs : priorFrame.runtimeTickMs;
  const oldElapsed = intermediate ? 0 : priorTick !== undefined ?
    priorFrame.runtimeElapsedMs + priorFrame.runtimeTickMs - priorTick : undefined;
  const clock = p.beforeTickMs >= data.request.deviceMonoMs && p.ticketStartTickMs >= p.beforeTickMs &&
    event.deviceMonoMs >= p.ticketStartTickMs && (oldTick === undefined || p.beforeTickMs === oldTick) &&
    (oldElapsed === undefined ? old.elapsedMs <= p.beforeTickMs - data.request.deviceMonoMs : old.elapsedMs === oldElapsed);
  check('runtime', 'rebaseClock', frame.index,
    { beforeTickMs: p.beforeTickMs, elapsedMs: old.elapsedMs, ticketStartTickMs: p.ticketStartTickMs },
    { beforeTickMs: oldTick ?? null, elapsedMs: oldElapsed ?? null, eventDeviceMonoMs: event.deviceMonoMs }, clock);
  const validInput = sourceAxis(before.axis) && sourceAxis(after.axis) && !sameFields(before.axis, after.axis, axisKeys) &&
    old.kind === direction && old.targetProgress === 1 && old.from.visibilityProgress === 1 - target &&
    old.to.visibilityProgress === target && old.from.expansionProgress === 0 && old.to.expansionProgress === 0 &&
    old.startProgress === p0 && old.startProgress >= 0 && old.startProgress <= 1 &&
    old.progress >= 0 && old.progress < 1 && old.elapsedMs >= 0 && old.elapsedMs < old.durationMs &&
    near(old.progress, oldProgress, expected.opacityTolerance) &&
    (!priorFrame || (old.durationMs === priorFrame.runtimeDurationMs &&
      near(priorFrame.visibilityProgress, visualAt(oldExpected, progressAt(oldExpected, priorFrame.runtimeElapsedMs)).visibilityProgress,
        expected.opacityTolerance)));
  const samePrevious = !previous || sameFields(before.axis, previous.axis, axisKeys) &&
    old.durationMs === previous.transition.durationMs &&
    before.compensation.startOffsetY === previous.compensation.startOffsetY &&
    before.compensation.durationMs === previous.compensation.durationMs &&
    before.compensation.revision === previous.compensation.revision &&
    before.compensation.running === previous.compensation.running &&
    before.compensation.elapsedMs === (previous.compensation.running ? old.elapsedMs : 0);
  const comp = before.compensation;
  const validCompensation = sequence(comp.revision) && comp.elapsedMs >= 0 && comp.durationMs >= 0 &&
    comp.running === (comp.durationMs > 0 && comp.elapsedMs < comp.durationMs) &&
    near(comp.offsetY, offsetBefore, expected.layoutToleranceVp);
  check('runtime', 'rebaseInputs', frame.index, { axis: before.axis, ...old, compensation: comp },
    { progress: oldProgress, offsetY: offsetBefore, startProgress: p0 }, validInput && samePrevious && validCompensation);
  const actual = { reason: p.rebaseReason, anchorPreserved: p.anchorPreserved,
    beforeAnchorVp: before.compensatedGrabberScreenY, afterAnchorVp: after.compensatedGrabberScreenY,
    progress: next.progress, startProgress: next.startProgress, elapsedMs: next.elapsedMs, durationMs: next.durationMs,
    compensation: after.compensation };
  const predicted = { reason: model.reason, anchorPreserved: true, beforeAnchorVp: model.anchor, afterAnchorVp: model.anchor,
    progress: model.progress, startProgress: model.progress, elapsedMs: 0, durationMs: model.durationMs,
    compensation: model.compensation };
  const numericalTolerance = Number.EPSILON * Math.max(1, Math.abs(model.anchor)) * 64;
  const projectionMatches = p.rebaseReason === model.reason && p.anchorPreserved === true &&
    next.kind === old.kind && next.targetProgress === old.targetProgress &&
    sameFields(next.from, old.from, visualKeys) && sameFields(next.to, old.to, visualKeys) &&
    near(next.progress, model.progress, numericalTolerance) && next.startProgress === next.progress &&
    next.elapsedMs === 0 && next.durationMs === model.durationMs &&
    near(before.compensatedGrabberScreenY, model.anchor, numericalTolerance) &&
    near(after.compensatedGrabberScreenY, model.anchor, numericalTolerance) &&
    after.compensation.running === model.compensation.running &&
    sameFields(after.compensation, model.compensation, ['elapsedMs', 'durationMs', 'revision']) &&
    ['offsetY', 'startOffsetY'].every(key => near(after.compensation[key], model.compensation[key], numericalTolerance));
  check('runtime', 'rebaseProjection', frame.index, actual, predicted, projectionMatches);
  return clock && validInput && samePrevious && validCompensation && projectionMatches;
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
  const { frames, events, segments, rebases } = evidence.trace(data);
  const viewport = boundaryViewport(data);
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
  const appliedRebases = new Map();
  const verifiedRebases = new Map();
  const firstTicket = segments[0].ticket;
  const leadingTickets = rebases.filter(event => sequence(event.payload.fromTicket) && event.payload.fromTicket < firstTicket)
    .map(event => event.payload.fromTicket);
  const leadingTicket = leadingTickets.length ? Math.min(...leadingTickets) : firstTicket;
  const targetVisibility = direction === 'open' ? 1 : 0;
  let segment, segmentDiagnostic, activeRebase;

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
  if (leadingTicket === firstTicket) {
    check('runtime', 'durationMs', 0, segments[0].durationMs, expected.durationMs,
      segments[0].durationMs === expected.durationMs);
    check('runtime', 'startVisibility', 0, frames[0].visibilityProgress, 1 - targetVisibility,
      near(frames[0].visibilityProgress, 1 - targetVisibility, expected.opacityTolerance));
  }
  for (const frame of frames) {
    const i = frame.index;
    const v = frame.visibilityProgress;
    const nextSegment = segmentStarts.get(i);
    if (nextSegment) {
      segment = nextSegment;
      activeRebase = undefined;
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
      const rebased = activeRebase?.payload.after.transition;
      const startVisibility = rebased ? visualAt(rebased, rebased.startProgress).visibilityProgress :
        segment.start === 0 && leadingTicket === firstTicket ? 1 - targetVisibility : segmentDiagnostic.startVisibility;
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
    const selected = actorsByRole(actorArray);
    if (nextSegment && (i > 0 || leadingTicket < firstTicket)) {
      const previous = frames[i - 1];
      const previousActors = Array.isArray(previous?.actors) ? previous.actors : [];
      const previousSelected = actorsByRole(previousActors);
      const previousGrabber = previousSelected.grabber;
      const grabber = selected.grabber;
      const fromTicket = previous?.runtimeTicket ?? leadingTicket;
      const chain = rebaseChain(rebases, fromTicket, frame, previous, data);
      const boundary = {
        frame: i, fromTicket, toTicket: frame.runtimeTicket, rebaseEventSeqs: chain?.map(event => event.eventSeq) ?? [],
        visibilityBefore: previous?.visibilityProgress ?? null, visibilityAfter: v,
        layoutOffsetBeforeVp: previous?.runtimeLayoutOffsetVp ?? null, layoutOffsetAfterVp: frame.runtimeLayoutOffsetVp,
        grabberWindowDeltaYVp: previousGrabber?.mounted === true && present(previousGrabber.windowOriginVp, ['y']) &&
          grabber?.mounted === true && present(grabber.windowOriginVp, ['y']) ?
          grabber.windowOriginVp.y - previousGrabber.windowOriginVp.y : null,
      };
      ticketBoundaries.push(boundary);
      check('runtime', 'rebaseCause', i, boundary, 'one current owner rebase for each revoked ticket', chain ? true : null);
      let verified = Boolean(chain);
      for (const [index, event] of (chain ?? []).entries()) {
        const priorFrame = index === 0 ? previous : undefined;
        const incoming = appliedRebases.get(event.payload.fromTicket);
        const earlier = frames[i - 2];
        const priorTick = earlier?.runtimeTicket === priorFrame?.runtimeTicket ? earlier?.runtimeTickMs :
          incoming?.payload.ticketStartTickMs;
        const matches = checkRebase(check, event, frame, priorFrame, priorTick, incoming, leadingTicket, data, expected);
        verified = verified && matches && (!incoming || verifiedRebases.has(event.payload.fromTicket));
        if (verified) verifiedRebases.set(event.payload.toTicket, event);
        appliedRebases.set(event.payload.toTicket, event);
      }
      activeRebase = verified ? chain.at(-1) : undefined;
      const prior = verified ? chain[0] : undefined;
      checkBoundaryActors(check, previous, previousSelected, viewport, prior?.payload.before, 'before', prior, expected, direction);
      checkBoundaryActors(check, frame, selected, viewport, activeRebase?.payload.after, 'after', activeRebase, expected, direction);
      if (activeRebase) {
        const t = activeRebase.payload.after.transition;
        const visual = visualAt(t, t.progress);
        check('runtime', 'rebaseFrameAnchor', i,
          { durationMs: frame.runtimeDurationMs, visibilityProgress: v, expansionProgress: frame.expansionProgress },
          { durationMs: t.durationMs, ...visual },
          frame.runtimeDurationMs === t.durationMs && near(v, visual.visibilityProgress, expected.opacityTolerance) &&
          near(frame.expansionProgress, visual.expansionProgress, expected.transformTolerance));
        if (!previous) {
          const initial = chain[0].payload.before.transition;
          check('runtime', 'durationMs', i, initial.durationMs, expected.durationMs, initial.durationMs === expected.durationMs);
        }
      }
    }
    if (activeRebase) {
      if (i === segment.start + 1) {
        const elapsed = frames[segment.start].runtimeTickMs - activeRebase.payload.ticketStartTickMs;
        check('runtime', 'rebaseFirstTick', i, frame.runtimeElapsedMs, elapsed, frame.runtimeElapsedMs === elapsed);
      }
      const compensation = compensationAt(activeRebase.payload.after.compensation, frame.runtimeElapsedMs);
      check('runtime', 'rebaseCompensationVp', i, frame.runtimeLayoutOffsetVp, compensation,
        near(frame.runtimeLayoutOffsetVp, compensation, expected.layoutToleranceVp));
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
      const stableSize = role === 'grabber' ? [GRABBER_CARRIER_WIDTH_VP, 28] : [baselineRect.width, baselineRect.height];
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

  const unused = rebases.filter(event => appliedRebases.get(event.payload.toTicket) !== event);
  if (unused.length) {
    check('runtime', 'rebaseCause', frames.at(-1).index, unused.map(event => event.eventSeq),
      'every current rebase event assigned to exactly one sampled ticket boundary', null);
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
  const unverifiedBoundary = missing.get('runtime.rebaseCause');
  const verdict = failures.size ? 'FAIL' : missing.size ? 'NOT_RUN' : 'PASS';
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
