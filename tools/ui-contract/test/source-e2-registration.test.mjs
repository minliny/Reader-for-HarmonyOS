import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { loadInputs } from '../../page-structure/lib.mjs';
import { validateModel } from '../../page-structure/validate-model.mjs';
import { checkLayoutEvidence } from '../../page-structure/layout-evidence.mjs';
import { checkNormalPageEvidence } from '../../page-structure/normal-page-evidence.mjs';
import { receiptGroupRuns, requireFrozenClaimMapping } from '../../page-structure/receipt-evidence.mjs';
import {
  readSourceE2Inventory, requireSourceE2InteractionPlan, requireSourceE2InteractionReceipts, sourceE2MissingTouchReferences,
  sourceE2Runs, sourceE2TargetSelector, sourceE2TouchAssertion,
} from '../../page-structure/source-e2-admission.mjs';
import { sourceGestureAssertion } from '../lib/source-gesture-assertion.mjs';

const inventory = readSourceE2Inventory();
const inputs = loadInputs();
const page = inputs.register.pages.find(item=>item.pageId === 'source-management');
const claim = 'invariants.E2';
const sources = ['native-tree','window-metrics','app-owner'];
const bounds = {left:20,top:100,width:44,height:44};
const painted = {left:22,top:102,width:40,height:40};
const candidate = {
  appBuildId:'0.2.0.DEV.0123456789ab',appContentHash:'a'.repeat(64),buildRunId:'same-build',
  hapSha256:'b'.repeat(64),sourceFingerprint:'c'.repeat(64),targetRef:'d'.repeat(12),
};
const digest = value => createHash('sha256').update(value).digest('hex');
const ref = path => ({path,bytes:1,sha256:digest(path)});
const readCase = id => JSON.parse(readFileSync(new URL(`../cases/${id}.json`,import.meta.url),'utf8'));

function gestureDefinitions() {
  const routes = {
    'main-list':['scroll-return','source.layout.footer-fixed'],
    'status-scroll':['filter-selections','source.filter.status-scroll'],
    'category-scroll':['filter-selections','source.filter.category-scroll'],
    'group-options-scroll':['group-options-scroll','source.group.options-scroll'],
  };
  return Object.entries(routes).map(([subject,[caseName,id]])=>{
    const contract = readCase(`source-management.${caseName}`);
    const assertion = contract.assertions.find(item=>item.id === id);
    const axis = ['main-list','group-options-scroll'].includes(subject) ? 'y' : 'x';
    const motion = sourceGestureAssertion(subject,contract,assertion);
    assert.ok(motion,`released native gesture ${subject}`);
    return {subject,contract,assertion,axis,motion};
  });
}

