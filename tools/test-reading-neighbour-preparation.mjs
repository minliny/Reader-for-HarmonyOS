import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {ReadingChapterWindow}=await import('../entry/src/main/ets/features/reading/ReadingChapterWindow.ts');
const {ReadingSessionFlowGateway}=await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const Host=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),['prefetchNextChapter']);
const body=index=>({sourceId:'local',bookId:'b',chapterIndex:index,chapterTitle:`章${index}`,chapterUrl:undefined,
 content:'正文'.repeat(20),images:[],contentVersion:`v${index}`,extractionVia:'local'});
const tick=()=>new Promise(r=>setTimeout(r,0));
async function settled(f){for(let i=0;i<100;i++){if(!f.neighbourPreparationKey)return;await tick();}assert.fail('neighbours did not settle');}
for(const cancel of [false,true]){
 const window=new ReadingChapterWindow();window.configure('local','b',[10,20,30,40,50,60,70,80]);window.setCurrent(body(40));
 let valid=true,active=0,peak=0;const calls=[],prepared=[];
 const f=Object.assign(new Host(),{sourceId:'local',bookId:'b',chapterWindow:window,visiblePage:{startScalar:0},neighbourPreparationKey:'',
  isStableVisiblePageOwner:()=>valid,adjacentChapterIndex:(...a)=>window.adjacentChapterIndex(...a),
  activeGateway:()=>({async prefetchChapter(book,index,current){calls.push(index);peak=Math.max(peak,++active);await tick();active--;
   if(cancel)valid=false;return body(index);}}),retainCurrentChapterWindow(){},admitChapterContentVersion(){},
  queuePageTurnPreparation:d=>prepared.push(d),drainPageTurnPreparationQueue(){}});
 f.prefetchNextChapter(body(40),1,1);f.prefetchNextChapter(body(40),1,1);
 await settled(f);
 assert.equal(peak,1,'optional chapters must not flood the foreground');
 assert.deepEqual(calls,cancel?[50]:[50,30,60,20,70,10]);
 assert.deepEqual(prepared,cancel?[]:['next','previous'],'far chapters prepare bodies, not textures');
 assert.deepEqual(window.retainedChapterIndexes().sort((a,b)=>a-b),cancel?[40]:[10,20,30,40,50,60,70]);
}
// Local materialization uses the same read boundary and background request
// ownership, without loading progress, a directory, or images.
{
 const calls=[];let revision=1;
 const coordinator={readingProjectionRevision:()=>revision,async request(method,params,options,priority){
  calls.push({method,params,priority});return {data:{sourceId:'local',bookId:'b',chapterIndex:params.chapterIndex,chapterTitle:'章',content:'正文'}};
 }};
 const runtime={bookAcquisitions:()=>coordinator,request(){throw Error('bypassed shared scheduler');}};
 const gateway=new ReadingSessionFlowGateway('local','b',{kind:'local'},runtime);
 assert.equal((await gateway.prefetchChapter('b',2,()=>true)).chapterIndex,2);
 assert.deepEqual(calls.map(c=>[c.method,c.priority]),[['local_book.chapter.content','background']]);
 await assert.rejects(gateway.prefetchChapter('b',3,()=>false),/cancelled/);
 coordinator.request=async()=>{revision++;return{data:{sourceId:'local',bookId:'b',chapterIndex:3,chapterTitle:'章',content:'正文'}};};
 await assert.rejects(gateway.prefetchChapter('b',3,()=>true),/cancelled/);
}
console.log('neighbour preparation: near-first +/-3, one request, cancellation, body-only far window and background gateway PASS');
