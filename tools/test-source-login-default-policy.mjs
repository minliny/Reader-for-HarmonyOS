import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const { readFileSync }=await import('node:fs');
const { createHash }=await import('node:crypto');
const { gunzipSync }=await import('node:zlib');
const {
  SOURCE_LOGIN_DEFAULT_DECISIONS, applySourceLoginDefaultPolicy, assertSourceLoginDefault,
}=await import('./source-login-default-policy.mjs');
const { ruleFingerprint, rulePayloadJson }=await import('./source-supply-lib.mjs');

const publishedSources = JSON.parse(readFileSync(new URL(
  '../entry/src/main/resources/rawfile/reader-tested-book-source-collection.json', import.meta.url), 'utf8'));
const decisions = new Map(SOURCE_LOGIN_DEFAULT_DECISIONS.map(d => [d.sourceId, d]));
// The v7 policy applies to the historical collection before the audited
// bundle replaced it. Retain only the fields required by the policy and its
// rule fingerprints, from c122187f130c8abd7e7345810ec5b228597a0de4.
const fixture = gunzipSync(readFileSync(new URL('./fixtures/source-login-default-v7.json.gz', import.meta.url)));
assert.equal(createHash('sha256').update(fixture).digest('hex'),
  'd0bf50b9ef6fc6a74c313d79787d0b774b07693c3a836c1e56579e6a1f3975f1');
const { records: sources, vipException } = JSON.parse(fixture.toString('utf8'));

try{
if(id==='published-policy'){
for(const source of publishedSources)assertSourceLoginDefault(source);
for(const source of sources)assertSourceLoginDefault(source);for(const d of decisions.values()){assert.ok(d.evidence?.trim());assert.ok(d.evidenceField?.trim());assert.ok(d.fingerprints.length>0);const variants=sources.filter(s=>s.bookSourceUrl===d.sourceId);assert.ok(variants.length>0,d.sourceId);for(const source of variants)assert.ok(d.fingerprints.includes(ruleFingerprint(source)));}assert.equal(decisions.get('https://66shuba.com').requirement,'undetermined');
}
if(id==='regeneration'){
const regenerationInput = [...sources, ...publishedSources.filter(source => !decisions.has(source.bookSourceUrl))];
const regenerated = structuredClone(regenerationInput);
for (const source of regenerated) {
  if (!decisions.has(source.bookSourceUrl)) continue;
  source.enabled = true;
  source.defaultEnabled = true;
  if (Object.hasOwn(source, 'enabledExplore')) source.enabledExplore = true;
  source.builtinVersion = 6;
  delete source.provenance.defaultStateCorrection;
}
const ruleBytes = regenerated.map(rulePayloadJson);
const historical = regenerated.map(s => JSON.stringify(s.readerHistoricalTest));
const affected=regenerated.filter(s=>decisions.has(s.bookSourceUrl));assert.deepEqual(applySourceLoginDefaultPolicy(regenerated),{identities:new Set(affected.map(s=>s.bookSourceUrl)).size,records:affected.length});
for (const [index, source] of regenerated.entries()) {
  assert.equal(rulePayloadJson(source), ruleBytes[index], 'default decision must preserve rules');
  assert.equal(ruleFingerprint(source), source.ruleFingerprint);
  assert.equal(JSON.stringify(source.readerHistoricalTest), historical[index], 'past verification is historical');
  if (!decisions.has(source.bookSourceUrl)) assert.deepEqual(source, regenerationInput[index]);
}
const once = JSON.stringify(regenerated);
applySourceLoginDefaultPolicy(regenerated);
assert.equal(JSON.stringify(regenerated), once, 'applying the policy twice must be stable');


}
if(id==='rule-change'){
const changed = structuredClone(sources);
changed.find(s => s.bookSourceUrl === 'https://66shuba.com').searchUrl += '&changed=1';
assert.throws(() => applySourceLoginDefaultPolicy(changed), /changed rules require a new login\/default review/);
const wronglyEnabled = structuredClone(sources.find(s => s.bookSourceUrl === 'https://www.yodu.org'));
wronglyEnabled.enabled = wronglyEnabled.defaultEnabled = true;
assert.throws(() => assertSourceLoginDefault(wronglyEnabled), /must default off/);

}
if(id==='vip-exception'){
assert.equal(vipException.sourceId, 'https://m.jjwxc.net');
assert.equal(vipException.defaultEnabled, true,
  'partial VIP login does not require disabling the entire source');

}
}finally{}
}
const definitions={"published-policy": "published-policy actual scoped owner/gateway/storage path; controlled Core/OS ports", "regeneration": "regeneration actual scoped owner/gateway/storage path; controlled Core/OS ports", "rule-change": "rule-change actual scoped owner/gateway/storage path; controlled Core/OS ports", "vip-exception": "vip-exception actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
