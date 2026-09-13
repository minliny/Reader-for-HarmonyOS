import assert from 'node:assert/strict';
import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts';
import { chapter,canonicalRemoteContent,FakeGateway,FakeHost } from './lib/reader-tts-fixtures.mjs';
const gateway=new FakeGateway(),host=new FakeHost(),progress=[];
const coordinator=new ReaderTtsSessionCoordinator(gateway,host,async p=>progress.push(p));
await coordinator.start({chapter,content:canonicalRemoteContent,contentVersion:'formal',scalarPosition:0});
host.emit({type:'start',requestId:host.requests.at(-1).requestId});await coordinator.whenSettled();
assert.equal(coordinator.getState().status,'playing');
const beforeCursor=gateway.cursor;const audition=coordinator.auditionVoice({engine:'http-tts:7',language:'zh-CN',person:1,rate:0.5});
await coordinator.whenSettled();const request=host.requests.at(-1);
assert.ok(request.requestId.includes('audition'));assert.equal(request.rate,0.5);assert.equal(coordinator.getState().status,'paused');
assert.equal(gateway.cursor,beforeCursor);assert.deepEqual(progress,[]);
host.emit({type:'start',requestId:request.requestId});host.emit({type:'complete',requestId:request.requestId,completion:'synthesis'});
await coordinator.whenSettled();assert.equal(coordinator.getState().status,'paused');
host.emit({type:'complete',requestId:request.requestId,completion:'audio'});await audition;
assert.equal(host.calls.at(-1),'engine:system');assert.deepEqual(progress,[]);assert.equal(gateway.cursor,beforeCursor);
// A second audition retires the first request; late completion cannot stop the new one.
const first=coordinator.auditionVoice({language:'zh-CN',person:0});await coordinator.whenSettled();const firstId=host.requests.at(-1).requestId;
const second=coordinator.auditionVoice({language:'en-US',person:2});await coordinator.whenSettled();await first;
const secondId=host.requests.at(-1).requestId;assert.notEqual(firstId,secondId);
const stops=host.calls.filter(x=>x==='stop').length;
host.emit({type:'complete',requestId:firstId,completion:'audio'});await coordinator.whenSettled();assert.equal(host.calls.filter(x=>x==='stop').length,stops);
await coordinator.stopAudition();await second;assert.equal(host.calls.at(-1),'engine:system');
// Failed preview restores the formal engine and retains its book/voice/progress.
const failed=coordinator.auditionVoice({engine:'http-tts:8',language:'zh-CN',person:1});const rejection=assert.rejects(failed,/preview failed/);
await coordinator.whenSettled();host.emit({type:'error',requestId:host.requests.at(-1).requestId,message:'preview failed'});await rejection;
assert.equal(host.calls.at(-1),'engine:system');assert.equal(coordinator.getState().status,'paused');assert.equal(gateway.cursor,beforeCursor);assert.deepEqual(progress,[]);
// Native interruption cancels preview, and a later formal resume owns the shared engine.
const interrupted=coordinator.auditionVoice({language:'zh-CN',person:1});await coordinator.whenSettled();host.emit({type:'deviceChange',action:'stop'});await interrupted;
await coordinator.resume();assert.ok(!host.requests.at(-1).requestId.includes('audition'));
await coordinator.dispose();
console.log('PASS audition/formal mutual exclusion, no Core progress, synthesis-vs-audio completion, stale callbacks, candidate failure restoration, cancel and resume');
// A missing native speak acceptance must not hold cancellation behind it.
const lostGateway = new FakeGateway(), lostHost = new FakeHost();
const lost = new ReaderTtsSessionCoordinator(lostGateway, lostHost, async () => assert.fail('audition never persists position'));
let releaseAcceptance;
lostHost.speak = async request => { lostHost.requests.push(request); await new Promise(resolve => releaseAcceptance = resolve); };
const preview = lost.auditionVoice({language:'zh-CN',person:0});
for(let i=0;i<100&&!releaseAcceptance;i++)await Promise.resolve();
assert.ok(releaseAcceptance, 'native speak actually started before cancellation');
let bounded;
await Promise.race([lost.stopAudition().then(()=>preview),new Promise((_,reject)=>bounded=setTimeout(()=>reject(Error('cancel blocked by missing speak ACK')),250))]).finally(()=>clearTimeout(bounded));
assert.equal(lostHost.calls.at(-1),'engine:system');
releaseAcceptance(); await lost.whenSettled();
await assert.rejects(lost.auditionVoice({language:'zh-CN',person:0,pitch:NaN}),/参数无效/);
await lost.dispose();
console.log('PASS missing native acceptance cannot block audition cancellation; invalid pitch fails before host mutation');
