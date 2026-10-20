import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'sdk-transactions':{description:'Current conversion transaction matrix via actual installed SDK and existing Core CLI',resources:[]},
 'compiler-parity':{description:'Explicit tool diagnostic: strip/SDK same transaction matrix; excluded from ordinary release prerequisite',resources:[]}
};
const selected=selectContractCases(definitions);
async function runCase(selectedCase){
const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');
const {default:assert}=await import('node:assert/strict');
const {readFileSync}=await import('node:fs');
const {createRequire}=await import('node:module');
const {fixture,compile,until,deferred,cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
const require=createRequire(import.meta.url),ts=require((resolveEtsLoaderRoot())+'/node_modules/typescript');
const lre=readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),'utf8');
const options=require((resolveEtsLoaderRoot())+'/lib/ets_checker.js').compilerOptions;
const methodsTree=ts.createSourceFile('LRE.ets',lre,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
assert.equal(methodsTree.parseDiagnostics.length,0,'actual LRE ETS parser');
const names=['chineseConversionIdentity','dispatchChineseConversionAction','chineseConversionAction','loadChineseConversionMode','changeChineseConversionMode'];
const klass=methodsTree.statements.find(n=>n.members&&names.every(name=>n.members.some(m=>m.name?.getText(methodsTree)===name)));
const body=names.map(name=>{const method=klass.members.find(n=>ts.isMethodDeclaration(n)&&n.name.getText(methodsTree)===name);assert.ok(method,name);return method.getText(methodsTree);}).join('\n');
let cases=0;
function gateway(f,official){const Gateway=compile('features/reading/ReaderChineseConversionGateway.ts','ReaderChineseConversionGateway',{RulesMutationOwner:f.Owner,RulesManagementGateway:f.Gateway,ReaderRuntimeOwner:f.Runtime},official);return new Gateway(f.runtime);}
function reading(f,official){const Reader=compile('features/reading/LocalReadingExperience.ets','Reader',{},official,'export class Reader{\n'+body+'\n}');const r=new Reader();r.mounted=true;r.lifecycleToken=1;r.bookId='book';r.sourceId='source';r.chineseConversionMode='none';r.chineseConversionLoaded=false;r.chineseConversionOperationId='';r.chineseConversionMutationGeneration=0;r.isSessionActive=t=>r.mounted&&r.lifecycleToken===t;r.chineseConversionGateway=gateway(f,official);r.persistCount=0;r.persistBeforeContentMutation=async()=>{r.persistCount++;return()=>true;};r.quickSearchPublication={cancel(){}};r.publishQuickSearchState=()=>{};r.phase='ready';r.chapter=undefined;r.notices=[];r.getUIContext=()=>({getPromptAction:()=>({showToast:({message})=>r.notices.push(message)})});return r;}
console.log(JSON.stringify({kind:'reader-existing-tool-evidence',...durableFixtureToolEvidence()}));
try {
for(const official of selectedCase==='sdk-transactions'?[true]:[false,true]){
 {const f=await fixture(official),g=gateway(f,official);assert.equal(await g.getMode(),'none');assert.equal(await g.putMode('s2t'),'s2t');assert.equal(f.writes()[0].params.mutation.method,'reader.chinese-conversion.put');assert.equal(f.writes()[0].params.mutation.params.mode,'s2t');assert.equal(await g.getMode(),'s2t');await assert.rejects(g.putMode('invalid'),/must be none, t2s, or s2t/);cases++;}
 {const f=await fixture(official),g=gateway(f,official);f.options.transformMethod='reader.chinese-conversion.get';f.options.transform=()=>({config:{mode:'unexpected'}});await assert.rejects(g.getMode(),/config.mode must be none/);cases++;}
 {const f=await fixture(official),g=gateway(f,official);f.options.capability=false;await assert.rejects(g.putMode('t2s'),/未派发/);assert.equal(f.writes().length,0);assert.equal(f.disk(),'');cases++;}
 {const f=await fixture(official),g=gateway(f,official);f.options.afterMethod='rules.mutation.apply';await assert.rejects(g.putMode('t2s'));const original=JSON.parse(f.disk());const cold=await fixture(official,f);await cold.command('reader.chinese-conversion.put',{mode:'s2t'});const g2=gateway(cold,official);await g2.recoverOriginal(()=>true);assert.equal(cold.writes().length,0);assert.equal(await g2.getMode(),'s2t','historical original ACK is not current mode');assert.equal(cold.disk(),'');assert.equal(g2.snapshot().operationId,original.operationId);cases++;}
 {const f=await fixture(official),g=gateway(f,official);f.options.beforeMethod='rules.mutation.apply';await assert.rejects(g.putMode('t2s'));const fixed=JSON.parse(f.disk());const cold=await fixture(official,f),g2=gateway(cold,official);await g2.recoverOriginal(()=>true);assert.equal(g2.snapshot().canRetryOriginal,true);await assert.rejects(g2.putMode('s2t'));await g2.recoverOriginal(()=>true,true);assert.equal(cold.writes()[0].params.operationId,fixed.operationId);assert.equal(await g2.getMode(),'t2s');cases++;}
 {const f=await fixture(official),g=gateway(f,official);const gate=deferred();f.options.beforeStart='rules.mutation.apply';f.options.gate=gate;let current=true;const task=g.putMode('t2s',()=>current);await until(()=>f.writes().length===1);current=false;gate.resolve();await assert.rejects(task);assert.equal((await f.command('reader.chinese-conversion.get')).data.config.mode,'none');assert.equal(g.snapshot().confirmation,'undispatched');cases++;}
 {const f=await fixture(official),r=reading(f,official);f.options.afterMethod='rules.mutation.apply';const old=r.chineseConversionAction();old('t2s');await until(()=>r.notices.length===1);assert.equal(r.chineseConversionMode,'none');assert.ok(r.chineseConversionOperationId);assert.match(r.notices[0],/尚未确认/);const calls=f.writes().length;old('s2t');await new Promise(q=>setTimeout(q,20));assert.equal(f.writes().length,calls,'old rendered action cannot upgrade to new unknown ID');const retry=r.chineseConversionAction();retry('s2t');await until(()=>r.chineseConversionLoaded);assert.equal(r.chineseConversionMode,'t2s','recovery ignores replacement selector draft');assert.equal(r.persistCount,1,'do not persist stale old body before exact original recovery');assert.equal(f.writes().length,1);assert.equal(r.chineseConversionOperationId,'');retry('none');await new Promise(q=>setTimeout(q,20));assert.equal(f.writes().length,1,'settled old origin actor cannot start fresh conversion');cases++;}
 {const f=await fixture(official),r=reading(f,official);const identity=r.chineseConversionIdentity();r.bookId='successor';r.dispatchChineseConversionAction('t2s',identity);await new Promise(q=>setTimeout(q,20));assert.equal(f.writes().length,0);r.bookId='book';r.dispatchChineseConversionAction('t2s',identity);await until(()=>r.chineseConversionLoaded);assert.equal(r.chineseConversionMode,'t2s');cases++;}
 {const f=await fixture(official),r=reading(f,official);const stale=r.chineseConversionAction();r.bookId='new';stale('t2s');r.bookId='book';r.lifecycleToken++;stale('t2s');await new Promise(q=>setTimeout(q,20));assert.equal(f.writes().length,0);assert.equal(r.persistCount,0);cases++;}
 {const f=await fixture(official),r=reading(f,official);const gate=deferred();f.options.pauseMethod='rules.mutation.apply';f.options.gate=gate;r.chineseConversionAction()('t2s');await until(()=>f.writes().length===1);r.mounted=false;gate.resolve();await until(()=>r.chineseConversionGateway.snapshot().confirmation==='confirmed');assert.equal(r.chineseConversionMode,'none','retired view does not install late original ACK');assert.equal((await f.command('reader.chinese-conversion.get')).data.config.mode,'t2s','accepted durable write is not canceled by UI retirement');cases++;}
}
console.log(`PASS ${selectedCase}: ${cases} actual conversion Gateway/RulesOwner/LRE transactions; existing CLI cold SQLite, no matching-row receipt inference`);
} finally { await cleanupDurableFixtures(); }

}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
