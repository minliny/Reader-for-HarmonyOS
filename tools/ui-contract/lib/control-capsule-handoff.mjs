import { ancestorsOf, layoutTapPoint } from './layout.mjs';
import { effectiveAppearance } from './structure.mjs';
import { capsuleInterruptionWindow, confirmedSystemSpeechStart, isSystemSpeechHandoff } from './control-capsule.mjs';
import { capsuleCenterDispatch } from './control-input.mjs';

const interactionHosts = ['reader-reading-interaction-host-paged', 'reader-reading-interaction-host-continuous'];
const capsuleToggle = 'reader-session-launch-toggle';
const launchProxy = 'reader-session-launch-proxy';
const fadeOwner = 'reader-session-launch-fade-owner';
const fullAutoPageActor = 'reader-session-morph-fullAutoPagePlayback';
const fullTtsActor = 'reader-session-morph-fullTtsPlayback';
const quickTtsActor = 'reader-session-morph-quickTts';
const quickAutoPageActor = 'reader-session-morph-quickAutoPage';
const collapseControl = 'reader-control-collapse';
const handoffPhases = [
  ['cancel-request','handoffPending'],
  ['handoff-ready','exitPending'],
  ['retired','released'],
];

function validActionInterval(action) {
  return Number.isSafeInteger(action?.beforeSeq) && Number.isSafeInteger(action.afterSeq) && action.beforeSeq < action.afterSeq;
}

function nativeNodes(sample, id) {
  const matching = sample.nodes.filter(node => node.id === id);
  return {
    visible:matching.filter(node => node.visible === true && Number.isFinite(node.opacity) && node.opacity > 0),
    complete:matching.every(node => node.visible === false || node.visible === true && Number.isFinite(node.opacity)),
  };
}

function capsuleEventSummary(event) {
  const facts = event.payload.facts ?? {};
  return {seq:event.eventSeq, phase:event.payload.phase, generation:facts.generation, type:facts.type,
    kind:facts.kind, ownership:facts.ownership, reason:facts.cancelReason ?? facts.reason, desiredPlaying:facts.desiredPlaying,
    timeMs:facts.timeMs,tts:facts.tts,autoPageStatus:facts.autoPageStatus};
}

