import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  READER_LOCAL_BOOK_FORMAT_ADMISSIONS,
  READER_LOCAL_BOOK_PICKER_FILTER,
} from '../entry/src/main/ets/app/ReaderLocalBookFormatAdmission.ts';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const dialog = read('entry/src/main/ets/features/bookshelf/LocalImportDialog.ets');
const gateway = read('entry/src/main/ets/features/bookshelf/LocalBookImportGateway.ts');

const admissionByFamily = new Map(READER_LOCAL_BOOK_FORMAT_ADMISSIONS.map(
  (entry) => [entry.family, entry],
));
assert.deepEqual(Array.from(admissionByFamily.keys()),
  ['TXT', 'EPUB', 'MOBI', 'AZW', 'UMD', 'PDF', 'HTML', 'ARCHIVE', 'WEBDAV'],
  'the product matrix must account for every audited local or remote-file family');
assert.deepEqual(READER_LOCAL_BOOK_FORMAT_ADMISSIONS
  .filter((entry) => entry.state === 'l0')
  .map((entry) => entry.family), ['TXT', 'EPUB', 'MOBI', 'AZW'],
  'the product picker must admit every format with a complete Core and Host lifecycle');
assert.equal(admissionByFamily.get('UMD')?.state, 'deferred-partial');
for (const family of ['PDF', 'HTML', 'ARCHIVE', 'WEBDAV']) {
  assert.equal(admissionByFamily.get(family)?.state, 'not-admitted');
}
assert.equal(READER_LOCAL_BOOK_PICKER_FILTER,
  'TXT、EPUB、MOBI、AZW3|.txt,.epub,.mobi,.azw,.azw3,.kf8');
assert.match(host, /fileSuffixFilters = \[\s*READER_LOCAL_BOOK_PICKER_FILTER,\s*\]/,
  'the Host picker must consume the product admission filter');

for (const label of ['TXT', 'EPUB']) {
  assert.match(dialog, new RegExp(`formatBadge\\('${label}'`),
    `the import surface must disclose admitted ${label} support`);
}
for (const label of ['UMD']) {
  assert.doesNotMatch(dialog, new RegExp(`formatBadge\\('${label}'`),
    `the import surface must not advertise deferred ${label} support`);
}
for (const label of ['MOBI', 'AZW3']) {
  assert.match(dialog, new RegExp(`formatBadge\\('${label}'`),
    `the import surface must advertise admitted ${label} support`);
}
assert.match(dialog, /支持多选 TXT、EPUB、MOBI、AZW3/);
assert.match(gateway, /request\('import\.parse'/);
assert.match(gateway, /request\('import\.persist'/);
assert.match(gateway, /filePath: input\.stagedPath/,
  'admitted formats must continue through the Core-owned parser instead of an ArkUI parser');
assert.match(dialog, /Stack\(\{ alignContent: Alignment\.Center \}\)/,
  'the import panels must be centered in the actual Phone or Tablet viewport');
assert.doesNotMatch(dialog, /\.position\(\{ x: 20, y:/,
  'the Phone Figma coordinates must not clip the result action on a shorter Tablet viewport');

console.log('local book format picker contract: PASS');
