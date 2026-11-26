import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import {
  loadInitialReading, restartPreparedReadingEntry, type InitialReadingOpenRequest,
  type ReadingInitialChapterHost,
} from '../../entry/src/main/ets/features/reading/application/ReadingInitialChapter.ts';
import type { LocalReadingProgressState, LocalReadingToc } from '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';
import type { ReadingEntrySnapshot } from '../../entry/src/main/ets/features/reading/application/ReadingEntrySnapshot.ts';
import type { ReadingInitialEntryGateway } from '../../entry/src/main/ets/features/reading/application/ReadingSessionFlowGateway.ts';
import { RemoteReadingGatewayError } from '../../entry/src/main/ets/features/reading/application/RemoteReadingContract.ts';
import { ReaderBookmarkAnchorRequest } from '../../entry/src/main/ets/features/reading/presentation/ReaderBookmarkAnchorRequest.ts';

const missing: LocalReadingProgressState = { kind: 'missing' };
const toc: LocalReadingToc = { bookId: 'book', entries: [{ index: 5, title: 'Chapter', downloadState: 'cached' }] };

function restored(chapterIndex: number, chapterOffset: number, presentationPending = false): LocalReadingProgressState {
  return { kind: 'restored', presentationPending,
    progress: { bookId: 'book', chapterIndex, chapterOffset, chapterProgress: 0.2, updatedAt: 1,
      bodyVersion: 'body', processingVersion: 'processing' },
  };
}

function snapshot(progress: LocalReadingProgressState = restored(5, 2)): ReadingEntrySnapshot {
  return {
    chapter: { sourceId: 'local', bookId: 'book', chapterIndex: 5, chapterTitle: 'Chapter',
      chapterUrl: undefined, content: 'BCD', images: [], extractionVia: 'local', contentVersion: 'hash',
      bodyVersion: 'body', processingVersion: 'processing',
      documentRange: { startScalar: 1, endScalar: 4, totalScalars: 6 } },
    progress, requestedScalar: 2, resumeOnly: true, isCurrent: () => true,
  };
}

function gateway(overrides: Partial<ReadingInitialEntryGateway> = {}): ReadingInitialEntryGateway {
  return { loadProgress: async () => missing, hasPendingSourceSwitch: () => false, ...overrides };
}

function host(ports: Partial<ReadingInitialChapterHost> = {}): ReadingInitialChapterHost {
  const session = gateway();
  return {
    selectionToken: () => 4, isSelectionActive: (lifecycle, selection) => lifecycle === 12 && selection === 4,
    ensureSession: async () => {}, hasFailed: () => false, startTrace: () => {}, trace: () => {},
    loadAppearance: async () => {}, loadSettings: async () => {},
    activeGateway: () => session, bookId: () => 'book', isLocal: () => true, sourceSwitchRequested: () => false,
    hasPendingSourceSwitch: () => false, remoteSession: () => undefined, paragraphBoundaryMode: () => 'lineSeparated',
    preparedEntry: () => undefined, discardPreparedEntry: () => {}, retirePreparedSession: () => {},
    waitForContentIdle: async () => {}, clearChapterWindow: () => {},
    loadToc: async () => toc, admitFullToc: () => {}, admitSnapshotToc: () => true,
    configureChapterWindow: () => {}, readableToc: () => toc.entries,
    selection: () => ({ chapterIndex: undefined, bookmark: undefined }), positionContext: () => undefined,
    requireKnownChapter: index => index ?? 5, restoreProgress: () => {}, openInitialChapter: async () => {},
    fail: error => assert.fail(error.message), ...ports,
  };
}

test('layout and TOC reads overlap while the presented intent outranks a durable read', async () => {
  const appearance = Promise.withResolvers<void>();
  const pending = restored(7, 11, true);
  const events: string[] = [];
  const session = gateway({
    loadProgress: async () => { events.push('progress'); return restored(5, 1); },
    pendingPresentedProgress: () => pending,
  });
  const operation = loadInitialReading(12, host({
    loadAppearance: () => { events.push('appearance'); return appearance.promise; },
    loadSettings: async () => { events.push('settings'); },
    ensureSession: async () => { events.push('session'); },
    activeGateway: () => session,
    loadToc: async () => { events.push('toc'); return toc; },
    discardPreparedEntry: () => { events.push('discard'); },
    admitFullToc: entries => { assert.equal(entries, toc.entries); events.push('admit toc'); },
    configureChapterWindow: () => { events.push('configure'); },
    restoreProgress: (progress, bookmark) => { assert.equal(progress, pending); assert.equal(bookmark, undefined); events.push('restore'); },
    openInitialChapter: async (request) => {
      assert.equal(request.chapterIndex, 7);
      assert.equal(request.selectionToken, 4);
      events.push('open');
      await request.layoutReady;
      events.push('layout awaited');
    },
  }));
  await setImmediate();
  assert.deepEqual(events, ['appearance', 'settings', 'session', 'toc', 'progress', 'discard', 'admit toc', 'configure', 'restore', 'open']);
  appearance.resolve();
  await operation;
  assert.equal(events.at(-1), 'layout awaited');
});

test('retiring the selection ignores a rejected snapshot and does not read a fallback', async () => {
  let ownsSelection = true;
  const requested = Promise.withResolvers<ReadingEntrySnapshot | undefined>();
  const dispatched = Promise.withResolvers<void>();
  const session = gateway({ loadEntrySnapshot: () => { dispatched.resolve(); return requested.promise; } });
  const operation = loadInitialReading(12, host({
    activeGateway: () => session,
    isSelectionActive: () => ownsSelection,
    loadToc: () => assert.fail('an obsolete snapshot must not start a fallback'),
    fail: () => assert.fail('an obsolete snapshot must not fail current reading'),
  }));
  await dispatched.promise;
  ownsSelection = false;
  requested.reject(new RemoteReadingGatewayError('storageFailure', 'obsolete failure'));
  await operation;
});

