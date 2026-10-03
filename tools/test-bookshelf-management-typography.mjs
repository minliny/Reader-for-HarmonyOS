import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

const read = relative => readFileSync(new URL(`../entry/src/main/ets/${relative}`, import.meta.url), 'utf8');
const typographySource = read('features/common/ReaderTypography.ets');
const roles = [
  'TYPE_SHELF_MANAGEMENT_NOTE',
  'TYPE_SHELF_MANAGEMENT_STATUS',
  'TYPE_SHELF_MANAGEMENT_BODY',
  'TYPE_SHELF_MANAGEMENT_BODY_MUTED',
  'TYPE_SHELF_MANAGEMENT_META',
  'TYPE_SHELF_MANAGEMENT_GROUP_TITLE',
  'TYPE_SHELF_MANAGEMENT_ROW_ACTION',
  'TYPE_SHELF_MANAGEMENT_BOOK_TITLE',
  'TYPE_SHELF_MANAGEMENT_HEADING',
  'TYPE_SHELF_MANAGEMENT_BUTTON',
  'TYPE_SHELF_MANAGEMENT_SMALL_ACTION',
];
const evaluator = new Function(...Object.keys(fontFamilies),
  `${stripTypeScriptTypes(typographySource)
    .replace(/^import[^;]+;\s*/gm, '')
    .replace(/^export /gm, '')}; return { ${roles.join(', ')} };`);
const typography = evaluator(...Object.values(fontFamilies));
const page = read('features/bookshelf/BookshelfManagementPage.ets');

const expected = {
  TYPE_SHELF_MANAGEMENT_NOTE: ['ReaderNotoSansSC', 400, 10, 16],
  TYPE_SHELF_MANAGEMENT_STATUS: ['ReaderNotoSansSC', 400, 12, 18],
  TYPE_SHELF_MANAGEMENT_BODY: ['ReaderNotoSansSC', 400, 12, undefined],
  TYPE_SHELF_MANAGEMENT_BODY_MUTED: ['ReaderNotoSansSC', 400, 11, undefined],
  TYPE_SHELF_MANAGEMENT_META: ['ReaderNotoSansSC', 400, 10, undefined],
  TYPE_SHELF_MANAGEMENT_GROUP_TITLE: ['ReaderNotoSansSC', 700, 13, undefined],
  TYPE_SHELF_MANAGEMENT_ROW_ACTION: ['ReaderNotoSansSC', 400, 11, undefined],
  TYPE_SHELF_MANAGEMENT_BOOK_TITLE: ['ReaderNotoSansSC', 700, 12, undefined],
  TYPE_SHELF_MANAGEMENT_HEADING: ['ReaderNotoSerifSCBold', 700, 16, undefined],
  TYPE_SHELF_MANAGEMENT_BUTTON: ['ReaderNotoSansSC', 700, 12, undefined],
  TYPE_SHELF_MANAGEMENT_SMALL_ACTION: ['ReaderNotoSansSC', 400, 10, undefined],
};

for (const role of roles) {
  const style = typography[role];
  assert.ok(style, `${role} exists`);
  assert.deepEqual([
    style.fontFamily,
    style.fontWeight,
    style.fontSizeFp,
    style.lineHeightFp,
  ], expected[role], `${role} preserves the existing bookshelf-management tuple`);
  assert.match(page, new RegExp(`${role}\\.fontFamily`), `${role} is consumed by the page`);
}

assert.doesNotMatch(page, /fontFamily\('Reader(?:NotoSansSC|NotoSerifSCBold)'\)/,
  'bookshelf-management page no longer owns a physical font-family literal');
assert.doesNotMatch(page, /\.fontSize\((?:10|11|12|13|16)\)/,
  'bookshelf-management page no longer owns a direct font-size tuple');

console.log('PASS bookshelf-management typography uses named ReaderTypography roles without changing tuples');
