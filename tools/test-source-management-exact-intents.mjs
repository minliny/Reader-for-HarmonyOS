import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {fixture} from './lib/source-management-durable-probe.mjs';
const source=i=>({bookSourceUrl:`https://source-${i}.test`,bookSourceName:`Source ${i}`,bookSourceType:0,enabled:true});
let cases=0;
for(const failure of ['beforeMethod','afterMethod']) {
 const f=await fixture();await f.source.importBookSourceDocument(JSON.stringify(source(1)));
 f.options[failure]='rules.mutation.apply';await assert.rejects(f.source.updateSource('https://source-1.test',{enabled:false},f.current));
 const original=JSON.parse(f.disk()),writes=f.writes().length;f.retire();const cold=await fixture(f);
 const pure=await cold.recoverSource(false);assert.equal(cold.writes().length,0,'cold query never applies an unobserved tuple');
 if(failure==='beforeMethod') {
  assert.equal(pure.canRetryOriginal,true);await cold.recoverSource(true);assert.equal(cold.writes().length,1);
  assert.deepEqual(cold.writes()[0].params,{operationId:original.operationId,sequence:original.sequence,mutation:original.mutation});
 } else {assert.equal(pure.confirmation,'confirmed');assert.equal(pure.blocked,true);assert.equal(pure.writeStage,'cleanup');assert.equal(cold.cleanupCalls.length,0,'pure query does not retry login cleanup');await cold.recoverSource(true);assert.equal(cold.writes().length,0);}
 const row=await cold.source.loadSources('https://source-1.test');assert.equal(row[0].enabled,false);assert.equal(cold.disk(),'');
 assert.ok(writes>0);cases++;
}
for(const failure of ['beforeMethod','afterMethod']) {
 const f=await fixture(),document=[source(10),source(11),source(12)];f.options[failure]='rules.mutation.apply';
 await assert.rejects(f.source.importBookSourceDocument(JSON.stringify(document),f.current));
 assert.equal(f.writes().length,1,'unknown first row prevents later source dispatch');const original=JSON.parse(f.disk());
 assert.equal(original.subscription.kind,3);assert.equal(f.plan().includes('rule-sub.put'),false,'ordinary document never fabricates subscription metadata');
 f.retire();const cold=await fixture(f);const query=await cold.recoverSource(false);assert.equal(cold.writes().length,0);
 assert.equal(query.canRetryOriginal,true);await cold.recoverSource(true);
 const list=await cold.source.loadSources();assert.equal(list.length,3);assert.equal(cold.disk(),'');
 assert.equal(cold.writes().length,failure==='beforeMethod'?3:2,'qualified row is not blindly replayed');cases++;
}
{
 const f=await fixture();const summary=await f.source.importBookSourceDocument(JSON.stringify([source(20),{bad:true},source(21)]),f.current);
 assert.equal(summary.importedCount,2);assert.equal(summary.failedCount,1);assert.deepEqual(summary.sourceIds,['https://source-20.test','https://source-21.test']);
 assert.equal(f.writes().length,2);assert.equal(f.disk(),'');cases++;
}
{
 const f=await fixture();await f.source.importBookSourceDocument(JSON.stringify(source(30)),f.current);
 f.options.beforeMethod='rules.mutation.apply';await assert.rejects(f.source.deleteSources(['https://source-30.test']));
 const original=JSON.parse(f.disk());await f.command('rules.mutation.apply',{operationId:'12345678-1234-4234-8123-000000000099/2',sequence:2,mutation:{method:'dict-rule.put',params:{name:'x',urlRule:'x',showRule:'x',enabled:true,sortNumber:0}}});
 const before=f.writes().length;await assert.rejects(f.recoverSource(true));assert.equal(f.writes().length,before,'higher head never admits a new identity or old deletion');
 assert.equal(JSON.parse(f.disk()).operationId,original.operationId);cases++;
}
{
 const f=await fixture();await f.source.importBookSourceDocument(JSON.stringify(source(40)),f.current);
 f.options.cookieFailure=true;const result=await f.source.deleteSources(['https://source-40.test']);
 assert.equal(result.deletedCount,1);assert.equal(result.cookieCleanupFailures,1);
 assert.equal(f.owner.snapshot().confirmation,'confirmed');assert.equal(f.owner.snapshot().blocked,true);
 const saved=JSON.parse(f.disk());assert.equal(saved.terminal.method,'source.delete');assert.ok(saved.recordFingerprint);
 f.retire();const cold=await fixture(f);const pure=await cold.recoverSource(false);
 assert.equal(pure.confirmation,'confirmed');assert.equal(pure.writeStage,'cleanup');assert.equal(cold.cleanupCalls.length,0);
 await cold.recoverSource(true);assert.equal(cold.writes().length,0,'Host cleanup never replays a committed Core delete');
 assert.deepEqual(cold.cleanupCalls,['https://source-40.test']);assert.equal(cold.disk(),'');cases++;
}
for (const corruption of ['fixedDTO','terminalHash','legacyTerminal']) {
 const f=await fixture();await f.source.importBookSourceDocument(JSON.stringify(source(50)),f.current);
 f.options.cookieFailure=true;await f.source.deleteSources(['https://source-50.test']);
 const saved=JSON.parse(f.disk());f.retire();
 if (corruption==='fixedDTO')saved.mutation.params.sourceIds=['https://foreign.test'];
 else if (corruption==='terminalHash') {
  saved.terminal.data.deleted=0;
  saved.recordFingerprint=await f.sha256Hex(JSON.stringify({...saved,recordFingerprint:undefined}));
 } else {delete saved.recordFingerprint;saved.terminal.data.deleted=0;}
 writeFileSync(resolve(f.files,'reader-rules-mutation-intent-v1.json'),JSON.stringify(saved));
 const cold=await fixture(f);
 if(corruption==='legacyTerminal') {
  const result=await cold.recoverSource(false);assert.equal(result.confirmation,'confirmed');
  assert.equal(cold.calls.some(c=>c.method==='rules.mutation.query'),true,'legacy unchecked terminal must obtain real Core ACK');
 } else await assert.rejects(cold.recoverSource(true),/校验|终态/);
 assert.equal(cold.writes().length,0,'corrupt or unchecked original never authorizes another mutation');cases++;
}
console.log(`Source original management/document actual SDK + Atomic + per-RPC cold SQLite: PASS (${cases} groups).`);
