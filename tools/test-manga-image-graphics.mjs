import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { validateMangaGraphicsDimensions, validateMangaGraphicsPlan } from '../entry/src/main/ets/app/MangaImageGraphicsPlan.ts';
import { MangaImageDecodeHost } from '../entry/src/main/ets/app/MangaImageDecodeHost.ts';
const fixture=name=>readFileSync(new URL(`./fixtures/manga-graphics/${name}`,import.meta.url));
const plan=JSON.parse(fixture('plan.json')), encoded=new Uint8Array(fixture('input.png'));
const expected=fixture('expected-bgra.bin'), original=fixture('input-bgra.bin'), jpeg=new Uint8Array(fixture('expected.jpg'));
// Actual VM pre-encode fingerprint: regional ReadPixels returns BGRA even
// from an RGBA PixelMap. Independent Pillow raw packing reproduces every byte.
assert.equal(createHash('sha256').update(expected).digest('hex'),'d0583d69986f82b11b09b7b0e1b2db0c3f6340417ec6f928f306dfa8bc61d0cf');
assert.equal(validateMangaGraphicsPlan(plan).strips.length,14);
for(const mutation of [p=>p.strips.pop(),p=>p.strips[1].sourceY=0,p=>p.strips[1].targetY=0,p=>p.strips[0].height=-1,p=>p.width=99999,p=>p.pixelFormat='argb',p=>p.strips=Array(65).fill(p.strips[0])]) {
 const bad=structuredClone(plan);mutation(bad);assert.throws(()=>validateMangaGraphicsPlan(bad));
}
function graphicsFixture(fault='',sourceBarrier) {
 let alive=true,reads=0,allocations=0;const released=[],calls=[],order=[];
 const info={mimeType:'image/png',size:fault==='oversized'?{width:4096,height:4096}:fault==='sampling-padding'?{width:33,height:44000}:{width:8,height:103},pixelFormat:3};
 const input={async getImageInfo(){return info},getBytesNumberPerRow(){return info.size.width*4+(fault==='stride'?4194304:0)},getPixelBytesNumber(){return info.size.width*info.size.height*4},async readPixels(area){
  const {pixels,offset,stride,region}=area;calls.push(area);reads++;order.push('read');
  const output=new Uint8Array(pixels);
  // Instrument only platform regional reads. The expected pixels are an
  // independent Pillow crop/paste + raw BGRA fixture, not this adapter.
  for(let row=0;row<region.size.height;row++) output.set(original.subarray((region.y+row)*32,(region.y+row+1)*32),offset+row*stride);
  if(fault==='cancel')alive=false;
  if(fault==='read')throw Error('native read failed');
 },async release(){order.push('release-input');released.push('input');if(fault==='input-release')throw Error('input release failed');}};
 const output={async getImageInfo(){return {size:info.size,pixelFormat:fault==='output-format'?3:2}},getBytesNumberPerRow(){return info.size.width*2+(fault==='output-stride'?33554432:0)},getPixelBytesNumber(){return info.size.width*info.size.height*2},async release(){released.push('output')}};
 const source={async getImageInfo(){return info},async getFrameCount(){return fault==='animated'?2:1},async createPixelMap(options){allocations++;assert.equal(options.desiredPixelFormat,3);assert.equal(options.desiredDynamicRange,1);return input},async release(){order.push('release-source-start');released.push('source');if(sourceBarrier)await sourceBarrier;if(fault==='source-release')throw Error('source release failed');if(fault==='source-cancel')alive=false;order.push('release-source-end');}};
 const image={PixelMapFormat:{RGBA_8888:3,BGRA_8888:4,RGB_565:2},DecodingDynamicRange:{SDR:1},createImageSource(bytes){assert.deepEqual(new Uint8Array(bytes),encoded);return source},async createPixelMap(pixels,options){
  order.push('create-output');assert.ok(order.lastIndexOf('release-source-end')>order.lastIndexOf('read'),'source decoder must finish release before output allocation');assert.deepEqual(Buffer.from(pixels),expected,'actual production regional-read placements equal independent BGRA golden');
  assert.equal(options.srcPixelFormat,4,'regional BGRA bytes must be identified before ImageKit converts to RGB565');assert.equal(options.pixelFormat,2);assert.deepEqual(options.size,{width:8,height:103});return output;
 },createImagePacker(){order.push('create-packer');return {async packing(value,options){assert.equal(value,output);assert.equal(options.format,'image/jpeg');assert.equal(options.quality,90);assert.equal(options.bufferSize,16777216);if(fault==='pack')throw Error('native packing failed');return jpeg.slice().buffer},async release(){released.push('packer')}}}};
 const Host=productionMotionMethods(new URL('../entry/src/main/ets/app/MangaImageGraphicsHost.ts',import.meta.url),['current','encoded','workingSet','dimensions','inspect','transform','performTransform'],{image,MAX_BYTES:16777216,MAX_GRAPHICS_WORKING_BYTES:33554432,validateMangaGraphicsDimensions,validateMangaGraphicsPlan});
 const host=new Host();host.pending=0;host.tail=Promise.resolve();
 return {host,current:()=>alive,released,calls,reads:()=>reads,allocations:()=>allocations,order};
}
{const f=graphicsFixture();assert.deepEqual(await f.host.inspect(encoded,f.current),{width:8,height:103});assert.deepEqual(await f.host.transform(encoded,plan,f.current),jpeg);assert.equal(f.reads(),14);assert.deepEqual(f.released,['source','input','source','packer','output']);}
for(const fault of ['cancel','read','pack','animated','stride','output-format','output-stride']) {
 const f=graphicsFixture(fault);await assert.rejects(f.host.transform(encoded,plan,f.current));assert.ok(f.released.includes('source'));
 if(fault!=='animated')assert.ok(f.released.includes('input'));
 if(fault==='cancel')assert.equal(f.reads(),1,'cancellation prevents subsequent strip reads');
 if(fault==='pack')assert.ok(f.released.includes('output')&&f.released.includes('packer'));
}
// Serialize native bitmap allocations while keeping at most two caller leases.
{
 const f=graphicsFixture();let release;const wait=new Promise(resolve=>{release=resolve});
 const perform=f.host.performTransform.bind(f.host);let calls=0;
 f.host.performTransform=async(...args)=>{calls++;await wait;return perform(...args)};
 const first=f.host.transform(encoded,plan,()=>true);
 const second=f.host.transform(encoded,plan,()=>false);
 await assert.rejects(second,/CANCELLED/);
 const queued=f.host.transform(encoded,plan,()=>true);
 await assert.rejects(f.host.transform(encoded,plan,()=>true),/CAPACITY/);
 await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
 release();await first;await queued;assert.equal(calls,2);assert.equal(f.host.pending,0);
}
{
 const f=graphicsFixture(),wrapped=new Uint8Array(encoded.length+4);wrapped.set(encoded,2);
 assert.deepEqual(await f.host.transform(wrapped.subarray(2,2+encoded.length),plan,f.current),jpeg);
}
// Exercise actual transfer stages: only transformed/validated bytes reach the
// caller, original HTTP bytes cannot become the offline content payload.
{
 const host=new MangaImageDecodeHost(),f=graphicsFixture(),assets=new Map();let next=0,validated;
 const bridge={begin(r,o,n){assets.set(++next,new Uint8Array(n));return next},write(r,o,id,bytes){assets.get(id).set(bytes);return bytes.length},commit(r,o,id){return assets.get(id).length},async read(r,o,id,offset,limit){return assets.get(id).slice(offset,offset+limit)},release(r,o,id){assets.delete(id)}};
 const transport={graphics:f.host,async fetch(){return encoded},async validate(bytes){validated=bytes;assert.deepEqual(bytes,jpeg)}};
 const event=params=>({requestId:9,operationId:11,params});
 const request=async params=>{
  const input=await host.handle(event({...params,stage:'input',inspectGraphics:true,maxBytes:16777216,request:{}}),bridge,transport);
  assert.deepEqual([input.width,input.height],[8,103]);assets.delete(input.assetId);assets.set(22,encoded);
  const output=await host.handle(event({...params,stage:'output',graphicsPlan:plan,assetId:22,operationId:11,bytes:encoded.length}),bridge,transport);
  assert.equal(output.preparedBytes,jpeg.length);assert.equal(output.bytes,encoded.length);assert.equal(assets.size,0);
  return {requestId:9,data:{...params,prepared:true,bytes:jpeg.length}};
 };
 const result=await host.prepare({resourceRef:'page'},request,()=>true);
 assert.equal(result,validated);assert.deepEqual(result,jpeg);assert.notDeepEqual(result,encoded);
 const Owner=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts',import.meta.url),['prefetchReadingImage','prefetchReadingImageOwned','runMangaImageWork','prepareReadingImageBytes'],{
  MangaImageDecodeHost:{instance:host},ReadingBodyImageHost:{instance:{async validateBytes(bytes){assert.deepEqual(bytes,jpeg)}}}
 });
 const owner=new Owner();owner.mangaImageTail=Promise.resolve();owner.mangaImagePending=0;let stored,requests=0;
 owner.assertReadingImageCurrent=()=>{};
 owner.request=async(method,params)=>{requests++;assert.equal(method,'manga.resource.prepare');return request(params)};
 owner.readingImageDiskCache={captureValidity:()=>()=>true,async loadResource(){return stored},async storeResource(identity,bytes){stored=bytes},async removeResource(){stored=undefined}};
 const identity={sourceId:'s',bookId:'b',chapterIndex:0,contentVersion:'v',resourceRef:'page',mangaDecodeRevision:'bytes-v1',baseUrl:'chapter',imageUrl:'image'};
 await owner.prefetchReadingImage(identity,()=>true,'rules',true);
 assert.deepEqual(stored,jpeg);assert.notDeepEqual(stored,encoded);assert.equal(requests,1);
 await owner.prefetchReadingImage(identity,()=>true,'rules',false);
 assert.equal(requests,1,'offline decoded cache never re-enters JS, graphics or HTTP');
}
console.log('PASS manga graphics: real bundled-rule 14-strip golden coordinates, independent Pillow BGRA, explicit ImageKit source format, narrow dimensions/coverage, actual methods, cancellation/release, decoded-byte transfer (native ImageKit codec pixels remain target gate)');

