import assert from 'node:assert/strict';
import {createRequire,registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url)).replace(/\/$/,'');
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(s+'.ts',c);throw e;}}});
const {productionMotionMethods}=await import(pathToFileURL(root+'/tools/lib/reader-motion-method-probe.mjs'));
const {errorMessageOf,isDomainResolutionFailure,isNetworkEnvironmentFailure}=await import(pathToFileURL(root+'/entry/src/main/ets/app/ErrorMessage.ts'));
const {diagnosticCodeOf}=await import(pathToFileURL(root+'/entry/src/main/ets/app/LogPrivacy.ts'));
const {normalizeReadingOfflineMaterializationError,ReadingOfflineMaterializationError}=await import(pathToFileURL(root+'/entry/src/main/ets/features/reading/ReadingOfflineContract.ts'));
const sourceFile=process.env.READER_DOWNLOAD_FEEDBACK_INDEX??root+'/entry/src/main/ets/pages/Index.ets';
const require=createRequire(import.meta.url);
const sdk='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(sdk+'/node_modules/typescript');
const tree=ts.createSourceFile('/tmp/DownloadFeedbackProbe.ets',readFileSync(sourceFile,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
assert.equal(tree.parseDiagnostics.length,0);
const memberNames=new Set(tree.statements.find(n=>n.name?.getText(tree)==='Index').members.map(n=>n.name?.getText(tree)));
const methods=['downloadDirectoryChapter','showChapterDownloadFailure','showOfflineDownloadFeedback'].filter(n=>memberNames.has(n));
const settle=()=>new Promise(r=>setImmediate(r));
async function fixture(error,mutation,contentKind='manga'){
 let reject,resolve;const pending=new Promise((a,b)=>{resolve=a;reject=b;});
 const messages=[],states=[],logs=[],calls=[];
 class Gateway{prefetchChapter(session,index,current){calls.push({session,index,current});return pending;}}
 const Index=productionMotionMethods(sourceFile,methods,{ReadingOfflineGateway:Gateway,
  ReaderRuntimeOwner:{current:()=>({supportsCoreCapability:()=>true})},hilog:{error:(...args)=>logs.push(args)},DOMAIN:0,
  errorMessageOf,isDomainResolutionFailure,isNetworkEnvironmentFailure,diagnosticCodeOf,normalizeReadingOfflineMaterializationError});
 const session={contentKind,identity:{sourceId:'s',bookId:'b'},entries:[{index:0,url:'chapter'}]};
 const owner=Object.assign(new Index(),{remoteReadingSession:session,offlineMutationGeneration:0,offlineMutationActiveKey:'',detailToc:[{index:0,bookmarks:['kept']}],
  isKnownDetailChapter:index=>index===0,updateDirectoryChapterDownloadState:(...args)=>states.push(args),
  mergeDirectoryBookmarks:(entries,current)=>entries.map(e=>({...e,bookmarks:current[0].bookmarks})),
  getUIContext:()=>({getPromptAction:()=>({showToast:({message})=>{if(mutation==='ui-gone')throw new Error('context gone');messages.push(message);}})})});
 owner.downloadDirectoryChapter(0);assert.equal(calls.length,1);assert.equal(calls[0].current(),true);assert.deepEqual(states,[[0,'queued']]);
 if(mutation==='book')owner.remoteReadingSession={...session,identity:{sourceId:'s',bookId:'other'}};
 if(mutation==='source')owner.remoteReadingSession={...session,identity:{sourceId:'other',bookId:'b'}};
 if(mutation==='superseded'){owner.offlineMutationGeneration++;owner.offlineMutationActiveKey='new-job';}
 if(mutation==='closed')owner.remoteReadingSession=undefined;
 if(error===undefined)resolve([{index:0,downloadState:'completed'}]);else reject(error);
 await settle();await settle();
 assert.equal(owner.offlineMutationActiveKey,mutation==='superseded'?'new-job':'','only this job releases its active key');
 return{owner,messages,states,logs,calls};
}
const secret='https://fixture.invalid/a?token=PRIVATE_TEST_TOKEN&Cookie=PRIVATE_TEST_COOKIE';
const dns=Object.assign(new Error(secret), {
 event: {error: {code: 'NETWORK_ERROR', details: {
  host: {diagnostics: {details: {category: 'NETWORK_ENVIRONMENT', phase: 'dns'}}}
 }}}
});
const current=await fixture(dns);
assert.deepEqual(current.states,[[0,'queued'],[0,'failed']]);
assert.equal(current.messages.length,1,'current chapter failure must be visible, not only logged');
assert.match(current.messages[0],/无法解析书源域名/);
assert.doesNotMatch(current.messages[0],/PRIVATE|fixture|https|Cookie/);
assert.equal(current.logs.length,1,'existing private diagnostic remains');
const novel=await fixture(dns,undefined,'text');assert.deepEqual(novel.messages,current.messages,'the shared chapter action retains the same safe feedback for novels');
for(const mutation of ['book','source','superseded','closed']){
 const stale=await fixture(dns,mutation);assert.deepEqual(stale.messages,[]);assert.deepEqual(stale.states,[[0,'queued']]);assert.equal(stale.logs.length,0);
}
for(const cancelled of [new ReadingOfflineMaterializationError('cancelled',secret),new Error('reading offline request was superseded'),new Error('Reader-Core request cancelled by caller: 7')]){
 const f=await fixture(cancelled);assert.deepEqual(f.messages,[],'current cancellation is not an error popup');
}
for(const [error,expected] of [
 [new ReadingOfflineMaterializationError('storage_full',secret),/存储空间不足/],
 [new Error('deadline exceeded '+secret),/超时/],
 [new Error('opaque private '+secret),/网络|稍后重试/],
 [new Error('opaque PRIVATE_TEST_TOKEN PRIVATE_TEST_COOKIE'),/稍后重试/],
]){
 const f=await fixture(error);assert.equal(f.messages.length,1);assert.match(f.messages[0],expected);assert.doesNotMatch(f.messages[0],/PRIVATE|fixture|https|Cookie/);
}
const ok=await fixture(undefined);assert.deepEqual(ok.messages,[]);assert.equal(ok.owner.detailToc[0].downloadState,'completed');assert.deepEqual(ok.owner.detailToc[0].bookmarks,['kept']);
const gone=await fixture(dns,'ui-gone');assert.deepEqual(gone.messages,[]);assert.deepEqual(gone.states,[[0,'queued'],[0,'failed']]);
console.log('PASS actual Index chapter download + production safe classifiers + existing Toast: current DNS visible; source/book/closed/generation stale silent; three cancellation shapes silent; fixed storage/timeout/unknown copy excludes secrets; success bookmarks and active-key fencing preserved; unavailable UI cannot reject download settlement');
