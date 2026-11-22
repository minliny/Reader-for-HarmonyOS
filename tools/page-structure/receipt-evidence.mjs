import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, sep } from 'node:path';
import { canonicalAppJson } from '../../scripts/lib/app-build-identity.mjs';
import { requireEvidence, sha256 } from '../lib/native-ui-evidence.mjs';
import { requireStructureProof } from '../ui-contract/lib/receipt-structure.mjs';
import { digest, safePath } from './lib.mjs';
import {
  completeSourceE3Receipt, isSourceE3Claim, requiresSourceE3Assertion, requireSourceE3Matrix, requireSourceE3MatrixReceipts,
} from './source-e3-admission.mjs';
import {
  isSourceE2Claim, readSourceE2Inventory, requireSourceE2InteractionPlan, requireSourceE2InteractionReceipts, sourceE2Runs,
} from './source-e2-admission.mjs';

const digestPattern = /^[0-9a-f]{64}$/u;
const casePattern = /^[a-zA-Z0-9._:-]+$/u;
const same = (left, right) => canonicalAppJson(left) === canonicalAppJson(right);
const groupSchema = 'reader-ui-contract-receipt-group-v1';
const sourceMatrixGroupSchema = 'reader-ui-contract-receipt-group-v2';
const sourceInteractionGroupSchema = 'reader-ui-contract-receipt-group-v3';
const targetRefPattern = /^[a-f0-9]{12}$/u;

function claimMappings(page, model, claim) {
  return (model?.receiptAdmissions ?? []).filter(mapping => mapping.pageId === page.pageId && mapping.claim === claim);
}

export function sourceE3AdmissionGap(page, claim, model) {
  if (!isSourceE3Claim(page, claim)) return;
  const mappings = claimMappings(page, model, claim);
  if (mappings.length !== 1 || mappings[0].routeContractRef !== page.routeContractRef) {
    return 'Source E3 requires model-owned native receipt admission for its complete measured window and text-role matrix';
  }
  try {
    requireSourceE3Matrix(mappings[0]);
  } catch (error) {
    return error.message;
  }
}

export function sourceE2AdmissionGap(page, claim, model) {
  if (!isSourceE2Claim(page, claim)) return;
  const mappings = claimMappings(page, model, claim);
  if (mappings.length !== 1 || mappings[0].routeContractRef !== page.routeContractRef) {
    return 'Source E2 PASS requires a model-owned native receipt covering the complete interaction claim';
  }
  try {
    requireSourceE2InteractionPlan(mappings[0]);
  } catch (error) {
    return error.message;
  }
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    keys.length === Object.keys(value).length && keys.every(key => Object.hasOwn(value, key));
}

function relativeEvidenceName(path) {
  return typeof path === 'string' && /^[a-zA-Z0-9._/-]+$/u.test(path) &&
    path.split('/').every(value => value && value !== '.' && value !== '..');
}

function compareCandidates(expected, derived) {
  return Object.keys(expected ?? {}).length === 4 &&
    ['appBuildId', 'hapSha256', 'sourceFingerprint', 'targetRef'].every(key =>
      typeof expected[key] === 'string' && expected[key] === derived?.[key]) &&
    digestPattern.test(expected.hapSha256) && digestPattern.test(expected.sourceFingerprint) &&
    targetRefPattern.test(expected.targetRef);
}

function readBundleReference(root, reference) {
  const name = reference?.path;
  requireEvidence(relativeEvidenceName(name), 'Receipt contains an invalid evidence reference');
  let path = root;
  for (const segment of name.split('/')) {
    path = join(path, segment);
    requireEvidence(!lstatSync(path).isSymbolicLink(), 'Receipt evidence uses a symbolic link');
  }
  const contents = readFileSync(path);
  requireEvidence(contents.length === reference.bytes && sha256(contents) === reference.sha256,
    'Receipt evidence reference no longer has the verified bytes');
  return JSON.parse(contents.toString('utf8'));
}

