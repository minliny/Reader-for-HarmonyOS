// Explicit ordinary-method regression after the full R22 review RELEASE.
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';

const selected=selectContractCases({
  'cached-adjacent-admission':'Actual cached catalog and Shell offline assembly reach one Surface preparation; current online proof and accepted owner retirement stay enforced.',
});
if(!selected.length)process.exit(0);
const {selectedProductionMethods,selectedProductionComponentCallback}=await import('./lib/selected-production-methods.mjs');
// This existing adapter supplies actual gateway/Runtime classes and finite
// transport seams. Importing it runs no business assertions or device action.
await import('./lib/reading-entry-owner-probe.mjs');
const {RemoteReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/application/RemoteReadingFlowGateway.ts');
const root=new URL('../entry/src/main/ets/',import.meta.url);
const surfaceFile=new URL('features/manga/ui/MangaReadingSurface.ets',root);
const shellFile=new URL('features/reading/ui/ReaderShell.ets',root);
const source=readFileSync(surfaceFile,'utf8');
const methods=['readerPanelForeground','adjacentChapter','turnBoundaryChapter',
  'selectAdjacentChapter','performPanelAction','closePanel','dismissPanelKeyboard','effectiveFit'];
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};

async function cachedSession(contextIsCurrent=false){
  const requests=[];
  const runtime={async request(method,params){
    requests.push({method,params});assert.equal(method,'cache.book.status');
    return{data:{sourceId:'source',bookId:'book',tocAvailable:true,sourceVersion:'source-v1',
      catalogVersion:'catalog-v1',contextVersion:'context-v1',continuationVariables:{},
      chapters:[0,1,2].map(chapterIndex=>({chapterIndex,title:`Chapter ${chapterIndex}`,
        url:`chapter-${chapterIndex}`,level:1,navigable:true,proofState:'verified',variables:{}}))}};
  }};
  const gateway=new RemoteReadingFlowGateway(runtime);
  const session=await gateway.openCachedCatalogSession({sourceId:'source',bookId:'book',detailUrl:'book',
    title:'Manga',author:'Author',sourceVersion:'source-v1',contentKind:'manga'},()=>true,contextIsCurrent,true);
  assert.equal(requests.length,1);assert.equal(session.contentKind,'manga');
  assert.equal(session.acquisitionMode,contextIsCurrent?'online':'offline');
  assert.equal(session.requiresContextRefresh,!contextIsCurrent);
  return session;
}

function surface(Type,session){
  const saving=deferred(),preparing=deferred(),calls={saves:[],prepares:[],cancels:0,focus:[]};
  const chapter={chapterIndex:1,chapterTitle:'Chapter 1',manifest:{chapter:{sourceId:'source',bookId:'book',chapterId:'chapter-1'},
    manifestVersion:'manifest-1',sourceRuleVersion:'source-v1',decodeRevision:'identity-v1',pages:[{ordinal:0,pageId:'page-1'}]}};
  const origin={chapter,totalPages:1,savedLocation:null,
    async savePosition(...args){calls.saves.push(args);await saving.promise;},pageAt:()=>chapter.manifest.pages[0]};
  const owner=Object.assign(new Type(),{
    mounted:true,opened:true,appForeground:true,windowChromeActive:true,windowChromeOverlayActive:false,
    interactionBlocked:false,exiting:false,isReaderIdentityCurrent:()=>true,inputCurrent:()=>true,
    sourceId:'source',bookId:'book',runtime:{},remoteSession:session,controller:origin,
    viewportWidth:390,viewportHeight:844,boundaryGeneration:0,boundaryBusy:false,boundaryDragging:false,
    boundaryInputRevision:0,pageTurnInputRevision:0,rollbackChapterController:undefined,
    confirmedPosition:{controller:origin,manifest:chapter.manifest,anchor:{ordinal:0,x:.2,y:.4}},
    panel:'',panelPhase:'closed',panelGeneration:0,panelActionGeneration:0,panelFocusGeneration:0,
    panelReturnFocusTarget:'',reduceMotion:true,chapterEnd:false,
    chapterTransitions:{pending:false,async prepare(request){calls.prepares.push(request);return preparing.promise;},
      async cancel(){calls.cancels++;}},
    flushViewportObservation(){},saveVisible:async()=>true,requestPanelFocus:(...args)=>calls.focus.push(args),
    clearBoundaryFrameWait(){},
    getUIContext:()=>({getFocusController:()=>({clearFocus(){}})}),onSaveFailure:()=>assert.fail('save port did not fail'),
  });
  owner.offline=selectedProductionComponentCallback(shellFile,'MangaReadingSurface','offline',owner,
    {ReaderRuntimeOwner:{current:()=>({mangaOfflineProbeFor:()=>false})}});
  return{owner,origin,calls,saving,preparing};
}

