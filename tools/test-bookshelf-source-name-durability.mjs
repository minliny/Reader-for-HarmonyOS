import assert from 'node:assert/strict';
import { actualProjectionTypes, actualProjectionIndex } from './lib/bookshelf-projection-owner-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { MangaOfflineNetworkProbe } from '../entry/src/main/ets/app/MangaOfflineNetworkProbe.ts';
const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const Gateway = productionMotionMethods(file('app/ReaderCoreGateway.ts'), ['loadBookshelf','decodeShelfBook','decodeShelfReadingPosition','requiredNonNegativeInteger','requiredString','requiredNumber','optionalString','optionalNumber','optionalNonNegativeInteger']);
const raw = {sourceId:'source-a',bookId:'same',sourceName:'持久名称',title:'T',author:'A',kind:'MANGA',contentKind:'manga',
  coverUrl:'https://example.test/cover',intro:'简介',lastChapter:'最新章',addedAt:1,lastReadAt:2,group:'分组',sortIndex:3,
  unreadCount:2,lastCheckAt:3,currentChapterTitle:'当前章',readProgress:4520,currentChapterIndex:4,chapterCount:12,
  readingPosition:{chapterIndex:4,chapterOffset:123,updatedAt:1,locationRevision:'r',bodyVersion:'b',processingVersion:'p'}};
let requested=[];
const gateway = Object.assign(new Gateway(), {runtimeOwner:{request:async method=>{requested.push(method);return {data:{books:[raw],total:1}};}}});
const shelf=await gateway.loadBookshelf();
assert.deepEqual(requested,['bookshelf.list'],'cold bookshelf names do not require a separate successful source.list');
assert.equal(shelf.books[0].sourceName,'持久名称');assert.equal(shelf.books[0].readProgress,4520);
assert.deepEqual(shelf.books[0],raw,'Core decoding preserves every declared ShelfBook business field');
for(const sourceName of ['source-a','https://example.test','ftp://example.test','www.example.test','']){
  assert.equal(gateway.decodeShelfBook({...raw,sourceName}).sourceName,'书源名称暂不可用');
}
const legacy={...raw};delete legacy.sourceName;
assert.equal(gateway.decodeShelfBook(legacy).sourceName,undefined,'old Core wire payload remains valid');
let sources; let sourceLoads=0;
const owner={supportsCoreCapability:()=>false,async request(method,params){assert.equal(method,'source.list');sourceLoads++;if(sources===undefined)throw Error('source.list failed');return{data:{sources:sources.map(s=>({...s,enabled:true}))}};}};
const types=actualProjectionTypes(()=>owner),actual=actualProjectionIndex(owner,types),host=actual.idx,projection=actual.owner;
const populated={kind:'populated',shelf,continueReading:undefined};
host.applyBookshelfState(populated);await new Promise(resolve=>setImmediate(resolve));
assert.equal(sourceLoads,0,'complete Core shelf projection does not load the full source registry');
assert.equal(host.shelfBooks[0].sourceName,'持久名称','source.list failure preserves cold Core name rather than an older registry');
assert.equal(host.shelfBooks[0].readProgress,4520);assert.equal(host.shelfBooks[0].currentChapterIndex,4);
assert.equal(host.shelfBooks[0].readingPosition.chapterOffset,123);
assert.deepEqual(host.shelfBooks[0],shelf.books[0],'the initial shelf projection only adapts sourceName and preserves the full decoded DTO');
sources=[{sourceId:'source-a',name:'新名称'}];await projection.hydrate(host.bookshelfProjectionBinding);
assert.equal(host.shelfBooks[0].sourceName,'新名称');
assert.equal(host.shelfBooks[0].readingPosition.bodyVersion,'b','source-name hydration preserves Core position proof');
assert.deepEqual(host.shelfBooks[0],{...shelf.books[0],sourceName:'新名称'},'later name hydration preserves media type and every other ShelfBook field');
sources=[];await projection.hydrate(host.bookshelfProjectionBinding);
assert.equal(host.shelfBooks[0].sourceName,'新名称','a successful but filtered source list cannot establish persistent source deletion');
sources=undefined;host.applyBookshelfState({...populated,shelf:{books:[{...shelf.books[0],sourceName:'书源已移除'}],total:1}});
await new Promise(resolve=>setImmediate(resolve));assert.equal(host.shelfBooks[0].sourceName,'书源已移除','stale in-memory source must not resurrect deletion');
sources=[{sourceId:'source-b',name:'另一个源'}];host.applyBookshelfState({kind:'populated',shelf:{books:[{...raw},{...raw,sourceId:'source-b'}],total:2},continueReading:undefined});await projection.hydrate(host.bookshelfProjectionBinding);
assert.deepEqual(host.shelfBooks.map(b=>b.sourceName),['持久名称','另一个源'],'same bookId keeps exact source isolation without treating an unmatched source as deleted');
for (const name of ['ftp://reader.example','www.reader.example','source-a']) {
  sources=[{sourceId:'source-a',name}];host.applyBookshelfState({kind:'populated',shelf:{books:[{...raw}],total:1},continueReading:undefined});await projection.hydrate(host.bookshelfProjectionBinding);
  assert.equal(host.shelfBooks[0].sourceName,'持久名称','invalid registry names cannot erase an already known name or reintroduce URL/identity labels');
}