function interactionFixture() {
  const active = inventory.definition.targets.map(item=>item.id).filter(id=>!['status-custom','group-outside-dismiss'].includes(id));
  const caseId = 'source-management.fixture-e2-targets';
  const actions = [];
  const assertions = [];
  const checks = [];
  const proofs = new Map();
  function add(subject,kind) {
    const id = `proof.${subject}.${kind}`, sample = `capture-${subject}-${kind}`, baseline = sample+'-before';
    const target = sourceE2TargetSelector(subject);
    const common = {id,sample,evaluator:'source',required:true,sources};
    const basic = {sampleId:sample,target,carrierPath:'0/0/1',bounds};
    checks.push({caseId,assertionId:id,subject,kind});
    if (kind === 'target-area' || kind === 'disabled') {
      assertions.push({...common,kind:kind === 'disabled' ? 'filter-touch-target' : 'native-control-target',
        expected:{target,requireFullContainment:true}});
      proofs.set(id,{actual:kind === 'disabled' ? {...basic,enabled:false,clickable:false} : basic,samples:[sample]});
      return;
    }
    if (kind === 'focus') {
      assertions.push({...common,kind:'source-native-focus',expected:{stage:'query'}});
      proofs.set(id,{actual:{sampleId:sample,stage:'query',screenReaderUtterance:'NOT_RUN'},samples:[sample]});
      return;
    }
    const action = sample+'-click';
    actions.push({id:action,kind:'action',op:'click',from:baseline,target:target ?? 'reader-source-group-backdrop'});
    if (kind === 'outside-dismiss') {
      assertions.push({...common,kind:'group-outside-dismiss',baseline,action,expected:{}});
      proofs.set(id,{actual:{sampleId:sample,released:true,stableProjection:true,routeChanges:0,groupCommits:0,
        dispatch:{probeSeq:14}},samples:[sample,baseline]});
      return;
    }
    const x = {left:21,right:63}[kind] ?? 42;
    const y = {top:101,bottom:143}[kind] ?? 122;
    assertions.push({...common,kind:'source-touch-dispatch',baseline,action,expected:{target,position:kind}});
    proofs.set(id,{actual:{sampleId:sample,nativeInteraction:{subject,target,carrierPath:'0/0/1',bounds,painted,
      visible:true,clipped:false,enabled:true,accepted:true,position:kind,baselineSampleId:baseline,actionId:action,
      dispatch:{probeSeq:15,x,y}}},samples:[sample,baseline]});
  }
  for (const subject of active) {
    for (const kind of ['target-area','center','top']) add(subject,kind);
    if (['query-input','search-import','row-toggle'].includes(subject)) add(subject,'bottom');
    if (subject === 'search-import') for (const edge of ['left','right']) add(subject,edge);
  }
  add('status-custom','disabled');
  for (const [subject,kind] of [['group-outside-dismiss','outside-dismiss'],['query-input','focus']]) add(subject,kind);
  const parts = new Map([[caseId,{caseId,assertions:assertions.map(({id,sample})=>({id,sampleId:sample})),ownerSources:[page.source.path]}]]);
  const contracts = new Map([[caseId,{id:caseId,assertions,steps:actions}]]);
  const ordinary = checks.filter(check=>!['outside-dismiss','focus'].includes(check.kind));
  const extras = checks.filter(check=>['outside-dismiss','focus'].includes(check.kind));
  for (const {subject,contract,assertion,axis,motion} of gestureDefinitions()) {
    if (!parts.has(contract.id)) parts.set(contract.id,{caseId:contract.id,assertions:[],ownerSources:[page.source.path]});
    parts.get(contract.id).assertions.push({id:assertion.id,sampleId:assertion.sample});
    contracts.set(contract.id,contract);
    extras.push({caseId:contract.id,assertionId:assertion.id,subject,kind:'gesture'});
    proofs.set(assertion.id,{actual:{sampleId:assertion.sample,gestureId:subject,gestureSampleId:motion.sampleId,
      baselineSampleId:motion.baselineId,actionId:motion.actionId,distancePx:78,
      dispatch:{probeSeq:45,fromX:100,fromY:200,toX:axis === 'x' ? 40 : 100,toY:axis === 'y' ? 100 : 200,velocity:800}},
    samples:[assertion.sample,motion.baselineId,motion.sampleId]});
  }
  const cells = [320,366].flatMap(widthVp=>[1,1.3,1.6,2].map(fontScale=>({
    id:`compact-${widthVp}-${fontScale}`,widthVp,fontScale,
    checks:structuredClone(widthVp === 320 && fontScale === 1 ? [...ordinary,...extras] : ordinary),
  })));
  const mapping = {pageId:page.pageId,routeContractRef:page.routeContractRef,claim,cases:[...parts.values()],
    interactions:{inventorySha256:inventory.sha256,cells}};
  const members = sourceE2Runs(mapping,inventory).map(({part,cellId},index)=>{
    const windowCell = cells.find(cell=>cell.id === cellId);
    const targetRef = index.toString(16).padStart(12,'0');
    const memberRefs = [ref('session.json'),ref('commands.jsonl')];
    const chain = [];
    const sampleWindows = {};
    const receipts = part.assertions.map(({id})=>{
      const proof = proofs.get(id);
      const captures = [...new Set(proof.samples)].flatMap(sampleId=>{
        if (!sampleWindows[sampleId]) {
          sampleWindows[sampleId] = {widthPx:windowCell.widthVp,heightPx:780,density:1,fontScale:windowCell.fontScale,orientation:'portrait'};
          chain.push({entry:{kind:'sample',id:sampleId,screenshot:ref(sampleId+'.png'),layout:ref(sampleId+'.json')}});
        }
        const {screenshot,layout} = chain.find(link=>link.entry.id === sampleId).entry;
        return [screenshot,layout];
      });
      return {id,verdict:'PASS',actual:structuredClone(proof.actual),evidenceRefs:[...memberRefs,...captures]};
    });
    return {part,cellId,targetRef,contract:structuredClone(contracts.get(part.caseId)),
      session:{commands:memberRefs[1],chain},receipt:{caseId:part.caseId,candidate:{identity:{...candidate,targetRef}},
        session:memberRefs[0],assertions:receipts,observations:'COMPLETE',execution:'PASS',behavior:'PASS',measurement:{sampleWindows}}};
  });
  return {mapping,members};
}

