import {requireEvidence} from './evidence.mjs';
import {ancestorsOf,layoutTapPoint} from './layout.mjs';
import {measureSourceNativeControl} from './source-native-control.mjs';
import {sourceNativeCenterInteraction} from './source-native-center.mjs';
import {sourceReadObservation} from './source-read.mjs';

export const sourceOfflineDetectCase = 'source-management.row-detect-offline';
export const sourceOfflineDetectEdgeCase = 'source-management.row-detect-offline-edge';
export const sourceOfflineDetectFixture = 'public-source-row-detect-offline-v1';
export const sourceOfflineDetectFixturePath = 'fixtures/source-row-detect/public-source.json';
export const sourceOfflineDetectButton = 'reader-source-row-detect-control';
export const sourceOfflineDetectReady = 'reader-source-offline-detect-ready';
export const sourceOfflineDetectFailed = 'reader-source-offline-detect-failed';
export const sourceOfflineDetectObservation = 'source.row-detect';

const positive = value => Number.isSafeInteger(value) && value > 0;
const sameOwner = (a,b) => positive(a?.generation) && Number.isSafeInteger(a.mounting) && a.mounting >= 0 &&
  a.generation === b?.generation && a.mounting === b?.mounting;
const ownerFact = (event,sample) => event.instanceId === sample.instanceId && event.channel === 'business';
const full = sample => sample?.captureComplete === true && sample.window?.source === 'window-metrics' &&
  sample.window.keyboard?.visible === false && sample.evidenceRefs?.some(ref=>ref.path.endsWith('.png')) &&
  sample.evidenceRefs.some(ref=>ref.path.endsWith('.json'));
const visible = node => node.visible === true && node.opacity > 0 && node.visibleRectPx?.width > 0 && node.visibleRectPx?.height > 0;
const visibleRole = (node,role) => (node.id === role || node.alias === role) && visible(node);
const exactLevels = (levels,...expected) => Array.isArray(levels) && levels.length === expected.length &&
  expected.every((level,index)=>levels[index] === level);
const reasonCode = 'missing-search-url';
const reportVersions = [1,2];

function fixtureRow(sample,button) {
  const node = sample.nodes.find(item=>item.path === button.carrierPath);
  const rows = node && ancestorsOf(sample,node).filter(item=>item.type === 'Column' &&
    /^reader-source-row-[1-9]\d*$/u.test(item.id ?? ''));
  if (rows?.length !== 1) return undefined;
  const [row] = rows;
  return {row,node,anchor:Number(row.id.slice('reader-source-row-'.length))};
}

function sameReady(a,b) {
  return sameOwner(a?.owner,b?.owner) && positive(a.anchor) && a.anchor === b.anchor &&
    positive(a.readGeneration) && a.readGeneration === b.readGeneration &&
    a.definition === reasonCode && b.definition === reasonCode &&
    a.reportVersion === b.reportVersion && reportVersions.includes(a.reportVersion);
}

export function sourceOfflineDetectEdgePoint(sample) {
  const measured = measureSourceNativeControl(sample,sourceOfflineDetectButton);
  requireEvidence(measured.verdict === 'PASS',measured.reason);
  const {left,top,width} = measured.actual.bounds;
  return {x:Math.floor(left+width/2),y:top+1};
}

