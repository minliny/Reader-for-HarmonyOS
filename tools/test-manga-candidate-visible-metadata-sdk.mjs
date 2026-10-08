import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {createArkUIPropertyRuntimeProbe} from './lib/arkui-property-runtime-probe.mjs';
import {mangaSurfaceSdkDependencies, mountMangaViewportBuilder} from './lib/manga-surface-sdk-probe.mjs';
import {createDefaultReaderWindowMetrics, readerInteractiveSafeInsets} from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

// Real Controller/Coordinator and SDK-emitted Surface/Image callbacks. Core,
// decoding, native rectangles, render delivery and imported children are ports;
// this proves candidate liveness/admission, not native pixels or VM ordering.
const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
const controllerSource = readFileSync(new URL('MangaSessionController.ts', root), 'utf8');
function load(name, dependencies = {}, text = readFileSync(new URL(`${name}.ts`, root), 'utf8')) {
  const source = text.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)};return ${name}`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway'), MangaResourceGateway = load('MangaResourceGateway');
const MangaChapterPreparationCoordinator = load('MangaChapterPreparationCoordinator', {MangaSessionGateway, MangaResourceGateway});
const dependencies = {MangaSessionGateway, MangaResourceGateway, MangaChapterPreparationCoordinator};
const Controller = load('MangaSessionController', dependencies, controllerSource), Projection = load('MangaStripProjection');
const oldSkip = controllerSource.replace('void Promise.all(Array.from(wanted).filter(index => index !== ordinal)',
  'if (!this.candidatePendingPresentation) void Promise.all(Array.from(wanted).filter(index => index !== ordinal)');
assert.notEqual(oldSkip, controllerSource, 'counterfactual restores the exact omitted candidate-neighbor branch');
const SkippingController = load('MangaSessionController', dependencies, oldSkip);
const source = readFileSync(new URL('MangaReadingSurface.ets', root), 'utf8');
const require = createRequire(import.meta.url), sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile('/tmp/MangaCandidateVisibleMetadata.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS,
  require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length, 0);
const component = tree.statements.find(node => node.name?.getText(tree) === 'MangaReadingSurface');
const names = component.members.map(node => node.name?.getText(tree)).filter(Boolean);
const classText = name => tree.statements.find(node => node.name?.getText(tree) === name).getText(tree);
const DataSource = new Function('MangaStripProjection', `${stripTypeScriptTypes(classText('MangaStripDataSource'))};return MangaStripDataSource`)(Projection);
const Frame = new Function('FrameCallback', `${stripTypeScriptTypes(classText('MangaLayoutFrame'))};return MangaLayoutFrame`)(class {});
const gesture = new Proxy({}, {get: () => () => {}}), tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};}
async function settle() {for (let i = 0; i < 12; i++) await tick();}

async function fixture(Type = Controller, {short = false, count = 6} = {}) {
  const pages = Array.from({length: count}, (_, ordinal) => {const pageId = `mp1:${String(ordinal + 1).padStart(64, '0')}`; return {ordinal, pageId, resourceRef: `manga:${pageId}`};});
  const chapter = {chapterIndex: 7, chapterTitle: 'Candidate', totalPages: count, pageStart: 0, cached: true, resources: [],
    manifest: {chapter: {sourceId: 's', bookId: 'b', chapterId: '/candidate'}, manifestVersion: 'v1', sourceRuleVersion: 'rules', decodeRevision: 'identity-v1', pages: pages.slice(0, 3)}};
  const entry = {chapter, targetOrdinal: 0, recoveryRequired: false, progress: {token: {epoch: 1, revision: 0}, location: null}};
  const header = deferred(), calls = [], images = [], released = [], frames = [];
  const windowHolds = new Map(); let alive = true, held = true, revision = 0;
  const runtime = {supportsCoreCapability: () => true, captureReadingContentValidity: () => () => alive,
    isMangaPreparationForeground: () => false, allowOptionalMangaPreparation: () => false,
    requestBook: (...args) => runtime.request(...args),
    async request(method, params) {
      calls.push({method, params});
      if (method === 'manga.session.runtime') return {data: {runtimeEpoch: 1}};
      if (method === 'manga.session.replace') return {data: {protected: params.chapters.length, runtimeEpoch: 1}};
      if (method === 'manga.session.release') return {data: {released: true}};
      if (method === 'manga.pages.window') {if (windowHolds.has(params.start)) await windowHolds.get(params.start); return {data: {...chapter, pageStart: params.start, manifest: {...chapter.manifest, pages: pages.slice(params.start, params.start + params.limit)}}};}
      if (method === 'reading.progress.get') return {data: {token: {epoch: 1, revision}, location: null}};
      if (method === 'reading.progress.update') {assert.equal(params.expectedRevision, revision); return {data: {token: {epoch: 1, revision: ++revision}, location: params.location}};}
      if (method === 'manga.cache.recordRead') return {data: {recorded: true}};
      throw Error(`Unexpected candidate request ${method}`);
    },
    async loadReadingImage(...args) {
      const ordinal = pages.find(page => page.resourceRef === args[8]).ordinal;
      const image = {ordinal, position: args[9], fileUri: `file://candidate-${images.length}`, width: 300, height: 300,
        intrinsicWidth: 300, intrinsicHeight: short ? 300 : ordinal === 0 ? 1500 : 900, revision: 'pixels'};
      images.push(image); assert.equal(args[6], false, 'candidate metadata honors cache-only');
      if (ordinal === 1 && args[9] === 0 && held) await header.promise;
      return image;
    }, releaseReadingImage(uri) {released.push(uri);},
  };
  const controller = new Type(runtime); await controller.openCandidate(entry, 'first', true, false, () => alive);
  if (!short) await controller.setTileWindow(Array.from({length: 5}, (_, tileIndex) => ({ordinal: 0, tileIndex})));
  let generatedOwner;
  class ListScroller {
    getItemIndex(_x, y) {
      for (let index = 0; index < generatedOwner.data.totalCount(); index++) {const rect = this.getItemRect(index); if (y >= rect.y && y < rect.y + rect.height) return index;}
      return -1;
    }
    getItemRect(index) {
      let y = 0; for (let prior = 0; prior < index; prior++) y += generatedOwner.rowDisplayHeight(generatedOwner.data.getData(prior));
      return {x: 0, y, width: 300, height: generatedOwner.rowDisplayHeight(generatedOwner.data.getData(index))};
    }
    scrollToIndex() {} isAtEnd() {return false;}
  }
  class Scroller {currentOffset() {return {xOffset: 0};} scrollTo() {}}
  const properties = createArkUIPropertyRuntimeProbe(); let mountedRows = [];
  const pairedOldSurface = Type === SkippingController ? source.replace('await controller.prepareViewportPages(visiblePages);', 'await Promise.resolve();') : source;
  if (Type === SkippingController) assert.notEqual(pairedOldSurface, source, 'the old combination has no explicit visible metadata demand');
  const {owner} = createReaderBuilderProbe(pairedOldSurface, names, {...properties.sdk, ...mangaSurfaceSdkDependencies,
    MangaStripDataSource: DataSource, MangaLayoutFrame: Frame, ListScroller, Scroller, PhotoViewScaleModel: class {},
    ReaderWindowCoordinator: {metrics: () => createDefaultReaderWindowMetrics()}, readerInteractiveSafeInsets,
    hilog: {info() {}, warn() {}, error() {}}, uiContext: {postFrameCallback: frame => frames.push(frame)}, setTimeout: () => 0,
    ScrollAlign: {START: 'start'}, ImageFit: {Fill: 0}, ScrollDirection: {Horizontal: 0}, TouchType: {Down: 0},
    LazyForEach: {create(_id, _owner, data, item) {for (const index of mountedRows) item(data.getData(index), index);}, pop() {}},
    Gesture: gesture, GestureGroup: gesture, PinchGesture: gesture, SwipeGesture: gesture, TapGesture: gesture,
    globalThis: {Gesture: gesture, GestureGroup: gesture, PinchGesture: gesture, SwipeGesture: gesture, TapGesture: gesture},
    GesturePriority: {Parallel: 0}, GestureMode: {Exclusive: 0}, SwipeDirection: {Horizontal: 0}}, properties.hooks);
  generatedOwner = owner;
  owner.initialRender(); mountMangaViewportBuilder(owner);
  const list = [...owner.nodes.values()].find(node => node.type === 'List'); assert.ok(list.onScrollIndex);
  Object.assign(owner, {controller, mounted: true, opened: true, chapterCommitted: true, viewportWidth: 300, viewportHeight: 1700,
    first: 0, last: 0, publishedManifestVersion: 'v1', boundaryBusy: true, boundaryPaintGeneration: 1,
    previousChapterPixels: [{key: 'origin', uri: 'file://origin', x: 0, y: 0, width: 300, height: 1700}]});
  owner.data.projection.publish(controller.chapter.manifest, index => controller.pageGeometry(index), undefined, controller.totalPages, index => controller.pageAt(index));
  owner.data.registerDataChangeListener({onDataReloaded() {}, onDataChange() {}});
  owner.pendingChapterTransition = {controller, landing: 'first', targetOrdinal: 0, landingTileIndex: 0};
  let commits = 0; owner.nativeTransitionResolve = () => {commits++;};
  controller.onChange = () => owner.publish();
  list.onScrollIndex(0, owner.scroller.getItemIndex(0.5, owner.viewportHeight - 0.5)); await settle(); assert.equal(owner.rememberVisible(), true);
  const noAdmission = () => {
    assert.equal(controller.displayedOrdinal, 0, 'metadata never selects the neighbor as the candidate target');
    assert.equal(calls.some(call => ['manga.cache.recordRead', 'reading.progress.update'].includes(call.method)), false);
    assert.equal(controller.visiblePages().length <= 3 + 8, true, 'base metadata plus exact visible headers never exceeds three plus eight');
  };
  const complete = index => {
    const row = owner.data.getData(index), tile = controller.tile(row.ordinal, row.tileIndex);
    assert.ok(tile?.image); owner.tileImage(row, tile.image.fileUri, owner.rowRenderKey(row), controller, controller.chapter.manifest);
    const image = [...owner.nodes.values()].filter(node => node.type === 'Image' && typeof node.onComplete === 'function').at(-1);
    image.onComplete({loadingStatus: 1});
  };
  const flush = () => {let count = 0; while (frames.length) {assert.ok(++count <= 24); const frame = frames.shift(); frame.onFrame(0); frame.onIdle(0);}};
  return {owner, controller, runtime, list, header, calls, images, released, noAdmission, complete, flush,
    reportNativeRange() {list.onScrollIndex(0, owner.scroller.getItemIndex(0.5, owner.viewportHeight - 0.5));},
    mountRow(index) {
      mountedRows = [index]; owner.imageViewport(); mountedRows = [];
      const row = [...owner.nodes.values()].filter(node => node.type === 'ListItem' && typeof node.onAppear === 'function').at(-1);
      assert.ok(row); row.onAppear(); // Real SDK-emitted known/unknown row callback.
    },
    get commits() {return commits;}, releaseHeader() {held = false; header.resolve();}, invalidate() {alive = false;},
    holdWindow(ordinal, promise) {windowHolds.set(ordinal, promise);},
    async reopen() {alive = true; controller.onChange = undefined; await controller.openCandidate(structuredClone(entry), 'first', true, false, () => alive);},
    async close() {controller.onChange = undefined; await controller.close('candidate'); await MangaChapterPreparationCoordinator.forRuntime(runtime).close();}};
}

