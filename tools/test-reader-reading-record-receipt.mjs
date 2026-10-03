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
  let head = null, throwWrite = false, hangWrite, flushFailure, flushGate, rejectJournalPut = false, eraseJournalOnFlushFailure = false;
  const cache = new Map([['device-id','harmony-device']]), events = [], writes = [];
  const store = { async get(key, fallback) { events.push(['get',key]); return cache.get(key) ?? fallback; },
    async put(key, value) { events.push(['put',key]);
      if (key === 'delta-journal-v1' && rejectJournalPut) { rejectJournalPut=false; throw Error('put rejected before side effect'); }
      cache.set(key,value); }, async flush() {
      const phase=JSON.parse(cache.get('delta-journal-v1')??'null')?.phase;
      events.push(['flush',phase]);
      if (flushGate) { const gate=flushGate; flushGate=undefined; await gate.promise; }
      if (flushFailure===phase) { flushFailure=undefined;
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
    remount() { const next={...runtime}; activeRuntime=next; storeFactory=async()=>store; return new Gateway(next); },
  };
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

// The real producer owns the real clock, one accepted delta and the real
// gateway. Native result delivery is controlled here, not a reimplemented CAS.
{
  const f=fixture(), gate=deferred(), timers=new Map(); let time=100, timer=0, live=true;
  const host=new ReaderReadingRecordHost(f.gateway,()=> 'book',()=>{},()=>time,
    (callback,delay)=>{const id=++timer;timers.set(id,{callback,delay});return id;},id=>timers.delete(id));
  host.begin(()=>live); const periodic=[...timers.values()][0]; assert.equal(periodic.delay,30000);
  time=200;host.capture(false);f.hangWrite(gate);
  const exiting=host.flushForExit(); const deadline=[...timers.values()].find(x=>x.delay===15000);
  const expired=assert.rejects(exiting,ReadingRecordRecoveryError);
  await settle(); assert.equal(f.writes.length,1);
  const before=host.flush(); assert.equal(host.flush(),before,'periodic/exit retries coalesce while actual durable tail is pending');
  deadline.callback(); await expired;
  assert.equal(f.journal().phase,'pending'); assert.equal(f.writes.length,1);
  host.retire();live=false;gate.resolve();await before;
  assert.equal(f.journal().phase,'confirmed','retired presentation never cancels an already dispatched accepted delta');
  assert.equal(host.pendingMillis,0);
}
{
  const f=fixture(), host=new ReaderReadingRecordHost(f.gateway,()=> 'book',()=>{});
  host.pendingMillis=100;f.lostWrite();await assert.rejects(host.flushForExit(),ReadingRecordRecoveryError);
  await host.flushForExit(); assert.equal(f.writes.length,1,'retry is not a second elapsed-time accumulation');
}
{
  const f=fixture(), events=[], host=new ReaderReadingRecordHost(f.gateway,()=> 'book',()=>{});
  host.pendingMillis=100;f.lostWrite();
  const Reader=productionMotionMethods(new URL('LocalReadingExperience.ets',dir),['finishExit','flushReadingRecordForExit'],
    {ReadingRecordRecoveryError,hilog:{warn(){}}});
  let notice;
  const owner=Object.assign(new Reader(),{readingRecordHost:host,mounted:true,lifecycleToken:1,chapterSelectionToken:1,
    exitRequested:true,exitAttemptGeneration:1,exitDelivered:false,readerSettingsSnapshot:{navigationMode:'paged'},
    getUIContext:()=>({showAlertDialog:spec=>{notice=spec;}}),awaitOrdinaryFirstPagePersistence:async()=>{},
    commitVisiblePage:async()=>events.push('progress'),retainConfirmedEntryPresentation(){},
    onExit:()=>events.push('exit'),onExitCancelled:()=>events.push('cancel'),beginReadingRecordClock:()=>events.push('clock')});
  await owner.finishExit(1);assert.equal(notice.title,'阅读时长尚未确认');assert.deepEqual(events,[]);
  assert.equal(owner.exitDelivered,false,'unconfirmed duration cannot pass the old swallowed-catch exit');
  notice.secondaryButton.action();assert.deepEqual(events,['cancel','clock']);
  owner.exitRequested=true;owner.exitAttemptGeneration++;
  await owner.finishExit(1);assert.deepEqual(events,['cancel','clock','progress','exit']);
  assert.equal(f.writes.length,1);
}
console.log('PASS actual reading duration Host/Gateway/LRE: fixed journal, native/lost Preferences ACK, cold/current Runtime, cross-owner IO serialization, safe sequence, superseded unknown block, coalesced bounded exit and exact receipt retry; actual SQLite atomic/dedup tests are separate.');
