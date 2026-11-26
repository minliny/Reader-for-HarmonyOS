import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {pureModuleProbe} from './lib/ets-pure-module-probe.mjs';
import {selectedProductionMethods} from './lib/selected-production-methods.mjs';
import {mangaRowBuilderMembers,mangaGridProbeDependencies} from './lib/manga-directory-grid-probe.mjs';
import * as fontFamilies from '../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';
import * as motionTiming from '../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';
import {SOURCE_CHROME_VISUAL} from '../entry/src/main/ets/ui/foundation/ReaderSourceChromeVisual.ts';
import {DIRECTORY_CHROME_VISUAL} from '../entry/src/main/ets/ui/foundation/ReaderDirectoryChromeVisual.ts';

const cases=selectContractCases({
 'text-row-target':'Real SDK text Tree row uses the API 23/24 title and height policy for its full carrier, touch response and restored scroll. Group, current, disabled and accessory lanes at 1/1.3/1.45/2. No native hit or glyph claim.',
 'manga-named-row-target':'Real SDK naturally sized manga target/group/disabled rows retain their entire parent response at 1/1.3/1.45/2. The observed 488px native row and fixed44 negative bind the regression. Native dispatch remains separate.',
});
const base=new URL('../entry/src/main/ets/features/',import.meta.url),read=name=>readFileSync(new URL(name,base),'utf8');

