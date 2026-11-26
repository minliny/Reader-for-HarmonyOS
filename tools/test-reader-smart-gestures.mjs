import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectedProductionClasses, selectedProductionMethods, selectedProductionValues } from './lib/selected-production-methods.mjs';
import {
  DEFAULT_READER_SMART_GESTURES, normalizeReaderSmartGestureSettings, readerSmartGestureAction,
} from '../entry/src/main/ets/features/reading/application/ReaderSmartGesturePolicy.ts';

const reading = {
  foreground: true, controlsOpen: false, directoryOpen: false, sourceSwitchOpen: false, settingsOpen: false,
  dialogOpen: false, selectionActive: false, zoomed: false, chapterLoading: false, sourceSwitching: false,
  continuous: false,
};
const enabled = { enabled: true, tapAction: 'next' };
const gestures = ['slideForward', 'tap', 'backPress'];

test('smart gestures default off and keep an explicit valid tap action', () => {
  assert.deepEqual(DEFAULT_READER_SMART_GESTURES, { enabled: false, tapAction: 'next' });
  assert.deepEqual(normalizeReaderSmartGestureSettings(true, 'broken'), enabled);
  assert.deepEqual(normalizeReaderSmartGestureSettings(false, 'none'), { enabled: false, tapAction: 'none' });
  assert.equal(readerSmartGestureAction('slideForward', DEFAULT_READER_SMART_GESTURES, reading), 'pass');
});

test('admitted gestures use the paging, scroll, control and Back actions', () => {
  assert.equal(readerSmartGestureAction('slideForward', enabled, reading), 'pageNext');
  assert.equal(readerSmartGestureAction('slideForward', enabled, { ...reading, continuous: true }), 'scrollNext');
  assert.equal(readerSmartGestureAction('tap', enabled, reading), 'pageNext');
  assert.equal(readerSmartGestureAction('tap', enabled, { ...reading, continuous: true }), 'scrollNext');
  assert.equal(readerSmartGestureAction('tap', { ...enabled, tapAction: 'toggleControls' }, reading), 'toggleControls');
  assert.equal(readerSmartGestureAction('tap', { ...enabled, tapAction: 'none' }, reading), 'block');
  assert.equal(readerSmartGestureAction('backPress', enabled, reading), 'back');
});

test('each blocked reader state consumes every recognized gesture without business dispatch', () => {
  for (const boundary of [{ foreground: false }, { controlsOpen: true }, { directoryOpen: true }, { sourceSwitchOpen: true },
    { settingsOpen: true }, { dialogOpen: true }, { selectionActive: true }, { zoomed: true },
    { chapterLoading: true }, { sourceSwitching: true }]) {
    for (const gesture of gestures) {
      assert.equal(readerSmartGestureAction(gesture, enabled, { ...reading, ...boundary }), 'block',
        `${Object.keys(boundary)[0]} blocks ${gesture}`);
    }
  }
});

test('a novel chapter jump admits page, scroll and Back gestures when the selected page becomes visible', () => {
  const Experience = selectedProductionMethods(new URL(
    '../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url), 'ReadingExperience', [
    'smartGestureDecision', 'dispatchSmartGesture', 'shouldShowChapterLoading', 'shouldShowSourceSwitchPreparation',
  ], {
    readerSmartGestureAction,
    readerControlContentLocation: () => ({ level: 'closed' }),
    ReaderNativeAlertWindow: { isPresented: () => false },
    READER_SMART_GESTURE_VIEWPORT_FRACTION: 0.75,
  });
  const actions = [];
  const owner = Object.assign(new Experience(), {
    phase: 'ready', windowChromeActive: true, sourceSwitchFailureMessage: '',
    visiblePage: {}, visiblePageSelectionToken: 1, chapterSelectionToken: 2, loadingChapterIndex: 9,
    readerInputIsCurrent: () => true, controlVisible: () => false,
    textSelectionActivity: { active: () => false }, readerRecoveryRequestCurrent: () => false,
    pageTurnOwnsReaderInput: () => false, controlTemporaryLayer: '', smartGestureSettings: enabled,
    readerSettingsSnapshot: { navigationMode: 'paged' },
    requestPageTurn: direction => actions.push(['page', direction]),
    requestExit: () => actions.push(['back']),
    onReaderManualInteraction: () => actions.push(['manual']),
    performContinuousPageTurn: (direction, fraction) => actions.push(['scroll', direction, fraction]),
  });
  for (const gesture of gestures) {
    assert.equal(owner.smartGestureDecision(gesture), 'block');
    owner.dispatchSmartGesture(owner.smartGestureDecision(gesture));
  }
  assert.deepEqual(actions, []);

  owner.visiblePageSelectionToken = 2;
  owner.dispatchSmartGesture(owner.smartGestureDecision('slideForward'));
  owner.readerSettingsSnapshot.navigationMode = 'continuous';
  owner.dispatchSmartGesture(owner.smartGestureDecision('tap'));
  owner.dispatchSmartGesture(owner.smartGestureDecision('backPress'));
  assert.deepEqual(actions, [['page', 'next'], ['manual'], ['scroll', 'next', 0.75], ['back']]);
});

