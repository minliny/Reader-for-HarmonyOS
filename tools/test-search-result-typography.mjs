import {approvedTypographyContract} from './lib/approved-manga-typography-carriers.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { MANGA_DIRECTORY_VISUAL } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

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
const evaluator = new Function('MANGA_DIRECTORY_VISUAL', ...Object.keys(fontFamilies), `${stripTypeScriptTypes(typographySource)
  .replace(/^import[^;]+;\s*/gm, '')
  .replace(/^export /gm, '')}; return { ${roles.join(', ')} };`);
const typography = evaluator(MANGA_DIRECTORY_VISUAL, ...Object.values(fontFamilies));

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
assert.equal((card.match(/TYPE_SEARCH_RESULT_TAG\.fontFamily/g) ?? []).length, 4,
  'one tag role is shared by the novel type, source, count and bookshelf badges');
assert.equal(approvedTypographyContract(page,'search/SearchPage.ets').registered,true,
  'approved compact type/origin chips and result carriers retain exact tuples beside public novel roles');
assert.throws(()=>approvedTypographyContract(page.replace('.fontSize(9).lineHeight(14)', '.fontSize(99).lineHeight(14)'), 'search/SearchPage.ets'),
  /exact approved typography carrier\/tuple changed/, 'a new private tuple cannot enter the approved chips');

console.log('PASS search result card uses shared ReaderTypography roles without changing tuples');
