import { canonicalAppJson } from '../../scripts/lib/app-build-identity.mjs';
import { requireEvidence } from '../lib/native-ui-evidence.mjs';

export const isSourceE3Claim = (page, claim) => page.pageId === 'source-management' && claim === 'invariants.E3';
const orientations = ['portrait', 'landscape'];
const compactWidths = [320, 366];
const compactScales = [1, 1.3, 1.45, 1.6, 2];
const conditionalScopes = new Set(['read-failed', 'retained-read-failed', 'operation-recovery']);
const defaultRoles = ['stats', 'status/all', 'category/all', 'group/label', 'footer/manage', 'footer/add', 'row/category', 'row/detect'];
const scopeRoles = new Map([
  ['default', defaultRoles],
  ['expanded', defaultRoles],
  ['status-filter', ['status/all', 'status/enabled', 'status/error', 'status/unchecked', 'status/custom']],
  ['category-filter', ['category/all', 'category/novel', 'category/comic', 'category/music', 'category/download', 'category/external', 'category/other']],
  ['group-menu', ['group/option-head', 'group/option-tail']],
  ['row-actions', ['row/login']],
  ['read-empty', ['read/empty-title', 'read/empty-message', 'footer/add']],
  ['read-failed', ['read/failure-title', 'read/failure-message', 'read/retry']],
  ['retained-read-failed', ['read/retained-status', 'read/retained-retry']],
  ['operation-status', ['operation/status', 'operation/action']],
  ['operation-recovery', [
    'recovery/original/message', 'recovery/original/expand', 'recovery/original/reconcile', 'recovery/original/continue',
    'recovery/unknown/message', 'recovery/unknown/expand', 'recovery/unknown/reconcile',
  ]],
]);
const same = (left, right) => canonicalAppJson(left) === canonicalAppJson(right);
const positive = value => Number.isFinite(value) && value > 0;
const nonempty = value => typeof value === 'string' && value.length > 0;
const positiveInt = value => Number.isSafeInteger(value) && value > 0;
const within = (actual, expected, tolerance) =>
  Number.isFinite(actual) && Number.isFinite(expected) && Math.abs(actual - expected) <= tolerance;
const sampleKey = ({caseId, sampleId}) => JSON.stringify([caseId, sampleId]);
const assertionKey = (caseId, id) => JSON.stringify([caseId, id]);
const configuration = cell => [cell.widthVp, cell.heightVp, cell.fontScale, cell.orientation];
const fullRoleSet = (roles, required) => required.every(role => roles?.has(role));

function matrixEvidence(condition, message) {
  requireEvidence(condition, `Source E3 requires the complete measured window and text-role matrix: ${message}`);
}

function appliedSampleCondition(definition, receipt) {
  const observed = receipt.conditions?.[definition?.id];
  return nonempty(definition?.condition) && observed?.status === 'APPLIES' &&
    observed.required === true && observed.sampleApplies === true;
}

export function requiresSourceE3Assertion(definition, receipt) {
  return definition?.condition === undefined ? definition?.required === true : appliedSampleCondition(definition, receipt);
}

export const completeSourceE3Receipt = receipt =>
  receipt?.observations === 'COMPLETE' && receipt.execution === 'PASS' && receipt.behavior === 'PASS';

