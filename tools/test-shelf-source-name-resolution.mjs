import assert from 'node:assert/strict';
import {actualProjectionTypes,actualProjectionIndex} from './lib/bookshelf-projection-owner-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts';
import { classifyReaderSource } from '../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts';
const file = name => new URL(`../entry/src/main/ets/${name}`, import.meta.url);
const unavailable = '书源名称暂不可用', removed = '书源已移除';
const sourceA = name => ({ sourceId: 'source-a', name });
const book = sourceName => ({ sourceId: 'source-a', bookId: 'book-a', sourceName,
  title: 'Controlled fixture', author: 'A', addedAt: 1, sortIndex: 3, readProgress: 4520, currentChapterIndex: 4 });
const tick = () => new Promise(resolve => setImmediate(resolve));
const pending = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const results = [];
async function check(name, fn) { try { await fn(); results.push({name,status:'PASS'}); }
  catch (e) { results.push({name,status:'FAIL',message:e.message}); } }
function fixture(initial = []) {
  const requests=[];
  const runtime=()=>({setReadingPreparationContext(){},async request(method,params) {
    assert.equal(method,'source.list','metadata uses the existing SourceGateway');
    const request=pending();requests.push({...request,params,resolve:sources=>request.resolve({data:{sources:sources.map(source=>({...source,baseUrl:'https://fixture.test',enabled:true,enabledExplore:false}))}})});
    return request.promise;
  }});
  let currentRuntime=runtime();const types=actualProjectionTypes(()=>currentRuntime);
  let index=actualProjectionIndex(currentRuntime,types,{initial:{kind:initial.length?'populated':'empty',shelf:{books:initial,total:initial.length}}});
  const apply=books=>index.index.applyBookshelfState({kind:books.length?'populated':'empty',shelf:{books,total:books.length},continueReading:undefined});
  return {get host(){return index.index;},get read(){return index.read;},get reading(){return index.reading;},
    get sources(){return index.sources;},get owner(){return index.owner;},requests,apply,
    hydrate:()=>index.owner.hydrate(index.read.binding),
    invalidate:()=>index.index.invalidateBookshelfProjection(),
    changeOwner:()=>{const books=index.read.snapshot.books;currentRuntime=runtime();index=actualProjectionIndex(currentRuntime,types,
      {initial:{kind:books.length?'populated':'empty',shelf:{books,total:books.length}}});}};

}
await check('missing/invalid name is unknown, not evidence of source removal', () => {
  for (const name of [undefined, '', 'source-a', 'https://example.test', 'www.example.test'])
    assert.equal(ShelfBookPresentation.source(book(name)), unavailable);
  assert.equal(ShelfBookPresentation.source(book(removed)), removed, 'explicit Core absence survives');
  assert.equal(ShelfBookPresentation.source(book('真实名称')), '真实名称');
});
await check('unready in-memory registries preserve caller supplied persisted identity label', () => {
  const f=fixture(),{host}=f;
  assert.equal(host.sourceDisplayName('source-a'), unavailable);
  assert.equal(host.sourceDisplayName('source-a', '持久名称'), '持久名称');
  f.sources.registry = [sourceA('旧注册名称')];
  assert.equal(host.sourceDisplayName('source-a', removed), removed);
  assert.equal(f.reading.detailForShelf(book('持久名称'),host.sourceDisplayName('source-a','持久名称')).sourceName, '持久名称');
});
await check('temporary unknown Core name cannot erase cached exact-source name or progress', async () => {
  const f = fixture([book('缓存名称')]);
  f.apply([book(unavailable)]); f.requests[0].reject(Error('temporary list failure')); await tick();
  assert.equal(f.read.snapshot.books[0].sourceName, '缓存名称');
  assert.equal(f.read.snapshot.books[0].readProgress,4520); assert.equal(f.read.snapshot.books[0].currentChapterIndex,4);
  assert.equal(f.read.snapshot.books[0].sourceId,'source-a'); assert.equal(f.read.snapshot.books[0].bookId,'book-a');
});
await check('successful but unmatched/filtered source list does not prove deletion', async () => {
  const Gateway = productionMotionMethods(file('features/source/application/SourceGateway.ts'), ['loadSources','optionalString'], {classifyReaderSource});
  const gateway = Object.assign(new Gateway(), {runtimeOwner:{request:async()=>({data:{sources:[{sourceId:'source-a',enabled:true}]}})}});
  await assert.rejects(gateway.loadSources(), /without its identity or name/, 'malformed source payload is a read failure, never deletion proof');
  gateway.runtimeOwner.request = async () => ({data:{sources:[{sourceId:'source-b',name:'other source',baseUrl:'https://b.example',enabled:true,enabledExplore:true}]}});
  const partial = await gateway.loadSources(); assert.equal(partial[0].sourceId, 'source-b');
  const f = fixture([book('Core持久名称')]); f.hydrate(); f.requests[0].resolve(partial); await tick();
  assert.equal(f.read.snapshot.books[0].sourceName, 'Core持久名称');
  const fresh=fixture([book(undefined)]);fresh.requests[0].resolve([]);await tick();
  assert.equal(ShelfBookPresentation.source(fresh.read.snapshot.books[0]), unavailable,'fresh canonical row without any name stays unknown');
});
await check('late old hydration cannot overwrite newer successful name', async () => {
  const f = fixture([book('旧名称')]);
  f.hydrate(); f.hydrate();
  f.requests[1].resolve([sourceA('最新名称')]); await tick();
  f.requests[0].resolve([sourceA('过期名称')]); await tick();
  assert.equal(f.read.snapshot.books[0].sourceName, '最新名称');
});
await check('Core deletion admitted while name lookup is pending is never resurrected', async () => {
  const f = fixture([book('有效名称')]); f.hydrate();
  f.apply([book(removed)]);
  f.requests[0].resolve([sourceA('过期列表名称')]); await tick();
  assert.equal(f.requests.length,1,'confirmed deletion needs no registry lookup');
  assert.equal(f.read.snapshot.books[0].sourceName, removed);
  // Reimport is admitted through a fresh Core shelf result, not by guessing.
  f.apply([book('重新导入名称')]); await tick();
  assert.equal(f.requests.length,1,'fresh Core name needs no registry lookup');
  assert.equal(f.read.snapshot.books[0].sourceName, '重新导入名称');
});
await check('runtime/route-generation changes reject old results without borrowing another identity', async () => {
  const f = fixture([book('有效名称')]); f.hydrate(); f.changeOwner();
  f.requests[0].resolve([sourceA('旧Owner名称')]); await tick();
  assert.equal(f.read.snapshot.books[0].sourceName,'有效名称');
  f.hydrate(); f.invalidate();
  f.requests[1].resolve([sourceA('旧页名称')]); await tick();
  assert.equal(f.read.snapshot.books[0].sourceName,'有效名称');
  f.apply([{...book(undefined),sourceId:'source-b'}]);
  f.requests[2].resolve([sourceA('另一个同书ID名称')]); await tick();
  assert.equal(ShelfBookPresentation.source(f.read.snapshot.books[0]),unavailable);
});
await check('source-name-only change invalidates the actual mounted row key while identity stays exact', () => {
  const Page = productionMotionMethods(file('features/bookshelf/ui/BookshelfPage.ets'), ['bookRowRenderKey']);
  const page = new Page(); const first = Object.freeze(book(unavailable)), renamed = Object.freeze(book('真实源'));
  assert.notEqual(page.bookRowRenderKey([first],0),page.bookRowRenderKey([renamed],0));
  assert.equal(page.bookRowRenderKey([renamed],0),page.bookRowRenderKey([renamed],0));
  assert.equal(first.sourceId,renamed.sourceId); assert.equal(first.bookId,renamed.bookId);
});
for (const result of results) console.log(JSON.stringify(result));
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
else console.log(`PH45 source name projection and actual Host hydration regressions PASS (${results.length} groups); no device identity is inferred.`);
