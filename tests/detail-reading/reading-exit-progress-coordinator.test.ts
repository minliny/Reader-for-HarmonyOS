import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BookRequestNotDispatchedError } from '../../entry/src/main/ets/app/BookRequestScheduler.ts';
import { ReadingExitProgressCoordinator, type ReadingContinuousProgressHost, type ReadingExitHost,
  type ReadingExitProgressGateway, type ReadingExitProgressSample,
  type ReadingVisibleProgressHost } from '../../entry/src/main/ets/features/reading/application/ReadingExitProgressCoordinator.ts';
import { createCoreReadingLayout } from '../../entry/src/main/ets/features/reading/application/ReadingMeasurementFacts.ts';
import { ReaderProgressProducerHost, type ReaderProgressProducerGateway } from '../../entry/src/main/ets/features/reading/application/ReaderProgressProducerHost.ts';
import type { ReadingSessionChapter } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import type { LocalReadingAnchor, LocalReadingProgress } from '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';

const identity = { sourceId: 'source', bookId: 'book' };
const chapter: ReadingSessionChapter = { ...identity, chapterIndex: 4, chapterTitle: 'Four', chapterUrl: undefined,
  content: '😀a', contentVersion: 'window', images: [], bodyVersion: 'body', processingVersion: 'processing', extractionVia: 'local' };
const layout = createCoreReadingLayout(400, 800, 1.5, 36);
const receipt: LocalReadingProgress = { bookId: identity.bookId, chapterIndex: chapter.chapterIndex, chapterOffset: 40,
  chapterProgress: 0.4, updatedAt: 250, locationRevision: 'location', progressRevision: 'progress',
  bodyVersion: chapter.bodyVersion, processingVersion: chapter.processingVersion };

function productionWriteFixture() {
  const producers = new ReaderProgressProducerHost();
  const coordinator = new ReadingExitProgressCoordinator(producers);
  const writes: LocalReadingAnchor[] = [];
  const admitted: number[] = [];
  const persist = async (anchor: LocalReadingAnchor): Promise<LocalReadingProgress> => {
    return { ...receipt, chapterOffset: anchor.chapterOffset, chapterProgress: anchor.chapterProgress };
  };
  const gateway: ReaderProgressProducerGateway = {
    runProgressCommitSerial: operation => operation(),
    persistPresentedProgress: (_book, _title, anchor, _layout, current) => {
      assert.equal(current?.(), true);
      writes.push(anchor);
      return writePort.persist(anchor);
    },
    loadProgress: async () => ({ kind: 'missing' }),
  };
  const writePort = { persist };
  const publish = (stored: LocalReadingProgress): void => {
    coordinator.admitCommitted(identity, stored, () => {}, commit => admitted.push(commit.chapterOffset));
  };
  return { coordinator, producers, writes, admitted, writePort, gateway: () => gateway, publish };
}

function visibleHost(fixture: ReturnType<typeof productionWriteFixture>, start: number): ReadingVisibleProgressHost {
  return {
    ready: () => true, mounted: () => true, identity: () => identity, layout: () => layout,
    capture: () => ({ chapter, pageStart: start, scalarCount: () => 100, isCurrent: () => true,
      mayRenewVisit: () => true, deviceId: async () => 'device' }),
    gateway: fixture.gateway, publish: fixture.publish, reportFailure: error => error.message,
  };
}

