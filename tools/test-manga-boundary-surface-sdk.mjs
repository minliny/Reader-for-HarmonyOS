import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { mangaSurfaceSdkDependencies } from './lib/manga-surface-sdk-probe.mjs';
import { MangaStripProjection } from '../entry/src/main/ets/features/manga/MangaStripProjection.ts';
import { PhotoViewScaleModel } from '../entry/src/main/ets/features/manga/vendor/photoview/PhotoViewScaleModel.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

// Only Core/controller acquisition, timers, native frames/rectangles and haptics
// are controlled ports. Chapter sequencing, retention, position admission,
// callback identity and SDK-generated closure wiring are actual production code.
const root = new URL('../entry/src/main/ets/', import.meta.url);
const surfaceURL = new URL('features/manga/MangaReadingSurface.ets', root);
const shellURL = new URL('features/shell/ReaderShell.ets', root);
const indexURL = new URL('pages/Index.ets', root);
const source = readFileSync(surfaceURL, 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const parse = text => ts.createSourceFile('/tmp/MangaBoundarySurface.ets', text, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
const tree = parse(source);
assert.equal(tree.parseDiagnostics.length,0);
const DataSourceText = tree.statements.find(node => node.name?.getText(tree) === 'MangaStripDataSource').getText(tree);
const DataSource = new Function('MangaStripProjection', `${stripTypeScriptTypes(DataSourceText)};return MangaStripDataSource`)(MangaStripProjection);
const frameClass = name => new Function('FrameCallback',
  `${stripTypeScriptTypes(tree.statements.find(node=>node.name?.getText(tree)===name).getText(tree))};return ${name}`)(class {});
const MangaLayoutFrame = frameClass('MangaLayoutFrame');
const MangaSheetFrame = frameClass('MangaSheetFrame');
let activePorts;
const methods = ['boundaryEnabled','onBoundaryActivity','onBoundaryPull','captureChapterPixels','turnBoundaryChapter',
  'onChapterImageComplete','onChapterImageError','confirmBoundaryFrame','clearBoundaryFrameWait','cancelBoundaryChapter',
  'publish','rememberVisible','flushViewportObservation','onViewportScroll','queueViewportObservation','restore','finishLayout',
  'measureVisibleWindow','positionIdentity','saveVisible','effectiveFit','rowDisplayWidth','rowDisplayHeight','rowDisplayTop',
  'rowDisplayLeft','visibleX','displayChapterTitle','updateViewport','configureAdjacentChapter','adjacentChapter',
  'resizeViewport','changeZoom','toggleDirection','onWindowChromeChanged','openPanel'];
const Surface = productionMotionMethods(surfaceURL, methods, {
  MangaLayoutFrame, MangaSheetFrame, LengthMetrics: {vp:value=>({value,unit:0})},
  MangaBookPresentation: { revision: 0, admitConfirmedLocation(...args) { activePorts.admissions.push(args); } },
  MangaChapterTransitionCoordinator: class { constructor() { throw new Error('fixture must supply acquisition port'); } },
  AppStorage: { setOrCreate() {} }, hilog: {warn(){},error(){},info(...args){activePorts.traces.push(args);}},
  ScrollAlign: {START:0},
  setTimeout(callback, delay) { const id=activePorts.nextTimer++; activePorts.timers.set(id,{callback,delay}); return id; },
  clearTimeout(id) { activePorts.timers.delete(id); },
  vibrator: { async startVibration(...args) { activePorts.vibrations.push(args); } },
  inputMethod: {getController:()=>({hideTextInput:async()=>{}})},
});
const tick = () => new Promise(resolve => setImmediate(resolve));
const outcomes=[];
function controller(index, prefix, sameImages=false) {
  const manifest={chapter:{sourceId:'s',bookId:'b',chapterId:`chapter-${index}`},manifestVersion:`manifest-${index}`,
    sourceRuleVersion:'source-v1',pages:[{ordinal:0,pageId:sameImages?'shared-page':`page-${index}`,resourceRef:'r'}]};
  const images=new Map(Array.from({length:3},(_,tileIndex)=>[tileIndex,{fileUri:`file://${sameImages?'shared':prefix}-${tileIndex}.png`,revision:'r1'}]));
  const calls=[];
  return {chapter:{manifest,chapterIndex:index,chapterTitle:`Chapter ${index}`},totalPages:1,displayedOrdinal:0,
    recoveryRequired:false,savedLocation:null,preparationError:undefined,calls,images,
    pageAt:ordinal=>manifest.pages[ordinal],pageGeometry:()=>({width:600,height:1800,tileHeight:600}),
    tile:(ordinal,tileIndex)=>ordinal===0&&images.has(tileIndex)?{image:images.get(tileIndex)}:undefined,
    visiblePages:()=>[{ordinal:0,status:'ready'}],
    async setVisible(...args){calls.push(['visible',...args]);},async setTileWindow(...args){calls.push(['tiles',...args]);},
    async savePosition(ordinal,x,y){calls.push(['save',ordinal,x,y]);this.savedLocation={manifestVersion:manifest.manifestVersion,pageOrdinalFallback:ordinal,pageId:manifest.pages[ordinal].pageId,x,y};},
    async close(reason){calls.push(['close',reason]);},configureNextChapter(...args){calls.push(['next',...args]);},
  };
}
function fixture({sameImages=false,prepareFailure=false,originIndex=0,targetIndex=4}={}) {
  const ports={nextTimer:1,timers:new Map(),frames:[],admissions:[],vibrations:[],commits:[],traces:[],cancelCount:0,activateCount:0,presentCount:0,notifications:0};
  activePorts=ports;
  const origin=controller(originIndex,'origin',sameImages), target=controller(targetIndex,'target',sameImages);
  const owner=new Surface(), data=new DataSource();
  const native={offset:225,width:300,height:300,invalid:false,unmounted:false,layoutReady:true,earlyScrollCalls:0};
  const heights=()=>owner.controller===target&&native.targetHeights!==undefined?native.targetHeights:[300,300,300];
  const top=index=>heights().slice(0,index).reduce((sum,height)=>sum+height,0);
  const maximum=()=>Math.max(0,heights().reduce((sum,height)=>sum+height,0)-owner.viewportHeight);
  const scroller={getItemRect(index){if(native.unmounted||!native.layoutReady)throw new Error('native row not mounted');return {x:0,y:native.invalid?NaN:top(index)-native.offset,width:native.width,height:owner.controller===target&&native.targetHeights!==undefined?heights()[index]:native.height};},
    getItemIndex(_x,y){if(!native.layoutReady)return -1;return heights().findIndex((_height,index)=>top(index)<=y+native.offset&&top(index+1)>y+native.offset);},
    scrollToIndex(index,_smooth,_align,options){if(!native.layoutReady){native.earlyScrollCalls++;return;}native.pendingOffset=Math.min(top(index)+(options?.extraOffset?.value??0),maximum());},scrollBy(_x,y){if(!native.layoutReady){native.earlyScrollCalls++;return;}native.pendingOffset=Math.min((native.pendingOffset??native.offset)+y,maximum());},
    isAtEnd(){return native.offset>=maximum();}};
  const horizontal={offset:30,currentOffset(){return{xOffset:this.offset,yOffset:0};},scrollTo(value){this.offset=value.xOffset;}};
  const candidate={controller:target,landing:'first',targetOrdinal:0,landingTileIndex:0,location:{y:0,x:0},
    async activate(){ports.activateCount++;},confirmPresented(){ports.presentCount++;transitions.pending=false;},
    async cancel(){ports.cancelCount++;transitions.pending=false;}};
  const transitions={pending:false,async prepare(request){ports.prepare=request;this.pending=true;if(prepareFailure)throw new Error('controlled offline');return candidate;},
    async cancel(){ports.cancelCount++;this.pending=false;}};
  const entries=[{index:0,url:'chapter-0',title:'Chapter 0',navigable:true},{index:1,url:'',title:'Group',navigable:false},{index:4,url:'chapter-4',title:'Chapter 4',navigable:true}];
  Object.assign(owner,{controller:origin,data,runtime:{hasCurrentCatalogProjection:()=>true},sourceId:'s',bookId:'b',
    mounted:true,opened:true,horizontal:false,zoom:1,viewportWidth:300,viewportHeight:450,
    first:0,last:1,fitPreference:'width',recoveryRequired:false,recovering:false,exiting:false,
    panel:'',panelPhase:'closed',chapterEnd:false,windowChromeActive:true,windowChromeOverlayActive:false,
    loginRequiredForControls:false,error:'',restoringAnchor:false,layoutGeneration:0,appliedLayoutGeneration:0,
    viewportGeneration:0,viewportObservationGeneration:0,viewportObservationPending:false,
    presentationGeneration:0,publishedManifestVersion:origin.chapter.manifest.manifestVersion,
    publishedRowKeys:new Map(),mountedTurnRowKey:'',chapterCommitted:true,
    boundaryBusy:false,boundaryDragging:false,boundaryDirection:'',boundaryDistance:0,boundaryArmed:false,boundaryFailure:'',boundaryGeneration:0,boundaryReset:0,
    nativeTransitionImages:new Set(),nativeTransitionTimer:-1,previousChapterPixels:[],chapterTransitions:transitions,
    rollbackChapterImages:new Set(),boundaryPaintGeneration:0,rollbackPainting:false,
    scroller,horizontalScroller:horizontal,scalePolicy:new PhotoViewScaleModel(),offline:false,
    remoteSession:{sourceVersion:'source-v1',contentKind:'manga',identity:{sourceId:'s',bookId:'b'},entries},
    isReaderIdentityCurrent:()=>true,
    onAdjacentChapterCommitted:(...args)=>ports.commits.push(args),onChapterCommitted:(...args)=>ports.initialCommits=(ports.initialCommits??[]).concat([args]),
    onSaveFailure:message=>ports.saveFailure=message,
    getUIContext:()=>({postFrameCallback:frame=>ports.frames.push(frame),getFocusController:()=>({clearFocus(){}})}),
    applyWindowChrome(){},applyWindowPolicyForChromeOwner(){},loginRequired:()=>false,
    // These are font/platform presentation ports outside chapter admission.
    preparePanelFonts:async()=>false,
  });
  data.projection.publish(origin.chapter.manifest,()=>origin.pageGeometry(),undefined,1,ordinal=>origin.pageAt(ordinal));
  data.registerDataChangeListener({onDataReloaded(){ports.notifications++;native.layoutReady=false;},onDataChange(){ports.notifications++;}});
  assert.equal(owner.rememberVisible(),true);
  origin.onChange=()=>owner.publish();
  function flushTimers(delay=0){activePorts=ports;for(const[id,timer]of[...ports.timers])if(timer.delay===delay){ports.timers.delete(id);timer.callback();}}
  function flushFrames(){activePorts=ports;const batch=ports.frames.splice(0);for(const frame of batch)frame.onFrame(0);native.layoutReady=true;if(native.pendingOffset!==undefined){native.offset=native.pendingOffset;native.pendingOffset=undefined;}for(const frame of batch)frame.onIdle(2_000_000);}
  return {owner,ports,origin,target,candidate,native,entries,flushTimers,flushFrames};
}
async function begin(f){activePorts=f.ports;f.owner.onBoundaryActivity(true);const pending=f.owner.turnBoundaryChapter(1);await tick();assert.equal(f.owner.controller,f.target);return {pending};}
function imageBuilder(f,row,uri=f.owner.controller.tile(row.ordinal,row.tileIndex).image.fileUri,renderKey=f.owner.rowRenderKey(row),captured=f.owner.controller) {
  const properties=createArkUIPropertyRuntimeProbe();
  const built=createReaderBuilderProbe(source,['tileImage'],{...properties.sdk,ImageFit:{Fill:0}},properties.hooks);
  Object.assign(built.owner,{rowDisplayWidth:f.owner.rowDisplayWidth.bind(f.owner),
    traceBoundary:f.owner.traceBoundary.bind(f.owner),onChapterImageComplete:f.owner.onChapterImageComplete.bind(f.owner),onChapterImageError:f.owner.onChapterImageError.bind(f.owner)});
  built.owner.tileImage(row,uri,renderKey,captured,captured.chapter.manifest);
  const image=[...built.owner.nodes.values()].find(node=>node.type==='Image');
  assert.equal(typeof image.onComplete,'function');assert.equal(typeof image.onError,'function');return image;
}
async function completeVisible(f){activePorts=f.ports;f.flushTimers();f.flushFrames();await tick();
  for(let i=0;i<2;i++) imageBuilder(f,f.owner.data.getData(i)).onComplete({loadingStatus:1});
  f.flushFrames();await tick();}
{
  let calls=0;
  const frame=new MangaLayoutFrame(()=>calls++);
  frame.onFrame(0);assert.equal(calls,0,'frame start cannot establish rendered native geometry');
  frame.onIdle(2_000_000);frame.onIdle(2_000_000);assert.equal(calls,1,'one idle receipt runs layout work exactly once');
  outcomes.push('official FrameCallback phases keep geometry work after rendering, with one receipt per posted frame');
}
{
  const f=fixture({originIndex:4,targetIndex:0});
  f.owner.controller=f.target;f.owner.publish();f.owner.restore(0,1);
  assert.equal(f.native.layoutReady,false);
  f.flushTimers();assert.equal(f.native.earlyScrollCalls,0);assert.equal(f.native.offset,225);
  f.flushFrames();assert.equal(f.owner.restoringAnchor,true,'the first rendered frame admits scrolling, not its resulting geometry');
  assert.equal(f.owner.appliedLayoutGeneration,-1);
  f.flushFrames();await tick();
  assert.equal(f.native.earlyScrollCalls,0);assert.equal(f.owner.restoringAnchor,false);
  assert.equal(f.owner.scroller.isAtEnd(),true,'previous chapter tail is reached after the scroll renders');

  // Counterfactual timing uses the actual restore body with only its scheduler
  // replaced by the old JS timer. The native port rejects pre-layout scrolls.
  const declaration=tree.statements.find(node=>node.name?.getText(tree)==='MangaReadingSurface');
  const restoreText=declaration.members.find(node=>node.name?.getText(tree)==='restore').getText(tree);
  const oldText=restoreText.replace('this.getUIContext().postFrameCallback(new MangaLayoutFrame((): void => {','setTimeout((): void => {')
    .replace("this.finishLayout(generation);\n    }, (): void => { if (generation === this.layoutGeneration) this.traceBoundary('restore-frame'); }));",'this.finishLayout(generation);\n    }, 0);');
  assert.notEqual(oldText,restoreText);
  const legacy=new Function('setTimeout','ScrollAlign','LengthMetrics',`${stripTypeScriptTypes(`class LegacyRestore {${oldText}}`)};return LegacyRestore`)(
    (callback,delay)=>{const id=activePorts.nextTimer++;activePorts.timers.set(id,{callback,delay});return id;},{START:0},{vp:value=>({value,unit:0})});
  const old=fixture({originIndex:4,targetIndex:0});old.owner.controller=old.target;old.owner.publish();
  old.ports.frames.length=0;
  legacy.prototype.restore.call(old.owner,0,1);old.flushTimers();
  assert.equal(old.native.earlyScrollCalls,1,'timer restoration attempts the atomic index/offset request before the candidate layout exists');
  old.flushFrames();old.flushFrames();await tick();
  assert.equal(old.owner.scroller.isAtEnd(),false,'the old timer leaves native geometry away from the desired tail');
  outcomes.push('chapter replacement restores after native data layout and confirms a later rendered scroll; old timer counterfactual misses the tail');
}
{
  const f=fixture(), old=f.owner.confirmedPosition;
  f.owner.onBoundaryActivity(true);assert.deepEqual(f.owner.boundaryOrigin.anchor,old.anchor);const frozen=f.owner.boundaryOrigin;
  f.native.offset=320;assert.equal(f.owner.rememberVisible(),false);f.owner.flushViewportObservation();
  assert.equal(f.owner.confirmedPosition,frozen);await f.owner.saveVisible();assert.equal(f.origin.calls.filter(c=>c[0]==='save').length,0);
  f.owner.onBoundaryActivity(false);assert.equal(f.owner.boundaryDragging,false);
  outcomes.push('pull activity freezes the actual confirmed anchor and blocks durable saves');
}
{
  const f=fixture();const old=f.owner.confirmedPosition;const {pending}=await begin(f);
  assert.deepEqual(f.origin.calls.filter(c=>c[0]==='save')[0],['save',0,0.1,0.25]);
  assert.ok(f.owner.previousChapterPixels.length>0);assert.equal(f.origin.calls.some(c=>c[0]==='close'),false);
  await f.owner.saveVisible();assert.equal(f.target.calls.some(c=>c[0]==='save'),false);
  f.owner.confirmBoundaryFrame();await tick();assert.equal(f.ports.commits.length,0);
  const first=imageBuilder(f,f.owner.data.getData(0));
  first.onComplete({loadingStatus:0});imageBuilder(f,f.owner.data.getData(1)).onComplete({loadingStatus:0});
  first.onComplete();assert.equal(f.owner.nativeTransitionImages.size,0,'loaded bytes and missing status are not decoded native paint');
  first.onComplete({loadingStatus:1});f.flushFrames();await tick();
  assert.equal(f.ports.commits.length,0,'an Image callback before restored native layout cannot commit');
  f.flushTimers();f.flushFrames();await tick();
  assert.equal(f.owner.restoringAnchor,false);assert.equal(f.ports.commits.length,0,'landing image alone cannot admit another visible spinner');
  assert.equal(f.owner.confirmedPosition.controller,f.target);
  imageBuilder(f,f.owner.data.getData(1)).onComplete({loadingStatus:1});f.flushFrames();await pending;
  assert.equal(f.ports.presentCount,1);assert.deepEqual(f.ports.commits,[[4,'Chapter 4']]);
  assert.equal(f.owner.controller,f.target);assert.equal(f.owner.previousChapterPixels.length,0);
  assert.equal(f.origin.calls.some(c=>c[0]==='close'&&c[1]==='chapter'),true);
  assert.equal(f.target.calls.some(c=>c[0]==='save'),true);
  assert.equal(old.controller,f.origin);
  const before=f.ports.notifications;f.target.images.get(0).revision='r2';f.target.onChange();
  assert.ok(f.ports.notifications>before,'admitted controller onChange keeps executing real publication after transaction ends');
  outcomes.push('only all visible native Images plus a confirmed replacement layout admit and save the chapter; normal publication continues');
}
{
  const f=fixture({sameImages:true});
  const oldRow=f.owner.data.getData(0), oldURI=f.origin.tile(0,0).image.fileUri, oldKey=f.owner.rowRenderKey(oldRow);
  const stale=imageBuilder(f,oldRow,oldURI,oldKey,f.origin);const {pending}=await begin(f);
  assert.equal(oldURI,f.target.tile(0,0).image.fileUri);assert.notEqual(oldKey,f.owner.rowRenderKey(f.owner.data.getData(0)));
  stale.onComplete({loadingStatus:1});stale.onError();assert.equal(f.owner.nativeTransitionImages.size,0);
  const row=f.owner.data.getData(0);
  imageBuilder(f,row,oldURI,f.owner.rowRenderKey(row),f.origin).onComplete({loadingStatus:1});assert.equal(f.owner.nativeTransitionImages.size,0,'owner guard rejects even a reused current key/URI');
  imageBuilder(f,row,'file://wrong.png').onComplete({loadingStatus:1});assert.equal(f.owner.nativeTransitionImages.size,0);
  imageBuilder(f,row,f.target.tile(0,0).image.fileUri,'stale-render-key').onComplete({loadingStatus:1});assert.equal(f.owner.nativeTransitionImages.size,0);
  await completeVisible(f);await pending;assert.equal(f.ports.presentCount,1);
  outcomes.push('SDK Image closures reject stale owners even with identical row key/URI, as well as URI/render-key mismatches');
}
{
  const f=fixture();const {pending}=await begin(f);f.flushTimers();f.flushFrames();await tick();
  f.flushFrames();await tick();
  assert.equal(f.owner.restoringAnchor,false,'the second rendered frame confirms the restored layout before rectangle fault injection');
  for(let i=0;i<2;i++) imageBuilder(f,f.owner.data.getData(i)).onComplete({loadingStatus:1});
  f.native.invalid=true;f.flushFrames();await tick();assert.equal(f.ports.commits.length,0);
  f.native.invalid=false;f.native.unmounted=true;assert.doesNotThrow(()=>f.owner.confirmBoundaryFrame());assert.equal(f.ports.commits.length,0);
  f.native.unmounted=false;f.owner.confirmBoundaryFrame();await pending;
  outcomes.push('non-finite or unmounted native rectangles remain pending instead of admitting an unknown frame');
}
{
  const f=fixture({prepareFailure:true});activePorts=f.ports;const originPosition=f.owner.confirmedPosition;
  f.owner.onBoundaryActivity(true);await f.owner.turnBoundaryChapter(1);
  assert.equal(f.owner.controller,f.origin);assert.deepEqual(f.owner.confirmedPosition.anchor,originPosition.anchor);
  assert.equal(f.origin.calls.some(c=>c[0]==='close'),false);assert.equal(f.ports.cancelCount,1);
  assert.match(f.owner.boundaryFailure,/暂时打不开/);assert.equal(f.ports.commits.length,0);
  outcomes.push('preparation failure preserves the old controller, leases and confirmed coordinate');
}
{
  const f=fixture();const original=f.owner.confirmedPosition;
  const staleOrigin=imageBuilder(f,f.owner.data.getData(0));const {pending}=await begin(f);
  imageBuilder(f,f.owner.data.getData(0)).onError();await pending;
  assert.equal(f.owner.controller,f.origin);assert.deepEqual(f.owner.visibleAnchor,original.anchor);
  assert.equal(f.origin.calls.some(c=>c[0]==='close'),false);assert.equal(f.ports.commits.length,0);
  assert.equal(typeof f.origin.onChange,'function');
  assert.ok(f.owner.previousChapterPixels.length>0);assert.equal(f.owner.rollbackChapterController,f.origin);
  assert.equal(f.owner.boundaryEnabled(),false);
  const activated=f.ports.activateCount;
  await f.owner.turnBoundaryChapter(1);assert.equal(f.ports.activateCount,activated,'retry/manual controls cannot overtake the origin paint fence');
  f.flushFrames();f.flushFrames();await tick();
  assert.equal(f.owner.restoringAnchor,false);assert.deepEqual(f.owner.confirmedPosition.anchor,original.anchor);
  assert.ok(f.owner.previousChapterPixels.length>0,'rendered restore alone cannot remove the origin overlay');
  staleOrigin.onComplete({loadingStatus:1});assert.equal(f.owner.rollbackChapterImages.size,0,'the earlier origin mount cannot confirm this rollback');
  const last=f.owner.last;
  for(let index=f.owner.first;index<last;index++) imageBuilder(f,f.owner.data.getData(index)).onComplete({loadingStatus:1});
  f.flushFrames();assert.ok(f.owner.previousChapterPixels.length>0,'every visible origin Image must complete');
  imageBuilder(f,f.owner.data.getData(last)).onComplete({loadingStatus:1});f.flushFrames();
  assert.equal(f.owner.previousChapterPixels.length,0);assert.equal(f.owner.rollbackChapterController,undefined);
  assert.equal(f.owner.boundaryEnabled(),true);
  outcomes.push('native Image failure retains origin pixels through two-frame restore and every fresh visible Image before unlocking another pull');
}
{
  const f=fixture();const {pending}=await begin(f);
  const staleCandidate=imageBuilder(f,f.owner.data.getData(0));
  await f.owner.cancelBoundaryChapter();await pending;
  assert.equal(f.owner.controller,f.origin);assert.ok(f.owner.previousChapterPixels.length>0);
  staleCandidate.onComplete({loadingStatus:1});assert.equal(f.owner.rollbackChapterImages.size,0);
  f.flushFrames();f.flushFrames();assert.ok(f.owner.previousChapterPixels.length>0);
  for(let index=f.owner.first;index<=f.owner.last;index++) imageBuilder(f,f.owner.data.getData(index)).onComplete({loadingStatus:1});
  f.flushFrames();assert.equal(f.owner.previousChapterPixels.length,0);assert.equal(f.ports.commits.length,0);
  outcomes.push('explicit cancellation retains origin until its restored native paint and rejects a late candidate callback');
}
for(const [label,action] of [
  ['zoom',f=>f.owner.changeZoom(2)],
  ['rotation',f=>f.owner.resizeViewport(420,650)],
  ['background',f=>{f.owner.windowChromeActive=false;f.owner.onWindowChromeChanged();}],
  ['overlay',f=>{f.owner.windowChromeOverlayActive=true;f.owner.onWindowChromeChanged();}],
  ['panel',f=>f.owner.openPanel('appearance')],
]){
  const f=fixture();const original=f.owner.confirmedPosition;const {pending}=await begin(f);await action(f);await pending;
  assert.equal(f.owner.controller,f.origin,label);assert.equal(f.ports.commits.length,0,label);
  assert.equal(f.origin.calls.some(c=>c[0]==='close'),false,label);
  assert.equal(f.owner.boundaryBusy,false,label);assert.ok(f.ports.cancelCount>=1,label);
  assert.equal(f.owner.visibleAnchor.ordinal,original.anchor.ordinal,label);
  assert.equal(f.owner.visibleAnchor.y,original.anchor.y,label);
}
outcomes.push('zoom, rotation, background, overlay and panel all cancel and restore the old chapter without closing it');
{
  const f=fixture();assert.equal(f.owner.boundaryEnabled(),true);
  for(const [key,value]of[['zoom',2],['horizontal',true],['panel','appearance'],['windowChromeActive',false],['restoringAnchor',true],['loginRequiredForControls',true]]){
    const before=f.owner[key];f.owner[key]=value;assert.equal(f.owner.boundaryEnabled(),false,key);f.owner[key]=before;
  }
  f.owner.onBoundaryActivity(true);f.owner.onBoundaryPull('next',160,true);f.owner.onBoundaryPull('next',190,true);
  assert.equal(f.ports.vibrations.length,1);f.owner.onBoundaryActivity(false);f.owner.reduceMotion=true;
  f.owner.onBoundaryActivity(true);f.owner.onBoundaryPull('next',190,true);assert.equal(f.ports.vibrations.length,1);
  outcomes.push('native admission gates and one optional vibration per gesture honour reduced motion');
}


{
  const f=fixture();let rejectOld;
  const oldSave=f.origin.savePosition;
  f.origin.savePosition=()=>new Promise((_resolve,reject)=>{rejectOld=reject;});
  activePorts=f.ports;f.owner.onBoundaryActivity(true);const old=f.owner.turnBoundaryChapter(1);await tick();
  assert.equal(f.owner.controller,f.origin);await f.owner.cancelBoundaryChapter();
  f.origin.savePosition=oldSave;const {pending:newer}=await begin(f);
  const cancelledBefore=f.ports.cancelCount;rejectOld(new Error('controlled delayed old CAS rejection'));await old;
  assert.equal(f.owner.pendingChapterTransition,f.candidate);assert.equal(f.owner.controller,f.target);
  assert.equal(f.owner.boundaryBusy,true);assert.equal(f.ports.cancelCount,cancelledBefore);
  await completeVisible(f);await newer;assert.equal(f.ports.presentCount,1);
  outcomes.push('a cancelled pre-save rejection cannot cancel or roll back a newer prepared turn');
}
for(const targetHeights of [[500,50],[200,50]]){
  const f=fixture({originIndex:4,targetIndex:0}), target=f.target;
  const pages=targetHeights.map((_height,ordinal)=>({ordinal,pageId:`previous-page-${ordinal}`,resourceRef:`previous:${ordinal}`}));
  target.chapter.manifest.pages=pages;target.totalPages=2;target.displayedOrdinal=1;
  target.pageAt=ordinal=>pages[ordinal];
  target.pageGeometry=ordinal=>({width:600,height:targetHeights[ordinal]*2,tileHeight:targetHeights[ordinal]*2});
  target.tile=(ordinal,tileIndex)=>tileIndex===0&&pages[ordinal]!==undefined?{image:{fileUri:`file://previous-${ordinal}.png`,revision:'v1'}}:undefined;
  target.visiblePages=()=>pages.map(page=>({ordinal:page.ordinal,status:'ready'}));
  f.native.targetHeights=targetHeights;Object.assign(f.candidate,{landing:'last',targetOrdinal:1,landingTileIndex:0,location:{x:0,y:1}});
  activePorts=f.ports;f.owner.onBoundaryActivity(true);const pending=f.owner.turnBoundaryChapter(-1);await tick();
  assert.equal(f.owner.controller,target);f.flushTimers();f.flushFrames();await tick();
  f.flushFrames();await tick();
  assert.equal(f.owner.restoringAnchor,false);assert.equal(f.owner.confirmedPosition.anchor.ordinal,0,'native bottom clamp may display an earlier page first');
  assert.equal(f.owner.scroller.isAtEnd(),true);
  imageBuilder(f,f.owner.data.getData(1)).onComplete({loadingStatus:1});f.flushFrames();await tick();assert.equal(f.ports.presentCount,0,'last image alone does not admit the earlier visible image');
  imageBuilder(f,f.owner.data.getData(0)).onComplete({loadingStatus:1});f.flushFrames();await pending;
  assert.equal(f.ports.presentCount,1);assert.deepEqual(f.ports.commits,[[0,'Chapter 0']]);
}
outcomes.push('previous-chapter short last image and whole short chapter use the real bottom clamp and admit an earlier top anchor only after every visible image');
{
  const f=fixture(), target=f.target;
  const pages=Array.from({length:9},(_value,ordinal)=>({ordinal,pageId:`short-${ordinal}`,resourceRef:`short:${ordinal}`}));
  target.chapter.manifest.pages=pages;target.pageAt=ordinal=>pages[ordinal];target.totalPages=9;
  target.pageGeometry=()=>({width:600,height:100,tileHeight:100});
  f.native.targetHeights=Array(9).fill(50);f.native.offset=0;
  Object.assign(f.owner,{controller:target,pendingChapterTransition:f.candidate,nativeTransitionImageReady:true,
    confirmedPosition:{controller:target,manifest:target.chapter.manifest,anchor:{ordinal:0,y:0,x:0}}});
  f.owner.data.projection.publish(target.chapter.manifest,()=>target.pageGeometry(),undefined,9,ordinal=>target.pageAt(ordinal));
  let failure,admitted=false;f.owner.nativeTransitionReject=error=>{failure=error;};f.owner.nativeTransitionResolve=()=>{admitted=true;};
  f.owner.confirmBoundaryFrame();
  assert.equal(f.owner.last-f.owner.first,8,'actual native rectangle lookup reports all nine short images');
  assert.equal(failure?.message,'MANGA_TILE_WINDOW_BUDGET');assert.equal(admitted,false);
  failure=undefined;Object.assign(f.owner,{restoringAnchor:true,pendingRestoreAnchor:{ordinal:0,y:0,x:0},appliedLayoutGeneration:f.owner.layoutGeneration});
  f.owner.onViewportScroll();assert.equal(failure?.message,'MANGA_TILE_WINDOW_BUDGET');
  assert.equal(f.ports.presentCount,0);assert.equal(f.ports.commits.length,0);assert.equal(f.ports.timers.size,0);
  outcomes.push('nine short visible images reject a candidate immediately during restoration or paint admission without lifting the eight-tile budget');
}
{
  const f=fixture();f.owner.onAdjacentChapterCommitted=()=>{throw new Error('controlled external notification failed');};
  const {pending}=await begin(f);await completeVisible(f);await pending;
  assert.equal(f.ports.presentCount,1);assert.equal(f.owner.controller,f.target);
  assert.equal(f.origin.calls.filter(call=>call[0]==='close'&&call[1]==='chapter').length,1);
  assert.equal(f.ports.cancelCount,0);assert.equal(f.owner.boundaryBusy,false);
  outcomes.push('external chapter notification failure still retires old chapter leases exactly once and unlocks the gesture');
}

// cachedCount(0) does not mount the controller's extra prefetch neighbour.
// The native SDK rejects getItemRect for that offscreen index; both platform
// forms must preserve current pixels and admit only every actually visible tile.
for (const offscreenRect of ['throw', 'zero']) {
  const f = fixture();
  f.native.offset = 0;
  assert.equal(f.owner.rememberVisible(), true);
  const getNativeRect = f.owner.scroller.getItemRect;
  let offscreenQueries = 0;
  f.owner.scroller.getItemRect = (index) => {
    const rect = getNativeRect(index);
    if (rect.y >= f.owner.viewportHeight || rect.y + rect.height <= 0) {
      offscreenQueries++;
      if (offscreenRect === 'throw') throw new Error('controlled SDK offscreen index');
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return rect;
  };
  assert.equal(f.owner.requestedLast(), 2, 'the controller still prepares one offscreen neighbour');
  const retained = f.owner.captureChapterPixels();
  assert.equal(retained.length, 2, 'only actual visible old images are retained');
  assert.equal(offscreenQueries, 0, 'retained old pixels never request an offscreen native rectangle');
  const { pending } = await begin(f);
  f.flushTimers(); f.flushFrames(); await tick();
  imageBuilder(f, f.owner.data.getData(0)).onComplete({loadingStatus:1});
  f.flushFrames(); await tick();
  assert.equal(f.ports.presentCount, 0, 'the other visible image is still required');
  imageBuilder(f, f.owner.data.getData(1)).onComplete({loadingStatus:1});
  f.flushFrames(); await pending;
  assert.equal(f.ports.presentCount, 1);
  assert.equal(offscreenQueries, 0, 'paint admission never queries the unmounted prefetch neighbour');
  assert.ok(f.target.calls.filter(call => call[0] === 'tiles').some(call => call[1].some(tile => tile.tileIndex === 2)),
    'native paint admission does not remove controller prefetch');
}
outcomes.push('cachedCount(0) offscreen native rectangles may throw or be zero: retention and paint use only measured visible tiles while controller prefetch stays intact');

// The official SDK emits the exact production PullToRefresh callback closures.
{
  const f=fixture({originIndex:4,targetIndex:0});const properties=createArkUIPropertyRuntimeProbe();
  const built=createReaderBuilderProbe(source,['boundaryViewport'],{...properties.sdk,...mangaSurfaceSdkDependencies},properties.hooks);
  Object.assign(built.owner,{scroller:f.owner.scroller,boundaryReset:7,reduceMotion:true,
    boundaryEnabled:f.owner.boundaryEnabled.bind(f.owner),adjacentChapter:f.owner.adjacentChapter.bind(f.owner),
    onBoundaryActivity:f.owner.onBoundaryActivity.bind(f.owner),onBoundaryPull:f.owner.onBoundaryPull.bind(f.owner),
    turnBoundaryChapter:f.owner.turnBoundaryChapter.bind(f.owner),imageViewport(){},boundaryHint(){}});
  built.owner.boundaryViewport();const params=[...built.owner.children.values()].at(-1).params;
  assert.equal(params.pullEnabled,true);assert.equal(params.hasPrevious,false);assert.equal(params.hasNext,false);
  assert.equal(params.customRefresh,undefined,'the upward-only Surface has no previous-chapter pull UI');
  assert.equal(params.animationDuration,0);assert.equal(params.resetToken,7);
  params.onActivity(true);assert.equal(f.owner.boundaryDragging,true);
  params.onPull('next',30,false);assert.equal(f.owner.boundaryDistance,30);
  params.onActivity(false);
  outcomes.push('SDK-generated PullToRefresh receives actual admission, lifecycle epoch, reduced-motion and anchor callbacks');
}
{
  const f=fixture();const properties=createArkUIPropertyRuntimeProbe();
  const built=createReaderBuilderProbe(source,['boundaryViewport'],{...properties.sdk,...mangaSurfaceSdkDependencies},properties.hooks);
  Object.assign(built.owner,{scroller:f.owner.scroller,boundaryReset:0,reduceMotion:false,
    boundaryEnabled:f.owner.boundaryEnabled.bind(f.owner),adjacentChapter:f.owner.adjacentChapter.bind(f.owner),
    onBoundaryActivity:f.owner.onBoundaryActivity.bind(f.owner),onBoundaryPull:f.owner.onBoundaryPull.bind(f.owner),
    turnBoundaryChapter:f.owner.turnBoundaryChapter.bind(f.owner),imageViewport(){},boundaryHint(){}});
  built.owner.boundaryViewport();const params=[...built.owner.children.values()].at(-1).params;
  assert.equal(params.hasNext,true);
  params.onActivity(true);params.onPull('next',180,true);
  const pending=params.onLoadMore();await tick();
  assert.equal(f.ports.prepare.landing,'first');assert.equal(f.ports.prepare.chapterIndex,4);
  assert.equal(f.owner.controller,f.target);assert.equal(f.candidate.targetOrdinal,0);
  await completeVisible(f);await pending;
  assert.equal(f.ports.presentCount,1);assert.equal(f.ports.commits[0][0],4);
  outcomes.push('actual SDK onLoadMore closure prepares and presents exactly the next chapter first image');
}
{
  const f=fixture();const {pending}=await begin(f);
  for(let n=0;n<100;n++)f.owner.traceBoundary('paint-gate');
  assert.equal(f.ports.traces.filter(args=>args[2].startsWith('Manga edge stage=')).length,48,'native stage evidence has one finite per-turn budget');
  await completeVisible(f);await pending;
  assert.equal(f.ports.presentCount,1,'diagnostic exhaustion cannot hold chapter admission');
  outcomes.push('bounded native stage evidence records geometry and paint without blocking admission after its budget ends');
}
{
  const f=fixture();f.native.unmounted=true;
  for(let n=0;n<100;n++)f.owner.tracePosition('restore-requested',{ordinal:0,x:0,y:0.25});
  assert.equal(f.ports.traces.length,48,'normal restore/save evidence has one finite per-Surface budget');
  assert.equal(f.ports.traces[0][6],'0.25');
  assert.equal(f.origin.calls.length,0,'numeric evidence cannot write or select reading state');
  outcomes.push('bounded numeric position evidence retains the requested coordinate even before native rows mount');
}

// Shell/Index production callbacks: adjacent commit updates requested chapter
// without remounting; explicit directory request advances the identity epoch.
const Index=productionMotionMethods(indexURL,['applyMangaAdjacentChapter','applyDirectoryChapter','isKnownDetailChapter',
  'onDirectoryChapterSelected','nextNavigationGeneration','readingReadyCallback','presentPreparedReading'],{LOCAL_SOURCE_ID:'local'});
const f=fixture();const index=Object.assign(new Index(),{
  detailBook:{sourceId:'s',bookId:'b',title:'Fixture'},readingSessionActive:true,readingContentKind:'manga',detailToc:f.entries,
  remoteReadingSession:undefined,requestedChapterIndex:0,directoryCurrentChapterIndex:0,directoryChapterTitle:'Chapter 0',
  requestedMangaDirectoryTargetProof:{old:true},mangaChapterStartRequestGeneration:0,mangaChapterRequestGeneration:3,mangaCommittedRequestGeneration:3,
  readingReadyGeneration:5,route:'reading',preparedReaderRoute:'reading',navigationGeneration:0,shelfReadingPreparation:false,startupEntryId:0,
  scheduleNavigationBackfillAfterReady(){},
});
const syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('MangaReadingSurface');
syntax.propCollection.set('MangaReadingSurface',new Set([...source.matchAll(/@Prop\s+(\w+)\s*:/g)].map(match=>match[1])));
class ChildSurface{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
const shellBuilt=createReaderBuilderProbe(readFileSync(shellURL,'utf8'),['mangaSurface','mangaIdentityKey','onMangaChapterReady','onMangaAdjacentChapterReady','selectAdjacentMangaChapter'],
  {MangaReadingSurface:ChildSurface,ReaderRuntimeOwner:{current:()=>({})}}, {allowEmptyBranchAdmission:true});
const shell=shellBuilt.owner;
Object.assign(shell,{sourceId:'s',bookId:'b',contentKind:'manga',appThemeScheme:'day',tocEntries:f.entries,
  onAdjacentChapterCommitted:(chapter,title)=>index.applyMangaAdjacentChapter(chapter,title),
  onChapterCommitted:(chapter,title)=>index.applyDirectoryChapter(chapter,title),
  onReadingReady:(chapter,source,book,generation)=>index.readingReadyCallback(source,book,generation)(chapter),
  onSelectChapter:chapter=>index.onDirectoryChapterSelected(chapter)});
let shellMounted=false;
function mount(){Object.assign(shell,{requestedChapterIndex:index.requestedChapterIndex,
  readingReadyGeneration:index.readingReadyGeneration,mangaChapterRequestGeneration:index.mangaChapterRequestGeneration,
  directoryCurrentChapterIndex:index.directoryCurrentChapterIndex});if(!shellMounted){shell.mangaSurface();shellMounted=true;}else shell.replay();return[...shell.children.values()].at(-1);}
const first=mount(),identity=shell.mangaIdentityKey();first.params.onAdjacentChapterCommitted(4,'Chapter 4');
assert.equal(index.requestedChapterIndex,4);assert.equal(index.directoryCurrentChapterIndex,4);
assert.equal(index.requestedMangaDirectoryTargetProof,undefined);assert.equal(index.mangaChapterStartRequestGeneration,-1);
const after=mount();assert.equal(shell.mangaIdentityKey(),identity);assert.equal(after.id,first.id);
assert.equal(shell.children.size,1,'actual SDK ForEach retains one Surface after an internal adjacent commit');
index.route='directory';index.onDirectoryChapterSelected(0);const second=mount();
assert.notEqual(shell.mangaIdentityKey(),identity);assert.notEqual(second.id,first.id);
const current=index.requestedChapterIndex;first.params.onAdjacentChapterCommitted(4,'stale');assert.equal(index.requestedChapterIndex,current);
second.params.onAdjacentChapterCommitted(1,'Group');assert.equal(index.requestedChapterIndex,current);
outcomes.push('actual Shell SDK closure updates Index after adjacent commit, retains child identity, and remounts/fences callbacks only for explicit directory generations');

// Compile the unchanged ReaderShell call expression from Index.build, retaining
// its actual property and callback expressions. Other Index route branches are
// outside this focused SDK wiring probe; no callback or state machine is copied.
{
  const indexSource=readFileSync(indexURL,'utf8'),indexTree=parse(indexSource);
  let call;
  function find(node){if(ts.isCallExpression(node)&&node.expression.getText(indexTree)==='ReaderShell')call=node;ts.forEachChild(node,find);}
  find(indexTree);assert.ok(call,'actual Index ReaderShell call');
  const shellSource=readFileSync(shellURL,'utf8');syntax.componentCollection.customComponents.add('ReaderShell');
  syntax.propCollection.set('ReaderShell',new Set([...shellSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(match=>match[1])));
  const properties=createArkUIPropertyRuntimeProbe();
  class CapturedReaderShell{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
  const actualCall=`@Component struct Index { build() { ${call.getText(indexTree)}; } }`;
  const built=createReaderBuilderProbe(actualCall,['build'],{...properties.sdk,...mangaSurfaceSdkDependencies,
    ReaderShell:CapturedReaderShell,ReaderRuntimeOwner:{current:()=>({supportsCoreCapability:()=>false})},deviceInfo:{deviceType:'phone'},readerAppColor},properties.hooks);
  Object.assign(built.owner,index,{settingsSnapshot:{reduceMotion:true},
    currentSourceSwitchTransactionId:()=>undefined,detailBookmarkIdentity:()=>'',controlBookmarkProjectionMessage:()=>'',directoryRecovery:()=>undefined,
    canCancelMangaSourcePreparation:()=>false,applyMangaAdjacentChapter:index.applyMangaAdjacentChapter.bind(index)});
  built.owner.initialRender();const params=[...built.owner.children.values()].at(-1).params;
  assert.equal(typeof params.onAdjacentChapterCommitted,'function');
  const generation=index.mangaChapterRequestGeneration;params.onAdjacentChapterCommitted(4,'From actual Index closure');
  assert.equal(index.requestedChapterIndex,4);assert.equal(index.directoryChapterTitle,'From actual Index closure');
  assert.equal(index.mangaChapterRequestGeneration,generation);
  outcomes.push('SDK-emitted exact Index ReaderShell property/callback expressions publish adjacent progress without advancing the remount epoch');
}


// The user-selected footer has no preparation/retry/cancel card. Its finite
// actor layout/theme proof is in test-manga-boundary-feedback-sdk; this probes
// the Surface's actual SDK child-property expressions for each pull phase.
{
  const properties=createArkUIPropertyRuntimeProbe();
  const wrapper=createReaderBuilderProbe(source,['boundaryHint'],{...properties.sdk,...mangaSurfaceSdkDependencies},properties.hooks).owner;
  Object.assign(wrapper,{boundaryBusy:false,boundaryArmed:false,
    paperColor:()=> '#paper',inkColor:()=> '#ink',mutedColor:()=> '#muted'});
  for(const [busy,armed,caption]of[[false,false,'继续上拉进入下一章节'],[false,true,'松手进入下一章节'],[true,true,'正在进入下一章节…']]){
    wrapper.boundaryBusy=busy;wrapper.boundaryArmed=armed;wrapper.boundaryHint('next');
    const params=[...wrapper.children.values()].at(-1).params;
    assert.equal(params.caption,caption);assert.equal(params.paperColor,'#paper');assert.equal(params.inkColor,'#ink');assert.equal(params.mutedColor,'#muted');
    assert.equal(params.onRetry,undefined);assert.equal(params.onDismiss,undefined);assert.equal(params.kind,undefined);
  }
  const surface=tree.statements.find(node=>node.name?.getText(tree)==='MangaReadingSurface');
  assert.equal(surface.members.some(node=>node.name?.getText(tree)==='boundaryStatus'),false,'rejected status card has no production Builder');
  outcomes.push('Surface SDK forwards only brief upward pull/release/busy footer copy; preparation/retry/cancel card is absent');
}

console.log(JSON.stringify({outcomes,boundary:'Actual Surface/Shell/Index methods and SDK Image/PullToRefresh closures; controlled Core/controller and native frame/rectangle ports. No HAP, VM pixels, native pointer arbitration or user acceptance claim.'},null,2));
