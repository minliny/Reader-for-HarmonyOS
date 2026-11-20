// Explicit issue-local syntax evidence; no default gate or full semantic build.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolveEtsLoaderRoot, virtualFilePath} from '../../lib/tool-environment.mjs';
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const {compilerOptions} = require(`${sdk}/lib/ets_checker.js`);
const files = process.argv.length > 2 ? process.argv.slice(2) : [
  'common/AppTopBar.ets', 'common/PageBackBar.ets', 'common/ReaderPageScaffold.ets',
  'common/ReaderChoiceRow.ets', 'common/ReaderInlineSelect.ets', 'common/ReaderSelect.ets',
  'common/ReaderSelectPanel.ets', 'common/ReaderSelectGeometry.ts',
  'bookshelf/BookshelfShell.ets', 'bookshelf/LocalBookDetail.ets', 'bookshelf/BookDirectoryPage.ets',
  'manga/MangaDirectoryCurrentFooter.ets', 'manga/MangaReadingSurface.ets',
  'reading/ReaderControlPanel.ets', 'reading/ReaderControlTtsContent.ets', 'reading/ReaderTtsConfigOverlay.ets',
  'downloads/SharedDownloadPage.ets', 'source/SourceManagementPage.ets',
];
for (const file of files) {
  const source = readFileSync(new URL('../../../entry/src/main/ets/features/' + file, import.meta.url), 'utf8');
  const tree = ts.createSourceFile(virtualFilePath(file), source, ts.ScriptTarget.Latest, true,
    file.endsWith('.ets') ? ts.ScriptKind.ETS : ts.ScriptKind.TS, compilerOptions);
  assert.deepEqual(tree.parseDiagnostics.map(d => ({start:d.start,message:ts.flattenDiagnosticMessageText(d.messageText,' ')})), [], file);
}
console.log(`PASS issue-local installed SDK syntax: ${files.length} directly changed source files`);
