import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {sourceSwitchLiveSdk} from './lib/source-switch-sdk-consumer.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import * as horizontal from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {fixture,settle,deferred,origin,target,session,rawCandidate,hostSource,Gateway,gatewayExports,read,setCurrentRuntime,ReadingSessionFlowGateway} from './lib/source-switch-owner-probe.mjs';
const checks=[];
const TX='00000000-0000-4000-8000-000000000001/1';
const untilOwner=async(predicate)=>{
  for(let i=0;i<400&&!predicate();i++)await new Promise(resolve=>setTimeout(resolve,5));
  assert.ok(predicate(),'actual source owner reaches its finite asynchronous boundary');
};
const authorProof={schemaVersion:1,sourceVersion:'v1',field:'detail',raw:'@Writer',label:'Writer',rule:'author-nickname-at-v1'};
const exactAuthorRecord={origin:'old',bookUrl:'book',name:'Book',author:'@Writer',
  acquisition:{sourceVersion:'v1',authorIdentity:authorProof}};
for(const change of ['disabled','removed','version','media']){
  const f=fixture(),base=f.runtime.request.bind(f.runtime),acquisitions=f.runtime.bookAcquisitions;
  let revision=1;
  f.runtime.bookAcquisitions=()=>({...acquisitions(),sourceRegistryRevision:()=>revision});
  await settle();assert.equal(f.host.current().state.kind,'candidates');
  const candidate=f.candidate();assert.equal(candidate.sourceVersion,'v1');revision++;
  f.runtime.request=async(method,params,options)=>{
    if(method==='source.list')return{data:{sources:[{sourceId:'old',name:'Old',enabled:true,sourceVersion:'v1'},
      ...(change==='removed'?[]:[{sourceId:'new',name:'New',enabled:change!=='disabled',
        sourceVersion:change==='version'?'v2':'v1',bookSource:{bookSourceType:change==='media'?2:0}}])]}};
    return base(method,params,options);
  };
  await f.host.pick(candidate,f.host.current().scopeId);
  assert.equal(f.host.current().state.kind,'discoveryError');
  assert.match(f.host.current().state.message,/候选书源已变更或不可用/);
  assert.equal(f.calls.some(([method])=>method==='acquire'||method==='source.switch.commit'),false);
  assert.equal(f.host.pickQualification,undefined);
  assert.equal(f.host.close(f.host.current().scopeId),true);
  checks.push(`visible-target-${change}-is-requalified-before-acquisition-and-remains-recoverable`);
}
const pendingQualificationFixture=async(productionSource=hostSource)=>{
  const f=fixture({open:false,shared:true},productionSource),gate=deferred(),base=f.runtime.request.bind(f.runtime);
  const acquisitions=f.runtime.bookAcquisitions;
  let revision=1,blockNextRegistry=false,qualificationStarted=false;
  f.runtime.bookAcquisitions=()=>({...acquisitions(),sourceRegistryRevision:()=>revision});
  f.runtime.request=async(method,params,options)=>{
    if(method==='source.list'&&blockNextRegistry){
      blockNextRegistry=false;qualificationStarted=true;await gate.promise;
      // A native IO may deliver its old result despite cancellation. Exercise
      // the actual post-await owner guards, not a cooperative fixture shortcut.
      return{data:{sources:[{sourceId:'old',name:'Old',enabled:true,sourceVersion:'v1'},
        {sourceId:'new',name:'New',enabled:true,sourceVersion:'v1'}]}};
    }
    return base(method,params,options);
  };
  assert.equal(f.host.open(f.context,f.lease),true);await settle();assert.equal(f.host.current().state.kind,'candidates');
  revision=2;blockNextRegistry=true;
  const scope=f.host.current().scopeId,work=f.host.pick(f.candidate(),scope);
  await settle();assert.equal(qualificationStarted,true);assert.equal(f.host.current().state.kind,'switching');
  assert.equal(f.calls.some(([method])=>method==='acquire'||method==='source.switch.commit'),false);
  return{f,gate,scope,work};
};
for(const action of ['close','consume-back','retire','runtime-retire'])for(const outcome of ['resolve','reject']){
  const {f,gate,scope,work}=await pendingQualificationFixture();
  let successor=f;
  if(action==='runtime-retire'){
    setCurrentRuntime(undefined);successor=fixture({open:false,shared:true});
    // One production class owns the singleton across Runtime handoff. Each
    // fixture compiles an isolated class, so rebind through the original one.
    successor.host=f.Constructor.forRuntime(successor.runtime);
  }else{
    if(action==='close')assert.equal(f.host.close(scope),true);
    else if(action==='consume-back')assert.equal(f.host.consumeBack(scope),true);
    else f.host.retire();
  }
  assert.equal(f.host.current().visible,false,action);assert.equal(f.host.current().state.kind,'discovering',action);
  assert.equal(f.host.pickQualification,undefined,'read-only qualification releases its exact lock immediately');
  assert.equal(successor.host.open(successor.context,successor.lease),true,'reopen must succeed before the old IO settles');
  await settle();assert.equal(successor.host.current().state.kind,'candidates');
  const nextScope=successor.host.current().scopeId,context=successor.host.context,candidates=successor.host.current().state.candidates;
  if(successor===f)assert.notEqual(nextScope,scope);
  if(outcome==='resolve')gate.resolve();else gate.reject(Error('old qualification read failed'));
  await work;await settle();
  assert.equal(successor.host.current().visible,true);assert.equal(successor.host.current().scopeId,nextScope);
  assert.equal(successor.host.current().state.kind,'candidates');assert.equal(successor.host.context,context);
  assert.equal(successor.host.current().state.candidates,candidates,'old qualification cannot hide or replace the new rows');
  assert.equal(f.calls.some(([method])=>method==='acquire'||method==='source.switch.commit'),false);
  assert.equal(successor.host.current().write,undefined);successor.host.retire();
  checks.push(`pending-pick-qualification-${action}-reopens-before-late-${outcome}-without-side-effects`);
}
{
  const gate=deferred(),f=fixture({acquireGate:gate});await settle();
  const work=f.host.pick(f.candidate(),f.host.current().scopeId);
  await untilOwner(()=>f.calls.some(([method])=>method==='acquire'));
  assert.equal(f.host.pickQualification,undefined,'qualification ends before acquisition starts');
  assert.equal(f.host.close(f.host.current().scopeId),false);assert.equal(f.host.consumeBack(f.host.current().scopeId),true);
  assert.equal(f.host.current().visible,true);assert.equal(f.host.blocksExit(origin),true);
  f.host.retire();assert.equal(f.host.open(f.context,f.lease),false,'in-flight acquisition keeps the existing close/reopen guard');
  gate.resolve();await work;assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  checks.push('qualified-acquisition-keeps-close-and-reopen-locked-until-real-settlement');
}
for(const action of ['close','consume-back','retire'])for(const outcome of ['resolve','reject']){
  const gate=deferred(),f=fixture({preview:true,acquireGate:gate});await settle();
  const scope=f.host.current().scopeId,work=f.host.pick(f.candidate(),scope);
  await untilOwner(()=>f.calls.some(([method])=>method==='acquire'));
  assert.equal(f.host.canCancelPreparation(scope),true);
  if(action==='close')assert.equal(f.host.close(scope),true);
  else if(action==='consume-back')assert.equal(f.host.consumeBack(scope),true);
  else f.host.retire();
  assert.equal(f.host.current().visible,false);assert.equal(f.host.blocksExit(origin),false);
  assert.equal(f.host.open(f.context,f.lease),true);await settle();
  const next=f.host.current().scopeId,rows=f.host.current().state.candidates;
  if(outcome==='resolve')gate.resolve();else gate.reject(Error('old preview failure'));
  await work;await settle();
  assert.equal(f.host.current().visible,true);assert.equal(f.host.current().scopeId,next);
  assert.equal(f.host.current().state.candidates,rows);assert.equal(f.host.previewPreparation,undefined);
  assert.equal(f.effects.some(effect=>effect.kind==='previewReady'),false);
  assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  f.retire();checks.push(`preview-preparation-${action}-rejects-late-${outcome}-without-locking-successor`);
}
for(const proofState of ['current','stale'])for(const preview of [false,true]){
  const f=fixture({open:false,preview}),gate=deferred(),base=f.runtime.request.bind(f.runtime);
  const version=proofState==='current'?'v1':'v0';
  const proof={...authorProof,sourceVersion:version};
  const known={sourceId:'new',bookUrl:'target',bookName:'Book',author:'Writer',sourceName:'New',
    sourceVersion:'v1',category:'novel'};
  f.context.query={...f.context.query,author:'@Writer',authorIdentity:proof,sourceVersion:version};
  f.context.knownCandidates=[known];let registryReads=0;
  f.runtime.request=async(method,params,options)=>{
    if(method==='source.list'){registryReads++;await gate.promise;return base(method,params,options);}
    if(method==='search-book.get')return{data:{book:{...exactAuthorRecord,
      acquisition:{sourceVersion:version,authorIdentity:proof}}}};
    return base(method,params,options);
  };
  assert.equal(f.host.open(f.context,f.lease),true);await settle();
  assert.equal(f.host.current().state.kind,'candidates','known rows paint while qualification is still pending');
  assert.equal(f.host.current().state.candidates[0],known);
  assert.ok(registryReads>0);assert.equal(f.subscriptions.size,1,'changes are held during identity qualification');
  const picking=f.host.pick(known,f.host.current().scopeId);
  assert.equal(f.host.current().state.kind,'switching','the click provides feedback before registry IO');
  assert.equal(f.calls.some(([method])=>method==='acquire'||method==='source.switch.commit'),false);
  gate.resolve();await picking;await settle();
  if(proofState==='stale'){
    assert.equal(f.host.current().state.kind,'discoveryError');
    assert.equal(f.host.current().write,undefined);
    assert.equal(f.calls.some(([method])=>method==='acquire'||method==='source.switch.commit'),false,
      'a stale proof cannot reach target preparation or a durable write');
    assert.equal(f.effects.some(effect=>effect.kind==='targetReady'||effect.kind==='previewReady'),false);
  }else{
    assert.ok(f.effects.some(effect=>effect.kind===(preview?'previewReady':'targetReady')));
    assert.equal(f.calls.filter(([method])=>method==='acquire').length,1);
    assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,preview?0:1);
  }
  f.retire();checks.push(`known-first-paint-pending-registry-${proofState}-proof-${preview?'preview':'shelf'}-pick-admission`);
}
{
  const f=fixture({open:false}),base=f.runtime.request.bind(f.runtime),queries=[];
  f.context.query={...f.context.query,author:'@Writer'};
  f.runtime.request=async(method,params,options)=>{
    if(method==='search-book.get'){
      assert.deepEqual(params,{origin:'old',bookUrl:'book'});
      return{data:{book:exactAuthorRecord}};
    }
    if(method==='book.search'){
      assert.equal(params.page,1);
      return{data:{sourceId:params.sourceId,sourceVersion:'v1',contentKind:'text',books:params.sourceId==='new'
        ?[{bookId:'target',title:'Book',author:'Writer',variables:{}}]:[]}};
    }
    return base(method,params,options);
  };
  for(const [method,index] of [['loadCachedCandidates',0],['refreshCandidates',0],['assertAcquiredBook',2]]){
    const original=f.host.gateway[method].bind(f.host.gateway);
    f.host.gateway[method]=(...args)=>{queries.push([method,args[index]]);return original(...args);};
  }
  assert.equal(f.host.open(f.context,f.lease),true);await settle();
  assert.equal(f.host.current().state.kind,'candidates');
  const query=f.host.context.query;
  assert.deepEqual(query.authorIdentity,authorProof);assert.equal(query.author,'@Writer');
  assert.equal(query.sourceVersion,'v1');assert.notEqual(query,f.context.query);
  f.host.refresh(f.host.current().scopeId);
  await untilOwner(()=>f.host.current().state.refreshing===false);
  assert.equal(f.host.current().state.refreshing,false);
  const candidate=f.host.current().state.candidates.find(row=>row.sourceId==='new');assert.ok(candidate);
  await f.host.pick(candidate,f.host.current().scopeId);await settle();
  assert.ok(f.effects.some(effect=>effect.kind==='targetReady'));
  assert.ok(queries.some(([method])=>method==='loadCachedCandidates'));
  assert.ok(queries.some(([method])=>method==='refreshCandidates'));
  assert.ok(queries.some(([method])=>method==='assertAcquiredBook'));
  assert.ok(queries.every(([,observed])=>observed===query),'cache/discovery/final target retain the same resolved query');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  checks.push('exact-Core-author-proof-unifies-cache-discovery-picker-and-final-target');
}
for(const action of ['close-reopen','retire-reopen']){
  const f=fixture({open:false}),gate=deferred(),base=f.runtime.request.bind(f.runtime);
  let proofReads=0;
  f.context.query={...f.context.query,author:'@Writer'};f.setRows([]);
  f.runtime.request=async(method,params,options)=>{
    if(method==='search-book.get'){proofReads++;await gate.promise;return{data:{book:exactAuthorRecord}};}
    return base(method,params,options);
  };
  assert.equal(f.host.open(f.context,f.lease),true);await settle();assert.equal(proofReads,1);
  if(action==='close-reopen')assert.equal(f.host.close(f.host.current().scopeId),true);
  else f.host.retire();
  const successor={...f.context,query:{...f.context.query,bookId:'successor',bookName:'Successor',author:'Writer'}};
  f.setIdentity({sourceId:'old',bookId:'successor'});
  assert.equal(f.host.open(successor,f.lease),true);await settle();
  const successorContext=f.host.context,scope=f.host.current().scopeId;
  assert.equal(f.host.current().state.kind,'empty');
  if(action==='retire-reopen')gate.reject(Error('retired identity read failed'));
  else gate.resolve();
  await settle();
  assert.equal(f.host.context,successorContext);assert.equal(f.host.context.query.bookId,'successor');
  assert.equal(f.host.context.query.authorIdentity,undefined);assert.equal(f.host.current().scopeId,scope);
  assert.equal(f.host.current().write,undefined);assert.equal(f.host.current().state.kind,'empty');
  f.retire();checks.push('late-author-proof-'+action+'-cannot-overwrite-successor-context');
}
{
  const f=fixture({open:false}),gate=deferred(),base=f.runtime.request.bind(f.runtime);
  f.context.query={...f.context.query,author:'@Writer'};
  let started=false;
  f.runtime.request=async(method,params,options)=>{
    if(method==='search-book.get'){started=true;await gate.promise;return{data:{book:exactAuthorRecord}};}
    return base(method,params,options);
  };
  f.host.open(f.context,f.lease);await settle();assert.equal(started,true);
  setCurrentRuntime(undefined);gate.resolve();await settle();
  assert.equal(f.host.context.query.authorIdentity,undefined);assert.equal(f.host.current().write,undefined);
  assert.equal(f.host.current().state.kind,'discovering');f.retire();
  checks.push('retired-Runtime-late-author-proof-publishes-no-context-or-write');
}
{
  const f=fixture({open:false}),base=f.runtime.request.bind(f.runtime);
  f.context.query={...f.context.query,author:'@Writer'};let failIdentity=true,proofReads=0;
  f.runtime.request=async(method,params,options)=>{
    if(method==='search-book.get'){
      proofReads++;if(failIdentity)throw Error('identity storage unavailable');
      return{data:{book:exactAuthorRecord}};
    }
    return base(method,params,options);
  };
  f.host.open(f.context,f.lease);await settle();
  assert.equal(f.host.current().state.kind,'discoveryError');
  assert.equal(f.host.current().state.message,'换源暂时未完成，请重试或选择其他书源。');
  assert.equal(f.host.current().write,undefined,'identity read cannot become an unknown durable write');
  assert.equal(f.disk.finishes,0);assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  failIdentity=false;f.host.retry(f.host.current().scopeId);
  await untilOwner(()=>f.host.current().state.kind==='candidates');
  assert.equal(f.host.current().state.kind,'candidates');assert.equal(proofReads,2);
  assert.deepEqual(f.host.context.query.authorIdentity,authorProof);assert.equal(f.host.current().write,undefined);
  f.retire();checks.push('author-identity-read-error-remains-discovery-only-and-explicitly-recovers');
}
{
  const f=fixture({open:false}),baseRequest=f.runtime.request.bind(f.runtime),rows=[],started=[],progress=[];
  const sources=['first','faster','slow'],gates=new Map(sources.map(id=>[id,deferred()]));
  let now=1000;
  const originalNow=Date.now;
  const registry=[{sourceId:'old',name:'Old',enabled:true,sourceVersion:'v1'},
    ...sources.map(sourceId=>({sourceId,name:sourceId,enabled:true,sourceVersion:'v1'}))];
  f.runtime.request=async(method,params,options)=>{
    if(method==='source.list')return{data:{sources:registry}};
    if(method==='search-book.related')return{data:{books:rows.slice(),snapshotRevision:'stream',complete:true,
      sourceVersions:registry.map(source=>({...source}))}};
    if(method==='search-book.batch.get')return{data:{complete:true,books:[],missing:params.identities}};
    if(method==='book.search'){
      assert.equal(params.page,1);const id=params.sourceId;started.push(id);
      if(id==='first')now=1500;if(id==='faster')now=1600;
      await gates.get(id).promise;
      rows.push({...rawCandidate,origin:id,bookUrl:`/${id}`,time:Math.floor(now/1000)});
      return{data:{sourceId:id,sourceVersion:'v1',contentKind:'text',
        books:[{bookId:`/${id}`,title:'Book',author:'Writer',variables:{}}]}};
    }
    return baseRequest(method,params,options);
  };
  f.context.searchedSourceIds=['old'];
  const refresh=f.host.gateway.refreshCandidates.bind(f.host.gateway);
  f.host.gateway.refreshCandidates=(query,current,excluded,onProgress,initial)=>{
    progress.push(onProgress);return refresh(query,current,excluded,onProgress,initial);
  };
  Date.now=()=>now;
  try{
    assert.equal(f.host.open(f.context,f.lease),true);await settle();
    assert.equal(f.host.current().state.kind,'discovering');assert.deepEqual(started,sources);
    now=1700;gates.get('first').resolve();await settle();
    assert.deepEqual(f.host.current().state.candidates.map(row=>row.sourceId),['first'],
      'first source is published while two real Gateway workers are still unresolved');
    assert.equal(f.host.current().state.refreshing,true);assert.equal(f.candidate().latencyMs,700);
    now=1800;gates.get('faster').resolve();await settle();
    assert.deepEqual(f.host.current().state.candidates.map(row=>row.sourceId),['faster','first'],
      'new source is sorted by its measured search latency before the last worker completes');
    assert.equal(f.candidate().latencyMs,300);assert.equal(f.host.current().state.refreshing,true);
    now=3000;gates.get('slow').resolve();await settle();
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(f.host.current().state.candidates.length,3);assert.equal(f.host.current().state.refreshing,false);
    const originalCandidates=f.host.current().state.candidates;
    const before=f.host.current().scopeId;
    // Retain the real owner while the next Gateway invocation waits; direct
    // captured callbacks below exercise Host admission independently of the
    // Gateway's own cancellation, which also remains active.
    const pending=deferred();f.host.gateway.refreshCandidates=(query,current,excluded,onProgress,initial)=>{
      progress.push(onProgress);assert.deepEqual(initial,originalCandidates);
      return pending.promise;
    };
    f.host.refresh(before);
    assert.deepEqual(f.host.current().state.candidates,originalCandidates,
      'refresh keeps the last version-bound search measurement while new results are pending');
    assert.ok(originalCandidates.every(row=>row.latencyMs!==undefined),'old immutable rows are not modified');
    await settle();const oldProgress=progress.at(-1);
    f.host.stop(before);f.host.refresh(before);await settle();
    const currentSnapshot=f.host.current();oldProgress([{...originalCandidates[0],sourceId:'obsolete'}]);
    assert.equal(f.host.current(),currentSnapshot,'previous generation cannot publish into a new sweep');
    const latestProgress=progress.at(-1);assert.equal(f.host.close(before),true);
    const closed=f.host.current();latestProgress(originalCandidates);
    pending.resolve({kind:'sources',candidates:originalCandidates});await settle();
    assert.equal(f.host.current(),closed,'closed owner rejects late callbacks and final results');
    assert.equal(f.subscriptions.size,0);
  }finally{Date.now=originalNow;f.retire();for(const gate of gates.values())gate.resolve();}
  checks.push('actual-owner-zero-to-streaming-latency-sort-refresh-retains-measurement-and-generation-close-admission');
}
{
  const f=fixture({preview:true,failAcquire:true});await settle();
  const original=f.host.current().scopeId;await f.host.pick(f.candidate(),original);
  assert.equal(f.effects.at(-1).kind,'acquisitionFailed');assert.equal(f.host.current().visible,false);
  const before=f.calls.length;
  assert.equal(f.host.bindReader({...f.context,query:{...f.context.query,bookId:'other'}},f.lease),false);
  assert.equal(f.host.bindReader(f.context,{...f.lease,isCurrent:()=>false}),false);
  assert.equal(f.host.bindReader(f.context,f.lease),true);
  assert.equal(f.calls.length,before,'reader rebind performs no read, acquisition or mutation');
  assert.equal(f.host.current().failureMessage,'换源暂时未完成，请重试或选择其他书源。');
  const rebound=f.host.current().scopeId;assert.notEqual(rebound,original);
  f.host.retryFailed(original);assert.equal(f.calls.length,before,'old failure action cannot borrow the new scope');
  f.options.failAcquire=false;f.host.retryFailed(rebound);await settle();
  assert.equal(f.effects.at(-1).kind,'previewReady','rebound failure keeps the original candidate for explicit retry');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,0);
  const empty=fixture();await settle();assert.equal(empty.host.bindReader(empty.context,empty.lease),false);
  setCurrentRuntime(undefined);assert.equal(f.host.bindReader(f.context,f.lease),false);
  checks.push('failed-acquisition-reader-rebind-exact-identity-scope-no-IO');
}
{
  const f=fixture();await settle();const owner=f.Constructor.forRuntime(f.runtime);
  assert.equal(f.Constructor.forRuntime(f.runtime),owner,'Index remount shares one actual feature owner');
  const successor={...f.runtime};setCurrentRuntime(successor);const next=f.Constructor.forRuntime(successor);
  assert.notEqual(next,owner);assert.throws(()=>f.Constructor.forRuntime(f.runtime),error=>error.kind==='pending');
  assert.equal(f.Constructor.forRuntime(successor),next,'old Runtime must never replace successor cache');
  checks.push('feature-local-exact-Runtime-shared-owner-remount-and-retired-refusal');
}
{
  const f=fixture();await settle();assert.equal(f.host.current().state.kind,'candidates');
  await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.transactionId,TX);
  assert.equal(f.effects.at(-1).kind,'targetReady');assert.equal(f.effects.at(-1).chapterIndex,0);
  assert.equal(f.host.currentTransactionId(target),TX);
  assert.equal(JSON.parse(f.disk.durable).operationId,TX,'pending Core lineage keeps full intent across the reader seam');
  const authority=f.intentClasses.SourceSwitchIntentStore.warmIntent;
  await assert.rejects(new f.intentClasses.SourceSwitchIntentStore(f.runtime,new Gateway(f.runtime)).clear(authority),
    error=>error.kind==='blocked','confirmed pending receipt alone cannot clear durable authority');
  assert.equal(JSON.parse(f.disk.durable).operationId,TX);
  assert.equal(f.host.targetCommitted(target,'old-txn'),undefined,'late old transaction cannot clear the current journal');
  f.setPhase('finalized');
  assert.equal(f.host.targetCommitted(target,TX).transactionId,TX);
  assert.equal(f.host.current().pending,undefined);await settle();assert.equal(f.disk.durable,'');
  checks.push('real-discovery-progress-commit-target-seam-and-exact-terminal-release');
}
{
  const gate=deferred(),f=fixture({commitGate:gate});await settle();
  const work=f.host.pick(f.candidate(),f.host.current().scopeId);await settle();
  assert.equal(f.host.close(f.host.current().scopeId),false);assert.equal(f.host.consumeBack(f.host.current().scopeId),true);
  assert.equal(f.host.blocksExit(origin),true);const count=f.effects.length;f.retire();gate.resolve();await work;
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.transactionId,TX);
  assert.equal(f.effects.length,count,'late ACK retained by owner without reopening retired reader');checks.push('commit-back-guard-retired-ACK-retained');
}
{
  const gate=deferred(),f=fixture({startGate:gate});await settle();
  const work=f.host.pick(f.candidate(),f.host.current().scopeId);await settle();f.retire();gate.resolve();await work;
  assert.equal(f.pending().length,0);assert.equal(f.host.current().write.confirmation,'undispatched');checks.push('dispatch-admission-refuses-retired-route');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(f.host.current().write.intentPending,true);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,0,'matching from/target is not an automatic compensation mandate');
  assert.equal(f.host.close(f.host.current().scopeId),false);assert.equal(f.host.blocksExit(origin),true);
  f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1,'readonly recovery never blindly replays commit');
  f.options.failExactQuery=false;f.host.retry(f.host.current().scopeId);await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
  assert.equal(f.effects.at(-1).kind,'targetReady');checks.push('lost-ACK-exact-readonly-confirmation-without-replay-or-compensation');
}
{
  const f=fixture({invalidChapter:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(f.host.current().write.transactionId,TX);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,0);checks.push('partial-envelope-preserves-opaque-journal-without-false-ACK');
}
{
  const f=fixture({preview:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.effects.at(-1).kind,'previewReady');assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  checks.push('preview-acquisition-keeps-shelf-transaction-unopened');
}
{
  const f=fixture(),scope=f.host.current().scopeId;await settle();const candidate=f.candidate();
  assert.equal(f.host.close(scope),true);assert.equal(f.host.open(f.context,f.lease),true);await settle();
  await f.host.pick(candidate,scope);f.host.refresh(scope);assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  assert.equal(f.host.current().visible,true);assert.equal(f.host.consumeBack(scope),false);checks.push('closed-reopened-scope-rejects-old-callbacks');
}
{
  const gate=deferred(),f=fixture({progressGate:gate});await settle();const work=f.host.pick(f.candidate(),f.host.current().scopeId);
  await settle();f.setIdentity({sourceId:'other',bookId:'book'});gate.resolve();await work;
  assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);checks.push('book-admission-before-durable-dispatch');
}
{
  const gate=deferred(),f=fixture({relatedGate:gate});await settle();
  f.setRows([{...rawCandidate,bookUrl:'newer'}]);f.publish({reset:false,identities:[{sourceId:'new',bookId:'newer'}]});
  gate.resolve();await settle();assert.equal(f.candidate().bookUrl,'newer');
  f.retire();assert.equal(f.subscriptions.size,0);checks.push('initial-snapshot-dirty-publication-sequence-and-unsubscribe');
}
{
  const f=fixture({throwObserver:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.transactionId,TX);
  checks.push('UI-observer-exception-does-not-compensate-confirmed-write');
}
{
  const gate=deferred(),f=fixture();await settle();
  const lane=new ReadingSessionFlowGateway('old','book',{kind:'remote'},f.runtime);
  const preceding=lane.runProgressCommitSerial(async()=>{await gate.promise;});
  const work=f.host.pick(f.candidate(),f.host.current().scopeId);await settle();
  assert.equal(f.calls.some(([method])=>method==='reading.progress.get'),false,'actual per-book producer lane must drain before reading the source anchor');
  assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  gate.resolve();await preceding;await work;assert.equal(f.host.current().write.confirmation,'confirmed');
  checks.push('same-production-per-book-progress-producer-lane');
}
for(const flag of ['startBeforeEffect','loseLocalSync','loseFinishAck']) {
  const f=fixture({[flag]:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false,'actual local journal ACK must precede Core mutation');
  assert.equal(f.host.current().write.confirmation,'undispatched');assert.equal(f.host.current().write.intentPending,true);
  if(flag==='loseFinishAck')assert.equal(f.disk.failWrites,0,'unknown finish must never call AtomicFile rollback after publication may have occurred');
  const assigned=f.intentClasses.SourceSwitchIntentStore.warmIntent;
  assert.equal(assigned.operationId,TX);assert.equal(assigned.sequence,1);
  f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.effects.at(-1).kind,'targetReady');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  assert.deepEqual(f.calls.find(([method])=>method==='source.switch.commit')[1],assigned.params,'retry uses the full originally assigned tuple');
  checks.push(`${flag}-same-fixed-tuple-after-real-journal-ACK`);
}
for(const loseSyncAt of [1,2]) {
  const f=fixture({loseSyncAt});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.intentPending,true);
  const before=f.calls.filter(([method])=>method==='source.switch.commit').length;
  assert.equal(before,loseSyncAt===1?0:1);
  if(loseSyncAt!==1)assert.equal(f.host.current().write.confirmation,'confirmed','ACK/query-confirmed Core result is independent of local confirm/clear lost ACK');
  f.options.loseSyncAt=undefined;f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.host.current().write.intentPending,false);assert.equal(f.host.current().write.confirmation,'confirmed');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  assert.equal(JSON.parse(f.disk.durable).phase,'confirmed');checks.push(`local-sync-${loseSyncAt}-lostACK-no-next-sequence-no-Core-duplicate`);
}
{
  const f=fixture({failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().write.intentPending,true);
  assert.equal(f.host.current().state.confirmation,'confirmed','saved-but-readback-failed is not rendered as commit failure');
  f.options.failExactQuery=false;f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.effects.at(-1).kind,'targetReady');assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  checks.push('confirmed-write-exact-refresh-failure-independent-facts');
}
{
  const f=fixture({startBeforeEffect:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.options.advanceMissingHead=true;f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.host.current().write.intentPending,true);assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  assert.equal(f.intentClasses.SourceSwitchIntentStore.warmIntent.operationId,TX,'head advance cannot reassign an uncertain accepted intent');
  checks.push('advanced-missing-exact-head-is-blocked-with-original-intent');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.retire();const successor={...f.runtime};setCurrentRuntime(successor);f.options.failExactQuery=false;
  const next=new f.Constructor(successor),delivered=[];assert.equal(next.open(f.context,{isCurrent:()=>true,changed(){},effect:e=>delivered.push(e)}),true);
  await settle();assert.equal(next.current().write.confirmation,'confirmed');assert.equal(next.current().write.intentPending,false);
  assert.equal(delivered.at(-1).kind,'canonicalReady','a replacement owner reads current canonical shelf rather than activating the old cached session');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);checks.push('warm-Runtime-handoff-reconciles-fixed-intent-no-old-activation');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  const fixed=JSON.parse(f.disk.durable);f.retire();f.intentClasses.SourceSwitchIntentStore.warmIntent=undefined;
  f.disk.published=f.disk.durable;const successor={...f.runtime};setCurrentRuntime(successor);f.options.failExactQuery=false;
  const next=new f.Constructor(successor),effects=[];next.open(f.context,{isCurrent:()=>true,changed(){},effect:e=>effects.push(e)});await settle();
  const exactRead=f.calls.filter(([method,params])=>method==='source.switch.transaction.query'&&params.expected).at(-1);
  assert.deepEqual(exactRead[1].expected,fixed.params,'cold recovery supplies the full original DTO to the Core hash query');
  assert.equal(next.current().write.confirmation,'confirmed');assert.equal(effects.at(-1).kind,'canonicalReady');
  assert.equal(JSON.parse(f.disk.durable).params.newToc.length,fixed.params.newToc.length);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);checks.push('cold-fixed-file-reload-exact-payload-no-replay');
}
{
  const gate=deferred(),f=fixture({syncGate:gate});await settle();
  const oldWork=f.host.pick(f.candidate(),f.host.current().scopeId);await settle();
  const fixed=f.intentClasses.SourceSwitchIntentStore.warmIntent;assert.ok(fixed);
  f.retire();const successor={...f.runtime};setCurrentRuntime(successor);
  const next=new f.Constructor(successor),effects=[];next.open(f.context,{isCurrent:()=>true,changed(){},effect:e=>effects.push(e)});await settle();
  assert.equal(f.calls.filter(([method,params])=>method==='source.switch.transaction.query'&&params.expected).length,0,'successor cannot read/replace authority while predecessor IO is still unresolved');
  gate.resolve();await oldWork;await settle();assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,0);
  assert.equal(next.current().write.intentPending,true);next.retry(next.current().scopeId);await settle();
  assert.equal(next.current().write.confirmation,'confirmed');assert.equal(effects.at(-1).kind,'canonicalReady');
  assert.deepEqual(f.calls.find(([method])=>method==='source.switch.commit')[1],fixed.params);
  checks.push('cross-Runtime-native-IO-tail-retains-same-intent-no-old-dispatch');
}
for(const chapters of [2000,6000]) {
  const longSession={...session,entries:Array.from({length:chapters},(_,index)=>({index,title:index===0?'Chapter 1':`第${index+1}章 长目录原有合法标题`,
    url:`https://target/${index}`,variables:[]}))};
  const f=fixture({targetSession:longSession});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.effects.at(-1).kind,'targetReady');
  assert.equal(f.calls.find(([method])=>method==='source.switch.commit')[1].newToc.length,chapters);
  assert.ok(f.disk.maximumCharacters>8192,'normal complete TOCs exceed the installed SDK Preferences limit');
  assert.equal(JSON.parse(f.disk.durable).params.newToc.length,chapters,'AtomicFile carries complete normal input without a new arbitrary byte cap');
  checks.push(`actual-full-DTO-${chapters}-chapters-retained-through-AtomicFile`);
}
for(const loseSyncAt of [3,4]) {
  const f=fixture({loseSyncAt});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);f.setPhase('finalized');
  f.host.targetCommitted(target,TX);await settle();assert.equal(f.host.current().write.confirmation,'confirmed');
  assert.equal(f.host.current().write.intentPending,true,'terminal confirm/clear lost ACK cannot admit another fixed intent');
  f.options.loseSyncAt=undefined;assert.equal(f.host.open(f.context,f.lease),true);await settle();
  assert.equal(f.host.current().write.intentPending,false);assert.equal(f.disk.durable,'');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  checks.push(`terminal-sync-${loseSyncAt}-unknown-retains-current-ID-until-exact-clear-ACK`);
}
{
  const f=fixture({readFailure:true});await settle();assert.equal(f.host.current().write.intentPending,true);
  assert.equal(f.host.current().write.confirmation,'unknown','unreadable prior authority cannot prove that Core was never sent');
  assert.equal(f.host.current().state.reconcile,true);assert.equal(f.host.close(f.host.current().scopeId),false);
  f.host.retry(f.host.current().scopeId);await settle();assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  checks.push('unreadable-authority-is-not-absent-or-new-write-admission');
}
{
  const f=fixture({loseCommitAck:true,corruptExactIdentity:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(f.host.current().write.intentPending,true);
  assert.equal(f.effects.some(e=>e.kind==='targetReady'),false);assert.equal(f.calls.some(([method])=>method==='source.switch.rollback'),false);
  checks.push('another-exact-ID-is-never-confirmation-or-compensation');
}
{
  const f=fixture();await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.setIdentity(target);assert.equal(f.host.bindReader({...f.context,query:{...f.context.query,sourceId:'new',bookId:'target'}},f.lease),true);
  f.options.loseRollbackAck=true;await f.host.rollbackPending();await settle();
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending,undefined);
  assert.equal(f.effects.at(-1).kind,'rollbackReady');assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,1);
  checks.push('reader-seam-rebind-lost-rollback-ACK-exact-phase-no-compensation-replay');
}
{
  const f=fixture();await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.setIdentity(target);f.host.bindReader({...f.context,query:{...f.context.query,sourceId:'new',bookId:'target'}},f.lease);
  f.options.loseRollbackAck=true;f.options.failExactQuery=true;await f.host.rollbackPending();await settle();
  assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(f.host.current().visible,true);
  const fixed=JSON.parse(f.disk.durable);assert.equal(fixed.operationId,TX);assert.equal(fixed.phase,'confirmed');
  f.retire();f.intentClasses.SourceSwitchIntentStore.warmIntent=undefined;const successor={...f.runtime};setCurrentRuntime(successor);
  f.options.failExactQuery=false;const next=new f.Constructor(successor),effects=[];
  next.open({...f.context,query:{...f.context.query,sourceId:'new',bookId:'target'}},{isCurrent:()=>true,changed(){},effect:e=>effects.push(e)});await settle();
  assert.equal(next.current().write.confirmation,'confirmed');assert.equal(next.current().write.action,'rollback');
  assert.equal(effects.at(-1).kind,'rollbackReady');assert.equal(effects.at(-1).book.sourceId,'old');assert.equal(f.disk.durable,'');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,1,'cold exact terminal query does not replay rollback');
  checks.push('cold-Runtime-lost-rollback-ACK-retains-original-full-intent');
}
{
  const f=fixture();await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.setIdentity(target);f.host.bindReader({...f.context,query:{...f.context.query,sourceId:'new',bookId:'target'}},f.lease);
  const restored=await f.host.prepareNextChoice(f.host.generation);
  assert.equal(restored.sourceId,'old');assert.equal(f.disk.durable,'');assert.equal(f.host.current().pending,undefined);
  assert.equal(f.host.open(f.context,f.lease),true);await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  const commits=f.calls.filter(([method])=>method==='source.switch.commit');assert.equal(commits.length,2);
  assert.equal(commits[1][1].sequence,2);assert.notEqual(commits[1][1].operationId,TX);
  const rollbackPosition=f.calls.findIndex(([method])=>method==='source.switch.rollback');
  assert.ok(rollbackPosition<f.calls.findIndex(([method,params])=>method==='source.switch.commit'&&params.sequence===2));
  checks.push('next-choice-actual-old-rollback-exact-terminal-clear-before-next-sequence');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  f.setPhase('rolledBack');f.options.failExactQuery=false;f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().write.action,'rollback');
  assert.equal(f.effects.at(-1).kind,'closed','actual startup rollback proof preserves the current original reader');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);checks.push('startup-rollback-phase-does-not-activate-historical-committed-book');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  const source=read('features/source/SourceSwitchWindow.ets'),p=boundedSurfaceSdk();

  const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
  const scope=f.host.current().scopeId;
  const deps=sourceSwitchLiveSdk(p,{ReaderWindowCoordinator:{metrics:()=>metrics}});
  const owner=p.consumer(source,boundedMembers(source,'SourceSwitchWindow'),deps,{state:f.host.current().state},'SourceSwitchWindow');
  owner.onRetry=()=>f.host.retry(scope);owner.onClose=()=>f.host.close(scope);
  f.lease.changed=snapshot=>{owner.updateStateVars({state:snapshot.state,currentSourceId:'old'});p.properties.flush();};
  owner.aboutToAppear();owner.initialRender();const nodes=p.nodes(owner);
  assert.ok(nodes.some(node=>node.type==='Text'&&node.create==='换源结果未确认'));
  assert.equal(nodes.some(node=>node.type==='Text'&&node.create==='换源失败'),false,'unknown Core must not render a failed-commit title');
  const retry=nodes.find(node=>node.type==='Button'&&node.createWithLabel?.[0]==='重试核对');assert.ok(retry?.onClick);
  const originalFrame=[...owner.nodes.values()].find(node=>node.type==='Stack'&&node.width==='100%'&&node.height==='100%');
  assert.ok(originalFrame,'the approved live picker retains one full-viewport owner');
  const frames=p.walk(owner).filter(child=>child instanceof p.deps.ReaderBoundedSurface);
  assert.equal(frames.length,1,'the live picker has one shared bounded drawer frame');
  assert.equal(frames[0].specId,'source-switch-drawer','shared composition cannot restore the retired 385vp popup');
  const oldRetry=owner.onRetry;f.options.failExactQuery=false;retry.onClick();await settle();p.properties.flush();
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.effects.at(-1).kind,'targetReady');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  assert.equal([...owner.nodes.values()].find(node=>node.type==='Stack'&&node.width==='100%'&&node.height==='100%').id,originalFrame.id,'actual property updates retain the full-viewport frame');
  assert.equal(f.host.open(f.context,f.lease),true);await settle();oldRetry();await settle();
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1,'old SDK-consumer callback cannot dispatch in the reopened scope');
  checks.push('actual-SDK-Host-to-live-picker-honest-state-recovery-and-old-callback');
}
// A keyword search can return recommendations before the complete relation
// projection finishes. Neither those rows nor a global acquisition event may
// become a selectable alternate book during that interval.
{
  const f=fixture({open:false}),slow=deferred(),base=f.runtime.request.bind(f.runtime),wrong={
    sourceId:'other',bookUrl:'/recommendation',bookName:'跳出轮回',author:'Writer',category:'novel',sourceVersion:'v1'};
  f.context.knownCandidates=[wrong];
  f.runtime.request=async(method,params,options)=>{
    if(method==='source.list')return{data:{sources:['old','new','other','slow'].map(sourceId=>
      ({sourceId,name:sourceId,enabled:true,sourceVersion:'v1'}))}};
    if(method==='book.search'){
      assert.equal(params.page,1);if(params.sourceId==='slow')await slow.promise;
      return{data:{sourceId:params.sourceId,sourceVersion:'v1',contentKind:'text',books:params.sourceId==='other'?
        [{bookId:wrong.bookUrl,title:wrong.bookName,author:wrong.author,variables:{}},
          {bookId:'/same-title-wrong-author',title:'Book',author:'Other Writer',variables:{}}]:[]}};
    }
    if(method==='search-book.batch.get')return{data:{complete:true,books:params.identities.filter(value=>value.sourceId==='other').map(value=>
      ({origin:value.sourceId,bookUrl:value.bookId,name:wrong.bookName,author:wrong.author,time:Date.now(),acquisition:{sourceVersion:'v1'}})),
      missing:params.identities.filter(value=>value.sourceId!=='other')}};
    return base(method,params,options);
  };
  assert.equal(f.host.open(f.context,f.lease),true);await settle();
  assert.ok(f.changes.every(value=>value.state.candidates?.every(candidate=>candidate.sourceId!=='other')!==false),
    'unconfirmed known rows cannot flash into the first paint');
  f.host.refresh(f.host.current().scopeId);await settle();
  f.publish({reset:false,identities:[{sourceId:'other',bookId:wrong.bookUrl}]});
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(f.host.current().state.refreshing,true);
  assert.ok(f.host.current().state.candidates.every(candidate=>candidate.sourceId!=='other'),
    'raw recommendation and unrelated acquisition delta remain absent while another source is pending');
  await f.host.pick(wrong,f.host.current().scopeId);
  assert.equal(f.calls.some(([method])=>method==='acquire'||method==='source.switch.commit'),false);
  slow.resolve();await new Promise(resolve=>setTimeout(resolve,150));await settle();f.retire();
  checks.push('keyword-recommendations-wrong-author-and-global-acquisition-delta-never-selectable');
}
// A source can misparse a detail response while keeping the same source+URL.
// Compare resolved title/author before either preview delivery or shelf write.
{
  const f=fixture({open:false});
  f.context.query={...f.context.query,bookName:'大明望族',author:'府天'};
  const valid={...rawCandidate,name:'大明望族',author:'府天'};
  const polluted={...rawCandidate,bookUrl:'/jump',name:'跳出轮回',author:'另一位作者',
    acquisition:{sourceVersion:'v1',aliases:[{name:'大明望族',author:'府天'}]}};
  f.setRows([valid,polluted]);assert.equal(f.host.open(f.context,f.lease),true);await settle();
  assert.deepEqual(f.host.current().state.candidates.map(value=>value.bookName),['大明望族'],
    'the exact same persisted relation can contain a polluted alias without making it selectable');
  await f.host.pick({sourceId:'new',bookUrl:'/jump',bookName:'跳出轮回',author:'另一位作者',category:'novel'},f.host.current().scopeId);
  assert.equal(f.calls.some(([method])=>method==='acquire'||method==='source.switch.commit'),false);
  f.retire();checks.push('persisted-polluted-same-relation-alias-never-authorizes-another-book');
}
for(const preview of [true,false]) {
  const wrong={...session,book:{...session.book,title:'跳出轮回'}};
  const f=fixture({preview,targetSession:wrong});await settle();
  await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.effects.at(-1).kind,'acquisitionFailed');
  assert.match(f.effects.at(-1).message,/书名或作者.*不一致/);
  assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false,
    'same URL alone cannot authorize switching to an unrelated detail title');
  assert.equal(f.effects.some(value=>value.kind==='previewReady'||value.kind==='targetReady'),false);
  f.retire();
  checks.push(`${preview?'preview':'shelf'}-same-URL-mismatched-detail-blocked-before-delivery-or-write`);
}
{
  const f=fixture({open:false,targetSession:{...session,contentKind:'manga',book:{...session.book,title:'另一部漫画'}}});
  const candidate={sourceId:'new',bookUrl:'target',bookName:'Book',author:'Writer',category:'comic'};
  await assert.rejects(f.host.prepareMangaPreview(candidate,()=>true),/书名或作者.*不一致/);
  assert.equal(f.calls.some(([method])=>method==='source.switch.commit'),false);
  f.retire();checks.push('manga-preview-same-URL-mismatched-detail-blocked-before-admission');
}
// Installed SDK parses the full new production owner. Native rendering and
// scheduler/SDK-send proof are separate tiers; this probe does not claim them.
const require=createRequire(import.meta.url),etsRoot=resolveEtsLoaderRoot();
const ts=require(`${etsRoot}/node_modules/typescript`),opts=require(`${etsRoot}/lib/ets_checker.js`).compilerOptions;
for(const name of ['SourceSwitchHost','SourceSwitchGateway','SourceSwitchIntentStore']) {
  const tree=ts.createSourceFile(virtualFilePath(`${name}.ts`),read(`features/source/${name}.ts`),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,opts);
  assert.equal(tree.parseDiagnostics.length,0,`${name} actual installed SDK syntax`);
}
{
  const release=`    if (this.pickQualification !== undefined || this.previewPreparation !== undefined) {\n      this.pickQualification = undefined;\n      this.previewPreparation = undefined;\n      this.snapshot = { ...this.snapshot, state: { kind: 'discovering' } };\n    }\n`;
  const unsafeRetire=hostSource.replace(release,'');assert.notEqual(unsafeRetire,hostSource);
  const {f,gate,work}=await pendingQualificationFixture(unsafeRetire);f.host.retire();
  assert.equal(f.host.current().state.kind,'switching');assert.equal(f.host.open(f.context,f.lease),false,
    'negative control reproduces the stale switching lock before qualification IO ends');
  gate.resolve();await work;f.retire();checks.push('negative-control-retire-without-phase-release-reproduces-stuck-switching');
}
{
  const unsafeFinally=hostSource.replace('if (this.pickQualification === qualification)', 'if (true)');assert.notEqual(unsafeFinally,hostSource);
  const {f,gate,scope,work}=await pendingQualificationFixture(unsafeFinally);
  assert.equal(f.host.close(scope),true);assert.equal(f.host.open(f.context,f.lease),true);await settle();
  assert.equal(f.host.current().visible,true);assert.equal(f.host.current().state.kind,'candidates');
  gate.resolve();await work;assert.equal(f.host.current().visible,false,
    'negative control proves an unowned finally can hide a successor scope');
  f.retire();checks.push('negative-control-unowned-qualification-finally-hides-successor-scope');
}
{
  const broken=hostSource.replace('if (this.previewPreparation === preparation)', 'if (true)');assert.notEqual(broken,hostSource);
  const gate=deferred(),f=fixture({preview:true,acquireGate:gate},broken);await settle();
  const work=f.host.pick(f.candidate(),f.host.current().scopeId);
  await untilOwner(()=>f.calls.some(([method])=>method==='acquire'));
  assert.equal(f.host.close(f.host.current().scopeId),true);assert.equal(f.host.open(f.context,f.lease),true);await settle();
  gate.resolve();await work;assert.equal(f.host.current().visible,false,'negative control: unowned preview finally hides the successor');
  f.retire();checks.push('negative-control-unowned-preview-finally-hides-successor');
}
{
 const f=fixture({preview:true,failAcquire:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
 assert.equal(f.host.current().failureMessage,'换源暂时未完成，请重试或选择其他书源。');
 for(const raw of ['https://private.invalid/?token=PRIVATE','/private/user/file SQLITE_ERROR','无类型的私有上游正文']){
  const error=Error(raw);assert.doesNotMatch(f.host.publicFailure(error),/PRIVATE|private|SQLITE|私有上游/);
  assert.equal(f.host.lastFailure,error,'private diagnostic is retained without entering snapshot');
 }
 const typed=new f.intentClasses.SourceSwitchIntentRecoveryError('blocked','换源回执与原标识不一致，已保留并停止覆盖');
 assert.equal(f.host.publicFailure(typed),typed.message);f.retire();
 checks.push('public-source-failure-classifies-unknown-and-retains-private-diagnostic-with-typed-recovery-copy');
}
const unsafe=hostSource.replace('if (!current()) return;\n    this.snapshot = { ...this.snapshot, write:',
  'if (!current()) return;\n    if (observed.length === 1) await this.gateway.rollbackSwitch(observed[0].transactionId, current, new ReaderWriteEvidence());\n    this.snapshot = { ...this.snapshot, write:');
assert.notEqual(unsafe,hostSource);
{
  const f=fixture({loseCommitAck:true,failExactQuery:true},unsafe);await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  await f.host.reconcileUnknown(f.host.current().write.generation,{sourceId:'new',bookUrl:'target'});
  assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,1,
    'negative control reproduces the old identity-only automatic rollback on actual Gateway calls');
}
{
  const unsafeScopes=hostSource.replace('scopeId === this.snapshot.scopeId && this.currentLease()', 'this.currentLease()');
  const f=fixture({},unsafeScopes),scope=f.host.current().scopeId;await settle();const candidate=f.candidate();
  f.host.close(scope);f.host.open(f.context,f.lease);await settle();await f.host.pick(candidate,scope);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1,
    'negative control proves an old closure can mutate the reopened scope without the actual generation admission');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual full SourceSwitchHost/Gateway/IntentStore + actual progress lane/gateway; installed SDK exported full-viewport picker and actual live-row V1 state/closure propagation; runtime and AtomicFile IO are controlled fixtures; actual OS atomic/fsync, focus and layout remain unverified'}));
