import { ancestorsOf } from './layout.mjs';
import { effectiveAppearance } from './structure.mjs';
import { sourceTextPlacement } from './source-adaptation.mjs';

export const sourceTransientStatusGuard = 'source-transient-status';
export const sourceTransientStatusLifecycle = 'source.transient-feedback';
export const sourceTransientStatusLayout = 'source.transient-text-layout';
export const sourceTransientStatusCases = {
  'source-management.import-research-status-action':{version:4,fixture:'public-source-import-research-status-v1',
    sample:'source-imported',action:'return-source-list',scope:'operation-status',role:'operation/status',
    assertion:'source.import-research-status-glyph'},
  'source-management.retained-read-failure':{version:4,fixture:'public-source-retained-read-v1',
    sample:'retained-failure',action:'reopen-sources',scope:'retained-read-failed',role:'read/retained-status',
    assertion:'source.read.retained-failure.text'},
};

const sourceImportStatusCase = 'source-management.import-research-status-action';
const legacyImportStatus = {...sourceTransientStatusCases[sourceImportStatusCase],version:3,action:'select-source-file'};
export function sourceTransientStatusCase(caseId,version) {
  if (caseId === sourceImportStatusCase && version === legacyImportStatus.version) return legacyImportStatus;
  return sourceTransientStatusCases[caseId];
}
const policies = [...Object.values(sourceTransientStatusCases),legacyImportStatus];
export const sourceTransientStatusStep = (fixture,step) => step?.captureGuard === sourceTransientStatusGuard &&
  step.kind === 'sample' && policies.find(policy=>policy.fixture === fixture?.id && step.id === policy.sample &&
    step.afterAction === policy.action);
const positive = value => Number.isSafeInteger(value) && value > 0;
const near = (a,b,tolerance) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= tolerance;
const ownerIs = (a,b) => positive(a?.generation) && Number.isSafeInteger(a?.mounting) && a.mounting >= 0 &&
  a.generation === b?.generation && a.mounting === b?.mounting;
const box = value => ['left','top','width','height'].every(key=>Number.isFinite(value?.[key])) &&
  value.width > 0 && value.height > 0;
const contains = (outer,inner) => box(outer) && box(inner) && inner.left >= outer.left && inner.top >= outer.top &&
  inner.left+inner.width <= outer.left+outer.width && inner.top+inner.height <= outer.top+outer.height;
const ownedToast = (a,b) => ownerIs(a?.owner,b?.owner) && a.scope === b.scope && a.toastGeneration === b.toastGeneration &&
  a.durationMs === b.durationMs && a.readGeneration === b.readGeneration && a.branch === b.branch && a.generation === b.generation;

export function sourceTransientStatusEvent(event,scope,{retiredOnly=false}={}) {
  const data = event?.payload;
  return event?.channel === 'business' && data?.scope === scope && positive(data.toastGeneration) &&
    data.durationMs === 2200 && ownerIs(data.owner,data.owner) && positive(data.readGeneration) &&
    (event.kind === sourceTransientStatusLifecycle &&
      (data.phase === 'retired' || !retiredOnly && data.phase === 'published') ||
      !retiredOnly && event.kind === sourceTransientStatusLayout && positive(data.hostId));
}

export const sameSourceTransientStatus = (first,event,scope) =>
  sourceTransientStatusEvent(event,scope) && ownedToast(first?.payload,event.payload);

export function matchingSourceTransientRetirement(event,possiblePublications,scope) {
  if (!sourceTransientStatusEvent(event,scope,{retiredOnly:true})) return false;
  const current = possiblePublications.findLast(candidate=>candidate.eventSeq < event.eventSeq &&
    candidate.windowRevision === event.windowRevision && candidate.kind === sourceTransientStatusLifecycle &&
    sourceTransientStatusEvent(candidate,scope));
  return current?.payload.phase === 'published' && ownedToast(current.payload,event.payload);
}

