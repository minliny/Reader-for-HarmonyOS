import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {requestedOperation,requireActionDispatch} from '../collectors/harmonyos/records.mjs';
import {publicAssertionDefinition} from '../lib/assertion-contract.mjs';
import {normalizeHarmonyLayout,selectLayoutNode} from '../lib/layout.mjs';
import {evaluateSource} from '../lib/source.mjs';
import {evaluateSourceOfflineDetect,requireSourceOfflineDetectState,sourceOfflineDetectButton,
  sourceOfflineDetectCase,sourceOfflineDetectFailed,sourceOfflineDetectFixturePath,sourceOfflineDetectReady,
  sourceOfflineDetectObservation} from '../lib/source-offline-detect.mjs';

const instanceId = 'native-public-source';
const owner = {mounting:1,generation:3};
const bound = {owner,anchor:5,readGeneration:7,definition:'missing-search-url',reportVersion:2};
const projection = {owner,state:'rows',readFact:'current',readGeneration:7,count:1,projected:1,firstAnchor:5,
  status:'all',category:'all',queryLength:0,allGroups:true,groupIndex:0};
const definition = JSON.parse(readFileSync(new URL('../cases/' + sourceOfflineDetectCase + '.json',import.meta.url),'utf8'));
const assertion = definition.assertions.find(item=>item.kind === 'source-offline-detect');
const step = definition.steps.find(item=>item.id === assertion.action);
const rect = (left,top,width,height) => ({left,top,width,height});
const record = (eventSeq,kind,payload) => ({eventSeq,kind,payload,instanceId,channel:'business'});

test('Offline Source Detect aliases the native Button only from its exact normal fixture row',()=>{
  const [fixture] = JSON.parse(readFileSync(new URL('../' + sourceOfflineDetectFixturePath,import.meta.url),'utf8'));
  const screen = '[0,0][1280,2832]';
  const raw = (type,id,bounds,children = [],attributes = {}) => ({
    attributes:{type,id,bounds,origBounds:bounds,hostWindowId:'72',visible:'true',enabled:'true',opacity:'1',...attributes},
    children,
  });
  const rowBox = '[67,888][1214,1308]';
  const row = raw('Column','reader-source-row-5',rowBox,[
    raw('Text','','[80,900][750,970]',[],{originalText:fixture.bookSourceName}),
    raw('Text','','[80,990][750,1060]',[],{originalText:fixture.bookSourceUrl}),
    raw('Button','','[954,1100][1108,1254]',[
      raw('Text','','[984,1120][1098,1222]',[],{originalText:'检测'}),
    ],{clickable:'true'}),
    raw('__Common__',sourceOfflineDetectReady,'[774,1100][858,1163]'),
  ]);
  const root = raw('root','',screen,[raw('List','reader-source-list',screen,[row])],
    {bundleName:'io.reader.minliny',pagePath:'pages/Index',abilityName:'EntryAbility'});
  const windowRect = {left:0,top:0,width:1280/3.5,height:2832/3.5};
  const report = {windowId:'72',vpPixels:3.5,metrics:{ready:true,revision:1,densityPixels:3.5,
    windowRect,globalRect:windowRect}};
  const normalize = observeSourceOfflineDetect => normalizeHarmonyLayout({tree:{attributes:{bounds:screen},children:[root]},
    report,observeSourceOfflineDetect});
  const sample = normalize(true);
  assert.equal(selectLayoutNode(sample,sourceOfflineDetectButton).type,'Button');
  assert.ok(selectLayoutNode(sample,sourceOfflineDetectReady));
  assert.equal(JSON.stringify(sample).includes(fixture.bookSourceUrl),false);
  assert.throws(()=>selectLayoutNode(normalize(false),sourceOfflineDetectButton),/missing/u);
  row.children[1].attributes.originalText = 'https://unrelated.invalid/';
  assert.throws(()=>selectLayoutNode(normalize(true),sourceOfflineDetectButton),/missing/u);
});

function node(path,id,type,rectPx,alias) {
  return {path,parentPath:path.slice(0,path.lastIndexOf('/')),id,type,rectPx,visibleRectPx:{...rectPx},alias,
    visible:true,opacity:1,source:'native-tree',enabled:true,clickable:type === 'Button'};
}

function sample(sampleId,beforeSeq,badge) {
  const viewport = rect(0,0,1280,2832);
  return {sampleId,instanceId,beforeSeq,afterSeq:beforeSeq+2,captureComplete:true,
    evidenceRefs:[{path:'raw/' + sampleId + '.json'},{path:'raw/' + sampleId + '.png'}],
    window:{id:'72',revision:3,source:'window-metrics',density:3.5,keyboard:{visible:false},visibleRectPx:viewport},
    nodes:[
      node('0',null,'root',viewport),
      node('0/0','reader-source-list','List',rect(0,130,1280,2460)),
      node('0/0/0','reader-source-row-5','Column',rect(67,888,1147,420)),
      node('0/0/0/0',null,'Button',rect(954,1100,154,154),sourceOfflineDetectButton),
      node('0/0/0/1',null,'Text',rect(774,1100,154,70),badge),
    ],
  };
}