/** Compute exactly the content identity of an exported tool before allowing its code to execute. */
export function verifyFrozenTool(root, expected) {
  requireEvidence(digestPattern.test(expected ?? '') && lstatSync(root).isDirectory(),
    'Registration has no frozen replay tool SHA-256');
  const manifestPath = join(root, 'tool-identity.json');
  requireEvidence(lstatSync(manifestPath).isFile(), 'Frozen replay tool manifest must be a regular file');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  requireEvidence(manifest.sha256 === expected && /^phase1(?:\.[0-9]+)?$/u.test(manifest.version),
    'Frozen replay tool manifest differs from the registered identity');
  const inputs = [];
  function walk(path) {
    for (const child of readdirSync(path, {withFileTypes:true})) {
      const location = join(path, child.name);
      const name = relative(root, location).split(sep).join('/');
      requireEvidence(child.isDirectory() || child.isFile(), 'Unsupported replay tool file or symbolic link');
      if (child.isDirectory()) walk(location);
      else if (name !== 'tool-identity.json') inputs.push({
        path: posix.relative('tools/ui-contract', name),
        sha256: sha256(readFileSync(location)),
      });
    }
  }
  walk(root);
  inputs.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  requireEvidence(sha256(Buffer.from(`${canonicalAppJson(inputs)}\n`)) === expected,
    'One or more exported replay tool files changed');
}

function checkCurrentSource(page, requiredOwners, frozenPage, snapshot, initialEnrollment) {
  const frozen = [frozenPage.source, ...(frozenPage.sourceInputs ?? [])];
  const live = [page.source, ...(page.sourceInputs ?? [])];
  const deployed = new Map(snapshot.files.map(input => [input.path, input.sha256]));
  requireEvidence(initialEnrollment ? page.source.path === frozenPage.source.path : same(page.source, frozenPage.source),
    'Receipt registration source differs from the live register');
  for (const name of new Set([page.source.path, ...requiredOwners])) {
    const current = live.find(input => input.path === name);
    const prior = frozen.find(input => input.path === name);
    requireEvidence(current && (initialEnrollment || same(current, prior)) &&
      deployed.get(name) === current.sha256 && digest(name) === current.sha256,
      `Receipt registration source does not match the deployed and live bytes for ${name}`);
  }
}

function requireSameSample(record, step, session, receipt, definition) {
  const nativeSample = session.chain.find(link => link.entry.kind === 'sample' && link.entry.id === step)?.entry;
  // These single-sample layout evaluators record geometry without a sample ID.
  const verifiesExactLayout = definition?.evaluator === 'layout' && definition.baseline === undefined &&
    ['nonOverlap', 'visibleFraction'].includes(definition.kind) && record.actual?.sampleId === undefined &&
    record.actual && typeof record.actual === 'object' && !Array.isArray(record.actual);
  requireEvidence(nativeSample && nativeSample.screenshot && nativeSample.layout &&
    receipt.measurement?.sampleWindows?.[step] && (record.actual?.sampleId === step || verifiesExactLayout) &&
    [nativeSample.screenshot, nativeSample.layout, receipt.session, session.commands].every(reference =>
      record.evidenceRefs.some(candidate => same(candidate, reference))),
  `Assertion ${record.id} has no full raw native capture for ${step}`);
}

function fixtureInputs({description, ...inputs}) {
  return inputs;
}

function claimSampleIds(mapping, contract, currentCase) {
  requireEvidence(same(fixtureInputs(contract.fixture), fixtureInputs(currentCase.fixture)),
    'The current case changed the registered public fixture inputs');
  const captured = new Map(contract.steps.map(step => [step.id, step]));
  const currentSteps = new Map(currentCase.steps.map(step => [step.id, step]));
  const samples = new Set();
  const visited = new Set();
  const visit = (stepId, purpose, accepts) => {
    const step = currentSteps.get(stepId);
    requireEvidence(step && accepts(step) && same(step, captured.get(stepId)),
      `The current case changed the ${purpose} ${stepId}`);
    if (visited.has(stepId)) return;
    visited.add(stepId);
    if (step.kind === 'sample') samples.add(stepId);
    if (step.kind === 'action') visit(step.from, 'causal sample', sample => sample.kind === 'sample' || sample.kind === 'locate');
    else if (step.afterAction) visit(step.afterAction, 'causal action', action => action.kind === 'action');
  };
  const assertionIds = new Set(mapping.assertions.map(({id})=>id));
  for (const id of assertionIds) {
    const original = contract.assertions.find(assertion => assertion.id === id);
    const current = currentCase.assertions.find(assertion => assertion.id === id);
    requireEvidence(current && same(current, original), `The current case changed the registered assertion ${id}`);
    if (current.evaluator === 'source' && ['surface-text', 'retained-read-retry'].includes(current.kind) &&
        current.expected?.conditionAssertion) {
      assertionIds.add(current.expected.conditionAssertion);
    }
    const stepIds = Object.entries(current).filter(([key, value]) => typeof value === 'string' &&
      (['sample', 'baseline', 'action'].includes(key) || key.endsWith('Sample') || key.endsWith('Action')))
      .map(([, value]) => value);
    for (const stepId of stepIds) visit(stepId, 'registered assertion step', () => true);
  }
  return [...samples];
}

