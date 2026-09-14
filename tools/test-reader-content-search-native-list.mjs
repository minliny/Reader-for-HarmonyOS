import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchListFixture, searchListRows, searchListSources, searchListTouches,
  searchListSource, searchListDependencies, assertSearchListBuilderGeometry } from './lib/reader-content-search-list-probe.mjs';
import * as list from '../entry/src/main/ets/features/reading/ReaderControlSearchListProjection.ts';
import * as scroll from '../entry/src/main/ets/features/reading/ReaderControlSearchScroll.ts';
const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-6, `${why}: ${a} != ${b}`);
const { ReaderContentSearchDataSource } = searchListDependencies;
assertSearchListBuilderGeometry();
for (const [from, to, expected] of [
  ['.position({ x: this.frame().results.x, y: this.frame().results.y }).clip(true)',
    '.position({ x: this.frame().results.x, y: this.frame().results.y }).clip(false)', /actual Results parent clips/],
  ['contentOriginVp: this.frame().firstResult.y', 'contentOriginVp: 0', /native extent preserves origin/],
  ['contentEndPaddingVp: this.frame().resultEndPadding', 'contentEndPaddingVp: 0', /native extent preserves origin/],
  ['.translate({ y: this.resultRowTranslation(this.currentResultIndex(result.chapterIndex, result.chapterOffset)) })', '.translate({ y: this.resultRowTranslation(this.currentResultIndex(result.chapterIndex, result.chapterOffset)) + 1 })', /authored child C and B-O paint/],
]) {
  assert.ok(searchListSource.includes(from));
  assert.throws(() => assertSearchListBuilderGeometry(searchListSource.replace(from, to)), expected);
}
const reports = [];
for (const count of [50, 2000, 10000]) {
  const f = searchListFixture({ count, p: 1 }); f.flush();
  const { owner, controller } = f;
  const anchor = count - 20.25;
  f.native(anchor * 72, searchListSources.DRAG); owner.onResultScrollStop(); f.flush();
  near(owner.resultScrollPosition.anchorRows, anchor, 'native endpoint uses row ruler');
  const sizes = owner.resultItemSizes;
  let maxNativeDemand = 0;
  for (const p of [1, .9, .5, .1, 0, .1, .5, .9, 1, .5, 0]) {
    f.resize(p, false);
    const beforeReceipt = controller.offset, commands = controller.commands.length;
    f.flush();
    near(owner.resultScrollPosition.anchorRows, anchor * p, 'deep Full→Quick path and held reversal');
    assert.equal(controller.offset, beforeReceipt, 'sending target never fabricates a native receipt');
    assert.ok(controller.commands.length <= commands + 1, 'one latest target per coalesced turn');
    const target = owner.resultListFrame().targetOffsetVp;
    f.native(target); f.flush();
    near(controller.offset, target, 'canonical native target follows desired visible row');
    assert.equal(owner.resultItemSizes, sizes); assert.equal(sizes.childDefaultSize, 72, 'no morph-time PosMap reset');
    const shape = owner.resultLayout(), projection = owner.resultScrollFrame(), native = owner.resultListFrame();
    const first = Math.max(0, Math.floor(controller.offset / 72) - 2);
    const last = Math.min(count - 1, Math.ceil((controller.offset + native.viewportHeightVp) / 72) + 1);
    maxNativeDemand = Math.max(maxNativeDemand, last - first + 1);
    // This independently describes List's uniform-size viewport plus cache,
    // then checks the actual authored paint interval is covered after receipt.
    for (const origin of [-38.45, 0, 5]) {
      const layout = { ...shape, contentOriginVp: origin };
      const visual = scroll.sampleReaderControlSearchScroll(owner.resultScrollPosition, layout);
      const visibleFirst = Math.max(0, Math.floor((visual.offsetVp - origin) / shape.rowHeightVp));
      const visibleLast = Math.min(count - 1, Math.ceil((visual.offsetVp - origin + shape.viewportHeightVp) / shape.rowHeightVp) - 1);
      assert.ok(visibleFirst >= first && visibleLast <= last, 'native demand covers negative-origin visual interval');
      for (const index of [visibleFirst, visibleLast]) {
        const translated = list.readerControlSearchListRowTranslation(index, layout, visual, controller.offset);
        near(index * 72 - controller.offset + translated, origin + index * shape.rowHeightVp - visual.offsetVp,
          'actual native layout + row transform equals authored paint, separately from range coverage');
      }
    }
  }
  f.resize(0, true); f.flush(); f.native(0); f.flush();
  assert.equal(owner.resultMotionPath, undefined, 'untouched endpoint releases the path');
  for (const source of [searchListSources.DRAG, searchListSources.FLING, searchListSources.OTHER_USER_INPUT,
    searchListSources.SCROLL_BAR, searchListSources.SCROLL_BAR_FLING]) {
    const before = owner.resultScrollPosition.anchorRows;
    f.native(controller.offset + 72, source);
    near(owner.resultScrollPosition.anchorRows, before + 1, 'all real user sources advance one canonical row');
  }
  owner.onResultScrollStop();
  const beforeAppend = owner.resultScrollPosition.anchorRows, rawBeforeAppend = controller.offset;
  owner.state = { ...owner.state, results: owner.state.results.concat(searchListRows(50).map((r, i) =>
    ({ ...r, chapterIndex: count + i }))) };
  owner.onResultDataChanged(); f.flush();
  near(owner.resultScrollPosition.anchorRows, beforeAppend, 'stable query append keeps anchor');
  assert.equal(controller.offset, rawBeforeAppend); assert.equal(owner.resultDataSource.totalCount(), count + 50);
  // User re-grab cancels a queued morph command, and a captured obsolete
  // timer cannot resume after a pointer/lifecycle generation has changed.
  f.resize(.5, false); const obsolete = [...f.timers.values()];
  owner.onResultTouch({ type: searchListTouches.Down, changedTouches: [{ id: 7 }] });
  const afterDown = controller.commands.length;
  for (const fn of obsolete) fn(); assert.equal(controller.commands.length, afterDown);
  owner.onResultTouch({ type: searchListTouches.Cancel, changedTouches: [] });
  owner.state = { kind: 'results', keyword: '新书', results: searchListRows(50, 'other') };
  owner.onResultDataChanged(); f.flush(); assert.equal(owner.resultScrollPosition.anchorRows, 0);
  f.native(600); assert.equal(owner.resultScrollPosition.anchorRows, 0, 'late old native movement does not rewrite new query anchor');
  f.flush(); f.native(owner.resultListFrame().targetOffsetVp); f.flush();
  assert.equal(controller.offset, 0);
  const stateBeforeDisappear = owner.resultScrollPosition, late = [...f.timers.values()];
  owner.onResultScrollDisappear(); const commandCount = controller.commands.length;
  for (const fn of late) fn(); f.native(900);
  assert.equal(owner.resultScrollPosition.anchorRows, stateBeforeDisappear.anchorRows);
  assert.equal(controller.commands.length, commandCount, 'detached module cannot issue native commands');
  assert.ok(maxNativeDemand <= 18, 'bound is viewport + two cached items per side, independent of N');
  reports.push({ count, maxNativeDemand, finalDataCount: count + 50 });
}
// API constraints are handled separately from painted offsets: native List
// forbids negative start/end padding, while the semantic max still shrinks.
for (const origin of [-38.45, -6, 0, 5]) {
  const shape = { rowHeightVp: 54, viewportHeightVp: 150, resultCount: 50, contentOriginVp: origin, contentEndPaddingVp: 5 };
  const projection = scroll.sampleReaderControlSearchScroll({ anchorRows: 100, nativeOffsetVp: 0, revision: 0 }, shape);
  const native = list.readerControlSearchListProjection(shape, projection);
  assert.ok(native.contentEndOffsetVp >= 0 && native.contentEndOffsetVp < native.viewportHeightVp);
  const atEnd = native.maxOffsetVp;
  assert.equal(list.readerControlSearchListScrollDelta(atEnd, 100, atEnd), 0);
  assert.equal(list.readerControlSearchListScrollDelta(0, -100, atEnd), 0);
  near(list.readerControlSearchListScrollDelta(atEnd, -72, atEnd), -72, 'tail can scroll back');
}
const ds = new ReaderContentSearchDataSource(), events = [];
const listener = { onDataReloaded: () => events.push('reload'), onDataChange: i => events.push(['change', i]),
  onDataAdd: i => events.push(['add', i]) };
