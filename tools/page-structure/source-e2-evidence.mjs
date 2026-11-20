import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {safePath,digest} from './lib.mjs';
import {sourceInteractiveControls} from './layout-evidence.mjs';
const entry='tools/page-structure/source-e2-evidence.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function composeSourceE2(matrix,interaction,{matrixInput,interactionInput,fingerprint=digest}={}){
 assert.deepEqual(matrix.widths,[320,366]);assert.deepEqual(matrix.fontScales,[1,1.3,1.6,2]);
 assert.equal(matrix.results.E2,'PASS');assert.equal(interaction.results.sdkProperties,'PASS');
 assert.deepEqual(interaction.command.cases,['inventory','sdk-targets','recovery-targets']);
 const inputs=new Map();for(const input of [...matrix.inputs,...interaction.inputs]){
  assert.equal(fingerprint(input.path),input.sha256,'stale source input '+input.path);
  if(inputs.has(input.path))assert.equal(inputs.get(input.path),input.sha256,'producer input mismatch');inputs.set(input.path,input.sha256);
 }
 const records=interaction.records,targets=[];
 const groupFor={'page-back':'header-back','source-tools':'header-tools','source-add-inline':'search-import','source-search':'query-input','source-filter-chip':'status-chip','source-group-select':'group-trigger','source-login':'row-login','source-detect':'row-detect','source-toggle':'row-toggle','source-category-chip':'category-chip','source-group-option':'group-option'};
 const recoveryFor={'source-status-action':['recovery-notice','核对'],'source-read-refresh':['recovery-compact','刷新列表'],'source-read-retry':['page-state','重试'],'source-filter-clear':['page-state','清除筛选'],'source-original-reconcile':['recovery-notice','核对'],'source-original-continue':['recovery-notice','继续'],'source-original-expand':['recovery-notice','展开'],'source-unknown-reconcile':['recovery-notice','核对'],'source-unknown-expand':['recovery-notice','展开']};
 for(const controlRef of sourceInteractiveControls)for(const width of matrix.widths)for(const fontScale of matrix.fontScales){
  if(['footer-batch','footer-add'].includes(controlRef)){
   const rows=matrix.targets.filter(r=>r.controlRef===controlRef&&r.width===width&&r.fontScale===fontScale);assert.equal(rows.length,1);targets.push({...rows[0],basis:'exact-sdk-size',boundary:'actual SDK leaf height and actual equal parent allocation; no native glyph inference'});continue;
  }
  const select=records.map((r,index)=>({r,index})).filter(({r})=>(r.width??r.widthContext)===width&&r.fontScaleContext===fontScale&&(recoveryFor[controlRef]?(r.group===recoveryFor[controlRef][0]&&r.label===recoveryFor[controlRef][1]):r.group===groupFor[controlRef]));
  assert.ok(select.length,'missing control samples '+controlRef);let sizes=[],allExact=true,percentage=false;
  for(const {r}of select){
   const v=r.visual,rs=r.response,m=v.minimum??{};
   if(r.group==='group-option'){assert.ok(Number.isFinite(r.parentOuterWidthMinimum)&&Number.isFinite(r.parentBorderWidth),'missing actual Panel border facts');assert.equal(r.parentWidthMinimum,r.parentOuterWidthMinimum-2*r.parentBorderWidth,'Panel outer width must pay border before leaf percent');}
   let w=rs?.width??v.width??m.minWidth,h=rs?.height??v.height??m.minHeight;
   if(w==='100%'){assert.ok(Number.isFinite(r.parentWidthMinimum)&&r.parentWidthMinimum>=44,'missing real percentage parent payment '+controlRef);w=r.parentWidthMinimum;percentage=true;allExact=false;}
   else if(v.width===null||v.height===null){allExact=false;}
   assert.ok(Number.isFinite(w)&&Number.isFinite(h)&&w>=44&&h>=44,'actual target smaller than44 or absent '+controlRef);
   if(r.group==='search-import'){assert.deepEqual(r.responseInCarrier,{x:0,y:0,width:44,height:44});assert.deepEqual(r.parentCarrier,{width:44,height:44});}
   sizes.push({width:w,height:h});
  }
  const size={width:Math.min(...sizes.map(s=>s.width)),height:Math.min(...sizes.map(s=>s.height))};
  const first=select[0].r;
  const visual=allExact&&typeof first.visual.width==='number'&&typeof first.visual.height==='number'?{width:Math.min(...select.map(({r})=>r.visual.width)),height:Math.min(...select.map(({r})=>r.visual.height))}:null;
  const response=allExact&&first.response?size:null;
  targets.push({controlRef,width,fontScale,visual,response,...(!allExact?{minimum:size}:{}),basis:percentage?'percentage-parent-minimum':allExact?'exact-sdk-size':'native-constraint-minimum',sourceRecords:select.map(s=>s.index),boundary:allExact?'SDK native carrier/response attributes; no pixel or pointer inference':percentage?'Actual 100% leaf response paid by production parent allocation/minimum; intrinsic glyph width/height remain unknown':'Actual native minWidth/minHeight constraints; ambient recovery font contexts are labels, not measured four-font paint'});
 }
 for(const x of [matrixInput,interactionInput])if(x)inputs.set(x.path,x.sha256);
 for(const path of [entry,'tools/page-structure/layout-evidence.mjs','tools/page-structure/schema/layout-evidence.schema.json','entry/src/main/ets/features/common/ReaderTokens.ets','tools/test-source-group-border-budget.mjs','tools/fixtures/design/source-group-border-before/ReaderSelectPanel.ets'])inputs.set(path,fingerprint(path));
 return {schemaVersion:'1.0',pageId:'source-management',command:{entry,cases:['complete-targets']},inputs:[...inputs].map(([path,sha256])=>({path,sha256})),widths:matrix.widths,fontScales:matrix.fontScales,results:{E2:'PASS',E3:'NOT_RUN'},targets,budgets:matrix.budgets};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [matrixPath,interactionPath,outputPath]=process.argv.slice(2);assert.ok(matrixPath&&interactionPath&&outputPath,'explicit matrix, interaction, output required');assert.ok(outputPath.startsWith('.reader-artifacts/'));
 const a=readFileSync(safePath(matrixPath),'utf8'),b=readFileSync(safePath(interactionPath),'utf8');const out=composeSourceE2(JSON.parse(a),JSON.parse(b),{matrixInput:{path:matrixPath,sha256:hash(a)},interactionInput:{path:interactionPath,sha256:hash(b)}});
 writeFileSync(safePath(outputPath),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({targets:out.targets.length,controlRefs:new Set(out.targets.map(t=>t.controlRef)).size,budgets:out.budgets.length,E2:out.results.E2,E3:out.results.E3}));
}
