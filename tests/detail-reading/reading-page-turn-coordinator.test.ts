import assert from 'node:assert/strict';
import test from 'node:test';
import type { LocalReadingProgress } from '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';
import { ReaderPreparedPageSettlement } from '../../entry/src/main/ets/features/reading/application/ReaderPreparedPageSettlement.ts';
import {
  ReadingPageTurnCoordinator, type ReaderPageTurnNativeEvidence, type ReaderPreparedNeighbourIdentity,
  type ReaderPreparedNeighbourOwner, type ReaderRapidPageTurnHost,
} from '../../entry/src/main/ets/features/reading/application/ReadingPageTurnCoordinator.ts';
import { createReaderPageGestureState, type ReaderPageTurnDirection } from '../../entry/src/main/ets/features/reading/ui/ReaderPageGestureState.ts';

function fixture() {
  const destination: ReaderPreparedNeighbourIdentity = {
    generation: 12, originChapterIndex: 7, originPageStartScalar: 260,
    key: { sourceId: 'remote:origin', bookId: 'book:1', chapterIndex: 8, layoutSignature: 'phone:0', contentVersion: 'body:8' },
    context: { contentVersion: 'body:8' },
  };
  const receipt: LocalReadingProgress = {
    bookId: 'book:1', chapterIndex: 8, chapterOffset: 0, chapterProgress: 0, updatedAt: 14, locationRevision: 'chapter8:0',
  };
  const events: string[] = [];
  let writeReturn: (stored: LocalReadingProgress) => void = () => { throw Error('write was not requested'); };
  let visibleChapter = 7;
  let open = true;
  let layout = 'phone:0';
  let version = 'body:8';
  const origin: ReaderPreparedNeighbourOwner = {
    mounted: () => open, generation: () => 12, visibleChapter: () => visibleChapter, visiblePageStart: () => 260,
    sourceId: () => 'remote:origin', bookId: () => 'book:1', layoutSignature: () => layout,
    contentVersion: (chapterIndex) => chapterIndex === 8 ? version : undefined,
  };
  const settlement = new ReaderPreparedPageSettlement<ReaderPreparedNeighbourIdentity>({
    current: (candidate, lifecycle, generation) => open && candidate === destination && lifecycle === 3 && generation === 5,
    canPresent: () => false,
    persistPresented: async () => { throw new Error('presented-only write would skip durable admission'); },
    write: (_candidate, current) => {
      assert.equal(current(), true);
      events.push('write');
      return new Promise((resolve) => { writeReturn = resolve; });
    },
    acquireWrite: () => {
      events.push('acquire');
      return () => { events.push('release'); };
    },
    gateway: () => ({
      runProgressCommitSerial: async (operation) => operation(),
      loadProgress: async () => ({ kind: 'missing' }),
      handoffPendingProgress: () => { events.push('handoff'); },
    }),
    bookId: () => 'book:1',
    position: (candidate) => ({ chapterIndex: candidate.key.chapterIndex, chapterOffset: 0 }),
    origin: () => undefined,
    releaseUnknownInput: () => { open = false; },
    finish: (generation) => { events.push(`receipt:${generation}`); },
    reportFailure: (error) => { throw error; },
  }, { set: () => 0, clear: () => undefined });
  const coordinator = new ReadingPageTurnCoordinator<string, string, ReaderPreparedNeighbourIdentity,
    string, string, string>(settlement);
  const fresh = (candidate: ReaderPreparedNeighbourIdentity) => coordinator.freshPrepared(candidate, origin);
  return {
    coordinator, settlement, destination, receipt, events, origin, fresh,
    writeReturned: () => writeReturn(receipt),
    changeLayout: () => { layout = 'phone:1'; },
    replaceContent: () => { version = 'body:8:updated'; },
    replaceChapter: () => { visibleChapter = 9; },
  };
}

