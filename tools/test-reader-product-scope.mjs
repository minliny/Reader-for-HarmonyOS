import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

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
  /if \(isReaderProductSurfaceEnabled\('unimplementedSettings'\)\) \{[\s\S]*this\.navRow\('关于与反馈'/,
  'empty Settings destinations must remain outside L0');
assert.match(settings, /this\.navRow\('书架设置'[\s\S]*?this\.onOpenBookshelfSettings\)/, 'implemented shelf settings has a real destination');

const generalBuilder = settings.match(/private buildGeneral\(\) \{([\s\S]*?)\n  \}\n\n  @Builder/);
assert.ok(generalBuilder);
assert.match(generalBuilder[1], /isReaderProductSurfaceEnabled\('unimplementedSettings'\)/,
  'local-only preference, permission, and reset surfaces must be gated');

console.log('reader product scope contract: PASS');

// Execute direct/recovery entry points with the real shipping profile. An empty
// receiver makes any state access or I/O before admission fail deterministically.
const guarded = [...index.matchAll(/private (?:async )?(\w+)\([^{}]*?\): (?:void|Promise<void>) \{\s*if \(!isReaderProductSurfaceEnabled\(/g)]
  .map(match => match[1]);
assert.ok(guarded.length >= 38);
const Closed = productionMotionMethods(new URL('pages/Index.ets', root), guarded, {
  isReaderProductSurfaceEnabled,
});
for (const method of guarded) {
  const receiver = Object.create(null);
  await Closed.prototype[method].call(receiver);
  assert.deepEqual(Object.keys(receiver), [], `${method} cannot mutate a closed surface`);
}
for (const route of ['rss', 'rssSubscriptionManagement', 'rssSubscriptionEditor', 'rssSourceFeed',
  'rssEntryDetail', 'discover', 'sync']) {
  const surface = route.startsWith('rss') ? 'rss' : route;
  assert.ok(index.includes(`isReaderProductSurfaceEnabled('${surface}') && this.route === '${route}'`),
    `${route} must reject restored/direct route rendering`);
}
// Development flow remains callable when its explicit scope is admitted.
const Open = productionMotionMethods(new URL('pages/Index.ets', root), ['onSyncTriggerBackup'], {
  isReaderProductSurfaceEnabled: surface => surface === 'sync',
});
let backups = 0;
Open.prototype.onSyncTriggerBackup.call({ getSyncOrchestrator: () => ({ triggerBackup: () => backups++ }) });
assert.equal(backups, 1);
console.log(`reader product scope direct/recovery boundary: ${guarded.length} methods PASS`);
