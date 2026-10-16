import { withReaderProgressProducerFixture } from './lib/reader-progress-producer-fixture.mjs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const readingFile = fileURLToPath(new URL(
  '../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url));
const Reader = withReaderProgressProducerFixture(productionMotionMethods(readingFile, ['commitTtsProgress', 'finishExit'], {
  CoreReadingAnchor: class {
    constructor(chapterIndex, chapterOffset, chapterProgress, bodyVersion, processingVersion) {
      Object.assign(this, { chapterIndex, chapterOffset, chapterProgress, bodyVersion, processingVersion });
    }
  },
}));

const chapter = { sourceId: 'source', bookId: 'book', chapterIndex: 4,
  chapterTitle: '第四章', bodyVersion: 'body-v4', processingVersion: 'rules-v2' };
const ttsProgress = { chapter, charEnd: 55 };

function fixture() {
  const writes = [], events = [];
  const owner = Object.assign(new Reader(), {
    sourceId: 'source', bookId: 'book', chapter, chapterSelectionToken: 7,
    visiblePage: { startScalar: 0 }, visiblePageSelectionToken: 7, materializedChapterSelectionToken: 7, phase: 'ready', mounted: true, lifecycleToken: 1,
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
    readingRecordHost: { handoff() { events.push('record'); } },
    awaitOrdinaryFirstPagePersistence: async () => {},
    commitVisiblePage: async () => { events.push('visible-page'); },
    commitContinuousProgress: async () => { events.push('continuous-page'); },
    retainConfirmedEntryPresentation: () => {},
    onExit: () => { events.push('exit'); },
    activeGateway: () => ({
      handoffPendingProgress() {}, handoffPresentedProgress(_book, _title, anchor) { writes.push(anchor); events.push('handoff'); },
      runProgressCommitSerial: operation => operation(),
      async resolveAndUpdateProgress(_bookId, _title, anchor, _layout, isCurrent) {
        assert.equal(isCurrent(), true);
        writes.push(anchor);
        return { bookId: 'book', chapterIndex: anchor.chapterIndex, chapterOffset: anchor.chapterOffset,
          chapterProgress: anchor.chapterProgress, bodyVersion: anchor.bodyVersion,
          processingVersion: anchor.processingVersion, updatedAt: 1 };
      },
    }),
  });
  return { owner, writes, events };
}

// Completed audio, not a queued slice, transfers immediately even if stop hangs.
{
  const { owner, writes, events } = fixture();
  owner.exitRequested = true;
  owner.ttsCoordinator = { captureCompletedProgress: () => ttsProgress, stop: () => new Promise(() => {}) };
  await owner.finishExit(1);
  assert.deepEqual(events, ['record', 'handoff', 'exit']);
  assert.equal(writes.length, 1); assert.equal(writes[0].chapterOffset, 55);
  assert.equal(owner.lastCommittedProgress, undefined, 'handoff never fabricates a durable ACK');
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
  owner.ttsCoordinator = { captureCompletedProgress() {}, stop: async () => {} };
  await owner.finishExit(1);
  assert.deepEqual(events, ['record', 'handoff', 'exit']);
  assert.equal(owner.lastCommittedProgress.chapterOffset, 12, 'background handoff cannot rewrite the confirmed UI receipt');
}

console.log('reader TTS exit progress ownership: PASS');
