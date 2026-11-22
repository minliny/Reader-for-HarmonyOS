export const sourceUnknownExpandFixture = 'public-source-write-unknown-v2';
export const sourceUnknownExpandScope = 'source-write-unknown';
export const sourceUnknownToggle = 'reader-source-unknown-write-public-toggle';
export const sourceUnknownToggleNativeId = 'reader-toggle:source-back:1:https://source-write-unknown.reader-phase1.invalid/:0';
export const sourceUnknownWriteAction = 'enable-for-unknown';

const versions = new Map([
  ['source-management.unknown-expand-target',3],
  ['source-management.unknown-recovery-body',2],
  ['source-management.unknown-recovery-expand-touch-edge',2],
]);
const anchors = ['reader-source-back','reader-source-footer','reader-source-list'];
const expand = 'reader-source-unknown-expand';
const writeEvent = {kind:'source.fixture-write-unknown',channel:'probe',fields:{
  'payload.scope':sourceUnknownExpandScope, 'payload.dispatched':true,
  'payload.sdkDeliveryAcknowledged':true, 'payload.beforeEnabled':false,
  'payload.observedEnabled':true, 'payload.afterVersionMatched':true,
}};
const business = (kind,fields) => ({kind,channel:'business',match:'latest',fields});
const rows = business('source.projection',{'payload.state':'rows','payload.count':1,'payload.projected':1});
const recovery = business('source.projection',{'payload.state':'recovery','payload.recovery.branch':'unknown',
  'payload.recovery.busy':false,'payload.recovery.canReconcile':true,'payload.recovery.canContinue':false});
const title = business('source.recovery-title',{'payload.branch':'unknown'});
const clipped = business('source.recovery-title',{'payload.branch':'unknown','payload.title':'clipped'});
const body = phase => business('source.recovery-body-state',{'payload.branch':'unknown','payload.phase':phase});
const sample = (id,afterAction,waitFor,quietMs = 500) => ({
  id,kind:'sample',afterAction,keyboard:false,anchors,waitFor,quietMs,
});
const click = (id,from,target,options = {}) => ({id,kind:'action',op:'click',from,target,...options});

export const sourceUnknownExpandSteps = [
  {id:'bookshelf',kind:'locate',anchors:['reader-main-tab-settings','reader-bookshelf-search-entry'],keyboard:false},
  click('open-settings','bookshelf','reader-main-tab-settings'),
  {id:'settings',kind:'locate',anchors:['reader-settings-source-management'],keyboard:false,afterAction:'open-settings'},
  click('open-sources','settings','reader-settings-source-management',{waitFor:[{kind:'source.route',
    fields:{'payload.action':'open','payload.from':'settings','payload.to':'source'}}]}),
  {...sample('source-ready','open-sources',[rows]),anchors:[...anchors,sourceUnknownToggle]},
  click(sourceUnknownWriteAction,'source-ready',sourceUnknownToggle,{beforeEvent:[rows],waitFor:[writeEvent,recovery]}),
  sample('recovery-collapsed',sourceUnknownWriteAction,[recovery,title],600),
  click('expand-recovery','recovery-collapsed',expand,{beforeEvent:[recovery,clipped],waitFor:[body('expanded')]}),
  sample('recovery-expanded','expand-recovery',[body('expanded'),business('source.surface-text-layout',{
    'payload.scope':'operation-recovery-body','payload.branch':'unknown','payload.presentation':'expanded',
  })]),
  click('collapse-recovery','recovery-expanded',expand,{beforeEvent:[recovery,clipped,body('expanded')],
    waitFor:[body('collapsed')]}),
  sample('recovery-refolded','collapse-recovery',[body('collapsed')]),
  click('expand-recovery-edge','recovery-refolded',expand,{beforeEvent:[recovery,clipped,body('collapsed')],
    waitFor:[body('expanded')],tapEdge:'top'}),
  sample('recovery-expanded-edge','expand-recovery-edge',[body('expanded')]),
];

