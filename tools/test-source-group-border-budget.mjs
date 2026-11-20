import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'parent-chain':'Actual SDK Panel border/content/percent ChoiceRow chain; old44 outer is42 content, current46 is44; dimensions only'});
if (selected.length) {
const resolution=registerHooks({resolve(s,c,n){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(u)))return n(u.href,c);}return n(s,c);}});
try {
const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
const {readerFoundationTokens}=await import('./lib/reader-foundation-control-probe.mjs');
const {readerControlNativeTree}=await import('./fixtures/reader-control-native-tree.mjs');
const {createReaderComponentProbe:createReaderBuilderProbe}=await import('./lib/reader-component-probe.mjs');
const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
const {choiceRowProbe}=await import('./lib/reader-choice-row-probe.mjs');
const {readerSelectAvailableWidth,readerSelectMenuWidth}=await import('../entry/src/main/ets/features/common/ReaderSelectGeometry.ts');
const root=new URL('../',import.meta.url),current='entry/src/main/ets/features/common/ReaderSelectPanel.ets',previous='tools/fixtures/design/source-group-border-before/ReaderSelectPanel.ets';
let metrics={windowRect:{width:320}};
const values=selectedProductionValues(new URL(current,root),['SELECT_PAD','CHEVRON_GAP','CHEVRON_W','SELECT_CHROME'],readerFoundationTokens);
const deps={...readerFoundationTokens,...values,ReaderWindowCoordinator:{metrics:()=>metrics},readerSelectAvailableWidth,readerSelectMenuWidth,readerInteractiveSafeLeft:()=>0,readerInteractiveSafeRight:()=>0};
const load=path=>selectedProductionMethods(new URL(path,root),'ReaderSelectPanel',['resolvedWidth','resolvedChrome'],deps);
const Old=load(previous),Current=load(current),samples=[];
const widthOwner=(Cls,variant='sourceGroup')=>Object.assign(new Cls(),{variant,controlWidth:0,readerWindowMetricsRevision:1,menuKind:'standard',getUIContext:()=>({getMeasureUtils:()=>({measureText:()=>0}),px2vp:x=>x}),renderedValue:()=>'',renderedOptions:()=>[],measureTextStyle:()=>({fontSizeFp:13})});
for(const id of selected){
for(const width of [320,366])for(const [path,Cls,expectedOuter]of [[previous,Old,44],[current,Current,46]]){
 metrics.windowRect.width=width;const actualWidthOwner=widthOwner(Cls),outer=actualWidthOwner.resolvedWidth();assert.equal(outer,expectedOuter);
 const source=readFileSync(new URL(path,root),'utf8'),properties=createArkUIPropertyRuntimeProbe(),tree=readerControlNativeTree(['Column','Scroll']);
 const choice=choiceRowProbe();
 const {owner}=createReaderBuilderProbe(source,['build','optionContent','selectedRow','optionRow'],{...properties.sdk,...tree.dependencies,...readerFoundationTokens,ReaderChoiceRow:choice.Component,readerSurfaceElevation:()=>({})}, {...properties.hooks,...tree.hooks,childSources:{ReaderChoiceRow:readFileSync(new URL('entry/src/main/ets/features/common/ReaderChoiceRow.ets',root),'utf8')},mountChildren:true,lifecycleChildren:true});
 Object.assign(owner,{variant:'sourceGroup',appThemeScheme:'day',closeInFlight:false,y:0,expandedHeight:200,chevronAngle:0,wrapsOptions:()=>true,resolvedWidth:()=>outer,panelX:()=>0,panelCornerRadius:()=>8,panelBackgroundColor:()=>'',panelBorderColor:()=>'',renderedValue:()=>'全部分组',renderedOptions:()=>['全部分组','A'],optionHeightHandler:()=>()=>{},wrapsOptions:()=>true,selectAndCollapse(){},expandPanel(){}});
 owner.initialRender();assert.equal(tree.remaining(),0);
 const panel=[...owner.nodes.values()].find(n=>n.type==='Column'&&n.border),scroll=[...owner.nodes.values()].find(n=>n.type==='Scroll'),inner=[...owner.nodes.values()].find(n=>n.type==='Column'&&n.parentId===scroll.id);
 assert.equal(panel.width,outer);assert.equal(panel.padding,0);assert.equal(panel.border.width,readerFoundationTokens.TOK_BORDER_W);assert.equal(scroll.parentId,panel.id);assert.equal(scroll.width,'100%');assert.equal(inner.width,'100%');
 const children=[...owner.children.values()];assert.equal(children.length,2);
 const actualRows=children.map(c=>{assert.equal(c.owner,owner);assert.equal(c.wrapLabel,true);return [...c.nodes.values()].find(n=>n.type==='Row'&&n.onClick);});
 for(const row of actualRows){assert.equal(row.width,'100%');assert.deepEqual(row.responseRegion,{x:0,y:0,width:'100%',height:44});assert.equal(row.constraintSize.minHeight,44);}
 const content=panel.width-2*panel.border.width;assert.equal(content,expectedOuter-2);
 if(path===previous)assert.ok(content<44,'old outer44 cannot pay real inner44');else assert.equal(content,44);
 samples.push({width,before:path===previous,outer:panel.width,borderEach:panel.border.width,scrollWidth:scroll.width,innerColumnWidth:inner.width,choiceRowWidth:actualRows[0].width,responseWidth:actualRows[0].responseRegion.width,contentWidthMinimum:content,available:readerSelectAvailableWidth(width,0,0)});
}
for(const width of [60,76,77]){metrics.windowRect.width=width;const available=readerSelectAvailableWidth(width,0,0),owner=widthOwner(Current);assert.ok(owner.resolvedWidth()<=available);if(available<46)assert.equal(owner.resolvedWidth(),Math.min(42,available),'do not force46 outside supported floor context');}
for(const variant of ['default','reader','settingsPhone']){metrics.windowRect.width=320;assert.equal(widthOwner(Current,variant).resolvedWidth(),widthOwner(Old,variant).resolvedWidth());}
console.log(JSON.stringify({samples,parentChain:'Panel border -> Scroll100% -> Column100% -> actual ChoiceRow100%/response100%',negativeOuter44Content42:true,positiveOuter46Content44:true,boundary:'SDK native attributes plus exact box content arithmetic; not renderer paint or four-font measurement'}));recordContractCasePass(id);
}

} finally { resolution.deregister(); }
}
