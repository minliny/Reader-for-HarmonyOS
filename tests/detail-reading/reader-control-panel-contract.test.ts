import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultReaderControlIntent, ReaderControlFactDelivery,
} from '../../entry/src/main/ets/features/reading/ui/ReaderControlPanelContract.ts';
import type { ReaderControlPanelFacts, ReaderControlNativeFactDelivery } from
  '../../entry/src/main/ets/features/reading/ui/ReaderControlPanelNativeContract.ets';
import { ReaderControlRuntime } from '../../entry/src/main/ets/features/reading/ui/ReaderControlRuntime.ts';
import { readerControlHostInputEnabled } from '../../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts';
import { createDefaultReaderControlLayout } from '../../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts';
import {
  advanceReaderControlSession, createReaderControlSessionState, dismissReaderControlSession,
  enterReaderControlModule, openReaderControlSession, sampleReaderControlSession,
} from '../../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts';
import { ReaderControlMotionFrameCache } from
  '../../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts';
import {
  buildReaderSessionLaunchGeometry, sampleReaderSessionLaunch,
} from '../../entry/src/main/ets/features/reading/ui/ReaderSessionLaunchPresentation.ts';
import { createDefaultReaderAppearanceSnapshot } from
  '../../entry/src/main/ets/features/reading/application/ReaderAppearanceState.ts';
import { createDefaultReaderSettingsSnapshot } from
  '../../entry/src/main/ets/features/reading/application/ReaderSettingsState.ts';
import { createReaderTtsState } from '../../entry/src/main/ets/features/reading/application/ReaderTtsState.ts';
import type { ReaderControlFontOrderPresentation } from
  '../../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceContent.ets';
import { createReaderControlReplaceState } from
  '../../entry/src/main/ets/features/reading/presentation/ReaderControlReplaceState.ts';
import { EMPTY_READING_DIRECTORY_RECOVERY } from
  '../../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts';

function closedFacts(): ReaderControlPanelFacts {
  const tts = createReaderTtsState(false);
  return {
    geometry: {
      directSheet: true, fixedIsland: true, allowsTextSelection: true, fontScale: 1,
      theme: { ink: '#222222', muted: '#505050', primary: '#000000', panel: '#FFFFFF',
        panelSoft: '#F3F3F3', line: '#DADADA', lineStrong: '#AAAAAA' },
      layout: createDefaultReaderControlLayout(), reduceMotion: false, verification: undefined,
      inputEnabled: false, obscured: false, openRevision: 1,
      minimum: { receipt: undefined, preparedRequired: true, identity: 'before', committedIdentity: 'before',
        requestLocation: undefined, ownerKey: 'book', environmentKey: 'compact', key: 'before|min', ready: true,
        metricsRevision: 1 },
      temporary: { dismissRevision: 0, retireRevision: 0, layer: '' },
    },
    launch: {
      sample: undefined, generation: 2, sourceMinimum: undefined, sourceKind: 'quickAutoPage',
      ownsControls: false, topBarOffsetY: 0, dockOffsetY: 0, recovering: true,
    },
    document: {
      bookTitle: 'Book', chapterTitle: 'One', source: { id: 'local', bookId: 'book', name: 'Local' },
      progressPercent: 0, totalChapters: 1, readableChapterPosition: 0, chapterIndex: 0,
      bookmarks: { allowChapterStart: false, loadFailed: false, message: '', recovery: EMPTY_READING_DIRECTORY_RECOVERY,
        book: undefined, pageStatus: 'empty', pageEnabled: false },
      catalog: { publication: undefined, revision: 0, complete: true, loading: false,
        loadFailed: false, chapterCount: 1, position: 0, defaultEntries: [] },
      search: { query: '', revision: 0, manga: false,
        // The native-only stable publisher stays opaque to replay.
        publication: undefined as unknown as ReaderControlPanelFacts['document']['search']['publication'] },
      replace: createReaderControlReplaceState(), recovery: { available: false, identity: '' },
      download: { chapterEnabled: false, bookEnabled: false, bookActive: false }, allowChapterRefresh: false,
    },
    preferences: {
      brightness: { percent: 100, automatic: true, revision: 0 }, appearance: createDefaultReaderAppearanceSnapshot(),
      conversion: { identity: '', mode: 'none' }, settings: createDefaultReaderSettingsSnapshot(),
      widePageLayout: 'spread', pageTurnSimulationAvailable: true,
    },
    playback: {
      automatic: { status: 'stopped', speedSeconds: 8, timerMinutes: 15, timerSeconds: 0,
        timerSummary: '15:00', followHighlight: true },
      speech: { state: tts, timerMode: 'duration', timerMinutes: 25, timerSeconds: 0, followHighlight: true,
        pauseOnInterruption: true, allowMixing: false, backgroundPlayback: true, keepScreenOn: false,
        failurePolicy: 'stop', engine: 'system', httpEngines: [], configurationRecovery: {
          message: '', visible: false, canRetry: false, generation: 0,
        }, configurationLoading: false, configurationLoadFailed: false, voiceOptions: [],
        language: 'zh-CN', person: 0 },
    },
  };
}

