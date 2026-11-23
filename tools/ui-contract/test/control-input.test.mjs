import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clickThenBackArgs, clickThenReaderCenterArgs } from '../lib/control-input.mjs';
import { loadCase } from '../lib/cases.mjs';
import { actionArgs, requestedOperation, requireActionDispatch } from '../collectors/harmonyos/records.mjs';
import { collectReversalAction } from '../collectors/harmonyos/run.mjs';
import { prepareReversalDispatch, reversalCommandArgs, reversalReadbackTiming,
  verifyReversalRunnerOutput } from '../collectors/harmonyos/reversal-dispatch.mjs';
import { READER_SIGNER } from '../collectors/harmonyos/pointer-matrix-runner/entry/src/ohosTest/ets/testrunner/ReversalPlan.ts';

const op = { op:'clickThenBack', x:641, y:1636 };
function pair() {
  const [click, back] = clickThenBackArgs(op);
  const common = { status:0, error:null, signal:null, stdout:'', stderr:'' };
  return {
    event:'click-then-back', seq:1, ok:true, reason:null, recordedAt:'2026-11-19T07:00:00.455Z',
    click:{ ...common, args:click, startedAt:'2026-11-19T07:00:00.000Z', hostStartMs:200, elapsedMs:224 },
    back:{ ...common, args:back, startedAt:'2026-11-19T07:00:00.225Z', hostStartMs:425, elapsedMs:229 },
  };
}

test('compound action verifies both fixed normal inputs and the measured dispatch gap', () => {
  assert.deepEqual(requireActionDispatch([pair()], 1, op), { dispatchGapMs:225, probeSeq:1 });
});

test('compound action rejects changed coordinates, remote command substitutions and stale dispatch', () => {
  const wrongClick = pair();
  wrongClick.click.args[4] = '4';
  assert.throws(() => requireActionDispatch([wrongClick], 1, op), /Invalid click and normal Back/);

  const wrongKey = pair();
  wrongKey.back.args[4] = 'Home';
  assert.throws(() => requireActionDispatch([wrongKey], 1, op), /Invalid click and normal Back/);

  const tooLate = pair();
  tooLate.back.hostStartMs = 520;
  assert.throws(() => requireActionDispatch([tooLate], 1, op), /outside the Search morph host window/);
});

test('the bounded AutoPage initiation input measures the prior reader host and verifies both normal clicks', () => {
  const window = {id:'a-window',density:2};
  const bounds = {left:0,top:0,width:800,height:1800};
  const node = (id,visibleRectPx,clickable=false) => ({id,visibleRectPx,visible:true,enabled:true,opacity:1,clickable});
  const context = {instanceId:'reader',window,captureComplete:true};
  const stage = node('reader-reading-stage',bounds);
  const samples = {
    'reading-before':{...context,nodes:[stage,node('reader-reading-interaction-host-continuous',bounds)]},
    quick:{...context,nodes:[stage,node('reader-control-autopage-transport-toggle',
      {left:100,top:1400,width:40,height:40},true)]},
  };
  const step = {id:'interrupt-launch',from:'quick',op:'clickThenReaderCenter',target:'reader-control-autopage-transport-toggle'};
  const actual = requestedOperation(step,samples,{});
  assert.deepEqual(actual,{op:'clickThenReaderCenter',x:120,y:1420,centerX:400,centerY:900});
  const [launch,center] = clickThenReaderCenterArgs(actual);
  const accepted = pair();
  accepted.event = 'click-then-reader-center';
  accepted.click.args = launch;
  accepted.center = {...accepted.back,args:center,hostStartMs:850,startedAt:'2026-11-19T07:00:00.650Z'};
  accepted.recordedAt = '2026-11-19T07:00:00.950Z';
  assert.deepEqual(requireActionDispatch([accepted],1,actual),{dispatchGapMs:650,probeSeq:1});
  accepted.center.hostStartMs = 849;
  assert.throws(() => requireActionDispatch([accepted],1,actual),/outside the launch host window/);
  accepted.center.hostStartMs = 1150;
  assert.throws(() => requireActionDispatch([accepted],1,actual),/outside the launch host window/);
  accepted.center.hostStartMs = 850;
  accepted.center.args[4] = '401';
  assert.throws(() => requireActionDispatch([accepted],1,actual),/Invalid click and normal reader center/);
  samples['reading-before'].nodes[1] = node('reader-reading-interaction-host-continuous',
    {left:0,top:0,width:201,height:1800});
  assert.throws(() => requestedOperation(step,samples,{}),/outside the previously measured reading interaction host center/);
  samples['reading-before'].window = {...window,id:'old-window'};
  assert.throws(() => requestedOperation(step,samples,{}),/same native window/);
});

