import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';

const selected=selectContractCases({
  'fold-policy':'Three actual SDK retained Image observers consume current canonical motion preference and preserve fold actions.',
  'scroll-policy':'Actual tree, Settings, Downloads and preview commands read current policy at dispatch and preserve targets/admission.',
});
if(!selected.length)process.exit(0);
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {createArkUIPropertyRuntimeProbe}=await import('./lib/arkui-property-runtime-probe.mjs');
const {boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
const {selectedProductionMethods,selectedProductionComponentCallback}=await import('./lib/selected-production-methods.mjs');
const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
const {mangaRowBuilderMembers,mangaGridProbeDependencies}=await import('./lib/manga-directory-grid-probe.mjs');
const {mangaDirectoryEntryRowSdk}=await import('./lib/manga-directory-entry-row-probe.mjs');
const timing=await import('../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts');
const fonts=await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
const {SOURCE_CHROME_VISUAL}=await import('../entry/src/main/ets/ui/foundation/ReaderSourceChromeVisual.ts');
const {readerMotionValueDurationMs:collapseMotionDurationMs}=await import('../entry/src/main/ets/ui/foundation/ReaderMotionDurationPolicy.ts');
const root=new URL('../entry/src/main/ets/',import.meta.url),file=path=>new URL(path,root),read=path=>readFileSync(file(path),'utf8');
const enumOf=name=>new Proxy({},{get:(_,key)=>name+'.'+String(key)});
const motion=pureModuleProbe(read('ui/foundation/MotionSpec.ets'),'MotionSpec.ets',{
  ...timing,SOURCE_SWITCH_VISUAL:SOURCE_CHROME_VISUAL,MANGA_DIRECTORY_VISUAL:mangaGridProbeDependencies.MANGA_DIRECTORY_VISUAL,
  Curve:enumOf('Curve'),curves:new Proxy({},{get:(_,key)=>(...args)=>({nativeCurve:String(key),args})}),
},['motionAnimateParam','motionSpecGet']);
const policy=pureModuleProbe(read('ui/foundation/ReaderMotionPolicy.ets'),'ReaderMotionPolicy.ets',
  {...motion,collapseMotionDurationMs},['readerMotionAnimateParam']);
const rowPath='features/manga/ui/MangaDirectoryEntryRow.ets',listPath='features/reading/ui/ReaderDirectoryNavigationList.ets';

function verifyFold(rowSource=read(rowPath),listSource=read(listPath)){
  const receipts=[];
  for(const kind of ['flat','target','group']){
    const properties=createArkUIPropertyRuntimeProbe();
    let owner,entry,node,invoke;
    const events=[];
    if(kind==='flat'){
      const sdk=mangaDirectoryEntryRowSdk({source:rowSource,properties,dependencies:{...motion,...policy,globalThis}});
      owner=createReaderBuilderProbe(rowSource,boundedMembers(rowSource),sdk.deps,sdk.hooks).owner;
      entry={index:1,title:'分卷',navigable:false,downloadState:'unknown'};
      Object.assign(owner,{row:{kind:'row',columns:1,startIndex:0,entries:[entry],labels:[]},
        presentation:new Map([[1,{group:true,hasChildren:true}]]),collapsedBranches:[],query:'',
        interactionEnabled:true,onToggleBranch:value=>events.push(value.index)});
      invoke=()=>owner.branchToggle(entry);
    }else{
      owner=createReaderBuilderProbe(listSource,['reduceMotion','rowPresentationRevision','emptyBuilder','emptyPrefix',...mangaRowBuilderMembers],
        {...mangaGridProbeDependencies,...fonts,...motion,...policy,...properties.sdk,globalThis},properties.hooks).owner;
      node={nodeId:kind,kind,title:'分卷',depth:1,chapterIndex:kind==='target'?1:undefined,hasChildren:true,expanded:true};
      const view={viewId:'view'};
      Object.assign(owner,{view,mangaScheme:'day',appThemeScheme:'day',mangaSearchActive:false,
        mangaQuickDisplay:false,mangaCatalogDisplay:true,currentChapterIndex:-1,interactionEnabled:true,
        rowPresentationRevision:0,mangaLayoutByNode:new Map(),mangaGridSpans:new Map(),
        dataSource:{currentView:()=>view,loadedItemById:()=>({node,index:0}),loadedNode:()=>undefined},
        toggleNode:value=>events.push(value.nodeId),selectTarget:()=>assert.fail('fold must not select')});
      invoke=()=>owner.mangaRow({node,index:0,key:node.nodeId});
    }
    invoke();
    const image=[...owner.nodes.values()].find(n=>n.type==='Image'&&n.rotate&&n.animation);
    assert.ok(image,'actual SDK fold Image exists');assert.equal(image.animation.duration,180);
    const identity=image.id;
    const toggle=[...owner.nodes.values()].find(n=>n.type==='Button'&&n.onClick);
    assert.ok(toggle);toggle.onClick();assert.equal(events.length,1,'original fold action still dispatched');
    owner.reduceMotion=true;properties.flush();
    assert.equal(owner.nodes.get(identity).animation.duration,0,'retained native fold observes current zero clock');
    assert.ok(properties.reads.some(r=>r.name==='reduceMotion'&&r.id===identity),'actual Image observer owns preference dependency');
    owner.reduceMotion=false;properties.flush();
    assert.equal(owner.nodes.get(identity).animation.duration,180,'same Image restores registered clock');
    receipts.push(kind);
  }
  return receipts;
}

async function verifyScroll(){
  const receipts=[];
  const properties=createArkUIPropertyRuntimeProbe();
  const list=createReaderBuilderProbe(read(listPath),['reduceMotion','positionInitialCurrent'],{...properties.sdk,
    ScrollAlign:{START:'start',CENTER:'center'},LengthMetrics:{vp:value=>({value})},
  }).owner;
  const scrolls=[],plan={viewId:'view',index:9,rowFraction:0,align:'start',currentInset:12,smooth:true};
  Object.assign(list,{view:{viewId:'view'},scroller:{scrollToIndex:(...args)=>scrolls.push(args)},
    mangaDisplay:true,mangaVisibleTopInset:0,mangaViewportHeight:0,nativeHeaderCount:()=>0,
    nativeDisplayIndex:index=>index+1,mangaContentStartOffset:()=>0});
  for(const reduced of [false,true,false]){
    list.initialPositionPending=true;list.positionPlan=plan;list.reduceMotion=reduced;list.positionInitialCurrent();
    assert.deepEqual(scrolls.at(-1),[10,!reduced,'start',{extraOffset:{value:-12}}],'dispatch uses latest tree policy without changing plan target');
    assert.equal(list.initialPositionPending,false);assert.equal(plan.smooth,true,'producer keeps locate intent');
  }
  receipts.push('tree');
  const shellFile=file('features/settings/ui/SettingsShell.ets');
  const Shell=selectedProductionMethods(shellFile,'SettingsShell',['scrollHomeToTop']);
  const shell=Object.assign(new Shell(),{activeSection:'home',tapBottomScrollTop:true,homeScroller:{scrollTo:request=>scrolls.push(request)}});
  for(const reduced of [false,true,false]){
    shell.reduceMotion=selectedProductionComponentCallback(file('features/settings/ui/SettingsPage.ets'),'SettingsShell','reduceMotion',{appReduceMotion:reduced});
    shell.scrollHomeToTop();assert.deepEqual(scrolls.at(-1),{xOffset:0,yOffset:0,animation:!reduced});
  }
  const count=scrolls.length;shell.tapBottomScrollTop=false;shell.scrollHomeToTop();
  shell.tapBottomScrollTop=true;shell.activeSection='general';shell.scrollHomeToTop();assert.equal(scrolls.length,count);
  receipts.push('settings');
  const Download=selectedProductionMethods(file('features/downloads/ui/SharedDownloadPage.ets'),'SharedDownloadPage',['locateCurrent'],{ScrollAlign:{CENTER:'center'}});
  const chapter={key:'current'},book={chapters:[{key:'other'},chapter]},effects=[];
  const download=Object.assign(new Download(),{currentChapter:()=>chapter,detail:()=>book,
    cancelChapterScrollRestore:()=>effects.push('chapter-restore-cancel'),cancelManagingScroll:()=>effects.push('managing-scroll-cancel'),
    chapterScroller:{scrollToIndex:(...args)=>effects.push(args)}});
  for(const reduced of [false,true,false]){
    download.reduceMotion=reduced;download.locateCurrent();
    assert.deepEqual(effects.splice(0),['chapter-restore-cancel','managing-scroll-cancel',[4,!reduced,'center']]);
  }
  receipts.push('downloads');
  const Preview=selectedProductionMethods(file('features/settings/ui/ReaderMessagePreviewPage.ets'),'ReaderMessagePreviewPage',
    ['select','begin','admitted','clearPreview','pageActive'],{Edge:{Top:'top'},previewImportBatch:()=>assert.fail('no task IO')});
  const preview=Object.assign(new Preview(),{mounted:true,previewEnabled:true,foreground:true,timer:-1,generation:0,
    feedback:{reset(){}},scroller:{scrollTo:value=>scrolls.push(['to',value]),scrollEdge:value=>scrolls.push(['edge',value])}});
  for(const reduced of [false,true,false])for(const scene of ['page-loading','page-empty','page-failure']){
    preview.reduceMotion=reduced;preview.select(scene);
    assert.deepEqual(scrolls.at(-1),reduced?['to',{xOffset:0,yOffset:0,animation:false}]:['edge','top']);
  }
  const before=scrolls.length;preview.foreground=false;preview.select('page-empty');assert.equal(scrolls.length,before);
  receipts.push('preview');return receipts;
}

for(const id of selected){
  const receipts=id==='fold-policy'?verifyFold():await verifyScroll();
  if(id==='fold-policy'){
    for(const path of [rowPath,listPath]){
      const source=read(path),old=source.replaceAll("readerMotionAnimateParam('manga.directory.fold', this.reduceMotion)","motionAnimateParam('manga.directory.fold')");
      assert.notEqual(old,source);assert.throws(()=>verifyFold(path===rowPath?old:read(rowPath),path===listPath?old:read(listPath)),/retained native fold observes/);
    }
  }
  console.log(JSON.stringify({kind:'ui-review-native-motion-policy',case:id,receipts,layer:'installed SDK authoring/property delivery or actual production methods; native rendering/scroll physics remain separate'}));
  recordContractCasePass(id);
}
