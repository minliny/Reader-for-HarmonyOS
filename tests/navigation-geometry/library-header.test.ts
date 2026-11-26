import assert from 'node:assert/strict';
import { test } from 'node:test';
import { APP_FLOATING_HEADER_BAR_HEIGHT, BOOKSHELF_HEADER_TITLE_LINE_HEIGHT, SEARCH_HEADER_BAR_VERTICAL_PADDING }
  from '../../entry/src/main/ets/ui/foundation/ReaderHeaderMetrics.ts';
import { readerLibraryHeaderContentHeight } from '../../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts';
import { readerSearchControlHeight } from '../../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts';

test('at standard text size both enclosing borders count towards the authored shelf height', () => {
  for (const border of [0, 1, 2]) {
    const content = readerLibraryHeaderContentHeight(APP_FLOATING_HEADER_BAR_HEIGHT, BOOKSHELF_HEADER_TITLE_LINE_HEIGHT, 1, border);
    assert.equal(content + 2 * border, 52);
  }
});

test('shelf search expands smoothly to the control lane plus the search header padding', () => {
  const fontScale = 2;
  const border = 1;
  const expanded = readerSearchControlHeight(fontScale) + 2 * SEARCH_HEADER_BAR_VERTICAL_PADDING;
  const render = (progress: number) => readerLibraryHeaderContentHeight(APP_FLOATING_HEADER_BAR_HEIGHT,
    BOOKSHELF_HEADER_TITLE_LINE_HEIGHT, fontScale, border, expanded, progress);
  assert.equal(render(0), 56);
  assert.equal(render(.5), 70);
  assert.equal(render(1), 84);
});