function fixture() {
  return {
    samples:{
      [assertion.baseline]:sample(assertion.baseline,20,sourceOfflineDetectReady),
      [assertion.sample]:sample(assertion.sample,42,sourceOfflineDetectFailed),
    },
    actions:{
      'open-sources':{instanceId,op:'click',targetId:'reader-settings-source-management',beforeSeq:5,afterSeq:10},
      'detect-source':{instanceId,op:'click',from:assertion.baseline,targetId:sourceOfflineDetectButton,beforeSeq:25,afterSeq:30,
        detectTap:{x:1031,y:1177,probeSeq:8}},
    },
    events:[
      record(7,'source.route',{action:'open',from:'settings',to:'source',...owner,previousGeneration:2}),
      record(16,'source.projection',projection),
      record(17,sourceOfflineDetectObservation,{...bound,phase:'ready'}),
      record(27,sourceOfflineDetectObservation,{...bound,phase:'admitted',sequence:1}),
      record(32,sourceOfflineDetectObservation,{...bound,phase:'settled',sequence:1,mode:'search',available:false,
        requestedLevels:['L1','L2'],levelsPassed:['L1'],l1:'pass',l2:'fail',l1Executed:true,l2Executed:true,
        reason:'missing-search-url',hostEvidenceCount:0}),
    ],
  };
}

test('Offline Source Detect verifies the current raw definition, unique dispatch and same-row Core result',()=>{
  const normal = fixture();
  const baseline = normal.samples[assertion.baseline];
  assert.doesNotThrow(()=>requireSourceOfflineDetectState(step,baseline,{eventSeq:25},normal.events));
  assert.throws(()=>requireSourceOfflineDetectState(step,baseline,{eventSeq:33},normal.events),/provider-free/u);
  publicAssertionDefinition(assertion);
  const outcome = evaluateSourceOfflineDetect(assertion,normal);
  assert.equal(outcome.verdict,'PASS');
  assert.equal(outcome.actual.nativeInteraction.subject,'row-detect');
  assert.equal(outcome.actual.nativeInteraction.position,'center');
  assert.equal(outcome.actual.nativeInteraction.dispatch.probeSeq,8);
  assert.equal(evaluateSource({...assertion,acceptedSources:assertion.sources},normal).verdict,'PASS');
  const operation = requestedOperation(step,normal.samples,definition.fixture);
  const command = {event:'command',seq:1,ok:true,args:['shell','uitest','uiInput','click','1031','1177']};
  assert.equal(requireActionDispatch([command],1,operation),command);
  command.args[5] = '1178';
  assert.throws(()=>requireActionDispatch([command],1,operation),/Unexpected command/u);

  for (const change of [
    context=>{ context.events[4].payload.hostEvidenceCount = 1; },
    context=>{ context.events[4].payload.reason = 'network'; },
    context=>{ context.events[4].payload.owner = {mounting:1,generation:4}; },
    context=>{ context.events[4].payload.l2Executed = false; },
    context=>{ context.events.splice(4,0,record(29,sourceOfflineDetectObservation,{...bound,phase:'admitted',sequence:2})); },
    context=>{ context.samples[assertion.sample].nodes.at(-1).alias = sourceOfflineDetectReady; },
  ]) {
    const context = fixture();
    change(context);
    const rejected = evaluateSourceOfflineDetect(assertion,context);
    assert.equal(rejected.verdict,'FAIL');
    assert.equal(rejected.actual?.nativeInteraction,undefined);
  }

  const missing = fixture();
  missing.events.pop();
  assert.equal(evaluateSourceOfflineDetect(assertion,missing).verdict,'NOT_RUN');
  missing.events.pop();
  missing.samples[assertion.sample].nodes.at(-1).alias = sourceOfflineDetectReady;
  assert.equal(evaluateSourceOfflineDetect(assertion,missing).verdict,'FAIL');
});

