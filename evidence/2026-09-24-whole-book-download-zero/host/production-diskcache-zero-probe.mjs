import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){
  if((specifier.startsWith('./')||specifier.startsWith('../'))&&!specifier.endsWith('.ts'))return next(`${specifier}.ts`,context);throw error;}}});
const root=new URL('../../../',import.meta.url);
const {ReadingOfflineGateway}=await import(new URL('entry/src/main/ets/features/reading/ReadingOfflineGateway.ts',root));
const {productionMotionMethods}=await import(new URL('tools/lib/reader-motion-method-probe.mjs',root));
const diskSource=readFileSync(new URL('entry/src/main/ets/app/ReadingImageDiskCache.ts',root),'utf8');
const executable=stripTypeScriptTypes(diskSource.replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''));
const handles=new Map();
const io={OpenMode:{CREATE:1,READ_WRITE:2,TRUNC:4},access:async p=>fs.access(p).then(()=>true,()=>false),
  stat:p=>fs.stat(p),mkdir:(p,recursive)=>fs.mkdir(p,{recursive}),listFile:p=>fs.readdir(p),rmdir:p=>fs.rmdir(p),unlink:p=>fs.unlink(p),
  open:async p=>{const h=await fs.open(p,'w+');handles.set(h.fd,h);return h;},
  write:async(fd,b)=>(await handles.get(fd).write(new Uint8Array(b))).bytesWritten,
  fsync:async fd=>handles.get(fd).sync(),close:async h=>{handles.delete(h.fd);await h.close();},rename:(a,b)=>fs.rename(a,b),
  AtomicFile:class{constructor(p){this.path=p;}readFully(){const b=readFileSync(this.path);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}}};
const util={TextEncoder:class{encodeInto(v){return new TextEncoder().encode(v);}},TextDecoder:{create:(_,o)=>({decodeToString:b=>new TextDecoder('utf-8',o).decode(b)})}};
const crypto={createMd:()=>{const hash=createHash('sha256');return{update:async({data})=>{hash.update(data);},digest:async()=>({data:hash.digest()})};}};
const Cache=new Function('fileIo','statfs','cryptoFramework','util','canonicalReadingImageBaseUrl',
  'assertReadingOfflineWriteCapacity','ReadingOfflineMaterializationError',`${executable};return ReadingImageDiskCache;`)(
  io,{getFreeSize:async()=>1e9},crypto,util,b=>b?.trim().split('#')[0]||undefined,()=>{},Error);
const directory=await fs.mkdtemp(join(tmpdir(),'reader-download-zero-'));
try {
  const cache=new Cache({filesDir:directory});
  const Owner=productionMotionMethods(new URL('entry/src/main/ets/app/ReaderRuntimeOwner.ts',root).pathname,
    ['markOfflineImageChapterComplete','isOfflineImageChapterComplete','isOfflineImageChapterMaterialized']);
  const sourceId='https://m.popofree.com#🎃',bookId='/novel/100749/';
  const book={acquisitionMode:'online',identity:{sourceId,bookId},detailUrl:bookId,tocUrl:'/toc',book:{title:'终宋',author:'fixture'},continuationVariables:[],hostRequirements:[],
    entries:[{index:0,title:'正文',url:'https://fixture.invalid/chapter/0',variables:[]}]};
  let state='missing',cachedBytes=0,exactIdentity;
  const owner=Object.assign(new Owner(),{readingImageDiskCache:cache,request:async(method,params)=>{
    if(method==='cache.book.prefetch'){state='inProgress';cachedBytes=60;return{data:{sourceId,bookId,chapterRange:params.chapterRange,materializations:[{chapterIndex:0,token:'valid-token'}]}};}
    if(method==='chapter.content')return{data:{sourceId,bookId,chapterTitle:'正文',content:'这是一段有效的正文，完整下载成功后应报告一章完成。',via:'cache'}};
    if(method==='cache.chapter.materialization.report'){state=params.outcome;return{data:{sourceId,bookId,chapterIndex:0,state,retainedCachedBody:true}};}
    if(method==='cache.book.status')return{data:{sourceId,bookId,chapters:[{chapterIndex:0,state,cachedBytes}]}};
    throw Error(method);
  }});
  const mark=owner.markOfflineImageChapterComplete.bind(owner);
  owner.markOfflineImageChapterComplete=async(chapter,resources)=>{exactIdentity=chapter;return mark(chapter,resources);};
  const progress=[];
  const projection=await new ReadingOfflineGateway(owner).prefetchBook(book,()=>true,p=>progress.push(p.completedChapters));
  assert.equal(state,'completed');
  assert.equal(await owner.isOfflineImageChapterComplete(exactIdentity),true);
  assert.equal(await owner.isOfflineImageChapterMaterialized(sourceId,bookId,0),false);
  assert.equal(projection[0].downloadState,'cached');
  const Index=productionMotionMethods(new URL('entry/src/main/ets/pages/Index.ets',root).pathname,
    ['downloadDirectoryBook','showOfflineDownloadFeedback'],{ReadingOfflineGateway,ReaderRuntimeOwner:{current:()=>owner},hilog:{error(){}},DOMAIN:0});
  const messages=[],errors=[];
  const p=Object.assign(new Index(),{remoteReadingSession:book,offlineMutationActiveKey:'',offlineMutationGeneration:0,
    detailToc:projection,mergeDirectoryBookmarks:e=>e,showReadingFailure:(...e)=>errors.push(e),
    getUIContext:()=>({getPromptAction:()=>({showToast:({message})=>messages.push(message)})})});
  p.downloadDirectoryBook();
  for(let i=0;i<200&&p.offlineMutationActiveKey!=='';i++)await new Promise(resolve=>setTimeout(resolve,1));
  assert.equal(p.offlineMutationActiveKey,'');
  assert.equal(messages.at(-1),'已下载 0/1 章，未完成的章节可重试');
  const report={productionClasses:['ReadingImageDiskCache','ReaderRuntimeOwner exact forwarding methods','ReadingOfflineGateway','Index download methods'],
    platformBoundary:'real temporary filesystem, Harmony API adapters from existing disk cache runtime test; synthetic Core successful text response; no device or network',
    coreState:state,exactIdentity,exactManifestComplete:await owner.isOfflineImageChapterComplete(exactIdentity),ordinalMaterialized:false,
    gatewayProjection:projection,progress,messages,errors};
  writeFileSync(new URL('production-diskcache-zero-probe.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await fs.rm(directory,{recursive:true,force:true});}
