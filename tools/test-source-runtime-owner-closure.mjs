import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
const source = path => readFileSync(new URL('../entry/src/main/ets/'+path, import.meta.url), 'utf8');
const ordinary = text => stripTypeScriptTypes(text.replace(/^export type \{[^\n]+from [^\n]+\n/gm,'').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load = (path, name, deps={}) => new Function(...Object.keys(deps),ordinary(source(path))+`;return ${name};`)(...Object.values(deps));
let installed; const ReaderRuntimeOwner=runtimeOwnerIdentityProbe(()=>installed);
const facts=load('app/ReaderOperationFacts.ts','{projectOperationFacts,projectCommitReadback}');
const projectPersistedReceipt=load('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts);
const ReaderWriteEvidence=load('app/ReaderWriteEvidence.ts','ReaderWriteEvidence');
const helpers={...load('app/ErrorMessage.ts','{errorMessageOf}'),...load('app/HttpTransportPolicy.ts','{httpUrlHostname,isPrivateNetworkTarget}'),...load('features/source/ReaderSourceCategory.ts','{classifyReaderSource}')};
const typed=error=>error.typedAdmission===true;
const SourceGateway=load('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner,isReaderCoreTransactionPendingError:typed,...helpers});
const SourceOrchestrator=load('features/source/SourceOrchestrator.ets','SourceOrchestrator',{SourceGateway,ReaderRuntimeOwner,ReaderWriteEvidence,isReaderCoreTransactionPendingError:typed,hilog:{error(){},warn(){},info(){}},projectPersistedReceipt,...facts,...helpers});
const SourceHost=load('features/source/SourceHost.ets','SourceHost',{SourceOrchestrator,SourceGateway,ReaderRuntimeOwner});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const row=()=>({sourceId:'a',name:'A',baseUrl:'https://a.test',enabled:true,enabledExplore:false,bookSource:{bookSourceType:0}});
function runtime(){return{calls:[],rows:[row()],writePause:undefined,dispatchPause:undefined,readPause:undefined,lost:false,readFailure:false,pickerCount:0,pickerPause:undefined,imports:0,loginCount:0,
 supportsCoreCapability:()=>false,
 async clearSourceCookieSession(){},
 async selectBookSourceJson(){this.pickerCount++;await this.pickerPause?.promise;return{fileName:'sources.json',text:JSON.stringify([{bookSourceUrl:'https://a.test',bookSourceName:'A'},{bookSourceUrl:'https://b.test',bookSourceName:'B'}])};},
 async openSourceLogin(){this.loginCount++;},
 async request(method,params,options={}){
  if(method==='source.update')await this.dispatchPause?.promise;
  if(options.canDispatch?.()===false||options.canContinue?.()===false)throw Error('not dispatched');
  options.onDispatch?.();this.calls.push({method,params:structuredClone(params)});
  if(method==='source.update'){await this.writePause?.promise;this.rows[0].enabled=params.enabled;if(this.lost)throw Error('ACK lost');return{data:{source:structuredClone(this.rows[0])}};}
  if(method==='source.import'){this.imports++;if(this.lost)throw Error('ACK lost');return{data:{imported:true,sourceId:params.sourceId,name:params.bookSource.bookSourceName}};}
  if(method==='source.list'){await this.readPause?.promise;if(this.readFailure)throw Error('read failed');return{data:{sources:structuredClone(this.rows)}};}
  if(method==='runtime.status')return{data:{pendingHostOperationCount:0}};
  throw Error(method);
 },count(method){return this.calls.filter(call=>call.method===method).length;}};}
function host(runtime,id){let active=true;const values=[],projections=[],statuses=[];const instance=new SourceHost(value=>values.push(structuredClone(value)),()=>active,(kind,message)=>statuses.push({kind,message}),()=>runtime,value=>projections.push(value));
 assert.equal(instance.bindPresentation(runtime,id,()=>active),true);
 return{instance,values,projections,statuses,id,retire(){active=false;instance.detachPresentation(id);},activate(){active=true;},open(){instance.open(id);},toggle(){instance.toggleSource('a',false,id);},latest(){return projections.at(-1);}};}
async function settled(h){await tick();await h.instance.orchestrator.operationChain;await tick();}
{
 const r=runtime();installed=r;const a=host(r,'A');a.open();await settled(a);const pause=deferred();r.writePause=pause;a.toggle();await tick();a.retire();const b=host(r,'B');assert.equal(a.instance.orchestrator,b.instance.orchestrator,'same original runtime retains one actual business chain');
 const prior=a.projections.length;a.instance.open('A');a.instance.toggleSource('a',true,'A');a.instance.toggleSource('a',true);a.instance.detachPresentation('A');
 assert.equal(b.instance.isPresentationCurrent(r,'B'),true,'old detach/getter cannot retire or steal B');b.open();pause.resolve();await settled(b);
 assert.equal(r.count('source.update'),1);assert.equal(a.projections.length,prior);assert.equal(b.values.at(-1)[0].enabled,false);assert.equal(b.latest().receipt.receipt.fact,'confirmedCurrent');
 assert.equal(b.instance.bindPresentation(r,'B',()=>true),true);assert.equal(b.instance.orchestrator.presentationIdentity,'B');
}
{
 const r=runtime();installed=r;const a=host(r,'A');a.open();await settled(a);const pause=deferred();r.writePause=pause;r.lost=true;a.toggle();await tick();a.retire();const b=host(r,'B');pause.resolve();await settled(b);
 assert.equal(b.instance.orchestrator.latestProjection.receipt.receipt.confirmation,'unknown');b.open();await settled(b);assert.equal(b.latest().receipt.receipt.fact,'pendingReconciliation');const writes=r.count('source.update');b.toggle();await settled(b);assert.equal(r.count('source.update'),writes,'list truth and new Host never erase an original lost ACK write barrier');
}
{
 const r=runtime();installed=r;const a=host(r,'A');a.open();await settled(a);const pause=deferred();r.dispatchPause=pause;a.toggle();await tick();installed=runtime();pause.resolve();await settled(a);assert.equal(r.count('source.update'),0,'actual final dispatch rechecks captured runtime after async readiness');
}
{
 const r=runtime();installed=r;const a=host(r,'A');const pause=deferred();r.readPause=pause;a.open();await tick();a.retire();const b=host(r,'B');const before=b.values.length;pause.resolve();await settled(a);assert.equal(b.values.length,before,'old captured read never publishes into new presentation');b.open();await settled(b);assert.equal(b.values.at(-1)[0].name,'A');
}
{
 const r=runtime();installed=r;const a=host(r,'A');a.open();await settled(a);const pause=deferred();r.pickerPause=pause;a.instance.importBookSources(undefined,()=>{throw Error('view callback');},()=>{},'A');await tick();a.retire();const b=host(r,'B');b.instance.importBookSources(undefined,()=>{},()=>{},'B');assert.equal(r.pickerCount,1,'recreated Host cannot duplicate in-flight picker');pause.resolve();await settled(b);assert.equal(r.imports,0,'old picker result is rejected before original write admission');
 b.instance.importBookSources(undefined,()=>{throw Error('view callback');},()=>{},'B');await settled(b);assert.equal(r.imports,2);assert.equal(b.latest().receipt.receipt.confirmation,'confirmed','observer exception cannot undo original ACK');
}
{
 const r=runtime();installed=r;const a=host(r,'A');a.open();await settled(a);r.lost=true;a.instance.importBookSources(undefined,()=>{},()=>{},'A');await settled(a);assert.equal(r.imports,1,'unknown first item blocks later document writes');assert.equal(a.latest().receipt.receipt.confirmation,'unknown');
 const b=host(r,'B');b.instance.importBookSources(undefined,()=>{},()=>{},'B');await settled(b);assert.equal(r.imports,1,'new presentation cannot replay unknown import');
}
console.log('Source actual Host/Gateway shared original runtime owner: PASS (6 lifecycle/dispatch/unknown/import scenarios).');
