import { readFileSync } from 'node:fs';
import { foundationIconSpec } from './reader-foundation-control-probe.mjs';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { createReaderComponentProbe as createReaderBuilderProbe } from './reader-component-probe.mjs';
import { builderComponentMembers as boundedMembers } from './ets-builder-probe.mjs';

const read = name => readFileSync(new URL('../../entry/src/main/ets/features/common/' + name + '.ets', import.meta.url), 'utf8');
export const iconButtonSource = read('ReaderIconButton'), iconButtonSpecSource = read('ReaderControlSpecs');
export function compileIconButtonSpecs(source = iconButtonSpecSource) {
  return foundationIconSpec(source);
}
/** Actual whole shipping component, finite resolver and normal/pressed
 * modifier. Only ArkUI properties and ColorMetrics use platform seams. */
export function iconButtonControls({ source = iconButtonSource, specSource = iconButtonSpecSource,
  properties = createArkUIPropertyRuntimeProbe(), ColorMetrics } = {}) {
  const resolveReaderIconButtonSpec = compileIconButtonSpecs(specSource);
  const dependencies = { ...properties.sdk, resolveReaderIconButtonSpec,
    AccessibilityRoleType: { BUTTON: 'AccessibilityRoleType.BUTTON' },
    ReaderPressFeedback: productionReaderPressFeedback({ Color: { Transparent: 'Color.Transparent' }, ColorMetrics }) };
  const hooks = { ...properties.hooks, childSources: { ReaderIconButton: source }, mountChildren: true, lifecycleChildren: true };
  const icon = createReaderBuilderProbe(source, boundedMembers(source), dependencies, hooks);
  dependencies.ReaderIconButton = icon.Component;
  const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
  return { icon, dependencies, hooks, properties, resolveReaderIconButtonSpec, walk,
    nodes: owner => walk(owner).flatMap(child => [...child.nodes.values()]),
    update(owner, params) {
      // Native updateStateVars receives the complete parent Prop projection.
      // A focused patch must preserve other real Props before Watch runs.
      const current = Object.fromEntries(Object.keys(owner).filter(key => key.startsWith('__'))
        .map(key => [key.slice(2), owner[key.slice(2)]]));
      owner.updateStateVars({ ...current, ...params }); properties.flush();
    },
    consumer(source, names, extra = {}, initialParams = {}) {
      return createReaderBuilderProbe(source, names, { ...dependencies, ...extra }, { ...hooks, initialParams }).owner;
    } };
}
