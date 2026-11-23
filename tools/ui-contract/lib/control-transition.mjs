import { EvidenceError } from '../../lib/native-ui-evidence.mjs';
import { selectLayoutNode } from './layout.mjs';

const STAGE = 'reader-reading-stage';
const ACTORS = {
  dock: 'reader-control-motion-dock',
  shell: 'reader-control-motion-shell',
  grabber: 'reader-control-motion-grabber',
  content: 'reader-control-content-host',
  clip: 'reader-control-motion-content-clip',
};
const MATRIX = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const LOCATION_KEYS = ['level', 'module', 'form', 'directoryTab'];
const AXIS_KEYS = ['quickGrabberScreenY','fullGrabberScreenY','hiddenGrabberScreenY'];
const VISUAL_KEYS = ['visibilityProgress','expansionProgress'];
const GRABBER_ANCHOR_INSET_VP = 9;
const GRABBER_DIRECTION_SLOP_VP = 8;
const finite = Number.isFinite;
const seq = x => Number.isSafeInteger(x) && x >= 0;
const fields = (value, keys) => keys.every(key => finite(value?.[key]));
const location = (level, module = 'directory', form = 'quick', directoryTab = 'directory') =>
  ({ level, module, form, directoryTab });
const equalLocation = (a, b) => Boolean(a && b && LOCATION_KEYS.every(key => a[key] === b[key]));
const clamp = t => Math.max(0, Math.min(1, t));
const mix = (from, to, progress) => from + (to - from) * progress;
const near = (a, b, tolerance) => Math.abs(a - b) <= tolerance;
const diagnostic = value => {
  if (value === undefined || typeof value === 'number' && !finite(value)) return null;
  if (Array.isArray(value)) return value.map(diagnostic);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, diagnostic(item)]));
  return value;
};
const vector = (value, expected, tolerance) => Array.isArray(value) && value.length === expected.length && value.every(finite) ?
  value.every((number, index) => near(number, expected[index], tolerance)) : null;
const moduleId = state => 'reader-control-module-' + (state.level === 'secondary' ? state.module : 'home');

function stableNode(sample, id) {
  try {
    return sample && selectLayoutNode(sample, id);
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return undefined;
  }
}

function stableContent(sample, want, opacityTolerance) {
  if (!sample?.nodes) return null;
  // The panel intentionally retains its content beneath an opacity-zero dock
  // at the hidden endpoint. The stable tree is measured after normal publication.
  const dock = stableNode(sample, ACTORS.dock);
  if (want.level === 'hidden') {
    return { id: dock?.id ?? null, visible: Boolean(dock && dock.opacity > opacityTolerance) };
  }
  const modules = sample.nodes.filter(node => node.visible === true && node.opacity > 0 &&
    typeof node.id === 'string' && /^reader-control-module-(home|directory|tts|appearance|settings|search|autoPage|replace)$/u.test(node.id));
  const content = modules.length === 1 ? modules[0] : stableNode(sample, moduleId(want));
  const body = want.level === 'secondary' && want.module === 'directory' ?
    stableNode(sample, 'reader-control-directory-body-' + want.directoryTab) : content;
  const collapse = stableNode(sample, 'reader-control-collapse');
  const visible = Boolean(content && body && dock && dock.opacity > 0 &&
    content.opacity > 0 && body.opacity > 0);
  return {
    id: content?.id ?? null, body: body?.id ?? null, modules: modules.map(node => node.id), visible,
    collapseEnabled: collapse?.enabled === true && collapse.opacity > 0,
  };
}

function contentMatches(actual, expected) {
  if (!actual) return null;
  if (expected.level === 'hidden') return actual.visible === false;
  if (actual.modules.length > 0 && (actual.modules.length !== 1 || actual.modules[0] !== moduleId(expected))) return false;
  if (actual.id === null || !actual.visible) return null;
  return actual.id === moduleId(expected) &&
    (expected.level !== 'secondary' || actual.collapseEnabled === (expected.form === 'full'));
}

function visualThrough(transition, progress) {
  if (!fields(transition?.from, ['visibilityProgress', 'expansionProgress']) ||
    !fields(transition.to, ['visibilityProgress', 'expansionProgress'])) return null;
  return {
    visibilityProgress: mix(transition.from.visibilityProgress, transition.to.visibilityProgress, progress),
    expansionProgress: mix(transition.from.expansionProgress, transition.to.expansionProgress, progress),
  };
}

export function grabberY(axis, visual) {
  return axis.quickGrabberScreenY + (axis.fullGrabberScreenY - axis.quickGrabberScreenY) * visual.expansionProgress +
    (axis.hiddenGrabberScreenY - axis.quickGrabberScreenY) * (1 - visual.visibilityProgress);
}

export function rebaseProjection(before, axis) {
  const transition = before.transition;
  const anchor = grabberY(before.axis, visualThrough(transition, transition.progress)) + before.compensation.offsetY;
  const fromY = grabberY(axis, transition.from);
  const toY = grabberY(axis, transition.to);
  const travel = toY - fromY;
  const epsilon = Number.EPSILON * Math.max(1, Math.abs(fromY), Math.abs(toY), Math.abs(anchor)) * 16;
  const spatiallyStatic = Math.abs(travel) <= epsilon;
  const currentY = grabberY(axis, visualThrough(transition, transition.progress));
  const projected = (anchor - fromY) / travel;
  const reachableRoot = finite(projected) &&
    projected >= -Number.EPSILON * 64 && projected <= 1 + Number.EPSILON * 64;
  const alreadyAtAnchor = Math.abs(currentY - anchor) <= epsilon;
  const progress = !alreadyAtAnchor && !spatiallyStatic && reachableRoot ? clamp(projected) : transition.progress;
  const reason = spatiallyStatic ? 'compensated-static-segment' :
    alreadyAtAnchor || reachableRoot ? 'projected' : 'compensated-outside-segment';
  const offsetY = anchor - grabberY(axis, visualThrough(transition, progress));
  const durationMs = Math.max(0, transition.durationMs - transition.elapsedMs);
  const running = offsetY !== 0 && durationMs > 0;
  return { reason, progress, anchor, durationMs, compensation: {
    offsetY, startOffsetY: offsetY, elapsedMs: 0, durationMs: running ? durationMs : 0, running,
    revision: before.compensation.revision + (running ? 2 : 1),
  } };
}

function layoutInputsValid(layout) {
  return fields(layout, ['dockLeftVp', 'dockTopVp', 'widthVp', 'fullHeightVp', 'quickHeightVp',
    'quickContentHeightVp', 'fullContentHeightVp', 'fullContentTopVp']) &&
    layout.widthVp > 0 && layout.fullHeightVp > 0 && layout.quickHeightVp > 0 &&
    layout.quickHeightVp <= layout.fullHeightVp;
}

function projectedActors(layout, visual, offsetVp, tolerance) {
  if (!layoutInputsValid(layout) || !visual || !finite(offsetVp)) return null;
  const { widthVp: width, fullHeightVp: height, quickHeightVp, fullContentTopVp } = layout;
  const p = visual.expansionProgress;
  const shellHeight = mix(quickHeightVp, height, p);
  const shellY = height - shellHeight + offsetVp;
  const x = Math.min(tolerance.maxContentInsetVp, width / 4);
  const fullWidth = Math.max(0, width - 2 * x);
  const quickWidth = Math.max(0, fullWidth - tolerance.quickContentReserveVp);
  const content = [
    x,
    shellY + mix(tolerance.quickContentTopVp, fullContentTopVp, p),
    mix(quickWidth, fullWidth, p),
    mix(layout.quickContentHeightVp, layout.fullContentHeightVp, p),
  ];
  return {
    dock: [0, 0, width, height],
    shell: [0, shellY, width, shellHeight],
    grabber: [(width - tolerance.grabberWidthVp) / 2, shellY, tolerance.grabberWidthVp, tolerance.grabberHeightVp],
    content, clip: content,
  };
}

function beforeStage(sample) {
  const node = stableNode(sample, STAGE);
  const win = sample?.window;
  const density = win?.density;
  if (!fields(node?.rectPx, ['left', 'top', 'width', 'height']) || !fields(win?.rectPx, ['left', 'top']) ||
      !finite(density) || density <= 0) return null;
  return [(node.rectPx.left - win.rectPx.left) / density, (node.rectPx.top - win.rectPx.top) / density];
}

function actorMap(frame) {
  return {
    ...Object.fromEntries(Object.entries(ACTORS).filter(([role]) => role !== 'clip').map(([role, id]) => {
      const matches = frame.actors?.filter(node => node.id === id);
      return [role, matches?.length === 1 ? matches[0] : undefined];
    })),
    clip: frame.contentClip?.id === ACTORS.clip ? frame.contentClip : undefined,
  };
}

function completeAncestors(actor) {
  const chain = actor?.ancestors;
  if (!Array.isArray(chain) || chain.length < 1 || actor.ancestorChainComplete !== true ||
    chain[0]?.uniqueId !== actor.parentUniqueId ||
    !chain.every((item, i) => seq(item.uniqueId) && item.parentUniqueId === chain[i + 1]?.uniqueId)) return null;
  return chain;
}

// Match ArkUI CubicCurve's bisection in the time domain. The platform returns
// the y value of the first midpoint whose x is within 0.001 of elapsed time.
// Solving the ideal inverse to greater precision yields a different pose.
export function easedFraction(fraction) {
  if (fraction === 0 || fraction === 1) return fraction;
  let from = 0, to = 1;
  for (let index = 0; index < 20; index++) {
    const t = (from + to) / 2;
    const x = 0.6 * t * (1 - t) ** 2 + t ** 3;
    if (Math.abs(x - fraction) < 0.001) return (3 - 2 * t) * t * t;
    if (x < fraction) from = t;
    else to = t;
  }
  const t = (from + to) / 2;
  return (3 - 2 * t) * t * t;
}

function motionCurve(kind, transition, elapsedMs, slope) {
  const progress = clamp(elapsedMs / transition.durationMs);
  let fraction;
  if (finite(slope)) fraction = ((slope - 2) * progress + 3 - 2 * slope) * progress ** 2 + slope * progress;
  else if (kind === 'morph') fraction = progress * progress * (3 - 2 * progress);
  else if (kind === 'open' || kind === 'dismiss') fraction = easedFraction(progress);
  else return null;
  return mix(transition.startProgress, transition.targetProgress, fraction);
}

function comparableRebase(snapshot) {
  return fields(snapshot?.axis, AXIS_KEYS) &&
    fields(snapshot.compensation, ['offsetY','startOffsetY','elapsedMs','durationMs','revision']) &&
    typeof snapshot.compensation.running === 'boolean' &&
    fields(snapshot.transition, ['progress','startProgress','targetProgress','elapsedMs','durationMs']) &&
    finite(snapshot.compensatedGrabberScreenY) &&
    visualThrough(snapshot.transition, snapshot.transition.progress) !== null;
}

function compensationOffset(compensation, elapsedMs, direction) {
  if (!compensation?.running || compensation.durationMs <= 0) return compensation?.offsetY ?? 0;
  const fraction = clamp((compensation.elapsedMs + elapsedMs) / compensation.durationMs);
  const easing = direction === 'morph' ? fraction * fraction * (3 - 2 * fraction) : easedFraction(fraction);
  return compensation.startOffsetY * (1 - easing);
}

export function sampledRebaseAxis(frame, dockTravelVp) {
  const dock = frame ? actorMap(frame).dock : null;
  const bounds = dock?.layoutRectVp;
  const layout = frame?.layoutInputs;
  if (dock?.mounted && fields(bounds,['y','height']) && layoutInputsValid(layout)) {
    const full = bounds.y + GRABBER_ANCHOR_INSET_VP;
    const quick = full + bounds.height - layout.quickHeightVp;
    return { fullGrabberScreenY:full, quickGrabberScreenY:quick, hiddenGrabberScreenY:quick + dockTravelVp };
  }
  // The first frame after a tap publishes the layout before the dock actor is
  // attached. The measured layout is still native input for the same axis;
  // admit it only for that first start frame, never for a later missing dock
  // or a mounted handle whose geometry is incomplete.
  if (frame?.index === 0 && frame.phase === 'start' && (!dock || dock.mounted === false)) {
    if (!layoutInputsValid(layout) || !finite(layout.dockTopVp)) return null;
    const full = layout.dockTopVp + GRABBER_ANCHOR_INSET_VP;
    const quick = full + layout.fullHeightVp - layout.quickHeightVp;
    return { fullGrabberScreenY:full, quickGrabberScreenY:quick, hiddenGrabberScreenY:quick + dockTravelVp };
  }
  return null;
}