/** The model names the evidence. The required configurations and scopes cannot be dropped by the mapping. */
export function requireSourceE3Matrix(mapping) {
  matrixEvidence(Array.isArray(mapping?.cases) && Array.isArray(mapping.matrix) && mapping.matrix.length > 0,
    'a model-owned grouped admission is missing');
  const parts = new Map();
  for (const part of mapping.cases) {
    matrixEvidence(nonempty(part?.caseId) && !parts.has(part.caseId) &&
      Array.isArray(part.assertions) && part.assertions.length > 0 &&
      Array.isArray(part.ownerSources) && part.ownerSources.length > 0, 'mapped cases and their owners must be distinct');
    const assertions = new Map();
    for (const assertion of part.assertions) {
      matrixEvidence(nonempty(assertion?.id) && nonempty(assertion.sampleId) && !assertions.has(assertion.id),
        `duplicate or invalid mapped assertion in ${part.caseId}`);
      assertions.set(assertion.id, assertion.sampleId);
    }
    parts.set(part.caseId, assertions);
  }
  const cellKeys = new Set();
  const samples = new Set();
  const textByAssertion = new Map();
  const scopesByCell = new Map();
  for (const cell of mapping.matrix) {
    matrixEvidence(cell && [cell.widthVp, cell.heightVp, cell.fontScale].every(positive) &&
      orientations.includes(cell.orientation) && Array.isArray(cell.samples) && cell.samples.length > 0,
    'each cell needs one width, height, scale, orientation and its case samples');
    const key = JSON.stringify(configuration(cell));
    matrixEvidence(!cellKeys.has(key), `duplicate window cell ${key}`);
    cellKeys.add(key);
    const byScope = new Map();
    scopesByCell.set(cell, byScope);
    for (const sample of cell.samples) {
      const assertions = parts.get(sample?.caseId);
      matrixEvidence(assertions && nonempty(sample.sampleId) && scopeRoles.has(sample.scope) &&
        Array.isArray(sample.textAssertions) && sample.textAssertions.length > 0,
      `invalid case sample or scope in cell ${key}`);
      const nativeSample = sampleKey(sample);
      matrixEvidence(!samples.has(nativeSample), `duplicate window sample ${sample.caseId}/${sample.sampleId}`);
      samples.add(nativeSample);
      const roles = byScope.get(sample.scope) ?? new Set();
      byScope.set(sample.scope, roles);
      for (const text of sample.textAssertions) {
        matrixEvidence(assertions.has(text?.id) && Array.isArray(text.roles) && text.roles.length > 0,
          `text assertion is not mapped to ${sample.caseId}/${sample.sampleId}`);
        const id = assertionKey(sample.caseId, text.id);
        const binding = textByAssertion.get(id) ?? {cell, scope:sample.scope, roles:new Map()};
        matrixEvidence(binding.cell === cell && binding.scope === sample.scope,
          `text assertion ${text.id} cannot span window cells or scopes`);
        textByAssertion.set(id, binding);
        for (const role of text.roles) {
          const allowedSamples = binding.roles.get(role) ?? new Set();
          matrixEvidence(nonempty(role) && !allowedSamples.has(sample.sampleId),
            `invalid or duplicate role in ${sample.caseId}/${text.id}`);
          allowedSamples.add(sample.sampleId);
          binding.roles.set(role, allowedSamples);
          roles.add(role);
        }
      }
    }
  }
  for (const [caseId, assertions] of parts) {
    for (const [id, sampleId] of assertions) {
      matrixEvidence(samples.has(sampleKey({caseId, sampleId})), `mapped assertion ${caseId}/${id} has no window sample`);
    }
  }
  const completeCells = scope => mapping.matrix.filter(cell => fullRoleSet(scopesByCell.get(cell).get(scope), scopeRoles.get(scope)));
  for (const width of compactWidths) {
    for (const scale of compactScales) {
      const defaults = mapping.matrix.filter(cell => cell.widthVp === width && cell.fontScale === scale &&
        scopesByCell.get(cell).has('default'));
      matrixEvidence(defaults.length === 1 && completeCells('default').includes(defaults[0]),
        `need one default ${width}vp / ${scale}× cell with its complete roles`);
    }
    for (const scope of ['status-filter', 'category-filter']) {
      matrixEvidence(completeCells(scope).some(cell => cell.widthVp === width && cell.fontScale === 2),
        `missing ${width}vp / 2× ${scope} roles`);
    }
  }
  matrixEvidence(completeCells('expanded').some(cell => cell.widthVp >= 600),
    'missing expanded window and roles');
  for (const scope of ['group-menu', 'row-actions', 'read-empty', ...conditionalScopes, 'operation-status']) {
    matrixEvidence(completeCells(scope).length > 0, `missing required ${scope} roles`);
  }
  return {textByAssertion};
}