export function sourceOfflineDetectReadyAt(sample,events,through=sample?.beforeSeq) {
  if (!full(sample) || !positive(through)) return undefined;
  const measured = measureSourceNativeControl(sample,sourceOfflineDetectButton);
  if (measured.verdict !== 'PASS') return undefined;
  const target = fixtureRow(sample,measured.actual);
  if (!target) return undefined;
  const readyBadge = sample.nodes.filter(node=>visibleRole(node,sourceOfflineDetectReady) &&
    ancestorsOf(sample,node).includes(target.row));
  const read = events.findLast(event=>ownerFact(event,sample) && event.eventSeq <= through &&
    event.kind === 'source.projection');
  const ready = events.findLast(event=>ownerFact(event,sample) && event.eventSeq <= through &&
    event.kind === sourceOfflineDetectObservation);
  const facts = read?.payload;
  const readyFacts = ready?.payload;
  if (readyBadge.length !== 1 || facts?.state !== 'rows' || facts.readFact !== 'current' ||
      facts.firstAnchor !== target.anchor || facts.count !== 1 || facts.projected !== 1 ||
      readyFacts?.phase !== 'ready' || readyFacts.definition !== reasonCode || !reportVersions.includes(readyFacts.reportVersion) ||
      !positive(readyFacts.readGeneration) ||
      !sameOwner(readyFacts.owner,facts.owner) || readyFacts.anchor !== target.anchor ||
      readyFacts.readGeneration !== facts.readGeneration) return undefined;
  return {ready,read,...target,point:layoutTapPoint(target.node),geometry:measured.actual};
}

export function requireSourceOfflineDetectState(step,sample,mark,events) {
  if (step.target !== sourceOfflineDetectButton) return;
  const start = sourceOfflineDetectReadyAt(sample,events);
  const current = sourceOfflineDetectReadyAt(sample,events,mark.eventSeq);
  requireEvidence(start && current && start.ready.eventSeq === current.ready.eventSeq &&
    sameReady(start.ready.payload,current.ready.payload),
  'The current measured Detect button has no exact raw current provider-free fixture definition');
}

