import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { mangaSurfaceSdkDependencies } from './lib/manga-surface-sdk-probe.mjs';
import { MangaStripProjection } from '../entry/src/main/ets/features/manga/MangaStripProjection.ts';
import { PhotoViewScaleModel } from '../entry/src/main/ets/features/manga/vendor/photoview/PhotoViewScaleModel.ts';

// Model-only sizes reproduce the recorded proportions, not guest intrinsic
// metadata or compositor pixels. Actual SDK Surface methods and List closures
// run unchanged; only native layout/clamping, frame delivery and Controller I/O
// receipts are controlled. In particular, header work never invents geometry.
const MODEL = { width: 1280, height: 2133, tileHeight: 524, viewportHeight: 2832, density: 3.5 };
const REQUESTED_Y = 0.6721680877983167;
const source = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url), 'utf8');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/manga-restore-e1e7d06c-methods.json', import.meta.url), 'utf8'));
assert.equal(baseline.referencedVersion, 'e1e7d06c7e02b0439e837985dc878b22bac14d1a');
assert.equal(createHash('sha256').update(JSON.stringify(baseline.methods)).digest('hex'),
  'b671ad1159a6f16cfaa34c00361bf031d1185bf43d5c165fb3cc8a3b3bf46d23', 'immutable e1 production excerpts');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const parse = text => ts.createSourceFile('/tmp/MangaRestoreIntent.ets', text, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
const tree = parse(source);
assert.equal(tree.parseDiagnostics.length, 0);
const declaration = tree.statements.find(node => node.name?.getText(tree) === 'MangaReadingSurface');
// Keep every real field and ordinary method, but mount only the viewport UI.
// Other panels are outside this probe and register unrelated SDK component ids.
const members = declaration.members.filter(node => node.name?.getText(tree) !== 'build' &&
  (!node.getText(tree).includes('@Builder') || ['imageViewport', 'tileImage'].includes(node.name?.getText(tree))))
  .map(node => node.name?.getText(tree)).filter(Boolean);
const dataText = tree.statements.find(node => node.name?.getText(tree) === 'MangaStripDataSource').getText(tree);
const DataSource = new Function('MangaStripProjection', `${stripTypeScriptTypes(dataText)}; return MangaStripDataSource;`)(MangaStripProjection);
const frames = Object.fromEntries(['MangaLayoutFrame', 'MangaSheetFrame'].map(name => [name,
  new Function('FrameCallback', `${stripTypeScriptTypes(tree.statements.find(node => node.name?.getText(tree) === name).getText(tree))}; return ${name};`)(class {})]));
let oldSource = source;
for (const name of ['restore', 'publish', 'onViewportScroll']) {
  const member = declaration.members.find(node => node.name?.getText(tree) === name);
  oldSource = oldSource.replace(member.getText(tree), baseline.methods[name]);
}
let activePorts;
const gesture = new Proxy({}, { get: () => () => {} });
class Scroller {
  currentOffset() { return { xOffset: 0, yOffset: 0 }; }
  scrollTo() {}
}
class ListScroller {
  constructor() { this.ports = activePorts; }
  heights() { const o = this.ports.owner; return Array.from({ length: o.data.totalCount() }, (_, i) => o.rowDisplayHeight(o.data.getData(i))); }
  top(index) { return this.heights().slice(0, index).reduce((sum, height) => sum + height, 0); }
  maximum() { return Math.max(0, this.top(this.heights().length) - this.ports.owner.viewportHeight); }
  getItemRect(index) {
    const p = this.ports;
    if (!p.layoutReady) throw new Error('native rows have not rendered');
    return { x: 0, y: this.top(index) - p.offset, width: p.owner.viewportWidth * p.owner.zoom, height: this.heights()[index] };
  }
  getItemIndex(_x, y) {
    const p = this.ports;
    if (!p.layoutReady) return -1;
    return this.heights().findIndex((_height, index) => this.top(index) <= y + p.offset && this.top(index + 1) > y + p.offset);
  }
  scrollToIndex(index, smooth, align, options) {
    const p = this.ports;
    assert.equal(p.layoutReady, true, 'atomic jump follows native data layout');
    assert.equal(smooth, false); assert.equal(align, 0); assert.equal(options.extraOffset.unit, 0);
    p.jumps.push({ index, extra: options.extraOffset.value });
    p.pendingOffset = Math.max(0, Math.min(this.top(index) + options.extraOffset.value, this.maximum()));
  }
  isAtEnd() { return this.ports.offset >= this.maximum(); }
}
function compiled(text) {
  const properties = createArkUIPropertyRuntimeProbe();
  return createReaderBuilderProbe(text, members, {
    ...properties.sdk, ...mangaSurfaceSdkDependencies, ...frames,
    MangaStripDataSource: DataSource, PhotoViewScaleModel, Scroller, ListScroller,
    ScrollAlign: { START: 0 }, LengthMetrics: { vp: value => ({ value, unit: 0 }) },
    ImageFit: { Fill: 0 }, ScrollDirection: { Horizontal: 0 }, TouchType: { Down: 0 },
    LazyForEach: { create(...args) { activePorts.lazy = args; }, pop() {} },
    GestureGroup: gesture, PinchGesture: gesture, SwipeGesture: gesture, TapGesture: gesture,
    globalThis: { Gesture: gesture }, GesturePriority: { Parallel: 0 }, GestureMode: { Exclusive: 0 }, SwipeDirection: { Horizontal: 0 },
    hilog: { info() {}, warn() {}, error() {} },
    AppStorage: { setOrCreate() {} },
    uiContext: { postFrameCallback: frame => activePorts.frames.push(frame) },
  }, properties.hooks).Component;
}
activePorts = {};
const Current = compiled(source), Previous = compiled(oldSource);
const tick = () => new Promise(resolve => setImmediate(resolve));
const outcomes = [];
function fixture(Component = Current, { tailKnown = false, prefixKnown = true, targetKnown = true } = {}) {
  const ports = { frames: [], jumps: [], saves: [], headers: [], leases: [], offset: 0, layoutReady: true, pendingOffset: undefined, closed: [] };
  activePorts = ports;
  const owner = new Component(undefined, {}); ports.owner = owner;
  const geometry = new Map();
  const dimensions = { width: MODEL.width, height: MODEL.height, tileHeight: MODEL.tileHeight };
  if (prefixKnown) geometry.set(21, dimensions);
  if (targetKnown) geometry.set(22, dimensions);
  if (tailKnown) geometry.set(23, dimensions);
  const manifest = { chapter: { sourceId: 's', bookId: 'b', chapterId: 'c' }, manifestVersion: 'v1',
    pages: Array.from({ length: 24 }, (_, ordinal) => ({ ordinal, pageId: `page-${ordinal}`, resourceRef: 'r' })) };
  const controller = {
    chapter: { manifest, chapterIndex: 1, chapterTitle: 'model' }, totalPages: 24, displayedOrdinal: 22,
    savedLocation: null, recoveryRequired: false, preparationError: undefined,
    pageAt: ordinal => controller.chapter.manifest.pages[ordinal], pageGeometry: ordinal => geometry.get(ordinal),
    tile: (ordinal, tileIndex) => geometry.has(ordinal) ? { image: { fileUri: `file://model-${ordinal}-${tileIndex}.png`, revision: 'r1' } } : undefined,
    visiblePages: () => [],
    async setVisible(ordinal, retained) { controller.displayedOrdinal = ordinal; ports.leases.push(['visible', ordinal, retained]); },
    async setTileWindow(rows) { ports.leases.push(['tiles', rows]); },
    prepareViewportPages(ordinals) {
      assert.ok(ordinals.length <= 8);
      return new Promise(resolve => ports.headers.push({ ordinals: [...ordinals], resolve }));
    },
    async savePosition(ordinal, x, y) { ports.saves.push({ ordinal, x, y }); },
    async close(reason) { ports.closed.push(reason); },
  };
  Object.assign(owner, { controller, mounted: true, opened: true, horizontal: false, zoom: 1,
    viewportWidth: MODEL.width / MODEL.density, viewportHeight: MODEL.viewportHeight / MODEL.density,
    first: 0, last: 0, fitPreference: 'width', publishedManifestVersion: 'v1', chapterCommitted: true,
    sourceId: 's', bookId: 'b', isReaderIdentityCurrent: () => true });
  owner.data.projection.publish(manifest, controller.pageGeometry, undefined, 24, controller.pageAt);
  owner.data.registerDataChangeListener({ onDataReloaded() { ports.layoutReady = false; }, onDataChange() {} });
  controller.onChange = () => owner.publish();
  owner.imageViewport();
  const list = [...owner.nodes.values()].find(node => node.type === 'List');
  assert.equal(typeof list.onTouch, 'function'); assert.equal(typeof list.onScrollIndex, 'function');
  function frame() {
    activePorts = ports;
    const batch = ports.frames.splice(0);
    for (const callback of batch) callback.onFrame(0);
    ports.layoutReady = true;
    if (ports.pendingOffset !== undefined) { ports.offset = ports.pendingOffset; ports.pendingOffset = undefined; }
    for (const callback of batch) callback.onIdle(2_000_000);
  }
  async function settle() { for (let i = 0; i < 4; i++) { frame(); await tick(); } }
  function receipt(ordinal) {
    activePorts = ports;
    geometry.set(ordinal, dimensions);
    controller.onChange?.();
    for (const request of ports.headers) if (request.ordinals.every(page => geometry.has(page))) request.resolve();
  }
  return { owner, ports, controller, geometry, dimensions, list, frame, settle, receipt };
}
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }

