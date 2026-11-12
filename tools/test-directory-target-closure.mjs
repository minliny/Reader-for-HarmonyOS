import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'topbar-variants':'Actual title modifiers retain reading/manga declarations while directory tracks real environment scale and its current parent budget.','header-budgets':'Actual current-generation directory header/menu parents grow with their live actor width and text/target budgets.','private-toolbar':'Actual FullDirectoryPanel private carriers/tabs/query parent budget at measured widths and scales.','fallback-carriers':'Actual shared fallback row carriers and three current parent projections through the same public width planner.'});
if(selected.length){
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
 const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
 const visual=await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
 const layout=await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryLayout.ts');
 const state=await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryState.ts');
 const {mangaDirectoryPresentation}=await import('../entry/src/main/ets/features/manga/presentation/MangaDirectoryPresentation.ts');
 const {mangaDirectoryEntryRowSdk}=await import('./lib/manga-directory-entry-row-probe.mjs');
 const read=path=>readFileSync(new URL('../entry/src/main/ets/features/'+path,import.meta.url),'utf8');
 const file=path=>new URL('../entry/src/main/ets/features/'+path,import.meta.url);
 const access=pureModuleProbe(read('../ui/controls/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'BUTTON'}},['ReaderActionAccessibility','readerActionTouchRegion']);
 const resolver=pureModuleProbe(read('../ui/foundation/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
 const panelSource=read('reading/ui/FullDirectoryPanel.ets');
 async function privateToolbar(){
  const toolbarSource=read('reading/ui/ReaderDirectoryToolbar.ets');
  for(const width of [270,300,360])for(const scale of [1,1.3,1.6,2])for(const tab of ['directory','bookmarks']){
   const sdk=boundedSurfaceSdk(),children=[];
   class ToolbarSlot{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});children.push(this);}}
   class Query{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}}
   const metrics={systemFontScale:scale,windowRect:{width:1000,height:1000}};
   const toolbarValues=selectedProductionValues(file('reading/ui/ReaderDirectoryToolbar.ets'),['READER_DIRECTORY_TOOLBAR_HEIGHT']);
   const deps={...sdk.deps,...resolver,...access,...toolbarValues,readerWindowMetrics:()=>metrics};
   const names=['searchControls','queryStacked','searchControlsHeight','queryHeight','fontScale','innerWidth','panelWidth','tabStripHeight','tabHeight'];
   const {owner}=createReaderBuilderProbe(panelSource,names,{...deps,ReaderDirectoryToolbar:ToolbarSlot},
    {...sdk.hooks,childSources:{ReaderDirectoryToolbar:toolbarSource}});
   const actions=[];
   Object.assign(owner,{panelWidthOverride:width,readerWindowMetricsRevision:1,activeTab:tab,embeddedInControl:false,expandedLayout:false,
    searchDraft:'',ascending:true,searchPlaceholder:()=>'',handleControl:k=>actions.push(k)});
   owner.searchControls();assert.equal(children.length,1,'actual FullPanel delegates to one shared toolbar');
   const child=children[0];
   const toolbar=createReaderBuilderProbe(toolbarSource,boundedMembers(toolbarSource),{...deps,ReaderSearchField:Query},
    {...sdk.hooks,childSources:{ReaderSearchField:read('../ui/controls/ReaderSearchField.ets')}}).owner;
   Object.assign(toolbar,child.params);toolbar.aboutToAppear();toolbar.initialRender();
   const nodes=[...toolbar.nodes.values()],hits=nodes.filter(n=>n.type==='Button'&&n.onClick);
   assert.equal(hits.length,tab==='directory'?4:1);
   for(const hit of hits){assert.equal(hit.width,44);assert(hit.height>=44);assert.equal(hit.responseRegion.width,44);assert.equal(hit.responseRegion.x,0);hit.onClick();}
   assert.equal(actions.length,hits.length);
   assert(nodes.some(n=>n.type==='Stack'&&n.width===32&&n.height===32&&!n.onClick),'authored32 paint stays inside the native44 target');
   const inner=width-26,count=hits.length,expectedStack=inner-20-count*49<44;
   assert.equal(owner.queryStacked(),expectedStack,'actual actor width overrides global1000vp metrics');
   assert.equal(toolbar.queryStacked(),expectedStack,'shared renderer pays the same narrow-width decision');
   assert.equal(owner.searchControlsHeight(),owner.queryHeight()+7+(expectedStack?50:0));
   if(!expectedStack)assert(inner-20-count*44-count*5>=44,'inline query owns44 without overlapping a target');
   else assert(inner-20-(count-1)*5>=count*44,'the separate lane pays every tool');
   assert.equal(owner.tabStripHeight(),owner.tabHeight()+6);
  }
 }
 const timing=await import('../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts');
 const {SOURCE_SWITCH_VISUAL}=await import('../entry/src/main/ets/features/source/ui/SourceSwitchVisual.ts');
 const curves=new Proxy({},{get:(_,name)=>(...args)=>({nativeCurve:String(name),args})});
 const motion=pureModuleProbe(read('../ui/foundation/MotionSpec.ets'),'MotionSpec.ets',{...timing,SOURCE_SWITCH_VISUAL,...visual,curves,Curve:new Proxy({},{get:(_,n)=>String(n)})},['motionAnimateParam']);
 async function fallbackCarriers(){
  const group={index:0,title:'Volume',navigable:false,downloadState:'unknown'},entries=[group,...Array.from({length:15},(_,i)=>({index:i+1,title:String(i+1),level:2,navigable:true,downloadState:'completed',bookmarks:[]}))];
  const presentation=mangaDirectoryPresentation(entries);
  for(const width of [240,280,340])for(const scale of [1,1.3,1.6,2]){
   const deps={...layout,...state,visual:visual.MANGA_DIRECTORY_VISUAL,mangaDirectoryPresentation,...visual,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:scale})},readerWindowMetrics:()=>({systemFontScale:scale})};
   const Book=selectedProductionMethods(file('reading/ui/BookDirectoryPage.ets'),'BookDirectoryPage',['prepareMangaLayout'],deps);
   const book=Object.assign(new Book(),{mangaVisibleEntries:()=>entries,mangaPresentation:presentation,mangaNarrow:()=>true,mangaFontScale:()=>scale,contentFrame:()=>({width}),mangaDownloadEnabled:true,searchQuery:''});book.prepareMangaLayout();
   const Fallback=selectedProductionMethods(file('manga/ui/MangaReadingDirectoryFallback.ets'),'MangaReadingDirectoryFallback',['prepareLayout'],deps);
   const fallback=Object.assign(new Fallback(),{projectedEntries:entries,presentation,mangaCatalogNarrow:true,viewportWidth:width,fontScale:()=>scale,chapterDownloadEnabled:true,query:''});fallback.prepareLayout();
   assert.deepEqual(book.mangaLayoutRows.map(r=>r.columns),fallback.layoutRows.map(r=>r.columns),'two actual download parents share one public capacity');
   const previewValues=selectedProductionValues(file('reading/ui/LocalBookDetail.ets'),['CHAPTER_PREVIEW_LIMIT']);
   const Detail=selectedProductionMethods(file('reading/ui/LocalBookDetail.ets'),'LocalBookDetail',['prepareMangaPreview'],{...deps,...previewValues});
   const detail=Object.assign(new Detail(),{toc:entries,book:{mangaPosition:{chapterIndex:7}},collapsedGroups:[],liveWidth:()=>width,contentFrame:()=>({width})});detail.prepareMangaPreview();const preview=detail.mangaPreviewRows;
   for(const [rows,downloads]of[[book.mangaLayoutRows,true],[fallback.layoutRows,true],[preview,false]])for(const row of rows){
    const sdk=mangaDirectoryEntryRowSdk({dependencies:{...access,...motion,globalThis:{Context:{animation(){}}},readerWindowMetrics:()=>({systemFontScale:scale})}});
    const actor=new sdk.deps.MangaDirectoryEntryRow(undefined,{row,presentation,scheme:'day',interactionEnabled:true,chapterDownloadEnabled:downloads,branchControlsEnabled:downloads,onSelectEntry(){},onToggleBranch(){},onDownloadEntry(){}});actor.initialRender();
    const nodes=sdk.nodes(actor),target=nodes.filter(n=>n.onClick&&n.accessibilityText);
    for(const n of target){const w=n.width;const h=n.height??n.constraintSize?.minHeight;if(typeof w==='number')assert(w>=44);if(typeof h==='number')assert(h>=44);}
    if(row.kind!=='row'){
     const cell=(width-(row.columns-1)*8)/row.columns;assert(cell>=44);
     if(downloads){assert(cell-44-12>=44,'download/independent44 reading/padding/borders fit');const hit=target.find(n=>n.accessibilityText.startsWith('管理'));assert(hit&&hit.height>=44);}
    }
   }
  }
 }
 async function headerBudgets(){
  for(const width of[240,320,720])for(const scale of[1,1.3,1.6,2]){
   const metrics={systemFontScale:scale};
   const Header=selectedProductionMethods(file('reading/ui/ReaderFullDirectory.ets'),'ReaderFullDirectory',
    ['fontScale','headerControlHeight','headerBarHeight','menuRowHeight','offlineMenuWidth','offlineMenuLeft'],
    {...resolver,readerWindowMetrics:()=>metrics});
   const owner=Object.assign(new Header(),{headerSpec:{barHeight:54},liveContainerWidth:()=>width,
    topBarLeft:()=>14,topBarRight:()=>16,usesExpandedLayout:()=>width>600});
   assert(owner.headerControlHeight()>=44);assert(owner.headerBarHeight()>=owner.headerControlHeight());
   assert(owner.headerBarHeight()>=39*scale+6,'two title tracks fit inside the admitted bar');
   assert(owner.menuRowHeight()>=44);assert(owner.offlineMenuWidth()<=width-30);
   assert(owner.offlineMenuLeft()>=14);assert(owner.offlineMenuLeft()+owner.offlineMenuWidth()<=width-16);
  }
 }
 async function topbarVariants(){
  const source=readFileSync(new URL('../entry/src/main/ets/ui/chrome/ReaderReadingTopBar.ets',import.meta.url),'utf8');
  const before=readFileSync(new URL('./fixtures/design/directory-confluence-before/reading-topbar.ets.txt',import.meta.url),'utf8');
  const sdk=boundedSurfaceSdk();
  const deps={...sdk.deps,mangaDirectoryColor:visual.mangaDirectoryColor,TextOverflow:{Ellipsis:'ellipsis'},TextAlign:{Start:'start'},FontWeight:{Bold:'bold'}};
  const titleOf=text=>pureModuleProbe(text.slice(0,text.indexOf('/** Reading and its directory')),'ReaderReadingTopBar.ets',deps,['ReaderReadingTopBarTitle']).ReaderReadingTopBarTitle;
  const Current=titleOf(source),Before=titleOf(before);
  function attributes(Title,variant,primary,scale){const values={};let target;target=new Proxy({}, {get:(_t,key)=>(...args)=>{values[key]=args;return target;}});new Title(variant,primary,'day',scale).applyNormalAttribute(target);return values;}
  const samples=[];
  for(const scale of[1,1.3,1.6,2]){
   for(const variant of['reading','manga'])for(const primary of[true,false]){
    assert.deepEqual(attributes(Current,variant,primary,scale),attributes(Before,variant,primary,scale),'unaffected title variant keeps every native setter');
   }
   const metrics={systemFontScale:scale};
   const Bar=selectedProductionMethods(new URL('../entry/src/main/ets/ui/chrome/ReaderReadingTopBar.ets',import.meta.url),'ReaderReadingTopBar',['titleFontScale'],{...resolver,readerWindowMetrics:()=>metrics});
   const bar=Object.assign(new Bar(),{variant:'directory',windowMetricsRevision:1});assert.equal(bar.titleFontScale(),scale);
   const title=attributes(Current,'directory',true,bar.titleFontScale()),chapter=attributes(Current,'directory',false,bar.titleFontScale());
   const Header=selectedProductionMethods(file('reading/ui/ReaderFullDirectory.ets'),'ReaderFullDirectory',['fontScale','headerControlHeight','headerBarHeight'],{...resolver,readerWindowMetrics:()=>metrics});
   const parent=Object.assign(new Header(),{headerSpec:{barHeight:54}});
   assert(title.height[0]>=22*scale);assert(chapter.height[0]>=17*scale);
   assert(parent.headerBarHeight()>=title.height[0]+chapter.height[0]+6,'parent pays the actual two title carriers');
   assert.equal(title.maxFontScale[0],scale);assert.equal(chapter.maxFontScale[0],scale);
   if(scale>1)assert(attributes(Before,'directory',true,scale).height[0]<title.height[0],'old fixed title track rejects enlarged-type budget');
   bar.variant='reading';assert.equal(bar.titleFontScale(),1,'reading never adopts directory environment sizing');
   samples.push({scale,title:title.height[0],chapter:chapter.height[0],parent:parent.headerBarHeight()});
  }
  console.log(JSON.stringify({kind:'directory-topbar-variant-budget',samples,readingAndMangaNativeSetters:'unchanged',boundary:'Actual modifier declarations and parent methods; no Native glyph rasterization claim.'}));
 }
 for(const id of selected){await({'private-toolbar':privateToolbar,'fallback-carriers':fallbackCarriers,'header-budgets':headerBudgets,'topbar-variants':topbarVariants}[id]());recordContractCasePass(id);}
}
