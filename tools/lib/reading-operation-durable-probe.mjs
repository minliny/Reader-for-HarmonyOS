import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { coreCliPath } from './tool-environment.mjs';
import { formatDownloadStorageBytes } from '../../entry/src/main/ets/features/downloads/SharedDownloadProjection.ts';
import {fixture as actualGeneralSettingsFixture} from './general-settings-persistence-probe.mjs';
import {runtimeOwnerIdentityProbe} from './reader-runtime-admission-probe.mjs';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if((s.startsWith('.')&&!s.endsWith('.ts')))return next(s+'.ts',c);throw e;}}});
const { ReaderWriteEvidence } = await import('../../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const { projectPersistedReceipt } = await import('../../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
const { projectOperationFacts } = await import('../../entry/src/main/ets/app/ReaderOperationFacts.ts');
const { LocalReadingFlowGateway, LOCAL_SOURCE_ID } = await import('../../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const { ReadingOfflineGateway } = await import('../../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts');
const { MangaDownloadActionsGateway } = await import('../../entry/src/main/ets/features/manga/MangaDownloadActionsGateway.ts');
const { loadReaderControlBookmarkProjection } = await import('../../entry/src/main/ets/features/reading/ReaderControlBookmarkLoad.ts');
const sdk = await import('../../entry/vendor/core-harmony/sdk/reader_core.ts');
const run = promisify(execFile);
const { ts } = installedEtsCompiler();
const hostRoot=fileURLToPath(new URL('../../',import.meta.url));
export const coreRoot=process.env.READER_READING_RECEIPT_CORE_ROOT??resolve(hostRoot,'../Reader-Core-Native');
export const coreBinary=coreCliPath(coreRoot);
const read=p=>fs.readFileSync(resolve(hostRoot,'entry/src/main/ets',p),'utf8');
export function compile(p,n,deps,official=false){
 const source=read(p),body=source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export type \{[^\n]+\n/gm,'');
 if(!official)return new Function(...Object.keys(deps),stripTypeScriptTypes(body).replace(/^export /gm,'')+`;return ${n};`)(...Object.values(deps));
 const tree=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.deepEqual(tree.parseDiagnostics,[],p+' installed SDK parses entire source');
 const result=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS,strict:true},reportDiagnostics:true,fileName:p});assert.deepEqual(result.diagnostics,[],p+' official SDK emitter diagnostics');
 const exports={};new Function('exports',...Object.keys(deps),result.outputText)(exports,...Object.values(deps));
 return new Function('exports','return exports.'+n)(exports);
}
export const book={sourceId:'local',sourceName:'local',bookId:'book',title:'Book',author:'Author'};
export const bookmarkContext={sourceId:'local',bookId:'book',title:'Book',author:'Author'};
export const bookmarkInput={bookName:'Book',bookAuthor:'Author',chapterIndex:0,chapterOffset:0,chapterTitle:'Chapter',bookText:'正文'};
export const cacheContext={sourceId:'source',bookId:'book'};
export const session={acquisitionMode:'online',identity:cacheContext,detailUrl:'/detail',tocUrl:'/toc',book:{title:'Book',author:'Author'},continuationVariables:[],entries:[{index:0,title:'Chapter',url:'/chapter',variables:[]}],hostRequirements:[]};
export function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
export async function until(predicate){for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,2));}assert.fail('actual durable probe did not reach requested boundary');}
export async function fixture(official=false,existing){
 const root=existing?.root??await fsp.mkdtemp(resolve(tmpdir(),'reader-host-durable-')),files=resolve(root,'files'),core=resolve(root,'core');await fsp.mkdir(files,{recursive:true});
 const options={},calls=[],publications=[],io={finishes:0,failWrites:0,fsyncs:0};let installed,uuid=0;
 const Runtime=runtimeOwnerIdentityProbe(()=>installed);
 const fileIo={OpenMode:{READ_ONLY:fs.constants.O_RDONLY,READ_WRITE:fs.constants.O_RDWR},
  async readText(path){try{return await fsp.readFile(path,'utf8');}catch(e){if(e.code==='ENOENT')throw {code:13900002};throw e;}},
  async open(path,flags){return {fd:fs.openSync(path,flags)};},async close(handle){fs.closeSync(handle.fd);},
  async fsync(fd){fs.fsyncSync(fd);io.fsyncs++;if(options.loseFsyncAt===io.fsyncs)throw Error('actual fsync effect ACK lost');},
  AtomicFile:class{constructor(path){this.path=path;this.tmp=path+'.tmp';}
   startWrite(){if(options.failStart){options.failStart=false;throw Error('local start failed before RPC');}return {on(){},end:(raw,_encoding,callback)=>{fs.writeFileSync(this.tmp,raw);queueMicrotask(callback);}};}
   finishWrite(){fs.renameSync(this.tmp,this.path);io.finishes++;if(options.loseFinishAt===io.finishes)throw Error('actual rename published but finish ACK lost');}
   failWrite(){io.failWrites++;try{fs.unlinkSync(this.tmp);}catch{}}}};
 const replaceReaderAtomicSnapshot=compile('app/ReaderAtomicSnapshotFile.ts','replaceReaderAtomicSnapshot',{fileIo},official);
 const classes=compile('features/reading/ReadingOperationIntents.ts','({BookmarkOperationIntentStore,CacheClearOperationIntentStore,ReadingOperationPendingError})',
  {ReaderRuntimeOwner:Runtime,fileIo,util:{generateRandomUUID:()=>`12345678-1234-4234-8123-${String(++uuid).padStart(12,'0')}`},replaceReaderAtomicSnapshot,...sdk},false);
 // Each fixture loads the entire production module, resetting only cold JS statics.
 // For SDK mode emit that same whole module once, preserving its two shared lanes.
 let types=classes;
 if(official){const source=read('features/reading/ReadingOperationIntents.ts'),body=source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'');const output=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});assert.deepEqual(output.diagnostics,[]);types={};new Function('exports','ReaderRuntimeOwner','fileIo','util','replaceReaderAtomicSnapshot','ReaderCoreRequestError','isReaderCoreTransactionPendingError',output.outputText)(types,Runtime,fileIo,{generateRandomUUID:()=>`12345678-1234-4234-8123-${String(++uuid).padStart(12,'0')}`},replaceReaderAtomicSnapshot,sdk.ReaderCoreRequestError,sdk.isReaderCoreTransactionPendingError);}
 async function command(method,params){const result=await run(coreBinary,['--json',JSON.stringify({protocolVersion:1,requestId:1,method,params}),'--config-json',JSON.stringify({dataDirectory:core})],{maxBuffer:16*1024*1024});const event=result.stdout.trim().split('\n').map(v=>JSON.parse(v)).findLast(e=>e.requestId===1);if(event.type==='error')throw new sdk.ReaderCoreRequestError(event);return event;}
 const runtime={getUIAbilityContext:()=>({filesDir:files}),closed:false,
  supportsCoreCapability:()=>true,async clearOfflineBookImages(s,b){calls.push({platform:[s,b]});if(options.imageFailure)throw Error('image cleanup failed');},
  async request(method,params,requestOptions={}){calls.push({method,params:structuredClone(params),options:requestOptions});
   if(['bookmark.create','bookmark.delete','cache.clear'].includes(method)||method.endsWith('.operation.settle'))
    assert.equal(requestOptions.shouldCancel,undefined,'accepted durable actions never gain UI cancellation');
   if(options.pauseMethod===method&&!options.pauseAfterDispatch){const gate=options.gate;options.pauseMethod=undefined;await gate.promise;}
   if(requestOptions.canDispatch?.()===false)throw Error('actual adapter refused before send');
   requestOptions.onDispatch?.();
   if(options.pauseMethod===method&&options.pauseAfterDispatch){const gate=options.gate;options.pauseMethod=undefined;await gate.promise;}
   if(options.typedMethod===method){options.typedMethod=undefined;throw new sdk.ReaderCoreRequestError({type:'error',protocolVersion:1,requestId:1,error:{code:'INVALID_PARAMS',message:'typed current-call nonExecution',retryable:false,details:{domain:'reading',nonExecution:true}}});}
   if(options.beforeMethod===method){options.beforeMethod=undefined;throw Error('ACK lost before observed Core effect');}
   if(method==='cache.book.status'&&options.status){if(options.statusFailure)throw Error('status unavailable');return{data:{sourceId:params.sourceId,bookId:params.bookId,tocAvailable:true,chapters:[{chapterIndex:0,state:'missing',cachedBytes:0,title:'Chapter',url:'/chapter'}]}};}
   const event=await command(method,params);
   if(options.afterMethod===method){options.afterMethod=undefined;throw Error('ACK lost after actual durable Core effect');}
   return options.transformMethod===method?{...event,data:options.transform(event.data)}:event;}};
 const journalPath=resolve(files,'settings-text-cleanup-v2-fixture.json');
 const textPersistence={async loadLegacyProtection(){return[];},async saveLegacyProtection(){},
  async loadSettingsTextCleanup(){try{const encoded=await fsp.readFile(journalPath,'utf8');return encoded===''?undefined:JSON.parse(encoded);}catch(error){if(error.code==='ENOENT')return undefined;throw error;}},
  async saveSettingsTextCleanup(journal){await replaceReaderAtomicSnapshot(journalPath,files,journal===undefined?'':JSON.stringify(journal));}};
 const Storage=compile('features/downloads/SharedDownloadStorageGateway.ts','SharedDownloadStorageGateway',{...sdk,SharedDownloadIntentPreferences:class{}},official);
 const storageDisk={async captureReadingStorageInventory(){return{files:[],hostImageChapters:[],protectedChapters:[],writeRevision:0};},
  isReadingStorageInventoryCurrent:()=>true,async readPolicy(){return{capacityBytes:1024**3,expiryDays:7};},
  async readingStorageSummary(){return{totalBytes:0,retainedBytes:0,automaticBytes:0,cleanableBytes:0,classificationKnown:true};},
  async readingStorageBookIndex(){return new Map();},async readingStorageCleanupReceipt(){return{deletedBytes:0,deletedFiles:0};},
  async clearChapter(sourceId,bookId,chapterIndex){calls.push({textPlatform:[sourceId,bookId,chapterIndex]});}};
 runtime.readDownloadStorageBindings=async()=>({retainedChapters:[],protectedChapters:[]});
 const textStorage=new Storage(runtime,storageDisk,textPersistence);
 runtime.clearTextRebuildableCache=(evidence,current)=>textStorage.cleanupSettingsText(evidence,current);
 runtime.readSettingsTextCleanup=()=>textStorage.readSettingsTextCleanup();
 installed=runtime;
 const dirDeps={ReaderWriteEvidence,projectPersistedReceipt,LocalReadingFlowGateway,LOCAL_SOURCE_ID,loadReaderControlBookmarkProjection};
 const Directory=compile('features/reading/ReaderDirectoryHost.ts','ReaderDirectoryHost',dirDeps,official);
 const Offline=compile('features/reading/ReadingOfflineHost.ts','ReadingOfflineHost',{ReaderWriteEvidence,projectPersistedReceipt,ReadingOfflineGateway,MangaDownloadActionsGateway},official);
 const SettingsGateway=compile('features/settings/SettingsCacheGateway.ts','SettingsCacheGateway',{CacheClearOperationIntentStore:types.CacheClearOperationIntentStore},official);
 const SettingsOwner=compile('features/settings/SettingsCacheCleanupOwner.ts','SettingsCacheCleanupOwner',{ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,projectOperationFacts,formatDownloadStorageBytes,SettingsCacheGateway:SettingsGateway},official);
 const general=actualGeneralSettingsFixture();general.setActive(runtime);
 general.Runtime.isCurrent=owner=>Runtime.isCurrent(owner);general.Runtime.current=()=>Runtime.current();
 const generalHost=new general.Host(()=>{},()=>({autoCheckUpdate:true,tapBottomScrollTop:true,reduceMotion:false,crashLog:true,developerMode:false}),()=>true,()=>runtime.getUIAbilityContext());
 assert.equal(generalHost.bindPresentation(runtime,'reading-cache-general-factory',()=>Runtime.isCurrent(runtime)),true);
 const SettingsHost=compile('features/settings/SettingsHost.ets','SettingsHost',{ReaderRuntimeOwner:Runtime,SettingsCacheCleanupOwner:SettingsOwner,SettingsOrchestrator:generalHost.orchestrator.constructor},official);
 const bookmarkStore=new types.BookmarkOperationIntentStore(runtime,()=>Runtime.isCurrent(runtime)),clearStore=new types.CacheClearOperationIntentStore(runtime,()=>Runtime.isCurrent(runtime));
 const directory=Directory.forRuntime(runtime,()=>Runtime.isCurrent(runtime),undefined,bookmarkStore),offline=Offline.forRuntime(runtime,()=>Runtime.isCurrent(runtime),undefined,clearStore),settings=SettingsOwner.forRuntime(runtime,v=>publications.push(structuredClone(v)));
 let entries=[{index:0,title:'Chapter',level:2,downloadState:'completed',bookmarks:[]}],route=true;
 const dirBinding={book,current:()=>route,currentEntries:()=>entries,emitEntries:v=>entries=v,emitOperation:v=>publications.push(structuredClone(v)),failed:e=>publications.push({error:e.message})};
 const offlineBinding={session,current:()=>route,currentEntries:()=>entries,emitEntries:v=>entries=v,emitOperation:v=>publications.push(structuredClone(v)),failed:e=>publications.push({error:e.message})};
 return{root,files,core,types,Runtime,runtime,options,io,calls,publications,command,bookmarkStore,clearStore,directory,offline,settings,SettingsOwner,SettingsGateway,SettingsHost,dirBinding,offlineBinding,Directory,Offline,
  entries:()=>entries,setEntries:v=>entries=v,retire:()=>{route=false;},unset:()=>{installed=undefined;},install:o=>{installed=o;},
  create:()=>directory.createPosition(bookmarkInput,dirBinding),clear:()=>offline.clearBook(offlineBinding),
  reads:()=>calls.filter(c=>c.method?.endsWith('.query')),writes:()=>calls.filter(c=>['bookmark.create','bookmark.delete','cache.clear','cache.storage.cleanup'].includes(c.method)),
  disk:domain=>fs.readFileSync(resolve(files,domain==='bookmark'?'reader-bookmark-intent-v1.json':'reader-cache-clear-intent-v1.json'),'utf8')};
}
export {ReaderWriteEvidence};

// Create a pre-upgrade Settings intent with the actual old Core/atomic Store.
// Live Settings never calls this unsafe scope. Only fixtures use it to seed
// history whose existing qualified receipt must still be readable/settleable.
export async function seedLegacySettingsClear(f) {
 const evidence=new ReaderWriteEvidence();let report,error;
 try{report=await f.clearStore.execute('cache.clear',{scope:'cache'},{sourceId:'cache',bookId:'global-text'},
  data=>new f.SettingsGateway(f.runtime).decode(data),evidence,()=>true);}catch(issue){error=issue;}
 return{evidence,report,error};
}
