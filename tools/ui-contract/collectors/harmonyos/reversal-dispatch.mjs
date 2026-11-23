import { equalJson } from '../../lib/cases.mjs';
import { jsonDigest, requireEvidence } from '../../lib/evidence.mjs';
import { layoutTapPoint, selectLayoutNode } from '../../lib/layout.mjs';
import {
  READER_BUNDLE, READER_SIGNER, REVERSAL_SPEED, RUNNER_DISPLAY, RUNNER_MODULE,
  parseReversalRequest, reversalPoints, samePixelRect,
} from './pointer-matrix-runner/entry/src/ohosTest/ets/testrunner/ReversalPlan.ts';

const stageId = 'reader-reading-stage';
const grabberId = 'reader-control-motion-grabber';
const receiptPrefix = 'READER_GRABBER_REVERSAL_RECEIPT ';
const digest = /^[a-f0-9]{64}$/u;
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const reversalRequestLifetimeMs = 30000;

/** Read the artifact verification and deployment facts pinned by the sealed session. */
export function readReversalReplayArtifact(store, refs, candidate, journalStart) {
  requireEvidence(refs?.manifest?.path === 'candidate/runner-manifest.json' &&
    refs?.verification?.path === 'candidate/runner-verification.json' &&
    refs?.deployment?.path === 'candidate/runner-deployment.json',
  'The reversal session lacks its own referenced Runner manifest, verification and deployment');
  let manifest, verification, deployment;
  try {
    [manifest, verification, deployment] = [refs.manifest,refs.verification,refs.deployment].map(ref => store.json(ref));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    requireEvidence(false,'Malformed Runner evidence in the sealed session');
  }
  const {artifact,bundleName,expectedVersion} = manifest ?? {};
  const signature = verification?.signature;
  requireEvidence(manifest?.schema === 'reader-ui-contract-runner-artifact-manifest-v1' &&
    verification?.schema === 'reader-ui-contract-runner-artifact-verification-v1' && verification.verification === 'PASS' &&
    verification.manifestSha256 === refs.manifest.sha256 && verification.bundleName === bundleName &&
    typeof bundleName === 'string' && bundleName !== READER_BUNDLE &&
    /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/u.test(bundleName) && bundleName.length <= 128 &&
    verification.moduleName === RUNNER_MODULE && equalJson(verification.expectedVersion,expectedVersion) &&
    /^[A-Za-z0-9][A-Za-z0-9.-]{0,63}$/u.test(expectedVersion?.versionName ?? '') &&
    positiveInteger(expectedVersion?.versionCode) && /^[A-Za-z0-9][A-Za-z0-9._-]*\.hap$/u.test(artifact?.path ?? '') &&
    digest.test(artifact?.sha256 ?? '') && verification.hapSha256 === artifact.sha256 &&
    positiveInteger(artifact.bytes) && verification.bytes === artifact.bytes && signature?.status === 'signed' &&
    signature.verified === true && signature.profileType === 'debug' && signature.bundleName === bundleName &&
    signature.certificateSha256 === READER_SIGNER && digest.test(signature.appIdSha256 ?? '') &&
    digest.test(signature.appIdentifierSha256 ?? ''),
  'The preserved Runner verification does not match its independently pinned signed feature artifact');
  const postInstall = deployment?.postInstall;
  const completedAt = Date.parse(deployment?.completedAt);
  requireEvidence(deployment?.schema === 'reader-ui-contract-runner-deployment-v1' && deployment.install === 'PASS' &&
    deployment.dataPolicy === 'preserve' && deployment.launch === 'NOT_RUN' &&
    deployment.hapSha256 === verification.hapSha256 && deployment.manifestSha256 === refs.manifest.sha256 &&
    deployment.verificationSha256 === refs.verification.sha256 && deployment.targetRef === candidate.targetRef &&
    deployment.targetKind === candidate.targetKind && deployment.hdcServer === candidate.hdcServer &&
    Number.isFinite(completedAt) && completedAt <= journalStart &&
    postInstall?.bundleName === bundleName && postInstall.moduleName === RUNNER_MODULE &&
    postInstall.appProvisionType === 'debug' && postInstall.appIdSha256 === signature.appIdSha256 &&
    postInstall.appIdentifierSha256 === signature.appIdentifierSha256 && positiveInteger(postInstall.updateTime) &&
    postInstall.versionName === expectedVersion.versionName && postInstall.versionCode === expectedVersion.versionCode,
  'The preserved Runner deployment does not install the pinned feature artifact on this target');
  const {targetRef,targetKind,hdcServer} = deployment;
  return {...verification,targetRef,targetKind,hdcServer,postInstall};
}

