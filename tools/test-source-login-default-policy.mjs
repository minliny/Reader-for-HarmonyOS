import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SOURCE_LOGIN_DEFAULT_DECISIONS, applySourceLoginDefaultPolicy, assertSourceLoginDefault,
} from './source-login-default-policy.mjs';
import { ruleFingerprint, rulePayloadJson } from './source-supply-lib.mjs';

const sources = JSON.parse(readFileSync(new URL(
  '../entry/src/main/resources/rawfile/reader-tested-book-source-collection.json', import.meta.url), 'utf8'));
const decisions = new Map(SOURCE_LOGIN_DEFAULT_DECISIONS.map(d => [d.sourceId, d]));
assert.equal(decisions.size, 12);
assert.equal([...decisions.values()].filter(d => d.requirement === 'account-required').length, 11);
assert.equal(decisions.get('https://66shuba.com').requirement, 'undetermined');
sources.forEach(assertSourceLoginDefault);

// Simulate rebuilding from historical success/default seeds. Both weak and
// strongest variants of every reviewed identity must be closed again.
const regenerated = structuredClone(sources);
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
assert.deepEqual(applySourceLoginDefaultPolicy(regenerated), { identities: 12, records: 18 });
for (const [index, source] of regenerated.entries()) {
  assert.equal(rulePayloadJson(source), ruleBytes[index], 'default decision must preserve rules');
  assert.equal(ruleFingerprint(source), source.ruleFingerprint);
  assert.equal(JSON.stringify(source.readerHistoricalTest), historical[index], 'past verification is historical');
  if (!decisions.has(source.bookSourceUrl)) assert.deepEqual(source, sources[index]);
}
const once = JSON.stringify(regenerated);
applySourceLoginDefaultPolicy(regenerated);
assert.equal(JSON.stringify(regenerated), once, 'applying the policy twice must be stable');

const changed = structuredClone(sources);
changed.find(s => s.bookSourceUrl === 'https://66shuba.com').searchUrl += '&changed=1';
assert.throws(() => applySourceLoginDefaultPolicy(changed), /changed rules require a new login\/default review/);
const wronglyEnabled = structuredClone(sources.find(s => s.bookSourceUrl === 'https://www.yodu.org'));
wronglyEnabled.enabled = wronglyEnabled.defaultEnabled = true;
assert.throws(() => assertSourceLoginDefault(wronglyEnabled), /must default off/);
assert.equal(sources.findLast(s => s.bookSourceUrl === 'https://m.jjwxc.net').defaultEnabled, true,
  'partial VIP login does not require disabling the entire source');
console.log('source login/default policy: PASS (11 declared gates + 1 anonymous failure; 18 variants; regeneration/rule preservation)');
