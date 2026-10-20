import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { writeFileSync }=await import("node:fs");
const { resolve }=await import("node:path");
const { fixture, seedEntry, settle }=await import("./lib/rss-management-durable-probe.mjs");
const { fixture: sourceFixture }=await import("./lib/source-management-durable-probe.mjs");
const { deferred, until }=await import("./lib/rules-mutation-durable-probe.mjs");

const clone = value => structuredClone(value);
const sourceDocument = JSON.stringify({bookSourceUrl:'https://original-source.test',bookSourceName:'Original Source',enabled:true});

function route(f, alive = {value:true}) {
  const originals=[], values=[], operations=[], reads=[], errors=[];
  const host=f.Orchestrator.forRuntime(f.runtime);
  const binding={current:()=>alive.value && f.current(), emit:v=>values.push(clone(v)),
    emitRead:v=>reads.push(clone(v)),emitOperation:v=>operations.push(clone(v)),
    emitOriginal:v=>originals.push(clone(v)),failed:e=>errors.push(e.message)};
  return {host,binding,originals,values,operations,reads,errors,alive};
}
async function sourceCleanupPending() {
  const f=await sourceFixture();await seedEntry(f);await f.source.importBookSourceDocument(sourceDocument,f.current);
  f.options.cookieFailure=true;await f.source.updateSource('https://original-source.test',{enabled:false},f.current);
  assert.equal(f.owner.snapshot().confirmation,'confirmed');assert.equal(f.owner.snapshot().blocked,true);
  assert.deepEqual(f.cleanupCalls,['https://original-source.test']);f.retire();return fixture(f);
}
async function rulesPending(failure) {
  const f=await fixture();await seedEntry(f);f.options[failure]='rules.mutation.apply';
  await assert.rejects(f.save());f.retire();return fixture(f);
}
async function entryPending(failure) {
  const f=await fixture();await seedEntry(f);f.options[failure]='rules.mutation.apply';
  await assert.rejects(f.rss.setEntryRead('s','g',true));f.retire();return fixture(f);
}
function unchanged(f, disk, local, applied) {
  assert.equal(f.disk(),disk,'pure read preserves the complete original journal');
  assert.equal(f.io.finishes,local,'pure read cannot rename/clear/advance the journal');
  assert.equal(f.writes().length,applied,'pure query never dispatches mutation.apply');
}