function verifyRebase(check, event, frame, { previous, earlier, incoming, transition, expectation, request }) {
  const { before, after, fromTicket, toTicket, beforeTickMs, ticketStartTickMs } = event.payload;
  if (!comparableRebase(before) || !comparableRebase(after) ||
      !fields(event.payload,['beforeTickMs','ticketStartTickMs']) || !finite(event.deviceMonoMs) ||
      typeof event.payload.anchorPreserved !== 'boolean' || typeof event.payload.rebaseReason !== 'string') {
    check('runtime', 'rebase-inputs', frame.index, { fromTicket, toTicket },
      'source and target axis, progress, compensation and native anchor input', null);
    return false;
  }
  const transformTolerance = expectation.transformTolerance;
  const layoutTolerance = expectation.layoutToleranceVp;
  const source = before.transition;
  const sameEndpoints = (left, right) => ['from','to'].every(key =>
    VISUAL_KEYS.every(field => near(left[key][field], right[key][field], transformTolerance)));

  // FrameNode samples precede the update at runtimeTickMs. Include precisely
  // the delta published by the last captured callback before trusting configure.
  const priorTick = earlier?.runtimeTicket === previous?.runtimeTicket && earlier?.index + 1 === previous?.index ?
    earlier.runtimeTickMs : incoming?.ticketStartTickMs;
  // A command event is recorded before the runtime accepts it. On the first
  // sampled frame there is no earlier runtime tick, so only lower/upper bounds
  // are observable: acceptance cannot precede the request and the elapsed
  // predecessor time cannot exceed the distance from the request to the frame
  // callback. The integer clocks may differ by scheduling between those calls.
  const firstFrameClockBound = previous && !earlier && !incoming &&
    previous.phase === 'start' && previous.runtimeElapsedMs === 0 &&
    finite(request?.deviceMonoMs) && request.payload?.transitionId === event.payload.transitionId &&
    request.payload?.accepted?.epoch === event.payload.epoch &&
    request.eventSeq < event.eventSeq && request.deviceMonoMs <= previous.runtimeTickMs &&
    previous.runtimeTickMs === event.payload.beforeTickMs ?
    { minimumMs: 0, maximumMs: previous.runtimeTickMs - request.deviceMonoMs } : null;
  const publishedElapsed = previous ?
    fields(previous,['runtimeElapsedMs','runtimeTickMs']) && finite(priorTick) ?
      previous.runtimeElapsedMs + previous.runtimeTickMs - priorTick :
      !earlier && !incoming && previous.phase === 'start' &&
        previous.runtimeElapsedMs === 0 && finite(request?.deviceMonoMs) &&
        request.payload?.transitionId === event.payload.transitionId &&
        request.payload?.accepted?.epoch === event.payload.epoch &&
        request.eventSeq < event.eventSeq && request.deviceMonoMs <= previous.runtimeTickMs &&
        previous.runtimeTickMs === event.payload.beforeTickMs ?
        previous.runtimeTickMs - request.deviceMonoMs : null : 0;
  const expectedTick = previous?.runtimeTickMs ?? incoming?.ticketStartTickMs;
  const hasReceiverTick = finite(frame.runtimeTickMs);
  const clockOrder = toTicket === fromTicket + 1 && beforeTickMs <= ticketStartTickMs &&
    ticketStartTickMs <= event.deviceMonoMs && (!hasReceiverTick || event.deviceMonoMs <= frame.runtimeTickMs) &&
    (!finite(previous?.captureEndMs) || previous.captureEndMs <= event.deviceMonoMs) &&
    (!finite(expectedTick) || beforeTickMs === expectedTick);
  const clock = !clockOrder || source.elapsedMs < 0 || source.elapsedMs >= source.durationMs ? false :
    firstFrameClockBound ? hasReceiverTick &&
      source.elapsedMs >= firstFrameClockBound.minimumMs &&
      source.elapsedMs <= firstFrameClockBound.maximumMs :
      publishedElapsed === null || !hasReceiverTick ? null : near(source.elapsedMs,publishedElapsed,.01);
  check('runtime', 'rebase-predecessor-clock', frame.index,
    { fromTicket,toTicket,beforeTickMs,ticketStartTickMs,elapsedMs:source.elapsedMs },
    { beforeTickMs:expectedTick,
      elapsedMs: firstFrameClockBound ?? publishedElapsed }, clock);

  const priorCompensation = incoming?.after.compensation;
  const offsetBefore = compensationOffset(priorCompensation,source.elapsedMs,source.kind);
  const comp = before.compensation;
  const compensationMatches = comp.elapsedMs >= 0 && comp.durationMs >= 0 && seq(comp.revision) &&
    near(comp.offsetY,offsetBefore,layoutTolerance) &&
    (priorCompensation ? comp.revision === priorCompensation.revision &&
      comp.durationMs === priorCompensation.durationMs && comp.running === priorCompensation.running &&
      near(comp.startOffsetY,priorCompensation.startOffsetY,layoutTolerance) &&
      near(comp.elapsedMs,priorCompensation.elapsedMs + (priorCompensation.running ? source.elapsedMs : 0),.01) :
      comp.running === false);
  const inputKnown = fields(transition,['startProgress','targetProgress','durationMs']) &&
    visualThrough(transition,transition.startProgress) !== null;
  const expectedProgress = inputKnown && clock !== null ?
    motionCurve(transition.kind,transition,source.elapsedMs) : null;
  const acceptedArc = inputKnown && source.kind === transition.kind && sameEndpoints(source,transition) &&
    source.startProgress === transition.startProgress && source.targetProgress === transition.targetProgress &&
    near(source.durationMs,transition.durationMs,.01);
  const pose = !inputKnown ? null : !acceptedArc || !compensationMatches ? false :
    finite(expectedProgress) ? near(source.progress,expectedProgress,transformTolerance) : null;
  check('runtime', 'rebase-predecessor-pose', frame.index,
    { progress:source.progress,startProgress:source.startProgress,durationMs:source.durationMs,compensation:comp },
    { progress:expectedProgress,startProgress:transition?.startProgress ?? null,
      durationMs:transition?.durationMs ?? null,offsetY:offsetBefore }, pose);

  const oldAxis = sampledRebaseAxis(previous,expectation.dockTravelVp) ?? incoming?.after.axis;
  const newAxis = toTicket === frame.runtimeTicket ? sampledRebaseAxis(frame,expectation.dockTravelVp) : null;
  const sameAxis = (observed, measured) => measured ? AXIS_KEYS.every(key => near(observed[key],measured[key],layoutTolerance)) : null;
  const beforeAxisMatches = sameAxis(before.axis,oldAxis);
  const afterAxisMatches = sameAxis(after.axis,newAxis);
  if (previous || !incoming) check('grabber','rebase-native-axis-before',frame.index,before.axis,oldAxis,beforeAxisMatches);
  if (toTicket === frame.runtimeTicket) {
    check('grabber','rebase-native-axis-after',frame.index,after.axis,newAxis,afterAxisMatches);
  }
  if (incoming) {
    const linked = AXIS_KEYS.every(key => near(before.axis[key],incoming.after.axis[key],layoutTolerance));
    check('runtime','rebase-axis-link',frame.index,before.axis,incoming.after.axis,linked);
    if (!linked) return false;
  }
  const expected = rebaseProjection(before, after.axis);
  const key = 'rebase-spatial-projection';
  const chosen = {
    reason: event.payload.rebaseReason, progress: after.transition.progress, durationMs: after.transition.durationMs,
    anchor: after.compensatedGrabberScreenY, compensation: after.compensation,
  };
  const good = event.payload.source === 'ReaderControlRuntime.configure' && event.payload.anchorPreserved === true &&
    before.transition.kind === after.transition.kind && sameEndpoints(before.transition,after.transition) &&
    after.transition.targetProgress === before.transition.targetProgress &&
    after.transition.elapsedMs === 0 && after.transition.startProgress === after.transition.progress &&
    chosen.reason === expected.reason && near(chosen.progress, expected.progress, transformTolerance) &&
    near(chosen.durationMs, expected.durationMs, .01) && near(chosen.anchor, expected.anchor, layoutTolerance) &&
    near(before.compensatedGrabberScreenY, expected.anchor, layoutTolerance) &&
    chosen.compensation.running === expected.compensation.running &&
    ['elapsedMs','durationMs','revision'].every(key => chosen.compensation[key] === expected.compensation[key]) &&
    ['offsetY','startOffsetY'].every(key => near(chosen.compensation[key], expected.compensation[key], layoutTolerance));
  check('runtime', key, frame.index, chosen, expected, good);
  return good && clock === true && pose === true && beforeAxisMatches !== false && afterAxisMatches !== false;
}

function readUnpublishedMorph({expected, request, first, predecessor, pointerFrame, pointerMotions, boundary}) {
  const release = request.payload;
  const { before, released, pointerId } = boundary;
  const { layoutToleranceVp, transformTolerance } = expected.trajectory;
  const layout = first.layoutInputs;
  if (release.direction !== 'morph' || release.origin !== 'grabber-release' || first.index !== 0 ||
      first.phase !== 'start' || first.runtimeElapsedMs !== 0 ||
      first.observationPhase !== 'before-runtime-publication' ||
      first.heldPointerId !== -1 || first.runtimeEpoch !== released.epoch || first.runtimeTicket !== released.ticket ||
      !pointerFrame || !pointerMotions || !layoutInputsValid(layout) ||
      !Object.keys(layout).every(key => layout[key] === pointerFrame.layoutInputs?.[key]) ||
      !finite(first.runtimeLayoutOffsetVp) || first.runtimeLayoutOffsetVp !== pointerFrame.runtimeLayoutOffsetVp) return;

  const actors = actorMap(first);
  const span = layout.fullHeightVp - layout.quickHeightVp;
  const height = actors.shell?.layoutRectVp?.height;
  if (span <= 0 || !finite(height) ||
      near(height, layout.quickHeightVp + span * released.expansionProgress, layoutToleranceVp)) return;

  const heldActors = actorMap(pointerFrame);
  const heldHeight = heldActors.shell?.layoutRectVp?.height;
  const frames = trajectoryFrames(pointerMotions);
  if (frames.at(-1) !== pointerFrame ||
      !completeTrajectoryBlocks(pointerMotions, frames, predecessor.payload, 'interrupted') ||
      !frames.every((frame, i) => frame.phase === 'pointer' && frame.observationPhase === 'after-pointer-publication' &&
        frame.heldPointerId === pointerId && frame.runtimeEpoch === before.epoch &&
        seq(frame.runtimeTicket) && frame.runtimeTicket <= before.ticket &&
        fields(frame, ['frameTimeNs','captureStartMs','captureEndMs']) && frame.captureStartMs <= frame.captureEndMs &&
        (i === 0 || frame.frameTimeNs > frames[i - 1].frameTimeNs && frame.captureStartMs >= frames[i - 1].captureEndMs)) ||
      !fields(first, ['frameTimeNs','captureStartMs']) || !finite(request.deviceMonoMs) ||
      first.frameTimeNs <= pointerFrame.frameTimeNs || pointerFrame.captureEndMs > request.deviceMonoMs ||
      request.deviceMonoMs > first.captureStartMs ||
      first.captureStartMs - pointerFrame.captureEndMs > expected.maximumFrameGapMs ||
      !Object.entries(actors).every(([role, actor]) => actor?.mounted && seq(actor.uniqueId) &&
        heldActors[role]?.mounted && heldActors[role].uniqueId === actor.uniqueId) ||
      !finite(heldHeight)) return;

  const nativeExpansion = (height - layout.quickHeightVp) / span;
  const pointerExpansion = (heldHeight - layout.quickHeightVp) / span;
  const lower = Math.min(pointerExpansion, released.expansionProgress);
  const upper = Math.max(pointerExpansion, released.expansionProgress);
  if (nativeExpansion < 0 || nativeExpansion > 1 || nativeExpansion < lower || nativeExpansion > upper ||
      !near(pointerExpansion, pointerFrame.expansionProgress, transformTolerance) ||
      !near(first.expansionProgress, released.expansionProgress, transformTolerance)) return;
  return { nativeExpansion, pointerExpansion, pointerGapMs: first.captureStartMs - pointerFrame.captureEndMs };
}

