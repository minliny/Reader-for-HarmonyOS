import assert from 'node:assert/strict';
import {deferred,until} from './lib/rules-mutation-durable-probe.mjs';
import {fixture,draft,seedEntry} from './lib/rss-management-durable-probe.mjs';
let cases=0;
for (const failure of ['beforeMethod','afterMethod']) {
 const f=await fixture();f.options[failure]='rules.mutation.apply';
 await assert.rejects(f.rss.createSubscription(draft(cases)));
 const original=JSON.parse(f.disk());assert.equal(original.mutation.method,'rss-source.put');assert.ok(original.recordFingerprint);
 f.retire();const cold=await fixture(f);
 const pure=await cold.recover();assert.equal(cold.writes().length,0,'cold reconcile only obtains actual original query');
 if(failure==='beforeMethod') {
  assert.equal(pure.original.canRetryOriginal,true);assert.equal(pure.original.scope,'editor');
  const result=await cold.recover(pure.original,true);assert.equal(result.original.confirmation,'confirmed');
  assert.deepEqual(cold.writes()[0].params,{operationId:original.operationId,sequence:original.sequence,mutation:original.mutation});
 } else {
  assert.equal(pure.original.confirmation,'confirmed');assert.ok(pure.outcome.subscription.subscriptionId);assert.equal(pure.original.blocked,true);
  assert.equal(cold.disk(),JSON.stringify(original),'pure exact ACK does not clear the accepted intent');
  await cold.recover(pure.original,true);assert.equal(cold.writes().length,0,'explicit original cleanup does not repeat an acknowledged Core write');
 }
 assert.equal(cold.disk(),'');assert.equal((await cold.rss.loadSubscriptions()).length,1);cases++;
}
for (const variant of ['update','toggle','remove','read','favorite','unfavorite','import']) {
 for (const failure of ['beforeMethod','afterMethod']) {
  const f=await fixture();await seedEntry(f);
  if(variant==='unfavorite')await f.command('rss.favorite.persist',{subscriptionId:'s',guid:'g',addedAt:1});
  const work=()=>variant==='update'?f.rss.updateSubscription('s',{...draft(9),feedUrl:'https://s.test/feed'}):
    variant==='toggle'?f.rss.updateSubscriptionEnabled('s',false):variant==='remove'?f.rss.removeSubscription('s'):
    variant==='read'?f.rss.setEntryRead('s','g',true):variant==='favorite'?f.rss.persistFavorite('s','g',22):
    variant==='unfavorite'?f.rss.removeFavorite('s','g'):f.rss.importSourcesDocument(JSON.stringify([{sourceUrl:'https://import.test/feed',sourceName:'Import',enabled:true}]),false);
  f.options[failure]='rules.mutation.apply';await assert.rejects(work());
  const original=JSON.parse(f.disk());f.retire();const cold=await fixture(f);
  const pure=await cold.recover();assert.equal(cold.writes().length,0);
  if(failure==='beforeMethod') {
   assert.equal(pure.original.canRetryOriginal,true);await cold.recover(pure.original,true);
   assert.deepEqual(cold.writes()[0].params,{operationId:original.operationId,sequence:original.sequence,mutation:original.mutation});
  } else {
   assert.equal(pure.original.confirmation,'confirmed', variant+' '+failure+' '+pure.original.message);assert.equal(pure.original.blocked,true);
   assert.equal(cold.disk(),JSON.stringify(original),'pure exact ACK preserves the journal');
   await cold.recover(pure.original,true);assert.equal(cold.writes().length,0,'only original local cleanup continues after a known ACK');
  }
  assert.equal(cold.disk(),'');cases++;
 }
}
for(const damage of ['method','hash','identity','data']) {
 const f=await fixture();f.options.transformMethod='rules.mutation.apply';
 f.options.transform=data=>{const damaged=structuredClone(data);if(damage==='method')damaged.method='rss.favorite.persist';
  else if(damage==='hash')damaged.ackFingerprint='0'.repeat(64);else if(damage==='identity')damaged.binding.operationId='12345678-1234-4234-8123-000000000099/1';
  else damaged.data.created=!damaged.data.created;return damaged;};
 await assert.rejects(f.rss.createSubscription(draft(60)));assert.equal(f.owner.snapshot().confirmation,'unknown');
 assert.ok(f.disk());f.options.transformMethod=undefined;const count=f.writes().length;
 const recovered=await f.recover();assert.equal(recovered.original.confirmation,'confirmed');assert.equal(f.writes().length,count);cases++;
}
for(const foreign of ['dict','subscription','source']) {
 const f=await fixture();f.options.beforeMethod='rules.mutation.apply';
 if(foreign==='dict')await assert.rejects(f.save());
 else if(foreign==='source')await assert.rejects(f.owner.run('Source original',f.current,async(request,confirmed)=>{await request('source.update',{sourceId:'foreign',enabled:false});confirmed();}));
 else await assert.rejects(f.owner.runSubscription(1,[{method:'rss-source.import',params:{json:JSON.stringify([{sourceUrl:'https://foreign.test/feed'}]),replaceExisting:false}},
  {method:'rule-sub.put',params:{id:1,name:'Foreign',url:'https://foreign.test/subscription',type:1}}],[],f.current,()=>{}));
 const count=f.writes().length,result=await f.recover();assert.equal(result.original.scope,'foreign');assert.equal(result.original.canRetryOriginal,false);assert.equal(result.original.blocked,true);
 await f.recover(result.original,true);assert.equal(f.writes().length,count,'foreign RSS-looking subscription cannot be continued by ordinary RSS callback');cases++;
}
{
 const f=await fixture();await seedEntry(f);f.options.beforeMethod='rules.mutation.apply';await assert.rejects(f.rss.setEntryRead('s','g',true));
 const first=(await f.recover()).original, count=f.writes().length;
 for(const patch of [{operationId:'other'}, {method:'rss.favorite.persist'}, {scope:'management'}, {subscriptionId:'other'}, {guid:'other'}]) {
  await assert.rejects(f.recover({...first,...patch},true));assert.equal(f.writes().length,count);
 }
 const newer=(await f.recover(first)).original;await assert.rejects(f.recover(first,true),'retained old physical callback cannot borrow newer recovery generation');
 await f.recover(newer,true);assert.equal(f.writes().length,count+1);cases++;
}
for(const stage of ['start','finish','fsync']) {
 const f=await fixture();if(stage==='start')f.options.beforeLocal=true;else f.options[stage==='finish'?'loseFinishAt':'loseSyncAt']=1;
 await assert.rejects(f.rss.createSubscription(draft(70)));assert.equal(f.writes().length,0,'no Core until real original Atomic ACK');
 const state=f.owner.snapshot(),saved=f.disk()?JSON.parse(f.disk()):{operationId:state.operationId,sequence:state.sequence,mutation:state.original},query=await f.recover();assert.equal(query.original.canRetryOriginal,true);
 await f.recover(query.original,true);assert.equal(f.writes().length,1);assert.deepEqual(f.writes()[0].params,{operationId:saved.operationId,sequence:saved.sequence,mutation:saved.mutation});cases++;
}
{
 const f=await fixture();await seedEntry(f);f.options.beforeMethod='rules.mutation.apply';await assert.rejects(f.rss.setEntryRead('s','g',true));
 const original=JSON.parse(f.disk());
 for(const sequence of [1,2]) await f.command('rules.mutation.apply',{operationId:`12345678-1234-4234-8123-000000000099/${sequence}`,sequence,
  mutation:{method:'dict-rule.put',params:{name:'later',urlRule:'x',showRule:'x',enabled:true,sortNumber:0}}});
 const count=f.writes().length,result=await f.recover();assert.equal(result.original.blocked,true);assert.equal(result.original.canRetryOriginal,false);
 await f.recover(result.original,true);assert.equal(f.writes().length,count);assert.equal(JSON.parse(f.disk()).operationId,original.operationId);cases++;
}
{
 const f=await fixture();f.options.beforeStart='rules.mutation.apply';f.options.gate=deferred();
 const write=f.rss.createSubscription(draft(80));await until(()=>f.calls.some(c=>c.method==='rules.mutation.apply'));
 f.retire();f.options.gate.resolve();await assert.rejects(write);assert.equal((await f.command('rss-source.list')).data.sources.length,0,'retirement after Runtime start wait stops actual dispatch');
 const cold=await fixture(f),query=await cold.recover();assert.equal(query.original.canRetryOriginal,true);assert.equal(cold.writes().length,0);cases++;
}
{
 const f=await fixture();f.options.pauseMethod='rules.mutation.apply';f.options.gate=deferred();
 const write=f.rss.createSubscription(draft(90));await until(()=>f.calls.some(c=>c.method==='rules.mutation.apply'));
 const original=JSON.parse(f.disk());f.retire();const cold=await fixture(f),query=await cold.recover();
 await cold.recover(query.original,true);f.options.gate.resolve();await write;
 assert.equal((await cold.rss.loadSubscriptions()).length,1,'late original transport and explicit same ID share actual Core dedup');
 assert.equal(cold.disk(),'','retired writer cannot restore its old journal over successor cleanup');assert.equal(cold.writes()[0].params.operationId,original.operationId);cases++;
}
{
 const f=await fixture();f.options.capability=false;
 await f.rss.createSubscription(draft(95));assert.equal(f.writes().length,0);
 assert.equal(f.calls.filter(c=>c.method==='rss-source.put').length,1,'old Core keeps its original admitted RPC');
 assert.equal(f.rss.originalMutationSnapshot(),undefined);assert.deepEqual(await f.recover(),{});cases++;
}
{
 const f=await fixture();f.options.beforeMethod='rules.mutation.apply';await assert.rejects(f.rss.updateSubscriptionEnabled('missing',false));
 const pending=(await f.recover()).original;assert.equal(pending.canRetryOriginal,true);
 const rejected=await f.recover(pending,true);assert.equal(rejected.original.confirmation,'undispatched');
 assert.equal(rejected.original.blocked,false);assert.equal(rejected.original.canRetryOriginal,false);assert.equal(f.disk(),'');
 await f.rss.createSubscription(draft(96));assert.equal(f.owner.snapshot().confirmation,'confirmed','exact rejected terminal permits the next distinct accepted intent');cases++;
}
console.log(`RSS six finite original writes and import, actual SDK + Atomic + cold SQLite: PASS (${cases} groups).`);