test('continuous rapid input consumes the signed backlog without preparing a page', () => {
  const { coordinator } = fixture();
  const starts: ReaderPageTurnDirection[] = [];
  const host: ReaderRapidPageTurnHost = {
    invalidateSpeechFollow: () => undefined, lifecycleActive: () => true, interactionEnabled: () => true,
    controlVisible: () => false, directBoundary: () => undefined, finishDirectGesture: () => undefined,
    pointerHeld: () => false, workInFlight: () => false, openControl: () => assert.fail('control has no intent'),
    canTurnPage: () => false, continuous: () => true, requiresPreparedPage: () => true,
    prepared: () => assert.fail('continuous does not inspect the paged neighbor'),
    prepare: () => assert.fail('continuous has no offscreen page preparation'),
    prioritize: () => undefined,
    perform: (direction) => { starts.push(direction); return { kind: 'started' }; },
    recordStarted: () => undefined,
  };
  assert.equal(coordinator.request('next', host).kind, 'started');
  assert.equal(coordinator.request('next', host).kind, 'busy');
  assert.equal(coordinator.request('next', host).kind, 'busy');
  assert.equal(coordinator.request('previous', host).kind, 'busy');
  coordinator.completeRapid('previous');
  assert.equal(coordinator.inFlightDirection, 'next');
  coordinator.completeRapid('next');
  assert.equal(coordinator.drain(host).kind, 'started');
  coordinator.completeRapid('next');
  assert.deepEqual(starts, ['next', 'next']);
  assert.equal(coordinator.hasRapidWork(), false);
});

function pagedHost(run: ReturnType<typeof fixture>) {
  const starts: ReaderPreparedNeighbourIdentity[] = [];
  const preparations: ReaderPageTurnDirection[] = [];
  const host: ReaderRapidPageTurnHost = {
    invalidateSpeechFollow: () => undefined, lifecycleActive: () => true, interactionEnabled: () => true,
    controlVisible: () => false, directBoundary: () => undefined, finishDirectGesture: () => undefined,
    pointerHeld: () => false, workInFlight: () => false, openControl: () => assert.fail('control has no intent'),
    canTurnPage: () => true, continuous: () => false, requiresPreparedPage: () => true,
    prepared: (direction) => run.coordinator.preparedPageTurn(direction, false, run.origin) !== undefined,
    prepare: (direction) => { preparations.push(direction); },
    prioritize: () => undefined,
    perform: (direction) => {
      const candidate = run.coordinator.preparedPageTurn(direction, false, run.origin);
      assert.ok(candidate, 'the paged writer only starts for an admitted neighbour');
      starts.push(candidate);
      return { kind: 'started' };
    },
    recordStarted: () => undefined,
  };
  return { host, starts, preparations };
}

test('repeated paged next drains behind the current turn and then requires the new layout neighbour', () => {
  const run = fixture();
  const { coordinator, destination } = run;
  const { host, starts, preparations } = pagedHost(run);
  assert.equal(coordinator.request('next', host).kind, 'preparing');
  coordinator.setNeighbour('next', destination);
  assert.equal(coordinator.drain(host).kind, 'started');
  assert.equal(coordinator.request('next', host).kind, 'busy');
  assert.equal(coordinator.request('next', host).kind, 'busy');
  run.changeLayout();
  coordinator.completeRapid('next');
  assert.equal(coordinator.drain(host).kind, 'preparing');
  const replacement = { ...destination, key: { ...destination.key, layoutSignature: 'phone:1' } };
  coordinator.setNeighbour('next', replacement);
  assert.equal(coordinator.drain(host).kind, 'started');
  coordinator.cancelRapid();
  coordinator.completeRapid('next');
  assert.equal(coordinator.drain(host).kind, 'busy');
  assert.deepEqual(preparations, ['next', 'next']);
  assert.deepEqual(starts, [destination, replacement]);
  assert.equal(coordinator.hasRapidWork(), false);
});

