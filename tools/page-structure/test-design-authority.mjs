import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { readJSON, registrations, root, digest } from './lib.mjs';
import { checkDesignAuthority } from './design-authority.mjs';
import { selectContractCases, recordContractCasePass } from '../lib/contract-case-selection.mjs';
for (const id of selectContractCases({ authority: { description: 'Current page design references resolve and reject partial/source-derived approval or absent current-candidate acceptance.', resources: [] } })) {
  const authority = readJSON('tools/contracts/design-authority.json');
  const pages = registrations(readJSON('tools/page-structure/register.json')).map(row => row.page);
  for (const page of pages) assert.deepEqual(checkDesignAuthority(page, authority), []);
  const page = structuredClone(pages[0]);
  page.layers.visual.result = 'PASS';
  assert.ok(checkDesignAuthority(page, authority).some(item => item.rule === 'DESIGN_ACCEPTANCE'));
  const sourceDerived = structuredClone(authority);
  const contract = sourceDerived.contracts.find(item => item.id === page.layers.visual.facts.designContractRef);
  Object.assign(contract, { wholePageApproved: true, approvalScope: 'WHOLE_PAGE', currentComparison: 'MATCHED_CURRENT_CANDIDATE', nativeAcceptance: 'PASS' });
  sourceDerived.references.find(item => item.id === contract.referenceIds[0]).kind = 'source-derived';
  assert.ok(checkDesignAuthority(page, sourceDerived).some(item => item.rule === 'DESIGN_ACCEPTANCE'));
  const noCandidate = structuredClone(sourceDerived);
  noCandidate.references.find(item => item.id === contract.referenceIds[0]).kind = 'approved-design';
  const noCandidateFailures = checkDesignAuthority(page, noCandidate);
  assert.ok(noCandidateFailures.some(item => item.rule === 'DESIGN_CANDIDATE'));
  assert.ok(noCandidateFailures.some(item => item.rule === 'DESIGN_EVIDENCE'));
  const absentFile = structuredClone(authority);
  absentFile.references.find(item => item.id === absentFile.contracts[0].referenceIds[0]).path = 'docs/absent-ui-design-reference.json';
  assert.ok(checkDesignAuthority(pages[0], absentFile).some(item => item.rule === 'DESIGN_SOURCE_MISSING'));
  const missing = structuredClone(pages[0]); missing.layers.visual.facts.designContractRef = 'unknown';
  assert.ok(checkDesignAuthority(missing, authority).some(item => item.rule === 'DESIGN_REFERENCE'));
  verifyCompleteEvidenceBindings(pages[0]);
  console.log(JSON.stringify({ kind: 'design-authority', pages: pages.length, routes: authority.routes.length,
    boundary: 'Approval/source association and rejection of unsupported claims. No whole-page visual or Native acceptance.' }));
  recordContractCasePass(id);
}

// Synthetic metadata exercises association rules only. These files contain no
// product comparison, screenshot, approval or Native acceptance evidence.
function verifyCompleteEvidenceBindings(template) {
  const artifactRoot = join(root, '.reader-artifacts');
  mkdirSync(artifactRoot, { recursive: true });
  const fixtureRoot = mkdtempSync(join(artifactRoot, 'design-authority-fixture-'));
  const write = (name, contents) => {
    const path = relative(root, join(fixtureRoot, name));
    writeFileSync(join(fixtureRoot, name), contents);
    return { path, sha256: digest(path) };
  };
  try {
    const page = structuredClone(template);
    page.pageId = 'synthetic-design-authority-page';
    page.source = write('main.ets', '// Synthetic main source v1\n');
    page.sourceInputs = [structuredClone(page.source), write('shared.ets', '// Synthetic shared dependency v1\n')];
    page.layers.visual.result = 'PASS';
    page.layers.visual.facts.designContractRef = 'synthetic-whole-page';
    const design = { id: 'synthetic-approved-design', kind: 'approved-design', approvalScope: 'WHOLE_PAGE',
      ...write('design.html', '<main>Synthetic design v1</main>') };
    const contract = { id: 'synthetic-whole-page', referenceIds: [design.id], wholePageReferenceIds: [design.id],
      wholePageApproved: true, approvalScope: 'WHOLE_PAGE', currentComparison: 'MATCHED_CURRENT_CANDIDATE',
      nativeAcceptance: 'PASS', currentCandidate: { sourcePath: page.source.path, sourceSha256: page.source.sha256,
        inputs: [page.source, ...page.sourceInputs] } };
    const authority = { references: [design], contracts: [contract] };
    const updateEvidence = () => {
      for (const kind of ['comparison', 'native']) {
        const evidence = { fixturePurpose: 'synthetic-validator-test', kind, coverage: 'whole-page', result: 'PASS',
          pageId: page.pageId, sourcePath: page.source.path, sourceSha256: page.source.sha256,
          inputs: [page.source, ...page.sourceInputs], designInputs: [{ path: design.path, sha256: design.sha256 }] };
        contract[kind + 'EvidenceRef'] = write(kind + '.json', JSON.stringify(evidence));
      }
    };
    updateEvidence();
    assert.deepEqual(checkDesignAuthority(page, authority), [], 'complete synthetic association is accepted');
    contract.currentCandidate.inputs.push({ ...page.sourceInputs.at(-1), sha256: '0'.repeat(64) });
    assert.ok(checkDesignAuthority(page, authority).some(row => row.rule === 'DESIGN_CANDIDATE'),
      'conflicting duplicate bindings cannot stand in for a complete current candidate');
    contract.currentCandidate.inputs.pop();

    page.sourceInputs = [write('shared.ets', '// Synthetic shared dependency v2\n')];
    contract.currentCandidate.inputs = [page.source, ...page.sourceInputs];
    const changedDependency = checkDesignAuthority(page, authority);
    assert.equal(changedDependency.filter(row => row.rule === 'DESIGN_EVIDENCE').length, 2,
      'both old comparison and Native records expire when a shared input changes');
    assert.equal(changedDependency.some(row => row.rule.startsWith('DESIGN_CANDIDATE')), false,
      'current candidate is complete, so the failure specifically belongs to stale evidence');
    updateEvidence();
    assert.deepEqual(checkDesignAuthority(page, authority), []);

    design.sha256 = write('design.html', '<main>Synthetic design v2</main>').sha256;
    const changedDesign = checkDesignAuthority(page, authority);
    assert.equal(changedDesign.filter(row => row.rule === 'DESIGN_EVIDENCE').length, 2,
      'both old records expire when the independently bound design source changes');
    updateEvidence();
    assert.deepEqual(checkDesignAuthority(page, authority), []);

    contract.nativeEvidenceRef = { path: relative(root, join(fixtureRoot, 'missing-native.json')), sha256: '0'.repeat(64) };
    assert.ok(checkDesignAuthority(page, authority).some(row => row.rule === 'DESIGN_EVIDENCE' && row.message.startsWith('native:')));
    updateEvidence();
    rmSync(join(fixtureRoot, 'shared.ets'));
    assert.ok(checkDesignAuthority(page, authority).some(row => row.rule === 'DESIGN_CANDIDATE_MISSING'));
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}
