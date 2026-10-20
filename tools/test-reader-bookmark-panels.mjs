import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

async function fullProjectionCase() {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const { projectReaderDirectoryEntries } = await import('../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts');
  const { projectReaderBookmarkRows, readerBookmarkLoadState } = await import('../entry/src/main/ets/features/reading/ReaderBookmarkProjection.ts');
  const Full = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/FullDirectoryPanel.ets', import.meta.url),
    'FullDirectoryPanel', ['switchTab', 'rebuildProjection', 'applySearch', 'handleControl', 'selectBookmark'],
    { projectReaderDirectoryEntries, projectReaderBookmarkRows, readerBookmarkLoadState });
  const entries = [
    { index: 1, title: 'first', bookmarks: [{ time: 1, chapterIndex: 1, chapterOffset: 23, chapterTitle: 'first', content: 'needle' }] },
    { index: 7, title: 'last', bookmarks: [{ time: 2, chapterIndex: 7, chapterOffset: 89, chapterTitle: 'last', content: 'other' }] },
  ];
  const owner = Object.assign(new Full(), { admittedEntries: entries, mangaSearch: false, ascending: true,
    searchQuery: 'needle', beginListPositioning() {}, onTabChange() {}, scheduleProjectionTopScroll() {}, navigationActive: true });
  let writtenTab;
  Object.defineProperty(owner, 'activeTab', { configurable: true, get: () => 'directory', set: value => { writtenTab = value; } });
  owner.switchTab('bookmarks');
  assert.equal(writtenTab, 'bookmarks'); assert.equal(owner.navigationActive, false);
  assert.deepEqual(owner.projectedEntries, []);
  assert.deepEqual(owner.projectedBookmarks.map(row => row.chapterOffset), [23], 'projection uses the explicit new tab despite stale reactive read');
  assert.equal(owner.bookmarkTabLoading, false);

  Object.defineProperty(owner, 'activeTab', { configurable: true, value: 'bookmarks' });
  let writtenQuery;
  Object.defineProperty(owner, 'searchQuery', { configurable: true, get: () => 'other', set: value => { writtenQuery = value; } });
  owner.searchDraft = '  needle  '; owner.applySearch();
  assert.equal(writtenQuery, 'needle'); assert.deepEqual(owner.projectedBookmarks.map(row => row.chapterOffset), [23], 'new trimmed search query is used before reactive publication');

  Object.defineProperty(owner, 'activeTab', { configurable: true, value: 'directory' });
  Object.defineProperty(owner, 'searchQuery', { configurable: true, value: '' });
  let writtenAscending;
  Object.defineProperty(owner, 'ascending', { configurable: true, get: () => true, set: value => { writtenAscending = value; } });
  owner.handleControl('sort');
  assert.equal(writtenAscending, false); assert.deepEqual(owner.projectedEntries.map(entry => entry.index), [7, 1], 'new sort value is explicit rather than reread from old state');

  const selected = [], fallback = [], scope = { sourceId: 'remote', bookId: 'book', chapterIndex: 7, version: 'v1' };
  owner.onSelectBookmark = (...args) => selected.push(args); owner.onSelectChapter = index => fallback.push(index);
  owner.selectBookmark('bookmark-7', 7, 89, scope);
  assert.deepEqual(selected, [['bookmark-7', 7, 89, scope]]); assert.deepEqual(fallback, []);
  owner.onSelectBookmark = undefined; owner.selectBookmark('bookmark-7', 7, 89, scope);
  assert.deepEqual(fallback, [7], 'only an unwired legacy owner uses chapter fallback');
}

async function bookmarkRowCase() {
  const { readFileSync } = await import('node:fs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { sampleReaderControlBookmark } = await import('../entry/src/main/ets/features/reading/ReaderControlBookmarkGeometry.ts');
  const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderBookmarkRow.ets', import.meta.url), 'utf8');
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile('ReaderBookmarkRow.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  const constants = ['BOOKMARK_ROW_HEIGHT', 'BOOKMARK_PENDING_LABEL'];
  const declarations = constants.map(name => {
    const declaration = tree.statements.find(statement => ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(variable => variable.name.getText(tree) === name));
    assert.ok(declaration, `actual row constant ${name}`);
    return declaration.getText(tree).replace(/^export\s+/, '');
  }).join('\n');
  const emitted = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2021 } }).outputText;
  const rowConstants = new Function(`${emitted}; return { ${constants.join(', ')} };`)();
  const scope = { sourceId: 'remote', bookId: 'book', chapterIndex: 7, version: 'v1' };
  for (const embedded of [false, true]) {
    const calls = [];
    const { owner } = createReaderBuilderProbe(source, ['build', 'motionBody', 'legacyBody', 'frame'], { sampleReaderControlBookmark, ...rowConstants });
    Object.assign(owner, { embeddedInControl: embedded, motionProgress: 1, availableWidth: 316, appThemeScheme: 'day',
      row: { bookmarkId: 'bookmark-7', identityStatus: 'confirmed', chapterIndex: 7, chapterOffset: 89,
        positionScope: scope, chapterTitle: 'chapter seven', excerpt: 'actual excerpt', positionLabel: '42%', timeLabel: 'known time' },
      onSelectBookmark: (...args) => calls.push(args),
    });
    owner.initialRender(); const nodes = [...owner.nodes.values()];
    const clickable = nodes.filter(node => typeof node.onClick === 'function');
    assert.equal(clickable.length, 1, 'one exact-anchor row action'); clickable[0].onClick();
    assert.deepEqual(calls, [['bookmark-7', 7, 89, scope]]);
    for (const value of ['chapter seven', 'actual excerpt', '42%', 'known time'])
      assert.ok(nodes.some(node => node.type === 'Text' && node.create === value), `actual row field ${value}`);
  }
}

const cases = { 'full-projection': fullProjectionCase, 'row-anchor': bookmarkRowCase };
for (const id of selectContractCases({
  'full-projection': { description: 'Actual reachable FullDirectoryPanel tab/query/sort projection under stale reactive reads and exact selection', resources: [] },
  'row-anchor': { description: 'Actual SDK bookmark row fields and ID/chapter/offset/scope callback in embedded and full-directory forms', resources: [] },
})) { await cases[id](); recordContractCasePass(id); }
