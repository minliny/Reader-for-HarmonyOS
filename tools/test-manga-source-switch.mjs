import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e;}}});
const {MangaSourceSwitchGateway}=await import('../entry/src/main/ets/features/manga/MangaSourceSwitchGateway.ts');
const pages=[0,1].map((ordinal)=>({ordinal,pageId:`mp1:${String(ordinal).repeat(64)}`,resourceRef:`manga:mp1:${String(ordinal).repeat(64)}`}));
const chapter={sourceId:'target',bookId:'b',chapterId:'/chapter'};
const manifest={chapter,manifestVersion:'v',sourceRuleVersion:'s',decodeRevision:'identity-v1',pages};
const oldLocation={kind:'manga',chapter:{sourceId:'old',bookId:'a',chapterId:'/old'},manifestVersion:'oldv',pageId:pages[1].pageId,pageOrdinalFallback:1,x:0,y:.5,progressRevision:1};
function fixture(){const calls=[],releases=[];let fail=false,current=true;
 const runtime={supportsCoreCapability:()=>true,async request(method,p){calls.push([method,p]);if(method==='reading.progress.get')return {data:{token:{epoch:2,revision:p.sourceId==='old'?1:0},location:p.sourceId==='old'?oldLocation:null}};
 if(method==='manga.chapter.get')return {data:{manifest,chapterIndex:3,chapterTitle:'C',cached:false,resources:pages.map(page=>({resourceRef:page.resourceRef,request:{url:`https://image.test/${page.ordinal}`}}))}};
 assert.equal(method,'manga.sourceSwitch.commit');return {data:{mapping:'approximate',progress:{token:{epoch:2,revision:1},location:{...oldLocation,chapter,manifestVersion:'v',pageOrdinalFallback:p.targetPageOrdinal,pageId:pages[p.targetPageOrdinal].pageId,x:0,y:0}}}};},
 async loadReadingImage(...args){assert.equal(args[12],manifest.decodeRevision,'source switch carries target decode fact');calls.push(['image']);if(fail)throw Error('image failed');return {fileUri:'file://img',width:600,height:800,revision:'pixels'};},releaseReadingImage(uri){releases.push(uri);}};
 return {gateway:new MangaSourceSwitchGateway(runtime),calls,releases,current:()=>current,cancel:()=>current=false,fail:()=>fail=true};}
const target={contentKind:'manga',sourceVersion:'s',identity:{sourceId:'target',bookId:'b'},entries:[{index:3,title:'C',url:'/chapter'}]};
{const f=fixture();const p=await f.gateway.prepare('old','a',target,'C',5,f.current);assert.equal(p.mapping,'approximate');assert.equal(p.targetPageOrdinal,1);assert.equal(f.releases.length,2);assert.equal(f.calls.filter(c=>c[0]==='image').length,2);await assert.rejects(f.gateway.commit(p,false,f.current),/CONFIRMATION/);assert.equal(f.calls.some(c=>c[0]==='manga.sourceSwitch.commit'),false);await f.gateway.commit(p,true,f.current);assert.equal(f.calls.at(-1)[1].expectedFrom.revision,1);}
{const f=fixture();f.fail();await assert.rejects(f.gateway.prepare('old','a',target,'C',3,f.current),/image failed/);assert.equal(f.calls.some(c=>c[0]==='manga.sourceSwitch.commit'),false);}
{const f=fixture();const p=await f.gateway.prepare('old','a',target,'C',3,f.current);f.cancel();await assert.rejects(f.gateway.commit(p,true,f.current),/CONFIRMATION/);}
console.log('PASS manga switch directly selects after saved-position and first/landing-image validation, retains old shelf on failed image, fences cancellation');

{
 const f=fixture();const grouped={...target,entries:[{index:5,title:'C',url:'/group',navigable:false},...target.entries]};
 const proposal=await f.gateway.prepare('old','a',grouped,'C',5,f.current);
 assert.equal(proposal.firstImage.chapterIndex,3,'non-readable group does not make unique readable title ambiguous');
 const empty=fixture();await assert.rejects(empty.gateway.prepare('old','a',{...grouped,entries:grouped.entries.slice(0,1)},'C',5,empty.current),/没有对应章节/);
 assert.deepEqual(empty.calls.map(c=>c[0]),['reading.progress.get'],'group-only target cannot fetch or commit a chapter');
}
console.log('PASS manga source switching matches only readable titles/indices and refuses URL-bearing groups');
