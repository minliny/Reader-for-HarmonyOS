import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
function load(name, dependencies = {}) {
  const source = readFileSync(new URL(`${name}.ts`, root), 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway');
const MangaResourceGateway = load('MangaResourceGateway');
const Controller = load('MangaSessionController', { MangaSessionGateway, MangaResourceGateway });
const Projection = load('MangaStripProjection');
const Surface = productionMotionMethods(new URL('MangaReadingSurface.ets', root), ['updateViewport']);
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const pageId = `mp1:${'a'.repeat(64)}`;
const entry = { chapter: { manifest: { chapter: { sourceId: 's', bookId: 'b', chapterId: '/c' }, sourceRuleVersion: 'r', manifestVersion: 'v', decodeRevision: 'identity-v1',
  pages: [{ ordinal: 0, pageId, resourceRef: `manga:${pageId}` }] }, chapterIndex: 3, chapterTitle: 'chapter', totalPages: 1, pageStart: 0, cached: true, resources: [] },
  targetOrdinal: 0, recoveryRequired: false, progress: { token: { epoch: 1, revision: 0 }, location: null } };
function fixture() {
  const pending = [], released = [], calls = [];
  const runtime = { supportsCoreCapability: () => true, async loadReadingImage(...args) {
    const image = { fileUri: `file://attempt-${calls.length}`, width: 600, height: 800, intrinsicWidth: 600, intrinsicHeight: 3200, revision: 'r' };
    calls.push(args);
    if (args[9] > 0) { const gate = deferred(); pending.push({ gate, image }); await gate.promise; }
    return image;
  }, releaseReadingImage(uri) { released.push(uri); } };
  return { controller: new Controller(runtime), runtime, pending, released, calls };
}
// Real Surface generation fence plus real Controller: the latest repeated
// viewport must wait for the same pending tile, then acknowledge this chapter.
{
  const f = fixture(); await f.controller.openPrepared(structuredClone(entry), true);
  const projection = new Projection(); projection.publish(f.controller.chapter.manifest, i => f.controller.pageGeometry(i), undefined, 1, i => f.controller.pageAt(i));
  const commits = [];
  const surface = Object.assign(new Surface(), { controller: f.controller, data: { totalCount: () => projection.totalCount(), getData: i => projection.row(i) },
    mounted: true, first: 3, last: 3, viewportGeneration: 0, chapterCommitted: false, error: '', onChapterCommitted: (...args) => commits.push(args) });
  const first = surface.updateViewport(); await tick();
  let latestDone = false; const latest = surface.updateViewport().then(() => { latestDone = true; }); await tick();
  assert.equal(latestDone, false, 'latest viewport must join the current pending tile');
  assert.equal(f.pending.length, 1, 'the same tile is decoded once');
  assert.equal(commits.length, 0);
  f.pending[0].gate.resolve(); await Promise.all([first, latest]);
  assert.ok(f.controller.tile(0, 3).image); assert.deepEqual(commits, [[3, 'chapter']]);
  assert.equal(surface.error, ''); f.controller.close();
}
console.log('PASS actual double Surface viewport joins one tile decode and latest generation commits once');
// Eviction followed by the same key creates a different attempt. Finishing the
// old task must neither admit its image nor remove the new task's join handle.
{
  const f = fixture(); await f.controller.openPrepared(structuredClone(entry), true);
  const old = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]); await tick();
  const away = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 2 }]); await tick();
  let currentDone = false; const current = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]).then(() => { currentDone = true; }); await tick();
  assert.equal(f.pending.length, 3);
  f.pending[0].gate.resolve(); await old;
  assert.equal(f.released.filter(uri => uri === f.pending[0].image.fileUri).length, 1);
  assert.equal(f.controller.tile(0, 3).image, undefined);
  let joinedDone = false; const joined = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]).then(() => { joinedDone = true; }); await tick();
  assert.equal(currentDone, false); assert.equal(joinedDone, false); assert.equal(f.pending.length, 3);
  f.pending[1].gate.resolve(); await away; assert.equal(f.controller.tile(0, 2), undefined);
  f.pending[2].gate.resolve(); await Promise.all([current, joined]);
  assert.equal(f.controller.tile(0, 3).image.fileUri, f.pending[2].image.fileUri);
  assert.equal(f.released.filter(uri => uri === f.pending[1].image.fileUri).length, 1);
  f.controller.close(); assert.equal(f.released.filter(uri => uri === f.pending[2].image.fileUri).length, 1);
}
console.log('PASS tile eviction/reentry separates attempts and stale finalizers preserve the new join');
// Close/reopen may reuse the same key and resource identity, but not old work.
{
  const f = fixture(); await f.controller.openPrepared(structuredClone(entry), true);
  const old = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]); await tick();
  f.controller.close(); await f.controller.openPrepared(structuredClone(entry), true);
  let newDone = false; const reopened = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]).then(() => { newDone = true; }); await tick();
  assert.equal(f.pending.length, 2); f.pending[0].gate.resolve(); await old;
  assert.equal(newDone, false); assert.equal(f.controller.tile(0, 3).image, undefined);
  assert.equal(f.released.filter(uri => uri === f.pending[0].image.fileUri).length, 1);
  f.pending[1].gate.resolve(); await reopened;
  assert.equal(f.controller.tile(0, 3).image.fileUri, f.pending[1].image.fileUri); f.controller.close();
}
console.log('PASS close/reopen cannot join or publish the old generation tile');
// A preview-mode change replaces geometry and leases even while a region load
// is pending. Its late result is released and width mode later starts fresh.
{
  const f = fixture(); await f.controller.openPrepared(structuredClone(entry), true);
  const old = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]); await tick();
  await f.controller.setPreviewMode(true); await f.controller.setTileWindow([{ ordinal: 0, tileIndex: 0 }]);
  const preview = f.controller.tile(0, 0).image.fileUri;
  assert.equal(f.controller.pageGeometry(0).tileHeight, 3200);
  f.pending[0].gate.resolve(); await old;
  assert.equal(f.controller.tile(0, 3), undefined); assert.equal(f.controller.tile(0, 0).image.fileUri, preview);
  assert.equal(f.released.filter(uri => uri === f.pending[0].image.fileUri).length, 1);
  await f.controller.setPreviewMode(false);
  const fresh = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]); await tick();
  assert.equal(f.pending.length, 2); f.pending[1].gate.resolve(); await fresh;
  assert.equal(f.controller.tile(0, 3).image.fileUri, f.pending[1].image.fileUri); f.controller.close();
}
console.log('PASS preview change retires pending region work and width reentry starts a fresh attempt');
// Failure is shared as a tile error, then an explicit retry has a fresh join.
{
  const f = fixture(); await f.controller.openPrepared(structuredClone(entry), true);
  const first = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]); await tick();
  const joined = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]);
  f.pending[0].gate.reject(new Error('READING_IMAGE_HTTP_FAILED')); await Promise.all([first, joined]);
  assert.equal(f.controller.tile(0, 3).error, 'READING_IMAGE_HTTP_FAILED');
  const retry = f.controller.retryTile(0, 3); await tick();
  let joinedDone = false; const retryJoined = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]).then(() => { joinedDone = true; }); await tick();
  assert.equal(joinedDone, false); assert.equal(f.pending.length, 2);
  f.pending[1].gate.resolve(); await Promise.all([retry, retryJoined]);
  assert.ok(f.controller.tile(0, 3).image); assert.equal(f.controller.tile(0, 3).error, undefined); f.controller.close();
}
console.log('PASS shared tile failure and explicit retry preserve one current attempt');
