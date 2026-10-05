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
import { fixture as durableFixture, until } from './lib/rules-mutation-durable-probe.mjs';

const {BookRequestNotDispatchedError}=await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const {readerControlReplaceEndpoint}=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const file=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url);
const names=['readerReplaceRuntimeCurrent','projectReaderReplaceWriteFacts','controlReplaceCurrent','openQuickReplace',
 'reloadControlReplace','runControlReplaceMutation','saveControlReplace','toggleQuickReplaceRule','beginReplaceMutation',
 'isReplaceMutationCurrent','finishReplaceMutation','invalidateReplaceMutationOwner'];
const deferred=()=>{let resolve,reject;return{promise:new Promise((a,b)=>{resolve=a;reject=b;}),resolve,reject};};
const tick=()=>new Promise(r=>setTimeout(r,0));
const row=()=>({id:1,name:'规则',pattern:'old',replacement:'new',isEnabled:true,isRegex:false,order:0,
 scopeTitle:false,scopeSource:false,scopeContent:true,timeoutMillisecond:3000,group:'',scope:'',excludeScope:''});
async function fixture() {
 const actual=await durableFixture(true),runtime=actual.runtime;
 await actual.command('replace-rule.create',row());
 const shared=actual.owner,gateway=new actual.Full(runtime);
 const deps={...states,...quick,ReaderRuntimeOwner:actual.Runtime,RulesMutationOwner:actual.Owner,
  ReaderControlReplaceGatewayError:actual.FullError,readerControlContentLocation:s=>s.location};
 const Host=productionMotionMethods(file,names,deps);
 const create=()=>{
  const owner=new Host(),initial=states.beginReaderControlReplaceLoad(states.createReaderControlReplaceState('s:b:1'));
  Object.assign(owner,{replaceRuntime:runtime,rulesMutationOwner:shared,replaceGateway:gateway,
   controlReplaceState:states.admitReaderControlReplaceLoad(initial,states.readerControlReplaceTicket(initial),[row()]),
   replaceState:quick.createReaderReplaceQuickState([row()]),mounted:true,visible:true,page:'quickReplace',lifecycleToken:1,
   sourceId:'s',bookId:'b',bookTitle:'当前书',replacePanelGeneration:1,replaceMutationGeneration:0,
   replaceMutationActiveGeneration:-1,replaceMutationActiveLifecycleToken:-1,replaceMutationActiveBookId:'',replaceMutationActiveRuleId:-1,
   controlSession:{location:{module:'replace'}},reloads:0,notices:[],
   controlVisible(){return this.visible;},controlPage(){return this.page;},isSessionActive(t){return this.mounted&&t===this.lifecycleToken;},
   setControlPage(p){this.page=p;},persistBeforeContentMutation:async()=>()=>true,
   reloadCurrentPageAfterReplacePersist(){this.reloads++;},errorMessage:e=>e.message,showReaderAlert(_id,o){this.notices.push(o);},
  });return owner;
 };
 return{...actual,shared,gateway,create,deps,owner:create()};
}
const results=[];
{
 const f=await fixture();f.options.gate=deferred();f.options.beforeStart='rules.mutation.query';f.owner.toggleQuickReplaceRule(1,false);await until(()=>f.calls.some(c=>c.method==='rules.mutation.query'));
 f.owner.visible=false;f.owner.replacePanelGeneration++;f.options.gate.resolve();await tick();
 assert.equal(f.writes().length,0);assert.equal(f.shared.snapshot().confirmation,'undispatched');assert.equal(f.owner.notices.length,0);
 results.push('Quick: closure during actual Runtime start rejects before SDK dispatch');
}
{
 const f=await fixture();f.options.afterMethod='rules.mutation.apply';f.owner.toggleQuickReplaceRule(1,false);await until(()=>f.owner.controlReplaceState.writeUncertain);
 assert.equal(f.shared.snapshot().confirmation,'unknown');assert.equal(f.owner.replaceState.rules[0].isEnabled,true);
 assert.equal(f.owner.controlReplaceState.writeUncertain,true);assert.equal(f.owner.notices.length,1);
 await f.gateway.loadRules();assert.equal(f.owner.controlReplaceState.writeUncertain,true,'matching read retains original unknown');
 const reentered=f.create();reentered.page='home';reentered.openQuickReplace();await until(()=>reentered.controlReplaceState.status==='ready');
 assert.equal(reentered.controlReplaceState.writeUncertain,false,'new presentation exact original query releases only this original uncertainty');
 assert.equal(f.writes().length,1);assert.equal(reentered.controlReplaceState.rules[0].isEnabled,false);
 results.push('lost ACK: pure list retains unknown; reopen qualified exact original query settles without replay');
}
{
 const f=await fixture();f.options.gate=deferred();f.options.pauseMethod='rules.mutation.apply';f.owner.toggleQuickReplaceRule(1,false);await until(()=>f.writes().length===1);
 f.owner.visible=false;f.owner.replacePanelGeneration++;f.options.gate.resolve();await until(()=>f.shared.snapshot().confirmation==='confirmed' && f.owner.replaceMutationActiveGeneration<0);
 assert.equal(f.shared.snapshot().confirmation,'confirmed');assert.equal(f.owner.replaceState.rules[0].isEnabled,true);
 assert.equal(f.owner.reloads,1,'accepted original write still invalidates original mounted content after closing only panel');
 results.push('late exact ACK: panel remains closed; original book content invalidates once');
}
{
 const f=await fixture();f.options.gate=deferred();f.options.pauseMethod='rules.mutation.apply';f.owner.toggleQuickReplaceRule(1,false);await until(()=>f.writes().length===1);
 f.owner.sourceId='different';f.options.gate.resolve();await until(()=>f.shared.snapshot().confirmation==='confirmed' && !f.shared.snapshot().busy);
 assert.equal(f.shared.snapshot().confirmation,'confirmed');assert.equal(f.owner.reloads,0);assert.equal(f.owner.notices.length,0);
 assert.equal(f.owner.replaceState.rules[0].isEnabled,true);results.push('late exact ACK: same book ID in successor source is not original owner');
}
{
 const f=await fixture();f.options.gate=deferred();f.options.beforeStart='rules.mutation.query';f.owner.toggleQuickReplaceRule(1,false);await until(()=>f.calls.some(c=>c.method==='rules.mutation.query'));
 f.retire();f.options.gate.resolve();await until(()=>!f.shared.snapshot().busy);assert.equal(f.writes().length,0);assert.equal(f.shared.snapshot().confirmation,'undispatched');
 results.push('retired Runtime: no borrowed successor runtime and no original dispatch');
}
{
 const f=await fixture();f.options.afterMethod='rules.mutation.apply';
 const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url),'utf8');
 const sdk=boundedSurfaceSdk(),ui=sdk.consumer(source,['editorActions','readyInput','fullInput','quickInput','saveEditor','perform','dismissTemporaryLayer','cancelTemporaryLayer'],{
  readerControlReplaceEndpoint,errorMessageOf:e=>e.message,
 });
 const draft=states.createReaderControlReplaceDraft(row());draft.replacement='durable new';
 Object.assign(ui,{layer:'editor',state:f.owner.controlReplaceState,draft,appThemeScheme:'day',motionProgress:1,interactionEnabled:true,
  localPending:false,localError:'',presentationRevision:1,onTemporaryLayerChange(){},onSave:d=>f.owner.saveControlReplace(d)});
 ui.editorActions();const save=sdk.nodes(ui).find(n=>n.create==='保存');assert.equal(save.enabled,true);save.onClick();await until(()=>ui.localError.length>0);
 assert.equal(f.shared.snapshot().confirmation,'unknown');assert.equal(ui.layer,'editor');assert.strictEqual(ui.draft,draft);
 assert.match(ui.localError,/未确认/);ui.state=f.owner.controlReplaceState;ui.replay();sdk.properties.flush();assert.equal(save.enabled,false);
 const count=f.writes().length;save.onClick();await tick();assert.equal(f.writes().length,count);
 await f.gateway.loadRules();ui.state=f.owner.controlReplaceState;ui.replay();sdk.properties.flush();assert.equal(save.enabled,false);
 await f.owner.reloadControlReplace();ui.state=f.owner.controlReplaceState;ui.replay();sdk.properties.flush();assert.equal(save.enabled,true,'qualified same-ID query releases old uncertainty');
 assert.strictEqual(ui.draft,draft);assert.equal(ui.layer,'editor');results.push('actual SDK footer → actual LRE/Gateway: unknown retains draft, closes no layer and matching list cannot enable Save');
}
{
 const f=await fixture();f.options.beforeMethod='rules.mutation.apply';f.owner.toggleQuickReplaceRule(1,false);
 await until(()=>f.owner.controlReplaceState.writeUncertain);await f.owner.reloadControlReplace();
 assert.equal(f.shared.snapshot().canRetryOriginal,true);const originalId=f.shared.snapshot().operationId;
 assert.strictEqual(states.settleReaderControlReplaceOriginal(f.owner.controlReplaceState,'wrong'),f.owner.controlReplaceState);
 const before=f.calls.length;await f.owner.reloadControlReplace(true,'wrong');assert.equal(f.calls.length,before,'old origin cannot query or replay a later intent');
 const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlReplaceContent.ets',import.meta.url),'utf8');
 const sdk=boundedSurfaceSdk(),ui=sdk.consumer(source,['originalRecoveryAction','textAction','reload','perform','fullInput','quickInput'],{errorMessageOf:e=>e.message,readerControlReplaceEndpoint});
 let sent=[];const draft=states.createReaderControlReplaceDraft(row());
 Object.assign(ui,{state:f.owner.controlReplaceState,layer:'editor',draft,localPending:false,localError:'',presentationRevision:1,
  interactionEnabled:true,motionProgress:1,appThemeScheme:'day',onReload:async id=>{sent.push(id);await f.owner.reloadControlReplace(true,id);}});
 ui.originalRecoveryAction();const old=sdk.nodes(ui).find(n=>n.type==='Text').onClick;
 ui.state={...ui.state,writeOperationId:'successor'};old();await tick();assert.equal(sent.length,0,'actual physical callback captured old tuple cannot borrow new state');
 ui.state=f.owner.controlReplaceState;old();await until(()=>f.shared.snapshot().confirmation==='confirmed');
 assert.deepEqual(sent,[originalId]);assert.equal(f.writes().length,2);assert.strictEqual(ui.draft,draft);assert.equal(ui.layer,'editor');
 results.push('actual SDK recovery captures original ID; wrong/old callback blocked; explicit same-ID retry retains editor draft');
}
// Actual-method negative control: removing the producer's captured guard lets
// an old Quick callback enter real Runtime/SDK after closing its presentation.
{
 const original=readFileSync(file,'utf8'),marker='setRuleEnabled(ruleId, isEnabled, canDispatch)';assert.ok(original.includes(marker));
 const temporary=mkdtempSync(join(tmpdir(),'reader-lre-rules-mutant-')),mutantFile=join(temporary,'LocalReadingExperience.ets');
 writeFileSync(mutantFile,original.replace(marker,'setRuleEnabled(ruleId, isEnabled)'));
 const f=await fixture();const bad=productionMotionMethods(mutantFile,names,f.deps);rmSync(temporary,{recursive:true});
 const owner=f.owner;for(const n of names)if(typeof bad.prototype[n]==='function')owner[n]=bad.prototype[n];
 f.options.gate=deferred();f.options.beforeStart='rules.mutation.query';owner.toggleQuickReplaceRule(1,false);await until(()=>f.calls.some(c=>c.method==='rules.mutation.query'));owner.visible=false;owner.replacePanelGeneration++;
 f.options.gate.resolve();await until(()=>f.writes().length===1);assert.equal(f.writes().length,1,'the same actual negative control proves the producer guard is necessary');
}
console.log('PASS actual LRE/shared Rules owner/Runtime direct/SDK contracts:',results.length,results,'Cold Core exact Rules receipts, native execution and target UI remain separate.');