test('directory dismissal leaves no opacity in the settled control dock or top bar', () => {
  const opened = openReaderControlSession(createReaderControlSessionState(), 0);
  const directory = enterReaderControlModule(opened, 'directory', 0);
  const dismissing = dismissReaderControlSession(directory, 240);
  const frameCache = new ReaderControlMotionFrameCache();
  const easingWithTail = (fraction: number) => Math.min(fraction, 0.99986);
  const nearEnd = advanceReaderControlSession(dismissing, 239.99, dismissing.epoch, easingWithTail);
  assert.ok(sampleReaderControlSession(nearEnd).visibilityProgress > 0);

  const settled = advanceReaderControlSession(nearEnd, 1, nearEnd.epoch, easingWithTail);
  const { visibilityProgress, expansionProgress } = sampleReaderControlSession(settled);
  const frame = frameCache.sample(visibilityProgress, expansionProgress, 320, 300, 28, 190, 0, undefined, 'home');
  assert.equal(settled.location.level, 'hidden');
  assert.equal(settled.transition, undefined);
  assert.equal(visibilityProgress, 0);
  assert.equal(expansionProgress, 0);
  assert.equal(frame.topBar.opacity, 0);
  assert.equal(frame.dock.opacity, 0);
});

test('control delivery keeps the intermediate disable that retires a real captured gesture', () => {
  const before = closedFacts();
  const after = { ...before, launch: { ...before.launch, recovering: false },
    geometry: { ...before.geometry, inputEnabled: true, openRevision: 2 } };
  const runtime = new ReaderControlRuntime({
    axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 400, hiddenGrabberScreenY: 810 },
    tapMaxDurationMs: 500, directionSlopVp: 8, settleDurationMs: 240,
  }, () => 10);
  runtime.start(openReaderControlSession(createReaderControlSessionState(), 0));
  runtime.down(17, 700, 10);
  const ticket = runtime.ticket();
  assert.equal(runtime.owner(), 17);
  const delivery: ReaderControlNativeFactDelivery = new ReaderControlFactDelivery();
  const updates: Array<[boolean, number]> = [];
  delivery.deliver(before, after, event => {
    const facts = delivery.active()!;
    if (event === 'runtimeInput') {
      const enabled = (facts.geometry.inputEnabled || facts.launch.recovering) && !facts.geometry.obscured;
      runtime.setEnabled(enabled);
      updates.push([enabled, facts.geometry.openRevision]);
    }
  });
  assert.deepEqual(updates, [[false, 1], [true, 1]]);
  assert.equal(runtime.owner(), -1);
  assert.ok(runtime.ticket() > ticket);
  assert.equal(delivery.active(), undefined);
});

test('covering open controls with the source picker suspends input and preserves the control location', () => {
  const runtime = new ReaderControlRuntime({
    axis: { quickGrabberScreenY: 700, fullGrabberScreenY: 400, hiddenGrabberScreenY: 810 },
    tapMaxDurationMs: 500, directionSlopVp: 8, settleDurationMs: 240,
  }, () => 10);
  const open = runtime.start(openReaderControlSession(createReaderControlSessionState(), 0)).session;
  assert.equal(open.location.level, 'home');
  const input = {
    mounted: true, exitRequested: false, appForeground: true, windowChromeActive: true,
    interactionBlocked: false, controlObscured: false,
  };

  const covered = runtime.setEnabled(readerControlHostInputEnabled({ ...input, interactionBlocked: true }));
  assert.deepEqual(covered.session, open);
  runtime.down(17, 700, 10);
  assert.equal(runtime.owner(), -1);

  const restored = runtime.setEnabled(readerControlHostInputEnabled(input));
  assert.deepEqual(restored.session, open);
  runtime.down(18, 700, 10);
  assert.equal(runtime.owner(), 18);
});

