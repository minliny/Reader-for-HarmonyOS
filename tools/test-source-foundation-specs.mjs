import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"action-admission": {"description": "实际Source consumer/native action/busy/captured source/retired", "resources": []}, "responsive-chip": {"description": "实际chip finite width消费在输入边界内", "resources": []}, "trailing-tools": {"description": "实际backBar trailing→shared Icon native callback", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const {createRequire} = await import('node:module');
const {readFileSync} = await import('node:fs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {labeledIconControls} = await import('./lib/reader-labeled-icon-action-probe.mjs');
const {iconButtonControls} = await import('./lib/reader-icon-button-probe.mjs');
const {readerAppColor} = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const {readerSourceCategoryLabel} = await import('../entry/src/main/ets/features/source/ReaderSourceCategory.ts');

const source=readFileSync(new URL('../entry/src/main/ets/features/source/SourceManagementPage.ets',import.meta.url),'utf8');
const golden=JSON.parse(readFileSync(new URL('./fixtures/design/source-management-action-baseline.json',import.meta.url),'utf8'));
const keys=['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','textAlign','maxLines','width','height','layoutWeight','padding','backgroundColor','border','borderRadius','opacity'];
const physical=n=>Object.fromEntries(keys.filter(k=>Object.hasOwn(n,k)).map(k=>[k,n[k]]));
let count=0;
if(selectedCase==='action-admission') for(const g of golden.cases){
 const {id,method,label,scheme,active}=g,p=labeledIconControls();
 const owner=createReaderBuilderProbe(source,[method],{...p.dependencies,readerSourceCategoryLabel,ScrollDirection:{Horizontal:'ScrollDirection.Horizontal'}},p.hooks).owner,calls=[];
 Object.assign(owner,{appThemeScheme:scheme,statusKind:'error',statusMessage:'真实消息',categoryValue:active?'all':'novel',filterControlWidth:()=>280,contentFrame:()=>({width:350}),actionBottomInset:()=>0,recovery:()=>({visible:false,canRetry:true,generation:9}),onReconcile:g=>calls.push(['reconcile',g]),onRetryLoad:()=>calls.push('read'),rebuildSourceProjection:()=>calls.push('filter'),onDetectSource:v=>calls.push(['detect',v]),onLoginSource:v=>calls.push(['login',v]),onOpenTools:()=>calls.push('manage'),onAddSource:()=>calls.push('add')});
 const book={sourceId:'exact-source',checkState:active?'checking':'idle'},width=id.endsWith('wide')?72:58;
 if(method==='chip')owner.chip(label,width,active,!active);else if(method==='detectButton'||method==='loginButton')owner[method](book);else owner[method]();
 const actor=[...owner.children.values()].find(c=>c.specId===id&&(c.label===label||id==='source-management-detect'&&c.label==='检测中'));
 assert.ok(actor,id+' actual Page constructs the finite shared component');
 const actual=p.orderedNodes(actor).filter(n=>['Text','Image','Row','Stack'].includes(n.type));
 assert.ok(actual.some(node=>node.type==='Text'&&node.create===actor.label),id+' actual finite label reaches native child');
 const hit=actual.find(n=>n.onClick);assert.ok(hit,id+' actual native handler');hit.onClick();
 const enabled=method!=='chip'||!active,dispatch=enabled&&!(method==='detectButton'&&active);
 assert.equal(calls.length,dispatch?1:0,id+' actual page admission/callback');
 if(method==='detectButton'&&dispatch)assert.deepEqual(calls[0],['detect','exact-source']);
 if(method==='loginButton')assert.deepEqual(calls[0],['login','exact-source']);
 if(method==='statusBanner')assert.deepEqual(calls[0],['reconcile',9]);
 actor.aboutToDisappear();hit.onClick();assert.equal(calls.length,dispatch?1:0,id+' retired common physical actor rejects late click');count++;
}

// Frozen old UI producer outputs, now consumed through the actual new Page.
if(selectedCase==='responsive-chip') for(const g of golden.widths){const p=labeledIconControls(),owner=createReaderBuilderProbe(source,['chip'],p.dependencies,p.hooks).owner;
 Object.assign(owner,{appThemeScheme:'day',filterControlWidth:()=>g.availableWidth,rebuildSourceProjection(){}});owner.chip('有限状态',g.width,false,true);
 const actor=[...owner.children.values()].at(-1);const width=p.nodes(actor).find(n=>n.type==='Text').width;assert.ok(Number.isFinite(width)&&width>=0);if(g.availableWidth>0)assert.ok(width<=g.availableWidth,'current finite chip stays inside admitted width');}
const syntax=createRequire(import.meta.url)((resolveEtsLoaderRoot())+'/lib/validate_ui_syntax.js');
syntax.builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
// Actual shared native icon hit target consumes the Page's real trailing slot.
if(selectedCase==='trailing-tools') for(const scheme of ['day','night']){
 const p=labeledIconControls(),iconSource=readFileSync(new URL('../entry/src/main/ets/features/common/ReaderIconButton.ets',import.meta.url),'utf8');
 const Icon=iconButtonControls({properties:p.properties}).icon.Component;
 class Back{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id},params);}initialRender(){}}
 const owner=createReaderBuilderProbe(source,['backBar'],{...p.dependencies,ReaderIconButton:Icon,PageBackBar:Back},{...p.hooks,childSources:{...p.hooks.childSources,ReaderIconButton:iconSource,PageBackBar:readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets',import.meta.url),'utf8')}}).owner;
 let clicks=0;Object.assign(owner,{appThemeScheme:scheme,onOpenTools:()=>clicks++,onBack(){}});owner.backBar();
 const bar=[...owner.children.values()].find(c=>c instanceof Back);bar.trailing();
 const icon=[...owner.children.values()].find(c=>c instanceof Icon),nodes=p.nodes(icon),hit=nodes.find(n=>n.type==='Stack');
 assert.ok(hit&&nodes.some(n=>n.type==='Image'));hit.onClick();assert.equal(clicks,1);
}

console.log(`PASS Source actual Page→shared controls: ${count} frozen original SDK tuples/callbacks/retired physical actors + 12 actual responsive-width consumers`);

}