for (const Type of [Controller, SkippingController]) {
  const f = await fixture(Type);
  for (let index = 0; index < 5; index++) f.complete(index);
  f.flush(); f.noAdmission(); assert.equal(f.commits, 0, 'five decoded regions cannot admit a sixth visible placeholder');
  assert.equal(f.owner.data.getData(5).known, false); assert.equal(f.owner.nativeTransitionImages.size, 5);
  assert.equal(f.owner.previousChapterPixels.length, 1, 'origin survives while visible candidate pixels are incomplete');
  await assert.rejects(f.controller.savePosition(0, 0, 0), /NOT_PRESENTED/);
  f.releaseHeader(); await settle();
  f.mountRow(5); await f.owner.updateViewport(); await settle();
  f.noAdmission();
  if (Type === SkippingController) {
    assert.equal(f.images.length, 5, 'old candidate skip never starts the neighbor header');
    assert.equal(f.owner.data.getData(5).known, false); assert.equal(f.controller.tile(1, 0), undefined);
    f.flush(); assert.equal(f.commits, 0, 'source-negative retains the stable five-image deadlock');
  } else {
    assert.equal(f.owner.data.getData(5).known, true); assert.ok(f.controller.tile(1, 0)?.image);
    f.flush(); assert.equal(f.commits, 0, 'header/decoded lease alone is not the sixth native Image receipt');
    f.complete(5); f.flush(); assert.ok(f.commits > 0, 'all actual visible native images release the existing paint gate');
    f.noAdmission(); await f.controller.activateCandidate(() => true); f.noAdmission();
    f.controller.confirmCandidatePresented(); await settle();
    assert.equal(f.calls.filter(call => call.method === 'manga.cache.recordRead').length, 1, 'native confirmation first enables the actual read clock');
    await f.controller.savePosition(0, 0, 0);
    assert.equal(f.calls.filter(call => call.method === 'reading.progress.update').length, 1);
  }
  await f.close();
}
console.log('PASS actual candidate + SDK six-row paint: bounded neighbor metadata makes the sixth visible Image demandable; five receipts, metadata alone and old-skip counterfactual never commit; target/clock/progress stay gated');

