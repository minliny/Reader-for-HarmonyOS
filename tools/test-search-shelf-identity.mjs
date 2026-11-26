import { detailAdmissionFixture } from './lib/reading-entry-action-fixture.mjs';
import { searchReadingJourneyFixture } from './lib/search-reading-journey-owner-probe.mjs';
import { deferred, fixture as entryFixture } from './lib/reading-entry-index-fixture.mjs';
import { ProductionHost } from './lib/reading-entry-owner-probe.mjs';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {SearchResultProjection}=await import('../entry/src/main/ets/features/search/presentation/SearchResultProjection.ts');
const {SearchViewState}=await import('../entry/src/main/ets/features/search/presentation/SearchViewState.ts');
const {ReaderCoreRequestError}=await import('../entry/vendor/core-harmony/sdk/reader_core.ts');
const saved={sourceId:'cat-eye',bookId:'/old',sourceName:'猫眼看书',title:'终宋',author:'怪诞的表哥',contentKind:'text',addedAt:10,sortIndex:0};
const result={...saved,sourceId:'search-source',bookId:'/new',sourceName:'搜索来源',detailUrl:'/new',variables:[]};
let coreLookup=async()=>undefined;const lookupCalls=[];
const fixtures=[];
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function searchFixture(books){
  const calls=[],localCalls=[],notices=[],f=entryFixture();
  // Observe the current Host boundary, then execute its complete actual method.
  // The registry delegates to the real Runtime-scoped production allocator.
  const wrapped=new WeakSet();
  const ReadingHost={forRuntime(owner){
    const actual=ProductionHost.forRuntime(owner);
    if(!wrapped.has(actual)){
      wrapped.add(actual);
      const remote=actual.openRemote,local=actual.openLocal;
      actual.openRemote=function(input,...rest){calls.push(input);return remote.call(this,input,...rest);};
      actual.openLocal=function(book,...rest){localCalls.push([book,...rest]);return local.call(this,book,...rest);};
    }
    return actual;
  }};
  const x=searchReadingJourneyFixture({runtime:f.runtime,ReadingHost,shelfBooks:[],
    failure:(...args)=>notices.push(args),sourceName:sourceId=>sourceId,
    onEvent:event=>{if(event==='membership.refresh')x.membershipRefreshed=true;},
    loadLocal:bookId=>{lookupCalls.push(['local',bookId]);return coreLookup('local',bookId);}});
  x.library.host.updateShelf(books);
  // Keep the real Journey's injected external refresh port observable.
  x.journey.ports.refreshMembership=()=>{x.membershipRefreshed=true;};
  fixtures.push(()=>{x.close();f.close();});
  return {x,calls,localCalls,notices,core:f};
}

function selectGroup(results, membership, fullBook) {
  const { rows } = new SearchResultProjection().update(results, membership, results[0].title, new SearchViewState());
  assert.equal(rows.size, 1);
  const [group] = rows.values();
  assert.equal(group.book, results[0]);
  const fixture = searchFixture(membership);
  if (fullBook) fixture.core.shelves.set(fixture.core.key(fullBook.sourceId, fullBook.bookId), fullBook);
  fixture.x.journey.selectResult(group.book, group.variants);
  return { group, ...fixture };
}

