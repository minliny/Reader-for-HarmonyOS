import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import {
  ReadingEntryHydrationCoordinator, type ReadingFirstFrameRead, type ReadingFirstFrameReadiness,
} from '../../entry/src/main/ets/features/reading/application/ReadingEntryHydrationCoordinator.ts';
import { ReadingChapterWindow, type ReadingSessionChapter } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import { CoreReadingAnchor, createCoreReadingLayout } from '../../entry/src/main/ets/features/reading/application/ReadingMeasurementFacts.ts';
import { ReaderProgressProducerHost, type ReaderProgressProducerIntent } from '../../entry/src/main/ets/features/reading/application/ReaderProgressProducerHost.ts';
import type { LocalReadingToc, LocalReadingTocEntry } from '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';
import type { ReadingSessionCommittedProgress } from '../../entry/src/main/ets/features/reading/application/ReadingSessionFlowGateway.ts';
import type { ReadingEntrySnapshot } from '../../entry/src/main/ets/features/reading/application/ReadingEntrySnapshot.ts';

const chapter: ReadingSessionChapter = {
  sourceId: 'source', bookId: 'book', chapterIndex: 4, chapterTitle: 'Chapter 4',
  chapterUrl: 'https://example.test/4', content: '𐐷',
  documentRange: { startScalar: 3, endScalar: 4, totalScalars: 6 },
  images: [], contentVersion: '4-content', extractionVia: 'rule',
};
const neighbour: ReadingSessionChapter = {
  ...chapter, chapterIndex: 5, chapterTitle: 'Chapter 5', chapterUrl: 'https://example.test/5',
  content: 'Next chapter', contentVersion: '5-content', documentRange: undefined,
};
const rows = (indexes: number[]): LocalReadingTocEntry[] => indexes.map(index =>
  ({ index, title: `Chapter ${index}`, downloadState: 'unknown' }));
const bounds: ReadingFirstFrameReadiness = {
  appearanceReady: true, settingsReady: true, viewportReady: true, fontReady: () => true,
  sourceSwitchPending: false, supportsPreparedEntry: () => true, screenDirection: 'portrait', width: 390, height: 720,
};
const snapshot: ReadingEntrySnapshot = {
  chapter, progress: { kind: 'missing' }, isCurrent: () => true,
};
const scope = { sourceId: 'source', bookId: 'book', chapterIndex: 4, bodyVersion: 'body', processingVersion: 'rules' };
const olderProgress: ReadingSessionCommittedProgress = {
  bookId: 'book', chapterIndex: 3, chapterOffset: 44, chapterProgress: 0.7, updatedAt: 2,
  bodyVersion: 'body-older', processingVersion: 'rules',
};

function fixture() {
  const events: string[] = [];
  const frames: (() => void)[] = [];
  const timers = new Map<number, { delay: number; run: () => void }>();
  const catalogReads: PromiseWithResolvers<LocalReadingToc>[] = [];
  const windowRead = Promise.withResolvers<ReadingSessionChapter>();
  const window = new ReadingChapterWindow();
  window.configure('source', 'book', [4, 5]);
  window.setCurrent(chapter);
  assert.equal(window.admitNeighbour(neighbour), true);
  const retainedNeighbour = window.get(5)?.textLayoutIdentity;
  assert.ok(retainedNeighbour);
  let current = chapter;
  let active = 1;
  let timerId = 0;
  const coordinator = new ReadingEntryHydrationCoordinator({
    chapterWindow: window, isSessionActive: (lifecycle) => lifecycle === active,
    catalog: {
      pending: () => true,
      startRequest: () => {
        const operation = Promise.withResolvers<LocalReadingToc>();
        catalogReads.push(operation);
        return { isCurrent: () => true, load: () => operation.promise };
      },
      currentChapter: () => current,
      resumeOnlyChapterIndex: () => undefined,
      installCatalog: (entries, resident) => {
        events.push('catalog-admit');
        window.configure('source', 'book', entries.map(entry => entry.index));
        window.setCurrent(resident);
      },
      afterAdmitted: () => {
        assert.equal(window.get(5)?.contentVersion, neighbour.contentVersion);
        assert.equal(window.get(5)?.textLayoutIdentity, retainedNeighbour);
        events.push('catalog-published');
      },
      fail: (retained) => { if (retained()) events.push('catalog-failed'); },
      finish: () => { events.push('catalog-finish'); },
      resumePaging: () => { events.push('paging'); },
      reportDeferredFailure: (error) => { events.push(`catalog-warning:${error.message}`); },
    },
    captureWindowSelection: partial => () => current === partial,
    captureWindowRequest: (partial, lane) => ({
      isCurrent: () => current === partial,
      complete: (stillCurrent) => {
        assert.equal(stillCurrent(), true);
        events.push(`window-read:${lane}`);
        return windowRead.promise;
      },
      boundaryMode: () => 'lineSeparated',
      admit: (expanded, ranges, map) => {
        assert.equal(map.utf16ForScalar(4) - map.utf16ForScalar(3), 2);
        assert.deepEqual(ranges.map(range => [range.startScalar, range.endScalar]), [[0, 2], [3, 4], [5, 6]]);
        assert.equal(expanded.documentRange, undefined);
        current = expanded;
        events.push('window-admit');
      },
    }),
    postFrame: (run) => { frames.push(run); },
    reportWindowFailure: (error) => assert.fail(error.message),
  }, {
    now: () => 100,
    mark: (id, phase, status) => { events.push(`mark:${id}:${phase}:${status}`); },
    phase: (_phase, _lifecycle, elapsed) => { assert.equal(elapsed, 0); },
    firstBuild: (outcome, elapsed) => { assert.equal(elapsed, 0); events.push(`build:${outcome}`); },
  }, {
    set: (delay, run) => { timers.set(++timerId, { delay, run }); return timerId; },
    clear: (handle) => { timers.delete(handle); },
    visibleBody: () => false,
    ready: () => false,
    activeSelection: (lifecycle, selection) => lifecycle === active && selection === 7,
    completing: () => true,
    restartMeasurement: () => { events.push('restart-measurement'); },
    fail: (error, lifecycle) => { events.push(`fail:${lifecycle}:${error.message}`); },
  });
  const begin = (lifecycle: number, traceId: number) => {
    active = lifecycle;
    coordinator.beginMount(lifecycle, traceId);
  };
  begin(1, 41);
  const read: ReadingFirstFrameRead = {
    sourceId: 'source', bookId: 'book', requestedChapter: undefined, bookmark: undefined,
    pendingProgress: { kind: 'restored', progress: olderProgress }, navigationMode: 'paged',
    isCurrent: () => true, windowIsCurrent: () => true,
    read: () => snapshot, install: () => true,
    publish: () => undefined, measure: () => 'ready', fail: (error) => assert.fail(error.message),
  };
  return { coordinator, begin, events, frames, timers, read, catalogReads, windowRead };
}