test('an expired prepared session retires before rebuilding and reuses the original layout barrier', async () => {
  const layoutReady = Promise.resolve([]);
  const events: string[] = [];
  await restartPreparedReadingEntry(12, 4, layoutReady, host({
    retirePreparedSession: () => { events.push('retire'); },
    ensureSession: async (lifecycle, selection, discard) => {
      assert.deepEqual([lifecycle, selection, discard], [12, 4, true]); events.push('rebuild');
    },
    loadToc: async () => { events.push('read'); return toc; },
    openInitialChapter: async (request) => { assert.equal(request.layoutReady, layoutReady); events.push('open'); },
  }));
  assert.deepEqual(events, ['retire', 'rebuild', 'read', 'open']);
});

test('the narrow read only falls back for a rebuildable derivative error', async () => {
  for (const code of ['cacheDerivedCorrupt', 'storageFailure', 'identityMismatch'] as const) {
    const error = new RemoteReadingGatewayError(code, code);
    const session = gateway({ loadEntrySnapshot: async () => { throw error; } });
    const events: string[] = [];
    await loadInitialReading(12, host({
      activeGateway: () => session,
      loadToc: async () => { events.push('toc'); return toc; },
      openInitialChapter: async () => { events.push('open'); },
      fail: failure => { assert.equal(failure, error); events.push('failure'); },
    }));
    assert.deepEqual(events, code === 'cacheDerivedCorrupt' ? ['toc', 'open'] : ['failure'], code);
  }
});

test('a pending presented position settles before an untargeted resume-only retry', async () => {
  let pending: LocalReadingProgressState | undefined = restored(5, 2, true);
  const durability = Promise.withResolvers<void>();
  const requested = Promise.withResolvers<void>();
  const known = snapshot();
  const events: string[] = [];
  const session = gateway({
    pendingPresentedProgress: () => pending,
    loadEntrySnapshot: async (target, _current, context, mode) => {
      assert.equal(mode, 'lineSeparated');
      events.push(`read:${target}`);
      if (target !== undefined) {
        assert.equal(target, 5);
        assert.deepEqual(context, { bodyVersion: 'body', processingVersion: 'processing', anchors: [{ id: 'presented', offset: 2 }] });
        return undefined;
      }
      assert.equal(context, undefined);
      return known;
    },
    awaitPresentedProgressPersistence: async () => {
      events.push('durability');
      requested.resolve();
      await durability.promise;
      pending = undefined;
      return undefined;
    },
  });
  const operation = loadInitialReading(12, host({
    activeGateway: () => session,
    loadToc: () => assert.fail('a verified window is not a full-directory fallback'),
    admitFullToc: () => assert.fail('a narrow snapshot is not a full TOC'),
    admitSnapshotToc: value => { assert.equal(value, known); events.push('admit'); return true; },
    restoreProgress: value => { assert.equal(value, known.progress); events.push('restore'); },
    openInitialChapter: async (request) => {
      assert.equal(request.chapterIndex, 5);
      assert.equal(request.offset, 2);
      assert.equal(request.positionContext, undefined);
      events.push('open');
    },
  }));
  await requested.promise;
  assert.deepEqual(events, ['read:5', 'durability']);
  durability.resolve();
  await operation;
  assert.deepEqual(events, ['read:5', 'durability', 'read:undefined', 'admit', 'restore', 'open']);
});

test('a newer pending intent suppresses a returned window and takes the full fallback', async () => {
  const read = Promise.withResolvers<ReadingEntrySnapshot | undefined>();
  const dispatched = Promise.withResolvers<void>();
  let pending: LocalReadingProgressState | undefined;
  let opened: InitialReadingOpenRequest | undefined;
  const session = gateway({
    pendingPresentedProgress: () => pending,
    loadEntrySnapshot: () => { dispatched.resolve(); return read.promise; },
  });
  const operation = loadInitialReading(12, host({
    activeGateway: () => session,
    admitSnapshotToc: () => assert.fail('the snapshot lost to a newer intent'),
    openInitialChapter: async (request) => { opened = request; },
  }));
  await dispatched.promise;
  pending = restored(8, 1, true);
  read.resolve(snapshot());
  await operation;
  assert.equal(opened?.chapterIndex, 8);
});

test('a content epoch can retry twice, while each retry clears only its speculative window', async () => {
  const failure = new Error('entry content epoch changed');
  const session = gateway({ captureEntryContentValidity: () => () => false });
  const events: string[] = [];
  await loadInitialReading(12, host({
    activeGateway: () => session,
    loadToc: async () => { events.push('read'); throw failure; },
    waitForContentIdle: async () => { events.push('idle'); },
    discardPreparedEntry: () => { events.push('discard'); },
    clearChapterWindow: () => { events.push('clear'); },
    fail: error => { assert.equal(error, failure); events.push('failure'); },
  }));
  assert.deepEqual(events, ['read', 'idle', 'discard', 'clear', 'read', 'idle', 'discard', 'clear', 'read', 'failure']);
});

test('an unscoped remote bookmark fails before reading a targeted snapshot', async () => {
  const requested = new ReaderBookmarkAnchorRequest(1, 5, 2);
  const session = gateway({ loadEntrySnapshot: () => assert.fail('unverified coordinates must never reach the gateway') });
  let actual = '';
  await loadInitialReading(12, host({
    activeGateway: () => session,
    isLocal: () => false,
    selection: () => ({ chapterIndex: undefined, bookmark: requested }),
    fail: error => { actual = error.message; },
  }));
  assert.equal(actual, 'READING_POSITION_SCOPE_UNAVAILABLE');
});
