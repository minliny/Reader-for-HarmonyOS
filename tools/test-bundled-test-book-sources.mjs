import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(resolve(repo, relative), 'utf8');
const rawFile = 'entry/src/main/resources/rawfile/reader-test-book-sources.json';
const document = read(rawFile);
const sources = JSON.parse(document);

const minimumBundledSourceCount = 6;
assert.ok(Array.isArray(sources) && sources.length >= minimumBundledSourceCount,
  `test packages require at least ${minimumBundledSourceCount} bundled sources`);
const sourceIds = new Set();
const builtinIds = new Set();
for (const [index, source] of sources.entries()) {
  const label = `bundled source ${index + 1}`;
  assert.equal(typeof source.bookSourceUrl, 'string', `${label} requires bookSourceUrl`);
  assert.match(source.bookSourceUrl, /^https:\/\//, `${label} identity must use HTTPS`);
  assert.equal(sourceIds.has(source.bookSourceUrl), false, `${label} identity must be unique`);
  sourceIds.add(source.bookSourceUrl);
  assert.match(source.bookSourceName, /测试内置/, `${label} must be recognizable in Source Management`);
  assert.match(source.bookSourceGroup, /Reader 测试内置/, `${label} must use the test-source group`);
  assert.equal(typeof source.enabled, 'boolean', `${label} must carry a boolean seed state`);
  assert.equal(typeof source.defaultEnabled, 'boolean', `${label} must carry defaultEnabled`);
  assert.equal(source.enabled, source.defaultEnabled,
    `${label} seed state must equal the healthy-subset default`);
  assert.equal(Number.isSafeInteger(source.readerTestBuiltinVersion), true,
    `${label} requires an integer update version`);
  assert.ok(source.readerTestBuiltinVersion >= 3, `${label} version must be at least 3`);
  assert.equal(source.builtinVersion, source.readerTestBuiltinVersion,
    `${label} builtinVersion must stay in sync`);
  assert.match(source.builtinId, /^reader-builtin-[a-z0-9-]+$/, `${label} requires a builtinId slug`);
  assert.equal(builtinIds.has(source.builtinId), false, `${label} builtinId must be unique`);
  builtinIds.add(source.builtinId);
  assert.match(source.ruleFingerprint, /^[0-9a-f]{64}$/, `${label} requires a rule fingerprint`);
  assert.equal(typeof source.verifiedAt, 'string', `${label} requires a verification timestamp`);
  assert.equal(typeof source.verificationSuiteVersion, 'string', `${label} requires a suite version`);
  assert.ok(Array.isArray(source.capabilities) && source.capabilities.length >= 3,
    `${label} requires verified capabilities`);
  assert.equal(typeof source.provenance?.origin, 'string', `${label} requires rule provenance`);
  if (source.defaultEnabled) {
    for (const capability of ['search', 'detail', 'toc', 'content']) {
      assert.ok(source.capabilities.includes(capability),
        `${label} is default-enabled so it must carry the ${capability} capability`);
    }
  } else {
    assert.ok(source.capabilities.length >= 3,
      `${label} is default-disabled but must still carry verified capabilities`);
  }
  assert.equal(typeof source.searchUrl, 'string', `${label} requires a search URL`);
  assert.ok(source.searchUrl.length > 0, `${label} search URL must not be blank`);
  const searchUrlPath = source.searchUrl.split(/[,{]/)[0];
  assert.doesNotMatch(searchUrlPath, /\{\{key\}\}|\{\{keyword\}\}/,
    `${label} searchUrl must keep {{key}} out of the path component: Core expands the ` +
    `keyword template only in the query/body (path braces are percent-encoded during ` +
    `URL normalization), so a path template silently searches the default ranking`);
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
assert.doesNotMatch(document, /fiction\.fengduxiaoshuo\.com|novel\.cooks\.tw/,
  'withdrawn sources (fixed-token Fengdu, third-party Fanqie mirror) must stay out of the bundle');
assert.doesNotMatch(document, /这是 🔒 付费章节/,
  'paywall placeholder text must never be synthesized by bundled content rules');
assert.doesNotMatch(document, /http:\/\//i,
  'bundled rules must use HTTPS-only request URLs');

const owner = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const supply = read('entry/src/main/ets/app/BundledBookSourceSupply.ts');
assert.match(owner, /TEST_BOOK_SOURCE_RAW_FILE = 'reader-test-book-sources\.json'/,
  'runtime startup must name the packaged source document');
assert.match(owner, /const BUNDLED_RAW_FILE_SHA256 = '[0-9a-f]{64}';/,
  'runtime startup must pin the bundled document digest');
assert.match(owner, /fileDigest !== BUNDLED_RAW_FILE_SHA256/,
  'startup must verify the bundled document integrity before importing any source');
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
assert.match(owner, /rule fingerprint mismatch/,
  'a per-source fingerprint mismatch must be rejected with a logged record, never silently skipped');
assert.match(owner, /readerTestBuiltinWithdrawn/,
  'withdrawn bundled identities must be marked retired instead of deleted');
assert.match(supply, /RULE_PAYLOAD_FIELDS: string\[\] = \[/,
  'the ArkTS fingerprint canonicalization must be declared');
assert.match(supply, /decideBundledUpgrade/,
  'upgrade decisions must go through the shared user-copy guard');
assert.match(host, /resourceManager\.getRawFileContent\(fileName\)/,
  'Host must read the exact raw resource packaged into every HAP');

console.log(`bundled test book sources: PASS (${sources.length} sources)`);
