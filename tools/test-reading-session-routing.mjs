import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

async function routingFixture(initialRoute) {
  const { fixture, book, seed, until } = await import('./lib/reading-entry-index-fixture.mjs');
  const { bookshelfOperationClass } = await import('./lib/bookshelf-operation-owner-probe.mjs');
  const { actualReadingEntryPresentation } = await import('./lib/reading-entry-presentation-probe.mjs');
  const { ReaderEntryStartupTrace } = await import('../entry/src/main/ets/app/ReaderStartupTrace.ts');
  const { ReaderNavigation } = await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
  const EntryActions = bookshelfOperationClass('app/composition/ReaderReadingEntryActions.ets',
    'ReaderReadingEntryActions', { Observed: value => value });
  const SourceJourney = bookshelfOperationClass('app/composition/ReaderSourceSwitchJourney.ts', 'ReaderSourceSwitchJourney');

  const f = fixture();
  const entry = new (actualReadingEntryPresentation({ ReadingEntryHost: f.host.constructor }))();
  const navigation = new ReaderNavigation();
  navigation.show(initialRoute);
  const runtime = () => f.runtime.closed ? undefined : f.runtime;
  const source = { visible: false };
  const route = () => navigation.snapshot().route;
  const search = { host: { visibilityChanged() {} }, admissionCandidates: () => [] };
  const entryPorts = owner => {
    const generation = navigation.snapshot().generation;
    return {
      current: () => runtime() === owner && f.control.live && navigation.snapshot().generation === generation,
      projectionVisible: () => route() === 'detail' && !entry.sessionActive && !source.visible,
      membership: f.lease.membership,
      cacheDecision: f.lease.cacheDecision,
      notice: f.lease.notice,
      refreshShelf: f.lease.refreshShelf,
    };
  };
  const bindReader = () => entry.bindReader(f.runtime, entryPorts(f.runtime));
  const downloadView = {
    view: { query: 'kept', type: 'all', state: 'all', sourceId: '', sort: 'title', direction: 'asc', chapterScroll: 205 },
    membershipRevision: 1, storageCleanupRevision: 2,
  };
  const captureReturn = () => navigation.returns.captureReaderReturn(f.runtime, () => downloadView);
  const restoredViews = [];
  const restoreReturn = context => {
    if (context === undefined || runtime() !== context.owner) return false;
    navigation.returns.restoreReaderReturn(context, view => restoredViews.push(view));
    return true;
  };
  const advance = () => {
    entry.retire();
    actions.retirePreparation();
    return navigation.advance().generation;
  };
  const actions = new EntryActions(navigation, new ReaderEntryStartupTrace(() => {}), {
    runtime, entry: () => entry, search: () => search, sourceSwitch: () => source,
    shelfBooks: () => [...f.shelves.values()], removalPending: () => false, readerExitPending: () => false,
    advance, show: next => navigation.show(next), bindReader, restoreReaderReturn: restoreReturn,
    entryPorts, sourceName: (_id, name) => name ?? 'Named Source', failure: f.lease.notice,
    afterOpening: project => project(),
  });
  const reopenEvents = [];
  const sourceJourney = new SourceJourney(navigation, {
    entry: () => entry, entryActions: () => actions,
    captureReturn,
    restoreReturn: context => { reopenEvents.push(['restore', context]); return restoreReturn(context); },
    invalidateDownloads: () => reopenEvents.push(['invalidate']),
  });
  return {
    f, entry, navigation, actions, sourceJourney, route, captureReturn, downloadView, restoredViews, reopenEvents, book, seed, until,
    close() { entry.retire(); f.close(); },
  };
}

