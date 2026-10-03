import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import * as horizontal from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { registerHooks, stripTypeScriptTypes, createRequire } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingSessionFlowGateway } = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const content = await import('../entry/src/main/ets/features/reading/RemoteContentAdmission.ts');
const errors = await import('../entry/src/main/ets/app/ErrorMessage.ts');
const metadata = await import('../entry/src/main/ets/features/common/BookAuthorMetadata.ts');
const acquisition = await import('../entry/src/main/ets/features/common/BookAcquisitionPresentation.ts');
const category = await import('../entry/src/main/ets/features/source/ReaderSourceCategory.ts');
const scheduler = await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const { ReaderWriteEvidence } = await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const repo=fileURLToPath(new URL('../',import.meta.url)),siblingCore=resolve(repo,'../Reader-Core-Native');
const coreRoot=process.env.READER_SOURCE_SWITCH_CORE_ROOT??(existsSync(resolve(siblingCore,'bindings/harmony/sdk/reader_core.ts'))
  ?siblingCore:resolve(repo,'../../../Reader-Core-Native'));
const sdk = await import(pathToFileURL(resolve(coreRoot,'bindings/harmony/sdk/reader_core.ts')).href);
const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const compile = (source, name, deps) => new Function(...Object.keys(deps),
  stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '')).replace(/\bexport /g, '') + `;return ${name};`)(...Object.values(deps));
let currentRuntime;
const Runtime = { current: () => currentRuntime, isCurrent: runtime => currentRuntime === runtime && !runtime.closed };
const common = { ReaderRuntimeOwner: Runtime, ...sdk, ...errors, ...metadata, ...acquisition, ...category, ...scheduler };
const Gateway = compile(read('features/source/SourceSwitchGateway.ts'), 'SourceSwitchGateway', common);
const Core = compile(read('app/ReaderCoreGateway.ts'), 'ReaderCoreGateway', common);
const gatewayExports = compile(read('features/source/SourceSwitchGateway.ts'),
  '{buildSourceSwitchCommitParams,sourceSwitchCandidateKey}', common);
