import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderWindowMetricsSnapshot:M}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const {resolveReaderReadingLayout,resolveReaderControlLayout}=await import('../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const {resolveReaderPageChromeLayout,ReaderPageChromeMeasurements}=await import('../entry/src/main/ets/features/reading/ReaderPageChromeLayout.ts');
const file=n=>new URL('../entry/src/main/ets/'+n,import.meta.url);
const lre=file('features/reading/LocalReadingExperience.ets');
const panel=file('features/reading/ReaderControlPanel.ets');
const owner={};
const W=productionMotionMethods(file('app/ReaderWindowCoordinator.ts'),['statusBarRectVp','topAvoidRectVp','topCornersVp','rectVp'],
 {ReaderWindowCoordinator:owner,ReaderRectVp:R,ReaderDisplayCornerVp:C,window:{AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1}},display:{CornerType:{TOP_LEFT:0,TOP_RIGHT:1}}});
Object.setPrototypeOf(owner,W);
const visible={left:6,top:3,width:1170,height:144};
owner.mainWindow={getWindowAvoidArea:()=>({topRect:visible})};
assert.deepEqual(owner.statusBarRectVp(3),new R(2,1,390,48),'API21 uses public measured rectangle');
owner.mainWindow.getWindowAvoidAreaIgnoringVisibility=()=>{throw Error('801 unsupported');};
assert.deepEqual(owner.statusBarRectVp(3),new R(2,1,390,48),'API22 unavailable capability fallback');
owner.mainWindow.getWindowAvoidAreaIgnoringVisibility=()=>({topRect:{left:0,top:0,width:1170,height:150}});
assert.equal(owner.statusBarRectVp(3).height,50,'API22 measures hidden bar without toggling its visibility');
owner.mainWindow=undefined;assert.equal(owner.statusBarRectVp(3).height,0);
assert.deepEqual(owner.topCornersVp({},new R(),3),[new C(),new C()],'API23 absence does not throw');
assert.deepEqual(owner.topCornersVp({getRoundedCorner(){throw Error('801');}},new R(),3),[new C(),new C()]);
const corners=owner.topCornersVp({x:60,y:30,getRoundedCorner:()=>[
 {type:0,position:{x:150,y:150},radius:150},{type:1,position:{x:1020,y:150},radius:150}]},new R(20,10),3);
assert.deepEqual(corners,[new C(50,50,50),new C(340,50,50)]);
const measurement=new ReaderStatusBarMeasurement(),rect=new R(3,2,380,48);
assert.deepEqual(measurement.observeRect('p',false,rect,false),rect);
assert.deepEqual(measurement.observeRect('p',false,new R(),true),rect);
assert.equal(measurement.observeRect('other',false,new R(),true).height,0);
assert.equal(measurement.observeRect('l',true,new R(),true).height,0);
assert.deepEqual(measurement.observeRect('p',false,new R(),true),rect);
assert.equal(measurement.observeRect('p',false,new R(),false).height,0);
let metrics=new M();Object.assign(metrics,{ready:true,windowRect:new R(0,0,390,844),statusBarRect:new R(0,0,390,48),
 statusBarHeight:48,statusBarCutoutRect:new R(154,0,82,32),topLeftCorner:corners[0],topRightCorner:corners[1]});
