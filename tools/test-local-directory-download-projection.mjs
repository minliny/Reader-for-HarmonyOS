import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {LocalReadingFlowGateway}=await import('../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const calls=[],raw={sourceId:'local',bookId:'book',chapters:[{chapterIndex:1,state:'completed'}]};
const runtime={async request(method,params,options){calls.push({method,params,options});return{data:method==='cache.book.status'?raw:{bookmarks:[{
 bookName:'Book',bookAuthor:'Author',time:5,chapterIndex:1,chapterPos:3,chapterName:'One',content:'mark',bookText:'text'}]}};}};
const gateway=new LocalReadingFlowGateway(runtime),old=[{index:1,title:'One',level:2,navigable:true,downloadState:'unknown',bookmarks:undefined},
 {index:2,title:'Volume',navigable:false,downloadState:'unknown',bookmarks:[]}];
const current=()=>true;
const downloads=await gateway.loadDownloadProjection('book',old,current);
assert.equal(calls.length,1);assert.equal(calls[0].method,'cache.book.status');assert.equal(calls[0].params.includeGlobalStats,false);
assert.equal(downloads[0].downloadState,'completed');assert.equal(downloads[0].bookmarks,undefined);assert.equal(downloads[0].level,2);
assert.equal(downloads[1].navigable,false);assert.equal(downloads[1].downloadState,'unknown');assert.equal(old[0].downloadState,'unknown');
calls.length=0;const legacy=await gateway.loadDirectoryProjection('book','Book','Author',old,current);
assert.deepEqual(calls.map(c=>c.method).sort(),['bookmark.list','cache.book.status']);assert.equal(legacy[0].bookmarks.length,1);
assert.equal(legacy[0].bookmarks[0].chapterOffset,3);assert.equal(legacy[0].downloadState,'completed');assert.equal(legacy[0].level,2);
for(const bad of [{...raw,sourceId:'foreign'},{...raw,bookId:'foreign'},{...raw,chapters:{}},
 {...raw,chapters:[{chapterIndex:-1,state:'completed'}]},{...raw,chapters:[{chapterIndex:1,state:'unknown-state'}]}]){
 const reject=new LocalReadingFlowGateway({async request(){return{data:bad};}});await assert.rejects(reject.loadDownloadProjection('book',old,current));
}
console.log('PASS actual local download-only projection + legacy parallel bookmark combination + typed identity/state rejection');
