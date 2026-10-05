// The source page owns its image CDN. Preserve that URL instead of rewriting
// an observed working bzcdn hostname to the obsolete bzmh hostname.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ruleFingerprint, sha256Hex } from './source-supply-lib.mjs';

export const BAOZI_BUILTIN_ID = 'reader-builtin-corpus-bb44193bd3bd';
export const BAOZI_SOURCE_ID = 'https://cn.bzmanga.com';
export const BAOZI_PREVIOUS_FINGERPRINT = 'c110cc449625270b9a34481b5c2303b01c1af163e8a35d61909fcba8655ddc85';
export const BAOZI_CORRECTED_FINGERPRINT = '4391373a47c491d55c6c6f29b6227d454cb23daa1d35a4c6b58bf719b8fb817c';
export const BAOZI_PREVIOUS_CONTENT_RULE = 'class.comic-contain@img@html##cdn##mh';
export const BAOZI_CONTENT_RULE = 'class.comic-contain@img@html';

export function applyBaoziImageSourceCorrection(sources) {
  const matches = sources.filter(source => source.builtinId === BAOZI_BUILTIN_ID);
  assert.equal(matches.length, 1, 'image correction requires the exact controlled Baozi source');
  const source = matches[0];
  assert.equal(source.bookSourceUrl, BAOZI_SOURCE_ID);
  if (source.builtinVersion === 7) {
    assert.equal(source.ruleContent.content, BAOZI_CONTENT_RULE);
    assert.equal(source.provenance?.contentCorrection?.previousRuleFingerprint, BAOZI_PREVIOUS_FINGERPRINT);
    assert.equal(source.provenance.contentCorrection.preserveExploreRules, true);
    assert.equal(source.ruleFingerprint, ruleFingerprint(source));
    assert.equal(source.ruleFingerprint, BAOZI_CORRECTED_FINGERPRINT);
    return source;
  }
  assert.equal(source.builtinVersion, 6, 'review a newer source before applying the image correction');
  // The generator may read the original historical rule or the corrected Core
  // corpus. Admit only these two reviewed payloads; never overwrite other edits.
  const fingerprint = ruleFingerprint(source);
  assert.ok(fingerprint === BAOZI_PREVIOUS_FINGERPRINT || fingerprint === BAOZI_CORRECTED_FINGERPRINT,
    'image correction must not overwrite a different source revision');
  assert.equal(source.ruleContent.content,
    fingerprint === BAOZI_PREVIOUS_FINGERPRINT ? BAOZI_PREVIOUS_CONTENT_RULE : BAOZI_CONTENT_RULE);
  source.ruleContent.content = BAOZI_CONTENT_RULE;
  source.builtinVersion = 7;
  source.provenance.contentCorrection = {
    version: 1,
    appliedAt: '2026-10-03',
    previousBuiltinVersion: 6,
    previousRuleFingerprint: BAOZI_PREVIOUS_FINGERPRINT,
    fields: ['ruleContent.content'],
    preserveExploreRules: true,
    verification: 'captured-public-html-production-parser-and-url-transport',
    evidence: 'evidence/2026-10-03-baozi-image-source/summary.json',
    note: 'The live chapter emits s1.bzcdn.net image URLs. Replacing cdn with mh produces s1.bzmh.net, which failed TLS before HTTP. Preserve the source-authored URL and existing scoped img/AMP extraction. Historical L1-L5 evidence is retained separately; HTTP image availability does not certify chapter identity or VM reading acceptance.',
  };
  source.ruleFingerprint = ruleFingerprint(source);
  assert.equal(source.ruleFingerprint, BAOZI_CORRECTED_FINGERPRINT);
  return source;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.argv[2], '--apply', 'use --apply for deterministic builtin regeneration');
  const raw = new URL('../entry/src/main/resources/rawfile/reader-tested-book-source-collection.json', import.meta.url);
  const sources = JSON.parse(readFileSync(raw, 'utf8'));
  applyBaoziImageSourceCorrection(sources);
  const document = `${JSON.stringify(sources)}\n`;
  writeFileSync(raw, document);
  const owner = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
  const text = readFileSync(owner, 'utf8');
  const marker = /const BUNDLED_RAW_FILE_SHA256 = '[0-9a-f]{64}';/;
  assert.match(text, marker);
  writeFileSync(owner, text.replace(marker,
    `const BUNDLED_RAW_FILE_SHA256 = '${sha256Hex(document)}';`));
  console.log('Baozi image builtin correction applied; run generate-bundled-source-index.mjs');
}
