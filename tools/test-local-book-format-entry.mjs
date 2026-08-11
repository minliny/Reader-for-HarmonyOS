import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const dialog = read('entry/src/main/ets/features/bookshelf/LocalImportDialog.ets');
const gateway = read('entry/src/main/ets/features/bookshelf/LocalBookImportGateway.ts');

assert.match(host, /\.txt,\.epub,\.mobi,\.azw,\.azw3,\.kf8,\.umd/,
  'the system picker must expose every Core-supported local-book family, including UMD');
for (const label of ['TXT', 'EPUB', 'MOBI', 'AZW', 'UMD']) {
  assert.match(dialog, new RegExp(`formatBadge\\('${label}'`),
    `the import surface must disclose ${label} support`);
}
assert.match(gateway, /request\('import\.parse'/);
assert.match(gateway, /request\('import\.persist'/);
assert.match(gateway, /filePath: input\.stagedPath/,
  'all formats must continue through the Core-owned parser instead of an ArkUI parser');

console.log('local book format picker contract: PASS');