function groupRoot(mapping,members) {
  return {schema:'reader-ui-contract-receipt-group-v3',pageId:mapping.pageId,routeContractRef:mapping.routeContractRef,claim,
    runs:members.map(({part,cellId,targetRef},index)=>({case:part.caseId,cell:cellId,targetRef,
      receipt:`run-${index}/receipt.json`,expectedRoot:digest(`receipt-${index}`)}))};
}

test('Source E2 lookup keeps missing touches visible and resolves only released native actions',()=>{
  const load = id=>JSON.parse(readFileSync(new URL(`../cases/source-management.${id}.json`,import.meta.url)));
  const verify = (id,definition,subject,position)=>{
    const contract = load(id);
    const assertion = contract.assertions.find(item=>item.id === definition);
    const proof = sourceE2TouchAssertion(contract,assertion);
    assert.equal(proof?.subject,subject);
    assert.equal(proof?.position,position);
    const step = contract.steps.find(item=>item.id === assertion.action);
    step.target = 'reader-unrelated';
    assert.equal(sourceE2TouchAssertion(contract,assertion),undefined);
  };
  verify('combined-filter-reset','source.clearFilters.combined','filter-empty-clear','center');
  verify('filter-empty-clear-edge','source.clearFilters.top','filter-empty-clear','top');
  verify('read-retry','source.load.retryRead','empty-read-retry','center');
  verify('read-retry-edge','source.load.retryRead.edge','empty-read-retry','top');
  verify('retained-read-retry-center','source.load.retainedReadRetry.center','read-refresh','center');
  verify('retained-read-retry-edge','source.load.retainedReadRetry.edge','read-refresh','top');
  verify('row-detect-offline','source.row.detect.offline-dispatch','row-detect','center');
  verify('row-detect-offline-edge','source.row.detect.offline-top','row-detect','top');
  verify('import-research-status-action','source.import-research-status-action','status-action','center');
  verify('import-research-status-action-edge','source.import-research-status-action.top','status-action','top');
  verify('original-recovery-body','source.recovery.original.body','original-expand-collapse','center');
  verify('original-recovery-expand-touch-edge','source.recovery.original.expand-top-edge','original-expand-collapse','top');
  verify('unknown-recovery-body','source.recovery.unknown.body','unknown-expand-collapse','center');
  verify('unknown-recovery-expand-touch-edge','source.recovery.unknown.expand-top-edge','unknown-expand-collapse','top');
  verify('filter-touch-edges','source.filter.edge.status-all-top','status-all','top');
  verify('filter-touch-edges','source.filter.edge.status-unchecked-top','status-unchecked','top');
  verify('filter-touch-edges','source.filter.edge.status-error-top','status-error','top');
  verify('filter-selections','source.filter.group','group-other-option','center');
  verify('inline-import-touch-edges','source.import.right-touch-edge','search-import','right');
  verify('row-toggle-touch-edge','source.toggle.center.enable','row-toggle','center');
  verify('chrome-touch-delivery','source.chrome.footer-add.top','footer-add','top');
  verify('category-touch-edges','source.filter.center.category-comic','category-comic','center');
  verify('category-touch-edges','source.filter.edge.category-all','category-all','top');
  verify('group-option-touch-edges','source.group.trigger-touch-edge','group-trigger','top');
  verify('group-option-touch-edges','source.group.selected-touch-center','group-selected-option','center');
  assert.deepEqual(sourceE2MissingTouchReferences(['row-login','search-import','status-custom','row-toggle'],new Map([
    ['search-import',new Set(['center','left','right'])],['row-toggle',new Set(['center','bottom','top'])],
  ])),[{id:'row-login',missing:['center','edge']},{id:'search-import',missing:['top','bottom']}]);
});

