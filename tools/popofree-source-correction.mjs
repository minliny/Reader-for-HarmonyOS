// Source-authored text defects in ten verified pages. This is a bounded
// source rule, not a change to Reader's HTML/entity parsing policy.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ruleFingerprint } from './source-supply-lib.mjs';

export const POPOFREE_BUILTIN_ID = 'reader-builtin-corpus-ae94768cd9f1';
export const POPOFREE_SOURCE_ID = 'https://m.popofree.com#🎃';
export const POPOFREE_PREVIOUS_FINGERPRINT = '0e22a102abfbe970231ce966eb9d5261b67369e5bef0ce75ee5b8f752634f7d0';
export const POPOFREE_V7_FINGERPRINT = 'c65960a75dc148b4d51f5a217eaef0aca3222ac9379a19bd2e481467ae0fe620';
export const POPOFREE_QUOTE_RULE = '<js>' + readFileSync(new URL(
  '../../Reader-Core-Native/crates/reader-content/src/popofree_quote_correction.js', import.meta.url), 'utf8').trim() + '</js>';
export const POPOFREE_CORRECTED_CHAPTER_IDS = [34583368, 34583369, 34583370, 34583371,
  34583372, 34583373, 34583374, 34583376, 34656610, 34656611];

export function applyPopofreeQuoteCorrection(sources) {
  const matches = sources.filter(source => source.builtinId === POPOFREE_BUILTIN_ID);
  assert.equal(matches.length, 1, 'quote correction requires the exact controlled source');
  const source = matches[0];
  assert.equal(source.bookSourceUrl, POPOFREE_SOURCE_ID);
  if (source.builtinVersion === 8) {
    assert.equal(source.provenance?.contentCorrection?.previousRuleFingerprint, POPOFREE_V7_FINGERPRINT);
    assert.equal(source.provenance.contentCorrection.preserveExploreRules, true);
    assert.equal(source.ruleFingerprint, ruleFingerprint(source));
    assert.equal(source.ruleContent.content, '#nr1@html' + POPOFREE_QUOTE_RULE);
    return source;
  }
  assert.ok(source.builtinVersion === 6 || source.builtinVersion === 7,
    'review a newer source before applying the quote correction');
  assert.equal(ruleFingerprint(source), source.builtinVersion === 6 ? POPOFREE_PREVIOUS_FINGERPRINT : POPOFREE_V7_FINGERPRINT,
    'never overwrite an edited source revision');
  // Keeping replaceRegex absent preserves the exact old finalization path for
  // every unmatched chapter, including intentionally escaped literal entities.
  source.ruleContent = { content: '#nr1@html' + POPOFREE_QUOTE_RULE };
  source.builtinVersion = 8;
  source.provenance.contentCorrection = {
    version: 2,
    appliedAt: '2026-09-23',
    previousBuiltinVersion: 7,
    previousRuleFingerprint: POPOFREE_V7_FINGERPRINT,
    originalRuleFingerprint: POPOFREE_PREVIOUS_FINGERPRINT,
    bookUrl: 'https://m.popofree.com/novel/100749.html',
    chapterUrls: POPOFREE_CORRECTED_CHAPTER_IDS.map(id =>
      `https://m.popofree.com/novel/100749/${id}.html`),
    fields: ['ruleContent.content'],
    preserveExploreRules: true,
    verification: 'captured-pages-core-replay',
    evidence: 'Reader-Core-Native/crates/reader-content/tests/popofree_source_quotes.rs',
    note: 'Captured chapters 833-846 contain 347 bare quot; tokens in 833-839/841 and six double-encoded quote entities in 842/843. One shared JS rule covers live extraction and protected offline cache correction. Other pages and markup retain their original extraction. Historical suite verdict is unchanged.',
  };
  source.ruleFingerprint = ruleFingerprint(source);
  return source;
}
