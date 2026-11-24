import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import {
  ReaderControlPlacement, readerControlAlignment, readerControlDockLeft, readerHoldingHand,
} from '../entry/src/main/ets/features/reading/ui/ReaderControlPlacement.ts';

const cases = {
  'pane-dock': {
    description: 'Measure the whole dock against its pane; compact panes remain centered and wide panes clamp to their safe edges.',
    resources: [],
  },
  'grip-settle': {
    description: 'Stable holding-hand samples update the group only after the debounce and the current input lease settles.',
    resources: [],
  },
  'grip-port': {
    description: 'The actual platform adapter does not register on unsupported devices and retires exact native callbacks.',
    resources: [],
  },
  'dock-owner': {
    description: 'The production dock adapter keeps visual and touch geometry together, freezes across interactions, and retires on a narrow pane.',
    resources: [],
  },
  'pane-owners': {
    description: 'Production settings and reading use the measured pane before window hints; the shelf retains one List and Scroller across its breakpoint.',
    resources: [],
  },
  'placement-durability': {
    description: 'The Preference owner distinguishes a pre-write rejection from an uncertain put/flush and retries only the original alignment generation.',
    resources: [],
  },
};

for (const id of selectContractCases(cases)) {
  if (id === 'pane-dock') {
    assert.equal(readerControlAlignment(undefined), 'center');
    assert.equal(readerControlAlignment('stale-value'), 'center');
    assert.equal(readerControlAlignment('left'), 'left');
    assert.equal(readerControlDockLeft(480, 350, 16, 16, 'right'), 65);
    assert.equal(readerControlDockLeft(860, 720, 30, 24, 'left'), 30);
    assert.equal(readerControlDockLeft(860, 720, 30, 24, 'center'), 70);
    assert.equal(readerControlDockLeft(860, 720, 30, 24, 'right'), 116);
    assert.equal(readerControlDockLeft(600, 580, 50, 50, 'left'), 10);
    assert.equal(readerControlDockLeft(0, 0, 0, 0, 'right'), 0);
  } else if (id === 'grip-settle') {
    const placement = new ReaderControlPlacement();
    assert.deepEqual(placement.update('center', readerHoldingHand(0), false, 0),
      { alignment: 'center', settleInMs: 0 });
    assert.equal(placement.update('center', readerHoldingHand(1), false, 100).alignment, 'center');
    assert.equal(placement.update('center', readerHoldingHand(2), false, 180).alignment, 'center');
    assert.deepEqual(placement.update('center', 'right', false, 419),
      { alignment: 'center', settleInMs: 1 });
    assert.deepEqual(placement.update('center', 'right', true, 420),
      { alignment: 'center', settleInMs: 0 });
    assert.equal(placement.update('center', 'right', true, 700).alignment, 'center');
    assert.equal(placement.update('center', 'right', false, 700).alignment, 'right');
    assert.equal(placement.update('left', readerHoldingHand(3), true, 800).alignment, 'right');
    assert.equal(placement.update('left', readerHoldingHand(16), true, 1050).alignment, 'right');
    assert.equal(placement.update('left', undefined, false, 1050).alignment, 'left');
    assert.equal(placement.update('right', undefined, true, 1100).alignment, 'left');
    assert.equal(placement.update('right', undefined, false, 1100).alignment, 'right');
  } else if (id === 'grip-port') {
    await gripPort();
  } else if (id === 'dock-owner') {
    await dockOwner();
  } else if (id === 'pane-owners') {
    await paneOwners();
  } else {
    await placementDurability();
    await placementRecoveryRoute();
  }
  recordContractCasePass(id);
}

async function gripPort() {
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const source = new URL('../entry/src/main/ets/platform/interaction/HarmonyReaderGrip.ets', import.meta.url);
  let enabled = false, rejected = true, callback, removed, attempts = 0;
  const received = [];
  const { subscribeReaderHoldingHand } = pureModuleProbe(readFileSync(source, 'utf8'), 'HarmonyReaderGrip.ets', {
    readerHarmonyCapabilities: () => ({ grip: enabled }), readerHoldingHand,
    motion: {
      on: (type, listener) => {
        assert.equal(type, 'holdingHandChanged');
        attempts += 1;
        if (rejected) throw new Error('unsupported hardware or denied permission');
        callback = listener;
      },
      off: (type, listener) => { assert.equal(type, 'holdingHandChanged'); removed = listener; },
    },
  }, ['subscribeReaderHoldingHand']);
  assert.equal(subscribeReaderHoldingHand(value => received.push(value)), undefined);
  assert.equal(attempts, 0);
  enabled = true;
  assert.equal(subscribeReaderHoldingHand(value => received.push(value)), undefined);
  assert.equal(attempts, 1);
  rejected = false;
  const release = subscribeReaderHoldingHand(value => received.push(value));
  callback(1);
  callback(3);
  assert.deepEqual(received, ['left', undefined]);
  release();
  assert.equal(removed, callback);
  callback(2);
  assert.deepEqual(received, ['left', undefined]);
}

