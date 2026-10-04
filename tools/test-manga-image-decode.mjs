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
const manifest = {chapter:{sourceId:'s',bookId:'b',chapterId:'chapter'},sourceRuleVersion:'rules',manifestVersion:'manifest',decodeRevision:'bytes-v1',pages:[{ordinal:0,pageId:'resource',resourceRef:'resource'}]};
const ownerFile = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
for(const cached of [false,true]) {
 const calls=[],bytes=new Uint8Array([9,8]);
 const Owner=productionMotionMethods(ownerFile,['loadReadingImage','loadReadingImageOwned','prefetchReadingImage','prefetchReadingImageOwned','runMangaImageWork','prepareReadingImageBytes'],{
  MangaImageDecodeHost:{instance:{async prepare(params,request,current){calls.push(['decode',params]);assert.equal(current(),true);return bytes}}},
  ReadingBodyImageHost:{instance:{async loadBytes(value,current,position){calls.push(['load',value,position]);return {fileUri:'file://ok'}},async validateBytes(value,current,position){calls.push(['validate',value,position]);assert.equal(position,0)},async fetchRequestBytes(){throw Error('bypassed manga decode')}}},
  hilog:{error(){}},LOG_DOMAIN:0
 });
 const owner=new Owner();owner.mangaImageTail=Promise.resolve();owner.mangaImagePending=0;owner.assertReadingImageCurrent=()=>{};owner.admitReadingImage=p=>p;
 owner.readingImageCacheIdentity=(sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl)=>({sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl:baseUrl?.split('#')[0]});
 owner.readingImageDiskCache={captureValidity:()=>()=>true,async loadResource(){return cached?bytes:undefined},async storeResource(i,b){assert.equal(i.mangaDecodeRevision,manifest.decodeRevision);assert.equal(b,bytes);calls.push(['store',i])},async removeResource(){}};
 await owner.loadReadingImage('s','b',3,'v','https://image','https://chapter#part',true,()=>true,'resource',0,manifest.sourceRuleVersion,false,manifest.decodeRevision);
 await owner.prefetchReadingImage({sourceId:'s',bookId:'b',chapterIndex:3,contentVersion:'v',imageUrl:'https://image',baseUrl:'https://chapter#part',resourceRef:'resource',mangaDecodeRevision:manifest.decodeRevision},()=>true,manifest.sourceRuleVersion,true);
 assert.equal(calls.filter(c=>c[0]==='decode').length,cached?0:2);
 if(!cached){assert.equal(calls.find(c=>c[0]==='decode')[1].chapter.chapterId,'https://chapter#part');assert.equal(calls.filter(c=>c[0]==='store').length,2);}
}
{
 const Owner=productionMotionMethods(ownerFile,['loadReadingImage','loadReadingImageOwned','runMangaImageWork'],{ReadingBodyImageHost:{instance:{}}});
 const owner=new Owner();owner.mangaImageTail=Promise.resolve();owner.mangaImagePending=0;owner.assertReadingImageCurrent=()=>{};owner.readingImageCacheIdentity=()=>({sourceId:'s',bookId:'b'});
 owner.readingImageDiskCache={captureValidity:()=>()=>true,async loadResource(){return undefined}};
 owner.prepareReadingImageBytes=()=>{throw Error('network called')};
 await assert.rejects(owner.loadReadingImage('s','b',0,'v','image','chapter',false,()=>true,'r',0,'version',false,manifest.decodeRevision),/NOT_DOWNLOADED/);
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
 const Owner=productionMotionMethods(ownerFile,['loadReadingImage','loadReadingImageOwned','runMangaImageWork','prepareReadingImageBytes'],{
  MangaImageDecodeHost:{instance:{async prepare(){assert.equal(online,true,'offline must not enter nested key/library route');prepareCalls++;return decoded}}},
  ReadingBodyImageHost:{instance:{async loadBytes(bytes){assert.deepEqual(bytes,decoded);return {fileUri:'file://decoded'}},async fetchRequestBytes(){throw Error('network bypass')}}},
  hilog:{error(){}},LOG_DOMAIN:0
 });
 const createOwner=()=>{
  const owner=new Owner();owner.mangaImageTail=Promise.resolve();owner.mangaImagePending=0;owner.assertReadingImageCurrent=()=>{};owner.admitReadingImage=p=>p;
  owner.readingImageCacheIdentity=(sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl)=>({sourceId,bookId,chapterIndex,contentVersion,imageUrl,baseUrl});
  owner.readingImageDiskCache={captureValidity:()=>()=>true,async loadResource(identity){return persisted.get(JSON.stringify(identity))},async storeResource(identity,bytes){persisted.set(JSON.stringify(identity),bytes)},async removeResource(identity){persisted.delete(JSON.stringify(identity))}};
  return owner;
 };
 const argumentsForOwner=['s','b',0,'manifest','image','chapter',true,()=>true,'resource',0,manifest.sourceRuleVersion,false,manifest.decodeRevision];
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

// The Core-advertised bound belongs to one transfer, including graphics output.
for(const maxBytes of [8*1024*1024,16*1024*1024]) {
 const f=fixture();let inspections=0;
 f.transport.fetch=async(_request,_current,limit)=>{assert.equal(limit,maxBytes);return new Uint8Array([1,2,3]);};
 f.transport.graphics={async inspect(){inspections++;return {width:2,height:2};},async transform(bytes){return bytes;}};
 const result=await f.host.prepare({resourceRef:'r'},async params=>{
  await f.host.handle(f.event({...params,stage:'input',maxBytes,request:{},inspectGraphics:true},10),f.bridge,f.transport);
  f.bridge.read=async()=>new Uint8Array([1,2,3]);
  await f.host.handle(f.event({...params,stage:'output',assetId:44,operationId:10,bytes:3},11),f.bridge,f.transport);
  return {requestId:7,data:{...params,prepared:true,bytes:3}};
 },f.current);assert.equal(result.length,3);assert.equal(inspections,1);
}
for(const stage of ['input','output','prepared']) {
 const f=fixture(),limit=8*1024*1024;let inspected=0,read=0,validated=0;
 f.transport.fetch=async()=>new Uint8Array(stage==='input'?limit+1:3);
 f.transport.graphics={async inspect(){inspected++;return {width:2,height:2};},async transform(){return new Uint8Array(limit+1);}};
 f.transport.validate=async()=>{validated++;};f.bridge.read=async()=>{read++;return new Uint8Array([1,2,3]);};
 await assert.rejects(f.host.prepare({resourceRef:'r'},async params=>{
  try {
   await f.host.handle(f.event({...params,stage:'input',maxBytes:limit,request:{},inspectGraphics:true},10),f.bridge,f.transport);
   await f.host.handle(f.event({...params,stage:'output',assetId:44,operationId:10,bytes:stage==='output'?limit+1:3,...(stage==='prepared'?{graphicsPlan:{}}:{})},11),f.bridge,f.transport);
  } catch { throw Error('Core generic host failure'); }
 },f.current),error=>error.message==='READING_IMAGE_DECODE_BUDGET');
 assert.equal(inspected,stage==='input'?0:1);assert.equal(read,stage==='prepared'?1:0);assert.equal(validated,0);
 if(stage!=='input')assert.ok(f.released.includes(44));assert.equal(f.host.transfers.size,0);
}
for(const maxBytes of [0,7*1024*1024,8*1024*1024+1,17*1024*1024,undefined]) {
 const f=fixture();f.transport.fetch=async()=>assert.fail('invalid advertisement must not fetch');
 await assert.rejects(f.host.prepare({resourceRef:'r'},params=>f.host.handle(f.event({...params,stage:'input',maxBytes,request:{}},10),f.bridge,f.transport),f.current),/STAGE/);
}
for(const budgetStage of ['input','output','heap','resident']) {
 const f=fixture();const failure=Object.assign(new Error('manga resource preparation rejected'),{event:{error:{details:{reason:'imageDecodeBudget',budgetStage}}}});
 await assert.rejects(f.host.prepare({resourceRef:'r'},async()=>{throw failure;},f.current),error=>error.message==='READING_IMAGE_DECODE_BUDGET');
 assert.equal(f.host.transfers.size,0);
}
console.log('PASS Core advertised 8/16MiB binds fetch/input/graphics/output/receipt; oversize rejects before inspect/read/validate, invalid advertisements do not fetch, native budget classification never falls back to original bytes');

// Execute the actual thin Body transport methods. HTTP receives the advertised
// limit; base64 rejects an over-limit string before invoking its native decoder.
{
 let receivedLimit,decodeCalls=0;let responseBytes=new Uint8Array([1]);
 const Body=productionMotionMethods(new URL('../entry/src/main/ets/app/ReadingBodyImageHost.ts',import.meta.url),['fetchRequestBytes','readDataUriBytes','assertCurrent'],{
  MAX_READING_IMAGE_BYTES:16*1024*1024,MAX_READING_IMAGE_DATA_URI_CHARS:Math.ceil(16*1024*1024/3)*4+4096,
  HttpExecuteHost:{instance:{async executeBytes(_request,limit,_requestId,cancelled){assert.equal(cancelled(),false);receivedLimit=limit;return {status:200,headers:{},bytes:responseBytes};}}},
  readingImageHttpError:()=>Error('http status'),util:{Type:{MIME:1},Base64Helper:class{decodeSync(text){decodeCalls++;return new Uint8Array(Buffer.from(text,'base64'));}}}
 });
 const body=new Body(),limit=8*1024*1024;
 await body.fetchRequestBytes({},()=>true,limit);assert.equal(receivedLimit,limit);
 await body.fetchRequestBytes({},()=>true);assert.equal(receivedLimit,16*1024*1024,'ordinary image default stays 16MiB');
 responseBytes=new Uint8Array(limit+1);await assert.rejects(body.fetchRequestBytes({},()=>true,limit),/READING_IMAGE_DECODE_BUDGET/);
 assert.throws(()=>body.readDataUriBytes('data:image/png;base64,'+'A'.repeat(Math.ceil(limit/3)*4+4097),()=>true,limit),/READING_IMAGE_DECODE_BUDGET/);
 assert.equal(decodeCalls,0,'oversize base64 never reaches the platform decoder');
 assert.deepEqual(body.readDataUriBytes('data:image/png;base64,AQID',()=>true,limit),new Uint8Array([1,2,3]));
 for(const bad of [0,NaN,17*1024*1024]) {
  receivedLimit=undefined;await assert.rejects(body.fetchRequestBytes({},()=>true,bad),/READING_IMAGE_DECODE_BUDGET/);assert.equal(receivedLimit,undefined);
  assert.throws(()=>body.readDataUriBytes('data:image/png;base64,AQID',()=>true,bad),/READING_IMAGE_DECODE_BUDGET/);
 }
}
console.log('PASS actual Body transport applies Core limit to HTTP and before base64 decode; ordinary images retain 16MiB and invalid limits have no transport side effects');

{
 const f=fixture(),limit=8*1024*1024;
 await assert.rejects(f.host.prepare({resourceRef:'r'},async params=>{
  await f.host.handle(f.event({...params,stage:'input',maxBytes:limit,request:{}},10),f.bridge,f.transport);
  f.bridge.read=async()=>new Uint8Array([1,2,3]);
  await f.host.handle(f.event({...params,stage:'output',assetId:44,operationId:10,bytes:3},11),f.bridge,f.transport);
  return {requestId:7,data:{...params,prepared:true,bytes:limit+1}};
 },f.current),error=>error.message==='READING_IMAGE_DECODE_BUDGET');
 assert.equal(f.host.transfers.size,0);
}
console.log('PASS final prepared receipt cannot advertise bytes above its accepted input transfer limit');
