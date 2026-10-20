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
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function fixture(long = false) {
  const calls = [], released = [], gates = [];
  const control = { deferHeaderOrdinal: undefined };
  const pages = Array.from({ length: 6 }, (_, ordinal) => {
    const pageId = `mp1:${String(ordinal).padStart(64, '0')}`;
    return { ordinal, pageId, resourceRef: `manga:${pageId}` };
  });
  const chapter = { manifest: { chapter: { sourceId: 's', bookId: 'b', chapterId: '/c' },
    sourceRuleVersion: 'r', manifestVersion: 'v', decodeRevision: 'identity-v1', pages },
    chapterIndex: 0, chapterTitle: 'chapter', totalPages: 6, pageStart: 0, cached: true, resources: [] };
  const runtime = { supportsCoreCapability: () => true, async loadReadingImage(...args) {
    const image = { fileUri: `file://display-${calls.length}`, width: 600, height: long ? 800 : 80,
      intrinsicWidth: 600, intrinsicHeight: long ? 3200 : 80, revision: 'pixels' };
    calls.push(args);
    if ((long && args[9] > 0) || (control.deferHeaderOrdinal !== undefined &&
      args[8] === pages[control.deferHeaderOrdinal].resourceRef && args[9] === 0)) {
      control.deferHeaderOrdinal = undefined;
      const gate = deferred(); gates.push({ gate, image }); await gate.promise;
    }
    return image;
  }, releaseReadingImage(uri) { released.push(uri); } };
  return { controller: new Controller(runtime), calls, released, gates, control, entry: { chapter, targetOrdinal: 0,
    recoveryRequired: false, progress: { token: { epoch: 1, revision: 0 }, location: null } } };
}

// Short images can put more than two logical pages in the actual viewport.
// First-page ±1 metadata policy must not evict its visible third display lease.
{
  const f = fixture(); await f.controller.openPrepared(f.entry, true); await tick();
  await f.controller.setVisible(1); await tick();
  const requested = [0, 1, 2].map(ordinal => ({ ordinal, tileIndex: 0 }));
  await f.controller.setTileWindow(requested);
  const original = requested.map(item => f.controller.tile(item.ordinal, 0).image.fileUri);
  const beforeCalls = f.calls.length, beforeReleased = f.released.length;
  await f.controller.setVisible(0, requested); await f.controller.setTileWindow(requested);
  await f.controller.setVisible(0, requested); await f.controller.setTileWindow(requested);
  assert.equal(f.calls.length, beforeCalls, 'identical actual viewport must not redecode its third image');
  assert.equal(f.released.length, beforeReleased, 'no display lease in the actual viewport may be retired');
  assert.deepEqual(requested.map(item => f.controller.tile(item.ordinal, 0).image.fileUri), original);
  assert.equal(f.controller.visiblePages().find(page => page.ordinal === 2)?.status, 'ready', 'retained image keeps its ready metadata');
  await assert.rejects(f.controller.setVisible(0, Array.from({ length: 9 }, () => requested[0])), /TILE_WINDOW_BUDGET/);
  assert.equal(f.calls.length, beforeCalls); assert.equal(f.released.length, beforeReleased);
  // Explicit navigation retires demand, while completed leases keep their
  // chapter lifetime until the reader actually closes this chapter.
  await f.controller.selectPage(4);
  for (const ordinal of [0, 1, 2]) assert.equal(f.controller.tiles.has(`${ordinal}:0`), false);
  for (const uri of original) assert.equal(f.released.filter(value => value === uri).length, 0);
  f.controller.close();
  for (const uri of original) assert.equal(f.released.filter(value => value === uri).length, 1);
}
console.log('PASS actual multi-page viewport keeps exact leases; far navigation transfers demand and chapter close releases once');

