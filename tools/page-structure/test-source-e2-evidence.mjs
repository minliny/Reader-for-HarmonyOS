import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {selectContractCases,recordContractCasePass} from '../lib/contract-case-selection.mjs';
import {composeSourceE2} from './source-e2-evidence.mjs';
import {checkLayoutEvidence,sourceInteractiveControls} from './layout-evidence.mjs';
import {safePath,digest} from './lib.mjs';
const args=process.argv.slice(2),paths={};
for(const name of ['matrix','interaction','report']){const found=args.filter(a=>a.startsWith('--'+name+'='));assert.equal(found.length,1,'one explicit '+name+' input');paths[name]=found[0].split('=').slice(1).join('=');}
const selected=selectContractCases({'complete-targets':'SDK dimension composition with exact/minimum provenance; E2 and E3 remain NOT_RUN','rejection-boundaries':'Missing ref, undersize, stale input, matrix duplicate/missing, no parent payment and false intrinsic width rejected'}, {argv:args.filter(a=>!/^--(matrix|interaction|report)=/.test(a))});
const read=p=>readFileSync(safePath(p),'utf8'),hash=x=>createHash('sha256').update(x).digest('hex');
const matrix=JSON.parse(read(paths.matrix)),interaction=JSON.parse(read(paths.interaction)),report=JSON.parse(read(paths.report));
const page=structuredClone(JSON.parse(read('tools/page-structure/register.json')).pages.find(p=>p.pageId==='source-management'));
page.invariants.E2.result='PASS';page.invariants.E3.result='FAIL';page.layers.interaction.facts.targets.controlRefs=[...sourceInteractiveControls];
function check(value,{fingerprint=digest}={}){const bytes=JSON.stringify(value);return checkLayoutEvidence({...page,layoutEvidence:{path:'memory-report.json',sha256:hash(bytes)}},{read:p=>p==='memory-report.json'?bytes:read(p),fingerprint}).diagnostics;}
for(const id of selected){
 if(id==='complete-targets'){
  const rebuilt=composeSourceE2(matrix,interaction,{matrixInput:{path:paths.matrix,sha256:hash(read(paths.matrix))},interactionInput:{path:paths.interaction,sha256:hash(read(paths.interaction))}});
  assert.deepEqual(rebuilt.targets,report.targets);assert.deepEqual(rebuilt.budgets,report.budgets);
  assert.equal(rebuilt.targets.length,176);assert.equal(rebuilt.budgets.length,24);assert.deepEqual(new Set(rebuilt.targets.map(t=>t.controlRef)),new Set(sourceInteractiveControls));
  assert.deepEqual(rebuilt.results,{E2:'NOT_RUN',E3:'NOT_RUN'});
  assert.ok(check(rebuilt).some(d=>d.ruleId==='LAYOUT_EVIDENCE_RESULT' && d.field==='results.E2'));
  for(const t of report.targets){if(t.basis!=='exact-sdk-size'){assert.equal(t.visual,null);assert.ok(t.minimum.width>=44&&t.minimum.height>=44);}if(t.controlRef.includes('reconcile')||t.controlRef.includes('expand')||t.controlRef==='source-original-continue')assert.equal(t.basis,'native-constraint-minimum');}
  console.log(JSON.stringify({refs:22,contexts:8,targets:176,budgets:24,unknownPaintRetained:true,...rebuilt.results}));
 }
 if(id==='rejection-boundaries'){
  const altered=fn=>{const x=structuredClone(report);fn(x);return x;};
  assert.ok(check(altered(x=>x.targets=x.targets.filter(t=>t.controlRef!=='source-search'))).some(d=>d.ruleId==='LAYOUT_EVIDENCE_COVERAGE'||d.message.includes('source-search')));
  assert.ok(check(altered(x=>x.targets.find(t=>t.controlRef==='source-category-chip').minimum.width=43)).some(d=>d.ruleId==='E2'||d.message.includes('smaller')));
  assert.ok(check(report,{fingerprint:p=>p===page.source.path?'0'.repeat(64):digest(p)}).some(d=>d.message.includes('changed')));
  assert.ok(check(altered(x=>x.fontScales=[1,1.3,1.6])).length);
  assert.ok(check(altered(x=>x.targets.push(x.targets[0]))).some(d=>d.message.includes('Duplicate')));
  assert.ok(check(altered(x=>{delete x.targets.find(t=>t.controlRef==='source-category-chip').minimum;})).length,'null paint without lowerbound invalid');
  const bad=structuredClone(interaction);delete bad.records.find(r=>r.group==='group-option').parentWidthMinimum;assert.throws(()=>composeSourceE2(matrix,bad),/percentage parent|pay border/);
  const missing=structuredClone(interaction);missing.records=missing.records.filter(r=>r.group!=='header-tools');assert.throws(()=>composeSourceE2(matrix,missing),/missing control/);
  const stale=structuredClone(interaction);stale.inputs[0].sha256='0'.repeat(64);assert.throws(()=>composeSourceE2(matrix,stale),/stale source/);
  const border=structuredClone(interaction);const option=border.records.find(r=>r.group==='group-option');option.parentWidthMinimum=option.parentOuterWidthMinimum;assert.throws(()=>composeSourceE2(matrix,border),/pay border/);
  console.log(JSON.stringify({negativeBoundaries:10,thresholdUnchanged:44}));
 }
 recordContractCasePass(id);
}