test('synchronous persisted restore chooses bookmark evidence and traces actual first-frame milestones', () => {
  const { coordinator, read, events } = fixture();
  const result = coordinator.restoreFirstFrame(1, bounds, () => ({
    ...read, bookmark: { chapterIndex: 4, chapterOffset: 3, requestId: 51, positionScope: scope },
    read: (index, isCurrent, context) => {
      assert.equal(isCurrent(), true);
      assert.equal(index, 4);
      assert.deepEqual(context, { bodyVersion: 'body', processingVersion: 'rules', anchors: [{ id: 'requested', offset: 3 }] });
      events.push('read');
      return snapshot;
    },
    install: (restored) => { assert.equal(restored, snapshot); events.push('install'); return true; },
    publish: (entry) => {
      assert.equal(entry.progress, undefined);
      assert.equal(entry.bookmarkRequestId, 51);
      assert.equal(entry.requestedScalar, 3);
      assert.equal(entry.map.residentStart(), 3);
      assert.equal(entry.map.utf16ForScalar(4), 2);
      events.push('publish');
    },
    measure: () => { events.push('measure'); return 'ready'; },
  }));
  assert.equal(result, 'ready');
  coordinator.finishTrace(1);
  coordinator.trace(1, 'late-observer');
  assert.deepEqual(events, [
    'mark:41:persisted-entry-read:event', 'read', 'install', 'publish', 'mark:41:persisted-entry-decoded:event',
    'measure', 'mark:41:first-build:ready', 'build:ready',
  ]);
});

test('an unscoped positive bookmark, a stale window, and old mount callbacks fail closed before publication', () => {
  const { coordinator, begin, read, events } = fixture();
  assert.equal(coordinator.restoreFirstFrame(1, bounds, () => ({
    ...read, bookmark: { chapterIndex: 4, chapterOffset: 3, requestId: 51 },
    read: () => assert.fail('positive entry offset requires a versioned scope'),
  })), 'unavailable');
  assert.equal(coordinator.restoreFirstFrame(1, bounds, () => ({
    ...read, requestedChapter: 4,
    read: (index, _isCurrent, context) => {
      assert.equal(index, 4);
      assert.equal(context, undefined);
      return snapshot;
    },
    windowIsCurrent: () => false,
    install: () => assert.fail('expired viewport cannot install'),
  })), 'unavailable');
  begin(2, 42);
  assert.equal(coordinator.restoreFirstFrame(1, bounds, () => assert.fail('retired entry cannot capture')), 'unavailable');
  coordinator.trace(1, 'late-observer');
  assert.deepEqual(events, ['mark:41:persisted-entry-read:event']);
});

