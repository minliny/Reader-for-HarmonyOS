import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';

// Manual only. Keep CLI selection before any production source reads or cases.
const caseId = 'host-negative-recovery';
const args = process.argv.slice(2);
if (args.length === 0 || (args.length === 1 && args[0] === '--list')) {
  console.log(JSON.stringify({ kind: 'reader-shared-download-host-recovery', status: 'NOT_RUN',
    cases: [{ id: caseId, groups: 17, purpose: 'Manga Host negative-cache recovery and stale-revision publication' }] }));
  process.exit(0);
}
if (args.length !== 2 || args[0] !== '--case' || args[1] !== caseId) {
  console.error(JSON.stringify({ kind: 'reader-shared-download-host-recovery', status: 'FAIL_INVALID_CASE_SELECTION',
    expected: '--case ' + caseId }));
  process.exit(2);
}

const sourceRoot = new URL('../../entry/src/main/ets/', import.meta.url);
const files = {
  host: 'features/downloads/application/SharedDownloadHost.ts',
  gateway: 'features/downloads/application/SharedDownloadGateway.ts',
  manga: 'features/manga/application/MangaSessionGateway.ts',
  projection: 'features/downloads/presentation/SharedDownloadProjection.ts',
  disk: 'platform/reading-resources/ReadingImageDiskCache.ts',
};
const raw = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readFileSync(new URL(file, sourceRoot), 'utf8')]));
const stripped = text => stripTypeScriptTypes(text.replace(/^import[^;]*;\s*/gm, '')).replace(/^export /gm, '');
const projection = new Function(stripped(raw.projection) + '; return {createDownloadBookView,projectDownloadBookAvailability,downloadChapterStateLabel};')();
const { MangaSessionGateway } = new Function(stripped(raw.manga) + '; return {MangaSessionGateway};')();
class LocalUnused { constructor() {} loadToc() { assert.fail('remote fixture must not use local TOC'); } }
const { SharedDownloadGateway } = new Function('LocalReadingFlowGateway', 'MangaSessionGateway', ...Object.keys(projection),
  stripped(raw.gateway) + '; return {SharedDownloadGateway};')(LocalUnused, MangaSessionGateway, ...Object.values(projection));
const begin = raw.disk.indexOf('  private async readValidManifest(');
const end = raw.disk.indexOf('  /** Second-resolution stat values', begin);
assert.ok(begin >= 0 && end > begin, 'exact unchanged readValidManifest method');
const DiskRead = new Function(stripTypeScriptTypes('class DiskRead {\n' + raw.disk.slice(begin, end) + '\n}') + '; return DiskRead;')();
const fixtureBook = { sourceId: 'SOURCE_FIXTURE', bookId: 'BOOK_FIXTURE', contentKind: 'manga', title: 'Fixture', author: 'Author', addedAt: 1 };
let currentBook = fixtureBook;
class ShelfPort { async loadAll() { return { books: [{ ...currentBook }] }; } }
class CoreReadPort { loadShelfBook() { assert.fail('unused book metadata read'); } }
const sourceWithHostPolicy = (privateVariant, revisionMutant) => {
  let source = raw.host;
  if (privateVariant) {
    const indexGuard = '    if (this.requiresMangaHostRecheck(view)) {';
    const reuseGuard = '    if (this.requiresMangaHostRecheck(cached)) return undefined;';
    assert.equal(source.split(indexGuard).length, 2); assert.equal(source.split(reuseGuard).length, 2);
    source = source.replace(indexGuard, '    if (false) {');
    source = source.replace(reuseGuard, '    if (false) return undefined;');
  }
  if (revisionMutant) {
    assert.equal(privateVariant, false, 'one independent production mutant at a time');
    const fence = "    if (revision === undefined || view.projectionStatus !== 'ready' || view.contentKind === undefined ||\n" +
      '      this.currentStatusRevision(view) !== revision) return;\n';
    const eviction = '    if (this.requiresMangaHostRecheck(view)) {\n' +
      '      this.statusIndex?.delete(view.key);\n      return;\n    }\n';
    assert.equal(source.split(fence + eviction).length, 2, 'exact current production publication fence');
    source = source.replace(fence + eviction, eviction + fence);
  }
  return new Function('BookshelfFlowGateway', 'SharedDownloadGateway', 'ReaderCoreGateway', ...Object.keys(projection),
    stripped(source) + '; return SharedDownloadHost;')(ShelfPort, SharedDownloadGateway, CoreReadPort, ...Object.values(projection));
};

