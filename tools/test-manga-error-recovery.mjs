import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { mangaUserError } from '../entry/src/main/ets/features/manga/MangaUserError.ts';

const file = new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const Surface = productionMotionMethods(file,
  ['requestedLast', 'imageError', 'rowHasError', 'primaryErrorRowKey', 'isPrimaryErrorRow', 'rowRenderKey', 'retry', 'retryLabel', 'retryOpen', 'confirmRecovery']);
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const rows = [0, 1, 2].map(ordinal => ({ key: `page-${ordinal}:0`, ordinal, tileIndex: 0,
  known: true, width: 600, height: 800, sourceY: 0, sourceHeight: 800 }));
function fixture() {
  const tiles = new Map(rows.map(row => [row.ordinal, { error: 'READING_IMAGE_HTTP_FAILED' }]));
  const controller = { chapter: { manifest: { manifestVersion: 'v1' } },
    tile: ordinal => tiles.get(ordinal), visiblePages: () => [] };
  const surface = Object.assign(new Surface(), { controller, mounted: true, opened: true,
    first: 0, last: 2, presentationGeneration: 0, error: '',
    data: { totalCount: () => rows.length, getData: index => rows[index] }, updateViewport: async () => {} });
  return { surface, controller, tiles };
}

// Execute the production identity function. A retained LazyForEach Blank
// must get a new presentation key when it becomes the viewport's retry owner.
{
  const { surface, tiles } = fixture();
  const keys = rows.map(row => surface.rowRenderKey(row));
  assert.equal(surface.isPrimaryErrorRow(rows[0]), true);
  assert.equal(surface.isPrimaryErrorRow(rows[1]), false);
  surface.first = 1;
  assert.equal(surface.isPrimaryErrorRow(rows[1]), true);
  assert.notEqual(surface.rowRenderKey(rows[1]), keys[1], 'scrolling an existing failure into first position replaces its retained Blank');
  surface.first = 0;
  assert.equal(surface.rowRenderKey(rows[1]), keys[1]);
  tiles.set(0, { image: { fileUri: 'file://recovered', revision: 'v1' } });
  assert.equal(surface.isPrimaryErrorRow(rows[1]), true);
  assert.notEqual(surface.rowRenderKey(rows[1]), keys[1], 'successful prior retry transfers the visible retry card to the next failure');
  const admitted = surface.rowRenderKey(rows[1]);
  assert.equal(surface.rowRenderKey(rows[1]), admitted, 'stable error ownership preserves row identity');
}
console.log('PASS actual manga row keys transfer one visible retry card after scrolling and prior-row recovery');

// Real retry callbacks may settle after settings/progress errors, navigation,
// refresh, or disposal. They must only own their original presentation.
for (const initialError of ['', 'READING_IMAGE_HTTP_FAILED']) {
  const { surface, controller, tiles } = fixture();
  const pending = deferred();
  controller.retryTile = () => pending.promise;
  surface.error = initialError;
  surface.retry(rows[0]);
  surface.error = 'SETTINGS_WRITE_FAILED';
  tiles.set(0, { image: { fileUri: 'file://recovered' } });
  pending.resolve(); await tick();
  assert.equal(surface.error, 'SETTINGS_WRITE_FAILED', 'successful image retry cannot erase a newer unrelated failure');
}
for (const mutation of ['presentation', 'chapter', 'controller', 'dispose']) {
  const { surface, controller } = fixture();
  const pending = deferred(); controller.retryTile = () => pending.promise;
  surface.retry(rows[0]);
  if (mutation === 'presentation') surface.presentationGeneration++;
  if (mutation === 'chapter') controller.chapter = { manifest: { manifestVersion: 'v2' } };
  if (mutation === 'controller') surface.controller = {};
  if (mutation === 'dispose') surface.mounted = false;
  pending.reject(new Error('OLD_TILE_FAILURE')); await tick();
  assert.equal(surface.error, '', `${mutation}: retired retry cannot show its old error on the current page`);
}
{
  const { surface, controller, tiles } = fixture();
  const pending = deferred(); controller.retryTile = () => pending.promise;
  surface.error = 'READING_IMAGE_HTTP_FAILED'; surface.retry(rows[0]);
  tiles.set(0, { image: { fileUri: 'file://recovered' } });
  pending.resolve(); await tick();
  assert.equal(surface.error, '', 'the recovered current image removes its own unchanged error');
  controller.retryTile = async () => { throw new Error('MANGA_SESSION_CANCELLED'); };
  surface.retry(rows[1]); await tick();
  assert.equal(surface.error, '', 'cancelled retry is not a new user-visible image failure');
}
console.log('PASS actual manga retry callbacks preserve new failures and fence navigation, refresh, replacement and disposal');

