import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { errorMessageOf } from '../entry/src/main/ets/app/ErrorMessage.ts';

// Execute Shell -> Surface -> Controller intent handling unchanged. Native UI
// cleanup and coordinator ownership are explicit side-effect ports; the
// existing coordinator suite covers actual session protection, late open and
// activation disposal. This probe does not claim native lifecycle delivery.
const files = {
  shell: new URL('../entry/src/main/ets/features/shell/ReaderShell.ets', import.meta.url),
  surface: new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url),
  controller: new URL('../entry/src/main/ets/features/manga/MangaSessionController.ts', import.meta.url),
  runtime: new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url),
};
const sources = Object.fromEntries(Object.entries(files).map(([name, file]) => [name, readFileSync(file)]));
const checks = [], pass = name => checks.push(name);
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const Shell = productionMotionMethods(files.shell, ['mangaIdentityKey', 'keepsMangaReadingSession']);
const Controller = productionMotionMethods(files.controller, ['close']);
{
  const events=[],gate=deferred();
  const controller=new Controller();
  controller.chapter={};controller.preparation={close:async()=>{events.push('session.closing');await gate.promise;events.push('session.released');}};
  controller.releaseView=()=>events.push('pixels.released');
  const Surface=productionMotionMethods(files.surface,['handleBack','performPanelAction']);
  const surface=Object.assign(new Surface(),{mounted:true,controller,panel:'',panelPhase:'closed',panelGeneration:0,panelActionGeneration:0,
    exiting:false,saveVisible:async()=>events.push('progress.saved'),closePanel:async()=>true,
    onBack:()=>{events.push('exit.callback');assert.ok(events.includes('session.released'));assert.ok(events.includes('pixels.released'));}});
  const exiting=surface.handleBack('navigation');await tick();
  assert.equal(events.includes('exit.callback'),false,'the route/delete callback must wait for final session cleanup');
  gate.resolve();await exiting;
  assert.ok(events.indexOf('session.released')<events.indexOf('exit.callback'));
  assert.ok(events.indexOf('pixels.released')<events.indexOf('exit.callback'));
  pass('explicit Surface exit saves visible progress and waits for actual Controller session and pixel cleanup before Index may delete downloads');
}
function surfaceFixture(shell, previousIdentity) {
  const events = [], intent = [], counts = { close: 0, leave: 0, releaseView: 0 };
  let surface, retentionChecks = 0;
  const Surface = productionMotionMethods(files.surface, ['rollbackChapterImages', 'aboutToDisappear'], {
    ReaderWindowCoordinator: { brightness: () => ({ release: async token => {
      assert.equal(token, 41); assert.equal(surface.mounted, false); events.push('brightness.release');
    } }) },
  });
  surface = new Surface();
  const controller = new Controller();
  controller.preparation = {
    close: async () => { counts.close++; events.push('preparation.close'); },
    leaveCurrent: () => { counts.leave++; events.push('preparation.leaveCurrent'); },
  };
  controller.releaseView = () => {
    assert.equal(surface.mounted, false); assert.equal(controller.onChange, undefined);
    counts.releaseView++; events.push('view.release');
  };
  const close = controller.close.bind(controller);
  controller.close = reason => { intent.push(reason); return close(reason); };
  controller.onChange = () => assert.fail('a departing Surface must withdraw its observer before releasing its view');
  Object.assign(surface, {
    sourceId: 'source', bookId: 'manga', mounted: true, controller,
    layoutGeneration: 2, viewportGeneration: 3, loginGeneration: 4, presentationGeneration: 5,
    brightnessOwner: 41, brightnessGeneration: 6,
    confirmedPosition: { old: true }, pendingTurnOrdinal: 3, mountedTurnRowKey: 'old-row',
    panel: 'directory', panelPhase: 'open', panelOffset: 60, panelScrimOpacity: 0.4,
    panelFontsReady: true, panelFontGeneration: 7,
    panelCloseTask: Promise.resolve(), panelCloseResolve: settled => { assert.equal(settled, false); events.push('panel.cancelled'); },
    restoreAppWindowChrome: () => { assert.equal(surface.mounted, false); events.push('chrome.restore'); },
    retainPreparationOnDisappear: () => { retentionChecks++; return shell.keepsMangaReadingSession(previousIdentity); },
    runtime: { finishMangaOfflineProbe(sourceId, bookId) { assert.deepEqual([sourceId, bookId], ['source', 'manga']); events.push('probe.finish'); } },
    detachOfflineProbe: () => events.push('probe.detach'),
  });
  return { surface, events, intent, counts, retentionChecks: () => retentionChecks };
}
function shellFixture() {
  return Object.assign(new Shell(), { sourceId: 'source', bookId: 'manga', contentKind: 'manga', route: 'reading',
    readingReadyGeneration: 1, requestedChapterIndex: 4, mangaChapterRequestGeneration: 2 });
}
function assertDisposed(f, reason) {
  assert.deepEqual(f.intent, [reason]);
  assert.equal(f.retentionChecks(), 1, 'session cleanup and probe lifetime share one retention decision');
  assert.deepEqual(f.counts, { close: reason === 'exit' ? 1 : 0, leave: reason === 'chapter' ? 1 : 0, releaseView: 1 });
  assert.equal(f.surface.mounted, false); assert.equal(f.surface.controller.onChange, undefined);
  assert.equal(f.surface.confirmedPosition, undefined); assert.equal(f.surface.pendingTurnOrdinal, undefined);
  assert.equal(f.surface.mountedTurnRowKey, ''); assert.equal(f.surface.detachOfflineProbe, undefined);
  assert.equal(f.surface.brightnessOwner, 0); assert.equal(f.surface.brightnessGeneration, 7);
  assert.deepEqual([f.surface.layoutGeneration, f.surface.viewportGeneration, f.surface.loginGeneration, f.surface.presentationGeneration], [3, 4, 5, 6]);
  assert.deepEqual([f.surface.panel, f.surface.panelPhase, f.surface.panelOffset, f.surface.panelScrimOpacity], ['', 'closed', 0, 0]);
  assert.equal(f.surface.panelFontsReady, false); assert.equal(f.surface.panelFontGeneration, 8);
  assert.equal(f.surface.panelCloseTask, undefined); assert.equal(f.surface.panelCloseResolve, undefined);
  if (reason === 'exit') {
    assert.ok(f.events.indexOf('preparation.close') < f.events.indexOf('view.release'));
    assert.ok(f.events.indexOf('view.release') < f.events.indexOf('probe.finish'));
    assert.deepEqual(f.events.slice(-2), ['probe.finish', 'probe.detach']);
  } else {
    assert.equal(f.events.includes('probe.finish'), false, 'same-book remount keeps book-wide offline/network observation active');
    assert.ok(f.events.indexOf('preparation.leaveCurrent') < f.events.indexOf('view.release'));
    assert.deepEqual(f.events.slice(-1), ['probe.detach'], 'only the departing view subscriber is detached');
  }
}