export function usesSourceUnknownExpand(contract) {
  return versions.has(contract?.id) && contract.version === versions.get(contract.id) &&
    contract.phase === 1 && contract.pageId === 'source-management' &&
    contract.fixture?.id === sourceUnknownExpandFixture && contract.fixture.publicSources === true;
}

const positive = value => Number.isSafeInteger(value) && value > 0;
const ownerMatches = (event,entry) => event?.payload.owner?.mounting === entry.payload.mounting &&
  event?.payload.owner?.generation === entry.payload.generation;

/** Bind the actual committed-and-withheld receipt to the one normal Source route and native toggle. */
export function sourceUnknownExpandTrigger(context) {
  const open = context.actions?.['open-sources'];
  const enable = context.actions?.[sourceUnknownWriteAction];
  const ready = context.samples?.['source-ready'];
  const folded = context.samples?.['recovery-collapsed'];
  if (open?.op !== 'click' || open.targetId !== 'reader-settings-source-management' ||
      enable?.op !== 'click' || enable.targetId !== sourceUnknownToggle || enable.from !== 'source-ready' ||
      enable.outcomeSettled !== true || !ready?.captureComplete || !folded?.captureComplete ||
      [open,enable,ready].some(observation => observation.instanceId !== folded.instanceId) ||
      ready.window.id !== folded.window.id || ready.window.revision !== folded.window.revision ||
      ![open.beforeSeq,open.afterSeq,ready.beforeSeq,ready.afterSeq,enable.beforeSeq,enable.afterSeq,folded.beforeSeq]
        .every(Number.isSafeInteger) ||
      !(open.beforeSeq < open.afterSeq && open.afterSeq <= ready.beforeSeq && ready.afterSeq <= enable.beforeSeq &&
        enable.beforeSeq < enable.afterSeq && enable.afterSeq <= folded.beforeSeq)) return undefined;
  const events = (context.events ?? []).filter(event => event.instanceId === folded.instanceId);
  const routes = events.filter(event => event.kind === 'source.route' && event.channel === 'business' &&
    event.eventSeq > open.beforeSeq && event.eventSeq <= folded.beforeSeq);
  const [entry] = routes;
  const faults = events.filter(event => event.kind === writeEvent.kind);
  const [fault] = faults;
  const {beforeReadRequestId,requestId,afterReadRequestId} = fault?.payload ?? {};
  if (routes.length !== 1 || entry.payload.action !== 'open' || entry.payload.from !== 'settings' ||
      entry.payload.to !== 'source' || entry.eventSeq > open.afterSeq || faults.length !== 1 ||
      fault.channel !== writeEvent.channel || fault.eventSeq <= enable.beforeSeq || fault.eventSeq > enable.afterSeq ||
      fault.windowRevision !== folded.window.revision ||
      ![beforeReadRequestId,requestId,afterReadRequestId].every(positive) ||
      !(beforeReadRequestId < requestId && requestId < afterReadRequestId) ||
      !Object.entries(writeEvent.fields).every(([field,value]) => fault.payload[field.slice('payload.'.length)] === value)) return undefined;
  const projections = events.filter(event => event.kind === 'source.projection' && event.channel === 'business' &&
    event.eventSeq > entry.eventSeq);
  const initial = projections.findLast(event => event.eventSeq <= ready.beforeSeq);
  const current = projections.findLast(event => event.eventSeq <= folded.beforeSeq);
  if (!ownerMatches(initial,entry) || !ownerMatches(current,entry) || current.eventSeq <= fault.eventSeq ||
      current.eventSeq > enable.afterSeq || current.windowRevision !== folded.window.revision ||
      initial.windowRevision !== ready.window.revision || initial.payload.recovery !== undefined ||
      initial.payload.state !== 'rows' || initial.payload.count !== 1 || initial.payload.projected !== 1 ||
      current.payload.state !== 'recovery' || current.payload.recovery?.branch !== 'unknown' ||
      current.payload.recovery.busy !== false || current.payload.recovery.canReconcile !== true ||
      current.payload.recovery.canContinue !== false || !positive(current.payload.recovery.generation)) return undefined;
  return {evidenceRefs:[ready,open,enable,entry,initial,fault,current].flatMap(item => item.evidenceRefs ?? [])};
}
