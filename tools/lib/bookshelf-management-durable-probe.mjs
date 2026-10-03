import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { compile, ReaderWriteEvidence, deferred, until } from './rules-mutation-durable-probe.mjs';
import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';
import * as facts from '../../entry/src/main/ets/app/ReaderOperationFacts.ts';
import * as scheduler from '../../entry/src/main/ets/app/BookRequestScheduler.ts';
import * as sdk from '../../entry/vendor/core-harmony/sdk/reader_core.ts';

const run=promisify(execFile),host=fileURLToPath(new URL('../../',import.meta.url));
export const coreRoot=process.env.READER_BOOKSHELF_MANAGEMENT_CORE_ROOT??resolve(host,'../Reader-Core-Native');
export const binary=resolve(coreRoot,'target/debug/reader-cli');
export const read=p=>fs.readFileSync(resolve(host,'entry/src/main/ets',p),'utf8');

/** Actual AtomicFile adapter + complete production SDK-emitted classes. Every
 * Core RPC starts a separate CLI process against the same SQLite directory;
 * replacing the fixture module deliberately removes only warm JS statics. */
export async function managementFixture(existing, suppliedRuntime, gatewaySource) {
 const root=existing?.root??await fsp.mkdtemp(resolve(tmpdir(),'reader-bookshelf-management-durable-'));
 const files=resolve(root,'files'),core=resolve(root,'core');await fsp.mkdir(files,{recursive:true});
 const options={},calls=[],io={finishes:0,syncs:0,failWrites:0};let installed,uuid=existing?.uuid??0;
 const Runtime=runtimeOwnerIdentityProbe(()=>installed);
 const fileIo={OpenMode:{READ_ONLY:fs.constants.O_RDONLY,READ_WRITE:fs.constants.O_RDWR},
  async readText(path){try{return await fsp.readFile(path,'utf8');}catch(e){if(e.code==='ENOENT')throw{code:13900002};throw e;}},
  async open(path,flags){return{fd:fs.openSync(path,flags)};},async close(f){fs.closeSync(f.fd);},
  async fsync(fd){fs.fsyncSync(fd);io.syncs++;if(options.loseSyncAt===io.syncs)throw Error('fsync accepted; ACK lost');},
  AtomicFile:class{constructor(path){this.path=path;this.tmp=path+'.tmp';}startWrite(){if(options.beforeLocal){options.beforeLocal=false;throw Error('startWrite rejected before local side effect');}return{on(){},end:(raw,_encoding,done)=>{fs.writeFileSync(this.tmp,raw);queueMicrotask(done);}};}
   finishWrite(){fs.renameSync(this.tmp,this.path);io.finishes++;if(options.loseFinishAt===io.finishes)throw Error('rename accepted; ACK lost');}failWrite(){io.failWrites++;try{fs.unlinkSync(this.tmp);}catch{}}}};
 const replaceReaderAtomicSnapshot=compile('app/ReaderAtomicSnapshotFile.ts','replaceReaderAtomicSnapshot',{fileIo},true);
 const sha256Hex=compile('app/BundledBookSourceSupply.ts','sha256Hex',{cryptoFramework:{createMd:()=>{const hash=createHash('sha256');return{update:async({data})=>{hash.update(data);},digest:async()=>({data:new Uint8Array(hash.digest())})};}},util:{TextEncoder:class{encodeInto(text){return new TextEncoder().encode(text);}}}},true);
 const Store=compile('features/bookshelf/BookshelfManagementIntentStore.ts','BookshelfManagementIntentStore',{
  ReaderRuntimeOwner:Runtime,...scheduler,fileIo,util:{generateRandomUUID:()=>`12345678-1234-4234-8123-${String(++uuid).padStart(12,'0')}`},replaceReaderAtomicSnapshot,sha256Hex},true);
 async function command(method,params={}) {
  const result=await run(binary,['--json',JSON.stringify({protocolVersion:1,requestId:1,method,params}),'--config-json',JSON.stringify({dataDirectory:core})],{maxBuffer:32*1024*1024});
  const event=result.stdout.trim().split('\n').map(l=>JSON.parse(l)).findLast(e=>e.requestId===1);
  if(event.type==='error')throw new sdk.ReaderCoreRequestError(event);return event;
 }
 // Initialize the fresh SQLite database before an owner launches its three
 // independent read projections. Production uses one native Core instance;
 // simultaneous first-open CLI processes would test migration-file locking.
 await command('book-group.list',{});
 const runtime=suppliedRuntime??{};
 Object.assign(runtime,{closed:false,getUIAbilityContext:()=>({filesDir:files}),supportsCoreCapability:()=>options.capability!==false,
  async request(method,params={},requestOptions={}) {
   const call={method,params:structuredClone(params),options:requestOptions,dispatched:false};calls.push(call);
   const originalMethod=method==='bookshelf.management.mutation.apply'?params.mutation.method:method;
   if(options.beforeStart===originalMethod){const gate=options.gate;options.beforeStart=undefined;await gate.promise;}
   if(requestOptions.canDispatch?.()===false)throw new scheduler.BookRequestNotDispatchedError('original final admission denied');
   if(method==='bookshelf.management.mutation.apply')assert.equal(requestOptions.shouldCancel,undefined,'accepted mutation has no retired UI cancellation');
   if(requestOptions.onDispatch){call.dispatched=true;requestOptions.onDispatch();}
   if(options.pauseMethod===originalMethod){const gate=options.gate;options.pauseMethod=undefined;await gate.promise;}
   if(options.beforeMethod===originalMethod){options.beforeMethod=undefined;throw Error('lost ACK before observed Core effect');}
   const event=await command(method,params);
   if(options.afterMethod===originalMethod){options.afterMethod=undefined;throw Error('lost ACK after actual cold SQLite commit');}
   return options.transformMethod===originalMethod?{...event,data:options.transform(event.data)}:event;
  }});
 installed=runtime;
 const ReaderCoreGateway=compile('app/ReaderCoreGateway.ts','ReaderCoreGateway',{ReaderRuntimeOwner:Runtime},true);
 const Gateway=compile('features/bookshelf/BookshelfManagementGateway.ts','BookshelfManagementGateway',{
  ReaderRuntimeOwner:Runtime,ReaderCoreGateway,BookshelfManagementIntentStore:Store},true,gatewaySource??read('features/bookshelf/BookshelfManagementGateway.ts'));
 const projectPersistedReceipt=compile('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',facts,true);
 const types=compile('features/bookshelf/BookshelfManagementOrchestrator.ets','*',{ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,
  BookshelfManagementGateway:Gateway,...facts,projectPersistedReceipt,hilog:{error(){}}},true);
 const Host=compile('features/bookshelf/BookshelfHost.ets','BookshelfHost',{ReaderRuntimeOwner:Runtime,ReaderCoreGateway,
  BookshelfManagementOrchestrator:types.BookshelfManagementOrchestrator},true,
  read('features/bookshelf/BookshelfHost.ets').replace(/^export \{[\s\S]*?from ['"][^'"]+['"];\n/gm,''));
 const store=new Store(runtime),gateway=new Gateway(runtime,store);
 return{root,files,core,runtime,Runtime,options,calls,io,Store,Gateway,Host,ReaderCoreGateway,Orchestrator:types.BookshelfManagementOrchestrator,
  EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT:types.EMPTY_BOOKSHELF_MANAGEMENT_SNAPSHOT,store,gateway,command,sha256Hex,
  uuid:()=>uuid,disk:()=>{try{return fs.readFileSync(resolve(files,'reader-bookshelf-management-intent-v1.json'),'utf8');}catch(e){if(e.code==='ENOENT')return'';throw e;}},
  writeDisk:raw=>fs.writeFileSync(resolve(files,'reader-bookshelf-management-intent-v1.json'),raw),
  writes:()=>calls.filter(c=>c.method==='bookshelf.management.mutation.apply'),queries:()=>calls.filter(c=>c.method==='bookshelf.management.mutation.query'),
  retire:()=>{runtime.closed=true;installed=undefined;},install:o=>{installed=o;},
  recover:continueOriginal=>gateway.recoverWrites(()=>Runtime.isCurrent(runtime),continueOriginal)};
}
export {ReaderWriteEvidence,deferred,until};
