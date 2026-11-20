import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderComponentProbe } from './reader-component-probe.mjs';
import { builderComponentMembers } from './ets-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { selectedProductionClasses } from './selected-production-methods.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { readerSurfaceSpecsForProbe } from './bounded-surface-sdk-probe.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { readerAppColor } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { ReaderInsetsVp } from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { ReaderMeasurementStore } from '../../entry/src/main/ets/features/common/ReaderMeasurements.ts';
import { readerScaledControlHeight } from '../../entry/src/main/ets/features/common/ReaderSurfaceResolvers.ts';
import { readerPageAreaLength } from '../../entry/src/main/ets/features/common/ReaderPageShell.ts';
import * as horizontal from '../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';

const file = name => new URL('../../entry/src/main/ets/features/common/' + name + '.ets', import.meta.url);
const read = name => readFileSync(file(name), 'utf8');

/** Parse the complete current panel before emitting its actual ordinary
 * top-level class declarations. FrameCallback is an explicit platform base;
 * no comments, private class spelling or component prefix delimit the input. */
export function searchFilterSdkDeclarations(source) {
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile('ReaderSearchFilterPanel.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, 'complete current filter panel parses');
  const declarations = tree.statements.filter(ts.isClassDeclaration);
  assert.ok(declarations.length > 0, 'actual filter platform frame declarations');
  return pureModuleProbe(declarations.map(node => node.getText(tree)).join('\n'), 'SearchFilterDeclarations.ets',
    { FrameCallback: class {} }, declarations.map(node => node.name.text));
}

/** Search-specific production policies. No fake business owner, sheet host or
 * implicit child factory. The caller supplies native sheet/chrome/frame ports. */
export function searchSheetSdkInputs(metrics) {
  const specs = readerSurfaceSpecsForProbe(metrics);
  const chrome = pureModuleProbe(read('ReaderSheetChrome'), 'ReaderSheetChrome.ets',
    { ...specs, ...horizontal, readerAppColor }, ['readerSheetWidth', 'readerSheetChrome']);
  const accessibility = pureModuleProbe(read('ReaderActionAccessibility'), 'ReaderActionAccessibility.ets',
    { AccessibilityRoleType: { BUTTON: 'AccessibilityRoleType.BUTTON' } }, ['ReaderActionAccessibility']);
  const frame = selectedProductionClasses(file('ReaderBoundedSurface'), ['ReaderBoundedFrameModifier'],
    { ...specs, readerAppColor, ReaderInsetsVp });
  const title = selectedProductionClasses(file('ReaderBoundedSurfaceHeader'), ['ReaderBoundedTitleModifier'],
    { ...readerTypographyRoles, readerAppColor });
  return { ...specs, ...chrome, ...accessibility, ...frame, ...title, ...readerTypographyRoles,
    ReaderInsetsVp, ReaderMeasurementStore, readerScaledControlHeight, readerPageAreaLength, readerAppColor };
}

/** Compile exactly the two actual containers exercised by compact search
 * sheets. Their public slots remain caller-owned; no recovery/menu/action-sheet
 * or other feature components are initialized. Native rendering is not modeled. */
export function searchBoundedSdk(metrics) {
  const properties = createArkUIPropertyRuntimeProbe();
  const childSources = Object.fromEntries(['ReaderBoundedSurface', 'ReaderBoundedSurfaceHeader'].map(name => [name, read(name)]));
  const deps = { ...properties.sdk, ...searchSheetSdkInputs(metrics) };
  const hooks = { ...properties.hooks, childSources, mountChildren: true, lifecycleChildren: true };
  for (const [name, source] of Object.entries(childSources)) deps[name] = createReaderComponentProbe(source,
    builderComponentMembers(source, name), deps, { ...hooks, componentName: name }).Component;
  const walk = owner => [owner, ...[...owner.children.values()].flatMap(child => child.nodes ? walk(child) : [])];
  return { properties, childSources, walk, nodes: owner => walk(owner).flatMap(child => [...child.nodes.values()]),
    consumer(name, params) {
      assert.ok(Object.hasOwn(childSources, name), 'explicit search Header/Surface only');
      assert.ok(['search-result-filter', 'search-task-status'].includes(params.specId), 'explicit search sheet spec only');
      return new deps[name](undefined, params);
    } };
}
