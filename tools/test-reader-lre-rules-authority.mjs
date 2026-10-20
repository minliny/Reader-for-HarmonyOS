import{selectContractCases,recordContractCasePass}from'./lib/contract-case-selection.mjs';
const selected=selectContractCases({'last-dispatch':{description:'Actual original LRE last dispatch, late ACK and runtime/source retirement with producer guard negative',resources:[]},'footer-chain':{description:'Actual SDK footer to LRE/Runtime/Gateway preserves draft and original recovery ID',resources:[]}});
async function run(id){let toolRecorded=false;
const {default:assert}=await import('node:assert/strict');
const { readFileSync, writeFileSync, mkdtempSync, rmSync }=await import('node:fs');
const { tmpdir }=await import('node:os');
const { join }=await import('node:path');
const { registerHooks }=await import('node:module');
const { productionMotionMethods }=await import('./lib/reader-motion-method-probe.mjs');
const { boundedSurfaceSdk }=await import('./lib/bounded-surface-sdk-probe.mjs');
const { fixture:durableFixture, until, cleanupDurableFixtures }=await import('./lib/rules-mutation-durable-probe.mjs');







const hooks=registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});

try{
const states=await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');

const quick=await import('../entry/src/main/ets/features/reading/ReaderReplaceQuickState.ts');



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
 if(!toolRecorded){console.log(JSON.stringify({kind:'existing-cli-tool-evidence',...actual.toolEvidence()}));toolRecorded=true;}
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
   readerRecoveryView:{message:'',visible:false,canRetry:false,generation:0},
   controlVisible(){return this.visible;},controlPage(){return this.page;},isSessionActive(t){return this.mounted&&t===this.lifecycleToken;},
   setControlPage(p){this.page=p;},persistBeforeContentMutation:async()=>()=>true,
   reloadCurrentPageAfterReplacePersist(){this.reloads++;},errorMessage:e=>e.message,
   showReaderAlert(_id,o){this.notices.push(o);assert.fail('automatic Rules recovery must not open a modal');},
  });return owner;
 };
 return{...actual,shared,gateway,create,deps,owner:create()};
}

const results=[];
if(id==="last-dispatch")
{
 const f=await fixture();f.options.gate=deferred();f.options.beforeStart='rules.mutation.query';f.owner.toggleQuickReplaceRule(1,false);await until(()=>f.calls.some(c=>c.method==='rules.mutation.query'));
 f.owner.visible=false;f.owner.replacePanelGeneration++;f.options.gate.resolve();await tick();
 assert.equal(f.writes().length,0);assert.equal(f.shared.snapshot().confirmation,'undispatched');assert.equal(f.owner.notices.length,0);
 results.push('Quick: closure during actual Runtime start rejects before SDK dispatch');
}

// Lost-ACK cold reopen is adopted from control-replace-host#cold-recovery, never imported.

if(id==="last-dispatch")
{
 const f=await fixture();f.options.gate=deferred();f.options.pauseMethod='rules.mutation.apply';f.owner.toggleQuickReplaceRule(1,false);await until(()=>f.writes().length===1);
 f.owner.visible=false;f.owner.replacePanelGeneration++;f.options.gate.resolve();await until(()=>f.shared.snapshot().confirmation==='confirmed' && f.owner.replaceMutationActiveGeneration<0);
 assert.equal(f.shared.snapshot().confirmation,'confirmed');assert.equal(f.owner.replaceState.rules[0].isEnabled,true);
 assert.equal(f.owner.reloads,1,'accepted original write still invalidates original mounted content after closing only panel');
 results.push('late exact ACK: panel remains closed; original book content invalidates once');
}
if(id==="last-dispatch")
{
 const f=await fixture();f.options.gate=deferred();f.options.pauseMethod='rules.mutation.apply';f.owner.toggleQuickReplaceRule(1,false);await until(()=>f.writes().length===1);
 f.owner.sourceId='different';f.options.gate.resolve();await until(()=>f.shared.snapshot().confirmation==='confirmed' && !f.shared.snapshot().busy);
 assert.equal(f.shared.snapshot().confirmation,'confirmed');assert.equal(f.owner.reloads,0);assert.equal(f.owner.notices.length,0);
 assert.equal(f.owner.replaceState.rules[0].isEnabled,true);results.push('late exact ACK: same book ID in successor source is not original owner');
}
if(id==="last-dispatch")
{
 const f=await fixture();f.options.gate=deferred();f.options.beforeStart='rules.mutation.query';f.owner.toggleQuickReplaceRule(1,false);await until(()=>f.calls.some(c=>c.method==='rules.mutation.query'));
 f.retire();f.options.gate.resolve();await until(()=>!f.shared.snapshot().busy);assert.equal(f.writes().length,0);assert.equal(f.shared.snapshot().confirmation,'undispatched');
 results.push('retired Runtime: no borrowed successor runtime and no original dispatch');
}
if(id==="footer-chain")
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
if(id==="footer-chain")
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
if(id==="last-dispatch")
// Actual-method negative control: removing the producer's captured guard lets
// an old Quick callback enter real Runtime/SDK after closing its presentation.
{
 const original=readFileSync(file,'utf8'),marker='setRuleEnabled(ruleId, isEnabled, canDispatch)';assert.ok(original.includes(marker));
 const temporary=mkdtempSync(join(tmpdir(),'reader-lre-rules-mutant-')),mutantFile=join(temporary,'LocalReadingExperience.ets');
 const f=await fixture();let bad;try{writeFileSync(mutantFile,original.replace(marker,'setRuleEnabled(ruleId, isEnabled)'));bad=productionMotionMethods(mutantFile,names,f.deps);}finally{rmSync(temporary,{recursive:true,force:true});}
 const owner=f.owner;for(const n of names)if(typeof bad.prototype[n]==='function')owner[n]=bad.prototype[n];
 f.options.gate=deferred();f.options.beforeStart='rules.mutation.query';owner.toggleQuickReplaceRule(1,false);await until(()=>f.calls.some(c=>c.method==='rules.mutation.query'));owner.visible=false;owner.replacePanelGeneration++;
 f.options.gate.resolve();await until(()=>f.writes().length===1);assert.equal(f.writes().length,1,'the same actual negative control proves the producer guard is necessary');
}

}finally{cleanupDurableFixtures();hooks.deregister();}
}
for(const id of selected){await run(id);recordContractCasePass(id);}
