import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { readinessQueryOutput } from '../../../scripts/lib/hap-delivery-evidence.mjs';
import { captureRecord } from '../../lib/native-ui-evidence.mjs';
import { checkpoint, installedCommand, logCommand, normalizeSample, probeEventsInRange, readProbeEvents, sessionContext, startCommand, windowStable } from '../collectors/harmonyos/records.mjs';
import { prepareReversalDispatch, reversalCommandArgs } from '../collectors/harmonyos/reversal-dispatch.mjs';
import { assertRunnerQualification, runnerCollectionMode, sealRunnerQualification } from '../collectors/harmonyos/runner-collection-admission.mjs';
import { READER_SIGNER } from '../collectors/harmonyos/pointer-matrix-runner/entry/src/ohosTest/ets/testrunner/ReversalPlan.ts';
import { loadCandidate, readLivePriorEvents, writeGuestSchedulingEvidence } from '../collectors/harmonyos/run.mjs';
import { candidateCoverage, groupExecution, scenarioCoverage } from '../coverage.mjs';
import { loadCase, toolIdentity } from '../lib/cases.mjs';
import { evidenceStore, jsonBytes, jsonDigest, sealChain, sha256, validate, verifyChain } from '../lib/evidence.mjs';
import { assessStructure, reassessOriginalStructure, replayReceipt, sealReceipt, summarizeAcceptance } from '../lib/receipt.mjs';
import { conditionApplicability } from '../lib/receipt-conditions.mjs';
import { requireStructureProof, structureBindingSha256 } from '../lib/receipt-structure.mjs';
import { loadStructureDefinition, resolveStructureBindings, validateStructureDefinition } from '../lib/structure-contract.mjs';
import { exportReplayTool } from '../export-replay.mjs';

const searchId = 'bookshelf.search-input-ime';
const readingId = 'reading.control-open-motion';
const targetRef = '123456789abc';
const syntheticServer = '127.0.0.1:8710';
const completedAt = '2026-11-19T06:00:00Z';