for (const route of ['reading', 'directory']) {
  const shell = shellFixture(), previous = shell.mangaIdentityKey();
  shell.route = route; shell.requestedChapterIndex = 19; shell.readingReadyGeneration = 7; shell.mangaChapterRequestGeneration = 9;
  assert.notEqual(shell.mangaIdentityKey(), previous, 'changing chapters really replaces the old Surface identity');
  assert.equal(shell.keepsMangaReadingSession(previous), true);
  const f = surfaceFixture(shell, previous); f.surface.aboutToDisappear(); await tick(); assertDisposed(f, 'chapter');
}
pass('same-book manga reading/directory chapter remount passes chapter intent, retains book-wide offline/network observation and detaches only its view subscriber');

for (const change of [
  { sourceId: 'another-source' }, { bookId: 'another-book' }, { contentKind: 'text' },
  { route: 'detail' }, { route: 'bookshelf' }, { route: 'settings' }, { route: 'search' },
]) {
  const shell = shellFixture(), previous = shell.mangaIdentityKey(); Object.assign(shell, change);
  assert.equal(shell.keepsMangaReadingSession(previous), false);
  const f = surfaceFixture(shell, previous); f.surface.aboutToDisappear(); await tick(); assertDisposed(f, 'exit');
}
pass('different source/book, novel, detail and exit routes pass exit intent and close coordinator ownership before releasing offline observers');

for (const route of ['reading', 'bookshelf']) {
  const shell = shellFixture(), previous = shell.mangaIdentityKey(); shell.route = route;
  const f = surfaceFixture(shell, previous); f.surface.controller = undefined;
  f.surface.aboutToDisappear(); await tick();
  assert.equal(f.surface.mounted, false); assert.deepEqual(f.counts, { close: 0, leave: 0, releaseView: 0 });
  assert.equal(f.retentionChecks(), 1);
  if (route === 'reading') {
    assert.equal(f.events.includes('probe.finish'), false);
    assert.deepEqual(f.events.slice(-1), ['probe.detach']);
  } else assert.deepEqual(f.events.slice(-2), ['probe.finish', 'probe.detach']);
}
pass('disappearance before controller admission retains observation for the same book and finishes it only on a real exit');

