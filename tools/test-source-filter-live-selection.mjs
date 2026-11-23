import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { foundationControls, foundationSpecs } from './lib/reader-foundation-control-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { readerSourceCategoryLabel } from '../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts';

const root = new URL('../', import.meta.url);
const pagePath = 'entry/src/main/ets/features/source/ui/SourceManagementPage.ets';
const read = path => readFileSync(new URL(path, root), 'utf8');
const outputArgs = process.argv.slice(2).filter(arg => arg.startsWith('--evidence-path='));
assert.ok(outputArgs.length <= 1);
const evidencePath = outputArgs[0]?.slice('--evidence-path='.length);
if (evidencePath) assert.ok(evidencePath.startsWith('.reader-artifacts/') && !evidencePath.includes('..'));
const selected = selectContractCases({ 'sdk-selection': 'Retained actual SDK Source status/category child updaters and actual ReaderButton props/native selected/surface; old primitive snapshot negative, no Builder replay/remount or native device claim.' },
  { argv: process.argv.slice(2).filter(arg => !arg.startsWith('--evidence-path=')) });

function scenario(source) {
  const controls = foundationControls({ windowMetrics: () => ({ systemFontScale: 1.45 }) });
  const probe = createReaderBuilderProbe(source, ['statusValue', 'categoryValue', 'statusFilter', 'chip', 'categoryFilter'], {
    ...controls.dependencies, readerSourceCategoryLabel, ScrollDirection: { Horizontal: 'horizontal' },
  }, controls.hooks);
  const parent = probe.owner;
  let rebuilds = 0;
  Object.assign(parent, { appThemeScheme: 'day', contentFrame: () => ({ width: 328 }),
    filterControlWidth: () => 328, layoutBudget: () => ({ statusContentWidth: 494, filterHeight: 52 }),
    cancelToolsReturnFocus(){},rebuildSourceProjection() { rebuilds++; } });
  parent.statusFilter();
  const statusChildren = [...parent.children.values()];
  parent.categoryFilter();
  const categoryChildren = [...parent.children.values()].filter(child => !statusChildren.includes(child));
  assert.deepEqual(statusChildren.map(child => child.label), ['全部', '启用', '异常', '未检测', '自定义']);
  assert.equal(categoryChildren.length, 7);
  const statusIds = statusChildren.map(child => child.id), categoryIds = categoryChildren.map(child => child.id);
  const initialChildren = [...parent.children.values()], initialObservers = parent.observers.length;
  const observerIdentities = initialChildren.map(child => parent.observers[child.id]);
  function rendered(child) {
    const text = [...child.nodes.values()].find(node => node.type === 'Text' && node.create === child.label);
    assert.ok(text, child.label);
    const carrier=[...child.nodes.values()].find(node=>node.type==='Button'&&typeof node.onClick==='function');
    assert.ok(carrier,'actual native Button owns the interactive state');
    return { label: child.label, specId: child.specId, primary: child.primary, selected: carrier.accessibilitySelected,
      backgroundColor: carrier.backgroundColor, color: text.fontColor, enabled: carrier.enabled };
  }
  function retainedReplay(ids) {
    parent.replayOnly(ids);
    // Deliver only the real ReaderButton @Prop dependencies. The Source
    // Builder/Row/ForEach observers are deliberately never replayed here.
    controls.properties.flush(owner => owner !== parent);
    assert.equal(parent.observers.length, initialObservers, 'no Builder re-entry or new native observer');
    assert.deepEqual([...parent.children.values()], initialChildren, 'all actual child instances are retained');
    assert.deepEqual(initialChildren.map(child => parent.observers[child.id]), observerIdentities, 'the same compiled child updater closures are retained');
  }
  const status = [{ ownerValue: parent.statusValue, rendered: statusChildren.map(rendered) }];
  const callback = statusChildren[1].onAction;
  callback();
  assert.equal(parent.statusValue, '启用');
  assert.equal(rebuilds, 1);
  retainedReplay(statusIds);
  status.push({ ownerValue: parent.statusValue, rendered: statusChildren.map(rendered) });
  statusChildren[2].onAction();
  assert.equal(parent.statusValue, '异常');
  retainedReplay(statusIds);
  status.push({ ownerValue: parent.statusValue, rendered: statusChildren.map(rendered) });
  statusChildren[3].onAction();
  retainedReplay(statusIds);
  status.push({ ownerValue: parent.statusValue, rendered: statusChildren.map(rendered) });
  statusChildren[0].onAction();
  retainedReplay(statusIds);
  status.push({ ownerValue: parent.statusValue, rendered: statusChildren.map(rendered) });
  const beforeDisabled = parent.statusValue;
  statusChildren[4].onAction();
  retainedReplay(statusIds);
  assert.equal(parent.statusValue, beforeDisabled, 'disabled custom cannot change owner state');
  assert.equal(statusChildren[4].primary, false, 'disabled custom never becomes selected');
  assert.equal(statusChildren[4].onAction, initialChildren[4].onAction, 'callback identity retained');
  assert.equal(statusChildren[1].onAction, callback, 'captured action identity retained');
  const category = [{ ownerValue: parent.categoryValue, rendered: categoryChildren.map(rendered) }];
  for (const index of [1, 2, 0]) {
    categoryChildren[index].onAction();
    retainedReplay(categoryIds);
    category.push({ ownerValue: parent.categoryValue, rendered: categoryChildren.map(rendered) });
  }
  return { output: probe.output, status, category, children: initialChildren.length,
    observers: initialObservers, sameChildUpdaterOnly: true, sharedPropertyRuntime: controls.properties.source };
}

