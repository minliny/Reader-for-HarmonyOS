import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"setter-beforeMethod": {"description": "Cold setter-beforeMethod exact operation and physical owner; existing CLI, isolated temporary Core store", "resources": []}, "delete-beforeMethod": {"description": "Cold delete-beforeMethod exact operation and physical owner; existing CLI, isolated temporary Core store", "resources": []}, "setter-afterMethod": {"description": "Cold setter-afterMethod exact operation and physical owner; existing CLI, isolated temporary Core store", "resources": []}, "delete-afterMethod": {"description": "Cold delete-afterMethod exact operation and physical owner; existing CLI, isolated temporary Core store", "resources": []}, "cleanup-batch": {"description": "Cold cleanup-batch exact operation and physical owner; existing CLI, isolated temporary Core store", "resources": []}};
async function runCase(caseID){
const assert=(await import('node:assert/strict')).default;
const {fixture}=await import('./lib/source-management-durable-probe.mjs');
const document=JSON.stringify({bookSourceUrl:'https://cold-source.test',bookSourceName:'Cold Source',enabled:true});
let count=0;

const {cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
console.log(JSON.stringify({kind:'durable-fixture-tool-evidence',...durableFixtureToolEvidence()}));
let passed=false;
try {
const cases={
'setter-beforeMethod':async()=>{
const commit='beforeMethod';
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

},
'delete-beforeMethod':async()=>{
const commit='beforeMethod';
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);
 f.options[commit]='rules.mutation.apply';await assert.rejects(f.source.deleteSources(['https://cold-source.test']));
 f.retire();const c=await fixture(f);let snapshot;
 const tools=c.SourceToolsOrchestrator.forRuntime(c.runtime);tools.attachPresentation('tools',s=>snapshot=s,()=>true);tools.open([]);await tools.operationTail;
 assert.equal(snapshot.original.blocked,true);assert.equal(c.writes().length,0);assert.equal(snapshot.sources.length,commit==='beforeMethod'?1:0,JSON.stringify({snapshot,calls:c.calls.map(x=>({method:x.method,params:x.params}))}));
 tools.deleteSelected(['https://cold-source.test']);await tools.operationTail;assert.equal(c.writes().length,0);
 tools.continueOriginal(snapshot.original.generation);await tools.operationTail;
 assert.equal(snapshot.original.blocked,false);assert.equal(c.disk(),'');assert.equal(c.writes().length,commit==='beforeMethod'?1:0);count++;

},
'setter-afterMethod':async()=>{
const commit='afterMethod';
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

},
'delete-afterMethod':async()=>{
const commit='afterMethod';
 const f=await fixture();await f.source.importBookSourceDocument(document,f.current);
 f.options[commit]='rules.mutation.apply';await assert.rejects(f.source.deleteSources(['https://cold-source.test']));
 f.retire();const c=await fixture(f);let snapshot;
 const tools=c.SourceToolsOrchestrator.forRuntime(c.runtime);tools.attachPresentation('tools',s=>snapshot=s,()=>true);tools.open([]);await tools.operationTail;
 assert.equal(snapshot.original.blocked,true);assert.equal(c.writes().length,0);assert.equal(snapshot.sources.length,commit==='beforeMethod'?1:0,JSON.stringify({snapshot,calls:c.calls.map(x=>({method:x.method,params:x.params}))}));
 tools.deleteSelected(['https://cold-source.test']);await tools.operationTail;assert.equal(c.writes().length,0);
 tools.continueOriginal(snapshot.original.generation);await tools.operationTail;
 assert.equal(snapshot.original.blocked,false);assert.equal(c.disk(),'');assert.equal(c.writes().length,commit==='beforeMethod'?1:0);count++;

},
'cleanup-batch':async()=>{
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

},
};await cases[caseID]();passed=true;
} finally {const cleanup=await cleanupDurableFixtures({retain:!passed});if(!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
for(const id of selectContractCases(definitions)){await runCase(id);recordContractCasePass(id);}
