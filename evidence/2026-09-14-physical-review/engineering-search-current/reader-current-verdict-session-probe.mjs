import assert from 'node:assert/strict';
import { productionMotionMethods } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/lib/reader-motion-method-probe.mjs';
const path='/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/pages/Index.ets';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {resolve,reject,promise};};
const settle=async()=>{for(let i=0;i<4;i++)await new Promise(r=>setImmediate(r));};
const owner={};
const Index=productionMotionMethods(path,['refreshCachedSearchDetailInBackground','probeRemoteContentVerdict','openReading','isKnownDetailChapter','nextNavigationGeneration'],{
 ReaderRuntimeOwner:{current:()=>owner},ReadingOfflineGateway:class {},LOCAL_SOURCE_ID:'local',DOMAIN:0,
 remoteReadingFailureKindOf:e=>e.kind??'SOURCE_HTTP_FAILED',verdictForFailureKind:()=> 'networkFailed',
 hilog:{warn(){}}
});
function fixture(){
 const old={identity:{sourceId:'s',bookId:'b'},sourceVersion:'v1',book:{title:'书',author:'作者'},entries:[{index:0,title:'旧第一章',url:'/old/0'}]};
 const fresh={...old,entries:[{index:0,title:'新第一章',url:'/new/0'},{index:1,title:'新第二章',url:'/new/1'}]};
 const page=Object.assign(new Index(),{remoteReadingSession:old,remoteContentVerdict:'verifying',navigationGeneration:7,route:'detail',readingSessionActive:false,bookshelfRemovalActiveKey:'',detailInBookshelf:false,loadRemoteDirectoryProjection:async(_a,_b,s)=>s.entries});
 return {old,fresh,page,current:()=>page.navigationGeneration===7};
}
{
 const {old,fresh,page,current}=fixture();const oldBody=deferred();const probes=[];
 const gateway={loadChapter:async(s,i)=>{probes.push({url:s.entries[i].url,session:s===old?'old':'new'});await oldBody.promise;}};
 const pending=page.probeRemoteContentVerdict(gateway,old,current);
 page.refreshCachedSearchDetailInBackground({sourceId:'s',bookId:'b'},'源',old,7,Promise.resolve(fresh));await settle();
 assert.equal(page.remoteReadingSession,fresh);assert.equal(page.remoteContentVerdict,'verifying');
 oldBody.resolve();await pending;assert.equal(page.remoteContentVerdict,'readable');
 page.openReading(1);
 console.log(JSON.stringify({case:'old-success-after-refresh',sameNavigationBeforeStart:true,probes,newSessionActive:page.remoteReadingSession===fresh,globalVerdict:page.remoteContentVerdict,requestedChapterIndex:page.requestedChapterIndex,readingSessionActive:page.readingSessionActive}));
}
{
 const {old,fresh,page,current}=fixture();const oldBody=deferred();
 const pending=page.probeRemoteContentVerdict({loadChapter:()=>oldBody.promise},old,current);
 page.refreshCachedSearchDetailInBackground({sourceId:'s',bookId:'b'},'源',old,7,Promise.resolve(fresh));await settle();
 await page.probeRemoteContentVerdict({loadChapter:async()=>{}},fresh,current);
 assert.equal(page.remoteContentVerdict,'readable');oldBody.reject(Error('old request failure'));await pending;
 console.log(JSON.stringify({case:'old-failure-overwrites-new-success',newSessionActive:page.remoteReadingSession===fresh,finalVerdict:page.remoteContentVerdict}));
}
{
 const {old,page,current}=fixture();const gate=deferred();const pending=page.probeRemoteContentVerdict({loadChapter:()=>gate.promise},old,current);page.nextNavigationGeneration();gate.resolve();await pending;assert.equal(page.remoteContentVerdict,'verifying');console.log(JSON.stringify({case:'navigation-change',staleVerdictRejected:true}));
}
{
 const {old,page,current}=fixture();page.remoteContentVerdict='networkFailed';page.detailBook={sourceId:'s',bookId:'b'};page.openReading(0);console.log(JSON.stringify({case:'direct-chapter-gate',globalVerdict:'networkFailed',readingSessionActive:page.readingSessionActive}));
}
