import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { collapsedHistoryCount } from '../entry/src/main/ets/features/search/SearchHistoryLayout.ts';

const source = readFileSync(process.env.READER_SEARCH_PAGE_SOURCE ??
  new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url), 'utf8');
// StateContent branches reference the page's other real Builders; register
// their production names with the same SDK registry without executing them.
const require = createRequire(import.meta.url);
const sdkRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const { CUSTOM_BUILDER_METHOD } = require(`${sdkRoot}/lib/component_map.js`);
for (const match of source.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) CUSTOM_BUILDER_METHOD.add(match[1]);
const enumValues = name => new Proxy({}, { get: (_, key) => `${name}.${String(key)}` });
const results = [];
function check(name, fn) {
  try { fn(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', message: error.message }); }
}
function fixture(history, { width = 0, tablet = false, expanded = false, measureVp = text => text.length * 13 } = {}) {
  let owner;
  const measurements = [];
  // Flex is only a native attribute recorder. The SDK transforms the actual
  // production Builder/ForEach/If; this is not a native layout simulation.
  const Flex = new Proxy({ name: 'Flex' }, { get(target, property) {
    if (property === 'name') return target.name;
    return (...args) => {
      if (property === 'pop') return;
      const node = owner.nodes.get(owner.observers.length - 1);
      node[property] = args.length === 1 ? args[0] : args;
    };
  } });
  ({ owner } = createReaderBuilderProbe(source,
    ['stateContent', 'initialContent', 'moreChip', 'measureHistory', 'refreshVisibleResults'],
    { collapsedHistoryCount, Flex, FlexWrap: enumValues('FlexWrap'), FlexDirection: enumValues('FlexDirection'),
      FlexAlign: enumValues('FlexAlign'), TOK_BORDER_W: 1, TOK_SPACE_XS: 8,
      TOK_SPACE_CARD_PADDING: 12, TOK_SPACE_ROW_BLOCK: 4 }));
  Object.assign(owner, {
    presentation: { kind: 'initial', history }, isTablet: tablet,
    historyWidth: width, historyCollapsedCount: 0, historyExpanded: expanded,
    viewState: { revision: 0, category: '全部', keywordDraft: '', historyExpanded: expanded },
    viewStateRevision: -1, appThemeScheme: 'day',
    resultDataSource: { replace() {} },
    getUIContext: () => ({ getMeasureUtils: () => ({ measureTextSize: input => {
      measurements.push(input); return { width: measureVp(input.textContent) * 3.5 };
    } }), px2vp: pixels => pixels / 3.5 }),
  });
  owner.refreshVisibleResults();
  owner.stateContent();
  return { owner, measurements, nodes: () => [...owner.nodes.values()],
    areas: () => [...owner.nodes.values()].filter(node => typeof node.onAreaChange === 'function') };
}
function dispatchArea(f, outerWidth) {
  const areas = f.areas();
  assert.equal(areas.length, 1, 'one authoritative measured history container');
  assert.equal(areas[0].type, 'Column', 'measure the stable history container, not count-dependent empty Flex');
  areas[0].onAreaChange({ width: 0 }, { width: outerWidth });
}
function replayHistory(f) {
  // Retain the SDK-produced ForEach closure and refresh only its data list.
  const each = f.nodes().find(node => node.type === 'ForEach');
  assert.ok(each);
  f.owner.runObserver(each.id, false);
}

check('initial history Scroll uses the top of the content viewport', () => {
  const f = fixture(['唯一历史']);
  assert.equal(f.nodes().find(node => node.type === 'Scroll').align, 'Alignment.TopStart');
});
check('one history item appears after the independently measurable outer container reports its real width', () => {
  const f = fixture(['唯一历史']);
  assert.equal(f.owner.historyWidth, 0);
  assert.ok(!f.nodes().some(node => String(node.accessibilityText ?? '').startsWith('展开其余')),
    'unmeasured history must not be presented as wholly collapsed');
  dispatchArea(f, 1280 / 3.5); // Existing VM width, converted to vp; 18vp padding per side.
  assert.equal(f.owner.historyWidth, 1280 / 3.5 - 36);
  assert.equal(f.owner.historyCollapsedCount, 1);
  replayHistory(f);
  assert.ok(f.nodes().some(node => node.type === 'Text' && node.create === '唯一历史'));
  assert.equal(f.measurements.at(-1).fontSize, '13fp');
  assert.equal(f.measurements.at(-1).fontFamily, 'ReaderInter');
});
check('empty first paint still provides width before asynchronous history arrives', () => {
  const f = fixture([]);
  dispatchArea(f, 390);
  assert.equal(f.owner.historyWidth, 354);
  f.owner.presentation = { kind: 'initial', history: ['加载后历史'] };
  f.owner.refreshVisibleResults();
  assert.equal(f.owner.historyCollapsedCount, 1);
});
check('two measured rows adapt to real width, long chips, tablet padding and late replacement', () => {
  const history = Array.from({ length: 8 }, (_, i) => `书${i}`);
  const f = fixture(history, { measureVp: () => 30 });
  dispatchArea(f, 196); // 160vp contents: each chip 69vp including margin -> 2 per row.
  assert.equal(f.owner.historyCollapsedCount, 4);
  dispatchArea(f, 266); // 230vp -> 3 per row.
  assert.equal(f.owner.historyCollapsedCount, 6);
  dispatchArea(f, 196);
  assert.equal(f.owner.historyCollapsedCount, 4, 'width contraction cannot retain the larger cut');
  dispatchArea(f, 0);
  assert.equal(f.owner.historyCollapsedCount, 0, 'zero-width layout cannot retain a stale cut');
  dispatchArea(f, 196);
  assert.equal(f.owner.historyCollapsedCount, 4);
  f.owner.presentation = { kind: 'initial', history: ['替换的一项'] };
  f.owner.refreshVisibleResults();
  assert.equal(f.owner.historyCollapsedCount, 1);
  const long = fixture(['非常长的历史', '短'], { tablet: true, measureVp: text => text === '短' ? 20 : 900 });
  dispatchArea(long, 260);
  assert.equal(long.owner.historyWidth, 220, 'tablet consumes 20vp on each side');
  assert.equal(long.owner.historyCollapsedCount, 2, 'long item is clamped to one row');
});
check('actual SDK action preserves matching expand and collapse intents', () => {
  const f = fixture(Array.from({ length: 8 }, (_, i) => `书${i}`), { width: 160, measureVp: () => 30 });
  const expand = f.nodes().find(n => n.accessibilityText === '展开其余 4 条搜索历史');
  assert.ok(expand); expand.onClick();
  assert.equal(f.owner.historyExpanded, true); assert.equal(f.owner.viewState.historyExpanded, true);
  const expanded = fixture(Array.from({ length: 8 }, (_, i) => `书${i}`), { width: 160, expanded: true, measureVp: () => 30 });
  const collapse = expanded.nodes().find(n => n.accessibilityText === '收起搜索历史');
  assert.ok(collapse); collapse.onClick();
  assert.equal(expanded.owner.historyExpanded, false); assert.equal(expanded.owner.viewState.historyExpanded, false);
});

for (const result of results) console.log(JSON.stringify(result));
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
else console.log('Search History actual SDK container/width lifecycle and production two-row measurement PASS; native pixels remain a separate gate.');
