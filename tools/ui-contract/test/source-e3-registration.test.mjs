import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {checkNormalPageEvidence} from '../../page-structure/normal-page-evidence.mjs';
import {digest,loadInputs} from '../../page-structure/lib.mjs';
import {
  admitReplayedRule,checkContractReceipt,checkContractReceiptGroup,receiptGroupRuns,requireCompatibleClaimReceipts,requireFrozenClaimMapping,
} from '../../page-structure/receipt-evidence.mjs';
import {requiresSourceE3Assertion,requireSourceE3Matrix,requireSourceE3MatrixReceipts} from '../../page-structure/source-e3-admission.mjs';
import {validateModel} from '../../page-structure/validate-model.mjs';

const read = path => JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const model = read('../../page-structure/model.json');
const page = read('../../page-structure/register.json').pages.find(item=>item.pageId === 'source-management');
const claim = 'invariants.E3';
const required = /complete measured window and text-role matrix/u;

test('Source E3 registration rejects legacy claim declarations without reading the report',()=>{
  assert.equal(page.invariants.E3.result,'FAIL');
  assert.equal(model.receiptAdmissions.some(item=>item.pageId === page.pageId && item.claim === claim),false);
  const positive = {
    ...page,
    layers:{},
    invariants:{E3:{result:'PASS',evidence:[{kind:'device',symbol:'normal-page',result:'PASS',path:'../out-of-workspace'}]}},
  };
  const [diagnostic,...rest] = checkNormalPageEvidence(positive,model);
  assert.deepEqual(rest,[]);
  assert.equal(diagnostic.field,claim);
  assert.equal(diagnostic.result,'FAIL');
  assert.match(diagnostic.message,required);
});

test('Source E3 registration rejects local single or same-window receipt mappings',()=>{
  const part = {
    caseId:'source-management.layout-expanded',
    assertions:[{id:'source.layout.adaptation-surface',sampleId:'source-ready'}],
    ownerSources:[page.source.path],
  };
  const owner = {pageId:page.pageId,routeContractRef:page.routeContractRef,claim};
  const single = {...model,receiptAdmissions:[{...owner,...part}]};
  assert.throws(()=>checkContractReceipt(page,single,claim,{}),required);
  const group = {...model,receiptAdmissions:[{...owner,cases:[part,{...part,caseId:'source-management.layout-width-320'}]}]};
  assert.throws(()=>checkContractReceiptGroup(page,group,claim,{}),required);
});

const baseRoles = ['stats', 'status/all', 'category/all', 'group/label', 'footer/manage', 'footer/add', 'row/category', 'row/detect'];
const stateRoles = new Map([
  ['status-filter', ['status/all', 'status/enabled', 'status/error', 'status/unchecked', 'status/custom']],
  ['category-filter', ['category/all', 'category/novel', 'category/comic', 'category/music', 'category/download', 'category/external', 'category/other']],
  ['group-menu', ['group/option-head', 'group/option-tail']],
  ['row-actions', ['row/login']],
  ['read-empty', ['read/empty-title', 'read/empty-message', 'footer/add']],
  ['read-failed', ['read/failure-title', 'read/failure-message', 'read/retry']],
  ['retained-read-failed', ['read/retained-status', 'read/retained-retry']],
  ['operation-status', ['operation/status', 'operation/action']],
  ['operation-recovery', [
    'recovery/original/message', 'recovery/original/expand', 'recovery/original/reconcile', 'recovery/original/continue',
    'recovery/unknown/message', 'recovery/unknown/expand', 'recovery/unknown/reconcile',
  ]],
]);
const scopesWithConditions = new Set(['read-failed', 'retained-read-failed', 'operation-recovery']);
const sources = ['app-owner', 'native-tree', 'window-metrics'];
const candidate = {
  appBuildId:'0.2.0.DEV.0123456789ab', appContentHash:'a'.repeat(64), buildRunId:'prepared-run',
  hapSha256:'b'.repeat(64), sourceFingerprint:'c'.repeat(64), hdcServer:'127.0.0.1:8710',
  targetRef:'0123456789ab', targetKind:'vm',
};

