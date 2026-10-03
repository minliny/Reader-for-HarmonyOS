import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {rssSource as read,rssFacts,rssProjection,RssWriteEvidence,RssRuntime,replaceRssRuntime,rssRpc,settleRss,deferredRss,RealRssRouteHost} from './lib/rss-operation-fixture.mjs';
import {ReaderNativeAlertOwner} from '../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
import {isReaderCoreTransactionPendingError} from '../entry/vendor/core-harmony/sdk/reader_core.ts';
import {actualBookshelfOperationTypes, actualBookshelfHostField} from './lib/bookshelf-operation-owner-probe.mjs';
import {actualSourceManagementTypes} from './lib/source-management-owner-probe.mjs';
const require=createRequire(import.meta.url),ts=require((process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader')+'/node_modules/typescript');
function compile(file,n,deps){const source=read(file),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.deepEqual(tree.parseDiagnostics,[]);const emitted=ts.transpileModule(source.replace(/^import[\s\S]*?;\n/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});assert.deepEqual(emitted.diagnostics,[]);const exports={};new Function('exports',...Object.keys(deps),emitted.outputText)(exports,...Object.values(deps));return n===undefined?exports:exports[n];}
const Gateway=compile('features/rss/RssGateway.ts','RssGateway',{ReaderRuntimeOwner:RssRuntime,isReaderCoreTransactionPendingError});
const deps={RssGateway:Gateway,ReaderRuntimeOwner:RssRuntime,ReaderWriteEvidence:RssWriteEvidence,RssRouteOperationHost:RealRssRouteHost,
 hilog:{error(){},warn(){}},isReaderCoreTransactionPendingError,projectPersistedReceipt:rssProjection,projectOperationFacts:rssFacts.projectOperationFacts};
const Lane=compile('features/rss/RssOrchestrator.ets','RssOrchestrator',deps),editor=compile('features/rss/RssSubscriptionEditorOrchestrator.ets',undefined,deps),Editor=editor.RssSubscriptionEditorOrchestrator;
let instances=0;
function makeIndex(runtime,{indexSource=read('pages/Index.ets')}={}){
 replaceRssRuntime(runtime);const p=boundedSurfaceSdk({allowEmptyBranchAdmission:true}),raw=read('features/rss/RssSubscriptionEditorPage.ets');p.hooks.childSources.RssSubscriptionEditorPage=raw;
 const members=['snapshot','onBack','onFeedUrlChanged','onTitleChanged','onEnabledChanged','onEnabledCookieJarChanged','onSourceFieldChanged','onSave','onReconcile','onRetryRead',
  'operationRecovery','recoveryActionIdentities','recoveryGeneration','dispatchRecovery','saveAction','editorField'];
 const Page=createReaderBuilderProbe(raw,members,{...p.deps,EMPTY_RSS_EDITOR_SNAPSHOT:editor.EMPTY_RSS_EDITOR_SNAPSHOT},p.hooks).Component;
 const names=['rssEditorSnapshot','getRssOrchestrator','retireRssPresentation','getRssEditorOrchestrator','retireRssEditorPresentation','isCurrentRssEditorPresentation','isCurrentRuntime',
  'rssEditorContent','rssEditorSurface','feedPresentation','finishRssSubscriptionEdit','nextNavigationGeneration','retireReadingEntryPresentation'];
 for (const name of ['retireBookshelfCatalogPresentation','retireSourceManagementPresentation','retireSyncPresentation','retireRulesPresentation','retireDiscoverPresentation'])
   if (indexSource.includes(`private ${name}(`)) names.push(name);
 const idx=p.consumer(indexSource,names,{ReaderRuntimeOwner:RssRuntime,RssOrchestrator:Lane,RssSubscriptionEditorOrchestrator:Editor,
  RssSubscriptionEditorPage:Page,EMPTY_RSS_EDITOR_SNAPSHOT:editor.EMPTY_RSS_EDITOR_SNAPSHOT,projectOperationFacts:rssFacts.projectOperationFacts,
  isReaderProductSurfaceEnabled:()=>true});
 Object.assign(idx,{mountedRuntimeOwner:runtime,shelfReceiptRetired:false,detailShelfAdmissionMount:1,navigationGeneration:1,route:'rssSubscriptionEditor',
  nativeAlertOwner:new ReaderNativeAlertOwner(),rssInstanceIdentity:++instances,rssPresentationIdentity:'',rssEditorPresentationIdentity:'',retireSourceSwitchPresentation(){},sourceToolsOrchestrator:undefined});
 idx.bookshelfHost=actualBookshelfHostField(idx, actualBookshelfOperationTypes({ReaderRuntimeOwner:RssRuntime}).Host, {setOrCreate(){}});
 idx.sourceHost=new (actualSourceManagementTypes({ReaderRuntimeOwner:RssRuntime}).SourceHost)(()=>{},()=>false,()=>{},()=>runtime);
 const host=idx.getRssEditorOrchestrator();host.openCreate();
 let rendered=false;const paintedPages=new WeakSet();const render=()=>{if(!rendered){idx.rssEditorContent();rendered=true;}else idx.replay();p.properties.flush();const page=p.walk(idx).filter(c=>c instanceof Page).at(-1);if(!paintedPages.has(page)){page.saveAction();page.operationRecovery();paintedPages.add(page);}p.properties.flush();return page;};
 const saveNative=page=>{const button=p.walk(page).find(c=>c.specId==='form-busy-action'&&c.label==='保存');assert.ok(button,'actual retained ReaderButton actor');assert.equal(typeof button.commit,'function');assert.equal(typeof button.aboutToDisappear,'function');const native=[...button.nodes.values()].find(n=>n.type==='Text'&&n.create==='保存');assert.ok(native);return native.onClick;};
 const recoveryNative=page=>{const a=p.walk(page).find(c=>c instanceof p.deps.ReaderRecoveryAction);assert.ok(a);return[...a.nodes.values()].find(n=>n.onClick).onClick;};
 return{p,idx,host,render,saveNative,recoveryNative,settle:()=>settleRss(idx.getRssOrchestrator())};
}
const checks=[];
for(const lost of [false,true]){
 const runtime=rssRpc(),first=makeIndex(runtime);first.host.updateFeedUrl('https://example.test/original');first.host.updateTitle('original');
 const oldPage=first.render(),oldSave=first.saveNative(oldPage),oldInput=oldPage.onTitleChanged;
 const gate=deferredRss();let arrived=false;runtime.before=async m=>{if(m==='rss-source.put'){arrived=true;await gate.promise;}};
 if(lost)runtime.lost.add('rss-source.put');oldSave();while(!arrived)await new Promise(setImmediate);
 first.idx.shelfReceiptRetired=true;const next=makeIndex(runtime);assert.equal(next.host,first.host);const rebuilt=next.render();assert.equal(rebuilt.snapshot.busy,true);
 assert.equal(rebuilt.snapshot.title,'original');oldInput('stale old page');oldSave();assert.equal(next.idx.rssEditorSnapshot.title,'original');
 first.idx.retireRssEditorPresentation();next.host.updateTitle('newer retained draft');gate.resolve();await next.settle();
 assert.equal(next.idx.route,'rssSubscriptionEditor','old ACK must not navigate the new physical editor');assert.equal(runtime.count('rss-source.put'),1);
 assert.equal(next.idx.rssEditorSnapshot.title,'newer retained draft');assert.equal(next.idx.rssEditorSnapshot.operation.receipt.confirmation,lost?'unknown':'confirmed');
 assert.equal(next.idx.rssEditorSnapshot.canSave,!lost);const active=next.render();next.saveNative(active)();await next.settle();
 assert.equal(runtime.count('rss-source.put'),lost?1:2,'unknown receipt blocks a new write, confirmed dirty revision can save');
 checks.push('actual-Index-warm-original-owner-late-'+(lost?'lost-ACK':'ACK')+'-new-draft-old-physical-old-detach');
}
{
 const runtime=rssRpc(),x=makeIndex(runtime);x.host.updateFeedUrl('https://example.test/new');
 runtime.afterWrite=()=>runtime.readFailures.set('rss-source.list',Error('actual readback failed'));x.saveNative(x.render())();await x.settle();
 assert.equal(x.idx.rssEditorSnapshot.operation.receipt.fact,'confirmedRefreshFailed');const leaf=x.render(),retry=x.recoveryNative(leaf),writes=runtime.count('rss-source.put');
 runtime.afterWrite=undefined;retry();retry();await x.settle();assert.equal(runtime.count('rss-source.put'),writes);assert.equal(x.idx.rssEditorSnapshot.operation.receipt.fact,'confirmedCurrent');
 const old=leaf.onSave,oldInput=leaf.onFeedUrlChanged;x.idx.nextNavigationGeneration();x.idx.route='settings';oldInput('https://bad.test');old();retry();await settleRss(Lane.forRuntime(runtime));
 assert.equal(runtime.count('rss-source.put'),writes);replaceRssRuntime(undefined);assert.doesNotThrow(old);checks.push('actual-native-read-only-reconcile-retired-navigation-runtime-no-new-write');
}
{
 const runtime=rssRpc(),x=makeIndex(runtime);x.host.updateFeedUrl('https://example.test/new');runtime.lost.add('rss-source.put');x.saveNative(x.render())();await x.settle();
 const leaf=x.render(),actor=x.p.walk(leaf).find(c=>c instanceof x.p.deps.ReaderRecoveryAction),generation=actor.generation,old=x.recoveryNative(leaf);
 const newer={...leaf.snapshot,operation:{...leaf.snapshot.operation,facts:{...leaf.snapshot.operation.facts,generation:generation+1}}};
 leaf.updateStateVars({snapshot:newer});leaf.replayOnly(leaf.observers.map((fn,i)=>String(fn).includes('new ReaderRecoveryAction')?i:-1).filter(i=>i>=0));
 assert.equal(actor.generation,generation,'immutable lexical key survives old retained observer replay');const before=runtime.calls.length;old();await x.settle();assert.equal(runtime.calls.length,before);
 checks.push('actual-V1-decorated-Page-retained-actor-cannot-borrow-new-projection-generation');
}
{
 const runtime=rssRpc(),first=makeIndex(runtime);first.host.updateFeedUrl('https://example.test/original');const old=first.render().onTitleChanged;
 const next=makeIndex(runtime);next.host.updateTitle('new');old('stale');assert.equal(next.idx.rssEditorSnapshot.title,'new');
 const mutant=read('pages/Index.ets').replace('this.rssEditorPresentationIdentity === identity && (!attached || host.ownsPresentation(identity)) && host.owns(owner) && this.mountedRuntimeOwner === owner &&','host.owns(owner) && this.mountedRuntimeOwner === owner &&');
 const unsafe=makeIndex(runtime,{indexSource:mutant}),unsafeOld=unsafe.render().onTitleChanged;const current=makeIndex(runtime);current.host.updateTitle('current');unsafeOld('obsolete upgrade');
 assert.equal(current.idx.rssEditorSnapshot.title,'obsolete upgrade','negative removal of exact presentation identity borrows the shared current draft');
 checks.push('actual-old-Index-presentation-negative-control');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'full actual SDK emitted RSS Gateway/Orchestrator/Editor + actual Index + decorated Page/native shared recovery; cold receipt/native schedule/device remain separate'}));
