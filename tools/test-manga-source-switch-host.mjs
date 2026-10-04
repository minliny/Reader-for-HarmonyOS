import assert from 'node:assert/strict';
import { fixture, settle } from './lib/source-switch-owner-probe.mjs';
const pages=[0,1].map(ordinal=>({ordinal,pageId:`mp1:${String(ordinal).repeat(64)}`,resourceRef:`manga:mp1:${String(ordinal).repeat(64)}`}));
const chapter={sourceId:'new',bookId:'target',chapterId:'https://target/0'};
const target={contentKind:'manga',sourceVersion:'v1',identity:{sourceId:'new',bookId:'target'},book:{title:'Book',author:'Writer'},
 entries:[{index:0,title:'Chapter 1',url:chapter.chapterId,variables:[]}],continuationVariables:[],hostRequirements:[]};
const location=(ch,revision)=>({kind:'manga',chapter:ch,manifestVersion:'v',pageId:pages[1].pageId,pageOrdinalFallback:1,x:0,y:0,progressRevision:revision});
const checks=[];
for(const mode of ['success','image-fail','lost-ACK','retired-after-ACK']) {
 let f,committed=false;
 f=fixture({open:false,targetSession:target,configureRuntime(runtime,calls){
  const original=runtime.request.bind(runtime);
  runtime.supportsCoreCapability=()=>true;
  runtime.loadReadingImage=async()=>{if(mode==='image-fail')throw Error('image failed');return{fileUri:'file://fixture',width:600,height:800,revision:'pixels'};};
  runtime.releaseReadingImage=()=>{};
  runtime.request=async(method,p,o={})=>{
   if(method==='source.list'){const r=await original(method,p,o);r.data.sources=r.data.sources.map(row=>({...row,bookSource:{bookSourceType:2}}));return r;}
   if(['cache.book.status','reading.progress.get','manga.chapter.get','manga.sourceSwitch.commit'].includes(method)) {
    calls.push([method,p,o]);
    if(method==='cache.book.status')return{data:{sourceId:'old',bookId:'book',tocAvailable:true,sourceVersion:'v1',catalogVersion:'c1',contextVersion:'x1',
     continuationVariables:{},chapters:[{chapterIndex:0,title:'Chapter 1',url:'https://old/0',variables:{}}]}};
    if(method==='reading.progress.get')return{data:{token:{epoch:2,revision:p.sourceId==='old'?1:0},location:p.sourceId==='old'?location({sourceId:'old',bookId:'book',chapterId:'https://old/0'},1):null}};
    if(method==='manga.chapter.get')return{data:{manifest:{chapter,manifestVersion:'v',sourceRuleVersion:'v1',decodeRevision:'identity-v1',pages},chapterIndex:0,chapterTitle:'Chapter 1',cached:false,
     resources:pages.map(page=>({resourceRef:page.resourceRef,request:{url:`https://fixture/${page.ordinal}`}}))}};
    assert.equal(o.shouldCancel,undefined);assert.equal(o.canDispatch(),true);o.onDispatch();committed=true;
    if(mode==='lost-ACK')throw Error('lost ACK');
    if(mode==='retired-after-ACK')f.retire();
    return{data:{mapping:'approximate',progress:{token:{epoch:2,revision:1},location:location(chapter,1)}}};
   }
   if(method==='bookshelf.get'&&p.sourceId==='new') {calls.push([method,p,o]);return{data:{book:{...chapter,title:'Book',author:'Writer',addedAt:1,sortIndex:0,contentKind:'manga'}}};}
   return original(method,p,o);
  };
 }});
 f.context.query.contentKind='manga';
 assert.equal(f.host.open(f.context,f.lease),true);await settle();
 assert.equal(f.host.current().state.kind,'candidates');
 assert.equal(f.candidate().category,'comic');
 await f.host.pick(f.candidate(),f.host.current().scopeId);
 assert.equal(committed,mode!=='image-fail');
 assert.equal(f.calls.some(([method])=>method==='chapter.content'||method==='source.switch.commit'),false);
 assert.equal(f.effects.filter(e=>e.kind==='targetReady').length,mode==='success'?1:0);
 if(mode==='lost-ACK')assert.equal(f.host.current().write.confirmation,'unknown','readbacks never manufacture a lost ACK');
 if(mode==='retired-after-ACK')assert.equal(f.host.current().write.confirmation,'confirmed','late ACK retained without navigation');
 if(mode==='success')assert.equal(f.effects.at(-1).session.contentKind,'manga');
 checks.push('actual-Host-Session-Resource-Switch-'+mode);
}
console.log(JSON.stringify({status:'PASS',checks,scope:'entire production SourceSwitchHost/Gateways and identity fences; controlled Core/OS transport; no device/source bytes'}));