function initialImportRowMaterialization(events,labelEvent,projection,sample,observation) {
  const before = events.findLast(event=>event.kind === 'source.projection' && event.channel === 'business' &&
    event.eventSeq < labelEvent.eventSeq);
  const prior = before?.payload;
  const next = projection.payload;
  const label = labelEvent.payload;
  if (!prior || before.windowRevision !== sample.window.revision ||
      !ownerIs(prior.owner,next.owner) || !ownerIs(label.owner,prior.owner) ||
      prior.state !== 'filteredEmpty' || next.state !== 'rows' || prior.count !== 1 ||
      prior.projected !== 0 || next.projected !== 1 || prior.firstAnchor !== 0 || label.rowAnchor !== 0 ||
      !positive(next.firstAnchor) || prior.trigger !== 'owner-update' || next.trigger !== prior.trigger ||
      prior.readFact !== 'current' || prior.status !== 'all' || prior.category !== 'all' ||
      prior.allGroups !== true || prior.groupIndex !== 0 || prior.queryLength !== 0 ||
      prior.recovery !== undefined || next.recovery !== undefined ||
      !['count','status','category','allGroups','groupIndex','queryLength','readFact','readGeneration','filterRevision']
        .every(key=>prior[key] === next[key]) ||
      label.textProjectionRevision !== prior.textProjectionRevision ||
      next.textProjectionRevision !== prior.textProjectionRevision + 1 ||
      projection.eventSeq <= labelEvent.eventSeq) return undefined;

  // The row attaches behind the app-owned toast. No other semantic change
  // may intervene between the native toast layout and the current capture.
  const intervening = events.filter(event=>event.eventSeq > labelEvent.eventSeq && event.eventSeq <= sample.beforeSeq);
  if (intervening.length !== sample.beforeSeq - labelEvent.eventSeq) return undefined;
  const keepsImportStatus = (event) => {
    const data = event.payload;
    return event.kind === 'source.surface-text-layout' && event.eventSeq > projection.eventSeq &&
      data.scope === 'operation-status' && data.branch === observation.branch &&
      data.generation === observation.generation && data.statusRevision === observation.statusRevision;
  };
  if (!intervening.some(keepsImportStatus) || !intervening.every((event,index)=>{
    if (event.eventSeq !== labelEvent.eventSeq + index + 1 || event.windowRevision !== sample.window.revision) return false;
    if (event.kind === 'window-stable') return event.channel === 'probe' && event.payload.windowId === sample.window.id;
    if (event.channel !== 'business' || !ownerIs(event.payload.owner,next.owner)) return false;
    if (event.kind === 'source.projection') return event.eventSeq === projection.eventSeq;
    return (event.kind === 'source.text-layout' || keepsImportStatus(event)) &&
      event.eventSeq > projection.eventSeq && event.payload.windowRevision === sample.window.revision &&
      event.payload.readGeneration === next.readGeneration && event.payload.filterRevision === next.filterRevision &&
      event.payload.textProjectionRevision === next.textProjectionRevision && event.payload.rowAnchor === next.firstAnchor;
  })) return undefined;
  return { beforeProjectionSeq:before.eventSeq, afterProjectionSeq:projection.eventSeq };
}

function toastClipAncestors(sample,text,host) {
  const parents = ancestorsOf(sample,text);
  const root = parents.at(-1);
  if (text.clip !== false || text.parentPath === null ||
      root?.path !== '0' || root.type !== 'root' || root.parentPath !== null ||
      !parents.includes(host) || !box(text.rectPx) || !box(text.visibleRectPx) ||
      !['left','top','width','height'].every(key=>text.rectPx[key] === text.visibleRectPx[key])) return undefined;
  const chain = [text,...parents];
  if (new Set(chain.map(item=>item.path)).size !== chain.length ||
      chain.some((item,index)=>item.source !== 'native-tree' || item.visible !== true ||
        !Number.isFinite(item.opacity) || item.opacity <= 0 || typeof item.clip !== 'boolean' ||
        !box(item.rectPx) || !box(item.visibleRectPx) ||
        (index < chain.length-1 && item.path.slice(0,item.path.lastIndexOf('/')) !== chain[index+1].path))) return undefined;
  if (!Array.isArray(sample.clipShapes) || sample.clipShapes.some(shape=>shape.shape !== 'rect' &&
      chain.some(item=>shape.path === item.path || shape.id && shape.id === item.id))) return undefined;

  // Keep the painted toast as the contract boundary. A non-clipping Column or
  // Text layout box is not a vertical ink clip.
  return parents.filter(parent=>parent === host || parent.clip === true)
    .map(parent=>({path:parent.path,clip:parent.clip,rectPx:parent.visibleRectPx}));
}

