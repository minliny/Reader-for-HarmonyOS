import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import {
  ReaderControlCatalogRouting, ReaderControlSelectionObservations, readerControlBookmarkPosition,
  type ReaderControlCatalogTarget, type ReaderControlObservedCommit, type ReaderDirectorySelectionFacts,
  type ReaderQuickSearchSelectionFacts,
} from '../../entry/src/main/ets/features/reading/presentation/ReaderControlSelectionRouting.ts';
import type { ReaderControlSelectionOwner, ReaderControlSelectionTicket } from
  '../../entry/src/main/ets/features/reading/application/ReaderControlSelectionTransaction.ts';
import type { ReaderDirectoryTargetProof } from '../../entry/src/main/ets/features/reading/application/ReaderDirectoryTargetProof.ts';
import type { LocalReadingContentMetrics, LocalReadingTocEntry } from
  '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';
import { ReaderControlBookmarkRead, readerBookmarkReadFailureSuperseded, type ReaderControlBookmarkReadIntent } from
  '../../entry/src/main/ets/features/reading/presentation/ReaderBookmarkProjection.ts';

const scope = { sourceId: 'remote', bookId: 'book', chapterIndex: 5, bodyVersion: 'body', processingVersion: 'rules' };

function catalogFixture() {
  const state = { enabled: true, pending: true, owner: 0, adjacent: undefined as number | undefined,
    metrics: undefined as LocalReadingContentMetrics | undefined, length: 2 };
  const deferred: Array<ReturnType<typeof Promise.withResolvers<void>>> = [];
  const targets: ReaderControlCatalogTarget[] = [];
  const warnings: string[] = [];
  const host = new ReaderControlCatalogRouting({
    canDispatch: () => state.enabled,
    isCatalogPending: () => state.pending,
    captureControlOwner: () => { const owner = state.owner; return () => owner === state.owner && state.enabled; },
    hydrate: () => { const operation = Promise.withResolvers<void>(); deferred.push(operation); return operation.promise; },
    findAdjacent: () => state.adjacent,
    metrics: () => state.metrics,
    catalogLength: () => state.length,
    dispatch: target => targets.push(target),
    warn: (action, error) => warnings.push(`${action}:${error.message}`),
  });
  return { host, state, deferred, targets, warnings };
}

test('a known adjacent chapter dispatches immediately while an incomplete catalogue can still be pending', () => {
  const reader = catalogFixture();
  reader.state.adjacent = 5;
  reader.host.step(0);
  reader.host.seek(NaN);
  reader.host.step(1);
  assert.deepEqual(reader.targets, [{ kind: 'head', chapterIndex: 5 }]);
  assert.deepEqual(reader.deferred, []);
});

test('catalogue completion only dispatches the latest seek and projects its exact stored scalar', async () => {
  const reader = catalogFixture();
  reader.host.step(-1);
  reader.host.seek(25);
  reader.state.metrics = { bookId: 'book', totalScalarLength: 100, chapters: [
    { chapterIndex: 2, scalarLength: 20, cumulativeStart: 0, cumulativeEnd: 20 },
    { chapterIndex: 5, scalarLength: 80, cumulativeStart: 20, cumulativeEnd: 100 },
  ] };
  reader.state.adjacent = 3;
  reader.state.pending = false;
  reader.deferred[0].resolve();
  reader.deferred[1].resolve();
  await setImmediate();
  assert.deepEqual(reader.targets, [{ kind: 'exact', chapterIndex: 5, chapterOffset: 5 }]);
  reader.state.metrics = { bookId: 'book', totalScalarLength: 0, chapters: [] };
  reader.host.seek(50);
  assert.equal(reader.targets.length, 1);
  reader.state.metrics = undefined;
  reader.host.seek(100);
  assert.deepEqual(reader.targets[1], { kind: 'approximate', position: 1, chapterProgress: 1 });
});

test('a changed control owner and an unloaded catalogue retire continuations without re-queuing', async () => {
  const reader = catalogFixture();
  reader.host.step(1);
  reader.state.owner += 1;
  reader.state.pending = false;
  reader.state.adjacent = 2;
  reader.deferred[0].resolve();
  await setImmediate();
  assert.deepEqual(reader.targets, []);
  reader.state.pending = true;
  reader.host.seek(25);
  reader.deferred[1].resolve();
  await setImmediate();
  assert.equal(reader.deferred.length, 2);
  assert.deepEqual(reader.targets, []);
});

