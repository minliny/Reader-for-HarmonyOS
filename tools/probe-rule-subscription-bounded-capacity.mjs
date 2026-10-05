import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {compile} from './lib/rules-mutation-durable-probe.mjs';
// Read-only resource probe. Stored source inputs are exact audited production
// snapshots; platform IO/protocol observations are controlled adapters. This
// does not execute Core mutations or establish HarmonyOS device budgets.
const policy=await import('../entry/src/main/ets/app/HttpTransportPolicy.ts');
const category=await import('../entry/src/main/ets/features/source/ReaderSourceCategory.ts');
const errors=await import('../entry/src/main/ets/app/ErrorMessage.ts');
const scheduler=await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const {ReaderWriteEvidence}=await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const methods=compile('features/settings/RulesMutationContract.ts','RULES_MUTATION_METHODS',{},true);
const basePath=process.env.READER_SUBSCRIPTION_BASE_STORE_SOURCE??new URL('./evidence/p9-subscription-capacity/base-store.txt',import.meta.url);
const baseSource=readFileSync(basePath,'utf8');
const shaPath=process.env.READER_SUBSCRIPTION_STORE_SOURCE??new URL('./evidence/p9-subscription-bounded-capacity/store-candidate.txt',import.meta.url);
const shaSource=readFileSync(shaPath,'utf8');
assert.ok(shaSource.includes('planCache')&&shaSource.includes('hydratePlan'));
const ownerPath=process.env.READER_SUBSCRIPTION_OWNER_SOURCE??new URL('./evidence/p9-subscription-bounded-capacity/owner-candidate.txt',import.meta.url);
const ownerSource=readFileSync(ownerPath,'utf8');
const out=resolve(process.env.READER_SUBSCRIPTION_CAPACITY_OUTPUT??'/private/tmp/reader-subscription-bounded-capacity-20261003');mkdirSync(out,{recursive:true});
const byteLength=s=>Buffer.byteLength(s,'utf8');
const digest=s=>createHash('sha256').update(s).digest('hex');
const uuid=i=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0');
const id=i=>uuid(i)+'/'+i;
const sourceData=i=>({bookSourceName:'Capacity '+String(i).padStart(6,'0'),bookSourceUrl:'https://capacity.example.invalid/source/'+String(i).padStart(6,'0'),
 bookSourceGroup:'P9容量审计',enabled:true,searchUrl:'https://capacity.example.invalid/search?q={{key}}',
 ruleSearch:{bookList:'$.items',name:'$.name',author:'$.author',bookUrl:'$.url'},
 ruleBookInfo:JSON.stringify({name:'$.name',author:'$.author',intro:'$.intro',tocUrl:'$.toc'}),
 ruleToc:{chapterList:'$.chapters',chapterName:'$.title',chapterUrl:'$.url'},ruleContent:{content:'$.body'},
 preservedExtension:{text:'原始扩展/引号"/反斜杠\\/Unicode📚',flags:[true,false],nested:{keep:'exact'}}});