async function dockOwner() {
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const source = new URL('../entry/src/main/ets/features/reading/ui/ReaderControlPanel.ets', import.meta.url);
  let now = 100, handListener, timeout, unbound = 0;
  const TouchType = { Down: 0, Up: 1, Move: 2, Cancel: 3 };
  const Panel = productionMotionMethods(source, ['refreshDockPlacement', 'syncGripSubscription',
    'retireDockPlacement', 'onDockPlacementTouch', 'dockLeft'], {
    readerControlAlignment, readerControlDockLeft, TouchType,
    readerMotionNowMs: () => now,
    subscribeReaderHoldingHand: listener => { handListener = listener; return () => unbound += 1; },
    setTimeout: (callback, delay) => { timeout = { callback, delay }; return 1; },
    clearTimeout: () => { timeout = undefined; },
  });
  const layout = { viewportWidth: 900, fullPanelWidth: 720, fullPanelLeftGap: 26, fullPanelRightGap: 14 };
  const seenX = [];
  const panel = Object.assign(new Panel(), {
    placement: new ReaderControlPlacement(), placementPointers: new Set(), placementTimer: -1,
    runtimeMounted: true, inputEnabled: true, gripForeground: true, gripRequested: false, controlObscured: false,
    bodySelectionPossible: false, manualControlAlignment: 'center', dockAlignment: 'center',
    visualHeldPointerId: -1, visualTransitionKind: '', progressPreviewPercent: -1, brightnessDragging: false,
    moreMenuVisible: false, temporaryLayerKind: '', rootScreenX: 50, dockRect: { x: 140 },
    currentLayout: () => layout, isExpanded: () => layout.viewportWidth >= 600,
    reportBackdropRegions() { seenX.push(this.dockRect.x); }, editingHost: { refresh() {} },
  });
  panel.refreshDockPlacement();
  assert.equal(panel.dockLeft(), 90);
  assert.equal(typeof handListener, 'function');
  handListener('right');
  assert.equal(timeout.delay, 240);
  panel.onDockPlacementTouch({ type: TouchType.Down, changedTouches: [{ id: 7 }] });
  assert.equal(timeout, undefined);
  now = 500;
  panel.temporaryLayerKind = 'modal';
  panel.onDockPlacementTouch({ type: TouchType.Up, changedTouches: [{ id: 7 }] });
  assert.equal(panel.dockLeft(), 90);
  panel.temporaryLayerKind = '';
  panel.bodySelectionPossible = true;
  panel.refreshDockPlacement();
  assert.equal(panel.dockLeft(), 90);
  panel.bodySelectionPossible = false;
  panel.refreshDockPlacement();
  assert.equal(panel.dockLeft(), 166);
  assert.deepEqual(seenX, [216], 'the newly painted dock and backdrop exclusion share the moved origin');
  layout.viewportWidth = 430;
  layout.fullPanelWidth = 350;
  panel.refreshDockPlacement();
  assert.equal(panel.dockLeft(), 40);
  assert.equal(panel.dockAlignment, 'center');
  assert.equal(unbound, 1);
  panel.retireDockPlacement();
  assert.equal(unbound, 1);
}

