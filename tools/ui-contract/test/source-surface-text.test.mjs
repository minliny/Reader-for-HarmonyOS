import assert from 'node:assert/strict';
import { test } from 'node:test';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { evaluateSource } from '../lib/source.mjs';

const refs = [{path:'raw/source.png'},{path:'raw/source.json'}];
const rect = {left:0,top:0,width:100,height:40};
const owner = {generation:8,mounting:2};
const opening = {action:'open',from:'settings',to:'source',previousGeneration:7,...owner};

function glyph(role) {
  return {role,utf16Length:4,startUtf16:0,endUtf16:4,complete:true,
    lines:[{start:0,end:4,leftPx:0,topPx:1,widthPx:80,heightPx:35,baselinePx:24}],
    rangeRects:[{leftPx:2,topPx:2,rightPx:79,bottomPx:33}],
    tailRects:[{leftPx:58,topPx:2,rightPx:79,bottomPx:33}]};
}

function fixture(scope) {
  const failure = scope === 'read-failed';
  const importing = scope === 'operation-status';
  const event = (kind,eventSeq,payload) => ({kind,eventSeq,payload,channel:'business',instanceId:'source',windowRevision:4,evidenceRefs:refs});
  const shape = (id,path,type) => ({id,path,type,source:'native-tree',rectPx:{...rect},visibleRectPx:{...rect},visible:true,opacity:1});
  const state = {owner,readGeneration:3,filterRevision:5,textProjectionRevision:7,
    state:importing ? 'rows' : failure ? 'readFailure' : 'empty',
    readFact:failure ? 'failed' : 'current',count:importing ? 1 : 0,projected:importing ? 1 : 0};
  const status = {owner,phase:'ready',confirmation:'confirmed',readback:'succeeded',confirmedParts:1,
    fixturePresent:true,count:1,receiptGeneration:12,statusRevision:4};
  const data = {scope,owner,readGeneration:3,filterRevision:5,textProjectionRevision:7,windowRevision:4,
    density:2,widthVp:320,heightVp:650,systemFontScale:1.3,fontScale:1.3};
  const nodes = importing ? [
    shape('reader-source-filter-block','0/0','Column'),
    shape('reader-source-status-action','0/0/0','Button'),
    shape(null,'0/0/0/0','Text'),
  ] : [
    shape('reader-source-empty-state','0/0','ListItem'),
    shape('reader-source-text-read-title','0/0/0','Text'),
    shape('reader-source-text-read-message','0/0/1','Text'),
    ...(failure ? [shape('reader-source-read-retry','0/0/2','Button'),shape(null,'0/0/2/0','Text')] : [
      shape('reader-source-footer','0/1','Column'),
      shape('reader-source-text-footer-add','0/1/0','Button'),
      shape(null,'0/1/0/0','Text'),
    ]),
  ];
  const names = importing ? ['operation/action'] : failure ?
    ['read/failure-title','read/failure-message','read/retry'] : ['read/empty-title','read/empty-message','footer/add'];
  data.labels = names.map(glyph);
  if (importing) Object.assign(data,{branch:'import',generation:12,statusRevision:4});
  const context = {
    actions:{open:{op:'click',targetId:importing ? 'reader-source-picker-file' : 'reader-settings-source-management',
      instanceId:'source',beforeSeq:10,afterSeq:15,outcomeSettled:true,evidenceRefs:refs}},
    samples:{ready:{instanceId:'source',captureComplete:true,beforeSeq:20,afterSeq:22,nodes,evidenceRefs:refs,
      window:{source:'window-metrics',revision:4,density:2,fontScale:1.3,keyboard:{visible:false,revision:4},
        rectPx:{left:0,top:0,width:640,height:1300},visibleRectPx:{left:0,top:0,width:640,height:1300},
        nativeFont:{followsSystemFontScale:true,effectiveScale:1.3,vpPixels:2,fpPixels:2.6,maxFontScale:2}}}},
    events:[...(importing ? [] : [event('source.route',11,opening)]),event('source.projection',13,state),
      ...(importing ? [event('source.import-status-action',14,status)] : []),event('source.surface-text-layout',17,data)],
  };
  const assertion = {id:'source.text',evaluator:'source',action:'open',sample:'ready',kind:'surface-text',
    acceptedSources:['native-tree','app-owner','window-metrics'],
    expected:failure ? {scope,conditionAssertion:'source.read'} : {scope},
    ...(failure ? {condition:'An actual read fails',required:false} : {required:true})};
  return {context,assertion,data,status,nodes,check:()=>evaluateSource(assertion,context)};
}

test('source surface text measures exact empty-state glyphs and separates clipping from stale evidence',()=>{
  const {context,check,data,nodes} = fixture('read-empty');
  const positive = check();
  assert.equal(positive.verdict,'PASS',positive.reason);
  assert.equal(positive.actual.sampleId,'ready');
  assert.deepEqual(Object.keys(positive.actual.roles),['read/empty-title','read/empty-message','footer/add']);
  nodes[2].visibleRectPx.width = 60;
  assert.equal(check().verdict,'FAIL');
  nodes[2].visibleRectPx.width = 100;
  nodes[2].id = 'outside-obligations';
  assert.equal(check().verdict,'FAIL','A known missing text in a complete correct state is a product failure');
  data.textProjectionRevision -= 1;
  assert.equal(check().verdict,'NOT_RUN','Stale glyph evidence cannot support a failure or a pass');
  data.textProjectionRevision += 1;
  context.samples.ready.window.nativeFont.followsSystemFontScale = false;
  assert.equal(check().verdict,'NOT_RUN');
});

