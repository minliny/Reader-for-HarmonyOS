import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SOURCE_SWITCH_FILTER_GAP, sourceSwitchNovelFilterHeight,
  sourceSwitchNovelFilterRowHeight } from '../../entry/src/main/ets/features/source/ui/SourceSwitchNovelPresentation.ts';

test('source filter matches locate height and admits progress and large action text', () => {
  assert.equal(sourceSwitchNovelFilterRowHeight(1), 36);
  assert.equal(sourceSwitchNovelFilterRowHeight(2), 42);
  assert.equal(36 + 2 * SOURCE_SWITCH_FILTER_GAP, 44);
  assert.equal(sourceSwitchNovelFilterHeight(1, false), 90);
  assert.equal(sourceSwitchNovelFilterHeight(2, false), 104);
  assert.ok(sourceSwitchNovelFilterHeight(2, true) > sourceSwitchNovelFilterHeight(2, false));
});
