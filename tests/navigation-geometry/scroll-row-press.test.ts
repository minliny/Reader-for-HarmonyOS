import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ROW_PRESS_DELAY_MS,
  ROW_PRESS_RELEASE_MS,
  ROW_PRESS_SLOP_VP,
  ReaderRowPressMachine,
} from '../../entry/src/main/ets/ui/foundation/ReaderDelayedRowPress.ts';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readEntrySource(relativePath: string): string {
  return readFileSync(new URL(`../../entry/src/main/ets/${relativePath}`, import.meta.url), 'utf8');
}

function assertEveryPressFeedbackDisablesNativePress(source: string, label: string): void {
  const token = 'new ReaderPressFeedback(';
  let index = source.indexOf(token);
  assert.ok(index >= 0, `${label} must instantiate ReaderPressFeedback`);
  while (index >= 0) {
    let depth = 1;
    let cursor = index + token.length;
    while (cursor < source.length && depth > 0) {
      const ch = source[cursor];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      cursor += 1;
    }
    assert.equal(depth, 0, `${label} has unbalanced ReaderPressFeedback call`);
    const callArgs = source.slice(index + token.length, cursor - 1).trim();
    assert.ok(/,\s*false\s*$/.test(callArgs),
      `${label} scrollable row ReaderPressFeedback must pass nativePress = false, got: ${callArgs}`);
    index = source.indexOf(token, cursor);
  }
}

test('ReaderRowPressMachine suppresses highlight on initial touch down and drag beyond slop', async () => {
  const seen: string[] = [];
  const machine = new ReaderRowPressMachine((key: string): void => { seen.push(key); });

  const admitted = machine.observe('down', 1, 100, 200, 1, 'row-1', true);
  assert.equal(admitted, true);
  assert.deepEqual(seen, []);

  // Dragging vertically past ROW_PRESS_SLOP_VP before 90ms must cancel cleanly.
  machine.observe('move', 1, 100, 200 + ROW_PRESS_SLOP_VP + 1, 1, 'row-1', true);
  await sleep(ROW_PRESS_DELAY_MS + 35);
  assert.deepEqual(seen, []);
});

test('ReaderRowPressMachine cancels on touch cancel and multi-touch without flashing highlight', async () => {
  const seen: string[] = [];
  const machine = new ReaderRowPressMachine((key: string): void => { seen.push(key); });

  machine.observe('down', 2, 50, 120, 1, 'row-cancel', true);
  machine.observe('cancel', 2, 50, 120, 0, 'row-cancel', true);
  await sleep(ROW_PRESS_DELAY_MS + 35);
  assert.deepEqual(seen, []);

  machine.observe('down', 3, 50, 120, 1, 'row-multi', true);
  machine.observe('move', 3, 50, 121, 2, 'row-multi', true);
  await sleep(ROW_PRESS_DELAY_MS + 35);
  assert.deepEqual(seen, []);
});

test('ReaderRowPressMachine reveals highlight after delay and clears immediately on drag or scroll cancel', async () => {
  const seen: string[] = [];
  const machine = new ReaderRowPressMachine((key: string): void => { seen.push(key); });

  machine.observe('down', 1, 80, 300, 1, 'row-hold', true);
  assert.deepEqual(seen, []);
  await sleep(ROW_PRESS_DELAY_MS + 35);
  assert.deepEqual(seen, ['row-hold']);

  machine.observe('move', 1, 80, 300 + ROW_PRESS_SLOP_VP + 2, 1, 'row-hold', true);
  assert.deepEqual(seen, ['row-hold', '']);

  // Holding again then cancelling via Scroll/List onScrollStart.
  seen.length = 0;
  machine.observe('down', 1, 80, 300, 1, 'row-scroll', true);
  await sleep(ROW_PRESS_DELAY_MS + 35);
  assert.deepEqual(seen, ['row-scroll']);
  machine.cancel();
  assert.deepEqual(seen, ['row-scroll', '']);
});

test('ReaderRowPressMachine paints a brief release flash for quick taps and clears automatically', async () => {
  const seen: string[] = [];
  const machine = new ReaderRowPressMachine((key: string): void => { seen.push(key); });

  machine.observe('down', 1, 40, 100, 1, 'row-tap', true);
  assert.deepEqual(seen, []);
  machine.observe('up', 1, 41, 101, 0, 'row-tap', true);
  assert.deepEqual(seen, ['row-tap']);

  await sleep(ROW_PRESS_RELEASE_MS + 40);
  assert.deepEqual(seen, ['row-tap', '']);
});

test('all managed scrollable row surfaces use ReaderDelayedRowPress and avoid immediate press regressions', () => {
  const delayedPressFiles = [
    'features/search/ui/ReaderSearchHistoryPanel.ets',
    'ui/controls/ReaderFormRow.ets',
    'features/search/ui/SearchResultCard.ets',
    'features/bookshelf/ui/BookshelfPage.ets',
    'features/bookshelf/ui/BookshelfMultiSelectPage.ets',
    'features/reading/ui/ReaderDirectoryChapterRow.ets',
    'features/reading/ui/ReaderDirectoryNavigationList.ets',
    'features/manga/ui/MangaDirectoryEntryRow.ets',
    'features/source/ui/SourceSwitchWindow.ets',
    'features/source/ui/SourceManagementListRow.ets',
  ];

  for (const file of delayedPressFiles) {
    const source = readEntrySource(file);
    assert.match(source, /\bReaderDelayedRowPress\b/, `${file} must wire ReaderDelayedRowPress`);
    if (file !== 'features/source/ui/SourceSwitchWindow.ets') {
      assert.doesNotMatch(source, /\breaderPressPointer\b/, `${file} must not regress to immediate readerPressPointer`);
    }
  }

  const historySource = readEntrySource('features/search/ui/ReaderSearchHistoryPanel.ets');
  assert.match(historySource, /\.onScrollStart\(/, 'ReaderSearchHistoryPanel must cancel row press on Scroll start');
  assert.match(historySource, /\.scrollBar\(BarState\.Off\)/, 'ReaderSearchHistoryPanel must keep scroll bar hidden');
  const historyRowsStart = historySource.indexOf('private historyRows()');
  const historyRowsEnd = historySource.indexOf('build()', historyRowsStart);
  assert.ok(historyRowsStart >= 0 && historyRowsEnd > historyRowsStart, 'historyRows() builder not found');
  assertEveryPressFeedbackDisablesNativePress(
    historySource.slice(historyRowsStart, historyRowsEnd),
    'ReaderSearchHistoryPanel.historyRows',
  );

  const multiSelectSource = readEntrySource('features/bookshelf/ui/BookshelfMultiSelectPage.ets');
  assert.match(multiSelectSource, /\.onScrollStart\(/, 'BookshelfMultiSelectPage must cancel row press on List start');
  const rowActionStart = multiSelectSource.indexOf('private selectionRowAction(');
  const rowActionEnd = multiSelectSource.indexOf('private currentBook(', rowActionStart);
  assert.ok(rowActionStart >= 0 && rowActionEnd > rowActionStart, 'selectionRowAction() helper not found');
  assertEveryPressFeedbackDisablesNativePress(
    multiSelectSource.slice(rowActionStart, rowActionEnd),
    'BookshelfMultiSelectPage.selectionRowAction',
  );

  for (const file of [
    'features/reading/ui/ReaderDirectoryChapterRow.ets',
    'features/reading/ui/ReaderDirectoryNavigationList.ets',
    'features/manga/ui/MangaDirectoryEntryRow.ets',
  ]) {
    assertEveryPressFeedbackDisablesNativePress(readEntrySource(file), file);
  }
});
