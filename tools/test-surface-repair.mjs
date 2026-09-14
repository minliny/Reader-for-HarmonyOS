import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
import { localImportResultLayout } from '../entry/src/main/ets/features/bookshelf/LocalImportLayout.ts';
const path=f=>new URL(`../entry/src/main/ets/${f}`,import.meta.url);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
const Store=productionMotionMethods(path('features/sync/WebDavCredentialStore.ts'),[
 'loadBookshelfViewMode','saveBookshelfViewMode','readOrMigrateViewMode','writeLocalViewMode','save','clear','validateRestoreJournal'],
 {LOCAL_VIEW_MODE_KEY:'mode',LOCAL_MIGRATION_KEY:'version',LOCAL_CONFIG_VERSION:1,LOCAL_RESTORE_JOURNAL_KEY:'journal'});
function fixture(initial={},legacy=null){
 const values=new Map(Object.entries(initial)); let reads=0,writes=0,fail=false;
 const backend={has:async k=>values.has(k),get:async(k,d)=>values.has(k)?values.get(k):d,
 put:async(k,v)=>values.set(k,v),delete:async k=>values.delete(k),flush:async()=>{writes++;if(fail){fail=false;throw Error('flush');}}};
 const s=Object.assign(new Store(),{localModeWriteTail:Promise.resolve(),writeTail:Promise.resolve(),
 ensureLocalPreferences:async()=>backend,load:async()=>{reads++;return legacy;},normalize:x=>x,persist:async()=>{},remove:async()=>{}});
 return {s,values,reads:()=>reads,writes:()=>writes,fail:()=>{fail=true;}};
}
{
 const f=fixture({mode:'list'},{bookshelfViewMode:'cover'});
 assert.equal(await f.s.loadBookshelfViewMode(),'list');assert.equal(f.reads(),0,'local key overrides old asset without reading it');
 assert.equal(f.values.get('version'),1);
 await Promise.all([f.s.saveBookshelfViewMode('cover'),f.s.saveBookshelfViewMode('list'),f.s.saveBookshelfViewMode('cover')]);
 assert.equal(await f.s.loadBookshelfViewMode(),'cover');assert.equal(f.reads(),0,'mode writes never read/overwrite credentials');
 await f.s.save({url:'new credentials'});await f.s.clear();assert.equal(await f.s.loadBookshelfViewMode(),'cover');
}
{
 const f=fixture({}, {bookshelfViewMode:'list'});assert.equal(await f.s.loadBookshelfViewMode(),'list');
 assert.equal(await f.s.loadBookshelfViewMode(),'list');assert.equal(f.reads(),1,'migration is one-time');
 const empty=fixture();assert.equal(await empty.s.loadBookshelfViewMode(),'cover');
}
{
 const f=fixture({mode:'list',version:1});f.fail();await assert.rejects(f.s.saveBookshelfViewMode('cover'),/flush/);
 assert.equal(await f.s.loadBookshelfViewMode(),'list','failed flush cannot be read as committed');
 await f.s.saveBookshelfViewMode('cover');assert.equal(await f.s.loadBookshelfViewMode(),'cover');
}
{
 const f=fixture({mode:'list',version:1});let fail=true;f.s.persist=async()=>{if(fail){fail=false;throw Error('asset');}};
 await assert.rejects(f.s.save({}),/asset/);await f.s.save({});await f.s.clear();assert.equal(await f.s.loadBookshelfViewMode(),'list');
}
const owner={};let currentOwner=owner,picks=[],imports=[],released=[],applied=[],presented=[];
class Gateway {selectLocalBookInputs(){const d=deferred();picks.push(d);return d.promise;} importPreparedSelections(){const d=deferred();imports.push(d);return d.promise;}async releaseUnusedSelections(x){released.push(x);}}
class Presentation {constructor(state,batch){this.state=state;this.batch=batch;}}
const Index=productionMotionMethods(path('pages/Index.ets'),['beginImport','isCurrentImport','closeImportDialog','openImportDialog'],
 {ReaderRuntimeOwner:{current:()=>currentOwner},BookshelfFlowGateway:Gateway,LocalImportPresentation:Presentation,
 hilog:{error(){}},DOMAIN:0,errorMessageOf:e=>String(e)});
function index(){let p={state:'fileSelection'};return Object.assign(new Index(),{route:'bookshelf',navigationGeneration:1,
 importAttemptId:0,importBusyAttempt:0,bookshelfLoadGeneration:0,currentImportPresentation:()=>p,
 writeImportPresentation:x=>{p=x;presented.push(x);},applyBookshelfState:x=>applied.push(x)});}
