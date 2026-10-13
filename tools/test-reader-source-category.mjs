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
  readerSourceCategoryIsReadable,
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
for (const url of ['https://pre-api.tuishujun.com/', 'https://pre-api.tuishujun.com#md冷魅',
  'https://www.tuishujun.com/', 'https://search.douban.com/', 'https://book.douban.com',
  'https://www.lkong.com', 'https://api.coolapk.com', 'https://www.yuque.com/yuqueyonghun8txcr/psb8yc#目录']) {
  assert.equal(classifyReaderSource({ bookSourceType: 0, name: '用户重新命名', sourceId: 'opaque-source-id', baseUrl: url }), 'other',
    'renaming reviewed book-information providers must not admit their reviews as novel bodies');
}
for (const url of ['https://tuishujun.com.example.test', 'https://not-tuishujun.com', 'https://notlkong.com',
  'https://search.douban.com.example.test', 'https://read.douban.com',
  'https://www.yuque.com/someone/novel', 'https://www.yuque.com/yuqueyonghun8txcr/psb8yc-novel']) {
  assert.equal(classifyReaderSource({ bookSourceType: 0, name: '普通小说', baseUrl: url }), 'novel',
    'provider matching must respect host and reviewed notebook boundaries');
}
assert.equal(classifyReaderSource({ bookSourceType: 0, name: '普通小说', group: '书评爱好者推荐，来自论坛' }), 'novel',
  'user group and source provenance are not a review-content declaration');
for (const name of ['小说推书', '我的书单小说', '小说正文【含书评】', '我的推书/书单小说']) {
  assert.equal(classifyReaderSource({ bookSourceType: 0, name, group: '小说推荐/论坛来源', baseUrl: 'https://novel.example.test' }), 'novel',
    'a user collection name or supplementary reviews do not redefine a novel provider');
}
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

assert.equal(readerSourceCategoryIsReadable('comic'), true);
assert.equal(readerSourceCategoryIsReadable('novel'), true);
assert.equal(readerSourceCategoryIsReadable('music'), false);
assert.match(searchGateway, /if \(!readerSourceCategoryIsReadable\(sourceCategory\)\)/);
assert.match(searchOrchestrator, /readerSourceCategoryIsReadable\(source\.category\)/);
assert.match(searchPage, /本地/);
assert.match(searchOrchestrator, /readerSourceCategoryIsReadable\(source\.category\)/);
assert.match(discoverOrchestrator, /readerSourceCategoryIsText\(source\.category\)/);
assert.match(switchGateway, /contentKind === 'manga' \? category !== 'comic' : !readerSourceCategoryIsText\(category\)/);
assert.match(switchGateway, /source.category === 'comic'\) !== \(query.contentKind === 'manga'/);
assert.match(managementPage, /readerSourceCategoryLabel\(source\.category\)/,
  '管理页必须展示每个书源的类别');
assert.match(managementPage, /matchesQuery && matchesGroup && matchesCategory && this.matchesStatus/);
const index = read('entry/src/main/ets/pages/Index.ets');
const entry = read('entry/src/main/ets/features/reading/ReadingEntryHost.ts');
assert.match(index, /host\.openRemote\(/);
assert.match(entry, /this\.runtime\.bookAcquisitions\(\)[\s\S]*coordinator\.acquireBookWithBackgroundRefresh\(seed, \{ isCurrent: current \}\)/);
const coordinator = read('entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
assert.match(coordinator, /if \(!isRemoteReadingCacheRecoveryEligible\(classified\)\) throw classified/,
  'only recoverable cache states may pass into live source admission; stopped sources remain offline-readable');
assert.match(coordinator, /if \(version === undefined\) \{[\s\S]*throw new RemoteReadingGatewayError\('cachedSessionUnavailable'[\s\S]*gateway\.openSession\(actual, \{ isCurrent, allowMangaCatalog: seed\.contentKind === 'manga' \}\)/,
  'a live source is still required; only explicit manga catalog admission may bypass the text catalog boundary');

const collection = JSON.parse(read('entry/src/main/resources/rawfile/reader-tested-book-source-collection.json'));
const rows = Array.isArray(collection) ? collection : collection.sources;
const informationSourceIds = new Set(['corpus-0a6f4d44c21e', 'corpus-b4ac220076f9', 'corpus-e48578e73828',
  'corpus-b2e0cc78abe1', 'corpus-2bc4d79e35ee', 'corpus-657f2375eb28', 'corpus-bdeaa8132c97',
  'corpus-510d385bfa39', 'corpus-ed739b845f1e', 'corpus-424dac3e7197', 'corpus-97f48b779f35', 'corpus-c9e9adfbdfab']);
let informationSources = 0;
const counts = {};
for (const source of rows) {
  const category = classifyReaderSource({ bookSourceType: source.bookSourceType,
    name: source.bookSourceName, group: source.bookSourceGroup, sourceId: source.bookSourceUrl });
  counts[category] = (counts[category] ?? 0) + 1;
  if (source.bookSourceName === '百度图片（优）') assert.equal(category, 'other');
  if (/漫画屋|爱奇艺漫画/.test(source.bookSourceName ?? '')) assert.notEqual(category, 'novel');
  if (informationSourceIds.has(source.sourceId)) {
    informationSources += 1;
    assert.equal(category, 'other', `${source.bookSourceName} contains information/reviews, not novel chapters`);
    assert.equal(readerSourceCategoryIsReadable(category), false);
    // The original provider/rules survive; only runtime admission changes.
    assert.ok(source.bookSourceUrl);
    if ((source.bookSourceUrl ?? '').includes('pre-api.tuishujun.com') && source.ruleContent?.content) {
      assert.match(source.ruleContent.content, /parseComments/);
      assert.match(source.ruleToc.chapterList, /第00/);
    }
    if ((source.bookSourceUrl ?? '').includes('search.douban.com')) {
      assert.match(source.ruleBookInfo.tocUrl, /reviews/);
      assert.match(source.ruleContent.content, /review-content/);
    }
  }
  if (['百合论坛', '百合会论坛', '酷18论坛', '轻说百科（优++）', '🎃轻小说百科🎃'].includes(source.bookSourceName)) {
    assert.equal(category, 'novel', 'actual fiction providers must survive forum/encyclopedia labels');
  }
}
assert.equal(informationSources, informationSourceIds.size, 'all reviewed bundled information definitions remain present and excluded');
assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), rows.length);
console.log('bundled category coverage:', counts);

console.log('reader source category isolation: PASS');