function matrixFixture() {
  const mapping = {pageId:page.pageId, routeContractRef:page.routeContractRef, claim, cases:[], matrix:[]};
  const members = [];
  function addCell(widthVp, heightVp, fontScale, orientation) {
    const cell = {widthVp, heightVp, fontScale, orientation, samples:[]};
    mapping.matrix.push(cell);
    return cell;
  }
  function addSample(cell, scope, roles) {
    const {widthVp, heightVp, fontScale:scale, orientation} = cell;
    const caseId = `source-management.e3-test-${members.length}`;
    const sampleId = `${scope}-sample`;
    const textId = 'source.e3.text';
    const layout = ['default', 'expanded'].includes(scope);
    const conditional = scopesWithConditions.has(scope);
    const rowActions = scope === 'row-actions';
    const condition = conditional ? {condition:'The same native Source opening shows this recovery condition'} : {};
    const definitions = [
      ...(layout ? ['adaptation', 'adaptation-surface'] : []),
      ...(conditional ? ['read-surface'] : []),
    ].map(kind => ({id:`source.e3.${kind}`, evaluator:'source', kind, required:true, sample:sampleId, sources}));
    if (conditional) Object.assign(definitions[0], {required:false, ...condition});
    if (rowActions) definitions.push({id:'source.row.status.badge', evaluator:'source', kind:'row-status-badge',
      required:true, sample:sampleId, sources, expected:{state:'unchecked'}});
    definitions.push({id:textId, evaluator:'source', kind:layout ? 'adaptation-text' : 'state-text', required:!conditional, ...condition,
      sample:sampleId, sources, expected:{expanded:scope === 'expanded'}});
    const part = {caseId, ownerSources:[page.source.path], assertions:definitions.map(({id})=>({id,sampleId}))};
    const proof = {
      widthVp, scale, textProjectionRevision:7,
      nativeFont:{vpPixels:3.5, fpPixels:3.5*scale, effectiveScale:scale, followsSystemFontScale:true, maxFontScale:2},
    };
    const actual = {
      sampleId, textScope:scope, ...proof, ...(rowActions ? {rowAnchor:12} : {}),
      roles:Object.fromEntries(roles.map((role,index)=>[role,{verdict:'PASS', actual:{
        path:`0/4/${index}`, utf16Length:4, startUtf16:0, endUtf16:4, lineCount:1, rangeCount:1, tailCount:1,
      }}])),
    };
    const presentCondition = {status:'APPLIES', required:true, sampleApplies:true};
    const badge = {sampleId, rowAnchor:12, state:'unchecked', carrierPath:'0/9/4', vectorPath:'0/9/4/0'};
    const receipt = {
      caseId, candidate:{identity:{...candidate}},
      observations:'COMPLETE', execution:'PASS', behavior:'PASS',
      assertions:definitions.map(({id,kind})=>({id, verdict:'PASS',
        actual:id === textId ? actual : kind === 'row-status-badge' ? badge : {sampleId}})),
      measurement:{sampleWindows:{[sampleId]:{widthPx:Math.round(widthVp*3.5), heightPx:Math.round(heightVp*3.5),
        density:3.5, fontScale:scale, orientation}}},
      ...(conditional ? {conditions:{'source.e3.read-surface':{...presentCondition}, [textId]:{...presentCondition}}} : {}),
    };
    cell.samples.push({caseId, sampleId, scope, textAssertions:[{id:textId, roles:[...roles]}]});
    mapping.cases.push(part);
    const contract = {id:caseId, assertions:definitions};
    members.push({part, receipt, contract});
    if (scope === 'status-filter') {
      const tailSample = `${sampleId}-after-scroll`;
      const tailRoles = cell.samples.at(-1).textAssertions[0].roles.splice(3);
      definitions.at(-1).tailSample = tailSample;
      for (const role of tailRoles) actual.roles[role].actual.sampleId = tailSample;
      actual.sampleProofs = {[tailSample]:{...proof, textProjectionRevision:8}};
      receipt.measurement.sampleWindows[tailSample] = {...receipt.measurement.sampleWindows[sampleId]};
      cell.samples.push({caseId, sampleId:tailSample, scope, textAssertions:[{id:textId, roles:tailRoles}]});
    }
  }
  for (const width of [320,366]) {
    for (const scale of [1,1.3,1.45,1.6,2]) {
      const cell = addCell(width,720,scale,'portrait');
      addSample(cell,'default',baseRoles);
      if (scale === 2) {
        addSample(cell,'status-filter',stateRoles.get('status-filter'));
        addSample(cell,'category-filter',stateRoles.get('category-filter'));
      }
    }
  }
  const expanded = addCell(700,400,1.6,'landscape');
  addSample(expanded,'expanded',baseRoles);
  for (const [scope, roles] of [...stateRoles].slice(2)) addSample(expanded,scope,roles);
  return {mapping,members};
}

