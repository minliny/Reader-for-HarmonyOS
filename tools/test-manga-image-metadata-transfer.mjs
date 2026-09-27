import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MangaImageMetadataHost } from '../entry/src/main/ets/app/MangaImageMetadataHost.ts';
const bytes=new Uint8Array([1,2,3]),sha256=createHash('sha256').update(bytes).digest('hex');
for(const invalid of [false,true]){
 const host=new MangaImageMetadataHost();let live=true;const released=[];
 const bridge={begin:()=>1,write:(_r,_o,_a,b)=>b.length,commit:()=>3,release:(_r,_o,a)=>released.push(a)};
 const proof=host.inspect(bytes,sha256,async params=>{
  const event={requestId:7,operationId:11,params:{...params,stage:'inspectInput',maxBytes:16777216}};
  const input=await host.handle(event,bridge);assert.deepEqual(input,{assetId:1,operationId:11,bytes:3});
  if(invalid)live=false;
  return {requestId:7,data:{...params,status:'absent',orientation:null}};
 },()=>live);
 if(invalid)await assert.rejects(proof,/RECEIPT/);else assert.equal((await proof).status,'absent');
 assert.deepEqual(released,[],'committed asset belongs to Core until consumed');
}
{const host=new MangaImageMetadataHost();await assert.rejects(host.handle({requestId:2,operationId:3,params:{stage:'inspectInput',transferId:'forged'}},{}),/OWNER/);}
console.log('PASS metadata asset adapter: exact bytes/hash, owner, cancellation and no transport or imageDecode');
