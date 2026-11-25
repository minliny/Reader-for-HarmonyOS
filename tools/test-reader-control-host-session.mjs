import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  backReaderControlHostSession, readerControlHostCloseCommitted, readerControlHostClosing,
  readerControlHostInputEnabled, readerControlHostPage, readerControlHostVisible,
  setReaderControlHostPage,
} from '../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts';
import {
  advanceReaderControlSession, createReaderControlSessionState, dismissReaderControlSession,
  holdReaderControlSession, openReaderControlSession, releaseReaderControlSessionHold,
  retargetReaderControlTransition, sampleReaderControlSession, setReaderControlDirectoryTab,
  trackReaderControlTransition, readerControlTargetLocation,
} from '../entry/src/main/ets/features/reading/ui/ReaderControlSessionState.ts';
import { ReaderControlMotionFrameCache } from '../entry/src/main/ets/features/reading/ui/ReaderControlMotionGeometry.ts';
import { readerControlIslandHeight } from '../entry/src/main/ets/features/reading/ui/ReaderLayoutGeometry.ts';
import { readerControlMotionMs } from '../entry/src/main/ets/features/reading/ui/ReaderControlMotionPolicy.ts';
import { READER_REDUCED_FADE_MS } from '../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';

const timing = { showDurationMs: 420, dismissDurationMs: 360,
  morphDurationMs: 1150, navigateDurationMs: 0 };
const finish = state => {
  let current = state;
  for (let n = 0; n < 8 && current.transition; n++) {
    current = advanceReaderControlSession(current, 10000, current.epoch);
  }
  return current;
};
const home = () => finish(openReaderControlSession(createReaderControlSessionState(), timing.showDurationMs));
const cases = [
  ['moduleDirectory', 'moduleDirectory', 'directory'],
  ['moduleTts', 'fullTts', 'tts'], ['moduleAppearance', 'fullAppearance', 'appearance'],
  ['moduleSettings', 'fullSettings', 'settings'], ['quickSearch', 'fullSearch', 'search'],
  ['quickAutoPage', 'fullAutoPage', 'autoPage'], ['quickReplace', 'quickReplace', 'replace'],
];
for (const [quick, full, module] of cases) {
  let state = setReaderControlHostPage(home(), quick, timing);
  assert.equal(state.location.module, module);
  assert.equal(readerControlHostPage(state), quick);
  assert.equal(readerControlHostVisible(state), true);
  if (quick !== full) {
    state = setReaderControlHostPage(state, full, timing);
    assert.equal(state.transition.durationMs, timing.morphDurationMs);
    state = finish(state);
    assert.equal(readerControlHostPage(state), full);
    state = finish(backReaderControlHostSession(state, timing).state);
    assert.equal(readerControlHostPage(state), quick);
  }
  state = backReaderControlHostSession(state, timing).state;
  assert.equal(readerControlHostPage(state), 'home');
  state = backReaderControlHostSession(state, timing).state;
  assert.equal(state.transition.durationMs, 360);
  assert.equal(readerControlHostVisible(state), true, 'close intent keeps input blocked');
  assert.equal(readerControlHostClosing(state), true);
  const again = backReaderControlHostSession(state, timing);
  assert.equal(again.consumed, true, 'closing Back cannot exit the reader');
  state = finish(again.state);
  assert.equal(readerControlHostCloseCommitted(state, 0), true);
  assert.equal(readerControlHostCloseCommitted(state, state.closeRevision), false);
  assert.equal(readerControlHostVisible(state), false);
  assert.equal(backReaderControlHostSession(state, timing).consumed, false);
}

