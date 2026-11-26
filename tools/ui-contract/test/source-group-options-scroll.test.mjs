import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { selectedProductionMethods } from '../../lib/selected-production-methods.mjs';
import { requestedOperation,actionArgs,stableNativeFontReadback } from '../collectors/harmonyos/records.mjs';
import { normalizeHarmonyLayout,sourceGroupOptionsReference,sourceGroupOptionsScroll,sourceGroupOptionsTail,
  sourceGroupOptionsTextHead } from '../lib/layout.mjs';
import { evaluateSource } from '../lib/source.mjs';
import { requireSourceGroupOptionsCurrent,sourceGroupOptionsScrollFixturePath } from '../lib/source-group-options-scroll.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/source-management.group-options-scroll.json',import.meta.url)));
const [assertion,glyphAssertion] = definition.assertions;
const steps = new Map(definition.steps.map(step=>[step.id,step]));
const window = [0,0,366,800];
const instanceId = 'measured-source';
const owner = {mounting:2,generation:9};
const selectionId = 'source-group:5';

const raw = (type,id,rect,attrs={},children=[]) => {
  const bounds = `[${rect.slice(0,2)}][${rect.slice(2)}]`;
  return {attributes:{id,type,origBounds:bounds,bounds,visible:'true',opacity:'1',enabled:'true',
    hostWindowId:'42',clickable:type === 'Button' || type === 'Row' ? 'true' : 'false',...attrs},children};
};
const base = () => [
  raw('List','reader-source-list',[0,120,366,800]),
  raw('Button','reader-source-back',[4,50,48,94]),
  raw('Stack','reader-source-group-trigger',[204,115,343,159]),
];
const option = (label,y,group=selectionId,attrs={},paintedLabel=undefined) => raw('Button',
  `${group}:focus:${label}`,[140,y,340,y+44],attrs,paintedLabel === undefined ? [] : [
    raw('Row','',[151,y+10,329,y+33],{},[raw('Text','',[151,y+10,329,y+33],{text:paintedLabel})]),
  ]);
