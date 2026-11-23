import {requireEvidence} from './evidence.mjs';
import {ancestorsOf} from './layout.mjs';
import {measureSourceNativeControl} from './source-native-control.mjs';

export const sourceFilterClearCase = 'source-management.filter-empty-clear-edge';
export const sourceFilterClearFixture = 'public-source-filter-empty-clear-edge-v1';
export const sourceFilterClearTarget = 'reader-source-clear-filters';
export const sourceFilterClearKind = 'source-filter-clear-touch';
export const sourceFilterClearAction = 'clear-filters-top';
export const sourceFilterClearAssertion = 'source.clearFilters.top';
export const sourceFilterClearQuery = 'Phase1NoMatch98417';

export function sourceFilterClearStep(step,fixture) {
  return fixture?.id === sourceFilterClearFixture && fixture.publicSources === true &&
    step?.id === sourceFilterClearAction && step.kind === 'action' && step.op === 'click' &&
    step.from === 'zero-match' && step.target === sourceFilterClearTarget && step.tapEdge === 'top' && !step.gesture;
}

export function sourceFilterClearPoint(sample) {
  const measured = measureSourceNativeControl(sample,sourceFilterClearTarget);
  requireEvidence(measured.verdict === 'PASS',measured.reason);
  const {bounds,carrierPath} = measured.actual;
  const button = sample.nodes.find(node=>node.path === carrierPath);
  requireEvidence(button?.id === sourceFilterClearTarget && bounds.height > 1 &&
    !ancestorsOf(sample,button).some(node=>node.enabled === false),
  'No enabled native Clear Filters Button with its own full upper edge');
  return {bounds,carrierPath,point:{x:Math.floor(bounds.left+bounds.width/2),y:bounds.top+1}};
}
