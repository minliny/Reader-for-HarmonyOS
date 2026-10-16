import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { ReadingRecordIntent, ReadingRecordRecoveryError } from '../entry/src/main/ets/features/reading/ReaderReadingRecordState.ts';
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) {
  if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error;
} } });
const { ReaderReadingRecordHost } = await import('../entry/src/main/ets/features/reading/ReaderReadingRecordHost.ts');

import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const dir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const gatewaySource = readFileSync(new URL('ReadingRecordGateway.ts', dir), 'utf8');
let activeRuntime, storeFactory, ids = 0;
const loadGateway = source => new Function('preferences', 'util', 'ReaderRuntimeOwner', 'ReadingRecordIntent', 'ReadingRecordRecoveryError',
  `${stripTypeScriptTypes(source.replace(/^import[^\n]*\n/gm, '')).replace('export class ', 'class ')}; return ReadingRecordGateway;`)
  ({ getPreferences: () => storeFactory() }, { generateRandomUUID: () => `actual-intent-${++ids}` },
    { isCurrent: owner => owner === activeRuntime }, ReadingRecordIntent, ReadingRecordRecoveryError);
const Gateway = loadGateway(gatewaySource);
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const settle = async () => { for (let i=0;i<8;i++) await new Promise(done=>setImmediate(done)); };
function nativeReceipt(params) { return { ...params, author: '', record: { deviceId:params.deviceId, bookName:params.bookName,
  readTime:params.elapsedMillis, lastRead:params.readAt } }; }
