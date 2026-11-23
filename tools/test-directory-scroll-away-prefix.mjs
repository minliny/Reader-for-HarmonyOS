import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {productionMangaDirectoryNavigationDataSource} from './lib/manga-directory-navigation-data-source-probe.mjs';
import {ReaderScrollLayout,readerScrollStartOffset,readerScrollEndOffset} from '../entry/src/main/ets/ui/layout/ReaderScrollLayout.ts';
import {readerDirectoryScopeKey} from '../entry/src/main/ets/features/reading/application/ReaderDirectoryNavigation.ts';

const selected=selectContractCases({indices:'Real SDK native List prefix and native/data mappings; unchanged canonical DataSource count/page ranks.',anchors:'Real production rect/position/prefix retirement methods with bounded timers; header is never a Core anchor.',states:'Actual Surface loading/error and Tree empty retain one List prefix and clear-query entry.', 'default-consumer':'Default0 native mapping and existing header-free START/CENTER behavior remain unchanged.'});
if(selected.length){
 const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryNavigationList.ets',import.meta.url),'utf8');
 const surface=readFileSync(new URL('../entry/src/main/ets/features/reading/ui/ReaderDirectoryNavigationSurface.ets',import.meta.url),'utf8');
 const production=productionMangaDirectoryNavigationDataSource(source);
 const node=index=>({nodeId:`node${index}`,kind:'target',chapterIndex:index,title:`Chapter${index}`,displayTitle:`Chapter${index}`,depth:0,level:1});
 const view=count=>({viewId:`view${count}`,navigationRevision:'rev',visibleTotal:count,nodes:Array.from({length:Math.min(256,count)},(_,i)=>node(i)),currentVisibleIndex:2,locateCurrent:false});
 const names=['build','emptyPrefix','prefixBuilder','emptyBuilder','nativeHeaderCount','nativeDisplayIndex','dataIndex','captureViewportAnchor','positionInitialCurrent','schedulePosition','onPrefixChanged','planPosition','onPrefixReveal','retirePrefixPosition','bindPrefixScrollIntent','headerCount','prefixHeight','prefixIdentity','prefixRevealRevision'];
 const stackPort={StartGetAccessRecordingFor(){},StopGetAccessRecording(){}};
 // ArkUI owns lazy ListItem materialization. Invoke its actual SDK-emitted
 // deep renderer at this finite native seam; do not replace the Builder body.
 function materialize(owner){const seen=new Set();for(;;){const next=[...owner.nodes.values()].find(n=>n.type==='ListItem'&&!seen.has(n.id));if(!next)break;seen.add(next.id);const renderer=next.create?.[0];if(typeof renderer==='function')renderer(next.id,true);}}
 function fixture(count=8,headers=1){
  const sdk=boundedSurfaceSdk(),timers=[],anchors=[],scrolls=[],rects=[],requests=[];let prefixCalls=0,emptyCalls=0;
  const data=new production.ReaderDirectoryNavigationDataSource(offset=>requests.push(offset)),v=view(count);data.replace(v);
  const {owner}=createReaderBuilderProbe(source,names,{...sdk.deps,ViewStackProcessor:stackPort,readerScrollStartOffset,readerScrollEndOffset,readerDirectoryScopeKey,
   readerDirectoryViewportAnchor:()=>anchors.at(-1),readerDirectorySaveViewportAnchor:a=>anchors.push(a),readerDirectoryObserveScrollIntent:()=>()=>{},
   setTimeout:fn=>{timers.push(fn);return timers.length;},LazyForEach:new Proxy({},{get:()=>()=>{}}),
   ScrollAlign:{START:'start',CENTER:'center'},LengthMetrics:{vp:value=>({value})}},sdk.hooks);
  Object.assign(owner,{view:v,dataSource:data,mangaDisplay:false,mangaCatalogDisplay:false,mangaQuickDisplay:false,mangaSearchActive:false,
   bookId:'book',sourceId:'local',rowHeight:64,headerCount:headers,prefixHeight:130,prefixIdentity:'scene',prefixRevealRevision:0,
   boundHeaderCount:headers,boundPrefixIdentity:'scene',boundPrefixHeight:130,prefixLayoutGeneration:0,
   mounted:true,generation:1,selectionGeneration:4,pendingPages:[{offset:256}],interactionEnabled:true,
   initialPositionPending:false,positionPlan:undefined,firstVisibleIndex:0,layoutReady:false,
   scrollLayout:new ReaderScrollLayout(0,0,'contentOffset'),listPaddingX:0,listPaddingRight:0,listPaddingY:0,listPaddingTop:0,listPaddingBottom:0,
   prefixBuilder:()=>prefixCalls++,emptyBuilder:()=>emptyCalls++,onFirstLayout(){},onUserScrollIntent(){},onScrollSettled(){},publishMangaScrollOffset(){},
   scroller:{getItemRect:i=>{rects.push(i);return {y:-16,height:64};},scrollToIndex:(...args)=>scrolls.push(['index',...args]),scrollTo:arg=>scrolls.push(['offset',arg]),currentOffset:()=>({xOffset:0,yOffset:32})}});
  return{owner,data,v,timers,anchors,scrolls,rects,requests,prefixCalls:()=>prefixCalls,emptyCalls:()=>emptyCalls};
 }
 function indices(){
  for(const headers of[0,1]){const f=fixture(600,headers),o=f.owner;o.initialRender();materialize(o);
   assert.equal(f.prefixCalls(),headers);assert.equal(f.data.totalCount(),600);assert.equal(f.data.currentView().visibleTotal,600);assert.deepEqual(f.requests,[]);
   for(const index of[0,2,255,256,599])assert.equal(o.nativeDisplayIndex(index),index+headers);
   assert.equal(o.nativeDisplayIndex(-1),undefined);assert.equal(o.nativeDisplayIndex(600),undefined);
   assert.equal(o.dataIndex(0),headers===1?-1:0);assert.equal(o.dataIndex(256+headers),256);
   const list=[...o.nodes.values()].find(n=>n.type==='List');assert(list);list.onScrollIndex(0,0,0);
   o.layoutReady=false;let layouts=0;o.onFirstLayout=()=>layouts++;list.onAreaChange({}, {width:320,height:122});list.onAreaChange({}, {width:300,height:168});assert.equal(layouts,headers===1?2:1,'only opt-in prefix forwards subsequent positive viewport receipts; default remains first-layout-only');
   assert.equal(o.firstVisibleIndex,headers===1?-1:0);assert.equal(f.anchors.length,headers===1?0:1,'header0 does not become chapter0');
   list.onScrollIndex(2+headers,3+headers,2+headers);assert.equal(f.anchors.at(-1).visibleIndex,2);assert.equal(f.rects.at(-1),2+headers);
   assert.equal(o.selectionGeneration,4);assert.equal(o.pendingPages.length,1,'prefix never flushes queued Core pages');
   f.data.getData(256);assert.deepEqual(f.requests,[256],'native prefix never offsets Core page requests');
   o.onPrefixReveal();list.onWillStartDragging();assert.equal(o.prefixRevealActive,false,'explicit user scroll retires the prefix-only focus intent');
   if(headers===1){o.prefixEverMounted=true;o.mounted=false;const saved=f.anchors.length,prior=layouts;list.onScrollIndex(2,2,2);list.onAreaChange({}, {width:320,height:122});list.onScrollStop();assert.equal(f.anchors.length,saved);assert.equal(layouts,prior,'retired optional-prefix native receipts cannot reach a successor owner');}
  }
 }
 function anchors(){
  const f=fixture(),o=f.owner;o.firstVisibleIndex=3;o.captureViewportAnchor();assert.equal(f.rects.at(-1),4);assert.equal(f.anchors.at(-1).nodeId,'node3');
  for(const align of['start','center']){o.initialPositionPending=true;o.positionPlan={viewId:f.v.viewId,index:3,rowFraction:.25,align};o.positionInitialCurrent();assert.equal(f.scrolls.at(-1)[1],4);}
  o.firstVisibleIndex=2;o.headerCount=0;o.onPrefixChanged();assert.equal(f.rects.at(-1),3,'old native layout is captured with old header count');f.timers.shift()();assert.equal(f.scrolls.at(-1)[1],2);
  o.headerCount=1;o.onPrefixChanged();o.onPrefixReveal();const before=f.scrolls.length;while(f.timers.length)f.timers.shift()();assert.equal(f.scrolls.length,before,'explicit focus/reveal retires old layout callback');
  o.retirePrefixPosition();o.boundHeaderCount=1;o.headerCount=1;o.boundPrefixIdentity='scene';o.prefixIdentity='scene';o.firstVisibleIndex=-1;o.prefixHeight=150;o.onPrefixChanged();const anchorCount=f.anchors.length;while(f.timers.length)f.timers.shift()();assert.equal(f.anchors.length,anchorCount);assert.deepEqual(f.scrolls.at(-1),['offset',{xOffset:0,yOffset:32}]);
  o.prefixHeight=170;o.onPrefixChanged();o.mounted=false;const retired=f.scrolls.length;while(f.timers.length)f.timers.shift()();assert.equal(f.scrolls.length,retired);
  const grouped=fixture(8,0),g=grouped.owner;g.firstVisibleIndex=3;g.headerCount=1;g.onPrefixChanged();g.prefixIdentity='next';g.onPrefixChanged();g.prefixHeight=160;g.onPrefixChanged();
  assert.deepEqual(grouped.rects,[3],'one reconciliation captures the old native index once, before all three props update');while(grouped.timers.length)grouped.timers.shift()();assert.equal(grouped.scrolls.at(-1)[1],4);
  const changing=fixture(),c=changing.owner;c.firstVisibleIndex=3;c.view=view(2);c.captureViewportAnchor();assert.equal(changing.anchors.at(-1).visibleIndex,3,'old rendered view count owns capture during a new Core view reconciliation');
  const focused=fixture(),h=focused.owner;h.firstVisibleIndex=3;h.onPrefixReveal();h.prefixHeight=170;h.onPrefixChanged();while(focused.timers.length)focused.timers.shift()();assert.deepEqual(focused.scrolls.at(-1),['offset',{xOffset:0,yOffset:0}],'later Area receipt before native scroll ACK keeps explicit prefix focus intent, never restores old chapter');
 }
 function states(){
  const e=fixture(0,1);e.owner.prefixHeight=180;e.owner.initialRender();materialize(e.owner);assert.equal(e.prefixCalls(),1);assert.equal(e.emptyCalls(),1);assert.equal([...e.owner.nodes.values()].filter(n=>n.type==='List').length,1);
  const emptyItems=[...e.owner.nodes.values()].filter(n=>n.type==='ListItem');assert.equal(emptyItems[1].constraintSize.minHeight,44);assert.equal(emptyItems[1].height,undefined,'state has natural extent, never viewport-minus-prefix or percentage item height');
  assert.equal(e.owner.dataIndex(0),-1);assert.equal(e.owner.dataIndex(1),-1);assert.deepEqual(e.requests,[]);assert.deepEqual(e.anchors,[],'neither prefix nor empty status becomes a Core rank');
  const emptyList=[...e.owner.nodes.values()].find(n=>n.type==='List');emptyList.onScrollIndex(0,1,0);emptyList.onScrollIndex(1,1,1);assert.equal(e.owner.firstVisibleIndex,-1);assert.deepEqual(e.requests,[]);assert.deepEqual(e.anchors,[],'actual native header/status callbacks cannot publish chapter0');
  for(const failed of[false,true]){const sdk=boundedSurfaceSdk();let prefix=0;
   const {owner}=createReaderBuilderProbe(surface,['build','hasPrefix','emptyPrefix','prefixBuilder','fallbackBuilder','treeEmptyState','prefixClearAction','prefixRetryAction','headerCount','prefixHeight','prefixIdentity','prefixRevealRevision'],{...sdk.deps,ViewStackProcessor:stackPort,ReaderDirectoryNavigationList:class{}},
    {...sdk.hooks,childSources:{...sdk.hooks.childSources,ReaderDirectoryNavigationList:source}});
   Object.assign(owner,{headerCount:1,prefixHeight:180,prefixIdentity:'s',mangaDisplay:false,mangaFontsReady:true,showLoadStatus:true,loadPending:!failed,loadFailed:failed,
    interactionEnabled:true,query:'query',hasRetainedContent:()=>false,prefixBuilder:()=>prefix++,onFirstLayout(){},retryOpen(){},onClearSearch(){},onTreeUserScrollIntent(){},view:undefined});
   owner.initialRender();materialize(owner);assert.equal(prefix,1);assert.equal([...owner.nodes.values()].filter(n=>n.type==='List').length,1);const items=[...owner.nodes.values()].filter(n=>n.type==='ListItem');assert.equal(items.length,2);assert.equal(items[1].constraintSize.minHeight,44);assert.equal(items[1].height,undefined,'loading/error remains natural and scrollable when prefix180 exceeds available122');
  }
  const sdk=boundedSurfaceSdk();let clears=0;const {owner}=createReaderBuilderProbe(surface,['treeEmptyState','prefixClearAction'],sdk.deps,sdk.hooks);
  Object.assign(owner,{query:'query',interactionEnabled:true,mounted:true,generation:1,bookId:'book',sourceId:'local',view:{viewId:'empty'},onClearSearch:()=>clears++});owner.treeEmptyState();
  const state=[...owner.children.values()].find(c=>c.message==='没有匹配的目录项');assert(state);state.onAction();assert.equal(clears,1);owner.generation++;state.onAction();assert.equal(clears,1,'old empty-state clear callback cannot enter a successor presentation');
 }
 function defaultConsumer(){
  const f=fixture(8,0),o=f.owner;for(const align of['start','center']){o.initialPositionPending=true;o.positionPlan={viewId:f.v.viewId,index:4,rowFraction:0,align};o.positionInitialCurrent();assert.equal(f.scrolls.at(-1)[1],4);}
  o.firstVisibleIndex=4;o.captureViewportAnchor();assert.equal(f.rects.at(-1),4);assert.equal(f.anchors.at(-1).visibleIndex,4);
  o.mangaDisplay=true;o.headerCount=1;assert.equal(o.nativeHeaderCount(),0,'opt-in is text-only; manga path retains its native indices');
 }
 for(const id of selected){await({indices,anchors,states,'default-consumer':defaultConsumer}[id]());recordContractCasePass(id);}
}
