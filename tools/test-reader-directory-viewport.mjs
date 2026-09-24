import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerDirectoryClearViewportAnchors, readerDirectorySaveViewportAnchor,
  readerDirectoryViewportAnchor, readerDirectoryObserveScrollIntent,
  readerDirectorySignalScrollIntent, readerDirectoryObserveScrollCommand,
  readerDirectorySignalScrollCommand } from '../entry/src/main/ets/features/reading/ReaderDirectoryViewport.ts';

const path = fileURLToPath(new URL('../entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets', import.meta.url));
const source = readFileSync(path, 'utf8');
const timers = [];
const ScrollAlign = { START: 'start', CENTER: 'center' };
const List = productionMotionMethods(path, ['captureViewportAnchor', 'planPosition', 'schedulePosition',
  'positionInitialCurrent', 'onViewChanged', 'onInteractionChanged', 'aboutToDisappear', 'onScrollCommand'], {
  readerDirectoryViewportAnchor, readerDirectorySaveViewportAnchor, ScrollAlign,
  LengthMetrics: { vp: value => ({ value }) }, setTimeout: action => timers.push(action),
});
function flush() { while (timers.length > 0) timers.shift()(); }
function node(id) { return { nodeId: id, kind: 'group', title: id, depth: 1, hasChildren: true, expanded: true }; }

