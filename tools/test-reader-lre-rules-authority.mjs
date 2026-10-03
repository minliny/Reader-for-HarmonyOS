import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const states=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const quick=await import('../entry/src/main/ets/features/reading/ReaderReplaceQuickState.ts');
const {RulesMutationOwner}=await import('../entry/src/main/ets/features/settings/RulesMutationOwner.ts');
const {ReaderControlReplaceGateway,ReaderControlReplaceGatewayError}=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGateway.ts');
const {BookRequestNotDispatchedError}=await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const {readerControlReplaceEndpoint}=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
let current;
const RuntimeAuthority={current:()=>{if(!current)throw Error('runtime unavailable');return current;}};
const file=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
const names=['readerReplaceRuntimeCurrent','projectReaderReplaceWriteFacts','controlReplaceCurrent','openQuickReplace',
 'reloadControlReplace','runControlReplaceMutation','saveControlReplace','toggleQuickReplaceRule','beginReplaceMutation',
 'isReplaceMutationCurrent','finishReplaceMutation','invalidateReplaceMutationOwner'];
const deps={...states,...quick,ReaderRuntimeOwner:RuntimeAuthority,ReaderControlReplaceGatewayError,
 readerControlContentLocation:s=>s.location};
const Host=productionMotionMethods(file,names,deps);
const Direct=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),['requestDirect'],{
 DEFAULT_CORE_REQUEST_TIMEOUT_MS:15000,coreAdmissionFailureSummary:()=>undefined,httpResponseFailureSummary:()=>undefined,hilog:{warn(){}},
 BookRequestNotDispatchedError});
const deferred=()=>{let resolve,reject;return{promise:new Promise((a,b)=>{resolve=a;reject=b;}),resolve,reject};};
const tick=()=>new Promise(r=>setTimeout(r,0));
const row=()=>({id:1,name:'真实规则',pattern:'old',replacement:'new',isEnabled:true,isRegex:false,order:0,
 scopeTitle:false,scopeSource:false,scopeContent:true,timeoutMillisecond:3000,group:'',scope:'',excludeScope:''});
