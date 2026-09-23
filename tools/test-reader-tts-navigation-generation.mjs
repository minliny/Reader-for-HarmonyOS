import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const Model=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderTtsSessionCoordinator.ts',import.meta.url),['seek','skipToAdjacent']);
function fixture(){
 const queue=[],published=[],spoken=[],core=[];
 let index=2;
 const owner=Object.assign(new Model(),{active:{plan:{},identity:{},input:{chapter:{}}},state:{status:'playing',positionGeneration:0},
  invalidateUtterance(){},nextGeneration:x=>x+1,setState(s){this.state=s;},stopHostTransportImmediately:()=>Promise.resolve(),
  enqueue(fn){queue.push(fn);return Promise.resolve();},isSessionCurrent:()=>true,
  gateway:{seek:async(_c,i)=>{core.push(['seek',i]);index=i;return {currentSliceIndex:index,state:'playing'};},
    skip:async()=>{core.push(['next']);return {currentSliceIndex:++index,state:'playing'};},
    previous:async()=>{core.push(['previous']);return {currentSliceIndex:--index,state:'playing'};}},
  applyCoreSnapshot(s){published.push({positionGeneration:this.state.positionGeneration,sliceIndex:s.currentSliceIndex});},
  requireSnapshotIndex:s=>s.currentSliceIndex,speakSlice:async(_a,i)=>{spoken.push(i);}});
 return {owner,queue,published,spoken,core};
}
{
 const f=fixture();f.owner.seek(0);f.owner.seek(3);for(const task of f.queue)await task();
 assert.deepEqual(f.published,[{positionGeneration:2,sliceIndex:3}]);assert.deepEqual(f.spoken,[3]);
}
for(const direction of ['next','previous']){
 const f=fixture();f.owner.skipToAdjacent(direction);f.owner.skipToAdjacent(direction);for(const task of f.queue)await task();
 assert.equal(f.core.length,2,'relative Core intents remain serialized');
 const index=direction==='next'?4:0;
 assert.deepEqual(f.published,[{positionGeneration:2,sliceIndex:index}]);assert.deepEqual(f.spoken,[index]);
}
{
 const f=fixture();let finish;
 f.owner.gateway.seek=(_c,i)=>new Promise(resolve=>{finish=()=>resolve({currentSliceIndex:i,state:'playing'});});
 f.owner.seek(0);const old=f.queue[0]();await Promise.resolve();
 f.owner.seek(3);finish();await old;assert.equal(f.published.length,0,'already-running old reply cannot borrow newer position generation');
}
console.log('TTS explicit navigation production methods: serialized Core intent, only latest position generation publishes/speaks, stale in-flight replies rejected PASS');