/** Admit the exact assertion/sample pairs from a receipt that has already replayed successfully. */
export function admitReplayedRule({
  page, claim, mapping, evidence, receipt, contract, session, frozenPage, snapshot, model, currentCase, matrixSamples = [],
  initialEnrollment = false,
}) {
  const sourceE3 = isSourceE3Claim(page, claim);
  const sourceE2 = isSourceE2Claim(page, claim);
  requireEvidence(mapping.pageId === page.pageId && mapping.routeContractRef === page.routeContractRef &&
    mapping.claim === claim && mapping.caseId === receipt.caseId && receipt.page.id === page.pageId &&
    receipt.page.registration === 'REGISTERED_PAGE' && contract.id === receipt.caseId && contract.phase === 1 &&
    contract.pageId === page.pageId && frozenPage?.pageId === page.pageId && frozenPage.routeContractRef === page.routeContractRef,
  'Receipt does not map to this exact page, route, case and register rule');
  requireEvidence(compareCandidates(evidence.candidate, receipt.candidate.identity),
    'Receipt candidate differs from the registered application, HAP, source or target identity');
  if (sourceE3) requireEvidence(completeSourceE3Receipt(receipt), 'Source E3 requires a complete passing native receipt');
  if (sourceE2) requireEvidence(completeSourceE3Receipt(receipt), 'Source E2 requires a complete passing native receipt');
  requireEvidence(mapping.assertions.length > 0 && new Set(mapping.assertions.map(item => item.id)).size === mapping.assertions.length &&
    mapping.ownerSources.every(path => contract.ownerSources.includes(path)),
  'Registration mapping is missing assertion pairs or candidate-bound owners');
  if (page.pageId === 'source-management' && claim === 'invariants.S3') {
    requireEvidence([page,frozenPage].every(({layers}) => {
      const scroll = layers?.scroll?.facts;
      return layers?.header?.facts?.presentation === 'Fixed' && scroll?.underlap === false &&
        scroll.obscurationCompensation === 0 && scroll.obscurationCompensationSource === undefined;
    }), 'Source S3 requires the same fixed header, no underlap, and zero obscuration compensation in both registrations');
  }
  checkCurrentSource(page, mapping.ownerSources, frozenPage, snapshot, (sourceE3 || sourceE2) && initialEnrollment);
  requireEvidence(model?.scenarioObligations?.some(item => item.caseId === contract.id),
    'The current registration case has no necessary structure obligation');
  requireEvidence(currentCase?.id === contract.id && currentCase.pageId === contract.pageId &&
    mapping.ownerSources.every(path => currentCase.ownerSources.includes(path)),
  'The current case no longer binds this register claim and its production owners');
  const states = requireStructureProof(receipt, currentCase, model, claimSampleIds(mapping, contract, currentCase));
  for (const state of states) {
    for (const check of state.checks) {
      requireSameSample({...check, id:check.ruleId, actual:{sampleId:state.sampleId}}, state.sampleId, session, receipt);
    }
  }
  for (const {id, sampleId} of mapping.assertions) {
    const definition = contract.assertions.find(assertion => assertion.id === id);
    const results = receipt.assertions.filter(record => record.id === id);
    const required = sourceE3 || sourceE2 ? requiresSourceE3Assertion(definition, receipt) : definition?.required === true;
    requireEvidence(definition?.sample === sampleId && required && results.length === 1 &&
      results[0].verdict === 'PASS', `Missing required reproduced assertion ${id} for ${claim}`);
    requireSameSample(results[0], sampleId, session, receipt, definition);
  }
  for (const {sampleId, textAssertions} of matrixSamples) {
    for (const {id} of textAssertions) {
      const mapped = mapping.assertions.find(assertion => assertion.id === id);
      if (mapped?.sampleId === sampleId) continue;
      requireEvidence(mapped && claimSampleIds({assertions:[mapped]}, contract, currentCase).includes(sampleId),
        `Source E3 text assertion ${id} does not bind the secondary native sample ${sampleId}`);
      const record = receipt.assertions.find(assertion => assertion.id === id);
      requireSameSample({...record, actual:{sampleId}}, sampleId, session, receipt);
    }
  }
}