function evaluateReleaseBoundary({check, expected, request, first, predecessor, interruption, pointerFrame,
  pointerMotions, pointerOffsetVp = 0}) {
  const release = request.payload;
  const boundary = release.releaseMotion?.boundary;
  const before = boundary?.before;
  const held = boundary?.held;
  const released = boundary?.released;
  const fieldsRead = point => fields(point, ['epoch','ticket','heldPointerId','pointerWindowYVp',
    'expansionProgress','visibilityProgress','grabberScreenYVp']);
  if (!seq(boundary?.pointerId) || !finite(boundary.upWindowYVp) ||
      !seq(release.before?.epoch) || !seq(release.accepted?.epoch) ||
      ![before, held, released].every(fieldsRead)) {
    check('runtime', 'release-observation', null, boundary, 'runtime samples before UP, at its position and after retarget', null);
    return null;
  }

  check('owner', 'release-pointer-owner', null, boundary.pointerId, release.before.heldPointerId,
    boundary.pointerId === release.before.heldPointerId &&
    before.heldPointerId === boundary.pointerId && held.heldPointerId === boundary.pointerId &&
    released.heldPointerId === -1 && release.accepted.heldPointerId === -1);
  check('owner', 'release-ticket-handoff', null, [before.ticket, held.ticket, released.ticket],
    'the same pointer epoch and a successor release ticket',
    before.epoch === release.before.epoch && before.epoch === held.epoch &&
    released.epoch === release.accepted.epoch && held.ticket >= before.ticket && released.ticket > held.ticket);
  check('owner', 'release-retired-held-epoch', null, interruption?.payload, release.accepted.epoch,
    predecessor && interruption ? predecessor.eventSeq < interruption.eventSeq && interruption.eventSeq < request.eventSeq &&
      predecessor.payload.accepted?.epoch === before.epoch && interruption.payload.epoch === before.epoch &&
      interruption.payload.successorEpoch === released.epoch && interruption.payload.heldPointerId === -1 &&
      equalLocation(interruption.payload.successorTarget, release.target) : null);

  const tolerance = expected.trajectory.layoutToleranceVp;
  const transforms = expected.trajectory.transformTolerance;
  const dismiss = expected.direction === 'dismiss';
  if (dismiss) {
    const move = predecessor?.payload;
    const edges = [move?.transition, release.transition];
    const measuredArc = edges.every(edge => typeof edge?.kind === 'string' &&
      fields(edge.from, VISUAL_KEYS) && fields(edge.to, VISUAL_KEYS) && finite(edge.targetProgress));
    check('runtime', 'release-dismiss-arc', null, edges, 'one Quick visibility segment preserved across UP',
      measuredArc && typeof move.direction === 'string' && move.source && move.target ?
        move.direction === 'dismiss' && equalLocation(move.source, expected.source) && equalLocation(move.target, expected.target) &&
        edges.every(edge => edge.kind === 'dismiss' && edge.from.expansionProgress === 0 &&
          edge.to.expansionProgress === 0 && edge.from.visibilityProgress === 1 &&
          edge.to.visibilityProgress === 0 && edge.targetProgress === 1) : null);
    const travel = expected.trajectory.dockTravelVp;
    const nativeTravel = pointerFrame?.pointerWindowYVp - pointerFrame?.pointerStartWindowYVp - pointerOffsetVp;
    const upTravel = boundary.upWindowYVp - pointerFrame?.pointerStartWindowYVp - pointerOffsetVp;
    const minimum = pointerOffsetVp > 0 ? 0 : GRABBER_DIRECTION_SLOP_VP;
    check('runtime', 'release-dismiss-pointer-path', pointerFrame?.index ?? null,
      { nativeTravel, upTravel, heldVisibility:held.visibilityProgress, travelVp:release.releaseMotion.travelVp },
      { minimumExclusiveVp:minimum, maximumExclusiveVp:travel },
      fields(pointerFrame, ['pointerWindowYVp','pointerStartWindowYVp']) &&
      finite(pointerOffsetVp) && finite(release.releaseMotion.travelVp) &&
      pointerFrame.observationPhase === 'after-pointer-publication' ?
        nativeTravel > 0 && nativeTravel < travel && upTravel > minimum && upTravel < travel &&
        near(release.releaseMotion.travelVp, travel, tolerance) &&
        near(held.visibilityProgress, 1 - upTravel / travel, transforms) : null);
    check('trace', 'release-dismiss-pointer-before-up', pointerFrame?.index ?? null,
      pointerFrame?.captureEndMs ?? null, request.deviceMonoMs ?? null,
      fields(pointerFrame, ['captureStartMs','captureEndMs']) && finite(request.deviceMonoMs) ?
        pointerFrame.captureStartMs <= pointerFrame.captureEndMs && pointerFrame.captureEndMs <= request.deviceMonoMs : null);
  }
  const expectedHeldY = before.grabberScreenYVp + boundary.upWindowYVp - before.pointerWindowYVp;
  check('runtime', 'observed-up-position', null, held.pointerWindowYVp, boundary.upWindowYVp,
    near(held.pointerWindowYVp, boundary.upWindowYVp, transforms));
  check('runtime', 'mid-segment-up-position', null, held.grabberScreenYVp, expectedHeldY,
    dismiss ? held.expansionProgress === 0 && held.visibilityProgress > 0 && held.visibilityProgress < 1 &&
      near(held.grabberScreenYVp, expectedHeldY, tolerance) :
      held.expansionProgress > 0 && held.expansionProgress < 1 && held.visibilityProgress === 1 ?
        near(held.grabberScreenYVp, expectedHeldY, tolerance) : null);
  const start = finite(release.transition?.startProgress) ? visualThrough(release.transition, release.transition.startProgress) : null;
  check('runtime', 'release-retarget-continuity', null, released, { held, start },
    start ? near(released.grabberScreenYVp, held.grabberScreenYVp, tolerance) &&
      ['expansionProgress','visibilityProgress'].every(key => near(released[key], held[key], expected.trajectory.transformTolerance) &&
        near(released[key], start[key], expected.trajectory.transformTolerance)) : null);

  const shell = actorMap(first).shell;
  const pointerShell = pointerFrame ? actorMap(pointerFrame).shell : undefined;
  check('owner', 'release-native-pointer-owner', pointerFrame?.index ?? null, pointerFrame?.heldPointerId, boundary.pointerId,
    Number.isSafeInteger(pointerFrame?.heldPointerId) ? pointerFrame.heldPointerId === boundary.pointerId : null);
  check('shell', 'release-native-continuity', first.index, shell?.uniqueId, pointerShell?.uniqueId,
    seq(shell?.uniqueId) && shell.mounted && seq(pointerShell?.uniqueId) && pointerShell.mounted &&
      pointerFrame.runtimeEpoch === before.epoch && seq(pointerFrame.runtimeTicket) ?
      shell.uniqueId === pointerShell.uniqueId && pointerFrame.runtimeTicket <= before.ticket : null);
  const delayMs = finite(first.captureStartMs) && finite(request.deviceMonoMs) ? first.captureStartMs - request.deviceMonoMs : null;
  check('trace', 'first-release-observation', first.index, { phase: first.observationPhase, delayMs, ticket: first.runtimeTicket },
    { phase: 'before-runtime-publication', maximumDelayMs: expected.maximumFrameGapMs, ticket: released.ticket },
    delayMs !== null && delayMs >= 0 && delayMs <= expected.maximumFrameGapMs &&
      first.observationPhase === 'before-runtime-publication' && first.runtimeTicket === released.ticket ? true : null);
  // The first callback after UP can still observe the last pointer-owned tree:
  // UP publishes the release state in the same JS turn, but that state reaches
  // the native tree on the following frame. Preserve and prove that boundary
  // frame instead of comparing it with a release curve that has not rendered.
  const firstDock = actorMap(first).dock;
  const pointerDock = pointerFrame ? actorMap(pointerFrame).dock : undefined;
  const modelVisibility = first.visibilityProgress;
  const nativeVisibility = firstDock?.opacity;
  const pointerVisibility = pointerDock?.opacity;
  const publicationPending = finite(modelVisibility) && finite(nativeVisibility) &&
    !near(nativeVisibility, modelVisibility, expected.trajectory.opacityTolerance);
  if (publicationPending) {
    const lower = Math.min(released.visibilityProgress, pointerVisibility);
    const upper = Math.max(released.visibilityProgress, pointerVisibility);
    check('trace', 'release-prepublication-pose', first.index,
      { nativeVisibility, modelVisibility, pointerVisibility, releaseVisibility: released.visibilityProgress },
      'the first callback still shows a contiguous pointer-owned pose between the last sampled pointer and the release start',
      dismiss && finite(pointerVisibility) && finite(released.visibilityProgress) ?
        nativeVisibility >= lower && nativeVisibility <= upper : null);
    const expectedTranslateY = expected.trajectory.dockTravelVp * (1 - nativeVisibility);
    check('trace', 'release-prepublication-translation', first.index,
      { opacity: nativeVisibility, translateY: firstDock?.translateVp?.y ?? null },
      { opacity: nativeVisibility, translateY: expectedTranslateY },
      finite(nativeVisibility) && finite(firstDock?.translateVp?.y) && finite(expectedTranslateY) ?
        near(firstDock.translateVp.y, expectedTranslateY, expected.trajectory.layoutToleranceVp) : null);
    check('trace', 'release-prepublication-order', first.index,
      { pointerFrameTimeNs: pointerFrame?.frameTimeNs ?? null, firstFrameTimeNs: first.frameTimeNs,
        pointerCaptureEndMs: pointerFrame?.captureEndMs ?? null, firstCaptureStartMs: first.captureStartMs },
      'one later native frame after the last sampled pointer is published',
      fields(pointerFrame, ['frameTimeNs', 'captureEndMs']) && fields(first, ['frameTimeNs', 'captureStartMs']) ?
        first.frameTimeNs > pointerFrame.frameTimeNs && first.captureStartMs >= pointerFrame.captureEndMs : null);
  }
  // Morphing preserves dock opacity. A causally bounded shell height reveals
  // the rendered expansion, with the other actors still checked independently.
  const morph = publicationPending ? undefined :
    readUnpublishedMorph({expected, request, first, predecessor, pointerFrame, pointerMotions, boundary});
  return { sequence: request.eventSeq, previousSequence: predecessor?.eventSeq ?? null,
    first: { frame: first.index, delayMs, shellYVp: shell?.layoutRectVp?.y ?? null, nativeId: shell?.uniqueId ?? null },
    lastPointer: pointerFrame ? { frame: pointerFrame.index, ticket: pointerFrame.runtimeTicket,
      shellYVp: pointerShell?.layoutRectVp?.y ?? null, nativeId: pointerShell?.uniqueId ?? null } : null,
    nativePublication: { pending: publicationPending || morph !== undefined, nativeVisibility: nativeVisibility ?? null,
      pointerVisibility: pointerVisibility ?? null, ...morph },
    ...boundary };
}

function grabberMovePath(move, expected) {
  const {direction,source,target} = move?.payload ?? {};
  return typeof direction === 'string' && [source,target].every(location =>
    LOCATION_KEYS.every(key => typeof location?.[key] === 'string')) ? direction === 'morph' &&
      equalLocation(source,expected.nativeSource) && equalLocation(target,expected.source) : null;
}

function grabberCancelApplicability(events, sample, sampleOrder, problems, expected) {
  const requests = events.filter(event => event.kind === 'reading.control-transition-requested');
  const cancelled = requests.filter(event => event.payload.origin === 'grabber-cancel');
  const interrupted = events.filter(event => event.kind === 'reading.control-transition-interrupted');
  const moves = requests.filter(event => event.payload.origin === 'grabber-move');
  const cancellation = interrupted.find(event => event.payload.origin === 'grabber-cancel' &&
    moves.some(move => move.eventSeq < event.eventSeq && move.payload.transitionId === event.payload.transitionId));
  if (cancelled.length || cancellation) return {
    status:'APPLIES', reason:'The current reading drag reported a platform Cancel', evidence:[...cancelled,cancellation],
  };

  const ups = requests.filter(event => event.payload.origin === 'grabber-release');
  const up = ups.length === 1 ? ups[0] : undefined;
  const observed = up?.payload;
  const boundary = observed?.releaseMotion?.boundary;
  const move = up && moves.findLast(event => event.eventSeq < up.eventSeq);
  const retirements = move ? interrupted.filter(event => event.payload.transitionId === move.payload.transitionId) : [];
  const [retired] = retirements;
  const commits = up ? events.filter(event => event.kind === 'reading.control-transition-committed' &&
    event.payload.transitionId === observed.transitionId && event.eventSeq > up.eventSeq) : [];
  const [commit] = commits;
  const pointer = move?.payload.accepted?.heldPointerId;
  const epoch = move?.payload.accepted?.epoch;
  const releasedEpoch = observed?.accepted?.epoch;
  if (sampleOrder && sample?.captureComplete === true && !problems?.length && grabberMovePath(move,expected) === true &&
      seq(pointer) && seq(epoch) &&
      seq(releasedEpoch) && releasedEpoch > epoch && boundary?.pointerId === pointer &&
      observed.before?.heldPointerId === pointer && observed.before.epoch === epoch &&
      boundary.held?.heldPointerId === pointer && boundary.held.epoch === epoch &&
      boundary.released?.heldPointerId === -1 && boundary.released.epoch === releasedEpoch &&
      observed.accepted.heldPointerId === -1 && retirements.length === 1 &&
      move.eventSeq < retired.eventSeq && retired.eventSeq < up.eventSeq && retired.payload.origin === 'grabber-release' &&
      retired.payload.epoch === epoch && retired.payload.successorEpoch === releasedEpoch &&
      retired.payload.heldPointerId === -1 && equalLocation(retired.payload.successorTarget, observed.target) &&
      commits.length === 1 && commit.payload.origin === 'grabber-release' &&
      commit.payload.state?.epoch === releasedEpoch && commit.payload.state.heldPointerId === -1 &&
      commit.payload.state.transition === '' && equalLocation(commit.payload.target, observed.target) &&
      [expected.source, expected.target].some(target => equalLocation(target, observed.target)) &&
      contentMatches(stableContent(sample, observed.target, expected.endpointOpacityTolerance), observed.target) === true) {
    return { status:'DOES_NOT_APPLY', reason:'The same held drag ended with a verified UP and native endpoint',
      evidence:[move,retired,up,commit,sample] };
  }
  return { status:'UNKNOWN', reason:'No verified platform terminal for the current grabber drag', evidence:[] };
}

function evaluateCancelBoundary({check, expected, request, commits, ownerEvents}) {
  const cancel = request.payload;
  const moves = ownerEvents.filter(event => event.kind === 'reading.control-transition-requested' &&
    event.payload.origin === 'grabber-move' && event.eventSeq < request.eventSeq);
  const predecessor = moves.at(-1);
  const predecessorId = predecessor?.payload.transitionId;
  const identified = id => typeof id === 'string' && id.length > 0;
  const preceding = identified(predecessorId) ? ownerEvents.filter(event => event.payload.transitionId === predecessorId) : [];
  const retirements = preceding.filter(event => event.kind === 'reading.control-transition-interrupted');
  const [retired] = retirements;
  const priorTarget = cancel.cancelMotion?.priorTarget;
  const held = cancel.cancelMotion?.held;
  const cancelled = cancel.cancelMotion?.cancelled;
  const motion = ownerEvents.filter(event => event.kind === 'reading.control-motion');
  const finalHeld = motion.filter(event => identified(predecessorId) && event.payload.transitionId === predecessorId &&
    event.payload.finalBlock === true && event.payload.endReason === 'interrupted' && event.payload.droppedSamples === 0 &&
    seq(event.payload.blockIndex) && event.payload.blockCount === event.payload.blockIndex + 1 &&
    event.payload.frames?.length === 1 && event.payload.frames[0].index === event.payload.blockIndex &&
    event.payload.frames[0].phase === 'pointer');
  const pointerFrame = finalHeld.length === 1 ? finalHeld[0].payload.frames[0] : undefined;
  const incoming = motion.filter(event => identified(cancel.transitionId) && event.payload.transitionId === cancel.transitionId &&
    event.payload.blockIndex === 0 && event.payload.frames?.length === 1 && event.payload.frames[0].index === 0);
  const first = incoming.length === 1 ? incoming[0].payload.frames[0] : undefined;
  const commit = commits.length === 1 ? commits[0].payload : undefined;
  const heldOwner = predecessor?.payload.accepted;

  check('owner', 'cancel-transition-identity', null, cancel.transitionId, predecessorId,
    identified(cancel.transitionId) && identified(predecessorId) ? cancel.transitionId !== predecessorId : null);
  check('owner', 'cancel-held-morph', null, predecessor?.payload,
    {direction:'morph',source:expected.nativeSource,target:expected.source}, grabberMovePath(predecessor,expected));
  check('owner', 'cancel-no-up', null, cancel.releaseMotion, null, cancel.releaseMotion == null &&
    !ownerEvents.some(event => event.kind === 'reading.control-transition-requested' &&
      event.payload.origin === 'grabber-release' && event.payload.before?.epoch === cancel.before?.epoch));
  check('owner', 'cancel-prior-target', null, priorTarget, expected.target,
    LOCATION_KEYS.every(key => typeof priorTarget?.[key] === 'string') ? equalLocation(priorTarget, expected.target) : null);
  check('owner', 'cancel-retired-held-epoch', null, retired?.payload, cancel.accepted?.epoch,
    retired && heldOwner ? retirements.length === 1 && predecessor.eventSeq < retired.eventSeq &&
      retired.eventSeq < request.eventSeq && retired.payload.origin === 'grabber-cancel' &&
      heldOwner.epoch === cancel.before?.epoch && retired.payload.epoch === heldOwner.epoch &&
      retired.payload.successorEpoch === cancel.accepted?.epoch && retired.payload.heldPointerId === -1 &&
      equalLocation(retired.payload.successorTarget, expected.target) : null);
  const stale = preceding.filter(event => event.kind === 'reading.control-transition-committed');
  check('owner', 'cancel-obsolete-commit', null, stale.map(event => event.eventSeq), [], stale.length === 0);
  check('owner', 'cancel-commit-target', null, commit?.target, expected.target,
    LOCATION_KEYS.every(key => typeof commit?.target?.[key] === 'string') && typeof commit.origin === 'string' ?
      commit.origin === 'grabber-cancel' && equalLocation(commit.target, expected.target) : null);
  check('owner', 'cancel-pointer-owner', null, [held?.heldPointerId,cancelled?.heldPointerId], heldOwner?.heldPointerId,
    [held?.heldPointerId,cancelled?.heldPointerId,heldOwner?.heldPointerId,cancel.before?.heldPointerId,
      cancel.accepted?.heldPointerId].every(Number.isSafeInteger) ?
      seq(held.heldPointerId) && held.heldPointerId === heldOwner.heldPointerId &&
      held.heldPointerId === cancel.before.heldPointerId && cancelled.heldPointerId === -1 &&
      cancel.accepted.heldPointerId === -1 : null);
  check('owner', 'cancel-ticket-handoff', null, [held?.ticket,cancelled?.ticket], 'a new ticket for the successor epoch',
    [held?.ticket,cancelled?.ticket,held?.epoch,cancelled?.epoch,cancel.before?.epoch,cancel.accepted?.epoch].every(seq) ?
      cancelled.ticket > held.ticket && held.epoch === cancel.before.epoch &&
      cancelled.epoch === cancel.accepted.epoch && cancelled.epoch > held.epoch : null);

  const { layoutToleranceVp, transformTolerance } = expected.trajectory;
  const start = finite(cancel.transition?.startProgress) ? visualThrough(cancel.transition, cancel.transition.startProgress) : null;
  const poseFields = [...VISUAL_KEYS, 'pointerWindowYVp', 'grabberScreenYVp'];
  check('runtime', 'cancel-held-expansion', null, held?.expansionProgress, 'nonzero held expansion',
    finite(held?.expansionProgress) ? held.expansionProgress > 0 && held.expansionProgress <= 1 : null);
  check('runtime', 'cancel-retarget-continuity', null, cancelled, {held,start},
    fields(held,poseFields) && fields(cancelled,poseFields) && fields(start,VISUAL_KEYS) ?
      near(cancelled.pointerWindowYVp,held.pointerWindowYVp,transformTolerance) &&
      near(cancelled.grabberScreenYVp,held.grabberScreenYVp,layoutToleranceVp) &&
      VISUAL_KEYS.every(key => near(cancelled[key],held[key],transformTolerance) && near(cancelled[key],start[key],transformTolerance)) : null);

  const shell = actorMap(first ?? {}).shell;
  const pointerShell = actorMap(pointerFrame ?? {}).shell;
  check('owner', 'cancel-native-pointer-owner', pointerFrame?.index ?? null, pointerFrame?.heldPointerId, held?.heldPointerId,
    Number.isSafeInteger(pointerFrame?.heldPointerId) && seq(held?.heldPointerId) && seq(held?.ticket) &&
    seq(pointerFrame.runtimeTicket) && seq(pointerFrame.runtimeEpoch) ? pointerFrame.heldPointerId === held.heldPointerId &&
      pointerFrame.runtimeEpoch === held.epoch && pointerFrame.runtimeTicket <= held.ticket : null);
  check('runtime', 'cancel-native-upward-path', pointerFrame?.index ?? null, pointerFrame?.pointerWindowYVp,
    pointerFrame?.pointerStartWindowYVp,
    fields(pointerFrame,['pointerWindowYVp','pointerStartWindowYVp','expansionProgress']) ?
      pointerFrame.pointerWindowYVp < pointerFrame.pointerStartWindowYVp && pointerFrame.expansionProgress > 0 : null);
  check('owner', 'cancel-native-pointer-released', first?.index ?? null, first?.heldPointerId, -1,
    Number.isSafeInteger(first?.heldPointerId) ? first.heldPointerId === -1 : null);
  check('runtime', 'cancel-no-release-slope', first?.index ?? null, first?.continuationSlope, null,
    first ? first.continuationSlope === undefined : null);
  check('shell', 'cancel-native-continuity', first?.index ?? null, shell?.uniqueId, pointerShell?.uniqueId,
    seq(shell?.uniqueId) && shell.mounted && seq(pointerShell?.uniqueId) && pointerShell.mounted ?
      shell.uniqueId === pointerShell.uniqueId : null);
  check('trace', 'cancel-native-pointer-before-request', pointerFrame?.index ?? null, pointerFrame?.captureEndMs, request.deviceMonoMs,
    finite(pointerFrame?.captureStartMs) && finite(pointerFrame?.captureEndMs) && finite(request.deviceMonoMs) ?
      pointerFrame.captureStartMs <= pointerFrame.captureEndMs && pointerFrame.captureEndMs <= request.deviceMonoMs : null);
  const delayMs = finite(first?.captureStartMs) && finite(request.deviceMonoMs) ? first.captureStartMs - request.deviceMonoMs : null;
  check('trace', 'first-cancel-observation', first?.index ?? null, {phase:first?.observationPhase,delayMs,ticket:first?.runtimeTicket},
    {phase:'before-runtime-publication',maximumDelayMs:expected.maximumFrameGapMs,ticket:cancelled?.ticket},
    delayMs !== null && delayMs >= 0 && delayMs <= expected.maximumFrameGapMs &&
    first.observationPhase === 'before-runtime-publication' && seq(cancelled?.ticket) && first.runtimeTicket === cancelled.ticket ? true : null);
  return { sequence:request.eventSeq, previousSequence:predecessor?.eventSeq ?? null, priorTarget, held, cancelled,
    lastPointer: pointerFrame ? {frame:pointerFrame.index,ticket:pointerFrame.runtimeTicket,nativeId:pointerShell?.uniqueId ?? null} : null,
    first: first ? {frame:first.index,delayMs,nativeId:shell?.uniqueId ?? null} : null };
}