for (const [category, contentKind] of [['novel', 'text'], ['comic', 'manga']]) {
  const representative = { ...result, category, groupKey: 'search-group', author: '', admittedOrder: 0 };
  const variant = { ...representative, sourceId: 'variant', bookId: '/variant', author: saved.author, admittedOrder: 1 };
  const stored = { ...saved, contentKind };
  const { group, calls, x } = selectGroup([representative, variant], [stored]);
  assert.equal(group.inBookshelf, true);
  assert.equal(calls[0]?.shelfSnapshot, stored, 'a work match from a non-representative opens the saved identity');
  assert.equal(calls[0].seed.contentKind, contentKind);
  assert.equal(x.entry.inBookshelf, true);

  const exact = { ...stored, sourceId: variant.sourceId, bookId: variant.bookId, author: '' };
  const exactSelection = selectGroup([representative, variant], [exact]);
  assert.equal(exactSelection.group.inBookshelf, true);
  assert.equal(exactSelection.calls[0]?.shelfSnapshot, exact, 'a group member can match by durable identity alone');

  const ambiguous = selectGroup([representative, variant], [exact, stored]);
  assert.equal(ambiguous.group.inBookshelf, true);
  assert.equal(ambiguous.calls.length, 0, 'the fallback must not silently choose between two saved versions');
  assert.match(ambiguous.notices[0][0], /多个版本/);
}
{
  const olderMembership = { ...saved, contentKind: undefined };
  const { group, calls, core, x } = selectGroup([{ ...result, category: 'novel' }], [olderMembership], saved);
  assert.equal(group.inBookshelf, true);
  await settle();
  assert.ok(core.calls.some(call => call.method === 'bookshelf.get' &&
    call.p.sourceId === saved.sourceId && call.p.bookId === saved.bookId), 'missing media triggers the exact saved lookup');
  assert.equal(calls[0]?.shelfSnapshot.contentKind, 'text');
  assert.equal(calls[0]?.seed.bookId, saved.bookId);
  assert.equal(x.entry.inBookshelf, true);
}
{
  const legacy = { ...saved, contentKind: undefined };
  const { group, calls, x } = selectGroup([{ ...result, category: 'novel' }], [legacy], { ...saved, contentKind: 'manga' });
  assert.equal(group.inBookshelf, true, 'the legacy text alias is provisional');
  await settle();
  assert.equal(calls[0]?.seed.bookId, result.bookId, 'a disproved cross-media alias opens the original novel preview');
  assert.equal(calls[0].seed.contentKind, 'text');
  assert.equal(calls[0].shelfSnapshot, undefined);
  assert.equal(x.entry.inBookshelf, false);
}
{
  const legacy = { ...saved, contentKind: undefined };
  const { x, calls, notices, core } = searchFixture([legacy]);
  const key = core.key(saved.sourceId, saved.bookId), gate = deferred();
  core.shelves.set(key, saved);
  core.gates.set('bookshelf.get:' + key, gate);
  x.journey.selectResult(result, []);
  await settle();
  assert.ok(core.calls.some(call => call.method === 'bookshelf.get'));
  x.library.host.viewState.reset('另一搜索');
  gate.resolve();
  await settle();
  assert.equal(calls.length, 0);
  assert.equal(notices.length, 0);
  assert.equal(x.navigation.snapshot().route, 'search', 'a retired query cannot open the confirmed shelf row');
}
{
  const legacy = { ...saved, sourceId: result.sourceId, bookId: result.bookId, contentKind: undefined };
  const { x, calls } = searchFixture([legacy, saved]);
  x.journey.selectResult(result, []);
  await settle();
  assert.equal(x.membershipRefreshed, true);
  assert.equal(calls[0]?.shelfSnapshot, saved, 'if the provisional exact row disappeared, a surviving unique match still opens');
}
{
  const representative = { ...result, category: 'novel', groupKey: 'group', author: '', admittedOrder: 0 };
  const first = { ...representative, sourceId: 'first', bookId: '/first', admittedOrder: 1 };
  const second = { ...first, sourceId: 'second', bookId: '/second', admittedOrder: 2 };
  const { group, calls, notices } = selectGroup([representative, first, second],
    [{ ...saved, sourceId: first.sourceId, bookId: first.bookId }, { ...saved, sourceId: second.sourceId, bookId: second.bookId }]);
  assert.equal(group.inBookshelf, true);
  assert.equal(calls.length, 0);
  assert.match(notices[0][0], /多个版本/, 'two exact variant identities cannot select a saved row implicitly');
}
for (const [category, shelfKind] of [['comic', 'text'], ['comic', undefined], ['novel', 'manga'], ['novel', 'audio']]) {
  const { group, calls } = selectGroup([{ ...result, category }], [{ ...saved, contentKind: shelfKind }]);
  assert.equal(group.inBookshelf, false, 'separate media do not match by work title');
  assert.equal(calls[0]?.seed.bookId, result.bookId);
  assert.equal(calls[0].shelfSnapshot, undefined);
}
{
  const stored = { ...saved, contentKind: 'manga' };
  const selected = { ...result, sourceId: saved.sourceId, bookId: saved.bookId, category: 'novel' };
  const { group, calls } = selectGroup([selected], [stored]);
  assert.equal(group.inBookshelf, true);
  assert.equal(calls[0].shelfSnapshot, stored);
  assert.equal(calls[0].seed.contentKind, 'manga', 'the exact Core identity determines how detail opens');
}