test('reset retires the old loading title and a directory selection installs only its own index', () => {
  const Experience = selectedProductionMethods(new URL(
    '../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url), 'ReadingExperience', [
    'onRequestedChapterChanged', 'resetForChapterSelection',
  ]);
  const opens = [];
  const resetHelpers = [
    'showReaderRecovery', 'invalidatePageTurnRuntime', 'clearContinuousRenderProjection', 'resetPendingPage',
    'resetPaginationDraft', 'cancelMeasurementDeadline', 'cancelFirstPageReadyDeadline',
    'cancelFirstPageCompletionDeadline', 'cancelPageTurnPreparationRetry', 'clearTtsChapterEndTimer',
    'armFirstPageReadyDeadline',
  ];
  const owner = Object.assign(new Experience(), Object.fromEntries(resetHelpers.map(name => [name, () => {}])), {
    mounted: true, lifecycleToken: 1, chapterSelectionToken: 4, loadingChapterIndex: 7, sessionGateway: {},
    transientFeedback: { reset() {} }, physicalPagination: { index: { invalidateMeasurement() {} } },
    nativeTextMeasurement: { clear() {} }, paragraphLayout: { batch: [], ranges: [] },
    continuousImageResolutions: new Map(), chapterImageByStartScalar: new Map(), chapterImagePositionByKey: new Map(),
    openChapter: (...args) => opens.push(args),
  });
  owner.resetForChapterSelection();
  assert.equal(owner.loadingChapterIndex, undefined);
  for (const chapterIndex of [9, 11]) {
    owner.requestedChapterIndex = chapterIndex;
    owner.onRequestedChapterChanged();
    assert.equal(owner.loadingChapterIndex, chapterIndex);
  }
  assert.deepEqual(opens, [[9, false, 1, 5], [11, false, 1, 6]]);
});

function nativeMonitor(admitted = true) {
  const calls = [];
  const { HarmonySmartGestureHost } = selectedProductionClasses(new URL(
    '../entry/src/main/ets/platform/interaction/HarmonySmartGestureHost.ets', import.meta.url), ['HarmonySmartGestureHost'], {
    readerHarmonyCapabilities: () => ({ api26: admitted }),
    deviceInfo: { distributionOSApiVersion: admitted ? 260000 : 60101, apiAvailable: () => true },
    OperateIntention: { TAP: 0, SLIDE_FORWARD: 1, BACK_PRESS: 2 },
    GestureHandlingResolution: class { constructor(isConsumed) { this.isConsumed = isConsumed; } },
    NoneActionProposal: class {},
  });
  const actions = [];
  let capable = { ...reading };
  const controller = {
    enableSmartTapAndSlideGestures: value => calls.push(value),
    registerMonitor: monitor => calls.push(monitor),
    unregisterMonitor: monitor => calls.push(monitor),
  };
  const context = { getSmartGestureController: () => controller };
  const callbacks = {
    decide: gesture => readerSmartGestureAction(gesture, enabled, capable),
    dispatch: action => actions.push(action),
  };
  return { HarmonySmartGestureHost, context, callbacks, calls, actions,
    update: value => { capable = { ...reading, ...value }; } };
}

test('API 23/24 skip native attachment; guarded, blocked and retired callbacks reach the correct owner', async () => {
  const unsupported = nativeMonitor(false);
  new unsupported.HarmonySmartGestureHost().attach(unsupported.context, unsupported.callbacks);
  assert.deepEqual(unsupported.calls, []);

  const fixture = nativeMonitor();
  const owner = new fixture.HarmonySmartGestureHost();
  owner.attach(fixture.context, fixture.callbacks);
  owner.attach(fixture.context, fixture.callbacks);
  assert.equal(fixture.calls.length, 2);
  const monitor = fixture.calls[1];
  fixture.update({ dialogOpen: true });
  assert.equal(monitor({ operateIntention: 2 }).isConsumed, true);
  assert.equal(monitor({ operateIntention: 2 }).selectedProposal.constructor.name, 'NoneActionProposal');
  fixture.update({ continuous: true });
  assert.equal(monitor({ operateIntention: 1 }).isConsumed, true);
  await Promise.resolve();
  assert.deepEqual(fixture.actions, ['scrollNext']);
  monitor({ operateIntention: 0 });
  fixture.update({ chapterLoading: true });
  await Promise.resolve();
  assert.deepEqual(fixture.actions, ['scrollNext']);
  fixture.update({});
  monitor({ operateIntention: 0 });
  owner.detach();
  owner.detach();
  await Promise.resolve();
  assert.deepEqual(fixture.actions, ['scrollNext']);
  assert.deepEqual(fixture.calls, [true, monitor, monitor, false]);
  assert.equal(monitor({ operateIntention: 2 }).isConsumed, false);
});

