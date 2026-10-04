import assert from 'node:assert/strict';
import { makeIndex } from './lib/reading-entry-sdk-consumer.mjs';
import { fixture, seed, book, session } from './lib/reading-entry-index-fixture.mjs';
import { read, readingEvidence } from './lib/reading-entry-owner-probe.mjs';
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');

const checks=[];
for (const mutated of [false, true]) {
  const source=read('pages/Index.ets');
  const broken=source.replace(/this\.readingContentKind = \(snapshot\.session\?\.contentKind[^;]+;/,
    "this.readingContentKind = 'text';");
  assert.notEqual(broken,source,'negative control removes actual kind propagation');
  const f=fixture(),x=makeIndex(f,{route:'bookshelf',indexSource:mutated?broken:source});
  x.idx.readingOriginRoute='bookshelf';
  x.idx.openRemoteBookDetail({...seed(),contentKind:'manga'},'Source',{...book(),contentKind:'manga'},true);
  assert.equal(x.idx.readingSessionActive,true);
  assert.equal(x.idx.detailBook.contentKind,'manga');
  assert.equal(x.idx.remoteReadingSeed.contentKind,'manga');
  assert.equal(x.idx.readingContentKind,mutated?'text':'manga');
  assert.equal(f.calls.some(c=>c.method==='chapter.content'),false,'shelf entry never invokes text body');
  f.close();
  checks.push(mutated?'negative-actual-Index-kind-loss-reproduces-text-route':'actual-Index-shelf-to-mounted-manga-kind-preserved');
}
{
  const f=fixture();
  f.rows.set(f.key('s1','book'),{origin:'s1',bookUrl:'book'});
  const gateway=new RemoteReadingFlowGateway(f.runtime);
  const cached=await gateway.openCachedCatalogSession({...seed(),contentKind:'manga'},()=>true);
  assert.equal(cached.contentKind,'manga','cache-first admission preserves typed identity');
  const before=f.calls.length;
  await assert.rejects(gateway.loadChapter(cached,0),e=>e.code==='nonTextChapter');
  assert.equal(f.calls.length,before,'manga is rejected before text transport dispatch');
  const text=session(),manga={...text,contentKind:'manga'};
  assert.equal(readingEvidence.sameRemoteSessionEvidence(text,manga),false);
  assert.equal(readingEvidence.canAppendRemoteReadingCatalog(text,manga),false);
  assert.equal(readingEvidence.preparedRemoteChapterMatches({session:manga,projectionRevision:0,
    chapter:{sourceId:'s1',bookId:'book',chapterIndex:0,chapterUrl:manga.entries[0].url,contentVersion:'v'}},manga,0,0),false);
  f.close();checks.push('actual-cached-session-text-dispatch-guard-and-cross-kind-evidence-isolation');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'actual SDK-emitted Index/Entry with production gateways and evidence; controlled Core/OS seams; no source bytes or device reads'}));