test('Source E3 registration admits a complete replayed matrix and retains S5 same-window checks',()=>{
  const {mapping,members} = matrixFixture();
  requireSourceE3MatrixReceipts(mapping,members);
  const defaultMembers = members.filter(member=>member.contract.assertions.some(assertion=>assertion.kind === 'adaptation'));
  assert.throws(()=>requireCompatibleClaimReceipts(defaultMembers), /different measured window configurations/u);
  const mappedModel = {...model, receiptAdmissions:[mapping]};
  const legacy = {
    ...page, layers:{},
    invariants:{E3:{result:'PASS',evidence:[
      {kind:'device',symbol:'normal-page',result:'PASS',path:'../out-of-workspace'},
      {kind:'device',symbol:'ui-contract-receipt',result:'PASS',path:'../out-of-workspace'},
    ]}},
  };
  assert.match(checkNormalPageEvidence(legacy,mappedModel)[0].message,/requires the model-owned grouped native matrix receipt/u);
  assert.throws(()=>checkContractReceipt(page,mappedModel,claim,{}), /unambiguous owner mapping/u);
  legacy.invariants.E3.evidence = [{kind:'device',symbol:'ui-contract-receipt-group',result:'PASS'}];
  assert.match(checkNormalPageEvidence(legacy,mappedModel)[0].message,/no independently pinned root/u);
});

test('Source E3 registration admits exactly the listed alternatives for a role in its own measured cell',()=>{
  const {mapping,members} = matrixFixture();
  const head = 'status-filter-sample';
  const tail = 'status-filter-sample-after-scroll';
  const first = members.find(member=>member.receipt.measurement.sampleWindows[head]);
  const samples = mapping.matrix.flatMap(cell=>cell.samples.filter(sample=>sample.caseId === first.part.caseId));
  const role = 'status/error';
  const tailRoles = samples.find(sample=>sample.sampleId === tail).textAssertions[0].roles;
  const actual = first.receipt.assertions.at(-1).actual;
  const proof = actual.roles[role].actual;
  tailRoles.push(role);
  for (const sampleId of [head,tail]) {
    proof.sampleId = sampleId;
    requireSourceE3MatrixReceipts(mapping,members);
  }
  first.receipt.measurement.sampleWindows['not-listed'] = {...first.receipt.measurement.sampleWindows[tail]};
  actual.sampleProofs['not-listed'] = {...actual.sampleProofs[tail]};
  proof.sampleId = 'not-listed';
  assert.throws(()=>requireSourceE3MatrixReceipts(mapping,members), /wrong role/u);
  proof.sampleId = head;
  delete first.receipt.measurement.sampleWindows[tail];
  assert.throws(()=>requireSourceE3MatrixReceipts(mapping,members), /wrong native window/u);
  tailRoles.push(role);
  assert.throws(()=>requireSourceE3Matrix(mapping), /duplicate role/u);
});

test('Source E3 registration rejects missing, duplicate or incomplete model window cells',()=>{
  for (const [change, reason] of [
    [mapping=>{const cell=mapping.matrix.shift(); mapping.cases.shift(); assert.equal(cell.widthVp,320);}, /default 320vp \/ 1×/u],
    [mapping=>{mapping.matrix.push(structuredClone(mapping.matrix[0]));}, /duplicate window cell/u],
    [mapping=>{mapping.matrix[0].samples[0].textAssertions[0].roles.pop();}, /default 320vp \/ 1× cell with its complete roles/u],
    [mapping=>{mapping.matrix[4].samples.find(sample=>sample.scope === 'status-filter').textAssertions[0].roles.shift();}, /320vp \/ 2× status-filter/u],
    [mapping=>{mapping.matrix.at(-1).samples[0].textAssertions[0].roles.pop();}, /missing expanded/u],
  ]) {
    const {mapping} = matrixFixture();
    change(mapping);
    assert.throws(()=>requireSourceE3Matrix(mapping),reason);
  }
});

