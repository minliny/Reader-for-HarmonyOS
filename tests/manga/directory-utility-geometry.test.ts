import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MANGA_DIRECTORY_UTILITY_ACTION_LINE, mangaDirectoryUtilityGeometry } from '../../entry/src/main/ets/features/manga/ui/MangaDirectoryUtilityGeometry.ts';

test('manga directory preserves the line-box gap and disjoint targets at normal and large type', () => {
  const normal = mangaDirectoryUtilityGeometry(1);
  assert.equal(normal.searchHeight, 36);
  assert.equal(normal.actionHeight, 30);
  assert.equal(normal.height, 84);
  for (const scale of [1, 1.5, 2]) {
    const geometry = mangaDirectoryUtilityGeometry(scale);
    const searchBottom = geometry.searchHeight + Math.max(0, 44 - geometry.searchHeight) / 2;
    const actionsTop = geometry.searchHeight + geometry.gap + geometry.actionResponseY;
    assert.ok(searchBottom <= actionsTop);
    assert.ok(geometry.actionResponseHeight >= 44);
    assert.equal(actionsTop + geometry.actionResponseHeight, geometry.height);
    assert.equal(geometry.gap + (geometry.actionHeight - MANGA_DIRECTORY_UTILITY_ACTION_LINE * scale) / 2, 12);
  }
});