const {cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...durableFixtureToolEvidence()}));
let passed=false;try{
const key=id;
if(key==='foreign-source-rules'){
for (const kind of ['source-cleanup','rules-before','rules-after']) {
  const f=kind==='source-cleanup' ? await sourceCleanupPending() : await rulesPending(kind==='rules-before'?'beforeMethod':'afterMethod');
  let cleanup=0;f.runtime.clearSourceCookieSession=async()=>{cleanup++;};
  const r=route(f),disk=f.disk(),local=f.io.finishes,applied=f.writes().length;
  r.host.loadSourceFeed('s',r.binding.emit,r.binding.failed,r.binding.current,r.binding.emitOperation,r.binding.emitRead,r.binding.emitOriginal);
  await settle(r.host);const original=r.originals.at(-1);
  assert.equal(original.scope,'foreign');assert.equal(original.blocked,true);assert.equal(original.canRetryOriginal,false);
  assert.equal(original.confirmation,kind==='rules-before'?'unknown':'confirmed');
  assert.equal(r.values.at(-1).subscription.subscriptionId,'s');
  assert.equal(r.operations.length,0,'no foreign ACK masquerades as this source entity receipt');
  assert.ok(f.calls.some(c=>c.method==='rules.mutation.query' && c.params.operationId===original.operationId));
  unchanged(f,disk,local,applied);const queries=f.calls.filter(c=>c.method==='rules.mutation.query').length;
  r.host.reconcileSourceOriginal(original,r.binding,'s');await settle(r.host);
  assert.ok(f.calls.filter(c=>c.method==='rules.mutation.query').length>queries,'physical pure action actually queries exact Core envelope');
  const fresh=r.originals.at(-1),count=f.calls.length;
  r.host.reconcileSourceOriginal(original,r.binding,'s');await settle(r.host);
  assert.equal(f.calls.length,count,'retired original generation cannot borrow a fresh inspection');
  await f.rss.recoverOriginalRss(f.current,fresh,true);
  assert.equal(f.owner.snapshot().canRetryOriginal,false,'foreign original cannot acquire continuation permission');
  unchanged(f,disk,local,applied);assert.equal(cleanup,0);
  if(kind==='source-cleanup')assert.equal(f.owner.snapshot().confirmation,'confirmed','denied foreign retry does not erase confirmed Core truth');
  
}
}
if(key==='entry-continuation'){
for(const failure of ['beforeMethod','afterMethod']) {
  const f=await entryPending(failure),r=route(f),disk=f.disk(),local=f.io.finishes;
  r.host.loadSourceFeed('s',r.binding.emit,r.binding.failed,r.binding.current,r.binding.emitOperation,r.binding.emitRead,r.binding.emitOriginal);
  await settle(r.host);let original=r.originals.at(-1);
  assert.equal(original.scope,'entry');assert.equal(original.blocked,true);assert.equal(original.canRetryOriginal,true);
  assert.equal(original.confirmation,failure==='beforeMethod'?'unknown':'confirmed');
  assert.equal(r.operations.length,0,'cold source has an original projection without invented operation generation');
  unchanged(f,disk,local,0);
  r.host.reconcileEntryOriginal(original,r.binding,'s','g');await settle(r.host);original=r.originals.at(-1);
  unchanged(f,disk,local,0);assert.equal(r.values.at(-1).item.guid,'g');
  r.host.continueEntryOriginal({...original,method:'rss.favorite.remove'},r.binding);await settle(r.host);
  unchanged(f,disk,local,0);
  r.host.continueEntryOriginal(original,r.binding);await settle(r.host);
  assert.equal(f.writes().length,failure==='beforeMethod'?1:0);assert.equal(f.disk(),'');
  if(f.writes().length)assert.deepEqual(f.writes()[0].params,{operationId:JSON.parse(disk).operationId,
    sequence:JSON.parse(disk).sequence,mutation:JSON.parse(disk).mutation},'explicit original continuation preserves full accepted tuple');
  
}
}
if(key==='source-cleanup-owner'){
{
  const f=await sourceCleanupPending(),r=route(f),disk=f.disk(),local=f.io.finishes;
  r.host.loadFeed(r.binding.emit,r.binding.emitRead,r.binding.current,undefined,r.binding.emitOriginal);await settle(r.host);
  assert.equal(r.originals.at(-1).scope,'foreign');assert.equal(r.reads.at(-1).fact,'current');
  const original=r.originals.at(-1);r.host.reconcileFeedOriginal(original,r.binding.emit,r.binding.emitRead,r.binding.current,r.binding.emitOriginal);
  await settle(r.host);assert.equal(r.originals.at(-1).confirmation,'confirmed');unchanged(f,disk,local,0);
  f.retire();const source=await sourceFixture(f);await source.recoverSource(true);
  assert.equal(source.writes().length,0);assert.deepEqual(source.cleanupCalls,['https://original-source.test']);assert.equal(source.disk(),'');
}
}
if(key==='late-query'){
for(const replacement of ['route','runtime']) {
  const f=await rulesPending('afterMethod'),r=route(f);r.host.loadSourceFeed('s',r.binding.emit,r.binding.failed,r.binding.current,r.binding.emitOperation,r.binding.emitRead,r.binding.emitOriginal);
  await settle(r.host);const original=r.originals.at(-1),count=r.originals.length,values=r.values.length,disk=f.disk(),local=f.io.finishes;
  f.options.pauseMethod='rules.mutation.query';f.options.gate=deferred();
  r.host.reconcileSourceOriginal(original,r.binding,'s');await until(()=>f.options.pauseMethod===undefined);
  if(replacement==='route')r.alive.value=false;else f.retire();
  f.options.gate.resolve();await settle(r.host);
  assert.equal(r.originals.length,count);assert.equal(r.values.length,values,'late original query cannot publish into replacement view/runtime');
  unchanged(f,disk,local,0);
}
}
if(key==='damaged-intent'){
for(const damage of ['json','terminal']) {
  const f=await sourceCleanupPending(),intent=JSON.parse(f.disk());
  if(damage==='terminal') {
    intent.terminal.ackFingerprint='0'.repeat(64);
    intent.recordFingerprint=await f.sha256Hex(JSON.stringify({...intent,recordFingerprint:undefined,subscription:undefined}));
  }
  writeFileSync(resolve(f.files,'reader-rules-mutation-intent-v1.json'),damage==='json'?'{broken':JSON.stringify(intent));
  f.retire();const c=await fixture(f),r=route(c),disk=c.disk(),local=c.io.finishes;
  r.host.loadSourceFeed('s',r.binding.emit,r.binding.failed,r.binding.current,r.binding.emitOperation,r.binding.emitRead,r.binding.emitOriginal);await settle(r.host);
  const original=r.originals.at(-1);assert.equal(original.scope,'foreign');assert.equal(original.blocked,true);assert.equal(original.canRetryOriginal,false);
  assert.equal(original.operationId,'','damaged local evidence never manufactures a qualified original');
  r.host.reconcileSourceOriginal(original,r.binding,'s');await settle(r.host);unchanged(c,disk,local,0);
}
}
if(key==='bad-core-receipt'){
for(const corruption of ['higher-null','invalid-ack']) {
  const f=await rulesPending('afterMethod'),r=route(f),disk=f.disk(),local=f.io.finishes;
  f.options.transformMethod='rules.mutation.query';f.options.transform=value=>corruption==='higher-null' ?
    {...value,head:{...value.head,sequence:value.head.sequence+1},receipt:null} :
    {...value,receipt:{...value.receipt,ackFingerprint:'0'.repeat(64)}};
  r.host.loadSourceFeed('s',r.binding.emit,r.binding.failed,r.binding.current,r.binding.emitOperation,r.binding.emitRead,r.binding.emitOriginal);await settle(r.host);
  assert.equal(r.originals.at(-1).confirmation,'unknown');assert.equal(r.originals.at(-1).blocked,true);
  assert.equal(r.originals.at(-1).canRetryOriginal,false);unchanged(f,disk,local,0);
}
}
if(key==='inspection-negative'){
{
  const f=await entryPending('afterMethod'),r=route(f),gateway=r.host.gateway,actual=gateway.recoverOriginalRss.bind(gateway);
  gateway.recoverOriginalRss=(current,expected,retry)=>actual(current,expected,retry,false);
  r.host.loadSourceFeed('s',r.binding.emit,r.binding.failed,r.binding.current,r.binding.emitOperation,r.binding.emitRead,r.binding.emitOriginal);await settle(r.host);
  assert.equal(f.disk(),'');assert.ok(f.io.finishes>0,'negative control detects omitted inspection flag using actual journal cleanup');
}
}
if(key==='attachment'){
{
  const f=await fixture(),host=f.Orchestrator.forRuntime(f.runtime),noop=()=>{};
  assert.equal(host.attachPresentation('one',noop,()=>false,noop,noop,f.current),true);
  assert.equal(host.isPresentationCurrent('one'),true,'shared route attachment is independent from management route');
  assert.equal(host.attachPresentation('two',noop,()=>false,noop,noop,f.current),true);
  assert.equal(host.isPresentationCurrent('one'),false);host.detachPresentation('one');assert.equal(host.isPresentationCurrent('two'),true);
  f.retire();assert.equal(host.isPresentationCurrent('two'),false);
}
}
passed=true;}finally{const cleanup=await cleanupDurableFixtures({retain:!passed});if(!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
const definitions={"foreign-source-rules": {"description": "foreign-source-rules actual production SDK/Core scope", "resources": []}, "entry-continuation": {"description": "entry-continuation actual production SDK/Core scope", "resources": []}, "source-cleanup-owner": {"description": "source-cleanup-owner actual production SDK/Core scope", "resources": []}, "late-query": {"description": "late-query actual production SDK/Core scope", "resources": []}, "damaged-intent": {"description": "damaged-intent actual production SDK/Core scope", "resources": []}, "bad-core-receipt": {"description": "bad-core-receipt actual production SDK/Core scope", "resources": []}, "inspection-negative": {"description": "inspection-negative actual production SDK/Core scope", "resources": []}, "attachment": {"description": "attachment actual production SDK/Core scope", "resources": []}};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