test('Source E3 registration pins each deployment when one signed candidate spans separately collected windows',()=>{
  const {mapping,members} = matrixFixture();
  const narrower = new Set(mapping.matrix.filter(cell => cell.widthVp === 320).flatMap(cell => cell.samples.map(row => row.caseId)));
  const secondary = 'abcdef012345';
  for (const member of members) {
    if (narrower.has(member.part.caseId)) member.receipt.candidate.identity.targetRef = secondary;
  }
  const group = {schema:'reader-ui-contract-receipt-group-v2', pageId:mapping.pageId,routeContractRef:mapping.routeContractRef,
    claim:mapping.claim, runs:members.map(({part,receipt},index)=>({case:part.caseId,receipt:`run-${index}/receipt.json`,
      expectedRoot:index.toString(16).padStart(64,'0'),targetRef:receipt.candidate.identity.targetRef}))};
  const pins = selected => new Map(receiptGroupRuns(selected,mapping).map(({run})=>[run.case,run.targetRef]));
  const targets = pins(group);
  requireSourceE3MatrixReceipts(mapping,members,targets);
  assert.throws(()=>requireSourceE3MatrixReceipts(mapping,members),/wrong or duplicate candidate/u,'v1 remains same-deployment');
  const switched = structuredClone(members[0]);
  switched.receipt.candidate.identity.targetRef = candidate.targetRef;
  assert.throws(()=>requireCompatibleClaimReceipts([members[0],switched]),
    /candidate, source, deployment or target/u,'S5 is unchanged at the same measured window');
  assert.throws(()=>receiptGroupRuns({...group,claim:'invariants.S5'},{...mapping,claim:'invariants.S5'}),/Receipt group/u);
  const unpinned = structuredClone(group);
  delete unpinned.runs[0].targetRef;
  assert.throws(()=>pins(unpinned),/Receipt group/u);
  const other = members[0].receipt.candidate.identity;
  other.targetRef = candidate.targetRef;
  assert.throws(()=>requireSourceE3MatrixReceipts(mapping,members,targets),/wrong deployment target/u);
  other.targetRef = secondary;
  other.hapSha256 = 'd'.repeat(64);
  assert.throws(()=>requireSourceE3MatrixReceipts(mapping,members,targets),/wrong signed candidate/u);
  other.hapSha256 = candidate.hapSha256;
  const sameCell = mapping.matrix.find(cell => cell.widthVp === 320 && cell.samples.length > 1);
  const peer = members.find(member => member.part.caseId === sameCell.samples[1].caseId).receipt.candidate.identity;
  peer.hdcServer = '192.0.2.1:8710';
  assert.throws(()=>requireSourceE3MatrixReceipts(mapping,members,targets),/one matrix cell use different collection targets/u);
});

test('Source E3 registration enrolls initially unmapped capture without overriding an existing frozen claim',()=>{
  const {mapping} = matrixFixture();
  assert.equal(requireFrozenClaimMapping({receiptAdmissions:[]},mapping,true),true);
  assert.equal(requireFrozenClaimMapping({receiptAdmissions:[mapping]},mapping,true),false);
  assert.throws(()=>requireFrozenClaimMapping({receiptAdmissions:[]},mapping),/different receipt admission mappings/u);
  const different = structuredClone(mapping);
  different.matrix[0].heightVp += 1;
  assert.throws(()=>requireFrozenClaimMapping({receiptAdmissions:[different]},mapping,true),/different receipt admission mappings/u);
  assert.throws(()=>requireFrozenClaimMapping({}, {...mapping,claim:'invariants.S5'},true),/different receipt admission mappings/u);
});

