import assert from 'node:assert/strict';
import { managementFixture, ReaderWriteEvidence, deferred, until } from './lib/bookshelf-management-durable-probe.mjs';
let cases=0;
const invoke=f=>f.gateway.createGroup('原分组',4);
const complete=async f=>{const evidence=new ReaderWriteEvidence();f.gateway.observeWrites(evidence,()=>f.Runtime.isCurrent(f.runtime));const result=await invoke(f);return{result,evidence};};
const restart=async f=>managementFixture({root:f.root,uuid:f.uuid()});
const book={sourceId:'s',bookId:'b',title:'书',author:'作者'};
async function seed(f){await f.command('bookshelf.add',book);const g=(await f.command('book-group.create',{groupName:'old',order:0,enableRefresh:true,show:true})).data.group;return g;}

for(const command of ['create','update','show','delete','assign']){
 const f=await managementFixture(),group=await seed(f),shelf=(await f.command('bookshelf.get',{sourceId:'s',bookId:'b'})).data.book;
 const evidence=new ReaderWriteEvidence();f.gateway.observeWrites(evidence,()=>true);
 let original;
 if(command==='create')original=()=>f.gateway.createGroup('中文分组',7);
 if(command==='update')original=()=>f.gateway.updateGroup(group,'更名',9);
 if(command==='show')original=()=>f.gateway.setGroupShown(group,false);
 if(command==='delete')original=()=>f.gateway.deleteGroup(group.groupId);
 if(command==='assign')original=()=>f.gateway.assignGroup(shelf,' old ');
 const method=command==='create'?'book-group.create':command==='delete'?'book-group.delete':command==='assign'?'bookshelf.group.assign':'book-group.update';
 f.options.afterMethod=method;await assert.rejects(original(),/lost ACK/);
 assert.equal(evidence.confirmation(),'unknown');assert.equal(f.store.snapshot().blocked,true);
 const intent=JSON.parse(f.disk());assert.equal(intent.mutation.method,method);assert.equal(f.writes().length,1);
 const cold=await restart(f),state=await cold.recover(false);
 assert.equal(state.confirmation,'confirmed',`${command} cold actual SQLite exact original receipt`);assert.equal(state.blocked,false);
 assert.equal(cold.writes().length,0,'pure cold recovery never repeats accepted write');assert.equal(cold.disk(),'');
 assert.equal(cold.queries()[0].params.operationId,intent.operationId);assert.deepEqual(cold.queries()[0].params.expected.mutation,intent.mutation);cases++;
}
{
 const f=await managementFixture(),{result,evidence}=await complete(f);assert.equal(result.groupName,'原分组');assert.equal(evidence.confirmation(),'confirmed');
 assert.equal(f.disk(),'');assert.equal(f.writes().length,1);assert.equal(f.writes()[0].options.shouldCancel,undefined);cases++;
}
{
 const f=await managementFixture();f.options.beforeMethod='book-group.create';await assert.rejects(invoke(f),/lost ACK/);
 const intent=JSON.parse(f.disk());
 // A different writer can independently produce the same visible name. This
 // is useful content, but it does not supply the original operation receipt.
 await f.command('book-group.create',{groupName:'原分组',order:4,enableRefresh:true,show:true});
 const cold=await restart(f),unknown=await cold.recover(false);assert.equal(unknown.confirmation,'unknown');assert.equal(unknown.canContinueOriginal,true);
 assert.equal(cold.writes().length,0);assert.notEqual(cold.disk(),'');await assert.rejects(cold.gateway.createGroup('另一项',0),/原分组/);
 const continued=await cold.recover(true);assert.equal(continued.confirmation,'confirmed');assert.equal(cold.writes().length,1);
 assert.equal(cold.writes()[0].params.operationId,intent.operationId);assert.deepEqual(cold.writes()[0].params.mutation,intent.mutation);
 assert.equal(cold.writes()[0].params.sequence,intent.sequence,'explicit continuation is original qualified ID and sequence');cases++;
}
{
 const f=await managementFixture();f.options.beforeMethod='book-group.create';await assert.rejects(invoke(f));const intent=JSON.parse(f.disk());
 await f.command('bookshelf.management.mutation.apply',{operationId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/1',sequence:1,mutation:{method:'book-group.create',params:{groupName:'另一写者',order:1,enableRefresh:true,show:true}}});
 const cold=await restart(f),state=await cold.recover(false);assert.equal(state.confirmation,'unknown');assert.equal(state.canContinueOriginal,false);
 await assert.rejects(cold.recover(true),/尚无精确回执/);assert.equal(cold.writes().length,0);assert.equal(JSON.parse(cold.disk()).operationId,intent.operationId);cases++;
}
for(const boundary of ['start','rename','sync']){
 const f=await managementFixture();if(boundary==='start')f.options.beforeLocal=true;if(boundary==='rename')f.options.loseFinishAt=1;if(boundary==='sync')f.options.loseSyncAt=1;
 await assert.rejects(invoke(f));assert.equal(f.writes().length,0,`${boundary} fsync admission must precede any Core write`);
 assert.equal(f.store.snapshot().blocked,true);const warm=await f.recover(false);assert.equal(warm.confirmation,'unknown');assert.equal(warm.canContinueOriginal,true);
 const original=JSON.parse(f.disk()||JSON.stringify({operationId:warm.operationId}));
 await f.recover(true);assert.equal(f.writes().length,1);assert.equal(f.writes()[0].params.operationId,original.operationId);cases++;
}
for(const corrupt of ['id','data','fingerprint','partial']){
 const f=await managementFixture();f.options.transformMethod='book-group.create';f.options.transform=value=>{
  const receipt=structuredClone(value);if(corrupt==='id')receipt.binding.operationId='wrong/1';if(corrupt==='data')receipt.data.group.groupName='错误值';
  if(corrupt==='fingerprint')receipt.ackFingerprint='0'.repeat(64);if(corrupt==='partial')delete receipt.data.group;return receipt;
 };
 await assert.rejects(invoke(f));assert.equal(f.store.snapshot().confirmation,'unknown');assert.equal(f.store.snapshot().blocked,true);
 const cold=await restart(f),state=await cold.recover(false);assert.equal(state.confirmation,'confirmed','bad wire payload never replaces real exact ACK');
 assert.equal(cold.writes().length,0);cases++;
}
for(const corrupt of ['head','qualification','tuple']){
 const f=await managementFixture();f.options.beforeMethod='book-group.create';await assert.rejects(invoke(f));const cold=await restart(f);
 cold.options.transformMethod='bookshelf.management.mutation.query';cold.options.transform=value=>{
  const data=structuredClone(value);if(corrupt==='head')data.head={operationId:'other',sequence:10,payloadFingerprint:'0'.repeat(64)};
  if(corrupt==='qualification')data.canApplySameOriginal='true';if(corrupt==='tuple')data.receipt={binding:{operationId:'wrong',sequence:1,payloadFingerprint:'0'.repeat(64)},method:'book-group.create',outcome:'applied',data:{},ackFingerprint:'0'.repeat(64)};return data;
 };
 await assert.rejects(cold.recover(false));assert.equal(cold.store.snapshot().blocked,true);assert.equal(cold.writes().length,0);assert.notEqual(cold.disk(),'');cases++;
}
{
 const f=await managementFixture();f.options.beforeMethod='book-group.create';await assert.rejects(invoke(f));const intent=JSON.parse(f.disk());intent.mutation.params.groupName='篡改';f.writeDisk(JSON.stringify(intent));
 const cold=await restart(f);await assert.rejects(cold.recover(false),/完整内容校验/);assert.equal(cold.store.snapshot().confirmation,'unknown','untrusted old durable record cannot claim non-dispatch');await assert.rejects(cold.gateway.createGroup('新写',0));assert.equal(cold.writes().length,0);cases++;
}
{
 const f=await managementFixture();f.options.capability=false;await assert.rejects(invoke(f),/缺少.*精确回执/);assert.equal(f.writes().length,0);assert.equal(f.store.snapshot().blocked,true);cases++;
}
{
 const f=await managementFixture(),gate=deferred();f.options.beforeStart='book-group.create';f.options.gate=gate;
 let live=true;f.gateway.observeWrites(new ReaderWriteEvidence(),()=>live);const pending=invoke(f);await until(()=>f.writes().length===1);live=false;gate.resolve();await assert.rejects(pending,/admission denied/);
 assert.equal(f.store.snapshot().confirmation,'undispatched');assert.equal(f.store.snapshot().blocked,false);assert.equal(f.disk(),'');assert.equal((await f.command('book-group.list',{})).data.groups.length,0);cases++;
}
{
 const f=await managementFixture(),gate=deferred(),evidence=new ReaderWriteEvidence();f.gateway.observeWrites(evidence,()=>true);
 f.options.pauseMethod='book-group.create';f.options.gate=gate;const pending=invoke(f);await until(()=>evidence.confirmation()==='unknown');f.retire();gate.resolve();await pending;
 assert.equal(evidence.confirmation(),'confirmed','accepted late ACK remains original business truth');assert.equal(f.store.snapshot().confirmation,'confirmed');assert.equal(f.store.snapshot().blocked,true);
 const cold=await restart(f),state=await cold.recover(false);assert.equal(state.confirmation,'confirmed');assert.equal(cold.writes().length,0);assert.equal(cold.disk(),'');cases++;
}
{
 const f=await managementFixture();f.options.loseFinishAt=2;await invoke(f);assert.equal(f.store.snapshot().confirmation,'confirmed');assert.equal(f.store.snapshot().blocked,true);
 const cold=await restart(f);const s=await cold.recover(false);assert.equal(s.confirmation,'confirmed');assert.equal(s.blocked,false);assert.equal(cold.writes().length,0);cases++;
}
{
 const f=await managementFixture(),evidence=new ReaderWriteEvidence();
 await assert.rejects(f.store.execute('book-group.update',{groupId:9999,groupName:'不存在的分组'},()=>{throw Error('rejected must not qualify as applied');},evidence,()=>true),/group|分组/);
 assert.equal(evidence.confirmation(),'undispatched');assert.equal(f.store.snapshot().blocked,false);assert.equal(f.disk(),'');cases++;
}
console.log(`PASS ${cases} actual Management Gateway/Store/Atomic fsync + cold CoreSQLite exact receipts: five intents, lost ACK, preserved original DTO, query-only, explicit same-ID continuation, corrupt payload/record/head, qualified rejection, last dispatch, Runtime retirement and terminal cleanup.`);
