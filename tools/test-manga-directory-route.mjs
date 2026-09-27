import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';

const indexUrl = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const shellUrl = new URL('../entry/src/main/ets/features/shell/ReaderShell.ets', import.meta.url);
const Index = productionMotionMethods(indexUrl, ['onDirectoryNavigationTargetSelected', 'onDirectoryChapterSelected', 'readingReadyCallback',
  'presentPreparedReading', 'applyDirectoryChapter', 'isKnownDetailChapter', 'nextNavigationGeneration'],
  {LOCAL_SOURCE_ID: 'local'});
const entries = [0, 4, 9].map(index => ({index, title: `chapter ${index}`, url: `chapter-${index}`,
  navigable: true, downloadState: 'cached'}));
const index = Object.assign(new Index(), {
  detailBook: {sourceId: 'removed-source', bookId: 'cached-book'}, readingSessionActive: true,
  readingContentKind: 'manga', detailToc: [], remoteReadingSession: undefined,
  directoryCurrentChapterIndex: -1, directoryChapterTitle: '', route: 'reading',
  preparedReaderRoute: 'reading', requestedChapterIndex: undefined, readingReadyGeneration: 3,
  mangaChapterRequestGeneration: 0,
  mangaCommittedRequestGeneration: -1,
  navigationGeneration: 0, shelfReadingPreparation: false, startupEntryId: 0,
  scheduleNavigationBackfillAfterReady() {},
});

