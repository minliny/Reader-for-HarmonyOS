/** Repeatable local Host production-method sample; no network/Core/ArkUI runtime. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
const out = dirname(fileURLToPath(import.meta.url));
const repo = resolve(out, '../../..');
const read = p => readFileSync(resolve(repo, p), 'utf8');
const prefix = 'entry/src/main/ets/';
const withoutImports = s => s.replace(/^import[\s\S]*?;\n/gm, '');
const executable = s => import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(s)).toString('base64')}`);
const sourceFiles = ['features/search/SearchGateway.ts','features/search/SearchBookProjection.ts','features/search/SearchOrchestrator.ets',
  'features/search/SearchPage.ets','features/search/SearchResultProjection.ts','features/search/SearchViewState.ts',
  'features/search/SearchResultRelevance.ts','features/search/SearchCandidatePolicy.ts','features/common/BookAcquisitionPresentation.ts',
  'features/source/ReaderSourceCategory.ts','app/ErrorMessage.ts'].map(p=>prefix+p);
const sourceSha256 = Object.fromEntries(sourceFiles.map(p=>[p, createHash('sha256').update(read(p)).digest('hex')]));
const { SearchOrchestrator, SearchBookProjection, SearchQueryRun } = await executable([
  'features/source/ReaderSourceCategory.ts','app/ErrorMessage.ts','features/search/SearchBookProjection.ts',
  'features/search/SearchGateway.ts','features/search/SearchOrchestrator.ets'
].map(p=>withoutImports(read(prefix+p))).join('\n')+'\nexport { SearchQueryRun };');
globalThis.hilog = { warn(){},error(){},info(){},debug(){},fatal(){} };
const pageSource = read(prefix+'features/search/SearchPage.ets');
const classes = pageSource.slice(pageSource.indexOf('@Observed\nclass SearchBookGroup'), pageSource.indexOf('/**\n * Figma-backed Book Search')).replace('@Observed\n','');
const { SearchBookGroup, SearchResultDataSource, SearchViewState } = await executable(`
const DataOperationType = { ADD:'add', DELETE:'delete', CHANGE:'change', RELOAD:'reload', MOVE:'move' };
${read(prefix+'features/search/SearchViewState.ts')}\n${classes}\nexport { SearchBookGroup, SearchResultDataSource };`);
const { SearchResultProjection } = await executable(['features/search/SearchResultProjection.ts','features/search/SearchResultRelevance.ts',
  'features/common/BookAcquisitionPresentation.ts','features/search/SearchCandidatePolicy.ts'].map(p=>withoutImports(read(prefix+p))).join('\n'));
const { productionMotionMethods } = await import(pathToFileURL(resolve(repo,'tools/lib/reader-motion-method-probe.mjs')).href);
let sample;
class CountedGroup extends SearchBookGroup { constructor(...args) { super(...args); if(sample) sample.counts.newGroups++; } }
const Page = productionMotionMethods(resolve(repo,prefix+'features/search/SearchPage.ets'), ['groupResults'],
  { SearchBookGroup:CountedGroup, SearchResultProjection });
const WARMUP = Number(process.env.READER_PERF_WARMUP ?? 20);
const SAMPLES = Number(process.env.READER_PERF_SAMPLES ?? 120);
assert.ok(SAMPLES>=100 && WARMUP>=1);
const QUERY_COUNT = 1000;
const originalProject = SearchBookProjection.prototype.project;
SearchBookProjection.prototype.project = function(...args) { if(sample)sample.counts.projectedBooks++; return originalProject.apply(this,args); };
const originalUpdate = SearchResultDataSource.prototype.update;
SearchResultDataSource.prototype.update = function(...args) { if(sample)sample.counts.rowUpdateCalls++; return originalUpdate.apply(this,args); };
const originalLower = String.prototype.toLocaleLowerCase;
const originalIndexOf = Array.prototype.indexOf;
const originalSplice = Array.prototype.splice;
const originalSort = Array.prototype.sort;
const originalFrom = Array.from;
let phase = '';
String.prototype.toLocaleLowerCase = function(...args){if(sample)sample.counts.localeNormalizations++;return originalLower.apply(this,args);};
Array.prototype.indexOf = function(...args){if(sample&&phase==='list')sample.counts.listIndexOfScannedSlots+=this.length;return originalIndexOf.apply(this,args);};
Array.prototype.splice = function(...args){if(sample&&phase==='list')sample.counts.listSpliceCalls++;return originalSplice.apply(this,args);};
Array.prototype.sort = function(...args){if(sample&&phase==='page'){sample.counts.pageSortCalls++;if(this.length===QUERY_COUNT)sample.counts.fullGroupSortCalls++;}return originalSort.apply(this,args);};
Array.from = function(...args){const result=originalFrom.apply(this,args);if(sample&&phase==='orchestrator'&&result.length===QUERY_COUNT)sample.counts.queryReferenceArrayCopies++;return result;};
function blank() { return { ms:{}, counts:{ rpcCalls:0, batchCalls:0, relatedCalls:0, requestedIdentities:0, returnedBooks:0, responseBytes:0,
  mockIndexLookups:0, projectedBooks:0, capturedIdentities:0, deltaUpserts:0, emittedPresentations:0, newGroups:0,
  changedGroups:0, rowUpdateCalls:0, nativeBatches:0, nativeOperations:0, nativeChange:0, nativeMove:0, nativeReload:0,
  localeNormalizations:0, fullGroupSortCalls:0, pageSortCalls:0, listIndexOfScannedSlots:0, listSpliceCalls:0, queryReferenceArrayCopies:0, orchestratorResultIndexLookups:0, runFlattenedRows:0 }, outputCount:0 }; }
function timed(name, fn) { const before=performance.now(); const result=fn();sample.ms[name]=performance.now()-before;return result; }
const identity = i => ({sourceId:'source-a',bookId:`book-${i}`});
function rawBook(i){return {...identity(i),sourceName:'源A',bookSourceUrl:'source-a',detailUrl:`book-${i}`,searchRequestId:'fixed-query',sourceRuleVersion:'v1',
  category:'novel',groupKey:`group-${i}`,title:`书${String(i).padStart(5,'0')}`,author:'作者',variables:[]};}
function cacheBook(i){return{origin:'source-a',bookUrl:`book-${i}`,name:`书${String(i).padStart(5,'0')}`,author:'作者',intro:'初始简介',
  relationKey:`relation-${i}`,relationRevision:'1',acquisition:{schemaVersion:2,sourceVersion:'v1'}};}
function listen(ds){ds.registerDataChangeListener({onDatasetChange(ops){if(!sample)return;sample.counts.nativeBatches++;sample.counts.nativeOperations+=ops.length;
  for(const op of ops){if(op.type==='change')sample.counts.nativeChange++;if(op.type==='move')sample.counts.nativeMove++;if(op.type==='reload')sample.counts.nativeReload++;}}});}
async function setup(unrelated) {
  const records = new Map();for(let i=0;i<QUERY_COUNT+unrelated;i++)records.set(`source-a\u0000book-${i}`,cacheBook(i));
  const sources=[{sourceId:'source-a',name:'源A',enabled:true,sourceVersion:'v1',category:'novel'},
    {sourceId:'empty-source',name:'空源',enabled:true,sourceVersion:'v1',category:'novel'}];
  const owner={bookAcquisitions:()=>({sourceRegistryRevision:()=>1}),async request(method,params){
    const started=performance.now();let data;
    if(method==='source.list')data={sources};
    else if(method==='search-book.batch.get'){
      assert.ok(params.identities.length<=128);const books=[],missing=[];
      for(const id of params.identities){const row=records.get(`${id.sourceId}\u0000${id.bookId}`);if(row)books.push(row);else missing.push(id);}
      data={books,missing,sourceVersions:[{sourceId:'source-a',sourceVersion:'v1',enabled:true}],snapshotRevision:'fixed-snapshot',complete:true};
      if(sample){sample.counts.batchCalls++;sample.counts.requestedIdentities+=params.identities.length;sample.counts.mockIndexLookups+=params.identities.length;}
    }else assert.fail(`No network or unscoped query allowed: ${method}`);
    // Deliberately model only a JSON boundary around exact pre-indexed fixture rows.
    const json=JSON.stringify(data);const decoded=JSON.parse(json);
    if(sample){sample.counts.rpcCalls++;sample.counts.returnedBooks+=decoded.books?.length??0;sample.counts.responseBytes+=Buffer.byteLength(json);
      sample.ms.mockRpcJson=(sample.ms.mockRpcJson??0)+performance.now()-started;}
    return{data:decoded};
  }};
  const orchestrator=new SearchOrchestrator(()=>{if(sample)sample.counts.emittedPresentations++;},()=>{},()=>true,owner);
  orchestrator.sessionOpen=true;
  const run=new SearchQueryRun('书','fixed-query');run.sources=sources;run.localStatus='done';run.completed.add('source-a');
  run.sourceResults.set('source-a',run.admit(Array.from({length:QUERY_COUNT},(_,i)=>rawBook(i))));
  const raw=run.results();orchestrator.run=run;orchestrator.publishRun(run);
  await orchestrator.refreshSharedBooks({reset:true,identities:[]});
  assert.equal(orchestrator.presentation.results.length,QUERY_COUNT);
  orchestrator.resultIndex.get=function(...args){if(sample&&phase==='orchestrator')sample.counts.orchestratorResultIndexLookups++;return Map.prototype.get.apply(this,args);};
  const originalResults=run.results.bind(run);
  run.results=()=>{const changed=run.flattenedRevision!==run.revision;const value=originalResults();if(sample&&changed)sample.counts.runFlattenedRows+=value.length;return value;};
  const gateway=orchestrator.gateway;const original=gateway.refreshBookDelta.bind(gateway);
  gateway.refreshBookDelta=async(...args)=>{const before=performance.now();phase='gateway';const patch=await original(...args);
    if(sample){sample.ms.gatewayInclusive=performance.now()-before;sample.counts.capturedIdentities+=patch.captured.size;sample.counts.deltaUpserts+=patch.upserted.length;}
    phase='orchestrator';return patch;};
  const page=Object.assign(new Page(),{presentation:orchestrator.presentation,shelfBooks:[],selectedGroupName:'全部',viewState:new SearchViewState()});
  const ds=new SearchResultDataSource();const groups=page.groupResults(orchestrator.presentation.results);ds.replace(groups,page.changedGroupKeys);listen(ds);
  assert.equal(ds.totalCount(),QUERY_COUNT);
  return{records,orchestrator,raw,page,ds,run};
}
async function runScenario(kind,unrelated){
  const state=await setup(unrelated);const rows=[];
  for(let i=0;i<WARMUP+SAMPLES;i++){
    const measured=i>=WARMUP;
    // Reset the same empty-source completion outside the timed event for repeatability.
    state.run.completed.delete('empty-source');state.run.failures.delete('empty-source');
    sample=blank();const s=sample;
    const changed=identity(QUERY_COUNT-1);
    if(kind!=='progress-only'&&kind!=='empty-source-completion') { const prior=state.records.get(`source-a\u0000${changed.bookId}`);
      state.records.set(`source-a\u0000${changed.bookId}`,{...prior,intro:`已更新简介 ${i}`,name:kind==='single-relevance-move'&&i%2===0?'书':rawBook(QUERY_COUNT-1).title}); }
    phase='orchestrator';const start=performance.now();
    if(kind==='progress-only'||kind==='empty-source-completion'){
      state.run.completed.add('empty-source');
      if(kind==='empty-source-completion')state.run.sourceResults.set('empty-source',state.run.admit([]));
      else state.run.failures.set('empty-source',{source:state.run.sources[1],error:'isolated fixture failure'});
      state.orchestrator.publishRun(state.run);
    }else await state.orchestrator.refreshSharedBooks({reset:false,identities:[changed]});
    s.ms.orchestratorInclusive=performance.now()-start;
    s.ms.gatewayInclusive??=0;s.ms.mockRpcJson??=0;
    s.ms.gatewayExcludingMockRpc=s.ms.gatewayInclusive-s.ms.mockRpcJson;
    s.ms.acceptanceExcludingGateway=s.ms.orchestratorInclusive-s.ms.gatewayInclusive;
    state.page.presentation=state.orchestrator.presentation;
    phase='page';const groups=timed('pageGrouping',()=>state.page.groupResults(state.orchestrator.presentation.results));
    s.counts.changedGroups=state.page.changedGroupKeys.size;
    phase='list';timed('listNotificationConstruction',()=>state.ds.replace(groups,state.page.changedGroupKeys));
    phase='';s.ms.hostStagesTotal=s.ms.orchestratorInclusive+s.ms.pageGrouping+s.ms.listNotificationConstruction;
    s.outputCount=state.ds.totalCount();sample=undefined;
    assert.equal(s.outputCount,QUERY_COUNT);assert.equal(s.counts.relatedCalls,0);
    if(kind==='progress-only'||kind==='empty-source-completion'){
      for(const key of ['rpcCalls','projectedBooks','newGroups','changedGroups','rowUpdateCalls','nativeBatches','localeNormalizations','fullGroupSortCalls','queryReferenceArrayCopies'])assert.equal(s.counts[key],0,key);
      assert.equal(s.counts.runFlattenedRows,0);
      assert.equal(s.counts.orchestratorResultIndexLookups,0);
    }else{
      for(const key of ['rpcCalls','batchCalls','requestedIdentities','returnedBooks','mockIndexLookups','projectedBooks','capturedIdentities','deltaUpserts','emittedPresentations','newGroups','changedGroups','nativeBatches','queryReferenceArrayCopies'])assert.equal(s.counts[key],1,key);
      if(kind==='single-metadata-delta'){assert.equal(s.counts.rowUpdateCalls,1);assert.equal(s.counts.nativeChange,1);assert.equal(s.counts.fullGroupSortCalls,0);assert.equal(s.counts.localeNormalizations,0);}
      else {assert.equal(s.counts.nativeMove,1);assert.equal(s.counts.nativeReload,0);assert.equal(s.counts.fullGroupSortCalls,1);}
    }
    if(measured)rows.push(s);
  }
  return{name:kind,queryCandidates:QUERY_COUNT,unrelatedCachedRows:unrelated,warmup:WARMUP,samples:rows};
}
function runReorder(){
  const ds=new SearchResultDataSource();const forward=Array.from({length:4000},(_,i)=>new SearchBookGroup(rawBook(i),1,false));const reverse=forward.slice().reverse();
  ds.replace(forward);listen(ds);const rows=[];
  for(let i=0;i<WARMUP+SAMPLES;i++){
    const items=i%2===0?reverse:forward;sample=blank();const s=sample;phase='list';timed('listNotificationConstruction',()=>ds.replace(items));phase='';
    s.outputCount=ds.totalCount();sample=undefined;
    assert.equal(s.counts.nativeBatches,1);assert.equal(s.counts.nativeReload,1);assert.equal(s.counts.nativeOperations,1);
    assert.equal(s.counts.listIndexOfScannedSlots,0);assert.equal(s.counts.listSpliceCalls,0);assert.equal(s.outputCount,4000);
    assert.equal(ds.getData(0),items[0]);assert.equal(ds.getData(3999),items[3999]);
    if(i>=WARMUP)rows.push(s);
  }
  return{name:'arbitrary-reverse-reorder',queryCandidates:4000,unrelatedCachedRows:null,warmup:WARMUP,samples:rows};
}
function stats(values){const sorted=values.toSorted((a,b)=>a-b);const percentile=p=>sorted[Math.ceil(p*sorted.length)-1];return{n:values.length,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:sorted.at(-1),min:sorted[0]};}
const scenarios=[];
try{
  for(const unrelated of [0,9000])for(const kind of ['single-metadata-delta','progress-only','empty-source-completion','single-relevance-move'])scenarios.push(await runScenario(kind,unrelated));
  scenarios.push(runReorder());
}finally{String.prototype.toLocaleLowerCase=originalLower;Array.prototype.indexOf=originalIndexOf;Array.prototype.splice=originalSplice;Array.prototype.sort=originalSort;Array.from=originalFrom;}
for(const scenario of scenarios){scenario.summary={ms:Object.fromEntries(Object.keys(scenario.samples[0].ms).map(k=>[k,stats(scenario.samples.map(s=>s.ms[k]))])),
  counts:Object.fromEntries(Object.keys(scenario.samples[0].counts).map(k=>[k,stats(scenario.samples.map(s=>s.counts[k]))])),outputCount:stats(scenario.samples.map(s=>s.outputCount))};}
const report={createdAt:new Date().toISOString(),probeSha256:createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
  runtime:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model},sourceSha256,
  scope:'Node execution of unchanged production Host ordinary methods. RPC is a pre-indexed immutable fixture JSON boundary. No native Core SQLite, SDK transport, network, ArkUI observation/layout/frames, VM/device or end-user latency is measured.',
  method:'20 warmups then 120 recorded samples by default; progress events reset the same empty-source completion outside timing and publish through actual SearchQueryRun/Orchestrator methods; nearest-rank percentiles; inclusive times are nested, do not sum them. hostStagesTotal = orchestratorInclusive + pageGrouping + listNotificationConstruction. Gate residuals include JS async scheduling and instrumentation. Assertions are outside timed stages except required fixture contract guards. Background shared-workspace load/GC is uncontrolled; max/outliers retained.',
  scenarios};
writeFileSync(resolve(out,'search-host-performance.json'),JSON.stringify(report,null,2)+'\n');
const fmt=v=>v.toFixed(4);
let md=`# Search Host local production-method performance sample\n\nGenerated ${report.createdAt}; Harmony HEAD ${report.gitHead}. ${report.runtime.node}, ${report.runtime.platform}/${report.runtime.arch}, ${report.runtime.cpu}.\n\n${report.scope}\n\n${report.method}\n\nRerun: \`node evidence/2026-09-14-physical-review/search-flow-implementation/search-host-performance.mjs\`. Source SHA256, individual samples and operation distributions are in the adjacent JSON.\n\n`;
for(const s of scenarios){md+=`## ${s.name}: query ${s.queryCandidates}, unrelated history ${s.unrelatedCachedRows??'not applicable'}\n\n| Local stage (ms) | n | p50 | p95 | p99 | max |\n|---|---:|---:|---:|---:|---:|\n`;
for(const[k,v]of Object.entries(s.summary.ms))md+=`| ${k} | ${v.n} | ${fmt(v.p50)} | ${fmt(v.p95)} | ${fmt(v.p99)} | ${fmt(v.max)} |\n`;
md+=`\n| Per-sample count / return | min | p50 | p95 | p99 | max |\n|---|---:|---:|---:|---:|---:|\n`;
for(const[k,v]of Object.entries({...s.summary.counts,outputCount:s.summary.outputCount}))md+=`| ${k} | ${v.min} | ${v.p50} | ${v.p95} | ${v.p99} | ${v.max} |\n`;md+='\n';}
md+='## Interpretation and read-only boundary\n\n- Increasing fixture history from 0 to 9,000 never changes the exact-identity RPC return count or projection/group update count. This proves Host consumption is bounded for these scenarios; native Core index performance is covered by the separate R5 evidence, not by the fixture Map. Timing differences between fixture sizes are not a speedup claim.\n- Ordinary metadata rebuilds one group and emits one CHANGE; pure failure/counter progress reuses the run result array and rebuilds/emits none. A successful empty source also goes through actual run.admit([])/publishRun: after the reviewed correction its entity revision stays unchanged, with zero flattened rows/index lookups/group rebuilds/notifications. The adjacent before-empty-fix JSON/Markdown preserve the observed former 1,000-row flatten and 2,000 index lookups under the previous source hashes. Accepted book deltas still copy the current 1,000-reference query array once, so the complete Host publication path is not O(1).\n- A single relevance change preserves ordering semantics with one group-order sort and one MOVE, without RELOAD. A 4,000-row arbitrary reversal builds one RELOAD batch and no row indexOf/splice loop. This measures preparation of the native notification, not its ArkUI consumption or scroll stability on a device.\n- Verified source correction: successful empty completion previously incremented SearchQueryRun.revision unconditionally; the local producer now supplies its prior bucket and invalidates only when admitted or prior entries exist. A prior nonempty bucket replaced by empty still invalidates. The targeted production worker→publication→page/list test asserts 1,000 retained rows with zero flatten/index lookup/group/notice and separately verifies real deletion. No native/device acceptance is implied.\n- R3 100/200 ms is a scheduling policy, not a measured device guarantee. Existing lifecycle regression fixtures cover first publication/final-stop flush and independent failed-branch retry. R7 source uses version/key validation after layout, bounded realization retry, and touch-gated cancellation; those protections are not claimed to have been frame-profiled here.\n';
writeFileSync(resolve(out,'search-host-performance.md'),md);
console.log(JSON.stringify({file:resolve(out,'search-host-performance.md'),scenarios:scenarios.map(s=>({name:s.name,unrelated:s.unrelatedCachedRows,n:s.samples.length,total:s.summary.ms.hostStagesTotal??s.summary.ms.listNotificationConstruction,counts:s.summary.counts.nativeOperations}))},null,2));
