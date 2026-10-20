import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return next(`${specifier}.ts`, context); throw error; }
} });
const { ReadingOfflineGateway } = await import('../entry/src/main/ets/features/reading/ReadingOfflineGateway.ts');
const { RemoteReadingFlowGateway } = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const { MangaDownloadActionsGateway } = await import('../entry/src/main/ets/features/manga/MangaDownloadActionsGateway.ts');
const { readingOfflineFailureHint } = await import('../entry/src/main/ets/features/reading/ReadingOfflineFailurePresentation.ts');

// Execute the complete production Coordinator and its real offline gateway.
// The fixed clear-intent adapter below is only the separately tested platform
// durability boundary; Core queue/body transactions are fixture RPCs.
const source = readFileSync(new URL('../entry/src/main/ets/features/downloads/SharedDownloadCoordinator.ts', import.meta.url), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
class ClearIntentPort {
  constructor(runtime) { this.runtime = runtime; }
  async execute(method, params, _context, qualify, _evidence, current) {
    assert.equal(current(), true); return qualify((await this.runtime.request(method, params)).data);
  }
}
const SharedDownloadCoordinator = new Function('ReadingOfflineGateway', 'RemoteReadingFlowGateway',
  'MangaDownloadActionsGateway', 'CacheClearOperationIntentStore', 'SharedDownloadIntentPreferences',
  'readingOfflineFailureHint',
  `${executable}\nreturn SharedDownloadCoordinator;`)(ReadingOfflineGateway, RemoteReadingFlowGateway,
  MangaDownloadActionsGateway, ClearIntentPort, class { constructor() { throw Error('test persistence must be explicit'); } }, readingOfflineFailureHint);

const session = (count = 45, bookId = 'book') => ({ identity: { sourceId: 'source', bookId },
  acquisitionMode: 'online', contentKind: 'text', detailUrl: bookId, tocUrl: 'toc',
  book: { title: 'Fixture book', author: '' }, continuationVariables: [], hostRequirements: [],
  entries: Array.from({ length: count }, (_, index) => ({ index, title: `Chapter ${index}`, url: `/${index}`, variables: [], navigable: true })) });
function fixture(seed = []) {
  const calls = [], completed = new Set(), pending = new Map();
  let blocked = -1, failure = -1, failureMessage = 'network interrupted', automatic = false,
    saved = structuredClone(seed), closed = false, epoch = 0, generic = 0;
  let urls = Array.from({ length: 45 }, (_, index) => `/${index}`);
  const persistence = { async load() { return structuredClone(saved); }, async save(intents) { saved = structuredClone(intents); calls.push(['flush', saved]); } };
  const runtime = {
    captureReadingContentValidity() { const captured = generic; return () => generic === captured; },
    captureMangaImageContentValidity() { const captured = epoch; return () => epoch === captured; },
    async request(method, params, options = {}) {
      calls.push([method, params]);
      if (method === 'cache.book.status') return { data: { ...params, tocAvailable: true, continuationVariables: [],
        chapters: urls.map((url, chapterIndex) => ({
        chapterIndex, title: `Chapter ${chapterIndex}`, url, navigable: true,
        variables: [],
        state: completed.has(chapterIndex) ? 'cached' : pending.has(chapterIndex) ? 'inProgress' : 'missing',
        cachedBytes: completed.has(chapterIndex) ? 10 : 0, maxAttempts: pending.has(chapterIndex) ? 3 : 0,
      })) } };
      if (method === 'cache.book.prefetch') {
        const index = params.chapterRange[0];
        if (index === failure) throw Error(failureMessage);
        if (!automatic || index === blocked) await new Promise(resolve => pending.set(index, resolve));
        pending.delete(index);
        if (options.shouldCancel?.()) throw Error('reading offline request was superseded');
        completed.add(index);
        return { data: { ...params, materializations: [] } };
      }
      if (method.startsWith('cache.download.')) {
        return { data: { ...params, status: method.endsWith('pause') ? 'paused' : 'cancelled' } };
      }
      if (method === 'cache.clear') {
        assert.equal(pending.size, 0, 'destruction waits until the withdrawn chapter consumer settles');
        if (params.scope === 'chapter') completed.delete(params.chapterIndex); else completed.clear();
        epoch++;
        return { data: { scope: params.scope, cacheEntriesRemoved: 0, chapterEntriesRemoved: 1,
          queueEntriesRemoved: 1, removedContentBytes: 10 } };
      }
      throw Error(`unexpected RPC ${method}`);
    },
    async clearOfflineBookImages() { calls.push(['clear-book-images']); },
    async clearOfflineChapterImages(_source, _book, index) { calls.push(['clear-chapter-images', index]); },
  };
  const coordinator = new SharedDownloadCoordinator(runtime, () => !closed, persistence);
  return { coordinator, runtime, calls, completed, pending, get saved() { return saved; },
    setAutomatic(value) { automatic = value; }, block(index) { blocked = index; },
    setUrls(next) { urls = next.slice(); generic++; },
    fail(index, message = 'network interrupted') { failure = index; failureMessage = message; },
    release(index) { const resolve = pending.get(index); assert.ok(resolve, `chapter ${index} is in flight`); resolve(); },
    navigate() { generic++; }, mutate() { epoch++; }, async close() { closed = true; await coordinator.close(); } };
}
async function until(predicate, label) {
  for (let attempts = 0; attempts < 200; attempts++) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw Error(`did not settle: ${label}`);
}

{
  const f = fixture(); const s = session();
  const ack = await f.coordinator.submit(s);
  assert.equal(ack.accepted, true);
  assert.equal(f.saved[0].requestedIndexes.length, 45, 'flush records chapters beyond the former first 20-chapter slice');
  await until(() => f.pending.has(0), 'first chapter');
  assert.equal(f.calls.findIndex(call => call[0] === 'flush') < f.calls.findIndex(call => call[0] === 'cache.book.prefetch'), true);
  f.navigate(); f.setAutomatic(true); f.release(0);
  await until(() => f.coordinator.jobs()[0].status === 'completed', 'whole book after navigation');
  assert.equal(f.completed.size, 45); assert.equal(f.coordinator.books().length, 1, 'non-shelf download has persisted presentation metadata');
  const before = f.calls.filter(call => call[0] === 'cache.book.prefetch').length;
  await f.coordinator.submit(s);
  await until(() => f.coordinator.jobs()[0].status === 'completed', 'repeated complete submission');
  assert.equal(f.calls.filter(call => call[0] === 'cache.book.prefetch').length, before, 'fully saved chapters are reused');
  await f.close();
}
{
  const f = fixture(); await f.coordinator.submit(session()); await until(() => f.pending.has(0), 'pause chapter');
  const pause = f.coordinator.operate('pause', { book: f.coordinator.books()[0] });
  await until(() => f.saved[0].status === 'paused', 'pause persistence'); f.release(0); await pause;
  assert.equal(f.coordinator.jobs()[0].status, 'paused'); assert.equal(f.saved[0].pausedIndexes.length, 45);
  const restored = fixture(f.saved); await restored.coordinator.restore();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(restored.pending.size, 0, 'paused restart never auto-starts');
  await restored.close();
  f.setAutomatic(true); await f.coordinator.operate('resume', { book: f.coordinator.books()[0] });
  await until(() => f.coordinator.jobs()[0].status === 'completed', 'resume');
  await f.coordinator.operate('cancel', { book: f.coordinator.books()[0] });
  assert.equal(f.saved[0].requestedIndexes.length, 0); assert.equal(f.saved[0].retainedIndexes.length, 45, 'cancel retains local ownership');
  assert.equal(f.completed.size, 45); await f.close();
}
{
  const f = fixture(); f.setAutomatic(true); f.fail(23, 'network interrupted https://private.invalid/?token=PRIVATE_TOKEN Cookie=PRIVATE_COOKIE');
  await f.coordinator.submit(session());
  await until(() => f.coordinator.jobs()[0].status === 'failed', 'interrupted later chapter');
  assert.equal(f.saved[0].requestedIndexes.length, 45); assert.equal(f.completed.size, 23);
  assert.doesNotMatch(JSON.stringify(f.coordinator.snapshot()), /PRIVATE_TOKEN|PRIVATE_COOKIE|private.invalid/,
    'public failure projection never includes source request secrets');
  const restored = fixture(f.saved); await restored.coordinator.restore();
  assert.equal(restored.pending.size, 0, 'failed jobs require explicit retry'); await restored.close(); await f.close();
}
{
  const f = fixture();
  const coordinator = new SharedDownloadCoordinator(f.runtime, () => true,
    { async load() { return []; }, async save() { throw Error('preferences flush failed'); } });
  await assert.rejects(coordinator.submit(session()), /preferences flush failed/);
  assert.equal(f.calls.some(call => call[0] === 'cache.book.prefetch'), false, 'unconfirmed intent flush cannot start Core acquisition');
  assert.equal(coordinator.jobs()[0].status, 'failed');
  await assert.rejects(coordinator.close(), /preferences flush failed/); await f.close();
}
{
  const f = fixture(), book = { sourceId: 'source', bookId: 'book', title: 'Fixture book', author: '', contentKind: 'text', addedAt: 1 };
  f.setUrls(['/replacement', ...Array.from({ length: 44 }, (_, index) => `/${index + 1}`)]);
  await assert.rejects(f.coordinator.operate('download', { book, chapterIndexes: [0],
    expectedChapters: [{ chapterIndex: 0, chapterId: '/0' }] }), /目录已变化/);
  assert.equal(f.coordinator.books().length, 0, 'a first scoped request rejects the changed catalog before creating an intent');
  assert.equal(f.calls.some(call => call[0] === 'flush'), false, 'first-request DTO identity is checked before persistence ACK');
  assert.equal(f.calls.some(call => call[0] === 'cache.book.prefetch'), false);
  // The reading entry owns a previously admitted session rather than page DTO
  // proofs. A missing queue row cannot bypass its A-to-B catalog check either.
  await assert.rejects(f.coordinator.submit(session(), [0]), /目录已变化/);
  assert.equal(f.calls.some(call => call[0] === 'cache.book.prefetch'), false,
    'maxAttempts=0 still verifies the exact catalog URL before any acquisition');
  await f.close();
}
{
  const f = fixture(); f.setAutomatic(true); f.block(21); await f.coordinator.submit(session());
  await until(() => f.pending.has(21), 'interrupted full range beyond chapter 20');
  const closing = f.close(); f.release(21); await closing;
  assert.equal(f.saved[0].status, 'queued'); assert.equal(f.saved[0].requestedIndexes.length, 45);
  const restored = fixture(f.saved); for (const index of f.completed) restored.completed.add(index);
  restored.setAutomatic(true); await restored.coordinator.restore();
  await until(() => restored.coordinator.jobs()[0].status === 'completed', 'active restart completes all not-yet-submitted chapters');
  assert.equal(restored.completed.size, 45);
  assert.deepEqual(restored.calls.filter(call => call[0] === 'cache.book.prefetch').map(call => call[1].chapterRange[0]),
    Array.from({ length: 24 }, (_, index) => index + 21));
  await restored.close();
}
{
  const f = fixture(); await f.coordinator.submit(session(), [0, 1]); await until(() => f.pending.has(0), 'selected range');
  const pause = f.coordinator.operate('pause', { book: f.coordinator.books()[0] });
  await until(() => f.saved[0].status === 'paused', 'range pause'); f.release(0); await pause;
  f.setUrls(['/new', ...Array.from({ length: 45 }, (_, index) => `/${index}`)]); f.setAutomatic(true);
  await f.coordinator.operate('resume', { book: f.coordinator.books()[0] });
  await until(() => f.coordinator.jobs()[0].status === 'completed', 'unique chapter URL reindex');
  assert.deepEqual(f.saved[0].requestedIndexes, [1, 2], 'continuation preserves the requested range across exact URL reindex');
  assert.deepEqual(f.saved[0].retainedIndexes, [1, 2]);
  assert.deepEqual(f.saved[0].preservedRetentions, [{ chapterIndex: 0, chapterId: '/0' }, { chapterIndex: 1, chapterId: '/1' }],
    'old physical slots remain protected until an explicit content deletion');
  assert.equal(f.completed.has(0), false); await f.close();
}
{
  const f = fixture(); await f.coordinator.submit(session(), [0]); await until(() => f.pending.has(0), 'restore record seed');
  const pause = f.coordinator.operate('pause', { book: f.coordinator.books()[0] });
  await until(() => f.saved[0].status === 'paused', 'restore seed paused'); f.release(0); await pause;
  const valid = structuredClone(f.saved[0]); let records = [valid, { version: 9 }], saves = 0;
  const restored = new SharedDownloadCoordinator(f.runtime, () => true, {
    async load() { return structuredClone(records); }, async save() { saves++; },
  });
  await assert.rejects(restored.restore());
  assert.equal(restored.books().length, 0, 'invalid later record cannot publish a valid prefix'); assert.equal(saves, 0);
  records = [valid]; await restored.restore(); assert.equal(restored.books().length, 1, 'read failure has an explicit refresh/retry path');
  assert.equal(restored.jobs()[0].status, 'paused'); await restored.close(); await f.close();
}
{
  const f = fixture(); await f.coordinator.submit(session()); await until(() => f.pending.has(0), 'delete race');
  const deletion = f.coordinator.operate('delete', { book: f.coordinator.books()[0], chapterIndexes: [0] });
  await until(() => f.saved[0].requestedIndexes.length === 44, 'delete withdrawal persisted');
  f.setAutomatic(true); f.release(0); await deletion;
  await until(() => f.coordinator.jobs()[0].status === 'completed', 'siblings finish after exact clear');
  assert.equal(f.completed.has(0), false); assert.equal(f.completed.size, 44);
  assert.deepEqual(f.calls.filter(call => call[0] === 'cache.clear').map(call => call[1].chapterIndex), [0]);
  assert.equal(f.saved[0].retainedIndexes.includes(0), false); assert.equal(f.saved[0].retainedIndexes.length, 44);
  await f.close();
}
{
  const f = fixture(); await f.coordinator.submit(session()); await until(() => f.pending.has(0), 'content mutation');
  f.mutate(); f.release(0);
  await until(() => f.coordinator.jobs()[0].status === 'failed', 'content epoch has visible failure');
  assert.match(f.coordinator.jobs()[0].error, /书源或内容/); assert.equal(f.completed.size, 0); await f.close();
}
{
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const Entry = productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url).pathname,
    ['downloadDirectoryBook', 'submitReaderDownload'], { readingOfflineFailureHint, DOMAIN: 0, hilog: { warn() {} } });
  const f = fixture(), s = session(), opened = [], messages = [];
  const owner = { getDownloadCoordinator: () => f.coordinator };
  const entry = Object.assign(new Entry(), { mountedRuntimeOwner: owner, remoteReadingSession: s,
    navigationGeneration: 1, shelfReceiptRetired: false, isCurrentRuntime: value => value === owner,
    requestReaderDownloads: key => opened.push(key), showOfflineDownloadFeedback: message => messages.push(message) });
  entry.downloadDirectoryBook();
  await until(() => opened.length === 1, 'actual download-all entry opens confirmed book progress');
  assert.deepEqual(opened, [JSON.stringify(['source', 'book'])]);
  assert.equal(messages.length, 0, 'accepted whole-book action opens persistent progress without a misleading start Toast');
  await until(() => f.pending.has(0), 'entry accepted consumer'); f.setAutomatic(true); f.release(0);
  await until(() => f.coordinator.jobs()[0].status === 'completed', 'entry download completes'); await f.close();
}
console.log('PASS production Runtime-owned Coordinator + offline gateway: full-range flushed ACK, navigation survival, physical body reuse, pause/resume and paused restart, explicit failed retry, cancel retention, exact deletion/drain/sibling continuation, real content mutation failure');
