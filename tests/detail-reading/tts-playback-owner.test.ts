import assert from 'node:assert/strict';
import test from 'node:test';
import { ReaderTtsPreparation, type ReaderTtsPreparationIntent } from '../../entry/src/main/ets/features/reading/application/ReaderTtsConfigAdmission.ts';
import { createReaderTtsState, type ReaderTtsState } from '../../entry/src/main/ets/features/reading/application/ReaderTtsState.ts';
import {
  ReaderTtsPlaybackOwner, type ReaderControlPlaybackPresentation, type ReaderTtsPlaybackCoordinator,
  type ReaderTtsStartPage,
} from '../../entry/src/main/ets/features/reading/application/ReaderTtsPlaybackOwner.ts';
import { loadNextReaderTtsChapter } from '../../entry/src/main/ets/features/reading/application/ReaderTtsTransportOwner.ts';
import { ReadingChapterWindow, type ReadingSessionChapter } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import { planReaderTtsFollowPage, type ReaderTtsFollowTarget } from '../../entry/src/main/ets/features/reading/ui/ReaderTtsPageFollow.ts';

function deferred<T>() {
  let complete!: (value: T) => void;
  const result = new Promise<T>((resolve) => { complete = resolve; });
  return { result, complete };
}

function turn(): Promise<void> { return new Promise((resolve) => setImmediate(resolve)); }

function chapter(chapterIndex = 0): ReadingSessionChapter {
  return {
    sourceId: 'source', bookId: 'book', chapterIndex, chapterTitle: 'Chapter', chapterUrl: undefined,
    content: 'read', contentVersion: 'version', images: [], extractionVia: 'rule',
  };
}

function fixture() {
  const events: string[] = [];
  const preparation = new ReaderTtsPreparation();
  const availability = deferred<boolean>();
  const hydration = deferred<void>();
  const audio = deferred<boolean>();
  const started = deferred<void>();
  const paused = deferred<void>();
  let selectionToken = 3;
  let page: ReaderTtsStartPage = { chapter: chapter(), startScalar: 2 };
  let state: ReaderTtsState = { ...createReaderTtsState(true), sessionGeneration: 2 };
  let confirmedPause = false;
  const presentation: ReaderControlPlaybackPresentation = {
    bookId: 'book', sourceId: 'source', lifecycleToken: 1, openRevision: 5, moduleVisitRevision: 7, module: 'tts',
  };
  const speech: ReaderTtsPlaybackCoordinator = {
    pause: () => { events.push('pause'); return paused.result; },
    resume: async () => { events.push('resume'); },
    hasConfirmedUserPause: (generation) => confirmedPause && generation === 2,
    setDesiredPlaying: (desired) => { events.push(`desired ${desired}`); },
    start: (input, desired) => {
      events.push(`start ${input.scalarPosition} ${desired}`);
      return started.result;
    },
    whenStarted: () => audio.result,
  };
  let coordinator: ReaderTtsPlaybackCoordinator | undefined = speech;
  const initialize = (retry = false): Promise<boolean> => preparation.initialize(retry, () => true, (): ReaderTtsPreparationIntent => ({
    probe: {
      probeAvailability: () => { events.push('probe'); return availability.result; },
      getProbedConfig: () => undefined,
      setRate: async () => {},
    },
    isCurrent: () => true,
    loadMetadata: async () => {},
    admitConfig: () => {},
    reportFailure: () => {},
  }));
  const owner = new ReaderTtsPlaybackOwner({
    scope: () => ({ lifecycleToken: 1, selectionToken, sourceId: 'source', bookId: 'book' }),
    scopeCurrent: (scope) => scope.selectionToken === selectionToken,
    state: () => state,
    coordinator: () => coordinator,
    inputAllowed: () => true,
    retireBlockedStarts: () => { events.push('retire'); },
    cancelAutoPageStart: () => { events.push('cancel auto'); },
    stopAutoPage: () => { events.push('stop auto'); },
    initialize: (_lifecycle, retry) => initialize(retry),
    startPage: () => page,
    hydrateEntry: () => { events.push('expand'); return hydration.result; },
    startInput: (start) => ({ chapter: start.chapter, content: start.chapter.content,
      contentVersion: start.chapter.contentVersion, scalarPosition: start.startScalar }),
    logFailure: (operation) => { events.push(`failure ${operation}`); },
  }, {
    capture: () => presentation,
    beginForStart: () => { events.push('begin capsule'); return true; },
    beginForResume: () => { events.push('resume capsule'); return true; },
    pauseWitness: () => ({ speechGeneration: state.sessionGeneration, confirm: () => { events.push('confirmed pause'); } }),
    desiredPlaying: () => true,
    timing: () => { events.push('read timing'); return undefined; },
    showStatic: () => { events.push('show static'); },
    observeStart: () => { events.push('observe start'); },
    fail: () => { events.push('cancel capsule'); },
  }, preparation);
  return {
    owner, events, audio, started, paused, presentation,
    setState: (value: ReaderTtsState) => { state = value; },
    replaceSelection: () => { selectionToken += 1; },
    clearCoordinator: () => { coordinator = undefined; },
    finishAvailability: () => { availability.complete(true); },
    ready: async () => { availability.complete(true); await initialize(); events.length = 0; },
    setPartialPage: () => {
      page = { chapter: { ...chapter(), documentRange: { startScalar: 0, endScalar: 4, totalScalars: 10 } }, startScalar: 2 };
    },
    finishHydration: () => { page = { chapter: chapter(), startScalar: 2 }; hydration.complete(); },
    confirmPause: () => { confirmedPause = true; paused.complete(); },
  };
}

