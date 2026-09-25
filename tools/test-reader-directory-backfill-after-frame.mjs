import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerDirectoryNoteMissingNavigation, readerDirectoryObserveMissingNavigation,
  readerDirectoryTakeMissingNavigation } from '../entry/src/main/ets/features/reading/ReaderDirectoryNavigation.ts';

const indexPath = fileURLToPath(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url));
const owner = {};
const repairs = [];
const frames = [];
const Index = productionMotionMethods(indexPath,
  ['readingReadyCallback', 'scheduleNavigationBackfillAfterReady'], {
    LOCAL_SOURCE_ID: 'local',
    ReaderRuntimeOwner: { current: () => owner },
    ReaderNavigationBackfillFrame: class { constructor(action) { this.action = action; } onFrame() { this.action(); } },
    backfillRetainedReaderDirectoryNavigation: async (_owner, bookId, isCurrent) => {
      if (isCurrent()) repairs.push(bookId);
      return 'ready';
    },
    readerDirectoryObserveMissingNavigation, readerDirectoryTakeMissingNavigation,
  });

function reader(bookId, kind = 'epub') {
  const presented = [];
  const page = Object.assign(new Index(), {
    systemFileOpenMounted: true, readingSessionActive: true, route: 'reading',
    detailBook: { sourceId: 'local', bookId, kind },
    readingReadyGeneration: 7, navigationGeneration: 3,
    navigationBackfillObservedKey: '', navigationBackfillAttempted: new Set(),
    presentPreparedReading: chapterIndex => presented.push(chapterIndex),
    getUIContext: () => ({ postFrameCallback: frame => frames.push(frame) }),
  });
  return { page, presented };
}

{
  const { page, presented } = reader('old-epub');
  readerDirectoryNoteMissingNavigation('old-epub', 'navigationMissingOrStale');
  page.readingReadyCallback('local', 'old-epub', 7)(2);
  assert.deepEqual(presented, [2]);
  assert.deepEqual(repairs, [], 'a directory miss cannot reparse before readable frame');
  frames.shift().onFrame();
  assert.deepEqual(repairs, ['old-epub'], 'prior detail miss starts one repair after readable frame');
  page.readingReadyCallback('local', 'old-epub', 7)(2);
  readerDirectoryNoteMissingNavigation('old-epub', 'navigationMissingOrStale');
  assert.deepEqual(repairs, ['old-epub'], 'one session never repeats archive reparsing');
  page.navigationBackfillObserverDisposer?.();
}
{
  const { page } = reader('late-epub');
  page.readingReadyCallback('local', 'late-epub', 7)(0);
  frames.shift().onFrame();
  assert.deepEqual(repairs, ['old-epub'], 'reading ready alone performs no Core navigation work');
  readerDirectoryNoteMissingNavigation('late-epub', 'navigationMissingOrStale');
  assert.deepEqual(repairs, ['old-epub', 'late-epub'], 'later directory miss is repaired after already readable frame');
  page.navigationBackfillObserverDisposer?.();
}
{
  const { page } = reader('stale-epub');
  readerDirectoryNoteMissingNavigation('stale-epub', 'navigationMissingOrStale');
  page.readingReadyCallback('local', 'stale-epub', 7)(0);
  page.navigationGeneration = 4;
  frames.shift().onFrame();
  assert.deepEqual(repairs, ['old-epub', 'late-epub'], 'stale reading session cannot backfill');
}
{
  const { page } = reader('local-txt', 'txt');
  readerDirectoryNoteMissingNavigation('local-txt', 'navigationMissingOrStale');
  page.readingReadyCallback('local', 'local-txt', 7)(0);
  assert.equal(frames.length, 1, 'TXT preparation is deferred until a readable frame');
  assert.deepEqual(repairs, ['old-epub', 'late-epub']);
  frames.shift().onFrame();
  assert.deepEqual(repairs, ['old-epub', 'late-epub', 'local-txt']);
  page.navigationBackfillObserverDisposer?.();
}

console.log('PH42 retained EPUB backfill only after directory miss and readable frame: PASS');
