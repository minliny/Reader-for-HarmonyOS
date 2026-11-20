import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected=selectContractCases({'opening-handoff':{description:'Three actual opening methods and explicit frame callback port; loading/error/reduced motion/stale selection',resources:[]}});
for(const id of selected){
// Explicit regression for the production opening state methods; no device or build.
const { default: assert } = await import('node:assert/strict');
const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');

class Frame { constructor(callback) { this.callback = callback; } }
const Reader = selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url), 'ReadingExperience',
  ['openingHandoffChanged', 'readingPhaseChanged', 'finishOpeningHandoff'],
  { ReaderUIFrameCallback: Frame, readerMotionAnimateParam: (id, reduce) => ({ id, reduce }) });

function owner() {
  const frames = [];
  const animations = [];
  const reader = Object.assign(new Reader(), {
    mounted: true, openingHandoffActive: true, openingHandoffConsumed: false,
    openingSkeletonPending: false, openingTextOpacity: 1, openingRevealGeneration: 0,
    lifecycleToken: 7, chapterSelectionToken: 3, visiblePageSelectionToken: 3,
    phase: 'loading', reduceMotion: false,
    isReaderIdentityCurrent: () => true, isMountedToken: token => token === 7,
    isSessionActive: token => token === 7, sourceSwitchCompletionChanged() {},
    getUIContext: () => ({ postFrameCallback: frame => frames.push(frame),
      animateTo: (param, update) => { animations.push(param); update(); } }),
  });
  return { reader, frames, animations };
}

const first = owner();
first.reader.openingHandoffChanged();
assert.equal(first.reader.openingSkeletonPending, true);
assert.equal(first.reader.openingTextOpacity, 0);
first.reader.openingHandoffActive = false;
first.reader.openingHandoffChanged();
assert.equal(first.reader.openingSkeletonPending, true, 'animation end does not dismiss loading');
first.reader.phase = 'ready';
first.reader.finishOpeningHandoff();
assert.equal(first.reader.openingSkeletonPending, false);
first.frames.shift().callback();
assert.deepEqual(first.animations, [{ id: 'bookshelf.open.fade', reduce: false }]);
assert.equal(first.reader.openingTextOpacity, 1);
first.reader.openingHandoffActive = true;
first.reader.openingHandoffChanged();
assert.equal(first.reader.openingSkeletonPending, false, 'later chapters do not replay opening');

const failed = owner();
failed.reader.openingHandoffChanged();
failed.reader.phase = 'failed';
failed.reader.readingPhaseChanged();
assert.equal(failed.reader.openingSkeletonPending, false);
assert.equal(failed.reader.openingTextOpacity, 1);

const stale = owner();
stale.reader.openingHandoffChanged();
stale.reader.phase = 'ready';
stale.reader.finishOpeningHandoff();
stale.reader.chapterSelectionToken += 1;
stale.frames.shift().callback();
assert.equal(stale.animations.length, 0);
assert.equal(stale.reader.openingTextOpacity, 1);

const reduced = owner();
reduced.reader.reduceMotion = true;
reduced.reader.openingHandoffChanged();
reduced.reader.phase = 'ready';
reduced.reader.finishOpeningHandoff();
reduced.frames.shift().callback();
assert.deepEqual(reduced.animations, [{ id: 'bookshelf.open.fade', reduce: true }]);
console.log('PASS opening page handoff owner');

recordContractCasePass(id);
}
