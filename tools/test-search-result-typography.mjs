import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

const read = relative => readFileSync(new URL(`../entry/src/main/ets/${relative}`, import.meta.url), 'utf8');
const typographySource = read('features/common/ReaderTypography.ets');
const roles = [
  'TYPE_SEARCH_RESULT_COVER_TITLE',
  'TYPE_SEARCH_RESULT_TITLE',
  'TYPE_SEARCH_RESULT_AUTHOR',
  'TYPE_SEARCH_RESULT_CHAPTER',
  'TYPE_SEARCH_RESULT_INTRO',
  'TYPE_SEARCH_RESULT_TAG',
];
const evaluator = new Function(...Object.keys(fontFamilies), `${stripTypeScriptTypes(typographySource)
  .replace(/^import[^;]+;\s*/gm, '')
  .replace(/^export /gm, '')}; return { ${roles.join(', ')} };`);
const typography = evaluator(...Object.values(fontFamilies));

assert.deepEqual(
  roles.map(role => {
    const style = typography[role];
    return [style.fontFamily, style.fontWeight, style.fontSizeFp, style.lineHeightFp];
  }),
  [
    ['ReaderNotoSerifSCBold', 700, 9, 11.7],
    ['ReaderNotoSerifSCBold', 700, 15, 19.5],
    ['ReaderInter', 400, 12, 12],
    ['ReaderInter', 400, 11, 11],
    ['ReaderInter', 400, 12, 18],
    ['ReaderInter', 700, 10, 15],
  ],
  'search result roles preserve the current card typography tuples',
);

const page = read('features/search/SearchPage.ets');
const cardStart = page.indexOf('struct SearchResultCard');
assert.ok(cardStart >= 0, 'SearchResultCard remains discoverable');
const card = page.slice(cardStart);
for (const role of roles) {
  assert.match(card, new RegExp(`${role}\\.fontFamily`), `${role} owns the result font family`);
  assert.match(card, new RegExp(`${role}\\.fontWeight`), `${role} owns the result weight`);
  assert.match(card, new RegExp(`${role}\\.fontSizeFp`), `${role} owns the result size`);
  assert.match(card, new RegExp(`${role}\\.lineHeightFp`), `${role} owns the result line box`);
}
assert.equal((card.match(/TYPE_SEARCH_RESULT_TAG\.fontFamily/g) ?? []).length, 3,
  'one tag role is shared by source, count and bookshelf badges');
assert.doesNotMatch(card, /fontFamily\('(ReaderInter|ReaderNotoSerifSCBold)'\)/,
  'SearchResultCard no longer owns physical font family literals');
assert.doesNotMatch(card, /fontSize\((?:9|10|11|12|15)\)\s*\.lineHeight\((?:11|11\.7|12|15|18|19\.5)\)/,
  'SearchResultCard no longer owns duplicated physical text tuples');

console.log('PASS search result card uses shared ReaderTypography roles without changing tuples');