async function detailChild(fixture) {
  const { readFileSync } = await import('node:fs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { bookshelfOperationClass } = await import('./lib/bookshelf-operation-owner-probe.mjs');
  const root = new URL('../entry/src/main/ets/', import.meta.url);
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const remoteContentVerdictLabel = bookshelfOperationClass('features/reading/presentation/ReadingEntryPresentation.ets',
    'remoteContentVerdictLabel', { Observed: value => value });
  // Record the actual SDK-emitted detail child's props at the native leaf boundary.
  class LocalBookDetail {
    constructor(_owner, params) { this.params = params; }
  }
  const properties = createArkUIPropertyRuntimeProbe();
  const scene = createReaderBuilderProbe(read('features/bookshelf/ui/BookshelfDetailScene.ets'), ['build', 'detailSurface'],
    { ...properties.sdk, LocalBookDetail, remoteContentVerdictLabel },
    { ...properties.hooks, childSources: { LocalBookDetail: read('features/reading/ui/LocalBookDetail.ets') } }).owner;
  const opening = fixture.navigation.snapshot();
  const identity = JSON.stringify([fixture.entry.book.sourceId, fixture.entry.book.bookId]);
  Object.assign(scene, {
    entry: fixture.entry, identity, foreground: true,
    detail: { sourceSwitchEnabled: () => true, admission: () => ({ adding: false, cancelling: false }), message: () => '' },
    mutations: { snapshot: { removalKey: '' } },
    ports: {
      captureAction: requested => () => requested === identity && fixture.navigation.snapshot() === opening,
      openReading: chapterIndex => fixture.actions.openReading(chapterIndex),
    },
  });
  scene.initialRender();
  const child = [...scene.children.values()].find(candidate => candidate instanceof LocalBookDetail);
  assert.ok(child, 'the real detail scene admits a native detail child');
  return child.params;
}

async function resume(sourceId) {
  const x = await routingFixture('bookshelf');
  try {
    x.actions.resumeShelf(x.book('book', sourceId));
    assert.equal(x.route(), 'reading');
    assert.equal(x.entry.sessionActive, true);
    assert.equal(x.entry.book.sourceId, sourceId);
    assert.equal(x.f.calls.filter(call => call.method !== 'intent').length, 0);
  } finally { x.close(); }
}

async function preview() {
  const x = await routingFixture('search');
  try {
    x.actions.openRemoteDetail({ seed: x.seed(), sourceName: 's1' });
    assert.equal(x.route(), 'detail');
    assert.equal(x.entry.loadingMessage, '正在获取在线目录…');
    await x.until(() => x.entry.verdict === 'readable');
    await x.f.settle();
    const child = await detailChild(x);
    assert.equal(child.readingEnabled, true);
    assert.equal(child.book.sourceName, 'Named Source');
    assert.equal(child.toc.length, 3);
    assert.equal(x.f.calls.filter(call => call.method === 'bookmark.list').length, 1);
    assert.equal(x.f.calls.some(call => /bookshelf\.(?:upsert|add|remove)/.test(call.method)), false);
    const before = x.f.calls.length;
    child.onContinue();
    assert.equal(x.route(), 'reading');
    assert.equal(x.f.calls.length, before);
  } finally { x.close(); }
}

async function reopen(sourceId) {
  const x = await routingFixture('bookshelf');
  try {
    x.actions.resumeShelf(x.book('original-book', 's2'));
    // The retained download chapter list offset makes restoration observable
    // after the newly admitted reader mounts.
    assert.equal(x.navigation.returns.openReadingFromDownloads(() => x.entry.sessionActive), true);
    const context = x.captureReturn();
    const committed = x.book('book', sourceId);
    const before = x.f.calls.length;
    x.sourceJourney.reopenCommitted(committed);
    assert.equal(x.route(), 'reading');
    assert.equal(x.entry.sessionActive, true);
    assert.equal(x.entry.book.sourceId, sourceId);
    assert.equal(x.entry.book.bookId, committed.bookId);
    assert.equal(x.f.calls.slice(before).filter(call => call.method !== 'intent').length, 0);
    assert.deepEqual(x.reopenEvents, [['invalidate'], ['restore', context]]);
    assert.deepEqual(x.captureReturn(), context);
    assert.deepEqual(x.restoredViews, [x.downloadView]);
  } finally { x.close(); }
}

const cases = {
  'resume-local': () => resume('local'),
  'resume-remote': () => resume('s1'),
  preview,
  'reopen-local': () => reopen('local'),
  'reopen-remote': () => reopen('s1'),
};
for (const id of selectContractCases({
  'resume-local': 'Actual local shelf mount before IO',
  'resume-remote': 'Actual remote shelf mount before IO',
  preview: 'Actual remote preview without shelf mutation',
  'reopen-local': 'Actual committed local source re-admission',
  'reopen-remote': 'Actual committed remote source re-admission',
})) {
  await cases[id]();
  recordContractCasePass(id);
}
