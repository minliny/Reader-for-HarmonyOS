import assert from 'node:assert/strict';
import { ReaderProgressProducerHost } from '../entry/src/main/ets/features/reading/ReaderProgressProducerHost.ts';
import { ReadingSessionProgressOwner } from '../entry/src/main/ets/features/reading/ReadingSessionProgressOwner.ts';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
const anchor=offset=>({chapterIndex:2,chapterOffset:offset,chapterProgress:offset/100,bodyVersion:'body-v1',processingVersion:'rules-v1'});
function fixture({cas=true}={}) {
  const host=new ReaderProgressProducerHost(),writes=[],receipts=[],effects=[],gates=[];
  const state={mounted:true,epoch:1,revision:1,offset:10,sourceId:'source',bookId:'book',readsFail:false};
  let row={bookId:'book',...anchor(0),updatedAt:1,locationRevision:'r1'},serial=Promise.resolve();
  const durable=new ReadingSessionProgressOwner({supportsCoreCapability:()=>cas,captureReadingContentValidity:()=>()=>true},
    'source','book',operation=>{const result=serial.then(operation);serial=result.catch(()=>{});return result;});
  const write=async(_title,target,_layout,current)=>{
    writes.push({...target});const gate=gates.shift();if(gate)await gate.promise;
    const effect=effects.shift();
    if(effect!=='lost-retired'&&!current())throw Error('retired-before-write');
    if(effect==='reject')throw Error('unknown before reply');
    row={bookId:'book',...target,updatedAt:row.updatedAt+1,locationRevision:`r${row.updatedAt+1}`};
    if(effect==='lost-unreadable')state.readsFail=true;
    if(effect==='lost'||effect==='lost-retired'||effect==='lost-unreadable')throw Error('reply lost after storage');return row;
  };
  const read=async()=>{if(state.readsFail)throw Error('read unavailable');return{kind:'restored',progress:row,progressRevision:`op:${row.updatedAt}`};};
  const gateway={runProgressCommitSerial:op=>durable.runSerial(op),loadProgress:read,
    resolveAndUpdateProgress:async(_book,title,target,layout,current)=>{
      const result=await write(title,target,layout,current);durable.noteCommitted();return result;
    },persistPresentedProgress:(_book,title,target,layout,admitted)=>durable.persistPresented(title,target,layout,{read,write},admitted)};
  const revisions=new WeakMap();let completed=0,settled=0;
  function capture() {
    const epoch=state.epoch,revision=state.revision,source=state.sourceId,book=state.bookId;
    const committed={...row,sourceId:source};
    const isOwner=()=>state.mounted&&state.epoch===epoch&&state.sourceId===source&&state.bookId===book;
    const intent={sourceId:source,bookId:book,title:'chapter',anchor:anchor(state.offset),layout:{viewportWidth:390,viewportHeight:844,fontScale:1},
      gateway,isOwner,isCurrent:()=>isOwner()&&state.revision===revision,committed:()=>committed,
      publish:stored=>receipts.push({...stored,sourceId:source})};
    revisions.set(intent,revision);return intent;
  }
  const deps=()=>({active:()=>state.mounted,capture,newerSample:intent=>revisions.get(intent)!==state.revision,
    completed:()=>completed++,settled:()=>settled++,failed(){},observationTimeoutMs:3});
  return{host,state,writes,receipts,effects,gates,gateway,durable,capture,deps,row:()=>row,
    changeRow:next=>{row=next;},completed:()=>completed,settled:()=>settled};
}
{
  const f=fixture(),gate=deferred();f.gates.push(gate);
  await assert.rejects(f.host.commitContinuous(f.deps()),/UNKNOWN/);
  assert.equal(f.host.continuousInFlight,true);const actual=f.host.continuousPromise;
  f.state.offset=60;f.state.revision++;
  await assert.rejects(f.host.commitContinuous(f.deps()),/UNKNOWN/);
  f.state.offset=90;f.state.revision++;
  await assert.rejects(f.host.commitContinuous(f.deps()),/UNKNOWN/);
  assert.equal(f.host.continuousPromise,actual);assert.equal(f.writes.length,1);
  gate.resolve();await actual;await settle();assert.deepEqual(f.writes.map(a=>a.chapterOffset),[10,90]);
  assert.equal(f.row().chapterOffset,90);assert.equal(f.receipts.at(-1).chapterOffset,90);
  assert.equal(f.host.continuousInFlight,false);
}
{
  const f=fixture();f.effects.push('lost');await f.host.commitContinuous(f.deps());
  assert.equal(f.writes.length,1);assert.equal(f.receipts.at(-1).chapterOffset,10);
  assert.equal(f.host.continuousUnknownTarget,undefined,'a real read confirms the stored target');
}
{
  const f=fixture();f.effects.push('lost-unreadable');
  await assert.rejects(f.host.commitContinuous(f.deps()),/UNKNOWN/);
  await assert.rejects(f.host.commitContinuous(f.deps()),/UNKNOWN/);assert.equal(f.writes.length,1);
  f.state.readsFail=false;f.changeRow({...f.row(),bodyVersion:'foreign-content'});
  await assert.rejects(f.host.commitContinuous(f.deps()),/UNKNOWN|FOREIGN/);assert.equal(f.writes.length,1,
    'matching scalar from another content version does not prove an unknown write');
  f.state.bookId='other';await assert.rejects(f.host.commitContinuous(f.deps()),/FOREIGN/);
  assert.equal(f.writes.length,1,'unknown scope cannot be reconciled against another book');
}
{
  const f=fixture(),gate=deferred();f.gates.push(gate);
  const pending=f.host.commitContinuous(f.deps());const actual=f.host.continuousPromise;
  await settle();f.state.mounted=false;f.host.retireContinuous();
  f.state.epoch++;f.state.mounted=true;f.state.offset=70;f.state.revision++;
  const newMount=f.host.commitContinuous(f.deps());assert.equal(f.host.continuousPromise,actual);
  gate.resolve();await Promise.all([pending,newMount]);await settle();
  assert.equal(f.receipts.some(r=>r.chapterOffset===10),false,'retired UI cannot publish its old receipt');
  assert.equal(f.receipts.at(-1).chapterOffset,70,'new lifecycle demand joins without an overlapping drain');
  assert.equal(f.settled(),1,'the finishing notification belongs to the current demand');
}
{
  const f=fixture(),gate=deferred();f.gates.push(gate);f.effects.push('lost-retired');
  const pending=f.host.commitContinuous(f.deps());await settle();
  f.state.mounted=false;f.host.retireContinuous();gate.resolve();await pending;
  assert.equal(f.host.continuousUnknownTarget.chapterOffset,10,
    'a retired dispatched write with a lost ACK retains its unknown receipt');
  assert.equal(f.receipts.length,0);
  f.state.epoch++;f.state.mounted=true;f.state.offset=70;f.state.revision++;
  await f.host.commitContinuous(f.deps());assert.deepEqual(f.writes.map(a=>a.chapterOffset),[10,70]);
  assert.equal(f.host.continuousUnknownTarget,undefined);
  assert.equal(f.receipts.at(-1).chapterOffset,70,'the new demand reconciles its predecessor before writing');
}
{
  const f=fixture(),gate=deferred();let entered=false;
  const intent=f.capture();intent.gateway={...f.gateway,persistPresentedProgress:(_b,title,target,layout,admitted)=>
    f.durable.persistPresented(title,target,layout,{
      read:async()=>{entered=true;await gate.promise;return{kind:'restored',progress:f.row(),progressRevision:`op:${f.row().updatedAt}`};},
      write:(title,anchor,layout,current)=>f.gateway.resolveAndUpdateProgress('book',title,anchor,layout,current),
    },admitted)};
  const pending=f.host.commitTts(intent);await settle();assert.equal(entered,true);
  f.state.epoch++;gate.resolve();await pending;assert.equal(f.writes.length,0,
    'retired TTS selection cannot dispatch after waiting in the shared serial lane');
}
{
  const f=fixture(),gate=deferred();f.gates.push(gate);
  const pending=f.host.commitVisible(f.capture());await settle();assert.equal(f.writes.length,1);
  f.state.mounted=false;f.state.epoch++;gate.resolve();await pending;
  assert.equal(f.row().chapterOffset,10,'accepted exit-visible durable write survives UI retirement');
  assert.equal(f.receipts.length,0,'the old exit-visible publisher cannot resurrect a retired UI');
  assert.equal(f.durable.pendingProgress(),undefined);
}
{
  const f=fixture(),gate=deferred();f.gates.push(gate);f.effects.push('lost-retired');
  const pending=f.host.commitVisible(f.capture());await settle();assert.equal(f.writes.length,1);
  f.state.mounted=false;f.state.epoch++;gate.resolve();await assert.rejects(pending,/reply lost/);
  assert.equal(f.durable.pendingProgress().progress.chapterOffset,10,
    'UI retirement cannot erase the dispatched exit-visible unknown intent');
  const confirmed=await f.durable.awaitPersistence();
  assert.equal(confirmed.chapterOffset,10,'the durable owner uses its CAS receipt to reconcile after retirement');
  assert.equal(f.writes.length,1,'confirmed lost ACK recovery does not dispatch a duplicate write');
  assert.equal(f.receipts.length,0);assert.equal(f.durable.pendingProgress(),undefined);
}
{
  const f=fixture({cas:false});f.effects.push('lost');
  await assert.rejects(f.host.commitContinuous(f.deps()),/UNKNOWN/);
  await assert.rejects(f.host.commitContinuous(f.deps()),/UNKNOWN/);
  assert.equal(f.writes.length,1,'legacy unknown stays read-only; a matching target cannot authorize rewriting');
  await assert.rejects(f.durable.awaitPersistence(),/CAS_REQUIRED/);assert.equal(f.writes.length,1);
}
{
  const f=fixture(),gate=deferred();f.gates.push(gate);
  const pending=f.host.persistPresented(f.capture(),'PRESENTED_MISMATCH');await settle();
  f.state.mounted=false;gate.resolve();await pending;
  assert.equal(f.row().chapterOffset,10,'existing durable owner survives the UI disappearing');
  assert.equal(f.receipts.length,0,'durable completion does not restore a retired page');
  assert.equal(f.durable.pendingProgress(),undefined);
}
{
  const f=fixture(),intent=f.capture();intent.gateway={...f.gateway,persistPresentedProgress:async()=>({...f.row(),bookId:'other',...anchor(10)})};
  await assert.rejects(f.host.persistPresented(intent,'PRESENTED_MISMATCH'),/PRESENTED_MISMATCH/);
  assert.equal(f.receipts.length,0);
  // Removing the real receipt check lets the foreign row through. The same
  // publisher assertion detects that omission; this is not a source regex test.
  f.host.requireExactReceipt=()=>{};await f.host.persistPresented(intent,'PRESENTED_MISMATCH');
  assert.throws(()=>assert.equal(f.receipts.length,0));
}
console.log('Reader progress producer host PASS: real session durable owner; bounded observer with retained drain; latest sample; lost ACK/read recovery; foreign version/book protection; retire/reentry; TTS baseline-read admission; dispatched exit-visible retirement/unknown CAS recovery; legacy unknown read-only; durable presented receipt without UI resurrection; omission control');