function fixture(GatewayClass = Gateway) {
  let head = null, throwWrite = false, hangWrite, flushFailure, flushGate, rejectJournalPut = false, eraseJournalOnFlushFailure = false, diskUnavailable = false;
  const cache = new Map([['device-id','harmony-device']]), events = [], writes = [];
  const store = { async get(key, fallback) { events.push(['get',key]); return cache.get(key) ?? fallback; },
    async put(key, value) { events.push(['put',key]);
      if (key === 'delta-journal-v1' && rejectJournalPut) { rejectJournalPut=false; throw Error('put rejected before side effect'); }
      cache.set(key,value); }, async flush() {
      const phase=JSON.parse(cache.get('delta-journal-v1')??'null')?.phase;
      events.push(['flush',phase]);
      if (diskUnavailable) throw Error('ENOSPC duration Preferences unavailable');
      if (flushGate) { const gate=flushGate; flushGate=undefined; await gate.promise; }
      if (flushFailure!==undefined && flushFailure===phase) { flushFailure=undefined;
        if (eraseJournalOnFlushFailure) { eraseJournalOnFlushFailure=false; cache.delete('delta-journal-v1'); }
        throw Error('lost Preferences flush ACK'); }
    } };
  const runtime = { getUIAbilityContext: () => ({}), async request(method,params,options) {
    events.push(['native',method]); assert.equal(options.timeoutMs,15000);
    if (method==='read-record.accumulate-receipt') return {data:{receipt:head}};
    assert.equal(method,'read-record.accumulate'); writes.push(params); head=nativeReceipt(params);
    if(hangWrite) { const gate=hangWrite; hangWrite=undefined; await gate.promise; }
    if(throwWrite) { throwWrite=false; throw Error('lost native write ACK'); }
    return {data:{record:head.record,receipt:head}};
  } };
  storeFactory=async()=>store; activeRuntime=runtime;
  const gateway=new GatewayClass(runtime);
  return {gateway,runtime,cache,events,writes,store,
    head:()=>head,setHead:value=>{head=value;},lostWrite:()=>{throwWrite=true;},hangWrite:gate=>{hangWrite=gate;},
    lostFlush:phase=>{flushFailure=phase;},hangFlush:gate=>{flushGate=gate;},
    rejectPutBeforeEffect:()=>{rejectJournalPut=true;},missingJournalAfterFlush:()=>{flushFailure='pending';eraseJournalOnFlushFailure=true;},
    journal:()=>JSON.parse(cache.get('delta-journal-v1')??'null'),
    outbox:()=>JSON.parse(cache.get('delta-outbox-v2')??'null'),diskUnavailable:value=>{diskUnavailable=value;},
    remount() { const next={...runtime}; activeRuntime=next; storeFactory=async()=>store; return new Gateway(next); },
  };
}
{
  const f=fixture();
  assert.deepEqual(await Promise.all([f.gateway.currentDeviceId(), f.gateway.currentDeviceId()]),
    ['harmony-device', 'harmony-device'], 'progress renewal reuses the record owner\'s existing persistent device identity');
  assert.equal(f.events.filter(([kind,key])=>kind==='get'&&key==='device-id').length,1,
    'concurrent consumers share the same device-ID load');
  assert.equal(f.events.some(([kind])=>kind==='native'||kind==='put'),false,
    'reading the existing identity does not create a progress/record mutation or a second UUID');
  const intent=f.gateway.createIntent('same-device',100,10);
  await f.gateway.accumulate(intent);
  assert.equal(f.writes[0].deviceId,'harmony-device');
  assert.equal(intent.deviceId,'harmony-device','record and progress callers retain the same device owner');
}
{
  const f=fixture();
  await f.gateway.currentDeviceId();
  const current=f.remount();
  assert.throws(()=>f.gateway.currentDeviceId(), ReadingRecordRecoveryError,
    'a retired record owner cannot lend its cached device identity to a new progress visit');
  assert.equal(await current.currentDeviceId(),'harmony-device','the current owner reuses the same persisted identity');
  assert.equal(f.writes.length,0);
}
{
  const start=gatewaySource.indexOf('      const head = await this.readHead();'),
    end=gatewaySource.indexOf('      const watermark = head?.sequence ?? 0;',start);
  assert.ok(start>0&&end>start);
  const old=loadGateway(gatewaySource.slice(0,start)+`      if (intent.sequence !== undefined || intent.operationId !== undefined) {
        throw new ReadingRecordRecoveryError('blocked', 'old assigned identity permanently blocked');
      }
      const head = await this.readHead();
`+gatewaySource.slice(end));
  const f=fixture(old), intent=f.gateway.createIntent('book',100,10);f.rejectPutBeforeEffect();
  await assert.rejects(f.gateway.accumulate(intent),e=>e.kind==='pending');
  await assert.rejects(f.gateway.accumulate(intent),e=>e.kind==='blocked',
    'old real production-method admission is a negative control: a recoverable put-before-effect failure falsely blocks retry');
  assert.equal(f.writes.length,0);
}
for (const failure of ['put-before-side-effect', 'lost-flush-missing-row']) {
  const f=fixture(), intent=f.gateway.createIntent('book',100,10);
  if (failure==='put-before-side-effect') f.rejectPutBeforeEffect(); else f.missingJournalAfterFlush();
  await assert.rejects(f.gateway.accumulate(intent),e=>e.kind==='pending');
  assert.equal(f.journal(),null);assert.equal(f.writes.length,0);
  const assigned={operationId:intent.operationId,sequence:intent.sequence,deviceId:intent.deviceId};
  assert.deepEqual(assigned,{operationId:'harmony-device/1',sequence:1,deviceId:'harmony-device'});
  await f.gateway.accumulate(intent);
  assert.equal(f.writes.length,1,'missing journal retries the same accepted native identity after read-only watermark admission');
  assert.deepEqual({operationId:intent.operationId,sequence:intent.sequence,deviceId:intent.deviceId},assigned);
  assert.equal(f.journal().phase,'confirmed');
}
for (const headCase of ['exact', 'higher', 'same-sequence-conflict']) {
  const f=fixture(), intent=f.gateway.createIntent('book',100,10);f.rejectPutBeforeEffect();
  await assert.rejects(f.gateway.accumulate(intent),e=>e.kind==='pending');
  const assigned={operationId:intent.operationId,sequence:intent.sequence,deviceId:intent.deviceId,
    bookName:intent.bookName,elapsedMillis:intent.elapsedMillis,readAt:intent.readAt};
  f.setHead(nativeReceipt(headCase==='exact'?assigned:headCase==='higher'?{...assigned,operationId:'harmony-device/2',sequence:2}:
    {...assigned,elapsedMillis:101}));
  if (headCase==='exact') {
    await f.gateway.accumulate(intent);assert.equal(f.journal().phase,'confirmed');
  } else {
    await assert.rejects(f.gateway.accumulate(intent),e=>e.kind==='blocked'&&
      (headCase==='higher'?/越过/.test(e.message):/不一致/.test(e.message)));
    assert.equal(f.journal(),null,'unknown/conflicting head never creates a false confirmed local record');
  }
  assert.equal(f.writes.length,0,'read-only exact receipt confirms, higher/conflicting receipt cannot re-dispatch');
}
for(const failure of ['native','pending','confirmed']) {
  const f=fixture(), intent=f.gateway.createIntent('book',100,10);
  if(failure==='native') f.lostWrite(); else f.lostFlush(failure);
  await assert.rejects(f.gateway.accumulate(intent),ReadingRecordRecoveryError);
  assert.equal(f.writes.length,failure==='pending'?0:1);
  const firstId=intent.operationId;
  await f.gateway.accumulate(intent);
  assert.equal(f.writes.length,1,'unknown ACK retries the same native identity or exact receipt, never a new delta');
  assert.equal(intent.operationId,firstId); assert.equal(f.journal().phase,'confirmed');
  assert.equal(f.cache.size,2,'one device ID plus one journal, not one row per interval');
}
{
  const f=fixture(), old=f.gateway.createIntent('old-book',100,10); f.lostWrite();
  await assert.rejects(f.gateway.accumulate(old));
  const next=f.remount(), intent=next.createIntent('new-book',50,20);
  await next.accumulate(intent);
  assert.equal(f.writes.length,2); assert.equal(f.writes[1].sequence,2);
  assert.equal(f.journal().acceptanceId,intent.acceptanceId);
  await assert.rejects(f.gateway.accumulate(old),ReadingRecordRecoveryError);
  assert.equal(f.journal().acceptanceId,intent.acceptanceId,'retired Runtime cannot clear/replace the current journal');
}
{
  const f=fixture(), gate=deferred(), old=f.gateway.createIntent('old',10,10);f.hangFlush(gate);
  const one=f.gateway.accumulate(old); const rejected=assert.rejects(one,ReadingRecordRecoveryError); await settle();
  const next=f.remount(), intent=next.createIntent('new',20,20), two=next.accumulate(intent);
  await settle(); assert.equal(f.writes.length,0,'cross-Runtime lane remains held until old IO really settles');
  gate.resolve(); await rejected; await two;
  assert.deepEqual(f.writes.map(x=>x.bookName),['old','new']);
  assert.equal(f.journal().acceptanceId,intent.acceptanceId);
}
{
  const f=fixture(), intent=f.gateway.createIntent('book',100,10); f.lostWrite(); await assert.rejects(f.gateway.accumulate(intent));
  const before=f.cache.get('delta-journal-v1');
  f.setHead(nativeReceipt({operationId:'harmony-device/2',sequence:2,deviceId:'harmony-device',bookName:'other',elapsedMillis:5,readAt:20}));
  await assert.rejects(f.gateway.accumulate(intent),e=>e.kind==='blocked'&&/越过/.test(e.message));
  assert.equal(f.writes.length,1,'a newer aggregate/head cannot prove or replay the old unknown delta');
  assert.equal(f.cache.get('delta-journal-v1'),before);
}
{
  const f=fixture(), intent=f.gateway.createIntent('book',100,10); f.lostFlush('pending'); await assert.rejects(f.gateway.accumulate(intent));
  const changed=new ReadingRecordIntent(intent.acceptanceId,'book',101,10);
  await assert.rejects(f.gateway.accumulate(changed),e=>e.kind==='blocked'&&/内容发生变化/.test(e.message));
  assert.equal(f.writes.length,0,'different payload cannot overwrite/dispatch an existing accepted identity');
}
{
  const f=fixture(); f.setHead(nativeReceipt({operationId:`harmony-device/${Number.MAX_SAFE_INTEGER}`,sequence:Number.MAX_SAFE_INTEGER,
    deviceId:'harmony-device',bookName:'book',elapsedMillis:1,readAt:1}));
  await assert.rejects(f.gateway.accumulate(f.gateway.createIntent('book',1,1)),e=>e.kind==='blocked'&&/上限/.test(e.message));
  assert.equal(f.writes.length,0); assert.equal(f.journal(),null);
}