function trajectoryFrames(blocks) {
  return blocks.filter(block => Array.isArray(block.frames) && block.frames.length === 1 &&
    block.frames[0]?.index === block.frameStart && block.frameStart === block.frameEnd &&
    block.blockIndex === block.frameStart).map(block => block.frames[0]).sort((a, b) => a.index - b.index);
}

function completeTrajectoryBlocks(blocks, frames, request, endReason) {
  const count = blocks.find(block => block.finalBlock === true)?.blockCount;
  return seq(count) && count > 0 && blocks.length === count && frames.length === count &&
    blocks.every((block, i) => block.blockIndex === i && block.blockCount === count &&
      block.finalBlock === (i + 1 === count) && block.endReason === endReason && block.droppedSamples === 0 &&
      block.epoch === request.accepted.epoch && block.direction === request.direction && block.origin === request.origin &&
      equalLocation(block.target, request.target));
}

function evaluateTrajectory({ check, expected, request, motions, rebases, before, after, interruptions,
  releasePredecessor, pointerOffsetVp = 0 }) {
  const wanted = expected.trajectory;
  const source = request.payload;
  const normalRebases = rebases.sort((a, b) => a.eventSeq - b.eventSeq);
  const blocks = motions.map(event => event.payload);
  const final = blocks.find(block => block.finalBlock === true);
  const endReason = expected.outcome === 'interrupted' ? 'interrupted' : 'completed';
  const frames = trajectoryFrames(blocks);
  const last = frames.at(-1);
  const knownCount = final?.blockCount;
  const validBlocks = completeTrajectoryBlocks(blocks, frames, source, endReason);
  check('trace', 'complete-blocks', null, frames.length, knownCount ?? null, validBlocks ? true : null);
  if (!frames.length) return { frameCount: 0, transitionId: source.transitionId };

  const density = before?.window?.density;
  const stageAnchor = beforeStage(before);
  const afterAnchor = beforeStage(after);
  const anchorBound = stageAnchor && afterAnchor && vector(afterAnchor, stageAnchor, wanted.layoutToleranceVp);
  check('trace', 'native-stage-anchor', frames[0].index, afterAnchor, stageAnchor, anchorBound ? true : null);
  const duration = wanted.runtimeDurationMs ?? source.durationMs;
  const first = frames[0];
  const interior = frames.filter(frame => frame.phase === 'progress' || frame.phase === 'pointer');
  if (source.durationMs > 0 || expected.outcome === 'interrupted') {
    const minimum = expected.minimumInteriorFrames ?? 1;
    check('trace', 'sampled-interior', first.index, interior.length, minimum, interior.length >= minimum ? true : null);
  }
  const releaseBoundary = expected.requireReleaseObservation && (!expected.gestureCrossover || releasePredecessor) ?
    evaluateReleaseBoundary({check, expected, request, first, ...releasePredecessor}) : null;
  const phase = expected.outcome === 'interrupted' ? 'interrupted' : 'endpoint';
  check('trace', 'last-phase', last.index, phase === 'interrupted' ? final?.endReason : last.phase, phase,
    (phase === 'interrupted' ? final?.endReason : last.phase) === phase ? true : null);

  const used = new Set();
  const ids = new Map();
  let acceptedTransition = source.transition;
  if (acceptedTransition !== undefined) acceptedTransition = { ...acceptedTransition, durationMs: duration };
  let activeRebase;
  let prior;
  let currentLayout;
  let nativeEnd;
  let firstModuleMountFrame = null;
  const preAdmissionFrames = [];
  for (const frame of frames) {
    const i = frame.index;
    const pointer = frame.phase === 'pointer';
    const endpoint = frame.phase === 'endpoint';
    check('runtime', 'epoch', i, frame.runtimeEpoch, source.accepted.epoch,
      seq(frame.runtimeEpoch) ? frame.runtimeEpoch === source.accepted.epoch : null);
    if (pointer && source.origin === 'grabber-move' && seq(source.accepted.heldPointerId) && Number.isSafeInteger(frame.heldPointerId)) {
      check('owner', 'held-pointer-owner', i, frame.heldPointerId, source.accepted.heldPointerId,
        frame.heldPointerId === source.accepted.heldPointerId);
    }
    check('runtime', 'density', i, frame.density, density,
      finite(frame.density) && finite(density) ? near(frame.density, density, .001) : null);
    const monotonicallySampled = finite(frame.frameTimeNs) && (!prior || frame.frameTimeNs > prior.frameTimeNs) &&
      finite(frame.captureStartMs) && finite(frame.captureEndMs) && frame.captureEndMs >= frame.captureStartMs;
    check('runtime', 'native-sample-clock', i, frame.frameTimeNs, 'one increasing FrameCallback clock', monotonicallySampled ? true : null);
    if (!pointer && !seq(frame.runtimeTicket)) {
      check('runtime', 'ticket', i, frame.runtimeTicket, 'current runtime ticket', null);
    }
    if (seq(prior?.runtimeTicket) && seq(frame.runtimeTicket) && frame.runtimeTicket < prior.runtimeTicket) {
      check('runtime', 'ticket-order', i, frame.runtimeTicket, prior.runtimeTicket, false);
    }
    if (!prior || frame.runtimeTicket !== prior.runtimeTicket) {
      let ticketBehind = prior?.runtimeTicket ?? Math.min(frame.runtimeTicket, ...normalRebases.map(event => event.payload.fromTicket));
      const start = ticketBehind;
      let restored = new Set();
      while (ticketBehind < frame.runtimeTicket) {
        const matches = normalRebases.filter(event => event.payload.fromTicket === ticketBehind);
        const event = matches.length === 1 ? matches[0] : undefined;
        const information = event?.payload;
        if (!information || information.epoch !== frame.runtimeEpoch ||
          !seq(information.toTicket) || information.toTicket <= ticketBehind || information.toTicket > frame.runtimeTicket ||
          !information.before?.transition || !information.after?.transition) break;
        if (used.has(event.eventSeq)) break;
        used.add(event.eventSeq);
        const previous = prior?.runtimeTicket === ticketBehind ? prior : undefined;
        if (!verifyRebase(check,event,frame,{
          previous,earlier:nativeEnd,incoming:activeRebase,transition:acceptedTransition,expectation:wanted,request,
        })) break;
        restored.add(event.eventSeq);
        ticketBehind = information.toTicket;
        activeRebase = information;
        acceptedTransition = information.after.transition;
      }
      const changesLayout = prior && currentLayout && layoutInputsValid(frame.layoutInputs) &&
        Object.keys(currentLayout).some(key => !near(currentLayout[key], frame.layoutInputs[key], wanted.layoutToleranceVp));
      if (!pointer && ticketBehind < frame.runtimeTicket) {
        check('runtime', 'layout-rebase-chain', i, { start, end: frame.runtimeTicket, events: [...restored] },
          'one current rebase record per changed ticket', null);
        acceptedTransition = undefined;
        activeRebase = undefined;
      }
      if (changesLayout && !restored.size) {
        // A different ticket can legitimately change layout. Without its
        // causal proof, the new geometry remains unverified.
        check('runtime', 'layout-input-ticket', i, frame.layoutInputs, currentLayout, null);
      }
      currentLayout = frame.layoutInputs;
    }
    if (layoutInputsValid(currentLayout) && layoutInputsValid(frame.layoutInputs)) {
      const sameLayout = Object.keys(currentLayout).every(key => near(currentLayout[key], frame.layoutInputs[key], wanted.layoutToleranceVp));
      check('runtime', 'layout-inputs', i, frame.layoutInputs, currentLayout, sameLayout);
    } else check('runtime', 'layout-inputs', i, frame.layoutInputs ?? null, 'complete measured layout inputs', null);

    if (!pointer && nativeEnd && prior?.runtimeTicket === frame.runtimeTicket && nativeEnd.runtimeTicket === frame.runtimeTicket &&
        nativeEnd.index + 1 === prior.index && prior.index + 1 === i) {
      const wantElapsed = fields(prior,['runtimeElapsedMs','runtimeTickMs']) && finite(nativeEnd.runtimeTickMs) ?
        prior.runtimeElapsedMs + prior.runtimeTickMs - nativeEnd.runtimeTickMs : null;
      check('runtime', 'elapsed-monotonic', i, frame.runtimeElapsedMs, wantElapsed,
        finite(frame.runtimeElapsedMs) && finite(wantElapsed) ? near(frame.runtimeElapsedMs, wantElapsed, .01) : null);
    }
    const validSlope = frame.continuationSlope === undefined || (
      finite(frame.continuationSlope) && frame.continuationSlope >= 0 && frame.continuationSlope <= 3);
    let positionFromPointer = null;
    if (pointer && acceptedTransition && finite(pointerOffsetVp) && layoutInputsValid(frame.layoutInputs) &&
      fields(frame, ['pointerWindowYVp','pointerStartWindowYVp'])) {
      const travel = (frame.layoutInputs.quickHeightVp - frame.layoutInputs.fullHeightVp) *
        (acceptedTransition.to.expansionProgress - acceptedTransition.from.expansionProgress) +
        wanted.dockTravelVp * (acceptedTransition.from.visibilityProgress - acceptedTransition.to.visibilityProgress);
      if (Math.abs(travel) > Number.EPSILON) {
        positionFromPointer = clamp((frame.pointerWindowYVp - frame.pointerStartWindowYVp - pointerOffsetVp) / travel);
      }
    }
    if (pointer) {
      check('runtime', 'physical-pointer-path', i, frame.runtimeProgress, positionFromPointer,
        finite(positionFromPointer) && finite(frame.runtimeProgress) ?
          near(positionFromPointer, frame.runtimeProgress, wanted.transformTolerance) : null);
    }
    const progress = pointer ? positionFromPointer : endpoint ? acceptedTransition?.targetProgress :
      acceptedTransition && fields(acceptedTransition, ['durationMs','startProgress','targetProgress']) &&
      acceptedTransition.durationMs > 0 && validSlope && finite(frame.runtimeElapsedMs) ?
      motionCurve(source.direction, acceptedTransition, frame.runtimeElapsedMs, frame.continuationSlope) : null;
    const visual = finite(progress) ? visualThrough(acceptedTransition, progress) : null;
    if (!pointer && !endpoint) {
      check('runtime', 'duration-ms', i, frame.runtimeDurationMs, acceptedTransition?.durationMs,
        finite(frame.runtimeDurationMs) && finite(acceptedTransition?.durationMs) ?
          near(frame.runtimeDurationMs, acceptedTransition.durationMs, .01) : null);
    }
    if (visual) for (const key of ['expansionProgress', 'visibilityProgress']) {
      // ArkUI's cubic curve is sampled through its native opacity path. Reuse
      // the Phase 0 curve tolerance for visibility; the pure morph clock has
      // the tighter transform-side progress bound.
      const tolerance = key === 'visibilityProgress' ? wanted.opacityTolerance : wanted.transformTolerance;
      check('runtime', key, i, frame[key], visual[key], finite(frame[key]) ? near(frame[key], visual[key], tolerance) : null);
    }
    else check('runtime', 'documented-curve', i, frame.runtimeProgress, 'current position on sourced clock and spatial path', null);

    const offset = compensationOffset(activeRebase?.after?.compensation,frame.runtimeElapsedMs,source.direction);
    check('runtime', 'layout-compensation', i, frame.runtimeLayoutOffsetVp, offset,
      finite(frame.runtimeLayoutOffsetVp) && finite(offset) && acceptedTransition ?
        near(frame.runtimeLayoutOffsetVp, offset, wanted.layoutToleranceVp) : null);
    const publication = releaseBoundary?.nativePublication;
    let renderedVisual = visual;
    if (publication?.pending === true && i === first.index) {
      if (finite(publication.nativeExpansion)) renderedVisual = { ...visual, expansionProgress: publication.nativeExpansion };
      else if (finite(publication.nativeVisibility)) renderedVisual = { ...visual, visibilityProgress: publication.nativeVisibility };
    }
    const geometry = projectedActors(frame.layoutInputs, renderedVisual, offset, wanted);
    const expectedContent = source.target.level === 'hidden' ? source.source : source.target;
    check('module', 'app-route', i, frame.content ?? null, expectedContent,
      frame.content ? equalLocation(frame.content, expectedContent) : null);
    const selected = actorMap(frame);
    if (i === 0 && source.direction === 'open' && Object.values(selected).every(actor => actor?.mounted === false)) {
      prior = frame;
      continue;
    }
    const projection = geometry && stageAnchor && anchorBound ?
      [stageAnchor[0] + frame.layoutInputs.dockLeftVp, stageAnchor[1] + frame.layoutInputs.dockTopVp] : null;
    const y = renderedVisual && wanted.dockTravelVp * (1 - renderedVisual.visibilityProgress);
    for (const [role, actor] of Object.entries(selected)) {
      if (!actor || actor.mounted !== true || actor.missing || !seq(actor.uniqueId)) {
        check(role, 'native-mount', i, actor ?? null, 'one attached native node', null);
        continue;
      }
      if (!ids.has(role)) ids.set(role, actor.uniqueId);
      check(role, 'native-mount', i, actor.uniqueId, ids.get(role), actor.uniqueId === ids.get(role));
      const box = actor.layoutRectVp;
      const relative = geometry?.[role];
      const intended = projection && relative ? [
        projection[0] + relative[0], projection[1] + relative[1], relative[2], relative[3],
      ] : null;
      check(role, 'layout-rect-vp', i, box ?? null, intended, intended &&
        vector([box?.x, box?.y, box?.width, box?.height], intended, wanted.layoutToleranceVp));
      const origin = actor.windowOriginVp;
      const desiredOrigin = intended && renderedVisual ? [intended[0], intended[1] + y] : null;
      check(role, 'window-origin-vp', i, origin ?? null, desiredOrigin, desiredOrigin &&
        vector([origin?.x, origin?.y], desiredOrigin, wanted.layoutToleranceVp));
      const translate = actor.translateVp;
      const desiredTranslate = renderedVisual ? [0, role === 'dock' ? y : 0, 0] : null;
      check(role, 'transform-translation', i, translate ?? null, desiredTranslate,
        desiredTranslate && vector([translate?.x, translate?.y, translate?.z], desiredTranslate, wanted.layoutToleranceVp));
      const scale = actor.scale;
      check(role, 'transform-scale', i, scale ?? null, [1, 1, 1], fields(scale, ['centerX','centerY']) ?
        vector([scale.x, scale.y, scale.z], [1, 1, 1], wanted.transformTolerance) : null);
      const rotation = actor.rotation;
      check(role, 'transform-rotation', i, rotation ?? null, 0, fields(rotation, ['x','y','z','centerX','centerY','angle']) ?
        near(rotation.angle, 0, wanted.transformTolerance) : null);
      check(role, 'transform-matrix', i, actor.matrix ?? null, MATRIX, vector(actor.matrix, MATRIX, wanted.transformTolerance));
      const opacity = role === 'dock' ? renderedVisual?.visibilityProgress : 1;
      check(role, 'opacity', i, actor.opacity ?? null, opacity, finite(actor.opacity) && finite(opacity) ?
        near(actor.opacity, opacity, wanted.opacityTolerance) : null);
      const ancestors = completeAncestors(actor);
      const expectedZ = role === 'grabber' ? 3 : 0;
      const topology = role === 'dock' || (role === 'content' ?
        ancestors?.some(node => node.uniqueId === selected.clip?.uniqueId) &&
          ancestors?.some(node => node.uniqueId === selected.dock?.uniqueId) : actor.parentUniqueId === selected.dock?.uniqueId);
      check(role, 'stacking', i, { z: actor.zIndex ?? null, parent: actor.parentUniqueId ?? null },
        { z: expectedZ, dock: selected.dock?.uniqueId ?? null, clip: selected.clip?.uniqueId ?? null },
        ancestors && finite(actor.zIndex) && actor.inspectorSource === 'FrameNode.getInspectorInfo' ?
          Boolean(topology) && actor.zIndex === expectedZ : null);
      const nativeClip = role === 'clip';
      const expectedRadius = renderedVisual ?
        wanted.quickCornerVp + wanted.cornerDeltaVp * renderedVisual.expansionProgress : null;
      const clipResult = typeof actor.clipToFrame === 'boolean' &&
        ancestors?.every(node => typeof node.clipToFrame === 'boolean' &&
          (!node.clipToFrame || fields(node.measuredSizeVp, ['x','y','width','height'])));
      check(role, 'clip', i, { clipToFrame: actor.clipToFrame ?? null, radius: actor.borderRadiusVp ?? null },
        { clipToFrame: nativeClip, radius: nativeClip ? expectedRadius : null },
        clipResult && (!nativeClip || (finite(actor.borderRadiusVp) && finite(expectedRadius))) ?
          actor.clipToFrame === nativeClip && (!nativeClip ||
          near(actor.borderRadiusVp, expectedRadius, wanted.layoutToleranceVp)) : null);
    }
    const content = frame.mountedContent;
    const beforeAdmission = source.direction === 'open' && !ids.has('module') && !endpoint &&
      frame.contentAdmitted === false && content?.mounted === false;
    const attached = frame.attachedContentIds;
    if (Array.isArray(attached)) {
      const planned = beforeAdmission ? [] : [moduleId(expectedContent)];
      const correct = attached.length === planned.length && attached.every((id, index) => id === planned[index]);
      check('module', 'attached-content-set', i, attached, planned,
        beforeAdmission || attached.length > 0 ? correct : null);
    }
    if (beforeAdmission) {
      preAdmissionFrames.push(i);
      nativeEnd = prior;
      prior = frame;
      continue;
    }
    const contentAncestors = completeAncestors(content);
    const knownCandidate = content?.mounted === true && seq(content.uniqueId);
    if (knownCandidate && !ids.has('module')) {
      ids.set('module', content.uniqueId);
      firstModuleMountFrame = i;
    }
    check('module', 'native-content', i, knownCandidate ? { id: content.id, uniqueId: content.uniqueId } : null,
      { id: moduleId(expectedContent), uniqueId: ids.get('module') ?? null }, knownCandidate && contentAncestors ?
        content.id === moduleId(expectedContent) && content.uniqueId === ids.get('module') &&
        contentAncestors.some(node => node.uniqueId === selected.content?.uniqueId) &&
        contentAncestors.some(node => node.uniqueId === selected.clip?.uniqueId) : null);
    nativeEnd = prior;
    prior = frame;
  }
  const gaps = frames.slice(1).flatMap((frame, i) => frame.index === frames[i].index + 1 ?
    [{ index: frame.index, ms: (frame.frameTimeNs - frames[i].frameTimeNs) / 1e6 }] : []);
  const sorted = gaps.map(gap => gap.ms).sort((a,b) => a - b);
  const cadence = sorted[Math.floor(sorted.length / 2)];
  for (const { index, ms } of gaps) {
    const maximum = Math.min(cadence * wanted.cadenceGapFactor, expected.maximumFrameGapMs ?? Infinity);
    check('trace', 'frame-cadence-ms', index, ms, maximum,
      finite(ms) && finite(maximum) && ms > 0 && ms <= maximum ? true : null);
  }
  if (normalRebases.some(event => !used.has(event.eventSeq))) {
    check('runtime', 'unbound-rebase-event', last.index, normalRebases.filter(event => !used.has(event.eventSeq)).map(event => event.eventSeq),
      'each reported rebase bound to one sampled ticket', null);
  }
  return { frameCount: frames.length, blocks: motions.map(event => event.eventSeq), transitionId: source.transitionId,
    preAdmissionFrames, firstModuleMountFrame,
    timings: { sampleCadenceMs: cadence ?? null, lastElapsedMs: last.runtimeElapsedMs },
    interruptionEvents: interruptions.map(event => event.eventSeq), ...(releaseBoundary ? { releaseBoundary } : {}) };
}

