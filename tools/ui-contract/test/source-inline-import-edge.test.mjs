import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {requestedOperation, requireActionDispatch} from '../collectors/harmonyos/records.mjs';
import {publicAssertionDefinition} from '../lib/assertion-contract.mjs';
import {normalizeHarmonyLayout} from '../lib/layout.mjs';
import {evaluateSource} from '../lib/source.mjs';
import {
  measureSourceInlineImportEdge, readSourceInlineImportDialog,
  sourceInlineImportButton, sourceInlineImportEdgeCase, sourceInlineImportEdges, sourceInlineImportEdgeTap,
} from '../lib/source-inline-import-edge.mjs';

const definition = JSON.parse(readFileSync(new URL('../cases/' + sourceInlineImportEdgeCase + '.json',import.meta.url)));
const instanceId = 'native-source-window';
const owner = {mounting:1,generation:3};
const rect = (left,top,width,height) => ({left,top,width,height});
const events = (eventSeq,kind,payload) => ({eventSeq,kind,payload,channel:'business',instanceId});
const input = (op,from,beforeSeq,afterSeq) => ({op,from,beforeSeq,afterSeq,instanceId});
const geometry = new Map([['top',[1137,368]],['bottom',[1137,519]],['left',[1061,444]],['right',[1212,444]],['center',[1137,444]]]);
const projection = {
  owner,state:'rows',readFact:'current',readGeneration:2,count:18,projected:18,filterRevision:1,firstAnchor:1,
  queryLength:0,category:'all',status:'all',groupIndex:0,allGroups:true,
};

function node(path,id,type,rectPx) {
  return {path,parentPath:path.slice(0,path.lastIndexOf('/')),id,type,rectPx,visibleRectPx:{...rectPx},source:'native-tree',
    visible:true,enabled:true,opacity:1,clickable:type === 'Button'};
}

function sample(sampleId,beforeSeq,{shiftX = 0,shiftY = 0,showDialog = false} = {}) {
  const display = rect(0,0,1280+shiftX,2832);
  const nodes = [
    node('0',null,'root',display),
    {...node('0/0','reader-source-content','Column',rect(0,137,display.width,2480)),enabled:!showDialog},
    node('0/0/0','reader-source-list','List',rect(0,326,display.width,2200)),
    node('0/0/0/0','reader-source-search','Row',rect(67,367,1147+shiftX,154+shiftY*2)),
    node('0/0/0/0/0',null,'Stack',rect(1060+shiftX,367+shiftY,154,154)),
    node('0/0/0/0/0/0','source-back:1:import:header','Button',rect(1067+shiftX,374+shiftY,140,140)),
  ];
  if (showDialog) nodes.push(
    node('0/1','reader-json-import:8','Stack',rect(0,137,display.width,2695)),
    {...node('0/1/0',null,'Text',rect(118,840,862,84)),sourceInlineImportDialogTitle:true},
    node('0/1/1','reader-json-import:8:local','Button',rect(118,1205,1044+shiftX,154)),
  );
  return {sampleId,instanceId,beforeSeq,afterSeq:beforeSeq+2,nodes,captureComplete:true,sourceInlineImportDialogObserved:true,
    evidenceRefs:[{path:'raw/' + sampleId + '.png'},{path:'raw/' + sampleId + '.json'}],
    window:{id:'72',source:'window-metrics',density:3.5,visibleRectPx:display,keyboard:{visible:false}}};
}

test('Source inline import measures four outside-paint points inside the native centered response',()=>{
  for (const edge of sourceInlineImportEdges) {
    const [x,y] = geometry.get(edge);
    const baseline = sample('source-ready',20);
    const step = definition.steps.find(item=>item.target === sourceInlineImportButton && item.tapEdge === edge);
    const read = sourceInlineImportEdgeTap(baseline,sourceInlineImportButton,edge);
    assert.deepEqual(read.point,{x,y});
    assert.deepEqual(read.painted,rect(1067,374,140,140));
    assert.deepEqual(read.declared,rect(1060,367,154,154));
    assert.deepEqual(measureSourceInlineImportEdge(sample('narrow',20,{shiftX:-160}),edge).actual.point,{x:x-160,y});
    assert.deepEqual(measureSourceInlineImportEdge(sample('large-font',20,{shiftY:11}),edge).actual.point,{x,y:y+11});
    const operation = requestedOperation(step,{[step.from]:baseline},definition.fixture);
    const command = {event:'command',seq:1,ok:true,args:['shell','uitest','uiInput','click',String(x),String(y)]};
    assert.equal(requireActionDispatch([command],1,operation),command);
    command.args[4] = String(x+1);
    assert.throws(()=>requireActionDispatch([command],1,operation),/Unexpected command/u);
  }
  const clipped = sample('source-ready',20);
  clipped.nodes.at(-2).visibleRectPx.width = 150;
  assert.equal(measureSourceInlineImportEdge(clipped,'right').verdict,'FAIL');
  const footer = sample('source-ready',20);
  footer.nodes.at(-1).id = 'source-back:1:import:footer';
  assert.equal(measureSourceInlineImportEdge(footer,'left').verdict,'NOT_RUN');
  const existing = sample('source-ready',20,{showDialog:true});
  assert.throws(()=>sourceInlineImportEdgeTap(existing,sourceInlineImportButton,'top'),/without an existing/u);
});