function fixture({ privateVariant = false, revisionMutant = false, mode = 'io', kind = 'manga', queueState = 'cached', entryKind = 'matching', coreOnly, oneChapter = false } = {}) {
  const Host = sourceWithHostPolicy(privateVariant, revisionMutant), counters = { status: 0, entry: 0, host: 0, metadata: 0 };
  const state = { healthy: false, revision: 0, rejectCore: false, entryKind };
  currentBook = { ...fixtureBook, contentKind: kind };
  const book = { ...currentBook };
  const hashes = Array.from({ length: 6 }, (_, index) => index.toString(16).repeat(64));
  const disk = new DiskRead();
  disk.readManifestIdentity = async () => {
    counters.metadata++;
    if (!state.healthy && mode === 'io') throw Error('controlled transient metadata IO failure');
    if (!state.healthy && mode === 'false') return undefined;
    return { manga: true, resourceHashes: hashes, resourceDigests: Object.fromEntries(hashes.map(hash => [hash, 'f'.repeat(64)])) };
  };
  disk.validResourceFile = async () => true;
  disk.matchesResourceDigest = async () => true;
  const owner = {
    supportsCoreCapability: () => true,
    captureReadingContentValidity: () => () => true,
    bookAcquisitions: () => ({ downloadStatusRevision: () => state.revision, subscribeDownloadStatus: () => () => {} }),
    async mangaStorageSummary() { return {}; },
    async request(method) {
      if (method === 'cache.book.status') {
        counters.status++; if (state.rejectCore) throw Error('controlled Core read rejection');
        return { data: { sourceId: book.sourceId, bookId: book.bookId, tocAvailable: true, chapters: [
          { chapterIndex: 0, title: 'One', url: 'chapter:0', navigable: true, state: 'missing', cachedBytes: 0 },
          { chapterIndex: 1, title: 'Two', url: 'chapter:1', navigable: true,
            state: coreOnly === 'missing' ? 'missing' : queueState, cachedBytes: 0,
            mangaManifestVersion: coreOnly === 'no-version' ? undefined : 'VERSION_FIXTURE' },
        ].filter(row => !oneChapter || row.chapterIndex === 1) } };
      }
      assert.equal(method, 'manga.entry.get'); counters.entry++;
      if (state.entryKind === 'null') return { data: { entry: null } };
      return { data: { entry: { chapter: { chapterIndex: 1, totalPages: 6, pageStart: 0, cached: true, resources: [],
        manifest: { chapter: { sourceId: book.sourceId, bookId: book.bookId, chapterId: 'chapter:1' },
          manifestVersion: state.entryKind === 'mismatch' ? 'OTHER_VERSION' : 'VERSION_FIXTURE',
          sourceRuleVersion: 'RULE_FIXTURE', decodeRevision: 'identity-v1', pages: Array.from({ length: 3 }, (_, ordinal) => {
            const pageId = 'mp1:' + ordinal.toString(16).repeat(64); return { pageId, ordinal, resourceRef: 'manga:' + pageId };
          }) } }, targetOrdinal: 1, recoveryRequired: false, progress: { token: { epoch: 1, revision: 0 }, location: null } } } };
    },
    async isOfflineImageChapterComplete(identity, manga, current) {
      counters.host++; assert.equal(manga, true); assert.equal(current(), true);
      assert.equal(identity.chapterIndex, 1); assert.equal(identity.mangaDecodeRevision, 'identity-v1');
      const complete = await disk.readValidManifest('/FAKE_METADATA_ONLY', 2, undefined, current, true) !== undefined;
      const held = state.holdNextHostResult;
      if (held !== undefined) { state.holdNextHostResult = undefined; await held(); }
      return complete;
    },
  };
  const records = [];
  let host = new Host(owner, snapshot => records.push(snapshot));
  const value = () => records.at(-1).books[0];
  return { state, counters, records, value, get host() { return host; },
    async reload() { currentBook = book; await host.reload(() => true); },
    async remount() { host.retire(); host = new Host(owner, snapshot => records.push(snapshot)); await this.reload(); },
    async force() { await host.refreshBook(value(), () => true); },
    holdNextHostRead() {
      let entered, release;
      const waiting = new Promise(resolve => { entered = resolve; });
      const held = new Promise(resolve => { release = resolve; });
      state.holdNextHostResult = () => { entered(); return held; };
      return { waiting, release };
    },
    close() { host.retire(); } };
}

