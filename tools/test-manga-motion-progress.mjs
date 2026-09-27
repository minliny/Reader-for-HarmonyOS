import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, registerHooks, stripTypeScriptTypes} from 'node:module';
registerHooks({resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; }
}});
const {productionMotionMethods} = await import('./lib/reader-motion-method-probe.mjs');
const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
function load(name, dependencies = {}) {
  const source = readFileSync(new URL(`${name}.ts`, root), 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name.split('/').at(-1)};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway');
const MangaResourceGateway = load('MangaResourceGateway');
const Controller = load('MangaSessionController', {MangaSessionGateway, MangaResourceGateway});
const Projection = load('MangaStripProjection');
const Scale = load('vendor/photoview/PhotoViewScaleModel');
const surfaceURL = process.env.READER_MANGA_MOTION_SURFACE ?? new URL('MangaReadingSurface.ets', root);
const source = readFileSync(surfaceURL, 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile('/tmp/MangaMotionProgress.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length, 0);
const frame = tree.statements.find(node => node.name?.getText(tree) === 'MangaLayoutFrame');
const MangaLayoutFrame = new Function('FrameCallback', `${stripTypeScriptTypes(frame.getText(tree))};return MangaLayoutFrame`)(class {});
const memberNames = new Set(tree.statements.find(node => node.name?.getText(tree) === 'MangaReadingSurface').members.map(node => node.name?.getText(tree)));
const stopCallbacks = [];
function visit(node) {
  if (ts.isCallExpression(node) && node.expression?.name?.text === 'onScrollStop') stopCallbacks.push(node.arguments[0].getText(tree));
  ts.forEachChild(node, visit);
}
visit(tree);
assert.equal(stopCallbacks.length, 2);
function stop(owner, index) {
  new Function(`${stripTypeScriptTypes(`const callback = ${stopCallbacks[index]};`)}\nreturn callback;`).call(owner)();
}
const methods = ['saveVisible', 'rememberVisible', 'positionIdentity', 'effectiveFit', 'rowDisplayWidth', 'rowDisplayHeight', 'rowDisplayTop', 'rowDisplayLeft', 'visibleX', 'changeZoom', 'restore', 'finishLayout', 'onViewportScroll', 'onViewportTouch', 'measureVisibleWindow', 'changeFit', 'toggleDirection', 'turnPage', 'refreshImages', 'aboutToDisappear'];
const timers = [];
// Optional baseline path executes the pre-fix methods against the same assertions.
const Surface = productionMotionMethods(surfaceURL, methods.filter(name => memberNames.has(name)), {
  setTimeout: callback => timers.push(callback), ScrollAlign: {START: 0}, MangaLayoutFrame
});
const pages = [0, 1, 2].map(ordinal => ({ordinal, pageId: `mp1:${String(ordinal).repeat(64)}`, resourceRef: `manga:mp1:${String(ordinal).repeat(64)}`}));
const entry = {chapter: {manifest: {chapter: {sourceId: 's', bookId: 'b', chapterId: '/c'}, sourceRuleVersion: 'r', manifestVersion: 'v', decodeRevision: 'identity-v1', pages}, chapterIndex: 0, chapterTitle: 'c', totalPages: 3, pageStart: 0, cached: true, resources: []}, targetOrdinal: 1, recoveryRequired: false, progress: {token: {epoch: 1, revision: 0}, location: null}};
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; }
async function fixture(horizontal = false) {
  const writes = [], frames = [], failures = [];
  let saveHold, imageHold, revision = 0;
  const runtime = {supportsCoreCapability: () => true,
    async request(method, params) {
      assert.equal(method, 'reading.progress.update');
      assert.equal(params.kind, 'manga', 'the actual gateway must never write novel progress');
      assert.equal(params.expectedRevision, revision, 'the actual controller retains serialized CAS');
      writes.push(structuredClone(params));
      if (saveHold) await saveHold;
      revision++;
      return {data: {token: {epoch: 1, revision}, location: params.location}};
    },
    async loadReadingImage() {
      if (imageHold) await imageHold;
      return {fileUri: 'file://image', width: 1000, height: 1000, intrinsicWidth: 1000, intrinsicHeight: 10000, revision: 'r'};
    }, releaseReadingImage() {}
  };
  const controller = new Controller(runtime);
  await controller.openPrepared(structuredClone(entry), true); await tick();
  await controller.setTileWindow([{ordinal: 1, tileIndex: 5}, {ordinal: 2, tileIndex: 0}]);
  const projection = new Projection();
  projection.publish(controller.chapter.manifest, ordinal => controller.pageGeometry(ordinal), horizontal ? 1 : undefined, 3, ordinal => controller.pageAt(ordinal));
  const native = {first: projection.index(1, 0.5), y: -100, width: 1000, height: 1000, xOffset: 100};
  const surface = Object.assign(new Surface(), {controller, runtime,
    data: {projection, totalCount: () => projection.totalCount(), getData: index => projection.row(index), notify() {}},
    first: native.first, last: native.first, mounted: true, opened: true, recovering: false,
    horizontal, horizontalPage: 1, zoom: 2, scalePolicy: new Scale(), viewportWidth: 500, viewportHeight: 900,
    fitPreference: 'width', layoutGeneration: 0, viewportGeneration: 0, presentationGeneration: 0, appliedLayoutGeneration: -1, loginGeneration: 0,
    restoringAnchor: false, error: '', settingsGateway: {updateMangaDirection: async () => {}, updateMangaFit: async () => {}},
    scroller: {getItemIndex: () => native.first, getItemRect: () => ({y: native.y, width: native.width, height: native.height}), scrollToIndex() {}, scrollBy() {}},
    horizontalScroller: {currentOffset: () => ({xOffset: native.xOffset}), scrollTo() {}},
    getUIContext: () => ({postFrameCallback: callback => frames.push(callback)}),
    updateViewport() {}, onSaveFailure: message => failures.push(message)
  });
  return {surface, controller, projection, native, writes, failures,
    holdSave(promise) { saveHold = promise; }, holdImage(promise) { imageHold = promise; },
    timer() { const callback = timers.shift(); assert.ok(callback); callback(); },
    frame() { const callback = frames.shift(); assert.ok(callback instanceof MangaLayoutFrame); callback.onFrame(0); },
    close() { surface.aboutToDisappear(); timers.length = 0; frames.length = 0; }
  };
}

const zoom = await fixture();
zoom.surface.rememberVisible();
const anchor = {ordinal: 1, y: 0.51, x: 0.1};
assert.deepEqual(zoom.surface.visibleAnchor, anchor);
zoom.surface.changeZoom(3);
await zoom.surface.saveVisible();
assert.equal(zoom.writes[0].location.x, anchor.x, 'queued zoom must save the confirmed old x, not new scale with old native offset');
assert.equal(zoom.writes[0].location.y, anchor.y);
zoom.timer();
zoom.surface.rememberVisible();
assert.deepEqual(zoom.surface.visibleAnchor, anchor, 'timer issuance is not native layout completion');
await zoom.surface.saveVisible();
assert.equal(zoom.writes[1].location.y, anchor.y);
zoom.frame();
assert.equal(zoom.surface.restoringAnchor, true, 'a frame with the old 1000px rectangle must not confirm a 1500px row');
assert.deepEqual(zoom.surface.visibleAnchor, anchor);
zoom.native.width = 1500; zoom.native.height = 1500; zoom.native.y = -150; zoom.native.xOffset = 150;
stop(zoom.surface, 0); await tick();
assert.equal(zoom.surface.restoringAnchor, false, 'an actual matching layout event releases the barrier without a frame retry loop');
assert.deepEqual(zoom.writes.map(write => [write.location.x, write.location.y]), [[0.1, 0.51], [0.1, 0.51], [0.1, 0.51]]);
zoom.surface.changeZoom(2); zoom.timer(); zoom.frame();
zoom.native.width = 1000; zoom.native.height = 1000; zoom.native.y = -100; zoom.native.xOffset = 200;
stop(zoom.surface, 1); await tick();
assert.equal(zoom.surface.restoringAnchor, false, 'horizontal scroll stop also confirms the final stable geometry');
assert.equal(zoom.writes.at(-1).location.x, 0.2);
zoom.close();
console.log('PASS actual Surface + Controller + Gateway: zoom before timer, after timer, early frame, matching native layout and serial manga-only CAS');

const touch = await fixture();
touch.surface.rememberVisible(); touch.surface.changeZoom(3); touch.timer();
touch.surface.onViewportTouch();
touch.surface.changeZoom(2.5); // A newer restore owns the logical target and barrier.
touch.frame(); touch.frame();
assert.equal(touch.surface.restoringAnchor, true, 'old restore and touch callbacks cannot settle the newer restore');
await touch.surface.saveVisible();
assert.equal(touch.writes[0].location.y, 0.51);
touch.timer(); touch.native.width = 1250; touch.native.height = 1250; touch.native.y = -125; touch.native.xOffset = 125;
touch.frame(); assert.equal(touch.surface.restoringAnchor, false);
touch.surface.changeZoom(3); touch.surface.onViewportTouch();
touch.timer(); // Canceled before the queued scroll: it must not enqueue a new frame.
assert.equal(touch.surface.restoringAnchor, true);
touch.native.width = 1500; touch.native.height = 1500; touch.native.y = -300; touch.native.xOffset = 300;
touch.frame(); await touch.surface.saveVisible();
assert.equal(touch.writes.at(-1).location.y, 0.52, 'the user-canceled restore captures the measured user position');
touch.close();
console.log('PASS actual touch cancellation and superseding restore: stale frames cannot clear the new anchor; user geometry can settle');

for (const mutation of ['direction', 'direction-round-trip', 'zoom', 'chapter', 'refresh-intent', 'exit']) {
  const f = await fixture(true); const wait = deferred(); f.holdSave(wait.promise);
  const turning = f.surface.turnPage(1); await tick(); assert.equal(f.writes.length, 1);
  if (mutation === 'direction') f.surface.toggleDirection();
  if (mutation === 'direction-round-trip') { f.surface.toggleDirection(); f.surface.toggleDirection(); }
  if (mutation === 'zoom') f.surface.changeZoom(3);
  if (mutation === 'chapter') await f.controller.openPrepared(structuredClone(entry), true);
  let refreshing;
  if (mutation === 'refresh-intent') {
    // The real method starts by accepting/saving current intent. Bound its Core
    // refresh I/O so this test concerns only the superseded turn's publication.
    f.controller.refreshChapter = async () => {};
    f.controller.setPreviewMode = async () => {};
    f.surface.publish = () => {};
    refreshing = f.surface.refreshImages();
  }
  if (mutation === 'exit') f.surface.aboutToDisappear();
  wait.resolve(); await turning; if (refreshing) await refreshing;
  assert.notEqual(f.surface.horizontalPage, 2, `${mutation} must fence the old horizontal turn`);
  if (mutation === 'direction') assert.equal(f.projection.totalCount(), 30, 'old turn must not replace the new vertical projection');
  f.close();
}
console.log('PASS delayed turn CAS: direction, A→B→A, zoom, chapter replacement, refresh intent and exit all fence obsolete publication');

const target = await fixture(true);
await target.surface.turnPage(1);
assert.equal(target.surface.horizontalPage, 2);
await target.surface.saveVisible();
assert.deepEqual(target.writes.map(write => write.location.pageOrdinalFallback), [1, 1], 'an unlaid-out turn target must never become persisted progress');
const beforeReplacement = target.writes.length;
await target.controller.openPrepared(structuredClone(entry), true);
await target.controller.setTileWindow([{ordinal: 1, tileIndex: 5}]);
await target.surface.saveVisible();
assert.equal(target.writes.length, beforeReplacement, 'a confirmed position cannot cross a new manifest owner, even with equal identity strings');
target.close();
console.log('PASS restore target is not a confirmed page; same-ID chapter replacement invalidates the old confirmed owner');

const fit = await fixture(); const save = deferred(); const image = deferred();
fit.holdSave(save.promise); fit.holdImage(image.promise);
const fitting = fit.surface.changeFit(); await tick();
assert.equal(fit.writes.length, 1, 'fit must freeze the visible tile before preview clears it');
assert.equal(fit.writes[0].location.y, 0.51);
assert.equal(fit.controller.tile(1, 5), undefined, 'the actual preview transition releases the old tile');
fit.surface.aboutToDisappear(); save.resolve(); image.resolve(); await fitting; await tick();
assert.deepEqual(fit.failures, [], 'accepted old-position CAS survives close without weakening admission');
assert.equal(timers.length, 0, 'late fit completion cannot restore a disposed surface');
fit.close();
console.log('PASS actual preview cleanup + exit: old position is accepted before lease release and survives close through existing CAS lane');
