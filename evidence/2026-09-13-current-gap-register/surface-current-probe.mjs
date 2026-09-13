import { productionMotionMethods } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/tools/lib/reader-motion-method-probe.mjs';
import { createDefaultReaderWindowMetrics } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { resolveReaderReadingLayout } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';
const base='/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/';
const tick=()=>new Promise(r=>setTimeout(r,0));
let completeImport;
const imported = new Promise(r=>completeImport=r);
class Gateway { selectLocalBookInputs(){return Promise.resolve([{}]);} importPreparedSelections(){return imported;} }
class Presentation { constructor(state,batch){this.state=state;this.batch=batch;} }
const Import=productionMotionMethods(base+'pages/Index.ets',['beginImport'],{ReaderRuntimeOwner:{current:()=>({})},BookshelfFlowGateway:Gateway,LocalImportPresentation:Presentation,hilog:{error(){}},DOMAIN:1});
const ip=new Import(); Object.assign(ip,{route:'bookshelf',navigationGeneration:1,bookshelfLoadGeneration:0,currentImportPresentation:()=>undefined,writeImportPresentation(p){this.last=p;},applyBookshelfState(){this.applied=true;}});
const importing=ip.beginImport();await tick();ip.route='reading';ip.navigationGeneration=2;completeImport({batch:{state:'completed'},shelf:{}});await importing;
const Store=productionMotionMethods(base+'features/sync/WebDavCredentialStore.ts',['saveBookshelfViewMode'],{LOCAL_VIEW_MODE_KEY:'mode'});
const sp=new Store();let firstLoad,loadCount=0;let secure='cover',local='cover';Object.assign(sp,{localModeWriteTail:Promise.resolve(),ensureLocalPreferences:async()=>({put:async(k,v)=>{local=v;},flush:async()=>{}}),load:()=>++loadCount===1?new Promise(r=>firstLoad=r):Promise.resolve({bookshelfViewMode:secure}),save:async c=>{secure=c.bookshelfViewMode;}});
const first=sp.saveBookshelfViewMode('list');await tick();await sp.saveBookshelfViewMode('cover');firstLoad({bookshelfViewMode:'cover'});await first;
const layout=resolveReaderReadingLayout(390,844,false,createDefaultReaderWindowMetrics(),false,{compact:24,expanded:40});
let writes=[];const t0=Date.now();const Brightness=productionMotionMethods(base+'features/reading/LocalReadingExperience.ets',['enqueueReaderBrightness'],{window:{getLastWindow:()=>new Promise(r=>setTimeout(()=>r({getWindowProperties:()=>({brightness:0.5}),setWindowBrightness:async t=>writes.push({target:t,at:Date.now()-t0})}),24))},hilog:{error(){}}});
const bp=new Brightness();Object.assign(bp,{mounted:true,brightnessRequestGeneration:0,brightnessMutationQueue:Promise.resolve(),getUIContext:()=>({getHostContext:()=>({})}),rememberInitialWindowBrightness(){},admitReaderBrightness(){},refreshReaderBrightness(){}});
for(let i=0;i<6;i++){bp.enqueueReaderBrightness(0.2+i*0.1,'manual');await new Promise(r=>setTimeout(r,16));}const dragStop=Date.now()-t0;await bp.brightnessMutationQueue;
console.log(JSON.stringify({importLateResult:{route:ip.route,applied:ip.applied,resultState:ip.last?.state},modeRace:{latestIntent:'cover',local,secure},layout24:{actualLeft:layout.contentLeft,bodyWidth:layout.bodyWidth()},brightness:{lookupDelayMs:24,moveIntervalMs:16,dragStop,writes}},null,2));
