import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const index = read('entry/src/main/ets/pages/Index.ets');
const search = read('entry/src/main/ets/features/search/SearchPage.ets');
const shelf = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const remote = read('entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');

for (const declaration of [
  /const READING_CACHE_BEFORE = 2;/,
  /const READING_CACHE_AFTER = 2;/,
  /const CATALOG_REFRESH_NEAR_END = 3;/,
  /const CATALOG_REFRESH_INTERVAL_MS = 10 \* 60 \* 1000;/,
]) {
  assert.match(index, declaration);
}

assert.match(index, /private openShelfBook\([\s\S]*openRemoteBookDetail\([\s\S]*selection, true\);/,
  'a shelf tap must resume instead of stopping at detail');
assert.match(index, /gateway\.openCachedCatalogSession\(seed, isCurrent\)[\s\S]*\.catch\(\(\): Promise<RemoteReadingSession> => gateway\.openSession/,
  'a shelf cold start must admit the durable TOC before online recovery');
assert.match(index, /private addDetailBook\([\s\S]*\.upsertBook\([\s\S]*void this\.prefetchReadingWindow\(session\)/,
  'an explicit shelf join must immediately start the rolling cache window');
assert.match(index, /private applyReadingCommit\([\s\S]*this\.prefetchReadingWindow\(session, commit\.chapterIndex\)/,
  'each durable reading commit must maintain the rolling cache window');
assert.match(index, /session\.entries\.length - commit\.chapterIndex - 1 <= CATALOG_REFRESH_NEAR_END/,
  'reading near the current end must trigger a throttled TOC refresh');
assert.match(index, /for \(let start = 0; start < books\.length; start \+= 2\)[\s\S]*Promise\.all\(batch\.map/,
  'bookshelf updates must use a bounded two-book batch');
assert.match(index, /private onReadingFailure\([\s\S]*this\.startSourceDiscovery\(generation, true\)/,
  'remote read failure must enter the ranked automatic source-recovery seam');
assert.match(index, /if \(autoPickFirst\) \{\s*this\.onPickSource\(outcome\.candidates\[0\]\);/,
  'automatic recovery may attempt the first ranked candidate through the normal transaction');

assert.match(remote, /async openCachedCatalogSession\([\s\S]*acquisitionMode: 'online'/,
  'a cached catalog must retain online body fallback semantics');
assert.match(search, /this\.normalizedBookKey\(book\.title, book\.author\)/,
  'search results must group the same title and author across origins');
assert.match(search, /right\.sourceCount - left\.sourceCount/,
  'multi-origin search results must be promoted like Legado');
assert.match(search, /Text\('已在书架'\)/,
  'grouped search results must expose current shelf membership');
assert.match(shelf, /Text\(`更新 \$\{book\.unreadCount\} 章`\)/);
assert.match(shelf, /Text\(`已读 \$\{Math\.floor\(\(book\.readProgress \?\? 0\) \/ 100\)\}%`\)/);

console.log('Legado product behavior contract: PASS');
