import assert from 'node:assert/strict';
import {fixture,compile,until,deferred,ReaderWriteEvidence} from './lib/rules-mutation-durable-probe.mjs';
const facts=await import('../entry/src/main/ets/app/ReaderOperationFacts.ts');
const projection=await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
function orchestrator(f,official){
  const Source=compile('features/source/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner:f.Runtime},official);
  return compile('features/settings/RulesManagementOrchestrator.ets','RulesManagementOrchestrator',
    {ReaderRuntimeOwner:f.Runtime,ReaderWriteEvidence,RulesManagementGateway:f.Gateway,SourceGateway:Source,
      RssGateway:class{observeWrites(){}},...facts,...projection,hilog:{error(){}}},official);
}
const draft={name:'dict',urlRule:'https://dict.invalid/{{key}}',showRule:'$.definition',enabled:true,sortNumber:0};
let cases=0;
for(const official of [false,true]){
  {
    const f=await fixture(official),Host=orchestrator(f,official),h=Host.forRuntime(f.runtime),events=[];
    assert.equal(Host.forRuntime(f.runtime),h,'same actual Runtime preserves original Tail and receipt owner');
    assert.equal(h.attachPresentation('old',s=>events.push(s),()=>true),true);
    h.saveDictRule(draft,'wrong');h.open('wrong');h.reconcile(1,'wrong');h.exportBundle('wrong');h.importBundle(undefined,'wrong');
    await h.operationTail;assert.equal(f.calls.length,0,'wrong physical lease performs no read/write/download');
    const receipt=h.latestReceipt;assert.equal(h.attachPresentation('new',s=>events.push(s),()=>true),true);
    h.detachPresentation('old');h.saveDictRule(draft,'old');await h.operationTail;assert.equal(f.calls.length,0);
    h.saveDictRule(draft,'new');await h.operationTail;assert.equal(f.writes().length,1);assert.equal(events.at(-1).receipt.receipt.confirmation,'confirmed');
    assert.notEqual(h.latestReceipt,receipt);const currentReceipt=h.latestReceipt;
    h.detachPresentation('new');assert.equal(h.attachPresentation('third',s=>events.push(s),()=>true),true);assert.equal(h.latestReceipt,currentReceipt);
    h.saveDictRule(draft);await h.operationTail;assert.equal(f.writes().length,1,'omitted ID cannot borrow a shared presentation');cases++;
  }
  {
    const f=await fixture(official),Host=orchestrator(f,official),h=Host.forRuntime(f.runtime),old=[],next=[],gate=deferred();
    h.attachPresentation('old',s=>old.push(s),()=>true);f.options.pauseMethod='rules.mutation.apply';f.options.gate=gate;f.options.afterMethod='rules.mutation.apply';
    h.saveDictRule(draft,'old');await until(()=>f.writes().length===1);const oldCount=old.length;
    h.detachPresentation('old');h.attachPresentation('next',s=>next.push(s),()=>true);const tail=h.operationTail;
    assert.equal(Host.forRuntime(f.runtime),h);assert.equal(h.operationTail,tail,'attachment cannot reset accepted drain');
    gate.resolve();await h.operationTail;assert.equal(old.length,oldCount);assert.ok(f.disk(),'accepted lost ACK survives presentation retirement');
    h.open('next');await h.operationTail;assert.equal(f.writes().length,1,'reopen only exact queries and refreshes');assert.equal(next.at(-1).ruleMutation.confirmation,'confirmed');
    assert.equal(f.disk(),'');h.saveDictRule(draft,'old');await h.operationTail;assert.equal(f.writes().length,1);cases++;
  }
  {
    const f=await fixture(official),Host=orchestrator(f,official),first=Host.forRuntime(f.runtime);first.attachPresentation('old',()=>{},()=>true);
    const successor={...f.runtime};f.install(successor);const next=Host.forRuntime(successor);assert.notEqual(next,first);
    assert.equal(Host.forRuntime(f.runtime),undefined,'retired lookup cannot replace successor shared cache');
    assert.equal(Host.forRuntime(successor),next);assert.equal(first.attachPresentation('late',()=>{},()=>true),false);
    assert.equal(next.attachPresentation('wrong',()=>{},()=>{throw Error('Runtime unavailable');}),false);cases++;
  }
}
console.log(`PASS ${cases} actual Rules Orchestrator/shared authority/cold SQLite + SDK presentation lease journeys; legacy constructor remains compatible, Index physical consumption is a separate gate.`);
