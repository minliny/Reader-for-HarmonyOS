import assert from 'node:assert/strict';
import { createHash, X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  READER_BUNDLE, READER_SIGNER, RUNNER_MODULE, matchesInstalledRunner, parseReversalRequest, reversalPoints,
} from '../collectors/harmonyos/pointer-matrix-runner/entry/src/ohosTest/ets/testrunner/ReversalPlan.ts';
import { selectedProductionMethods } from '../../lib/selected-production-methods.mjs';

const now = 1800000000000;
const runId = 'be120ec6-08d5-4330-a576-83d46fcb67cc';
const baseline = 'c'.repeat(64);
const runnerBundle = 'io.reader.minliny.fixture';
const fields = [runId, 'dry', '0.2.0.DEV.123456789abc', '1000000', String(now - 1), String(now + 1000),
  baseline, '160', '670', '232', '698', '196', '274', runnerBundle];
const window = { left: 0, top: 0, right: 390, bottom: 840 };
const stage = { left: 0, top: 52, right: 390, bottom: 800 };

test('one frozen Reader run plans one bounded up-then-down interior path', () => {
  const request = parseReversalRequest(fields.join(','), now);
  assert.ok(request);
  const points = reversalPoints(request, window, stage, request.quick);
  assert.ok(points);
  assert.equal(request.mode, 'dry');
  assert.deepEqual(points[0], { x: 196, y: 684 });
  assert.ok(points.length <= 63);
  const up = points.findIndex((point, index) => index > 0 && point.y > points[index - 1].y);
  assert.ok(up > 1 && up < points.length - 1);
  assert.ok(points.slice(up).every((point, offset) => point.y > points[up + offset - 1].y));
  assert.ok(points.every(point => point.x === 196 && point.y >= stage.top && point.y < stage.bottom));
  assert.ok(points.slice(1).every((point, i) => Math.abs(point.y - points[i].y) >= 10 &&
    Math.abs(point.y - points[i].y) <= 80));
  const travel = points[0].y - request.full.y;
  assert.ok(points[up - 1].y > request.full.y);
  assert.ok(points.at(-1).y < points[0].y - travel / 2);

  for (const [index, value] of [[0,'reused'], [1,'anything'], [2,'invalid#value'], [3,'1e6'],
    [5,String(now)], [5,String(now + 120001)], [6,'missing'], [7,'-1'], [13,READER_BUNDLE], [13,'x;another']]) {
    const invalid = fields.slice();
    invalid[index] = value;
    assert.equal(parseReversalRequest(invalid.join(','), now), undefined);
  }
  assert.equal(reversalPoints(request, window, stage, { ...request.quick, top: request.quick.top + 1 }), undefined);
  assert.equal(reversalPoints({ ...request, full: { x: 210, y: 274 } }, window, stage, request.quick), undefined);
  assert.equal(reversalPoints({ ...request, full: { x: 196, y: 10 } }, window, stage, request.quick), undefined);
  assert.equal(reversalPoints(request, { ...window, bottom: 780 }, stage, request.quick), undefined);

  const installed = { name: runnerBundle, versionName: request.versionName, versionCode: request.versionCode,
    updateTime: request.updateTime, fingerprint: READER_SIGNER.toUpperCase().match(/../g).join(':') };
  assert.equal(matchesInstalledRunner(request, installed), true);
  for (const changed of [
    { name: 'io.reader.other' }, { fingerprint: 'd'.repeat(64) }, { versionCode: 42 }, { updateTime: now },
  ]) assert.equal(matchesInstalledRunner(request, { ...installed, ...changed }), false);
});

