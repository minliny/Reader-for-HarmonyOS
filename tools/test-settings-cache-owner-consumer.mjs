import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import { ReaderWriteEvidence } from '../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import { projectOperationFacts } from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import { ReaderNativeAlertOwner } from '../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
import { ReaderCoreRequestError, isReaderCoreTransactionPendingError } from '../entry/vendor/core-harmony/sdk/reader_core.ts';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { boundedSurfaceSdk, boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
const file=name=>new URL('../entry/src/main/ets/'+name,import.meta.url),source=name=>readFileSync(file(name),'utf8');
const ordinary=text=>stripTypeScriptTypes(text.replace(/^export type \{[^\n]+from [^\n]+\n/gm,'').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/^export /gm,''));
const load=(name,className,deps)=>new Function(...Object.keys(deps),ordinary(source(name))+`;return ${className};`)(...Object.values(deps));
let installed;const Runtime=runtimeOwnerIdentityProbe(()=>installed);
const Gateway=load('features/settings/SettingsCacheGateway.ts','SettingsCacheGateway',{isReaderCoreTransactionPendingError});
const CleanupOwner=load('features/settings/SettingsCacheCleanupOwner.ts','SettingsCacheCleanupOwner',{ReaderRuntimeOwner:Runtime,ReaderWriteEvidence,projectOperationFacts,SettingsCacheGateway:Gateway});
class SettingsOrchestrator{constructor(){}owns(){return true;}open(){}}
const Host=load('features/settings/SettingsHost.ets','SettingsHost',{ReaderRuntimeOwner:Runtime,SettingsOrchestrator,SettingsCacheCleanupOwner:CleanupOwner});
const tick=()=>new Promise(done=>setImmediate(done)),defer=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{resolve,promise};};
async function until(predicate){for(let i=0;i<100;i++){if(predicate())return;await tick();}assert.fail('cache cleanup did not settle');}
const good=()=>({scope:'cache',cacheEntriesRemoved:4,chapterEntriesRemoved:2,queueEntriesRemoved:1,removedContentBytes:10});
const typedPending=()=>new ReaderCoreRequestError({protocolVersion:1,requestId:1,type:'error',error:{code:'TRANSACTION_PENDING',message:'pre-execution gate',retryable:true,details:{transactionKind:'persistenceMutation',pendingHostOperationCount:0,retryAfterMillis:0}}});
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
const sdkRequire=createRequire(import.meta.url),sdkRoot=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
sdkRequire(sdkRoot+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('CategoryRow',new Set(['content']));
function field(index){const text=source('pages/Index.ets'),start=text.indexOf('  private settingsHost:'),end=text.indexOf('\n  );',start)+6;
 const expression=text.slice(start,end).split('=').slice(1).join('=').trim().replace(/;$/,'');
 return new Function('SettingsHost',ordinary('const value='+expression+';')+'return value;').call(index,Host);}
function fixture(mode='valid'){
 const calls=[],notices=[];let currentMode=mode,gate,report=good(),remainingEntries=10;
 const runtime={getUIAbilityContext:()=>({}),async request(method,params,options){assert.equal(method,'cache.clear');assert.deepEqual(params,{scope:'cache'});calls.push({method,params,options});
  const pause=gate;gate=undefined;if(pause)await pause.promise;
  if(currentMode==='typed')throw typedPending();if(currentMode==='lost-before')throw Error('clear ACK unavailable');remainingEntries=0;if(currentMode==='lost-after')throw Error('clear ACK unavailable');
  if(currentMode==='message-only')throw Object.assign(Error('TRANSACTION_PENDING'),{code:'TRANSACTION_PENDING'});
  return{data:report};}};
 installed=runtime;
 const Methods=productionMotionMethods(file('pages/Index.ets'),['clearTextCache','openSettings'],{ReaderRuntimeOwner:Runtime});
 const index=Object.assign(new Methods(),{mountedRuntimeOwner:runtime,route:'settings',navigationGeneration:1,shelfReceiptRetired:false,settingsSection:'general',settingsSnapshot:{},settingsOperation:{action:'load'},settingsCacheCleanup:undefined,nextNavigationGeneration(){return ++this.navigationGeneration;}});
 index.settingsHost=field(index);
 const sdk=boundedSurfaceSdk({allowEmptyBranchAdmission:true});sdk.childSources.CategoryRow=source('features/settings/CategoryRow.ets');
 sdk.deps.CategoryRow=createReaderBuilderProbe(sdk.childSources.CategoryRow,boundedMembers(sdk.childSources.CategoryRow),sdk.deps,sdk.hooks).Component;
 const pageSource=source('features/settings/SettingsPage.ets');
 // Keep every declared field so the actual V1 @Prop/@Watch update contract is used.
 const ts=sdkRequire(sdkRoot+'/node_modules/typescript'),tree=ts.createSourceFile('/tmp/SettingsCacheConsumer.ets',pageSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,sdkRequire(sdkRoot+'/lib/ets_checker.js').compilerOptions);
 assert.equal(tree.parseDiagnostics.length,0);
 const declaration=tree.statements.find(node=>node.members&&node.members.some(member=>member.name?.getText(tree)==='build'));
 const names=[...declaration.members.filter(node=>ts.isPropertyDeclaration(node)).map(node=>node.name.getText(tree)),
  'cacheActionRow','clearTextCache','onCacheCleanupChanged','applyCacheCleanup','onSnapshotChanged','syncSnapshotValues'];
 function props(){const p=createReaderBuilderProbe(source('pages/Index.ets'),['settingsContent'],{SettingsPage:Child,deviceInfo:{deviceType:'phone'}},{childSources:{SettingsPage:pageSource}}).owner;
  Object.assign(p,index,{clearTextCache:(...args)=>index.clearTextCache(...args)});p.settingsContent();return [...p.children.values()][0].params;}
 function page(identity='settings-back:test'){
  const params=props(),owner=sdk.consumer(pageSource,names,{ReaderRuntimeOwner:Runtime,ReaderNativeAlertOwner},params);
  Object.assign(owner,{mounted:true,themeOwner:runtime,temporaryBackIdentity:identity,appThemeScheme:'day',getUIContext:()=>({getPromptAction:()=>({showToast:opt=>notices.push(opt.message)})})});
  owner.onCacheCleanupChanged();owner.cacheActionRow();
  return{owner,row:()=>sdk.nodes(owner).find(node=>node.type==='Row'&&node.onClick),label:()=>{owner.replay();return sdk.nodes(owner).find(node=>node.type==='Text'&&node.create===owner.cacheActionLabel)?.create;},
   update(){owner.updateStateVars({...props()});owner.replay();}};
 }
 return{index,runtime,calls,notices,page,props,remainingEntries:()=>remainingEntries,snapshot:()=>index.settingsHost.cacheCleanupSnapshot(runtime),mode:v=>{currentMode=v;},report:v=>{report=v;},setOwner:v=>{installed=v;},pause(){gate=defer();return gate;}};
}
{
 const f=fixture(),p=f.page();assert.equal(p.owner.cacheActionLabel,'清理文字缓存');p.row().onClick();p.row().onClick();await until(()=>f.snapshot()?.confirmation==='confirmed');p.update();
 assert.equal(f.calls.length,1);assert.equal(p.owner.cacheActionLabel,'已清理');assert.equal(p.label(),'已清理');assert.equal(f.snapshot().operation.value.removedContentBytes,10);
 assert.equal(f.snapshot().operation.fact,'current');assert.equal(f.snapshot().operation.canRetry,false);
}
for(const mode of ['lost-before','lost-after','message-only']){
 const f=fixture(mode),p=f.page();p.row().onClick();await until(()=>f.snapshot()?.confirmation==='unknown');p.update();
 assert.equal(p.owner.cacheActionLabel,'结果未确认');assert.equal(p.label(),'结果未确认');if(mode==='lost-after')assert.equal(f.remainingEntries(),0);if(mode==='lost-before')assert.equal(f.remainingEntries(),10);assert.equal(f.snapshot().operation.fact,'pendingReconciliation');assert.equal(f.snapshot().operation.canRetry,false);
 p.row().onClick();await tick();assert.equal(f.calls.length,1);assert.match(f.notices[0],/尚未确认.*不能核对/);
 p.owner.mounted=false;f.index.route='bookshelf';f.index.openSettings();const reopened=f.page('settings-back:next');
 assert.equal(reopened.owner.cacheActionLabel,'结果未确认');reopened.row().onClick();await tick();assert.equal(f.calls.length,1,'reopen cannot blind replay an uncertain clear');
}
{
 const f=fixture('typed'),p=f.page();p.row().onClick();await until(()=>f.snapshot()?.confirmation==='undispatched');p.update();assert.equal(p.owner.cacheActionLabel,'清理失败');
 assert.equal(f.snapshot().operation.canRetry,true);f.mode('valid');p.row().onClick();await until(()=>f.snapshot()?.confirmation==='confirmed');p.update();assert.equal(f.calls.length,2);assert.equal(p.owner.cacheActionLabel,'已清理');
}
for(const mutate of [r=>({...r,scope:'all'}),r=>({...r,cacheEntriesRemoved:-1}),r=>({...r,chapterEntriesRemoved:'2'}),r=>({...r,queueEntriesRemoved:0.5}),r=>({...r,removedContentBytes:Number.NaN}),r=>({scope:r.scope})]){
 const f=fixture(),p=f.page();f.report(mutate(good()));p.row().onClick();await until(()=>f.snapshot()?.confirmation==='unknown');p.update();assert.equal(p.owner.cacheActionLabel,'结果未确认');
 p.row().onClick();await tick();assert.equal(f.calls.length,1,'malformed ACK does not certify success or permit replay');
}
for(const mode of ['valid','lost-after'])for(const retirement of ['navigation','unmounted','runtime-unset','runtime-replaced']){
 const f=fixture(mode),p=f.page(),g=f.pause();p.row().onClick();await until(()=>f.calls.length===1);const prior=f.index.settingsCacheCleanup;
 if(retirement==='navigation'){f.index.route='bookshelf';f.index.navigationGeneration++;p.owner.mounted=false;}
 if(retirement==='unmounted'){f.index.shelfReceiptRetired=true;p.owner.mounted=false;}
 if(retirement==='runtime-unset')f.setOwner(undefined);if(retirement==='runtime-replaced')f.setOwner({});
 g.resolve();await until(()=>f.snapshot()?.busy===false);await tick();
 assert.equal(p.owner.cacheActionLabel,'清理中','retired physical page cannot apply late result');
 if(retirement.startsWith('runtime'))assert.equal(f.index.settingsCacheCleanup,prior);
 const n=f.calls.length;await f.props().onClearCache();assert.equal(f.calls.length,n,'old Index callback cannot dispatch after retirement');
}
{
 const f=fixture(),old=f.props().onClearCache;f.index.navigationGeneration++;await old();assert.equal(f.calls.length,0,'captured native Index callback keeps its original nav lease');
 const p=f.page(),oldActor=[...p.owner.children.values()].at(-1),physical=p.row().onClick;p.owner.temporaryBackIdentity='settings-back:replacement';physical();await tick();assert.equal(f.calls.length,0,'same-instance old physical handler cannot dispatch');
 p.owner.replay();const freshActor=[...p.owner.children.values()].at(-1);assert.notEqual(freshActor,oldActor,'actual SDK key admits only fresh small row actor');
 freshActor.onRowClick();await until(()=>f.snapshot()?.confirmation==='confirmed');assert.equal(f.calls.length,1);physical();await tick();assert.equal(f.calls.length,1);
}
{
 const f=fixture(),p=f.page(),g=f.pause();p.row().onClick();await until(()=>f.calls.length===1);
 p.owner.mounted=false;f.index.route='bookshelf';f.index.openSettings();const reopened=f.page('settings-back:reopened-pending');
 assert.equal(reopened.owner.cacheActionLabel,'清理中');g.resolve();await until(()=>f.snapshot()?.confirmation==='confirmed');reopened.update();
 assert.equal(reopened.label(),'已清理');assert.equal(p.owner.cacheActionLabel,'清理中');assert.equal(f.calls.length,1,'new page can consume settled domain ACK without touching old page');
}
{
 const f=fixture();f.index.settingsHost.emitCacheCleanup=snapshot=>{if(snapshot.busy)f.index.navigationGeneration++;};
 await f.index.clearTextCache();assert.equal(f.calls.length,0);assert.equal(f.snapshot().confirmation,'undispatched','retired before actual Gateway admission stays undispatched');
}
{
 const f=fixture();let joined;f.index.settingsHost.emitCacheCleanup=snapshot=>{if(snapshot.busy)joined=f.index.settingsHost.clearCache(f.runtime,()=>true);};
 await f.index.clearTextCache();await joined;assert.equal(f.calls.length,1,'synchronous publication reentry cannot dispatch a second clear before active Promise assignment');
}
{
 const f=fixture();f.index.settingsHost.emitCacheCleanup=()=>{throw Error('native state publisher unavailable');};
 await f.index.clearTextCache();assert.equal(f.snapshot().confirmation,'confirmed');assert.equal(f.snapshot().operation.fact,'current');assert.equal(f.calls.length,1);
}
console.log('PASS actual canonical cache Gateway → finite SettingsHost owner → Index SDK Props → actual V1 Page/CategoryRow: confirmed, typed-before-execution, unknown/malformed receipt, repeated taps, close/reopen, deferred ACK, Runtime/nav/presentation retirement and no blind replay. Current Core has no per-clear readback query.');