// A late regional decode joins while its exact tile remains actually visible.
// A later far selection still revokes that work; no old wantedTiles retention.
{
  const f = fixture(true); await f.controller.openPrepared(f.entry, true); await tick();
  await f.controller.setVisible(1); await tick();
  const requested = [{ ordinal: 0, tileIndex: 0 }, { ordinal: 1, tileIndex: 0 }, { ordinal: 2, tileIndex: 2 }];
  const pending = f.controller.setTileWindow(requested); await tick();
  assert.equal(f.gates.length, 1);
  const tile = f.controller.tile(2, 2);
  await f.controller.setVisible(0, requested);
  assert.equal(f.controller.tile(2, 2), tile, 'same visible pending tile keeps its decode owner');
  const joined = f.controller.setTileWindow(requested); await tick();
  assert.equal(f.gates.length, 1, 'repeated visible window joins one native decode');
  await f.controller.selectPage(4);
  assert.equal(f.controller.tile(2, 2), undefined);
  f.gates[0].gate.resolve(); await Promise.all([pending, joined]);
  assert.equal(f.controller.tile(2, 2), undefined, 'cancelled decode cannot resurrect the old viewport');
  assert.equal(f.released.filter(uri => uri === f.gates[0].image.fileUri).length, 1, 'late pixels are released exactly once');
  f.controller.close();
}
console.log('PASS precise visible pending tiles join one decode; far selection fences and releases late pixels');

// A completed region already proves the page geometry and readability. A
// header that would block is no longer requested on metadata reentry.
{
  const f = fixture(); await f.controller.openPrepared(f.entry, true); await tick();
  await f.controller.setVisible(1); await tick();
  const requested = [0, 1, 2].map(ordinal => ({ ordinal, tileIndex: 0 }));
  await f.controller.setTileWindow(requested);
  await f.controller.setVisible(0); await f.controller.setTileWindow(requested);
  const visibleTile = f.controller.tile(2, 0).image.fileUri;
  assert.equal(f.controller.visiblePages().find(page => page.ordinal === 2), undefined);
  f.control.deferHeaderOrdinal = 2;
  const before = f.calls.length;
  await f.controller.setVisible(1, requested); await tick();
  assert.equal(f.gates.length, 0, 'completed visible tile bypasses the header lane');
  assert.equal(f.controller.visiblePages().find(page => page.ordinal === 2)?.status, 'ready');
  await f.controller.setVisible(0, requested);
  assert.equal(f.calls.length, before, 'repeated metadata reentry performs no image work');
  assert.equal(f.controller.tile(2, 0).image.fileUri, visibleTile);
  assert.equal(f.released.includes(visibleTile), false);
  const calls = f.calls.filter(call => call[8] === f.entry.chapter.manifest.pages[2].resourceRef).length;
  await f.controller.setVisible(2, requested); await tick();
  assert.equal(f.controller.visiblePages().find(page => page.ordinal === 2)?.status, 'ready',
    'ready metadata is restored from the same display lease');
  assert.equal(f.calls.filter(call => call[8] === f.entry.chapter.manifest.pages[2].resourceRef).length, calls, 'ready metadata never queues a second header attempt');
  assert.equal(f.controller.tile(2, 0).image.fileUri, visibleTile);
  assert.ok(f.controller.visiblePages().length <= 3 + 8, 'retention cannot expand the metadata window without its tile budget');
  f.controller.close();
}
console.log('PASS completed visible tile restores ready metadata without a header attempt or widened prefetch');

// A first header attempt can still leave demand before it completes. Its
// pending marker must retire; a later visit owns a fresh attempt.
{
  const f = fixture(); await f.controller.openPrepared(f.entry, true); await tick();
  f.control.deferHeaderOrdinal = 2;
  await f.controller.setVisible(1); await tick();
  assert.equal(f.gates.length, 1);
  assert.equal(f.controller.visiblePages().find(page => page.ordinal === 2)?.status, 'pending');
  await f.controller.setVisible(0, [{ ordinal: 0, tileIndex: 0 }, { ordinal: 1, tileIndex: 0 }]);
  f.gates[0].gate.resolve(); await tick(); await tick();
  assert.notEqual(f.controller.visiblePages().find(page => page.ordinal === 2)?.status, 'pending', 'cancelled header cannot survive without its task');
  assert.equal(f.controller.tile(2, 0), undefined, 'cancelled first header never becomes a completed chapter lease');
  const calls = f.calls.filter(call => call[8] === f.entry.chapter.manifest.pages[2].resourceRef).length;
  await f.controller.setVisible(2); await tick();
  assert.equal(f.controller.visiblePages().find(page => page.ordinal === 2)?.status, 'ready');
  assert.equal(f.calls.filter(call => call[8] === f.entry.chapter.manifest.pages[2].resourceRef).length, calls + 1);
  assert.equal(f.released.filter(uri => uri === f.gates[0].image.fileUri).length, 1, 'cancelled header pixels release once');
  f.controller.close();
}
console.log('PASS first pending header cancels without an orphan marker and later starts a fresh live attempt');
