import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks,createRequire} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReadingSessionFlowGateway}=await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const {LOCAL_SOURCE_ID}=await import('../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const sourceURL=new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),source=readFileSync(sourceURL,'utf8');
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript');
const ast=ts.createSourceFile(sourceURL.pathname,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
assert.deepEqual(ast.parseDiagnostics,[]);
const exactClass=ast.statements.find(n=>n.name?.getText(ast)==='ReadingCommit').getText(ast);
const emitted=ts.transpileModule(exactClass,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});assert.deepEqual(emitted.diagnostics,[]);
const exports={};new Function('exports',emitted.outputText)(exports);const {ReadingCommit}=exports;
const defer=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
const layout={viewportWidth:390,viewportHeight:800,fontScale:1};
const anchor={chapterIndex:2,chapterOffset:55,chapterProgress:0.2,bodyVersion:'body',processingVersion:'processing'};
function fixture({transactionId='original',wrongId=false,finalized=true,loseAck=false,pause,local=false}={}){
 const calls=[];const runtime={async request(method,p,options={}){
  calls.push({method,p,options});assert.equal(method,'reading.progress.update');if(pause)await pause.promise;
  if(loseAck)throw Error('native accepted update but ACK lost');return{data:{stored:true,sourceId:p.sourceId,bookId:p.bookId,
   chapterIndex:p.chapterIndex,chapterOffset:p.chapterOffset,chapterProgress:p.chapterProgress,updatedAt:8,locationRevision:'canonical',
   bodyVersion:'body',processingVersion:'processing',...(p.transactionId===undefined?{}:
    {sourceSwitchFinalized:finalized,transactionId:wrongId?'wrong':p.transactionId})}};}};
 const gateway=new ReadingSessionFlowGateway(local?'local':'new','book',{kind:local?'local':'remote'},runtime,local?undefined:transactionId);
 const callbacks=[],Host=productionMotionMethods(sourceURL,['admitCommittedProgress'],{ReadingCommit,ReaderRuntimeOwner:{current:()=>runtime}});
 const owner=Object.assign(new Host(),{sourceId:local?'local':'new',bookId:'book',sourceSwitchTransactionId:'fresh-live-prop',onReadingCommitted:commit=>callbacks.push(commit)});
 return{gateway,runtime,calls,owner,callbacks};
}
for(const atomic of [false,true]){
 const f=fixture();const stored=atomic?await f.gateway.resolveAndUpdateProgress('book','Chapter',anchor,layout):
  await f.gateway.updateProgress('book',{...anchor,locationRevision:'canonical'});
 assert.equal(stored.sourceSwitchTransactionId,'original');assert.equal(f.gateway.hasPendingSourceSwitch(),false);
 f.owner.admitCommittedProgress(stored);assert.equal(f.callbacks[0].sourceSwitchTransactionId,'original');
 assert.equal(f.callbacks[0].bodyVersion,'body');assert.equal(f.callbacks[0].processingVersion,'processing','committed origin keeps actual canonical content proof');
 assert.notEqual(f.callbacks[0].sourceSwitchTransactionId,f.owner.sourceSwitchTransactionId,'no live prop lookup');
 const ordinary=await f.gateway.updateProgress('book',{...anchor,locationRevision:'canonical'});assert.equal(ordinary.sourceSwitchTransactionId,undefined);
 f.owner.admitCommittedProgress(ordinary);assert.equal(f.callbacks.at(-1).sourceSwitchTransactionId,undefined,'later ordinary ACK is not a repeated finalization receipt');
}
for(const failure of [{wrongId:true},{finalized:false},{loseAck:true}]){
 const f=fixture(failure);await assert.rejects(f.gateway.updateProgress('book',{...anchor,locationRevision:'canonical'}));
 assert.equal(f.gateway.hasPendingSourceSwitch(),true);assert.deepEqual(f.callbacks,[],'unqualified/lost ACK cannot emit finalized marker');
}
{
 const pause=defer(),f=fixture({pause});const work=f.gateway.updateProgress('book',{...anchor,locationRevision:'canonical'});
 f.gateway.sourceSwitchTransactionId='successor';pause.resolve();const stored=await work;
 assert.equal(stored.sourceSwitchTransactionId,'original','accepted original request has exact original receipt');
 assert.equal(f.gateway.sourceSwitchTransactionId,'successor','old ACK cannot clear successor pending field');
 f.owner.admitCommittedProgress(stored);assert.equal(f.callbacks[0].sourceSwitchTransactionId,'original');
}
{
 const f=fixture({local:true});const stored=await f.gateway.updateProgress('book',{...anchor,locationRevision:'canonical'});
 assert.equal(stored.sourceSwitchTransactionId,undefined);f.owner.admitCommittedProgress(stored);assert.equal(f.callbacks[0].sourceSwitchTransactionId,undefined);
}
function failureOwner(input=source){
 const p=boundedSurfaceSdk();const o=p.consumer(input,['sourceSwitchScopeId','sourceSwitchFailureMessage','readingFailureContent'],{
  LOCAL_READING_SOURCE_ID:LOCAL_SOURCE_ID,readerAppearanceThemeStyle:()=>({ink:'#111111',paperStart:'#ffffff'})},{sourceSwitchScopeId:1,sourceSwitchFailureMessage:'saved receipt pending'});
 o.sourceId='new';o.appearanceSnapshot={activeTheme:'day'};o.readingLayout=()=>({bodyWidth:()=>390,bodyHeight:()=>800,contentLeft:0,contentTop:0});
 o.onRetryFailedSourceSwitch=id=>o.actions.push(['retry',id]);o.onDismissSourceSwitchFailure=id=>o.actions.push(['dismiss',id]);
 o.openReaderControl=()=>{};o.onSwitchSource=()=>{};o.retryReading=()=>o.actions.push(['body']);o.actions=[];
 o.readingFailureContent();return{p,o};
}
{
 const {p,o}=failureOwner();const oldRetry=p.nodes(o).find(n=>n.createWithLabel==='重试').onClick;
 const oldDismiss=p.nodes(o).find(n=>n.createWithLabel==='继续当前书源').onClick;
 o.sourceSwitchScopeId=2;o.sourceSwitchFailureMessage='new scope';oldRetry();oldDismiss();
 assert.deepEqual(o.actions,[['retry',1],['dismiss',1]],'real SDK physical callbacks preserve original scope');
 o.readingFailureContent();const newRetry=p.nodes(o).filter(n=>n.createWithLabel==='重试').at(-1).onClick;newRetry();assert.deepEqual(o.actions.at(-1),['retry',2]);
 const column=p.nodes(o).find(n=>n.type==='Column');assert.deepEqual(column.create,{space:20});assert.equal(column.padding,24);
 const plain=failureOwner();plain.o.sourceSwitchFailureMessage='';plain.o.readingFailureContent();
 p.nodes(o).filter(n=>n.createWithLabel==='阅读设置').at(-1).onClick();assert.equal(o.sourceSwitchScopeId,2);
}
{
 const unsafe=source.replace('this.onRetryFailedSourceSwitch(scopeId)','this.onRetryFailedSourceSwitch(this.sourceSwitchScopeId)');
 assert.notEqual(unsafe,source);const {p,o}=failureOwner(unsafe),old=p.nodes(o).find(n=>n.createWithLabel==='重试').onClick;
 o.sourceSwitchScopeId=2;old();assert.deepEqual(o.actions,[['retry',2]],'negative actual SDK control reproduces fresh-scope borrowing');
}
console.log('PASS actual Gateway canonical finalization ACK→production LRE→ReadingCommit original/wrong/lost/late/local IDs; actual SDK failure action lexical scope/reopen/negative control; native scheduling/target remain separate');