function getClaimMapping(page, model, claim) {
  const gap = sourceE2AdmissionGap(page, claim, model) ?? sourceE3AdmissionGap(page, claim, model);
  requireEvidence(!gap, gap);
  const matching = claimMappings(page, model, claim);
  requireEvidence(matching.length === 1 && matching[0].routeContractRef === page.routeContractRef,
    'No unambiguous owner mapping for this register rule');
  return matching[0];
}

function getReplayTool(evidence) {
  requireEvidence(typeof evidence.toolPath === 'string' && !isAbsolute(evidence.toolPath),
    'Receipt has no independent root or replay tool identity');
  const tool = safePath(evidence.toolPath);
  verifyFrozenTool(tool, evidence.toolSha256);
  return tool;
}

export function requireFrozenClaimMapping(frozenModel, mapping, allowSourceEnrollment = false) {
  const frozen = claimMappings(mapping,frozenModel,mapping.claim);
  const initialEnrollment = allowSourceEnrollment && frozen.length === 0 &&
    (isSourceE3Claim(mapping,mapping.claim) || isSourceE2Claim(mapping,mapping.claim));
  requireEvidence(initialEnrollment || frozen.length === 1 && same(frozen[0],mapping),
    'Capture-time and current model use different receipt admission mappings');
  return initialEnrollment;
}

function replayClaimCase(page, model, claim, mapping, part, evidence, verifiedTool, allowSourceMatrixEnrollment = false) {
  const {caseId} = part;
  requireEvidence(model.scenarioObligations?.some(item => item.caseId === caseId),
    'The current registration case has no necessary structure obligation');
  const currentRegistry = JSON.parse(readFileSync(new URL('../ui-contract/cases/phase-1.registry.json', import.meta.url), 'utf8'));
  requireEvidence(currentRegistry.includes(caseId), 'The registered scenario case is no longer available');
  const currentCase = JSON.parse(readFileSync(new URL(`../ui-contract/cases/${caseId}.json`, import.meta.url), 'utf8'));
  requireEvidence(digestPattern.test(evidence.rootSha256 ?? ''), 'Receipt has no independent root or replay tool identity');
  const path = safePath(evidence.path);
  requireEvidence(sha256(readFileSync(path)) === evidence.rootSha256, 'Receipt differs from the registered independent root digest');
  const tool = verifiedTool ?? getReplayTool(evidence);
  const frozenModel = JSON.parse(readFileSync(join(tool, 'tools/page-structure/model.json'), 'utf8'));
  const initialEnrollment = requireFrozenClaimMapping(frozenModel,mapping,allowSourceMatrixEnrollment);
  const frozenRegister = JSON.parse(readFileSync(join(tool, 'tools/page-structure/register.json'), 'utf8'));
  const frozenPage = frozenRegister.pages.find(item => item.pageId === page.pageId);
  requireEvidence(frozenPage?.routeContractRef === page.routeContractRef,
    'Page or route is absent from the capture tool registration snapshot');
  const cli = join(tool, 'tools/ui-contract/cli.mjs');
  const runtime = process.permission && !process.permission.has('net')
    ? ['--permission', `--allow-fs-read=${tool}`, `--allow-fs-read=${dirname(path)}`] : [];
  const processResult = spawnSync(process.execPath, [...runtime, cli, '--case', caseId, '--replay', path,
    '--expected-root', evidence.rootSha256], {cwd:tool, encoding:'utf8', env:{TZ:'UTC'}, timeout:20_000, maxBuffer:16 * 1024 * 1024});
  requireEvidence(!processResult.error && (processResult.status === 0 || processResult.status === 1) && processResult.stdout,
    'The frozen replay tool did not produce a receipt');
  const {receipt, rootSha256} = JSON.parse(processResult.stdout);
  requireEvidence(rootSha256 === evidence.rootSha256 && receipt?.tool?.sha256 === evidence.toolSha256,
    'Frozen replay returned another root or tool identity');
  const base = dirname(path);
  const contract = readBundleReference(base, receipt.case);
  const session = readBundleReference(base, receipt.session);
  const snapshot = readBundleReference(base, receipt.candidate.snapshot);
  const scoped = {...part, pageId:page.pageId, routeContractRef:page.routeContractRef, claim};
  const matrixSamples = isSourceE3Claim(page, claim)
    ? mapping.matrix.flatMap(cell => cell.samples.filter(sample => sample.caseId === caseId))
    : [];
  admitReplayedRule({page, claim, mapping:scoped, evidence, receipt, contract, session, frozenPage, snapshot, model, currentCase,
    matrixSamples, initialEnrollment});
  return {receipt, contract, session, currentCase};
}

