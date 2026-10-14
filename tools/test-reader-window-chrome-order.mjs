import { mangaDirectoryAdaptiveFields, mangaDirectoryAdaptiveMembers, mangaDirectoryAdaptiveDependencies } from './lib/manga-directory-adaptive-probe.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, registerHooks} from 'node:module';
import {createHash} from 'node:crypto';
import {ReaderBrightnessWriter} from '../entry/src/main/ets/app/ReaderBrightnessWriter.ts';
import * as metrics from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {READER_THEME_DEFINITIONS, readerAppColor, findReaderTheme} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {readerAppearanceThemeStyle, readerAppearanceChromeTone} from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
import {mangaSurfaceSdkDependencies} from './lib/manga-surface-sdk-probe.mjs';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {ReaderStatusBarMeasurement}=await import('../entry/src/main/ets/app/ReaderStatusBarMeasurement.ts');
const controlSession=await import('../entry/src/main/ets/features/reading/ReaderControlSessionState.ts');
const {readerControlHostVisible}=await import('../entry/src/main/ets/features/reading/ReaderControlHostSession.ts');
const {createDefaultReaderSettingsSnapshot}=await import('../entry/src/main/ets/features/reading/ReaderSettingsState.ts');
const require=createRequire(import.meta.url);
const ts=require(((process.env.READER_ETS_LOADER_ROOT ?? ((process.env.OHOS_SDK_HOME ?? '/Applications/DevEco-Studio.app/Contents/sdk/default') + '/openharmony/ets/build-tools/ets-loader')) + '/node_modules/typescript'));
const base=new URL('../entry/src/main/ets/',import.meta.url);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){for(let i=0;i<8;i++)await tick();}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture(){
 const app=new Map();globalThis.AppStorage={setOrCreate:(k,v)=>app.set(k,v)};
 const displayInfo={id:0,rotation:0,densityPixels:1,scaledDensity:1};
 const kit={window:{Orientation:{UNSPECIFIED:0,PORTRAIT:1,LANDSCAPE:2,AUTO_ROTATION_UNSPECIFIED:3},
   AvoidAreaType:{TYPE_SYSTEM:0,TYPE_CUTOUT:1,TYPE_SYSTEM_GESTURE:2,TYPE_NAVIGATION_INDICATOR:3,TYPE_KEYBOARD:4}},
   display:{getDefaultDisplaySync:()=>displayInfo,on(){},off(){}}};
 const deps={'@kit.ArkUI':kit,'@kit.PerformanceAnalysisKit':{hilog:{info(){},warn(){}}},
   '../features/common/ReaderThemeRegistry':{findReaderTheme},
   './ReaderBrightnessWriter':{ReaderBrightnessWriter},'./ReaderStatusBarMeasurement':{ReaderStatusBarMeasurement},
   '../features/common/ReaderWindowMetrics':metrics};
 const source=readFileSync(new URL('app/ReaderWindowCoordinator.ts',base),'utf8');
 const out=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};new Function('require','module','exports',out)(id=>{assert.ok(id in deps,id);return deps[id];},module,module.exports);
 const {ReaderWindowCoordinator:C,ReaderWindowChromeStyle:S,ReaderWindowPolicy:P}=module.exports;
 const E=productionMotionMethods(new URL('features/reading/LocalReadingExperience.ets',base),
   ['applyWindowChrome','commitReaderWindowSettings','applyReaderWindowPolicy','windowPolicyFor','captureReaderSettingsAdmission','notifyReaderSettingsSavePending'],{
   ReaderWindowCoordinator:C,ReaderWindowChromeStyle:S,ReaderWindowPolicy:P,readerAppearanceThemeStyle,readerAppearanceChromeTone});
 function windowPort(options={}){
   const zero={left:0,top:0,width:0,height:0};
   const win={calls:[],properties:{},barEnabled:{status:true,navigation:true,navigationIndicator:true},nextColor:undefined,
     avoidTop:undefined,nextStatus:undefined,rect:{left:0,top:0,width:390,height:844},events:new Map(),
     orientation:options.orientation??0,keepScreenOn:options.keepScreenOn??false,
     getPreferredOrientation:()=>win.orientation,getWindowProperties:()=>({isKeepScreenOn:win.keepScreenOn,brightness:-1,windowRect:win.rect}),
     getWindowAvoidArea:type=>({topRect:type===0?(win.avoidTop??(win.barEnabled.status?{left:0,top:0,width:390,height:48}:zero)):zero,
       bottomRect:zero,leftRect:zero,rightRect:zero}),on(n,fn){win.events.set(n,fn);},off(n){win.events.delete(n);},
     setWindowLayoutFullScreen:async()=>{},setWindowSystemBarEnable:async()=>{},
     async setPreferredOrientation(value){win.calls.push(['orientation',value]);win.orientation=value;},
     async setWindowKeepScreenOn(value){win.calls.push(['awake',value]);win.keepScreenOn=value;},
     async setSpecificSystemBarEnabled(bar,enabled,enableAnimation){win.calls.push(['visible',bar,enabled,enableAnimation]);
       if(bar==='status'){const gate=win.nextStatus;win.nextStatus=undefined;if(gate)await gate.promise;}
       win.barEnabled[bar]=enabled;},
     async setWindowSystemBarProperties(props){win.calls.push(['color',{...props}]);const pending=win.nextColor;win.nextColor=undefined;
       if(pending)await pending.promise;win.properties={...win.properties,...props};},
   };return win;
 }
 function theme(id,overlay=true){const e=Object.assign(new E(),{windowChromeActive:true,windowChromeOverlayActive:overlay,appearanceSnapshot:{activeTheme:id}});e.applyWindowChrome();}
 const colors=w=>w.calls.filter(x=>x[0]==='color');
 return{C,S,P,E,windowPort,theme,colors,displayInfo,app};
}
const cases=[];
async function check(name,run){try{await run();cases.push({name,status:'PASS'});}catch(e){cases.push({name,status:'FAIL',error:e.stack});}}
const mangaPath=new URL('features/manga/MangaReadingSurface.ets',base);
const shellPath=new URL('features/shell/ReaderShell.ets',base);
const mangaSource=readFileSync(mangaPath,'utf8');
const shellSource=readFileSync(shellPath,'utf8');
const novelSource=readFileSync(new URL('features/reading/LocalReadingExperience.ets',base),'utf8');
const sha256=value=>createHash('sha256').update(value).digest('hex');
const sdkEvidence={mangaSourceSHA:sha256(mangaSource),shellSourceSHA:sha256(shellSource)};
const baselineManga=readFileSync(new URL('./fixtures/manga-system-bars-r5/MangaReadingSurface.ets',import.meta.url),'utf8');
const baselineShell=readFileSync(new URL('./fixtures/manga-system-bars-r5/ReaderShell.ets',import.meta.url),'utf8');
// Exact first-party R5 source, including every original import/comment and any
// source notice. The referenced vendor licensing remains in the project tree.
assert.equal(sha256(baselineManga),'0f5e6d2654e8cc228b43b2ab2c9023e728db904193a147ce71da425113a6b897','exact pre-R6 Manga baseline');
assert.equal(sha256(baselineShell),'ea6dddd9fcb6eecf76ea4871419d70e32c69a12cc5812c5aea34716c89cf85ba','exact pre-R6 Shell baseline');
const sdkRoot='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
function componentMembers(source){
 const file=ts.createSourceFile('/tmp/MangaChromeMemberSelection.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions);
 assert.deepEqual(file.parseDiagnostics,[]);
 const component=file.statements.find(n=>n.members?.some(m=>m.name?.getText(file)==='build'));
 return{file,component,names:new Set(component.members.map(m=>m.name?.getText(file)))};
}
// Run the actual novel @Prop/@Watch ownership edge and control-session
// visibility projection. Only unrelated input/awake/IO callbacks are seams;
// the native bar policy and its serialized Coordinator remain production.
function novelSdkFixture(f,theme,extendIntoCutout,text=novelSource){
 const properties=createArkUIPropertyRuntimeProbe();let identity=true;
 const names=['isReaderIdentityCurrent','windowChromeActive','windowChromeOverlayActive',
  'windowControlsPresented','readerSettingsSnapshot','latestControlVisualSession','sessionLaunch',
  'controlsPresentedForWindow','onWindowChromeActiveChanged','applyWindowChrome',
  'applyWindowPolicyForChromeOwner','applyReaderWindowPolicy','windowPolicyFor'];
 const {owner,output}=createReaderBuilderProbe(text,names,{
  ...properties.sdk,...controlSession,createDefaultReaderSettingsSnapshot,readerControlHostVisible,
  ReaderWindowCoordinator:f.C,ReaderWindowChromeStyle:f.S,ReaderWindowPolicy:f.P,
  readerAppearanceThemeStyle,readerAppearanceChromeTone,AppStorage:globalThis.AppStorage,
 },{...properties.hooks,initialParams:{windowChromeActive:true,windowChromeOverlayActive:false,
  isReaderIdentityCurrent:()=>identity}});
 Object.assign(owner,{appearanceSnapshot:{activeTheme:theme},screenAwakeKeepScreenOn:false,ttsKeepScreenOn:false,
  onControlInputBoundaryChanged(){},syncVolumeKeyPolicy(){}});
 owner.readerSettingsSnapshot={...createDefaultReaderSettingsSnapshot(),extendIntoCutout};
 if(!sdkEvidence.novelEmittedSHA)sdkEvidence.novelEmittedSHA=sha256(output);
 return{owner,properties,setIdentity:value=>{identity=value;},
  async controls(visible){
   owner.latestControlVisualSession=visible?controlSession.openReaderControlSession(controlSession.createReaderControlSessionState(),0):
    controlSession.dismissReaderControlSession(owner.latestControlVisualSession,0);
   owner.applyWindowPolicyForChromeOwner();properties.flush();await settle();
  },
  async props(value){owner.updateStateVars({windowChromeActive:owner.windowChromeActive,
   windowChromeOverlayActive:owner.windowChromeOverlayActive,...value});properties.flush();await settle();},
 };
}
// Select unchanged production members; the R5 negative selects only members it
// actually has so its failure is the observed native visibility, not missing code.
const mangaChromeMembers=['windowChromeActive','windowChromeOverlayActive','isReaderIdentityCurrent','windowChromeOwned',
 'mounted','runtime','settingsGateway','appThemeScheme','controlsVisible','error','openingRetry','recovering','chapterEnd','panel',
 'backgroundPreference','loginRequiredForControls','aboutToAppear','aboutToDisappear','toggleControls','controlsPresentedForWindow',
 'refreshLoginRequiredForControls','onWindowChromeChanged','applyWindowChrome','applyWindowPolicyForChromeOwner','restoreAppWindowChrome',
 'paperColor','inkColor','loginRequired','imageError','notifyPublishedRows','requestedLast','measureVisibleWindow','onRowAppear',
 'viewportWidth','viewportHeight','stageWidth','stageHeight','widePanel','persistentDirectory','directoryColumnWidth',
 'rollbackChapterController','rollbackChapterImages','previousChapterPixels'];
const mangaMaskSceneMembers=[...mangaDirectoryAdaptiveFields,...mangaDirectoryAdaptiveMembers,'build','panelOverlay','panelOffset','panelScrimOpacity','panelPhase','panelGeneration',
 'panelActionGeneration','panelCloseTask','panelCloseResolve','reduceMotion','windowMetricsRevision','onDirectoryMetricsChanged',
 'quickHeaderMeasured','quickToolsMeasured','quickFooterMeasured','openPanel','closePanel','invalidatePanelMotion','settlePanel',
 'beginPanelDrag','updatePanelDrag','finishPanelDrag','panelTravel','panelHeight','panelWidth','panelContentHeight',
 'windowInteractiveInsets','interactiveInsets','panelInsets','panelTitle','panelContentInset','surfaceColor','lineColor',
 'directoryFontScale','directoryHeaderChrome','resizeViewport','previousChapterPixels','boundaryBusy','boundaryFailure'];
function mangaSdkFixture(f,text=mangaSource,properties=createArkUIPropertyRuntimeProbe(),maskScene=false){
 let identity=true;
 const frames=[],animations=[],restores=[];
 let owner;
 const uiContext={postFrameCallback:frame=>frames.push(frame),animateTo(params,apply){
  apply();animations.push({params});
 }};
 const prefs={mangaBackground:'paper',mangaDirection:'vertical',mangaFit:'source',mangaPageNumbers:true};
 class SessionPort{
  constructor(){this.tiles=new Map();this.pages=[];this.closeCount=0;}
  tile(ordinal,index){return this.tiles.get(`${ordinal}:${index}`);}
  visiblePages(){return this.pages;}
  async close(){this.closeCount++;}
 }
 const available=componentMembers(text).names;
 if(maskScene){
  // The full frontend registers all declared Builders before member lowering.
  // Preserve that actual declaration metadata while chapter/list bodies remain
  // separate IO/paint boundaries of this window-composition fixture.
  const declaration=componentMembers(text),map=require(`${sdkRoot}/lib/component_map.js`);
  for(const member of declaration.component.members)if(ts.getAllDecorators(member).some(d=>d.getText(declaration.file)==='@Builder'))
   map.CUSTOM_BUILDER_METHOD.add(member.name.getText(declaration.file));
 }
 const deps={...mangaDirectoryAdaptiveDependencies,...mangaSurfaceSdkDependencies,...properties.sdk,ReaderWindowCoordinator:f.C,ReaderWindowChromeStyle:f.S,ReaderWindowPolicy:f.P,
  hilog:{warn(){}},AppStorage:globalThis.AppStorage,
  uiContext,curves:{interpolatingSpring:(...args)=>({kind:'native-spring',args})},Curve:{EaseInOut:'easeInOut'},
  MangaBookPresentation:{revision:0,useOwner(){}},MangaSessionController:SessionPort};
 const built=createReaderBuilderProbe(text,[...mangaChromeMembers,...(maskScene?mangaMaskSceneMembers:[])].filter(n=>available.has(n)),deps,
  {...properties.hooks,
   initialParams:{windowChromeActive:true,windowChromeOverlayActive:false,isReaderIdentityCurrent:()=>identity}});
 owner=built.owner;const {Component,output}=built;
 if(text===mangaSource&&maskScene&&!sdkEvidence.mangaMaskEmittedSHA)sdkEvidence.mangaMaskEmittedSHA=sha256(output);
 if(text===mangaSource&&!sdkEvidence.mangaEmittedSHA){sdkEvidence.mangaEmittedSHA=sha256(output);sdkEvidence.propertyRuntime=properties.source;}
 function initialize(instance){
  const rows=[];
  Object.assign(instance,{runtime:{},sourceId:'real-source',bookId:'real-book',offline:false,first:0,last:0,
   viewportWidth:390,viewportHeight:844,stageWidth:390,stageHeight:844,
   publishedRowKeys:new Map(),layoutGeneration:0,viewportGeneration:0,loginGeneration:0,presentationGeneration:0,
   brightnessOwner:0,brightnessGeneration:0,panelFontGeneration:0,horizontal:false,pendingTurnOrdinal:undefined,
   settingsGateway:{current:()=>prefs},onExitRequestHandler(){},
   retainPreparationOnDisappear:()=>false,
   data:{totalCount:()=>rows.length,getData:index=>rows[index],notify(){}},
   scroller:{getItemIndex:()=>0},
   // Resource, native geometry and panel scheduling are independent boundaries;
   // all chrome/lifecycle/auth mapping and Coordinator methods remain production.
   loadBrightness(){},open(){},...(!maskScene?{invalidatePanelMotion(){}}:{}),updateViewport:async()=>{},
   rowRenderKey(row){return `${row.key}:${this.imageError(row)}`;},confirmMountedTurn(){}});
  if(maskScene)Object.assign(instance,{
   opened:false,showPageNumbers:false,quickHeaderMeasured:0,quickToolsMeasured:0,quickFooterMeasured:0,
   imageViewport(){},boundaryViewport(){this.imageViewport();},tabletDirectory(){},topControls(){},bottomControls(){},chapterEndContent(){},
   directoryPanel(){},modePanel(){},settingsPanel(){},morePanel(){},
   // Chapter transport, static-font receipt and keyboard dismissal are IO
   // boundaries. Actual panel lifecycle, paint, Area and chrome remain selected.
   saveVisible:async()=>{},dismissPanelKeyboard:async()=>{},preparePanelFonts:async()=>true,
   restore:(...args)=>restores.push(args),
  });
  return rows;
 }
 const rows=initialize(owner);
 return{owner,Component,initialize,rows,properties,output,prefs,frames,animations,restores,
  setIdentity(value){identity=value;},
  async mount(){owner.aboutToAppear();await settle();},
  async state(name,value){owner[name]=value;properties.flush();await settle();},
  async props(value){owner.updateStateVars({windowChromeActive:owner.windowChromeActive,
   windowChromeOverlayActive:owner.windowChromeOverlayActive,...value});properties.flush();await settle();}};
}
function assertBars(win,visible,message='all three native system bars match presented UI'){
 assert.deepEqual(win.barEnabled,{status:visible,navigation:visible,navigationIndicator:visible},message);
 for(const call of win.calls.filter(c=>c[0]==='visible'))assert.equal(call[3],false,'specific system bar changes explicitly disable platform visibility animation');
}
function assertMangaChrome(f,win,presented,paper='#F8F4EC',foreground='#1F1B17',tone='dark',owner='reader',authoredMask=false){
 const background=presented&&!authoredMask?paper:'#00000000';
 assert.equal(win.properties.statusBarColor,background,'native status paint must preserve the owning manga composition');
 assert.equal(win.properties.navigationBarColor,background,'native navigation paint must preserve the owning manga composition');
 assert.equal(win.properties.statusBarContentColor,foreground);assert.equal(win.properties.navigationBarContentColor,foreground);
 assert.equal(f.app.get('readerWindowChromeThemeId'),'','solid manga underlay never borrows the novel transparent theme');
 assert.equal(f.app.get('readerWindowChromeUnderlayColor'),paper);assert.equal(f.app.get('readerWindowChromeTone'),tone);
 assert.equal(f.app.get('readerWindowChromeOwner'),owner);
}
function assertAppChrome(f,win,paper='#F8F4EC',foreground='#FF2B241D',tone='dark'){
 assert.equal(win.properties.statusBarColor,paper);assert.equal(win.properties.navigationBarColor,paper);
 assert.equal(win.properties.statusBarContentColor,foreground);assert.equal(win.properties.navigationBarContentColor,foreground);
 assert.equal(f.app.get('readerWindowChromeTone'),tone);assert.equal(f.app.get('readerWindowChromeOwner'),'app');
}
async function immersiveActualSdk(text=mangaSource){
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 const m=mangaSdkFixture(f,text);await m.mount();
 assertBars(w,false,'mount with no control UI must hide all three system bars');f.C.detach();
}
await check('manga actual SDK State Watch + production mount/toggle false→true→false hides/shows all three bars',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();const m=mangaSdkFixture(f);await m.mount();
 for(const name of ['controlsVisible','error','openingRetry','recovering','chapterEnd','panel','backgroundPreference','loginRequiredForControls','windowChromeActive','windowChromeOverlayActive'])
  assert.ok(m.owner.watches.has(name),`actual SDK declareWatch ${name}`);
 assertBars(w,false);assertMangaChrome(f,w,false);
 m.owner.toggleControls();await settle();assertBars(w,true);assertMangaChrome(f,w,true);
 m.owner.toggleControls();await settle();assertBars(w,false);assertMangaChrome(f,w,false);
 assert.equal(f.app.get('readerWindowOrientation'),'system');assert.equal(f.app.get('readerWindowKeepScreenOn'),false);
 assert.equal(f.app.get('readerWindowExtendIntoCutout'),true,'visibility changes preserve manga full-window extension');
 m.owner.aboutToDisappear();await settle();assertBars(w,true);assertAppChrome(f,w);f.C.detach();
});
await check('manga actual forced error/retry/recovery and explicit interactive chapter end show then return to immersive',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();const m=mangaSdkFixture(f);await m.mount();
 for(const [name,value,clear]of [['error','MANGA_RESOURCE_HOST_UNAVAILABLE',''],['openingRetry',true,false],['recovering',true,false],['chapterEnd',true,false]]){
  await m.state(name,value);assertBars(w,true,name);assertMangaChrome(f,w,true);
  await m.state(name,clear);assertBars(w,false,`${name} cleared`);assertMangaChrome(f,w,false);
 }
 m.owner.aboutToDisappear();await settle();f.C.detach();
});
await check('manga plain controller auth facts → production publication/viewport refresh → real State Watch → bars',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();const m=mangaSdkFixture(f);await m.mount();
 m.rows.push({key:'0',ordinal:0,tileIndex:0,known:true},{key:'1',ordinal:1,tileIndex:0,known:true});
 m.owner.controller.tiles.set('0:0',{error:'READING_IMAGE_AUTH_REQUIRED'});
 assert.equal(m.owner.loginRequiredForControls,false,'plain controller mutation has no fabricated State event');
 m.owner.notifyPublishedRows(false);await settle();assert.equal(m.owner.loginRequiredForControls,true);assertBars(w,true);assertMangaChrome(f,w,true);
 m.owner.scroller={getItemIndex:()=>1};assert.equal(m.owner.measureVisibleWindow(),true);await settle();
 assert.equal(m.owner.first,1);assert.equal(m.owner.loginRequiredForControls,false);assertBars(w,false,'native viewport advances away from auth row');assertMangaChrome(f,w,false);
 m.owner.controller.tiles.delete('0:0');m.owner.controller.pages=[{ordinal:0,error:'READING_IMAGE_ACCESS_DENIED'}];
 m.owner.scroller={getItemIndex:()=>0};m.owner.measureVisibleWindow();await settle();assertBars(w,true,'visiblePages fallback also participates');assertMangaChrome(f,w,true);
 m.owner.controller.pages=[];m.owner.notifyPublishedRows(false);await settle();assertBars(w,false);assertMangaChrome(f,w,false);
 m.owner.aboutToDisappear();await settle();f.C.detach();
});
await check('manga internal panels and actual SDK outer-overlay Props show all bars; clearing returns immersive',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();const m=mangaSdkFixture(f);await m.mount();
 for(const panel of ['directory','mode','settings','more','downloads']){
  await m.state('panel',panel);assertBars(w,true,panel);assertMangaChrome(f,w,true,'#F8F4EC','#1F1B17','dark','reader',true);
  await m.state('panel','');assertBars(w,false);assertMangaChrome(f,w,false);
 }
 await m.props({windowChromeOverlayActive:true});assertBars(w,true);assertMangaChrome(f,w,true,'#F8F4EC','#1F1B17','dark','overlay');
 await m.props({windowChromeOverlayActive:false});assertBars(w,false);assertMangaChrome(f,w,false);
 m.owner.aboutToDisappear();await settle();f.C.detach();
});
async function mountedMaskScene(text=mangaSource,background='paper'){
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 const m=mangaSdkFixture(f,text,createArkUIPropertyRuntimeProbe(),true);m.prefs.mangaBackground=background;
 await m.mount();await m.owner.openPanel('directory');m.owner.initialRender();
 // The authored scrim is admitted once. Native branch removal/replacement is
 // outside this helper; actual State Watch, retained paint attributes, Area
 // callbacks and serialized Window writes continue through the real SDK.
 const root=m.owner.nodes.get(0),stage=[...m.owner.nodes.values()].find(n=>n.type==='Row'&&n.onAreaChange);
 assert.ok(root&&stage,'actual SDK build admits the same full-window stage Area callback');
 return{f,w,m,root,stage};
}
async function verifyAuthoredMask(text=mangaSource){
 for(const [background,paper,ink,tone]of [['paper','#F8F4EC','#1F1B17','dark'],
  ['white','#FFFFFF','#1F1B17','dark'],['ink','#1C1E1A','#EAE7DE','light']]){
  const {f,w,m,root}=await mountedMaskScene(text,background),rootID=root.id;
  m.properties.flush();await settle();
  const scrim=[...m.owner.nodes.values()].find(n=>n.type==='Column'&&n.backgroundColor==='#57000000'&&n.height==='100%');
  assert.ok(scrim,'actual SDK phone panel owns a full-window authored scrim');
  assert.equal(scrim.opacity,0);assert.equal(m.owner.panelPhase,'opening');assertBars(w,true);
  assertMangaChrome(f,w,true,paper,ink,tone,'reader',true);
  m.frames.shift().onFrame(0);assert.equal(m.animations.length,0);
  m.frames.shift().onFrame(1);m.properties.flush();await settle();
  assert.equal(m.animations[0].params.duration,160);assert.equal(scrim.opacity,1);
  assertMangaChrome(f,w,true,paper,ink,tone,'reader',true);
  m.animations[1].params.onFinish();m.properties.flush();assert.equal(m.owner.panelPhase,'open');
  m.owner.beginPanelDrag();m.owner.updatePanelDrag(30);m.properties.flush();await settle();
  assert.equal(m.owner.panelPhase,'dragging');assertMangaChrome(f,w,true,paper,ink,tone,'reader',true);
  const closing=m.owner.closePanel();m.properties.flush();await settle();
  assert.equal(m.owner.panelPhase,'closing');assert.equal(m.owner.panel,'directory');assert.equal(scrim.opacity,0);
  assertMangaChrome(f,w,true,paper,ink,tone,'reader',true);
  m.animations.at(-1).params.onFinish();await closing;m.properties.flush();await settle();
  assert.equal(m.owner.panel,'');assert.equal(m.owner.controlsVisible,true);
  assertMangaChrome(f,w,true,paper,ink,tone);assert.equal(root.id,rootID,'mask lifecycle retains the same SDK window root');
  m.owner.reduceMotion=true;
  for(const panel of ['mode','settings','more','downloads']){
   await m.owner.openPanel(panel);m.properties.flush();await settle();assert.equal(m.owner.panelPhase,'open');
   assertMangaChrome(f,w,true,paper,ink,tone,'reader',true);
   await m.props({windowChromeOverlayActive:true});assertMangaChrome(f,w,true,paper,ink,tone,'overlay');
   await m.props({windowChromeOverlayActive:false});assertMangaChrome(f,w,true,paper,ink,tone,'reader',true);
   await m.owner.closePanel();m.properties.flush();await settle();assertMangaChrome(f,w,true,paper,ink,tone);
  }
  m.owner.aboutToDisappear();await settle();f.C.detach();
 }
}
await check('actual SDK full-window phone scrim plus serialized Coordinator: opening/open/drag/closing/reduced and external overlay retain exact owner',()=>verifyAuthoredMask());
async function verifyMaskResize(text=mangaSource,only='both'){
 const {f,w,m,root,stage}=await mountedMaskScene(text);m.owner.reduceMotion=true;
 await m.owner.openPanel('directory');m.properties.flush();await settle();
 const rootID=root.id;
 const transparent=()=>assertMangaChrome(f,w,true,'#F8F4EC','#1F1B17','dark','reader',true);
 const opaque=()=>assertMangaChrome(f,w,true);
 transparent();
 if(only!=='stage'){
  m.owner.resizeViewport(660,844);m.properties.flush();await settle();opaque();
  m.owner.resizeViewport(390,844);m.properties.flush();await settle();transparent();
 }
 if(only!=='viewport'){
  stage.onAreaChange({}, {width:660,height:844});m.properties.flush();await settle();opaque();
  stage.onAreaChange({}, {width:390,height:844});m.properties.flush();await settle();transparent();
 }
 if(only==='both'){
  for(const order of ['stage-first','viewport-first']){
   const area=(width,height)=>stage.onAreaChange({}, {width,height});
   const size=(width,height)=>m.owner.resizeViewport(width,height);
   const first=order==='stage-first'?area:size,last=order==='stage-first'?size:area;
   first(920,900);m.properties.flush();await settle();opaque();
   last(662,900);m.properties.flush();await settle();opaque();
   first(390,844);m.properties.flush();await settle();
   last(390,844);m.properties.flush();await settle();transparent();
  }
  m.owner.quickHeaderMeasured=19;m.owner.quickToolsMeasured=20;m.owner.quickFooterMeasured=21;
  m.owner.windowMetricsRevision+=1;m.properties.flush();await settle();
  assert.deepEqual([m.owner.quickHeaderMeasured,m.owner.quickToolsMeasured,m.owner.quickFooterMeasured],[0,0,0]);transparent();
  await m.props({windowChromeActive:false});assertBars(w,true);assertAppChrome(f,w);
  stage.onAreaChange({}, {width:660,height:844});m.owner.resizeViewport(660,844);
  m.owner.windowMetricsRevision+=1;m.properties.flush();await settle();assertAppChrome(f,w);
  await m.props({windowChromeActive:true});opaque();
  stage.onAreaChange({}, {width:390,height:844});m.owner.resizeViewport(390,844);
  m.properties.flush();await settle();transparent();
  m.setIdentity(false);const next=mangaSdkFixture(f);await next.mount();const colors=f.colors(w).length;
  stage.onAreaChange({}, {width:660,height:844});m.owner.resizeViewport(660,844);
  m.owner.windowMetricsRevision+=1;m.properties.flush();await settle();
  assert.equal(f.colors(w).length,colors,'stale actual Area/metrics callbacks cannot reclaim newest window owner');
  assertBars(w,false);assertMangaChrome(f,w,false);next.owner.aboutToDisappear();await settle();
 }
 assert.equal(root.id,rootID,'actual Area/chrome publication does not remount the SDK root');
 m.owner.aboutToDisappear();await settle();f.C.detach();
}
await check('actual SDK viewport and stage Area after assignment plus metrics refresh: phone/wide both orders, inactive/stale identity',()=>verifyMaskResize());
await check('negative: original opaque phone bars cannot pass authored mask composition',async()=>{
 const opaque=mangaSource.replace("'', !presented || authoredPhoneMask)","'', !presented)");assert.notEqual(opaque,mangaSource);
 await assert.rejects(verifyAuthoredMask(opaque),/native status paint must preserve/);
});
await check('negative: omitted viewport chrome refresh leaves the opened mask native style stale',async()=>{
 const stale=mangaSource.replace('this.viewportWidth = width; this.viewportHeight = height;\n    this.onWindowChromeChanged();',
  'this.viewportWidth = width; this.viewportHeight = height;');assert.notEqual(stale,mangaSource);
 await assert.rejects(verifyMaskResize(stale,'viewport'),/native status paint must preserve/);
});
await check('negative: omitted actual stage Area chrome refresh leaves persistent/wide native style stale',async()=>{
 const stale=mangaSource.replace('if (Number.isFinite(height) && height > 0) this.stageHeight = height;\n        this.onWindowChromeChanged();',
  'if (Number.isFinite(height) && height > 0) this.stageHeight = height;');assert.notEqual(stale,mangaSource);
 await assert.rejects(verifyMaskResize(stale,'stage'),/native status paint must preserve/);
});
async function verifyMaskMetricsRefresh(text=mangaSource){
 const {f,w,m,stage}=await mountedMaskScene(text);m.properties.flush();await settle();
 assertMangaChrome(f,w,true,'#F8F4EC','#1F1B17','dark','reader',true);
 const gate=deferred();w.nextColor=gate;
 stage.onAreaChange({}, {width:660,height:844});m.properties.flush();await settle();
 gate.reject(new Error('controlled pending wide color failure'));await settle();
 assertMangaChrome(f,w,true,'#F8F4EC','#1F1B17','dark','reader',true);
 f.displayInfo.scaledDensity=2;w.events.get('windowRectChange')({});
 assert.equal(f.C.metrics().systemFontScale,2,'the production Coordinator publishes the changed font-scale metric');
 m.owner.windowMetricsRevision=f.app.get('readerWindowMetricsRevision');m.properties.flush();await settle();
 assertMangaChrome(f,w,true); // The actual metrics Watch retries the pending style.
 m.owner.aboutToDisappear();await settle();f.C.detach();
}
await check('production font-scale metric → actual SDK metrics Watch retries failed wide chrome without geometry remount',()=>verifyMaskMetricsRefresh());
await check('negative: omitted metrics chrome refresh strands the failed native wide color',async()=>{
 const stale=mangaSource.replace(/(private onDirectoryMetricsChanged\(\): void \{[\s\S]*?)    this\.onWindowChromeChanged\(\);/, '$1');assert.notEqual(stale,mangaSource);
 await assert.rejects(verifyMaskMetricsRefresh(stale),/native status paint must preserve/);
});
await check('manga inactive Prop restores captured landscape/awake App owner; hidden state writes cannot reclaim it',async()=>{
 const f=fixture(),w=f.windowPort({orientation:2,keepScreenOn:true});await f.C.install(w);await settle();
 const m=mangaSdkFixture(f);await m.mount();assertBars(w,false);assert.equal(w.orientation,3);assert.equal(w.keepScreenOn,false);
 await m.props({windowChromeActive:false});assertBars(w,true);assert.equal(w.orientation,2);assert.equal(w.keepScreenOn,true);
 assertAppChrome(f,w);
 await m.state('controlsVisible',true);await m.state('controlsVisible',false);assertBars(w,true);assert.equal(w.orientation,2);assertAppChrome(f,w);
 await m.props({windowChromeActive:true});assertBars(w,false);assert.equal(w.orientation,3);assert.equal(w.keepScreenOn,false);
 m.owner.aboutToDisappear();await settle();assertBars(w,true);assert.equal(w.orientation,2);assert.equal(w.keepScreenOn,true);assertAppChrome(f,w);
 assert.ok(w.calls.some(c=>c[0]==='orientation'&&c[1]===2));assert.ok(w.calls.some(c=>c[0]==='awake'&&c[1]===true));f.C.detach();
});
async function staleIdentityActualSdk(text=mangaSource){
 const f=fixture(),w=f.windowPort({orientation:2,keepScreenOn:true});await f.C.install(w);await settle();
 const old=mangaSdkFixture(f,text);await old.mount();await old.state('controlsVisible',true);assertBars(w,true);assertMangaChrome(f,w,true);
 old.setIdentity(false);const next=mangaSdkFixture(f,text);await next.mount();assertBars(w,false,'new chapter owns immersive chrome');assertMangaChrome(f,w,false);
 const colors=f.colors(w).length;
 await old.state('backgroundPreference','ink');await old.state('controlsVisible',false);await old.state('controlsVisible',true);
 assertBars(w,false,'stale watched State cannot mutate newest owner');assertMangaChrome(f,w,false);assert.equal(f.colors(w).length,colors,'old watched theme cannot repaint the current reader');
 old.owner.aboutToDisappear();await settle();assertBars(w,false,'old chapter disposal cannot restore App over new owner');assertMangaChrome(f,w,false);
 next.owner.aboutToDisappear();await settle();assertBars(w,true);assert.equal(w.orientation,2);assert.equal(w.keepScreenOn,true);assertAppChrome(f,w);f.C.detach();
}
await check('manga old identity State/dispose cannot overwrite a newer chapter reader owner',()=>staleIdentityActualSdk());
await check('manga late native status-hide completion after actual SDK inactive/exit converges to captured App',async()=>{
 const f=fixture(),w=f.windowPort({orientation:2,keepScreenOn:true});await f.C.install(w);await settle();
 const m=mangaSdkFixture(f),gate=deferred();w.nextStatus=gate;m.owner.aboutToAppear();await settle();
 assert.ok(w.calls.some(c=>c[0]==='visible'&&c[1]==='status'&&c[2]===false),'real production hide reaches native pending port');
 m.owner.updateStateVars({windowChromeActive:false});m.owner.aboutToDisappear();gate.resolve();await settle();
 assertBars(w,true);assert.equal(w.orientation,2);assert.equal(w.keepScreenOn,true);assert.equal(f.app.get('readerWindowChromeOwner'),'app');f.C.detach();
});
await check('manga day/night mount and actual paper/white/ink State pair opaque shown bars with transparent immersion',async()=>{
 for(const scheme of ['day','night']){
  const f=fixture(),w=f.windowPort(),appPaper=readerAppColor('app.window.background',scheme),appInk=readerAppColor('app.window.foreground',scheme),appTone=scheme==='night'?'light':'dark';
  f.C.updateAppChromeStyle(new f.S(appPaper,appTone,appInk));await f.C.install(w);await settle();
  const m=mangaSdkFixture(f);m.prefs.mangaBackground=undefined;m.owner.appThemeScheme=scheme;await m.mount();
  assertMangaChrome(f,w,false,scheme==='night'?'#1C1E1A':'#F8F4EC',scheme==='night'?'#EAE7DE':'#1F1B17',appTone);assertBars(w,false);
  for(const [background,paper,ink,tone]of [['paper','#F8F4EC','#1F1B17','dark'],['white','#FFFFFF','#1F1B17','dark'],['ink','#1C1E1A','#EAE7DE','light'],['paper','#F8F4EC','#1F1B17','dark']]){
   await m.state('backgroundPreference',background);assertMangaChrome(f,w,false,paper,ink,tone);assertBars(w,false);
   m.owner.toggleControls();await settle();assertBars(w,true);assertMangaChrome(f,w,true,paper,ink,tone);
   m.owner.toggleControls();await settle();assertBars(w,false);assertMangaChrome(f,w,false,paper,ink,tone);
  }
  await m.props({windowChromeOverlayActive:true});assertMangaChrome(f,w,true,'#F8F4EC','#1F1B17','dark','overlay');
  m.owner.aboutToDisappear();await settle();assertBars(w,true);assertAppChrome(f,w,appPaper,appInk,appTone);f.C.detach();
 }
});
async function shellToMangaActualSdk(text=shellSource){
 const f=fixture(),w=f.windowPort({orientation:2,keepScreenOn:true});await f.C.install(w);await settle();
 const properties=createArkUIPropertyRuntimeProbe(),m=mangaSdkFixture(f,mangaSource,properties);
 const syntax=require(`${sdkRoot}/lib/validate_ui_syntax.js`),mangaTree=componentMembers(mangaSource);
 syntax.componentCollection.customComponents.add('MangaReadingSurface');
 syntax.propCollection.set('MangaReadingSurface',new Set(mangaTree.component.members.filter(n=>
  ts.isPropertyDeclaration(n)&&ts.getAllDecorators(n).some(d=>d.getText(mangaTree.file)==='@Prop')).map(n=>n.name.getText(mangaTree.file))));
 const children=[];
 class MangaChild extends m.Component{
  constructor(parent,params,storage,id){super(parent,params,storage,id);m.initialize(this);children.push(this);this.aboutToAppear();}
 }
 const props=['visible','route','sourceSwitchVisible','contentKind','sourceId','bookId','readingReadyGeneration','requestedChapterIndex',
  'mangaChapterRequestGeneration','remoteSession','reduceMotion','bookTitle','inBookshelf'];
 const {owner,output}=createReaderBuilderProbe(text,[...props,'mangaSettingsGateway','appThemeScheme','mangaSurface','mangaIdentityKey'],{
  ...properties.sdk,MangaReadingSurface:MangaChild,ReaderRuntimeOwner:{current:()=>({})},ReaderSettingsGateway:class{current(){return m.prefs;}},
 },properties.hooks);
 if(text===shellSource&&!sdkEvidence.shellEmittedSHA)sdkEvidence.shellEmittedSHA=sha256(output);
 const values={visible:true,route:'reading',sourceSwitchVisible:false,contentKind:'manga',sourceId:'real-source',bookId:'real-book',
  readingReadyGeneration:1,requestedChapterIndex:5,mangaChapterRequestGeneration:1,reduceMotion:false,bookTitle:'真实漫画',inBookshelf:true};
 owner.updateStateVars(values);owner.mangaSurface();await settle();
 assert.equal(children.length,1);assertBars(w,false,'actual parent first child receives active reader flag');
 assert.ok(output.includes('updateStateVarsOfChildByElmtId'),'actual SDK emitted retained child update payload');
 const child=children[0];
 for(const changes of [{route:'directory'},{route:'reading'},{sourceSwitchVisible:true},{sourceSwitchVisible:false},
  {visible:false},{visible:true}]){
  Object.assign(values,changes);owner.updateStateVars(values);properties.flush();await settle();
  assert.equal(children.length,1,'route/visibility changes retain the same actual SDK child');
  assertBars(w,!values.visible||values.route==='directory'||values.sourceSwitchVisible);
 }
 values.requestedChapterIndex=6;values.mangaChapterRequestGeneration=2;owner.updateStateVars(values);properties.flush();await settle();
 assert.equal(children.length,2,'changed chapter identity mounts the next production child');
 assert.equal(child.isReaderIdentityCurrent(),false);assert.equal(children[1].isReaderIdentityCurrent(),true);
 child.aboutToDisappear();await settle();assertBars(w,false,'old child cannot restore App after next chapter mount');
 children[1].aboutToDisappear();await settle();assertBars(w,true);assert.equal(w.orientation,2);assert.equal(w.keepScreenOn,true);f.C.detach();
}
await check('ReaderShell actual SDK Prop→retained Manga child Watch→Coordinator and chapter identity handoff',()=>shellToMangaActualSdk());
await check('negative: frozen R5 production source fails immersive native three-bar assertion',async()=>{
 await assert.rejects(immersiveActualSdk(baselineManga),/mount with no control UI must hide all three/);
});
await check('negative: frozen R5 Shell fails actual active-child propagation',async()=>{
 await assert.rejects(shellToMangaActualSdk(baselineShell),/actual parent first child receives active reader flag/);
});
await check('negative: missing control State Watch is rejected by actual production toggle',async()=>{
 const counterfactual=mangaSource.replace("@State @Watch('onWindowChromeChanged') private controlsVisible",'@State private controlsVisible');
 assert.notEqual(counterfactual,mangaSource);
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();const m=mangaSdkFixture(f,counterfactual);await m.mount();
 assertBars(w,false);m.owner.toggleControls();await settle();assert.throws(()=>assertBars(w,true,'control Watch must apply'),{code:'ERR_ASSERTION'});
 m.owner.aboutToDisappear();await settle();f.C.detach();
});
await check('negative: omitting manga navigation/indicator hiding is rejected by native three-bar assertion',async()=>{
 const counterfactual=mangaSource.replace("new ReaderWindowPolicy('system', false, !presented, !presented, true)","new ReaderWindowPolicy('system', false, !presented, false, true)");
 assert.notEqual(counterfactual,mangaSource);await assert.rejects(immersiveActualSdk(counterfactual),/mount with no control UI must hide all three/);
});
await check('negative: stale identity dispose guard removal is rejected after new chapter owner mount',async()=>{
 const counterfactual=mangaSource.replace('if (!owned || this.isReaderIdentityCurrent?.() === false) return;','if (!owned) return;');
 assert.notEqual(counterfactual,mangaSource);await assert.rejects(staleIdentityActualSdk(counterfactual),/old chapter disposal cannot restore App/);
});
await check('explicit manga transparency remains separate from paper underlay and same-owner transparent/opaque changes are not deduplicated',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 for(const transparent of [true,false,true]){
  f.C.requestReaderChrome(new f.S('#F8F4EC','dark','#1F1B17','',transparent));await settle();
  assert.equal(w.properties.statusBarColor,transparent?'#00000000':'#F8F4EC');
  assert.equal(w.properties.navigationBarColor,transparent?'#00000000':'#F8F4EC');
  assert.equal(f.app.get('readerWindowChromeUnderlayColor'),'#F8F4EC');
 }
 f.C.detach();
});
await check('eight real reading palettes survive hide/show and same/cross-scheme changes through actual Coordinator',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 for(const t of READER_THEME_DEFINITIONS){
   const scheme=t.scheme;f.C.updateAppChromeStyle(new f.S(readerAppColor('app.window.background',scheme),scheme==='night'?'light':'dark',readerAppColor('app.window.foreground',scheme)));
   f.theme(t.id,false);await settle();
   await f.C.requestReaderWindowPolicy(new f.P('system',false,true,false,true));
   f.theme(t.id,true);await f.C.requestReaderWindowPolicy(new f.P('system',false,false,false,true));await settle();
   assert.equal(w.barEnabled.status,true);assert.equal(w.properties.statusBarColor,'#00000000',t.id);
   assert.equal(w.properties.navigationBarColor,t.statusBackground,t.id);
   assert.equal(f.app.get('readerWindowChromeThemeId'),t.id);
   assert.equal(f.app.get('readerWindowChromeUnderlayColor'),t.statusBackground);
   assert.equal(w.properties.statusBarContentColor,t.statusForeground,t.id);
   const count=f.colors(w).length;f.theme(t.id,true);await settle();assert.equal(f.colors(w).length,count,'settled same theme is deduplicated');
 }
 f.C.requestAppChrome();await settle();assert.equal(w.properties.statusBarColor,readerAppColor('app.window.background','night'));f.C.detach();
});
await check('new theme is drained after the previous native color write rejects',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 const gate=deferred();w.nextColor=gate;f.theme('warm');await tick();f.theme('green');gate.reject(Error('1300003 simulated old request failure'));await settle();
 assert.equal(w.properties.statusBarColor,'#00000000');
 assert.equal(w.properties.navigationBarColor,READER_THEME_DEFINITIONS.find(t=>t.id==='green').paperStart,'newest paired theme must not be lost with old failure');f.C.detach();
});
for(const failed of [false,true])await check(`old window ${failed?'reject':'success'} cannot strand new window chrome`,async()=>{
 const f=fixture(),a=f.windowPort();await f.C.install(a);await settle();
 const gate=deferred();a.nextColor=gate;f.theme('paperNight');await tick();
 const b=f.windowPort();await f.C.install(b);f.theme('greenNight');
 if(failed)gate.reject(Error('1300002 simulated destroyed window'));else gate.resolve();await settle();
 assert.equal(b.properties.statusBarColor,'#00000000');
 assert.equal(b.properties.navigationBarColor,READER_THEME_DEFINITIONS.find(t=>t.id==='greenNight').paperStart,'replacement must receive newest paired color');f.C.detach();
});
await check('failed latest request stays pending without an automatic retry loop and explicit reapply recovers',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 const count=f.colors(w).length,gate=deferred();w.nextColor=gate;f.theme('warmNight');await tick();gate.reject(Error('1300003 simulated latest failure'));await settle();
 assert.equal(f.colors(w).length,count+1,'same failed intent must not spin');f.C.reapplyChrome();await settle();
 assert.equal(w.properties.statusBarColor,'#00000000');
 assert.equal(w.properties.navigationBarColor,READER_THEME_DEFINITIONS.find(t=>t.id==='warmNight').paperStart);f.C.detach();
});
await check('showing controls retries a failed color even when visible-bar policy and geometry are unchanged',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 const visible=new f.P('system',false,false,false,false);await f.C.requestReaderWindowPolicy(visible);
 const gate=deferred();w.nextColor=gate;f.theme('paper');await tick();gate.reject(Error('1300003 simulated theme failure'));await settle();
 const before=w.calls.length;await f.C.requestReaderWindowPolicy(visible);await settle();
 assert.equal(w.properties.statusBarColor,'#00000000','visible controls must expose the shared paper');
 assert.equal(w.properties.navigationBarColor,READER_THEME_DEFINITIONS.find(t=>t.id==='paper').paperStart,'visible controls must not keep stale app color');
 assert.equal(w.calls.slice(before).filter(c=>c[0]==='visible').length,0,'unchanged visibility remains deduplicated');f.C.detach();
});
await check('actual cutout setting true to false preserves immersion and measured band across control reveal in all eight themes',async()=>{
 for(const t of READER_THEME_DEFINITIONS)for(const initiallyOpen of [false,true]){
   const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
   let controls=initiallyOpen;const saved=[];
   const e=Object.assign(new f.E(),{windowChromeActive:true,windowChromeOverlayActive:false,appearanceSnapshot:{activeTheme:t.id},
     readerSettingsSnapshot:{extendIntoCutout:true,hideNavigationBar:false,screenDirection:'system'},readerSettingsMutationGeneration:0,
     lifecycleToken:1,screenAwakeKeepScreenOn:false,ttsKeepScreenOn:false,controlsPresentedForWindow:()=>controls,
     configureReaderScreenAwakeLease(){},applyReaderSystemEventPolicy(){},isSessionActive:()=>true,
     readerSettingsGateway:{update:async s=>{saved.push(s);}},reflowAfterWindowGeometryChange(){this.applyWindowChrome();},
     showReaderSettingsFailure(){assert.fail('unexpected settings failure');}});
   e.applyWindowChrome();await e.applyReaderWindowPolicy(e.readerSettingsSnapshot);await settle();
   assert.equal(f.C.metrics().statusBarHeight,48);
   if(!initiallyOpen)w.avoidTop={left:0,top:0,width:0,height:0}; // API ACK precedes visible-area event.
   e.commitReaderWindowSettings({...e.readerSettingsSnapshot,extendIntoCutout:false});await settle();
   assert.equal(saved.at(-1).extendIntoCutout,false);assert.equal(w.barEnabled.status,initiallyOpen,
     'cutout safety settings cannot show the system status bar during immersion');
   assert.equal(f.C.metrics().statusBarHeight,48,`${t.id}: show ACK must not erase measured band`);
   if(!initiallyOpen){
     controls=true;await e.applyReaderWindowPolicy(e.readerSettingsSnapshot);await settle();
     assert.equal(w.barEnabled.status,true,'only the actual control presentation reveals the system status bar');
     w.events.get('avoidAreaChange')({});assert.equal(f.C.metrics().statusBarHeight,48,'intermediate zero event during reveal');
     w.avoidTop={left:2,top:1,width:386,height:50};w.events.get('avoidAreaChange')({});
     assert.deepEqual(f.C.metrics().statusBarRect,new metrics.ReaderRectVp(2,1,386,50));
   }
   controls=false;await e.applyReaderWindowPolicy(e.readerSettingsSnapshot);
   assert.equal(w.barEnabled.status,false,'closing controls restores immersion even when cutout extension is off');
   assert.equal(w.properties.statusBarColor,'#00000000');assert.equal(w.properties.statusBarContentColor,t.statusForeground);
   assert.equal(w.properties.navigationBarColor,t.statusBackground);
   w.avoidTop={left:0,top:0,width:0,height:0};w.events.get('avoidAreaChange')({});
   assert.equal(f.C.metrics().statusBarHeight,initiallyOpen?48:50,
     'hidden native avoid area retains this geometry\'s measured band for the page-owned top information');
   f.C.detach();
 }
});
await check('actual novel SDK ownership and control sessions hide/show/hide independent of cutout, navigation and page mode',async()=>{
 for(const extend of[false,true])for(const hideNavigationBar of[false,true])for(const mode of['none','slide','cover','simulation','continuous']){
  const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
  const n=novelSdkFixture(f,'paper',extend);
  n.owner.readerSettingsSnapshot={...n.owner.readerSettingsSnapshot,hideNavigationBar,
   navigationMode:mode==='continuous'?'continuous':'paged',pageTransition:mode==='continuous'?'none':mode};
  await n.controls(false);
  assert.equal(w.barEnabled.status,false,'the real immersive owner always hides the native status bar');
  assert.equal(w.barEnabled.navigation,!hideNavigationBar,'navigation preference stays independent');
  assert.equal(n.owner.windowControlsPresented,false);assert.equal(f.app.get('readerTopInfoSuppressed'),false);
  await n.controls(true);
  assert.equal(w.barEnabled.status,true,'the real control session exposes the native status bar');
  assert.equal(n.owner.windowControlsPresented,true);assert.equal(f.app.get('readerTopInfoSuppressed'),true);
  await n.controls(false);
  assert.equal(w.barEnabled.status,false,'the real close session restores immersive status');
  assert.equal(n.owner.windowControlsPresented,false);assert.equal(f.app.get('readerTopInfoSuppressed'),false);
  await n.props({windowChromeActive:false});
  assert.equal(w.barEnabled.status,true,'actual inactive @Prop/@Watch returns the native bar to App');
  n.setIdentity(false);w.calls.length=0;await n.controls(false);
  assert.equal(w.calls.length,0,'an obsolete reader cannot issue any native request over App');
  f.C.detach();
 }
});
await check('old cutout-dependent novel policy is rejected by the actual SDK immersive regression',async()=>{
 const broken=novelSource.replace('!forceStatusBarVisible,','forceStatusBarVisible ? false : snapshot.extendIntoCutout,');
 assert.notEqual(broken,novelSource,'negative control restores the actual historical production policy');
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 const n=novelSdkFixture(f,'paper',false,broken);await n.controls(false);
 assert.throws(()=>assert.equal(w.barEnabled.status,false,'immersive status bar must be hidden'),/immersive status bar must be hidden/,
  'the original setting-dependent bug must fail the same native observation');
 f.C.detach();
});
await check('pending status reveal never borrows another window geometry or replacement window measurement',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 await f.C.requestReaderWindowPolicy(new f.P('system',false,true,false,true));
 w.avoidTop={left:0,top:0,width:0,height:0};await f.C.requestReaderWindowPolicy(new f.P('system',false,false,false,false));
 w.rect={left:0,top:0,width:844,height:390};w.events.get('windowSizeChange')(w.rect);
 assert.equal(f.C.metrics().statusBarHeight,0,'no invented landscape height');
 const b=f.windowPort();b.avoidTop={left:0,top:0,width:0,height:0};await f.C.install(b);await settle();
 assert.equal(f.C.metrics().statusBarHeight,0,'replacement with no measurement cannot reuse previous window band');f.C.detach();
});
await check('early positive event cannot end pending reveal before ACK; repeated show and app ownership preserve it',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 await f.C.requestReaderWindowPolicy(new f.P('system',false,true,false,true));
 const gate=deferred();w.nextStatus=gate;
 const reveal=f.C.requestReaderWindowPolicy(new f.P('system',false,false,false,false));await settle();
 w.avoidTop={left:0,top:0,width:390,height:48};w.events.get('avoidAreaChange')({});
 w.avoidTop={left:0,top:0,width:0,height:0};gate.resolve();await reveal;
 assert.equal(f.C.metrics().statusBarHeight,48,'pre-ACK event must not clear reveal retention');
 await f.C.requestReaderWindowPolicy(new f.P('system',true,false,false,false));
 assert.equal(f.C.metrics().statusBarHeight,48,'same reveal with changed keep-awake policy');
 await f.C.requestAppWindowPolicy();assert.equal(f.C.metrics().statusBarHeight,48);
 w.avoidTop={left:0,top:0,width:390,height:46};w.events.get('avoidAreaChange')({});assert.equal(f.C.metrics().statusBarHeight,46);
 w.avoidTop={left:0,top:0,width:0,height:0};w.events.get('avoidAreaChange')({});assert.equal(f.C.metrics().statusBarHeight,0);
 f.C.detach();
});
await check('show superseded by hide converges and same-size rotation does not reuse the pending band',async()=>{
 const f=fixture(),w=f.windowPort();await f.C.install(w);await settle();
 await f.C.requestReaderWindowPolicy(new f.P('system',false,true,false,true));
 const gate=deferred();w.nextStatus=gate;w.avoidTop={left:0,top:0,width:0,height:0};
 const reveal=f.C.requestReaderWindowPolicy(new f.P('system',false,false,false,false));await settle();
 const hide=f.C.requestReaderWindowPolicy(new f.P('system',false,true,false,true));gate.resolve();await Promise.all([reveal,hide]);
 assert.equal(w.barEnabled.status,false);assert.equal(f.C.metrics().statusBarHeight,48);
 await f.C.requestReaderWindowPolicy(new f.P('system',false,false,false,false));
 f.displayInfo.rotation=2;w.events.get('windowRectChange')({});assert.equal(f.C.metrics().statusBarHeight,0,'180-degree rotation has no measured band yet');
 f.C.detach();
});
for(const result of cases)console.log(JSON.stringify(result));
console.log(JSON.stringify({sdkEvidence,cases:cases.length}));
assert.equal(cases.filter(x=>x.status==='FAIL').length,0,'production window chrome scenarios');
console.log('PASS actual SDK Manga/Shell Props/State Watch → production intent → actual Coordinator, authored phone mask opening/drag/closing/restore, both Area orders and font-metric retry, plus actual novel SDK ownership/control sessions, existing LRE palette/order cases and ten production counterfactuals. Native branch removal, subscriber delivery and Window promises are controlled boundaries; no device pixel, compositor, failure-frequency or native-bar acceptance claim.');
