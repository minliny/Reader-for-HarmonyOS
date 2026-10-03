import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const sdk=await import('../../entry/vendor/core-harmony/sdk/reader_core.ts');
const scheduler=await import('../../entry/src/main/ets/app/BookRequestScheduler.ts');
const {ReaderWriteEvidence}=await import('../../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const run=promisify(execFile),require=createRequire(import.meta.url),loader=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(loader+'/node_modules/typescript'),host=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>fs.readFileSync(resolve(host,'entry/src/main/ets',p),'utf8');
export const binary=resolve(process.env.READER_RULES_RECEIPT_CORE_ROOT??resolve(host,'../Reader-Core-Native'),'target/debug/reader-cli');
export function compile(p,name,deps,official=false,source=read(p)) {
 const body=source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'');
 if(!official)return new Function(...Object.keys(deps),stripTypeScriptTypes(body).replace(/^export /gm,'')+`;return ${name==='*'?'({'+[...source.matchAll(/^export (?:async )?(?:class|const|function) ([A-Za-z0-9_]+)/gm)].map(m=>m[1]).join(',')+'})':name};`)(...Object.values(deps));
 const tree=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.deepEqual(tree.parseDiagnostics,[],p+' installed SDK syntax');
 const emitted=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS,strict:true},reportDiagnostics:true,fileName:p});assert.deepEqual(emitted.diagnostics,[]);
 const exports={};new Function('exports',...Object.keys(deps),emitted.outputText)(exports,...Object.values(deps));return name==='*'?exports:exports[name];
}
export const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return{promise,resolve,reject};};
export const until=async check=>{for(let i=0;i<200;i++){if(check())return;await new Promise(r=>setTimeout(r,5));}throw Error('bounded wait failed');};
export async function fixture(official=false,existing,mutantSource) {
 const root=existing?.root??await fsp.mkdtemp(resolve(tmpdir(),'reader-rules-durable-')),files=resolve(root,'files'),core=resolve(root,'core');await fsp.mkdir(files,{recursive:true});
 const options={},calls=[],io={finishes:0,syncs:0,failWrites:0};let installed,uuid=0;
 const Runtime={isCurrent:o=>installed===o&&!o.closed,current:()=>{if(!installed)throw Error('Runtime unavailable');return installed;}};
 const fileIo={OpenMode:{READ_ONLY:fs.constants.O_RDONLY,READ_WRITE:fs.constants.O_RDWR},
  async readText(path){try{return await fsp.readFile(path,'utf8');}catch(e){if(e.code==='ENOENT')throw{code:13900002};throw e;}},
  async open(path,flags){return{fd:fs.openSync(path,flags)};},async close(f){fs.closeSync(f.fd);},
  async fsync(fd){fs.fsyncSync(fd);io.syncs++;if(options.loseSyncAt===io.syncs)throw Error('fsync accepted; ACK lost');},
  AtomicFile:class{constructor(path){this.path=path;this.tmp=path+'.tmp';}startWrite(){if(options.beforeLocal){options.beforeLocal=false;throw Error('startWrite rejected before local side effect');}return{on(){},end:(raw,_encoding,done)=>{fs.writeFileSync(this.tmp,raw);queueMicrotask(done);}};}
   finishWrite(){fs.renameSync(this.tmp,this.path);io.finishes++;if(options.loseFinishAt===io.finishes)throw Error('rename accepted; ACK lost');}failWrite(){io.failWrites++;try{fs.unlinkSync(this.tmp);}catch{}}}};
 const atomic=compile('app/ReaderAtomicSnapshotFile.ts','replaceReaderAtomicSnapshot',{fileIo},official);
 const methods=compile('features/settings/RulesMutationContract.ts','RULES_MUTATION_METHODS',{},official);
 const Store=compile('features/settings/RulesMutationIntentStore.ts','RulesMutationIntentStore',{ReaderRuntimeOwner:Runtime,fileIo,util:{generateRandomUUID:()=>`12345678-1234-4234-8123-${String(++uuid).padStart(12,'0')}`},replaceReaderAtomicSnapshot:atomic,RULES_MUTATION_METHODS:methods},official);
 const ownerDeps={...scheduler,ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,RULES_MUTATION_METHODS:methods,RulesMutationIntentStore:Store};
 const ownerTypes=compile('features/settings/RulesMutationOwner.ts','*',ownerDeps,official,mutantSource??read('features/settings/RulesMutationOwner.ts')),Owner=ownerTypes.RulesMutationOwner;
 async function command(method,params={}) { const result=await run(binary,['--json',JSON.stringify({protocolVersion:1,requestId:1,method,params}),'--config-json',JSON.stringify({dataDirectory:core})],{maxBuffer:32*1024*1024});const event=result.stdout.trim().split('\n').map(l=>JSON.parse(l)).findLast(e=>e.requestId===1);if(event.type==='error')throw new sdk.ReaderCoreRequestError(event);return event; }
 const runtime={closed:false,getUIAbilityContext:()=>({filesDir:files}),supportsCoreCapability:()=>options.capability!==false,
  async request(method,params={},requestOptions={}) {calls.push({method,params:structuredClone(params),options:requestOptions});
   if(options.beforeStart===method){const gate=options.gate;options.beforeStart=undefined;await gate.promise;}
   if(requestOptions.canDispatch?.()===false)throw new scheduler.BookRequestNotDispatchedError('original final admission denied');
   if(method==='rules.mutation.apply')assert.equal(requestOptions.shouldCancel,undefined,'durable command has no retired UI cancellation');
   requestOptions.onDispatch?.();
   if(options.pauseMethod===method){const gate=options.gate;options.pauseMethod=undefined;await gate.promise;}
   if(options.beforeMethod===method){options.beforeMethod=undefined;throw Error('lost ACK before observed Core effect');}
   const event=await command(method,params);
   if(options.afterMethod===method){options.afterMethod=undefined;throw Error('lost ACK after actual cold SQLite commit');}
   return options.transformMethod===method?{...event,data:options.transform(event.data)}:event;}};
 installed=runtime;
 const Gateway=compile('features/settings/RulesManagementGateway.ts','RulesManagementGateway',{ReaderRuntimeOwner:Runtime,RulesMutationOwner:Owner},official);
 const commonReplace={RulesMutationOwner:Owner,RulesMutationError:ownerTypes.RulesMutationError,...(await import('../../entry/src/main/ets/features/reading/ReaderReplaceQuickState.ts')),...(await import('../../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts')),...(await import('../../entry/src/main/ets/app/ErrorMessage.ts'))};
 const quickTypes=compile('features/reading/ReaderReplaceQuickGateway.ts','*',commonReplace,official),Quick=quickTypes.ReaderReplaceQuickGateway;
 const fullTypes=compile('features/reading/ReaderControlReplaceGateway.ts','*',{...commonReplace,...quickTypes,RulesManagementGateway:Gateway},official),Full=fullTypes.ReaderControlReplaceGateway;
 const gateway=new Gateway(runtime),owner=Owner.forRuntime(runtime),store=new Store(runtime);
 return{root,core,files,options,calls,io,runtime,Runtime,Owner,Store,Gateway,Full,Quick,FullError:fullTypes.ReaderControlReplaceGatewayError,gateway,owner,store,command,
  disk:()=>{try{return fs.readFileSync(resolve(files,'reader-rules-mutation-intent-v1.json'),'utf8');}catch(e){if(e.code==='ENOENT')return'';throw e;}},
  writes:()=>calls.filter(c=>c.method==='rules.mutation.apply'),retire:()=>{runtime.closed=true;installed=undefined;},install:o=>{installed=o;},
  recover:retry=>gateway.recoverMutation(()=>Runtime.isCurrent(runtime),retry),
  save:()=>gateway.saveDictRule({name:'dict',urlRule:'https://dict.invalid/{{key}}',showRule:'$.definition',enabled:true,sortNumber:0}),
  actualSource:()=>read('features/settings/RulesMutationOwner.ts')};
}
export {ReaderWriteEvidence};