// The actual producer transfers ownership without waiting for disk/Core.
// New elapsed time is durably staged even while the old Native ACK hangs.
{
  const f=fixture(), gate=deferred(), timers=new Map(); let time=100, timer=0, live=true;
  const host=new ReaderReadingRecordHost(f.gateway,()=> 'book',()=>{},()=>time,
    (callback,delay)=>{const id=++timer;timers.set(id,{callback,delay});return id;},id=>timers.delete(id));
  host.begin(()=>live); assert.equal([...timers.values()][0].delay,30000);
  time=200;host.capture(false);f.hangWrite(gate);
  await host.flushForExit();
  assert.equal([...timers.values()].some(x=>x.delay===15000),false,'no exit-facing receipt deadline');
  await settle();assert.equal(f.writes.length,1);assert.equal(f.journal().phase,'pending');
  host.pendingMillis=25;host.handoff();await settle();
  assert.equal(f.outbox().tail[0].elapsedMillis,25,'Native ACK does not hold the independent durable tail');
  for(let i=0;i<30;i++){host.pendingMillis=1;host.handoff();}
  await settle();assert.equal(f.outbox().tail.length,1);assert.equal(f.outbox().tail[0].elapsedMillis,55);
  host.begin(()=>live);time=250;host.retire();live=false;
  await settle();assert.equal(host.pendingMillis,0);assert.equal(f.outbox().tail[0].elapsedMillis,105,
    'forced retirement hands over fresh elapsed time instead of clearing it');
  gate.resolve();await f.gateway.recover();await settle();
  assert.deepEqual(f.writes.map(x=>x.elapsedMillis),[100,105]);
  assert.equal(f.gateway.recoveryState().pendingMillis,0);assert.equal(f.outbox().active,undefined);
  assert.equal(f.journal().phase,'confirmed');f.gateway.stopBackground();
}
{
  const f=fixture(), host=new ReaderReadingRecordHost(f.gateway,()=> 'book',()=>{});
  host.pendingMillis=100;f.lostWrite();await host.flushForExit();await settle();
  assert.match(f.gateway.recoveryState().lastError,/lost native write ACK/,'original failure remains queryable');
  const assigned={...f.writes[0]};f.gateway.stopBackground();
  // Simulate process death: only persisted v2 outbox/v1 journal survive.
  Gateway.retiredMemory=[];
  const next=f.remount();await next.recover();
  assert.equal(f.writes.length,1,'cold recovery confirms the existing exact receipt without duplicate accumulation');
  assert.equal(f.journal().operationId,assigned.operationId);assert.equal(f.journal().phase,'confirmed');
  assert.equal(next.recoveryState().pendingMillis,0);next.stopBackground();
}
{
  const f=fixture(), host=new ReaderReadingRecordHost(f.gateway,()=> 'book',()=>{});
  f.diskUnavailable(true);host.pendingMillis=90;await host.flushForExit();await settle();
  assert.equal(host.pendingMillis,0,'Runtime accepted ownership even when persistence is unavailable');
  assert.equal(f.writes.length,0,'no Core mutation before durable outbox staging');
  assert.equal(f.gateway.recoveryState().pendingMillis,90);assert.equal(f.gateway.recoveryState().durable,false);
  assert.match(f.gateway.recoveryState().lastError,/ENOSPC/);
  f.diskUnavailable(false);await f.gateway.recover();
  assert.equal(f.writes.length,1);assert.equal(f.writes[0].elapsedMillis,90);
  assert.equal(f.gateway.recoveryState().pendingMillis,0);assert.equal(f.gateway.recoveryState().lastError,'');
  f.gateway.stopBackground();
}
{
  const f=fixture(), gate=deferred();f.hangWrite(gate);
  f.gateway.handoff(f.gateway.createIntent('first',1,1));await settle();
  for(let i=0;i<130;i++) f.gateway.handoff(f.gateway.createIntent(`book-${i}`,2,i+2));
  await settle();
  const snapshot=f.outbox();assert.equal(snapshot.tail.length+1,128,'durable outbox has a hard entry limit');
  assert.equal(f.gateway.recoveryState().memoryOnlyBooks,3,'overflow remains explicit Runtime work, never a dropped delta');
  assert.equal(f.gateway.recoveryState().pendingMillis,261);assert.equal(f.gateway.recoveryState().durable,false);
  gate.resolve();await f.gateway.recover();
  assert.equal(f.writes.length,131);assert.equal(f.writes.reduce((total,x)=>total+x.elapsedMillis,0),261);
  assert.equal(f.gateway.recoveryState().pendingMillis,0);f.gateway.stopBackground();
}
{
  const f=fixture(), old=f.gateway.createIntent('legacy-v1',70,10);f.lostWrite();
  await assert.rejects(f.gateway.accumulate(old));assert.equal(f.outbox(),null);
  const next=f.remount();await next.recover();assert.equal(f.writes.length,1);
  assert.equal(f.journal().phase,'confirmed','startup recovers legacy v1 journals even without new UI elapsed time');
  next.stopBackground();
}
{
  const f=fixture(), gate=deferred();f.hangWrite(gate);
  f.gateway.handoff(f.gateway.createIntent('active',10,1));await settle();
  f.gateway.handoff(f.gateway.createIntent('tail',20,2));await settle();
  const older=f.cache.get('delta-outbox-v2');
  f.diskUnavailable(true);f.gateway.handoff(f.gateway.createIntent('tail',30,3));await settle();
  assert.equal(f.gateway.recoveryState().pendingMillis,60);
  f.gateway.stopBackground();f.cache.set('delta-outbox-v2',older);
  const next=f.remount();f.diskUnavailable(false);gate.resolve();await next.recover();
  assert.deepEqual(f.writes.map(x=>[x.bookName,x.elapsedMillis]),[['active',10],['tail',50]],
    'Runtime successor keeps the exact unknown active and latest unassigned tail after failed disk staging');
  assert.equal(next.recoveryState().pendingMillis,0);next.stopBackground();
}
for(const malformed of [false,'null','{"version":2,"tail":[{"acceptanceId":"x"}]}']) {
  const f=fixture();f.cache.set('delta-outbox-v2',malformed);
  f.gateway.handoff(f.gateway.createIntent('new',5,4));await f.gateway.recover();
  assert.equal(f.cache.get('delta-outbox-v2'),malformed,'corrupt outbox is retained instead of being overwritten');
  assert.equal(f.writes.length,0);assert.equal(f.gateway.recoveryState().pendingMillis,5);
  assert.equal(f.gateway.recoveryState().durable,false);assert.ok(f.gateway.recoveryState().lastError.length>0);
  f.gateway.stopBackground();Gateway.retiredMemory=[];
}
{
  const f=fixture(),gate=deferred(),events=[],host=new ReaderReadingRecordHost(f.gateway,()=> 'exit-book',()=>{});
  host.pendingMillis=80;f.hangWrite(gate);
  const Reader=productionMotionMethods(new URL('LocalReadingExperience.ets',dir),['finishExit'],
    {hilog:{warn(){},error(){}}});
  const reader=Object.assign(new Reader(),{readingRecordHost:host,lifecycleToken:1,exitAttemptGeneration:1,exitDelivered:false,
    handoffExitProgress:()=>events.push('progress-handoff'),isMountedToken:token=>token===1,
    retainConfirmedEntryPresentation(){},onExit:()=>events.push('exit'),errorMessage:String,
    showReaderAlert:()=>assert.fail('duration uncertainty must never open a modal')});
  const exiting=reader.finishExit(1);
  assert.deepEqual(events,['progress-handoff','exit'],'actual route exit is delivered in the same UI turn');
  await exiting;await settle();assert.equal(f.writes.length,1);assert.equal(f.journal().phase,'pending');
  host.retire();gate.resolve();await f.gateway.recover();assert.equal(f.journal().phase,'confirmed');
  f.gateway.stopBackground();
}
console.log('PASS actual duration Host/Gateway: exact v1 receipt identity, independent bounded durable outbox, cold/legacy recovery, unknown ACK, nonblocking exit/retirement, merged tail, disk failure recovery and explicit capacity overflow.');