/** Replays immutable independently pinned evidence, then applies the owning model's exact rule mapping. */
export function checkContractReceipt(page, model, claim, evidence, selection) {
  const mapping = getClaimMapping(page, model, claim);
  requireEvidence(!Object.hasOwn(mapping, 'cases') && casePattern.test(mapping.caseId ?? '') && mapping.assertions?.length,
    'No unambiguous owner mapping for this register rule');
  if (selection) {
    requireEvidence(evidence.rootSha256 === selection.rootSha256 &&
      evidence.toolSha256 === selection.receipt.tool?.sha256 && mapping.caseId === selection.receipt.caseId &&
      compareCandidates(evidence.candidate, selection.receipt.candidate?.identity),
    'Registered evidence differs from the selected receipt, case, tool or candidate');
  }
  const {receipt, contract, currentCase} = replayClaimCase(page, model, claim, mapping, mapping, evidence);
  if (selection) {
    requireEvidence(same(receipt, selection.receipt) && same(contract, currentCase),
      'Frozen replay or current case differs from the selected receipt or its case');
    const samples = [...new Set(Object.values(currentCase.structure ?? {}))];
    requireEvidence(receipt.execution === 'PASS' && receipt.behavior === 'PASS' && receipt.observations === 'COMPLETE' &&
      receipt.structure?.behavior === 'PASS' && receipt.structure.observations === 'COMPLETE' && samples.length > 0 &&
      requireStructureProof(receipt, contract, model, samples).length > 0,
    'Page composition requires a complete passing receipt and all its necessary structure states');
  }
}

/** Parse only the selected, independently pinned case roots for a whole claim. */
export function receiptGroupRuns(group, mapping, inventory) {
  if (isSourceE2Claim(mapping,mapping.claim)) {
    const expected = sourceE2Runs(mapping,inventory);
    requireEvidence(exactKeys(group, ['schema','pageId','routeContractRef','claim','runs']) &&
      group.schema === sourceInteractionGroupSchema && group.pageId === mapping.pageId &&
      group.routeContractRef === mapping.routeContractRef && group.claim === mapping.claim &&
      Array.isArray(group.runs) && group.runs.length === expected.length &&
      group.runs.every(run=>exactKeys(run,['case','cell','receipt','expectedRoot','targetRef']) &&
        relativeEvidenceName(run.receipt) && digestPattern.test(run.expectedRoot ?? '') &&
        typeof run.targetRef === 'string' && targetRefPattern.test(run.targetRef)) &&
      new Set(group.runs.map(run=>run.receipt)).size === expected.length &&
      new Set(group.runs.map(run=>run.expectedRoot)).size === expected.length,
    'Source E2 receipt group must pin distinct native roots and exact targets for its case-window cells');
    return expected.map(({cellId,part})=>{
      const runs = group.runs.filter(run=>run.cell === cellId && run.case === part.caseId);
      requireEvidence(runs.length === 1,`Source E2 receipt group requires one native ${part.caseId} root for ${cellId}`);
      return {cellId,part,run:runs[0]};
    });
  }
  const {cases = []} = mapping;
  const pinnedTargets = group?.schema === sourceMatrixGroupSchema && isSourceE3Claim(mapping,mapping.claim);
  const runKeys = ['case','receipt','expectedRoot',...(pinnedTargets ? ['targetRef'] : [])];
  requireEvidence(Array.isArray(cases) && cases.length >= 2 &&
    cases.every(part => casePattern.test(part?.caseId ?? '') && part.assertions?.length && part.ownerSources?.length) &&
    new Set(cases.map(part => part.caseId)).size === cases.length,
    'A receipt group requires distinct mapped cases and their exact assertions and owners');
  requireEvidence(exactKeys(group, ['schema', 'pageId', 'routeContractRef', 'claim', 'runs']) &&
    (group.schema === groupSchema || pinnedTargets) && group.pageId === mapping.pageId && group.routeContractRef === mapping.routeContractRef &&
    group.claim === mapping.claim && Array.isArray(group.runs) && group.runs.length === cases.length &&
    group.runs.every(run => exactKeys(run, runKeys) &&
      relativeEvidenceName(run.receipt) && digestPattern.test(run.expectedRoot ?? '') &&
      (!pinnedTargets || typeof run.targetRef === 'string' && targetRefPattern.test(run.targetRef))) &&
    new Set(group.runs.map(run => run.receipt)).size === cases.length &&
    new Set(group.runs.map(run => run.expectedRoot)).size === cases.length,
    'Receipt group does not bind this exact page, route, claim and distinct receipt roots');
  return cases.map(part => {
    const selected = group.runs.filter(run => run.case === part.caseId);
    requireEvidence(selected.length === 1, `Receipt group needs one exact receipt for ${part.caseId}`);
    return {part, run:selected[0]};
  });
}

