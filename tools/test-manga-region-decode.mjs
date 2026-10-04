import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const code=stripTypeScriptTypes(readFileSync(new URL('../entry/src/main/ets/app/ReadingBodyImageHost.ts',import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''));
let mimeType='image/png',frames=1,orientation=1,metadataError=false,pixelDecodes=0,inspections=0,nativeDecodeError=false;
let pixelFormat=3,rowPadding=0,postRotatePadding=0,pixelBytesExtra=0,allocationClass='scanline',omitProfile=false;
const profile=()=>({format:mimeType.slice(6),encodedWidth:width,encodedHeight:height,allocationClass:mimeType==='image/webp'?'fullFrame':allocationClass});
let proofStatus='present';const nativeBuffers=[];let releaseBarrier,releaseStarted,releaseFailure=false;
let options, width=1000,height=20000, released=0, closed=0,current=true,mismatch=false;
const image={CropAndScaleStrategy:{CROP_FIRST:2},PixelMapFormat:{RGBA_8888:3},DecodingDynamicRange:{SDR:1},PropertyKey:{ORIENTATION:'Orientation'},createImageSource:(buffer)=>{nativeBuffers.push(buffer);return({
  getImageInfo:async()=>({size:{width,height},mimeType}),
  getFrameCount:async()=>frames,
  getImageProperty:async()=>{throw Object.assign(Error('platform conflates absent/corrupt EXIF'),{code:62980123});},
  createPixelMap:async(o)=>{pixelDecodes++;options=o;if(nativeDecodeError)throw Error('native image payload invalid');let size={...(o.desiredSize ?? o.desiredRegion?.size ?? {width,height})},rotated=false;return {getImageInfo:async()=>({size:mismatch?{width,height}:size,pixelFormat}),getBytesNumberPerRow(){return size.width*4+(rotated?postRotatePadding:rowPadding)},getPixelBytesNumber(){return size.width*size.height*4+pixelBytesExtra},async flip(){},async rotate(angle){rotated=true;if(angle%180)size={width:size.height,height:size.width};},async release(){released++;releaseStarted?.();if(releaseBarrier)await releaseBarrier;if(releaseFailure)throw Error('release failed');}};},
  release:async()=>{closed++;}
});}};
const util={LRUCache:class {constructor(){this.data=new Map();}get(key){return this.data.get(key);}put(key,value){this.data.set(key,value);}remove(key){this.data.delete(key);}clear(){this.data.clear();}}};
const Host=new Function('image','util','hilog',`${code}\nreturn ReadingBodyImageHost;`)(image,util,{warn(){}});
const host=new Host();host.sha256=async bytes=>createHash('sha256').update(bytes).digest('hex');let file;
const inspector=async(bytes,sha256,current)=>{inspections++;if(metadataError)throw Error('imageMetadataInvalid');return {sha256,bytes:bytes.length,status:proofStatus,orientation,decodeProfile:omitProfile?undefined:profile()};};
host.setMangaMetadataInspector(inspector);
host.materializeDisplayFile=async(bytes,pixels,w,h,hash,encoded)=>{file={w,h,hash,encoded};return 'file://region';};
const bytes=new Uint8Array([1,2,3]);
const tile=await host.loadBytes(bytes,()=>current,0.5);
assert.equal(nativeBuffers.at(-1),bytes.buffer,'whole image input must not be copied per crop');
assert.deepEqual(options.desiredSize,options.desiredRegion.size,'native crop-first must use the encoded ROI size');assert.equal(options.cropAndScaleStrategy,2);
assert.equal(options.desiredRegion.x,0);assert.equal(options.desiredRegion.size.width,1000);
assert.ok(options.desiredRegion.size.width*options.desiredRegion.size.height<=1024*1024);
assert.equal(tile.intrinsicHeight,20000);assert.equal(tile.regionY,options.desiredRegion.y);
assert.ok(file.encoded,'region must materialize cropped pixels rather than original whole bytes');
assert.ok(file.hash.includes(`region-${tile.regionY}`));assert.equal(released,1);assert.equal(closed,1);
await host.loadBytes(bytes,()=>true,1);assert.equal(options.desiredRegion.y+options.desiredRegion.size.height,height);
mismatch=true;await assert.rejects(host.loadBytes(bytes,()=>true,0),/BUDGET|budget|MISMATCH/);assert.equal(released,3);assert.equal(closed,3);mismatch=false;
width=5000;host.setMangaMetadataInspector(inspector);await assert.rejects(host.loadBytes(bytes,()=>true,0),/REGION_OUT_OF_RANGE/);assert.equal(released,3);assert.equal(closed,4);
width=1000;host.setMangaMetadataInspector(inspector);await assert.rejects(host.loadBytes(bytes,()=>true,NaN),/REGION_OUT_OF_RANGE/);
await host.loadBytes(bytes,()=>true);assert.equal(options.desiredRegion,undefined,'novel image semantics stay unchanged');assert.ok(options.desiredSize);
current=false;await assert.rejects(host.loadBytes(bytes,()=>current,0),/cancelled/);
console.log('PASS manga region decode: original resolution, bounded native region, exact crop receipt, separate file identity, native release, invalid region and novel compatibility');

current=true;width=16;height=12;host.setMangaMetadataInspector(inspector);const baseline=pixelDecodes;
for(const mime of ['image/jpeg','image/png','image/webp']){mimeType=mime;host.setMangaMetadataInspector(inspector);await host.validateBytes(bytes,()=>true,0);}
assert.equal(pixelDecodes,baseline+3);
for(const mime of ['image/gif','image/heif','']){mimeType=mime;await assert.rejects(host.loadBytes(bytes,()=>true,0),/FORMAT_UNSUPPORTED/);}
mimeType='image/webp';frames=2;await assert.rejects(host.validateBytes(bytes,()=>true,0),/ANIMATION_UNSUPPORTED/);frames=1;
height=2000;for(const value of [2,3,4,5,6,7,8]){orientation=value;host.setMangaMetadataInspector(inspector);const normalized=await host.loadBytes(bytes,()=>true,0);assert.equal(normalized.intrinsicWidth,value>=5?height:width);assert.equal(normalized.intrinsicHeight,value>=5?width:height);}
orientation=1;metadataError=true;host.setMangaMetadataInspector(inspector);await assert.rejects(host.loadBytes(bytes,()=>true,0),/METADATA_UNAVAILABLE/);metadataError=false;
assert.equal(pixelDecodes,baseline+10,'malformed metadata must reject before native pixel allocation');
orientation=null;proofStatus='absent';host.setMangaMetadataInspector(inspector);await host.validateBytes(bytes,()=>true,0);
console.log('PASS manga static JPEG/PNG/WebP metadata admission; eight valid directions normalize; animated, unknown format and unavailable metadata reject before pixel allocation');

const before=inspections;await host.loadBytes(bytes,()=>true,0.25);await host.loadBytes(bytes,()=>true,0.75);assert.equal(inspections,before,'exact byte hash reuses the bounded metadata proof across crops');
await host.loadBytes(new Uint8Array([3,2,1]),()=>true,0);assert.equal(inspections,before+1,'same-length changed bytes require new inspection');
host.setMangaMetadataInspector(async()=>({sha256:'0'.repeat(64),bytes:bytes.length,status:'absent',orientation:null}));
await assert.rejects(host.loadBytes(bytes,()=>true,0),/METADATA_UNAVAILABLE/,'proof must bind the actual input digest');
host.setMangaMetadataInspector(undefined);await assert.rejects(host.loadBytes(bytes,()=>true,0),/METADATA_UNAVAILABLE/);
console.log('PASS inspector injection and native EXIF ambiguity: absent metadata admitted, corruption rejects, exact-byte proof reused across crops, changed digest and cleared owner never reuse proof');
let finishInspection,startedInspection;
const started=new Promise(resolve=>startedInspection=resolve);
host.setMangaMetadataInspector(async (value,sha256)=>{startedInspection();await new Promise(resolve=>finishInspection=resolve);return {sha256,bytes:value.length,status:'absent',orientation:null};});
const pending=host.loadBytes(bytes,()=>true,0);const rejected=assert.rejects(pending,/cancelled/);
await started;host.setMangaMetadataInspector(undefined);finishInspection();await rejected;
assert.equal(host.mangaMetadataProofs.get(`${await host.sha256(bytes)}:${bytes.length}`),undefined,'late prior-owner metadata cannot populate the successor cache');
console.log('PASS inspector owner replacement discards late proof and closes the native image source');

host.setMangaMetadataInspector(inspector);
const backing=new Uint8Array([99,98,1,2,3,97]);const view=backing.subarray(2,5);
await host.loadBytes(view,()=>true,0);
assert.deepEqual([...new Uint8Array(nativeBuffers.at(-1))],[1,2,3],'native decoder sees exactly metadata-inspected bytes, without prefix or suffix');
assert.notEqual(nativeBuffers.at(-1),backing.buffer);
await host.loadBytes(bytes,()=>true,0);assert.equal(nativeBuffers.at(-1),bytes.buffer,'normal complete buffers still avoid copies');
console.log('PASS partial Uint8Array view: metadata, digest and native decode share exact bytes; full-span input remains zero-copy');

// These exact bytes are independently parsed in Core's fixed OSS parser tests.
// Native image/codec calls remain mocked here; no target-pixel claim is made.
const fixtureRoot=new URL('./fixtures/manga-metadata/',import.meta.url);
const provenance=JSON.parse(readFileSync(new URL('provenance.json',fixtureRoot),'utf8'));
for(const extension of ['jpg','png','webp']) {
 mimeType=extension==='jpg'?'image/jpeg':`image/${extension}`;width=16;height=12;
 for(const kind of ['no-exif','orientation-6','bad-exif']) {
  const filename=`${kind}.${extension}`;const value=new Uint8Array(readFileSync(new URL(filename,fixtureRoot)));
  const expected=provenance.sha256[filename];assert.equal(await host.sha256(value),expected);
  host.setMangaMetadataInspector(async (input,sha256)=>{
   assert.deepEqual(input,value);assert.equal(sha256,expected);
   if(kind==='bad-exif')throw Error('imageMetadataInvalid');
   return {sha256,bytes:input.length,status:kind==='no-exif'?'absent':'present',orientation:kind==='no-exif'?null:6,decodeProfile:profile()};
  });
  if(kind==='bad-exif')await assert.rejects(host.loadBytes(value,()=>true,0),/METADATA_UNAVAILABLE/);
  else await host.loadBytes(value,()=>true,0);
 }
}
host.setMangaMetadataInspector(inspector);orientation=null;proofStatus='absent';nativeDecodeError=true;mimeType='image/png';
await assert.rejects(host.loadBytes(new Uint8Array([137,80,78,71,13,10,26,10]),()=>true,0),/native image payload invalid/);
console.log('PASS shared real PNG/JPEG/WebP corpus: absent EXIF accepted, rotated images normalized/malformed proofs rejected, absent proof cannot replace successful native decode (platform codec mocked)');

nativeDecodeError=false;mimeType='image/png';proofStatus='present';
for(const value of [1,2,3,4,5,6,7,8]){
 orientation=value;width=value>=5?32768:1000;height=value>=5?1000:32768;host.setMangaMetadataInspector(inspector);
 const preview=await host.loadBytes(bytes,()=>true,0,true);
 assert.deepEqual(options.desiredRegion,{x:0,y:0,size:{width,height}},'contain explicitly routes full encoded ROI through native sampling');assert.equal(options.cropAndScaleStrategy,2);
 assert.ok(options.desiredSize.width*options.desiredSize.height<=1024*1024);assert.ok(Math.max(options.desiredSize.width,options.desiredSize.height)<=2048);
 assert.equal(preview.intrinsicWidth,1000);assert.equal(preview.intrinsicHeight,32768);assert.ok(preview.width*preview.height<=1024*1024);
 assert.equal(preview.regionY,undefined);assert.ok(file.hash.endsWith('-preview'));assert.equal(file.encoded,true);
}
mismatch=true;await assert.rejects(host.loadBytes(bytes,()=>true,0,true),/MISMATCH|MEMORY_BUDGET/);mismatch=false;
await assert.rejects(host.loadBytes(bytes,()=>true,undefined,true),/OUT_OF_RANGE/);
width=5000;height=100000;orientation=1;host.setMangaMetadataInspector(inspector);await assert.rejects(host.loadBytes(bytes,()=>true,0,true),/OUT_OF_RANGE/);
console.log('PASS contain thumbnails request <=1Mi pixels and <=2048 dimensions before native decode, preserve original oriented geometry, use distinct display derivative, reject wrong dimensions and retain original input admission');

// The serial crop slot remains owned until asynchronous PixelMap release settles.
width=1000;height=2000;orientation=1;host.setMangaMetadataInspector(inspector);
let finishRelease;releaseBarrier=new Promise(resolve=>finishRelease=resolve);
const releaseBegan=new Promise(resolve=>releaseStarted=resolve);const beforeClose=closed;
let settled=false;const releasing=host.loadBytes(bytes,()=>true,0).then(()=>{settled=true;});
await releaseBegan;await Promise.resolve();assert.equal(settled,false);assert.equal(closed,beforeClose,'ImageSource must stay open until PixelMap release settles');
finishRelease();await releasing;assert.equal(closed,beforeClose+1);
releaseBarrier=undefined;releaseStarted=undefined;releaseFailure=true;
await host.loadBytes(bytes,()=>true,0);assert.equal(closed,beforeClose+2,'release rejection must not skip ImageSource cleanup');releaseFailure=false;
console.log('PASS asynchronous PixelMap release retains the crop slot until settled and handles rejection before ImageSource cleanup');

// Explicit codec working-surface admission, independent from final tile geometry.
releaseFailure=false;releaseBarrier=undefined;releaseStarted=undefined;nativeDecodeError=false;current=true;proofStatus='present';orientation=1;
function geometry(mime,w,h,kind='scanline',direction=1){mimeType=mime;width=w;height=h;allocationClass=kind;orientation=direction;omitProfile=false;host.setMangaMetadataInspector(inspector);}
async function beforePixels(action,pattern){const before=pixelDecodes;await assert.rejects(action,pattern);assert.equal(pixelDecodes,before,'budget/metadata rejection must precede createPixelMap');}
geometry('image/png',1024,32768);await host.loadBytes(bytes,()=>true,0);assert.deepEqual(options.desiredSize,{width:1024,height:1024});assert.equal(options.desiredPixelFormat,3);assert.equal(options.desiredDynamicRange,1);
geometry('image/png',1000,100000);await beforePixels(host.loadBytes(bytes,()=>true,0,true),/MEMORY_BUDGET/);
geometry('image/png',1024,32768,'pngInterlaced');await host.loadBytes(bytes,()=>true,0);await beforePixels(host.loadBytes(bytes,()=>true,0,true),/MEMORY_BUDGET/);
geometry('image/png',4096,4096,'pngInterlaced',6);await beforePixels(host.loadBytes(bytes,()=>true,0),/MEMORY_BUDGET/);
for(const mime of ['image/jpeg','image/png','image/webp']){geometry(mime,1000,2000,'fullFrame');await beforePixels(host.loadBytes(bytes,()=>true,0),/MEMORY_BUDGET/);await beforePixels(host.loadBytes(bytes,()=>true,0,true),/MEMORY_BUDGET/);}
geometry('image/png',1024,32768);omitProfile=true;host.setMangaMetadataInspector(inspector);await beforePixels(host.loadBytes(bytes,()=>true,0),/MEMORY_BUDGET/);
geometry('image/png',16,12);omitProfile=true;host.setMangaMetadataInspector(inspector);await host.loadBytes(bytes,()=>true,0);
geometry('image/png',16,12);host.setMangaMetadataInspector(async(b,sha256)=>({status:'present',orientation:1,bytes:b.length,sha256,decodeProfile:{...profile(),encodedWidth:17}}));await beforePixels(host.loadBytes(bytes,()=>true,0),/METADATA_UNAVAILABLE/);
geometry('image/webp',16,12);await host.loadBytes(bytes,()=>true,0);assert.equal(options.cropAndScaleStrategy,undefined);
geometry('image/png',1023,2000);rowPadding=4;let releasedBefore=released;await assert.rejects(host.loadBytes(bytes,()=>true,0),/MEMORY_BUDGET/);assert.equal(released,releasedBefore+1);rowPadding=0;
geometry('image/png',32768,17,'scanline',6);postRotatePadding=2048;releasedBefore=released;await assert.rejects(host.loadBytes(bytes,()=>true,0),/MEMORY_BUDGET/);assert.equal(released,releasedBefore+1);postRotatePadding=0;
geometry('image/png',16,12);pixelFormat=7;releasedBefore=released;await assert.rejects(host.loadBytes(bytes,()=>true,0),/MEMORY_BUDGET/);assert.equal(released,releasedBefore+1);pixelFormat=3;
pixelBytesExtra=4194304;releasedBefore=released;await assert.rejects(host.loadBytes(bytes,()=>true,0),/MEMORY_BUDGET/);assert.equal(released,releasedBefore+1);pixelBytesExtra=0;
console.log('PASS allocation-profile dimensions, scanline/native sample ceiling, encoded-axis interlace, full-frame and absent-proof preflight, explicit SDR/RGBA, 1023-wide and post-rotation stride rejection, format/byte mismatch and release. No total codec/process peak assertion.');

for(const [w,h,expected] of [[1200,1906,{width:600,height:953}],[4000,6000,{width:500,height:750}],[1201,1907,{width:600,height:953}]]){
 geometry('image/jpeg',w,h,'scanline');const preview=await host.loadBytes(bytes,()=>true,0,true);assert.deepEqual(options.desiredSize,expected);assert.equal(options.cropAndScaleStrategy,2);assert.equal(preview.width,expected.width);assert.equal(preview.height,expected.height);assert.equal(preview.intrinsicWidth,w);assert.equal(preview.intrinsicHeight,h);assert.equal(preview.regionY,undefined);
}
geometry('image/png',1907,1201,'scanline',6);const rotatedPreview=await host.loadBytes(bytes,()=>true,0,true);assert.deepEqual(options.desiredSize,{width:953,height:600});assert.deepEqual([rotatedPreview.width,rotatedPreview.height],[600,953]);assert.deepEqual([rotatedPreview.intrinsicWidth,rotatedPreview.intrinsicHeight],[1201,1907]);
geometry('image/jpeg',4000,20000,'scanline');await beforePixels(host.loadBytes(bytes,()=>true,0,true),/MEMORY_BUDGET/);
console.log('PASS Tencent actual 1200x1906 contain uses 600x953; 4000x6000 uses 500x750; odd dimensions and EXIF transpose do not cross native sample bucket, sample8 over-budget rejects before decode.');

geometry('image/png',1,2000000,'scanline');await beforePixels(host.loadBytes(bytes,()=>true,0,true),/MEMORY_BUDGET/);
geometry('image/jpeg',1200,1905,'scanline');const oddHeight=await host.loadBytes(bytes,()=>true,0,true);assert.deepEqual(options.desiredSize,{width:600,height:952});assert.deepEqual([oddHeight.intrinsicWidth,oddHeight.intrinsicHeight],[1200,1905]);
console.log('PASS odd-height JPEG threshold and width-one max(1) native-bucket fallback stay within preflight budget.');

{
 const filename='jpeg-coefficient-padding.jpg';const encoded=new Uint8Array(readFileSync(new URL(filename,fixtureRoot)));
 const proof=JSON.parse(readFileSync(new URL('jpeg-coefficient-padding-proof.json',fixtureRoot),'utf8'));
 assert.equal(await host.sha256(encoded),proof.sha256);assert.equal(encoded.length,10764);assert.deepEqual(proof.size,[1,65500]);assert.equal(proof.progressive,1);
 assert.equal(Math.ceil(1/8)*8*Math.ceil(65500/8)*8*8,4192256);assert.ok(4192256<4194304);assert.ok(proof.libjpegCoefficientArrayBytes>4194304);
 geometry('image/jpeg',1,65500,'fullFrame');
 await beforePixels(host.loadBytes(encoded,()=>true,0),/MEMORY_BUDGET/);await beforePixels(host.loadBytes(encoded,()=>true,0,true),/MEMORY_BUDGET/);
 assert.ok(Math.ceil(1/32)*32*Math.ceil(65500/32)*32*8>4194304);
 console.log('PASS cjpeg-generated 1x65500 progressive 4x2/1x1/1x1 fixture: old 4192256B estimate undercounts 5240320B coefficient plane; 32x32 guard rejects region and contain before createPixelMap. Header/native boundaries mocked in this Host test.');
}