function scratch(t) {
  const directory = mkdtempSync(join(tmpdir(), 'reader-phase0-synthetic-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function appBuild(char) {
  const contentId = char.repeat(12);
  return { schema: 'reader-app-build-v1', versionName: '0.2.0', versionCode: 1000000, channel: 'DEV',
    contentId, appContentHash: char.repeat(64), appBuildId: `0.2.0.DEV.${contentId}` };
}

const snapshotFingerprint = files => sha256(files.map(file => `${JSON.stringify(file)}\n`).join(''));

// These records are intentionally synthetic. There is no HAP, device session,
// real source capture or product-verification PASS in any fixture.
function fixture(t, id = searchId, mutate) {
  const directory = scratch(t);
  const bundle = join(directory, 'bundle');
  mkdirSync(bundle);
  const store = evidenceStore(bundle);
  const contract = loadCase(id);
  const ownerSources = {};
  const sourcePaths = [...new Set([searchId, readingId, id].flatMap(caseId => loadCase(caseId).ownerSources))].sort();
  const files = sourcePaths.map((path, index) => {
    const content = Buffer.from(`Synthetic source fixture ${index}\n`);
    if (contract.ownerSources.includes(path)) ownerSources[path] = store.write(`candidate/owner/${path}`, content);
    return { path, type: 'file', mode: 0o644, bytes: content.length, sha256: sha256(content) };
  });
  const sourceFingerprint = snapshotFingerprint(files);
  const expectedVersion = appBuild('a');
  const hapSha256 = 'b'.repeat(64);
  const manifest = {
    schemaVersion: 2, name: 'synthetic-test-candidate', abi: 'x86_64', runId: 'synthetic-build',
    artifacts: [{ kind: 'signed', path: 'synthetic.hap', sha256: hapSha256, signature: { verified: true } }],
    source: { buildInputs: { snapshot: 'source-snapshot.json', fileCount: files.length, fingerprint: sourceFingerprint } },
    expectedVersion,
  };
  const deployment = {
    runId: manifest.runId, dataPolicy: 'preserve', targetKind: 'vm', hdcServer: syntheticServer,
    install: 'PASS', launch: 'PASS', appVersionCheck: 'PASS',
    artifact: { kind: 'signed', sha256: hapSha256 }, targetRef, completedAt,
    postInstall: { bundlePresent: true, bundleName: 'io.reader.minliny', appVersion: appBuild('a'),
      cpuAbi: 'x86_64', appProvisionType: 'debug', appIdSha256: 'c'.repeat(64),
      appIdentifierSha256: 'd'.repeat(64), updateTime: 1795068000000 },
  };
  const snapshot = { schemaVersion: 1, fingerprint: sourceFingerprint, files };
  const publicFixture = {
    schema: 'reader-ui-public-fixture-v1', caseId: id, fixtureId: contract.fixture.id, targetRef,
    hdcServer: syntheticServer, vmName: 'Synthetic fixture with no target',
    checkedAt: completedAt, publicBooks: true, publicHistory: true,
    publicImeCandidates: true, developerMode: true, noPersonalData: true,
    directRoute: Object.fromEntries(['clientToServer', 'serverToTarget'].map(leg =>
      [leg, { direct: true, socketObservation: 'Synthetic socket', routeObservation: 'Synthetic route' }])),
  };
  if (contract.phase === 1) {
    Object.assign(manifest.artifacts[0].signature, {
      status:'signed', certificateSha256:'3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4',
      profileType:'debug', appIdSha256:deployment.postInstall.appIdSha256,
      appIdentifierSha256:deployment.postInstall.appIdentifierSha256,
    });
    if (contract.fixture.bookTitle) publicFixture.publicBookTitleConfirmed = true;
    if (contract.fixture.publicSources) publicFixture.publicSources = true;
  }
  mutate?.({ manifest, deployment, snapshot, publicFixture, ownerSources, store, contract });
  const refs = {
    manifest: store.writeJson('candidate/manifest.json', manifest),
    deployment: store.writeJson('candidate/deployment.json', deployment),
    // This format matches the pipeline snapshot's original per-record key order.
    snapshot: store.write('candidate/source-snapshot.json', `${JSON.stringify(snapshot)}\n`),
    ownerSources,
  };
  const session = {
    runId: `synthetic-incomplete-${id}`, platform: 'harmonyos', instanceId: null, result: 'INCOMPLETE', reason: 'Synthetic no-device fixture',
    commands: store.write('session/commands.ndjson', '\n'),
    fixture: store.writeJson('session/fixture.json', publicFixture),
    chain: [],
  };
  const sessionRef = store.writeJson('session/session.json', session);
  return { directory, bundle, store, refs, contract, session, sessionRef };
}

function replay(path, rootSha256, contract) {
  return replayReceipt({ receiptPath: path, expectedRoot: rootSha256, contract });
}

test('Missing or unarmed Guest scheduling still seals the incomplete official receipt', t => {
  for (const [expected, rawObservation] of [
    ['NOT_RUN', undefined], ['NOT_ARMED', {status:'NOT_ARMED', cleanup:'NOT_RUN'}], ['UNBOUND', {}],
  ]) {
    const run = fixture(t, 'reading.control-tts-capsule-handoff-full');
    const candidate = loadCandidate(run.store, run.refs, run.contract);
    const observation = rawObservation ? run.store.writeJson('raw/guest-scheduling.json', rawObservation) : null;
    const guestSchedulingTrace = writeGuestSchedulingEvidence({...run, candidate, records:[]});
    const summary = run.store.json(guestSchedulingTrace.evidence);
    assert.equal(summary.status, expected);
    assert.equal(summary.cleanup, 'NOT_RUN');
    assert.deepEqual(summary.observation, observation);
    assert.deepEqual(summary.session, run.sessionRef);
    for (const key of ['trace','coverage','playbackCommandSeq','dispatchLogFloorSeq']) assert.equal(summary[key], null);

    const sealed = sealReceipt({...run, candidate, guestSchedulingTrace}, run.contract);
    assert.equal(sealed.receipt.execution, 'INCOMPLETE');
    assert.equal(replay(join(run.bundle, 'receipt.json'), sealed.rootSha256, run.contract).receipt.execution, 'INCOMPLETE');
  }
});

test('readiness preserves supported procfs denial and rejects other nonzero or interrupted queries', () => {
  const path = '/proc/sys/kernel/random/boot_id';
  const denied = {status: 1, stdout: '', stderr: `cat: ${path}: Permission denied\r\n`};
  assert.equal(readinessQueryOutput(`cat ${path}`, denied), denied.stderr.trim());
  assert.equal(readinessQueryOutput('param get bootevent.boot.completed', {status: 0, stdout: 'true\n'}), 'true');
  assert.throws(() => readinessQueryOutput('cat /proc/uptime', denied), /readiness query failed/u);
  assert.throws(() => readinessQueryOutput(`cat ${path}`, {...denied, stderr: denied.stderr + 'Connect server failed'}), /readiness query failed/u);
  assert.throws(() => readinessQueryOutput(`cat ${path}`, {...denied, signal: 'SIGTERM'}), /readiness query failed/u);
  assert.throws(() => readinessQueryOutput('param get bootevent.boot.completed', {status: 1, stdout: 'true'}), /readiness query failed/u);
});

test('canonical digests are independent of insertion order and nested evidence bytes are verified', t => {
  const directory = scratch(t);
  const bundle = join(directory, 'bundle');
  mkdirSync(bundle);
  const store = evidenceStore(bundle);
  assert.equal(jsonDigest({ b: [true, 2], a: 1 }), jsonDigest({ a: 1, b: [true, 2] }));
  const ref = store.write('raw/source', 'initial');
  const publicFixture = store.write('raw/Reader Phase 1 公共书源.json', 'fixture');
  assert.equal(Buffer.from(store.bytes(publicFixture)).toString('utf8'), 'fixture');
  assert.throws(() => store.write(ref.path, 'replacement'), /EEXIST/);
  assert.throws(() => store.reference('../outside'), /Invalid evidence-relative path/);
  assert.throws(() => store.reference(join(directory, 'absolute')), /Invalid evidence-relative path/);
  writeFileSync(join(bundle, 'raw/source'), 'changed');
  assert.throws(() => store.bytes(ref), /Changed evidence bytes/);
  writeFileSync(join(directory, 'elsewhere'), 'initial');
  symlinkSync(join(directory, 'elsewhere'), join(bundle, 'raw/link'));
  assert.throws(() => store.reference('raw/link'), /symbolic link/);
  assert.throws(() => store.write('raw/link/forged', 'nested'), /symbolic link/);
});

test('ordered predecessor digest rejects altered, reordered and duplicate chunks', () => {
  const chain = sealChain([{ kind: 'synthetic-start' }, { kind: 'synthetic-sample' }, { kind: 'synthetic-close' }]);
  assert.equal(verifyChain(chain), chain[2].sha256);
  assert.equal(verifyChain([]), null);
  const changed = structuredClone(chain);
  changed[1].entry.kind = 'synthetic-substitute';
  assert.throws(() => verifyChain(changed), /Broken evidence chain at index 1/);
  assert.throws(() => verifyChain([chain[0], chain[2], chain[1]]), /Broken evidence chain at index 1/);
  assert.throws(() => verifyChain([chain[0], chain[1], chain[1]]), /Broken evidence chain at index 2/);
});

test('sealed grabber reversal replay reconstructs the current dispatch and rejects borrowed Runner evidence', async t => {
  const {PNG} = await import('pngjs');
  const loaded = loadCase('reading.control-grabber-reversal');
  const step = loaded.steps.find(item => item.op === 'grabberReversal');
  const [entryStep,enterStep] = loaded.steps;
  const captureSteps = [step.reversalReference,step.from].map(id => {
    const {afterAction,quietMs,waitFor,...sample} = loaded.steps.find(item => item.id === id);
    return sample;
  });
  const contract = {...loaded,steps:[entryStep,enterStep,...captureSteps,step]};
  const instanceId = '70100000-1100-4000-8000-000000000002';
  const runId = 'be120ec6-08d5-4330-a576-83d46fcb67cc';
  const readingId = 'synthetic-reading-owner';
  const expectedVersion = appBuild('a');
  const deviceNowMs = 1800000000000;
  const time = (offset = 0) => new Date(deviceNowMs + offset).toISOString();
  const postInstall = {bundlePresent:true,bundleName:'io.reader.minliny',appVersion:expectedVersion,
    cpuAbi:'x86_64',appProvisionType:'debug',appIdSha256:'c'.repeat(64),appIdentifierSha256:'d'.repeat(64),
    updateTime:deviceNowMs - 1000};
  const bundleName = 'io.reader.minliny.fixture';
  const runnerVersion = {versionName:'0.1.0',versionCode:1};
  const appIdentity = {appIdSha256:'1'.repeat(64),appIdentifierSha256:'2'.repeat(64)};
  const runnerInstall = {bundleName,moduleName:'entry_test',appProvisionType:'debug',...runnerVersion,...appIdentity,
    updateTime:deviceNowMs-500};
  const manifest = {schema:'reader-ui-contract-runner-artifact-manifest-v1',bundleName,expectedVersion:runnerVersion,
    artifact:{path:'reader-runner.hap',sha256:'b'.repeat(64),bytes:400}};
  const box = {left:0,top:0,width:390,height:840};
  const bounds = '[0,0][390,840]';
  const fixtureImage = new PNG({width:box.width,height:box.height});
  fixtureImage.data.fill(255);
  fixtureImage.data.fill(0,0,3);
  const png = PNG.sync.write(fixtureImage);
  const props = {hostWindowId:'8',visible:'true',enabled:'true',opacity:'1'};
  const native = (id,rect,children = [],extra = {}) => ({
    attributes:{...props,id,type:'Column',origBounds:rect,bounds:rect,...extra},children,
  });
  const tree = full => ({attributes:{bounds},children:[
    native('',bounds,[native('reader-reading-stage','[0,52][390,800]',[
      native('reader-control-module-search','[16,200][374,780]'),
      native('reader-control-collapse','[40,335][86,375]',[],{enabled:String(full)}),
      native('reader-control-motion-grabber',full ? '[160,260][232,288]' : '[160,670][232,698]'),
    ])],{type:'root',bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'}),
  ]});
  const bookshelf = {attributes:{bounds},children:[
    native('',bounds,[
      native('reader-bookshelf-search-entry','[16,40][374,90]'),
      native('reader-shelf-book-action:[0,"local","synthetic",false]','[40,140][140,240]',[],{
        type:'Button',clickable:'true',description:`${loaded.fixture.bookTitle}，公开夹具`,
      }),
    ],{type:'root',bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'}),
  ]};
  const metrics = {ready:true,revision:4,densityPixels:1,windowRect:box,globalRect:box,
    keyboardArea:{available:true,visible:false,rects:[],revision:4},
    keyboardInsets:{left:0,right:0,top:0,bottom:0}};
  const event = (eventSeq,kind,payload,channel='business',semanticSeq=eventSeq) =>
    ({instanceId,eventSeq,semanticSeq,deviceMonoMs:eventSeq*100,windowRevision:4,kind,payload,channel});
  const mark = (seq,semanticSeq) => event(seq,'window-stable',
    {windowId:'8',orientation:'portrait',report:{metrics,vpPixels:1}},'probe',semanticSeq);
  const line = item => `I A05244/ReaderUIContract: RUI1 ${item.instanceId}/${item.eventSeq}/0/1 ${JSON.stringify(item)}`;

  function replay({missingRunner=false,tamperVerification=false,changeVerification,changeDeployment,changeClock,changeInstall,
    changeCommand,dry=false,changedWindow=false,changedReaderInstall=false,probeExit={code:0,signal:null}} = {}) {
    const {bundle:root,store,refs,session:sourceSession} = fixture(t,loaded.id,({manifest,deployment,publicFixture}) => {
      manifest.artifacts[0].sha256 = 'a'.repeat(64);
      deployment.artifact.sha256 = manifest.artifacts[0].sha256;
      deployment.postInstall = postInstall;
      publicFixture.checkedAt = time(-1000);
    });
    const candidate = loadCandidate(store,refs,contract);
    const manifestRef = store.writeJson('candidate/runner-manifest.json',manifest);
    const verification = {schema:'reader-ui-contract-runner-artifact-verification-v1',verification:'PASS',
      manifestSha256:manifestRef.sha256,bundleName,moduleName:'entry_test',expectedVersion:runnerVersion,
      hapSha256:manifest.artifact.sha256,bytes:manifest.artifact.bytes,
      signature:{status:'signed',verified:true,profileType:'debug',bundleName,certificateSha256:READER_SIGNER,...appIdentity}};
    const verificationRef = store.writeJson('candidate/runner-verification.json',
      changeVerification ? changeVerification(verification) : verification);
    const deployment = {
      schema:'reader-ui-contract-runner-deployment-v1',hapSha256:manifest.artifact.sha256,
      manifestSha256:manifestRef.sha256,verificationSha256:verificationRef.sha256,hdcServer:syntheticServer,
      targetKind:'vm',targetRef,dataPolicy:'preserve',install:'PASS',launch:'NOT_RUN',
      completedAt:time(-450),postInstall:runnerInstall,
    };
    const deploymentRef = store.writeJson('candidate/runner-deployment.json',changeDeployment?.(deployment) ?? deployment);
    const records = [];
    const push = record => records.push({targetRef,seq:records.length+1,recordedAt:time(),...record});
    const command = (args,more) => push({event:'command',ok:true,status:0,signal:null,error:null,args,...more});
    const log = (...items) => command(logCommand,{stdout:items.map(line).join('\n')});
    push({event:'ready'});
    push({event:'readiness',status:'PASS',exactConnected:true,bootCompleted:true,
      sceneBoardStable:true,targetKind:'vm',emulatorLog:{bootMarker:true,instabilityAfterMarker:false},hdcServer:syntheticServer});
    const installed = command(installedCommand,{installed:postInstall});
    const baselineLog = log(), start = command(startCommand), startFloor = log(), initialLog = log(mark(1,0));
    const entries = [{kind:'preflight',readiness:2,installed,baselineLog,start,startFloor,initialLog}];
    const recordCapture = (ref,primitive) => {
      const remote = `/data/local/tmp/${ref.path.split('/').at(-1)}`, local = `/synthetic/${ref.path}`;
      command(['shell','uitest',primitive,'-p',remote]);
      command(['file','recv',remote,local]);
      push({event:'capture-integrity',path:local,bytes:ref.bytes,sha256:ref.sha256});
    };
    const entryBefore = mark(2,0), entryEnd = mark(3,0);
    const beforeEntryLog = log(entryBefore);
    const entryLayout = store.writeJson('raw/reader-control-3-b.json',bookshelf);
    recordCapture(entryLayout,'dumpLayout');
    entries.push({kind:'locate',id:entryStep.id,beforeLog:beforeEntryLog,beforeSeq:2,floorLog:log(entryBefore),
      afterLog:log(entryEnd),afterSeq:3,layout:entryLayout,hostBeginMs:0,hostEndMs:1});
    const beforeEnterLog = log(mark(4,0));
    const enter = command(['shell','uitest','uiInput','click','90','190']);
    const ready = event(5,'reading.ready',{readingId,localBook:true,reduceMotion:false,mode:'paged'});
    entries.push({kind:'action',id:enterStep.id,beforeLog:beforeEnterLog,beforeSeq:4,command:enter,
      floorLog:log(ready,mark(6,5)),afterLog:log(mark(7,5)),afterSeq:7,hostBeginMs:1,hostEndMs:2});
    const samples = {}, captures = {};
    for (const [index,sampleStep] of captureSteps.entries()) {
      const before = mark(8+index*2,5), after = mark(9+index*2,5);
      const beforeLog = log(before);
      const screenshot = store.write(`raw/reader-control-${index+1}-a.png`,png);
      const layout = store.writeJson(`raw/reader-control-${index+1}-b.json`,tree(index === 0));
      recordCapture(screenshot,'screenCap');
      recordCapture(layout,'dumpLayout');
      const entry = {kind:'sample',id:sampleStep.id,beforeLog,beforeSeq:before.eventSeq,floorLog:log(before),
        afterLog:log(after),afterSeq:after.eventSeq,screenshot,layout,hostBeginMs:index+2,hostEndMs:index+3};
      entries.push(entry);
      samples[sampleStep.id] = normalizeSample({store,records,entry,before,after,refs:[],fixture:contract.fixture,step:sampleStep});
      captures[sampleStep.id] = {screenshot,layout};
    }
    const installedRunner = {installed:runnerInstall,startedAt:time(-400),recordedAt:time(-350),elapsedMs:50};
    const clock = {stdout:`${deviceNowMs/1000}\n`,startedAt:time(),recordedAt:time(50),elapsedMs:50};
    const runnerInstallLog = command(['shell','bm','dump','-n',bundleName],changeInstall?.(installedRunner) ?? installedRunner);
    const runnerClockLog = command(['shell','date','+%s'],changeClock?.(clock) ?? clock);
    const before = mark(12,5);
    const beforeLog = command(logCommand,{stdout:line(before),startedAt:time(100),recordedAt:time(150),elapsedMs:50});
    const runner = {...verification,targetRef,hdcServer:syntheticServer,targetKind:'vm',postInstall:runnerInstall};
    const mode = dry ? 'dry' : 'dispatch';
    const operation = prepareReversalDispatch({step,runId,candidate,runner,readingId,before,samples,captures,
      deviceNowMs,expiresAtMs:deviceNowMs+30000,mode});
    const receipt = {schema:'reader-grabber-reversal-runner-v1',runId,baselineSha256:operation.request.baselineSha256,
      runnerBundle:bundleName,mode,state:dry?'DRY_READY':'SDK_ACCEPTED',reason:'',startedAtMs:deviceNowMs+210,
      finishedAtMs:deviceNowMs+700,points:operation.points,displayId:0,speedPxPerSecond:600};
    const runnerOutput = item => `Runner start\nREADER_GRABBER_REVERSAL_RECEIPT ${JSON.stringify(item)}\n`;
    const observedCommand = {startedAt:time(200),recordedAt:time(720),elapsedMs:520,stdout:runnerOutput(receipt)};
    const dispatch = command(reversalCommandArgs(operation),changeCommand?.(observedCommand,receipt,runnerOutput) ?? observedCommand);
    const outcome = dry ? [mark(13,5)] : [event(13,'reading.control-transition-interrupted',{origin:'grabber-release'}),
      event(14,'reading.control-transition-committed',{origin:'grabber-release'}),
      event(15,'reading.control-motion',{finalBlock:true,endReason:'interrupted'},'motion'),
      event(16,'reading.control-motion',{finalBlock:true,endReason:'completed'},'motion')];
    const floorLog = command(logCommand,{stdout:outcome.map(line).join('\n'),startedAt:time(800),recordedAt:time(850),elapsedMs:50});
    const after = dry ? mark(14,5) : mark(17,16);
    if (changedWindow) after.payload.windowId = '9';
    const afterLog = log(after);
    const closing = dry ? {runnerMode:'dry',...(probeExit === null ? {} : {runnerProbeExit:probeExit}),
      readerInstalledAfterLog:command(installedCommand,{
      installed:changedReaderInstall ? {...postInstall,updateTime:postInstall.updateTime+1} : postInstall,
      recordedAt:time(950),
    })} : {};
    if (dry) push({event:'closed',reason:'quit-or-eof'});
    entries.push({kind:'action',id:step.id,beforeLog,beforeSeq:before.eventSeq,command:dispatch,
      runnerInstallLog,runnerClockLog,floorLog,afterLog,afterSeq:after.eventSeq,hostBeginMs:4,hostEndMs:5,...closing});
    const journal = store.write('session/reversal-commands.ndjson',records.map(item => JSON.stringify(item)).join('\n'));
    const sessionRef = store.writeJson('session/reversal-session.json',{runId,platform:'harmonyos',instanceId,
      result:'INCOMPLETE',reason:'Synthetic scoped action capture',commands:journal,
      fixture:sourceSession.fixture,chain:sealChain(entries),
      ...(missingRunner ? {} : {runner:{manifest:manifestRef,verification:verificationRef,deployment:deploymentRef}})});
    if (tamperVerification) writeFileSync(join(root,verificationRef.path),jsonBytes({...verification,bytes:401}));
    const session = validate('session',store.json(sessionRef));
    verifyChain(session.chain);
    const context = sessionContext({store,session,sessionRef,candidate,contract});
    return {context,receipt,manifestRef,verificationRef,deploymentRef,dispatch,store,refs,candidate,sessionRef};
  }

  const {context,receipt,manifestRef,verificationRef,deploymentRef,dispatch} = replay();
  const action = context.actions[step.id];
  assert.deepEqual(context.problems,[]);
  assert.equal(action.outcomeSettled,true);
  assert.deepEqual(action.dispatch,{probeSeq:dispatch,runId,baselineSha256:receipt.baselineSha256,
    runnerHapSha256:manifest.artifact.sha256,state:'SDK_ACCEPTED'});
  for (const ref of [manifestRef,verificationRef,deploymentRef]) {
    assert.ok(action.evidenceRefs.some(item => item.path === ref.path && item.bytes === ref.bytes && item.sha256 === ref.sha256));
  }

  function rejects(options,reason) {
    let result;
    try { result = replay(options); }
    catch (error) { assert.match(error.message,reason); return; }
    assert.equal(result.context.actions[step.id],undefined);
    assert.match(result.context.problems.join('\n'),reason);
  }
  rejects({missingRunner:true},/runner|Runner/u);
  rejects({tamperVerification:true},/Changed evidence bytes/u);
  rejects({changeVerification:value=>({...value,hapSha256:'8'.repeat(64)})},/artifact|manifest|HAP/u);
  rejects({changeDeployment:value=>({...value,install:'FAIL'})},/deployment|install/u);
  rejects({changeDeployment:value=>({...value,dataPolicy:'replace-data'})},/deployment|install/u);
  rejects({changeDeployment:value=>({...value,launch:'PASS'})},/deployment|install/u);
  rejects({changeDeployment:value=>({...value,targetRef:'deadbeefcafe'})},/deployment|target/u);
  rejects({changeInstall:value=>({...value,targetRef:'deadbeefcafe'})},/exact target/u);
  rejects({changeInstall:value=>({...value,installed:{...value.installed,updateTime:deviceNowMs+1000}})},/install|clock|time/u);
  rejects({changeClock:value=>({...value,stdout:'not-an-exact-clock\n'})},/clock|time/u);
  rejects({changeClock:value=>({...value,stdout:`${deviceNowMs/1000 - 1}\n`})},/clock predates/u);
  rejects({changeCommand:(value,old,output)=>({...value,stdout:output({...old,baselineSha256:'7'.repeat(64)})})},
    /does not bind this request/u);

  const dryRun = replay({dry:true});
  assert.deepEqual(dryRun.context.problems,[]);
  assert.equal(dryRun.context.actions[step.id],undefined);
  const proof = sealRunnerQualification(dryRun,contract);
  assert.equal(proof.status,'DRY_READY');
  assert.equal(proof.execution,'NOT_RUN');
  const options = {runnerMode:'dispatch',runnerManifest:'/synthetic/manifest.json',runnerInstallEvidence:'/synthetic',
    runnerDeploymentSha:dryRun.deploymentRef.sha256,runnerQualification:join(dryRun.store.root,proof.qualification),
    runnerQualificationSha:proof.rootSha256};
  assert.equal(runnerCollectionMode(options,contract),'dispatch');
  assert.throws(() => runnerCollectionMode({...options,runnerQualification:undefined},contract),/separately pinned/u);
  assert.doesNotThrow(() => assertRunnerQualification(options,contract,dryRun.candidate));
  assert.throws(() => assertRunnerQualification({...options,runnerQualificationSha:'0'.repeat(64)},contract,dryRun.candidate),/pinned root/u);
  assert.throws(() => assertRunnerQualification({...options,runnerDeploymentSha:'0'.repeat(64)},contract,dryRun.candidate),/installed Runner/u);
  assert.throws(() => assertRunnerQualification(options,contract,{...dryRun.candidate,targetRef:'deadbeefcafe'}),/exact target/u);
  assert.throws(() => assertRunnerQualification(options,contract,{...dryRun.candidate,
    postInstall:{...postInstall,updateTime:postInstall.updateTime+1}}),/another Reader deployment/u);
  for (const change of [{changedWindow:true},{changedReaderInstall:true},{probeExit:null},{probeExit:{code:1,signal:null}},
    {changeCommand:(value,old,output)=>({...value,stdout:output({...old,mode:'dispatch',state:'SDK_ACCEPTED'})})}]) {
    const rejected = replay({dry:true,...change});
    assert.equal(rejected.context.runnerQualification,undefined);
    assert.equal(sealRunnerQualification(rejected,contract),undefined);
    assert.ok(rejected.context.problems.length > 0);
  }
});

test('Phase 1 append replay preserves only a verified read-only tail after submit', () => {
  const instanceId = '70100000-1100-4000-8000-000000000001';
  const dimensions = {left:0,top:0,width:100,height:200};
  const metrics = {revision:1,ready:true,windowRect:dimensions,globalRect:dimensions,densityPixels:1};
  const target = 'reader-bookshelf-search-submit';
  const event = (eventSeq, kind, payload = {}, semanticSeq = eventSeq) => ({instanceId,
    eventSeq,semanticSeq,deviceMonoMs:eventSeq,windowRevision:1,kind,
    channel:kind === 'window-stable' ? 'probe' : 'business',payload});
  const mark = (seq, semanticSeq) => event(seq,'window-stable',
    {windowId:'7',orientation:'portrait',report:{metrics,vpPixels:1}},semanticSeq);
  const line = item => `I A05244/ReaderUIContract: RUI1 ${item.instanceId}/${item.eventSeq}/0/1 ${JSON.stringify(item)}`;
  const postInstall = {bundlePresent:true,bundleName:'io.reader.minliny',appVersion:appBuild('a'),
    cpuAbi:'x86_64',appProvisionType:'debug',appIdSha256:'c'.repeat(64),appIdentifierSha256:'d'.repeat(64),
    updateTime:1795068000000};
  const candidate = {targetRef,completedAt,expectedVersion:postInstall.appVersion,postInstall,targetKind:'vm',hdcServer:syntheticServer};
  const bounds = '[0,0][100,200]';
  const attributes = {bounds,origBounds:bounds,hostWindowId:'7',visible:'true',opacity:'1',enabled:'true',clickable:'true'};
  const tree = Buffer.from(JSON.stringify({attributes:{bounds},children:[{
    attributes:{...attributes,bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index',type:'root'},
    children:[{attributes:{...attributes,id:target,type:'Button'},children:[]}],
  }]}));
  const remote = '/data/local/tmp/reader-control-synthetic.json';
  const local = '/synthetic/raw/reader-control-synthetic.json';
  const layout = {path:'raw/reader-control-synthetic.json',bytes:tree.length,sha256:sha256(tree)};
  const commands = {path:'session/journal.jsonl'};
  const sessionRef = {path:'session/session.json'};
  const first = event(8,'search-online-attempt',{requestedPage:1,stage:'settled',receiptState:'next',nextPage:2});
  const next = event(10,'search-continuation-page',{requestedPage:2,stage:'settled',outcome:'failed'});

  function replay({version = 5, settled = true, changeTail} = {}) {
    const records = [{event:'ready'}, {event:'readiness',status:'PASS',exactConnected:true,bootCompleted:true,
      sceneBoardStable:true,targetKind:'vm',emulatorLog:{bootMarker:true,instabilityAfterMarker:false},hdcServer:syntheticServer}];
    const command = (args, more) => records.push({event:'command',ok:true,args,...more});
    const log = (...items) => command(logCommand,{stdout:items.map(line).join('\n')});
    const installed = command(installedCommand,{installed:postInstall});
    const baselineLog = log();
    const start = command(startCommand);
    const startFloor = log();
    const initialLog = log(mark(1,0));
    const locateLog = log(mark(2,0));
    command(['shell','uitest','dumpLayout','-p',remote]);
    command(['file','recv',remote,local]);
    records.push({event:'capture-integrity',path:local,bytes:layout.bytes,sha256:layout.sha256});
    const locateFloor = log(mark(2,0));
    const locateEnd = log(mark(3,0));
    const submitLog = log(mark(4,0));
    const submitCommand = command(['shell','uitest','uiInput','click','50','100']);
    const accepted = event(5,settled ? 'search-submit-accepted' : 'search-button-intent');
    const submitFloor = log(accepted,mark(6,5));
    const submitEnd = log(mark(7,5));
    log(first,mark(9,8));
    log(next,mark(11,10));
    changeTail?.(records, submitEnd);
    records.push({event:'closed',reason:'quit-or-eof'});
    const journal = Buffer.from(records.map((item,index) =>
      JSON.stringify({targetRef,seq:index+1,recordedAt:completedAt,...item})).join('\n'));
    const chain = sealChain([
      {kind:'preflight',readiness:2,installed,baselineLog,start,startFloor,initialLog},
      {kind:'locate',id:'submit-a-ready',layout,beforeLog:locateLog,beforeSeq:2,floorLog:locateFloor,
        afterLog:locateEnd,afterSeq:3,hostBeginMs:0,hostEndMs:1},
      {kind:'action',id:'submit-a',beforeLog:submitLog,beforeSeq:4,command:submitCommand,floorLog:submitFloor,
        afterLog:submitEnd,afterSeq:7,hostBeginMs:1,hostEndMs:2},
    ]);
    verifyChain(chain);
    return sessionContext({
      store:{bytes:ref=>ref===commands ? journal : tree},
      session:{runId:'synthetic-aborted-append',chain,instanceId,result:'INCOMPLETE',commands},sessionRef,candidate,
      contract:{id:'bookshelf.search-append',pageId:'bookshelf',phase:1,version,fixture:{},steps:[
        {kind:'locate',id:'submit-a-ready',anchors:[target]},
        {kind:'action',id:'submit-a',op:'click',from:'submit-a-ready',target,waitFor:[{kind:'search-submit-accepted'}]},
        {kind:'sample',id:'results-a',afterAction:'submit-a',stateWaitMs:60000,anchors:[]},
      ]},
    });
  }
  const tailSeqs = context => context.events.filter(item=>item.eventSeq>7).map(item=>item.eventSeq);
  const intact = replay();
  assert.deepEqual(intact.problems,[]);
  assert.deepEqual(tailSeqs(intact),[8,9,10,11]);
  assert.deepEqual(intact.events.find(item=>item.eventSeq===10).evidenceRefs,[sessionRef,commands]);
  assert.deepEqual(Object.keys(intact.actions),['submit-a']);
  assert.equal(intact.samples['results-a'],undefined);
  assert.deepEqual(tailSeqs(replay({version:4})),[]);
  assert.deepEqual(tailSeqs(replay({settled:false})),[]);

  const gap = replay({changeTail:(records,from)=>{records[from+1].stdout=line(mark(11,10));}});
  assert.deepEqual(tailSeqs(gap),[8,9],'a later sequence gap cannot remove the earlier complete checkpoint or add a later fact');
  const semanticGap = replay({changeTail:(records,from)=>{records[from+1].stdout=[line(next),line(mark(11,8))].join('\n');}});
  assert.deepEqual(tailSeqs(semanticGap),[8,9],'a heartbeat cannot omit the observed semantic update');
  const input = replay({changeTail:(records,from)=>records.splice(from+1,0,
    {event:'command',ok:true,args:['shell','uitest','uiInput','keyEvent','Back']})});
  assert.deepEqual(tailSeqs(input),[8,9],'a new input cannot become part of the unclosed results observation');
  const conflict = replay({changeTail:(records,from)=>{
    records[from+1].stdout += '\n'+line({...first,payload:{...first.payload,nextPage:3}});
  }});
  assert.deepEqual(tailSeqs(conflict),[],'conflicting logs are not evidence for the current case');
});

test('relocates both synthetic receipts and preserves exact assertion sets and page disposition', t => {
  for (const id of [searchId, readingId]) {
    const run = fixture(t, id);
    const { receipt, rootSha256 } = sealReceipt(run, run.contract);
    const moved = join(run.directory, 'relocated-bundle');
    renameSync(run.bundle, moved);
    assert.equal(existsSync(run.bundle), false);
    const result = replay(join(moved, 'receipt.json'), rootSha256, run.contract);
    assert.deepEqual(result.receipt, receipt);
    assert.deepEqual(receipt.assertions.map(item => item.id), run.contract.assertions.map(item => item.id));
    assert.ok(receipt.assertions.every(item => item.verdict === 'NOT_RUN'));
    assert.equal(receipt.page.registration, 'UNREGISTERED_PAGE');
    assert.equal(receipt.execution, 'INCOMPLETE');
    assert.equal(receipt.behavior, 'NOT_RUN');
    for (const platform of ['android', 'ios']) {
      assert.ok(Object.values(receipt.capabilities[platform]).every(item => item.status === 'UNSUPPORTED'));
    }
  }
});

test('historical structure reassessment retains an incomplete receipt without applicable assertions', t => {
  const run = fixture(t, 'reading.control-tts-capsule-handoff-full');
  const {receipt,rootSha256} = sealReceipt(run,run.contract);
  assert.equal(receipt.behavior,'NOT_RUN');
  const obligation = loadStructureDefinition().scenarioObligations.find(item => item.caseId === run.contract.id);
  const assessment = reassessOriginalStructure({
    receiptPath:join(run.bundle,'receipt.json'), expectedRoot:rootSha256,
    historicalDefinition:{caseId:receipt.caseId,caseSha256:receipt.caseSha256,
      states:obligation.states,samples:run.contract.structure},
  });
  assert.equal(assessment.source.rootSha256,rootSha256);
  assert.equal(assessment.execution,'INCOMPLETE');
  assert.equal(assessment.behavior,'NOT_RUN');
  assert.ok(assessment.assertions.every(assertion => assertion.verdict === 'NOT_RUN'));
});

// Offline CLI checks may rehash the exported tool and read the full bundle.
const evidenceCliTimeoutMs = 45_000;

test('resealing preserves the verified Runner files referenced by the original session', t => {
  const run = fixture(t, 'reading.control-grabber-reversal');
  const runner = Object.fromEntries(['manifest','verification','deployment'].map(name =>
    [name,run.store.writeJson(`candidate/runner-${name}.json`,{kind:name,fixture:'synthetic Runner capture'})]));
  const session = {...run.session,runner};
  const sessionRef = run.store.writeJson('session/runner-session.json',session);
  const {receipt,rootSha256} = sealReceipt({...run,session,sessionRef},run.contract);
  assert.equal(receipt.execution,'INCOMPLETE');
  const reseal = output => spawnSync(process.execPath, [
    fileURLToPath(new URL('../reseal.mjs',import.meta.url)),
    '--case',run.contract.id,'--input',join(run.bundle,'receipt.json'),'--expected-root',rootSha256,'--output-dir',output,
  ],{encoding:'utf8',timeout:evidenceCliTimeoutMs});
  const output = join(run.directory,'derived');
  const result = reseal(output);
  assert.ifError(result.error);
  assert.equal(result.status,1);
  assert.equal(result.stderr,'');
  const derived = JSON.parse(result.stdout);
  assert.equal(derived.receipt.execution,'INCOMPLETE');
  const derivedStore = evidenceStore(output);
  assert.deepEqual(derivedStore.json(derived.receipt.session).runner,runner);
  for (const ref of Object.values(runner)) assert.deepEqual(derivedStore.bytes(ref),run.store.bytes(ref));

  appendFileSync(join(run.bundle,runner.verification.path),'changed raw bytes');
  const rejectedOutput = join(run.directory,'rejected');
  const rejected = reseal(rejectedOutput);
  assert.ifError(rejected.error);
  assert.equal(rejected.status,1);
  assert.match(rejected.stderr,/Changed evidence bytes: candidate\/runner-verification\.json/u);
  assert.equal(existsSync(rejectedOutput),false);
});

test('replays legacy and structure-aware synthetic receipts in an exported standalone tool directory', t => {
  const toolDir = join(realpathSync(scratch(t)), 'tool');
  const bundles = realpathSync(scratch(t));
  const cwd = realpathSync(scratch(t));
  const identity = exportReplayTool(toolDir);
  assert.deepEqual(identity, toolIdentity());
  assert.throws(() => exportReplayTool(toolDir), /EEXIST/u);

  const packageDir = join(toolDir, 'tools/ui-contract');
  assert.ok(existsSync(join(toolDir, 'tools/page-structure/model.json')));
  const numberedCopies = ['cli 2.mjs', 'collectors/harmonyos/records 2.mjs', 'collectors/harmonyos/run 2.mjs'];
  assert.ok(numberedCopies.every(file => !existsSync(join(packageDir, file))));
  for (const dependency of ['receipt-conditions', 'receipt-structure', 'structure', 'structure-contract']) {
    assert.ok(existsSync(join(packageDir, 'lib', `${dependency}.mjs`)));
  }
  const permissions = process.allowedNodeEnvironmentFlags.has('--allow-net') ?
    ['--permission', `--allow-fs-read=${toolDir}`, `--allow-fs-read=${bundles}`] : [];
  const env = {...process.env};
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  function cli(name, args) {
    const result = spawnSync(process.execPath, [...permissions, join(packageDir, name), ...args],
      {env, cwd, encoding:'utf8', timeout:evidenceCliTimeoutMs});
    assert.ifError(result.error);
    assert.equal(result.stderr, '');
    assert.equal(result.status, 1);
    return JSON.parse(result.stdout);
  }
  const replays = [searchId, readingId].map(id => {
    const source = fixture(t, id);
    const sealed = sealReceipt(source, source.contract);
    const moved = join(bundles, id);
    renameSync(source.bundle, moved);
    const path = join(moved, 'receipt.json');
    const result = cli('cli.mjs', ['--case', id, '--replay', path, '--expected-root', sealed.rootSha256]);
    assert.deepEqual(result.receipt, sealed.receipt);
    assert.equal(result.rootSha256, sealed.rootSha256);
    return {path, ...result};
  });
  const [search, reading] = replays;
  const coverage = cli('coverage.mjs', ['--search', search.path, '--search-root', search.rootSha256,
    '--reading', reading.path, '--reading-root', reading.rootSha256]);
  assert.equal(coverage.observationStatus, 'INCOMPLETE');
  assert.deepEqual(coverage.cases.map(item => item.rootSha256), replays.map(item => item.rootSha256));
  assert.ok(coverage.cases.every(item => item.page.registration === 'UNREGISTERED_PAGE' &&
    Object.values(item.assertions).every(verdict => verdict === 'NOT_RUN')));

  const currentId = 'bookshelf.search-no-sources';
  const current = fixture(t, currentId);
  const currentSeal = sealReceipt(current, current.contract);
  assert.equal(currentSeal.receipt.structure.observations, 'INCOMPLETE');
  assert.equal(currentSeal.receipt.structure.states.length, Object.keys(current.contract.structure).length);
  const currentBundle = join(bundles, currentId);
  renameSync(current.bundle, currentBundle);
  const currentReplay = cli('cli.mjs', ['--case', currentId, '--replay', join(currentBundle, 'receipt.json'),
    '--expected-root', currentSeal.rootSha256]);
  assert.deepEqual(currentReplay.receipt, currentSeal.receipt);
  const selection = join(bundles,'selection.json');
  writeFileSync(selection,JSON.stringify({groups:[{id:'subset',runs:[{
    case:currentId,receipt:join(currentBundle,'receipt.json'),expectedRoot:currentSeal.rootSha256,
  }]}]}));
  const currentCoverage = cli('coverage.mjs',['--selection',selection]);
  assert.equal(currentCoverage.groups[0].execution,'INCOMPLETE');
  assert.ok(currentCoverage.groups[0].structure.counts.NOT_RUN > 0);
  assert.equal(currentCoverage.candidates[0].execution,'INCOMPLETE');
  assert.equal(currentCoverage.candidates[0].toolSha256, identity.sha256);

  const copiedTool = pathToFileURL(packageDir + '/');
  for (const file of numberedCopies) writeFileSync(join(packageDir, file), 'local Finder copy');
  assert.deepEqual(toolIdentity(copiedTool), identity);
  appendFileSync(join(packageDir, 'cases', `${readingId}.json`), '\n');
  const changedCase = toolIdentity(copiedTool);
  assert.notEqual(changedCase.sha256, identity.sha256);
  appendFileSync(join(toolDir, 'tools/page-structure/model.json'), '\n');
  const changedModel = toolIdentity(copiedTool);
  assert.notEqual(changedModel.sha256, changedCase.sha256);
  appendFileSync(join(packageDir, 'node_modules/fast-deep-equal/index.js'), '\n');
  assert.notEqual(toolIdentity(copiedTool).sha256, changedModel.sha256);
});

test('current acceptance retains necessary structure, full coverage obligations and applicable gaps', () => {
  const auditCase = {
    id:'contract.sample', version:1, phase:1, steps:[{id:'current',kind:'sample'},{id:'later',kind:'sample'}],
    structure:{current:'current',later:'later'},
  };
  const definition = {
    structureRules:[
      {id:'base',requires:[],checks:[{kind:'present',node:'base'}]},
      {id:'top',requires:['base'],checks:[{kind:'present',node:'top'}]},
      {id:'unrelated',requires:[],checks:[{kind:'present',node:'unrelated'}]},
    ],
    structureSelectors:{base:{ids:['base']},top:{ids:['top']},unrelated:{ids:['unused']}},
    scenarioObligations:[{caseId:auditCase.id,states:{current:'top',later:'top'},actions:{current:null,later:null}}],
  };
  const box = {left:0,top:0,width:20,height:20};
  const node = id => ({id,path:`/${id}`,rectPx:box,visibleRectPx:box,visible:true,opacity:1});
  const sample = ids => ({captureComplete:true,window:{source:'window-metrics'},nodes:ids.map(node)});
  const assess = (samples, rules = definition) => assessStructure(auditCase, {samples}, rules);
  const localPass = [{id:'action',verdict:'PASS'}];

  const validSample = sample(['base','top']);
  const structure = assess({current:validSample,later:validSample});
  assert.equal(structure.behavior,'PASS');
  assert.doesNotThrow(() => requireStructureProof({structure},auditCase,definition,['current']));
  const changedUnrelated = structuredClone(definition);
  changedUnrelated.structureSelectors.unrelated.ids = ['renamed'];
  assert.notEqual(assess({},changedUnrelated).definitionSha256,structure.definitionSha256);
  assert.doesNotThrow(() => requireStructureProof({structure},auditCase,changedUnrelated,['current']));
  assert.throws(() => assessStructure({...auditCase,structure:undefined}, {},
    {...definition,scenarioObligations:[]}), /no model obligation/u);
  const demoted = structuredClone(definition);
  demoted.structureRules[1].requires.length = 0;
  assert.throws(() => requireStructureProof({structure},auditCase,demoted,['current']), /necessary structure/u);

  const missing = assess({current:validSample});
  assert.deepEqual(summarizeAcceptance({assertions:localPass,structure:missing,observationsComplete:true}),
    {behavior:'NOT_RUN',execution:'INCOMPLETE',observations:'INCOMPLETE'});
  const failing = assess({current:sample(['top'])});
  assert.equal(failing.states[0].checks[0].ruleId,'base');
  assert.equal(failing.states[0].checks[0].verdict,'FAIL');
  assert.deepEqual(summarizeAcceptance({assertions:localPass,structure:failing,observationsComplete:true}),
    {behavior:'FAIL',execution:'INCOMPLETE',observations:'INCOMPLETE'});
  assert.throws(() => requireStructureProof({structure:failing},auditCase,definition,['current']), /complete structure/u);
  assert.throws(() => requireStructureProof({},auditCase,definition,['current']), /necessary structure/u);
  const invalid = structuredClone(definition);
  invalid.structureRules[0].checks[0].kind = 'invented';
  assert.throws(() => assess({}, invalid), /Unknown structure relationship/u);

  const run = (runId, structure, behavior, observations, contract = auditCase) => ({
    receipt:{caseId:contract.id,caseSha256:jsonDigest(contract),runId,structure,behavior,observations,
      execution:observations === 'COMPLETE' ? behavior : 'INCOMPLETE'},
  });
  const withFailure = run('failed-structure',failing,'FAIL','INCOMPLETE');
  const active = scenarioCoverage([withFailure],definition,[auditCase.id],()=>auditCase);
  const deleted = scenarioCoverage([],definition,[],()=>null);
  assert.equal(active.obligatedStates,2);
  assert.equal(active.observations,'INCOMPLETE');
  assert.equal(active.counts.FAIL,1);
  assert.equal(active.counts.INCOMPLETE,1);
  assert.equal(deleted.obligatedStates,active.obligatedStates);
  assert.equal(deleted.counts.MISSING_DEFINITION,2);
  const report = (runs, model = definition, ids = [auditCase.id], contract = auditCase) =>
    scenarioCoverage(runs,model,ids,()=>contract);
  const successful = run('pass',structure,'PASS','COMPLETE');
  const failedFunction = run('failed-function',structure,'FAIL','COMPLETE');
  const missingFunction = run('missing-function',structure,'NOT_RUN','INCOMPLETE');
  const mixed = report([successful,failedFunction]);
  assert.equal(mixed.structure.behavior,'PASS');
  assert.equal(mixed.scenarios[0].behavior,'FAIL');
  assert.equal(mixed.behavior,'FAIL');
  assert.equal(groupExecution(mixed,[successful.receipt,failedFunction.receipt],true).execution,'FAIL');
  const evidenceGap = report([missingFunction]);
  assert.equal(evidenceGap.structure.observations,'COMPLETE');
  assert.equal(evidenceGap.observations,'INCOMPLETE');
  assert.equal(evidenceGap.behavior,'NOT_RUN');
  const mixedPartials = report([withFailure,successful]);
  assert.equal(mixedPartials.behavior,'FAIL');
  assert.deepEqual(groupExecution(mixedPartials,[withFailure.receipt, successful.receipt],true),
    {observations:'INCOMPLETE',behavior:'FAIL',execution:'INCOMPLETE'});
  assert.equal(report([successful],changedUnrelated).behavior,'PASS');
  const changedBinding = report([successful],demoted);
  assert.equal(changedBinding.behavior,'NOT_RUN');
  assert.deepEqual(changedBinding.scenarios[0].staleRunIds,['pass']);
  assert.deepEqual(report([successful],definition,[auditCase.id],{...auditCase,version:2}).scenarios[0].staleRunIds,['pass']);
  const noObligation = report([successful],definition,[auditCase.id,'another.case']);
  assert.deepEqual(noObligation.missingObligationCaseIds,['another.case']);
  assert.equal(groupExecution(noObligation,[successful.receipt],true).execution,'INCOMPLETE');
  assert.equal(groupExecution(deleted,[successful.receipt],true).execution,'INCOMPLETE');

  const condition = {
    id:'source.load.loading', kind:'observed-load-branch', condition:'verified fixture guard', action:'open',
    sample:'source-ready',expected:{state:'loading',readFacts:['loading']},
  };
  const context = {actions:{open:{instanceId:'instance',beforeSeq:2,afterSeq:4}},samples:{},events:[]};
  assert.equal(conditionApplicability(condition,context,{},{}).status,'UNKNOWN');
  context.events.push({instanceId:'instance',eventSeq:3,kind:'source.projection',channel:'business',
    payload:{state:'loading',readFact:'loading'}});
  assert.equal(conditionApplicability(condition,context,{},{}).status,'APPLIES');
  assert.equal(conditionApplicability(condition,context,{},{}).required,true);
  context.events[0].payload = {state:'empty',readFact:'current'};
  assert.equal(conditionApplicability(condition,context,{},{}).status,'UNKNOWN');
  context.samples['source-ready'] = {instanceId:'instance',beforeSeq:5};
  assert.equal(conditionApplicability(condition,context,{},{}).status,'DOES_NOT_APPLY');
});

test('source recovery coverage uses the accepted action for each shared capture role', () => {
  const definition = loadStructureDefinition();
  const cases = [
    ['source-management.unknown-expand-target','unknown-expand','enable-for-unknown'],
    ['source-management.unknown-recovery-body','recovery-collapsed','enable-for-unknown'],
    ['source-management.unknown-recovery-expand-touch-edge','recovery-collapsed','collapse-recovery'],
  ];
  for (const [caseId,role,actionId] of cases) {
    const contract = loadCase(caseId);
    const obligation = definition.scenarioObligations.find(item => item.caseId === caseId);
    const bindings = resolveStructureBindings(contract,definition);
    const states = bindings.map(({rule,...binding}) => ({
      ...binding,ruleId:rule.id,verdict:'PASS',observationsComplete:true,
    }));
    const shared = states.find(state => state.role === role);
    assert.equal(shared.actionId,actionId,caseId);
    const conditions = Object.fromEntries(states.filter(state => state.conditionId)
      .map(state => [state.conditionId,{status:'APPLIES'}]));
    const aggregate = selectedStates => {
      const run = {receipt:{
        runId:'synthetic-shared-capture',caseId,caseSha256:jsonDigest(contract),
        behavior:'PASS',observations:'COMPLETE',execution:'PASS',conditions,
        structure:{bindingSha256:structureBindingSha256(contract,definition),
          observations:'COMPLETE',behavior:'PASS',states:selectedStates},
      }};
      return scenarioCoverage([run],definition,[caseId],() => contract).scenarios.find(item => item.caseId === caseId);
    };
    const current = aggregate(states);
    assert.deepEqual(current.structure,{observations:'COMPLETE',behavior:'PASS'},caseId);
    assert.equal(current.states.find(state => state.role === role).assessments[0].actionId,actionId,caseId);
    const wrongAction = aggregate(states.map(state => state === shared ? {...state,actionId:obligation.actions[role]} : state));
    assert.deepEqual(wrongAction.structure,{observations:'INCOMPLETE',behavior:'NOT_RUN'},caseId);
    assert.deepEqual(wrongAction.states.find(state => state.role === role).assessments,[],caseId);
  }
});

test('Phase 1 candidate coverage combines only compatible complete scenarios across exact layout groups', () => {
  const first = {id:'example.compact',version:1,phase:1,steps:[{id:'observed',kind:'sample'}],structure:{observed:'observed'},
    assertions:[{id:'check',required:true}]};
  const second = {...first,id:'example.expanded'};
  const conditional = {...first,id:'example.external',assertions:[{id:'check',required:false,condition:'observed fault'}]};
  const cases = [first,second,conditional];
  const definition = {
    structureRules:[{id:'required',requires:[],checks:[{kind:'present',node:'required'}]}],
    structureSelectors:{required:{ids:['required']}},
    scenarioObligations:cases.map(contract => ({caseId:contract.id,states:{observed:'required'},actions:{observed:null}})),
  };
  const box = {left:0,top:0,width:20,height:20};
  const structure = contract => assessStructure(contract,{samples:{observed:{
    captureComplete:true,window:{source:'window-metrics'},
    nodes:[{id:'required',path:'/required',visible:true,opacity:1,visibleRectPx:box}],
  }}},definition);
  const main = {appBuildId:'candidate', appContentHash:'a'.repeat(64), hapSha256:'b'.repeat(64),
    sourceFingerprint:'c'.repeat(64),buildRunId:'build',hdcServer:'127.0.0.1:8710',targetRef,targetKind:'vm'};
  function recorded(contract, id, window, {identity={}, tool='a', status, behavior='PASS'}={}) {
    const measured = window ? {widthPx:window,heightPx:800,density:1,orientation:'portrait',fontScale:1} : null;
    return {rootSha256:jsonDigest(id),receipt:{
      runId:id,caseId:contract.id,caseSha256:jsonDigest(contract),candidate:{identity:{...main,...identity}},
      tool:{sha256:tool.repeat(64)},structure:structure(contract),behavior,
      observations:behavior === 'NOT_RUN' ? 'INCOMPLETE' : 'COMPLETE',
      execution:behavior === 'NOT_RUN' ? 'INCOMPLETE' : behavior,
      measurement:{initialWindowSampleId:'observed',sampleWindows:{observed:measured}},
      ...(status ? {conditions:{check:{status}}} : {}),
    }};
  }
  const report = (compact, expanded, ...conditions) => candidateCoverage([
    {id:'compact',runs:[compact]}, {id:'expanded',runs:[expanded,...conditions]},
  ],definition,cases.map(contract=>contract.id), id=>cases.find(contract=>contract.id===id));
  const compact = recorded(first,'compact',320);
  const otherTarget = {targetRef:'abcdef123456'};
  const expanded = recorded(second,'expanded',650,{identity:otherTarget});
  const [unobserved] = report(compact,expanded);
  assert.equal(unobserved.required.behavior,'PASS');
  assert.equal(unobserved.conditional[0].status,'UNEXERCISED');
  assert.equal(unobserved.execution,'INCOMPLETE');
  assert.deepEqual(unobserved.runs.map(run=>[run.groupId,run.targetRef,run.window.widthPx]),
    [['compact',targetRef,320],['expanded',otherTarget.targetRef,650]]);

  for (const change of [{identity:{hapSha256:'d'.repeat(64)}},{identity:{buildRunId:'other'}},
    {identity:{sourceFingerprint:'d'.repeat(64)}},{identity:{targetKind:'physical'}},{tool:'b'}]) {
    const buckets = report(compact,recorded(second,'expanded',650,change));
    assert.equal(buckets.length,2);
    assert.ok(buckets.every(item=>item.required.observations==='INCOMPLETE'));
  }
  assert.equal(report(compact,recorded(second,'expanded',0))[0].required.observations,'INCOMPLETE');
  assert.equal(report(compact,recorded(second,'expanded',650,{behavior:'NOT_RUN'}))[0].required.observations,'INCOMPLETE');
  const failed = report(compact,recorded(second,'expanded',650,{behavior:'FAIL'}))[0];
  assert.equal(failed.behavior,'FAIL');
  assert.equal(failed.execution,'INCOMPLETE');
  const applied = recorded(conditional,'external',650,{status:'APPLIES'});
  assert.equal(report(compact,expanded,applied)[0].execution,'PASS');
  const inapplicable = recorded(conditional,'external',650,{status:'DOES_NOT_APPLY',behavior:'NOT_RUN'});
  assert.equal(report(compact,expanded,inapplicable)[0].execution,'PASS');
  const withoutFoundation = structuredClone(inapplicable);
  withoutFoundation.receipt.structure = assessStructure(conditional,{samples:{observed:{
    captureComplete:false,window:{source:'window-metrics'},nodes:[],
  }}},definition);
  const absentWithoutFoundation = report(compact,expanded,withoutFoundation)[0];
  assert.equal(absentWithoutFoundation.conditional[0].status,'DOES_NOT_APPLY');
  assert.equal(absentWithoutFoundation.conditional[0].exclusionVerified,false);
  assert.equal(absentWithoutFoundation.coverage.scenarios.find(item => item.caseId === conditional.id).structure.behavior,'NOT_RUN');
  assert.equal(absentWithoutFoundation.execution,'INCOMPLETE');
  const stale = structuredClone(inapplicable);
  stale.receipt.caseSha256 = jsonDigest({...conditional,version:2});
  assert.equal(report(compact,expanded,stale)[0].execution,'INCOMPLETE');
  assert.deepEqual(report(compact,expanded,stale)[0].coverage.scenarios.find(item => item.caseId === conditional.id).staleRunIds,
    ['external']);
  const unknown = recorded(conditional,'unknown',650,{status:'UNKNOWN',behavior:'NOT_RUN'});
  const unresolved = report(compact,expanded,applied,unknown)[0];
  assert.equal(unresolved.conditional[0].status,'UNKNOWN');
  assert.equal(unresolved.execution,'INCOMPLETE');
});

test('Phase 1 mixed coverage cannot use an inapplicable run to replace an applied functional check', () => {
  const caseId = 'example.mixed';
  const contract = { id:caseId, version:1, phase:1, steps:[{id:'result',kind:'sample'}], structure:{result:'result'},
    assertions:[{id:'normal',required:true},{id:'late-a',required:false,condition:'An A completion arrived late'},
      {id:'late-b',required:false,condition:'A B completion arrived late'}],
  };
  const definition = {
    structureRules:[{id:'required',requires:[],checks:[{kind:'present',node:'viewport'}]}],
    structureSelectors:{viewport:{ids:['viewport']}},
    scenarioObligations:[{caseId,states:{result:'required'},actions:{result:null}}],
  };
  const structure = assessStructure(contract,{samples:{result:{captureComplete:true,window:{source:'window-metrics'},
    nodes:[{id:'viewport',path:'/viewport',visible:true,opacity:1,visibleRectPx:{left:0,top:0,width:20,height:20}}],
  }}},definition);
  const identity = {appBuildId:'candidate',appContentHash:'a'.repeat(64),hapSha256:'b'.repeat(64),
    sourceFingerprint:'c'.repeat(64),buildRunId:'build',hdcServer:syntheticServer,targetRef,targetKind:'vm'};
  function record(runId, behavior, a, b = 'DOES_NOT_APPLY') {
    return {rootSha256:jsonDigest(runId),receipt:{
      runId,caseId,caseSha256:jsonDigest(contract),structure,behavior,candidate:{identity},tool:{sha256:'e'.repeat(64)},
      observations:behavior === 'NOT_RUN' ? 'INCOMPLETE' : 'COMPLETE', execution:behavior === 'NOT_RUN' ? 'INCOMPLETE' : behavior,
      conditions:{'late-a':{status:a},'late-b':{status:b}},
      measurement:{initialWindowSampleId:'result',sampleWindows:{result:{widthPx:360,heightPx:800,density:1,orientation:'portrait',fontScale:1}}},
    }};
  }
  const campaign = (...runs) => candidateCoverage([{id:'current',runs}],definition,[caseId],()=>contract)[0];
  const absent = record('no-late-work','PASS','DOES_NOT_APPLY');
  const incomplete = record('seen-a','NOT_RUN','APPLIES');
  const provenA = record('proven-a','PASS','APPLIES');
  const provenB = record('proven-b','PASS','DOES_NOT_APPLY','APPLIES');
  const rejected = record('wrong-a','FAIL','APPLIES');
  assert.equal(campaign(absent).execution,'PASS');
  const report = campaign(absent,incomplete,provenB);
  assert.equal(report.execution,'INCOMPLETE');
  assert.equal(report.coverage.scenarios[0].structure.behavior,'PASS');
  assert.deepEqual(report.coverage.scenarios[0].missingApplicableAssertions,['late-a']);
  const unknownWindow = structuredClone(incomplete);
  delete unknownWindow.receipt.measurement.sampleWindows.result;
  assert.deepEqual(campaign(absent,unknownWindow,provenB).coverage.scenarios[0].missingApplicableAssertions,['late-a']);
  assert.equal(campaign(absent,incomplete,provenA,provenB).execution,'PASS');
  assert.equal(campaign(absent,incomplete,provenA,provenB,rejected).behavior,'FAIL');
});

test('source read conditional structure preserves foundations, exclusions and coverage gaps', () => {
  const current = loadStructureDefinition();
  const sourceCase = loadCase('source-management.read-loading');
  const obligation = current.scenarioObligations.find(item => item.caseId === sourceCase.id);
  const conditionId = obligation.conditions['source-read'];
  const [assertion] = sourceCase.assertions;
  assert.equal(resolveStructureBindings(sourceCase,current)[0].conditionId,conditionId);
  const withoutConditions = {...current,scenarioObligations:[{
    caseId:obligation.caseId,states:obligation.states,actions:obligation.actions,
  }]};
  assert.throws(() => resolveStructureBindings(sourceCase,withoutConditions), /requires a conditional structure role/u);
  assert.throws(() => validateStructureDefinition({...current, layers:[...new Set(current.structureRules.map(rule => rule.layer))]
    .map(id => ({id})),scenarioObligations:[{...obligation,conditions:{unexpected:conditionId}}]}),
  /invalid conditional structure role/u);
  for (const mismatch of [{sample:'initial'},{action:'other-action'},{required:true},{condition:undefined}]) {
    const changed = {...sourceCase,assertions:[{...assertion,...mismatch}]};
    assert.throws(() => resolveStructureBindings(changed,current), /same sample and action/u);
  }

  const source = {...sourceCase,steps:[{id:'open-sources',kind:'action'},
    {id:'source-read',kind:'sample',afterAction:'open-sources'}]};
  const required = {...source,id:'example.required',assertions:[{id:'check',required:true}]};
  const definition = {
    structureRules:[
      {id:'base',requires:[],checks:[{kind:'present',node:'base'}]},
      {id:'leaf',requires:['base'],checks:[{kind:'present',node:'leaf'}]},
    ],
    structureSelectors:{base:{ids:['base']},leaf:{ids:['leaf']}},
    scenarioObligations:[
      {...obligation,states:{'source-read':'leaf'}},
      {caseId:required.id,states:{'source-read':'base'},actions:obligation.actions},
    ],
  };
  const box = {left:0,top:0,width:20,height:20};
  const assess = (ids, conditions, contract = source) => {
    const sample = {captureComplete:true,window:{source:'window-metrics'},instanceId:'current',beforeSeq:4,hostBeginMs:20,
      nodes:ids.map(id => ({id,path:`/${id}`,visible:true,opacity:1,visibleRectPx:box}))};
    return assessStructure(contract,{samples:{'source-read':sample},
      actions:{'open-sources':{instanceId:'current',afterSeq:3,hostEndMs:10}}},definition,{conditions});
  };
  const condition = (status, sampleApplies) => ({[conditionId]:{
    status,required:status !== 'DOES_NOT_APPLY',reason:status,...(sampleApplies === undefined ? {} : {sampleApplies}),
  }});
  const accepted = condition('APPLIES',true);
  const absent = condition('DOES_NOT_APPLY');
  const transient = condition('APPLIES',false);
  const passed = assess(['base','leaf'],accepted);
  assert.equal(passed.behavior,'PASS');
  assert.doesNotThrow(() => requireStructureProof({structure:passed},source,definition,['source-read']));
  assert.equal(assess(['base'],accepted).behavior,'FAIL');
  const excluded = assess(['base'],absent);
  assert.equal(excluded.observations,'COMPLETE');
  assert.deepEqual(excluded.states[0].checks.map(check => check.verdict), ['PASS','NOT_RUN']);
  assert.throws(() => requireStructureProof({structure:excluded},source,definition,['source-read']), /complete structure/u);
  const baseFailure = assess([],absent);
  assert.equal(baseFailure.behavior,'FAIL');
  assert.equal(assess([],transient).behavior,'FAIL');
  for (const conditions of [undefined,condition('UNKNOWN'),transient]) {
    const missing = assess(['base','leaf'],conditions);
    assert.equal(missing.behavior,'NOT_RUN');
    assert.equal(missing.observations,'INCOMPLETE');
    assert.deepEqual(missing.states[0].checks.map(check => check.verdict), ['PASS','NOT_RUN']);
  }

  const identity = {appBuildId:'candidate',appContentHash:'a'.repeat(64),hapSha256:'b'.repeat(64),
    sourceFingerprint:'c'.repeat(64),buildRunId:'build',hdcServer:syntheticServer,targetRef,targetKind:'vm'};
  function run(runId,structure,conditions,contract = source) {
    const excluded = conditions?.[conditionId]?.status === 'DOES_NOT_APPLY';
    const outcome = summarizeAcceptance({assertions:[],structure,observationsComplete:true,excluded});
    return {rootSha256:jsonDigest(runId),receipt:{
      runId,caseId:contract.id,caseSha256:jsonDigest(contract),structure,conditions,...outcome,
      candidate:{identity},tool:{sha256:'e'.repeat(64)},
      measurement:{initialWindowSampleId:'source-read',sampleWindows:{'source-read':{
        widthPx:360,heightPx:800,density:1,orientation:'portrait',fontScale:1,
      }}},
    }};
  }
  const foundation = run('required',assess(['base'],undefined,required),undefined,required);
  const absentRun = run('absent',excluded,absent);
  const activeRun = run('active',passed,accepted);
  const transientRun = run('transient',assess(['base','leaf'],transient),transient);
  const cases = [source,required];
  const campaign = (...runs) => candidateCoverage([{id:'default',runs:[foundation,...runs]}],definition,
    cases.map(contract => contract.id),id => cases.find(contract => contract.id === id))[0];
  assert.equal(campaign().execution,'INCOMPLETE');
  assert.equal(campaign(absentRun).execution,'PASS');
  assert.equal(campaign(absentRun).coverage.counts.DOES_NOT_APPLY,1);
  assert.equal(campaign(absentRun).coverage.scenarios[0].behavior,'NOT_RUN');
  assert.equal(campaign(absentRun,activeRun).execution,'PASS');
  assert.equal(campaign(absentRun,transientRun).observations,'INCOMPLETE');
  assert.equal(campaign(absentRun,transientRun).coverage.counts.INCOMPLETE,1);
  assert.equal(campaign(run('failed-foundation',baseFailure,absent)).behavior,'FAIL');
  assert.equal(campaign(run('missing-foundation',assess(['base'],absent,{...source}),absent,
    {...source,version:source.version + 1})).execution,'INCOMPLETE');
});

test('combines distinct runs for the same candidate and exact target, rejecting mismatched identities', t => {
  function seal(run) {
    const { rootSha256 } = sealReceipt(run, run.contract);
    return { path: join(run.bundle, 'receipt.json'), rootSha256 };
  }

  const search = seal(fixture(t));
  const localReading = seal(fixture(t, readingId));
  const remoteReading = seal(fixture(t, readingId, ({ deployment, publicFixture }) => {
    deployment.hdcServer = '192.168.1.10:8710';
    publicFixture.hdcServer = deployment.hdcServer;
  }));

  function cover(reading) {
    return spawnSync(process.execPath, [fileURLToPath(new URL('../coverage.mjs', import.meta.url)),
      '--search', search.path, '--search-root', search.rootSha256,
      '--reading', reading.path, '--reading-root', reading.rootSha256],
    { encoding: 'utf8', timeout: evidenceCliTimeoutMs });
  }

  const sameServer = cover(localReading);
  assert.ifError(sameServer.error);
  assert.equal(sameServer.stderr, '');
  assert.equal(sameServer.status, 1);
  const report = JSON.parse(sameServer.stdout);
  assert.equal(report.observationStatus, 'INCOMPLETE');
  assert.equal(report.cases.length, 2);
  assert.notEqual(report.cases[0].runId, report.cases[1].runId);
  assert.deepEqual(report.cases[0].candidate, report.cases[1].candidate);
  assert.ok(report.cases.every(item => item.candidate.targetRef === targetRef &&
    item.candidate.hdcServer === syntheticServer && item.candidate.targetKind === 'vm'));

  const otherServer = cover(remoteReading);
  assert.ifError(otherServer.error);
  assert.equal(otherServer.status, 1);
  assert.equal(otherServer.stdout, '');
  assert.match(JSON.parse(otherServer.stderr).reason, /same HDC server and target/u);

  const differentCandidates = [
    ({ manifest, deployment }) => {
      manifest.artifacts[0].sha256 = deployment.artifact.sha256 = 'f'.repeat(64);
    },
    ({ manifest, deployment }) => {
      const hash = manifest.expectedVersion.contentId + 'f'.repeat(52);
      manifest.expectedVersion.appContentHash = deployment.postInstall.appVersion.appContentHash = hash;
    },
    ({ manifest, snapshot, contract }) => {
      snapshot.files.find(file => !contract.ownerSources.includes(file.path)).sha256 = 'f'.repeat(64);
      manifest.source.buildInputs.fingerprint = snapshot.fingerprint = snapshotFingerprint(snapshot.files);
    },
    ({ manifest, deployment }) => {
      manifest.runId = deployment.runId = 'another-synthetic-build';
    },
  ];
  for (const mutate of differentCandidates) {
    const otherCandidate = cover(seal(fixture(t, readingId, mutate)));
    assert.ifError(otherCandidate.error);
    assert.equal(otherCandidate.status, 1);
    assert.equal(otherCandidate.stdout, '');
    assert.match(JSON.parse(otherCandidate.stderr).reason, /same candidate build, signed HAP and source snapshot/u);
  }
});

test('rejects a substituted case, altered receipt root and omitted assertion even with a new root', t => {
  const run = fixture(t);
  const { receipt, rootSha256 } = sealReceipt(run, run.contract);
  const receiptPath = join(run.bundle, 'receipt.json');
  assert.throws(() => replay(receiptPath, rootSha256, loadCase(readingId)), /case or trusted tool version mismatch/);
  const shortened = { ...receipt, assertions: receipt.assertions.slice(1) };
  const alteredBytes = jsonBytes(shortened);
  writeFileSync(receiptPath, alteredBytes);
  assert.throws(() => replay(receiptPath, rootSha256, run.contract), /sealed handoff root/);
  assert.throws(() => replay(receiptPath, sha256(alteredBytes), run.contract), /independently recomputed assertions/);
});

test('rejects substituted signed HAP metadata, installed identities and scoped target evidence', t => {
  const wrongHap = fixture(t, searchId, ({ deployment }) => {
    deployment.artifact.sha256 = 'f'.repeat(64);
  });
  assert.throws(() => loadCandidate(wrongHap.store, wrongHap.refs, wrongHap.contract), /does not bind the signed Reader candidate/);
  const wrongApp = fixture(t, searchId, ({ deployment }) => {
    deployment.postInstall.appVersion = appBuild('f');
  });
  assert.throws(() => loadCandidate(wrongApp.store, wrongApp.refs, wrongApp.contract), /does not match the expected app version/);
  const wrongTarget = fixture(t, searchId, ({ deployment }) => {
    deployment.targetRef = '000000000001';
  });
  assert.throws(() => sealReceipt(wrongTarget, wrongTarget.contract), /scope-matched isolated public fixture/);
});

test('online sweep admission is explicit and limited to a search fixture', t => {
  const search = fixture(t, searchId, ({publicFixture}) => {
    publicFixture.captureAfterOnlineSweep = true;
  });
  assert.equal(sealReceipt(search, search.contract).receipt.execution, 'INCOMPLETE');
  for (const [id, setting] of [[searchId, 'true'], [readingId, true]]) {
    const wrong = fixture(t, id, ({publicFixture}) => { publicFixture.captureAfterOnlineSweep = setting; });
    assert.throws(() => sealReceipt(wrong, wrong.contract), /No scope-matched isolated public fixture/);
  }
});

test('public fixture scope binds the exact case to a fresh replayed app checkpoint', t => {
  const id = 'bookshelf.search-empty-bookshelf-entry';
  const instanceId = '70100000-1100-4000-8000-000000000007';
  function scopedReceipt(claimed, observed) {
    const run = fixture(t, id, ({publicFixture}) => {
      if (claimed !== undefined) publicFixture.publicFixtureScope = claimed;
    });
    const log = stdout => ({event:'command',ok:true,args:logCommand,stdout});
    const checkpointEvent = {instanceId,eventSeq:1,semanticSeq:0,deviceMonoMs:1,windowRevision:1,
      kind:'window-stable',channel:'probe',payload:observed === undefined ? {} : {publicFixtureScope:observed}};
    const records = [{event:'ready'},
      {event:'readiness',status:'PASS',exactConnected:true,bootCompleted:true,sceneBoardStable:true,
        targetKind:'vm',emulatorLog:{bootMarker:true,instabilityAfterMarker:false},hdcServer:syntheticServer},
      {event:'command',ok:true,args:installedCommand,installed:run.store.json(run.refs.deployment).postInstall},
      log(''),{event:'command',ok:true,args:startCommand},log(''),
      log(`I A05244/ReaderUIContract: RUI1 ${instanceId}/1/0/1 ${JSON.stringify(checkpointEvent)}`),
      {event:'closed',reason:'quit-or-eof'}];
    const commands = run.store.write('session/scoped-commands.ndjson', records.map((record,index) =>
      JSON.stringify({targetRef,seq:index+1,recordedAt:completedAt,...record})).join('\n'));
    const chain = sealChain([{kind:'preflight',readiness:2,installed:3,baselineLog:4,start:5,startFloor:6,initialLog:7}]);
    const session = {...run.session,commands,chain,instanceId};
    const sessionRef = run.store.writeJson('session/scoped-session.json',session);
    return sealReceipt({...run,session,sessionRef}, run.contract).receipt;
  }
  const mismatch = /active app checkpoint does not match the admitted public fixture scope/u;
  for (const [claimed,observed] of [['empty-shelf','empty-shelf'],[undefined,undefined]]) {
    assert.doesNotMatch(JSON.stringify(scopedReceipt(claimed,observed).diagnostics),mismatch);
  }
  for (const [claimed,observed] of [['empty-shelf',undefined],[undefined,'empty-shelf'],['empty-shelf','empty-sources']]) {
    assert.match(JSON.stringify(scopedReceipt(claimed,observed).diagnostics),mismatch);
  }
  assert.throws(() => scopedReceipt('empty-sources','empty-sources'), /scope is unavailable for the selected case/u);
});

test('requires candidate source fingerprint and the deployed digest of each owner', t => {
  const wrongSnapshot = fixture(t, searchId, ({ snapshot }) => {
    snapshot.files[0].sha256 = 'f'.repeat(64);
  });
  assert.throws(() => loadCandidate(wrongSnapshot.store, wrongSnapshot.refs, wrongSnapshot.contract), /Source snapshot differs/);
  const wrongOwner = fixture(t, searchId, ({ contract, ownerSources, store }) => {
    ownerSources[contract.ownerSources[0]] = store.write('candidate/substitute-owner', 'Synthetic substitution');
  });
  assert.throws(() => loadCandidate(wrongOwner.store, wrongOwner.refs, wrongOwner.contract), /owner not included in deployed source/);
});

test('native capture binds the selected successful primitive, transfer, byte count and digest', () => {
  const bytes = Buffer.from('Synthetic raw capture');
  const reference = { path: 'raw/reader-control-synthetic.json', bytes: bytes.length, sha256: sha256(bytes) };
  const remote = '/data/local/tmp/reader-control-synthetic.json';
  const local = '/synthetic/bundle/raw/reader-control-synthetic.json';
  const commands = [
    { event: 'ready' },
    { event: 'command', ok: true, args: ['shell', 'uitest', 'dumpLayout', '-p', remote] },
    { event: 'command', ok: true, args: ['file', 'recv', remote, local] },
    { event: 'capture-integrity', path: local, bytes: bytes.length, sha256: reference.sha256 },
  ];
  assert.deepEqual(captureRecord(commands, reference, bytes, 'dumpLayout'), { bytes, entry: 3, capture: 1 });
  assert.throws(() => captureRecord(commands, reference, bytes, 'screenCap'), /No successful native|one successful native/);
  assert.throws(() => captureRecord(commands, reference, Buffer.from('modified'), 'dumpLayout'), /matching device capture/);
  const changed = structuredClone(commands);
  changed[2].args[3] = '/synthetic/different-local.json';
  assert.throws(() => captureRecord(changed, reference, bytes, 'dumpLayout'), /No matching native readback/);
});

test('app log parser rejects incomplete and mixed-instance checkpoints', () => {
  const instanceId = '11111111-1111-4111-8111-111111111111';
  const foreignInstance = '22222222-2222-4222-8222-222222222222';
  const make = (id, seq) => ({ instanceId: id, eventSeq: seq, semanticSeq: 0, deviceMonoMs: seq,
    windowRevision: 8, kind: 'window-stable', channel: 'probe', payload: {} });
  function chunks(id, seq) {
    const json = JSON.stringify(make(id, seq));
    return [json.slice(0, 40), json.slice(40)].map((part, index) =>
      `11-19 06:00:00.000 123 456 I A05244/ReaderUIContract: RUI1 ${id}/${seq}/${index}/2 ${part}`);
  }
  const log = lines => ({ event: 'command', ok: true, args: logCommand, stdout: lines.join('\n') });
  const [first, second] = chunks(instanceId, 3);
  assert.deepEqual(readProbeEvents(log([first, second])), [make(instanceId, 3)]);
  assert.deepEqual(readProbeEvents(log([first])), []);
  assert.deepEqual(readProbeEvents(log([first, first, second])), []);
  assert.throws(() => checkpoint(log([first, second, ...chunks(foreignInstance, 1)]), instanceId), /instance changed/);
});

test('a new result publication breaks a quiet native capture window even when the revision is unchanged', () => {
  const baseline = {kind:'window-stable', instanceId:'test', eventSeq:120, semanticSeq:119, deviceMonoMs:11000,
    windowRevision:3, payload:{windowId:'45', orientation:'portrait', report:{metrics:{revision:3}}}};
  const later = {...baseline, eventSeq:126, deviceMonoMs:12601};
  assert.equal(windowStable(baseline, later), true);
  assert.equal(windowStable(baseline, {...later, semanticSeq:125}), false);
  assert.equal(windowStable(baseline, baseline), false);
});

test('reconciles log polls when events roll out of the final snapshot', () => {
  const instanceId = '11111111-1111-4111-8111-111111111111';
  const foreignId = '22222222-2222-4222-8222-222222222222';
  const mark = (eventSeq, id = instanceId) => ({ instanceId: id, eventSeq, semanticSeq: 0,
    deviceMonoMs: eventSeq, windowRevision: 8, kind: 'window-stable', channel: 'probe', payload: {} });
  const log = (...events) => ({ event: 'command', ok: true, args: logCommand, stdout: events.map(event =>
    `11-19 06:00:00.000 123 456 I A05244/ReaderUIContract: RUI1 ${event.instanceId}/${event.eventSeq}/0/1 ${JSON.stringify(event)}`
  ).join('\n') });

  const first = log(mark(2), mark(3));
  const last = log(mark(4), mark(5), mark(3, foreignId));
  const canonical = {...mark(3),payload:{state:{width:1280,height:2832},offset:0}};
  const reordered = {...canonical,payload:{offset:0,state:{height:2832,width:1280}}};
  const signedZero = log(reordered);
  signedZero.stdout = signedZero.stdout.replace('"offset":0','"offset":-0');
  const overflow = log(canonical);
  overflow.stdout = overflow.stdout.replace('"offset":0','"offset":1e999');

  for (const readRange of [probeEventsInRange,readLivePriorEvents]) {
    assert.deepEqual(readRange([first, last], instanceId, 2, 4), [mark(3), mark(4)]);
    assert.deepEqual(readRange([first, log(mark(3), mark(4)), last], instanceId, 2, 4), [mark(3), mark(4)]);
    assert.deepEqual(readRange([last], instanceId, 2, 4), [mark(4)]);
    assert.deepEqual(readRange([log(canonical), log(reordered), signedZero, last], instanceId, 2, 4),
      [canonical, mark(4)]);
    assert.throws(() => readRange([first, log({...mark(3), windowRevision: 9}), last], instanceId, 2, 4),
      /Conflicting app event across probe log polls/);
    assert.throws(() => readRange([overflow, overflow, last], instanceId, 2, 4),
      /App identity inputs must be plain JSON values/);
  }
});

test('preserves reading owner and samples only around a bound incomplete motion block', () => {
  const instanceId = '11111111-1111-4111-8111-111111111111';
  const state = { heldPointerId: -1, transition: '', level: 'hidden', targetLevel: 'hidden' };
  const identity = { readingId: 'synthetic-reading', transitionId: 'synthetic-open', direction: 'open', epoch: 1 };
  const rect = { left: 0, top: 0, width: 100, height: 200 };
  const metrics = { ready: true, revision: 1, densityPixels: 1, windowRect: rect, globalRect: rect };
  const event = (eventSeq, kind, channel, payload, semanticSeq = eventSeq) =>
    ({ instanceId, eventSeq, semanticSeq, deviceMonoMs: eventSeq, windowRevision: 1, kind, channel, payload });
  const mark = (seq, semanticSeq) => event(seq, 'window-stable', 'probe',
    { windowId: '7', orientation: 'portrait', report: { metrics, vpPixels: 1 } }, semanticSeq);
  const block = (index, owner = identity) => event(9 + index, 'reading.control-motion', 'motion',
    { ...owner, blockIndex: index, blockCount: 3, frameStart: index, frameEnd: index,
      endReason: 'completed', droppedSamples: 0, frames: [{ index }] });
  const line = (e, index, count, value) =>
    `I A05244/ReaderUIContract: RUI1 ${e.instanceId}/${e.eventSeq}/${index}/${count} ${value}`;
  const full = e => line(e, 0, 1, JSON.stringify(e));
  const partial = e => line(e, 0, 2, JSON.stringify(e).split('[{"index"')[0] + '[');
  const installed = {
    bundlePresent: true,
    bundleName: 'io.reader.minliny',
    appVersion: appBuild('a'),
    cpuAbi: 'x86_64',
    appProvisionType: 'debug',
    appIdSha256: 'c'.repeat(64),
    appIdentifierSha256: 'd'.repeat(64),
    updateTime: 1795068000000,
  };
  const candidate = { targetRef, completedAt, expectedVersion: installed.appVersion, postInstall: installed,
    targetKind: 'vm', hdcServer: syntheticServer };
  const bounds = '[0,0][100,200]';
  const attributes = { bounds, origBounds: bounds, hostWindowId: '7', visible: 'true',
    opacity: '1', enabled: 'true', clickable: 'true' };
  const tree = Buffer.from(JSON.stringify({ attributes: { bounds }, children: [{
    attributes: { ...attributes, bundleName: 'io.reader.minliny', abilityName: 'EntryAbility', pagePath: 'pages/Index', type: 'root' },
    children: [{ attributes: { ...attributes, id: 'synthetic-target' }, children: [] }],
  }] }));
  const remote = '/data/local/tmp/reader-control-synthetic.json';
  const local = '/synthetic/raw/reader-control-synthetic.json';
  const layout = { path: 'raw/reader-control-synthetic.json', bytes: tree.length, sha256: sha256(tree) };
  const commands = { path: 'session/journal.jsonl' };
  function replay(middle, caseId = readingId) {
    const records = [{ event: 'ready' }, { event: 'readiness', status: 'PASS', exactConnected: true, bootCompleted: true,
      sceneBoardStable: true, targetKind: 'vm', emulatorLog: { bootMarker: true, instabilityAfterMarker: false }, hdcServer: syntheticServer }];
    const chain = [];
    const steps = [];
    const command = (args, extra) => records.push({ event: 'command', ok: true, args, ...extra });
    const log = (...lines) => command(logCommand, { stdout: lines.join('\n') });
    const installedSeq = command(installedCommand, { installed });
    const baselineLog = log();
    const start = command(startCommand);
    const startFloor = log();
    const initialLog = log(full(mark(1, 0)));
    chain.push({ entry: { kind: 'preflight', readiness: 2, installed: installedSeq, baselineLog, start, startFloor, initialLog } });
    function step(kind, id, before, after, items, from) {
      const beforeLog = log(full(before));
      const hostBeginMs = beforeLog;
      const entry = { id, kind, beforeLog, beforeSeq: before.eventSeq, hostBeginMs };
      if (kind === 'action') {
        steps.push({ id, kind, from, target: 'synthetic-target', op: 'click' });
        entry.command = command(['shell', 'uitest', 'uiInput', 'click', '50', '100']);
      } else {
        steps.push({ id, kind, anchors: ['synthetic-target'] });
        command(['shell', 'uitest', 'dumpLayout', '-p', remote]);
        command(['file', 'recv', remote, local]);
        records.push({ event: 'capture-integrity', path: local, bytes: layout.bytes, sha256: layout.sha256 });
        entry.layout = layout;
      }
      const floorLog = log(full(before));
      const afterLog = log(...items, full(after));
      chain.push({ entry: { ...entry, floorLog, afterLog, afterSeq: after.eventSeq, hostEndMs: afterLog } });
    }
    step('locate', 'reading-book-entry', mark(2, 0), mark(3, 0), []);
    const ready = event(4, 'reading.ready', 'business', { state, localBook: true, reduceMotion: false });
    step('action', 'enter-reading', mark(3, 0), mark(5, 4), [full(ready)], 'reading-book-entry');
    step('locate', 'reading-before', mark(5, 4), mark(6, 4), []);
    const request = event(7, 'reading.control-requested', 'business', { ...identity, accepted: { epoch: 1 } });
    const commit = event(8, 'reading.control-committed', 'business', { ...identity, state: { epoch: 1 } });
    step('action', 'open', mark(6, 4), mark(12, 11),
      [full(request), full(commit), full(block(0)), ...middle, full(block(2))], 'reading-before');
    step('locate', 'control-open', mark(12, 11), mark(13, 11), []);
    chain.push({ entry: { kind: 'postflight', installed: command(installedCommand, { installed }) } });
    records.push({ event: 'closed', reason: 'quit-or-eof' });
    const journal = Buffer.from(records.map((item, index) =>
      JSON.stringify({ targetRef, seq: index + 1, recordedAt: completedAt, ...item })).join('\n'));
    return sessionContext({ store: { bytes: ref => ref === commands ? journal : tree },
      session: { chain, instanceId, result: 'COMPLETED', commands }, sessionRef: { path: 'session/session.json' },
      candidate, contract: { id: caseId, steps, fixture: {} } });
  }
  const preserved = replay([partial(block(1))]);
  assert.ok(preserved.actions.open);
  assert.ok(preserved.samples['control-open']);
  assert.ok(preserved.events.some(e => e.kind === 'reading.control-committed'));
  assert.ok(!preserved.events.some(e => e.eventSeq === 10));
  assert.deepEqual(preserved.problems, ['open: Incomplete motion block 2/3 (app event 10, 1/2 Hilog fragments)']);
  const controls = [replay([]), replay([partial(block(1, { ...identity, transitionId: 'foreign' }))]),
    replay([partial(block(1)), partial(block(1, { ...identity, transitionId: 'foreign' }))]), replay([partial(block(1))], searchId)];
  for (const rejected of controls) {
    assert.equal(rejected.actions.open, undefined);
    assert.equal(rejected.samples['control-open'], undefined);
    assert.match(rejected.problems[0], /Missing or out-of-order app event/u);
  }
});
