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
const Host = compile(hostSource, 'SourceSwitchHost', { ...common, ...gatewayExports,
  SourceSwitchGateway: Gateway, ReaderCoreGateway: Core, ReadingSessionFlowGateway,
  RemoteReadingFlowGateway, ...content, ReaderWriteEvidence });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; });return{promise,resolve,reject}; };
const settle = async () => { for(let i=0;i<50;i++) await Promise.resolve(); };
const origin = {sourceId:'old',bookId:'book',title:'Book',author:'Writer',addedAt:1};
const target = {...origin,sourceId:'new',bookId:'target'};
const rawCandidate = {origin:'new',bookUrl:'target',name:'Book',author:'Writer',time:Math.floor(Date.now()/1000),
  relationKey:'same-book',relationRevision:'1',sourceVersion:'v1'};
const session = {identity:{sourceId:'new',bookId:'target'},book:{title:'Book',author:'Writer'},sourceVersion:'v1',
  tocUrl:'https://target/toc',continuationVariables:[],entries:[{index:0,title:'Chapter 1',url:'https://target/0',variables:[]}]};
function fixture(options={},ProductionHost=Host) {
  const calls=[],changes=[],effects=[],subscriptions=new Set();
  let live=true,identity={sourceId:'old',bookId:'book'},pending=options.pending??[],rows=[rawCandidate];
  const runtime={closed:false, bookAcquisitions:()=>({sourceRegistryRevision:()=>1,
    subscribe(callback){subscriptions.add(callback);return()=>subscriptions.delete(callback);},
    async acquireBook(seed,admission){calls.push(['acquire',seed]);if(options.acquireGate)await options.acquireGate.promise;
      if(!admission.isCurrent())throw Error('retired acquisition');return session;}}),
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
      if(method==='reading.progress.get'){
        if(options.progressGate)await options.progressGate.promise;
        return{data:{found:true,progressRevision:'r1',progress:{sourceId:identity.sourceId,bookId:identity.bookId,
          chapterIndex:0,chapterOffset:0,chapterProgress:0,updatedAt:1}}};
      }
      if(method==='bookshelf.get')return{data:{book:origin}};
      if(method==='source.switch.commit') {
        if(options.commitGate)await options.commitGate.promise;
        const txn={transactionId:'tx-accepted',fromSourceId:params.from.sourceId,fromBookId:params.from.bookId,
          targetSourceId:params.target.sourceId,targetBookId:params.target.bookId};
        pending.push(txn);
        if(options.loseCommitAck)throw Error('commit ACK lost');
        return{data:{transactionId:txn.transactionId,phase:'pending',book:target,
          matchedChapter:options.invalidChapter?{order:-1}:{chapterId:'https://target/0',chapterTitle:'Chapter 1',chapterUrl:'https://target/0',order:0}}};
      }
      if(method==='source.switch.rollback') {
        if(options.rollbackGate)await options.rollbackGate.promise;
        pending=pending.filter(row=>row.transactionId!==params.transactionId);
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
  return{host,runtime,context,lease,calls,changes,effects,options,subscriptions,
    retire:()=>{live=false;host.retire();},setIdentity:value=>{identity=value;},setRows:value=>{rows=value;},
    publish:change=>{for(const subscriber of subscriptions)subscriber(change);},pending:()=>pending,
    candidate:()=>host.current().state.candidates?.[0]};
}
const checks=[];
{
  const f=fixture();await settle();assert.equal(f.host.current().state.kind,'candidates');
  await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.transactionId,'tx-accepted');
  assert.equal(f.effects.at(-1).kind,'targetReady');assert.equal(f.effects.at(-1).chapterIndex,0);
  assert.equal(f.host.currentTransactionId(target),'tx-accepted');
  assert.equal(f.host.targetCommitted(target,'old-txn'),undefined,'late old transaction cannot clear the current journal');
  assert.equal(f.host.targetCommitted(target,'tx-accepted').transactionId,'tx-accepted');
  assert.equal(f.host.current().pending,undefined);checks.push('real-discovery-progress-commit-target-seam-and-exact-release');
}
{
  const gate=deferred(),f=fixture({commitGate:gate});await settle();
  const work=f.host.pick(f.candidate(),f.host.current().scopeId);await settle();
  assert.equal(f.host.close(f.host.current().scopeId),false);assert.equal(f.host.consumeBack(f.host.current().scopeId),true);
  assert.equal(f.host.blocksExit(origin),true);const count=f.effects.length;f.retire();gate.resolve();await work;
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.transactionId,'tx-accepted');
  assert.equal(f.effects.length,count,'late ACK retained by owner without reopening retired reader');checks.push('commit-back-guard-retired-ACK-retained');
}
{
  const gate=deferred(),f=fixture({startGate:gate});await settle();
  const work=f.host.pick(f.candidate(),f.host.current().scopeId);await settle();f.retire();gate.resolve();await work;
  assert.equal(f.pending().length,0);assert.equal(f.host.current().write.confirmation,'undispatched');checks.push('dispatch-admission-refuses-retired-route');
}
{
  const f=fixture({loseCommitAck:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(f.host.current().write.observedPending.length,1);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,0,'matching from/target is not an automatic compensation mandate');
  assert.equal(f.host.close(f.host.current().scopeId),false);assert.equal(f.host.blocksExit(origin),true);
  f.host.retry(f.host.current().scopeId);await settle();
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1,'readonly recovery never blindly replays commit');
  await f.host.rollback(f.host.current().scopeId);assert.equal(f.host.current().write.confirmation,'confirmed');
  assert.equal(f.effects.at(-1).kind,'rollbackReady');checks.push('lost-ACK-readonly-observation-and-explicit-exact-journal-rollback');
}
{
  const f=fixture({invalidChapter:true});await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.host.current().write.confirmation,'unknown');assert.equal(f.host.current().write.transactionId,'tx-accepted');
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
  assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending.transactionId,'tx-accepted');
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
// Installed SDK parses the full new production owner. Native rendering and
// scheduler/SDK-send proof are separate tiers; this probe does not claim them.
const require=createRequire(import.meta.url),etsRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${etsRoot}/node_modules/typescript`),opts=require(`${etsRoot}/lib/ets_checker.js`).compilerOptions;
const tree=ts.createSourceFile('/tmp/SourceSwitchHost.ts',hostSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,opts);
assert.equal(tree.parseDiagnostics.length,0);
const compileHost=source=>compile(source,'SourceSwitchHost',{...common,...gatewayExports,SourceSwitchGateway:Gateway,
  ReaderCoreGateway:Core,ReadingSessionFlowGateway,RemoteReadingFlowGateway,...content,ReaderWriteEvidence});
const unsafe=hostSource.replace('if (!current()) return;\n    this.snapshot = { ...this.snapshot, write:',
  'if (!current()) return;\n    if (observed.length === 1) await this.gateway.rollbackSwitch(observed[0].transactionId, current, new ReaderWriteEvidence());\n    this.snapshot = { ...this.snapshot, write:');
assert.notEqual(unsafe,hostSource);
{
  const f=fixture({loseCommitAck:true},compileHost(unsafe));await settle();await f.host.pick(f.candidate(),f.host.current().scopeId);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,1,
    'negative control reproduces the old identity-only automatic rollback on actual Gateway calls');
}
{
  const unsafeScopes=compileHost(hostSource.replace('scopeId === this.snapshot.scopeId && this.currentLease()', 'this.currentLease()'));
  const f=fixture({},unsafeScopes),scope=f.host.current().scopeId;await settle();const candidate=f.candidate();
  f.host.close(scope);f.host.open(f.context,f.lease);await settle();await f.host.pick(candidate,scope);
  assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1,
    'negative control proves an old closure can mutate the reopened scope without the actual generation admission');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual full SourceSwitchHost/Gateway + actual progress lane/gateway; runtime/native IO are controlled fixtures; SDK AST only'}));