{
  const projection=new SearchResultProjection().update([result],[saved],'终宋',new SearchViewState());
  assert.equal([...projection.rows.values()][0].inBookshelf,true);
  const {x,calls}=searchFixture([saved]);x.journey.selectResult(result,[]);
  assert.equal(calls[0].seed.sourceId,saved.sourceId);
  assert.equal(calls[0].seed.bookId,saved.bookId);
  assert.equal(calls[0].shelfSnapshot,saved,'offscreen saved work supplies its actual shelf ownership');
  assert.equal(x.library.detailCandidates[0],result,'explicit source choice retains the search candidate');
}
{
  const second={...saved,sourceId:'historical-duplicate',bookId:'/duplicate'};
  const {x,calls,notices}=searchFixture([saved,second]);x.journey.selectResult(result,[]);
  assert.equal(calls.length,0);assert.match(notices[0][1],/不会自动合并/);
  x.journey.selectResult({...result,sourceId:saved.sourceId,bookId:saved.bookId},[]);
  assert.equal(calls[0].shelfSnapshot,saved,'exact saved identity remains selectable among historical duplicates');
}
for(const variant of [{author:''},{author:'另一作者'},{title:'另一本书'}]){
  const {x,calls}=searchFixture([saved]);x.journey.selectResult({...result,...variant},[]);
  assert.equal(calls[0].seed.sourceId,result.sourceId);assert.equal(calls[0].shelfSnapshot,undefined);
}
for(const books of [[{...saved,sourceId:'local'}],[{...saved,author:''}]]){
  const projection=new SearchResultProjection().update([{...result,author:books[0].author}],books,'终宋',new SearchViewState());
  assert.equal([...projection.rows.values()][0].inBookshelf,false,'local/missing-author rows do not claim an online work');
}
{
  const {x,calls}=searchFixture([saved]);
  x.journey.selectResult({...result,author:'作者：怪诞的表哥'},[]);
  assert.equal(calls[0].shelfSnapshot,saved,'shared explicit author-label policy remains in use');
}

let writeCount=0,writeError;
const localSaved={...saved,sourceId:'local',bookId:'import-one',sourceName:'本地导入'};
const localFull={...localSaved,kind:'EPUB',coverUrl:'file://local-cover',intro:'完整简介',
  chapterCount:12,readProgress:3500,readingPosition:{chapterIndex:3,chapterOffset:42,updatedAt:20}};
const localMembership={sourceId:'local',bookId:'import-one',title:localSaved.title,
  author:localSaved.author,addedAt:localSaved.addedAt};
