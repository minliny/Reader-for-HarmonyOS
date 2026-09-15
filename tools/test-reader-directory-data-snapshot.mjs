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

const scoped = [{index:0,title:'章',bookmarks:[{time:3,chapterIndex:0,chapterOffset:12,chapterTitle:'章',content:'旧备注',bookText:'刷新前原文',
 positionScope:{sourceId:'s',bookId:'b',chapterIndex:0,bodyVersion:'body-old',processingVersion:'processing-old'}}]}];
const scopedSnapshot=copy(scoped);
assert.equal(scopedSnapshot[0].bookmarks[0].bookText,'刷新前原文','admitted full-directory snapshot preserves original excerpt');
assert.deepEqual(scopedSnapshot[0].bookmarks[0].positionScope,scoped[0].bookmarks[0].positionScope);
assert.notEqual(scopedSnapshot[0].bookmarks[0].positionScope,scoped[0].bookmarks[0].positionScope,'proof is copied rather than aliased');
for(const field of ['sourceId','bookId','chapterIndex','bodyVersion','processingVersion']){
 const changed=structuredClone(scoped);changed[0].bookmarks[0].positionScope[field]=field==='chapterIndex'?1:'changed';
 assert.equal(same(scopedSnapshot,changed),false,`scope-only ${field} update changes projection`);
}
const missingScope=structuredClone(scoped);delete missingScope[0].bookmarks[0].positionScope;
assert.equal(same(scopedSnapshot,missingScope),false,'withdrawing an unprovable old scope updates the clickable row');
const excerptOnly=structuredClone(scoped);excerptOnly[0].bookmarks[0].bookText='可靠映射后的原文';
assert.equal(same(scopedSnapshot,excerptOnly),false,'excerpt-only changes refresh the visible row');
scoped[0].bookmarks[0].positionScope.bodyVersion='body-new';
assert.equal(scopedSnapshot[0].bookmarks[0].positionScope.bodyVersion,'body-old');
assert.equal(same(scopedSnapshot,scoped),false,'in-place proof change cannot evade comparison');
console.log('PASS complete bookmark excerpt/proof snapshots, every scope field, removal, excerpt-only and in-place updates');

// Real FullDirectoryPanel methods: a proof-only change queues one safe
// endpoint rebuild, preserving quote and click scope, without changing offset.
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const {projectReaderBookmarkRows,readerBookmarkLoadState}=await import('../entry/src/main/ets/features/reading/ReaderBookmarkProjection.ts');
const {projectReaderDirectoryEntries}=await import('../entry/src/main/ets/features/reading/ReaderDirectoryProjection.ts');
const Panel=productionMotionMethods(new URL('FullDirectoryPanel.ets',base),['onEntriesChanged','flushDeferredMutations','rebuildProjection'],{
 sameReaderDirectoryData:same,snapshotReaderDirectoryData:copy,projectReaderBookmarkRows,readerBookmarkLoadState,projectReaderDirectoryEntries});
let scheduled=0,progress=0.5,restoredOffset;
const p=Object.assign(new Panel(),{positioningMounted:true,embeddedInControl:true,entries:scopedSnapshot,admittedEntries:copy(scopedSnapshot),
 bookmarkIdentity:{libraryBookId:'lib',sourceId:'s',bookId:'b',bookName:'书',bookAuthor:'作者'},activeTab:'bookmarks',initialTab:'bookmarks',ascending:true,searchQuery:'',
 projectionScrollGeneration:0,listPositioning:{status:'positioned'},lastListSessionKey:'book',awaitingReadingAnchor:false,
 scheduleDeferredMutationFlush:()=>scheduled++,controlProgress:()=>progress,applyMotionProgress:()=>{},readListOffset:()=>42,scheduleRetainedOffset:value=>restoredOffset=value});
p.rebuildProjection('bookmarks',true,'');assert.equal(p.projectedBookmarks[0].excerpt,'刷新前原文');assert.equal(p.projectedBookmarks[0].positionStatus,'confirmed');
p.entries=missingScope;p.onEntriesChanged();assert.equal(scheduled,1);
p.flushDeferredMutations();assert.ok(p.projectedBookmarks[0].positionScope,'active morph keeps the admitted tree stable');
progress=1;p.flushDeferredMutations();assert.equal(p.projectedBookmarks[0].positionScope,undefined);
assert.equal(p.projectedBookmarks[0].positionLabel,'位置待恢复');assert.equal(p.projectedBookmarks[0].excerpt,'刷新前原文');
assert.equal(p.projectedBookmarks[0].chapterOffset,12);assert.equal(p.projectionScrollGeneration,1);assert.equal(restoredOffset,42);
p.entries=copy(missingScope);p.onEntriesChanged();assert.equal(scheduled,1,'equal clone does not create another rebuild');
p.entries=excerptOnly;p.onEntriesChanged();p.flushDeferredMutations();
assert.equal(p.projectedBookmarks[0].excerpt,'可靠映射后的原文');assert.deepEqual(p.projectedBookmarks[0].positionScope,excerptOnly[0].bookmarks[0].positionScope);
console.log('PASS real FullDirectoryPanel deferred scope/quote-only update retains viewport, keeps morph tree stable, and updates exact click proof at the endpoint');