test('a stale TTS ticket cannot open audio when availability arrives after selection', async () => {
  const reader = fixture();
  reader.owner.toggle();
  assert.equal(reader.owner.startPending(), true);
  assert.deepEqual(reader.events, ['cancel auto', 'begin capsule', 'probe']);
  reader.replaceSelection();
  reader.owner.cancelPending();
  reader.finishAvailability();
  await turn();
  assert.equal(reader.owner.startPending(), false);
  assert.deepEqual(reader.events, ['cancel auto', 'begin capsule', 'probe']);
});

test('partial entry completes before audio dispatch and fallback waits for real speech ACK', async () => {
  const reader = fixture();
  await reader.ready();
  reader.setPartialPage();
  reader.owner.toggle();
  assert.equal(reader.owner.startPending(), true);
  assert.deepEqual(reader.events, ['cancel auto', 'begin capsule', 'expand']);
  reader.finishHydration();
  await turn();
  assert.equal(reader.owner.startPending(), false);
  assert.deepEqual(reader.events, [
    'cancel auto', 'begin capsule', 'expand', 'cancel auto', 'stop auto', 'desired true', 'read timing', 'start 2 true',
  ]);
  reader.started.complete();
  await turn();
  assert.equal(reader.events.at(-1), 'observe start');
  reader.audio.complete(true);
  await turn();
  assert.equal(reader.events.at(-1), 'show static');
});

test('an unconfirmed or replaced pause cannot acknowledge the prior capsule', async () => {
  const awaitingAck = fixture();
  await awaitingAck.ready();
  awaitingAck.setState({ ...createReaderTtsState(true), status: 'playing', sessionGeneration: 2 });
  awaitingAck.owner.toggle();
  awaitingAck.paused.complete();
  await turn();
  assert.deepEqual(awaitingAck.events, ['cancel auto', 'pause']);
  const inactive = fixture();
  await inactive.ready();
  inactive.setState({ ...createReaderTtsState(true), status: 'playing', sessionGeneration: 2 });
  inactive.owner.toggle();
  inactive.clearCoordinator();
  inactive.confirmPause();
  await turn();
  assert.deepEqual(inactive.events, ['cancel auto', 'pause']);
  const current = fixture();
  await current.ready();
  current.setState({ ...createReaderTtsState(true), status: 'playing', sessionGeneration: 2 });
  current.owner.toggle();
  current.confirmPause();
  await turn();
  assert.deepEqual(current.events, ['cancel auto', 'pause', 'confirmed pause']);
});

