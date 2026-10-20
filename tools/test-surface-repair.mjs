import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"mode-store": {"description": "实际本地mode键/迁移/flush失败与credential存取隔离及restore operationID", "resources": []}, "import-navigation": {"description": "实际Index+Bookshelf owner导入后导航失效不发布", "resources": []}, "import-picker": {"description": "实际Index picker mutex/旧选择释放/取消仍是fileSelection", "resources": []}, "import-reopen": {"description": "实际Index同路由close/reopen拒绝旧导入结果", "resources": []}, "import-runtime": {"description": "实际Index拒绝旧runtime导入完成", "resources": []}, "projections": {"description": "当前书架来源/分组/章节/进度业务投影", "resources": []}, "result-layout": {"description": "实际localImportResultLayout对给定host预算有界/compact", "resources": []}, "spinner": {"description": "实际SearchSpinner前台/active/reduceMotion动画接纳", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {projectionIndexMethods} = await import('./lib/bookshelf-projection-owner-probe.mjs');
const {actualBookshelfOperationTypes,actualBookshelfHostField,bookshelfOperationClass} = await import('./lib/bookshelf-operation-owner-probe.mjs');
const {runtimeOwnerIdentityProbe} = await import('./lib/reader-runtime-admission-probe.mjs');
const {ReaderWriteEvidence} = await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const { randomUUID } = await import('node:crypto');
const {actualModeHost,readerRecoveryView} = await import('./lib/bookshelf-view-mode-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');
const { ShelfBookPresentation } = await import('../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts');
const { localImportResultLayout } = await import('../entry/src/main/ets/features/bookshelf/LocalImportLayout.ts');

const path=f=>new URL(`../entry/src/main/ets/${f}`,import.meta.url);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
const configIntentFixture=selectedCase==='mode-store'?(await import('./lib/sync-config-intent-fixture.mjs')).configIntentFixture:undefined;
const Store=selectedProductionMethods(path('features/sync/WebDavCredentialStore.ts'),'WebDavCredentialStore',[
 'loadBookshelfViewMode','saveBookshelfViewMode','readOrMigrateViewMode','writeLocalViewMode','validateRestoreJournal','validateSaveOperationId'],
 {util:{generateRandomUUID:()=>randomUUID()},LOCAL_VIEW_MODE_KEY:'mode',LOCAL_MIGRATION_KEY:'version',LOCAL_CONFIG_VERSION:1,LOCAL_RESTORE_JOURNAL_KEY:'journal'});
function fixture(initial={},legacy=null){
 const values=new Map(Object.entries(initial)); let reads=0,writes=0,fail=false;
 const backend={has:async k=>values.has(k),get:async(k,d)=>values.has(k)?values.get(k):d,
 put:async(k,v)=>values.set(k,v),delete:async k=>values.delete(k),flush:async()=>{writes++;if(fail){fail=false;throw Error('flush');}}};
 const s=Object.assign(new Store(),{localModeWriteTail:Promise.resolve(),writeTail:Promise.resolve(),
 contextGeneration:0,pendingBookshelfModeWrites:0,confirmedBookshelfMode:undefined,
 ensureLocalPreferences:async()=>backend,load:async()=>{reads++;return legacy;},normalize:x=>x,persist:async()=>{},remove:async()=>{}});
 return {s,values,backend,reads:()=>reads,writes:()=>writes,fail:()=>{fail=true;}};
}
if(selectedCase==='mode-store'){
 const f=fixture({mode:'list'},{bookshelfViewMode:'cover'});
 assert.equal(await f.s.loadBookshelfViewMode(),'list');assert.equal(f.reads(),0,'local key overrides old asset without reading it');
 assert.equal(f.values.get('version'),1);
 await Promise.all([f.s.saveBookshelfViewMode('cover'),f.s.saveBookshelfViewMode('list'),f.s.saveBookshelfViewMode('cover')]);
 assert.equal(await f.s.loadBookshelfViewMode(),'cover');assert.equal(f.reads(),0,'mode writes never read/overwrite credentials');
 const actual=configIntentFixture(),credential=actual.fixture({empty:true});
 const key=k=>({bookshelfViewMode:'mode',bookshelfConfigVersion:'version',webdavRestoreJournal:'journal'}[k]??k);
 actual.setPreferences({has:k=>f.backend.has(key(k)),get:(k,d)=>f.backend.get(key(k),d),put:(k,v)=>f.backend.put(key(k),v),delete:k=>f.backend.delete(key(k)),flush:()=>f.backend.flush()});
 await credential.store.save({...actual.config,url:'https://new.test'});await credential.store.clear();assert.equal(await f.s.loadBookshelfViewMode(),'cover');actual.cleanup();
}
if(selectedCase==='mode-store'){
 const f=fixture({}, {bookshelfViewMode:'list'});assert.equal(await f.s.loadBookshelfViewMode(),'list');
 assert.equal(await f.s.loadBookshelfViewMode(),'list');assert.equal(f.reads(),1,'migration is one-time');
 const empty=fixture();assert.equal(await empty.s.loadBookshelfViewMode(),'cover');
}
if(selectedCase==='mode-store'){
 const f=fixture({mode:'list',version:1});f.fail();await assert.rejects(f.s.saveBookshelfViewMode('cover'),/flush/);
 assert.equal(await f.s.loadBookshelfViewMode(),'list','failed flush cannot be read as committed');
 await f.s.saveBookshelfViewMode('cover');assert.equal(await f.s.loadBookshelfViewMode(),'cover');
}
if(selectedCase==='mode-store'){
 const f=fixture({mode:'list',version:1}),actual=configIntentFixture(),credential=actual.fixture({empty:true});
 const key=k=>({bookshelfViewMode:'mode',bookshelfConfigVersion:'version',webdavRestoreJournal:'journal'}[k]??k);
 actual.setPreferences({has:k=>f.backend.has(key(k)),get:(k,d)=>f.backend.get(key(k),d),put:(k,v)=>f.backend.put(key(k),v),delete:k=>f.backend.delete(key(k)),flush:()=>f.backend.flush()});
 actual.asset.failAdd=true;await assert.rejects(credential.store.save(actual.config),/cannot be written/);
 const original=(await credential.store.loadConfigIntent()).operationId;await credential.store.continueConfigIntent(original);await credential.store.clear();assert.equal(await f.s.loadBookshelfViewMode(),'list');actual.cleanup();
}
if(selectedCase.startsWith('import-')){
const {until}=await import('./lib/bookshelf-management-durable-probe.mjs');
const {removalFixture}=await import('./lib/bookshelf-removal-durable-probe.mjs');
const roots=[];let completed=false;try{
const receiptFacts=bookshelfOperationClass('app/ReaderOperationFacts.ts','({projectOperationFacts,projectCommitReadback})');
const projectPersistedReceipt=bookshelfOperationClass('app/ReaderPersistedReceiptProjection.ts','projectPersistedReceipt',receiptFacts);
const owner={};let currentOwner=owner,picks=[],imports=[],released=[],applied=[],presented=[];
const Runtime=runtimeOwnerIdentityProbe(()=>currentOwner);
class Gateway {selectLocalBookInputs(){const d=deferred();picks.push(d);return d.promise;} importPreparedSelections(){const d=deferred();imports.push(d);return d.promise;}async releaseUnusedSelections(x){released.push(x);}}
const operationTypes=actualBookshelfOperationTypes({ReaderRuntimeOwner:Runtime,BookshelfFlowGateway:Gateway,projectPersistedReceipt,ReaderWriteEvidence});
const Index=selectedProductionMethods(path('pages/Index.ets'),'Index',[...projectionIndexMethods,'beginImport','isCurrentImport','closeImportDialog','openImportDialog','hasUnknownShelfWrite',
 'hasVisibleImportDialog','visibleImportDialogState','visibleImportBatch','currentImportPresentation','reconcileImportPresentation'], {ReaderRuntimeOwner:Runtime});
async function index(){const actual=await removalFixture();roots.push(actual.root);currentOwner=actual.runtime;actual.Runtime.isCurrent=owner=>Runtime.isCurrent(owner);
 const actualTypes=actualBookshelfOperationTypes({...actual,ReaderRuntimeOwner:Runtime,BookshelfManagementIntentStore:actual.Store,BookshelfRemovalGateway:actual.BookshelfRemovalGateway,BookshelfFlowGateway:Gateway,projectPersistedReceipt,ReaderWriteEvidence});
 let serialized='';const page=Object.assign(new Index(),{route:'bookshelf',navigationGeneration:1,shelfReceiptRetired:false,
 mountedRuntimeOwner:currentOwner,detailShelfAdmissionMount:1,rssInstanceIdentity:1,bookshelfViewState:{anchorKey:'',anchorOffset:0},searchHost:{sources:()=>[],updateShelf(){}},sourceSources:[],sourceToolsSnapshot:{sources:[]},scheduleBookshelfBackgroundRefresh(){},preparePersistedShelfBooks(){},bookshelfLoadGeneration:0,shelfOperation:{...operationTypes.EMPTY_BOOKSHELF_OPERATION_SNAPSHOT},storedImportPresentation:'',shelfReadingFilter:'all',shelfSourceFilter:'all',shelfContentFilter:'all',
 applyBookshelfState:x=>applied.push(x)});
 page.bookshelfHost=actualBookshelfHostField(page,actualTypes.Host,{setOrCreate:(_k,value)=>{serialized=value;presented.push(value?JSON.parse(value):undefined);}});
 page.reconcileImportPresentation();await until(()=>!page.bookshelfHost.operations(currentOwner).current().reconcileBusy);page.openImportDialog();return page;}
const outcome=(batch,shelf)=>{const projection=projectPersistedReceipt({confirmation:'confirmed',readback:'succeeded',value:shelf});return{batch,shelf,readback:projection.receipt,operation:projection.facts};};
const batch={state:'completed',items:[{fileName:'a',state:'success'}],imported:1,failed:0};
if(selectedCase==='import-navigation'){
 const i=await index();const before=picks.length,work=i.beginImport();await i.beginImport();await until(()=>picks.length===before+1);assert.equal(picks.length,1,'pickerOpening prevents duplicate picker');
 picks.at(-1).resolve([{state:'ready'}]);await settle();i.route='reading';i.navigationGeneration++;
 imports.at(-1).resolve(outcome(batch,'committed'));await work;
 assert.equal(applied.length,0,'navigation during import cannot use an old bool');assert.equal(i.bookshelfLoadGeneration,1);
}
if(selectedCase==='import-picker'){
 const i=await index();const before=picks.length,old=i.beginImport();await until(()=>picks.length===before+1);i.closeImportDialog();i.openImportDialog();const count=picks.length;await i.beginImport();assert.equal(picks.length,count,'closing picker retains accepted mutex');
 picks.at(-1).resolve([{state:'ready'}]);await old;assert.equal(released.length,1,'unused stale picker resources released');
 const countBefore=picks.length,fresh=i.beginImport();await until(()=>picks.length===countBefore+1);picks.at(-1).resolve([]);await fresh;assert.equal(presented.at(-1).state,'fileSelection','picker cancellation is not a result');
}
if(selectedCase==='import-reopen'){
 const i=await index();const before=picks.length,work=i.beginImport();await until(()=>picks.length===before+1);picks.at(-1).resolve([{state:'ready'}]);await settle();
 i.closeImportDialog();i.openImportDialog();imports.at(-1).resolve(outcome(batch,'old'));await work;
 assert.equal(applied.length,0,'same-route close/reopen revokes old result');assert.equal(presented.at(-1).state,'fileSelection');
}
if(selectedCase==='import-runtime'){
 const i=await index();const before=picks.length,work=i.beginImport();await until(()=>picks.length===before+1);picks.at(-1).resolve([{state:'ready'}]);await settle();
 currentOwner={};imports.at(-1).resolve(outcome(batch,'old-runtime'));await work;assert.equal(applied.length,0);currentOwner=owner;
}
completed=true;}finally{const {rm}=await import('node:fs/promises');if(completed){for(const root of roots)await rm(root,{recursive:true,force:true});}else console.error(JSON.stringify({kind:'retained-fixture-roots',roots}));}
}
if(selectedCase==='projections'){
const books=[{sourceId:'https://bad.test',bookId:'1',title:'a',author:'b',currentChapterTitle:'current',group:''},
 {sourceId:'remote2',sourceName:'真实书源',bookId:'2',group:'历史分组',readProgress:80}];
assert.equal(ShelfBookPresentation.source(books[0]),'书源名称暂不可用');
assert.equal(ShelfBookPresentation.source(books[1]),'真实书源');
assert.equal(ShelfBookPresentation.latestChapter(books[0]),'暂无最新章节');
assert.deepEqual(ShelfBookPresentation.visible(books,'默认'),[books[0]]);assert.deepEqual(ShelfBookPresentation.visible(books,''),books);
assert.equal(ShelfBookPresentation.progress(books[1]),'已读 <1%');
}
if(selectedCase==='result-layout')for(const items of [0,61,122,427,3050]){const l=localImportResultLayout(500,62,68,76,items);assert.ok(l.height<=500&&l.listHeight>=0);}
if(selectedCase==='result-layout'){assert.equal(localImportResultLayout(140,62,68,76,300).compact,true);assert.equal(localImportResultLayout(0,62,68,76,300).listHeight,0);}
if(selectedCase==='spinner'){
const Spinner=selectedProductionMethods(path('features/search/SearchSpinner.ets'),'SearchSpinner',['shouldAnimate']);
const spin=Object.assign(new Spinner(),{active:true,foreground:true,reduceMotion:false});
assert.equal(spin.shouldAnimate(),true,'the restored platform indicator animates only while needed');
spin.foreground=false;assert.equal(spin.shouldAnimate(),false);
spin.foreground=true;spin.reduceMotion=true;assert.equal(spin.shouldAnimate(),false);
spin.reduceMotion=false;spin.active=false;assert.equal(spin.shouldAnimate(),false);
}
if(selectedCase==='mode-store'){
 const f=fixture({mode:'cover',version:1,journal:JSON.stringify({version:1,operationId:'restore-owner',checksum:'a'.repeat(64)})});
 await assert.rejects(f.s.saveBookshelfViewMode('list'),/BOOKSHELF_RESTORE_PENDING/);
 assert.equal(f.values.get('mode'),'cover','an unfinished approved restore cannot silently override a newer accepted user choice');
 await f.s.saveBookshelfViewMode('list','restore-owner');assert.equal(f.values.get('mode'),'list');
}

}
