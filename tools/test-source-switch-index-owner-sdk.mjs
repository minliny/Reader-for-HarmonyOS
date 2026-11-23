import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
if (id === 'presentation-workflow') {
  const { verifySourceSwitchWorkflow } = await import('./lib/source-switch-workflow-probe.mjs');
  return verifySourceSwitchWorkflow();
}
const {resolveEtsLoaderRoot,virtualFilePath}=await import('./lib/tool-environment.mjs');const {makeSourceSwitchFixture,failureChain,sourceSwitchLiveSdk,sourceSwitchRecoveryAction}=await import('./lib/source-switch-sdk-consumer.mjs');
const {createRequire}=await import('node:module');const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
const {fixture:productionFixture,settle:settleOwner,deferred,origin,target,session,rawCandidate,Runtime,read,gatewayExports,setCurrentRuntime,Core}=await import('./lib/source-switch-owner-probe.mjs');const owned=[];const fixture=(...a)=>{const f=productionFixture(...a);owned.push(f.host);return f;};
const {sourceSwitchProbeQuery}=await import('./lib/source-switch-presentation-probe.mjs');
const {setRuntime:setEntryRuntime}=await import('./lib/reading-entry-owner-probe.mjs');const metricsApi=await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
let actualCacheAuthorityFixture,cleanupDurableFixtures;
const ownerActors=[];
function makeOwners(f,options={}){
 assert.equal(typeof f.Constructor?.forRuntime,'function','explicit current SourceSwitchHost authority');
 if(options.cacheAuthority)assert.equal(typeof options.cacheAuthority.types.CacheClearOperationIntentStore,'function','explicit cleanup sandbox authority');
 const result=makeSourceSwitchFixture(f,options);
 for(const previous of ownerActors){assert.notEqual(result.entry,previous.entry);assert.notEqual(result.source,previous.source);
  assert.notEqual(result.manga,previous.manga);assert.notEqual(result.surface.nodes,previous.surface.nodes);}
 ownerActors.push(result);return result;
}
const settle=async()=>{await settleOwner();await new Promise(setImmediate);await settleOwner();};
async function waitForRetiredSourceCleanup(host,identity,previousGeneration,outcome){
 // Cold Core process/atomic-file IO is asynchronous work. An event-loop turn
 // count expires before the OS can return its first exact receipt on a fast CPU.
 const deadline=Date.now()+15000;
 while(Date.now()<deadline){
  const operation=host.snapshot();
  if(operation?.action==='clear'&&operation.sourceId===identity.sourceId&&operation.bookId===identity.bookId&&
   operation.generation>previousGeneration&&['succeeded','failed','retired'].includes(operation.materialization)&&!host.busy())return operation;
  await new Promise(resolve=>setTimeout(resolve,5));
 }
 const operation=host.snapshot();
 const observed={action:operation?.action,generation:operation?.generation,materialization:operation?.materialization,
  confirmation:operation?.projection.receipt.confirmation,busy:host.busy(),
  exactIdentity:operation?.sourceId===identity.sourceId&&operation?.bookId===identity.bookId};
 assert.fail('exact retired cache cleanup did not settle: '+outcome+' '+JSON.stringify(observed));
}
async function visualContract(){const {readFileSync}=await import('node:fs');return{numbers:JSON.parse(readFileSync(new URL('../../Reader-UI/design/source-switch/source-switch.visual.json',import.meta.url),'utf8')).numbers,colors:JSON.parse(readFileSync(new URL('../../Reader-UI/theme/registry.json',import.meta.url),'utf8')).appRoles.TOK_SS_DRAWER_SCRIM};}
const checks=[];let passed=false;