readerDirectoryClearViewportAnchors();
{
  const observed = [];
  const unsubscribe = readerDirectoryObserveScrollIntent('book', () => observed.push('top'));
  readerDirectorySignalScrollIntent('book'); unsubscribe(); readerDirectorySignalScrollIntent('book');
  assert.deepEqual(observed, ['top'], 'toolbar signal is synchronous and scoped to mounted book observer');
}
{
  const settled = [];
  const view = { viewId: 'no-op-view', navigationRevision: 'rev', visibleTotal: 1 };
  const list = Object.assign(new List(), { mounted: true, generation: 1, bookId: 'at-top',
    dataSource: { currentView: () => view, loadedNode: () => node('top-node') },
    firstVisibleIndex: 0, scroller: { getItemRect: () => ({ y: 0, height: 40 }) },
    onScrollSettled: () => settled.push('settled') });
  const unsubscribe = readerDirectoryObserveScrollCommand('at-top', () => list.onScrollCommand());
  readerDirectorySignalScrollCommand('at-top');
  assert.deepEqual(settled, [], 'edge command waits until the native scroll call has returned');
  flush(); unsubscribe();
  assert.deepEqual(settled, ['settled'], 'an edge no-op reuses the normal tree settle callback');
  assert.deepEqual([readerDirectoryViewportAnchor('at-top').nodeId,
    readerDirectoryViewportAnchor('at-top').rowFraction], ['top-node', 0]);
  readerDirectorySignalScrollCommand('at-top'); flush();
  assert.deepEqual(settled, ['settled'], 'unmounted observer cannot reopen a stale directory');
}
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
  const view = { viewId: 'quick-view', navigationRevision: 'rev', visibleTotal: 50000 };
  const list = Object.assign(new List(), { mounted: true, generation: 5, selectionGeneration: 0,
    bookId: 'unmount', view, pendingPages: [], firstVisibleIndex: 14000,
    dataSource: { currentView: () => view, loadedNode: index => index === 14000 ? node('last-visible') : undefined },
    scroller: { getItemRect: () => ({ y: -18, height: 40 }) } });
  list.aboutToDisappear();
  assert.deepEqual([readerDirectoryViewportAnchor('unmount').nodeId,
    readerDirectoryViewportAnchor('unmount').rowFraction], ['last-visible', 0.45],
    'unmount during inertial motion captures its final row offset before Full takes ownership');
}
{
  const loads = [];
  class FakePlatformLRUCache {
    constructor(capacity) { this.capacity = capacity; this.entries = new Map(); }
    get(key) {
      if (!this.entries.has(key)) return undefined;
      const value = this.entries.get(key); this.entries.delete(key); this.entries.set(key, value); return value;
    }
    put(key, value) {
      if (this.entries.has(key)) this.entries.delete(key);
      this.entries.set(key, value);
      if (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value);
      return value;
    }
    clear() { this.entries.clear(); }
    keys() { return [...this.entries.keys()]; }
    get length() { return this.entries.size; }
  }
  const DataSource = productionMotionMethods(path,
    ['totalCount', 'getData', 'replace', 'admit', 'loadedNode', 'currentView'],
    { DIRECTORY_PAGE_SIZE: 256, util: { LRUCache: FakePlatformLRUCache } });
  const data = Object.assign(new DataSource(), { view: undefined, pages: new FakePlatformLRUCache(12),
    pending: new Set(), listeners: [], load: offset => loads.push(offset) });
  const first = Array.from({ length: 256 }, (_, index) => node(`first-${index}`));
  data.replace({ viewId: 'large', visibleTotal: 50000, nodes: first });
  for (let page = 1; page <= 30; page += 1) {
    const offset = page * 256;
    data.admit(offset, { viewId: 'large', visibleTotal: 50000,
      nodes: Array.from({ length: 256 }, (_, index) => node(`page-${page}-${index}`)) });
    assert.ok(data.pages.length <= 12, 'platform LRU retains at most 12 pages for a 50k-node catalog');
  }
  assert.equal(data.loadedNode(0), undefined);
  assert.equal(data.getData(0).key, 'loading:0');
  assert.deepEqual(loads, [0], 'evicted page can be requested again');

  const reloadKeys = [];
  const oldPage = Array.from({ length: 256 }, (_, index) => node(`old-${index}`));
  oldPage[6000 - 5888] = node('stable-visible');
  const preparedTarget = Array.from({ length: 256 }, (_, index) => node(`target-${index}`));
  preparedTarget[5000 - 4864] = node('stable-visible');
  const preparedPhysical = Array.from({ length: 256 }, (_, index) => node(`physical-${index}`));
  const deep = Object.assign(new DataSource(), { view: undefined, pages: new FakePlatformLRUCache(12),
    pending: new Set(), listeners: [], load: offset => loads.push(offset) });
  deep.replace({ viewId: 'old-deep', navigationRevision: 'rev', visibleTotal: 10001, nodes: first });
  deep.admit(5888, { viewId: 'old-deep', visibleTotal: 10001, nodes: oldPage });
  assert.equal(deep.getData(6000).key, 'stable-visible');
  deep.listeners.push({ onDataChanged() {}, onDataReloaded() {
    reloadKeys.push([deep.getData(5000).key, deep.getData(6000).key]);
  } });
  deep.replace({ viewId: 'folded-deep', navigationRevision: 'rev', visibleTotal: 10001, nodes: first,
    preparedPages: [
      { offset: 4864, page: { viewId: 'folded-deep', visibleTotal: 10001, nodes: preparedTarget } },
      { offset: 5888, page: { viewId: 'folded-deep', visibleTotal: 10001, nodes: preparedPhysical } },
    ] });
  assert.deepEqual(reloadKeys, [['stable-visible', 'physical-112']],
    '10k-node fold presents stable node keys at the new rank and resolved old physical viewport before reload');
}
assert.match(source, /\.onScrollIndex\(\(start: number,[\s\S]*?this\.captureViewportAnchor\(\)/,
  'native visible index records stable node identity');
assert.match(source, /\.onScrollStop\(\(\): void => \{ this\.captureViewportAnchor\(\); this\.onScrollSettled\(\); \}\)/,
  'row offset is captured after an in-row drag stops');
assert.match(source, /当前章在此组/,
  'collapsed visible ancestor announces where the current chapter resides');
assert.match(source, /new util\.LRUCache<number, ReaderDirectoryNavigationNode\[\]>\(DIRECTORY_RETAINED_PAGES\)/,
  'production delegates generic page eviction to the platform LRUCache');
console.log('PH42 tree viewport continuity, ancestor accessibility and bounded page cache: PASS');
