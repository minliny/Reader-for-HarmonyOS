import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { resolveEtsLoaderRoot, virtualFilePath }=await import('./lib/tool-environment.mjs');
const { formatDownloadStorageBytes }=await import('../entry/src/main/ets/features/downloads/SharedDownloadProjection.ts');

const { readFileSync }=await import('node:fs');
const { stripTypeScriptTypes, createRequire }=await import('node:module');
const { ReaderWriteEvidence }=await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const { projectOperationFacts }=await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
const { readerRecoveryView }=await import('../entry/src/main/ets/app/ReaderRecoveryProjection.ts');
const { ReaderNativeAlertOwner }=await import('./lib/reader-native-alert-sdk-probe.mjs');
const { ReaderCoreRequestError, isReaderCoreTransactionPendingError }=await import('../entry/vendor/core-harmony/sdk/reader_core.ts');
const { runtimeOwnerIdentityProbe }=await import('./lib/reader-runtime-admission-probe.mjs');
const { productionMotionMethods }=await import('./lib/reader-motion-method-probe.mjs');
const { createReaderBuilderProbe }=await import('./lib/reader-control-builder-probe.mjs');
const { boundedSurfaceSdk, boundedMembers }=await import('./lib/bounded-surface-sdk-probe.mjs');
const {fixture: generalSettingsFixture}=await import('./lib/general-settings-persistence-probe.mjs');
const file=name=>new URL('../entry/src/main/ets/'+name,import.meta.url),source=name=>readFileSync(file(name),'utf8');
const CacheFeedback=productionMotionMethods(file('features/settings/SettingsPage.ets'),['feedbackMessage']);
const inlineMessage=snapshot=>Object.assign(new CacheFeedback(),{cacheCleanup:snapshot,resetMessage:'',recovery:()=>({visible:false})}).feedbackMessage();
const ordinary=text=>stripTypeScriptTypes(text.replace(/^export type \{[^\n]+from [^\n]+\n/gm,'').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load=(name,className,deps)=>new Function(...Object.keys(deps),ordinary(source(name))+`;return ${className};`)(...Object.values(deps));
let installed;const Runtime=runtimeOwnerIdentityProbe(()=>installed);
let ActualCacheStore;
class CacheClearOperationIntentStore { constructor(...args){return new ActualCacheStore(...args);} }
const Gateway=load('features/settings/SettingsCacheGateway.ts','SettingsCacheGateway',{CacheClearOperationIntentStore});
const CleanupOwner=load('features/settings/SettingsCacheCleanupOwner.ts','SettingsCacheCleanupOwner',{ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,projectOperationFacts,formatDownloadStorageBytes,SettingsCacheGateway:Gateway});
const tick=()=>new Promise(done=>setImmediate(done)),defer=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{resolve,promise};};
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await tick();}assert.fail('cache cleanup did not settle');}
const good=()=>({scope:'text',removedContentBytes:10,deletedBytes:20,deletedFiles:3,totalBytes:0,retainedBytes:0,automaticBytes:0,cleanableBytes:0,hasMore:false,protectedChapters:[],removedChapters:[]});
const typedPending=()=>new ReaderCoreRequestError({protocolVersion:1,requestId:1,type:'error',error:{code:'TRANSACTION_PENDING',message:'pre-execution gate',retryable:true,details:{transactionKind:'persistenceMutation',pendingHostOperationCount:0,retryAfterMillis:0}}});
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
const sdkRequire=createRequire(import.meta.url),sdkRoot=resolveEtsLoaderRoot();
sdkRequire(sdkRoot+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('CategoryRow',new Set(['content']));
function field(index,Host){const text=source('pages/Index.ets'),start=text.indexOf('  private settingsHost:'),end=text.indexOf('\n  );',start)+6;
 const expression=text.slice(start,end).split('=').slice(1).join('=').trim().replace(/;$/,'');
 return new Function('SettingsHost',ordinary('const value='+expression+';')+'return value;').call(index,Host);}
const Storage=load('features/downloads/SharedDownloadStorageGateway.ts','SharedDownloadStorageGateway',{ReaderCoreRequestError,isReaderCoreTransactionPendingError,SharedDownloadIntentPreferences:class{}});const RuntimeCleanup=productionMotionMethods(file('app/ReaderRuntimeOwner.ts'),['clearTextRebuildableCache','readSettingsTextCleanup']);
function fixture(mode='valid'){
 const calls=[],notices=[];let currentMode=mode,gate,report=good(),textJournal,remainingEntries=10,head,receipt,raw='',uuid=0,queryMode,committedParams;const queries=[];
 const fileIo={OpenMode:{READ_ONLY:0,READ_WRITE:2},async readText(){return raw;},async open(){return{fd:1};},async close(){},async fsync(){},
  AtomicFile:class {startWrite(){return{on(){},end:(value,_encoding,callback)=>{this.raw=value;queueMicrotask(callback);}};}finishWrite(){raw=this.raw;}failWrite(){}}};
 const replaceReaderAtomicSnapshot=load('app/ReaderAtomicSnapshotFile.ts','replaceReaderAtomicSnapshot',{fileIo});
 ActualCacheStore=load('features/reading/ReadingOperationIntents.ts','CacheClearOperationIntentStore',{
  fileIo,replaceReaderAtomicSnapshot,ReaderRuntimeOwner:Runtime,ReaderCoreRequestError,isReaderCoreTransactionPendingError,
  util:{generateRandomUUID:()=>`12345678-1234-4234-8123-${String(++uuid).padStart(12,'0')}`}});
 const runtime={getUIAbilityContext:()=>({filesDir:'/cache-fixture'}),async request(method,params,options){
  if(method==='cache.storage.summary')return{data:good()};
  if(method==='cache.clear.operation.query'){
   queries.push(structuredClone(params));if(queryMode==='error')throw Error('exact query unavailable');
   let actual=receipt!==undefined&&params.operationId===receipt.binding.operationId?structuredClone(receipt):null;
   if(actual!==null){assert.deepEqual(params.expected,committedParams,'exact query carries the original complete command; empty cache alone proves nothing');
    if(queryMode==='wrong-id')actual.binding.operationId='ffffffff-ffff-4fff-8fff-ffffffffffff/'+actual.binding.sequence;
    if(queryMode==='wrong-fingerprint')actual.binding.payloadFingerprint='b'.repeat(64);
    if(queryMode==='null')actual=null;}
   return{data:{head:head??null,receipt:actual}};
  }
  if(method==='cache.clear.operation.settle'){assert.deepEqual(params,receipt.binding);receipt.phase='settled';return{data:structuredClone(receipt)};}
  assert.ok(['cache.clear','cache.storage.cleanup'].includes(method));
  if(method==='cache.clear'){assert.equal(params.scope,'cache');assert.ok(params.operationId.endsWith('/'+params.sequence));}
  else assert.equal(params.contentScope,'text');
  calls.push({method,params,options});
  if(options.canDispatch?.()===false)throw Error('actual adapter refused before send');options.onDispatch?.();
  const pause=gate;gate=undefined;if(pause)await pause.promise;
  if(currentMode==='typed')throw typedPending();if(currentMode==='lost-before')throw Error('clear ACK unavailable');
  if(currentMode==='message-only')throw Object.assign(Error('TRANSACTION_PENDING'),{code:'TRANSACTION_PENDING'});
  remainingEntries=0;
  if(method==='cache.storage.cleanup'){if(currentMode==='lost-after')throw Error('clear ACK unavailable');return{data:report};}
  committedParams=structuredClone(params);head={operationId:params.operationId,sequence:params.sequence,payloadFingerprint:'a'.repeat(64)};receipt={binding:head,phase:'committed',result:{scope:'cache',cacheEntriesRemoved:4,chapterEntriesRemoved:2,queueEntriesRemoved:1,removedContentBytes:10}};
  if(currentMode==='lost-after')throw Error('clear ACK unavailable');return{data:receipt.result};}};

 // Actual Runtime delegation and whole storage owner execute unchanged.
 // Only disk inventory/receipts and Core transaction responses are ports.
 const disk={readPolicy:async()=>({capacityBytes:1024,expiryDays:30}),captureReadingStorageInventory:async()=>({files:[],hostImageChapters:[],protectedChapters:[]}),
  readingStorageCleanupReceipt:async()=>({deletedBytes:report.deletedBytes??0,deletedFiles:report.deletedFiles??0}),
  readingStorageSummary:async()=>({totalBytes:0,retainedBytes:0,automaticBytes:0,cleanableBytes:0}),readingStorageBookIndex:async()=>new Map(),
  clearChapter:async()=>assert.fail('empty removal response cannot clear a chapter')};
 const persistence={loadLegacyProtection:async()=>[],saveLegacyProtection:async()=>{},loadSettingsTextCleanup:async()=>structuredClone(textJournal),saveSettingsTextCleanup:async value=>{textJournal=structuredClone(value);}};
 runtime.readDownloadStorageBindings=async()=>({retainedChapters:[],protectedChapters:[]});
 const storage=new Storage(runtime,disk,persistence);runtime.state='ready';runtime.getDownloadStorageGateway=()=>storage;
 runtime.clearTextRebuildableCache=RuntimeCleanup.prototype.clearTextRebuildableCache;
 runtime.readSettingsTextCleanup=RuntimeCleanup.prototype.readSettingsTextCleanup;

 installed=runtime;
 const general=generalSettingsFixture();general.setActive(runtime);const actual=general.host();assert.equal(actual.host.bindPresentation(runtime,'cache-compiler',()=>true),true);
 const Host=load('features/settings/SettingsHost.ets','SettingsHost',{ReaderRuntimeOwner:Runtime,SettingsOrchestrator:actual.host.orchestrator.constructor,SettingsCacheCleanupOwner:CleanupOwner});
 const Methods=productionMotionMethods(file('pages/Index.ets'),['clearTextCache','openSettings','bindSettingsPresentation','isCurrentSettingsPresentation','reconcileSettingsCache'],{ReaderRuntimeOwner:Runtime});
 const index=Object.assign(new Methods(),{mountedRuntimeOwner:runtime,route:'settings',navigationGeneration:1,detailShelfAdmissionMount:1,rssInstanceIdentity:1,settingsPresentationIdentity:'',shelfReceiptRetired:false,settingsSection:'general',settingsSnapshot:{},settingsOperation:{action:'load'},settingsCacheCleanup:undefined,nextNavigationGeneration(){return ++this.navigationGeneration;}});
 index.settingsHost=field(index,Host);assert.equal(index.bindSettingsPresentation(),true);
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});sdk.childSources.CategoryRow=source('features/settings/CategoryRow.ets');
 sdk.deps.CategoryRow=createReaderBuilderProbe(sdk.childSources.CategoryRow,boundedMembers(sdk.childSources.CategoryRow),sdk.deps,sdk.hooks).Component;
 const pageSource=source('features/settings/SettingsPage.ets');
 // Keep every declared field so the actual V1 @Prop/@Watch update contract is used.
 const ts=sdkRequire(sdkRoot+'/node_modules/typescript'),tree=ts.createSourceFile(virtualFilePath('SettingsCacheConsumer.ets'),pageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,sdkRequire(sdkRoot+'/lib/ets_checker.js').compilerOptions);
 assert.equal(tree.parseDiagnostics.length,0);
 const declaration=tree.statements.find(node=>node.members&&node.members.some(member=>member.name?.getText(tree)==='build'));
 const names=[...declaration.members.filter(node=>ts.isPropertyDeclaration(node)).map(node=>node.name.getText(tree)),
  'cacheActionRow','requestClearTextCache','clearTextCache','onCacheCleanupChanged','applyCacheCleanup','onSnapshotChanged','syncSnapshotValues',
  'onOperationChanged','operationFeedbackIdentity','cacheFeedbackIdentity','showFeedbackToast','hasPendingSettings','hasPendingCleanup','recovery'];
 function props(){const p=createReaderBuilderProbe(source('pages/Index.ets'),['settingsContent','settingsSurface'],{SettingsPage:Child,deviceInfo:{deviceType:'phone'}},{childSources:{SettingsPage:pageSource}}).owner;
  Object.assign(p,index,{clearTextCache:(...args)=>index.clearTextCache(...args)});p.settingsContent();return [...p.children.values()][0].params;}
 function page(identity='settings-back:test'){
  const params=props(),owner=sdk.consumer(pageSource,names,{ReaderRuntimeOwner:Runtime,ReaderNativeAlertOwner,readerRecoveryView},params);
  const dialogs=[];
  Object.assign(owner,{mounted:true,themeOwner:runtime,temporaryBackIdentity:identity,appThemeScheme:'day',
   lastOperationFeedback:owner.operationFeedbackIdentity(),lastCacheFeedback:owner.cacheFeedbackIdentity(),
   getUIContext:()=>({getPromptAction:()=>({showToast:opt=>notices.push(opt.message)}),showAlertDialog:options=>dialogs.push(options)})});
  owner.onCacheCleanupChanged();owner.cacheActionRow();
  const row=()=>sdk.nodes(owner).find(node=>node.type==='Row'&&node.onClick);
  return{owner,dialogs,row,confirm(){row().onClick();dialogs.at(-1)?.secondaryButton.action();},label:()=>{owner.replay();return sdk.nodes(owner).find(node=>node.type==='Text'&&node.create===owner.cacheActionLabel)?.create;},
   update(){owner.updateStateVars({...props()});owner.onCacheCleanupChanged();owner.replay();}};
 }
 return{index,runtime,calls,notices,page,props,remainingEntries:()=>remainingEntries,snapshot:()=>index.settingsHost.cacheCleanupSnapshot(runtime),seedLegacy:async()=>{try{await new ActualCacheStore(runtime).execute('cache.clear',{scope:'cache'},{sourceId:'cache',bookId:'global-text'},x=>x,new ReaderWriteEvidence(),()=>true);}catch{}},mode:v=>{currentMode=v;},report:v=>{report=v;},queryMode:v=>{queryMode=v;},queries,disk:()=>raw,setOwner:v=>{installed=v;},pause(){gate=defer();return gate;}};
}

