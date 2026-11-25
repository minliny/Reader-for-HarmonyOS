import { ancestorsOf } from './layout.mjs';
import { nativeSourceText, sourceTextPlacement } from './source-adaptation.mjs';
import { sourceReadObservation } from './source-read.mjs';
import { sourceRecoveryControl } from './source-recovery-control.mjs';
import { sourceV9ImportStages } from './source-document-picker.mjs';
import { evaluateSourceTransientStatusText } from './source-transient-status-text.mjs';

const empty = 'reader-source-empty-state';
const filter = 'reader-source-filter-block';
const readTitle = {id:'reader-source-text-read-title',hostId:empty};
const failureTitle = 'reader-source-read-failure-title';
const readMessage = {id:'reader-source-text-read-message',hostId:empty};
const selectors = {
  'read-empty': {
    'read/empty-title':readTitle,
    'read/empty-message':readMessage,
    'footer/add':{id:'reader-source-text-footer-add',hostId:'reader-source-footer',button:true},
  },
  'read-failed': {
    'read/failure-title':readTitle,
    'read/failure-message':readMessage,
    'read/retry':{id:'reader-source-read-retry',hostId:empty,button:true},
  },
  'retained-read-failed': {
    'read/retained-retry':{id:'reader-source-retained-read-retry',hostId:filter,button:true},
  },
  'operation-status': {
    'operation/action':{id:'reader-source-status-action',hostId:filter,button:true},
  },
};
const near = (a,b,tolerance) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= tolerance;
const sequence = value => Number.isSafeInteger(value) && value >= 0;
const ownerMatches = (left,right) => sequence(left?.mounting) && sequence(left?.generation) &&
  left.mounting === right?.mounting && left.generation === right?.generation;

function readTitleClipAncestors(sample,node) {
  const visibleRect = node.visibleRectPx;
  const layoutRect = node.rectPx;
  const isVisibleNative = item => item.source === 'native-tree' && item.visible === true &&
    Number.isFinite(item.opacity) && item.opacity > 0;
  const rectKeys = ['left','top','width','height'];
  const hasArea = rect => rectKeys.every(key => Number.isFinite(rect?.[key])) && rect.width > 0 && rect.height > 0;
  if (![readTitle.id,failureTitle].includes(node.id) || node.clip !== false || !isVisibleNative(node) || !hasArea(layoutRect) ||
      !hasArea(visibleRect) || !rectKeys.every(key => layoutRect[key] === visibleRect[key])) return undefined;

  const parents = ancestorsOf(sample,node);
  const root = parents.at(-1);
  if (root?.path !== '0' || root.type !== 'root' || root.parentPath !== null ||
      !parents.some(parent => parent.id === 'reader-source-list' && parent.type === 'List' && parent.clip === true)) return undefined;
  const chain = [node,...parents];
  if (parents.some((parent,index) => !isVisibleNative(parent) || typeof parent.clip !== 'boolean' ||
      !hasArea(parent.rectPx) || !hasArea(parent.visibleRectPx) ||
      chain[index].path.slice(0,chain[index].path.lastIndexOf('/')) !== parent.path)) return undefined;
  if (!Array.isArray(sample.clipShapes) || sample.clipShapes.some(shape => shape.shape !== 'rect' &&
      chain.some(item => shape.path === item.path || shape.id && shape.id === item.id))) return undefined;

  // TIGHT character ranges include the font's vertical metrics. Compare them to
  // actual clip/visible ancestors when this Text has no clipping of its own.
  return parents.map(parent => ({path:parent.path,clip:parent.clip,rectPx:parent.visibleRectPx}));
}

