import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import {
  applyPopofreeQuoteCorrection, POPOFREE_BUILTIN_ID, POPOFREE_SOURCE_ID,
  POPOFREE_PREVIOUS_FINGERPRINT, POPOFREE_V7_FINGERPRINT, POPOFREE_QUOTE_RULE,
} from './popofree-source-correction.mjs';
import { RULE_PAYLOAD_FIELDS, ruleFingerprint, sha256Hex } from './source-supply-lib.mjs';

const sources = JSON.parse(readFileSync(new URL('../entry/src/main/resources/rawfile/reader-tested-book-source-collection.json', import.meta.url), 'utf8'));
const corrected = sources.find(source => source.builtinId === POPOFREE_BUILTIN_ID);
assert.equal(corrected.bookSourceUrl, POPOFREE_SOURCE_ID);
assert.equal(corrected.builtinVersion, 8);
assert.equal(corrected.ruleFingerprint, ruleFingerprint(corrected));
assert.equal(corrected.ruleContent.content, '#nr1@html' + POPOFREE_QUOTE_RULE);
assert.equal(corrected.ruleContent.replaceRegex, undefined);
assert.equal(corrected.provenance.contentCorrection.chapterUrls.length, 10);
assert.equal(corrected.provenance.contentCorrection.preserveExploreRules, true);
const old = structuredClone(corrected);
old.builtinVersion = 6;
old.ruleContent.content = '#nr1@html';
old.ruleFingerprint = POPOFREE_PREVIOUS_FINGERPRINT;
delete old.provenance.contentCorrection;
assert.equal(ruleFingerprint(old), POPOFREE_PREVIOUS_FINGERPRINT);
assert.deepEqual(applyPopofreeQuoteCorrection([structuredClone(old)]), corrected);
assert.deepEqual(applyPopofreeQuoteCorrection([structuredClone(corrected)]), corrected);
const edited = structuredClone(old);
edited.ruleContent.content = '#user-edited@text';
assert.throws(() => applyPopofreeQuoteCorrection([edited]), /edited source revision/);
const coreTest = readFileSync(new URL('../../Reader-Core-Native/crates/reader-content/tests/popofree_source_quotes.rs', import.meta.url), 'utf8');
assert.ok(coreTest.includes('popofree_quote_rule()'), 'Core regression must load the production shared correction');
const coreCorrection = readFileSync(new URL('../../Reader-Core-Native/crates/reader-content/src/source_corrections.rs', import.meta.url), 'utf8');
assert.ok(coreCorrection.includes(corrected.ruleFingerprint), 'offline correction must pin the distributed v8 fingerprint');
const previous = structuredClone(old);
previous.builtinVersion = 7;
previous.ruleContent.content = '#nr1@html' + String.raw`<js>/^https:\/\/m\.popofree\.com\/novel\/100749\/(?:3458336[89]|3458337[0-4])\.html(?:[?#]|$)/.test(baseUrl) ? String(result).replace(/(<[^>]*>|&(?:amp;)*quot;)|(?<![A-Za-z0-9_&])quot;/g, (token, keep) => keep || '"') : result</js>`;
previous.ruleFingerprint = POPOFREE_V7_FINGERPRINT;
assert.equal(ruleFingerprint(previous), POPOFREE_V7_FINGERPRINT);
assert.deepEqual(applyPopofreeQuoteCorrection([structuredClone(previous)]), corrected);

// Execute the actual legacy RuntimeOwner supply method: a content-only v6/v7→v8
// correction cannot own discovery edits or deletions excluded by its fingerprint.
const supply = readFileSync(new URL('../entry/src/main/ets/app/BundledBookSourceSupply.ts', import.meta.url), 'utf8');
const methods = stripTypeScriptTypes(supply.slice(supply.indexOf('function canonicalJson'), supply.indexOf('type StoredLedger')))
  .replace(/^export /gm, '');
const guards = new Function('RULE_PAYLOAD_FIELDS', `${methods}; return { canonicalRulePayloadJson,
  hasBuiltinMarker, isUserModifiedBuiltinCopy, decideBundledUpgrade };`)(RULE_PAYLOAD_FIELDS);
const oneDocument = JSON.stringify([corrected]);
let ledger;
const Owner = productionMotionMethods(fileURLToPath(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url)),
  ['installBundledBookSourceCollection'], { ...guards, sha256Hex,
    BUNDLED_BOOK_SOURCE_COLLECTION_RAW_FILE: 'reader-tested-book-source-collection.json',
    BUNDLED_RAW_FILE_SHA256: sha256Hex(oneDocument),
    BundledSourceLedger: { load: async () => ledger }, LOG_DOMAIN: 0,
    errorMessageOf: error => error.message, hilog: { error() {}, warn() {} } });
async function upgrade(stored) {
  const owner = new Owner();
  const imports = [];
  ledger = { all: () => [], remove() {}, syncCurrentBundle() {}, save: async () => {} };
  Object.assign(owner, { supportsCoreCapability: () => false, state: 'ready',
    host: { readBundledRawFileText: async () => oneDocument, getContext: () => ({}) },
    requireBundledBookSourceCollection: JSON.parse,
    loadExistingBundledSources: async () => new Map([[POPOFREE_SOURCE_ID, stored]]),
    importBundledSource: async (id, value) => imports.push(structuredClone(value)) });
  const summary = await owner.installBundledBookSourceCollection({});
  assert.equal(summary.failed, 0);
  return imports;
}
for (const base of [old, previous]) for (const deleted of [false, true]) {
  const stored = structuredClone(base);
  if (deleted) {
    delete stored.exploreUrl; delete stored.ruleExplore;
  } else {
    stored.exploreUrl = 'https://user.example/discovery';
    stored.ruleExplore = { bookList: '.user-discovery' };
  }
  assert.equal(ruleFingerprint(stored), base.ruleFingerprint);
  const imports = await upgrade(stored);
  assert.equal(imports.length, 1);
  assert.equal(imports[0].builtinVersion, 8);
  assert.deepEqual(imports[0].ruleContent, corrected.ruleContent);
  for (const field of ['exploreUrl', 'ruleExplore']) {
    assert.equal(Object.hasOwn(imports[0], field), Object.hasOwn(stored, field));
    assert.deepEqual(imports[0][field], stored[field]);
  }
  stored.ruleContent.content = '#user-body@text';
  assert.equal((await upgrade(stored)).length, 0, 'edited content rule rejects the upgrade');
}
console.log('PASS: exact source, pinned old revision, idempotent correction, Core-tested rule identity; actual legacy v6/v7→v8 preserves discovery edits/deletions and rejects content edits');