test('Source inline import center uses the actual current button and exact journal within the strict integer lane',()=>{
  const step = definition.steps.find(item=>item.id === 'tap-inline-import-center');
  const baseline = sample(step.from,20);
  const measurements = {[step.from]:baseline};
  const operation = requestedOperation(step,measurements,definition.fixture);
  assert.deepEqual(operation,{op:'click',x:1137,y:444});
  const command = {event:'command',seq:1,ok:true,args:['shell','uitest','uiInput','click','1137','444']};
  assert.equal(requireActionDispatch([command],1,operation),command);
  assert.throws(()=>requireActionDispatch([{...command,args:command.args.with(5,'445')}],1,operation),/Unexpected command/u);
  assert.throws(()=>requestedOperation(step,measurements,{id:'unrelated'}),/exact public/u);
  assert.throws(()=>requestedOperation({...step,gesture:true},measurements,definition.fixture),/exact public/u);

  const lane = baseline.nodes.at(-2);
  const paint = baseline.nodes.at(-1);
  baseline.window.density = 3.43;
  lane.rectPx = lane.visibleRectPx = rect(1060,367,151,151);
  paint.rectPx = paint.visibleRectPx = rect(1067,374,137,137);
  const measured = measureSourceInlineImportEdge(baseline,'right');
  assert.equal(measured.verdict,'PASS');
  assert.ok(measured.actual.declared.width % 1 > 0);
  assert.deepEqual(measured.actual.bounds,rect(1060,367,151,151));
  assert.deepEqual(measured.actual.point,{x:1209,y:442});
  lane.visibleRectPx = rect(1060,367,150,151);
  assert.equal(measureSourceInlineImportEdge(baseline,'right').verdict,'FAIL');
  assert.throws(()=>requestedOperation(step,measurements,definition.fixture),/clipped/u);
});

test('Source inline import dialog binds the exact title and local control in the same native scope',()=>{
  const active = sample('inline-import-dialog-top',36,{showDialog:true});
  assert.equal(readSourceInlineImportDialog(active).actual.state,'present');
  assert.equal(readSourceInlineImportDialog(sample('ready',20)).actual.state,'absent');
  delete active.nodes.at(-2).sourceInlineImportDialogTitle;
  assert.equal(readSourceInlineImportDialog(active).verdict,'FAIL');
  active.nodes.at(-2).sourceInlineImportDialogTitle = true;
  active.nodes.at(-1).id = 'reader-json-import:9:local';
  assert.equal(readSourceInlineImportDialog(active).verdict,'FAIL');
  active.sourceInlineImportDialogObserved = false;
  assert.equal(readSourceInlineImportDialog(active).verdict,'NOT_RUN');
});

function rawDialog(title,observe) {
  const windowId = '72';
  const screen = '[0,0][1280,2832]';
  const raw = (type,id,bounds,children = [],extra = {}) => ({
    attributes:{type,id,bounds,origBounds:bounds,hostWindowId:windowId,visible:'true',enabled:'true',opacity:'1',...extra},
    children,
  });
  const modal = raw('Stack','reader-json-import:8','[0,137][1280,2832]',[
    raw('Text','','[118,840][980,924]',[],{originalText:title}),
    raw('Button','reader-json-import:8:local','[118,1205][1162,1359]',[],{clickable:'true'}),
  ]);
  const root = raw('root','',screen,[modal],{bundleName:'io.reader.minliny',pagePath:'pages/Index',abilityName:'EntryAbility'});
  const display = {left:0,top:0,width:1280/3.5,height:2832/3.5};
  const report = {windowId,vpPixels:3.5,metrics:{ready:true,revision:1,densityPixels:3.5,windowRect:display,globalRect:display}};
  return {...normalizeHarmonyLayout({tree:{attributes:{bounds:screen},children:[root]},report,
    observeSourceInlineImportDialog:observe}),captureComplete:true};
}

test('Source inline import stores only a scoped raw title match for native dialog recognition',()=>{
  const expected = rawDialog('导入书源',true);
  assert.equal(expected.nodes.filter(node=>node.sourceInlineImportDialogTitle === true).length,1);
  assert.equal(JSON.stringify(expected).includes('导入书源'),false);
  assert.equal(readSourceInlineImportDialog(expected).verdict,'PASS');
  const wrong = rawDialog('导入规则包',true);
  assert.equal(readSourceInlineImportDialog(wrong).verdict,'FAIL');
  assert.equal(readSourceInlineImportDialog(rawDialog('导入书源',false)).verdict,'NOT_RUN');
});

