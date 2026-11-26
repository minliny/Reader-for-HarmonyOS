import assert from 'node:assert/strict';
import { setImmediate, setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { ReadingInteractiveChapterPreparation,
  type ReadingNearEndCatalogRequest, type ReadingNeighbourPublication } from '../../entry/src/main/ets/features/reading/application/ReadingInteractiveChapterPreparation.ts';
import { ReadingChapterWindow, type ReadingSessionChapter } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import { ReadingPaginationPrefix, type ReadingPaginationKey } from '../../entry/src/main/ets/features/reading/application/ReadingPaginationIndex.ts';
import { ReaderPhysicalPaginationOwner, type ReaderAdjacentPageEvidence } from '../../entry/src/main/ets/features/reading/ui/ReaderPhysicalPaginationOwner.ts';

function chapter(chapterIndex: number): ReadingSessionChapter {
  return { sourceId: 'source', bookId: 'book', chapterIndex, chapterTitle: 'chapter', chapterUrl: 'url',
    content: 'body', contentVersion: 'v', extractionVia: 'local', images: [] };
}

function publication(events: string[]): ReadingNeighbourPublication {
  return {
    matchesIdentity: loaded => loaded.sourceId === 'source' && loaded.bookId === 'book',
    admitVersion: index => { events.push('version:' + index); },
    retain: () => { events.push('retain'); },
    prepareAdjacent: forward => { events.push(forward ? 'next' : 'previous'); },
  };
}

function chapterWindow(indexes = [10, 20, 30, 40, 50, 60, 70], current = 40): ReadingChapterWindow {
  const window = new ReadingChapterWindow();
  window.configure('source', 'book', indexes);
  window.setCurrent(chapter(current));
  return window;
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: Error) => void } {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function waitFor(observed: () => boolean): Promise<void> {
  const deadline = performance.now() + 3000;
  while (!observed() && performance.now() < deadline) await setTimeout(5);
  assert.equal(observed(), true);
}

test('neighbour prefetch yields, loads nearest first and publishes admitted facing neighbours in original order', async () => {
  const window = chapterWindow();
  const owner = new ReadingInteractiveChapterPreparation();
  const events: string[] = [];
  const load = async (index: number): Promise<ReadingSessionChapter> => {
    events.push('load:' + index);
    if (index === 30) throw new Error('optional');
    return chapter(index);
  };
  const request = { key: 'visible:40:0', isCurrent: () => true, load, publication: publication(events) };
  owner.prefetch(window, chapter(40), true, request, () => { events.push('spread'); });
  owner.prefetch(window, chapter(40), true, request, () => assert.fail('duplicate prefetch'));
  assert.deepEqual(events, []);
  await waitFor(() => window.get(10) !== undefined);
  assert.deepEqual(events, [
    'load:50', 'retain', 'version:50', 'spread', 'next', 'load:30',
    'load:60', 'retain', 'version:60', 'spread', 'load:20', 'retain', 'version:20',
    'load:70', 'retain', 'version:70', 'load:10', 'retain', 'version:10',
  ]);
});

test('an obsolete optional chapter reply neither mutates the current window nor starts another request', async () => {
  const window = chapterWindow();
  const owner = new ReadingInteractiveChapterPreparation();
  const body = deferred<ReadingSessionChapter>();
  const events: string[] = [];
  let current = true;
  owner.prefetch(window, chapter(40), true, {
    key: 'prior-page', isCurrent: () => current, publication: publication(events),
    load: (index, isCurrent) => {
      assert.equal(isCurrent(), true);
      events.push('load:' + index);
      return body.promise;
    },
  }, () => assert.fail('stale spread refresh'));
  await waitFor(() => events.length === 1);
  current = false;
  body.resolve(chapter(50));
  await setImmediate();
  assert.deepEqual(events, ['load:50']);
  assert.deepEqual(window.retainedChapterIndexes(), [40]);
});

test('facing a partial chapter prepares only the forward body and retains the window on admission refusal', async () => {
  const window = chapterWindow();
  const owner = new ReadingInteractiveChapterPreparation();
  const events: string[] = [];
  owner.prefetch(window, { ...chapter(40), documentRange: { startScalar: 0, endScalar: 4, totalScalars: 7 } }, true, {
    key: 'partial-page', isCurrent: () => true, publication: publication(events),
    load: async index => {
      events.push('load:' + index);
      return { ...chapter(index), sourceCorrectionRequired: true };
    },
  }, () => assert.fail('unadmitted facing body'));
  await waitFor(() => events.length >= 2);
  assert.deepEqual(events, ['load:50', 'retain']);
  assert.deepEqual(window.retainedChapterIndexes(), [40]);
});

test('explicit turns deduplicate, reject wrong identity and allow only a later request to retry', async () => {
  const window = chapterWindow();
  const owner = new ReadingInteractiveChapterPreparation();
  const events: string[] = [];
  const wrong = deferred<ReadingSessionChapter>();
  const request = { key: 'turn:2:previous:30', isCurrent: () => true, publication: publication(events),
    load: (index: number) => { events.push('load:' + index); return wrong.promise; } };
  const failed = (isCurrent: () => boolean): void => { assert.equal(isCurrent(), true); events.push('failure'); };
  owner.requestTurn(window, 30, false, request, failed);
  owner.requestTurn(window, 30, false, request, failed);
  assert.deepEqual(events, ['load:30']);
  wrong.resolve({ ...chapter(30), bookId: 'wrong' });
  await setImmediate();
  assert.deepEqual(events, ['load:30', 'failure']);
  assert.equal(window.get(30), undefined);
  owner.requestTurn(window, 30, false, { ...request, load: async index => chapter(index) }, failed);
  await setImmediate();
  assert.deepEqual(events, ['load:30', 'failure', 'version:30', 'retain', 'previous']);
  assert.equal(window.get(30)?.bookId, 'book');
});

test('explicit turn failures and late replies lose all publication when their lease expires', async () => {
  const window = chapterWindow();
  const owner = new ReadingInteractiveChapterPreparation();
  const events: string[] = [];
  const failure = deferred<ReadingSessionChapter>();
  const reply = deferred<ReadingSessionChapter>();
  let current = true;
  const request = { key: 'request', isCurrent: () => current, publication: publication(events), load: () => failure.promise };
  const report = (): void => { events.push('failure'); };
  owner.requestTurn(window, 30, false, request, report);
  owner.requestTurn(window, 50, true, { ...request, key: 'another', load: () => reply.promise }, report);
  current = false;
  failure.reject(new Error('late'));
  reply.resolve(chapter(50));
  await setImmediate();
  assert.deepEqual(events, []);
  assert.deepEqual(window.retainedChapterIndexes(), [40]);
});

test('near-end session work checks distance, preserves the in-flight and 30-second fences, and reports only while current', async t => {
  const owner = new ReadingInteractiveChapterPreparation();
  const events: string[] = [];
  let now = 1000;
  let current = true;
  let remaining = 4;
  let pending = deferred<never>();
  t.mock.method(Date, 'now', () => now);
  const distance = (): number => { events.push('distance'); return remaining; };
  const request = (): ReadingNearEndCatalogRequest => ({
    key: 'source:book:lifecycle', isCurrent: () => current,
    load: () => { events.push('load'); return pending.promise; },
    reportFailure: error => { events.push(error.message); },
  });
  owner.prepareNearEndCatalog(distance, request);
  remaining = 3;
  owner.prepareNearEndCatalog(distance, request);
  owner.prepareNearEndCatalog(() => assert.fail('in-flight work must not read distance'), request);
  assert.deepEqual(events, ['distance', 'distance', 'load']);
  current = false;
  pending.reject(new Error('stale'));
  await setImmediate();
  current = true;
  now += 29_999;
  owner.prepareNearEndCatalog(distance, request);
  assert.deepEqual(events, ['distance', 'distance', 'load', 'distance']);
  now += 1;
  pending = deferred<never>();
  owner.prepareNearEndCatalog(distance, request);
  pending.reject(new Error('current'));
  await setImmediate();
  assert.deepEqual(events, ['distance', 'distance', 'load', 'distance', 'distance', 'load', 'current']);
});

function key(chapterIndex: number): ReadingPaginationKey {
  return { sourceId: 'source', bookId: 'book', chapterIndex, layoutSignature: 'layout', contentVersion: 'v' };
}

function adjacentEvidence(window: ReadingChapterWindow, chapterIndex: number,
  startScalar: number, endScalar: number, lastVisibleScalar: number): ReaderAdjacentPageEvidence {
  return { window, chapterIndex, startScalar, endScalar, currentKey: () => key(chapterIndex), chapterKey: key,
    lastVisibleScalar: () => lastVisibleScalar };
}

test('page targets use a matching measured prefix first and require an exact physical predecessor at a chapter boundary', () => {
  const physical = new ReaderPhysicalPaginationOwner<never>();
  const window = chapterWindow([10, 20, 30], 20);
  const page = adjacentEvidence(window, 20, 2, 5, 9);
  physical.draft = new ReadingPaginationPrefix(key(20), { requestScalar: 0, startScalar: 2, endScalarExclusive: 6 });
  assert.equal(physical.draft.admit({ requestScalar: 6, startScalar: 7, endScalarExclusive: 10 }), true);
  assert.equal(physical.adjacentTarget('next', { ...page, lastVisibleScalar: () => assert.fail('exact prefix owns target') })?.chapterOffset, 6);
  assert.equal(physical.adjacentTarget('previous', adjacentEvidence(window, 20, 7, 10, 9))?.chapterOffset, 0);
  physical.draft = undefined;
  physical.index.recordChapter({ key: key(10), contentScalarLength: 10, pageStartScalars: [0, 4, 8] });
  physical.index.recordChapter({ key: key(20), contentScalarLength: 10, pageStartScalars: [0, 5] });
  const previous = physical.adjacentTarget('previous', adjacentEvidence(window, 20, 0, 5, 9));
  assert.equal(previous?.chapterIndex, 10);
  assert.equal(previous?.chapterOffset, 8);
  assert.equal(physical.adjacentTarget('previous', adjacentEvidence(window, 20, 0, 6, 9)), undefined);
  assert.equal(physical.adjacentTarget('next', adjacentEvidence(window, 20, 5, 10, 9))?.chapterIndex, 30);
});

test('book-edge decisions distinguish exact admitted pages, unmeasured prefixes and the next chapter', () => {
  const physical = new ReaderPhysicalPaginationOwner<never>();
  const window = chapterWindow([10, 20], 10);
  const first = adjacentEvidence(window, 10, 0, 5, 9);
  assert.equal(physical.knownBoundary('previous', first, () => 0), 'start');
  assert.equal(physical.knownBoundary('previous', first, () => undefined), undefined);
  physical.index.recordChapter({ key: key(10), contentScalarLength: 10, pageStartScalars: [0, 5] });
  assert.equal(physical.knownBoundary('previous', first, () => assert.fail('index proves the start')), 'start');
  assert.equal(physical.knownBoundary('next', adjacentEvidence(window, 10, 5, 10, 9), () => undefined), undefined);
  assert.equal(physical.knownBoundary('next', adjacentEvidence(window, 20, 5, 10, 9), () => undefined), 'end');
});