const observations = [];
for (const queueState of ['cached', 'completed']) for (const mode of ['false', 'io']) {
  const f = fixture({ mode, queueState }); await f.reload();
  assert.equal(f.value().projectionStatus, 'ready'); assert.equal(f.value().downloadedChapters, 0);
  assert.equal(f.value().totalChapters, 2); assert.equal(f.value().projectionError, undefined);
  const first = { ...f.counters }; f.state.healthy = true; await f.reload();
  assert.equal(f.value().downloadedChapters, 1); assert.equal(f.counters.host, first.host + 1, 'normal reload reaches recovered Host');
  const recovered = { ...f.counters };
  await f.remount(); assert.equal(f.value().downloadedChapters, 1); assert.deepEqual(f.counters, recovered, 'confirmed candidate reuses even when another Core-only chapter is missing');
  await f.force(); assert.equal(f.value().downloadedChapters, 1); assert.equal(f.counters.host, recovered.host + 1, 'explicit refresh remains available');
  observations.push({ mode, queueState, currentProduction: 'RECOVERS_ON_NORMAL_RELOAD', first, recovered, afterForce: { ...f.counters } }); f.close();
}
{
  const f = fixture(); await f.reload(); f.state.healthy = true; f.state.revision++; await f.reload();
  assert.equal(f.value().downloadedChapters, 1); assert.equal(f.counters.host, 2); f.close();
  observations.push({ control: 'Core/coordinator revision change invalidates as designed' });
}
{
  const f = fixture(); f.state.rejectCore = true; await f.reload(); assert.equal(f.value().projectionStatus, 'unavailable');
  f.state.rejectCore = false; f.state.healthy = true; await f.reload(); assert.equal(f.value().downloadedChapters, 1); f.close();
  observations.push({ control: 'Outer rejected projections are not sticky cached ready zero' });
}
for (const mode of ['false', 'io']) {
  const f = fixture({ privateVariant: true, mode }); await f.reload(); assert.equal(f.value().downloadedChapters, 0);
  f.state.healthy = true; await f.remount(); assert.equal(f.value().downloadedChapters, 0); assert.equal(f.counters.host, 1);
  await f.force(); assert.equal(f.value().downloadedChapters, 1); assert.equal(f.counters.host, 2); f.close();
  observations.push({ mode, negativeControl: 'BYPASS_BOTH_GUARDS_REPRODUCES_STICKY_ZERO' });
}
{
  const f = fixture({ kind: 'text' }); await f.reload(); const first = { ...f.counters }; await f.remount();
  assert.deepEqual(f.counters, first, 'Core-only novel negatives retain current reuse policy'); assert.equal(f.counters.host, 0); f.close();
  observations.push({ control: 'Production preserves Core-only novel negative reuse' });
}
for (const coreOnly of ['missing', 'no-version']) {
  const f = fixture({ coreOnly }); await f.reload(); const first = { ...f.counters }; f.state.healthy = true; await f.remount();
  assert.equal(f.value().downloadedChapters, 0); assert.deepEqual(f.counters, first); assert.equal(f.counters.host, 0); f.close();
  observations.push({ coreOnly, control: 'MANGA_CORE_ONLY_NEGATIVE_STILL_REUSED' });
}
for (const entryKind of ['null', 'mismatch']) {
  const f = fixture({ entryKind }); f.state.healthy = true; await f.reload(); assert.equal(f.value().downloadedChapters, 0);
  assert.equal(f.counters.host, 0); f.state.entryKind = 'matching'; await f.remount();
  assert.equal(f.value().downloadedChapters, 1); assert.equal(f.counters.entry, 2); assert.equal(f.counters.host, 1); f.close();
  observations.push({ entryKind, control: 'UNCONFIRMED_ENTRY_REVALIDATES_ON_ORDINARY_REMOUNT' });
}
{
  const f = fixture(); await f.reload(); const stale = f.value();
  f.host.statusIndex.set(stale.key, { statusRevision: '0:', view: stale });
  f.state.healthy = true; await f.reload(); assert.equal(f.value().downloadedChapters, 1); assert.equal(f.counters.host, 2); f.close();
  observations.push({ control: 'ALREADY_INDEXED_NEGATIVE_IS_NOT_REUSED' });
}
{
  const f = fixture({ oneChapter: true }); f.state.healthy = true; await f.reload();
  assert.equal(f.value().downloadedChapters, 1); assert.equal(f.value().totalChapters, 1);
  const first = { ...f.counters }; await f.remount(); assert.deepEqual(f.counters, first); f.close();
  observations.push({ control: 'COMPLETE_MANGA_BOOK_REUSE_PRESERVED' });
}

