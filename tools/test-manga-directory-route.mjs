import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {selectedProductionMethods} from './lib/selected-production-methods.mjs';
import {actualReadingEntryPresentation, bindReadingEntryFixtureFields} from './lib/reading-entry-presentation-probe.mjs';
import {actualReaderDirectoryJourney} from './lib/reader-directory-operations-probe.mjs';
import {ReaderNavigation} from '../entry/src/main/ets/app/navigation/ReaderNavigation.ts';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';

const shellUrl = new URL('../entry/src/main/ets/features/reading/ui/ReaderShell.ets', import.meta.url);
const Actions = selectedProductionMethods(new URL('../entry/src/main/ets/app/composition/ReaderReadingEntryActions.ets', import.meta.url),
  'ReaderReadingEntryActions', ['readingReadyCallback', 'presentPreparedReading', 'scheduleNavigationBackfillAfterReady']);
const Entry = actualReadingEntryPresentation();
const Journey = actualReaderDirectoryJourney();
const entries = [0, 4, 9].map(index => ({index, title: `chapter ${index}`, url: `chapter-${index}`,
  navigable: true, downloadState: 'cached'}));
const runtime = {};
const navigation = new ReaderNavigation();
navigation.show('reading');
const entry = Object.assign(new Entry(), {
  book: {sourceId: 'removed-source', bookId: 'cached-book'}, sessionActive: true, contentKind: 'manga',
  toc: [], directoryCurrentChapterIndex: -1, directoryChapterTitle: '', readyGeneration: 3,
});
// This fixture begins with a retained reader, so deferred first-open work is already complete.
entry.presentedScopeId = entry.scopeId;
const directoryNavigation = new Journey(navigation, {
  runtime: () => runtime, entry: () => entry, advance: () => navigation.advance(), bindReader() {},
}).navigationPorts();
const actions = Object.assign(new Actions(), {navigation, startup: { ready() {} }, ports: {
  runtime: () => runtime, entry: () => entry, readerExitPending: () => false,
  show: route => navigation.show(route), mounting: () => 1,
}});
const scene = {
  readingEntry: entry,
  get route() { return navigation.snapshot().route; },
  set route(route) { navigation.show(route); },
  onDirectoryNavigationTargetSelected: (chapter, offset, scope, proof) =>
    entry.selectDirectoryTarget(chapter, offset, scope, proof, directoryNavigation),
  onDirectoryChapterSelected: chapter => entry.selectDirectoryChapter(chapter, undefined, directoryNavigation),
  applyDirectoryChapter: (chapter, title) => entry.commitDirectoryChapter(runtime, chapter, title, () => {}),
};
bindReadingEntryFixtureFields(scene);

