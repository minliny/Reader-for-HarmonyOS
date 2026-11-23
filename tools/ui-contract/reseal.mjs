#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadCase, equalJson } from './lib/cases.mjs';
import { EvidenceError, evidenceStore, jsonDigest, requireEvidence, validate, verifyChain } from './lib/evidence.mjs';
import { replayReceipt, sealReceipt } from './lib/receipt.mjs';

const sharedExpandParent = 'source-management.unknown-recovery-expand-touch-edge';
const sharedExpandVersions = new Map([
  ['source-management.unknown-expand-target',3],
  ['source-management.unknown-recovery-body',2],
]);
const sharedExpandFixtureId = 'public-source-write-unknown-v2';

function captureFixture({description, ...input}) {
  return input;
}

function assertSharedExpandCases(original, selected) {
  requireEvidence(original.id === sharedExpandParent && original.version === 2 &&
    sharedExpandVersions.get(selected.id) === selected.version &&
    equalJson(original, loadCase(sharedExpandParent)) && original.phase === 1 && selected.phase === 1 &&
    original.pageId === 'source-management' && original.pageId === selected.pageId &&
    original.fixture.id === sharedExpandFixtureId && original.fixture.publicSources === true &&
    equalJson(captureFixture(original.fixture), captureFixture(selected.fixture)) &&
    equalJson(original.steps, selected.steps) && equalJson(original.ownerSources, selected.ownerSources),
  'The pinned Source Expand capture may be shared only by the exact current cases with the same fixture, steps and owners');
}

try {
  const {values, tokens} = parseArgs({ options:{
    case:{type:'string'}, input:{type:'string'}, 'expected-root':{type:'string'}, 'output-dir':{type:'string'},
    'reuse-capture':{type:'boolean'},
    'share-source-unknown-expand-capture':{type:'boolean'},
  }, tokens:true, allowPositionals:false, strict:true });
  const shareExpand = values['share-source-unknown-expand-capture'] === true;
  requireEvidence(!(shareExpand && values['reuse-capture']) &&
    tokens.length === (values['reuse-capture'] || shareExpand ? 5 : 4) &&
    new Set(tokens.map(token => token.name)).size === tokens.length &&
    values.case && values.input && values['output-dir'] && /^[0-9a-f]{64}$/u.test(values['expected-root'] ?? ''),
  'Resealing requires one exact case, original receipt, independent original root, and new output directory');
  const inputPath = resolve(values.input);
  const input = evidenceStore(dirname(inputPath));
  const originalRef = input.reference(basename(inputPath));
  requireEvidence(originalRef.sha256 === values['expected-root'], 'Original receipt root differs from the independent root');
  const original = validate('receipt', input.json(originalRef));
  const contract = loadCase(values.case);
  const originalContract = validate('case', input.json(original.case));
  const currentCapture = {...contract};
  const originalCapture = {...originalContract};
  delete currentCapture.structure;
  delete originalCapture.structure;
  requireEvidence(original.caseId === originalContract.id && original.caseVersion === originalContract.version &&
    original.caseSha256 === jsonDigest(originalContract), 'The original receipt differs from its pinned case');
  if (shareExpand) {
    assertSharedExpandCases(originalContract, contract);
    replayReceipt({receiptPath:inputPath, expectedRoot:originalRef.sha256, contract:originalContract});
  } else {
    requireEvidence(original.caseId === contract.id &&
      (values['reuse-capture'] ? contract.phase === 1 && contract.structure && equalJson(originalCapture, currentCapture) :
        equalJson(originalContract, contract)), 'The selected case must retain the original capture and functional definition');
  }
  const session = validate('session',input.json(original.session));
  requireEvidence(session.runId === original.runId && verifyChain(session.chain) === original.chainTail,
    'The original session does not match the pinned receipt');
  const originalFixture = shareExpand ? input.json(session.fixture) : undefined;
  if (shareExpand) requireEvidence(originalFixture.caseId === sharedExpandParent &&
    originalFixture.fixtureId === sharedExpandFixtureId && originalFixture.publicFixtureScope === 'source-write-unknown' &&
    original.candidate.identity.targetKind === 'vm' && original.candidate.identity.hdcServer === '127.0.0.1:8710',
  'Shared Source Expand requires its signed local VM session and exact public fixture scope');
  const {manifest,deployment,snapshot,ownerSources} = original.candidate;
  const refs = {manifest,deployment,snapshot,ownerSources};
  const captures = session.chain.flatMap(({entry}) => [entry.screenshot,entry.layout].filter(Boolean));
  const files = [manifest,deployment,snapshot,...Object.values(ownerSources),session.fixture,session.commands,original.session,...captures];
  const checked = new Map();
  for (const ref of files) {
    const previous = checked.get(ref.path);
    requireEvidence(!previous || equalJson(previous,ref), 'The original raw references disagree');
    if (!previous) {
      input.bytes(ref);
      checked.set(ref.path,ref);
    }
  }
  const outputPath = resolve(values['output-dir']);
  mkdirSync(outputPath,{mode:0o700});
  const store = evidenceStore(outputPath);
  for (const ref of checked.values()) store.write(ref.path,input.bytes(ref));
  if (values['reuse-capture'] || shareExpand) store.writeJson('original-case.json', originalContract);
  let selectedSession = session;
  let sessionRef = original.session;
  let sharedCapture;
  if (shareExpand) {
    const originalReceipt = store.write('original-receipt.json', input.bytes(originalRef));
    const derivedFixture = store.writeJson('session/shared-source-expand-fixture.json', {...originalFixture, caseId:contract.id});
    selectedSession = {...session, fixture:derivedFixture};
    sessionRef = store.writeJson('session/shared-source-expand-session.json', selectedSession);
    sharedCapture = {mode:'SHARED_SOURCE_UNKNOWN_EXPAND_CAPTURE', originalCaseSha256:original.caseSha256,
      originalReceipt, originalSession:original.session, originalFixture:session.fixture, derivedSession:sessionRef, derivedFixture};
  }
  const result = sealReceipt({store,refs,session:selectedSession,sessionRef},contract);
  const derivation = {originalRootSha256:originalRef.sha256, rootSha256:result.rootSha256,
    caseSha256:result.receipt.caseSha256, originalTool:original.tool, tool:result.receipt.tool,
    ...(values['reuse-capture'] ? {originalCaseSha256:original.caseSha256, mode:'REUSED_CAPTURE'} : {}),
    ...sharedCapture,
    rawReferences:[...checked.values()]};
  store.writeJson('derivation.json',derivation);
  console.log(JSON.stringify({ ...result, derivation },null,2));
  if (result.receipt.execution !== 'PASS') process.exitCode = 1;
} catch (error) {
  const incomplete = error instanceof EvidenceError;
  console.error(JSON.stringify({execution:incomplete ? 'INCOMPLETE' : 'ERROR',reason:error.message}));
  process.exitCode = incomplete ? 1 : 2;
}