test('catalog frames clear the queued flag before guarding the mount, while stale receipts stay out of paging', async () => {
  const { coordinator, begin, events, frames, catalogReads } = fixture();
  coordinator.scheduleCatalog();
  coordinator.scheduleCatalog();
  assert.equal(frames.length, 1);
  begin(2, 42);
  coordinator.scheduleCatalog();
  frames.shift()!();
  assert.equal(catalogReads.length, 0);
  coordinator.scheduleCatalog();
  assert.equal(frames.length, 2, 'the retired callback cleared the shared queue flag first');
  frames.shift()!();
  frames.shift()!();
  assert.equal(catalogReads.length, 1, 'live callbacks join the one catalog request');
  begin(3, 43);
  const nextCatalog = coordinator.hydrateCatalog();
  assert.equal(catalogReads.length, 2);
  catalogReads[0].resolve({ bookId: 'book', entries: rows([4, 5, 6]) });
  await setImmediate();
  assert.equal(coordinator.catalogInFlight(), true);
  assert.deepEqual(events, []);
  catalogReads[1].resolve({ bookId: 'book', entries: rows([4, 5, 6]) });
  await nextCatalog;
  assert.deepEqual(events, ['catalog-admit', 'catalog-published', 'catalog-finish', 'paging']);
});

test('a retired deferred catalog rejection still warns without publishing failure or releasing a new request', async () => {
  const { coordinator, begin, events, frames, catalogReads } = fixture();
  coordinator.scheduleCatalog();
  frames.shift()!();
  assert.equal(catalogReads.length, 1);
  begin(2, 42);
  const current = coordinator.hydrateCatalog();
  catalogReads[0].reject(new Error('old catalog read failed'));
  await setImmediate();
  assert.deepEqual(events, ['catalog-warning:old catalog read failed']);
  assert.equal(coordinator.catalogInFlight(), true);
  catalogReads[1].resolve({ bookId: 'book', entries: rows([4, 5, 6]) });
  await current;
  assert.deepEqual(events, ['catalog-warning:old catalog read failed', 'catalog-admit', 'catalog-published', 'catalog-finish', 'paging']);
});

test('a full paragraph window cannot replace the resident input until the real first-page writer settles', async () => {
  const { coordinator, events, frames, windowRead } = fixture();
  const write = Promise.withResolvers<ReadingSessionCommittedProgress>();
  const anchor = new CoreReadingAnchor(4, 3, 0.5, 'body', 'rules');
  const intent: ReaderProgressProducerIntent = {
    sourceId: 'source', bookId: 'book', title: 'Chapter 4', anchor,
    layout: createCoreReadingLayout(390, 720, 1.5, 36),
    gateway: {
      runProgressCommitSerial: () => assert.fail('first-page producer uses the gateway write owner'),
      persistPresentedProgress: () => { events.push('persist-dispatch'); return write.promise; },
      loadProgress: () => assert.fail('admission reads an exact receipt from the active writer'),
    },
    isOwner: () => true, isCurrent: () => true, committed: () => undefined,
    publish: (stored) => { assert.equal(stored.chapterOffset, 3); events.push('persist-admit'); },
  };
  const persistence = coordinator.persistFirstPage(1, new ReaderProgressProducerHost(), () => intent, false, {
    traceIfReaderCurrent: () => true, isPresentationCurrent: () => true, layoutIsCurrent: () => true,
    requestRemeasurement: () => assert.fail('layout remains current'),
    ready: () => { events.push('first-ready'); }, failed: error => assert.fail(error.message),
  });
  coordinator.scheduleWindow(chapter, 'continuous', false);
  assert.equal(frames.length, 0);
  coordinator.scheduleWindow(chapter, 'continuous', true);
  const expansion = coordinator.expandWindow(chapter);
  frames.shift()!();
  windowRead.resolve({ ...chapter, content: 'ab\n𐐷\nZ', documentRange: undefined });
  await setImmediate();
  assert.deepEqual(events, ['persist-dispatch', 'window-read:foreground']);
  write.resolve({ ...anchor, bookId: 'book', updatedAt: 10 });
  await Promise.all([persistence, expansion]);
  assert.deepEqual(events, ['persist-dispatch', 'window-read:foreground', 'persist-admit', 'first-ready', 'window-admit']);
});

test('the mount retires watchdog frames and completion retries remain bounded', () => {
  const { coordinator, begin, events, timers } = fixture();
  coordinator.ensureReadyDeadline(1, 7);
  coordinator.ensureReadyDeadline(1, 7);
  assert.equal(timers.size, 1);
  const staleReady = timers.get(1)!;
  assert.equal(staleReady.delay, 30_000);
  begin(2, 42);
  coordinator.ensureReadyDeadline(2, 7);
  staleReady.run();
  assert.deepEqual(events, []);
  timers.get(2)!.run();
  timers.delete(2);
  assert.deepEqual(events, ['fail:2:PAGINATION_FIRST_PAGE_READY_TIMEOUT']);
  events.length = 0;
  coordinator.armCompletionDeadline();
  for (let id = 3; id <= 6; id += 1) {
    const timer = timers.get(id)!;
    assert.equal(timer.delay, 10_000);
    timers.delete(id);
    timer.run();
  }
  assert.deepEqual(events, [
    'restart-measurement', 'restart-measurement', 'restart-measurement', 'fail:2:READING_FIRST_PAGE_COMPLETION_TIMEOUT',
  ]);
});