test('explicit chapter selection shares the generation while retaining its own owner check and diagnostics', async () => {
  const reader = catalogFixture();
  let dispatches = 0;
  reader.host.seek(30);
  reader.host.deferSelection(() => ({ isCurrent: () => true, dispatch: () => { dispatches += 1; } }));
  reader.deferred[0].reject(new Error('transport lost'));
  reader.deferred[1].resolve();
  await setImmediate();
  assert.equal(dispatches, 1);
  assert.deepEqual(reader.targets, []);
  assert.deepEqual(reader.warnings, ['seek:transport lost']);
  reader.host.deferSelection(() => ({ isCurrent: () => true, dispatch: () => assert.fail('retired generation') }));
  reader.host.invalidate();
  reader.deferred[2].resolve();
  await setImmediate();
});

test('bookmark and search offsets retain independent body proof and catalogue ownership', () => {
  const target: ReaderDirectoryTargetProof = { sourceId: 'remote', bookId: 'book', catalogRevision: 'catalog',
    structureRevision: 'directories', nodeId: 'chapter-5', chapterIndex: 5, url: 'https://example.test/chapter' };
  const request = { sourceId: 'remote', bookId: 'book', local: false, chapterIndex: 5, chapterOffset: 13 };
  assert.throws(() => readerControlBookmarkPosition({ ...request, directoryTargetProof: target }), /READING_POSITION_SCOPE_UNAVAILABLE/);
  assert.throws(() => readerControlBookmarkPosition({ ...request, positionScope: { ...scope, chapterIndex: 6 } }), /READING_POSITION_SCOPE_MISMATCH/);
  assert.deepEqual(readerControlBookmarkPosition({ ...request, positionScope: scope, directoryTargetProof: target }), {
    bodyVersion: scope.bodyVersion, processingVersion: scope.processingVersion,
    anchors: [{ id: 'requested', offset: 13 }], directoryTargetProof: target,
  });
  assert.deepEqual(readerControlBookmarkPosition({ ...request, chapterOffset: 0, directoryTargetProof: target }),
    { anchors: [], directoryTargetProof: target });
  assert.throws(() => readerControlBookmarkPosition({ ...request, positionScope: scope,
    directoryTargetProof: { ...target, bookId: 'other' } }), /DIRECTORY_SCOPE_CHANGED/);
  assert.equal(readerControlBookmarkPosition({ ...request, sourceId: 'local', local: true }), undefined);
});

function observationFixture() {
  const owner: ReaderControlSelectionOwner = { sourceId: 'local', bookId: 'book', lifecycleToken: 2,
    selectionToken: 4, controlOpenRevision: 7, mounted: true, exitRequested: false, controlVisible: true, controlClosing: false };
  const state = { reading: 'reading', ticket: undefined as ReaderControlSelectionTicket | undefined };
  const reports: Array<[string, ReaderQuickSearchSelectionFacts | ReaderDirectorySelectionFacts]> = [];
  const host = new ReaderControlSelectionObservations({ selectionToken: () => owner.selectionToken,
    ticket: () => state.ticket, owner: () => owner, readingIdentity: () => state.reading,
    publishQuick: (stage, facts) => reports.push([stage, facts]),
    publishDirectory: (stage, facts) => reports.push([stage, facts]),
  });
  const dispatch = (chapterIndex: number) => {
    owner.selectionToken += 1;
    const ticket: ReaderControlSelectionTicket = { sourceId: owner.sourceId, bookId: owner.bookId,
      lifecycleToken: owner.lifecycleToken, selectionToken: owner.selectionToken,
      controlOpenRevision: owner.controlOpenRevision, targetChapterIndex: chapterIndex };
    state.ticket = ticket;
    return ticket;
  };
  const committed = (): ReaderControlObservedCommit => ({ phaseReady: true,
    materializedSelectionToken: owner.selectionToken, visibleSelectionToken: owner.selectionToken,
    visibleChapterIndex: 5, storedChapterIndex: 5, storedChapterOffset: 10, pageStartScalar: 10, pageEndScalar: 20 });
  return { host, state, owner, reports, dispatch, committed };
}

