import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

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
  };
  const Index = productionMotionMethods(index,
    ['canRunBookshelfBackgroundRefresh', 'scheduleBookshelfBackgroundRefresh', 'preparePersistedShelfBooks'], {
      ReaderRuntimeOwner: { current: () => owner },
      BookshelfFlowGateway: class {
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
      },
      LOCAL_SOURCE_ID: 'local', CATALOG_REFRESH_INTERVAL_MS: 600000,
      DOMAIN: 0, hilog: { warn() {} },
    });
  const page = Object.assign(new Index(), {
    route: 'bookshelf', shelfProjectionRevision: 'rev-1', shelfBooks: [books[0]],
    settingsSnapshot: { autoCheckUpdate }, applicationSettingsSnapshot: { autoCheckUpdate },
    readingSessionActive: false, searchAppForeground: true, bookshelfUpdateRunning: false,
    bookshelfBackgroundRefreshRunning: false,
    async refreshBookshelfCatalogBatch(candidates) { refreshed.push(candidates); },
  });
  return { page, books, scans, admissions, refreshed, owner,
    changeOwner(value) { owner = value; } };
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
  assert.deepEqual(f.scans, [{ membershipOnly: true }], 'cancelled owner scan may return no seeds');
}

console.log('bookshelf shared scan: PASS (single scan, fallback, revision fencing, bounded retry)');
