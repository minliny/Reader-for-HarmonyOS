import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_FLOATING_HEADER_BAR_HEIGHT, BOOKSHELF_HEADER_TITLE_LINE_HEIGHT,
  resolveSearchHeaderField, SEARCH_HEADER_BAR_VERTICAL_PADDING }
  from '../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import { readerLibraryHeaderContentHeight } from '../../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts';
import { readerCompactSearchHeight, readerSearchActionWidth, readerSearchControlHeight,
  readerSearchControlVisualHeight, SEARCH_CAPSULE_EMPTY_CHROME, SEARCH_CAPSULE_HEIGHT }
  from '../../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts';
import { projectSearchHistoryPanel, SearchHistoryGeometry, SearchHistoryViewport }
  from '../../entry/src/main/ets/features/search/ui/SearchHistoryGeometry.ts';

test('at standard text size both enclosing borders count towards the authored shelf height', () => {
  for (const border of [0, 1, 2]) {
    const content = readerLibraryHeaderContentHeight(APP_FLOATING_HEADER_BAR_HEIGHT, BOOKSHELF_HEADER_TITLE_LINE_HEIGHT, 1, border);
    assert.equal(content + 2 * border, 52);
  }
});

test('at standard text size the search capsule stays concentric during the 52vp shelf transition', () => {
  const border = 1;
  const controlHeight = readerSearchControlHeight(1);
  const visualHeight = readerSearchControlVisualHeight(1);
  const expanded = controlHeight + 2 * SEARCH_HEADER_BAR_VERTICAL_PADDING;
  const inset = border + SEARCH_HEADER_BAR_VERTICAL_PADDING + (controlHeight - visualHeight) / 2;
  assert.equal(controlHeight, 44);
  assert.equal(visualHeight, 36);
  assert.equal(inset, 8);
  for (const progress of [0, .5, 1]) {
    const height = readerLibraryHeaderContentHeight(APP_FLOATING_HEADER_BAR_HEIGHT,
      BOOKSHELF_HEADER_TITLE_LINE_HEIGHT, 1, border, expanded, progress) + 2 * border;
    assert.equal(height, 52);
    assert.equal(visualHeight / 2 + inset, height / 2);
  }
});

test('shelf search expands smoothly to the control lane plus the search header padding', () => {
  const fontScale = 2;
  const border = 1;
  const expanded = readerSearchControlHeight(fontScale) + 2 * SEARCH_HEADER_BAR_VERTICAL_PADDING;
  const render = (progress: number) => readerLibraryHeaderContentHeight(APP_FLOATING_HEADER_BAR_HEIGHT,
    BOOKSHELF_HEADER_TITLE_LINE_HEIGHT, fontScale, border, expanded, progress);
  assert.equal(render(0), 56);
  assert.equal(render(.5), 65);
  assert.equal(render(1), 74);
});

test('shelf search wraps its action only when the compact query prompt no longer fits', () => {
  const compactLane = 320 - 2 * 16 - 2 - 49 - 7;
  assert.deepEqual(resolveSearchHeaderField(compactLane, readerSearchActionWidth(false, 1),
    SEARCH_CAPSULE_EMPTY_CHROME, 14), { width: 166, stacked: false, shortPlaceholder: false });
  assert.deepEqual(resolveSearchHeaderField(compactLane, readerSearchActionWidth(false, 2),
    SEARCH_CAPSULE_EMPTY_CHROME, 28), { width: 230, stacked: true, shortPlaceholder: true });
  assert.deepEqual(resolveSearchHeaderField(340, readerSearchActionWidth(false, 2),
    SEARCH_CAPSULE_EMPTY_CHROME, 28), { width: 250, stacked: false, shortPlaceholder: false });
});

test('compact search border boxes grow only as needed for the full scaled line', () => {
  assert.equal(readerCompactSearchHeight(SEARCH_CAPSULE_HEIGHT, 20, 1), 36);
  assert.equal(readerCompactSearchHeight(SEARCH_CAPSULE_HEIGHT, 20, 2), 42);
  assert.equal(readerCompactSearchHeight(SEARCH_CAPSULE_HEIGHT, 18, 2), 38);
  assert.equal(readerCompactSearchHeight(40, 18, 1), 40);
  assert.equal(readerCompactSearchHeight(40, 18, 2), 40);
});

test('search history keeps its compact heading, row height and spacing at both font scales', () => {
  for (const [scale, headingHeight, fixedHeight, rowHeight] of [[1, 24, 54, 40], [2, 48, 78, 58]]) {
    const layout = new SearchHistoryGeometry(286, fixedHeight, scale, false);
    assert.equal(layout.headingHeight, headingHeight);
    assert.equal(layout.rowHeight, rowHeight);
    assert.equal(layout.topInset, 12);
    assert.equal(layout.headingGap, 6);
    assert.equal(layout.bottomInset, 12);
    assert.equal(layout.fixedHeight(), fixedHeight);
    assert.equal(new SearchHistoryGeometry(286, fixedHeight - 1, scale, false).headingVisible, false);
  }
});

test('search history admits up to 6 rows without scrolling and clamps safely when viewport shrinks', () => {
  const keywords = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
  const full = projectSearchHistoryPanel(keywords, new SearchHistoryGeometry(336, 385, 1, false));
  assert.deepEqual(full.items, ['one', 'two', 'three', 'four', 'five', 'six']);
  assert.equal(full.height, 294);

  const unbounded = projectSearchHistoryPanel(keywords, new SearchHistoryGeometry(336, 385, 1, false), true);
  assert.deepEqual(unbounded.items, keywords);
  assert.equal(unbounded.height, 374);

  const tight = projectSearchHistoryPanel(keywords, new SearchHistoryGeometry(336, 200, 1, false));
  assert.deepEqual(tight.items, ['one', 'two', 'three']);
  assert.equal(tight.height, 174);

  const viewport = new SearchHistoryViewport(full.height, 98, 483, 280, 120);
  assert.equal(viewport.height, 294);
  assert.equal(viewport.suppressContinueCard, false);
});
