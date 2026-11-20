import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'category-minimum':'Source actual category Text minimum, old missing-floor negative; SDK properties only','style-isolation':'Finite registered button spec setter differential, exact finite historical missing-floor delta, current registered spec setter differential','tools-consumer':'Actual Tools action builders retain real Text minimum and grown height','group-parent':'Actual Source/Panel parent width payment and viewport clamp; no glyph measurement'});
if (selected.length) {
const resolution=registerHooks({resolve(s,c,n){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(u)))return n(u.href,c);}return n(s,c);}});
try {
const {foundationControls,foundationModifiers,foundationSpecs,readerFoundationTokens}=await import('./lib/reader-foundation-control-probe.mjs');
const {createReaderComponentProbe:createReaderBuilderProbe}=await import('./lib/reader-component-probe.mjs');
const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
const {ts,options}=installedEtsCompiler();
const {readerSelectMenuWidth,readerSelectAvailableWidth}=await import('../entry/src/main/ets/features/common/ReaderSelectGeometry.ts');
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const common='entry/src/main/ets/features/common/';
const before=read('tools/fixtures/design/source-e2-before/ReaderButton.ets'),after=read(common+'ReaderButton.ets');
const source=read('entry/src/main/ets/features/source/SourceManagementPage.ets');
const specs=foundationSpecs();
const calls=(Cls,id,scale=1,layout='intrinsic',primary=false,enabled=true,busy=false)=>{const out=[];const port=new Proxy({},{get:(o,k)=>(...args)=>{out.push([k,...args]);return port;}});new Cls(id,primary,enabled,layout,'day',busy,282,scale).applyNormalAttribute(port);return out;};
for(const id of selected){
if(id==='category-minimum'){
 let count=0;
 for(const width of [320,366])for(const scale of [1,1.3,1.6,2])for(const [bytes,expected]of [[before,false],[after,true]]){
  const f=foundationControls({buttonSource:bytes,windowMetrics:()=>({systemFontScale:scale})});
  const p=createReaderBuilderProbe(source,['categoryFilter'],{...f.dependencies,readerSourceCategoryLabel:x=>x,ScrollDirection:{Horizontal:'horizontal'},BarState:{Off:'off'}},f.hooks).owner;
  Object.assign(p,{appThemeScheme:'day',categoryValue:'all',contentFrame:()=>({width:width-38}),filterControlWidth:()=>width-38,layoutBudget:()=>({filterHeight:100}),rebuildSourceProjection(){}});p.categoryFilter();
  const targets=f.nodes(p).filter(n=>n.type==='Text'&&n.onClick);assert.equal(targets.length,7);
  for(const t of targets){assert.equal(t.constraintSize?.minWidth===44,expected);assert.ok(t.height>=44);assert.equal(t.width,undefined,'intrinsic width is not fabricated');}
  assert.ok([...p.nodes.values()].every(n=>n.constraintSize?.minWidth!==44),'Common wrappers are not the proof');count+=targets.length;
 }console.log(JSON.stringify({categoryLeaves:count,oldMissingFloorRejected:true}));
}
if(id==='style-isolation'){
 const a=foundationModifiers(specs,undefined,{buttonSource:before}).ReaderButtonFrameModifier,b=foundationModifiers(specs,undefined,{buttonSource:after}).ReaderButtonFrameModifier;
 const specSource=read(common+'ReaderControlSpecs.ets');
 const specIds=source=>{const tree=ts.createSourceFile('ReaderControlSpecs.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);const declaration=tree.statements.find(n=>ts.isTypeAliasDeclaration(n)&&n.name.text==='ReaderButtonSpecId');assert.ok(declaration&&ts.isUnionTypeNode(declaration.type));return declaration.type.types.map(n=>{assert.ok(ts.isLiteralTypeNode(n)&&ts.isStringLiteral(n.literal));return n.literal.text;});};
 const ids=specIds(specSource);assert.deepEqual(specIds(specSource.replace('export type ReaderButtonSpecId =','export type ReaderButtonSpecId\n=')),ids,'equivalent public union formatting is accepted');let tuples=0;
 const equivalentSpecs=specSource.replace("from './ReaderSearchControlGeometry';",'from\n"./ReaderSearchControlGeometry";');
 assert.notEqual(equivalentSpecs,specSource);const alternate=foundationSpecs(readerTypographyRoles,equivalentSpecs);
 for(const name of ids)assert.equal(JSON.stringify(alternate.resolveReaderButtonSpec(name)),JSON.stringify(specs.resolveReaderButtonSpec(name)),'equivalent public re-export spelling retains the actual finite spec');
 for(const name of ids)for(const scale of [1,2])for(const layout of ['intrinsic','full','equal'])for(const primary of [false,true])for(const enabled of [false,true])for(const busy of [false,true]){
 const x=calls(a,name,scale,layout,primary,enabled,busy),y=calls(b,name,scale,layout,primary,enabled,busy);
 if(!['source-management-category','source-tools-action','source-tools-compact'].includes(name))assert.deepEqual(y,x,name);
 else {assert.ok(y.some(c=>c[0]==='constraintSize'&&c[1].minWidth===44));if(name.startsWith('source-tools'))assert.ok(y.some(c=>c[0]==='constraintSize'&&c[1].minWidth===44&&c[1].minHeight>=44));}
 tuples++;
 }console.log(JSON.stringify({registeredSpecs:ids.length,tuples,otherIdsExactSetterEquivalent:true}));
}
if(id==='tools-consumer'){
 const tools=read('entry/src/main/ets/features/source/SourceToolsPage.ets');let count=0;
 for(const scale of [1,1.3,1.6,2]){
 const f=foundationControls({windowMetrics:()=>({systemFontScale:scale})});
 const p=createReaderBuilderProbe(tools,['smallButton','actionButton','fullWidthActionButton'],f.dependencies,f.hooks).owner;
 Object.assign(p,{appThemeScheme:'day',snapshot:{busy:false},compactActionWidth:()=>59,actionWidth:()=>59});
 p.smallButton('取消',true,()=>{},'取消');p.actionButton('全选',false,true,()=>{});p.fullWidthActionButton('清空',false,()=>{});
 const targets=f.nodes(p).filter(n=>n.type==='Text'&&n.onClick);assert.equal(targets.length,3);for(const t of targets){assert.equal(t.constraintSize.minWidth,44);assert.ok(t.constraintSize.minHeight>=44);count++;}
 }console.log(JSON.stringify({toolsActualLeaves:count}));
}
if(id==='group-parent'){
 const file='entry/src/main/ets/features/source/SourceManagementPage.ets';
 const Source=selectedProductionMethods(new URL(file,root),'SourceManagementPage',['groupSelectWidth','filterControlWidth'],readerTypographyRoles);
 let metrics={windowRect:{width:320}};
 const deps={TOK_BORDER_W:readerFoundationTokens.TOK_BORDER_W,ReaderWindowCoordinator:{metrics:()=>metrics},readerSelectMenuWidth,readerSelectAvailableWidth,readerInteractiveSafeLeft:()=>0,readerInteractiveSafeRight:()=>0};
 const make=path=>selectedProductionMethods(new URL(path,root),'ReaderSelectPanel',['resolvedWidth'],deps);
 const Current=make(common+'ReaderSelectPanel.ets'),Old=make('tools/fixtures/design/source-e2-before/ReaderSelectPanel.ets');let count=0;
 for(const width of [320,366])for(const scale of [1,1.3,1.6,2]){
 metrics.windowRect.width=width;
 const src=new Source();Object.assign(src,{expandedLayout:false,contentFrame:()=>({width:width-38}),fontScale:()=>scale});assert.ok(src.groupSelectWidth()>=44);
 for(const variant of ['default','sourceGroup','reader']){
 const values={variant,controlWidth:0,readerWindowMetricsRevision:1,menuKind:'source',getUIContext:()=>({getMeasureUtils:()=>({measureText:()=>0}),px2vp:x=>x}),renderedValue:()=>'',renderedOptions:()=>[],measureTextStyle:()=>({fontSizeFp:13}),resolvedChrome:()=>42};
 const a=Object.assign(new Current(),values),b=Object.assign(new Old(),values);if(variant==='sourceGroup'){assert.equal(b.resolvedWidth(),42);assert.equal(a.resolvedWidth(),46);}else assert.equal(a.resolvedWidth(),b.resolvedWidth());count++;
 }
 }
 metrics.windowRect.width=60;const p=Object.assign(new Current(),{variant:'sourceGroup',controlWidth:0,readerWindowMetricsRevision:1,menuKind:'source',getUIContext:()=>({getMeasureUtils:()=>({measureText:()=>0}),px2vp:x=>x}),renderedValue:()=>'',renderedOptions:()=>[],measureTextStyle:()=>({fontSizeFp:13}),resolvedChrome:()=>42});assert.equal(p.resolvedWidth(),28,'do not break viewport clamp below supported44');
 console.log(JSON.stringify({parentContexts:count,sourceGroupOuterMinimum:46,sourceGroupContentMinimum:44,insufficientViewport:28}));
}
recordContractCasePass(id);
}

} finally { resolution.deregister(); }
}
