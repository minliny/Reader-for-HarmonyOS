// Pinned correction for a project-authored builtin; never applied to user data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ruleFingerprint } from './source-supply-lib.mjs';

export const QIDIAN_PREVIOUS_FINGERPRINT = 'c57347ba10d8871d94bb2f2f556c3fb5dbede2c2a3b9e45625d62a2871f9cee1';
export const QIDIAN_CHAPTER_LIST = '.y-list__item@a,[class*="_chapterBar_"]';
export function applyQidianDirectoryCorrection(sources) {
  const matches = sources.filter(source => source.builtinId === 'reader-builtin-qidian');
  assert.equal(matches.length, 1, 'requires the exact project-authored Qidian source');
  const source = matches[0];
  if (source.builtinVersion === 7) {
    assert.equal(source.ruleToc.chapterList, QIDIAN_CHAPTER_LIST);
    assert.equal(source.provenance?.directoryCorrection?.previousRuleFingerprint, QIDIAN_PREVIOUS_FINGERPRINT);
    assert.equal(source.ruleFingerprint, ruleFingerprint(source));
    return source;
  }
  assert.equal(source.builtinVersion, 6, 'review a newer source before applying this correction');
  assert.equal(ruleFingerprint(source), QIDIAN_PREVIOUS_FINGERPRINT,
    'never overwrite a different source revision');
  // CSS-module suffixes change with site builds; the role prefix remains stable.
  // Keep the source isVolume rule: Core must provide correct textNodes/scalar semantics.
  source.ruleToc.chapterList = QIDIAN_CHAPTER_LIST;
  source.builtinVersion = 7;
  source.provenance.directoryCorrection = {
    version: 1, appliedAt: '2026-09-26', previousBuiltinVersion: 6,
    previousRuleFingerprint: QIDIAN_PREVIOUS_FINGERPRINT,
    fields: ['ruleToc.chapterList'], verification: 'recorded-public-html-production-parser',
    evidence: 'evidence/2026-09-26-qidian-directory/summary.json',
    note: 'Public Qingchun catalogue: one original volume and 53 chapter URLs; historical L1-L5 verification is retained separately.'
  };
  source.ruleFingerprint = ruleFingerprint(source);
  return source;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.argv[2], '--apply', 'use --apply for deterministic builtin regeneration');
  const raw = new URL('../entry/src/main/resources/rawfile/reader-tested-book-source-collection.json', import.meta.url);
  const sources = JSON.parse(readFileSync(raw, 'utf8'));
  applyQidianDirectoryCorrection(sources);
  const document = `${JSON.stringify(sources)}\n`;
  writeFileSync(raw, document);
  const owner = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
  const text = readFileSync(owner, 'utf8');
  const marker = /const BUNDLED_RAW_FILE_SHA256 = '[0-9a-f]{64}';/;
  assert.match(text, marker);
  const digest = createHash('sha256').update(document).digest('hex');
  writeFileSync(owner, text.replace(marker, `const BUNDLED_RAW_FILE_SHA256 = '${digest}';`));
  console.log('Qidian directory builtin correction applied; run generate-bundled-source-index.mjs');
}
