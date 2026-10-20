import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const {registerHooks}=await import("node:module");
const {readFileSync}=await import("node:fs");
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY}=await import('../entry/src/main/ets/features/reading/ReadingDirectoryRecovery.ts');
const {projectPersistedReceipt}=await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
const book={sourceId:'s',bookId:'b',title:'书',author:'作者'};
const receipt=(confirmation,readback,canRetry=true)=>projectPersistedReceipt({confirmation,readback,generation:8,canRetry});
const directory=(confirmation,readback,extra={})=>({action:'delete',book,generation:8,requestedCount:2,confirmedCount:2,
 completion:'complete',canContinueOriginal:false,projection:receipt(confirmation,readback),...extra});
const offline=(confirmation,readback,extra={})=>({action:'book',sourceId:'s',bookId:'b',generation:8,
 materialization:'succeeded',canContinueOriginal:false,projection:receipt(confirmation,readback),...extra});
const source=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryRecoverySurface.ets',import.meta.url),'utf8');
function mount(recovery){
 const sdk=boundedSurfaceSdk(),messages=[],calls=[];
 const owner=sdk.consumer(source,undefined,{EMPTY_READING_DIRECTORY_RECOVERY});
 Object.assign(owner,{recovery,getUIContext:()=>({getPromptAction:()=>({showToast:({message})=>messages.push(message)})}),
  onReconcileBookmarks:(g,p)=>calls.push(['bookmarks',g,p]),onReconcileOffline:(g,p)=>calls.push(['offline',g,p])});
 owner.aboutToAppear();owner.initialRender();sdk.properties.flush();
 const actions=()=>sdk.walk(owner).filter(child=>child instanceof sdk.deps.ReaderRecoveryAction);
 const click=label=>{const action=actions().find(child=>child.label===label);assert.ok(action,label);const node=[...action.nodes.values()].find(node=>node.onClick);node.onClick();sdk.properties.flush();};
 return{sdk,owner,messages,calls,actions,click,notices:()=>sdk.walk(owner).filter(child=>child instanceof sdk.deps.ReaderRecoveryNotice)};
}

