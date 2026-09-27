import assert from 'node:assert/strict';
import { MangaImageDecodeHost } from '../entry/src/main/ets/app/MangaImageDecodeHost.ts';
function fixture(options={}) {
 const host=new MangaImageDecodeHost(), assets=new Map(), released=[];let id=0,current=true,validated=false;
 const bridge={begin(_r,_o,n){assets.set(++id,new Uint8Array(n));return id},write(_r,_o,i,b){assets.get(i).set(b);return b.length},commit(_r,_o,i){return assets.get(i).length},async read(_r,_o,i,offset,limit){if(options.cancelRead)current=false;return assets.get(i).slice(offset,offset+limit-(options.short?1:0))},release(_r,_o,i){released.push(i);assets.delete(i)}};
 const transport={async fetch(){return new Uint8Array([1,2,3])},async validate(){if(options.invalid)throw Error('invalid image');validated=true}};
 const event=(params,op)=>({protocolVersion:1,type:'host.request',capability:'manga.resource.transfer',requestId:7,operationId:op,params});
 const request=async params=>{
  const input=await host.handle(event({...params,stage:'input',maxBytes:16777216,request:{}},10),bridge,transport);
  assert.equal(input.bytes,3);bridge.release(7,10,input.assetId);
  assets.set(44,new Uint8Array([3,2,1]));
  const out=await host.handle(event({...params,stage:'output',assetId:44,operationId:10,bytes:3},11),bridge,transport);
  assert.equal(validated,true);assert.equal(assets.has(44),false,'release before ack');assert.equal(out.consumed,true);
  return {requestId:7,data:{...params,prepared:true,bytes:options.wrongCount?4:3}};
 };
 return {host,bridge,transport,event,request,released,current:()=>current};
}
{const f=fixture();assert.deepEqual(await f.host.prepare({resourceRef:'r'},f.request,f.current),new Uint8Array([3,2,1]));assert.deepEqual(f.released,[1,44]);}
for(const options of [{cancelRead:true},{short:true},{invalid:true},{wrongCount:true}]){const f=fixture(options);await assert.rejects(f.host.prepare({resourceRef:'r'},f.request,f.current));assert.ok(f.released.includes(44));}
{const f=fixture();await assert.rejects(f.host.handle(f.event({transferId:'forged',resourceRef:'r',stage:'input'},10),f.bridge,f.transport),/OWNER/);}
console.log('PASS manga asset transfer: bound owner, validation before ack, exact chunks, cancellation, invalid output and release');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const ownerFile = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
for(const cached of [false,true]) {
 const calls=[],bytes=new Uint8Array([9,8]);
 const Owner=productionMotionMethods(ownerFile,['loadReadingImage','prefetchReadingImage','prepareReadingImageBytes'],{
  MangaImageDecodeHost:{instance:{async prepare(params,request,current){calls.push(['decode',params]);assert.equal(current(),true);return bytes}}},
  ReadingBodyImageHost:{instance:{async loadBytes(value,current,position){calls.push(['load',value,position]);return {fileUri:'file://ok'}},async validateBytes(value,current,position){calls.push(['validate',value,position]);assert.equal(position,0)},async fetchRequestBytes(){throw Error('bypassed manga decode')}}},
  hilog:{error(){}},LOG_DOMAIN:0
 });
 const owner=new Owner();owner.assertReadingImageCurrent=()=>{};owner.admitReadingImage=p=>p;
 owner.readingImageCacheIdentity=(sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl)=>({sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl:baseUrl?.split('#')[0]});
 owner.readingImageDiskCache={captureValidity:()=>()=>true,async loadResource(){return cached?bytes:undefined},async storeResource(i,b){assert.equal(b,bytes);calls.push(['store',i])},async removeResource(){}};
 await owner.loadReadingImage('s','b',3,'v','https://image','https://chapter#part',true,()=>true,'resource',0,'rules');
 await owner.prefetchReadingImage({sourceId:'s',bookId:'b',chapterIndex:3,contentVersion:'v',imageUrl:'https://image',baseUrl:'https://chapter#part',resourceRef:'resource'},()=>true,'rules',true);
 assert.equal(calls.filter(c=>c[0]==='decode').length,cached?0:2);
 if(!cached){assert.equal(calls.find(c=>c[0]==='decode')[1].chapter.chapterId,'https://chapter#part');assert.equal(calls.filter(c=>c[0]==='store').length,2);}
}
{
 const Owner=productionMotionMethods(ownerFile,['loadReadingImage'],{ReadingBodyImageHost:{instance:{}}});
 const owner=new Owner();owner.assertReadingImageCurrent=()=>{};owner.readingImageCacheIdentity=()=>({sourceId:'s',bookId:'b'});
 owner.readingImageDiskCache={captureValidity:()=>()=>true,async loadResource(){return undefined}};
 owner.prepareReadingImageBytes=()=>{throw Error('network called')};
 await assert.rejects(owner.loadReadingImage('s','b',0,'v','image','chapter',false,()=>true,'r',0,'version'),/NOT_DOWNLOADED/);
}
console.log('PASS production ReaderRuntimeOwner: cached manga stays offline, decoded bytes persist, exact chapter identity and regional offline validation');
{
 const host=new MangaImageDecodeHost(),failure=new Error('READING_IMAGE_AUTH_REQUIRED');
 failure.code='READING_IMAGE_AUTH_REQUIRED';
 await assert.rejects(host.prepare({resourceRef:'r'},async params=>{
  try { await host.handle({requestId:7,operationId:10,params:{...params,stage:'input',maxBytes:16777216,request:{}}},{},{async fetch(){throw failure},async validate(){}}); }
  catch { throw new Error('Core generic host failed'); }
 },()=>true),error=>error===failure,'native generic host envelope must preserve original actionable HTTP failure');
}
console.log('PASS manga transfer preserves actionable HTTP failure identity across generic Core host rejection');
{
 // A newly admitted owner reuses persisted *decoded* bytes while offline; it
 // cannot call the key/library preparation route again.
 const decoded=new Uint8Array([254,253,252]),persisted=new Map();let prepareCalls=0,online=true;
 const Owner=productionMotionMethods(ownerFile,['loadReadingImage','prepareReadingImageBytes'],{
  MangaImageDecodeHost:{instance:{async prepare(){assert.equal(online,true,'offline must not enter nested key/library route');prepareCalls++;return decoded}}},
  ReadingBodyImageHost:{instance:{async loadBytes(bytes){assert.deepEqual(bytes,decoded);return {fileUri:'file://decoded'}},async fetchRequestBytes(){throw Error('network bypass')}}},
  hilog:{error(){}},LOG_DOMAIN:0
 });
 const createOwner=()=>{
  const owner=new Owner();owner.assertReadingImageCurrent=()=>{};owner.admitReadingImage=p=>p;
  owner.readingImageCacheIdentity=(sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl)=>({sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl});
  owner.readingImageDiskCache={captureValidity:()=>()=>true,async loadResource(identity){return persisted.get(JSON.stringify(identity))},async storeResource(identity,bytes){persisted.set(JSON.stringify(identity),bytes)},async removeResource(identity){persisted.delete(JSON.stringify(identity))}};
  return owner;
 };
 const argumentsForOwner=['s','b',0,'manifest','image','chapter',true,()=>true,'resource',0,'rules'];
 await createOwner().loadReadingImage(...argumentsForOwner);
 online=false;argumentsForOwner[6]=false;
 await createOwner().loadReadingImage(...argumentsForOwner);
 assert.equal(prepareCalls,1,'offline reopened owner must not refetch online decode dependency');
}
console.log('PASS decoded online-dependent bytes survive owner reopen with network explicitly disabled');

for(const [status,code] of [[401,'READING_IMAGE_AUTH_REQUIRED'],[403,'READING_IMAGE_ACCESS_DENIED'],[429,'READING_IMAGE_RATE_LIMITED'],[500,'READING_IMAGE_HTTP_FAILED']]){
 const host=new MangaImageDecodeHost();const failure=Object.assign(new Error('HTTP failure'),{event:{error:{details:{category:'SOURCE_HTTP_FAILED',httpStatus:status}}}});
 await assert.rejects(host.prepare({resourceRef:'r'},async()=>{throw failure},()=>true),error=>error.message===code);
 assert.equal(host.transfers.size,0);
}
{
 const host=new MangaImageDecodeHost();const unrelated=Object.assign(new Error('independent rule failure'),{event:{error:{details:{category:'RULE_FAILED',httpStatus:401}}}});
 await assert.rejects(host.prepare({resourceRef:'r'},async()=>{throw unrelated},()=>true),error=>error===unrelated);
}
console.log('PASS nested online key/library typed HTTP status shares image login/retry classification; unrelated rule failures retain identity');