test('a deferred pointer release only replays paged requests that survive cancellation', () => {
  const run = fixture();
  const { coordinator, destination } = run;
  const { host, starts, preparations } = pagedHost(run);
  coordinator.setNeighbour('next', destination);
  assert.equal(coordinator.reserveDeferredPointer(), true);
  assert.equal(coordinator.request('next', host).kind, 'busy');
  coordinator.cancelRapid();
  coordinator.releaseDeferredPointer();
  assert.equal(coordinator.drain(host).kind, 'busy');
  assert.equal(coordinator.reserveDeferredPointer(), true);
  assert.equal(coordinator.request('next', host).kind, 'busy');
  coordinator.releaseDeferredPointer();
  assert.equal(coordinator.drain(host).kind, 'started');
  coordinator.completeRapid('next');
  assert.deepEqual(starts, [destination]);
  assert.deepEqual(preparations, []);
  assert.equal(coordinator.hasRapidWork(), false);
});

test('cancelled or replaced slide frame callbacks cannot settle the next generation', () => {
  const { coordinator } = fixture();
  const frames: Array<() => void> = [];
  const offsets: number[] = [];
  const finished: number[] = [];
  let now = 0;
  const host = {
    mounted: () => true, generation: () => coordinator.generation, now: () => now,
    publishOffset: (offset: number) => { offsets.push(offset); },
    postFrame: (run: () => void) => { frames.push(run); },
    finished: (generation: number) => { finished.push(generation); },
  };
  coordinator.generation = 4;
  coordinator.startSlide(-400, 4, { offset: -30, width: 400, velocity: 0, gestureUndecided: true }, host);
  const oldFrame = frames.shift()!;
  coordinator.cancelSlide();
  coordinator.generation = 5;
  coordinator.startSlide(0, 5, { offset: -30, width: 400, velocity: 0, gestureUndecided: false }, host);
  now = 500;
  oldFrame();
  assert.deepEqual(offsets, [-30, -30]);
  assert.deepEqual(finished, []);
  frames.shift()!();
  assert.deepEqual(offsets, [-30, -30, 0]);
  assert.deepEqual(finished, [5]);
  assert.equal(coordinator.hasSlide(), false);
});

test('a mounted gesture retains its measured neighbor across layout reflow but rejects replacement body or origin', () => {
  const { coordinator, destination, origin, fresh, changeLayout, replaceContent, replaceChapter } = fixture();
  assert.equal(fresh(destination), true);
  coordinator.setNeighbour('next', destination);
  coordinator.admitPrepared(destination);
  coordinator.freeze(() => ({ revision: 11, layout: 'phone:0', current: 'origin', previous: undefined, next: 'destination' }));
  changeLayout();
  assert.equal(fresh(destination), false);
  assert.equal(coordinator.preparedPageTurn('next', true, origin), destination);
  assert.equal(coordinator.preparedPageTurn('next', false, origin), undefined);
  assert.equal(coordinator.preparedPageTurn('previous', true, origin), undefined);
  coordinator.setNeighbour('next', { ...destination });
  assert.equal(coordinator.preparedPageTurn('next', true, origin), undefined);
  coordinator.setNeighbour('next', destination);
  assert.equal(coordinator.frozen(11)?.next, 'destination');
  assert.equal(coordinator.frozen(12), undefined);
  coordinator.clearUnprotectedNeighbours(destination);
  assert.equal(coordinator.neighbour('next'), destination);
  replaceContent();
  assert.equal(coordinator.preparedPageTurn('next', true, origin), undefined);
  replaceChapter();
  assert.equal(coordinator.preparedPageTurn('next', true, origin), undefined);
  coordinator.clearProjection();
  assert.equal(coordinator.admittedPrepared(), undefined);
});

