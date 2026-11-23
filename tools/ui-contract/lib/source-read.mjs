export const sourceReadStates = Object.freeze(['loading', 'readFailure', 'recovery']);
export const conditionBoundSourceKinds = Object.freeze([
  'read-surface', 'read-retry', 'retained-read-failure', 'retained-read-retry',
  'recovery-native-control', 'recovery-body-text','recovery-expand-edge',
]);
const projectionStates = new Set(['rows','filteredEmpty','empty',...sourceReadStates]);
export const sourceReadLoadingCase = 'source-management.read-loading';
export const sourceReadLoadingFrame = 'arkui-visible-frame';
const loadingFrameEvent = 'source.read-loading-frame';
const frameActors = ['reader-source-content','reader-source-back','reader-source-list','reader-source-footer',
  'reader-source-loading-progress'];
const failureTitle = 'reader-source-read-failure-title';
const positiveId = value => Number.isSafeInteger(value) && value > 0;
const rectKeys = ['left','top','width','height'];

function sameOpening(left, right) {
  return left?.mounting === right.mounting && left?.generation === right.generation;
}

function frameActor(actor, expectedId) {
  return actor?.id === expectedId && positiveId(actor.uniqueId) && Array.isArray(actor.ancestorIds) &&
    actor.ancestorIds.length > 0 && actor.ancestorIds.length <= 32 && actor.ancestorIds.every(positiveId) &&
    new Set([actor.uniqueId,...actor.ancestorIds]).size === actor.ancestorIds.length + 1 &&
    typeof actor.type === 'string' && actor.type.length > 0 && typeof actor.visible === 'boolean' &&
    Number.isFinite(actor.opacity) && actor.opacity >= 0 && actor.opacity <= 1 &&
    rectKeys.every(key => Number.isFinite(actor.rectVp?.[key])) && actor.rectVp.width >= 0 && actor.rectVp.height >= 0;
}

export function sourceReadObservation(assertion, context) {
  const actionId = context.sourceUnknownExpand && ['enable-for-unknown','collapse-recovery'].includes(assertion.action) ?
    'open-sources' : assertion.action;
  const action = context.actions?.[actionId];
  const sample = context.samples?.[assertion.sample];
  if (action?.op !== 'click' || action.targetId !== 'reader-settings-source-management' || action.outcomeSettled === false ||
      !Number.isSafeInteger(action.beforeSeq) || !Number.isSafeInteger(action.afterSeq) || action.afterSeq <= action.beforeSeq ||
      (sample && (sample.instanceId !== action.instanceId || !Number.isSafeInteger(sample.beforeSeq) ||
        sample.beforeSeq < action.afterSeq))) return null;
  const end = sample?.beforeSeq ?? action.afterSeq;
  const events = (context.events ?? []).filter(event => event.instanceId === action.instanceId &&
    event.channel === 'business' && event.eventSeq > action.beforeSeq && event.eventSeq <= end);
  const routes = events.filter(event => event.kind === 'source.route');
  const [entry] = routes;
  const route = entry?.payload;
  if (routes.length !== 1 || route.action !== 'open' || route.from !== 'settings' || route.to !== 'source' ||
      !Number.isSafeInteger(route.mounting) || route.mounting < 0 ||
      !Number.isSafeInteger(route.generation) || !Number.isSafeInteger(route.previousGeneration) ||
      route.previousGeneration < 0 || route.generation <= route.previousGeneration) return null;
  const projections = events.filter(event => event.kind === 'source.projection' && event.eventSeq > entry.eventSeq);
  const current = projections.at(-1);
  const owned = event => event?.payload.owner?.mounting === route.mounting &&
    event.payload.owner.generation === route.generation;
  if (!owned(current) || !projectionStates.has(current.payload.state)) return null;
  const triggered = projections.find(event => owned(event) && event.payload.state === assertion.expected.state);
  return {entry, current, triggered, projections, sample};
}

