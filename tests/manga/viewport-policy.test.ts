import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mangaDirectoryColumnWidth, mangaUsesPersistentDirectory } from '../../entry/src/main/ets/features/manga/ui/MangaLayoutPolicy.ts';

test('wide tablet layout retains directory while phone landscape gives the canvas its width', () => {
  assert.equal(mangaUsesPersistentDirectory(820, 420, false), false);
  assert.equal(mangaUsesPersistentDirectory(820, 420, true), true);
  assert.equal(mangaUsesPersistentDirectory(820, 0, true), false);
  assert.equal(mangaDirectoryColumnWidth(700), 168);
  assert.equal(mangaDirectoryColumnWidth(820), 258);
});