/** Check the live readback and clock in the same bounded command interval. */
export function reversalReplayTiming(install, clock, before, dispatch, floor, postInstall) {
  const commands = [install,clock,before,dispatch,floor];
  const intervals = commands.map(record => ({start:Date.parse(record?.startedAt), end:Date.parse(record?.recordedAt)}));
  requireEvidence(commands.every((record,index) => record?.status === 0 && record.signal === null && record.error === null &&
    Number.isFinite(record.elapsedMs) && record.elapsedMs >= 0 && record.elapsedMs <= reversalRequestLifetimeMs &&
    Number.isFinite(intervals[index].start) && Number.isFinite(intervals[index].end) &&
    intervals[index].start <= intervals[index].end && intervals[index].end - intervals[index].start <= reversalRequestLifetimeMs &&
    (index === 0 || intervals[index-1].end <= intervals[index].start)) &&
    intervals[3].start - intervals[0].end <= reversalRequestLifetimeMs,
  'The Runner clock and install readbacks are outside the current command interval');
  return reversalReadbackTiming(install, clock, postInstall);
}

/** Check the exact installation and derive the request deadline from the probe's clock. */
export function reversalReadbackTiming(install, clock, postInstall) {
  requireEvidence(install?.installed && equalJson(install.installed,postInstall),
    'The current Runner install differs from the pinned artifact deployment');
  requireEvidence(typeof clock?.stdout === 'string' && /^[1-9][0-9]{0,12}(?:\r?\n)?$/u.test(clock.stdout),
    'The current target has no unambiguous Unix clock readback');
  const deviceNowMs = Number(clock.stdout) * 1000;
  const expiresAtMs = deviceNowMs + reversalRequestLifetimeMs;
  requireEvidence(positiveInteger(expiresAtMs) && deviceNowMs >= postInstall.updateTime,
    'The current target clock predates the Runner install');
  return {deviceNowMs,expiresAtMs};
}

function pixelBox(box, purpose = 'reversal') {
  const {left,top,width,height} = box ?? {};
  requireEvidence([left,top,width,height].every(Number.isSafeInteger) && left >= 0 && top >= 0 &&
    width > 0 && height > 0, `The ${purpose} sample has no complete physical pixel box`);
  return {left,top,right:left+width,bottom:top+height};
}

function captureScope(sample, capture) {
  requireEvidence(sample?.captureComplete === true && positiveInteger(sample.beforeSeq) &&
    positiveInteger(sample.afterSeq) && sample.beforeSeq < sample.afterSeq &&
    positiveInteger(sample.semanticSeq) && sample.semanticSeq <= sample.afterSeq,
  'Reversal preparation needs a full native sample and ordered app checkpoints');
  const {layout,screenshot} = capture ?? {};
  for (const [ref,extension] of [[layout,'.json'],[screenshot,'.png']]) {
    requireEvidence(typeof ref?.path === 'string' && /^raw\/reader-control-[a-f0-9-]+\.(?:png|json)$/u.test(ref.path) &&
      ref.path.endsWith(extension) && positiveInteger(ref.bytes) && digest.test(ref.sha256 ?? '') &&
      sample.evidenceRefs?.some(item => item.path === ref.path && item.sha256 === ref.sha256 && item.bytes === ref.bytes),
    'The reversal sample lacks its own verified native tree and screenshot references');
  }
  const {instanceId,beforeSeq,afterSeq,semanticSeq,window} = sample;
  const scope = ({path,bytes,sha256}) => ({path,bytes,sha256});
  return {instanceId,beforeSeq,afterSeq,semanticSeq,layout:scope(layout),screenshot:scope(screenshot),
    window:{id:window?.id, revision:window?.revision, density:window?.density,
      rectPx:pixelBox(window?.rectPx), displayRectPx:pixelBox(window?.displayRectPx)}};
}