async function delayedNegativePreservesNewerIndex(revisionMutant = false) {
  const f = fixture({ mode: 'false', revisionMutant });
  let gate;
  try {
    f.state.healthy = true; await f.reload();
    const staleRevision = f.host.currentStatusRevision(f.value());
    f.state.healthy = false; gate = f.holdNextHostRead();
    // Actual manual refresh captures R1, then awaits its already false Host read.
    const older = f.force();
    await gate.waiting;
    f.state.revision += 1; f.state.healthy = true;
    const currentRevision = f.host.currentStatusRevision(f.value());
    assert.notEqual(currentRevision, staleRevision);
    // Same actual loadRow call made by progress hydration, without a timer or
    // a replacement Host. Download clock changes do not retire content leases.
    const completed = await f.host.loadRow(f.value(), () => true, true, currentRevision);
    assert.equal(completed.downloadedChapters, 1);
    const key = completed.key;
    const newer = f.host.statusIndex.get(key);
    assert.equal(newer.statusRevision, currentRevision);
    assert.equal(newer.view.chapters[1].localComplete, true);
    gate.release(); await older;
    assert.equal(f.host.statusIndex.get(key), newer,
      'late R1 negative must not evict R2 complete index');
    const before = { ...f.counters };
    await f.reload();
    assert.equal(f.value().downloadedChapters, 1);
    assert.deepEqual(f.counters, before, 'ordinary reload reuses the preserved R2 complete index');
  } finally { gate?.release(); f.close(); }
}

await delayedNegativePreservesNewerIndex();
observations.push({ control: 'LATE_R1_NEGATIVE_PRESERVES_R2_COMPLETE_INDEX_AND_REUSE' });
await assert.rejects(() => delayedNegativePreservesNewerIndex(true),
  /late R1 negative must not evict R2 complete index/, 'old production guard ordering is rejected');
observations.push({ negativeControl: 'ROLLBACK_REVISION_FENCE_REPRODUCES_NEWER_INDEX_EVICTION' });
assert.equal(observations.length, 17, 'all17reviewed groups must complete');
console.log(JSON.stringify({ kind: 'reader-shared-download-host-recovery', case: caseId, status: 'PASS',
  outcome: 'FIXED_PRODUCTION_RECOVERY_AND_COUNTERFACTUAL_PASS', groups: observations.length,
  diagnosticSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  sources: Object.fromEntries(Object.entries(raw).map(([key, text]) => [files[key], createHash('sha256').update(text).digest('hex')])),
  observations, productionFixEvaluated: true, SDKBuild: false, device: false, CoreOrNativeRuntimeExecuted: false,
  boundary: 'Actual full production Host/Gateway/Manga entry/Projection plus actual DiskCache readValidManifest method; controlled Core/shelf and metadata IO ports only. This is a recovery seam reproduction, not proof of the historical VM0/2 cause.' }));
