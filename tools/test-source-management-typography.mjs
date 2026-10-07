import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { MANGA_DIRECTORY_VISUAL } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

const read = relative => readFileSync(new URL(`../entry/src/main/ets/${relative}`, import.meta.url), 'utf8');
const typographySource = read('features/common/ReaderTypography.ets');
const { TYPE_SOURCE_MANAGEMENT_META } = new Function('MANGA_DIRECTORY_VISUAL', ...Object.keys(fontFamilies),
  `${stripTypeScriptTypes(typographySource)
    .replace(/^import[^;]+;\s*/gm, '')
    .replace(/^export /gm, '')}; return { TYPE_SOURCE_MANAGEMENT_META };`)(
      MANGA_DIRECTORY_VISUAL, ...Object.values(fontFamilies));
const page = read('features/source/SourceManagementPage.ets');
const rowStart = page.indexOf('private sourceRow(source: BookSource)');
const rowEnd = page.indexOf('private detectButton(source: BookSource)', rowStart);
assert.ok(rowStart >= 0 && rowEnd > rowStart, 'source row builder remains discoverable');
const row = page.slice(rowStart, rowEnd);

assert.deepEqual({
  fontFamily: TYPE_SOURCE_MANAGEMENT_META.fontFamily,
  fontWeight: TYPE_SOURCE_MANAGEMENT_META.fontWeight,
  fontSizeFp: TYPE_SOURCE_MANAGEMENT_META.fontSizeFp,
  lineHeightFp: TYPE_SOURCE_MANAGEMENT_META.lineHeightFp,
}, {
  fontFamily: 'ReaderNotoSansSC',
  fontWeight: 400,
  fontSizeFp: 10,
  lineHeightFp: 12.5,
}, 'source-row metadata role preserves the existing tuple');

for (const property of ['fontFamily', 'fontWeight', 'fontSizeFp', 'lineHeightFp']) {
  assert.equal((row.match(new RegExp(`TYPE_SOURCE_MANAGEMENT_META\\.${property}`, 'g')) ?? []).length,
    3,
    `${property} is shared by category, URL and check summary`);
}
assert.match(row, /Text\(readerSourceCategoryLabel\(source\.category\)\)[\s\S]*TYPE_SOURCE_MANAGEMENT_META/);
assert.match(row, /Text\(source\.baseUrl\)[\s\S]*TYPE_SOURCE_MANAGEMENT_META/);
assert.match(row, /Text\(source\.checkMessage\)[\s\S]*TYPE_SOURCE_MANAGEMENT_META/);
assert.doesNotMatch(row, /fontFamily\('ReaderNotoSansSC'\)[\s\S]*fontSize\(10\)[\s\S]*lineHeight\(12\.5\)/,
  'source-row metadata no longer owns a duplicated physical tuple');

console.log('PASS source-management metadata uses one shared ReaderTypography role');
