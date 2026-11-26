import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import {
  prepareReadingChapterOpening, readReadingWindowChapter, resolveReadingChapterOpeningAnchor,
  type ReadingChapterOpeningHost, type ReadingChapterOpeningRequest,
} from '../../entry/src/main/ets/features/reading/application/ReadingChapterOpening.ts';
import { ReadingChapterWindow, type ReadingSessionChapter } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import type { LocalReadingProgress } from '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';
import { ReadingSurfaceLayoutMap } from '../../entry/src/main/ets/features/reading/application/ReadingSurfaceLayoutMap.ts';

const previous: LocalReadingProgress = { bookId: 'book', chapterIndex: 5, chapterOffset: 1,
  chapterProgress: 0.5, updatedAt: 1, locationRevision: 'previous', bodyVersion: 'old', processingVersion: 'rules' };
const current = (): boolean => true;

function chapter(overrides: Partial<ReadingSessionChapter> = {}): ReadingSessionChapter {
  return { sourceId: 'source', bookId: 'book', chapterIndex: 5, chapterTitle: 'Opening',
    chapterUrl: undefined, content: 'A😀B\n ', images: [], extractionVia: 'rule', contentVersion: 'body-id',
    bodyVersion: 'old', processingVersion: 'rules', ...overrides };
}

function request(overrides: Partial<ReadingChapterOpeningRequest> = {}): ReadingChapterOpeningRequest {
  return { chapterIndex: 5, refreshContent: false, restored: undefined, explicitContext: undefined,
    prepared: undefined, layoutReady: undefined, ...overrides };
}

function host(overrides: Partial<ReadingChapterOpeningHost> = {}): ReadingChapterOpeningHost {
  return { loadChapter: async () => chapter(), boundaryMode: () => 'lineSeparated',
    confirmContentMetrics: async () => true, applyPosition: () => {}, admit: () => {},
    fail: async error => { assert.fail(error instanceof Error ? error.message : String(error)); },
    ...overrides,
  };
}

function readyWindow(value: ReadingSessionChapter): ReadingChapterWindow {
  const window = new ReadingChapterWindow();
  window.configure(value.sourceId, value.bookId, [value.chapterIndex]);
  window.setCurrent(value);
  return window;
}

test('a prepared chapter is read without a gateway request while layout admission stays pending', async () => {
  const prepared = chapter();
  const layout = Promise.withResolvers<void[]>();
  const events: string[] = [];
  const opening = prepareReadingChapterOpening(request({
    prepared: { chapter: prepared, isCurrent: current }, layoutReady: layout.promise,
  }), new ReadingChapterWindow(), {
    isCurrent: current, contentCurrent: current, restartPreparedEntry: () => assert.fail('prepared entry was current'),
  }, host({
    loadChapter: () => assert.fail('prepared chapter reached the gateway'),
    chapterReady: () => { events.push('chapter ready'); },
    boundaryMode: () => { events.push('paragraph mode'); return 'lineSeparated'; },
    confirmContentMetrics: async (body, map) => {
      assert.equal(body, prepared);
      assert.equal(map.scalarCount(), 5);
      events.push('metrics');
      return true;
    },
    admit: (body, facts) => {
      assert.equal(body, prepared);
      assert.equal(facts.ranges[0].endScalar, 3);
      events.push('admit');
    },
  }));
  await setImmediate();
  assert.deepEqual(events, ['chapter ready']);
  layout.resolve([]);
  await opening;
  assert.deepEqual(events, ['chapter ready', 'paragraph mode', 'metrics', 'admit']);
});

test('prepared validity is checked after layout and again after content metrics', async () => {
  for (const retireAt of ['layout', 'metrics']) {
    let valid = true;
    const layout = Promise.withResolvers<void[]>();
    const events: string[] = [];
    const operation = prepareReadingChapterOpening(request({
      prepared: { chapter: chapter(), isCurrent: () => valid }, layoutReady: layout.promise,
    }), new ReadingChapterWindow(), {
      isCurrent: current, contentCurrent: current, restartPreparedEntry: async () => { events.push('restart'); },
    }, host({
      confirmContentMetrics: async () => { events.push('metrics'); valid = false; return true; },
      admit: () => assert.fail('retired prepared body reached page admission'),
    }));
    if (retireAt === 'layout') valid = false;
    layout.resolve([]);
    await operation;
    assert.deepEqual(events, retireAt === 'layout' ? ['restart'] : ['metrics', 'restart']);
  }
});

test('selection retirement ignores a late body and content invalidation after metrics fails before admission', async () => {
  const read = Promise.withResolvers<ReadingSessionChapter>();
  let selection = true;
  const operation = prepareReadingChapterOpening(request(), new ReadingChapterWindow(), {
    isCurrent: () => selection, contentCurrent: current, restartPreparedEntry: () => assert.fail(),
  }, host({
    loadChapter: () => read.promise,
    chapterReady: () => assert.fail('late chapter received a first-page trace'),
    boundaryMode: () => assert.fail('late chapter was laid out'),
    admit: () => assert.fail('late chapter was admitted'),
  }));
  selection = false;
  read.resolve(chapter());
  await operation;

  let valid = true;
  const errors: string[] = [];
  await prepareReadingChapterOpening(request(), new ReadingChapterWindow(), {
    isCurrent: current, contentCurrent: () => valid, restartPreparedEntry: () => assert.fail(),
  }, host({
    confirmContentMetrics: async () => { valid = false; return true; },
    admit: () => assert.fail('superseded content was admitted'),
    fail: async error => { assert.ok(error instanceof Error); errors.push(error.message); },
  }));
  assert.deepEqual(errors, ['READING_CONTENT_EPOCH_CHANGED']);
});

