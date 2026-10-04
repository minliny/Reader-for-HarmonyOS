import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readerFoundationTokens } from './reader-foundation-control-probe.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { boundedMembers } from './bounded-surface-sdk-probe.mjs';

const read = name => readFileSync(new URL('../../entry/src/main/ets/features/common/' + name + '.ets', import.meta.url), 'utf8');
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require = createRequire(import.meta.url), ts = require(sdk + '/node_modules/typescript');
const options = require(sdk + '/lib/ets_checker.js').compilerOptions;
export const iconButtonSource = read('ReaderIconButton'), iconButtonSpecSource = read('ReaderControlSpecs');
export function compileIconButtonSpecs(source = iconButtonSpecSource) {
  const tree = ts.createSourceFile('/tmp/ReaderControlSpecs.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, 'actual finite icon specification parses');
  for (const node of tree.statements.filter(ts.isImportDeclaration).reverse()) source = source.slice(0, node.getStart(tree)) + source.slice(node.end);
  const js = ts.transpileModule(source.replace(/^export /gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const values = { ...readerFoundationTokens, ...readerTypographyRoles };
  return new Function(...Object.keys(values), js + ';return resolveReaderIconButtonSpec;')(...Object.values(values));
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
    update(owner, params) { owner.updateStateVars(params); properties.flush(); },
    consumer(source, names, extra = {}, initialParams = {}) {
      return createReaderBuilderProbe(source, names, { ...dependencies, ...extra }, { ...hooks, initialParams }).owner;
    } };
}
