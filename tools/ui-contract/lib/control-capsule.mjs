import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { EvidenceError } from '../../lib/native-ui-evidence.mjs';
import { readCapsuleModelInputs } from './capsule-model-inputs.mjs';
import { sha256 } from './evidence.mjs';
import { selectLayoutNode } from './layout.mjs';

export const capsuleModelInputs = Object.freeze(readCapsuleModelInputs());

const require = createRequire(import.meta.url);
const finite = Number.isFinite;
const near = (a, b, tolerance) => finite(a) && finite(b) && Math.abs(a - b) <= tolerance;
const vector = (a, b, tolerance) => a.length === b.length && a.every((value, i) => near(value, b[i], tolerance));
const matrixIdentity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const observed = (event, stage) => event.payload.phase === stage ? event.payload.facts : undefined;
const exactNode = (sample, id) => {
  if (!sample) return null;
  try {
    return selectLayoutNode(sample, id);
  } catch (error) {
    if (!(error instanceof EvidenceError)) throw error;
    return null;
  }
};
const hasFields = (value, keys) => keys.every(key => finite(value?.[key]));

function capsuleModel(candidate) {
  for (const path of capsuleModelInputs) {
    const captured = candidate?.ownerSources?.[path];
    const actual = sha256(readFileSync(new URL('../../../' + path, import.meta.url)));
    if (actual !== (typeof captured === 'string' ? captured : captured?.sha256)) return null;
  }
  const [sample, timeline, timing] = capsuleModelInputs.map(path => require('../../../' + path));
  return { sample:sample.sampleReaderSessionLaunch, timeline, timeScale:timing.READER_SESSION_LAUNCH_TIME_SCALE };
}

export function capsuleInterruptionWindow(candidate) {
  const model = capsuleModel(candidate);
  return model ? {controlsReleasedMs:model.timeline.READER_SESSION_LAUNCH_CONTROL_RELEASE_MS,
    settledMs:model.timeline.READER_SESSION_LAUNCH_SETTLED_MS,timeScale:model.timeScale} : null;
}

function arkUiBezier(x1, x2) {
  const first = Math.fround(x1);
  const second = Math.fround(x2);
  const errorBound = Math.fround(.001);
  return elapsed => {
    if (elapsed === 0 || elapsed === 1) return elapsed;
    // ArkUI CubicCurve::MoveInternal stops at the first midpoint within its
    // float X error bound. Keep that approximation in the host expectation.
    // https://github.com/openharmony/arkui_ace_engine/blob/21b150e7bb1d5308846f8e5be8ef0482fb433315/frameworks/core/animation/cubic_curve.cpp#L29
    const time = Math.fround(elapsed);
    let from = 0, to = 1, t = .5;
    for (let step = 0; step < 20; step += 1) {
      t = (from + to) / 2;
      const x = Math.fround(3 * first * t * (1 - t) ** 2 + 3 * second * t ** 2 * (1 - t) + t ** 3);
      if (Math.abs(time - x) <= errorBound) break;
      if (x < time) from = t;
      else to = t;
    }
    return Math.fround(t * t * (3 - 2 * t));
  };
}

const standard = arkUiBezier(.2,0);
const curves = { flight:standard, expand:standard, easeOut:arkUiBezier(0,.58) };

function nativeGeometry(sample, id) {
  const node = exactNode(sample, id);
  const window = sample?.window;
  if (!hasFields(node?.rectPx, ['left','top','width','height']) ||
      !hasFields(window?.rectPx, ['left','top']) || !finite(window?.density) || window.density <= 0) return null;
  const { left, top, width, height } = node.rectPx;
  return [(left - window.rectPx.left) / window.density, (top - window.rectPx.top) / window.density,
    width / window.density, height / window.density];
}

