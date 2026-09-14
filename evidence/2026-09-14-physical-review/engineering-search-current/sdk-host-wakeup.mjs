import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { performance } from 'node:perf_hooks';
const path='/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/vendor/core-harmony/sdk/reader_core.ts';
const js=stripTypeScriptTypes(readFileSync(path,'utf8'));
const {ReaderCoreRuntime}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
async function run(hops,pollMs){
 let events=[],id=0,step=0,handlerMs=0,completions=0,readCalls=0;
 const next=()=>events.push(JSON.stringify(step<hops?{protocolVersion:1,requestId:id,type:'host.request',operationId:++step,capability:'probe.immediate',params:{}}:{protocolVersion:1,requestId:id,type:'result',data:{ok:true}}));
 const native={createRuntime(){return{}},sendCommand(_r,c){id=c.requestId;next()},readEvent(){readCalls++;return events.shift()??null},completeHostRequest(){completions++;next()},cancelRequest(){},releaseRuntime(){},pendingEventCount(){return events.length}};
 const rt=new ReaderCoreRuntime(native),start=performance.now();
 await rt.request('probe',{}, {timeoutMs:2000,...(pollMs?{pollMs}:{}),hostRequest:()=>{const t=performance.now();const r={ok:true};handlerMs+=performance.now()-t;return r}});
 rt.close();return{hops,pollMs:pollMs??10,elapsedMs:Number((performance.now()-start).toFixed(2)),handlerMs:Number(handlerMs.toFixed(3)),completions,readCalls};
}
const results=[];for(const hops of [1,5,10])results.push(await run(hops));
results.push(await run(10,1));
const report={source:path,kind:'production SDK with zero latency fake Host; not device performance',results};
writeFileSync('/tmp/reader-engineering-audit/sdk-host-wakeup.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
