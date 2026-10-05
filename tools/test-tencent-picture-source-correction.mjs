import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import {
  applyTencentPictureSourceCorrection, TENCENT_REVISIONS, TENCENT_SOURCE_ID,
  TENCENT_CONTENT_RULE, TENCENT_PREVIOUS_CONTENT_RULE,
} from './tencent-picture-source-correction.mjs';
import { RULE_PAYLOAD_FIELDS, ruleFingerprint, sha256Hex, validateBundledMetadata } from './source-supply-lib.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const sources = JSON.parse(read('../entry/src/main/resources/rawfile/reader-tested-book-source-collection.json'));
const current = TENCENT_REVISIONS.map(revision => sources.find(source => source.builtinId === revision.builtinId));
const previous = current.map((actual, index) => {
  const revision = TENCENT_REVISIONS[index];
  assert.ok(actual);
  assert.equal(actual.bookSourceUrl, TENCENT_SOURCE_ID);
  assert.equal(actual.builtinVersion, 7);
  assert.equal(actual.ruleContent.content, TENCENT_CONTENT_RULE);
  if (actual.contentRule) assert.equal(actual.contentRule.content, TENCENT_CONTENT_RULE);
  assert.equal(actual.ruleFingerprint, revision.correctedFingerprint);
  assert.deepEqual(validateBundledMetadata(actual), []);
  const old = structuredClone(actual);
  old.builtinVersion = 6;
  old.ruleContent.content = TENCENT_PREVIOUS_CONTENT_RULE;
  if (old.contentRule) old.contentRule.content = TENCENT_PREVIOUS_CONTENT_RULE;
  delete old.provenance.contentCorrection;
  old.ruleFingerprint = ruleFingerprint(old);
  assert.equal(old.ruleFingerprint, revision.previousFingerprint);
  assert.deepEqual(actual.provenance.contentCorrection.previousUnfingerprintedFields,
    { contentRule: old.contentRule ?? null });
  for (const field of ['verifiedAt', 'readerHistoricalTest', 'capabilities', 'ruleToc', 'ruleSearch',
    'ruleBookInfo', 'ruleExplore', 'exploreUrl', 'enabled', 'enabledExplore']) {
    assert.deepEqual(actual[field], old[field], `${field} is retained`);
  }
  return old;
});
const original = structuredClone(previous);
assert.deepEqual(applyTencentPictureSourceCorrection(previous), current);
assert.deepEqual(applyTencentPictureSourceCorrection(previous), current, 'idempotent');
const corpusCandidates = current.map(actual => {
  const source = structuredClone(actual); source.builtinVersion = 6;
  delete source.provenance.contentCorrection; return source;
});
assert.deepEqual(applyTencentPictureSourceCorrection(corpusCandidates), current,
  'historical generator may consume the already corrected Core corpus');
for (let index = 0; index < original.length; index += 1) {
  const custom = structuredClone(original);
  custom[index].ruleContent.content = 'user-rule';
  assert.throws(() => applyTencentPictureSourceCorrection(custom), /different source revision/);
  const aliasEdit = structuredClone(original);
  aliasEdit[index].contentRule = { ...(aliasEdit[index].contentRule ?? {}), content: 'user-alias-rule' };
  assert.throws(() => applyTencentPictureSourceCorrection(aliasEdit), /different contentRule alias/);
  const future = structuredClone(current); future[index].builtinVersion = 8;
  assert.throws(() => applyTencentPictureSourceCorrection(future), /newer source/);
}
const corpus = JSON.parse(read('../../Reader-Core-Native/tests/fixtures/corpus/sources/src-2196-6781cc801619.json'));
assert.equal(ruleFingerprint(corpus), TENCENT_REVISIONS[1].correctedFingerprint,
  'current Core source and packaged source agree');
assert.match(read('./refresh-source-supply-manifest.mjs'), /applyTencentPictureSourceCorrection\(sources\)/);

// Execute the production RuntimeOwner upgrade path, including the real alias
// conflict guard. It protects edits outside the historical rule fingerprint.
const supply = read('../entry/src/main/ets/app/BundledBookSourceSupply.ts');
const methods = stripTypeScriptTypes(supply.slice(supply.indexOf('function canonicalJson'), supply.indexOf('type StoredLedger')))
  .replace(/^export /gm, '');
const guards = new Function('RULE_PAYLOAD_FIELDS', `${methods}; return { canonicalRulePayloadJson,
  hasBuiltinMarker, isUserModifiedBuiltinCopy, decideBundledUpgrade };`)(RULE_PAYLOAD_FIELDS);
