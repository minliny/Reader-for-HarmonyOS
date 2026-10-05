import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// A source root override permits a read-only audit of an integrator's WIP.
// Normal canonical execution always reads this checkout's production source.
const sourceRoot=process.env.READER_PREDECESSOR_PROBE_ROOT===undefined?
  new URL('../',import.meta.url):pathToFileURL(`${resolve(process.env.READER_PREDECESSOR_PROBE_ROOT)}/`);
const source=readFileSync(new URL('entry/src/main/ets/app/ReaderRuntimeOwner.ts',sourceRoot),'utf8');
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`),options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const methods=new Set(['install','current','isCurrent','waitForPredecessorClose','start','startAfterPredecessor','close','closeRuntime']);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(done=>setImmediate(done));};
function loadRuntime(productionSource=source) {
  const tree=ts.createSourceFile('/tmp/ReaderPredecessorChain.ts',productionSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS,options);
  assert.equal(tree.parseDiagnostics.length,0);
  const declaration=tree.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.getText(tree)==='ReaderRuntimeOwner');
  for(const name of methods)assert.ok(declaration.members.some(node=>node.name?.getText(tree)===name),`actual Runtime contract ${name}`);
  // Retain every actual field initializer and constructor, plus the complete
  // installation/start/close chain. Only platform host and native IO delivery
  // are controlled; no copied owner identity or predecessor state machine.
  const members=declaration.members.filter(node=>ts.isConstructorDeclaration(node)||ts.isPropertyDeclaration(node)||methods.has(node.name?.getText(tree)))
    .map(node=>node.getText(tree)).join('\n');
  const events=[];
  class PlatformHost {constructor(context){this.context=context;}getContext(){return this.context;}close(){events.push('platform.close');}}
  const deps={MangaChapterPreparationCoordinator:{forRuntime:()=>({close:async()=>{}})},
    ReaderHostRegistry:PlatformHost,HarmonyTtsHostRouter:PlatformHost,HarmonySystemTtsHost:PlatformHost,
    HarmonyHttpTtsHost:PlatformHost,HarmonyTtsMediaSession:PlatformHost,HarmonyTtsBackgroundSession:PlatformHost,
    LocalEpubResourceHost:PlatformHost,ReadingImageDiskCache:PlatformHost,
    ReadingBodyImageHost:{setDisplayCacheDir(){},instance:{setMangaMetadataInspector(){},releaseAllDisplayFiles(){events.push('display.release');}}},
    ReaderStartupTrace:{current:()=>undefined},hilog:{warn(){}},LOG_DOMAIN:0,errorMessageOf:error=>error.message};
  const Runtime=new Function(...Object.keys(deps),`${stripTypeScriptTypes(`class ReaderRuntimeOwner { ${members} }`)};return ReaderRuntimeOwner;`)(...Object.values(deps));
  // Policy RPC and disk admission have their separate actual Owner/Disk
  // probes. This fixture controls only their constructor-time platform port.
  Runtime.prototype.bindMangaStorage=()=>{};
  // The native startup body has separate capability/restore tests. This seam
  // observes whether the real start/predecessor methods admit it at all.
  Runtime.prototype.startRuntime=async function(){events.push(`native.open:${this.host.context.id}`);this.state='ready';};
  return{Runtime,events};
}
const context=id=>({id,cacheDir:'/controlled/cache'});
function readyNative(owner,events,flush) {
  owner.state='ready';
  owner.runtime={async request(method){assert.equal(method,'runtime.storage.flush');events.push('native.flush:first');await flush?.();},
    close(){events.push('native.close:first');}};
  owner.host.setResponseAssetBridge=()=>{};
}
async function threeGenerations(productionSource=source) {
  const{Runtime,events}=loadRuntime(productionSource),gate=deferred(),first=Runtime.install(context('first'));
  readyNative(first,events);first.sourceSupplyTask=gate.promise;
  const closingFirst=first.close();const firstObserved=closingFirst.catch(()=>{});
  const second=Runtime.install(context('second'));
  // In particular, no second.start(): this is the omission in the old chain.
  const closingSecond=second.close();const secondObserved=closingSecond.catch(()=>{});
  const third=Runtime.install(context('third')),waiting=third.waitForPredecessorClose(),starting=third.start();
  let admitted=false;const waited=waiting.then(()=>{admitted=true;});const started=starting.catch(()=>{});
  try{
    await settle();
    assert.equal(admitted,false,'third owner cannot overtake first close through an unstarted retired second owner');
    assert.equal(events.some(value=>value.startsWith('native.open:')),false,'native startup cannot overtake the predecessor chain');
    assert.equal(second.state,'closing');assert.equal(third.state,'starting');assert.equal(Runtime.current(),third);
    gate.resolve();await closingFirst;await closingSecond;await waited;await starting;
    assert.equal(events.filter(value=>value==='native.open:third').length,1);
    assert.ok(events.indexOf('native.close:first')<events.indexOf('native.open:third'));
    assert.equal(Runtime.current(),third,'late first/second close cannot clear the third identity');
  }finally{gate.resolve();await Promise.all([firstObserved,secondObserved,waited.catch(()=>{}),started]);}
}
await threeGenerations();
{
  const{Runtime,events}=loadRuntime(),gate=deferred(),first=Runtime.install(context('first'));
  readyNative(first,events);first.sourceSupplyTask=gate.promise;const one=first.close();
  const second=Runtime.install(context('second')),two=second.close();
  const third=Runtime.install(context('third')),start=third.start();
  const rejected=assert.rejects(start,/closed before successor admission/);const three=third.close();
  await settle();assert.equal(events.some(value=>value.startsWith('native.open:')),false);
  gate.resolve();await Promise.all([one,two,three,rejected]);
  assert.equal(third.state,'closed');assert.equal(events.some(value=>value.startsWith('native.open:')),false,
    'closing while predecessor is outstanding never admits native startup after the barrier');
  assert.throws(()=>Runtime.current(),/must be installed/);
}
async function rejectedPredecessor(productionSource=source) {
  const{Runtime,events}=loadRuntime(productionSource),gate=deferred(),failure=Error('real predecessor Core flush rejected');
  const first=Runtime.install(context('first'));readyNative(first,events,async()=>{throw failure;});first.sourceSupplyTask=gate.promise;
  const close=first.close(),closed=assert.rejects(close,error=>error===failure);
  const successor=Runtime.install(context('successor')),wait=successor.waitForPredecessorClose(),start=successor.start();
  const waited=assert.rejects(wait,error=>error===failure,'public close barrier must preserve the actual rejection'),
    started=assert.rejects(start,error=>error===failure,'native startup must preserve the same actual rejection');
  // Attach observers before delivering rejection, including the mutation case.
  const observed=Promise.allSettled([closed,waited,started]);gate.resolve();const outcomes=await observed;
  for(const result of outcomes)if(result.status==='rejected')throw result.reason;
  assert.equal(events.filter(value=>value==='native.close:first').length,1,'native finally closes the rejected predecessor');
  assert.equal(events.some(value=>value.startsWith('native.open:')),false,'close rejection never silently admits successor IO');
  await assert.rejects(successor.close(),error=>error===failure);assert.equal(successor.state,'closed');
}
await rejectedPredecessor();
{
  const{Runtime}=loadRuntime(),gate=deferred(),first=Runtime.install(context('first'));first.sourceSupplyTask=gate.promise;
  const close=first.close(),next=Runtime.install(context('next')),pending=next.waitForPredecessorClose();
  const rejected=assert.rejects(pending,/closed before successor admission/),retired=next.close();gate.resolve();
  await Promise.all([close,retired,rejected]);
}
const closeStart=source.indexOf('  private async closeRuntime(): Promise<void>'),closeEnd=source.indexOf('  private async startAfterPredecessor()',closeStart);
assert.ok(closeStart>0&&closeEnd>closeStart);
const closeBody=source.slice(closeStart,closeEnd);assert.match(closeBody,/await this\.predecessorClose;/);
const old=source.slice(0,closeStart)+closeBody.replace('await this.predecessorClose;','')+source.slice(closeEnd);
await assert.rejects(threeGenerations(old),/third owner cannot overtake/,'old actual close body is a three-generation negative control');
const waitStart=source.indexOf('  async waitForPredecessorClose(): Promise<void>'),waitEnd=source.indexOf('  async start(): Promise<void>',waitStart);
assert.ok(waitStart>0&&waitEnd>waitStart);
const waitBody=source.slice(waitStart,waitEnd);assert.match(waitBody,/await this\.predecessorClose;/);
const swallowed=source.slice(0,waitStart)+waitBody.replace('await this.predecessorClose;','try { await this.predecessorClose; } catch (_) {}')+source.slice(waitEnd);
await assert.rejects(rejectedPredecessor(swallowed),/Missing expected rejection/,'swallowed actual barrier rejection is a startup negative control');
console.log('PASS real Runtime constructor/fields/install/start/close: unstarted second owner preserves three-generation predecessor chain, late close identity, close-before-admission, raw rejection through public/start/close, native finally, omission/swallowed-rejection negative controls; platform IO instrumented, no HAP/target claim.');
