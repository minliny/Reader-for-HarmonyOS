import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DIRECTORY_TOOL_GAP, DIRECTORY_TOOL_OUTSET, DIRECTORY_TOOL_SIZE, DIRECTORY_TOOL_TARGET,
  readerDirectoryToolbarBudget } from '../../entry/src/main/ets/features/reading/presentation/ReaderFullDirectoryBudget.ts';
import { resolveReaderControlDirectoryGeometry } from '../../entry/src/main/ets/features/reading/ui/ReaderControlDirectoryGeometry.ts';
import { readerCompactSearchHeight } from '../../entry/src/main/ets/ui/foundation/ReaderSearchControlGeometry.ts';

test('catalog and reader directory spend 36vp per icon with adjacent 44vp response regions', () => {
  assert.equal(DIRECTORY_TOOL_SIZE + 2 * DIRECTORY_TOOL_OUTSET, DIRECTORY_TOOL_TARGET);
  assert.equal(DIRECTORY_TOOL_GAP, 2 * DIRECTORY_TOOL_OUTSET);
  assert.deepEqual(readerDirectoryToolbarBudget(320, true, 36, 78, 0, true),
    { stacked: false, height: 44, fieldMinimumWidth: 146, actionsWidth: 80 });
  assert.deepEqual(readerDirectoryToolbarBudget(320, true, 36, 78),
    { stacked: false, height: 44, fieldMinimumWidth: 142, actionsWidth: 124 });
  assert.equal(readerDirectoryToolbarBudget(320, false, 36, 78).actionsWidth, 0);
});

test('320vp at 2× stacks reader tools while preserving a full IME line and Quick–Full interpolation', () => {
  const fieldHeight = readerCompactSearchHeight(36, 18, 2);
  const toolbar = readerDirectoryToolbarBudget(318, true, fieldHeight, 156);
  const height = toolbar.height + 2;
  assert.equal(fieldHeight, 38);
  assert.equal(toolbar.fieldMinimumWidth, 220);
  assert.equal(toolbar.stacked, true);
  assert.equal(height, 92);
  const quick = resolveReaderControlDirectoryGeometry(0, 'directory', 300, 31, 32, undefined, height);
  const middle = resolveReaderControlDirectoryGeometry(.5, 'directory', 300, 33.5, 36, undefined, height);
  const full = resolveReaderControlDirectoryGeometry(1, 'directory', 300, 36, 40, undefined, height);
  assert.equal(quick.nominalListTop, 48);
  assert.equal(middle.nominalListTop, (quick.nominalListTop + full.nominalListTop) / 2);
  assert.equal(full.nominalListTop - (full.toolbarTop + full.toolbarHeight), 4);
  assert.equal(full.toolbarComplete, true);
});
