import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks, stripTypeScriptTypes, createRequire } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); } catch (error) {
    if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReadingSessionFlowGateway } = await import('../../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const { RemoteReadingFlowGateway } = await import('../../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const { MangaAdmissionGateway } = await import('../../entry/src/main/ets/features/manga/MangaAdmissionGateway.ts');
const content = await import('../../entry/src/main/ets/features/reading/RemoteContentAdmission.ts');
const errors = await import('../../entry/src/main/ets/app/ErrorMessage.ts');
const metadata = await import('../../entry/src/main/ets/features/common/BookAuthorMetadata.ts');
const acquisition = await import('../../entry/src/main/ets/features/common/BookAcquisitionPresentation.ts');
const category = await import('../../entry/src/main/ets/features/source/ReaderSourceCategory.ts');
const scheduler = await import('../../entry/src/main/ets/app/BookRequestScheduler.ts');
const { ReaderWriteEvidence } = await import('../../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const repo=fileURLToPath(new URL('../../',import.meta.url)),siblingCore=resolve(repo,'../Reader-Core-Native');
const coreRoot=process.env.READER_SOURCE_SWITCH_CORE_ROOT??(existsSync(resolve(siblingCore,'bindings/harmony/sdk/reader_core.ts'))
  ?siblingCore:resolve(repo,'../../Reader-Core-Native'));
const sdk = await import(pathToFileURL(resolve(coreRoot,'bindings/harmony/sdk/reader_core.ts')).href);
export const read = path => readFileSync(new URL(`../../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const compile = (source, name, deps) => new Function(...Object.keys(deps),
  stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '')).replace(/\bexport /g, '') + `;return ${name};`)(...Object.values(deps));
let currentRuntime;
export const setCurrentRuntime=value=>{currentRuntime=value;};
export const Runtime = { current: () => currentRuntime, isCurrent: runtime => currentRuntime === runtime && !runtime.closed };
const common = { ReaderRuntimeOwner: Runtime, ...sdk, ...errors, ...metadata, ...acquisition, ...category, ...scheduler };
export const ReaderCoreRequestError = sdk.ReaderCoreRequestError;
export const Gateway = compile(read('features/source/SourceSwitchGateway.ts'), 'SourceSwitchGateway', common);
export const Core = compile(read('app/ReaderCoreGateway.ts'), 'ReaderCoreGateway', common);
export const gatewayExports = compile(read('features/source/SourceSwitchGateway.ts'),
  '{buildSourceSwitchCommitParams,sourceSwitchCandidateKey}', common);
export const hostSource = read('features/source/SourceSwitchHost.ts');
export const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; });return{promise,resolve,reject}; };
export const settle = async () => { for(let i=0;i<50;i++) await Promise.resolve(); };
export const origin = {sourceId:'old',bookId:'book',title:'Book',author:'Writer',addedAt:1,sortIndex:0};
export const target = {...origin,sourceId:'new',bookId:'target'};
export const rawCandidate = {origin:'new',bookUrl:'target',name:'Book',author:'Writer',time:Math.floor(Date.now()/1000),
  relationKey:'same-book',relationRevision:'1',sourceVersion:'v1'};
export const session = {identity:{sourceId:'new',bookId:'target'},book:{title:'Book',author:'Writer'},sourceVersion:'v1',
  tocUrl:'https://target/toc',continuationVariables:[],entries:[{index:0,title:'Chapter 1',url:'https://target/0',variables:[]}]};
export function fixture(options={},productionSource=hostSource) {
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
    ReaderCoreGateway:Core,ReadingSessionFlowGateway,RemoteReadingFlowGateway,MangaAdmissionGateway,...content,ReaderWriteEvidence,...intentClasses});
  const runtime={closed:false,getUIAbilityContext:()=>({filesDir:'/private-files'}), bookAcquisitions:()=>({sourceRegistryRevision:()=>1,
    subscribe(callback){subscriptions.add(callback);return()=>subscriptions.delete(callback);},
    async acquireBook(seed,admission){calls.push(['acquire',seed]);if(options.acquireGate)await options.acquireGate.promise;
      if(!admission.isCurrent())throw Error('retired acquisition');
      if(options.failAcquire)throw Error('body unavailable');return options.targetSession??session;}}),
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
          matchedChapter:options.invalidChapter?{order:-1}:{chapterId:'https://target/0',chapterTitle:options.targetSession?.entries[0].title??'Chapter 1',chapterUrl:'https://target/0',order:options.matchedChapterIndex??0}};
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
  const host=options.shared?ProductionHost.forRuntime(runtime):new ProductionHost(runtime),context={query:{sourceId:'old',bookId:'book',bookName:'Book',author:'Writer',
    currentChapterIndex:0,currentChapterTitle:'Chapter 1'},inBookshelf:options.preview!==true,
    toc:[{chapterIndex:0,chapterTitle:'Chapter 1'}],knownCandidates:[],searchedSourceIds:[]};
  const lease={isCurrent:book=>live&&book.sourceId===identity.sourceId&&book.bookId===identity.bookId,
    changed:snapshot=>changes.push(snapshot),effect:effect=>{effects.push(effect);
      if(effect.kind==='restoredForNextChoice')identity={sourceId:effect.book.sourceId,bookId:effect.book.bookId};
      if(options.throwObserver)throw Error('observer threw');}};
  if(options.open!==false)assert.equal(host.open(context,lease),true);
  return{host,runtime,context,lease,calls,changes,effects,options,subscriptions,Constructor:ProductionHost,intentClasses,
    disk,setPhase:phase=>{transaction={...transaction,phase,...(phase==='rolledBack'?{restoredBook:origin}:{})};},
    retire:()=>{live=false;host.retire();},setIdentity:value=>{identity=value;},setRows:value=>{rows=value;},
    publish:change=>{for(const subscriber of subscriptions)subscriber(change);},pending:()=>pending,
    candidate:()=>host.current().state.candidates?.[0]};
}

export {ReadingSessionFlowGateway,RemoteReadingFlowGateway};
