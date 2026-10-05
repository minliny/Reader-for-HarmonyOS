import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const bookshelf = readFileSync(
  new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets', import.meta.url),
  'utf8',
);

const expectedItems = [
  ['bookshelf_library', '书架', 'bookshelf', 'true'],
  ['bookshelf_compass', '发现', 'discover', 'false'],
  ['bookshelf_rss', 'RSS', 'rss', 'false'],
  ['bookshelf_settings', '设置', 'settings', 'false'],
];

for (const [asset, label, navKey, active] of expectedItems) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(
    bookshelf,
    new RegExp(
      `this\\.tabletNavigationItem\\('${asset}', '${escapedLabel}', '${navKey}', ${active}\\)`,
    ),
    `tablet rail item ${label} must carry its production navigation key`,
  );
}

assert.match(
  bookshelf,
  /private tabletNavigationItem\(assetName: string, label: string, navKey: string, active: boolean\)/,
  'the tablet navigation builder must receive the route key instead of rendering a label-only row',
);
assert.match(
  bookshelf,
  /\.onClick\(this\.mainTabHandler\(navKey, active\)\)/,
  'inactive tablet rail items must dispatch the same onMainTab intent as the Phone navigation',
);
assert.equal(
  (bookshelf.match(/this\.onMainTab\(key\)/g) ?? []).length,
  1,
  'tablet navigation must have one shared route dispatch rather than per-item duplicate handlers',
);

const Page = productionMotionMethods(new URL('../entry/src/main/ets/features/bookshelf/BookshelfPage.ets', import.meta.url),
  ['mainTabHandler', 'isShelfPresentationCurrent', 'onMainTab']);
const calls = [];
const page = Object.assign(new Page(), { mounted: true, navigationGeneration: 1,
  onDiscoverRequested: navigation => calls.push(['discover', navigation]),
  onRssRequested: navigation => calls.push(['rss', navigation]),
  onSettingsRequested: navigation => calls.push(['settings', navigation]) });
const active = page.mainTabHandler('bookshelf', true);
const oldDiscover = page.mainTabHandler('discover', false);
active(); oldDiscover();
assert.deepEqual(calls, [['discover', 1]], 'only the inactive rail item dispatches its captured intent');
page.navigationGeneration = 2;
oldDiscover();
assert.deepEqual(calls, [['discover', 1]], 'a retained physical handler cannot borrow the new navigation');
page.mainTabHandler('rss', false)();
assert.deepEqual(calls, [['discover', 1], ['rss', 2]], 'the current rail still dispatches after navigation Prop delivery');
page.mounted = false;
page.mainTabHandler('settings', false)();
assert.deepEqual(calls, [['discover', 1], ['rss', 2]], 'a retired rail cannot dispatch');

console.log('bookshelf tablet navigation contract: PASS');
