import assert from 'node:assert/strict';
import {fixture,book,deferred,until,seed,session} from './lib/reading-entry-index-fixture.mjs';
import {makeIndex} from './lib/reading-entry-sdk-consumer.mjs';
import {read} from './lib/reading-entry-owner-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';

const panelSource=read('features/reading/FullDirectoryPanel.ets');
const directorySource=read('features/bookshelf/BookDirectoryPage.ets');
const checks=[];
function wireState(index){
 const sdk=boundedSurfaceSdk();
 class Captured{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
 const fullSource=read('features/reading/ReaderFullDirectory.ets'),shellSource=read('features/shell/ReaderShell.ets');
 Object.assign(sdk.hooks.childSources,{BookDirectoryPage:directorySource,ReaderFullDirectory:fullSource,FullDirectoryPanel:panelSource});
 const deps={...sdk.deps,BookDirectoryPage:Captured,ReaderFullDirectory:Captured,FullDirectoryPanel:Captured};
 const direct=createReaderBuilderProbe(read('pages/Index.ets'),['externalDirectory'],deps,sdk.hooks).owner;
 Object.assign(direct,{detailBook:index.detailBook,detailToc:index.detailToc,detailLoadingMessage:index.detailLoadingMessage,detailCatalogBusy:index.detailCatalogBusy,
  directoryRecovery:()=>({}),settingsSnapshot:{reduceMotion:false}});direct.externalDirectory();
 const fullProps=[...direct.children.values()].find(c=>c instanceof Captured).params;
 assert.equal(fullProps.catalogBusy,index.detailCatalogBusy,'actual Index external directory forwards activity');
 const full=createReaderBuilderProbe(fullSource,['directoryContent'],deps,sdk.hooks).owner;
 Object.assign(full,fullProps,{usesExpandedLayout:()=>false,panelWidth:()=>300,fullPanelHeight:()=>400,panelViewportHeight:()=>400,panelLeft:()=>0,panelTop:()=>0,shouldAnimatePanel:()=>false});
 full.directoryContent();const panelProps=[...full.children.values()].find(c=>c instanceof Captured).params;
 assert.equal(panelProps.catalogBusy,index.detailCatalogBusy,'actual full directory forwards activity into its panel');
 for(const contentKind of ['text','manga']){
  const shell=createReaderBuilderProbe(shellSource,['readingOverlay'],deps,sdk.hooks).owner;
  Object.assign(shell,{route:'directory',contentKind,catalogMessage:index.detailLoadingMessage,catalogBusy:index.detailCatalogBusy,sourceSwitchVisible:false,
   sourceId:index.detailBook.sourceId,bookId:index.detailBook.bookId,tocEntries:index.detailToc,overlayStatusBarUnderlay(){}});
  shell.readingOverlay();const props=[...shell.children.values()].find(c=>c instanceof Captured).params;
  assert.equal(props.catalogBusy,index.detailCatalogBusy,'actual reader shell forwards activity to '+contentKind+' control directory');
 }
}

// Execute the real empty-state Builders and real shared native actions. Layout,
// tabs, and data-list rendering are ports; neither activity nor retry is stubbed.
function directoryState(message,busy){
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const directory=sdk.consumer(directorySource,['mangaEmptyState','catalogMessage','catalogBusy','catalogLoading','catalogRetryVisible'],{},
  {catalogMessage:message,catalogBusy:busy});
 let retries=0;Object.assign(directory,{mounted:true,searchQuery:'',navigationActive:false,emptyMessage:()=>message,onRetryCatalog:()=>retries++});
 directory.mangaEmptyState();
 const panel=sdk.consumer(panelSource,['directoryBody','catalogMessage','catalogBusy','catalogRetryVisible','catalogEmptyMessage'],{},
  {catalogMessage:message,catalogBusy:busy});
 Object.assign(panel,{activeTab:'chapters',entries:[],projectedEntries:[],navigationActive:false,
  tabs(){},searchControls(){},chapterList(){},statusFooter(){},chapterListHeight:()=>240,innerWidth:()=>300,bodyContentHeight:()=>300,onRetryCatalog:()=>retries++});
 panel.directoryBody();
 const action=owner=>sdk.walk(owner).find(c=>c instanceof sdk.deps.ReaderRecoveryAction);
 const click=owner=>{const actor=action(owner);assert.ok(actor);sdk.nodes(actor).find(n=>n.onClick).onClick();};
 if(busy){
  assert.equal(action(directory),undefined);assert.equal(action(panel),undefined);
  assert.equal(sdk.nodes(directory).filter(n=>n.type==='LoadingProgress').length,1,'actual busy gets native content loader');
 }else{
  assert.equal(sdk.nodes(directory).filter(n=>n.type==='LoadingProgress').length,0,'failure copy never creates a busy loader');
  click(directory);click(panel);assert.equal(retries,2,'both actual native actions dispatch existing retries');
 }
 return {sdk,directory,panel};
}

for(const message of ['读取失败：本地目录暂不可用','加载失败：目录内容暂不可用']){
 const f=fixture(),x=makeIndex(f),request=f.runtime.request;
 f.runtime.request=async(method,...args)=>{if(method==='local_book.toc')throw Error(message);return request(method,...args);};
 x.idx.openLocalBookDetail(book('failed','local'));
 assert.equal(x.idx.detailCatalogBusy,true,'real Host begin publishes explicit acquisition activity');
 await until(()=>x.idx.detailLoadingMessage===message);assert.equal(x.idx.detailCatalogBusy,false);
 assert.equal(x.owner().snapshot().catalogLoading,false);
 const leaf=x.render();assert.equal(leaf.catalogBusy,false);assert.equal(leaf.loadingMessage,message);
 leaf.catalog();const state=x.p.walk(leaf).filter(c=>c.title===message).at(-1);assert.ok(state,'real Host→Index→decorated detail carries the error text');
 assert.equal(state.loading,false);assert.equal(x.p.nodes(state).some(n=>n.type==='LoadingProgress'),false);
 wireState(x.idx);directoryState(x.idx.detailLoadingMessage,x.idx.detailCatalogBusy);
 f.close();checks.push(message);
}
{
 const f=fixture(),x=makeIndex(f),gate=deferred(),request=f.runtime.request;
 f.runtime.request=async(method,...args)=>{if(method==='local_book.toc')await gate.promise;return request(method,...args);};
 x.idx.openLocalBookDetail(book('waiting','local'));
 assert.equal(x.idx.detailCatalogBusy,true);const leaf=x.render();assert.equal(leaf.catalogBusy,true);
 leaf.catalog();const state=x.p.walk(leaf).find(c=>c.title==='正在读取本地目录…');assert.ok(state);assert.equal(state.loading,true);
 assert.ok(x.p.nodes(state).some(n=>n.type==='LoadingProgress'&&n.width===32&&n.height===32));
 wireState(x.idx);directoryState('正在读取本地目录…',true);
 gate.resolve();await until(()=>!x.idx.detailCatalogBusy);assert.ok(x.idx.detailToc.length>0);f.close();checks.push('actual loading and successful settle');
}
{
 const f=fixture();const request=f.runtime.request;
 f.runtime.request=async(method,...args)=>method==='local_book.toc'?{data:{sourceId:'local',bookId:'empty',toc:[]}}:request(method,...args);
 await f.host.openLocal(book('empty','local'),f.lease);
 assert.equal(f.host.snapshot().catalogLoading,false);assert.equal(f.host.snapshot().toc.length,0);assert.equal(f.host.snapshot().loadingMessage,'');
 directoryState('',false);f.close();checks.push('successful empty catalog is not loading');
}
{
 const f=fixture();const entries=[{index:0,title:'Retained chapter'}];
 f.host.bindReader(book(),session(),entries,false,f.lease);
 assert.equal(f.host.snapshot().catalogLoading,false,'binding an admitted reader is not a catalog acquisition');
 f.control.failProjection=true;await f.host.refreshProjection();assert.match(f.host.snapshot().backgroundError,/projection unavailable/,'actual failed background read is reported');
 assert.equal(f.host.snapshot().toc,entries,'background read failure preserves the original TOC');assert.equal(f.host.snapshot().catalogLoading,false);
 f.host.retire();assert.equal(f.host.snapshot().catalogLoading,false);f.close();checks.push('reader binding/background failure/retire preserve honest catalog state');
}
{
 const f=fixture();f.coordinator.acquireBookWithBackgroundRefresh=async()=>{throw Error('加载失败：远程目录');};
 await f.host.openRemote({seed:seed(),sourceName:'Source'},f.lease);
 assert.equal(f.host.snapshot().catalogLoading,false);assert.match(f.host.snapshot().loadingMessage,/加载失败/);f.close();checks.push('remote catch settles explicit activity');
}
// Negative control: restore only the old wording heuristic in the actual SDK
// consumer. The same known failure must be rejected, not accepted as busy.
{
 const mutant=directorySource.replace('private catalogLoading(): boolean { return this.catalogBusy; }',
  'private catalogLoading(): boolean { return /^正在|^加载|^读取/.test(this.catalogMessage.trim()); }');
 assert.notEqual(mutant,directorySource);
 const sdk=boundedSurfaceSdk(),owner=sdk.consumer(mutant,['catalogMessage','catalogBusy','catalogLoading'],{},
  {catalogMessage:'读取失败：目录',catalogBusy:false});
 assert.throws(()=>assert.equal(owner.catalogLoading(),false),assert.AssertionError);
}
console.log(`PASS ${checks.length} explicit catalog-state Host→Index→SDK groups plus old-heuristic negative control: ${checks.join('; ')}`);
