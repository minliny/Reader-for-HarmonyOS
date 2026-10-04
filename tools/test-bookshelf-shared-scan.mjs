import assert from 'node:assert/strict';
import { bookshelfCatalogHost, catalogIndexMethods } from './lib/bookshelf-catalog-host-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ProductionHost as ReadingEntryHost, setRuntime, ReadingEntryPreparation } from './lib/reading-entry-owner-probe.mjs';

const index = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
async function until(predicate) {
  for (let count = 0; count < 100; count += 1) {
    if (predicate()) return;
    await pause();
  }
  assert.fail('background shelf scan did not settle');
}

function fixture({ autoCheckUpdate = true, fullRevision = 'rev-1', membershipRevision = 'rev-1', failFull = false,
  fullGates = [] } = {}) {
  const books = [
    { sourceId: 'local', bookId: 'visible', lastCheckAt: 1 },
    { sourceId: 'remote', bookId: 'offscreen', lastCheckAt: Date.now() / 1000 },
  ];
  const scans = [], admissions = [], refreshed = [];
  let owner, fullCount = 0;
  const preparations = {
    async preparePersistedShelf(revision, loadSeeds, allowed) {
      admissions.push({ revision, loadSeeds, allowed });
    },
  };
  owner = {
    setReadingPreparationContext() {},
    readingEntryPreparations: () => preparations,
    bookAcquisitions: () => ({ acquireBook: async seed => { refreshed.push([seed]); return { identity: { sourceId: seed.sourceId, bookId: seed.bookId }, entries: [] }; } }),
  };
  owner.supportsCoreCapability=c=>c==='bookshelf.pageProjection.v1';
  owner.request=async(method,params,options)=>{assert.equal(method,'bookshelf.list');scans.push({membershipOnly:params.membershipOnly===true});await pause();
    if(options?.shouldCancel?.())throw Error('cancelled exact read');
    return{data:{books:books.map((b,i)=>({...b,title:b.bookId,author:'Writer',addedAt:1,sortIndex:i,sourceName:b.sourceId==='local'?'本地书籍':'Remote'})),
      total:books.length,projectionRevision:membershipRevision,changed:false,unfilteredTotal:books.length,unfilteredOnlineTotal:1}};
  };
  const exactRuntime=owner,acquisition=owner.bookAcquisitions();
  owner.bookAcquisitions=()=>({...acquisition,request:(...args)=>exactRuntime.request(...args)});
  setRuntime(owner);
  class ScanFlow {
        async loadAll(current, membershipOnly = false) {
          scans.push({ membershipOnly });
          if (!membershipOnly) {
            fullCount += 1;
            await fullGates[fullCount - 1]?.promise;
          }
          await pause();
          if (failFull && !membershipOnly) throw new Error('full scan failed');
          return current() ? { books, total: books.length,
            projectionRevision: membershipOnly ? membershipRevision :
              (typeof fullRevision === 'function' ? fullRevision(fullCount) : fullRevision) } : undefined;
        }
      }
  const Index = productionMotionMethods(index,
    [...catalogIndexMethods,'preparePersistedShelfBooks','readingPreparationContext','sharedReadingPreparationSeeds'], {
      ReaderRuntimeOwner: { current: () => owner }, ReadingEntryHost,
      BookshelfFlowGateway: ScanFlow,
      LOCAL_SOURCE_ID: 'local', CATALOG_REFRESH_INTERVAL_MS: 600000,
      DOMAIN: 0, hilog: { warn() {} },
    });
  const page = Object.assign(new Index(), {
    mountedRuntimeOwner:owner,shelfReceiptRetired:false,detailShelfAdmissionMount:1,rssInstanceIdentity:1,shelfReadingFilter:'all',shelfSourceFilter:'all',bookshelfHost:bookshelfCatalogHost(ScanFlow,()=>owner),navigationGeneration:1,bookshelfBackgroundEpoch:0,route: 'bookshelf', shelfProjectionRevision: 'rev-1', shelfBooks: [books[0]],
    settingsSnapshot: { autoCheckUpdate }, applicationSettingsSnapshot: { autoCheckUpdate },
    readingSessionActive: false, searchAppForeground: true, bookshelfUpdateRunning: false,
    bookshelfBackgroundRefreshRunning: false,
    bookshelfLoadGeneration:0,
  });
  return { page, books, scans, admissions, refreshed, owner,
    changeOwner(value) { owner = value; setRuntime(value); } };
}

{
  const f = fixture();
  f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
  f.page.preparePersistedShelfBooks();
  await until(() => !f.page.bookshelfBackgroundRefreshRunning);
  assert.deepEqual(f.scans, [{ membershipOnly: false }], 'automatic catalog scan reads the full shelf once');
  assert.deepEqual(await f.admissions[0].loadSeeds(f.admissions[0].allowed), [
    { sourceId: 'local', bookId: 'visible' }, { sourceId: 'remote', bookId: 'offscreen' },
  ], 'idle preparation reuses the complete identity set, including offscreen books');
  assert.equal(f.scans.length, 1, 'preparation must not page over the shelf again');
  assert.deepEqual(f.refreshed, [], 'fresh catalog metadata needs no network refresh');
}

{
  const f = fixture({ autoCheckUpdate: false });
  f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
  f.page.preparePersistedShelfBooks();
  assert.deepEqual(await f.admissions[0].loadSeeds(f.admissions[0].allowed), [
    { sourceId: 'local', bookId: 'visible' }, { sourceId: 'remote', bookId: 'offscreen' },
  ]);
  assert.deepEqual(f.scans, [{ membershipOnly: true }],
    'disabled automatic updates still admit durable preparation');
}

