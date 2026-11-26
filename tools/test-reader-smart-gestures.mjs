import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectedProductionClasses } from './lib/selected-production-methods.mjs';
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