{
  const old = fixture(Previous);
  old.owner.restore(22, REQUESTED_Y); await old.settle();
  const clipped = old.owner.confirmedPosition.anchor.y;
  near(clipped, 0.47241756524457384);
  assert.equal(old.owner.first, 27); assert.equal(old.owner.restoringAnchor, false);
  const count = old.ports.jumps.length;
  old.receipt(23); await old.settle();
  assert.equal(old.owner.data.projection.affectsAnchor(22), false);
  assert.equal(old.ports.jumps.length, count); near(old.owner.confirmedPosition.anchor.y, clipped);
  outcomes.push('immutable e1 methods lose .672 intent to .472 temporary tail clamp; late tail geometry does not replay it (model only)');
}
{
  const f = fixture();
  f.owner.restore(22, REQUESTED_Y); await f.settle();
  assert.equal(f.owner.restoringAnchor, true); near(f.owner.pendingRestoreAnchor.y, REQUESTED_Y);
  assert.equal(f.owner.confirmedPosition, undefined);
  assert.ok(f.ports.headers.some(request => request.ordinals.includes(23)), 'actual updateViewport demands the visible unknown header');
  await f.owner.saveVisible(); assert.deepEqual(f.ports.saves, []);
  assert.equal(f.owner.first, 27);
  f.receipt(23); await f.settle();
  assert.equal(f.ports.jumps.length, 2); near(f.owner.confirmedPosition.anchor.y, REQUESTED_Y);
  assert.equal(f.owner.restoringAnchor, false); assert.equal(f.owner.pendingRestoreAnchor, undefined);
  await f.owner.saveVisible(); near(f.ports.saves.at(-1).y, REQUESTED_Y);
  outcomes.push('current SDK retains requested intent without early save, demands only the visible header and replays after its late geometry');
}
{
  const f = fixture(Current, { tailKnown: true });
  f.owner.restore(22, REQUESTED_Y); await f.settle();
  near(f.owner.confirmedPosition.anchor.y, REQUESTED_Y); assert.equal(f.ports.jumps.length, 1);
  assert.deepEqual(f.ports.headers, []);
  outcomes.push('fully known warm layout preserves the requested coordinate with one atomic jump');
}
{
  const f = fixture(); f.owner.restore(22, REQUESTED_Y); await f.settle();
  f.list.onTouch({ type: 0 }); await f.settle();
  assert.equal(f.owner.pendingRestoreAnchor, undefined);
  const userY = f.owner.confirmedPosition.anchor.y, count = f.ports.jumps.length;
  f.receipt(23); await f.settle();
  assert.equal(f.ports.jumps.length, count); near(f.owner.confirmedPosition.anchor.y, userY);
  outcomes.push('actual SDK touch callback cancels old intent so a late header cannot replay it over user input');
}
{
  const f = fixture(); f.owner.restore(22, REQUESTED_Y);
  const before = f.owner.layoutGeneration;
  // The new viewport fits inside the known remainder of page 22. A late
  // following header therefore cannot revive the superseded large jump.
  f.owner.resizeViewport(f.owner.viewportWidth, 600 / MODEL.density);
  assert.ok(f.owner.layoutGeneration > before);
  await f.settle();
  assert.equal(f.ports.jumps.length, 1, 'resize supersedes the queued old-size jump');
  assert.equal(f.owner.restoringAnchor, false); near(f.owner.confirmedPosition.anchor.y, REQUESTED_Y);
  f.receipt(23); await f.settle(); assert.equal(f.ports.jumps.length, 1);
  outcomes.push('resize supersedes the pending frame and measures the original normalized coordinate in the new viewport');
}
{
  const f = fixture(Current, { prefixKnown: false });
  f.owner.restore(22, REQUESTED_Y); await f.settle();
  assert.equal(f.owner.restoringAnchor, true);
  f.receipt(21); await f.settle();
  near(f.owner.pendingRestoreAnchor.y, REQUESTED_Y); assert.equal(f.owner.restoringAnchor, true);
  assert.equal(f.owner.first, 27);
  f.receipt(23); await f.settle();
  near(f.owner.confirmedPosition.anchor.y, REQUESTED_Y); assert.equal(f.owner.restoringAnchor, false);
  assert.equal(f.ports.jumps.length, 3);
  outcomes.push('late prefix row expansion and later tail expansion both replay the original intent without confirming unknown visible rows');
}
{
  const f = fixture(Current, { targetKnown: false });
  f.owner.restore(22, REQUESTED_Y); await f.settle();
  assert.equal(f.owner.confirmedPosition, undefined); assert.equal(f.owner.restoringAnchor, true);
  assert.ok(f.ports.headers.some(request => request.ordinals.includes(22)));
  f.receipt(22); await f.settle(); near(f.owner.pendingRestoreAnchor.y, REQUESTED_Y);
  f.receipt(23); await f.settle(); near(f.owner.confirmedPosition.anchor.y, REQUESTED_Y);
  outcomes.push('unknown target geometry cannot commit a placeholder; target and tail header receipts preserve the requested coordinate');
}
{
  const f = fixture(); f.owner.restore(22, REQUESTED_Y); await f.settle();
  const withdrawn = f.owner.pendingRestoreAnchor;
  f.controller.chapter.manifest = { ...f.controller.chapter.manifest, manifestVersion: 'v2' };
  f.owner.publish(); await f.settle();
  assert.notEqual(f.owner.pendingRestoreAnchor, withdrawn);
  near(f.owner.pendingRestoreAnchor.y, 0, 'new manifest starts its own unsaved location');
  assert.equal(f.ports.jumps.length, 2);
  f.receipt(23); await f.settle(); near(f.owner.confirmedPosition.anchor.y, 0);
  assert.equal(f.owner.pendingRestoreAnchor, undefined);
  outcomes.push('manifest replacement withdraws the old restoration intent');
}
{
  const f = fixture(); f.owner.restore(22, REQUESTED_Y);
  f.owner.aboutToDisappear(); await f.settle();
  assert.equal(f.owner.pendingRestoreAnchor, undefined); assert.equal(f.owner.mounted, false);
  assert.equal(f.ports.jumps.length, 0); assert.deepEqual(f.ports.closed, ['exit']);
  f.receipt(23); await f.settle(); assert.equal(f.ports.jumps.length, 0);
  outcomes.push('production lifecycle withdraws intent and queued frames before a late receipt can scroll the unmounted reader');
}
for (const outcome of outcomes) console.log(`PASS ${outcome}`);
console.log(`PASS ${outcomes.length} actual SDK restore-intent groups; model geometry is not native/user acceptance`);
