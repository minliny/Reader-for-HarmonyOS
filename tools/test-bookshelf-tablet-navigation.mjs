import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  /\.onClick\(\(\): void => \{[\s\S]*?if \(!active\) \{[\s\S]*?this\.onMainTab\(navKey\);[\s\S]*?\}\s*\}\)/,
  'inactive tablet rail items must dispatch the same onMainTab intent as the Phone navigation',
);
assert.equal(
  (bookshelf.match(/this\.onMainTab\(navKey\)/g) ?? []).length,
  1,
  'tablet navigation must have one shared route dispatch rather than per-item duplicate handlers',
);

console.log('bookshelf tablet navigation contract: PASS');
