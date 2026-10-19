import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
// Contract tests for the bundled-source supply chain logic that runs on the
// host: canonical rule fingerprints, upgrade/withdraw decisions, and the
// static admission gates on hostile fixtures.

const { readFileSync }=await import('node:fs');
const { dirname, resolve }=await import('node:path');
const { fileURLToPath }=await import('node:url');
const { assertSourceLoginDefault }=await import('./source-login-default-policy.mjs');
const {
  BUILTIN_VERSION,
  SUITE_VERSION,
  collectInsecureUrlFindings,
  collectPaywallFindings,
  collectSecretFindings,
  ruleFingerprint,
  validateBundledMetadata,
}=await import('./source-supply-lib.mjs');

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(resolve(repo, relative), 'utf8');


try{
if(id==='fingerprint'){
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


}
if(id==='canonical-parity'){
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

const {stripTypeScriptTypes}=await import('node:module');const {rulePayloadJson,RULE_PAYLOAD_FIELDS}=await import('./source-supply-lib.mjs');
const source=read('entry/src/main/ets/app/BundledBookSourceSupply.ts');const executable=stripTypeScriptTypes(source.slice(0,source.indexOf('export function hasBuiltinMarker')).replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''));
const canonical=new Function(executable+';return canonicalRulePayloadJson;')();
for(const value of [ruleSource,...metadataVariants,reordered])assert.equal(canonical(value),rulePayloadJson(value));
for(const field of RULE_PAYLOAD_FIELDS){const value={...ruleSource,[field]:{z:[1,'界'],a:{y:false,x:null}}};assert.equal(canonical(value),rulePayloadJson(value),field+' uses actual production canonicalizer');}

}
if(id==='hostile-rules'){
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


}
if(id==='bundled-metadata'){
const bundled = JSON.parse(read(
  'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json'));
for (const source of bundled) {
  assertSourceLoginDefault(source);
  assert.deepEqual(validateBundledMetadata(source), [],
    `${source.bookSourceName} metadata must satisfy the manifest contract`);
  assert.equal(collectSecretFindings(source).length, 0,
    `${source.bookSourceName} must not retain fixed credentials after sanitization`);
}
const quarantined = bundled.filter(source =>
  source.provenance?.distributionDecision === 'quarantined-fixed-credential');

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


const suites=new Set(bundled.map(s=>s.verificationSuiteVersion));assert.ok([...suites].every(s=>typeof s==='string'&&s.trim()));
}
if(id==='generated-index'){
const {spawnSync}=await import('node:child_process');const result=spawnSync(process.execPath,['tools/generate-bundled-source-index.mjs','--check'],{cwd:repo,encoding:'utf8'});assert.equal(result.status,0,result.stderr+result.stdout);
}
}finally{}
}
const definitions={"fingerprint": "fingerprint actual scoped owner/gateway/storage path; controlled Core/OS ports", "canonical-parity": "canonical-parity actual scoped owner/gateway/storage path; controlled Core/OS ports", "hostile-rules": "hostile-rules actual scoped owner/gateway/storage path; controlled Core/OS ports", "bundled-metadata": "bundled-metadata actual scoped owner/gateway/storage path; controlled Core/OS ports", "generated-index": "generated-index actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
