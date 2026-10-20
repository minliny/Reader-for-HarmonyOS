import { MangaRetainedTileCache } from './lib/manga-retained-tile-cache-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
function load(name, dependencies = {}) {
  const source = readFileSync(new URL(`${name}.ts`, root), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway');
const MangaResourceGateway = load('MangaResourceGateway');
const Controller = load('MangaSessionController', { MangaRetainedTileCache, MangaSessionGateway, MangaResourceGateway });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture(options = {}) {
  const calls = [], released = [], events = [], gates = [];
  const control = { delayNeighbor: false, delayRegion: true };
  const imageSize = options.largeImage === true ? 5000 : 600;
  const imageHeight = options.largeImage === true ? 5000 : 800;
  const intrinsicHeight = options.largeImage === true ? 5000 : 3200;
  const pages = Array.from({ length: 2 }, (_, ordinal) => {
    const pageId = `mp1:${String(ordinal).padStart(64, '0')}`;
    return { ordinal, pageId, resourceRef: `manga:${pageId}` };
  });
  const runtime = { supportsCoreCapability: () => true, async loadReadingImage(...args) {
    const image = { fileUri: `file://display-${calls.length}`, width: imageSize, height: imageHeight,
      intrinsicWidth: imageSize, intrinsicHeight, revision: 'pixels' };
    calls.push({ image, args });
    if ((control.delayRegion && args[9] > 0) || (control.delayNeighbor && args[8] === pages[1].resourceRef)) {
      const gate = deferred(); gates.push({ gate, image }); await gate.promise;
    }
    return image;
  }, releaseReadingImage(uri) { released.push(uri); } };
  const controller = new Controller(runtime);
  controller.onChange = () => events.push(controller.tile(0, 1)?.error ?? (controller.tile(0, 1)?.image ? 'ready' : 'pending'));
  return { controller, control, calls, released, events, gates, entry: { chapter: { manifest: {
    chapter: { sourceId: 's', bookId: 'b', chapterId: '/c' }, sourceRuleVersion: 'r',
    manifestVersion: 'v', decodeRevision: 'identity-v1', pages }, chapterIndex: 0,
    chapterTitle: 'chapter', totalPages: 2, pageStart: 0, cached: true, resources: [] },
    targetOrdinal: 0, recoveryRequired: false, progress: { token: { epoch: 1, revision: 0 }, location: null } } };
}

{
  const f = fixture(); await f.controller.openPrepared(f.entry, true); await tick();
  const window = [{ ordinal: 0, tileIndex: 0 }, { ordinal: 1, tileIndex: 0 }];
  await f.controller.setTileWindow(window);
  const calls = f.calls.length, released = f.released.length; f.events.length = 0;
  for (let count = 0; count < 50; count++) {
    await f.controller.setVisible(0, window); await f.controller.setTileWindow(window);
  }
  assert.equal(f.calls.length, calls); assert.equal(f.released.length, released);
  assert.equal(f.events.length, 0, '50 identical ready viewport requests must not publish unchanged presentation');
  f.controller.close();
}
console.log('PASS 50 identical real Controller windows publish no unchanged state and do not decode or release pixels');

{
  const f = fixture(); await f.controller.openPrepared(f.entry, true); await tick();
  const window = [{ ordinal: 0, tileIndex: 1 }];
  const first = f.controller.setTileWindow(window); await tick();
  assert.ok(f.events.includes('pending'), 'new tile attempt publishes its pending presentation');
  const calls = f.calls.length; f.events.length = 0;
  const joined = Array.from({ length: 30 }, () => f.controller.setTileWindow(window)); await tick();
  assert.equal(f.calls.length, calls); assert.equal(f.events.length, 0, 'joining one pending decode does not republish the same pending state');
  f.gates[0].gate.reject(new Error('READING_IMAGE_HTTP_FAILED')); await Promise.all([first, ...joined]);
  assert.deepEqual(f.events, ['READING_IMAGE_HTTP_FAILED'], 'failure publishes once for the one current attempt');
  f.events.length = 0;
  const retry = f.controller.retryTile(0, 1); await tick();
  assert.equal(f.controller.tile(0, 1).error, undefined);
  assert.deepEqual(f.events, ['pending'], 'retry removes the error and publishes pending before pixels are ready');
  f.events.length = 0; f.gates[1].gate.resolve(); await retry;
  assert.deepEqual(f.events, ['ready']);
  f.events.length = 0;
  await f.controller.setTileWindow([]);
  assert.equal(f.events.length, 1, 'actual tile retirement still publishes');
  f.controller.close();
}
console.log('PASS pending joins are silent while new attempt, failure, retry, ready and tile retirement still publish');

{
  const f = fixture(); f.control.delayNeighbor = true;
  await f.controller.openPrepared(f.entry, true); await tick();
  const window = [{ ordinal: 0, tileIndex: 0 }];
  await f.controller.setTileWindow(window);
  f.gates[0].gate.resolve(); await tick(); await tick();
  const neighborUri = f.gates[0].image.fileUri;
  assert.equal(f.released.includes(neighborUri), false); f.events.length = 0;
  await f.controller.setTileWindow(window);
  assert.equal(f.released.filter(uri => uri === neighborUri).length, 0, 'unchanged window transfers the completed neighbor header to its chapter owner');
  assert.equal(f.controller.tile(1, 0)?.image?.fileUri, neighborUri);
  assert.equal(f.events.length, 0, 'offscreen header transfer does not republish unchanged visible images');
  await f.controller.setTileWindow(window);
  assert.equal(f.released.filter(uri => uri === neighborUri).length, 0);
  f.controller.close();
  assert.equal(f.released.filter(uri => uri === neighborUri).length, 1);
}
console.log('PASS silent unchanged window retains late metadata resources and releases once at chapter close');

// A hard-budget rejection must retire the caller-owned active lease immediately.
// The controller must not leave an oversized image in its active map until close,
// which would bypass the retained cache's byte boundary.
{
  const f = fixture({ largeImage: true });
  await f.controller.openPrepared(f.entry, true); await tick();
  await f.controller.setTileWindow([]);
  assert.equal(f.controller.tile(0, 0), undefined, 'rejected oversized header is not kept in active tiles');
  const released = f.released.length;
  assert.equal(released, f.entry.chapter.totalPages, 'rejected oversized header leases are released immediately');
  f.controller.close();
  assert.equal(f.released.length, released, 'retired oversized leases are not released again at close');
}
console.log('PASS rejected oversized retained tile releases once without active-map overflow');