// Selecting a recovery page can itself refresh an expired image into a new,
// unresolved manifest. That controller decision remains authoritative.
for (const requiresRecovery of [false, true]) {
  const { surface, controller } = fixture();
  let saves = 0;
  surface.recovering = true; surface.saveVisible = async () => { saves++; };
  controller.selectPage = async ordinal => {
    assert.equal(ordinal, 0);
    controller.chapter = { manifest: { manifestVersion: 'refreshed' } };
    controller.recoveryRequired = requiresRecovery;
  };
  await surface.confirmRecovery();
  assert.equal(surface.recovering, requiresRecovery);
  assert.equal(saves, requiresRecovery ? 0 : 1, 'unresolved replacement keeps confirmation visible and cannot write progress');
}
for (const mutation of ['presentation', 'controller', 'dispose']) {
  const { surface, controller } = fixture();
  const pending = deferred(); let saves = 0;
  surface.recovering = true; surface.saveVisible = async () => { saves++; };
  controller.selectPage = () => pending.promise;
  controller.recoveryRequired = false;
  const confirming = surface.confirmRecovery();
  if (mutation === 'presentation') surface.presentationGeneration++;
  if (mutation === 'controller') surface.controller = {};
  if (mutation === 'dispose') surface.mounted = false;
  pending.resolve(); await confirming;
  assert.equal(surface.recovering, true, `${mutation}: an old confirmation cannot acknowledge a newer view`);
  assert.equal(saves, 0);
}
{
  const { surface, controller } = fixture(); surface.recovering = true;
  controller.selectPage = async () => { throw new Error('MANGA_SESSION_CANCELLED'); };
  await surface.confirmRecovery(); assert.equal(surface.error, ''); assert.equal(surface.recovering, true);
  controller.selectPage = async () => { throw new Error('MANGA_PAGE_FACT_REQUIRED'); };
  await surface.confirmRecovery(); assert.equal(surface.error, 'MANGA_PAGE_FACT_REQUIRED');
}
console.log('PASS actual recovery confirmation follows refreshed controller facts and fences late acknowledgement/failure');

{
  const { surface, controller } = fixture();
  const pending = deferred(); let opens = 0, closes = 0;
  surface.opened = false; surface.offline = false; surface.openingRetry = false;
  controller.close = () => { closes++; };
  surface.open = async selected => { assert.equal(selected, controller); opens++; await pending.promise; };
  const first = surface.retryOpen();
  assert.equal(surface.openingRetry, true);
  await surface.retryOpen();
  assert.equal(opens, 1); assert.equal(closes, 1, 'an in-flight opening retry cannot start a second session');
  pending.resolve(); await first; assert.equal(surface.openingRetry, false);
}
// The installed SDK lowers the real top-controls Builder. With error cleared,
// a pending opening retry still exposes its disabled button and progress text.
{
  const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
  const syntax = createRequire(import.meta.url)(`${sdk}/lib/validate_ui_syntax.js`);
  const iconSource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderIconButton.ets', import.meta.url), 'utf8');
  syntax.componentCollection.customComponents.add('ReaderIconButton');
  syntax.propCollection.set('ReaderIconButton', new Set([...iconSource.matchAll(/@Prop\s+(\w+)\s*:/g)].map(match => match[1])));
  const { owner } = createReaderBuilderProbe(source,
    ['topControls', 'iconAction', 'inkColor', 'surfaceColor', 'mutedColor', 'lineColor']);
  Object.assign(owner, { openingRetry: true, opened: false, offline: false, recovering: false,
    error: '', bookTitle: '漫画', title: '', backgroundPreference: 'paper', appThemeScheme: 'day',
    offlineProbeStatus: '', iconAction: () => {}, loginRequired: () => false });
  owner.topControls();
  const retry = [...owner.nodes.values()].find(node => node.type === 'Button' &&
    (node.create === '重试中' || node.createWithLabel === '重试中' || node.createWithLabel?.[0] === '重试中'));
  assert.ok(retry, 'cleared old error must not remove the in-flight retry control');
  assert.equal(retry.enabled, false);
  assert.match(source, /@State(?:\s+@Watch\([^)]*\))?\s+private openingRetry:/, 'opening status participates in ArkUI state publication');
}
console.log('PASS actual opening retry has one session owner and SDK-emitted disabled in-progress control');