test('quick search captures the actual dispatched anchor and only acknowledges a committed half-open page range', () => {
  const reader = observationFixture();
  const target = { sourceId: 'local', bookId: 'book', bookName: 'Book', chapterIndex: 5, chapterOffset: 5,
    matchLength: 1, snippetStart: 4, chapterTitle: 'Chapter', snippet: 'text' };
  reader.host.observeQuick({ readingId: 'reading', scope: 3, ordinal: 2, epoch: 9, target }, () => {
    target.chapterOffset = 19;
    reader.dispatch(5);
  });
  target.chapterOffset = 20;
  assert.ok(reader.state.ticket);
  reader.host.complete(reader.state.ticket, reader.owner, reader.committed);
  reader.host.complete(reader.state.ticket, reader.owner, () => assert.fail('receipt already consumed'));
  assert.deepEqual(reader.reports, [
    ['selection-admitted', { scope: 3, ordinal: 2, form: 'quick', epoch: 9 }],
    ['selection-committed', { scope: 3, ordinal: 2, form: 'quick', epoch: 9, matchingChapter: true, containsTarget: true }],
  ]);
  reader.host.observeQuick({ readingId: 'reading', scope: 3, ordinal: 2, epoch: 9, target }, () => reader.dispatch(5));
  assert.ok(reader.state.ticket);
  reader.host.complete(reader.state.ticket, reader.owner, reader.committed);
  assert.equal((reader.reports.at(-1)?.[1] as ReaderQuickSearchSelectionFacts).containsTarget, false);
});

test('directory effects require a newer actual ticket, use its captured opening and retire with observation identity', () => {
  const reader = observationFixture();
  let epoch = 9;
  const input = { readingId: 'reading', fromChapterIndex: 2, chapterIndex: 5, readEpoch: () => epoch };
  reader.host.observeDirectory(input, () => {});
  assert.equal(reader.reports.length, 0);
  reader.host.observeDirectory(input, () => { epoch = 10; reader.dispatch(5); });
  reader.owner.controlOpenRevision += 1;
  assert.ok(reader.state.ticket);
  reader.host.complete(reader.state.ticket, reader.owner, () => ({ ...reader.committed(), storedChapterOffset: 0, pageStartScalar: 0 }));
  assert.deepEqual(reader.reports, [
    ['selection-admitted', { fromChapterIndex: 2, chapterIndex: 5, selectionToken: 5, openRevision: 7, epoch: 10 }],
    ['selection-committed', { fromChapterIndex: 2, chapterIndex: 5, selectionToken: 5, openRevision: 7, epoch: 10,
      matchingChapter: true, chapterStart: true }],
  ]);
  reader.host.observeDirectory(input, () => reader.dispatch(5));
  assert.ok(reader.state.ticket);
  reader.state.reading = 'new observation';
  reader.host.complete(reader.state.ticket, reader.owner, () => assert.fail('retired observation cannot read native page'));
  assert.equal(reader.reports.length, 3);
});

test('bookmark panel and chapter refresh share one generation while preserving scheduling and failure ownership', async () => {
  const host = new ReaderControlBookmarkRead();
  const list = Promise.withResolvers<void>();
  const refresh = Promise.withResolvers<void>();
  const calls: string[] = [];
  let listCurrent: (() => boolean) | undefined;
  const open = (owns: () => boolean): ReaderControlBookmarkReadIntent => ({ isCurrent: owns,
    load: current => { listCurrent = current; calls.push('list'); return list.promise; },
    failed: () => assert.fail('old panel request cannot report failure') });
  host.open(open, () => calls.push(`reset:${host.isPending()}`));
  assert.deepEqual(calls, ['reset:false']);
  await setImmediate();
  assert.equal(listCurrent?.(), true);
  host.refresh(owns => ({ isCurrent: owns, load: () => { calls.push('refresh'); return refresh.promise; },
    failed: error => calls.push(error.message) }), () => calls.push(`reset:${host.isPending()}`));
  assert.equal(listCurrent?.(), false);
  list.reject(new Error('old list'));
  await setImmediate();
  assert.equal(host.isPending(), true);
  refresh.reject(new Error('this refresh'));
  await setImmediate();
  assert.equal(host.isPending(), false);
  assert.deepEqual(calls, ['reset:false', 'list', 'reset:true', 'refresh', 'this refresh']);
  assert.equal(host.admitNotice('book failure'), true);
  assert.equal(host.admitNotice('book failure'), false);
  host.clearNotice();
  assert.equal(host.admitNotice('book failure'), true);
});

test('only a new and complete bookmark projection can suppress an older observation failure', () => {
  const start: LocalReadingTocEntry[] = [{ index: 5, title: 'Chapter', downloadState: 'unknown' }];
  const complete: LocalReadingTocEntry[] = [{ ...start[0], bookmarks: [] }];
  assert.equal(readerBookmarkReadFailureSuperseded('', start, complete), true);
  assert.equal(readerBookmarkReadFailureSuperseded('', start, start), false);
  assert.equal(readerBookmarkReadFailureSuperseded('', start, [{ ...start[0] }]), false);
  assert.equal(readerBookmarkReadFailureSuperseded('same canonical error', start, complete), false);
});
