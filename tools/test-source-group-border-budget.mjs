import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
registerHooks({resolve(s,c,n){if(s.startsWith('.')&&!/\.[a-z]+$/i.test(s)){const u=new URL(s+'.ts',c.parentURL);if(existsSync(fileURLToPath(u)))return n(u.href,c);}return n(s,c);}});
const selected=selectContractCases({'parent-chain':'Actual SDK Panel border/content/percent ChoiceRow chain; old44 outer is42 content, current46 is44; dimensions only','trigger-parent':'Actual Source group label measurement and Row payment with actual Select minimum/response, old74 width and old36 target negatives; other variants unchanged'});
const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
const {readerFoundationTokens}=await import('./lib/reader-foundation-control-probe.mjs');
const {readerControlNativeTree}=await import('./fixtures/reader-control-native-tree.mjs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
const {choiceRowProbe}=await import('./lib/reader-choice-row-probe.mjs');
const {readerSelectAvailableWidth,readerSelectMenuWidth}=await import('../entry/src/main/ets/ui/foundation/ReaderSelectGeometry.ts');
const root=new URL('../',import.meta.url),current='entry/src/main/ets/ui/controls/ReaderSelectPanel.ets',previous='tools/fixtures/design/source-group-border-before/ReaderSelectPanel.ets';
let metrics={windowRect:{width:320}};
const values=selectedProductionValues(new URL(current,root),['SELECT_PAD','CHEVRON_GAP','CHEVRON_W','SELECT_CHROME'],readerFoundationTokens);
const deps={...readerFoundationTokens,...values,readerWindowMetrics:()=>metrics,ReaderWindowCoordinator:{metrics:()=>metrics},readerSelectAvailableWidth,readerSelectMenuWidth,readerInteractiveSafeLeft:()=>0,readerInteractiveSafeRight:()=>0};
const load=path=>selectedProductionMethods(new URL(path,root),'ReaderSelectPanel',['resolvedWidth','resolvedChrome'],deps);
const Old=load(previous),Current=load(current),samples=[];
const widthOwner=(Cls,variant='sourceGroup')=>Object.assign(new Cls(),{variant,controlWidth:0,readerWindowMetricsRevision:1,menuKind:'standard',getUIContext:()=>({getMeasureUtils:()=>({measureText:()=>0}),px2vp:x=>x}),renderedValue:()=>'',renderedOptions:()=>[],measureTextStyle:()=>({fontSizeFp:13})});
for(const id of selected){
if(id==='trigger-parent'){await triggerParent();recordContractCasePass(id);continue;}
for(const width of [320,366])for(const fontScale of [1,1.3,1.6,2])for(const [path,Cls,expectedOuter]of [[previous,Old,44],[current,Current,46]]){
 metrics.windowRect.width=width;const actualWidthOwner=widthOwner(Cls),outer=actualWidthOwner.resolvedWidth();assert.equal(outer,expectedOuter);
 const source=readFileSync(new URL(path,root),'utf8'),properties=createArkUIPropertyRuntimeProbe(),tree=readerControlNativeTree(['Column','Scroll']);
 const choice=choiceRowProbe();
 const members=['build','optionContent','selectedRow','optionRow'];if(source.includes('private panelBody'))members.push('panelBody','panelHeight');if(source.includes('private optionFocusId'))members.push('optionFocusId');
 const {owner}=createReaderBuilderProbe(source,members,{...properties.sdk,...tree.dependencies,...readerFoundationTokens,ReaderChoiceRow:choice.Component,readerSurfaceElevation:()=>({})}, {...properties.hooks,...tree.hooks,childSources:{ReaderChoiceRow:readFileSync(new URL('entry/src/main/ets/ui/controls/ReaderChoiceRow.ets',root),'utf8')},mountChildren:true,lifecycleChildren:true});
 Object.assign(owner,{focusIdPrefix:'',variant:'sourceGroup',appThemeScheme:'day',closeInFlight:false,y:0,expandedHeight:200,chevronAngle:0,wrapsOptions:()=>true,resolvedWidth:()=>outer,panelX:()=>0,panelY:()=>0,panelCornerRadius:()=>8,panelBackgroundColor:()=>'',panelBorderColor:()=>'',renderedValue:()=>'全部分组',renderedOptions:()=>['全部分组','A'],optionHeightHandler:()=>()=>{},wrapsOptions:()=>true,selectAndCollapse(){},expandPanel(){}});
 owner.initialRender();assert.equal(tree.remaining(),0);
 const panel=[...owner.nodes.values()].find(n=>n.type==='Column'&&n.border),scroll=[...owner.nodes.values()].find(n=>n.type==='Scroll'),inner=[...owner.nodes.values()].find(n=>n.type==='Column'&&n.parentId===scroll.id);
 assert.equal(panel.width,outer);assert.equal(panel.padding,0);assert.equal(panel.border.width,readerFoundationTokens.TOK_BORDER_W);assert.equal(scroll.parentId,panel.id);assert.equal(scroll.width,'100%');assert.equal(inner.width,'100%');
 const children=[...owner.children.values()];assert.equal(children.length,2);
 const actualRows=children.map(c=>{assert.equal(c.owner,owner);assert.equal(c.wrapLabel,true);return [...c.nodes.values()].find(n=>n.type==='Button'&&n.onClick);});
 for(const row of actualRows){assert.equal(row.width,'100%');assert.equal(row.responseRegion,undefined,'new native Button uses its real layout target');assert.equal(row.constraintSize.minHeight,44);}
 const content=panel.width-2*panel.border.width;assert.equal(content,expectedOuter-2);
 if(path===previous)assert.ok(content<44,'old outer44 cannot pay real inner44');else assert.equal(content,44);
 samples.push({width,fontScale,before:path===previous,outer:panel.width,borderEach:panel.border.width,scrollWidth:scroll.width,innerColumnWidth:inner.width,choiceRowWidth:actualRows[0].width,responseWidth:actualRows[0].width,contentWidthMinimum:content,available:readerSelectAvailableWidth(width,0,0)});
}

async function triggerParent(){
 const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
 const {boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const pagePath='entry/src/main/ets/features/source/ui/SourceManagementPage.ets',selectPath='entry/src/main/ets/ui/controls/ReaderSelect.ets';
 const beforeRoot='tools/fixtures/design/source-group-trigger-before/';
 const read=path=>readFileSync(new URL(path,root),'utf8');
 const pageSource=read(pagePath),selectSource=read(selectPath),oldPage=read(beforeRoot+'SourceManagementPage.ets'),oldSelect=read(beforeRoot+'ReaderSelect.ets');
 const baseValueHeight=15,samples=[];
 function compose(page,select,width,scale,measurement=true){
  const props=createArkUIPropertyRuntimeProbe();
  const uiContext={getFont:()=>({}),px2vp:value=>value,getMeasureUtils:()=>({
   measureText:()=>measurement?readerTypographyRoles.TYPE_FORM_LABEL_ACTION.fontSizeFp*2*scale:Number.NaN,
   measureTextSize:()=>({height:baseValueHeight*scale}),
  })};
  const constants=selectedProductionValues(new URL(select===oldSelect?beforeRoot+'ReaderSelect.ets':selectPath,root),['TRIGGER_H','SELECT_PAD','CHEVRON_GAP','CHEVRON_W','CHEVRON_H','SELECT_CHROME','APPEARANCE_TRIGGER_H','APPEARANCE_HIT_OUTSET','APPEARANCE_VALUE_VERTICAL_SPACE'],readerFoundationTokens);
  assert.equal(constants.TRIGGER_H,36,'the actual shared default constant must not be replaced with44');
  const selectProbe=createReaderBuilderProbe(select,boundedMembers(select),{...props.sdk,...readerTypographyRoles,...readerFoundationTokens,...constants,uiContext,
   readerMotionAnimateParam:()=>({duration:0}),registerReaderFonts(){},readerAppColor:()=>'',readerWindowMetrics:()=>({systemFontScale:scale})},props.hooks);
  const names=page===oldPage?['GROUP_FILTER_WIDTH','GROUP_SELECT_WIDTH']:['GROUP_ICON_WIDTH','GROUP_LABEL_GAP','GROUP_TRIGGER_GAP'];
  const pageConstants=selectedProductionValues(new URL(page===oldPage?beforeRoot+'SourceManagementPage.ets':pagePath,root),names);
  const methods=['filterControlWidth','groupSelectWidth',...(page===oldPage?[]:['groupLabelWidth'])];
  const Widths=selectedProductionMethods(new URL(page===oldPage?beforeRoot+'SourceManagementPage.ets':pagePath,root),'SourceManagementPage',methods,{...pageConstants,...readerTypographyRoles});
  const widths=Object.assign(new Widths(),{expandedLayout:false,contentFrame:()=>({width:width-38}),fontScale:()=>scale,getUIContext:()=>uiContext});
  const {owner}=createReaderBuilderProbe(page,['groupFilter'],{...props.sdk,...pageConstants,...readerFoundationTokens,...readerTypographyRoles,
   ReaderSelect:selectProbe.Component,readerAppColor:()=>''},{...props.hooks,childSources:{ReaderSelect:select},mountChildren:true,lifecycleChildren:true});
  Object.assign(owner,{appThemeScheme:'day',groupValue:'全部分组',groupOpen:false,reduceMotion:true,groupOptions:()=>['全部分组','A'],groupTriggerFocusId:()=>'',toggleGroupSelection(){},
   filterControlWidth:widths.filterControlWidth.bind(widths),groupSelectWidth:widths.groupSelectWidth.bind(widths),groupLabelWidth:widths.groupLabelWidth?.bind(widths)});
  owner.groupFilter();
  const row=[...owner.nodes.values()].find(n=>n.type==='Row'),label=[...owner.nodes.values()].find(n=>n.type==='Text'&&n.create==='分组'),icon=[...owner.nodes.values()].find(n=>n.type==='Image');
  const common=[...owner.nodes.values()].find(n=>n.type==='__Common__'&&n.margin),child=[...owner.children.values()][0];
  const target=[...child.nodes.values()].find(n=>n.type==='Button'&&n.onClick),frame=[...child.nodes.values()].find(n=>n.type==='Stack');
  const labelWidth=label.width??Math.ceil(readerTypographyRoles.TYPE_FORM_LABEL_ACTION.fontSizeFp*2*scale);
  const requiredWidth=icon.width+label.margin.left+labelWidth+common.margin.left+frame.width;
  return{owner,widths,selectProbe,props,target,frame,row,requiredWidth,labelWidth};
 }
 function assertPaid(sample){assert.ok(sample.requiredWidth<=sample.row.width,'group Row must pay measured label growth and the actual child width');assert.ok(sample.target.height>=44&&sample.target.responseRegion.height>=44,'actual source-group Native/response minimum44');}
 for(const width of [320,366])for(const scale of [1,1.3,1.45,1.6,2])for(const measured of [true,false]){
  const current=compose(pageSource,selectSource,width,scale,measured);assertPaid(current);
  samples.push({width,fontScale:scale,measurePort:measured?'finite-label-width':'nonfinite-fallback',availableWidth:current.row.width,requiredWidth:current.requiredWidth,labelWidth:current.labelWidth,triggerWidth:current.frame.width,triggerHeight:current.target.height,responseHeight:current.target.responseRegion.height});
 }
 assert.throws(()=>assertPaid(compose(oldPage,selectSource,320,1.45)),/pay measured label/,'old fixed74 budget cannot pay actual growing label');
 assert.throws(()=>assertPaid(compose(pageSource,oldSelect,320,1)),/minimum44/,'actual old production36 target fails without changing its constant');
 for(const variant of ['default','appearanceLibrary','settingsPhone','settingsTablet']){
  const sizes=[];for(const source of [oldSelect,selectSource]){
   const c=compose(pageSource,source,320,1);const child=[...c.owner.children.values()][0];
   Object.assign(child,{variant,isSettingsVariant:()=>variant.startsWith('settings')});sizes.push(child.triggerHeight());
  }assert.equal(sizes[0],sizes[1],'unselected variant '+variant+' keeps its actual height');
 }
 console.log(JSON.stringify({groupParentSamples:samples,negativeOld74:true,negativeActual36:true,sharedDefaultConstant:36,otherVariants:'UNCHANGED',native:'NOT_RUN'}));
}
for(const width of [60,76,77]){metrics.windowRect.width=width;const available=readerSelectAvailableWidth(width,0,0),owner=widthOwner(Current);assert.ok(owner.resolvedWidth()<=available);if(available<46)assert.equal(owner.resolvedWidth(),Math.min(42,available),'do not force46 outside supported floor context');}
for(const variant of ['default','reader','settingsPhone']){metrics.windowRect.width=320;assert.equal(widthOwner(Current,variant).resolvedWidth(),widthOwner(Old,variant).resolvedWidth());}
console.log(JSON.stringify({samples,parentChain:'Panel border -> Scroll100% -> Column100% -> actual ChoiceRow100%/response100%',negativeOuter44Content42:true,positiveOuter46Content44:true,boundary:'SDK native attributes plus exact box content arithmetic; not renderer paint or four-font measurement'}));recordContractCasePass(id);
}
