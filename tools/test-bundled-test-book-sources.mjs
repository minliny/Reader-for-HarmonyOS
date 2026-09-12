import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(resolve(repo, relative), 'utf8');
const rawFile = 'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json';
const document = read(rawFile);
const sources = JSON.parse(document);

const expectedCollectionRecords = 1046;
const expectedFullCorpusRecords = 1040;
const expectedLaterAdmissionRecords = 6;
const expectedUniqueSourceIds = 919;
assert.ok(Array.isArray(sources), 'the app import collection must be a top-level JSON array');
assert.equal(sources.length, expectedCollectionRecords,
  `the collection must retain all ${expectedCollectionRecords} recorded test entries`);

const sourceIds = new Set();
const builtinIds = new Set();
let fullCorpusRecords = 0;
let laterAdmissionRecords = 0;
let defaultEnabledRecords = 0;
for (const [index, source] of sources.entries()) {
  const label = `bundled source ${index + 1}`;
  assert.equal(typeof source.bookSourceUrl, 'string', `${label} requires bookSourceUrl`);
  assert.match(source.bookSourceUrl, /^https:\/\//, `${label} identity must use HTTPS`);
  sourceIds.add(source.bookSourceUrl);
  assert.equal(typeof source.bookSourceName, 'string', `${label} requires bookSourceName`);
  assert.ok(source.bookSourceName.trim().length > 0, `${label} name must not be blank`);
  assert.equal(typeof source.enabled, 'boolean', `${label} must carry a boolean seed state`);
  assert.equal(typeof source.defaultEnabled, 'boolean', `${label} must carry defaultEnabled`);
  assert.equal(source.enabled, source.defaultEnabled,
    `${label} seed state must equal the evidence-backed default`);
  if (source.defaultEnabled) {
    defaultEnabledRecords += 1;
  }
  assert.equal(Number.isSafeInteger(source.builtinVersion), true,
    `${label} requires an integer update version`);
  assert.ok(source.builtinVersion >= 6, `${label} version must be at least 6`);
  assert.equal(Object.hasOwn(source, 'readerTestBuiltinVersion'), false,
    `${label} portable collection must not emit the legacy test-version marker`);
  assert.match(source.builtinId, /^reader-builtin-[a-z0-9-]+$/,
    `${label} requires a builtinId slug`);
  assert.equal(builtinIds.has(source.builtinId), false, `${label} builtinId must be unique`);
  builtinIds.add(source.builtinId);
  assert.match(source.ruleFingerprint, /^[0-9a-f]{64}$/, `${label} requires a rule fingerprint`);
  assert.equal(typeof source.verifiedAt, 'string', `${label} requires a verification timestamp`);
  assert.equal(Number.isNaN(Date.parse(source.verifiedAt)), false,
    `${label} verification timestamp must be valid`);
  assert.ok(Array.isArray(source.capabilities) && source.capabilities.includes('import'),
    `${label} must record the passed import capability`);
  assert.equal(typeof source.provenance?.origin, 'string', `${label} requires rule provenance`);
  assert.equal(typeof source.readerHistoricalTest, 'object',
    `${label} requires its recorded test verdict`);
  if (source.defaultEnabled) {
    for (const capability of ['search', 'detail', 'toc', 'content']) {
      assert.ok(source.capabilities.includes(capability),
        `${label} is default-enabled so it must carry the ${capability} capability`);
    }
  }
  if (source.verificationSuiteVersion === 'reader-tested-corpus/1') {
    fullCorpusRecords += 1;
    assert.equal(source.provenance.evidence,
      'Reader-Core-Native/reports/tooling/corpus-batch-live-full-1945-v5-2026-07-09.json');
    assert.ok(['fully_passed', 'partially_passed'].includes(source.readerHistoricalTest.verdict));
  } else if (source.verificationSuiteVersion === 'reader-source-admission/1') {
    laterAdmissionRecords += 1;
    assert.equal(source.provenance.evidence,
      'evidence/2026-08-31-five-line/supply-admission-results.json');
    assert.equal(source.readerHistoricalTest.verdict, 'admitted');
    assert.equal(source.bookSourceGroup, 'Reader 内置 · 已验证书源');
  } else {
    assert.fail(`${label} references an unknown verification suite`);
  }
}

assert.equal(fullCorpusRecords, expectedFullCorpusRecords);
assert.equal(laterAdmissionRecords, expectedLaterAdmissionRecords);
assert.equal(sourceIds.size, expectedUniqueSourceIds,
  'duplicate tested rule variants must remain records but share their real bookSourceUrl identity');
assert.equal(defaultEnabledRecords, 158,
  'only evidence-backed full-chain/admitted records may be enabled by default');

// The six later admitted sources are appended after the older corpus variants,
// so normal sequential app import leaves their current product rules installed.
const lastBySourceId = new Map();
for (const source of sources) {
  lastBySourceId.set(source.bookSourceUrl, source);
}
const currentAdmission = [...lastBySourceId.values()]
  .filter(source => source.verificationSuiteVersion === 'reader-source-admission/1');
assert.equal(currentAdmission.length, expectedLaterAdmissionRecords);
assert.equal([...lastBySourceId.values()].filter(source => source.defaultEnabled).length, 137);

const owner = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const supply = read('entry/src/main/ets/app/BundledBookSourceSupply.ts');
assert.match(owner,
  /BUNDLED_BOOK_SOURCE_COLLECTION_RAW_FILE = 'reader-tested-book-source-collection\.json'/,
  'runtime must name the packaged source document');
const expectedDigest = createHash('sha256').update(document).digest('hex');
assert.match(owner, new RegExp(`const BUNDLED_RAW_FILE_SHA256 = '${expectedDigest}';`),
  'runtime must pin the exact bundled document bytes');
assert.match(owner, /fileDigest !== BUNDLED_RAW_FILE_SHA256/,
  'runtime must verify the bundled document before importing');
assert.match(owner,
  /this\.runtime = runtime;[\s\S]{0,300}this\.state = 'ready';[\s\S]{0,500}installBundledBookSourceCollection/,
  'large collection seeding must start only after Reader becomes usable');
assert.match(owner, /failed without blocking Reader/,
  'collection failure must be isolated from application startup');
assert.match(owner, /new Map<string, JsonObject>\(\)[\s\S]*admittedBySourceId\.set/,
  'duplicate rule records must collapse to their stable source identity at install time');
assert.match(owner, /runtime\.request\('source\.export',[\s\S]*format: 'json'/,
  'startup must read existing sources in one local Core export');
assert.match(owner,
  /existing\['enabled'\][\s\S]*importedSource\['enabled'\] = existing\['enabled'\]/,
  'a bundled rule upgrade must preserve the user enabled choice');
assert.match(owner,
  /existing\['enabledExplore'\][\s\S]*importedSource\['enabledExplore'\] = existing\['enabledExplore'\]/,
  'a bundled rule upgrade must preserve the user explore choice');
assert.match(owner, /Bundled source item failed and was isolated/,
  'one invalid source import must not abort the remaining collection');
assert.match(owner, /readerBuiltinWithdrawn/,
  'withdrawn bundled identities must be marked retired instead of deleted');
assert.match(supply, /RULE_PAYLOAD_FIELDS: string\[\] = \[/,
  'the ArkTS fingerprint canonicalization must be declared');
assert.match(supply, /decideBundledUpgrade/,
  'upgrade decisions must go through the shared user-copy guard');
assert.match(host, /resourceManager\.getRawFileContent\(fileName\)/,
  'Host must read the exact raw resource packaged into every HAP');

console.log(`bundled book-source import collection: PASS ` +
  `(${sources.length} tested records, ${sourceIds.size} unique identities)`);
