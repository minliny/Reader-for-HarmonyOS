import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const stageFile = new URL('ReaderContinuousReadingStage.ets', reading);
const InputClock = productionMotionMethods(new URL('ReaderPageInputClock.ts', reading), ['sample']);
class Clock extends InputClock { constructor() { super(); Object.assign(this, { initialized:false,lastNativeMs:-1,lastReceivedMs:0,timeMs:0,nativeOffsetMs:0,rebase:false,resetVelocity:false }); } }
const TouchType = { Down:0, Move:1, Up:2, Cancel:3 }, ScrollState={Idle:0,Scroll:1,Fling:2};
const Stage=productionMotionMethods(stageFile,['scheduleInitialScroll','tryApplyInitialScroll','initialListIndex',
 'acceptParagraphPosition','cancelInitialScrollForInput','handleTouch','resetTouch','reportManualInteraction',
 'onContentScrolled','onContentScrollStopped','reportCurrentVisibleRange','reportVisibleRange','fragmentRenderKey',
 'hasTitleItem','onListAttached','confirmInitialScroll','releaseInitialParagraph','beginProgrammaticScroll'],{
 TouchType,ScrollState,ScrollAlign:{START:'start'},LengthMetrics:{vp:value=>({value,unit:'vp'})},
 ContinuousLayoutFrame:class{constructor(action){this.action=action;}},CONTINUOUS_TAP_SLOP:12,
 ReaderPageInputClock:Clock,readerMotionNowMs:()=>1000,READER_PAGE_GESTURE_LONG_PRESS_MS:500,
 prepareReaderNativeParagraph:(context,recipe)=>context.prepare(recipe),
});
const textFragment=(id='text',key='native-v1')=>({id,text:'原始正文',nativeParagraph:{key},imageHeight:0,startScalar:100,endScalar:300,isParagraphStart:true,continuousSpaceBefore:true});
const touch=(type,y=200)=>({type,timestamp:1000,changedTouches:[{id:1,x:50,y}],touches:[{id:1,x:50,y}]});
function fixture({fragments=[textFragment()],title=false,grantPointer=true,applyCommand=true,end=false,owned=false,y=137}={}){
 const frames=[],scrolls=[],reports=[],events=[],calls={saves:0,manual:0,releases:0,prepares:0};
 const row={y:72,height:900};
 const position={yForScalar:()=>y,scalarForY:()=>200};
 const preparation={resource:{release(){calls.releases++;}},position,owned};
 const owner=Object.assign(new Stage(),{mounted:true,listAttached:false,listMountIdentity:'',initialAnchorRevision:1,
 interactionEnabled:true,chapterIdentity:'chapter-v1',geometryKey:'geometry-v1',titleItemCount:title?1:0,
 initialFragmentIndex:0,initialFragmentProgress:.5,initialScrollGeneration:0,initialScrollPending:false,
 initialScrollRequested:false,initialScrollCancelledByInput:false,initialSemanticAnchorProtected:false,
 visibleFragmentStart:0,visibleFragmentEnd:0,paragraphPositions:new Map(),paragraphPositionOwners:new Map(),
 fragmentIndexById:new Map(fragments.map((fragment,index)=>[fragment.id,index])),
 appearance:{paragraphSpacing:12,activeTheme:'paper'},layout:{contentTop:72,viewportWidth:390,viewportHeight:820,contentBottom:30},
 touchActive:false,touchPointerId:-1,touchMoved:false,manualInteractionReported:false,fragmentsProvider:()=>fragments,
 getUIContext:()=>({postFrameCallback:frame=>frames.push(frame),prepare(recipe){assert.equal(recipe,fragments[0].nativeParagraph);events.push('prepare');calls.prepares++;return preparation;}}),
 listScroller:{scrollToIndex(...args){events.push('jump-before-layout');scrolls.push(args);if(applyCommand)row.y=72-args[3].extraOffset.value;},
 scrollBy(){assert.fail('initial position cannot use a second relative correction');},getItemRect:()=>({...row}),isAtEnd:()=>end},
 onVisibleRangeChanged:(...args)=>reports.push(args),onScrollStopped:()=>calls.saves++,onPointerStart:()=>grantPointer,
 onPointerEnd(){},onManualInteraction:()=>calls.manual++,onBoundaryDrag(){},isScrollerAtStart:()=>false,isScrollerAtEnd:()=>false});
 return {owner,frames,scrolls,reports,events,calls,fragments,position,preparation,row,
 attach(){events.push('attach');owner.onListAttached(owner.listMountIdentity);},
 accept(){owner.acceptParagraphPosition(fragments[0].id,fragments[0].nativeParagraph.key,position);},
 frame(){assert.ok(frames.length);frames.shift().action();}};
}
{
 const f=fixture({title:true});f.owner.scheduleInitialScroll();
 assert.equal(f.calls.prepares,1);assert.equal(f.owner.initialListIndex(),1);assert.equal(f.scrolls.length,0);
 assert.equal(f.frames.length,0,'preparation must not schedule a visible-frame positioning step');
 f.accept();assert.equal(f.scrolls.length,0,'child resolver is no longer allowed to position');
 f.attach();assert.deepEqual(f.events,['prepare','attach','jump-before-layout']);
 assert.deepEqual(f.scrolls,[[1,false,'start',{extraOffset:{value:149,unit:'vp'}}]]);
 assert.equal(f.owner.initialParagraph.resource,f.preparation.resource,'the prepared owner is the row provider');
 f.attach();f.accept();assert.equal(f.scrolls.length,1);assert.equal(f.calls.saves,0);
 f.frame();assert.equal(f.calls.saves,1);assert.deepEqual(f.reports,[[0,0,.5]]);
 f.owner.scheduleInitialScroll();assert.equal(f.calls.prepares,1,'same navigation identity neither rebuilds nor measures');
}
{
 const f=fixture({title:true});f.fragments[0].startScalar=0;f.owner.initialFragmentProgress=0;
 f.owner.scheduleInitialScroll();f.attach();assert.equal(f.owner.initialListIndex(),0);
 assert.equal(f.scrolls[0][0],0);assert.equal(f.scrolls[0][3].extraOffset.value,0,'chapter title remains before its first body');
}
for(const outcome of ['ignored','late','EOF-visible','EOF-invisible']){
 const f=fixture({applyCommand:false,end:outcome.startsWith('EOF')});f.owner.scheduleInitialScroll();f.attach();
 if(outcome==='EOF-visible')f.row.y=72-149+20;
 if(outcome==='EOF-invisible')f.row.y=900;
 f.frame();
 if(outcome==='EOF-visible'){
  assert.equal(f.owner.initialScrollPending,false);assert.equal(f.owner.initialSemanticAnchorProtected,true);
  assert.deepEqual(f.reports,[[0,0,.5]],'legal clamp reports requested semantic position, not earlier visual top');
  f.owner.reportCurrentVisibleRange();assert.equal(f.reports.length,1);
 }else{
  assert.equal(f.owner.initialScrollPending,true);assert.equal(f.calls.saves,0);assert.equal(f.reports.length,0);
 }
 if(outcome==='late'){f.row.y=72-149;f.owner.onContentScrolled(0,ScrollState.Idle);assert.equal(f.owner.initialScrollPending,false);}
 const before=f.scrolls.length;f.accept();f.owner.tryApplyInitialScroll(f.owner.initialScrollGeneration);assert.equal(f.scrolls.length,before);
 f.owner.handleTouch(touch(TouchType.Down));f.owner.handleTouch(touch(TouchType.Move,170));
 f.owner.onContentScrolled(0,ScrollState.Scroll);
 if(outcome==='EOF-visible')assert.equal(f.owner.initialSemanticAnchorProtected,true,'pointer MOVE alone cannot overwrite clamped intent');
 f.owner.onContentScrolled(10,ScrollState.Scroll);assert.equal(f.owner.initialSemanticAnchorProtected,false);
 assert.equal(f.owner.initialScrollPending,false,'actual manual native movement takes ownership');
}
{
 const f=fixture({fragments:[{id:'image',text:'',imageHeight:240,startScalar:100,endScalar:101,isParagraphStart:true,continuousSpaceBefore:true}]});
 f.owner.initialFragmentProgress=.25;f.owner.scheduleInitialScroll();f.attach();
 assert.equal(f.calls.prepares,0);assert.equal(f.scrolls[0][3].extraOffset.value,72);
}
for(const y of [NaN,Infinity,-1]){
 const f=fixture({y,owned:true});assert.throws(()=>f.owner.scheduleInitialScroll(),/GEOMETRY_INVALID/);
 assert.equal(f.calls.releases,1);assert.equal(f.scrolls.length,0);
}
{
 const f=fixture({fragments:[{id:'missing',text:'正文',imageHeight:0,startScalar:0,endScalar:4}]});
 assert.throws(()=>f.owner.scheduleInitialScroll(),/GEOMETRY_UNAVAILABLE/);assert.equal(f.scrolls.length,0);
}
for(const axis of ['horizontal','vertical']){
 const f=fixture({applyCommand:false});f.owner.scheduleInitialScroll();f.attach();
 f.owner.handleTouch(touch(TouchType.Down));const move=touch(TouchType.Move,axis==='vertical'?170:200);
 if(axis==='horizontal'){move.touches[0].x=90;move.changedTouches[0].x=90;}f.owner.handleTouch(move);
 f.owner.onContentScrolled(0,ScrollState.Scroll);f.frame();f.owner.onContentScrollStopped();
 assert.equal(f.owner.initialScrollPending,true);assert.equal(f.calls.saves,0);assert.equal(f.reports.length,0);
 f.accept();assert.equal(f.scrolls.length,1,'late native resolver cannot reverse manual intent');
}
{
 const f=fixture({grantPointer:false});f.owner.scheduleInitialScroll();const gen=f.owner.initialScrollGeneration;
 f.owner.handleTouch(touch(TouchType.Down));assert.equal(f.owner.initialScrollGeneration,gen);f.attach();assert.equal(f.scrolls.length,1);
}
{
 const f=fixture({owned:true});f.owner.scheduleInitialScroll();const old=f.owner.listMountIdentity;f.attach();
 f.owner.initialAnchorRevision++;f.owner.scheduleInitialScroll();assert.equal(f.calls.releases,1);
 assert.notEqual(f.owner.listMountIdentity,old);f.owner.onListAttached(old);assert.equal(f.scrolls.length,1,'old List attach cannot command its replacement');
 f.frame();assert.equal(f.calls.saves,0);f.attach();assert.equal(f.scrolls.length,2);
 f.owner.acceptParagraphPosition('text','native-v1',undefined,old);assert.equal(f.owner.paragraphPositions.get('text'),f.position,'old same-recipe unmount cannot remove replacement resolver');
 f.owner.geometryKey='geometry-v2';f.owner.scheduleInitialScroll();assert.equal(f.calls.prepares,3);
 f.owner.mounted=false;f.frame();assert.equal(f.calls.saves,0);f.owner.releaseInitialParagraph();assert.equal(f.calls.releases,3);
}
{
 const f=fixture();f.owner.scheduleInitialScroll();f.owner.releaseInitialParagraph();assert.equal(f.calls.releases,0,'borrower cannot release the LRE owner');
 f.owner.acceptParagraphPosition('text','obsolete',f.position);assert.equal(f.owner.paragraphPositionOwners.get('text'),'native-v1');
 f.owner.acceptParagraphPosition('text','obsolete',undefined);assert.equal(f.owner.paragraphPositions.get('text'),f.position);
 const key=f.owner.fragmentRenderKey(f.fragments[0]);f.owner.appearance.activeTheme='night';assert.equal(f.owner.fragmentRenderKey(f.fragments[0]),key);
}
for(const state of [ScrollState.Idle,ScrollState.Scroll,ScrollState.Fling]){
 const f=fixture({applyCommand:false,end:true});f.owner.scheduleInitialScroll();f.attach();f.row.y=72-149+20;f.frame();
 assert.equal(f.owner.initialSemanticAnchorProtected,true);f.owner.beginProgrammaticScroll();
 f.owner.onContentScrolled(0,state);assert.equal(f.owner.initialSemanticAnchorProtected,true,'programmatic intent and zero movement do not rewrite EOF anchor');
 f.owner.onContentScrolled(5,state);assert.equal(f.owner.initialSemanticAnchorProtected,false,'actual explicitly requested movement including reduced-motion jumps takes ownership');
 assert.equal(f.owner.programmaticScrollPending,false);
}
const source=readFileSync(stageFile,'utf8');
assert.match(source,/\.onAttach\(\(\): void => this\.onListAttached\(mountIdentity\)\)/);
assert.doesNotMatch(source,/onListAppeared|\.onAppear\(/,'initial positioning cannot depend on a visible lifecycle callback');
assert.match(source,/ForEach\(\[this\.listMountIdentity\]/,'semantic replacement must construct a new actual List');
assert.match(source,/resourceProvider:[\s\S]*this\.initialParagraph\?\.resource/);
console.log('PASS continuous initial-attach: prepared owner before attach, one jump, title, legal EOF semantic fence, identity replacement, native input ownership, release and stale callback rejection; pixels remain a VM gate');