test('the TestKit Runner rejects Reader as the test command bundle before dispatch', async () => {
  const receiptPrefix = 'READER_GRABBER_REVERSAL_RECEIPT ';
  const runnerPath = new URL('../collectors/harmonyos/pointer-matrix-runner/entry/src/ohosTest/ets/testrunner/ReaderGrabberReversalRunner.ets',
    import.meta.url);
  const printed = [];
  const finished = [];
  const dispatches = [];
  let args = {bundleName:READER_BUNDLE,parameters:{'-m':RUNNER_MODULE,'-s readerReversal':fields.join(',')}};
  const Runner = selectedProductionMethods(runnerPath, 'ReaderGrabberReversalRunner', ['onRun'], {
    abilityDelegatorRegistry:{getArguments:()=>args,getAbilityDelegator:()=>({
      printSync:message => printed.push(message),
      finishTest:(state,code) => finished.push({state,code}),
    })},
    parseReversalRequest, RUNNER_MODULE, receiptPrefix,
    Date:{now:()=>now},
    newReceipt:request => ({runId:request?.runId,runnerBundle:request?.runnerBundle,state:'REJECTED',reason:'invalid-request'}),
    runReaderGrabberReversal:async request => {
      dispatches.push(request);
      return {runId:request.runId,runnerBundle:request.runnerBundle,state:'DRY_READY',reason:''};
    },
  });
  const invoke = async () => {
    await new Runner().onRun();
    assert.ok(printed.at(-1).startsWith(receiptPrefix));
    return JSON.parse(printed.at(-1).slice(receiptPrefix.length));
  };
  assert.equal((await invoke()).reason,'runner-invocation-mismatch');
  args = {...args,bundleName:runnerBundle,parameters:{...args.parameters,'-m':'entry'}};
  assert.equal((await invoke()).reason,'runner-invocation-mismatch');
  args = {...args,parameters:{...args.parameters,'-m':RUNNER_MODULE}};
  assert.equal((await invoke()).state,'DRY_READY');
  assert.equal(dispatches.length,1);
  assert.equal(dispatches[0].runnerBundle,runnerBundle);
  assert.equal(dispatches[0].mode,'dry');
  assert.deepEqual(finished,[{state:'REJECTED',code:1},{state:'REJECTED',code:1},{state:'DRY_READY',code:0}]);
});

test('independent Runner packaging checks its exact module and bundle-scoped Profile identity', async () => {
  const { profileIdentity, runnerModuleIdentity, verifyRunnerArtifact } = await import('../../../scripts/hap-pipeline.mjs');
  const otherDefinition = fileURLToPath(new URL('../cases/reading.control-grabber-reversal.json',import.meta.url));
  const otherDigest = createHash('sha256').update(readFileSync(otherDefinition)).digest('hex');
  assert.throws(() => verifyRunnerArtifact(otherDefinition,'0'.repeat(64)),/independent SHA-256/);
  assert.throws(() => verifyRunnerArtifact(otherDefinition,otherDigest),/Invalid independent Runner artifact manifest/);
  const expectedVersion = {versionName:'0.1.0',versionCode:1};
  const moduleJson = {app:{bundleName:runnerBundle,...expectedVersion},module:{name:RUNNER_MODULE,type:'feature'}};
  assert.deepEqual(runnerModuleIdentity(moduleJson,runnerBundle,expectedVersion),
    {bundleName:runnerBundle,moduleName:RUNNER_MODULE,expectedVersion});
  assert.throws(() => runnerModuleIdentity({...moduleJson,app:{bundleName:READER_BUNDLE,...expectedVersion}},
    READER_BUNDLE,expectedVersion),/selected independent Runner/);
  assert.throws(() => runnerModuleIdentity({...moduleJson,module:{name:'entry',type:'entry'}},runnerBundle,expectedVersion),
    /selected independent Runner/);
  assert.throws(() => runnerModuleIdentity(moduleJson,runnerBundle,{...expectedVersion,versionCode:2}),/pinned manifest/);
  const unencodableVersion = {...expectedVersion,versionName:'0.1.0_preview'};
  assert.throws(() => runnerModuleIdentity({...moduleJson,app:{bundleName:runnerBundle,...unencodableVersion}},
    runnerBundle,unencodableVersion),/Runner request/);

  const { readSigningAuthority } = await import('../../reader-signing-authority.mjs');
  const {certificateSha256} = readSigningAuthority();
  const bytes = readFileSync(join(homedir(),'.codex/harmony-signing/certificate.cer'));
  const chain = bytes.toString('utf8').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gu) ?? [bytes];
  const leaves = chain.map(pem => new X509Certificate(pem)).filter(cert => !cert.ca &&
    cert.fingerprint256.replaceAll(':','').toLowerCase() === certificateSha256);
  assert.equal(leaves.length,1);
  const [cert] = leaves;
  const profile = bundle => ({'bundle-info':{'bundle-name':bundle,'development-certificate':cert.toString(),
    'app-identifier':'public-test-profile-identifier'}});
  const reader = profileIdentity(profile(READER_BUNDLE));
  const runner = profileIdentity(profile(runnerBundle),runnerBundle);
  assert.equal(runner.certificateSha256,READER_SIGNER);
  assert.equal(reader.certificateSha256,runner.certificateSha256);
  assert.notEqual(reader.appIdSha256,runner.appIdSha256);
  assert.equal(runner.appIdentifierSha256,createHash('sha256').update('public-test-profile-identifier').digest('hex'));
  assert.equal(Object.keys(runner).length,3);
  assert.throws(() => profileIdentity(profile(READER_BUNDLE),runnerBundle),/Profile bundle identity mismatch/);
  assert.throws(() => profileIdentity(profile(runnerBundle)),/Profile bundle identity mismatch/);
});

