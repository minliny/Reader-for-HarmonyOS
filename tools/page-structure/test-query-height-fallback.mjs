import assert from 'node:assert/strict';
import { loadInputs, readJSON, schemaValidator } from './lib.mjs';
import { deriveStructure } from './derive-structure.mjs';
import { checkRegister } from './check-register.mjs';
import { selectContractCases, recordContractCasePass } from '../lib/contract-case-selection.mjs';

for (const id of selectContractCases({ 'query-height': 'Actual capacity derives Inline; embedded stable editors keep one primary results owner and a measured result budget.' })) {
  const model = readJSON('tools/page-structure/model.json');
  // Isolate a current real control registration. No ignored artifact or local
  // historical snapshot is a required input of this reusable framework test.
  const baseline = readJSON('tools/page-structure/register.json');
  const control = baseline.pages.find(page => page.pageId === 'directory')?.variants
    .find(variant => variant.registration.brief.queryPriority === 'primary' && variant.host.kind === 'embedded');
  assert(control, 'Real embedded control registration is the fixture basis');
  const brief = structuredClone(control.registration.brief);
  delete brief.queryViewport;
  brief.fontScale = 2;
  const before = structuredClone(brief);
  const schema = readJSON('tools/page-structure/schema/register.schema.json');
  const { ajv } = schemaValidator();
  const valid = ajv.compile({ $ref: '#/definitions/brief', definitions: schema.definitions });
  assert(valid(brief), JSON.stringify(valid.errors));
  assert.equal(deriveStructure(brief, model).query, 'HeaderSlot');
  for (const availableHeight of [122, 168, 190, 209.99]) {
    const input = { ...brief, queryViewport: { availableHeight, fixedChromeHeight: 146, minimumContentHeight: 64 } };
    assert(valid(input), JSON.stringify(valid.errors));
    const snapshot = structuredClone(input), result = deriveStructure(input, model);
    assert.equal(result.query, 'Inline');
    assert.equal(input.queryPriority, 'primary');
    for (let iteration = 0; iteration < 20; iteration++) assert.deepEqual(deriveStructure(input, model), result);
    assert.deepEqual(input, snapshot, 'Derivation never mutates measured input');
  }
  for (const availableHeight of [210, 646]) assert.equal(deriveStructure({ ...brief,
    queryViewport: { availableHeight, fixedChromeHeight: 146, minimumContentHeight: 64 } }, model).query, 'HeaderSlot');
  for (const alter of [
    value => { delete value.minimumContentHeight; }, value => { value.availableHeight = 0; },
    value => { value.availableHeight = -1; }, value => { value.fixedChromeHeight = -1; },
    value => { value.minimumContentHeight = 0; }, value => { value.fixedChromeHeight = Infinity; },
    value => { value.availableHeight = '122'; }, value => { value.fakeClass = 'constrained'; },
  ]) {
    const budget = { availableHeight: 122, fixedChromeHeight: 146, minimumContentHeight: 64 };
    alter(budget); const input = { ...brief, queryViewport: budget };
    assert(!valid(input), 'Invalid/missing geometry must fail closed');
    assert.throws(() => deriveStructure(input, model), /queryViewport/);
  }
  assert(!valid({ ...brief, queryHeightClass: 'constrained' }));
  assert.throws(() => deriveStructure({ ...brief, queryHeightClass: 'constrained' }, model), /derived/);
  const short = { availableHeight: 122, fixedChromeHeight: 146, minimumContentHeight: 64 };
  assert(!valid({ ...brief, queryPriority: 'secondary', queryViewport: short }));
  assert.throws(() => deriveStructure({ ...brief, queryPriority: 'secondary', queryViewport: short }, model), /primary queryViewport/);
  assert.throws(() => deriveStructure({ ...brief, purpose: 'search', queryViewport: short }, model), /GRAMMAR/,
    'CompoundSearch still disallows Inline; a responsive exception cannot bypass prototype grammar');
  const previous = structuredClone(model);
  previous.decisions.query.rules = previous.decisions.query.rules.filter(rule => !rule.when.queryHeightClass);
  assert.equal(deriveStructure({ ...brief, queryViewport: short }, previous).query, 'HeaderSlot', 'Negative exposes the old impossible fixed-query decision');
  const family = structuredClone(baseline.pages.find(page => page.pageId === 'directory'));
  family.variants = [structuredClone(control)];
  const registered = family.variants[0].registration;
  registered.brief.fontScale = 2;
  registered.brief.queryViewport = short;
  registered.layers.query.facts.placement = 'Inline';
  registered.layers.query.facts.entryPlacements = ['inline'];
  const input = { model, register: { ...baseline, pages: [family] }, exceptions: { exceptions: [] } };
  const report = () => checkRegister(input, { bindSource: false }).diagnostics.filter(item => item.pageId === registered.pageId);
  assert(!report().some(item => item.ruleId === 'QUERY_VIEWPORT'));
  assert(report().some(item => item.ruleId === 'SCOPE' && item.result === 'NOT_RUN'), 'Query proof does not establish whole embedded page compliance');
  registered.layers.query.facts.placement = 'HeaderSlot';
  assert(report().some(item => item.ruleId === 'QUERY_VIEWPORT' && item.result === 'FAIL'));
  registered.layers.query.facts.placement = 'Inline';
  registered.brief.queryViewport = { ...short, fixedChromeHeight: 0 };
  assert(report().some(item => item.ruleId === 'QUERY_VIEWPORT' && item.result === 'FAIL'), 'An arbitrary scroll-away preference cannot replace budget pressure');
  registered.brief.queryViewport = short;
  registered.layers.scroll.facts.primaryCount = 2;
  assert(report().some(item => item.ruleId === 'G-09' && item.result === 'FAIL'), 'The fallback cannot add an outer vertical scroll owner');
  const live = loadInputs();
  const directory = live.register.pages.find(page => page.pageId === 'directory');
  const shortVariants = directory.variants.filter(variant => variant.variantId.startsWith('control-text-short-'));
  assert.equal(shortVariants.length, 2);
  const scoped = { ...live, register: { ...live.register, pages: [{ ...directory, variants: shortVariants }] } };
  const registeredSchema = ajv.compile(schema);
  assert(registeredSchema(scoped.register), JSON.stringify(registeredSchema.errors));
  for (const variant of shortVariants) {
    const page = variant.registration;
    assert.equal(page.layers.query.facts.inlineComposition, 'boundedEditor');
    const compositions = () => checkRegister(scoped, { bindSource: false }).diagnostics.filter(item =>
      item.pageId === page.pageId && ['QUERY_VIEWPORT', 'QUERY_COMPOSITION'].includes(item.ruleId));
    assert.deepEqual(compositions(), []);
    const originalKind = variant.host.kind;
    variant.host.kind = 'route';
    assert(compositions().some(item => item.ruleId === 'QUERY_COMPOSITION'));
    variant.host.kind = originalKind;
    const budget = page.layers.informationArchitecture.facts.firstScreenBudget;
    const originalHeight = budget.filterStackHeight;
    budget.filterStackHeight = budget.viewportHeight;
    assert(compositions().some(item => item.ruleId === 'QUERY_COMPOSITION'), 'A visible editor cannot claim a result budget of zero');
    budget.filterStackHeight = originalHeight;
    page.layers.scroll.facts.primaryCount = 2;
    assert(compositions().some(item => item.ruleId === 'QUERY_COMPOSITION'), 'The editor cannot become another primary scroll owner');
    page.layers.scroll.facts.primaryCount = 1;
    assert.deepEqual(compositions(), []);
  }
  assert.deepEqual(brief, before);
  recordContractCasePass(id);
}
