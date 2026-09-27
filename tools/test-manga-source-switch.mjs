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
 assert.equal(method,'manga.sourceSwitch.commit');return {data:{mapping:'approximate',progress:{token:{epoch:2,revision:1},location:{...oldLocation,chapter,manifestVersion:'v',pageOrdinalFallback:p.targetPageOrdinal}}}};},
 async loadReadingImage(){calls.push(['image']);if(fail)throw Error('image failed');return {fileUri:'file://img',width:600,height:800,revision:'pixels'};},releaseReadingImage(uri){releases.push(uri);}};
 return {gateway:new MangaSourceSwitchGateway(runtime),calls,releases,current:()=>current,cancel:()=>current=false,fail:()=>fail=true};}
const target={contentKind:'manga',sourceVersion:'s',identity:{sourceId:'target',bookId:'b'},entries:[{index:3,title:'C',url:'/chapter'}]};
{const f=fixture();const p=await f.gateway.prepare('old','a',target,'C',5,f.current);assert.equal(p.mapping,'approximate');assert.equal(p.targetPageOrdinal,1);assert.equal(f.releases.length,2);assert.equal(f.calls.filter(c=>c[0]==='image').length,2);await assert.rejects(f.gateway.commit(p,false,f.current),/CONFIRMATION/);assert.equal(f.calls.some(c=>c[0]==='manga.sourceSwitch.commit'),false);await f.gateway.commit(p,true,f.current);assert.equal(f.calls.at(-1)[1].expectedFrom.revision,1);}
{const f=fixture();f.fail();await assert.rejects(f.gateway.prepare('old','a',target,'C',3,f.current),/image failed/);assert.equal(f.calls.some(c=>c[0]==='manga.sourceSwitch.commit'),false);}
{const f=fixture();const p=await f.gateway.prepare('old','a',target,'C',3,f.current);f.cancel();await assert.rejects(f.gateway.commit(p,true,f.current),/CONFIRMATION/);}
console.log('PASS manga switch requires consent, checks first and landing image, retains old shelf on failed image, fences cancellation');
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
for(const mode of ['success','cancel','image-fail','lost-response','navigation-away']){
 let committed=false,refresh=0,installed=0,consent=false,current=true;
 const proposal={expectedFrom:{epoch:2,revision:1},firstImage:{chapterIndex:3},chapterTitle:'C',targetPageOrdinal:1};
 class Sessions {async progress(){return {token:{epoch:2,revision:1},location:{chapter:{chapterId:'/old'}}};}}
 class Switch {async prepare(){if(mode==='image-fail')throw Error('image failed');return proposal;}async commit(_p,accepted){assert.equal(accepted,true);assert.equal(consent,true);committed=true;if(mode==='navigation-away')current=false;if(mode==='lost-response')throw Error('response lost');}}
 class Shelf {async loadShelfBook(source){return source==='old'?(committed?undefined:{sourceId:'old',bookId:'a'}):(committed?{sourceId:'target',bookId:'b',contentKind:'manga'}:undefined);}}
 const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),['switchMangaSource'],{MangaSessionGateway:Sessions,MangaSourceSwitchGateway:Switch,ReaderCoreGateway:Shelf,ReaderRuntimeOwner:{current:()=>({})},errorMessageOf:e=>e.message});
 const owner=Object.assign(new Index(),{detailBook:{sourceId:'old',bookId:'a'},remoteReadingSession:{contentKind:'manga',entries:[{url:'/old',title:'Saved Chapter',index:8}]},
 getSourceSwitchGateway:()=>({fetchTargetToc:async()=>({readingSession:target})}),getUIContext:()=>({showAlertDialog:dialog=>{assert.match(dialog.message,/近似/);consent=mode!=='cancel';(consent?dialog.primaryButton:dialog.secondaryButton).action();}}),refreshBookshelf:()=>refresh++,performSourceSwitchSeam:()=>installed++,closeSourceSwitch:()=>{},presentSourceSwitchAcquisitionFailure:()=>{}});
 await owner.switchMangaSource({sourceId:'target',bookUrl:'b',category:'comic'},()=>current);
 assert.equal(committed,!['cancel','image-fail'].includes(mode));
 assert.equal(installed,['success','lost-response'].includes(mode)?1:0);
 if(committed)assert.ok(refresh>0);
}
console.log('PASS actual Index manga switch: saved chapter, explicit approximation consent, cancelled/failed preparation, lost commit response reconciliation and navigation fence');
{
 const f=fixture();const grouped={...target,entries:[{index:5,title:'C',url:'/group',navigable:false},...target.entries]};
 const proposal=await f.gateway.prepare('old','a',grouped,'C',5,f.current);
 assert.equal(proposal.firstImage.chapterIndex,3,'non-readable group does not make unique readable title ambiguous');
 const empty=fixture();await assert.rejects(empty.gateway.prepare('old','a',{...grouped,entries:grouped.entries.slice(0,1)},'C',5,empty.current),/没有对应章节/);
 assert.deepEqual(empty.calls.map(c=>c[0]),['reading.progress.get'],'group-only target cannot fetch or commit a chapter');
}
console.log('PASS manga source switching matches only readable titles/indices and refuses URL-bearing groups');