/** Lift only the window/actor facts from the real LoadingProgress frame into structure evaluation. */
export function sourceReadLoadingNativeFrame(assertion, context, opening) {
  if (assertion?.expected?.nativeFrame !== sourceReadLoadingFrame || context.problems?.length) return null;
  opening ??= sourceReadObservation(assertion,context);
  if (!opening?.triggered) return null;
  const {entry,current,projections,sample} = opening;
  const action = context.actions[assertion.action];
  const window = sample?.window;
  if (!sample?.captureComplete || window?.source !== 'window-metrics' || window.keyboard?.visible !== false ||
      !Number.isFinite(window.density) || window.density <= 0 || window.keyboard.revision !== window.revision ||
      !Number.isFinite(window.rectPx?.width) || !Number.isFinite(window.rectPx?.height)) return null;
  const frames = context.events.filter(event => event.kind === loadingFrameEvent && event.channel === 'probe' &&
    event.instanceId === action.instanceId && event.eventSeq > entry.eventSeq && event.eventSeq <= sample.beforeSeq);
  if (frames.length !== 1) return null;
  const [frame] = frames;
  const data = frame.payload;
  const loading = projections.findLast(event => event.eventSeq < frame.eventSeq);
  if (!loading || loading.payload.state !== 'loading' || !['loading','refreshing'].includes(loading.payload.readFact) ||
      !sameOpening(loading.payload.owner,entry.payload) || !sameOpening(data.owner,entry.payload) ||
      !positiveId(data.readGeneration) || data.readGeneration !== loading.payload.readGeneration ||
      frame.windowRevision !== window.revision || loading.windowRevision !== window.revision ||
      current.windowRevision !== window.revision || data.windowId !== window.id || data.keyboardHidden !== true ||
      data.density !== window.density || !Number.isFinite(data.widthVp) || !Number.isFinite(data.heightVp) ||
      data.widthVp <= 0 || data.heightVp <= 0 ||
      Math.abs(data.widthVp * data.density - window.rectPx?.width) > 1 ||
      Math.abs(data.heightVp * data.density - window.rectPx?.height) > 1 ||
      !Number.isFinite(data.progressVisibleRatio) || data.progressVisibleRatio <= 0 || data.progressVisibleRatio > 1 ||
      !Array.isArray(data.actors) || data.actors.length !== frameActors.length ||
      !frameActors.every((id,index) => frameActor(data.actors[index],id)) ||
      (data.failureTitle !== null && !frameActor(data.failureTitle,failureTitle))) return null;
  const actors = data.failureTitle === null ? data.actors : [...data.actors,data.failureTitle];
  const list = data.actors[2];
  const progress = data.actors[4];
  const ids = new Set(actors.map(actor => actor.uniqueId));
  if (ids.size !== actors.length || actors.some(actor => actor.ancestorIds.at(-1) !== progress.ancestorIds.at(-1)) ||
      list.type !== 'List' || progress.type !== 'LoadingProgress' ||
      (data.failureTitle && data.failureTitle.type !== 'Text')) return null;
  for (const child of actors) {
    for (const parent of actors) {
      const index = child.ancestorIds.indexOf(parent.uniqueId);
      if (index !== -1 && (child.ancestorIds.length - index - 1 !== parent.ancestorIds.length ||
          parent.ancestorIds.some((id,depth) => child.ancestorIds[index + depth + 1] !== id))) return null;
    }
  }

  const nodes = actors.map(actor => {
    const parentId = actor.ancestorIds.find(id => ids.has(id));
    const rect = actor.rectVp;
    const left = Math.max(rect.left,0);
    const top = Math.max(rect.top,0);
    const density = data.density;
    const visibleRectPx = {
      left:left * density,top:top * density,
      width:Math.max(0,Math.min(rect.left + rect.width,data.widthVp) - left) * density,
      height:Math.max(0,Math.min(rect.top + rect.height,data.heightVp) - top) * density,
    };
    return {id:actor.id,path:String(actor.uniqueId),parentPath:parentId === undefined ? null : String(parentId),
      type:actor.type,visible:actor.visible,opacity:actor.opacity,visibleRectPx};
  });
  return {frame,loading,sample:{...sample,nodes,nativeObservation:'ArkUI.FrameNode',evidenceRefs:frame.evidenceRefs ?? []}};
}
