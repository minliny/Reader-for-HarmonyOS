import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { mangaSurfaceSdkDependencies, mountMangaViewportBuilder } from './lib/manga-surface-sdk-probe.mjs';
import { createDefaultReaderWindowMetrics, readerInteractiveSafeInsets } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { mangaUserError } from '../entry/src/main/ets/features/manga/MangaUserError.ts';

// Executes production Surface/Projection methods and actual installed-SDK
// List/LazyForEach callbacks. Key retention and native rectangles are bounded
// fixtures, not a claim about native paint, ImageKit decoding or VM pixels.
const source = readFileSync(process.env.READER_MANGA_SCROLL_SURFACE ?? new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile('/tmp/MangaScrollStability.ets', source, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length, 0);
const component = tree.statements.find(node => node.name?.getText(tree) === 'MangaReadingSurface');
const names = component.members.map(node => node.name?.getText(tree)).filter(Boolean);
const projectionSource = readFileSync(process.env.READER_MANGA_SCROLL_PROJECTION ?? new URL('../entry/src/main/ets/features/manga/MangaStripProjection.ts', import.meta.url), 'utf8')
  .replace(/^import[^;]+;\n/gm, '').replace(/^export /gm, '');
const Projection = new Function(`${stripTypeScriptTypes(projectionSource)};return MangaStripProjection`)();
const dataSourceText = tree.statements.find(node => node.name?.getText(tree) === 'MangaStripDataSource').getText(tree);
const DataSource = new Function('MangaStripProjection', `${stripTypeScriptTypes(dataSourceText)};return MangaStripDataSource`)(Projection);
const frameText = tree.statements.find(node => node.name?.getText(tree) === 'MangaLayoutFrame').getText(tree);
const LayoutFrame = new Function('FrameCallback', `${stripTypeScriptTypes(frameText)};return MangaLayoutFrame`)(class {});
const properties = createArkUIPropertyRuntimeProbe();
const boundary = new Proxy({}, { get: () => () => {} });
const timers = [], frames = [];
let nativeFirst = 0, nativeHeight = 300;
class ListScroller {
  getItemRect(index) { return { x: 0, y: (index - nativeFirst) * nativeHeight - 20, width: 300, height: nativeHeight }; }
  getItemIndex(_x, y) { return y < 300 ? 0 : 1; }
  scrollToIndex() {}
  scrollBy() {}
}
class Scroller { currentOffset() { return { xOffset: 0 }; } scrollTo() {} }
let owner, lazy;
class RetainedItems {
  constructor(data, item, key) {
    Object.assign(this, { data, item, key, visible: [0, 1], rows: new Map(), mounts: 0, reloads: 0, changes: 0 });
  }
  reconcile(indices = this.visible) {
    for (const index of indices) {
      const row = this.data.getData(index), key = this.key(row, index), old = this.rows.get(index);
      if (old?.key === key) continue;
      const before = owner.observers.length;
      this.item(row, index); this.mounts++;
      const nodes = [...owner.nodes.values()].filter(node => node.id >= before);
      this.rows.set(index, { key, row, nodes, image: nodes.find(node => node.type === 'Image') });
    }
  }
  onDataReloaded() { this.reloads++; this.reconcile(); }
  onDataChange(index) { this.changes++; if (this.visible.includes(index)) this.reconcile([index]); }
}
const built = createReaderBuilderProbe(source, names, {
  ...properties.sdk, ...mangaSurfaceSdkDependencies,
  MangaStripDataSource: DataSource, MangaLayoutFrame: LayoutFrame, ListScroller, Scroller, PhotoViewScaleModel: class {},
  ReaderWindowCoordinator: { metrics: () => createDefaultReaderWindowMetrics() }, readerInteractiveSafeInsets, mangaUserError,
  uiContext: { postFrameCallback: callback => frames.push(callback) }, setTimeout: callback => timers.push(callback),
  hilog: { warn() {}, error() {} }, ScrollAlign: { START: 0 }, ImageFit: { Fill: 0 },
  ScrollDirection: { Horizontal: 0 }, TouchType: { Down: 0, Up: 1 },
  LazyForEach: {
    create(_id, generatedOwner, data, item, key) {
      assert.equal(generatedOwner, owner);
      if (lazy === undefined) { lazy = new RetainedItems(data, item, key); data.registerDataChangeListener(lazy); }
      lazy.reconcile();
    }, pop() {},
  },
  Gesture: boundary, GestureGroup: boundary, PinchGesture: boundary, SwipeGesture: boundary, TapGesture: boundary,
  GesturePriority: { Parallel: 0 }, GestureMode: { Exclusive: 0 }, SwipeDirection: { Horizontal: 0 },
}, properties.hooks);
owner = built.owner;
const manifest = { chapter: { sourceId: 's', bookId: 'b', chapterId: '/c' }, manifestVersion: 'scroll-v1',
  pages: Array.from({ length: 5 }, (_, ordinal) => ({ ordinal, pageId: `page-${ordinal}`, resourceRef: `manga:page-${ordinal}` })) };
const geometry = new Map([[0, { width: 600, height: 1200, tileHeight: 600 }]]);
const tiles = new Map([['0:0', { image: { fileUri: 'file://stable-0.png', revision: 'r0' } }],
  ['0:1', { image: { fileUri: 'file://stable-1.png', revision: 'r1' } }]]);
const pages = new Map([[0, { ordinal: 0, status: 'ready' }]]);
const windows = [];
owner.controller = {
  chapter: { manifest, chapterTitle: 'Fixture', chapterIndex: 0 }, totalPages: 5, displayedOrdinal: 0,
  recoveryRequired: false, savedLocation: null, tile: (ordinal, index) => tiles.get(`${ordinal}:${index}`),
  visiblePages: () => [...pages.values()], pageGeometry: ordinal => geometry.get(ordinal), pageAt: ordinal => manifest.pages[ordinal],
  async setVisible() {}, async setTileWindow(requested) { windows.push(requested); },
};
owner.viewportWidth = 300; owner.viewportHeight = 450;
owner.first = 0; owner.last = 1; owner.mounted = true; owner.opened = true;
owner.publishedManifestVersion = manifest.manifestVersion;
owner.data.projection.publish(manifest, index => geometry.get(index), undefined, 5, index => manifest.pages[index]);
owner.publish(); // Production publishes row facts before LazyForEach mounts.
const priorGesture = globalThis.Gesture; globalThis.Gesture = boundary;
try { owner.initialRender(); mountMangaViewportBuilder(owner); }
finally { if (priorGesture === undefined) delete globalThis.Gesture; else globalThis.Gesture = priorGesture; }
assert.ok(lazy);
const list = [...owner.nodes.values()].find(node => node.type === 'List');
assert.equal(typeof list.onScrollIndex, 'function');
assert.equal(typeof list.onScroll, 'function');
assert.equal(typeof list.onTouch, 'function');
const tick = () => new Promise(resolve => setImmediate(resolve));
const snapshot = () => ({ keys: [...lazy.rows.values()].map(row => row.key),
  actors: [...lazy.rows.values()].map(row => row.image?.id), mounts: lazy.mounts,
  reloads: lazy.reloads, changes: lazy.changes, timers: timers.length, heights: [...lazy.rows.values()].map(row => row.nodes.find(node => node.type === 'ListItem').height) });
const failures = [];
function check(name, action) {
  try { action(); console.log(`PASS ${name}`); }
  catch (error) { failures.push({ name, message: error.message }); console.error(`RED ${name}: ${error.message}`); }
}

const ready = snapshot();
list.onTouch({ type: 0 }); list.onScroll(); list.onScrollIndex(0, 1); await tick();
owner.publish();
check('unchanged scroll notifications retain decoded visible Images and row geometry', () => {
  assert.deepEqual(snapshot().keys, ready.keys); assert.deepEqual(snapshot().actors, ready.actors);
  assert.equal(lazy.mounts, ready.mounts); assert.deepEqual(snapshot().heights, ready.heights);
  assert.equal(lazy.reloads, ready.reloads); assert.equal(timers.length, ready.timers);
  assert.equal(lazy.changes, ready.changes, 'unchanged presentation must not notify native rows');
});
assert.ok(windows.length > 0, 'actual SDK range callback executes production updateViewport');

const settledWindows = windows.length, settledGeneration = owner.viewportGeneration;
list.onScrollIndex(0, 1); list.onScrollIndex(0, 1); await tick();
check('same native range is idempotent after the first mounted callback', () => {
  assert.equal(windows.length, settledWindows);
  assert.equal(owner.viewportGeneration, settledGeneration);
});
list.onScrollIndex(1, 1); await tick();
check('a changed native range still commits its exact tile window', () => {
  assert.equal(windows.length, settledWindows + 1);
});
list.onScrollIndex(0, 1); await tick();

owner.first = 0; owner.last = 0; owner.viewportRangeObserved = false;
const initialWindows = windows.length;
list.onScrollIndex(0, 0); await tick();
check('first native callback still demands tiles even when its range equals the initial fields', () => {
  assert.equal(windows.length, initialWindows + 1);
});
list.onScrollIndex(0, 1); await tick();
owner.restoringAnchor = true; owner.appliedLayoutGeneration = owner.layoutGeneration;
list.onScrollIndex(0, 1);
check('same range during restore still measures and confirms its native anchor', () => {
  assert.equal(owner.restoringAnchor, true, 'native range callback must defer geometry observation');
  while (frames.length) frames.shift().onFrame(0);
  assert.equal(owner.restoringAnchor, false);
  assert.equal(owner.confirmedPosition?.anchor.ordinal, 0);
});

const zoomBefore = snapshot();
owner.zoom = 2; properties.flush();
check('retained Images and rows still resize through real SDK zoom dependencies without data notifications', () => {
  assert.deepEqual(snapshot().actors, zoomBefore.actors);
  assert.equal(lazy.mounts, zoomBefore.mounts); assert.equal(lazy.changes, zoomBefore.changes);
  for (const row of lazy.rows.values()) {
    assert.equal(row.image.width, 600); assert.equal(row.image.height, 600);
    assert.equal(row.nodes.find(node => node.type === 'ListItem').height, 600);
  }
});
owner.zoom = 1; properties.flush();
owner.viewportWidth = 360; properties.flush();
check('retained Images still follow changed viewport width without row invalidation', () => {
  assert.deepEqual(snapshot().actors, zoomBefore.actors);
  assert.equal(lazy.changes, zoomBefore.changes);
  for (const row of lazy.rows.values()) {
    assert.equal(row.image.width, 360); assert.equal(row.image.height, 360);
  }
});
owner.viewportWidth = 300; properties.flush();

const tileBefore = snapshot();
tiles.set('0:0', { image: { fileUri: 'file://stable-0-retry.png', revision: 'r0-new' } });
owner.publish();
check('a real tile replacement notifies only its changed row', () => {
  assert.equal(lazy.changes, tileBefore.changes + 1);
  assert.notEqual(lazy.rows.get(0).image?.id, tileBefore.actors[0]);
  assert.equal(lazy.rows.get(1).image?.id, tileBefore.actors[1]);
});
const stableTile = snapshot(); owner.publish();
check('repeated Controller publication with no row changes is silent', () => {
  assert.equal(lazy.changes, stableTile.changes);
  assert.equal(lazy.reloads, stableTile.reloads);
  assert.equal(lazy.mounts, stableTile.mounts);
});

// Real Controller emits this event on same-size page-window reentry: its page
// metadata decode constructs a fresh geometry object while the values match.
const equalBefore = snapshot();
geometry.set(0, { ...geometry.get(0) }); owner.publish();
check('equal-value geometry reentry must not reload the list or restore during scrolling', () => {
  assert.equal(lazy.reloads, equalBefore.reloads, 'fresh geometry identity is not a structural change');
  assert.equal(timers.length, equalBefore.timers, 'no queued scrollToIndex/scrollBy restore is needed');
});
console.log(JSON.stringify({ case: 'equal-value-reentry', before: equalBefore, after: snapshot() }));
timers.length = 0; owner.restoringAnchor = false;

// A later neighbor has one row before/after metadata arrival. Its height
// changes outside the visible window; current row index/geometry stay exact.
const neighborBefore = snapshot();
geometry.set(4, { width: 600, height: 1500, tileHeight: 1500 }); owner.publish();
check('offscreen neighbor geometry must not restore stable visible Images', () => {
  assert.equal(lazy.reloads, neighborBefore.reloads + 1, 'real geometry remains published to the native data source');
  assert.equal(timers.length, neighborBefore.timers, 'neighbor completion must not interrupt user scrolling');
});
check('same visible keys do retain Image actors in the strict-key SDK boundary', () => {
  assert.deepEqual(snapshot().keys, neighborBefore.keys); assert.deepEqual(snapshot().actors, neighborBefore.actors);
  assert.equal(lazy.mounts, neighborBefore.mounts); assert.deepEqual(snapshot().heights, neighborBefore.heights);
});
console.log(JSON.stringify({ case: 'offscreen-neighbor', before: neighborBefore, after: snapshot() }));
timers.length = 0; owner.restoringAnchor = false;

const currentBefore = snapshot();
const currentAnchor = structuredClone(owner.visibleAnchor);
geometry.set(0, { width: 600, height: 1500, tileHeight: 750 }); owner.publish();
check('real current-page geometry change must retain normalized anchor and request one restore', () => {
  assert.equal(lazy.reloads, currentBefore.reloads + 1);
  assert.equal(timers.length, currentBefore.timers + 1);
  assert.deepEqual(owner.visibleAnchor, currentAnchor);
});
timers.length = 0; owner.restoringAnchor = false;

geometry.set(2, { width: 600, height: 1200, tileHeight: 600 });
tiles.set('2:0', { image: { fileUri: 'file://page-2-0.png', revision: 'r2' } });
tiles.set('2:1', { image: { fileUri: 'file://page-2-1.png', revision: 'r2' } });
owner.publish();
nativeFirst = owner.data.projection.index(2, 0); nativeHeight = 300;
owner.first = nativeFirst; owner.last = nativeFirst + 1;
owner.controller.displayedOrdinal = 2;
lazy.visible = [owner.first, owner.last]; lazy.reconcile();
timers.length = 0; owner.restoringAnchor = false; owner.rememberVisible();
const forwardAnchor = structuredClone(owner.visibleAnchor), forwardTimers = timers.length;
geometry.set(1, { width: 600, height: 2400, tileHeight: 600 }); owner.publish();
check('real layout change before the visible page must restore the shifted row index', () => {
  assert.equal(timers.length, forwardTimers + 1);
  assert.deepEqual(owner.visibleAnchor, forwardAnchor);
  assert.notEqual(owner.data.projection.index(2, 0), nativeFirst);
});
timers.length = 0; owner.restoringAnchor = false;

// Keep the already fixed error ownership semantics in this new fixture:
// moving the viewport still makes the retained failure's real retry reachable.
lazy.visible = [0, 1]; lazy.reconcile(); nativeFirst = 0; nativeHeight = 375;
owner.controller.displayedOrdinal = 0;
tiles.set('0:0', { error: 'READING_IMAGE_HTTP_FAILED' });
tiles.set('0:1', { error: 'READING_IMAGE_HTTP_FAILED' });
owner.first = 0; owner.last = 0; owner.publish();
assert.ok(lazy.rows.get(0).nodes.some(node => node.type === 'Button'));
assert.ok(!lazy.rows.get(1).nodes.some(node => node.type === 'Button'));
const failedText = lazy.rows.get(0).nodes.find(node => node.type === 'Text');
const themeMounts = lazy.mounts, themeChanges = lazy.changes;
owner.errorColor = '#123456'; properties.flush();
check('retained failed text still updates its theme color through the real SDK dependency', () => {
  assert.equal(lazy.rows.get(0).nodes.find(node => node.type === 'Text').id, failedText.id);
  assert.equal(failedText.fontColor, '#123456');
  assert.equal(lazy.mounts, themeMounts); assert.equal(lazy.changes, themeChanges);
});
const failureKey = lazy.rows.get(1).key;
owner.first = 1; owner.last = 1; owner.publish();
assert.notEqual(lazy.rows.get(1).key, failureKey);
assert.ok(lazy.rows.get(1).nodes.some(node => node.type === 'Button'));
console.log('PASS error card ownership still transfers on viewport movement; tile eviction remains Controller-owned');
const retryChanges = lazy.changes;
tiles.set('0:1', { image: { fileUri: 'file://stable-1-retried.png', revision: 'retried' } }); owner.publish();
check('a retried error row still publishes its ready Image', () => {
  assert.equal(lazy.changes, retryChanges + 1);
  assert.ok(lazy.rows.get(1).image);
  assert.ok(!lazy.rows.get(1).nodes.some(node => node.type === 'Button'));
});

// Horizontal mode projects only its selected logical page. A neighbor before
// that ordinal still has no row in this list and cannot shift the anchor.
owner.horizontal = true; owner.horizontalPage = 2;
owner.controller.displayedOrdinal = 2; owner.first = 0; owner.last = 1;
owner.visibleAnchor = { ordinal: 2, y: 0.25, x: 0 };
owner.restoringAnchor = true; owner.appliedLayoutGeneration = -1;
owner.publish();
lazy.visible = [0, 1]; lazy.reconcile(); nativeFirst = 0; nativeHeight = 300;
timers.length = 0; owner.restoringAnchor = false;
const horizontalBefore = snapshot();
geometry.set(1, { width: 600, height: 3000, tileHeight: 600 }); owner.publish();
check('horizontal selected page ignores earlier neighbor geometry outside its list', () => {
  assert.equal(lazy.reloads, horizontalBefore.reloads);
  assert.equal(timers.length, horizontalBefore.timers);
  assert.deepEqual(snapshot().actors, horizontalBefore.actors);
});
const horizontalCurrentBefore = snapshot();
geometry.set(2, { width: 600, height: 1800, tileHeight: 600 }); owner.publish();
check('horizontal selected page still restores for its own real geometry change', () => {
  assert.equal(lazy.reloads, horizontalCurrentBefore.reloads + 1);
  assert.equal(timers.length, horizontalCurrentBefore.timers + 1);
  assert.equal(owner.visibleAnchor.ordinal, 2);
});

// An all-failed placeholder window has no geometry and requests no tiles.
// Moving its viewport must still hand the retry card to the mounted new row;
// neither setVisible nor setTileWindow emits any Controller publication here.
geometry.clear(); tiles.clear(); pages.clear();
pages.set(0, { ordinal: 0, status: 'failed', error: 'READING_IMAGE_HTTP_FAILED' });
pages.set(1, { ordinal: 1, status: 'failed', error: 'READING_IMAGE_HTTP_FAILED' });
owner.horizontal = false; owner.controller.displayedOrdinal = 0;
owner.first = 0; owner.last = 1; owner.viewportRangeObserved = false;
owner.publish(); lazy.visible = [0, 1]; lazy.reconcile();
owner.restoringAnchor = false; timers.length = 0;
assert.ok(lazy.rows.get(0).nodes.some(node => node.type === 'Button'));
assert.ok(!lazy.rows.get(1).nodes.some(node => node.type === 'Button'));
const placeholderKey = lazy.rows.get(1).key, notified = [];
const realChange = lazy.onDataChange.bind(lazy);
lazy.onDataChange = index => { notified.push(index); realChange(index); };
list.onScrollIndex(1, 1); await tick();
check('failed unknown-geometry viewport transfers retry ownership without a Controller publication', () => {
  assert.deepEqual(windows.at(-1), [], 'failed unknown pages have no regional tile work');
  assert.ok(notified.includes(1), 'the existing mounted blank row must receive its presentation change');
  assert.notEqual(lazy.rows.get(1).key, placeholderKey);
  assert.ok(lazy.rows.get(1).nodes.some(node => node.type === 'Button'));
});
const failedChanges = lazy.changes, failedWindows = windows.length;
list.onScrollIndex(1, 1); await tick();
check('settled failed viewport remains silent on a repeated same-range callback', () => {
  assert.equal(lazy.changes, failedChanges);
  assert.equal(windows.length, failedWindows);
});
if (failures.length) {
  console.error(JSON.stringify({ status: 'RED', failures, evidenceBoundary: 'production Surface/Projection + real SDK callbacks; no native Image reconstruction or painted flicker claim' }));
  process.exitCode = 1;
} else console.log('PASS scroll stability regression; native motion/pixels require separate delivery evidence');