test('a resumed fallback remains pending until a current audible callback', async () => {
  const reader = fixture();
  await reader.ready();
  const state = { ...createReaderTtsState(true), sessionGeneration: 2 };
  reader.setState({ ...state, status: 'paused' });
  reader.owner.toggle();
  assert.deepEqual(reader.events, ['cancel auto', 'stop auto', 'resume capsule', 'resume']);
  assert.equal(reader.owner.acknowledgeResume({ ...state, status: 'playing', audioStarted: false }, () => true), undefined);
  assert.equal(reader.owner.acknowledgeResume({ ...state, status: 'playing', audioStarted: true }, () => true), reader.presentation);
  assert.equal(reader.owner.acknowledgeResume({ ...state, status: 'playing', audioStarted: true }, () => true), undefined);
});

test('next speech chapter holds its lease across catalog and body reads, selecting only on admission', async () => {
  const window = new ReadingChapterWindow();
  window.configure('source', 'book', [0, 1]);
  window.setCurrent(chapter());
  const events: string[] = [];
  let valid = true;
  const catalog = deferred<void>();
  const content = deferred<ReadingSessionChapter>();
  const host = {
    capture: () => ({ current: () => valid, select: (target: number, range?: { charStart: number; charEnd: number }) => {
      events.push(`select ${target} ${range?.charStart}:${range?.charEnd}`);
      return range !== undefined;
    } }),
    hydrateCatalogIfNeeded: () => { events.push('catalog'); return catalog.result; },
    nextChapterIndex: () => 1,
    load: (target: number) => { events.push(`load ${target}`); return content.result; },
    admit: (loaded: ReadingSessionChapter) => { events.push(`admit ${loaded.contentVersion}`); },
    chapterRef: (loaded: ReadingSessionChapter) => loaded,
  };
  const staleRead = loadNextReaderTtsChapter(window, host);
  valid = false;
  catalog.complete();
  assert.equal(await staleRead, undefined);
  assert.deepEqual(events, ['catalog']);
  valid = true;
  const staleBody = loadNextReaderTtsChapter(window, host);
  await turn();
  assert.deepEqual(events, ['catalog', 'catalog', 'load 1']);
  valid = false;
  content.complete(chapter(1));
  assert.equal(await staleBody, undefined);
  assert.equal(window.get(1), undefined);
  valid = true;
  const next = await loadNextReaderTtsChapter(window, host);
  assert.deepEqual(events, ['catalog', 'catalog', 'load 1', 'catalog', 'load 1', 'admit version']);
  assert.equal(window.get(1)?.chapterIndex, 1);
  valid = false;
  assert.equal(next?.onAdmitted?.({ charStart: 2, charEnd: 5 }), false);
  assert.equal(events.at(-1), 'admit version');
  valid = true;
  assert.equal(next?.onAdmitted?.({ charStart: 2, charEnd: 5 }), true);
  assert.equal(events.at(-1), 'select 1 2:5');
});

test('paged speech follow reads a prepared neighbour only after the current index is known', () => {
  const target: ReaderTtsFollowTarget = {
    lifecycleToken: 1, generation: 1, sessionGeneration: 1, positionGeneration: 1, utteranceGeneration: 1,
    sourceId: 'source', bookId: 'book', chapterIndex: 0, chapterKey: 'chapter', contentVersion: 'version',
    scalar: 16, allowBackward: false,
  };
  const key = { sourceId: 'source', bookId: 'book', chapterIndex: 0, contentVersion: 'version', layoutSignature: 'layout' };
  const firstPage = { key, pageIndex: 0, startScalar: 0, endScalarExclusive: 10 };
  const read: string[] = [];
  const neighbor = (direction: string) => { read.push(direction); return { chapterIndex: 0, startScalar: 10, endScalar: 20 }; };
  assert.equal(planReaderTtsFollowPage(target, 0, undefined, undefined, neighbor).action, 'wait');
  assert.equal(planReaderTtsFollowPage(target, 0, firstPage, firstPage, neighbor).action, 'aligned');
  assert.deepEqual(read, []);
  assert.equal(planReaderTtsFollowPage(target, 0, firstPage, undefined, neighbor).action, 'turn');
  assert.deepEqual(read, ['next']);
  assert.equal(planReaderTtsFollowPage({ ...target, allowBackward: true }, 0, firstPage, undefined, neighbor).action, 'position');
});