for(const extended of [false,true])for(const scale of [1,1.5]){
 const reading=resolveReaderReadingLayout(390,844,false,metrics,extended);
 const text=new ReaderPageChromeMeasurements(200,14.4*scale,36,14.4*scale);
 const chrome=resolveReaderPageChromeLayout(reading,text);
 assert.equal((chrome.topStartY+chrome.topEndY)/2,reading.pageChromeVisualSafeTop+(48-14.4*scale)/2);
 assert.ok(chrome.topStartX>=24 && chrome.topStartX<100);
 assert.ok(chrome.topEndX+Math.min(36,chrome.topEndMaxWidth)<=366);
 if(extended){assert.ok(chrome.topStartX+chrome.topStartMaxWidth<154);assert.ok(chrome.topEndX>236);}
 const control=resolveReaderControlLayout(390,844,false,metrics);assert.ok(control.topBarTop>=48);
}
const source=readFileSync(lre,'utf8');
for(const [extended,controls,active,visible]of [[true,false,true,false],[true,true,true,true],[false,false,true,true],[false,true,false,false]]){
 const {owner:b}=createReaderBuilderProbe(source,['readerStatusBarUnderlay'],{ReaderWindowCoordinator:{metrics:()=>metrics},
 readerAppearanceThemeStyle:()=>({paperStart:'#FFE8D8B9'})});
 Object.assign(b,{windowChromeActive:active,readerSettingsSnapshot:{extendIntoCutout:extended},controlsPresentedForWindow:()=>controls,
 appearanceSnapshot:{activeTheme:'paper'}});b.readerStatusBarUnderlay();
 const rows=[...b.nodes.values()].filter(n=>n.id==='reader-status-bar-underlay');assert.equal(rows.length,visible?1:0,JSON.stringify([...b.nodes.values()]));
 if(visible){assert.equal(rows[0].height,48);assert.equal(rows[0].backgroundColor,'#FFE8D8B9');assert.equal(rows[0].zIndex,10);}
}
const B=productionMotionMethods(lre,['currentPageBookmarkStatus','toggleCurrentPageBookmark','pageBookmarkFeedbackAnchor','pageBookmarkFeedbackFilled','reconcilePageBookmarkFeedback','canStartReaderBookmarkGesture']);
let entries=[{index:0,title:'C',bookmarks:[]}],requests=[];
const b=Object.assign(new B(),{sourceId:'s',bookId:'b',mounted:true,visiblePage:{startScalar:10,endScalar:20},bookmarkPendingTarget:'',bookmarkMutationGeneration:0,
 bookmarkPreviewChanged:false,currentChapterIndex:()=>0,controlDirectoryEntries:()=>entries,currentPageBookmarkText:()=> 'original',onTogglePageBookmark:r=>requests.push(r),canTurnPage:()=>true});
assert.equal(b.pageBookmarkFeedbackFilled(),false);b.bookmarkPreviewChanged=true;assert.equal(b.pageBookmarkFeedbackFilled(),true);
b.toggleCurrentPageBookmark();b.bookmarkPreviewChanged=false;assert.equal(b.pageBookmarkFeedbackFilled(),true);assert.equal(b.canStartReaderBookmarkGesture(),false);
b.toggleCurrentPageBookmark();assert.equal(requests.length,1,'pending write cannot be repeated');
requests[0].onSettled(true);assert.equal(b.pageBookmarkFeedbackFilled(),true,'ACK before reactive projection keeps armed fill');
entries=[{index:0,title:'C',bookmarks:[{time:1,chapterOffset:10}]}];b.reconcilePageBookmarkFeedback();assert.equal(b.bookmarkPendingTarget,'');assert.equal(b.pageBookmarkFeedbackFilled(),true);
b.bookmarkPreviewChanged=true;assert.equal(b.pageBookmarkFeedbackFilled(),false,'existing bookmark reverses to hollow');
b.toggleCurrentPageBookmark();b.bookmarkPreviewChanged=false;assert.equal(b.pageBookmarkFeedbackFilled(),false);
requests[1].onSettled(false);assert.equal(b.pageBookmarkFeedbackFilled(),true,'uncertain/failed deletion must not falsely remove confirmed marker');
b.toggleCurrentPageBookmark();entries=[{index:0,title:'C',bookmarks:[]}];b.reconcilePageBookmarkFeedback();assert.notEqual(b.bookmarkPendingTarget,'');
requests[2].onSettled(true);assert.equal(b.bookmarkPendingTarget,'');assert.equal(b.pageBookmarkFeedbackFilled(),false,'projection before ACK also converges');
b.toggleCurrentPageBookmark();b.bookId='other';requests[3].onSettled(true);assert.equal(b.pageBookmarkFeedbackFilled(),false,'old-book completion cannot fill another book');
entries=[{index:0,title:'C',bookmarks:undefined}];assert.equal(b.canStartReaderBookmarkGesture(),false);
const day=readFileSync(file('../resources/base/media/reader_page_bookmark_filled.svg'),'utf8');
const outline=readFileSync(file('../resources/base/media/reader_directory_marker_bookmark_active.svg'),'utf8');
assert.match(day,/<path fill="#2F6373"/);assert.deepEqual([...day.matchAll(/ d="([^"]+)"/g)].map(m=>m[1]),[...outline.matchAll(/ d="([^"]+)"/g)].map(m=>m[1]));
const Refresh=productionMotionMethods(lre,['canRefreshCurrentChapter','refreshCurrentChapter','loadSessionChapter']);
let calls=[];const old={content:'old'};
const refresh=Object.assign(new Refresh(),{isControlInputEnabled:()=>true,phase:'ready',visiblePage:{startScalar:71},chapter:{chapterIndex:3},
 pageTurnSettlementActive:false,pageTurnInputOwned:false,pauseAutoPage:r=>calls.push(r),selectChapterAnchor:(...a)=>calls.push(a),bookId:'b',
 chapterWindow:{get:()=>old},activeGateway:()=>({loadChapter:async(...a)=>{calls.push(a);return {content:'new'};}})});