test('Source E2 registration binds all inventory targets, gestures and repeated case windows to native replay',()=>{
  const {mapping,members} = interactionFixture();
  assert.equal(page.invariants.E2.result,'FAIL');
  assert.equal(inputs.model.receiptAdmissions.some(item=>item.pageId === page.pageId && item.claim === claim),false);
  const root = groupRoot(mapping,members);
  assert.equal(receiptGroupRuns(root,mapping,inventory).length,members.length);
  assert.equal(new Set(root.runs.map(run=>run.case)).size < members.length,true);
  assert.equal(requireFrozenClaimMapping({receiptAdmissions:[]},mapping,true),true);
  assert.equal(requireFrozenClaimMapping({receiptAdmissions:[mapping]},mapping,true),false);
  assert.throws(()=>requireFrozenClaimMapping({receiptAdmissions:[{...mapping,interactions:{...mapping.interactions,cells:[]}}]},mapping,true),
    /different receipt admission mappings/u);
  requireSourceE2InteractionReceipts(mapping,inventory,members);
  for (const bad of [
    {...root,schema:'reader-ui-contract-receipt-group-v1'},
    {...root,runs:root.runs.map((run,index)=>index === 0 ? {...run,targetRef:'invalid'} : run)},
    {...root,runs:root.runs.map((run,index)=>index === 0 ? {...run,cell:'not-mapped'} : run)},
  ]) assert.throws(()=>receiptGroupRuns(bad,mapping,inventory),/Source E2 receipt group/u);
});

test('Source E2 registration refuses lost inventory, center, overlay, disabled and gesture scope',()=>{
  for (const [change,reason] of [
    [mapping=>{mapping.interactions.inventorySha256='f'.repeat(64);},/live inventory/u],
    [mapping=>{mapping.interactions.cells.pop();},/missing measured/u],
    [mapping=>{mapping.interactions.cells[0].checks= mapping.interactions.cells[0].checks.filter(item=>item.subject !== 'status-custom');},/disabled placeholder/u],
    [mapping=>{mapping.interactions.cells[0].checks= mapping.interactions.cells[0].checks.filter(item=>item.kind !== 'outside-dismiss');},/outside dismissal/u],
    [mapping=>{mapping.interactions.cells[0].checks= mapping.interactions.cells[0].checks.filter(item=>item.subject !== 'category-scroll');},/native gesture category-scroll/u],
    [mapping=>{mapping.interactions.cells[0].checks= mapping.interactions.cells[0].checks.filter(item=>item.subject !== 'header-back' || item.kind !== 'center');},/center or edge evidence/u],
  ]) {
    const {mapping} = interactionFixture();
    change(mapping);
    assert.throws(()=>requireSourceE2InteractionPlan(mapping,inventory),reason);
  }
});

test('Source E2 registration rejects static bounds, masked edges, wrong gesture roots and candidate drift',()=>{
  function proof(members,id) {
    return members.find(member=>member.receipt.assertions.some(item=>item.id === id)).receipt.assertions.find(item=>item.id === id);
  }
  for (const [change,reason] of [
    [members=>{delete proof(members,'proof.header-back.center').actual.nativeInteraction;},/no actual unclipped response area/u],
    [members=>{proof(members,'proof.search-import.top').actual.nativeInteraction.painted=bounds;},/real native top click/u],
    [members=>{proof(members,'proof.header-back.top').actual.nativeInteraction.dispatch.y=122;},/real native top click/u],
    [members=>{proof(members,'proof.query-input.center').actual.nativeInteraction.accepted=false;},/real native center click/u],
    [members=>{proof(members,'source.group.options-scroll').actual.gestureSampleId='selected-tail';},/exact native routed gesture/u],
    [members=>{proof(members,'source.filter.status-scroll').evidenceRefs=proof(members,'source.filter.status-scroll')
      .evidenceRefs.filter(item=>item.path !== 'unchecked.png');},/same-window raw screenshot/u],
    [members=>{members[1].receipt.candidate.identity.sourceFingerprint='0'.repeat(64);},/wrong candidate/u],
    [members=>{members[1].receipt.candidate.identity.targetRef='0'.repeat(12);},/wrong candidate/u],
  ]) {
    const {mapping,members} = interactionFixture();
    change(members);
    assert.throws(()=>requireSourceE2InteractionReceipts(mapping,inventory,members),reason);
  }
});

