import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){
const { localFilePath }=await import('./lib/tool-environment.mjs');

const { readFileSync }=await import('node:fs');
const { registerHooks, stripTypeScriptTypes }=await import('node:module');
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
const { SharedDownloadCoordinator, SharedDownloadProjectionRefreshError } = new Function('ReadingOfflineGateway', 'RemoteReadingFlowGateway',
  'MangaDownloadActionsGateway', 'CacheClearOperationIntentStore', 'SharedDownloadIntentPreferences',
  'readingOfflineFailureHint',
  `${executable}\nreturn { SharedDownloadCoordinator, SharedDownloadProjectionRefreshError };`)(ReadingOfflineGateway, RemoteReadingFlowGateway,
  MangaDownloadActionsGateway, ClearIntentPort, class { constructor() { throw Error('test persistence must be explicit'); } }, readingOfflineFailureHint);

const session = (count = 45, bookId = 'book') => ({ identity: { sourceId: 'source', bookId },
  acquisitionMode: 'online', contentKind: 'text', detailUrl: bookId, tocUrl: 'toc',
  book: { title: 'Fixture book', author: '' }, continuationVariables: [], hostRequirements: [],
  entries: Array.from({ length: count }, (_, index) => ({ index, title: `Chapter ${index}`, url: `/${index}`, variables: [], navigable: true })) });
const owned=[];
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
  owned.push(async()=>{closed=true;for(const release of pending.values())release();await coordinator.close();});
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

// Count actual input visits in the complete production Coordinator. A fixed
// bound per catalog row catches nested scans without machine-time thresholds.
function countedCatalogArray(values, meter) {
  return new Proxy(values, { get(target, property, receiver) {
    if (typeof property === 'string' && /^(?:0|[1-9]\d*)$/.test(property)) meter.reads++;
    return Reflect.get(target, property, receiver);
  } });
}
function scaleIntent(s, indexes, paused = []) {
  const book = { ...s.identity, ...s.book, contentKind: s.contentKind, addedAt: 1 };
  return { version: 1, key: JSON.stringify([book.sourceId, book.bookId]), book, session: s,
    requestedIndexes: indexes.slice(), retainedIndexes: indexes.slice(), preservedRetentions: [],
    pausedIndexes: paused.slice(), status: 'paused', error: '', updatedAt: 1 };
}
/** Separate queue state proves that a successful Core effect and a delivered
 * control ACK are different facts. Production control/refresh/persistence all
 * still execute; faults affect only the fixture's external RPC/read ports. */
async function feedbackFixture(status = 'failed', initialQueueState = 'inProgress') {
  const s = session(2, 'feedback-boundary');
  const intent = scaleIntent(s, [0, 1], status === 'paused' ? [0, 1] : []);
  intent.status = status;
  const f = fixture([intent]), realRequest = f.runtime.request.bind(f.runtime);
  f.completed.add(1);
  let queueState = initialQueueState, responseFault, wrongSource = false, wrongChapter = false;
  let projectionFaults = 0;
  let projectionFailure = Object.assign(new Error('projection port https://private.invalid/?token=PRIVATE_TOKEN Cookie=PRIVATE_COOKIE'),
    { code: 'PRIVATE_CODE_COOKIE' });
  f.runtime.request = async (method, params, options) => {
    if (method === 'cache.book.status') {
      const result = await realRequest(method, params, options);
      const chapters = result.data.chapters.slice(0, 2).map((entry, index) => index === 0 ? {
        ...entry, state: queueState, maxAttempts: 3,
        url: wrongChapter ? '/different-identity' : entry.url,
      } : entry);
      return { data: { ...result.data, sourceId: wrongSource ? 'different-source' : params.sourceId, chapters } };
    }
    if (method.startsWith('cache.download.')) {
      f.calls.push([method, params]);
      queueState = method.endsWith('pause') ? 'paused' : method.endsWith('resume') ? 'queued' : 'cancelled';
      // A delivered ACK is deliberately withheld after the queue effect.
      if (responseFault !== undefined) throw responseFault;
      return { data: { ...params, status: queueState === 'queued' ? 'pending' : queueState } };
    }
    return realRequest(method, params, options);
  };
  const realRefresh = f.coordinator.refresh.bind(f.coordinator);
  f.coordinator.refresh = async (...args) => {
    if (projectionFaults > 0) {
      projectionFaults--;
      throw projectionFailure;
    }
    return realRefresh(...args);
  };
  await f.coordinator.restore();
  await until(() => f.coordinator.jobs()[0].revision > 0, 'initial feedback projection');
  return { ...f, get saved() { return f.saved; }, get queueState() { return queueState; },
    failProjectionOnce(error = projectionFailure) { projectionFaults = 1; projectionFailure = error; },
    failQueueResponse(error) { responseFault = error; },
    changeSourceIdentity() { wrongSource = true; }, changeChapterIdentity() { wrongChapter = true; } };
}
async function withControlDiagnostics(work) {
  const warnings = [], previous = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try { await work(warnings); }
  finally { console.warn = previous; }
}

try{
if(id==='scale-identities'){
for (const count of [1024, 4096]) {
  const meter = { reads: 0 }, s = session(count, `scale-${count}`);
  s.entries = countedCatalogArray(s.entries.map((entry, ordinal) => ({ ...entry, index: ordinal * 2,
    navigable: ordinal % 7 !== 0, url: ordinal % 11 === 0 ? ' ' : entry.url })), meter);
  const indexes = s.entries.filter(entry => entry.navigable !== false && entry.url.trim() !== '').map(entry => entry.index);
  const paused = indexes.filter((_, ordinal) => ordinal % 3 === 0), intent = scaleIntent(s, indexes, paused);
  intent.requestedIndexes = countedCatalogArray(intent.requestedIndexes, meter);
  intent.retainedIndexes = countedCatalogArray(intent.retainedIndexes, meter);
  intent.pausedIndexes = countedCatalogArray(intent.pausedIndexes, meter);
  const rows = countedCatalogArray(s.entries.map(entry => ({ chapterIndex: entry.index, title: entry.title,
    url: entry.url, navigable: entry.navigable, state: 'cached', cachedBytes: 10, maxAttempts: 0 })), meter);
  const rpc = [];
  const runtime = { async request(method, params) {
    rpc.push(method);
    return { data: { ...params, chapters: rows, tocAvailable: true, continuationVariables: [] } };
  } };
  const coordinator = new SharedDownloadCoordinator(runtime, () => true,
    { async load() { return []; }, async save() {} });
  coordinator.intents.set(intent.key, intent);
  coordinator.projections.set(intent.key, countedCatalogArray(s.entries.map(entry => ({ ...entry,
    downloadState: 'cached' })), meter));
  const linear = (label, action) => {
    meter.reads = 0; const result = action();
    assert.ok(meter.reads <= 12 * count, `${label}: ${meter.reads} input visits exceed a linear catalog bound`);
    return result;
  };
  assert.equal(linear('jobs', () => coordinator.jobs())[0].totalChapters, indexes.length,
    'groups and empty URLs remain non-downloadable at catalog scale');
  assert.deepEqual(linear('whole selection', () => coordinator.selected(s)), indexes,
    'sparse canonical indexes keep their ascending selection order');
  linear('restore validation', () => coordinator.validate(intent));
  const proofs = countedCatalogArray(indexes.map(chapterIndex => ({ chapterIndex,
    chapterId: s.entries[chapterIndex / 2].url })), meter);
  linear('exact chapter proofs', () => coordinator.assertExpectedChapters(s, intent.requestedIndexes, proofs));
  const wrongProof = proofs.map(proof => ({ ...proof })); wrongProof.at(-1).chapterId = '/unrelated';
  assert.throws(() => coordinator.assertExpectedChapters(s, indexes, wrongProof), /目录已变化/,
    'scale indexes never replace exact URL admission');
  assert.throws(() => coordinator.selected(s, [0]), /目标章节不可下载/);
  assert.throws(() => coordinator.selected(s, [Number.MAX_SAFE_INTEGER + 1]), /目标章节不可下载/);
  const foreignPause = { ...intent, pausedIndexes: [0] };
  assert.throws(() => coordinator.validate(foreignPause), /下载记录无法验证/,
    'a paused chapter still must belong to the accepted range');
  meter.reads = 0; await coordinator.control(intent, 'pause', intent.requestedIndexes);
  assert.ok(meter.reads <= 12 * count, 'exact queue control joins each input only a bounded number of times');
  assert.deepEqual(rpc, ['cache.book.status'], 'cached first rows retain maxAttempts=0 without queue mutations');
  meter.reads = 0; await coordinator.assertChapterIdentities(intent, intent.requestedIndexes);
  assert.ok(meter.reads <= 12 * count, 'exact chapter control admission is linear');

  const originalRetained = indexes.map(chapterIndex => ({ chapterIndex, chapterId: s.entries[chapterIndex / 2].url }));
  intent.preservedRetentions = countedCatalogArray(originalRetained.filter((_, ordinal) => ordinal % 2 === 0), meter);
  const fresh = { ...s, entries: countedCatalogArray(s.entries.map(entry => ({ ...entry, index: entry.index + 1 })), meter) };
  meter.reads = 0; await coordinator.rebind(intent, fresh);
  assert.ok(meter.reads <= 12 * count, 'URL remap and retention before-images share call-local indexes');
  assert.deepEqual(intent.requestedIndexes, indexes.map(index => index + 1));
  assert.deepEqual(intent.retainedIndexes, indexes.map(index => index + 1));
  assert.deepEqual(intent.pausedIndexes, paused.map(index => index + 1));
  assert.equal(intent.preservedRetentions.length, originalRetained.length, 'existing exact retentions are not duplicated');
  assert.deepEqual(new Set(intent.preservedRetentions.map(row => JSON.stringify(row))),
    new Set(originalRetained.map(row => JSON.stringify(row))), 'every old exact URL/physical slot remains protected');
  const retainedBefore = JSON.stringify(intent);
  const duplicate = { ...fresh, entries: [...fresh.entries, { ...fresh.entries.find(entry => entry.navigable !== false && entry.url.trim() !== ''), index: count * 2 + 1 }] };
  await assert.rejects(coordinator.rebind(intent, duplicate), /目录已变化/);
  assert.equal(JSON.stringify(intent), retainedBefore, 'ambiguous URL remap has no partial intent or retention publication');
  const first = intent.session.entries.find(entry => entry.navigable !== false && entry.url.trim() !== '');
  assert.throws(() => coordinator.assertExpectedChapters({ ...intent.session, entries: [
    { ...first, url: '/changed-first-row' }, ...intent.session.entries] }, [first.index],
  [{ chapterIndex: first.index, chapterId: first.url }]), /目录已变化/,
  'index maps preserve the original first-row identity check for duplicate indexes');
  rows.push({ ...rows.find(row => row.chapterIndex === indexes[0]), url: '/changed-duplicate-row' });
  await assert.rejects(coordinator.control({ ...intent, session: s }, 'cancel', indexes), /目录已变化/,
    'every selected status row is rechecked, including a later conflicting duplicate');
  assert.equal(rpc.some(method => method.startsWith('cache.download.')), false);
}
}
if(id==='scale-ready'){
{
  const count = 4096, meter = { reads: 0 }, s = session(count, 'all-ready-scale');
  const indexes = s.entries.map(entry => entry.index), intent = scaleIntent(s, indexes);
  let requested = countedCatalogArray(intent.requestedIndexes, meter);
  Object.defineProperty(intent, 'requestedIndexes', { enumerable: true,
    get: () => requested, set: value => { requested = countedCatalogArray(value, meter); } });
  const rows = s.entries.map(entry => ({ chapterIndex: entry.index, title: entry.title, url: entry.url,
    navigable: true, variables: [], state: 'cached', cachedBytes: 10, maxAttempts: 0 }));
  const runtime = { async request(method, params) {
    assert.equal(method, 'cache.book.status');
    return { data: { ...params, tocAvailable: true, continuationVariables: [], chapters: rows } };
  } };
  const coordinator = new SharedDownloadCoordinator(runtime, () => true,
    { async load() { return []; }, async save() {} });
  coordinator.intents.set(intent.key, intent);
  const entries = countedCatalogArray(s.entries.map(entry => ({ ...entry, downloadState: 'cached' })), meter);
  let acquisitions = 0;
  const execution = { valid: true, current: () => true, settled: Promise.resolve(), gateway: {
    async loadDirectoryProjection() { return entries; },
    async prefetchSelectedChapter() { acquisitions++; throw Error('ready body must not be acquired again'); },
  } };
  await coordinator.run(intent, execution);
  assert.equal(intent.status, 'completed'); assert.equal(acquisitions, 0);
  assert.ok(meter.reads <= 20 * count, `ready range: ${meter.reads} visits must not restart the requested/projection scan per chapter`);
}
}
if(id==='range-extension'){
{
  const f = fixture(), s = session(3); f.setAutomatic(true); f.block(2);
  await f.coordinator.submit(s, [2]);
  await until(() => f.pending.has(2), 'range extension first chapter');
  const ack = await f.coordinator.submit(s, [0, 2]);
  assert.equal(ack.alreadyRunning, true);
  f.release(2);
  await until(() => f.coordinator.jobs()[0].status === 'completed', 'earlier accepted chapter');
  assert.deepEqual(f.calls.filter(call => call[0] === 'cache.book.prefetch').map(call => call[1].chapterRange[0]),
    [2, 0], 'array replacement resets selection without acquiring an already processed chapter twice');
  assert.deepEqual([...f.completed].sort((a, b) => a - b), [0, 2]);
  await f.close();
}
}
if(id==='changed-after-control'){
{
  const s = session(2, 'control-directory-change'), intent = scaleIntent(s, [0, 1]);
  const calls = []; let release;
  const runtime = { async request(method, params) {
    calls.push([method, params]);
    if (method === 'cache.book.status') return { data: { ...params, chapters: s.entries.map(entry => ({
      chapterIndex: entry.index, url: entry.url, navigable: true, state: 'inProgress', maxAttempts: 1,
    })) } };
    assert.equal(method, 'cache.download.pause'); assert.equal(params.chapterIndex, 0);
    await new Promise(resolve => { release = resolve; });
    return { data: { ...params, status: 'paused' } };
  } };
  const coordinator = new SharedDownloadCoordinator(runtime, () => true,
    { async load() { return []; }, async save() {} });
  const work = coordinator.control(intent, 'pause', [0, 1]);
  await until(() => release !== undefined, 'first control awaits Core');
  intent.session = { ...s, entries: s.entries.map(entry => entry.index === 1 ? { ...entry, url: '/changed' } : entry) };
  release();
  await assert.rejects(work, /目录已变化/);
  assert.deepEqual(calls.filter(call => call[0] === 'cache.download.pause').map(call => call[1].chapterIndex), [0],
    'the changed later chapter is rejected before its queue mutation is dispatched');
}
}
if(id==='whole-book'){
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
}
if(id==='pause-resume-retention'){
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
}
if(id==='control-readback'){
for (const action of ['pause', 'cancel']) await withControlDiagnostics(async warnings => {
  const f = await feedbackFixture(); f.failProjectionOnce();
  let observed;
  try { await f.coordinator.operate(action, { book: f.coordinator.books()[0] }); }
  catch (error) { observed = error; }
  assert.ok(observed instanceof SharedDownloadProjectionRefreshError,
    'only a read failure after queue control and final flush has a committed-operation outcome');
  assert.equal(observed.action, action);
  assert.equal(f.queueState, action === 'pause' ? 'paused' : 'cancelled', 'actual queue effect precedes the feedback failure');
  assert.equal(f.saved[0].status, action === 'pause' ? 'paused' : 'cancelled');
  assert.equal(f.coordinator.jobs()[0].status, f.saved[0].status);
  assert.equal(f.saved[0].error, '');
  assert.deepEqual(f.saved[0].retainedIndexes, [0, 1], 'feedback failure cannot release acquired content ownership');
  assert.deepEqual(f.saved[0].requestedIndexes, action === 'pause' ? [0, 1] : []);
  assert.equal(f.completed.has(1), true, 'already downloaded body survives pause/cancel feedback failure');
  assert.match(warnings.join('\n'), /stage=projection-refresh lastConfirmed=state-persisted code=UNKNOWN/);
  assert.doesNotMatch(warnings.join('\n'), /PRIVATE_TOKEN|PRIVATE_COOKIE|PRIVATE_CODE|private.invalid/);
  assert.equal(f.calls.some(call => call[0] === 'cache.clear'), false);
  const restored = fixture(f.saved); await restored.coordinator.restore();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(restored.pending.size, 0, 'committed pause/cancel survives process restoration without reacquisition');
  await restored.close(); await f.close();
});
}
if(id==='physical-guard-diagnostics'){
for (const code of ['MANGA_DECODE_CAPACITY', 'MANGA_CACHE_EVICTING', 'MANGA_CACHE_STORAGE_RESTORING',
  'MANGA_CACHE_PROFILE_REQUIRED', 'MANGA_CACHE_RESOURCE_CORRUPT']) await withControlDiagnostics(async warnings => {
  const f = await feedbackFixture();
  const failure = new Error(code); f.failProjectionOnce(failure);
  await assert.rejects(f.coordinator.operate('pause', { book: f.coordinator.books()[0] }), error =>
    error instanceof SharedDownloadProjectionRefreshError && error.action === 'pause' &&
      error.originalFailure === failure, 'fixed diagnostics preserve the exact original failure');
  assert.equal(f.queueState, 'paused'); assert.equal(f.saved[0].status, 'paused');
  assert.equal(f.coordinator.jobs()[0].status, 'paused'); assert.equal(f.saved[0].error, '');
  assert.deepEqual(f.saved[0].retainedIndexes, [0, 1]); assert.deepEqual(f.saved[0].requestedIndexes, [0, 1]);
  assert.equal(f.completed.has(1), true);
  assert.equal(f.calls.some(call => call[0] === 'cache.clear'), false);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0], `DOWNLOAD_CONTROL_DIAGNOSTIC action=pause stage=projection-refresh lastConfirmed=state-persisted code=${code}`);
  await f.close();
});
}
if(id==='unsafe-diagnostics'){
for (const failure of [
  new Error('MANGA_DECODE_CAPACITY https://private.invalid/?token=PRIVATE_TOKEN Cookie=PRIVATE_COOKIE'),
  new Error('MANGA_CACHE_EVICTING: PRIVATE_BUSINESS_ID'),
  new Error(' MANGA_CACHE_STORAGE_RESTORING '),
  new Error('MANGA_UNREGISTERED_GUARD'),
  'MANGA_DECODE_CAPACITY',
]) await withControlDiagnostics(async warnings => {
  const f = await feedbackFixture(); f.failProjectionOnce(failure);
  await assert.rejects(f.coordinator.operate('pause', { book: f.coordinator.books()[0] }), error =>
    error instanceof SharedDownloadProjectionRefreshError && error.originalFailure === failure);
  assert.equal(f.queueState, 'paused'); assert.equal(f.saved[0].status, 'paused');
  assert.equal(f.coordinator.jobs()[0].status, 'paused'); assert.equal(f.saved[0].error, '');
  assert.deepEqual(f.saved[0].retainedIndexes, [0, 1]);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0], 'DOWNLOAD_CONTROL_DIAGNOSTIC action=pause stage=projection-refresh lastConfirmed=state-persisted code=UNKNOWN');
  assert.doesNotMatch(warnings.join('\n'), /PRIVATE_TOKEN|PRIVATE_COOKIE|PRIVATE_BUSINESS_ID|private.invalid|MANGA_UNREGISTERED_GUARD/);
  await f.close();
});
}
if(id==='resume-readback'){
await withControlDiagnostics(async warnings => {
  const f = await feedbackFixture('paused', 'paused');
  const failure = new Error('MANGA_DECODE_CAPACITY'); f.failProjectionOnce(failure);
  await assert.rejects(f.coordinator.operate('resume', { book: f.coordinator.books()[0] }),
    error => error instanceof SharedDownloadProjectionRefreshError && error.action === 'resume' &&
      error.originalFailure === failure);
  assert.equal(f.queueState, 'queued');
  await until(() => f.pending.has(0), 'committed resumed queue still dispatches after feedback failure');
  assert.notEqual(f.coordinator.jobs()[0].status, 'failed');
  assert.deepEqual(f.saved[0].requestedIndexes, [0, 1]); assert.deepEqual(f.saved[0].pausedIndexes, []);
  assert.match(warnings.join('\n'), /stage=projection-refresh lastConfirmed=state-persisted code=MANGA_DECODE_CAPACITY/);
  const closing = f.close(); f.release(0); await closing;
});
}
if(id==='unknown-control'){
await withControlDiagnostics(async warnings => {
  const f = await feedbackFixture();
  const failure = Object.assign(new Error('queue response https://private.invalid/?token=PRIVATE_TOKEN'), { code: 'INTERNAL' });
  f.failQueueResponse(failure);
  await assert.rejects(f.coordinator.operate('pause', { book: f.coordinator.books()[0] }), error => error === failure,
    'a queue mutation with an unknown RPC outcome is not a confirmed pause');
  assert.equal(f.queueState, 'paused', 'Core may have applied pause even though its result could not be delivered');
  assert.equal(f.saved[0].status, 'failed');
  assert.deepEqual(f.saved[0].pausedIndexes, [0, 1], 'desired pause is durable even while the control ACK is unknown');
  assert.deepEqual(f.saved[0].retainedIndexes, [0, 1]);
  assert.match(warnings.join('\n'), /stage=queue-rpc confirmedQueueRows=0 code=INTERNAL/);
  assert.match(warnings.join('\n'), /stage=control-before-drain lastConfirmed=intent-persisted code=INTERNAL/);
  assert.doesNotMatch(warnings.join('\n'), /PRIVATE_TOKEN|private.invalid/);
  await f.close();
});
}
if(id==='control-identity'){
for (const mismatch of ['source', 'chapter']) await withControlDiagnostics(async warnings => {
  const f = await feedbackFixture();
  if (mismatch === 'source') f.changeSourceIdentity(); else f.changeChapterIdentity();
  await assert.rejects(f.coordinator.operate('pause', { book: f.coordinator.books()[0] }),
    error => !(error instanceof SharedDownloadProjectionRefreshError) &&
      /下载任务状态无法读取|目录已变化/.test(error.message),
    'changed source/chapter proofs fail control instead of borrowing a committed projection outcome');
  assert.equal(f.saved[0].status, 'failed');
  assert.deepEqual(f.saved[0].pausedIndexes, [0, 1]); assert.deepEqual(f.saved[0].retainedIndexes, [0, 1]);
  assert.equal(f.calls.some(call => call[0].startsWith('cache.download.')), false, 'no mismatched queue row is changed');
  assert.match(warnings.join('\n'), mismatch === 'source' ? /code=STATUS_IDENTITY_INVALID/ : /code=DIRECTORY_CHANGED/);
  await f.close();
});
}
if(id==='failure-privacy'){
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
}
if(id==='intent-flush'){
{
  const f = fixture();
  const coordinator = new SharedDownloadCoordinator(f.runtime, () => true,
    { async load() { return []; }, async save() { throw Error('preferences flush failed'); } });
  await assert.rejects(coordinator.submit(session()), /preferences flush failed/);
  assert.equal(f.calls.some(call => call[0] === 'cache.book.prefetch'), false, 'unconfirmed intent flush cannot start Core acquisition');
  assert.equal(coordinator.jobs()[0].status, 'failed');
  await assert.rejects(coordinator.close(), /preferences flush failed/); await f.close();
}
}
if(id==='first-request-proof'){
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
}
if(id==='cold-active'){
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
}
if(id==='url-rebind'){
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
}
if(id==='restore-atomic'){
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
}
if(id==='delete-drain'){
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
}
if(id==='content-epoch'){
{
  const f = fixture(); await f.coordinator.submit(session()); await until(() => f.pending.has(0), 'content mutation');
  f.mutate(); f.release(0);
  await until(() => f.coordinator.jobs()[0].status === 'failed', 'content epoch has visible failure');
  assert.match(f.coordinator.jobs()[0].error, /书源或内容/); assert.equal(f.completed.size, 0); await f.close();
}
}
if(id==='index-submit'){
{
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const Entry = productionMotionMethods(localFilePath(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url)),
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
}
}finally{for(const cleanup of owned)await cleanup();}
}
const definitions={"scale-identities": "scale-identities actual scoped owner/gateway/storage path; controlled Core/OS ports", "scale-ready": "scale-ready actual scoped owner/gateway/storage path; controlled Core/OS ports", "range-extension": "range-extension actual scoped owner/gateway/storage path; controlled Core/OS ports", "changed-after-control": "changed-after-control actual scoped owner/gateway/storage path; controlled Core/OS ports", "whole-book": "whole-book actual scoped owner/gateway/storage path; controlled Core/OS ports", "pause-resume-retention": "pause-resume-retention actual scoped owner/gateway/storage path; controlled Core/OS ports", "control-readback": "control-readback actual scoped owner/gateway/storage path; controlled Core/OS ports", "physical-guard-diagnostics": "physical-guard-diagnostics actual scoped owner/gateway/storage path; controlled Core/OS ports", "unsafe-diagnostics": "unsafe-diagnostics actual scoped owner/gateway/storage path; controlled Core/OS ports", "resume-readback": "resume-readback actual scoped owner/gateway/storage path; controlled Core/OS ports", "unknown-control": "unknown-control actual scoped owner/gateway/storage path; controlled Core/OS ports", "control-identity": "control-identity actual scoped owner/gateway/storage path; controlled Core/OS ports", "failure-privacy": "failure-privacy actual scoped owner/gateway/storage path; controlled Core/OS ports", "intent-flush": "intent-flush actual scoped owner/gateway/storage path; controlled Core/OS ports", "first-request-proof": "first-request-proof actual scoped owner/gateway/storage path; controlled Core/OS ports", "cold-active": "cold-active actual scoped owner/gateway/storage path; controlled Core/OS ports", "url-rebind": "url-rebind actual scoped owner/gateway/storage path; controlled Core/OS ports", "restore-atomic": "restore-atomic actual scoped owner/gateway/storage path; controlled Core/OS ports", "delete-drain": "delete-drain actual scoped owner/gateway/storage path; controlled Core/OS ports", "content-epoch": "content-epoch actual scoped owner/gateway/storage path; controlled Core/OS ports", "index-submit": "index-submit actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
