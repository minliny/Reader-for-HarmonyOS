import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const gateway = read('entry/src/main/ets/features/search/SearchGateway.ts');
const page = read('entry/src/main/ets/features/search/SearchPage.ets');
const orchestrator = read('entry/src/main/ets/features/search/SearchOrchestrator.ets');

// Immutable per-source identity on every search result.
for (const field of ['bookSourceUrl', 'searchRequestId', 'sourceRuleVersion']) {
  assert.match(gateway, new RegExp(`^\\s*${field}: string;|^\\s*${field}: number;`, 'm'),
    `SearchBook must carry the immutable ${field}`);
}
assert.match(gateway, /searchRequestId: identity\.searchRequestId/,
  'decodeBookSearchResult must stamp the sweep identity on every result');
assert.match(gateway, /sourceRuleVersion: identity\.sourceRuleVersion/,
  'decodeBookSearchResult must stamp the rule version on every result');

// The sweep id is generated per submit and travels into book.search.
assert.match(orchestrator, /this\.gateway\.generateSearchRequestId\(keyword\)/,
  'each sweep generates one searchRequestId');
assert.match(orchestrator, /const admitsResult = \(book: SearchBook\): boolean => book\.searchRequestId === searchRequestId;/,
  'collected buckets must reject results from a superseded sweep');
assert.match(orchestrator, /if \(admitsResult\(book\)\)/,
  'flattenCollected must filter by the live sweep id');

// Publication state: searching N/M, returned count, failed count.
assert.match(orchestrator, /failedSourceCount: failures\.length/,
  'every results publication carries the failed-source count');
assert.match(page, /正在搜索 \$\{this\.presentation\.completedSourceCount\}\/\$\{this\.presentation\.totalSourceCount\} 个书源,已返回 \$\{this\.visibleGroups\.length\} 个/,
  'the results header must state sweeping N/M and the returned count');
assert.match(page, /失败 \$\{this\.presentation\.failedSourceCount\} 个书源/,
  'the results header must state the failed-source count');

// Visual aggregation must never merge per-source data.
assert.match(page, /admit\(book: SearchBook, inBookshelf: boolean\): void \{\s*this\.variants\.push\(book\);/,
  'each same-book variant keeps its own full SearchBook row');
assert.match(page, /Text\(this\.group\.book\.sourceName\.length > 0 \? this\.group\.book\.sourceName : this\.group\.book\.sourceId\)/,
  'every result card displays its source name');
assert.match(page, /\.onClick\(\(\): void => this\.onSelectResult\(this\.group\.book, this\.group\.variants\)\)/,
  'the clicked variant identity flows to detail admission');

console.log('search publication identity contract: PASS');
