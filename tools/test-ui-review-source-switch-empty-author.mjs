import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({'durable-empty-author':'Actual Gateway four receipt consumers and Host exact recovery accept required empty string; malformed fields and wrong identities remain rejected.'});
if(!selected.length)process.exit(0);
const {Gateway,fixture,settle,rawCandidate,session,target}=await import('./lib/source-switch-owner-probe.mjs');
const {ReaderWriteEvidence}=await import('../entry/src/main/ets/app/ReaderWriteEvidence.ts');
const operationId='empty-author/1';
const matchedChapter={chapterId:'chapter-0',chapterTitle:'Chapter 0',chapterUrl:'chapter-0',order:0};
const from={sourceId:'old',bookId:'old-book'},to={sourceId:'new',bookId:'new-book'};
const params={operationId,sequence:1,from,target:{...to,title:'Book',author:''},newToc:[matchedChapter],currentChapterTitle:'Chapter 0',currentChapterIndex:0,updatedAt:1};
const book=identity=>({...identity,title:'Book',author:'',addedAt:1});
async function receipts(change=()=>{}){
  const calls=[];let phase='pending';
  const runtime={async request(method,input,options){
    calls.push(method);options?.onDispatch?.();
    const commit={transactionId:operationId,phase:'pending',book:book(to),matchedChapter};
    let data;
    if(method==='source.switch.commit')data=commit;
    else if(method==='source.switch.rollback')data={transactionId:operationId,phase:'rolledBack',changed:true,restoredBook:book(from)};
    else if(method==='source.switch.transaction.query')data={head:{operationId,sequence:1},transaction:{operationId,sequence:1,payloadFingerprint:'a'.repeat(64),from,target:to,phase,commit,...(phase==='rolledBack'?{restoredBook:book(from)}:{})}};
    else assert.fail(method);
    change(data,method);return{data};
  }};
  const gateway=new Gateway(runtime),evidence=new ReaderWriteEvidence();
  const committed=await gateway.commitSwitch(params,()=>true,evidence);
  assert.equal(committed.status,'success','required empty author must decode a successful durable commit');
  assert.equal(committed.book.author,'');assert.equal(evidence.confirmedCount,1);
  const pending=await gateway.queryTransaction(operationId,params);
  assert.equal(pending.transaction.commit.book.author,'');
  const rolled=await gateway.rollbackSwitch(operationId);
  assert.equal(rolled.restoredBook.author,'');phase='rolledBack';
  const terminal=await gateway.queryTransaction(operationId,params);
  assert.equal(terminal.transaction.restoredBook.author,'');
  assert.deepEqual(calls,['source.switch.commit','source.switch.transaction.query','source.switch.rollback','source.switch.transaction.query']);
}
async function malformed(){
  // Exercise each public consumer, not just requiredString in isolation.
  for(const field of ['author','sourceId','bookId','title'])for(const invalid of (field==='author'?[undefined,null,7,{},[]]:[''])){
    for(const consumer of ['commit','query-commit','rollback','query-rollback']){
      const runtime={async request(method){
        const commit={transactionId:operationId,phase:'pending',book:book(to),matchedChapter};
        let data=method==='source.switch.commit'?commit:method==='source.switch.rollback'?
          {transactionId:operationId,phase:'rolledBack',changed:true,restoredBook:book(from)}:
          {head:{operationId,sequence:1},transaction:{operationId,sequence:1,payloadFingerprint:'a'.repeat(64),from,target:to,phase:consumer==='query-rollback'?'rolledBack':'pending',commit,restoredBook:book(from)}};
        const affected=consumer==='commit'?data.book:consumer==='rollback'?data.restoredBook:
          consumer==='query-commit'?data.transaction.commit.book:data.transaction.restoredBook;
        affected[field]=invalid;return{data};
      }};
      const gateway=new Gateway(runtime);
      if(consumer==='commit')assert.equal((await gateway.commitSwitch(params)).status,'failed');
      else if(consumer==='rollback')await assert.rejects(gateway.rollbackSwitch(operationId),new RegExp(`invalid ${field}`));
      else await assert.rejects(gateway.queryTransaction(operationId,params),new RegExp(`invalid ${field}`));
    }
  }
  await assert.rejects(receipts((data,method)=>{if(method==='source.switch.transaction.query')data.transaction.commit.book.sourceId='other';}),/another|mismatched/);
}
async function owner(lostAck){
  const f=fixture({open:false,loseCommitAck:lostAck,targetSession:{...session,book:{...session.book,author:''}}});
  const base=f.runtime.request.bind(f.runtime);
  f.runtime.request=async(...args)=>{
    const result=await base(...args),data=structuredClone(result.data);
    for(const value of [data.book,data.restoredBook,data.transaction?.commit?.book,data.transaction?.restoredBook])if(value)value.author='';
    return{...result,data};
  };
  f.context.query.author='';f.setRows([{...rawCandidate,author:''}]);
  try{
    assert.equal(f.host.open(f.context,f.lease),true);await settle();
    assert.ok(f.candidate(),'normal acquisition produces an empty-author candidate');
    await f.host.pick(f.candidate(),f.host.current().scopeId);await settle();
    assert.equal(f.host.current().write.confirmation,'confirmed','exact same-operation recovery confirms a legal empty author');
    assert.equal(f.effects.at(-1).kind,'targetReady');assert.equal(f.effects.at(-1).book.author,'');
    assert.equal(f.calls.filter(([method])=>method==='source.switch.commit').length,1,'unknown ACK never replays the durable commit');
    f.setIdentity(target);f.host.bindReader({...f.context,query:{...f.context.query,sourceId:target.sourceId,bookId:target.bookId}},f.lease);
    f.options.loseRollbackAck=lostAck;
    await f.host.rollbackPending();await settle();
    assert.equal(f.host.current().write.confirmation,'confirmed');assert.equal(f.host.current().pending,undefined);
    assert.equal(f.effects.at(-1).kind,'rollbackReady');assert.equal(f.effects.at(-1).book.author,'');
    assert.equal(f.disk.durable,'','exact terminal receipt releases the original durable intent');
    assert.equal(f.calls.filter(([method])=>method==='source.switch.rollback').length,1);
  }finally{f.retire();await settle();}
}
for(const id of selected){
  await receipts();await malformed();await owner(false);await owner(true);
  const required=Gateway.prototype.requiredString;
  try{
    // Revert the single production call's allowEmpty behavior while keeping
    // every real receipt method and assertion above unchanged.
    Gateway.prototype.requiredString=function(value,key){return required.call(this,value,key,false);};
    await assert.rejects(receipts(),/required empty author must decode/);
  }finally{Gateway.prototype.requiredString=required;}
  console.log(JSON.stringify({kind:'source-switch-empty-author',consumers:4,hostAckPaths:['direct','lost-ACK-exact-query'],layer:'actual Gateway/Host/intent file owner, finite Core and OS ports; no device or native storage claim'}));
  recordContractCasePass(id);
}
