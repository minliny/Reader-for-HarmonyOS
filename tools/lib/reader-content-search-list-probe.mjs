import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { productionMotionMethods } from './reader-motion-method-probe.mjs';
import * as geometry from '../../entry/src/main/ets/features/reading/ReaderControlSearchGeometry.ts';
import * as scroll from '../../entry/src/main/ets/features/reading/ReaderControlSearchScroll.ts';
import * as list from '../../entry/src/main/ets/features/reading/ReaderControlSearchListProjection.ts';
import * as morph from '../../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';
import * as motion from '../../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
import * as data from '../../entry/src/main/ets/features/reading/ReaderContentSearchDataSource.ts';
import { splitReaderSearchSnippet } from '../../entry/src/main/ets/features/reading/ReaderSearchHighlight.ts';
export const searchListSourceUrl = new URL('../../entry/src/main/ets/features/reading/ReaderControlSearchContent.ets', import.meta.url);
export const searchListSource = readFileSync(searchListSourceUrl, 'utf8');
export const searchListSources = { DRAG: 0, FLING: 1, EDGE_EFFECT: 2, OTHER_USER_INPUT: 3,
  SCROLL_BAR: 4, SCROLL_BAR_FLING: 5, SCROLLER: 6, SCROLLER_ANIMATION: 7 };
export const searchListTouches = { Down: 0, Up: 1, Move: 2, Cancel: 3 };
export const searchListMethods = ['frame', 'resultLayout', 'resultScrollFrame', 'resultListFrame',
  'resultRowTranslation', 'resultNativeRawOffset', 'resultNativeOffset', 'onResultDataChanged',
  'onResultLayoutChanged', 'syncResultNativeOffset', 'onResultScrollAppear', 'onResultScrollDisappear',
  'onResultScrollArea', 'onResultWillScroll', 'onResultDidScroll', 'onResultTouch', 'onResultScrollStop',
  'tryResultScrollRebase', 'cancelResultNativeFollow', 'scheduleResultNativeFollow'];
export const searchListRowMembers = ['resultsBody', 'loadMoreAction', 'resultRow', 'resultSnippet',
  'resultTitle', 'currentResult', 'currentResultIndex', 'currentSnippet', 'selectCurrentResult', 'statusText',
  'presentation', 'resultClip'];
export const searchListDependencies = { ...geometry, ...scroll, ...list, ...morph, ...motion, ...data,
  splitReaderSearchSnippet, ScrollSource: searchListSources, TouchType: searchListTouches,
  PathShape: class { commands(path) { this.path = path; return this; } } };
export const searchListRows = (count, bookId = 'b') => Array.from({ length: count }, (_, i) => ({
  sourceId: 's', bookId, chapterIndex: i, chapterOffset: 2, chapterTitle: `第${i + 1}章`,
  snippet: '甲乙他搜索正文', snippetStart: 0, matchLength: 1,
}));

/** Drive an explicit range requested by a hypothetical native layout pass.
 * This helper is not a virtual-list engine and cannot prove Ace's actual range
 * choice or paint fence. Production receives the full unsliced data source. */