const hostSource = read('features/source/SourceSwitchHost.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; });return{promise,resolve,reject}; };
const settle = async () => { for(let i=0;i<50;i++) await Promise.resolve(); };
const origin = {sourceId:'old',bookId:'book',title:'Book',author:'Writer',addedAt:1,sortIndex:0};
const target = {...origin,sourceId:'new',bookId:'target'};
const rawCandidate = {origin:'new',bookUrl:'target',name:'Book',author:'Writer',time:Math.floor(Date.now()/1000),
  relationKey:'same-book',relationRevision:'1',sourceVersion:'v1'};
const session = {identity:{sourceId:'new',bookId:'target'},book:{title:'Book',author:'Writer'},sourceVersion:'v1',
  tocUrl:'https://target/toc',continuationVariables:[],entries:[{index:0,title:'Chapter 1',url:'https://target/0',variables:[]}]};
function fixture(options={},productionSource=hostSource) {
  const calls=[],changes=[],effects=[],subscriptions=new Set();
  let live=true,identity={sourceId:'old',bookId:'book'},pending=options.pending??[],rows=[rawCandidate],head,transaction,uuid=0;
  const disk={published:undefined,durable:undefined,syncs:0,finishes:0,failWrites:0,opens:[],maximumCharacters:0};
  const fileIo={OpenMode:{READ_ONLY:0,READ_WRITE:2},
    async readText(){if(options.readFailure)throw {code:13900012};if(disk.published===undefined)throw {code:13900002};return disk.published;},
    async open(path){disk.opens.push(path);return{fd:path};},async close(){},
    async fsync(fd){if(fd==='/private-files'){
      disk.syncs++;if(options.syncGate){const gate=options.syncGate;options.syncGate=undefined;await gate.promise;}
      if(options.loseLocalSync){options.loseLocalSync=false;throw Error('local directory sync ACK lost');}
      disk.durable=disk.published;if(options.loseSyncAt===disk.syncs)throw Error('directory sync ACK after durable effect lost');
    }},
    AtomicFile:class {
      startWrite(){if(options.startBeforeEffect){options.startBeforeEffect=false;throw Error('startWrite-before-side-effect');}
        return{on(){},end:(raw,_encoding,callback)=>{this.raw=raw;disk.maximumCharacters=Math.max(disk.maximumCharacters,raw.length);queueMicrotask(callback);}};}
      finishWrite(){disk.finishes++;disk.published=this.raw;if(options.loseFinishAck){options.loseFinishAck=false;throw Error('AtomicFile published but finish ACK lost');}}
      failWrite(){disk.failWrites++;}
    }};
  const replaceReaderAtomicSnapshot=compile(read('app/ReaderAtomicSnapshotFile.ts'),'replaceReaderAtomicSnapshot',{fileIo});
  const intentClasses=compile(read('features/source/SourceSwitchIntentStore.ts'),'{SourceSwitchIntentStore,SourceSwitchIntentRecoveryError}',
    {...common,SourceSwitchGateway:Gateway,util:{generateRandomUUID:()=> `00000000-0000-4000-8000-${String(++uuid).padStart(12,'0')}`},fileIo,replaceReaderAtomicSnapshot});
  const ProductionHost=compile(productionSource,'SourceSwitchHost',{...common,...gatewayExports,SourceSwitchGateway:Gateway,
    ReaderCoreGateway:Core,ReadingSessionFlowGateway,RemoteReadingFlowGateway,...content,ReaderWriteEvidence,...intentClasses});
  const runtime={closed:false,getUIAbilityContext:()=>({filesDir:'/private-files'}), bookAcquisitions:()=>({sourceRegistryRevision:()=>1,
    subscribe(callback){subscriptions.add(callback);return()=>subscriptions.delete(callback);},
    async acquireBook(seed,admission){calls.push(['acquire',seed]);if(options.acquireGate)await options.acquireGate.promise;
      if(!admission.isCurrent())throw Error('retired acquisition');return options.targetSession??session;}}),
    async request(method,params,requestOptions={}) {
      calls.push([method,params,requestOptions]);
      // Controlled startup/native fixture. The production Runtime's exact
      // SDK-send admission is separately covered by its boundary probe.
      if(method==='source.switch.commit'||method==='source.switch.rollback') {
        if(options.startGate)await options.startGate.promise;
        if(requestOptions.canContinue?.()===false||requestOptions.canDispatch?.()===false) throw new scheduler.BookRequestNotDispatchedError('not dispatched');
        requestOptions.onDispatch?.();
        assert.equal(requestOptions.shouldCancel,undefined,'durable polling must not acquire a UI cancellation producer');
      } else if(requestOptions.shouldCancel?.()) throw Error('retired read');
      if(method==='source.list')return{data:{sources:[{sourceId:'old',name:'Old',enabled:true,sourceVersion:'v1'},
        {sourceId:'new',name:'New',enabled:true,sourceVersion:'v1'}]}};
      if(method==='search-book.related'){
        if(options.relatedGate){const gate=options.relatedGate;options.relatedGate=undefined;await gate.promise;}
        if(options.failRelated)throw Error('snapshot unavailable');
        return{data:{books:rows,snapshotRevision:'s1',complete:true,sourceVersions:[{sourceId:'new',sourceVersion:'v1',enabled:true}]}};
      }
      if(method==='change.bookSource')return{data:{candidates:[]}};
      if(method==='source.switch.pending.list')return{data:{pending:pending.map(row=>({...row,phase:'pending',
        from:{sourceId:row.fromSourceId,bookId:row.fromBookId},target:{sourceId:row.targetSourceId,bookId:row.targetBookId}}))}};
      if(method==='source.switch.transaction.query') {
        if(options.failExactQuery && transaction)throw Error('exact query unavailable');
        if(options.advanceMissingHead)return{data:{head:{operationId:'other',sequence:2},transaction:null}};
        const exact=transaction?.operationId===params.operationId?transaction:null;
        return{data:{head:head??null,transaction:exact&&options.corruptExactIdentity?{...exact,operationId:'another-operation'}:exact}};
      }
      if(method==='reading.progress.get'){
        if(options.progressGate)await options.progressGate.promise;
        return{data:{found:true,progressRevision:'r1',progress:{sourceId:identity.sourceId,bookId:identity.bookId,
          chapterIndex:0,chapterOffset:0,chapterProgress:0,updatedAt:1}}};
      }
      if(method==='bookshelf.get')return{data:{book:params.sourceId==='new'?target:origin}};
      if(method==='source.switch.commit') {
        if(options.commitGate)await options.commitGate.promise;
        const txn={transactionId:params.operationId,fromSourceId:params.from.sourceId,fromBookId:params.from.bookId,
          targetSourceId:params.target.sourceId,targetBookId:params.target.bookId};
        pending.push(txn);head={operationId:params.operationId,sequence:params.sequence};
        const commit={transactionId:txn.transactionId,phase:'pending',book:target,
          matchedChapter:options.invalidChapter?{order:-1}:{chapterId:'https://target/0',chapterTitle:'Chapter 1',chapterUrl:'https://target/0',order:0}};
        transaction={operationId:params.operationId,sequence:params.sequence,payloadFingerprint:'a'.repeat(64),
          from:params.from,target:{sourceId:params.target.sourceId,bookId:params.target.bookId},phase:'pending',commit};
        if(options.loseCommitAck)throw Error('commit ACK lost');
        return{data:commit};
      }
      if(method==='source.switch.rollback') {
        if(options.rollbackGate)await options.rollbackGate.promise;
        pending=pending.filter(row=>row.transactionId!==params.transactionId);
        if(transaction?.operationId===params.transactionId)transaction={...transaction,phase:'rolledBack',restoredBook:origin};
        if(options.loseRollbackAck)throw Error('rollback ACK lost');
        return{data:{transactionId:params.transactionId,phase:'rolledBack',changed:true,restoredBook:origin}};
      }
      assert.fail(`unhandled actual gateway request ${method}`);
    }};
  currentRuntime=runtime;
  const host=new ProductionHost(runtime),context={query:{sourceId:'old',bookId:'book',bookName:'Book',author:'Writer',
    currentChapterIndex:0,currentChapterTitle:'Chapter 1'},inBookshelf:options.preview!==true,
    toc:[{chapterIndex:0,chapterTitle:'Chapter 1'}],knownCandidates:[],searchedSourceIds:[]};
  const lease={isCurrent:book=>live&&book.sourceId===identity.sourceId&&book.bookId===identity.bookId,
    changed:snapshot=>changes.push(snapshot),effect:effect=>{effects.push(effect);
      if(effect.kind==='restoredForNextChoice')identity={sourceId:effect.book.sourceId,bookId:effect.book.bookId};
      if(options.throwObserver)throw Error('observer threw');}};
  assert.equal(host.open(context,lease),true);
  return{host,runtime,context,lease,calls,changes,effects,options,subscriptions,Constructor:ProductionHost,intentClasses,
    disk,setPhase:phase=>{transaction={...transaction,phase,...(phase==='rolledBack'?{restoredBook:origin}:{})};},
    retire:()=>{live=false;host.retire();},setIdentity:value=>{identity=value;},setRows:value=>{rows=value;},
    publish:change=>{for(const subscriber of subscriptions)subscriber(change);},pending:()=>pending,
    candidate:()=>host.current().state.candidates?.[0]};
}
const checks=[];
const TX='00000000-0000-4000-8000-000000000001';
{
  const f=fixture();await settle();const owner=f.Constructor.forRuntime(f.runtime);
  assert.equal(f.Constructor.forRuntime(f.runtime),owner,'Index remount shares one actual feature owner');
  const successor={...f.runtime};currentRuntime=successor;const next=f.Constructor.forRuntime(successor);
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
  f.retire();const successor={...f.runtime};currentRuntime=successor;f.options.failExactQuery=false;
  const next=new f.Constructor(successor),delivered=[];assert.equal(next.open(f.context,{isCurrent:()=>true,changed(){},effect:e=>delivered.push(e)}),true);
  await settle();assert.equal(next.current().write.confirmation,'confirmed');assert.equal(next.current().write.intentPending,false);
  assert.equal(delivered.at(-1).kind,'canonicalReady','a replacement owner reads current canonical shelf rather than activating the old cached session');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);checks.push('warm-Runtime-handoff-reconciles-fixed-intent-no-old-activation');
}
{
  const f=fixture({loseCommitAck:true,failExactQuery:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  const fixed=JSON.parse(f.disk.durable);f.retire();f.intentClasses.SourceSwitchIntentStore.warmIntent=undefined;
  f.disk.published=f.disk.durable;const successor={...f.runtime};currentRuntime=successor;f.options.failExactQuery=false;
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
  f.retire();const successor={...f.runtime};currentRuntime=successor;
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
  f.retire();f.intentClasses.SourceSwitchIntentStore.warmIntent=undefined;const successor={...f.runtime};currentRuntime=successor;
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
  p.hooks.childSources.CandidateRow=read('features/source/CandidateRow.ets');
  const metrics=metricsApi.createDefaultReaderWindowMetrics();metrics.windowRect=new metricsApi.ReaderRectVp(0,0,390,844);
  const scope=f.host.current().scopeId;
  const owner=p.consumer(source,boundedMembers(source),{...horizontal,...metricsApi,
    ReaderWindowCoordinator:{metrics:()=>metrics},registerReaderFonts(){},...gatewayExports,
    sourceSwitchSourceCount:candidates=>candidates.length},{state:f.host.current().state});
  owner.onRetry=()=>f.host.retry(scope);owner.onClose=()=>f.host.close(scope);
  f.lease.changed=snapshot=>{owner.updateStateVars({state:snapshot.state,currentSourceId:'old'});p.properties.flush();};
  owner.initialRender();const nodes=p.nodes(owner);
  assert.ok(nodes.some(node=>node.type==='Text'&&node.create==='换源结果未确认'));
  assert.equal(nodes.some(node=>node.type==='Text'&&node.create==='换源失败'),false,'unknown Core must not render a failed-commit title');
  const retry=nodes.find(node=>node.type==='Text'&&node.create==='重试核对');assert.ok(retry?.onClick);
  const frame=p.walk(owner).find(child=>child instanceof p.deps.ReaderBoundedSurface);
  const originalFrame=[...frame.nodes.values()].find(node=>node.type==='Column');assert.equal(originalFrame.height,385);
  const oldRetry=owner.onRetry;f.options.failExactQuery=false;retry.onClick();await settle();p.properties.flush();
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.effects.at(-1).kind,'targetReady');
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1);
  assert.equal([...frame.nodes.values()].find(node=>node.type==='Column').id,originalFrame.id,'actual property updates retain the bounded frame');
  assert.equal(f.host.open(f.context,f.lease),true);await settle();oldRetry();await settle();
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1,'old SDK-consumer callback cannot dispatch in the reopened scope');
  checks.push('actual-SDK-Host-to-bounded-frame-honest-state-recovery-and-old-callback');
}
// Installed SDK parses the full new production owner. Native rendering and
// scheduler/SDK-send proof are separate tiers; this probe does not claim them.
const require=createRequire(import.meta.url),etsRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${etsRoot}/node_modules/typescript`),opts=require(`${etsRoot}/lib/ets_checker.js`).compilerOptions;
for(const name of ['SourceSwitchHost','SourceSwitchGateway','SourceSwitchIntentStore']) {
  const tree=ts.createSourceFile(`/tmp/${name}.ts`,read(`features/source/${name}.ts`),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,opts);
  assert.equal(tree.parseDiagnostics.length,0,`${name} actual installed SDK syntax`);
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
console.log(JSON.stringify({status:'PASS',checks,scope:'actual full SourceSwitchHost/Gateway/IntentStore + actual progress lane/gateway; installed SDK bounded V1 state/closure propagation; runtime and AtomicFile IO are controlled fixtures; actual OS atomic/fsync, focus and layout remain unverified'}));
