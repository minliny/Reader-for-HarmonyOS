import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

function sourceRange(value, startMarker, endMarker) {
  const start = value.indexOf(startMarker);
  const end = value.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return value.slice(start, end);
}

test('Figma Bookshelf Phone geometry keeps the measured Continue card and has no persistent elevation', async () => {
  const bookshelf = await source('entry/src/main/ets/ui/components/BookshelfComponents.ets');
  const continueCard = sourceRange(bookshelf, 'export struct ContinueReadingCard', 'export struct ShelfSectionHeader');
  const cover = sourceRange(bookshelf, 'export struct BookCover', 'export struct BookCard');
  assert.ok(continueCard.includes('.height(100)'));
  assert.ok(continueCard.includes('.width(62)'));
  assert.ok(continueCard.includes('.height(93)'));
  assert.equal(continueCard.includes('.shadow('), false);
  assert.equal(cover.includes('.shadow('), false);
  assert.ok(bookshelf.includes("@StorageProp('reader.coverColumns') coverColumns: number = 3"));
  assert.ok(bookshelf.includes('ReaderUiStore.dispatchContinueReading'));
});

test('Figma Book Detail dimensions and ActionBar are constrained without changing Continue owner', async () => {
  const detail = await source('entry/src/main/ets/ui/components/BookDetailComponents.ets');
  const library = await source('entry/src/main/ets/ui/shells/LibraryShell.ets');
  assert.ok(detail.includes('.height(152)'));
  assert.ok(detail.includes("? 98 : 120"));
  assert.ok(detail.includes('.height(282)'));
  assert.equal(detail.includes('.shadow('), false);
  assert.ok(library.includes('private bookDetailActionBarHeight(): number'));
  assert.ok(library.includes('return 52 + this.safeAreaBottom;'));
  assert.ok(library.includes('.height(46)'));
  assert.ok(library.includes('ReaderUiStore.dispatchContinueReading'));
});

test('Figma responsive policy exposes only Phone and Tablet, with a measured Tablet rail', async () => {
  const viewport = await source('entry/src/main/ets/ui/adapters/ViewportAdapter.ets');
  const shell = await source('entry/src/main/ets/ui/shells/MainTabShell.ets');
  assert.ok(viewport.includes("export type ViewportClass = 'phone' | 'tablet'"));
  assert.equal(viewport.includes('compact-landscape'), false);
  assert.ok(shell.includes('TABLET_NAV_WIDTH: number = 82'));
  assert.ok(shell.includes('TABLET_NAV_FOOTPRINT: number = 100'));
  assert.ok(shell.includes('if (!this.usesTabletShell())'));
  assert.ok(shell.includes("bottom: this.usesTabletShell()"));
  assert.equal(shell.includes('.position('), false);
});