test('grabber crossover dispatch binds complete same-window Quick and Full geometry to one normal drag', () => {
  const contract = loadCase('reading.control-grabber-crossover');
  const step = contract.steps.find(item => item.id === 'crossover-grabber');
  const {calibrationSample} = step.path;
  const stage = {left:0,top:137,width:1280,height:2695};
  const display = {left:0,top:0,width:1280,height:2832};
  const node = (id,path,parentPath,rectPx,enabled = true) =>
    ({id,path,parentPath,rectPx,visibleRectPx:rectPx,visible:true,enabled,opacity:1});
  const nativeSample = (full,seq) => ({
    instanceId:'reading-instance',captureComplete:true,beforeSeq:seq,afterSeq:seq+2,semanticSeq:seq-1,
    window:{id:'8',revision:4,density:3.5,orientation:'portrait',keyboard:{visible:false},rectPx:display,displayRectPx:display},
    nodes:[
      {...node('reader-reading-stage','0/1','0',display),visibleRectPx:stage},
      node('reader-control-module-search','0/1/0','0/1',stage),
      node('reader-control-collapse','0/1/1','0/1',stage,full),
      node('reader-control-motion-grabber','0/1/2','0/1',{left:515,top:full?388:1587,width:252,height:98}),
    ],
  });
  const samples = {[calibrationSample]:nativeSample(false,10),[step.from]:nativeSample(true,20)};
  const originalStep = {...step,path:{calibrationSample,speed:1200}};
  const originalOperation = requestedOperation(originalStep,samples,{});
  assert.deepEqual(originalOperation,{op:'drag',fromX:641,fromY:437,toX:641,toY:1668,velocity:1200});
  const originalCommand = {event:'command',seq:1,ok:true,args:['shell','uitest','uiInput','drag','641','437','641','1668','1200']};
  assert.equal(requireActionDispatch([originalCommand],1,originalOperation),originalCommand);

  const operation = requestedOperation(step,samples,contract.fixture);
  assert.deepEqual(operation,{op:'timedCrossover',x:641,fromY:437,toY:1668});
  const args = ['shell','uinput','-T','-m','641','437','641','1668','-k','100','900'];
  const command = {event:'command',seq:1,ok:true,args,status:0,signal:null,error:null,stderr:''};
  assert.deepEqual(actionArgs(operation),args);
  assert.equal(requireActionDispatch([command],1,operation),command);
  assert.throws(() => requireActionDispatch([originalCommand],1,operation),/Unexpected command/);
  for (const [index,value] of [[6,'640'],[7,'1636'],[9,'900'],[10,'100']]) {
    const wrong = {...command,args:args.with(index,value)};
    assert.throws(() => requireActionDispatch([wrong],1,operation),/Unexpected command/);
  }
  for (const wrong of [{status:1},{signal:'SIGTERM'},{error:'failed'},{stderr:'invalid arguments'}]) {
    assert.throws(() => requireActionDispatch([{...command,...wrong}],1,operation),/did not finish cleanly/);
  }
  assert.throws(() => actionArgs({...operation,toY:437}),/bounded, downward/);
  assert.throws(() => actionArgs({...operation,x:'641'}),/bounded, downward/);
  assert.throws(() => requestedOperation({...step,target:'reader-reading-stage'},samples,contract.fixture),/exact ordinary crossover drag/);
  assert.throws(() => requestedOperation({...step,path:{...step.path,keepMs:0}},samples,contract.fixture),/timed crossover/);
  assert.throws(() => requestedOperation(step,samples,{}),/timed crossover/);

  function withSample(key, edit) {
    const modified = structuredClone(samples);
    edit(modified[key]);
    return requestedOperation(step,modified,contract.fixture);
  }
  assert.throws(() => withSample(calibrationSample, sample => { sample.captureComplete = false; }),/two complete ordered/);
  assert.throws(() => withSample(calibrationSample, sample => { sample.afterSeq = 22; }),/two complete ordered/);
  assert.throws(() => withSample(calibrationSample, sample => { sample.window.revision = 3; }),/same unchanged native window/);
  assert.throws(() => withSample(calibrationSample, sample => { sample.instanceId = 'stale'; }),/same unchanged native window/);
  assert.throws(() => withSample(step.from, sample => { sample.window.keyboard.visible = true; }),/same unchanged native window/);
  assert.throws(() => withSample(step.from, sample => { sample.nodes[2].enabled = false; }),/Search forms/);
  assert.throws(() => withSample(step.from, sample => { sample.nodes[3].parentPath = '0'; }),/grabber is missing/);
  assert.throws(() => withSample(calibrationSample, sample => {
    const grabber = sample.nodes[3];
    grabber.visibleRectPx = {...grabber.rectPx,width:251};
  }),/clipped native grabber/);
  assert.throws(() => withSample(calibrationSample, sample => {
    const bounds = sample.nodes[0].visibleRectPx;
    sample.nodes[0].visibleRectPx = {...bounds,top:bounds.top + 1,height:bounds.height - 1};
  }),/stage moved/);
  assert.throws(() => withSample(calibrationSample, sample => {
    const grabber = sample.nodes[3];
    grabber.rectPx = grabber.visibleRectPx = {...grabber.rectPx,left:800};
  }),/outside the measured native path/);
});