{
  const f = await fixture(Controller, {short: true}); f.releaseHeader();
  // Reflow shrinks unknown placeholders into real short pages, revealing more
  // rows. Feed their actual cumulative rectangles through the native callback,
  // then deliver real after-render frames until the six-row range settles.
  for (let pass = 0; pass < 4; pass++) {await settle(); f.reportNativeRange(); await f.owner.updateViewport(); await settle(); f.flush();}
  assert.deepEqual([f.owner.first, f.owner.last], [0, 5]);
  for (let ordinal = 0; ordinal < 6; ordinal++) {
    assert.ok(f.controller.pageGeometry(ordinal)); assert.ok(f.controller.tile(ordinal, 0)?.image);
  }
  assert.equal(f.controller.visiblePages().length, 6); f.noAdmission();
  const windows = f.calls.filter(call => call.method === 'manga.pages.window');
  assert.deepEqual(windows.map(call => [call.params.start, call.params.limit]), [[3, 1], [4, 1], [5, 1]],
    'only missing visible facts are acquired, with no chapter-wide or unrelated window');
  assert.equal(f.images.every(image => image.position === 0), true, 'short pages need only their existing first-region header');
  for (let index = 0; index < 5; index++) f.complete(index);
  f.flush(); assert.equal(f.commits, 0, 'five of six short logical pages cannot admit the candidate');
  f.complete(5); f.flush(); assert.ok(f.commits > 0); f.noAdmission();
  await f.controller.activateCandidate(() => true); f.noAdmission();
  f.controller.confirmCandidatePresented(); await settle();
  assert.equal(f.calls.filter(call => call.method === 'manga.cache.recordRead').length, 1);
  await f.controller.savePosition(0, 0, 0);
  assert.equal(f.calls.filter(call => call.method === 'reading.progress.update').length, 1);
  await f.close();
}
console.log('PASS six short visible pages: exact metadata follows real projection reflow and SDK ranges without selecting a neighbor; all native receipts precede clock/progress');