function evaluateGrabberReversal(assertion, context) {
  const {expected} = assertion;
  const action = context.actions?.[assertion.action];
  const entry = context.actions?.['enter-reading'];
  const events = context.events ?? [];
  const ready = events.filter(event => entry && event.instanceId === action?.instanceId && event.channel === 'business' &&
    event.kind === 'reading.ready' && event.eventSeq > entry.beforeSeq && event.eventSeq <= entry.afterSeq &&
    ['paged','continuous'].includes(event.payload.mode) && event.payload.localBook === true && event.payload.reduceMotion === false);
  const readingId = ready.length === 1 ? ready[0].payload.readingId : undefined;
  const sameAction = events.filter(event => action && event.instanceId === action.instanceId &&
    event.eventSeq > action.beforeSeq && event.eventSeq <= action.afterSeq && event.payload?.readingId === readingId);
  const moves = sameAction.filter(event => event.channel === 'business' && event.kind === 'reading.control-transition-requested' &&
    event.payload.origin === 'grabber-move');
  const held = moves.length === 1 ? moves[0] : undefined;
  const motion = held ? sameAction.filter(event => event.channel === 'motion' && event.kind === 'reading.control-motion' &&
    event.payload.transitionId === held.payload.transitionId && event.payload.epoch === held.payload.accepted?.epoch) : [];
  const frames = motion.flatMap(({payload}) => payload.frames?.length === 1 && payload.frameStart === payload.blockIndex &&
    payload.frameEnd === payload.blockIndex && payload.frames[0].index === payload.blockIndex ? payload.frames : [])
    .filter(frame => frame.phase === 'pointer' && frame.observationPhase === 'after-pointer-publication')
    .sort((a,b) => a.index-b.index);
  const comparable = frames.filter(frame => fields(frame,['pointerWindowYVp','pointerStartWindowYVp','frameTimeNs']) &&
    layoutInputsValid(frame.layoutInputs));
  const peak = comparable.reduce((point,frame) => !point || frame.pointerWindowYVp < point.pointerWindowYVp ? frame : point, null);
  const distance = GRABBER_DIRECTION_SLOP_VP;
  const lead = peak && comparable.findLast(frame => frame.index < peak.index &&
    peak.pointerWindowYVp + distance < frame.pointerWindowYVp && frame.pointerWindowYVp < frame.pointerStartWindowYVp);
  const retreat = comparable.at(-1);
  const travel = peak && peak.layoutInputs.fullHeightVp - peak.layoutInputs.quickHeightVp;
  const progressAt = y => (peak.pointerStartWindowYVp - y) / travel;
  const landmarks = [lead,peak,retreat];
  const tolerance = expected.trajectory.layoutToleranceVp;
  const calibration = context.samples?.['calibrate-full-state'];
  const baseline = context.samples?.[assertion.baseline];
  const calibrated = action && calibration?.captureComplete === true && baseline?.captureComplete === true &&
    calibration.instanceId === action.instanceId && baseline.instanceId === action.instanceId &&
    calibration.window?.id === baseline.window?.id && calibration.window?.density === baseline.window?.density &&
    seq(calibration.afterSeq) && seq(baseline.beforeSeq) && calibration.afterSeq < baseline.beforeSeq &&
    baseline.afterSeq <= action.beforeSeq &&
    contentMatches(stableContent(calibration,expected.source,expected.endpointOpacityTolerance),expected.source) === true;
  const dispatch = action?.dispatch;
  const verifiedDispatch = dispatch?.state === 'SDK_ACCEPTED' && typeof context.runId === 'string' &&
    context.runId.length > 0 && dispatch.runId === context.runId &&
    action.actionId === `${context.runId}:${assertion.action}` &&
    seq(action.beforeLog) && action.beforeLog > 0 && seq(dispatch.probeSeq) && dispatch.probeSeq === action.beforeLog + 1 &&
    [dispatch.baselineSha256,dispatch.runnerHapSha256].every(digest => typeof digest === 'string' && /^[0-9a-f]{64}$/u.test(digest));
  const bound = verifiedDispatch && action.op === expected.op && action.targetId === ACTORS.grabber &&
    seq(action.beforeSeq) && seq(action.afterSeq) && action.afterSeq > action.beforeSeq && entry?.afterSeq <= action.beforeSeq;
  const sameAxis = landmarks.every(frame => frame && frame.pointerStartWindowYVp === peak.pointerStartWindowYVp &&
    near(frame.runtimeLayoutOffsetVp,peak.runtimeLayoutOffsetVp,tolerance) &&
    Object.keys(peak.layoutInputs).every(key => near(frame.layoutInputs[key],peak.layoutInputs[key],tolerance)));
  const observed = bound && readingId && sameAxis && travel > 0 && lead.frameTimeNs < peak.frameTimeNs &&
    peak.frameTimeNs < retreat.frameTimeNs && retreat.pointerWindowYVp > peak.pointerWindowYVp + distance &&
    progressAt(peak.pointerWindowYVp) < 1 && progressAt(retreat.pointerWindowYVp) > .5;
  const refs = [action,calibration,baseline,...ready,held,...motion].flatMap(record => record?.evidenceRefs ?? []);
  if (!observed) return { expected, verdict:'NOT_RUN', observationsComplete:false, evidenceRefs:refs,
    reason:bound ? 'No sampled upward and returning displacement past the midpoint in the verified reversal action' :
      'No verified one-finger grabber reversal action',
    actual:{actionId:action?.actionId ?? null,verifiedAction:bound === true,reversalInputWitnessed:false,heldFrameCount:frames.length} };

  const missing = [];
  const deviations = [];
  const finding = (actor,field,actual,want,outcome) => {
    if (outcome !== true) (outcome === false ? deviations : missing).push({
      actor, field, frame:null, actual:diagnostic(actual), expected:diagnostic(want),
    });
  };
  finding('native','reversal-calibration',calibration?.afterSeq,'a complete Full calibration before Quick in the same window',
    calibrated ? true : null);
  const yBefore = stableNode(baseline,ACTORS.grabber)?.rectPx?.top;
  const yFull = stableNode(calibration,ACTORS.grabber)?.rectPx?.top;
  finding('native','reversal-calibration-positions',[yFull,yBefore],'the Full grabber is above its Quick position',
    calibrated && finite(yBefore) && finite(yFull) ? yFull < yBefore : null);
  const heldOwner = held.payload.accepted?.heldPointerId;
  const epoch = held.payload.accepted?.epoch;
  const pathEvidence = landmarks.map(frame => ({frame:frame.index, y:frame.pointerWindowYVp, pointer:frame.heldPointerId,
    epoch:frame.runtimeEpoch,ticket:frame.runtimeTicket}));
  const samePointer = landmarks.every(frame => Number.isSafeInteger(frame.heldPointerId) && seq(frame.runtimeEpoch)) &&
    seq(heldOwner) && seq(epoch) ? landmarks.every(frame => frame.heldPointerId === heldOwner && frame.runtimeEpoch === epoch) : null;
  const orderedTickets = landmarks.every(frame => seq(frame.runtimeTicket)) ?
    lead.runtimeTicket < peak.runtimeTicket && peak.runtimeTicket < retreat.runtimeTicket : null;
  finding('owner','reversal-held-path',held.payload, {source:expected.nativeSource,target:expected.source},grabberMovePath(held,expected));
  finding('owner','reversal-single-pointer',pathEvidence,{pointer:heldOwner,epoch},samePointer);
  finding('owner','reversal-advancing-tickets',pathEvidence,'one held epoch with increasing tickets',orderedTickets);

  const releases = sameAction.filter(event => event.channel === 'business' &&
    event.kind === 'reading.control-transition-requested' && event.payload.origin === 'grabber-release');
  const release = releases.length === 1 ? releases[0] : undefined;
  const terminal = release?.payload.releaseMotion?.boundary;
  const beforeUp = terminal?.before;
  const atUp = terminal?.held;
  const terminalPointers = [held.payload.before?.heldPointerId,terminal?.pointerId,beforeUp?.heldPointerId,
    atUp?.heldPointerId,release?.payload.before?.heldPointerId];
  const terminalEpochs = [beforeUp?.epoch,atUp?.epoch,release?.payload.before?.epoch];
  const terminalOwner = seq(heldOwner) && seq(epoch) && terminalPointers.every(Number.isSafeInteger) && terminalEpochs.every(seq) ?
    terminalPointers.every(pointer => pointer === heldOwner) && terminalEpochs.every(stateEpoch => stateEpoch === epoch) : null;
  finding('owner','reversal-up-owner',{pointers:terminalPointers,epochs:terminalEpochs},{pointer:heldOwner,epoch},terminalOwner);
  const latest = frames.at(-1);
  const times = landmarks.map(frame => [frame.captureStartMs,frame.captureEndMs]);
  const withinHold = times.every(([start,end],index) => finite(start) && finite(end) && start <= end &&
    (index === 0 ? start >= held.deviceMonoMs : start >= times[index-1][1])) &&
    finite(latest?.captureEndMs) && finite(release?.deviceMonoMs) && latest.captureEndMs >= times.at(-1)[1] &&
    latest.captureEndMs <= release.deviceMonoMs && seq(latest?.runtimeTicket) && seq(beforeUp?.ticket) &&
    latest.runtimeTicket <= beforeUp.ticket;
  finding('trace','reversal-before-UP',times,[held.deviceMonoMs,release?.deviceMonoMs],withinHold ? true : null);
  const intentRead = finite(beforeUp?.pointerWindowYVp) && finite(atUp?.pointerWindowYVp);
  const endPositions = [beforeUp?.pointerWindowYVp,atUp?.pointerWindowYVp];
  const farthestReturn = Math.max(...comparable.filter(frame => frame.index > peak.index).map(frame => frame.pointerWindowYVp));
  const intentWitnessed = withinHold && intentRead && endPositions.every(y => progressAt(y) > .5 && y > peak.pointerWindowYVp + distance) &&
    retreat.pointerWindowYVp >= farthestReturn - distance && beforeUp.pointerWindowYVp >= farthestReturn - distance &&
    atUp.pointerWindowYVp >= Math.max(farthestReturn,beforeUp.pointerWindowYVp) - distance;
  finding('trace','reversal-release-intent',endPositions,'the same retreat still beyond the midpoint before and at UP',
    intentWitnessed ? true : null);
  const reversalInputWitnessed = samePointer === true && orderedTickets === true && terminalOwner === true && intentWitnessed;
  finding('runtime','reversal-held-progress',[beforeUp?.expansionProgress,atUp?.expansionProgress],endPositions.map(progressAt),
    intentWitnessed && finite(beforeUp.expansionProgress) && finite(atUp.expansionProgress) ?
      [beforeUp,atUp].every(point => near(point.expansionProgress,progressAt(point.pointerWindowYVp),
      expected.trajectory.transformTolerance)) : null);

  const commits = release ? sameAction.filter(event => event.channel === 'business' &&
    event.kind === 'reading.control-transition-committed' && event.eventSeq > release.eventSeq &&
    event.payload.transitionId === release.payload.transitionId) : [];
  const terminalCommit = commits.length === 1 ? commits[0].payload : undefined;
  finding('owner','reversal-commit-target',terminalCommit?.target,expected.target,
    reversalInputWitnessed && LOCATION_KEYS.every(key => typeof terminalCommit?.target?.[key] === 'string') ?
      equalLocation(terminalCommit.target,expected.target) : null);

  for (const role of ['grabber','shell']) {
    const actors = landmarks.map(frame => actorMap(frame)[role]);
    const positions = actors.map(actor => actor?.windowOriginVp?.y);
    finding(role,'reversal-native-displacement',positions,'the same mounted node moves up and then down',
      actors.every(actor => actor?.mounted === true && seq(actor.uniqueId)) && positions.every(finite) ?
        actors.every(actor => actor.uniqueId === actors[0].uniqueId) &&
          positions[0] - positions[1] > tolerance*2 && positions[2] - positions[1] > tolerance*2 : null);
  }

  const scoped = {...context,events:[...ready,...sameAction]};
  const ordinary = {...expected,requireReversalObservation:false};
  const released = evaluateControlTransition({...assertion,expected:ordinary},scoped);
  const pointer = evaluateControlTransition({...assertion,expected:{...ordinary,
    origins:['grabber-move'],source:expected.nativeSource,target:expected.source,nativeTarget:expected.target,
    outcome:'interrupted',commandDurationMs:null,releaseMotion:false,requireReleaseObservation:false,minimumInteriorFrames:3,
  }},scoped);
  deviations.push(...pointer.actual.deviations.filter(item => reversalInputWitnessed || item.field !== 'target-module'));
  missing.push(...pointer.actual.missing);
  // The ordinary release still proves continuity. Its expected Quick outcome
  // is specific to a retreat that survived through UP.
  if (reversalInputWitnessed) deviations.push(...released.actual.deviations);
  missing.push(...released.actual.missing);
  if (context.problems?.length) finding('trace','reversal-journal',context.problems,'one verified command journal',null);
  const observationsComplete = missing.length === 0;
  const firstProblem = deviations[0] ?? missing[0];
  return {expected,verdict:deviations.length ? 'FAIL' : observationsComplete ? 'PASS' : 'NOT_RUN',observationsComplete,
    reason:firstProblem ? `${firstProblem.actor}.${firstProblem.field} ${deviations.length ? 'observed deviation' : 'missing comparable evidence'}` : null,
    evidenceRefs:[...refs,...pointer.evidenceRefs,...released.evidenceRefs],
    actual:{verifiedAction:true,reversalInputWitnessed,landmarks:pathEvidence,pointer:pointer.actual,release:released.actual,deviations,missing} };
}

