import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({preview:{description:'Current directory rule bounds/defaults/preview admission and unsupported capability',resources:[]},durable:{description:'Current exact journal ACK/cold recovery/foreign ID/retirement and refresh barriers',resources:[]},'sdk-actors':{description:'Actual SDK editor fields and original recovery/refresh actor authority',resources:[]},'legacy-preview':{description:'Explicit old CLI pure-read compatibility; requires actual missing directory-rules mutation capability',resources:[]}});
async function run(selectedCase){
const { localFileUrl, resolveEtsLoaderRoot }=await import('./lib/tool-environment.mjs');
const {default:assert}=await import('node:assert/strict');
const {readFileSync,writeFileSync,rmSync}=await import('node:fs');
const {createHash}=await import('node:crypto');
const {createRequire,stripTypeScriptTypes}=await import('node:module');
const {resolve}=await import('node:path');
const {fixture,compile,until,deferred,cleanupDurableFixtures}=await import('./lib/rules-mutation-durable-probe.mjs');
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
const {foundationControls}=await import('./lib/reader-foundation-control-probe.mjs');

const sourceUrl=new URL('../entry/src/main/ets/features/reading/ReaderDirectoryRules.ets',import.meta.url);
const source=readFileSync(sourceUrl,'utf8'),require=createRequire(import.meta.url);
const loader=resolveEtsLoaderRoot();
const ts=require(loader+'/node_modules/typescript'),tree=ts.createSourceFile('ReaderDirectoryRules.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(loader+'/lib/ets_checker.js').compilerOptions);
assert.deepEqual(tree.parseDiagnostics,[]);
const draft=tree.statements.find(node=>node.name?.text==='DirectoryRuleDraft');
const Draft=new Function(stripTypeScriptTypes(draft.getText(tree))+';return DirectoryRuleDraft;')();
const body='第一卷 初始\n第一章 起点\n这是第一章正文。\n第二章 继续\n这是第二章正文。\n';
let groups=0,toolRecorded=false;
const readOnlyOldCore=selectedCase==='legacy-preview';
async function setup(prior) {
 const f=await fixture(true,prior);if(!toolRecorded){console.log(JSON.stringify({kind:'existing-cli-tool-evidence',...f.toolEvidence()}));toolRecorded=true;}
 const caps=(await f.command('core.info')).data.capabilities;
 f.runtime.supportsCoreCapability=name=>caps.includes(name);
 if(readOnlyOldCore)assert.equal(caps.includes('rules.mutation.directory-rules.v1'),false,'read-only mode requires an actual old Core without the new capability');
 else assert.ok(caps.includes('rules.mutation.directory-rules.v1'),'select current paired Core CLI; legacy cannot acknowledge directory applies');
 f.id='local:'+createHash('sha256').update(body).digest('hex');
 if(!prior){const file=resolve(f.root,'source.txt');writeFileSync(file,body);await f.command('local_book.import',{bookId:f.id,filePath:file,format:'txt'});}
 f.DirectoryGateway=compile('features/reading/ReaderDirectoryRulesGateway.ts','ReaderDirectoryRulesGateway',{ReaderRuntimeOwner:f.Runtime,RulesMutationOwner:f.Owner},true);
 f.directoryGateway=new f.DirectoryGateway(f.runtime);
 return f;
}
async function nonTxt(f) {
 const bytes=readFileSync(new URL('../../Reader-Core/crates/reader-local-book/tests/fixtures/epub/sample.epub',import.meta.url)),
  id='local:'+createHash('sha256').update(bytes).digest('hex'),file=resolve(f.root,'source.epub');
 writeFileSync(file,bytes);await f.command('local_book.import',{bookId:id,filePath:file,format:'epub'});return id;
}
function editor(f,alternate=source) {
 const methods=alternate===source?sourceUrl:localFileUrl(resolve(f.root,'mutated-directory.ets'));
 if(alternate!==source)writeFileSync(methods,alternate);
 const Editor=productionMotionMethods(methods,['loadRules','changed','edit','run','recover','aboutToDisappear','canEdit','actorIdentity','ownsActor','recoveryIdentity','ownsRecovery','recoveryView','canContinueOriginal','notifyApplied','retryDirectoryRefresh'],{DirectoryRuleDraft:Draft,ReaderRuntimeOwner:f.Runtime});
 return Object.assign(new Editor(),{bookId:f.id,mounted:true,generation:0,presentationGeneration:1,nextRuleId:1,
  rules:[new Draft(1,'第一卷.*','0','title')],preview:[],previewReady:false,loaded:true,busy:false,message:'',
  directoryRefreshFailed:false,operation:f.owner.snapshot(),gateway:f.directoryGateway,applied:0,onApplied(){this.applied++;}});
}
function ui(f,alternate=source,rules=[new Draft(1,'第一卷.*','0','title')]) {
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),controls=foundationControls();
 // Keep the bounded consumer/recovery property realm, while mounting the
 // actual foundation children with their own genuine SDK property classes.
 for(const [name,value] of Object.entries(controls.dependencies))if(!(name in sdk.properties.sdk))sdk.deps[name]=value;
 Object.assign(sdk.childSources,controls.hooks.childSources);
 const enter=sdk.hooks.onObserverEnter;sdk.hooks.onObserverEnter=(...args)=>{enter?.(...args);controls.hooks.onObserverEnter?.(...args);};sdk.hooks.lifecycleChildren=true;
 const owner=sdk.consumer(alternate,boundedMembers(alternate),{ReaderDirectoryRulesGateway:f.DirectoryGateway,ReaderRuntimeOwner:f.Runtime,DirectoryRuleDraft:Draft},{bookId:f.id});
 // Deliver the constructor's actual book Prop watcher before mounting the
 // controlled loaded-editor fixture. Otherwise its first late flush starts a
 // real loadRules in the middle of the test's accepted apply/recovery action.
 sdk.properties.flush();
 owner.gateway=f.directoryGateway;owner.mounted=true;owner.loaded=true;owner.presentationGeneration=1;
 owner.rules=rules;owner.nextRuleId=Math.max(0,...rules.map(r=>r.id));owner.operation=f.owner.snapshot();owner.initialRender();
 return {sdk,owner,nodes:()=>sdk.nodes(owner),flush:()=>{sdk.properties.flush();controls.properties.flush();sdk.properties.flush();}};
}
try {
 if(readOnlyOldCore){
  const f=await setup(),e=editor(f);e.loadRules();await until(()=>!e.busy);assert.equal(e.loaded,true);assert.match(e.message,/仅可预览/);
  const u=ui(f,source,[new Draft(1,'第一卷.*','0','title'),new Draft(2,'第二章.*','1','head')]);
  const nodes=u.nodes(),fields=nodes.filter(n=>n.type==='TextInput'),selects=nodes.filter(n=>n.type==='Select'),buttons=nodes.filter(n=>n.type==='Button');
  assert.equal(fields.length,4);assert.deepEqual(selects.map(n=>n.selected),[0,1]);
  fields[0].onChange('第一卷.*');fields[1].onChange('3');selects[1].onSelect(3);
  assert.deepEqual(u.owner.rules.map(r=>[r.pattern,r.level,r.boundary]),[['第一卷.*','3','title'],['第二章.*','1','any']]);
  assert.ok(nodes.some(n=>typeof n.create==='string'&&n.create.includes('完整标题')&&n.create.includes('第一卷.*')));
  buttons.find(n=>n.createWithLabel==='删除').onClick();assert.deepEqual(u.owner.rules.map(r=>r.id),[2]);
  buttons.find(n=>n.createWithLabel==='添加规则').onClick();assert.deepEqual(u.owner.rules.map(r=>r.id),[2,3]);assert.equal(u.owner.rules[1].level,'0');assert.equal(u.owner.rules[1].boundary,'title');
  u.owner.rules[1].pattern='第一卷.*';buttons.find(n=>n.createWithLabel==='预览').onClick();await until(()=>!u.owner.busy);assert.equal(u.owner.previewReady,true);
  buttons.find(n=>n.createWithLabel==='应用').onClick();assert.equal(f.writes().length,0,'actual old capability never falls back to direct publication');
  const old=fields[0],before=u.owner.rules[0].pattern;u.owner.presentationGeneration++;old.onChange('old physical callback');assert.equal(u.owner.rules[0].pattern,before);
  const bad=source.replace('identity === this.actorIdentity()', 'true');const v=ui(f,bad),prior=v.nodes().find(n=>n.type==='TextInput');v.owner.presentationGeneration++;prior.onChange('old physical callback');assert.equal(v.owner.rules[0].pattern,'old physical callback','guard removal demonstrates the rejected old physical actor');
  const fresh=editor(f),gate=deferred();fresh.message='目录层级规则已应用，正文和分章保持原样';f.options.beforeStart='reading.directory.rules.preview.v2';f.options.gate=gate;const beforePreview=f.calls.length;const pending=fresh.run(false);
  await until(()=>f.calls.length>beforePreview);assert.match(fresh.message,/正在预览/);assert.doesNotMatch(fresh.message,/已应用/);fresh.bookId='new-book';fresh.changed();gate.resolve();await pending;assert.equal(fresh.previewReady,false);assert.equal(fresh.applied,0);
  console.log('PASS directory rules actual legacy Core pure-read/preview→production Editor/decorated SDK controls/defaults/old physical actor negative; new receipt tests intentionally NOT RUN.');
 } else {
if(selectedCase==="preview"){

 for(const [level,accepted] of [['0',true],['31',true],['32',false],['-1',false],['',false],[' ',false],['1.5',false]]){
  const f=await setup(),e=editor(f);e.rules[0].level=level;const before=f.calls.length;await e.run(false);
  assert.equal(f.calls.length-before,accepted?1:0,`level ${JSON.stringify(level)} admission`);
  if(accepted){assert.equal(f.calls.at(-1).params.rules[0].level,Number(level));assert.equal(e.previewReady,true);
   await e.run(true);assert.equal(e.applied,1);const apply=f.writes()[0];assert.equal(apply.params.mutation.params.rules[0].level,Number(level));
   e.loadRules();await until(()=>!e.busy);assert.equal(e.rules[0].level,level);await e.run(false);
   assert.deepEqual(f.calls.at(-1).params.rules,apply.params.mutation.params.rules);}
  groups++;
 }
}
if(selectedCase==="preview"){

 {
  const f=await setup(),e=editor(f);e.rules=[];await e.run(false);assert.equal(e.previewReady,true);assert.deepEqual(f.calls.at(-1).params.rules,[]);
  await e.run(true);assert.equal(e.applied,1);e.rules=[new Draft(1,'第一卷.*','0','title')];e.edit(1,'level','2');assert.equal(e.previewReady,false);
  e.loaded=false;const n=f.calls.length;await e.run(true);assert.equal(f.calls.length,n,'failed read is never a savable empty draft');
  e.bookId=await nonTxt(f);e.loadRules();await until(()=>!e.busy);assert.equal(e.loaded,false);assert.match(e.message,/TXT/);groups++;
 }
}
if(selectedCase==="preview"){

 {
  const f=await setup(),e=editor(f);e.rules=[new Draft(1,'第一卷.*','1','title'),new Draft(2,'第二章.*','2','head')];
  await e.run(false);await e.run(true);e.loadRules();await until(()=>!e.busy);assert.equal(e.rules.length,2,'all persisted rules load, not only first');
  e.edit(e.rules[1].id,'level','3');await e.run(false);assert.deepEqual(f.calls.at(-1).params.rules,[{pattern:'第一卷.*',level:1,boundary:'title'},{pattern:'第二章.*',level:3,boundary:'head'}]);
  e.edit(e.rules[0].id,'pattern','第二卷.*');assert.equal(e.previewReady,false);groups++;
 }
}
if(selectedCase==="preview"){

 {
  const f=await setup(),e=editor(f),gate=deferred();e.message='目录层级规则已应用，正文和分章保持原样';
  f.options.beforeStart='reading.directory.rules.preview.v2';f.options.gate=gate;const pending=e.run(false);
  await until(()=>f.calls.some(c=>c.method==='reading.directory.rules.preview.v2'));assert.match(e.message,/正在预览/);assert.doesNotMatch(e.message,/已应用/);
  e.bookId='new-book';e.changed();gate.resolve();await pending;assert.equal(e.previewReady,false);assert.equal(e.applied,0);groups++;
 }
}
if(selectedCase==="preview"){

 {
  const f=await setup(),e=editor(f);e.rules[0].pattern=' ';const n=f.calls.length;await e.run(false);assert.equal(f.calls.length,n);
  e.rules[0].pattern='第一卷.*';await e.run(true);assert.equal(f.calls.length,n,'apply needs current successful preview');
  f.options.beforeMethod='reading.directory.rules.preview.v2';await e.run(false);assert.equal(e.previewReady,false);assert.equal(e.rules[0].pattern,'第一卷.*');
  await e.run(true);assert.equal(f.writes().length,0);
  f.options.beforeMethod='reading.directory.rules.get.v2';e.loadRules();await until(()=>!e.busy);assert.equal(e.loaded,false);assert.equal(e.rules.length,1,'failed load preserves draft');groups++;
 }
}
if(selectedCase==="preview"){

 {
  const f=await setup(),e=editor(f);e.rules[0].pattern='[';await e.run(false);assert.equal(e.previewReady,false,'actual unavailable derivation cannot admit an apply');
  await e.run(true);assert.equal(f.writes().length,0);
  await assert.rejects(f.directoryGateway.apply(f.id,[{pattern:'[',level:0,boundary:'title'}],()=>true),/未应用/);
  assert.equal(f.owner.snapshot().confirmation,'undispatched');assert.equal(f.owner.snapshot().blocked,false);assert.equal(f.disk(),'');
  assert.deepEqual((await f.command('reading.directory.rules.get.v2',{sourceId:'local',bookId:f.id})).data.rules,[],'exact rejected derivation publishes no rules');groups++;
 }
}
if(selectedCase==="durable"){

 {
  const f=await setup();f.options.afterMethod='rules.mutation.apply';await assert.rejects(f.directoryGateway.apply(f.id,[{pattern:'[',level:0,boundary:'title'}],()=>true));
  const cold=await setup(f),e=editor(cold);e.loadRules();await until(()=>!e.busy);assert.equal(e.operation.confirmation,'undispatched');assert.equal(e.operation.blocked,true,'pure rejected ACK inspection does not hide remaining journal');
  let notify=0;e.onApplied=()=>{notify++;throw Error('a rejected write must never refresh');};
  const bytes=cold.disk(),n=cold.writes().length;await e.recover(e.recoveryIdentity(),false);assert.equal(cold.disk(),bytes);
  await e.recover(e.recoveryIdentity(),true);assert.equal(e.operation.confirmation,'undispatched');assert.equal(e.operation.blocked,false);assert.equal(cold.writes().length,n);assert.equal(cold.disk(),'');
  assert.equal(notify,0);assert.equal(e.directoryRefreshFailed,false);assert.doesNotMatch(e.message,/写入已确认/);groups++;
 }
}
if(selectedCase==="durable"){

 for(const loss of ['beforeMethod','afterMethod']){
  const f=await setup(),e=editor(f);await e.run(false);f.options[loss]='rules.mutation.apply';await e.run(true);
  assert.equal(e.operation.confirmation,'unknown');assert.equal(e.operation.blocked,true);assert.match(e.message,/尚未确认/);assert.equal(e.rules[0].pattern,'第一卷.*');
  const original=JSON.parse(f.disk()),bytes=f.disk(),writes=f.writes().length;
  await f.directoryGateway.read(f.id,()=>true);await e.run(false);assert.equal(f.writes().length,writes);assert.equal(f.owner.snapshot().confirmation,'unknown');
  const cold=await setup(f),rebuilt=editor(cold);rebuilt.loadRules();await until(()=>!rebuilt.busy);
  assert.equal(cold.disk(),bytes,'opening inspectOnly cannot clear journal');assert.equal(cold.io.finishes,0);assert.equal(cold.writes().length,0);
  assert.equal(rebuilt.rules[0].pattern,'第一卷.*');assert.equal(rebuilt.operation.blocked,true);assert.equal(rebuilt.operation.canRetryOriginal,true);
  const identity=rebuilt.recoveryIdentity();await rebuilt.recover(identity,false);assert.equal(cold.writes().length,0);assert.equal(cold.disk(),bytes,'explicit inspect cannot clean');
  await rebuilt.recover(identity,true);assert.equal(rebuilt.operation.blocked,false);assert.equal(cold.disk(),'');
  if(loss==='beforeMethod'){assert.equal(cold.writes().length,1);assert.deepEqual(cold.writes()[0].params,{operationId:original.operationId,sequence:original.sequence,mutation:original.mutation});}
  else assert.equal(cold.writes().length,0,'qualified old ACK cleanup never reapplies');
  assert.equal((await cold.command('reading.directory.rules.get.v2',{sourceId:'local',bookId:f.id})).data.rules[0].pattern,'第一卷.*');groups++;
 }
}
if(selectedCase==="durable"){

 {
  const f=await setup();f.options.afterMethod='rules.mutation.apply';await assert.rejects(f.save());const bytes=f.disk(),e=editor(f);
  e.loadRules();await until(()=>!e.busy);assert.equal(e.operation.blocked,true);assert.equal(e.canContinueOriginal(),false,'foreign rule cannot use this continuation');
  const writes=f.writes().length;await e.recover(e.recoveryIdentity(),false);await e.recover(e.recoveryIdentity(),true);
  assert.equal(f.writes().length,writes);assert.equal(f.disk(),bytes);groups++;
 }
}
if(selectedCase==="durable"){

 for(const fault of ['high-head','wrong-receipt','corrupt-record']){
  const f=await setup();f.options.afterMethod='rules.mutation.apply';await assert.rejects(f.directoryGateway.apply(f.id,[],()=>true));const original=f.disk();
  const cold=await setup(f);
  if(fault==='corrupt-record')writeFileSync(resolve(cold.files,'reader-rules-mutation-intent-v1.json'),'{corrupt');
  else {cold.options.transformMethod='rules.mutation.query';cold.options.transform=data=>fault==='high-head'?{...data,head:{...data.head,sequence:data.head.sequence+1},receipt:null}:{...data,receipt:{...data.receipt,binding:{...data.receipt.binding,operationId:'wrong'}}};}
  const e=editor(cold);e.loadRules();await until(()=>!e.busy);assert.equal(e.operation.blocked,true);assert.equal(e.canEdit(),false);assert.equal(cold.writes().length,0);assert.equal(cold.io.finishes,0);
  if(fault!=='corrupt-record')assert.equal(cold.disk(),original);groups++;
 }
}
if(selectedCase==="sdk-actors"){

 {
  const f=await setup(),u=ui(f),fields=u.nodes().filter(n=>n.type==='TextInput'),buttons=u.nodes().filter(n=>n.type==='Button');
  assert.equal(fields.length,2);fields[0].onChange('第一卷.*');fields[1].onChange('1');assert.equal(u.owner.rules[0].level,'1');
  buttons.find(n=>n.createWithLabel==='预览').onClick();await until(()=>!u.owner.busy);assert.equal(u.owner.previewReady,true);
  f.options.afterMethod='rules.mutation.apply';buttons.find(n=>n.createWithLabel==='应用').onClick();await until(()=>!u.owner.busy);assert.equal(u.owner.operation.confirmation,'unknown');u.flush();
  assert.ok(u.nodes().some(n=>n.type==='Text'&&typeof n.create==='string'&&n.create.includes('原操作')),'real shared notice/actions render');
  const physical=label=>{
   u.flush();
   // Historical ForEach keys remain in this probe's child inventory; native
   // removal is outside its scope. Select the one current, admitted actor,
   // while preserving old physical callbacks for the retirement assertion.
   const actors=u.sdk.walk(u.owner).filter(actor=>actor instanceof u.sdk.deps.ReaderRecoveryAction&&actor.label===label&&
    actor.actionEnabled&&actor.generation===u.owner.operation.generation);
   assert.equal(actors.length,1,label+' has one current physically admitted actor');
   const node=[...actors[0].nodes.values()].find(node=>typeof node.onClick==='function');assert.equal(node.enabled,true);return node;
  };
  const action=physical('核对原操作回执');const bytes=f.disk(),n=f.writes().length,reads=f.calls.filter(call=>call.method==='rules.mutation.query').length;
  action.onClick();await until(()=>!u.owner.busy);u.flush();assert.equal(f.disk(),bytes);assert.equal(f.writes().length,n);
  assert.ok(f.calls.filter(call=>call.method==='rules.mutation.query').length>reads,'actual shared native action dispatches the original pure query');
  const continueAction=physical('继续原操作');continueAction.onClick();await until(()=>!u.owner.busy);assert.equal(f.writes().length,n);assert.equal(f.disk(),'');
  u.owner.aboutToDisappear();action.onClick();assert.equal(u.owner.busy,false,'retired physical recovery cannot borrow a new owner');groups++;
 }
}
if(selectedCase==="sdk-actors"){

 {
  const f=await setup(),u=ui(f,source,[new Draft(1,'第一卷.*','0','title'),new Draft(2,'第二章.*','1','head')]);
  const nodes=u.nodes(),fields=nodes.filter(n=>n.type==='TextInput'),selects=nodes.filter(n=>n.type==='Select'),buttons=nodes.filter(n=>n.type==='Button');
  assert.equal(fields.length,4);assert.deepEqual(selects.map(n=>n.selected),[0,1]);fields[0].onChange('第一卷.*');fields[1].onChange('3');selects[1].onSelect(3);
  assert.deepEqual(u.owner.rules.map(r=>[r.pattern,r.level,r.boundary]),[['第一卷.*','3','title'],['第二章.*','1','any']]);
  assert.ok(nodes.some(n=>typeof n.create==='string'&&n.create.includes('完整标题')&&n.create.includes('第一卷.*')));
  buttons.find(n=>n.createWithLabel==='删除').onClick();assert.deepEqual(u.owner.rules.map(r=>r.id),[2]);
  buttons.find(n=>n.createWithLabel==='添加规则').onClick();assert.deepEqual(u.owner.rules.map(r=>r.id),[2,3]);assert.equal(u.owner.rules[1].level,'0');assert.equal(u.owner.rules[1].boundary,'title');
  u.owner.rules[1].pattern='第一卷.*';buttons.find(n=>n.createWithLabel==='预览').onClick();await until(()=>!u.owner.busy);assert.equal(u.owner.previewReady,true);
  const draft=JSON.stringify(u.owner.rules);fields[0].onChange('deleted physical row');selects[0].onSelect(2);buttons.find(n=>n.createWithLabel==='删除').onClick();
  assert.equal(JSON.stringify(u.owner.rules),draft);assert.equal(u.owner.previewReady,true,'retired row does not revoke a new successful preview');
  buttons.find(n=>n.createWithLabel==='应用').onClick();await until(()=>!u.owner.busy);assert.equal(u.owner.operation.confirmation,'confirmed');groups++;
 }
}
if(selectedCase==="sdk-actors"){

 {
  const f=await setup(),u=ui(f);let notify=0,fail=true;u.owner.onApplied=()=>{notify++;if(fail)throw Error('actual projection callback unavailable');};
  const buttons=u.nodes().filter(n=>n.type==='Button');buttons.find(n=>n.createWithLabel==='预览').onClick();await until(()=>!u.owner.busy);
  buttons.find(n=>n.createWithLabel==='应用').onClick();await until(()=>!u.owner.busy);u.flush();
  assert.equal(u.owner.operation.confirmation,'confirmed');assert.equal(u.owner.operation.blocked,false);assert.equal(u.owner.directoryRefreshFailed,true);
  const actors=u.sdk.walk(u.owner).filter(actor=>actor instanceof u.sdk.deps.ReaderRecoveryAction&&actor.label==='刷新当前目录'&&
   actor.actionEnabled&&actor.generation===u.owner.operation.generation);
  assert.equal(actors.length,1,'actual current shared projection retry actor renders');
  const action=[...actors[0].nodes.values()].find(node=>typeof node.onClick==='function');assert.equal(action.enabled,true);
  const n=f.writes().length;fail=false;action.onClick();assert.equal(u.owner.directoryRefreshFailed,false);assert.equal(f.writes().length,n);assert.equal(notify,2);
  u.owner.directoryRefreshFailed=true;u.owner.presentationGeneration++;action.onClick();assert.equal(notify,2,'old physical refresh cannot borrow the next presentation');groups++;
 }
}
if(selectedCase==="sdk-actors"){

 {
  const f=await setup(),u=ui(f),old=u.nodes().find(n=>n.type==='TextInput');const before=u.owner.rules[0].pattern;
  u.owner.presentationGeneration++;old.onChange('old physical callback');assert.equal(u.owner.rules[0].pattern,before);
  const bad=source.replace('identity === this.actorIdentity()', 'true');assert.notEqual(bad,source);const v=ui(f,bad),prior=v.nodes().find(n=>n.type==='TextInput');v.owner.presentationGeneration++;prior.onChange('old physical callback');assert.equal(v.owner.rules[0].pattern,'old physical callback','guard removal exposes old actor');groups++;
 }
}
if(selectedCase==="durable"){

 {
  const f=await setup(),e=editor(f);await e.run(false);const gate=deferred();f.options.pauseMethod='rules.mutation.apply';f.options.gate=gate;
  const pending=e.run(true);await until(()=>f.writes().length===1);e.aboutToDisappear();gate.resolve();await pending;
  assert.equal(f.owner.snapshot().confirmation,'confirmed');assert.equal(e.applied,0,'accepted write cannot publish to retired page');
  assert.equal((await f.command('reading.directory.rules.get.v2',{sourceId:'local',bookId:f.id})).data.rules[0].pattern,'第一卷.*');groups++;
 }
}
if(selectedCase==="durable"){

 {
  const f=await setup(),e=editor(f);await e.run(false);const gate=deferred();f.options.pauseMethod='rules.mutation.apply';f.options.gate=gate;const pending=e.run(true);
  await until(()=>f.writes().length===1);e.bookId='another-txt';e.changed();gate.resolve();await pending;
  assert.equal(e.previewReady,false);assert.equal(e.applied,0,'late accepted apply cannot refresh another book');assert.equal(f.owner.snapshot().confirmation,'confirmed');
  assert.equal((await f.command('reading.directory.rules.get.v2',{sourceId:'local',bookId:f.id})).data.rules[0].pattern,'第一卷.*');groups++;
 }
}
if(selectedCase==="durable"){

 {
  const f=await setup(),e=editor(f);await e.run(false);const gate=deferred();f.options.beforeStart='rules.mutation.apply';f.options.gate=gate;const pending=e.run(true);
  await until(()=>f.writes().length===1);e.aboutToDisappear();gate.resolve();await pending;
  assert.equal(f.owner.snapshot().confirmation,'undispatched','original branded last-boundary refusal is not an accepted unknown');assert.equal(f.disk(),'');
  assert.deepEqual((await f.command('reading.directory.rules.get.v2',{sourceId:'local',bookId:f.id})).data.rules,[]);groups++;
 }
}
if(selectedCase==="durable"){

 {
  const f=await setup(),e=editor(f);await e.run(false);f.options.loseFinishAt=f.io.finishes+2;await e.run(true);
  assert.equal(e.operation.confirmation,'confirmed');assert.equal(e.operation.blocked,true,'cleanup ACK loss keeps confirmed truth and original record');
  const cold=await setup(f),rebuilt=editor(cold);rebuilt.loadRules();await until(()=>!rebuilt.busy);assert.equal(rebuilt.operation.confirmation,'confirmed');assert.equal(rebuilt.operation.blocked,true);
  const n=cold.writes().length,bytes=cold.disk();await rebuilt.recover(rebuilt.recoveryIdentity(),false);assert.equal(cold.disk(),bytes);
  await rebuilt.recover(rebuilt.recoveryIdentity(),true);assert.equal(cold.writes().length,n);assert.equal(cold.disk(),'');groups++;
 }
}
if(selectedCase==="durable"){

 for(const recovery of [false,true]){
  const f=await setup(),e=editor(f);await e.run(false);e.onApplied=()=>{throw Error('current directory projection callback failed');};
  if(recovery){f.options.afterMethod='rules.mutation.apply';await e.run(true);await e.recover(e.recoveryIdentity(),false);await e.recover(e.recoveryIdentity(),true);}
  else await e.run(true);
  assert.equal(e.operation.confirmation,'confirmed');assert.equal(e.operation.blocked,false);assert.equal(e.directoryRefreshFailed,true);assert.match(e.message,/当前目录刷新尚未完成/);assert.doesNotMatch(e.message,/清理尚未完成/);assert.equal(f.disk(),'');
  const n=f.writes().length;e.onApplied=()=>{e.applied++;};e.retryDirectoryRefresh(e.recoveryIdentity());assert.equal(e.directoryRefreshFailed,false);assert.equal(f.writes().length,n,'refresh retry does not repeat durable apply');groups++;
 }
}
if(selectedCase==="preview"){

 {
  const f=await setup(),e=editor(f);f.runtime.supportsCoreCapability=name=>name!=='rules.mutation.directory-rules.v1';await e.run(false);assert.equal(e.previewReady,true);await e.run(true);assert.equal(f.writes().length,0,'old Core has no direct-write fallback');groups++;
 }
}

 console.log(`PASS selected directory-rule case ${selectedCase}: ${groups} groups; other cases NOT_RUN; native scheduling/OS fsync/visual remain separate.`);
}

} finally {cleanupDurableFixtures();}

}
for(const id of selected){await run(id);recordContractCasePass(id);}
