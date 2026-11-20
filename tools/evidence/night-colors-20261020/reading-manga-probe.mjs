// Explicit issue-local production SDK evidence, not a default gate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
    throw error;
  }
} });
const { pureModuleProbe } = await import('../../lib/ets-pure-module-probe.mjs');
const { boundedSurfaceSdk, boundedMembers } = await import('../../lib/bounded-surface-sdk-probe.mjs');
const { createReaderBuilderProbe } = await import('../../lib/reader-control-builder-probe.mjs');
const { readerControlUnit } = await import('../../../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts');
const root = new URL('../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const manga = pureModuleProbe(read('entry/src/main/ets/features/manga/MangaDirectoryVisual.ts'),
  'MangaDirectoryVisual.ts', {}, ['mangaDirectoryColor', 'mangaDirectoryContentTop', 'MANGA_DIRECTORY_VISUAL']);
const spec = JSON.parse(read('../Reader-UI/design/manga-directory/visual.json'));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Captured before this color edit, from the existing dirty workspace rather
// than assuming that HEAD is the user's unmodified production baseline.
assert.equal(digest(spec.metrics), '899603256998e92152bbc75cad2090f252ac0352eb50c360652733d5124e5827', 'all existing geometry metrics are retained');
assert.equal(digest(spec.palette.day), '9481079e9402447701be396b490a5a67a791b490bc57251c893b7fd7277f3c00', 'the entire Day palette is retained');
assert.equal(digest(spec.typography), '2bffe5f358a10a5fcae18e01808c8319f6cf72d0e0a0af84d5da3971a9e1c2e3', 'all typography is retained');
const changed = ['surface', 'soft', 'active', 'line', 'frame', 'scrollbar', 'muted'];
assert.equal(digest(Object.fromEntries(Object.entries(spec.palette.night).filter(([role]) => !changed.includes(role)))),
  'e033365ef3d5df86aa17944932c10482b3f1dd47ecc2830e0e944926c79047a0', 'paper, primary text, strong accent/green and all other Night roles are retained');