test('an overlapping reader retires its predecessor before enabling its own controller', () => {
  const fixture = nativeMonitor();
  const previous = new fixture.HarmonySmartGestureHost(), current = new fixture.HarmonySmartGestureHost();
  previous.attach(fixture.context, fixture.callbacks);
  const oldMonitor = fixture.calls[1];
  current.attach(fixture.context, fixture.callbacks);
  const newMonitor = fixture.calls[5];
  previous.detach();
  assert.deepEqual(fixture.calls, [true, oldMonitor, oldMonitor, false, true, newMonitor]);
  current.detach();
  assert.deepEqual(fixture.calls.slice(-2), [newMonitor, false]);
});

test('destroying a retired ability leaves the successor gesture monitor and preferences alone', async () => {
  const fixture = nativeMonitor(), operations = [];
  new fixture.HarmonySmartGestureHost().attach(fixture.context, fixture.callbacks);
  const monitor = fixture.calls[1];
  const current = { release: async () => { operations.push('release'); } };
  const Entry = selectedProductionMethods(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url),
    'EntryAbility', ['onDestroy'], {
      HarmonySmartGestureHost: fixture.HarmonySmartGestureHost,
      ReaderSmartGesturePreferences: { detach: () => operations.push('preferences') },
      ReaderRuntimeOwner: { isCurrent: owner => owner === current },
      ReaderThemeHost: { detach() {} }, ReaderNavigationAppearancePreferences: { detach() {} },
      ReaderWindowCoordinator: { destroyWindow: () => operations.push('window') },
      AppStorage: { setOrCreate() {} }, ReaderDocumentPickerActivity: { setForeground() {} },
      ReaderSystemFileOpenHost: { detach() {} },
    });
  const old = Object.assign(new Entry(), { frameworkCapture: { close() {} }, runtimeOwner: { async release() {} } });
  old.onDestroy();
  assert.deepEqual(fixture.calls, [true, monitor]);
  assert.deepEqual(operations, ['window']);
  const owner = Object.assign(new Entry(), { frameworkCapture: { close() {} }, runtimeOwner: current });
  monitor({ operateIntention: 0 });
  owner.onDestroy();
  await Promise.resolve();
  assert.deepEqual(fixture.actions, [], 'queued native callbacks cannot dispatch across ability retirement');
  assert.deepEqual(fixture.calls, [true, monitor, monitor, false]);
  assert.deepEqual(operations, ['window', 'preferences', 'window', 'release']);
});

test('retiring gesture preferences prevents an earlier write from publishing over the next ability', async () => {
  let finishOld;
  let acceptOld;
  const loaded = [];
  const states = [];
  let value = '';
  const gate = new Promise(resolve => { finishOld = resolve; });
  const oldWriteStarted = new Promise(resolve => { acceptOld = resolve; });
  const file = new URL('../entry/src/main/ets/app/ReaderSmartGesturePreferences.ts', import.meta.url);
  const { ReaderSmartGesturePreferences: Preferences } = selectedProductionClasses(
    file, ['ReaderSmartGesturePreferences'], {
      ...selectedProductionValues(file, ['STATE_KEY', 'STORE_NAME', 'PREFERENCE_KEY']),
      preferences: { async getPreferences(context) {
        loaded.push(context.filesDir);
        return {
          async get() { return value; },
          async put(_key, next) {
            if (context.filesDir === 'old') { acceptOld(); await gate; }
            value = next;
          },
          async flush() {},
        };
      } },
      readerHostPreferencesName: (_directory, name) => name,
      AppStorage: { setOrCreate: (_key, state) => states.push(state) },
      DEFAULT_READER_SMART_GESTURES, normalizeReaderSmartGestureSettings,
    });
  Preferences.attach({ filesDir: 'old' });
  const writing = Preferences.select(enabled, () => true);
  await oldWriteStarted;
  Preferences.detach();
  Preferences.attach({ filesDir: 'new' });
  assert.deepEqual(loaded, ['old'], 'new preference reads wait for the admitted old write');
  assert.deepEqual(states, [DEFAULT_READER_SMART_GESTURES, DEFAULT_READER_SMART_GESTURES]);
  finishOld();
  await writing;
  const latestReset = Preferences.resetDefaults(() => true);
  await latestReset;
  assert.deepEqual(loaded, ['old', 'new']);
  assert.deepEqual(states, [DEFAULT_READER_SMART_GESTURES, DEFAULT_READER_SMART_GESTURES,
    enabled, DEFAULT_READER_SMART_GESTURES], 'the successor can publish only its own read and receipt');
  await assert.rejects(Preferences.resetDefaults(() => false), /PREFERENCES_RETIRED/);
});
