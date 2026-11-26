import assert from 'node:assert/strict';
import { bookshelfCatalogHost } from './lib/bookshelf-catalog-host-probe.mjs';
import { bookshelfOperationClass } from './lib/bookshelf-operation-owner-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { ProductionHost as ReadingEntryHost, setRuntime } from './lib/reading-entry-owner-probe.mjs';
import { actualReadingEntryPresentation } from './lib/reading-entry-presentation-probe.mjs';

const index = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const sameBookshelfProjectionScene = bookshelfOperationClass('features/bookshelf/presentation/BookshelfReadPresentation.ets',
  'sameBookshelfProjectionScene', { Observed: value => value });
const BookshelfCatalogPresentation = bookshelfOperationClass('features/bookshelf/presentation/BookshelfCatalogPresentation.ets',
  'BookshelfCatalogPresentation', { Observed: value => value, sameBookshelfProjectionScene, hilog: { warn() {} } });
const ReadingEntryPresentation = actualReadingEntryPresentation({ ReadingEntryHost });
const Index = selectedProductionMethods(index, 'Index',
  ['bookshelfProjectionScene', 'shelfCatalog', 'preparePersistedShelfBooks', 'readingShelfPreparationScene'],
  { State() {}, BookshelfCatalogPresentation });
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

function fixture({ autoCheckUpdate = true, fullRevision = 'rev-1', durableProjectionRevision = 'rev-1', failFull = false,
  fullGates = [] } = {}) {
  const books = [
    { sourceId: 'local', bookId: 'visible', lastCheckAt: 1 },
    { sourceId: 'remote', bookId: 'offscreen', lastCheckAt: Date.now() / 1000 },
    { sourceId: 'remote', bookId: 'manga', contentKind: 'manga', lastCheckAt: Date.now() / 1000 },
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
      total:books.length,projectionRevision:durableProjectionRevision,changed:false,unfilteredTotal:books.length,unfilteredOnlineTotal:1}};
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
        projectionRevision: membershipOnly ? durableProjectionRevision :
          (typeof fullRevision === 'function' ? fullRevision(fullCount) : fullRevision) } : undefined;
    }
    async load(current) {
      assert.equal(current(), true);
      return { books, total: books.length, projectionRevision: page.shelfRead.snapshot.revision };
    }
  }
  const page = Object.assign(new Index(), {
    shelfReceiptRetired: false, detailShelfAdmissionMount: 1, rssInstanceIdentity: 1, navigationGeneration: 1,
    bookshelfHost: bookshelfCatalogHost(ScanFlow, () => owner), route: 'bookshelf', searchAppForeground: true,
    shelfRead: {
      snapshot: { revision: 'rev-1', books: [books[0]] },
      filter: () => ({ readingState: 'all', sourceKind: 'all' }),
      invalidate() {}, accept() {},
    },
    readingEntry: new ReadingEntryPresentation(),
    settingsPresentation: { autoCheckUpdateEnabled: () => autoCheckUpdate, ready: () => true },
    libraryAcquisition: { currentOwner: () => owner === exactRuntime ? owner : undefined },
    readingCommits: { prefetch: async () => {} },
    transientFeedback: { show() {} },
  });
  return { page, books, scans, admissions, refreshed, owner,
    schedule: () => page.shelfCatalog.automatic(page.shelfRead.snapshot.books),
    running: () => page.shelfCatalog.snapshot.automaticRunning,
    setRevision: revision => { page.shelfRead.snapshot.revision = revision; },
    changeOwner(value) { owner = value; setRuntime(value); } };
}

{
  const f = fixture();
  f.schedule();
  f.page.preparePersistedShelfBooks();
  await until(() => !f.running());
  assert.deepEqual(f.scans, [{ membershipOnly: false }], 'automatic catalog scan reads the full shelf once');
  assert.deepEqual(await f.admissions[0].loadSeeds(f.admissions[0].allowed), [
    { sourceId: 'local', bookId: 'visible' }, { sourceId: 'remote', bookId: 'offscreen' },
  ], 'idle preparation reuses the complete identity set, including offscreen books');
  assert.equal(f.scans.length, 1, 'preparation must not page over the shelf again');
  assert.deepEqual(f.refreshed, [], 'fresh catalog metadata needs no network refresh');
}

