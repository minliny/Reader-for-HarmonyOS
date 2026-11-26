import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { foundationControls } from './lib/reader-foundation-control-probe.mjs';
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
const selected = selectContractCases({ 'sdk-selection': 'Retained native status/category observers update selection, colors and counts. A primitive Builder count snapshot must fail.' },
  { argv: process.argv.slice(2).filter(arg => !arg.startsWith('--evidence-path=')) });

const statuses = [['all', '全部'], ['enabled', '已启用'], ['disabled', '已停用'], ['error', '异常']];
const categories = [['all', '全部'], ['novel', '小说'], ['comic', '漫画']];

function scenario(source) {
  const controls = foundationControls({ windowMetrics: () => ({ systemFontScale: 1.45 }) });
  const probe = createReaderBuilderProbe(source, ['statusValue', 'categoryValue', 'statusCounts', 'statusFilter', 'chip', 'statusCount', 'categoryFilter'], {
    ...controls.dependencies, readerSourceCategoryLabel, readerAppColor,
  }, controls.hooks);
  const parent = probe.owner;
  let rebuilds = 0;
  let current = true;
  Object.assign(parent, { appThemeScheme: 'day', contentFrame: () => ({ width: 328 }), fontScale: () => 1.45,
    statusCounts: { all: 9, enabled: 6, disabled: 3, abnormal: 2 }, groupOpen: false,
    filterTextLayoutOptions: () => undefined, managementInputIsCurrent: () => current,
    cancelToolsReturnFocus() {}, rebuildSourceProjection() { rebuilds += 1; } });
  parent.statusFilter(); parent.categoryFilter();
  const records = [...parent.nodes.entries()];
  const nativeButtons = prefix => records.filter(([, node]) => node.type === 'Button' && node.id?.startsWith(prefix));
  const statusButtons = nativeButtons('reader-source-status-'), categoryButtons = nativeButtons('source-category-');
  const statusText = records.filter(([, node]) => node.type === 'Text' && / \d+$/.test(node.create));
  const observerCount = parent.observers.length;
  const tracked = [...statusButtons, ...categoryButtons, ...statusText];
  const closures = tracked.map(([id]) => parent.observers[id]);
  assert.deepEqual(statusButtons.map(([, node]) => node.id), statuses.map(([id]) => `reader-source-status-${id}`));
  assert.deepEqual(categoryButtons.map(([, node]) => node.id), categories.map(([id]) => `source-category-${id}`));
  assert.equal(statusText.length, 4);
  assert.equal(parent.children.size, 0, 'the v9 controls are native Button nodes');
  function replay() {
    parent.replayOnly(tracked.map(([id]) => id));
    assert.equal(parent.observers.length, observerCount, 'selection never rebuilds the Builder or ForEach');
    assert.deepEqual(tracked.map(([id]) => parent.observers[id]), closures, 'the same native observers receive the new state');
  }
  const colors = (buttons, ownerValue) => ({ ownerValue,
    rendered: buttons.map(([, node]) => ({ id: node.id, selected: node.accessibilitySelected, fill: node.backgroundColor })) });
  const status = [colors(statusButtons, parent.statusValue)], category = [colors(categoryButtons, parent.categoryValue)];
  for (const index of [1, 2, 3, 0]) {
    statusButtons[index][1].onClick(); replay();
    assert.equal(parent.statusValue, statuses[index][1]);
    status.push(colors(statusButtons, parent.statusValue));
  }
  for (const index of [1, 2, 0]) {
    categoryButtons[index][1].onClick(); replay();
    assert.equal(parent.categoryValue, categories[index][0]);
    category.push(colors(categoryButtons, parent.categoryValue));
  }
  assert.equal(rebuilds, 7);
  parent.groupOpen = true;
  statusButtons[1][1].onClick();
  parent.groupOpen = false; current = false;
  categoryButtons[1][1].onClick();
  assert.equal(rebuilds, 7, 'covered and retired filters reject stale native clicks');
  parent.statusCounts = { all: 42, enabled: 27, disabled: 15, abnormal: 5 };
  replay();
  const counts = statusText.map(([, node]) => node.create);
  const accessibility = statusButtons.map(([, node]) => node.accessibilityText);
  return { output: probe.output, status, category, counts, accessibility, observerCount };
}

function assertSelection(samples, idForValue, activeFill, inactiveFill) {
  for (const sample of samples) {
    const expected = idForValue(sample.ownerValue);
    assert.deepEqual(sample.rendered.filter(button => button.selected).map(button => button.id), [expected]);
    for (const button of sample.rendered) assert.equal(button.fill,
      button.id === expected ? readerAppColor(activeFill, 'day') : inactiveFill === 'Color.Transparent' ? inactiveFill : readerAppColor(inactiveFill, 'day'));
  }
}

function assertCounts(result) {
  assert.deepEqual(result.counts, ['全部 42', '已启用 27', '已停用 15', '异常 5'], 'retained native labels consume the live scoped counts');
  assert.deepEqual(result.accessibility, ['书源状态，全部，42 项', '书源状态，已启用，27 项', '书源状态，已停用，15 项', '书源状态，异常，5 项']);
}

if (selected.includes('sdk-selection')) {
  const source = read(pagePath);
  const live = scenario(source);
  assertSelection(live.status, value => `reader-source-status-${statuses.find(([, label]) => label === value)[0]}`,
    'app.sourceUi.primary', 'TOK_CARD_BG');
  assertSelection(live.category, value => `source-category-${value}`, 'TOK_CARD_BG', 'Color.Transparent');
  assertCounts(live);
  const old = source.replace('private chip(label: string, verificationId: string)', 'private chip(label: string, verificationId: string, count: number)')
    .replace(/this\.chip\('([^']+)', '([^']+)'\);/g, "this.chip('$1', '$2', this.statusCount('$2'));")
    .replaceAll('this.statusCount(verificationId)', 'count');
  assert.notEqual(old, source);
  const stale = scenario(old);
  assert.throws(() => assertCounts(stale), /live scoped counts/, 'the previous primitive count snapshot must fail with retained observers');
  const inputs = [pagePath, 'tools/test-source-filter-live-selection.mjs',
    'tools/lib/reader-control-builder-probe.mjs', 'tools/lib/reader-foundation-control-probe.mjs',
    'tools/lib/arkui-property-runtime-probe.mjs'];
  const result = { status: 'PASS', live, negative: { implementation: 'primitive count snapshot', rejected: true, counts: stale.counts },
    inputs: inputs.map(path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') })),
    boundary: 'Installed SDK lowering and property/modifier recording. Native rendering, focus and dispatch are unverified.' };
  if (evidencePath) {
    writeFileSync(new URL(evidencePath.replace(/\.json$/, '-actual-sdk.js'), root), live.output);
    writeFileSync(new URL(evidencePath.replace(/\.json$/, '-old-sdk.js'), root), stale.output);
    writeFileSync(new URL(evidencePath, root), JSON.stringify(result, null, 2) + '\n');
  }
  console.log(JSON.stringify({ statusSamples: live.status.length, categorySamples: live.category.length,
    retainedObservers: live.observerCount, negativeRejected: true }));
  recordContractCasePass('sdk-selection');
}
