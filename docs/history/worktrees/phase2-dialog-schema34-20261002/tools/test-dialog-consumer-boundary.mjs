import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const index = read('entry/src/main/ets/pages/Index.ets');
const removal = read('entry/src/main/ets/features/bookshelf/BookRemovalDialog.ets');
const json = read('entry/src/main/ets/features/common/JsonImportDialog.ets');
const nativeHostFiles = [
  'entry/src/main/ets/pages/Index.ets',
  'entry/src/main/ets/features/settings/SettingsPage.ets',
  'entry/src/main/ets/features/source/SourceToolsPage.ets',
  'entry/src/main/ets/features/reading/LocalReadingExperience.ets',
];

const sharedConsumerCount = [index, removal, json]
  .join('\n')
  .match(/ReaderDialogSurface\s*\(\s*\{/g)?.length ?? 0;
assert.equal(sharedConsumerCount, 3, 'WP04 must retain exactly three shared app-drawn Dialog consumers');

const nativeAlertCount = nativeHostFiles
  .map(read)
  .map(source => source.match(/\.getUIContext\(\)\.showAlertDialog\s*\(/g)?.length ?? 0)
  .reduce((sum, count) => sum + count, 0);
assert.equal(nativeAlertCount, 19, 'the platform-native AlertDialog boundary must remain explicitly inventoried');

assert.match(index, /LocalImportDialog\s*\(/, 'long-running LocalImportDialog must remain routed to WP09');
console.log('dialog consumer boundary: PASS (3 shared app-drawn consumers, 19 native alert hosts, LocalImportDialog routed to WP09)');
