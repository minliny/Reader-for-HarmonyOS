import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {fixture,settle as settleOwner,deferred,origin,target,session,Runtime,read,gatewayExports,setCurrentRuntime} from './lib/source-switch-owner-probe.mjs';
const evidence=await import('../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
import * as horizontal from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const {ReaderNativeAlertOwner}=await import('../entry/src/main/ets/app/ReaderNativeAlertOwner.ts');
const {ReadingOfflineHost}=await import('./lib/reader-reading-owner-sdk-probe.mjs');
const settle=async()=>{await settleOwner();await new Promise(setImmediate);await settleOwner();};
const methods=['getSourceSwitchHost','sourceSwitchContext','sourceSwitchLease','applySourceSwitchSnapshot','retireRssPresentation','retireSourceSwitchPresentation',
 'bindSourceSwitchReader','applySourceSwitchEffect','openSourceSwitch','openDetailSourceSwitch','retrySourceSwitch','refreshSourceSwitch',
 'sourceSwitchProbeQuery','knownSearchSourceCandidates','onPickSource','retryFailedSourceSwitch','dismissSourceSwitchFailure','onRollbackSourceSwitch',
 'closeSourceSwitch','performSourceSwitchSeam','resolveReaderSourceSwitchTransaction','reconcilePendingSourceSwitches','currentSourceSwitchTransactionId',
 'nextNavigationGeneration','isCurrentRuntime','openReading','onRemoteSessionReady','installRemoteReadingSession','updateRemoteReadableChapterOrder',
 'applyReadingCommit','getReadingOfflineHost','cleanupRetiredSourceCache','sourceSwitchOverlayContent'];
const states=['sourceSwitchVisible','sourceSwitchState','sourceSwitchFailureMessage','sourceSwitchScopeId'];
function makeIndex(f,{navigation=1,reading=false}={}){
 const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true});
 const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 const Repeat=function Repeat(items){return{each(fn){this.generator=fn;return this;},key(){return this;},virtualScroll(){return this;},render(){items.forEach((item,index)=>this.generator({item,index}));}};};
 const leafDeps={Repeat,Refresh:new Proxy({name:"Refresh"},{get:(t,k)=>k==="name"?"Refresh":()=>{}}),...p.deps,...horizontal,...metricsApi,...gatewayExports,ReaderWindowCoordinator:{metrics:()=>metrics},registerReaderFonts(){},
   sourceSwitchSourceCount:candidates=>new Set(candidates.map(c=>c.sourceId)).size};
 p.hooks.childSources.SourceSwitchPanel=read('features/source/SourceSwitchWindow.ets');
 p.hooks.childSources.CandidateRow=read('features/source/CandidateRow.ets');
 p.hooks.childSources.LatencyBar=read('features/source/LatencyBar.ets');
 leafDeps.LatencyBar=createReaderBuilderProbe(p.hooks.childSources.LatencyBar,boundedMembers(p.hooks.childSources.LatencyBar),leafDeps,p.hooks).Component;
 leafDeps.CandidateRow=createReaderBuilderProbe(p.hooks.childSources.CandidateRow,boundedMembers(p.hooks.childSources.CandidateRow),
   {...leafDeps,LATENCY_TEXT_W:28,CHAPTER_TEXT_W:100},p.hooks).Component;
 leafDeps.SourceSwitchPanel=createReaderBuilderProbe(p.hooks.childSources.SourceSwitchPanel,boundedMembers(p.hooks.childSources.SourceSwitchPanel),leafDeps,p.hooks).Component;
 leafDeps.SourceSwitchPanel.prototype.__Repeat=items=>Repeat(items);
 const index=p.consumer(read('pages/Index.ets'),[...states,...methods],{...leafDeps,...evidence,ReaderRuntimeOwner:Runtime,
   SourceSwitchHost:f.Constructor,ReadingOfflineHost,LOCAL_SOURCE_ID:'local',DOMAIN:0,hilog:{info(){},warn(){}},ReaderNativeAlertOwner},{sourceSwitchScopeId:0});
 Object.assign(index,{mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:1,navigationGeneration:navigation,
   route:reading?'reading':'detail',readingOriginRoute:'detail',detailReturnRoute:'bookshelf',readingSessionActive:reading,detailBook:{...origin,sourceName:'Old'},
   shelfBooks:[origin],detailToc:[{index:0,title:'Chapter 1',navigable:true}],detailInBookshelf:f.context.inBookshelf,
   sourceSwitchHost:undefined,shelfOperation:{removalKey:''},searchDetailCandidates:[],searchHost:{searchedSourceIds:()=>[]},
   remoteSessionGeneration:0,remoteContentProbeGeneration:0,remoteReadableChapterIndexes:[],remoteReadableChapterOrder:new Map(),
   directoryCurrentChapterIndex:0,requestedChapterIndex:0,readingReadyGeneration:1,bookshelfCatalogEpoch:0,bookshelfBackgroundEpoch:0,
   nativeAlertOwner:new ReaderNativeAlertOwner(),effects:[],cleanup:[],refreshBookshelf(){this.effects.push('refreshShelf');},
   readingDetailForShelf:book=>({...book,sourceName:book.sourceId}),consumeSystemFileOpen(){this.effects.push('consumeWant');},
   cleanupRetiredSourceCache(tx){this.cleanup.push(tx);},prefetchReadingWindow:async()=>{},isRemoteCatalogNearEnd:()=>false,
   openRemoteBookDetail(seed,name,_shelf,resume,_candidates,_names,parent,validated){this.effects.push({seed,name,resume,parent,validated});},
   reopenSwitchedBook(book){this.effects.push({reopen:book});},returnToReadingOrigin(){this.route=this.readingOriginRoute;},
   isKnownDetailChapter:n=>index.detailToc.some(e=>e.index===n)});
 const acquire=f.runtime.bookAcquisitions;f.runtime.bookAcquisitions=()=>({...acquire(),readingProjectionRevision:()=>0});
 const mount=()=>{index.sourceSwitchOverlayContent();return p.walk(index).filter(x=>x instanceof leafDeps.SourceSwitchPanel).at(-1);};
 const rows=()=>p.walk(index).filter(x=>x instanceof leafDeps.CandidateRow);
 return{p,index,mount,rows,leafDeps};
}
function failureChain(x){
 const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
 const ts=require(sdk+'/node_modules/typescript'),source=read('pages/Index.ets');
 const ast=ts.createSourceFile('/tmp/ActualSourceFailureBridge.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
 let actualShell;const visit=n=>{if(ts.isCallExpression(n)&&n.expression.getText(ast)==='ReaderShell')actualShell=n;ts.forEachChild(n,visit);};visit(ast);
 const names=new Set(['sourceSwitchScopeId','sourceSwitchFailureMessage','onRetryFailedSourceSwitch','onDismissSourceSwitchFailure']);
 const fields=actualShell.arguments[0].properties.filter(p=>names.has(p.name?.getText(ast))).map(p=>p.getText(ast));assert.equal(fields.length,4);
 class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(p){Object.assign(this.params,p);}}
 const carrier=createReaderBuilderProbe('@Component struct ActualIndexFailurePayload {@Builder payload(){ReaderShell({'+fields.join(',')+'});}build(){Column(){}}}',
  ['payload'],{ReaderShell:Child},{childSources:{ReaderShell:read('features/shell/ReaderShell.ets')}}).owner;
 for(const n of ['sourceSwitchScopeId','sourceSwitchFailureMessage'])Object.defineProperty(carrier,n,{get:()=>x.index[n]});
 for(const n of ['retryFailedSourceSwitch','dismissSourceSwitchFailure'])carrier[n]=id=>x.index[n](id);
 carrier.payload();const payload=[...carrier.children.values()][0].params;
 const shell=read('features/shell/ReaderShell.ets'),start=shell.indexOf('        ForEach([this.readingIdentityKey()]'),tail='        }, (identity: string): string => identity);',end=shell.indexOf(tail,start)+tail.length;
 assert.ok(start>=0&&end>start);
 const retained=createReaderBuilderProbe('@Component struct ActualRetainedSourceReader {@Builder readingOwner(){'+shell.slice(start,end)+'}build(){Column(){}}}',
  ['readingOwner'],{ReadingExperience:Child},{childSources:{ReadingExperience:read('features/reading/LocalReadingExperience.ets')}}).owner;
 Object.assign(retained,payload,{sourceId:x.index.detailBook.sourceId,bookId:x.index.detailBook.bookId,readingReadyGeneration:1,route:'reading',visible:true,
  readingIdentityKey(){return JSON.stringify([this.sourceId,this.bookId,this.readingReadyGeneration]);}});
 retained.readingOwner();const actualReaderProps=[...retained.children.values()][0].params;
 const o=x.p.consumer(read('features/reading/LocalReadingExperience.ets'),['sourceSwitchScopeId','sourceSwitchFailureMessage','readingFailureContent'],
  {LOCAL_READING_SOURCE_ID:'local',readerAppearanceThemeStyle:()=>({ink:'#111111',paperStart:'#ffffff'})},actualReaderProps);
 Object.assign(o,actualReaderProps,{sourceId:'old',appearanceSnapshot:{activeTheme:'day'},readingLayout:()=>({bodyWidth:()=>390,bodyHeight:()=>800,contentLeft:0,contentTop:0}),
  openReaderControl(){},onSwitchSource(){},retryReading(){assert.fail('source recovery must not restart ordinary body loading');}});
 const render=()=>{o.readingFailureContent();return{retry:x.p.nodes(o).filter(n=>n.createWithLabel==='重试').at(-1).onClick,dismiss:x.p.nodes(o).filter(n=>n.createWithLabel==='继续当前书源').at(-1).onClick};};
 return{o,render};
}
const checks=[];
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f);x.index.openDetailSourceSwitch();await settle();
 assert.equal(x.index.sourceSwitchState.kind,'candidates');assert.equal(x.index.sourceSwitchScopeId,f.host.current().scopeId);
 const panel=x.mount(),row=x.rows().find(r=>r.sourceId==='new');assert.ok(row);
 const originalFrame=x.p.walk(panel).find(c=>c instanceof x.p.deps.ReaderBoundedSurface);
 assert.equal(x.p.nodes(originalFrame).find(n=>n.type==='Column').height,385);
 row.onSelect();await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
 assert.equal(x.index.detailBook.sourceId,'new');assert.equal(x.index.route,'reading');assert.equal(x.index.requestedChapterIndex,0);
 assert.equal(x.index.remoteReadingSession.identity.sourceId,'new');assert.equal(x.index.currentSourceSwitchTransactionId(),f.host.current().pending.transactionId);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,1);
 assert.equal(f.calls.filter(([m])=>m==='acquire').length,1);
 const tx=f.host.current().pending.transactionId;
 for(const bad of [undefined,'old-transaction']){
  x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:bad});
  assert.equal(f.host.current().pending.transactionId,tx);assert.equal(x.index.cleanup.length,0);
 }
 x.index.applyReadingCommit({...origin,chapterIndex:0,sourceSwitchTransactionId:tx});assert.equal(f.host.current().pending.transactionId,tx);
 f.setPhase('finalized');x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(f.host.current().pending,undefined);assert.equal(x.index.cleanup.length,1);assert.equal(x.index.cleanup[0].fromSourceId,'old');
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});assert.equal(x.index.cleanup.length,1);
 checks.push('actual-Index-Host-Gateway-SDK-candidate-reader-seam-and-exact-finalization');
}
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f);x.index.openDetailSourceSwitch();await settle();const old=x.mount(),scope=x.index.sourceSwitchScopeId;
 old.onClose();assert.equal(f.host.current().visible,false);x.index.openDetailSourceSwitch();await settle();const current=x.mount();
 assert.notEqual(x.index.sourceSwitchScopeId,scope);old.onClose();old.onRetry();old.onRefresh();old.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.current().visible,true);assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 current.onClose();assert.equal(f.host.current().visible,false);
 checks.push('actual-SDK-detail-overlay-reopen-old-physical-actions-rejected');
}
{
 const f=fixture({shared:true,open:false,loseCommitAck:true,failExactQuery:true}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();const panel=x.mount();panel.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(x.index.sourceSwitchState.confirmation,'unknown');
 const rendered=x.mount();assert.ok(x.p.nodes(rendered).some(n=>n.create==='换源结果未确认'));
 const action=x.p.nodes(rendered).find(n=>n.create==='重试核对');assert.ok(action?.onClick);
 panel.onClose();assert.equal(f.host.current().visible,true);
 f.options.failExactQuery=false;action.onClick();await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
 assert.equal(x.index.detailBook.sourceId,'new');assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,1);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.rollback').length,0);
 checks.push('actual-unknown-title-reads-exact-recovery-without-second-commit');
}
{
 const gate=deferred(),f=fixture({shared:true,open:false,commitGate:gate}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();const panel=x.mount();panel.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.consumeBack(x.index.sourceSwitchScopeId),true);assert.equal(f.host.current().visible,true);
 x.index.nextNavigationGeneration();x.index.detailBook={sourceId:'other',bookId:'other'};gate.resolve();await settle();
 assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.targetSourceId,'new');
 assert.equal(x.index.detailBook.sourceId,'other');assert.equal(x.index.sourceSwitchVisible,false);
 checks.push('retired-navigation-keeps-accepted-ACK-without-late-reader-navigation');
}
{
 const f=fixture({shared:true,open:false,preview:true,failAcquire:true}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();const old=x.mount();old.onSelectCandidate(f.candidate());await settle();
 assert.equal(x.index.route,'reading');assert.equal(x.index.readingSessionActive,true);assert.equal(x.index.sourceSwitchFailureMessage,'body unavailable');
 const oldScope=old.owner.sourceSwitchScopeId;const scope=x.index.sourceSwitchScopeId;
 assert.equal(f.host.current().scopeId,scope);const calls=f.calls.length;x.index.retryFailedSourceSwitch(oldScope-1);assert.equal(f.calls.length,calls);
 f.options.failAcquire=false;x.index.retryFailedSourceSwitch(scope);await settle();assert.ok(x.index.effects.some(e=>e.validated));
 checks.push('detail-acquisition-failure-mounts-reader-with-live-explicit-recovery-scope');
}
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f);x.index.openDetailSourceSwitch();await settle();
 const originalScope=x.index.sourceSwitchScopeId;const old=x.mount();
 x.index.retireSourceSwitchPresentation();const successor=makeIndex(f,{navigation:5});successor.index.openDetailSourceSwitch();await settle();
 const scope=successor.index.sourceSwitchScopeId;assert.notEqual(scope,originalScope);
 x.index.retireSourceSwitchPresentation();assert.equal(f.host.current().visible,true,'old detach must not retire a successor presentation');
 old.onClose();assert.equal(f.host.current().visible,true);
 setCurrentRuntime(undefined);successor.index.openSourceSwitch();successor.index.onPickSource(f.candidate(),scope);await settle();
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('same-Runtime-successor-lease-old-detach-and-runtime-unavailable');
}
{
 const f=fixture({shared:true,open:false,preview:true,failAcquire:true}),x=makeIndex(f);
 x.index.openDetailSourceSwitch();await settle();x.mount().onSelectCandidate(f.candidate());await settle();
 const chain=failureChain(x),old=chain.render(),oldScope=x.index.sourceSwitchScopeId;
 x.index.nextNavigationGeneration();x.index.bindSourceSwitchReader(f.host);assert.notEqual(x.index.sourceSwitchScopeId,oldScope);
 chain.o.updateStateVars({sourceSwitchScopeId:x.index.sourceSwitchScopeId,sourceSwitchFailureMessage:x.index.sourceSwitchFailureMessage});
 const count=f.calls.length;old.retry();old.dismiss();await settle();assert.equal(f.calls.length,count);assert.equal(f.host.current().failureMessage,'body unavailable');
 f.options.failAcquire=false;chain.render().retry();await settle();assert.ok(x.index.effects.some(e=>e.validated));
 assert.equal(f.calls.filter(([m])=>m==='acquire').length,2);assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('actual-Index-ReaderShell-retained-ReadingExperience-failure-lexical-scope-recovery');
}
for(const outcome of ['confirmed','platform-failure','Core-unknown']){
 const f=fixture({shared:true,open:false}),x=makeIndex(f);delete x.index.cleanupRetiredSourceCache;
 const native=f.runtime.request.bind(f.runtime),cleanup=[];
 f.runtime.request=async(method,params,options)=>{
  if(method!=='cache.clear')return native(method,params,options);
  cleanup.push(['Core',params]);if(outcome==='Core-unknown')throw Error('old cache ACK lost');
  return{data:{scope:'book',cacheEntriesRemoved:1,chapterEntriesRemoved:1,queueEntriesRemoved:0,removedContentBytes:2}};
 };
 f.runtime.clearOfflineBookImages=async(sourceId,bookId)=>{cleanup.push(['images',sourceId,bookId]);if(outcome==='platform-failure')throw Error('old cache images unavailable');};
 x.index.openDetailSourceSwitch();await settle();x.mount().onSelectCandidate(f.candidate());await settle();
 const tx=f.host.current().pending.transactionId;f.setPhase('finalized');
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(f.host.current().pending,undefined,'resource cleanup cannot undo actual source finalization');
 assert.deepEqual(cleanup[0],['Core',{scope:'book',sourceId:'old',bookId:'book'}]);
 const receipt=x.index.getReadingOfflineHost(f.runtime).snapshot();
 assert.equal(receipt.sourceId,'old');assert.equal(receipt.bookId,'book');
 assert.equal(receipt.projection.receipt.confirmation,outcome==='Core-unknown'?'unknown':'confirmed');
 assert.equal(receipt.materialization,outcome==='confirmed'?'succeeded':'failed');
 assert.equal(cleanup.length,outcome==='Core-unknown'?1:2);
 x.index.applyReadingCommit({...target,chapterIndex:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(cleanup.length,outcome==='Core-unknown'?1:2,'repeated canonical notification cannot repeat old-source cleanup');
 checks.push('actual-Index-OffineHost-Gateway-retired-source-'+outcome);
}
// The retained reading identity includes readyGeneration, while only the small
// temporary source overlay is keyed by the source owner scope.
{
 const f=fixture({shared:true,open:false}),x=makeIndex(f,{reading:true});x.index.openSourceSwitch();await settle();
 const s=x.p.consumer(read('features/shell/ReaderShell.ets'),['sourceSwitchScopeId','sourceSwitchOverlayContent'],x.leafDeps,{sourceSwitchScopeId:x.index.sourceSwitchScopeId});
 Object.assign(s,{sourceId:'old',sourceSwitchState:x.index.sourceSwitchState,onCloseSourceSwitch:id=>x.index.closeSourceSwitch(id),
   onRetrySourceSwitch:id=>x.index.retrySourceSwitch(id),onRefreshSourceSwitch:id=>x.index.refreshSourceSwitch(id),
   onPickSource:(c,id)=>x.index.onPickSource(c,id),onRollbackSourceSwitch:id=>x.index.onRollbackSourceSwitch(id)});
 s.sourceSwitchOverlayContent();const old=x.p.walk(s).find(c=>c instanceof x.leafDeps.SourceSwitchPanel);old.onClose();
 x.index.openSourceSwitch();await settle();s.sourceSwitchScopeId=x.index.sourceSwitchScopeId;s.sourceSwitchState=x.index.sourceSwitchState;
 s.sourceSwitchOverlayContent();old.onClose();old.onSelectCandidate(f.candidate());await settle();assert.equal(f.host.current().visible,true);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('actual-ReaderShell-overlay-oldscope-preserved-without-reader-tree-remount');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual Host/Gateway/full durable intent + unmodified Index delegates/seam + decorated SDK Window/CandidateRow/bounded frame; controlled runtime/native file boundary. Native layout/removal/focus/device remain separate.'}));