ds.registerDataChangeListener(listener);
const a = searchListRows(50); assert.equal(ds.publish('q', a), 'replace');
assert.equal(ds.publish('q', a.concat(searchListRows(50).map((x, i) => ({ ...x, chapterIndex: i + 50 })))), 'append');
assert.equal(events.filter(e => e === 'reload').length, 1);
assert.equal(events.filter(e => e[0] === 'add').length, 50);
assert.equal(ds.publish('q', searchListRows(50, 'other')), 'replace', 'same chapter/offset in another book is a new identity');
assert.equal(ds.publish('q2', searchListRows(50, 'other')), 'replace');
ds.unregisterDataChangeListener(listener); const n = events.length; ds.publish('idle', []); assert.equal(events.length, n);
for (const count of [50, 2000, 10000]) {
  const indices = [0, 1, 2, 3, 4, 5];
  const f = searchListFixture({ count, indices });
  assert.equal(f.owner.resultDataSource.totalCount(), count, 'full dataset, no result truncation');
  assert.equal(f.lazy.calls.length, indices.length, 'actual SDK lazy generator builds only requested native indices');
  assert.equal([...f.owner.nodes.values()].filter(n => n.type === 'ListItem').length, indices.length);
  f.owner.onResultScrollDisappear();
}
// A retained native row resolves its current ordinal and owner at callback
// time. Reload/reordering cannot keep an old captured index or select a new book.
{
  const f = searchListFixture({ count: 50, p: 1, indices: [0] });
  const selected = []; f.owner.onSelectResult = row => selected.push(row);
  const item = [...f.owner.nodes.values()].find(n => n.type === 'ListItem');
  const row = [...f.owner.nodes.values()].find(n => n.onClick && n.accessibilityText?.includes('搜索结果'));
  const oldClick = row.onClick;
  f.owner.state = { ...f.owner.state, results: f.owner.state.results.slice().reverse() };
  f.owner.onResultDataChanged(); f.owner.motionProgress = .5; f.owner.replay();
  const moved = f.owner.currentResultIndex(0, 2);
  near(item.translate.y, f.owner.resultRowTranslation(moved), 'retained row translation uses current ordinal after reload');
  oldClick(); assert.equal(selected.length, 0, 'middle morph cannot select results');
  f.owner.motionProgress = 1; oldClick(); assert.equal(selected[0].chapterIndex, 0);
  f.owner.state = { ...f.owner.state, results: searchListRows(50, 'other') }; f.owner.onResultDataChanged();
  oldClick(); assert.equal(selected.length, 1, 'late old-book row click cannot select replacement book');
  f.owner.onResultScrollDisappear();
}
const fontSource = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderControlSearchContent.ets', import.meta.url), 'utf8');
assert.match(fontSource, /height\(14\)\.padding\(\{ left: 2, right: 2, top: 0, bottom: 0 \}\)\.borderRadius\(0\)/);
console.log(JSON.stringify({ contract: 'PH90 native List', reports, sdkLazyProviderVerified: true,
  boundary: 'SDK bindings, policy and paint equations passed; actual Ace range admission and pixel timing require VM validation' }));