{const f=graphicsFixture('oversized'),huge={...plan,width:4096,height:4096,strips:[{sourceY:0,targetY:0,height:4096}]};await assert.rejects(f.host.transform(encoded,huge,f.current),/MEMORY_BUDGET/);assert.equal(f.allocations(),0);assert.equal(f.reads(),0);assert.deepEqual(f.released,['source']);}
{const f=graphicsFixture();assert.throws(()=>f.host.workingSet(8,103,16777216),/MEMORY_BUDGET/,'simultaneous encoded copies and pack reserve also count');}
console.log('PASS graphics rejects former 16Mip double-RGBA allocation before native pixels; padded native surface rechecks and releases; encoded/pack buffers enter independent working-set gate.');

// Execute actual release ordering, including uncertain native release failure.
for(const fault of ['input-release','source-release','source-cancel']){
 const f=graphicsFixture(fault),events=[];f.host.diagnosticObserver=e=>events.push(e);f.host.observeDiagnostic=e=>events.push(e);
 await assert.rejects(f.host.transform(encoded,plan,f.current),fault==='source-cancel'?/CANCELLED/:/release failed/);
 assert.equal(f.released.filter(x=>x==='input').length,1);assert.equal(f.released.filter(x=>x==='source').length,1);
 assert.equal(f.order.includes('create-output'),false);assert.equal(f.order.includes('create-packer'),false);assert.equal(f.host.pending,0);
 for(const resource of ['source','pixel'])assert.equal(events.filter(e=>e.event==='open'&&e.resource===resource).length,events.filter(e=>['release','release-error'].includes(e.event)&&e.resource===resource).length);
 if(fault!=='source-cancel')assert.ok(events.some(e=>e.event==='release-error'&&e.resource===(fault==='source-release'?'source':'pixel')),'failed native release is explicit, never a false successful release');
}
{
 let finish;const barrier=new Promise(resolve=>finish=resolve),f=graphicsFixture('',barrier);
 const task=f.host.transform(encoded,plan,f.current);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.order.includes('release-source-start'),true);assert.equal(f.order.includes('create-output'),false);assert.equal(f.host.pending,1);
 finish();await task;assert.equal(f.order.filter(x=>x==='release-source-start').length,1);assert.ok(f.order.indexOf('release-source-end')<f.order.indexOf('create-output'));
}
console.log('PASS codec source release finishes after readback/input release and before RGB565/packer allocation; async drain, cancellation and native release errors call each owner once and preserve explicit failure receipts.');

{
 const f=graphicsFixture('sampling-padding'),p={...plan,width:33,height:44000,strips:[{sourceY:0,targetY:0,height:44000}]};
 const oldDecode=encoded.length*3+Math.ceil(33/8)*8*Math.ceil(44000/8)*8*8+33*44000*8;
 assert.ok(oldDecode<33554432,'counterfactual eight-pixel pad would admit this work surface');
 await assert.rejects(f.host.transform(encoded,p,f.current),/MEMORY_BUDGET/);assert.equal(f.allocations(),0);assert.deepEqual(f.released,['source']);
}
console.log('PASS graphics coefficient working-set preflight includes maximum JPEG sampling-factor padding before any pixel allocation.');