function teardownFixture() {
  const events = [], warnings = [], instance = { instance: undefined };
  let owner, preparationClose = async () => {}, flush = async () => {};
  const Runtime = productionMotionMethods(files.runtime, ['closeRuntime'], {
    ReaderRuntimeOwner: instance, errorMessageOf, LOG_DOMAIN: 0,
    hilog: { warn: (...args) => warnings.push(args) },
    MangaChapterPreparationCoordinator: { forRuntime: actual => {
      assert.equal(actual, owner); return { close: async () => { events.push('coordinator.close'); await preparationClose(); events.push('coordinator.closed'); } };
    } },
    ReadingBodyImageHost: { instance: { releaseAllDisplayFiles() { events.push('display.releaseAll'); } } },
  });
  owner = Object.assign(new Runtime(), {
    state: 'closing', sourceSupplyTask: Promise.resolve(), importFinalizeTask: Promise.resolve(), mangaImageTail: Promise.resolve(), flushTail: Promise.resolve(),
    appearanceStore: { async flush() { events.push('appearance.flush'); } },
    ttsHost: { async close() { events.push('tts.close'); } },
    host: { setResponseAssetBridge(value) { assert.equal(value, undefined); events.push('bridge.detach'); } },
    runtime: {
      async request(method, params, options) {
        assert.equal(method, 'runtime.storage.flush'); assert.deepEqual(params, {}); assert.deepEqual(options, { timeoutMs: 30000 });
        events.push('native.flush'); await flush();
      },
      close() { events.push('native.close'); },
    },
  });
  instance.instance = owner;
  return { owner, events, warnings, instance, setCoordinatorClose: action => { preparationClose = action; }, setFlush: action => { flush = action; } };
}

{
  const f = teardownFixture(), source = deferred(), image = deferred(), failure = new Error('session release rejected');
  f.owner.sourceSupplyTask = source.promise.then(() => f.events.push('source.drained'));
  f.owner.mangaImageTail = image.promise.then(() => f.events.push('images.drained'));
  f.setCoordinatorClose(async () => { throw failure; });
  const work = f.owner.closeRuntime(); await tick();
  assert.deepEqual(f.events, ['coordinator.close']); assert.equal(f.warnings.length, 0, 'all other work still drains after a rejected session close');
  source.resolve(); await tick(); assert.ok(!f.events.includes('native.close')); assert.ok(!f.events.includes('tts.close'));
  image.resolve(); await work;
  assert.ok(f.events.indexOf('images.drained') < f.events.indexOf('appearance.flush'));
  assert.deepEqual(f.events.slice(-6), ['appearance.flush', 'tts.close', 'native.flush', 'bridge.detach', 'native.close', 'display.releaseAll']);
  assert.equal(f.warnings.length, 1); assert.ok(f.warnings[0].at(-1).includes(failure.message));
  assert.equal(f.owner.runtime, undefined); assert.equal(f.owner.state, 'closed'); assert.equal(f.instance.instance, undefined);
  pass('a rejected coordinator close still awaits remaining drains, logs the failure and closes Native with bridge/display cleanup');
}

{
  const f = teardownFixture(), failure = new Error('native flush rejected');
  f.setCoordinatorClose(async () => { throw new Error('session release rejected'); }); f.setFlush(async () => { throw failure; });
  await assert.rejects(f.owner.closeRuntime(), error => error === failure);
  assert.deepEqual(f.events.slice(-4), ['native.flush', 'bridge.detach', 'native.close', 'display.releaseAll']);
  assert.equal(f.owner.state, 'closed'); assert.equal(f.instance.instance, undefined);
  pass('coordinator drain failure does not mask a later Native flush failure, and Native still closes through finally');
}

for (const [name, file] of Object.entries(files)) assert.deepEqual(readFileSync(file), sources[name], `${name} production source unchanged during probe`);
console.log(JSON.stringify({ status: 'PASS', productionSourceSha256: Object.fromEntries(Object.entries(sources)
  .map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')])), checks }, null, 2));