refresh.refreshCurrentChapter();assert.deepEqual(calls[1],[3,71,false,true,undefined,-2,false,true]);
assert.equal(await refresh.loadSessionChapter(3,()=>true),old);assert.equal((await refresh.loadSessionChapter(3,()=>true,true)).content,'new');assert.equal(calls.at(-1)[3],true);
refresh.pageTurnInputOwned=true;const n=calls.length;refresh.refreshCurrentChapter();assert.equal(calls.length,n,'refresh does not compete with a held page gesture');
const More=productionMotionMethods(panel,['performMoreAction']);let actions=[];const more=Object.assign(new More(),{moreMenuVisible:true,inputEnabled:true,chapterRefreshEnabled:false,
 dismissMoreMenu(){this.moreMenuVisible=false;actions.push('dismiss');},onOpenBookInfo:()=>actions.push('info'),onRefreshChapter:()=>actions.push('refresh')});
more.performMoreAction('refresh');assert.deepEqual(actions,[]);more.chapterRefreshEnabled=true;more.performMoreAction('refresh');more.performMoreAction('refresh');assert.deepEqual(actions,['dismiss','refresh']);
const {owner:menu}=createReaderBuilderProbe(readFileSync(panel,'utf8'),['readerMoreMenu','readerMoreAction'],{});
Object.assign(menu,{appScheme:'day',chapterRefreshEnabled:true,layout:{viewportWidth:390,viewportHeight:844,topBarTop:48,topBarWidth:340,dockBottomGap:24}});menu.readerMoreMenu();
assert.deepEqual([...menu.nodes.values()].filter(n=>n.type==='Text').map(n=>n.create),['书籍信息','刷新本章']);
console.log('PASS PH56–59 production SDK methods/Builders: measured regions/API fallback, reader underlay, bookmark threshold+ACK ordering, safe force refresh and two-action More; OEM pixels are not asserted');

const Index=productionMotionMethods(file('pages/Index.ets'),['performReaderPageBookmarkCreation','performDirectoryBookmarkDeletion'],
 {mergeReaderControlBookmarkProjection:(_old,fresh)=>fresh,hilog:{error(){}},DOMAIN:1});
for(const outcome of ['success','write-failed','projection-failed']){
 let result,finished=0,projectionFailure;
 const i=Object.assign(new Index(),{detailToc:[],reloadDirectoryBookmarkProjection:async()=>{
  if(outcome==='projection-failed')throw Error('projection');return [{index:0,bookmarks:[{time:1,chapterOffset:10}]}];},
 clearDirectoryBookmarkProjectionFailure(){},failDirectoryBookmarkProjection(_book,kind){projectionFailure=kind;},finishDirectoryBookmarkMutation(){finished++;}});
 await i.performReaderPageBookmarkCreation({createPositionBookmark:async()=>{if(outcome==='write-failed')throw Error('write');}},
 {title:'Book',author:'A'},{chapterIndex:0,chapterOffset:10,chapterTitle:'C',bookText:'original',onSettled:r=>result=r},()=>true,1,'b');
 assert.equal(result,outcome!=='write-failed','confirmed write survives subsequent projection failure');assert.equal(finished,1);
 if(outcome==='projection-failed')assert.equal(projectionFailure,'confirmed');
 if(outcome==='write-failed')assert.equal(projectionFailure,'uncertain');
}
console.log('PASS PH59 real Index write/projection acknowledgments: success and both failure boundaries');

// Real listener registration + full metric refresh: move without resize,
// duplicate events, hidden 180-degree rotation, unregister, and old callback.
const {ReaderInsetsVp:I}=await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const events=new Map(),displayEvents=new Map(),published=[];
let displayInfo={id:1,rotation:0,densityPixels:3,scaledDensity:3};
let globalX=0,hidden=false;
const movingWindow={on:(name,fn)=>events.set(name,fn),off:(name,fn)=>{assert.equal(events.get(name),fn);events.delete(name);},
 getWindowProperties:()=>({windowRect:{left:0,top:0,width:1170,height:2532},globalDisplayRect:{left:globalX,top:0,width:1170,height:2532}}),
 getWindowAvoidArea:type=>({leftRect:{width:0},rightRect:{width:0},bottomRect:{height:0},
  topRect:{left:0,top:0,width:1170,height:type===0&&!hidden?144:0}})};