test('paged writes keep the page start and send the old receipt only for a visible retained visit', async () => {
  const fixture = productionWriteFixture();
  fixture.publish({ ...receipt, chapterProgress: 0.41 });
  fixture.coordinator.retainCommittedVisit();
  const samePage = visibleHost(fixture, 40);
  await fixture.coordinator.commitVisible(samePage);
  assert.deepEqual(fixture.writes, []);
  fixture.coordinator.presentRetainedVisit();
  await fixture.coordinator.commitVisible(samePage);
  assert.equal(fixture.writes[0].chapterProgress, 0.41);
  assert.equal(fixture.writes[0].deviceId, 'device');
  assert.deepEqual(fixture.writes[0].retainedProgressReceipt,
    { progressRevision: 'progress', updatedAt: 250, locationRevision: 'location' });
  assert.equal(fixture.coordinator.retainedVisitVisible, false);
  await fixture.coordinator.commitVisible(visibleHost(fixture, 120));
  assert.equal(fixture.writes[1].chapterOffset, 120);
  assert.equal(fixture.writes[1].chapterProgress, 1.2);
  assert.equal(fixture.writes[1].retainedProgressReceipt, undefined);
});

test('only a proven undispatched retained visit is skipped and stale write leases cannot clear a later writer', async () => {
  const fixture = productionWriteFixture();
  fixture.publish(receipt);
  fixture.coordinator.retainCommittedVisit();
  fixture.coordinator.presentRetainedVisit();
  fixture.writePort.persist = async () => { throw new BookRequestNotDispatchedError('READING_RETAINED_RECENCY_NOT_DISPATCHED'); };
  await fixture.coordinator.commitVisible(visibleHost(fixture, 40));
  assert.equal(fixture.coordinator.retainedVisitSkipped, true);
  assert.equal(fixture.coordinator.writeActive, false);
  const retiredRelease = fixture.coordinator.acquireWrite(() => true);
  fixture.coordinator.invalidateWrite();
  const activeRelease = fixture.coordinator.acquireWrite(() => true);
  retiredRelease();
  assert.equal(fixture.coordinator.writeActive, true);
  activeRelease();
  assert.equal(fixture.coordinator.writeActive, false);
  fixture.writePort.persist = async () => { throw new Error('unknown'); };
  fixture.coordinator.retainCommittedVisit();
  fixture.coordinator.presentRetainedVisit();
  await assert.rejects(fixture.coordinator.commitVisible(visibleHost(fixture, 40)), /unknown/);
  assert.equal(fixture.coordinator.retainedVisitVisible, true);
});

test('continuous scrolling writes one trailing visible scalar after the durable predecessor', async () => {
  const fixture = productionWriteFixture();
  const predecessor = Promise.withResolvers<LocalReadingProgress>();
  fixture.writePort.persist = async anchor => anchor.chapterOffset === 10 ? predecessor.promise :
    { ...receipt, chapterOffset: anchor.chapterOffset, chapterProgress: anchor.chapterProgress };
  let scalar = 10;
  let revision = 1;
  const calls: string[] = [];
  const host: ReadingContinuousProgressHost = {
    active: () => true, identity: () => identity, layout: () => layout, gateway: fixture.gateway, publish: fixture.publish,
    capture: () => ({ chapter, scalar, scalarCount: 100, revision, ownsSample: () => true }),
    latestSample: () => chapter, revision: () => revision, visibleScalar: () => scalar,
    completed: () => calls.push('complete'), settled: () => calls.push('settled'), failed: assert.fail,
  };
  const first = fixture.coordinator.commitContinuous(host);
  scalar = 20;
  revision += 1;
  const next = fixture.coordinator.commitContinuous(host);
  scalar = 30;
  revision += 1;
  assert.deepEqual(fixture.writes.map(anchor => anchor.chapterOffset), [10]);
  predecessor.resolve({ ...receipt, chapterOffset: 10, chapterProgress: 0.1 });
  await Promise.all([first, next]);
  assert.deepEqual(fixture.writes.map(anchor => anchor.chapterOffset), [10, 30]);
  assert.deepEqual(fixture.admitted, [30]);
  assert.deepEqual(calls, ['complete', 'settled']);
});

