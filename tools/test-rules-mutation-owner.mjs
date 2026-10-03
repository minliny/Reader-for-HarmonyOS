import assert from 'node:assert/strict';
import { registerHooks, createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {RulesMutationOwner}=await import('../entry/src/main/ets/features/settings/RulesMutationOwner.ts');
const {ReaderControlReplaceGateway}=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGateway.ts');
const {ReaderReplaceQuickGateway}=await import('../entry/src/main/ets/features/reading/ReaderReplaceQuickGateway.ts');
const {ReaderWriteEvidence}=await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const scheduler=await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const quickState=await import('../entry/src/main/ets/features/reading/ReaderReplaceQuickState.ts');
const {errorMessageOf}=await import('../entry/src/main/ets/app/ErrorMessage.ts');
const state=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const {bookshelfOperationClass}=await import('./lib/bookshelf-operation-owner-probe.mjs');
const compilerRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=createRequire(import.meta.url)(compilerRoot+'/node_modules/typescript');
const source=path=>readFileSync(new URL('../entry/src/main/ets/'+path,import.meta.url),'utf8');
const compile=(raw,name,deps)=>new Function(...Object.keys(deps),ts.transpileModule(raw.replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''),
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText+`;return ${name};`)(...Object.values(deps));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(r=>setTimeout(r,0));
const row=()=>({id:1,name:'规则',pattern:'old',replacement:'new',isEnabled:true,isRegex:false,order:0,
  scopeTitle:false,scopeSource:false,scopeContent:true,timeoutMillisecond:3000,group:'',scope:'',excludeScope:''});
const Direct=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),['requestDirect'],{
  DEFAULT_CORE_REQUEST_TIMEOUT_MS:15000,coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,hilog:{warn(){}}});
let current;
const RuntimeAuthority={current:()=>current,isCurrent:owner=>owner===current&&owner.live};
const ManagementGateway=bookshelfOperationClass('features/settings/RulesManagementGateway.ts','RulesManagementGateway',
  {ReaderRuntimeOwner:RuntimeAuthority,RulesMutationOwner});
