import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

const read = relative => readFileSync(new URL(`../entry/src/main/ets/${relative}`, import.meta.url), 'utf8');
const typographySource = read('features/common/ReaderTypography.ets');
const { TYPE_SOURCE_SWITCH_NAME, TYPE_SOURCE_SWITCH_LATENCY, TYPE_SOURCE_SWITCH_CHAPTER } =
  new Function(...Object.keys(fontFamilies), `${stripTypeScriptTypes(typographySource)
    .replace(/^import[^;]+;\s*/gm, '')
    .replace(/^export /gm, '')}; return { TYPE_SOURCE_SWITCH_NAME, TYPE_SOURCE_SWITCH_LATENCY, TYPE_SOURCE_SWITCH_CHAPTER };`)(
      ...Object.values(fontFamilies));
const row = read('features/source/CandidateRow.ets');

assert.deepEqual(
  [TYPE_SOURCE_SWITCH_NAME, TYPE_SOURCE_SWITCH_LATENCY, TYPE_SOURCE_SWITCH_CHAPTER].map(style => ({
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSizeFp: style.fontSizeFp,
    lineHeightFp: style.lineHeightFp,
  })),
  [
    { fontFamily: 'ReaderInter', fontWeight: 500, fontSizeFp: 10, lineHeightFp: 12 },
    { fontFamily: 'ReaderInter', fontWeight: 400, fontSizeFp: 9, lineHeightFp: 10 },
    { fontFamily: 'ReaderInter', fontWeight: 500, fontSizeFp: 9, lineHeightFp: 10 },
  ],
  'source-switch roles preserve the existing compact text tuples',
);

for (const role of ['TYPE_SOURCE_SWITCH_NAME', 'TYPE_SOURCE_SWITCH_LATENCY', 'TYPE_SOURCE_SWITCH_CHAPTER']) {
  assert.match(row, new RegExp(`${role}\\.fontFamily`));
  assert.match(row, new RegExp(`${role}\\.fontWeight`));
  assert.match(row, new RegExp(`${role}\\.fontSizeFp`));
  assert.match(row, new RegExp(`${role}\\.lineHeightFp`));
}
assert.doesNotMatch(row, /fontFamily\('ReaderInter'\)/,
  'CandidateRow no longer owns a physical font family literal');
assert.doesNotMatch(row, /fontSize\((?:9|10)\)\.lineHeight\((?:10|12)\)/,
  'CandidateRow no longer owns the compact text tuple inline');

console.log('PASS source-switch candidate text uses shared ReaderTypography roles');
