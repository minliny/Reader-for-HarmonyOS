import { basename, dirname } from 'node:path';
import { evidenceStore, jsonDigest, requireEvidence, validate, verifyChain } from '../../lib/evidence.mjs';
import { equalJson, grabberReversalUnavailable } from '../../lib/cases.mjs';
import { readReversalReplayArtifact } from './reversal-dispatch.mjs';
import { fixtureAdmission, loadCandidate } from './run.mjs';
import { sessionContext } from './records.mjs';

const qualificationSchema = 'reader-ui-runner-qualification-v1';
const digest = /^[a-f0-9]{64}$/u;
const runnerRefNames = ['manifest','verification','deployment'];

export function runnerCollectionMode(options, contract) {
  const hasReversal = contract.steps.some(step => step.op === 'grabberReversal');
  const supplied = ['runnerMode','runnerManifest','runnerInstallEvidence','runnerDeploymentSha',
    'runnerQualification','runnerQualificationSha'].some(key => options[key] !== undefined);
  if (!hasReversal) {
    requireEvidence(!supplied,'Independent Runner inputs belong to the grabber reversal case');
    return undefined;
  }
  const {runnerMode,runnerManifest,runnerInstallEvidence,runnerDeploymentSha,
    runnerQualification,runnerQualificationSha} = options;
  requireEvidence(['qualify','dispatch'].includes(runnerMode) && runnerManifest && runnerInstallEvidence &&
    digest.test(runnerDeploymentSha ?? ''),grabberReversalUnavailable);
  requireEvidence(runnerMode === 'qualify' ? !runnerQualification && !runnerQualificationSha :
    runnerQualification && digest.test(runnerQualificationSha ?? ''),
  'Runner dispatch requires a separately pinned dry qualification for this installed candidate and target');
  return runnerMode;
}

function qualificationObservation(store, sessionRef, candidate, contract) {
  const session = validate('session',store.json(sessionRef));
  verifyChain(session.chain);
  const context = sessionContext({store,session,sessionRef,candidate,contract});
  if (!context.runnerQualification || context.problems.length) return undefined;
  const checkedAt = fixtureAdmission(store.json(session.fixture),contract,candidate);
  const beganAt = Date.parse(context.records[0].recordedAt);
  requireEvidence(checkedAt <= beganAt && beganAt - checkedAt <= 10 * 60 * 1000,
    'The public fixture observation did not cover the Runner qualification');
  return {observation:context.runnerQualification,runnerDeploymentSha:session.runner.deployment.sha256};
}

export function sealRunnerQualification(run, contract) {
  const result = qualificationObservation(run.store,run.sessionRef,run.candidate,contract);
  if (!result) return undefined;
  const qualification = {schema:qualificationSchema,caseSha256:jsonDigest(contract),candidate:run.refs,
    session:run.sessionRef,...result};
  const proof = run.store.writeJson('runner-qualification.json',qualification);
  run.store.write('runner-qualification.sha256',`${proof.sha256}\n`);
  return {status:'DRY_READY',qualification:proof.path,rootSha256:proof.sha256,observation:result.observation,
    execution:'NOT_RUN'};
}

export function assertRunnerQualification(options, contract, current) {
  const expectedName = 'runner-qualification.json';
  requireEvidence(basename(options.runnerQualification) === expectedName,'Select a sealed Runner qualification file');
  const store = evidenceStore(dirname(options.runnerQualification));
  const proof = store.reference(expectedName);
  requireEvidence(proof.sha256 === options.runnerQualificationSha,
    'Runner qualification differs from the independently pinned root');
  const saved = store.json(proof);
  requireEvidence(saved?.schema === qualificationSchema && saved.caseSha256 === jsonDigest(contract) &&
    saved.runnerDeploymentSha === options.runnerDeploymentSha,
  'Runner qualification belongs to another case definition or installed Runner');
  const prior = loadCandidate(store,saved.candidate,contract);
  const identityFields = ['appBuildId','appContentHash','hapSha256','sourceFingerprint','buildRunId',
    'targetRef','targetKind','hdcServer'];
  requireEvidence(identityFields.every(key => prior[key] === current[key]) && equalJson(prior.postInstall,current.postInstall),
    'Runner qualification belongs to another Reader deployment or exact target');
  const replayed = qualificationObservation(store,saved.session,prior,contract);
  requireEvidence(replayed && replayed.runnerDeploymentSha === saved.runnerDeploymentSha &&
    equalJson(replayed.observation,saved.observation),
  'Runner qualification does not reproduce the complete dry command and the retained Reader');
}

export async function authorizeRunnerCollection(options, contract, candidate) {
  const mode = runnerCollectionMode(options,contract);
  if (mode === undefined) return undefined;
  const input = evidenceStore(options.runnerInstallEvidence);
  const refs = Object.fromEntries(runnerRefNames.map(name => [name,input.reference(`runner-${name}.json`)]));
  requireEvidence(refs.deployment.sha256 === options.runnerDeploymentSha,
    'Runner deployment differs from the independently pinned bytes');
  const runner = readReversalReplayArtifact({json:ref=>input.json({...ref,path:ref.path.slice('candidate/'.length)})},
    Object.fromEntries(runnerRefNames.map(name => [name,{...refs[name],path:`candidate/${refs[name].path}`} ])),
    candidate,Date.now());
  if (mode === 'dispatch') assertRunnerQualification(options,contract,candidate);
  const { verifyRunnerArtifact } = await import('../../../../scripts/hap-pipeline.mjs');
  requireEvidence(equalJson(verifyRunnerArtifact(options.runnerManifest,refs.manifest.sha256),input.json(refs.verification)),
    'The on-disk signed Runner artifact differs from the installed artifact verification');
  return {runner, manifestBytes:input.bytes(refs.manifest), verificationBytes:input.bytes(refs.verification),
    deploymentBytes:input.bytes(refs.deployment)};
}
