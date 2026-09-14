import * as sessionPolicy from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sdk=process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {ReaderControlMotionFrameCache} from '../entry/src/main/ets/features/reading/ReaderControlMotionGeometry.ts';
import {ReaderSessionMorphSourceMeasurement} from '../entry/src/main/ets/features/reading/ReaderSessionMorphState.ts';
import {buildReaderSessionLaunchGeometry,sampleReaderSessionLaunch} from '../entry/src/main/ets/features/reading/ReaderSessionLaunchPresentation.ts';
import {readerControlPlaybackSourceKind} from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import {sampleReaderControlAutoPage} from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import {createReaderControlMorphScroll,readerControlMorphScrollTranslation} from '../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';
const file=name=>new URL(`../entry/src/main/ets/features/reading/${name}`,import.meta.url);
const curves={flight:p=>p,expand:p=>p,easeIn:p=>p,easeOut:p=>p,easeInOut:p=>p};
const g=buildReaderSessionLaunchGeometry({source:new ReaderSessionMorphSourceMeasurement('quickTts','tts',30,510,286,190,1),targetLeft:260,targetTop:790,topBarExitDistance:90,dockExitDistance:330});
const P=productionMotionMethods(file('ReaderControlPanel.ets'),['frame','controlPanelHeight','onLaunchSourceVisible','confirmLaunchSourceReady','setMoreMenuVisible','dismissMoreMenu','performMoreAction','onRuntimeEnabledChanged']);
for(const time of [0,100,450,1100,1700,2200]){
 const sample=sampleReaderSessionLaunch(time,g,curves),events=[];
 const p=Object.assign(new P(),{launchSample:sample,launchOwnsControls:false,launchRecovering:true,launchGeneration:7,
 launchSourceKind:'quickTts',launchSourceVisibleGeneration:0,launchSourceReadyGeneration:0,launchMotionProgress:0,
 layout:{fullPanelWidth:364,fullPanelHeight:736,dockBottomGap:20},isExpanded:()=>false,controlQuickHeight:()=>330,
 launchFrameCache:new ReaderControlMotionFrameCache(),onLaunchSourceReady:n=>events.push(n)});
 for(const v of [0,.25,.75,1]){
  p.visualVisibilityProgress=v;const f=p.frame();
  assert.equal(f.topBar.translateY,sample.topBarOffsetY*(1-v));
  assert.equal(f.dock.translateY,sample.dockOffsetY*(1-v));
  assert.equal(f.topBar.opacity,1);assert.equal(f.dock.opacity,1);
 }
 p.visualVisibilityProgress=.5;p.onLaunchSourceVisible('quickTts');assert.deepEqual(events,[]);
 p.visualVisibilityProgress=1;p.confirmLaunchSourceReady();p.confirmLaunchSourceReady();assert.deepEqual(events,[7]);
 p.launchGeneration=8;p.confirmLaunchSourceReady();assert.deepEqual(events,[7],'old source readiness cannot complete a new generation');
}
for(const local of [true,false]){
 const actions=[],p=Object.assign(new P(),{inputEnabled:true,moreMenuVisible:false,frame:()=>({visibility:1}),
 currentPageBookmarkReady:false,isLocalBook:()=>local,onTemporaryLayerChange:v=>actions.push(['temporary',v]),
 onMore:()=>actions.push('bookmark'),onOpenBookInfo:()=>actions.push('info'),onExpandDirectory:()=>actions.push('directory'),onSourceSwitch:()=>actions.push('source')});
 p.setMoreMenuVisible(true);p.performMoreAction('bookmark');assert.equal(p.moreMenuVisible,true);
 assert.ok(!actions.includes('bookmark'),'unknown bookmark state cannot mutate');
 p.currentPageBookmarkReady=true;p.performMoreAction('bookmark');assert.equal(actions.at(-1),'bookmark');assert.equal(p.moreMenuVisible,false);
 for(const a of ['info','directory']){p.setMoreMenuVisible(true);p.performMoreAction(a);assert.equal(actions.at(-1),a);}
 p.setMoreMenuVisible(true);p.performMoreAction('source');assert.equal(actions.includes('source'),!local);
}
// Pure-source Builders use the same visual section functions, omit the normal
// Scroll/modal host, and cannot dispatch measurement/business callbacks.
for(const [name,module] of [['ReaderControlTtsContent.ets','tts'],['ReaderControlAutoPageContent.ets','autoPage']]){
 const source=readFileSync(file(name),'utf8');
 for(const m of source.matchAll(/@Builder\s+private (\w+)\(/g)) require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD.add(m[1]);
 for(const form of ['quick','full']){
  const members=module==='autoPage'?['launchSourceContent','quickHeader','headerMeta']:['launchSourceContent'];
  const {owner}=createReaderBuilderProbe(source,members,{readerControlMorphScrollTranslation});
  const sections=[];
  Object.assign(owner,{sourceOnly:form,availableWidth:286,availableHeight:190,appScheme:'day',status:'stopped',
   motionProgress:form==='quick'?0:1,p:()=>form==='quick'?0:1,scrollMotion:createReaderControlMorphScroll(),
   presentation:()=>({contentOpacity:1,contentBlur:0}),
   frame:()=>({playback:{x:8,y:24,width:280,height:128},control:{width:280,height:100},
    content:{x:0,y:0,width:286,height:190},details:{x:5,y:100,width:270,height:70}}),
   playback:()=>sections.push('playback'),timer:()=>sections.push('timer'),speed:()=>sections.push('speed'),
   controlSection:()=>sections.push('playback'),timerSection:()=>sections.push('timer'),moduleHeader:()=>{},speedRow:()=>sections.push('speed'),followHighlightRow:()=>{}});
  if(module==='autoPage')owner.frame=()=>sampleReaderControlAutoPage(form==='quick'?0:1,form==='quick'?286:338);
  owner.launchSourceContent();
  assert.equal(sections.filter(x=>x==='playback').length,1);assert.equal(sections.includes('timer'),form==='quick');
  assert.ok([...owner.nodes.values()].every(n=>n.type!=='Scroll'));
  if(module==='autoPage')assert.equal([...owner.nodes.values()].filter(n=>n.type==='Text'&&n.create==='自动翻页').length,
   form==='quick'?1:0,'PH51 retained Quick source executes its real header Builder, Full source only contains playback');
  const root=[...owner.nodes.values()][0];assert.equal(root.enabled,false);assert.equal(root.accessibilityLevel,'no-hide-descendants');
 }
 const C=productionMotionMethods(file(name),['onMotionChanged','measureActor','reportMorphActor','onFullDidScroll','onSourceDetachedChanged'],{readerControlPlaybackSourceKind});
 const c=Object.assign(new C(),{sourceOnly:'full',sourceDetached:false,scroller:{currentOffset:()=>{throw Error('source scroller invoked');}},
  syncMorphScroll:()=>{throw Error('source motion invoked');},onMorphActorMeasured:()=>{throw Error('source measured');}});
 c.onMotionChanged();c.measureActor(true,{});c.reportMorphActor();c.onFullDidScroll();c.onSourceDetachedChanged();
}
console.log('Reader session recovery: PASS (actual control pose rebase, source-ready generations, pure SDK source Builders, More actions)');

// Input ownership stays revoked during recovery, but its existing control
// clock must run; conflating those gates would deadlock the source handoff.
{
 const enabled=[],p=Object.assign(new P(),{inputEnabled:false,launchRecovering:true,controlObscured:false,
 runtime:{setEnabled:v=>{enabled.push(v);return {};}},acceptRuntime:()=>{}});
 p.onRuntimeEnabledChanged();assert.equal(enabled.at(-1),true);
 p.controlObscured=true;p.onRuntimeEnabledChanged();assert.equal(enabled.at(-1),false);
 p.controlObscured=false;p.launchRecovering=false;p.onRuntimeEnabledChanged();assert.equal(enabled.at(-1),false);
}

for(const [name,builder] of [['ReaderControlAutoPageContent.ets','runningButton'],['ReaderControlTtsContent.ets','roundControl']]){
 const source=readFileSync(file(name),'utf8');
 const {owner}=createReaderBuilderProbe(source,[builder],{readerTtsPlayGradientStart:()=> '#123456',FlexAlign:{Center:'center'}});
 Object.assign(owner,{p:()=>0,sourceOnly:'none',appScheme:'day',status:'running',state:{status:'playing'},serviceBusy:false,
 frame:()=>({playIcon:{x:0,y:0,width:32,height:32},toggle:{x:0,y:0,width:80,height:50}}),
 transport:()=>({x:0,y:0,width:40,height:40}),sharedInput:()=>true,onlineServicePage:()=>false,
 isHttpEngineSelected:()=>false,isActivelySpeaking:()=>owner.status==='running',hasActiveQueue:()=>true,controlText:()=>''});
 if(builder==='roundControl')owner.roundControl('toggle');else owner.runningButton();
 for(const scheme of ['day','night'])for(const playing of [true,false]){
  owner.appScheme=scheme;owner.status=playing?'running':'paused';owner.replay();
  const icon=[...owner.nodes.values()].find(n=>n.type==='Image').create;
  assert.equal(icon,`app.media.${builder==='roundControl'?(playing?'reader_tts_make_pause':'reader_tts_make_play'):(playing?'reader_session_pause':'reader_auto_full_play')}${scheme==='night'?'_theme_night':''}`);
 }
}

{
 const H=productionMotionMethods(file('LocalReadingExperience.ets'),['cancelSessionLaunch'],{...sessionPolicy,READER_CONTROL_OPEN_MS:220});
 const source=sessionPolicy.expandReaderControlSession(sessionPolicy.enterReaderControlModule(
   sessionPolicy.openReaderControlSession(sessionPolicy.createReaderControlSessionState(),0),'tts',0),0);
 const current={ownership:'stage',geometry:{type:'tts'}};
 const next={...current,ownership:'handoffPending',sample:sampleReaderSessionLaunch(900,g,curves)};
 const h=Object.assign(new H(),{sessionLaunch:current,sessionLaunchSourceControl:source,reduceMotion:false,
   sessionLaunchController:{cancel:()=>next},applyWindowPolicyForChromeOwner:()=>{}});
 h.cancelSessionLaunch('openControl');
 assert.equal(h.controlSession.transition.kind,'open');assert.equal(h.controlSession.transition.durationMs,220);
 assert.equal(sessionPolicy.readerControlContentLocation(h.controlSession).module,'tts');
 assert.equal(sessionPolicy.readerControlTargetLocation(h.controlSession).form,'full');
}
