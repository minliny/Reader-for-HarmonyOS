import { sourceUnknownWriteAction, usesSourceUnknownExpand } from './source-unknown-expand.mjs';
import { readFileSync } from 'node:fs';
import { conditionBoundSourceKinds } from './source-read.mjs';
import { isReservedTypographyCase, reservedSourceSample } from './source-reserved-typography.mjs';

const modelUrl = new URL('../../page-structure/model.json', import.meta.url);
const idPattern = /^[a-zA-Z][a-zA-Z0-9_.:-]*$/u;
const id = value => typeof value === 'string' && idPattern.test(value);
const map = value => value && typeof value === 'object' && !Array.isArray(value);
const listOfIds = value => Array.isArray(value) && value.every(id) && new Set(value).size === value.length;
const fraction = value => Number.isFinite(value) && value >= 0 && value <= 1;
const hasOnly = (value, keys) => Object.keys(value).every(key => keys.includes(key));

function expect(valid, message) {
  if (!valid) throw new Error(`Structure definition: ${message}`);
}

const checkParameters = {
  present: [],
  absent: [],
  enabled: ['value'],
  descendant: ['ancestor'],
  inFrontOf: ['behind', 'optionalBehind'],
  opacity: ['min', 'max', 'optional'],
  backgroundAlpha: ['min', 'max'],
};

function validateSelectors(selectors) {
  for (const [name, selector] of Object.entries(selectors)) {
    expect(id(name) && map(selector), `invalid selector ${name}`);
    const alternatives = [
      hasOnly(selector, ['ids']) && listOfIds(selector.ids) && selector.ids.length > 0,
      hasOnly(selector, ['prefix']) && id(selector.prefix),
      hasOnly(selector, ['fixtureCard']) && selector.fixtureCard === true,
      hasOnly(selector, ['bookCard']) && selector.bookCard === true,
      hasOnly(selector, ['sheetTitle']) && typeof selector.sheetTitle === 'string' && selector.sheetTitle.trim().length > 0,
      hasOnly(selector, ['under', 'role', 'paintId']) && selector.role === 'scrim' && id(selector.under) &&
        (selector.paintId === undefined || id(selector.paintId)),
      hasOnly(selector, ['ancestorOf', 'role']) && selector.role === 'opaqueSurface' && id(selector.ancestorOf),
    ];
    expect(alternatives.some(Boolean), `unrecognized selector ${name}`);
  }
  for (const name of Object.keys(selectors)) {
    const seen = new Set();
    for (let cursor = name; cursor; cursor = selectors[cursor].under ?? selectors[cursor].ancestorOf) {
      expect(Object.hasOwn(selectors, cursor) && !seen.has(cursor), `unknown or circular selector ${name} → ${cursor}`);
      seen.add(cursor);
    }
  }
}

export function structureRuleOrder(ruleId, rules, ordered = new Map(), visiting = new Set()) {
  if (ordered.has(ruleId)) return [...ordered.values()];
  expect(!visiting.has(ruleId), `circular necessary dependency at ${ruleId}`);
  const rule = rules.get(ruleId);
  expect(rule, `unknown necessary rule ${ruleId}`);
  visiting.add(ruleId);
  for (const required of rule.requires) structureRuleOrder(required, rules, ordered, visiting);
  visiting.delete(ruleId);
  ordered.set(ruleId, rule);
  return [...ordered.values()];
}