if(id==='readback'){
{
 const op=directory('confirmed','failed'),before=structuredClone(op);
 const recovery=readingDirectoryRecovery('view',book,op);
 assert.equal(recovery.bookmarksKind,'readback');assert.equal(recovery.bookmarksReadbackFailed,true);
 assert.deepEqual(op,before,'presentation never upgrades or clears the durable receipt');
 const ui=mount(recovery);assert.equal(ui.notices().length,0);assert.equal(ui.messages.length,1);
 ui.owner.notifyReadbackFailures();assert.equal(ui.messages.length,1,'one failure is not repeated per publication');
 ui.click('重新读取书签');assert.deepEqual(ui.calls,[['bookmarks',8,'view']]);
}
}
if(id==='unknown'){
{
 const recovery=readingDirectoryRecovery('view',book,directory('unknown','failed',{completion:'unknown',confirmedCount:1,canContinueOriginal:true}));
 assert.equal(recovery.bookmarksKind,'pending');assert.equal(recovery.canContinueBookmarks,true);
 const ui=mount(recovery);assert.equal(ui.notices().length,1);assert.equal(ui.messages.length,0);
 assert.ok(ui.actions().some(action=>action.label==='继续原操作'));
}
}
if(id==='busy-disabled'){
for(const family of ['bookmarks','offline']){
 const op=family==='bookmarks'?directory('unknown','reading',{completion:'unknown',projection:receipt('unknown','reading',false)}):
  offline('unknown','reading',{projection:receipt('unknown','reading',false)});
 const recovery=readingDirectoryRecovery('view',book,family==='bookmarks'?op:undefined,family==='offline'?op:undefined);
 assert.equal(recovery[family+'Busy'],true,'only the owner published reading fact supplies busy');
 assert.equal(recovery[family].canRetry,false);
 const ui=mount(recovery),label=family==='bookmarks'?'重新载入核对书签':'核对离线结果';
 const action=ui.actions().find(action=>action.label===label);assert.ok(action,'busy retains the original label and action geometry');
 assert.equal(action.isBusy,true);
 const stack=[...action.nodes.values()].find(node=>node.onClick),text=[...action.nodes.values()].find(node=>node.type==='Text');
 assert.equal(stack.constraintSize.minHeight,28);assert.equal(stack.enabled,false);assert.equal(text.create,label);assert.equal(text.opacity,0);
 const spinner=[...action.nodes.values()].find(node=>node.type==='LoadingProgress');assert.ok(spinner);assert.equal(spinner.width,18);assert.equal(spinner.height,18);
 stack.onClick();stack.onClick();assert.deepEqual(ui.calls,[],'busy physical actor does not dispatch again');
 const blocked=family==='bookmarks'?directory('unknown','failed',{completion:'unknown',projection:receipt('unknown','failed',false)}):
  offline('unknown','failed',{projection:receipt('unknown','failed',false)});
 blocked.projection.facts.blocked=true;blocked.projection.facts.blockedReason='unsupported';
 const idle=readingDirectoryRecovery('view',book,family==='bookmarks'?blocked:undefined,family==='offline'?blocked:undefined);
 assert.equal(idle[family+'Busy'],false,'unsupported unknown is not a guessed loading state');
 const blockedUi=mount(idle);assert.equal(blockedUi.notices().length,1);assert.equal(blockedUi.actions().length,0);
 assert.equal(blockedUi.sdk.nodes(blockedUi.owner).some(node=>node.type==='LoadingProgress'),false);
}
}
if(id==='partial-result'){
{
 const recovery=readingDirectoryRecovery('view',book,directory('confirmed','succeeded',{completion:'partial',confirmedCount:1}));
 assert.equal(recovery.bookmarksKind,'result');assert.equal(recovery.canContinueBookmarks,false);
 const ui=mount(recovery);assert.equal(ui.notices().length,0);assert.equal(ui.messages.length,0);
 assert.ok(ui.sdk.nodes(ui.owner).some(node=>node.type==='Text'&&String(node.create).includes('已确认 1/2')));
 ui.click('知道了');assert.equal(ui.owner.dismissedResults.length,1,'closing a result changes only presentation');
}
}
if(id==='offline-result'){
{
 const op=offline('confirmed','succeeded',{progress:{completedChapters:1,totalChapters:3,failedChapters:2}});
 const recovery=readingDirectoryRecovery('view',book,undefined,op);
 assert.equal(recovery.offlineKind,'result');
 const ui=mount(recovery);assert.equal(ui.notices().length,0);assert.equal(ui.messages.length,0);
 assert.equal(ui.actions().length,0,'known download result keeps the original finished task feedback, no duplicate notice');
 const readback=readingDirectoryRecovery('view',book,undefined,offline('confirmed','failed'));
 assert.equal(readback.offlineKind,'readback');
 const readUi=mount(readback);assert.equal(readUi.notices().length,0);assert.equal(readUi.messages.length,1);
 readUi.click('重新读取离线状态');assert.deepEqual(readUi.calls,[['offline',8,'view']]);
 const unknown=readingDirectoryRecovery('view',book,undefined,offline('unknown','succeeded',{materialization:'failed',materializationFailure:'ENOSPC'}));
 assert.equal(unknown.offlineKind,'pending');assert.match(unknown.offline.message,/尚未确认/);
}
}
if(id==='ordinary-state'){
{
 const current=readingDirectoryRecovery('view',book,directory('confirmed','succeeded'),offline('confirmed','succeeded'));
 assert.equal(current.bookmarks.visible,false);assert.equal(current.offline.visible,false);
 const starting=readingDirectoryRecovery('view',book,directory('undispatched','idle',{completion:'notDispatched',confirmedCount:0}),offline('undispatched','idle',{materialization:'running'}));
 assert.equal(starting.bookmarks.visible,false);assert.equal(starting.offline.visible,false,'ordinary dispatch setup is not a terminal result or pending notice');
}
}
if(id==='core-busy'){
const {cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/reading-operation-durable-probe.mjs');console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...durableFixtureToolEvidence()}));let passed=false;try{
const {directoryFixture:fixture,deferred,until}=await import('./lib/reading-operation-durable-probe.mjs');
const {makeIndex,settled,pRecovery}=await import('./lib/reading-directory-sdk-consumer.mjs');
for(const family of ['bookmarks','offline']){
 const f=await fixture(true),x=makeIndex(f,{remote:family==='offline'});
 const writeMethod=family==='bookmarks'?'bookmark.create':'cache.clear',readMethod=family==='bookmarks'?'bookmark.list':'cache.book.status';
 f.options.status=true;f.options.beforeMethod=writeMethod;
 if(family==='bookmarks')x.idx.createDirectoryChapterStartBookmark({chapterIndex:0,chapterTitle:'Chapter'});else x.idx.clearDirectoryBookOffline();
 await until(()=>f.writes().length===1);await settled(f);
 const label=family==='bookmarks'?'重新载入核对书签':'核对离线结果',leaf=x.render('ReaderFullDirectory');
 const original=x.actions(leaf).find(action=>action.label===label);assert.ok(original);
 const native=[...original.nodes.values()].find(node=>node.onClick).onClick;
 const gate=deferred(),readCount=f.calls.filter(call=>call.method===readMethod).length;
 f.options.pauseMethod=readMethod;f.options.gate=gate;
 native();await until(()=>f.calls.filter(call=>call.method===readMethod).length===readCount+1);
 const recovery=x.idx.directoryRecovery();assert.equal(recovery[family+'Busy'],true);
 const host=family==='bookmarks'?f.directory:f.offline;
 assert.equal(host.snapshot().projection.receipt.readback,'reading');
 const live=pRecovery(x.p,leaf,x.Recovery);live.updateStateVars({recovery});
 const dispatched=f.calls.length;native();native();assert.equal(f.calls.length,dispatched,'retained pre-busy native callback cannot dispatch a duplicate reconciliation');
 x.p.properties.flush();
 const action=x.actions(leaf).find(action=>action.label===label);assert.equal(action.isBusy,true);
 assert.equal([...action.nodes.values()].find(node=>node.onClick).enabled,false);
 assert.equal([...action.nodes.values()].find(node=>node.type==='Text').create,label,'busy retains the original label footprint');
 assert.ok([...action.nodes.values()].some(node=>node.type==='LoadingProgress'&&node.width===18&&node.height===18));
 const identity=live.identities().find(identity=>live.isBookmarks(identity)===(family==='bookmarks'));
 live.reconcile(identity,false);assert.equal(f.calls.length,dispatched,'surface busy guard also rejects direct stale action delivery');
 assert.equal(f.writes().length,1,'checking never replays the original mutation');
 gate.resolve();await until(()=>host.snapshot().projection.receipt.readback==='succeeded');
 assert.equal(host.snapshot().projection.receipt.confirmation,'unknown','canonical read does not acknowledge the unresolved mutation');
 assert.equal(f.writes().length,1);
}
passed=true;}finally{const cleanup=await cleanupDurableFixtures({retain:!passed});if(!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
}
const definitions={"readback": "readback actual projection/SDK without Core CLI fixture", "unknown": "unknown actual projection/SDK without Core CLI fixture", "busy-disabled": "busy-disabled actual projection/SDK without Core CLI fixture", "partial-result": "partial-result actual projection/SDK without Core CLI fixture", "offline-result": "offline-result actual projection/SDK without Core CLI fixture", "ordinary-state": "ordinary-state actual projection/SDK without Core CLI fixture", "core-busy": "core-busy actual projection/SDK + existing Core CLI"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