test('exit hands accepted work off first and samples speech, continuous, or paged position without joining disk', () => {
  const fixture = productionWriteFixture();
  fixture.publish(receipt);
  const handed: Array<{ offset: number; baseline?: string }> = [];
  const calls: string[] = [];
  const gateway: ReadingExitProgressGateway = {
    handoffPendingProgress: () => calls.push('pending'),
    handoffPresentedProgress: (book, title, anchor, providedLayout, baseline) => {
      assert.equal(book, identity.bookId);
      assert.equal(title, chapter.chapterTitle);
      assert.equal(providedLayout, layout);
      handed.push({ offset: anchor.chapterOffset, baseline: baseline?.progressRevision });
    },
  };
  let speechOwnsPosition = false;
  let continuous = false;
  const capture = (): ReadingExitProgressSample => {
    calls.push('sample');
    return {
      chapter, identity, continuous, layout: () => layout, scalarCount: () => 100,
      continuousScalar: () => 70, visibleScalar: () => 120, visibleCurrent: () => true,
      ttsOwnsPosition: () => speechOwnsPosition,
    };
  };
  fixture.coordinator.handoff(gateway, undefined, capture);
  continuous = true;
  fixture.coordinator.handoff(gateway, undefined, capture);
  speechOwnsPosition = true;
  fixture.coordinator.handoff(gateway, { chapter: { ...chapter, chapterIndex: 1 }, charEnd: 2 }, capture);
  fixture.coordinator.handoff(gateway, { chapter, charEnd: 55 }, capture);
  assert.deepEqual(calls, ['pending', 'sample', 'pending', 'sample', 'pending', 'sample', 'pending', 'sample']);
  assert.deepEqual(handed, [{ offset: 100, baseline: 'progress' }, { offset: 70, baseline: 'progress' },
    { offset: 55, baseline: 'progress' }]);
});

test('exit defers during gesture rollback, hands off an unresolved turn, and delivers the route once', () => {
  const { coordinator } = productionWriteFixture();
  const speechStop = Promise.withResolvers<void>();
  const calls: string[] = [];
  let requested = false;
  let turnUnknown = false;
  let input: ReturnType<ReadingExitHost['inputPhase']> = 'dragging';
  const host: ReadingExitHost = {
    isActive: () => !requested, isMounted: () => true, cancelRapidInput: () => calls.push('cancel-rapid'),
    unknownTurnWrite: () => turnUnknown, handoffTurnWrite: () => calls.push('handoff-turn'),
    deferExit: pending => calls.push('defer:' + pending),
    releaseTurnRecoveryInput: () => { calls.push('release-turn'); input = 'idle'; },
    inputPhase: () => input,
    cancelTracking: () => { calls.push('cancel-track'); input = 'settling'; return true; },
    rollbackUncommittedTurn: () => { calls.push('rollback'); return true; },
    markRequested: () => { requested = true; calls.push('requested'); },
    observePrefetch: () => calls.push('prefetch'), retireInputEffects: () => calls.push('retire'),
    handoffDuration: () => calls.push('duration'),
    speech: () => ({ capture: () => { calls.push('speech-capture'); return { chapter, charEnd: 55 }; },
      stop: () => { calls.push('speech-stop'); return speechStop.promise; } }),
    handoffProgress: spoken => { assert.equal(spoken?.charEnd, 55); calls.push('progress'); },
    retainEntry: () => calls.push('retain'), exit: () => { calls.push('exit'); coordinator.beginExit(host); },
    reportFailure: (_phase, error) => assert.fail(error.message),
  };
  coordinator.beginExit(host);
  assert.deepEqual(calls, ['cancel-rapid', 'defer:true', 'cancel-track']);
  coordinator.beginExit(host);
  assert.deepEqual(calls.slice(3), ['cancel-rapid', 'defer:true', 'rollback']);
  turnUnknown = true;
  coordinator.beginExit(host);
  coordinator.beginExit(host);
  assert.deepEqual(calls.slice(6), ['cancel-rapid', 'handoff-turn', 'defer:false', 'release-turn', 'requested', 'prefetch',
    'retire', 'duration', 'speech-capture', 'progress', 'speech-stop', 'retain', 'exit']);
  speechStop.resolve();
});