const moving={mainWindow:movingWindow,metricsSnapshot:new M(),statusBarMeasurement:new ReaderStatusBarMeasurement(),statusBarHiddenApplied:false,
 desiredWindowPolicyOwner:'reader',desiredReaderWindowPolicy:{hideStatusBar:false},brightnessWriter:{reset(){}},installEpoch:1,windowPolicyRevision:1};
const MC=productionMotionMethods(file('app/ReaderWindowCoordinator.ts'),['registerWindowListeners','refreshMetrics','statusBarRectVp','topAvoidRectVp','topCornersVp','rectVp','avoidInsetsVp','sameRectVp','sameCornerVp','sameInsetsVp','detach'],
 {ReaderWindowCoordinator:moving,ReaderRectVp:R,ReaderDisplayCornerVp:C,ReaderInsetsVp:I,ReaderWindowMetricsSnapshot:M,ReaderStatusBarMeasurement,
  window:{AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1,TYPE_SYSTEM_GESTURE:2,TYPE_NAVIGATION_INDICATOR:3,TYPE_KEYBOARD:4}},
  display:{getDefaultDisplaySync:()=>displayInfo,CornerType:{TOP_LEFT:0,TOP_RIGHT:1},on:(n,f)=>displayEvents.set(n,f),off:(n,f)=>{assert.equal(displayEvents.get(n),f);displayEvents.delete(n);}},
  AppStorage:{setOrCreate:(...args)=>published.push(args)}});
Object.setPrototypeOf(moving,MC);moving.registerWindowListeners(movingWindow);moving.refreshMetrics();assert.equal(moving.metricsSnapshot.statusBarHeight,48);
const moved=events.get('rectChangeInGlobalDisplay');globalX=90;moved({});assert.equal(moving.metricsSnapshot.globalRect.left,30);
const afterMove=published.length;events.get('windowRectChange')({});events.get('windowSizeChange')({});assert.equal(published.length,afterMove,'duplicate native geometry events do not re-render parents');
hidden=true;moving.statusBarHiddenApplied=true;moving.desiredReaderWindowPolicy.hideStatusBar=true;events.get('avoidAreaChange')({});assert.equal(moving.metricsSnapshot.statusBarHeight,48);
displayInfo={...displayInfo,rotation:2};displayEvents.get('change')(1);assert.equal(moving.metricsSnapshot.statusBarHeight,0,'API21 hidden 180 degree rotation cannot borrow old orientation region');
moving.detach();assert.equal(events.size,0);assert.equal(displayEvents.size,0);const afterDetach=published.length;moved({});assert.equal(published.length,afterDetach,'stale position listener cannot publish into a new Window');
console.log('PASS PH57 actual Window position/display listeners, equality dedup, rotation invalidation and resource release');

let unavailable=[{index:0,title:'C',bookmarks:[]}],confirmedCallback;
const confirmed=Object.assign(new B(),{sourceId:'s',bookId:'confirmed',mounted:true,visiblePage:{startScalar:10,endScalar:20},bookmarkPendingTarget:'',bookmarkMutationGeneration:0,
 bookmarkPreviewChanged:false,currentChapterIndex:()=>0,controlDirectoryEntries:()=>unavailable,currentPageBookmarkText:()=> 'original',onTogglePageBookmark:r=>confirmedCallback=r.onSettled,canTurnPage:()=>true});
confirmed.toggleCurrentPageBookmark();unavailable=[{index:0,title:'C',bookmarks:undefined}];confirmed.reconcilePageBookmarkFeedback();confirmedCallback(true);
assert.equal(confirmed.pageBookmarkFeedbackFilled(),true);assert.equal(confirmed.canStartReaderBookmarkGesture(),false,'confirmed write + failed projection retains marker but cannot repeat mutation');
const {owner:confirmedView}=createReaderBuilderProbe(source,['bookmarkCornerFeedback','pageBookmarkFeedbackFilled','pageBookmarkFeedbackAnchor'],{});
Object.assign(confirmedView,confirmed,{controlVisible:()=>false,controlObscured:false,bookmarkPageOffsetY:0,readerAppScheme:'day',viewportWidth:390,
 currentPageBookmarkStatus:()=> 'unknown',readingLayout:()=>({pageChromeVisualSafeTop:0,pageChromeTopRegionHeight:48})});
confirmedView.bookmarkCornerFeedback();const painted=[...confirmedView.nodes.values()].filter(n=>n.type==='Image');assert.equal(painted.length,1);assert.match(painted[0].create,/reader_page_bookmark_filled/);
console.log('PASS PH59 confirmed Core write with unavailable projection retains actual filled Builder and locks repeat writes');