try{
async function mangaCase(mode){

 const proof={schemaVersion:1,sourceVersion:'v1',field:'detail',raw:'@Writer',label:'Writer',rule:'author-nickname-at-v1'};
 const targetSession={...session,contentKind:'manga',detailUrl:'target',hostRequirements:[],
  book:{title:'Book',author:mode==='wrong-target-author'?'Other':'Writer'},
  entries:[{index:0,title:'Chapter 1',url:'/target/0',variables:[],navigable:true}]};
 const f=fixture({shared:true,open:false,preview:true,targetSession}),base=f.runtime.request.bind(f.runtime);
 let revision=1,click=false,blocked=false,work,resolvedQuery;const gate=deferred(),entered=deferred(),images=[],released=[],assertQueries=[];
 const acquisitions=f.runtime.bookAcquisitions;
 f.runtime.bookAcquisitions=()=>({...acquisitions(),sourceRegistryRevision:()=>revision});
 f.runtime.supportsCoreCapability=()=>true;
 f.runtime.request=async(method,params,options)=>{
  if(method==='source.list')return{data:{sources:['old','new'].map(sourceId=>({sourceId,name:sourceId,enabled:true,
   sourceVersion:click&&mode==='target-version'&&sourceId==='new'?'v2':'v1',bookSource:{bookSourceType:2}}))}};
  if(method==='search-book.get'){
   assert.deepEqual(params,{origin:'old',bookUrl:'book'});
   if(click&&!blocked&&['registry-during-proof','cancel-resolve','cancel-reject'].includes(mode)){
    blocked=true;entered.resolve();await gate.promise;
   }
   const invalid=click;
   return{data:{book:{origin:'old',bookUrl:invalid&&mode==='wrong-book'?'other':'book',name:'Book',
    author:invalid&&mode==='wrong-author'?'@Other':'@Writer',acquisition:{sourceVersion:invalid&&mode==='stale-proof'?'v0':'v1',
     authorIdentity:invalid&&mode==='stale-proof'?{...proof,sourceVersion:'v0'}:proof}}}};
  }
  if(method==='manga.chapter.get'){
   const pageId='mp1:'+'a'.repeat(64),resourceRef='manga:'+pageId;
   return{data:{manifest:{chapter:{sourceId:'new',bookId:'target',chapterId:'/target/0'},manifestVersion:'m1',
    sourceRuleVersion:'v1',decodeRevision:'identity-v1',pages:[{ordinal:0,pageId,resourceRef}]},chapterIndex:0,
    chapterTitle:'Chapter 1',cached:false,resources:[{resourceRef,request:{url:'https://image.test/first'}}]}};
  }
  return base(method,params,options);
 };
 f.runtime.loadReadingImage=async()=>{images.push('first');if(mode==='registry-during-image')revision++;
  return{fileUri:'file://first',width:600,height:800,revision:'pixels'};};
 f.runtime.releaseReadingImage=uri=>released.push(uri);
 f.setRows([{...rawCandidate,acquisition:{sourceVersion:'v1',contentKind:'manga'}}]);
 const x=makeOwners(f);
 Object.assign(x.entry,{book:{...origin,sourceName:'Old',contentKind:'manga',author:'@Writer'},
  contentKind:'manga',session:undefined,seed:undefined,
  mangaChapterRequestGeneration:0});
 x.switchJourney.openDetail();await settle();
 assert.equal(x.source.state.kind,'candidates',mode+' first paint');
 assert.deepEqual(f.host.context.query.authorIdentity,proof,'cold exact proof admits the displayed manga row');
 assert.equal(sourceSwitchProbeQuery(x.entry).authorIdentity,undefined,'Index retains its raw display projection');
 const gateway=f.host.mangaPreparationGateway(),resolve=gateway.resolveProbeQueryIdentity.bind(gateway),check=gateway.assertAcquiredBook.bind(gateway);
 gateway.resolveProbeQueryIdentity=async(...args)=>{const query=await resolve(...args);if(args[2])resolvedQuery=query;return query;};
 gateway.assertAcquiredBook=(candidate,selected,query)=>{assertQueries.push(query);return check(candidate,selected,query);};
 const start=x.manga.switchMangaSource.bind(x.manga);x.manga.switchMangaSource=(...args)=>work=start(...args);
 const panel=x.mount(),row=x.rows().find(value=>value.candidate.sourceId==='new');assert.ok(row,mode);
 click=true;if(mode==='target-version')revision++;
 row.onSelect();assert.equal(x.source.state.kind,'switching','click responds before qualification IO');assert.ok(work);
 if(['registry-during-proof','cancel-resolve','cancel-reject'].includes(mode)){
  await entered.promise;
  if(mode==='registry-during-proof')revision++;
  else{
   panel.onClose();assert.equal(x.source.visible,false);
   x.switchJourney.openDetail();await settle();assert.equal(x.source.visible,true);
   const scope=x.source.scopeId;
   if(mode==='cancel-reject')gate.reject(Error('late proof IO error'));else gate.resolve();
   await work;await settle();assert.equal(x.source.scopeId,scope);
   assert.equal(x.source.visible,true);assert.equal(x.source.state.kind,'candidates');
   assert.equal(f.calls.filter(([method])=>method==='acquire').length,0);
   x.mount().onClose();checks.push('actual-cold-manga-SDK-'+mode);return;
  }
  gate.resolve();
 }
 await work;await settle();
 const opens=x.entry.session===targetSession?[x.entry.session]:[];
 if(mode==='valid'){
  assert.equal(opens.length,1,JSON.stringify({failure:x.source.failureMessage,state:x.source.state,privateFailure:f.host.lastFailure?.stack,calls:f.calls.map(c=>c[0])}));assert.equal(opens[0],targetSession);
  assert.deepEqual(resolvedQuery.authorIdentity,proof);assert.equal(assertQueries.length,1);
  assert.equal(assertQueries[0],resolvedQuery,'final target verification uses the same qualified query after Host retirement');
  assert.equal(f.calls.filter(([method])=>method==='acquire').length,1);assert.equal(images.length,1);assert.equal(released.length,1);
 }else{
  assert.equal(opens.length,0);assert.equal(x.source.state.kind==='switching',false,'qualification failure is recoverable');
  const message=x.source.state.refreshError??x.source.failureMessage;
  assert.ok(message.length>0,mode);
  assert.equal(f.calls.filter(([method])=>method==='acquire').length,['wrong-target-author','registry-during-image'].includes(mode)?1:0);
  if(mode==='registry-during-image'){assert.equal(released.length,1);assert.match(message,/书源配置已变更/);}
  const failedScope=x.source.scopeId;
  assert.equal(f.host.current().visible,false,'preparation retired discovery');
  panel.onRefresh();await settle();
  assert.equal(f.host.current().visible,true,'actual retry button binds a live owner');
  assert.notEqual(x.source.scopeId,failedScope);
  const refreshedScope=x.source.scopeId;
  x.sourceActions.refresh(failedScope);await settle();assert.equal(x.source.scopeId,refreshedScope,'old button cannot reopen newer scope');
 }
 assert.equal(x.entry.book.author,mode==='valid'?'Writer':'@Writer','proof rejection preserves the original detail; admitted preview projects the actual target metadata');
 assert.equal(f.calls.some(([method])=>['manga.sourceSwitch.commit','reading.progress.update','bookshelf.add'].includes(method)),false);
 checks.push('actual-cold-manga-SDK-'+mode);
}
if(id==='manga-valid')await mangaCase('valid');
if(id==='manga-stale-proof')await mangaCase('stale-proof');
if(id==='manga-wrong-book')await mangaCase('wrong-book');
if(id==='manga-wrong-author')await mangaCase('wrong-author');
if(id==='manga-target-version')await mangaCase('target-version');
if(id==='manga-registry-during-proof')await mangaCase('registry-during-proof');
if(id==='manga-wrong-target-author')await mangaCase('wrong-target-author');
if(id==='manga-registry-during-image')await mangaCase('registry-during-image');
if(id==='manga-cancel-resolve')await mangaCase('cancel-resolve');
if(id==='manga-cancel-reject')await mangaCase('cancel-reject');
if(id==='preview-cancel'){
for(const late of ['resolve','reject']){
 const gate=deferred(),f=fixture({open:false,shared:true,preview:true,acquireGate:gate}),x=makeOwners(f);
 x.switchJourney.openDetail();await settle();const panel=x.mount(),row=x.rows().find(value=>value.candidate.sourceId==='new');
 row.onSelect();await settle();assert.ok(f.calls.some(([method])=>method==='acquire'));
 const preparing=x.mount();assert.equal(preparing.allowCancelWhileSwitching,true,'actual novel preview control admits cancellation after qualification');
 const previous=x.source.scopeId;preparing.onClose();assert.equal(x.source.visible,false);
 x.switchJourney.openDetail();await settle();const next=x.source.scopeId;assert.notEqual(next,previous);
 if(late==='resolve')gate.resolve();else gate.reject(Error('old preview failed'));await settle();
 assert.equal(x.source.visible,true);assert.equal(x.source.scopeId,next);assert.equal(x.source.state.kind,'candidates');
 assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
 checks.push('actual-SDK-preview-preparation-close-reopen-before-late-'+late);
}
}
if(id==='seed-author-proof'){
{
 const proof={schemaVersion:1,sourceVersion:'v1',field:'detail',raw:'@Writer',label:'Writer',rule:'author-nickname-at-v1'};
 const seed={sourceId:'old',bookId:'book',title:'Book',author:'@Writer',authorIdentity:proof,sourceVersion:'v1'};
 const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
 const {actualReadingEntryPresentation}=await import('./lib/reading-entry-presentation-probe.mjs');
 const Entry=actualReadingEntryPresentation();
 const EntryHost = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/application/ReadingEntryHost.ts', import.meta.url),
  ['detail']);
 const create=entries=>{
  const entry=new Entry();
  entry.book={...origin,sourceName:'Old',author:'@Writer'};
  entry.toc=entries;
  return {entry};
 };
 for(const entries of [[],[{index:325,title:'Chapter 325'}]]){
  const x=create(entries);x.entry.seed=seed;
  const query=sourceSwitchProbeQuery(x.entry);
  assert.deepEqual(query.authorIdentity,proof);assert.equal(query.sourceVersion,'v1');
  assert.equal(query.currentChapterIndex,entries.length===0?0:325);
  assert.equal(query.author,'@Writer','the display/raw field remains unchanged');
 }
 for(const [name,selected] of [
  ['other source',{...seed,sourceId:'other'}],['other book',{...seed,bookId:'other'}],
  ['raw mismatch',{...seed,author:'@Other',authorIdentity:{...proof,raw:'@Other',label:'Other'}}],
  ['proof version mismatch',{...seed,authorIdentity:{...proof,sourceVersion:'v0'}}],
  ['unsupported proof',{...seed,authorIdentity:{...proof,rule:'untrusted'}}],
 ]){
  const x=create([]);x.entry.seed=selected;
  assert.equal(sourceSwitchProbeQuery(x.entry).authorIdentity,undefined,name);
 }
 {
  const x=create([]);x.entry.seed=seed;
  x.entry.session={identity:{sourceId:'other',bookId:'book'},sourceVersion:'v2',
   book:{authorIdentity:{...proof,sourceVersion:'v2'}}};
  assert.equal(sourceSwitchProbeQuery(x.entry).sourceVersion,'v1','another session never overrides the exact seed');
 }
 {
  const x=create([]);x.entry.seed={...seed,authorIdentity:{...proof,sourceVersion:'v0'}};
  x.entry.book={...x.entry.book,authorIdentity:proof,sourceVersion:'v1'};
  assert.deepEqual(sourceSwitchProbeQuery(x.entry).authorIdentity,proof,'exact detail supplies the fallback proof');
  x.entry.contentKind='text';
  const projection=new EntryHost().detail(seed,'Old');
  assert.deepEqual(projection.authorIdentity,proof);assert.equal(projection.sourceVersion,'v1');
  assert.equal(projection.sourceId,'old');assert.equal(projection.bookId,'book');
  x.entry.seed=undefined;x.entry.book=projection;
  assert.deepEqual(sourceSwitchProbeQuery(x.entry).authorIdentity,proof,'projected detail survives session/seed retirement');
 }
 checks.push('actual-Index-exact-seed-and-detail-author-proof-without-session-raw-version-and-identity-rejection');
}
}
if(id==='qualification-cancel'){
for(const outcome of ['resolve','reject']){
 const f=fixture({shared:true,open:false}),x=makeOwners(f),gate=deferred(),base=f.runtime.request.bind(f.runtime);
 const acquisitions=f.runtime.bookAcquisitions;let revision=1,blockNextRegistry=false,started=false;
 f.runtime.bookAcquisitions=()=>({...acquisitions(),sourceRegistryRevision:()=>revision});
 f.runtime.request=async(method,params,options)=>{
  if(method==='source.list'&&blockNextRegistry){
   blockNextRegistry=false;started=true;await gate.promise;
   return{data:{sources:[{sourceId:'old',name:'Old',enabled:true,sourceVersion:'v1'},
    {sourceId:'new',name:'New',enabled:true,sourceVersion:'v1'}]}};
  }
  return base(method,params,options);
 };
 x.switchJourney.openDetail();await settle();const panel=x.mount(),scope=x.source.scopeId;
 revision=2;blockNextRegistry=true;x.rows().find(row=>row.candidate.sourceId==='new').onSelect();await settle();
 assert.equal(started,true);assert.equal(x.source.state.kind,'switching');
 panel.onClose();assert.equal(x.source.visible,false,'actual SDK close cancels read-only qualification');
 x.switchJourney.openDetail();await settle();assert.equal(x.source.visible,true);
 const successor=x.source.scopeId;assert.notEqual(successor,scope);
 assert.equal(x.source.state.kind,'candidates');
 if(outcome==='resolve')gate.resolve();else gate.reject(Error('old qualification failed'));
 await settle();assert.equal(x.source.visible,true);assert.equal(x.source.scopeId,successor);
 assert.equal(x.source.state.kind,'candidates');assert.equal(x.entry.book.sourceId,'old');
 assert.equal(f.calls.some(([method])=>method==='acquire'||method==='source.switch.commit'),false);
 x.mount().onClose();checks.push('actual-SDK-close-pending-qualification-reopen-before-late-'+outcome);
}
}
if(id==='source-finalization'){
{
 const f=fixture({shared:true,open:false}),x=makeOwners(f);x.switchJourney.openDetail();await settle();
 assert.equal(x.source.state.kind,'candidates');assert.equal(x.source.scopeId,f.host.current().scopeId);
 const panel=x.mount(),row=x.rows().find(r=>r.candidate.sourceId==='new');assert.ok(row);
 const selectedName=row.candidate.sourceName;
 const originalFrame=[...panel.nodes.values()].find(n=>n.type==='Stack'&&n.width==='100%'&&n.height==='100%');
 assert.ok(originalFrame,'the actual picker follows the confirmed full-viewport layout');
 row.onSelect();await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
 assert.equal(x.entry.book.sourceId,'new');assert.equal(x.navigation.snapshot().route,'reading');assert.equal(x.entry.requestedChapterIndex,0);
 assert.equal(x.entry.session.identity.sourceId,'new');assert.equal(x.source.currentTransaction(x.entry.book),f.host.current().pending.transactionId);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,1);
 assert.equal(f.calls.filter(([m])=>m==='acquire').length,1);
 const tx=f.host.current().pending.transactionId;
 for(const bad of [undefined,'old-transaction']){
  x.commits.accept({...target,chapterIndex:0,chapterOffset:0,sourceSwitchTransactionId:bad});
  assert.equal(f.host.current().pending.transactionId,tx);assert.equal(x.cleanup.length,0);
 }
 x.commits.accept({...origin,chapterIndex:0,chapterOffset:0,sourceSwitchTransactionId:tx});assert.equal(f.host.current().pending.transactionId,tx);
 f.setPhase('finalized');x.commits.accept({...target,chapterIndex:0,chapterOffset:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(f.host.current().pending,undefined);assert.equal(x.cleanup.length,1);assert.deepEqual(x.cleanup[0],{sourceId:'old',bookId:'book'});
 assert.equal(x.source.namedCandidate.sourceId,'new');
 assert.equal(x.commits.completion.sourceName,selectedName,'actual selected source metadata must supply the novel completion name');
 x.commits.accept({...target,chapterIndex:0,chapterOffset:0,sourceSwitchTransactionId:tx});assert.equal(x.cleanup.length,1);
 checks.push('actual-Index-Host-Gateway-SDK-candidate-reader-seam-and-exact-finalization');
}
}
if(id==='old-overlay'){
{
 const f=fixture({shared:true,open:false}),x=makeOwners(f);x.switchJourney.openDetail();await settle();const old=x.mount(),scope=x.source.scopeId;
 old.onClose();assert.equal(f.host.current().visible,false);x.switchJourney.openDetail();await settle();const current=x.mount();
 assert.notEqual(x.source.scopeId,scope);old.onClose();old.onRetry();old.onRefresh();old.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.current().visible,true);assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 current.onClose();assert.equal(f.host.current().visible,false);
 checks.push('actual-SDK-detail-overlay-reopen-old-physical-actions-rejected');
}
}
if(id==='unknown-recovery'){
{
 const f=fixture({shared:true,open:false,loseCommitAck:true,failExactQuery:true}),x=makeOwners(f);
 x.switchJourney.openDetail();await settle();const panel=x.mount();panel.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(x.source.state.confirmation,'unknown');
 const rendered=x.mount();assert.ok(x.p.nodes(rendered).some(n=>n.create==='换源结果未确认'));
 const action=sourceSwitchRecoveryAction(x.p,rendered,'重试核对');
 panel.onClose();assert.equal(f.host.current().visible,true);
 f.options.failExactQuery=false;action.onClick();await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
 assert.equal(x.entry.book.sourceId,'new');assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,1);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.rollback').length,0);
 checks.push('actual-unknown-title-reads-exact-recovery-without-second-commit');
}
}
if(id==='late-navigation'){
{
 const gate=deferred(),f=fixture({shared:true,open:false,commitGate:gate}),x=makeOwners(f);
 x.switchJourney.openDetail();await settle();const panel=x.mount();panel.onSelectCandidate(f.candidate());await settle();
 assert.equal(f.host.consumeBack(x.source.scopeId),true);assert.equal(f.host.current().visible,true);
 x.actions.ports.advance();x.entry.book={sourceId:'other',bookId:'other'};gate.resolve();await settle();
 assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.targetSourceId,'new');
 assert.equal(x.entry.book.sourceId,'other');assert.equal(x.source.visible,false);
 checks.push('retired-navigation-keeps-accepted-ACK-without-late-reader-navigation');
}
}
if(id==='failed-preview'){
{
 const f=fixture({shared:true,open:false,preview:true,failAcquire:true}),x=makeOwners(f);
 x.switchJourney.openDetail();await settle();const old=x.mount();old.onSelectCandidate(f.candidate());await settle();
 assert.equal(x.navigation.snapshot().route,'reading');assert.equal(x.entry.sessionActive,true);assert.equal(x.source.failureMessage,'换源暂时未完成，请重试或选择其他书源。');
 const oldScope=old.scopeId;const scope=x.source.scopeId;
 assert.equal(f.host.current().scopeId,scope);const calls=f.calls.length;x.sourceActions.retryFailure(oldScope-1);assert.equal(f.calls.length,calls);
 f.options.failAcquire=false;x.sourceActions.retryFailure(scope);await settle();assert.ok(x.entry.session?.identity.sourceId==='new');
 checks.push('detail-acquisition-failure-mounts-reader-with-live-explicit-recovery-scope');
}
}
if(id==='remount'){
{
 const f=fixture({shared:true,open:false}),x=makeOwners(f);x.switchJourney.openDetail();await settle();
 const originalScope=x.source.scopeId;const old=x.mount();
 x.switchJourney.retire();const successor=makeOwners(f,{navigation:5});successor.switchJourney.openDetail();await settle();
 const scope=successor.source.scopeId;assert.notEqual(scope,originalScope);
 x.switchJourney.retire();assert.equal(f.host.current().visible,true,'old detach must not retire a successor presentation');
 old.onClose();assert.equal(f.host.current().visible,true);
 setCurrentRuntime(undefined);successor.controls.retired=true;successor.switchJourney.openReader();successor.sourceActions.select(f.candidate(),scope);await settle();
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('same-Runtime-successor-lease-old-detach-and-runtime-unavailable');
}
}
if(id==='retained-reader-failure'){
{
 const f=fixture({shared:true,open:false,preview:true,failAcquire:true}),x=makeOwners(f);
 x.switchJourney.openDetail();await settle();x.mount().onSelectCandidate(f.candidate());await settle();
 const chain=failureChain(x),old=chain.render(),oldScope=x.source.scopeId;
 x.actions.ports.advance();x.bindSource();assert.notEqual(x.source.scopeId,oldScope);
 chain.o.updateStateVars({sourceSwitchScopeId:x.source.scopeId,sourceSwitchFailureMessage:x.source.failureMessage});
 const count=f.calls.length;old.retry();old.dismiss();await settle();assert.equal(f.calls.length,count);assert.equal(f.host.current().failureMessage,'换源暂时未完成，请重试或选择其他书源。');
 f.options.failAcquire=false;chain.render().retry();await settle();assert.ok(x.entry.session?.identity.sourceId==='new');
 assert.equal(f.calls.filter(([m])=>m==='acquire').length,2);assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('actual-Index-ReaderShell-retained-ReadingExperience-failure-lexical-scope-recovery');
}
}
async function retiredCacheCase(outcome){
const {actualCacheAuthorityFixture:authority}=await import('./lib/reading-directory-sdk-consumer.mjs');actualCacheAuthorityFixture=authority;({cleanupDurableFixtures}=await import('./lib/reading-operation-durable-probe.mjs'));

 const f=fixture({shared:true,open:false}),cacheAuthority=await actualCacheAuthorityFixture(true),x=makeOwners(f,{cacheAuthority});console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...cacheAuthority.toolEvidence()}));
 // Real isolated sandbox IO and actual cold Core receipts replace the obsolete
 // bare cache.clear stub; SourceSwitch keeps its existing controlled RPC seam.
 f.runtime.getUIAbilityContext=()=>({filesDir:cacheAuthority.files});
 const native=f.runtime.request.bind(f.runtime),cleanup=[];
 const admission=outcome==='confirmed'?{entered:deferred(),gate:deferred()}:undefined;
 if(admission){cacheAuthority.options.pauseMethod='cache.clear.operation.query';cacheAuthority.options.gate=admission.gate;}
 if(outcome==='Core-unknown')cacheAuthority.options.beforeMethod='cache.clear';
 f.runtime.request=async(method,params,options)=>{
  if(!method.startsWith('cache.clear'))return native(method,params,options);
  if(method==='cache.clear')cleanup.push(['Core',params]);
  const request=cacheAuthority.runtime.request(method,params,options);
  if(method==='cache.clear.operation.query'&&Object.keys(params).length===0)admission?.entered.resolve();
  return request;
 };
 f.runtime.clearOfflineBookImages=async(sourceId,bookId)=>{cleanup.push(['images',sourceId,bookId]);if(outcome==='platform-failure')throw Error('old cache images unavailable');};
 x.switchJourney.openDetail();await settle();x.mount().onSelectCandidate(f.candidate());
 for(let turn=0;turn<2000&&x.entry.book.sourceId!=='new';turn++)await new Promise(setImmediate);
 assert.equal(x.entry.book.sourceId,'new','actual accepted source seam completes before visible reading commit');
 assert.equal(f.host.current().write.confirmation,'confirmed');
 const tx=f.host.current().pending.transactionId;f.setPhase('finalized');
 const offline=x.offline,previousGeneration=offline.snapshot()?.generation??0;
 x.commits.accept({...target,chapterIndex:0,sourceSwitchTransactionId:tx});
 let completed=false;
 const completion=waitForRetiredSourceCleanup(offline,origin,previousGeneration,outcome).then(receipt=>{completed=true;return receipt;});
 if(admission){
  try{
   await Promise.race([admission.entered.promise,completion]);
   assert.equal(offline.busy(),true,'actual cleanup owns its mutex before cold Core admission completes');
   assert.equal(offline.snapshot().materialization,'running');
   assert.equal(cleanup.length,0,'the actual head query precedes the durable cache.clear dispatch');
   await settle();
   assert.equal(completed,false,'a pending admission cannot satisfy the terminal cleanup wait');
  }finally{admission.gate.resolve();}
 }
 const receipt=await completion;
 assert.equal(f.host.current().pending,undefined,'resource cleanup cannot undo actual source finalization');
 assert.equal(cleanup[0][0],'Core');assert.equal(cleanup[0][1].scope,'book');assert.equal(cleanup[0][1].sourceId,'old');assert.equal(cleanup[0][1].bookId,'book');
 assert.match(cleanup[0][1].operationId,/\/1$/);assert.equal(cleanup[0][1].sequence,1,'actual mandatory authority supplies one exact bounded original identity');
 assert.equal(receipt.sourceId,'old');assert.equal(receipt.bookId,'book');
 assert.equal(receipt.projection.receipt.confirmation,outcome==='Core-unknown'?'unknown':'confirmed');
 assert.equal(receipt.materialization,outcome==='confirmed'?'succeeded':'failed');
 assert.equal(x.events.filter(event=>event?.kind==='directory.diagnostic'&&event.diagnostic==='sourceCleanup').length,outcome==='confirmed'?0:1,'actual directory owner observes cleanup failure without reopening or repeating the write');
 assert.equal(cleanup.length,outcome==='Core-unknown'?1:2);
 if(outcome!=='Core-unknown')assert.ok(cacheAuthority.calls.some(c=>c.method==='cache.clear.operation.query'),'actual qualified receipt read precedes platform cleanup');
 x.commits.accept({...target,chapterIndex:0,sourceSwitchTransactionId:tx});await settle();
 assert.equal(cleanup.length,outcome==='Core-unknown'?1:2,'repeated canonical notification cannot repeat old-source cleanup');
 checks.push('actual-Index-OffineHost-atomic-store-cold-Core-retired-source-'+outcome);
}
if(id==='retired-cache-confirmed')await retiredCacheCase('confirmed');
if(id==='retired-cache-platform-failure')await retiredCacheCase('platform-failure');
if(id==='retired-cache-Core-unknown')await retiredCacheCase('Core-unknown');
if(id==='reader-overlay'){
{
 const f=fixture({shared:true,open:false}),x=makeOwners(f,{reading:true});x.switchJourney.openReader();await settle();
 const s=x.p.consumer(read('features/reading/ui/ReaderShell.ets'),['sourceSwitchScopeId','sourceSwitchOverlayContent'],x.leafDeps,{sourceSwitchScopeId:x.source.scopeId});
 Object.assign(s,{sourceId:'old',sourceSwitchState:x.source.state,onCloseSourceSwitch:id=>x.sourceActions.close(id),
   onRetrySourceSwitch:id=>x.sourceActions.retry(id),onRefreshSourceSwitch:id=>x.sourceActions.refresh(id),
   onPickSource:(c,id)=>x.sourceActions.select(c,id),onRollbackSourceSwitch:id=>x.sourceActions.rollback(id)});
 s.sourceSwitchOverlayContent();const old=x.p.walk(s).find(c=>c instanceof x.leafDeps.SourceSwitchWindow);old.onClose();
 x.switchJourney.openReader();await settle();s.sourceSwitchScopeId=x.source.scopeId;s.sourceSwitchState=x.source.state;
 s.sourceSwitchOverlayContent();old.onClose();old.onSelectCandidate(f.candidate());await settle();assert.equal(f.host.current().visible,true);
 assert.equal(f.calls.filter(([m])=>m==='source.switch.commit').length,0);
 checks.push('actual-ReaderShell-overlay-oldscope-preserved-without-reader-tree-remount');
}
}
if(id==='reader-completion'){
{
 const {numbers}=await visualContract();const source=read('features/reading/ui/LocalReadingExperience.ets');
 const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
 // The SDK output depends on this fixed source/member/dependency graph, not
 // on scenario fields. Reuse its constructor while retaining a fresh actor,
 // actual property objects and callback ownership for every matrix entry.
 const p=boundedSurfaceSdk(),deps=sourceSwitchLiveSdk(p,{ReaderWindowCoordinator:{metrics:()=>metrics}});
 const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
 const feedbackFor=store=>pureModuleProbe(read('ui/feedback/ReaderTransientFeedback.ts'),'ReaderTransientFeedback.ts',
  {AppStorage:{get:key=>store.get(key),setOrCreate:(key,value)=>store.set(key,value)}},
  ['ReaderTransientFeedback','READER_FEEDBACK_EXTENDED_MS']);
 const feedbackDefaults=feedbackFor(new Map());
 const compiled=createReaderBuilderProbe(source,['sourceSwitchTransactionId','phase','visibleFragments','sourceSwitchFailureMessage','reduceMotion','onSessionLaunchReduceMotionChanged',
    'shouldShowSourceSwitchPreparation','sourceSwitchPreparationContent',
    'sourceSwitchCompletion','readingReadyGeneration','sourceSwitchCompletionVisible','sourceSwitchRevealOpacity','sourceSwitchFeedback','sourceSwitchVisualSelectionToken',
    'sourceSwitchCompletionEpoch','sourceSwitchRevealAnimator','consumedSourceSwitchCompletions',
    'sourceSwitchPendingCompletionKey','sourceSwitchPendingCompletionSelectionToken','sourceSwitchPendingCompletionLifecycleToken',
    'sourceSwitchPresentedRevision','sourceSwitchPresentedSelectionToken','sourceSwitchPresentedContinuous',
    'sourceSwitchCanonicalPageCurrent','onSourceSwitchPagePresented','hasContinuousRenderContent',
    'sourceSwitchCompletionKey','sourceSwitchCompletionCurrent','finishSourceSwitchReveal','cancelSourceSwitchCompletion',
    'sourceSwitchCompletionVisibleChanged','sourceSwitchCompletionChanged'],{...p.deps,...deps,...feedbackDefaults},p.hooks);
 const actors=[];
 const make=fields=>{
  const o=new compiled.Component(undefined,{});
  const feedbackStore=new Map();
  o.sourceSwitchFeedback=new (feedbackFor(feedbackStore).ReaderTransientFeedback)();
  const message=()=>feedbackStore.get('readerTransientToast')?.message??'';
  assert.equal(message(),'','each scenario starts with its own pristine completion state');
  for(const previous of actors){
   assert.notEqual(o,previous);assert.notEqual(o.nodes,previous.nodes);assert.notEqual(o.keys,previous.keys);
   assert.notEqual(o.watches,previous.watches);
   assert.notEqual(o.consumedSourceSwitchCompletions,previous.consumedSourceSwitchCompletions,'completion history is actor-local');
  }
  actors.push(o);
  Object.assign(o,{sourceSwitchTransactionId:'tx',phase:'loading',visibleFragments:[],visiblePage:undefined,
    sourceSwitchFailureMessage:'',visiblePageSelectionToken:-1,chapterSelectionToken:2,sessionGateway:undefined,
    isReaderIdentityCurrent:()=>true,sourceName:'新书源',chapterTitle:'第 20 章',chapter:undefined,reduceMotion:false,
    sourceId:'new',bookId:'target',mounted:true,exitRequested:false,appForeground:true,readingReadyGeneration:1,lifecycleToken:1,
    sourceSwitchCompletionVisible:true,materializedChapterSelectionToken:-1,pageTurnRenderRevision:2,
    continuousRenderRevision:4,continuousFragments:[],readerSettingsSnapshot:{navigationMode:'paged'},
    windowChromeActive:true,readerWindowMetricsRevision:1,readerStatusBarMetrics:()=>metrics,...fields});
  return{p,o,deps,message,feedbackStore};
 };
 for(const fields of [{},
  {phase:'measuring',sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {phase:'ready',sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {phase:'ready',visiblePage:{startScalar:20},visibleFragments:[{}],visiblePageSelectionToken:1,sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {sourceSwitchTransactionId:undefined,sessionGateway:{hasPendingSourceSwitch:()=>true}},
 ])assert.equal(make(fields).o.shouldShowSourceSwitchPreparation(),true,'real preparation retains the surface before the current physical page');
 for(const fields of [{sourceSwitchTransactionId:undefined},
  {phase:'failed'}, {sourceSwitchFailureMessage:'目录读取失败'}, {isReaderIdentityCurrent:()=>false},
  {phase:'ready',visiblePage:{startScalar:20},visibleFragments:[{}],visiblePageSelectionToken:2,sessionGateway:{hasPendingSourceSwitch:()=>true}},
  {sessionGateway:{hasPendingSourceSwitch:()=>false}},
 ])assert.equal(make(fields).o.shouldShowSourceSwitchPreparation(),false,'failure, retired owner, ready selected page and canonical completion relinquish preparation');
 const x=make({chapter:{chapterTitle:'准确章节 第 20 章'}});x.o.sourceSwitchPreparationContent();
 const progress=x.p.walk(x.o).find(c=>c instanceof x.deps.SourceSwitchProgress);assert.ok(progress);
 assert.equal(progress.sourceName,'新书源');assert.equal(progress.chapterTitle,'准确章节 第 20 章');
 assert.equal(progress.statusText,'正在载入章节…');assert.ok(x.p.nodes(progress).some(n=>n.create==='正在切换书源'));
 const spinner=x.p.walk(progress).find(c=>c instanceof x.deps.SourceSwitchSpinner);assert.ok(spinner);
 const ring=x.p.nodes(spinner).find(n=>n.type==='LoadingProgress');assert.ok(ring,'current native loading indicator');assert.equal(ring.width,numbers.switchSpinnerSize);assert.equal(ring.enableLoading,true);
 spinner.foreground=false;x.p.properties.flush();assert.equal(ring.enableLoading,false,'background disables native loading animation');
 spinner.foreground=true;spinner.reduceMotion=true;x.p.properties.flush();assert.equal(ring.enableLoading,false,'reduced motion disables native loading animation');
 const ready=make({phase:'ready',chapter:{sourceId:'new',bookId:'target',chapterIndex:19,chapterTitle:'第 20 章',content:'当前章节真实正文'},
   visiblePage:{startScalar:0},visibleFragments:[{text:'当前章节真实正文',imageHeight:0}],visiblePageSelectionToken:2,
   materializedChapterSelectionToken:2});
 ready.o.sourceSwitchCompletion=new ready.deps.SourceSwitchCompletionPresentation('tx','new','target',1,'新书源',19,0);
 ready.p.properties.flush();
 assert.equal(ready.message(),'','phase ready without the resident revision cannot announce success');
 ready.o.onSourceSwitchPagePresented(ready.o.pageTurnRenderRevision-1);
 assert.equal(ready.message(),'','the prior native page revision cannot announce this chapter');
 ready.o.onSourceSwitchPagePresented(ready.o.pageTurnRenderRevision);
 assert.equal(ready.message(),'已切换至 新书源','real production canonical and current-revision guards admit completion');
 ready.o.cancelSourceSwitchCompletion();
 
 checks.push('actual-target-reader-prepare-current-selection-ready-failure-stale-prop-foreground-reduced-motion');
}
}
if(id==='metadata-hosts'){
{
 const {numbers,colors}=await visualContract();
 class ChildPort {
  constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}
  updateStateVars(params){Object.assign(this.params,params);}
 }
 const panelSource=read('features/source/ui/SourceSwitchPanel.ets'),shellSource=read('features/reading/ui/ReaderShell.ets');
 const windowSource=read('features/source/ui/SourceSwitchWindow.ets'),indexSource=read('pages/Index.ets');
 const surfacesSource=read('app/composition/ReaderSourceSwitchSurfaces.ets');
 const directorySource=read('features/reading/ui/BookDirectoryPage.ets');
 const p=boundedSurfaceSdk(),deps=sourceSwitchLiveSdk(p,{ReaderWindowCoordinator:{metrics:()=>metricsApi.createDefaultReaderWindowMetrics()}});
 const factories=new Map(),actors=[];
 const capture=(source,names,childName,childSource,fields)=>{
  const key=JSON.stringify([source,names,childName,childSource]);
  let compiled=factories.get(key);
  if(compiled===undefined){
   const surfaceChildren=source===surfacesSource?{SourceSwitchPanel:panelSource,BookDirectoryPage:directorySource}:{};
   const childTypes=Object.fromEntries(Object.keys(surfaceChildren).map(name=>[name,ChildPort]));
   compiled=createReaderBuilderProbe(source,names,{...p.deps,...deps,...childTypes,[childName]:ChildPort},
    {...p.hooks,initialParams:source===surfacesSource?fields:{},
     childSources:{...p.hooks.childSources,...surfaceChildren,[childName]:childSource}});
   factories.set(key,compiled);
  }
  const o=new compiled.Component(undefined,source===surfacesSource?fields:{});
  for(const previous of actors){assert.notEqual(o,previous);assert.notEqual(o.nodes,previous.nodes);assert.notEqual(o.children,previous.children);}
  actors.push(o);Object.assign(o,fields);
  return{p,o,child:()=>[...o.children.values()].find(c=>c instanceof ChildPort)};
 };
 const book={sourceId:'old',bookId:'book',title:'书名',author:'作者',sourceName:'当前书源',coverUrl:'cover',lastChapter:'最新章节 第 120 章'};
 const state={kind:'candidates',candidates:[]};
 const expectedCurve={kind:'cubic-bezier',values:[numbers.easingX1,numbers.easingY1,numbers.easingX2,numbers.easingY2]};
 const assertScrim=(probe,contentKind,scheme,reduceMotion)=>{
  const nodes=probe.p.nodes(probe.o).filter(n=>n.type==='Stack'&&typeof n.onClick==='function');
  assert.equal(nodes.length,1,'the real overlay has one dismissing scrim');
  const scrim=nodes[0];
  const c=colors[scheme],hex=n=>Math.round(n).toString(16).padStart(2,'0').toUpperCase();const expectedColor='#'+[c.a*255,c.r,c.g,c.b].map(hex).join('');
  assert.equal(scrim.backgroundColor,expectedColor,'detail and retained reader use the same selected scrim palette for both formats');
  assert.equal(scrim.width,'100%');assert.equal(scrim.height,'100%');
  if(reduceMotion){
   assert.equal(scrim.transition.kind,'identity','reduced motion preserves a static scrim for both formats');
  }else{
   assert.equal(scrim.transition.kind,'asymmetric');
   for(const [phase,duration] of [['appear',numbers.openDurationMs],['disappear',numbers.closeDurationMs]]){
    const effect=scrim.transition.parameters[phase];
    assert.equal(effect.kind,'opacity');
    assert.equal(effect.options.duration,duration,'the scrim uses the selected drawer transition duration');
    assert.deepEqual(effect.options.curve,expectedCurve,'both hosts use the selected shared cubic curve');
   }
  }
 };
 for(const contentKind of ['text','manga'])for(const scheme of ['day','night'])for(const reduceMotion of [false,true]){
  const i=capture(surfacesSource,['build'],'SourceSwitchPanel',panelSource,{
   reading:{book:{...book,contentKind},directoryChapterTitle:'正在阅读 第 20 章',sessionActive:false},
   source:{visible:true,scopeId:7,state,host:()=>undefined},
   manga:{selectionVisible:false,canCancelPreparation:()=>false},
   entryPickerAllowed:true,consumeTopInset:false,reduceMotion,interactive:true,
   actions:{stop(){},close(){},retry(){},refresh(){},select(){},rollback(){}},
  });
  i.o.initialRender();assert.equal(i.child().params.latestChapterTitle,book.lastChapter);
  assert.equal(i.child().params.currentChapterTitle,'正在阅读 第 20 章','the current reading chapter never replaces latest metadata');
  assert.equal(i.child().params.consumeTopInset,false);
  const s=capture(shellSource,['sourceSwitchOverlayContent'],'SourceSwitchPanel',panelSource,{
   contentKind,bookTitle:book.title,bookAuthor:book.author,bookCoverUrl:book.coverUrl,sourceName:book.sourceName,
   sourceId:book.sourceId,latestChapterTitle:book.lastChapter,directoryChapterTitle:'正在阅读 第 20 章',
   sourceSwitchScopeId:7,sourceSwitchState:state,appThemeScheme:scheme,reduceMotion,visible:true,inputAllowed:true,sourceSwitchCovered:false,
  });
  s.o.sourceSwitchOverlayContent();assert.equal(s.child().params.latestChapterTitle,book.lastChapter);
  assert.equal(i.child().params.reduceMotion,reduceMotion);assert.equal(s.child().params.reduceMotion,reduceMotion);
  for(const host of [i,s]){
   const closes=[];
   const panel=capture(panelSource,boundedMembers(panelSource),'SourceSwitchWindow',windowSource,
    {...host.child().params,appThemeScheme:scheme,appForeground:true,onClose:scope=>closes.push(scope)});
   panel.o.aboutToAppear();
   panel.o.initialRender();
   assert.ok(panel.p.nodes(panel.o).some(n=>n.type==='Stack'&&n.create?.alignContent==='Alignment.Bottom'));
   assertScrim(panel,contentKind,scheme,reduceMotion);
   assert.equal(panel.child().params.latestChapterTitle,book.lastChapter);
   assert.equal(panel.child().params.currentChapterTitle,'正在阅读 第 20 章');
   const close=panel.child().params.onClose;
   close();assert.deepEqual(closes,[7],'foreground action keeps the current scope');
   panel.o.interactive=false;close();
   panel.o.interactive=true;panel.o.appForeground=false;close();
   panel.o.appForeground=true;panel.o.aboutToDisappear();close();
   assert.deepEqual(closes,[7],'covered, background and detached carriers reject the retained callback');
  }
 }
 const selection={target:{identity:{sourceId:'new',bookId:'target'},book:{title:'目标书籍'}},entries:[{index:8,title:'目标章'}]};
 const effects=[];
 const targetCatalog=capture(surfacesSource,['build'],'BookDirectoryPage',directorySource,{
  reading:{book,sessionActive:true},source:{visible:true,scopeId:7,state},entryPickerAllowed:true,
  manga:{selectionVisible:true,selection,
   directoryOpening:current=>()=>current===selection,
   directorySelection:current=>index=>effects.push(['chapter',current,index]),
   directoryTemporaryBack:current=>(_handler,identity)=>effects.push(['bridge',current,identity]),
   directoryBack:current=>()=>effects.push(['back',current]),
  },
 });
 targetCatalog.o.initialRender();
 assert.equal(targetCatalog.o.children.size,1,'the target catalog is the only root source-switch surface while selecting');
 const targetProps=targetCatalog.child().params;
 assert.deepEqual([targetProps.sourceId,targetProps.bookId,targetProps.bookTitle],['new','target','目标书籍']);
 assert.deepEqual(targetProps.entries,selection.entries);
 targetProps.onSelectChapter(8);targetProps.onTemporaryBackBridge(()=>true,'catalog');targetProps.onBack();
 assert.deepEqual(effects,[['chapter',selection,8],['bridge',selection,'catalog'],['back',selection]]);
 assert.doesNotMatch(shellSource,/\bSourceSwitchWindow\s*\(/,'the retained reader renders the shared panel carrier');
 // Follow the owned reading presentation through the current retained scene.
 const require=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot();
 const ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
 const parse=(name,source)=>ts.createSourceFile(virtualFilePath(name),source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const componentCall=(tree,name)=>{
  const calls=[];
  const visit=node=>{
   if((ts.isCallExpression(node)||ts.isEtsComponentExpression(node))&&node.expression.getText(tree)===name)calls.push(node);
   ts.forEachChild(node,visit);
  };
  visit(tree);
  assert.equal(calls.length,1,'one actual assembly call for '+name);
  return calls[0];
 };
 const indexTree=parse('Index.ets',indexSource);
 const sceneCall=componentCall(indexTree,'RetainedReaderScene');
 const readingBinding=sceneCall.arguments[0].properties.find(field=>field.name?.getText(indexTree)==='reading');
 assert.equal(readingBinding?.initializer.getText(indexTree),'this.readingEntry');
 const tree=parse('RetainedReaderScene.ets',read('app/composition/RetainedReaderScene.ets'));
 const scene=tree.statements.find(node=>ts.isStructDeclaration(node)&&node.name.getText(tree)==='RetainedReaderScene');
 const reading=scene?.members.find(member=>member.name?.getText(tree)==='reading');
 assert.ok(reading&&ts.getAllDecorators(reading).some(decorator=>decorator.getText(tree)==='@ObjectLink'),
  'the scene observes the same ReadingEntryPresentation passed by Index');
 const call=componentCall(tree,'ReaderShell');
 const names=new Set(['latestChapterTitle','bookTitle','bookAuthor','bookCoverUrl','sourceName','sourceId','contentKind']);
 const fields=call.arguments[0].properties.filter(f=>names.has(f.name?.getText(tree))).map(f=>f.getText(tree));assert.equal(fields.length,names.size);
 const carrier=capture('@Component struct SourceMetadataPayload {@Builder payload(){ReaderShell({'+fields.join(',')+'});}build(){Column(){}}}',
  ['payload'],'ReaderShell',shellSource,{reading:{book,contentKind:'text'}});
 carrier.o.payload();assert.equal(carrier.child().params.latestChapterTitle,book.lastChapter);
 carrier.o.reading.book={...book,lastChapter:undefined};carrier.o.replay();assert.equal(carrier.child().params.latestChapterTitle,'','missing latest metadata stays empty');
 
 
 checks.push('actual-root-surfaces-and-ReaderShell-Panel-metadata-drawer-and-target-catalog-payload');
}
}
passed=true;}finally{for(const host of owned)host.retire();setCurrentRuntime(undefined);setEntryRuntime(undefined);const cleanup=await cleanupDurableFixtures?.({retain:!passed});if(cleanup&&!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
const definitions={"presentation-workflow":"Actual Index and SourceSwitchPresentation workflow, startup inspection and current reader transaction", "manga-valid": "manga-valid actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-stale-proof": "manga-stale-proof actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-wrong-book": "manga-wrong-book actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-wrong-author": "manga-wrong-author actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-target-version": "manga-target-version actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-registry-during-proof": "manga-registry-during-proof actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-wrong-target-author": "manga-wrong-target-author actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-registry-during-image": "manga-registry-during-image actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-cancel-resolve": "manga-cancel-resolve actual scoped owner/gateway/storage path; controlled Core/OS ports", "manga-cancel-reject": "manga-cancel-reject actual scoped owner/gateway/storage path; controlled Core/OS ports", "preview-cancel": "preview-cancel actual scoped owner/gateway/storage path; controlled Core/OS ports", "seed-author-proof": "seed-author-proof actual scoped owner/gateway/storage path; controlled Core/OS ports", "qualification-cancel": "qualification-cancel actual scoped owner/gateway/storage path; controlled Core/OS ports", "source-finalization": "source-finalization actual scoped owner/gateway/storage path; controlled Core/OS ports", "old-overlay": "old-overlay actual scoped owner/gateway/storage path; controlled Core/OS ports", "unknown-recovery": "unknown-recovery actual scoped owner/gateway/storage path; controlled Core/OS ports", "late-navigation": "late-navigation actual scoped owner/gateway/storage path; controlled Core/OS ports", "failed-preview": "failed-preview actual scoped owner/gateway/storage path; controlled Core/OS ports", "remount": "remount actual scoped owner/gateway/storage path; controlled Core/OS ports", "retained-reader-failure": "retained-reader-failure actual scoped owner/gateway/storage path; controlled Core/OS ports", "retired-cache-confirmed": "retired-cache-confirmed actual scoped owner/gateway/storage path; controlled Core/OS ports", "retired-cache-platform-failure": "retired-cache-platform-failure actual scoped owner/gateway/storage path; controlled Core/OS ports", "retired-cache-Core-unknown": "retired-cache-Core-unknown actual scoped owner/gateway/storage path; controlled Core/OS ports", "reader-overlay": "reader-overlay actual scoped owner/gateway/storage path; controlled Core/OS ports", "reader-completion": "reader-completion actual scoped owner/gateway/storage path; controlled Core/OS ports", "metadata-hosts": "metadata-hosts actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
