// Contract tests for the bundled-source supply chain logic that runs on the
// host: canonical rule fingerprints, upgrade/withdraw decisions, and the
// static admission gates on hostile fixtures.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUILTIN_VERSION,
  SUITE_VERSION,
  collectInsecureUrlFindings,
  collectPaywallFindings,
  collectSecretFindings,
  ruleFingerprint,
  validateBundledMetadata,
} from './source-supply-lib.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(resolve(repo, relative), 'utf8');

// -- fingerprint stability ----------------------------------------------------

const ruleSource = {
  bookSourceType: 0,
  bookSourceUrl: 'https://example.org/',
  searchUrl: '/search?q={{key}}',
  ruleSearch: { bookList: '.list', bookUrl: 'a@href' },
  ruleToc: { chapterList: '.chapters' },
  ruleContent: { content: '.body' },
  header: '{"User-Agent":"reader-test"}',
  enabledCookieJar: false,
};
const fingerprint = ruleFingerprint(ruleSource);
assert.match(fingerprint, /^[0-9a-f]{64}$/, 'fingerprint must be sha256 hex');
// Distribution metadata and user state must never influence the fingerprint.
const metadataVariants = [
  { ...ruleSource, enabled: false },
  { ...ruleSource, enabled: true, defaultEnabled: true },
  { ...ruleSource, builtinId: 'reader-builtin-x', builtinVersion: 9 },
  { ...ruleSource, verifiedAt: '2000-01-01T00:00:00.000Z' },
  { ...ruleSource, provenance: { origin: 'elsewhere' } },
  { ...ruleSource, bookSourceName: 'renamed', bookSourceGroup: 'other group' },
];
for (const variant of metadataVariants) {
  assert.equal(ruleFingerprint(variant), fingerprint,
    'distribution metadata and user state must not change the rule fingerprint');
}
// Rule edits must change it.
assert.notEqual(ruleFingerprint({ ...ruleSource, searchUrl: '/search2?q={{key}}' }), fingerprint,
  'rule edits must change the fingerprint');
// Key order must not.
const reordered = {
  header: '{"User-Agent":"reader-test"}',
  ruleContent: { content: '.body' },
  ruleToc: { chapterList: '.chapters' },
  ruleSearch: { bookList: '.list', bookUrl: 'a@href' },
  searchUrl: '/search?q={{key}}',
  bookSourceUrl: 'https://example.org/',
  bookSourceType: 0,
  enabledCookieJar: false,
};
assert.equal(ruleFingerprint(reordered), fingerprint, 'key order must not change the fingerprint');

// -- ArkTS canonicalization parity --------------------------------------------

const supply = read('entry/src/main/ets/app/BundledBookSourceSupply.ts');
const arktsFields = supply.match(/RULE_PAYLOAD_FIELDS: string\[\] = \[([\s\S]*?)\];/)[1]
  .match(/'([A-Za-z]+)'/g).map(name => name.slice(1, -1)).sort();
const nodeFields = (await import('./source-supply-lib.mjs')).RULE_PAYLOAD_FIELDS;
assert.deepEqual(arktsFields, [...nodeFields].sort(),
  'ArkTS and node canonical rule payload fields must be identical');

// -- static gates on hostile fixtures ------------------------------------------

const insecure = collectInsecureUrlFindings({
  searchUrl: 'http://example.org/search',
  ruleToc: { chapterUrl: 'https://ok.example.org/x' },
  jsLib: "function u(){return 'http://insecure.example.org/api';}",
});
assert.deepEqual(insecure.map(finding => finding.path).sort(),
  ['jsLib', 'searchUrl'], 'http:// literals must be reported wherever they appear');

const secrets = collectSecretFindings({
  searchUrl: 'https://x.example.org/api?_token=d2a094ff-b75f-4b60-ba2c-19e1cfe6cf73&key={{key}}',
  header: '{"Cookie":"session=abcdef0123456789"}',
  ruleSearch: { bookUrl: 'https://x.example.org/book?id={{$.bookId}}&nid=f0439a4f53b774fa0b4d90b48738e4f1' },
});
const secretKinds = secrets.map(finding => finding.kind);
assert.ok(secretKinds.includes('fixed-uuid'), 'fixed UUID tokens must be reported');
assert.ok(secretKinds.some(kind => kind.startsWith('fixed-param:')), 'fixed credential params must be reported');
assert.equal(collectSecretFindings({
  searchUrl: 'https://x.example.org/api?token={{key}}&q={{$.page}}',
}).length, 0, 'runtime-substituted template values are not secrets');

const paywall = collectPaywallFindings({
  ruleContent: { content: ".body@text@js:result || '这是 🔒 付费章节 哦！'" },
});
assert.equal(paywall.length, 1, 'synthesized paywall fallback text must be reported');
assert.equal(collectPaywallFindings({ ruleContent: { content: '.body@text' } }).length, 0,
  'clean content rules must pass the paywall gate');

// -- bundled metadata validation ------------------------------------------------

const bundled = JSON.parse(read('entry/src/main/resources/rawfile/reader-test-book-sources.json'));
for (const source of bundled) {
  assert.deepEqual(validateBundledMetadata(source), [],
    `${source.bookSourceName} metadata must satisfy the manifest contract`);
}
const tampered = { ...bundled[0], ruleFingerprint: '0'.repeat(64) };
assert.ok(validateBundledMetadata(tampered).length > 0,
  'a tampered fingerprint must fail metadata validation');
const flippedDefault = { ...bundled[0], defaultEnabled: !bundled[0].defaultEnabled };
assert.ok(validateBundledMetadata(flippedDefault).length > 0,
  'enabled/defaultEnabled disagreement must fail metadata validation');
const staleVersion = { ...bundled[0], builtinVersion: 1, readerTestBuiltinVersion: 1 };
assert.ok(validateBundledMetadata(staleVersion).length > 0,
  `bundled versions must be at least ${BUILTIN_VERSION}`);

// -- RuntimeOwner wiring ---------------------------------------------------------

const owner = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
assert.match(owner, /sha256Hex\(document\)[\s\S]{0,200}BUNDLED_RAW_FILE_SHA256/,
  'file-level integrity must be verified before any source import');
assert.match(owner, /sha256Hex\(canonicalRulePayloadJson\(bundled\)\)/,
  'per-source integrity must hash the canonical rule payload');
assert.match(owner, /admitted\.length === 0[\s\S]{0,120}throw new Error\('Bundled test book-source document admitted no sources'\)/,
  'a bundle where every source fails integrity must fail startup');
assert.match(owner, /hasBuiltinMarker\(existing\)/,
  'user-imported copies must be recognized by the missing builtin marker');
assert.match(owner, /isUserModifiedBuiltinCopy\(existing, storedActualFingerprint\)/,
  'user-modified builtin copies must be detected before any upgrade');
assert.match(owner, /ledger\.syncCurrentBundle\(admitted\)/,
  'the withdrawal ledger must track the current bundle');
const suiteVersionUsages = [...bundled.map(source => source.verificationSuiteVersion)];
assert.ok(suiteVersionUsages.every(version => version === SUITE_VERSION),
  `every bundled source must reference suite ${SUITE_VERSION}`);

console.log('source supply chain: PASS');
