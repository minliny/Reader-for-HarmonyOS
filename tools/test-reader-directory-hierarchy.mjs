import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readerDirectoryAccessibilityText, readerDirectoryIndentVp, readerDirectoryLevel } from
  '../entry/src/main/ets/features/reading/ReaderDirectoryHierarchy.ts';
import { readerControlDirectorySnapshot } from
  '../entry/src/main/ets/features/reading/ReaderControlDirectoryModel.ts';

const chapter = { index: 4, title: '一节', downloadState: 'unknown', navigable: true };
assert.equal(readerDirectoryLevel(chapter), 1);
assert.equal(readerDirectoryIndentVp(chapter), 0);
assert.equal(readerDirectoryAccessibilityText(chapter), '打开章节：一节',
  'TXT and remote entries without Core depth retain their old label');
for (const level of [0, -2, 1.5, NaN, Infinity]) {
  assert.equal(readerDirectoryLevel({ ...chapter, level }), 1);
}
assert.equal(readerDirectoryIndentVp({ ...chapter, level: 2 }), 12);
assert.equal(readerDirectoryIndentVp({ ...chapter, level: 4 }), 36);
assert.equal(readerDirectoryIndentVp({ ...chapter, level: 20 }), 36);
assert.equal(readerDirectoryAccessibilityText({ ...chapter, level: 20, navigable: false }),
  '第20级，卷标题：一节', 'visual indentation is bounded but accessibility retains source depth');

const entries = [{ ...chapter, index: 0, title: '卷', level: 1, navigable: false },
  { ...chapter, index: 1, title: '章', level: 2 },
  { ...chapter, index: 2, title: '节', level: 3 }];
const snapshot = readerControlDirectorySnapshot(entries, 'directory', '', true, 2);
assert.deepEqual(snapshot.rows.map(row => row.chapter?.level), [1, 2, 3],
  'control directory keeps Core depth through its projection');
const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
for (const name of ['FullDirectoryPanel.ets', 'ReaderDirectoryModulePanel.ets', 'ReaderDirectoryChapterRow.ets']) {
  const source = readFileSync(new URL(name, reading), 'utf8');
  assert.match(source, /readerDirectoryIndentVp\(/, `${name} displays bounded hierarchy`);
  assert.match(source, /readerDirectoryAccessibilityText\(/, `${name} announces hierarchy`);
}
const control = readFileSync(new URL('ReaderControlDirectoryContent.ets', reading), 'utf8');
assert.match(control, /ReaderDirectoryChapterRow\(\{[\s\S]*?entry: entry/,
  'control directory forwards the complete entry to the shared hierarchical row');
console.log('PASS local EPUB directory hierarchy projection, bounded indentation and accessible depth');