export function validateStructureDefinition(model) {
  const { structureRules, structureSelectors, scenarioObligations, structureFoundations } = model;
  expect(Array.isArray(structureRules) && structureRules.length > 0 && map(structureSelectors) &&
    map(structureFoundations) && Array.isArray(scenarioObligations) && scenarioObligations.length > 0,
  'missing rules, selectors, foundational requirements or scenario obligations');
  validateSelectors(structureSelectors);
  const layers = new Set(model.layers.map(layer => layer.id));
  const rules = new Map();
  for (const rule of structureRules) {
    expect(map(rule) && hasOnly(rule, ['id', 'layer', 'basis', 'requires', 'checks']) &&
      id(rule.id) && !rules.has(rule.id) && layers.has(rule.layer) && typeof rule.basis === 'string' &&
      rule.basis.trim() && listOfIds(rule.requires) && Array.isArray(rule.checks) && rule.checks.length > 0,
    `invalid rule ${rule?.id}`);
    for (const check of rule.checks) {
      expect(map(check) && Object.hasOwn(checkParameters, check.kind) &&
        hasOnly(check, ['kind', 'node', ...checkParameters[check.kind]]) &&
        Object.hasOwn(structureSelectors, check.node), `unknown check or selector in ${rule.id}`);
      if (check.kind === 'descendant') {
        expect(Object.hasOwn(structureSelectors, check.ancestor), `unknown ancestor in ${rule.id}`);
      }
      if (check.kind === 'inFrontOf') {
        expect(Object.hasOwn(structureSelectors, check.behind) && check.behind !== check.node &&
          (check.optionalBehind === undefined || check.optionalBehind === true), `invalid foreground check in ${rule.id}`);
      }
      if (['opacity', 'backgroundAlpha'].includes(check.kind)) {
        expect(fraction(check.min) && fraction(check.max) && check.min <= check.max, `invalid alpha range in ${rule.id}`);
      }
      if (check.kind === 'opacity') expect(check.optional === undefined || check.optional === true, `invalid optional opacity in ${rule.id}`);
      if (check.kind === 'enabled') expect(typeof check.value === 'boolean', `invalid enabled expectation in ${rule.id}`);
    }
    rules.set(rule.id, rule);
  }
  for (const rule of rules.values()) structureRuleOrder(rule.id, rules);
  for (const [ruleId, foundations] of Object.entries(structureFoundations)) {
    expect(listOfIds(foundations) && foundations.length > 0, `invalid foundational requirement for ${ruleId}`);
    const closure = new Set(structureRuleOrder(ruleId, rules).slice(0,-1).map(rule => rule.id));
    expect(foundations.every(required => closure.has(required)), `${ruleId} omits a required foundation`);
  }
  const cases = new Set();
  for (const obligation of scenarioObligations) {
    const {caseId, states, actions, conditions, conditionalEndpoints} = obligation;
    expect(hasOnly(obligation, ['caseId', 'states', 'actions', 'conditions', 'conditionalEndpoints']) &&
      id(caseId) && !cases.has(caseId) &&
      map(states) && Object.keys(states).length > 0 && map(actions) &&
      Object.keys(actions).length === Object.keys(states).length, `invalid or duplicated scenario obligation ${caseId}`);
    for (const [role, required] of Object.entries(states)) {
      expect(id(role) && rules.has(required) && Object.hasOwn(actions, role) &&
        (actions[role] === null || id(actions[role])), `unknown rule or action for ${caseId}/${role}`);
    }
    if (conditions !== undefined) {
      expect(map(conditions) && Object.keys(conditions).length > 0 &&
        listOfIds(Object.values(conditions)) && Object.keys(conditions).every(role => Object.hasOwn(states, role)),
      `invalid conditional structure role or assertion for ${caseId}`);
    }
    if (conditionalEndpoints !== undefined) {
      expect(map(conditionalEndpoints) && Object.keys(conditionalEndpoints).length > 0 &&
        Object.entries(conditionalEndpoints).every(([role, endpoint]) => Object.hasOwn(states, role) &&
          !Object.hasOwn(conditions ?? {}, role) && map(endpoint) && hasOnly(endpoint, ['version','assertion']) &&
          Number.isSafeInteger(endpoint.version) && endpoint.version > 0 && id(endpoint.assertion)),
      `invalid versioned conditional endpoint for ${caseId}`);
    }
    cases.add(caseId);
  }
  return { structureRules, structureSelectors, scenarioObligations, structureFoundations };
}

