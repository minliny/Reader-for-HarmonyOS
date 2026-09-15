// Local metadata correction over one pinned historical source. The original
// live verdict remains historical; this patch has its own fixture provenance.
import assert from 'node:assert/strict';
import { ruleFingerprint } from './source-supply-lib.mjs';

export const READING_ASSISTANT_BUILTIN_ID = 'reader-builtin-corpus-752f07e02faf';
export const READING_ASSISTANT_PREVIOUS_FINGERPRINT = 'b3365ce1e8dd475f65fc07069840fddeedee675a4f423918a009583896e16347';

export function applyReadingAssistantMetadataCorrection(sources) {
  const matches = sources.filter(source => source.builtinId === READING_ASSISTANT_BUILTIN_ID);
  assert.equal(matches.length, 1, 'metadata correction requires the exact historical source');
  const source = matches[0];
  if (source.builtinVersion === 7) {
    assert.equal(source.provenance?.metadataCorrection?.previousRuleFingerprint, READING_ASSISTANT_PREVIOUS_FINGERPRINT);
    assert.equal(source.ruleFingerprint, ruleFingerprint(source), 'corrected source rule fingerprint drift');
    return source;
  }
  assert.equal(source.builtinVersion, 6, 'review a newer source before applying the metadata correction');
  assert.equal(ruleFingerprint(source), READING_ASSISTANT_PREVIOUS_FINGERPRINT,
    'metadata correction must not overwrite a different source revision');
  source.ruleSearch.intro = '$.intro';
  source.ruleSearch.kind = '$.ptags';
  source.ruleBookInfo.intro = '$.intro';
  // Keep the previous date role; move the existing book tags out of synopsis.
  source.ruleBookInfo.kind = "@js:[java.timeFormat(java.getString('$.update_time')*1000).replace(/\\s.*/, '')].concat(java.getStringList('$.book_tag_list[*].title')).join(',')";
  source.builtinVersion = 7;
  source.provenance.metadataCorrection = {
    version: 1,
    appliedAt: '2026-09-16',
    previousBuiltinVersion: 6,
    previousRuleFingerprint: READING_ASSISTANT_PREVIOUS_FINGERPRINT,
    fields: ['ruleSearch.intro', 'ruleSearch.kind', 'ruleBookInfo.intro', 'ruleBookInfo.kind'],
    preserveExploreRules: true,
    verification: 'local-fixture',
    evidence: 'tools/test-reading-assistant-source.mjs',
    note: 'Synopsis reads the source intro; tags retain their kind role. Historical live verification is unchanged. Discovery rules are not upgraded by this correction.',
  };
  source.ruleFingerprint = ruleFingerprint(source);
  return source;
}