export function requireCompatibleClaimReceipts(members) {
  let identity;
  let window;
  const windowFields = ['widthPx', 'heightPx', 'density', 'fontScale'];
  for (const {part, receipt} of members) {
    const candidate = receipt.candidate.identity;
    requireEvidence(identity === undefined || same(identity, candidate),
      'Receipt group members differ in candidate, source, deployment or target identity');
    identity = candidate;
    for (const sampleId of new Set(part.assertions.map(assertion => assertion.sampleId))) {
      const measured = receipt.measurement?.sampleWindows?.[sampleId];
      requireEvidence(['portrait', 'landscape'].includes(measured?.orientation) &&
        windowFields.every(key => Number.isFinite(measured[key]) && measured[key] > 0),
        `Receipt group has no fixed measured window for ${part.caseId}/${sampleId}`);
      const sampleWindow = Object.fromEntries([...windowFields, 'orientation'].map(key => [key, measured[key]]));
      requireEvidence(window === undefined || same(window, sampleWindow),
        'Receipt group claim samples use different measured window configurations');
      window = sampleWindow;
    }
  }
}

/** Every member independently replays before applying the owning claim's window policy. */
export function checkContractReceiptGroup(page, model, claim, evidence) {
  const mapping = getClaimMapping(page, model, claim);
  requireEvidence(Object.hasOwn(mapping, 'cases'), 'No grouped owner mapping for this register rule');
  requireEvidence(digestPattern.test(evidence.rootSha256 ?? ''), 'Receipt group has no independently pinned root');
  const bytes = readFileSync(safePath(evidence.path));
  requireEvidence(sha256(bytes) === evidence.rootSha256, 'Receipt group differs from the registered independent root digest');
  const group = JSON.parse(bytes.toString('utf8'));
  const sourceE2 = isSourceE2Claim(page,claim);
  const inventory = sourceE2 ? readSourceE2Inventory() : undefined;
  const members = receiptGroupRuns(group, mapping, inventory);
  const pinnedTargets = [sourceMatrixGroupSchema,sourceInteractionGroupSchema].includes(group.schema);
  const targetRefs = group.schema === sourceMatrixGroupSchema
    ? new Map(members.map(({part,run}) => [part.caseId,run.targetRef])) : undefined;
  if (pinnedTargets) requireEvidence(members.some(({run})=>run.targetRef === evidence.candidate?.targetRef),
    'The registered collection target is absent from the independently pinned Source group');
  const tool = getReplayTool(evidence);
  const receipts = members.map(({part, run, cellId}) => ({
    part, cellId, targetRef:run.targetRef,
    ...replayClaimCase(page, model, claim, mapping, part, {
      ...evidence, path:join(dirname(evidence.path), run.receipt), rootSha256:run.expectedRoot,
      ...(pinnedTargets ? {candidate:{...evidence.candidate,targetRef:run.targetRef}} : {}),
    }, tool, pinnedTargets),
  }));
  if (sourceE2) requireSourceE2InteractionReceipts(mapping, inventory, receipts);
  else if (isSourceE3Claim(page, claim)) requireSourceE3MatrixReceipts(mapping, receipts, targetRefs);
  else requireCompatibleClaimReceipts(receipts);
}
