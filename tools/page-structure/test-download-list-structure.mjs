import assert from 'node:assert/strict';
import { readJSON } from './lib.mjs';
import { deriveStructure } from './derive-structure.mjs';
import { selectContractCases, recordContractCasePass } from '../lib/contract-case-selection.mjs';

const definitions = { 'browse-list': { description: 'Non-immersive collection can explicitly allow its title to scroll away; persistent navigation and illegal prototypes stay constrained', resources: [] } };
for (const id of selectContractCases(definitions)) {
  const model = readJSON('tools/page-structure/model.json');
  const brief = { pageId: 'downloads', role: 'secondary', purpose: 'browse', content: 'collection',
    queryPriority: 'secondary', queryComplexity: 'simple', queryFrequency: 'frequent', collectionLength: 'long',
    navigationPersistence: 'optional', alternateNavigation: false, contentImmersive: false, titleCanExit: true,
    primaryActionScope: 'global', selectionMode: 'none', widthClass: 'compact', fontScale: 1,
    stateSet: [], messageSet: [], platformSet: [] };
  const inputBytes = JSON.stringify({ brief, model });
  const infer = patch => deriveStructure({ ...brief, ...patch }, model);
  const result = infer({});
  assert.equal(result.prototype, 'SecondaryCollectionPage');
  assert.equal(result.headerRole, 'Back');
  assert.equal(result.header, 'ScrollAway', 'ordinary collection need not claim immersive content to scroll its title');
  assert.equal(result.query, 'Inline');
  assert.equal(infer({ navigationPersistence: 'required' }).header, 'Fixed', 'persistent navigation takes precedence');
  assert.equal(infer({ titleCanExit: false }).header, 'Fixed', 'ordinary title cannot leave without an explicit intent');
  assert.equal(infer({ contentImmersive: true, titleCanExit: false }).header, 'Floating');
  assert.equal(infer({ contentImmersive: true }).header, 'ScrollAway');
  assert.throws(() => infer({ purpose: 'select', selectionMode: 'multi' }), /GRAMMAR/, 'SelectionPage still requires persistent contextual header');
  assert.throws(() => infer({ navigationPersistence: 'UNRESOLVED' }), /unresolved/);
  assert.equal(JSON.stringify({ brief, model }), inputBytes, 'inference does not rewrite the decision inputs');
  const previousRuleModel = structuredClone(model);
  previousRuleModel.decisions.header.rules = previousRuleModel.decisions.header.rules.filter(rule =>
    !(rule.when.navigationPersistence === 'optional' && rule.when.contentImmersive === false && rule.when.titleCanExit === true));
  assert.equal(deriveStructure(brief, previousRuleModel).header, 'Fixed', 'negative control exposes the previous missing ordinary-list branch');
  recordContractCasePass(id);
}
