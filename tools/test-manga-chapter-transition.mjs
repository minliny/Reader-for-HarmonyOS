import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Actual production policy/gateway/controller code. The native pixels and Core
// ports are explicit fixtures; this establishes transaction behavior locally.
const root = new URL('../entry/src/main/ets/features/manga/', import.meta.url);
function load(name, dependencies = {}) {
  const source = readFileSync(new URL(`${name}.ts`, root), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export type \{[^;]+;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(source)}\nreturn ${name};`)(...Object.values(dependencies));
}
const MangaSessionGateway = load('MangaSessionGateway');
const MangaResourceGateway = load('MangaResourceGateway');
const MangaChapterPreparationCoordinator = load('MangaChapterPreparationCoordinator', { MangaSessionGateway, MangaResourceGateway });
const MangaSessionController = load('MangaSessionController', { MangaSessionGateway, MangaResourceGateway, MangaChapterPreparationCoordinator });
const Transition = load('MangaChapterTransitionCoordinator', { MangaSessionGateway, MangaSessionController });
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }

function chapter(index, count = 35) {
  const pages = Array.from({ length: count }, (_, ordinal) => {
    const pageId = `mp1:${String(ordinal).padStart(64, '0')}`;
    return { ordinal, pageId, resourceRef: `manga:${pageId}` };
  });
  return { chapterIndex: index, chapterTitle: `Chapter ${index}`, cached: true,
    manifest: { chapter: { sourceId: 's', bookId: 'b', chapterId: `/c${index}` }, manifestVersion: `v${index}`,
      sourceRuleVersion: 'r', decodeRevision: 'identity-v1', pages },
    resources: pages.map(page => ({ resourceRef: page.resourceRef, request: { url: `https://images.test/${index}/${page.ordinal}.jpg` } })) };
}
function window(chapter, start, limit) {
  const pages = chapter.manifest.pages.slice(start, start + limit), refs = new Set(pages.map(page => page.resourceRef));
  return { ...chapter, totalPages: chapter.manifest.pages.length, pageStart: start,
    manifest: { ...chapter.manifest, pages }, resources: chapter.resources.filter(resource => refs.has(resource.resourceRef)) };
}
async function fixture(options = {}) {
  const chapters = [chapter(0), chapter(3), chapter(9), chapter(12)];
  const calls = [], images = [], released = [], leases = new Map();
  let alive = true, uiCurrent = true, nextLease = 0, nextImage = 0, protections = [], position = null, revision = 0;
  const find = index => chapters.find(ch => ch.chapterIndex === index);
  const runtime = {
    supportsCoreCapability: name => name !== 'manga.entry.v1' || options.entry !== false,
    captureReadingContentValidity: () => () => alive,
    allowOptionalMangaPreparation: () => false,
    requestBook: async (method, params, requestOptions, priority) => runtime.request(method, params, requestOptions, priority),
    async request(method, params = {}, requestOptions, priority) {
      calls.push({ method, params: structuredClone(params), priority });
      await options.beforeRequest?.(method, params);
      if (method === 'manga.session.runtime') return { data: { runtimeEpoch: 1 } };
      if (method === 'manga.session.replace') {
        protections = structuredClone(params.chapters);
        return { data: { protected: protections.length, runtimeEpoch: 1 } };
      }
      if (method === 'manga.session.release') { protections = []; return { data: { released: true } }; }
      if (method === 'manga.entry.get') {
        const ch = options.entryResult?.(find(params.chapterIndex)) ?? find(params.chapterIndex);
        return { data: { entry: { chapter: window(ch, 0, 3), targetOrdinal: 0, recoveryRequired: false,
          progress: { token: { epoch: 1, revision }, location: position } } } };
      }
      if (method === 'manga.chapter.get') return { data: find(params.chapterIndex) };
      if (method === 'manga.pages.window') return { data: window(chapters.find(ch => ch.manifest.chapter.chapterId === params.chapterId), params.start, params.limit) };
      if (method === 'reading.progress.get') return { data: { token: { epoch: 1, revision }, location: position } };
      if (method === 'reading.progress.update') {
        assert.equal(params.expectedRevision, revision); revision++; position = params.location;
        return { data: { token: { epoch: 1, revision }, location: position } };
      }
      if (method === 'manga.cache.materialization.prepare') {
        const receipt = { token: `candidate-${++nextLease}`, chapter: params.chapter, manifestVersion: params.manifestVersion, intent: params.intent };
        leases.set(receipt.token, receipt); return { data: receipt };
      }
      if (method === 'manga.cache.materialization.abort') return { data: { aborted: leases.delete(params.token) } };
      if (method === 'manga.cache.recordRead') return { data: { recorded: true } };
      throw Error(`Unexpected method ${method}`);
    },
    async loadReadingImage(...args) {
      const [sourceId, bookId, chapterIndex, contentVersion, imageUrl, chapterId, allowNetwork, current, resourceRef, mangaPosition] = args;
      assert.ok(current());
      assert.ok(protections.some(identity => identity.chapterId === chapterId) ||
        Array.from(leases.values()).some(receipt => receipt.chapter.chapterId === chapterId), 'visible or candidate lease protects byte/metadata acquisition');
      const item = { sourceId, bookId, chapterIndex, contentVersion, imageUrl, chapterId, allowNetwork, resourceRef, mangaPosition,
        fileUri: `file://pixels-${++nextImage}`, width: 600, height: 800, intrinsicWidth: 600, intrinsicHeight: 3200, revision: `image-${nextImage}` };
      images.push(item); await options.beforeImage?.(item);
      if (options.failImage?.(item)) throw Error('IMAGE_FAILED');
      return item;
    },
    releaseReadingImage(uri) { released.push(uri); },
  };
  const origin = new MangaSessionController(runtime);
  await origin.openPrepared({ chapter: window(find(3), 0, 3), targetOrdinal: 0, recoveryRequired: false,
    progress: { token: { epoch: 1, revision: 0 }, location: null } });
  await origin.setTileWindow([{ ordinal: 0, tileIndex: 0 }]);
  await tick();
  const transfer = new Transition(runtime);
  const request = overrides => ({ currentController: origin, chapterIndex: 9, chapterUrl: '/c9', landing: 'first',
    isCurrent: () => uiCurrent, ...overrides });
  return { runtime, origin, transfer, request, calls, images, released, leases, chapters,
    get protections() { return protections; }, get position() { return position; }, get revision() { return revision; },
    invalidateContent() { alive = false; }, invalidateUI() { uiCurrent = false; } };
}
function noTargetCommit(f, target = '/c9') {
  assert.equal(f.calls.some(call => call.method === 'manga.cache.recordRead' && call.params.chapter.chapterId === target), false);
  assert.equal(f.calls.some(call => call.method === 'reading.progress.update'), false);
}
function oldVisible(f, uri) {
  assert.equal(f.origin.chapter.manifest.chapter.chapterId, '/c3');
  assert.equal(f.origin.tile(0, 0).image.fileUri, uri); assert.equal(f.released.includes(uri), false);
}

{
  const f = await fixture(), uri = f.origin.tile(0, 0).image.fileUri;
  const candidate = await f.transfer.prepare(f.request());
  oldVisible(f, uri); noTargetCommit(f); assert.equal(f.leases.size, 1);
  assert.deepEqual(f.protections.map(ch => ch.chapterId), ['/c3']);
  assert.equal(candidate.targetOrdinal, 0); assert.equal(candidate.location.y, 0); assert.ok(candidate.controller.tile(0, 0).image);
  await assert.rejects(candidate.controller.savePosition(0, 0, 0), /NOT_PRESENTED/);
  await assert.rejects(f.transfer.prepare(f.request()), /TRANSITION_BUSY/);
  await f.origin.savePosition(0, 0, 0.1);
  await candidate.activate(); assert.equal(f.leases.size, 0); oldVisible(f, uri);
  assert.deepEqual(f.protections.map(ch => ch.chapterId), ['/c9', '/c3']);
  assert.equal(f.calls.filter(call => call.method === 'manga.cache.recordRead' && call.params.chapter.chapterId === '/c9').length, 0);
  await assert.rejects(candidate.controller.savePosition(0, 0, 0), /NOT_PRESENTED/);
  candidate.confirmPresented(); await f.origin.close('chapter'); await tick();
  assert.equal(f.released.includes(uri), true); assert.equal(f.transfer.pending, false);
  const preparation = MangaChapterPreparationCoordinator.forRuntime(f.runtime);
  assert.equal(preparation.currentKey.includes('/c9'), true, 'retired origin cannot clear successor currentKey');
  await candidate.controller.savePosition(0, 0, 0);
  assert.equal(f.position.chapter.chapterId, '/c9'); assert.equal(f.revision, 2, 'activation reads the latest admitted original CAS token');
  await candidate.cancel(); assert.ok(candidate.controller.chapter, 'presented controller transfers to Surface ownership');
  await candidate.controller.close();
}
console.log('PASS next candidate retains original pixels/position/currentKey until explicit admission/native presentation; serialized latest CAS and successor-safe retired close');

{
  const f = await fixture(), candidate = await f.transfer.prepare(f.request({ chapterIndex: 0, chapterUrl: '/c0', landing: 'last' }));
  assert.equal(candidate.targetOrdinal, 34); assert.equal(candidate.location.y, 1); assert.equal(candidate.landingTileIndex, 3);
  assert.ok(candidate.controller.tile(34, 3).image);
  assert.equal(f.images.findLast(image => image.chapterId === '/c0').mangaPosition, 0.75);
  assert.ok(f.calls.some(call => call.method === 'manga.pages.window' && call.params.start === 33 && call.params.limit === 2));
  noTargetCommit(f, '/c0'); await candidate.activate(); candidate.confirmPresented();
  await candidate.controller.savePosition(34, 0, 1); assert.equal(f.position.y, 1);
  await f.origin.close('chapter'); await candidate.controller.close();
}
console.log('PASS previous candidate uses bounded final metadata window and actual decoded bottom region; explicit chapter end overrides historical saved location');

for (const phase of ['ready', 'activated']) {
  const f = await fixture(), uri = f.origin.tile(0, 0).image.fileUri;
  const candidate = await f.transfer.prepare(f.request());
  if (phase === 'activated') await candidate.activate();
  f.invalidateUI(); await candidate.cancel(); await tick(); oldVisible(f, uri); noTargetCommit(f);
  assert.equal(f.leases.size, 0); assert.equal(f.transfer.pending, false);
  assert.equal(MangaChapterPreparationCoordinator.forRuntime(f.runtime).currentKey.includes('/c3'), true);
  assert.equal(f.protections[0].chapterId, '/c3');
  assert.equal(f.calls.some(call => call.method === 'manga.session.release'), false, 'candidate disposal never exits shared reader');
  await candidate.cancel(); await f.origin.close();
}
console.log('PASS ready/post-admission cancellation retains old display and restores old current protection even after UI intention invalidation; no shared session exit');

{
  const f = await fixture(), preparation = MangaChapterPreparationCoordinator.forRuntime(f.runtime);
  for (const index of [0, 9, 3]) {
    const ch = f.chapters.find(ch => ch.chapterIndex === index);
    await preparation.activate(ch, ch.manifest.pages.length, () => true, true, () => true);
  }
  assert.deepEqual(f.protections.map(ch => ch.chapterId), ['/c3', '/c9', '/c0']);
  const candidate = await f.transfer.prepare(f.request({ chapterIndex: 12, chapterUrl: '/c12' }));
  await candidate.activate(); assert.deepEqual(f.protections.map(ch => ch.chapterId), ['/c12', '/c3', '/c9']);
  await candidate.cancel(); await tick();
  assert.deepEqual(f.protections.map(ch => ch.chapterId), ['/c3', '/c9', '/c0'], 'rollback restores the evicted oldest history slot and removes the unpresented candidate');
  noTargetCommit(f, '/c12'); await f.origin.close();
}
{
  const f = await fixture(), preparation = MangaChapterPreparationCoordinator.forRuntime(f.runtime);
  const candidate = await f.transfer.prepare(f.request({ chapterIndex: 12, chapterUrl: '/c12' }));
  await candidate.activate();
  const successor = f.chapters.find(ch => ch.chapterIndex === 9);
  await preparation.activate(successor, successor.manifest.pages.length, () => true, true, () => true);
  await candidate.cancel(); await tick();
  assert.equal(f.protections[0].chapterId, '/c9');
  assert.equal(preparation.currentKey.includes('/c9'), true, 'late rollback cannot steal ownership from a newer reader');
  await f.origin.close();
}
console.log('PASS failed native-presentation rollback restores the exact current-plus-two-recent history and cannot overwrite a newer reading owner');

{
  const f = await fixture(), retired = await f.transfer.prepare(f.request());
  await retired.cancel();
  const successor = await f.transfer.prepare(f.request({ chapterIndex: 12, chapterUrl: '/c12' }));
  await retired.cancel();
  assert.equal(successor.isCurrent(), true); assert.equal(f.transfer.pending, true);
  assert.ok(successor.controller.tile(0, 0).image, 'late cleanup on an older candidate cannot dispose the next candidate');
  assert.equal(f.leases.size, 1);
  await successor.cancel(); await f.origin.close();
}
console.log('PASS candidate-scoped late cancellation leaves a newer chapter attempt, pixel and lease intact');

for (const options of [
  { failImage: image => image.chapterId === '/c9' },
  { failImage: image => image.chapterId === '/c0' && image.mangaPosition > 0 },
  { entryResult: ch => ({ ...ch, manifest: { ...ch.manifest, sourceRuleVersion: 'other' } }) },
  { entryResult: ch => ({ ...ch, manifest: { ...ch.manifest, decodeRevision: 'bytes-v1' } }) },
]) {
  const f = await fixture(options), uri = f.origin.tile(0, 0).image.fileUri;
  const previous = options.failImage?.({ chapterId: '/c0', mangaPosition: 0.75 }) === true;
  await assert.rejects(f.transfer.prepare(f.request(previous ? { chapterIndex: 0, chapterUrl: '/c0', landing: 'last' } : {})), /IMAGE_FAILED|IDENTITY_MISMATCH/);
  oldVisible(f, uri); noTargetCommit(f); assert.equal(f.leases.size, 0); assert.equal(f.transfer.pending, false);
  await f.origin.close();
}
console.log('PASS failed first/tail decode and mismatched rules/decode reject candidates, release temporary leases, preserve old pixels and perform zero target user-data writes');

for (const phase of ['lease', 'image', 'admission']) {
  const gate = deferred(), entered = deferred();
  const f = await fixture({
    beforeRequest: async (method, params) => {
      if (phase === 'lease' && method === 'manga.cache.materialization.prepare' && params.chapter.chapterId === '/c9' ||
        phase === 'admission' && method === 'manga.session.replace' && params.chapters[0]?.chapterId === '/c9') { entered.resolve(); await gate.promise; }
    },
    beforeImage: async image => { if (phase === 'image' && image.chapterId === '/c9') { entered.resolve(); await gate.promise; } },
  });
  const uri = f.origin.tile(0, 0).image.fileUri;
  let candidate;
  const task = phase === 'admission' ? (candidate = await f.transfer.prepare(f.request()), candidate.activate()) : f.transfer.prepare(f.request());
  const rejected = assert.rejects(task, /CANCELLED/);
  await entered.promise;
  const cancelling = f.transfer.cancel(); await tick();
  assert.equal(f.transfer.pending, true, 'late Core/pixel ownership keeps the single-attempt lock through cleanup');
  await assert.rejects(f.transfer.prepare(f.request()), /TRANSITION_BUSY/);
  gate.resolve(); await cancelling; await rejected; await tick();
  oldVisible(f, uri); noTargetCommit(f); assert.equal(f.leases.size, 0);
  assert.equal(MangaChapterPreparationCoordinator.forRuntime(f.runtime).currentKey.includes('/c3'), true);
  assert.equal(f.protections[0].chapterId, '/c3'); await f.origin.close();
}
console.log('PASS cancellation drains late materialization, decode and protection replies; releases late pixels/token and restores original owner without stale candidate admission');

{
  const f = await fixture({ entry: false }), candidate = await f.transfer.prepare(f.request({ offline: true }));
  assert.ok(f.calls.some(call => call.method === 'manga.chapter.get' && call.params.policy === 'cacheOnly'));
  assert.equal(f.images.filter(image => image.chapterId === '/c9').every(image => image.allowNetwork === false), true);
  f.invalidateContent(); assert.equal(candidate.isCurrent(), false); await assert.rejects(candidate.activate(), /CANCELLED/);
  await candidate.cancel(); noTargetCommit(f); assert.equal(f.leases.size, 0); await f.origin.close();
}
console.log('PASS existing chapter/progress fallback retains cache-only policy and content validity fences; no new engine, queue, whole-chapter completion or presentation mutation');