function proof(edge) {
  const assertionId = edge === 'center' ? 'source.import.center-touch' : 'source.import.'+edge+'-touch-edge';
  const assertion = definition.assertions.find(item=>item.id === assertionId);
  publicAssertionDefinition(assertion);
  const start = sample(assertion.baseline,20);
  const opened = sample(assertion.dialogSample,36,{showDialog:true});
  const returned = sample(assertion.sample,50);
  const [x,y] = geometry.get(edge);
  const context = {
    samples:{[assertion.baseline]:start,[assertion.dialogSample]:opened,[assertion.sample]:returned},
    actions:{
      'open-sources':{...input('click','settings',7,13),targetId:'reader-settings-source-management'},
      [assertion.action]:{...input('click',start.sampleId,24,32),targetId:sourceInlineImportButton,
        ...(edge === 'center' ? {inlineImportTap:{x,y,probeSeq:21}} : {edgeTap:{edge,x,y,probeSeq:21}})},
      [assertion.returnAction]:{...input('keyEvent',opened.sampleId,40,44),key:'Back'},
    },
    events:[events(9,'source.route',{action:'open',from:'settings',to:'source',...owner,previousGeneration:2}),
      events(17,'source.projection',projection)],
  };
  const result = () => evaluateSource({...assertion,acceptedSources:assertion.sources},context);
  return {assertion,context,result,verdict:()=>result().verdict};
}

test('Source inline import needs one real modal and first Back within the unchanged Source opening',()=>{
  for (const edge of sourceInlineImportEdges) {
    const {assertion,context,verdict} = proof(edge);
    assert.equal(verdict(),'PASS');
    Object.assign(context.actions[assertion.action].edgeTap,{x:1137,y:444});
    assert.equal(verdict(),'FAIL');
  }
  for (const change of [
    (context,a)=>{ context.samples[a.dialogSample] = sample(a.dialogSample,36); },
    (context,a)=>{ context.samples[a.sample] = sample(a.sample,50,{showDialog:true}); },
    (context,a)=>{ context.samples[a.sample].nodes.at(-1).id = 'source-back:2:import:header'; },
    context=>{ context.events.push(events(27,'source.route',{action:'close',from:'source',to:'settings'})); },
    context=>{ context.events.push(events(42,'source.projection',{...projection,filterRevision:2})); },
  ]) {
    const {assertion,context,verdict} = proof('left');
    change(context,assertion);
    assert.equal(verdict(),'FAIL');
  }
  const noCapture = proof('bottom');
  noCapture.context.samples[noCapture.assertion.dialogSample].captureComplete = false;
  assert.equal(noCapture.verdict(),'NOT_RUN');
});

test('Source inline import exposes admission bounds and accepted center and edges only with complete real endpoints',()=>{
  const native = {subject:'search-import',target:sourceInlineImportButton,carrierPath:'0/0/0/0/0/0',
    bounds:rect(1060,367,154,154),painted:rect(1067,374,140,140),visible:true,clipped:false,enabled:true};
  for (const position of [...sourceInlineImportEdges,'center']) {
    const {assertion,context,result} = proof(position);
    const [x,y] = geometry.get(position);
    const accepted = result();
    assert.equal(accepted.verdict,'PASS',accepted.reason);
    assert.equal(accepted.actual.sampleId,assertion.sample);
    assert.deepEqual(accepted.actual.nativeInteraction,{...native,position,accepted:true,actionId:assertion.action,
      baselineSampleId:assertion.baseline,dispatch:{x,y,probeSeq:21}});
    const lane = context.samples[assertion.baseline].nodes.at(-2);
    lane.visibleRectPx = {...lane.rectPx,width:lane.rectPx.width-1};
    const clipped = result();
    assert.equal(clipped.verdict,'FAIL');
    assert.equal(clipped.actual.nativeInteraction,undefined);
  }
  const {assertion,context,result} = proof('center');
  context.samples[assertion.dialogSample] = sample(assertion.dialogSample,36);
  const failed = result();
  assert.equal(failed.verdict,'FAIL');
  assert.equal(failed.actual.nativeInteraction,undefined);

  const area = definition.assertions.find(item=>item.id === 'source.import.target-area');
  publicAssertionDefinition(area);
  const initial = proof('top').context;
  delete initial.actions['tap-inline-import-top'];
  const measured = evaluateSource({...area,acceptedSources:area.sources},initial);
  assert.equal(measured.verdict,'PASS',measured.reason);
  assert.equal(measured.actual.sampleId,area.sample);
  assert.deepEqual(measured.actual.nativeInteraction,native);
});
