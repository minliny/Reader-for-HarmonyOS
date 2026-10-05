// Targeted correction of two reviewed ac.qq.com source variants. Decode the
// official JSON envelope and select picture, keeping its adjacent ads separate.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { ruleFingerprint, sha256Hex } from './source-supply-lib.mjs';

export const TENCENT_SOURCE_ID = 'https://ac.qq.com';
export const TENCENT_REVISIONS = [
  { builtinId: 'reader-builtin-corpus-f359be41c7fe',
    previousFingerprint: '8c685367a76da5bfe71d9d2a942f3b321d9435e6dbd4f2624e7d8feb952a597e',
    correctedFingerprint: '794cfde2ccabd0a1a1f77cf0915aaca592ebd20f87570b8c993e8d575cf7b2c4' },
  { builtinId: 'reader-builtin-corpus-6781cc801619',
    previousFingerprint: '8b1a75305044cee376a89e200193cda668e6d292b54564b777982595e7c681c9',
    correctedFingerprint: '55fc0bed121c1e3e38a9f7b33e0d9fdb89293a611837b20384cc25bc83b76ac1' },
];

export const TENCENT_PREVIOUS_CONTENT_RULE = String.raw`@js:
data=result.match(/DATA = '(.*?)'/)[1];
nonce=result.match(/<script>\s*window.*?=(.*?)\s*<\/script>/)[1];
nonce=eval(nonce);
var N = String(nonce).match(/\d+\w+/);
jlen=N.length;
while(jlen){
jlen -= 1;
jlocate = parseInt(N[jlen].match(/(\d+)/)[0]) &255;
jstr = N[jlen].replace(/\d+/g,'');
data=data.substring(0,parseInt(jlocate))+data.substring(parseInt(jlocate)+jstr.length,data.length)}
piclist=eval(java.base64Decode(data).match(/"picture":(\[{".*\])/)[1]);
html='';
for(i in piclist){
html += '<img src="'+piclist[i].url+'">\n'
}
html`;
export const TENCENT_CONTENT_RULE = TENCENT_PREVIOUS_CONTENT_RULE
  .replace('String(nonce).match(/\\d+\\w+/)', 'String(nonce).match(/\\d+[a-zA-Z]+/g)')
  .replace('piclist=eval(java.base64Decode(data).match(/"picture":(\\[{".*\\])/)[1]);',
    'piclist=JSON.parse(java.base64Decode(data)).picture;');

function assertContentAliases(source, content) {
  assert.equal(source.ruleContent.content, content);
  if (Object.hasOwn(source, 'contentRule')) assert.equal(source.contentRule.content, content,
    'image correction must not overwrite a different contentRule alias');
}

export function applyTencentPictureSourceCorrection(sources) {
  return TENCENT_REVISIONS.map(revision => {
    const matches = sources.filter(source => source.builtinId === revision.builtinId);
    assert.equal(matches.length, 1, 'picture correction requires the exact controlled Tencent variants');
    const source = matches[0];
    assert.equal(source.bookSourceUrl, TENCENT_SOURCE_ID);
    if (source.builtinVersion === 7) {
      assertContentAliases(source, TENCENT_CONTENT_RULE);
      assert.equal(source.provenance?.contentCorrection?.previousRuleFingerprint, revision.previousFingerprint);
      assert.equal(source.provenance.contentCorrection.preserveExploreRules, true);
      const previousAlias = source.contentRule ? { ...source.contentRule, content: TENCENT_PREVIOUS_CONTENT_RULE } : null;
      assert.deepEqual(source.provenance.contentCorrection.previousUnfingerprintedFields,
        { contentRule: previousAlias });
      assert.equal(source.ruleFingerprint, ruleFingerprint(source));
      assert.equal(source.ruleFingerprint, revision.correctedFingerprint);
      return source;
    }
    assert.equal(source.builtinVersion, 6, 'review a newer source before applying the picture correction');
    const fingerprint = ruleFingerprint(source);
    assert.ok(fingerprint === revision.previousFingerprint || fingerprint === revision.correctedFingerprint,
      'picture correction must not overwrite a different source revision');
    assertContentAliases(source, fingerprint === revision.previousFingerprint
      ? TENCENT_PREVIOUS_CONTENT_RULE : TENCENT_CONTENT_RULE);
    const previousAlias = source.contentRule ? { ...source.contentRule, content: TENCENT_PREVIOUS_CONTENT_RULE } : null;
    const fields = ['ruleContent.content'];
    source.ruleContent.content = TENCENT_CONTENT_RULE;
    if (Object.hasOwn(source, 'contentRule')) {
      source.contentRule.content = TENCENT_CONTENT_RULE;
      fields.push('contentRule.content');
    }
    source.builtinVersion = 7;
    source.provenance.contentCorrection = {
      version: 1, appliedAt: '2026-10-03', previousBuiltinVersion: 6,
      previousRuleFingerprint: revision.previousFingerprint, fields,
      previousUnfingerprintedFields: { contentRule: previousAlias },
      preserveExploreRules: true,
      verification: 'captured-official-free-chapter-production-manga-parser',
      evidence: 'evidence/2026-10-03-tencent-free-picture-source/summary.json',
      note: 'Use the official nonce digit/letter token boundary with all tokens, then JSON.parse(decoded).picture. The old greedy picture regex includes the adjacent ads object and throws a JS syntax error. Public chapter 531040/1 yields 36 pages; this does not authorize paid chapters or certify VM reading acceptance. Historical verification metadata is retained separately.',
    };
    source.ruleFingerprint = ruleFingerprint(source);
    assert.equal(source.ruleFingerprint, revision.correctedFingerprint);
    return source;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert.equal(process.argv[2], '--apply', 'use --apply for deterministic builtin regeneration');
  const raw = new URL('../entry/src/main/resources/rawfile/reader-tested-book-source-collection.json', import.meta.url);
  const sources = JSON.parse(readFileSync(raw, 'utf8'));
  applyTencentPictureSourceCorrection(sources);
  const document = `${JSON.stringify(sources)}\n`;
  writeFileSync(raw, document);
  const owner = new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url);
  const text = readFileSync(owner, 'utf8');
  const marker = /const BUNDLED_RAW_FILE_SHA256 = '[0-9a-f]{64}';/;
  assert.match(text, marker);
  writeFileSync(owner, text.replace(marker,
    `const BUNDLED_RAW_FILE_SHA256 = '${sha256Hex(document)}';`));
  console.log('Tencent picture builtin correction applied; run generate-bundled-source-index.mjs');
}
