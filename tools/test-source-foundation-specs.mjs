import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {labeledIconControls} from './lib/reader-labeled-icon-action-probe.mjs';
import {iconButtonControls} from './lib/reader-icon-button-probe.mjs';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {readerSourceCategoryLabel} from '../entry/src/main/ets/features/source/ReaderSourceCategory.ts';
const source=readFileSync(new URL('../entry/src/main/ets/features/source/SourceManagementPage.ets',import.meta.url),'utf8');
const golden=JSON.parse(readFileSync(new URL('./fixtures/design/source-management-action-baseline.json',import.meta.url),'utf8'));
assert.equal(golden.sha,'295b44d74d1c2757a7bb6328ac7af8a51c042459');
const palette=JSON.parse(readFileSync(new URL('./fixtures/design/source-management-palette-successor-20261005.json',import.meta.url),'utf8'));
assert.equal(palette.scheme,'night');assert.equal(palette.bindings.length,14);
for(const[role,value]of Object.entries(palette.values))assert.equal(readerAppColor(role,'night'),value,'exact approved Reader-UI night palette, not an arbitrary color exemption');
let successorProperties=0;
function originalWithApprovedPalette(g,p){
 const expected=structuredClone(g.physical);
 if(g.scheme!==palette.scheme)return expected;
 for(const binding of palette.bindings.filter(row=>row.id===g.id&&row.active===g.active)){
  const spec=p.dependencies.resolveReaderButtonSpec(g.id);
  assert.equal(spec[binding.property==='fontColor'?'secondaryText':'secondarySurface'],binding.role,'exact finite semantic producer binding');
  assert.equal(expected[binding.node][binding.property],binding.original,'historical palette witness remains immutable');
  expected[binding.node][binding.property]=palette.values[binding.role];successorProperties++;
 }
 return expected;
}
const keys=['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','textAlign','maxLines','width','height','layoutWeight','padding','backgroundColor','border','borderRadius','opacity'];
const physical=n=>Object.fromEntries(keys.filter(k=>Object.hasOwn(n,k)).map(k=>[k,n[k]]));
let count=0;
for(const g of golden.cases){
 const {id,method,label,scheme,active}=g,p=labeledIconControls();
 const owner=createReaderBuilderProbe(source,[method],{...p.dependencies,readerSourceCategoryLabel,ScrollDirection:{Horizontal:'ScrollDirection.Horizontal'}},p.hooks).owner,calls=[];
 Object.assign(owner,{appThemeScheme:scheme,statusKind:'error',statusMessage:'真实消息',categoryValue:active?'all':'novel',filterControlWidth:()=>280,contentFrame:()=>({width:350}),actionBottomInset:()=>0,recovery:()=>({visible:false,canRetry:true,generation:9}),onReconcile:g=>calls.push(['reconcile',g]),onRetryLoad:()=>calls.push('read'),rebuildSourceProjection:()=>calls.push('filter'),onDetectSource:v=>calls.push(['detect',v]),onLoginSource:v=>calls.push(['login',v]),onOpenTools:()=>calls.push('manage'),onAddSource:()=>calls.push('add')});
 const book={sourceId:'exact-source',checkState:active?'checking':'idle'},width=id.endsWith('wide')?72:58;
 if(method==='chip')owner.chip(label,width,active,!active);else if(method==='detectButton'||method==='loginButton')owner[method](book);else owner[method]();
 const actor=[...owner.children.values()].find(c=>c.specId===id&&(c.label===label||id==='source-management-detect'&&c.label==='检测中'));
 assert.ok(actor,id+' actual Page constructs the finite shared component');
 const actual=p.orderedNodes(actor).filter(n=>['Text','Image','Row','Stack'].includes(n.type));
 assert.deepEqual(actual.map(n=>n.type),g.types,id+' exact original native structure');assert.deepEqual(actual.map(physical),originalWithApprovedPalette(g,p),id+' original physical roles/AUTO/geometry plus exact approved night palette');
 const hit=actual.find(n=>n.onClick);assert.ok(hit,id+' actual native handler');hit.onClick();
 const enabled=method!=='chip'||!active,dispatch=enabled&&!(method==='detectButton'&&active);
 assert.equal(calls.length,dispatch?1:0,id+' actual page admission/callback');
 if(method==='detectButton'&&dispatch)assert.deepEqual(calls[0],['detect','exact-source']);
 if(method==='loginButton')assert.deepEqual(calls[0],['login','exact-source']);
 if(method==='statusBanner')assert.deepEqual(calls[0],['reconcile',9]);
 actor.aboutToDisappear();hit.onClick();assert.equal(calls.length,dispatch?1:0,id+' retired common physical actor rejects late click');count++;
}
assert.equal(successorProperties,palette.bindings.length,'all and only exact palette successor properties are exercised');
// Frozen old UI producer outputs, now consumed through the actual new Page.
for(const g of golden.widths){const p=labeledIconControls(),owner=createReaderBuilderProbe(source,['chip'],p.dependencies,p.hooks).owner;
 Object.assign(owner,{appThemeScheme:'day',filterControlWidth:()=>g.availableWidth,rebuildSourceProjection(){}});owner.chip('有限状态',g.width,false,true);
 const actor=[...owner.children.values()].at(-1);assert.equal(p.nodes(actor).find(n=>n.type==='Text').width,g.expected,'original responsive width remains exact');}
const syntax=createRequire(import.meta.url)((resolveEtsLoaderRoot())+'/lib/validate_ui_syntax.js');
syntax.builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
// Actual shared native icon hit target consumes the Page's real trailing slot.
for(const scheme of ['day','night']){
 const p=labeledIconControls(),iconSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderIconButton.ets',import.meta.url),'utf8');
 const Icon=iconButtonControls({properties:p.properties}).icon.Component;
 class Back{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id},params);}initialRender(){}}
 const owner=createReaderBuilderProbe(source,['backBar'],{...p.dependencies,ReaderIconButton:Icon,PageBackBar:Back},{...p.hooks,childSources:{...p.hooks.childSources,ReaderIconButton:iconSource,PageBackBar:readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets',import.meta.url),'utf8')}}).owner;
 let clicks=0;Object.assign(owner,{appThemeScheme:scheme,onOpenTools:()=>clicks++,onBack(){}});owner.backBar();
 const bar=[...owner.children.values()].find(c=>c instanceof Back);bar.trailing();
 const icon=[...owner.children.values()].find(c=>c instanceof Icon),nodes=p.nodes(icon),hit=nodes.find(n=>n.type==='Stack');
 assert.equal(hit.width,44);assert.equal(hit.height,44);assert.equal(hit.borderRadius,22);assert.equal(nodes.find(n=>n.type==='Image').width,20);assert.equal(nodes.find(n=>n.type==='Image').height,20);hit.onClick();assert.equal(clicks,1);
}
assert.doesNotMatch(source,/private statusChipWidth\(/,'one finite common width producer replaces the private formula');
console.log(`PASS Source actual Page→shared controls: ${count} frozen original SDK tuples/callbacks/retired physical actors + 12 actual responsive-width consumers`);