function importStatusObservation(events, action, sample, assertion) {
  const v9Return = sourceV9ImportStages.at(-1);
  const targetMatches = assertion.action === v9Return.action ?
    action?.targetId === v9Return.target && action.from === v9Return.sample : action?.targetId === 'reader-source-picker-file';
  if (action?.op !== 'click' || !targetMatches ||
      action.outcomeSettled !== true || events.some(event => event.kind === 'source.route')) return null;
  const status = events.findLast(event => event.kind === 'source.import-status-action');
  const projection = events.findLast(event => event.kind === 'source.projection');
  const facts = status?.payload;
  const state = projection?.payload;
  if (status?.eventSeq > action.afterSeq || facts?.phase !== 'ready' ||
      facts.confirmation !== 'confirmed' || facts.readback !== 'succeeded' || facts.confirmedParts !== 1 ||
      facts.fixturePresent !== true || facts.count !== 1 || !sequence(facts.receiptGeneration) || facts.receiptGeneration === 0 ||
      !sequence(facts.statusRevision) || facts.statusRevision === 0 ||
      !ownerMatches(facts.owner,state?.owner) || state.state !== 'rows' || state.readFact !== 'current' || state.count !== 1) {
    return null;
  }
  return {sample,current:projection,status,generation:facts.receiptGeneration,statusRevision:facts.statusRevision,branch:'import'};
}

function observeScope(assertion, context, scope, events, sample, action) {
  if (scope === 'operation-status') {
    return importStatusObservation(events,action,sample,assertion);
  }
  const state = {
    'read-empty':'empty', 'read-failed':'readFailure',
    'retained-read-failed':'rows', 'operation-recovery':'recovery',
  }[scope];
  const opening = sourceReadObservation({...assertion,expected:{state}},context);
  const projection = opening?.current?.payload;
  if (projection?.state !== state) return null;
  if (scope === 'read-empty' &&
      (projection.readFact !== 'current' || projection.count !== 0 || projection.projected !== 0)) return null;
  if (scope === 'read-failed' &&
      (!['failed','refreshFailed'].includes(projection.readFact) || projection.count !== 0 || projection.projected !== 0)) return null;
  if (scope === 'retained-read-failed' && (projection.readFact !== 'refreshFailed' || !(projection.count > 0))) return null;
  if (scope !== 'operation-recovery') return opening;
  const control = sourceRecoveryControl(assertion.expected.target);
  if (control?.branch !== projection.recovery?.branch || !sequence(projection.recovery?.generation)) return null;
  return {...opening,branch:control.branch,generation:projection.recovery.generation};
}