function checkActor(check, frame, role, id, expected, retained, details, ids) {
  const actor = frame.actors?.find(item => item.id === id);
  if (actor?.mounted !== true || !Number.isSafeInteger(actor.uniqueId)) {
    if (retained) check(role + '-native-mount', { frame:frame.index, attached:actor?.mounted ?? null }, true, null);
    return;
  }
  if (!ids.has(role)) ids.set(role, actor.uniqueId);
  check(role + '-native-identity', { frame:frame.index, id:actor.uniqueId }, ids.get(role), actor.uniqueId === ids.get(role));
  const checkVector = (field, actual, wanted, tolerance) => check(role + '-' + field,
    { frame:frame.index, actual }, wanted, actual.every(finite) ? vector(actual, wanted, tolerance) : null);
  if (details.position) {
    checkVector('window-geometry', [actor.windowOriginVp?.x, actor.windowOriginVp?.y,
      actor.layoutRectVp?.width, actor.layoutRectVp?.height], details.position, expected.layoutToleranceVp);
  }
  if (details.translation) {
    checkVector('translation', [actor.translateVp?.x, actor.translateVp?.y, actor.translateVp?.z],
      details.translation, expected.layoutToleranceVp);
  }
  if (details.opacity !== undefined) {
    check(role + '-opacity', { frame:frame.index, opacity:actor.opacity }, details.opacity,
      finite(actor.opacity) ? near(actor.opacity, details.opacity, expected.opacityTolerance) : null);
  }
  if (details.scale) {
    checkVector('scale', [actor.scale?.x, actor.scale?.y, actor.scale?.z], details.scale, expected.opacityTolerance);
  }
  check(role + '-matrix', { frame:frame.index, matrix:actor.matrix }, matrixIdentity,
    Array.isArray(actor.matrix) && actor.matrix.length === 16 ?
      vector(actor.matrix, matrixIdentity, expected.transformTolerance) : null);
  check(role + '-rotation', { frame:frame.index, angle:actor.rotation?.angle }, 0,
    finite(actor.rotation?.angle) ? near(actor.rotation.angle, 0, expected.transformTolerance) : null);
  if (details.parent !== undefined) {
    const reached = actor.ancestorChainComplete === true && actor.ancestors?.some(item => item.uniqueId === details.parent);
    check(role + '-composition', { frame:frame.index, parent:actor.parentUniqueId }, details.parent,
      actor.ancestorChainComplete === true ? reached === true : null);
  }
  if (details.clip) {
    const present = details.clip === 'shape' ? actor.inspectorClip === 'shape-present' : actor.clipToFrame === true;
    const comparable = details.clip === 'shape' ? actor.inspectorSource === 'FrameNode.getInspectorInfo' &&
      actor.inspectorClip !== undefined : typeof actor.clipToFrame === 'boolean';
    check(role + '-clip', { frame:frame.index, inspectorClip:actor.inspectorClip, clipToFrame:actor.clipToFrame },
      details.clip, comparable ? present : null);
  }
  check(role + '-stacking', { frame:frame.index, nativeZ:actor.zIndex }, 0,
    finite(actor.zIndex) && actor.inspectorSource === 'FrameNode.getInspectorInfo' ? actor.zIndex === 0 : null);
}

export function isSystemSpeechHandoff(expected) {
  return expected?.requiresSystemSpeech === true && expected.type === 'tts' &&
    (expected.kind === 'quickTts' && expected.form === 'quick' ||
      expected.kind === 'fullTtsPlayback' && expected.form === 'full') && typeof expected.pauseAction === 'string';
}

export function confirmedSystemSpeechStart(facts) {
  const speech = facts?.tts;
  return speech?.engine === 'system' && speech.status === 'playing' && speech.audioStarted === true &&
    speech.audioSession === 'active' &&
    Number.isSafeInteger(speech.sessionGeneration) && speech.sessionGeneration > 0;
}

