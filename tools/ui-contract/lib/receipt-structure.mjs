import { createHash } from 'node:crypto';
import { canonicalAppJson } from '../../../scripts/lib/app-build-identity.mjs';
import { loadStructureDefinition, resolveStructureBindings, structureRuleOrder } from './structure-contract.mjs';
import { evaluateStructure } from './structure.mjs';
import { sourceReadLoadingCase, sourceReadLoadingNativeFrame } from './source-read.mjs';

const digest = value => createHash('sha256').update(`${canonicalAppJson(value)}\n`).digest('hex');

function describedBindings(contract, definition, options) {
  const rules = new Map(definition.structureRules.map(rule => [rule.id, rule]));
  return resolveStructureBindings(contract, definition, options).map(({rule, ...binding}) =>
    ({...binding, ruleId:rule.id, rules:structureRuleOrder(rule.id, rules)}));
}

function bindingDigest(bindings, selectors) {
  const usedSelectors = new Map();
  function addSelector(id) {
    if (usedSelectors.has(id)) return;
    const selector = selectors[id];
    if (!selector) throw new Error(`Unknown structure selector ${id}`);
    usedSelectors.set(id, selector);
    const parent = selector.under ?? selector.ancestorOf;
    if (parent) addSelector(parent);
  }
  for (const {rules} of bindings) {
    for (const {checks} of rules) {
      for (const check of checks) {
        addSelector(check.node);
        if (check.ancestor) addSelector(check.ancestor);
        if (check.behind) addSelector(check.behind);
      }
    }
  }
  return digest({bindings, selectors:Object.fromEntries(usedSelectors)});
}

export function structureBindingSha256(contract, definition) {
  const bindings = describedBindings(contract, definition);
  return bindings.length ? bindingDigest(bindings, definition.structureSelectors) : null;
}

/** Preserve a proved violation when another required observation is missing. */
export function summarizeVerdicts(checks) {
  const complete = checks.every(check => check.verdict !== 'NOT_RUN' && check.observationsComplete !== false);
  const failed = checks.some(check => check.verdict === 'FAIL');
  return {observationsComplete:complete, verdict:failed ? 'FAIL' : complete ? 'PASS' : 'NOT_RUN'};
}

export function assessStructure(contract, context, definition = loadStructureDefinition(), options) {
  const bindings = describedBindings(contract, definition, options);
  if (!bindings.length) return undefined;
  const states = bindings.map(({rules, ...binding}) => {
    const {sampleId, actionId, conditionId, ruleId, conditionalEndpoint, ...roleBinding} = binding;
    const condition = conditionId && options?.conditions?.[conditionId];
    const excluded = condition?.status === 'DOES_NOT_APPLY';
    const sample = context.samples?.[sampleId];
    const action = actionId === null ? null : context.actions?.[actionId];
    const causal = actionId === null || action && sample && sample.instanceId === action.instanceId &&
      sample.beforeSeq >= action.afterSeq && sample.hostBeginMs >= action.hostEndMs;
    const loadingFrame = contract.id === sourceReadLoadingCase && contract.version === 2 && roleBinding.role === 'source-read' ?
      sourceReadLoadingNativeFrame(contract.assertions.find(assertion => assertion.id === conditionId),context) : null;
    const checks = rules.map(rule => {
      if (conditionId && (conditionalEndpoint || rule.id === ruleId) &&
          (condition?.status !== 'APPLIES' || condition.sampleApplies === false)) {
        return {
          ruleId:rule.id, requiredRuleIds:rule.requires, verdict:'NOT_RUN', observationsComplete:false,
          actual:null, expected:rule.checks, reason:condition?.reason ?? 'No verified applicability for this structure rule',
          evidenceRefs:[],
        };
      }
      const assessment = evaluateStructure(rule, causal ? loadingFrame?.sample ?? sample : undefined,
        definition.structureSelectors, context);
      return {
        ruleId:rule.id, requiredRuleIds:rule.requires, verdict:assessment.verdict,
        observationsComplete:assessment.verdict !== 'NOT_RUN' && assessment.observationsComplete !== false,
        actual:assessment.actual ?? null, expected:rule.checks,
        reason:causal ? assessment.reason : 'The observed sample is missing its verified causal action',
        evidenceRefs:[...new Map([...(assessment.evidenceRefs ?? []), ...(action?.evidenceRefs ?? [])]
          .map(ref => [canonicalAppJson(ref), ref])).values()],
      };
    });
    const applicableChecks = excluded ? checks.slice(0, conditionalEndpoint ? 0 : -1) : checks;
    return {...roleBinding, sampleId, actionId, ruleId, ...(conditionId === undefined ? {} : {conditionId}),
      ...summarizeVerdicts(applicableChecks), checks};
  });
  const summary = summarizeVerdicts(states);
  return {
    definitionSha256:digest(definition), bindingSha256:bindingDigest(bindings, definition.structureSelectors),
    observations:summary.observationsComplete ? 'COMPLETE' : 'INCOMPLETE', behavior:summary.verdict, states,
  };
}

/** Select only the current case's rule and selector closure for admission. */
export function requireStructureProof(receipt, contract, definition, sampleIds) {
  const bindings = describedBindings(contract, definition);
  if (!bindings.length) return [];
  const structure = receipt.structure;
  const expectedDigest = bindingDigest(bindings, definition.structureSelectors);
  if (structure?.bindingSha256 !== expectedDigest) throw new Error('Receipt lacks matching necessary structure evidence');
  const proven = [];
  for (const {role, ruleId, sampleId, actionId, conditionId, rules} of bindings.filter(binding => sampleIds.includes(binding.sampleId))) {
    const matching = structure.states.filter(state => state.role === role && state.ruleId === ruleId &&
      state.sampleId === sampleId && state.actionId === actionId && state.conditionId === conditionId);
    const [state] = matching;
    if (matching.length !== 1 || state.verdict !== 'PASS' || state.observationsComplete !== true ||
      state.checks.length !== rules.length || !rules.every((rule, index) =>
        state.checks[index].ruleId === rule.id && state.checks[index].verdict === 'PASS' &&
        state.checks[index].observationsComplete === true &&
        canonicalAppJson(state.checks[index].requiredRuleIds) === canonicalAppJson(rule.requires))) {
      throw new Error(`Receipt lacks complete structure and prerequisites for ${role} (${sampleId})`);
    }
    proven.push(state);
  }
  if (sampleIds.some(sampleId => !bindings.some(binding => binding.sampleId === sampleId))) {
    throw new Error('The register assertion has no necessary structure binding for the same sample');
  }
  return proven;
}