test('Source E3 registration first enrollment still pins new owners and inherited causal conditions',()=>{
  const contract = read('../cases/source-management.retained-read-failure.json');
  const glyph = contract.assertions.find(assertion => assertion.kind === 'surface-text');
  const ownerPath = 'entry/src/main/ets/ui/feedback/ReaderTransientToast.ets';
  const owner = {path:ownerPath,sha256:digest(ownerPath)};
  const source = {path:page.source.path,sha256:digest(page.source.path)};
  const livePage = {...page,source,sourceInputs:[owner]};
  const identity = {appBuildId:candidate.appBuildId,hapSha256:candidate.hapSha256,
    sourceFingerprint:candidate.sourceFingerprint,targetRef:candidate.targetRef};
  const currentCase = structuredClone(contract);
  const args = {
    page:livePage,claim,contract,currentCase,initialEnrollment:true,frozenPage:page,
    evidence:{candidate:identity},snapshot:{files:[source,owner]},model:{scenarioObligations:[{caseId:contract.id}]},
    receipt:{caseId:contract.id,page:{id:page.pageId,registration:'REGISTERED_PAGE'},candidate:{identity},
      observations:'COMPLETE',execution:'PASS',behavior:'PASS'},
    mapping:{pageId:page.pageId,routeContractRef:page.routeContractRef,claim,caseId:contract.id,
      ownerSources:[ownerPath],assertions:[{id:glyph.id,sampleId:glyph.sample}]},
  };
  assert.throws(()=>admitReplayedRule({...args,snapshot:{files:[source]}}),/does not match the deployed and live bytes/u);
  assert.throws(()=>admitReplayedRule({...args,initialEnrollment:false}),/registration source differs|deployed and live bytes/u);
  const parent = currentCase.assertions.find(assertion => assertion.id === glyph.expected.conditionAssertion);
  parent.source += '-changed';
  assert.throws(()=>admitReplayedRule(args), /current case changed the registered assertion source.load.retainedReadFailure/u);
});

test('Source E3 registration rejects wrong candidate, missing receipt and wrong measured configurations',()=>{
  for (const [change, reason] of [
    [members=>{members[1].receipt.candidate.identity.buildRunId='different-run';}, /wrong or duplicate candidate/u],
    [members=>{members[0].receipt.observations='INCOMPLETE';}, /incomplete native receipt/u],
    [members=>{members[0].receipt.execution='FAIL';}, /incomplete native receipt/u],
    [members=>{members.pop();}, /missing mapped case receipts/u],
    [members=>{members.push(members[0]);}, /wrong or duplicate candidate/u],
    [members=>{members[0].receipt.measurement.sampleWindows['default-sample'].widthPx=1280;}, /wrong native window/u],
    [members=>{members[0].receipt.measurement.sampleWindows['default-sample'].fontScale=1.3;}, /wrong native window/u],
    [members=>{members[0].receipt.measurement.sampleWindows['default-sample'].orientation='landscape';}, /wrong native window/u],
    [members=>{
      const status = members.find(member=>member.receipt.measurement.sampleWindows['status-filter-sample-after-scroll']);
      status.receipt.measurement.sampleWindows['status-filter-sample-after-scroll'].heightPx--;
    }, /one matrix cell use different native windows/u],
  ]) {
    const {mapping,members} = matrixFixture();
    change(members);
    assert.throws(()=>requireSourceE3MatrixReceipts(mapping,members),reason);
  }
});