export function evaluateSourceOfflineDetect(assertion,context) {
  const {samples,actions,events} = context;
  const origin = samples[assertion.baseline];
  const after = samples[assertion.sample];
  const action = actions[assertion.action];
  const run = assertion.runAction ? actions[assertion.runAction] : action;
  const back = assertion.returnAction ? actions[assertion.returnAction] : undefined;
  const observations = [origin,after,action,run,back];
  const result = (verdict,reason,actual=null) => ({
    verdict,reason,actual,expected:assertion.expected,evidenceRefs:observations.flatMap(value=>value?.evidenceRefs ?? []),
  });
  const opening = sourceReadObservation({action:assertion.entryAction,sample:assertion.baseline,expected:{state:'rows'}},context);
  const initial = sourceOfflineDetectReadyAt(origin,events);
  if (!opening?.triggered || !initial || !full(after) || !sameOwner(opening.current.payload.owner,initial.ready.payload.owner))
    return result('NOT_RUN','The current normal Source opening, provider-free fixture or complete outcome sample is unavailable');
  observations.push(opening.entry,initial.ready,initial.read);
  const marked = action?.detectTap;
  if (action?.op !== 'click' || action.targetId !== sourceOfflineDetectButton || action.from !== assertion.baseline ||
      action.instanceId !== origin.instanceId || action.instanceId !== after.instanceId ||
      origin.window.id !== after.window.id || origin.window.revision !== after.window.revision ||
      !positive(marked?.probeSeq) || ![origin.afterSeq,action.beforeSeq,action.afterSeq,after.beforeSeq].every(positive) ||
      origin.afterSeq > action.beforeSeq || action.beforeSeq >= action.afterSeq || action.afterSeq > after.beforeSeq)
    return result('NOT_RUN','No verified native Detect click between complete current same-window samples');
  if (assertion.runAction && (run?.op !== 'click' || run.targetId !== 'reader-source-v9-check-run' ||
      back?.op !== 'click' || back.targetId !== 'reader-source-v9-check-close' ||
      run.instanceId !== origin.instanceId || back.instanceId !== origin.instanceId ||
      ![run.beforeSeq,run.afterSeq,back.beforeSeq,back.afterSeq].every(positive) ||
      action.afterSeq > run.beforeSeq || run.beforeSeq >= run.afterSeq ||
      run.afterSeq > back.beforeSeq || back.beforeSeq >= back.afterSeq || back.afterSeq > after.beforeSeq))
    return result('NOT_RUN','No verified report start and close actions belong to the current native row click');
  const accepted = events.filter(event=>ownerFact(event,after) && event.eventSeq > action.beforeSeq && event.eventSeq <= after.beforeSeq);
  const actionEvents = accepted.filter(event=>event.kind === sourceOfflineDetectObservation && event.payload.phase !== 'ready');
  if (actionEvents.some(event=>event.eventSeq <= run.beforeSeq || (back && event.eventSeq > back.beforeSeq)))
    return result('FAIL','The Core check was admitted outside the report start and close actions');
  const routes = accepted.filter(event=>event.kind === 'source.route');
  const current = events.findLast(event=>ownerFact(event,after) && event.eventSeq <= after.beforeSeq && event.kind === 'source.projection');
  observations.push(...actionEvents,...routes,current);
  const returnButton = measureSourceNativeControl(after,sourceOfflineDetectButton);
  const target = returnButton.actual && fixtureRow(after,returnButton.actual);
  const terminal = target ? after.nodes.filter(node=>visibleRole(node,sourceOfflineDetectFailed) &&
    ancestorsOf(after,node).includes(target.row)) : [];
  const untouched = target?.anchor === initial.anchor && sameOwner(current?.payload.owner,initial.ready.payload.owner) &&
    ['state','readFact','readGeneration','count','projected','status','category','queryLength','allGroups','groupIndex','firstAnchor']
      .every(key=>current.payload[key] === initial.read.payload[key]);
  const isEdge = assertion.expected.position === 'top';
  const point = isEdge ? sourceOfflineDetectEdgePoint(origin) : initial.point;
  const actual = {anchor:initial.anchor,point,dispatch:marked,phases:actionEvents.map(event=>event.payload.phase),
    sameRow:target?.anchor === initial.anchor,terminalRows:terminal.length,routeChanges:routes.length};
  if (routes.length || marked.x !== point.x || marked.y !== point.y ||
      actionEvents.length > 2 || actionEvents.some(event=>!sameReady(initial.ready.payload,event.payload))) {
    return result('FAIL','The Detect click used a foreign row, point or opening or admitted more than one action',actual);
  }
  if (actionEvents.length < 2) {
    const stillReady = target && after.nodes.some(node=>visibleRole(node,sourceOfflineDetectReady) &&
      ancestorsOf(after,node).includes(target.row));
    return actionEvents.length === 0 && untouched && stillReady ?
      result('FAIL','The verified click left the current ready fixture unhandled',actual) :
      result('NOT_RUN','The current Detect admission or validated Core terminal observation is unavailable',actual);
  }
  const [admitted,settled] = actionEvents.map(event=>event.payload);
  const valid = admitted.phase === 'admitted' && settled.phase === 'settled' &&
    positive(admitted.sequence) && settled.sequence === admitted.sequence &&
    settled.mode === 'search' && exactLevels(settled.requestedLevels,'L1','L2') &&
    exactLevels(settled.levelsPassed,'L1') && settled.l1 === 'pass' && settled.l1Executed === true &&
    settled.l2 === 'fail' && settled.l2Executed === true &&
    settled.reason === reasonCode && settled.hostEvidenceCount === 0 && settled.available === false &&
    untouched && terminal.length === 1 && returnButton.verdict === 'PASS';
  const nativeInteraction = valid && (isEdge ? {subject:'row-detect',target:sourceOfflineDetectButton,
    bounds:initial.geometry.bounds,carrierPath:initial.geometry.carrierPath,visible:true,clipped:false,enabled:true,
    accepted:true,position:'top',actionId:assertion.action,baselineSampleId:assertion.baseline,dispatch:marked} :
    sourceNativeCenterInteraction(assertion,origin,action,marked));
  if (nativeInteraction) Object.assign(actual,{sampleId:assertion.sample,nativeInteraction});
  return result(valid ? 'PASS' : 'FAIL',valid ? '' :
    'The only accepted Detect did not settle L1 pass and pre-request L2 failure on the same Source row',actual);
}