/** Resolve the declared system-speech condition from the current launch owner. */
export function systemSpeechApplicability(assertion, context, contract) {
  const expected = assertion.expected;
  if (assertion.required !== false || !assertion.condition || assertion.kind !== 'control-effect' ||
    expected.effect !== 'capsule-launch' || expected.type !== 'tts') return null;
  const launchAction = expected.openAction ?? assertion.action;
  const action = context.actions?.[launchAction];
  const opening = context.actions?.['enter-reading'];
  const unknown = { required:true, status:'UNVERIFIED', availabilitySeq:null, playingSeq:null, failureSeq:null };
  if (!action || !opening) return unknown;
  const events = context.events ?? [];
  const ready = events.filter(event => event.instanceId === action.instanceId && event.channel === 'business' &&
    event.kind === 'reading.ready' && event.eventSeq > opening.beforeSeq && event.eventSeq <= opening.afterSeq &&
    event.payload?.localBook === true);
  const readingId = ready.length === 1 ? ready[0].payload.readingId : null;
  if (!readingId) return unknown;
  const launchEvents = events.filter(event => event.instanceId === action.instanceId && event.channel === 'business' &&
    event.eventSeq > action.beforeSeq && event.eventSeq <= action.afterSeq && event.kind === 'reading.control-effect' &&
    event.payload?.readingId === readingId && event.payload?.kind === 'capsule-launch');
  const availabilities = launchEvents.filter(event => event.payload.phase === 'tts-availability' && event.payload.facts?.engine === 'system');
  const availability = availabilities.length === 1 ? availabilities[0] : undefined;
  // The owner handoffs and in-flight interruption require native system audio.
  // Standalone historical flight and pause cases retain their admission.
  const interruption = expected.op === 'clickThenReaderCenter' && expected.requiresSystemSpeech === true &&
    expected.kind === 'quickTts' && expected.form === 'quick';
  const handoff = interruption || isSystemSpeechHandoff(expected) ? expected : contract?.assertions?.find(item =>
    item.expected?.openAction === launchAction && isSystemSpeechHandoff(item.expected))?.expected;
  const admissions = launchEvents.filter(event => event.payload.phase === 'admitted' && event.payload.facts?.type === 'tts' &&
    event.eventSeq > (availability?.eventSeq ?? 0));
  const admitted = admissions.length === 1 ? admissions[0] : undefined;
  const generation = admitted?.payload.facts.generation;
  const validAdmission = !handoff || generation > 0 && admitted?.payload.facts.kind === handoff.kind &&
    admitted.payload.facts.source?.module === handoff.type && admitted.payload.facts.source?.form === handoff.form &&
    admitted.payload.facts.source?.level === 'secondary';
  const sameLaunch = event => validAdmission && Number.isSafeInteger(generation) && event.eventSeq > admitted.eventSeq &&
    event.payload.facts?.type === 'tts' && event.payload.facts.generation === generation &&
    (!handoff || event.payload.facts.kind === handoff.kind);
  const playing = launchEvents.find(event => sameLaunch(event) &&
    event.payload.phase === 'business-ack' && event.payload.facts.status === 'playing' &&
    (!handoff || confirmedSystemSpeechStart(event.payload.facts)));
  const failure = launchEvents.find(event => sameLaunch(event) &&
    event.payload.phase === 'cancel-request' && event.payload.facts.cancelReason === 'failure' &&
    (!handoff || event.payload.facts.tts?.engine === 'system' &&
      event.payload.facts.tts.status === 'unavailable' && event.payload.facts.tts.audioStarted === false));
  const fact = availability?.payload.facts;
  const anyPlaying = launchEvents.some(event => sameLaunch(event) && event.payload.phase === 'business-ack' &&
    event.payload.facts.status === 'playing');
  const unavailable = fact?.resolved === true && fact.status === 'unavailable' && Boolean(failure) && !anyPlaying;
  return { required:!unavailable, status:availability && playing ? 'SYSTEM_PLAYING' : unavailable ? 'SYSTEM_UNAVAILABLE' : 'UNVERIFIED',
    availabilitySeq:availability?.eventSeq ?? null, playingSeq:playing?.eventSeq ?? null, failureSeq:failure?.eventSeq ?? null };
}