async function verify(file=surfaceFile){
  const Type=selectedProductionMethods(file,'MangaReadingSurface',methods,{
    inputMethod:{getController:()=>({hideTextInput:async()=>{}})},hilog:{warn(){}},
  });
  const offline=await cachedSession(),online=await cachedSession(true),receipts=[];
  for(const entrance of ['pull-next','directory-next','directory-previous','chapter-end']){
    const f=surface(Type,offline);assert.equal(f.owner.offline,true,'normal Shell keeps cached preparation offline');
    if(entrance.startsWith('directory')){f.owner.panel='directory';f.owner.panelPhase='open';}
    if(entrance==='chapter-end')f.owner.chapterEnd=true;
    const run=entrance==='pull-next'?
      selectedProductionComponentCallback(surfaceFile,'PullToRefresh','onLoadMore',f.owner)():
      f.owner.selectAdjacentChapter(entrance==='directory-previous'?-1:1,entrance.startsWith('directory'));
    await tick();assert.deepEqual(f.calls.saves,[[0,.2,.4]],'original position is saved before neighbor preparation');
    assert.equal(f.calls.prepares.length,0,'preparation waits for original save');
    f.saving.resolve();await tick();
    assert.equal(f.calls.prepares.length,1,'normal cached context reaches one neighbor preparation');
    const request=f.calls.prepares[0];assert.equal(request.offline,true);
    assert.equal(request.currentController,f.origin);assert.equal(request.chapterIndex,entrance==='directory-previous'?0:2);
    assert.equal(request.chapterUrl,`chapter-${request.chapterIndex}`);assert.equal(request.isCurrent(),true);
    // End at the finite preparation I/O boundary. This case does not claim
    // decode, image materialization, CAS persistence or a native painted frame.
    f.owner.mounted=false;f.preparing.reject(new Error('MANGA_SESSION_CANCELLED'));await run;
    assert.equal(f.owner.controller,f.origin);assert.equal(f.calls.cancels,1);
    receipts.push(entrance);
  }
  {
    const f=surface(Type,online);const run=f.owner.turnBoundaryChapter(1);await tick();
    f.saving.resolve();await tick();assert.equal(f.calls.prepares.length,1,'current online contract still enters preparation');
    assert.equal(f.calls.prepares[0].offline,false);f.owner.mounted=false;f.preparing.reject(new Error('MANGA_SESSION_CANCELLED'));await run;
  }
  {
    const f=surface(Type,{...online,requiresContextRefresh:true});await f.owner.turnBoundaryChapter(1);
    assert.equal(f.calls.saves.length,0);assert.equal(f.calls.prepares.length,0,'unverified online catalog still rejects');
  }
  for(const retire of [
    owner=>{owner.mounted=false;},owner=>{owner.boundaryGeneration++;},
    owner=>{owner.viewportWidth++;},owner=>{owner.windowChromeOverlayActive=true;},
    owner=>{owner.isReaderIdentityCurrent=()=>false;},
    owner=>{owner.remoteSession={...owner.remoteSession,sourceVersion:'replacement-source'};},
    owner=>{owner.remoteSession={...owner.remoteSession,acquisitionMode:'online',requiresContextRefresh:true};},
  ]){
    const f=surface(Type,offline);const run=f.owner.turnBoundaryChapter(1);await tick();
    retire(f.owner);f.saving.resolve();await run;
    assert.equal(f.calls.prepares.length,0,'retired accepted save cannot start neighbor preparation');
  }
  return receipts;
}

for(const id of selected){
  const receipts=await verify();
  const prior=source.replace("(this.remoteSession?.requiresContextRefresh !== true || this.remoteSession?.acquisitionMode === 'offline')",
    'this.remoteSession?.requiresContextRefresh !== true');
  assert.notEqual(prior,source,'negative restores only the original accepted-current predicate');
  const temporary=mkdtempSync(join(tmpdir(),'reader-offline-adjacent-negative-'));
  try{
    const path=join(temporary,'MangaReadingSurface.ets');writeFileSync(path,prior);
    await assert.rejects(()=>verify(pathToFileURL(path)),/normal cached context reaches one neighbor preparation/);
  }finally{rmSync(temporary,{recursive:true,force:true});}
  console.log(JSON.stringify({kind:'ui-review-offline-manga-adjacent',case:id,receipts,
    layer:'actual cached gateway, Shell assembly expressions and Surface methods; finite controller/progress/preparation/focus ports; no native or full materialization proof'}));
  recordContractCasePass(id);
}
