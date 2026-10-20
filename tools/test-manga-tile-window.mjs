import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "tile-attempt-ownership": {
    "description": "Actual Controller and Surface tile join, eviction, preview and retry; fake image IO",
    "resources": []
  },
  "content-revocation": {
    "description": "Actual Preparation content fence and Controller; progress versus catalog, pending header and reopened owner",
    "resources": []
  }
};

async function case_tile_attempt_ownership() {
const { MangaRetainedTileCache } = await import('./lib/manga-retained-tile-cache-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
function load(name, dependencies = {}, file = new URL(`${name}.ts`, root)) {
  const source = readFileSync(file, 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway');
const MangaResourceGateway = load('MangaResourceGateway');
const Controller = load('MangaSessionController', { MangaRetainedTileCache, MangaSessionGateway, MangaResourceGateway });
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
const Projection = load('MangaStripProjection');
const Surface = productionMotionMethods(new URL('MangaReadingSurface.ets', root), ['updateViewport','requestedLast','onRowAppear','displayChapterTitle']);
// Real Surface generation fence plus real Controller: the latest repeated
// viewport must wait for the same pending tile, then acknowledge this chapter.
{
  const f = fixture(); await f.controller.openPrepared(structuredClone(entry), true);
  const projection = new Projection(); projection.publish(f.controller.chapter.manifest, i => f.controller.pageGeometry(i), undefined, 1, i => f.controller.pageAt(i));
  const commits = [];
  const surface = Object.assign(new Surface(), { controller: f.controller, data: { totalCount: () => projection.totalCount(), getData: i => projection.row(i), notify() {} },
    mounted: true, opened: true, first: 3, last: 3, viewportGeneration: 0, chapterCommitted: false, error: '', onChapterCommitted: (...args) => commits.push(args) });
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
// A restored native list can mount a third row while its range callback still
// reports only the first row. Its appearance must start that tile's decode.
{
  const f = fixture(); await f.controller.openPrepared(structuredClone(entry), true);
  const projection = new Projection(); projection.publish(f.controller.chapter.manifest, i => f.controller.pageGeometry(i), undefined, 1, i => f.controller.pageAt(i));
  const surface = Object.assign(new Surface(), { controller: f.controller,
    data: { totalCount: () => projection.totalCount(), getData: i => projection.row(i), notify() {} },
    mounted: true, opened: true, first: 0, last: 0, viewportGeneration: 0, chapterCommitted: true, error: '' });
  const initial = surface.updateViewport(); await tick();
  assert.equal(f.pending.length, 1);
  f.pending[0].gate.resolve(); await initial;
  assert.equal(f.controller.tile(0, 2), undefined, 'range callback alone omitted the mounted third row');
  surface.onRowAppear(2); await tick();
  assert.equal(f.pending.length, 2, 'mounted third row starts its real region decode');
  f.pending[1].gate.resolve(); await tick();
  assert.ok(f.controller.tile(0, 2)?.image, 'third row becomes renderable');
  assert.equal(surface.error, ''); f.controller.close();
}
console.log('PASS mounted third slice is admitted even before native range catches up');
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

}

async function case_content_revocation() {
const { MangaRetainedTileCache } = await import('./lib/manga-retained-tile-cache-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { stripTypeScriptTypes } = await import('node:module');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
function load(name, dependencies = {}, file = new URL(`${name}.ts`, root)) {
  const source = readFileSync(file, 'utf8').replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway');
const MangaResourceGateway = load('MangaResourceGateway');
const Controller = load('MangaSessionController', { MangaRetainedTileCache, MangaSessionGateway, MangaResourceGateway });
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
const RULES_MUTATION_METHODS = load('RULES_MUTATION_METHODS', {}, new URL('../settings/RulesMutationContract.ts', root));
const readerRuleMutationEffects = load('readerRuleMutationEffects', { RULES_MUTATION_METHODS }, new URL('../../app/ReaderRuleMutationEffects.ts', root));
const ReadingEntryPreparation = load('ReadingEntryPreparation', { readerRuleMutationEffects }, new URL('../reading/ReadingEntryPreparation.ts', root));
// Drive the actual content fence rather than toggling a fixture boolean. A
// settled ordinary position write keeps decoded tiles admitted; a catalog
// mutation permanently retires this chapter's content snapshot.
function fencedFixture() {
  const f = fixture(), preparation = new ReadingEntryPreparation({}, false);
  f.runtime.captureReadingContentValidity = (sourceId, bookId) => preparation.captureContentValidity(sourceId, bookId);
  const mutate = method => {
    const params = { sourceId: 's', bookId: 'b' };
    assert.equal(preparation.beginRequest(method, params), true);
    preparation.finishRequest(method, params);
  };
  return { ...f, preparation, mutate };
}
{
  const f = fencedFixture(); await f.controller.openPrepared(structuredClone(entry), true);
  const work = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]); await tick();
  f.mutate('reading.progress.update'); f.pending[0].gate.resolve(); await work;
  assert.ok(f.controller.tile(0, 3).image); assert.equal(f.controller.tile(0, 3).error, undefined);
  assert.equal(f.controller.tileLoads.has('0:3'), false); f.controller.close(); f.preparation.close();
}
console.log('PASS actual ordinary progress mutation does not revoke the pending tile content fence');
{
  const f = fencedFixture(); await f.controller.openPrepared(structuredClone(entry), true);
  const displayedUri = f.controller.tile(0, 0).image.fileUri;
  const work = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 0 }, { ordinal: 0, tileIndex: 3 }]); await tick();
  let terminalPublished = false;
  f.controller.onChange = () => {
    const page = f.controller.visiblePages().find(value => value.ordinal === 0);
    if (page?.status === 'failed' && page.error === 'MANGA_SESSION_CONTENT_CHANGED' && page.image === undefined) terminalPublished = true;
  };
  f.mutate('book.detail'); f.pending[0].gate.resolve(); await work;
  assert.equal(f.controller.tile(0, 3), undefined, 'revoked pending tile is no longer exposed through a render getter');
  assert.equal(f.controller.tile(0, 0), undefined, 'even the already displayed tile belongs to the revoked content scope');
  assert.ok(f.controller.visiblePages().every(page => page.status === 'failed' && page.error === 'MANGA_SESSION_CONTENT_CHANGED' && page.image === undefined));
  assert.equal(f.controller.tileLoads.has('0:3'), false); assert.equal(terminalPublished, true);
  assert.equal(f.controller.tiles.size, 0); assert.equal(f.controller.wantedTiles.size, 0); assert.equal(f.controller.retainedTiles.length, 0);
  assert.equal(f.released.filter(uri => uri === displayedUri).length, 1, 'content revocation releases the displayed acquisition once');
  assert.equal(f.released.filter(uri => uri === f.pending[0].image.fileUri).length, 1);
  const count = f.calls.length;
  await assert.rejects(f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]), /MANGA_SESSION_CONTENT_CHANGED/);
  await assert.rejects(f.controller.retryTile(0, 3), /MANGA_SESSION_CONTENT_CHANGED/);
  await assert.rejects(f.controller.setVisible(0), /MANGA_SESSION_CONTENT_CHANGED/);
  await assert.rejects(f.controller.savePosition(0, 0, 0), /MANGA_SESSION_CONTENT_CHANGED/);
  assert.equal(f.calls.length, count, 'a revoked snapshot cannot loop through another decode');
  let readClockCalls = 0;
  f.controller.preparation = { startCurrent() { readClockCalls++; }, recordVisible() { readClockCalls++; return Promise.resolve(); } };
  f.controller.acknowledgeVisible(); assert.equal(readClockCalls, 0, 'revoked content cannot restart the read clock');
  f.controller.preparation = undefined; f.controller.onChange = undefined;
  f.controller.close(); f.preparation.close();
  for (const uri of [displayedUri, f.pending[0].image.fileUri]) assert.equal(f.released.filter(value => value === uri).length, 1, 'close cannot release invalidated acquisitions twice');
}
console.log('PASS catalog revocation clears displayed/pending tiles, publishes the failed page and releases each acquisition once without retry, clock or progress admission');
{
  const f = fencedFixture(), gate = deferred();
  f.runtime.loadReadingImage = async (...args) => {
    f.calls.push(args); await gate.promise;
    return { fileUri: 'file://cancelled-header', width: 600, height: 800, intrinsicWidth: 600, intrinsicHeight: 3200, revision: 'r' };
  };
  const opening = f.controller.openPrepared(structuredClone(entry), true); await tick();
  f.mutate('book.detail'); gate.resolve();
  await assert.rejects(opening, /MANGA_SESSION_CONTENT_CHANGED/);
  const page = f.controller.visiblePages()[0];
  assert.equal(page.status, 'failed'); assert.equal(page.error, 'MANGA_SESSION_CONTENT_CHANGED'); assert.equal(page.image, undefined);
  assert.equal(f.controller.pageLoads.has(0), false); assert.equal(f.controller.pageGeometry(0), undefined);
  assert.equal(f.released.filter(uri => uri === 'file://cancelled-header').length, 1);
  const count = f.calls.length; await assert.rejects(f.controller.retry(0), /MANGA_SESSION_CONTENT_CHANGED/);
  assert.equal(f.calls.length, count); f.controller.close(); f.preparation.close();
  assert.equal(f.released.filter(uri => uri === 'file://cancelled-header').length, 1, 'close cannot release the cancelled header twice');
}
console.log('PASS a revoked pending header publishes a failed page and rejects retry instead of leaving an orphan pending marker');
{
  const f = fencedFixture(); await f.controller.openPrepared(structuredClone(entry), true);
  const oldHeader = f.controller.tile(0, 0).image.fileUri;
  const old = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]); await tick();
  f.mutate('book.detail'); await f.controller.close(); await f.controller.openPrepared(structuredClone(entry), true);
  const newHeader = f.controller.tile(0, 0).image.fileUri;
  const current = f.controller.setTileWindow([{ ordinal: 0, tileIndex: 3 }]); await tick();
  assert.equal(f.pending.length, 2); const currentMarker = f.controller.tile(0, 3);
  f.pending[0].gate.resolve(); await old;
  assert.equal(f.controller.tile(0, 3), currentMarker); assert.equal(currentMarker.error, undefined); assert.equal(currentMarker.image, undefined);
  assert.equal(f.controller.tileLoads.has('0:3'), true);
  f.pending[1].gate.resolve(); await current;
  assert.equal(currentMarker.image.fileUri, f.pending[1].image.fileUri); assert.equal(currentMarker.error, undefined);
  assert.equal(f.released.filter(uri => uri === f.pending[0].image.fileUri).length, 1);
  f.controller.close(); f.preparation.close();
  for (const uri of [oldHeader, newHeader, ...f.pending.map(attempt => attempt.image.fileUri)])
    assert.equal(f.released.filter(value => value === uri).length, 1, 'old and reopened owners release their independent acquisitions exactly once');
}
console.log('PASS late revoked work cannot fail, revive or remove a reopened same-key tile owner');
{
  const f = fencedFixture(), narrow = structuredClone(entry), gate = deferred();
  narrow.chapter.totalPages = 100;
  narrow.chapter.manifest.pages = [0, 1, 2].map(ordinal => {
    const id = `mp1:${String(ordinal + 1).repeat(64)}`;
    return { ordinal, pageId: id, resourceRef: `manga:${id}` };
  });
  let windowCalls = 0;
  f.runtime.request = async method => { assert.equal(method, 'manga.pages.window'); windowCalls++; await gate.promise; return { data: {} }; };
  await f.controller.openPrepared(narrow, true); await tick();
  const previousUris = f.controller.visiblePages().map(page => page.image?.fileUri).filter(Boolean);
  assert.ok(previousUris.length > 0);
  const count = f.calls.length, selecting = f.controller.setVisible(90); await tick();
  f.mutate('book.detail'); gate.resolve();
  await assert.rejects(selecting, /MANGA_SESSION_CONTENT_CHANGED/);
  assert.equal(f.controller.pageAt(90), undefined); assert.equal(f.calls.length, count);
  assert.equal(windowCalls, 1);
  assert.ok(f.controller.visiblePages().every(page => page.status === 'failed' && page.error === 'MANGA_SESSION_CONTENT_CHANGED' && page.image === undefined));
  for (let tileIndex = 0; tileIndex < 4; tileIndex++) assert.equal(f.controller.tile(0, tileIndex), undefined);
  assert.equal(f.controller.tiles.size, 0); assert.equal(f.controller.retainedTiles.length, 0); assert.equal(f.controller.pageLoads.size, 0);
  for (const uri of previousUris) assert.equal(f.released.filter(value => value === uri).length, 1);
  await assert.rejects(f.controller.setVisible(90), /MANGA_SESSION_CONTENT_CHANGED/);
  await assert.rejects(f.controller.prepareViewportPages([90]), /MANGA_SESSION_CONTENT_CHANGED/);
  assert.equal(windowCalls, 1); assert.equal(f.calls.length, count, 'revoked metadata cannot trigger another window request or image acquisition');
  f.controller.close(); f.preparation.close();
  for (const uri of previousUris) assert.equal(f.released.filter(value => value === uri).length, 1, 'bounded-window cancellation and close have one release owner');
}
console.log('PASS a revoked bounded metadata window rejects as a content change before facts or image work can enter the chapter');

}

const implementations = {'tile-attempt-ownership':case_tile_attempt_ownership,'content-revocation':case_content_revocation};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
