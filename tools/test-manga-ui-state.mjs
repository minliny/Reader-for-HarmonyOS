import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "manga-preferences": {
    "description": "Real brightness Slider intent and SettingsGateway writes; native input and preferences are controlled ports",
    "resources": []
  },
  "chapter-action-admission": {
    "description": "Actual Surface chapter and late seek admission with fake controller",
    "resources": []
  },
  "layout-policy": {
    "description": "Pure phone/tablet directory policy boundaries; no device geometry claim",
    "resources": []
  }
};

async function case_manga_preferences() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { readerHostPreferencesName } = await import('../entry/src/main/ets/app/diagnostics/ReaderPublicFixtureScope.ts');
const { createDefaultReaderSettingsSnapshot, normalizeReaderSettingsSnapshot, copyReaderSettingsSnapshot } = await import('../entry/src/main/ets/features/reading/application/ReaderSettingsState.ts');
const { runtimeOwnerIdentityProbe } = await import('./lib/reader-runtime-admission-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { readerBrightnessWindowValue } = await import('../entry/src/main/ets/features/reading/ui/ReaderBrightnessCurve.ts');
const slider = { Begin: 'begin', Moving: 'moving', End: 'end', Click: 'click' };
const brightnessRequests = [];
const Brightness = productionMotionMethods(new URL('../entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets', import.meta.url),
  ['changeBrightnessSlider', 'setBrightness'], { SliderChangeMode: slider, readerBrightnessWindowValue,
    ReaderWindowCoordinator: { brightness: () => ({ request: async (owner, value) => brightnessRequests.push([owner, value]) }) } });
const brightness = Object.assign(new Brightness(), { mounted: true, brightnessOwner: 14, brightnessGeneration: 0,
  automaticBrightness: true, brightnessPercent: 50,
  preferencePanelInputCurrent: (opening, panel) => opening === 3 && panel === 'settings' });
brightness.changeBrightnessSlider(66, slider.Begin, 3);
brightness.changeBrightnessSlider(66, slider.Click, 3);
brightness.changeBrightnessSlider(66, slider.End, 3);
brightness.changeBrightnessSlider(66, slider.Moving, 2);
assert.equal(brightness.automaticBrightness, true);
assert.deepEqual(brightnessRequests, [], 'passive events and retired panels never replace automatic brightness');
brightness.changeBrightnessSlider(66, slider.Moving, 3);
brightness.changeBrightnessSlider(66, slider.End, 3);
assert.equal(brightness.automaticBrightness, false);
assert.equal(brightness.brightnessPercent, 66);
assert.deepEqual(brightnessRequests, [[14, readerBrightnessWindowValue(66)]], 'actual drag switches to manual once');
brightness.changeBrightnessSlider(74, slider.Click, 3);
assert.equal(brightness.brightnessPercent, 74, 'manual brightness still admits direct tap adjustment');
const initial = createDefaultReaderSettingsSnapshot();
const normalized = normalizeReaderSettingsSnapshot({ ...initial, mangaBackground: 'ink', mangaPageNumbers: false });
assert.equal(normalized.mangaBackground, 'ink');
assert.equal(normalized.mangaPageNumbers, false);
assert.equal(normalizeReaderSettingsSnapshot({ ...initial, mangaBackground: 'garbage', mangaPageNumbers: 'false' }).mangaBackground, undefined);
assert.equal(normalizeReaderSettingsSnapshot({ ...initial, mangaPageNumbers: 'false' }).mangaPageNumbers, undefined);
assert.equal('mangaPageNumbers' in initial, false, 'older snapshots do not fabricate an explicit manga preference');

let value = '';
let durableValue = '';
const puts = [];
let failNextFlush = false;
let holdFlush;
let enteredFlush;
let flushes = 0;
const store = {
  get: async (_key, fallback) => value || fallback,
  put: async (_key, next) => { puts.push(next); value = next; },
  flush: async () => {
    flushes++;
    if (failNextFlush) { failNextFlush = false; throw new Error('simulated preference failure'); }
    if (holdFlush !== undefined) { const pending = holdFlush; holdFlush = undefined; enteredFlush?.(); await pending; }
    durableValue = value;
  },
};
const runtimeOwner = { getUIAbilityContext: () => ({ filesDir: '/reader-fixture' }) };
const source = readFileSync(new URL('../entry/src/main/ets/features/reading/application/ReaderSettingsGateway.ts', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?;\s*\n/gm, '').replace(/^export /gm, '');
const Gateway = new Function('preferences', 'ReaderRuntimeOwner', 'ReaderThemeHost', 'copyReaderSettingsSnapshot',
  'createDefaultReaderSettingsSnapshot', 'normalizeReaderSettingsSnapshot', 'readerHostPreferencesName',
  `${stripTypeScriptTypes(source)}; return ReaderSettingsGateway;`)(
  { getPreferences: async () => store }, runtimeOwnerIdentityProbe(() => runtimeOwner), { prepareUserChange: async () => {} },
  copyReaderSettingsSnapshot, createDefaultReaderSettingsSnapshot, normalizeReaderSettingsSnapshot, readerHostPreferencesName);
const gateway = new Gateway(runtimeOwner);
await gateway.load();
await gateway.updateMangaPreferences({ mangaDirection: 'horizontal', mangaFit: 'contain', mangaBackground: 'ink', mangaPageNumbers: false });
await gateway.update({ ...initial, screenTimeout: 'alwaysOn' });
assert.equal(gateway.current().mangaDirection, 'horizontal');
assert.equal(gateway.current().mangaFit, 'contain');
assert.equal(gateway.current().mangaBackground, 'ink');
assert.equal(gateway.current().mangaPageNumbers, false, 'an older novel form must preserve a deliberate hidden-page setting');
assert.equal(gateway.current().screenTimeout, 'alwaysOn');
const beforeFailure = durableValue;
const beforeFailurePuts = puts.length;
failNextFlush = true;
await assert.rejects(gateway.updateMangaPreferences({ mangaFit: 'width' }), /simulated preference failure/);
assert.equal(durableValue, beforeFailure, 'a failed flush does not certify a new durable payload');
assert.equal(puts.length, beforeFailurePuts + 1, 'unknown flush never dispatches an old compensation write');
assert.equal(JSON.parse(value).mangaFit, 'width');
assert.equal(gateway.current().mangaFit, 'width', 'the accepted user choice survives an unknown flush');
assert.equal(gateway.writeFacts().saved.mangaFit, 'contain');
assert.equal(gateway.writeFacts().pendingReconciliation, true);
assert.ok(gateway.writeFacts().acceptedRevision > gateway.writeFacts().savedRevision);
await gateway.retryAccepted();
assert.equal(gateway.writeFacts().pendingReconciliation, false);
assert.equal(gateway.writeFacts().saved.mangaFit, 'width');
assert.equal(JSON.parse(durableValue).mangaFit, 'width', 'finite retry confirms the same accepted choice');

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

}

async function case_chapter_action_admission() {
const { default: assert } = await import('node:assert/strict');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const Surface = productionMotionMethods(new URL('../entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets', import.meta.url),
  ['adjacentChapter','pageOrdinal','openChapterEnd','seekPage','nativeImageFailures','nativeFailureKey','wholeImageUnavailable','unavailableMarkerTile']);
const chapter = { chapterIndex: 8, manifest: { chapter: { sourceId: 's', bookId: 'b', chapterId: '/8' } } };
const owner = Object.assign(new Surface(), { sourceId: 's', bookId: 'b', mounted: true, opened: true,
  appForeground: true, windowChromeActive: true, interactionBlocked: false, pageTurnInputRevision: 0,
  horizontal: false, displayedPage: 3, horizontalPageCount: 4,
  confirmedPosition: { anchor: { ordinal: 3 } },
  controller: { chapter, totalPages: 4, tile: () => undefined, visiblePages: () => [], setVisible: async () => {} },
  remoteSession: { contentKind: 'manga', identity: { sourceId: 's', bookId: 'b' }, entries: [
    { index: 6, title: '上一可读卷', url: '/6', navigable: true },
    { index: 7, title: '卷组标题', url: '/7', navigable: false },
    { index: 8, title: '当前话', url: '/8', navigable: true },
    { index: 9, title: '下一卷分组', url: '/9', navigable: false },
    { index: 10, title: '下一可读话', url: '/10', navigable: true },
  ] },
  data: {projection: {index: ordinal => ordinal}, totalCount: () => 4,
    getData: index => ({key: `fixture:${index}`, ordinal: index, tileIndex: 0, known: false, width: 600, height: 800, sourceY: 0, sourceHeight: 800}), notify() {}},
  saveVisible: async () => {}, restore: () => {}, presentationGeneration: 0, layoutGeneration:0,
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
console.log('PASS production manga preference migration, stale novel form preservation, accepted/saved unknown-ACK reconciliation and serialization, actual readable neighbors, confirmed chapter-end and disposed seek fencing');

}

async function case_layout_policy() {
const { default: assert } = await import('node:assert/strict');
const { mangaUsesPersistentDirectory, mangaDirectoryColumnWidth } = await import('../entry/src/main/ets/features/manga/ui/MangaLayoutPolicy.ts');
assert.equal(mangaUsesPersistentDirectory(393,852,false),false);
assert.equal(mangaUsesPersistentDirectory(820,420,false),false,'phone landscape keeps a floating directory');
assert.equal(mangaUsesPersistentDirectory(1180,820,true),true);
assert.equal(mangaUsesPersistentDirectory(600,900,false),true);
assert.equal(mangaUsesPersistentDirectory(820,420,true),true,'platform tablet identity wins over a short-height window');
assert.equal(mangaDirectoryColumnWidth(700),168);
assert.equal(mangaDirectoryColumnWidth(701),258);
assert.equal(mangaDirectoryColumnWidth(1180),258);
assert.equal(mangaDirectoryColumnWidth(1600),258);
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { MANGA_DIRECTORY_VISUAL: visual } = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
const source = readFileSync(new URL('../entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets', import.meta.url), 'utf8');
const { owner: header } = createReaderBuilderProbe(source, ['directorySideHeader', 'panelCloseFocusId'], {
  visual, READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold',
});
let opening = 5, closes = 0;
Object.assign(header, { sourceId: 'source', bookId: 'book', panelContentInset: () => 8,
  backgroundPreference: 'ink', panelTitle: () => '目录', inkColor: () => '#fff', lineColor: () => '#fff',
  chromeScheme: () => 'night', directoryFontScale: () => 1, panelInputCurrent: expected => expected === opening,
  closePanel: () => { closes += 1; },
});
header.directorySideHeader(opening);
const close = [...header.nodes.values()].find(node => node.accessibilityText === '关闭宽屏面板');
assert.equal(close?.id, header.panelCloseFocusId(opening), 'the native side drawer close button owns the opening focus target');
close.onClick();
opening += 1;
close.onClick();
assert.equal(closes, 1, 'a retained tablet close callback cannot dismiss a successor panel');
console.log('PASS phone portrait/landscape versus tablet directory ownership and bounded persistent column');

}

const implementations = {'manga-preferences':case_manga_preferences,'chapter-action-admission':case_chapter_action_admission,'layout-policy':case_layout_policy};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