const batch={state:'completed',items:[{fileName:'a',state:'success'}],imported:1,failed:0};
{
 const i=index();const work=i.beginImport();await i.beginImport();assert.equal(picks.length,1,'pickerOpening prevents duplicate picker');
 picks.at(-1).resolve([{state:'ready'}]);await settle();i.route='reading';i.navigationGeneration++;
 imports.at(-1).resolve({batch,shelf:'committed'});await work;
 assert.equal(applied.length,0,'navigation during import cannot use an old bool');assert.equal(i.bookshelfLoadGeneration,1);
}
{
 const i=index();const old=i.beginImport();i.closeImportDialog();i.openImportDialog();const fresh=i.beginImport();
 picks.at(-2).resolve([{state:'ready'}]);await old;assert.equal(released.length,1,'unused stale picker resources released');
 picks.at(-1).resolve([]);await fresh;assert.equal(presented.at(-1).state,'fileSelection','picker cancellation is not a result');
}
{
 const i=index();const work=i.beginImport();picks.at(-1).resolve([{state:'ready'}]);await settle();
 i.closeImportDialog();i.openImportDialog();imports.at(-1).resolve({batch,shelf:'old'});await work;
 assert.equal(applied.length,0,'same-route close/reopen revokes old result');assert.equal(presented.at(-1).state,'fileSelection');
}
{
 const i=index();const work=i.beginImport();picks.at(-1).resolve([{state:'ready'}]);await settle();
 currentOwner={};imports.at(-1).resolve({batch,shelf:'old-runtime'});await work;assert.equal(applied.length,0);currentOwner=owner;
}
const books=[{sourceId:'https://bad.test',bookId:'1',title:'a',author:'b',currentChapterTitle:'current',group:''},
 {sourceId:'remote2',sourceName:'真实书源',bookId:'2',group:'历史分组',readProgress:80}];
assert.equal(ShelfBookPresentation.source(books[0]),'书源名称暂不可用');
assert.equal(ShelfBookPresentation.source(books[1]),'真实书源');
assert.equal(ShelfBookPresentation.latestChapter(books[0]),'暂无最新章节');
assert.deepEqual(ShelfBookPresentation.visible(books,'默认'),[books[0]]);assert.deepEqual(ShelfBookPresentation.visible(books,''),books);
assert.equal(ShelfBookPresentation.progress(books[1]),'已读 <1%');
for(const items of [0,61,122,427,3050]){const l=localImportResultLayout(500,62,68,76,items);assert.ok(l.height<=500&&l.listHeight>=0);if(items===61)assert.ok(l.height<300);}
assert.equal(localImportResultLayout(140,62,68,76,300).compact,true);assert.equal(localImportResultLayout(0,62,68,76,300).listHeight,0);
const Spinner=productionMotionMethods(path('features/search/SearchSpinner.ets'),['shouldAnimate']);
const spin=Object.assign(new Spinner(),{active:true,foreground:true,reduceMotion:false});
assert.equal(spin.shouldAnimate(),true,'the restored platform indicator animates only while needed');
spin.foreground=false;assert.equal(spin.shouldAnimate(),false);
spin.foreground=true;spin.reduceMotion=true;assert.equal(spin.shouldAnimate(),false);
spin.reduceMotion=false;spin.active=false;assert.equal(spin.shouldAnimate(),false);
console.log('PASS surface repair: production import lifecycle, serialized local mode migration/failure, shared projection, responsive sizing, history and spinner ownership');
const ShelfMode=productionMotionMethods(path('features/bookshelf/BookshelfPage.ets'),['setViewMode','retryViewMode','loadViewMode','persistRequestedViewMode'],{ReaderThemeHost:{prepareUserChange:async()=>{}}});
{
 const first=deferred(),second=deferred();let writes=0;
 const shelf=Object.assign(new ShelfMode(),{mounted:true,viewModeRevision:0,confirmedViewMode:'cover',reduceMotion:true,
 webDavCredentials:{loadBookshelfViewMode:async()=> shelf.confirmedViewMode,saveBookshelfViewMode:()=> ++writes===1?first.promise:second.promise},
 resetViewSwitchMotion(){},setRestingProjectionOpacity(){},rebuildShelfProjection(){}});
 shelf.setViewMode('list');await settle();first.resolve();await settle();shelf.setViewMode('cover');await settle();second.reject(Error('flush'));await settle();
 assert.equal(shelf.viewMode,'list','failed newest write rolls back to most recently ACKed value, not oldest baseline');
 assert.equal(shelf.requestedViewMode,'cover','retry retains failed requested value');
 let saves=0;shelf.viewModeReadFailed=true;shelf.webDavCredentials={loadBookshelfViewMode:async()=> 'list',saveBookshelfViewMode:async()=>saves++};
 shelf.retryViewMode();await settle();assert.equal(saves,0,'a failed initial read retries reading and cannot overwrite unknown durable choice');
 assert.equal(shelf.viewMode,'list');
}

{
 const f=fixture({mode:'cover',version:1,journal:JSON.stringify({version:1,operationId:'restore-owner',checksum:'a'.repeat(64)})});
 await assert.rejects(f.s.saveBookshelfViewMode('list'),/BOOKSHELF_RESTORE_PENDING/);
 assert.equal(f.values.get('mode'),'cover','an unfinished approved restore cannot silently override a newer accepted user choice');
 await f.s.saveBookshelfViewMode('list','restore-owner');assert.equal(f.values.get('mode'),'list');
}