function measuredWindow(receipt, cell, sample) {
  const measured = receipt.measurement?.sampleWindows?.[sample.sampleId];
  const {widthPx, heightPx, density, fontScale, orientation} = measured ?? {};
  matrixEvidence([widthPx, heightPx, density, fontScale].every(positive) && orientation === cell.orientation &&
    within(widthPx, cell.widthVp * density, 1.01) && within(heightPx, cell.heightVp * density, 1.01) &&
    within(fontScale, cell.fontScale, .010001),
  `wrong native window for ${sample.caseId}/${sample.sampleId}`);
  return {widthPx, heightPx, density, fontScale, orientation};
}

function nativeTextProof(actual, window, bound) {
  const {nativeFont, scale, widthVp, textProjectionRevision} = actual ?? {};
  const {fpPixels, vpPixels, followsSystemFontScale, effectiveScale, maxFontScale} = nativeFont ?? {};
  matrixEvidence(positiveInt(textProjectionRevision) && within(scale, window.fontScale, .010001) &&
    within(widthVp * window.density, window.widthPx, 1.01) &&
    [fpPixels, vpPixels, effectiveScale].every(positive) && followsSystemFontScale === true &&
    within(effectiveScale, fpPixels / vpPixels, .000001) &&
    within(effectiveScale, window.fontScale, .010001) &&
    (maxFontScale === null || positive(maxFontScale) && maxFontScale + .010001 >= effectiveScale),
  `missing current projection or matching native font readback for ${bound}`);
}

function completeRole(witness, allowedSamples, primarySampleId) {
  const actual = witness?.actual;
  return witness?.verdict === 'PASS' && allowedSamples.has(actual?.sampleId ?? primarySampleId) &&
    nonempty(actual?.path) && positiveInt(actual.utf16Length) && actual.startUtf16 === 0 &&
    actual.endUtf16 === actual.utf16Length &&
    [actual.lineCount, actual.rangeCount, actual.tailCount].every(positiveInt);
}

function requireRowStatusBadge(definitions, receipt, sample) {
  const definition = definitions.find(item => item.evaluator === 'source' && item.kind === 'row-status-badge');
  const badge = receipt.assertions.find(record => record.id === definition?.id);
  const measured = badge?.actual;
  const textIds = new Set(sample.textAssertions.map(text => text.id));
  const rowText = receipt.assertions.filter(record => textIds.has(record.id));
  matrixEvidence(requiresSourceE3Assertion(definition, receipt) && badge?.verdict === 'PASS' &&
    measured?.sampleId === sample.sampleId && positiveInt(measured.rowAnchor) &&
    nonempty(measured.state) && measured.state === definition.expected?.state &&
    nonempty(measured.carrierPath) && nonempty(measured.vectorPath) &&
    measured.vectorPath.startsWith(measured.carrierPath + '/') &&
    rowText.length > 0 && rowText.every(record => record.actual?.rowAnchor === measured.rowAnchor),
  `missing same-row native status badge for ${sample.caseId}/${sample.sampleId}`);
}

function signedCandidate(candidate) {
  const {appBuildId,appContentHash,hapSha256,sourceFingerprint,buildRunId,targetKind} = candidate;
  return {appBuildId,appContentHash,hapSha256,sourceFingerprint,buildRunId,targetKind};
}

