import assert from 'node:assert/strict';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { selectedProductionMethods, selectedProductionClasses } from './lib/selected-production-methods.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { ReaderContentSearchPublication } from './lib/reader-content-search-owner-probe.mjs';
import { searchListDependencies } from './lib/reader-content-search-list-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/reading/ui/ReaderControlSearchGeometry.ts';
import * as searchControlGeometry from '../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts';
import { readerTypographyRoles as typography, readerMessageStyles as message } from './lib/reader-typography-probe.mjs';
const styles=selectedProductionClasses(new URL('../entry/src/main/ets/ui/foundation/ReaderTypography.ets',import.meta.url),['ReaderTextStyle','ReaderInheritedTextStyle']);
const file = name => new URL('../entry/src/main/ets/features/reading/ui/'+name,import.meta.url);
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const defs={
 'auto-demand':'Actual Content layout/scroll demand coalesces and rechecks current viewport, endpoint, failure, visit and query scope',
 'normal-budget':'Actual minimum measurer reserves zero footer for healthy continuation/loading and positive only for recovery',
 'incremental-cost':'Actual Publication→DataSource→row index handles 1000 bounded appends with work proportional to new rows',
 'inline-navigation-sdk':'Actual SDK navigation Buttons project the inline/modal admission through ReaderActionAccessibility and dispatch each captured target once',
 'inline-navigation':'Actual Panel admission and navigation finish inline editor once, reject late blur/stale completion, retain modal blocking',
};
for(const id of selectContractCases(defs)){
 if(id==='auto-demand'){
  const Content=selectedProductionMethods(file('ReaderControlSearchContent.ets'),'ReaderControlSearchContent',
   ['continuationQueued','scheduleResultContinuation','resultActionCurrent'],{READER_SEARCH_LIST_CACHE_COUNT:2});
  const p=new ReaderContentSearchPublication(),rows=Array.from({length:50},(_,i)=>({chapterIndex:i,chapterOffset:0}));
  p.publish({kind:'results',keyword:'词',results:rows,hasMore:true});
  let demands=0,end=48,viewport=180,enabled=true;
  const o=Object.assign(new Content(),{searchPublication:p,queryInputMounted:true,resultScrollMounted:true,resultScrollVisit:1,
   acceptedResultScrollScope:p.resultScrollScopeFor(p.stateAt(0)),motionProgress:0,resultViewportHeight:180,
   currentSearchState:()=>p.stateAt(0),displayState:()=>p.stateAt(0),currentInputEnabled:()=>enabled,
   resultLayout:()=>({viewportHeightVp:viewport,rowHeightVp:60,contentOriginVp:0}),resultListFrame:()=>({viewportHeightVp:180}),
   resultNativeOffset:()=>end*60-180,onNeedMore:()=>demands++});
  for(let i=0;i<10;i++)o.scheduleResultContinuation();await settle();assert.equal(demands,1);
  for(const change of [()=>{end=3;},()=>{viewport=0;},()=>{o.motionProgress=.5;},()=>{enabled=false;},
   ()=>{o.resultViewportHeight=0;},()=>{o.resultScrollMounted=false;},()=>{p.publish({...p.stateAt(0),loadingMore:true});},
   ()=>{p.publish({...p.stateAt(0),loadMoreError:'失败',loadingMore:false,continuationRetryable:true});}]){
    end=48;viewport=180;o.motionProgress=0;enabled=true;o.resultViewportHeight=180;o.resultScrollMounted=true;
    p.publish({kind:'results',keyword:'词',results:rows,hasMore:true});change();o.scheduleResultContinuation();await settle();assert.equal(demands,1);
  }
  p.publish({kind:'results',keyword:'词',results:rows.slice(0,1),hasMore:true});o.acceptedResultScrollScope=p.resultScrollScopeFor(p.stateAt(0));
  end=3;o.scheduleResultContinuation();await settle();assert.equal(demands,2,'short first page fills a non-scrolling viewport');
  o.scheduleResultContinuation();o.resultScrollVisit++;await settle();assert.equal(demands,2,'old queued visit cannot dispatch');
 }
 if(id==='normal-budget'){
  const measured=[];
  const {readerControlSearchMinimumFacts:facts,measureReaderSearchMinimum:measure}=pureModuleProbe(readFileSync(file('ReaderControlSearchMinimum.ets'),'utf8'),'ReaderControlSearchMinimum.ets',{
   ...geometry,...searchControlGeometry,...typography,...message,...styles,measureReaderControlText:(_ctx,text)=>{measured.push(text);return{heightVp:14,widthVp:20,singleLineWidthVp:20,fitsWidth:true};}
  },['readerControlSearchMinimumFacts','measureReaderSearchMinimum']);
  const row={chapterIndex:0,chapterTitle:'章',snippet:'词'};
  for(const state of [{kind:'results',keyword:'词',results:[row],hasMore:true},{kind:'results',keyword:'词',results:[row],hasMore:true,loadingMore:true},
    {kind:'results',keyword:'词',results:[row],hasMore:false}]){
   measured.length=0;const f=facts({query:'词',state,retainedLoadMoreFailure:false}),p=measure({}, {quickContentWidthVp:286,fullContentWidthVp:338},f);
   assert.equal(f.loadMoreLabel,'');assert.equal(f.loadMoreMessage,'');
   for(const form of [p.quick,p.full]){assert.equal(form.natural.loadMoreHeightVp,0);assert.equal(form.natural.loadMoreWidthVp,0);}
   assert.ok(!measured.includes(''),'normal footer has no text measurement');
  }
  for(const retry of [true,false]){
   const f=facts({query:'词',state:{kind:'results',keyword:'词',results:[row],hasMore:true,loadMoreError:'断线',continuationRetryable:retry},retainedLoadMoreFailure:true});
   assert.equal(f.loadMoreLabel,retry?'重试':'重新搜索');const p=measure({}, {quickContentWidthVp:286,fullContentWidthVp:338},f);
   assert.ok(p.quick.natural.loadMoreHeightVp>=44);assert.ok(p.full.natural.loadMoreHeightVp>=44);
  }
  const widths={quickContentWidthVp:286,fullContentWidthVp:338};
  const state={kind:'results',keyword:'词',results:[row],cacheScope:{cachedChapters:12,totalChapters:20}};
  const local=facts({query:'词',state,retainedLoadMoreFailure:false});
  const online=facts({query:'词',state,onlineBook:true,retainedLoadMoreFailure:false});
  assert.equal(local.message,'');
  assert.equal(online.message,'仅搜索已缓存章节（目录已缓存 12 / 20 章）');
  const localProfile=measure({},widths,local), onlineProfile=measure({},widths,online);
  const SearchContent=selectedProductionMethods(file('ReaderControlSearchContent.ets'),'ReaderControlSearchContent',['resultLayoutAt']);
  const view=Object.assign(new SearchContent(),{displayState:()=>state});
  for(const [endpoint,progress,width,height] of [['quick',0,286,190],['full',1,338,666]]){
   const localForm=localProfile[endpoint],onlineForm=onlineProfile[endpoint];
   const localFrame=geometry.sampleReaderControlSearch(progress,width,height,localForm.natural);
   const onlineFrame=geometry.sampleReaderControlSearch(progress,width,height,onlineForm.natural);
   assert.equal(localForm.natural.cacheScopeHeightVp,0);
   assert.equal(onlineForm.natural.cacheScopeHeightVp,14);
   assert.equal(onlineForm.minimum.heightVp,localForm.minimum.heightVp+14);
   assert.equal(onlineForm.natural.rowHeightVp,localForm.natural.rowHeightVp);
   assert.equal(onlineForm.natural.loadMoreHeightVp,0);
   assert.deepEqual(onlineFrame.field,localFrame.field);
   assert.deepEqual(onlineFrame.firstResult,localFrame.firstResult);
   assert.equal(view.resultLayoutAt(onlineFrame).viewportHeightVp,view.resultLayoutAt(localFrame).viewportHeightVp-14);
  }
  const idle=facts({query:'',state:{kind:'idle'},onlineBook:true,retainedLoadMoreFailure:false});
  assert.equal(idle.message,'仅搜索已缓存章节');
  const empty=facts({query:'词',state:{kind:'empty',keyword:'词',cacheScope:state.cacheScope},onlineBook:true,retainedLoadMoreFailure:false});
  assert.equal(empty.message,'未找到“词”\n仅搜索已缓存章节（目录已缓存 12 / 20 章）');
 }
 if(id==='incremental-cost'){
  const p=new ReaderContentSearchPublication(),Source=searchListDependencies.ReaderContentSearchDataSource,source=new Source();
  const Content=selectedProductionMethods(file('ReaderControlSearchContent.ets'),'ReaderControlSearchContent',
   ['indexedResultRows','indexedResultCount','resultRowIndexes','currentResultIndex']);
  const o=Object.assign(new Content(),{displayState:()=>p.stateAt(0)});let adds=0,reloads=0;
  source.registerDataChangeListener({onDataReloaded(){reloads++;},onDataAdd(){adds++;},onDataChange(){assert.fail('append cannot change old row');}});
  let reads=0;const row=i=>({get sourceId(){reads++;return 's';},bookId:'b',chapterIndex:i,chapterOffset:0});
  const gateway={async searchContentPage(_b,_q,limit,offset){return{results:Array.from({length:limit},(_,i)=>row(offset+i)),hasMore:true,nextCursor:`p:${offset+limit}`};},async closeContentSearch(){}};
  p.run(gateway,'b','词',10,()=>true,()=>{});await settle();const rows=p.stateAt(0).results;
  for(let i=0;i<1000;i++){
   source.publish('词',p.stateAt(0).results);assert.equal(o.currentResultIndex(i*10+9,0),i*10+9);
   p.needMore('b',10,()=>true,()=>{});await settle();
  }
  source.publish('词',rows);assert.equal(rows.length,10010);assert.equal(p.stateAt(0).results,rows);
  assert.equal(source.totalCount(),10010);assert.equal(o.currentResultIndex(10009,0),10009);
  assert.equal(adds,10000);assert.equal(reloads,1);assert.ok(reads<=3*10010,'no growing prefix scan or key set reconstruction');p.cancel();
 }
 if(id==='inline-navigation-sdk'){
  const controls=foundationControls();
  const {ReaderActionAccessibility}=pureModuleProbe(readFileSync(new URL('../entry/src/main/ets/ui/controls/ReaderActionAccessibility.ets',import.meta.url),'utf8'),
   'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['ReaderActionAccessibility']);
  const members=['moduleButton','temporaryInputScope','temporaryInputKind','endInlineEditing','navigationIntentPending','currentTemporaryInputScope',
   'hasCurrentTemporaryInput','hasCurrentModalInput','moduleTemporaryLayerHandler','controlActionInputEnabled','navigationInputEnabled','activateModule'];
  const probe=createReaderBuilderProbe(readFileSync(file('ReaderControlPanel.ets'),'utf8'),members,
   {...controls.dependencies,...typography,ReaderActionAccessibility},controls.hooks);
  const pages=[],o=Object.assign(probe.owner,{runtimeMounted:true,inputEnabled:true,inputCurrent:()=>true,controlObscured:false,preparedMinimumRequired:false,
   moreMenuVisible:false,visualVisibilityProgress:1,visualHeldPointerId:-1,sourceId:'s',bookTitle:'b',controlOpenRevision:1,appScheme:'day',ttsState:{status:'idle'},
   contentLocation:()=>({level:'secondary',module:'search',directoryTab:'directory'}),minimumInputReady:()=>true,currentMinimumIdentity:()=> 'identity',
   onTemporaryLayerChange(){},frame:()=>({navigation:{opacity:1,height:80}}),isActiveModule:()=>false,requestPage:p=>pages.push(p),onModuleSelect(){},
   selectedMinimumProfile:()=>undefined,moduleIcon:icon=>icon,controlActionHandler:action=>action});
  const report=o.moduleTemporaryLayerHandler('search');report(true,'inlineEditor',()=>report(false));
  for(const [icon,label,module] of [['rc_list','目录','directory'],['rc_headphones','朗读','tts'],['rc_palette','界面','appearance'],['rc_settings','设置','settings']])o.moduleButton(icon,label,module);
  const buttons=[...o.nodes.values()].filter(node=>node.type==='Button');assert.equal(buttons.length,4);
  for(const button of buttons){assert.equal(button.enabled,true);assert.equal(button.opacity,1);report(true,'inlineEditor',()=>report(false));button.onClick();await settle();}
  assert.deepEqual(pages,['moduleDirectory','moduleTts','moduleAppearance','moduleSettings']);report(true,'modal');o.replay();
  for(const button of buttons)assert.equal(button.enabled,false);
 }
 if(id==='inline-navigation'){
  const Panel=selectedProductionMethods(file('ReaderControlPanel.ets'),'ReaderControlPanel',[
   'temporaryInputScope','temporaryInputKind','endInlineEditing','navigationIntentPending','currentTemporaryInputScope',
   'hasCurrentTemporaryInput','hasCurrentModalInput','moduleTemporaryLayerHandler','controlActionInputEnabled','navigationInputEnabled','activateModule']);
  let location={level:'secondary',module:'search',directoryTab:'directory'},pages=[],modules=[],ends=0;
  const o=Object.assign(new Panel(),{runtimeMounted:true,inputEnabled:true,inputCurrent:()=>true,controlObscured:false,
   preparedMinimumRequired:false,moreMenuVisible:false,visualVisibilityProgress:1,visualHeldPointerId:-1,sourceId:'s',bookTitle:'b',controlOpenRevision:1,
   contentLocation:()=>location,minimumInputReady:()=>true,currentMinimumIdentity:()=> 'identity',onTemporaryLayerChange(){},
   frame:()=>({navigation:{opacity:1,height:80}}),isActiveModule:m=>location.module===m,
   requestPage:p=>pages.push(p),onModuleSelect:m=>modules.push(m)});
  for(const target of ['directory','tts','appearance','settings']){
   const report=o.moduleTemporaryLayerHandler('search');report(true,'inlineEditor',()=>{ends++;report(false);});
   assert.equal(o.navigationInputEnabled(),true);await o.activateModule(target);
   assert.equal(pages.at(-1),'module'+target[0].toUpperCase()+target.slice(1));
  }
  assert.equal(ends,4);assert.equal(pages.length,4);assert.equal(modules.length,4);
  const modal=o.moduleTemporaryLayerHandler('search');modal(true,'modal');assert.equal(o.navigationInputEnabled(),false);await o.activateModule('tts');assert.equal(pages.length,4);modal(false);
  const old=o.moduleTemporaryLayerHandler('search');o.controlOpenRevision++;const fresh=o.moduleTemporaryLayerHandler('search');fresh(true,'modal');old(false);
  assert.equal(o.temporaryInputKind,'modal','late blur cannot clear a successor owner');fresh(false);
  let release;const wait=new Promise(r=>release=r),report=o.moduleTemporaryLayerHandler('search');
  report(true,'inlineEditor',()=>wait);const pending=o.activateModule('tts');void o.activateModule('appearance');o.controlOpenRevision++;release();await pending;
  assert.equal(pages.length,4,'stale completion cannot navigate and repeated clicks remain single flight');
  o.controlObscured=true;assert.equal(o.navigationInputEnabled(),false);
 }
 recordContractCasePass(id);
}
