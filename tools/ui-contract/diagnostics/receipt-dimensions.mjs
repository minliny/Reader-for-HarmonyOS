import { readFileSync } from 'node:fs';
import { checkPageComposition } from '../../page-structure/check-register.mjs';
import { platformCapabilities } from '../lib/cases.mjs';
import { jsonDigest, requireEvidence } from '../lib/evidence.mjs';
import { replayReceipt } from '../lib/receipt.mjs';

const assertionDimensions = ['behavior', 'layout', 'motion', 'text', 'accessibility'];
const sourceLayout = new Set(['compensation', 'filter-layout', 'fixed-insets', 'footer-end', 'group-geometry',
  'source-chrome-geometry', 'adaptation', 'adaptation-surface', 'native-control-target', 'filter-touch-target',
  'toggle-touch-target', 'source-inline-import-area']);
const sourceText = new Set(['adaptation-text', 'filter-tail-text', 'group-options-text', 'recovery-body-text', 'surface-text']);

function assertionDimension({evaluator, kind}) {
  if (evaluator === 'layout' || evaluator === 'search' && kind === 'phase-relative') return 'layout';
  if (evaluator === 'motion' && !['control-open', 'control-dismiss', 'control-effect'].includes(kind)) return 'motion';
  if (evaluator === 'source') {
    if (sourceLayout.has(kind)) return 'layout';
    if (sourceText.has(kind)) return 'text';
    if (kind === 'source-native-focus' || kind === 'source-native-semantics') return 'accessibility';
  }
  return 'behavior';
}

function outcome(checks) {
  if (checks.some(check => check.verdict === 'FAIL')) return 'FAIL';
  if (checks.some(check => check.required && (check.verdict !== 'PASS' || check.observationsComplete === false))) {
    return 'INCOMPLETE';
  }
  return checks.some(check => check.verdict === 'PASS') ? 'PASS' : 'NOT_RUN';
}

function structureOutcome(contract, receipt) {
  const states = receipt?.structure?.states ?? [];
  const bindings = Object.entries(contract.structure ?? {});
  if (!bindings.length) return contract.phase === 1 ? 'INCOMPLETE' : 'NOT_RUN';
  // 结构条件只排除它绑定的规则，不排除同状态的基础规则。
  const checks = bindings.flatMap(([role, sampleId]) => {
    const state = states.find(item => item.role === role && item.sampleId === sampleId);
    if (!state) return [{required:true}];
    const excluded = state.conditionId && receipt.conditions?.[state.conditionId]?.status === 'DOES_NOT_APPLY';
    return state.checks.filter(check => !excluded || check.ruleId !== state.ruleId)
      .map(check => ({...check, required:true}));
  });
  return outcome(checks);
}

function pageOutcome(page) {
  if (page?.registration !== 'REGISTERED_PAGE') return 'NOT_RUN';
  const register = JSON.parse(readFileSync(new URL('../../page-structure/register.json', import.meta.url), 'utf8'));
  const entry = register.pages.find(item => item.pageId === page.id);
  if (!entry) return 'NOT_RUN';
  const claims = [...Object.values(entry.layers), ...Object.values(entry.invariants)];
  // 读取到登记失败可以保留；登记字面 PASS 不能代替准入校验，也不能转给任意候选。
  return claims.some(claim => claim?.result === 'FAIL') ? 'FAIL' : 'INCOMPLETE';
}

/** 仅投影已验证回执（无回执时可显式标记已选但未取得证据）；不产生整体验收结论。 */
export function deriveReceiptDimensions({contract, receipt, platform = 'harmonyos', selected = Boolean(receipt)}) {
  const groups = Object.fromEntries(assertionDimensions.map(dimension => [dimension, []]));
  const capabilities = platformCapabilities(platform);
  if (!selected || Object.values(capabilities).every(source => source.status === 'UNSUPPORTED')) {
    return Object.fromEntries([...assertionDimensions, 'structure', 'page'].map(dimension => [dimension, 'NOT_RUN']));
  }
  if (receipt) requireEvidence(receipt.caseId === contract.id && receipt.caseSha256 === jsonDigest(contract) &&
    receipt.page?.id === contract.pageId, 'Diagnostic dimensions require the exact receipt case');

  const results = new Map(receipt?.assertions.map(result => [result.id, result]));
  for (const assertion of contract.assertions) {
    const condition = receipt?.conditions?.[assertion.id];
    if (condition?.status === 'DOES_NOT_APPLY') continue;
    const result = results.get(assertion.id);
    const unknown = condition?.status === 'UNKNOWN' || assertion.condition && !condition;
    groups[assertionDimension(assertion)].push({
      required: unknown || (condition?.required ?? assertion.required !== false),
      verdict: unknown && result?.verdict !== 'FAIL' ? 'NOT_RUN' : result?.verdict,
    });
  }
  return {
    ...Object.fromEntries(Object.entries(groups).map(([dimension, checks]) => [dimension, outcome(checks)])),
    structure:structureOutcome(contract, receipt),
    page:pageOutcome(receipt?.page),
  };
}

/** 也可投影由原冻结工具回放的结果；页面 PASS 仍由登记边界独立验证。 */
export function deriveReplayedReceiptDimensions(contract, replayed) {
  const dimensions = deriveReceiptDimensions({contract, receipt:replayed.receipt});
  if (dimensions.page === 'INCOMPLETE') dimensions.page = checkPageComposition(replayed).verdict;
  return dimensions;
}

/** 复用原回放校验，在已封存回执之外返回诊断维度。 */
export function replayReceiptWithDimensions(options) {
  const replayed = replayReceipt(options);
  return {...replayed, dimensions:deriveReplayedReceiptDimensions(options.contract, replayed)};
}
