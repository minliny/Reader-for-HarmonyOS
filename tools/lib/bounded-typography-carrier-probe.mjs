import assert from 'node:assert/strict';
import { stripTypeScriptTypes, registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { boundedSurfaceSdk, boundedMembers } from './bounded-surface-sdk-probe.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { typographyProperties, typographyRoleImports } from './reader-typography-consumer-audit.mjs';
import * as horizontal from '../../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { localImportResultLayout } from '../../entry/src/main/ets/features/bookshelf/LocalImportLayout.ts';

const metrics = metricsApi.createDefaultReaderWindowMetrics();
metrics.windowRect = new metricsApi.ReaderRectVp(0, 0, 390, 844);
const tuple = node => Object.fromEntries(typographyProperties.filter(key => Object.hasOwn(node, key)).map(key => [key, node[key]]));
const cached = new Map();
registerHooks({ resolve(specifier, context, next) { try { return next(specifier, context); } catch (error) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts')) return next(specifier + '.ts', context);
  throw error;
} } });
const replaceState = await import('../../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const replaceGeometry = await import('../../entry/src/main/ets/features/reading/ReaderControlReplaceGeometry.ts');
const replaceMorph = await import('../../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts');
const replacePresentation = await import('../../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts');
/** The projected expressions below are returned only after executing the
 * actual original owner -> mounted shared SDK child -> native Text and proving
 * its exact tuple, omitted AUTO attributes and active public-role propagation.
 * This is a producer proof, not a whitelist that substitutes a registry row. */
export function boundedTypographyCarrier(entry, file, expected, pageSource, targetSource) {
  const source = targetSource ?? readFileSync(new URL('../../' + entry.target.path, import.meta.url), 'utf8');
  const key = JSON.stringify([entry, expected, pageSource, source]);
  if (cached.has(key)) return cached.get(key);
  function native(branch, options = {}) {
    const p = boundedSurfaceSdk({ [entry.component]: source, ...options });
    p.hooks.childSources.CandidateRow = readFileSync(new URL('../../entry/src/main/ets/features/source/CandidateRow.ets', import.meta.url), 'utf8');
    const owner = p.consumer(pageSource, boundedMembers(pageSource), {
      ...horizontal, ...metricsApi, ...replaceState, ...replaceGeometry, ...replaceMorph, ...replacePresentation, localImportResultLayout,
      ReaderWindowCoordinator: { metrics: () => metrics }, registerReaderFonts() {},
      Scroller: class {},
      BorderStyle: { Dashed: 'dashed' }, Curve: { Linear: 'linear' }, curves: { cubicBezierCurve: (...values) => values },
      readerMotionNowMs: () => 0,
    }, { state: file.endsWith('/ReaderControlReplaceContent.ets') ? replaceState.createReaderControlReplaceState('typography:book', 'test', '') : 'fileSelection',
      motionProgress: 1, reduceMotion: true, ...entry.params, ...branch.params });
    if (file.endsWith('/ReaderControlReplaceContent.ets')) owner.layer = 'editor';
    owner[entry.origin.method]();
    const children = p.walk(owner).filter(child => child instanceof p.deps[entry.component] && child.specId === (branch.specId ?? entry.specId));
    assert.equal(children.length, 1, `${entry.id}: actual finite shared component is mounted by the original owner`);
    const texts = [...children[0].nodes.values()].filter(node => node.type === expected.kind && node.create === entry.nativeText);
    assert.equal(texts.length, 1, `${entry.id}: exact actual shared native carrier`);
    return tuple(texts[0]);
  }
  for (const branch of entry.cases ?? [{}]) {
    const role = branch.role ?? expected.changes.fontSize.match(/^(TYPE_\w+)\.fontSizeFp$/)?.[1];
    assert.ok(role && typographyRoleImports(source, entry.target.path).has(role), `${entry.id}: actual producer imports the exact role`);
    const original = Object.fromEntries(Object.entries(expected.changes).map(([property, expression]) => [property,
      new Function(...Object.keys(readerTypographyRoles), `return (${stripTypeScriptTypes(expression)});`).call({ ...entry.params, ...branch.params }, ...Object.values(readerTypographyRoles))]));
    const actual = native(branch);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected.original).sort(), `${entry.id}: all AUTO omissions remain exact`);
    assert.deepEqual(actual, original, `${entry.id}: actual shared native tuple equals immutable original tuple`);
    const changed = native(branch, { typographyRoles: { [role]: { ...readerTypographyRoles[role], fontSizeFp: readerTypographyRoles[role].fontSizeFp + 2 } } });
    assert.deepEqual(changed, { ...actual, fontSize: actual.fontSize + 2 }, `${entry.id}: this real caller actively consumes the public role`);
  }
  const result = { kind: expected.kind, method: entry.target.method, text: entry.target.text,
    producerPath: entry.target.path,
    producerProof: 'actual owner -> mounted shared SDK child -> native tuple and role propagation',
    modifiers: Object.fromEntries(Object.entries(expected.changes).map(([property, expression]) => [property, { expression, extra: expected.extra[property] }])) };
  cached.set(key, result);
  return result;
}
