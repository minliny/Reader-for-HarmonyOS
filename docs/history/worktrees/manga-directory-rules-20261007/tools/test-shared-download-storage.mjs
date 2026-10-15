import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source=readFileSync(new URL('../entry/src/main/ets/features/downloads/SharedDownloadStorageGateway.ts',import.meta.url),'utf8');
const executable=stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm,'').replace(/^export type[^\n]*\n/gm,'').replace(/^export /gm,''));
const Gateway=new Function('ReaderDownloadStoragePreferences',`${executable}\nreturn SharedDownloadStorageGateway;`)(class {});
const chapter={sourceId:'s',bookId:'b',chapterIndex:0};
const checks=[];
function fixture() {
  const calls=[];let failRead=false;
  const state={policy:{capacityBytes:10*1024**3,expiryDays:7},body:{totalBytes:100,retainedBytes:60,automaticBytes:40,cleanableBytes:30,protectedChapters:[chapter],removedChapters:[],hasMore:false},
    images:{totalBytes:50,retainedBytes:30,automaticBytes:20,cleanableBytes:10,availableBytes:4096},responses:[]};
  const runtime={readDownloadStorageBindings:async()=>({retainedChapters:[chapter],protectedChapters:[]}),request:async(method,params)=>{
    calls.push({method,params});if(failRead&&method==='cache.storage.summary')throw Error('unavailable');
    if(method==='cache.book.status')return{data:{sourceId:'s',bookId:'b',chapters:[{cachedBytes:100}]}};
    return{data:method==='cache.storage.cleanup'?(state.responses.shift()??state.body):state.body};
  }};
  const disk={readPolicy:async()=>({...state.policy}),configurePolicy:async next=>state.policy={...next},
    listTextStorageChapters:async()=>state.imageChapters??[],
    maintainMangaStorage:async reason=>calls.push({diskReason:reason}),readingStorageSummary:async classify=>{
      if(classify){const actual=await classify(chapter);if(actual!==undefined)assert.deepEqual(actual,{retained:true,inUse:true});}return state.images;
    },clearChapter:async(...args)=>calls.push({clear:args}),bookStorageBytes:async()=>50};
  return{gateway:new Gateway(runtime,disk),runtime,disk,calls,state,fail:()=>{failRead=true;}};
}
{
 const f=fixture();assert.deepEqual(await f.gateway.summary(),{totalBytes:150,retainedBytes:90,automaticBytes:60,cleanableBytes:40,availableBytes:4096});
 assert.equal(await f.gateway.bookBytes('s','b','manga'),150);
 f.fail();assert.deepEqual(await f.gateway.summary(),{totalBytes:undefined,retainedBytes:undefined,automaticBytes:undefined,cleanableBytes:undefined,availableBytes:4096});
 checks.push('actual Core and deduplicated image measurements join without zero fallback');
}
{
 const f=fixture();f.state.responses=[{...f.state.body,removedChapters:[chapter],hasMore:true},{...f.state.body,removedChapters:[{...chapter,chapterIndex:1}],hasMore:false}];
 await f.gateway.cleanup();assert.deepEqual(f.calls.filter(call=>call.clear).map(call=>call.clear),[['s','b',0],['s','b',1]]);
 assert.equal(f.calls.filter(call=>call.method==='cache.storage.cleanup').length,2);
 await f.gateway.configurePolicy({capacityBytes:1024**3,expiryDays:14});
 const capacity=f.calls.findLast(call=>call.method==='cache.storage.cleanup'&&call.params.reason==='capacity');
 assert.equal(capacity.params.ttlSeconds,14*86400);assert.equal(capacity.params.capacityBytes,1024**3-20,'retained image bytes do not reduce ordinary content budget');
 checks.push('cleanup drains bounded exact chapter results; persisted policy reaches Core and Host and exempts retained images');
}
{
 const f=fixture();f.state.responses=[{...f.state.body,removedChapters:[chapter],hasMore:true,cleanupError:'POSITION_CONTEXT_STALE'}];
 await assert.rejects(f.gateway.cleanup(),/POSITION_CONTEXT_STALE/);assert.deepEqual(f.calls.find(call=>call.clear).clear,['s','b',0]);
 f.state.images={...f.state.images,automaticBytes:undefined};
 await assert.rejects(f.gateway.maintainAutomaticStorage(),/OWNERSHIP_UNAVAILABLE/);
 assert.equal(f.calls.some(call=>call.method==='cache.storage.cleanup'&&call.params.reason==='capacity'),false);
 checks.push('partial committed cleanup reaches Host before error, and unknown image ownership never evicts unrelated text');
}
{
 const f=fixture();let valid=true,enter,release;
 const entered=new Promise(resolve=>{enter=resolve;}),held=new Promise(resolve=>{release=resolve;});
 f.runtime.captureDownloadStorageValidity=()=>()=>valid;
 const original=f.runtime.request;f.runtime.request=async(method,params,options)=>{
   if(method==='cache.storage.cleanup'){
     assert.equal(options.canDispatch(),true);assert.equal(options.shouldCancel,undefined);
     enter();await held;return{data:{...f.state.body,removedChapters:[chapter],hasMore:true}};
   }
   return original(method,params,options);
 };
 const cleanup=f.gateway.cleanup();await entered;assert.equal(f.gateway.hasActiveMutation(),true);
 let settled=false;const wait=f.gateway.waitForActiveMutation().then(()=>{settled=true;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);
 valid=false;release();await cleanup;await wait;
 assert.equal(f.gateway.hasActiveMutation(),false);assert.deepEqual(f.calls.find(call=>call.clear).clear,['s','b',0]);
 checks.push('new reading waits for active storage tail; changed protection stops the next batch without discarding dispatched exact cleanup');
}

const preferenceSource=readFileSync(new URL('../entry/src/main/ets/app/ReaderDownloadStoragePreferences.ts',import.meta.url),'utf8');
const preferenceExecutable=stripTypeScriptTypes(preferenceSource.replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''));
const store=new Map();let flushed=0;
const Preferences=new Function('preferences',`${preferenceExecutable}\nreturn ReaderDownloadStoragePreferences;`)({getPreferences:async()=>({get:async(k,d)=>store.get(k)??d,put:async(k,v)=>{store.set(k,v);},flush:async()=>{flushed++;}})});
const initial=new Preferences({});assert.deepEqual(await initial.load(),{capacityBytes:10*1024**3,expiryDays:7});
await initial.save({capacityBytes:4*1024**3,expiryDays:30});assert.equal(flushed,1);
assert.deepEqual(await new Preferences({}).load(),{capacityBytes:4*1024**3,expiryDays:30});
store.set('policy','corrupt');await assert.rejects(new Preferences({}).load());
checks.push('platform preference snapshot persists both controls on restart and reports corrupt policy');
console.log(JSON.stringify({status:'PASS',checks},null,2));
