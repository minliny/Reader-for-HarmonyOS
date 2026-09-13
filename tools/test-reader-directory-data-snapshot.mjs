import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const base = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const source = fs.readFileSync(new URL('ReaderDirectoryDataSnapshot.ts', base), 'utf8');
const { snapshotReaderDirectoryData: copy, sameReaderDirectoryData: same } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const initial = [{ index: 1, title: 'chapter', downloadState: 'completed', bookmarks: [
  { time: 10, chapterIndex: 1, chapterOffset: 20, chapterTitle: 'chapter', content: 'bookmark' },
] }, { index: 2, title: 'next', downloadState: 'missing' }];
const saved = copy(initial);
assert.ok(same(saved, initial));
assert.ok(same(saved, structuredClone(initial)), 'equal cloned props do not remount');
for (const key of ['index', 'title', 'downloadState']) {
  const changed = structuredClone(initial);
  changed[0][key] = typeof changed[0][key] === 'number' ? 99 : 'changed';
  assert.equal(same(saved, changed), false, `${key} remains business-significant`);
}
for (const key of ['time', 'chapterIndex', 'chapterOffset', 'chapterTitle', 'content']) {
  const changed = structuredClone(initial);
  changed[0].bookmarks[0][key] = typeof changed[0].bookmarks[0][key] === 'number' ? 99 : 'changed';
  assert.equal(same(saved, changed), false, `bookmark ${key} remains significant`);
}
assert.equal(same(saved, [...initial].reverse()), false);
assert.equal(same(saved, initial.slice(0, 1)), false);
const admittedEmpty = structuredClone(initial);
admittedEmpty[1].bookmarks = [];
assert.equal(same(saved, admittedEmpty), false, 'unknown bookmarks differ from confirmed empty');
initial[0].bookmarks[0].content = 'in-place change';
assert.equal(same(saved, initial), false, 'same-reference nested edits cannot evade snapshot');
assert.equal(saved[0].bookmarks[0].content, 'bookmark');
const panel = fs.readFileSync(new URL('FullDirectoryPanel.ets', base), 'utf8');
const handler = panel.slice(panel.indexOf('private onEntriesChanged()'), panel.indexOf('private onReadingAnchorChanged()'));
assert.ok(handler.indexOf('sameReaderDirectoryData') < handler.indexOf('scheduleDeferredMutationFlush'),
  'equality guard precedes queueing a projection mutation');
assert.doesNotMatch(handler, /this\.rebuildProjection|this\.beginListPositioning|this\.activeTab\s*=/,
  'entries watch callback cannot remount or mutate @State during render');
assert.match(panel, /private flushDeferredMutations\(\): void \{[\s\S]*?sameReaderDirectoryData\(/,
  'the deferred endpoint flush performs the admitted-data equality check');
assert.match(panel, /aboutToAppear\(\): void \{[\s\S]*?this\.admittedEntries = snapshotReaderDirectoryData\(this\.entries\)/);
console.log('reader directory business-value snapshot and no-op prop refresh: PASS (native scroll still separate)');

const headings = [{ index: 0, title: 'Volume', downloadState: 'unknown', navigable: false }, { index: 1, title: 'Chapter', downloadState: 'cached' }];
const headingsSnapshot = copy(headings);
assert.equal(headingsSnapshot[0].navigable, false);
assert.equal(headingsSnapshot[1].index, 1);
assert.equal(same(headingsSnapshot, headings), true);
headings[0].navigable = true;
assert.equal(same(headingsSnapshot, headings), false, 'a heading becoming readable must refresh the row actions');