const Orchestrator=bookshelfOperationClass('features/settings/RulesManagementOrchestrator.ets','RulesManagementOrchestrator',{
  ReaderRuntimeOwner:RuntimeAuthority,ReaderWriteEvidence,RulesManagementGateway:ManagementGateway,
  SourceGateway:class{observeWrites(){}},RssGateway:class{observeWrites(){}},
  ...(await import('../entry/src/main/ets/app/ReaderOperationFacts.ts')),
  ...(await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts')),hilog:{error(){}}});
function fixture(){
  const runtime=new Direct();Object.assign(runtime,{live:true,state:'ready',preparationIntentEpoch:0,stored:row(),calls:[],startup:undefined,ack:undefined,lost:false,bad:false});
  runtime.readingEntryPreparations=()=>({beginRequest:()=>false,finishRequest(){}});runtime.wakeReadingPreparations=()=>{};
  runtime.start=async()=>{if(runtime.startup)await runtime.startup.promise;};
  runtime.runtime={async request(method,params,options){runtime.calls.push({method,params:structuredClone(params),options});
    if(method==='replace-rule.list')return{data:{rules:[structuredClone(runtime.stored)]}};
    if(['txt-toc-rule.list','dict-rule.list'].includes(method))return{data:{rules:[]}};
    if(method==='rule-sub.list')return{data:{subs:[]}};
    if(method==='replace.validate')return{data:{valid:true}};
    if(method==='replace.persist'){
      runtime.stored={...runtime.stored,...params.params};if(runtime.ack)await runtime.ack.promise;
      if(runtime.lost)throw Error('original write committed; ACK lost');
      return{data:{operation:params.operation,data:params.operation==='delete'?{id:params.params.id,deleted:true}:{rule:{...runtime.stored,id:runtime.bad?99:runtime.stored.id}}}};
    }
    if(method==='rule-bundle.import')return{data:{schemaVersion:1,replaceExisting:params.replaceExisting,counts:{replaceRules:1,dictRules:0,txtTocRules:0,ruleSubscriptions:0}}};
    throw Error('unexpected method '+method);
  }};
  runtime.request=runtime.requestDirect.bind(runtime);current=runtime;
  return{runtime,quick:new ReaderReplaceQuickGateway(runtime),full:new ReaderControlReplaceGateway(runtime),management:new ManagementGateway(runtime),owner:RulesMutationOwner.forRuntime(runtime)};
}
{
 const f=fixture();f.runtime.startup=deferred();let visible=true;
 const promise=f.quick.setRuleEnabled(1,false,()=>visible);await tick();visible=false;f.runtime.startup.resolve();
 await assert.rejects(promise,e=>e.writeUncertain===false);assert.equal(f.runtime.calls.length,0);
 assert.equal(f.owner.snapshot().confirmation,'undispatched');
 await f.quick.setRuleEnabled(1,false,()=>true);assert.equal(f.owner.snapshot().confirmation,'confirmed');
 assert.equal(f.runtime.calls[0].options.onDispatch,undefined,'the native SDK receives no presentation hook');
}
{
 const f=fixture();f.runtime.lost=true;await assert.rejects(f.quick.setRuleEnabled(1,false),e=>e.writeUncertain);
 assert.equal(f.runtime.stored.isEnabled,false);assert.equal(f.owner.snapshot().confirmation,'unknown');
 await f.full.loadRules();assert.equal(f.owner.snapshot().confirmation,'unknown','matching current rows do not identify the original receipt');
 const count=f.runtime.calls.length;
 await assert.rejects(new ReaderControlReplaceGateway(f.runtime).deleteRule(1),e=>e.writeUncertain);
 await assert.rejects(f.management.deleteReplaceRule(1),e=>e.writeUncertain);
 assert.equal(f.runtime.calls.length,count,'both reader forms and settings share the same blocked original rule domain');
 let s=state.beginReaderControlReplaceLoad(state.createReaderControlReplaceState('same-runtime'));
 s=state.admitReaderControlReplaceLoad(s,state.readerControlReplaceTicket(s),[f.runtime.stored]);
 s=state.beginReaderControlReplaceMutation(s);s=state.failReaderControlReplaceRequest(s,state.readerControlReplaceTicket(s),'lost',true);
 s=state.beginReaderControlReplaceLoad(s);s=state.admitReaderControlReplaceLoad(s,state.readerControlReplaceTicket(s),[f.runtime.stored]);
 assert.throws(()=>state.beginReaderControlReplaceMutation(s));assert.equal(s.writeUncertain,true);
 const snapshots=[];const host=new Orchestrator(s=>snapshots.push(s),()=>true,f.runtime);host.open();await host.operationTail;
 host.deleteReplaceRule(1);await host.operationTail;
 assert.equal(snapshots.at(-1).receipt.receipt.confirmation,'unknown');assert.equal(f.runtime.calls.filter(c=>c.method==='replace.persist').length,1);
}
{
 const f=fixture();f.runtime.ack=deferred();let visible=true;
 const original=f.quick.setRuleEnabled(1,false,()=>visible);await tick();visible=false;
 await assert.rejects(f.management.deleteReplaceRule(1),/正在执行/);
 f.runtime.ack.resolve();assert.equal((await original).isEnabled,false);assert.equal(f.owner.snapshot().confirmation,'confirmed');
 assert.equal(f.runtime.calls.filter(c=>c.method==='replace.persist').length,1);
 await f.management.deleteReplaceRule(1);assert.equal(f.owner.snapshot().confirmation,'confirmed');
}
{
 const f=fixture();f.runtime.bad=true;const evidence=new ReaderWriteEvidence();f.management.observeWrites(evidence,()=>true);
 await assert.rejects(f.management.saveReplaceRule({name:'规则',pattern:'old',replacement:'new',isEnabled:true,isRegex:false,order:0,id:1}),e=>e.writeUncertain);
 assert.equal(evidence.confirmation(),'unknown');assert.equal(f.owner.snapshot().confirmation,'unknown');
}
{
 const sdk=boundedSurfaceSdk();
 const page=sdk.consumer(readFileSync(new URL('../entry/src/main/ets/features/settings/RulesManagementPage.ets',import.meta.url),'utf8'),
   ['actionButton','smallButton']);
 Object.assign(page,{snapshot:{busy:false,receipt:{receipt:{confirmation:'unknown'}}},appThemeScheme:'day'});
 let writes=0,reads=0,edits=0;
 page.actionButton('save',true,()=>writes++);page.actionButton('export',true,()=>reads++,false);page.smallButton('edit',()=>edits++,false);
 for(const node of sdk.nodes(page).filter(n=>n.type==='Text'))node.onClick?.();
 assert.equal(writes,0);assert.equal(reads,1);assert.equal(edits,1,'unknown restricts mutations, retaining read/export/draft editing');
 const save=sdk.nodes(page).find(n=>n.create==='save');assert.equal(save.opacity,0.62);
 page.snapshot={busy:false,receipt:{receipt:{confirmation:'confirmed'}}};page.replay();save.onClick();
 assert.equal(writes,1);assert.equal(save.opacity,1,'normal baseline styling and action return after a qualified original ACK');
}
// Production negative controls: the same actual Gateway/Runtime chain detects
// removing the final captured admission, and the same state journey detects
// incorrectly settling a command from a successful current-data read.
{
 const raw=source('features/settings/RulesMutationOwner.ts');
 const marker='this.state.generation === generation && this.state.busy && current()';assert.ok(raw.includes(marker));
 const mutant=compile(raw.replace(marker,'this.state.generation === generation && this.state.busy'),
  '({RulesMutationOwner,RulesMutationError})',{...scheduler,ReaderWriteEvidence});
 const BadQuick=compile(source('features/reading/ReaderReplaceQuickGateway.ts'),'ReaderReplaceQuickGateway',
  {...mutant,...quickState,errorMessageOf});
 const f=fixture();f.runtime.startup=deferred();let visible=true;
 const promise=new BadQuick(f.runtime).setRuleEnabled(1,false,()=>visible);await tick();visible=false;f.runtime.startup.resolve();await promise;
 assert.throws(()=>assert.equal(f.runtime.calls.length,0),'the final-boundary scenario rejects the admission-bypass mutant');
 const stateRaw=source('features/reading/ReaderControlReplaceState.ts');
 const badState=compile(stateRaw.replace('next.writeUncertain = state.writeUncertain;', 'next.writeUncertain = false;'),
  '({admitReaderControlReplaceLoad})',quickState);
 let s=state.beginReaderControlReplaceLoad(state.createReaderControlReplaceState('negative-control'));
 s=state.admitReaderControlReplaceLoad(s,state.readerControlReplaceTicket(s),[row()]);s=state.beginReaderControlReplaceMutation(s);
 s=state.failReaderControlReplaceRequest(s,state.readerControlReplaceTicket(s),'lost',true);s=state.beginReaderControlReplaceLoad(s);
 const admitted=badState.admitReaderControlReplaceLoad(s,state.readerControlReplaceTicket(s),[row()]);
 assert.throws(()=>assert.equal(admitted.writeUncertain,true),'the original unknown scenario rejects list-based settlement');
}
console.log('PASS actual SDK-emitted Runtime dispatch -> reader/quick/settings rule Gateways and original Orchestrator: startup retirement, shared unknown barrier, pure matching read, late original ACK and qualified evidence. Cold Core rule receipts and OS execution remain separate.');