function evaluateGrabberCrossover({check, expected, action, request, events, motions, before, after}) {
  const release = request.payload;
  const moves = events.filter(event => event.channel === 'business' &&
    event.kind === 'reading.control-transition-requested' && event.payload.origin === 'grabber-move')
    .sort((a,b) => a.eventSeq - b.eventSeq);
  check('owner','crossover-held-requests',null,moves.map(event => event.eventSeq),
    'two actual MOVE requests before UP',moves.length === 2 ? true : moves.length > 2 ? false : null);
  if (moves.length !== 2) return undefined;

  const [morph, dismiss] = moves;
  const chainRequests = events.filter(event => event.channel === 'business' &&
    event.kind === 'reading.control-transition-requested');
  check('owner','crossover-intervening-request',null,chainRequests.map(event => event.eventSeq),
    'only both held epochs and their release were accepted in this action',chainRequests.length === 3);
  const pointer = morph.payload.accepted?.heldPointerId;
  const legs = [morph, dismiss].map(move => {
    const ownEvents = events.filter(event => event.payload.transitionId === move.payload.transitionId);
    const retirements = ownEvents.filter(event => event.channel === 'business' &&
      event.kind === 'reading.control-transition-interrupted');
    const blocks = ownEvents.filter(event => event.channel === 'motion' && event.kind === 'reading.control-motion');
    const rebases = ownEvents.filter(event => event.channel === 'motion' && event.kind === 'reading.control-rebased');
    return {move,retirements,blocks,rebases,frames:trajectoryFrames(blocks.map(event => event.payload))};
  });
  const [collapse, close] = legs;
  const releaseCommit = events.filter(event => event.channel === 'business' &&
    event.kind === 'reading.control-transition-committed');
  check('owner','crossover-unique-hidden-commit',null,releaseCommit.map(event => event.eventSeq),
    'only the release epoch may commit Hidden',releaseCommit.length ? releaseCommit.length === 1 &&
      releaseCommit[0].payload.transitionId === release.transitionId &&
      releaseCommit[0].eventSeq > request.eventSeq &&
      equalLocation(releaseCommit[0].payload.target,expected.target) &&
      releaseCommit[0].payload.origin === release.origin : null);

  const states = [morph.payload.before,morph.payload.accepted,dismiss.payload.before,
    dismiss.payload.accepted,release.before,release.accepted];
  const ids = [morph.payload.transitionId,dismiss.payload.transitionId,release.transitionId];
  const completeChain = ids.every(id => typeof id === 'string' && id.length) &&
    states.every(state => seq(state?.epoch) && seq(state.openRevision) && seq(state.closeRevision) &&
      Number.isSafeInteger(state.heldPointerId) && typeof state.transition === 'string');
  const [original] = states;
  const kinds = ['','morph','morph','dismiss','dismiss','dismiss'];
  check('owner','crossover-pointer-and-epochs',null,{ids,states},'one pointer across two retired epochs before release',
    completeChain ? seq(pointer) && new Set(ids).size === ids.length &&
      states.slice(0,-1).every(state => state.heldPointerId === pointer) && release.accepted.heldPointerId === -1 &&
      states.every((state,index) => state.openRevision === original.openRevision &&
        state.closeRevision === original.closeRevision && state.transition === kinds[index]) &&
      morph.payload.before.epoch < morph.payload.accepted.epoch &&
      morph.payload.accepted.epoch === dismiss.payload.before.epoch &&
      dismiss.payload.before.epoch < dismiss.payload.accepted.epoch &&
      dismiss.payload.accepted.epoch === release.before.epoch && release.before.epoch < release.accepted.epoch &&
      morph.eventSeq < dismiss.eventSeq && dismiss.eventSeq < request.eventSeq && request.eventSeq <= action.afterSeq : null);
  for (const [index,leg] of legs.entries()) {
    const successor = index === 0 ? dismiss : request;
    const [retirement] = leg.retirements;
    const wantedOrigin = index === 0 ? 'grabber-move' : 'grabber-release';
    check('owner','crossover-retirement-' + wantedOrigin,null,leg.retirements.map(event => event.eventSeq),
      'one ordered retirement naming the actual successor',
      leg.retirements.length > 1 ? false : retirement && completeChain ?
        leg.move.eventSeq < retirement.eventSeq && retirement.eventSeq < successor.eventSeq &&
        retirement.payload.origin === wantedOrigin && retirement.payload.epoch === leg.move.payload.accepted.epoch &&
        retirement.payload.successorEpoch === successor.payload.accepted.epoch &&
        retirement.payload.heldPointerId === (index === 0 ? pointer : -1) &&
        equalLocation(retirement.payload.successorTarget,expected.target) : null);
  }
  const morphTransition = morph.payload.transition;
  const correctPath = grabberMovePath(morph,expected);
  check('runtime','crossover-morph-arc',null,morphTransition,'Full to Quick with constant visibility',
    correctPath === null || ![morphTransition?.from,morphTransition?.to].every(frame => fields(frame,VISUAL_KEYS)) ||
      !finite(morphTransition.targetProgress) ? null : correctPath && morphTransition.kind === 'morph' &&
      morphTransition.from.expansionProgress === 1 && morphTransition.to.expansionProgress === 0 &&
      morphTransition.from.visibilityProgress === 1 && morphTransition.to.visibilityProgress === 1 &&
      morphTransition.targetProgress === 1);

  const lastMorph = collapse.frames.at(-1);
  const firstDismiss = close.frames[0];
  const lastDismiss = close.frames.at(-1);
  const firstRelease = trajectoryFrames(motions.map(event => event.payload))[0];
  const knownLayout = layoutInputsValid(lastMorph?.layoutInputs);
  const morphTravelVp = knownLayout ? lastMorph.layoutInputs.fullHeightVp - lastMorph.layoutInputs.quickHeightVp : undefined;
  const dispatch = action.crossoverDrag;
  const measuredDispatch = typeof dispatch?.calibrationSample === 'string' && dispatch.calibrationSample.length > 0 &&
    fields(dispatch,['fromWindowYVp','quickWindowYVp','toWindowYVp']);
  const dockTravel = expected.trajectory.dockTravelVp;
  const tolerance = expected.trajectory.layoutToleranceVp;
  const up = release.releaseMotion?.boundary?.upWindowYVp;
  const heldFrames = [...collapse.frames,...close.frames];
  const coordinates = heldFrames.every(frame => fields(frame,['pointerStartWindowYVp','pointerWindowYVp']));
  check('action','crossover-calibrated-pointer-path',null,dispatch,
    'one replayed drag from Full continuing inside the same-window Quick to Hidden axis',
    measuredDispatch && coordinates && finite(morphTravelVp) && finite(up) ? morphTravelVp > 0 &&
      near(dispatch.quickWindowYVp - dispatch.fromWindowYVp,morphTravelVp,tolerance) &&
      dispatch.toWindowYVp > dispatch.quickWindowYVp && dispatch.toWindowYVp < dispatch.quickWindowYVp + dockTravel &&
      near(up,dispatch.toWindowYVp,tolerance) && heldFrames.every((frame,index) =>
        near(frame.pointerStartWindowYVp,dispatch.fromWindowYVp,tolerance) &&
        (index === 0 || frame.pointerWindowYVp >= heldFrames[index-1].pointerWindowYVp - tolerance)) : null);
  check('trace','crossover-native-move',null,[lastMorph?.index,firstDismiss?.index],
    'both actually held interiors sampled before their retirement',collapse.frames.some(frame =>
      frame.phase === 'pointer' && frame.expansionProgress > 0 && frame.expansionProgress < 1) &&
      close.frames.some(frame => frame.phase === 'pointer' && frame.visibilityProgress > 0 && frame.visibilityProgress < 1) &&
      heldFrames.every(frame => frame.phase === 'pointer' && frame.observationPhase === 'after-pointer-publication' &&
        frame.heldPointerId === pointer) ? true : null);
  for (const [left,right,switchEvent,admitted] of [
    [lastMorph,firstDismiss,collapse.retirements[0],dismiss],
    [lastDismiss,firstRelease,close.retirements[0],request],
  ]) {
    const phase = admitted.payload.origin;
    const frameTimeDelta = (right?.frameTimeNs - left?.frameTimeNs) / 1e6;
    check('trace','crossover-native-clock-' + phase,right?.index ?? null,frameTimeDelta,
      'adjacent native frames bracket the accepted epoch change without a sampling gap',
      fields(left,['frameTimeNs','captureEndMs']) && fields(right,['frameTimeNs','captureStartMs']) &&
        finite(switchEvent?.deviceMonoMs) && finite(admitted.deviceMonoMs) &&
        left.captureEndMs <= switchEvent.deviceMonoMs && switchEvent.deviceMonoMs <= admitted.deviceMonoMs &&
        admitted.deviceMonoMs <= right.captureStartMs && frameTimeDelta > 0 &&
        frameTimeDelta <= expected.maximumFrameGapMs ? true : null);
    const actors = left && right && [actorMap(left),actorMap(right)];
    for (const role of ['dock','shell','grabber']) {
      const [a,b] = actors?.map(actor => actor[role]) ?? [];
      check(role,'crossover-native-identity-' + phase,right?.index ?? null,b?.uniqueId,a?.uniqueId,
        seq(a?.uniqueId) && seq(b?.uniqueId) && a.mounted && b.mounted ? a.uniqueId === b.uniqueId : null);
    }
    const [a,b] = actors?.map(actor => actor.grabber?.windowOriginVp) ?? [];
    const pointerTarget = phase === 'grabber-release' ? up : right?.pointerWindowYVp;
    check('grabber','crossover-native-travel-' + phase,right?.index ?? null,b,a,
      fields(a,['x','y']) && fields(b,['x','y']) && finite(left.pointerWindowYVp) && finite(pointerTarget) ?
        near(b.x,a.x,tolerance) && near(b.y-a.y,pointerTarget-left.pointerWindowYVp,tolerance) : null);
  }
  check('runtime','crossover-common-axis',null,morphTravelVp,'same measured window axis through both segments',
    knownLayout && [firstDismiss,lastDismiss,firstRelease].every(frame => layoutInputsValid(frame?.layoutInputs)) ?
      [firstDismiss,lastDismiss,firstRelease].every(frame => Object.keys(lastMorph.layoutInputs)
        .every(key => near(frame.layoutInputs[key],lastMorph.layoutInputs[key],tolerance))) : null);
  if (!completeChain) return undefined;
  const heldTrajectories = legs.map((leg,index) => evaluateTrajectory({
    check:(actor,field,...values) => check(actor,(index === 0 ? 'held-morph-' : 'held-dismiss-') + field,...values),
    expected:{...expected,outcome:'interrupted',requireReleaseObservation:false},
    request:leg.move,motions:leg.blocks,rebases:leg.rebases,before,after,interruptions:leg.retirements,
    pointerOffsetVp:index === 0 ? 0 : morphTravelVp ?? null,
  }));
  return { predecessor:dismiss,interruption:close.retirements[0],pointerFrame:lastDismiss,
    pointerOffsetVp:morphTravelVp ?? null,heldTrajectories,dispatch };
}