{
  const f = fixture({ autoCheckUpdate: false });
  f.schedule();
  f.page.preparePersistedShelfBooks();
  assert.deepEqual(await f.admissions[0].loadSeeds(f.admissions[0].allowed), [
    { sourceId: 'local', bookId: 'visible' }, { sourceId: 'remote', bookId: 'offscreen' },
  ]);
  assert.deepEqual(f.scans, [{ membershipOnly: false }],
    'disabled automatic updates still require a typed durable projection for text admission');
  assert.equal(f.books.length, 3, 'admission leaves all text and manga shelf records intact');
}

for (const options of [{ failFull: true }, { fullRevision: 'rev-2' }]) {
  const f = fixture(options);
  f.schedule();
  f.page.preparePersistedShelfBooks();
  assert.equal((await f.admissions[0].loadSeeds(f.admissions[0].allowed)).length, 2);
  await until(() => !f.running());
  assert.deepEqual(f.scans, [{ membershipOnly: false }, { membershipOnly: false }],
    'failed or different-revision shared scan falls back to a typed full projection and still filters manga');
}

{
  const f = fixture();
  f.schedule();
  f.page.preparePersistedShelfBooks();
  f.setRevision('rev-2');
  assert.equal(f.admissions[0].allowed(), false, 'old preparation is revoked when the shelf revision changes');
  assert.equal(await f.admissions[0].loadSeeds(f.admissions[0].allowed), undefined);
  await until(() => !f.running());
  assert.deepEqual(f.scans, [{ membershipOnly: false }, { membershipOnly: false }],
    'old preparation cannot start a projection scan; automatic refresh retries the new revision once');
}

{
  const first = deferred();
  const f = fixture({ fullGates: [first], fullRevision: count => `rev-${count}` });
  f.books[1].lastCheckAt = 0;
  f.schedule();
  await until(() => f.scans.length === 1);
  f.setRevision('rev-2');
  f.schedule();
  first.resolve();
  await until(() => f.scans.length === 2 && !f.running());
  assert.deepEqual(f.scans, [{ membershipOnly: false }, { membershipOnly: false }],
    'an in-flight old scan yields one replacement scan for the latest shelf revision');
  assert.equal(f.refreshed.length, 1, 'only the new revision may refresh catalogs');
  assert.deepEqual(f.refreshed[0].map(book => book.bookId), ['offscreen']);
}

{
  const first = deferred(), second = deferred();
  const f = fixture({ fullGates: [first, second], fullRevision: count => `rev-${count}` });
  f.books[1].lastCheckAt = 0;
  f.schedule();
  await until(() => f.scans.length === 1);
  f.setRevision('rev-2');
  first.resolve();
  await until(() => f.scans.length === 2);
  f.setRevision('rev-3');
  second.resolve();
  await until(() => !f.running());
  assert.equal(f.scans.length, 2, 'volatile revisions cannot create an unbounded retry chain');
  assert.equal(f.refreshed.length, 0, 'both superseded scans abandon their catalogs');
}

{
  const f = fixture({ autoCheckUpdate: false, durableProjectionRevision: 'rev-2' });
  f.page.preparePersistedShelfBooks();
  assert.equal(await f.admissions[0].loadSeeds(f.admissions[0].allowed), undefined,
    'a newer Core projection cannot be published under the old shelf revision');
}

{
  const f = fixture();
  f.page.preparePersistedShelfBooks();
  f.changeOwner({ setReadingPreparationContext() {}, readingEntryPreparations() { throw new Error('stale owner'); } });
  assert.equal(f.admissions[0].allowed(), false, 'owner replacement revokes the old preparation');
  assert.equal(await f.admissions[0].loadSeeds(f.admissions[0].allowed), undefined);
  assert.deepEqual(f.scans, [], 'actual Core admission rejects a retired owner before any projection RPC');
}

console.log('bookshelf shared scan: PASS (single scan, fallback, revision fencing, bounded retry)');
