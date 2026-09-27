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
const methods = ['publish', 'requestedLast', 'saveVisible', 'rememberVisible', 'positionIdentity', 'effectiveFit', 'rowDisplayWidth', 'rowDisplayHeight', 'rowDisplayTop', 'rowDisplayLeft', 'visibleX', 'changeZoom', 'restore', 'finishLayout', 'onViewportScroll', 'onViewportTouch', 'measureVisibleWindow', 'onRowAppear', 'confirmMountedTurn', 'changeFit', 'toggleDirection', 'turnPage', 'handleBack', 'refreshImages', 'aboutToDisappear'];
const timers = [];
// Optional baseline path executes the pre-fix methods against the same assertions.
const Surface = productionMotionMethods(surfaceURL, methods.filter(name => memberNames.has(name)), {
  setTimeout: callback => timers.push(callback), ScrollAlign: {START: 0}, MangaLayoutFrame
});
const pages = [0, 1, 2].map(ordinal => ({ordinal, pageId: `mp1:${String(ordinal).repeat(64)}`, resourceRef: `manga:mp1:${String(ordinal).repeat(64)}`}));
const entry = {chapter: {manifest: {chapter: {sourceId: 's', bookId: 'b', chapterId: '/c'}, sourceRuleVersion: 'r', manifestVersion: 'v', decodeRevision: 'identity-v1', pages}, chapterIndex: 0, chapterTitle: 'c', totalPages: 3, pageStart: 0, cached: true, resources: []}, targetOrdinal: 1, recoveryRequired: false, progress: {token: {epoch: 1, revision: 0}, location: null}};
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; }
async function fixture(horizontal = false, offline = true) {
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
  await controller.openPrepared(structuredClone(entry), offline); await tick();
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
  return {surface, runtime, controller, projection, native, writes, failures,
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

{
  const f = await fixture(true);
  await f.surface.turnPage(1);
  assert.equal(f.surface.horizontalPage, 2);
  assert.ok(f.controller.tile(2, 0)?.image, 'the second image is decoded before its native ListItem appears');
  f.surface.onRowAppear(0); // Actual LazyForEach/ListItem callback for selected image, before delayed restore geometry.
  assert.equal(f.surface.confirmedPosition?.anchor.ordinal, 2, 'mounted decoded row confirms the selected page start');
  assert.equal(f.controller.visiblePages().find(page => page.ordinal === 2)?.status, 'ready');
  f.surface.zoom = 1; // The observed VM return was at 100%, rather than the fixture's zoom=2 default.
  f.surface.onBack = () => f.surface.aboutToDisappear();
  await f.surface.handleBack();
  await tick();
  assert.deepEqual(f.failures, [], 'confirmed page save must not be rejected by Core or its CAS lane');
  assert.deepEqual(f.writes.map(write => write.location.pageOrdinalFallback), [1, 2],
    'a mounted, decoded second image must be saved on return, not the old confirmed first image');
  f.close();
}
console.log('PASS mounted decoded horizontal image is the saved return position even before native geometry settles');

{
  const f = await fixture(true);
  await f.surface.turnPage(1);
  f.surface.publishedManifestVersion = 'v';
  const tile = f.controller.tile(2, 0);
  assert.ok(tile?.image);
  const image = tile.image;
  tile.image = undefined; // The selected ListItem first mounts with a spinner.
  f.surface.onRowAppear(0);
  assert.equal(f.surface.confirmedPosition?.anchor.ordinal, 1, 'spinner does not confirm an image position');
  tile.image = image;
  f.surface.publish(); // Real controller onChange after the first tile is decoded.
  assert.equal(f.surface.confirmedPosition?.anchor.ordinal, 2, 'same mounted row confirms when its decoded tile arrives');
  const held = deferred();
  f.holdSave(held.promise);
  f.surface.zoom = 1;
  let exited = false;
  f.surface.onBack = () => { exited = true; f.surface.aboutToDisappear(); };
  const leaving = f.surface.handleBack(); await tick();
  assert.equal(exited, false, 'the owner must retain the session while the accepted CAS is pending');
  held.resolve(); await leaving;
  assert.equal(exited, true);
  assert.deepEqual(f.writes.map(write => write.location.pageOrdinalFallback), [1, 2]);
  f.close();
}
console.log('PASS mounted spinner then decoded tile confirms the page; return awaits its CAS before closing');

const target = await fixture(true);
await target.surface.turnPage(1);
assert.equal(target.surface.horizontalPage, 2);
await target.surface.saveVisible();
assert.deepEqual(target.writes.map(write => write.location.pageOrdinalFallback), [1],
  'an unmounted turn target must never persist, nor may an old confirmed image be saved as its replacement');
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

for (const scenario of ['same-manifest', 'changed-exact', 'changed-unresolved', 'failure', 'exit']) {
  const f = await fixture(false, false);
  f.surface.publishedManifestVersion = 'v'; f.surface.rememberVisible();
  f.controller.onChange = () => f.surface.publish();
  const hold = deferred(); const originalRequest = f.runtime.request.bind(f.runtime);
  f.runtime.request = async (method, params) => {
    if (method === 'manga.chapter.get') {
      await hold.promise;
      if (scenario === 'failure') throw new Error('MANGA_REFRESH_FIXTURE_FAILED');
      const chapter = structuredClone(entry.chapter);
      if (scenario.startsWith('changed')) chapter.manifest.manifestVersion = 'v2';
      chapter.progressMapping = scenario === 'changed-unresolved' ?
        {status: 'unresolved', reason: 'no exact identity', fromManifestVersion: 'v', fromPageId: pages[1].pageId, progressRevision: 1} :
        {status: 'exact', reason: 'exact fixture', fromManifestVersion: 'v', fromPageId: pages[1].pageId, progressRevision: 1, targetOrdinal: 1, targetPageId: pages[1].pageId};
      return {data: chapter};
    }
    if (method === 'reading.progress.get') return {data: {token: {epoch: 1, revision: 1}, location: structuredClone(f.writes[0].location)}};
    return originalRequest(method, params);
  };
  const refreshing = f.surface.refreshImages(); await tick();
  assert.ok(f.controller.tile(1, 5)?.image, 'the admitted old tile remains visible while the chapter request waits');
  const originalChapter = f.controller.chapter;
  f.surface.onViewportTouch(); f.native.y = -200; f.native.xOffset = 200; f.surface.onViewportScroll();
  const latest = structuredClone(f.surface.visibleAnchor);
  assert.deepEqual(latest, {ordinal: 1, y: 0.52, x: 0.2});
  if (scenario === 'exit') f.surface.aboutToDisappear();
  hold.resolve();
  if (scenario === 'failure') {
    await assert.rejects(refreshing, /MANGA_REFRESH_FIXTURE_FAILED/);
    assert.equal(f.controller.chapter, originalChapter); assert.ok(f.controller.tile(1, 5)?.image);
    assert.deepEqual(f.surface.visibleAnchor, latest); assert.equal(timers.length, 0);
  } else if (scenario === 'exit') {
    await assert.rejects(refreshing, /MANGA_SESSION_CANCELLED/);
    assert.equal(f.controller.chapter, undefined); assert.equal(timers.length, 0);
  } else {
    await refreshing;
    assert.notEqual(f.controller.chapter, originalChapter, 'the real refresh replaces the chapter object');
    if (scenario === 'same-manifest') {
      assert.deepEqual(f.surface.visibleAnchor, latest, 'same manifest must preserve the newer confirmed touch position');
      const scrolls = []; f.surface.scroller.scrollBy = (_x, y) => scrolls.push(y);
      timers.splice(0).forEach(callback => callback());
      assert.ok(scrolls.length > 0);
      assert.ok(scrolls.every(y => y === 200), 'an uncanceled restore must not reissue the old 100vp offset');
    } else if (scenario === 'changed-exact') {
      assert.deepEqual(f.surface.visibleAnchor, {ordinal: 1, y: 0.51, x: 0.1}, 'a new manifest uses exact Core mapping, never old unpersisted coordinates');
      assert.equal(f.surface.recovering, false);
    } else {
      assert.deepEqual(f.surface.visibleAnchor, {ordinal: 0, y: 0, x: 0}); assert.equal(f.surface.recovering, true);
      const count = f.writes.length; await f.surface.saveVisible();
      assert.equal(f.writes.length, count, 'unresolved mapping still forbids replacement progress');
    }
  }
  f.close();
  console.log(`PASS actual refresh lifecycle: ${scenario}`);
}
