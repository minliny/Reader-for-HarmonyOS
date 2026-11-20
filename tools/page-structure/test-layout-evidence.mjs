import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from '../lib/contract-case-selection.mjs';
import { loadInputs, digest } from './lib.mjs';
import { checkLayoutEvidence } from './layout-evidence.mjs';

const definitions = { 'layout-evidence': 'Typed layout report binding, input drift, full width/scale matrices, dimensions and measurement evidence levels; synthetic reports only.' };
for (const id of selectContractCases(definitions)) {
  const page = structuredClone(loadInputs().register.pages[0]);
  page.source.sha256 = digest(page.source.path);
  page.invariants.E2.result = 'FAIL'; page.invariants.E3.result = 'FAIL';
  const producer = 'tools/test-source-management-layout.mjs';
  // Synthetic producer identity: this test checks admission logic without
  // claiming that the production layout producer or native collection ran.
  const fingerprint = path => path === producer ? 'a'.repeat(64) : digest(path);
  const paths = [page.source.path, producer,
    'entry/src/main/ets/features/common/ReaderButton.ets',
    'entry/src/main/ets/features/common/ReaderControlSpecs.ets',
    'entry/src/main/ets/features/common/ReaderTypography.ets',
    'entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts'];
  const report = { schemaVersion:'1.0', pageId:page.pageId,
    command:{entry:producer,cases:['matrix']},
    inputs:paths.map(path=>({path,sha256:fingerprint(path)})), widths:[320,366],fontScales:[1,1.3,1.6,2],
    results:{E2:'PASS',E3:'NOT_RUN'}, targets:[],budgets:[] };
  for (const width of report.widths) for (const fontScale of report.fontScales) {
    report.targets.push({controlRef:'source-login',width,fontScale,visual:{width:44,height:28},response:{width:44,height:44}});
    for (const region of ['row','chip','footer']) report.budgets.push({region,width,fontScale,availableWidth:width-38,requiredWidth:200,availableHeight:100,requiredHeight:60,rowForm:'stacked',measurementKind:'sdk'});
  }
  const inspect = (value=report, subject=page, {manifest, ...options}={}) => {
    const bytes=JSON.stringify(value), hash=createHash('sha256').update(bytes).digest('hex');
    const bound=structuredClone(subject);bound.layoutEvidence={path:'tools/page-structure/source-layout-evidence.json',sha256:hash};
    const read = path => {
      if (path === bound.layoutEvidence.path) return bytes;
      if (manifest && path === value.nativeEvidence?.path) return JSON.stringify(manifest);
      throw Error('Synthetic native manifest is absent');
    };
    return checkLayoutEvidence(bound,{read,fingerprint,...options}).diagnostics;
  };
  assert.deepEqual(inspect(),[],'scoped SDK target evidence is accepted without claiming whole-page E2/E3');
  const reject = (mutate, expected) => { const altered=structuredClone(report);mutate(altered);assert.ok(inspect(altered).some(d=>d.ruleId===expected),expected); };
  reject(r=>{r.inputs[0].sha256='0'.repeat(64);},'LAYOUT_EVIDENCE_DRIFT');
  reject(r=>{r.command.entry='tools/another-producer.mjs';},'LAYOUT_EVIDENCE_SCHEMA');
  reject(r=>{r.command.cases=['another-case'];},'LAYOUT_EVIDENCE_SCHEMA');
  reject(r=>{r.inputs=r.inputs.filter(i=>!i.path.endsWith('ReaderButton.ets'));},'LAYOUT_EVIDENCE_INPUT');
  reject(r=>{r.inputs.push(r.inputs[0]);},'LAYOUT_EVIDENCE_INPUT');
  reject(r=>{r.pageId='another-page';},'LAYOUT_EVIDENCE_SUBJECT');
  reject(r=>{r.fontScales=[1,1.3,1.6];},'LAYOUT_EVIDENCE_COVERAGE');
  reject(r=>{r.widths=[366];},'LAYOUT_EVIDENCE_COVERAGE');
  reject(r=>{r.targets.pop();},'LAYOUT_EVIDENCE_COVERAGE');
  reject(r=>{r.budgets=r.budgets.filter(b=>b.region!=='footer');},'LAYOUT_EVIDENCE_COVERAGE');
  reject(r=>{r.targets.push(r.targets[0]);},'LAYOUT_EVIDENCE_COVERAGE');
  reject(r=>{r.targets[0].response=null;},'E2');
  reject(r=>{r.targets[0].response.height=43;},'E2');
  reject(r=>{r.results.E3='PASS';},'LAYOUT_EVIDENCE_LEVEL');
  reject(r=>{r.results.E3='PASS';r.budgets.forEach(b=>b.measurementKind='native');},'LAYOUT_NATIVE_EVIDENCE_REQUIRED');
  reject(r=>{r.results.E3='PASS';r.budgets.forEach(b=>b.measurementKind='native');r.budgets[0].requiredWidth=r.budgets[0].availableWidth+1;},'E3');
  const native = structuredClone(report);native.results.E3='PASS';native.budgets.forEach(b=>b.measurementKind='native');
  const manifest = {schemaVersion:'1.0',pageId:page.pageId,measurementProvider:'reader-native-text-node',
    inputs:native.inputs.filter(input=>!input.path.startsWith('tools/')),widths:[...native.widths],fontScales:[...native.fontScales],
    samples:native.budgets.map(({region,width,fontScale,requiredWidth,requiredHeight})=>({region,width,fontScale,requiredWidth,requiredHeight}))};
  native.nativeEvidence={path:'tools/page-structure/synthetic-native-manifest.json',sha256:createHash('sha256').update(JSON.stringify(manifest)).digest('hex')};
  const claim = structuredClone(page);claim.invariants.E3.result='PASS';
  assert.deepEqual(inspect(native,claim,{manifest}),[],'synthetic native manifest exercises binding only; not actual native acceptance');
  const drifted = structuredClone(native);drifted.nativeEvidence.sha256='0'.repeat(64);
  assert.ok(inspect(drifted,claim,{manifest}).some(d=>d.ruleId==='LAYOUT_NATIVE_EVIDENCE_DRIFT'));
  assert.ok(inspect(native,claim).some(d=>d.ruleId==='LAYOUT_NATIVE_EVIDENCE_INPUT'),'frozen reference cannot replace actual manifest bytes');
  for (const [mutate, expected] of [
    [m=>m.measurementProvider='css-estimate','LAYOUT_NATIVE_EVIDENCE_SCHEMA'],
    [m=>m.inputs.pop(),'LAYOUT_NATIVE_EVIDENCE_INPUT'],
    [m=>m.samples=[],'LAYOUT_NATIVE_EVIDENCE_SCHEMA'],
    [m=>m.samples.pop(),'LAYOUT_NATIVE_EVIDENCE_COVERAGE'],
    [m=>m.samples[0].requiredWidth+=1,'LAYOUT_NATIVE_EVIDENCE_SUBJECT'],
    [m=>m.widths=[366],'LAYOUT_NATIVE_EVIDENCE_COVERAGE'],
  ]) {
    const altered=structuredClone(manifest);mutate(altered);
    const bound=structuredClone(native);bound.nativeEvidence.sha256=createHash('sha256').update(JSON.stringify(altered)).digest('hex');
    assert.ok(inspect(bound,claim,{manifest:altered}).some(d=>d.ruleId===expected),expected);
  }
  claim.invariants.E2.result='PASS';
  assert.ok(inspect(native,claim,{manifest}).some(d=>d.ruleId==='LAYOUT_EVIDENCE_COVERAGE'),'one tested target cannot close whole-page E2');
  const fullReport = structuredClone(report); fullReport.targets=[];
  for (const controlRef of page.controlRefs) for (const width of report.widths) for (const fontScale of report.fontScales) fullReport.targets.push({controlRef,width,fontScale,visual:{width:44,height:44},response:null});
  const scopedClaim = structuredClone(page); scopedClaim.invariants.E2.result='PASS';
  const missingRecovery = structuredClone(fullReport);
  missingRecovery.targets = missingRecovery.targets.filter(target => target.controlRef !== 'source-original-expand');
  const completeScopeClaim = structuredClone(scopedClaim);
  completeScopeClaim.layers.interaction.facts.targets.controlRefs = [...page.controlRefs];
  assert.ok(inspect(missingRecovery, completeScopeClaim).some(d => d.ruleId === 'LAYOUT_EVIDENCE_COVERAGE' && d.message.includes('source-original-expand')),
    'a report covering all old targets must not omit newly inventoried recovery actions');
  scopedClaim.layers.interaction.facts.targets.controlRefs=['source-login','source-detect','source-filter-chip','footer-batch','footer-add'];
  assert.ok(inspect(fullReport,scopedClaim).some(d=>d.ruleId==='LAYOUT_EVIDENCE_COVERAGE' && d.field==='layers.interaction.facts.targets.controlRefs'),'local declared minimum cannot close E2 even if the report has full control samples');
  const noReport = structuredClone(page);delete noReport.layoutEvidence;noReport.invariants.E2.result='PASS';
  assert.ok(checkLayoutEvidence(noReport).diagnostics.some(d=>d.ruleId==='LAYOUT_EVIDENCE_REQUIRED'));
  assert.ok(inspect(native,claim,{bindSource:false,manifest}).some(d=>d.ruleId==='LAYOUT_EVIDENCE_UNBOUND'));
  const bytes=JSON.stringify(report), invalidHash=structuredClone(page);invalidHash.layoutEvidence={path:'tools/page-structure/source-layout-evidence.json',sha256:'0'.repeat(64)};
  assert.ok(checkLayoutEvidence(invalidHash,{read:()=>bytes,fingerprint}).diagnostics.some(d=>d.ruleId==='LAYOUT_EVIDENCE_DRIFT'));
  recordContractCasePass(id);
}