export function checkCapsuleLaunch({ before, after, expected, events, check, context }) {
  const marker = events.find(event => event.payload.phase === 'admitted');
  const admission = marker?.payload.facts;
  const transition = event => event.payload.facts?.generation === admission?.generation;
  const exact = phase => events.find(event => transition(event) && event.payload.phase === phase)?.payload.facts;
  const source = admission?.source;
  const suppressed = expected.requiresSystemSpeech === true ?
    events.find(event => event.payload.phase === 'tts-availability')?.payload.facts : undefined;
  if (expected.requiresSystemSpeech) {
    check('system-engine-observation', suppressed, { engine:'system', unavailableIsConditional:true },
      suppressed?.engine === 'system' ? true : null);
  }
  check('capsule-admission', admission, { type:expected.type, kind:expected.kind, form:expected.form },
    admission ? admission.type === expected.type && admission.kind === expected.kind && source?.form === expected.form &&
      source?.level === 'secondary' && source?.module === expected.type && admission.reducedMotion === false : null);
  if (!admission) return;
  const model = capsuleModel(context.candidate);
  check('deployed-timeline-identity', Boolean(model), 'four production model bytes equal signed source snapshot', model ? true : null);
  if (!model) return;
  const { geometry } = admission;
  const sourceRect = nativeGeometry(before, admission.sourceActorId);
  const stage = nativeGeometry(before, 'reader-reading-stage');
  const endStage = nativeGeometry(after, 'reader-reading-stage');
  const sourceExpected = stage && geometry && hasFields(geometry, ['sourceLeft','sourceTop','sourceWidth','sourceHeight']) ?
    [stage[0] + geometry.sourceLeft, stage[1] + geometry.sourceTop, geometry.sourceWidth, geometry.sourceHeight] : null;
  check('bound-native-source-rect', sourceRect, sourceExpected,
    sourceRect && sourceExpected ? vector(sourceRect, sourceExpected, expected.layoutToleranceVp) : null);
  check('stable-window-layout', endStage, stage, stage && endStage ? vector(endStage, stage, expected.layoutToleranceVp) : null);
  const terminal = exact('timeline-finished');
  const settled = exact('visual-settled');
  const playing = events.filter(event => transition(event) && event.payload.phase === 'business-ack' &&
    event.payload.facts?.status === 'playing');
  const cancel = exact('cancel-request');
  check('no-early-cancellation', cancel ?? null, null,
    cancel ? expected.requiresSystemSpeech && cancel.cancelReason === 'failure' ? null : false : true);
  check('business-start', playing.map(event => event.eventSeq), 'current generation playback acknowledged',
    playing.length > 0 ? true : null);
  const milestones = [
    ['panel-hidden', model.timeline.READER_SESSION_LAUNCH_CONTROL_RELEASE_MS, 'controlsPresented'],
    ['source-released', model.timeline.READER_SESSION_LAUNCH_SOURCE_RELEASE_MS, 'sourceNeeded'],
    ['visual-settled', model.timeline.READER_SESSION_LAUNCH_SETTLED_MS],
    ['timeline-finished', model.timeline.READER_SESSION_LAUNCH_DURATION_MS],
  ];
  for (const [phase, minimum, flag] of milestones) {
    const fact = exact(phase);
    const happened = fact && finite(fact.timeMs) && fact.timeMs >= minimum &&
      (flag === undefined || fact[flag] === false);
    check(phase, fact, { minimumDesignMs:minimum }, fact ? happened : null);
  }
  check('native-capsule-endpoint', Boolean(exactNode(after, 'reader-session-launch-toggle')),
    'visible capsule for the current reading action', terminal && settled && exactNode(after, 'reader-session-launch-toggle') ? true : null);

  const blocks = events.filter(event => transition(event) && event.payload.phase === 'frame-block')
    .map(event => event.payload.facts);
  const last = blocks.at(-1);
  const frames = blocks.flatMap(block => block.frames ?? []);
  const complete = last && last.finalBlock === true && last.blockCount === blocks.length && last.endReason === 'visual-settled' &&
    blocks.every((block, i) => block.blockIndex === i && block.droppedSamples === 0) &&
    frames.every((frame, i) => frame.index === i && (i === 0 || frame.frameTimeNs > frames[i - 1].frameTimeNs));
  check('complete-capsule-trace', { frames:frames.length, blocks:blocks.length }, 'all contiguous native frame blocks',
    complete ? true : null);
  if (!geometry || !stage || !frames.length) return;
  const physicalGaps = frames.slice(1).map((frame, i) => (frame.frameTimeNs - frames[i].frameTimeNs) / 1e6);
  const cadence = [...physicalGaps].sort((a,b) => a - b)[Math.floor(physicalGaps.length / 2)];
  const ids = new Map();
  const seen = new Set();
  for (const frame of frames) {
    if (!finite(frame.publishedTickMs) || !finite(admission.startTimeMs)) {
      check('physical-launch-clock', frame.publishedTickMs, 'published monotonic launch tick', null);
      continue;
    }
    const sample = model.sample((frame.publishedTickMs - admission.startTimeMs) / model.timeScale, geometry, curves, false);
    if ((sample.phase !== 'flight' || sample.flight > 0) &&
      (sample.phase !== 'overlap' || sample.flight < 1 && sample.expansion > 0)) seen.add(sample.phase);
    check('launch-clock', { frame:frame.index, time:frame.timeMs, phase:frame.phase }, { time:sample.timeMs, phase:sample.phase },
      frame.timeMs === sample.timeMs && frame.phase === sample.phase &&
        frame.sourceNeeded === sample.sourceNeeded && frame.controlsPresented === sample.controlsPresented);
    const proxy = frame.actors?.find(item => item.id === 'reader-session-launch-proxy');
    if (frame.index === 0 && !proxy?.mounted && sample.timeMs === 0) continue;
    const proxyBox = [stage[0] + sample.proxyLeft, stage[1] + sample.proxyTop, sample.proxyWidth, sample.proxyHeight];
    checkActor(check, frame, 'proxy', 'reader-session-launch-proxy', expected, true, { position:proxyBox }, ids);
    checkActor(check, frame, 'source', 'reader-session-launch-source', expected, true,
      { parent:proxy?.uniqueId, opacity:sample.sourceSurfaceOpacity, clip:'shape' }, ids);
    checkActor(check, frame, 'sharp', 'reader-session-launch-sharp', expected, sample.sourceNeeded, {
      parent:proxy?.uniqueId, opacity:sample.sharpOpacity,
      scale:[sample.sourceContentScale,sample.sourceContentScale,1],
      translation:[sample.sourceContentTranslateX,sample.sourceContentTranslateY,0],
    }, ids);
    const obsoleteBlur = frame.actors?.find(actor => actor.id === 'reader-session-launch-blur');
    check('no-obsolete-blur-actor', { frame:frame.index, mounted:obsoleteBlur?.mounted }, false,
      typeof obsoleteBlur?.mounted === 'boolean' ? !obsoleteBlur.mounted : null);
    checkActor(check, frame, 'surface', 'reader-session-launch-surface', expected, true,
      { parent:proxy?.uniqueId, opacity:sample.canonicalSurfaceOpacity }, ids);
    checkActor(check, frame, 'leading', 'reader-session-launch-leading', expected, true, { parent:proxy?.uniqueId, clip:'rect' }, ids);
    checkActor(check, frame, 'dock', 'reader-control-motion-dock', expected, sample.controlsPresented,
      { translation:[0,sample.dockOffsetY,0] }, ids);
    checkActor(check, frame, 'topbar', 'reader-control-motion-topbar', expected, sample.controlsPresented,
      { translation:[0,sample.topBarOffsetY,0] }, ids);
  }
  const expectedPhases = ['flight','overlap','expand','settled'];
  check('all-moving-capsule-phases', [...seen], expectedPhases,
    expectedPhases.every(phase => seen.has(phase)) ? true : null);
  const maximumGap = cadence * expected.cadenceGapFactor;
  const gapOutsideCadence = gap => !finite(gap) || gap <= 0 || gap > maximumGap;
  const missingCadence = physicalGaps.findIndex(gapOutsideCadence);
  check('capsule-frame-cadence', missingCadence >= 0 ? physicalGaps[missingCadence] : cadence,
    { maximum:maximumGap, gapFrame:missingCadence + 1 },
    missingCadence === -1 && finite(cadence) ? true : null);

  const duration = (start, end) => finite(start) && finite(end) && end >= start ? end - start : null;
  const readTime = frame => duration(frame.captureStartMs, frame.captureEndMs);
  const durations = frames.map(readTime).filter(finite);
  // Reader uptime and ArkUI FrameCallback timestamps have separate roles.
  // Attribute only measured uptime segments. Cadence keeps its original clock.
  const excessGaps = physicalGaps.flatMap((intervalMs, index) => {
    if (!gapOutsideCadence(intervalMs)) return [];
    const from = frames[index];
    const to = frames[index + 1];
    return [{
      from:from.index, to:to.index, intervalMs:finite(intervalMs) ? intervalMs : null, precedingReadMs:readTime(from),
      precedingDesignMs:from.timeMs ?? null, followingDesignMs:to.timeMs ?? null,
      previousReadToHostUpdateMs:duration(from.captureEndMs, to.previousHostUpdateMs),
      hostUpdateToQueueMs:duration(to.previousHostUpdateMs, to.callbackQueuedMs),
      callbackQueueWaitMs:duration(to.callbackQueuedMs, to.callbackEnteredMs),
      callbackEntryToAdvanceMs:duration(to.callbackEnteredMs, to.nextAdvanceTickMs),
      advanceToReadMs:duration(to.nextAdvanceTickMs, to.captureStartMs),
    }];
  });
  if (durations.length || excessGaps.length) {
    const first = excessGaps[0];
    return {
      measuredFrames:durations.length,
      opaqueFrames:frames.length - durations.length,
      maximumReadMs:durations.length ? Math.max(...durations) : null,
      firstExcessGap:first ? {from:first.from, to:first.to, intervalMs:first.intervalMs, precedingReadMs:first.precedingReadMs} : null,
      excessGaps,
    };
  }
}