assert.deepEqual(Object.fromEntries(changed.map(role => [role, spec.palette.night[role]])), {
  surface: '#30342D', soft: '#3F433C', active: '#4A5647', line: '#4E5349', frame: '#5B6255', scrollbar: '#99A6AD9F', muted: '#C8C6BB',
}, 'the confirmed Night matrix is the canonical input');
for (const scheme of ['day', 'night']) for (const [role, color] of Object.entries(spec.palette[scheme])) {
  assert.equal(manga.mangaDirectoryColor(role, scheme), color, `actual generated runtime matches canonical ${scheme}/${role}`);
}
const rgb = value => [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16));
for (const [role, before] of Object.entries({ surface: '#282C25', soft: '#30342D', active: '#303C2D', line: '#3B4036', frame: '#4D5447' })) {
  const old = rgb(before), next = rgb(spec.palette.night[role]);
  const deltas = next.map((value, index) => value - old[index]);
  assert.ok(deltas[0] > 0 && deltas.every(delta => delta === deltas[0]), role + ' lifts brightness equally without adding a green cast');
  assert.ok((Math.max(...next) - Math.min(...next)) / Math.max(...next) <=
    (Math.max(...old) - Math.min(...old)) / Math.max(...old), role + ' does not increase saturation');
}
assert.notEqual(spec.palette.night.scrollbar, '#47000000', 'Night scrollbar has a visible light ink');
const luminance = value => rgb(value).map(value => {
  value /= 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
const mutedContrast = ['paper', 'surface', 'soft', 'active'].map(role => contrast(spec.palette.night.muted, spec.palette.night[role]));
assert.ok(mutedContrast.every(value => value >= 4.5), 'confirmed secondary text stays >=4.5:1 on all four manga containers');

const ui = boundedSurfaceSdk();
const switchSource = read('entry/src/main/ets/features/reading/ReaderControlSwitchTrack.ets');
ui.hooks.childSources.ReaderControlSwitchTrack = switchSource;
const Switch = createReaderBuilderProbe(switchSource, boundedMembers(switchSource), ui.deps, ui.hooks).Component;
const autoSource = read('entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets');
for (const appScheme of ['day', 'night']) for (const status of ['stopped', 'running', 'paused']) for (const interactionEnabled of [true, false]) {
  const owner = createReaderBuilderProbe(autoSource, ['followHighlightRow', 'fullInput', 'p'],
    { ...ui.deps, readerControlUnit, ReaderControlSwitchTrack: Switch }, ui.hooks).owner;
  Object.assign(owner, { appScheme, status, interactionEnabled, motionProgress: 1, followHighlight: false,
    sectionInnerWidth: () => 280, frame: () => ({ follow: { x: 0, y: 0, opacity: 0.8 } }),
    presentation: () => ({ contentOpacity: 0.5, contentBlur: 0 }), fullOnlyScrollTranslation: () => 0,
    onFollowHighlightChange() {} });
  owner.followHighlightRow();
  const row = [...owner.nodes.values()].find(node => node.type === 'Row' && node.height === 36);
  assert.ok(row, 'the actual SDK follow-highlight row is emitted');
  assert.equal(row.enabled, interactionEnabled && status === 'stopped', appScheme + '/' + status + ' retains existing input admission');
  assert.equal(row.opacity, 0.4 * (appScheme === 'night' && !(interactionEnabled && status === 'stopped') ? 0.45 : 1));
}

const surfaceSource = read('entry/src/main/ets/features/manga/MangaReadingSurface.ets');
for (const backgroundPreference of ['paper', 'white', 'ink']) for (const appThemeScheme of ['day', 'night']) {
  const owner = createReaderBuilderProbe(surfaceSource,
    ['topControls', 'bottomControls', 'chapterEndContent', 'paperColor', 'surfaceColor', 'inkColor', 'mutedColor', 'lineColor', 'greenColor'],
    { ...ui.deps, mangaDirectoryColor: manga.mangaDirectoryColor }, ui.hooks).owner;
  Object.assign(owner, { backgroundPreference, appThemeScheme, bookTitle: '漫画', title: '章节',
    recovering: false, loginRequiredForControls: false, offlineProbeStatus: '',
    opened: true, horizontalPageCount: 10, viewportWidth: 390, windowMetricsRevision: 0,
    iconAction() {}, footerAction() {}, pageOrdinal: () => 0, interactiveInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
    chapterEndTypeLabel: () => '本话', chapterEndLabel: () => '章节', adjacentChapter: () => undefined });
  owner.topControls(); owner.bottomControls(); owner.chapterEndContent();
  const shadows = [...owner.nodes.values()].filter(node => node.shadow).map(node => node.shadow);
  assert.equal(shadows.length, 3, 'actual lightweight reading bars and chapter-end card own the same three shadows');
  assert.deepEqual(shadows[0], { radius: backgroundPreference === 'ink' ? 0 : 8,
    color: backgroundPreference === 'ink' ? '#22000000' : '#1A594632', offsetX: 0, offsetY: 3 });
  assert.deepEqual(shadows[1], { radius: 8,
    color: backgroundPreference === 'ink' ? '#44000000' : '#1A594632', offsetX: 0, offsetY: -3 });
  assert.deepEqual(shadows[2], { radius: backgroundPreference === 'ink' ? 0 : 16,
    color: backgroundPreference === 'ink' ? '#44000000' : '#1A594632', offsetX: 0, offsetY: 4 });
}

const navigationSource = read('entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets');
for (const appThemeScheme of ['day', 'night']) for (const mangaDisplay of [false, true]) for (const mangaScheme of ['', 'day', 'night']) {
  const owner = createReaderBuilderProbe(navigationSource, ['build', 'mangaColor'],
    { ...ui.deps, MANGA_DIRECTORY_VISUAL: manga.MANGA_DIRECTORY_VISUAL, mangaDirectoryColor: manga.mangaDirectoryColor }, ui.hooks).owner;
  Object.assign(owner, { appThemeScheme, mangaScheme, mangaDisplay, view: { visibleTotal: 0 },
    dataSource: { totalCount: () => 0, getData: () => undefined, registerDataChangeListener() {} },
    mangaGridLayoutOptions: () => ({}), mangaEmptyState() {}, mangaContentStartOffset: () => 0, mangaContentEndOffset: () => 0,
    listPaddingX: 0, listPaddingRight: -1, listPaddingTop: 0, listPaddingBottom: 0, listPaddingY: 0,
    contentStartInset: 0, contentEndInset: 0, interactionEnabled: true, rowHeight: 40 });
  owner.initialRender();
  const native = [...owner.nodes.values()].find(node => node.type === (mangaDisplay ? 'Grid' : 'List'));
  assert.ok(native, 'actual navigation Builder emits its existing native branch');
  assert.equal(native.scrollBarColor, mangaDisplay ? spec.palette[mangaScheme || appThemeScheme].scrollbar : undefined,
    'manga Grid follows palette; ordinary List keeps its existing absent scrollbar color');
}

const detailSource = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
for (const appThemeScheme of ['day', 'night']) {
  const owner = createReaderBuilderProbe(detailSource, ['detailScroll'],
    { ...ui.deps, visual: manga.MANGA_DIRECTORY_VISUAL, mangaDirectoryColor: manga.mangaDirectoryColor,
      mangaDirectoryContentTop: manga.mangaDirectoryContentTop }, ui.hooks).owner;
  Object.assign(owner, { appThemeScheme, book: { contentKind: 'manga' }, hero() {}, readingFacts() {}, summary() {}, catalog() {},
    detailBookAvailable: () => true, contentFrame: () => ({ width: 350, left: 20, right: 20 }),
    mangaFontScale: () => 1, topInset: () => 0, mangaContentBottomInset: () => 0 });
  owner.detailScroll();
  const scroll = [...owner.nodes.values()].find(node => node.type === 'Scroll');
  assert.equal(scroll.scrollBarColor, spec.palette[appThemeScheme].scrollbar, 'actual detail scrollbar follows the same palette');
}
console.log('PASS reading/manga Night colors: retained Day/paper/accent/geometry, canonical mapping, equal-channel lifts, actual SDK disabled state and reading-context shadows/scrollbar; minimum muted contrast=' + Math.min(...mutedContrast).toFixed(3) + ':1');
