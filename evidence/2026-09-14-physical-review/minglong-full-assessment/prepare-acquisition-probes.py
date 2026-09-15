from pathlib import Path
root=Path('/Users/minliny/Documents/Reader/Reader-for-HarmonyOS')
s=(root/'tools/test-search-candidate-acquisition.mjs').read_text()
s=s.replace("from './lib/reader-motion-method-probe.mjs'",f"from '{root}/tools/lib/reader-motion-method-probe.mjs'")
s=s.replace("new URL('../entry/src/main/ets/',import.meta.url)",f"new URL('file://{root}/entry/src/main/ets/')")
s=s.replace("if(method==='chapter.content')return", "if(method==='chapter.content'&&modes.get(`body:${id}`) instanceof Error)throw modes.get(`body:${id}`);\n  if(method==='chapter.content')return")
extra=r'''
await check('AUDIT: fourth healthy candidate is never attempted after three empty TOCs',async()=>{
 const f=fixture();try{for(const id of ['s1','s2','s3'])f.modes.set(f.key(id,'/b9'),'empty');
 await assert.rejects(f.runtime.acquireCandidateGroup(['s1','s2','s3','s4'].map(s=>candidate(9,s))));
 assert.deepEqual(f.calls.filter(c=>c.method==='book.toc').map(c=>c.params.sourceId),['s1','s2','s3']);
 assert.equal(f.calls.some(c=>c.params.sourceId==='s4'),false);
 // The otherwise identical fourth source actually succeeds when explicitly tried.
 assert.equal((await f.runtime.acquireBook(seed(9,'s4'))).identity.sourceId,'s4');
 }finally{f.runtime.close()}
});
await check('AUDIT: production Index keeps failed body primary and does not try healthy same-book second source',async()=>{
 const f=fixture();try{
 f.modes.set(`body:${f.key('s1','/b9')}`,new RemoteReadingGatewayError('invalidResponse','controlled chapter rule failure','chapter.content'));
 const {page,errors}=indexFixture(f);page.onSearchResultSelected(book(9),[book(9),book(9,'s2')]);
 await until(()=>page.remoteContentVerdict==='parseFailed'||errors.length>0);
 assert.equal(page.remoteContentVerdict,'parseFailed');assert.equal(page.detailBook.sourceId,'s1');
 assert.equal(f.calls.some(c=>c.params.sourceId==='s2'),false);
 const healthy=await f.runtime.acquireBook(seed(9,'s2'));
 await new RemoteReadingFlowGateway(f.owner).loadChapter(healthy,0,()=>true);
 }finally{f.runtime.close()}
});
const {classifyChapterBody}=await import(path('features/reading/RemoteContentAdmission.ts'));
const {classifyRemoteReadingCommandFailure}=await import(path('features/reading/RemoteReadingContract.ts'));
const {acquisitionCandidateRank}=await import(path('features/common/BookAcquisitionPresentation.ts'));
await check('AUDIT: generic API error sentence and long text challenge are admitted readable',async()=>{
 assert.equal(classifyChapterBody('请求参数错误，请稍后重试').kind,'readable');
 assert.equal(classifyChapterBody('请先登录并完成人机验证。'+('安全检查说明。'.repeat(60))).kind,'readable');
});
await check('AUDIT exclusion: structured source parse error does preserve parse classification',async()=>{
 const error=classifyRemoteReadingCommandFailure('chapter.content',{message:'controlled rule failure',details:{category:'SOURCE_RULE_FAILED'}});
 assert.equal(remoteReadingFailureKindOf(error),'SOURCE_PARSE_FAILED');
});
await check('AUDIT: failed chapter leaves catalog candidate rank and is not a whole-book failure',async()=>{
 const at=Date.now();const facts={schemaVersion:2,sourceVersion:'v1',catalogAt:at-100,catalogCount:1,verificationCurrent:false,
 failureCurrent:true,failure:{schemaVersion:2,sourceVersion:'v1',stage:'failed',failureStage:'chapter',checkedAt:at}};
 assert.equal(acquisitionCandidateRank(facts,'v1',at),1);
});
'''
s=s.replace('console.log(JSON.stringify({evidenceLayer:',extra+'\nconsole.log(JSON.stringify({evidenceLayer:')
Path('/private/tmp/minglong-acquisition-audit.mjs').write_text(s)