function assertSelection(samples, labelOfValue = value => value) {
  for (const sample of samples) {
    const expected = labelOfValue(sample.ownerValue);
    const selected = sample.rendered.filter(child => child.primary || child.selected);
    assert.deepEqual(selected.map(child => child.label), [expected], `current owner ${sample.ownerValue} controls retained child props and native selected`);
    for (const child of sample.rendered) {
      const active = child.label === expected;
      assert.equal(child.primary, active);
      assert.equal(child.selected, active);
      const spec = foundationSpecs().resolveReaderButtonSpec(child.specId);
      assert.equal(child.backgroundColor, readerAppColor(active ? spec.primarySurface : spec.secondarySurface, 'day'), `actual ${child.label} modifier surface follows owner`);
    }
  }
}

if (selected.includes('sdk-selection')) {
  const source = read(pagePath), live = scenario(source);
  if (evidencePath) {
    writeFileSync(new URL(evidencePath.replace(/\.json$/, '-actual-sdk.js'), root), live.output);
    writeFileSync(new URL(evidencePath.replace(/\.json$/, '-observed.json'), root), JSON.stringify(live, null, 2) + '\n');
  }
  assertSelection(live.status);
  assertSelection(live.category, value => value === 'all' ? '全部类型' : readerSourceCategoryLabel(value));
  assert.match(source, /private chip\(label: string, width: number, enabled: boolean\)/);
  assert.match(source, /primary: enabled && this\.statusValue === label/);
  // Recreate the previous bounded production defect while retaining all
  // current unrelated source bytes and the actual shared ReaderButton.
  let old = source.replace('private chip(label: string, width: number, enabled: boolean)',
    'private chip(label: string, width: number, active: boolean, enabled: boolean)')
    .replace('primary: enabled && this.statusValue === label', 'primary: active');
  for (const [label, width] of [['全部', 58], ['启用', 58], ['异常', 58], ['未检测', 72]])
    old = old.replace(`this.chip('${label}', ${width}, true)`, `this.chip('${label}', ${width}, this.statusValue === '${label}', true)`);
  old = old.replace("this.chip('自定义', 72, false)", "this.chip('自定义', 72, false, false)");
  assert.notEqual(old, source);
  const stale = scenario(old);
  assert.throws(() => assertSelection(stale.status), /current owner 启用/,
    'same retained child updater rejects the previous primitive snapshot implementation');
  assertSelection(stale.category, value => value === 'all' ? '全部类型' : readerSourceCategoryLabel(value));
  const dependencies = [pagePath, 'entry/src/main/ets/ui/controls/ReaderButton.ets',
    'entry/src/main/ets/ui/controls/ReaderControlSpecs.ets', 'tools/test-source-filter-live-selection.mjs',
    'tools/lib/reader-control-builder-probe.mjs', 'tools/lib/reader-foundation-control-probe.mjs',
    'tools/lib/arkui-property-runtime-probe.mjs'];
  const result = { status: 'PASS', live, negative: { implementation: 'previous primitive active parameter',
    rejected: true, status: stale.status, categoryUnchangedAndLive: true },
    inputs: dependencies.map(path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') })),
    boundary: 'actual installed SDK lowering/property/update/modifier recording; no real renderer/hit/focus/native acceptance' };
  if (evidencePath) {
    writeFileSync(new URL(evidencePath, root), JSON.stringify(result, null, 2) + '\n');
    writeFileSync(new URL(evidencePath.replace(/\.json$/, '-old-sdk.js'), root), stale.output);
  }
  console.log(JSON.stringify({ statusSamples: live.status.length, categorySamples: live.category.length,
    retainedChildren: live.children, sameChildUpdaterOnly: true, negativeRejected: true }));
  recordContractCasePass('sdk-selection');
}