function panel(offset=0,showTail=false,{top=160,group=selectionId,forceHead=false,clippedTail=false,
  glyphs=false,wrongHeadText=false}={}) {
  const tailY = showTail ? top+528-offset : top+528;
  const reference = option('option:Phase1 Scroll 06',top+264-offset,group);
  const body = [
    ...(offset === 0 || forceHead ? [option('selected',top,group)] : []),
    ...(glyphs && offset === 0 ? [option('option:Phase1 Scroll 01',top+44,group,{},
      wrongHeadText ? 'Phase1 Scroll 02' : 'Phase1 Scroll 01')] : []),
    option('option:Private Diagnostic Group',top+44-offset,group,{visible:'false'}),
    reference,
    ...(showTail ? [option('option:Phase1 Scroll 12',tailY,group,clippedTail ?
      {bounds:`[140,${tailY}][340,${tailY+30}]`} : {},glyphs ? 'Phase1 Scroll 12' : undefined)] : []),
  ];
  return raw('Stack','',window,{zIndex:'30'},[
    raw('Row',`reader-source-group-backdrop:${group}`,window,{hitTestBehavior:'HitTestMode.Default'}),
    raw('__Common__','reader-source-group-panel',[135,top,345,top+330],{},[
      raw('Column','',[135,top,345,top+330],{zIndex:'10'},[
        raw('Column','',[135,top,345,top+330],{zIndex:'10',clip:'true'},[
          raw('Scroll','',[140,top,340,top+330],{},[
            raw('Column','',[140,top,340,top+330],{},body),
          ]),
        ]),
      ]),
    ]),
  ]);
}
function sample(beforeSeq,body=[],observeSourceGroupOptionsScroll=true,observeSourceGroupOptionsText=false) {
  const root = raw('root','',window,{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'},[...base(),...body]);
  const rect = {left:0,top:0,width:366,height:800};
  const report = {windowId:'42',vpPixels:1,fpPixels:1,followsSystemFontScale:true,maxFontScale:2,
    metrics:{ready:true,revision:3,densityPixels:1,windowRect:rect,globalRect:rect,
    keyboardArea:{available:true,visible:false,rects:[],revision:3},keyboardInsets:{left:0,top:0,right:0,bottom:0}}};
  const result = normalizeHarmonyLayout({tree:{attributes:{bounds:root.attributes.bounds},children:[root]},report,
    instanceId,evidenceRefs:[{path:'sample.png'},{path:'sample.json'}],observeSourceGroupOptionsScroll,observeSourceGroupOptionsText});
  result.window.fontScale = 1;
  result.window.nativeFont = stableNativeFontReadback(report,report);
  return {...result,beforeSeq,afterSeq:beforeSeq+1,captureComplete:true};
}
const action = (id,beforeSeq,afterSeq,extra={}) => {
  const {op,from,target:targetId} = steps.get(id);
  return {instanceId,op,from,targetId,beforeSeq,afterSeq,...extra};
};
const event = (eventSeq,kind,payload) => ({instanceId,eventSeq,kind,payload,channel:'business'});
const startingProjection = {owner,state:'rows',readFact:'current',readGeneration:3,allGroups:true,
  groupIndex:0,queryLength:0,count:12,projected:12,filterRevision:2,firstAnchor:1,textProjectionRevision:6};
const selectedProjection = {...startingProjection,allGroups:false,groupIndex:13,projected:1,filterRevision:3,firstAnchor:12};
function scenario(options={}) {
  const samples = {
    'source-ready':sample(5),'panel-before':sample(11,[panel(0,false,options)],true,options.glyphs),
    'panel-tail':sample(17,[panel(242,true,options)],true,options.glyphs),'selected-tail':sample(23),
  };
  const swipe = requestedOperation(steps.get('scroll-group-options'),samples,definition.fixture);
  const tap = requestedOperation(steps.get('select-tail-option'),samples,definition.fixture);
  return {samples,actions:{
    'open-sources':action('open-sources',1,3),'open-group':action('open-group',7,10),
    'scroll-group-options':action('scroll-group-options',13,16,{groupOptionsSwipe:{...swipe,probeSeq:31}}),
    'select-tail-option':action('select-tail-option',19,22,{groupOptionsTap:{...tap,probeSeq:41}}),
  },events:[
    event(2,'source.route',{action:'open',from:'settings',to:'source',...owner}),
    event(4,'source.projection',startingProjection),
    event(9,'source.overlay',{owner,selectionId,overlay:'group',phase:'open'}),
    event(20,'source.projection',{...selectedProjection,trigger:'group'}),
    event(21,'source.overlay',{owner,selectionId,overlay:'group',phase:'dismiss'}),
  ]};
}

test('source group options scroll proves real movement and selects the same opening’s public tail', () => {
  const fixture = JSON.parse(readFileSync(new URL(`../${sourceGroupOptionsScrollFixturePath}`,import.meta.url)));
  assert.deepEqual(fixture.map(entry=>entry.bookSourceUrl),fixture.map(entry=>entry.bookSourceUrl).sort());
  assert.equal(new Set(fixture.map(entry=>entry.bookSourceGroup)).size,12);
  assert.ok(fixture.every(entry=>!entry.enabled && !entry.enabledExplore));
  const correct = scenario();
  const evaluate = context => evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  const result = evaluate(correct);
  assert.equal(result.verdict,'PASS',result.reason);
  assert.equal(result.actual.scrollDistancePx,242);
  assert.equal(result.actual.distancePx,242);
  assert.equal(result.actual.gestureId,'group-options-scroll');
  assert.equal(result.actual.sampleId,'selected-tail');
  assert.equal(result.actual.gestureSampleId,'panel-tail');
  assert.equal(result.actual.baselineSampleId,'panel-before');
  assert.equal(result.actual.actionId,'scroll-group-options');
  assert.deepEqual(result.actual.dispatch,correct.actions['scroll-group-options'].groupOptionsSwipe);
  assert.equal(result.actual.projected,1);
  assert.equal(result.actual.selectionId,selectionId);

  const {samples,actions,events} = correct;
  assert.deepEqual(actionArgs(actions['scroll-group-options'].groupOptionsSwipe),
    ['shell','uitest','uiInput','swipe','240','470','240','179','900']);
  assert.deepEqual(actionArgs(actions['select-tail-option'].groupOptionsTap),
    ['shell','uitest','uiInput','click','240','468']);
  assert.doesNotThrow(()=>requireSourceGroupOptionsCurrent(samples['panel-before'],events.slice(0,3)));
  assert.throws(()=>requireSourceGroupOptionsCurrent(samples['panel-before'],events),/no longer owns/u);
  assert.throws(()=>requestedOperation(steps.get('scroll-group-options'),samples,{id:'other-case'}),/exact public/u);
  assert.ok(!JSON.stringify(samples).includes('Private Diagnostic Group'));
  assert.equal(samples['panel-before'].nodes.find(node=>node.alias === sourceGroupOptionsScroll)?.type,'Scroll');
  assert.equal(samples['panel-before'].nodes.find(node=>node.alias === sourceGroupOptionsReference)?.type,'Button');
  assert.equal(samples['panel-tail'].nodes.find(node=>node.alias === sourceGroupOptionsTail)?.type,'Button');
  assert.equal(sample(17,[panel(242,true)],false).nodes.some(node=>node.alias === sourceGroupOptionsTail),false);

  const noScroll = scenario();
  noScroll.samples['panel-tail'] = sample(17,[panel()]);
  assert.equal(evaluate(noScroll).verdict,'FAIL');

  const shiftedPanel = scenario();
  shiftedPanel.samples['panel-tail'] = sample(17,[panel(242,true,{top:170})]);
  assert.equal(evaluate(shiftedPanel).verdict,'FAIL');

  const clipped = scenario();
  clipped.samples['panel-tail'] = sample(17,[panel(242,true,{clippedTail:true})]);
  delete clipped.actions['select-tail-option'];
  assert.equal(evaluate(clipped).verdict,'FAIL');

  const mismatched = scenario();
  mismatched.actions['scroll-group-options'].groupOptionsSwipe.fromY -= 1;
  assert.equal(evaluate(mismatched).verdict,'NOT_RUN');

  const doubleCommit = scenario();
  doubleCommit.events.splice(4,0,event(20,'source.projection',{...selectedProjection,trigger:'group'}));
  assert.equal(evaluate(doubleCommit).verdict,'FAIL');

  const wrongOwner = scenario();
  wrongOwner.events[4] = event(21,'source.overlay',{owner:{...owner,generation:10},selectionId,overlay:'group',phase:'dismiss'});
  assert.equal(evaluate(wrongOwner).verdict,'FAIL');

  const wrongProjection = scenario();
  wrongProjection.events[3] = event(20,'source.projection',{...selectedProjection,trigger:'group',groupIndex:12});
  assert.equal(evaluate(wrongProjection).verdict,'FAIL');

  const incomplete = scenario();
  delete incomplete.samples['panel-tail'];
  assert.equal(evaluate(incomplete).verdict,'NOT_RUN');
});

function glyphMeasurement(phase,revision) {
  const role = phase === 'initial' ? 'group/option-head' : 'group/option-tail';
  const range = (leftPx,rightPx)=>({leftPx,topPx:2,rightPx,bottomPx:16});
  return {owner,scope:'group-menu',phase,selectionId,revision,windowRevision:3,
    textProjectionRevision:6,readGeneration:3,filterRevision:2,rowAnchor:1,
    widthVp:366,heightVp:800,density:1,systemFontScale:1,fontScale:1,
    labels:[{role,utf16Length:16,startUtf16:0,endUtf16:16,complete:true,
      lines:[{start:0,end:16,leftPx:0,topPx:0,widthPx:116,heightPx:18,baselinePx:14}],
      rangeRects:[range(0,116)],tailRects:[range(109,116)]}]};
}

function glyphScenario(options={}) {
  const context = scenario({glyphs:true,...options});
  context.events.push(
    {...event(10,'source.surface-text-layout',glyphMeasurement('initial',1)),windowRevision:3},
    {...event(16,'source.surface-text-layout',glyphMeasurement('settled',2)),windowRevision:3});
  context.events.sort((a,b)=>a.eventSeq-b.eventSeq);
  return context;
}

test('source group option glyphs bind native public head and tail to retained menu and system font',()=>{
  const evaluate = context=>evaluateSource({...glyphAssertion,acceptedSources:glyphAssertion.sources},context);
  const correct = glyphScenario();
  const result = evaluate(correct);
  assert.equal(result.verdict,'PASS',result.reason);
  assert.equal(result.actual.textScope,'group-menu');
  assert.equal(result.actual.sampleId,'panel-tail');
  assert.equal(result.actual.widthVp,366);
  assert.equal(result.actual.scale,1);
  assert.equal(result.actual.nativeFont.followsSystemFontScale,true);
  assert.deepEqual(Object.keys(result.actual.sampleProofs),['panel-before','panel-tail']);
  assert.equal(result.actual.roles['group/option-head'].actual.sampleId,'panel-before');
  assert.equal(result.actual.roles['group/option-tail'].actual.sampleId,'panel-tail');
  assert.equal(correct.samples['panel-before'].nodes.find(node=>node.alias === sourceGroupOptionsTextHead)?.type,'Button');
  assert.equal(sample(11,[panel(0,false,{glyphs:true})]).nodes.some(node=>node.alias === sourceGroupOptionsTextHead),false);
  assert.ok(!JSON.stringify(correct.samples).includes('Phase1 Scroll'));

  const wrongLabel = glyphScenario({wrongHeadText:true});
  assert.match(evaluate(wrongLabel).reason,/different public option label/u);
  assert.equal(evaluate(wrongLabel).verdict,'FAIL');

  const clipped = glyphScenario();
  clipped.events.find(event=>event.eventSeq === 16).payload.labels[0].tailRects[0].rightPx = 181;
  assert.equal(evaluate(clipped).verdict,'FAIL');
  assert.match(evaluate(clipped).reason,/ranges are clipped/u);

  const borrowed = glyphScenario();
  borrowed.events.find(event=>event.eventSeq === 16).payload.selectionId = 'source-group:4';
  assert.equal(evaluate(borrowed).verdict,'NOT_RUN');

  const stale = glyphScenario();
  stale.events.find(event=>event.eventSeq === 16).payload.textProjectionRevision = 5;
  assert.equal(evaluate(stale).verdict,'NOT_RUN');

  const late = glyphScenario();
  late.events.find(event=>event.eventSeq === 16).eventSeq = 18;
  assert.equal(evaluate(late).verdict,'NOT_RUN');

  const font = glyphScenario();
  font.samples['panel-tail'].window.nativeFont.followsSystemFontScale = false;
  assert.equal(evaluate(font).verdict,'NOT_RUN');

  const unconfirmedChoice = glyphScenario();
  delete unconfirmedChoice.actions['select-tail-option'];
  assert.equal(evaluate(unconfirmedChoice).verdict,'NOT_RUN');
});

test('source group option glyph producer retires detached and superseded frames',()=>{
  const pagePath = new URL('../../../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url);
  const panelPath = new URL('../../../entry/src/main/ets/ui/controls/ReaderSelectPanel.ets',import.meta.url);
  const frames = [];
  const emitted = [];
  const taps = [];
  class SourceListLayoutFrame { constructor(_context,read) { this.read = read; } }
  class ReaderSourceTextMetrics {
    labels = new Map();
    track(role,text) { this.labels.set(role,{role,utf16Length:text.length,lines:[{}]}); return {role}; }
    readTracked() { return [...this.labels.values()]; }
  }
  const Page = selectedProductionMethods(pagePath,'SourceManagementPage',[
    'prepareVerificationGroupText','verificationGroupTextOptions','scheduleVerificationGroupText',
  ],{SourceListLayoutFrame,ReaderSourceTextMetrics,ReaderUIVerificationProbe:{
    enabled:()=>true,emit:(kind,channel,payload)=>emitted.push({kind,channel,payload}),
  }});
  const Select = selectedProductionMethods(panelPath,'ReaderSelectPanel',['optionsScrollStopAction']);
  let identity = selectionId;
  let revision = 6;
  const groups = ['全部分组','未分组',...Array.from({length:12},(_,index)=>`Phase1 Scroll ${String(index+1).padStart(2,'0')}`)];
  const page = Object.assign(new Page(),{expandedLayout:false,sources:Array(12).fill({}),verificationTextMetrics:{},
    verificationGroupTextRevision:0,groupClosing:false,ownsGroupSelection:current=>current === identity,groupOptions:()=>groups,
    verificationTextLayoutScope:scope=>{assert.equal(scope,'group'); return {owner,fontScale:1,textProjectionRevision:revision};},
    getUIContext:()=>({postFrameCallback:frame=>frames.push(frame)})});
  page.prepareVerificationGroupText();
  assert.equal(page.verificationGroupTextOptions('Private Diagnostic Group',identity),undefined);
  assert.equal(page.verificationGroupTextOptions('Phase1 Scroll 01','source-group:1'),undefined);
  assert.deepEqual(page.verificationGroupTextOptions('Phase1 Scroll 01',identity),{role:'group/option-head'});
  assert.deepEqual(page.verificationGroupTextOptions('Phase1 Scroll 12',identity),{role:'group/option-tail'});
  page.scheduleVerificationGroupText(identity,'initial');
  frames.shift().read();
  assert.equal(emitted[0].payload.scope,'group-menu');
  assert.deepEqual(emitted[0].payload.labels.map(label=>label.role),['group/option-head']);

  const panel = Object.assign(new Select(),{mounted:true,generation:1,selectionId:identity,
    onOptionsScrollStop:current=>{taps.push(current); page.scheduleVerificationGroupText(current,'settled');}});
  const fromSamePanel = panel.optionsScrollStopAction();
  fromSamePanel();
  fromSamePanel();
  frames.shift().read();
  assert.equal(emitted.length,1);
  frames.shift().read();
  assert.deepEqual(emitted[1].payload.labels.map(label=>label.role),['group/option-tail']);
  fromSamePanel();
  revision += 1;
  frames.shift().read();
  assert.equal(emitted.length,2);

  panel.selectionId = identity = 'source-group:6';
  panel.generation += 1;
  fromSamePanel();
  assert.equal(taps.length,3);
  const current = panel.optionsScrollStopAction();
  current();
  panel.mounted = false;
  current();
  assert.equal(taps.length,4);
  page.verificationGroupTextMetrics = undefined;
  frames.shift().read();
  assert.equal(emitted.length,2);
});
