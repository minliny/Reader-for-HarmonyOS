import assert from 'node:assert/strict';
import { test } from 'node:test';
import { localImportPanelHeight } from '../../entry/src/main/ets/features/bookshelf/ui/LocalImportLayout.ts';

test('a short import result displays its entire measured document with the shell border', () => {
  assert.equal(localImportPanelHeight(540, 256), 258);
  assert.equal(localImportPanelHeight(540, 319), 321);
});

test('a long import result fills the safe lane and leaves the measured document scrollable', () => {
  assert.equal(localImportPanelHeight(286, 657), 286);
  assert.equal(localImportPanelHeight(116, 657), 116);
});

test('a result without a native size does not draw a guessed shell', () => {
  assert.equal(localImportPanelHeight(540, 0), 0);
  assert.equal(localImportPanelHeight(540, Number.NaN), 0);
});
