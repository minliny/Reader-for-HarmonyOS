import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  READER_PRODUCT_PROFILE,
  isReaderMainTabEnabled,
  isReaderProductSurfaceEnabled,
} from '../entry/src/main/ets/app/ReaderProductScope.ts';

assert.equal(READER_PRODUCT_PROFILE, 'l0');
assert.equal(isReaderMainTabEnabled('bookshelf'), true);
assert.equal(isReaderMainTabEnabled('settings'), true);
assert.equal(isReaderMainTabEnabled('discover'), false);
assert.equal(isReaderMainTabEnabled('rss'), false);
assert.equal(isReaderMainTabEnabled('unknown'), false);

for (const surface of ['discover', 'rss', 'sync', 'unimplementedSettings']) {
  assert.equal(isReaderProductSurfaceEnabled(surface), false,
    `${surface} must remain outside the default L0 product surface`);
}

const root = new URL('../entry/src/main/ets/', import.meta.url);
const mainTabs = await readFile(new URL('features/shell/MainTabBar.ets', root), 'utf8');
const bookshelf = await readFile(new URL('features/bookshelf/BookshelfPage.ets', root), 'utf8');
const settings = await readFile(new URL('features/settings/SettingsPage.ets', root), 'utf8');
const index = await readFile(new URL('pages/Index.ets', root), 'utf8');

assert.match(mainTabs, /ALL_MAIN_TABS\.filter\([\s\S]*isReaderMainTabEnabled\(tab\.key\)/,
  'shared Phone/Tablet navigation must derive from the admitted product scope');
assert.match(bookshelf,
  /if \(isReaderProductSurfaceEnabled\('discover'\)\)[\s\S]*tabletNavigationItem\('bookshelf_compass'/,
  'the private bookshelf Tablet rail must gate Discover');
assert.match(bookshelf,
  /if \(isReaderProductSurfaceEnabled\('rss'\)\)[\s\S]*tabletNavigationItem\('bookshelf_rss'/,
  'the private bookshelf Tablet rail must gate RSS');

for (const [method, surface] of [['openRss', 'rss'], ['openDiscover', 'discover'], ['openSync', 'sync']]) {
  const guard = new RegExp(`private ${method}\\(\\): void \\{\\s*if \\(\\!isReaderProductSurfaceEnabled\\('${surface}'\\)\\) \\{\\s*return;`);
  assert.match(index, guard, `${method} must reject an unadmitted route before mutating navigation state`);
}

assert.match(settings,
  /if \(isReaderProductSurfaceEnabled\('sync'\)\) \{[\s\S]*this\.navRow\('同步与备份'/,
  'Settings must not expose Sync outside its admitted product profile');
assert.match(settings,
  /if \(isReaderProductSurfaceEnabled\('unimplementedSettings'\)\) \{[\s\S]*this\.navRow\('书架与搜索设置'[\s\S]*this\.navRow\('关于与反馈'/,
  'empty Settings destinations must remain outside L0');

const generalBuilder = settings.match(/private buildGeneral\(\) \{([\s\S]*?)\n  \}\n\n  @Builder/);
assert.ok(generalBuilder);
assert.match(generalBuilder[1], /isReaderProductSurfaceEnabled\('unimplementedSettings'\)/,
  'local-only preference, permission, and reset surfaces must be gated');

console.log('reader product scope contract: PASS');