function checkMangaNamedRowTargets(source) {
 const accessibility=pureModuleProbe(read('../ui/controls/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',
  {AccessibilityRoleType:{BUTTON:'button'}},['readerActionTouchRegion','ReaderActionAccessibility']);
 const motion=pureModuleProbe(read('../ui/foundation/MotionSpec.ets'),'MotionSpec.ets',{
  ...motionTiming,SOURCE_SWITCH_VISUAL:SOURCE_CHROME_VISUAL,MANGA_DIRECTORY_VISUAL:DIRECTORY_CHROME_VISUAL,
  Curve:new Proxy({},{get:(_target,key)=>`Curve.${String(key)}`}),
  curves:new Proxy({},{get:(_target,key)=>(...args)=>({nativeCurve:String(key),args})}),
 },['motionAnimateParam','motionSpecGet']);
 const {readerMotionAnimateParam}=pureModuleProbe(read('../ui/foundation/ReaderMotionPolicy.ets'),
  'ReaderMotionPolicy.ets',motion,['readerMotionAnimateParam']);
 const samples=[];
 for(const scale of [1,1.3,1.45,2]) {
  for(const kind of ['target','group','disabled']) {
   const node={nodeId:`named-${kind}`,kind,title:'山海间的长标题与 English sample 23',depth:2,
    chapterIndex:kind==='target'?22:undefined,hasChildren:kind==='group',expanded:true};
   const view={viewId:'named-response'},events=[];
   const dependencies={...mangaGridProbeDependencies,...fontFamilies,...accessibility,readerMotionAnimateParam,globalThis,
    readerWindowMetrics:()=>({systemFontScale:scale})};
   const {owner}=createReaderBuilderProbe(source,[...mangaRowBuilderMembers,'emptyBuilder','emptyPrefix'],dependencies);
   Object.assign(owner,{view,mangaScheme:'day',appThemeScheme:'day',mangaSearchActive:false,
    mangaRowMinHeight:58,mangaCatalogDisplay:true,mangaCatalogNarrow:true,mangaQuickDisplay:false,
    currentChapterIndex:-1,interactionEnabled:true,rowPresentationRevision:0,windowMetricsRevision:1,
    dataSource:{currentView:()=>view,loadedItemById:()=>({node,index:0}),loadedNode:()=>undefined},
    selectTarget:current=>events.push(['select',current.nodeId]),toggleNode:current=>events.push(['toggle',current.nodeId])});
   owner.mangaRow({node,index:0,key:node.nodeId});
   const row=[...owner.nodes.values()].find(current=>current.type==='Row'&&current.layoutWeight===1&&current.onClick);
   assert.ok(row,'actual SDK named manga row owns its selection callback');
   const title=[...owner.nodes.values()].find(current=>current.type==='Text'&&current.create===node.title);
   assert.equal(title.maxFontScale,scale,'actual production text consumes the selected system font scale');
   assert.deepEqual(row.responseRegion,{x:0,y:0,width:'100%',height:'100%'},
    'named manga response must cover the whole naturally sized parent');
   assert.equal(row.enabled,kind!=='disabled');
   for(const height of [58,488/3.5,240]) {
    const responseHeight=row.responseRegion.height==='100%'?height:row.responseRegion.height;
    for(const y of [1,height/2,height-1]) {
     const before=events.length;
     if(row.enabled&&y>=row.responseRegion.y&&y<row.responseRegion.y+responseHeight)row.onClick();
     assert.equal(events.length-before,kind==='disabled'?0:1,'top, middle and bottom share the current row callback');
     if(kind!=='disabled')assert.deepEqual(events.at(-1),[kind==='group'?'toggle':'select',node.nodeId]);
    }
    assert.equal(row.responseRegion.y+responseHeight,height,'response ends at its parent boundary');
   }
   samples.push({scale,kind,response:row.responseRegion,eligible:row.enabled});
  }
 }
 return samples;
}

for(const id of cases){
 const source=read('reading/ui/ReaderDirectoryNavigationList.ets');
 if(id==='manga-named-row-target') {
  const samples=checkMangaNamedRowTargets(source);
  const fixed44=source.replace("readerActionTouchRegion('100%', '100%')","readerActionTouchRegion('100%', 44)");
  assert.notEqual(fixed44,source,'negative restores exactly the old fixed44 response');
  assert.throws(()=>checkMangaNamedRowTargets(fixed44),/named manga response must cover the whole naturally sized parent/);
  console.log(JSON.stringify({kind:'manga-named-row-target-evidence',proof:'Actual SDK final response and production selection callbacks; native pointer delivery remains separate',samples}));
  recordContractCasePass(id);
  continue;
 }
 const scaleHelpers=pureModuleProbe(read('../ui/foundation/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
 const accessibility=pureModuleProbe(read('../ui/controls/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['readerActionTouchRegion','ReaderActionAccessibility']);
 const samples=[];
 function render(candidate,scale,kind,current,accessories,form='standalone',api24=false){
  const sdk=boundedSurfaceSdk(),metrics={systemFontScale:scale};
  const deps={...sdk.deps,...scaleHelpers,...accessibility,readerWindowMetrics:()=>metrics};
  const Panel=selectedProductionMethods(new URL('reading/ui/FullDirectoryPanel.ets',base),'FullDirectoryPanel',['fontScale','directoryRowHeight','directoryListRowHeight','controlProgress'],deps);
  const panel=Object.assign(new Panel(),{readerWindowMetricsRevision:1,embeddedInControl:false,motionProgress:1});
  const Control=selectedProductionMethods(new URL('reading/ui/ReaderControlDirectoryContent.ets',base),'ReaderControlDirectoryContent',['fontScale','rowHeight','selectedMinimum','preparedProfile','value'],deps);
  const control=Object.assign(new Control(),{readerWindowMetricsRevision:1,minimumMetricsRevision:1,minimumProfiles:new Map(),minimumKey:'',tab:'directory',progress:form==='controlQuick'?0:1});
  const requestedHeight=form==='standalone'?panel.directoryListRowHeight():control.rowHeight();
  if(form!=='controlQuick')assert.equal(control.rowHeight(),panel.directoryListRowHeight(),'both Full text Tree parents reserve the same lane');
  const Surface = selectedProductionMethods(new URL('reading/ui/ReaderDirectoryNavigationSurface.ets',base),
   'ReaderDirectoryNavigationSurface',['titleMaxLines','resolvedRowHeight'],{readerHarmonyApi24:()=>api24});
  const surface=Object.assign(new Surface(),{rowHeight:requestedHeight,mangaDisplay:false});
  const height=surface.resolvedRowHeight(), lines=surface.titleMaxLines();
  if(scale===1)assert.equal(height,api24?56:40,'normal rows resolve the versioned carrier');
  const row={nodeId:'chapter17',kind,title:'第17章 native carrier',depth:0,level:1,chapterIndex:kind==='target'?16:undefined,hasChildren:kind==='group'||accessories,expanded:false};
  const item={key:'chapter17',index:16,node:row},events=[];
  const owner=createReaderBuilderProbe(candidate,['row','isCurrentNode','displayLevel','currentPaintNode','textRowAccessibility','verificationChapterSelectionId','positionRowHeight','positionInitialCurrent','bookmarkActionEnabled','directoryInputCurrent'],
   {...deps,ScrollAlign:{START:'start'},LengthMetrics:{vp:value=>({value})}},sdk.hooks).owner;
  const scrolls=[];
  Object.assign(owner,{mounted:true,view:{viewId:'view',currentVisibleIndex:current?16:undefined,currentAncestorNodeId:current?row.nodeId:undefined},rowPresentationRevision:0,dataSource:{loadedNode:()=>current?row:undefined,currentView:()=>owner.view,loadedItemById:()=>({node:row})},
   rowHeight:height,titleMaxLines:lines,mangaDisplay:false,appThemeScheme:'day',interactionEnabled:true,chapterDownloadEnabled:accessories,chapterDownloadActionsEnabled:false,
   initialPositionPending:true,positionPlan:{viewId:'view',index:16,rowFraction:.25,align:'start'},
   nativeDisplayIndex:index=>index+1,scroller:{scrollToIndex:(...args)=>scrolls.push(args)},
   chapterByIndex:new Map(accessories?[[16,{index:16,navigable:true,downloadState:'idle',bookmarks:[]}]]:[]),
   selectTarget:node=>events.push(['select',node.nodeId]),toggleNode:node=>events.push(['toggle',node.nodeId]),marker:entry=>events.push(['marker',entry.index]),
   canDownloadTarget:()=>true,downloadTarget:node=>events.push(['download',node.nodeId])});
  owner.row(item);const nodes=[...owner.nodes.values()],title=nodes.find(n=>n.type==='Text'&&n.create===row.title);
  assert(title);const parent=nodes.find(n=>n.type==='Row'&&n.width==='100%'&&n.height===height);assert(parent);
  assert.equal(title.height,height,'chapter Text must own the full parent carrier, not its natural glyph height');
  assert.equal(title.responseRegion.y,0);assert.equal(title.responseRegion.height,'100%','response covers the carrier without crossing a neighboring row');
  assert.equal(title.responseRegion.width,'100%');assert.equal(title.layoutWeight,1);assert.equal(title.maxLines,api24?2:1);
  assert.equal(title.fontSize,sdk.deps.TYPE_READER_DIRECTORY_TITLE.fontSizeFp,'approved glyph role remains unchanged');
  assert.equal(title.fontFamily,sdk.deps.TYPE_READER_DIRECTORY_TITLE.fontFamily);
  assert.equal(owner.positionRowHeight(16),height,'scroll anchors consume the same actual row lane');
  owner.positionInitialCurrent();
  assert.deepEqual(scrolls,[[17,false,'start',{extraOffset:{value:height*.25}}]],'restore the same Core rank and fraction from the versioned row extent');
  const accessoryNodes=nodes.filter(n=>n.onClick&&n!==title);for(const node of accessoryNodes){assert.equal(node.height,height);assert.equal(node.width,44);assert.equal(node.responseRegion.height,'100%');assert.equal(node.responseRegion.y,0);assert.equal(node.responseRegion.x,0);}
  assert.equal(accessoryNodes.length,kind==='group'?1:accessories?3:0);
  if(kind!=='disabled'){title.onClick();assert.deepEqual(events,[[kind==='group'?'toggle':'select',row.nodeId]]);}
  else assert.equal(title.enabled,false,'disabled state remains owned by the production accessibility modifier');
  samples.push({api24,scale,form,kind,current,accessories,parentHeight:height,carrierHeight:title.height,responseHeight:height,complete44:height>=44,adjacentOverlap:0});
 }
 for(const api24 of[false,true])for(const scale of[1,1.3,1.45,2])for(const form of['standalone','controlQuick','controlFull'])for(const [kind,current,accessories]of[['target',false,false],['target',true,true],['group',false,false],['disabled',false,false]])render(source,scale,kind,current,accessories,form,api24);
 const withoutCarrier=source.replace(".id(this.verificationChapterSelectionId(item))\n          .height(this.rowHeight)",".id(this.verificationChapterSelectionId(item))");
 assert.notEqual(withoutCarrier,source,'negative removes exactly the production chapter carrier');
 assert.throws(()=>render(withoutCarrier,1,'target',false,false),/chapter Text must own the full parent carrier/,'natural-height Text fails even when a response rectangle is declared');
 const inflated=source.replace(".id(this.verificationChapterSelectionId(item))\n          .height(this.rowHeight)",".id(this.verificationChapterSelectionId(item))\n          .height(Math.max(44, this.rowHeight))");
 assert.notEqual(inflated,source);
 assert.throws(()=>render(inflated,1,'target',true,false,'controlQuick'),/chapter Text must own the full parent carrier/,'uniform44 cannot exceed the API 23 compact lane');
 console.log(JSON.stringify({kind:'directory-text-row-target-evidence',proof:'SDK declared carrier/response/parent extents; actual Native hit and glyph remain separate',samples}));
 recordContractCasePass(id);
}
