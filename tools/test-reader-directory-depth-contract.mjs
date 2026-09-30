import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeReaderDirectoryOpen } from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';
import { readerDirectoryAccessibilityText, readerDirectoryIndentVp } from '../entry/src/main/ets/features/reading/ReaderDirectoryHierarchy.ts';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';

const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets', import.meta.url), 'utf8');
// The pre-fix row has no displayLevel method; run its actual Builder too so
// RED reports the wrong displayed level, rather than a missing test dependency.
const members = ['row', ...(source.includes('private displayLevel(') ? ['displayLevel'] : [])];
const identity = { sourceId: 'source', bookId: 'book', catalogRevision: 'catalog', structureRevision: 'structure' };
const longTitle = '长标题'.repeat(30);

function render(depth, kind, v2, hasChildren = false) {
  const node = { nodeId: `node-${depth}-${kind}`, depth, kind, title: longTitle,
    hasChildren, expanded: hasChildren, ...(kind === 'target' ? { chapterIndex: 42 } : {}) };
  const view = decodeReaderDirectoryOpen({ status: 'ready', viewId: 'view', navigationRevision: 'navigation',
    visibleTotal: 1, nodes: [node] });
  if (v2) view.identity = identity;
  const actions = [];
  const owner = createReaderBuilderProbe(source, members).owner;
  Object.assign(owner, { appThemeScheme: 'day', rowHeight: 40, view,
    chapterByIndex: new Map(), isCurrentNode: () => false,
    toggleNode: value => actions.push(['toggle', value.nodeId]),
    selectTarget: value => actions.push(['target', value.chapterIndex]) });
  owner.row({ key: node.nodeId, node: view.nodes[0], index: 0 });
  const text = [...owner.nodes.values()].filter(value => value.type === 'Text');
  return { node, actions, title: text.find(value => value.create === longTitle),
    arrow: text.find(value => value.create === '⌄') };
}

for (const [depth, level, left] of [[0, 1, 9], [1, 2, 21], [2, 3, 33], [32, 33, 45]]) {
  const row = render(depth, depth === 0 ? 'group' : 'target', true, depth === 0);
  assert.equal(row.title.padding.left, left, `v2 depth ${depth} has its own bounded indent`);
  assert.equal(row.title.accessibilityText,
    depth === 0 ? `第${level}级分组：${longTitle}，已展开` : `第${level}级，打开${longTitle}`,
    `v2 depth ${depth} announces a human-facing one-based level and full title`);
  assert.equal(row.title.layoutWeight, 1, 'title receives remaining row width');
  assert.equal(row.title.fontSize, 11, 'directory title preserves its fp font request');
  assert.equal(row.title.maxLines, 1);
  assert.deepEqual(row.title.textOverflow, { overflow: 'TextOverflow.Ellipsis' });
  assert.equal(row.title.maxFontScale, undefined, 'row does not explicitly cap system text scaling');
  row.title.onClick();
  assert.deepEqual(row.actions, depth === 0 ? [['toggle', row.node.nodeId]] : [['target', 42]],
    'display conversion cannot rewrite node or canonical chapter identity');
}

for (const [depth, left] of [[1, 9], [2, 21], [3, 33], [32, 45]]) {
  const row = render(depth, 'target', false);
  assert.equal(row.title.padding.left, left, 'legacy v1 indentation is unchanged');
  assert.equal(row.title.accessibilityText, `第${depth}级，打开${longTitle}`,
    'legacy v1 depth already represents the display level');
}

const parent = render(1, 'target', true, true);
parent.title.onClick(); parent.arrow.onClick();
assert.deepEqual(parent.actions, [['target', 42], ['toggle', parent.node.nodeId]],
  'linked parent keeps separately accessible chapter and disclosure actions');
assert.equal(parent.arrow.accessibilityText, `折叠${longTitle}子目录`);
assert.equal(render(1, 'disabled', true).title.accessibilityText, `${longTitle}，目标不可用`);
assert.equal(readerDirectoryIndentVp({ level: 2, title: longTitle }), 12);
assert.equal(readerDirectoryAccessibilityText({ level: 2, title: longTitle }), `第2级，打开章节：${longTitle}`,
  'legacy flat TOC level semantics are not changed');
console.log('PASS actual SDK tree rows: v2 zero-based depth, v1 compatibility, bounded indent and full accessibility actions');