export function evaluateSourceTransientStatusText({scope,sample,action,events,projection,observation}) {
  const policy = policies.find(item=>item.scope === scope);
  const state = projection.payload;
  const capture = sample.sourceTransientStatusCapture;
  const refs = [];
  const report = (verdict,reason,actual = null,observationsComplete = verdict !== 'NOT_RUN') =>
    ({role:policy.role,witness:{verdict,reason,actual,observationsComplete},evidenceRefs:refs});
  if (capture?.scope !== scope || capture.before?.eventSeq !== sample.beforeSeq || capture.after?.eventSeq !== sample.afterSeq ||
      [capture.before,capture.after].some(mark=>mark.instanceId !== sample.instanceId ||
        mark.windowRevision !== sample.window.revision || !Number.isFinite(mark.deviceMonoMs)) ||
      capture.after.deviceMonoMs <= capture.before.deviceMonoMs)
    return report('NOT_RUN','No exact native capture bracket for this Source transient status');
  const current = events.filter(event=>event.kind === sourceTransientStatusLifecycle || event.kind === sourceTransientStatusLayout)
    .filter(event=>sourceTransientStatusEvent(event,scope) && event.eventSeq > action.beforeSeq &&
      event.eventSeq <= sample.afterSeq && event.windowRevision === sample.window.revision);
  const publications = current.filter(event=>event.kind === sourceTransientStatusLifecycle && event.payload.phase === 'published' &&
    event.eventSeq <= sample.beforeSeq);
  const published = publications.at(-1);
  if (!published || !ownerIs(published.payload.owner,state.owner) || published.payload.readGeneration !== state.readGeneration ||
      (scope === 'operation-status' && (published.payload.branch !== observation.branch ||
        published.payload.generation !== observation.generation)))
    return report('NOT_RUN','No published transient status from the current Source owner and generation');
  const toast = published.payload;
  const labelEvent = current.findLast(event=>event.kind === sourceTransientStatusLayout && event.eventSeq > published.eventSeq &&
    event.eventSeq <= sample.beforeSeq && ownedToast(event.payload,toast));
  refs.push(...published.evidenceRefs ?? [],...labelEvent?.evidenceRefs ?? []);
  const window = sample.window;
  const data = labelEvent?.payload;
  const directlyCurrent = data && labelEvent.eventSeq > projection.eventSeq &&
    data.textProjectionRevision === state.textProjectionRevision;
  const rowMaterialization = scope === 'operation-status' && data && !directlyCurrent ?
    initialImportRowMaterialization(events,labelEvent,projection,sample,observation) : undefined;
  if (!data || !directlyCurrent && !rowMaterialization || data.windowRevision !== window.revision ||
      (scope === 'operation-status' && data.statusRevision !== observation.statusRevision) ||
      data.filterRevision !== state.filterRevision ||
      !near(data.density,window.density,.01) || !near(data.widthVp,window.rectPx.width/window.density,1/window.density) ||
      !near(data.heightVp,window.rectPx.height/window.density,1/window.density) ||
      !near(data.systemFontScale,window.fontScale,.01) || !near(data.fontScale,window.nativeFont.effectiveScale,.01) ||
      !Array.isArray(data.labels) || data.labels.length !== 1 || data.labels[0]?.role !== policy.role)
    return report('NOT_RUN','No fresh visible TextController ranges for this Source toast and window');
  const lifecycle = current.filter(event=>event.kind === sourceTransientStatusLifecycle && event.eventSeq > published.eventSeq);
  if (lifecycle.some(event=>event.payload.phase === 'published' || ownedToast(event.payload,toast)) ||
      !Number.isFinite(published.deviceMonoMs) || !Number.isFinite(labelEvent.deviceMonoMs) ||
      labelEvent.deviceMonoMs > capture.before.deviceMonoMs ||
      capture.after.deviceMonoMs > published.deviceMonoMs+toast.durationMs)
    return report('NOT_RUN','The scoped Source toast was replaced or expired during the native capture');
  const hosts = sample.nodes.filter(node=>node.source === 'native-tree' && node.id === `reader-transient-feedback-${toast.toastGeneration}`);
  const texts = sample.nodes.filter(node=>node.source === 'native-tree' && node.id === `reader-transient-feedback-text-${toast.toastGeneration}`);
  const [host] = hosts, [text] = texts;
  if (hosts.length !== 1 || texts.length !== 1 || host.type !== 'Row' || text.type !== 'Text' ||
      !ancestorsOf(sample,text).includes(host) || effectiveAppearance(sample,host).visible !== true ||
      !box(host.rectPx) || !box(host.visibleRectPx) || !box(text.rectPx))
    return report('NOT_RUN','The same-generation Source toast was not observed in the native hierarchy');
  const label = data.labels[0];
  if (!positive(text.sourceTransientUtf16Length))
    return report('NOT_RUN','No actual native UTF-16 text length for the visible Source toast');
  const actual = {sampleId:sample.sampleId,path:text.path,toastGeneration:toast.toastGeneration,hostId:data.hostId,
    publishedSeq:published.eventSeq,textSeq:labelEvent.eventSeq,
    ...(rowMaterialization ? {rowMaterialization} : {})};
  const visible = effectiveAppearance(sample,text).visible;
  if (visible === null) return report('NOT_RUN','The current Source toast Text visibility is unavailable',actual);
  if (!visible) return report('FAIL','The current Source toast Text is fully clipped or hidden inside its visible carrier',actual);
  if (text.sourceTransientUtf16Length !== label.utf16Length)
    return report('FAIL','The visible Source toast Text length differs from its current native text measurement',actual);
  if (!contains(host.rectPx,text.rectPx) || !contains(window.visibleRectPx,host.visibleRectPx))
    return report('FAIL','The visible Source toast Text lies outside its current native carrier',actual);
  const placementWindow = {...window,visibleRectPx:host.visibleRectPx};
  const clipAncestors = toastClipAncestors(sample,text,host);
  const nativeWrapSpaceIndexes = scope === 'retained-read-failed' ? text.sourceTransientAsciiSpaceIndexes : undefined;
  const result = sourceTextPlacement(policy.role,label,text,placementWindow,{tolerancePx:1,clipAncestors,nativeWrapSpaceIndexes});
  return report(result.verdict,result.reason,{...result.actual,...actual},
    result.observationsComplete ?? result.verdict !== 'NOT_RUN');
}
