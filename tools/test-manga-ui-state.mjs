import { mangaUsesPersistentDirectory, mangaDirectoryColumnWidth } from '../entry/src/main/ets/features/manga/MangaLayoutPolicy.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createDefaultReaderSettingsSnapshot, normalizeReaderSettingsSnapshot, copyReaderSettingsSnapshot } from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const initial = createDefaultReaderSettingsSnapshot();
const normalized = normalizeReaderSettingsSnapshot({ ...initial, mangaBackground: 'ink', mangaPageNumbers: false });
assert.equal(normalized.mangaBackground, 'ink');
assert.equal(normalized.mangaPageNumbers, false);
assert.equal(normalizeReaderSettingsSnapshot({ ...initial, mangaBackground: 'garbage', mangaPageNumbers: 'false' }).mangaBackground, undefined);
assert.equal(normalizeReaderSettingsSnapshot({ ...initial, mangaPageNumbers: 'false' }).mangaPageNumbers, undefined);
assert.equal('mangaPageNumbers' in initial, false, 'older snapshots do not fabricate an explicit manga preference');

let value = '';
let failNextFlush = false;
let holdFlush;
let enteredFlush;
let flushes = 0;
const store = {
  get: async (_key, fallback) => value || fallback,
  put: async (_key, next) => { value = next; },
  flush: async () => {
    flushes++;
    if (failNextFlush) { failNextFlush = false; throw new Error('simulated preference failure'); }
    if (holdFlush !== undefined) { const pending = holdFlush; holdFlush = undefined; enteredFlush?.(); await pending; }
  },
};
const runtimeOwner = { getUIAbilityContext: () => ({}) };
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderSettingsGateway.ts', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\s*\n/gm, '').replace(/^export /gm, '');
const Gateway = new Function('preferences', 'ReaderRuntimeOwner', 'ReaderThemeHost', 'copyReaderSettingsSnapshot',
  'createDefaultReaderSettingsSnapshot', 'normalizeReaderSettingsSnapshot',
  `${stripTypeScriptTypes(source)}; return ReaderSettingsGateway;`)(
  { getPreferences: async () => store }, { current: () => runtimeOwner }, { prepareUserChange: async () => {} },
  copyReaderSettingsSnapshot, createDefaultReaderSettingsSnapshot, normalizeReaderSettingsSnapshot);
const gateway = new Gateway(runtimeOwner);
await gateway.load();
await gateway.updateMangaPreferences({ mangaDirection: 'horizontal', mangaFit: 'contain', mangaBackground: 'ink', mangaPageNumbers: false });
await gateway.update({ ...initial, screenTimeout: 'alwaysOn' });
assert.equal(gateway.current().mangaDirection, 'horizontal');
assert.equal(gateway.current().mangaFit, 'contain');
assert.equal(gateway.current().mangaBackground, 'ink');
assert.equal(gateway.current().mangaPageNumbers, false, 'an older novel form must preserve a deliberate hidden-page setting');
assert.equal(gateway.current().screenTimeout, 'alwaysOn');
const beforeFailure = value;
failNextFlush = true;
await assert.rejects(gateway.updateMangaPreferences({ mangaFit: 'width' }), /simulated preference failure/);
assert.equal(value, beforeFailure, 'failed narrow preference write restores its previous durable payload');
assert.equal(gateway.current().mangaFit, 'contain', 'failed flush does not publish unconfirmed settings');

let release;
holdFlush = new Promise(resolve => { release = resolve; });
const flushed = new Promise(resolve => { enteredFlush = resolve; });
const beforeConcurrentFlushes = flushes;
const first = gateway.updateMangaFit('width');
await flushed;
let secondFinished = false;
const second = gateway.updateMangaPreferences({ mangaBackground: 'paper' }).then(() => { secondFinished = true; });
await new Promise(resolve => setImmediate(resolve));
assert.equal(secondFinished, false);
assert.equal(flushes, beforeConcurrentFlushes + 1, 'one shared settings queue prevents overlapping narrow writes');
release();
await Promise.all([first, second]);
assert.equal(gateway.current().mangaFit, 'width');
assert.equal(gateway.current().mangaBackground, 'paper');
assert.equal(gateway.current().mangaPageNumbers, false);
assert.equal(gateway.current().screenTimeout, 'alwaysOn', 'manga writes preserve the novel setting owner');

const Surface = productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url),
  ['adjacentChapter','pageOrdinal','openChapterEnd','seekPage']);
const chapter = { chapterIndex: 8, manifest: { chapter: { chapterId: '/8' } } };
const owner = Object.assign(new Surface(), { sourceId: 's', bookId: 'b', mounted: true, opened: true,
  horizontal: false, displayedPage: 3, horizontalPageCount: 4,
  confirmedPosition: { anchor: { ordinal: 3 } },
  controller: { chapter, totalPages: 4, setVisible: async () => {} },
  remoteSession: { contentKind: 'manga', identity: { sourceId: 's', bookId: 'b' }, entries: [
    { index: 6, title: '上一可读卷', url: '/6', navigable: true },
    { index: 7, title: '卷组标题', url: '/7', navigable: false },
    { index: 8, title: '当前话', url: '/8', navigable: true },
    { index: 9, title: '下一卷分组', url: '/9', navigable: false },
    { index: 10, title: '下一可读话', url: '/10', navigable: true },
  ] },
  data: {projection: {index: ordinal => ordinal}}, saveVisible: async () => {}, restore: () => {}, presentationGeneration: 0, layoutGeneration:0,
});
assert.equal(owner.adjacentChapter(-1).index, 6);
assert.equal(owner.adjacentChapter(1).index, 10, 'chapter-end action skips non-readable groups');
owner.remoteSession.identity.bookId = 'other';
assert.equal(owner.adjacentChapter(1), undefined, 'foreign or stale catalog cannot invent a next chapter');
owner.remoteSession.identity.bookId = 'b';
owner.confirmedPosition = undefined;
await owner.openChapterEnd();
assert.equal(owner.chapterEnd, undefined, 'unmounted/unconfirmed last pixels do not certify completion');
owner.confirmedPosition = { anchor: { ordinal: 3 } };
await owner.openChapterEnd();
assert.equal(owner.chapterEnd, true);
let setVisible;
owner.controller.setVisible = () => new Promise(resolve => { setVisible = resolve; });
let restores = 0;
owner.restore = () => { restores++; };
const seeking = owner.seekPage(2);
await new Promise(resolve => setImmediate(resolve));
owner.mounted = false;
setVisible();
await seeking;
assert.equal(restores, 0, 'late page acquisition after disposal never moves a native viewport');
console.log('PASS production manga preference migration, stale novel form preservation, write rollback/serialization, actual readable neighbors, confirmed chapter-end and disposed seek fencing');

assert.equal(mangaUsesPersistentDirectory(393,852,false),false);
assert.equal(mangaUsesPersistentDirectory(820,420,false),false,'phone landscape keeps a floating directory');
assert.equal(mangaUsesPersistentDirectory(1180,820,true),true);
assert.equal(mangaUsesPersistentDirectory(600,900,false),true);
assert.equal(mangaUsesPersistentDirectory(820,420,true),true,'platform tablet identity wins over a short-height window');
assert.equal(mangaDirectoryColumnWidth(1180),320);
assert.equal(mangaDirectoryColumnWidth(1600),360);
console.log('PASS phone portrait/landscape versus tablet directory ownership and bounded persistent column');
