import { temporaryOutput } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
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
const shaPath=process.env.READER_SUBSCRIPTION_STORE_SOURCE??new URL('./evidence/p9-subscription-capacity/whole-sha-store.txt',import.meta.url);
const shaSource=readFileSync(shaPath,'utf8');
assert.ok(shaSource.includes('recordFingerprint')&&shaSource.includes('validateIntegrity'));
const out=resolve(process.env.READER_SUBSCRIPTION_CAPACITY_OUTPUT??temporaryOutput('reader-subscription-capacity-'));mkdirSync(out,{recursive:true});
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
const newStats=()=>({readCalls:0,readBytes:0,writeCalls:0,writeBytes:0,hashCalls:0,hashBytes:0,recordHashCalls:0,recordHashBytes:0,receiptHashCalls:0,receiptHashBytes:0,finishes:0,fsyncs:0,maxSnapshotBytes:0,maxRssBytes:process.memoryUsage().rss,snapshotBytes:[],rpcCalls:0,rpcWrites:0,payloadPreserved:true});
function build(storeSource,disk={raw:''},stats=newStats()){
 let runtime,head,latest,uuids=0;
 const Runtime={isCurrent:o=>o===runtime&&!o.closed,current:()=>runtime};
 const sample=()=>{stats.maxRssBytes=Math.max(stats.maxRssBytes,process.memoryUsage().rss);};
 const fileIo={OpenMode:{READ_ONLY:0,READ_WRITE:2},readText:async()=>{stats.readCalls++;stats.readBytes+=byteLength(disk.raw);sample();return disk.raw;},
 open:async()=>({fd:1}),close:async()=>{},fsync:async()=>{stats.fsyncs++;},AtomicFile:class{
  startWrite(){return {on(){},end:(raw,_encoding,done)=>{this.raw=raw;queueMicrotask(done);}};}
  finishWrite(){disk.raw=this.raw;stats.finishes++;stats.writeCalls++;const n=byteLength(this.raw);stats.writeBytes+=n;stats.maxSnapshotBytes=Math.max(stats.maxSnapshotBytes,n);if(n>0){stats.snapshotBytes.push(n);const j=JSON.parse(this.raw);if(j.subscription?.cursor===0)disk.first=j;disk.last=j;}sample();}
  failWrite(){throw Error('no injected Atomic failure in capacity path');}
 }};
 const cryptoFramework={createMd:algorithm=>{assert.equal(algorithm,'SHA256');const h=createHash('sha256');return {
  update:async({data})=>{stats.hashCalls++;stats.hashBytes+=data.byteLength;const kind=data[0]===91?'receipt':'record';stats[kind+'HashCalls']++;stats[kind+'HashBytes']+=data.byteLength;h.update(data);},
  digest:async()=>({data:new Uint8Array(h.digest())})};}};
 const sha256Hex=compile('app/BundledBookSourceSupply.ts','sha256Hex',{cryptoFramework,util:{TextEncoder:class{encodeInto(text){return new TextEncoder().encode(text);}}}},true);
 const atomic=compile('app/ReaderAtomicSnapshotFile.ts','replaceReaderAtomicSnapshot',{fileIo},true);
 const Store=compile('features/settings/RulesMutationIntentStore.ts','RulesMutationIntentStore',{ReaderRuntimeOwner:Runtime,fileIo,util:{generateRandomUUID:()=>uuid(++uuids)},replaceReaderAtomicSnapshot:atomic,RULES_MUTATION_METHODS:methods,sha256Hex},true,storeSource);
 const types=compile('features/settings/RulesMutationOwner.ts','*',{...scheduler,ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,RULES_MUTATION_METHODS:methods,RulesMutationIntentStore:Store},true),Owner=types.RulesMutationOwner;
 runtime={closed:false,getUIAbilityContext:()=>({filesDir:'/controlled-capacity'}),supportsCoreCapability:()=>true,
  async request(method,params={},options={}){stats.rpcCalls++;if(options.canDispatch?.()===false)throw new scheduler.BookRequestNotDispatchedError('capacity last admission rejected');options.onDispatch?.();
   if(method==='rules.mutation.query')return {data:{head:head??null,receipt:latest!==undefined&&latest.binding.operationId===params.operationId?latest:null}};
   if(method==='source.import'){stats.rpcWrites++;return {data:ackData(method,params)};}
   assert.equal(method,'rules.mutation.apply');assert.equal(options.shouldCancel,undefined);stats.rpcWrites++;
   latest=receipt(params.operationId,params.sequence,params.mutation);head=latest.binding;return {data:latest};}};
 const Gateway=compile('features/settings/RulesManagementGateway.ts','RulesManagementGateway',{ReaderRuntimeOwner:Runtime,RulesMutationOwner:Owner},true);
 const Source=compile('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner:Runtime,...policy,...category,...errors},true);
 return{stats,disk,Store,Owner,runtime,source:new Source(runtime),gateway:new Gateway(runtime),owner:Owner.forRuntime(runtime),sha256Hex,head:value=>{head=value;latest=undefined;}};
}
function originalPlan(f,n){const sources=Array.from({length:n},(_,i)=>sourceData(i));const document=JSON.stringify(sources),plan=f.source.prepareSubscriptionDocument(document);
 assert.equal(plan.items.length,n);assert.equal(plan.failures.length,0);assert.deepEqual(plan.items.map(i=>i.bookSource),sources,'original SourceGateway admission retains every DTO/extension/string envelope');return{sources,document,plan};}
function totalsFromActualSnapshot(initial,hasSha){
 const j=initial.subscription,n=j.steps.length-1,steps=j.steps;
 const base=byteLength(JSON.stringify(initial));
 const fpBytes=hasSha?byteLength(',"recordFingerprint":"'+'0'.repeat(64)+'"'):0;
 const firstMutationBytes=byteLength(JSON.stringify(initial.mutation));
 const initialIdLength=byteLength(initial.operationId),initialSequenceLength=String(initial.sequence).length;
 let priorFactBytes=0,sumBytes=0,sumRecordBytes=0,sumReceiptHashBytes=0;
 const sizes=[];
 for(let k=0;k<=n;k++){
  const sequence=k+1;
  const bytes=base+byteLength(JSON.stringify({method:steps[k].method,params:steps[k].params}))-firstMutationBytes+
   byteLength(id(sequence))-initialIdLength+String(sequence).length-initialSequenceLength+String(k).length-1+
   (k===0?0:priorFactBytes+k-1);
  sizes.push(bytes);sumBytes+=bytes;sumRecordBytes+=bytes-fpBytes;
  if(k<n){const f=fact(k+1,steps[k]);priorFactBytes+=byteLength(JSON.stringify(f));sumReceiptHashBytes+=2*(n-k)*byteLength(JSON.stringify([f.method,f.outcome,f.data]));}
 }
 return{n,steps:n+1,snapshotBytesAtStart:sizes[0],snapshotBytesAtMiddle:sizes[Math.floor(n/2)],snapshotBytesAtLast:sizes[n],maxSnapshotBytes:Math.max(...sizes),
  writeCalls:n+2,readCalls:n+3,writeBytes:sumBytes,readBytes:sumBytes,recordHashCalls:hasSha?2*(n+1):0,recordHashBytes:hasSha?2*sumRecordBytes:0,
  receiptHashCalls:hasSha?n*(n+1):0,receiptHashBytes:hasSha?sumReceiptHashBytes:0,snapshotSizes:sizes};
}
async function full(n,kind,source){global.gc?.();const f=build(source),{document,plan}=originalPlan(f,n),before=process.memoryUsage(),start=process.hrtime.bigint();
 const description=await f.gateway.refreshSubscription(sub,document,plan,()=>true);
 const elapsedMs=Number(process.hrtime.bigint()-start)/1e6,expected=totalsFromActualSnapshot(f.disk.first,kind==='whole-sha');
 for(const field of ['writeCalls','readCalls','writeBytes','readBytes','recordHashCalls','recordHashBytes','receiptHashCalls','receiptHashBytes'])assert.equal(f.stats[field],expected[field],'actual path matches derived '+field);
 assert.deepEqual(f.stats.snapshotBytes,expected.snapshotSizes,'byte formula matches every real emitted snapshot');
 assert.equal(f.stats.rpcWrites,n+1);assert.equal(f.disk.raw,'');assert.equal(f.owner.snapshot().subscription.metadataConfirmed,true);
 const result={n,kind,mode:'complete actual SDK Owner/Store/Gateway with controlled memory Atomic/crypto/protocol adapters',documentBytes:byteLength(document),elapsedMs,beforeRssBytes:before.rss,...f.stats,derivedFormulaValidated:true,description};delete result.snapshotBytes;
 writeFileSync(resolve(out,kind+'-'+n+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return{result,initial:f.disk.first};}
async function checkpoints(n,source){const seed=build(source),{document,plan}=originalPlan(seed,n),steps=plan.items.map(i=>({method:'source.import',params:{sourceId:i.sourceId,bookSource:i.bookSource},sourceIndex:i.index}));
 steps.push({method:'rule-sub.put',params:{...sub,update:1730000000000}});
 const first=await new seed.Store(seed.runtime).accept('订阅更新',steps[0].method,steps[0].params,async()=>0,()=>true,{kind:0,steps,localFailures:[],cursor:0,facts:[]});
 const derived=totalsFromActualSnapshot(first,true),reports=[];
 for(const k of [0,Math.floor(n/2),n]){
  const f=build(source),journey={kind:0,steps,localFailures:[],cursor:k,facts:steps.slice(0,k).map((s,i)=>fact(i+1,s))};
  const intent=await new f.Store(f.runtime).accept('订阅更新',steps[k].method,steps[k].params,async()=>k,()=>true,journey);
  assert.equal(byteLength(f.disk.raw),derived.snapshotSizes[k],'actual accepted checkpoint bytes equal derived normal path');
  const cold=build(source,f.disk);cold.head(k===0?undefined:journey.facts.at(-1).receipt.binding);
  const start=process.hrtime.bigint();const state=await cold.gateway.recoverMutation(()=>true);
  assert.equal(state.subscription.cursor,k);assert.equal(state.subscription.confirmedParts,k);assert.equal(state.subscription.metadataConfirmed,false);assert.equal(state.confirmation,'unknown');assert.equal(state.canRetryOriginal,true);assert.equal(cold.stats.rpcWrites,0);assert.equal(cold.stats.writeCalls,0);
  assert.equal(cold.disk.last.operationId,intent.operationId);assert.deepEqual(cold.disk.last.subscription.steps,steps,'cold restoration preserves every future accepted DTO');
  reports.push({cursor:k,observedSnapshotBytes:byteLength(cold.disk.raw),elapsedMs:Number(process.hrtime.bigint()-start)/1e6,...cold.stats});
 }
 const result={n,kind:'whole-sha',mode:'actual SDK cold Store/Owner API on legal protocol-history fixture checkpoints; full 5000 dispatch NOT executed',documentBytes:byteLength(document),derivedNormalJourney:{...derived,snapshotSizes:undefined},checkpoints:reports};
 writeFileSync(resolve(out,'whole-sha-'+n+'-checkpoints.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return result;}
async function corruption(source){const f=build(source),{document,plan}=originalPlan(f,3),steps=plan.items.map(i=>({method:'source.import',params:{sourceId:i.sourceId,bookSource:i.bookSource},sourceIndex:i.index}));steps.push({method:'rule-sub.put',params:{...sub,update:1730000000000}});
 await new f.Store(f.runtime).accept('订阅更新',steps[1].method,steps[1].params,async()=>1,()=>true,{kind:0,steps,localFailures:[],cursor:1,facts:[fact(1,steps[0])]});const pristine=f.disk.raw;
 const cases=[];
 for(const [name,mutate,recompute] of [
  ['future DTO, unchanged checksum',j=>{j.subscription.steps[2].params.bookSource.bookSourceName='changed future';},false],
  ['prior receipt body, unchanged checksums',j=>{j.subscription.facts[0].data.name='changed prior';j.subscription.facts[0].receipt.data.name='changed prior';},false],
  ['prior receipt body, recomputed outer checksum only',j=>{j.subscription.facts[0].data.name='changed prior';j.subscription.facts[0].receipt.data.name='changed prior';},true],
  ['future DTO, recomputed outer checksum (not authentication)',j=>{j.subscription.steps[2].params.bookSource.bookSourceName='changed future';},true],
  ['prior body and both digests recomputed (not authentication)',j=>{const p=j.subscription.facts[0];p.data.name='changed prior';p.receipt.data.name='changed prior';p.receipt.ackFingerprint=digest(JSON.stringify([p.method,p.outcome,p.data]));},true],
 ]){
  const j=JSON.parse(pristine);mutate(j);if(recompute){delete j.recordFingerprint;j.recordFingerprint=digest(JSON.stringify(j));}
  const disk={raw:JSON.stringify(j)},cold=build(source,disk);cold.head(j.subscription.facts[0].receipt.binding);let error;
  try{await cold.gateway.recoverMutation(()=>true);}catch(e){error=e.message;}
  const blocked=Boolean(error);assert.equal(cold.stats.rpcWrites,0,'pure corruption probe never executes later mutations');
  if(name.includes('not authentication'))assert.equal(blocked,false);else assert.equal(blocked,true);
  cases.push({name,blocked,error:error??null,dispatched:cold.stats.rpcWrites,meaning:name.includes('not authentication')?'Expected checksum boundary: self-authored digest is not a MAC/signature or historical Core authority':'Real production cold corruption barrier'});
 }
 writeFileSync(resolve(out,'INTEGRITY.json'),JSON.stringify(cases,null,2)+'\n');console.log(JSON.stringify({integrity:cases}));return cases;
}
const dependencyHashes=Object.fromEntries(['app/ReaderAtomicSnapshotFile.ts','app/BundledBookSourceSupply.ts','features/settings/RulesMutationOwner.ts','features/settings/RulesManagementGateway.ts','features/settings/RulesMutationContract.ts','features/source/SourceGateway.ts'].map(p=>[p,digest(readFileSync(new URL('../entry/src/main/ets/'+p,import.meta.url),'utf8'))]));
const manifest={hostBase:'3df16be152bcb7701a08670a218cb90b964d6cca',baseStoreSource:String(basePath),baseStoreSha256:digest(baseSource),candidateStoreSource:String(shaPath),candidateStoreSha256:digest(shaSource),dependencyHashes,boundaries:['No Core database writes or native target used','Installed SDK full production Store/Owner/SourceGateway/Gateway and Atomic thin IO','Memory-backed API bytes and Host CPU/RSS observations are not OS durability or HarmonyOS budgets','Complete 50/500 paths validate exact normal-journey byte/hash formula; 5000 cumulative numbers are derived, with real API cold checkpoint verification']};
writeFileSync(resolve(out,'INPUTS.json'),JSON.stringify(manifest,null,2)+'\n');
const rows=[];for(const n of [50,500])for(const [kind,s]of [['baseline',baseSource],['whole-sha',shaSource]])rows.push((await full(n,kind,s)).result);
const large=await checkpoints(5000,shaSource),integrity=await corruption(shaSource);
const baselineLarge=JSON.parse(JSON.stringify(large.derivedNormalJourney));
for(const field of ['snapshotBytesAtStart','snapshotBytesAtMiddle','snapshotBytesAtLast','maxSnapshotBytes'])baselineLarge[field]-=87;
baselineLarge.writeBytes-=87*5001;baselineLarge.readBytes-=87*5001;
for(const field of ['recordHashCalls','recordHashBytes','receiptHashCalls','receiptHashBytes'])baselineLarge[field]=0;
large.derivedOriginalBaseline=baselineLarge;
// Old SourceGateway rejects only >5000; preserve the original admitted limit.
const admission=build(baseSource);assert.equal(originalPlan(admission,5000).plan.items.length,5000);assert.throws(()=>originalPlan(admission,5001),/5000 source limit/);
const result={...manifest,rows,large,integrity,old5000AdmissionPreserved:true,candidateSourceStable:readFileSync(shaPath,'utf8')===shaSource};
writeFileSync(resolve(out,'RESULTS.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({pass:true,output:out,candidateSourceStable:result.candidateSourceStable}));
