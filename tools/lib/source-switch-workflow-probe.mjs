import assert from 'node:assert/strict';
import { productionMotionMethods } from './reader-motion-method-probe.mjs';
import { actualSourceSwitchPresentation } from './source-switch-presentation-probe.mjs';
import { fixture, origin, target, session, Runtime, setCurrentRuntime, deferred } from './source-switch-owner-probe.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { read } from './source-switch-owner-probe.mjs';
const {readerSourceSwitchActions}=pureModuleProbe(read('app/composition/ReaderSourceSwitchActions.ets'),
 'ReaderSourceSwitchActions.ets',{},['readerSourceSwitchActions']);

export async function verifySourceSwitchWorkflow() {
  const journal = { transactionId: 'retained-source-switch', fromSourceId: origin.sourceId, fromBookId: origin.bookId,
    targetSourceId: target.sourceId, targetBookId: target.bookId };
  const f = fixture({ open: false, shared: true, pending: [journal] });
  const diagnostics = [], events = [];
  const Index = productionMotionMethods(new URL('../../entry/src/main/ets/pages/Index.ets', import.meta.url), [
    'reconcilePendingSourceSwitches', 'resolveReaderSourceSwitchTransaction', 'sourceSwitchProbeQuery',
  ], { ReaderRuntimeOwner: Runtime, SourceSwitchHost: f.Constructor, errorMessageOf: error => error.message, DOMAIN: 0,
    hilog: { info(_domain, _tag, _message, count) { diagnostics.push(count); }, warn(_domain, _tag, _message, error) { assert.fail(error); } } });
  const root = Object.assign(new Index(), { mountedRuntimeOwner: f.runtime, shelfReceiptRetired: false,
    detailShelfAdmissionMount: 1, navigationGeneration: 1, readingSessionActive: true,
    directoryCurrentChapterIndex: 7, requestedChapterIndex: undefined,
    shelfRead: { snapshot: { books: [origin, target] } }, librarySearch: { candidates: () => [], admissionCandidates: () => [], host: { searchedSourceIds: () => [] } },
  });
  root.readingEntry.book = { ...target, contentKind: 'text', sourceVersion: 'v1' };
  root.readingEntry.toc = [{ index: 1, title: 'First' }, { index: 7, title: 'Active' }, { index: 11, title: 'Last' }];
  try {
    assert.equal(root.sourceSwitchProbeQuery().currentChapterIndex, 7);
    root.readingSessionActive = false;
    assert.equal(root.sourceSwitchProbeQuery().currentChapterIndex, 11);
    root.readingSessionActive = true;
    await root.reconcilePendingSourceSwitches();
    assert.deepEqual(diagnostics, [1]);
    assert.equal(root.sourceSwitchPresentation.pending, undefined, 'startup is only an observation');
    assert.deepEqual(f.calls.map(([method]) => method), ['source.switch.pending.list']);
    assert.equal(await root.resolveReaderSourceSwitchTransaction('local', 'book'), undefined);
    assert.equal(await root.resolveReaderSourceSwitchTransaction(origin.sourceId, origin.bookId), undefined);
    assert.equal(await root.resolveReaderSourceSwitchTransaction(target.sourceId, target.bookId), journal.transactionId);
    assert.equal(root.sourceSwitchPresentation.pending?.transactionId, journal.transactionId);
    assert.equal(f.calls.filter(([method]) => method === 'source.switch.pending.list').length, 2);
    assert.ok(f.calls.every(([method]) => !/commit|rollback/.test(method)), 'receipt read cannot write or compensate');
  } finally {
    f.host.retire();
    setCurrentRuntime(undefined);
  }

  // Use controlled delivery ports to separate the workflow effect sequencing
  // from platform route builders, while keeping the shipping presenter/lease.
  const runtime = {}, old = { ...origin, contentKind: 'text', sourceVersion: 'v1' };
  const entry = { book: old, seed: undefined, session: undefined, inBookshelf: true, sessionActive: true,
    directoryCurrentChapterIndex: 7, requestedChapterIndex: undefined,
    toc: [{ index: 0, title: 'Original' }, { index: 7, title: 'Active' }, { index: 11, title: 'Last' }] };
  const gate = deferred();
  let scene = { owner: runtime, retired: false, navigation: 1, mount: 1, book: old, reading: true };
  let retainedLease, openedContext, hostVisible = false;
  const scopeId = 9, openings = [], refreshes = [];
  const host = { owns: candidate => candidate === runtime,
    current: () => ({ visible: hostVisible }),
    open(context, lease, refresh) {
      openedContext = context;
      retainedLease = lease;
      hostVisible = true;
      openings.push(refresh === true);
      lease.changed({ scopeId, visible: true, state: { kind: 'candidates', candidates: context.knownCandidates }, failureMessage: '' });
    },
    refresh: scope => refreshes.push(scope),
    bindReader(_context, lease) { retainedLease = lease; events.push('bind'); },
    resolveTransaction: () => gate.promise,
  };
  const Presentation = actualSourceSwitchPresentation({ ReaderRuntimeOwner: { isCurrent: owner => owner === runtime },
    SourceSwitchHost: { forRuntime: () => host } });
  const owner = new Presentation();
  let searchBooks = [{ ...old, category: 'novel' }, { ...target, category: 'comic' }];
  const ports = {
    scene: () => ({ ...scene, book: entry.book }), entry: () => entry,
    shelfBook: () => old,
    searchCandidates: () => searchBooks, searchedSourceIds: () => ['old'],
    preview: (_seed, name) => events.push(['preview', name]), target: () => events.push('target'),
    reopen: book => events.push(['reopen', book.bookId]), invalidateDownloads: book => events.push(['invalidate', book.bookId]),
    detailForShelf: book => ({ ...book, contentKind: 'text' }),
    clearSession: () => { assert.equal(entry.book.bookId, target.bookId); assert.equal(entry.toc.length, 0); events.push('clear'); },
    restored: changed => events.push(['restored', changed]), failed: () => events.push('failed'),
    refreshShelf: () => events.push('shelf'), closed: () => events.push('closed'),
  };
  owner.openForEntry(ports, () => { scene = { ...scene, navigation: scene.navigation + 1 }; });
  assert.deepEqual(openings, [false]);
  assert.equal(retainedLease.isCurrent(old), true, 'the lease captures the route after synchronous navigation preparation');
  assert.equal(openedContext.query.currentChapterIndex, 7, 'the active chapter comes from the reading entry');
  let displayedSource = owner;
  const actions = readerSourceSwitchActions(() => displayedSource,
    () => assert.fail('refresh uses the existing source presentation for both formats'),
    () => entry.book.contentKind === 'manga', () => ports);
  actions.refresh();
  actions.refresh(scopeId - 1);
  actions.refresh(scopeId);
  assert.deepEqual(refreshes, [scopeId], 'text refresh reuses the current scope without reopening');
  assert.deepEqual(openings, [false]);
  assert.deepEqual(openedContext.knownCandidates.map(candidate => candidate.bookUrl), [old.bookId]);
  searchBooks = [{ ...target, category: 'novel' }];
  assert.deepEqual(openedContext.readKnownCandidates().map(candidate => candidate.bookUrl), [target.bookId]);
  retainedLease.effect({ kind: 'previewReady', seed: {}, candidate: { sourceId: target.sourceId }, session });
  retainedLease.effect({ kind: 'targetReady', book: target, session, chapterIndex: 0 });
  retainedLease.effect({ kind: 'canonicalReady', book: target });
  retainedLease.effect({ kind: 'restoredForNextChoice', book: target });
  retainedLease.effect({ kind: 'acquisitionFailed', identity: origin });
  retainedLease.effect({ kind: 'acquisitionFailed', identity: target });
  retainedLease.effect({ kind: 'closed' });
  assert.deepEqual(events, [['preview', 'new'], 'target', 'bind', 'shelf', ['reopen', 'target'], ['invalidate', 'target'],
    'clear', ['restored', true], 'shelf', 'failed', 'bind', 'closed']);
  assert.equal(entry.seed.detailUrl, target.bookId);
  const resolving = owner.resolveReaderTransaction(target, ports);
  scene = { ...scene, navigation: scene.navigation + 1 };
  gate.resolve('late');
  assert.equal(await resolving, undefined);
  retainedLease.effect({ kind: 'closed' });
  assert.equal(events.filter(event => event === 'closed').length, 1, 'old physical lease cannot navigate');

  // Manga preparation can leave the picker up after discovery has retired.
  const manga = new Presentation();
  entry.book = { ...old, contentKind: 'manga' };
  manga.openForEntry(ports, () => {});
  displayedSource = manga;
  hostVisible = false;
  actions.refresh(scopeId - 1);
  assert.deepEqual(openings, [false, false]);
  actions.refresh(scopeId);
  assert.deepEqual(openings, [false, false, true], 'the retained manga picker reopens discovery with forced refresh');
  assert.equal(openedContext.query.contentKind, 'manga');
  assert.deepEqual(refreshes, [scopeId]);

  const replacement = new Presentation();
  replacement.openForEntry(ports, () => { entry.book = { ...target, contentKind: 'manga' }; });
  assert.deepEqual(openings, [false, false, true], 'route preparation cannot open discovery for a replacement book');
}
