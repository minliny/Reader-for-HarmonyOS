import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  backReaderControlHostSession, readerControlHostCloseCommitted, readerControlHostClosing,
  readerControlHostInputEnabled, readerControlHostPage, readerControlHostVisible,
  setReaderControlHostPage,
} from '../entry/src/main/ets/features/reading/ReaderControlHostSession.ts';
import {
  advanceReaderControlSession, createReaderControlSessionState, dismissReaderControlSession,
  holdReaderControlSession, openReaderControlSession, releaseReaderControlSessionHold,
  retargetReaderControlTransition, sampleReaderControlSession, setReaderControlDirectoryTab,
  trackReaderControlTransition,
} from '../entry/src/main/ets/features/reading/ReaderControlSessionState.ts';

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

// Wiring checks are structural only; they do not execute ArkUI or prove pixels.
const host = readFileSync(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url), 'utf8');
assert.match(host, /@State @Watch\('onControlSessionChanged'\) private controlSession:/);
assert.match(host, /controlSession: \$controlSession/);
assert.match(host, /inputEnabled: this\.isControlInputEnabled\(\)/);
assert.match(host, /invalidationRevision: this\.controlInputRevision, excludedRects: this\.controlBackdropRegions/);
assert.match(host, /controlOpenRevision: this\.controlOpenRevision/);
assert.match(host, /readerControlHostCloseCommitted\(this\.controlSession, this\.observedControlCloseRevision\)/);
assert.doesNotMatch(host, /this\.(?:controlVisible|controlPage|controlShellExitArmed)\s*=(?!=)/);
assert.doesNotMatch(host, /scheduleControlRouteReset|controlRouteResetTimer|controlShellExitGeneration/);
assert.match(host, /onExpandDirectory: \(\): void => this\.expandControlDirectory\(\)/);
console.log('Reader control Host session: production projection, command, close-commit and lifecycle cases PASS');
console.log('Reader control Host wiring: structural checks PASS (not ArkUI execution or visual acceptance)');
