import { createRequire, stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
const require=createRequire(import.meta.url);
const native=require('/private/tmp/reader-native-encode-probe.node');
const root='/Users/minliny/Documents/Reader/Reader-Core-Native';
const sdk=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(readFileSync(root+'/bindings/harmony/sdk/reader_core.ts','utf8'))).toString('base64')}`);
const r=native.createRuntime();let id=100;
const wait=async()=>{for(let i=0;i<5000;i++){const x=native.readEvent(r,0);if(x!==null)return x;await new Promise(v=>setTimeout(v,1));}throw Error('wait exceeded');};
native.sendCommand(r,{protocolVersion:1,requestId:id++,method:'core.info',params:{}});
const identity=JSON.parse(await wait()).data.buildIdentity;
const samples=[];
for(const bytes of [16384,131072,1048576,8388608,33554432,67108800]) {
 for(let sample=0;sample<3;sample++) {
  const body='正文内容。\n'.repeat(Math.ceil(bytes/16)).slice(0,Math.floor(bytes*6/16));
  const payload={status:200,body,headers:{},charsetHint:'utf-8',finalUrl:'https://controlled.invalid/book',redirects:[],cookies:[]};
  const requestId=id++;
  native.sendCommand(r,{protocolVersion:1,requestId,method:'runtime.hostSmoke',params:{capability:'host.smoke.echo',params:{status:'ok'}}});
  const host=JSON.parse(await wait());if(host.type!=='host.request')throw Error(JSON.stringify(host));
  let tick=false;setTimeout(()=>{tick=true},0);
  const t=performance.now();native.completeHostRequest(r,host.operationId,payload,id++);const completeSyncMs=performance.now()-t;
  const timerRanDuringCompletion=tick;
  const response=await wait();
  const p=performance.now();const parsed=sdk.parseReaderCoreEvent(response);const sdkParseMs=performance.now()-p;
  if(parsed.type!=='result')throw Error(response.slice(0,400));
  samples.push({bodyUtf8Bytes:Buffer.byteLength(body),wireBytes:Buffer.byteLength(response),sample,completeSyncMs,sdkParseMs,timerRanDuringCompletion});
 }
}
native.releaseRuntime(r);
const result={evidence:'macOS production C++ NAPI and linked Core; debug Rust profile, not Harmony device timing; no HTTP decoding included',identity,node:process.version,samples};
writeFileSync('/private/tmp/ml-c56-search-perf/native-main-thread.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
