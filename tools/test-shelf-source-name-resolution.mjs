import assert from 'node:assert/strict';
import { SearchPublication } from '../entry/src/main/ets/features/search/SearchPublication.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/ShelfBookPresentation.ts';
import { classifyReaderSource } from '../entry/src/main/ets/features/source/ReaderSourceCategory.ts';
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
  const requests = []; let owner = { setReadingPreparationContext() {} };
  const Host = productionMotionMethods(file('pages/Index.ets'),
    ['applyBookshelfState','sourceDisplayName','hydrateShelfSourceNames','copyShelfBookWithSourceName','readingDetailForShelf'], {
      LOCAL_SOURCE_ID: 'local', ReaderRuntimeOwner: { current: () => owner },
      SourceGateway: class { loadSourcesForIds() { const request = pending(); requests.push(request); return request.promise; } },
    });
  const host = Object.assign(new Host(), { searchPublication:new SearchPublication(),searchPublicationRevision:0,shelfBooks: initial, bookshelfLoadGeneration: 1, bookshelfSourceNameRequest: 0,
    searchSources: [], sourceSources: [], sourceToolsSnapshot: {sources: []}, scheduleBookshelfBackgroundRefresh() {} });
  return {host, requests, changeOwner: () => { owner = { setReadingPreparationContext() {} }; }, apply: books => host.applyBookshelfState({kind:'populated',shelf:{books,total:books.length},continueReading:undefined})};
}
await check('missing/invalid name is unknown, not evidence of source removal', () => {
  for (const name of [undefined, '', 'source-a', 'https://example.test', 'www.example.test'])
    assert.equal(ShelfBookPresentation.source(book(name)), unavailable);
  assert.equal(ShelfBookPresentation.source(book(removed)), removed, 'explicit Core absence survives');
  assert.equal(ShelfBookPresentation.source(book('真实名称')), '真实名称');
});
await check('unready in-memory registries preserve caller supplied persisted identity label', () => {
  const {host} = fixture();
  assert.equal(host.sourceDisplayName('source-a'), unavailable);
  assert.equal(host.sourceDisplayName('source-a', '持久名称'), '持久名称');
  host.sourceSources = [sourceA('旧注册名称')];
  assert.equal(host.sourceDisplayName('source-a', removed), removed);
  assert.equal(host.readingDetailForShelf(book('持久名称')).sourceName, '持久名称');
});
await check('temporary unknown Core name cannot erase cached exact-source name or progress', async () => {
  const f = fixture([book('缓存名称')]);
  f.apply([book(unavailable)]); f.requests[0].reject(Error('temporary list failure')); await tick();
  assert.equal(f.host.shelfBooks[0].sourceName, '缓存名称');
  assert.equal(f.host.shelfBooks[0].readProgress,4520); assert.equal(f.host.shelfBooks[0].currentChapterIndex,4);
  assert.equal(f.host.shelfBooks[0].sourceId,'source-a'); assert.equal(f.host.shelfBooks[0].bookId,'book-a');
});
await check('successful but unmatched/filtered source list does not prove deletion', async () => {
  const Gateway = productionMotionMethods(file('features/source/SourceGateway.ts'), ['loadSources','optionalString'], {classifyReaderSource});
  const gateway = Object.assign(new Gateway(), {runtimeOwner:{request:async()=>({data:{sources:[{sourceId:'source-a',enabled:true}]}})}});
  const partial = await gateway.loadSources(); assert.deepEqual(partial, []);
  const f = fixture([book('Core持久名称')]); f.host.hydrateShelfSourceNames(1); f.requests[0].resolve(partial); await tick();
  assert.equal(f.host.shelfBooks[0].sourceName, 'Core持久名称');
  f.host.shelfBooks=[book(undefined)]; f.host.hydrateShelfSourceNames(1); f.requests[1].resolve([]); await tick();
  assert.equal(ShelfBookPresentation.source(f.host.shelfBooks[0]), unavailable);
});
await check('late old hydration cannot overwrite newer successful name', async () => {
  const f = fixture([book('旧名称')]);
  f.host.hydrateShelfSourceNames(1); f.host.hydrateShelfSourceNames(1);
  f.requests[1].resolve([sourceA('最新名称')]); await tick();
  f.requests[0].resolve([sourceA('过期名称')]); await tick();
  assert.equal(f.host.shelfBooks[0].sourceName, '最新名称');
});
await check('Core deletion admitted while name lookup is pending is never resurrected', async () => {
  const f = fixture([book('有效名称')]); f.host.hydrateShelfSourceNames(1);
  f.apply([book(removed)]);
  f.requests[0].resolve([sourceA('过期列表名称')]); await tick();
  assert.equal(f.requests.length,1,'confirmed deletion needs no registry lookup');
  assert.equal(f.host.shelfBooks[0].sourceName, removed);
  // Reimport is admitted through a fresh Core shelf result, not by guessing.
  f.apply([book('重新导入名称')]); await tick();
  assert.equal(f.requests.length,1,'fresh Core name needs no registry lookup');
  assert.equal(f.host.shelfBooks[0].sourceName, '重新导入名称');
});
await check('runtime/route-generation changes reject old results without borrowing another identity', async () => {
  const f = fixture([book('有效名称')]); f.host.hydrateShelfSourceNames(1); f.changeOwner();
  f.requests[0].resolve([sourceA('旧Owner名称')]); await tick();
  assert.equal(f.host.shelfBooks[0].sourceName,'有效名称');
  f.host.hydrateShelfSourceNames(1); f.host.bookshelfLoadGeneration++;
  f.requests[1].resolve([sourceA('旧页名称')]); await tick();
  assert.equal(f.host.shelfBooks[0].sourceName,'有效名称');
  f.host.shelfBooks=[{...book(undefined),sourceId:'source-b'}]; f.host.hydrateShelfSourceNames(2);
  f.requests[2].resolve([sourceA('另一个同书ID名称')]); await tick();
  assert.equal(ShelfBookPresentation.source(f.host.shelfBooks[0]),unavailable);
});
await check('source-name-only change invalidates the actual mounted row key while identity stays exact', () => {
  const Page = productionMotionMethods(file('features/bookshelf/BookshelfPage.ets'), ['bookRowRenderKey']);
  const page = new Page(); const first = Object.freeze(book(unavailable)), renamed = Object.freeze(book('真实源'));
  assert.notEqual(page.bookRowRenderKey([first],0),page.bookRowRenderKey([renamed],0));
  assert.equal(page.bookRowRenderKey([renamed],0),page.bookRowRenderKey([renamed],0));
  assert.equal(first.sourceId,renamed.sourceId); assert.equal(first.bookId,renamed.bookId);
});
for (const result of results) console.log(JSON.stringify(result));
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
else console.log(`PH45 source name projection and actual Host hydration regressions PASS (${results.length} groups); no device identity is inferred.`);