export function evaluateControlTransition(assertion, context) {
  const expected = assertion.expected;
  if (expected.requireReversalObservation) return evaluateGrabberReversal(assertion,context);
  const action = context.actions[assertion.action];
  const first = context.samples[assertion.baseline];
  const last = context.samples[assertion.sample];
  const effects = context.events ?? [];
  const refs = new Map();
  const missing = new Map();
  const deviations = new Map();
  const add = record => {
    for (const ref of record?.evidenceRefs ?? []) if (ref?.path) refs.set(ref.path, ref);
    return record;
  };
  function check(actor, field, frame, actualValue, expectedValue, outcome) {
    const item = { actor, field, frame, actual: diagnostic(actualValue), expected: diagnostic(expectedValue) };
    const id = actor + '.' + field;
    const list = outcome == null ? missing : outcome === false ? deviations : null;
    if (list && !list.has(id)) list.set(id, item);
  }
  const ownerSources = [assertion.source.split('#')[0], ...(expected.ownerSources ?? [])];
  const sources = [...new Set(ownerSources)].map(path => {
    const value = context.candidate?.ownerSources?.[path];
    if (value?.path) refs.set(value.path, value);
    return { path, sha256: typeof value === 'string' ? value : value?.sha256 ?? null };
  });
  const identities = sources.every(item => /^[0-9a-f]{64}$/u.test(item.sha256 ?? ''));
  const declared = ['native-tree', 'window-metrics', 'app-owner', ...(expected.trajectory ? ['debug-frame'] : [])]
    .every(source => assertion.sources.includes(source));
  check('owner', 'deployed-source-identities', null, sources, 'frozen deployed owner SHA-256', identities && declared ? true : null);

  const boundary = action && seq(action.beforeSeq) && seq(action.afterSeq) &&
    typeof action.actionId === 'string' && action.afterSeq > action.beforeSeq;
  check('action', 'operation-boundary', null, action?.op, expected.op,
    boundary ? action.op === expected.op : null);
  if (expected.direction === 'dismiss' && expected.op === 'drag') {
    check('action', 'grabber-target', null, action?.targetId ?? null, ACTORS.grabber,
      boundary && action.targetId ? action.targetId === ACTORS.grabber : null);
  }
  add(action);
  const ownerReady = context.actions['enter-reading'];
  const ready = effects.filter(event => event.kind === 'reading.ready' && event.channel === 'business' &&
    event.instanceId === action?.instanceId && ownerReady && event.eventSeq > ownerReady.beforeSeq &&
    event.eventSeq <= ownerReady.afterSeq && ['paged', 'continuous'].includes(event.payload?.mode)).map(add);
  const readyOwner = ready.length === 1 && ready[0].payload.localBook === true && ready[0].payload.reduceMotion === false ?
    ready[0].payload.readingId : null;
  check('owner', 'ready-local-reading', null, ready.map(event => event.eventSeq), 'one same-session public local reading entry',
    readyOwner ? true : null);
  add(ownerReady);

  const sampleOrder = seq(first?.afterSeq) && seq(last?.beforeSeq) && boundary &&
    first.afterSeq <= action.beforeSeq && action.afterSeq <= last.beforeSeq && first.window?.id === last.window?.id;
  const cancelEvents = expected.requireCancelObservation && identities && declared && boundary && readyOwner &&
    ownerReady.afterSeq <= action.beforeSeq && action.op === 'drag' && action.targetId === ACTORS.grabber ?
    effects.filter(event => event.instanceId === action.instanceId && event.eventSeq > action.beforeSeq &&
      event.eventSeq <= action.afterSeq && event.payload?.readingId === readyOwner) : [];
  let cancelApplicability;
  if (expected.requireCancelObservation) {
    const { evidence, ...observation } = grabberCancelApplicability(cancelEvents.filter(event => event.channel === 'business'),
      last, sampleOrder && first.instanceId === action.instanceId && last.instanceId === action.instanceId, context.problems, expected);
    evidence.forEach(add);
    cancelApplicability = observation;
    if (observation.status !== 'APPLIES') {
      return { actual:{cancelApplicability}, expected, verdict:'NOT_RUN', reason:observation.reason,
        observationsComplete:observation.status === 'DOES_NOT_APPLY', evidenceRefs:[...refs.values()] };
    }
  }

  const within = event => boundary && event.instanceId === action.instanceId &&
    event.eventSeq > action.beforeSeq && event.eventSeq <= (expected.requireCancelObservation ? action.afterSeq :
      Math.max(action.afterSeq, last?.beforeSeq ?? 0));
  const requests = effects.filter(event => event.kind === 'reading.control-transition-requested' &&
    event.channel === 'business' && within(event) && expected.origins.includes(event.payload?.origin) &&
    (!expected.requireCancelObservation || event.payload.readingId === readyOwner)).map(add);
  check('owner', 'one-transition-request', null, requests.map(event => event.eventSeq), expected.origins,
    requests.length === 1 ? true : requests.length > 1 ? false : null);
  const request = requests.length === 1 && readyOwner && requests[0].payload.readingId === readyOwner ? requests[0] : undefined;
  check('owner', 'reading-instance', null, requests[0]?.payload.readingId ?? null, readyOwner, request ? true : null);
  add(first); add(last);
  const nativeSource = expected.nativeSource ?? expected.source;
  const opacityTolerance = expected.endpointOpacityTolerance ?? 0;
  const nativeTarget = expected.nativeTarget ?? expected.target;
  const nativeBefore = first?.instanceId === action?.instanceId ? stableContent(first, nativeSource, opacityTolerance) : null;
  const nativeAfter = last?.instanceId === action?.instanceId ? stableContent(last, nativeTarget, opacityTolerance) : null;
  check('native', 'sample-order', null, { before: first?.afterSeq ?? null, after: last?.beforeSeq ?? null },
    'stable native per-action endpoints in order', sampleOrder ? true : null);
  check('native', 'source-module', null, nativeBefore, nativeSource, contentMatches(nativeBefore, nativeSource));
  check('native', 'target-module', null, nativeAfter, nativeTarget, contentMatches(nativeAfter, nativeTarget));

  let trace;
  let owner;
  let cancelBoundary;
  if (request && identities && declared) {
    const p = request.payload;
    check('owner', 'direction', null, p.direction, expected.direction, p.direction === expected.direction);
    check('owner', 'source-location', null, p.source, expected.source, p.source ? equalLocation(p.source, expected.source) : null);
    check('owner', 'target-location', null, p.target, expected.target, p.target ? equalLocation(p.target, expected.target) : null);
    check('owner', 'transition-epoch', null, p.accepted?.epoch, p.before?.epoch,
      seq(p.before?.epoch) && seq(p.accepted?.epoch) ? p.accepted.epoch > p.before.epoch ||
        (p.accepted.epoch === p.before.epoch && p.durationMs === 0 && p.origin === 'directory-tab') : null);
    const ownerEvents = effects.filter(event => event.instanceId === request.instanceId && event.eventSeq > request.eventSeq &&
      (within(event) || !expected.requireCancelObservation && event.kind === 'reading.control-transition-committed') &&
      event.payload?.readingId === readyOwner && event.payload?.transitionId === p.transitionId).map(add);
    const commits = ownerEvents.filter(event => event.kind === 'reading.control-transition-committed' && event.channel === 'business');
    const interruptions = ownerEvents.filter(event => event.kind === 'reading.control-transition-interrupted' && event.channel === 'business');
    if (expected.requirePlatformCancelDispatch) {
      const dispatches = cancelEvents.filter(event=>event.kind === 'reading.control-grabber-platform-cancel' &&
        event.channel === 'probe').map(add);
      const [dispatch] = dispatches;
      const mark = dispatch?.payload;
      const prior = cancelEvents.findLast(event=>event.eventSeq < (dispatch?.eventSeq ?? 0) &&
        event.kind === 'reading.control-transition-requested' && event.channel === 'business' &&
        event.payload.origin === 'grabber-move');
      check('action','platform-cancel-dispatch',null,mark ?? null,
        'one accepted ArkUI Cancel for the same held pointer, epoch and window before the real callback',
        dispatches.length === 0 ? null : dispatches.length === 1 && mark.transport === 'arkui-send-touch-event' &&
        mark.accepted === true && Number.isSafeInteger(mark.windowId) && mark.windowId > 0 &&
        String(mark.windowId) === first?.window?.id && Number.isSafeInteger(mark.windowRevision) &&
        mark.windowRevision === first?.window?.revision && mark.windowRevision === last?.window?.revision &&
        dispatch.windowRevision === mark.windowRevision && request.windowRevision === mark.windowRevision &&
        dispatch.eventSeq < request.eventSeq && seq(mark.epoch) && mark.epoch === p.before?.epoch &&
        mark.epoch === prior?.payload.accepted?.epoch && seq(mark.pointerId) &&
        mark.pointerId === p.cancelMotion?.held?.heldPointerId && mark.pointerId === prior?.payload.accepted?.heldPointerId);
    }
    if (expected.requireCancelObservation) {
      const observed = cancelEvents.filter(event => event.channel === 'business' ||
        event.channel === 'motion' && event.kind === 'reading.control-motion').map(add);
      cancelBoundary = evaluateCancelBoundary({check,expected,request,commits,ownerEvents:observed});
    }
    if (expected.outcome === 'interrupted') {
      check('owner', 'obsolete-commit', null, commits.map(event => event.eventSeq), [], commits.length === 0);
      const interruption = interruptions.length === 1 ? interruptions[0] : undefined;
      check('owner', 'interruption', null, interruption?.payload, 'same transition revoked by a successor epoch',
        interruption ? interruption.payload.epoch === p.accepted.epoch &&
          interruption.payload.successorEpoch > p.accepted.epoch : null);
    } else {
      const commit = commits.length === 1 ? commits[0] : undefined;
      const state = commit?.payload.state;
      check('owner', 'unique-commit', null, commits.map(event => event.eventSeq), 1,
        commits.length > 0 ? commits.length === 1 : null);
      check('owner', 'committed-state', null, commit?.payload ?? null, expected.target,
        state && last ? equalLocation(commit.payload.target, expected.target) &&
          commit.eventSeq <= last.beforeSeq && state.epoch === p.accepted?.epoch &&
          state.heldPointerId === -1 && state.transition === '' : null);
      if (p.before && state) {
        check('owner', 'open-close-revision', null, [state.openRevision, state.closeRevision],
          [p.before.openRevision + (expected.direction === 'open' ? 1 : 0),
            p.before.closeRevision + (expected.direction === 'dismiss' ? 1 : 0)],
          state.openRevision === p.before.openRevision + (expected.direction === 'open' ? 1 : 0) &&
            state.closeRevision === p.before.closeRevision + (expected.direction === 'dismiss' ? 1 : 0));
      }
    }
    if (expected.requirePanelBack === true) {
      const consumers = effects.filter(event => within(event) && event.channel === 'business' &&
        event.kind === 'reading.control-back-consumer' && event.payload?.readingId === readyOwner).map(add);
      check('owner', 'Back-consumer', null, consumers.map(event => ({seq:event.eventSeq, consumer:event.payload.consumer})),
        'one panel-session Back before the accepted transition', consumers.length === 0 ? null :
          consumers.length === 1 && consumers[0].payload.consumer === 'panel-session' && consumers[0].eventSeq < request.eventSeq);
    }
    if (finite(expected.commandDurationMs)) {
      check('owner', 'command-duration-ms', null, p.durationMs, expected.commandDurationMs,
        finite(p.durationMs) ? near(p.durationMs, expected.commandDurationMs, .01) : null);
    }
    if (expected.trajectory) {
      if (expected.releaseMotion === true) {
        const observedMotion = p.releaseMotion;
        const gesture = p.transition;
        const nominal = expected.trajectory.nominalReleaseDurationMs;
        const speedFactor = finite(observedMotion?.velocityYVpPerSecond) && finite(observedMotion?.travelVp) &&
          observedMotion.travelVp > 0 && finite(nominal) ?
          1 + Math.abs(observedMotion.velocityYVpPerSecond) * nominal / (1000 * observedMotion.travelVp) : null;
        const wantDuration = speedFactor !== null && finite(gesture?.startProgress) && finite(gesture?.targetProgress) ?
          nominal * Math.abs(gesture.targetProgress - gesture.startProgress) / speedFactor : null;
        check('runtime', 'gesture-release-timing', null, p.durationMs, wantDuration,
          finite(wantDuration) && finite(p.durationMs) && p.durationMs > 0 ? near(p.durationMs, wantDuration, .01) : null);
      }
      const motions = ownerEvents.filter(event => event.kind === 'reading.control-motion' && event.channel === 'motion');
      const rebases = ownerEvents.filter(event => event.kind === 'reading.control-rebased' && event.channel === 'motion');
      let releasePredecessor;
      let crossover;
      if (expected.requireReleaseObservation) {
        const sameOwner = event => within(event) && event.payload?.readingId === readyOwner;
        const one = events => events.length === 1 ? add(events[0]) : undefined;
        if (expected.gestureCrossover) {
          crossover = evaluateGrabberCrossover({check,expected,action,request,motions,
            events:effects.filter(sameOwner).map(add),before:first,after:last});
          releasePredecessor = crossover;
        } else {
          const predecessor = one(effects.filter(event => sameOwner(event) && event.channel === 'business' &&
            event.kind === 'reading.control-transition-requested' && event.payload.origin === 'grabber-move'));
          const sameTransition = event => predecessor && sameOwner(event) &&
            event.payload.transitionId === predecessor.payload.transitionId;
          const interruption = one(effects.filter(event => sameTransition(event) && event.channel === 'business' &&
            event.kind === 'reading.control-transition-interrupted' && event.payload.origin === 'grabber-release'));
          const pointerMotions = effects.filter(event => sameTransition(event) && event.channel === 'motion' &&
            event.kind === 'reading.control-motion');
          const pointerBlock = pointerMotions.filter(event => event.payload.finalBlock === true &&
            event.payload.endReason === 'interrupted' && event.payload.frames?.length === 1 &&
            event.payload.frames[0].phase === 'pointer');
          releasePredecessor = { predecessor, interruption, pointerFrame: one(pointerBlock)?.payload.frames[0],
            pointerMotions: expected.direction === 'morph' ? pointerMotions.map(add).map(event => event.payload) : undefined };
        }
      }
      trace = evaluateTrajectory({ check, expected, request, motions, rebases, before: first, after: last, interruptions,
        releasePredecessor });
      if (crossover) trace.crossover = {
        dispatch:crossover.dispatch, morphTravelVp:crossover.pointerOffsetVp, heldTrajectories:crossover.heldTrajectories,
      };
    }
    owner = { readingId: readyOwner, transitionId: p.transitionId, request: request.eventSeq,
      commits: commits.map(event => event.eventSeq), interruptions: interruptions.map(event => event.eventSeq) };
  }
  const failure = deviations.values().next().value;
  const gap = missing.values().next().value;
  const finding = failure ?? gap;
  return {
    actual: { actionId: action?.actionId ?? null, owner: owner ?? null, nativeBefore, nativeAfter, trace: trace ?? null,
      ...(cancelApplicability ? {cancelApplicability,cancelBoundary:cancelBoundary ?? null} : {}),
      ownerSources: sources, deviations: [...deviations.values()], missing: [...missing.values()] },
    expected, verdict: failure ? 'FAIL' : gap ? 'NOT_RUN' : 'PASS',
    reason: finding ? [finding.actor + '.' + finding.field, finding.frame === null ? '' : ' at frame ' + finding.frame,
      failure ? ' observed deviation' : ' missing comparable evidence'].join('') : null,
    observationsComplete: missing.size === 0,
    evidenceRefs: [...refs.values()],
  };
}