async function paneOwners() {
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { actualReaderPageLayout } = await import('./lib/reader-page-shell-runtime-probe.mjs');
  const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
  const { readerIsExpandedWidth, readerWidthClassWithHint } = await import('../entry/src/main/ets/ui/foundation/ReaderWidthClass.ts');
  const source = path => new URL('../entry/src/main/ets/features/' + path, import.meta.url);
  const { readerPageAreaLength } = actualReaderPageLayout();
  const Settings = productionMotionMethods(source('settings/ui/SettingsPage.ets'),
    ['recordShellArea', 'paneExpanded'], { readerWidthClassWithHint });
  const settings = Object.assign(new Settings(), { paneWidth: 0, expandedLayout: true });
  const SettingsShell = productionMotionMethods(source('settings/ui/SettingsShell.ets'), ['reportOverlayOrigin'], { readerPageAreaLength });
  const shell = Object.assign(new SettingsShell(), { onOverlayOriginChange: settings.recordShellArea.bind(settings) });
  assert.equal(settings.paneExpanded(), true);
  shell.reportOverlayOrigin({ width: '460vp', globalPosition: { x: '127vp', y: 24 } });
  assert.equal(settings.paneExpanded(), false);
  assert.deepEqual([settings.originX, settings.originY], [127, 24]);
  shell.reportOverlayOrigin({ width: 740, globalPosition: { x: 0, y: 24 } });
  assert.equal(settings.paneExpanded(), true);

  const windowRect = { width: 1024, height: 840 };
  const Reading = productionMotionMethods(source('reading/ui/LocalReadingExperience.ets'), ['admitInitialWindowGeometry'],
    { ReaderWindowCoordinator: { metrics: () => ({ ready: true, windowRect }) } });
  const reading = Object.assign(new Reading(), { paneWidthHint: 460, paneHeightHint: 520 });
  reading.admitInitialWindowGeometry();
  assert.deepEqual([reading.viewportWidth, reading.viewportHeight], [460, 520]);

  const sdk = boundedSurfaceSdk();
  const syntax = createRequire(import.meta.url)(resolveEtsLoaderRoot() + '/lib/validate_ui_syntax.js');
  syntax.componentCollection.customComponents.add('BookshelfSectionHeader');
  class SectionHeaderPort {
    constructor(_owner, params) { Object.assign(this, params); }
    updateStateVars(params) { Object.assign(this, params); }
    initialRender() {}
  }
  const shelfSource = source('bookshelf/ui/BookshelfPage.ets');
  const { owner: shelf } = createReaderBuilderProbe(readFileSync(shelfSource, 'utf8'),
    ['shelfPane', 'bookshelfList', 'shelfPaneFrame', 'recordShelfPane', 'effectiveViewportWidth', 'isWideViewport'],
    { ...sdk.deps, readerPageAreaLength, readerIsExpandedWidth, readerMainViewport: () => windowRect,
      BookshelfSectionHeader: SectionHeaderPort, readerScrollStartOffset: layout => layout.startInset,
      readerScrollEndOffset: layout => layout.endInset,
      LazyForEach: { create() {}, pop() {} }, ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} } }, sdk.hooks);
  const scroller = {};
  const frames = [];
  Object.assign(shelf, { paneWidth: 0, readerWindowMetricsRevision: 1, mainViewportRevision: 1,
    shelfScroller: scroller, continueReading: undefined, visibleBookCount: 1, rowDataSource: {},
    phoneContentFrame: () => ({ left: 16, right: 16 }), tabletContentFrame: () => ({ left: 24, right: 24 }),
    shelfContentWidth: expanded => shelf.effectiveViewportWidth() - (expanded ? 48 : 32),
    scheduleContinueCardMeasurement: () => frames.push(shelf.paneWidth),
    scrollLayout: () => ({ startInset: 74, endInset: 24 }), hasActiveFilters: () => false,
    viewModeAction: () => () => {}, filterPanel() {}, shelfFirstItemPadding: () => 12,
    shelfViewportMotionId: () => 'shelf-pane-test', shelfScrollHandler: () => () => {}, shelfPageHandler: () => () => {},
    shelfViewportScrollHandler: () => () => {}, restoreShelfViewport() {} });
  shelf.recordShelfPane({ width: '460vp', height: 520, globalPosition: { x: 127, y: 24 } });
  shelf.shelfPane();
  const list = sdk.nodes(shelf).find(node => node.type === 'List');
  const items = sdk.nodes(shelf).filter(node => node.type === 'ListItem');
  assert.ok(list);
  assert.equal(list.width, 428);
  shelf.recordShelfPane({ width: 788, height: 600, globalPosition: { x: 0, y: 24 } });
  shelf.replay();
  assert.deepEqual(frames, [460, 788]);
  assert.equal(list.width, 740);
  assert.equal(list.create.scroller, scroller);
  assert.equal(list.maintainVisibleContentPosition, true);
  assert.equal(sdk.nodes(shelf).find(node => node.type === 'List'), list);
  assert.deepEqual(sdk.nodes(shelf).filter(node => node.type === 'ListItem'), items);
}