function checkHandoffFade({events,expected,check}, generation, ready, retired, moduleActorId, requireActor, receiverActorId) {
  const traces = events.filter(event => event.channel === 'motion' && event.payload.phase === 'handoff-fade' &&
    event.payload.facts?.generation === generation && event.eventSeq > ready?.eventSeq && event.eventSeq < retired?.eventSeq);
  const trace = traces.length === 1 ? traces[0].payload.facts : null;
  const frames = Array.isArray(trace?.frames) ? trace.frames : [];
  const samples = [trace?.start,...frames,trace?.endpoint];
  const onUnitInterval = value => Number.isFinite(value) && value >= 0 && value <= 1;
  const measured = samples.every(frame => Number.isFinite(frame?.observedMs) &&
    Number.isSafeInteger(frame.stageId) && Number.isSafeInteger(frame.quickId) &&
    typeof frame.quickVisible === 'boolean' && onUnitInterval(frame.opacity));
  const frameGaps = frames.slice(1).map((frame,index) => (frame?.frameTimeNs - frames[index]?.frameTimeNs) / 1e6);
  const positiveGaps = frameGaps.filter(gap => Number.isFinite(gap) && gap > 0).sort((a,b) => a - b);
  const cadence = positiveGaps[Math.floor(positiveGaps.length / 2)];
  const relativeGap = cadence * expected.cadenceGapFactor;
  // Full must also resolve the distinct receiving actor. A uniformly sparse
  // stream cannot establish its cadence using only its own delayed callbacks.
  const maximumGap = receiverActorId ? Math.min(relativeGap,50) : relativeGap;
  const receiverMeasured = receiverActorId === undefined || typeof trace?.receiverActorId === 'string' &&
    samples.every(frame => Number.isSafeInteger(frame?.receiverId) && typeof frame.receiverVisible === 'boolean');
  const observationGaps = samples.slice(1).map((frame,index) => frame?.observedMs - samples[index]?.observedMs);
  const continuous = trace?.source === 'FrameNode.getOpacity' && trace.frameLimitReached === false && measured && receiverMeasured &&
    (!requireActor || typeof trace.quickActorId === 'string') &&
    frames.length >= (receiverActorId ? 4 : 3) &&
    frames.every(frame => Number.isFinite(frame?.frameTimeNs) && frame.frameTimeNs > 0) &&
    positiveGaps.length === frameGaps.length && frameGaps.every(gap => gap <= maximumGap) &&
    observationGaps.every(gap => Number.isFinite(gap) && gap >= 0 && gap <= maximumGap + 1);

  const tolerance = expected.opacityTolerance;
  const opacity = samples.map(frame => frame?.opacity);
  const intermediate = frames.map(frame => frame?.opacity).filter(value => value > tolerance && value < 1 - tolerance);
  // The native getter may expose just the animation target. A static or
  // endpoint-only read does not establish an interpolated presentation path.
  const presentsMotion = intermediate.length >= 2 && Math.max(...intermediate) - Math.min(...intermediate) > tolerance;
  const stageIds = [...new Set(samples.map(frame => frame?.stageId))];
  const quickIds = [...new Set(samples.map(frame => frame?.quickId))];
  let lowestOpacity = opacity[0];
  const ordered = opacity.slice(1).every(value => {
    if (value > lowestOpacity + tolerance) return false;
    lowestOpacity = Math.min(lowestOpacity,value);
    return true;
  });
  const reachesEndpoints = opacity[0] >= 1 - tolerance && opacity.at(-1) <= tolerance;
  const moduleVisible = samples.every(frame => frame?.quickVisible === true);
  const correctModule = !requireActor || trace?.quickActorId === moduleActorId;
  const receiverIds = receiverActorId ? [...new Set(samples.map(frame => frame?.receiverId))] : undefined;
  const correctReceiver = receiverActorId === undefined || trace?.receiverActorId === receiverActorId &&
    receiverIds.length === 1 && samples.every(frame => frame?.receiverVisible === true);
  check('capsule-handoff-native-fade',
    {traces:traces.length,source:trace?.source,frameLimitReached:trace?.frameLimitReached,cadenceMs:cadence,
      maximumGapMs:maximumGap,quickActorId:trace?.quickActorId,stageIds,quickIds,opacity,quickVisible:moduleVisible,continuous,
      ...(receiverActorId ? {receiverActorId:trace?.receiverActorId,receiverIds} : {})},
    'same native capsule fades out across consecutive measured frames while the restored owner stays visible',
    continuous && presentsMotion ? correctModule && correctReceiver && ordered && reachesEndpoints &&
      stageIds.length === 1 && quickIds.length === 1 && moduleVisible : null);
}

function checkFullPlaybackEndpoint(after, panel, controls, fullActor, check) {
  const playback = nativeNodes(after,fullActor);
  const collapse = nativeNodes(after,collapseControl);
  const currentActors = playback.visible.filter(node => ancestorsOf(after,node).includes(panel.visible[0]));
  const currentControls = controls.filter(node => ancestorsOf(after,node).includes(currentActors[0]));
  const complete = panel.complete && playback.complete && collapse.complete &&
    collapse.visible.every(node => typeof node.enabled === 'boolean');
  const enabledCollapse = collapse.visible.filter(node => node.enabled === true).length;
  check('capsule-handoff-native-full-endpoint',
    {fullActors:currentActors.length,fullControls:currentControls.length,enabledCollapse},
    'one Full playback actor owning the transport and one enabled collapse control',
    complete ? panel.visible.length === 1 && playback.visible.length === 1 && currentActors.length === 1 &&
      currentControls.length === 1 && collapse.visible.length === 1 && enabledCollapse === 1 : null);
}