test('grabber reversal dispatch binds immutable native baselines and the one current Runner receipt', () => {
  const step = loadCase('reading.control-grabber-reversal').steps.find(item => item.op === 'grabberReversal');
  const deviceNowMs = 1800000000000;
  const expiresAtMs = deviceNowMs + 30000;
  const appVersion = {versionName:'0.2.0',versionCode:1000000,appBuildId:'0.2.0.DEV.123abc',
    appContentHash:'a'.repeat(64)};
  const candidate = {targetRef:'012345abcdef',hdcServer:'127.0.0.1:8710',targetKind:'vm',hapSha256:'b'.repeat(64),...appVersion,
    expectedVersion:appVersion,postInstall:{bundleName:'io.reader.minliny',appVersion,updateTime:deviceNowMs - 1000}};
  const runnerBundle = 'io.reader.minliny.fixture';
  const runnerVersion = {versionName:'0.1.0',versionCode:1};
  const runnerApp = {appIdSha256:'1'.repeat(64),appIdentifierSha256:'2'.repeat(64)};
  const runner = {schema:'reader-ui-contract-runner-artifact-verification-v1',verification:'PASS',manifestSha256:'3'.repeat(64),
    targetRef:candidate.targetRef,hdcServer:candidate.hdcServer,targetKind:candidate.targetKind,
    hapSha256:'e'.repeat(64),bundleName:runnerBundle,moduleName:'entry_test',
    signature:{verified:true,profileType:'debug',bundleName:runnerBundle,certificateSha256:READER_SIGNER,...runnerApp},
    expectedVersion:runnerVersion,postInstall:{bundleName:runnerBundle,moduleName:'entry_test',appProvisionType:'debug',
      ...runnerApp,...runnerVersion,updateTime:deviceNowMs-500}};
  const ref = (hex,ext) => ({path:`raw/reader-control-${hex}.${ext}`,bytes:100,sha256:hex.repeat(64)});
  const captures = {
    [step.reversalReference]:{layout:ref('c','json'),screenshot:ref('d','png')},
    [step.from]:{layout:ref('e','json'),screenshot:ref('f','png')},
  };
  const stage = {left:0,top:137,width:1280,height:2695};
  const display = {left:0,top:0,width:1280,height:2832};
  const node = (id,path,parentPath,rectPx,enabled = true) =>
    ({id,path,parentPath,rectPx,visibleRectPx:rectPx,visible:true,enabled,opacity:1});
  const nativeSample = (name,full,seq) => ({
    instanceId:'reading-instance',captureComplete:true,beforeSeq:seq,afterSeq:seq+2,semanticSeq:seq-1,
    window:{id:'8',revision:4,density:3.5,rectPx:display,displayRectPx:display},
    evidenceRefs:Object.values(captures[name]),
    nodes:[
      {...node('reader-reading-stage','0/1','0',display),visibleRectPx:stage},
      node('reader-control-module-search','0/1/0','0/1',stage),
      node('reader-control-collapse','0/1/1','0/1',stage,full),
      node('reader-control-motion-grabber','0/1/2','0/1',{left:515,top:full?388:1587,width:252,height:98}),
    ],
  });
  const full = nativeSample(step.reversalReference,true,10);
  const quick = nativeSample(step.from,false,20);
  const before = {kind:'window-stable',instanceId:quick.instanceId,eventSeq:25,semanticSeq:quick.semanticSeq,
    windowRevision:4,payload:{windowId:'8'}};
  const input = {step,runId:'be120ec6-08d5-4330-a576-83d46fcb67cc',candidate,runner,
    readingId:'reading-1',before,samples:{[step.reversalReference]:full,[step.from]:quick},captures,deviceNowMs,expiresAtMs};
  const operation = prepareReversalDispatch(input);
  const installed = {installed:runner.postInstall};
  const clock = {stdout:`${deviceNowMs / 1000}\r\n`};
  assert.deepEqual(reversalReadbackTiming(installed,clock,runner.postInstall),{deviceNowMs,expiresAtMs});
  assert.throws(() => reversalReadbackTiming({installed:{...runner.postInstall,updateTime:deviceNowMs}},
    clock,runner.postInstall),/differs from the pinned artifact/);
  assert.throws(() => reversalReadbackTiming(installed,{stdout:`device time: ${clock.stdout}`},
    runner.postInstall),/unambiguous Unix clock/);
  assert.throws(() => reversalReadbackTiming(installed,{stdout:String(deviceNowMs / 1000 - 1)},
    runner.postInstall),/predates the Runner install/);
  assert.equal(operation.request.versionName,runnerVersion.versionName);
  assert.equal(operation.request.runnerBundle,runnerBundle);
  assert.deepEqual(operation.points[0],{x:641,y:1636});
  assert.deepEqual(operation.points.at(-1),{x:641,y:941});
  assert.ok(operation.points.every(({x,y}) => x >= stage.left && x < stage.left + stage.width &&
    y >= stage.top && y < stage.top + stage.height));
  const withQuickNode = (id, change) => ({
    ...input,
    samples:{...input.samples,[step.from]:{...quick,nodes:quick.nodes.map(item =>
      item.id === id ? {...item,...change(item)} : item)}},
  });
  assert.throws(() => prepareReversalDispatch(withQuickNode('reader-reading-stage', () => ({
    visibleRectPx:{...stage,top:stage.top + 1,height:stage.height - 1},
  }))),/stage/u);
  assert.throws(() => prepareReversalDispatch(withQuickNode('reader-control-motion-grabber', item => ({
    visibleRectPx:{...item.rectPx,width:item.rectPx.width - 1},
  }))),/clipped.*grabber/iu);
  const receipt = {schema:'reader-grabber-reversal-runner-v1',runId:input.runId,
    baselineSha256:operation.request.baselineSha256,runnerBundle,mode:'dispatch',state:'SDK_ACCEPTED',reason:'',
    startedAtMs:deviceNowMs+30,finishedAtMs:deviceNowMs+1000,points:operation.points,displayId:0,speedPxPerSecond:600};
  const prefix = 'READER_GRABBER_REVERSAL_RECEIPT ';
  const line = value => prefix + JSON.stringify(value);
  const command = {event:'command',seq:1,targetRef:candidate.targetRef,ok:true,status:0,signal:null,error:null,
    elapsedMs:1100,args:reversalCommandArgs(operation),stdout:`TestRunner start\r\n${line(receipt)}\r\n`};
  assert.deepEqual(requireActionDispatch([command],1,operation),{
    probeSeq:1,runId:input.runId,baselineSha256:operation.request.baselineSha256,
    runnerHapSha256:runner.hapSha256,state:'SDK_ACCEPTED',
  });
  const dry = prepareReversalDispatch({...input,mode:'dry'});
  assert.deepEqual(dry.request,{...operation.request,mode:'dry'});
  assert.deepEqual(dry.points,operation.points);
  assert.deepEqual(dry.argument.split(','),operation.argument.split(',').map((value,index) => index === 1 ? 'dry' : value));
  assert.throws(() => prepareReversalDispatch({...input,mode:'preview'}),/outside its admitted bounds/);
  const dryReceipt = {...receipt,mode:'dry',state:'DRY_READY'};
  const dryOutput = {...command,args:reversalCommandArgs(dry),stdout:line(dryReceipt)};
  assert.deepEqual(verifyReversalRunnerOutput(dryOutput,1,dry),{
    probeSeq:1,runId:input.runId,baselineSha256:dry.request.baselineSha256,
    runnerHapSha256:runner.hapSha256,state:'DRY_READY',
  });
  assert.throws(() => verifyReversalRunnerOutput(command,1,dry),/Unexpected command/);
  for (const stdout of [line(receipt),line({...dryReceipt,state:'SDK_ACCEPTED'}),
    line({...dryReceipt,finishedAtMs:expiresAtMs+1}),line({...dryReceipt,points:[]}),line(dryReceipt)+' ']) {
    assert.throws(() => verifyReversalRunnerOutput({...dryOutput,stdout},1,dry),/does not bind this request/);
  }
  assert.equal(prepareReversalDispatch({...input,samples:{...input.samples,[step.from]:{...quick,
    evidenceRefs:[...quick.evidenceRefs, {path:'raw/command.jsonl',bytes:500,sha256:'a'.repeat(64)}]}}}).argument,
  operation.argument);
  assert.notEqual(prepareReversalDispatch({...input,runner:{...runner,hapSha256:'f'.repeat(64)}}).request.baselineSha256,
    operation.request.baselineSha256);
  assert.throws(() => prepareReversalDispatch({...input,before:{...before,semanticSeq:20}}),/stale/);
  assert.throws(() => prepareReversalDispatch({...input,samples:{...input.samples,[step.from]:{
    ...quick,window:{...quick.window,id:'9'},
  }}}),/outside the current native window/);
  assert.throws(() => prepareReversalDispatch({...input,captures:{...captures,[step.from]:{...captures[step.from],
    layout:{...captures[step.from].layout,sha256:'1'.repeat(64)}}}}),/verified native tree/);
  assert.throws(() => prepareReversalDispatch({...input,runner:{...runner,hapSha256:candidate.hapSha256}}),/separate Runner HAP pin/);
  assert.throws(() => prepareReversalDispatch({...input,runner:{...runner,bundleName:'io.reader.minliny'}}),/separate test bundle/);
  assert.throws(() => prepareReversalDispatch({...input,runner:{...runner,signature:{...runner.signature,bundleName:'io.reader.minliny'}}}),
    /matching signed Profile/);
  assert.throws(() => prepareReversalDispatch({...input,runner:{...runner,postInstall:{...runner.postInstall,versionCode:2}}}),
    /current install/);
  assert.throws(() => prepareReversalDispatch({...input,runner:{...runner,hdcServer:'192.168.1.10:8710'}}),/exact case/);
  assert.throws(() => prepareReversalDispatch({...input,runner:{...runner,postInstall:{...runner.postInstall,moduleName:'entry'}}}),
    /current install/);
  assert.throws(() => prepareReversalDispatch({...input,runner:{...runner,postInstall:{...runner.postInstall,
    appIdentifierSha256:'4'.repeat(64)}}}),/current install/);
  assert.throws(() => requestedOperation(step,input.samples,{}),/requires a verified UiTest PointerMatrix runner/);

  for (const change of [{state:'DRY_READY',mode:'dry'},{state:'SDK_REJECTED'},{runId:'old'},{runnerBundle:'io.reader.minliny'},
    {baselineSha256:'0'.repeat(64)},{finishedAtMs:expiresAtMs+1},{speedPxPerSecond:601},
    {points:[{x:640,y:1636},...receipt.points.slice(1)]}]) {
    assert.throws(() => requireActionDispatch([{...command,stdout:line({...receipt,...change})}],1,operation),
      /does not bind this request/);
  }
  assert.throws(() => requireActionDispatch([{...command,args:command.args.map(arg => arg === 'entry_test' ? 'entry' : arg)}],
    1,operation), /Unexpected command/);
  assert.throws(() => requireActionDispatch([{...command,args:command.args.map(arg => arg === runnerBundle ? 'io.reader.minliny' : arg)}],
    1,operation), /Unexpected command/);
  assert.throws(() => requireActionDispatch([{...command,targetRef:'deadbeefcafe'}],1,operation),/exact target/);
  assert.throws(() => requireActionDispatch([{...command,status:1}],1,operation),/did not finish successfully/);
  assert.throws(() => requireActionDispatch([{...command,stdout:line(receipt)+'\n'+line(receipt)}],1,operation),/exactly one/);
  assert.throws(() => requireActionDispatch([{...command,stdout:prefix+'{'}],1,operation),/Malformed reversal/);
});

