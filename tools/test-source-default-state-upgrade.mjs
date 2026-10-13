import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { RULE_PAYLOAD_FIELDS, ruleFingerprint, sha256Hex } from './source-supply-lib.mjs';

const sourceId = 'https://example.org';
const old = {
  bookSourceUrl: sourceId, bookSourceName: 'Example', builtinId: 'example', builtinVersion: 6,
  enabled: true, enabledExplore: true, defaultEnabled: true,
  ruleContent: { content: '.body' }, exploreUrl: '/original', ruleExplore: { bookList: '.original' },
};
old.ruleFingerprint = ruleFingerprint(old);
const proposed = { ...structuredClone(old), builtinVersion: 7, enabled: false, enabledExplore: false,
  defaultEnabled: false, provenance: { defaultStateCorrection: {
    version: 1, policy: 'reader-login-defaults/1', preserveUserFields: true,
    previousRuleFingerprint: old.ruleFingerprint, reason: 'account-required',
  } },
};
const supply = readFileSync(new URL('../entry/src/main/ets/app/BundledBookSourceSupply.ts', import.meta.url), 'utf8');
const methods = stripTypeScriptTypes(supply.slice(supply.indexOf('function canonicalJson'), supply.indexOf('type StoredLedger')))
  .replace(/^export /gm, '');
const guards = new Function('RULE_PAYLOAD_FIELDS', `${methods}; return { canonicalRulePayloadJson,
  hasBuiltinMarker, isUserModifiedBuiltinCopy, decideBundledUpgrade, mergeBundledDefaultStateCorrection };`)(RULE_PAYLOAD_FIELDS);
const document = JSON.stringify([proposed]);
let ledger;
const Owner = productionMotionMethods(fileURLToPath(new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url)),
  ['installBundledBookSourceCollection'], { ...guards, sha256Hex,
    BUNDLED_BOOK_SOURCE_COLLECTION_RAW_FILE: 'reader-tested-book-source-collection.json',
    BUNDLED_RAW_FILE_SHA256: sha256Hex(document),
    BundledSourceLedger: { load: async () => ledger }, LOG_DOMAIN: 0,
    errorMessageOf: error => error.message, hilog: { error() {}, warn() {} } });
async function upgrade(stored) {
  const owner = new Owner(), imports = [];
  ledger = { all: () => [], remove() {}, syncCurrentBundle() {}, save: async () => {} };
  Object.assign(owner, { supportsCoreCapability: () => false, state: 'ready',
    host: { readBundledRawFileText: async () => document, getContext: () => ({}) },
    requireBundledBookSourceCollection: JSON.parse,
    loadExistingBundledSources: async () => stored ? new Map([[sourceId, stored]]) : new Map(),
    importBundledSource: async (id, value) => { assert.equal(id, sourceId); imports.push(structuredClone(value)); } });
  const summary = await owner.installBundledBookSourceCollection({});
  assert.equal(summary.failed, 0);
  return imports;
}
assert.deepEqual(await upgrade(undefined), [proposed], 'new imports use the disabled defaults');
for (const enabled of [false, true]) for (const deleted of [false, true]) {
  const stored = { ...structuredClone(old), enabled, enabledExplore: !enabled,
    bookSourceName: 'My title', bookSourceGroup: 'My group', variable: 'user variable',
    customExtension: { theme: 'user' } };
  if (deleted) { delete stored.exploreUrl; delete stored.ruleExplore; }
  else { stored.exploreUrl = '/user-discovery'; stored.ruleExplore = { bookList: '.user' }; }
  const expected = structuredClone(stored);
  for (const field of ['builtinId', 'builtinVersion', 'defaultEnabled', 'provenance']) expected[field] = proposed[field];
  assert.deepEqual(await upgrade(stored), [expected], 'only controlled distribution metadata changes');
  assert.deepEqual(await upgrade(expected), [], 'same-version repeat is read-only');
  stored.ruleContent.content = '.user-body';
  assert.deepEqual(await upgrade(stored), [], 'edited fingerprinted rules remain user-owned');
}
const withdrawn = { ...structuredClone(old), readerBuiltinWithdrawn: true };
assert.deepEqual(await upgrade(withdrawn), [proposed], 'rebundled withdrawn sources use disabled seed');
for (const overrides of [{ version: 2 }, { policy: 'other-policy' }, { preserveUserFields: false },
  { previousRuleFingerprint: '0'.repeat(64) }]) {
  const invalid = structuredClone(proposed);
  Object.assign(invalid.provenance.defaultStateCorrection, overrides);
  assert.equal(guards.mergeBundledDefaultStateCorrection(invalid, old, ruleFingerprint(old)), undefined,
    'metadata-only path requires the exact reviewed marker');
}
console.log('PASS: actual legacy Owner default-off import, controlled metadata upgrade, enabled choices, custom fields/discovery deletions, idempotence, edited rules and withdrawal');
