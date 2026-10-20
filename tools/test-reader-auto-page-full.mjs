import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import {
  createDefaultReaderAutoPageFullConfiguration,
  formatReaderAutoPageFullTimerSummary,
  formatReaderAutoPageFullWheelValue,
  normalizeReaderAutoPageFullConfiguration,
  readerAutoPageFullTimerDurationSeconds,
  setReaderAutoPageFullFollowHighlight,
  setReaderAutoPageFullSpeed,
  stepReaderAutoPageFullTimer,
} from '../entry/src/main/ets/features/reading/ReaderAutoPageFullState.ts';

async function configurationCase() {
const initial = createDefaultReaderAutoPageFullConfiguration();
assert.deepEqual(initial, {
  timerMinutes: 15,
  timerSeconds: 0,
  speedSeconds: 8,
  followHighlight: false,
});

assert.deepEqual(normalizeReaderAutoPageFullConfiguration({
  timerMinutes: 999,
  timerSeconds: -4,
  speedSeconds: Number.NaN,
  followHighlight: false,
}), {
  timerMinutes: 180,
  timerSeconds: 0,
  speedSeconds: 2,
  followHighlight: false,
});

let next = stepReaderAutoPageFullTimer(initial, 'minutes', 1);
assert.equal(next.timerMinutes, 16);
next = stepReaderAutoPageFullTimer(next, 'seconds', 1);
assert.equal(next.timerSeconds, 1);
assert.equal(initial.timerMinutes, 15, 'pure transitions must not mutate their input');
assert.equal(stepReaderAutoPageFullTimer({ ...initial, timerMinutes: 0 }, 'minutes', -1).timerMinutes, 0);
assert.equal(stepReaderAutoPageFullTimer({ ...initial, timerMinutes: 180 }, 'minutes', 1).timerMinutes, 180);
assert.equal(stepReaderAutoPageFullTimer({ ...initial, timerSeconds: 59 }, 'seconds', 1).timerSeconds, 59);
assert.equal(setReaderAutoPageFullSpeed(initial, 100).speedSeconds, 20);
assert.equal(setReaderAutoPageFullSpeed(initial, 1).speedSeconds, 2);
assert.equal(setReaderAutoPageFullFollowHighlight(initial, false).followHighlight, false);
assert.equal(setReaderAutoPageFullFollowHighlight(initial, true).followHighlight, true,
  'follow highlight must retain the user selection once the reading consumer is wired');
assert.equal(formatReaderAutoPageFullWheelValue(0), '00');
assert.equal(formatReaderAutoPageFullWheelValue(8), '08');
assert.equal(formatReaderAutoPageFullWheelValue(180), '180');
assert.equal(readerAutoPageFullTimerDurationSeconds(initial), 15 * 60);
assert.equal(formatReaderAutoPageFullTimerSummary(initial), '15:00');

}
async function chapterAdmissionCase() {
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
const StepOwner = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url), 'ReaderControlPanel', ['canStepChapter']);
const stepOwner = Object.assign(new StepOwner(), { currentChapterIndex: 1, readableChapterPosition: 0,
  totalChapters: 53, tocEntries: [{index:0,navigable:false},{index:1,navigable:true}] });
assert.equal(stepOwner.canStepChapter(-1), false, 'first real chapter after a volume cannot step into the group');
assert.equal(stepOwner.canStepChapter(1), true, 'bounded window uses global readable rank for the next chapter');
stepOwner.currentChapterIndex = 107; stepOwner.readableChapterPosition = 52;
assert.equal(stepOwner.canStepChapter(1), false, 'last readable chapter stops despite sparse canonical IDs');
assert.equal(stepOwner.canStepChapter(-1), true);
stepOwner.readableChapterPosition = -1;
stepOwner.tocEntries = [{index:0,navigable:false},{index:1,navigable:true},{index:107,navigable:true},{index:108,navigable:false}];
assert.equal(stepOwner.canStepChapter(1), false, 'disabled tail does not enable chapter advance');

}
async function sharedContentCase() {
  const { readFile } = await import('node:fs/promises');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const source = await readFile(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets', import.meta.url), 'utf8');
  const childSource = await readFile(new URL('../entry/src/main/ets/features/reading/ReaderControlAutoPageContent.ets', import.meta.url), 'utf8');
  let captured;
  class ContentBoundary { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); captured = this; } }
  const { owner } = createReaderBuilderProbe(source, ['autoPageModuleContent'], {
    ReaderControlAutoPageContent: ContentBoundary,
  }, { childSources: { ReaderControlAutoPageContent: childSource } });
  const calls = [];
  const callbacks = {
    onBack: ['requestPage', 'home'], onPreviousChapter: ['onPreviousChapter'],
    onToggleRunning: ['onAutoPageToggle'], onStop: ['onAutoPageStop'], onNextChapter: ['onNextChapter'],
    onTimerChange: ['onAutoPageFullTimerChange', 4, 12], onSpeedChange: ['onAutoPageFullSpeedChange', 9],
    onFollowHighlightChange: ['onAutoPageFollowHighlightChange', true],
  };
  Object.assign(owner, { launchSample: undefined, launchOwnsControls: false, onLaunchSourceVisible() {},
    contentEndpointHeight: () => 700, isExpanded: () => true, contentMotionProgress: .8,
    contentLocation: () => ({ form: 'full' }), contentMotionWidth: 360, contentMotionHeight: 700,
    secondaryModuleInputEnabled: module => module === 'autoPage', canStepChapter: direction => direction === 1,
    autoPageStatus: 'paused', autoPageSpeedSeconds: 8, autoPageTimerMinutes: 4, autoPageTimerSeconds: 12,
    autoPageTimerSummaryText: '04:12', autoPageFollowHighlight: false, reportSessionMorphSource() {},
  });
  for (const [target] of Object.values(callbacks)) owner[target] = (...args) => calls.push([target, ...args]);
  owner.autoPageModuleContent(); assert.ok(captured, 'actual AutoPage child is mounted');
  assert.equal(captured.params.canPreviousChapter, false); assert.equal(captured.params.canNextChapter, true);
  assert.equal(captured.params.interactionEnabled, true); assert.equal(captured.params.form, 'full');
  for (const [prop, [target, ...args]] of Object.entries(callbacks)) {
    assert.equal(typeof captured.params[prop], 'function', `actual callback ${prop}`);
    captured.params[prop](...(prop === 'onBack' ? [] : args)); assert.deepEqual(calls.at(-1), [target, ...args]);
  }
}
const cases = { 'configuration': configurationCase, 'chapter-admission': chapterAdmissionCase, 'shared-content': sharedContentCase };
for (const id of selectContractCases({
  'configuration': { description: 'Production timer/speed/follow configuration normalization and immutable bounds', resources: [] },
  'chapter-admission': { description: 'Actual canStepChapter using sparse canonical IDs and readable rank', resources: [] },
  'shared-content': { description: 'SDK-emitted current AutoPage child callbacks; no legacy Full geometry', resources: [] },
})) { await cases[id](); recordContractCasePass(id); }
