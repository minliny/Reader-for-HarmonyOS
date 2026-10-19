import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"presentation-id": {"description": "Current SDK wrong/omitted physical presentation identity rejects IO", "resources": []}, "late-ack": {"description": "Current SDK accepted tail and lost ACK survive new presentation", "resources": []}, "runtime-cache": {"description": "Current SDK retired Runtime factory cannot replace successor", "resources": []}, "strip-diagnostic": {"description": "Explicit non-release strip-compiler comparison of the same owner scenarios", "resources": []}};
async function runCase(caseID){
const assert=(await import('node:assert/strict')).default;
const {fixture,compile,until,deferred,ReaderWriteEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
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

const {cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
console.log(JSON.stringify({kind:'durable-fixture-tool-evidence',...durableFixtureToolEvidence()}));
let passed=false;
try {
const handlers={
'presentation-id':async()=>{
const official=true;
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

},
'late-ack':async()=>{
const official=true;
    const f=await fixture(official),Host=orchestrator(f,official),h=Host.forRuntime(f.runtime),old=[],next=[],gate=deferred();
    h.attachPresentation('old',s=>old.push(s),()=>true);f.options.pauseMethod='rules.mutation.apply';f.options.gate=gate;f.options.afterMethod='rules.mutation.apply';
    h.saveDictRule(draft,'old');await until(()=>f.writes().length===1);const oldCount=old.length;
    h.detachPresentation('old');h.attachPresentation('next',s=>next.push(s),()=>true);const tail=h.operationTail;
    assert.equal(Host.forRuntime(f.runtime),h);assert.equal(h.operationTail,tail,'attachment cannot reset accepted drain');
    gate.resolve();await h.operationTail;assert.equal(old.length,oldCount);assert.ok(f.disk(),'accepted lost ACK survives presentation retirement');
    h.open('next');await h.operationTail;assert.equal(f.writes().length,1,'reopen only exact queries and refreshes');assert.equal(next.at(-1).ruleMutation.confirmation,'confirmed');
    assert.equal(f.disk(),'');h.saveDictRule(draft,'old');await h.operationTail;assert.equal(f.writes().length,1);cases++;

},
'runtime-cache':async()=>{
const official=true;
    const f=await fixture(official),Host=orchestrator(f,official),first=Host.forRuntime(f.runtime);first.attachPresentation('old',()=>{},()=>true);
    const successor={...f.runtime};f.install(successor);const next=Host.forRuntime(successor);assert.notEqual(next,first);
    assert.equal(Host.forRuntime(f.runtime),undefined,'retired lookup cannot replace successor shared cache');
    assert.equal(Host.forRuntime(successor),next);assert.equal(first.attachPresentation('late',()=>{},()=>true),false);
    assert.equal(next.attachPresentation('wrong',()=>{},()=>{throw Error('Runtime unavailable');}),false);cases++;

},
'strip-diagnostic':async()=>{
const official=false;
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

},
};await handlers[caseID]();passed=true;
} finally {const cleanup=await cleanupDurableFixtures({retain:!passed});if(!passed)console.error(JSON.stringify({kind:'reader-contract-retained-fixtures',...cleanup}));}
}
for(const id of selectContractCases(definitions)){await runCase(id);recordContractCasePass(id);}
