import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyBaoziImageSourceCorrection, BAOZI_BUILTIN_ID, BAOZI_SOURCE_ID,
  BAOZI_CONTENT_RULE, BAOZI_PREVIOUS_CONTENT_RULE,
  BAOZI_PREVIOUS_FINGERPRINT, BAOZI_CORRECTED_FINGERPRINT,
} from './baozi-image-source-correction.mjs';
import { ruleFingerprint } from './source-supply-lib.mjs';

const sources = JSON.parse(readFileSync(new URL('../entry/src/main/resources/rawfile/reader-tested-book-source-collection.json', import.meta.url)));
const actual = sources.find(source => source.builtinId === BAOZI_BUILTIN_ID);
assert.ok(actual, 'controlled Baozi record is bundled');
assert.equal(actual.bookSourceUrl, BAOZI_SOURCE_ID);
assert.equal(actual.builtinVersion, 7);
assert.equal(actual.ruleContent.content, BAOZI_CONTENT_RULE);
assert.equal(actual.ruleFingerprint, BAOZI_CORRECTED_FINGERPRINT);

const previous = structuredClone(actual);
previous.builtinVersion = 6;
previous.ruleContent.content = BAOZI_PREVIOUS_CONTENT_RULE;
delete previous.provenance.contentCorrection;
previous.ruleFingerprint = ruleFingerprint(previous);
assert.equal(previous.ruleFingerprint, BAOZI_PREVIOUS_FINGERPRINT);
const before = structuredClone(previous);
assert.deepEqual(applyBaoziImageSourceCorrection([previous]), actual);
assert.deepEqual(applyBaoziImageSourceCorrection([previous]), actual, 'deterministic and idempotent');
assert.equal(actual.bookSourceUrl, before.bookSourceUrl);
assert.equal(actual.verifiedAt, before.verifiedAt, 'historical timestamp is not presented as fresh verification');
assert.deepEqual(actual.readerHistoricalTest, before.readerHistoricalTest);
assert.deepEqual(actual.capabilities, before.capabilities);
assert.deepEqual(actual.ruleToc, before.ruleToc);
assert.deepEqual(actual.ruleSearch, before.ruleSearch);
assert.deepEqual(actual.ruleBookInfo, before.ruleBookInfo);
assert.deepEqual(actual.ruleExplore, before.ruleExplore);
assert.equal(actual.exploreUrl, before.exploreUrl);
assert.equal(actual.enabled, before.enabled);
assert.equal(actual.enabledExplore, before.enabledExplore);

const corpus = JSON.parse(readFileSync(new URL('../../Reader-Core/tests/fixtures/corpus/sources/src-250-bb44193bd3bd.json', import.meta.url)));
assert.equal(ruleFingerprint(corpus), BAOZI_CORRECTED_FINGERPRINT, 'Core and bundled rules agree');
const correctedCorpusCandidate = { ...structuredClone(actual), builtinVersion: 6 };
delete correctedCorpusCandidate.provenance.contentCorrection;
assert.deepEqual(applyBaoziImageSourceCorrection([correctedCorpusCandidate]), actual);
const customized = structuredClone(before);
customized.ruleContent.content = 'user-rule';
assert.throws(() => applyBaoziImageSourceCorrection([customized]), /different source revision/);
const future = structuredClone(actual);
future.builtinVersion = 8;
assert.throws(() => applyBaoziImageSourceCorrection([future]), /newer source/);
console.log('Baozi builtin image URL correction, pinned revision and historical provenance: PASS');
