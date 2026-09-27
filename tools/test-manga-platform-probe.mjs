import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
const root=new URL('../entry/src/main/',import.meta.url);
const assets=new URL('resources/rawfile/manga-platform-probe-v1/',root);
const read=name=>new Uint8Array(readFileSync(new URL(name,assets)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(Buffer.from(read('manifest.json')).toString());
const original=JSON.parse(readFileSync(new URL('fixtures/manga-orientation/goldens.json',import.meta.url),'utf8'));
assert.equal(manifest.cases.length,32);assert.equal(readdirSync(assets).length,68);
for(const f of manifest.cases){assert.equal(hash(read(f.file)),f.sha256);assert.equal(hash(read(f.expectedFile)),f.expectedSha256);assert.equal(f.expectedSha256,original.cases.find(x=>x.file===f.id).outputSha256);}
for(const [file,digest] of [['file','sha256'],['planFile','planSha256'],['expectedFile','expectedSha256']])assert.equal(hash(read(manifest.graphics[file])),manifest.graphics[digest]);
const runnerCode=readFileSync(new URL('ets/app/MangaPlatformProbeRunner.ts',root),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,'');
const require=createRequire(import.meta.url);
const ts=require('/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader/node_modules/typescript');
const compile=ts.transpileModule(runnerCode,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
function fixture({pixelCorruption=false,preencodeMissing=false,display=true,debug=true}={}){
 let bodyObserver,graphicsObserver,started=0,allocations=0,nativeReadbacks=0,readbackReleases=0;
 const frames=new Map(),reports=[],names=[];let sequence=0;
 const emitBody=(event,resource)=>bodyObserver?.({stage:'body',event,resource});
 const state=()=>({files:frames.size,leases:frames.size,writes:0,removals:0,reads:0});
 const body={diagnosticState:state,attachDiagnosticObserver(fn){assert.equal(bodyObserver,undefined);bodyObserver=fn;return()=>bodyObserver=undefined;},
  async loadBytes(bytes,current,position,preview=false){
   assert.equal(current(),true);const f=manifest.cases.find(x=>x.sha256===hash(bytes));assert.ok(f);emitBody('open','source');emitBody('open','pixel');allocations++;
   try{if(!current())throw Error('reading body image request was cancelled');bodyObserver?.({stage:'body',event:'metadata',orientation:f.orientation});
    let width=f.width,height=Math.min(2048,f.height,Math.floor(1048576/f.width)),y=Math.floor(Math.min(f.height-1,Math.floor(position*f.height+0.000001))/height)*height;
    height=Math.min(height,f.height-y);let rgba=read(f.expectedFile).slice(y*f.width*4,(y+height)*f.width*4);
    if(preview&&f.height>2048){width=8;height=2048;rgba=new Uint8Array(width*height*4);}else if(preview){y=undefined;height=f.height;rgba=read(f.expectedFile);}
    if(pixelCorruption&&f.id==='orientation-2.png')rgba[0]^=255;
    const uri=`file:///diagnostic/${++sequence}`;frames.set(uri,{width,height,rgba});
    bodyObserver?.({stage:'body',event:'region',width,height,regionY:preview?undefined:y});
    return {fileUri:uri,width,height,intrinsicWidth:f.width,intrinsicHeight:f.height,regionY:preview?undefined:y};
   }finally{emitBody('release','pixel');emitBody('release','source');}
  },release(uri){assert.equal(frames.delete(uri),true);}};
 const graphEvent=(event,resource,pixels)=>graphicsObserver?.({stage:'graphics',event,resource,pixels});
 const graphics={diagnosticPending:()=>0,attachDiagnosticObserver(fn){graphicsObserver=fn;return()=>graphicsObserver=undefined;},async transform(bytes,plan,current){
  assert.equal(plan.strips.length,14);assert.equal(hash(bytes),manifest.graphics.sha256);graphEvent('open','source');graphEvent('open','pixel');
  try{if(!current())throw Error('MANGA_DECODE_CANCELLED');const pixels=read(manifest.graphics.expectedFile);if(!preencodeMissing)graphEvent('pre-encode',undefined,pixels);return new Uint8Array([1,2,3]);}
  finally{graphEvent('release','pixel');graphEvent('release','source');}
 }};
 const image={PixelMapFormat:{RGBA_8888:3},createImageSource(input){const pixels=typeof input==='string'?frames.get('file://'+input):{width:8,height:103,rgba:read(manifest.graphics.expectedFile)};assert.ok(pixels);nativeReadbacks++;
  return {async getImageInfo(){return {size:pixels}},async createPixelMap(){return {async getImageInfo(){return {size:pixels,pixelFormat:3}},async readPixelsToBuffer(output){new Uint8Array(output).set(pixels.rgba)},async release(){readbackReleases++}}},async release(){readbackReleases++}};
 }};
 const fs={OpenMode:{READ_ONLY:0},async access(path){return frames.has('file://'+path)},async open(path){return {fd:path}},async close(){}};
 const cryptoFramework={createMd(){let bytes;return {async update(data){bytes=data.data},async digest(){return {data:new Uint8Array(createHash('sha256').update(bytes).digest())}}}}};
 const util={TextDecoder:class{decodeWithStream(v){return new TextDecoder().decode(v)}}};
 const values=[image,fs,cryptoFramework,util,debug,'debug',{current:()=>({start:async()=>{started++;}})},{instance:body},{instance:graphics},manifest.cases,manifest.graphics];
 const keys=['image','fs','cryptoFramework','util','DEBUG','BUILD_MODE_NAME','ReaderRuntimeOwner','ReadingBodyImageHost','MangaImageGraphicsHost','MANGA_PLATFORM_FIXTURES','MANGA_PLATFORM_GRAPHICS'];
 const {MangaPlatformProbeRunner,mangaProbeDifference}=new Function(...keys,`${compile};return {MangaPlatformProbeRunner,mangaProbeDifference};`)(...values);
 const runner=new MangaPlatformProbeRunner(async file=>{assert.ok(file.startsWith('manga-platform-probe-v1/'));names.push(file);return read(file.split('/')[1]);},r=>reports.push(r),async frame=>{assert.ok(frames.has(frame.fileUri));return display;});
 return {runner,reports,frames,names,body,graphics,mangaProbeDifference,get started(){return started},get allocations(){return allocations},get readbackClosed(){return readbackReleases===nativeReadbacks*2},get detached(){return bodyObserver===undefined&&graphicsObserver===undefined}};
}
{
 const f=fixture();await f.runner.run();assert.ok(f.reports.length>=40);assert.ok(f.reports.every(x=>x.pass),JSON.stringify(f.reports.filter(x=>!x.pass)));
 assert.equal(f.started,1);assert.ok(f.allocations>32);assert.equal(f.frames.size,1);assert.equal(f.readbackClosed,true);assert.equal(f.detached,true);
 assert.ok(f.reports.filter(x=>x.phase==='cancel-after-native-allocation').every(x=>x.pass));assert.ok(f.reports.every(x=>x.presentationEvidence===false));
 await f.runner.dispose();assert.equal(f.frames.size,0);assert.equal(f.reports.at(-1).phase,'dispose');assert.equal(f.reports.at(-1).pass,true);
 assert.throws(()=>f.mangaProbeDifference(new Uint8Array(0),new Uint8Array(0)),/LENGTH/);
}
for(const options of [{pixelCorruption:true},{preencodeMissing:true},{display:false}]){
 const f=fixture(options);await f.runner.run();assert.ok(f.reports.some(x=>!x.pass),JSON.stringify(options)+' cannot claim platform pass');await f.runner.dispose();assert.equal(f.frames.size,0);
}
{const f=fixture({debug:false});await assert.rejects(f.runner.run(),/UNAVAILABLE/);assert.equal(f.started,0);assert.equal(f.names.length,0);}
{const f=fixture();f.runner.cancel();await assert.rejects(f.runner.run(),/CANCELLED/);await f.runner.dispose();assert.equal(f.allocations,0);}
// Execute production observer gates: release builds reject them, callback errors
// cannot change normal ownership, and a stale detach never removes a successor.
for(const file of ['ReadingBodyImageHost.ts','MangaImageGraphicsHost.ts']){
 for(const [DEBUG,BUILD_MODE_NAME,allowed] of [[true,'debug',true],[false,'debug',false],[true,'release',false]]){
  const Host=productionMotionMethods(new URL('ets/app/'+file,root),['attachDiagnosticObserver','observeDiagnostic'],{DEBUG,BUILD_MODE_NAME});const host=new Host();
  if(!allowed){assert.throws(()=>host.attachDiagnosticObserver(()=>{}),/UNAVAILABLE/);continue;}
  const detach=host.attachDiagnosticObserver(()=>{throw Error('observer cannot break decoding')});assert.doesNotThrow(()=>host.observeDiagnostic({event:'open'}));
  assert.throws(()=>host.attachDiagnosticObserver(()=>{}),/UNAVAILABLE/);detach();let seen=0;const detach2=host.attachDiagnosticObserver(()=>seen++);detach();host.observeDiagnostic({event:'open'});assert.equal(seen,1);detach2();
 }
}
const page=readFileSync(new URL('ets/pages/ReaderMangaPlatformDiagnostic.ets',root),'utf8');
assert.match(page,/loadingStatus === 1/);assert.match(page,/event.width === frame.width/);
assert.match(page,/this.generation.*frame.id/);assert.match(page,/10000/);
assert.equal(/https?:|bookshelf\.|reading\.progress\.|source\.import/.test(runnerCode),false);
console.log('PASS fixed SHA/golden assets, actual runner negative pixel/preencode/display cases, native-boundary ownership accounting, cancellation, release gate, stale detach, bounded readback, no user-data/network route. Native calls are mocked here; target evidence remains OPEN.');
// Native boundaries are mocked, but these are the actual modified production
// body/graphics methods, with real observer cancellation and finally ownership.
for(const cancel of [false,true]){
 let current=true,size={width:3,height:2};const events=[];
 const image={createImageSource(){return {async getImageInfo(){return {size:{width:3,height:2},mimeType:'image/png'}},async createPixelMap(options){assert.deepEqual(options.desiredRegion,{x:0,y:0,size:{width:3,height:2}});return {async getImageInfo(){return {size}},async rotate(){size={width:2,height:3}},async release(){}}},async release(){}}}};
 const Host=productionMotionMethods(new URL('ets/app/ReadingBodyImageHost.ts',root),['withDecodedPixelMap','assertCurrent','attachDiagnosticObserver','observeDiagnostic'],{image,DEBUG:true,BUILD_MODE_NAME:'debug',MAX_READING_IMAGE_DIMENSION:4096,MAX_READING_IMAGE_PIXELS:4194304});
 const owner=new Host();owner.assertMangaImageMetadata=async()=>6;owner.boundedDecodeSize=(width,height)=>({width,height});
 const detach=owner.attachDiagnosticObserver(event=>{events.push(event);if(cancel&&event.event==='open'&&event.resource==='pixel')current=false;});
 const task=owner.withDecodedPixelMap(new Uint8Array([1,2,3]),()=>current,async(_map,w,h)=>[w,h],0,'digest');
 if(cancel)await assert.rejects(task,/cancelled/);else assert.deepEqual(await task,[2,3]);
 for(const resource of ['source','pixel'])assert.equal(events.filter(e=>e.resource===resource&&e.event==='open').length,events.filter(e=>e.resource===resource&&e.event==='release').length);
 assert.equal(events.filter(e=>e.event==='region').length,1);detach();
}
{
 const {validateMangaGraphicsPlan,validateMangaGraphicsDimensions}=await import('../entry/src/main/ets/app/MangaImageGraphicsPlan.ts');
 const actual=read('graphics-input.png'),expected=read('graphics-expected-rgba.bin');
 const original=readFileSync(new URL('fixtures/manga-graphics/input-rgba.bin',import.meta.url));
 const plan=JSON.parse(Buffer.from(read('graphics-plan.json')).toString());
 for(const cancel of [false,true]){
  let current=true;const events=[];const info={mimeType:'image/png',size:{width:8,height:103},pixelFormat:3};
  const image={PixelMapFormat:{RGBA_8888:3,RGB_565:2},createImageSource(){return {async getImageInfo(){return info},async getFrameCount(){return 1},async createPixelMap(){return {async getImageInfo(){return info},async readPixels(area){for(let y=0;y<area.region.size.height;y++)new Uint8Array(area.pixels).set(original.subarray((area.region.y+y)*32,(area.region.y+y+1)*32),area.offset+y*area.stride)},async release(){}}},async release(){}}},async createPixelMap(){return {async release(){}}},createImagePacker(){return {async packing(){return new Uint8Array([1,2,3]).buffer},async release(){}}}};
  const Host=productionMotionMethods(new URL('ets/app/MangaImageGraphicsHost.ts',root),['attachDiagnosticObserver','observeDiagnostic','transform','performTransform','current','encoded','dimensions','diagnosticPending'],{image,DEBUG:true,BUILD_MODE_NAME:'debug',MAX_BYTES:16777216,validateMangaGraphicsPlan,validateMangaGraphicsDimensions});
  const owner=new Host();owner.pending=0;owner.tail=Promise.resolve();let pixels;
  const detach=owner.attachDiagnosticObserver(event=>{events.push(event);if(event.event==='pre-encode')pixels=event.pixels.slice();if(cancel&&event.resource==='pixel'&&event.event==='open')current=false;});
  const task=owner.transform(actual,plan,()=>current);if(cancel)await assert.rejects(task,/CANCELLED/);else{await task;assert.deepEqual(pixels,expected);}
  for(const resource of ['source','pixel','packer'])assert.equal(events.filter(e=>e.resource===resource&&e.event==='open').length,events.filter(e=>e.resource===resource&&e.event==='release').length);
  assert.equal(owner.diagnosticPending(),0);detach();
 }
}
console.log('PASS actual production regional decode and strip transform observation: exact independent pre-encode pixels, cancellation after native allocation, balanced release, unchanged queue settlement.');
