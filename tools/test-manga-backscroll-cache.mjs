import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { MangaRetainedTileCache } from './lib/manga-retained-tile-cache-probe.mjs';

const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
function load(name, dependencies = {}, file = new URL(`${name}.ts`, root)) {
  const source = readFileSync(file, 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway'), MangaResourceGateway = load('MangaResourceGateway');
const Controller = load('MangaSessionController', { MangaSessionGateway, MangaResourceGateway, MangaRetainedTileCache },
  process.env.READER_BASELINE_CONTROLLER ?? new URL('MangaSessionController.ts', root));
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(count = 1, tall = true, regionCount = 16) {
  const calls = [], released = [], pending = [], control = { current: true, defer: false, fail: false };
  const pages = Array.from({ length: count }, (_, ordinal) => {
    const pageId = `mp1:${String(ordinal).padStart(64, '0')}`;
    return { ordinal, pageId, resourceRef: `manga:${pageId}` };
  });
  const runtime = { supportsCoreCapability: () => true,
    captureReadingContentValidity: () => () => control.current,
    async loadReadingImage(...args) {
      const height = tall ? regionCount * 800 : 80;
      const image = { fileUri: `file://display-${calls.length}`, width: 600,
        height: args[11] ? height : tall ? 800 : 80, intrinsicWidth: 600, intrinsicHeight: height, revision: 'r' };
      calls.push({ args, image });
      if (control.fail) { control.fail = false; throw new Error('READING_IMAGE_HTTP_FAILED'); }
      if (control.defer) { control.defer = false; await new Promise(resolve => pending.push({ resolve, image })); }
      return image;
    }, releaseReadingImage(uri) { released.push(uri); } };
  const controller = new Controller(runtime);
  const entry = { chapter: { manifest: { chapter: { sourceId: 's', bookId: 'b', chapterId: '/c' },
    sourceRuleVersion: 'r', manifestVersion: 'v', decodeRevision: 'identity-v1', pages }, chapterIndex: 0,
    chapterTitle: 'c', totalPages: count, pageStart: 0, cached: true, resources: [] }, targetOrdinal: 0,
    recoveryRequired: false, progress: { token: { epoch: 1, revision: 0 }, location: null } };
  return { controller, entry, calls, released, pending, control, pages };
}
const request = (tileIndex, ordinal = 0) => [{ ordinal, tileIndex }];
function bounded(f) {
  assert.ok(f.controller.tiles.size <= 8, 'active and pending regional attempts stay within the eight-tile window');
}
function allReleasedOnce(f) {
  for (const call of f.calls) assert.equal(f.released.filter(uri => uri === call.image.fileUri).length, 1, `${call.image.fileUri} is released once`);
}

// This first assertion also runs unchanged against the old production class
// with READER_BASELINE_CONTROLLER; its immediate release path must fail it.
{
  const f = fixture(); await f.controller.openPrepared(f.entry, true);
  await f.controller.setTileWindow(request(0)); const original = f.controller.tile(0, 0).image.fileUri;
  await f.controller.setTileWindow(request(1)); const calls = f.calls.length;
  await f.controller.setTileWindow(request(0));
  assert.equal(f.calls.length, calls, 'returning to a completed tile must not reenter Host image loading');
  assert.equal(f.controller.tile(0, 0).image.fileUri, original, 'backscroll reuses the completed display URI');
  assert.equal(f.released.includes(original), false, 'promotion transfers the lease without disposal');
  bounded(f); f.controller.close(); allReleasedOnce(f);
}
console.log('PASS long-image 0 -> 1 -> 0 returns the same completed URI without Host work or duplicate release');

{
  const f = fixture(6, false); await f.controller.openPrepared(f.entry, true); await tick();
  await f.controller.setVisible(1, request(0, 1)); await tick();
  await f.controller.setTileWindow([0, 1, 2].map(ordinal => ({ ordinal, tileIndex: 0 })));
  const first = f.controller.tile(0, 0).image.fileUri;
  await f.controller.setVisible(3, request(0, 3)); await tick(); await f.controller.setTileWindow(request(0, 3));
  assert.equal(f.controller.visiblePages().find(page => page.ordinal === 0), undefined, 'page zero left the metadata window');
  const before = f.calls.filter(call => call.args[8] === f.pages[0].resourceRef).length;
  await f.controller.setVisible(0, request(0)); await tick(); await f.controller.setTileWindow(request(0));
  assert.equal(f.calls.filter(call => call.args[8] === f.pages[0].resourceRef).length, before, 'short-image backscroll must not reload its header');
  assert.equal(f.controller.tile(0, 0).image.fileUri, first);
  assert.equal(f.controller.visiblePages().find(page => page.ordinal === 0).status, 'ready');
  bounded(f); f.controller.close(); allReleasedOnce(f);
}
console.log('PASS continuous short-image A -> B -> A restores ready metadata and its existing URI without a header wait');

{
  const f = fixture(); await f.controller.openPrepared(f.entry, true);
  for (let tile = 0; tile < 16; tile++) { await f.controller.setTileWindow(request(tile)); bounded(f); }
  const calls = f.calls.length;
  assert.equal(f.controller.retainedTiles.length, 15, 'all completed chapter regions remain owned outside the active window');
  for (let tile = 15; tile >= 0; tile--) {
    await f.controller.setTileWindow(request(tile)); bounded(f);
    assert.equal(f.calls.length, calls, 'every completed long-image region revisits without Host work');
  }
  bounded(f); f.controller.close(); allReleasedOnce(f);
}
console.log('PASS all 16 long-image regions survive full reverse traversal without Host work; active attempts stay eight and close releases every acquisition');

{
  const f = fixture(24, false); await f.controller.openPrepared(f.entry, true); await tick();
  const uris = new Map();
  for (let ordinal = 0; ordinal < 24; ordinal++) {
    await f.controller.setVisible(ordinal, request(0, ordinal)); await tick();
    await f.controller.setTileWindow(request(0, ordinal));
    uris.set(ordinal, f.controller.tile(ordinal, 0).image.fileUri); bounded(f);
  }
  const calls = f.calls.length;
  assert.equal(calls, 24, 'neighbor headers and requested first regions share one acquisition per logical page');
  for (let ordinal = 23; ordinal >= 0; ordinal--) {
    await f.controller.setVisible(ordinal, request(0, ordinal)); await tick();
    await f.controller.setTileWindow(request(0, ordinal));
    assert.equal(f.controller.tile(ordinal, 0).image.fileUri, uris.get(ordinal)); bounded(f);
  }
  assert.equal(f.calls.length, calls, 'every cached chapter page revisits without reloading its header or body');
  f.controller.close(); allReleasedOnce(f);
}
console.log('PASS all 24 short pages, including neighbor headers, reverse to the same URIs with zero second Host calls');

{
  const f = fixture(24, false); await f.controller.openPrepared(f.entry, true); await tick();
  await f.controller.setTileWindow(request(0));
  const original = f.controller.tile(0, 0).image.fileUri;
  assert.ok(f.controller.tile(1, 0)?.image, 'unrequested successful neighbor header belongs to the chapter owner');
  await f.controller.setTileWindow([]);
  await f.controller.setVisible(12, []); await tick();
  assert.equal(f.controller.tile(0, 0).image.fileUri, original, 'unknown geometry and an empty actual window never erase chapter resources');
  const calls = f.calls.length;
  await f.controller.selectPage(0); await tick(); await f.controller.setTileWindow(request(0));
  assert.equal(f.controller.tile(0, 0).image.fileUri, original);
  assert.equal(f.calls.length, calls, 'explicit far navigation can reuse a prior completed chapter page');
  f.controller.close(); allReleasedOnce(f);
}
console.log('PASS empty unknown-geometry windows and far navigation preserve completed chapter leases');

{
  const f = fixture(); await f.controller.openPrepared(f.entry, true); await f.controller.setTileWindow(request(0));
  f.control.defer = true; const old = f.controller.setTileWindow(request(4)); await tick();
  f.control.defer = true; const away = f.controller.setTileWindow(request(5)); await tick();
  f.control.defer = true; const current = f.controller.setTileWindow(request(4)); await tick();
  assert.equal(f.pending.length, 3, 'pending tiles are cancelled instead of retained');
  f.pending[0].resolve(); await old;
  assert.equal(f.controller.tile(0, 4).image, undefined, 'stale attempt cannot replace the current pending owner');
  f.pending[1].resolve(); await away; f.pending[2].resolve(); await current;
  assert.equal(f.controller.tile(0, 4).image.fileUri, f.pending[2].image.fileUri);
  bounded(f); f.controller.close(); allReleasedOnce(f);
}
console.log('PASS fast backscroll preserves pending-attempt isolation and releases every stale completion');

{
  const f = fixture(); await f.controller.openPrepared(f.entry, true);
  await f.controller.setTileWindow(request(0)); await f.controller.setTileWindow(request(1));
  f.control.defer = true; const pending = f.controller.setTileWindow(request(2)); await tick();
  f.control.current = false;
  assert.equal(f.controller.tile(0, 0), undefined, 'the first getter after content mutation must not expose cached pixels');
  assert.equal(f.controller.retainedTiles.length, 0);
  assert.ok(f.controller.visiblePages().every(page => page.status === 'failed'), 'invalid content cannot keep a ready header marker');
  await assert.rejects(f.controller.setTileWindow(request(0)), /MANGA_SESSION_CONTENT_CHANGED/);
  await assert.rejects(f.controller.setVisible(0, request(0)), /MANGA_SESSION_CONTENT_CHANGED/);
  await assert.rejects(f.controller.retry(0), /MANGA_SESSION_CONTENT_CHANGED/);
  await assert.rejects(f.controller.retryTile(0, 0), /MANGA_SESSION_CONTENT_CHANGED/);
  assert.ok(f.controller.visiblePages().every(page => page.status === 'failed'), 'retry on an invalid owner cannot orphan a pending header');
  f.pending[0].resolve(); await pending; f.controller.close(); allReleasedOnce(f);
}
console.log('PASS content mutation fences the first cache getter, headers and late work without resurrecting old-manifest images');

{
  const f = fixture(); await f.controller.openPrepared(f.entry, true);
  await f.controller.setTileWindow(request(0)); const old = f.controller.tile(0, 0).image.fileUri;
  await f.controller.setTileWindow(request(1)); await f.controller.setPreviewMode(true);
  assert.equal(f.controller.retainedTiles.length, 0);
  assert.equal(f.released.filter(uri => uri === old).length, 1, 'preview invalidates previous regional leases');
  await f.controller.setTileWindow(request(0)); f.controller.close(); allReleasedOnce(f);
}
console.log('PASS preview changes dispose prior completed regions and close the new presentation once');

{
  const f = fixture(); await f.controller.openPrepared(f.entry, true);
  for (let tile = 0; tile < 16; tile++) await f.controller.setTileWindow(request(tile));
  const originals = f.calls.map(call => call.image.fileUri);
  f.controller.allowNetwork = true;
  f.controller.gateway.chapter = async () => structuredClone(f.entry.chapter);
  f.controller.gateway.progress = async () => structuredClone(f.entry.progress);
  await f.controller.refreshChapter(0);
  assert.equal(f.controller.retainedTiles.length, 0, 'replacement admission releases the prior chapter display owner');
  for (const uri of originals) assert.equal(f.released.filter(value => value === uri).length, 1);
  assert.equal(f.controller.tile(0, 15), undefined, 'old regional descriptors cannot cross a refresh generation');
  await f.controller.setTileWindow(request(0)); f.controller.close(); allReleasedOnce(f);
}
console.log('PASS admitted refresh clears all previous chapter descriptors and releases their acquisitions once');

{
  const released = [], retained = new MangaRetainedTileCache(tile => { if (tile.image) released.push(tile.image.fileUri); });
  const first = { ordinal: 0, tileIndex: 0, image: { fileUri: 'file://same' } };
  const second = { ordinal: 1, tileIndex: 0, image: { fileUri: 'file://same' } };
  retained.keep('0:0', first); retained.keep('0:0', first); retained.keep('1:0', second);
  assert.equal(retained.length, 2);
  const active = retained.take('0:0'); assert.equal(active, first); assert.equal(released.length, 0);
  retained.keep('0:0', active); retained.clear(); retained.clear();
  assert.deepEqual(released, ['file://same', 'file://same'], 'distinct logical acquisitions sharing a URI each release one reference');
}
console.log('PASS one key owns one lease while two identical-URI logical pages release their independent acquisitions');

{
  const f = fixture(); await f.controller.openPrepared(f.entry, true); await f.controller.setTileWindow(request(0));
  const image = f.controller.tile(0, 0).image;
  let references = 2;
  f.controller.runtime.releaseReadingImage = uri => { assert.equal(uri, image.fileUri); references--; };
  // Model a separately acquired header whose transport reuses the same DTO
  // object. The existing tile and header still each own one Host reference.
  const page = f.controller.pages.get(0); page.image = image;
  await f.controller.setTileWindow(request(0));
  assert.equal(references, 1, 'same DTO identity cannot suppress release of a second same-key header acquisition');
  assert.equal(page.image, undefined); assert.equal(f.controller.tile(0, 0).image, image);
  f.controller.close(); assert.equal(references, 0, 'chapter close releases the single remaining key owner');
}
console.log('PASS duplicate same-key header/tile acquisitions share DTO identity but retain only one Host reference');

{
  const f = fixture(24, false), acquisitions = [], events = [];
  const runtime = f.controller.runtime;
  let sessionCurrent, ownerScope, endings = 0;
  runtime.beginMangaDisplaySession = (scope, current) => { ownerScope = scope; sessionCurrent = current; return 77; };
  runtime.endMangaDisplaySession = id => { assert.equal(id, 77); endings++; };
  runtime.tryAcquireMangaPreparedImage = (id, scope, ref, position, current) => {
    assert.equal(id, 77); assert.deepEqual(scope, ownerScope);
    assert.equal(current(), true); assert.equal(sessionCurrent(), true); assert.equal(position, 0);
    const ordinal = f.pages.findIndex(page => page.resourceRef === ref);
    const image = { fileUri: 'file://same-prepared-image', width: 600, height: 80,
      intrinsicWidth: 600, intrinsicHeight: 80, revision: 'prepared' };
    acquisitions.push({ ordinal, image }); return image;
  };
  f.controller.onChange = () => events.push({ targetImage: f.controller.tile(23, 0)?.image?.fileUri,
    pages: f.controller.visiblePages().map(page => ({ ordinal: page.ordinal, status: page.status,
      image: f.controller.tile(page.ordinal, 0)?.image?.fileUri })) });
  await f.controller.openPrepared(f.entry, true); await tick();
  assert.equal(f.calls.length, 0, 'a prepared header is acquired synchronously without entering Host loading');
  assert.ok(events.filter(event => event.pages.length).every(event => event.pages.every(page => page.status === 'ready' && page.image)),
    'the first header publication already has its display image, with no pending/spinner state');
  f.controller.geometry.set(23, { width: 600, height: 80, tileHeight: 80 });
  events.length = 0;
  await f.controller.setTileWindow(request(0, 23));
  assert.ok(f.controller.tile(23, 0).image);
  assert.ok(events.length > 0);
  assert.ok(events.every(event => event.targetImage), 'prepared viewport acquisition is ready at its first onChange');
  assert.equal(f.calls.length, 0);
  const before = acquisitions.length;
  await f.controller.setTileWindow(request(0, 0)); await f.controller.setTileWindow(request(0, 23));
  assert.equal(acquisitions.length, before, 'the chapter owner reuses the same key without acquiring another caller lease');
  f.controller.close();
  assert.equal(endings, 1, 'chapter close also ends its prepared-display session');
  assert.equal(f.released.filter(uri => uri === 'file://same-prepared-image').length, acquisitions.length,
    'each prepared caller acquisition releases exactly once even when every logical page has the same URI');
}
console.log('PASS prepared header/viewport hits publish ready immediately, reuse one caller lease per key and dispose all identical-URI acquisitions');

{
  const f = fixture(); await f.controller.openPrepared(f.entry, true); await f.controller.setTileWindow(request(0));
  f.control.fail = true; await f.controller.setTileWindow(request(1));
  assert.equal(f.controller.tile(0, 1).error, 'READING_IMAGE_HTTP_FAILED');
  await f.controller.setTileWindow(request(2)); const calls = f.calls.length;
  await f.controller.setTileWindow(request(1)); assert.equal(f.calls.length, calls + 1, 'failed tiles cannot be retained as ready cache hits');
  f.controller.close();
}
console.log('PASS error tiles are never cached and backscroll creates a fresh recovery attempt');

{
  const f = fixture(1, true, 160); await f.controller.openPrepared(f.entry, true);
  const limits = f.controller.retainedTiles.limits();
  for (let region = 0; region < 160; region++) {
    await f.controller.setTileWindow(request(region)); bounded(f);
    assert.ok(f.controller.retainedTiles.length <= limits.chapterMaxCount);
    assert.ok(f.controller.retainedTiles.bytes <= limits.chapterMaxBytes, 'current-page slices cannot bypass the decoded-byte hard cap');
    assert.ok(f.controller.tile(0, region)?.image, 'viewport still owns its requested slice');
  }
  assert.equal(f.controller.tile(0, 1), undefined, 'the oldest non-header slice on the current page is evictable');
  assert.ok(f.controller.tile(0, 0)?.image, 'finite current-page header protection survives the long traversal');
  f.controller.close(); allReleasedOnce(f);
}
console.log('PASS 160-slice current-page traversal respects the hard byte budget and releases each lease exactly once');

{
  const chapters = [fixture(1, true, 40), fixture(1, true, 40), fixture(1, true, 40)];
  for (const f of chapters) {
    await f.controller.openPrepared(f.entry, true);
    for (let region = 0; region < 30; region++) {
      await f.controller.setTileWindow(request(region)); bounded(f);
      const totals = chapters.reduce((total, chapter) => ({
        count: total.count + chapter.controller.retainedTiles.length,
        bytes: total.bytes + chapter.controller.retainedTiles.bytes,
      }), { count: 0, bytes: 0 });
      const limits = f.controller.retainedTiles.limits();
      assert.ok(totals.count <= limits.globalMaxCount); assert.ok(totals.bytes <= limits.globalMaxBytes);
    }
  }
  assert.equal(chapters[0].controller.tile(0, 1), undefined, 'cross-chapter pressure retires the oldest off-viewport slice');
  for (const f of chapters) { f.controller.close(); allReleasedOnce(f); }
}
console.log('PASS three live chapters share a hard global byte limit and release every independent lease once');