{
  const f = await fixture(Controller, {short: true, count: 900}); f.releaseHeader(); await settle();
  const before = [f.calls.length, f.images.length];
  await assert.rejects(f.controller.prepareViewportPages(Array.from({length: 9}, () => 0)), /TILE_WINDOW_BUDGET/);
  for (const ordinal of [-1, 900, 0.5, NaN]) await assert.rejects(f.controller.prepareViewportPages([ordinal]), /PAGE_OUT_OF_RANGE/);
  assert.deepEqual([f.calls.length, f.images.length], before, 'invalid input has no RPC/decode side effects');
  const exact = [100, 200, 300, 400, 500, 600, 700, 800];
  await f.controller.prepareViewportPages(exact);
  const windowStart = f.calls.length;
  assert.equal(f.controller.visiblePages().length <= 3 + 8, true);
  for (const ordinal of exact) assert.ok(f.controller.pageGeometry(ordinal));
  const missing = f.calls.filter(call => call.method === 'manga.pages.window');
  assert.equal(missing.every(call => call.params.limit <= 3), true);
  assert.deepEqual(missing.filter(call => exact.includes(call.params.start)).map(call => call.params.limit), Array(8).fill(1));
  const oldHeaders = f.images.filter(image => exact.includes(image.ordinal));
  await f.controller.prepareViewportPages([50, 51, 52, 53, 54, 55, 56, 57]);
  assert.equal(f.controller.visiblePages().length <= 3 + 8, true, 'new explicit window replaces rather than accumulates old header owners');
  assert.equal(f.calls.slice(windowStart).filter(call => call.method === 'manga.pages.window').length, 8);
  for (const image of oldHeaders) assert.equal(f.released.filter(uri => uri === image.fileUri).length, 1);
  f.noAdmission(); await f.close();
}
console.log('PASS visible metadata input/cache bounds: invalid work has no effects; eight exact sparse facts use one-page windows; departed headers retire while target0 and admission stay protected');

