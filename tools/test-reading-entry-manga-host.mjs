import assert from 'node:assert/strict';
import { compileHost, read, readingEvidence } from './lib/reading-entry-owner-probe.mjs';
import { fixture, deferred, tick, until, seed, book, session } from './lib/reading-entry-index-fixture.mjs';
import { MangaBookPresentation } from '../entry/src/main/ets/features/manga/MangaBookPresentation.ts';
const checkpoints=[];
const mangaSession=(id='book',catalog='c1')=>({...session(id,'s1',catalog),contentKind:'manga'});
const mangaBook=(id='book')=>({...book(id),contentKind:'manga'});
function mangaFixture(Host){
 const f=fixture(Host),native=f.runtime.request.bind(f.runtime),supports=f.runtime.supportsCoreCapability.bind(f.runtime);
 const pages=[0,1].map(ordinal=>{const pageId=`mp1:${String(ordinal).padStart(64,'0')}`;return{ordinal,pageId,resourceRef:`manga:${pageId}`};});
 const control={gate:undefined,sourceVersion:'v1',badImage:false,cached:false,missingBytes:false};
 f.runtime.supportsCoreCapability=c=>c==='manga.chapter.v1'||supports(c);
 f.runtime.request=async(method,params,options)=>{
  if(method!=='manga.chapter.get')return native(method,params,options);
  f.calls.push({method,p:params,options});
  if(params.policy==='refresh')control.cached=false;
  return{data:{chapterIndex:params.chapterIndex,chapterTitle:`Chapter ${params.chapterIndex}`,cached:control.cached,
   manifest:{chapter:{sourceId:params.sourceId,bookId:params.bookId,chapterId:`https://source/${params.bookId}/${params.chapterIndex}`},
    manifestVersion:'manifest-1',sourceRuleVersion:control.sourceVersion,decodeRevision:'identity-v1',pages},
   resources:control.cached?[]:pages.map(page=>({resourceRef:page.resourceRef,request:{url:'https://synthetic.invalid/page.jpg'}}))}};
 };
 f.runtime.loadReadingImage=async(...args)=>{f.calls.push({method:'image.load',p:args});if(control.gate)await control.gate.promise;
  if(control.missingBytes && args[6]===false)throw Error('synthetic cached bytes absent');
  return{fileUri:'synthetic-image-receipt',revision:'image-1',width:control.badImage?0:600,height:800};};
 f.runtime.releaseReadingImage=(uri)=>f.calls.push({method:'image.release',p:uri});
 return{...f,manga:control};
}
const assertNoText=f=>assert.equal(f.calls.some(c=>['chapter.content','reading.entry.prepare','reading.progress.get'].includes(c.method)),false);
{
 const f=mangaFixture();f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);
 assert.equal(f.host.snapshot().verdict,'verifying');
 assert.equal(await f.host.probe(f.host.snapshot().scopeId),0);assert.equal(f.host.snapshot().verdict,'readable');
 assert.equal(f.host.snapshot().session.preparedChapter,undefined);assertNoText(f);
 assert.deepEqual(f.calls.filter(c=>c.method==='manga.chapter.get').map(c=>[c.p.chapterIndex,c.p.policy]),[[0,'cacheFirst']]);
 assert.equal(f.calls.filter(c=>c.method==='image.load').length,1);assert.equal(f.calls.filter(c=>c.method==='image.release').length,1);
 assert.equal(f.calls.find(c=>c.method==='image.load').p[10],'v1');f.close();checkpoints.push('actual-SDK-manga-manifest-first-image-release-readiness-without-text');
}
{
 const f=mangaFixture(),m=mangaSession();m.entries=[{...m.entries[0],navigable:false,url:''},{...m.entries[1],index:10}];
 f.host.bindReader(mangaBook(),m,[],false,f.lease);assert.equal(await f.host.probe(f.host.snapshot().scopeId),10);
 assert.equal(f.calls.find(c=>c.method==='manga.chapter.get').p.chapterIndex,10);assertNoText(f);f.close();
 checkpoints.push('group-leading-catalog-proves-real-nonzero-readable-canonical-index');
}
{
 const f=mangaFixture();const m=mangaSession(),text=session();
 const prepared=readingEvidence.withPreparedRemoteChapter(text,{sourceId:'s1',bookId:'book',chapterIndex:0,chapterUrl:text.entries[0].url,
  contentVersion:'body',content:'text',chapterTitle:'Chapter 0'},f.coordinator.readingProjectionRevision());
 f.host.bindReader(mangaBook(),{...m,preparedChapter:prepared.preparedChapter},[],false,f.lease);
 assert.equal(f.host.snapshot().session.preparedChapter,undefined);assert.equal(f.host.snapshot().verdict,'verifying');
 const row={origin:'s1',bookUrl:'book',contentKind:'manga',acquisition:{schemaVersion:2,verificationCurrent:true,sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1'}};
 f.host.acceptSession(m,f.coordinator.readingProjectionRevision(),row);assert.equal(f.host.snapshot().verdict,'verifying');
 await f.host.probe(f.host.snapshot().scopeId);assert.equal(f.host.snapshot().verdict,'readable');assertNoText(f);f.close();
 checkpoints.push('text-prepared-and-Core-text-verification-cannot-certify-manga');
}
{
 const f=mangaFixture();f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);
 assert.equal(await f.host.probe(f.host.snapshot().scopeId,2),undefined);assert.equal(f.host.snapshot().verdict,'contentUnavailable');assert.equal(f.calls.length,0);
 assert.equal(await f.host.probe(f.host.snapshot().scopeId,0),0);assertNoText(f);f.close();checkpoints.push('preferred-other-chapter-never-borrows-first-image-proof');
}
{
 const f=mangaFixture();f.manga.sourceVersion='other';f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);
 assert.equal(await f.host.probe(f.host.snapshot().scopeId),undefined);assert.notEqual(f.host.snapshot().verdict,'readable');
 assert.equal(f.calls.some(c=>c.method==='image.load'),false);assertNoText(f);f.close();checkpoints.push('version-mismatch-fails-before-image-admission');
}
{
 const f=mangaFixture();f.manga.badImage=true;f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);
 assert.equal(await f.host.probe(f.host.snapshot().scopeId),undefined);assert.notEqual(f.host.snapshot().verdict,'readable');
 assert.equal(f.calls.filter(c=>c.method==='image.release').length,1);assertNoText(f);f.close();checkpoints.push('invalid-native-image-geometry-releases-and-fails');
}
for(const retire of ['reopen','revision','retire']){
 const f=mangaFixture();f.manga.gate=deferred();f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);
 const work=f.host.probe(f.host.snapshot().scopeId);await until(()=>f.calls.some(c=>c.method==='image.load'));
 if(retire==='reopen')f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);
 if(retire==='revision')f.coordinator.projectionRevision++;
 if(retire==='retire')f.host.retire();
 const before=f.changes.length;f.manga.gate.resolve();assert.equal(await work,undefined);assert.equal(f.changes.length,before);
 assert.notEqual(f.host.snapshot().verdict,'readable');assert.equal(f.calls.filter(c=>c.method==='image.release').length,1);assertNoText(f);f.close();
 checkpoints.push(`late-manga-image-${retire}-rejects-old-owner-and-releases`);
}
{
 const f=mangaFixture();f.manga.cached=true;f.manga.missingBytes=true;f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);
 assert.equal(await f.host.probe(f.host.snapshot().scopeId),0);
 assert.deepEqual(f.calls.filter(c=>c.method==='manga.chapter.get').map(c=>c.p.policy),['cacheFirst','refresh']);
 assert.equal(f.calls.find(c=>c.method==='manga.chapter.get'&&c.p.policy==='refresh').p.expectedManifestVersion,'manifest-1');
 assert.equal(f.calls.filter(c=>c.method==='image.load').length,2);assertNoText(f);f.close();checkpoints.push('cached-expiring-descriptor-renews-once-via-existing-manga-gateway');
}
{
 const f=mangaFixture();const m=mangaSession();f.host.bindReader(mangaBook(),m,[],false,f.lease);await f.host.probe(f.host.snapshot().scopeId);
 f.rows.set(f.key('s1','book'),{origin:'s1',bookUrl:'book',name:'Renamed',contentKind:'manga',acquisition:{schemaVersion:2,
  verificationCurrent:true,sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1',catalogAt:1}});
 await f.host.refreshProjection();assert.equal(f.host.snapshot().book.title,'Renamed');assert.equal(f.host.snapshot().book.contentKind,'manga');
 assert.equal(f.host.snapshot().session.contentKind,'manga');assert.equal(f.host.snapshot().verdict,'readable');assertNoText(f);
 assert.equal(f.calls.filter(c=>c.method==='image.load').length,1,'metadata-only same-session projection preserves actual first-image proof');
 f.rows.get(f.key('s1','book')).contentKind='comic';await f.host.refreshProjection();assert.equal(f.host.snapshot().book.contentKind,'manga');
 assert.equal(f.host.snapshot().backgroundError,'Invalid cached book contentKind');f.close();checkpoints.push('typed-exact-cached-projection-retains-manga-and-rejects-unknown-kind');
}
{
 const f=mangaFixture(),m=mangaSession();MangaBookPresentation.useOwner(f.runtime);
 assert.equal(MangaBookPresentation.admitProgress('s1','book',{token:{epoch:1,revision:1},location:{kind:'manga',
  chapter:{sourceId:'s1',bookId:'book',chapterId:m.entries[0].url},manifestVersion:'manifest-1',pageId:`mp1:${'0'.repeat(64)}`,
  pageOrdinalFallback:4,progressRevision:1,x:0,y:0}}),true);
 await f.host.openRemote({seed:seed(),sourceName:'Source',shelfSnapshot:mangaBook(),validatedSession:m,resumeImmediately:true},f.lease);
 assert.equal(f.host.snapshot().seed.contentKind,'manga');assert.equal(f.host.snapshot().book.contentKind,'manga');assert.equal(f.host.snapshot().book.mangaPosition.pageOrdinal,4);
 assert.equal(f.calls.filter(c=>c.method==='manga.chapter.get').length,0);assertNoText(f);f.close();checkpoints.push('shelf-immediate-entry-carries-type-and-exact-owner-manga-position-without-detail-IO');
}
{
 const f=mangaFixture(),m=mangaSession();f.coordinator.acquireBookWithBackgroundRefresh=async seed=>{assert.equal(seed.contentKind,'manga');return{session:m};};
 await f.host.openRemote({seed:{...seed(),contentKind:'manga'},sourceName:'Source',retainAdmissionThroughProbe:true},f.lease);
 assert.equal(f.host.snapshot().book.contentKind,'manga');assert.equal(f.host.snapshot().verdict,'readable');assert.equal(f.host.snapshot().candidateAdmissionFailed,false);
 assert.equal(f.host.snapshot().candidateAdmissionActive,false);assertNoText(f);f.close();checkpoints.push('retained-manga-admission-success-does-not-mark-failed-void-text-probe');
}
{
 const f=mangaFixture();f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);
 f.rows.set(f.key('s1','book'),{origin:'s1',bookUrl:'book',name:'Updated',contentKind:'manga',acquisition:{schemaVersion:2,
  verificationCurrent:true,sourceVersion:'v1',catalogVersion:'c2',contextVersion:'x1',catalogAt:1}});
 await f.host.refreshProjection();assert.equal(f.host.snapshot().session.contentKind,'manga');assert.equal(f.host.snapshot().book.contentKind,'manga');
 assert.equal(f.host.snapshot().verdict,'readable');assert.equal(f.calls.filter(c=>c.method==='image.load').length,1);assertNoText(f);f.close();
 checkpoints.push('changed-catalog-opens-typed-cached-session-and-probes-image-not-body');
}
{
 const f=mangaFixture();f.host.prepareVisible([mangaBook(),book('local-book','local')],f.preparationContext);
 assert.equal(f.preparations.visibleSeeds.some(row=>row.bookId==='book'),false);await tick();assert.equal(f.calls.some(c=>c.method==='reading.entry.prepare'&&c.p.bookId==='book'),false);
 f.close();checkpoints.push('Host-visible-manga-filter-before-text-preparation');
}
// Exact production-method mutation controls: reverting the entry branch reaches
// the text guard; removing the post-image owner fence publishes into a reopen.
{
 const source=read('features/reading/ReadingEntryHost.ts');const unsafe=source.replace("if (session.contentKind === 'manga') {\n      this.setVerdict", "if (false) {\n      this.setVerdict");assert.notEqual(source,unsafe);
 const f=mangaFixture(compileHost(unsafe));f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);
 await f.host.probe(f.host.snapshot().scopeId);assert.notEqual(f.host.snapshot().verdict,'readable');assert.equal(f.calls.some(c=>c.method==='image.load'),false);
 f.close();checkpoints.push('negative-old-text-entry-path-cannot-pass-image-proof');
}
{
 const source=read('features/reading/ReadingEntryHost.ts');const unsafe=source.replace('if (!probeCurrent()) return undefined;\n        this.readableRevision = revision;', 'if (false) return undefined;\n        this.readableRevision = revision;');assert.notEqual(source,unsafe);
 for(const [Host,expected] of [[undefined,undefined],[compileHost(unsafe),0]]){
  const f=mangaFixture(Host);f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);
  const release=f.runtime.releaseReadingImage;
  // Actual admission releases its physical receipt before returning. Model
  // an owner turnover at that real host boundary, with no fake gateway.
  f.runtime.releaseReadingImage=uri=>{release(uri);f.host.bindReader(mangaBook(),mangaSession(),[],false,f.lease);};
  assert.equal(await f.host.probe(f.host.snapshot().scopeId),expected);
  assert.notEqual(f.host.snapshot().verdict,'readable','lease publication independently rejects stale scope');assertNoText(f);f.close();
 }
 checkpoints.push('negative-actual-image-release-owner-turnover-catches-missing-final-fence');
}

console.log(JSON.stringify({status:'PASS',checkpoints,scope:'Installed SDK emits actual ReadingEntryHost, ProjectionGateway, MangaSession/Resource/Admission methods; controlled native manifest and physical image host receipts only. No Native/HAP/VM or source bytes read.'}));