for (let index = 0; index < current.length; index += 1) {
  const source = current[index];
  const oneDocument = JSON.stringify([source]);
  let ledger;
  const Owner = productionMotionMethods(fileURLToPath(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url)),
    ['installBundledBookSourceCollection'], { ...guards, sha256Hex,
      BUNDLED_BOOK_SOURCE_COLLECTION_RAW_FILE: 'reader-tested-book-source-collection.json',
      BUNDLED_RAW_FILE_SHA256: sha256Hex(oneDocument),
      BundledSourceLedger: { load: async () => ledger }, LOG_DOMAIN: 0,
      errorMessageOf: error => error.message, hilog: { error() {}, warn() {} } });
  async function upgrade(stored) {
    const owner = new Owner(); const imports = [];
    ledger = { all: () => [], remove() {}, syncCurrentBundle() {}, save: async () => {} };
    Object.assign(owner, { supportsCoreCapability: () => false, state: 'ready',
      host: { readBundledRawFileText: async () => oneDocument, getContext: () => ({}) },
      requireBundledBookSourceCollection: JSON.parse,
      loadExistingBundledSources: async () => new Map(stored === undefined ? [] : [[source.bookSourceUrl, stored]]),
      importBundledSource: async (id, value) => imports.push(structuredClone(value)) });
    assert.equal((await owner.installBundledBookSourceCollection({})).failed, 0);
    return imports;
  }
  assert.equal((await upgrade())[0].builtinVersion, 7);
  const clean = { ...structuredClone(original[index]), enabled: false, enabledExplore: false };
  const installed = (await upgrade(clean))[0];
  assert.equal(installed.builtinVersion, 7);
  assert.equal(installed.enabled, false); assert.equal(installed.enabledExplore, false);
  assert.equal((await upgrade(source)).length, 0, 'same revision is not repeatedly imported');
  const userCopy = structuredClone(clean); delete userCopy.builtinId; delete userCopy.builtinVersion;
  assert.equal((await upgrade(userCopy)).length, 0, 'user-owned source is protected');
  const ruleEdit = structuredClone(clean); ruleEdit.ruleContent.content = 'user-rule';
  assert.equal((await upgrade(ruleEdit)).length, 0, 'fingerprinted user rule is protected');
  const aliasEdit = structuredClone(clean);
  aliasEdit.contentRule = { ...(aliasEdit.contentRule ?? {}), content: 'user-alias-rule' };
  assert.equal(ruleFingerprint(aliasEdit), ruleFingerprint(clean), 'contentRule is outside the legacy fingerprint');
  assert.equal((await upgrade(aliasEdit)).length, 0, 'unfingerprinted alias user edits are protected');
  if (Object.hasOwn(clean, 'contentRule')) {
    const aliasDeleted = structuredClone(clean); delete aliasDeleted.contentRule;
    assert.equal((await upgrade(aliasDeleted)).length, 0, 'deleting a historical alias is protected');
    const proposedAlias = structuredClone(clean); proposedAlias.contentRule = structuredClone(source.contentRule);
    assert.equal((await upgrade(proposedAlias))[0].builtinVersion, 7, 'already corrected alias is accepted');
  }
  const discovery = { ...structuredClone(clean), exploreUrl: 'https://user.example/discover',
    ruleExplore: { bookList: '$.userBooks' } };
  const discoveryUpgrade = (await upgrade(discovery))[0];
  assert.equal(discoveryUpgrade.exploreUrl, discovery.exploreUrl);
  assert.deepEqual(discoveryUpgrade.ruleExplore, discovery.ruleExplore);
}

// Real production protocol and QuickJS parser, using the exact public DATA and
// nonce script bytes captured from chapter 531040/1. No network is needed.
const cli = process.env.READER_CORE_CLI ?? fileURLToPath(new URL('../../Reader-Core-Native/target/debug/reader-cli', import.meta.url));
const html = read('../../Reader-Core-Native/tests/fixtures/manga/tencent-free-chapter-531040-1.html');
const expected = JSON.parse(read('../../Reader-Core-Native/tests/fixtures/manga/tencent-free-chapter-531040-1-pages.json'));
assert.equal(expected.length, 36);
function extract(source, id) {
  const command = { protocolVersion: 1, requestId: id, method: 'manga.pages.extract', params: {
    sourceId: source.sourceId, bookId: 'https://ac.qq.com/Comic/comicInfo/id/531040',
    chapterTitle: '01', chapterUrl: 'https://ac.qq.com/ComicView/index/id/531040/cid/1',
    chapterResponse: html, source: { sourceId: source.sourceId, name: source.bookSourceName,
      baseUrl: source.bookSourceUrl, rules: {}, bookSource: source },
  } };
  const result = spawnSync(cli, ['--stdin'], { input: `${JSON.stringify(command)}\n`,
    encoding: 'utf8', timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const responses = result.stdout.trim().split('\n').map(line => JSON.parse(line));
  return responses.find(response => response.requestId === id && ['result', 'error'].includes(response.type));
}
for (let index = 0; index < current.length; index += 1) {
  const before = extract(original[index], 970 + index * 2);
  assert.equal(before.type, 'error');
  assert.match(before.error.message, /Syntax: expecting ';'/);
  const after = extract(current[index], 971 + index * 2);
  assert.equal(after.type, 'result', JSON.stringify(after));
  assert.deepEqual(after.data.pages.map(page => page.url), expected,
    'both controlled source variants yield the same 36 ordered picture URLs without ads');
}
console.log('Tencent pinned v7 correction: exact revisions/aliases/history retained; actual Owner custom/alias protections; both production manga replays 36 pages; original JS error reproduced: PASS');
