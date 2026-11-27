import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderChapterPresentationGate, type ReaderChapterPresentationLease }
  from '../../entry/src/main/ets/features/reading/presentation/ReaderChapterPresentationGate.ts';
import { ReadingChapterWindow, type ReadingSessionChapter }
  from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import { loadNextReaderTtsChapter }
  from '../../entry/src/main/ets/features/reading/application/ReaderTtsTransportOwner.ts';
import { findReusableReadingWindowChapter }
  from '../../entry/src/main/ets/features/reading/application/ReadingChapterOpening.ts';

function chapter(chapterIndex: number): ReadingSessionChapter {
  return { sourceId: 'source', bookId: 'book', chapterIndex, chapterTitle: `Chapter ${chapterIndex}`,
    content: `page of ${chapterIndex}`, contentVersion: `v${chapterIndex}`, images: [], chapterUrl: undefined };
}

test('speech advances through the cached next chapter without showing loading or dropping its previous frame', async () => {
  const window = new ReadingChapterWindow();
  window.configure('source', 'book', [0, 1]);
  const previous = chapter(0);
  const next = chapter(1);
  window.setCurrent(previous);
  window.admitNeighbour(next);
  const gate = new ReaderChapterPresentationGate<ReadingSessionChapter>();
  let visibleFrame = previous;
  let selection: ReaderChapterPresentationLease | undefined;
  const nextSpeech = await loadNextReaderTtsChapter(window, {
    capture: () => ({ current: () => true, select: (index: number) => {
      const source = findReusableReadingWindowChapter(window, index) === undefined ? 'coldRemote' : 'cache';
      selection = gate.begin(4, 21, source, visibleFrame, 500);
    } }),
    hydrateCatalogIfNeeded: () => undefined,
    nextChapterIndex: () => window.adjacentChapterIndex(0, 1),
    load: async () => { assert.fail('a cached next chapter cannot fetch again'); },
    admit: loaded => assert.equal(loaded.contentVersion, next.contentVersion),
    chapterRef: loaded => loaded,
  });
  assert.equal(gate.current(4, 21), undefined);
  nextSpeech?.onAdmitted?.();
  assert.ok(selection);
  for (const now of [500, 550, 680, 1500]) {
    assert.equal(gate.shouldShowLoading(selection, now), false);
    assert.equal(gate.visibleOrigin(selection), previous);
    assert.equal(visibleFrame, previous);
  }
  assert.equal(gate.complete(selection, () => { visibleFrame = next; }), true);
  assert.equal(visibleFrame, next);
  assert.equal(gate.visibleOrigin(selection), undefined);
});

test('local body and remote body available before the network threshold keep the origin until complete', () => {
  const gate = new ReaderChapterPresentationGate<string>();
  const local = gate.begin(7, 17, 'local', 'last visible frame', 1000);
  assert.equal(gate.shouldShowLoading(local, 3000), false);
  assert.equal(gate.visibleOrigin(local), 'last visible frame');
  const remote = gate.begin(7, 18, 'coldRemote', undefined, 3100);
  assert.equal(gate.visibleOrigin(remote), 'last visible frame');
  assert.equal(gate.markBodyReady(remote, 3279), true);
  assert.equal(gate.shouldShowLoading(remote, 5000), false);
  assert.equal(gate.visibleOrigin(remote), 'last visible frame');
});

test('the cold-network loader cannot appear before 180ms and retires on first-frame commit', () => {
  const gate = new ReaderChapterPresentationGate<string>();
  const pending = gate.begin(4, 1, 'coldRemote', 'source-frame', 500);
  assert.equal(gate.shouldShowLoading(pending, 679), false);
  assert.equal(gate.shouldShowLoading(pending, 680), true);
  assert.equal(gate.visibleOrigin(pending), 'source-frame');
  assert.equal(gate.markBodyReady(pending, 770), true);
  assert.equal(gate.shouldShowLoading(pending, 890), true);
  assert.equal(gate.complete(pending), true);
  assert.equal(gate.shouldShowLoading(pending, 890), false);
});

test('same-token replacement, explicit cancellation and lifecycle exit fence delayed work', () => {
  const gate = new ReaderChapterPresentationGate<string>();
  const stale = gate.begin(4, 1, 'coldRemote', 'book-one', 0);
  const replacement = gate.begin(4, 1, 'cache', undefined, 100);
  assert.equal(gate.current(4, 1), replacement);
  assert.equal(gate.owns(stale), false);
  assert.equal(gate.markBodyReady(stale, 150), false);
  assert.equal(gate.cancel(stale), false);
  assert.equal(gate.complete(stale, () => assert.fail('obsolete selection committed')), false);
  assert.equal(gate.shouldShowLoading(stale, 180), false);
  assert.equal(gate.visibleOrigin(replacement), 'book-one');
  assert.equal(gate.cancel(replacement), true);
  assert.equal(gate.complete(replacement, () => assert.fail('cancelled selection committed')), false);
  const next = gate.begin(5, 1, 'coldRemote', undefined, 190);
  assert.equal(gate.visibleOrigin(next), undefined);
  gate.clear();
  assert.equal(gate.current(5, 1), undefined);
  assert.equal(gate.shouldShowLoading(next, 1000), false);
});

test('a failed or reentrant presentation cannot discard the recovery origin or a successor lease', () => {
  const gate = new ReaderChapterPresentationGate<string>();
  const first = gate.begin(4, 1, 'cache', 'source-frame', 0);
  assert.throws(() => gate.complete(first, () => { throw new Error('presentation failed'); }), /presentation failed/);
  assert.equal(gate.visibleOrigin(first), 'source-frame');
  assert.equal(gate.complete(first, () => { gate.begin(4, 2, 'cache', 'new-frame', 100); }), true);
  const successor = gate.current(4, 2);
  assert.ok(successor);
  assert.equal(gate.visibleOrigin(successor), 'new-frame');
});
