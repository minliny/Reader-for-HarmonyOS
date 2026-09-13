import assert from 'node:assert/strict';
import { deriveReaderSessionCapsule, readerTtsSessionBlocksAutoPageStart } from '../entry/src/main/ets/features/reading/ReaderSessionCapsuleModel.ts';

const base={mounted:true,exitRequested:false,pageReady:true,controlObscured:false,interactionBlocked:false,
  controlVisible:false,autoPageStatus:'stopped',autoPageRemainingSeconds:8,ttsStatus:'idle'};
assert.equal(deriveReaderSessionCapsule(base),undefined);
for(const [status,state]of [['running','playing'],['paused','paused']]){
 assert.deepEqual(deriveReaderSessionCapsule({...base,autoPageStatus:status}),{type:'autoPage',sessionState:state,countdown:8});
}
for(const [status,state]of [['preparing','preparing'],['resuming','preparing'],['playing','playing'],['paused','paused'],['interrupted','paused']]){
 assert.deepEqual(deriveReaderSessionCapsule({...base,ttsStatus:status}),{type:'tts',sessionState:state,countdown:0});
}
for(const status of ['idle','stopping','stopped','failed'])assert.equal(deriveReaderSessionCapsule({...base,ttsStatus:status}),undefined);
for(const [flag,value]of [['mounted',false],['exitRequested',true],['pageReady',false],['controlObscured',true],['interactionBlocked',true],['controlVisible',true]]){
 assert.equal(deriveReaderSessionCapsule({...base,autoPageStatus:'running',[flag]:value}),undefined);
 assert.equal(deriveReaderSessionCapsule({...base,ttsStatus:'playing',[flag]:value}),undefined);
}
for(const [seconds,expected]of [[5.9,5],[-3,0],[NaN,0],[Infinity,0]]){
 assert.equal(deriveReaderSessionCapsule({...base,autoPageStatus:'running',autoPageRemainingSeconds:seconds}).countdown,expected);
}
for(const status of ['preparing','playing','paused','resuming','interrupted','stopping'])assert.equal(readerTtsSessionBlocksAutoPageStart(status),true);
for(const status of ['idle','stopped','failed'])assert.equal(readerTtsSessionBlocksAutoPageStart(status),false);
// Runtime projection remains separate from launch presentation. Track and
// ownership behavior is exercised against 48 raw Figma actors in launch tests.
console.log('reader session capsule projection: PASS');
