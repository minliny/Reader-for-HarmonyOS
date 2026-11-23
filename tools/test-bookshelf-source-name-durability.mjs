import assert from 'node:assert/strict';
import { actualProjectionTypes } from './lib/bookshelf-projection-owner-probe.mjs';
import { bookshelfOperationClass } from './lib/bookshelf-operation-owner-probe.mjs';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';
import { BookshelfViewState } from '../entry/src/main/ets/features/bookshelf/presentation/BookshelfViewState.ts';
import { readerRecoveryView } from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import { errorMessageOf, localReadFailureSummary } from '../entry/src/main/ets/app/ErrorMessage.ts';
import * as sourceNames from '../entry/src/main/ets/features/bookshelf/application/BookshelfSourceNameProjection.ts';
import * as headerMetrics from '../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { ReaderNavigation } from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import { ReaderEntryStartupTrace } from '../entry/src/main/ets/app/ReaderStartupTrace.ts';
import { readingEntryInputForSearchContext } from '../entry/src/main/ets/features/reading/presentation/ReadingEntryDto.ts';
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
const types=actualProjectionTypes(()=>owner);
const sourceGateway=new types.SourceGateway(owner);
const projection=new types.BookshelfProjectionOwner(owner,()=>true,
  ()=>assert.fail('name projection must not start an unrelated bookshelf read'),
  (ids,current)=>sourceGateway.loadSourcesForIds(ids,current));
const initialHeaderHeight=bookshelfOperationClass('ui/foundation/ReaderHeaderSpecs.ets','readerPageInitialHeaderHeight',
  {...headerMetrics,TOK_BORDER_W:readerFoundationTokens.TOK_BORDER_W});
const ShelfRead=bookshelfOperationClass('features/bookshelf/presentation/BookshelfReadPresentation.ets','BookshelfReadPresentation',{
  Observed:value=>value,BookshelfViewState,readerRecoveryView,readerPageInitialHeaderHeight:initialHeaderHeight,
  ...sourceNames,AppStorage:{get:()=>undefined},hilog:{warn(){},error(){}},errorMessageOf,localReadFailureSummary,
});
const scene={owner,instance:1,mounting:1,navigation:1,route:'bookshelf'};
const shelfRead=new ShelfRead({scene:()=>scene,projection:runtime=>{assert.equal(runtime,owner);return projection;},
  sources:()=>[],membership(){},accepted(){},ready(){},beginRead:()=>0,endRead(){}});
const populated={kind:'populated',shelf,continueReading:undefined};
shelfRead.accept(populated);await new Promise(resolve=>setImmediate(resolve));
assert.equal(sourceLoads,0,'complete Core shelf projection does not load the full source registry');
assert.equal(shelfRead.snapshot.books[0].sourceName,'持久名称','source.list failure preserves cold Core name rather than an older registry');
assert.equal(shelfRead.snapshot.books[0].readProgress,4520);assert.equal(shelfRead.snapshot.books[0].currentChapterIndex,4);
assert.equal(shelfRead.snapshot.books[0].readingPosition.chapterOffset,123);
assert.deepEqual(shelfRead.snapshot.books[0],shelf.books[0],'the initial shelf projection only adapts sourceName and preserves the full decoded DTO');
sources=[{sourceId:'source-a',name:'新名称'}];await projection.hydrate(shelfRead.binding);
assert.equal(shelfRead.snapshot.books[0].sourceName,'新名称');
assert.equal(shelfRead.snapshot.books[0].readingPosition.bodyVersion,'b','source-name hydration preserves Core position proof');
assert.deepEqual(shelfRead.snapshot.books[0],{...shelf.books[0],sourceName:'新名称'},'later name hydration preserves media type and every other ShelfBook field');
sources=[];await projection.hydrate(shelfRead.binding);
assert.equal(shelfRead.snapshot.books[0].sourceName,'新名称','a successful but filtered source list cannot establish persistent source deletion');
sources=undefined;shelfRead.accept({...populated,shelf:{books:[{...shelf.books[0],sourceName:'书源已移除'}],total:1}});
await new Promise(resolve=>setImmediate(resolve));assert.equal(shelfRead.snapshot.books[0].sourceName,'书源已移除','stale in-memory source must not resurrect deletion');
sources=[{sourceId:'source-b',name:'另一个源'}];shelfRead.accept({kind:'populated',shelf:{books:[{...raw},{...raw,sourceId:'source-b'}],total:2},continueReading:undefined});await projection.hydrate(shelfRead.binding);
assert.deepEqual(shelfRead.snapshot.books.map(b=>b.sourceName),['持久名称','另一个源'],'same bookId keeps exact source isolation without treating an unmatched source as deleted');
for (const name of ['ftp://reader.example','www.reader.example','source-a']) {
  sources=[{sourceId:'source-a',name}];shelfRead.accept({kind:'populated',shelf:{books:[{...raw}],total:1},continueReading:undefined});await projection.hydrate(shelfRead.binding);
  assert.equal(shelfRead.snapshot.books[0].sourceName,'持久名称','invalid registry names cannot erase an already known name or reintroduce URL/identity labels');
}