function checkQuickTtsEndpoint(after, panel, toggle, controls, check) {
  const appearances = after.nodes.filter(node => node.id === quickTtsActor)
    .map(node => ({node,...effectiveAppearance(after,node)}));
  const painted = appearances.filter(actor => actor.visible === true);
  const unknownPaint = appearances.some(actor => actor.visible === null);
  const actor = painted[0]?.node;
  const [module] = panel.visible;
  const onePaintedActor = painted.length === 1 && !unknownPaint;
  const correctParent = onePaintedActor && panel.visible.length === 1 && ancestorsOf(after,module).includes(actor);
  const wrongActor = painted.length > 1 || !actor && !unknownPaint ||
    onePaintedActor && panel.complete && !correctParent ||
    onePaintedActor && typeof actor.type === 'string' && actor.type !== 'Stack';
  const matchesActor = wrongActor ? false : correctParent && panel.complete && actor.type === 'Stack' ? true : null;
  check('capsule-handoff-native-quick-tts-actor',
    appearances.map(({node,visible,opacity}) => ({path:node.path,type:node.type,visible,opacity})),
    'one effectively painted Quick TTS Stack owns the current native TTS module',matchesActor);
  if (matchesActor !== true) return;

  const [button] = controls;
  const appearance = button ? effectiveAppearance(after,button) : null;
  const blocked = appearance?.visible === false || button?.enabled === false || button?.clickable === false ||
    button?.hitTestMode === 'HitTestMode.None' || typeof button?.type === 'string' && button.type !== 'Button';
  const measurable = appearance?.visible === true && button.type === 'Button' && button.enabled === true &&
    button.clickable === true && typeof button.hitTestMode === 'string' && button.hitTestMode.length > 0;
  const point = measurable && !blocked ? layoutTapPoint(button) : null;
  const viewports = [actor.visibleRectPx,module.visibleRectPx,after.window.visibleRectPx];
  const viewportsKnown = viewports.every(box => ['left','top','width','height'].every(field => Number.isFinite(box?.[field])));
  const inside = point && viewportsKnown ? viewports.every(box => point.x >= box.left && point.y >= box.top &&
    point.x < box.left + box.width && point.y < box.top + box.height) : null;
  check('capsule-handoff-native-quick-tts-transport',
    {count:controls.length,type:button?.type,enabled:button?.enabled,clickable:button?.clickable,
      hitTestMode:button?.hitTestMode,appearance,visibleRectPx:button?.visibleRectPx,tapPoint:point},
    'one effectively painted native TTS Button has an enabled touch target within the Quick TTS viewport',
    controls.length > 1 || blocked ? false : !toggle.complete ? null : controls.length === 0 ? false : inside);
}

function knownSpeech(speech) {
  return typeof speech?.engine === 'string' && Number.isSafeInteger(speech.sessionGeneration) &&
    typeof speech.status === 'string' && typeof speech.audioStarted === 'boolean' && typeof speech.audioSession === 'string';
}

function readSystemSpeechStart(events, kind) {
  const acknowledgements = events.filter(event => knownSpeech(event.payload.facts.tts))
    .sort((left,right) => left.eventSeq - right.eventSeq);
  let speechGeneration;
  let verifiedStart;
  let conflicting = false;
  for (const event of acknowledgements) {
    const {facts} = event.payload;
    const speech = facts.tts;
    if (facts.type !== 'tts' || facts.kind !== kind || speech.engine !== 'system' || speech.sessionGeneration <= 0 ||
        speech.status !== 'playing' || speech.audioSession !== 'active' ||
        (speechGeneration !== undefined && speech.sessionGeneration !== speechGeneration)) {
      conflicting = true;
      continue;
    }
    speechGeneration ??= speech.sessionGeneration;
    // Setting the playing state can precede the same session's native onStart.
    if (speech.audioStarted) verifiedStart ??= event;
    else if (verifiedStart) conflicting = true;
  }
  return {acknowledgements,verifiedStart,conflicting};
}

function pausedSystemSpeech(facts, speechGeneration) {
  const speech = facts.tts;
  return speech.engine === 'system' && speech.sessionGeneration === speechGeneration && speech.status === 'paused' &&
    speech.audioStarted === true && speech.audioSession === 'inactive' && speech.pauseReason === 'user' &&
    facts.status === 'paused' && facts.desiredPlaying === false;
}