// Exercise actual SDK lowering of the production ForEach and child callback.
// The native view/property scheduler and image renderer are separate gates.
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const childSource = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url), 'utf8');
syntax.componentCollection.customComponents.add('MangaReadingSurface');
syntax.propCollection.set('MangaReadingSurface', new Set([...childSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
class MangaReadingSurface {
  constructor(owner, params, _storage, id) {Object.assign(this, {owner, params, id});}
}
const {owner: shell, output} = createReaderBuilderProbe(readFileSync(shellUrl, 'utf8'),
  ['mangaSurface', 'mangaIdentityKey', 'onMangaChapterReady', 'selectAdjacentMangaChapter'],
  {MangaReadingSurface, ReaderRuntimeOwner: {current: () => ({})}});
assert.match(output, /forEachUpdateFunction/);
Object.assign(shell, {
  sourceId: 'removed-source', bookId: 'cached-book', contentKind: 'manga', appThemeScheme: 'day',
  requestedChapterIndex: undefined, tocEntries: [], directoryCurrentChapterIndex: -1,
  onChapterCommitted: (chapter, title) => index.applyDirectoryChapter(chapter, title),
  onReadingReady: (chapter, sourceId, bookId, generation) => index.readingReadyCallback(sourceId, bookId, generation)(chapter),
  onSelectChapter: chapter => index.onDirectoryChapterSelected(chapter),
});
const mount = () => {
  shell.requestedChapterIndex = index.requestedChapterIndex;
  shell.requestedMangaDirectoryTargetProof = index.requestedMangaDirectoryTargetProof;
  shell.readingReadyGeneration = index.readingReadyGeneration;
  shell.mangaChapterRequestGeneration = index.mangaChapterRequestGeneration;
  shell.directoryCurrentChapterIndex = index.directoryCurrentChapterIndex;
  shell.tocEntries = index.detailToc;
  shell.mangaSurface();
  return [...shell.children.values()].at(-1).params;
};
const resume = mount();
const resumeKey = shell.mangaIdentityKey();
assert.equal(resume.chapterIndex, undefined);
resume.onChapterCommitted(4, 'chapter 4');
assert.equal(index.directoryCurrentChapterIndex, 4, 'first image before optional catalog must preserve resumed chapter');
assert.equal(index.route, 'reading');
index.detailToc = entries;
shell.tocEntries = entries;
shell.directoryCurrentChapterIndex = 4;
index.route = 'directory';
index.preparedReaderRoute = 'directory';
index.onDirectoryChapterSelected(0);
assert.equal(index.route, 'directory', 'selection stays on directory until first image readiness');
const zero = mount();
assert.notEqual(shell.mangaIdentityKey(), resumeKey, 'explicit chapter zero must replace a resume of chapter four');
assert.equal(zero.chapterIndex, 0);
resume.onChapterCommitted(4, 'late old chapter');
assert.equal(index.route, 'directory', 'old resume callback cannot exit directory');
assert.equal(index.directoryCurrentChapterIndex, 4);
zero.onChapterCommitted(4, 'wrong chapter');
assert.equal(index.route, 'directory');
zero.onChapterCommitted(0, 'chapter 0');
assert.equal(index.route, 'reading', 'first image ready returns from directory');
assert.equal(index.directoryCurrentChapterIndex, 0);

index.route = 'directory';
index.onDirectoryChapterSelected(4);
const pending = mount();
assert.equal(index.route, 'directory', 'failed preparation has no readiness signal and cannot reveal an empty reader');
const failedKey = shell.mangaIdentityKey();
index.onDirectoryChapterSelected(4);
const repeated = mount();
assert.notEqual(shell.mangaIdentityKey(), failedKey, 'retrying the same failed directory chapter starts a fresh owner');
pending.onChapterCommitted(4, 'old same-chapter attempt');
assert.equal(index.route, 'directory');
index.onDirectoryChapterSelected(0);
assert.equal(index.route, 'directory', 'returning to previous chapter while another is preparing must readmit it');
assert.equal(index.requestedChapterIndex, 0);
const returned = mount();
index.onDirectoryChapterSelected(0);
assert.equal(index.route, 'directory', 'same index as durable chapter is not ready in a new request generation');
const returnedRetry = mount();
zero.onChapterCommitted(0, 'old A→B→A attempt');
assert.equal(index.route, 'directory');
pending.onChapterCommitted(4, 'cancelled preparation');
repeated.onChapterCommitted(4, 'cancelled retry');
assert.equal(index.route, 'directory');
returned.onChapterCommitted(0, 'chapter 0');
assert.equal(index.route, 'directory');
returnedRetry.onChapterCommitted(0, 'chapter 0 retry');
assert.equal(index.route, 'reading');
index.route = 'directory';
index.onDirectoryChapterSelected(9);
const current = mount();
pending.onChapterCommitted(4, 'late failed request');
assert.equal(index.route, 'directory');
current.onChapterCommitted(9, 'chapter 9');
assert.equal(index.route, 'reading');
assert.equal(index.directoryCurrentChapterIndex, 9);

// Cached TOC remains a usable chapter list when no live source/session exists.
// Use sparse original indices and a non-navigable heading, never array offsets.
shell.directoryCurrentChapterIndex = 9;
shell.requestedChapterIndex = undefined;
index.requestedChapterIndex = undefined;
shell.tocEntries = [entries[0], {index: 2, title: 'section', navigable: false}, entries[1], entries[2]];
shell.selectAdjacentMangaChapter(-1);
assert.equal(index.requestedChapterIndex, 4);
index.route = 'directory';
const offline = mount();
offline.onChapterCommitted(4, 'cached chapter 4');
assert.equal(index.route, 'reading');
assert.equal(index.directoryCurrentChapterIndex, 4);

index.route = 'directory';
shell.sourceId = 'different-source';
offline.onChapterCommitted(4, 'stale source');
assert.equal(index.route, 'directory');
const unchanged = index.requestedChapterIndex;
offline.onChapter(1);
assert.equal(index.requestedChapterIndex, unchanged, 'late save then next-chapter callback cannot navigate another source');
shell.sourceId = 'removed-source';
shell.bookId = 'different-book';
offline.onChapterCommitted(4, 'stale book');
assert.equal(index.route, 'directory');
shell.bookId = 'cached-book';
shell.contentKind = 'text';
offline.onChapterCommitted(4, 'stale kind');
assert.equal(index.route, 'directory');
index.readingReadyGeneration++;
shell.readingReadyGeneration = index.readingReadyGeneration;
shell.contentKind = 'manga';
offline.onChapterCommitted(4, 'stale session');
assert.equal(index.route, 'directory', 'Index generation remains the second admission fence');

index.readingContentKind = 'text';
index.detailToc = [];
index.directoryCurrentChapterIndex = -1;
index.applyDirectoryChapter(4, 'unknown text chapter');
assert.equal(index.directoryCurrentChapterIndex, -1, 'novel chapter validation is unchanged');
index.readingContentKind = 'manga';
for (const invalid of [-1, NaN, 0.5]) index.applyDirectoryChapter(invalid, 'invalid');
assert.equal(index.directoryCurrentChapterIndex, -1);
index.readingSessionActive = false;
index.applyDirectoryChapter(4, 'disposed');
assert.equal(index.directoryCurrentChapterIndex, -1);
console.log('PASS actual SDK manga directory child: cold resume→chapter 0, current image readiness routing, failure/stale fences, late catalog and cached sparse chapter navigation (native scheduling/paint not tested)');

// PH42 v2 chapter starts carry their exact proof through the real SDK child;
// a failed/rejected preparation produces no readiness callback or text anchor.
index.readingSessionActive = true; index.readingContentKind = 'manga';
index.detailToc = entries; index.remoteReadingSession = undefined; index.route = 'directory';
shell.contentKind = 'manga';
const proof = {sourceId:'removed-source',bookId:'cached-book',catalogRevision:'catalog-v2',
  structureRevision:'tree-v2',rulesVersion:'rules-v2',nodeId:'chapter-4',chapterIndex:4,url:'chapter-4'};
index.requestedBookmarkAnchor = {chapterIndex:9,chapterOffset:123};
const beforeGeneration = index.mangaChapterRequestGeneration;
index.onDirectoryNavigationTargetSelected(4, 0, undefined, proof);
assert.equal(index.mangaChapterRequestGeneration, beforeGeneration + 1);
assert.equal(index.requestedBookmarkAnchor, undefined);
assert.equal(index.requestedChapterIndex, 4);
assert.equal(index.route, 'directory');
const proved = mount();
assert.deepEqual(proved.directoryTargetProof, proof);
assert.equal(proved.chapterIndex, 4);
const invalidTargets = [
  [4,1,undefined,proof], [4,0,{sourceId:'removed-source',bookId:'cached-book',chapterIndex:4},proof],
  [4,0,undefined,{...proof,sourceId:'other'}], [4,0,undefined,{...proof,bookId:'other'}],
  [4,0,undefined,{...proof,chapterIndex:9}], [4,0,undefined,undefined],
];
for (const args of invalidTargets) index.onDirectoryNavigationTargetSelected(...args);
assert.equal(index.mangaChapterRequestGeneration, beforeGeneration + 1);
assert.equal(index.route, 'directory', 'rejected Core proof has no first-image acknowledgement to leave the directory');
proved.onChapterCommitted(4, 'proved chapter');
assert.equal(index.route, 'reading', 'four-argument SDK callback must carry current source/book/session generation');
index.route = 'directory';
index.onDirectoryNavigationTargetSelected(4,0,undefined,proof);
assert.equal(index.mangaChapterRequestGeneration,beforeGeneration + 2,'even same committed chapter revalidates explicit proof');
const oldGeneration = mount();
index.readingReadyGeneration++; shell.readingReadyGeneration = index.readingReadyGeneration;
oldGeneration.onChapterCommitted(4,'stale same-book owner');
assert.equal(index.route,'directory');

// A catalog group may be a historical resume target but never an explicit pick.
const historical = {index:2,title:'historical group',url:'chapter-2',navigable:false,resumeOnly:true};
index.remoteReadingSession = {entries:[entries[0],historical,entries[1],entries[2]]};
index.requestedChapterIndex = undefined; index.directoryCurrentChapterIndex = -1;
index.applyDirectoryChapter(2,'retained historical image');
assert.equal(index.directoryCurrentChapterIndex,2);
index.onDirectoryChapterSelected(2);
assert.equal(index.requestedChapterIndex,undefined);
shell.tocEntries = index.remoteReadingSession.entries; shell.directoryCurrentChapterIndex = 2;
shell.requestedChapterIndex = undefined;
shell.selectAdjacentMangaChapter(1);
assert.equal(index.requestedChapterIndex,4,'next chapter can leave a historical group using original readable index');
assert.equal(index.requestedMangaDirectoryTargetProof,undefined,'adjacent navigation does not reuse a stale directory proof');
console.log('PASS integrated v2 manga proof routing, four-argument readiness/session fencing, no text anchor, same-chapter revalidation and resume-only group exit');