let state = setReaderControlHostPage(home(), 'moduleDirectory', timing);
state = setReaderControlDirectoryTab(state, 'bookmarks');
state = dismissReaderControlSession(state, 360);
state = holdReaderControlSession(state, 3);
state = trackReaderControlTransition(state, 1, state.epoch);
assert.equal(sampleReaderControlSession(state).visibilityProgress, 0);
assert.equal(readerControlHostVisible(state), true);
assert.equal(readerControlHostCloseCommitted(state, 0), false);
state = trackReaderControlTransition(state, 0.9, state.epoch);
state = retargetReaderControlTransition(releaseReaderControlSessionHold(state), 0, 360);
state = finish(state);
assert.equal(state.location.directoryTab, 'bookmarks');
assert.equal(state.closeRevision, 0);
assert.equal(readerControlHostClosing(state), false);
state = finish(dismissReaderControlSession(state, 360));
assert.equal(readerControlHostCloseCommitted(state, 0), true);
state = finish(openReaderControlSession(state, 420));
assert.equal(readerControlHostPage(state), 'home');

const enabled = { mounted: true, exitRequested: false, appForeground: true,
  windowChromeActive: true, interactionBlocked: false, controlObscured: false };
assert.equal(readerControlHostInputEnabled(enabled), true);
for (const key of Object.keys(enabled)) {
  assert.equal(readerControlHostInputEnabled({ ...enabled, [key]: !enabled[key] }), false, key);
}
assert.equal(setReaderControlHostPage(createReaderControlSessionState(), 'fullSearch', timing).location.level,
  'hidden', 'a late page callback cannot reopen a committed hidden control');

state = setReaderControlHostPage(home(), 'fullSearch', timing);
state = advanceReaderControlSession(state, 700, state.epoch);
const midFrame = sampleReaderControlSession(state);
state = backReaderControlHostSession(state, timing).state;
state = backReaderControlHostSession(state, timing).state;
assert.equal(readerControlHostPage(state), 'home');
assert.deepEqual(sampleReaderControlSession(state), midFrame,
  'second Back changes content level without snapping the unfinished shape to Quick');
assert.equal(state.transition.durationMs, 1150);

const redesigned = { ...timing, layerDurationMs: 220, navigateDurationMs: 240,
  directSheetDurationMs: 260, directSheetCloseDurationMs: 210 };
for (const [page, module] of [['moduleDirectory', 'directory'], ['fullSearch', 'search'], ['quickReplace', 'replace']]) {
  const opening = setReaderControlHostPage(home(), page, redesigned);
  assert.equal(opening.transition.fromLocation.level, 'home');
  assert.equal(opening.transition.toLocation.form, 'full');
  assert.equal(opening.transition.toLocation.module, module);
  assert.equal(opening.transition.durationMs, 260);
  const partial = advanceReaderControlSession(opening, 90, opening.epoch);
  const earlyBack = backReaderControlHostSession(partial, redesigned);
  assert.deepEqual(sampleReaderControlSession(earlyBack.state), sampleReaderControlSession(partial));
  assert.equal(earlyBack.state.transition.toLocation.level, 'home');
  const open = finish(opening);
  assert.equal(open.location.form, 'full');
  assert.equal(setReaderControlHostPage(open, page, redesigned), open, 'repeat entry keeps the current module');
  const closing = backReaderControlHostSession(open, redesigned).state;
  assert.equal(closing.transition.toLocation.level, 'home');
  assert.equal(closing.transition.durationMs, 210);
  assert.equal(backReaderControlHostSession(closing, redesigned).state, closing, 'Back during exit cannot dismiss the home island');
  assert.equal(finish(closing).location.level, 'home');
}
const autoOpening = setReaderControlHostPage(home(), 'quickAutoPage', redesigned);
assert.equal(autoOpening.transition.durationMs, 220);
const ttsOpening = setReaderControlHostPage(finish(autoOpening), 'moduleTts', redesigned);
assert.equal(ttsOpening.transition.durationMs, 240);
assert.equal(setReaderControlHostPage(finish(ttsOpening), 'home', redesigned).transition.durationMs, 220);

