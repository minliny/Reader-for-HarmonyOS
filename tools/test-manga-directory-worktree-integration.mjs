import assert from 'node:assert/strict';
import { mangaDirectoryDisplay } from '../entry/src/main/ets/features/manga/MangaDirectoryDisplay.ts';
import { mangaDirectoryEntryRows, mangaDirectoryNodeRows } from '../entry/src/main/ets/features/manga/MangaDirectoryLayout.ts';
import { mangaDirectoryPresentation } from '../entry/src/main/ets/features/manga/MangaDirectoryPresentation.ts';
import { mangaDirectoryContextEntries, mangaDirectoryDownloadStatusText, mangaDirectoryDownloadStatusWidth } from '../entry/src/main/ets/features/manga/MangaDirectoryState.ts';
import { projectReaderDirectoryEntries } from '../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts';
import { mangaDirectoryEntryRowSdk } from './lib/manga-directory-entry-row-probe.mjs';

// The real row consumes explicit DTO facts while selection still returns the
// unchanged canonical entry. Its displayed title never becomes an identity.
const raw = { index: 325, title: '✿·第３２６话', displayTitle: '第３２６话', contextTitle: '正文 / 第二卷',
  level: 1, navigable: true, isVip: true, isPay: false, downloadState: 'paused' };
const presentation = mangaDirectoryPresentation([raw]);
const sdk = mangaDirectoryEntryRowSdk();
const selected = [];
const owner = new sdk.deps.MangaDirectoryEntryRow(undefined, { row: mangaDirectoryEntryRows([raw], presentation, false, 1, 390)[0],
  presentation, scheme: 'day', currentChapterIndex: 325, collapsedBranches: [], query: '', showContext: true,
  interactionEnabled: true, chapterDownloadEnabled: false, branchControlsEnabled: true,
  onSelectEntry: entry => selected.push(entry), onToggleBranch() {}, onDownloadEntry() {} });
owner.initialRender();
let nodes = sdk.nodes(owner);
assert.ok(nodes.some(node => node.type === 'Text' && node.create === '326'));
assert.ok(nodes.some(node => node.type === 'Text' && node.create === 'VIP · 已暂停'));
assert.ok(nodes.some(node => node.type === 'Text' && node.create === '正文 / 第二卷'));
nodes.find(node => node.accessibilityText?.includes('打开章节') && node.onClick).onClick();
assert.deepEqual(selected.map(entry => [entry.index, entry.title, entry.displayTitle]), [[325, '✿·第３２６话', '第３２６话']]);
assert.equal(raw.title, '✿·第３２６话');
for (const [state, text] of [['queued', '等待下载'], ['inProgress', '下载中'], ['paused', '已暂停'],
  ['cached', '已保存'], ['failed', '下载失败'], ['cancelled', '已取消'], ['completed', '已下载']]) {
  assert.equal(mangaDirectoryDownloadStatusText(state), text);
  const latest = { ...raw, downloadState: state, isVip: false };
  owner.updateStateVars({ row: mangaDirectoryEntryRows([latest], presentation)[0], presentation,
    scheme: 'day', currentChapterIndex: 325, collapsedBranches: [], query: '', showContext: true,
    interactionEnabled: true, chapterDownloadEnabled: false, branchControlsEnabled: true });
  sdk.properties.flush();
  assert.ok(sdk.nodes(owner).some(node => node.type === 'Text' && node.create === text), `${state} is rendered by the actual retained row`);
}
assert.equal(mangaDirectoryDownloadStatusText('completed', true), '');
assert.equal(mangaDirectoryDownloadStatusText('unknown'), '');
assert.ok(mangaDirectoryDownloadStatusWidth('paused', false, 3.2) > mangaDirectoryDownloadStatusWidth('paused', false, 1));

const entries = [
  { index: 7, title: '第二卷', level: 1, navigable: false },
  { index: 325, title: '第３２６话', level: 2, navigable: true, downloadState: 'paused' },
  { index: 487, title: '328（上）', level: 2, navigable: true },
  { index: 911, title: '328（下）', level: 2, navigable: true },
  { index: 1001, title: '329（上）', level: 2, navigable: true },
  { index: 1004, title: '329（下）', level: 2, navigable: true },
];
const facts = mangaDirectoryPresentation(entries);
const enriched = mangaDirectoryContextEntries(entries, facts);
assert.equal(enriched[1].contextTitle, '第二卷');
assert.deepEqual(projectReaderDirectoryEntries(enriched, '第二卷', true, true).map(entry => entry.index), [7, 325, 487, 911, 1001, 1004]);
const search = mangaDirectoryEntryRows(enriched, facts, false, 1, 390, 0, '第二卷');
assert.ok(search.every(row => row.kind === 'row' && row.columns === 1));
assert.deepEqual(search.flatMap(row => row.entries.map(entry => entry.index)), entries.map(entry => entry.index));
assert.equal(enriched[1].title, entries[1].title);
const parts = enriched.slice(2);
assert.deepEqual(mangaDirectoryEntryRows(parts, facts, false, 1, 540).map(row => [row.columns, row.entries.length]), [[4, 4]]);
assert.deepEqual(mangaDirectoryEntryRows(parts, facts, true, 1, 280).map(row => [row.columns, row.entries.length]), [[2, 2], [2, 2]]);
const triple = ['上', '中', '下'].map((part, ordinal) => ({ index: ordinal * 17 + 8, title: `第400章（${part}）`, level: 1, navigable: true }));
assert.deepEqual(mangaDirectoryEntryRows(triple, mangaDirectoryPresentation(triple), false, 1, 540).map(row => [row.columns, row.entries.length]), [[3, 3]]);
assert.ok(mangaDirectoryEntryRows(triple, mangaDirectoryPresentation(triple), true, 3.2, 150).every(row => row.columns === 1));
const nodesWithParent = entries.map(entry => ({ nodeId: `node-${entry.index}`, title: entry.title, displayTitle: entry.displayTitle,
  kind: entry.navigable ? 'target' : 'group', chapterIndex: entry.navigable ? entry.index : undefined,
  depth: entry.level, parentId: entry.level > 1 ? 'node-7' : undefined, hasChildren: entry.index === 7 }));
assert.ok(mangaDirectoryNodeRows(nodesWithParent, false, 0, 1, 390, 0, '第二卷').every(row => row.kind === 'row'));
assert.equal(mangaDirectoryDisplay({ title: 'canonical', displayTitle: '326', isVip: true, isPay: false }).statusText, 'VIP');
console.log('PASS worktree directory integration: actual retained SDK metadata/state/canonical click, context search, per-query rows, 2/4 pairs and 3/1 triples; no inferred targets');