function containsPixelBox(outer, inner) {
  return outer.left <= inner.left && outer.top <= inner.top &&
    outer.right >= inner.right && outer.bottom >= inner.bottom;
}

export function readSearchGrabberGeometry(sample, full, purpose = 'reversal') {
  const window = pixelBox(sample.window.rectPx,purpose);
  const display = pixelBox(sample.window.displayRectPx,purpose);
  const stage = selectLayoutNode(sample,stageId);
  const withinStage = id => selectLayoutNode(sample,{id,ancestors:[stageId]});
  withinStage('reader-control-module-search');
  requireEvidence(withinStage('reader-control-collapse').enabled === full,
    'Full and Quick calibration do not expose their measured Search forms');
  const grabber = withinStage(grabberId);
  const center = layoutTapPoint(grabber,{requireClickable:false});
  const stageBox = pixelBox(stage.visibleRectPx,purpose);
  const originalStageBox = pixelBox(stage.rectPx,purpose);
  const grabberBox = pixelBox(grabber.visibleRectPx,purpose);
  requireEvidence([originalStageBox,window,display].every(box => containsPixelBox(box,stageBox)),
    'The visible native stage is outside its original, window or display bounds');
  requireEvidence(samePixelRect(grabberBox,pixelBox(grabber.rectPx,purpose)) && containsPixelBox(stageBox,grabberBox),
    `A clipped native grabber cannot calibrate the ${purpose}`);
  return {stageBox,originalStageBox,grabberBox,center};
}