/** Installed SDK AST selects the actual existing private method. No copied
 * scheduler/dispatch algorithm and no production bootstrap dependency cycle. */
export function actualRuntimeDirect() {
 const path='app/ReaderRuntimeOwner.ts',source=read(path),tree=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.deepEqual(tree.parseDiagnostics,[]);
 const klass=tree.statements.find(n=>ts.isClassDeclaration(n)&&n.name.text==='ReaderRuntimeOwner');
 const method=klass.members.find(n=>ts.isMethodDeclaration(n)&&n.name.getText(tree)==='requestDirect');assert.ok(method);
 const methods=compile('features/settings/RulesMutationContract.ts','RULES_MUTATION_METHODS',{},true);
 const effects=compile('app/ReaderRuleMutationEffects.ts','readerRuleMutationEffects',{RULES_MUTATION_METHODS:methods},true);
 return compile(path,'ActualRuntimeDirect',{...scheduler,readerRuleMutationEffects:effects,ReaderCoreNotDispatchedError:scheduler.BookRequestNotDispatchedError,DEFAULT_CORE_REQUEST_TIMEOUT_MS:30000,coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,LOG_DOMAIN:0,hilog:{warn(){}}},true,
  'export class ActualRuntimeDirect {\n'+method.getText(tree)+'\n}');
}