for (const [scope, titleId] of [
  ['read-empty', 'reader-source-text-read-title'],
  ['read-failed', 'reader-source-read-failure-title'],
]) test(`source surface text checks ${scope} title ascent and descent against observed native clipping`,()=>{
  const {context,check,data,nodes} = fixture(scope);
  const [host,title,message] = nodes;
  const sample = context.samples.ready;
  sample.clipShapes = [];
  const layoutRect = {left:136,top:1278,width:1008,height:84};
  sample.window.rectPx = {left:0,top:0,width:1280,height:2832};
  sample.window.visibleRectPx = {...sample.window.rectPx};
  data.widthVp = 640;
  data.heightVp = 1416;
  const nativeParent = {source:'native-tree',visible:true,opacity:1,clip:false,
    rectPx:{...sample.window.rectPx},visibleRectPx:{...sample.window.visibleRectPx}};
  const root = {...nativeParent,path:'0',parentPath:null,type:'root'};
  const list = {...nativeParent,path:'0/0',parentPath:'0',type:'List',id:'reader-source-list',clip:true,
    visibleRectPx:{left:0,top:137,width:1280,height:2695}};
  Object.assign(host,{path:'0/0/0',parentPath:list.path,clip:false,
    rectPx:{left:66,top:1194,width:1148,height:368},visibleRectPx:{left:66,top:1194,width:1148,height:368}});
  Object.assign(title,{id:titleId,path:'0/0/0/0',parentPath:host.path,clip:false,
    rectPx:{...layoutRect},visibleRectPx:{...layoutRect}});
  Object.assign(message,{path:'0/0/0/1',parentPath:host.path});
  if (scope === 'read-failed') {
    const [, , , button, buttonText] = nodes;
    const retryRect = {left:590,top:1470,width:100,height:40};
    Object.assign(button,{path:'0/0/0/2',parentPath:host.path,rectPx:retryRect,visibleRectPx:retryRect});
    Object.assign(buttonText,{path:'0/0/0/2/0',parentPath:button.path,rectPx:retryRect,visibleRectPx:retryRect});
  }
  nodes.push(root,list);

  // Actual title layout and TIGHT range values from the sealed 40bb64467bd4 native capture.
  const [label] = data.labels;
  label.lines = [{start:0,end:4,leftPx:385.0000305175781,topPx:0,widthPx:237.99993896484375,heightPx:84,
    baselinePx:67.29281616210938}];
  label.rangeRects = [{leftPx:385.0000305175781,topPx:-1.7271804809570313,rightPx:623,bottomPx:84.42881774902344}];
  label.tailRects = [{leftPx:563.5,topPx:-1.7271804809570313,rightPx:623,bottomPx:84.42881774902344}];

  const positive = check();
  assert.equal(positive.verdict,'PASS',positive.reason);
  assert.deepEqual(positive.actual.roles[label.role].actual.clipAncestors.map(({path,clip})=>[path,clip]),
    [[host.path,false],[list.path,true],[root.path,false]]);

  title.clip = true;
  assert.equal(check().verdict,'FAIL','An explicitly clipped Text still uses its own bounds');
  title.clip = false;
  list.visibleRectPx = {left:0,top:1278,width:1280,height:1554};
  assert.equal(check().verdict,'FAIL','A clipping ancestor can cut the range even with a full Text visible box');
  list.visibleRectPx = {left:0,top:137,width:1280,height:2695};
  title.visibleRectPx = {...layoutRect,top:1300,height:62};
  assert.equal(check().verdict,'FAIL','A visibly cropped Text does not use the ancestor-only comparison');
  title.visibleRectPx = {...layoutRect};
  label.rangeRects[0].leftPx = -2;
  assert.equal(check().verdict,'FAIL','Horizontal layout containment remains mandatory');
  label.rangeRects[0].leftPx = 385.0000305175781;
  host.clip = undefined;
  assert.equal(check().verdict,'FAIL','An ancestor with unknown clipping cannot justify the alternative');
  host.clip = false;
  title.parentPath = root.path;
  assert.equal(check().verdict,'FAIL','A non-adjacent parent cannot stand in for the complete native chain');
});

test('source surface text preserves read failure applicability when the actual glyph sample is missed',()=>{
  const {context,assertion,check,nodes} = fixture('read-failed');
  assert.equal(check().verdict,'PASS');
  nodes.find(node => node.id === 'reader-source-text-read-title').id = 'reader-source-read-failure-title';
  assert.equal(check().verdict,'PASS');
  context.events.pop();
  const lost = check();
  assert.equal(lost.verdict,'NOT_RUN');
  const state = {...assertion,id:'source.read',kind:'read-surface',expected:{state:'readFailure'}};
  const measured = evaluateSource(state,context);
  assert.equal(measured.verdict,'PASS');
  assert.equal(measured.actual.readFact,'failed');
  const independent = conditionApplicability(state,context,measured,{});
  const condition = conditionApplicability(assertion,context,lost,{},undefined,{[state.id]:independent});
  assert.equal(condition.status,'APPLIES');
  assert.equal(condition.required,true);
  assert.equal(condition.sampleApplies,true);
});

test('source surface text admits the actual confirmed import action glyph on the same status revision',()=>{
  const {check,data,status,nodes} = fixture('operation-status');
  assert.equal(check().verdict,'PASS');
  data.statusRevision += 1;
  assert.equal(check().verdict,'NOT_RUN');
  data.statusRevision -= 1;
  status.fixturePresent = false;
  assert.equal(check().verdict,'NOT_RUN');
  status.fixturePresent = true;
  nodes[2].path = '0/1/0';
  assert.equal(check().verdict,'FAIL');
});
