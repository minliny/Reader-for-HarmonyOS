// Exact query-owner and authored-surface-transition checks. Real production
// methods, controlled clock/frame/focus ports; no native rendering or device.
import assert from 'node:assert/strict';
import { selectedProductionClasses, selectedProductionMethods } from '../../lib/selected-production-methods.mjs';
import { motionSegment } from '../../../entry/src/main/ets/features/common/MotionTimeline.ts';

const modelPath = new URL('../../../entry/src/main/ets/features/search/ReaderLibrarySearchModel.ets', import.meta.url);
const surfacePath = new URL('../../../entry/src/main/ets/features/search/ReaderLibrarySearchSurface.ets', import.meta.url);
const { ReaderLibrarySearchModel } = selectedProductionClasses(modelPath, ['ReaderLibrarySearchModel']);
const { SurfaceValueTrack } = selectedProductionClasses(surfacePath, ['SurfaceValueTrack']);
const model = new ReaderLibrarySearchModel();
let actions = 0;
model.claim(1); model.activate(1); model.onBack = () => actions++;
const oldToken = model.currentOwner();
model.claim(2); assert.equal(model.interactive, false); model.activate(2); model.onBack = () => actions += 10;
let draft = ''; model.onText = value => { draft = value; };
model.dispatchText(oldToken, '旧输入'); assert.equal(draft, '', 'old input cannot write the replacement query');
model.dispatchText(model.currentOwner(), '新输入'); assert.equal(draft, '新输入');
model.release(1); model.onBack();
assert.equal(actions, 10, 'old owner cannot remove a replacement owner');
assert.equal(model.owns(1), false); assert.equal(model.owns(2), true);
model.suspend(); assert.equal(model.interactive, false); model.release(2); model.onBack(); assert.equal(actions, 10, 'released owner has no live action');

const linear = { interpolate: fraction => fraction };
let now = 0;
class TestFrame { constructor(action) { this.action = action; } }
const methods = ['applyTargets', 'snapToMode', 'transitionFor', 'durationFor', 'modeChanged', 'identityChanged',
  'presentationChanged', 'metricsChanged', 'retargetHistoryViewport', 'schedule', 'completeTransition',
  'scheduleInputFocus', 'segment', 'transitionFraction', 'backFraction', 'surfaceProgress',
  'resultsProgress', 'historyProgress', 'chromeProgress', 'scrimProgress', 'setMeasuredFilterHeight', 'inputInteractive',
  'fieldIdentity', 'leadingAction', 'backAction', 'moreAction', 'focusAction', 'blend'];
const Surface = selectedProductionMethods(surfacePath, 'ReaderLibrarySearchSurface', methods,
  { readerMotionNowMs: () => now, LibrarySearchFrame: TestFrame, LibrarySearchFocusFrame: TestFrame, motionSegment });
