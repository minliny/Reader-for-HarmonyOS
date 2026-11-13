import { readFileSync } from 'node:fs';
import { readJSON, digest, safePath } from './lib.mjs';

function sameInputs(actual, expected) {
  if (!Array.isArray(actual)) return false;
  const actualByPath = new Map(actual.map(item => [item?.path, item?.sha256]));
  const expectedByPath = new Map(expected.map(item => [item.path, item.sha256]));
  // Registrations may repeat the main source in sourceInputs. Identical
  // bindings form one input, while conflicting hashes for one path fail.
  if (actual.some(item => typeof item?.path !== 'string' || typeof item.sha256 !== 'string' ||
      actualByPath.get(item.path) !== item.sha256) ||
    expected.some(item => expectedByPath.get(item.path) !== item.sha256)) return false;
  return actualByPath.size === expectedByPath.size &&
    [...expectedByPath].every(([path, sha256]) => actualByPath.get(path) === sha256);
}

/** Resolves independent source and declared approval scope. This never grants
 * visual acceptance from source matching, a derived Figma frame or an SDK run. */
export function checkDesignAuthority(page, authority = readJSON('tools/contracts/design-authority.json'), sourceDigests = new Map()) {
  const reference = page.layers.visual.facts.designContractRef;
  const contract = authority.contracts.find(item => item.id === reference);
  const failures = [];
  if (!contract) return [{ rule: 'DESIGN_REFERENCE', pageId: page.pageId, message: 'Design contract reference does not resolve' }];
  const references = contract.referenceIds.map(id => authority.references.find(item => item.id === id));
  for (const item of references) {
    if (!item) failures.push({ rule: 'DESIGN_REFERENCE', pageId: page.pageId, message: 'Independent design source reference does not resolve' });
    else {
      try {
        if (!sourceDigests.has(item.path)) sourceDigests.set(item.path, digest(item.path));
        if (sourceDigests.get(item.path) !== item.sha256) failures.push({ rule: 'DESIGN_SOURCE_DRIFT', pageId: page.pageId, message: item.path });
      } catch (error) {
        failures.push({ rule: 'DESIGN_SOURCE_MISSING', pageId: page.pageId, message: String(error.message) });
      }
    }
  }
  if (page.layers.visual.result !== 'PASS') return failures;
  const wholePageSources = (contract.wholePageReferenceIds ?? []).map(id =>
    references.find(item => item?.id === id));
  if (!contract.wholePageApproved || contract.approvalScope !== 'WHOLE_PAGE' ||
    contract.currentComparison !== 'MATCHED_CURRENT_CANDIDATE' || contract.nativeAcceptance !== 'PASS' ||
    wholePageSources.length === 0 || wholePageSources.some(item => !item || item.approvalScope !== 'WHOLE_PAGE' ||
      !['approved-design', 'original-design-extract'].includes(item.kind))) {
    failures.push({ rule: 'DESIGN_ACCEPTANCE', pageId: page.pageId,
      message: 'Whole-page visual PASS requires independent whole-page approved sources' });
  }
  const candidate = contract.currentCandidate;
  const expectedInputs = [page.source, ...(page.sourceInputs ?? [])];
  if (!candidate || candidate.sourcePath !== page.source.path || candidate.sourceSha256 !== page.source.sha256 ||
    !sameInputs(candidate.inputs, expectedInputs)) {
    failures.push({ rule: 'DESIGN_CANDIDATE', pageId: page.pageId, message: 'Current comparison must bind the complete registered source input set' });
  } else {
    for (const input of expectedInputs) {
      try {
        if (!sourceDigests.has(input.path)) sourceDigests.set(input.path, digest(input.path));
        if (sourceDigests.get(input.path) !== input.sha256) failures.push({ rule: 'DESIGN_CANDIDATE_DRIFT', pageId: page.pageId, message: input.path });
      } catch (error) { failures.push({ rule: 'DESIGN_CANDIDATE_MISSING', pageId: page.pageId, message: String(error.message) }); }
    }
  }
  const designInputs = [...new Map(references.filter(Boolean).map(item =>
    [item.path, { path: item.path, sha256: item.sha256 }])).values()];
  for (const [kind, reference] of [['comparison', contract.comparisonEvidenceRef], ['native', contract.nativeEvidenceRef]]) {
    try {
      if (!reference || digest(reference.path) !== reference.sha256) throw Error('Missing or changed evidence reference');
      const evidence = JSON.parse(readFileSync(safePath(reference.path), 'utf8'));
      if (evidence.kind !== kind || evidence.coverage !== 'whole-page' || evidence.result !== 'PASS' ||
        evidence.pageId !== page.pageId || evidence.sourcePath !== page.source.path ||
        evidence.sourceSha256 !== candidate?.sourceSha256 || !sameInputs(evidence.inputs, expectedInputs) ||
        !sameInputs(evidence.designInputs, designInputs))
        throw Error('Evidence coverage, page, complete current source inputs or design inputs do not match');
    } catch (error) { failures.push({ rule: 'DESIGN_EVIDENCE', pageId: page.pageId, message: `${kind}: ${error.message}` }); }
  }
  return failures;
}