const localResult={...result,sourceId:'local',bookId:'import-one',sourceName:'本地导入'};
{
  const {x,localCalls}=searchFixture([localMembership]);x.controls.shelfBooks=[localFull];
  x.journey.selectResult(localResult,[]);
  assert.equal(localCalls[0][0],localFull,'a visible full shelf row opens its detail immediately');
  assert.equal(lookupCalls.length,0,'visible full shelf rows need no extra Core round trip');
}
{
  let release;coreLookup=()=>new Promise(resolve=>{release=resolve;});
  const {x,localCalls}=searchFixture([localMembership]);
  x.journey.selectResult(localResult,[]);
  assert.deepEqual(lookupCalls.at(-1),['local','import-one']);
  assert.equal(localCalls.length,0,'sparse offscreen membership cannot open a detail before its full DTO arrives');
  release(localFull);await settle();
  assert.equal(localCalls[0][0],localFull,'offscreen membership resolves to the complete Core shelf record');
  assert.equal(localCalls[0][0].chapterCount,12);
  assert.deepEqual(localCalls[0][0].readingPosition,localFull.readingPosition);
}
{
  let release;coreLookup=()=>new Promise(resolve=>{release=resolve;});
  const {x,localCalls,notices}=searchFixture([]);
  x.journey.selectResult(localResult,[]);
  assert.deepEqual(lookupCalls.at(-1),['local','import-one']);
  assert.equal(x.navigation.snapshot().route,'search','a missing UI row must not fabricate an unshelved detail');
  release(localSaved);await settle();
  assert.equal(localCalls[0][0],localSaved,'Core identity resolves an offscreen local book');
  assert.equal(notices.length,0);
}
{
  coreLookup=async()=>undefined;
  const {x,localCalls,notices}=searchFixture([]);
  x.journey.selectResult(localResult,[]);await settle();
  assert.equal(localCalls.length,0);
  assert.match(notices[0][0],/已移除/);
  assert.equal(x.membershipRefreshed,true,'a removed local row refreshes search ownership');
}
{
  coreLookup=async()=>{throw new Error('Core read failed');};
  const {x,localCalls,notices}=searchFixture([]);
  x.journey.selectResult(localResult,[]);await settle();
  assert.equal(localCalls.length,0);
  assert.match(notices[0][0],/打开本地书籍失败/);
  assert.equal(x.navigation.snapshot().route,'search','lookup failure does not create an unusable detail');
}
{
  let release;coreLookup=()=>new Promise(resolve=>{release=resolve;});
  const {x,localCalls,notices}=searchFixture([]);
  x.journey.selectResult(localResult,[]);
  x.entry.retire();x.navigation.advance();x.navigation.show('bookshelf');
  release(localSaved);await settle();
  assert.equal(localCalls.length,0,'a stale lookup cannot reopen a later route');
  assert.equal(notices.length,0);
}
{
  let release;coreLookup=()=>new Promise(resolve=>{release=resolve;});
  const {x,localCalls,calls}=searchFixture([]);
  x.journey.selectResult(localResult,[]);
  x.journey.selectResult(result,[]);
  release(localSaved);await settle();
  assert.equal(calls.length,1,'the newer search selection is admitted');
  assert.equal(localCalls.length,0,'an older local lookup cannot replace a newer result on the same route');
}
function addFixture(){
 const f=detailAdmissionFixture({book:result,add:async()=>{writeCount++;if(writeError)throw writeError;return {data:{sourceId:result.sourceId,bookId:result.bookId,created:true,addedAt:1}};}});
 fixtures.push(f.close);return f;
}
{
 const f=addFixture();f.state.session={identity:saved,book:saved};
 f.detail.request(f.detail.identity());await settle();assert.equal(writeCount,0);assert.match(f.notices[0][1],/详情已变更/);
}
{
 const f=addFixture();
 writeError=new ReaderCoreRequestError({error:{code:'BOOK_ALREADY_ON_SHELF',message:'already exists',details:{existingSourceId:saved.sourceId,existingBookId:saved.bookId}}});
 f.detail.request(f.detail.identity());await settle();assert.equal(writeCount,1);
 assert.equal(f.state.inBookshelf,false,'another identity never becomes this detail row');
 assert.equal(f.state.memberships,1);assert.equal(f.notices.length,0);assert.match(f.detail.admission(f.state.book).message,/已加入书架/);
 assert.equal(f.mutations.snapshot.removalKey,'');writeError=undefined;
}
for(const close of fixtures)close();
console.log('PASS: search groups open the unique saved text/manga identity, confirm legacy membership, reject ambiguous versions and retain stale local lookup guards');