function fixture() {
 const runtime=new Direct();Object.assign(runtime,{state:'ready',preparationIntentEpoch:0,stored:row(),calls:[],gate:undefined,ack:undefined,lost:false});
 runtime.readingEntryPreparations=()=>({beginRequest:()=>false,finishRequest(){}});runtime.wakeReadingPreparations=()=>{};
 runtime.start=async()=>{if(runtime.gate)await runtime.gate.promise;};
 runtime.runtime={async request(method,params,options){runtime.calls.push({method,params:structuredClone(params),options});
  if(method==='replace-rule.list')return{data:{rules:[{...runtime.stored}]}};
  if(method==='replace.validate')return{data:{valid:true}};
  if(method==='replace.persist'){
   runtime.stored={...runtime.stored,...params.params};if(runtime.ack)await runtime.ack.promise;
   if(runtime.lost)throw Error('durable accepted rule; original ACK lost');
   return{data:{operation:params.operation,data:{rule:{...runtime.stored}}}};
  }
  throw Error('unexpected IO '+method);
 }};
 runtime.request=runtime.requestDirect.bind(runtime);current=runtime;
 const shared=RulesMutationOwner.forRuntime(runtime),gateway=new ReaderControlReplaceGateway(runtime);
 const create=()=>{
  const owner=new Host(),initial=states.beginReaderControlReplaceLoad(states.createReaderControlReplaceState('s:b:1'));
  Object.assign(owner,{replaceRuntime:runtime,rulesMutationOwner:shared,replaceGateway:gateway,
   controlReplaceState:states.admitReaderControlReplaceLoad(initial,states.readerControlReplaceTicket(initial),[row()]),
   replaceState:quick.createReaderReplaceQuickState([row()]),mounted:true,visible:true,page:'quickReplace',lifecycleToken:1,
   sourceId:'s',bookId:'b',bookTitle:'当前书',replacePanelGeneration:1,replaceMutationGeneration:0,
   replaceMutationActiveGeneration:-1,replaceMutationActiveLifecycleToken:-1,replaceMutationActiveBookId:'',replaceMutationActiveRuleId:-1,
   controlSession:{location:{module:'replace'}},reloads:0,notices:[],
   controlVisible(){return this.visible;},controlPage(){return this.page;},
   isSessionActive(t){return this.mounted&&t===this.lifecycleToken;},
   setControlPage(p){this.page=p;},persistBeforeContentMutation:async()=>()=>true,
   reloadCurrentPageAfterReplacePersist(){this.reloads++;},errorMessage:e=>e.message,
   showReaderAlert(_id,o){this.notices.push(o);},
  });return owner;
 };
 return{runtime,shared,gateway,create,owner:create(),writes:()=>runtime.calls.filter(c=>c.method==='replace.persist')};
}
const results=[];
{
 const f=fixture();f.runtime.gate=deferred();f.owner.toggleQuickReplaceRule(1,false);await tick();
 f.owner.visible=false;f.owner.replacePanelGeneration++;f.runtime.gate.resolve();await tick();
 assert.equal(f.writes().length,0);assert.equal(f.shared.snapshot().confirmation,'undispatched');assert.equal(f.owner.notices.length,0);
 results.push('Quick: closure during actual Runtime start rejects before SDK dispatch');
}
{
 const f=fixture();f.runtime.lost=true;f.owner.toggleQuickReplaceRule(1,false);await tick();
 assert.equal(f.shared.snapshot().confirmation,'unknown');assert.equal(f.owner.replaceState.rules[0].isEnabled,true);
 assert.equal(f.owner.controlReplaceState.writeUncertain,true);assert.equal(f.owner.notices.length,1);
 await f.owner.reloadControlReplace();assert.equal(f.owner.controlReplaceState.writeUncertain,true,'matching read retains original unknown');
 const reentered=f.create();reentered.page='home';reentered.openQuickReplace();await tick();
 assert.equal(reentered.controlReplaceState.writeUncertain,true,'same Runtime new reading presentation consumes shared facts');
 await assert.rejects(reentered.saveControlReplace({...states.createReaderControlReplaceDraft(row()),replacement:'later'}));
 assert.equal(f.writes().length,1);assert.equal(reentered.controlReplaceState.rules[0].replacement,'new');
 results.push('lost ACK: reopen, fresh LRE and list read cannot clear shared authority or change displayed switch');
}
{
 const f=fixture();f.runtime.ack=deferred();f.owner.toggleQuickReplaceRule(1,false);await tick();
 f.owner.visible=false;f.owner.replacePanelGeneration++;f.runtime.ack.resolve();await tick();
 assert.equal(f.shared.snapshot().confirmation,'confirmed');assert.equal(f.owner.replaceState.rules[0].isEnabled,true);
 assert.equal(f.owner.reloads,1,'accepted original write still invalidates original mounted content after closing only panel');
 results.push('late exact ACK: panel remains closed; original book content invalidates once');
}
{
 const f=fixture();f.runtime.ack=deferred();f.owner.toggleQuickReplaceRule(1,false);await tick();
 f.owner.sourceId='different';f.runtime.ack.resolve();await tick();
 assert.equal(f.shared.snapshot().confirmation,'confirmed');assert.equal(f.owner.reloads,0);assert.equal(f.owner.notices.length,0);
 assert.equal(f.owner.replaceState.rules[0].isEnabled,true);results.push('late exact ACK: same book ID in successor source is not original owner');
}
{
 const f=fixture();f.runtime.gate=deferred();f.owner.toggleQuickReplaceRule(1,false);await tick();
 current={};f.runtime.gate.resolve();await tick();assert.equal(f.writes().length,0);assert.equal(f.shared.snapshot().confirmation,'undispatched');
 results.push('retired Runtime: no borrowed successor runtime and no original dispatch');
}
{
 const f=fixture();f.runtime.lost=true;
 const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url),'utf8');
 const sdk=boundedSurfaceSdk(),ui=sdk.consumer(source,['editorActions','readyInput','fullInput','quickInput','saveEditor','perform','dismissTemporaryLayer','cancelTemporaryLayer'],{
  readerControlReplaceEndpoint,errorMessageOf:e=>e.message,
 });
 const draft=states.createReaderControlReplaceDraft(row());draft.replacement='durable new';
 Object.assign(ui,{layer:'editor',state:f.owner.controlReplaceState,draft,appThemeScheme:'day',motionProgress:1,interactionEnabled:true,
  localPending:false,localError:'',presentationRevision:1,onTemporaryLayerChange(){},onSave:d=>f.owner.saveControlReplace(d)});
 ui.editorActions();const save=sdk.nodes(ui).find(n=>n.create==='保存');assert.equal(save.enabled,true);save.onClick();await tick();await tick();
 assert.equal(f.shared.snapshot().confirmation,'unknown');assert.equal(ui.layer,'editor');assert.strictEqual(ui.draft,draft);
 assert.match(ui.localError,/未确认/);ui.state=f.owner.controlReplaceState;ui.replay();sdk.properties.flush();assert.equal(save.enabled,false);
 const count=f.writes().length;save.onClick();await tick();assert.equal(f.writes().length,count);
 await f.owner.reloadControlReplace();ui.state=f.owner.controlReplaceState;ui.replay();sdk.properties.flush();assert.equal(save.enabled,false);
 assert.strictEqual(ui.draft,draft);assert.equal(ui.layer,'editor');results.push('actual SDK footer → actual LRE/Gateway: unknown retains draft, closes no layer and matching list cannot enable Save');
}
// Actual-method negative control: removing the producer's captured guard lets
// an old Quick callback enter real Runtime/SDK after closing its presentation.
{
 const original=readFileSync(file,'utf8'),marker='setRuleEnabled(ruleId, isEnabled, canDispatch)';assert.ok(original.includes(marker));
 const temporary=mkdtempSync(join(tmpdir(),'reader-lre-rules-mutant-')),mutantFile=join(temporary,'LocalReadingExperience.ets');
 writeFileSync(mutantFile,original.replace(marker,'setRuleEnabled(ruleId, isEnabled)'));
 const bad=productionMotionMethods(mutantFile,names,deps);rmSync(temporary,{recursive:true});
 const f=fixture(),owner=f.owner;for(const n of names)if(typeof bad.prototype[n]==='function')owner[n]=bad.prototype[n];
 f.runtime.gate=deferred();owner.toggleQuickReplaceRule(1,false);await tick();owner.visible=false;owner.replacePanelGeneration++;
 f.runtime.gate.resolve();await tick();assert.equal(f.writes().length,1,'the same actual negative control proves the producer guard is necessary');
}
console.log('PASS actual LRE/shared Rules owner/Runtime direct/SDK contracts:',results.length,results,'Cold Core exact Rules receipts, native execution and target UI remain separate.');
