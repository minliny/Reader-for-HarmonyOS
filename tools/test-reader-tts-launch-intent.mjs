import assert from 'node:assert/strict';
import { ReaderTtsSessionCoordinator } from '../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts';
import { chapter, canonicalRemoteContent, FakeGateway, FakeHost } from './lib/reader-tts-fixtures.mjs';
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
for(const stage of ['getConfig','selectEngine','probe','slice','play','setRate','activateAudioSession']){
 const gateway=new FakeGateway(),host=new FakeHost();const owner=stage in gateway?gateway:host;
 const original=owner[stage].bind(owner),entered=deferred(),gate=deferred();let first=true;
 owner[stage]=async(...args)=>{if(first){first=false;entered.resolve();await gate.promise;}return original(...args);};
 const progress=[];const coordinator=new ReaderTtsSessionCoordinator(gateway,host,async p=>progress.push(p));
 const starting=coordinator.start({chapter,content:canonicalRemoteContent,contentVersion:'test-'+stage,scalarPosition:0});
 await entered.promise;coordinator.setDesiredPlaying(false);gate.resolve();await starting;
 assert.equal(host.requests.length,0,stage+': no speech before user resumes');
 assert.equal(coordinator.getState().status,'paused',stage+': readyPaused');
 assert.equal(coordinator.getState().audioStarted,false);assert.deepEqual(progress,[]);
 assert.ok(!host.calls.includes('media:playing'),stage+': no false media playing state');
 await coordinator.resume();assert.equal(host.requests.length,1);assert.equal(coordinator.getState().status,'preparing');
 host.emit({type:'start',requestId:host.requests[0].requestId});await coordinator.whenSettled();
 assert.equal(coordinator.getState().status,'playing');await coordinator.stop('user');
}
// Two clicks during the native pause acknowledgement: newest desired state wins.
{
 const gateway=new FakeGateway(),host=new FakeHost(),entered=deferred(),gate=deferred();
 const pause=gateway.pause.bind(gateway);gateway.pause=async()=>{entered.resolve();await gate.promise;return pause();};
 const coordinator=new ReaderTtsSessionCoordinator(gateway,host);
 const starting=coordinator.start({chapter,content:canonicalRemoteContent,contentVersion:'double',scalarPosition:0},false);
 await entered.promise;coordinator.setDesiredPlaying(true);gate.resolve();await starting;
 assert.equal(host.requests.length,1);assert.equal(coordinator.getState().status,'preparing');await coordinator.stop('user');
}
console.log('PASS TTS launch intent at all 7 asynchronous preparation boundaries, readyPaused, resume, and two-click acknowledgement race');
