import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {resolveBookshelfBook}=await import('../entry/src/main/ets/features/bookshelf/BookshelfBookIdentity.ts');
const {SearchPublication}=await import('../entry/src/main/ets/features/search/SearchPublication.ts');
const {SearchResultProjection}=await import('../entry/src/main/ets/features/search/SearchResultProjection.ts');
const {SearchViewState}=await import('../entry/src/main/ets/features/search/SearchViewState.ts');
const {ReaderCoreRequestError}=await import('../entry/vendor/core-harmony/sdk/reader_core.ts');
const index=new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url);
const saved={sourceId:'cat-eye',bookId:'/old',sourceName:'猫眼看书',title:'终宋',author:'怪诞的表哥',addedAt:10};
const result={...saved,sourceId:'search-source',bookId:'/new',sourceName:'搜索来源',detailUrl:'/new',variables:[]};
const coreOwner={};let coreLookup=async()=>undefined;const lookupCalls=[];
const Search=productionMotionMethods(index,['onSearchResultSelected','remoteSeedForSearchBook'],{
  resolveBookshelfBook,LOCAL_SOURCE_ID:'local',
  ReaderRuntimeOwner:{current:()=>coreOwner},
  ReaderCoreGateway:class{constructor(owner){assert.equal(owner,coreOwner);}async loadShelfBook(...identity){
    lookupCalls.push(identity);return coreLookup(...identity);
  }},
});
function searchFixture(books){
  const searchPublication=new SearchPublication();searchPublication.updateShelf(books);
  const calls=[],localCalls=[],notices=[];
  const host=Object.assign(new Search(),{searchPublication,searchPublicationRevision:1,shelfBooks:[],
    openRemoteBookDetail:(...args)=>calls.push(args),showReadingFailure:(...args)=>notices.push(args),
    openLocalBookDetail:(...args)=>localCalls.push(args),
    navigationGeneration:0,route:'search',nextNavigationGeneration(){return ++this.navigationGeneration;},
    refreshSearchShelfMembership(){this.membershipRefreshed=true;},
    sourceDisplayName:sourceId=>sourceId});
  return {host,calls,localCalls,notices};
}
{
  const projection=new SearchResultProjection().update([result],[saved],'终宋',new SearchViewState());
  assert.equal([...projection.rows.values()][0].inBookshelf,true);
  const {host,calls}=searchFixture([saved]);host.onSearchResultSelected(result);
  assert.equal(calls[0][0].sourceId,saved.sourceId);
  assert.equal(calls[0][0].bookId,saved.bookId);
  assert.equal(calls[0][2],saved,'offscreen saved work supplies its actual shelf ownership');
  assert.equal(host.searchDetailCandidates[0],result,'explicit source choice retains the search candidate');
}
{
  const second={...saved,sourceId:'historical-duplicate',bookId:'/duplicate'};
  const {host,calls,notices}=searchFixture([saved,second]);host.onSearchResultSelected(result);
  assert.equal(calls.length,0);assert.match(notices[0][1],/不会自动合并/);
  host.onSearchResultSelected({...result,sourceId:saved.sourceId,bookId:saved.bookId});
  assert.equal(calls[0][2],saved,'exact saved identity remains selectable among historical duplicates');
}
for(const variant of [{author:''},{author:'另一作者'},{title:'另一本书'}]){
  const {host,calls}=searchFixture([saved]);host.onSearchResultSelected({...result,...variant});
  assert.equal(calls[0][0].sourceId,result.sourceId);assert.equal(calls[0][2],undefined);
}
for(const books of [[{...saved,sourceId:'local'}],[{...saved,author:''}]]){
  const projection=new SearchResultProjection().update([{...result,author:books[0].author}],books,'终宋',new SearchViewState());
  assert.equal([...projection.rows.values()][0].inBookshelf,false,'local/missing-author rows do not claim an online work');
}
{
  const {host,calls}=searchFixture([saved]);
  host.onSearchResultSelected({...result,author:'作者：怪诞的表哥'});
  assert.equal(calls[0][2],saved,'shared explicit author-label policy remains in use');
}