// Changed content requires a new entry admission. Repeating an image retry
// against the invalid manifest must not create another pending marker.
{
  const { surface, controller, tiles } = fixture();
  const pending = deferred(), events = [];
  tiles.set(0, { error: 'MANGA_SESSION_CONTENT_CHANGED' });
  Object.assign(surface, { openingRetry: false, viewportGeneration: 3, publishedRowKeys: new Map([[0, 'old']]),
    visibleAnchor: { ordinal: 0, y: 0.5 }, confirmedPosition: { old: true }, publishedManifestVersion: 'old',
    detachOfflineProbe: () => events.push('probe.detach'),
    open: async selected => { assert.equal(selected, controller); events.push('entry.open'); await pending.promise; surface.opened = true; } });
  controller.close = intent => { assert.equal(intent, 'chapter'); events.push('images.close'); };
  controller.retryTile = () => assert.fail('invalid content must reopen entry instead of retrying old pixels');
  assert.equal(surface.retryLabel(rows[0]), '重新打开本章');
  assert.equal(surface.retryLabel(rows[1]), '重试');
  assert.equal(mangaUserError('MANGA_SESSION_CONTENT_CHANGED'), '章节内容或书源已更新，请重新打开本章。');
  surface.retry(rows[0]); surface.retry(rows[0]);
  assert.deepEqual(events, ['probe.detach', 'images.close', 'entry.open'], 'one reopen owns entry admission and old subscriber disposal');
  assert.equal(surface.confirmedPosition, undefined); assert.equal(surface.visibleAnchor, undefined);
  assert.equal(surface.publishedRowKeys.size, 0); assert.equal(surface.openingRetry, true);
  pending.resolve(); await tick(); assert.equal(surface.openingRetry, false); assert.equal(surface.opened, true);
}
console.log('PASS changed-content recovery offers readable copy and one fresh entry admission instead of retrying an invalid image');

// Index registers one exit owner and sends a navigation intent for book-info,
// shelf mutation and external file opening. The actual registered callback
// must carry that intent past ordinary panel/end/zoom back handling.
{
  const ExitSurface = productionMotionMethods(file, ['aboutToAppear', 'handleBack'], {
    MangaBookPresentation: { revision: 0, useOwner() {} },
    MangaSessionController: class { async close() {} },
    prepareReaderFontFamily: async () => {},
    inputMethod: { getController: () => ({ hideTextInput: async () => {} }) },
  });
  function exitFixture() {
    let exit, saves = 0, exits = 0, resets = 0;
    const pending = deferred();
    const surface = Object.assign(new ExitSurface(), { runtime: {}, appThemeScheme: 'day',
      panel: '', panelPhase: 'closed', panelGeneration: 0, panelActionGeneration: 0,
      reduceMotion: true, chapterEnd: false, zoom: 1, exiting: false,
      getUIContext: () => ({ getFocusController: () => ({ clearFocus() {} }) }),
      loadBrightness() {}, open() {}, onExitRequestHandler: callback => { exit = callback; },
      saveVisible: async () => { saves++; await pending.promise; },
      changeZoom: () => { resets++; }, onBack: () => { exits++; } });
    surface.aboutToAppear();
    return { surface, pending, exit: (...args) => exit(...args), counts: () => ({ saves, exits, resets }) };
  }
  const navigation = exitFixture();
  Object.assign(navigation.surface, { panel: 'more', chapterEnd: true, zoom: 2 });
  navigation.exit('navigation'); await tick();
  assert.deepEqual(navigation.counts(), { saves: 1, exits: 0, resets: 0 }, 'navigation waits for the displayed-page save and bypasses overlay/zoom back tiers');
  navigation.exit('navigation'); await tick();
  assert.equal(navigation.counts().saves, 1, 'one exit transaction owns repeated navigation requests');
  navigation.pending.resolve(); await tick();
  assert.deepEqual(navigation.counts(), { saves: 1, exits: 1, resets: 0 });
  for (const mode of ['panel', 'chapterEnd', 'zoom']) {
    const normal = exitFixture();
    if (mode === 'panel') normal.surface.panel = 'directory';
    if (mode === 'chapterEnd') normal.surface.chapterEnd = true;
    if (mode === 'zoom') normal.surface.zoom = 2;
    normal.exit(); await tick();
    assert.equal(normal.counts().saves, 0); assert.equal(normal.counts().exits, 0);
    if (mode === 'panel') assert.equal(normal.surface.panel, '');
    if (mode === 'chapterEnd') assert.equal(normal.surface.chapterEnd, false);
    if (mode === 'zoom') assert.equal(normal.counts().resets, 1);
  }
  const disposed = exitFixture(); disposed.exit('navigation'); await tick();
  disposed.surface.mounted = false; disposed.pending.resolve(); await tick();
  assert.equal(disposed.counts().exits, 0, 'disposed completion cannot navigate a replacement reader');
}
console.log('PASS actual registered navigation exit bypasses back tiers, waits for one save, fences disposal and retains ordinary panel/end/zoom back behavior');
console.log('Boundary: production methods and SDK control lowering; VM pixels and native list scheduling require separate delivery evidence.');