// Exercise actual SDK lowering of the production ForEach and child callback.
// The native view/property scheduler and image renderer are separate gates.
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const childSource = readFileSync(new URL('../entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets', import.meta.url), 'utf8');
syntax.componentCollection.customComponents.add('MangaReadingSurface');
syntax.propCollection.set('MangaReadingSurface', new Set([...childSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
class MangaReadingSurface {
  constructor(owner, params, _storage, id) {Object.assign(this, {owner, params, id});}
}
const {owner: shell, output} = createReaderBuilderProbe(readFileSync(shellUrl, 'utf8'),
  ['mangaSurface', 'mangaIdentityKey', 'onMangaChapterReady', 'selectAdjacentMangaChapter',
    'isMangaSurfaceCurrent', 'acceptsMangaInput', 'readingContentIsForeground'],
  {MangaReadingSurface, ReaderRuntimeOwner: {current: () => ({})}});
assert.match(output, /forEachUpdateFunction/);
Object.assign(shell, {
  sourceId: 'removed-source', bookId: 'cached-book', contentKind: 'manga', appThemeScheme: 'day',
  requestedChapterIndex: undefined, tocEntries: [], directoryCurrentChapterIndex: -1,
  visible: true, inputAllowed: true,
  onChapterCommitted: (chapter, title) => scene.applyDirectoryChapter(chapter, title),
  onReadingReady: (chapter, sourceId, bookId, generation) => actions.readingReadyCallback(sourceId, bookId, generation)(chapter),
  onSelectChapter: chapter => scene.onDirectoryChapterSelected(chapter),
});
Object.defineProperty(shell, 'route', { get: () => scene.route });
const mount = () => {
  shell.requestedChapterIndex = scene.requestedChapterIndex;
  shell.requestedMangaDirectoryTargetProof = scene.requestedMangaDirectoryTargetProof;
  shell.readingReadyGeneration = scene.readingReadyGeneration;
  shell.mangaChapterRequestGeneration = scene.mangaChapterRequestGeneration;
  shell.directoryCurrentChapterIndex = scene.directoryCurrentChapterIndex;
  shell.tocEntries = scene.detailToc;
  shell.mangaSurface();
  return [...shell.children.values()].at(-1).params;
};
const resume = mount();
const resumeKey = shell.mangaIdentityKey();
assert.equal(resume.chapterIndex, undefined);
resume.onChapterCommitted(4, 'chapter 4');
assert.equal(scene.directoryCurrentChapterIndex, 4, 'first image before optional catalog must preserve resumed chapter');
assert.equal(scene.route, 'reading');
scene.detailToc = entries;
shell.tocEntries = entries;
shell.directoryCurrentChapterIndex = 4;
scene.route = 'directory';
scene.onDirectoryChapterSelected(0);
assert.equal(scene.route, 'directory', 'selection stays on directory until first image readiness');
const zero = mount();
assert.notEqual(shell.mangaIdentityKey(), resumeKey, 'explicit chapter zero must replace a resume of chapter four');
assert.equal(zero.chapterIndex, 0);
resume.onChapterCommitted(4, 'late old chapter');
assert.equal(scene.route, 'directory', 'old resume callback cannot exit directory');
assert.equal(scene.directoryCurrentChapterIndex, 4);
zero.onChapterCommitted(4, 'wrong chapter');
assert.equal(scene.route, 'directory');
zero.onChapterCommitted(0, 'chapter 0');
assert.equal(scene.route, 'reading', 'first image ready returns from directory');
assert.equal(scene.directoryCurrentChapterIndex, 0);

scene.route = 'directory';
scene.onDirectoryChapterSelected(4);
const pending = mount();
assert.equal(scene.route, 'directory', 'failed preparation has no readiness signal and cannot reveal an empty reader');
const failedKey = shell.mangaIdentityKey();
scene.onDirectoryChapterSelected(4);
const repeated = mount();
assert.notEqual(shell.mangaIdentityKey(), failedKey, 'retrying the same failed directory chapter starts a fresh owner');
pending.onChapterCommitted(4, 'old same-chapter attempt');
assert.equal(scene.route, 'directory');
scene.onDirectoryChapterSelected(0);
assert.equal(scene.route, 'directory', 'returning to previous chapter while another is preparing must readmit it');
assert.equal(scene.requestedChapterIndex, 0);
const returned = mount();
scene.onDirectoryChapterSelected(0);
assert.equal(scene.route, 'directory', 'same index as durable chapter is not ready in a new request generation');
const returnedRetry = mount();
zero.onChapterCommitted(0, 'old A→B→A attempt');
assert.equal(scene.route, 'directory');
pending.onChapterCommitted(4, 'cancelled preparation');
repeated.onChapterCommitted(4, 'cancelled retry');
assert.equal(scene.route, 'directory');
returned.onChapterCommitted(0, 'chapter 0');
assert.equal(scene.route, 'directory');
returnedRetry.onChapterCommitted(0, 'chapter 0 retry');
assert.equal(scene.route, 'reading');
scene.route = 'directory';
scene.onDirectoryChapterSelected(9);
const current = mount();
pending.onChapterCommitted(4, 'late failed request');
assert.equal(scene.route, 'directory');
current.onChapterCommitted(9, 'chapter 9');
assert.equal(scene.route, 'reading');
assert.equal(scene.directoryCurrentChapterIndex, 9);

// Cached TOC remains a usable chapter list when no live source/session exists.
// Use sparse original indices and a non-navigable heading, never array offsets.
shell.directoryCurrentChapterIndex = 9;
shell.requestedChapterIndex = undefined;
scene.requestedChapterIndex = undefined;
shell.tocEntries = [entries[0], {index: 2, title: 'section', navigable: false}, entries[1], entries[2]];
shell.selectAdjacentMangaChapter(-1);
assert.equal(scene.requestedChapterIndex, 4);
scene.route = 'directory';
const offline = mount();
offline.onChapterCommitted(4, 'cached chapter 4');
assert.equal(scene.route, 'reading');
assert.equal(scene.directoryCurrentChapterIndex, 4);

scene.route = 'directory';
shell.sourceId = 'different-source';
offline.onChapterCommitted(4, 'stale source');
assert.equal(scene.route, 'directory');
const unchanged = scene.requestedChapterIndex;
offline.onChapter(1);
assert.equal(scene.requestedChapterIndex, unchanged, 'late save then next-chapter callback cannot navigate another source');
shell.sourceId = 'removed-source';
shell.bookId = 'different-book';
offline.onChapterCommitted(4, 'stale book');
assert.equal(scene.route, 'directory');
shell.bookId = 'cached-book';
shell.contentKind = 'text';
offline.onChapterCommitted(4, 'stale kind');
assert.equal(scene.route, 'directory');
scene.readingReadyGeneration++;
shell.readingReadyGeneration = scene.readingReadyGeneration;
shell.contentKind = 'manga';
offline.onChapterCommitted(4, 'stale session');
assert.equal(scene.route, 'directory', 'reading entry generation remains the second admission fence');

scene.readingContentKind = 'text';
scene.detailToc = [];
scene.directoryCurrentChapterIndex = -1;
scene.applyDirectoryChapter(4, 'unknown text chapter');
assert.equal(scene.directoryCurrentChapterIndex, -1, 'novel chapter validation is unchanged');
scene.readingContentKind = 'manga';
for (const invalid of [-1, NaN, 0.5]) scene.applyDirectoryChapter(invalid, 'invalid');
assert.equal(scene.directoryCurrentChapterIndex, -1);
scene.readingSessionActive = false;
scene.applyDirectoryChapter(4, 'disposed');
assert.equal(scene.directoryCurrentChapterIndex, -1);
console.log('PASS actual SDK manga directory child: cold resume→chapter 0, current image readiness routing, failure/stale fences, late catalog and cached sparse chapter navigation (native scheduling/paint not tested)');

// PH42 v2 chapter starts carry their exact proof through the real SDK child;
// a failed/rejected preparation produces no readiness callback or text anchor.
scene.readingSessionActive = true; scene.readingContentKind = 'manga';
scene.detailToc = entries; scene.remoteReadingSession = undefined; scene.route = 'directory';
shell.contentKind = 'manga';
const proof = {sourceId:'removed-source',bookId:'cached-book',catalogRevision:'catalog-v2',
  structureRevision:'tree-v2',rulesVersion:'rules-v2',nodeId:'chapter-4',chapterIndex:4,url:'chapter-4'};
scene.requestedBookmarkAnchor = {chapterIndex:9,chapterOffset:123};
const beforeGeneration = scene.mangaChapterRequestGeneration;
scene.onDirectoryNavigationTargetSelected(4, 0, undefined, proof);
assert.equal(scene.mangaChapterRequestGeneration, beforeGeneration + 1);
assert.equal(scene.requestedBookmarkAnchor, undefined);
assert.equal(scene.requestedChapterIndex, 4);
assert.equal(scene.route, 'directory');
const proved = mount();
assert.deepEqual(proved.directoryTargetProof, proof);
assert.equal(proved.chapterIndex, 4);
const invalidTargets = [
  [4,1,undefined,proof], [4,0,{sourceId:'removed-source',bookId:'cached-book',chapterIndex:4},proof],
  [4,0,undefined,{...proof,sourceId:'other'}], [4,0,undefined,{...proof,bookId:'other'}],
  [4,0,undefined,{...proof,chapterIndex:9}], [4,0,undefined,undefined],
];
for (const args of invalidTargets) scene.onDirectoryNavigationTargetSelected(...args);
assert.equal(scene.mangaChapterRequestGeneration, beforeGeneration + 1);
assert.equal(scene.route, 'directory', 'rejected Core proof has no first-image acknowledgement to leave the directory');
proved.onChapterCommitted(4, 'proved chapter');
assert.equal(scene.route, 'reading', 'four-argument SDK callback must carry current source/book/session generation');
scene.route = 'directory';
scene.onDirectoryNavigationTargetSelected(4,0,undefined,proof);
assert.equal(scene.mangaChapterRequestGeneration,beforeGeneration + 2,'even same committed chapter revalidates explicit proof');
const oldGeneration = mount();
scene.readingReadyGeneration++; shell.readingReadyGeneration = scene.readingReadyGeneration;
oldGeneration.onChapterCommitted(4,'stale same-book owner');
assert.equal(scene.route,'directory');

// A catalog group may be a historical resume target but never an explicit pick.
const historical = {index:2,title:'historical group',url:'chapter-2',navigable:false,resumeOnly:true};
scene.remoteReadingSession = {entries:[entries[0],historical,entries[1],entries[2]]};
scene.requestedChapterIndex = undefined; scene.directoryCurrentChapterIndex = -1;
scene.applyDirectoryChapter(2,'retained historical image');
assert.equal(scene.directoryCurrentChapterIndex,2);
scene.onDirectoryChapterSelected(2);
assert.equal(scene.requestedChapterIndex,undefined);
shell.tocEntries = scene.remoteReadingSession.entries; shell.directoryCurrentChapterIndex = 2;
shell.requestedChapterIndex = undefined;
shell.selectAdjacentMangaChapter(1);
assert.equal(scene.requestedChapterIndex,4,'next chapter can leave a historical group using original readable index');
assert.equal(scene.requestedMangaDirectoryTargetProof,undefined,'adjacent navigation does not reuse a stale directory proof');
console.log('PASS integrated v2 manga proof routing, four-argument readiness/session fencing, no text anchor, same-chapter revalidation and resume-only group exit');