test('Source E2 registration accepts painted edges only when the actual query paint pays the response area',()=>{
  const {mapping,members} = interactionFixture();
  for (const scale of [1,2]) {
    const member = members.find(item=>item.cellId === `compact-320-${scale}` &&
      item.contract.assertions.some(proof=>proof.id === 'proof.query-input.top'));
    const id = 'proof.query-input.top';
    const definition = member.contract.assertions.find(item=>item.id === id);
    const proof = member.receipt.assertions.find(item=>item.id === id);
    definition.kind = 'source-query-touch';
    definition.expected.position = 'top';
    proof.actual.focused = true;
    proof.actual.keyboardVisible = true;
    const interaction = proof.actual.nativeInteraction;
    interaction.painted = scale === 1 ? {...bounds,top:bounds.top+1,height:42} : {...bounds,height:60};
    if (scale === 1) interaction.dispatch.y = bounds.top;
    else interaction.bounds = {...interaction.painted};
    member.receipt.measurement.sampleWindows[definition.sample].heightPx = 590;
  }
  requireSourceE2InteractionReceipts(mapping,inventory,members);
  const flat = members.find(item=>item.cellId === 'compact-320-1' &&
    item.receipt.assertions.some(proof=>proof.id === 'proof.query-input.top'));
  const proof = flat.receipt.assertions.find(item=>item.id === 'proof.query-input.top');
  proof.actual.nativeInteraction.dispatch.y++;
  assert.throws(()=>requireSourceE2InteractionReceipts(mapping,inventory,members),/real native top click/u);
  proof.actual.nativeInteraction.dispatch.y--;
  proof.actual.keyboardVisible = false;
  assert.throws(()=>requireSourceE2InteractionReceipts(mapping,inventory,members),/actual editor focus and native IME/u);
});

test('Source E2 registration requires separate SDK provenance and keeps the ordinary group scopes distinct',()=>{
  const {mapping} = interactionFixture();
  const current = loadInputs();
  const role = current.model.scenarioObligations.find(item=>item.caseId === 'source-management.scroll-return');
  const known = new Set(current.model.scenarioObligations.map(item=>item.caseId));
  current.model.scenarioObligations.push(...mapping.cases.filter(({caseId})=>!known.has(caseId))
    .map(({caseId})=>({...role,caseId})));
  current.model.receiptAdmissions.push(mapping);
  assert.deepEqual(validateModel(current).diagnostics,[]);
  mapping.claim='invariants.S5';
  assert.ok(validateModel(current).diagnostics.some(item=>item.ruleId === 'SCHEMA'));
  const report = JSON.parse(readFileSync(new URL('../../page-structure/source-layout-evidence.json',import.meta.url),'utf8'));
  const checkedPage = structuredClone(page);
  checkedPage.invariants.E2.result = 'PASS';
  checkedPage.source.sha256 = report.inputs.find(item=>item.path === page.source.path).sha256;
  const hashes = new Map(report.inputs.map(item=>[item.path,item.sha256]));
  function assess(value) {
    const bytes = JSON.stringify(value);
    return checkLayoutEvidence({...checkedPage,layoutEvidence:{path:'memory-report.json',sha256:digest(bytes)}},
      {read:()=>bytes,fingerprint:path=>hashes.get(path)}).diagnostics;
  }
  assert.deepEqual(assess(report),[]);
  const incomplete = structuredClone(report);
  incomplete.inputs = incomplete.inputs.filter(input=>input.path !== 'tools/page-structure/evidence/source-interaction.json');
  assert.ok(assess(incomplete).some(item=>item.ruleId === 'LAYOUT_EVIDENCE_PROVENANCE'));
  const legacy = {...checkedPage,layers:{},invariants:{E2:{result:'PASS',evidence:[
    {kind:'device',symbol:'normal-page',result:'PASS',path:'../out-of-workspace'},
  ]}}};
  assert.match(checkNormalPageEvidence(legacy,inputs.model)[0].message,/complete interaction claim/u);
});
