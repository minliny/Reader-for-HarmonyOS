import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(resolve(repo, relative), 'utf8');
const rawFile = 'entry/src/main/resources/rawfile/reader-test-book-sources.json';
const document = read(rawFile);
const sources = JSON.parse(document);

const minimumBundledSourceCount = 8;
assert.ok(Array.isArray(sources) && sources.length >= minimumBundledSourceCount,
  `test packages require at least ${minimumBundledSourceCount} bundled sources`);
const sourceIds = new Set();
for (const [index, source] of sources.entries()) {
  const label = `bundled source ${index + 1}`;
  assert.equal(typeof source.bookSourceUrl, 'string', `${label} requires bookSourceUrl`);
  assert.match(source.bookSourceUrl, /^https:\/\//, `${label} identity must use HTTPS`);
  assert.equal(sourceIds.has(source.bookSourceUrl), false, `${label} identity must be unique`);
  sourceIds.add(source.bookSourceUrl);
  assert.match(source.bookSourceName, /测试内置/, `${label} must be recognizable in Source Management`);
  assert.match(source.bookSourceGroup, /Reader 测试内置/, `${label} must use the test-source group`);
  assert.equal(source.enabled, true, `${label} must be usable on a fresh install`);
  assert.equal(Number.isSafeInteger(source.readerTestBuiltinVersion), true,
    `${label} requires an integer update version`);
  assert.ok(source.readerTestBuiltinVersion >= 1, `${label} version must be positive`);
  assert.equal(typeof source.searchUrl, 'string', `${label} requires a search URL`);
  assert.ok(source.searchUrl.length > 0, `${label} search URL must not be blank`);
  assert.equal(typeof source.ruleSearch?.bookList, 'string', `${label} requires L2 book-list rules`);
  assert.equal(typeof source.ruleSearch?.bookUrl, 'string', `${label} requires L3 detail identity`);
  assert.equal(typeof source.ruleSearch?.checkKeyWord, 'string', `${label} requires a live-check keyword`);
  assert.equal(typeof source.ruleBookInfo, 'object', `${label} requires L3 detail rules`);
  assert.equal(typeof source.ruleToc?.chapterList, 'string', `${label} requires L4 chapter-list rules`);
  assert.equal(typeof source.ruleToc?.chapterUrl, 'string', `${label} requires L5 chapter identity`);
  assert.equal(typeof source.ruleContent?.content, 'string', `${label} requires L5 content rules`);
}
assert.doesNotMatch(document, /(?:127\.0\.0\.1|localhost|10\.0\.2\.2|\.invalid|\.example)/i,
  'installable packages must not contain workstation-only or placeholder source endpoints');

const owner = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
assert.match(owner, /TEST_BOOK_SOURCE_RAW_FILE = 'reader-test-book-sources\.json'/,
  'runtime startup must name the packaged source document');
assert.match(owner, /source\.switch\.recover[\s\S]*installBundledTestBookSources\(runtime\)[\s\S]*this\.runtime = runtime/,
  'source seeding must finish after recovery and before the runtime becomes observable');
assert.match(owner, /runtime\.request\('source\.export',[\s\S]*sourceIds: \[sourceId\]/,
  'startup must query only the app-owned source identities');
assert.doesNotMatch(owner, /installBundledTestBookSources[\s\S]{0,1600}runtime\.request\('source\.list'/,
  'bundled-source startup must not scale with the full user source corpus');
assert.match(owner,
  /existing\['enabled'\][\s\S]*importedSource\['enabled'\] = existing\['enabled'\]/,
  'a bundled rule upgrade must preserve the user enabled choice');
assert.match(owner,
  /existing\['enabledExplore'\][\s\S]*importedSource\['enabledExplore'\] = existing\['enabledExplore'\]/,
  'a bundled rule upgrade must preserve the user explore choice');
assert.match(host, /resourceManager\.getRawFileContent\(fileName\)/,
  'Host must read the exact raw resource packaged into every HAP');

console.log(`bundled test book sources: PASS (${sources.length} sources)`);
