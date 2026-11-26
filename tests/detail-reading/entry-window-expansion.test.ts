import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { ReadingEntryWindowExpansion,
  type ReadingEntryWindowLane } from '../../entry/src/main/ets/features/reading/application/ReadingEntryWindowExpansion.ts';
import type { ReadingSessionChapter } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import { readingChapterLayoutMap } from '../../entry/src/main/ets/features/reading/application/ReadingSurfaceLayoutMap.ts';

function chapter(index: number): ReadingSessionChapter {
  return { sourceId: 'local', bookId: 'book', chapterIndex: index, chapterTitle: 'Title', chapterUrl: undefined,
    content: '𐐷', documentRange: { startScalar: 0, endScalar: 1, totalScalars: 3 },
    contentVersion: 'version', extractionVia: 'local', images: [] };
}

function full(partial: ReadingSessionChapter): ReadingSessionChapter {
  return { ...partial, content: '𐐷\nZ', documentRange: undefined };
}

function fixture() {
  let current = chapter(1);
  const frames: (() => void)[] = [];
  const requests: { chapter: ReadingSessionChapter; lane: ReadingEntryWindowLane; completion: PromiseWithResolvers<ReadingSessionChapter> }[] = [];
  const admitted: number[] = [];
  const errors: Error[] = [];
  const persistence = Promise.withResolvers<void>();
  const owner = new ReadingEntryWindowExpansion({
    postFrame: run => frames.push(run),
    captureSelection: partial => () => current === partial,
    captureRequest: (partial, lane) => ({
      isCurrent: () => current === partial,
      complete: isCurrent => {
        assert.equal(isCurrent(), true);
        const completion = Promise.withResolvers<ReadingSessionChapter>();
        requests.push({ chapter: partial, lane, completion });
        return completion.promise;
      },
      firstPagePersistence: () => persistence.promise,
      boundaryMode: () => 'lineSeparated',
      admit: (expanded, ranges, map) => {
        assert.equal(map, readingChapterLayoutMap(expanded));
        assert.deepEqual(ranges.map(range => [range.startScalar, range.endScalar]), [[0, 1], [2, 3]]);
        admitted.push(expanded.chapterIndex);
        current = expanded;
      },
    }),
    reportBackgroundFailure: error => errors.push(error),
  });
  return { owner, frames, requests, admitted, errors, persistence,
    get chapter() { return current; }, set chapter(value) { current = value; } };
}

test('window expansion coalesces frame and playback requests and joins the first-page persistence barrier', async () => {
  const fixtureState = fixture();
  const { owner, frames, requests, admitted, persistence } = fixtureState;
  const partial = fixtureState.chapter;
  owner.schedule(partial);
  owner.schedule(partial);
  assert.equal(frames.length, 1);
  assert.equal(requests.length, 0);
  const foreground = owner.expand(partial, 'foreground');
  frames.shift()!();
  assert.deepEqual(requests.map(request => request.lane), ['foreground']);
  requests[0].completion.resolve(full(partial));
  await setImmediate();
  assert.deepEqual(admitted, []);
  persistence.resolve();
  await foreground;
  assert.deepEqual(admitted, [1]);
  owner.schedule(fixtureState.chapter);
  assert.equal(frames.length, 0);
});

test('stale frames and old settlements leave newer window admissions intact', async () => {
  const fixtureState = fixture();
  const { owner, frames, requests, admitted, persistence } = fixtureState;
  owner.schedule(fixtureState.chapter);
  fixtureState.chapter = chapter(2);
  owner.schedule(fixtureState.chapter);
  frames.shift()!();
  assert.equal(requests.length, 0);
  frames.shift()!();
  const old = owner.expand(fixtureState.chapter, 'foreground');
  assert.deepEqual(requests.map(request => request.lane), ['background']);
  const nextChapter = chapter(3);
  fixtureState.chapter = nextChapter;
  owner.reset();
  const next = owner.expand(nextChapter, 'foreground');
  persistence.resolve();
  requests[0].completion.resolve(full(requests[0].chapter));
  await old;
  assert.deepEqual(admitted, []);
  const joined = owner.expand(nextChapter, 'background');
  assert.equal(requests.length, 2);
  requests[1].completion.resolve(full(nextChapter));
  await Promise.all([next, joined]);
  assert.deepEqual(admitted, [3]);
});

test('background failure reaches its owner and releases a later retry', async () => {
  const fixtureState = fixture();
  const { owner, frames, requests, errors, persistence } = fixtureState;
  const partial = fixtureState.chapter;
  const failed = new Error('expansion failed');
  owner.schedule(partial);
  frames.shift()!();
  requests[0].completion.reject(failed);
  await setImmediate();
  assert.deepEqual(errors, [failed]);
  const retry = owner.expand(partial, 'foreground');
  assert.equal(requests.length, 2);
  requests[1].completion.resolve(full(partial));
  persistence.resolve();
  await retry;
  assert.deepEqual(fixtureState.admitted, [1]);
});
