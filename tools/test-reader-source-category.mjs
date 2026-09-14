import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');
const categorySource = stripTypeScriptTypes(
  read('entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
);
const categoryUrl = `data:text/javascript;base64,${Buffer.from(categorySource).toString('base64')}`;
const {
  classifyReaderSource,
  readerSourceCategoryIsText,
  readerSourceCategoryLabel,
} = await import(categoryUrl);

assert.equal(classifyReaderSource({ bookSourceType: 0, name: '有声书' }), 'music');
assert.equal(classifyReaderSource({ bookSourceType: 0, name: '爱奇艺漫画' }), 'comic');
assert.equal(classifyReaderSource({ bookSourceType: 'TEXT', name: '漫画屋' }), 'comic');
assert.equal(classifyReaderSource({ bookSourceType: 0, group: '小说/漫画' }), 'other');
assert.equal(classifyReaderSource({ name: '漫画音乐' }), 'other');
assert.equal(classifyReaderSource({ bookSourceType: 0.5 }), 'other');
assert.equal(classifyReaderSource({ sourceId: 'https://profile.example.test/' }), 'novel');
assert.equal(classifyReaderSource({ bookSourceType: 1 }), 'music');
assert.equal(classifyReaderSource({ bookSourceType: '2' }), 'comic');
assert.equal(classifyReaderSource({ bookSourceType: 3 }), 'download');
assert.equal(classifyReaderSource({ bookSourceType: 4 }), 'external');
assert.equal(classifyReaderSource({ bookSourceType: 99, name: '小说' }), 'other');
assert.equal(classifyReaderSource({ group: '漫画' }), 'comic');
assert.equal(classifyReaderSource({ name: '有声听书' }), 'music');
assert.equal(classifyReaderSource({ sourceId: 'https://download.example.test/source' }), 'download');
assert.equal(classifyReaderSource({ name: '普通文本书源' }), 'novel');

for (const name of ['百度图片（优）', '壁纸图库', '每日图集']) {
  assert.equal(classifyReaderSource({ bookSourceType: 0, name }), 'other', 'explicit picture metadata is not a novel');
}
assert.equal(classifyReaderSource({ bookSourceType: 0, name: '普通小说', baseUrl: 'https://images.example.test' }), 'novel', 'image URL alone is not an image source');
assert.equal(readerSourceCategoryIsText('novel'), true);
for (const category of ['comic', 'music', 'download', 'external', 'other']) {
  assert.equal(readerSourceCategoryIsText(category), false);
  assert.notEqual(readerSourceCategoryLabel(category), '小说');
}

const searchGateway = read('entry/src/main/ets/features/search/SearchGateway.ts');
const searchOrchestrator = read('entry/src/main/ets/features/search/SearchOrchestrator.ets');
const searchPage = read('entry/src/main/ets/features/search/SearchPage.ets');
const discoverOrchestrator = read('entry/src/main/ets/features/discover/DiscoverOrchestrator.ets');
const switchGateway = read('entry/src/main/ets/features/source/SourceSwitchGateway.ts');
const managementPage = read('entry/src/main/ets/features/source/SourceManagementPage.ets');

assert.match(searchGateway, /if \(!readerSourceCategoryIsText\(sourceCategory\)\)/);
assert.match(searchOrchestrator, /readerSourceCategoryIsText\(source\.category\)/);
assert.match(searchPage, /本地/);
assert.match(searchOrchestrator, /readerSourceCategoryIsText\(source\.category\)/);
assert.match(discoverOrchestrator, /readerSourceCategoryIsText\(source\.category\)/);
assert.ok((switchGateway.match(/if \(!readerSourceCategoryIsText\(category\)\) continue;/g) ?? []).length >= 2,
  '实时换源与缓存换源都必须排除非小说类型');
assert.match(managementPage, /readerSourceCategoryLabel\(source\.category\)/,
  '管理页必须展示每个书源的类别');
assert.match(managementPage, /matchesQuery && matchesGroup && matchesCategory && this.matchesStatus/);
const index = read('entry/src/main/ets/pages/Index.ets');
assert.match(index, /owner\.bookAcquisitions\(\)[\s\S]*\.acquireBookWithBackgroundRefresh\(seed, \{ isCurrent \}\)/);
const coordinator = read('entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
assert.match(coordinator, /if \(!isRemoteReadingCacheRecoveryEligible\(classified\)\) throw classified/,
  'only recoverable cache states may pass into live source admission; stopped sources remain offline-readable');
assert.match(coordinator, /if \(version === undefined\)[\s\S]*gateway\.openSession\(actual, \{ isCurrent \}\)/);

const collection = JSON.parse(read('entry/src/main/resources/rawfile/reader-tested-book-source-collection.json'));
const rows = Array.isArray(collection) ? collection : collection.sources;
const counts = {};
for (const source of rows) {
  const category = classifyReaderSource({ bookSourceType: source.bookSourceType,
    name: source.bookSourceName, group: source.bookSourceGroup, sourceId: source.bookSourceUrl });
  counts[category] = (counts[category] ?? 0) + 1;
  if (source.bookSourceName === '百度图片（优）') assert.equal(category, 'other');
  if (/漫画屋|爱奇艺漫画/.test(source.bookSourceName ?? '')) assert.notEqual(category, 'novel');
}
assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), rows.length);
console.log('bundled category coverage:', counts);

console.log('reader source category isolation: PASS');