export function evaluateControlInterruption(assertion, context) {
  const expected = assertion.expected;
  const action = context.actions[assertion.action];
  const initial = context.actions['enter-reading'];
  const endpoint = context.samples[assertion.sample];
  const refs = new Map();
  for (const item of [action, context.samples[assertion.baseline], endpoint]) {
    for (const ref of item?.evidenceRefs ?? []) refs.set(ref.path, ref);
  }
  const actual = { dispatch: action?.dispatch ?? null, timeline: null, cut: null, edges: [] };
  const result = (verdict, reason, observationsComplete = false) =>
    ({ actual, expected, verdict, reason, observationsComplete, evidenceRefs: [...refs.values()] });

  if (action?.op !== expected.op || !finite(action.dispatch?.dispatchGapMs) || !seq(action.dispatch.probeSeq) ||
    !seq(action.beforeSeq) || !seq(action.afterSeq) || !initial) {
    return result('NOT_RUN', 'The measured grabber click and normal Back receipts are missing');
  }
  const instanceEvents = context.events.filter(event => event.instanceId === action.instanceId);
  const ready = instanceEvents.filter(event => event.kind === 'reading.ready' && event.channel === 'business' &&
    event.eventSeq > initial.beforeSeq && event.eventSeq <= initial.afterSeq &&
    event.payload.localBook === true && event.payload.reduceMotion === false);
  if (ready.length !== 1 || !ready[0].payload.readingId) return result('NOT_RUN', 'The same public reading owner is unverified');
  const readingId = ready[0].payload.readingId;
  const events = instanceEvents.filter(event => event.payload?.readingId === readingId && event.eventSeq > action.beforeSeq);
  const within = events.filter(event => event.eventSeq <= action.afterSeq);
  const ownerEvents = (suffix, records = within) => records.filter(
    event => event.kind === 'reading.control-' + suffix && event.channel === 'business');
  for (const item of [ready[0], ...within]) {
    for (const ref of item.evidenceRefs ?? []) refs.set(ref.path, ref);
  }
  const requests = ownerEvents('transition-requested');
  const oldRequests = requests.filter(event => expected.predecessor.origins.includes(event.payload.origin));
  const newRequests = requests.filter(event => expected.successor.origins.includes(event.payload.origin));
  const consumers = ownerEvents('back-consumer');
  const [oldRequest] = oldRequests;
  const [newRequest] = newRequests;
  const [back] = consumers;
  const old = oldRequest?.payload;
  const next = newRequest?.payload;
  const commits = ownerEvents('transition-committed', events);
  const oldCommits = old ? commits.filter(event => event.payload.transitionId === old.transitionId) : [];
  const newCommits = next ? commits.filter(event => event.payload.transitionId === next.transitionId) : [];
  const interruptions = old ? ownerEvents('transition-interrupted').filter(event => event.payload.transitionId === old.transitionId) : [];
  const [interruption] = interruptions;
  actual.timeline = { readingId, predecessor: old ?? null, successor: next ?? null,
    back: back ? { eventSeq: back.eventSeq, ...back.payload } : null,
    interruptions: interruptions.map(event => ({ eventSeq: event.eventSeq, ...event.payload })),
    predecessorCommits: oldCommits.map(event => event.eventSeq), successorCommits: newCommits.map(event => event.eventSeq) };
  if (oldRequests.length > 1 || newRequests.length > 1 || consumers.length > 1 || interruptions.length > 1) {
    return result('FAIL', 'A single measured input pair produced duplicate transition or Back records');
  }
  if (!old || !back) return result('NOT_RUN', 'The grabber morph or Back consumption is missing');
  if (back.payload.consumer !== 'panel-session') return result('FAIL', 'Normal Back was consumed outside the panel session');
  if (!interruption && oldCommits.length === 1 && oldCommits[0].eventSeq < back.eventSeq && next?.before?.transition === '') {
    return result('NOT_RUN', 'Back reached the panel after the forward morph had already committed');
  }
  if (!next || !interruption) return result('NOT_RUN', 'The app owner did not observe an overlapping morph and Back successor');
  const revocation = interruption.payload;
  const oldEpoch = old.accepted?.epoch;
  const newEpoch = next.accepted?.epoch;
  if (!seq(oldEpoch) || !seq(newEpoch)) return result('NOT_RUN', 'Transition epoch observations are missing');
  const links = typeof old.transitionId === 'string' && typeof next.transitionId === 'string' &&
    old.transitionId !== next.transitionId && oldEpoch < newEpoch && back.payload.epoch === oldEpoch &&
    next.before?.epoch === oldEpoch && next.before?.transition === 'morph' &&
    old.intent === 'forward' && next.intent === 'back' && revocation.origin === 'system-back' &&
    revocation.epoch === oldEpoch && revocation.successorEpoch === newEpoch && revocation.heldPointerId === -1 &&
    equalLocation(back.payload.location, old.target) && equalLocation(revocation.successorTarget, expected.successor.target);
  const order = oldRequest.eventSeq < back.eventSeq && back.eventSeq < interruption.eventSeq &&
    interruption.eventSeq < newRequest.eventSeq && newCommits.every(event => event.eventSeq > newRequest.eventSeq);
  if (!links || !order || oldCommits.length || newCommits.length > 1) {
    return result('FAIL', 'Back revocation, successor ownership, or commit ordering differs from the accepted transition sequence');
  }

  const start = next.transition?.from;
  const end = next.transition?.to;
  const cutKnown = fields(start, ['visibilityProgress', 'expansionProgress']) &&
    fields(end, ['visibilityProgress', 'expansionProgress']) && finite(expected.nominalCollapseMs);
  if (!cutKnown) return result('NOT_RUN', 'The accepted successor is missing its sampled start or target position');
  if (start.expansionProgress <= 0 || start.expansionProgress >= 1) {
    return result('NOT_RUN', 'Back did not capture an interior expansion position');
  }
  const durationMs = Math.min(next.durationMs, expected.nominalCollapseMs *
    Math.max(Math.abs(end.expansionProgress - start.expansionProgress), Math.abs(end.visibilityProgress - start.visibilityProgress)));
  if (!finite(durationMs) || durationMs <= 0) return result('NOT_RUN', 'The sourced continuation duration cannot be recomputed');

  for (const [name, edge] of [['predecessor', expected.predecessor], ['successor', expected.successor]]) {
    const trajectory = name === 'successor' ? { ...edge.trajectory, runtimeDurationMs: durationMs } : edge.trajectory;
    const assessed = evaluateControlTransition({ ...assertion, expected: {
      ...edge, trajectory, op: expected.op, ownerSources: expected.ownerSources,
      endpointOpacityTolerance: expected.endpointOpacityTolerance,
    } }, context);
    for (const ref of assessed.evidenceRefs) refs.set(ref.path, ref);
    actual.edges.push({ name, verdict: assessed.verdict, reason: assessed.reason,
      observationsComplete: assessed.observationsComplete, actual: assessed.actual });
  }

  const motionFrames = transitionId => within
    .filter(event => event.kind === 'reading.control-motion' && event.channel === 'motion' &&
      event.payload.transitionId === transitionId)
    .flatMap(event => event.payload.frames ?? []).sort((a, b) => a.index - b.index);
  const oldFrames = motionFrames(old.transitionId);
  const prior = oldFrames.at(-2);
  const last = oldFrames.at(-1);
  const first = motionFrames(next.transitionId)[0];
  const clockBound = last && prior && last.index === prior.index + 1 && last.phase === 'progress' &&
    last.runtimeTicket === prior.runtimeTicket && fields(last, ['runtimeTickMs', 'runtimeElapsedMs', 'frameTimeNs']) &&
    fields(prior, ['runtimeTickMs', 'runtimeElapsedMs']) && last.runtimeTickMs > prior.runtimeTickMs &&
    first?.index === 0 && first.phase === 'start' && fields(first, ['frameTimeNs', 'runtimeElapsedMs']);
  const failure = actual.edges.find(edge => edge.verdict === 'FAIL');
  const gap = actual.edges.find(edge => edge.verdict !== 'PASS');
  if (!clockBound) return result(failure ? 'FAIL' : 'NOT_RUN',
    failure?.reason ?? 'Adjacent predecessor and successor runtime frame endpoints are missing');
  // Each observed old frame is read before its runtime publication. The last
  // callback publishes the next position, which the normal Back owner samples.
  const cutElapsedMs = last.runtimeElapsedMs + (last.runtimeTickMs - prior.runtimeTickMs);
  const curve = { ...old.transition, durationMs: expected.predecessor.trajectory.runtimeDurationMs };
  const reconstructed = visualThrough(curve, motionCurve(old.direction, curve, cutElapsedMs, last.continuationSlope));
  const firstVisual = { expansionProgress: first.expansionProgress ?? null, visibilityProgress: first.visibilityProgress ?? null };
  const previousMount = last.mountedContent?.uniqueId ?? null;
  const successorMount = first.mountedContent?.uniqueId ?? null;
  actual.cut = { predecessorFrame: last.index, successorFrame: first.index, cutElapsedMs, durationMs,
    reconstructed, accepted: start, observed: firstVisual, previousMount, successorMount };
  const complete = reconstructed && fields(firstVisual, ['expansionProgress', 'visibilityProgress']) &&
    seq(previousMount) && seq(successorMount) && newCommits.length === 1 && actual.edges.every(edge => edge.observationsComplete);
  const tolerances = expected.successor.trajectory;
  const matchingPoses = reconstructed && fields(firstVisual, ['expansionProgress', 'visibilityProgress']) &&
    ['expansionProgress', 'visibilityProgress'].every(field => {
      const tolerance = field === 'expansionProgress' ? tolerances.transformTolerance : tolerances.opacityTolerance;
      return near(reconstructed[field], start[field], tolerance) && near(firstVisual[field], start[field], tolerance);
    });
  const match = matchingPoses && first.frameTimeNs > last.frameTimeNs && near(first.runtimeElapsedMs, 0, .01) &&
    previousMount === successorMount;
  if (failure) return result('FAIL', failure.reason, Boolean(complete));
  if (!complete || gap) return result('NOT_RUN', gap?.reason ?? 'The interruption is missing a native pose, mount, or final commit');
  return match ? result('PASS', null, true) :
    result('FAIL', 'Successor started from a different published position or mounted Search instance', true);
}
