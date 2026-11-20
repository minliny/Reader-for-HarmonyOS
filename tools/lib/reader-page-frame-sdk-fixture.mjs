import { readFileSync } from 'node:fs';
import { createReaderComponentProbe } from './reader-component-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { builderComponentMembers as boundedMembers } from './ets-builder-probe.mjs';
import { actualReaderPageShell } from './reader-page-shell-runtime-probe.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { readerFoundationTokens } from './reader-foundation-control-probe.mjs';
import * as headerMetrics from '../../entry/src/main/ets/features/common/ReaderHeaderMetrics.ts';
import * as measurements from '../../entry/src/main/ets/features/common/ReaderMeasurements.ts';
import * as scrollLayout from '../../entry/src/main/ets/features/common/ReaderScrollLayout.ts';

export const pageFrameSource = name => readFileSync(new URL(
  `../../entry/src/main/ets/features/common/${name}.ets`, import.meta.url), 'utf8');

/** Target an actual native API call for a negative control. Assertions bind
 * the emitted behavior, while this selector tolerates whitespace/private
 * helper renaming and does not require a particular condition spelling. */
export function mutatePageFrameCall(source, ownerName, callName, replacement, select = () => true) {
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile('PageFrameMutant.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const owner = tree.statements.find(node => (ts.isClassDeclaration(node) || ts.isStructDeclaration(node)) && node.name.text === ownerName);
  if (!owner || tree.parseDiagnostics.length) throw new Error('Actual page frame mutation source must parse');
  const found = [];
  const walk = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === callName && select(node, tree, ts)) found.push(node);
    ts.forEachChild(node, walk);
  };
  walk(owner);
  if (found.length !== 1) throw new Error(`Expected one ${ownerName}.${callName} mutation target, found ${found.length}`);
  const node = found[0];
  return source.slice(0, node.getStart(tree)) + replacement(node, tree) + source.slice(node.end);
}

/** Explicit composition of the four shipping visual hosts, with the real
 * property runtime. Only compiler output is cached; each fixture owns state.
 * A caller may supply policy/source mutants without editing the application. */
export function pageFrameSdkFixture({ sources = {}, dependencies = {}, properties = createArkUIPropertyRuntimeProbe() } = {}) {
  const names = ['ReaderFixedHeaderHost', 'ReaderPageScaffold', 'ReaderPageScrollHost', 'ReaderStandardPage'];
  const childSources = Object.fromEntries(names.map(name => [name, sources[name] ?? pageFrameSource(name)]));
  const headerSpecs = pureModuleProbe(pageFrameSource('ReaderHeaderSpecs'), 'ReaderHeaderSpecs.ets',
    { ...readerFoundationTokens, ...headerMetrics }, ['readerPageInitialHeaderHeight', 'directoryHeaderSpec']);
  const deps = { ...properties.sdk, ...actualReaderPageShell(), ...readerFoundationTokens,
    ...headerSpecs, ...measurements, ...scrollLayout, ...dependencies };
  const hooks = { ...properties.hooks, childSources, mountChildren: true,
    onChildUpdated() { properties.flush(); } };
  for (const name of names) deps[name] = createReaderComponentProbe(childSources[name],
    boundedMembers(childSources[name]), deps, hooks).Component;
  const walk = owner => [owner, ...[...(owner.children?.values() ?? [])].flatMap(walk)];
  return { properties, deps, hooks, walk,
    nodes: owner => walk(owner).flatMap(actor => [...(actor.nodes?.values() ?? [])]),
    create(name, params = {}) {
      return createReaderComponentProbe(childSources[name], boundedMembers(childSources[name]), deps,
        { ...hooks, initialParams: params }).owner;
    } };
}