export function searchListLazyRequests(indices) {
  const calls = [];
  return { calls, LazyForEach: {
    create(id, owner, source, generate, key) {
      for (const index of indices) {
        assert.ok(index >= 0 && index < source.totalCount());
        const row = source.getData(index); calls.push({ index, key: key(row), owner }); generate(row, index);
      }
    }, pop() {},
  } };
}
export function searchListFixture({ count = 50, p = 0, indices, source = searchListSource } = {}) {
  const timers = new Map(); let nextTimer = 1;
  const timersApi = { setTimeout(fn) { const id = nextTimer++; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); } };
  const lazy = searchListLazyRequests(indices ?? []);
  let owner;
  if (indices !== undefined) {
    owner = createReaderBuilderProbe(source, [...searchListMethods, ...searchListRowMembers],
      { ...searchListDependencies, ...timersApi, LazyForEach: lazy.LazyForEach }).owner;
  } else {
    const C = productionMotionMethods(searchListSourceUrl, searchListMethods,
      { ...searchListDependencies, ...timersApi }); owner = new C();
  }
  const controller = { offset: 0, commands: [], currentOffset() { return { xOffset: 0, yOffset: this.offset }; },
    scrollTo(command) { this.commands.push(command); } };
  Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p, availableHeight: 190 + 476 * p,
    fullContentHeight: 666, quickContentHeight: 190, interactionEnabled: true,
    resultScroller: controller, resultDataSource: new data.ReaderContentSearchDataSource(), resultItemSizes: { childDefaultSize: 72 },
    resultNativeFollowTimer: -1, resultNativeFollowLifecycle: 0, resultNativeRawBase: 0,
    resultScrollMounted: false, resultViewportHeight: 0, resultPointers: [], resultUserScrolling: false,
    resultScrollSource: 'unknown', resultRowIndexes: new Map(), resultScrollPosition: scroll.createReaderControlSearchScroll(),
    state: { kind: 'results', keyword: '他', results: searchListRows(count) },
    getUIContext: () => ({ vp2px: x => x * 3 }), onLoadMore() {}, onSelectResult() {} });
  owner.onResultDataChanged();
  if (indices !== undefined) owner.resultsBody();
  owner.onResultScrollAppear(); owner.onResultScrollArea({ height: owner.resultListFrame().viewportHeightVp });
  return { owner, controller, timers, lazy, flush() {
    const ready = [...timers.entries()]; timers.clear();
    for (const [, fn] of ready) fn();
  }, resize(p, enabled = owner.interactionEnabled) {
    Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p,
      availableHeight: 190 + 476 * p, interactionEnabled: enabled });
    owner.onResultLayoutChanged(); owner.onResultScrollArea({ height: owner.resultListFrame().viewportHeightVp });
  }, native(rawOffset, source = searchListSources.SCROLLER) {
    const delta = owner.onResultWillScroll(rawOffset - controller.offset, source).yOffset;
    controller.offset += delta; owner.onResultDidScroll(); return delta;
  } };
}
export function assertSearchListBuilderGeometry(source = searchListSource) {
  const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-7, `${label}: ${a} != ${b}`);
  const f = searchListFixture({ count: 13, indices: [0, 1, 12], source });
  const { owner, controller } = f;
  const parent = owner.nodes.get(0), native = [...owner.nodes.values()].find(n => n.type === 'List');
  const items = [...owner.nodes.values()].filter(n => n.type === 'ListItem');
  assert.equal([...owner.nodes.values()].filter(n => n.type === 'List').length, 1);
  assert.deepEqual(native.cachedCount, [2, true]); assert.equal(native.childrenMainSize, owner.resultItemSizes);
  assert.equal(native.clip, false); assert.equal(native.maintainVisibleContentPosition, true);
  for (const anchor of [0, 2.25, 50]) {
    const seen = new Map();
    for (const p of [0, .25, .5, .75, 1, .75, .5, .25, 0]) {
      Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p, availableHeight: 190 + 476 * p });
      const frame = owner.frame(), ratio = 72 / frame.rowHeight;
      owner.resultScrollPosition = { anchorRows: anchor, nativeOffsetVp: 121 / ratio, revision: 0 };
      controller.offset = 121; owner.replay();
      assert.equal(parent.clip, true, 'actual Results parent clips');
      assert.deepEqual(parent.position, { x: frame.results.x, y: frame.results.y });
      near(parent.position.y, frame.queryDivider.y + 1, 'input/result boundary');
      near(native.width, frame.firstResult.width, 'native row width'); near(native.position.x, frame.firstResult.x, 'native row X');
      near(native.height, parent.height * ratio, 'viewport canonical conversion');
      near(native.contentEndOffset, (frame.firstResult.y + 5) * ratio, 'native extent preserves origin and py5');
      const scrollFrame = owner.resultScrollFrame(), painted = [];
      items.forEach((item, j) => {
        const index = [0, 1, 12][j]; assert.equal(item.height, 72); assert.equal(item.clip, false);
        const actualY = index * item.height - 121 + item.translate.y;
        near(actualY, frame.firstResult.y + index * frame.rowHeight - scrollFrame.offsetVp, 'authored child C and B-O paint');
        painted.push(actualY);
      });
      if (anchor === 0) near(painted[0], frame.firstResult.y, 'first-row origin');
      if (anchor === 50) near(painted[2] + frame.rowHeight, parent.height - 5, 'last result exact py5');
      const pose = JSON.stringify(painted); if (seen.has(p)) assert.equal(pose, seen.get(p), 'same-p retained actors return identically');
      seen.set(p, pose);
    }
  }
  f.owner.onResultScrollDisappear();
}
