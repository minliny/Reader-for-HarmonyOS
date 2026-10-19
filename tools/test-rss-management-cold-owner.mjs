import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const {writeFileSync}=await import("node:fs");
const {resolve}=await import("node:path");
const {fixture,draft,seedEntry,settle}=await import("./lib/rss-management-durable-probe.mjs");
const {deferred,until}=await import("./lib/rules-mutation-durable-probe.mjs");
const clone=value=>structuredClone(value);
const management=f=>{const values=[],operations=[],reads=[],host=new f.Orchestrator(v=>values.push(clone(v)),f.current,f.runtime,o=>operations.push(clone(o)),r=>reads.push(clone(r)));return{host,values,operations,reads};};
const editor=f=>{const lane=management(f).host,values=[],saved=[],host=new f.Editor(s=>values.push(clone(s)),id=>saved.push(id),f.current,f.runtime,work=>lane.runSerialized(work));return{lane,host,values,saved,settle:()=>settle(lane)};};
let cases=0;
const {cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...durableFixtureToolEvidence()}));let passed=false;try{
const key=id;
if(key==='management'){
for(const failure of ['beforeMethod','afterMethod']) {
 const f=await fixture();await seedEntry(f);const warm=management(f);warm.host.open();await settle(warm.host);
 f.options[failure]='rules.mutation.apply';warm.host.toggleSubscription('s',false);await settle(warm.host);
 assert.equal(warm.operations.at(-1).projection.receipt.confirmation,'unknown');
 const original=warm.operations.at(-1).original;assert.equal(original.scope,'management');assert.equal(original.blocked,true);
 f.retire();const cold=await fixture(f),m=management(cold);m.host.open();await settle(m.host);
 assert.equal(cold.writes().length,0,'open after cold only exact query + actual list read');
 const current=m.operations.at(-1);assert.equal(current.original.operationId,original.operationId);
 if(failure==='beforeMethod') {
  assert.equal(current.original.canRetryOriginal,true);m.host.continueOriginal(current.original);await settle(m.host);
  assert.equal(cold.writes().length,1);assert.equal(m.values.at(-1)[0].enabled,false);
 } else {
  assert.equal(current.projection.receipt.confirmation,'confirmed');assert.equal(current.original.blocked,true);
  const retained=cold.disk(),local=cold.io.finishes;m.host.reconcileOriginal(current.original);await settle(m.host);
  assert.equal(cold.disk(),retained);assert.equal(cold.io.finishes,local,'pure management reconcile never clears the original journal');
  m.host.continueOriginal(m.operations.at(-1).original);await settle(m.host);assert.equal(cold.writes().length,0);assert.equal(cold.disk(),'');
 }
 
}
}
if(key==='editor'){
for(const failure of ['beforeMethod','afterMethod']) {
 const f=await fixture(),warm=editor(f);warm.host.openCreate();await warm.settle();
 warm.host.updateFeedUrl(draft(30).feedUrl);warm.host.updateTitle('Original accepted title');
 f.options[failure]='rules.mutation.apply';warm.host.save();await warm.settle();
 assert.equal(warm.values.at(-1).canSave,false);assert.ok(warm.values.at(-1).original,JSON.stringify({snapshot:warm.values.at(-1),state:f.owner.snapshot(),calls:f.calls.slice(-6),disk:f.disk()}));assert.equal(warm.values.at(-1).original.scope,'editor');
 const original=warm.values.at(-1).original;f.retire();const cold=await fixture(f),e=editor(cold);
 e.host.openCreate();await e.settle();assert.equal(cold.writes().length,0);
 if(failure==='beforeMethod') {
  assert.equal(e.values.at(-1).feedUrl,draft(30).feedUrl,'cold accepted DTO restores actual draft');
  assert.equal(e.values.at(-1).title,'Original accepted title');assert.equal(e.values.at(-1).canSave,false);
  e.host.updateTitle('Newer draft remains local');const expected=e.values.at(-1).original;
  e.host.continueOriginal(expected);await e.settle();assert.equal(cold.writes().length,1);
  assert.equal(e.values.at(-1).title,'Newer draft remains local');assert.equal(e.saved.length,0,'historical accepted content cannot dismiss a newer draft');
 } else {
  assert.equal(e.values.at(-1).operation.receipt.confirmation,'confirmed');assert.equal(e.values.at(-1).original.blocked,true);
  const retained=cold.disk(),local=cold.io.finishes;e.host.reconcileOriginal(e.values.at(-1).original);await e.settle();
  assert.equal(cold.disk(),retained);assert.equal(cold.io.finishes,local,'pure editor reconcile never clears the original journal');
  e.host.continueOriginal(e.values.at(-1).original);await e.settle();assert.equal(cold.writes().length,0);
 }
 assert.equal(cold.disk(),'');assert.equal((await cold.rss.loadSubscriptions())[0].title,'Original accepted title');
}
}
if(key==='readback'){
{
 const f=await fixture();await seedEntry(f);const m=management(f);m.host.open();await settle(m.host);
 f.options.beforeMethod='rss-source.list';m.host.toggleSubscription('s',false);await settle(m.host);
 assert.equal(m.operations.at(-1).projection.receipt.fact,'confirmedRefreshFailed');assert.equal(m.operations.at(-1).original.blocked,false);
 const writes=f.writes().length;m.host.reconcileManagementOperation(m.operations.at(-1));await settle(m.host);
 assert.equal(f.writes().length,writes);assert.equal(m.operations.at(-1).projection.receipt.fact,'confirmedCurrent');
}
}
if(key==='entry'){
for(const method of ['read','favorite','unfavorite']) for(const failure of ['beforeMethod','afterMethod']) {
 const f=await fixture();await seedEntry(f);
 if(method==='unfavorite')await f.command('rss.favorite.persist',{subscriptionId:'s',guid:'g',addedAt:1});
 f.options[failure]='rules.mutation.apply';
 await assert.rejects(method==='read'?f.rss.setEntryRead('s','g',true):method==='favorite'?f.rss.persistFavorite('s','g',10):f.rss.removeFavorite('s','g'));
 f.retire();const cold=await fixture(f),m=management(cold),values=[],operations=[],reads=[],failures=[];
 const binding={current:cold.current,emit:v=>values.push(clone(v)),emitOperation:o=>operations.push(clone(o)),emitRead:r=>reads.push(clone(r)),failed:e=>failures.push(e.message)};
 m.host.openEntry('s','g',binding.emit,binding.failed,binding.current,binding.emitOperation,binding.emitRead);await settle(m.host);
 assert.equal(cold.writes().length,0,'cold entry opens with exact original recovery, never blind replay');
 assert.equal(values.at(-1).item.guid,'g');
 const original=operations.at(-1).original;assert.equal(original.scope,'entry');assert.equal(original.method,method==='read'?'rss.entry.read':method==='favorite'?'rss.favorite.persist':'rss.favorite.remove');
 if(failure==='beforeMethod') {
  assert.equal(original.canRetryOriginal,true);m.host.continueEntryOriginal(original,binding);await settle(m.host);
  assert.equal(cold.writes().length,1);assert.equal(operations.at(-1).projection.receipt.confirmation,'confirmed');
 } else {
  assert.equal(original.confirmation,'confirmed');assert.equal(original.blocked,true);
  const retained=cold.disk(),local=cold.io.finishes;m.host.reconcileEntryOriginal(original,binding,'s','g');await settle(m.host);
  assert.equal(cold.disk(),retained);assert.equal(cold.io.finishes,local,'pure entity reconcile never clears the original journal');
  m.host.continueEntryOriginal(operations.at(-1).original,binding);await settle(m.host);assert.equal(cold.writes().length,0);assert.equal(cold.disk(),'');
 }
 
}
}
if(key==='management-attachment'){
{
 const f=await fixture();await seedEntry(f);const host=f.Orchestrator.forRuntime(f.runtime),old=[],fresh=[];
 const attach=(id,values)=>host.attachPresentation(id,v=>values.push(clone(v)),f.current,()=>{},()=>{},f.current);
 assert.equal(attach('management-old',old),true);host.open();await settle(host);
 f.options.beforeMethod='rules.mutation.apply';host.toggleSubscription('s',false);await settle(host);
 assert.equal(attach('management-new',fresh),true);host.open();await settle(host);
 const original=host.originalMutationProjection(),writes=f.writes().length;
 host.continueOriginal(original,'management-old');await settle(host);assert.equal(f.writes().length,writes);
 host.detachPresentation('management-old');
 host.continueOriginal(original,'management-new');await settle(host);
 assert.equal(f.writes().length,writes+1);assert.equal(fresh.at(-1)[0].enabled,false);
}
}
if(key==='editor-accepted-transfer'){
for(const lost of [false,true]) {
 const f=await fixture(),lane=f.Orchestrator.forRuntime(f.runtime),host=f.Editor.forRuntime(f.runtime,work=>lane.runSerialized(work));
 const old=[],fresh=[],oldSaved=[],freshSaved=[];
 const attach=(id,values,saved)=>host.attachPresentation(id,v=>values.push(clone(v)),id=>saved.push(id),f.current,f.current);
 assert.equal(attach('editor-old',old,oldSaved),true);host.openCreate();await settle(lane);
 host.updateFeedUrl(draft(100).feedUrl);host.updateTitle('Accepted original');
 f.options.pauseMethod='rules.mutation.apply';f.options.gate=deferred();if(lost)f.options.afterMethod='rules.mutation.apply';
 host.save();await until(()=>f.calls.some(c=>c.method==='rules.mutation.apply'));
 assert.equal(f.owner.snapshot().busy,true);assert.equal(f.owner.snapshot().confirmation,'unknown');
 assert.equal(attach('editor-new',fresh,freshSaved),true);host.openCreate();host.updateTitle('New current draft');
 host.detachPresentation('editor-old');assert.equal(host.ownsPresentation('editor-new'),true);
 const oldDeliveries=old.length;f.options.gate.resolve();await settle(lane);
 assert.equal(old.length,oldDeliveries,'retired presentation receives no late ACK delivery');
 assert.equal(oldSaved.length,0);assert.equal(freshSaved.length,0,'historical accepted draft cannot close the new dirty editor');
 assert.equal(fresh.at(-1).title,'New current draft');assert.equal(f.writes().length,1);
 if(lost) {
  assert.equal(fresh.at(-1).original.confirmation,'confirmed','pure exact query qualifies the original lost ACK');
  assert.equal(fresh.at(-1).operation.receipt.confirmation,'confirmed');
 }
 
}
}
if(key==='editor-original'){
{
 const f=await fixture(),lane=f.Orchestrator.forRuntime(f.runtime),host=f.Editor.forRuntime(f.runtime,work=>lane.runSerialized(work)),values=[];
 const attach=id=>host.attachPresentation(id,v=>values.push(clone(v)),()=>{},f.current,f.current);
 attach('editor-first');host.openCreate();await settle(lane);host.updateFeedUrl(draft(110).feedUrl);
 f.options.beforeMethod='rules.mutation.apply';host.save();await settle(lane);
 attach('editor-reopened');host.openCreate();await settle(lane);let original=values.at(-1).original;const writes=f.writes().length,calls=f.calls.length;
 host.reconcileOriginal(original,'editor-first');await settle(lane);assert.equal(f.calls.length,calls,'old physical pure-reconcile cannot borrow the current editor');
 host.reconcileOriginal(original,'editor-reopened');await settle(lane);assert.equal(f.writes().length,writes,'explicit reconcile only queries exact original + current data');
 original=values.at(-1).original;
 host.continueOriginal(original,'editor-first');await settle(lane);assert.equal(f.writes().length,writes);
 host.detachPresentation('editor-first');assert.equal(host.ownsPresentation('editor-reopened'),true);
 host.continueOriginal(original,'editor-reopened');await settle(lane);assert.equal(f.writes().length,writes+1);
}
}
if(key==='damaged-intent'){
for(const damage of ['json','checksum']) {
 const f=await fixture();f.options.beforeMethod='rules.mutation.apply';await assert.rejects(f.rss.createSubscription(draft(120)));
 const intent=JSON.parse(f.disk());intent.recordFingerprint='0'.repeat(64);
 writeFileSync(resolve(f.files,'reader-rules-mutation-intent-v1.json'),damage==='json'?'{broken-json':JSON.stringify(intent));
 f.retire();const cold=await fixture(f),e=editor(cold);e.host.openCreate();await e.settle();
 const original=e.values.at(-1).original;assert.equal(original.blocked,true);assert.equal(original.scope,'foreign');
 assert.equal(original.operationId,'','absence is not a manufactured original identity');assert.equal(original.canRetryOriginal,false);
 assert.equal(e.values.at(-1).canSave,false,'corrupt durable authority is visible before accepting a new draft');
 e.host.updateFeedUrl(draft(121).feedUrl);e.host.save();e.host.continueOriginal(original);await e.settle();
 assert.equal(cold.writes().length,0);assert.ok(cold.disk(),'damaged evidence is preserved');
}
}
passed=true;}finally{const cleanup=await cleanupDurableFixtures({retain:!passed});if(!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
const definitions={"management": {"description": "management actual production owner/SDK scope", "resources": []}, "editor": {"description": "editor actual production owner/SDK scope", "resources": []}, "readback": {"description": "readback actual production owner/SDK scope", "resources": []}, "entry": {"description": "entry actual production owner/SDK scope", "resources": []}, "management-attachment": {"description": "management-attachment actual production owner/SDK scope", "resources": []}, "editor-accepted-transfer": {"description": "editor-accepted-transfer actual production owner/SDK scope", "resources": []}, "editor-original": {"description": "editor-original actual production owner/SDK scope", "resources": []}, "damaged-intent": {"description": "damaged-intent actual production owner/SDK scope", "resources": []}};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
