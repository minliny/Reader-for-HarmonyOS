import assert from 'node:assert/strict';
import { readJSON, registrations } from './lib.mjs';
import { deriveStructure, prototypeForBrief } from './derive-structure.mjs';
import { selectContractCases, recordContractCasePass } from '../lib/contract-case-selection.mjs';

for (const id of selectContractCases({ 'direct-selection': 'Actual manga target-selection registrations use direct single-row commit with Back; confirmation/multi-selection grammar stays contextual and requires a footer.' })) {
  const model = readJSON('tools/page-structure/model.json');
  const pages = registrations(readJSON('tools/page-structure/register.json')).map(x => x.page)
    .filter(p => p.brief.purpose === 'select');
  assert(pages.length >= 4);
  for (const page of pages) {
    const derived = deriveStructure(page.brief, model);
    assert.equal(derived.prototype, 'SelectionPage');
    assert.equal(derived.headerRole, page.layers.header.facts.role);
    assert.equal(derived.primaryAction, 'Row');
    assert(!prototypeForBrief(page.brief, model).regions.includes('footer'));
    const confirmed = { ...page.brief, primaryActionScope: 'global' };
    assert.equal(deriveStructure(confirmed, model).headerRole, 'Contextual');
    assert(prototypeForBrief(confirmed, model).regions.includes('footer'));
    assert.equal(deriveStructure({ ...confirmed, selectionMode: 'multi' }, model).headerRole, 'Contextual');
    assert.throws(() => deriveStructure({ ...page.brief, selectionMode: 'multi' }, model), /global commit/);
    assert.throws(() => deriveStructure({ ...page.brief, primaryActionScope: 'none' }, model), /global commit/);
    assert.throws(() => deriveStructure({ ...page.brief, navigationPersistence: 'optional', titleCanExit: true }, model), /GRAMMAR/);
    const previous = structuredClone(model);
    delete previous.prototypes.find(p => p.id === 'SelectionPage').compositionVariants;
    assert.notEqual(deriveStructure(page.brief, previous).headerRole, page.layers.header.facts.role,
      'negative control exposes the former Contextual-only mismatch');
  }
  assert.equal(model.prototypes.length, 6, 'direct selection is composition within the existing prototype');
  recordContractCasePass(id);
}