const queue = [], settled = [], focuses = [], events = [];
let clearFocusCount = 0;
const surface = Object.assign(new Surface(), {
  mounted: true, generation: 0, scheduledToken: -1, mode: 'idle', currentMode: 'idle',
  identity: 7, navigationGeneration: 9, mounting: 3, measurementKey: 0,
  reduceMotion: false, searchMounted: false, elapsed: 0,
  transitionKind: 'none', transitionStartedMs: 0, transitionDurationMs: 0,
  fromSurface: 0, fromHistory: 0, fromResults: 0, fromChrome: 0, fromScrim: 0,
  toSurface: 0, toHistory: 0, toResults: 0, toChrome: 0, toScrim: 0,
  activeIdentity: 0, activeNavigation: 0, activeMounting: 0,
  submitRetractFraction: .3, editCollapseFraction: .5, editHistoryStartFraction: .28, focusOpenFraction: .55,
  openSpec: { durationMs: 650, curve: linear }, submitSpec: { durationMs: 700, curve: linear },
  backSpec: { durationMs: 390, curve: linear }, filterSpec: { durationMs: 180, curve: linear },
  historyResizeSpec: { durationMs: 180, curve: linear },
  historyHeight: 400, displayedHistoryViewport: 400, displayedHistoryLimit: 800,
  filterNaturalHeight: 50, displayedFilterHeight: 50,
  fieldFocused: false, focusAttempts: 0,
  historyTrack: new SurfaceValueTrack(), historyLimitTrack: new SurfaceValueTrack(), filterTrack: new SurfaceValueTrack(),
  model: { interactive: true, owns: () => true, currentOwner: () => 11 },
  getUIContext: () => ({ postFrameCallback: frame => queue.push(frame),
    getFocusController: () => ({ requestFocus: id => focuses.push(id), clearFocus: () => clearFocusCount++ }) }),
  onSettled: (mode, identity) => settled.push([mode, identity]),
  onOpen: (...args) => events.push(['open', ...args]),
  onBack: (...args) => events.push(['back', ...args]),
  onMore: (...args) => events.push(['more', ...args]),
  onInputRequested: (...args) => events.push(['input', ...args]),
  historyLimit: () => 800,
});
surface.historyTrack.set(400);
surface.historyLimitTrack.set(800);
surface.filterTrack.set(50);
surface.snapToMode('idle');
const frame = ms => { now = ms; const next = queue.shift(); assert.ok(next, 'scheduled frame'); next.action(); };
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} !== ${expected}`);
const clearQueue = () => { queue.length = 0; };

// Open: bar/history/scrim share the open clock, focus arrives before settle.
surface.mode = 'input'; surface.modeChanged();
assert.equal(surface.transitionKind, 'open');
assert.equal(surface.transitionDurationMs, 650);
frame(325);
near(surface.surfaceProgress(), .5, 'open surface'); near(surface.historyProgress(), .5, 'open history');
near(surface.scrimProgress(), .5, 'open scrim'); assert.equal(surface.resultsProgress(), 0);
assert.equal(focuses.length, 0, 'focus waits for the complete input surface');
frame(400); assert.equal(focuses.length, 0, 'no focus is requested inside the surface animation');
frame(650);
assert.equal(surface.transitionKind, 'none');
near(surface.surfaceProgress(), 1, 'open settles'); near(surface.historyProgress(), 1, 'open history settles');
near(surface.scrimProgress(), 1, 'open scrim settles');
assert.equal(surface.searchMounted, true);
assert.deepEqual(settled.at(-1), ['input', 7]);
assert.ok(queue.length > 0, 'settled open schedules field focus');
queue.shift().action();
assert.equal(focuses[0], 'reader-book-search-input', 'field is focused after the open settles');
clearQueue();

// Back from input is one authored 390ms leg, not a time-compressed replay.
const backStart = now;
surface.mode = 'idle'; surface.modeChanged();
assert.equal(surface.transitionKind, 'back'); assert.equal(surface.transitionDurationMs, 390);
frame(backStart + 195); near(surface.surfaceProgress(), .5, 'back midpoint');
assert.equal(surface.scrimProgress(), 1, 'back keeps the veil until the panel has collapsed');
frame(backStart + 390);
assert.equal(surface.transitionKind, 'none'); near(surface.surfaceProgress(), 0, 'back settles');
assert.equal(surface.searchMounted, false); assert.equal(surface.fieldFocused, false);
assert.deepEqual(settled.at(-1), ['idle', 7]);
assert.ok(clearFocusCount > 0, 'back relinquishes the IME');
clearQueue();

// Submit: retract history/chrome first, then reveal results from the bar.
surface.mode = 'input'; surface.snapToMode('input');
const submitStart = now;
surface.mode = 'results'; surface.modeChanged();
assert.equal(surface.transitionKind, 'submit'); assert.equal(surface.transitionDurationMs, 700);
frame(submitStart + 210);
near(surface.historyProgress(), 0, 'submit retracts history before revealing');
near(surface.chromeProgress(), 1, 'submit installs results chrome before revealing');
assert.equal(surface.resultsProgress(), 0); near(surface.scrimProgress(), 1, 'submit keeps the shelf dim while hidden');
frame(submitStart + 455);
near(surface.resultsProgress(), .5, 'submit reveal midpoint');
near(surface.scrimProgress(), .5, 'submit scrim follows the reveal');
frame(submitStart + 700);
assert.equal(surface.transitionKind, 'none');
near(surface.resultsProgress(), 1, 'submit settles'); near(surface.scrimProgress(), 0, 'submit releases the dim');
assert.deepEqual(settled.at(-1), ['results', 7]);
clearQueue();

// Edit: tapping the field hands results back to history on one 390ms clock.
surface.fieldFocused = true;
const editStart = now;
surface.mode = 'input'; surface.modeChanged();
assert.equal(surface.transitionKind, 'edit'); assert.equal(surface.transitionDurationMs, 390);
frame(editStart + 195);
near(surface.resultsProgress(), 0, 'edit collapses results');
near(surface.chromeProgress(), 0, 'edit collapses results chrome');
const historyAtCollapse = (195 - 390 * .28) / (390 - 390 * .28);
near(surface.historyProgress(), historyAtCollapse, 'edit history overlaps the collapse');
near(surface.scrimProgress(), 1, 'edit installs the input veil');
frame(editStart + 390);
assert.equal(surface.transitionKind, 'none');
near(surface.historyProgress(), 1, 'edit settles history'); near(surface.scrimProgress(), 1, 'edit settles scrim');
assert.deepEqual(settled.at(-1), ['input', 7]);
clearQueue();

// Results -> shelf is still a single leg.
surface.mode = 'results'; surface.snapToMode('results');
const shelfBackStart = now;
surface.mode = 'idle'; surface.modeChanged();
assert.equal(surface.transitionKind, 'back'); assert.equal(surface.transitionDurationMs, 390);
frame(shelfBackStart + 390);
assert.equal(surface.transitionKind, 'none');
near(surface.surfaceProgress(), 0, 'results back settles the surface');
near(surface.resultsProgress(), 0, 'results back settles results');
assert.deepEqual(settled.at(-1), ['idle', 7]);
clearQueue();

// One frame loop owns filtered measurement; interruption starts from the sample.
surface.mode = 'results'; surface.snapToMode('results');
surface.displayedFilterHeight = 50; surface.filterNaturalHeight = 50; surface.filterTrack.set(50);
const filterStart = now;
surface.setMeasuredFilterHeight(150);
assert.equal(queue.length, 1, 'a retarget reuses the pending frame loop');
frame(filterStart + 90); near(surface.displayedFilterHeight, 100, 'filter track midpoint');
surface.setMeasuredFilterHeight(50);
frame(filterStart + 180); near(surface.displayedFilterHeight, 75, 'filter interruption starts from the sample');
frame(filterStart + 270); near(surface.displayedFilterHeight, 50, 'filter interruption settles');
assert.equal(surface.filterTrack.running(now), false);
clearQueue();

// Keyboard/window insets move the history viewport without collapsing it.
surface.mode = 'input'; surface.snapToMode('input');
surface.historyHeight = 600; surface.historyTrack.set(600); surface.displayedHistoryViewport = 600;
surface.historyLimitTrack.set(600); surface.displayedHistoryLimit = 600;
surface.historyLimit = () => 400;
const metricsStart = now;
surface.metricsChanged();
assert.equal(queue.length, 1, 'metrics retarget shares one loop');
frame(metricsStart + 90);
near(surface.displayedHistoryLimit, 500, 'history limit follows keyboard midpoint');
near(surface.displayedHistoryViewport, 500, 'history viewport follows the limit');
frame(metricsStart + 180);
near(surface.displayedHistoryLimit, 400, 'history limit settles');
near(surface.displayedHistoryViewport, 400, 'history viewport settles');
clearQueue();

// Field identity no longer churns on mode or owner claims; a new navigation
// still rebuilds the field and its rendered presentation identity.
surface.model = { interactive: true, currentOwner: () => 11 };
surface.mode = 'results'; surface.snapToMode('results');
const fieldKey = surface.fieldIdentity();
surface.mode = 'input'; surface.snapToMode('input');
assert.equal(surface.fieldIdentity(), fieldKey, 'edit keeps the focused field instance');
surface.model = { interactive: true, currentOwner: () => 12 };
assert.equal(surface.fieldIdentity(), fieldKey, 'owner claim keeps the focused field instance');
surface.navigationGeneration += 1;
assert.notEqual(surface.fieldIdentity(), fieldKey, 'new navigation still rebuilds the field');
assert.equal(surface.inputInteractive(), true);
surface.model.interactive = false; assert.equal(surface.inputInteractive(), false);

// Result focus requests edit; input focus and mode changes keep rendered identity.
surface.model = { interactive: true, currentOwner: () => 11 };
surface.mode = 'results'; surface.snapToMode('results');
surface.identity = 7; surface.navigationGeneration = 9; surface.mounting = 3;
events.length = 0;
const focusCallback = surface.focusAction(7, 9, 3);
focusCallback(true); assert.deepEqual(events.at(-1), ['input', 7, 9, 3], 'results field focus requests edit');
const beforeInputFocus = events.length;
surface.mode = 'input'; surface.snapToMode('input');
focusCallback(true); assert.equal(events.length, beforeInputFocus, 'input focus does not restart edit');
surface.mode = 'idle'; surface.snapToMode('idle');
const leading = surface.leadingAction(7, 9, 3);
surface.identity = 8; surface.navigationGeneration = 10; surface.mounting = 4;
surface.mode = 'input'; surface.snapToMode('input');
leading();
assert.deepEqual(events.at(-1), ['back', 7, 9, 3], 'rendered identity travels with the live surface action');

// Reduce motion snaps; a new mode still retires pending frames.
surface.identity = 7; surface.navigationGeneration = 9; surface.mounting = 3;
surface.mode = 'idle'; surface.snapToMode('idle');
surface.reduceMotion = true; surface.mode = 'input'; surface.modeChanged();
assert.equal(surface.transitionKind, 'none');
near(surface.surfaceProgress(), 1, 'reduce motion snaps open');
assert.deepEqual(settled.at(-1), ['input', 7]);
assert.ok(queue.length > 0, 'reduce motion still schedules field focus');
queue.shift().action();
assert.ok(focuses.length > 0, 'reduce motion focuses after the snap');
clearQueue();
surface.reduceMotion = false; surface.mode = 'input'; surface.snapToMode('input');
surface.mode = 'results'; surface.modeChanged();
assert.equal(surface.transitionKind, 'submit');
surface.mode = 'idle'; surface.modeChanged();
assert.equal(surface.transitionKind, 'back');
const stale = queue.shift();
const rapidBackStart = now;
stale.action();
frame(rapidBackStart + 195);
near(surface.surfaceProgress(), .5, 'stale submit frame cannot steer the new back');
assert.equal(surface.transitionKind, 'back');
clearQueue();

console.log('PASS search surface owner, open/submit/edit/back tracks, focus, filter/history tracks and reduce-motion');
