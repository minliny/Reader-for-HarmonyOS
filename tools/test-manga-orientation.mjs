import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {stripTypeScriptTypes} from 'node:module';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const root=new URL('./fixtures/manga-orientation/',import.meta.url);
const fixtures=JSON.parse(readFileSync(new URL('goldens.json',root),'utf8'));
const code=stripTypeScriptTypes(readFileSync(new URL('../entry/src/main/ets/app/ReadingBodyImageHost.ts',import.meta.url),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''));
let fixture, pixels, current=true, cancelOnRotate=false, released=0, closed=0, decoded=[];
class Pixels {
 constructor(width,height,rgba){this.width=width;this.height=height;this.rgba=rgba;}
 async getImageInfo(){return {size:{width:this.width,height:this.height}};}
 async flip(horizontal,vertical){
  const output=Buffer.alloc(this.rgba.length);
  for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++)this.rgba.copy(output,(y*this.width+x)*4,((vertical?this.height-1-y:y)*this.width+(horizontal?this.width-1-x:x))*4,((vertical?this.height-1-y:y)*this.width+(horizontal?this.width-1-x:x))*4+4);
  this.rgba=output;
 }
 async rotate(degrees){
  for(let turn=0;turn<degrees/90;turn++){
   const width=this.height,height=this.width,output=Buffer.alloc(this.rgba.length);
   for(let y=0;y<this.height;y++)for(let x=0;x<this.width;x++)this.rgba.copy(output,(x*width+width-y-1)*4,(y*this.width+x)*4,(y*this.width+x)*4+4);
   this.width=width;this.height=height;this.rgba=output;
  }
  if(cancelOnRotate)current=false;
 }
 release(){released++;}
}
const image={createImageSource:()=>({
 async getImageInfo(){return {size:{width:fixture.width,height:fixture.height},mimeType:fixture.mimeType};},async getFrameCount(){return 1;},
 async createPixelMap(options){
  assert.equal(options.desiredSize,undefined);const r=options.desiredRegion;assert.ok(r);assert.ok(r.size.width*r.size.height<=1024*1024);
  assert.ok(r.x>=0&&r.y>=0&&r.x+r.size.width<=fixture.width&&r.y+r.size.height<=fixture.height);decoded.push(r);
  const source=Buffer.from(fixture.rgba??fixtures.cases.find(item=>item.file===fixture.rgbaFrom).rgba,'base64'),data=Buffer.alloc(r.size.width*r.size.height*4);
  for(let y=0;y<r.size.height;y++)source.copy(data,y*r.size.width*4,((r.y+y)*fixture.width+r.x)*4,((r.y+y)*fixture.width+r.x+r.size.width)*4);
  pixels=new Pixels(r.size.width,r.size.height,data);return pixels;
 },async release(){closed++;}
})};
const util={LRUCache:class {constructor(){this.data=new Map();}get(key){return this.data.get(key);}put(key,value){this.data.set(key,value);}remove(key){this.data.delete(key);}clear(){this.data.clear();}}};
const Host=new Function('image','util','hilog',`${code}\nreturn ReadingBodyImageHost;`)(image,util,{warn(){}});
const host=new Host();host.sha256=async bytes=>hash(bytes);let output;
host.materializeDisplayFile=async (bytes,map,width,height,digest,encoded)=>{assert.equal(encoded,true);output=Buffer.from(map.rgba);return 'file://oriented';};
host.setMangaMetadataInspector(async(bytes,sha256)=>({status:'present',orientation:fixture.orientation,sha256,bytes:bytes.length}));
for(fixture of fixtures.cases){
 const bytes=readFileSync(new URL(fixture.file,root));assert.equal(hash(bytes),fixture.sha256);
 const regions=[];decoded=[];const tileHeight=Math.min(fixture.outputHeight,2048,Math.floor(1024*1024/fixture.outputWidth));
 for(let y=0;y<fixture.outputHeight;y+=tileHeight){
  const tile=await host.loadBytes(bytes,()=>current,y/fixture.outputHeight);
  assert.equal(tile.intrinsicWidth,fixture.outputWidth);assert.equal(tile.intrinsicHeight,fixture.outputHeight);assert.equal(tile.regionY,y);
  assert.equal(tile.width,fixture.outputWidth);assert.equal(tile.height,Math.min(tileHeight,fixture.outputHeight-y));regions.push(output);
 }
 assert.equal(hash(Buffer.concat(regions)),fixture.outputSha256,fixture.file+' normalized pixel golden');
 const last=await host.loadBytes(bytes,()=>current,1);assert.equal(last.regionY+last.height,fixture.outputHeight);
}
assert.equal(released,closed,'every decoded native map/source must be released');
fixture=fixtures.cases.find(x=>x.orientation===7);const bytes=readFileSync(new URL(fixture.file,root));cancelOnRotate=true;
await assert.rejects(host.loadBytes(bytes,()=>current,0),/cancelled/);assert.equal(released,closed,'cancel between rotate/flip must release');
console.log(`PASS ${fixtures.cases.length} real PNG/JPEG/WebP fixture hashes and Pillow eight-direction pixel goldens; long image 2048/2048/15 crops join exactly; bounded region requests; normalized display coordinates; cancellation releases native objects. Codec and PixelMap are mocked; target pixels remain OPEN.`);
