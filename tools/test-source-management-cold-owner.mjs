import assert from 'node:assert/strict';
import {fixture} from './lib/source-management-durable-probe.mjs';
const document=JSON.stringify({bookSourceUrl:'https://cold-source.test',bookSourceName:'Cold Source',enabled:true});
let count=0;
for (const commit of ['beforeMethod','afterMethod']) {
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);
 f.options[commit]='rules.mutation.apply';await assert.rejects(f.source.updateSource('https://cold-source.test',{enabled:false},f.current));
 const original=JSON.parse(f.disk());f.retire();const c=await fixture(f);
 let live=true,projection;let host=new c.SourceHost(()=>{},()=>live,()=>{},()=>c.runtime,p=>projection=p);
 assert.equal(host.bindPresentation(c.runtime,'old',()=>live),true);host.open('old');
 const owner=c.SourceOrchestrator.forRuntime(c.runtime);await owner.operationChain;
 assert.equal(projection.original.blocked,true);assert.equal(c.writes().length,0);
 const firstGeneration=projection.original.generation;
 let retained;
 const second=new c.SourceHost(()=>{},()=>live,()=>{},()=>c.runtime,p=>{
  if(second.isPresentationCurrent(c.runtime,'new'))retained=p;
 });
 assert.equal(second.bindPresentation(c.runtime,'new',()=>live),true);
 assert.equal(retained.original.operationId,projection.original.operationId,'synchronous accepted first DTO already has real Host binding');
 host.detachPresentation('old');
 // Use the successor physical Host; the original cannot borrow its ID.
 host.continueOriginal(firstGeneration,'new');await owner.operationChain;assert.equal(c.writes().length,0);
 host=second;
 host.continueOriginal(firstGeneration,'old');await owner.operationChain;assert.equal(c.writes().length,0,'retired physical identity cannot continue');
 host.toggleSource('https://cold-source.test',true,'new');await owner.operationChain;assert.equal(c.writes().length,0,'new page cannot replace an unknown original');
 host.continueOriginal(firstGeneration,'new');await owner.operationChain;
 assert.equal(retained.original.blocked,false);assert.equal(projection.original.blocked,true,'retired view keeps its original pending projection');assert.equal(c.disk(),'');
 assert.equal(c.writes().length,commit==='beforeMethod'?1:0);
 if(c.writes().length)assert.equal(c.writes()[0].params.operationId,original.operationId);
 assert.deepEqual(c.cleanupCalls,['https://cold-source.test']);live=false;host.open('new');count++;
}
for (const commit of ['beforeMethod','afterMethod']) {
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);
 f.options[commit]='rules.mutation.apply';await assert.rejects(f.source.deleteSources(['https://cold-source.test']));
 f.retire();const c=await fixture(f);let snapshot;
 const tools=c.SourceToolsOrchestrator.forRuntime(c.runtime);tools.attachPresentation('tools',s=>snapshot=s,()=>true);tools.open([]);await tools.operationTail;
 assert.equal(snapshot.original.blocked,true);assert.equal(c.writes().length,0);assert.equal(snapshot.sources.length,commit==='beforeMethod'?1:0,JSON.stringify({snapshot,calls:c.calls.map(x=>({method:x.method,params:x.params}))}));
 tools.deleteSelected(['https://cold-source.test']);await tools.operationTail;assert.equal(c.writes().length,0);
 tools.continueOriginal(snapshot.original.generation);await tools.operationTail;
 assert.equal(snapshot.original.blocked,false);assert.equal(c.disk(),'');assert.equal(c.writes().length,commit==='beforeMethod'?1:0);count++;
}
{
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);
 await f.source.importBookSourceDocument(JSON.stringify({bookSourceUrl:'https://second.test',bookSourceName:'Second',enabled:true}),f.current);
 let snapshot;const tools=f.SourceToolsOrchestrator.forRuntime(f.runtime);tools.attachPresentation('batch',s=>snapshot=s,()=>true);
 tools.open([]);await tools.operationTail;f.options.cookieFailure=true;
 const writes=f.writes().length;tools.setSelectedEnabled(['https://cold-source.test','https://second.test'],false);await tools.operationTail;
 assert.equal(f.writes().length-writes,1,'cleanup pending first setter stops later batch mutations');
 assert.deepEqual(f.cleanupCalls,['https://cold-source.test'],'outer Tools never repeats or bypasses gated Host cleanup');
 assert.equal(snapshot.original.confirmation,'confirmed');assert.equal(snapshot.original.blocked,true);
 f.options.cookieFailure=false;tools.continueOriginal(snapshot.original.generation);await tools.operationTail;
 assert.equal(f.writes().length-writes,1,'explicit cleanup does not resume unaccepted later batch items');count++;
}
console.log(`Source two cold actual domain owners / original physical Host identity / no replacement mutation: PASS (${count} groups).`);