const fixed = { ...redesigned, fixedIsland: true, navigateDurationMs: 220 };
const fixedFrames = new ReaderControlMotionFrameCache();
for (const panelWidth of [364, 356]) {
  const panelHeight = readerControlIslandHeight(736);
  const islandHome = fixedFrames.sample(1, 0, panelWidth, panelHeight, 16, panelHeight, 0, undefined, 'home');
  let current = home();
  for (const full of ['fullAutoPage', 'fullTts', 'fullAppearance', 'fullSettings']) {
    const next = setReaderControlHostPage(current, full, fixed);
    assert.equal(readerControlTargetLocation(next).form, 'quick');
    assert.equal(next.transition.kind, 'navigate');
    assert.equal(next.transition.durationMs, 220);
    const module = fixedFrames.sample(1, .5, panelWidth, panelHeight, 16, panelHeight, 0, undefined, 'module');
    assert.equal(module.shell.height, 330);
    assert.deepEqual(module.navigation, islandHome.navigation);
    assert.ok(module.content.height > 0);
    current = finish(next);
    assert.equal(sampleReaderControlSession(current).expansionProgress, 0);
  }
  assert.equal(readerControlTargetLocation(backReaderControlHostSession(current, fixed).state).level, 'home');
  assert.equal(readerControlTargetLocation(setReaderControlHostPage(current, 'fullSearch', fixed)).form, 'full');
}
assert.equal(readerControlIslandHeight(250), 250, 'short windows bound the island without expanding it');
assert.equal(readerControlMotionMs(220, true), READER_REDUCED_FADE_MS);
assert.equal(readerControlMotionMs(200, true), READER_REDUCED_FADE_MS);
assert.equal(readerControlMotionMs(220, false), 220);
const fadeFrames = new ReaderControlMotionFrameCache();
for (const form of ['home', 'module', 'legacy']) {
  const progress = form === 'legacy' ? 1 : 0;
  const rest = fadeFrames.sample(1, progress, 360, 330, 16, 330, 0, undefined, form, true);
  for (const visibility of [0, .3, .7, 1]) {
    const fade = fadeFrames.sample(visibility, progress, 360, 330, 16, 330, 24, undefined, form, true);
    assert.deepEqual(fade.topBar, { translateY: 0, opacity: visibility });
    assert.deepEqual(fade.dock, { translateY: 0, opacity: visibility });
    for (const actor of ['shell', 'content', 'header', 'navigation', 'brightness']) {
      assert.deepEqual(fade[actor], rest[actor], `reduced ${form} keeps ${actor} fixed`);
    }
  }
}

// Wiring checks are structural only; they do not execute ArkUI or prove pixels.
const host = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/LocalReadingExperience.ets', import.meta.url), 'utf8');
assert.match(host, /@State @Watch\('onControlSessionChanged'\) private controlSession:/);
assert.match(host, /controlSession: \$controlSession/);
assert.match(host, /inputEnabled: this\.isControlInputEnabled\(\)/);
assert.match(host, /invalidationRevision: this\.controlInputRevision, excludedRects: this\.controlBackdropRegions/);
assert.match(host, /controlOpenRevision: this\.controlOpenRevision/);
assert.match(host, /readerControlHostCloseCommitted\(this\.controlSession, this\.observedControlCloseRevision\)/);
assert.doesNotMatch(host, /this\.(?:controlVisible|controlPage|controlShellExitArmed)\s*=(?!=)/);
assert.doesNotMatch(host, /scheduleControlRouteReset|controlRouteResetTimer|controlShellExitGeneration/);
assert.match(host, /directSheetRedesign: true/);
assert.match(host, /directSheetDurationMs: this\.reduceMotion \? READER_REDUCED_FADE_MS : READER_SHEET_OPEN_MS/);
assert.match(host, /directSheetCloseDurationMs: this\.reduceMotion \? READER_REDUCED_FADE_MS : READER_SHEET_CLOSE_MS/);
console.log('Reader control Host session: production projection, command, close-commit and lifecycle cases PASS');
console.log('Reader control Host wiring: structural checks PASS (not ArkUI execution or visual acceptance)');
