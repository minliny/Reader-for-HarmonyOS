import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerDirectoryClearViewportAnchors, readerDirectorySaveViewportAnchor,
  readerDirectoryViewportAnchor } from '../entry/src/main/ets/features/reading/ReaderDirectoryViewport.ts';

const path = fileURLToPath(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets', import.meta.url));
const source = readFileSync(path, 'utf8');
const timers = [];
const ScrollAlign = { START: 'start', CENTER: 'center' };
const List = productionMotionMethods(path, ['captureViewportAnchor', 'planPosition', 'schedulePosition',
  'positionInitialCurrent', 'onViewChanged', 'onInteractionChanged'], {
  readerDirectoryViewportAnchor, readerDirectorySaveViewportAnchor, ScrollAlign,
  LengthMetrics: { vp: value => ({ value }) }, setTimeout: action => timers.push(action),
});
function flush() { while (timers.length > 0) timers.shift()(); }
function node(id) { return { nodeId: id, kind: 'group', title: id, depth: 1, hasChildren: true, expanded: true }; }

readerDirectoryClearViewportAnchors();
{
  const scrolls = [];
  const old = { viewId: 'old-view', navigationRevision: 'rev', visibleTotal: 50000 };
  const next = { viewId: 'folded-view', navigationRevision: 'rev', visibleTotal: 30000,
    anchorVisibleIndex: 5997, currentVisibleIndex: 7 };
  const dataSource = { currentView: () => old, loadedNode: index => index === 6000 ? node('group-6000') : undefined,
    replace: view => { assert.equal(view, next); } };
  const list = Object.assign(new List(), { mounted: true, generation: 1, selectionGeneration: 0,
    bookId: 'book', view: next, dataSource, firstVisibleIndex: 6000, rowHeight: 40,
    scroller: { getItemRect: () => ({ y: -10, height: 40 }), scrollToIndex: (...args) => scrolls.push(args) } });
  list.onViewChanged();
  flush();
  assert.equal(readerDirectoryViewportAnchor('book').nodeId, 'group-6000');
  assert.deepEqual(scrolls, [[5997, false, 'start', { extraOffset: { value: 10 } }]],
    'folding restores the nearest visible ancestor with the same in-row fraction');
  assert.equal(list.initialPositionPending, false);
}
{
  const scrolls = [];
  readerDirectorySaveViewportAnchor({ bookId: 'morph', navigationRevision: 'rev', viewId: 'same-view',
    nodeId: 'deep-node', visibleIndex: 9000, rowFraction: 0.25 });
  const view = { viewId: 'same-view', navigationRevision: 'rev', visibleTotal: 50000,
    anchorVisibleIndex: 9000, currentVisibleIndex: 100 };
  const list = Object.assign(new List(), { mounted: true, generation: 4, bookId: 'morph', view,
    dataSource: { currentView: () => view, loadedNode: index => index === 9000 ? node('deep-node') : undefined,
      admit() {} }, firstVisibleIndex: 9000, rowHeight: 32, pendingPages: [],
    scroller: { getItemRect: () => ({ y: -8, height: 32 }), scrollToIndex: (...args) => scrolls.push(args) } });
  list.interactionEnabled = false; list.onInteractionChanged();
  list.rowHeight = 40; list.interactionEnabled = true; list.onInteractionChanged(); flush();
  assert.deepEqual(scrolls, [[9000, false, 'start', { extraOffset: { value: 10 } }]],
    'Quick→Full endpoint retains node identity and scales its in-row offset');
  assert.equal(readerDirectoryViewportAnchor('morph').nodeId, 'deep-node');
}
{
  const loads = [];
  const DataSource = productionMotionMethods(path,
    ['totalCount', 'getData', 'touchPage', 'replace', 'admit', 'loadedNode', 'currentView'],
    { DIRECTORY_PAGE_SIZE: 256, DIRECTORY_RETAINED_PAGES: 12 });
  const data = Object.assign(new DataSource(), { view: undefined, nodes: new Map(), pageOrder: [],
    pending: new Set(), listeners: [], load: offset => loads.push(offset) });
  const first = Array.from({ length: 256 }, (_, index) => node(`first-${index}`));
  data.replace({ viewId: 'large', visibleTotal: 50000, nodes: first });
  for (let page = 1; page <= 30; page += 1) {
    const offset = page * 256;
    data.admit(offset, { viewId: 'large', visibleTotal: 50000,
      nodes: Array.from({ length: 256 }, (_, index) => node(`page-${page}-${index}`)) });
    assert.ok(data.nodes.size <= 12 * 256, 'visited tree pages are bounded independently of a 50k-node catalog');
  }
  assert.equal(data.loadedNode(0), undefined);
  assert.equal(data.getData(0).key, 'loading:0');
  assert.deepEqual(loads, [0], 'evicted page can be requested again');
}
assert.match(source, /\.onScrollIndex\(\(start: number,[\s\S]*?this\.captureViewportAnchor\(\)/,
  'native visible index records stable node identity');
assert.match(source, /\.onScrollStop\(\(\): void => this\.captureViewportAnchor\(\)\)/,
  'row offset is captured after an in-row drag stops');
assert.match(source, /当前章在此组/,
  'collapsed visible ancestor announces where the current chapter resides');
console.log('PH42 tree viewport continuity, ancestor accessibility and bounded page cache: PASS');
