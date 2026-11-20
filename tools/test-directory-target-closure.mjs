import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'private-toolbar':'Actual FullDirectoryPanel private carriers/tabs/query parent budget at measured widths and scales.','fallback-carriers':'Actual shared fallback row carriers and three current parent projections through the same public width planner.'});
if(selected.length){
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
 const {selectedProductionMethods,selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
 const visual=await import('../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts');
 const layout=await import('../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts');
 const state=await import('../entry/src/main/ets/features/manga/MangaDirectoryState.ts');
 const {mangaDirectoryPresentation}=await import('../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts');
 const {mangaDirectoryEntryRowSdk}=await import('./lib/manga-directory-entry-row-probe.mjs');
 const read=path=>readFileSync(new URL('../entry/src/main/ets/features/'+path,import.meta.url),'utf8');
 const file=path=>new URL('../entry/src/main/ets/features/'+path,import.meta.url);
 const access=pureModuleProbe(read('common/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'BUTTON'}},['ReaderActionAccessibility','readerActionTouchRegion']);
 const resolver=pureModuleProbe(read('common/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
 const panelSource=read('reading/FullDirectoryPanel.ets');
 async function privateToolbar(){
  for(const width of [270,300,360])for(const scale of [1,1.3,1.6,2])for(const tab of ['directory','bookmarks']){
   const sdk=boundedSurfaceSdk(),children=[];
   class Query{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});children.push(this);}}
   const names=['searchControls','queryField','queryTools','controlButton','controlButtonLabel','queryStacked','searchControlsHeight','queryHeight','fontScale','innerWidth','panelWidth','tabStripHeight','tabHeight','tabs','directoryTab','bookmarkTab','activeTabLineWidth'];
   const {owner}=createReaderBuilderProbe(panelSource,names,{...sdk.deps,...resolver,...access,ReaderSearchField:Query,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:scale,windowRect:{width:1000,height:1000}})}},
    {...sdk.hooks,childSources:{ReaderSearchField:read('common/ReaderSearchField.ets')}});
   const actions=[];Object.assign(owner,{panelWidthOverride:width,readerWindowMetricsRevision:1,activeTab:tab,embeddedInControl:false,expandedLayout:false,searchDraft:'',searchPlaceholder:()=>'',handleControl:k=>actions.push(k),cancelProjectionTopScroll(){},switchTab(){}});
   owner.searchControls();const nodes=[...owner.nodes.values()],hits=nodes.filter(n=>n.type==='Stack'&&n.onClick);
   assert.equal(hits.length,tab==='directory'?4:1);for(const h of hits){assert.equal(h.width,44);assert.equal(h.height,44);assert.equal(h.responseRegion.width,44);assert.equal(h.responseRegion.x,0);h.onClick();}
   assert.equal(actions.length,hits.length);assert(nodes.some(n=>n.type==='Stack'&&n.width===32&&n.height===32&&!n.onClick),'authored32 paint remains under44 hit carrier');
   const inner=width-26,count=hits.length,expectedStack=inner-20-count*49<44;assert.equal(owner.queryStacked(),expectedStack,'actual actor width overrides global1000vp metrics');
   assert.equal(owner.searchControlsHeight(),51+Math.ceil(44+24*(scale-1))-44+(expectedStack?50:0));
   if(!expectedStack)assert(inner-20-count*44-count*5>=44,'inline query owns44 without touching adjacent target');
   else assert(inner-20-(count-1)*5>=count*44,'separate tool row owns all targets');
   owner.tabs();assert.equal(owner.tabStripHeight(),50);assert([...owner.nodes.values()].some(n=>n.type==='Row'&&n.height===49&&n.padding?.top===5),'44 tab plus top5 fits before divider');
  }
 }
 const timing=await import('../entry/src/main/ets/features/common/ProductMotionTiming.ts');
 const {SOURCE_SWITCH_VISUAL}=await import('../entry/src/main/ets/features/source/SourceSwitchVisual.ts');
 const {readerPanelActorPose}=await import('../entry/src/main/ets/features/reading/ReaderPanelMotionContract.ts');
 const curves=new Proxy({},{get:(_,name)=>(...args)=>({nativeCurve:String(name),args})});
 const motion=pureModuleProbe(read('common/MotionSpec.ets'),'MotionSpec.ets',{...timing,SOURCE_SWITCH_VISUAL,...visual,readerPanelActorPose,curves,Curve:new Proxy({},{get:(_,n)=>String(n)})},['motionAnimateParam']);
 async function fallbackCarriers(){
  const group={index:0,title:'Volume',navigable:false,downloadState:'unknown'},entries=[group,...Array.from({length:15},(_,i)=>({index:i+1,title:String(i+1),level:2,navigable:true,downloadState:'completed',bookmarks:[]}))];
  const presentation=mangaDirectoryPresentation(entries);
  for(const width of [240,280,340])for(const scale of [1,1.3,1.6,2]){
   const deps={...layout,...state,visual:visual.MANGA_DIRECTORY_VISUAL,mangaDirectoryPresentation,...visual,ReaderWindowCoordinator:{metrics:()=>({systemFontScale:scale})}};
   const Book=selectedProductionMethods(file('bookshelf/BookDirectoryPage.ets'),'BookDirectoryPage',['prepareMangaLayout'],deps);
   const book=Object.assign(new Book(),{mangaVisibleEntries:()=>entries,mangaPresentation:presentation,mangaNarrow:()=>true,mangaFontScale:()=>scale,contentFrame:()=>({width}),mangaDownloadEnabled:true,searchQuery:''});book.prepareMangaLayout();
   const Fallback=selectedProductionMethods(file('manga/MangaReadingDirectoryFallback.ets'),'MangaReadingDirectoryFallback',['prepareLayout'],deps);
   const fallback=Object.assign(new Fallback(),{projectedEntries:entries,presentation,mangaCatalogNarrow:true,viewportWidth:width,fontScale:()=>scale,chapterDownloadEnabled:true,query:''});fallback.prepareLayout();
   assert.deepEqual(book.mangaLayoutRows.map(r=>r.columns),fallback.layoutRows.map(r=>r.columns),'two actual download parents share one public capacity');
   const previewValues=selectedProductionValues(file('bookshelf/LocalBookDetail.ets'),['CHAPTER_PREVIEW_LIMIT']);
   const Detail=selectedProductionMethods(file('bookshelf/LocalBookDetail.ets'),'LocalBookDetail',['prepareMangaPreview'],{...deps,...previewValues});
   const detail=Object.assign(new Detail(),{toc:entries,book:{mangaPosition:{chapterIndex:7}},collapsedGroups:[],liveWidth:()=>width,contentFrame:()=>({width})});detail.prepareMangaPreview();const preview=detail.mangaPreviewRows;
   for(const [rows,downloads]of[[book.mangaLayoutRows,true],[fallback.layoutRows,true],[preview,false]])for(const row of rows){
    const sdk=mangaDirectoryEntryRowSdk({dependencies:{...access,...motion,globalThis:{Context:{animation(){}}},ReaderWindowCoordinator:{metrics:()=>({systemFontScale:scale})}}});
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
 for(const id of selected){await({'private-toolbar':privateToolbar,'fallback-carriers':fallbackCarriers}[id]());recordContractCasePass(id);}
}
