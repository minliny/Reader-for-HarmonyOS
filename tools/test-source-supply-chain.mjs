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
assert.deepEqual(collectInsecureUrlFindings({
  searchUrl: 'HtTp://insecure.example.org/search',
}).map(finding => finding.path), ['searchUrl'],
  'HTTP URL scheme matching must be case-insensitive');

const secrets = collectSecretFindings({
  searchUrl: 'https://x.example.org/api?_token=d2a094ff-b75f-4b60-ba2c-19e1cfe6cf73&key={{key}}',
  header: '{"Cookie":"session=abcdef0123456789"}',
  ruleSearch: { bookUrl: 'https://x.example.org/book?id={{$.bookId}}&nid=f0439a4f53b774fa0b4d90b48738e4f1' },
});
const secretKinds = secrets.map(finding => finding.kind);
assert.ok(secretKinds.includes('fixed-uuid'), 'fixed UUID tokens must be reported');
assert.ok(secretKinds.some(kind => kind.startsWith('fixed-param:')), 'fixed credential params must be reported');
assert.ok(secretKinds.includes('static-header'),
  'JSON-serialized Cookie/Authorization headers must be reported without exposing their values');
assert.equal(collectSecretFindings({
  header: 'User-Agent: Reader\nAuthorization: opaque-value',
}).filter(finding => finding.kind === 'static-header').length, 1,
'line-oriented Authorization headers must be reported');
assert.equal(collectSecretFindings({
  searchUrl: 'https://x.example.org/api?token={{key}}&q={{$.page}}',
}).length, 0, 'runtime-substituted template values are not secrets');
assert.ok(collectSecretFindings({
  header: JSON.stringify({ 'Q-GUID': 'fixed-device-id', 'auth-code': 'fixed-auth-code' }),
}).some(finding => finding.kind === 'static-header'),
  'fixed device/auth identifiers in serialized headers must be reported');
assert.ok(collectSecretFindings({
  header: JSON.stringify({ token: 'fixed@token.example' }),
}).some(finding => finding.kind === 'static-header'),
  'email-shaped fixed token values must not bypass the static-secret gate');
assert.ok(collectSecretFindings({
  searchUrl: 'https://x.example.org/api?auth_code=fixed-auth-code&user_id=fixed-user-id',
}).some(finding => finding.kind.startsWith('fixed-param:')),
  'fixed auth query parameters must be reported');

const paywall = collectPaywallFindings({
  ruleContent: { content: ".body@text@js:result || '这是 🔒 付费章节 哦！'" },
});
assert.equal(paywall.length, 1, 'synthesized paywall fallback text must be reported');
assert.equal(collectPaywallFindings({ ruleContent: { content: '.body@text' } }).length, 0,
  'clean content rules must pass the paywall gate');

// -- bundled metadata validation ------------------------------------------------

const bundled = JSON.parse(read(
  'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json'));
for (const source of bundled) {
  assert.deepEqual(validateBundledMetadata(source), [],
    `${source.bookSourceName} metadata must satisfy the manifest contract`);
  assert.equal(collectSecretFindings(source).length, 0,
    `${source.bookSourceName} must not retain fixed credentials after sanitization`);
}
const quarantined = bundled.filter(source =>
  source.provenance?.distributionDecision === 'quarantined-fixed-credential');
assert.ok(quarantined.length >= 11,
  'all fixed-credential records must be explicitly quarantined');
for (const source of quarantined) {
  assert.equal(source.enabled, false);
  assert.equal(source.defaultEnabled, false);
  assert.deepEqual(source.capabilities, ['import']);
}
const tampered = { ...bundled[0], ruleFingerprint: '0'.repeat(64) };
assert.ok(validateBundledMetadata(tampered).length > 0,
  'a tampered fingerprint must fail metadata validation');
const flippedDefault = { ...bundled[0], defaultEnabled: !bundled[0].defaultEnabled };
assert.ok(validateBundledMetadata(flippedDefault).length > 0,
  'enabled/defaultEnabled disagreement must fail metadata validation');
const staleVersion = { ...bundled[0], builtinVersion: 1 };
assert.ok(validateBundledMetadata(staleVersion).length > 0,
  `bundled versions must be at least ${BUILTIN_VERSION}`);
assert.ok(validateBundledMetadata({
  ...bundled[0],
  searchUrl: 'http://insecure.example.org/search',
  ruleFingerprint: ruleFingerprint({ ...bundled[0], searchUrl: 'http://insecure.example.org/search' }),
}).some(error => error.includes('http://')),
'metadata admission must reject insecure rule URLs');
const credentialHeaderSource = {
  ...bundled[0],
  header: '{"Authorization":"fixed-value"}',
};
credentialHeaderSource.ruleFingerprint = ruleFingerprint(credentialHeaderSource);
assert.ok(validateBundledMetadata(credentialHeaderSource)
  .some(error => error.includes('fixed credentials')),
'metadata admission must reject serialized credential headers');

// -- RuntimeOwner wiring ---------------------------------------------------------

const owner = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
assert.match(owner, /sha256Hex\(document\)[\s\S]{0,200}BUNDLED_RAW_FILE_SHA256/,
  'file-level integrity must be verified before any source import');
assert.match(owner, /sha256Hex\(canonicalRulePayloadJson\(bundled\)\)/,
  'per-source integrity must hash the canonical rule payload');
assert.match(owner,
  /this\.state = 'ready';[\s\S]*installBundledBookSourceCollection\(runtime\)[\s\S]*failed without blocking Reader/,
  'bundle verification/import errors must be isolated after Reader becomes usable');
assert.match(owner, /hasBuiltinMarker\(existing\)/,
  'user-imported copies must be recognized by the missing builtin marker');
assert.match(owner, /isUserModifiedBuiltinCopy\(existing, storedActualFingerprint\)/,
  'user-modified builtin copies must be detected before any upgrade');
assert.match(owner, /ledger\.syncCurrentBundle\(managedCurrent\)/,
  'the withdrawal ledger must track only successfully managed sources');
const suiteVersionUsages = new Set(bundled.map(source => source.verificationSuiteVersion));
assert.deepEqual(suiteVersionUsages,
  new Set([SUITE_VERSION, 'reader-source-admission/1']),
  'the collection must retain both the full-corpus and later admission evidence suites');

console.log('source supply chain: PASS');

const { spawnSync } = await import('node:child_process');
assert.equal(spawnSync(process.execPath, ['tools/generate-bundled-source-index.mjs', '--check'], { encoding: 'utf8' }).status, 0, 'indexed resource artifacts must match portable bundle');