function checkTtsHandoffOrigin({stages,admissionSeq,generation,pausedEvents,kind,check}) {
  const sameCapsule = facts => facts?.type === 'tts' && facts.kind === kind && facts.generation === generation;
  const starts = stages.filter(event => event.eventSeq > admissionSeq && sameCapsule(event.payload.facts) &&
    event.payload.phase === 'business-ack' && event.payload.facts.status === 'playing');
  const {verifiedStart,conflicting} = readSystemSpeechStart(starts,kind);
  const speechGeneration = verifiedStart?.payload.facts.tts.sessionGeneration;
  check('capsule-handoff-system-speech', starts.map(capsuleEventSummary), 'actual native onStart for the admitted built-in system session',
    conflicting ? false : verifiedStart ? true : null);

  const finished = stages.find(event => event.eventSeq > admissionSeq && sameCapsule(event.payload.facts) &&
    event.payload.phase === 'timeline-finished');
  const pauses = pausedEvents.filter(event => event.payload.phase === 'tts-pause-confirmed');
  const comparable = pauses.filter(event => typeof event.payload.facts?.type === 'string' &&
    typeof event.payload.facts.kind === 'string' && Number.isSafeInteger(event.payload.facts.generation) &&
    typeof event.payload.facts.desiredPlaying === 'boolean' && knownSpeech(event.payload.facts.tts));
  const conflictingPause = comparable.some(({payload:{facts}}) => !sameCapsule(facts) ||
    speechGeneration !== undefined && !pausedSystemSpeech(facts,speechGeneration));
  check('capsule-handoff-paused-origin', {playing:verifiedStart?.eventSeq,finished:finished?.eventSeq,
    pauses:pauses.map(capsuleEventSummary)}, 'confirmed Core pause and inactive Host transport for the admitted user pause',
    conflictingPause || comparable.length > 1 ? false :
      verifiedStart && finished && comparable.length === 1 && pauses.length === 1 ? true : null);
  return speechGeneration;
}