test('committed migration publishes ordered requested and restored positions before metrics', async () => {
  const body = chapter({ bodyVersion: 'new', positionMigration: { status: 'committed',
    previousBodyVersion: 'old', previousProcessingVersion: 'rules', bodyVersion: 'new', processingVersion: 'rules',
    anchors: [{ id: 'requested', previousOffset: 2, offset: 3 }, { id: 'restored', previousOffset: 1, offset: 2 }] } });
  const explicitContext = { bodyVersion: 'old', processingVersion: 'rules',
    anchors: [{ id: 'requested', offset: 2 }, { id: 'restored', offset: 1 }] };
  const events: string[] = [];
  await prepareReadingChapterOpening(request({ restored: previous, explicitContext }), new ReadingChapterWindow(), {
    isCurrent: current, contentCurrent: current, restartPreparedEntry: () => assert.fail(),
  }, host({
    loadChapter: async context => { assert.equal(context, explicitContext); return body; },
    applyPosition: update => {
      if (update.kind === 'requested') { assert.equal(update.offset, 3); events.push('requested'); }
      else {
        assert.equal(update.progress.kind, 'restored');
        assert.equal(update.progress.progress.bodyVersion, 'new');
        assert.equal(update.progress.progress.chapterOffset, 2);
        assert.equal(update.progress.progress.locationRevision, 'previous');
        events.push('restored');
      }
    },
    confirmContentMetrics: async () => { events.push('metrics'); return true; },
    admit: () => { events.push('admit'); },
  }));
  assert.deepEqual(events, ['requested', 'restored', 'metrics', 'admit']);
});

test('an invalid later anchor reports the failure after earlier ordered migration updates', async () => {
  const events: string[] = [];
  await prepareReadingChapterOpening(request({ explicitContext: { bodyVersion: 'old', processingVersion: 'rules',
    anchors: [{ id: 'requested', offset: 1 }, { id: 'later', offset: 4 }] } }), new ReadingChapterWindow(), {
    isCurrent: current, contentCurrent: current, restartPreparedEntry: () => assert.fail(),
  }, host({
    loadChapter: async () => chapter({ bodyVersion: 'new', positionMigration: { status: 'committed',
      previousBodyVersion: 'old', previousProcessingVersion: 'rules', bodyVersion: 'new', processingVersion: 'rules',
      anchors: [{ id: 'requested', previousOffset: 1, offset: 2 }] } }),
    applyPosition: update => { assert.deepEqual(update, { kind: 'requested', offset: 2 }); events.push('requested'); },
    admit: () => assert.fail('invalid migration reached admission'),
    fail: async error => { assert.ok(error instanceof Error); events.push(error.message); },
  }));
  assert.deepEqual(events, ['requested', 'READING_POSITION_MIGRATION_ANCHOR_MISSING']);
});

test('stored versions become a restore context and reject a body with no successful migration', async () => {
  await prepareReadingChapterOpening(request({ restored: previous }), new ReadingChapterWindow(), {
    isCurrent: current, contentCurrent: current, restartPreparedEntry: () => assert.fail(),
  }, host({
    loadChapter: async context => {
      assert.deepEqual(context, { bodyVersion: 'old', processingVersion: 'rules', anchors: [{ id: 'restored', offset: 1 }] });
      return chapter({ bodyVersion: 'different' });
    },
    confirmContentMetrics: () => assert.fail('stale saved versions reached metrics'),
    admit: () => assert.fail('stale saved versions reached admission'),
    fail: async error => { assert.ok(error instanceof Error); assert.equal(error.message, 'READING_POSITION_CONTEXT_STALE'); },
  }));
});

test('body cache is shared and kept lazy, while partial, forced and foreign-version requests read through', async () => {
  const stored = chapter();
  const window = readyWindow(stored);
  const load = async (): Promise<ReadingSessionChapter> => chapter({ contentVersion: 'gateway-content' });
  assert.equal((await readReadingWindowChapter(window, 5, () => assert.fail('cache hit called the gateway'))).contentVersion,
    stored.contentVersion);
  assert.equal((await readReadingWindowChapter(window, 5, load, true)).contentVersion, 'gateway-content');
  assert.equal((await readReadingWindowChapter(window, 5, load, false,
    { anchors: [], bodyVersion: 'foreign', processingVersion: 'rules' })).contentVersion, 'gateway-content');
  const partial = readyWindow(chapter({ documentRange: { startScalar: 0, endScalar: 5, totalScalars: 8 } }));
  assert.equal((await readReadingWindowChapter(partial, 5, load)).contentVersion, 'gateway-content');
});

test('opening anchor preserves request precedence, stale restore progress and the visible Unicode end', () => {
  const body = chapter();
  const map = new ReadingSurfaceLayoutMap(body.content);
  const restored = { kind: 'restored' as const, progress: { ...previous, chapterOffset: 99 } };
  assert.deepEqual(resolveReadingChapterOpeningAnchor(body, map, restored, 1, 1), { offset: 1, progress: 0.2 });
  assert.deepEqual(resolveReadingChapterOpeningAnchor(body, map, restored, undefined, 1), { offset: 2, progress: 0.4 });
  assert.deepEqual(resolveReadingChapterOpeningAnchor(body, map, restored), { offset: 2, progress: 0.4 });
  assert.deepEqual(resolveReadingChapterOpeningAnchor(body, map, undefined, undefined, NaN), { offset: 0, progress: 0 });
  assert.deepEqual(resolveReadingChapterOpeningAnchor(body, map, undefined), { offset: 0, progress: 0 });
});
