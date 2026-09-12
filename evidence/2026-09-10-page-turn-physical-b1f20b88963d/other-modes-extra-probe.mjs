import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as gesture from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderPageGestureState.ts';
const base = '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/';
function extract(source, name) {
 let start=source.indexOf(`  private ${name}(`); if(start<0)start=source.indexOf(`  private async ${name}(`);
 assert.ok(start>=0,name);const end=source.indexOf('\n  private ',start+10);return source.slice(start,end<0?source.lastIndexOf('\n}'):end);
}
function make(file,names,bindings={}){const s=readFileSync(base+file,'utf8');return new Function(...Object.keys(bindings),stripTypeScriptTypes(`class Probe {\n${names.map(n=>extract(s,n)).join('\n')}\n}`,{mode:'strip'})+'\nreturn Probe;')(...Object.values(bindings));}
const Flat=make('LocalReadingExperience.ets',['onReaderPageGestureStateChanged','clampedPageTurnOffset'],{readerPageTransitionUsesPreparedPages:()=>true});
function owner(){return Object.assign(new Flat(),{pageTurnGestureState:gesture.createReaderPageGestureState(),pageTurnSessionCapsuleFrozen:true,usesBookTurnSimulation:()=>false,usesNoAnimationPageTurnRuntime:()=>false,preparedPageTurn:()=>({}),beginPageTurnPerf:()=>{},viewportWidth:390});}
const vertical=gesture.updateReaderPagePan(gesture.startReaderPagePan(390,200,400,0,800),0,-100,0,200,300,0,50);
const vo=owner();vo.onReaderPageGestureStateChanged(vertical);assert.equal(vo.pageTurnOffsetX,0);assert.equal(vertical.direction,'previous');
console.log(JSON.stringify({probe:'flat pure vertical previous',gestureOwner:vertical.owner,direction:vertical.direction,presentationOffsetX:vo.pageTurnOffsetX}));
const moved=gesture.updateReaderPagePan(gesture.startReaderPagePan(390,300,200,0,800),-80,0,0,220,200,0,40);
const up=gesture.finishReaderPagePan(moved,-200,0,0,100,200,0,60);
const fo=owner();fo.onReaderPageGestureStateChanged(moved);fo.onReaderPageGestureStateChanged(up.state);
assert.equal(up.state.currentOffsetX,-200);assert.equal(fo.pageTurnOffsetX,-80);
console.log(JSON.stringify({probe:'flat final UP presentation coordinate',decisionOffsetX:up.state.currentOffsetX,presentationOffsetX:fo.pageTurnOffsetX,direction:up.direction}));
const Scroll=make('ReaderContinuousReadingStage.ets',['handleTouch'],{TouchType:{Down:0,Move:1,Up:2,Cancel:3},CONTINUOUS_TAP_SLOP:8});
const so=Object.assign(new Scroll(),{interactionEnabled:true,touchActive:false});
so.handleTouch({type:0,changedTouches:[{id:1,x:100,y:100}],touches:[{id:1,x:100,y:100}]});
so.handleTouch({type:0,changedTouches:[{id:2,x:250,y:500}],touches:[{id:1,x:100,y:100},{id:2,x:250,y:500}]});
assert.equal(so.touchStartY,500);
console.log(JSON.stringify({probe:'scroll second DOWN replaces first origin',firstPointerY:100,secondPointerY:500,recordedOriginY:so.touchStartY}));