/** Build the exact request from already verified, immutable action inputs. */
export function prepareReversalDispatch({step,runId,candidate,runner,readingId,before,samples,captures,
  deviceNowMs,expiresAtMs,mode = 'dispatch'}) {
  requireEvidence(step?.op === 'grabberReversal' && step.target === grabberId && step.id === 'reverse-grabber' &&
    step.reversalReference === 'calibrate-full-state' && step.from === 'restore-quick-state' &&
    typeof readingId === 'string' && readingId.length > 0 && before?.kind === 'window-stable' &&
    positiveInteger(before.eventSeq) && positiveInteger(before.semanticSeq) && before.semanticSeq <= before.eventSeq &&
    /^[a-f0-9]{12}$/u.test(candidate?.targetRef ?? '') && digest.test(candidate?.hapSha256 ?? '') &&
    digest.test(candidate?.appContentHash ?? '') && typeof candidate.appBuildId === 'string' && candidate.appBuildId.length > 0 &&
    ['127.0.0.1:8710','192.168.1.10:8710'].includes(candidate.hdcServer) &&
    ['vm','physical'].includes(candidate.targetKind) &&
    runner?.hdcServer === candidate.hdcServer && runner.targetKind === candidate.targetKind &&
    runner.targetRef === candidate.targetRef && digest.test(runner.hapSha256 ?? '') && candidate.hapSha256 !== runner.hapSha256,
  'Reversal preparation needs the exact case, reading owner, production candidate and separate Runner HAP pin');
  const {bundleName:runnerBundle, hapSha256:runnerHapSha256, signature, postInstall:runnerInstall} = runner;
  requireEvidence(typeof runnerBundle === 'string' && runnerBundle !== READER_BUNDLE && runner.moduleName === RUNNER_MODULE &&
    runner.schema === 'reader-ui-contract-runner-artifact-verification-v1' && runner.verification === 'PASS' &&
    digest.test(runner.manifestSha256 ?? '') &&
    signature?.verified === true && signature.profileType === 'debug' && signature.bundleName === runnerBundle &&
    typeof signature.certificateSha256 === 'string' && signature.certificateSha256.toLowerCase() === READER_SIGNER &&
    digest.test(signature.appIdSha256 ?? '') && digest.test(signature.appIdentifierSha256 ?? '') &&
    runnerInstall?.bundleName === runnerBundle && runnerInstall.moduleName === RUNNER_MODULE &&
    runnerInstall.appProvisionType === 'debug' && runnerInstall.appIdSha256 === signature.appIdSha256 &&
    runnerInstall.appIdentifierSha256 === signature.appIdentifierSha256 &&
    runnerInstall.versionName === runner.expectedVersion?.versionName && runnerInstall.versionCode === runner.expectedVersion?.versionCode &&
    positiveInteger(runnerInstall.updateTime),
  'Reversal needs the separate test bundle with its matching signed Profile and current install');
  const fullSample = samples[step.reversalReference];
  const quickSample = samples[step.from];
  const full = captureScope(fullSample,captures[step.reversalReference]);
  const quick = captureScope(quickSample,captures[step.from]);
  requireEvidence(new Set([full.layout.path,quick.layout.path,full.screenshot.path,quick.screenshot.path]).size === 4 &&
    typeof quick.instanceId === 'string' && quick.instanceId.length > 0 && quick.instanceId === before.instanceId &&
    full.instanceId === quick.instanceId && full.afterSeq < quick.beforeSeq && quick.afterSeq <= before.eventSeq &&
    quick.semanticSeq === before.semanticSeq && typeof quick.window.id === 'string' && quick.window.id.length > 0 &&
    full.window.id === quick.window.id && quick.window.id === before.payload?.windowId &&
    Number.isSafeInteger(quick.window.revision) && quick.window.revision >= 0 && quick.window.revision === before.windowRevision &&
    Number.isFinite(quick.window.density) && quick.window.density > 0 &&
    full.window.density === quick.window.density && samePixelRect(full.window.rectPx,quick.window.rectPx) &&
    samePixelRect(full.window.displayRectPx,quick.window.displayRectPx),
  'Reversal calibration is stale, reused or outside the current native window');
  const fullBox = readSearchGrabberGeometry(fullSample,true);
  const quickBox = readSearchGrabberGeometry(quickSample,false);
  requireEvidence(samePixelRect(fullBox.stageBox,quickBox.stageBox) &&
    samePixelRect(fullBox.originalStageBox,quickBox.originalStageBox), 'The reading stage moved during Full/Quick calibration');
  const {versionName,versionCode} = candidate.expectedVersion ?? {};
  const {updateTime,appVersion} = candidate.postInstall ?? {};
  requireEvidence(candidate.postInstall?.bundleName === READER_BUNDLE && appVersion?.versionName === versionName &&
    appVersion?.versionCode === versionCode && appVersion?.appBuildId === candidate.appBuildId &&
    appVersion?.appContentHash === candidate.appContentHash &&
    positiveInteger(deviceNowMs) && positiveInteger(updateTime) && updateTime <= deviceNowMs,
  'Reversal preparation needs the verified current install and device clock');
  const baselineSha256 = jsonDigest({
    scope:'reader-grabber-reversal-input-v1',runId,action:step.id,readingId,targetRef:candidate.targetRef,
    targetKind:candidate.targetKind,hdcServer:candidate.hdcServer,
    production:{hapSha256:candidate.hapSha256,appBuildId:candidate.appBuildId,versionName,versionCode,updateTime},
    runner:{hapSha256:runnerHapSha256,manifestSha256:runner.manifestSha256,bundleName:runnerBundle,
      appIdSha256:signature.appIdSha256,appIdentifierSha256:signature.appIdentifierSha256,
      versionName:runnerInstall.versionName,versionCode:runnerInstall.versionCode,updateTime:runnerInstall.updateTime},
    before:{instanceId:before.instanceId,eventSeq:before.eventSeq,semanticSeq:before.semanticSeq,
      windowRevision:before.windowRevision},
    full:{sampleId:step.reversalReference,...full},quick:{sampleId:step.from,...quick},
  });
  const {left,top,right,bottom} = quickBox.grabberBox;
  const argument = [runId,mode,runnerInstall.versionName,runnerInstall.versionCode,runnerInstall.updateTime,
    expiresAtMs,baselineSha256,left,top,right,bottom,fullBox.center.x,fullBox.center.y,runnerBundle].join(',');
  const request = parseReversalRequest(argument,deviceNowMs);
  const points = request && reversalPoints(request,quick.window.rectPx,quickBox.stageBox,quickBox.grabberBox);
  requireEvidence(points, 'The selected Runner request or measured path is outside its admitted bounds');
  return {op:step.op,argument,request,points,deviceNowMs,targetRef:candidate.targetRef,runnerHapSha256};
}

