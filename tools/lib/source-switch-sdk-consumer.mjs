import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './bounded-surface-sdk-probe.mjs';
import {fixture,settle as settleOwner,deferred,origin,target,session,Runtime,read,gatewayExports,setCurrentRuntime} from './source-switch-owner-probe.mjs';
const {ProductionHost:ReadingEntryHost,setRuntime:setEntryRuntime}=await import('./reading-entry-owner-probe.mjs');
const evidence=await import('../../entry/src/main/ets/features/reading/RemoteReadingEvidence.ts');
import * as horizontal from '../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
const {ReaderNativeAlertOwner}=await import('../../entry/src/main/ets/app/ReaderNativeAlertOwner.ts');
const {ReadingOfflineHost}=await import('./reader-reading-owner-sdk-probe.mjs');
const settle=async()=>{await settleOwner();await new Promise(setImmediate);await settleOwner();};
const methods=['getSourceSwitchHost','sourceSwitchContext','sourceSwitchLease','applySourceSwitchSnapshot','retireRssPresentation','retireSourceSwitchPresentation',
 'bindSourceSwitchReader','applySourceSwitchEffect','openSourceSwitch','openDetailSourceSwitch','retrySourceSwitch','refreshSourceSwitch',
 'sourceSwitchProbeQuery','knownSearchSourceCandidates','onPickSource','retryFailedSourceSwitch','dismissSourceSwitchFailure','onRollbackSourceSwitch',
 'closeSourceSwitch','performSourceSwitchSeam','resolveReaderSourceSwitchTransaction','reconcilePendingSourceSwitches','currentSourceSwitchTransactionId',
 'nextNavigationGeneration','isCurrentRuntime','openReading','onRemoteSessionReady','installRemoteReadingSession',
 'getReadingEntryHost','readingEntryLease','applyReadingEntrySnapshot','bindReadingEntryReader','retireReadingEntryPresentation',
 'detailReadableAdmission','detailBookKey','chooseCachedChapterRefresh','showReadingFailure','showIndexAlert',
 'applyReadingCommit','getReadingOfflineHost','cleanupRetiredSourceCache','sourceSwitchOverlayContent'];
export const sourceSwitchMethods=methods.filter(n=>n!=='sourceSwitchOverlayContent');
const states=['sourceSwitchVisible','sourceSwitchState','sourceSwitchFailureMessage','sourceSwitchScopeId'];
export function makeIndex(f,{navigation=1,reading=false}={}){
 setEntryRuntime(f.runtime);
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
   SourceSwitchHost:f.Constructor,ReadingEntryHost,EMPTY_READABLE_ADMISSION:{key:'',generation:0,adding:false,cancelling:false,confirmation:'none'},ReadingOfflineHost,LOCAL_SOURCE_ID:'local',DOMAIN:0,hilog:{info(){},warn(){}},ReaderNativeAlertOwner},{sourceSwitchScopeId:0});
 Object.assign(index,{mountedRuntimeOwner:f.runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:1,navigationGeneration:navigation,
   route:reading?'reading':'detail',readingOriginRoute:'detail',detailReturnRoute:'bookshelf',readingSessionActive:reading,detailBook:{...origin,sourceName:'Old'},
   shelfBooks:[origin],detailToc:[{index:0,title:'Chapter 1',navigable:true}],detailInBookshelf:f.context.inBookshelf,
   sourceSwitchHost:undefined,readingEntryScopeId:-1,readableAdmissions:[],shelfOperation:{generation:0,busy:false,removalKey:''},searchDetailCandidates:[],searchHost:{searchedSourceIds:()=>[]},
   remoteSessionGeneration:0,remoteContentProbeGeneration:0,remoteReadableChapterIndexes:[],remoteReadableChapterOrder:new Map(),
   directoryCurrentChapterIndex:0,requestedChapterIndex:0,readingReadyGeneration:1,bookshelfCatalogEpoch:0,bookshelfBackgroundEpoch:0,
   nativeAlertOwner:new ReaderNativeAlertOwner(),effects:[],cleanup:[],refreshBookshelf(){this.effects.push('refreshShelf');},
   readingDetailForShelf:book=>({...book,sourceName:book.sourceId}),consumeSystemFileOpen(){this.effects.push('consumeWant');},
   cleanupRetiredSourceCache(tx){this.cleanup.push(tx);},prefetchReadingWindow:async()=>{},isRemoteCatalogNearEnd:()=>false,
   openRemoteBookDetail(seed,name,_shelf,resume,_candidates,_names,parent,validated){this.effects.push({seed,name,resume,parent,validated});},
   reopenSwitchedBook(book){this.effects.push({reopen:book});},returnToReadingOrigin(){this.route=this.readingOriginRoute;},
   isKnownDetailChapter:n=>index.detailToc.some(e=>e.index===n)});
 const acquire=f.runtime.bookAcquisitions;f.runtime.bookAcquisitions=()=>({...acquire(),readingProjectionRevision:()=>0,setPreparationVisible(){}});
 const mount=()=>{index.sourceSwitchOverlayContent();return p.walk(index).filter(x=>x instanceof leafDeps.SourceSwitchPanel).at(-1);};
 const rows=()=>p.walk(index).filter(x=>x instanceof leafDeps.CandidateRow);
 return{p,index,mount,rows,leafDeps};
}
export function failureChain(x){
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
