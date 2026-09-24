import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const readingFile = fileURLToPath(new URL(
  '../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url));
const Reader = productionMotionMethods(readingFile, ['commitTtsProgress', 'finishExit'], {
  CoreReadingAnchor: class {
    constructor(chapterIndex, chapterOffset, chapterProgress, bodyVersion, processingVersion) {
      Object.assign(this, { chapterIndex, chapterOffset, chapterProgress, bodyVersion, processingVersion });
    }
  },
});

const chapter = { sourceId: 'source', bookId: 'book', chapterIndex: 4,
  chapterTitle: '第四章', bodyVersion: 'body-v4', processingVersion: 'rules-v2' };
const ttsProgress = { chapter, charEnd: 55 };

function fixture() {
  const writes = [], events = [];
  const owner = Object.assign(new Reader(), {
    sourceId: 'source', bookId: 'book', chapter, chapterSelectionToken: 7,
    visiblePage: { startScalar: 0 }, mounted: true, lifecycleToken: 1,
    exitRequested: false, exitAttemptGeneration: 1, exitDelivered: false,
    readerSettingsSnapshot: { navigationMode: 'paged' },
    isMountedToken(token) { return this.mounted && this.lifecycleToken === token; },
    isSessionActive(token) { return this.isMountedToken(token) && !this.exitRequested; },
    isReaderIdentityCurrent: () => true,
    requireChapterLayoutMap: () => ({ scalarCount: () => 100 }),
    coreLayout: () => ({}),
    admitCommittedProgress(stored) {
      this.lastCommittedProgress = { ...stored, sourceId: this.sourceId, bookId: this.bookId };
    },
    logTtsFailure: (_stage, error) => { throw error; },
    flushReadingRecordForExit: async () => { events.push('record'); },
    awaitOrdinaryFirstPagePersistence: async () => {},
    commitVisiblePage: async () => { events.push('visible-page'); },
    commitContinuousProgress: async () => { events.push('continuous-page'); },
    retainConfirmedEntryPresentation: () => {},
    onExit: () => { events.push('exit'); },
    activeGateway: () => ({
      runProgressCommitSerial: operation => operation(),
      async resolveAndUpdateProgress(_bookId, _title, anchor, _layout, isCurrent) {
        assert.equal(isCurrent(), true);
        writes.push(anchor);
        return { chapterIndex: anchor.chapterIndex, chapterOffset: anchor.chapterOffset,
          chapterProgress: anchor.chapterProgress, updatedAt: 1 };
      },
    }),
  });
  return { owner, writes, events };
}

// beginExit has already marked exitRequested. The completed audio callback's
// queued progress must still write before the route exits, and its confirmed
// scalar must not be replaced by the visible page's older start position.
{
  const { owner, writes, events } = fixture();
  let entered, release;
  const writeEntered = new Promise(resolve => { entered = resolve; });
  const writeBlocked = new Promise(resolve => { release = resolve; });
  const gateway = owner.activeGateway();
  owner.activeGateway = () => ({
    ...gateway,
    async resolveAndUpdateProgress(...args) {
      entered();
      await writeBlocked;
      return gateway.resolveAndUpdateProgress(...args);
    },
  });
  owner.exitRequested = true;
  owner.ttsCoordinator = { stop: () => owner.commitTtsProgress(ttsProgress, 1) };
  const exit = owner.finishExit(1);
  await writeEntered;
  assert.deepEqual(events, [], 'route cannot leave before TTS progress is durable');
  release();
  await exit;
  assert.equal(writes.length, 1);
  assert.equal(writes[0].chapterOffset, 55);
  assert.equal(owner.lastCommittedProgress.chapterOffset, 55);
  assert.deepEqual(events, ['record', 'exit'], 'exit must not rewind to the page start');
}

// The same delayed callback must lose ownership when a manual chapter
// selection supersedes it, even if Core's serial lane admits it later.
{
  const { owner, writes } = fixture();
  let entered, release;
  const serialEntered = new Promise(resolve => { entered = resolve; });
  const serialBlocked = new Promise(resolve => { release = resolve; });
  const gateway = owner.activeGateway();
  owner.activeGateway = () => ({
    ...gateway,
    async runProgressCommitSerial(operation) { entered(); await serialBlocked; return operation(); },
  });
  const pending = owner.commitTtsProgress(ttsProgress, 1);
  await serialEntered;
  owner.chapter = { ...chapter, chapterIndex: 5 };
  owner.chapterSelectionToken += 1;
  release();
  await pending;
  assert.equal(writes.length, 0, 'old TTS progress cannot overwrite a manual chapter selection');
}

// A later manual/page commit replaces the TTS receipt and restores the usual
// exit persistence path for the current visible page.
{
  const { owner, events } = fixture();
  await owner.commitTtsProgress(ttsProgress, 1);
  owner.lastCommittedProgress = { sourceId: 'source', bookId: 'book',
    chapterIndex: 4, chapterOffset: 12, chapterProgress: 0.12 };
  owner.exitRequested = true;
  owner.ttsCoordinator = { stop: async () => {} };
  await owner.finishExit(1);
  assert.deepEqual(events, ['record', 'visible-page', 'exit']);
}

console.log('reader TTS exit progress ownership: PASS');