test('control delivery advances the launch witness, layout and reduced motion at their former reset boundaries', () => {
  const mountedBook = { libraryBookId: 'book', sourceId: 'old', bookId: 'source-book', bookName: 'Book', bookAuthor: '' };
  const initial = closedFacts();
  const before: ReaderControlPanelFacts = { ...initial, document: { ...initial.document,
    bookmarks: { ...initial.document.bookmarks, book: mountedBook } } };
  const geometry = buildReaderSessionLaunchGeometry({ source: { kind: 'quickTts', left: 10, top: 20,
    width: 290, height: 190, revision: 3 }, targetLeft: 60, targetTop: 130,
    dockExitDistance: 300, topBarExitDistance: 45, fixedIsland: true });
  assert.ok(geometry);
  const linear = (p: number): number => p;
  const sample = sampleReaderSessionLaunch(100, geometry, { flight: linear, expand: linear, easeOut: linear });
  const after: ReaderControlPanelFacts = {
    ...before, document: { ...before.document, bookmarks: { ...before.document.bookmarks,
      book: { ...mountedBook, sourceId: 'successor' } } },
    launch: { ...before.launch, sample, generation: 3, sourceKind: 'quickTts',
      sourceMinimum: { generation: 3, kind: 'quickTts', requiresNaturalProfile: false, receipt: undefined } },
    geometry: { ...before.geometry, reduceMotion: true, layout: createDefaultReaderControlLayout(),
      minimum: { ...before.geometry.minimum, environmentKey: 'expanded', metricsRevision: 2 },
      temporary: { ...before.geometry.temporary, dismissRevision: 1 } },
  };
  const delivery: ReaderControlNativeFactDelivery = new ReaderControlFactDelivery();
  const watched: unknown[][] = [];
  delivery.deliver(before, after, event => {
    const facts = delivery.active()!;
    assert.equal(facts.document.bookmarks.book, mountedBook);
    if (event === 'launch' || event === 'minimumMetrics') {
      watched.push([event, facts.launch.generation, facts.launch.sourceKind,
        facts.launch.sourceMinimum?.generation, facts.geometry.minimum.environmentKey,
        facts.geometry.minimum.metricsRevision]);
    } else {
      watched.push([event, facts.geometry.reduceMotion, facts.geometry.temporary.dismissRevision]);
    }
  });
  assert.deepEqual(watched, [
    ['launch', 2, 'quickAutoPage', undefined, 'compact', 1],
    ['launch', 3, 'quickAutoPage', undefined, 'compact', 1],
    ['launch', 3, 'quickAutoPage', 3, 'compact', 1],
    ['minimumMetrics', 3, 'quickTts', 3, 'expanded', 1],
    ['minimumMetrics', 3, 'quickTts', 3, 'expanded', 2],
    ['layout', false, 1],
    ['layout', true, 1],
  ]);
  assert.equal(before.launch.sample, undefined);
  assert.equal(before.geometry.reduceMotion, false);
});

test('unbound intents retain optional input, immediate decline and font plan, and asynchronous preview rejection', async () => {
  const declineCalls: string[] = [];
  assert.equal(defaultReaderControlIntent({ kind: 'inputCurrent' }), undefined);
  assert.equal(defaultReaderControlIntent({ kind: 'minimumReceiptCurrent', key: 'retired' }), undefined);
  defaultReaderControlIntent({ kind: 'autoPageFullSpeedChange', seconds: 9, onDeclined: () => declineCalls.push('auto') });
  defaultReaderControlIntent({ kind: 'ttsRateChange', rate: 1.5, onDeclined: () => declineCalls.push('voice') });
  assert.deepEqual(declineCalls, ['auto', 'voice']);
  const font = defaultReaderControlIntent({ kind: 'appearanceFontOrderChange', fontOrder: ['serif'] }) as
    ReaderControlFontOrderPresentation;
  assert.equal(font.current(), false);
  font.retire();
  assert.equal(await font.displayed, false);
  const preview = defaultReaderControlIntent({ kind: 'previewControlReplace' });
  assert.ok(preview instanceof Promise);
  await assert.rejects(preview, /当前章节预览尚未就绪/);
});
