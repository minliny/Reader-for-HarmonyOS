import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';

const root = new URL('../entry/src/main/ets/features/', import.meta.url);
const sdk = boundedSurfaceSdk();
let cases = 0;
const definitions = {
  directory: {
    file: 'reading/ReaderFullDirectory.ets',
    fields: ['reduceMotion','animateFromControl','panelProgress','animationGeneration','collapseStarted','mounted','collapseExit','onExit'],
    methods: ['aboutToAppear','aboutToDisappear','shouldAnimatePanel','requestCollapse','onReduceMotionChanged','finishCollapse'],
    props: { reduceMotion:false,animateFromControl:true },
  },
  menu: {
    file:'bookshelf/BookshelfMoreMenu.ets',
    fields:['reduceMotion','panelHeight','closeInFlight','mounted','generation','closeFinish'],
    methods:['aboutToAppear','aboutToDisappear','surfaceSpec','expandMenu','collapseMenu','onReduceMotionChanged','finishCollapse'],
    props:{reduceMotion:false},
  },
  select: {
    file:'common/ReaderSelectPanel.ets',
    fields:['reduceMotion','value','options','variant','closing','selectionId','expandedHeight','chevronAngle','closeInFlight','mounted','generation','closingValue','closingOptions','closeFinish','onSelect','onCommit','onDismiss'],
    methods:['aboutToAppear','aboutToDisappear','expandPanel','fullPanelHeight','collapsePanel','onReduceMotionChanged','finishCollapse','onIdentityChanged','onClosingChanged','selectAndCollapse'],
    props:{reduceMotion:false,value:'a',options:['a','b'],variant:'default',closing:false,selectionId:'A'},
  },
};
function fixture(kind,mutate = source => source) {
  const d=definitions[kind], source=mutate(readFileSync(new URL(d.file,root),'utf8'));
  const property=createArkUIPropertyRuntimeProbe(),animations=[],tasks=[],props={...d.props};
  const uiContext={ getFont:()=>({}), animateTo(params,apply){animations.push(params);apply();} };
  const probe=createReaderBuilderProbe(source,[...d.fields,...d.methods],{
    ...sdk.deps,...property.sdk,uiContext,registerReaderFonts(){},OPTION_H:36,
    APPEARANCE_SELECT_OPTION_HEIGHT:30,appearanceSelectMenuHeight:n=>n*30+6,
    setTimeout:callback=>{tasks.push(callback);return tasks.length;},
    motionAnimateParam:(id,onFinish)=>({id,duration:210,onFinish}),
  },{...property.hooks,initialParams:props});
  const owner=probe.owner;owner.usesExpandedLayout=()=>false;owner.aboutToAppear();
  return {owner,animations,tasks,property,props,
    update(values){Object.assign(props,values);owner.updateStateVars(props);property.flush();}};
}
{
  const f=fixture('directory');assert.equal(f.tasks.length,1);assert.equal(f.owner.panelProgress,0);
  f.update({reduceMotion:true});assert.equal(f.owner.panelProgress,1);f.tasks.shift()();
  assert.equal(f.animations.filter(p=>p.duration>0).length,0,'queued expansion rechecks the actual motion admission');cases++;
}
for(const kind of Object.keys(definitions)) {
  const f=fixture(kind);let finished=0,committed=0;
  if(kind==='directory'){f.tasks.shift()();f.owner.onExit=()=>finished++;f.owner.requestCollapse();}
  else if(kind==='menu')f.owner.collapseMenu(()=>finished++,()=>committed++);
  else f.owner.collapsePanel(()=>finished++,()=>committed++);
  const old=f.animations.findLast(p=>p.onFinish);assert.ok(old);
  assert.equal(finished,0);f.update({reduceMotion:true});assert.equal(finished,1,'real SDK Prop reset delivers the Watch and captured completion');
  old.onFinish();old.onFinish();assert.equal(finished,1,'old compositor finish cannot deliver twice');
  if(kind!=='directory')assert.equal(committed,1,'motion retirement never repeats the business action');
  assert.equal(f.animations.at(-1).duration,0);
  f.update({reduceMotion:false});assert.equal(finished,1,'enabling motion does not replay a retired intent');cases++;
}
for(const kind of Object.keys(definitions)) {
  const f=fixture(kind);let done=0;
  if(kind==='directory'){f.tasks.shift()();f.owner.onExit=()=>done++;f.owner.requestCollapse();}
  else if(kind==='menu')f.owner.collapseMenu(()=>done++);
  else f.owner.collapsePanel(()=>done++);
  const old=f.animations.findLast(p=>p.onFinish);f.owner.aboutToDisappear();f.update({reduceMotion:true});old.onFinish();
  assert.equal(done,0,'unmounted old presentation releases its captured completion without publishing');cases++;
}
{
  const f=fixture('select');let old=0,live=0;f.owner.collapsePanel(()=>old++);
  const oldFinish=f.animations.findLast(p=>p.onFinish);f.update({selectionId:'B'});
  f.owner.collapsePanel(()=>live++);const newFinish=f.animations.findLast(p=>p.onFinish);
  f.update({reduceMotion:true});oldFinish.onFinish();newFinish.onFinish();assert.equal(old,0);assert.equal(live,1);cases++;
}
{
  const f=fixture('select');let committed=0,dismissed=0;f.owner.onCommit=()=>committed++;f.owner.onDismiss=()=>dismissed++;
  f.owner.selectAndCollapse('b');const old=f.animations.findLast(p=>p.onFinish);
  assert.equal(committed,1);f.update({reduceMotion:true});old.onFinish();assert.equal(committed,1);assert.equal(dismissed,1);cases++;
}
for(const kind of Object.keys(definitions)) {
  const f=fixture(kind,source=>source.replace("@Prop @Watch('onReduceMotionChanged') reduceMotion",'@Prop reduceMotion'));
  let done=0;if(kind==='directory'){f.tasks.shift()();f.owner.onExit=()=>done++;f.owner.requestCollapse();}
  else if(kind==='menu')f.owner.collapseMenu(()=>done++);else f.owner.collapsePanel(()=>done++);
  f.update({reduceMotion:true});assert.equal(done,0,'omission control reproduces the missing current Prop reaction');cases++;
}
console.log(`PASS ${cases} popup motion contracts: real SDK Prop/Watch runtime; queued expand re-admission, zero-duration current endpoint, captured completion once, original action once, identity replacement and unmount negatives; no page remount or native scanout claim.`);
