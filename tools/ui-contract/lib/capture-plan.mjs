import { isDeepStrictEqual } from 'node:util';
import { evaluateLayout } from './layout.mjs';
import { evaluateStructure } from './structure.mjs';

// 只规划归一化后的字段；不剪裁节点、原始证据或采集步骤。
const baselineFields = ['id', 'alias', 'key', 'path', 'parentPath', 'type', 'source',
  'rectPx', 'visibleRectPx', 'visible', 'opacity', 'enabled', 'clickable', 'focused'];
const layoutKinds = new Set(['gap', 'align', 'contain', 'nonOverlap']);
const structureChecks = new Map([
  ['present', [[], []]], ['absent', [[], []]], ['enabled', [[], ['value']]],
  ['descendant', [[], ['ancestor']]], ['opacity', [[], ['min', 'max', 'optional']]],
  ['inFrontOf', [['zIndex'], ['behind', 'optionalBehind']]],
  ['backgroundAlpha', [['backgroundAlpha'], ['min', 'max']]],
]);
const selectorFields = new Map([
  ['ids', []], ['prefix', []], ['bookCard', ['bookCard']],
  ['fixtureCard', ['fixtureCard', 'fixtureTitle', 'localBookAction']], ['sheetTitle', ['sheetTitle']],
]);
const hasOnly = (value, keys) => Object.keys(value).every(key => keys.includes(key));

export function planCapture(contract, capabilities, structure) {
  const fields = new Set(baselineFields);
  const required = new Set(['native-tree', 'window-metrics', 'app-owner']);
  const fallback = new Set();
  const screenshots = [];

  for (const step of contract.steps) {
    if (step.kind === 'sample') screenshots.push(step.id);
    if (step.kind === 'action') {
      if (step.op !== 'click' || typeof step.target !== 'string' ||
          !hasOnly(step, ['id', 'kind', 'op', 'from', 'target'])) fallback.add(`step:${step.id}`);
    } else if (!['locate', 'sample'].includes(step.kind) ||
        !hasOnly(step, ['id', 'kind', 'anchors', 'keyboard', 'focus', 'afterAction', 'quietMs'])) {
      fallback.add(`step:${step.id}`);
    }
  }

  for (const assertion of contract.assertions) {
    for (const source of assertion.sources ?? []) required.add(source);
    if (!assertion.sources?.length || assertion.condition || assertion.evaluator !== 'layout' || !layoutKinds.has(assertion.kind) ||
        !hasOnly(assertion, ['id', 'evaluator', 'kind', 'expected', 'source', 'sources', 'required',
          'sample', 'baseline', 'action', 'a', 'b', 'axis', 'tolerancePx'])) fallback.add(`assertion:${assertion.id}`);
  }

  if (!structure?.bindings?.length && (contract.phase === 1 || contract.structure !== undefined)) {
    fallback.add('structure:missing-bindings');
  }
  for (const {role, conditionId, rules} of structure?.bindings ?? []) {
    if (conditionId || !rules.length) fallback.add(`structure:${role}`);
    for (const {id, checks} of rules) {
      for (const check of checks) {
        const spec = structureChecks.get(check.kind);
        if (spec && hasOnly(check, ['kind', 'node', ...spec[1]])) {
          for (const field of spec[0]) fields.add(field);
        } else fallback.add(`structure:${id}/${check.kind}`);
        for (const name of [check.node, check.ancestor, check.behind].filter(Boolean)) {
          const keys = Object.keys(structure.selectors[name] ?? {});
          const selector = keys.length === 1 && selectorFields.get(keys[0]);
          if (selector) for (const field of selector) fields.add(field);
          else fallback.add(`selector:${name}`);
        }
      }
    }
  }

  for (const source of required) {
    if (capabilities[source]?.status !== 'AVAILABLE_BY_FIELD' ||
        !['native-tree', 'window-metrics', 'app-owner'].includes(source)) {
      fallback.add(`capability:${source}`);
    }
  }
  const unsupported = [...required].some(source => capabilities[source]?.status === 'UNSUPPORTED');
  return {
    mode: unsupported ? 'UNSUPPORTED' : fallback.size ? 'FULL_CAPTURE' : 'FIELD_PLAN_ONLY',
    execution: 'NOT_RUN',
    collection: 'UNCHANGED',
    requiredCapabilities: [...required].sort(),
    nativeTree: {scope:'ALL_NODES', fieldScope:'NORMALIZED_NODE', fields:fallback.size || unsupported ? 'ALL' : [...fields].sort()},
    preserve: {
      windowMetrics: 'FULL', sessionAndCausality: 'FULL', negativeProof: 'FULL_TREE',
      screenshotSamples: screenshots,
    },
    fallbackReasons: [...fallback].sort(),
    deviceValidation: {nativeCaptureReduction:'UNVALIDATED', speedup:'UNVALIDATED', requiresSeparateAuthorization:true},
  };
}

// 仅对照一个已归一化的离线样本；不接收原始证据、不返回投影树、不参与回执准入。
export function compareOfflineCaptureFields({contract, capabilities, structure, sample}) {
  const plan = planCapture(contract, capabilities, structure);
  const report = {sampleId:sample?.sampleId, collection:plan.collection, mode:plan.mode,
    comparison:'NOT_RUN', fallbackReasons:plan.fallbackReasons};
  if (plan.mode !== 'FIELD_PLAN_ONLY') return report;

  const fallback = reason => ({...report, mode:'FULL_CAPTURE', fallbackReasons:[reason]});
  if (!Array.isArray(sample?.nodes) || plan.preserve.screenshotSamples.length !== 1 ||
      plan.preserve.screenshotSamples[0] !== sample.sampleId || contract.steps.some(step => step.kind === 'action') ||
      !contract.assertions.length || contract.assertions.some(assertion => assertion.sample !== sample.sampleId ||
        assertion.baseline !== undefined || assertion.action !== undefined ||
        typeof assertion.a !== 'string' || typeof assertion.b !== 'string') ||
      !structure?.bindings?.length || structure.bindings.some(binding =>
        binding.sampleId !== sample.sampleId || binding.actionId != null)) {
    return fallback('pilot:single-independent-sample-required');
  }

  const keep = new Set(plan.nativeTree.fields);
  const missingFields = [];
  const nodes = sample.nodes.map(node => {
    const fields = Object.keys(node).filter(field => !keep.has(field)).sort();
    if (fields.length) missingFields.push({path:node.path, fields});
    return Object.fromEntries(Object.entries(node).filter(([field]) => keep.has(field)));
  });
  if (!missingFields.length) return fallback('pilot:no-fields-omitted');

  const evaluate = candidate => ({
    layout: contract.assertions.map(assertion => ({id:assertion.id,
      ...evaluateLayout({...assertion, acceptedSources:assertion.sources}, new Map([[sample.sampleId, candidate]]))})),
    structure: structure.bindings.flatMap(({role, rules}) => rules.map(rule => ({role, ruleId:rule.id,
      ...evaluateStructure(rule, candidate, structure.selectors)}))),
  });
  const full = evaluate(sample);
  const projected = evaluate({...sample, nodes});
  const details = {missingFields, full, projected};
  if (!isDeepStrictEqual(full, projected)) {
    return {...fallback('pilot:evaluator-results-differ'), comparison:'MISMATCH', ...details};
  }
  return {...report, comparison:'MATCH', ...details};
}