test('independent Runner install preserves data and binds a fresh exact readback', async () => {
  const {installVerifiedRunner} = await import('../../../scripts/hap-pipeline.mjs');
  const {readReversalReplayArtifact} = await import('../collectors/harmonyos/reversal-dispatch.mjs');
  const sha = value => createHash('sha256').update(value).digest('hex');
  const target = 'scoped-runner-fixture';
  const artifactPath = '/fixture/scoped-runner.hap';
  const expectedVersion = {versionName:'0.2.0',versionCode:1000000};
  const appId = 'public-runner-fixture-app-id';
  const appIdentifier = 'public-runner-fixture-app-identifier';
  const signature = {bundleName:runnerBundle,status:'signed',verified:true,profileType:'debug',
    certificateSha256:READER_SIGNER,appIdSha256:sha(appId),appIdentifierSha256:sha(appIdentifier)};
  const manifest = {schema:'reader-ui-contract-runner-artifact-manifest-v1',bundleName:runnerBundle,
    expectedVersion,artifact:{path:'scoped-runner.hap',sha256:'f'.repeat(64),bytes:123}};
  const json = value => `${JSON.stringify(value)}\n`;
  const verification = {schema:'reader-ui-contract-runner-artifact-verification-v1',
    verification:'PASS',bundleName:runnerBundle,moduleName:RUNNER_MODULE,expectedVersion,signature,
    manifestSha256:sha(json(manifest)),hapSha256:manifest.artifact.sha256,bytes:manifest.artifact.bytes};
  const hdcRoute = {serverKey:'192.168.1.10:8710',vmLocation:'remote'};
  const dump = ['-t',target,'shell','bm','dump','-n',runnerBundle];
  const install = ['-t',target,'install','-r',artifactPath];
  const uid = 200123;
  const rawReadback = (updateTime, {profileId = appIdentifier, observedUid = uid} = {}) =>
    `${runnerBundle}:\n${JSON.stringify({name:runnerBundle,...expectedVersion,updateTime,appId,appIdentifier:profileId,
      applicationInfo:{bundleName:runnerBundle,appProvisionType:'debug',uid:observedUid},
      hapModuleInfos:[{name:RUNNER_MODULE,moduleName:RUNNER_MODULE,bundleName:runnerBundle,moduleType:2,
        versionCode:expectedVersion.versionCode}],
    })}`;
  function fixture({before = rawReadback(now-1000), after = rawReadback(now), replacement = 'install bundle successfully',
    verified = verification, hapSha256 = verification.hapSha256} = {}) {
    const commands = [];
    const readbacks = [before,after];
    function runHdc(args, options) {
      commands.push(args);
      if (args[2] === 'install') {
        assert.deepEqual(args,install);
        assert.equal(options.timeoutMs,180000);
        return {status:0,stdout:replacement};
      }
      assert.deepEqual(args,dump);
      assert.equal(options.timeoutMs,30000);
      assert.ok(readbacks.length);
      return {status:0,stdout:readbacks.shift()};
    }
    const perform = () => installVerifiedRunner({verification:verified,artifactPath,target,targetKind:'vm',hdcRoute,runHdc,
      readArtifact: path => {
        assert.equal(path,artifactPath);
        commands.push(['recheck-artifact']);
        return {sha256:hapSha256,bytes:verification.bytes};
      }});
    return {commands,perform};
  }
  const current = fixture();
  const receipt = current.perform();
  const {completedAt,...result} = receipt;
  assert.ok(Number.isFinite(Date.parse(completedAt)));
  assert.deepEqual(current.commands,[dump,['recheck-artifact'],install,dump]);
  assert.deepEqual(result,{
    schema:'reader-ui-contract-runner-deployment-v1', hapSha256:verification.hapSha256,
    manifestSha256:verification.manifestSha256, verificationSha256:sha(`${JSON.stringify(verification)}\n`),
    targetKind:'vm',hdcServer:hdcRoute.serverKey,vmLocation:'remote',targetRef:sha(target).slice(0,12),
    dataPolicy:'preserve',install:'PASS',launch:'NOT_RUN',
    postInstall:{bundleName:runnerBundle,moduleName:RUNNER_MODULE,appProvisionType:'debug',
      appIdSha256:signature.appIdSha256,appIdentifierSha256:signature.appIdentifierSha256,...expectedVersion,updateTime:now},
  });
  const documents = {manifest,verification,deployment:receipt};
  const evidence = Object.fromEntries(Object.entries(documents).map(([kind,value]) =>
    [`candidate/runner-${kind}.json`,json(value)]));
  const refs = Object.fromEntries(Object.keys(documents).map(kind => {
    const path = `candidate/runner-${kind}.json`;
    return [kind,{path,bytes:Buffer.byteLength(evidence[path]),sha256:sha(evidence[path])}];
  }));
  const store = {json(ref) {
    const bytes = evidence[ref.path];
    assert.equal(Buffer.byteLength(bytes),ref.bytes);
    assert.equal(sha(bytes),ref.sha256);
    return JSON.parse(bytes);
  }};
  assert.deepEqual(readReversalReplayArtifact(store,refs,receipt,Date.parse(completedAt)).postInstall,receipt.postInstall);

  const absent = fixture({before:`error: bundle [${runnerBundle}] not found.`});
  assert.equal(absent.perform().install,'PASS');
  assert.deepEqual(absent.commands,[dump,['recheck-artifact'],install,dump]);

  const reader = fixture({verified:{...verification,bundleName:READER_BUNDLE}});
  assert.throws(reader.perform,/independent signed debug Runner/);
  assert.deepEqual(reader.commands,[]);

  const foreign = fixture({before:rawReadback(now-1000,{profileId:'other'})});
  assert.throws(foreign.perform,/different signing lineage/);
  assert.deepEqual(foreign.commands,[dump]);

  const changed = fixture({hapSha256:'0'.repeat(64)});
  assert.throws(changed.perform,/HAP changed/);
  assert.deepEqual(changed.commands,[dump,['recheck-artifact']]);

  const signMismatch = fixture({replacement:'9568332'});
  assert.throws(signMismatch.perform,/9568332/);
  assert.deepEqual(signMismatch.commands,[dump,['recheck-artifact'],install]);

  for (const after of [rawReadback(now-1000),rawReadback(now,{observedUid:uid+1})]) {
    const stale = fixture({after});
    assert.throws(stale.perform,/no fresh matching module/);
    assert.deepEqual(stale.commands,[dump,['recheck-artifact'],install,dump]);
  }
});