for (const options of [{ failFull: true }, { fullRevision: 'rev-2' }]) {
  const f = fixture(options);
  f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
  f.page.preparePersistedShelfBooks();
  assert.equal((await f.admissions[0].loadSeeds(f.admissions[0].allowed)).length, 2);
  await until(() => !f.page.bookshelfBackgroundRefreshRunning);
  assert.deepEqual(f.scans, [{ membershipOnly: false }, { membershipOnly: true }],
    'failed or different-revision full scan falls back to a membership read');
}

{
  const f = fixture();
  f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
  f.page.preparePersistedShelfBooks();
  f.page.shelfProjectionRevision = 'rev-2';
  assert.equal(f.admissions[0].allowed(), false, 'old preparation is revoked when the shelf revision changes');
  assert.equal(await f.admissions[0].loadSeeds(f.admissions[0].allowed), undefined);
  await until(() => !f.page.bookshelfBackgroundRefreshRunning);
  assert.deepEqual(f.scans, [{ membershipOnly: false }, { membershipOnly: false }],
    'old preparation cannot start a membership scan; automatic refresh retries the new revision once');
}

{
  const first = deferred();
  const f = fixture({ fullGates: [first], fullRevision: count => `rev-${count}` });
  f.books[1].lastCheckAt = 0;
  f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
  await until(() => f.scans.length === 1);
  f.page.shelfProjectionRevision = 'rev-2';
  f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
  first.resolve();
  await until(() => f.scans.length === 2 && !f.page.bookshelfBackgroundRefreshRunning);
  assert.deepEqual(f.scans, [{ membershipOnly: false }, { membershipOnly: false }],
    'an in-flight old scan yields one replacement scan for the latest shelf revision');
  assert.equal(f.refreshed.length, 1, 'only the new revision may refresh catalogs');
  assert.deepEqual(f.refreshed[0].map(book => book.bookId), ['offscreen']);
}

{
  const first = deferred(), second = deferred();
  const f = fixture({ fullGates: [first, second], fullRevision: count => `rev-${count}` });
  f.books[1].lastCheckAt = 0;
  f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
  await until(() => f.scans.length === 1);
  f.page.shelfProjectionRevision = 'rev-2';
  first.resolve();
  await until(() => f.scans.length === 2);
  f.page.shelfProjectionRevision = 'rev-3';
  second.resolve();
  await until(() => !f.page.bookshelfBackgroundRefreshRunning);
  assert.equal(f.scans.length, 2, 'volatile revisions cannot create an unbounded retry chain');
  assert.equal(f.refreshed.length, 0, 'both superseded scans abandon their catalogs');
}

{
  const f = fixture({ autoCheckUpdate: false, membershipRevision: 'rev-2' });
  f.page.preparePersistedShelfBooks();
  assert.equal(await f.admissions[0].loadSeeds(f.admissions[0].allowed), undefined,
    'a newer Core membership cannot be published under the old shelf revision');
}

{
  const f = fixture();
  f.page.preparePersistedShelfBooks();
  f.changeOwner({ setReadingPreparationContext() {}, readingEntryPreparations() { throw new Error('stale owner'); } });
  assert.equal(f.admissions[0].allowed(), false, 'owner replacement revokes the old preparation');
  assert.equal(await f.admissions[0].loadSeeds(f.admissions[0].allowed), undefined);
  assert.deepEqual(f.scans, [], 'actual Core admission rejects a retired owner before any membership RPC');
}

{
  const f = fixture();
  f.books[1].contentKind = 'manga';
  f.page.scheduleBookshelfBackgroundRefresh(f.page.shelfBooks);
  f.page.preparePersistedShelfBooks();
  await until(() => !f.page.bookshelfBackgroundRefreshRunning);
  const admission = f.admissions[0];
  const seeds = await admission.loadSeeds(admission.allowed);
  assert.deepEqual(seeds, [
    { sourceId: 'local', bookId: 'visible' },
    { contentKind: 'manga', sourceId: 'remote', bookId: 'offscreen' },
  ], 'real complete catalog-owner seed mapping preserves Core manga kind without changing legacy shape');
  assert.deepEqual(f.scans, [{ membershipOnly: false }]);
  const prepared = [], request = f.owner.request;
  f.owner.supportsCoreCapability = capability => capability === 'reading.entry.prepare.v1' || capability === 'bookshelf.pageProjection.v1';
  f.owner.request = async (method, params, options) => {
    if (method !== 'reading.entry.prepare') return request(method, params, options);
    assert.equal(options.shouldCancel(), false);
    prepared.push(params);
    return { data: { sourceId: params.sourceId, bookId: params.bookId,
      kind: 'ready', reason: 'prepared', chapterIndex: 3 + params.neighborOffset } };
  };
  const actual = new ReadingEntryPreparation(f.owner, false);
  await actual.preparePersistedShelf('rev-1', admission.loadSeeds, admission.allowed);
  assert.equal(prepared.length, 7, 'the existing actual preparation owner still prepares all seven text offsets');
  assert.ok(prepared.every(params => params.sourceId === 'local' && params.bookId === 'visible'),
    'typed manga from the real shared catalog scan never becomes text preparation');
  assert.equal(f.scans.length, 1, 'actual preparation reuses the same admitted complete scan');
  actual.close();
}

console.log('bookshelf shared scan: PASS (single scan, fallback, revision fencing, bounded retry)');
console.log('PASS real shared catalog manga kind -> actual text-preparation exclusion; exact legacy seeds retained');
