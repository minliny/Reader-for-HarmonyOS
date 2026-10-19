import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function resume(sourceId){
const {fixture,seed,book,until}=await import('./lib/reading-entry-index-fixture.mjs');
const {makeIndex}=await import('./lib/reading-entry-sdk-consumer.mjs');
  const f = fixture(), x = makeIndex(f, { route: 'bookshelf' });try{
  x.idx.readingOriginRoute = 'bookshelf';
  if (sourceId === 'local') x.idx.openLocalBookDetail(book('book', sourceId), true);
  else x.idx.openRemoteBookDetail(seed(), 'Source', book(), true);
  assert.equal(x.idx.route, 'reading'); assert.equal(x.idx.readingSessionActive, true);
  assert.equal(x.idx.detailBook.sourceId, sourceId);
  assert.equal(f.calls.filter(c => c.method !== 'intent').length, 0);
  }finally{f.close();}

}
async function preview(){
const {fixture,seed,book,until}=await import('./lib/reading-entry-index-fixture.mjs');
const {makeIndex}=await import('./lib/reading-entry-sdk-consumer.mjs');

  const f = fixture(), x = makeIndex(f);try{ x.idx.openRemoteBookDetail(seed(), 's1');
  assert.equal(x.idx.route, 'detail'); assert.equal(x.idx.detailLoadingMessage, '正在获取在线目录…');
  await until(() => x.idx.remoteContentVerdict === 'readable'); await f.settle();
  const child = x.render(); assert.equal(child.readingEnabled, true); assert.equal(child.book.sourceName, 'Named Source');
  assert.equal(child.toc.length, 3); assert.equal(f.calls.filter(c => c.method === 'bookmark.list').length, 1);
  assert.equal(f.calls.some(c => /bookshelf\.(?:upsert|add|remove)/.test(c.method)), false);
  const before = f.calls.length; child.onContinue(); assert.equal(x.idx.route, 'reading');
  assert.equal(f.calls.length, before); }finally{f.close();}

}
async function reopen(sourceId){
 const {fixture,book}=await import('./lib/reading-entry-index-fixture.mjs');const {makeIndex}=await import('./lib/reading-entry-sdk-consumer.mjs');const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const Reopen=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),['reopenSwitchedBook'],{LOCAL_SOURCE_ID:'local'});
 const f=fixture(),x=makeIndex(f,{route:'bookshelf'}),context={origin:'retained-reader'},calls=[];try{
  Object.assign(x.idx,{readingOriginRoute:'bookshelf',detailReturnRoute:'bookshelf',captureReaderReturnContext:()=>context,restoreReaderReturnContext:value=>calls.push(['restore',value]),invalidateDownloadMembershipForBook:value=>calls.push(['invalidate',value]),sourceDisplayName:()=> 'Named Source'});
  const committed=book('book',sourceId);Reopen.prototype.reopenSwitchedBook.call(x.idx,committed);
  assert.equal(x.idx.route,'reading');assert.equal(x.idx.readingSessionActive,true);assert.equal(x.idx.detailBook.sourceId,sourceId);assert.equal(x.idx.detailBook.bookId,committed.bookId);assert.equal(f.calls.filter(c=>c.method!=='intent').length,0);assert.deepEqual(calls,[['invalidate',committed],['restore',context]]);
 }finally{f.close();}
}
const cases={'resume-local':()=>resume('local'),'resume-remote':()=>resume('s1'),preview,'reopen-local':()=>reopen('local'),'reopen-remote':()=>reopen('s1')};
for(const id of selectContractCases({'resume-local':'Actual local shelf mount before IO','resume-remote':'Actual remote shelf mount before IO',preview:'Actual remote preview without shelf mutation','reopen-local':'Actual committed local source re-admission','reopen-remote':'Actual committed remote source re-admission'})){await cases[id]();recordContractCasePass(id);}