/** Check the owner return, native fade and stable endpoints of a paused launch. */
export function checkCapsuleHandoff({before,after,expected,earlier,events,check}, {
  action,launch,pause,pausedEvents,baseline,
}) {
  const ttsHandoff = isSystemSpeechHandoff(expected);
  const fullAutoPage = expected.type === 'autoPage' && expected.form === 'full' && expected.kind === 'fullAutoPagePlayback';
  const verifyAutoPagePause = fullAutoPage || expected.requireAutoPagePauseRetention === true;
  const fullTts = ttsHandoff && expected.form === 'full';
  const fullActor = fullTts ? fullTtsActor : fullAutoPage ? fullAutoPageActor : undefined;
  const restoredPanel = ttsHandoff ? 'reader-control-module-tts' : 'reader-control-module-autoPage';
  const transport = ttsHandoff ? 'reader-control-tts-transport-toggle' : 'reader-control-autopage-transport-toggle';
  const stages = earlier.filter(event => event.channel === 'business');
  const admissions = stages.filter(event => event.payload.phase === 'admitted');
  const admission = admissions[0]?.payload.facts;
  const generation = admission?.generation;
  const source = admission?.source;
  const launched = Number.isSafeInteger(generation) && generation > 0 && typeof admission.type === 'string' &&
    typeof admission.kind === 'string' && typeof source?.level === 'string' &&
    typeof source?.module === 'string' && typeof source?.form === 'string';
  const rightSource = launched && admission.type === expected.type && admission.kind === expected.kind &&
    source.level === 'secondary' && source.module === expected.type && source.form === expected.form;
  check('capsule-handoff-admission', {count:admissions.length,generation,source},
    {type:expected.type,form:expected.form,uniqueAdmission:true},
    admissions.length > 1 ? false : launched ? rightSource : null);
  if (fullActor) {
    check('capsule-handoff-full-source', admission?.sourceActorId, fullActor,
      typeof admission?.sourceActorId === 'string' ? admission.sourceActorId === fullActor : null);
  }

  const actionOrder = validActionInterval(launch) && validActionInterval(pause) &&
    launch.op === 'click' && pause.op === 'click' && pause.targetId === capsuleToggle &&
    Number.isSafeInteger(before?.beforeSeq) && Number.isSafeInteger(before.afterSeq) &&
    before.beforeSeq <= before.afterSeq &&
    launch.instanceId === action.instanceId && pause.instanceId === action.instanceId &&
    launch.afterSeq <= pause.beforeSeq && pause.afterSeq <= before.beforeSeq &&
    before.afterSeq <= action.beforeSeq;
  check('capsule-handoff-action-order', {launch:launch?.actionId,pause:pause?.actionId,return:action.actionId},
    'launch, pause and center tap in causal order', actionOrder ? true : null);
  check('capsule-handoff-input', {target:action.targetId,from:action.from}, {interactionHosts,from:baseline},
    typeof action.targetId === 'string' && typeof action.from === 'string' ?
      interactionHosts.includes(action.targetId) && action.from === baseline : null);

  let speechGeneration;
  if (ttsHandoff || verifyAutoPagePause) {
    check('capsule-handoff-source-transport', launch?.targetId, transport,
      typeof launch?.targetId === 'string' ? launch.targetId === transport : null);
  }
  if (ttsHandoff) {
    if (actionOrder && launched) {
      speechGeneration = checkTtsHandoffOrigin({stages,admissionSeq:admissions[0].eventSeq,generation,pausedEvents,
        kind:expected.kind,check});
    }
  } else if (actionOrder && launched) {
    const playing = stages.find(event => event.payload.phase === 'business-ack' && event.payload.facts?.status === 'playing' &&
      event.payload.facts.type === expected.type && event.payload.facts.generation === generation);
    const finished = stages.find(event => event.payload.phase === 'timeline-finished' &&
      event.payload.facts?.type === expected.type && event.payload.facts.generation === generation);
    const pauses = pausedEvents.filter(event => event.payload.phase === 'business-paused' && event.payload.facts?.status === 'paused');
    const knownPauses = pauses.filter(event => typeof event.payload.facts.type === 'string' &&
      Number.isSafeInteger(event.payload.facts.generation));
    const comparable = verifyAutoPagePause ? knownPauses.filter(({payload:{facts}}) => typeof facts.kind === 'string' &&
      typeof facts.reason === 'string' && typeof facts.desiredPlaying === 'boolean') : knownPauses;
    const conflicting = knownPauses.some(({payload:{facts}}) => facts.type !== expected.type || facts.generation !== generation) ||
      verifyAutoPagePause && comparable.some(({payload:{facts}}) =>
        facts.kind !== expected.kind || facts.reason !== 'manual' || facts.desiredPlaying !== false);
    check('capsule-handoff-paused-origin', {playing:playing?.eventSeq,finished:finished?.eventSeq,
      pauses:pauses.map(capsuleEventSummary)}, {generation,pausedAfterLaunch:true},
    conflicting ? false : playing && finished && comparable.length === 1 && pauses.length === 1 ? true : null);
  }

  const readings = handoffPhases.map(([phase,ownership]) => {
    const records = events.filter(event => event.channel === 'business' && event.payload.phase === phase);
    const record = records[0];
    const facts = record?.payload.facts;
    const comparable = launched && Number.isSafeInteger(facts?.generation) && typeof facts.type === 'string' &&
      typeof facts.kind === 'string' && typeof facts.ownership === 'string' &&
      typeof facts.cancelReason === 'string' && typeof facts.desiredPlaying === 'boolean' &&
      Number.isFinite(facts.timeMs);
    check('capsule-handoff-' + phase, records.map(capsuleEventSummary),
      {generation,ownership,cancelReason:'openControl',desiredPlaying:false}, records.length > 1 ? false :
        comparable ? facts.generation === generation && facts.type === expected.type && facts.kind === expected.kind &&
          facts.ownership === ownership && facts.cancelReason === 'openControl' && facts.desiredPlaying === false &&
          (phase !== 'cancel-request' || record.eventSeq <= action.afterSeq) : null);
    return record;
  });
  const observed = readings.filter(Boolean);
  if (ttsHandoff) {
    const measured = observed.filter(event => knownSpeech(event.payload.facts?.tts) &&
      typeof event.payload.facts.desiredPlaying === 'boolean');
    const deviates = speechGeneration !== undefined &&
      measured.some(event => !pausedSystemSpeech(event.payload.facts,speechGeneration));
    check('capsule-handoff-tts-remains-paused', measured.map(capsuleEventSummary),
      'the same user-paused built-in speech session stays inactive through retirement',
      deviates ? false : speechGeneration !== undefined && measured.length === handoffPhases.length ? true : null);
  }
  if (verifyAutoPagePause) {
    const statuses = observed.map(event => event.payload.facts?.autoPageStatus);
    const resumed = statuses.some(status => typeof status === 'string' && status !== 'paused');
    check('capsule-handoff-autopage-remains-paused', statuses, 'automatic paging stays paused through retirement',
      resumed ? false : statuses.length === handoffPhases.length && statuses.every(status => status === 'paused') ? true : null);
  }
  if (observed.length > 1) {
    check('capsule-handoff-event-order', observed.map(capsuleEventSummary), 'cancel, ready, retire in that order',
      observed.slice(1).every((event,index) => event.eventSeq > observed[index].eventSeq));
    const times = observed.map(event => event.payload.facts?.timeMs);
    check('capsule-handoff-frozen-clock', times, 'one frozen launch sample throughout the owner return',
      times.every(Number.isFinite) ? times.every(time => time === times[0]) : null);
  }

  if (before?.captureComplete === true && interactionHosts.includes(action.targetId)) {
    const host = nativeNodes(before,action.targetId);
    const toggle = nativeNodes(before,capsuleToggle);
    check('capsule-handoff-native-origin', {host:host.visible.length,capsule:toggle.visible.length}, {host:1,capsule:1},
      host.complete && toggle.complete ? host.visible.length === 1 && toggle.visible.length === 1 : null);
  } else check('capsule-handoff-native-origin', null, 'verified paused native capsule and input host', null);

  if (after?.captureComplete !== true) {
    check('capsule-handoff-native-endpoint', null, 'verified restored native panel and retired capsule', null);
    return;
  }
  const panel = nativeNodes(after,restoredPanel);
  const toggle = nativeNodes(after,transport);
  const controls = toggle.visible.filter(node => ancestorsOf(after,node).includes(panel.visible[0]));
  const proxy = nativeNodes(after,launchProxy);
  const capsule = nativeNodes(after,capsuleToggle);
  const stage = nativeNodes(after,fadeOwner);
  const enabled = controls.filter(node => node.enabled === true).length;
  const oldCapsule = capsule.visible.length + proxy.visible.length + stage.visible.length;
  const complete = panel.complete && toggle.complete && capsule.complete && proxy.complete && stage.complete &&
    controls.every(node => typeof node.enabled === 'boolean');
  check('capsule-handoff-native-endpoint', {panels:panel.visible.length,enabledControls:enabled,oldCapsule},
    {panels:1,enabledControls:1,oldCapsule:0}, oldCapsule > 0 ? false :
      complete ? panel.visible.length === 1 && controls.length === 1 && enabled === 1 : null);
  if (fullActor) checkFullPlaybackEndpoint(after,panel,controls,fullActor,check);
  if (expected.requireQuickTtsNativeTransport === true) checkQuickTtsEndpoint(after,panel,toggle,controls,check);
  checkHandoffFade({events,expected,check}, generation, readings[1], readings[2], restoredPanel, ttsHandoff || verifyAutoPagePause,
    fullActor);
}