/** Consume evidence already verified by independent replay and exact native sample/owner checks. */
export function requireSourceE3MatrixReceipts(mapping, members, targetRefs) {
  const {textByAssertion} = requireSourceE3Matrix(mapping);
  if (targetRefs) matrixEvidence(targetRefs.size === mapping.cases.length, 'missing pinned deployment targets');
  const receipts = new Map();
  let identity;
  for (const {part, receipt, contract} of members) {
    const candidate = receipt?.candidate?.identity;
    matrixEvidence(candidate && nonempty(candidate.appBuildId) && receipt.caseId === part.caseId &&
      contract?.id === part.caseId && !receipts.has(part.caseId),
    `wrong or duplicate candidate receipt for ${part.caseId}`);
    if (targetRefs) matrixEvidence(nonempty(candidate.hdcServer) && nonempty(candidate.targetRef) &&
      targetRefs.get(part.caseId) === candidate.targetRef,
      `wrong deployment target for ${part.caseId}`);
    const compared = targetRefs ? signedCandidate(candidate) : candidate;
    matrixEvidence(!identity || same(identity, compared), targetRefs
      ? `wrong signed candidate for ${part.caseId}` : `wrong or duplicate candidate receipt for ${part.caseId}`);
    matrixEvidence(completeSourceE3Receipt(receipt), `incomplete native receipt for ${part.caseId}`);
    identity = compared;
    receipts.set(part.caseId, {receipt, contract});
  }
  matrixEvidence(receipts.size === mapping.cases.length &&
    mapping.cases.every(part => receipts.has(part.caseId)), 'missing mapped case receipts');
  const observedWindows = new Set();
  for (const cell of mapping.matrix) {
    let window;
    let deployment;
    for (const sample of cell.samples) {
      const {receipt, contract} = receipts.get(sample.caseId);
      const {hdcServer,targetRef} = receipt.candidate.identity;
      const currentDeployment = {hdcServer,targetRef};
      matrixEvidence(!deployment || same(deployment,currentDeployment), 'samples in one matrix cell use different collection targets');
      deployment = currentDeployment;
      const measured = measuredWindow(receipt, cell, sample);
      matrixEvidence(!window || same(window, measured), 'samples in one matrix cell use different native windows');
      window = measured;
      const part = mapping.cases.find(value => value.caseId === sample.caseId);
      const assertionIds = new Set(part.assertions.filter(item => item.sampleId === sample.sampleId).map(item => item.id));
      const definitions = contract.assertions.filter(assertion => assertionIds.has(assertion.id));
      if (['default', 'expanded'].includes(sample.scope)) {
        const sampleKinds = definitions.filter(assertion => assertion.evaluator === 'source').map(assertion => assertion.kind);
        matrixEvidence(['adaptation', 'adaptation-surface'].every(kind => sampleKinds.includes(kind)),
          `missing chip, row and footer growth budget for ${sample.caseId}/${sample.sampleId}`);
      }
      if (conditionalScopes.has(sample.scope)) {
        matrixEvidence(definitions.some(definition => appliedSampleCondition(definition, receipt)),
        `missing applicable current condition for ${sample.caseId}/${sample.sampleId}`);
      }
      for (const {id, roles} of sample.textAssertions) {
        const bound = `${sample.caseId}/${sample.sampleId}/${id}`;
        const definition = contract.assertions.find(assertion => assertion.id === id);
        const [record, ...duplicate] = receipt.assertions.filter(assertion => assertion.id === id);
        const actual = record?.actual;
        const scope = actual?.textScope ?? (definition?.kind === 'adaptation-text'
          ? (definition.expected?.expanded ? 'expanded' : 'default')
          : undefined);
        const mapped = textByAssertion.get(assertionKey(sample.caseId, id)).roles;
        const actualRoles = actual?.roles ? Object.keys(actual.roles) : [];
        matrixEvidence(definition?.evaluator === 'source' && requiresSourceE3Assertion(definition, receipt) &&
          ['native-tree', 'window-metrics', 'app-owner'].every(source => definition.sources?.includes(source)) &&
          scope === sample.scope && record?.verdict === 'PASS' && duplicate.length === 0 &&
          actual?.sampleId === definition.sample && actualRoles.length === mapped.size &&
          actualRoles.every(role => mapped.has(role)),
        `wrong or incomplete scoped text assertion for ${bound}`);
        const text = actual.sampleId === sample.sampleId ? actual : actual.sampleProofs?.[sample.sampleId];
        nativeTextProof(text, window, bound);
        matrixEvidence(roles.every(role => completeRole(actual.roles[role], mapped.get(role), actual.sampleId)),
          `wrong role or incomplete native line and trailing range for ${bound}`);
      }
      if (sample.scope === 'row-actions') requireRowStatusBadge(definitions, receipt, sample);
    }
    const key = canonicalAppJson(window);
    matrixEvidence(!observedWindows.has(key), 'duplicate measured native window cells');
    observedWindows.add(key);
  }
}