test('Source E3 registration rejects geometry-only, foreign-role, stale font and absent recovery proof',()=>{
  const statusMember = members=>members.find(member=>member.receipt.measurement.sampleWindows['status-filter-sample']);
  for (const [change, reason] of [
    [members=>{members[0].contract.assertions.at(-2).kind='layout';}, /missing chip, row and footer growth budget/u],
    [members=>{members[0].receipt.assertions.at(-1).actual.roles['row/detect'].actual.tailCount=0;}, /incomplete native line and trailing range/u],
    [members=>{
      const {roles}=members[0].receipt.assertions.at(-1).actual;
      roles['row/login']=roles['row/detect'];
      delete roles['row/detect'];
    }, /wrong or incomplete scoped text assertion/u],
    [members=>{members[0].receipt.assertions.at(-1).actual.nativeFont.fpPixels=7;}, /matching native font readback/u],
    [members=>{members[0].receipt.assertions.at(-1).actual.nativeFont.followsSystemFontScale=false;}, /matching native font readback/u],
    [members=>{members[0].receipt.assertions.at(-1).actual.textProjectionRevision=0;}, /missing current projection/u],
    [members=>{statusMember(members).receipt.assertions.at(-1).actual.roles['status/custom'].actual.sampleId='other';}, /wrong role/u],
    [members=>{delete statusMember(members).receipt.assertions.at(-1).actual.sampleProofs;}, /missing current projection/u],
    [members=>{
      const row=members.find(member=>member.receipt.measurement.sampleWindows['row-actions-sample']);
      row.receipt.assertions.find(record=>record.id === 'source.row.status.badge').actual.rowAnchor++;
    }, /missing same-row native status badge/u],
    [members=>{
      const recovery=members.find(member=>member.receipt.measurement.sampleWindows['operation-recovery-sample']);
      recovery.receipt.conditions['source.e3.text']={status:'DOES_NOT_APPLY', required:false, sampleApplies:false};
      recovery.receipt.conditions['source.e3.read-surface']={status:'DOES_NOT_APPLY',sampleApplies:false};
    }, /missing applicable current condition/u],
  ]) {
    const {mapping,members} = matrixFixture();
    change(members);
    assert.throws(()=>requireSourceE3MatrixReceipts(mapping,members),reason);
  }
});

test('Source E3 registration requires the current applicable conditional sample before treating an optional assertion as required',()=>{
  const definition = {id:'source.recovery.control', condition:'The current opening shows the control', required:false};
  const applied = {status:'APPLIES', required:true, sampleApplies:true};
  const isRequired = (value, observed)=>requiresSourceE3Assertion(value, {conditions:{[definition.id]:observed}});
  assert.equal(isRequired(definition,applied),true);
  assert.equal(isRequired({id:definition.id,required:false},applied),false);
  for (const observed of [undefined, {...applied,status:'UNKNOWN'}, {...applied,required:false},
    {...applied,sampleApplies:false}, {...applied,status:'DOES_NOT_APPLY'}]) {
    assert.equal(isRequired(definition,observed),false);
  }
  assert.equal(isRequired({id:definition.id,required:true},undefined),true);
});

test('Source E3 registration model schema accepts complete Source E3 only and rejects a matrix on another claim',()=>{
  const {mapping} = matrixFixture();
  const inputs = loadInputs();
  const sample = inputs.model.scenarioObligations.find(obligation=>obligation.caseId === 'source-management.layout-width-320');
  inputs.model.scenarioObligations.push(...mapping.cases.map(({caseId})=>({...sample,caseId})));
  inputs.model.receiptAdmissions.push(mapping);
  assert.deepEqual(validateModel(inputs).diagnostics,[]);

  const defaultCell = mapping.matrix.shift();
  const defaultCase = mapping.cases.shift();
  const result = validateModel(inputs).diagnostics;
  assert.ok(result.some(item=>item.ruleId === 'RECEIPT_ADMISSION' && item.field === claim && /default 320vp \/ 1×/u.test(item.message)));
  mapping.matrix.unshift(defaultCell);
  mapping.cases.unshift(defaultCase);
  mapping.claim = 'invariants.S5';
  assert.ok(validateModel(inputs).diagnostics.some(item=>item.ruleId === 'SCHEMA' && item.field.includes('/receiptAdmissions/')));
});

test('Source E2 registration rejects a legacy normal-page claim even while lookup references exist',()=>{
  const e2 = 'invariants.E2';
  assert.equal(page.invariants.E2.result,'FAIL');
  assert.ok(model.receiptCoverageReferences.some(item=>item.pageId === page.pageId && item.claim === e2));
  assert.equal(model.receiptAdmissions.some(item=>item.pageId === page.pageId && item.claim === e2),false);
  const declared = {
    ...page, layers:{},
    invariants:{E2:{result:'PASS',evidence:[
      {kind:'device',symbol:'normal-page',result:'PASS',path:'../out-of-workspace'},
    ]}},
  };
  const [diagnostic,...rest] = checkNormalPageEvidence(declared,model);
  assert.deepEqual(rest,[]);
  assert.equal(diagnostic.field,e2);
  assert.equal(diagnostic.result,'FAIL');
  assert.match(diagnostic.message,/model-owned native receipt covering the complete interaction claim/u);
});
