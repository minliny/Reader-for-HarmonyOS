import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Source-shape guard only. It verifies that the real bookshelf search route
// has one Figma-owned native visual host and that it consumes the pre-existing
// Core search projection. It is not evidence of a current Figma revision,
// motion, Host IO, or a device run.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(resolve(root, relativePath), 'utf8');
}

function range(value, startMarker, endMarker) {
  const start = value.indexOf(startMarker);
  const end = value.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0, `missing start marker: ${startMarker}`);
  assert.ok(end > start, `missing end marker: ${endMarker}`);
  return value.slice(start, end);
}

test('book search declares the ten directly read Figma canonical Phone and Tablet nodes', async () => {
  const page = await source('entry/src/main/ets/ui/components/FigmaBookSearchPage.ets');
  for (const node of [
    '2635:58749', '2635:58809', '2635:58985', '2635:59076', '2635:59138',
    '2635:59195', '2635:59259', '2635:59440', '2635:59534', '2635:59599',
  ]) {
    assert.ok(page.includes(node), `missing direct Figma node marker: ${node}`);
  }
  assert.ok(page.includes('ViewportAdapter.isWide(this.viewportWidth, this.viewportHeight)'));
  assert.equal(page.includes('5 条更多'), false,
    'retired History Expanded visual must not return to the real search route');
});

test('book search projects existing Core state and permits only confirmed entry actions', async () => {
  const page = await source('entry/src/main/ets/ui/components/FigmaBookSearchPage.ets');
  for (const marker of [
    "@StorageProp('reader.searchQuery')",
    "@StorageProp('reader.searchResults')",
    "@StorageProp('reader.searchHistory')",
    "@StorageProp('reader.loading')",
    "@StorageProp('reader.pageState')",
    "@StorageProp('reader.error')",
    "type: 'search-submit'",
    "type: 'route-pop'",
    "type: 'route-push', id: 'book-detail'",
    "type: 'book-detail-load'",
  ]) {
    assert.ok(page.includes(marker), `book search must retain Core binding: ${marker}`);
  }

  const eventTypes = Array.from(page.matchAll(/type:\s*'([^']+)'/g), (match) => match[1]).sort();
  assert.deepEqual([...new Set(eventTypes)], [
    'book-detail-load', 'route-pop', 'route-push', 'search-submit',
  ]);
});

test('real book-search route bypasses the generic legacy visual tree', async () => {
  const shell = await source('entry/src/main/ets/ui/shells/LibraryShell.ets');
  assert.ok(shell.includes("import { FigmaBookSearchPage } from '../components/FigmaBookSearchPage';"));
  const nativeBranch = range(
    shell,
    "if (this.routeId === 'book-search') {",
    '} else {',
  );
  assert.ok(nativeBranch.includes('FigmaBookSearchPage({'));
  assert.equal(nativeBranch.includes('ViewStateRenderer()'), false);
  assert.equal(nativeBranch.includes('BackTopBar()'), false);
});

test('result visual fields remain on the existing Core SearchResultEntry owner', async () => {
  const state = await source('entry/src/main/ets/ui/store/ReaderUiState.ets');
  const effects = await source('entry/src/main/ets/ui/store/ReaderEffects.ets');
  const resultEntry = range(state, 'export interface SearchResultEntry', 'export interface BookDetail');
  const mapper = range(effects, 'static mapSearchResults', '// Map `search.content`');
  assert.ok(resultEntry.includes('coverUrl?: string;'));
  assert.ok(resultEntry.includes('intro?: string;'));
  assert.ok(mapper.includes("coverUrl: ReaderEffects.getString(book, 'coverUrl')"));
  assert.ok(mapper.includes("intro: ReaderEffects.getString(book, 'intro')"));
  assert.ok(effects.includes('private static async runSearchFromPersistedSources'));
  assert.ok(effects.includes('ReaderEffects.isCurrentTitleSearch(sequence, keyword)'));
});