export function checkCapsulePause({ before, after, expected, events, earlier, check }) {
  const admissions = earlier.filter(event => event.channel === 'business' && event.payload.phase === 'admitted');
  const admission = admissions[0]?.payload.facts;
  const identifiesLaunch = fact => typeof fact?.type === 'string' && Number.isSafeInteger(fact.generation) && fact.generation > 0;
  const matchesLaunch = fact => fact.type === expected.type && fact.generation === admission.generation;
  check('capsule-pause-launch-binding', admission, { type:expected.type, uniqueAdmission:true },
    admissions.length > 1 ? false : identifiesLaunch(admission) ? matchesLaunch(admission) : null);
  if (admissions.length !== 1 || !identifiesLaunch(admission) || !matchesLaunch(admission)) return;

  const playing = earlier.filter(event => event.channel === 'business' && event.eventSeq > admissions[0].eventSeq &&
    event.payload.phase === 'business-ack' && event.payload.facts?.status === 'playing' &&
    identifiesLaunch(event.payload.facts) && matchesLaunch(event.payload.facts));
  const pauses = events.filter(event => event.channel === 'business' &&
    ['business-ack','business-paused'].includes(event.payload.phase) && event.payload.facts?.status === 'paused');
  const knownPauses = pauses.filter(event => identifiesLaunch(event.payload.facts));
  const correctPauses = knownPauses.filter(event => matchesLaunch(event.payload.facts));
  check('pause-current-capsule', { playing:playing.map(event => event.eventSeq), pauses:knownPauses.map(event => ({
    seq:event.eventSeq, type:event.payload.facts.type, generation:event.payload.facts.generation,
  })) }, { type:expected.type, generation:admission.generation, playingBeforePause:true },
  knownPauses.some(event => !matchesLaunch(event.payload.facts)) ? false :
    playing.length && correctPauses.length && knownPauses.length === pauses.length ? true : null);

  const mounts = [before,after].map(sample => exactNode(sample, 'reader-session-launch-toggle')?.key);
  check('paused-capsule-native-mount', mounts, 'same native capsule toggle before and after the pause',
    mounts.every(key => typeof key === 'string') ? mounts[0] === mounts[1] : null);
}