export function evaluateSourceSurfaceText(assertion, context) {
  const scope = assertion.expected.scope;
  const sample = context.samples?.[assertion.sample];
  const action = context.actions?.[assertion.action];
  const window = sample?.window;
  const nativeFont = window?.nativeFont;
  const events = (context.events ?? []).filter(event => event.instanceId === sample?.instanceId && event.channel === 'business' &&
    event.eventSeq > action?.beforeSeq && event.eventSeq <= sample?.beforeSeq);
  let observation;
  let text;
  let transient;
  const roles = {};
  const report = (verdict,reason,actual = null,observationsComplete = verdict !== 'NOT_RUN') => ({
    verdict,reason,actual,observationsComplete,
    evidenceRefs:[sample,action,observation?.entry,observation?.current,observation?.status,text]
      .flatMap(item => item?.evidenceRefs ?? []).concat(transient?.evidenceRefs ?? []),
  });
  if (!action || !sequence(action.beforeSeq) || !sequence(action.afterSeq) || action.beforeSeq >= action.afterSeq ||
      action.instanceId !== sample?.instanceId || action.afterSeq > sample.beforeSeq || sample.captureComplete !== true ||
      !sequence(sample.beforeSeq) || !sequence(sample.afterSeq) || sample.beforeSeq >= sample.afterSeq ||
      !sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) || !sample.evidenceRefs.some(ref=>ref.path.endsWith('.json')) ||
      window?.source !== 'window-metrics' || window.keyboard?.visible !== false || window.keyboard.revision !== window.revision ||
      !Number.isFinite(window.density) || window.density <= 0 || !(window.rectPx?.width > 0) || !(window.rectPx.height > 0) ||
      nativeFont?.followsSystemFontScale !== true || !near(nativeFont.effectiveScale,window.fontScale,.01) ||
      Number.isFinite(nativeFont.maxFontScale) && nativeFont.maxFontScale + .01 < nativeFont.effectiveScale ||
      context.problems?.length) {
    return report('NOT_RUN','No complete native Source capture with a stable effective system font');
  }
  observation = observeScope(assertion,context,scope,events,sample,action);
  const state = observation?.current?.payload;
  if (!state || !sequence(state.filterRevision) || !sequence(state.readGeneration) ||
      !sequence(state.textProjectionRevision) || state.textProjectionRevision === 0) {
    return report('NOT_RUN','No current Source projection for the selected text surface');
  }
  const widthVp = window.rectPx.width / window.density;
  const heightVp = window.rectPx.height / window.density;
  const actual = {sampleId:assertion.sample,textScope:scope,widthVp,scale:window.fontScale,nativeFont,
    textProjectionRevision:state.textProjectionRevision,roles};
  text = events.findLast(event => event.kind === 'source.surface-text-layout' && event.payload?.scope === scope);
  const data = text?.payload;
  const matches = data && text.eventSeq > Math.max(observation.current.eventSeq,observation.status?.eventSeq ?? 0) &&
    text.windowRevision === window.revision && data.windowRevision === window.revision && ownerMatches(data.owner,state.owner) &&
    data.filterRevision === state.filterRevision && data.readGeneration === state.readGeneration &&
    data.textProjectionRevision === state.textProjectionRevision &&
    (observation.branch === undefined || data.branch === observation.branch && data.generation === observation.generation) &&
    (observation.statusRevision === undefined || data.statusRevision === observation.statusRevision) &&
    near(data.density,window.density,.01) && near(data.widthVp,widthVp,1 / window.density) &&
    near(data.heightVp,heightVp,1 / window.density) && near(data.systemFontScale,window.fontScale,.01) &&
    near(data.fontScale,window.fontScale,.01) && Array.isArray(data.labels) && data.labels.length <= 9;
  if (!matches && assertion.expected.requireTransientStatus !== true)
    return report('NOT_RUN','No fresh glyph measurements for the current Source owner, branch and window',actual);
  const control = scope === 'operation-recovery' ? sourceRecoveryControl(assertion.expected.target) : null;
  const selected = control ? {
    [`recovery/${control.branch}/${control.control}`]:{id:assertion.expected.target,hostId:control.host,button:true},
  } : selectors[scope];
  const nativeSample = {...sample,nodes:sample.nodes.filter(node => node.source === 'native-tree')};
  for (const [role,selector] of Object.entries(selected)) {
    if (!matches) {
      roles[role] = {verdict:'NOT_RUN',reason:'No fresh persistent glyph measurement for the current Source owner'};
      continue;
    }
    const currentSelector = role === 'read/failure-title' && nativeSample.nodes.some(node => node.id === failureTitle) ?
      {...selector,id:failureTitle} : selector;
    const mounted = nativeSourceText(nativeSample,role,currentSelector,true);
    const labels = data.labels.filter(label => label?.role === role);
    if (!mounted.node) roles[role] = mounted;
    else if (labels.length !== 1) roles[role] = {verdict:'NOT_RUN',reason:`${role} has no unambiguous current native character range`};
    else {
      const clipAncestors = role === 'read/empty-title' || role === 'read/failure-title'
        ? readTitleClipAncestors(nativeSample,mounted.node) : undefined;
      roles[role] = sourceTextPlacement(role,labels[0],mounted.node,window,{tolerancePx:1,clipAncestors});
    }
  }
  if (assertion.expected.requireTransientStatus === true) {
    transient = evaluateSourceTransientStatusText({scope,sample,action,projection:observation.current,observation,
      events:(context.events ?? []).filter(event=>event.instanceId === sample.instanceId)});
    roles[transient.role] = transient.witness;
  }
  const observed = Object.values(roles);
  const failure = observed.find(role => role.verdict === 'FAIL');
  const missing = observed.find(role => role.verdict === 'NOT_RUN');
  const complete = !missing && observed.every(role => role.observationsComplete !== false);
  return report(failure ? 'FAIL' : missing ? 'NOT_RUN' : 'PASS',failure?.reason ?? missing?.reason ?? '',actual,complete);
}
