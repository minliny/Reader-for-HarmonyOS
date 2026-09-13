import { ReaderBrightnessWriter } from '../../../entry/src/main/ets/app/ReaderBrightnessWriter.ts';

const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const results = [];

// The old failed lookup has no authority over a new Window epoch's pending request.
{
  const oldLookup = deferred(); let lookupCount=0; const writes=[];
  const currentWindow = { getWindowProperties:()=>({brightness:.5}), async setWindowBrightness(value){writes.push(value);} };
  const writer = new ReaderBrightnessWriter(() => ++lookupCount===1 ? oldLookup.promise : Promise.resolve(currentWindow));
  const firstOwner=writer.claim(); const first=writer.request(firstOwner,.2);
  writer.reset(); const nextOwner=writer.claim();
  const latest=writer.request(nextOwner,.8).then(value=>({ok:true,value}),error=>({ok:false,error:error.message}));
  oldLookup.reject(Error('OLD_WINDOW_LOOKUP_FAILED'));
  await first; const actual=await latest; await tick();
  results.push({case:'old lookup fails after window replacement',expected:{latestApplied:true,writes:[.8]},actual:{latest:actual,writes,lookupCount},passes:actual.ok&&writes.at(-1)===.8});
}

// Native synchronous property failure must settle the dequeued request.
{
  const unhandled=[]; const observe=error=>unhandled.push(error.message);
  process.on('unhandledRejection',observe);
  let reads=0,settled=false; const writes=[];
  const writer=new ReaderBrightnessWriter(async()=>({
    getWindowProperties(){ if (++reads===1) throw Error('WINDOW_PROPERTIES_UNAVAILABLE'); return {brightness:.5}; },
    async setWindowBrightness(value){writes.push(value);},
  }));
  const owner=writer.claim();
  void writer.request(owner,.3).then(()=>{settled=true;},()=>{settled=true;});
  await tick(); await tick();
  const later=await writer.request(owner,.7);
  results.push({case:'synchronous native properties failure',expected:{firstSettled:true,unhandled:[]},actual:{firstSettled:settled,unhandled,writes,later},passes:settled&&unhandled.length===0});
  process.off('unhandledRejection',observe);
}
console.log(JSON.stringify({productionModule:'entry/src/main/ets/app/ReaderBrightnessWriter.ts',results},null,2));
process.exitCode=results.every(result=>result.passes)?0:1;
