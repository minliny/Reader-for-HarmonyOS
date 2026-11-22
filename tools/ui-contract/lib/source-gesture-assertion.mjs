import { sourceFilterScrollLanes } from './source-filter-scroll.mjs';
import { sourceGroupOptionsScroll } from './layout.mjs';

const gestures = {
  'main-list': {
    caseId:'scroll-return',kind:'fixed-scroll',assertionId:'source.layout.footer-fixed',
    target:'reader-source-list',baselineId:'fixture-sources-ready',actionId:'scroll-shallow',sampleId:'shallow',
  },
  ...Object.fromEntries(Object.entries(sourceFilterScrollLanes).map(([lane,policy]) => [`${lane}-scroll`,{
    caseId:'filter-selections',kind:'filter-scroll',assertionId:`source.filter.${lane}-scroll`,lane,
    target:policy.viewport,baselineId:policy.baseline,actionId:policy.action,sampleId:policy.sample,
  }])),
  'group-options-scroll': {
    caseId:'group-options-scroll',kind:'group-options-scroll',assertionId:'source.group.options-scroll',
    target:sourceGroupOptionsScroll,baselineId:'panel-before',actionId:'scroll-group-options',sampleId:'panel-tail',
    terminalId:'selected-tail',
  },
};

export function sourceGestureAssertion(gestureId, contract, assertion) {
  if (!Object.hasOwn(gestures,gestureId)) return;
  const spec = gestures[gestureId];
  const {baselineId,actionId,sampleId,terminalId = sampleId} = spec;
  const groupScroll = gestureId === 'group-options-scroll';
  if (contract?.id !== `source-management.${spec.caseId}` || contract.pageId !== 'source-management' ||
      assertion?.id !== spec.assertionId || assertion.evaluator !== 'source' || assertion.kind !== spec.kind ||
      assertion.required !== true || assertion.sample !== terminalId || assertion.baseline !== baselineId ||
      (groupScroll ? assertion.scrollAction : assertion.action) !== actionId ||
      (gestureId === 'main-list' && assertion.expected?.requireNativeSwipe !== true) ||
      (spec.lane && assertion.expected?.lane !== spec.lane)) return;

  const step = id => contract.steps?.find(item=>item.id === id);
  const swipe = step(actionId);
  if (swipe?.kind !== 'action' || swipe.op !== 'swipe' || swipe.target !== spec.target || swipe.from !== baselineId ||
      step(sampleId)?.afterAction !== actionId) return;
  const roleSamples = Object.values(contract.structure ?? {});
  if (![baselineId,sampleId,terminalId].every(id=>roleSamples.includes(id) && step(id)?.kind === 'sample')) return;
  return {baselineId,actionId,sampleId};
}