test('reversal collection keeps Runner readbacks and dispatch adjacent and verifies dry isolation', async () => {
  // Motion belongs to the evaluator tests. This fixture exercises the real collector command and seal order.
  const step = {...loadCase('reading.control-grabber-reversal').steps.find(item => item.op === 'grabberReversal'),waitFor:[]};
  const runId = 'be120ec6-08d5-4330-a576-83d46fcb67cc';
  const instanceId = '09e918a6-f404-45f8-b819-079d311cee4e';
  const deviceNowMs = 1800000000000;
  const appVersion = {schema:'reader-app-build-v1',versionName:'0.2.0',versionCode:1000000,channel:'DEV',
    appContentHash:'a'.repeat(64),contentId:'a'.repeat(12),appBuildId:`0.2.0.DEV.${'a'.repeat(12)}`};
  const route = {targetRef:'012345abcdef',hdcServer:'127.0.0.1:8710',targetKind:'vm'};
  const candidate = {...route,hapSha256:'b'.repeat(64),...appVersion,expectedVersion:appVersion,
    postInstall:{bundlePresent:true,bundleName:'io.reader.minliny',appVersion,updateTime:deviceNowMs-2000,
      cpuAbi:'arm64-v8a',appProvisionType:'debug',appIdSha256:'1'.repeat(64),appIdentifierSha256:'2'.repeat(64)}};
  const runnerBundle = 'io.reader.minliny.fixture';
  const runnerVersion = {versionName:'0.1.0',versionCode:1};
  const runnerApp = {appIdSha256:'3'.repeat(64),appIdentifierSha256:'4'.repeat(64)};
  const runner = {...route,schema:'reader-ui-contract-runner-artifact-verification-v1',verification:'PASS',
    bundleName:runnerBundle,moduleName:'entry_test',manifestSha256:'5'.repeat(64),hapSha256:'6'.repeat(64),expectedVersion:runnerVersion,
    signature:{verified:true,profileType:'debug',bundleName:runnerBundle,certificateSha256:READER_SIGNER,...runnerApp},
    postInstall:{bundleName:runnerBundle,moduleName:'entry_test',appProvisionType:'debug',...runnerVersion,...runnerApp,updateTime:deviceNowMs-1000}};
  const reference = (char,ext) => ({path:`raw/reader-control-${char}.${ext}`,bytes:100,sha256:char.repeat(64)});
  const captures = {
    [step.reversalReference]:{layout:reference('c','json'),screenshot:reference('d','png')},
    [step.from]:{layout:reference('e','json'),screenshot:reference('f','png')},
  };
  const bounds = {left:0,top:0,width:390,height:840};
  const node = (id,path,parentPath,rectPx,enabled=true) => ({id,path,parentPath,rectPx,visibleRectPx:rectPx,visible:true,enabled,opacity:1});
  const calibration = (name,full,seq) => ({
    instanceId,captureComplete:true,beforeSeq:seq,afterSeq:seq+2,semanticSeq:seq-1,evidenceRefs:Object.values(captures[name]),
    window:{id:'reader-window',revision:4,density:1,rectPx:bounds,displayRectPx:bounds},
    nodes:[node('reader-reading-stage','0/1','0',bounds),
      node('reader-control-module-search','0/1/0','0/1',bounds),node('reader-control-collapse','0/1/1','0/1',bounds,full),
      node('reader-control-motion-grabber','0/1/2','0/1',{left:159,top:full?210:620,width:72,height:28})],
  });
  const samples = {[step.reversalReference]:calibration(step.reversalReference,true,10),[step.from]:calibration(step.from,false,20)};
  const makeMark = (eventSeq, semanticSeq=19) => ({instanceId,eventSeq,semanticSeq,deviceMonoMs:eventSeq*200,windowRevision:4,
    kind:'window-stable',channel:'probe',payload:{windowId:'reader-window',orientation:'portrait',report:{metrics:{revision:4}}}});
  const ready = {...makeMark(3,3),kind:'reading.ready',channel:'business',
    payload:{readingId:'public-book-reading',mode:'paged',localBook:true,reduceMotion:false}};
  const log = (...events) => events.map(event =>
    `/ReaderUIContract: RUI1 ${instanceId}/${event.eventSeq}/0/1 ${JSON.stringify(event)}`).join('\n');
  const initial = {record:{seq:1},mark:makeMark(1,0)};
  const actions = {'enter-reading':{instanceId,beforeSeq:2,afterSeq:3}};
  const sequence = ['uiContractLog','uiContractRunnerInstalledIdentity','uiContractRunnerClock','uiContractLog',
    'uiContractRunnerInvoke','uiContractLog','uiContractLog'];

  function fake(mode, {changedWindow=false, staleRunner=false} = {}) {
    const operation = prepareReversalDispatch({step,runId,candidate,runner,readingId:ready.payload.readingId,
      before:makeMark(24),samples,captures,deviceNowMs,expiresAtMs:deviceNowMs+30000,mode});
    const calls = [];
    const probe = {
      records:[initial.record],
      async command(request) {
        calls.push(request.op);
        const seq = calls.length+1;
        const at = deviceNowMs + seq*100;
        const record = {event:'command',seq,ok:true,targetRef:route.targetRef,status:0,signal:null,error:null,
          startedAt:new Date(at).toISOString(),recordedAt:new Date(at+20).toISOString(),elapsedMs:20,stdout:''};
        switch (request.op) {
        case 'uiContractLog': {
          record.args = ['shell','hilog','-x','-T','ReaderUIContract'];
          const eventSeq = {2:23,5:24,7:25,8:26}[seq];
          assert.ok(eventSeq, 'unexpected Hilog poll');
          record.stdout = log(ready,makeMark(eventSeq,changedWindow && seq===8 ? 25 : 19));
          break;
        }
        case 'uiContractRunnerInstalledIdentity':
          assert.equal(request.bundleName,runnerBundle);
          record.args = ['shell','bm','dump','-n',runnerBundle];
          record.installed = {...runner.postInstall,...(staleRunner ? {updateTime:deviceNowMs} : {})};
          break;
        case 'uiContractRunnerClock':
          record.args = ['shell','date','+%s'];
          record.stdout = `${deviceNowMs/1000}\n`;
          break;
        case 'uiContractRunnerInvoke':
          assert.equal(request.argument,operation.argument);
          record.args = reversalCommandArgs(operation);
          record.stdout = 'READER_GRABBER_REVERSAL_RECEIPT '+JSON.stringify({
            schema:'reader-grabber-reversal-runner-v1',runId,baselineSha256:operation.request.baselineSha256,runnerBundle,
            mode,state:mode==='dry' ? 'DRY_READY' : 'SDK_ACCEPTED',reason:'',startedAtMs:at,finishedAtMs:at+20,
            points:operation.points,displayId:0,speedPxPerSecond:600,
          });
          break;
        case 'uiContractInstalledIdentity':
          record.args = ['shell','bm','dump','-n','io.reader.minliny'];
          record.installed = candidate.postInstall;
          break;
        default:
          assert.fail('unexpected probe operation');
        }
        probe.records.push(record);
        return record;
      },
    };
    return {calls, collect:() => collectReversalAction({probe,step,runId,candidate,runner,mode,instanceId,initial,
      actions,samples,captures,started:performance.now()})};
  }
  const dry = fake('dry');
  const qualify = await dry.collect();
  assert.deepEqual(dry.calls,[...sequence,'uiContractInstalledIdentity']);
  assert.equal(qualify.dispatch.state,'DRY_READY');
  assert.deepEqual([qualify.entry.runnerMode,qualify.entry.readerInstalledAfterLog],['dry',qualify.entry.afterLog+1]);
  const live = fake('dispatch');
  const dispatched = await live.collect();
  assert.deepEqual(live.calls,sequence);
  assert.equal(dispatched.dispatch.state,'SDK_ACCEPTED');
  assert.equal(dispatched.entry.runnerMode,undefined);
  assert.equal(dispatched.entry.readerInstalledAfterLog,undefined);
  assert.deepEqual([dispatched.entry.runnerInstallLog,dispatched.entry.runnerClockLog,dispatched.entry.beforeLog,
    dispatched.entry.command,dispatched.entry.floorLog],[3,4,5,6,7]);
  const changed = fake('dry',{changedWindow:true});
  await assert.rejects(changed.collect,/changed during Runner dry qualification/);
  assert.deepEqual(changed.calls,sequence);
  const stale = fake('dispatch',{staleRunner:true});
  await assert.rejects(stale.collect,/differs from the pinned artifact deployment/);
  assert.deepEqual(stale.calls,sequence.slice(0,3));
});