{
  const f = await fixture(Controller, {short: true}); f.releaseHeader(); await settle();
  const gate = deferred(); f.holdWindow(5, gate.promise);
  const old = f.controller.prepareViewportPages([5]); const rejected = assert.rejects(old, /SESSION_CANCELLED/); await settle();
  assert.ok(f.calls.some(call => call.method === 'manga.pages.window' && call.params.start === 5));
  assert.equal(f.controller.pageAt(5), undefined);
  await f.controller.prepareViewportPages([4]);
  gate.resolve(); await rejected; await settle();
  assert.equal(f.controller.pageAt(5), undefined, 'a superseded exact-window reply cannot admit even its fact');
  assert.equal(f.controller.pageGeometry(5), undefined); assert.equal(f.images.some(image => image.ordinal === 5), false);
  assert.ok(f.controller.pageGeometry(4), 'new metadata owner survives the old Core reply');
  f.noAdmission(); await f.close();
}
console.log('PASS exact-window supersession fences late Core facts before decoding and retains the newer bounded metadata owner');

{
  const f = await fixture(Controller, {short: true}); f.releaseHeader(); await settle();
  const gate = deferred(); f.holdWindow(5, gate.promise);
  const pending = f.controller.prepareViewportPages([5]); const rejected = assert.rejects(pending, /MANGA_SESSION_CONTENT_CHANGED/); await settle();
  f.invalidate(); gate.resolve(); await rejected; await settle();
  assert.equal(f.controller.pageAt(5), undefined); assert.equal(f.controller.pageGeometry(5), undefined);
  assert.equal(f.images.some(image => image.ordinal === 5), false);
  const before = [f.calls.length, f.images.length]; await assert.rejects(f.controller.prepareViewportPages([0]), /MANGA_SESSION_CONTENT_CHANGED/);
  assert.deepEqual([f.calls.length, f.images.length], before, 'revoked scope is terminal instead of retrying even a known page');
  f.noAdmission(); await f.close();
}
console.log('PASS content revocation maps a pending exact window to the existing terminal content-change path without facts, bytes, clock or progress');

{
  const f = await fixture(Controller, {short: true});
  const oldHeader = f.images.find(image => image.ordinal === 1); assert.ok(oldHeader);
  const old = f.controller.prepareViewportPages([0, 1]); const rejected = assert.rejects(old, /SESSION_CANCELLED/); await settle();
  f.owner.mounted = false; f.invalidate(); await f.controller.close('candidate'); await f.reopen();
  const newHeader = f.images.filter(image => image.ordinal === 1).at(-1); assert.notEqual(newHeader.fileUri, oldHeader.fileUri);
  const current = f.controller.prepareViewportPages([0, 1]); f.releaseHeader(); await rejected; await current; await settle();
  assert.equal(f.released.filter(uri => uri === oldHeader.fileUri).length, 1);
  assert.equal(f.released.includes(newHeader.fileUri), false, 'old finalizer cannot release or replace the new same-page header');
  assert.ok(f.controller.pageGeometry(1)); assert.equal(f.controller.visiblePages().find(page => page.ordinal === 1).image.fileUri, newHeader.fileUri);
  f.noAdmission(); await f.close();
}
console.log('PASS cancel/reopen exact metadata separates same-key header owners; old pixels release once and never revive or remove the new candidate');

{
  const f = await fixture(); assert.ok(f.images.some(image => image.ordinal === 1), 'candidate neighbor has a real pending owner');
  const oldHeader = f.images.find(image => image.ordinal === 1);
  f.invalidate(); await f.controller.close('candidate'); f.releaseHeader(); await settle();
  assert.equal(f.controller.chapter, undefined); assert.equal(f.controller.pageGeometry(1), undefined);
  assert.equal(f.released.filter(uri => uri === oldHeader.fileUri).length, 1, 'late canceled neighbor pixels release once without reviving the controller');
  assert.equal(f.calls.some(call => ['manga.cache.recordRead', 'reading.progress.update'].includes(call.method)), false);
  await f.close();
}
console.log('PASS late canceled candidate header has no publication/admission or leaked display lease');
console.log('BOUNDARY actual SDK and production owners; controlled Core, decode, rectangles, frames and imported child mounting. Actual sixth native row identity remains a separate evidence question.');
