import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire, registerHooks, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReaderSessionLaunchController } from '../entry/src/main/ets/features/reading/ReaderSessionLaunchController.ts';
import { ReaderSessionMorphSourceMeasurement } from '../entry/src/main/ets/features/reading/ReaderSessionMorphState.ts';
import { buildReaderSessionLaunchGeometry, readerSessionLaunchDesign } from '../entry/src/main/ets/features/reading/ReaderSessionLaunchPresentation.ts';
import { readerAppearanceCubicBezierProgress as b } from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';
import * as motion from '../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts';
import * as policy from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import { deriveReaderSessionCapsule } from '../entry/src/main/ets/features/reading/ReaderSessionCapsuleModel.ts';
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) {
  if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; } } });
const { LocalReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
import { projectReaderBookmarkRows } from '../entry/src/main/ets/features/reading/ReaderBookmarkProjection.ts';
const file = n => new URL(`../entry/src/main/ets/features/reading/${n}`, import.meta.url);
const mapCode=stripTypeScriptTypes(readFileSync(file('ReadingSurfaceLayoutMap.ts'),'utf8')
  .replace('constructor(private readonly content: string) {','constructor(content: string) { this.content = content;'));
const ReadingSurfaceLayoutMap=new Function(mapCode.replace('export class','class')+';return ReadingSurfaceLayoutMap;')();
const curves = {flight:p=>b(p,.4,0,.2,1),expand:p=>b(p,.2,0,0,1),easeIn:p=>b(p,.42,0,1,1),
  easeOut:p=>b(p,0,0,.58,1),easeInOut:p=>b(p,.42,0,.58,1)};
const identity = {lifecycle:1,bookIdentity:'src:book',moduleVisit:1,viewportRevision:1,scrollRevision:1,
  layoutRevision:1,paletteRevision:1,fontRevision:1,sourceRevision:1,sourceActorId:'source'};
const clocks=[];
for(const kind of ['quickAutoPage','quickTts','fullAutoPagePlayback','fullTtsPlayback']) {
  const d=readerSessionLaunchDesign(kind),g=buildReaderSessionLaunchGeometry({source:
    new ReaderSessionMorphSourceMeasurement(kind,'source',30,400,d.width,d.height,1),
    targetLeft:270,targetTop:797,topBarExitDistance:90,dockExitDistance:740});
  const c=new ReaderSessionLaunchController(curves);const launch=c.begin(identity,g,10000);let releases=0;
  c.admitPreparedResource(launch.generation,identity,{release:()=>releases++},1,1,1);
  for(const wall of [0,50,100,349,350,699,700,849,850,1149,1150,1749,1750]) {
    const s=c.advance(launch.generation,10000+wall).sample;
    assert.equal(s.timeMs,wall*2); assert.equal(s.controlsPresented,wall<350);
    assert.equal(s.sourceNeeded,wall<700);assert.equal(s.settled,wall>=1150);assert.equal(s.finished,wall>=1750);
    clocks.push({kind,wall,design:s.timeMs,phase:s.phase});
  }
  assert.equal(releases,1);assert.equal(c.remainingHoldMs(),0);
  // Physical lane geometry, independent of the archived CSS property equality.
  const gap=5, footerWidth=53, baseRight=g.targetLeft-gap;
  const fresh=new ReaderSessionLaunchController(curves),start=fresh.begin(identity,g,0);
  for(let wall=700;wall<=1750;wall+=3) {
    const s=fresh.advance(start.generation,wall).sample;
    const footerRight=(baseRight-footerWidth)+footerWidth+s.footerTranslateX;
    assert.ok(footerRight<=s.proxyLeft-gap+1e-8,`${kind}: footer intersects at ${wall}`);
  }
}

// Execute the production retained Panel Builder; inspect emitted native layers.
const source=readFileSync(file('ReaderControlPanel.ets'),'utf8');
function panelProbe(text) {
  // Child content is outside this layer test. Preserve the production root
  // Builder byte-for-byte and register empty child Builder bodies with the SDK.
  const require=createRequire(import.meta.url),sdk='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const ts=require(`${sdk}/node_modules/typescript`),syntax=require(`${sdk}/lib/validate_ui_syntax.js`);
  syntax.componentCollection.customComponents.add('ReaderSessionLaunchStage');
  const tree=ts.createSourceFile('Panel.ets',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS);
  const type=tree.statements.find(n=>n.members?.some(m=>m.name?.getText(tree)==='build'));
  const names=['topBar','controlContent','controlHeader','brightnessRail','moduleNavBar','readerMoreMenu','launchSourceContent'];
  const childBodies=type.members.filter(n=>names.includes(n.name?.getText(tree))).sort((a,b)=>b.pos-a.pos);
  for(const n of childBodies)text=text.slice(0,n.body.pos)+' { Column() {} }'+text.slice(n.body.end);
  const {owner}=createReaderBuilderProbe(text,['build',...names],{
    readerControlHasFullContentSurface:()=>true,
    AccessibilityRoleType:{BUTTON:'button'},
  });
  Object.assign(owner,{layout:{viewportWidth:390,viewportHeight:844,topBarWidth:360,topBarTop:19,fullPanelWidth:364},
    inputEnabled:true,controlObscured:false,visualHeldPointerId:-1,appScheme:'day',moreMenuVisible:false,
    launchSample:undefined,contentInputEnabled:()=>true,
    contentLocation:()=>({level:'secondary',module:'settings',form:'quick'}),
    controlPanelHeight:()=>736,dockLeft:()=>13,dockTop:()=>89,
    frame:()=>motion.sampleReaderControlMotionComposition({expansionProgress:0,visibilityProgress:1},motion.readerControlMotionBounds(364,736,19)),
    topBar(){},controlContent(){},controlHeader(){},brightnessRail(){},moduleNavBar(){},accessibleControlActions(){}});
  owner.initialRender();
  const get=id=>[...owner.nodes.values()].find(n=>n.id===id);
  const grabber=get('reader-control-motion-grabber'), quick=get('reader-control-quick-content-surface');
  assert.equal(grabber.zIndex,3,'the grabber owns its complete 72x28 hit area above Header z2');
  assert.equal(quick.opacity,1);assert.equal(quick.borderRadius,8);
  const header=[...owner.nodes.values()].find(n=>n.zIndex===2);
  assert.equal(header.enabled,false,'invisible Quick header cannot intercept touches');
  const outline=get('reader-control-content-outline');
  assert.ok(owner.attributeCalls.findIndex(n=>n.property==='id'&&n.args[0]==='reader-control-content-outline')>
    owner.attributeCalls.findIndex(n=>n.property==='id'&&n.args[0]==='reader-control-full-content-surface'));
  owner.frame=()=>motion.sampleReaderControlMotionComposition({expansionProgress:1,visibilityProgress:1},motion.readerControlMotionBounds(364,736,19));
  owner.replay();assert.equal(quick.opacity,0);assert.equal(outline.borderRadius,12);assert.equal(outline.opacity,1);
  assert.equal(get('reader-control-full-content-surface').border,undefined,'the stroke is not painted twice with alpha');
  return {grabber,quick,outline};
}
const layers=panelProbe(source);
assert.throws(()=>panelProbe(source.replace(".zIndex(3)",".zIndex(0)")),/grabber owns/);

// Real Host hold scheduling: one timer, no native frames after visual settle;
// cancelled generations cannot publish a late terminal sample.
let now=1150,frames=[],timers=[],cleared=[];
const Host=productionMotionMethods(file('LocalReadingExperience.ets'),['scheduleSessionLaunchFrame','liveSessionCapsuleSnapshot',
 'admitSessionControlClosing','sessionChromeForPresentation'],{
  readerMotionNowMs:()=>now,ReaderUIFrameCallback:class {constructor(fn){this.fn=fn;}},
  setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:id=>cleared.push(id),deriveReaderSessionCapsule});
const c=new ReaderSessionLaunchController(curves),d=readerSessionLaunchDesign('quickTts');
const g=buildReaderSessionLaunchGeometry({source:new ReaderSessionMorphSourceMeasurement('quickTts','source',30,500,d.width,d.height,1),targetLeft:270,targetTop:797,topBarExitDistance:90,dockExitDistance:330});
const tx=c.begin(identity,g,0);c.advance(tx.generation,1150);
const host=Object.assign(new Host(),{mounted:true,appForeground:true,exitRequested:false,sessionLaunch:c.snapshot(),sessionLaunchController:c,
  sessionLaunchFramePending:false,sessionLaunchHoldTimer:-1,getUIContext:()=>({postFrameCallback:f=>frames.push(f)})});
host.scheduleSessionLaunchFrame(tx.generation);host.scheduleSessionLaunchFrame(tx.generation);
assert.equal(frames.length,0);assert.equal(timers.length,1);assert.equal(timers[0].ms,600);
c.cancel('openControl');now=1750;timers[0].fn();assert.equal(host.sessionLaunch.sample.timeMs,2300);
Object.assign(host,{phase:'ready',controlObscured:false,interactionBlocked:false,controlVisible:()=>true,
  controlShellExitArmed:()=>true,autoPageState:{status:'paused',remainingSeconds:8},ttsState:{status:'idle'}});
assert.equal(host.liveSessionCapsuleSnapshot()?.type,'autoPage','existing capsule is admitted on first closing frame');
host.controlShellExitArmed=()=>false;assert.equal(host.liveSessionCapsuleSnapshot(),undefined);
host.pageTurnRenderRevision=0;host.sessionControlClosing=false;
host.admitSessionControlClosing(true);assert.equal(host.liveSessionCapsuleSnapshot()?.type,'autoPage');
for(let i=0;i<100;i++)host.admitSessionControlClosing(true);
assert.equal(host.pageTurnRenderRevision,1,'100 drag frames publish one capsule ownership edge');
host.admitSessionControlClosing(false);assert.equal(host.liveSessionCapsuleSnapshot(),undefined);
Object.assign(host,{chapter:{chapterIndex:3},visiblePage:{startScalar:12},currentChapterIndex:()=>3,
  chapterLayoutMap:{scalarCount:()=>100},materializedContentVersion:'v',pageChromeClockText:'12:00',
  pageChromeStateFrozen:()=>false,pageChromePaginationKey:()=>({}),pageChromeSnapshot:(chapter,start)=>({chapter,start}),
  currentPageTurnRenderPage:()=>{throw Error('must not hand back to stale texture chrome');}});
assert.equal(host.sessionChromeForPresentation().start,12);
host.visiblePage={startScalar:24};assert.equal(host.sessionChromeForPresentation().start,24);
host.pageChromeStateFrozen=()=>true;host.visiblePage={startScalar:50};assert.equal(host.sessionChromeForPresentation().start,24);

// Real Core protocol adapter preserves original text separately from a note.
let received;
const gateway=new LocalReadingFlowGateway({request:async(command,args)=>{received=args;return {data:command==='bookmark.create'?{
  bookmark:{...args,time:7,content:'personal note'}}:{bookmarks:[{time:7,bookName:'B',bookAuthor:'A',chapterIndex:0,
  chapterPos:12,chapterName:'C',bookText:'original text',content:'personal note'}]}};}});
const mark=await gateway.createPositionBookmark({bookName:'B',bookAuthor:'A',chapterIndex:0,chapterOffset:12,chapterTitle:'C',bookText:'original text'});
assert.equal(received.bookText,'original text');assert.equal(mark.bookText,'original text');assert.equal(mark.content,'personal note');
const rows=await gateway.loadBookmarkProjection('B','A',[{index:0,title:'C',downloadState:'unknown',bookmarks:[]}]);
assert.equal(rows[0].bookmarks[0].bookText,'original text');
const projection=projectReaderBookmarkRows(rows,'');assert.equal(projection[0].excerpt,'original text');assert.equal(projection[0].positionLabel,'');
assert.equal(projection[0].chapterOffset,12,'removing an internal display field never changes the Core scalar anchor');
const Hydrator=productionMotionMethods(file('LocalReadingExperience.ets'),['controlDirectoryEntries']);
const old=[{index:0,title:'Old',bookmarks:[{time:1,chapterIndex:0,chapterOffset:1,content:'keep note',bookText:''}]},
  {index:1,title:'Other',bookmarks:[{time:2,chapterIndex:1,chapterOffset:0,content:'',bookText:''}]}];
let activeChapter={sourceId:'src',bookId:'b',chapterIndex:0,contentVersion:'v1',content:'A\ud83d\ude42body'};
const hydration=Object.assign(new Hydrator(),{chapter:activeChapter,chapterLayoutMap:new ReadingSurfaceLayoutMap(activeChapter.content),
  controlDirectorySourceEntries:()=>old,bookmarkExcerptCache:new Map()});
const hydrated=hydration.controlDirectoryEntries();assert.equal(hydrated[0].bookmarks[0].bookText,'\ud83d\ude42body');
assert.equal(hydrated[0].bookmarks[0].content,'keep note');assert.equal(old[0].bookmarks[0].bookText,'');
assert.equal(hydrated[1],old[1],'unmaterialized chapters are never fetched or modified');
assert.equal(hydration.controlDirectoryEntries(),hydrated,'unchanged chapter/projection keeps stable row identity');
for(let revision=0;revision<160;revision++) {
  hydration.chapter={...activeChapter,contentVersion:`v${revision}`};hydration.controlDirectoryEntries();
  assert.ok(hydration.bookmarkExcerptCache.size<=128);
}
// Original page text uses the existing UTF-16/scalar map, preserving emoji/CRLF.
const Bookmark=productionMotionMethods(file('LocalReadingExperience.ets'),['currentPageBookmarkText','currentPageBookmarkStatus','toggleCurrentPageBookmark','pageBookmarkFeedbackAnchor','reconcilePageBookmarkFeedback']);
const chapterText='A\ud83d\ude42\r\nBC\u4e2dD',map=new ReadingSurfaceLayoutMap(chapterText);
let requests=[];let entries=[{index:0,title:'C',bookmarks:[]}];
const bookmark=Object.assign(new Bookmark(),{bookmarkPendingTarget:'',bookmarkMutationGeneration:0,mounted:true,chapter:{chapterIndex:0,content:chapterText},chapterLayoutMap:map,
  visiblePage:{startScalar:1,endScalar:7},currentChapterIndex:()=>0,controlDirectoryEntries:()=>entries,
  onTogglePageBookmark:request=>requests.push(request)});
assert.equal(bookmark.currentPageBookmarkText(),'\ud83d\ude42\r\nBC\u4e2d');bookmark.toggleCurrentPageBookmark();
assert.equal(requests[0].bookText,bookmark.currentPageBookmarkText());assert.equal(requests[0].chapterOffset,1);
assert.equal(bookmark.currentPageBookmarkStatus(),'empty');
entries=[{index:0,title:'C',bookmarks:[{time:7,chapterOffset:1}]}];
assert.equal(bookmark.currentPageBookmarkStatus(),'bookmarked');
entries=[{index:0,title:'C',bookmarks:undefined}];assert.equal(bookmark.currentPageBookmarkStatus(),'unknown');
const feedbackSource=readFileSync(file('LocalReadingExperience.ets'),'utf8');
for(const [status,offset,preview,expectVisible] of [['empty',24,true,true],['bookmarked',24,true,true],
 ['empty',24,false,true],['empty',0,false,false],['bookmarked',0,false,true],['unknown',0,false,false]]) {
  const {owner}=createReaderBuilderProbe(feedbackSource,['bookmarkCornerFeedback','pageBookmarkFeedbackFilled'],{FlexAlign:{End:'end'}});
  Object.assign(owner,{bookmarkPendingTarget:'',controlVisible:()=>false,controlObscured:false,currentPageBookmarkStatus:()=>status,
    bookmarkPageOffsetY:offset,bookmarkPreviewChanged:preview,readerAppScheme:'day',viewportWidth:390,
    bookmarkCornerLayout:()=>({topAccessoryX:341,topAccessoryY:4,topAccessoryWidth:24,topAccessoryHeight:24}),
    bookmarkFeedbackLabel:()=> 'bookmark',
    readingLayout:()=>({pageChromeVisualSafeTop:0,pageChromeTopRegionHeight:32})});
  owner.bookmarkCornerFeedback();const icons=[...owner.nodes.values()].filter(n=>n.type==='Image');
  assert.equal(icons.length,expectVisible?1:0);
  if(icons.length)assert.equal(icons[0].width,24);
}
const record=process.argv.indexOf('--record');if(record>=0)writeFileSync(process.argv[record+1],JSON.stringify({clocks,layers},null,2));
console.log('PH reading: 4 production clocks, nonintersecting footer, native Builder layers, cancelled hold, closing capsule, Core original text PASS');