test('Offline Source Detect upper edge admits only the exact provider-free click and accepted same-row terminal',()=>{
  const edge = JSON.parse(readFileSync(new URL('../cases/source-management.row-detect-offline-edge.json',import.meta.url)));
  const proof = edge.assertions.find(item=>item.id === 'source.row.detect.offline-top');
  const touch = edge.steps.find(item=>item.id === proof.action);
  const context = fixture();
  const action = context.actions['detect-source'];
  delete context.actions['detect-source'];
  context.actions[proof.action] = action;
  const operation = requestedOperation(touch,context.samples,edge.fixture);
  assert.deepEqual(operation,{op:'click',x:1031,y:1101});
  action.detectTap = {x:operation.x,y:operation.y,probeSeq:8};
  const accepted = evaluateSourceOfflineDetect(proof,context);
  assert.equal(accepted.verdict,'PASS',accepted.reason);
  assert.equal(accepted.actual.nativeInteraction.position,'top');
  assert.equal(accepted.actual.nativeInteraction.subject,'row-detect');
  action.detectTap.y = 1177;
  const wrongPosition = evaluateSourceOfflineDetect(proof,context);
  assert.equal(wrongPosition.verdict,'FAIL');
  assert.equal(wrongPosition.actual.nativeInteraction,undefined);
  const button = context.samples[proof.baseline].nodes.find(node=>node.alias === sourceOfflineDetectButton);
  button.visibleRectPx = {...button.visibleRectPx,top:1101,height:153};
  assert.throws(()=>requestedOperation(touch,context.samples,edge.fixture),/clipped/u);
});

test('Offline Source Detect production owner observes one admitted check and validates the Core report',async ()=>{
  const probe = await import('../../lib/source-management-owner-probe.mjs');
  const verification = await import('../../../entry/src/main/ets/features/source/ui/SourceManagementVerification.ts');
  const [bookSource] = JSON.parse(readFileSync(new URL('../' + sourceOfflineDetectFixturePath,import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(bookSource).sort(),
    ['bookSourceGroup','bookSourceName','bookSourceType','bookSourceUrl','enabled','enabledExplore']);
  const sourceId = bookSource.bookSourceUrl;
  const sourceVersion = '2'.repeat(64);
  const raw = { sourceId, sourceVersion, name:bookSource.bookSourceName, baseUrl:sourceId,
    enabled:false, enabledExplore:false, bookSource };
  const message = verification.OFFLINE_DETECT_CORE_REASON;
  const traceId = 'source.check.run:5:1';
  const coreResult = {
    requestId:5,data:{traceId,results:[{
      sourceId,available:false,levelsPassed:['L1'],durationMs:1,failureReason:message,
      debugLogs:[{state:-1,msg:message,timestampMs:1,step:'search',errorKind:'request'}],
      report:{version:1,mode:'search',traceId,ruleDigest:sourceVersion,inputDigest:'1'.repeat(64),steps:[
        {level:'L1',requested:true,executed:true,status:'pass',durationMs:0},
        {level:'L2',requested:true,executed:true,status:'fail',durationMs:1,reason:'request'},
        ...['L3','L4','L5'].map(level=>({level,requested:false,executed:false,status:'not_requested',durationMs:0})),
      ]},
    }]},
  };
  const calls = [];
  const runtime = {
    supportsCoreCapability:capability=>['source.check.mode.v1','source.check.report.v1'].includes(capability),
    takeSourceHttpDiagnostics:()=>[],
    async request(method,params) {
      calls.push({method,params});
      if (method === 'source.list') return {data:{sources:[raw]}};
      assert.equal(method,'source.check.run');
      assert.equal(params.mode,'search');
      assert.deepEqual(params.sourceIds,[sourceId]);
      assert.deepEqual(params.levels,['L1','L2']);
      assert.equal(params.reportVersion,1);
      return coreResult;
    },
  };
  const observations = [];
  const errors = [];
  const {SourceHost} = probe.actualSourceManagementTypes({...verification,
    ReaderRuntimeOwner:{isCurrent:owner=>owner === runtime},
    ReaderUIVerificationProbe:{enabled:()=>true,emit:(kind,_channel,payload)=>observations.push({kind,payload})},
    hilog:{info(){},warn(){},error(...args){errors.push(args);}},
  });
  let sources;
  const host = new SourceHost(value=>{sources = value;},()=>{},()=>{});
  const identity = JSON.stringify([0,owner.mounting,owner.generation,'source']);
  assert.equal(host.bindPresentation(runtime,identity,()=>true),true);
  host.open(identity);
  await host.orchestrator.operationChain;
  assert.equal(sources[0].offlineDetectReportVersion,1);
  assert.equal(sources[0].checkState,'unchecked');
  host.checkSource(sourceId,identity);
  host.checkSource(sourceId,identity);
  await host.orchestrator.operationChain;
  const observed = observations.filter(item=>item.kind === sourceOfflineDetectObservation).map(item=>item.payload);
  assert.deepEqual(observed.map(item=>item.phase),['admitted','settled']);
  assert.equal(observed[0].sequence,observed[1].sequence);
  assert.deepEqual(observed[1].owner,owner);
  assert.equal(observed[1].anchor,verification.SourceVerificationAnchors.identify(sourceId));
  assert.equal(observed[1].reason,'missing-search-url');
  assert.equal(observed[1].hostEvidenceCount,0);
  assert.equal(observed[1].l2,'fail');
  assert.equal(sources[0].checkState,'failed');
  assert.equal(calls.filter(item=>item.method === 'source.check.run').length,1);
  assert.deepEqual(errors,[]);
});