console.log('PASS Core shelf-name DTO, cold source.list failure, rename/delete/source identity, legacy field compatibility and progress-preserving Host projection');

// Both shelf entry handlers deliver the real projection through current
// EntryActions and ReadingEntryPresentation. Only the existing acquisition Host
// and platform geometry/viewport ports are controlled. Classification, names,
// navigation and probe binding execute unchanged production code.
let selectionRuntime;
const ShelfSelection=productionMotionMethods(file('features/bookshelf/ui/BookshelfPage.ets'),
  ['bookSelectionHandler','isShelfPresentationCurrent']);
const EntryActions=bookshelfOperationClass('app/composition/ReaderReadingEntryActions.ets',
  'ReaderReadingEntryActions',{Observed:value=>value,readingEntryInputForSearchContext});
for (const contentKind of ['manga','text','audio',undefined]) {
  const payload={...raw};
  if(contentKind===undefined)delete payload.contentKind;else payload.contentKind=contentKind;
  const decoded=gateway.decodeShelfBook(payload);
  sources=[{sourceId:decoded.sourceId,name:'投影名称'}];
  shelfRead.accept({kind:'populated',shelf:{books:[decoded],total:1},continueReading:decoded});
  await projection.hydrate(shelfRead.binding);
  assert.deepEqual(shelfRead.snapshot.books[0],{...decoded,sourceName:'投影名称'},'media type survives the initial and hydrated projection');
  assert.strictEqual(shelfRead.snapshot.continueReading,decoded,'continue-reading retains its Core DTO');
  assert.equal(Object.hasOwn(shelfRead.snapshot.books[0],'contentKind'),contentKind!==undefined,'legacy absence does not become an invented media type');
  for(const [entry,provider] of [['shelf-row',()=>shelfRead.snapshot.books[0]],['continue-reading',()=>shelfRead.snapshot.continueReading]]) {
    const probe=new MangaOfflineNetworkProbe(undefined,()=>{},'reading',true),selections=[],opened=[],failures=[];
    selectionRuntime={selectMangaOfflineProbe(sourceId,bookId,manga){selections.push({sourceId,bookId,manga});probe.select(sourceId,bookId,manga);},
      mangaOfflineProbeFor:(sourceId,bookId)=>probe.matches(sourceId,bookId),noteReadingPreparationIntent(){}};
    const sourceNameRequests=[];
    const acquisition={snapshot:()=>({scopeId:0}),
      openRemote(input,lease){assert.equal(lease.isCurrent(),true);opened.push(input);},
      openLocal:()=>assert.fail('remote source identity must not enter local acquisition')};
    const Entry=actualReadingEntryPresentation({ReadingEntryHost:{forRuntime(runtime){
      assert.equal(runtime,selectionRuntime);return acquisition;
    }}});
    const readingEntry=new Entry(),navigation=new ReaderNavigation();
    const sourceSwitch={visible:false};
    const entryActions=new EntryActions(navigation,new ReaderEntryStartupTrace(()=>{}),{
      runtime:()=>selectionRuntime,mounting:()=>1,entry:()=>readingEntry,
      search:()=>({host:{visibilityChanged(){}},admissionCandidates:()=>[]}),
      sourceSwitch:()=>sourceSwitch,shelfBooks:()=>shelfRead.snapshot.books,
      removalPending:()=>false,readerExitPending:()=>false,
      advance:()=>{readingEntry.retire();entryActions.retirePreparation();return navigation.advance().generation;},
      show:route=>navigation.show(route),bindReader(){},restoreReaderReturn:()=>false,
      entryPorts:()=>({current:()=>true,projectionVisible:()=>false,membership:()=>({}),
        cacheDecision:async()=>false,notice:(title,message)=>failures.push({title,message}),refreshShelf(){}}),
      sourceName:(sourceId,persistedName)=>{
        sourceNameRequests.push({sourceId,persistedName});
        return shelfRead.sourceDisplayName(sourceId,persistedName);
      },
      failure:(title,message)=>failures.push({title,message}),afterOpening:project=>project(),postFrame:action=>action(),refreshNearEnd(){},
    });
    const origin={x:4,y:8,width:100,height:160},viewState=new BookshelfViewState();
    let viewportSaves=0;
    const continuing=entry==='continue-reading';
    const page=Object.assign(new ShelfSelection(),{mounted:true,navigationGeneration:1,viewState,
      saveShelfViewport(){viewportSaves++;},
      measureBookOrigin(book,isContinuing){assert.equal(book,provider());assert.equal(isContinuing,continuing);return origin;},
      onBookSelected:(book,generation,actualOrigin)=>{
        assert.equal(generation,1);assert.equal(actualOrigin,origin);entryActions.resumeShelf(book);
      }});
    page.bookSelectionHandler(provider,continuing)();
    assert.equal(viewportSaves,1);
    assert.equal(viewState.openedBookKey,JSON.stringify([decoded.sourceId,decoded.bookId]));
    assert.equal(viewState.openedFromContinueReading,continuing);
    const snapshot=JSON.parse(probe.snapshot());
    if(contentKind==='audio') {
      assert.equal(selections.length,0,`${entry}: unsupported audio is rejected before probe binding`);
      assert.equal(opened.length,0);assert.equal(sourceNameRequests.length,0);assert.equal(failures.length,1);assert.equal(snapshot.state,'armed');
    } else {
      assert.deepEqual(selections,[{sourceId:decoded.sourceId,bookId:decoded.bookId,manga:contentKind==='manga'}],`${entry}: exact identity and media classification reach the real dispatcher`);
      assert.equal(opened.length,1);assert.strictEqual(opened[0].shelfSnapshot,provider());assert.equal(opened[0].resumeImmediately,true);
      assert.deepEqual(sourceNameRequests,[{sourceId:decoded.sourceId,persistedName:provider().sourceName}],`${entry}: current entry action forwards the exact persisted name`);
      assert.equal(opened[0].sourceName,provider().sourceName,`${entry}: name survives current presentation and acquisition input`);
      assert.equal(opened[0].seed.contentKind,contentKind,'reading seed preserves the original content kind');
      assert.equal(failures.length,0);
      assert.equal(snapshot.state,contentKind==='manga'?'active':'released',`${entry}: the first manga click activates the real selection probe`);
      assert.equal(snapshot.identityBound,contentKind==='manga');
      assert.equal(probe.observesReading(decoded.sourceId,decoded.bookId),contentKind==='manga');
    }
  }
}
console.log('PASS full ShelfBook field preservation and both production shelf selection entries for manga/text/audio/legacy DTOs');

const Sources=productionMotionMethods(file('features/source/application/SourceGateway.ts'),['loadSourcesForIds']);
let active=true;const calls=[];
const exact=Object.assign(new Sources(),{loadSources:async id=>{calls.push(id);return[{sourceId:id,name:id},{sourceId:'unexpected',name:'not admitted'}];}});
assert.deepEqual((await exact.loadSourcesForIds(['source-a','source-a','local','source-b'],()=>active)).map(s=>s.sourceId),['source-a','source-b']);
assert.deepEqual(calls,['source-a','source-b']);active=false;await exact.loadSourcesForIds(['source-c'],()=>active);assert.equal(calls.length,2);
console.log('shelf source fallback: exact unique identities only, cancellation and foreign-result rejection PASS');
