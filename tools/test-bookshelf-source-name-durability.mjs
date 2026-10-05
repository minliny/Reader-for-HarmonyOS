import assert from 'node:assert/strict';
import { actualProjectionTypes, actualProjectionIndex } from './lib/bookshelf-projection-owner-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const Gateway = productionMotionMethods(file('app/ReaderCoreGateway.ts'), ['loadBookshelf','decodeShelfBook','decodeShelfReadingPosition','requiredNonNegativeInteger','requiredString','requiredNumber','optionalString','optionalNumber','optionalNonNegativeInteger']);
const raw = {sourceId:'source-a',bookId:'same',sourceName:'持久名称',title:'T',author:'A',addedAt:1,sortIndex:3,readProgress:4520,currentChapterIndex:4,
  readingPosition:{chapterIndex:4,chapterOffset:123,updatedAt:1,bodyVersion:'b',processingVersion:'p'}};
let requested=[];
const gateway = Object.assign(new Gateway(), {runtimeOwner:{request:async method=>{requested.push(method);return {data:{books:[raw],total:1}};}}});
const shelf=await gateway.loadBookshelf();
assert.deepEqual(requested,['bookshelf.list'],'cold bookshelf names do not require a separate successful source.list');
assert.equal(shelf.books[0].sourceName,'持久名称');assert.equal(shelf.books[0].readProgress,4520);
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
sources=[{sourceId:'source-a',name:'新名称'}];await projection.hydrate(host.bookshelfProjectionBinding);
assert.equal(host.shelfBooks[0].sourceName,'新名称');
assert.equal(host.shelfBooks[0].readingPosition.bodyVersion,'b','source-name hydration preserves Core position proof');
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

const Sources=productionMotionMethods(file('features/source/SourceGateway.ts'),['loadSourcesForIds']);
let active=true;const calls=[];
const exact=Object.assign(new Sources(),{loadSources:async id=>{calls.push(id);return[{sourceId:id,name:id},{sourceId:'unexpected',name:'not admitted'}];}});
assert.deepEqual((await exact.loadSourcesForIds(['source-a','source-a','local','source-b'],()=>active)).map(s=>s.sourceId),['source-a','source-b']);
assert.deepEqual(calls,['source-a','source-b']);active=false;await exact.loadSourcesForIds(['source-c'],()=>active);assert.equal(calls.length,2);
console.log('shelf source fallback: exact unique identities only, cancellation and foreign-result rejection PASS');