export function reversalCommandArgs(operation) {
  return ['shell','aa','test','-b',operation.request.runnerBundle,'-m',RUNNER_MODULE,'-s','unittest','ReaderGrabberReversalRunner',
    '-s','readerReversal',operation.argument,'-s','timeout','20000'];
}

/** Verify the Runner's claimed dry readiness or SDK acknowledgement. */
export function verifyReversalRunnerOutput(command, seq, operation) {
  const {runId,baselineSha256,expiresAtMs,runnerBundle,mode} = operation.request;
  requireEvidence(mode === 'dry' || mode === 'dispatch', 'The reversal Runner request has an unexpected mode');
  const state = mode === 'dry' ? 'DRY_READY' : 'SDK_ACCEPTED';
  requireEvidence(command?.event === 'command' && command.ok === true &&
    equalJson(command.args,reversalCommandArgs(operation)),
  `Unexpected command at probe sequence ${seq}`);
  requireEvidence(command.seq === seq && command.targetRef === operation.targetRef && command.status === 0 &&
    command.signal === null && command.error === null && Number.isFinite(command.elapsedMs) &&
    command.elapsedMs >= 0 && command.elapsedMs <= 30000 && typeof command.stdout === 'string',
  'The reversal Runner command did not finish successfully on the exact target');
  const matches = command.stdout.split(/\r?\n/u).filter(line => line.startsWith(receiptPrefix));
  requireEvidence(matches.length === 1 && matches[0].length <= 8192,
    'Expected exactly one bounded reversal Runner receipt in that command output');
  const body = matches[0].slice(receiptPrefix.length);
  let receipt;
  try { receipt = JSON.parse(body); }
  catch { requireEvidence(false,'Malformed reversal Runner receipt'); }
  const {startedAtMs,finishedAtMs} = receipt ?? {};
  requireEvidence(body === JSON.stringify(receipt) && positiveInteger(startedAtMs) && positiveInteger(finishedAtMs) &&
    operation.deviceNowMs <= startedAtMs && startedAtMs <= finishedAtMs && finishedAtMs <= expiresAtMs &&
    equalJson(receipt,{schema:'reader-grabber-reversal-runner-v1',runId,baselineSha256,runnerBundle,mode,
      state,reason:'',startedAtMs,finishedAtMs,points:operation.points,displayId:RUNNER_DISPLAY,
      speedPxPerSecond:REVERSAL_SPEED}),
  'The Runner receipt does not bind this request, planned points and expected mode result');
  return {probeSeq:seq,runId,baselineSha256,runnerHapSha256:operation.runnerHapSha256,state};
}