/** The center action retires the unfinished visual launch while the same
 * business playback owner continues. */
export function checkLaunchInterruption({after,expected,events,check,context}, action) {
  const tts = expected.type === 'tts';
  const type = tts ? 'tts' : 'autoPage';
  const kind = tts ? 'quickTts' : 'quickAutoPage';
  const actor = tts ? quickTtsActor : quickAutoPageActor;
  const module = `reader-control-module-${type}`;
  const transport = tts ? 'reader-control-tts-transport-toggle' : 'reader-control-autopage-transport-toggle';
  const dispatch = action.dispatch;
  check('launch-interruption-input',dispatch,{transport,hostWindow:capsuleCenterDispatch},
    Number.isSafeInteger(dispatch?.probeSeq) && Number.isFinite(dispatch.dispatchGapMs) ?
      action.targetId === transport && dispatch.dispatchGapMs >= capsuleCenterDispatch.earliestMs &&
      dispatch.dispatchGapMs < capsuleCenterDispatch.latestMs : null);

  const records = phase => events.filter(event => event.channel === 'business' && event.payload.phase === phase);
  const admissions = records('admitted');
  const admission = admissions[0]?.payload.facts;
  const generation = admission?.generation;
  const knownAdmission = Number.isSafeInteger(generation) && generation > 0 && typeof admission.source?.form === 'string' &&
    typeof admission.sourceActorId === 'string';
  check('launch-interruption-admission',admissions.map(capsuleEventSummary),'the normal Quick playback actor owns the new launch',
    admissions.length > 1 ? false : knownAdmission ? admission.type === type && admission.kind === kind &&
      admission.source.level === 'secondary' && admission.source.module === type && admission.source.form === 'quick' &&
      admission.sourceActorId === actor && admission.reducedMotion === false : null);

  const design = capsuleInterruptionWindow(context.candidate);
  const hidden = records('panel-hidden').find(event => event.payload.facts?.generation === generation &&
    (!tts || event.payload.facts.type === type && event.payload.facts.kind === kind));
  const playingAcks = records('business-ack').filter(event => event.payload.facts?.generation === generation &&
    event.payload.facts.status === 'playing');
  const cutEvent = records('cancel-request')[0];
  const speechStart = tts ? readSystemSpeechStart(playingAcks.filter(event => event.eventSeq > admissions[0]?.eventSeq &&
    event.eventSeq < cutEvent?.eventSeq),kind) : undefined;
  const playing = tts ? speechStart.verifiedStart : playingAcks[0];
  const speechGeneration = playing?.payload.facts?.tts?.sessionGeneration;
  if (tts) {
    const conflicting = speechStart.conflicting ||
      records('business-ack').some(({eventSeq,payload:{facts}})=>eventSeq > playing?.eventSeq &&
        facts?.generation === generation && knownSpeech(facts?.tts) &&
        (facts.type !== type || facts.kind !== kind || !confirmedSystemSpeechStart(facts) ||
          facts.tts.sessionGeneration !== speechGeneration));
    check('launch-interruption-system-speech',speechStart.acknowledgements.map(capsuleEventSummary),
      'native system speech started for the same Quick launch before the interruption',
      conflicting ? false : playing ? true : null);
  }
  const handoff = handoffPhases.map(([phase,ownership]) => {
    const matches = records(phase);
    const entry = matches[0];
    const facts = entry?.payload.facts;
    const playback = tts ? knownSpeech(facts?.tts) && Number.isSafeInteger(speechGeneration) :
      typeof facts?.autoPageStatus === 'string';
    check('launch-interruption-' + phase,matches.map(capsuleEventSummary),
      {generation,ownership,reason:'openControl',...(tts ? {speechGeneration} : {autoPageStatus:'running'})},
      matches.length > 1 ? false : knownAdmission && Number.isSafeInteger(facts?.generation) &&
        typeof facts.cancelReason === 'string' && Number.isFinite(facts.timeMs) && (tts || playback) ?
        facts.generation !== generation || facts.type !== type || facts.kind !== kind || facts.cancelReason !== 'openControl' ||
          facts.ownership !== ownership ? false : playback ?
          facts.status === 'playing' && facts.desiredPlaying === true &&
          (tts ? confirmedSystemSpeechStart(facts) && facts.tts.sessionGeneration === speechGeneration :
            facts.autoPageStatus === 'running') : null : null);
    return entry;
  });
  const [cancel,ready,retired] = handoff;
  const cut = cancel?.payload.facts?.timeMs;
  const observedOverlap = Boolean(design && Number.isFinite(cut) && Number.isFinite(hidden?.payload.facts?.timeMs) &&
    hidden.payload.facts.controlsPresented === false && hidden.payload.facts.timeMs >= design.controlsReleasedMs &&
    hidden.payload.facts.timeMs <= cut && cut < design.settledMs);
  check('launch-interruption-in-flight-cut',{cut,hidden: hidden?.eventSeq},{window:design,hostTimingIsNotProof:true},
    observedOverlap ? true : null);
  const beforeCut = tts ? [playing,hidden].sort((a,b)=>a?.eventSeq-b?.eventSeq) : [playing,hidden];
  const sequence = [admissions[0],...beforeCut,cancel,ready,retired].map(event => event?.eventSeq);
  check('launch-interruption-owner-order',sequence,tts ?
    'admission, then confirmed playing and hidden panel before the cut, then ready and retirement' :
    'admission, playing, panel hidden, cut, ready, retirement in order',
    sequence.every(Number.isSafeInteger) ? sequence.slice(1).every((seq,index) => seq > sequence[index]) : null);
  check('launch-interruption-frozen-position',handoff.map(event => event?.payload.facts?.timeMs),cut,
    handoff.every(event => Number.isFinite(event?.payload.facts?.timeMs)) ?
      handoff.every(event => event.payload.facts.timeMs === cut) : null);
  const oldTimeline = [...records('visual-settled'),...records('timeline-finished')].filter(event =>
    event.payload.facts?.generation === generation);
  check('launch-interruption-obsolete-timeline',oldTimeline.map(capsuleEventSummary),[],
    observedOverlap ? oldTimeline.length === 0 : null);

  const blocks = events.filter(event => event.channel === 'motion' && event.payload.phase === 'frame-block' &&
    event.payload.facts?.generation === generation).map(event => event.payload.facts);
  const frames = blocks.flatMap(block => block.frames ?? []);
  const complete = blocks.length > 0 && blocks.every((block,index) => block.blockIndex === index &&
    block.blockCount === blocks.length && block.finalBlock === (index === blocks.length - 1) &&
    block.droppedSamples === 0 && block.endReason === 'openControl') &&
    frames.every((frame,index) => frame.index === index && Number.isFinite(frame.frameTimeNs) &&
      Number.isFinite(frame.timeMs) &&
      (index === 0 || frame.frameTimeNs > frames[index - 1].frameTimeNs && frame.timeMs >= frames[index - 1].timeMs));
  const tail = frames.slice(-4);
  const tailGapMs = Number.isFinite(tail.at(-1)?.timeMs) && design ? (cut - tail.at(-1).timeMs) * design.timeScale : null;
  const dense = complete && tail.length === 4 && Number.isFinite(tailGapMs) && tailGapMs >= 0 && tailGapMs <= 50 &&
    tail.slice(1).every((frame,index) => frame.frameTimeNs - tail[index].frameTimeNs <= 50e6);
  const proxies = tail.map(frame => frame.actors?.find(actor => actor.id === launchProxy));
  const ids = [...new Set(proxies.map(proxy => proxy?.uniqueId))];
  const positions = proxies.map(proxy => [proxy?.windowOriginVp?.x,proxy?.windowOriginVp?.y,
    proxy?.layoutRectVp?.width,proxy?.layoutRectVp?.height]);
  const changes = positions.every(position => position.every(Number.isFinite)) &&
    positions.slice(1).some(position => position.some((value,index) => Math.abs(value - positions[0][index]) > .01));
  check('launch-interruption-native-flight',{blocks:blocks.length,tailGapMs,ids,positions},
    'a complete interrupted trace with closely sampled movement from the current proxy before the cut',
    observedOverlap && dense && proxies.every(proxy => proxy?.mounted && Number.isSafeInteger(proxy.uniqueId)) && changes ?
      ids.length === 1 : null);

  if (after?.captureComplete !== true) {
    check('launch-interruption-native-endpoint',null,'the restored Quick module owns the transport after the old capsule retires',null);
  } else {
    const quick = nativeNodes(after,actor);
    const panel = nativeNodes(after,module);
    const toggle = nativeNodes(after,transport);
    const collapse = nativeNodes(after,collapseControl);
    const capsule = [launchProxy,capsuleToggle,fadeOwner].map(id => nativeNodes(after,id));
    const old = capsule.flatMap(nodes => nodes.visible);
    const playable = toggle.visible.filter(node => ancestorsOf(after,node).includes(panel.visible[0]));
    const comparable = [quick,panel,toggle,collapse,...capsule].every(nodes => nodes.complete) &&
      [...playable,...collapse.visible].every(node => typeof node.enabled === 'boolean');
    check('launch-interruption-native-endpoint',{quick:quick.visible.length,playable:playable.length,old:old.length},
      'the restored Quick module owns the enabled transport and there is no old capsule or enabled Full collapse',
      old.length > 0 ? false : comparable ? panel.visible.length === 1 && quick.visible.length === 1 &&
        ancestorsOf(after,panel.visible[0]).includes(quick.visible[0]) && playable.length === 1 &&
        playable[0].enabled === true && collapse.visible.every(node => node.enabled === false) : null);
    if (tts) checkQuickTtsEndpoint(after,panel,toggle,playable,check);
  }
  checkHandoffFade({events,expected,check},generation,ready,retired,module,true,actor);
}
