import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {removalFixture} from './lib/bookshelf-removal-durable-probe.mjs';
import {deferred,until,ReaderWriteEvidence} from './lib/bookshelf-management-durable-probe.mjs';
const restart=f=>removalFixture({root:f.root,uuid:f.uuid()});
const target=(bookId,sourceId='local')=>({sourceId,bookId});
async function seed(f,targets=[target('a'),target('b')]) {
 for(const t of targets)await f.command('bookshelf.add',{...t,title:t.bookId,author:'作者'});
}
let cases=0;
for(const batch of [false,true]) {
 const f=await removalFixture();await seed(f);const targets=batch?[target('a'),target('missing'),target('a'),target('b')]:[target('a')];
 const outcome=batch?await f.flow.removeMany(targets):await f.flow.remove('local','a');
 assert.equal(outcome.receipt.receipt.confirmation,'confirmed');assert.equal(batch?outcome.removedCount:outcome.removed,batch?2:true);
 assert.deepEqual([...new Set(f.cleanup)].sort(),batch?['a','b','missing']:['a']);assert.equal(f.disk(),'');
 assert.equal(f.writes().length,1);assert.equal(f.writes()[0].params.mutation.method,batch?'bookshelf.removeBatch':'bookshelf.remove');
 assert.equal(f.writes()[0].options.shouldCancel,undefined);cases++;
}
for(const batch of [false,true])for(const lost of ['before','after']) {
 const f=await removalFixture();await seed(f);const method=batch?'bookshelf.removeBatch':'bookshelf.remove';f.options[lost+'Method']=method;
 const outcome=batch?await f.flow.removeMany([target('a'),target('b')]):await f.flow.remove('local','a');
 assert.equal(outcome.receipt.receipt.confirmation,'unknown');assert.equal(f.cleanup.length,0);
 const original=JSON.parse(f.disk()),cold=await restart(f),state=await cold.removal.recover(()=>true);
 assert.equal(state.confirmation,lost==='after'?'confirmed':'unknown');assert.equal(state.blocked,true);assert.equal(state.canContinueOriginal,true);
 assert.equal(cold.writes().length,0,'cold exact query never dispatches a write');assert.equal(cold.cleanup.length,0,'pure reconciliation never releases assets');
 assert.equal(cold.queries()[0].params.operationId,original.operationId);assert.deepEqual(cold.queries()[0].params.expected.mutation,original.mutation);
 await assert.rejects(cold.gateway.createGroup('new',0),/原删除/);
 await cold.gateway.recoverWrites(()=>true,true);assert.equal(cold.cleanup.length,0,'management continuation cannot run removal');assert.equal(cold.writes().length,0);
 const done=await cold.removal.recover(()=>true,true);assert.equal(done.confirmation,'confirmed');assert.equal(done.blocked,false);assert.equal(cold.disk(),'');
 assert.equal(cold.writes().length,lost==='before'?1:0);if(lost==='before')assert.deepEqual(cold.writes()[0].params,{operationId:original.operationId,sequence:original.sequence,mutation:original.mutation});
 assert.deepEqual(cold.cleanup.sort(),batch?['a','b']:['a']);cases++;
}
{
 const f=await removalFixture();await seed(f);f.options.cleanupFail=true;const outcome=await f.flow.remove('local','a');
 assert.equal(outcome.removed,true,'asset failure cannot erase exact Core ACK');assert.equal(outcome.receipt.receipt.confirmation,'confirmed');assert.match(outcome.cleanupWarning,/busy/);
 assert.equal(f.store.snapshot().blocked,true);const intent=JSON.parse(f.disk());assert.equal(intent.terminal.outcome,'applied');
 const cold=await restart(f);await cold.removal.recover(()=>true);assert.equal(cold.cleanup.length,0);assert.equal(cold.writes().length,0);
 await cold.removal.recover(()=>true,true);assert.deepEqual(cold.cleanup,['a']);assert.equal(cold.disk(),'');cases++;
}
for(const corrupt of ['id','ack','partial','wrongset','duplicates']) {
 const f=await removalFixture();await seed(f);f.options.transformMethod='bookshelf.removeBatch';f.options.transform=value=>{
  const r=structuredClone(value);if(corrupt==='id')r.binding.operationId='wrong/1';if(corrupt==='ack')r.ackFingerprint='0'.repeat(64);
  if(corrupt==='partial')delete r.data.missingTargets;if(corrupt==='wrongset'){r.data.removedTargets=[target('alien')];r.data.uniqueCount=1;}
  if(corrupt==='duplicates')r.data.duplicateTargets=[target('b')];
  if(['partial','wrongset','duplicates'].includes(corrupt))r.ackFingerprint=createHash('sha256').update(JSON.stringify([r.method,r.outcome,r.data])).digest('hex');
  return r;
 };
 const out=await f.flow.removeMany([target('a'),target('b'),target('a')]);assert.equal(out.receipt.receipt.confirmation,'unknown');assert.equal(f.cleanup.length,0);
 const cold=await restart(f),state=await cold.removal.recover(()=>true);assert.equal(state.confirmation,'confirmed');assert.equal(cold.writes().length,0);assert.equal(cold.cleanup.length,0);cases++;
}
{
 const f=await removalFixture();await seed(f);f.options.beforeMethod='bookshelf.remove';await f.flow.remove('local','a');
 // A different legacy write can remove the same visible book. It is useful
 // membership information but cannot prove this original envelope's ACK.
 await f.command('bookshelf.remove',target('a'));
 const cold=await restart(f);assert.equal((await cold.removal.recover(()=>true)).confirmation,'unknown');assert.equal(cold.cleanup.length,0);cases++;
}
{
 const f=await removalFixture();await seed(f);f.options.beforeMethod='bookshelf.remove';await f.flow.remove('local','a');
 await f.command('bookshelf.management.mutation.apply',{operationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/1',sequence:1,mutation:{method:'book-group.create',params:{groupName:'other',order:0,show:true,enableRefresh:true}}});
 const cold=await restart(f),state=await cold.removal.recover(()=>true);assert.equal(state.confirmation,'unknown');assert.equal(state.canContinueOriginal,false);
 await cold.removal.recover(()=>true,true);assert.equal(cold.writes().length,0);assert.equal(cold.cleanup.length,0);assert.notEqual(cold.disk(),'');cases++;
}
for(const boundary of ['start','rename','sync']) {
 const f=await removalFixture();await seed(f);if(boundary==='start')f.options.beforeLocal=true;if(boundary==='rename')f.options.loseFinishAt=1;if(boundary==='sync')f.options.loseSyncAt=1;
 const evidence=new ReaderWriteEvidence();await assert.rejects(f.removal.remove([target('a')],false,evidence,()=>{}));assert.equal(f.writes().length,0);assert.equal(f.cleanup.length,0);
 await f.removal.recover(()=>true);assert.equal(f.writes().length,0);await f.removal.recover(()=>true,true);assert.equal(f.writes().length,1);cases++;
}
{
 const f=await removalFixture();await seed(f);const gate=deferred();f.options.beforeStart='bookshelf.remove';f.options.gate=gate;
 const pending=f.flow.remove('local','a');await until(()=>f.writes().length===1);f.retire();gate.resolve();await pending;
 assert.equal(f.writes()[0].dispatched,false);assert.equal(f.cleanup.length,0);assert.notEqual(f.disk(),'');cases++;
}
{
 const f=await removalFixture();await seed(f);const gate=deferred();f.options.pauseMethod='bookshelf.remove';f.options.gate=gate;
 const pending=f.flow.remove('local','a');await until(()=>f.writes().some(c=>c.dispatched));f.retire();gate.resolve();const outcome=await pending;
 assert.equal(outcome.receipt.receipt.confirmation,'confirmed');assert.equal(f.cleanup.length,0,'retired Runtime cannot release current/new assets');
 const cold=await restart(f);assert.equal((await cold.removal.recover(()=>true)).confirmation,'confirmed');assert.equal(cold.cleanup.length,0);cases++;
}
{
 const f=await removalFixture();await seed(f);const gate=deferred();f.options.cleanupGate=gate;
 const pending=f.flow.remove('local','a');await until(()=>f.cleanup.length===1);const next=f.gateway.createGroup('must-wait',0);
 const writes=f.writes().length;await new Promise(r=>setTimeout(r,15));assert.equal(f.writes().length,writes,'shared original IO lane reserves cleanup before a group write');
 gate.resolve();await pending;await next;assert.equal(f.writes().length,2);assert.equal(f.writes()[1].params.sequence,2);cases++;
}
{
 const f=await removalFixture();await seed(f);f.options.beforeMethod='book-group.create';await assert.rejects(f.gateway.createGroup('original group',0));
 const cold=await restart(f),state=await cold.removal.recover(()=>true,true);assert.equal(state.method,'book-group.create');assert.equal(state.confirmation,'unknown');assert.equal(cold.writes().length,0);assert.equal(cold.cleanup.length,0);cases++;
}
{
 const f=await removalFixture();await seed(f);const cached=f.Store.forRuntime(f.runtime);assert.equal(cached,f.store);assert.equal(new f.BookshelfRemovalGateway(f.runtime).snapshot().blocked,false);
 f.options.afterMethod='bookshelf.remove';await f.flow.remove('local','a');assert.equal(cached.snapshot().blocked,true);assert.equal(f.gateway.mutationSnapshot().operationId,cached.snapshot().operationId);
 const fresh=new f.Host(()=>{},()=>true);assert.equal(fresh.operations(f.runtime),new f.Host(()=>{},()=>true).operations(f.runtime));cases++;
}
console.log(`PASS bookshelf removal durable intent: ${cases} actual Atomic/SDK-class/cold Core SQLite groups`);