test('only a current visual endpoint can start the cross-chapter write, and a matching durable receipt permits promotion', async () => {
  const { coordinator, settlement, destination, receipt, events, fresh, writeReturned } = fixture();
  coordinator.generation = 5;
  settlement.stage(destination);
  let autoPending = true;
  const evidence: ReaderPageTurnNativeEvidence = {
    mounted: () => true, surfaceMounted: () => true, simulation: () => true, active: () => true,
    surfaceGeneration: () => 5, automaticStartPending: () => autoPending, awaitingSlots: () => false, phase: () => 'settling',
  };
  assert.equal(coordinator.nativeEvent('commitEndpoint', 5, evidence), undefined);
  autoPending = false;
  assert.equal(coordinator.nativeEvent('commitEndpoint', 4, evidence), undefined);
  coordinator.recordVisualEndpoint(4, 3);
  assert.deepEqual(events, []);
  assert.equal(coordinator.nativeEvent('commitEndpoint', 5, evidence), 'commitEndpoint');
  coordinator.recordVisualEndpoint(5, 3);
  coordinator.recordVisualEndpoint(5, 3);
  assert.deepEqual(events, ['acquire', 'write']);
  assert.deepEqual(coordinator.joinPersistence(5, false, fresh), { action: 'wait' });
  writeReturned();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(events, ['acquire', 'write', 'release', 'receipt:5']);
  assert.deepEqual(coordinator.joinPersistence(4, false, fresh), { action: 'wait' });
  assert.deepEqual(coordinator.joinPersistence(5, false, fresh), { action: 'promote', prepared: destination, stored: receipt });
});

test('the terminal sheet is released only for matching native and ArkUI stage revisions', () => {
  const { coordinator } = fixture();
  coordinator.generation = 5;
  const evidence = {
    active: true, simulation: true, surfaceGeneration: 5, awaitingSlots: false,
    expectedRevision: 7, readyRevision: 7, scheduledRevision: 7, phase: 'logicalPromoted' as const,
  };
  assert.equal(coordinator.confirmFrame(4, evidence), false);
  assert.equal(coordinator.confirmFrame(5, { ...evidence, awaitingSlots: true }), false);
  assert.equal(coordinator.confirmFrame(5, { ...evidence, scheduledRevision: 6 }), false);
  assert.equal(coordinator.confirmFrame(5, { ...evidence, readyRevision: 6 }), false);
  assert.equal(coordinator.confirmFrame(5, { ...evidence, phase: 'surfaceHidden' }), false);
  assert.equal(coordinator.confirmFrame(5, evidence), true);
});

test('deferred window/chapter work is drained once, with requested chapter ahead of speculative replacements', () => {
  const { coordinator } = fixture();
  coordinator.deferRequestedChapter();
  coordinator.deferContentProjection(5);
  coordinator.deferReplaceReload();
  coordinator.deferChapterSelection('old tts');
  coordinator.discardDeferredSelectionIf((selection) => selection === 'old tts');
  coordinator.deferChapterSelection('manual');
  coordinator.deferViewport(390, 710);
  coordinator.deferAppearance('compact');
  assert.equal(coordinator.takeDeferredWork(true, true), undefined);
  assert.equal(coordinator.takeDeferredWork(false, false), undefined);
  const work = coordinator.takeDeferredWork(false, true)!;
  assert.equal(coordinator.deferredChapterAction(work), 'requested');
  assert.deepEqual(work.viewport, { width: 390, height: 710 });
  assert.equal(work.appearance, 'compact');
  assert.equal(work.selection, 'manual');
  const followUp = coordinator.takeDeferredWork(false, true)!;
  assert.equal(coordinator.deferredChapterAction(followUp), 'none');
  assert.equal(followUp.viewport, undefined);
});


test('bookmark rollback does not ask the horizontal renderer to acquire or settle a sheet', () => {
  const { coordinator } = fixture();
  const gesture = { ...createReaderPageGestureState(), phase: 'settling', settleTarget: 'rollback' } as const;
  const guardedRenderer = {
    simulation: () => assert.fail('bookmark keeps native surface out of rebound'),
    slide: () => assert.fail('bookmark keeps flat slide out of rebound'),
  };
  assert.equal(coordinator.gestureAction({ ...gesture, owner: 'bookmark' }, guardedRenderer), 'bookmark');
  const slideRenderer = { simulation: () => false, slide: () => true };
  assert.equal(coordinator.gestureAction({ ...gesture, owner: 'horizontalPage' }, slideRenderer), 'rollback');
  assert.equal(coordinator.gesturePresentationPhase('idle', false, true), undefined);
});