console.log('PASS Core shelf-name DTO, cold source.list failure, rename/delete/source identity, legacy field compatibility and progress-preserving Host projection');

// Both mounted shelf entry points deliver their exact production projection
// through the real page handler and Index dispatcher. Only downstream reading
// acquisition is captured here; selection classification and probe binding run
// unchanged, so a dropped manga type cannot be hidden by a later Core read.
let selectionRuntime;
const ShelfSelection=productionMotionMethods(file('features/bookshelf/BookshelfPage.ets'),
  ['bookSelectionHandler','isShelfPresentationCurrent']);
const ReadingSelection=productionMotionMethods(file('pages/Index.ets'),['openShelfBook'],
  {ReaderRuntimeOwner:{current:()=>selectionRuntime},LOCAL_SOURCE_ID:'local'});
for (const contentKind of ['manga','text','audio',undefined]) {
  const payload={...raw};
  if(contentKind===undefined)delete payload.contentKind;else payload.contentKind=contentKind;
  const decoded=gateway.decodeShelfBook(payload);
  sources=[{sourceId:decoded.sourceId,name:'投影名称'}];
  host.applyBookshelfState({kind:'populated',shelf:{books:[decoded],total:1},continueReading:decoded});
  await projection.hydrate(host.bookshelfProjectionBinding);
  assert.deepEqual(host.shelfBooks[0],{...decoded,sourceName:'投影名称'},'media type survives the initial and hydrated projection');
  assert.strictEqual(host.continueReading,decoded,'continue-reading retains its Core DTO');
  assert.equal(Object.hasOwn(host.shelfBooks[0],'contentKind'),contentKind!==undefined,'legacy absence does not become an invented media type');
  for(const [entry,provider] of [['shelf-row',()=>host.shelfBooks[0]],['continue-reading',()=>host.continueReading]]) {
    const probe=new MangaOfflineNetworkProbe(undefined,()=>{},'reading',true),selections=[],opened=[],failures=[];
    selectionRuntime={selectMangaOfflineProbe(sourceId,bookId,manga){selections.push({sourceId,bookId,manga});probe.select(sourceId,bookId,manga);},
      mangaOfflineProbeFor:(sourceId,bookId)=>probe.matches(sourceId,bookId),noteReadingPreparationIntent(){}};
    const reader=Object.assign(new ReadingSelection(),{route:'bookshelf',navigationGeneration:1,shelfEntryTraceAttempt:0,
      sourceDisplayName:(_sourceId,name)=>name,
      openRemoteBookDetail:(seed,_name,book,resume)=>opened.push({seed,book,resume}),
      openLocalBookDetail:()=>assert.fail('remote source identity must not enter local acquisition'),
      showReadingFailure:(title,message)=>failures.push({title,message})});
    const page=Object.assign(new ShelfSelection(),{mounted:true,navigationGeneration:1,
      onBookSelected:(book,navigation)=>{assert.equal(navigation,1);reader.openShelfBook(book);}});
    page.bookSelectionHandler(provider)();
    const snapshot=JSON.parse(probe.snapshot());
    if(contentKind==='audio') {
      assert.equal(selections.length,0,`${entry}: unsupported audio is rejected before probe binding`);
      assert.equal(opened.length,0);assert.equal(failures.length,1);assert.equal(snapshot.state,'armed');
    } else {
      assert.deepEqual(selections,[{sourceId:decoded.sourceId,bookId:decoded.bookId,manga:contentKind==='manga'}],`${entry}: exact identity and media classification reach the real dispatcher`);
      assert.equal(opened.length,1);assert.strictEqual(opened[0].book,provider());assert.equal(opened[0].resume,true);
      assert.equal(opened[0].seed.contentKind,contentKind,'reading seed preserves the original content kind');
      assert.equal(failures.length,0);
      assert.equal(snapshot.state,contentKind==='manga'?'active':'released',`${entry}: the first manga click activates the real selection probe`);
      assert.equal(snapshot.identityBound,contentKind==='manga');
      assert.equal(probe.observesReading(decoded.sourceId,decoded.bookId),contentKind==='manga');
    }
  }
}
console.log('PASS full ShelfBook field preservation and both production shelf selection entries for manga/text/audio/legacy DTOs');

const Sources=productionMotionMethods(file('features/source/SourceGateway.ts'),['loadSourcesForIds']);
let active=true;const calls=[];
const exact=Object.assign(new Sources(),{loadSources:async id=>{calls.push(id);return[{sourceId:id,name:id},{sourceId:'unexpected',name:'not admitted'}];}});
assert.deepEqual((await exact.loadSourcesForIds(['source-a','source-a','local','source-b'],()=>active)).map(s=>s.sourceId),['source-a','source-b']);
assert.deepEqual(calls,['source-a','source-b']);active=false;await exact.loadSourcesForIds(['source-c'],()=>active);assert.equal(calls.length,2);
console.log('shelf source fallback: exact unique identities only, cancellation and foreign-result rejection PASS');
