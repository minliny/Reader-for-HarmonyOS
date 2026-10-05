import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const root=new URL('../entry/src/main/ets/features/manga/',import.meta.url);
function load(name,dependencies={}) {
  const source=readFileSync(new URL(`${name}.ts`,root),'utf8').replace(/^import[\s\S]*?;\n/gm,'').replace(/^export type \{[^;]+;\n/gm,'').replace(/^export /gm,'');
  return new Function(...Object.keys(dependencies),`${stripTypeScriptTypes(source)};return ${name};`)(...Object.values(dependencies));
}
const MangaSessionGateway=load('MangaSessionGateway'),MangaResourceGateway=load('MangaResourceGateway');
const Controller=load('MangaSessionController',{MangaSessionGateway,MangaResourceGateway});
const chapter={manifest:{chapter:{sourceId:'target',bookId:'book',chapterId:'/chapter'},sourceRuleVersion:'rules',manifestVersion:'version',decodeRevision:'identity-v1',
  pages:Array.from({length:6},(_,ordinal)=>{const pageId=`mp1:${String(ordinal).padStart(64,'0')}`;return{ordinal,pageId,resourceRef:`manga:${pageId}`};})},chapterIndex:17,chapterTitle:'第17话',cached:false,resources:[]};
chapter.resources=chapter.manifest.pages.map(page=>({resourceRef:page.resourceRef,request:{url:`https://fixture.invalid/${page.ordinal}`}}));
function fixture(savedOrdinal=4,recoveryRequired=false) {
  let progress={token:{epoch:3,revision:8},location:{kind:'manga',chapter:chapter.manifest.chapter,manifestVersion:'version',
    pageId:chapter.manifest.pages[savedOrdinal].pageId,pageOrdinalFallback:savedOrdinal,x:.3,y:.7,progressRevision:8}};
  const original=structuredClone(progress),writes=[],loads=[],windows=[];
  const runtime={supportsCoreCapability:()=>true,async request(method,params){
    if(method==='manga.chapter.get')return{data:structuredClone(chapter)};
    if(method==='manga.pages.window') {
      windows.push(params);
      const pages=chapter.manifest.pages.slice(params.start,params.start+params.limit);
      return{data:{...structuredClone(chapter),pageStart:params.start,totalPages:6,
        manifest:{...structuredClone(chapter.manifest),pages},resources:chapter.resources.filter(resource=>pages.some(page=>page.resourceRef===resource.resourceRef))}};
    }
    if(method==='reading.progress.get')return{data:structuredClone(progress)};
    assert.equal(method,'reading.progress.update','entry does not mutate bookshelf or use source-switch commit');
    assert.equal(params.expectedRevision,progress.token.revision);writes.push(params);
    progress={token:{epoch:3,revision:params.location.progressRevision},location:params.location};return{data:structuredClone(progress)};
  },async loadReadingImage(...args){loads.push(args);return{fileUri:`file://page-${args[8]}`,width:600,height:800,revision:'pixels'};},releaseReadingImage(){}};
  const controller=new Controller(runtime);
  return{controller,original,writes,loads,windows,get progress(){return progress;},
    entry:{chapter:{...structuredClone(chapter),totalPages:6},progress:structuredClone(progress),targetOrdinal:savedOrdinal,recoveryRequired}};
}

for(const savedOrdinal of [0,4]) {
  const f=fixture(savedOrdinal,true);
  await f.controller.openPrepared(f.entry,false,true);
  assert.equal(f.controller.displayedOrdinal,0,'explicit source-switch preview starts at target chapter first image');
  assert.equal(f.controller.savedLocation,null,'old target intra-image coordinates cannot restore this entry');
  assert.equal(f.controller.recoveryRequired,false,'explicit chapter-first intent needs no prior-position acknowledgement');
  assert.equal(f.writes.length,0);assert.deepEqual(f.progress,f.original,'old target progress stays unchanged before displayed position save');
  await f.controller.savePosition(0,0,0);
  assert.equal(f.writes.length,1);assert.equal(f.controller.savedLocation.pageOrdinalFallback,0);
  assert.equal(f.controller.savedLocation.x,0);assert.equal(f.controller.savedLocation.y,0);
  await f.controller.close();
}
console.log('PASS prepared chapter-first intent ignores prior ordinal/coordinates/recovery and does not write until normal visible-position CAS');

{
  const f=fixture();await f.controller.open('target','book',17,false,false,undefined,true);
  assert.equal(f.controller.displayedOrdinal,0);assert.equal(f.controller.savedLocation,null);assert.equal(f.writes.length,0);
  await f.controller.close();
  await f.controller.openPrepared(f.entry);
  assert.equal(f.controller.displayedOrdinal,4);assert.deepEqual(f.controller.savedLocation,f.original.location);
  assert.equal(f.writes.length,0);await f.controller.close();
}
console.log('PASS fallback chapter-first path and later ordinary prepared resume preserve their separate intents');

{
  const f=fixture();
  f.entry.chapter.manifest.pages=f.entry.chapter.manifest.pages.slice(4);
  f.entry.chapter.resources=f.entry.chapter.resources.slice(4);f.entry.chapter.pageStart=4;
  await f.controller.openPrepared(f.entry,false,true);
  assert.equal(f.controller.displayedOrdinal,0);assert.equal(f.controller.savedLocation,null);
  assert.equal(f.writes.length,0);assert.equal(f.windows.length,1);
  assert.equal(f.windows[0].start,0);assert.ok(f.windows[0].limit<=3,'target first image uses existing bounded Core facts window');
  assert.equal(f.controller.pageAt(0).pageId,chapter.manifest.pages[0].pageId);
  await f.controller.close();
}
console.log('PASS narrow cached entry centered on old page fetches bounded first-page facts without full chapter reparse or progress writes');

{
  const f=fixture();await f.controller.open('target','book',17);
  assert.equal(f.controller.displayedOrdinal,4);assert.deepEqual(f.controller.savedLocation,f.original.location);
  await f.controller.close();
}
console.log('PASS ordinary uncached resume retains previous target page and intra-image coordinates');