const sub={id:33,name:'capacity subscription',url:'https://capacity.example.invalid/subscription',type:0,autoUpdate:false,customOrder:0,update:0};
const ackData=(method,p)=>method==='source.import'?{sourceId:p.sourceId,imported:true,name:p.bookSource.bookSourceName}:{sub:{...p}};
const receipt=(operationId,sequence,mutation)=>{const data=ackData(mutation.method,mutation.params);return {binding:{operationId,sequence,payloadFingerprint:digest(JSON.stringify(mutation))},method:mutation.method,outcome:'applied',data,ackFingerprint:digest(JSON.stringify([mutation.method,'applied',data]))};};
const fact=(i,step)=>{const r=receipt(id(i),i,step);return {operationId:id(i),sequence:i,method:step.method,outcome:r.outcome,data:r.data,receipt:r};};
const newStats=()=>({readCalls:0,readBytes:0,writeCalls:0,writeBytes:0,hashCalls:0,hashBytes:0,recordHashCalls:0,recordHashBytes:0,receiptHashCalls:0,receiptHashBytes:0,finishes:0,fsyncs:0,maxSnapshotBytes:0,maxRssBytes:process.memoryUsage().rss,snapshotBytes:[],rpcCalls:0,rpcWrites:0,payloadPreserved:true,fileStats:{}});
function build(storeSource,disk={raw:''},stats=newStats()){
 let runtime,head,latest,uuids=0;
 const currentPath='/controlled-capacity/reader-rules-mutation-intent-v1.json';
 disk.files??={};if(disk.raw!==undefined)disk.files[currentPath]??=disk.raw;
 const fileStats=path=>stats.fileStats[path]??=({reads:0,readBytes:0,writes:0,writeBytes:0,maxBytes:0});
 const Runtime={isCurrent:o=>o===runtime&&!o.closed,current:()=>runtime};
 const sample=()=>{stats.maxRssBytes=Math.max(stats.maxRssBytes,process.memoryUsage().rss);};
 const fileIo={OpenMode:{READ_ONLY:0,READ_WRITE:2},readText:async path=>{stats.readCalls++;fileStats(path).reads++;if(disk.files[path]===undefined)throw{code:13900002};const raw=disk.files[path],n=byteLength(raw);stats.readBytes+=n;fileStats(path).readBytes+=n;sample();return raw;},
 open:async()=>({fd:1}),close:async()=>{},fsync:async()=>{stats.fsyncs++;if(disk.loseFsyncAt===stats.fsyncs)throw Error('actual fsync accepted; ACK lost');},AtomicFile:class{
  constructor(path){this.path=path;}
  startWrite(){return {on(){},end:(raw,_encoding,done)=>{this.raw=raw;queueMicrotask(done);}};}
  finishWrite(){disk.files[this.path]=this.raw;if(this.path===currentPath)disk.raw=this.raw;stats.finishes++;stats.writeCalls++;const n=byteLength(this.raw),byFile=fileStats(this.path);byFile.writes++;byFile.writeBytes+=n;byFile.maxBytes=Math.max(byFile.maxBytes,n);stats.writeBytes+=n;stats.maxSnapshotBytes=Math.max(stats.maxSnapshotBytes,n);if(n>0&&this.path===currentPath){stats.snapshotBytes.push(n);const j=JSON.parse(this.raw);if(j.subscription?.cursor===0&&j.subscription.steps!==undefined)disk.first=j;disk.last=j;}sample();if(disk.loseFinishAt===stats.finishes)throw Error('actual atomic finish accepted; ACK lost');}
  failWrite(){throw Error('no injected Atomic failure in capacity path');}
 }};
 const cryptoFramework={createMd:algorithm=>{assert.equal(algorithm,'SHA256');const h=createHash('sha256');return {
  update:async({data})=>{stats.hashCalls++;stats.hashBytes+=data.byteLength;const kind=data[0]===91?'receipt':'record';stats[kind+'HashCalls']++;stats[kind+'HashBytes']+=data.byteLength;h.update(data);},
  digest:async()=>({data:new Uint8Array(h.digest())})};}};
 const sha256Hex=compile('app/BundledBookSourceSupply.ts','sha256Hex',{cryptoFramework,util:{TextEncoder:class{encodeInto(text){return new TextEncoder().encode(text);}}}},true);
 const atomic=compile('app/ReaderAtomicSnapshotFile.ts','replaceReaderAtomicSnapshot',{fileIo},true);
 const Store=compile('features/settings/RulesMutationIntentStore.ts','RulesMutationIntentStore',{ReaderRuntimeOwner:Runtime,fileIo,util:{generateRandomUUID:()=>uuid(++uuids)},replaceReaderAtomicSnapshot:atomic,RULES_MUTATION_METHODS:methods,sha256Hex},true,storeSource);
 const types=compile('features/settings/RulesMutationOwner.ts','*',{...scheduler,ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,RULES_MUTATION_METHODS:methods,RulesMutationIntentStore:Store},true,ownerSource),Owner=types.RulesMutationOwner;
 runtime={closed:false,getUIAbilityContext:()=>({filesDir:'/controlled-capacity'}),supportsCoreCapability:()=>true,
  async request(method,params={},options={}){stats.rpcCalls++;if(options.canDispatch?.()===false)throw new scheduler.BookRequestNotDispatchedError('capacity last admission rejected');options.onDispatch?.();
   if(method==='rules.mutation.query')return {data:{head:head??null,receipt:latest!==undefined&&latest.binding.operationId===params.operationId?latest:null}};
   if(method==='source.import'){stats.rpcWrites++;return {data:ackData(method,params)};}
   assert.equal(method,'rules.mutation.apply');assert.equal(options.shouldCancel,undefined);const expected=disk.first?.subscription.steps[stats.rpcWrites];if(expected!==undefined)assert.deepEqual(params.mutation,{method:expected.method,params:expected.params},'every physical RPC preserves original accepted step DTO');stats.rpcWrites++;
   latest=receipt(params.operationId,params.sequence,params.mutation);head=latest.binding;return {data:latest};}};
 const Gateway=compile('features/settings/RulesManagementGateway.ts','RulesManagementGateway',{ReaderRuntimeOwner:Runtime,RulesMutationOwner:Owner},true);
 const Source=compile('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner:Runtime,...policy,...category,...errors},true);
 return{stats,disk,Store,Owner,runtime,source:new Source(runtime),gateway:new Gateway(runtime),owner:Owner.forRuntime(runtime),sha256Hex,head:value=>{head=value;latest=undefined;}};
}
function originalPlan(f,n){const sources=Array.from({length:n},(_,i)=>sourceData(i));const document=JSON.stringify(sources),plan=f.source.prepareSubscriptionDocument(document);
 assert.equal(plan.items.length,n);assert.equal(plan.failures.length,0);assert.deepEqual(plan.items.map(i=>i.bookSource),sources,'original SourceGateway admission retains every DTO/extension/string envelope');return{sources,document,plan};}
async function full(n){global.gc?.();const f=build(shaSource),{document,plan}=originalPlan(f,n),before=process.memoryUsage(),start=process.hrtime.bigint();
 const description=await f.gateway.refreshSubscription(sub,document,plan,()=>true);
 const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
 assert.equal(f.stats.rpcWrites,n+1);assert.equal(f.disk.raw,'');assert.equal(f.owner.snapshot().subscription.metadataConfirmed,true);assert.equal(f.owner.snapshot().subscription.confirmedParts,n+1);
 assert.equal(f.stats.writeCalls,n+4);assert.equal(f.stats.readCalls,n+3);
 // Live apply and exact query ACKs share the Store's production checksum validator;
 // each advance still verifies only its latest receipt, with constant work.
 assert.equal(f.stats.receiptHashCalls,4*n+1);assert.equal(f.stats.recordHashCalls,2*n+4);
 const planPath='/controlled-capacity/reader-rule-subscription-plan-v1.json',p=JSON.parse(f.disk.files[planPath]);
 assert.equal(f.stats.fileStats[planPath].writes,1);assert.equal(f.stats.fileStats[planPath].reads,0);
 assert.deepEqual(p.steps,f.disk.first.subscription.steps);assert.equal(p.steps.length,n+1);
 const result={n,mode:'complete actual SDK Owner/Store/Gateway; controlled memory platform and typed RPC observations, zero Core mutations',documentBytes:byteLength(document),elapsedMs,beforeRssBytes:before.rss,...f.stats,largestBoundedCurrentBytes:Math.max(...f.stats.snapshotBytes.slice(1)),description,immutablePlanWrittenOnce:true,everyDispatchedOriginalDtoPreserved:true};delete result.snapshotBytes;
 writeFileSync(resolve(out,'bounded-'+n+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return result;
}
async function checkpoints(n){const seed=build(shaSource),{document,plan}=originalPlan(seed,n),steps=plan.items.map(i=>({method:'source.import',params:{sourceId:i.sourceId,bookSource:i.bookSource},sourceIndex:i.index}));
 steps.push({method:'rule-sub.put',params:{...sub,update:1730000000000}});const reports=[];
 for(const k of [0,Math.floor(n/2),n]){const f=build(shaSource),journey={kind:0,steps,localFailures:[],cursor:k,facts:steps.slice(0,k).map((s,i)=>fact(i+1,s))};
  const original=await new f.Store(f.runtime).accept('订阅更新',steps[k].method,steps[k].params,async()=>k,()=>true,journey),current=JSON.parse(f.disk.raw);
  assert.equal(current.subscription.facts.length,k===0?0:1);assert.equal(current.subscription.steps,undefined);assert.equal(current.subscription.settled.applied,k);
  const cold=build(shaSource,f.disk);cold.head(k===0?undefined:journey.facts.at(-1).receipt.binding);const start=process.hrtime.bigint(),state=await cold.gateway.recoverMutation(()=>true);
  assert.equal(state.subscription.cursor,k);assert.equal(state.subscription.confirmedParts,k);assert.equal(state.subscription.metadataConfirmed,false);assert.equal(state.confirmation,'unknown');assert.equal(state.canRetryOriginal,true);assert.equal(cold.stats.rpcWrites,0);assert.equal(cold.stats.writeCalls,0);assert.equal(cold.Store.warm.operationId,original.operationId);assert.deepEqual(cold.Store.warm.subscription.steps,steps);
  const pp='/controlled-capacity/reader-rule-subscription-plan-v1.json';assert.equal(cold.stats.fileStats[pp].reads,1,'one cold immutable plan read');assert.ok(cold.stats.receiptHashCalls<=2,'constant latest receipt verification');
  reports.push({cursor:k,currentBytes:byteLength(cold.disk.raw),planBytes:byteLength(cold.disk.files[pp]),elapsedMs:Number(process.hrtime.bigint()-start)/1e6,...cold.stats});
 }
 writeFileSync(resolve(out,'bounded-5000-checkpoints.json'),JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify({checkpoints:reports}));return reports;
}
async function localFaults(){const results=[];
 for(const mode of ['finish','fsync'])for(const phase of [1,2,3])for(const recovery of ['warm','cold']){
  const f=build(shaSource),{document,plan}=originalPlan(f,3);
  if(mode==='finish')f.disk.loseFinishAt=phase;else f.disk.loseFsyncAt=2*phase;
  let initialError;try{await f.gateway.refreshSubscription(sub,document,plan,()=>true);}catch(e){initialError=e.message;}
  assert.ok(initialError);assert.equal(f.stats.rpcWrites,0,'local initialization ACK unknown never dispatches Core');
  const originalId=f.owner.snapshot().operationId;f.disk.loseFinishAt=undefined;f.disk.loseFsyncAt=undefined;
  const successor=recovery==='warm'?f:build(shaSource,f.disk);let error,state;
  try{state=await successor.gateway.recoverMutation(()=>true);}catch(e){error=e.message;}
  assert.equal(error,undefined,mode+' phase '+phase+' '+recovery+' pure recovery');assert.equal(successor.stats.rpcWrites,0);
  assert.equal(state.operationId,originalId);assert.equal(state.confirmation,'unknown');assert.equal(state.canRetryOriginal,true);
  const resumed=await successor.gateway.recoverMutation(()=>true,true);
  assert.equal(successor.stats.rpcWrites,4);assert.equal(resumed.subscription.metadataConfirmed,true);assert.equal(resumed.subscription.confirmedParts,4);assert.equal(successor.disk.raw,'');
  results.push({mode,phase,recovery,initialError,pureQueryPreservesSameId:true,pureQueryRpcWrites:0,explicitOriginalSteps:successor.stats.rpcWrites,metadataConfirmed:resumed.subscription.metadataConfirmed});
 }
 writeFileSync(resolve(out,'LOCAL_ACK_FAULTS.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({localFaults:results}));return results;
}
async function integrity(){const seed=build(shaSource),{plan}=originalPlan(seed,3),steps=plan.items.map(i=>({method:'source.import',params:{sourceId:i.sourceId,bookSource:i.bookSource},sourceIndex:i.index}));steps.push({method:'rule-sub.put',params:{...sub,update:1730000000000}});
 await new seed.Store(seed.runtime).accept('订阅更新',steps[1].method,steps[1].params,async()=>1,()=>true,{kind:0,steps,localFailures:[],cursor:1,facts:[fact(1,steps[0])]});
 const results=[],cp='/controlled-capacity/reader-rules-mutation-intent-v1.json',pp='/controlled-capacity/reader-rule-subscription-plan-v1.json';
 for(const [name,change,recompute,blocked] of [
  ['future DTO damage',(_j,p)=>{p.steps[2].params.bookSource.bookSourceName='damaged future';},'none',true],
  ['latest receipt damage',j=>{j.subscription.facts[0].data.name='damaged prior';j.subscription.facts[0].receipt.data.name='damaged prior';},'none',true],
  ['latest receipt body, only outer digest rewritten',j=>{j.subscription.facts[0].data.name='damaged prior';j.subscription.facts[0].receipt.data.name='damaged prior';},'current',true],
  ['future plan and both digests rewritten: no authentication',(_j,p)=>{p.steps[2].params.bookSource.bookSourceName='authored future';},'all',false],
  ['latest receipt and both digests rewritten: no authentication',j=>{const f=j.subscription.facts[0];f.data.name='authored prior';f.receipt.data.name='authored prior';f.receipt.ackFingerprint=digest(JSON.stringify([f.method,f.outcome,f.data]));},'current',false],
 ]){const files=structuredClone(seed.disk.files),j=JSON.parse(files[cp]),p=JSON.parse(files[pp]);change(j,p);files[pp]=JSON.stringify(p);
  if(recompute==='all')j.subscription.plan.fingerprint=digest(files[pp]);
  if(recompute!=='none'){delete j.recordFingerprint;j.recordFingerprint=digest(JSON.stringify(j));}files[cp]=JSON.stringify(j);
  const cold=build(shaSource,{files,raw:files[cp]});cold.head(j.subscription.facts[0].receipt.binding);let error;try{await cold.gateway.recoverMutation(()=>true);}catch(e){error=e.message;}
  assert.equal(!!error,blocked,name);assert.equal(cold.stats.rpcWrites,0);assert.equal(cold.stats.writeCalls,0);results.push({name,blocked:!!error,error:error??null,rpcWrites:0,localWrites:0});
 }
 writeFileSync(resolve(out,'INTEGRITY.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({integrity:results}));return results;
}
const loader=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const dependencyHashes=Object.fromEntries(['app/ReaderAtomicSnapshotFile.ts','app/BundledBookSourceSupply.ts','features/settings/RulesManagementGateway.ts','features/settings/RulesMutationContract.ts','features/source/SourceGateway.ts'].map(p=>[p,digest(readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8'))]));
const manifest={hostDependencyBase:'3df16be152bcb7701a08670a218cb90b964d6cca',candidateCommit:process.env.READER_SUBSCRIPTION_CANDIDATE_COMMIT??null,storeSource:String(shaPath),storeSha256:digest(shaSource),ownerSource:String(ownerPath),ownerSha256:digest(ownerSource),dependencyHashes,environment:{node:process.version,platform:process.platform,arch:process.arch,loader,sdkTypeScriptVersion:createRequire(import.meta.url)(loader+'/node_modules/typescript').version},boundaries:['Full production methods compiled with installed SDK; controlled memory file and official crypto API seams','50/500/5000 complete Host protocol chains use typed observations, zero Core database writes','Mac probe CPU/RSS are not HarmonyOS target/device budgets or Atomic crash durability']};
writeFileSync(resolve(out,'INPUTS.json'),JSON.stringify(manifest,null,2)+'\n');
const rows=[];for(const n of [50,500,5000])rows.push(await full(n));
const cold=await checkpoints(5000),faults=await localFaults(),damage=await integrity();
const admission=build(shaSource);assert.equal(originalPlan(admission,5000).plan.items.length,5000);assert.throws(()=>originalPlan(admission,5001),/5000 source limit/);
const results={...manifest,rows,cold,faults,damage,storeInputStable:readFileSync(shaPath,'utf8')===shaSource,ownerInputStable:readFileSync(ownerPath,'utf8')===ownerSource};
writeFileSync(resolve(out,'RESULTS.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({pass:true,output:out,resourcePath:'linear full Host matrix'}));