async function placementDurability() {
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { readerHostPreferencesName } = await import('../entry/src/main/ets/app/diagnostics/ReaderPublicFixtureScope.ts');
  const source = new URL('../entry/src/main/ets/app/ReaderControlPlacementPreferences.ts', import.meta.url);
  const storage = new Map();
  const writes = [];
  let fault = 'open', persisted = 'center', staged = 'center', current = true;
  const store = {
    get: async () => persisted,
    put: async (key, value) => {
      assert.equal(key, 'alignment');
      writes.push(value);
      staged = value;
      if (fault === 'put') throw new Error('put outcome unavailable');
    },
    flush: async () => {
      if (fault === 'flush') throw new Error('flush outcome unavailable');
      persisted = staged;
    },
  };
  const { ReaderControlPlacementPreferences: owner } = pureModuleProbe(readFileSync(source, 'utf8'),
    'ReaderControlPlacementPreferences.ts', {
      readerControlAlignment, readerHostPreferencesName,
      preferences: { getPreferences: async (_context, name) => {
        assert.equal(name, 'reader_control_placement_v1');
        if (fault === 'open') throw new Error('store unavailable');
        return store;
      } },
      AppStorage: { setOrCreate: (key, value) => storage.set(key, value) },
    }, ['ReaderControlPlacementPreferences']);
  const context = { filesDir: '/data/storage/el2/base/haps/entry/files' };
  const active = () => current;
  await assert.rejects(owner.install(context, active), /store unavailable/);
  assert.equal(await owner.select('right', active), 'notDispatched');
  assert.equal(storage.get('readerControlPlacementPendingGeneration'), 0);
  assert.deepEqual(writes, []);
  fault = 'flush';
  assert.equal(await owner.select('left', active), 'pending');
  const original = storage.get('readerControlPlacementPendingGeneration');
  assert.ok(original > 0);
  assert.equal(storage.get('readerControlAlignment'), 'center');
  assert.equal(await owner.select('right', active), 'ignored');
  assert.equal(await owner.retry(original + 1, active), 'ignored');
  assert.equal(await owner.retry(original, () => false), 'ignored');
  assert.deepEqual(writes, ['left']);
  fault = 'put';
  assert.equal(await owner.retry(original, active), 'pending');
  assert.equal(storage.get('readerControlPlacementPendingGeneration'), original);
  fault = '';
  assert.equal(await owner.retry(original, active), 'confirmed');
  assert.equal(storage.get('readerControlAlignment'), 'left');
  assert.equal(storage.get('readerControlPlacementPendingGeneration'), 0);
  assert.equal(persisted, 'left');
  assert.equal(await owner.retry(original, active), 'ignored');
  assert.deepEqual(writes, ['left', 'left', 'left']);
  current = false;
  assert.equal(await owner.select('right', active), 'ignored');
}

async function placementRecoveryRoute() {
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const file = new URL('../entry/src/main/ets/features/settings/ui/SettingsPage.ets', import.meta.url);
  const calls = [];
  const Page = productionMotionMethods(file, ['capturedPendingAction', 'controlPlacementHostIdentity',
    'controlPlacementCurrent', 'retryControlPlacement', 'hasPendingControlPlacement'], {
    ReaderControlPlacementPreferences: { retry: async (generation, current) => { calls.push({ generation, current }); } },
  });
  const page = Object.assign(new Page(), { temporaryBackIdentity: 'settings-opening', navigationGeneration: 8,
    controlPlacementPending: 12, controlPlacementSaving: false, settingsInputIsCurrent: () => true,
    settingsNavigationCurrent: () => true, developerPageId: '', openSelect: '' });
  const ticket = () => JSON.stringify([page.controlPlacementHostIdentity(), `${page.controlPlacementPending}`]);
  const oldRoute = ticket();
  page.navigationGeneration += 1;
  page.retryControlPlacement(oldRoute, 12);
  page.retryControlPlacement(ticket(), 11);
  assert.deepEqual(calls, []);
  const current = ticket();
  page.openSelect = 'language';
  assert.equal(page.hasPendingControlPlacement(), false);
  page.retryControlPlacement(current, 12);
  assert.deepEqual(calls, []);
  page.openSelect = '';
  assert.equal(page.hasPendingControlPlacement(), true);
  page.retryControlPlacement(current, 12);
  page.retryControlPlacement(current, 12);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].generation, 12);
  assert.equal(calls[0].current(), true);
  page.controlPlacementPending = 13;
  assert.equal(calls[0].current(), false, 'the queue cannot dispatch a retired original generation');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.controlPlacementSaving, false);
}