try{
if(id==='confirmation'){
{
 const f=fixture(),p=f.page();p.row().onClick();await tick();assert.equal(f.calls.length,0,'opening the scope confirmation does not dispatch cleanup');
 const dialog=p.dialogs.at(-1);assert.equal(dialog.title,'清理文字缓存');assert.match(dialog.message,/保留下载任务/);
 dialog.primaryButton.action();dialog.secondaryButton.action();await tick();assert.equal(f.calls.length,0,'cancelled confirmation cannot be reused for cleanup');
}
}
if(id==='confirmed'){
{
 const f=fixture(),p=f.page();assert.equal(p.owner.cacheActionLabel,'清理文字缓存');p.confirm();p.confirm();await until(()=>f.snapshot()?.confirmation==='confirmed');p.update();
 assert.equal(f.calls.length,1);assert.equal(p.owner.cacheActionLabel,'已清理');assert.equal(p.label(),'已清理');assert.equal(f.snapshot().operation.value.removedContentBytes,10);
 assert.equal(f.snapshot().operation.fact,'current');assert.equal(f.snapshot().operation.canRetry,false);
 assert.equal(f.notices.length,1,'a confirmed result produces one transient feedback');
 p.update();assert.equal(f.notices.length,1,'replaying the same result stays silent');
}
}
if(id==='partial'){
{
 const f=fixture(),p=f.page();f.report({...good(),cleanupError:'file still in use'});
 p.confirm();await until(()=>f.snapshot()?.confirmation==='confirmed');p.update();
 assert.equal(p.owner.cacheActionLabel,'部分清理');assert.equal(p.label(),'部分清理');
 assert.equal(f.snapshot().operation.canRetry,false,'a partial confirmed cleanup need not have an uncertain receipt');
 assert.match(inlineMessage(f.snapshot()),/部分清理未完成/,'the canonical partial-result explanation remains complete');
 assert.equal(f.notices.length,1);
}
}
if(id==='unknown'){
for(const mode of ['lost-before','lost-after','message-only']){
 const f=fixture(mode),p=f.page();p.confirm();await until(()=>f.snapshot()?.confirmation==='unknown');p.update();
 assert.equal(p.owner.cacheActionLabel,'结果未确认');assert.equal(p.label(),'结果未确认');if(mode==='lost-after')assert.equal(f.remainingEntries(),0);if(mode==='lost-before')assert.equal(f.remainingEntries(),10);assert.equal(f.snapshot().operation.fact,'blocked');assert.equal(f.snapshot().operation.canRetry,true);
 assert.deepEqual(f.notices,[],'unknown outcome is already projected in the original page');
 assert.match(inlineMessage(f.snapshot()),/尚未确认/);
 p.confirm();await tick();assert.equal(f.calls.length,1);assert.deepEqual(f.notices,[],'repeat tap cannot replay cleanup or repeat its notice');
 p.owner.mounted=false;f.index.route='bookshelf';f.index.openSettings();const reopened=f.page('settings-back:next');
 assert.equal(reopened.owner.cacheActionLabel,'清理中','reopen projects exact read reconciliation as busy');reopened.row().onClick();await tick();assert.equal(f.calls.length,1,'reopen cannot blind replay an uncertain clear');
 await until(()=>f.snapshot()?.busy===false);reopened.update();
 assert.equal(reopened.owner.cacheActionLabel,'结果未确认','an empty cache cannot confirm a lost safe-cleanup ACK or replay it');
 assert.equal(f.calls.length,1,'pure read plus metadata settlement never replays cache.clear');
}
}
if(id==='typed-refusal'){
{
 const f=fixture('typed'),p=f.page();p.confirm();await until(()=>f.snapshot()?.confirmation==='undispatched');p.update();assert.equal(p.owner.cacheActionLabel,'清理失败');
 assert.equal(f.snapshot().operation.canRetry,true);f.mode('valid');p.confirm();await until(()=>f.snapshot()?.confirmation==='confirmed');p.update();assert.equal(f.calls.length,2);assert.equal(p.owner.cacheActionLabel,'已清理');
}
}
if(id==='legacy-query'){
for(const queryMode of ['null','wrong-id','wrong-fingerprint','error']){
 const f=fixture('lost-after');await f.seedLegacy();const p=f.page();p.confirm();await until(()=>f.snapshot()?.confirmation==='unknown');
 assert.equal(f.remainingEntries(),0,'matching empty cache is not an operation receipt');f.queryMode(queryMode);
 p.owner.mounted=false;f.index.route='bookshelf';f.index.openSettings();const current=f.page('settings-back:exact-'+queryMode);
 await until(()=>f.snapshot()?.busy===false);current.update();
 assert.equal(f.snapshot().confirmation,'unknown');assert.equal(current.owner.cacheActionLabel,'结果未确认');assert.notEqual(f.disk(),'','unqualified read does not clear fixed original intent');
 current.row().onClick();await tick();assert.equal(f.calls.length,1,'mismatched/absent/error query cannot authorize fresh cache.clear');
 assert.ok(f.queries.some(q=>q.operationId===f.calls[0].params.operationId&&q.expected.scope==='cache'),'current UI uses exact original identity, not just matching cache contents');
}
}
if(id==='malformed-core'){
for(const mutate of [r=>({...r,totalBytes:-1}),r=>({...r,cleanableBytes:'2'}),r=>({...r,automaticBytes:0.5}),r=>({...r,removedContentBytes:Number.NaN}),r=>({scope:r.scope})]){
 const f=fixture(),p=f.page();f.report(mutate(good()));p.confirm();await until(()=>f.snapshot()?.confirmation==='unknown');p.update();assert.equal(p.owner.cacheActionLabel,'结果未确认');
 p.confirm();await tick();assert.equal(f.calls.length,1,'malformed ACK does not certify success or permit replay');
}
}
if(id==='retirement'){
for(const mode of ['valid','lost-after'])for(const retirement of ['navigation','unmounted','runtime-unset','runtime-replaced']){
 const f=fixture(mode),p=f.page(),g=f.pause();p.confirm();await until(()=>f.calls.length===1);const prior=f.index.settingsCacheCleanup;
 if(retirement==='navigation'){f.index.route='bookshelf';f.index.navigationGeneration++;p.owner.mounted=false;}
 if(retirement==='unmounted'){f.index.shelfReceiptRetired=true;p.owner.mounted=false;}
 if(retirement==='runtime-unset')f.setOwner(undefined);if(retirement==='runtime-replaced')f.setOwner({});
 g.resolve();await until(()=>f.snapshot()?.busy===false);await tick();
 assert.equal(p.owner.cacheActionLabel,'清理中','retired physical page cannot apply late result');
 if(retirement.startsWith('runtime'))assert.equal(f.index.settingsCacheCleanup,prior);
 const n=f.calls.length;await f.props().onClearCache();assert.equal(f.calls.length,n,'old Index callback cannot dispatch after retirement');
}
}
if(id==='retained-row'){
{
 const f=fixture(),old=f.props().onClearCache;f.index.navigationGeneration++;await old();assert.equal(f.calls.length,0,'captured native Index callback keeps its original nav lease');
 assert.equal(f.index.bindSettingsPresentation(),true,'new navigation binds its own actual Settings presentation');
 const p=f.page(),oldActor=[...p.owner.children.values()].at(-1),physical=p.row().onClick;p.owner.temporaryBackIdentity='settings-back:replacement';physical();await tick();assert.equal(f.calls.length,0,'same-instance old physical handler cannot dispatch');
 p.owner.replay();const freshActor=[...p.owner.children.values()].at(-1);assert.notEqual(freshActor,oldActor,'actual SDK key admits only fresh small row actor');
 freshActor.onRowClick();p.dialogs.at(-1).secondaryButton.action();await until(()=>f.snapshot()?.confirmation==='confirmed');assert.equal(f.calls.length,1);physical();await tick();assert.equal(f.calls.length,1);
}
}
if(id==='reopened-ack'){
{
 const f=fixture(),p=f.page(),g=f.pause();p.confirm();await until(()=>f.calls.length===1);
 p.owner.mounted=false;f.index.route='bookshelf';f.index.openSettings();const reopened=f.page('settings-back:reopened-pending');
 assert.equal(reopened.owner.cacheActionLabel,'清理中');g.resolve();await until(()=>f.snapshot()?.confirmation==='confirmed');reopened.update();
 assert.equal(reopened.label(),'已清理');assert.equal(p.owner.cacheActionLabel,'清理中');assert.equal(f.calls.length,1,'new page can consume settled domain ACK without touching old page');
}
}
if(id==='pre-dispatch-retire'){
{
 const f=fixture();f.index.settingsHost.emitCacheCleanup=snapshot=>{if(snapshot.busy)f.index.navigationGeneration++;};
 await f.index.clearTextCache();assert.equal(f.calls.length,0);assert.equal(f.snapshot().confirmation,'undispatched','retired before actual Gateway admission stays undispatched');
}
}
if(id==='publication-reentry'){
{
 const f=fixture();let joined;f.index.settingsHost.emitCacheCleanup=snapshot=>{if(snapshot.busy)joined=f.index.settingsHost.clearCache(f.runtime,()=>true);};
 await f.index.clearTextCache();await joined;assert.equal(f.calls.length,1,'synchronous publication reentry cannot dispatch a second clear before active Promise assignment');
}
}
if(id==='publisher-failure'){
{
 const f=fixture();f.index.settingsHost.emitCacheCleanup=()=>{throw Error('native state publisher unavailable');};
 await f.index.clearTextCache();assert.equal(f.snapshot().confirmation,'confirmed');assert.equal(f.snapshot().operation.fact,'current');assert.equal(f.calls.length,1);
}
}
}finally{installed=undefined;}
}
const definitions={"confirmation": "confirmation actual scoped owner/gateway/storage path; controlled Core/OS ports", "confirmed": "confirmed actual scoped owner/gateway/storage path; controlled Core/OS ports", "partial": "partial actual scoped owner/gateway/storage path; controlled Core/OS ports", "unknown": "unknown actual scoped owner/gateway/storage path; controlled Core/OS ports", "typed-refusal": "typed-refusal actual scoped owner/gateway/storage path; controlled Core/OS ports", "legacy-query": "legacy-query actual scoped owner/gateway/storage path; controlled Core/OS ports", "malformed-core": "malformed-core actual scoped owner/gateway/storage path; controlled Core/OS ports", "retirement": "retirement actual scoped owner/gateway/storage path; controlled Core/OS ports", "retained-row": "retained-row actual scoped owner/gateway/storage path; controlled Core/OS ports", "reopened-ack": "reopened-ack actual scoped owner/gateway/storage path; controlled Core/OS ports", "pre-dispatch-retire": "pre-dispatch-retire actual scoped owner/gateway/storage path; controlled Core/OS ports", "publication-reentry": "publication-reentry actual scoped owner/gateway/storage path; controlled Core/OS ports", "publisher-failure": "publisher-failure actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
