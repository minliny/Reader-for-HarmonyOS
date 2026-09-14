import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context)}catch(error){
  if(specifier.startsWith('.')&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const base=new URL('../entry/src/main/ets/features/reading/',import.meta.url);
const {RemoteReadingFlowGateway}=await import(new URL('RemoteReadingFlowGateway.ts',base));
const {ReadingSessionFlowGateway}=await import(new URL('ReadingSessionFlowGateway.ts',base));
const {LocalReadingFlowGateway}=await import(new URL('LocalReadingFlowGateway.ts',base));
const {ReadingChapterWindow}=await import(new URL('ReadingChapterWindow.ts',base));
const {withPreparedRemoteChapter}=await import(new URL('RemoteReadingEvidence.ts',base));
const {decodeRemotePositionMigration,encodeRemotePositionContext}=await import(new URL('RemoteReadingPositionMigration.ts',base));
const session={identity:{sourceId:'source',bookId:'book'},sourceVersion:'v1',acquisitionMode:'online',
  catalogVersion:'toc',contextVersion:'variables',detailUrl:'/book',tocUrl:'/toc',book:{title:'书',author:'作者'},
  continuationVariables:[],hostRequirements:[],entries:[{index:0,title:'第一章',url:'/0',variables:[]}]};
const context=()=>({bodyVersion:'old-body',processingVersion:'old-processing',anchors:[{id:'requested',offset:10},{id:'restored',offset:30}]});
const progress=(sourceId='source')=>({sourceId,bookId:'book',chapterIndex:0,chapterOffset:15,chapterProgress:0.2,updatedAt:100,
  bodyVersion:'new-body',processingVersion:'new-processing',locationRevision:'location'});
const receipt=()=>({status:'committed',previousBodyVersion:'old-body',bodyVersion:'new-body',previousProcessingVersion:'old-processing',
  processingVersion:'new-processing',anchors:[{id:'requested',previousOffset:10,offset:15},{id:'restored',previousOffset:30,offset:35}],progress:progress()});
const response=migration=>({data:{sourceId:'source',bookId:'book',chapterTitle:'第一章',via:'rule',
  content:'清晨的阳光照进房间，故事从这里开始。'.repeat(40),bodyVersion:'new-body',processingVersion:'new-processing',positionMigration:migration}});
// Exact anchors are captured before awaits, forwarded for both cache reads and forced refreshes.
for(const force of [false,true]){
  let release;const gate=new Promise(r=>release=r);const calls=[];
  const gateway=new RemoteReadingFlowGateway({request:async(method,params)=>{calls.push({method,params});await gate;return response(receipt());}});
  const original=context();const pending=gateway.loadChapter(session,0,()=>true,force,original);
  original.anchors[0].offset=999;release();const chapter=await pending;
  assert.equal(calls.length,1);assert.deepEqual(calls[0].params.positionContext,context());
  assert.equal(calls[0].params.forceRefresh,force?true:undefined);assert.equal(chapter.positionMigration.anchors[0].offset,15);
  assert.equal(chapter.positionMigration.progress.bodyVersion,'new-body');
  const window=new ReadingChapterWindow();window.configure('source','book',[0]);window.setCurrent(chapter);
  const copy=window.get(0);assert.equal(copy.bodyVersion,'new-body');assert.equal(copy.processingVersion,'new-processing');
  copy.positionMigration.anchors[0].offset=888;copy.positionMigration.progress.chapterOffset=777;
  assert.equal(window.get(0).positionMigration.anchors[0].offset,15);assert.equal(window.get(0).positionMigration.progress.chapterOffset,15);
}
// A prepared body may serve an ordinary read, but position context always reaches Core validation.
{
  const cached={sourceId:'source',bookId:'book',chapterIndex:0,chapterTitle:'第一章',chapterUrl:'/0',content:'正文',images:[],
    bodyVersion:'old-body',processingVersion:'old-processing',contentVersion:'host',extractionVia:'rule'};
  const prepared=withPreparedRemoteChapter(session,cached,0);const calls=[];
  const gateway=new ReadingSessionFlowGateway('source','book',{kind:'remote',session:prepared},{request:async(method,params)=>{calls.push({method,params});return response(receipt());}});
  const chapter=await gateway.loadChapter('book',0,()=>true,false,context());
  assert.equal(calls.length,1);assert.equal(calls[0].method,'chapter.content');assert.equal(chapter.bodyVersion,'new-body');
  assert.equal((await gateway.loadChapter('book',0,()=>true)).bodyVersion,'new-body');
  assert.equal(calls.length,2,'a validated newer body retires the older prepared handoff');
}
// Context refresh recursion retains the exact anchor receipt contract.
{
  let params;
  const gateway=new RemoteReadingFlowGateway({request:async(_method,p)=>{params=p;return response(receipt());}});
  gateway.openSession=async()=>({...session,requiresContextRefresh:false});
  await gateway.loadChapter({...session,requiresContextRefresh:true},0,()=>true,true,context());
  assert.deepEqual(params.positionContext,context());assert.equal(params.forceRefresh,true);
}
// Malformed/unscoped receipts cannot pair a new body with old offsets.
for(const mutate of [r=>{r.status='unknown'},r=>{r.bodyVersion='another'},r=>{r.previousProcessingVersion='different'},
  r=>{r.anchors.pop()},r=>{r.anchors[0].previousOffset=99},r=>{r.anchors[0].offset=-1},r=>{r.anchors[1].id='requested'},
  r=>{r.status='preserved'},r=>{r.progress.sourceId='another'}]){
  const value=receipt();mutate(value);
  assert.throws(()=>decodeRemotePositionMigration(value,'source','book','new-body','new-processing',context()));
}
assert.throws(()=>decodeRemotePositionMigration(undefined,'source','book','new-body','new-processing',context()),/without a migration/);
assert.equal(decodeRemotePositionMigration(undefined,'source','book','old-body','old-processing',context()),undefined);
const preserved={...receipt(),status:'preserved',reason:'anchor_ambiguous',bodyVersion:'old-body',processingVersion:'old-processing',
  anchors:context().anchors.map(a=>({id:a.id,previousOffset:a.offset,offset:a.offset})),progress:undefined};
assert.equal(decodeRemotePositionMigration(preserved,'source','book','old-body','old-processing',context()).status,'preserved');
assert.throws(()=>encodeRemotePositionContext({...context(),anchors:[{id:'requested',offset:1},{id:'requested',offset:2}]}),/duplicate/);
// Progress and bookmarks retain scope. Persisted writes include expected versions and reject mismatched receipts.
for(const sourceId of ['source','local']){
  const calls=[];let wrong=false;
  const runtime={request:async(method,params)=>{calls.push({method,params});return {data:method==='reading.progress.get'
    ?{found:true,progress:progress(sourceId)}:{stored:true,...progress(sourceId),bodyVersion:wrong?'wrong':'new-body'}};}};
  const gateway=sourceId==='local'?new LocalReadingFlowGateway(runtime):new RemoteReadingFlowGateway(runtime);
  const identity=sourceId==='local'?'book':{sourceId,bookId:'book'};
  assert.equal((await gateway.loadProgress(identity)).progress.processingVersion,'new-processing');
  const update={chapterIndex:0,chapterOffset:15,chapterProgress:0.2,expectedBodyVersion:'new-body',expectedProcessingVersion:'new-processing'};
  await gateway.updateProgress(identity,update);assert.equal(calls.at(-1).params.expectedBodyVersion,'new-body');
  wrong=true;await assert.rejects(gateway.updateProgress(identity,update),/different current progress row/);
}
{
  const calls=[];const runtime={request:async(method,params)=>{calls.push({method,params});return {data:{stored:true,...progress()}};}};
  const gateway=new ReadingSessionFlowGateway('source','book',{kind:'remote',session},runtime);
  const restored=await gateway.resolveAndUpdateProgress('book','第一章',{chapterIndex:0,chapterOffset:15,chapterProgress:0.2,
    bodyVersion:'new-body',processingVersion:'new-processing'},{viewportWidth:300,viewportHeight:600,fontScale:1});
  assert.equal(calls[0].params.expectedProcessingVersion,'new-processing');assert.equal(restored.bodyVersion,'new-body');
}
{
  const scope={sourceId:'source',bookId:'book',chapterIndex:0,bodyVersion:'body',processingVersion:'processing'};
  const raw={time:42,bookName:'书',bookAuthor:'作者',chapterIndex:0,chapterPos:10,chapterName:'第一章',content:'',bookText:'原文',positionScope:scope};
  const calls=[];const gateway=new LocalReadingFlowGateway({request:async(method,params)=>{calls.push({method,params});return {data:method==='bookmark.list'?{bookmarks:[raw]}:{bookmark:raw}};}});
  const bookmark=await gateway.createPositionBookmark({bookName:'书',bookAuthor:'作者',chapterIndex:0,chapterOffset:10,chapterTitle:'第一章',bookText:'原文',positionScope:scope});
  assert.deepEqual(bookmark.positionScope,scope);assert.deepEqual(calls[0].params.positionScope,scope);
  const toc=await gateway.loadBookmarkProjection('书','作者',[{index:0,title:'第一章',downloadState:'cached'}]);
  assert.deepEqual(toc[0].bookmarks[0].positionScope,scope);
}
console.log('PH75 Host: captured anchor context, forced/cache validation, typed receipt rejection, prepared bypass prevention, window ownership, scoped progress/bookmarks PASS');

// A new directory chapter-start bookmark gets zero's proof from a Core cache
// read, never by relabelling an old bookmark offset with the current body.
{
  const input={bookName:'书',bookAuthor:'作者',chapterIndex:0,chapterTitle:'第一章'};
  const identity={sourceId:'source',bookId:'book'};
  const scope={...identity,chapterIndex:0,bodyVersion:'cached-body',processingVersion:'cached-processing'};
  function fixture(mode='cached'){
    const calls=[];let current=true;
    const gateway=new LocalReadingFlowGateway({request:async(method,params)=>{
      calls.push({method,params});
      if(method==='cache.book.status'){
        if(mode==='cancel-after-status')current=false;
        return{data:{...identity,chapters:[{chapterIndex:0,state:mode==='missing'?'missing':mode==='failed-with-body'?'failed':'cached',
          cachedBytes:mode==='missing'?0:40}]}};
      }
      if(method==='chapter.content'){
        assert.deepEqual(params,{...identity,chapterIndex:0},'cache proof cannot provide a URL, request, JS, response, forced refresh or inferred anchor');
        if(mode==='cache-race')throw new Error('cached body disappeared');
        if(mode==='processing-stale')throw new Error('PROCESSING_CONTEXT_STALE');
        if(mode==='cancel-after-body')current=false;
        return{data:{...identity,sourceId:mode==='wrong-identity'?'another':'source',via:mode==='unexpected-network'?'rule':'cache',
          content:'目录章首正文',bodyVersion:'cached-body',processingVersion:mode==='missing-version'?undefined:'cached-processing'}};
      }
      assert.equal(method,'bookmark.create');
      assert.equal(params.chapterPos,0);
      if(mode==='cas-failure')throw new Error('POSITION_CONTEXT_STALE');
      return{data:{bookmark:{time:42,...params,content:'',positionScope:params.positionScope}}};
    }});
    return{gateway,calls,isCurrent:()=>current};
  }
  for(const mode of ['cached','failed-with-body']){
    const f=fixture(mode);const result=await f.gateway.createChapterStartBookmark(input,f.isCurrent,identity);
    assert.deepEqual(result.positionScope,scope);assert.deepEqual(f.calls.at(-1).params.positionScope,scope);
    assert.deepEqual(f.calls.map(c=>c.method),['cache.book.status','chapter.content','bookmark.create']);
    assert.equal(f.calls[0].params.includeGlobalStats,false);
  }
  const missing=fixture('missing');const result=await missing.gateway.createChapterStartBookmark(input,missing.isCurrent,identity);
  assert.equal(result.positionScope,undefined);assert.equal(missing.calls.at(-1).params.positionScope,undefined);
  assert.deepEqual(missing.calls.map(c=>c.method),['cache.book.status','bookmark.create']);
  for(const mode of ['wrong-identity','unexpected-network','missing-version','cache-race','processing-stale','cancel-after-status','cancel-after-body']){
    const f=fixture(mode);await assert.rejects(f.gateway.createChapterStartBookmark(input,f.isCurrent,identity));
    assert.equal(f.calls.filter(c=>c.method==='bookmark.create').length,0,`${mode} cannot reach write`);
  }
  const raced=fixture('cas-failure');await assert.rejects(raced.gateway.createChapterStartBookmark(input,raced.isCurrent,identity),/POSITION_CONTEXT_STALE/);
  assert.equal(raced.calls.filter(c=>c.method==='bookmark.create').length,1,'do not replay a failed or uncertain write');
  const supplied=fixture();await supplied.gateway.createChapterStartBookmark({...input,positionScope:scope},supplied.isCurrent,identity);
  assert.deepEqual(supplied.calls.map(c=>c.method),['bookmark.create'],'supplied exact current-page proof needs no cache lookup');
  const mismatched=fixture();await assert.rejects(mismatched.gateway.createChapterStartBookmark({...input,positionScope:scope},mismatched.isCurrent,
    {...identity,bookId:'different'}),/identity mismatch/);assert.equal(mismatched.calls.length,0);
  const legacy=fixture();await legacy.gateway.createChapterStartBookmark(input,legacy.isCurrent,{sourceId:'local',bookId:'local-book'});
  assert.deepEqual(legacy.calls.map(c=>c.method),['bookmark.create'],'local bookmark semantics remain unchanged');
  const old={time:99,...input,chapterName:'第一章',chapterPos:23,bookText:'旧文本',content:'保留备注'};
  const reading=new LocalReadingFlowGateway({request:async method=>{assert.equal(method,'bookmark.list');return{data:{bookmarks:[old]}};}});
  const list=await reading.loadBookmarkProjection('书','作者',[{index:0,title:'第一章',downloadState:'cached'}]);
  assert.equal(list[0].bookmarks[0].positionScope,undefined,'read projection never launders unproven old offsets');
  assert.equal(list[0].bookmarks[0].chapterOffset,23);assert.equal(list[0].bookmarks[0].content,'保留备注');
}
console.log('PH75 directory chapter-start proof: exact cache read, source/index binding, cancellation/CAS failure preservation, no fetch inputs, unscoped stored offsets untouched PASS');