export function loadStructureDefinition() {
  return validateStructureDefinition(JSON.parse(readFileSync(modelUrl, 'utf8')));
}

export function resolveStructureBindings(contract, definition = loadStructureDefinition(), { historical = false } = {}) {
  const supplemental = isReservedTypographyCase(contract.id);
  const obligation = supplemental ? {
    states:{'source-ready':'source.filter-lanes',[reservedSourceSample]:'source.filter-lanes'},
    actions:{'source-ready':'open-sources',[reservedSourceSample]:'hide-reserved-ime'},
  } : definition.scenarioObligations.find(item => item.caseId === contract.id);
  if (!obligation) {
    expect(contract.phase !== 1 && contract.structure === undefined, `no model obligation for ${contract.id}`);
    return [];
  }
  const {states, actions, conditions = {}, conditionalEndpoints = {}} = obligation;
  const firstOpening = usesSourceUnknownExpand(contract);
  const sharedCaptureActions = {
    'unknown-expand':sourceUnknownWriteAction,
    'recovery-collapsed':contract.id.endsWith('-touch-edge') ? 'collapse-recovery' : sourceUnknownWriteAction,
  };
  const samples = new Map(contract.steps.filter(step => step.kind === 'sample').map(step => [step.id, step]));
  const rules = new Map(definition.structureRules.map(rule => [rule.id, rule]));
  expect(map(contract.structure) && Object.keys(contract.structure).length === Object.keys(states).length &&
    new Set(Object.values(contract.structure)).size === Object.keys(states).length,
  `${contract.id} must bind each required role to a distinct full sample`);
  expect(historical || firstOpening || [...samples.keys()].every(sampleId => Object.values(contract.structure).includes(sampleId)),
    `${contract.id} has a full sample without a required state`);
  const assertions = new Map((contract.assertions ?? []).map(assertion => [assertion.id, assertion]));
  const mappedConditions = new Set(Object.values(conditions));
  for (const assertion of assertions.values()) {
    if ((assertion.evaluator === 'source' && conditionBoundSourceKinds.includes(assertion.kind)) ||
        (assertion.evaluator === 'search' && assertion.kind === 'phase-history-loading') ||
        (assertion.evaluator === 'motion' && (assertion.expected?.requireCancelObservation === true ||
          assertion.expected?.requireReversalObservation === true))) {
      expect(mappedConditions.has(assertion.id), `${contract.id}/${assertion.id} requires a conditional structure role`);
    }
  }
  return Object.entries(states).map(([role, ruleId]) => {
    const sampleId = contract.structure[role];
    const sample = samples.get(sampleId);
    const causalAction = firstOpening ? sharedCaptureActions[role] ?? actions[role] : actions[role];
    expect(Object.hasOwn(contract.structure, role) && sample && (sample.afterAction ?? null) === causalAction,
      `${contract.id}/${role} requires a full sample from action ${causalAction ?? '(initial)'}`);
    const rule = rules.get(ruleId);
    expect(rule, `${contract.id}/${role} has no rule ${ruleId}`);
    const actionId = sample.afterAction ?? null;
    const endpoint = conditionalEndpoints[role];
    const conditionalEndpoint = endpoint?.version === contract.version;
    const conditionId = conditionalEndpoint ? endpoint.assertion :
      Object.hasOwn(conditions, role) ? conditions[role] : undefined;
    if (conditionId !== undefined) {
      const assertion = assertions.get(conditionId);
      expect(assertion?.condition && assertion.required === false && assertion.sample === sampleId &&
        (assertion.action ?? null) === actionId,
      `${contract.id}/${role} must bind conditional assertion ${conditionId} to the same sample and action`);
    }
    return {role, rule, sampleId, actionId, ...(conditionId === undefined ? {} : {conditionId}),
      ...(conditionalEndpoint ? {conditionalEndpoint:true} : {})};
  });
}