let writeCount=0,writeError;
const Add=productionMotionMethods(index,['addDetailBook','isSameDetailBook'],{
  LOCAL_SOURCE_ID:'local',ReaderCoreRequestError,ReaderRuntimeOwner:{current:()=>({})},
  ReaderCoreGateway:class{async upsertBook(){writeCount++;if(writeError)throw writeError;return {created:true};}},
});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const localSaved={...saved,sourceId:'local',bookId:'import-one',sourceName:'本地导入'};
const localResult={...result,sourceId:'local',bookId:'import-one',sourceName:'本地导入'};
{
  const {host,localCalls}=searchFixture([localSaved]);
  host.onSearchResultSelected(localResult);
  assert.equal(localCalls[0][0],localSaved,'offscreen local membership opens the real detail immediately');
  assert.equal(lookupCalls.length,0,'published local membership needs no extra Core round trip');
}
{
  let release;coreLookup=()=>new Promise(resolve=>{release=resolve;});
  const {host,localCalls,notices}=searchFixture([]);
  host.onSearchResultSelected(localResult);
  assert.deepEqual(lookupCalls.at(-1),['local','import-one']);
  assert.equal(host.route,'search','a missing UI row must not fabricate an unshelved detail');
  release(localSaved);await settle();
  assert.equal(localCalls[0][0],localSaved,'Core identity resolves an offscreen local book');
  assert.equal(notices.length,0);
}
{
  coreLookup=async()=>undefined;
  const {host,localCalls,notices}=searchFixture([]);
  host.onSearchResultSelected(localResult);await settle();
  assert.equal(localCalls.length,0);
  assert.match(notices[0][0],/已移除/);
  assert.equal(host.membershipRefreshed,true,'a removed local row refreshes search ownership');
}
{
  coreLookup=async()=>{throw new Error('Core read failed');};
  const {host,localCalls,notices}=searchFixture([]);
  host.onSearchResultSelected(localResult);await settle();
  assert.equal(localCalls.length,0);
  assert.match(notices[0][0],/打开本地书籍失败/);
  assert.equal(host.route,'search','lookup failure does not create an unusable detail');
}
{
  let release;coreLookup=()=>new Promise(resolve=>{release=resolve;});
  const {host,localCalls,notices}=searchFixture([]);
  host.onSearchResultSelected(localResult);
  host.nextNavigationGeneration();host.route='bookshelf';
  release(localSaved);await settle();
  assert.equal(localCalls.length,0,'a stale lookup cannot reopen a later route');
  assert.equal(notices.length,0);
}
{
  let release;coreLookup=()=>new Promise(resolve=>{release=resolve;});
  const {host,localCalls,calls}=searchFixture([]);
  host.onSearchResultSelected(localResult);
  host.onSearchResultSelected(result);
  release(localSaved);await settle();
  assert.equal(calls.length,1,'the newer search selection is admitted');
  assert.equal(localCalls.length,0,'an older local lookup cannot replace a newer result on the same route');
}
function addFixture(){const notices=[];const host=Object.assign(new Add(),{
  detailBook:result,remoteReadingSession:{identity:result,book:result},bookshelfRemovalGeneration:0,
  bookshelfAdditionGeneration:0,bookshelfAdditionActiveKey:'',bookshelfAdditionError:'',
  bookshelfRemovalActiveKey:'',canRemoveDetailBook:()=>true,detailBookKey:()=> 'search-source:/new',
  showReadingFailure:(...args)=>notices.push(args),refreshBookshelf(){},refreshSearchShelfMembership(){this.refreshed=true;},
});return {host,notices};}
{
  const {host,notices}=addFixture();host.remoteReadingSession={identity:saved,book:saved};
  host.addDetailBook();await settle();assert.equal(writeCount,0);assert.match(notices[0][1],/详情已变更/);
}
{
  const {host,notices}=addFixture();
  writeError=new ReaderCoreRequestError({error:{code:'BOOK_ALREADY_ON_SHELF',message:'already exists',
    details:{existingSourceId:saved.sourceId,existingBookId:saved.bookId}}});
  host.addDetailBook();await settle();
  assert.equal(writeCount,1);assert.equal(host.detailInBookshelf,undefined,'another identity never becomes this detail row');
  assert.equal(host.refreshed,true);assert.equal(notices.length,0);
  assert.match(host.bookshelfAdditionError,/已加入书架/);
  assert.equal(host.bookshelfRemovalActiveKey,'');writeError=undefined;
}
console.log('PASS: search selection preserves saved identity; offscreen local details resolve from membership/Core with stale guards; ambiguous and duplicate ownership remains safe');
