import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {labeledIconControls} from './lib/reader-labeled-icon-action-probe.mjs';
import {readerSourceCategoryLabel} from '../entry/src/main/ets/features/source/ReaderSourceCategory.ts';
const source=readFileSync(new URL('../entry/src/main/ets/features/source/SourceManagementPage.ets',import.meta.url),'utf8');
const keys=['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','textAlign','maxLines','width','height','layoutWeight','padding','backgroundColor','border','borderRadius','opacity'];
const physical=n=>Object.fromEntries(keys.filter(k=>Object.hasOwn(n,k)).map(k=>[k,n[k]]));
const cases=[['source-management-retry','statusBanner','重试'],['source-management-category','categoryFilter','全部类型'],['source-management-status-compact','chip','启用'],['source-management-status-wide','chip','未检测'],['source-management-detect','detectButton','检测'],['source-management-login','loginButton','登录'],['source-management-manage','bottomActionBar','批量管理'],['source-management-add','bottomActionBar','新增书源']];
let count=0;
for(const[id,method,label]of cases)for(const scheme of['day','night'])for(const active of[false,true]){
 const p=labeledIconControls(),owner=createReaderBuilderProbe(source,[method,'statusChipWidth'],{...p.dependencies,readerSourceCategoryLabel,ScrollDirection:{Horizontal:'ScrollDirection.Horizontal'}},p.hooks).owner,calls=[];
 Object.assign(owner,{appThemeScheme:scheme,statusKind:'error',statusMessage:'真实消息',categoryValue:active?'all':'novel',filterControlWidth:()=>280,contentFrame:()=>({width:350}),actionBottomInset:()=>0,recovery:()=>({visible:false,canRetry:true,generation:9}),onReconcile:g=>calls.push(['reconcile',g]),onRetryLoad:()=>calls.push('read'),rebuildSourceProjection:()=>calls.push('filter'),onDetectSource:v=>calls.push(['detect',v]),onLoginSource:v=>calls.push(['login',v]),onOpenTools:()=>calls.push('manage'),onAddSource:()=>calls.push('add')});
 const book={sourceId:'exact-source',checkState:active?'checking':'idle'},width=id.endsWith('wide')?72:58;
 if(method==='chip')owner.chip(label,width,active,!active);else if(method==='detectButton'||method==='loginButton')owner[method](book);else owner[method]();
 const tree=p.orderedNodes(owner),text=tree.find(n=>n.type==='Text'&&(n.create===label||id==='source-management-detect'&&n.create==='检测中'));assert.ok(text,id+' original actual label');
 const stack=['source-management-detect','source-management-login'].includes(id)?tree.find(n=>n.type==='Stack'):undefined;
 const original=id==='source-management-add'?tree.filter(n=>n.type==='Stack'||n.type==='Row'||n.type==='Text'||n.type==='Image').slice(-4):id==='source-management-manage'?tree.filter(n=>n.type==='Stack'||n.type==='Text').slice(0,2):stack?[stack,text]:[text];
 const button=new(id==='source-management-add'?p.component:p.button.Component)(undefined,{specId:id,label:text.create,icon:'app.media.source_add',scheme,primary:method==='chip'||method==='categoryFilter'?active:false,isBusy:method==='detectButton'&&active,availableWidth:280,layout:method==='bottomActionBar'?'equal':'intrinsic',actionEnabled:method==='chip'?!active:true,onAction:()=>{}});button.aboutToAppear();button.initialRender();const actual=p.orderedNodes(button).filter(n=>['Text','Image','Row','Stack'].includes(n.type));
 assert.deepEqual(actual.map(n=>n.type),original.map(n=>n.type),id+' exact original native structure');assert.deepEqual(actual.map(physical),original.map(physical),id+' original physical roles/AUTO/geometry');
 button.aboutToDisappear();count++;
}
// Original responsive math remains finite 58/72 widths; the parent supplies
// its measured filter frame, never an arbitrary button size or color.
for(const availableWidth of[0,32,150,280,350,760])for(const width of[58,72]){const p=labeledIconControls(),owner=createReaderBuilderProbe(source,['statusChipWidth'],p.dependencies,p.hooks).owner;owner.filterControlWidth=()=>availableWidth;const actor=new p.button.Component(undefined,{specId:width===58?'source-management-status-compact':'source-management-status-wide',label:'有限状态',scheme:'day',availableWidth});actor.aboutToAppear();actor.initialRender();assert.equal(p.nodes(actor).find(n=>n.type==='Text').width,owner.statusChipWidth(width));}
console.log(`PASS Source finite prerequisites: ${count} actual original SDK/spec native comparisons + 12 actual responsive-width differentials; actual page migration/owner proof remains consumer exit`);
